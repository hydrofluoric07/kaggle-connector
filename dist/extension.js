"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/ms/index.js"(exports2, module2) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module2.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match2 = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match2) {
        return;
      }
      var n = parseFloat(match2[1]);
      var type = (match2[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  }
});

// node_modules/debug/src/common.js
var require_common = __commonJS({
  "node_modules/debug/src/common.js"(exports2, module2) {
    function setup(env2) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env2).forEach((key) => {
        createDebug[key] = env2[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
          if (!debug.enabled) {
            return;
          }
          const self = debug;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self.diff = ms;
          self.prev = prevTime;
          self.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match2, format) => {
            if (match2 === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match2 = formatter.call(self, val);
              args.splice(index, 1);
              index--;
            }
            return match2;
          });
          createDebug.formatArgs.call(self, args);
          const logFn = self.log || createDebug.log;
          logFn.apply(self, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy;
        Object.defineProperty(debug, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug);
        }
        return debug;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug.skips.push(ns.slice(1));
          } else {
            createDebug.names.push(ns);
          }
        }
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      function disable() {
        const namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name) {
        for (const skip of createDebug.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns of createDebug.names) {
          if (matchesTemplate(name, ns)) {
            return true;
          }
        }
        return false;
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module2.exports = setup;
  }
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/debug/src/browser.js"(exports2, module2) {
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.storage = localstorage();
    exports2.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports2.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module2.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match2) => {
        if (match2 === "%%") {
          return;
        }
        index++;
        if (match2 === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports2.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports2.storage.setItem("debug", namespaces);
        } else {
          exports2.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports2.storage.getItem("debug") || exports2.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/has-flag/index.js
var require_has_flag = __commonJS({
  "node_modules/has-flag/index.js"(exports2, module2) {
    "use strict";
    module2.exports = (flag, argv = process.argv) => {
      const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
      const position = argv.indexOf(prefix + flag);
      const terminatorPosition = argv.indexOf("--");
      return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
    };
  }
});

// node_modules/supports-color/index.js
var require_supports_color = __commonJS({
  "node_modules/supports-color/index.js"(exports2, module2) {
    "use strict";
    var os2 = require("os");
    var tty = require("tty");
    var hasFlag = require_has_flag();
    var { env: env2 } = process;
    var forceColor;
    if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
      forceColor = 0;
    } else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
      forceColor = 1;
    }
    if ("FORCE_COLOR" in env2) {
      if (env2.FORCE_COLOR === "true") {
        forceColor = 1;
      } else if (env2.FORCE_COLOR === "false") {
        forceColor = 0;
      } else {
        forceColor = env2.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env2.FORCE_COLOR, 10), 3);
      }
    }
    function translateLevel(level) {
      if (level === 0) {
        return false;
      }
      return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3
      };
    }
    function supportsColor(haveStream, streamIsTTY) {
      if (forceColor === 0) {
        return 0;
      }
      if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
        return 3;
      }
      if (hasFlag("color=256")) {
        return 2;
      }
      if (haveStream && !streamIsTTY && forceColor === void 0) {
        return 0;
      }
      const min = forceColor || 0;
      if (env2.TERM === "dumb") {
        return min;
      }
      if (process.platform === "win32") {
        const osRelease = os2.release().split(".");
        if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
          return Number(osRelease[2]) >= 14931 ? 3 : 2;
        }
        return 1;
      }
      if ("CI" in env2) {
        if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((sign) => sign in env2) || env2.CI_NAME === "codeship") {
          return 1;
        }
        return min;
      }
      if ("TEAMCITY_VERSION" in env2) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env2.TEAMCITY_VERSION) ? 1 : 0;
      }
      if (env2.COLORTERM === "truecolor") {
        return 3;
      }
      if ("TERM_PROGRAM" in env2) {
        const version = parseInt((env2.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
        switch (env2.TERM_PROGRAM) {
          case "iTerm.app":
            return version >= 3 ? 3 : 2;
          case "Apple_Terminal":
            return 2;
        }
      }
      if (/-256(color)?$/i.test(env2.TERM)) {
        return 2;
      }
      if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env2.TERM)) {
        return 1;
      }
      if ("COLORTERM" in env2) {
        return 1;
      }
      return min;
    }
    function getSupportLevel(stream) {
      const level = supportsColor(stream, stream && stream.isTTY);
      return translateLevel(level);
    }
    module2.exports = {
      supportsColor: getSupportLevel,
      stdout: translateLevel(supportsColor(true, tty.isatty(1))),
      stderr: translateLevel(supportsColor(true, tty.isatty(2)))
    };
  }
});

// node_modules/debug/src/node.js
var require_node = __commonJS({
  "node_modules/debug/src/node.js"(exports2, module2) {
    var tty = require("tty");
    var util = require("util");
    exports2.init = init;
    exports2.log = log2;
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports2.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = require_supports_color();
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports2.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports2.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports2.inspectOpts ? Boolean(exports2.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module2.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    function getDate() {
      if (exports2.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log2(...args) {
      return process.stderr.write(util.formatWithOptions(exports2.inspectOpts, ...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug) {
      debug.inspectOpts = {};
      const keys = Object.keys(exports2.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug.inspectOpts[keys[i]] = exports2.inspectOpts[keys[i]];
      }
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// node_modules/debug/src/index.js
var require_src = __commonJS({
  "node_modules/debug/src/index.js"(exports2, module2) {
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module2.exports = require_browser();
    } else {
      module2.exports = require_node();
    }
  }
});

// node_modules/https-proxy-agent/node_modules/agent-base/dist/helpers.js
var require_helpers = __commonJS({
  "node_modules/https-proxy-agent/node_modules/agent-base/dist/helpers.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.req = exports2.json = exports2.toBuffer = void 0;
    var http3 = __importStar(require("http"));
    var https3 = __importStar(require("https"));
    async function toBuffer(stream) {
      let length = 0;
      const chunks = [];
      for await (const chunk of stream) {
        length += chunk.length;
        chunks.push(chunk);
      }
      return Buffer.concat(chunks, length);
    }
    exports2.toBuffer = toBuffer;
    async function json(stream) {
      const buf = await toBuffer(stream);
      const str = buf.toString("utf8");
      try {
        return JSON.parse(str);
      } catch (_err) {
        const err = _err;
        err.message += ` (input: ${str})`;
        throw err;
      }
    }
    exports2.json = json;
    function req(url, opts = {}) {
      const href = typeof url === "string" ? url : url.href;
      const req2 = (href.startsWith("https:") ? https3 : http3).request(url, opts);
      const promise = new Promise((resolve2, reject) => {
        req2.once("response", resolve2).once("error", reject).end();
      });
      req2.then = promise.then.bind(promise);
      return req2;
    }
    exports2.req = req;
  }
});

// node_modules/https-proxy-agent/node_modules/agent-base/dist/index.js
var require_dist = __commonJS({
  "node_modules/https-proxy-agent/node_modules/agent-base/dist/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Agent = void 0;
    var net = __importStar(require("net"));
    var http3 = __importStar(require("http"));
    var https_1 = require("https");
    __exportStar(require_helpers(), exports2);
    var INTERNAL = Symbol("AgentBaseInternalState");
    var Agent = class extends http3.Agent {
      constructor(opts) {
        super(opts);
        this[INTERNAL] = {};
      }
      /**
       * Determine whether this is an `http` or `https` request.
       */
      isSecureEndpoint(options) {
        if (options) {
          if (typeof options.secureEndpoint === "boolean") {
            return options.secureEndpoint;
          }
          if (typeof options.protocol === "string") {
            return options.protocol === "https:";
          }
        }
        const { stack } = new Error();
        if (typeof stack !== "string")
          return false;
        return stack.split("\n").some((l) => l.indexOf("(https.js:") !== -1 || l.indexOf("node:https:") !== -1);
      }
      // In order to support async signatures in `connect()` and Node's native
      // connection pooling in `http.Agent`, the array of sockets for each origin
      // has to be updated synchronously. This is so the length of the array is
      // accurate when `addRequest()` is next called. We achieve this by creating a
      // fake socket and adding it to `sockets[origin]` and incrementing
      // `totalSocketCount`.
      incrementSockets(name) {
        if (this.maxSockets === Infinity && this.maxTotalSockets === Infinity) {
          return null;
        }
        if (!this.sockets[name]) {
          this.sockets[name] = [];
        }
        const fakeSocket = new net.Socket({ writable: false });
        this.sockets[name].push(fakeSocket);
        this.totalSocketCount++;
        return fakeSocket;
      }
      decrementSockets(name, socket) {
        if (!this.sockets[name] || socket === null) {
          return;
        }
        const sockets = this.sockets[name];
        const index = sockets.indexOf(socket);
        if (index !== -1) {
          sockets.splice(index, 1);
          this.totalSocketCount--;
          if (sockets.length === 0) {
            delete this.sockets[name];
          }
        }
      }
      // In order to properly update the socket pool, we need to call `getName()` on
      // the core `https.Agent` if it is a secureEndpoint.
      getName(options) {
        const secureEndpoint = this.isSecureEndpoint(options);
        if (secureEndpoint) {
          return https_1.Agent.prototype.getName.call(this, options);
        }
        return super.getName(options);
      }
      createSocket(req, options, cb) {
        const connectOpts = {
          ...options,
          secureEndpoint: this.isSecureEndpoint(options)
        };
        const name = this.getName(connectOpts);
        const fakeSocket = this.incrementSockets(name);
        Promise.resolve().then(() => this.connect(req, connectOpts)).then((socket) => {
          this.decrementSockets(name, fakeSocket);
          if (socket instanceof http3.Agent) {
            try {
              return socket.addRequest(req, connectOpts);
            } catch (err) {
              return cb(err);
            }
          }
          this[INTERNAL].currentSocket = socket;
          super.createSocket(req, options, cb);
        }, (err) => {
          this.decrementSockets(name, fakeSocket);
          cb(err);
        });
      }
      createConnection() {
        const socket = this[INTERNAL].currentSocket;
        this[INTERNAL].currentSocket = void 0;
        if (!socket) {
          throw new Error("No socket was returned in the `connect()` function");
        }
        return socket;
      }
      get defaultPort() {
        return this[INTERNAL].defaultPort ?? (this.protocol === "https:" ? 443 : 80);
      }
      set defaultPort(v) {
        if (this[INTERNAL]) {
          this[INTERNAL].defaultPort = v;
        }
      }
      get protocol() {
        return this[INTERNAL].protocol ?? (this.isSecureEndpoint() ? "https:" : "http:");
      }
      set protocol(v) {
        if (this[INTERNAL]) {
          this[INTERNAL].protocol = v;
        }
      }
    };
    exports2.Agent = Agent;
  }
});

// node_modules/https-proxy-agent/dist/parse-proxy-response.js
var require_parse_proxy_response = __commonJS({
  "node_modules/https-proxy-agent/dist/parse-proxy-response.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseProxyResponse = void 0;
    var debug_1 = __importDefault(require_src());
    var debug = (0, debug_1.default)("https-proxy-agent:parse-proxy-response");
    function parseProxyResponse(socket) {
      return new Promise((resolve2, reject) => {
        let buffersLength = 0;
        const buffers = [];
        function read() {
          const b = socket.read();
          if (b)
            ondata(b);
          else
            socket.once("readable", read);
        }
        function cleanup() {
          socket.removeListener("end", onend);
          socket.removeListener("error", onerror);
          socket.removeListener("readable", read);
        }
        function onend() {
          cleanup();
          debug("onend");
          reject(new Error("Proxy connection ended before receiving CONNECT response"));
        }
        function onerror(err) {
          cleanup();
          debug("onerror %o", err);
          reject(err);
        }
        function ondata(b) {
          buffers.push(b);
          buffersLength += b.length;
          const buffered = Buffer.concat(buffers, buffersLength);
          const endOfHeaders = buffered.indexOf("\r\n\r\n");
          if (endOfHeaders === -1) {
            debug("have not received end of HTTP headers yet...");
            read();
            return;
          }
          const headerParts = buffered.slice(0, endOfHeaders).toString("ascii").split("\r\n");
          const firstLine = headerParts.shift();
          if (!firstLine) {
            socket.destroy();
            return reject(new Error("No header received from proxy CONNECT response"));
          }
          const firstLineParts = firstLine.split(" ");
          const statusCode = +firstLineParts[1];
          const statusText = firstLineParts.slice(2).join(" ");
          const headers = {};
          for (const header of headerParts) {
            if (!header)
              continue;
            const firstColon = header.indexOf(":");
            if (firstColon === -1) {
              socket.destroy();
              return reject(new Error(`Invalid header from proxy CONNECT response: "${header}"`));
            }
            const key = header.slice(0, firstColon).toLowerCase();
            const value = header.slice(firstColon + 1).trimStart();
            const current = headers[key];
            if (typeof current === "string") {
              headers[key] = [current, value];
            } else if (Array.isArray(current)) {
              current.push(value);
            } else {
              headers[key] = value;
            }
          }
          debug("got proxy server response: %o %o", firstLine, headers);
          cleanup();
          resolve2({
            connect: {
              statusCode,
              statusText,
              headers
            },
            buffered
          });
        }
        socket.on("error", onerror);
        socket.on("end", onend);
        read();
      });
    }
    exports2.parseProxyResponse = parseProxyResponse;
  }
});

// node_modules/https-proxy-agent/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/https-proxy-agent/dist/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.HttpsProxyAgent = void 0;
    var net = __importStar(require("net"));
    var tls = __importStar(require("tls"));
    var assert_1 = __importDefault(require("assert"));
    var debug_1 = __importDefault(require_src());
    var agent_base_1 = require_dist();
    var url_1 = require("url");
    var parse_proxy_response_1 = require_parse_proxy_response();
    var debug = (0, debug_1.default)("https-proxy-agent");
    var setServernameFromNonIpHost = (options) => {
      if (options.servername === void 0 && options.host && !net.isIP(options.host)) {
        return {
          ...options,
          servername: options.host
        };
      }
      return options;
    };
    var HttpsProxyAgent3 = class extends agent_base_1.Agent {
      constructor(proxy, opts) {
        super(opts);
        this.options = { path: void 0 };
        this.proxy = typeof proxy === "string" ? new url_1.URL(proxy) : proxy;
        this.proxyHeaders = opts?.headers ?? {};
        debug("Creating new HttpsProxyAgent instance: %o", this.proxy.href);
        const host = (this.proxy.hostname || this.proxy.host).replace(/^\[|\]$/g, "");
        const port = this.proxy.port ? parseInt(this.proxy.port, 10) : this.proxy.protocol === "https:" ? 443 : 80;
        this.connectOpts = {
          // Attempt to negotiate http/1.1 for proxy servers that support http/2
          ALPNProtocols: ["http/1.1"],
          ...opts ? omit(opts, "headers") : null,
          host,
          port
        };
      }
      /**
       * Called when the node-core HTTP client library is creating a
       * new HTTP request.
       */
      async connect(req, opts) {
        const { proxy } = this;
        if (!opts.host) {
          throw new TypeError('No "host" provided');
        }
        let socket;
        if (proxy.protocol === "https:") {
          debug("Creating `tls.Socket`: %o", this.connectOpts);
          socket = tls.connect(setServernameFromNonIpHost(this.connectOpts));
        } else {
          debug("Creating `net.Socket`: %o", this.connectOpts);
          socket = net.connect(this.connectOpts);
        }
        const headers = typeof this.proxyHeaders === "function" ? this.proxyHeaders() : { ...this.proxyHeaders };
        const host = net.isIPv6(opts.host) ? `[${opts.host}]` : opts.host;
        let payload = `CONNECT ${host}:${opts.port} HTTP/1.1\r
`;
        if (proxy.username || proxy.password) {
          const auth = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
          headers["Proxy-Authorization"] = `Basic ${Buffer.from(auth).toString("base64")}`;
        }
        headers.Host = `${host}:${opts.port}`;
        if (!headers["Proxy-Connection"]) {
          headers["Proxy-Connection"] = this.keepAlive ? "Keep-Alive" : "close";
        }
        for (const name of Object.keys(headers)) {
          payload += `${name}: ${headers[name]}\r
`;
        }
        const proxyResponsePromise = (0, parse_proxy_response_1.parseProxyResponse)(socket);
        socket.write(`${payload}\r
`);
        const { connect, buffered } = await proxyResponsePromise;
        req.emit("proxyConnect", connect);
        this.emit("proxyConnect", connect, req);
        if (connect.statusCode === 200) {
          req.once("socket", resume);
          if (opts.secureEndpoint) {
            debug("Upgrading socket connection to TLS");
            return tls.connect({
              ...omit(setServernameFromNonIpHost(opts), "host", "path", "port"),
              socket
            });
          }
          return socket;
        }
        socket.destroy();
        const fakeSocket = new net.Socket({ writable: false });
        fakeSocket.readable = true;
        req.once("socket", (s) => {
          debug("Replaying proxy buffer for failed request");
          (0, assert_1.default)(s.listenerCount("data") > 0);
          s.push(buffered);
          s.push(null);
        });
        return fakeSocket;
      }
    };
    HttpsProxyAgent3.protocols = ["http", "https"];
    exports2.HttpsProxyAgent = HttpsProxyAgent3;
    function resume(socket) {
      socket.resume();
    }
    function omit(obj, ...keys) {
      const ret = {};
      let key;
      for (key in obj) {
        if (!keys.includes(key)) {
          ret[key] = obj[key];
        }
      }
      return ret;
    }
  }
});

// node_modules/balanced-match/index.js
var require_balanced_match = __commonJS({
  "node_modules/balanced-match/index.js"(exports2, module2) {
    "use strict";
    module2.exports = balanced;
    function balanced(a, b, str) {
      if (a instanceof RegExp) a = maybeMatch(a, str);
      if (b instanceof RegExp) b = maybeMatch(b, str);
      var r = range(a, b, str);
      return r && {
        start: r[0],
        end: r[1],
        pre: str.slice(0, r[0]),
        body: str.slice(r[0] + a.length, r[1]),
        post: str.slice(r[1] + b.length)
      };
    }
    function maybeMatch(reg, str) {
      var m = str.match(reg);
      return m ? m[0] : null;
    }
    balanced.range = range;
    function range(a, b, str) {
      var begs, beg, left, right, result;
      var ai = str.indexOf(a);
      var bi = str.indexOf(b, ai + 1);
      var i = ai;
      if (ai >= 0 && bi > 0) {
        if (a === b) {
          return [ai, bi];
        }
        begs = [];
        left = str.length;
        while (i >= 0 && !result) {
          if (i == ai) {
            begs.push(i);
            ai = str.indexOf(a, i + 1);
          } else if (begs.length == 1) {
            result = [begs.pop(), bi];
          } else {
            beg = begs.pop();
            if (beg < left) {
              left = beg;
              right = bi;
            }
            bi = str.indexOf(b, i + 1);
          }
          i = ai < bi && ai >= 0 ? ai : bi;
        }
        if (begs.length) {
          result = [left, right];
        }
      }
      return result;
    }
  }
});

// node_modules/brace-expansion/index.js
var require_brace_expansion = __commonJS({
  "node_modules/brace-expansion/index.js"(exports2, module2) {
    var balanced = require_balanced_match();
    module2.exports = expandTop;
    var escSlash = "\0SLASH" + Math.random() + "\0";
    var escOpen = "\0OPEN" + Math.random() + "\0";
    var escClose = "\0CLOSE" + Math.random() + "\0";
    var escComma = "\0COMMA" + Math.random() + "\0";
    var escPeriod = "\0PERIOD" + Math.random() + "\0";
    var EXPANSION_MAX = 1e5;
    var EXPANSION_MAX_LENGTH = 4e6;
    var EXPANSION_MAX_DEPTH = 1e3;
    var EXPANSION_MAX_REWRITES = 1e3;
    function numeric(str) {
      return parseInt(str, 10) == str ? parseInt(str, 10) : str.charCodeAt(0);
    }
    function escapeBraces(str) {
      return str.split("\\\\").join(escSlash).split("\\{").join(escOpen).split("\\}").join(escClose).split("\\,").join(escComma).split("\\.").join(escPeriod);
    }
    function unescapeBraces(str) {
      return str.split(escSlash).join("\\").split(escOpen).join("{").split(escClose).join("}").split(escComma).join(",").split(escPeriod).join(".");
    }
    function pushAll(target, items) {
      for (var i = 0; i < items.length; i++) {
        target.push(items[i]);
      }
    }
    function parseCommaParts(str) {
      var parts = [];
      var carry = "";
      for (; ; ) {
        var m = balanced("{", "}", str);
        if (!m) {
          var tail = str.split(",");
          tail[0] = carry + tail[0];
          pushAll(parts, tail);
          return parts;
        }
        var pre = m.pre;
        var body = m.body;
        var post = m.post;
        var p = pre.split(",");
        p[0] = carry + p[0];
        p[p.length - 1] += "{" + body + "}";
        if (!post.length) {
          pushAll(parts, p);
          return parts;
        }
        carry = p.pop();
        pushAll(parts, p);
        str = post;
      }
    }
    function expandTop(str, options) {
      if (!str)
        return [];
      options = options || {};
      var max = options.max == null ? EXPANSION_MAX : options.max;
      var maxLength = options.maxLength == null ? EXPANSION_MAX_LENGTH : options.maxLength;
      var maxDepth = options.maxDepth == null ? EXPANSION_MAX_DEPTH : options.maxDepth;
      var maxRewrites = options.maxRewrites == null ? EXPANSION_MAX_REWRITES : options.maxRewrites;
      if (str.substr(0, 2) === "{}") {
        str = "\\{\\}" + str.substr(2);
      }
      return expand2(escapeBraces(str), max, maxLength, maxDepth, 0, maxRewrites, true).map(unescapeBraces);
    }
    function embrace(str) {
      return "{" + str + "}";
    }
    function isPadded(el) {
      return /^-?0\d/.test(el);
    }
    function lte(i, y) {
      return i <= y;
    }
    function gte(i, y) {
      return i >= y;
    }
    function combine(acc, pre, values, max, maxLength, dropEmpties) {
      var out = [];
      var length = 0;
      for (var a = 0; a < acc.length; a++) {
        for (var v = 0; v < values.length; v++) {
          if (out.length >= max) return out;
          var expansion = acc[a] + pre + values[v];
          if (dropEmpties && !expansion) continue;
          if (length + expansion.length > maxLength) return out;
          out.push(expansion);
          length += expansion.length;
        }
      }
      return out;
    }
    function expandSequence(body, isAlphaSequence, max, maxLength) {
      var n = body.split(/\.\./);
      var N = [];
      if (n[0] === void 0 || n[1] === void 0) {
        return N;
      }
      var x = numeric(n[0]);
      var y = numeric(n[1]);
      var width = Math.max(n[0].length, n[1].length);
      var incr = n.length === 3 && n[2] !== void 0 ? Math.max(Math.abs(numeric(n[2])), 1) : 1;
      var test = lte;
      var reverse = y < x;
      if (reverse) {
        incr *= -1;
        test = gte;
      }
      var pad = n.some(isPadded);
      var length = 0;
      for (var i = x; test(i, y) && N.length < max; i += incr) {
        var c;
        if (isAlphaSequence) {
          c = String.fromCharCode(i);
          if (c === "\\") {
            c = "";
          }
        } else {
          c = String(i);
          if (pad) {
            var need = width - c.length;
            if (need > 0) {
              var z = new Array(need + 1).join("0");
              if (i < 0) {
                c = "-" + z + c.slice(1);
              } else {
                c = z + c;
              }
            }
          }
        }
        if (length + c.length > maxLength) break;
        N.push(c);
        length += c.length;
      }
      return N;
    }
    function expand2(str, max, maxLength, maxDepth, depth, maxRewrites, isTop) {
      if (depth > maxDepth) {
        return [str];
      }
      var acc = [""];
      var rewrites = 0;
      var dropEmpties = false;
      var firstGroup = true;
      for (; ; ) {
        const m = balanced("{", "}", str);
        if (!m) {
          return combine(acc, str, [""], max, maxLength, dropEmpties);
        }
        const pre = m.pre;
        if (/\$$/.test(pre)) {
          acc = combine(
            acc,
            pre + "{" + m.body + "}",
            [""],
            max,
            maxLength,
            dropEmpties && !m.post.length
          );
          firstGroup = false;
          if (!m.post.length) break;
          str = m.post;
          continue;
        }
        var isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
        var isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
        var isSequence = isNumericSequence || isAlphaSequence;
        var isOptions = m.body.indexOf(",") >= 0;
        if (!isSequence && !isOptions) {
          if (rewrites < maxRewrites && m.post.match(/,(?!,).*\}/)) {
            rewrites++;
            str = m.pre + "{" + m.body + escClose + m.post;
            isTop = true;
            continue;
          }
          return combine(
            acc,
            pre + "{" + m.body + "}" + m.post,
            [""],
            max,
            maxLength,
            dropEmpties
          );
        }
        if (firstGroup) {
          dropEmpties = isTop && !isSequence;
          firstGroup = false;
        }
        var values;
        if (isSequence) {
          values = expandSequence(m.body, isAlphaSequence, max, maxLength);
        } else {
          var n = parseCommaParts(m.body);
          if (n.length === 1 && n[0] !== void 0) {
            n = expand2(n[0], max, maxLength, maxDepth, depth + 1, maxRewrites, false).map(embrace);
            if (n.length === 1) {
              acc = combine(
                acc,
                pre + n[0],
                [""],
                max,
                maxLength,
                dropEmpties && !m.post.length
              );
              if (!m.post.length) break;
              str = m.post;
              continue;
            }
          }
          var dropsEmpties = dropEmpties && !m.post.length && !pre;
          for (var d = 0; dropsEmpties && d < acc.length; d++) {
            if (acc[d]) {
              dropsEmpties = false;
            }
          }
          values = [];
          var valuesLength = 0;
          outer: for (var j = 0; j < n.length; j++) {
            var expanded = expand2(n[j], max, maxLength, maxDepth, depth + 1, maxRewrites, false);
            for (var k = 0; k < expanded.length; k++) {
              var v = expanded[k];
              if (dropsEmpties && !v) continue;
              if (values.length >= max || valuesLength + v.length > maxLength) {
                break outer;
              }
              values.push(v);
              valuesLength += v.length;
            }
          }
        }
        acc = combine(acc, pre, values, max, maxLength, dropEmpties && !m.post.length);
        if (!m.post.length) break;
        str = m.post;
      }
      return acc;
    }
  }
});

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode10 = __toESM(require("vscode"));

// src/core/errors.ts
var KaggleError = class extends Error {
  kind;
  status;
  detail;
  hint;
  retryable;
  constructor(kind, message, options = {}) {
    super(message);
    this.name = "KaggleError";
    this.kind = kind;
    this.status = options.status;
    this.detail = options.detail;
    this.hint = options.hint;
    this.retryable = options.retryable ?? false;
    if (options.cause !== void 0) {
      this.cause = options.cause;
    }
  }
};
var URL_HINT = "\u8BF7\u91CD\u65B0\u590D\u5236 Kaggle Notebook \u2192 Run \u2192 Kaggle Jupyter Server \u4E2D\u7684 \u201CVS Code Compatible URL\u201D\uFF0C\u5E76\u5728\u4FA7\u680F\u66F4\u65B0\u3002";
function classifyHttpError(info) {
  const { status } = info;
  const parsed = parseJupyterBody(info.body);
  const detail = truncate([parsed.message, parsed.reason].filter(Boolean).join(" \u2014 ") || info.body, 300);
  if (status >= 300 && status < 400) {
    return new KaggleError("redirect", `\u8BF7\u6C42\u88AB\u91CD\u5B9A\u5411\uFF08HTTP ${status}\uFF09`, {
      status,
      detail: truncate(info.location || detail, 300),
      hint: `\u8FD9\u901A\u5E38\u610F\u5473\u7740 Kaggle \u4F1A\u8BDD\u5DF2\u7ED3\u675F\u5E76\u88AB\u8DF3\u8F6C\u5230\u767B\u5F55\u9875\u3002${URL_HINT}`
    });
  }
  switch (status) {
    case 401:
      return new KaggleError("auth", "\u8BA4\u8BC1\u5931\u8D25\uFF08HTTP 401\uFF09", {
        status,
        detail,
        hint: URL_HINT
      });
    case 403: {
      if (/permission denied|read[- ]only|\/kaggle\/input/i.test(info.body)) {
        return new KaggleError("forbidden", "\u8FDC\u7A0B\u76EE\u5F55\u4E0D\u53EF\u5199\uFF08HTTP 403\uFF09", {
          status,
          detail,
          hint: "Kaggle \u4E0A\u53EA\u6709 /kaggle/working \u53EF\u5199\uFF1B\u8BF7\u628A REMOTE_DIR \u8BBE\u7F6E\u5230\u53EF\u5199\u76EE\u5F55\u3002"
        });
      }
      return new KaggleError("auth", "\u8BBF\u95EE\u88AB\u62D2\u7EDD\uFF08HTTP 403\uFF09", {
        status,
        detail,
        hint: `\u4F1A\u8BDD\u53EF\u80FD\u5DF2\u8FC7\u671F\uFF0C\u6216\u8BE5\u76EE\u5F55\u4E0D\u53EF\u5199\u3002${URL_HINT}`
      });
    }
    case 404: {
      const looksJson = isJsonHttpResponse(info.contentType, info.body);
      const isPlainNotFound = !looksJson && isPlainTextNotFoundBody(info.contentType, info.body);
      if (isFixedSessionEndpoint(info.url) || !looksJson && !isPlainNotFound) {
        return new KaggleError("auth", "Kaggle \u4F1A\u8BDD\u53EF\u80FD\u5DF2\u5931\u6548\uFF08\u4EE3\u7406\u8FD4\u56DE 404\uFF09", {
          status,
          detail,
          hint: `\u5931\u6548\u94FE\u63A5\u5E38\u88AB\u4EE3\u7406\u4EE5\u7EAF\u6587\u672C 404 \u62D2\u7EDD\u3002${URL_HINT}`
        });
      }
      return new KaggleError("notFound", "\u8FDC\u7A0B\u8DEF\u5F84\u4E0D\u5B58\u5728\uFF08HTTP 404\uFF09", {
        status,
        detail,
        hint: "\u68C0\u67E5 REMOTE_DIR \u548C Jupyter URL\uFF1B\u82E5 URL \u7F3A\u5C11 /proxy \u6216\u4F1A\u8BDD\u5DF2\u7ED3\u675F\u4E5F\u4F1A\u8FD4\u56DE 404\u3002"
      });
    }
    case 400:
      if (/not empty/i.test(info.body)) {
        return new KaggleError("badRequest", "\u5DE5\u4F5C\u76EE\u5F55\u975E\u7A7A\uFF08HTTP 400\uFF09", {
          status,
          detail,
          hint: "\u670D\u52A1\u5668\u7981\u6B62\u76F4\u63A5\u5220\u9664\u975E\u7A7A\u76EE\u5F55\uFF1B\u8BF7\u5148\u5220\u9664\u76EE\u5F55\u5185\u7684\u6587\u4EF6\uFF0C\u6216\u786E\u8BA4\u670D\u52A1\u5668\u5141\u8BB8\u9012\u5F52\u5220\u9664\u3002"
        });
      }
      return new KaggleError("badRequest", "\u8BF7\u6C42\u88AB Jupyter \u62D2\u7EDD\uFF08HTTP 400\uFF09", {
        status,
        detail,
        hint: "\u5E38\u89C1\u539F\u56E0\u662F\u8DEF\u5F84\u683C\u5F0F\u3001\u6587\u4EF6\u683C\u5F0F\u6216\u76EE\u6807\u76EE\u5F55\u51B2\u7A81\uFF1B\u65E5\u5FD7\u91CC\u6709\u670D\u52A1\u5668\u8FD4\u56DE\u7684 reason\u3002"
      });
    case 409:
      return new KaggleError("badRequest", "\u76EE\u6807\u8DEF\u5F84\u5DF2\u5B58\u5728\uFF08HTTP 409\uFF09", {
        status,
        detail,
        hint: "\u6362\u4E00\u4E2A\u76EE\u6807\u540D\u79F0\uFF0C\u6216\u5148\u5220\u9664/\u91CD\u547D\u540D\u76EE\u6807\u8DEF\u5F84\u3002"
      });
    case 413:
      return new KaggleError("tooLarge", "\u6587\u4EF6\u8FC7\u5927\uFF0C\u670D\u52A1\u5668\u62D2\u7EDD\u63A5\u6536\uFF08HTTP 413\uFF09", {
        status,
        detail,
        hint: "\u8C03\u4F4E kaggleConnector.maxFileSizeMB\uFF0C\u6216\u628A\u5927\u6587\u4EF6\u62C6\u5206\u6210\u591A\u4E2A\u6587\u4EF6/\u6539\u7528 Kaggle Dataset\u3002"
      });
    case 500:
      return new KaggleError("server", "Jupyter \u670D\u52A1\u5668\u4FDD\u5B58\u6587\u4EF6\u5931\u8D25\uFF08HTTP 500\uFF09", {
        status,
        detail,
        hint: /No such file or directory|Not a directory|Permission denied/i.test(info.body) ? "\u8FDC\u7A0B\u7236\u76EE\u5F55\u4E0D\u5B58\u5728\u6216\u8DEF\u5F84\u51B2\u7A81\u3002\u63D2\u4EF6\u4F1A\u5C1D\u8BD5\u81EA\u52A8\u521B\u5EFA\u76EE\u5F55\uFF1B\u82E5\u4ECD\u5931\u8D25\u8BF7\u68C0\u67E5 REMOTE_DIR\u3002" : "\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF\uFF1B\u53EF\u7A0D\u540E\u91CD\u8BD5\uFF0C\u5E76\u67E5\u770B\u65E5\u5FD7\u4E2D\u7684\u670D\u52A1\u5668\u8FD4\u56DE\u5185\u5BB9\u3002",
        retryable: true
      });
    case 502:
    case 503:
    case 504:
      return new KaggleError("gateway", `Kaggle \u4EE3\u7406\u6682\u4E0D\u53EF\u7528\uFF08HTTP ${status}\uFF09`, {
        status,
        detail,
        hint: "Kaggle \u4F1A\u8BDD\u53EF\u80FD\u5C1A\u672A\u542F\u52A8\u3001\u5DF2\u505C\u6B62\u6216\u6B63\u5728\u91CD\u542F\uFF1B\u8BF7\u786E\u8BA4 Notebook \u4F1A\u8BDD\u4ECD\u5728\u8FD0\u884C\u3002",
        retryable: true
      });
    default:
      return new KaggleError("unknown", `\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${status}\uFF09`, {
        status,
        detail,
        retryable: status >= 500
      });
  }
}
function nonJsonError(_url, body, status = 200) {
  return new KaggleError("nonJson", `\u670D\u52A1\u5668\u8FD4\u56DE\u7684\u4E0D\u662F Jupyter JSON\uFF08HTTP ${status}\uFF09`, {
    status,
    detail: truncate(body, 200),
    hint: `\u8FD9\u901A\u5E38\u610F\u5473\u7740 URL \u5DF2\u8FC7\u671F\u5E76\u88AB\u91CD\u5B9A\u5411\u5230\u767B\u5F55\u9875\u3002${URL_HINT}`
  });
}
function classifyNetworkError(error) {
  if (error instanceof KaggleError) {
    return error;
  }
  const candidate = error;
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const message = typeof candidate?.message === "string" ? candidate.message : String(error);
  if (candidate?.name === "AbortError" || /cancelled|canceled|aborted/i.test(message)) {
    return new KaggleError("cancelled", "\u64CD\u4F5C\u5DF2\u53D6\u6D88", { cause: error });
  }
  switch (code) {
    case "ETIMEDOUT":
    case "UND_ERR_CONNECT_TIMEOUT":
    case "UND_ERR_HEADERS_TIMEOUT":
    case "UND_ERR_BODY_TIMEOUT":
      return new KaggleError("timeout", "\u8BF7\u6C42\u8D85\u65F6", {
        detail: message,
        hint: "\u68C0\u67E5\u7F51\u7EDC\u3001\u4EE3\u7406\u6216 Kaggle Jupyter Server\u662F\u5426\u5DF2\u8FC7\u671F",
        retryable: true,
        cause: error
      });
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return new KaggleError("dns", "\u65E0\u6CD5\u89E3\u6790 Kaggle \u57DF\u540D\uFF08DNS \u5931\u8D25\uFF09", {
        detail: message,
        hint: "\u68C0\u67E5\u7F51\u7EDC\u6216\u4EE3\u7406\u8BBE\u7F6E\uFF1B\u5728\u90E8\u5206\u7F51\u7EDC\u73AF\u5883\u4E0B\u9700\u8981\u914D\u7F6E kaggleConnector.proxy\u3002",
        retryable: true,
        cause: error
      });
    case "ECONNREFUSED":
    case "ECONNRESET":
    case "EHOSTUNREACH":
    case "ENETUNREACH":
    case "ERR_PROXY_CONNECTION_FAILED":
      return new KaggleError("network", "\u65E0\u6CD5\u8FDE\u63A5 Kaggle \u670D\u52A1\u5668", {
        detail: `${code}${message ? `: ${message}` : ""}`,
        hint: "\u68C0\u67E5\u7F51\u7EDC/\u4EE3\u7406\uFF1B\u5982\u679C\u4F7F\u7528\u672C\u5730\u4EE3\u7406\uFF0C\u8BF7\u5728\u4FA7\u680F\u8BBE\u7F6E kaggleConnector.proxy\u3002",
        retryable: true,
        cause: error
      });
    case "EPROTO":
    case "CERT_HAS_EXPIRED":
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "SELF_SIGNED_CERT_IN_CHAIN":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "ERR_TLS_CERT_ALTNAME_INVALID":
      return new KaggleError("tls", "TLS/\u8BC1\u4E66\u6821\u9A8C\u5931\u8D25", {
        detail: `${code}${message ? `: ${message}` : ""}`,
        hint: "\u4EE3\u7406\u6216\u7F51\u7EDC\u53EF\u80FD\u62E6\u622A\u4E86 HTTPS\uFF1B\u8BF7\u68C0\u67E5\u4EE3\u7406\u8BC1\u4E66\u8BBE\u7F6E\u3002",
        cause: error
      });
    default:
      if (/timeout/i.test(message)) {
        return new KaggleError("timeout", "\u8BF7\u6C42\u8D85\u65F6", {
          detail: message,
          hint: "\u68C0\u67E5\u7F51\u7EDC\u3001\u4EE3\u7406\u6216 Kaggle Jupyter Server\u662F\u5426\u5DF2\u8FC7\u671F",
          retryable: true,
          cause: error
        });
      }
      if (!code) {
        return new KaggleError("unknown", message || "\u64CD\u4F5C\u5931\u8D25", { cause: error });
      }
      return new KaggleError("network", "\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25", {
        detail: `${code}: ${message}`,
        hint: "\u68C0\u67E5\u7F51\u7EDC/\u4EE3\u7406\u8BBE\u7F6E\uFF08kaggleConnector.proxy \u6216 HTTPS_PROXY\uFF09\u3002",
        cause: error
      });
  }
}
function isSessionError(error) {
  return error instanceof KaggleError && (error.kind === "auth" || error.kind === "redirect" || error.kind === "nonJson");
}
function isConnectionError(error) {
  return error instanceof KaggleError && (isSessionError(error) || error.kind === "timeout" || error.kind === "network" || error.kind === "dns" || error.kind === "tls" || error.kind === "gateway");
}
function describeError(error) {
  const typed = error instanceof KaggleError ? error : classifyNetworkError(error);
  const parts = [typed.message];
  if (typed.detail && !typed.message.includes(typed.detail)) {
    parts.push(typed.detail);
  }
  if (typed.hint) {
    parts.push(typed.hint);
  }
  return parts.join(" | ");
}
function shortError(error) {
  const typed = error instanceof KaggleError ? error : classifyNetworkError(error);
  return typed.hint ? `${typed.message}\uFF08${typed.hint}\uFF09` : typed.message;
}
function isJsonHttpResponse(contentType, body) {
  return /json/i.test(contentType ?? "") || /^\s*[{[]/.test(body);
}
function isPlainTextNotFoundBody(contentType, body) {
  return !/html/i.test(contentType ?? "") && body.trim().toLowerCase() === "not found";
}
function isFixedSessionEndpoint(rawUrl) {
  let pathname;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    pathname = rawUrl.split(/[?#]/, 1)[0] ?? "";
  }
  const normalized = pathname.replace(/\/+$/, "");
  const match2 = /\/api\/(contents|status)(?:\/(.*))?$/i.exec(normalized);
  return Boolean(match2 && !match2[2]);
}
function parseJupyterBody(body) {
  try {
    const parsed = JSON.parse(body);
    return {
      message: typeof parsed.message === "string" ? parsed.message : void 0,
      reason: typeof parsed.reason === "string" ? parsed.reason : void 0
    };
  } catch {
    return {};
  }
}
function truncate(value, max) {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}\u2026` : trimmed;
}

// src/core/url.ts
var import_node_crypto = require("node:crypto");
var HTTP_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:"]);
function normalizeServerUrl(input) {
  let value = (input ?? "").trim();
  if (!value) {
    throw new Error("Jupyter URL \u4E0D\u80FD\u4E3A\u7A7A");
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Jupyter URL \u683C\u5F0F\u65E0\u6548");
  }
  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    throw new Error("Jupyter URL \u53EA\u652F\u6301 http/https");
  }
  const pathname = parsed.pathname.replace(/\/+$/, "").replace(/\/(?:lab|tree)$/i, "");
  return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}`;
}
function normalizeRemotePath(input) {
  const value = (input ?? "").trim().replace(/\\/g, "/");
  if (!value) {
    return "";
  }
  const parts = value.split("/").filter((part) => part !== "" && part !== ".");
  for (const part of parts) {
    if (part === "..") {
      throw new Error('\u8FDC\u7A0B\u8DEF\u5F84\u4E0D\u80FD\u5305\u542B ".."');
    }
  }
  return parts.join("/");
}
function joinRemotePath(...parts) {
  return normalizeRemotePath(parts.filter((part) => Boolean(part)).join("/"));
}
function dirnameRemotePath(path6) {
  const normalized = normalizeRemotePath(path6);
  const index = normalized.lastIndexOf("/");
  return index < 0 ? "" : normalized.slice(0, index);
}
function contentsUrl(serverUrl, remotePath) {
  const parsed = new URL(normalizeServerUrl(serverUrl));
  const path6 = normalizeRemotePath(remotePath);
  const encoded = path6.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment)).join("/");
  const basePath = parsed.pathname.replace(/\/+$/, "");
  const apiPath = `${basePath}/api/contents${encoded ? `/${encoded}` : ""}`;
  return `${parsed.protocol}//${parsed.host}${apiPath}${parsed.search}`;
}
function filesUrl(serverUrl, remotePath) {
  const parsed = new URL(normalizeServerUrl(serverUrl));
  const path6 = normalizeRemotePath(remotePath);
  const encoded = path6.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment)).join("/");
  const basePath = parsed.pathname.replace(/\/+$/, "");
  const apiPath = `${basePath}/files${encoded ? `/${encoded}` : ""}`;
  return `${parsed.protocol}//${parsed.host}${apiPath}${parsed.search}`;
}
function apiEndpointUrl(serverUrl, suffix) {
  const parsed = new URL(normalizeServerUrl(serverUrl));
  const basePath = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.protocol}//${parsed.host}${basePath}${suffix}${parsed.search}`;
}
function statusUrl(serverUrl) {
  return apiEndpointUrl(serverUrl, "/api/status");
}
function kernelsUrl(serverUrl) {
  return apiEndpointUrl(serverUrl, "/api/kernels");
}
function kernelspecsUrl(serverUrl) {
  return apiEndpointUrl(serverUrl, "/api/kernelspecs");
}
function kernelUrl(serverUrl, kernelId) {
  return apiEndpointUrl(serverUrl, `/api/kernels/${encodeURIComponent(kernelId)}`);
}
function kernelChannelsUrl(serverUrl, kernelId) {
  return apiEndpointUrl(serverUrl, `/api/kernels/${encodeURIComponent(kernelId)}/channels`);
}
function jupyterConnectionParts(serverUrl) {
  const parsed = new URL(normalizeServerUrl(serverUrl));
  const token = parsed.searchParams.get("token");
  return {
    baseUrl: `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`,
    token: token ? token : void 0
  };
}
function jupyterServerId(parts) {
  const hash = (0, import_node_crypto.createHash)("sha256").update(`${parts.baseUrl}\0${parts.token ?? ""}`).digest("hex");
  return `kaggle-${hash.slice(0, 12)}`;
}
function displayServerUrl(serverUrl) {
  try {
    const parsed = new URL(normalizeServerUrl(serverUrl));
    const segments = parsed.pathname.split("/").filter(Boolean).map((segment) => segment.length > 40 ? `${segment.slice(0, 6)}\u2026${segment.slice(-4)}` : segment);
    const path6 = segments.length ? `/${segments.join("/")}` : "";
    const query = parsed.search ? "?token=***" : "";
    return `${parsed.protocol}//${parsed.host}${path6}${query}`;
  } catch {
    return "<invalid-url>";
  }
}

// src/core/remoteCwd.ts
var KERNEL_CWD_MARKER = "__KC_CWD__:";
var STARTUP_SCRIPT_NAME = "00-kaggle-connector-cwd.py";
function splitRemoteDirParts(remoteDir) {
  const normalized = normalizeRemotePath(remoteDir);
  if (!normalized) {
    return [];
  }
  const parts = normalized.split("/").filter(Boolean);
  for (const part of parts) {
    if (part === "." || part === ".." || part.includes("/") || part.includes("\\")) {
      throw new KaggleError("badRequest", `\u65E0\u6548\u7684\u5DE5\u4F5C\u76EE\u5F55\u8DEF\u5F84\uFF1A${remoteDir}`);
    }
  }
  return parts;
}
function jupyterRootResolveLines(indent) {
  return [
    `${indent}root = None`,
    `${indent}try:`,
    `${indent}    with open(f"/proc/{os.getppid()}/cmdline", "rb") as f:`,
    `${indent}        args = [a.decode("utf-8", "ignore") for a in f.read().split(b"\\x00") if a]`,
    `${indent}    for i, arg in enumerate(args):`,
    `${indent}        m = re.match(r"^--(?:NotebookApp\\.notebook_dir|ServerApp\\.root_dir|notebook-dir)=(.+)$", arg)`,
    `${indent}        if m:`,
    `${indent}            root = m.group(1)`,
    `${indent}            break`,
    `${indent}        if arg in ("--NotebookApp.notebook_dir", "--ServerApp.root_dir", "--notebook-dir") and i + 1 < len(args):`,
    `${indent}            root = args[i + 1]`,
    `${indent}            break`,
    `${indent}except Exception:`,
    `${indent}    pass`,
    `${indent}if not root:`,
    `${indent}    root = os.environ.get("KC_JUPYTER_ROOT")`,
    `${indent}root = os.path.realpath(root or os.getcwd())`,
    `${indent}os.environ["KC_JUPYTER_ROOT"] = root`
  ];
}
function applyWorkingDirLines(indent) {
  return [
    `${indent}if os.path.commonpath([root, os.path.realpath(proj)]) == root:`,
    `${indent}    try:`,
    `${indent}        os.makedirs(proj, exist_ok=True)`,
    `${indent}    except Exception:`,
    `${indent}        pass`,
    `${indent}    if os.path.isdir(proj) and os.path.commonpath([root, os.path.realpath(proj)]) == root:`,
    `${indent}        if proj not in sys.path:`,
    `${indent}            sys.path.insert(0, proj)`,
    `${indent}        pp = os.environ.get("PYTHONPATH", "")`,
    `${indent}        pp_parts = [p for p in pp.split(os.pathsep) if p] if pp else []`,
    `${indent}        if proj not in pp_parts:`,
    `${indent}            os.environ["PYTHONPATH"] = os.pathsep.join([proj] + pp_parts)`,
    `${indent}        os.chdir(proj)`
  ];
}
function buildStartupScriptCode(parts) {
  const partsJson = JSON.stringify(parts);
  return [
    "# Generated by Kaggle Connector - auto-enter REMOTE_DIR on kernel startup",
    "def _kc_init_cwd():",
    "    import os, re, sys",
    `    parts = ${partsJson}`,
    '    if not parts or any(p in ("", ".", "..") or "/" in p or "\\\\" in p for p in parts):',
    "        return",
    ...jupyterRootResolveLines("    "),
    "    proj = os.path.abspath(os.path.join(root, *parts))",
    ...applyWorkingDirLines("    "),
    "",
    "try:",
    "    _kc_init_cwd()",
    "finally:",
    '    globals().pop("_kc_init_cwd", None)',
    ""
  ].join("\n");
}
function buildKernelConfigureCwdCode(parts, enabled) {
  if (enabled && parts.length === 0) {
    throw new KaggleError("badRequest", "\u5DE5\u4F5C\u76EE\u5F55\u4E0D\u80FD\u4E3A\u7A7A");
  }
  const partsJson = JSON.stringify(parts);
  const startupBase64 = enabled ? Buffer.from(buildStartupScriptCode(parts), "utf8").toString("base64") : "";
  const enabledPy = enabled ? "True" : "False";
  return [
    "def _kc_set_cwd():",
    "    import base64, json, os, re, sys",
    `    enabled = ${enabledPy}`,
    `    parts = ${partsJson}`,
    `    startup_b64 = ${JSON.stringify(startupBase64)}`,
    "    try:",
    "        from IPython.paths import get_ipython_dir",
    "        ipython_dir = get_ipython_dir()",
    "    except Exception:",
    '        ipython_dir = os.path.expanduser("~/.ipython")',
    '    startup_dir = os.path.join(ipython_dir, "profile_default", "startup")',
    `    startup_path = os.path.join(startup_dir, ${JSON.stringify(STARTUP_SCRIPT_NAME)})`,
    "    if not enabled:",
    "        try:",
    "            if os.path.lexists(startup_path):",
    "                os.unlink(startup_path)",
    "            print(" + JSON.stringify(KERNEL_CWD_MARKER) + ' + json.dumps({"ok": True, "startupConfigured": False, "dirExists": False, "cwdChanged": False, "startupPath": startup_path}))',
    "        except Exception as exc:",
    "            print(" + JSON.stringify(KERNEL_CWD_MARKER) + ' + json.dumps({"ok": False, "error": str(exc)}))',
    "        return",
    '    if not parts or any(p in ("", ".", "..") or "/" in p or "\\\\" in p for p in parts):',
    "        print(" + JSON.stringify(KERNEL_CWD_MARKER) + ' + json.dumps({"ok": False, "error": "invalid remoteDir"}))',
    "        return",
    ...jupyterRootResolveLines("    "),
    "    proj = os.path.abspath(os.path.join(root, *parts))",
    "    try:",
    "        os.makedirs(startup_dir, exist_ok=True)",
    '        script_text = base64.b64decode(startup_b64).decode("utf-8")',
    '        with open(startup_path, "w", encoding="utf-8") as f:',
    "            f.write(script_text)",
    "    except Exception as exc:",
    "        print(" + JSON.stringify(KERNEL_CWD_MARKER) + ' + json.dumps({"ok": False, "error": str(exc)}))',
    "        return",
    "    dir_exists = False",
    "    cwd_changed = False",
    "    if os.path.commonpath([root, os.path.realpath(proj)]) == root:",
    "        try:",
    "            os.makedirs(proj, exist_ok=True)",
    "        except Exception:",
    "            pass",
    "        dir_exists = os.path.isdir(proj) and os.path.commonpath([root, os.path.realpath(proj)]) == root",
    "        if dir_exists:",
    "            if proj not in sys.path:",
    "                sys.path.insert(0, proj)",
    '            pp = os.environ.get("PYTHONPATH", "")',
    "            pp_parts = [p for p in pp.split(os.pathsep) if p] if pp else []",
    "            if proj not in pp_parts:",
    '                os.environ["PYTHONPATH"] = os.pathsep.join([proj] + pp_parts)',
    "            os.chdir(proj)",
    "            cwd_changed = True",
    "    print(" + JSON.stringify(KERNEL_CWD_MARKER) + ' + json.dumps({"ok": True, "startupConfigured": True, "dirExists": dir_exists, "cwdChanged": cwd_changed, "projPath": proj, "startupPath": startup_path}))',
    "try:",
    "    _kc_set_cwd()",
    "finally:",
    '    globals().pop("_kc_set_cwd", None)'
  ].join("\n");
}
function parseKernelConfigureCwdResult(result) {
  const lines = result.stdout.split(/\r?\n/).reverse();
  const markerLine = lines.find((line) => line.startsWith(KERNEL_CWD_MARKER));
  if (markerLine) {
    let payload;
    try {
      payload = JSON.parse(markerLine.slice(KERNEL_CWD_MARKER.length));
    } catch {
      throw new KaggleError("unknown", "\u5185\u6838\u5DE5\u4F5C\u76EE\u5F55\u914D\u7F6E\u8FD4\u56DE\u5185\u5BB9\u65E0\u6548", {
        detail: markerLine.slice(0, 200)
      });
    }
    if (payload.ok === true) {
      return {
        startupConfigured: Boolean(payload.startupConfigured),
        dirExists: Boolean(payload.dirExists),
        cwdChanged: Boolean(payload.cwdChanged),
        projPath: typeof payload.projPath === "string" ? payload.projPath : void 0,
        startupPath: typeof payload.startupPath === "string" ? payload.startupPath : void 0
      };
    }
    const detail = typeof payload.error === "string" ? payload.error : "\u8FDC\u7AEF\u5185\u6838\u76EE\u5F55\u914D\u7F6E\u5931\u8D25";
    throw new KaggleError("badRequest", `\u8FDC\u7AEF\u5185\u6838\u76EE\u5F55\u914D\u7F6E\u5931\u8D25\uFF1A${detail}`, { detail });
  }
  if (result.errorName) {
    throw new KaggleError("badRequest", `\u5185\u6838\u6267\u884C\u5931\u8D25\uFF1A${result.errorName}`, {
      detail: result.errorValue
    });
  }
  throw new KaggleError("unknown", "\u5185\u6838\u672A\u8FD4\u56DE\u5DE5\u4F5C\u76EE\u5F55\u914D\u7F6E\u7ED3\u679C", {
    detail: (result.stderr || result.stdout).slice(0, 200)
  });
}

// src/http.ts
var http = __toESM(require("node:http"));
var https = __toESM(require("node:https"));
var import_https_proxy_agent = __toESM(require_dist2());
function httpRequest(url, options) {
  const target = new URL(url);
  const isHttps = target.protocol === "https:";
  const body = options.body === void 0 ? void 0 : Buffer.isBuffer(options.body) ? options.body : Buffer.from(options.body, "utf8");
  const headers = {
    Accept: "application/json",
    ...options.headers
  };
  if (body) {
    headers["Content-Length"] = body.length;
  }
  return new Promise((resolve2, reject) => {
    let settled = false;
    let request5;
    let abortListener;
    let deadlineTimer;
    let connectTimer;
    const cleanup = () => {
      if (abortListener && options.signal) {
        options.signal.removeEventListener("abort", abortListener);
      }
      if (deadlineTimer) {
        clearTimeout(deadlineTimer);
        deadlineTimer = void 0;
      }
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = void 0;
      }
    };
    const finish = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };
    const requestOptions = {
      method: options.method,
      headers
    };
    if (isHttps && options.proxy) {
      try {
        requestOptions.agent = new import_https_proxy_agent.HttpsProxyAgent(options.proxy);
      } catch (error) {
        finish(() => reject(error));
        return;
      }
    }
    const onResponse = (response) => {
      const chunks = [];
      let total = 0;
      const max = options.maxResponseBytes ?? 4 * 1024 * 1024;
      response.on("data", (chunk) => {
        total += chunk.length;
        if (total > max) {
          request5?.destroy(new KaggleError("unknown", "\u670D\u52A1\u5668\u54CD\u5E94\u8FC7\u5927"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        finish(
          () => resolve2({
            status: response.statusCode ?? 0,
            statusText: response.statusMessage ?? "",
            headers: response.headers,
            body: Buffer.concat(chunks),
            url: target.toString()
          })
        );
      });
      response.on("error", (error) => {
        finish(() => reject(error));
      });
    };
    try {
      request5 = isHttps ? https.request(target, requestOptions, onResponse) : http.request(target, requestOptions, onResponse);
    } catch (error) {
      finish(() => reject(error));
      return;
    }
    const timeoutMs = options.timeoutMs ?? 12e4;
    const destroyWithTimeout = (ms) => {
      const error = new Error(`\u8BF7\u6C42\u8D85\u65F6\uFF08${ms} ms\uFF09`);
      error.code = "ETIMEDOUT";
      request5?.destroy(error);
    };
    request5.setTimeout(timeoutMs, () => destroyWithTimeout(timeoutMs));
    if (!request5.socket) {
      connectTimer = setTimeout(() => destroyWithTimeout(timeoutMs), timeoutMs);
      request5.once("socket", () => {
        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = void 0;
        }
      });
    }
    if (options.deadlineMs !== void 0 && options.deadlineMs > 0) {
      const deadlineMs = options.deadlineMs;
      deadlineTimer = setTimeout(() => destroyWithTimeout(deadlineMs), deadlineMs);
    }
    request5.on("error", (error) => {
      finish(() => reject(error));
    });
    if (options.signal) {
      abortListener = () => {
        request5?.destroy(new KaggleError("cancelled", "\u64CD\u4F5C\u5DF2\u53D6\u6D88"));
      };
      if (options.signal.aborted) {
        abortListener();
      } else {
        options.signal.addEventListener("abort", abortListener, { once: true });
      }
    }
    request5.end(body);
  });
}

// src/ws.ts
var import_node_crypto2 = require("node:crypto");
var http2 = __toESM(require("node:http"));
var https2 = __toESM(require("node:https"));
var import_https_proxy_agent2 = __toESM(require_dist2());
var WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
var MAX_WS_PAYLOAD_BYTES = 16 * 1024 * 1024;
var MinimalWebSocket = class {
  constructor(socket, initialHead) {
    this.socket = socket;
    socket.on("data", (chunk) => {
      this.onData(chunk);
    });
    socket.on("error", (error) => {
      this.finishClose(classifyNetworkError(error));
    });
    socket.on("close", () => {
      this.finishClose();
    });
    if (initialHead.length > 0) {
      this.onData(initialHead);
    }
  }
  buffer = Buffer.alloc(0);
  fragmentChunks = [];
  fragmentOpcode = 0;
  closed = false;
  messageListeners = /* @__PURE__ */ new Set();
  closeListeners = /* @__PURE__ */ new Set();
  onMessage(listener) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }
  onClose(listener) {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }
  sendText(text) {
    if (this.closed) {
      throw new KaggleError("network", "WebSocket \u8FDE\u63A5\u5DF2\u5173\u95ED");
    }
    this.socket.write(encodeClientFrame(1, Buffer.from(text, "utf8")));
  }
  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    try {
      this.socket.write(encodeClientFrame(8, Buffer.alloc(0)));
    } catch {
    }
    this.socket.end();
    this.socket.destroy();
  }
  finishClose(reason) {
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
  onData(chunk) {
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
  handleFrame(frame) {
    if (frame.opcode === 8) {
      this.finishClose();
      this.socket.destroy();
      return;
    }
    if (frame.opcode === 9) {
      try {
        this.socket.write(encodeClientFrame(10, frame.payload));
      } catch {
      }
      return;
    }
    if (frame.opcode === 10) {
      return;
    }
    if (frame.opcode === 1 || frame.opcode === 2) {
      if (frame.fin) {
        this.emitPayload(frame.opcode, frame.payload);
      } else {
        this.fragmentOpcode = frame.opcode;
        this.fragmentChunks = [frame.payload];
      }
      return;
    }
    if (frame.opcode === 0 && this.fragmentChunks.length > 0) {
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
  emitPayload(opcode, payload) {
    if (opcode !== 1) {
      return;
    }
    const text = payload.toString("utf8");
    for (const listener of this.messageListeners) {
      listener(text);
    }
  }
};
function encodeClientFrame(opcode, payload) {
  const length = payload.length;
  let headerSize = 2 + 4;
  if (length >= 126 && length <= 65535) {
    headerSize = 4 + 4;
  } else if (length > 65535) {
    headerSize = 10 + 4;
  }
  const out = Buffer.allocUnsafe(headerSize + length);
  out[0] = 128 | opcode & 15;
  let offset = 2;
  if (length < 126) {
    out[1] = 128 | length;
  } else if (length <= 65535) {
    out[1] = 128 | 126;
    out.writeUInt16BE(length, 2);
    offset = 4;
  } else {
    out[1] = 128 | 127;
    out.writeBigUInt64BE(BigInt(length), 2);
    offset = 10;
  }
  const mask = (0, import_node_crypto2.randomBytes)(4);
  mask.copy(out, offset);
  offset += 4;
  for (let index = 0; index < length; index += 1) {
    out[offset + index] = payload[index] ^ mask[index & 3];
  }
  return out;
}
function tryDecodeServerFrame(buffer) {
  if (buffer.length < 2) {
    return void 0;
  }
  const first = buffer[0];
  const second = buffer[1];
  const fin = (first & 128) !== 0;
  const opcode = first & 15;
  const masked = (second & 128) !== 0;
  let payloadLength = second & 127;
  let offset = 2;
  if (payloadLength === 126) {
    if (buffer.length < 4) {
      return void 0;
    }
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) {
      return void 0;
    }
    const bigLength = buffer.readBigUInt64BE(2);
    if (bigLength > BigInt(MAX_WS_PAYLOAD_BYTES)) {
      throw new KaggleError("unknown", "WebSocket \u54CD\u5E94\u5E27\u8FC7\u5927");
    }
    payloadLength = Number(bigLength);
    offset = 10;
  }
  if (payloadLength > MAX_WS_PAYLOAD_BYTES) {
    throw new KaggleError("unknown", "WebSocket \u54CD\u5E94\u5E27\u8FC7\u5927");
  }
  const maskOffset = offset;
  if (masked) {
    offset += 4;
  }
  if (buffer.length < offset + payloadLength) {
    return void 0;
  }
  let payload = buffer.subarray(offset, offset + payloadLength);
  if (masked) {
    const unmasked = Buffer.allocUnsafe(payloadLength);
    for (let index = 0; index < payloadLength; index += 1) {
      unmasked[index] = payload[index] ^ buffer[maskOffset + (index & 3)];
    }
    payload = unmasked;
  }
  return {
    frame: { fin, opcode, payload },
    consumed: offset + payloadLength
  };
}
function openWebSocket(url, options) {
  if (options.signal?.aborted) {
    return Promise.reject(new KaggleError("cancelled", "\u64CD\u4F5C\u5DF2\u53D6\u6D88"));
  }
  const target = new URL(url);
  const isHttps = target.protocol === "https:" || target.protocol === "wss:";
  const httpTarget = new URL(target.toString());
  httpTarget.protocol = isHttps ? "https:" : "http:";
  const key = (0, import_node_crypto2.randomBytes)(16).toString("base64");
  const expectedAccept = (0, import_node_crypto2.createHash)("sha1").update(`${key}${WS_GUID}`).digest("base64");
  const headers = {
    Connection: "Upgrade",
    Upgrade: "websocket",
    "Sec-WebSocket-Version": "13",
    "Sec-WebSocket-Key": key,
    Origin: httpTarget.origin
  };
  if (options.token) {
    headers.Authorization = `token ${options.token}`;
  }
  const requestOptions = {
    method: "GET",
    headers
  };
  if (isHttps && options.proxy) {
    requestOptions.agent = new import_https_proxy_agent2.HttpsProxyAgent(options.proxy);
  }
  return new Promise((resolve2, reject) => {
    let settled = false;
    let request5;
    let timeoutTimer;
    let abortListener;
    const cleanup = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = void 0;
      }
      if (abortListener && options.signal) {
        options.signal.removeEventListener("abort", abortListener);
        abortListener = void 0;
      }
    };
    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      request5?.destroy();
      reject(error);
    };
    const timeoutMs = options.timeoutMs ?? 3e4;
    timeoutTimer = setTimeout(() => {
      const timeoutError = new Error(`WebSocket \u8FDE\u63A5\u8D85\u65F6\uFF08${timeoutMs} ms\uFF09`);
      timeoutError.code = "ETIMEDOUT";
      fail(classifyNetworkError(timeoutError));
    }, timeoutMs);
    if (options.signal) {
      abortListener = () => fail(new KaggleError("cancelled", "\u64CD\u4F5C\u5DF2\u53D6\u6D88"));
      options.signal.addEventListener("abort", abortListener, { once: true });
    }
    try {
      request5 = isHttps ? https2.request(httpTarget, requestOptions) : http2.request(httpTarget, requestOptions);
    } catch (error) {
      fail(classifyNetworkError(error));
      return;
    }
    request5.on("upgrade", (response, socket, head) => {
      const accept = String(response.headers["sec-websocket-accept"] ?? "");
      if (accept && accept !== expectedAccept) {
        socket.destroy();
        fail(new KaggleError("network", "WebSocket \u63E1\u624B\u6821\u9A8C\u5931\u8D25"));
        return;
      }
      if (settled) {
        socket.destroy();
        return;
      }
      settled = true;
      cleanup();
      resolve2(new MinimalWebSocket(socket, head));
    });
    request5.on("response", (response) => {
      const chunks = [];
      let total = 0;
      response.on("data", (chunk) => {
        total += chunk.length;
        if (total <= 64 * 1024) {
          chunks.push(chunk);
        }
      });
      response.on("end", () => {
        fail(
          classifyHttpError({
            status: response.statusCode ?? 0,
            statusText: response.statusMessage ?? "",
            body: Buffer.concat(chunks).toString("utf8"),
            url: httpTarget.toString(),
            location: typeof response.headers.location === "string" ? response.headers.location : void 0,
            contentType: String(response.headers["content-type"] ?? "")
          })
        );
      });
      response.on("error", (error) => fail(classifyNetworkError(error)));
    });
    request5.on("error", (error) => {
      fail(classifyNetworkError(error));
    });
    request5.end();
  });
}
function buildJupyterMessage(session, msgType, content) {
  const msgId = (0, import_node_crypto2.randomUUID)();
  return {
    msgId,
    payload: JSON.stringify({
      header: {
        msg_id: msgId,
        username: "kaggle-connector",
        session,
        msg_type: msgType,
        version: "5.3"
      },
      parent_header: {},
      metadata: {},
      content,
      buffers: [],
      channel: "shell"
    })
  };
}
async function executePythonInKernel(options) {
  const timeoutMs = options.timeoutMs ?? 3e4;
  const ws = await openWebSocket(options.channelsUrl, {
    token: options.token,
    proxy: options.proxy,
    timeoutMs,
    signal: options.signal
  });
  const session = (0, import_node_crypto2.randomUUID)();
  try {
    if (options.waitForReady) {
      await waitForKernelMessage(
        ws,
        () => {
          const msg = buildJupyterMessage(session, "kernel_info_request", {});
          ws.sendText(msg.payload);
          return msg.msgId;
        },
        (parsed, resolve2) => {
          if (parsed.msg_type === "kernel_info_reply") {
            resolve2(void 0);
          }
        },
        timeoutMs,
        options.signal
      );
    }
    let stdout = "";
    let stderr = "";
    let errorName;
    let errorValue;
    let replyReceived = false;
    let iopubIdle = false;
    let settleTimer;
    await waitForKernelMessage(
      ws,
      () => {
        const msg = buildJupyterMessage(session, "execute_request", {
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
      (parsed, resolve2) => {
        const content = parsed.content ?? {};
        if (parsed.msg_type === "stream") {
          const text = typeof content.text === "string" ? content.text : "";
          if (content.name === "stderr") {
            stderr += text;
          } else {
            stdout += text;
          }
        } else if (parsed.msg_type === "error") {
          errorName = typeof content.ename === "string" ? content.ename : "Error";
          errorValue = typeof content.evalue === "string" ? content.evalue : "";
        } else if (parsed.msg_type === "status" && content.execution_state === "idle") {
          iopubIdle = true;
          if (replyReceived) {
            if (settleTimer) {
              clearTimeout(settleTimer);
              settleTimer = void 0;
            }
            resolve2(void 0);
          }
        } else if (parsed.msg_type === "execute_reply") {
          replyReceived = true;
          if (iopubIdle || errorName) {
            resolve2(void 0);
          } else {
            settleTimer = setTimeout(() => resolve2(void 0), 40);
          }
        }
      },
      timeoutMs,
      options.signal,
      () => {
        if (settleTimer) {
          clearTimeout(settleTimer);
          settleTimer = void 0;
        }
      }
    );
    return { stdout, stderr, errorName, errorValue };
  } finally {
    ws.close();
  }
}
function waitForKernelMessage(ws, sendAndGetMsgId, onMatchedMessage, timeoutMs, signal, onCleanup) {
  if (signal?.aborted) {
    return Promise.reject(new KaggleError("cancelled", "\u64CD\u4F5C\u5DF2\u53D6\u6D88"));
  }
  return new Promise((resolve2, reject) => {
    let settled = false;
    let timer;
    let unsubMsg;
    let unsubClose;
    let abortListener;
    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = void 0;
      }
      unsubMsg?.();
      unsubClose?.();
      if (abortListener && signal) {
        signal.removeEventListener("abort", abortListener);
      }
      onCleanup?.();
    };
    const done = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve2(value);
    };
    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };
    timer = setTimeout(() => {
      const error = new Error(`\u5185\u6838\u6267\u884C\u8D85\u65F6\uFF08${timeoutMs} ms\uFF09`);
      error.code = "ETIMEDOUT";
      fail(classifyNetworkError(error));
    }, timeoutMs);
    if (signal) {
      abortListener = () => fail(new KaggleError("cancelled", "\u64CD\u4F5C\u5DF2\u53D6\u6D88"));
      signal.addEventListener("abort", abortListener, { once: true });
    }
    let expectedMsgId = "";
    unsubMsg = ws.onMessage((raw) => {
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      if (parsed.parent_header?.msg_id !== expectedMsgId) {
        return;
      }
      onMatchedMessage(parsed, done);
    });
    unsubClose = ws.onClose((reason) => {
      fail(reason ?? new KaggleError("network", "\u5185\u6838 WebSocket \u8FDE\u63A5\u5DF2\u65AD\u5F00"));
    });
    try {
      expectedMsgId = sendAndGetMsgId();
    } catch (error) {
      fail(error);
    }
  });
}

// src/client.ts
var MAX_DOWNLOAD_BYTES = 512 * 1024 * 1024;
var RAW_DOWNLOAD_THRESHOLD_BYTES = 1024 * 1024;
var HTML_LIKE_FILE_RE = /\.(html?|xhtml|svg)$/i;
var SESSION_CONFIRM_TTL_MS = 3e3;
var HELPER_KERNEL_IDLE_MS = 3e3;
var KERNEL_DELETE_MARKER = "__KC_DEL__:";
var JupyterClient = class {
  baseUrl;
  proxy;
  timeoutMs;
  token;
  clockOffsetMs = 0;
  lastSessionConfirmedAt = 0;
  pendingSessionConfirm;
  helperKernelId;
  helperKernelOwned = false;
  helperKernelNeedsReady = false;
  helperKernelIdleTimer;
  helperKernelInFlight;
  constructor(serverUrl, options = {}) {
    this.baseUrl = normalizeServerUrl(serverUrl);
    this.proxy = options.proxy;
    this.timeoutMs = options.timeoutMs ?? 12e4;
    try {
      this.token = new URL(this.baseUrl).searchParams.get("token") ?? void 0;
    } catch {
      this.token = void 0;
    }
  }
  async test(remoteDir) {
    const path6 = normalizeRemotePath(remoteDir);
    try {
      const model = await this.getContents(path6);
      if (path6 && typeof model?.type === "string" && model.type !== "directory") {
        throw new KaggleError(
          "badRequest",
          `\u8FDC\u7AEF\u8DEF\u5F84 \u201C${path6}\u201D \u662F\u4E00\u4E2A ${model.type}\uFF0C\u4E0D\u662F\u76EE\u5F55`,
          { hint: "\u8BF7\u628A REMOTE_DIR \u6539\u6210\u76EE\u5F55\u8DEF\u5F84\uFF0C\u6216\u5148\u5220\u9664\u540C\u540D\u6587\u4EF6\u3002" }
        );
      }
      return {
        exists: true,
        writable: typeof model?.writable === "boolean" ? model.writable : void 0,
        path: path6
      };
    } catch (error) {
      if (error instanceof KaggleError && error.kind === "notFound" && path6) {
        return { exists: false, path: path6 };
      }
      throw error;
    }
  }
  /**
   * Fast liveness probe against GET /api/status with a wall-clock deadline.
   * Expired Kaggle links can hang ~30s before the proxy answers 404; the
   * deadline cuts that short. Never throws: failures are returned so callers
   * can distinguish "likely expired" from "network problem".
   */
  async probeSession(deadlineMs) {
    try {
      await this.requestUrl("GET", statusUrl(this.baseUrl), void 0, void 0, {
        deadlineMs,
        skipSessionConfirmation: true
      });
      this.lastSessionConfirmedAt = Date.now();
      return { alive: true, likelyExpired: false };
    } catch (error) {
      this.lastSessionConfirmedAt = 0;
      const typed = error instanceof KaggleError ? error : classifyNetworkError(error);
      return {
        alive: false,
        error: typed,
        likelyExpired: isSessionError(typed) || typed.kind === "timeout"
      };
    }
  }
  /**
   * Lightweight keep-alive ping against GET /api/kernels (refreshes last_activity)
   * with automatic fallback to GET /api/status if the kernels endpoint is not available.
   * Expired Kaggle links or timeouts return likelyExpired: true. Never throws.
   */
  async keepAlive(deadlineMs) {
    try {
      await this.requestUrl("GET", kernelsUrl(this.baseUrl), void 0, void 0, {
        deadlineMs
      });
      return { alive: true, likelyExpired: false };
    } catch (error) {
      const typed = error instanceof KaggleError ? error : classifyNetworkError(error);
      if (typed.kind === "notFound") {
        return this.probeSession(deadlineMs);
      }
      return {
        alive: false,
        error: typed,
        likelyExpired: isSessionError(typed) || typed.kind === "timeout"
      };
    }
  }
  async getContents(remotePath, signal) {
    const url = new URL(this.contentsUrl(remotePath));
    url.searchParams.set("content", "0");
    return this.requestUrl("GET", url.toString(), void 0, signal);
  }
  /**
   * List a remote directory (GET /api/contents/{path}?content=1).
   * Directories are returned first, then entries by name.
   */
  async listDirectory(remotePath, signal, options = {}) {
    const url = new URL(this.contentsUrl(remotePath));
    url.searchParams.set("content", "1");
    if (options.hash) {
      url.searchParams.set("hash", "1");
    }
    const model = await this.requestUrl("GET", url.toString(), void 0, signal);
    if (!model || typeof model !== "object") {
      throw new KaggleError("badRequest", "\u76EE\u5F55\u8FD4\u56DE\u5185\u5BB9\u65E0\u6548");
    }
    const record = model;
    if (record.type !== "directory") {
      throw new KaggleError(
        "badRequest",
        `\u201C${normalizeRemotePath(remotePath) || "/"}\u201D \u4E0D\u662F\u76EE\u5F55`
      );
    }
    if (!Array.isArray(record.content)) {
      return [];
    }
    const entries = [];
    for (const raw of record.content) {
      if (!raw || typeof raw !== "object") {
        continue;
      }
      const item = raw;
      const name = typeof item.name === "string" ? item.name : "";
      const path6 = typeof item.path === "string" ? item.path : "";
      if (!name || !path6) {
        continue;
      }
      const type = item.type === "directory" || item.type === "notebook" ? item.type : "file";
      entries.push({
        name,
        path: path6,
        type,
        writable: typeof item.writable === "boolean" ? item.writable : void 0,
        size: typeof item.size === "number" ? item.size : void 0,
        lastModified: parseTimestamp(item.last_modified),
        hash: typeof item.hash === "string" ? item.hash : void 0,
        hashAlgorithm: typeof item.hash_algorithm === "string" ? item.hash_algorithm : void 0
      });
    }
    entries.sort((left, right) => {
      const directoryOrder = Number(right.type === "directory") - Number(left.type === "directory");
      return directoryOrder !== 0 ? directoryOrder : left.name.localeCompare(right.name, void 0, {
        numeric: true,
        sensitivity: "base"
      });
    });
    return entries;
  }
  async putFile(remotePath, bytes, signal) {
    const payload = JSON.stringify({
      type: "file",
      format: "base64",
      content: bytes.toString("base64")
    });
    await this.requestUrl("PUT", this.contentsUrl(remotePath), payload, signal);
  }
  async putDirectory(remotePath, signal) {
    await this.requestUrl(
      "PUT",
      this.contentsUrl(remotePath),
      JSON.stringify({ type: "directory" }),
      signal
    );
  }
  async deleteContents(remotePath, signal) {
    try {
      await this.requestUrl("DELETE", this.contentsUrl(remotePath), void 0, signal);
    } catch (error) {
      if (!shouldFallbackKernelDelete(error)) {
        throw error;
      }
      await this.deleteViaKernel(remotePath, signal);
    }
  }
  async listKernels(signal) {
    const list = await this.requestUrl("GET", kernelsUrl(this.baseUrl), void 0, signal, {
      deadlineMs: Math.min(this.timeoutMs, 1e4)
    });
    if (!Array.isArray(list)) {
      return [];
    }
    const result = [];
    for (const item of list) {
      if (typeof item?.id !== "string" || !item.id) {
        continue;
      }
      result.push({
        id: item.id,
        name: typeof item.name === "string" ? item.name : "",
        executionState: typeof item.execution_state === "string" ? item.execution_state : void 0
      });
    }
    return result;
  }
  /**
   * Persist the IPython startup script so newly launched Python kernels start
   * inside REMOTE_DIR (with sys.path and PYTHONPATH configured), and update any
   * currently idle Python kernels immediately. When no idle kernel is running,
   * a temporary helper kernel is spun up and disposed right after writing the
   * startup script unless `onlyExistingIdle` is set.
   */
  async configureKernelWorkingDir(remoteDir, options = {}) {
    const enabled = options.enabled ?? true;
    const parts = splitRemoteDirParts(remoteDir);
    if (enabled && parts.length === 0) {
      throw new KaggleError("badRequest", "\u5DE5\u4F5C\u76EE\u5F55\u4E0D\u80FD\u4E3A\u7A7A");
    }
    const code = buildKernelConfigureCwdCode(parts, enabled);
    let kernels = [];
    try {
      kernels = await this.listKernels(options.signal);
    } catch (error) {
      if (isSessionError(error) || error instanceof KaggleError && error.kind === "cancelled") {
        throw error;
      }
      kernels = [];
    }
    const pythonKernels = kernels.filter(
      (kernel) => !kernel.name || /python/i.test(kernel.name)
    );
    const busyCount = pythonKernels.filter(
      (kernel) => kernel.executionState === "busy"
    ).length;
    const idleKernels = pythonKernels.filter(
      (kernel) => kernel.executionState !== "busy"
    );
    if (idleKernels.length > 0) {
      let executedCount = 0;
      let startupConfigured = false;
      let updatedKernels = 0;
      let dirExists = false;
      let projPath;
      let startupPath;
      for (const kernel of idleKernels) {
        try {
          const execResult = await executePythonInKernel({
            channelsUrl: kernelChannelsUrl(this.baseUrl, kernel.id),
            token: this.token,
            proxy: this.proxy,
            timeoutMs: this.timeoutMs,
            signal: options.signal,
            code,
            waitForReady: kernel.executionState === "starting"
          });
          const parsed = parseKernelConfigureCwdResult(execResult);
          executedCount += 1;
          startupConfigured = parsed.startupConfigured;
          dirExists = parsed.dirExists;
          if (parsed.cwdChanged) {
            updatedKernels += 1;
          }
          projPath = parsed.projPath ?? projPath;
          startupPath = parsed.startupPath ?? startupPath;
        } catch (error) {
          if (error instanceof KaggleError && error.kind === "notFound") {
            continue;
          }
          throw error;
        }
      }
      if (executedCount > 0) {
        return {
          startupConfigured,
          updatedKernels,
          skippedBusyKernels: busyCount,
          dirExists,
          projPath,
          startupPath
        };
      }
    }
    if (options.onlyExistingIdle) {
      return {
        startupConfigured: false,
        updatedKernels: 0,
        skippedBusyKernels: busyCount,
        dirExists: false
      };
    }
    const hadHelper = Boolean(this.helperKernelId);
    const helperId = await this.ensureHelperKernel(options.signal);
    const waitForReady = this.helperKernelNeedsReady;
    try {
      const execResult = await executePythonInKernel({
        channelsUrl: kernelChannelsUrl(this.baseUrl, helperId),
        token: this.token,
        proxy: this.proxy,
        timeoutMs: this.timeoutMs,
        signal: options.signal,
        code,
        waitForReady
      });
      this.helperKernelNeedsReady = false;
      const parsed = parseKernelConfigureCwdResult(execResult);
      return {
        startupConfigured: parsed.startupConfigured,
        updatedKernels: this.helperKernelOwned ? 0 : parsed.cwdChanged ? 1 : 0,
        skippedBusyKernels: busyCount,
        dirExists: parsed.dirExists,
        projPath: parsed.projPath,
        startupPath: parsed.startupPath
      };
    } finally {
      if (!hadHelper) {
        if (this.helperKernelOwned) {
          await this.dispose();
        } else {
          this.helperKernelId = void 0;
          this.helperKernelNeedsReady = false;
        }
      }
    }
  }
  /**
   * Shut down any temporary helper kernel created by fallback operations.
   */
  async dispose() {
    if (this.helperKernelIdleTimer) {
      clearTimeout(this.helperKernelIdleTimer);
      this.helperKernelIdleTimer = void 0;
    }
    const kernelId = this.helperKernelId;
    const owned = this.helperKernelOwned;
    this.helperKernelId = void 0;
    this.helperKernelOwned = false;
    this.helperKernelNeedsReady = false;
    if (!kernelId || !owned) {
      return;
    }
    try {
      await this.requestUrl("DELETE", kernelUrl(this.baseUrl, kernelId), void 0, void 0, {
        deadlineMs: Math.min(this.timeoutMs, 1e4),
        skipSessionConfirmation: true
      });
    } catch {
    }
  }
  async renameContents(fromPath, toPath, signal) {
    const source = normalizeRemotePath(fromPath);
    const target = normalizeRemotePath(toPath);
    if (!target) {
      throw new KaggleError("badRequest", "\u76EE\u6807\u8DEF\u5F84\u4E0D\u80FD\u4E3A\u7A7A");
    }
    if (source === target) {
      return;
    }
    await this.requestUrl(
      "PATCH",
      this.contentsUrl(source),
      JSON.stringify({ path: target }),
      signal
    );
  }
  /**
   * Read a remote file as bytes. Text and notebook files are encoded as
   * UTF-8; binary files are decoded from the base64 Contents representation.
   */
  async readFile(remotePath, signal) {
    const url = new URL(this.contentsUrl(remotePath));
    url.searchParams.set("content", "1");
    const model = await this.requestUrl("GET", url.toString(), void 0, signal, {
      maxResponseBytes: MAX_DOWNLOAD_BYTES
    });
    if (!model || typeof model !== "object") {
      throw new KaggleError("badRequest", "\u6587\u4EF6\u8FD4\u56DE\u5185\u5BB9\u65E0\u6548");
    }
    const record = model;
    if (record.type === "directory") {
      throw new KaggleError("badRequest", "\u8FD9\u662F\u4E00\u4E2A\u76EE\u5F55\uFF0C\u4E0D\u80FD\u6309\u6587\u4EF6\u8BFB\u53D6");
    }
    if (record.type === "notebook" && !/\.ipynb$/i.test(normalizeRemotePath(remotePath))) {
      return this.readRawFile(remotePath, signal);
    }
    if (record.content === null || record.content === void 0) {
      if (record.size === 0) {
        return Buffer.alloc(0);
      }
      throw new KaggleError("badRequest", "\u670D\u52A1\u5668\u6CA1\u6709\u8FD4\u56DE\u6587\u4EF6\u5185\u5BB9");
    }
    if (record.format === "base64") {
      if (typeof record.content !== "string") {
        throw new KaggleError("badRequest", "\u65E0\u6CD5\u89E3\u7801 base64 \u6587\u4EF6\u5185\u5BB9");
      }
      return Buffer.from(record.content, "base64");
    }
    if (record.type === "notebook" || record.format === "json") {
      const text = typeof record.content === "string" ? record.content : JSON.stringify(record.content, null, 2);
      return Buffer.from(text.endsWith("\n") ? text : `${text}
`, "utf8");
    }
    if (typeof record.content === "string") {
      return Buffer.from(record.content, "utf8");
    }
    throw new KaggleError("badRequest", "\u65E0\u6CD5\u8BC6\u522B\u6587\u4EF6\u5185\u5BB9\u683C\u5F0F");
  }
  /**
   * Download a remote file, preferring Jupyter's /files raw stream for large
   * regular files (to avoid base64 expansion and server-side JSON buffering),
   * and falling back to the Contents API when /files is unavailable.
   */
  async downloadFile(remotePath, options = {}) {
    const canTryRaw = options.type === "file" && typeof options.sizeHint === "number" && options.sizeHint >= RAW_DOWNLOAD_THRESHOLD_BYTES && !HTML_LIKE_FILE_RE.test(normalizeRemotePath(remotePath));
    if (canTryRaw) {
      const { url, response } = await this.requestRaw(remotePath, options.signal);
      const contentType = String(response.headers["content-type"] ?? "");
      if (response.status >= 200 && response.status < 300) {
        if (!looksLikeHtmlResponse(contentType, response.body)) {
          return response.body;
        }
        return this.readFile(remotePath, options.signal);
      }
      if (response.status >= 300 && response.status < 400 || response.status === 403 || response.status === 404 || response.status === 405 || response.status === 501) {
        return this.readFile(remotePath, options.signal);
      }
      throw classifyHttpError({
        status: response.status,
        statusText: response.statusText,
        body: response.body.toString("utf8"),
        url,
        location: typeof response.headers.location === "string" ? response.headers.location : void 0,
        contentType
      });
    }
    return this.readFile(remotePath, options.signal);
  }
  /**
   * Read raw bytes from Jupyter's /files endpoint. Used for Jupytext text
   * notebooks, where the Contents API would return a converted notebook
   * model instead of the file's original source text.
   */
  async readRawFile(remotePath, signal) {
    const { url, response } = await this.requestRaw(remotePath, signal);
    if (response.status >= 200 && response.status < 300) {
      return response.body;
    }
    const bodyText = response.body.toString("utf8");
    const contentType = String(response.headers["content-type"] ?? "");
    const classified = classifyHttpError({
      status: response.status,
      statusText: response.statusText,
      body: bodyText,
      url,
      location: typeof response.headers.location === "string" ? response.headers.location : void 0,
      contentType
    });
    if (classified.kind === "notFound") {
      if (!isJsonHttpResponse(contentType, bodyText)) {
        await this.confirmSessionAlive(signal);
      }
      throw new KaggleError("notFound", "\u8FDC\u7AEF\u6587\u4EF6\u4E0D\u5B58\u5728\uFF08HTTP 404\uFF09", {
        status: 404,
        detail: bodyText.slice(0, 200),
        hint: "\u6587\u4EF6\u53EF\u80FD\u5DF2\u88AB\u5220\u9664\uFF0C\u6216\u5F53\u524D Jupyter \u670D\u52A1\u5668\u4E0D\u652F\u6301 /files \u539F\u59CB\u6587\u4EF6\u63A5\u53E3\u3002"
      });
    }
    this.lastSessionConfirmedAt = 0;
    throw classified;
  }
  async requestRaw(remotePath, signal) {
    const url = filesUrl(this.baseUrl, remotePath);
    const headers = { Accept: "*/*" };
    if (this.token) {
      headers.Authorization = `token ${this.token}`;
    }
    const startedAt = Date.now();
    let response;
    try {
      response = await httpRequest(url, {
        method: "GET",
        headers,
        proxy: this.proxy,
        timeoutMs: this.timeoutMs,
        signal,
        maxResponseBytes: MAX_DOWNLOAD_BYTES
      });
    } catch (error) {
      throw classifyNetworkError(error);
    }
    this.updateClockOffset(response.headers.date, startedAt, Date.now());
    return { url, response };
  }
  /**
   * Create every directory level in order. Jupyter's PUT directory uses
   * os.mkdir (one level only), so "a/b/c" must be created as a, then a/b, ...
   */
  async ensureDirectories(directories, signal) {
    const all = /* @__PURE__ */ new Set();
    for (const directory of directories) {
      const parts = normalizeRemotePath(directory).split("/").filter(Boolean);
      for (let index = 1; index <= parts.length; index += 1) {
        all.add(parts.slice(0, index).join("/"));
      }
    }
    const ordered = [...all].sort((left, right) => {
      const depth = left.split("/").length - right.split("/").length;
      return depth !== 0 ? depth : left.localeCompare(right);
    });
    for (const directory of ordered) {
      if (signal?.aborted) {
        throw new KaggleError("cancelled", "\u4E0A\u4F20\u5DF2\u53D6\u6D88");
      }
      await this.putDirectory(directory, signal);
    }
  }
  /**
   * Kaggle server clock minus local clock, learned from HTTP Date headers.
   * Used to compare remote file timestamps without assuming clock sync.
   */
  getClockOffsetMs() {
    return this.clockOffsetMs;
  }
  contentsUrl(remotePath) {
    return contentsUrl(this.baseUrl, remotePath);
  }
  headers() {
    const headers = {
      "Content-Type": "application/json"
    };
    if (this.token) {
      headers.Authorization = `token ${this.token}`;
    }
    return headers;
  }
  updateClockOffset(dateHeader, startedAt, receivedAt) {
    const value = Array.isArray(dateHeader) ? dateHeader[0] : dateHeader;
    if (!value) {
      return;
    }
    const serverTime = Date.parse(value);
    if (!Number.isFinite(serverTime)) {
      return;
    }
    const roundTrip = Math.max(0, receivedAt - startedAt);
    this.clockOffsetMs = Math.round(serverTime + roundTrip / 2 - receivedAt);
  }
  /**
   * Kaggle's pod proxy rewrites 404 responses on subpaths to plain-text
   * "not found" both when a file does not exist and when a JWT is invalid.
   * Confirm against /api/status (coalesced & briefly cached) before treating
   * an ambiguous plain-text 404 as a missing path.
   */
  async confirmSessionAlive(signal) {
    if (signal?.aborted) {
      throw new KaggleError("cancelled", "\u64CD\u4F5C\u5DF2\u53D6\u6D88");
    }
    if (Date.now() - this.lastSessionConfirmedAt < SESSION_CONFIRM_TTL_MS) {
      return;
    }
    if (!this.pendingSessionConfirm) {
      const tracked = (async () => {
        try {
          await this.requestUrl("GET", statusUrl(this.baseUrl), void 0, void 0, {
            deadlineMs: Math.min(this.timeoutMs, 1e4),
            skipSessionConfirmation: true
          });
          this.lastSessionConfirmedAt = Date.now();
        } catch (error) {
          this.lastSessionConfirmedAt = 0;
          throw error;
        }
      })().finally(() => {
        if (this.pendingSessionConfirm === tracked) {
          this.pendingSessionConfirm = void 0;
        }
      });
      this.pendingSessionConfirm = tracked;
    }
    const pending = this.pendingSessionConfirm;
    if (!signal) {
      return pending;
    }
    return new Promise((resolve2, reject) => {
      const onAbort = () => reject(new KaggleError("cancelled", "\u64CD\u4F5C\u5DF2\u53D6\u6D88"));
      signal.addEventListener("abort", onAbort, { once: true });
      pending.then(
        () => {
          signal.removeEventListener("abort", onAbort);
          resolve2();
        },
        (error) => {
          signal.removeEventListener("abort", onAbort);
          reject(error);
        }
      );
    });
  }
  async requestUrl(method, url, body, signal, options = {}) {
    let response;
    const startedAt = Date.now();
    try {
      response = await httpRequest(url, {
        method,
        headers: this.headers(),
        body,
        proxy: this.proxy,
        timeoutMs: this.timeoutMs,
        deadlineMs: options.deadlineMs,
        signal,
        maxResponseBytes: options.maxResponseBytes
      });
    } catch (error) {
      this.lastSessionConfirmedAt = 0;
      throw classifyNetworkError(error);
    }
    this.updateClockOffset(response.headers.date, startedAt, Date.now());
    const text = response.body.toString("utf8");
    const contentType = String(response.headers["content-type"] ?? "");
    const trimmed = text.trimStart();
    if (response.status >= 200 && response.status < 300) {
      if (!text) {
        return void 0;
      }
      if (contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          return JSON.parse(text);
        } catch {
          this.lastSessionConfirmedAt = 0;
          throw nonJsonError(url, text, response.status);
        }
      }
      if (trimmed.startsWith("<")) {
        this.lastSessionConfirmedAt = 0;
        throw nonJsonError(url, text, response.status);
      }
      return text;
    }
    const classified = classifyHttpError({
      status: response.status,
      statusText: response.statusText,
      body: text,
      url,
      location: typeof response.headers.location === "string" ? response.headers.location : void 0,
      contentType
    });
    if (classified.kind === "notFound" && !options.skipSessionConfirmation && !isJsonHttpResponse(contentType, text)) {
      await this.confirmSessionAlive(signal);
      throw classified;
    }
    if (classified.kind !== "notFound") {
      this.lastSessionConfirmedAt = 0;
    }
    throw classified;
  }
  async deleteViaKernel(remotePath, signal) {
    const parts = normalizeRemotePath(remotePath).split("/").filter(Boolean);
    if (parts.length === 0) {
      throw new KaggleError("badRequest", "\u4E0D\u652F\u6301\u901A\u8FC7\u5185\u6838\u56DE\u9000\u5220\u9664 Jupyter \u6839\u76EE\u5F55");
    }
    const code = buildKernelDeleteCode(parts);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (this.helperKernelIdleTimer) {
        clearTimeout(this.helperKernelIdleTimer);
        this.helperKernelIdleTimer = void 0;
      }
      const kernelId = await this.ensureHelperKernel(signal);
      const waitForReady = this.helperKernelNeedsReady;
      try {
        const result = await executePythonInKernel({
          channelsUrl: kernelChannelsUrl(this.baseUrl, kernelId),
          token: this.token,
          proxy: this.proxy,
          timeoutMs: this.timeoutMs,
          signal,
          code,
          waitForReady
        });
        this.helperKernelNeedsReady = false;
        this.scheduleHelperKernelCleanup();
        throwIfKernelDeleteFailed(result);
        return;
      } catch (error) {
        if (attempt === 0 && !signal?.aborted && error instanceof KaggleError && (error.kind === "notFound" || error.kind === "network")) {
          this.helperKernelId = void 0;
          this.helperKernelOwned = false;
          this.helperKernelNeedsReady = false;
          continue;
        }
        this.scheduleHelperKernelCleanup();
        throw error;
      }
    }
  }
  scheduleHelperKernelCleanup() {
    if (this.helperKernelIdleTimer) {
      clearTimeout(this.helperKernelIdleTimer);
      this.helperKernelIdleTimer = void 0;
    }
    if (!this.helperKernelId || !this.helperKernelOwned) {
      return;
    }
    this.helperKernelIdleTimer = setTimeout(() => {
      this.helperKernelIdleTimer = void 0;
      void this.dispose();
    }, HELPER_KERNEL_IDLE_MS);
    this.helperKernelIdleTimer.unref?.();
  }
  async ensureHelperKernel(signal) {
    if (signal?.aborted) {
      throw new KaggleError("cancelled", "\u64CD\u4F5C\u5DF2\u53D6\u6D88");
    }
    if (this.helperKernelId) {
      return this.helperKernelId;
    }
    if (this.helperKernelInFlight) {
      return this.helperKernelInFlight;
    }
    const start = (async () => {
      const specName = await this.pickPythonKernelSpec(signal);
      try {
        const payload = specName ? JSON.stringify({ name: specName }) : JSON.stringify({});
        const created = await this.requestUrl(
          "POST",
          kernelsUrl(this.baseUrl),
          payload,
          signal
        );
        const id = typeof created?.id === "string" ? created.id : "";
        if (!id) {
          throw new KaggleError("unknown", "\u672A\u80FD\u521B\u5EFA\u7528\u4E8E\u56DE\u9000\u5220\u9664\u7684 Jupyter \u5185\u6838");
        }
        this.helperKernelId = id;
        this.helperKernelOwned = true;
        this.helperKernelNeedsReady = true;
        return id;
      } catch (error) {
        if (isSessionError(error) || error instanceof KaggleError && error.kind === "cancelled") {
          throw error;
        }
        const existingId = await this.findIdlePythonKernel(signal);
        if (existingId) {
          this.helperKernelId = existingId;
          this.helperKernelOwned = false;
          this.helperKernelNeedsReady = false;
          return existingId;
        }
        throw error;
      }
    })().finally(() => {
      if (this.helperKernelInFlight === start) {
        this.helperKernelInFlight = void 0;
      }
    });
    this.helperKernelInFlight = start;
    return start;
  }
  async pickPythonKernelSpec(signal) {
    try {
      const raw = await this.requestUrl(
        "GET",
        kernelspecsUrl(this.baseUrl),
        void 0,
        signal,
        { deadlineMs: Math.min(this.timeoutMs, 1e4) }
      );
      const specs = raw?.kernelspecs;
      if (!specs || typeof specs !== "object") {
        return "python3";
      }
      if ("python3" in specs) {
        return "python3";
      }
      const def = typeof raw?.default === "string" ? raw.default : void 0;
      if (def && /python/i.test(String(specs[def]?.spec?.language ?? ""))) {
        return def;
      }
      for (const [name, entry] of Object.entries(specs)) {
        if (/python/i.test(String(entry?.spec?.language ?? ""))) {
          return name;
        }
      }
      return def;
    } catch {
      return "python3";
    }
  }
  async findIdlePythonKernel(signal) {
    try {
      const list = await this.listKernels(signal);
      const candidate = list.find(
        (item) => item.executionState === "idle" && /python/i.test(item.name)
      ) ?? list.find((item) => item.executionState === "idle");
      return candidate?.id;
    } catch {
      return void 0;
    }
  }
};
function shouldFallbackKernelDelete(error) {
  if (!(error instanceof KaggleError) || error.kind !== "badRequest" || error.status !== 400) {
    return false;
  }
  if (/工作目录非空/.test(error.message)) {
    return false;
  }
  const detail = (error.detail ?? "").trim();
  return /^not found$/i.test(detail) || /send2trash|trash/i.test(detail);
}
function buildKernelDeleteCode(parts) {
  const partsJson = JSON.stringify(parts);
  return [
    "def _kc_del():",
    "    import json, os, re, shutil",
    `    parts = ${partsJson}`,
    '    if not parts or any(p in ("", ".", "..") or "/" in p or "\\\\" in p for p in parts):',
    '        print("' + KERNEL_DELETE_MARKER + '" + json.dumps({"ok": False, "error": "invalid path"}))',
    "        return",
    "    root = None",
    "    try:",
    '        with open(f"/proc/{os.getppid()}/cmdline", "rb") as f:',
    '            args = [a.decode("utf-8", "ignore") for a in f.read().split(b"\\x00") if a]',
    "        for i, arg in enumerate(args):",
    '            m = re.match(r"^--(?:NotebookApp\\.notebook_dir|ServerApp\\.root_dir)=(.+)$", arg)',
    "            if m:",
    "                root = m.group(1)",
    "                break",
    '            if arg in ("--NotebookApp.notebook_dir", "--ServerApp.root_dir") and i + 1 < len(args):',
    "                root = args[i + 1]",
    "                break",
    "    except Exception:",
    "        pass",
    "    root = os.path.realpath(root or os.getcwd())",
    "    target = os.path.abspath(os.path.join(root, *parts))",
    "    parent_real = os.path.realpath(os.path.dirname(target))",
    "    if os.path.commonpath([root, target]) != root or os.path.commonpath([root, parent_real]) != root or target == root:",
    '        print("' + KERNEL_DELETE_MARKER + '" + json.dumps({"ok": False, "error": "target outside working root"}))',
    "        return",
    "    if not os.path.lexists(target):",
    '        print("' + KERNEL_DELETE_MARKER + '" + json.dumps({"ok": False, "notFound": True}))',
    "        return",
    "    try:",
    "        if os.path.isdir(target) and not os.path.islink(target):",
    "            shutil.rmtree(target)",
    "        else:",
    "            os.unlink(target)",
    '        print("' + KERNEL_DELETE_MARKER + '" + json.dumps({"ok": True}))',
    "    except Exception as exc:",
    '        print("' + KERNEL_DELETE_MARKER + '" + json.dumps({"ok": False, "error": str(exc)}))',
    "try:",
    "    _kc_del()",
    "finally:",
    '    globals().pop("_kc_del", None)'
  ].join("\n");
}
function throwIfKernelDeleteFailed(result) {
  const lines = result.stdout.split(/\r?\n/).reverse();
  const markerLine = lines.find((line) => line.startsWith(KERNEL_DELETE_MARKER));
  if (markerLine) {
    let payload;
    try {
      payload = JSON.parse(markerLine.slice(KERNEL_DELETE_MARKER.length));
    } catch {
      throw new KaggleError("unknown", "\u5185\u6838\u5220\u9664\u8FD4\u56DE\u5185\u5BB9\u65E0\u6548", {
        detail: markerLine.slice(0, 200)
      });
    }
    if (payload.ok === true) {
      return;
    }
    if (payload.notFound === true) {
      throw new KaggleError("notFound", "\u8FDC\u7A0B\u8DEF\u5F84\u4E0D\u5B58\u5728\uFF08HTTP 404\uFF09", {
        status: 404,
        detail: "not found"
      });
    }
    const detail = typeof payload.error === "string" ? payload.error : "\u8FDC\u7AEF\u5220\u9664\u5931\u8D25";
    throw new KaggleError("badRequest", `\u8FDC\u7AEF\u5220\u9664\u5931\u8D25\uFF1A${detail}`, { detail });
  }
  if (result.errorName) {
    throw new KaggleError("badRequest", `\u5185\u6838\u5220\u9664\u5931\u8D25\uFF1A${result.errorName}`, {
      detail: result.errorValue
    });
  }
  throw new KaggleError("unknown", "\u5185\u6838\u672A\u8FD4\u56DE\u5220\u9664\u7ED3\u679C", {
    detail: (result.stderr || result.stdout).slice(0, 200)
  });
}
function parseTimestamp(value) {
  if (typeof value !== "string" || !value) {
    return void 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : void 0;
}
function looksLikeHtmlResponse(contentType, body) {
  if (/html/i.test(contentType)) {
    return true;
  }
  if (!contentType && body.length > 0 && body.length < 64 * 1024) {
    const prefix = body.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
    return prefix.startsWith("<!doctype html") || prefix.startsWith("<html");
  }
  return false;
}

// src/config.ts
var vscode = __toESM(require("vscode"));

// node_modules/minimatch/dist/esm/index.js
var import_brace_expansion = __toESM(require_brace_expansion(), 1);

// node_modules/minimatch/dist/esm/assert-valid-pattern.js
var MAX_PATTERN_LENGTH = 1024 * 64;
var assertValidPattern = (pattern) => {
  if (typeof pattern !== "string") {
    throw new TypeError("invalid pattern");
  }
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new TypeError("pattern is too long");
  }
};

// node_modules/minimatch/dist/esm/brace-expressions.js
var posixClasses = {
  "[:alnum:]": ["\\p{L}\\p{Nl}\\p{Nd}", true],
  "[:alpha:]": ["\\p{L}\\p{Nl}", true],
  "[:ascii:]": ["\\x00-\\x7f", false],
  "[:blank:]": ["\\p{Zs}\\t", true],
  "[:cntrl:]": ["\\p{Cc}", true],
  "[:digit:]": ["\\p{Nd}", true],
  "[:graph:]": ["\\p{Z}\\p{C}", true, true],
  "[:lower:]": ["\\p{Ll}", true],
  "[:print:]": ["\\p{C}", true],
  "[:punct:]": ["\\p{P}", true],
  "[:space:]": ["\\p{Z}\\t\\r\\n\\v\\f", true],
  "[:upper:]": ["\\p{Lu}", true],
  "[:word:]": ["\\p{L}\\p{Nl}\\p{Nd}\\p{Pc}", true],
  "[:xdigit:]": ["A-Fa-f0-9", false]
};
var braceEscape = (s) => s.replace(/[[\]\\-]/g, "\\$&");
var regexpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var rangesToString = (ranges) => ranges.join("");
var parseClass = (glob, position) => {
  const pos = position;
  if (glob.charAt(pos) !== "[") {
    throw new Error("not in a brace expression");
  }
  const ranges = [];
  const negs = [];
  let i = pos + 1;
  let sawStart = false;
  let uflag = false;
  let escaping = false;
  let negate = false;
  let endPos = pos;
  let rangeStart = "";
  WHILE: while (i < glob.length) {
    const c = glob.charAt(i);
    if ((c === "!" || c === "^") && i === pos + 1) {
      negate = true;
      i++;
      continue;
    }
    if (c === "]" && sawStart && !escaping) {
      endPos = i + 1;
      break;
    }
    sawStart = true;
    if (c === "\\") {
      if (!escaping) {
        escaping = true;
        i++;
        continue;
      }
    }
    if (c === "[" && !escaping) {
      for (const [cls, [unip, u, neg]] of Object.entries(posixClasses)) {
        if (glob.startsWith(cls, i)) {
          if (rangeStart) {
            return ["$.", false, glob.length - pos, true];
          }
          i += cls.length;
          if (neg)
            negs.push(unip);
          else
            ranges.push(unip);
          uflag = uflag || u;
          continue WHILE;
        }
      }
    }
    escaping = false;
    if (rangeStart) {
      if (c > rangeStart) {
        ranges.push(braceEscape(rangeStart) + "-" + braceEscape(c));
      } else if (c === rangeStart) {
        ranges.push(braceEscape(c));
      }
      rangeStart = "";
      i++;
      continue;
    }
    if (glob.startsWith("-]", i + 1)) {
      ranges.push(braceEscape(c + "-"));
      i += 2;
      continue;
    }
    if (glob.startsWith("-", i + 1)) {
      rangeStart = c;
      i += 2;
      continue;
    }
    ranges.push(braceEscape(c));
    i++;
  }
  if (endPos < i) {
    return ["", false, 0, false];
  }
  if (!ranges.length && !negs.length) {
    return ["$.", false, glob.length - pos, true];
  }
  if (negs.length === 0 && ranges.length === 1 && /^\\?.$/.test(ranges[0]) && !negate) {
    const r = ranges[0].length === 2 ? ranges[0].slice(-1) : ranges[0];
    return [regexpEscape(r), false, endPos - pos, false];
  }
  const sranges = "[" + (negate ? "^" : "") + rangesToString(ranges) + "]";
  const snegs = "[" + (negate ? "" : "^") + rangesToString(negs) + "]";
  const comb = ranges.length && negs.length ? "(" + sranges + "|" + snegs + ")" : ranges.length ? sranges : snegs;
  return [comb, uflag, endPos - pos, true];
};

// node_modules/minimatch/dist/esm/unescape.js
var unescape = (s, { windowsPathsNoEscape = false } = {}) => {
  return windowsPathsNoEscape ? s.replace(/\[([^\/\\])\]/g, "$1") : s.replace(/((?!\\).|^)\[([^\/\\])\]/g, "$1$2").replace(/\\([^\/])/g, "$1");
};

// node_modules/minimatch/dist/esm/ast.js
var _a;
var types = /* @__PURE__ */ new Set(["!", "?", "+", "*", "@"]);
var isExtglobType = (c) => types.has(c);
var isExtglobAST = (c) => isExtglobType(c.type);
var adoptionMap = /* @__PURE__ */ new Map([
  ["!", ["@"]],
  ["?", ["?", "@"]],
  ["@", ["@"]],
  ["*", ["*", "+", "?", "@"]],
  ["+", ["+", "@"]]
]);
var adoptionWithSpaceMap = /* @__PURE__ */ new Map([
  ["!", ["?"]],
  ["@", ["?"]],
  ["+", ["?", "*"]]
]);
var adoptionAnyMap = /* @__PURE__ */ new Map([
  ["!", ["?", "@"]],
  ["?", ["?", "@"]],
  ["@", ["?", "@"]],
  ["*", ["*", "+", "?", "@"]],
  ["+", ["+", "@", "?", "*"]]
]);
var usurpMap = /* @__PURE__ */ new Map([
  ["!", /* @__PURE__ */ new Map([["!", "@"]])],
  ["?", /* @__PURE__ */ new Map([["*", "*"], ["+", "*"]])],
  ["@", /* @__PURE__ */ new Map([["!", "!"], ["?", "?"], ["@", "@"], ["*", "*"], ["+", "+"]])],
  ["+", /* @__PURE__ */ new Map([["?", "*"], ["*", "*"]])]
]);
var startNoTraversal = "(?!(?:^|/)\\.\\.?(?:$|/))";
var startNoDot = "(?!\\.)";
var addPatternStart = /* @__PURE__ */ new Set(["[", "."]);
var justDots = /* @__PURE__ */ new Set(["..", "."]);
var reSpecials = new Set("().*{}+?[]^$\\!");
var regExpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var qmark = "[^/]";
var star = qmark + "*?";
var starNoEmpty = qmark + "+?";
var AST = class {
  type;
  #root;
  #hasMagic;
  #uflag = false;
  #parts = [];
  #parent;
  #parentIndex;
  #negs;
  #filledNegs = false;
  #options;
  #toString;
  // set to true if it's an extglob with no children
  // (which really means one child of '')
  #emptyExt = false;
  constructor(type, parent, options = {}) {
    this.type = type;
    if (type)
      this.#hasMagic = true;
    this.#parent = parent;
    this.#root = this.#parent ? this.#parent.#root : this;
    this.#options = this.#root === this ? options : this.#root.#options;
    this.#negs = this.#root === this ? [] : this.#root.#negs;
    if (type === "!" && !this.#root.#filledNegs)
      this.#negs.push(this);
    this.#parentIndex = this.#parent ? this.#parent.#parts.length : 0;
  }
  get hasMagic() {
    if (this.#hasMagic !== void 0)
      return this.#hasMagic;
    for (const p of this.#parts) {
      if (typeof p === "string")
        continue;
      if (p.type || p.hasMagic)
        return this.#hasMagic = true;
    }
    return this.#hasMagic;
  }
  // reconstructs the pattern
  toString() {
    if (this.#toString !== void 0)
      return this.#toString;
    if (!this.type) {
      return this.#toString = this.#parts.map((p) => String(p)).join("");
    } else {
      return this.#toString = this.type + "(" + this.#parts.map((p) => String(p)).join("|") + ")";
    }
  }
  #fillNegs() {
    if (this !== this.#root)
      throw new Error("should only call on root");
    if (this.#filledNegs)
      return this;
    this.toString();
    this.#filledNegs = true;
    let n;
    while (n = this.#negs.pop()) {
      if (n.type !== "!")
        continue;
      let p = n;
      let pp = p.#parent;
      while (pp) {
        for (let i = p.#parentIndex + 1; !pp.type && i < pp.#parts.length; i++) {
          for (const part of n.#parts) {
            if (typeof part === "string") {
              throw new Error("string part in extglob AST??");
            }
            part.copyIn(pp.#parts[i]);
          }
        }
        p = pp;
        pp = p.#parent;
      }
    }
    return this;
  }
  push(...parts) {
    for (const p of parts) {
      if (p === "")
        continue;
      if (typeof p !== "string" && !(p instanceof _a && p.#parent === this)) {
        throw new Error("invalid part: " + p);
      }
      this.#parts.push(p);
    }
  }
  toJSON() {
    const ret = this.type === null ? this.#parts.slice().map((p) => typeof p === "string" ? p : p.toJSON()) : [this.type, ...this.#parts.map((p) => p.toJSON())];
    if (this.isStart() && !this.type)
      ret.unshift([]);
    if (this.isEnd() && (this === this.#root || this.#root.#filledNegs && this.#parent?.type === "!")) {
      ret.push({});
    }
    return ret;
  }
  isStart() {
    if (this.#root === this)
      return true;
    if (!this.#parent?.isStart())
      return false;
    if (this.#parentIndex === 0)
      return true;
    const p = this.#parent;
    for (let i = 0; i < this.#parentIndex; i++) {
      const pp = p.#parts[i];
      if (!(pp instanceof _a && pp.type === "!")) {
        return false;
      }
    }
    return true;
  }
  isEnd() {
    if (this.#root === this)
      return true;
    if (this.#parent?.type === "!")
      return true;
    if (!this.#parent?.isEnd())
      return false;
    if (!this.type)
      return this.#parent?.isEnd();
    const pl = this.#parent ? this.#parent.#parts.length : 0;
    return this.#parentIndex === pl - 1;
  }
  copyIn(part) {
    if (typeof part === "string")
      this.push(part);
    else
      this.push(part.clone(this));
  }
  clone(parent) {
    const c = new _a(this.type, parent);
    for (const p of this.#parts) {
      c.copyIn(p);
    }
    return c;
  }
  static #parseAST(str, ast, pos, opt, extDepth) {
    const maxDepth = opt.maxExtglobRecursion ?? 2;
    let escaping = false;
    let inBrace = false;
    let braceStart = -1;
    let braceNeg = false;
    if (ast.type === null) {
      let i2 = pos;
      let acc2 = "";
      while (i2 < str.length) {
        const c = str.charAt(i2++);
        if (escaping || c === "\\") {
          escaping = !escaping;
          acc2 += c;
          continue;
        }
        if (inBrace) {
          if (i2 === braceStart + 1) {
            if (c === "^" || c === "!") {
              braceNeg = true;
            }
          } else if (c === "]" && !(i2 === braceStart + 2 && braceNeg)) {
            inBrace = false;
          }
          acc2 += c;
          continue;
        } else if (c === "[") {
          inBrace = true;
          braceStart = i2;
          braceNeg = false;
          acc2 += c;
          continue;
        }
        const doRecurse = !opt.noext && isExtglobType(c) && str.charAt(i2) === "(" && extDepth <= maxDepth;
        if (doRecurse) {
          ast.push(acc2);
          acc2 = "";
          const ext2 = new _a(c, ast);
          i2 = _a.#parseAST(str, ext2, i2, opt, extDepth + 1);
          ast.push(ext2);
          continue;
        }
        acc2 += c;
      }
      ast.push(acc2);
      return i2;
    }
    let i = pos + 1;
    let part = new _a(null, ast);
    const parts = [];
    let acc = "";
    while (i < str.length) {
      const c = str.charAt(i++);
      if (escaping || c === "\\") {
        escaping = !escaping;
        acc += c;
        continue;
      }
      if (inBrace) {
        if (i === braceStart + 1) {
          if (c === "^" || c === "!") {
            braceNeg = true;
          }
        } else if (c === "]" && !(i === braceStart + 2 && braceNeg)) {
          inBrace = false;
        }
        acc += c;
        continue;
      } else if (c === "[") {
        inBrace = true;
        braceStart = i;
        braceNeg = false;
        acc += c;
        continue;
      }
      const doRecurse = isExtglobType(c) && str.charAt(i) === "(" && /* c8 ignore start - the maxDepth is sufficient here */
      (extDepth <= maxDepth || ast && ast.#canAdoptType(c));
      if (doRecurse) {
        const depthAdd = ast && ast.#canAdoptType(c) ? 0 : 1;
        part.push(acc);
        acc = "";
        const ext2 = new _a(c, part);
        part.push(ext2);
        i = _a.#parseAST(str, ext2, i, opt, extDepth + depthAdd);
        continue;
      }
      if (c === "|") {
        part.push(acc);
        acc = "";
        parts.push(part);
        part = new _a(null, ast);
        continue;
      }
      if (c === ")") {
        if (acc === "" && ast.#parts.length === 0) {
          ast.#emptyExt = true;
        }
        part.push(acc);
        acc = "";
        ast.push(...parts, part);
        return i;
      }
      acc += c;
    }
    ast.type = null;
    ast.#hasMagic = void 0;
    ast.#parts = [str.substring(pos - 1)];
    return i;
  }
  #canAdoptWithSpace(child) {
    return this.#canAdopt(child, adoptionWithSpaceMap);
  }
  #canAdopt(child, map = adoptionMap) {
    if (!child || typeof child !== "object" || child.type !== null || child.#parts.length !== 1 || this.type === null) {
      return false;
    }
    const gc = child.#parts[0];
    if (!gc || typeof gc !== "object" || gc.type === null) {
      return false;
    }
    return this.#canAdoptType(gc.type, map);
  }
  #canAdoptType(c, map = adoptionAnyMap) {
    return !!map.get(this.type)?.includes(c);
  }
  #adoptWithSpace(child, index) {
    const gc = child.#parts[0];
    const blank = new _a(null, gc, this.options);
    blank.#parts.push("");
    gc.push(blank);
    this.#adopt(child, index);
  }
  #adopt(child, index) {
    const gc = child.#parts[0];
    this.#parts.splice(index, 1, ...gc.#parts);
    for (const p of gc.#parts) {
      if (typeof p === "object")
        p.#parent = this;
    }
    this.#toString = void 0;
  }
  #canUsurpType(c) {
    const m = usurpMap.get(this.type);
    return !!m?.has(c);
  }
  #canUsurp(child) {
    if (!child || typeof child !== "object" || child.type !== null || child.#parts.length !== 1 || this.type === null || this.#parts.length !== 1) {
      return false;
    }
    const gc = child.#parts[0];
    if (!gc || typeof gc !== "object" || gc.type === null) {
      return false;
    }
    return this.#canUsurpType(gc.type);
  }
  #usurp(child) {
    const m = usurpMap.get(this.type);
    const gc = child.#parts[0];
    const nt = m?.get(gc.type);
    if (!nt)
      return false;
    this.#parts = gc.#parts;
    for (const p of this.#parts) {
      if (typeof p === "object")
        p.#parent = this;
    }
    this.type = nt;
    this.#toString = void 0;
    this.#emptyExt = false;
  }
  #flatten() {
    if (!isExtglobAST(this)) {
      for (const p of this.#parts) {
        if (typeof p === "object")
          p.#flatten();
      }
    } else {
      let iterations = 0;
      let done = false;
      do {
        done = true;
        for (let i = 0; i < this.#parts.length; i++) {
          const c = this.#parts[i];
          if (typeof c === "object") {
            c.#flatten();
            if (this.#canAdopt(c)) {
              done = false;
              this.#adopt(c, i);
            } else if (this.#canAdoptWithSpace(c)) {
              done = false;
              this.#adoptWithSpace(c, i);
            } else if (this.#canUsurp(c)) {
              done = false;
              this.#usurp(c);
            }
          }
        }
      } while (!done && ++iterations < 10);
    }
    this.#toString = void 0;
  }
  static fromGlob(pattern, options = {}) {
    const ast = new _a(null, void 0, options);
    _a.#parseAST(pattern, ast, 0, options, 0);
    return ast;
  }
  // returns the regular expression if there's magic, or the unescaped
  // string if not.
  toMMPattern() {
    if (this !== this.#root)
      return this.#root.toMMPattern();
    const glob = this.toString();
    const [re, body, hasMagic, uflag] = this.toRegExpSource();
    const anyMagic = hasMagic || this.#hasMagic || this.#options.nocase && !this.#options.nocaseMagicOnly && glob.toUpperCase() !== glob.toLowerCase();
    if (!anyMagic) {
      return body;
    }
    const flags = (this.#options.nocase ? "i" : "") + (uflag ? "u" : "");
    return Object.assign(new RegExp(`^${re}$`, flags), {
      _src: re,
      _glob: glob
    });
  }
  get options() {
    return this.#options;
  }
  // returns the string match, the regexp source, whether there's magic
  // in the regexp (so a regular expression is required) and whether or
  // not the uflag is needed for the regular expression (for posix classes)
  // TODO: instead of injecting the start/end at this point, just return
  // the BODY of the regexp, along with the start/end portions suitable
  // for binding the start/end in either a joined full-path makeRe context
  // (where we bind to (^|/), or a standalone matchPart context (where
  // we bind to ^, and not /).  Otherwise slashes get duped!
  //
  // In part-matching mode, the start is:
  // - if not isStart: nothing
  // - if traversal possible, but not allowed: ^(?!\.\.?$)
  // - if dots allowed or not possible: ^
  // - if dots possible and not allowed: ^(?!\.)
  // end is:
  // - if not isEnd(): nothing
  // - else: $
  //
  // In full-path matching mode, we put the slash at the START of the
  // pattern, so start is:
  // - if first pattern: same as part-matching mode
  // - if not isStart(): nothing
  // - if traversal possible, but not allowed: /(?!\.\.?(?:$|/))
  // - if dots allowed or not possible: /
  // - if dots possible and not allowed: /(?!\.)
  // end is:
  // - if last pattern, same as part-matching mode
  // - else nothing
  //
  // Always put the (?:$|/) on negated tails, though, because that has to be
  // there to bind the end of the negated pattern portion, and it's easier to
  // just stick it in now rather than try to inject it later in the middle of
  // the pattern.
  //
  // We can just always return the same end, and leave it up to the caller
  // to know whether it's going to be used joined or in parts.
  // And, if the start is adjusted slightly, can do the same there:
  // - if not isStart: nothing
  // - if traversal possible, but not allowed: (?:/|^)(?!\.\.?$)
  // - if dots allowed or not possible: (?:/|^)
  // - if dots possible and not allowed: (?:/|^)(?!\.)
  //
  // But it's better to have a simpler binding without a conditional, for
  // performance, so probably better to return both start options.
  //
  // Then the caller just ignores the end if it's not the first pattern,
  // and the start always gets applied.
  //
  // But that's always going to be $ if it's the ending pattern, or nothing,
  // so the caller can just attach $ at the end of the pattern when building.
  //
  // So the todo is:
  // - better detect what kind of start is needed
  // - return both flavors of starting pattern
  // - attach $ at the end of the pattern when creating the actual RegExp
  //
  // Ah, but wait, no, that all only applies to the root when the first pattern
  // is not an extglob. If the first pattern IS an extglob, then we need all
  // that dot prevention biz to live in the extglob portions, because eg
  // +(*|.x*) can match .xy but not .yx.
  //
  // So, return the two flavors if it's #root and the first child is not an
  // AST, otherwise leave it to the child AST to handle it, and there,
  // use the (?:^|/) style of start binding.
  //
  // Even simplified further:
  // - Since the start for a join is eg /(?!\.) and the start for a part
  // is ^(?!\.), we can just prepend (?!\.) to the pattern (either root
  // or start or whatever) and prepend ^ or / at the Regexp construction.
  toRegExpSource(allowDot) {
    const dot = allowDot ?? !!this.#options.dot;
    if (this.#root === this) {
      this.#flatten();
      this.#fillNegs();
    }
    if (!isExtglobAST(this)) {
      const noEmpty = this.isStart() && this.isEnd();
      const src = this.#parts.map((p) => {
        const [re, _, hasMagic, uflag] = typeof p === "string" ? _a.#parseGlob(p, this.#hasMagic, noEmpty) : p.toRegExpSource(allowDot);
        this.#hasMagic = this.#hasMagic || hasMagic;
        this.#uflag = this.#uflag || uflag;
        return re;
      }).join("");
      let start2 = "";
      if (this.isStart()) {
        if (typeof this.#parts[0] === "string") {
          const dotTravAllowed = this.#parts.length === 1 && justDots.has(this.#parts[0]);
          if (!dotTravAllowed) {
            const aps = addPatternStart;
            const needNoTrav = (
              // dots are allowed, and the pattern starts with [ or .
              dot && aps.has(src.charAt(0)) || // the pattern starts with \., and then [ or .
              src.startsWith("\\.") && aps.has(src.charAt(2)) || // the pattern starts with \.\., and then [ or .
              src.startsWith("\\.\\.") && aps.has(src.charAt(4))
            );
            const needNoDot = !dot && !allowDot && aps.has(src.charAt(0));
            start2 = needNoTrav ? startNoTraversal : needNoDot ? startNoDot : "";
          }
        }
      }
      let end = "";
      if (this.isEnd() && this.#root.#filledNegs && this.#parent?.type === "!") {
        end = "(?:$|\\/)";
      }
      const final2 = start2 + src + end;
      return [
        final2,
        unescape(src),
        this.#hasMagic = !!this.#hasMagic,
        this.#uflag
      ];
    }
    const repeated = this.type === "*" || this.type === "+";
    const start = this.type === "!" ? "(?:(?!(?:" : "(?:";
    let body = this.#partsToRegExp(dot);
    if (this.isStart() && this.isEnd() && !body && this.type !== "!") {
      const s = this.toString();
      const me = this;
      me.#parts = [s];
      me.type = null;
      me.#hasMagic = void 0;
      return [s, unescape(this.toString()), false, false];
    }
    let bodyDotAllowed = !repeated || allowDot || dot || !startNoDot ? "" : this.#partsToRegExp(true);
    if (bodyDotAllowed === body) {
      bodyDotAllowed = "";
    }
    if (bodyDotAllowed) {
      body = `(?:${body})(?:${bodyDotAllowed})*?`;
    }
    let final = "";
    if (this.type === "!" && this.#emptyExt) {
      final = (this.isStart() && !dot ? startNoDot : "") + starNoEmpty;
    } else {
      const close = this.type === "!" ? (
        // !() must match something,but !(x) can match ''
        "))" + (this.isStart() && !dot && !allowDot ? startNoDot : "") + star + ")"
      ) : this.type === "@" ? ")" : this.type === "?" ? ")?" : this.type === "+" && bodyDotAllowed ? ")" : this.type === "*" && bodyDotAllowed ? `)?` : `)${this.type}`;
      final = start + body + close;
    }
    return [
      final,
      unescape(body),
      this.#hasMagic = !!this.#hasMagic,
      this.#uflag
    ];
  }
  #partsToRegExp(dot) {
    return this.#parts.map((p) => {
      if (typeof p === "string") {
        throw new Error("string type in extglob ast??");
      }
      const [re, _, _hasMagic, uflag] = p.toRegExpSource(dot);
      this.#uflag = this.#uflag || uflag;
      return re;
    }).filter((p) => !(this.isStart() && this.isEnd()) || !!p).join("|");
  }
  static #parseGlob(glob, hasMagic, noEmpty = false) {
    let escaping = false;
    let re = "";
    let uflag = false;
    let inStar = false;
    for (let i = 0; i < glob.length; i++) {
      const c = glob.charAt(i);
      if (escaping) {
        escaping = false;
        re += (reSpecials.has(c) ? "\\" : "") + c;
        inStar = false;
        continue;
      }
      if (c === "\\") {
        if (i === glob.length - 1) {
          re += "\\\\";
        } else {
          escaping = true;
        }
        continue;
      }
      if (c === "[") {
        const [src, needUflag, consumed, magic] = parseClass(glob, i);
        if (consumed) {
          re += src;
          uflag = uflag || needUflag;
          i += consumed - 1;
          hasMagic = hasMagic || magic;
          inStar = false;
          continue;
        }
      }
      if (c === "*") {
        if (inStar)
          continue;
        inStar = true;
        re += noEmpty && /^[*]+$/.test(glob) ? starNoEmpty : star;
        hasMagic = true;
        continue;
      } else {
        inStar = false;
      }
      if (c === "?") {
        re += qmark;
        hasMagic = true;
        continue;
      }
      re += regExpEscape(c);
    }
    return [re, unescape(glob), !!hasMagic, uflag];
  }
};
_a = AST;

// node_modules/minimatch/dist/esm/escape.js
var escape = (s, { windowsPathsNoEscape = false } = {}) => {
  return windowsPathsNoEscape ? s.replace(/[?*()[\]]/g, "[$&]") : s.replace(/[?*()[\]\\]/g, "\\$&");
};

// node_modules/minimatch/dist/esm/index.js
var minimatch = (p, pattern, options = {}) => {
  assertValidPattern(pattern);
  if (!options.nocomment && pattern.charAt(0) === "#") {
    return false;
  }
  return new Minimatch(pattern, options).match(p);
};
var starDotExtRE = /^\*+([^+@!?\*\[\(]*)$/;
var starDotExtTest = (ext2) => (f) => !f.startsWith(".") && f.endsWith(ext2);
var starDotExtTestDot = (ext2) => (f) => f.endsWith(ext2);
var starDotExtTestNocase = (ext2) => {
  ext2 = ext2.toLowerCase();
  return (f) => !f.startsWith(".") && f.toLowerCase().endsWith(ext2);
};
var starDotExtTestNocaseDot = (ext2) => {
  ext2 = ext2.toLowerCase();
  return (f) => f.toLowerCase().endsWith(ext2);
};
var starDotStarRE = /^\*+\.\*+$/;
var starDotStarTest = (f) => !f.startsWith(".") && f.includes(".");
var starDotStarTestDot = (f) => f !== "." && f !== ".." && f.includes(".");
var dotStarRE = /^\.\*+$/;
var dotStarTest = (f) => f !== "." && f !== ".." && f.startsWith(".");
var starRE = /^\*+$/;
var starTest = (f) => f.length !== 0 && !f.startsWith(".");
var starTestDot = (f) => f.length !== 0 && f !== "." && f !== "..";
var qmarksRE = /^\?+([^+@!?\*\[\(]*)?$/;
var qmarksTestNocase = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExt([$0]);
  if (!ext2)
    return noext;
  ext2 = ext2.toLowerCase();
  return (f) => noext(f) && f.toLowerCase().endsWith(ext2);
};
var qmarksTestNocaseDot = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExtDot([$0]);
  if (!ext2)
    return noext;
  ext2 = ext2.toLowerCase();
  return (f) => noext(f) && f.toLowerCase().endsWith(ext2);
};
var qmarksTestDot = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExtDot([$0]);
  return !ext2 ? noext : (f) => noext(f) && f.endsWith(ext2);
};
var qmarksTest = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExt([$0]);
  return !ext2 ? noext : (f) => noext(f) && f.endsWith(ext2);
};
var qmarksTestNoExt = ([$0]) => {
  const len = $0.length;
  return (f) => f.length === len && !f.startsWith(".");
};
var qmarksTestNoExtDot = ([$0]) => {
  const len = $0.length;
  return (f) => f.length === len && f !== "." && f !== "..";
};
var defaultPlatform = typeof process === "object" && process ? typeof process.env === "object" && process.env && process.env.__MINIMATCH_TESTING_PLATFORM__ || process.platform : "posix";
var path = {
  win32: { sep: "\\" },
  posix: { sep: "/" }
};
var sep = defaultPlatform === "win32" ? path.win32.sep : path.posix.sep;
minimatch.sep = sep;
var GLOBSTAR = Symbol("globstar **");
minimatch.GLOBSTAR = GLOBSTAR;
var qmark2 = "[^/]";
var star2 = qmark2 + "*?";
var twoStarDot = "(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?";
var twoStarNoDot = "(?:(?!(?:\\/|^)\\.).)*?";
var filter = (pattern, options = {}) => (p) => minimatch(p, pattern, options);
minimatch.filter = filter;
var ext = (a, b = {}) => Object.assign({}, a, b);
var defaults = (def) => {
  if (!def || typeof def !== "object" || !Object.keys(def).length) {
    return minimatch;
  }
  const orig = minimatch;
  const m = (p, pattern, options = {}) => orig(p, pattern, ext(def, options));
  return Object.assign(m, {
    Minimatch: class Minimatch extends orig.Minimatch {
      constructor(pattern, options = {}) {
        super(pattern, ext(def, options));
      }
      static defaults(options) {
        return orig.defaults(ext(def, options)).Minimatch;
      }
    },
    AST: class AST extends orig.AST {
      /* c8 ignore start */
      constructor(type, parent, options = {}) {
        super(type, parent, ext(def, options));
      }
      /* c8 ignore stop */
      static fromGlob(pattern, options = {}) {
        return orig.AST.fromGlob(pattern, ext(def, options));
      }
    },
    unescape: (s, options = {}) => orig.unescape(s, ext(def, options)),
    escape: (s, options = {}) => orig.escape(s, ext(def, options)),
    filter: (pattern, options = {}) => orig.filter(pattern, ext(def, options)),
    defaults: (options) => orig.defaults(ext(def, options)),
    makeRe: (pattern, options = {}) => orig.makeRe(pattern, ext(def, options)),
    braceExpand: (pattern, options = {}) => orig.braceExpand(pattern, ext(def, options)),
    match: (list, pattern, options = {}) => orig.match(list, pattern, ext(def, options)),
    sep: orig.sep,
    GLOBSTAR
  });
};
minimatch.defaults = defaults;
var braceExpand = (pattern, options = {}) => {
  assertValidPattern(pattern);
  if (options.nobrace || !/\{(?:(?!\{).)*\}/.test(pattern)) {
    return [pattern];
  }
  return (0, import_brace_expansion.default)(pattern);
};
minimatch.braceExpand = braceExpand;
var makeRe = (pattern, options = {}) => new Minimatch(pattern, options).makeRe();
minimatch.makeRe = makeRe;
var match = (list, pattern, options = {}) => {
  const mm = new Minimatch(pattern, options);
  list = list.filter((f) => mm.match(f));
  if (mm.options.nonull && !list.length) {
    list.push(pattern);
  }
  return list;
};
minimatch.match = match;
var globMagic = /[?*]|[+@!]\(.*?\)|\[|\]/;
var regExpEscape2 = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var Minimatch = class {
  options;
  set;
  pattern;
  windowsPathsNoEscape;
  nonegate;
  negate;
  comment;
  empty;
  preserveMultipleSlashes;
  partial;
  globSet;
  globParts;
  nocase;
  isWindows;
  platform;
  windowsNoMagicRoot;
  maxGlobstarRecursion;
  regexp;
  constructor(pattern, options = {}) {
    assertValidPattern(pattern);
    options = options || {};
    this.options = options;
    this.maxGlobstarRecursion = options.maxGlobstarRecursion ?? 200;
    this.pattern = pattern;
    this.platform = options.platform || defaultPlatform;
    this.isWindows = this.platform === "win32";
    this.windowsPathsNoEscape = !!options.windowsPathsNoEscape || options.allowWindowsEscape === false;
    if (this.windowsPathsNoEscape) {
      this.pattern = this.pattern.replace(/\\/g, "/");
    }
    this.preserveMultipleSlashes = !!options.preserveMultipleSlashes;
    this.regexp = null;
    this.negate = false;
    this.nonegate = !!options.nonegate;
    this.comment = false;
    this.empty = false;
    this.partial = !!options.partial;
    this.nocase = !!this.options.nocase;
    this.windowsNoMagicRoot = options.windowsNoMagicRoot !== void 0 ? options.windowsNoMagicRoot : !!(this.isWindows && this.nocase);
    this.globSet = [];
    this.globParts = [];
    this.set = [];
    this.make();
  }
  hasMagic() {
    if (this.options.magicalBraces && this.set.length > 1) {
      return true;
    }
    for (const pattern of this.set) {
      for (const part of pattern) {
        if (typeof part !== "string")
          return true;
      }
    }
    return false;
  }
  debug(..._) {
  }
  make() {
    const pattern = this.pattern;
    const options = this.options;
    if (!options.nocomment && pattern.charAt(0) === "#") {
      this.comment = true;
      return;
    }
    if (!pattern) {
      this.empty = true;
      return;
    }
    this.parseNegate();
    this.globSet = [...new Set(this.braceExpand())];
    if (options.debug) {
      this.debug = (...args) => console.error(...args);
    }
    this.debug(this.pattern, this.globSet);
    const rawGlobParts = this.globSet.map((s) => this.slashSplit(s));
    this.globParts = this.preprocess(rawGlobParts);
    this.debug(this.pattern, this.globParts);
    let set = this.globParts.map((s, _, __) => {
      if (this.isWindows && this.windowsNoMagicRoot) {
        const isUNC = s[0] === "" && s[1] === "" && (s[2] === "?" || !globMagic.test(s[2])) && !globMagic.test(s[3]);
        const isDrive = /^[a-z]:/i.test(s[0]);
        if (isUNC) {
          return [...s.slice(0, 4), ...s.slice(4).map((ss) => this.parse(ss))];
        } else if (isDrive) {
          return [s[0], ...s.slice(1).map((ss) => this.parse(ss))];
        }
      }
      return s.map((ss) => this.parse(ss));
    });
    this.debug(this.pattern, set);
    this.set = set.filter((s) => s.indexOf(false) === -1);
    if (this.isWindows) {
      for (let i = 0; i < this.set.length; i++) {
        const p = this.set[i];
        if (p[0] === "" && p[1] === "" && this.globParts[i][2] === "?" && typeof p[3] === "string" && /^[a-z]:$/i.test(p[3])) {
          p[2] = "?";
        }
      }
    }
    this.debug(this.pattern, this.set);
  }
  // various transforms to equivalent pattern sets that are
  // faster to process in a filesystem walk.  The goal is to
  // eliminate what we can, and push all ** patterns as far
  // to the right as possible, even if it increases the number
  // of patterns that we have to process.
  preprocess(globParts) {
    if (this.options.noglobstar) {
      for (let i = 0; i < globParts.length; i++) {
        for (let j = 0; j < globParts[i].length; j++) {
          if (globParts[i][j] === "**") {
            globParts[i][j] = "*";
          }
        }
      }
    }
    const { optimizationLevel = 1 } = this.options;
    if (optimizationLevel >= 2) {
      globParts = this.firstPhasePreProcess(globParts);
      globParts = this.secondPhasePreProcess(globParts);
    } else if (optimizationLevel >= 1) {
      globParts = this.levelOneOptimize(globParts);
    } else {
      globParts = this.adjascentGlobstarOptimize(globParts);
    }
    return globParts;
  }
  // just get rid of adjascent ** portions
  adjascentGlobstarOptimize(globParts) {
    return globParts.map((parts) => {
      let gs = -1;
      while (-1 !== (gs = parts.indexOf("**", gs + 1))) {
        let i = gs;
        while (parts[i + 1] === "**") {
          i++;
        }
        if (i !== gs) {
          parts.splice(gs, i - gs);
        }
      }
      return parts;
    });
  }
  // get rid of adjascent ** and resolve .. portions
  levelOneOptimize(globParts) {
    return globParts.map((parts) => {
      parts = parts.reduce((set, part) => {
        const prev = set[set.length - 1];
        if (part === "**" && prev === "**") {
          return set;
        }
        if (part === "..") {
          if (prev && prev !== ".." && prev !== "." && prev !== "**") {
            set.pop();
            return set;
          }
        }
        set.push(part);
        return set;
      }, []);
      return parts.length === 0 ? [""] : parts;
    });
  }
  levelTwoFileOptimize(parts) {
    if (!Array.isArray(parts)) {
      parts = this.slashSplit(parts);
    }
    let didSomething = false;
    do {
      didSomething = false;
      if (!this.preserveMultipleSlashes) {
        for (let i = 1; i < parts.length - 1; i++) {
          const p = parts[i];
          if (i === 1 && p === "" && parts[0] === "")
            continue;
          if (p === "." || p === "") {
            didSomething = true;
            parts.splice(i, 1);
            i--;
          }
        }
        if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
          didSomething = true;
          parts.pop();
        }
      }
      let dd = 0;
      while (-1 !== (dd = parts.indexOf("..", dd + 1))) {
        const p = parts[dd - 1];
        if (p && p !== "." && p !== ".." && p !== "**") {
          didSomething = true;
          parts.splice(dd - 1, 2);
          dd -= 2;
        }
      }
    } while (didSomething);
    return parts.length === 0 ? [""] : parts;
  }
  // First phase: single-pattern processing
  // <pre> is 1 or more portions
  // <rest> is 1 or more portions
  // <p> is any portion other than ., .., '', or **
  // <e> is . or ''
  //
  // **/.. is *brutal* for filesystem walking performance, because
  // it effectively resets the recursive walk each time it occurs,
  // and ** cannot be reduced out by a .. pattern part like a regexp
  // or most strings (other than .., ., and '') can be.
  //
  // <pre>/**/../<p>/<p>/<rest> -> {<pre>/../<p>/<p>/<rest>,<pre>/**/<p>/<p>/<rest>}
  // <pre>/<e>/<rest> -> <pre>/<rest>
  // <pre>/<p>/../<rest> -> <pre>/<rest>
  // **/**/<rest> -> **/<rest>
  //
  // **/*/<rest> -> */**/<rest> <== not valid because ** doesn't follow
  // this WOULD be allowed if ** did follow symlinks, or * didn't
  firstPhasePreProcess(globParts) {
    let didSomething = false;
    do {
      didSomething = false;
      for (let parts of globParts) {
        let gs = -1;
        while (-1 !== (gs = parts.indexOf("**", gs + 1))) {
          let gss = gs;
          while (parts[gss + 1] === "**") {
            gss++;
          }
          if (gss > gs) {
            parts.splice(gs + 1, gss - gs);
          }
          let next = parts[gs + 1];
          const p = parts[gs + 2];
          const p2 = parts[gs + 3];
          if (next !== "..")
            continue;
          if (!p || p === "." || p === ".." || !p2 || p2 === "." || p2 === "..") {
            continue;
          }
          didSomething = true;
          parts.splice(gs, 1);
          const other = parts.slice(0);
          other[gs] = "**";
          globParts.push(other);
          gs--;
        }
        if (!this.preserveMultipleSlashes) {
          for (let i = 1; i < parts.length - 1; i++) {
            const p = parts[i];
            if (i === 1 && p === "" && parts[0] === "")
              continue;
            if (p === "." || p === "") {
              didSomething = true;
              parts.splice(i, 1);
              i--;
            }
          }
          if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
            didSomething = true;
            parts.pop();
          }
        }
        let dd = 0;
        while (-1 !== (dd = parts.indexOf("..", dd + 1))) {
          const p = parts[dd - 1];
          if (p && p !== "." && p !== ".." && p !== "**") {
            didSomething = true;
            const needDot = dd === 1 && parts[dd + 1] === "**";
            const splin = needDot ? ["."] : [];
            parts.splice(dd - 1, 2, ...splin);
            if (parts.length === 0)
              parts.push("");
            dd -= 2;
          }
        }
      }
    } while (didSomething);
    return globParts;
  }
  // second phase: multi-pattern dedupes
  // {<pre>/*/<rest>,<pre>/<p>/<rest>} -> <pre>/*/<rest>
  // {<pre>/<rest>,<pre>/<rest>} -> <pre>/<rest>
  // {<pre>/**/<rest>,<pre>/<rest>} -> <pre>/**/<rest>
  //
  // {<pre>/**/<rest>,<pre>/**/<p>/<rest>} -> <pre>/**/<rest>
  // ^-- not valid because ** doens't follow symlinks
  secondPhasePreProcess(globParts) {
    for (let i = 0; i < globParts.length - 1; i++) {
      for (let j = i + 1; j < globParts.length; j++) {
        const matched = this.partsMatch(globParts[i], globParts[j], !this.preserveMultipleSlashes);
        if (matched) {
          globParts[i] = [];
          globParts[j] = matched;
          break;
        }
      }
    }
    return globParts.filter((gs) => gs.length);
  }
  partsMatch(a, b, emptyGSMatch = false) {
    let ai = 0;
    let bi = 0;
    let result = [];
    let which = "";
    while (ai < a.length && bi < b.length) {
      if (a[ai] === b[bi]) {
        result.push(which === "b" ? b[bi] : a[ai]);
        ai++;
        bi++;
      } else if (emptyGSMatch && a[ai] === "**" && b[bi] === a[ai + 1]) {
        result.push(a[ai]);
        ai++;
      } else if (emptyGSMatch && b[bi] === "**" && a[ai] === b[bi + 1]) {
        result.push(b[bi]);
        bi++;
      } else if (a[ai] === "*" && b[bi] && (this.options.dot || !b[bi].startsWith(".")) && b[bi] !== "**") {
        if (which === "b")
          return false;
        which = "a";
        result.push(a[ai]);
        ai++;
        bi++;
      } else if (b[bi] === "*" && a[ai] && (this.options.dot || !a[ai].startsWith(".")) && a[ai] !== "**") {
        if (which === "a")
          return false;
        which = "b";
        result.push(b[bi]);
        ai++;
        bi++;
      } else {
        return false;
      }
    }
    return a.length === b.length && result;
  }
  parseNegate() {
    if (this.nonegate)
      return;
    const pattern = this.pattern;
    let negate = false;
    let negateOffset = 0;
    for (let i = 0; i < pattern.length && pattern.charAt(i) === "!"; i++) {
      negate = !negate;
      negateOffset++;
    }
    if (negateOffset)
      this.pattern = pattern.slice(negateOffset);
    this.negate = negate;
  }
  // set partial to true to test if, for example,
  // "/a/b" matches the start of "/*/b/*/d"
  // Partial means, if you run out of file before you run
  // out of pattern, then that's fine, as long as all
  // the parts match.
  matchOne(file, pattern, partial = false) {
    let fileStartIndex = 0;
    let patternStartIndex = 0;
    if (this.isWindows) {
      const fileDrive = typeof file[0] === "string" && /^[a-z]:$/i.test(file[0]);
      const fileUNC = !fileDrive && file[0] === "" && file[1] === "" && file[2] === "?" && /^[a-z]:$/i.test(file[3]);
      const patternDrive = typeof pattern[0] === "string" && /^[a-z]:$/i.test(pattern[0]);
      const patternUNC = !patternDrive && pattern[0] === "" && pattern[1] === "" && pattern[2] === "?" && typeof pattern[3] === "string" && /^[a-z]:$/i.test(pattern[3]);
      const fdi = fileUNC ? 3 : fileDrive ? 0 : void 0;
      const pdi = patternUNC ? 3 : patternDrive ? 0 : void 0;
      if (typeof fdi === "number" && typeof pdi === "number") {
        const [fd, pd] = [
          file[fdi],
          pattern[pdi]
        ];
        if (fd.toLowerCase() === pd.toLowerCase()) {
          pattern[pdi] = fd;
          patternStartIndex = pdi;
          fileStartIndex = fdi;
        }
      }
    }
    const { optimizationLevel = 1 } = this.options;
    if (optimizationLevel >= 2) {
      file = this.levelTwoFileOptimize(file);
    }
    if (pattern.includes(GLOBSTAR)) {
      return this.#matchGlobstar(file, pattern, partial, fileStartIndex, patternStartIndex);
    }
    return this.#matchOne(file, pattern, partial, fileStartIndex, patternStartIndex);
  }
  #matchGlobstar(file, pattern, partial, fileIndex, patternIndex) {
    const firstgs = pattern.indexOf(GLOBSTAR, patternIndex);
    const lastgs = pattern.lastIndexOf(GLOBSTAR);
    const [head, body, tail] = partial ? [
      pattern.slice(patternIndex, firstgs),
      pattern.slice(firstgs + 1),
      []
    ] : [
      pattern.slice(patternIndex, firstgs),
      pattern.slice(firstgs + 1, lastgs),
      pattern.slice(lastgs + 1)
    ];
    if (head.length) {
      const fileHead = file.slice(fileIndex, fileIndex + head.length);
      if (!this.#matchOne(fileHead, head, partial, 0, 0))
        return false;
      fileIndex += head.length;
    }
    let fileTailMatch = 0;
    if (tail.length) {
      if (tail.length + fileIndex > file.length)
        return false;
      let tailStart = file.length - tail.length;
      if (this.#matchOne(file, tail, partial, tailStart, 0)) {
        fileTailMatch = tail.length;
      } else {
        if (file[file.length - 1] !== "" || fileIndex + tail.length === file.length) {
          return false;
        }
        tailStart--;
        if (!this.#matchOne(file, tail, partial, tailStart, 0))
          return false;
        fileTailMatch = tail.length + 1;
      }
    }
    if (!body.length) {
      let sawSome = !!fileTailMatch;
      for (let i2 = fileIndex; i2 < file.length - fileTailMatch; i2++) {
        const f = String(file[i2]);
        sawSome = true;
        if (f === "." || f === ".." || !this.options.dot && f.startsWith(".")) {
          return false;
        }
      }
      return partial || sawSome;
    }
    const bodySegments = [[[], 0]];
    let currentBody = bodySegments[0];
    let nonGsParts = 0;
    const nonGsPartsSums = [0];
    for (const b of body) {
      if (b === GLOBSTAR) {
        nonGsPartsSums.push(nonGsParts);
        currentBody = [[], 0];
        bodySegments.push(currentBody);
      } else {
        currentBody[0].push(b);
        nonGsParts++;
      }
    }
    let i = bodySegments.length - 1;
    const fileLength = file.length - fileTailMatch;
    for (const b of bodySegments) {
      b[1] = fileLength - (nonGsPartsSums[i--] + b[0].length);
    }
    return !!this.#matchGlobStarBodySections(file, bodySegments, fileIndex, 0, partial, 0, !!fileTailMatch);
  }
  #matchGlobStarBodySections(file, bodySegments, fileIndex, bodyIndex, partial, globStarDepth, sawTail) {
    const bs = bodySegments[bodyIndex];
    if (!bs) {
      for (let i = fileIndex; i < file.length; i++) {
        sawTail = true;
        const f = file[i];
        if (f === "." || f === ".." || !this.options.dot && f.startsWith(".")) {
          return false;
        }
      }
      return sawTail;
    }
    const [body, after] = bs;
    while (fileIndex <= after) {
      const m = this.#matchOne(file.slice(0, fileIndex + body.length), body, partial, fileIndex, 0);
      if (m && globStarDepth < this.maxGlobstarRecursion) {
        const sub = this.#matchGlobStarBodySections(file, bodySegments, fileIndex + body.length, bodyIndex + 1, partial, globStarDepth + 1, sawTail);
        if (sub !== false)
          return sub;
      }
      const f = file[fileIndex];
      if (f === "." || f === ".." || !this.options.dot && f.startsWith(".")) {
        return false;
      }
      fileIndex++;
    }
    return partial || null;
  }
  #matchOne(file, pattern, partial, fileIndex, patternIndex) {
    let fi;
    let pi;
    let pl;
    let fl;
    for (fi = fileIndex, pi = patternIndex, fl = file.length, pl = pattern.length; fi < fl && pi < pl; fi++, pi++) {
      this.debug("matchOne loop");
      let p = pattern[pi];
      let f = file[fi];
      this.debug(pattern, p, f);
      if (p === false || p === GLOBSTAR)
        return false;
      let hit;
      if (typeof p === "string") {
        hit = f === p;
        this.debug("string match", p, f, hit);
      } else {
        hit = p.test(f);
        this.debug("pattern match", p, f, hit);
      }
      if (!hit)
        return false;
    }
    if (fi === fl && pi === pl) {
      return true;
    } else if (fi === fl) {
      return partial;
    } else if (pi === pl) {
      return fi === fl - 1 && file[fi] === "";
    } else {
      throw new Error("wtf?");
    }
  }
  braceExpand() {
    return braceExpand(this.pattern, this.options);
  }
  parse(pattern) {
    assertValidPattern(pattern);
    const options = this.options;
    if (pattern === "**")
      return GLOBSTAR;
    if (pattern === "")
      return "";
    let m;
    let fastTest = null;
    if (m = pattern.match(starRE)) {
      fastTest = options.dot ? starTestDot : starTest;
    } else if (m = pattern.match(starDotExtRE)) {
      fastTest = (options.nocase ? options.dot ? starDotExtTestNocaseDot : starDotExtTestNocase : options.dot ? starDotExtTestDot : starDotExtTest)(m[1]);
    } else if (m = pattern.match(qmarksRE)) {
      fastTest = (options.nocase ? options.dot ? qmarksTestNocaseDot : qmarksTestNocase : options.dot ? qmarksTestDot : qmarksTest)(m);
    } else if (m = pattern.match(starDotStarRE)) {
      fastTest = options.dot ? starDotStarTestDot : starDotStarTest;
    } else if (m = pattern.match(dotStarRE)) {
      fastTest = dotStarTest;
    }
    const re = AST.fromGlob(pattern, this.options).toMMPattern();
    if (fastTest && typeof re === "object") {
      Reflect.defineProperty(re, "test", { value: fastTest });
    }
    return re;
  }
  makeRe() {
    if (this.regexp || this.regexp === false)
      return this.regexp;
    const set = this.set;
    if (!set.length) {
      this.regexp = false;
      return this.regexp;
    }
    const options = this.options;
    const twoStar = options.noglobstar ? star2 : options.dot ? twoStarDot : twoStarNoDot;
    const flags = new Set(options.nocase ? ["i"] : []);
    let re = set.map((pattern) => {
      const pp = pattern.map((p) => {
        if (p instanceof RegExp) {
          for (const f of p.flags.split(""))
            flags.add(f);
        }
        return typeof p === "string" ? regExpEscape2(p) : p === GLOBSTAR ? GLOBSTAR : p._src;
      });
      pp.forEach((p, i) => {
        const next = pp[i + 1];
        const prev = pp[i - 1];
        if (p !== GLOBSTAR || prev === GLOBSTAR) {
          return;
        }
        if (prev === void 0) {
          if (next !== void 0 && next !== GLOBSTAR) {
            pp[i + 1] = "(?:\\/|" + twoStar + "\\/)?" + next;
          } else {
            pp[i] = twoStar;
          }
        } else if (next === void 0) {
          pp[i - 1] = prev + "(?:\\/|" + twoStar + ")?";
        } else if (next !== GLOBSTAR) {
          pp[i - 1] = prev + "(?:\\/|\\/" + twoStar + "\\/)" + next;
          pp[i + 1] = GLOBSTAR;
        }
      });
      return pp.filter((p) => p !== GLOBSTAR).join("/");
    }).join("|");
    const [open, close] = set.length > 1 ? ["(?:", ")"] : ["", ""];
    re = "^" + open + re + close + "$";
    if (this.negate)
      re = "^(?!" + re + ").+$";
    try {
      this.regexp = new RegExp(re, [...flags].join(""));
    } catch (ex) {
      this.regexp = false;
    }
    return this.regexp;
  }
  slashSplit(p) {
    if (this.preserveMultipleSlashes) {
      return p.split("/");
    } else if (this.isWindows && /^\/\/[^\/]+/.test(p)) {
      return ["", ...p.split(/\/+/)];
    } else {
      return p.split(/\/+/);
    }
  }
  match(f, partial = this.partial) {
    this.debug("match", f, this.pattern);
    if (this.comment) {
      return false;
    }
    if (this.empty) {
      return f === "";
    }
    if (f === "/" && partial) {
      return true;
    }
    const options = this.options;
    if (this.isWindows) {
      f = f.split("\\").join("/");
    }
    const ff = this.slashSplit(f);
    this.debug(this.pattern, "split", ff);
    const set = this.set;
    this.debug(this.pattern, "set", set);
    let filename = ff[ff.length - 1];
    if (!filename) {
      for (let i = ff.length - 2; !filename && i >= 0; i--) {
        filename = ff[i];
      }
    }
    for (let i = 0; i < set.length; i++) {
      const pattern = set[i];
      let file = ff;
      if (options.matchBase && pattern.length === 1) {
        file = [filename];
      }
      const hit = this.matchOne(file, pattern, partial);
      if (hit) {
        if (options.flipNegate) {
          return true;
        }
        return !this.negate;
      }
    }
    if (options.flipNegate) {
      return false;
    }
    return this.negate;
  }
  static defaults(def) {
    return minimatch.defaults(def).Minimatch;
  }
};
minimatch.AST = AST;
minimatch.Minimatch = Minimatch;
minimatch.escape = escape;
minimatch.unescape = unescape;

// src/core/paths.ts
var path2 = __toESM(require("node:path"));
function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}
function localRelative(root, target) {
  return toPosixPath(path2.relative(root, target));
}
function isInsideOrEqual(root, target) {
  const relative2 = path2.relative(root, target);
  return relative2 === "" || !relative2.startsWith("..") && !path2.isAbsolute(relative2);
}
function selectionRemoteBase(options) {
  const { localPath, workspaceRoot, mode } = options;
  if (mode === "workspaceRelative" && workspaceRoot && isInsideOrEqual(workspaceRoot, localPath)) {
    return localRelative(workspaceRoot, localPath);
  }
  return path2.basename(localPath);
}
function childRemoteBase(selectionBase, selectionRoot, childLocal) {
  const relative2 = localRelative(selectionRoot, childLocal);
  return joinRemotePath(selectionBase, relative2);
}

// src/core/exclude.ts
var DEFAULT_EXCLUDES = [
  "**/.git/**",
  "**/.ipynb_checkpoints/**",
  "**/__pycache__/**",
  "**/.venv/**",
  "**/venv/**",
  "**/node_modules/**",
  "**/*.pyc"
];
function isExcluded(relativePath, patterns, isDirectory = false) {
  const relative2 = toPosixPath(relativePath).replace(/^\/+/, "");
  if (!relative2 || patterns.length === 0) {
    return false;
  }
  for (const rawPattern of patterns) {
    const pattern = rawPattern.trim();
    if (!pattern) {
      continue;
    }
    if (matches(relative2, pattern)) {
      return true;
    }
    if (isDirectory && matches(`${relative2}/__kaggle_connector_probe__`, pattern)) {
      return true;
    }
  }
  return false;
}
function matches(value, pattern) {
  return minimatch(value, pattern, {
    dot: true,
    matchBase: true,
    nocase: process.platform === "win32"
  });
}

// src/config.ts
var SECRET_KEY = "kaggleConnector.serverUrl";
function configuration() {
  return vscode.workspace.getConfiguration("kaggleConnector");
}
function getRemoteDir() {
  return normalizeRemotePath(configuration().get("remoteDir", ""));
}
function getPathMode() {
  return configuration().get("pathMode", "workspaceRelative") === "basename" ? "basename" : "workspaceRelative";
}
function getExclude() {
  const value = configuration().get("exclude", DEFAULT_EXCLUDES);
  if (!Array.isArray(value)) {
    return [...DEFAULT_EXCLUDES];
  }
  return value.filter((entry) => typeof entry === "string");
}
function getMaxFileSizeMB() {
  const value = configuration().get("maxFileSizeMB", 100);
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 100;
}
function getConcurrency() {
  const value = configuration().get("concurrency", 4);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 4;
  }
  return Math.min(16, Math.max(1, Math.floor(value)));
}
function getTimeoutMs() {
  const value = configuration().get("requestTimeoutMs", 12e4);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 12e4;
  }
  return Math.max(5e3, Math.floor(value));
}
function getProbeTimeoutMs() {
  const value = configuration().get("sessionProbeTimeoutMs", 5e3);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 5e3;
  }
  return Math.max(1e3, Math.floor(value));
}
function getRemoteUploadDebounceMs() {
  const value = configuration().get("remoteUploadDebounceMs", 5e3);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 5e3;
  }
  return Math.max(0, Math.floor(value));
}
function getRemoteUploadMaxDelayMs() {
  const value = configuration().get("remoteUploadMaxDelayMs", 12e4);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 12e4;
  }
  return Math.max(1e3, Math.floor(value));
}
function getProxySetting() {
  return configuration().get("proxy", "") ?? "";
}
function getSkipUnchanged() {
  const value = configuration().get("skipUnchanged", true);
  return typeof value === "boolean" ? value : true;
}
function getConflictPolicy() {
  const value = configuration().get("conflictPolicy", "ask");
  return value === "overwrite" || value === "skipNewer" ? value : "ask";
}
function getRetryCount() {
  const value = configuration().get("retryCount", 2);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 2;
  }
  return Math.min(5, Math.max(0, Math.floor(value)));
}
function getKeepAliveEnabled() {
  const value = configuration().get("keepAlive", true);
  return typeof value === "boolean" ? value : true;
}
function getKeepAliveIntervalMinutes() {
  const value = configuration().get("keepAliveIntervalMinutes", 10);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 10;
  }
  return Math.min(30, Math.max(1, Math.floor(value)));
}
function getAutoCdRemoteDir() {
  const value = configuration().get("autoCdRemoteDir", true);
  return typeof value === "boolean" ? value : true;
}
async function updateSetting(key, value) {
  const target = vscode.workspace.workspaceFolders?.length ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
  await configuration().update(key, value, target);
}
async function setRemoteDir(value) {
  const normalized = normalizeRemotePath(value);
  if (!normalized) {
    throw new KaggleError("badRequest", "\u5DE5\u4F5C\u76EE\u5F55\u4E0D\u80FD\u4E3A\u7A7A", {
      hint: "\u586B\u5199\u4E00\u4E2A\u53EF\u5199\u76EE\u5F55\uFF0C\u4F8B\u5982 news_recommender\uFF1BKaggle \u4E0A\u5B9E\u9645\u4F4D\u4E8E /kaggle/working\u3002"
    });
  }
  await updateSetting("remoteDir", normalized);
}
async function setPathMode(value) {
  await updateSetting("pathMode", value === "basename" ? "basename" : "workspaceRelative");
}

// src/core/connectionState.ts
var ConnectionState = class {
  connectedValue = false;
  currentUrl = "";
  generation = 0;
  probeSeq = 0;
  listeners = /* @__PURE__ */ new Set();
  get connected() {
    return this.connectedValue;
  }
  /** The normalized URL currently treated as persisted ('' when unset). */
  get url() {
    return this.currentUrl;
  }
  get urlGeneration() {
    return this.generation;
  }
  onDidChange(listener) {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }
  /**
   * Point the state at a persisted URL. A changed URL (or clearing it) resets
   * the connection to false and invalidates every ticket handed out before.
   */
  syncUrl(url) {
    if (url === this.currentUrl) {
      return;
    }
    this.currentUrl = url;
    this.generation += 1;
    this.probeSeq = 0;
    this.setConnected(false);
  }
  /** Snapshot for a state-changing operation that is not a probe. */
  captureTicket() {
    return { generation: this.generation, url: this.currentUrl };
  }
  /** Start a probe for `url`; returns undefined when there is no URL. */
  beginProbe(url) {
    this.syncUrl(url);
    if (!this.currentUrl) {
      return void 0;
    }
    this.probeSeq += 1;
    return {
      generation: this.generation,
      url: this.currentUrl,
      probeSeq: this.probeSeq
    };
  }
  /** Apply a probe result unless a newer URL/probe has superseded it. */
  completeProbe(ticket, alive) {
    if (!this.isCurrentProbe(ticket)) {
      return false;
    }
    this.setConnected(alive);
    return true;
  }
  /** Mark connected after a non-probe operation succeeded. */
  markConnected(ticket) {
    if (!this.isCurrentOperation(ticket)) {
      return false;
    }
    this.probeSeq += 1;
    this.setConnected(true);
    return true;
  }
  /** Mark disconnected after a connection-typed error. */
  markDisconnected(ticket) {
    if (ticket && !this.isCurrentOperation(ticket)) {
      return false;
    }
    this.probeSeq += 1;
    this.setConnected(false);
    return true;
  }
  isCurrentOperation(ticket) {
    return ticket.generation === this.generation && ticket.url === this.currentUrl;
  }
  isCurrentProbe(ticket) {
    return this.isCurrentOperation(ticket) && ticket.probeSeq === this.probeSeq;
  }
  setConnected(value) {
    if (this.connectedValue === value) {
      return;
    }
    this.connectedValue = value;
    for (const listener of this.listeners) {
      listener(value);
    }
  }
};

// src/jupyter.ts
var vscode2 = __toESM(require("vscode"));

// src/core/version.ts
function versionAtLeast(version, major, minor) {
  const match2 = /^\s*v?(\d+)\.(\d+)/.exec(version ?? "");
  if (!match2) {
    return false;
  }
  const actualMajor = Number(match2[1]);
  const actualMinor = Number(match2[2]);
  if (actualMajor !== major) {
    return actualMajor > major;
  }
  return actualMinor >= minor;
}

// src/jupyter.ts
var JUPYTER_EXTENSION_ID = "ms-toolsai.jupyter";
var SERVER_COLLECTION_ID = "kaggle-connector";
var SERVER_COLLECTION_LABEL = "Kaggle Connector";
var SERVER_LABEL_PREFIX = "Kaggle Jupyter Server";
var KaggleJupyterServers = class {
  constructor(options) {
    this.options = options;
  }
  changes = new vscode2.EventEmitter();
  onDidChangeServers = this.changes.event;
  /** Normalized URL; undefined until first read from SecretStorage. */
  url;
  urlLoad;
  collection;
  registering;
  wantsRegistration = false;
  promptOffered = false;
  installWatcher;
  disposed = false;
  /** Update the cached URL on every persisted URL change. */
  setUrl(url) {
    if (this.disposed) {
      return;
    }
    const next = (url ?? "").trim();
    if (next === this.url) {
      return;
    }
    this.url = next;
    if (this.collection) {
      this.changes.fire();
    }
  }
  provideJupyterServers(_token) {
    const server = this.currentServer();
    return server ? [server] : [];
  }
  resolveJupyterServer(server, _token) {
    const current = this.currentServer();
    if (!current || server.id !== current.id) {
      return server;
    }
    return current;
  }
  /**
   * Register the server collection with the Jupyter extension. Safe to call
   * repeatedly; concurrent and repeated calls share one attempt.
   */
  async ensureRegistered(options = {}) {
    if (this.disposed || this.collection) {
      return;
    }
    if (options.promptIfMissing) {
      this.wantsRegistration = true;
    }
    if (this.registering) {
      await this.registering;
      return;
    }
    const task = this.registerOnce(Boolean(options.promptIfMissing));
    this.registering = task;
    try {
      await task;
    } finally {
      if (this.registering === task) {
        this.registering = void 0;
      }
    }
  }
  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.installWatcher?.dispose();
    this.installWatcher = void 0;
    try {
      this.collection?.dispose();
    } catch {
    }
    this.collection = void 0;
    this.changes.dispose();
  }
  async registerOnce(promptIfMissing) {
    const url = await this.ensureUrl();
    if (!url || this.disposed || this.collection) {
      return;
    }
    await this.register(promptIfMissing);
  }
  currentServer() {
    if (!this.url) {
      return void 0;
    }
    try {
      const parts = jupyterConnectionParts(this.url);
      const id = jupyterServerId(parts);
      const label = `${SERVER_LABEL_PREFIX} (${id.slice(-6)})`;
      const connectionInformation = parts.token ? { baseUrl: vscode2.Uri.parse(parts.baseUrl), token: parts.token } : { baseUrl: vscode2.Uri.parse(parts.baseUrl) };
      return {
        id,
        label,
        connectionInformation
      };
    } catch (error) {
      this.options.log(`\u65E0\u6CD5\u89E3\u6790 Jupyter URL: ${shortError(error)}`);
      return void 0;
    }
  }
  /**
   * First use lazily seeds the URL from SecretStorage. A `setUrl` that lands
   * while that read is in flight wins (Save happened after the read started).
   */
  async ensureUrl() {
    if (this.url !== void 0) {
      return this.url;
    }
    if (!this.urlLoad) {
      this.urlLoad = this.options.loadUrl().then((url) => {
        if (this.url === void 0) {
          this.url = (url ?? "").trim();
        }
        return this.url;
      }).catch((error) => {
        this.options.log(`\u8BFB\u53D6 Jupyter URL \u5931\u8D25: ${shortError(error)}`);
        return "";
      });
    }
    return this.urlLoad;
  }
  async register(promptIfMissing) {
    const extension = vscode2.extensions.getExtension(JUPYTER_EXTENSION_ID);
    if (!extension) {
      if (promptIfMissing) {
        await this.offerInstallPrompt();
      }
      this.watchForInstall();
      return;
    }
    const version = String(extension.packageJSON.version ?? "");
    if (!versionAtLeast(version, 2025, 0)) {
      if (promptIfMissing) {
        await this.offerVersionPrompt(version);
      }
      this.watchForInstall();
      return;
    }
    let api;
    try {
      api = extension.isActive ? extension.exports : await extension.activate();
    } catch (error) {
      this.options.log(`\u6FC0\u6D3B Jupyter \u6269\u5C55\u5931\u8D25: ${shortError(error)}`);
      this.watchForInstall();
      return;
    }
    if (this.disposed || this.collection) {
      return;
    }
    try {
      this.collection = api.createJupyterServerCollection(
        SERVER_COLLECTION_ID,
        SERVER_COLLECTION_LABEL,
        this
      );
      this.installWatcher?.dispose();
      this.installWatcher = void 0;
      this.options.log("\u5DF2\u6CE8\u518C Jupyter \u5185\u6838\u6765\u6E90 \u201CKaggle Connector\u201D\u3002");
    } catch (error) {
      this.options.log(`\u6CE8\u518C Jupyter \u5185\u6838\u6765\u6E90\u5931\u8D25: ${shortError(error)}`);
      this.watchForInstall();
    }
  }
  /** Retry silently once Jupyter is installed/enabled/updated. */
  watchForInstall() {
    if (this.installWatcher || this.disposed) {
      return;
    }
    this.installWatcher = vscode2.extensions.onDidChange(() => {
      if (!this.wantsRegistration || this.collection || this.disposed) {
        return;
      }
      void this.ensureRegistered().catch((error) => {
        this.options.log(`\u6CE8\u518C Jupyter \u5185\u6838\u6765\u6E90\u5931\u8D25: ${shortError(error)}`);
      });
    });
  }
  async offerInstallPrompt() {
    if (this.promptOffered) {
      return;
    }
    this.promptOffered = true;
    const install = "\u5B89\u88C5 Jupyter \u6269\u5C55";
    const choice = await vscode2.window.showInformationMessage(
      "\u5DF2\u4FDD\u5B58 Kaggle Jupyter URL\u3002\u5B89\u88C5 Jupyter \u6269\u5C55\u540E\u53EF\u5728 Notebook \u5185\u6838\u9009\u62E9\u5668\u4E2D\u9009\u62E9 \u201CKaggle Connector \u2192 Kaggle Jupyter Server\u201D\uFF1B\u4E0D\u5B89\u88C5\u4E0D\u5F71\u54CD\u4E0A\u4F20\u3002",
      install
    );
    if (choice === install) {
      await vscode2.commands.executeCommand(
        "workbench.extensions.installExtension",
        JUPYTER_EXTENSION_ID
      );
    }
  }
  async offerVersionPrompt(version) {
    if (this.promptOffered) {
      return;
    }
    this.promptOffered = true;
    const view = "\u67E5\u770B\u6269\u5C55";
    const choice = await vscode2.window.showWarningMessage(
      `Jupyter \u6269\u5C55\u7248\u672C\u8FC7\u4F4E\uFF08\u5F53\u524D ${version || "\u672A\u77E5"}\uFF0C\u9700\u8981 2025.0.0 \u6216\u66F4\u9AD8\uFF09\uFF0C\u6682\u65F6\u65E0\u6CD5\u6CE8\u518C Kaggle \u5185\u6838\u6765\u6E90\u3002`,
      view
    );
    if (choice === view) {
      await vscode2.commands.executeCommand(
        "workbench.extensions.search",
        `@id:${JUPYTER_EXTENSION_ID}`
      );
    }
  }
};

// src/keepAlive.ts
var KeepAliveManager = class {
  constructor(options) {
    this.options = options;
  }
  timer;
  inFlight = false;
  disposed = false;
  lastPingAt;
  /**
   * Synchronize the keep-alive timer with current connection state & settings.
   * Starts or keeps the timer if enabled and connected; stops it otherwise.
   */
  sync() {
    if (this.disposed) {
      return;
    }
    if (!this.options.isEnabled() || !this.options.state.connected) {
      this.clearScheduledTimer();
      return;
    }
    if (!this.timer) {
      this.scheduleNext();
    }
  }
  /**
   * Immediately trigger a keep-alive ping.
   * Returns true if the ping succeeded, false if skipped or failed.
   */
  async triggerNow() {
    if (this.disposed || !this.options.isEnabled() || !this.options.state.connected) {
      return false;
    }
    if (this.inFlight) {
      return false;
    }
    this.inFlight = true;
    try {
      const url = (await this.options.loadUrl())?.trim();
      if (!url || !this.options.state.connected || this.disposed) {
        return false;
      }
      const client = this.options.clientFactory(url);
      const result = await client.keepAlive(this.options.getDeadlineMs());
      if (result.alive) {
        this.lastPingAt = this.now();
        const timeStr = new Date(this.lastPingAt).toTimeString().slice(0, 8);
        this.options.log(`[\u4FDD\u6D3B] Kaggle \u4F1A\u8BDD\u6D3B\u8DC3\u65F6\u95F4\u5DF2\u5237\u65B0 (${timeStr})`);
        return true;
      }
      if (result.likelyExpired) {
        this.options.log(
          `[\u4FDD\u6D3B] Kaggle \u4F1A\u8BDD\u5DF2\u5931\u6548\uFF0C\u5DF2\u6682\u505C\u4FDD\u6D3B: ${result.error ? shortError(result.error) : "\u4F1A\u8BDD\u5DF2\u8FC7\u671F"}`
        );
        this.options.state.markDisconnected();
        this.clearScheduledTimer();
      } else {
        this.options.log(
          `[\u4FDD\u6D3B] \u4FDD\u6D3B\u8BF7\u6C42\u5F02\u5E38: ${result.error ? shortError(result.error) : "\u7F51\u7EDC\u9519\u8BEF"}`
        );
      }
      return false;
    } catch (error) {
      this.options.log(`[\u4FDD\u6D3B] \u4FDD\u6D3B\u6267\u884C\u5F02\u5E38: ${shortError(error)}`);
      return false;
    } finally {
      this.inFlight = false;
      if (this.options.state.connected && this.options.isEnabled() && !this.disposed) {
        this.scheduleNext();
      }
    }
  }
  /** Timestamp of the last successful keep-alive ping in epoch ms. */
  getLastPingAt() {
    return this.lastPingAt;
  }
  /** Whether a keep-alive timer is currently active. */
  isScheduled() {
    return this.timer !== void 0;
  }
  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clearScheduledTimer();
  }
  scheduleNext() {
    this.clearScheduledTimer();
    if (this.disposed || !this.options.isEnabled() || !this.options.state.connected) {
      return;
    }
    const intervalMs = Math.max(1e3, this.options.getIntervalMs());
    const setter = this.options.setTimer ?? setTimeout;
    this.timer = setter(() => {
      this.timer = void 0;
      void this.triggerNow();
    }, intervalMs);
  }
  clearScheduledTimer() {
    if (this.timer) {
      const clearer = this.options.clearTimer ?? clearTimeout;
      clearer(this.timer);
      this.timer = void 0;
    }
  }
  now() {
    return (this.options.now ?? Date.now)();
  }
};

// src/probe.ts
var PROBE_CACHE_TTL_MS = 2e4;
var ProbeCoordinator = class {
  constructor(options) {
    this.options = options;
  }
  cache;
  inFlight;
  /** Drop the cached success (URL/proxy changes, explicit re-tests). */
  invalidate() {
    this.cache = void 0;
  }
  /** Probe using the 20s success cache. */
  async probe(url) {
    this.options.state.syncUrl(url);
    if (!url) {
      return { alive: false, likelyExpired: false };
    }
    const cached = this.cache;
    if (cached && cached.url === url && cached.result.alive && this.now() - cached.at < PROBE_CACHE_TTL_MS) {
      const ticket = this.options.state.beginProbe(url);
      if (ticket) {
        this.options.state.completeProbe(ticket, true);
      }
      return cached.result;
    }
    return this.run(url);
  }
  /** Bypass the cache (used right before an upload or an explicit test). */
  async probeFresh(url) {
    this.options.state.syncUrl(url);
    if (!url) {
      return { alive: false, likelyExpired: false };
    }
    this.cache = void 0;
    return this.run(url);
  }
  now() {
    return (this.options.now ?? Date.now)();
  }
  run(url) {
    const key = `${this.options.state.urlGeneration}:${url}`;
    if (this.inFlight && this.inFlight.key === key) {
      return this.inFlight.promise;
    }
    const ticket = this.options.state.beginProbe(url);
    if (!ticket) {
      return Promise.resolve({ alive: false, likelyExpired: false });
    }
    const promise = this.execute(url, ticket);
    this.inFlight = { key, promise };
    const clear = () => {
      if (this.inFlight?.promise === promise) {
        this.inFlight = void 0;
      }
    };
    void promise.then(clear, clear);
    return promise;
  }
  async execute(url, ticket) {
    let result;
    try {
      result = await this.options.clientFactory(url).probeSession(this.options.getTimeoutMs());
    } catch (error) {
      result = {
        alive: false,
        error: error instanceof KaggleError ? error : classifyNetworkError(error),
        likelyExpired: false
      };
    }
    this.options.state.completeProbe(ticket, result.alive);
    this.cache = result.alive ? { url, at: this.now(), result } : void 0;
    return result;
  }
};

// src/proxy.ts
var vscode3 = __toESM(require("vscode"));
function resolveProxy(target) {
  const explicit = getProxySetting().trim();
  if (explicit && explicit.toLowerCase() !== "off") {
    return explicit;
  }
  const httpConfig = vscode3.workspace.getConfiguration("http");
  const configured = (httpConfig.get("proxy", "") ?? "").trim();
  const noProxy = httpConfig.get("noProxy", "") ?? "";
  if (configured && configured.toLowerCase() !== "off" && !isNoProxy(target.hostname, noProxy)) {
    return configured;
  }
  const environment = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || "";
  const environmentNoProxy = process.env.NO_PROXY || process.env.no_proxy || "";
  if (environment.trim() && !isNoProxy(target.hostname, environmentNoProxy)) {
    return environment.trim();
  }
  return void 0;
}
function isNoProxy(hostname, noProxy) {
  if (!noProxy.trim()) {
    return false;
  }
  const host = hostname.toLowerCase().replace(/:\d+$/, "");
  for (const rawEntry of noProxy.split(",")) {
    const entry = rawEntry.trim().toLowerCase();
    if (!entry) {
      continue;
    }
    if (entry === "*") {
      return true;
    }
    const suffix = entry.replace(/:\d+$/, "").replace(/^\./, "");
    if (host === suffix || host.endsWith(`.${suffix}`)) {
      return true;
    }
  }
  return false;
}

// src/remoteFs.ts
var vscode4 = __toESM(require("vscode"));

// src/remoteSave.ts
var RemoteUploadQueue = class {
  constructor(options) {
    this.options = options;
  }
  pending = /* @__PURE__ */ new Map();
  chains = /* @__PURE__ */ new Map();
  disposed = false;
  write(key, content) {
    if (this.disposed) {
      return Promise.reject(new Error("\u4E0A\u4F20\u961F\u5217\u5DF2\u91CA\u653E"));
    }
    if (!this.options.shouldDebounce()) {
      return this.writeNow(key, content);
    }
    return new Promise((resolve2, reject) => {
      const now = Date.now();
      let entry = this.pending.get(key);
      if (!entry) {
        entry = { content, firstQueuedAt: now, waiters: [] };
        this.pending.set(key, entry);
      } else {
        entry.content = content;
        if (entry.timer) {
          clearTimeout(entry.timer);
          entry.timer = void 0;
        }
      }
      entry.waiters.push({ resolve: resolve2, reject });
      const debounceMs = Math.max(0, this.options.getDebounceMs());
      const maxDelayMs = Math.max(0, this.options.getMaxDelayMs());
      const remainingMax = entry.firstQueuedAt + maxDelayMs - now;
      const delay2 = Math.max(0, Math.min(debounceMs, remainingMax));
      if (delay2 === 0) {
        void this.flush(key).catch(() => void 0);
        return;
      }
      entry.timer = setTimeout(() => {
        void this.flush(key).catch(() => void 0);
      }, delay2);
    });
  }
  /**
   * Upload immediately, merging with any pending content and resetting the
   * debounce/max-delay timers. Used for manual saves.
   */
  writeNow(key, content) {
    if (this.disposed) {
      return Promise.reject(new Error("\u4E0A\u4F20\u961F\u5217\u5DF2\u91CA\u653E"));
    }
    let entry = this.pending.get(key);
    if (!entry) {
      entry = { content, firstQueuedAt: Date.now(), waiters: [] };
      this.pending.set(key, entry);
    } else {
      entry.content = content;
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = void 0;
      }
    }
    return new Promise((resolve2, reject) => {
      entry.waiters.push({ resolve: resolve2, reject });
      void this.flush(key).catch(() => void 0);
    });
  }
  /** Upload the pending content for a key now. */
  flush(key) {
    const entry = this.pending.get(key);
    if (!entry) {
      return this.chains.get(key) ?? Promise.resolve();
    }
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = void 0;
    }
    this.pending.delete(key);
    const upload = this.enqueue(key, entry.content);
    upload.then(
      () => entry.waiters.forEach((waiter) => waiter.resolve()),
      (error) => entry.waiters.forEach((waiter) => waiter.reject(error))
    );
    return upload.then(() => void 0);
  }
  /** Flush every pending file and wait for in-flight uploads (best effort). */
  async flushAll() {
    const keys = [...this.pending.keys()];
    await Promise.all(keys.map((key) => this.flush(key)));
    const chains = [...this.chains.values()];
    await Promise.all(chains.map((chain) => chain.catch(() => void 0)));
  }
  dispose() {
    this.disposed = true;
    const error = new Error("\u4E0A\u4F20\u961F\u5217\u5DF2\u91CA\u653E");
    for (const entry of this.pending.values()) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      entry.waiters.forEach((waiter) => waiter.reject(error));
    }
    this.pending.clear();
  }
  enqueue(key, content) {
    const previous = this.chains.get(key) ?? Promise.resolve();
    const next = previous.catch(() => void 0).then(() => this.options.upload(key, content));
    this.chains.set(key, next);
    return next.finally(() => {
      if (this.chains.get(key) === next) {
        this.chains.delete(key);
      }
    });
  }
};

// src/remoteFs.ts
var REMOTE_SCHEME = "kaggle-remote";
var KaggleRemoteFileSystemProvider = class {
  constructor(resolveClient, log2, onMutation, onConnectionError) {
    this.resolveClient = resolveClient;
    this.log = log2;
    this.onMutation = onMutation;
    this.onConnectionError = onConnectionError;
  }
  changeEmitter = new vscode4.EventEmitter();
  onDidChangeFile = this.changeEmitter.event;
  manualSaveKeys = /* @__PURE__ */ new Set();
  uploadQueue = new RemoteUploadQueue({
    upload: (key, content) => this.upload(key, content),
    shouldDebounce: () => vscode4.workspace.getConfiguration("files").get("autoSave", "off") !== "off",
    getDebounceMs: getRemoteUploadDebounceMs,
    getMaxDelayMs: getRemoteUploadMaxDelayMs
  });
  /** Report session/network failures so the uploaded command can grey out. */
  notifyConnectionError(error) {
    if (isConnectionError(error)) {
      this.onConnectionError?.(error);
    }
  }
  watch() {
    return new vscode4.Disposable(() => void 0);
  }
  async stat(uri) {
    const remotePath = toRemotePath(uri);
    try {
      const client = await this.resolveClient();
      const model = await client.getContents(remotePath);
      const type = model?.type === "directory" ? vscode4.FileType.Directory : vscode4.FileType.File;
      const mtime = parseTimestamp2(model?.last_modified) ?? Date.now();
      const stat = {
        type,
        ctime: mtime,
        mtime,
        size: typeof model?.size === "number" ? model.size : 0
      };
      if (model?.writable === false) {
        stat.permissions = vscode4.FilePermission.Readonly;
      }
      return stat;
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, uri);
    }
  }
  async readDirectory(uri) {
    const remotePath = toRemotePath(uri);
    try {
      const client = await this.resolveClient();
      const entries = await client.listDirectory(remotePath);
      return entries.map(
        (entry) => [
          entry.name,
          entry.type === "directory" ? vscode4.FileType.Directory : vscode4.FileType.File
        ]
      );
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, uri);
    }
  }
  async readFile(uri) {
    const remotePath = toRemotePath(uri);
    let bytes;
    try {
      const client = await this.resolveClient();
      bytes = await client.readFile(remotePath);
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, uri);
    }
    if (isBinary(bytes)) {
      throw vscode4.FileSystemError.Unavailable(
        "\u8FD9\u662F\u4E8C\u8FDB\u5236\u6587\u4EF6\uFF0C\u65E0\u6CD5\u5728\u6587\u672C\u7F16\u8F91\u5668\u4E2D\u6253\u5F00\uFF0C\u8BF7\u4F7F\u7528\u201C\u4E0B\u8F7D\u201D\u3002"
      );
    }
    return bytes;
  }
  async writeFile(uri, content, _options) {
    const key = uri.toString();
    const manual = this.manualSaveKeys.delete(key);
    try {
      if (manual) {
        await this.uploadQueue.writeNow(key, content);
      } else {
        await this.uploadQueue.write(key, content);
      }
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, uri);
    }
  }
  /** Mark the next writeFile for this URI as an explicit manual save. */
  beginManualSave(key) {
    this.manualSaveKeys.add(key);
  }
  /** Clear a manual-save marker if no writeFile was triggered. */
  clearManualSave(key) {
    this.manualSaveKeys.delete(key);
  }
  /** Upload pending debounced content for a URI now. */
  async flushPending(key) {
    await this.uploadQueue.flush(key);
  }
  /** Flush all pending remote saves (tab close / window exit). */
  async flushAll() {
    await this.uploadQueue.flushAll();
  }
  dispose() {
    this.uploadQueue.dispose();
    this.changeEmitter.dispose();
  }
  async upload(key, content) {
    const uri = vscode4.Uri.parse(key);
    const remotePath = toRemotePath(uri);
    const client = await this.resolveClient();
    await client.putFile(remotePath, Buffer.from(content));
    this.changeEmitter.fire([{ type: vscode4.FileChangeType.Changed, uri }]);
    this.onMutation?.();
    this.log(`\u5DF2\u4FDD\u5B58\u8FDC\u7AEF\u6587\u4EF6: ${remotePath}`);
  }
  async createDirectory(uri) {
    const remotePath = toRemotePath(uri);
    try {
      const client = await this.resolveClient();
      await client.putDirectory(remotePath);
      this.changeEmitter.fire([{ type: vscode4.FileChangeType.Created, uri }]);
      this.onMutation?.();
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, uri);
    }
  }
  async delete(uri, options) {
    const remotePath = toRemotePath(uri);
    try {
      const client = await this.resolveClient();
      if (options.recursive) {
        await deleteRemoteTree(client, remotePath, this.log);
      } else {
        await client.deleteContents(remotePath);
      }
      this.changeEmitter.fire([{ type: vscode4.FileChangeType.Deleted, uri }]);
      this.onMutation?.();
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, uri);
    }
  }
  async rename(oldUri, newUri, options) {
    const from = toRemotePath(oldUri);
    const to = toRemotePath(newUri);
    try {
      const client = await this.resolveClient();
      if (options.overwrite) {
        try {
          await client.deleteContents(to);
        } catch (error) {
          if (!(error instanceof KaggleError && error.kind === "notFound")) {
            throw error;
          }
        }
      }
      await client.renameContents(from, to);
      this.changeEmitter.fire([
        { type: vscode4.FileChangeType.Deleted, uri: oldUri },
        { type: vscode4.FileChangeType.Created, uri: newUri }
      ]);
      this.onMutation?.();
    } catch (error) {
      this.notifyConnectionError(error);
      throw toFileSystemError(error, oldUri);
    }
  }
};
function toRemotePath(uri) {
  return normalizeRemotePath(uri.path);
}
function parseTimestamp2(value) {
  if (typeof value !== "string" || !value) {
    return void 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : void 0;
}
function isBinary(bytes) {
  const limit = Math.min(bytes.length, 8192);
  for (let index = 0; index < limit; index += 1) {
    if (bytes[index] === 0) {
      return true;
    }
  }
  return false;
}
function toFileSystemError(error, uri) {
  if (error instanceof vscode4.FileSystemError) {
    return error;
  }
  if (error instanceof KaggleError && error.kind === "notFound") {
    return vscode4.FileSystemError.FileNotFound(uri);
  }
  return vscode4.FileSystemError.Unavailable(shortError(error));
}
async function deleteRemoteTree(client, remotePath, log2) {
  const entries = await client.listDirectory(remotePath);
  for (const entry of entries) {
    if (entry.type === "directory") {
      await deleteRemoteTree(client, entry.path, log2);
    } else {
      await client.deleteContents(entry.path);
    }
  }
  await client.deleteContents(remotePath);
  log2(`\u5220\u9664\u76EE\u5F55\u5B8C\u6210: ${remotePath}`);
}

// src/remoteWorkspaceService.ts
var os = __toESM(require("node:os"));
var path4 = __toESM(require("node:path"));
var vscode6 = __toESM(require("vscode"));

// src/core/remoteActions.ts
function remoteBasename(remotePath) {
  const normalized = normalizeRemotePath(remotePath);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}
function isRemoteInsideOrEqual(parent, child) {
  const normalizedParent = normalizeRemotePath(parent);
  const normalizedChild = normalizeRemotePath(child);
  if (!normalizedParent) {
    return true;
  }
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}/`);
}
function splitCopyName(name, isDirectory) {
  if (!isDirectory) {
    const dot = name.lastIndexOf(".");
    if (dot > 0) {
      return { stem: name.slice(0, dot), ext: name.slice(dot) };
    }
  }
  return { stem: name, ext: "" };
}
function uniqueCopyPath(targetDir, baseName, isDirectory, existingNames) {
  const { stem, ext: ext2 } = splitCopyName(baseName, isDirectory);
  let candidate = `${stem} copy${ext2}`;
  let suffix = 2;
  while (existingNames.has(candidate)) {
    candidate = `${stem} copy ${suffix}${ext2}`;
    suffix += 1;
  }
  return joinRemotePath(normalizeRemotePath(targetDir), candidate);
}
function validateEntryName(value) {
  const name = value.trim();
  if (!name) {
    return "\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A";
  }
  if (name === "." || name === "..") {
    return "\u540D\u79F0\u65E0\u6548";
  }
  if (/[\\/]/.test(name)) {
    return "\u540D\u79F0\u4E0D\u80FD\u5305\u542B\u659C\u6760\uFF1B\u5982\u9700\u5B50\u76EE\u5F55\u8BF7\u5148\u521B\u5EFA\u6587\u4EF6\u5939";
  }
  return void 0;
}
function safeLocalName(name) {
  const stripped = name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").replace(/[. ]+$/g, "");
  const normalized = stripped || "unnamed";
  if (normalized === "." || normalized === "..") {
    return "unnamed";
  }
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(normalized)) {
    return `_${normalized}`;
  }
  return normalized;
}
function filterOutNestedRemotePaths(items) {
  const seen = /* @__PURE__ */ new Set();
  const normalizedItems = [];
  for (const item of items) {
    const normalized = normalizeRemotePath(item.path);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    normalizedItems.push({ item, path: normalized });
  }
  const selectedDirs = new Set(
    normalizedItems.filter(({ item }) => item.entryType === "directory").map(({ path: path6 }) => path6)
  );
  return normalizedItems.filter(({ path: path6 }) => {
    let parent = dirnameRemotePath(path6);
    while (parent) {
      if (selectedDirs.has(parent)) {
        return false;
      }
      parent = dirnameRemotePath(parent);
    }
    return true;
  }).map(({ item, path: path6 }) => ({ ...item, path: path6 }));
}
function commonRemoteParent(paths) {
  const parents = paths.map((item) => dirnameRemotePath(item)).map((parent) => parent ? parent.split("/") : []);
  if (parents.length === 0) {
    return "";
  }
  let prefix = parents[0];
  for (let i = 1; i < parents.length; i += 1) {
    const next = parents[i];
    let matched = 0;
    while (matched < prefix.length && matched < next.length && prefix[matched] === next[matched]) {
      matched += 1;
    }
    prefix = prefix.slice(0, matched);
    if (prefix.length === 0) {
      break;
    }
  }
  return prefix.join("/");
}
function planMultiDownloadTargets(items) {
  const deduped = filterOutNestedRemotePaths(items);
  if (deduped.length === 0) {
    return [];
  }
  const seenNames = /* @__PURE__ */ new Set();
  let hasBasenameCollision = false;
  for (const item of deduped) {
    const localName = safeLocalName(remoteBasename(item.path)).toLowerCase();
    if (seenNames.has(localName)) {
      hasBasenameCollision = true;
      break;
    }
    seenNames.add(localName);
  }
  if (!hasBasenameCollision) {
    return deduped.map((item) => ({
      item,
      localParts: [safeLocalName(remoteBasename(item.path))]
    }));
  }
  const commonParent = commonRemoteParent(deduped.map((item) => item.path));
  const prefixSegments = commonParent ? commonParent.split("/") : [];
  return deduped.map((item) => {
    const segments = normalizeRemotePath(item.path).split("/").filter(Boolean);
    const relative2 = segments.slice(prefixSegments.length);
    const localParts = (relative2.length > 0 ? relative2 : segments).map(safeLocalName);
    return { item, localParts };
  });
}
function planBatchTransfer(items, targetDir, mode, existingNames) {
  const normalizedTarget = normalizeRemotePath(targetDir);
  const deduped = filterOutNestedRemotePaths(items);
  const reserved = new Set(existingNames);
  const seenMoveTargets = /* @__PURE__ */ new Set();
  const entries = [];
  const selfContainmentErrors = [];
  const duplicateTargetErrors = [];
  let skippedSameParent = 0;
  for (const item of deduped) {
    const source = normalizeRemotePath(item.path);
    const isDirectory = item.entryType === "directory";
    const baseName = remoteBasename(source);
    const sourceParent = dirnameRemotePath(source);
    if (isDirectory && isRemoteInsideOrEqual(source, normalizedTarget)) {
      selfContainmentErrors.push(
        `\u4E0D\u80FD\u628A\u6587\u4EF6\u5939 \u201C${source}\u201D ${mode === "move" ? "\u79FB\u52A8" : "\u590D\u5236"}\u5230\u5B83\u81EA\u5DF1\u5185\u90E8`
      );
      continue;
    }
    if (mode === "move" && sourceParent === normalizedTarget) {
      skippedSameParent += 1;
      continue;
    }
    if (mode === "copy" && sourceParent === normalizedTarget) {
      const target2 = uniqueCopyPath(normalizedTarget, baseName, isDirectory, reserved);
      reserved.add(remoteBasename(target2));
      entries.push({
        source,
        target: target2,
        baseName: remoteBasename(target2),
        isDirectory,
        conflict: false
      });
      continue;
    }
    const target = joinRemotePath(normalizedTarget, baseName);
    if (mode === "move") {
      if (seenMoveTargets.has(target)) {
        duplicateTargetErrors.push(`\u591A\u4E2A\u9009\u4E2D\u9879\u540C\u540D\uFF0C\u65E0\u6CD5\u540C\u65F6\u79FB\u52A8\u5230\u540C\u4E00\u76EE\u5F55\uFF1A${baseName}`);
        continue;
      }
      seenMoveTargets.add(target);
    }
    const conflict = reserved.has(baseName);
    entries.push({
      source,
      target,
      baseName,
      isDirectory,
      conflict
    });
  }
  return {
    entries,
    skippedSameParent,
    selfContainmentErrors,
    duplicateTargetErrors
  };
}

// src/core/retry.ts
function isRetryable(error) {
  return error instanceof KaggleError && error.retryable && error.kind !== "cancelled";
}
function delay(ms, signal, cancelMessage = "\u64CD\u4F5C\u5DF2\u53D6\u6D88") {
  return new Promise((resolve2, reject) => {
    if (signal?.aborted) {
      reject(new KaggleError("cancelled", cancelMessage));
      return;
    }
    if (ms <= 0) {
      resolve2();
      return;
    }
    let timer;
    const onAbort = () => {
      clearTimeout(timer);
      reject(new KaggleError("cancelled", cancelMessage));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve2();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
async function withRetries(action, retries, signal, options = {}) {
  const maxRetries = Math.max(0, Math.floor(retries));
  const baseDelayMs = options.baseDelayMs ?? 400;
  const maxDelayMs = options.maxDelayMs ?? 5e3;
  const jitterMs = options.jitterMs ?? 200;
  const cancelMessage = options.cancelMessage ?? "\u64CD\u4F5C\u5DF2\u53D6\u6D88";
  let attempt = 0;
  while (true) {
    if (signal?.aborted) {
      throw new KaggleError("cancelled", cancelMessage);
    }
    try {
      return await action();
    } catch (error) {
      if (attempt >= maxRetries || signal?.aborted || !isRetryable(error)) {
        throw error;
      }
      attempt += 1;
      const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
      const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1)) + jitter;
      options.onRetry?.(attempt, error, delayMs);
      await delay(delayMs, signal, cancelMessage);
    }
  }
}

// src/download.ts
var SYSTEM_ENTRIES = /* @__PURE__ */ new Set([".ipynb_checkpoints", ".virtual_documents"]);
var MAX_CONSECUTIVE_CONNECTION_ERRORS = 3;
var HUGE_FILE_BYTES = 50 * 1024 * 1024;
var LARGE_FILE_BYTES = 20 * 1024 * 1024;
var Semaphore = class {
  constructor(limit) {
    this.limit = limit;
  }
  active = 0;
  waiters = [];
  async run(task) {
    if (this.active >= this.limit) {
      await new Promise((resolve2) => this.waiters.push(resolve2));
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      const next = this.waiters.shift();
      if (next) {
        next();
      }
    }
  }
};
function downloadRemoteDirectory(options) {
  const { remotePath, ...rest } = options;
  return downloadRemoteSelections({
    ...rest,
    entries: [{ remotePath, relativeParts: [], type: "directory" }]
  });
}
async function downloadRemoteSelections(options) {
  const concurrency = Math.min(16, Math.max(1, Math.floor(options.concurrency)));
  const retryCount = Math.min(5, Math.max(0, Math.floor(options.retryCount)));
  const formatLocalPath = options.formatLocalPath ?? ((parts) => parts.join("/"));
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (options.signal.aborted) {
    controller.abort();
  } else {
    options.signal.addEventListener("abort", onAbort, { once: true });
  }
  const files = [];
  const failures = [];
  let scanFailuresCount = 0;
  let directoriesScanned = 0;
  let downloaded = 0;
  let completed = 0;
  let sessionExpired = false;
  let abortedByConnection = false;
  let fatalError;
  let consecutiveConnectionErrors = 0;
  try {
    if (controller.signal.aborted) {
      return {
        total: 0,
        downloaded: 0,
        failed: 0,
        skipped: 0,
        cancelled: true,
        sessionExpired: false,
        abortedByConnection: false,
        failures: []
      };
    }
    await options.ensureDirectory([]);
    const singleRootDir = options.entries.length === 1 && options.entries[0].type === "directory" ? options.entries[0].remotePath : void 0;
    const scanLimiter = new Semaphore(concurrency);
    const scanDirectory = async (remotePath, relativeParts) => {
      if (controller.signal.aborted) {
        return;
      }
      let entries;
      try {
        entries = await scanLimiter.run(
          () => withRetries(
            () => options.client.listDirectory(remotePath, controller.signal),
            retryCount,
            controller.signal,
            {
              cancelMessage: "\u4E0B\u8F7D\u5DF2\u53D6\u6D88",
              ...options.retryOptions,
              onRetry: (attempt, error, delayMs) => {
                options.log(
                  `\u626B\u63CF\u76EE\u5F55\u5931\u8D25\uFF0C${delayMs} ms \u540E\u91CD\u8BD5\uFF08${attempt}/${retryCount}\uFF09\uFF1A${remotePath}\uFF1A${shortError(error)}`
                );
              }
            }
          )
        );
        if (controller.signal.aborted) {
          return;
        }
        await options.ensureDirectory(relativeParts);
        consecutiveConnectionErrors = 0;
      } catch (error) {
        if (error instanceof KaggleError && error.kind === "cancelled") {
          return;
        }
        scanFailuresCount += 1;
        failures.push({
          remotePath,
          localPath: formatLocalPath(relativeParts),
          error
        });
        options.log(`\u626B\u63CF\u76EE\u5F55\u5931\u8D25: ${remotePath}: ${describeError(error)}`);
        if (isSessionError(error)) {
          sessionExpired = true;
          fatalError ??= error;
          controller.abort();
          return;
        }
        if (singleRootDir !== void 0 && remotePath === singleRootDir) {
          fatalError = error;
          if (isConnectionError(error)) {
            abortedByConnection = true;
          }
          controller.abort();
          return;
        }
        if (isConnectionError(error)) {
          consecutiveConnectionErrors += 1;
          if (consecutiveConnectionErrors >= MAX_CONSECUTIVE_CONNECTION_ERRORS) {
            abortedByConnection = true;
            fatalError ??= error;
            controller.abort();
          }
        }
        return;
      }
      directoriesScanned += 1;
      const subdirs = [];
      for (const entry of entries) {
        if (SYSTEM_ENTRIES.has(entry.name)) {
          continue;
        }
        const childParts = [...relativeParts, safeLocalName(entry.name)];
        if (entry.type === "directory") {
          subdirs.push(scanDirectory(entry.path, childParts));
        } else {
          files.push({
            remotePath: entry.path,
            relativeParts: childParts,
            type: entry.type,
            size: entry.size
          });
        }
      }
      options.onProgress?.({
        phase: "scanning",
        directoriesScanned,
        filesFound: files.length,
        currentPath: remotePath
      });
      if (subdirs.length > 0) {
        await Promise.all(subdirs);
      }
    };
    const ensuredParents = /* @__PURE__ */ new Set();
    const failedParents = /* @__PURE__ */ new Map();
    const scanSeeds = [];
    for (const seed of options.entries) {
      if (controller.signal.aborted) {
        break;
      }
      if (seed.type === "directory") {
        scanSeeds.push(scanDirectory(seed.remotePath, [...seed.relativeParts]));
        continue;
      }
      if (seed.relativeParts.length > 1) {
        const parentParts = seed.relativeParts.slice(0, -1);
        const parentKey = parentParts.join("\0");
        if (!ensuredParents.has(parentKey)) {
          ensuredParents.add(parentKey);
          try {
            await options.ensureDirectory(parentParts);
          } catch (error) {
            failedParents.set(parentKey, error);
            options.log(`\u521B\u5EFA\u672C\u5730\u76EE\u5F55\u5931\u8D25: ${formatLocalPath(parentParts)}: ${describeError(error)}`);
          }
        }
        if (failedParents.has(parentKey)) {
          scanFailuresCount += 1;
          failures.push({
            remotePath: seed.remotePath,
            localPath: formatLocalPath(seed.relativeParts),
            error: failedParents.get(parentKey)
          });
          continue;
        }
      }
      files.push({
        remotePath: seed.remotePath,
        relativeParts: [...seed.relativeParts],
        type: seed.type,
        size: seed.size
      });
    }
    if (scanSeeds.length > 0) {
      await Promise.all(scanSeeds);
    }
    if (files.length > 0 && !controller.signal.aborted) {
      const hugeFileLimiter = new Semaphore(1);
      const largeFileLimiter = new Semaphore(2);
      const workerCount = Math.max(1, Math.min(concurrency, files.length));
      let cursor = 0;
      const downloadOne = async (file) => {
        const bytes = await withRetries(
          () => options.client.downloadFile(file.remotePath, {
            signal: controller.signal,
            type: file.type,
            sizeHint: file.size
          }),
          retryCount,
          controller.signal,
          {
            cancelMessage: "\u4E0B\u8F7D\u5DF2\u53D6\u6D88",
            ...options.retryOptions,
            onRetry: (attempt, error, delayMs) => {
              options.log(
                `\u4E0B\u8F7D\u5931\u8D25\uFF0C${delayMs} ms \u540E\u91CD\u8BD5\uFF08${attempt}/${retryCount}\uFF09\uFF1A${file.remotePath}\uFF1A${shortError(error)}`
              );
            }
          }
        );
        if (controller.signal.aborted) {
          throw new KaggleError("cancelled", "\u4E0B\u8F7D\u5DF2\u53D6\u6D88");
        }
        await options.writeFile(file.relativeParts, bytes);
      };
      const runWithSizeLimit = (file) => {
        if (file.size !== void 0 && file.size >= HUGE_FILE_BYTES) {
          return hugeFileLimiter.run(() => downloadOne(file));
        }
        if (file.size !== void 0 && file.size >= LARGE_FILE_BYTES) {
          return largeFileLimiter.run(() => downloadOne(file));
        }
        return downloadOne(file);
      };
      const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
          if (controller.signal.aborted) {
            return;
          }
          const index = cursor;
          cursor += 1;
          if (index >= files.length) {
            return;
          }
          const file = files[index];
          try {
            await runWithSizeLimit(file);
            downloaded += 1;
            consecutiveConnectionErrors = 0;
            options.log(`\u4E0B\u8F7D\u6210\u529F: ${file.remotePath}`);
          } catch (error) {
            if (!(error instanceof KaggleError && error.kind === "cancelled")) {
              failures.push({
                remotePath: file.remotePath,
                localPath: formatLocalPath(file.relativeParts),
                error
              });
              options.log(`\u4E0B\u8F7D\u5931\u8D25: ${file.remotePath}: ${describeError(error)}`);
              if (isSessionError(error)) {
                sessionExpired = true;
                fatalError ??= error;
                controller.abort();
              } else if (isConnectionError(error)) {
                consecutiveConnectionErrors += 1;
                if (consecutiveConnectionErrors >= MAX_CONSECUTIVE_CONNECTION_ERRORS) {
                  abortedByConnection = true;
                  fatalError ??= error;
                  controller.abort();
                }
              }
            }
          } finally {
            completed += 1;
            options.onProgress?.({
              phase: "downloading",
              completed,
              total: files.length,
              currentPath: file.remotePath
            });
          }
        }
      });
      await Promise.all(workers);
    }
  } finally {
    options.signal.removeEventListener("abort", onAbort);
  }
  const total = files.length + scanFailuresCount;
  const failed = failures.length;
  const skipped = Math.max(0, total - downloaded - failed);
  const cancelled = options.signal.aborted && !sessionExpired && !abortedByConnection && fatalError === void 0;
  return {
    total,
    downloaded,
    failed,
    skipped,
    cancelled,
    sessionExpired,
    abortedByConnection,
    fatalError,
    failures
  };
}

// src/upload.ts
var import_node_crypto3 = require("node:crypto");
var path3 = __toESM(require("node:path"));
var vscode5 = __toESM(require("vscode"));

// src/core/uploadPolicy.ts
var UPLOAD_MTIME_TOLERANCE_MS = 2e3;
function decideUpload(input) {
  const remote = input.remote;
  if (!remote) {
    return "upload";
  }
  if (remote.type === "directory") {
    return "remoteIsDirectory";
  }
  const tolerance = input.toleranceMs ?? UPLOAD_MTIME_TOLERANCE_MS;
  const offset = input.clockOffsetMs ?? 0;
  const remoteMtime = typeof remote.lastModified === "number" ? remote.lastModified - offset : void 0;
  const remoteIsNewer = remoteMtime !== void 0 && remoteMtime > input.localMtime + tolerance;
  const sizeDiffers = typeof remote.size === "number" && remote.size !== input.localSize;
  const hashSame = remote.hash && input.localHash ? remote.hash.toLowerCase() === input.localHash.toLowerCase() : void 0;
  if (hashSame === true) {
    return "unchanged";
  }
  if (hashSame === false || sizeDiffers) {
    return remoteIsNewer ? "remoteNewer" : "upload";
  }
  if (remote.size === input.localSize && remoteMtime !== void 0 && remoteMtime >= input.localMtime - tolerance) {
    return "unchanged";
  }
  return "upload";
}

// src/upload.ts
var MAX_DEPTH = 100;
async function collectSelections(selections, config, token, log2) {
  const uniqueSelections = /* @__PURE__ */ new Map();
  for (const uri of selections) {
    if (uri.scheme === "file") {
      uniqueSelections.set(uri.fsPath, uri);
    }
  }
  const roots = [];
  const failures = [];
  let skipped = 0;
  for (const uri of uniqueSelections.values()) {
    if (token.isCancellationRequested) {
      break;
    }
    let stat;
    try {
      stat = await vscode5.workspace.fs.stat(uri);
    } catch (error) {
      failures.push({
        localPath: uri.fsPath,
        error: localFileError("\u8BFB\u53D6\u672C\u5730\u6587\u4EF6\u4FE1\u606F\u5931\u8D25", error)
      });
      continue;
    }
    if ((stat.type & vscode5.FileType.SymbolicLink) !== 0) {
      skipped += 1;
      log2(`\u8DF3\u8FC7\u7B26\u53F7\u94FE\u63A5: ${uri.fsPath}`);
      continue;
    }
    const workspaceFolder = vscode5.workspace.getWorkspaceFolder(uri);
    const root = {
      uri,
      isDirectory: (stat.type & vscode5.FileType.Directory) !== 0,
      workspaceRoot: workspaceFolder?.uri.fsPath
    };
    if (!root.isDirectory && (stat.type & vscode5.FileType.File) === 0) {
      skipped += 1;
      log2(`\u8DF3\u8FC7\u672A\u77E5\u6587\u4EF6\u7C7B\u578B: ${uri.fsPath}`);
      continue;
    }
    roots.push(root);
  }
  roots.sort((left, right) => {
    const directoryOrder = Number(left.isDirectory) - Number(right.isDirectory);
    return directoryOrder !== 0 ? directoryOrder : left.uri.fsPath.localeCompare(right.uri.fsPath);
  });
  const files = [];
  for (const root of roots) {
    if (token.isCancellationRequested) {
      break;
    }
    if (!root.isDirectory) {
      try {
        const stat = await vscode5.workspace.fs.stat(root.uri);
        files.push({
          uri: root.uri,
          selectionRoot: root,
          size: stat.size,
          mtime: stat.mtime
        });
      } catch (error) {
        failures.push({
          localPath: root.uri.fsPath,
          error: localFileError("\u8BFB\u53D6\u672C\u5730\u6587\u4EF6\u4FE1\u606F\u5931\u8D25", error)
        });
      }
      continue;
    }
    await walkDirectory(root.uri, root, config, token, files, failures, log2, 0, (count) => {
      skipped += count;
    });
  }
  return { files, failures, skipped };
}
async function walkDirectory(directory, root, config, token, files, failures, log2, depth, addSkipped) {
  if (token.isCancellationRequested) {
    return;
  }
  if (depth > MAX_DEPTH) {
    failures.push({
      localPath: directory.fsPath,
      error: new KaggleError("unknown", `\u76EE\u5F55\u5C42\u7EA7\u8D85\u8FC7 ${MAX_DEPTH} \u5C42\uFF0C\u5DF2\u8DF3\u8FC7`)
    });
    return;
  }
  let entries;
  try {
    entries = await vscode5.workspace.fs.readDirectory(directory);
  } catch (error) {
    failures.push({
      localPath: directory.fsPath,
      error: localFileError("\u8BFB\u53D6\u672C\u5730\u76EE\u5F55\u5931\u8D25", error)
    });
    return;
  }
  for (const [name, type] of entries) {
    if (token.isCancellationRequested) {
      return;
    }
    const child = vscode5.Uri.joinPath(directory, name);
    if ((type & vscode5.FileType.SymbolicLink) !== 0) {
      addSkipped(1);
      log2(`\u8DF3\u8FC7\u7B26\u53F7\u94FE\u63A5: ${child.fsPath}`);
      continue;
    }
    const relative2 = exclusionPath(child, root);
    const isDirectory = (type & vscode5.FileType.Directory) !== 0;
    const isFile = (type & vscode5.FileType.File) !== 0;
    if (isDirectory) {
      if (isExcluded(relative2, config.exclude, true)) {
        addSkipped(1);
        log2(`\u6392\u9664\u76EE\u5F55: ${relative2}`);
        continue;
      }
      await walkDirectory(child, root, config, token, files, failures, log2, depth + 1, addSkipped);
      continue;
    }
    if (!isFile) {
      addSkipped(1);
      log2(`\u8DF3\u8FC7\u672A\u77E5\u6587\u4EF6\u7C7B\u578B: ${child.fsPath}`);
      continue;
    }
    if (isExcluded(relative2, config.exclude, false)) {
      addSkipped(1);
      log2(`\u6392\u9664\u6587\u4EF6: ${relative2}`);
      continue;
    }
    try {
      const stat = await vscode5.workspace.fs.stat(child);
      files.push({
        uri: child,
        selectionRoot: root,
        size: stat.size,
        mtime: stat.mtime
      });
    } catch (error) {
      failures.push({
        localPath: child.fsPath,
        error: localFileError("\u8BFB\u53D6\u672C\u5730\u6587\u4EF6\u4FE1\u606F\u5931\u8D25", error)
      });
    }
  }
}
function exclusionPath(uri, root) {
  if (root.workspaceRoot && isInsideOrEqual(root.workspaceRoot, uri.fsPath)) {
    const relative2 = localRelative(root.workspaceRoot, uri.fsPath);
    return relative2 || path3.basename(uri.fsPath);
  }
  if (isInsideOrEqual(root.uri.fsPath, uri.fsPath)) {
    const relative2 = localRelative(root.uri.fsPath, uri.fsPath);
    return relative2 || path3.basename(uri.fsPath);
  }
  return path3.basename(uri.fsPath);
}
function planUploads(files, config, log2) {
  const uniqueFiles = /* @__PURE__ */ new Map();
  for (const file of files) {
    if (!uniqueFiles.has(file.uri.fsPath)) {
      uniqueFiles.set(file.uri.fsPath, file);
    }
  }
  const plans = [];
  const failures = [];
  const remoteOwners = /* @__PURE__ */ new Map();
  const maxBytes = config.maxFileSizeMB > 0 ? config.maxFileSizeMB * 1024 * 1024 : 0;
  for (const file of uniqueFiles.values()) {
    const selection = file.selectionRoot;
    const base = selectionRemoteBase({
      localPath: selection.uri.fsPath,
      isDirectory: selection.isDirectory,
      workspaceRoot: selection.workspaceRoot,
      mode: config.pathMode
    });
    let relative2;
    try {
      relative2 = selection.isDirectory ? childRemoteBase(base, selection.uri.fsPath, file.uri.fsPath) : base;
    } catch (error) {
      failures.push({ localPath: file.uri.fsPath, error });
      continue;
    }
    let remotePath;
    try {
      remotePath = joinRemotePath(config.remoteDir, relative2);
    } catch (error) {
      failures.push({ localPath: file.uri.fsPath, error });
      continue;
    }
    if (!remotePath) {
      failures.push({
        localPath: file.uri.fsPath,
        error: new KaggleError("unknown", "\u8BA1\u7B97\u51FA\u7684\u8FDC\u7A0B\u8DEF\u5F84\u4E3A\u7A7A")
      });
      continue;
    }
    if (maxBytes > 0 && file.size > maxBytes) {
      failures.push({
        localPath: file.uri.fsPath,
        remotePath,
        error: new KaggleError(
          "tooLarge",
          `\u6587\u4EF6\u5927\u5C0F ${formatSize(file.size)} \u8D85\u8FC7\u4E0A\u9650 ${config.maxFileSizeMB} MB\uFF0C\u5DF2\u8DF3\u8FC7`,
          { hint: "\u8C03\u5927 kaggleConnector.maxFileSizeMB\uFF0C\u6216\u6539\u7528 Kaggle Dataset \u4E0A\u4F20\u5927\u6587\u4EF6\u3002" }
        )
      });
      continue;
    }
    const owner = remoteOwners.get(remotePath);
    if (owner) {
      failures.push({
        localPath: file.uri.fsPath,
        remotePath,
        error: new KaggleError(
          "unknown",
          `\u8FDC\u7A0B\u8DEF\u5F84\u51B2\u7A81\uFF1A${remotePath} \u5DF2\u88AB ${owner} \u5360\u7528`,
          { hint: "\u4F7F\u7528 \u201C\u4FDD\u7559\u5DE5\u4F5C\u533A\u76F8\u5BF9\u8DEF\u5F84\u201D \u6A21\u5F0F\uFF0C\u6216\u907F\u514D\u5728\u9009\u62E9\u591A\u4E2A\u540C\u540D\u6587\u4EF6\u65F6\u4F7F\u7528 \u201C\u4EC5\u6587\u4EF6\u540D\u201D \u6A21\u5F0F\u3002" }
        )
      });
      continue;
    }
    remoteOwners.set(remotePath, file.uri.fsPath);
    plans.push({
      uri: file.uri,
      localPath: file.uri.fsPath,
      remotePath,
      size: file.size,
      mtime: file.mtime
    });
  }
  log2(`\u8BA1\u5212\u4E0A\u4F20 ${plans.length} \u4E2A\u6587\u4EF6\uFF0C${failures.length} \u4E2A\u5728\u89C4\u5212\u9636\u6BB5\u88AB\u8DF3\u8FC7\u3002`);
  return { plans, failures };
}
async function preflightUploads(client, plans, config, token, log2) {
  const result = {
    uploads: [],
    unchanged: [],
    remoteNewer: [],
    failures: [],
    cancelled: false,
    sessionExpired: false
  };
  const detectRemoteNewer = config.conflictPolicy !== "overwrite";
  if (!config.skipUnchanged && !detectRemoteNewer) {
    result.uploads = [...plans];
    return result;
  }
  const controller = new AbortController();
  const cancellation = token.onCancellationRequested(() => controller.abort());
  const directoryCache = /* @__PURE__ */ new Map();
  try {
    for (const plan of plans) {
      if (token.isCancellationRequested || controller.signal.aborted) {
        result.cancelled = true;
        return result;
      }
      const directory = dirnameRemotePath(plan.remotePath);
      if (!directoryCache.has(directory)) {
        try {
          const entries2 = await client.listDirectory(directory, controller.signal, {
            // Hashes are the most reliable "unchanged" signal. Servers that
            // ignore hash=1 return null, and we fall back to size + mtime.
            hash: true
          });
          directoryCache.set(
            directory,
            new Map(entries2.map((entry) => [entry.name, entry]))
          );
        } catch (error) {
          if (isSessionError(error)) {
            result.sessionExpired = true;
            result.fatalError = error;
            return result;
          }
          if (error instanceof KaggleError && error.kind === "cancelled") {
            result.cancelled = true;
            return result;
          }
          if (error instanceof KaggleError && error.kind === "notFound") {
            directoryCache.set(directory, /* @__PURE__ */ new Map());
          } else {
            log2(
              `\u65E0\u6CD5\u68C0\u67E5\u5DE5\u4F5C\u76EE\u5F55 \u201C${directory || "/"}\u201D\uFF0C\u8BE5\u76EE\u5F55\u4E0B\u7684\u6587\u4EF6\u5C06\u76F4\u63A5\u4E0A\u4F20\uFF1A${shortError(error)}`
            );
            directoryCache.set(directory, null);
          }
        }
      }
      const entries = directoryCache.get(directory) ?? null;
      if (!entries) {
        result.uploads.push(plan);
        continue;
      }
      const name = plan.remotePath.slice(plan.remotePath.lastIndexOf("/") + 1);
      const remote = entries.get(name);
      if (!remote) {
        result.uploads.push(plan);
        continue;
      }
      const clockOffsetMs = client.getClockOffsetMs();
      const remoteMtime = typeof remote.lastModified === "number" ? remote.lastModified - clockOffsetMs : void 0;
      const mtimeSuggestsUnchanged = remoteMtime === void 0 || remoteMtime >= plan.mtime - UPLOAD_MTIME_TOLERANCE_MS;
      let localHash;
      if (remote.hash && remote.hashAlgorithm && (remote.size === void 0 || remote.size === plan.size) && // Avoid hashing (reading) files that are clearly newer locally.
      mtimeSuggestsUnchanged && (config.skipUnchanged || detectRemoteNewer)) {
        try {
          localHash = await hashLocalFile(plan.uri, remote.hashAlgorithm);
          if (localHash === void 0) {
            log2(
              `Jupyter \u8FD4\u56DE\u7684 hash \u7B97\u6CD5 \u201C${remote.hashAlgorithm}\u201D \u4E0D\u53D7\u652F\u6301\uFF0C\u6539\u7528\u5927\u5C0F/\u65F6\u95F4\u5224\u65AD\uFF1A${plan.remotePath}`
            );
          }
        } catch (error) {
          log2(
            `\u65E0\u6CD5\u8BFB\u53D6\u672C\u5730\u6587\u4EF6\u8BA1\u7B97 hash\uFF0C\u5C06\u76F4\u63A5\u4E0A\u4F20\uFF1A${plan.localPath}\uFF1A${shortError(error)}`
          );
          result.uploads.push(plan);
          continue;
        }
      }
      const decision = decideUpload({
        localSize: plan.size,
        localMtime: plan.mtime,
        remote,
        localHash,
        clockOffsetMs
      });
      if (decision === "unchanged") {
        if (config.skipUnchanged) {
          result.unchanged.push(plan);
          log2(`\u8DF3\u8FC7\u672A\u4FEE\u6539\u6587\u4EF6\uFF1A${plan.remotePath}`);
        } else {
          result.uploads.push(plan);
        }
      } else if (decision === "remoteNewer") {
        if (detectRemoteNewer) {
          result.remoteNewer.push(plan);
        } else {
          result.uploads.push(plan);
        }
      } else if (decision === "remoteIsDirectory") {
        result.failures.push({
          localPath: plan.localPath,
          remotePath: plan.remotePath,
          error: new KaggleError(
            "badRequest",
            `\u8FDC\u7AEF\u540C\u8DEF\u5F84\u5DF2\u5B58\u5728\u4E00\u4E2A\u76EE\u5F55\uFF1A${plan.remotePath}`,
            { hint: "\u8BF7\u4FEE\u6539\u672C\u5730\u6587\u4EF6\u540D\uFF0C\u6216\u5148\u5728\u8FDC\u7AEF\u5220\u9664\u540C\u540D\u76EE\u5F55\u3002" }
          )
        });
      } else {
        result.uploads.push(plan);
      }
    }
  } finally {
    cancellation.dispose();
  }
  log2(
    `\u8FDC\u7AEF\u68C0\u67E5\u5B8C\u6210\uFF1A\u5F85\u4E0A\u4F20 ${result.uploads.length}\uFF0C\u672A\u4FEE\u6539 ${result.unchanged.length}\uFF0C\u8FDC\u7AEF\u8F83\u65B0 ${result.remoteNewer.length}\uFF0C\u8DEF\u5F84\u51B2\u7A81 ${result.failures.length}\u3002`
  );
  return result;
}
async function hashLocalFile(uri, algorithm) {
  const name = normalizeHashAlgorithm(algorithm);
  if (!name) {
    return void 0;
  }
  const bytes = await vscode5.workspace.fs.readFile(uri);
  return (0, import_node_crypto3.createHash)(name).update(bytes).digest("hex");
}
function normalizeHashAlgorithm(value) {
  const algorithm = value.trim().toLowerCase();
  return (0, import_node_crypto3.getHashes)().includes(algorithm) ? algorithm : void 0;
}
async function executeUpload(client, plans, initialFailures, config, progress, token, log2) {
  const controller = new AbortController();
  const cancellation = token.onCancellationRequested(() => controller.abort());
  const failures = [...initialFailures];
  let uploaded = 0;
  let fileFailures = 0;
  let completed = 0;
  let sessionExpired = false;
  try {
    const directories = [
      ...new Set(plans.map((plan) => dirnameRemotePath(plan.remotePath)).filter(Boolean))
    ];
    if (directories.length > 0) {
      progress.report({ message: "\u521B\u5EFA\u5DE5\u4F5C\u76EE\u5F55\u2026" });
      try {
        await withRetries(
          () => client.ensureDirectories(directories, controller.signal),
          config.retryCount,
          controller.signal,
          {
            cancelMessage: "\u4E0A\u4F20\u5DF2\u53D6\u6D88",
            onRetry: (attempt, error, delayMs) => {
              log2(
                `\u521B\u5EFA\u5DE5\u4F5C\u76EE\u5F55\u5931\u8D25\uFF0C${delayMs} ms \u540E\u91CD\u8BD5\uFF08${attempt}/${config.retryCount}\uFF09\uFF1A${shortError(error)}`
              );
            }
          }
        );
      } catch (error) {
        if (!(error instanceof KaggleError && error.kind === "cancelled")) {
          for (const plan of plans) {
            failures.push({
              localPath: plan.localPath,
              remotePath: plan.remotePath,
              error
            });
          }
          fileFailures = plans.length;
          sessionExpired = isSessionError(error);
          log2(`\u521B\u5EFA\u5DE5\u4F5C\u76EE\u5F55\u5931\u8D25: ${String(error)}`);
        }
      }
    }
    if (!controller.signal.aborted && fileFailures === 0 && plans.length > 0) {
      let cursor = 0;
      const largestFile = plans.reduce((max, plan) => Math.max(max, plan.size), 0);
      const largeFileLimit = largestFile > 50 * 1024 * 1024 ? 1 : largestFile > 20 * 1024 * 1024 ? 2 : config.concurrency;
      const workerCount = Math.max(
        1,
        Math.min(config.concurrency, largeFileLimit, plans.length)
      );
      const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
          if (controller.signal.aborted) {
            return;
          }
          const index = cursor;
          cursor += 1;
          if (index >= plans.length) {
            return;
          }
          const plan = plans[index];
          try {
            let bytes;
            try {
              bytes = await vscode5.workspace.fs.readFile(plan.uri);
            } catch (error) {
              throw localFileError("\u8BFB\u53D6\u672C\u5730\u6587\u4EF6\u5931\u8D25", error);
            }
            const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            await withRetries(
              () => client.putFile(plan.remotePath, buffer, controller.signal),
              config.retryCount,
              controller.signal,
              {
                cancelMessage: "\u4E0A\u4F20\u5DF2\u53D6\u6D88",
                onRetry: (attempt, error, delayMs) => {
                  log2(
                    `\u4E0A\u4F20\u5931\u8D25\uFF0C${delayMs} ms \u540E\u91CD\u8BD5\uFF08${attempt}/${config.retryCount}\uFF09\uFF1A${plan.remotePath}\uFF1A${shortError(error)}`
                  );
                }
              }
            );
            uploaded += 1;
            log2(`\u4E0A\u4F20\u6210\u529F: ${plan.localPath} -> ${plan.remotePath}`);
          } catch (error) {
            if (!(error instanceof KaggleError && error.kind === "cancelled")) {
              failures.push({
                localPath: plan.localPath,
                remotePath: plan.remotePath,
                error
              });
              fileFailures += 1;
              log2(`\u4E0A\u4F20\u5931\u8D25: ${plan.localPath} -> ${plan.remotePath}: ${String(error)}`);
              if (isSessionError(error)) {
                sessionExpired = true;
                controller.abort();
              }
            }
          } finally {
            completed += 1;
            progress.report({
              increment: 100 / Math.max(plans.length, 1),
              message: `${completed}/${plans.length} ${path3.basename(plan.localPath)}`
            });
          }
        }
      });
      await Promise.all(workers);
    }
  } finally {
    cancellation.dispose();
  }
  return {
    total: plans.length + initialFailures.length,
    uploaded,
    failed: initialFailures.length + fileFailures,
    skipped: plans.length - uploaded - fileFailures,
    unchanged: 0,
    skippedNewer: 0,
    cancelled: token.isCancellationRequested && !sessionExpired,
    sessionExpired,
    failures
  };
}
function localFileError(message, error) {
  return new KaggleError("unknown", message, {
    detail: error instanceof Error ? error.message : String(error),
    hint: "\u68C0\u67E5\u672C\u5730\u6587\u4EF6\u662F\u5426\u5B58\u5728\u3001\u662F\u5426\u53EF\u8BFB\uFF0C\u4EE5\u53CA\u662F\u5426\u88AB\u5176\u4ED6\u7A0B\u5E8F\u5360\u7528\u3002",
    cause: error
  });
}
function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// src/remoteWorkspaceService.ts
var RemoteWorkspaceService = class {
  constructor(options) {
    this.options = options;
  }
  operationInProgress = false;
  async openItems(rawItems) {
    const files = rawItems.filter((item) => item.entryType !== "directory" && !item.isRoot);
    if (files.length === 0) {
      return;
    }
    if (files.length > 10) {
      const choice = await vscode6.window.showWarningMessage(
        `\u786E\u5B9A\u540C\u65F6\u6253\u5F00\u9009\u4E2D\u7684 ${files.length} \u4E2A\u8FDC\u7AEF\u6587\u4EF6\uFF1F`,
        { modal: true },
        "\u7EE7\u7EED\u6253\u5F00",
        "\u53D6\u6D88"
      );
      if (choice !== "\u7EE7\u7EED\u6253\u5F00") {
        return;
      }
    }
    const showOptions = files.length > 1 ? { preview: false } : void 0;
    for (const item of files) {
      const normalized = normalizeRemotePath(item.path);
      if (!normalized) {
        continue;
      }
      const uri = vscode6.Uri.from({
        scheme: REMOTE_SCHEME,
        path: `/${normalized}`
      });
      await vscode6.commands.executeCommand("vscode.openWith", uri, "default", showOptions);
      const editor = vscode6.window.visibleTextEditors.find(
        (candidate) => candidate.document.uri.toString() === uri.toString()
      ) ?? vscode6.window.activeTextEditor;
      if (editor && editor.document.uri.toString() === uri.toString()) {
        const languageId = languageIdForRemotePath(normalized);
        if (languageId && editor.document.languageId !== languageId) {
          await vscode6.languages.setTextDocumentLanguage(editor.document, languageId);
        }
      }
      this.options.log(`\u6253\u5F00\u8FDC\u7AEF\u6587\u4EF6: ${normalized}`);
    }
  }
  async downloadItems(rawItems) {
    const items = normalizeSelectionItems(rawItems);
    if (items.length === 0) {
      return;
    }
    await this.withRemoteClient(async (client) => {
      if (items.length === 1) {
        const only = items[0];
        if (only.entryType === "directory" || only.isRoot) {
          await this.downloadDirectory(client, only.path);
        } else {
          await this.downloadFile(client, only.path, only.entryType, only.entrySize);
        }
        return;
      }
      await this.downloadMultiple(client, items);
    });
  }
  async createEntry(parent, isDirectory, inlineName) {
    const targetParent = normalizeRemotePath(parent);
    let name;
    if (inlineName !== void 0) {
      const validation = validateEntryName(inlineName);
      if (validation) {
        void vscode6.window.showErrorMessage(validation);
        return;
      }
      name = inlineName.trim();
    } else {
      const input = await vscode6.window.showInputBox({
        title: isDirectory ? "\u65B0\u5EFA\u8FDC\u7AEF\u6587\u4EF6\u5939" : "\u65B0\u5EFA\u8FDC\u7AEF\u6587\u4EF6",
        prompt: `\u5728 \u201C${targetParent || "/"}\u201D \u4E0B\u521B\u5EFA${isDirectory ? "\u6587\u4EF6\u5939" : "\u6587\u4EF6"}\u3002`,
        placeHolder: isDirectory ? "\u6587\u4EF6\u5939\u540D" : "\u6587\u4EF6\u540D\uFF0C\u4F8B\u5982 notes.md",
        ignoreFocusOut: true,
        validateInput: validateEntryName
      });
      if (input === void 0) {
        return;
      }
      name = input.trim();
    }
    await this.withRemoteClient(async (client) => {
      const target = joinRemotePath(targetParent, name);
      if (await remoteExists(client, target)) {
        throw new KaggleError("badRequest", `\u76EE\u6807\u8DEF\u5F84\u5DF2\u5B58\u5728\uFF1A${target}`);
      }
      const retryCount = getRetryCount();
      if (isDirectory) {
        await withRetries(() => client.putDirectory(target), retryCount);
        this.options.log(`\u65B0\u5EFA\u8FDC\u7AEF\u6587\u4EF6\u5939: ${target}`);
      } else {
        const bytes = name.toLowerCase().endsWith(".ipynb") ? Buffer.from(
          `${JSON.stringify(
            { cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 },
            null,
            2
          )}
`,
          "utf8"
        ) : Buffer.alloc(0);
        await withRetries(() => client.putFile(target, bytes), retryCount);
        this.options.log(`\u65B0\u5EFA\u8FDC\u7AEF\u6587\u4EF6: ${target}`);
      }
      this.options.onMutated({ parents: [targetParent] });
      if (isDirectory) {
        this.options.onWorkingDirCreated();
      }
      vscode6.window.setStatusBarMessage(`$(check) \u5DF2\u521B\u5EFA ${target}`, 3e3);
      if (!isDirectory && inlineName === void 0) {
        await this.openItems([
          {
            path: target,
            entryType: name.toLowerCase().endsWith(".ipynb") ? "notebook" : "file"
          }
        ]);
      }
    });
  }
  async renameItem(item, inlineNewName) {
    const remotePath = normalizeRemotePath(item.path);
    if (!remotePath) {
      return;
    }
    const isRoot = Boolean(item.isRoot);
    const isDirectory = item.entryType === "directory" || isRoot;
    const base = remoteBasename(remotePath);
    let normalizedTarget;
    if (inlineNewName !== void 0) {
      const validation = validateEntryName(inlineNewName);
      if (validation) {
        void vscode6.window.showErrorMessage(validation);
        return;
      }
      normalizedTarget = joinRemotePath(dirnameRemotePath(remotePath), inlineNewName.trim());
    } else if (isRoot) {
      const target = await vscode6.window.showInputBox({
        title: "\u91CD\u547D\u540D / \u79FB\u52A8\u8FDC\u7AEF\u5DE5\u4F5C\u76EE\u5F55",
        prompt: "\u8F93\u5165\u65B0\u7684\u5B8C\u6574\u8FDC\u7AEF\u8DEF\u5F84\uFF1B\u53EF\u4EE5\u6539\u540D\uFF0C\u4E5F\u53EF\u4EE5\u79FB\u52A8\u5230\u5176\u4ED6\u76EE\u5F55\u3002",
        value: remotePath,
        ignoreFocusOut: true,
        validateInput: (value) => {
          try {
            const normalized = normalizeRemotePath(value);
            if (!normalized) {
              return "\u76EE\u6807\u8DEF\u5F84\u4E0D\u80FD\u4E3A\u7A7A";
            }
            if (normalized !== remotePath && isRemoteInsideOrEqual(remotePath, normalized)) {
              return "\u4E0D\u80FD\u628A\u6587\u4EF6\u5939\u79FB\u52A8\u5230\u5B83\u81EA\u5DF1\u5185\u90E8";
            }
            return void 0;
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          }
        }
      });
      if (target === void 0) {
        return;
      }
      normalizedTarget = normalizeRemotePath(target);
    } else {
      const dot = !isDirectory ? base.lastIndexOf(".") : -1;
      const input = await vscode6.window.showInputBox({
        title: `\u91CD\u547D\u540D${isDirectory ? "\u6587\u4EF6\u5939" : "\u6587\u4EF6"}`,
        prompt: `\u8F93\u5165 \u201C${base}\u201D \u7684\u65B0\u540D\u79F0`,
        value: base,
        valueSelection: dot > 0 ? [0, dot] : void 0,
        ignoreFocusOut: true,
        validateInput: validateEntryName
      });
      if (input === void 0) {
        return;
      }
      normalizedTarget = joinRemotePath(dirnameRemotePath(remotePath), input.trim());
    }
    if (!normalizedTarget || normalizedTarget === remotePath) {
      return;
    }
    await this.withRemoteClient(async (client) => {
      await prepareRemoteTarget(client, normalizedTarget);
      if (await remoteExists(client, normalizedTarget)) {
        throw new KaggleError("badRequest", `\u76EE\u6807\u8DEF\u5F84\u5DF2\u5B58\u5728\uFF1A${normalizedTarget}`);
      }
      this.options.log(`\u91CD\u547D\u540D/\u79FB\u52A8\u8FDC\u7AEF: ${remotePath} -> ${normalizedTarget}`);
      await withRetries(
        () => client.renameContents(remotePath, normalizedTarget),
        getRetryCount()
      );
      if (isRoot) {
        await setRemoteDir(normalizedTarget);
        this.options.onRemoteDirUpdated();
        this.options.onMutated({ fullRefresh: true });
        vscode6.window.setStatusBarMessage(
          `$(check) \u5DF2\u79FB\u52A8\u5DE5\u4F5C\u76EE\u5F55\uFF0C\u5E76\u66F4\u65B0\u4E3A \u201C${normalizedTarget}\u201D`,
          4e3
        );
        return;
      }
      this.options.onMutated({
        invalidate: [remotePath],
        parents: [dirnameRemotePath(remotePath), dirnameRemotePath(normalizedTarget)]
      });
      vscode6.window.setStatusBarMessage(
        `$(check) \u5DF2\u91CD\u547D\u540D\u4E3A ${remoteBasename(normalizedTarget)}`,
        3e3
      );
    });
  }
  async deleteItems(rawItems) {
    const items = normalizeSelectionItems(rawItems);
    if (items.length === 0) {
      return;
    }
    await this.withRemoteClient(async (client) => {
      if (items.length === 1) {
        await this.deleteSingle(client, items[0]);
        return;
      }
      await this.deleteMultiple(client, items);
    });
  }
  async transferItems(rawItems, targetDir, mode) {
    const items = normalizeSelectionItems(rawItems);
    if (items.length === 0) {
      return false;
    }
    if (items.some((item) => item.isRoot)) {
      void vscode6.window.showErrorMessage("\u4E0D\u652F\u6301\u590D\u5236\u6216\u79FB\u52A8\u5DE5\u4F5C\u533A\u6839\u76EE\u5F55\u3002");
      return false;
    }
    const normalizedTargetDir = normalizeRemotePath(targetDir);
    let completedCleanly = false;
    await this.withRemoteClient(async (client) => {
      const retryCount = getRetryCount();
      const targetEntries = await withRetries(
        () => client.listDirectory(normalizedTargetDir),
        retryCount
      );
      const existingNames = new Set(targetEntries.map((entry) => entry.name));
      const plan = planBatchTransfer(items, normalizedTargetDir, mode, existingNames);
      if (plan.selfContainmentErrors.length > 0) {
        throw new KaggleError("badRequest", plan.selfContainmentErrors[0]);
      }
      if (plan.duplicateTargetErrors.length > 0) {
        throw new KaggleError("badRequest", plan.duplicateTargetErrors[0]);
      }
      if (plan.entries.length === 0) {
        completedCleanly = plan.skippedSameParent > 0;
        return;
      }
      const conflicts = plan.entries.filter((entry) => entry.conflict);
      let conflictAction = "skip";
      if (conflicts.length > 0) {
        const detail = conflicts.slice(0, 5).map((entry) => entry.baseName).join("\n");
        const options = mode === "copy" ? ["\u4FDD\u7559\u4E24\u8005\uFF08\u526F\u672C\uFF09", "\u8986\u76D6", "\u8DF3\u8FC7\u51B2\u7A81", "\u53D6\u6D88"] : ["\u8986\u76D6", "\u8DF3\u8FC7\u51B2\u7A81", "\u53D6\u6D88"];
        const choice = await vscode6.window.showWarningMessage(
          `\u76EE\u6807\u76EE\u5F55 \u201C${normalizedTargetDir || "/"}\u201D \u4E2D\u5DF2\u5B58\u5728 ${conflicts.length} \u4E2A\u540C\u540D\u9879\u76EE\uFF1A`,
          {
            modal: true,
            detail: conflicts.length > 5 ? `${detail}
\u2026 \u53E6\u6709 ${conflicts.length - 5} \u9879` : detail
          },
          ...options
        );
        if (!choice || choice === "\u53D6\u6D88") {
          return;
        }
        if (choice === "\u8986\u76D6") {
          conflictAction = "overwrite";
        } else if (choice === "\u4FDD\u7559\u4E24\u8005\uFF08\u526F\u672C\uFF09") {
          conflictAction = "keepBoth";
        } else {
          conflictAction = "skip";
        }
      }
      const reservedNames = new Set(existingNames);
      const executions = [];
      for (const entry of plan.entries) {
        if (!entry.conflict) {
          reservedNames.add(entry.baseName);
          executions.push({
            source: entry.source,
            target: entry.target,
            isDirectory: entry.isDirectory,
            overwrite: false
          });
          continue;
        }
        if (conflictAction === "skip") {
          continue;
        }
        if (conflictAction === "overwrite") {
          executions.push({
            source: entry.source,
            target: entry.target,
            isDirectory: entry.isDirectory,
            overwrite: true
          });
          continue;
        }
        const uniqueTarget = uniqueCopyPath(
          normalizedTargetDir,
          entry.baseName,
          entry.isDirectory,
          reservedNames
        );
        reservedNames.add(remoteBasename(uniqueTarget));
        executions.push({
          source: entry.source,
          target: uniqueTarget,
          isDirectory: entry.isDirectory,
          overwrite: false
        });
      }
      if (executions.length === 0) {
        return;
      }
      let succeededCount = 0;
      let copiedFilesCount = 0;
      const movedSources = [];
      const sourceParents = /* @__PURE__ */ new Set();
      const failures = [];
      let sessionExpiredError;
      let cancelled = false;
      await vscode6.window.withProgress(
        {
          location: vscode6.ProgressLocation.Notification,
          title: mode === "move" ? `\u79FB\u52A8 ${executions.length} \u4E2A\u8FDC\u7AEF\u9879\u76EE` : `\u590D\u5236 ${executions.length} \u4E2A\u8FDC\u7AEF\u9879\u76EE`,
          cancellable: true
        },
        async (progress, token) => {
          const controller = new AbortController();
          const cancellation = token.onCancellationRequested(() => controller.abort());
          try {
            for (let index = 0; index < executions.length; index += 1) {
              if (controller.signal.aborted) {
                cancelled = true;
                break;
              }
              const item = executions[index];
              progress.report({
                increment: 100 / executions.length,
                message: `${index + 1}/${executions.length} ${remoteBasename(item.source)}`
              });
              try {
                if (item.overwrite) {
                  try {
                    await this.deleteSingleRemotePath(
                      client,
                      item.target,
                      true,
                      retryCount,
                      controller.signal
                    );
                  } catch (error) {
                    if (!(error instanceof KaggleError && error.kind === "notFound")) {
                      throw error;
                    }
                  }
                }
                if (mode === "move") {
                  this.options.log(`\u79FB\u52A8\u8FDC\u7AEF: ${item.source} -> ${item.target}`);
                  await withRetries(
                    () => client.renameContents(item.source, item.target, controller.signal),
                    retryCount,
                    controller.signal,
                    {
                      cancelMessage: "\u79FB\u52A8\u5DF2\u53D6\u6D88",
                      onRetry: (attempt, error, delayMs) => {
                        this.options.log(
                          `\u79FB\u52A8\u5931\u8D25\uFF0C${delayMs} ms \u540E\u91CD\u8BD5\uFF08${attempt}/${retryCount}\uFF09\uFF1A${item.source}\uFF1A${shortError(error)}`
                        );
                      }
                    }
                  );
                  succeededCount += 1;
                  movedSources.push(item.source);
                  sourceParents.add(dirnameRemotePath(item.source));
                } else {
                  this.options.log(`\u590D\u5236\u8FDC\u7AEF: ${item.source} -> ${item.target}`);
                  try {
                    copiedFilesCount += await copyRemoteTree(
                      client,
                      item.source,
                      item.target,
                      item.isDirectory,
                      retryCount,
                      controller.signal,
                      progress,
                      this.options.log
                    );
                  } catch (error) {
                    try {
                      await this.deleteSingleRemotePath(
                        client,
                        item.target,
                        item.isDirectory,
                        0
                      );
                    } catch {
                    }
                    throw error;
                  }
                  succeededCount += 1;
                  movedSources.push(item.source);
                  sourceParents.add(dirnameRemotePath(item.source));
                }
              } catch (error) {
                if (error instanceof KaggleError && error.kind === "cancelled") {
                  cancelled = true;
                  break;
                }
                failures.push({ source: item.source, error });
                this.options.log(
                  `${mode === "move" ? "\u79FB\u52A8" : "\u590D\u5236"}\u5931\u8D25: ${item.source}: ${describeError(error)}`
                );
                if (isSessionError(error)) {
                  sessionExpiredError = error;
                  controller.abort();
                  break;
                }
              }
            }
          } finally {
            cancellation.dispose();
          }
        }
      );
      if (succeededCount > 0) {
        this.options.onMutated({
          invalidate: mode === "move" ? movedSources : [],
          parents: [...sourceParents, normalizedTargetDir]
        });
      }
      if (sessionExpiredError) {
        this.options.connectionState.markDisconnected();
        this.options.probes.invalidate();
        await this.promptFailure(
          `${mode === "move" ? "\u79FB\u52A8" : "\u590D\u5236"}\u4E2D\u65AD\uFF1AKaggle \u4F1A\u8BDD\u53EF\u80FD\u5DF2\u8FC7\u671F\uFF08\u6210\u529F ${succeededCount}\uFF0C\u5931\u8D25 ${failures.length}\uFF09\u3002`,
          { offerUpdateUrl: true, level: "error" }
        );
        return;
      }
      if (cancelled) {
        vscode6.window.setStatusBarMessage(
          `\u5DF2\u53D6\u6D88${mode === "move" ? "\u79FB\u52A8" : "\u590D\u5236"}\uFF08\u5DF2\u5B8C\u6210 ${succeededCount} \u9879\uFF09`,
          3e3
        );
        return;
      }
      if (failures.length > 0) {
        const detailText = failures.slice(0, 3).map((item) => `${item.source}: ${shortError(item.error)}`).join("\n");
        await this.promptFailure(
          `${mode === "move" ? "\u79FB\u52A8" : "\u590D\u5236"}\u5B8C\u6210\uFF1A\u6210\u529F ${succeededCount}\uFF0C\u5931\u8D25 ${failures.length}\u3002
${detailText}`,
          { level: "warning" }
        );
        return;
      }
      completedCleanly = true;
      if (mode === "move") {
        vscode6.window.setStatusBarMessage(
          executions.length === 1 ? `$(check) \u5DF2\u79FB\u52A8\u5230 ${executions[0].target}` : `$(check) \u5DF2\u79FB\u52A8 ${succeededCount} \u4E2A\u9879\u76EE\u5230 ${normalizedTargetDir || "\u6839\u76EE\u5F55"}`,
          3e3
        );
      } else {
        vscode6.window.setStatusBarMessage(
          `$(check) \u5DF2\u590D\u5236 ${succeededCount} \u4E2A\u9879\u76EE\uFF08${copiedFilesCount} \u4E2A\u6587\u4EF6\uFF09\u5230 ${normalizedTargetDir || "\u6839\u76EE\u5F55"}`,
          3e3
        );
      }
    });
    return completedCleanly;
  }
  async withRemoteClient(action) {
    if (this.operationInProgress) {
      vscode6.window.setStatusBarMessage("\u53E6\u4E00\u4E2A\u8FDC\u7AEF\u64CD\u4F5C\u6B63\u5728\u8FDB\u884C\uFF0C\u8BF7\u7A0D\u5019\u3002", 3e3);
      return;
    }
    this.operationInProgress = true;
    let client;
    try {
      const url = await this.options.context.secrets.get(SECRET_KEY) ?? "";
      if (!url) {
        void vscode6.window.showErrorMessage("\u5C1A\u672A\u8BBE\u7F6E Kaggle Jupyter URL\u3002", "\u8BBE\u7F6E URL").then(
          (choice) => {
            if (choice === "\u8BBE\u7F6E URL") {
              void vscode6.commands.executeCommand("kaggleConnector.setServerUrl");
            }
          }
        );
        return;
      }
      client = this.options.clientFactory(url);
      const probe = await this.options.probes.probe(url);
      if (!probe.alive) {
        await this.promptFailure(
          probe.likelyExpired ? `Kaggle \u4F1A\u8BDD\u53EF\u80FD\u5DF2\u5931\u6548\uFF1A${shortError(probe.error)}` : `\u8FDE\u63A5\u5931\u8D25\uFF1A${shortError(probe.error)}`,
          { offerUpdateUrl: probe.likelyExpired, level: "error" }
        );
        return;
      }
      await action(client);
    } catch (error) {
      if (isConnectionError(error)) {
        this.options.connectionState.markDisconnected();
        this.options.probes.invalidate();
      }
      if (error instanceof KaggleError && error.kind === "cancelled") {
        vscode6.window.setStatusBarMessage("\u5DF2\u53D6\u6D88", 2e3);
        return;
      }
      this.options.log(`\u8FDC\u7AEF\u64CD\u4F5C\u5931\u8D25: ${describeError(error)}`);
      await this.promptFailure(`\u64CD\u4F5C\u5931\u8D25\uFF1A${shortError(error)}`, {
        offerUpdateUrl: isSessionError(error),
        level: "error"
      });
    } finally {
      this.operationInProgress = false;
      void client?.dispose();
    }
  }
  defaultLocalFolder() {
    return vscode6.workspace.workspaceFolders?.[0]?.uri ?? vscode6.Uri.file(os.homedir());
  }
  async downloadDirectory(client, remotePath) {
    const name = remoteBasename(remotePath) || "kaggle-working";
    const destination = await vscode6.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: "\u4E0B\u8F7D\u5230\u6B64\u6587\u4EF6\u5939",
      defaultUri: this.defaultLocalFolder()
    });
    if (!destination || destination.length === 0) {
      return;
    }
    const targetDirectory = vscode6.Uri.joinPath(destination[0], safeLocalName(name));
    const existing = await statSafe(targetDirectory);
    if (existing && (existing.type & vscode6.FileType.Directory) === 0) {
      throw new KaggleError(
        "badRequest",
        `\u672C\u5730\u76EE\u6807\u5DF2\u5B58\u5728\u4E14\u4E0D\u662F\u6587\u4EF6\u5939\uFF1A${targetDirectory.fsPath}`
      );
    }
    if (existing) {
      const choice = await vscode6.window.showWarningMessage(
        `\u672C\u5730\u6587\u4EF6\u5939 \u201C${targetDirectory.fsPath}\u201D \u5DF2\u5B58\u5728\uFF0C\u7EE7\u7EED\u4F1A\u8986\u76D6\u540C\u540D\u6587\u4EF6\u3002`,
        { modal: true },
        "\u7EE7\u7EED\u4E0B\u8F7D",
        "\u53D6\u6D88"
      );
      if (choice !== "\u7EE7\u7EED\u4E0B\u8F7D") {
        return;
      }
    }
    const concurrency = getConcurrency();
    const retryCount = getRetryCount();
    this.options.log(
      `\u4E0B\u8F7D\u8FDC\u7AEF\u6587\u4EF6\u5939: ${remotePath} -> ${targetDirectory.fsPath}\uFF08\u5E76\u53D1=${concurrency}\uFF0C\u91CD\u8BD5=${retryCount}\uFF09`
    );
    const summary = await vscode6.window.withProgress(
      {
        location: vscode6.ProgressLocation.Notification,
        title: `\u4E0B\u8F7D ${name}`,
        cancellable: true
      },
      async (progress, token) => {
        const controller = new AbortController();
        const cancellation = token.onCancellationRequested(() => controller.abort());
        let lastCompleted = 0;
        const uriFor = (parts) => parts.length > 0 ? vscode6.Uri.joinPath(targetDirectory, ...parts) : targetDirectory;
        try {
          return await downloadRemoteDirectory({
            client,
            remotePath,
            concurrency,
            retryCount,
            signal: controller.signal,
            ensureDirectory: (parts) => ensureLocalDirectory(uriFor(parts)),
            writeFile: async (parts, bytes) => {
              const target = uriFor(parts);
              try {
                await vscode6.workspace.fs.writeFile(target, bytes);
              } catch (error) {
                throw localFileSystemError("\u5199\u5165\u672C\u5730\u6587\u4EF6\u5931\u8D25", target, error);
              }
            },
            formatLocalPath: (parts) => uriFor(parts).fsPath,
            onProgress: (event) => {
              if (event.phase === "scanning") {
                progress.report({
                  message: `\u6B63\u5728\u626B\u63CF\u8FDC\u7AEF\u76EE\u5F55\uFF08\u5DF2\u53D1\u73B0 ${event.filesFound} \u4E2A\u6587\u4EF6\uFF09\u2026`
                });
                return;
              }
              const delta = Math.max(0, event.completed - lastCompleted);
              lastCompleted = event.completed;
              progress.report({
                increment: delta * 100 / Math.max(event.total, 1),
                message: `${event.completed}/${event.total} ${remoteBasename(event.currentPath)}`
              });
            },
            log: this.options.log
          });
        } finally {
          cancellation.dispose();
        }
      }
    );
    await this.notifyDownloadSummary(summary, targetDirectory);
  }
  async downloadFile(client, remotePath, entryType, entrySize) {
    const name = remoteBasename(remotePath) || "kaggle-working";
    const retryCount = getRetryCount();
    const defaultUri = vscode6.Uri.file(
      path4.join(this.defaultLocalFolder().fsPath, safeLocalName(name))
    );
    const saveUri = await vscode6.window.showSaveDialog({
      defaultUri,
      saveLabel: "\u4E0B\u8F7D"
    });
    if (!saveUri) {
      return;
    }
    this.options.log(`\u4E0B\u8F7D\u8FDC\u7AEF\u6587\u4EF6: ${remotePath} -> ${saveUri.fsPath}`);
    try {
      await vscode6.window.withProgress(
        {
          location: vscode6.ProgressLocation.Notification,
          title: `\u4E0B\u8F7D ${name}`,
          cancellable: true
        },
        async (_progress, token) => {
          const controller = new AbortController();
          const cancellation = token.onCancellationRequested(() => controller.abort());
          try {
            const bytes = await withRetries(
              () => client.downloadFile(remotePath, {
                signal: controller.signal,
                type: entryType,
                sizeHint: entrySize
              }),
              retryCount,
              controller.signal,
              {
                cancelMessage: "\u4E0B\u8F7D\u5DF2\u53D6\u6D88",
                onRetry: (attempt, error, delayMs) => {
                  this.options.log(
                    `\u4E0B\u8F7D\u5931\u8D25\uFF0C${delayMs} ms \u540E\u91CD\u8BD5\uFF08${attempt}/${retryCount}\uFF09\uFF1A${remotePath}\uFF1A${shortError(error)}`
                  );
                }
              }
            );
            try {
              await vscode6.workspace.fs.writeFile(saveUri, bytes);
            } catch (error) {
              throw localFileSystemError("\u5199\u5165\u672C\u5730\u6587\u4EF6\u5931\u8D25", saveUri, error);
            }
            vscode6.window.setStatusBarMessage(
              `$(check) \u5DF2\u4E0B\u8F7D ${name}\uFF08${formatSize(bytes.length)}\uFF09`,
              3e3
            );
            void vscode6.window.showInformationMessage(
              `\u5DF2\u4E0B\u8F7D\u5230 \u201C${saveUri.fsPath}\u201D\u3002`,
              "\u6253\u5F00",
              "\u5728\u6587\u4EF6\u5939\u4E2D\u663E\u793A"
            ).then((choice) => {
              if (choice === "\u6253\u5F00") {
                void vscode6.commands.executeCommand("vscode.open", saveUri);
              } else if (choice === "\u5728\u6587\u4EF6\u5939\u4E2D\u663E\u793A") {
                void vscode6.commands.executeCommand("revealFileInOS", saveUri);
              }
            });
          } finally {
            cancellation.dispose();
          }
        }
      );
    } catch (error) {
      if (error instanceof KaggleError && error.kind === "cancelled") {
        vscode6.window.setStatusBarMessage("\u5DF2\u53D6\u6D88\u4E0B\u8F7D", 2e3);
        return;
      }
      this.options.log(`\u4E0B\u8F7D\u6587\u4EF6\u5931\u8D25: ${remotePath}: ${describeError(error)}`);
      if (isConnectionError(error)) {
        this.options.connectionState.markDisconnected();
        this.options.probes.invalidate();
      }
      await this.promptFailure(
        isSessionError(error) ? `\u4E0B\u8F7D\u5931\u8D25\uFF1AKaggle \u4F1A\u8BDD\u53EF\u80FD\u5DF2\u8FC7\u671F\uFF08${shortError(error)}\uFF09\u3002` : `\u4E0B\u8F7D ${name} \u5931\u8D25\uFF1A${shortError(error)}`,
        { offerUpdateUrl: isSessionError(error), level: "error" }
      );
    }
  }
  async downloadMultiple(client, rawItems) {
    const planned = planMultiDownloadTargets(rawItems);
    if (planned.length === 0) {
      return;
    }
    const destination = await vscode6.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: "\u4E0B\u8F7D\u5230\u6B64\u6587\u4EF6\u5939",
      defaultUri: this.defaultLocalFolder()
    });
    if (!destination || destination.length === 0) {
      return;
    }
    const rootTarget = destination[0];
    const existingNames = [];
    for (const entry of planned) {
      const targetUri = vscode6.Uri.joinPath(rootTarget, ...entry.localParts);
      if (await statSafe(targetUri)) {
        existingNames.push(entry.localParts.join(path4.sep));
      }
    }
    if (existingNames.length > 0) {
      const preview = existingNames.slice(0, 5).join("\n");
      const detail = existingNames.length > 5 ? `${preview}
\u2026 \u53E6\u6709 ${existingNames.length - 5} \u9879` : preview;
      const choice = await vscode6.window.showWarningMessage(
        `\u76EE\u6807\u6587\u4EF6\u5939\u4E2D\u5DF2\u5B58\u5728 ${existingNames.length} \u4E2A\u540C\u540D\u6587\u4EF6\u6216\u6587\u4EF6\u5939\uFF0C\u7EE7\u7EED\u4F1A\u8986\u76D6\u540C\u540D\u6587\u4EF6\u3002`,
        { modal: true, detail },
        "\u7EE7\u7EED\u4E0B\u8F7D",
        "\u53D6\u6D88"
      );
      if (choice !== "\u7EE7\u7EED\u4E0B\u8F7D") {
        return;
      }
    }
    const concurrency = getConcurrency();
    const retryCount = getRetryCount();
    this.options.log(
      `\u6279\u91CF\u4E0B\u8F7D ${planned.length} \u4E2A\u8FDC\u7AEF\u9879\u76EE -> ${rootTarget.fsPath}\uFF08\u5E76\u53D1=${concurrency}\uFF0C\u91CD\u8BD5=${retryCount}\uFF09`
    );
    const summary = await vscode6.window.withProgress(
      {
        location: vscode6.ProgressLocation.Notification,
        title: `\u4E0B\u8F7D ${planned.length} \u4E2A\u9879\u76EE`,
        cancellable: true
      },
      async (progress, token) => {
        const controller = new AbortController();
        const cancellation = token.onCancellationRequested(() => controller.abort());
        let lastCompleted = 0;
        const uriFor = (parts) => parts.length > 0 ? vscode6.Uri.joinPath(rootTarget, ...parts) : rootTarget;
        try {
          return await downloadRemoteSelections({
            client,
            entries: planned.map(({ item, localParts }) => ({
              remotePath: item.path,
              relativeParts: localParts,
              type: item.entryType === "directory" ? "directory" : item.entryType === "notebook" ? "notebook" : "file",
              size: item.entrySize
            })),
            concurrency,
            retryCount,
            signal: controller.signal,
            ensureDirectory: (parts) => ensureLocalDirectory(uriFor(parts)),
            writeFile: async (parts, bytes) => {
              const target = uriFor(parts);
              try {
                await vscode6.workspace.fs.writeFile(target, bytes);
              } catch (error) {
                throw localFileSystemError("\u5199\u5165\u672C\u5730\u6587\u4EF6\u5931\u8D25", target, error);
              }
            },
            formatLocalPath: (parts) => uriFor(parts).fsPath,
            onProgress: (event) => {
              if (event.phase === "scanning") {
                progress.report({
                  message: `\u6B63\u5728\u626B\u63CF\u8FDC\u7AEF\u76EE\u5F55\uFF08\u5DF2\u53D1\u73B0 ${event.filesFound} \u4E2A\u6587\u4EF6\uFF09\u2026`
                });
                return;
              }
              const delta = Math.max(0, event.completed - lastCompleted);
              lastCompleted = event.completed;
              progress.report({
                increment: delta * 100 / Math.max(event.total, 1),
                message: `${event.completed}/${event.total} ${remoteBasename(event.currentPath)}`
              });
            },
            log: this.options.log
          });
        } finally {
          cancellation.dispose();
        }
      }
    );
    await this.notifyDownloadSummary(summary, rootTarget);
  }
  async notifyDownloadSummary(summary, targetDirectory) {
    this.options.log(
      `\u4E0B\u8F7D\u7ED3\u679C\uFF1A\u603B\u8BA1 ${summary.total}\uFF0C\u6210\u529F ${summary.downloaded}\uFF0C\u5931\u8D25 ${summary.failed}\uFF0C\u8DF3\u8FC7 ${summary.skipped}\uFF0C\u53D6\u6D88=${summary.cancelled}\uFF0C\u4F1A\u8BDD\u8FC7\u671F=${summary.sessionExpired}`
    );
    if (summary.sessionExpired) {
      this.options.connectionState.markDisconnected();
      this.options.probes.invalidate();
      await this.promptFailure(
        `\u4E0B\u8F7D\u4E2D\u65AD\uFF1AKaggle \u4F1A\u8BDD\u53EF\u80FD\u5DF2\u8FC7\u671F\u3002\u6210\u529F ${summary.downloaded}\uFF0C\u5931\u8D25 ${summary.failed}\uFF0C\u8DF3\u8FC7 ${summary.skipped}\u3002`,
        {
          offerUpdateUrl: true,
          revealUri: summary.downloaded > 0 ? targetDirectory : void 0,
          level: "error"
        }
      );
      return;
    }
    if (summary.cancelled) {
      if (summary.downloaded > 0 || summary.failed > 0) {
        await this.promptFailure(
          `\u5DF2\u53D6\u6D88\u4E0B\u8F7D\uFF1A\u6210\u529F ${summary.downloaded}\uFF0C\u5931\u8D25 ${summary.failed}\uFF0C\u8DF3\u8FC7 ${summary.skipped}\u3002`,
          {
            revealUri: summary.downloaded > 0 ? targetDirectory : void 0,
            level: "warning"
          }
        );
      }
      return;
    }
    const allConnectionFailed = summary.downloaded === 0 && summary.failed > 0 && summary.failures.every((failure) => isConnectionError(failure.error));
    if (summary.abortedByConnection || allConnectionFailed) {
      this.options.connectionState.markDisconnected();
      this.options.probes.invalidate();
      const headline = shortError(summary.fatalError ?? summary.failures[0]?.error);
      const prefix = summary.downloaded > 0 ? `\u4E0B\u8F7D\u4E2D\u65AD\uFF08\u5DF2\u4FDD\u5B58 ${summary.downloaded}\uFF0C\u5931\u8D25 ${summary.failed}\uFF0C\u8DF3\u8FC7 ${summary.skipped}\uFF09` : "\u4E0B\u8F7D\u5931\u8D25";
      await this.promptFailure(`${prefix}\uFF1A${headline}`, {
        revealUri: summary.downloaded > 0 ? targetDirectory : void 0,
        level: "error"
      });
      return;
    }
    if (summary.failed > 0) {
      const details = summary.failures.slice(0, 3).map((failure) => {
        const message = shortError(failure.error);
        return `${failure.remotePath}: ${message.length > 160 ? `${message.slice(0, 160)}\u2026` : message}`;
      });
      await this.promptFailure(
        `\u4E0B\u8F7D\u5B8C\u6210\uFF1A\u6210\u529F ${summary.downloaded}\uFF0C\u5931\u8D25 ${summary.failed}\u3002
${details.join("\n")}`,
        {
          revealUri: summary.downloaded > 0 ? targetDirectory : void 0,
          level: "warning"
        }
      );
      return;
    }
    void vscode6.window.showInformationMessage(
      `\u5DF2\u4E0B\u8F7D ${summary.downloaded} \u4E2A\u6587\u4EF6\u5230 \u201C${targetDirectory.fsPath}\u201D\u3002`,
      "\u5728\u6587\u4EF6\u5939\u4E2D\u663E\u793A"
    ).then((choice) => {
      if (choice === "\u5728\u6587\u4EF6\u5939\u4E2D\u663E\u793A") {
        void vscode6.commands.executeCommand("revealFileInOS", targetDirectory);
      }
    });
  }
  async deleteSingle(client, item) {
    const remotePath = item.path;
    const isRoot = Boolean(item.isRoot);
    const isDirectory = item.entryType === "directory" || isRoot;
    let detail = isDirectory ? `${remotePath}
\u6587\u4EF6\u5939\u53CA\u5176\u5185\u5BB9\u4F1A\u88AB\u9012\u5F52\u5220\u9664\uFF0C\u4E14\u65E0\u6CD5\u6062\u590D\u3002` : `${remotePath}
\u5220\u9664\u540E\u65E0\u6CD5\u6062\u590D\u3002`;
    if (isRoot) {
      detail += "\n\n\u8FD9\u662F\u5F53\u524D\u5DE5\u4F5C\u76EE\u5F55\uFF1B\u5220\u9664\u540E\u5DE5\u4F5C\u533A\u4F1A\u56DE\u9000\u5230 Jupyter \u6839\u76EE\u5F55\uFF0C\u4E0B\u6B21\u4E0A\u4F20\u4F1A\u81EA\u52A8\u91CD\u5EFA\u3002";
    }
    const choice = await vscode6.window.showWarningMessage(
      `\u786E\u5B9A\u5220\u9664\u8FDC\u7AEF${isDirectory ? "\u6587\u4EF6\u5939" : "\u6587\u4EF6"}\uFF1F`,
      { modal: true, detail },
      "\u5220\u9664",
      "\u53D6\u6D88"
    );
    if (choice !== "\u5220\u9664") {
      return;
    }
    this.options.log(`\u5220\u9664\u8FDC\u7AEF: ${remotePath}${isDirectory ? "\uFF08\u76EE\u5F55\uFF09" : ""}`);
    await this.deleteSingleRemotePath(client, remotePath, isDirectory, getRetryCount());
    if (isRoot) {
      this.options.onMutated({ fullRefresh: true });
      vscode6.window.setStatusBarMessage(
        `\u5DF2\u5220\u9664\u5DE5\u4F5C\u76EE\u5F55 \u201C${remotePath}\u201D\uFF1B\u91CD\u65B0\u52A0\u8F7D\u65F6\u4F1A\u81EA\u52A8\u91CD\u5EFA\u3002`,
        4e3
      );
      return;
    }
    this.options.onMutated({
      invalidate: [remotePath],
      parents: [dirnameRemotePath(remotePath)]
    });
    vscode6.window.setStatusBarMessage(`$(check) \u5DF2\u5220\u9664 ${remotePath}`, 3e3);
  }
  async deleteMultiple(client, rawItems) {
    const items = filterOutNestedRemotePaths(rawItems);
    if (items.length === 0) {
      return;
    }
    const preview = items.slice(0, 5).map((item) => item.path).join("\n");
    const detail = (items.length > 5 ? `${preview}
\u2026 \u53E6\u6709 ${items.length - 5} \u9879` : preview) + "\n\n\u6587\u4EF6\u5939\u53CA\u5176\u5185\u5BB9\u4F1A\u88AB\u9012\u5F52\u5220\u9664\uFF0C\u4E14\u65E0\u6CD5\u6062\u590D\u3002";
    const choice = await vscode6.window.showWarningMessage(
      `\u786E\u5B9A\u5220\u9664\u9009\u4E2D\u7684 ${items.length} \u4E2A\u8FDC\u7AEF\u9879\u76EE\uFF1F`,
      { modal: true, detail },
      "\u5220\u9664",
      "\u53D6\u6D88"
    );
    if (choice !== "\u5220\u9664") {
      return;
    }
    const retryCount = getRetryCount();
    const deletedPaths = [];
    const parentDirs = [];
    const failures = [];
    let sessionExpiredError;
    await vscode6.window.withProgress(
      {
        location: vscode6.ProgressLocation.Notification,
        title: `\u5220\u9664 ${items.length} \u4E2A\u8FDC\u7AEF\u9879\u76EE`,
        cancellable: true
      },
      async (progress, token) => {
        const controller = new AbortController();
        const cancellation = token.onCancellationRequested(() => controller.abort());
        try {
          for (let index = 0; index < items.length; index += 1) {
            if (controller.signal.aborted) {
              break;
            }
            const item = items[index];
            progress.report({
              increment: 100 / items.length,
              message: `${index + 1}/${items.length} ${remoteBasename(item.path)}`
            });
            try {
              const isDirectory = item.entryType === "directory" || Boolean(item.isRoot);
              this.options.log(`\u6279\u91CF\u5220\u9664\u8FDC\u7AEF: ${item.path}${isDirectory ? "\uFF08\u76EE\u5F55\uFF09" : ""}`);
              await this.deleteSingleRemotePath(
                client,
                item.path,
                isDirectory,
                retryCount,
                controller.signal
              );
              deletedPaths.push(item.path);
              parentDirs.push(dirnameRemotePath(item.path));
            } catch (error) {
              if (error instanceof KaggleError && error.kind === "cancelled") {
                break;
              }
              failures.push({ path: item.path, error });
              this.options.log(`\u5220\u9664\u5931\u8D25: ${item.path}: ${describeError(error)}`);
              if (isSessionError(error)) {
                sessionExpiredError = error;
                controller.abort();
                break;
              }
            }
          }
        } finally {
          cancellation.dispose();
        }
      }
    );
    if (deletedPaths.length > 0) {
      this.options.onMutated({
        invalidate: deletedPaths,
        parents: parentDirs
      });
    }
    if (sessionExpiredError) {
      this.options.connectionState.markDisconnected();
      this.options.probes.invalidate();
      await this.promptFailure(
        `\u5220\u9664\u4E2D\u65AD\uFF1AKaggle \u4F1A\u8BDD\u53EF\u80FD\u5DF2\u8FC7\u671F\uFF08\u5DF2\u5220\u9664 ${deletedPaths.length}\uFF0C\u5931\u8D25 ${failures.length}\uFF09\u3002`,
        { offerUpdateUrl: true, level: "error" }
      );
      return;
    }
    if (failures.length > 0) {
      const detailText = failures.slice(0, 3).map((item) => `${item.path}: ${shortError(item.error)}`).join("\n");
      await this.promptFailure(
        `\u6279\u91CF\u5220\u9664\u5B8C\u6210\uFF1A\u6210\u529F ${deletedPaths.length}\uFF0C\u5931\u8D25 ${failures.length}\u3002
${detailText}`,
        { level: "warning" }
      );
      return;
    }
    vscode6.window.setStatusBarMessage(`$(check) \u5DF2\u5220\u9664 ${deletedPaths.length} \u4E2A\u9879\u76EE`, 3e3);
  }
  async deleteSingleRemotePath(client, remotePath, isDirectory, retryCount, signal) {
    try {
      await withRetries(
        () => client.deleteContents(remotePath, signal),
        retryCount,
        signal,
        {
          cancelMessage: "\u5220\u9664\u5DF2\u53D6\u6D88",
          onRetry: (attempt, error, delayMs) => {
            this.options.log(
              `\u5220\u9664\u5931\u8D25\uFF0C${delayMs} ms \u540E\u91CD\u8BD5\uFF08${attempt}/${retryCount}\uFF09\uFF1A${remotePath}\uFF1A${shortError(error)}`
            );
          }
        }
      );
    } catch (error) {
      if (!isDirectory || !isNonEmptyDirectoryError(error)) {
        throw error;
      }
      this.options.log(`\u670D\u52A1\u5668\u62D2\u7EDD\u76F4\u63A5\u5220\u9664\u975E\u7A7A\u76EE\u5F55\uFF0C\u6539\u4E3A\u9010\u9879\u5220\u9664: ${remotePath}`);
      await deleteRemoteTree2(client, remotePath, this.options.log, retryCount, signal);
    }
  }
  async promptFailure(message, options) {
    const actions = [];
    if (options.offerUpdateUrl) {
      actions.push("\u66F4\u65B0 Jupyter URL");
    }
    if (options.revealUri) {
      actions.push("\u5728\u6587\u4EF6\u5939\u4E2D\u663E\u793A");
    }
    actions.push("\u67E5\u770B\u65E5\u5FD7");
    const show = options.level === "error" ? vscode6.window.showErrorMessage : vscode6.window.showWarningMessage;
    const choice = await show(message, ...actions);
    if (choice === "\u66F4\u65B0 Jupyter URL") {
      await vscode6.commands.executeCommand("kaggleConnector.setServerUrl");
    } else if (choice === "\u5728\u6587\u4EF6\u5939\u4E2D\u663E\u793A" && options.revealUri) {
      void vscode6.commands.executeCommand("revealFileInOS", options.revealUri);
    } else if (choice === "\u67E5\u770B\u65E5\u5FD7") {
      this.options.showOutput();
    }
  }
};
function normalizeSelectionItems(rawItems) {
  const result = [];
  for (const item of rawItems) {
    const normalized = normalizeRemotePath(item.path);
    if (!normalized) {
      continue;
    }
    result.push({
      path: normalized,
      entryType: item.entryType,
      entrySize: item.entrySize,
      isRoot: Boolean(item.isRoot)
    });
  }
  return result;
}
function isNonEmptyDirectoryError(error) {
  return error instanceof KaggleError && error.status === 400 && /not empty/i.test(error.detail ?? error.message);
}
async function prepareRemoteTarget(client, target) {
  const parent = dirnameRemotePath(target);
  if (!parent) {
    return;
  }
  try {
    const model = await client.getContents(parent);
    if (!model || typeof model !== "object" || model.type !== "directory") {
      throw new KaggleError("badRequest", `\u76EE\u6807\u7236\u8DEF\u5F84\u4E0D\u662F\u76EE\u5F55\uFF1A${parent}`);
    }
  } catch (error) {
    if (error instanceof KaggleError && error.kind === "notFound") {
      const choice = await vscode6.window.showWarningMessage(
        `\u76EE\u6807\u76EE\u5F55 \u201C${parent}\u201D \u4E0D\u5B58\u5728\uFF0C\u662F\u5426\u521B\u5EFA\uFF1F`,
        { modal: true },
        "\u521B\u5EFA\u5E76\u7EE7\u7EED",
        "\u53D6\u6D88"
      );
      if (choice !== "\u521B\u5EFA\u5E76\u7EE7\u7EED") {
        throw new KaggleError("cancelled", "\u5DF2\u53D6\u6D88");
      }
      await client.ensureDirectories([parent]);
      return;
    }
    throw error;
  }
}
async function remoteExists(client, remotePath) {
  try {
    await client.getContents(remotePath);
    return true;
  } catch (error) {
    if (error instanceof KaggleError && error.kind === "notFound") {
      return false;
    }
    throw error;
  }
}
async function deleteRemoteTree2(client, remotePath, log2, retryCount = 0, signal) {
  const entries = await withRetries(
    () => client.listDirectory(remotePath, signal),
    retryCount,
    signal,
    { cancelMessage: "\u5220\u9664\u5DF2\u53D6\u6D88" }
  );
  for (const entry of entries) {
    if (signal?.aborted) {
      throw new KaggleError("cancelled", "\u5220\u9664\u5DF2\u53D6\u6D88");
    }
    if (entry.type === "directory") {
      await deleteRemoteTree2(client, entry.path, log2, retryCount, signal);
    } else {
      await withRetries(
        () => client.deleteContents(entry.path, signal),
        retryCount,
        signal,
        { cancelMessage: "\u5220\u9664\u5DF2\u53D6\u6D88" }
      );
    }
  }
  await withRetries(
    () => client.deleteContents(remotePath, signal),
    retryCount,
    signal,
    { cancelMessage: "\u5220\u9664\u5DF2\u53D6\u6D88" }
  );
  log2(`\u5220\u9664\u76EE\u5F55\u5B8C\u6210: ${remotePath}`);
}
async function copyRemoteTree(client, source, target, isDirectory, retryCount, signal, progress, log2) {
  if (signal.aborted) {
    throw new KaggleError("cancelled", "\u590D\u5236\u5DF2\u53D6\u6D88");
  }
  const retry = (label, action) => withRetries(action, retryCount, signal, {
    cancelMessage: "\u590D\u5236\u5DF2\u53D6\u6D88",
    onRetry: (attempt, error, delayMs) => {
      log2(
        `${label}\u5931\u8D25\uFF0C${delayMs} ms \u540E\u91CD\u8BD5\uFF08${attempt}/${retryCount}\uFF09\uFF1A${shortError(error)}`
      );
    }
  });
  if (isDirectory) {
    await retry(`\u521B\u5EFA\u76EE\u5F55 ${target}`, () => client.putDirectory(target, signal));
    const entries = await retry(
      `\u5217\u51FA\u76EE\u5F55 ${source}`,
      () => client.listDirectory(source, signal)
    );
    let files = 0;
    for (const entry of entries) {
      if (SYSTEM_ENTRIES.has(entry.name)) {
        continue;
      }
      if (signal.aborted) {
        throw new KaggleError("cancelled", "\u590D\u5236\u5DF2\u53D6\u6D88");
      }
      files += await copyRemoteTree(
        client,
        entry.path,
        joinRemotePath(target, entry.name),
        entry.type === "directory",
        retryCount,
        signal,
        progress,
        log2
      );
    }
    return files;
  }
  const bytes = await retry(`\u8BFB\u53D6 ${source}`, () => client.readFile(source, signal));
  await retry(`\u5199\u5165 ${target}`, () => client.putFile(target, bytes, signal));
  progress.report({ message: `\u5DF2\u590D\u5236\uFF1A${target}` });
  log2(`\u590D\u5236\u6587\u4EF6: ${source} -> ${target}`);
  return 1;
}
async function statSafe(uri) {
  try {
    return await vscode6.workspace.fs.stat(uri);
  } catch {
    return void 0;
  }
}
async function ensureLocalDirectory(uri) {
  const stat = await statSafe(uri);
  if (stat) {
    if ((stat.type & vscode6.FileType.Directory) === 0) {
      throw new KaggleError("badRequest", `\u672C\u5730\u8DEF\u5F84\u4E0D\u662F\u6587\u4EF6\u5939\uFF1A${uri.fsPath}`);
    }
    return;
  }
  try {
    await vscode6.workspace.fs.createDirectory(uri);
  } catch (error) {
    throw localFileSystemError("\u521B\u5EFA\u672C\u5730\u6587\u4EF6\u5939\u5931\u8D25", uri, error);
  }
}
function localFileSystemError(action, uri, error) {
  return new KaggleError("unknown", `${action}\uFF1A${uri.fsPath}`, {
    detail: error instanceof Error ? error.message : String(error),
    hint: "\u68C0\u67E5\u672C\u5730\u8DEF\u5F84\u3001\u5199\u5165\u6743\u9650\u548C\u78C1\u76D8\u7A7A\u95F4\u3002",
    cause: error
  });
}
function languageIdForRemotePath(remotePath) {
  const name = remotePath.toLowerCase();
  const dot = name.lastIndexOf(".");
  const extension = dot >= 0 ? name.slice(dot + 1) : "";
  switch (extension) {
    case "py":
      return "python";
    case "ipynb":
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "yaml":
    case "yml":
      return "yaml";
    case "toml":
      return "toml";
    case "ts":
      return "typescript";
    case "js":
      return "javascript";
    case "html":
      return "html";
    case "css":
      return "css";
    case "sh":
    case "bash":
      return "shellscript";
    case "sql":
      return "sql";
    case "r":
      return "r";
    case "txt":
    case "log":
      return "plaintext";
    default:
      return void 0;
  }
}

// src/webview.ts
var vscode7 = __toESM(require("vscode"));
var ConnectionViewProvider = class {
  constructor(context, extensionUri, clientFactory, onChanged, onUrlChange, log2, connectionState, probes, onWorkingDirSync) {
    this.context = context;
    this.extensionUri = extensionUri;
    this.clientFactory = clientFactory;
    this.onChanged = onChanged;
    this.onUrlChange = onUrlChange;
    this.log = log2;
    this.connectionState = connectionState;
    this.probes = probes;
    this.onWorkingDirSync = onWorkingDirSync;
  }
  static viewType = "kaggleConnector.connection";
  view;
  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode7.Uri.joinPath(this.extensionUri, "media")]
    };
    view.webview.onDidReceiveMessage((message) => {
      void this.handleMessage(message);
    });
    view.onDidDispose(() => {
      if (this.view === view) {
        this.view = void 0;
      }
    });
    view.webview.html = this.html(view.webview);
    void this.refresh();
  }
  async refresh() {
    if (!this.view) {
      return;
    }
    await this.post({
      type: "state",
      state: await this.state()
    });
  }
  async state() {
    const url = await this.context.secrets.get(SECRET_KEY) ?? "";
    return {
      url,
      remoteDir: getRemoteDir(),
      pathMode: getPathMode(),
      hasUrl: Boolean(url)
    };
  }
  async handleMessage(message) {
    try {
      if (message.type === "ready") {
        await this.refresh();
        return;
      }
      if (message.type === "autosave") {
        await this.autosave(message);
        return;
      }
      if (message.type === "clearUrl") {
        await this.context.secrets.delete(SECRET_KEY);
        this.connectionState.syncUrl("");
        this.probes.invalidate();
        this.onUrlChange("", true);
        this.onChanged();
        await this.refresh();
        this.postStatus("info", "\u5DF2\u6E05\u9664 Jupyter URL");
        return;
      }
      const url = normalizeServerUrl(message.url ?? "");
      const remoteDir = normalizeRemotePath(message.remoteDir ?? "");
      if (!remoteDir) {
        throw new KaggleError("badRequest", "\u5DE5\u4F5C\u76EE\u5F55\u4E0D\u80FD\u4E3A\u7A7A", {
          hint: "\u586B\u5199\u4E00\u4E2A\u53EF\u5199\u76EE\u5F55\uFF0C\u4F8B\u5982 news_recommender\uFF1BKaggle \u4E0A\u5B9E\u9645\u4F4D\u4E8E /kaggle/working\u3002"
        });
      }
      if (message.type === "save") {
        const pathMode = message.pathMode === "basename" ? "basename" : "workspaceRelative";
        await this.context.secrets.store(SECRET_KEY, url);
        this.connectionState.syncUrl(url);
        this.probes.invalidate();
        this.onUrlChange(url, true);
        await setRemoteDir(remoteDir);
        await setPathMode(pathMode);
        this.onChanged();
        await this.refresh();
        const probe = await this.probes.probe(url);
        if (probe.alive) {
          this.onWorkingDirSync?.({ force: true });
        }
        this.postStatus(
          "success",
          "\u5DF2\u4FDD\u5B58\u3002URL \u5B58\u653E\u5728 VS Code SecretStorage\uFF0C\u4E0D\u4F1A\u5199\u5165 settings.json\u3002"
        );
        return;
      }
      if (message.type === "test") {
        const client = this.clientFactory(url);
        const persistedUrl = await this.context.secrets.get(SECRET_KEY) ?? "";
        const probe = persistedUrl === url ? await this.probes.probeFresh(url) : await client.probeSession(getProbeTimeoutMs());
        if (!probe.alive) {
          this.postStatus("error", shortError(probe.error));
          return;
        }
        if (persistedUrl === url) {
          this.onUrlChange(url, true);
          this.onWorkingDirSync?.({ force: true });
        }
        let result = await client.test(remoteDir);
        if (!result.exists && persistedUrl === url && remoteDir) {
          await client.ensureDirectories([remoteDir]);
          this.log(`\u8FDC\u7AEF\u5DE5\u4F5C\u76EE\u5F55\u4E0D\u5B58\u5728\uFF0C\u5DF2\u81EA\u52A8\u521B\u5EFA\u5E76\u8FDB\u5165: ${remoteDir}`);
          result = await client.test(remoteDir);
          this.onChanged();
        }
        if (!result.exists) {
          this.postStatus(
            "warning",
            `\u8FDE\u63A5\u6210\u529F\uFF0C\u4F46\u5DE5\u4F5C\u76EE\u5F55 \u201C${result.path}\u201D \u5C1A\u4E0D\u5B58\u5728\uFF0C\u4FDD\u5B58\u6216\u4E0A\u4F20\u65F6\u4F1A\u81EA\u52A8\u521B\u5EFA\u3002`
          );
        } else if (result.writable === false) {
          this.postStatus(
            "warning",
            `\u8FDE\u63A5\u6210\u529F\uFF0C\u4F46\u76EE\u5F55 \u201C${result.path}\u201D \u4E0D\u53EF\u5199\uFF08Kaggle \u53EA\u80FD\u5199 /kaggle/working\uFF09\u3002`
          );
        } else {
          this.postStatus(
            "success",
            `\u8FDE\u63A5\u6210\u529F\uFF1A${result.path || "Jupyter \u6839\u76EE\u5F55"}${result.writable === true ? "\uFF08\u53EF\u5199\uFF09" : ""}`
          );
        }
      }
    } catch (error) {
      if (isConnectionError(error)) {
        this.connectionState.markDisconnected();
        this.probes.invalidate();
      }
      if (error instanceof KaggleError && error.kind === "cancelled") {
        this.postStatus("info", "\u5DF2\u53D6\u6D88");
        return;
      }
      this.log(`\u64CD\u4F5C\u5931\u8D25: ${describeError(error)}`);
      this.postStatus("error", shortError(error));
    }
  }
  /**
   * Persist committed field values without resetting the form. This makes
   * valid values survive a VS Code restart even if the user never pressed
   * "保存". Invalid/partial input is ignored.
   */
  async autosave(message) {
    try {
      const url = normalizeServerUrl(message.url ?? "");
      const remoteDir = normalizeRemotePath(message.remoteDir ?? "");
      if (!remoteDir) {
        return;
      }
      const pathMode = message.pathMode === "basename" ? "basename" : "workspaceRelative";
      const currentUrl = await this.context.secrets.get(SECRET_KEY) ?? "";
      const currentDir = getRemoteDir();
      const currentMode = getPathMode();
      let changed = false;
      if (currentUrl !== url) {
        await this.context.secrets.store(SECRET_KEY, url);
        this.connectionState.syncUrl(url);
        this.probes.invalidate();
        this.onUrlChange(url, false);
        changed = true;
      }
      if (currentDir !== remoteDir) {
        await setRemoteDir(remoteDir);
        changed = true;
      }
      if (currentMode !== pathMode) {
        await setPathMode(pathMode);
        changed = true;
      }
      if (changed) {
        this.onChanged();
      }
    } catch {
    }
  }
  postStatus(kind, message) {
    void this.post({ type: "status", kind, message });
  }
  async post(message) {
    await this.view?.webview.postMessage(message);
  }
  html(webview) {
    const styleUri = webview.asWebviewUri(
      vscode7.Uri.joinPath(this.extensionUri, "media", "webview.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode7.Uri.joinPath(this.extensionUri, "media", "webview.js")
    );
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `script-src ${webview.cspSource}`
    ].join("; ");
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>Kaggle Connector</title>
</head>
<body>
  <div id="app" class="app">
    <section id="settingsPane" class="settings-pane" aria-label="\u8FDE\u63A5\u8BBE\u7F6E">
      <div class="settings-scroll">
        <div id="settingsBody" class="settings-body">
          <div class="label-row">
            <label for="url">Jupyter URL</label>
            <button class="info-button" type="button" data-help="url" aria-label="Jupyter URL \u8BF4\u660E" aria-expanded="false" title="\u67E5\u770B\u8BF4\u660E">
              <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6.15 6.3c0-1.15.85-1.95 1.9-1.95s1.9.8 1.9 1.9c0 1.5-1.9 1.6-1.9 3.05" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.05" cy="11.3" r="0.95" fill="currentColor"/></svg>
            </button>
          </div>
          <div class="row">
            <input id="url" type="password" autocomplete="off" spellcheck="false"
              placeholder="https://kkb-production.jupyter-proxy.kaggle.net/k/.../proxy">
            <button id="toggle" class="secondary" type="button">\u663E\u793A</button>
          </div>

          <div class="label-row">
            <label for="remoteDir">\u5DE5\u4F5C\u76EE\u5F55</label>
            <button class="info-button" type="button" data-help="remoteDir" aria-label="\u5DE5\u4F5C\u76EE\u5F55\u8BF4\u660E" aria-expanded="false" title="\u67E5\u770B\u8BF4\u660E">
              <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6.15 6.3c0-1.15.85-1.95 1.9-1.95s1.9.8 1.9 1.9c0 1.5-1.9 1.6-1.9 3.05" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.05" cy="11.3" r="0.95" fill="currentColor"/></svg>
            </button>
          </div>
          <input id="remoteDir" type="text" autocomplete="off" spellcheck="false"
            placeholder="\u4F8B\u5982 news_recommender">

          <div class="label-row">
            <label for="pathMode">\u8DEF\u5F84\u7B56\u7565</label>
            <button class="info-button" type="button" data-help="pathMode" aria-label="\u8DEF\u5F84\u7B56\u7565\u8BF4\u660E" aria-expanded="false" title="\u67E5\u770B\u8BF4\u660E">
              <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6.15 6.3c0-1.15.85-1.95 1.9-1.95s1.9.8 1.9 1.9c0 1.5-1.9 1.6-1.9 3.05" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.05" cy="11.3" r="0.95" fill="currentColor"/></svg>
            </button>
          </div>
          <select id="pathMode">
            <option value="workspaceRelative">\u4FDD\u7559\u5DE5\u4F5C\u533A\u76F8\u5BF9\u8DEF\u5F84</option>
            <option value="basename">\u4EC5\u6587\u4EF6\u540D</option>
          </select>

          <div class="actions">
            <button id="save" type="button">\u4FDD\u5B58</button>
            <button id="test" class="secondary" type="button">\u6D4B\u8BD5\u8FDE\u63A5</button>
            <button id="clear" class="secondary hidden" type="button">\u6E05\u9664 URL</button>
          </div>

          <div id="status" class="status"></div>
        </div>
        <div id="settingsScrollbar" class="custom-scrollbar" aria-hidden="true">
          <div id="settingsScrollbarThumb" class="custom-scrollbar-thumb"></div>
        </div>
      </div>
    </section>
  </div>

  <div id="helpPopover" class="help-popover hidden" role="tooltip"></div>

  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
};

// src/workingDirSync.ts
var WorkingDirSyncManager = class {
  constructor(options) {
    this.options = options;
  }
  lastSyncedKey;
  lastDirExisted;
  hasConfiguredStartup = false;
  inFlight;
  pendingOptions;
  disposed = false;
  /**
   * Synchronize remote kernel working directory configuration.
   * Concurrent calls coalesce; if options arrive mid-flight, one follow-up
   * run executes after the current one finishes.
   */
  async sync(syncOptions = {}) {
    if (this.disposed) {
      return void 0;
    }
    if (this.inFlight) {
      this.pendingOptions = mergeSyncOptions(this.pendingOptions, syncOptions);
      await this.inFlight;
      if (this.pendingOptions && !this.disposed) {
        const next = this.pendingOptions;
        this.pendingOptions = void 0;
        return this.sync(next);
      }
      return void 0;
    }
    const task = this.runOnce(syncOptions).finally(() => {
      if (this.inFlight === task) {
        this.inFlight = void 0;
      }
    });
    this.inFlight = task;
    const result = await task;
    if (this.pendingOptions && !this.disposed) {
      const next = this.pendingOptions;
      this.pendingOptions = void 0;
      return this.sync(next);
    }
    return result;
  }
  /**
   * Called after an upload or remote directory creation succeeds. If the
   * working directory did not exist when we first configured the startup
   * script, switch any currently idle kernels into it without spinning up a
   * temporary helper kernel.
   */
  async onRemoteDirCreated() {
    if (this.disposed || !this.options.state.connected || !this.options.isEnabled()) {
      return void 0;
    }
    if (this.lastDirExisted !== false) {
      return void 0;
    }
    const result = await this.sync({ force: true, onlyExistingIdle: true });
    this.lastDirExisted = true;
    return result;
  }
  /** Clear cached sync state (e.g. when the URL is cleared or disconnected). */
  reset() {
    this.lastSyncedKey = void 0;
    this.lastDirExisted = void 0;
    this.hasConfiguredStartup = false;
    this.pendingOptions = void 0;
  }
  dispose() {
    this.disposed = true;
    this.reset();
  }
  async runOnce(syncOptions) {
    if (!this.options.state.connected) {
      return void 0;
    }
    const url = (await this.options.loadUrl())?.trim();
    if (!url || !this.options.state.connected || this.disposed) {
      return void 0;
    }
    const enabled = this.options.isEnabled();
    let remoteDir = "";
    try {
      remoteDir = normalizeRemotePath(this.options.getRemoteDir());
    } catch {
      return void 0;
    }
    if (enabled && !remoteDir) {
      return void 0;
    }
    if (!enabled && !this.hasConfiguredStartup && !syncOptions.force) {
      return void 0;
    }
    const key = `${url}\0${enabled ? remoteDir : ""}\0${enabled ? "1" : "0"}`;
    if (!syncOptions.force && this.lastSyncedKey === key) {
      return void 0;
    }
    const client = this.options.clientFactory(url);
    try {
      const result = await client.configureKernelWorkingDir(remoteDir, {
        enabled,
        onlyExistingIdle: syncOptions.onlyExistingIdle
      });
      if (this.disposed) {
        return result;
      }
      if (!enabled) {
        this.lastSyncedKey = key;
        this.hasConfiguredStartup = false;
        this.lastDirExisted = void 0;
        if (result.startupConfigured === false && result.startupPath) {
          this.options.log("[\u5DE5\u4F5C\u76EE\u5F55] \u5DF2\u5173\u95ED\u81EA\u52A8\u5207\u6362\u5E76\u6E05\u7406\u8FDC\u7AEF\u5185\u6838\u542F\u52A8\u811A\u672C");
        }
        return result;
      }
      if (result.startupConfigured) {
        this.lastSyncedKey = key;
        this.hasConfiguredStartup = true;
        this.lastDirExisted = result.dirExists;
      }
      this.logSuccess(remoteDir, result);
      return result;
    } catch (error) {
      if (isSessionError(error)) {
        this.options.state.markDisconnected();
        this.reset();
      }
      this.options.log(`[\u5DE5\u4F5C\u76EE\u5F55] \u540C\u6B65\u8FDC\u7AEF\u5185\u6838\u76EE\u5F55\u5931\u8D25: ${shortError(error)}`);
      return void 0;
    } finally {
      await client.dispose();
    }
  }
  logSuccess(remoteDir, result) {
    const targetLabel = result.projPath || remoteDir;
    if (!result.startupConfigured && result.updatedKernels === 0) {
      if (result.skippedBusyKernels > 0) {
        this.options.log(
          `[\u5DE5\u4F5C\u76EE\u5F55] \u5F53\u524D ${result.skippedBusyKernels} \u4E2A\u5185\u6838\u6B63\u5728\u8FD0\u884C\uFF0C\u6682\u672A\u540C\u6B65\u5230 ${targetLabel}`
        );
      }
      return;
    }
    const details = [];
    if (result.updatedKernels > 0) {
      details.push(`\u5DF2\u5207\u6362 ${result.updatedKernels} \u4E2A\u8FD0\u884C\u4E2D\u5185\u6838`);
    }
    if (result.skippedBusyKernels > 0) {
      details.push(`\u8DF3\u8FC7 ${result.skippedBusyKernels} \u4E2A\u7E41\u5FD9\u5185\u6838`);
    }
    if (!result.dirExists) {
      details.push(`\u76EE\u5F55 "${remoteDir}" \u5C1A\u672A\u521B\u5EFA\uFF0C\u4E0A\u4F20\u540E\u5C06\u81EA\u52A8\u751F\u6548`);
    }
    const suffix = details.length > 0 ? `\uFF08${details.join("\uFF0C")}\uFF09` : "";
    this.options.log(`[\u5DE5\u4F5C\u76EE\u5F55] \u5DF2\u914D\u7F6E\u5185\u6838\u81EA\u52A8\u8FDB\u5165 ${targetLabel}${suffix}`);
  }
};
function mergeSyncOptions(current, incoming) {
  if (!current) {
    return { ...incoming };
  }
  return {
    force: Boolean(current.force || incoming.force),
    onlyExistingIdle: Boolean(current.onlyExistingIdle && incoming.onlyExistingIdle)
  };
}

// src/workspaceWebview.ts
var vscode9 = __toESM(require("vscode"));

// src/fileIcons.ts
var import_node_crypto4 = require("node:crypto");
var path5 = __toESM(require("node:path"));
var vscode8 = __toESM(require("vscode"));
var FileIconThemeResolver = class {
  theme;
  themeDirectory = "";
  loadPromise;
  iconCache = /* @__PURE__ */ new Map();
  assetCache = /* @__PURE__ */ new Map();
  extensionLanguages = /* @__PURE__ */ new Map();
  filenameLanguages = /* @__PURE__ */ new Map();
  async ensureLoaded() {
    if (!this.loadPromise) {
      this.loadPromise = this.load();
    }
    await this.loadPromise;
  }
  invalidate() {
    this.theme = void 0;
    this.themeDirectory = "";
    this.loadPromise = void 0;
    this.iconCache.clear();
    this.assetCache.clear();
    this.extensionLanguages.clear();
    this.filenameLanguages.clear();
  }
  getFonts() {
    return this.theme ? [...this.theme.fonts.values()] : [];
  }
  async resolveFile(name, light) {
    await this.ensureLoaded();
    const theme = this.theme;
    if (!theme) {
      return void 0;
    }
    const explicit = lookupName(theme, "fileNames", name, light);
    const languageId = this.languageForFile(name);
    const languageDefinition = languageId ? lookupName(theme, "languageIds", languageId, light) : void 0;
    const definitionId = explicit ?? findExtension(theme, name, light) ?? languageDefinition ?? (light ? theme.light?.file : void 0) ?? theme.base.file;
    return definitionId ? this.resolveDefinition(definitionId) : void 0;
  }
  async resolveDefaultFile(light) {
    return await this.resolveFile("untitled.txt", light) ?? this.resolveFile("", light);
  }
  async resolveFolder(name, expanded, light) {
    await this.ensureLoaded();
    const theme = this.theme;
    if (!theme) {
      return void 0;
    }
    const explicit = lookupName(
      theme,
      expanded ? "folderNamesExpanded" : "folderNames",
      name,
      light
    );
    const fallback = expanded ? (light ? theme.light?.folderExpanded : void 0) ?? theme.base.folderExpanded : (light ? theme.light?.folder : void 0) ?? theme.base.folder;
    const definitionId = explicit ?? fallback;
    return definitionId ? this.resolveDefinition(definitionId) : void 0;
  }
  languageForFile(name) {
    const lower = name.toLowerCase();
    const byName = this.filenameLanguages.get(lower);
    if (byName) {
      return byName;
    }
    for (let index = lower.indexOf("."); index !== -1; index = lower.indexOf(".", index + 1)) {
      const suffix = lower.slice(index + 1);
      const language = this.extensionLanguages.get(suffix);
      if (language) {
        return language;
      }
    }
    const lastPart = lower.split(".").pop() ?? "";
    return FALLBACK_EXTENSION_LANGUAGES[lastPart];
  }
  loadLanguageAssociations() {
    this.extensionLanguages.clear();
    this.filenameLanguages.clear();
    for (const extension of vscode8.extensions.all) {
      const contributes = extension.packageJSON?.contributes;
      const languages2 = contributes?.languages;
      if (!Array.isArray(languages2)) {
        continue;
      }
      for (const language of languages2) {
        if (!language || typeof language !== "object") {
          continue;
        }
        const record = language;
        const id = typeof record.id === "string" ? record.id : void 0;
        if (!id) {
          continue;
        }
        if (Array.isArray(record.extensions)) {
          for (const value of record.extensions) {
            if (typeof value === "string") {
              this.extensionLanguages.set(value.toLowerCase().replace(/^\./, ""), id);
            }
          }
        }
        if (Array.isArray(record.filenames)) {
          for (const value of record.filenames) {
            if (typeof value === "string") {
              this.filenameLanguages.set(value.toLowerCase(), id);
            }
          }
        }
      }
    }
    for (const [extension, language] of Object.entries(FALLBACK_EXTENSION_LANGUAGES)) {
      if (!this.extensionLanguages.has(extension)) {
        this.extensionLanguages.set(extension, language);
      }
    }
  }
  async resolveDefinition(definitionId) {
    if (this.iconCache.has(definitionId)) {
      return this.iconCache.get(definitionId) ?? void 0;
    }
    const definition = this.theme?.definitions.get(definitionId);
    let resolved;
    if (definition?.iconPath) {
      const absolutePath = path5.isAbsolute(definition.iconPath) ? definition.iconPath : path5.resolve(this.themeDirectory, definition.iconPath);
      const icon = await this.readAsset(absolutePath);
      if (icon) {
        resolved = { key: definitionId, icon };
      }
    } else if (definition?.fontCharacter) {
      const fontId = definition.fontId ?? this.theme?.firstFontId;
      const font = fontId ? this.theme?.fonts.get(fontId) : void 0;
      const char = glyphChar(definition.fontCharacter);
      if (font && char) {
        resolved = {
          key: definitionId,
          icon: {
            kind: "font",
            char,
            color: definition.fontColor,
            family: font.family
          }
        };
      }
    }
    this.iconCache.set(definitionId, resolved ?? null);
    return resolved;
  }
  async readAsset(absolutePath) {
    if (this.assetCache.has(absolutePath)) {
      return this.assetCache.get(absolutePath) ?? void 0;
    }
    try {
      const bytes = await vscode8.workspace.fs.readFile(vscode8.Uri.file(absolutePath));
      const extension = path5.extname(absolutePath).toLowerCase();
      let icon;
      if (extension === ".svg") {
        icon = {
          kind: "svg",
          svg: sanitizeSvg(Buffer.from(bytes).toString("utf8"))
        };
      } else {
        const mime = extension === ".png" ? "image/png" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : extension === ".gif" ? "image/gif" : "application/octet-stream";
        icon = {
          kind: "image",
          uri: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`
        };
      }
      this.assetCache.set(absolutePath, icon);
      return icon;
    } catch {
      this.assetCache.set(absolutePath, null);
      return void 0;
    }
  }
  async load() {
    try {
      const themeUri = findIconThemeUri();
      if (!themeUri) {
        return;
      }
      const raw = await vscode8.workspace.fs.readFile(themeUri);
      const json = JSON.parse(Buffer.from(raw).toString("utf8"));
      const definitions = parseDefinitions(json.iconDefinitions);
      this.themeDirectory = path5.dirname(themeUri.fsPath);
      this.loadLanguageAssociations();
      const fonts = await this.loadFonts(json.fonts, this.themeDirectory);
      this.theme = {
        definitions,
        fonts,
        firstFontId: fonts.size > 0 ? fonts.keys().next().value : void 0,
        base: parseMappings(json),
        light: json.light && typeof json.light === "object" ? parsePartialMappings(json.light) : void 0
      };
    } catch {
      this.theme = void 0;
    }
  }
  async loadFonts(raw, themeDirectory) {
    const fonts = /* @__PURE__ */ new Map();
    if (!Array.isArray(raw)) {
      return fonts;
    }
    for (let index = 0; index < raw.length; index += 1) {
      const entry = raw[index];
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const record = entry;
      const id = typeof record.id === "string" && record.id ? record.id : `font-${index}`;
      const sources = Array.isArray(record.src) ? record.src : [];
      const source = sources.find(
        (item) => Boolean(item) && typeof item === "object" && typeof item.path === "string"
      );
      if (!source) {
        continue;
      }
      const relativePath = String(source.path);
      const absolutePath = path5.isAbsolute(relativePath) ? relativePath : path5.resolve(themeDirectory, relativePath);
      const format = typeof source.format === "string" ? source.format.toLowerCase() : "";
      const mime = format === "woff2" ? "font/woff2" : format === "woff" ? "font/woff" : format === "truetype" || format === "ttf" ? "font/ttf" : format === "opentype" || format === "otf" ? "font/otf" : "application/octet-stream";
      try {
        const bytes = await vscode8.workspace.fs.readFile(vscode8.Uri.file(absolutePath));
        const dataUri = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
        const fingerprint = (0, import_node_crypto4.createHash)("sha1").update(dataUri).digest("hex").slice(0, 8);
        fonts.set(id, {
          family: `kg-icon-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${fingerprint}`,
          dataUri
        });
      } catch {
      }
    }
    return fonts;
  }
};
function isLightColorTheme() {
  const kind = vscode8.window.activeColorTheme.kind;
  return kind === vscode8.ColorThemeKind.Light || kind === vscode8.ColorThemeKind.HighContrastLight;
}
function findIconThemeUri() {
  const configuredIconTheme = vscode8.workspace.getConfiguration("workbench").get("iconTheme");
  if (configuredIconTheme === null) {
    return void 0;
  }
  const iconThemeId = configuredIconTheme || "vs-seti";
  for (const extension of vscode8.extensions.all) {
    const contributes = extension.packageJSON?.contributes;
    const themes = contributes?.iconThemes;
    if (!Array.isArray(themes)) {
      continue;
    }
    for (const theme of themes) {
      if (!theme || typeof theme !== "object") {
        continue;
      }
      const record = theme;
      if (record.id === iconThemeId && typeof record.path === "string") {
        return vscode8.Uri.joinPath(vscode8.Uri.file(extension.extensionPath), record.path);
      }
    }
  }
  const builtInCandidates = {
    "vs-seti": "extensions/theme-seti/icons/vs-seti-icon-theme.json",
    "vs-minimal": "extensions/theme-defaults/fileicons/vs_minimal-icon-theme.json",
    "vscode-modern-icons": "extensions/theme-modern-icons/fileicons/vscode-modern-icons-icon-theme.json"
  };
  const relative2 = builtInCandidates[iconThemeId];
  if (relative2) {
    return vscode8.Uri.joinPath(vscode8.Uri.file(vscode8.env.appRoot), relative2);
  }
  return void 0;
}
function parseDefinitions(raw) {
  const definitions = /* @__PURE__ */ new Map();
  if (!raw || typeof raw !== "object") {
    return definitions;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const record = value;
    const definition = {};
    if (typeof record.iconPath === "string") {
      definition.iconPath = record.iconPath;
    }
    if (typeof record.fontCharacter === "string") {
      definition.fontCharacter = record.fontCharacter;
    }
    if (typeof record.fontColor === "string") {
      definition.fontColor = record.fontColor;
    }
    if (typeof record.fontId === "string") {
      definition.fontId = record.fontId;
    }
    definitions.set(key, definition);
  }
  return definitions;
}
function parseMappings(raw) {
  return {
    file: typeof raw.file === "string" ? raw.file : void 0,
    folder: typeof raw.folder === "string" ? raw.folder : void 0,
    folderExpanded: typeof raw.folderExpanded === "string" ? raw.folderExpanded : void 0,
    fileNames: toStringMap(raw.fileNames),
    fileExtensions: toStringMap(raw.fileExtensions),
    languageIds: toStringMap(raw.languageIds),
    folderNames: toStringMap(raw.folderNames),
    folderNamesExpanded: toStringMap(raw.folderNamesExpanded)
  };
}
function parsePartialMappings(raw) {
  const mappings = {};
  if (typeof raw.file === "string") {
    mappings.file = raw.file;
  }
  if (typeof raw.folder === "string") {
    mappings.folder = raw.folder;
  }
  if (typeof raw.folderExpanded === "string") {
    mappings.folderExpanded = raw.folderExpanded;
  }
  if (raw.fileNames && typeof raw.fileNames === "object") {
    mappings.fileNames = toStringMap(raw.fileNames);
  }
  if (raw.fileExtensions && typeof raw.fileExtensions === "object") {
    mappings.fileExtensions = toStringMap(raw.fileExtensions);
  }
  if (raw.languageIds && typeof raw.languageIds === "object") {
    mappings.languageIds = toStringMap(raw.languageIds);
  }
  if (raw.folderNames && typeof raw.folderNames === "object") {
    mappings.folderNames = toStringMap(raw.folderNames);
  }
  if (raw.folderNamesExpanded && typeof raw.folderNamesExpanded === "object") {
    mappings.folderNamesExpanded = toStringMap(raw.folderNamesExpanded);
  }
  return mappings;
}
function toStringMap(raw) {
  const map = /* @__PURE__ */ new Map();
  if (!raw || typeof raw !== "object") {
    return map;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      map.set(key.toLowerCase(), value);
    }
  }
  return map;
}
function lookupName(theme, key, name, light) {
  const lower = name.toLowerCase();
  const lightMap = light ? theme.light?.[key] : void 0;
  return lightMap?.get(lower) ?? theme.base[key].get(lower);
}
function findExtension(theme, name, light) {
  const lower = name.toLowerCase();
  for (let index = lower.indexOf("."); index !== -1; index = lower.indexOf(".", index + 1)) {
    const suffix = lower.slice(index + 1);
    const definition = lookupName(theme, "fileExtensions", suffix, light);
    if (definition) {
      return definition;
    }
  }
  return void 0;
}
function glyphChar(value) {
  const hex = value.replace(/^\\+/, "");
  if (/^[0-9a-fA-F]{1,6}$/.test(hex)) {
    const codePoint = parseInt(hex, 16);
    if (codePoint > 0 && codePoint <= 1114111) {
      return String.fromCodePoint(codePoint);
    }
  }
  return value || void 0;
}
var FALLBACK_EXTENSION_LANGUAGES = {
  py: "python",
  pyi: "python",
  pyw: "python",
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  js: "javascript",
  jsx: "javascriptreact",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescriptreact",
  mts: "typescript",
  cts: "typescript",
  json: "json",
  jsonc: "jsonc",
  json5: "json",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  go: "go",
  rs: "rust",
  rb: "ruby",
  php: "php",
  sh: "shellscript",
  bash: "shellscript",
  zsh: "shellscript",
  yml: "yaml",
  yaml: "yaml",
  xml: "xml",
  sql: "sql",
  r: "r",
  lua: "lua",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  dockerfile: "dockerfile",
  makefile: "makefile",
  cmake: "cmake",
  ipynb: "jupyter",
  gitignore: "ignore",
  gitattributes: "ignore",
  txt: "plaintext",
  log: "log",
  ini: "ini",
  toml: "toml",
  cfg: "ini"
};
function sanitizeSvg(svg) {
  const match2 = svg.match(/<svg[\s\S]*<\/svg>/i);
  return (match2 ? match2[0] : svg).replace(/<script[\s\S]*?<\/script\s*>/gi, "").replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "").replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
}

// src/workspaceWebview.ts
var WorkspaceViewProvider = class {
  constructor(options) {
    this.options = options;
  }
  static viewType = "kaggleConnector.workspace";
  view;
  refreshTimer;
  contentsGeneration = 0;
  iconResolver = new FileIconThemeResolver();
  iconThemeSent = false;
  sentIconKeys = /* @__PURE__ */ new Set();
  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode9.Uri.joinPath(this.options.extensionUri, "media")]
    };
    view.webview.onDidReceiveMessage((message) => {
      void this.handleMessage(message);
    });
    view.onDidDispose(() => {
      if (this.view === view) {
        this.view = void 0;
      }
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = void 0;
      }
    });
    view.webview.html = this.html(view.webview);
    void this.refreshContents();
  }
  invalidateIconTheme() {
    this.iconResolver.invalidate();
    this.iconThemeSent = false;
    this.sentIconKeys.clear();
  }
  scheduleRefresh(delayMs = 600) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = void 0;
      void this.refreshContents();
    }, delayMs);
  }
  startInlineCreate(isDirectory) {
    void this.post({ type: "startCreate", isDirectory });
  }
  async handleMutationHint(hint) {
    if (!this.view) {
      return;
    }
    if (!hint || hint.fullRefresh) {
      await this.refreshContents();
      return;
    }
    await this.refreshAfterMutation(hint.invalidate ?? [], hint.parents ?? []);
  }
  async refreshContents() {
    if (!this.view) {
      return;
    }
    const generation = ++this.contentsGeneration;
    const url = await this.options.context.secrets.get(SECRET_KEY) ?? "";
    if (!url) {
      this.options.connectionState.syncUrl("");
      if (generation === this.contentsGeneration) {
        await this.post({ type: "contentsEmpty", reason: "no-url" });
      }
      return;
    }
    const remoteDir = getRemoteDir();
    const client = this.options.clientFactory(url);
    const probe = await this.options.probes.probe(url);
    if (!probe.alive) {
      if (generation === this.contentsGeneration) {
        await this.post({
          type: "contentsError",
          path: remoteDir,
          message: shortError(probe.error)
        });
      }
      return;
    }
    try {
      await this.iconResolver.ensureLoaded();
      await this.sendIconTheme();
      const root = remoteDir;
      let entries;
      try {
        entries = await client.listDirectory(root);
      } catch (error) {
        if (root && error instanceof KaggleError && error.kind === "notFound") {
          await client.ensureDirectories([root]);
          this.options.log(`\u8FDC\u7AEF\u5DE5\u4F5C\u76EE\u5F55\u4E0D\u5B58\u5728\uFF0C\u5DF2\u81EA\u52A8\u521B\u5EFA\u5E76\u8FDB\u5165: ${root}`);
          entries = await client.listDirectory(root);
          this.options.onWorkingDirCreated?.();
        } else {
          throw error;
        }
      }
      if (generation !== this.contentsGeneration) {
        return;
      }
      const decorated = await this.decorateEntries(entries);
      await this.post({
        type: "contentsRoot",
        root,
        entries: decorated.entries,
        icons: decorated.icons
      });
    } catch (error) {
      if (isConnectionError(error)) {
        this.options.connectionState.markDisconnected();
        this.options.probes.invalidate();
      }
      if (generation !== this.contentsGeneration) {
        return;
      }
      await this.post({
        type: "contentsError",
        path: remoteDir,
        message: shortError(error)
      });
    }
  }
  dispose() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = void 0;
    }
  }
  async handleMessage(message) {
    try {
      if (message.type === "ready") {
        this.invalidateIconTheme();
        await this.refreshContents();
        return;
      }
      if (message.type === "listContents") {
        await this.listContents(message.path);
        return;
      }
      if (message.type === "refreshContents") {
        this.options.probes.invalidate();
        await this.refreshContents();
        return;
      }
      if (message.type === "resolveFileIcon") {
        await this.handleResolveFileIcon(message);
        return;
      }
      if (message.type === "openUrlSettings") {
        await vscode9.commands.executeCommand("kaggleConnector.setServerUrl");
        return;
      }
      if (message.type === "focusConnection") {
        await vscode9.commands.executeCommand("kaggleConnector.connection.focus");
        return;
      }
      if (message.type === "remoteAction") {
        await this.handleRemoteAction(message);
      }
    } catch (error) {
      this.options.log(`\u5DE5\u4F5C\u533A\u6D88\u606F\u5904\u7406\u5931\u8D25: ${describeError(error)}`);
      void vscode9.window.showErrorMessage(`\u64CD\u4F5C\u5931\u8D25\uFF1A${shortError(error)}`);
    }
  }
  async handleRemoteAction(message) {
    const items = resolveActionItems(message);
    const parent = normalizeRemotePath(message.parent ?? "");
    if (message.action === "newFolder" || message.action === "newFile") {
      await this.options.service.createEntry(
        parent,
        message.action === "newFolder",
        message.newName
      );
      return;
    }
    if (message.action === "paste") {
      const targetDir = normalizeRemotePath(message.targetDir ?? "");
      const isCut = message.clipboardMode === "cut";
      const ok = await this.options.service.transferItems(
        items,
        targetDir,
        isCut ? "move" : "copy"
      );
      if (ok && isCut) {
        await this.post({ type: "clearClipboard" });
      }
      return;
    }
    if (message.action === "move") {
      const targetDir = normalizeRemotePath(message.targetDir ?? "");
      await this.options.service.transferItems(items, targetDir, "move");
      return;
    }
    if (items.length === 0) {
      void vscode9.window.showErrorMessage("\u4E0D\u652F\u6301\u5BF9 Jupyter \u6839\u76EE\u5F55\u6267\u884C\u8BE5\u64CD\u4F5C\u3002");
      return;
    }
    if (message.action === "open") {
      await this.options.service.openItems(items);
      return;
    }
    if (message.action === "download") {
      await this.options.service.downloadItems(items);
      return;
    }
    if (message.action === "delete") {
      await this.options.service.deleteItems(items);
      return;
    }
    if (message.action === "rename") {
      await this.options.service.renameItem(items[0], message.newName);
    }
  }
  async refreshAfterMutation(invalidate, parents) {
    const paths = [...new Set(invalidate.map((item) => normalizeRemotePath(item)))].filter(
      (item) => item !== ""
    );
    if (paths.length > 0) {
      await this.post({ type: "treeMutation", invalidate: paths });
    }
    const uniqueParents = [...new Set(parents.map((item) => normalizeRemotePath(item)))];
    for (const parent of uniqueParents) {
      await this.listContents(parent);
    }
  }
  async listContents(path6) {
    const generation = this.contentsGeneration;
    const url = await this.options.context.secrets.get(SECRET_KEY) ?? "";
    if (!url) {
      this.options.connectionState.syncUrl("");
      await this.post({ type: "contentsEmpty", reason: "no-url" });
      return;
    }
    try {
      await this.iconResolver.ensureLoaded();
      await this.sendIconTheme();
      const entries = await this.options.clientFactory(url).listDirectory(path6);
      if (generation !== this.contentsGeneration) {
        return;
      }
      const decorated = await this.decorateEntries(entries);
      await this.post({
        type: "listing",
        path: path6,
        entries: decorated.entries,
        icons: decorated.icons
      });
    } catch (error) {
      if (isConnectionError(error)) {
        this.options.connectionState.markDisconnected();
        this.options.probes.invalidate();
      }
      if (generation !== this.contentsGeneration) {
        return;
      }
      await this.post({ type: "listingError", path: path6, message: shortError(error) });
    }
  }
  async decorateEntries(entries) {
    const light = isLightColorTheme();
    const icons = {};
    const decorated = await Promise.all(
      entries.map(async (entry) => {
        if (entry.type === "directory") {
          return { ...entry };
        }
        const reference = await this.iconResolver.resolveFile(entry.name, light);
        if (reference && !this.sentIconKeys.has(reference.key)) {
          this.sentIconKeys.add(reference.key);
          icons[reference.key] = reference.icon;
        }
        return { ...entry, iconKey: reference?.key };
      })
    );
    return { entries: decorated, icons };
  }
  async sendIconTheme() {
    if (this.iconThemeSent) {
      return;
    }
    this.iconThemeSent = true;
    const defaultFile = await this.iconResolver.resolveDefaultFile(isLightColorTheme());
    if (defaultFile) {
      this.sentIconKeys.add(defaultFile.key);
    }
    await this.post({
      type: "iconTheme",
      fonts: this.iconResolver.getFonts(),
      defaultFileIconKey: defaultFile?.key,
      defaultFileIcon: defaultFile?.icon
    });
  }
  async handleResolveFileIcon(message) {
    const trimmed = typeof message.name === "string" ? message.name.trim() : "";
    const light = isLightColorTheme();
    const reference = trimmed ? await this.iconResolver.resolveFile(trimmed, light) : await this.iconResolver.resolveDefaultFile(light);
    let icon;
    if (reference && !this.sentIconKeys.has(reference.key)) {
      this.sentIconKeys.add(reference.key);
      icon = reference.icon;
    }
    await this.post({
      type: "resolvedFileIcon",
      requestId: message.requestId,
      name: trimmed,
      iconKey: reference?.key,
      icon
    });
  }
  async post(message) {
    await this.view?.webview.postMessage(message);
  }
  html(webview) {
    const styleUri = webview.asWebviewUri(
      vscode9.Uri.joinPath(this.options.extensionUri, "media", "workspace.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode9.Uri.joinPath(this.options.extensionUri, "media", "workspace.js")
    );
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `script-src ${webview.cspSource}`,
      "img-src data:",
      "font-src data:"
    ].join("; ");
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>Kaggle Workspace</title>
</head>
<body>
  <div id="app" class="app">
    <div class="contents-scroll">
      <div id="contentsBody" class="contents-body" role="tree" aria-multiselectable="true" aria-label="Kaggle Workspace \u76EE\u5F55\u6811"></div>
      <div id="contentsScrollbar" class="custom-scrollbar" aria-hidden="true">
        <div id="contentsScrollbarThumb" class="custom-scrollbar-thumb"></div>
      </div>
    </div>
  </div>

  <div id="contextMenu" class="context-menu hidden" role="menu" aria-label="\u8FDC\u7AEF\u6587\u4EF6\u64CD\u4F5C" tabindex="-1"></div>
  <div id="renameError" class="rename-error hidden" role="alert"></div>

  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
};
function resolveActionItems(message) {
  if (Array.isArray(message.items) && message.items.length > 0) {
    const resolved = [];
    for (const item of message.items) {
      if (!item || typeof item.path !== "string") {
        continue;
      }
      const normalized = normalizeRemotePath(item.path);
      if (!normalized) {
        continue;
      }
      resolved.push({
        path: normalized,
        entryType: item.entryType,
        entrySize: typeof item.entrySize === "number" ? item.entrySize : void 0,
        isRoot: Boolean(item.isRoot)
      });
    }
    return resolved;
  }
  const single = normalizeRemotePath(message.path ?? "");
  if (!single) {
    return [];
  }
  return [
    {
      path: single,
      entryType: message.entryType,
      entrySize: message.entrySize,
      isRoot: Boolean(message.isRoot)
    }
  ];
}

// src/extension.ts
var output;
var statusBar;
var remoteFileSystem;
function activate(context) {
  output = vscode10.window.createOutputChannel("Kaggle Connector");
  statusBar = vscode10.window.createStatusBarItem(vscode10.StatusBarAlignment.Right, 100);
  context.subscriptions.push(output, statusBar);
  const connectionState = new ConnectionState();
  const probes = new ProbeCoordinator({
    clientFactory: createClient,
    getTimeoutMs: getProbeTimeoutMs,
    state: connectionState
  });
  const jupyterServers = new KaggleJupyterServers({
    loadUrl: async () => await context.secrets.get(SECRET_KEY) ?? "",
    log
  });
  context.subscriptions.push(jupyterServers);
  const keepAlive = new KeepAliveManager({
    clientFactory: createClient,
    loadUrl: async () => await context.secrets.get(SECRET_KEY) ?? "",
    isEnabled: getKeepAliveEnabled,
    getIntervalMs: () => getKeepAliveIntervalMinutes() * 60 * 1e3,
    getDeadlineMs: getProbeTimeoutMs,
    state: connectionState,
    log
  });
  context.subscriptions.push(keepAlive);
  const workingDirSync = new WorkingDirSyncManager({
    clientFactory: createClient,
    loadUrl: async () => await context.secrets.get(SECRET_KEY) ?? "",
    getRemoteDir,
    isEnabled: getAutoCdRemoteDir,
    state: connectionState,
    log
  });
  context.subscriptions.push(workingDirSync);
  let workspaceView;
  const applyUrlToJupyter = (url, explicit) => {
    jupyterServers.setUrl(url);
    if (!url) {
      workingDirSync.reset();
      return;
    }
    void jupyterServers.ensureRegistered({ promptIfMissing: explicit }).catch((error) => {
      log(`\u6CE8\u518C Jupyter \u5185\u6838\u6765\u6E90\u5931\u8D25: ${shortError(error)}`);
    });
  };
  const remoteService = new RemoteWorkspaceService({
    context,
    clientFactory: createClient,
    connectionState,
    probes,
    log,
    showOutput: () => output.show(),
    onMutated: (hint) => {
      void workspaceView.handleMutationHint(hint);
    },
    onRemoteDirUpdated: () => {
      updateStatusBar();
      void provider.refresh();
      void workingDirSync.sync({ force: true });
    },
    onWorkingDirCreated: () => {
      void workingDirSync.onRemoteDirCreated();
    }
  });
  workspaceView = new WorkspaceViewProvider({
    context,
    extensionUri: context.extensionUri,
    clientFactory: createClient,
    connectionState,
    probes,
    service: remoteService,
    log,
    onWorkingDirCreated: () => {
      void workingDirSync.onRemoteDirCreated();
    }
  });
  context.subscriptions.push(
    workspaceView,
    vscode10.window.registerWebviewViewProvider(WorkspaceViewProvider.viewType, workspaceView, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
  context.subscriptions.push(
    connectionState.onDidChange((connected) => {
      void vscode10.commands.executeCommand("setContext", "kaggleConnector.connected", connected).then(void 0, () => void 0);
      updateStatusBar();
      keepAlive.sync();
      void workspaceView.refreshContents();
      if (connected) {
        void workingDirSync.sync();
      }
    })
  );
  void vscode10.commands.executeCommand("setContext", "kaggleConnector.connected", false).then(void 0, () => void 0);
  const provider = new ConnectionViewProvider(
    context,
    context.extensionUri,
    createClient,
    () => {
      updateStatusBar();
      void workspaceView.refreshContents();
    },
    applyUrlToJupyter,
    log,
    connectionState,
    probes,
    (options) => {
      void workingDirSync.sync({ force: options?.force });
    }
  );
  context.subscriptions.push(
    vscode10.window.registerWebviewViewProvider(ConnectionViewProvider.viewType, provider, {
      // Keep unsaved input while switching between sidebar views. Persisted
      // URL/REMOTE_DIR are rehydrated through the webview's "ready" handshake.
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
  context.subscriptions.push(
    vscode10.commands.registerCommand("kaggleConnector.upload", upload),
    vscode10.commands.registerCommand("kaggleConnector.uploadCurrent", uploadCurrent),
    vscode10.commands.registerCommand("kaggleConnector.setServerUrl", setServerUrl),
    vscode10.commands.registerCommand("kaggleConnector.setRemoteDir", setRemoteDirCommand),
    vscode10.commands.registerCommand("kaggleConnector.testConnection", testConnection),
    vscode10.commands.registerCommand("kaggleConnector.clearServerUrl", clearServerUrl),
    vscode10.commands.registerCommand("kaggleConnector.syncKernelWorkingDir", syncKernelWorkingDir),
    vscode10.commands.registerCommand("kaggleConnector.remote.refresh", () => {
      probes.invalidate();
      void workspaceView.refreshContents();
    }),
    vscode10.commands.registerCommand("kaggleConnector.remote.newFile", () => {
      workspaceView.startInlineCreate(false);
    }),
    vscode10.commands.registerCommand("kaggleConnector.remote.newFolder", () => {
      workspaceView.startInlineCreate(true);
    })
  );
  context.subscriptions.push(
    vscode10.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("kaggleConnector")) {
        updateStatusBar();
      }
      if (event.affectsConfiguration("kaggleConnector.keepAlive") || event.affectsConfiguration("kaggleConnector.keepAliveIntervalMinutes")) {
        keepAlive.sync();
      }
      if (event.affectsConfiguration("kaggleConnector.remoteDir")) {
        void workspaceView.refreshContents();
      }
      if (event.affectsConfiguration("kaggleConnector.remoteDir") || event.affectsConfiguration("kaggleConnector.autoCdRemoteDir")) {
        void workingDirSync.sync({ force: true });
      }
      if (event.affectsConfiguration("kaggleConnector.proxy") || event.affectsConfiguration("kaggleConnector.requestTimeoutMs") || event.affectsConfiguration("kaggleConnector.sessionProbeTimeoutMs")) {
        probes.invalidate();
        void initializeConnectionState();
      }
      if (event.affectsConfiguration("workbench.iconTheme")) {
        workspaceView.invalidateIconTheme();
        void workspaceView.refreshContents();
      }
    }),
    vscode10.window.onDidChangeActiveColorTheme(() => {
      workspaceView.invalidateIconTheme();
      void workspaceView.refreshContents();
    })
  );
  updateStatusBar();
  void initializeConnectionState().then(() => {
    keepAlive.sync();
  });
  const ensureKernelSource = () => {
    void jupyterServers.ensureRegistered().catch((error) => {
      log(`\u6CE8\u518C Jupyter \u5185\u6838\u6765\u6E90\u5931\u8D25: ${shortError(error)}`);
    });
  };
  context.subscriptions.push(
    vscode10.workspace.onDidOpenNotebookDocument(() => ensureKernelSource())
  );
  if (vscode10.workspace.notebookDocuments.length > 0) {
    ensureKernelSource();
  }
  function createClient(serverUrl) {
    const normalized = normalizeServerUrl(serverUrl);
    return new JupyterClient(normalized, {
      proxy: resolveProxy(new URL(normalized)),
      timeoutMs: getTimeoutMs()
    });
  }
  const remoteFs = new KaggleRemoteFileSystemProvider(
    async () => {
      const url = await context.secrets.get(SECRET_KEY);
      if (!url) {
        throw new KaggleError("badRequest", "\u5C1A\u672A\u8BBE\u7F6E Jupyter URL", {
          hint: "\u5728\u4FA7\u680F\u586B\u5165 Jupyter URL \u5E76\u4FDD\u5B58\u540E\u518D\u6253\u5F00\u8FDC\u7AEF\u6587\u4EF6\u3002"
        });
      }
      return createClient(url);
    },
    log,
    () => workspaceView.scheduleRefresh(),
    (error) => {
      connectionState.markDisconnected();
      probes.invalidate();
      log(`\u8FDC\u7AEF\u6587\u4EF6\u64CD\u4F5C\u68C0\u6D4B\u5230\u8FDE\u63A5\u95EE\u9898: ${shortError(error)}`);
    }
  );
  remoteFileSystem = remoteFs;
  context.subscriptions.push(
    vscode10.workspace.registerFileSystemProvider(REMOTE_SCHEME, remoteFs, {
      isCaseSensitive: true
    }),
    remoteFs,
    vscode10.commands.registerCommand("kaggleConnector.saveRemoteNow", async () => {
      const editor = vscode10.window.activeTextEditor;
      if (!editor || editor.document.uri.scheme !== REMOTE_SCHEME) {
        await vscode10.commands.executeCommand("workbench.action.files.save");
        return;
      }
      const key = editor.document.uri.toString();
      try {
        await remoteFs.flushPending(key);
      } catch (error) {
        void vscode10.window.showErrorMessage(`\u4FDD\u5B58\u8FDC\u7AEF\u6587\u4EF6\u5931\u8D25\uFF1A${shortError(error)}`);
        return;
      }
      if (editor.document.isDirty) {
        remoteFs.beginManualSave(key);
        try {
          await vscode10.commands.executeCommand("workbench.action.files.save");
        } finally {
          remoteFs.clearManualSave(key);
        }
      }
    }),
    vscode10.workspace.onDidCloseTextDocument((document2) => {
      if (document2.uri.scheme === REMOTE_SCHEME) {
        void remoteFs.flushPending(document2.uri.toString()).catch((error) => {
          log(`\u5173\u95ED\u8FDC\u7AEF\u6587\u6863\u65F6\u4E0A\u4F20\u5931\u8D25: ${shortError(error)}`);
        });
      }
    }),
    vscode10.window.onDidChangeWindowState((state) => {
      if (!state.focused) {
        void remoteFs.flushAll().catch((error) => {
          log(`\u7A97\u53E3\u5931\u7126\u65F6\u4E0A\u4F20\u5931\u8D25: ${shortError(error)}`);
        });
      }
    })
  );
  function updateStatusBar() {
    const remoteDir = getRemoteDir();
    const connectionText = connectionState.connected ? "Kaggle \u5DF2\u8FDE\u63A5" : "Kaggle \u672A\u8FDE\u63A5\uFF08\u5728\u4FA7\u680F\u8BBE\u7F6E URL \u5E76\u8FDE\u63A5\uFF09";
    const remoteDirText = remoteDir ? `REMOTE_DIR: ${remoteDir}` : "\u5C1A\u672A\u8BBE\u7F6E REMOTE_DIR";
    statusBar.text = "$(cloud-upload) Kaggle";
    statusBar.tooltip = `${connectionText}
${remoteDirText}
\u4E0A\u4F20\u5F53\u524D\u6587\u4EF6\u5230 Kaggle`;
    statusBar.command = "kaggleConnector.uploadCurrent";
    statusBar.show();
  }
  async function initializeConnectionState() {
    const url = await context.secrets.get(SECRET_KEY) ?? "";
    connectionState.syncUrl(url);
    if (!url) {
      return;
    }
    await probes.probe(url);
  }
  async function setServerUrl() {
    const current = await context.secrets.get(SECRET_KEY) ?? "";
    const value = await vscode10.window.showInputBox({
      title: "\u8BBE\u7F6E Kaggle Jupyter URL",
      prompt: "\u7C98\u8D34 Kaggle Notebook \u2192 Run \u2192 Kaggle Jupyter Server \u4E2D\u7684 \u201CVS Code Compatible URL\u201D",
      value: current,
      ignoreFocusOut: true,
      validateInput: (text) => {
        try {
          normalizeServerUrl(text);
          return void 0;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }
    });
    if (value === void 0) {
      return;
    }
    const normalized = normalizeServerUrl(value);
    await context.secrets.store(SECRET_KEY, normalized);
    connectionState.syncUrl(normalized);
    probes.invalidate();
    applyUrlToJupyter(normalized, true);
    log(`\u5DF2\u66F4\u65B0 Jupyter URL: ${displayServerUrl(normalized)}`);
    updateStatusBar();
    await provider.refresh();
    void workspaceView.refreshContents();
    void probes.probe(normalized);
    vscode10.window.setStatusBarMessage("$(check) Kaggle Jupyter URL \u5DF2\u4FDD\u5B58", 3e3);
  }
  async function setRemoteDirCommand() {
    const value = await vscode10.window.showInputBox({
      title: "\u8BBE\u7F6E\u5DE5\u4F5C\u76EE\u5F55 (REMOTE_DIR)",
      prompt: "\u76F8\u5BF9\u4E8E Jupyter \u6839\u76EE\u5F55\uFF0C\u4F8B\u5982 news_recommender \u6216 news_recommender/src",
      value: getRemoteDir(),
      ignoreFocusOut: true,
      validateInput: (text) => {
        try {
          return normalizeRemotePath(text) ? void 0 : "REMOTE_DIR \u4E0D\u80FD\u4E3A\u7A7A";
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }
    });
    if (value === void 0) {
      return;
    }
    try {
      await setRemoteDir(value);
    } catch (error) {
      void vscode10.window.showErrorMessage(shortError(error));
      return;
    }
    updateStatusBar();
    await provider.refresh();
    void workspaceView.refreshContents();
    vscode10.window.setStatusBarMessage(`$(check) REMOTE_DIR: ${getRemoteDir()}`, 3e3);
  }
  async function clearServerUrl() {
    const stored = await context.secrets.get(SECRET_KEY);
    if (!stored) {
      vscode10.window.setStatusBarMessage("\u5F53\u524D\u6CA1\u6709\u4FDD\u5B58 Jupyter URL", 3e3);
      return;
    }
    const choice = await vscode10.window.showWarningMessage(
      "\u786E\u5B9A\u6E05\u9664\u5DF2\u4FDD\u5B58\u7684 Kaggle Jupyter URL\uFF1F",
      { modal: true },
      "\u6E05\u9664"
    );
    if (choice !== "\u6E05\u9664") {
      return;
    }
    await context.secrets.delete(SECRET_KEY);
    connectionState.syncUrl("");
    probes.invalidate();
    applyUrlToJupyter("", true);
    updateStatusBar();
    await provider.refresh();
    void workspaceView.refreshContents();
    vscode10.window.setStatusBarMessage("$(check) \u5DF2\u6E05\u9664 Jupyter URL", 3e3);
  }
  async function testConnection() {
    const url = await context.secrets.get(SECRET_KEY);
    if (!url) {
      await promptForUrl();
      return;
    }
    const remoteDir = getRemoteDir();
    if (!remoteDir) {
      await promptForRemoteDir();
      return;
    }
    await vscode10.window.withProgress(
      {
        location: vscode10.ProgressLocation.Notification,
        title: "\u6D4B\u8BD5 Kaggle \u8FDE\u63A5",
        cancellable: false
      },
      async () => {
        try {
          connectionState.syncUrl(url);
          const client = createClient(url);
          const probe = await probes.probeFresh(url);
          if (!probe.alive) {
            connectionState.markDisconnected();
            probes.invalidate();
            await offerProbeRecovery(probe);
            return;
          }
          connectionState.markConnected(connectionState.captureTicket());
          let result = await client.test(remoteDir);
          if (!result.exists && remoteDir) {
            await client.ensureDirectories([remoteDir]);
            log(`\u8FDC\u7AEF\u5DE5\u4F5C\u76EE\u5F55\u4E0D\u5B58\u5728\uFF0C\u5DF2\u81EA\u52A8\u521B\u5EFA\u5E76\u8FDB\u5165: ${remoteDir}`);
            result = await client.test(remoteDir);
            void workspaceView.refreshContents();
          }
          void workingDirSync.sync({ force: true });
          if (result.writable === false) {
            void vscode10.window.showWarningMessage(
              `\u8FDE\u63A5\u6210\u529F\uFF0C\u4F46\u76EE\u5F55 \u201C${result.path}\u201D \u4E0D\u53EF\u5199\uFF08Kaggle \u53EA\u80FD\u5199 /kaggle/working\uFF09\u3002`
            );
          } else {
            vscode10.window.setStatusBarMessage(
              `$(check) \u8FDE\u63A5\u6210\u529F\uFF1A${result.path}${result.writable === true ? "\uFF08\u53EF\u5199\uFF09" : ""}`,
              3e3
            );
          }
        } catch (error) {
          logError(error);
          if (isConnectionError(error)) {
            connectionState.markDisconnected();
            probes.invalidate();
          }
          if (await offerSessionRecovery(error)) {
            return;
          }
          const choice = await vscode10.window.showErrorMessage(
            `\u8FDE\u63A5\u5931\u8D25\uFF1A${shortError(error)}`,
            "\u67E5\u770B\u65E5\u5FD7"
          );
          if (choice === "\u67E5\u770B\u65E5\u5FD7") {
            output.show();
          }
        }
      }
    );
  }
  async function upload(uri, uris) {
    const candidates = (uris && uris.length > 0 ? uris : uri ? [uri] : []).filter(
      (item) => item.scheme === "file"
    );
    if (candidates.length === 0) {
      const active = vscode10.window.activeTextEditor?.document.uri;
      if (active && active.scheme === "file") {
        candidates.push(active);
      }
    }
    if (candidates.length === 0) {
      void vscode10.window.showWarningMessage("\u8BF7\u5148\u5728\u8D44\u6E90\u7BA1\u7406\u5668\u4E2D\u9009\u62E9\u8981\u4E0A\u4F20\u7684\u6587\u4EF6\u6216\u6587\u4EF6\u5939\u3002");
      return;
    }
    const url = await context.secrets.get(SECRET_KEY);
    if (!url) {
      await promptForUrl();
      return;
    }
    const remoteDir = getRemoteDir();
    if (!remoteDir) {
      await promptForRemoteDir();
      return;
    }
    const config = {
      remoteDir,
      pathMode: getPathMode(),
      exclude: getExclude(),
      maxFileSizeMB: getMaxFileSizeMB(),
      concurrency: getConcurrency(),
      timeoutMs: getTimeoutMs(),
      skipUnchanged: getSkipUnchanged(),
      conflictPolicy: getConflictPolicy(),
      retryCount: getRetryCount()
    };
    log(
      `\u5F00\u59CB\u4E0A\u4F20\uFF1A${candidates.length} \u4E2A\u9009\u62E9\uFF0CREMOTE_DIR=${remoteDir}\uFF0C\u8DEF\u5F84\u6A21\u5F0F=${config.pathMode}\uFF0C\u6392\u9664\u89C4\u5219=${config.exclude.length} \u6761\uFF0C\u8DF3\u8FC7\u672A\u4FEE\u6539=${config.skipUnchanged}\uFF0C\u51B2\u7A81\u7B56\u7565=${config.conflictPolicy}\uFF0C\u91CD\u8BD5=${config.retryCount}`
    );
    const client = createClient(url);
    connectionState.syncUrl(url);
    const probe = await probes.probeFresh(url);
    if (!probe.alive) {
      connectionState.markDisconnected();
      probes.invalidate();
      await offerProbeRecovery(probe);
      return;
    }
    const summary = await vscode10.window.withProgress(
      {
        location: vscode10.ProgressLocation.Notification,
        title: "\u4E0A\u4F20\u5230 Kaggle",
        cancellable: true
      },
      async (progress, token) => {
        progress.report({ message: "\u626B\u63CF\u6587\u4EF6\u2026" });
        const collected = await collectSelections(candidates, config, token, log);
        if (token.isCancellationRequested) {
          return {
            total: collected.failures.length + collected.skipped,
            uploaded: 0,
            failed: collected.failures.length,
            skipped: collected.skipped,
            unchanged: 0,
            skippedNewer: 0,
            cancelled: true,
            sessionExpired: false,
            failures: collected.failures
          };
        }
        const planned = planUploads(collected.files, config, log);
        const allFailures = [...collected.failures, ...planned.failures];
        if (planned.plans.length === 0) {
          return {
            total: allFailures.length + collected.skipped,
            uploaded: 0,
            failed: allFailures.length,
            skipped: collected.skipped,
            unchanged: 0,
            skippedNewer: 0,
            cancelled: false,
            sessionExpired: false,
            failures: allFailures
          };
        }
        progress.report({ message: "\u68C0\u67E5\u8FDC\u7AEF\u6587\u4EF6\u2026" });
        const pre = await preflightUploads(client, planned.plans, config, token, log);
        const baseTotal = planned.plans.length + allFailures.length + collected.skipped;
        if (pre.fatalError) {
          const fatalFailures = planned.plans.map((plan) => ({
            localPath: plan.localPath,
            remotePath: plan.remotePath,
            error: pre.fatalError
          }));
          const failures = [...allFailures, ...fatalFailures];
          return {
            total: allFailures.length + collected.skipped + fatalFailures.length,
            uploaded: 0,
            failed: failures.length,
            skipped: collected.skipped,
            unchanged: 0,
            skippedNewer: 0,
            cancelled: false,
            sessionExpired: pre.sessionExpired,
            failures
          };
        }
        if (pre.cancelled) {
          const failed = allFailures.length + pre.failures.length;
          return {
            total: baseTotal,
            uploaded: 0,
            failed,
            skipped: baseTotal - failed,
            unchanged: pre.unchanged.length,
            skippedNewer: pre.remoteNewer.length,
            cancelled: true,
            sessionExpired: false,
            failures: [...allFailures, ...pre.failures]
          };
        }
        let uploads = pre.uploads;
        let skippedNewer = 0;
        if (pre.remoteNewer.length > 0) {
          if (config.conflictPolicy === "skipNewer") {
            skippedNewer = pre.remoteNewer.length;
            log(`\u8DF3\u8FC7 ${skippedNewer} \u4E2A\u8FDC\u7AEF\u8F83\u65B0\u7684\u6587\u4EF6\uFF08\u51B2\u7A81\u7B56\u7565\uFF1AskipNewer\uFF09\u3002`);
          } else if (config.conflictPolicy === "ask") {
            const decision = await confirmRemoteNewer(pre.remoteNewer);
            if (decision === "cancel") {
              const failed = allFailures.length + pre.failures.length;
              return {
                total: baseTotal,
                uploaded: 0,
                failed,
                skipped: baseTotal - failed,
                unchanged: pre.unchanged.length,
                skippedNewer: 0,
                cancelled: true,
                sessionExpired: false,
                failures: [...allFailures, ...pre.failures]
              };
            }
            if (decision === "skip") {
              skippedNewer = pre.remoteNewer.length;
              log(`\u8DF3\u8FC7 ${skippedNewer} \u4E2A\u8FDC\u7AEF\u8F83\u65B0\u7684\u6587\u4EF6\uFF08\u7528\u6237\u9009\u62E9\uFF09\u3002`);
            } else {
              log(`\u7528\u6237\u9009\u62E9\u8986\u76D6 ${pre.remoteNewer.length} \u4E2A\u8FDC\u7AEF\u8F83\u65B0\u7684\u6587\u4EF6\u3002`);
              uploads = uploads.concat(pre.remoteNewer);
            }
          } else {
            uploads = uploads.concat(pre.remoteNewer);
          }
        }
        if (uploads.length === 0) {
          const failed = allFailures.length + pre.failures.length;
          return {
            total: baseTotal,
            uploaded: 0,
            failed,
            skipped: baseTotal - failed,
            unchanged: pre.unchanged.length,
            skippedNewer,
            cancelled: false,
            sessionExpired: false,
            failures: [...allFailures, ...pre.failures]
          };
        }
        const result = await executeUpload(
          client,
          uploads,
          [...allFailures, ...pre.failures],
          config,
          progress,
          token,
          log
        );
        return {
          ...result,
          total: result.total + collected.skipped + pre.unchanged.length + skippedNewer,
          skipped: result.skipped + collected.skipped + pre.unchanged.length + skippedNewer,
          unchanged: pre.unchanged.length,
          skippedNewer
        };
      }
    );
    await notifySummary(summary, remoteDir);
    if (summary.sessionExpired) {
      connectionState.markDisconnected();
      probes.invalidate();
    }
    if (summary.uploaded > 0) {
      void workingDirSync.onRemoteDirCreated();
      void workspaceView.refreshContents();
    }
  }
  async function syncKernelWorkingDir() {
    const url = await context.secrets.get(SECRET_KEY);
    if (!url) {
      await promptForUrl();
      return;
    }
    const remoteDir = getRemoteDir();
    if (!remoteDir) {
      await promptForRemoteDir();
      return;
    }
    await vscode10.window.withProgress(
      {
        location: vscode10.ProgressLocation.Notification,
        title: "\u540C\u6B65\u8FDC\u7AEF\u5185\u6838\u5DE5\u4F5C\u76EE\u5F55",
        cancellable: false
      },
      async () => {
        connectionState.syncUrl(url);
        const probe = await probes.probeFresh(url);
        if (!probe.alive) {
          connectionState.markDisconnected();
          probes.invalidate();
          await offerProbeRecovery(probe);
          return;
        }
        if (!getAutoCdRemoteDir()) {
          void vscode10.window.showWarningMessage(
            "\u5DF2\u5173\u95ED \u201C\u81EA\u52A8\u5207\u6362\u8FDC\u7AEF\u5185\u6838\u5DE5\u4F5C\u76EE\u5F55 (kaggleConnector.autoCdRemoteDir)\u201D\u3002\u5982\u9700\u540C\u6B65\uFF0C\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u542F\u7528\u3002"
          );
          return;
        }
        const result = await workingDirSync.sync({ force: true });
        if (!result) {
          const choice = await vscode10.window.showErrorMessage(
            "\u540C\u6B65\u8FDC\u7AEF\u5185\u6838\u5DE5\u4F5C\u76EE\u5F55\u5931\u8D25\u3002",
            "\u67E5\u770B\u65E5\u5FD7"
          );
          if (choice === "\u67E5\u770B\u65E5\u5FD7") {
            output.show();
          }
          return;
        }
        const target = result.projPath || remoteDir;
        if (!result.dirExists) {
          vscode10.window.setStatusBarMessage(
            `$(check) \u5DF2\u914D\u7F6E\u5185\u6838\u542F\u52A8\u76EE\u5F55 ${target}\uFF08\u8FDC\u7AEF\u76EE\u5F55\u5C1A\u672A\u521B\u5EFA\uFF0C\u4E0A\u4F20\u540E\u81EA\u52A8\u751F\u6548\uFF09`,
            5e3
          );
          return;
        }
        vscode10.window.setStatusBarMessage(
          `$(check) \u5185\u6838\u5DE5\u4F5C\u76EE\u5F55\u5DF2\u540C\u6B65\uFF1A${target}`,
          4e3
        );
      }
    );
  }
  async function uploadCurrent() {
    const active = vscode10.window.activeTextEditor?.document.uri;
    if (!active || active.scheme !== "file") {
      void vscode10.window.showWarningMessage("\u5F53\u524D\u6CA1\u6709\u53EF\u4E0A\u4F20\u7684\u672C\u5730\u6587\u4EF6\u3002");
      return;
    }
    await upload(active, [active]);
  }
  async function promptForUrl() {
    const choice = await vscode10.window.showErrorMessage("\u5C1A\u672A\u8BBE\u7F6E Kaggle Jupyter URL\u3002", "\u8BBE\u7F6E URL");
    if (choice === "\u8BBE\u7F6E URL") {
      await setServerUrl();
      await vscode10.commands.executeCommand("kaggleConnector.connection.focus");
    }
  }
  async function promptForRemoteDir() {
    const choice = await vscode10.window.showErrorMessage(
      "\u5C1A\u672A\u8BBE\u7F6E\u5DE5\u4F5C\u76EE\u5F55 (REMOTE_DIR)\u3002",
      "\u8BBE\u7F6E\u76EE\u5F55"
    );
    if (choice === "\u8BBE\u7F6E\u76EE\u5F55") {
      await setRemoteDirCommand();
      await vscode10.commands.executeCommand("kaggleConnector.connection.focus");
    }
  }
  async function offerSessionRecovery(error) {
    if (!isSessionError(error)) {
      return false;
    }
    const choice = await vscode10.window.showErrorMessage(
      `Kaggle \u4F1A\u8BDD\u53EF\u80FD\u5DF2\u8FC7\u671F\uFF1A${shortError(error)}`,
      "\u66F4\u65B0 Jupyter URL",
      "\u67E5\u770B\u65E5\u5FD7"
    );
    if (choice === "\u66F4\u65B0 Jupyter URL") {
      await setServerUrl();
      await vscode10.commands.executeCommand("kaggleConnector.connection.focus");
    } else if (choice === "\u67E5\u770B\u65E5\u5FD7") {
      output.show();
    }
    return true;
  }
  async function offerProbeRecovery(probe) {
    const error = probe.error;
    if (!error) {
      return;
    }
    logError(error);
    if (probe.likelyExpired) {
      const choice2 = await vscode10.window.showErrorMessage(
        `Kaggle \u4F1A\u8BDD\u53EF\u80FD\u5DF2\u5931\u6548\uFF1A${shortError(error)}`,
        "\u66F4\u65B0 Jupyter URL",
        "\u67E5\u770B\u65E5\u5FD7"
      );
      if (choice2 === "\u66F4\u65B0 Jupyter URL") {
        await setServerUrl();
        await vscode10.commands.executeCommand("kaggleConnector.connection.focus");
      } else if (choice2 === "\u67E5\u770B\u65E5\u5FD7") {
        output.show();
      }
      return;
    }
    const choice = await vscode10.window.showErrorMessage(
      `\u8FDE\u63A5\u5931\u8D25\uFF1A${shortError(error)}`,
      "\u67E5\u770B\u65E5\u5FD7"
    );
    if (choice === "\u67E5\u770B\u65E5\u5FD7") {
      output.show();
    }
  }
  async function notifySummary(summary, remoteDir) {
    log(
      `\u7ED3\u679C\uFF1A\u603B\u8BA1 ${summary.total}\uFF0C\u6210\u529F ${summary.uploaded}\uFF0C\u5931\u8D25 ${summary.failed}\uFF0C\u8DF3\u8FC7 ${summary.skipped}\uFF08\u672A\u4FEE\u6539 ${summary.unchanged}\uFF0C\u8FDC\u7AEF\u8F83\u65B0 ${summary.skippedNewer}\uFF09\uFF0C\u53D6\u6D88=${summary.cancelled}\uFF0C\u4F1A\u8BDD\u8FC7\u671F=${summary.sessionExpired}`
    );
    if (summary.sessionExpired) {
      const choice2 = await vscode10.window.showErrorMessage(
        `\u4E0A\u4F20\u4E2D\u65AD\uFF1AKaggle \u4F1A\u8BDD\u53EF\u80FD\u5DF2\u8FC7\u671F\u3002\u6210\u529F ${summary.uploaded}\uFF0C\u5931\u8D25 ${summary.failed}\uFF0C\u8DF3\u8FC7 ${summary.skipped}\u3002`,
        "\u66F4\u65B0 Jupyter URL",
        "\u67E5\u770B\u65E5\u5FD7"
      );
      if (choice2 === "\u66F4\u65B0 Jupyter URL") {
        await setServerUrl();
        await vscode10.commands.executeCommand("kaggleConnector.connection.focus");
      } else if (choice2 === "\u67E5\u770B\u65E5\u5FD7") {
        output.show();
      }
      return;
    }
    if (summary.cancelled) {
      const choice2 = await vscode10.window.showWarningMessage(
        `\u5DF2\u53D6\u6D88\u4E0A\u4F20\uFF1A\u6210\u529F ${summary.uploaded}\uFF0C\u5931\u8D25 ${summary.failed}\uFF0C\u8DF3\u8FC7 ${summary.skipped}\u3002`,
        "\u67E5\u770B\u65E5\u5FD7"
      );
      if (choice2 === "\u67E5\u770B\u65E5\u5FD7") {
        output.show();
      }
      return;
    }
    if (summary.failed === 0) {
      const skipDetails = [];
      if (summary.unchanged > 0) {
        skipDetails.push(`${summary.unchanged} \u4E2A\u672A\u4FEE\u6539`);
      }
      if (summary.skippedNewer > 0) {
        skipDetails.push(`${summary.skippedNewer} \u4E2A\u8FDC\u7AEF\u8F83\u65B0`);
      }
      const otherSkipped = Math.max(
        0,
        summary.skipped - summary.unchanged - summary.skippedNewer
      );
      if (otherSkipped > 0) {
        skipDetails.push(`${otherSkipped} \u4E2A\u88AB\u6392\u9664/\u7B26\u53F7\u94FE\u63A5`);
      }
      const skippedText = skipDetails.length ? `\uFF1B\u8DF3\u8FC7 ${skipDetails.join("\u3001")}` : "";
      if (summary.uploaded === 0) {
        vscode10.window.setStatusBarMessage(
          `\u6CA1\u6709\u9700\u8981\u4E0A\u4F20\u7684\u6587\u4EF6\uFF1A${skipDetails.length ? skipDetails.join("\uFF0C") : "0 \u4E2A\u6587\u4EF6"}`,
          5e3
        );
        return;
      }
      vscode10.window.setStatusBarMessage(
        `$(check) \u5DF2\u4E0A\u4F20 ${summary.uploaded} \u4E2A\u6587\u4EF6\u5230 \u201C${remoteDir}\u201D${skippedText}`,
        6e3
      );
      return;
    }
    const details = summary.failures.slice(0, 3).map((failure) => {
      const target = failure.remotePath ?? failure.localPath;
      const message = shortError(failure.error);
      return `${target}: ${message.length > 160 ? `${message.slice(0, 160)}\u2026` : message}`;
    });
    const choice = await vscode10.window.showWarningMessage(
      `\u4E0A\u4F20\u5B8C\u6210\uFF1A\u6210\u529F ${summary.uploaded}\uFF0C\u5931\u8D25 ${summary.failed}\uFF0C\u8DF3\u8FC7 ${summary.skipped}\u3002
${details.join("\n")}`,
      "\u67E5\u770B\u65E5\u5FD7"
    );
    if (choice === "\u67E5\u770B\u65E5\u5FD7") {
      output.show();
    }
  }
}
async function confirmRemoteNewer(files) {
  const names = files.slice(0, 5).map((file) => file.remotePath);
  const detail = files.length > 5 ? `${names.join("\n")}
\u2026 \u53E6\u6709 ${files.length - 5} \u4E2A` : names.join("\n");
  const choice = await vscode10.window.showWarningMessage(
    `${files.length} \u4E2A\u8FDC\u7AEF\u6587\u4EF6\u6BD4\u672C\u5730\u65B0\uFF0C\u7EE7\u7EED\u4E0A\u4F20\u4F1A\u8986\u76D6 Kaggle \u4E0A\u7684\u6539\u52A8\u3002`,
    { modal: true, detail },
    "\u8986\u76D6\u5E76\u4E0A\u4F20",
    "\u8DF3\u8FC7\u8FD9\u4E9B\u6587\u4EF6",
    "\u53D6\u6D88\u4E0A\u4F20"
  );
  if (choice === "\u8986\u76D6\u5E76\u4E0A\u4F20") {
    return "overwrite";
  }
  if (choice === "\u8DF3\u8FC7\u8FD9\u4E9B\u6587\u4EF6") {
    return "skip";
  }
  return "cancel";
}
function log(message) {
  output.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}`);
}
function logError(error) {
  output.appendLine(`[${(/* @__PURE__ */ new Date()).toISOString()}] [ERROR] ${describeError(error)}`);
  if (error instanceof Error && error.stack) {
    output.appendLine(error.stack);
  }
}
function deactivate() {
  return remoteFileSystem?.flushAll().catch(() => void 0);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
