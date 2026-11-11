import json
import re
import time
import requests
import websocket

# 替换为你当前的 Kaggle Jupyter URL（末尾不带斜杠）
JUPYTER_URL = "https://kkb-production.jupyter-proxy.kaggle.net/k/368339076/eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwidHlwIjoiSldUIn0..pLsR-N6rbFsYtLERFIlUbA.BdJnuBHpun6NjJCQ5Av-uz1QUHdFdFTX7ogGXdRN1rWTCpYS2Albd8sEuuaiJsdDSqoBhlm5Se--efT7VQptSW6AmTJUN_1W69tHyYjXBPsxJ4ClgC2Zl6Dn84qvqysl7-rnO0NX91-urGT-de9-zNK2h7dpzoQW2eUHcLSmWsTbLcRNvl8WDVceLNZbtuz7cC8cPH8LzeKMFu5pH5b7EIfLj_Jei3-4loMlx4RTpUn-HAgD8AG_iNACpvehLSW7.NWAsyYMhsqCa6YAXtd5wVQ/proxy"


def fetch_system_metrics():
  headers = {"Content-Type": "application/json"}

  # 1. 创建临时终端
  resp = requests.post(f"{JUPYTER_URL}/api/terminals", headers=headers, timeout=5)
  if resp.status_code != 200:
    print(f"❌ 终端创建失败 [{resp.status_code}]: {resp.text}")
    return
  term_name = resp.json()["name"]

  # 2. 构造探针指令（采集 CPU、内存、磁盘和 GPU 显存/利用率）
  probe_cmd = (
      "python3 -c \""
      "import psutil, json, subprocess; "
      "cpu = psutil.cpu_percent(interval=0.2); "
      "ram = psutil.virtual_memory(); "
      "disk = psutil.disk_usage('/kaggle/working'); "
      "gpu = 'No GPU'; "
      "try: "
      "  out = subprocess.check_output(['nvidia-smi', '--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu', '--format=csv,noheader,nounits']).decode().strip(); "
      "  g_name, g_util, g_used, g_total, g_temp = [x.strip() for x in out.split(',')]; "
      "  gpu = {'name': g_name, 'util': f'{g_util}%', 'mem_used_mb': float(g_used), 'mem_total_mb': float(g_total), 'temp': f'{g_temp}C'}; "
      "except Exception: pass; "
      "data = {'cpu_percent': cpu, 'ram_used_gb': round(ram.used/1024**3, 2), 'ram_total_gb': round(ram.total/1024**3, 2), 'disk_used_gb': round(disk.used/1024**3, 2), 'disk_total_gb': round(disk.total/1024**3, 2), 'gpu': gpu}; "
      "print('___METRICS_START___' + json.dumps(data) + '___METRICS_END___')\"\n"
  )

  # 3. 建立 WebSocket 接收数据
  ws_url = (
      JUPYTER_URL.replace("https://", "wss://").replace("http://", "ws://")
      + f"/terminals/websocket/{term_name}"
  )
  ws = websocket.create_connection(ws_url, timeout=10)

  # 忽略初始的 banner
  time.sleep(0.3)
  while ws.recv_frame():
    # 消费掉欢迎输出
    break

  # 发送命令
  ws.send(json.dumps(["stdin", probe_cmd]))

  # 读取返回字符流
  output_text = ""
  start_time = time.time()
  while time.time() - start_time < 5:
    msg = ws.recv()
    if msg:
      parsed = json.loads(msg)
      if parsed[0] == "stdout":
        output_text += parsed[1]
        if "___METRICS_END___" in output_text:
          break

  ws.close()

  # 4. 清理并销毁终端会话
  requests.delete(f"{JUPYTER_URL}/api/terminals/{term_name}", timeout=5)

  # 5. 解析并格式化展示
  match = re.search(r"___METRICS_START___(.*?)___METRICS_END___", output_text)
  if match:
    metrics = json.loads(match.group(1))
    print("\n🖥️  Kaggle 容器运行状态：")
    print(f"  ├─ CPU 占用率 : {metrics['cpu_percent']}%")
    print(
        f"  ├─ 内存使用   : {metrics['ram_used_gb']} GB /"
        f" {metrics['ram_total_gb']} GB"
    )
    print(
        f"  ├─ 磁盘工作区 : {metrics['disk_used_gb']} GB /"
        f" {metrics['disk_total_gb']} GB (/kaggle/working)"
    )
    if isinstance(metrics["gpu"], dict):
      g = metrics["gpu"]
      print(f"  └─ GPU 显卡   : {g['name']}")
      print(
          f"     ├─ 显存占用: {g['mem_used_mb']:.0f} MB / {g['mem_total_mb']:.0f}"
          f" MB ({g['mem_used_mb']/g['mem_total_mb']*100:.1f}%)"
      )
      print(f"     └─ 核心负荷: {g['util']} (温度: {g['temp']})")
    else:
      print("  └─ GPU 显卡   : 纯 CPU 模式（未启用 GPU 加速）")
  else:
    print("❌ 未捕获到标准指标输出。")


if __name__ == "__main__":
  fetch_system_metrics()