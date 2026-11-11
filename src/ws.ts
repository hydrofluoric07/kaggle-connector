import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as http from 'node:http';
import * as https from 'node:https';
import type * as net from 'node:net';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { KaggleError, classifyHttpError, classifyNetworkError } from './core/errors';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_WS_PAYLOAD_BYTES = 16 * 1024 * 1024;

export interface WebSocketConnectOptions {
  token?: string;
  proxy?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface KernelExecuteOptions extends WebSocketConnectOptions {
  channelsUrl: string;
  code: string;
  waitForReady?: boolean;
}

export interface KernelExecuteResult {
  stdout: string;
  stderr: string;
  errorName?: string;
  errorValue?: string;
}

interface ParsedFrame {
  fin: boolean;
  opcode: number;
  payload: Buffer;
}

class MinimalWebSocket {
  private buffer: Buffer = Buffer.alloc(0);
  private fragmentChunks: Buffer[] = [];
  private fragmentOpcode = 0;
  private closed = false;
  private readonly messageListeners = new Set<(text: string) => void>();
  private readonly closeListeners = new Set<(reason?: Error) => void>();

  constructor(private readonly socket: net.Socket, initialHead: Buffer) {
    socket.on('data', (chunk: Buffer) => {
      this.onData(chunk);
    });
    socket.on('error', (error: Error) => {
      this.finishClose(classifyNetworkError(error));
    });
    socket.on('close', () => {
      this.finishClose();
    });

    if (initialHead.length > 0) {
      this.onData(initialHead);
    }
  }

  onMessage(listener: (text: string) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onClose(listener: (reason?: Error) => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  sendText(text: string): void {
    if (this.closed) {
      throw new KaggleError('network', 'WebSocket 连接已关闭');
    }
    this.socket.write(encodeClientFrame(0x1, Buffer.from(text, 'utf8')));
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    try {
      this.socket.write(encodeClientFrame(0x8, Buffer.alloc(0)));
    } catch {
      // Ignore write errors during teardown.
    }
    this.socket.end();
    this.socket.destroy();
  }

  private finishClose(reason?: Error): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const listener of this.closeListeners) {
      listener(reason);
    }
    this.messageListeners.clear();
    this.closeListeners.clear();
  }

  private onData(chunk: Buffer): void {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);

    while (!this.closed) {
      const parsed = tryDecodeServerFrame(this.buffer);
      if (!parsed) {
        return;
      }
      this.buffer = this.buffer.subarray(parsed.consumed);
      this.handleFrame(parsed.frame);
    }
  }

  private handleFrame(frame: ParsedFrame): void {
    if (frame.opcode === 0x8) {
      this.finishClose();
      this.socket.destroy();
      return;
    }
    if (frame.opcode === 0x9) {
      try {
        this.socket.write(encodeClientFrame(0xa, frame.payload));
      } catch {
        // Ignore pong write errors if socket is already closing.
      }
      return;
    }
    if (frame.opcode === 0xa) {
      return;
    }

    if (frame.opcode === 0x1 || frame.opcode === 0x2) {
      if (frame.fin) {
        this.emitPayload(frame.opcode, frame.payload);
      } else {
        this.fragmentOpcode = frame.opcode;
        this.fragmentChunks = [frame.payload];
      }
      return;
    }

    if (frame.opcode === 0x0 && this.fragmentChunks.length > 0) {
      this.fragmentChunks.push(frame.payload);
      if (frame.fin) {
        const joined = Buffer.concat(this.fragmentChunks);
        const opcode = this.fragmentOpcode;
        this.fragmentChunks = [];
        this.fragmentOpcode = 0;
        this.emitPayload(opcode, joined);
      }
    }
  }

  private emitPayload(opcode: number, payload: Buffer): void {
    if (opcode !== 0x1) {
      return;
    }
    const text = payload.toString('utf8');
    for (const listener of this.messageListeners) {
      listener(text);
    }
  }
}

function encodeClientFrame(opcode: number, payload: Buffer): Buffer {
  const length = payload.length;
  let headerSize = 2 + 4;
  if (length >= 126 && length <= 0xffff) {
    headerSize = 4 + 4;
  } else if (length > 0xffff) {
    headerSize = 10 + 4;
  }

  const out = Buffer.allocUnsafe(headerSize + length);
  out[0] = 0x80 | (opcode & 0x0f);

  let offset = 2;
  if (length < 126) {
    out[1] = 0x80 | length;
  } else if (length <= 0xffff) {
    out[1] = 0x80 | 126;
    out.writeUInt16BE(length, 2);
    offset = 4;
  } else {
    out[1] = 0x80 | 127;
    out.writeBigUInt64BE(BigInt(length), 2);
    offset = 10;
  }

  const mask = randomBytes(4);
  mask.copy(out, offset);
  offset += 4;

  for (let index = 0; index < length; index += 1) {
    out[offset + index] = payload[index]! ^ mask[index & 3]!;
  }
  return out;
}

function tryDecodeServerFrame(
  buffer: Buffer
): { frame: ParsedFrame; consumed: number } | undefined {
  if (buffer.length < 2) {
    return undefined;
  }
  const first = buffer[0]!;
  const second = buffer[1]!;
  const fin = (first & 0x80) !== 0;
  const opcode = first & 0x0f;
  const masked = (second & 0x80) !== 0;
  let payloadLength = second & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < 4) {
      return undefined;
    }
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) {
      return undefined;
    }
    const bigLength = buffer.readBigUInt64BE(2);
    if (bigLength > BigInt(MAX_WS_PAYLOAD_BYTES)) {
      throw new KaggleError('unknown', 'WebSocket 响应帧过大');
    }
    payloadLength = Number(bigLength);
    offset = 10;
  }

  if (payloadLength > MAX_WS_PAYLOAD_BYTES) {
    throw new KaggleError('unknown', 'WebSocket 响应帧过大');
  }

  const maskOffset = offset;
  if (masked) {
    offset += 4;
  }
  if (buffer.length < offset + payloadLength) {
    return undefined;
  }

  let payload = buffer.subarray(offset, offset + payloadLength);
  if (masked) {
    const unmasked = Buffer.allocUnsafe(payloadLength);
    for (let index = 0; index < payloadLength; index += 1) {
      unmasked[index] = payload[index]! ^ buffer[maskOffset + (index & 3)]!;
    }
    payload = unmasked;
  }

  return {
    frame: { fin, opcode, payload },
    consumed: offset + payloadLength
  };
}

function openWebSocket(url: string, options: WebSocketConnectOptions): Promise<MinimalWebSocket> {
  if (options.signal?.aborted) {
    return Promise.reject(new KaggleError('cancelled', '操作已取消'));
  }

  const target = new URL(url);
  const isHttps = target.protocol === 'https:' || target.protocol === 'wss:';
  const httpTarget = new URL(target.toString());
  httpTarget.protocol = isHttps ? 'https:' : 'http:';

  const key = randomBytes(16).toString('base64');
  const expectedAccept = createHash('sha1').update(`${key}${WS_GUID}`).digest('base64');

  const headers: Record<string, string> = {
    Connection: 'Upgrade',
    Upgrade: 'websocket',
    'Sec-WebSocket-Version': '13',
    'Sec-WebSocket-Key': key,
    Origin: httpTarget.origin
  };
  if (options.token) {
    headers.Authorization = `token ${options.token}`;
  }

  const requestOptions: https.RequestOptions = {
    method: 'GET',
    headers
  };
  if (isHttps && options.proxy) {
    requestOptions.agent = new HttpsProxyAgent(options.proxy);
  }

  return new Promise<MinimalWebSocket>((resolve, reject) => {
    let settled = false;
    let request: http.ClientRequest | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    let abortListener: (() => void) | undefined;

    const cleanup = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = undefined;
      }
      if (abortListener && options.signal) {
        options.signal.removeEventListener('abort', abortListener);
        abortListener = undefined;
      }
    };

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      request?.destroy();
      reject(error);
    };

    const timeoutMs = options.timeoutMs ?? 30000;
    timeoutTimer = setTimeout(() => {
      const timeoutError = new Error(`WebSocket 连接超时（${timeoutMs} ms）`) as Error & {
        code?: string;
      };
      timeoutError.code = 'ETIMEDOUT';
      fail(classifyNetworkError(timeoutError));
    }, timeoutMs);

    if (options.signal) {
      abortListener = () => fail(new KaggleError('cancelled', '操作已取消'));
      options.signal.addEventListener('abort', abortListener, { once: true });
    }

    try {
      request = isHttps
        ? https.request(httpTarget, requestOptions)
        : http.request(httpTarget, requestOptions as http.RequestOptions);
    } catch (error) {
      fail(classifyNetworkError(error));
      return;
    }

    request.on('upgrade', (response, socket, head) => {
      const accept = String(response.headers['sec-websocket-accept'] ?? '');
      if (accept && accept !== expectedAccept) {
        socket.destroy();
        fail(new KaggleError('network', 'WebSocket 握手校验失败'));
        return;
      }
      if (settled) {
        socket.destroy();
        return;
      }
      settled = true;
      cleanup();
      resolve(new MinimalWebSocket(socket, head));
    });

    request.on('response', (response) => {
      const chunks: Buffer[] = [];
      let total = 0;
      response.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total <= 64 * 1024) {
          chunks.push(chunk);
        }
      });
      response.on('end', () => {
        fail(
          classifyHttpError({
            status: response.statusCode ?? 0,
            statusText: response.statusMessage ?? '',
            body: Buffer.concat(chunks).toString('utf8'),
            url: httpTarget.toString(),
            location:
              typeof response.headers.location === 'string'
                ? response.headers.location
                : undefined,
            contentType: String(response.headers['content-type'] ?? '')
          })
        );
      });
      response.on('error', (error) => fail(classifyNetworkError(error)));
    });

    request.on('error', (error) => {
      fail(classifyNetworkError(error));
    });

    request.end();
  });
}

function buildJupyterMessage(
  session: string,
  msgType: string,
  content: Record<string, unknown>
): { msgId: string; payload: string } {
  const msgId = randomUUID();
  return {
    msgId,
    payload: JSON.stringify({
      header: {
        msg_id: msgId,
        username: 'kaggle-connector',
        session,
        msg_type: msgType,
        version: '5.3'
      },
      parent_header: {},
      metadata: {},
      content,
      buffers: [],
      channel: 'shell'
    })
  };
}

/**
 * Execute a short Python snippet over Jupyter's kernel WebSocket channel and
 * collect its stdout/stderr/error output.
 */
export async function executePythonInKernel(
  options: KernelExecuteOptions
): Promise<KernelExecuteResult> {
  const timeoutMs = options.timeoutMs ?? 30000;
  const ws = await openWebSocket(options.channelsUrl, {
    token: options.token,
    proxy: options.proxy,
    timeoutMs,
    signal: options.signal
  });

  const session = randomUUID();

  try {
    if (options.waitForReady) {
      await waitForKernelMessage(
        ws,
        () => {
          const msg = buildJupyterMessage(session, 'kernel_info_request', {});
          ws.sendText(msg.payload);
          return msg.msgId;
        },
        (parsed, resolve) => {
          if (parsed.msg_type === 'kernel_info_reply') {
            resolve(undefined);
          }
        },
        timeoutMs,
        options.signal
      );
    }

    let stdout = '';
    let stderr = '';
    let errorName: string | undefined;
    let errorValue: string | undefined;
    let replyReceived = false;
    let iopubIdle = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    await waitForKernelMessage(
      ws,
      () => {
        const msg = buildJupyterMessage(session, 'execute_request', {
          code: options.code,
          silent: true,
          store_history: false,
          user_expressions: {},
          allow_stdin: false,
          stop_on_error: true
        });
        ws.sendText(msg.payload);
        return msg.msgId;
      },
      (parsed, resolve) => {
        const content = (parsed.content ?? {}) as Record<string, unknown>;
        if (parsed.msg_type === 'stream') {
          const text = typeof content.text === 'string' ? content.text : '';
          if (content.name === 'stderr') {
            stderr += text;
          } else {
            stdout += text;
          }
        } else if (parsed.msg_type === 'error') {
          errorName = typeof content.ename === 'string' ? content.ename : 'Error';
          errorValue = typeof content.evalue === 'string' ? content.evalue : '';
        } else if (
          parsed.msg_type === 'status' &&
          content.execution_state === 'idle'
        ) {
          iopubIdle = true;
          if (replyReceived) {
            if (settleTimer) {
              clearTimeout(settleTimer);
              settleTimer = undefined;
            }
            resolve(undefined);
          }
        } else if (parsed.msg_type === 'execute_reply') {
          replyReceived = true;
          if (iopubIdle || errorName) {
            resolve(undefined);
          } else {
            settleTimer = setTimeout(() => resolve(undefined), 40);
          }
        }
      },
      timeoutMs,
      options.signal,
      () => {
        if (settleTimer) {
          clearTimeout(settleTimer);
          settleTimer = undefined;
        }
      }
    );

    return { stdout, stderr, errorName, errorValue };
  } finally {
    ws.close();
  }
}

interface KernelWireMessage {
  msg_type?: unknown;
  parent_header?: { msg_id?: unknown };
  content?: unknown;
}

function waitForKernelMessage<T>(
  ws: MinimalWebSocket,
  sendAndGetMsgId: () => string,
  onMatchedMessage: (parsed: KernelWireMessage, resolve: (value: T) => void) => void,
  timeoutMs: number,
  signal?: AbortSignal,
  onCleanup?: () => void
): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(new KaggleError('cancelled', '操作已取消'));
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubMsg: (() => void) | undefined;
    let unsubClose: (() => void) | undefined;
    let abortListener: (() => void) | undefined;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      unsubMsg?.();
      unsubClose?.();
      if (abortListener && signal) {
        signal.removeEventListener('abort', abortListener);
      }
      onCleanup?.();
    };

    const done = (value: T) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    timer = setTimeout(() => {
      const error = new Error(`内核执行超时（${timeoutMs} ms）`) as Error & { code?: string };
      error.code = 'ETIMEDOUT';
      fail(classifyNetworkError(error));
    }, timeoutMs);

    if (signal) {
      abortListener = () => fail(new KaggleError('cancelled', '操作已取消'));
      signal.addEventListener('abort', abortListener, { once: true });
    }

    let expectedMsgId = '';
    unsubMsg = ws.onMessage((raw) => {
      let parsed: KernelWireMessage;
      try {
        parsed = JSON.parse(raw) as KernelWireMessage;
      } catch {
        return;
      }
      if (parsed.parent_header?.msg_id !== expectedMsgId) {
        return;
      }
      onMatchedMessage(parsed, done);
    });

    unsubClose = ws.onClose((reason) => {
      fail(reason ?? new KaggleError('network', '内核 WebSocket 连接已断开'));
    });

    try {
      expectedMsgId = sendAndGetMsgId();
    } catch (error) {
      fail(error);
    }
  });
}
