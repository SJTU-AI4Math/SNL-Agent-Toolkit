// node_modules/@deepseek-ai/cosmokit/lib/index.js
function isNullable(value) {
  return value === null || value === void 0;
}
function isPlainObject(data) {
  return data && typeof data === "object" && !Array.isArray(data);
}
function filterKeys(object2, filter) {
  return Object.fromEntries(Object.entries(object2).filter(([key, value]) => filter(key, value)));
}
function mapValues(object2, transform) {
  return Object.fromEntries(Object.entries(object2).map(([key, value]) => [key, transform(value, key)]));
}
function pick(source, keys, forced) {
  if (!keys) return { ...source };
  const result = {};
  for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
  return result;
}
function defineProperty(object2, key, value) {
  return Object.defineProperty(object2, key, {
    writable: true,
    value,
    enumerable: false
  });
}
function is(type, value) {
  if (arguments.length === 1) return (value2) => is(type, value2);
  return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
  return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
  return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
var Binary;
(function(Binary2) {
  Binary2.is = isArrayBufferLike;
  Binary2.isSource = isArrayBufferSource;
  function fromSource(source) {
    if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    else return source;
  }
  Binary2.fromSource = fromSource;
  function toBase64(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
    let binary = "";
    const bytes = new Uint8Array(source);
    for (let i4 = 0; i4 < bytes.byteLength; i4++) binary += String.fromCharCode(bytes[i4]);
    return btoa(binary);
  }
  Binary2.toBase64 = toBase64;
  function fromBase64(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
    return Uint8Array.from(atob(source), (c3) => c3.charCodeAt(0));
  }
  Binary2.fromBase64 = fromBase64;
  function toHex(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
    return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  Binary2.toHex = toHex;
  function fromHex(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
    const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
    const buffer = [];
    for (let i4 = 0; i4 < hex.length; i4 += 2) buffer.push(parseInt(`${hex[i4]}${hex[i4 + 1]}`, 16));
    return Uint8Array.from(buffer).buffer;
  }
  Binary2.fromHex = fromHex;
})(Binary || (Binary = {}));
var base64ToArrayBuffer = Binary.fromBase64;
var arrayBufferToBase64 = Binary.toBase64;
var hexToArrayBuffer = Binary.fromHex;
var arrayBufferToHex = Binary.toHex;
function clone(source, refs = /* @__PURE__ */ new Map()) {
  if (!source || typeof source !== "object") return source;
  if (is("Date", source)) return new Date(source.valueOf());
  if (is("RegExp", source)) return new RegExp(source.source, source.flags);
  if (isArrayBufferLike(source)) return source.slice(0);
  if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const cached = refs.get(source);
  if (cached) return cached;
  if (Array.isArray(source)) {
    const result2 = [];
    refs.set(source, result2);
    source.forEach((value, index) => {
      result2[index] = Reflect.apply(clone, null, [value, refs]);
    });
    return result2;
  }
  const result = Object.create(Object.getPrototypeOf(source));
  refs.set(source, result);
  for (const key of Reflect.ownKeys(source)) {
    const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
    if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
    Reflect.defineProperty(result, key, descriptor);
  }
  return result;
}
function deepEqual(a3, b2, strict) {
  if (a3 === b2) return true;
  if (!strict && isNullable(a3) && isNullable(b2)) return true;
  if (typeof a3 !== typeof b2) return false;
  if (typeof a3 !== "object") return false;
  if (!a3 || !b2) return false;
  function check(test, then) {
    return test(a3) ? test(b2) ? then(a3, b2) : false : test(b2) ? false : void 0;
  }
  return check(Array.isArray, (a4, b3) => a4.length === b3.length && a4.every((item, index) => deepEqual(item, b3[index]))) ?? check(is("Date"), (a4, b3) => a4.valueOf() === b3.valueOf()) ?? check(is("RegExp"), (a4, b3) => a4.source === b3.source && a4.flags === b3.flags) ?? check(isArrayBufferLike, (a4, b3) => {
    if (a4.byteLength !== b3.byteLength) return false;
    const viewA = new Uint8Array(a4);
    const viewB = new Uint8Array(b3);
    for (let i4 = 0; i4 < viewA.length; i4++) if (viewA[i4] !== viewB[i4]) return false;
    return true;
  }) ?? Object.keys({
    ...a3,
    ...b2
  }).every((key) => deepEqual(a3[key], b2[key], strict));
}
function tokenize(source, delimiters2, delimiter) {
  const output = [];
  let state = 0;
  for (let i4 = 0; i4 < source.length; i4++) {
    const code = source.charCodeAt(i4);
    if (code >= 65 && code <= 90) {
      if (state === 1) {
        const next = source.charCodeAt(i4 + 1);
        if (next >= 97 && next <= 122) output.push(delimiter);
        output.push(code + 32);
      } else {
        if (state !== 0) output.push(delimiter);
        output.push(code + 32);
      }
      state = 1;
    } else if (code >= 97 && code <= 122) {
      output.push(code);
      state = 2;
    } else if (delimiters2.includes(code)) {
      if (state !== 0) output.push(delimiter);
      state = 0;
    } else output.push(code);
  }
  return String.fromCharCode(...output);
}
function paramCase(source) {
  return tokenize(source, [45, 95], 45);
}
var hyphenate = paramCase;
var Time;
(function(Time2) {
  Time2.millisecond = 1;
  Time2.second = 1e3;
  Time2.minute = Time2.second * 60;
  Time2.hour = Time2.minute * 60;
  Time2.day = Time2.hour * 24;
  Time2.week = Time2.day * 7;
  let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
  function setTimezoneOffset(offset) {
    timezoneOffset = offset;
  }
  Time2.setTimezoneOffset = setTimezoneOffset;
  function getTimezoneOffset() {
    return timezoneOffset;
  }
  Time2.getTimezoneOffset = getTimezoneOffset;
  function getDateNumber(date2 = /* @__PURE__ */ new Date(), offset) {
    if (typeof date2 === "number") date2 = new Date(date2);
    if (offset === void 0) offset = timezoneOffset;
    return Math.floor((date2.valueOf() / Time2.minute - offset) / 1440);
  }
  Time2.getDateNumber = getDateNumber;
  function fromDateNumber(value, offset) {
    const date2 = new Date(value * Time2.day);
    if (offset === void 0) offset = timezoneOffset;
    return new Date(+date2 + offset * Time2.minute);
  }
  Time2.fromDateNumber = fromDateNumber;
  const numeric = /\d+(?:\.\d+)?/.source;
  const timeRegExp = new RegExp(`^${[
    "w(?:eek(?:s)?)?",
    "d(?:ay(?:s)?)?",
    "h(?:our(?:s)?)?",
    "m(?:in(?:ute)?(?:s)?)?",
    "s(?:ec(?:ond)?(?:s)?)?"
  ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
  function parseTime(source) {
    const capture = timeRegExp.exec(source);
    if (!capture) return 0;
    return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
  }
  Time2.parseTime = parseTime;
  function parseDate(date2) {
    const parsed = parseTime(date2);
    if (parsed) date2 = Date.now() + parsed;
    else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date2}`;
    else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date2}`;
    return date2 ? new Date(date2) : /* @__PURE__ */ new Date();
  }
  Time2.parseDate = parseDate;
  function format2(ms) {
    const abs = Math.abs(ms);
    if (abs >= Time2.day - Time2.hour / 2) return Math.round(ms / Time2.day) + "d";
    else if (abs >= Time2.hour - Time2.minute / 2) return Math.round(ms / Time2.hour) + "h";
    else if (abs >= Time2.minute - Time2.second / 2) return Math.round(ms / Time2.minute) + "m";
    else if (abs >= Time2.second) return Math.round(ms / Time2.second) + "s";
    return ms + "ms";
  }
  Time2.format = format2;
  function toDigits(source, length = 2) {
    return source.toString().padStart(length, "0");
  }
  Time2.toDigits = toDigits;
  function template(template2, time = /* @__PURE__ */ new Date()) {
    return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
  }
  Time2.template = template;
})(Time || (Time = {}));

// node_modules/@deepseek-ai/cordis/lib/index.js
var DisposableList = class {
  sn = 0;
  map = /* @__PURE__ */ new Map();
  weak = /* @__PURE__ */ new WeakMap();
  get length() {
    return this.map.size;
  }
  push(value) {
    const sn = ++this.sn;
    this.map.set(sn, value);
    this.weak.set(value, sn);
    return () => this.map.delete(sn);
  }
  delete(value) {
    const sn = this.weak.get(value);
    if (!sn) return false;
    return this.map.delete(sn);
  }
  clear() {
    const values = [...this.map.values()];
    this.map.clear();
    return values.reverse();
  }
  [Symbol.iterator]() {
    return this.map.values();
  }
  [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")]() {
    return [...this];
  }
};
var symbols = {
  shadow: /* @__PURE__ */ Symbol.for("cordis.shadow"),
  receiver: /* @__PURE__ */ Symbol.for("cordis.receiver"),
  original: /* @__PURE__ */ Symbol.for("cordis.original"),
  metadata: /* @__PURE__ */ Symbol.for("cordis.metadata"),
  initHooks: /* @__PURE__ */ Symbol.for("cordis.initHooks"),
  checkProto: /* @__PURE__ */ Symbol.for("cordis.checkProto"),
  effect: /* @__PURE__ */ Symbol.for("cordis.effect"),
  filter: /* @__PURE__ */ Symbol.for("cordis.filter"),
  isolate: /* @__PURE__ */ Symbol.for("cordis.isolate"),
  intercept: /* @__PURE__ */ Symbol.for("cordis.intercept"),
  init: /* @__PURE__ */ Symbol.for("cordis.init"),
  check: /* @__PURE__ */ Symbol.for("cordis.check"),
  config: /* @__PURE__ */ Symbol.for("cordis.config"),
  invoke: /* @__PURE__ */ Symbol.for("cordis.invoke"),
  extend: /* @__PURE__ */ Symbol.for("cordis.extend"),
  tracker: /* @__PURE__ */ Symbol.for("cordis.tracker"),
  resolveConfig: /* @__PURE__ */ Symbol.for("cordis.resolveConfig")
};
var GeneratorFunction = function* () {
}.constructor;
var AsyncGeneratorFunction = async function* () {
}.constructor;
function isConstructor(func) {
  if (!func.prototype) return false;
  if (func instanceof GeneratorFunction) return false;
  if (AsyncGeneratorFunction !== Function && func instanceof AsyncGeneratorFunction) return false;
  return true;
}
function joinPrototype(proto1, proto2) {
  if (proto1 === Object.prototype) return proto2;
  const result = Object.create(joinPrototype(Object.getPrototypeOf(proto1), proto2));
  for (const key of Reflect.ownKeys(proto1)) Object.defineProperty(result, key, Object.getOwnPropertyDescriptor(proto1, key));
  return result;
}
function isObject(value) {
  return value && (typeof value === "object" || typeof value === "function");
}
function getPropertyDescriptor(target, prop) {
  let proto = target;
  while (proto) {
    const desc = Reflect.getOwnPropertyDescriptor(proto, prop);
    if (desc) return desc;
    proto = Object.getPrototypeOf(proto);
  }
}
function getTraceable(ctx, value) {
  if (!isObject(value)) return value;
  if (Object.hasOwn(value, symbols.shadow)) return Object.getPrototypeOf(value);
  const tracker = value[symbols.tracker];
  if (!tracker) return value;
  return createTraceable(ctx, value, tracker);
}
function withProps(target, props) {
  if (!props) return target;
  return new Proxy(target, {
    get: (target2, prop, receiver) => {
      if (prop in props && prop !== "constructor") return Reflect.get(props, prop, receiver);
      return Reflect.get(target2, prop, receiver);
    },
    set: (target2, prop, value, receiver) => {
      if (prop in props && prop !== "constructor") return Reflect.set(props, prop, value, receiver);
      return Reflect.set(target2, prop, value, receiver);
    }
  });
}
function withProp(target, prop, value) {
  return withProps(target, Object.defineProperty(/* @__PURE__ */ Object.create(null), prop, {
    value,
    writable: false
  }));
}
function createShadow(ctx, target, property2, receiver) {
  if (!property2) return receiver;
  const origin = Reflect.getOwnPropertyDescriptor(target, property2)?.value;
  if (!origin) return receiver;
  return withProp(receiver, property2, ctx.extend({ [symbols.shadow]: origin }));
}
function createShadowMethod(ctx, value, outer, shadow) {
  return new Proxy(value, { apply: (target, thisArg, args) => {
    if (thisArg === outer) thisArg = shadow;
    return getTraceable(ctx, Reflect.apply(target, thisArg, args));
  } });
}
function createTraceable(ctx, value, tracker) {
  if (ctx[symbols.shadow] && !tracker.noShadow) ctx = Object.getPrototypeOf(ctx);
  const proxy = new Proxy(value, {
    get: (target, prop, receiver) => {
      if (prop === symbols.original) return target;
      if (prop === tracker.property) return ctx;
      if (typeof prop === "symbol") return Reflect.get(target, prop, receiver);
      if (tracker.associate && ctx.reflect.props[`${tracker.associate}.${prop}`]) return Reflect.get(ctx, `${tracker.associate}.${prop}`, withProp(ctx, symbols.receiver, receiver));
      let shadow, innerValue;
      const desc = getPropertyDescriptor(target, prop);
      if (desc && "value" in desc) innerValue = desc.value;
      else {
        shadow = createShadow(ctx, target, tracker.property, receiver);
        innerValue = Reflect.get(target, prop, shadow);
      }
      const innerTracker = innerValue?.[symbols.tracker];
      if (innerTracker) return createTraceable(ctx, innerValue, innerTracker);
      else if (!tracker.noShadow && typeof innerValue === "function") {
        shadow ??= createShadow(ctx, target, tracker.property, receiver);
        return createShadowMethod(ctx, innerValue, receiver, shadow);
      } else return innerValue;
    },
    set: (target, prop, value2, receiver) => {
      if (prop === symbols.original) return false;
      if (prop === tracker.property) return false;
      if (typeof prop === "symbol") return Reflect.set(target, prop, value2, receiver);
      if (tracker.associate && ctx.reflect.props[`${tracker.associate}.${prop}`]) return Reflect.set(ctx, `${tracker.associate}.${prop}`, value2, withProp(ctx, symbols.receiver, receiver));
      const shadow = createShadow(ctx, target, tracker.property, receiver);
      return Reflect.set(target, prop, value2, shadow);
    },
    apply: (target, thisArg, args) => {
      return applyTraceable(proxy, target, thisArg, args);
    }
  });
  return proxy;
}
function applyTraceable(proxy, value, thisArg, args) {
  if (!value[symbols.invoke]) return Reflect.apply(value, thisArg, args);
  return value[symbols.invoke].apply(proxy, args);
}
function createCallable(name2, proto, tracker) {
  const self = function(...args) {
    return applyTraceable(createTraceable(self["ctx"], self, tracker), self, this, args);
  };
  defineProperty(self, "name", name2);
  return Object.setPrototypeOf(self, proto);
}
function handleError(info, reason, getOuterStack) {
  const innerLines = info.error.stack.split("\n");
  if (typeof reason?.stack !== "string") {
    const outerError = new Error(reason);
    const lines2 = outerError.stack.split("\n");
    lines2.splice(1, Infinity, ...getOuterStack());
    outerError.stack = lines2.join("\n");
    throw outerError;
  }
  const lines = reason.stack.split("\n");
  let index = lines.indexOf(innerLines[2]);
  if (index === -1) throw reason;
  index -= info.offset;
  while (index > 0) {
    if (!lines[index - 1].endsWith(" (<anonymous>)")) break;
    index -= 1;
  }
  lines.splice(index, Infinity, ...getOuterStack());
  reason.stack = lines.join("\n");
  throw reason;
}
function composeError(callback, getOuterStack = buildOuterStack()) {
  const info = {
    offset: 1,
    error: /* @__PURE__ */ new Error()
  };
  try {
    const result = callback(info);
    if (isObject(result) && "then" in result) return result.then(void 0, (reason) => handleError(info, reason, getOuterStack));
    else return result;
  } catch (reason) {
    handleError(info, reason, getOuterStack);
  }
}
function buildOuterStack(offset = 0) {
  const outerError = /* @__PURE__ */ new Error();
  return () => outerError.stack.split("\n").slice(3 + offset);
}
function isBailed(value) {
  return value !== null && value !== false && value !== void 0;
}
var EventsService = class {
  ctx;
  _hooks = {};
  constructor(ctx) {
    this.ctx = ctx;
    defineProperty(this, symbols.tracker, {
      property: "ctx",
      noShadow: true
    });
    this.on("internal/listener", function(name2, listener, options) {
      if (name2 === "internal/update" && !options.global) return (this.fiber._hooks["internal/update"] ??= new DisposableList())[options.prepend ? "unshift" : "push"](listener);
    });
    this.on("internal/update", function(config, noSave, next) {
      const cbs = [...this._hooks["internal/update"] || []];
      const _next = () => {
        return (cbs.shift() ?? next).call(this, config, noSave, _next);
      };
      return _next();
    }, {
      global: true,
      prepend: true
    });
  }
  /**
  * Resolve listeners for one dispatch and apply context filtering.
  *
  * @param type — the dispatch mode, reported on `internal/dispatch`.
  * @param args — the raw dispatch arguments; consumed up to the event name.
  * @returns the matching listener callbacks, bound to the dispatch `this`.
  */
  dispatch(type, args) {
    const thisArg = typeof args[0] === "object" || typeof args[0] === "function" ? args.shift() : null;
    const name2 = args.shift();
    if (!name2.startsWith("internal/")) this.emit("internal/dispatch", type, name2, args, thisArg);
    const filter = thisArg?.[Context.filter];
    return (this._hooks[name2] || []).filter((hook) => hook.global || !filter || filter.call(thisArg, hook.ctx)).map((hook) => hook.callback.bind(thisArg));
  }
  /**
  * Run listeners concurrently and wait for all of them.
  *
  * @param args — optional `this`, the event name, then listener arguments.
  * @returns a promise resolving once every listener has settled.
  */
  async parallel(...args) {
    const errors = (await Promise.allSettled(this.dispatch("emit", args).map(async (cb) => cb(...args)))).filter((result) => result.status === "rejected");
    if (errors.length) throw new AggregateError(errors.map((error) => error.reason));
  }
  /**
  * Run listeners synchronously without waiting for returned promises.
  *
  * @param args — optional `this`, the event name, then listener arguments.
  */
  emit(...args) {
    this.dispatch("emit", args).map((cb) => cb(...args));
  }
  /**
  * Run listeners in order, awaiting each, until one returns a bail value.
  *
  * @param args — optional `this`, the event name, then listener arguments.
  * @returns the first bail value (see {@link isBailed}), if any.
  */
  async serial(...args) {
    for (const cb of this.dispatch("serial", args)) {
      const result = await cb(...args);
      if (isBailed(result)) return result;
    }
  }
  /**
  * Run listeners synchronously until one returns a bail value.
  *
  * @param args — optional `this`, the event name, then listener arguments.
  * @returns the first bail value (see {@link isBailed}), if any.
  */
  bail(...args) {
    for (const cb of this.dispatch("bail", args)) {
      const result = cb(...args);
      if (isBailed(result)) return result;
    }
  }
  /**
  * Compose listeners around the final `next` callback.
  *
  * The last dispatch argument is treated as the innermost `next`. Listeners
  * run outermost-first; a listener that does not call `next()` vetoes the
  * rest of the chain, including the built-in behavior.
  *
  * @param args — optional `this`, the event name, listener arguments, then `next`.
  * @returns the outermost listener's return value.
  */
  waterfall(...args) {
    const cbs = this.dispatch("waterfall", args);
    const inner2 = args.pop();
    const next = () => {
      return (cbs.shift() ?? inner2)(...args);
    };
    args.push(next);
    return next();
  }
  /**
  * Store a listener record as an effect on the current fiber.
  *
  * @param label — effect label shown in fiber diagnostics.
  * @param hooks — the listener list for one event.
  * @param callback — the listener to store.
  * @param options — placement and filtering options.
  * @returns a disposer that unregisters the listener.
  */
  register(label, hooks, callback, options) {
    const method = options.prepend ? "unshift" : "push";
    return this.ctx.fiber.effect(() => {
      hooks[method]({
        ctx: this.ctx,
        callback,
        ...options
      });
      return () => this.unregister(hooks, callback);
    }, label);
  }
  /**
  * Remove a stored listener record.
  *
  * @param hooks — the listener list for one event.
  * @param callback — the listener to remove.
  * @returns `true` if the listener was found and removed.
  */
  unregister(hooks, callback) {
    const index = hooks.findIndex((hook) => hook.callback === callback);
    if (index >= 0) {
      hooks.splice(index, 1);
      return true;
    }
  }
  /**
  * Register an event listener owned by the current fiber.
  *
  * The listener is removed automatically when the fiber unloads. Throws
  * `CordisError('INACTIVE_EFFECT')` if the fiber is already disposed.
  *
  * @param name — the event name to listen for.
  * @param listener — called with the dispatch arguments.
  * @param options — listener options; a boolean is shorthand for `prepend`.
  * @returns a disposer removing the listener; `true` if it was still registered.
  */
  on(name2, listener, options) {
    if (typeof options !== "object") options = { prepend: options };
    this.ctx.fiber.assertActive();
    listener = this.ctx.reflect.bind(listener);
    const result = this.bail(this.ctx, "internal/listener", name2, listener, options);
    if (result) return result;
    const hooks = this._hooks[name2] ||= [];
    const label = `ctx.on(${typeof name2 === "string" ? JSON.stringify(name2) : name2.toString()})`;
    return this.register(label, hooks, listener, options);
  }
  /**
  * Register an event listener that disposes itself after the first call.
  *
  * @param name — the event name to listen for.
  * @param listener — called at most once with the dispatch arguments.
  * @param options — listener options; a boolean is shorthand for `prepend`.
  * @returns a disposer removing the listener; `true` if it was still registered.
  */
  once(name2, listener, options) {
    const dispose = this.on(name2, function(...args) {
      dispose();
      return listener.apply(this, args);
    }, options);
    return dispose;
  }
};
var defaultFormatters = {
  s: (value) => String(value),
  d: (value) => Math.trunc(Number(value)),
  i: (value) => Math.trunc(Number(value)),
  f: (value) => Number(value),
  o: (value) => JSON.stringify(value),
  O: (value) => JSON.stringify(value),
  c: () => "",
  C: (value, exporter, message) => {
    return Logger.color(exporter, Logger.code(message.name, exporter.colors), value);
  }
};
function isAggregateError(error) {
  return error instanceof Error && Array.isArray(error["errors"]);
}
var Logger = class {
  service;
  static color(exporter, code, value, decoration = "") {
    if (!exporter.colors) return "" + value;
    return `\x1B[3${code < 8 ? code : "8;5;" + code}${exporter.colors >= 2 ? decoration : ""}m${value}\x1B[0m`;
  }
  static code(name2, level) {
    let hash = 0;
    for (let i4 = 0; i4 < name2.length; i4++) {
      hash = (hash << 3) - hash + name2.charCodeAt(i4) + 13;
      hash |= 0;
    }
    const colors = !level ? [] : level >= 2 ? c256 : c16;
    return colors[Math.abs(hash) % colors.length];
  }
  static format(exporter, message) {
    const args = message.args.slice();
    if (args[0] instanceof Error) {
      args[0] = args[0].stack || args[0].message;
      args.unshift("%s");
    } else if (typeof args[0] !== "string") args.unshift("%o");
    let format2 = args.shift();
    format2 = format2.replace(/%([a-zA-Z%])/g, (match, char) => {
      if (match === "%%") return "%";
      const formatter = exporter.formatters?.[char] ?? defaultFormatters[char];
      if (typeof formatter === "function") return formatter(args.shift(), exporter, message);
      return match;
    });
    const oFormatter = exporter.formatters?.o ?? defaultFormatters.o;
    for (let arg of args) {
      if (typeof arg === "object" && arg) arg = oFormatter(arg, exporter, message);
      format2 += " " + arg;
    }
    const { maxLength = 10240 } = exporter;
    return format2.split(/\r?\n/g).map((line) => {
      return line.slice(0, maxLength) + (line.length > maxLength ? "..." : "");
    }).join("\n");
  }
  constructor(options, service) {
    this.service = service;
    Object.assign(this, options);
    this.error = this._method("error", 0);
    this.info = this._method("info", 1);
    this.warn = this._method("warn", 2);
    this.debug = this._method("debug", 3);
  }
  _method(type, level) {
    return (...args) => {
      if (args.length === 1 && args[0] instanceof Error) {
        if (args[0].cause) this[type](args[0].cause);
        else if (isAggregateError(args[0])) {
          args[0].errors.forEach((error) => this[type](error));
          return;
        }
      }
      const sn = ++this.service._snMessage;
      const ts = Date.now();
      for (const exporter of this.service.exporters.values()) {
        if ((exporter.levels?.[this.name] ?? exporter.levels?.default ?? this.level ?? 1) < level) continue;
        const message = {
          sn,
          ts,
          type,
          level,
          name: this.name,
          ...this.meta,
          args
        };
        exporter.export(message);
      }
    };
  }
};
var c16 = [
  6,
  2,
  3,
  4,
  5,
  1
];
var c256 = [
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
var LoggerService = class LoggerService2 {
  bufferSize = 1e3;
  buffer = [];
  ctx;
  _snMessage = 0;
  _snExporter = 0;
  exporters = /* @__PURE__ */ new Map();
  constructor(ctx) {
    const tracker = {
      property: "ctx",
      noShadow: true
    };
    const self = createCallable("logger", joinPrototype(Object.getPrototypeOf(this), Function.prototype), tracker);
    Object.assign(self, this);
    self.ctx = ctx;
    defineProperty(self, symbols.tracker, tracker);
    self.exporter({
      colors: 3,
      export: (message) => {
        self.buffer.push(message);
        if (self.buffer.length > self.bufferSize) self.buffer = self.buffer.slice(-self.bufferSize);
      }
    });
    return self;
  }
  /**
  * Register an exporter and dispose it with the current fiber.
  *
  * @param exporter — the sink that receives structured log messages.
  * @returns a disposer that removes the exporter.
  */
  exporter(exporter) {
    return this.ctx.effect(() => {
      this.exporters.set(++this._snExporter, exporter);
      return () => this.exporters.delete(this._snExporter);
    }, "ctx.logger.exporter()");
  }
  _resolveConfig() {
    let intercept = this.ctx[symbols.intercept];
    const configs = [];
    while ("logger" in intercept) {
      if (Object.hasOwn(intercept, "logger")) configs.unshift(intercept["logger"]);
      intercept = Object.getPrototypeOf(intercept);
    }
    return Object.assign({}, ...configs);
  }
  [symbols.invoke](name2) {
    const config = this._resolveConfig();
    const fiber = (this.ctx[symbols.shadow] ?? this.ctx).fiber;
    name2 ??= config.name;
    name2 ??= hyphenate(fiber.name);
    return new Logger({
      name: name2,
      level: config.level,
      meta: { fiber: new WeakRef(fiber) }
    }, this);
  }
  static {
    for (const type of [
      "error",
      "info",
      "warn",
      "debug"
    ]) LoggerService2.prototype[type] = function(...args) {
      return this()[type](...args);
    };
  }
};
function enhanceError(error) {
  const lines = error.stack.split("\n");
  lines.splice(0, 2, `Error: ${error.message}`);
  error.stack = lines.join("\n");
  return error;
}
var RESERVED_WORDS = ["prototype", "then"];
function isSpecialProperty(prop) {
  return typeof prop === "symbol" || RESERVED_WORDS.includes(prop) || parseInt(prop).toString() === prop || prop.startsWith("_");
}
var ReflectService = class {
  ctx;
  /** Proxy traps implementing service resolution for every context object. */
  static handler = {
    get: (target, prop, ctx) => {
      if (isSpecialProperty(prop)) return Reflect.get(target, prop, ctx);
      if (Reflect.has(target, prop)) return getTraceable(ctx, Reflect.get(target, prop, ctx));
      const error = /* @__PURE__ */ new Error(`cannot get property "${prop}" without inject`);
      try {
        const def = target.reflect.props[prop];
        if (def?.type === "accessor") return def.get.call(ctx, ctx[symbols.receiver], error);
        if (!ctx.fiber.runtime) return ctx.reflect.get(prop, false);
        return ctx.events.waterfall("internal/get", ctx, prop, error, () => {
          const key = target[symbols.isolate][prop];
          let fiber = (ctx[symbols.shadow] ?? ctx).fiber;
          while (true) {
            const impl = fiber.store?.[prop];
            if (impl) return getTraceable(ctx, impl.value);
            if (prop in fiber.inject) {
              error.message = `cannot get required service "${prop}" in inactive context`;
              throw error;
            }
            if (!fiber.runtime) throw error;
            if (fiber.parent[symbols.isolate][prop] !== key) throw error;
            fiber = fiber.parent.fiber;
          }
        });
      } catch (e) {
        throw e === error ? enhanceError(e) : e;
      }
    },
    set: (target, prop, value, ctx) => {
      if (isSpecialProperty(prop)) return Reflect.set(target, prop, value, ctx);
      const error = /* @__PURE__ */ new Error(`cannot set property "${prop}" without provide`);
      const def = target.reflect.props[prop];
      if (!def) {
        if (!ctx.fiber.runtime) return Reflect.set(target, prop, value, ctx);
        throw enhanceError(error);
      }
      try {
        if (def.type === "accessor") {
          if (!def.set) return false;
          return def.set.call(ctx, value, ctx[symbols.receiver], error);
        }
        return ctx.events.waterfall("internal/set", ctx, prop, value, error, () => {
          return ctx.reflect.set(prop, value, error);
        });
      } catch (e) {
        throw e === error ? enhanceError(e) : e;
      }
    },
    has: (target, prop) => {
      if (isSpecialProperty(prop)) return Reflect.has(target, prop);
      if (Reflect.has(target, prop)) return true;
      return !!target.reflect.props[prop];
    }
  };
  /** Service implementations, keyed by isolation label. */
  store = /* @__PURE__ */ Object.create(null);
  /** Declared context properties (services and accessors), by name. */
  props = /* @__PURE__ */ Object.create(null);
  constructor(ctx) {
    this.ctx = ctx;
    defineProperty(this, symbols.tracker, {
      property: "ctx",
      noShadow: true
    });
    this.mixin("reflect", [
      "get",
      "set",
      "provide",
      "accessor",
      "mixin"
    ]);
    this.mixin("fiber", ["runtime", "effect"]);
    this.mixin("registry", ["inject", "plugin"]);
    this.mixin("events", [
      "on",
      "once",
      "parallel",
      "emit",
      "serial",
      "bail",
      "waterfall"
    ]);
  }
  /**
  * Read a service from the store without the inject requirement.
  *
  * @param name — the service name.
  * @param strict — when `true`, only return implementations whose providing
  * fiber is currently active.
  * @returns the service value, or `undefined` when not (yet) provided.
  */
  get(name2, strict = true) {
    return getTraceable(this.ctx, this._getImpl(name2, strict)?.value);
  }
  _getImpl(name2, strict = true) {
    const key = this.ctx[symbols.isolate][name2];
    const impl = key && this.store[key];
    if (!impl) return;
    if (strict && impl.fiber.state !== 2) return;
    return impl;
  }
  /**
  * Overwrite a provided service's value.
  *
  * @param name — the service name.
  * @param value — the new service value.
  * @param error — carrier for the caller stack in diagnostics.
  * @returns `true` on success.
  * @throws when `name` was never provided, or was provided by another fiber.
  */
  set(name2, value, error) {
    const key = this.ctx[symbols.isolate][name2];
    const impl = this.store[key];
    if (!impl) throw new Error(`cannot set property "${name2}" without provide`);
    if (impl.fiber !== this.ctx.fiber) throw new Error(`cannot set property "${name2}" in multiple fibers`);
    impl.value = value;
    return true;
  }
  /**
  * Register a service implementation owned by the current fiber.
  *
  * See the `ctx.provide()` overload above for the full contract.
  *
  * @param name — the service name.
  * @param value — the service value.
  * @param check — optional availability predicate for dependents.
  * @returns a disposer that unregisters the service.
  */
  provide(name2, value, check) {
    return this.ctx.fiber.effect(() => {
      if (!this.props[name2]) this.props[name2] ??= { type: "service" };
      else if (this.props[name2].type !== "service") throw new Error(`property "${name2}" is already declared as ${this.props[name2].type}`);
      this.props[name2] = { type: "service" };
      this.ctx.root[symbols.isolate][name2] ??= Symbol(name2);
      const key = this.ctx[symbols.isolate][name2];
      const impl = {
        name: name2,
        value,
        fiber: this.ctx.fiber,
        check
      };
      if (this.store[key]) throw new Error(`service "${name2}" has been registered at <${this.store[key].fiber.name}>`);
      this.store[key] = impl;
      this.ctx.fiber.store[name2] = impl;
      if (this.ctx.fiber.state === 2) this.notify([name2]);
      return async () => {
        delete this.store[key];
        const fibers = this.notify([name2]);
        await Promise.allSettled(fibers.map((fiber) => fiber.await()));
        delete this.ctx.fiber.store[name2];
      };
    }, `ctx.provide(${JSON.stringify(name2)})`);
  }
  /**
  * Re-evaluate every fiber that requires one of the given services.
  *
  * @param names — the service names that changed.
  * @param filter — restricts notification to matching isolation scopes.
  * @returns the fibers whose dependency state was refreshed.
  */
  notify(names, filter = (ctx, name2) => ctx[symbols.isolate][name2] === this.ctx[symbols.isolate][name2]) {
    const fibers = [];
    for (const runtime of this.ctx.registry.values()) for (const fiber of runtime.fibers) {
      let hasUpdate = false;
      for (const name2 of names) {
        if (!(name2 in fiber.inject)) continue;
        if (!filter(fiber.ctx, name2)) continue;
        hasUpdate = true;
        fiber._checkImpl(name2);
      }
      if (!hasUpdate) continue;
      fiber._refresh();
      fibers.push(fiber);
    }
    for (const name2 of names) {
      const self = Object.create(this.ctx);
      self[symbols.filter] = (target) => filter(target, name2);
      this.ctx.events.emit(self, "internal/service", name2, this._getImpl(name2, false)?.value);
    }
    return fibers;
  }
  /**
  * Define a computed context property backed by get/set hooks.
  *
  * @param name — the context property name.
  * @param options — the `get` hook and optional `set` hook.
  * @returns a disposer that removes the accessor.
  */
  accessor(name2, options) {
    return this.ctx.fiber.effect(() => {
      if (name2 in this.props) throw new Error(`property "${name2}" is already declared as ${this.props[name2].type}`);
      this.props[name2] = {
        type: "accessor",
        ...options
      };
      return () => delete this.props[name2];
    }, `ctx.accessor(${JSON.stringify(name2)})`);
  }
  /**
  * Expose selected members of a service directly on `ctx`.
  *
  * See the `ctx.mixin()` overload above for the full contract.
  *
  * @param source — a context property name or a source object.
  * @param mixins — keys to forward, or a source-key → ctx-key map.
  * @returns a disposer that removes all created accessors.
  */
  mixin(source, mixins) {
    const self = this;
    return this.ctx.fiber.effect(function* () {
      const entries = Array.isArray(mixins) ? mixins.map((key) => [key, key]) : Object.entries(mixins);
      const getTarget = (ctx, error) => {
        return ctx[source];
      };
      for (const [key, value] of entries) yield self.accessor(value, {
        get(receiver, error) {
          const service = getTarget(this, error);
          if (isNullable(service)) return service;
          const mixin = receiver ? withProps(receiver, service) : service;
          const value2 = Reflect.get(service, key, mixin);
          if (typeof value2 !== "function") return value2;
          return value2.bind(mixin ?? service);
        },
        set(value2, receiver, error) {
          const service = getTarget(this, error);
          const mixin = receiver ? withProps(receiver, service) : service;
          return Reflect.set(service, key, value2, mixin);
        }
      });
    }, `ctx.mixin(${JSON.stringify(source)})`);
  }
  /**
  * Attach this context's tracing wrapper to a value.
  *
  * @param value — the value to wrap.
  * @returns the traceable wrapper (or the value itself when not applicable).
  */
  trace(value) {
    return getTraceable(this.ctx, value);
  }
  /**
  * Wrap a callback so calls trace `this` and arguments to this context.
  *
  * @param callback — the function to wrap.
  * @returns a proxy delegating to `callback` with traced values.
  */
  bind(callback) {
    return new Proxy(callback, {
      apply: (target, thisArg, args) => {
        return Reflect.apply(target, this.trace(thisArg), args.map((arg) => this.trace(arg)));
      },
      construct: (target, args, newTarget) => {
        return Reflect.construct(target, args.map((arg) => this.trace(arg)), newTarget);
      }
    });
  }
};
var kValidationError = /* @__PURE__ */ Symbol.for("ValidationError");
var ValidationError = class extends TypeError {
  name = "ValidationError";
  /**
  * Build the aggregated message from schema issues.
  *
  * @param issues — the standard-schema issues, one message line each.
  */
  constructor(issues) {
    super(`invalid config:
` + issues.map((issue) => {
      if (issue.path) return `  - ${issue.message} (at ${issue.path.join(".")})`;
      else return `  - ${issue.message}`;
    }).join("\n"));
  }
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
function resolveConfig(runtime, config) {
  if (!runtime.Config) return config;
  const result = runtime.Config["~standard"].validate(config);
  if ("then" in result) throw new TypeError("Async config validation is not supported");
  if (result.issues) throw new ValidationError(result.issues);
  else return result.value;
}
var effectInertia = /* @__PURE__ */ new WeakMap();
function runDisposable(dispose) {
  const result = dispose();
  return effectInertia.get(dispose)?.() ?? result;
}
function emitPluginDisposed(context, fiber) {
  const args = ["internal/plugin", fiber];
  let callbacks;
  try {
    callbacks = context.events.dispatch("emit", args);
  } catch (error) {
    context.logger.error(error);
    return;
  }
  for (const callback of callbacks) try {
    const returned = callback(...args);
    Promise.resolve(returned).catch((error) => context.logger.error(error));
  } catch (error) {
    context.logger.error(error);
  }
}
var CordisError = class CordisError2 extends Error {
  code;
  /**
  * @param code — the stable error code; also the default message.
  * @param message — optional human-readable override.
  */
  constructor(code, message) {
    super(message ?? CordisError2.Code[code]);
    this.code = code;
  }
};
(function(CordisError3) {
  CordisError3.Code = { INACTIVE_EFFECT: "cannot create effect on inactive context" };
})(CordisError || (CordisError = {}));
var INACTIVE = "__INACTIVE__";
var Fiber = class {
  parent;
  inject;
  runtime;
  /** Unique id within the registry; 0 for the root fiber, `null` once disposed. */
  uid;
  /** The context this fiber's plugin runs in (extends the parent context). */
  ctx;
  /** The validated plugin config (updated by `update()`). */
  config;
  /** The raw plugin config, re-resolved before each activation. */
  _config;
  /** Current lifecycle state; transitions emit `internal/status`. */
  state = 0;
  /** Dispose this fiber: unload the plugin, then settle once cleanup finished. */
  dispose;
  /** Snapshot of required service implementations while loaded; `undefined` otherwise. */
  store;
  /** The in-flight load/unload transition, if one is currently running. */
  inertia;
  _hooks = /* @__PURE__ */ Object.create(null);
  _disposables = new DisposableList();
  context;
  _error;
  _runner;
  _store = /* @__PURE__ */ Object.create(null);
  /**
  * Create a fiber. Plugin authors normally obtain fibers from `ctx.plugin()`
  * rather than constructing them directly.
  *
  * @param parent — the context the plugin was loaded from.
  * @param config — raw config, validated against the runtime's schema.
  * @param inject — resolved dependency map (service name → intercept config).
  * @param runtime — the shared plugin runtime, or `null` for the root fiber.
  * @param getOuterStack — captures the caller stack for effect diagnostics.
  */
  constructor(parent, config, inject2, runtime, getOuterStack) {
    this.parent = parent;
    this.inject = inject2;
    this.runtime = runtime;
    this._config = config;
    const collect = (dispose) => {
      this._disposables.push(dispose);
    };
    if (runtime) {
      this.uid = parent.registry.counter;
      this.ctx = this.context = parent.extend({ fiber: this });
      const injectEntries = Object.entries(this.inject);
      if (injectEntries.length) {
        this.ctx[Context.intercept] = Object.create(parent[Context.intercept]);
        for (const [name2, config2] of injectEntries) {
          if (isNullable(config2)) continue;
          this.ctx[Context.intercept][name2] = config2;
        }
      }
      this._runner = {
        epoch: INACTIVE,
        getOuterStack,
        execute: function() {
          if (isConstructor(runtime.callback)) {
            const instance = new runtime.callback(this.ctx, this.config);
            for (const hook of instance?.[symbols.initHooks] ?? []) hook();
            return instance?.[symbols.init]?.();
          } else return runtime.callback(this.ctx, this.config);
        },
        collect
      };
      this.dispose = parent.fiber.effect(() => {
        const remove = runtime.fibers.push(this);
        return async () => {
          this.uid = null;
          emitPluginDisposed(this.context, this);
          if (this.ctx.registry.has(runtime.callback)) {
            remove();
            if (!runtime.fibers.length) this.ctx.registry.delete(runtime.callback);
          }
          this._setEpoch(INACTIVE);
          if (!this.inertia) this._updateState(() => {
            this.inertia = this._unload();
            return 5;
          });
          while (this.inertia) await this.inertia;
        };
      }, "ctx.plugin()");
      try {
        this.context.emit("internal/plugin", this);
      } catch (error) {
        Promise.resolve(this.dispose()).catch((reason) => this.ctx.logger.error(reason));
        throw error;
      }
      if (this.uid !== null && parent.fiber.state !== 5) {
        for (const name2 of Object.keys(this.inject)) this._checkImpl(name2);
        this._refresh();
      }
    } else {
      this.uid = 0;
      this.ctx = this.context = parent;
      this.state = 2;
      this.store = /* @__PURE__ */ Object.create(null);
      this._runner = {
        epoch: "",
        getOuterStack,
        execute: () => {
        },
        collect
      };
      this.dispose = () => this.restart();
    }
  }
  /** The plugin's display name, inherited from the nearest named ancestor, else `'root'`. */
  get name() {
    let fiber = this;
    do {
      if (fiber.runtime?.name) return fiber.runtime.name;
      fiber = fiber.parent.fiber;
    } while (fiber !== fiber.parent.fiber);
    return "root";
  }
  /**
  * Throw if the fiber has already been disposed.
  *
  * @returns nothing when the fiber is still active.
  * @throws {CordisError} `INACTIVE_EFFECT` when the fiber's uid has been cleared.
  */
  assertActive() {
    if (this.uid !== null) return;
    throw new CordisError("INACTIVE_EFFECT");
  }
  _execute(runner) {
    const oldEpoch = runner.epoch;
    return composeError((info) => {
      const safeCollect = (dispose) => {
        if (typeof dispose === "function") runner.collect(dispose);
        else if (!isNullable(dispose)) throw new TypeError("Invalid effect");
      };
      const effect = runner.execute.call(this);
      if (typeof effect === "function") return runner.collect(effect);
      else if (isNullable(effect)) {
      } else if (!isObject(effect)) throw new TypeError("Invalid effect");
      else if ("then" in effect) return effect.then(safeCollect);
      else if (Symbol.iterator in effect) {
        info.error = /* @__PURE__ */ new Error();
        const iter = effect[Symbol.iterator]();
        while (true) {
          const result = iter.next();
          safeCollect(result.value);
          if (result.done) return;
        }
      } else if (Symbol.asyncIterator in effect) {
        const iter = effect[Symbol.asyncIterator]();
        return (async () => {
          await Promise.resolve();
          info.error = /* @__PURE__ */ new Error();
          while (true) {
            if (runner.epoch !== oldEpoch) return;
            const result = await iter.next();
            safeCollect(result.value);
            if (result.done) return;
          }
        })();
      } else throw new TypeError("Invalid effect");
    }, runner.getOuterStack);
  }
  effect(execute, label = "anonymous") {
    this.assertActive();
    if (this.state === 5) throw new CordisError("INACTIVE_EFFECT");
    const disposables = [];
    let disposing = false;
    let disposalTask;
    const dispose = () => {
      if (disposing) return disposalTask;
      disposing = true;
      let task2;
      for (const disposable of disposables.splice(0).reverse()) if (task2) task2 = task2.then(() => runDisposable(disposable));
      else {
        const result = runDisposable(disposable);
        if (isObject(result) && "then" in result) task2 = result;
      }
      return disposalTask = task2;
    };
    const meta = {
      label,
      children: []
    };
    const runner = {
      execute,
      epoch: true,
      collect: (dispose2) => {
        disposables.push(dispose2);
        this._disposables.delete(dispose2);
        if (dispose2[symbols.effect]) meta.children.push(dispose2[symbols.effect]);
      },
      getOuterStack: buildOuterStack()
    };
    let task;
    let executing = true;
    let resolveSetup;
    let rejectSetup;
    let setupBarrier;
    let setupFailed = false;
    let inFlight;
    let removeWrapper = () => false;
    const waitForSetup = () => {
      setupBarrier ??= new Promise((resolve6, reject) => {
        resolveSetup = resolve6;
        rejectSetup = reject;
      });
      return setupBarrier;
    };
    const disposeAfter = (setup) => {
      return Promise.resolve(setup).then(() => dispose(), async (reason) => {
        await dispose();
        throw reason;
      });
    };
    const finalizeDisposal = (callback) => {
      let result;
      try {
        result = callback();
      } catch (error) {
        removeWrapper();
        throw error;
      }
      if (isObject(result) && "then" in result) {
        const pending = Promise.resolve(result).finally(() => {
          removeWrapper();
          if (inFlight === pending) inFlight = void 0;
        });
        return inFlight = pending;
      }
      removeWrapper();
      return result;
    };
    const wrapper = defineProperty(() => {
      if (!runner.epoch) return setupFailed ? inFlight : void 0;
      runner.epoch = false;
      return finalizeDisposal(() => {
        if (executing) return disposeAfter(waitForSetup());
        return task ? disposeAfter(task) : dispose();
      });
    }, symbols.effect, meta);
    effectInertia.set(wrapper, () => inFlight);
    removeWrapper = this._disposables.push(wrapper);
    try {
      task = this._execute(runner);
    } catch (reason) {
      executing = false;
      setupFailed = true;
      runner.epoch = false;
      let cleanup;
      try {
        cleanup = finalizeDisposal(dispose);
      } finally {
        rejectSetup?.(reason);
      }
      if (isObject(cleanup) && "then" in cleanup) cleanup.catch((error) => this.ctx.logger.error(error));
      throw reason;
    }
    executing = false;
    if (setupBarrier) Promise.resolve(task).then(resolveSetup, rejectSetup);
    task?.catch(() => {
      if (!runner.epoch) return dispose();
      return finalizeDisposal(dispose);
    }).catch((error) => this.ctx.logger.error(error));
    const disposeAsync = () => {
      if (!runner.epoch) return;
      runner.epoch = false;
      return finalizeDisposal(dispose);
    };
    wrapper.then = async (onFulfilled, onRejected) => {
      return Promise.resolve(task).then(() => disposeAsync).then(onFulfilled, onRejected);
    };
    return wrapper;
  }
  /**
  * Return metadata for currently registered effects.
  *
  * @returns one {@link EffectMeta} tree per labeled live effect.
  */
  getEffects() {
    return [...this._disposables].map((dispose) => dispose[symbols.effect]).filter(Boolean);
  }
  _getState() {
    if (this.uid === null) return 4;
    if (this._error) return 3;
    if (this._runner.epoch !== INACTIVE) return 2;
    return 0;
  }
  _updateState(callback) {
    const oldState = this.state;
    this.state = callback() ?? this._getState();
    if (oldState === this.state) return;
    this.context.emit("internal/status", this, oldState);
    if (oldState !== 2 && this.state !== 2) return;
    for (const key of Reflect.ownKeys(this.ctx.reflect.store)) {
      const impl = this.ctx.reflect.store[key];
      if (impl.fiber !== this) continue;
      this.ctx.reflect.notify([impl.name]);
    }
  }
  _checkImpl(name2) {
    const impl = this.ctx.reflect._getImpl(name2, true);
    if (!impl) return delete this._store[name2];
    try {
      if (impl.check && !impl.check.call(getTraceable(this.ctx, impl.value))) return delete this._store[name2];
    } catch (error) {
      impl.fiber.ctx.logger.error(error);
      return delete this._store[name2];
    }
    this._store[name2] = impl;
  }
  _refresh() {
    let epoch = false;
    epoch = "";
    for (const name2 of Object.keys(this.inject)) {
      const impl = this._store[name2];
      if (!impl) {
        epoch = INACTIVE;
        break;
      }
      epoch += ":" + impl.fiber.uid;
    }
    this._setEpoch(epoch);
  }
  _setEpoch(epoch) {
    const oldEpoch = this._runner.epoch;
    if (epoch === oldEpoch) return;
    this._runner.epoch = epoch;
    if (this.inertia) return;
    this._updateState(() => {
      if (epoch !== INACTIVE && oldEpoch === INACTIVE) {
        this.inertia = this._reload();
        return 1;
      } else {
        this.inertia = this._unload();
        return 5;
      }
    });
  }
  _resolveConfig(config) {
    config = this.context.waterfall(this, "internal/config", config, () => config);
    return this.runtime ? resolveConfig(this.runtime, config) : config;
  }
  async _reload() {
    this.store = { ...this._store };
    const oldEpoch = this._runner.epoch;
    try {
      await Promise.resolve();
      if (this._runner.epoch === oldEpoch) {
        this.config = this._resolveConfig(this._config);
        await this._execute(this._runner);
        this._error = void 0;
      }
    } catch (reason) {
      this.ctx.logger.error(reason);
      this._error = reason;
      this._runner.epoch = INACTIVE;
    }
    this._updateState(() => {
      if (this._runner.epoch === oldEpoch) this.inertia = void 0;
      else {
        this.inertia = this._unload();
        return 5;
      }
    });
  }
  async _unload() {
    await Promise.all(this._disposables.clear().map(async (dispose) => {
      try {
        await composeError(async (info) => {
          await Promise.resolve();
          info.error = /* @__PURE__ */ new Error();
          await runDisposable(dispose);
        }, this._runner.getOuterStack);
      } catch (reason) {
        this.ctx.logger.error(reason);
      }
    }));
    this.store = void 0;
    this._updateState(() => {
      if (this._runner.epoch === INACTIVE) this.inertia = void 0;
      else {
        this.inertia = this._reload();
        return 1;
      }
    });
  }
  /**
  * Wait for current lifecycle work and rethrow startup errors.
  *
  * @returns this fiber, once it has settled into a stable state.
  * @throws the config-validation or plugin-startup error, if any.
  */
  async await() {
    while (this.inertia) await this.inertia;
    if (this._error) throw this._error;
    return this;
  }
  /**
  * Dispose and immediately reload this plugin with its current config.
  *
  * @returns a promise resolving once the reload settled.
  * @throws {CordisError} `INACTIVE_EFFECT` when the fiber is already disposed.
  */
  async restart() {
    this.assertActive();
    this._setEpoch(INACTIVE);
    this._refresh();
    await this.await();
  }
  /**
  * Validate and apply new config, then restart the plugin.
  *
  * Runs the `internal/update` waterfall first, so update hooks (and HMR)
  * can veto or replace the restart.
  *
  * @param config — the new raw config; validated before anything restarts.
  * @param noSave — hint for persistence hooks not to write the change back.
  * @returns the update waterfall result; the default restart returns a promise.
  * @throws when validation, an update listener, or the restarted plugin fails.
  */
  update(config, noSave = false) {
    this.assertActive();
    this._config = config;
    if (this.state !== 2) {
      this._error = void 0;
      this._setEpoch(INACTIVE);
      this._refresh();
      return;
    }
    config = this._resolveConfig(config);
    return this.context.waterfall(this, "internal/update", config, noSave, () => {
      this.config = config;
      this._error = void 0;
      return this.restart();
    });
  }
};
function isApplicable(object2) {
  return object2 && typeof object2 === "object" && typeof object2.apply === "function";
}
function Inject(name2, config) {
  return function(value, decorator) {
    if (decorator.kind === "class") {
      if (!Object.hasOwn(value, "inject")) {
        defineProperty(value, "inject", Object.create(Object.getPrototypeOf(value).inject ?? null));
        defineProperty(value.inject, symbols.checkProto, true);
      }
      value.inject[name2] = config;
    } else if (decorator.kind === "method") {
      const inject2 = (value[symbols.metadata] ??= {}).inject ??= /* @__PURE__ */ Object.create(null);
      inject2[name2] = config;
      decorator.addInitializer(function() {
        const property2 = this[symbols.tracker]?.property;
        (this[symbols.initHooks] ??= []).push(() => {
          this.ctx.inject(inject2, (ctx) => {
            return value.call(property2 ? withProps(this, { [property2]: ctx }) : this);
          });
        });
      });
    } else throw new Error("@Inject() can only be used on class or class methods");
  };
}
(function(Inject2) {
  function resolve6(inject2, result = /* @__PURE__ */ Object.create(null)) {
    if (!inject2) return result;
    if (Array.isArray(inject2)) for (const name2 of inject2) result[name2] = null;
    else if (Reflect.has(inject2, symbols.checkProto)) {
      Object.assign(result, resolve6(Object.getPrototypeOf(inject2)));
      for (const name2 of Object.keys(inject2)) result[name2] = inject2[name2] ?? null;
    } else for (const name2 of Object.keys(inject2)) result[name2] = inject2[name2] ?? null;
    return result;
  }
  Inject2.resolve = resolve6;
})(Inject || (Inject = {}));
var RegistryService = class {
  ctx;
  _counter = 0;
  _internal = /* @__PURE__ */ new Map();
  constructor(ctx) {
    this.ctx = ctx;
    defineProperty(this, symbols.tracker, {
      property: "ctx",
      noShadow: true
    });
  }
  /** Allocate the next fiber uid (increments on every read). */
  get counter() {
    return ++this._counter;
  }
  /** Number of registered plugin runtimes. */
  get size() {
    return this._internal.size;
  }
  /**
  * Resolve a supported plugin shape to its executable callback.
  *
  * @param plugin — a function, class, or `{ apply }` object plugin.
  * @returns the callback identifying the plugin, or `undefined` if invalid.
  */
  resolve(plugin) {
    try {
      if (typeof plugin === "function") return plugin;
      if (isApplicable(plugin)) return plugin.apply;
    } catch {
    }
  }
  /**
  * Look up the runtime record for a plugin.
  *
  * @param plugin — any supported plugin shape.
  * @returns the runtime, or `undefined` when the plugin is not registered.
  */
  get(plugin) {
    const key = this.resolve(plugin);
    return key && this._internal.get(key);
  }
  /**
  * Check whether a plugin has a registered runtime.
  *
  * @param plugin — any supported plugin shape.
  * @returns `true` when at least one fiber of the plugin exists.
  */
  has(plugin) {
    const key = this.resolve(plugin);
    return !!key && this._internal.has(key);
  }
  /**
  * Dispose every running fiber for a plugin and remove its runtime record.
  *
  * @param plugin — any supported plugin shape.
  * @returns the removed runtime, or `undefined` when none was registered.
  */
  delete(plugin) {
    const key = this.resolve(plugin);
    const runtime = key && this._internal.get(key);
    if (!runtime) return;
    this._internal.delete(key);
    for (const fiber of runtime.fibers) fiber.dispose();
    return runtime;
  }
  /** Iterate the registered plugin callbacks. */
  keys() {
    return this._internal.keys();
  }
  /** Iterate the registered plugin runtimes. */
  values() {
    return this._internal.values();
  }
  /** Iterate `[callback, runtime]` pairs. */
  entries() {
    return this._internal.entries();
  }
  /**
  * Visit every registered runtime.
  *
  * @param callback — receives each runtime and its identifying callback.
  */
  forEach(callback) {
    return this._internal.forEach(callback);
  }
  /**
  * Start a callback once the requested dependencies are available.
  *
  * @param inject — required services, as an array or a name → config map.
  * @param callback — plugin body called with `(ctx, config)`.
  * @returns the fiber; awaiting it settles once loading finished.
  */
  inject(inject2, callback) {
    return this.plugin({
      inject: inject2,
      apply: callback,
      name: callback.name
    });
  }
  /**
  * Start a plugin in the current context and return its fiber.
  *
  * Creates (or reuses) the plugin's runtime record, then starts a new fiber
  * under the current context. Throws if `plugin` is not a supported shape or
  * if the current fiber is already disposed.
  *
  * @param plugin — a function, class, or `{ apply }` object plugin.
  * @param config — the plugin config, validated against its `Config` schema.
  * @param getOuterStack — captures the caller stack for effect diagnostics.
  * @returns the fiber; awaiting it settles once loading finished.
  */
  plugin(plugin, config, getOuterStack = buildOuterStack()) {
    const callback = this.resolve(plugin);
    if (!callback) throw new Error('invalid plugin, expect function or object with an "apply" method, received ' + typeof plugin);
    this.ctx.fiber.assertActive();
    let runtime = this._internal.get(callback);
    if (!runtime) {
      let name2 = plugin.name;
      if (name2 === "apply") name2 = void 0;
      runtime = {
        name: name2,
        callback,
        fibers: new DisposableList(),
        Config: plugin.Config
      };
      this._internal.set(callback, runtime);
    }
    const fiber = new Fiber(this.ctx, config, Inject.resolve(plugin.inject), runtime, getOuterStack);
    const wrapped = Object.create(fiber);
    wrapped.then = (onFulfilled, onRejected) => {
      return fiber.await().then(onFulfilled, onRejected);
    };
    return wrapped;
  }
};
var Context = class Context2 {
  /** Symbol key under which a disposer exposes its {@link EffectMeta} diagnostics tree. */
  static effect = symbols.effect;
  /** Symbol key for a context's listener filter, consulted on every event dispatch. */
  static filter = symbols.filter;
  /** Symbol key of the isolation map (see the `Context[symbols.isolate]` property). */
  static isolate = symbols.isolate;
  /** Symbol key of the intercept map (see the `Context[symbols.intercept]` property). */
  static intercept = symbols.intercept;
  /**
  * Returns true for Cordis context proxies and context prototypes.
  *
  * Works across realms and across multiple copies of cordis, because the
  * brand is keyed by a global symbol rather than by `instanceof`.
  *
  * @param value — the value to test.
  * @returns `true` if `value` is a Cordis context, narrowing its type.
  */
  static is(value) {
    return !!value?.[Context2.is];
  }
  static {
    Context2.is[Symbol.toPrimitive] = () => /* @__PURE__ */ Symbol.for("cordis.is");
    Context2.prototype[Context2.is] = true;
  }
  /** Create the root context and install the built-in services. */
  constructor() {
    this[symbols.isolate] = /* @__PURE__ */ Object.create(null);
    this[symbols.intercept] = /* @__PURE__ */ Object.create(null);
    const self = new Proxy(this, ReflectService.handler);
    this.root = self;
    this.baseUrl = void 0;
    this.fiber = new Fiber(self, {}, /* @__PURE__ */ Object.create(null), null, () => []);
    this.reflect = new ReflectService(self);
    this.registry = new RegistryService(self);
    this.events = new EventsService(self);
    this.logger = new LoggerService(self);
    this.fiber._disposables.clear();
    return self;
  }
  [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")]() {
    return `Context <${this.fiber.name}>`;
  }
  /**
  * Create a child context with extra metadata on top of the current scope.
  *
  * The child prototypally inherits every property of this context; own
  * properties of `meta` shadow the inherited ones. The parent is not mutated.
  *
  * @param meta — own properties (including symbol keys) to define on the child.
  * @returns a child context inheriting from this one.
  */
  extend(meta = {}) {
    const shadow = Reflect.getOwnPropertyDescriptor(this, symbols.shadow)?.value;
    const self = Object.create(getTraceable(this, this));
    for (const prop of Reflect.ownKeys(meta)) Object.defineProperty(self, prop, Reflect.getOwnPropertyDescriptor(meta, prop));
    if (!shadow) return self;
    return Object.assign(Object.create(self), { [symbols.shadow]: shadow });
  }
  /**
  * Create a child context with an independent service scope for `name`.
  *
  * Below the returned context, reads and writes of the service `name`
  * resolve against the new label instead of the parent's, so a different
  * implementation can be provided without affecting the parent scope.
  * Passing the same `label` to two `isolate()` calls joins their scopes.
  *
  * @param name — the service name to isolate.
  * @param label — scope label to join; defaults to a fresh unique symbol.
  * @returns a child context whose `name` service resolves in the new scope.
  */
  isolate(name2, label) {
    const shadow = Object.create(this[symbols.isolate]);
    shadow[name2] = label ?? Symbol(name2);
    return this.extend({ [symbols.isolate]: shadow });
  }
  intercept(name2, config) {
    const intercept = Object.create(this[symbols.intercept]);
    intercept[name2] = config;
    return this.extend({ [symbols.intercept]: intercept });
  }
};
var Service = class Service2 {
  ctx;
  /** Symbol key of an instance method run after construction (class plugins). */
  static init = symbols.init;
  /** Symbol key of the availability predicate passed to `ctx.provide()`. */
  static check = symbols.check;
  /** Symbol key of the phantom intercept-config type parameter. */
  static config = symbols.config;
  /** Symbol key of the call body making a service callable (e.g. `ctx.logger()`). */
  static invoke = symbols.invoke;
  /** Symbol key of the helper deriving an extended service instance. */
  static extend = symbols.extend;
  /** Symbol key of the tracker metadata used for context tracing. */
  static tracker = symbols.tracker;
  /** Symbol key of the intercept-config resolution helper below. */
  static resolveConfig = symbols.resolveConfig;
  /** The service name this instance is registered under. */
  name;
  /**
  * Register this instance as `name` in the current context.
  *
  * Calls `ctx.reflect.provide(name, this, this[Service.check])`, so the
  * service is unregistered automatically when the owning fiber unloads.
  * Services with a `[Service.invoke]` body return a callable instance.
  *
  * @param ctx — the context to register in (stored as `this.ctx`).
  * @param name — the service name; defaults to the static `provide` field.
  */
  constructor(ctx, name2) {
    this.ctx = ctx;
    name2 ??= this.constructor["provide"];
    let self = this;
    const tracker = {
      associate: name2,
      property: "ctx"
    };
    if (self[symbols.invoke]) self = createCallable(name2, joinPrototype(Object.getPrototypeOf(this), Function.prototype), tracker);
    self.ctx = ctx;
    self.name = name2;
    defineProperty(self, symbols.tracker, tracker);
    self.ctx.reflect.provide(name2, self, this[symbols.check]);
    return self;
  }
  [symbols.filter](ctx) {
    return ctx[symbols.isolate][this.name] === this.ctx[symbols.isolate][this.name];
  }
  [symbols.extend](props) {
    let self;
    if (this[Service2.invoke]) self = createCallable(this.name, this, this[symbols.tracker]);
    else self = Object.create(this);
    return Object.assign(self, props);
  }
  /**
  * Merge intercept config from ancestors with optional base and head values.
  *
  * Entries added closer to the root apply first; `base` is prepended and
  * `head` appended. Uses `Config.merge` when the service declares one,
  * otherwise a shallow `Object.assign`.
  *
  * @param base — lowest-precedence config merged before all intercepts.
  * @param head — highest-precedence config merged after all intercepts.
  * @returns the merged config.
  */
  [symbols.resolveConfig](base, head) {
    let intercept = this.ctx[Context.intercept];
    const configs = [];
    while (this.name in intercept) {
      if (Object.hasOwn(intercept, this.name)) configs.unshift(intercept[this.name]);
      intercept = Object.getPrototypeOf(intercept);
    }
    if (base) configs.unshift(base);
    if (head) configs.push(head);
    if (this["Config"]?.merge) return this["Config"].merge(...configs);
    else return Object.assign({}, ...configs);
  }
  static [Symbol.hasInstance](instance) {
    if (!instance) return false;
    let constructor = instance.constructor;
    while (constructor) {
      constructor = constructor.prototype?.constructor;
      if (constructor === this) return true;
      constructor &&= Object.getPrototypeOf(constructor);
    }
    return false;
  }
};

// node_modules/@deepseek-ai/schemastery/lib/index.mjs
var kSchema = /* @__PURE__ */ Symbol.for("schemastery");
var kValidationError2 = /* @__PURE__ */ Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError2 = class extends TypeError {
  options;
  name = "ValidationError";
  constructor(message, options) {
    let prefix = "$";
    for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
    else if (typeof segment === "number") prefix += "[" + segment + "]";
    else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
    if (prefix.startsWith(".")) prefix = prefix.slice(1);
    super((prefix === "$" ? "" : `${prefix} `) + message);
    this.options = options;
  }
  static is(error) {
    return !!error?.[kValidationError2];
  }
};
Object.defineProperty(ValidationError2.prototype, kValidationError2, { value: true });
var Schema = function(options) {
  const schema = function(data, options2 = {}) {
    return Schema.resolve(data, schema, options2)[0];
  };
  if (options.refs) {
    const refs = mapValues(options.refs, (options2) => new Schema(options2));
    const getRef = (uid) => refs[uid];
    for (const key in refs) {
      const options2 = refs[key];
      options2.sKey = getRef(options2.sKey);
      options2.inner = getRef(options2.inner);
      options2.list = options2.list && options2.list.map(getRef);
      options2.dict = options2.dict && mapValues(options2.dict, getRef);
    }
    return refs[options.uid];
  }
  Object.assign(schema, options);
  if (typeof schema.callback === "string") try {
    schema.callback = new Function("return " + schema.callback)();
  } catch {
  }
  Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
  Object.setPrototypeOf(schema, Schema.prototype);
  schema.meta ||= {};
  schema.toString = schema.toString.bind(schema);
  return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
  return {
    version: 1,
    vendor: "schemastery",
    validate: (value) => {
      try {
        return { value: Schema.resolve(value, this, {})[0] };
      } catch (error) {
        if (ValidationError2.is(error)) return { issues: [{
          message: error.message,
          path: error.options.path
        }] };
        throw error;
      }
    }
  };
} });
Schema.ValidationError = ValidationError2;
Schema.prototype.toJSON = function toJSON() {
  if (globalThis.__schemastery_refs__) {
    globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
    return this.uid;
  }
  globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
  globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
  const result = {
    uid: this.uid,
    refs: globalThis.__schemastery_refs__
  };
  globalThis.__schemastery_refs__ = void 0;
  return result;
};
Schema.prototype.set = function set(key, value) {
  this.dict[key] = value;
  return this;
};
Schema.prototype.push = function push(value) {
  this.list.push(value);
  return this;
};
function mergeDesc(original, messages) {
  const result = typeof original === "string" ? { "": original } : { ...original };
  for (const locale in messages) {
    const value = messages[locale];
    if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
    else if (typeof value === "string") result[locale] = value;
  }
  return result;
}
function getInner(value) {
  return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
  return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
  const schema = Schema(this);
  const desc = mergeDesc(schema.meta.description, messages);
  if (Object.keys(desc).length) schema.meta.description = desc;
  if (schema.dict) schema.dict = mapValues(schema.dict, (inner2, key) => {
    return inner2.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
  });
  if (schema.list) schema.list = schema.list.map((inner2, index) => {
    return inner2.i18n(mapValues(messages, (data = {}) => {
      if (Array.isArray(getInner(data))) return getInner(data)[index];
      if (Array.isArray(data)) return data[index];
      return extractKeys(data);
    }));
  });
  if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
    if (getInner(data)) return getInner(data);
    return extractKeys(data);
  }));
  if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
  return schema;
};
Schema.prototype.extra = function extra(key, value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
};
for (const key of [
  "required",
  "disabled",
  "collapse",
  "hidden",
  "loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
Schema.prototype.deprecated = function deprecated() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "deprecated",
    type: "danger"
  });
  return schema;
};
Schema.prototype.experimental = function experimental() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "experimental",
    type: "warning"
  });
  return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
  const schema = Schema(this);
  const pattern2 = pick(regexp, ["source", "flags"]);
  schema.meta = {
    ...schema.meta,
    pattern: pattern2
  };
  return schema;
};
Schema.prototype.simplify = function simplify(value) {
  if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
  if (isNullable(value)) return value;
  if (this.type === "object" || this.type === "dict") {
    const result = {};
    for (const key in value) {
      const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
      if (this.type === "dict" || !isNullable(item)) result[key] = item;
    }
    if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
    return result;
  } else if (this.type === "array" || this.type === "tuple") {
    const result = [];
    value.forEach((value2, index) => {
      const schema = this.type === "array" ? this.inner : this.list[index];
      const item = schema ? schema.simplify(value2) : value2;
      result.push(item);
    });
    return result;
  } else if (this.type === "intersect") {
    const result = {};
    for (const item of this.list) Object.assign(result, item.simplify(value));
    return result;
  } else if (this.type === "union") for (const schema of this.list) try {
    Schema.resolve(value, schema, {});
    return schema.simplify(value);
  } catch {
  }
  return value;
};
Schema.prototype.toString = function toString(inline) {
  return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra2) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    role,
    extra: extra2
  };
  return schema;
};
for (const key of [
  "default",
  "link",
  "comment",
  "description",
  "max",
  "min",
  "step"
]) Object.assign(Schema.prototype, { [key](value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
var resolvers = {};
Schema.extend = function extend(type, resolve6) {
  resolvers[type] = resolve6;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
  if (!schema) return [data];
  if (options.ignore?.(data, schema)) return [data];
  if (isNullable(data) && schema.type !== "lazy") {
    if (schema.meta.required) throw new ValidationError2(`missing required value`, options);
    let current = schema;
    let fallback = schema.meta.default;
    while (current?.type === "intersect" && isNullable(fallback)) {
      current = current.list[0];
      fallback = current?.meta.default;
    }
    if (isNullable(fallback)) return [data];
    data = clone(fallback);
  }
  const callback = resolvers[schema.type];
  if (!callback) throw new ValidationError2(`unsupported type "${schema.type}"`, options);
  try {
    return callback(data, schema, options, strict);
  } catch (error) {
    if (!schema.meta.loose) throw error;
    return [schema.meta.default];
  }
};
Schema.from = function from(source) {
  if (isNullable(source)) return Schema.any();
  else if ([
    "string",
    "number",
    "boolean"
  ].includes(typeof source)) return Schema.const(source).required();
  else if (source[kSchema]) return source;
  else if (typeof source === "function") switch (source) {
    case String:
      return Schema.string().required();
    case Number:
      return Schema.number().required();
    case Boolean:
      return Schema.boolean().required();
    case Function:
      return Schema.function().required();
    default:
      return Schema.is(source).required();
  }
  else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
  const toJSON2 = () => {
    if (!schema.inner[kSchema]) {
      schema.inner = schema.builder();
      schema.inner.meta = {
        ...schema.meta,
        ...schema.inner.meta
      };
    }
    return schema.inner.toJSON();
  };
  const schema = new Schema({
    type: "lazy",
    builder,
    inner: { toJSON: toJSON2 }
  });
  return schema;
};
Schema.natural = function natural() {
  return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
  return Schema.number().step(0.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
  return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
    const date2 = new Date(value);
    if (isNaN(+date2)) throw new ValidationError2(`invalid date "${value}"`, options);
    return date2;
  }, true)]);
};
Schema.regExp = function regExp(flag = "") {
  return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
    try {
      return new RegExp(value, flag);
    } catch (e) {
      throw new ValidationError2(e.message, options);
    }
  }, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
  return Schema.union([
    Schema.is(ArrayBuffer),
    Schema.is(SharedArrayBuffer),
    Schema.transform(Schema.any(), (value, options) => {
      if (Binary.isSource(value)) return Binary.fromSource(value);
      throw new ValidationError2(`expected ArrayBufferSource but got ${value}`, options);
    }, true),
    ...encoding ? [Schema.transform(Schema.string(), (value, options) => {
      try {
        return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
      } catch (e) {
        throw new ValidationError2(e.message, options);
      }
    }, true)] : []
  ]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
  if (!schema.inner[kSchema]) {
    schema.inner = schema.builder();
    schema.inner.meta = {
      ...schema.meta,
      ...schema.inner.meta
    };
  }
  return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
  return [data];
});
Schema.extend("never", (data, _2, options) => {
  throw new ValidationError2(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
  if (deepEqual(data, value)) return [value];
  throw new ValidationError2(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
  const { max = Infinity, min = -Infinity } = meta;
  if (data > max) throw new ValidationError2(`expected ${description} <= ${max} but got ${data}`, options);
  if (data < min && !skipMin) throw new ValidationError2(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
  if (typeof data !== "string") throw new ValidationError2(`expected string but got ${data}`, options);
  if (meta.pattern) {
    const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
    if (!regexp.test(data)) throw new ValidationError2(`expect string to match regexp ${regexp}`, options);
  }
  checkWithinRange(data.length, meta, "string length", options);
  return [data];
});
function decimalShift(data, digits) {
  const str = data.toString();
  if (str.includes("e")) return data * Math.pow(10, digits);
  const index = str.indexOf(".");
  if (index === -1) return data * Math.pow(10, digits);
  const frac = str.slice(index + 1);
  const integer = str.slice(0, index);
  if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
  return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
  step = Math.abs(step);
  if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
  const index = step.toString().indexOf(".");
  const digits = step.toString().slice(index + 1).length;
  return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
  if (typeof data !== "number") throw new ValidationError2(`expected number but got ${data}`, options);
  checkWithinRange(data, meta, "number", options);
  const { step } = meta;
  if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError2(`expected number multiple of ${step} but got ${data}`, options);
  return [data];
});
Schema.extend("boolean", (data, _2, options) => {
  if (typeof data === "boolean") return [data];
  throw new ValidationError2(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
  let value = 0, keys = [];
  if (typeof data === "number") {
    value = data;
    for (const key in bits) if (data & bits[key]) keys.push(key);
  } else if (Array.isArray(data)) {
    keys = data;
    for (const key of keys) {
      if (typeof key !== "string") throw new ValidationError2(`expected string but got ${key}`, options);
      if (key in bits) value |= bits[key];
    }
  } else throw new ValidationError2(`expected number or array but got ${data}`, options);
  if (value === meta.default) return [value];
  return [value, keys];
});
Schema.extend("function", (data, _2, options) => {
  if (typeof data === "function") return [data];
  throw new ValidationError2(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
  if (typeof constructor === "function") {
    if (data instanceof constructor) return [data];
    throw new ValidationError2(`expected ${constructor.name} but got ${data}`, options);
  } else {
    if (isNullable(data)) throw new ValidationError2(`expected ${constructor} but got ${data}`, options);
    let prototype = Object.getPrototypeOf(data);
    while (prototype) {
      if (prototype.constructor?.name === constructor) return [data];
      prototype = Object.getPrototypeOf(prototype);
    }
    throw new ValidationError2(`expected ${constructor} but got ${data}`, options);
  }
});
function property(data, key, schema, options) {
  try {
    const [value, adapted] = Schema.resolve(data[key], schema, {
      ...options,
      path: [...options.path || [], key]
    });
    if (adapted !== void 0) data[key] = adapted;
    return value;
  } catch (e) {
    if (!options?.autofix) throw e;
    delete data[key];
    return schema.meta.default;
  }
}
Schema.extend("array", (data, { inner: inner2, meta }, options) => {
  if (!Array.isArray(data)) throw new ValidationError2(`expected array but got ${data}`, options);
  checkWithinRange(data.length, meta, "array length", options, !isNullable(inner2.meta.default));
  return [data.map((_2, index) => property(data, index, inner2, options))];
});
Schema.extend("dict", (data, { inner: inner2, sKey }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError2(`expected object but got ${data}`, options);
  const result = {};
  for (const key in data) {
    let rKey;
    try {
      rKey = Schema.resolve(key, sKey, options)[0];
    } catch (error) {
      if (strict) continue;
      throw error;
    }
    result[rKey] = property(data, key, inner2, options);
    data[rKey] = data[key];
    if (key !== rKey) delete data[key];
  }
  return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
  if (!Array.isArray(data)) throw new ValidationError2(`expected array but got ${data}`, options);
  const result = list.map((inner2, index) => property(data, index, inner2, options));
  if (strict) return [result];
  result.push(...data.slice(list.length));
  return [result];
});
function merge(result, data) {
  for (const key in data) {
    if (key in result) continue;
    result[key] = data[key];
  }
}
Schema.extend("object", (data, { dict }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError2(`expected object but got ${data}`, options);
  const result = {};
  for (const key in dict) {
    const value = property(data, key, dict[key], options);
    if (!isNullable(value) || key in data) result[key] = value;
  }
  if (!strict) merge(result, data);
  return [result];
});
Schema.extend("union", (data, { list, toString: toString2 }, options, strict) => {
  const messages = [];
  for (const inner2 of list) try {
    return Schema.resolve(data, inner2, options, strict);
  } catch (error) {
    messages.push(error);
  }
  throw new ValidationError2(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString: toString2 }, options, strict) => {
  if (!list.length) return [data];
  let result;
  for (const inner2 of list) {
    const value = Schema.resolve(data, inner2, options, true)[0];
    if (isNullable(value)) continue;
    if (isNullable(result)) result = value;
    else if (typeof result !== typeof value) throw new ValidationError2(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
    else if (typeof value === "object") merge(result ??= {}, value);
    else if (result !== value) throw new ValidationError2(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
  }
  if (!strict && isPlainObject(data)) merge(result, data);
  return [result];
});
Schema.extend("transform", (data, { inner: inner2, callback, preserve }, options) => {
  const [result, adapted = data] = Schema.resolve(data, inner2, options, true);
  if (preserve) return [callback(result)];
  else return [callback(result), callback(adapted)];
});
var formatters = {};
function defineMethod(name2, keys, format2) {
  formatters[name2] = format2;
  Object.assign(Schema, { [name2](...args) {
    const schema = new Schema({ type: name2 });
    keys.forEach((key, index) => {
      switch (key) {
        case "sKey":
          schema.sKey = args[index] ?? Schema.string();
          break;
        case "inner":
          schema.inner = Schema.from(args[index]);
          break;
        case "list":
          schema.list = args[index].map(Schema.from);
          break;
        case "dict":
          schema.dict = mapValues(args[index], Schema.from);
          break;
        case "bits":
          schema.bits = {};
          for (const key2 in args[index]) {
            if (typeof args[index][key2] !== "number") continue;
            schema.bits[key2] = args[index][key2];
          }
          break;
        case "callback": {
          const callback = schema.callback = args[index];
          callback["toJSON"] ||= () => callback.toString();
          break;
        }
        case "constructor": {
          const constructor = schema.constructor = args[index];
          if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
          break;
        }
        default:
          schema[key] = args[index];
      }
    });
    if (name2 === "object" || name2 === "dict") schema.meta.default = {};
    else if (name2 === "array" || name2 === "tuple") schema.meta.default = [];
    else if (name2 === "bitset") schema.meta.default = 0;
    return schema;
  } });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
  if (typeof constructor === "function") return constructor.name;
  else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner: inner2 }) => `${inner2.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner: inner2, sKey }) => `{ [key: ${sKey.toString()}]: ${inner2.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner2) => inner2.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
  if (Object.keys(dict).length === 0) return "{}";
  return `{ ${Object.entries(dict).map(([key, inner2]) => {
    return `${key}${inner2.meta.required ? "" : "?"}: ${inner2.toString()}`;
  }).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
  const result = list.map(({ toString: format2 }) => format2()).join(" | ");
  return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
  return `${list.map((inner2) => inner2.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
  "inner",
  "callback",
  "preserve"
], ({ inner: inner2 }, isInner) => inner2.toString(isInner));

// node_modules/@deepseek-ai/dsh-scope/lib/index.js
var NamedEntries = class {
  duplicateError;
  data = /* @__PURE__ */ new Map();
  constructor(duplicateError) {
    this.duplicateError = duplicateError;
  }
  /**
  * Insert one unique name.
  * @param name - name unique within this table.
  * @param value - borrowed value to retain.
  * @returns an idempotent undo that removes only this insertion.
  */
  insert(name2, value) {
    const data = this.data;
    if (data.has(name2)) throw this.duplicateError(name2);
    data.set(name2, value);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      data.delete(name2);
      if (data.size === 0 && this.data === data) this.data = /* @__PURE__ */ new Map();
    };
  }
  /**
  * Read one named value.
  * @param name - name to resolve.
  * @returns the retained value, or `undefined` when absent.
  */
  get(name2) {
    return this.data.get(name2);
  }
  /**
  * Test one name for membership.
  * @param name - name to test.
  * @returns whether the table contains that name.
  */
  has(name2) {
    return this.data.has(name2);
  }
  /**
  * Iterate live names in insertion order.
  * @returns the native live key iterator.
  */
  keys() {
    return this.data.keys();
  }
  /**
  * Iterate live entries in insertion order.
  * @returns the native live entry iterator.
  */
  entries() {
    return this.data.entries();
  }
  /**
  * Iterate live values in insertion order.
  * @returns the native live value iterator.
  */
  values() {
    return this.data.values();
  }
  /**
  * Test whether this table has no entries.
  * @returns whether the table is empty.
  */
  isEmpty() {
    return this.data.size === 0;
  }
};
var AnonymousEntries = class {
  data = /* @__PURE__ */ new Map();
  /**
  * Append one independently owned value.
  * @param value - borrowed value to retain.
  * @returns an idempotent undo for this exact append.
  */
  append(value) {
    const data = this.data;
    const key = /* @__PURE__ */ Symbol();
    data.set(key, value);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      data.delete(key);
      if (data.size === 0 && this.data === data) this.data = /* @__PURE__ */ new Map();
    };
  }
  /**
  * Iterate live values in insertion order.
  * @returns the native live value iterator.
  */
  values() {
    return this.data.values();
  }
  /**
  * Test whether this table has no entries.
  * @returns whether the table is empty.
  */
  isEmpty() {
    return this.data.size === 0;
  }
};
var ScopedLayers = class {
  createLayer;
  onChange;
  /** The eagerly constructed context-global layer. */
  global;
  scoped = /* @__PURE__ */ new Map();
  constructor(createLayer, onChange) {
    this.createLayer = createLayer;
    this.onChange = onChange;
    this.global = createLayer(void 0);
  }
  /**
  * Read an existing exact-scope overlay. Deliberately chain-blind: callers
  * addressing one scope's OWN contributions (its restrictions, its guards)
  * must not silently pick up an ancestor's — use {@link chainLayers} where
  * inheritance is the point.
  * @param scope - exact scope key; `undefined` denotes no overlay.
  * @returns the existing scoped layer, or `undefined` without creating one.
  */
  peek(scope) {
    if (scope === void 0) return void 0;
    return this.scoped.get(scope);
  }
  /**
  * Existing overlays along the scope's parent chain ({@link scopeChainOf}),
  * farthest ancestor first and the exact scope last, so a caller layering
  * them in order gives the nearest scope the final word.
  * @param scope - viewing scope, or `undefined` for no overlays.
  * @returns the existing layers, nearest last; absent overlays are skipped.
  */
  chainLayers(scope) {
    const layers = [];
    for (const key of scopeChainOf(scope).reverse()) {
      const layer = this.scoped.get(key);
      if (layer !== void 0) layers.push(layer);
    }
    return layers;
  }
  /**
  * Materialize global named entries followed by scope-chain shadows,
  * farthest ancestor first, so the nearest scope's entry wins a name.
  * @param scope - viewing scope, or `undefined` for the global view.
  * @param pick - select the named table from a layer.
  * @returns an insertion-ordered effective map.
  */
  merge(scope, pick2) {
    const merged = new Map(pick2(this.global).entries());
    for (const layer of this.chainLayers(scope)) for (const [name2, value] of pick2(layer).entries()) merged.set(name2, value);
    return merged;
  }
  /**
  * Attach one synchronous layer mutation to its registration context.
  * @param ctx - context that determines both scope visibility and effect ownership.
  * @param action - atomic mutation returning its synchronous undo.
  * @param options - Cordis effect label and optional change notification.
  * @returns the exact disposer returned by `ctx.effect()`.
  */
  effect(ctx, action, options) {
    const scope = scopeOf(ctx);
    const notify = options.notify ?? true;
    return ctx.effect(function* () {
      let layer;
      let created = false;
      if (scope === void 0) layer = this.global;
      else {
        const existing = this.scoped.get(scope);
        if (existing === void 0) {
          layer = this.createLayer(scope);
          this.scoped.set(scope, layer);
          created = true;
        } else layer = existing;
      }
      let undo;
      try {
        undo = action(layer);
      } catch (error) {
        if (scope !== void 0 && created && layer.isEmpty()) this.scoped.delete(scope);
        throw error;
      }
      yield () => {
        undo();
        if (scope !== void 0 && layer.isEmpty()) this.scoped.delete(scope);
        if (notify) this.onChange();
      };
      if (notify) this.onChange();
    }.bind(this), options.label);
  }
};
var kScope = /* @__PURE__ */ Symbol("dsh.scope");
var carrierKeys = /* @__PURE__ */ new WeakMap();
var scopeParents = /* @__PURE__ */ new WeakMap();
function scopeChainOf(key) {
  const chain = [];
  for (let cursor = key; cursor !== void 0; cursor = scopeParents.get(cursor)) chain.push(cursor);
  return chain;
}
function scopeOf(ctx) {
  return ctx[kScope];
}
function scopeTarget(base, key) {
  const baseFilter = base[Context.filter];
  const carrier = { [Context.filter](ctx) {
    if (baseFilter !== void 0 && !baseFilter.call(base, ctx)) return false;
    const tag = scopeOf(ctx);
    if (tag === void 0) return true;
    for (let cursor = key; cursor !== void 0; cursor = scopeParents.get(cursor)) if (cursor === tag) return true;
    return false;
  } };
  carrierKeys.set(carrier, key);
  return carrier;
}

// node_modules/@deepseek-ai/dsh-llm/lib/index.js
import { createRequire } from "node:module";

// node_modules/@deepseek-ai/dsh-timeout/lib/index.js
var MAX_TIMER_DELAY_MS = 2147483647;

// node_modules/@deepseek-ai/dsh-llm/lib/index.js
function CallId(id) {
  return id;
}
function deepFreeze(value) {
  const seen = /* @__PURE__ */ new WeakSet();
  const pending = [{
    kind: "visit",
    node: value
  }];
  while (pending.length > 0) {
    const task = pending.pop();
    if (task === void 0) continue;
    if (task.kind === "property") {
      pending.push({
        kind: "visit",
        node: task.source[task.key]
      });
      continue;
    }
    const node = task.node;
    if (node === null || typeof node !== "object") continue;
    if (node instanceof AbortSignal) continue;
    if (seen.has(node)) continue;
    seen.add(node);
    Object.freeze(node);
    const keys = Object.keys(node);
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      if (key === void 0) continue;
      pending.push({
        kind: "property",
        source: node,
        key
      });
    }
  }
  return value;
}
var HarnessError = class extends Error {
  /** Stable machine-routable failure class (e.g. `RATE_LIMIT`); route on this, never by parsing `message`. */
  code;
  constructor(message, code, options) {
    super(message, options);
    this.code = code;
    this.name = new.target.name;
  }
};
var EMPTY_RESPONSE_CODE = "EMPTY_RESPONSE";
var STRUCTURED_CONTEXT_OVERFLOW = new RegExp(String.raw`(?:^|[^a-z0-9])context[\s_-](?:length|window)[\s_-]` + String.raw`(?:exceed(?:ed|s)?|overflow(?:ed)?|limit[\s_-]exceeded)(?:$|[^a-z0-9])`, "i");
var TOO_LARGE_FOR_CONTEXT = new RegExp(String.raw`\b(?:request|prompt|input|messages?)\s+(?:is\s+|are\s+)?` + String.raw`too\s+(?:large|long)\s+for\s+(?:(?:this|the)\s+)?` + String.raw`(?:model(?:'s)?\s+)?context(?:\s+window)?\b`, "i");
var EXCEEDS_MODEL_CONTEXT = new RegExp(String.raw`\b(?:input|prompt|request|messages?)\b.{0,40}` + String.raw`\b(?:exceed(?:s|ed)?|overflows?|is\s+larger\s+than)\b.{0,40}` + String.raw`\b(?:the\s+)?(?:model(?:'s)?\s+)?context(?:\s+(?:length|window))?\b`, "i");
var DEFAULT_MAX_RETRIES = 2;
var DEFAULT_INITIAL_DELAY_MS = 500;
var DEFAULT_MAX_DELAY_MS = 1e4;
var DEFAULT_JITTER_RATIO = 0.1;
var DEFAULT_RETRYABLE_CODES = Object.freeze([
  EMPTY_RESPONSE_CODE,
  "RATE_LIMIT",
  "SERVER",
  "TIMEOUT",
  "TRANSPORT"
]);
var backoffSchema = Schema.object({
  initialDelayMs: Schema.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_INITIAL_DELAY_MS),
  maxDelayMs: Schema.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_MAX_DELAY_MS),
  jitterRatio: Schema.number().min(0).max(1).default(DEFAULT_JITTER_RATIO)
});
var normalPolicySchema = Schema.object({
  mode: Schema.const("normal").required(),
  maxRetries: Schema.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_RETRIES),
  retryableCodes: Schema.array(Schema.string()).default([...DEFAULT_RETRYABLE_CODES]),
  backoff: backoffSchema
});
var alwaysPolicySchema = Schema.object({
  mode: Schema.const("always").required(),
  backoff: backoffSchema
});
var RetryPolicySchema = Schema.union([normalPolicySchema, alwaysPolicySchema]);
var { version } = createRequire(import.meta.url)("../package.json");
function assertNever(value, context) {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}

// node_modules/@deepseek-ai/dsh-session/lib/index.js
function hasIntrinsicConstructor(prototype, name2) {
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
  if (typeof constructor !== "function") return false;
  try {
    return constructor.name === name2 && constructor.prototype === prototype && Function.prototype.toString.call(constructor) === `function ${name2}() { [native code] }`;
  } catch {
    return false;
  }
}
function isIntrinsicObjectPrototype(value) {
  return Object.getPrototypeOf(value) === null && hasIntrinsicConstructor(value, "Object");
}
function hasPlainArrayPrototype(value) {
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(prototype) || !hasIntrinsicConstructor(prototype, "Array")) return false;
  const objectPrototype = Object.getPrototypeOf(prototype);
  return typeof objectPrototype === "object" && objectPrototype !== null && isIntrinsicObjectPrototype(objectPrototype);
}
function hasPlainObjectPrototype(value) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || typeof prototype === "object" && isIntrinsicObjectPrototype(prototype);
}
function enumerableStringKeys(value) {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !Object.prototype.propertyIsEnumerable.call(value, key))) return void 0;
  return keys;
}
function walkJsonValue(value, detach) {
  const ancestors = /* @__PURE__ */ new Set();
  let root;
  const assign = (destination, item) => {
    if (destination === void 0) return;
    if (destination.kind === "root") root = item;
    else if (destination.kind === "array") destination.target[destination.index] = item;
    else Object.defineProperty(destination.target, destination.key, {
      value: item,
      enumerable: true,
      configurable: true,
      writable: true
    });
  };
  const tasks = [{
    kind: "visit",
    value,
    ...detach ? { destination: { kind: "root" } } : {}
  }];
  for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
    if (task.kind === "leave") {
      ancestors.delete(task.source);
      continue;
    }
    if (task.kind === "array-item") {
      if (!Object.prototype.hasOwnProperty.call(task.source, task.index)) return void 0;
      tasks.push({
        kind: "visit",
        value: task.source[task.index],
        ...task.target === void 0 ? {} : { destination: {
          kind: "array",
          target: task.target,
          index: task.index
        } }
      });
      continue;
    }
    if (task.kind === "object-property") {
      tasks.push({
        kind: "visit",
        value: task.source[task.key],
        ...task.target === void 0 ? {} : { destination: {
          kind: "object",
          target: task.target,
          key: task.key
        } }
      });
      continue;
    }
    const current = task.value;
    if (current === null) {
      assign(task.destination, null);
      continue;
    }
    if (typeof current === "boolean" || typeof current === "string") {
      assign(task.destination, current);
      continue;
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current) || Object.is(current, -0)) return void 0;
      assign(task.destination, current);
      continue;
    }
    if (typeof current !== "object") return void 0;
    if (ancestors.has(current)) return void 0;
    if (Array.isArray(current)) {
      if (!hasPlainArrayPrototype(current)) return void 0;
      const length = current.length;
      if (Reflect.ownKeys(current).length !== length + 1) return void 0;
      const target2 = detach ? [] : void 0;
      if (target2 !== void 0) assign(task.destination, target2);
      ancestors.add(current);
      tasks.push({
        kind: "leave",
        source: current
      });
      for (let index = length - 1; index >= 0; index--) tasks.push({
        kind: "array-item",
        source: current,
        index,
        ...target2 === void 0 ? {} : { target: target2 }
      });
      continue;
    }
    if (!hasPlainObjectPrototype(current)) return void 0;
    const keys = enumerableStringKeys(current);
    if (keys === void 0) return void 0;
    const target = detach ? {} : void 0;
    if (target !== void 0) assign(task.destination, target);
    ancestors.add(current);
    tasks.push({
      kind: "leave",
      source: current
    });
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      if (key === void 0) return void 0;
      tasks.push({
        kind: "object-property",
        source: current,
        key,
        ...target === void 0 ? {} : { target }
      });
    }
  }
  return detach ? root : true;
}
function snapshotJsonValue(value) {
  return walkJsonValue(value, true);
}
function isJsonValue(value) {
  return walkJsonValue(value, false) === true;
}

// node_modules/@deepseek-ai/dsh-tools/lib/index.js
var JsonSchemaError = class extends HarnessError {
  /** Individual schema violations in walk order. */
  violations;
  constructor(violations) {
    super(`unsupported JSON schema: ${violations.join("; ")}`, "UNSUPPORTED_SCHEMA");
    this.name = "JsonSchemaError";
    this.violations = violations;
  }
};
var CONSTRAINT_KEYWORDS = /* @__PURE__ */ new Set([
  "type",
  "oneOf",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "const"
]);
var ANNOTATION_KEYWORDS = /* @__PURE__ */ new Set([
  "description",
  "title",
  "default",
  "examples"
]);
var SCHEMA_TYPES = [
  "object",
  "array",
  "string",
  "number",
  "integer",
  "boolean",
  "null"
];
function hasIntrinsicConstructor2(prototype, name2) {
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
  if (typeof constructor !== "function") return false;
  try {
    return constructor.name === name2 && constructor.prototype === prototype && Function.prototype.toString.call(constructor) === `function ${name2}() { [native code] }`;
  } catch {
    return false;
  }
}
function isIntrinsicObjectPrototype2(value) {
  return Object.getPrototypeOf(value) === null && hasIntrinsicConstructor2(value, "Object");
}
function isPlainJsonRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || typeof prototype === "object" && isIntrinsicObjectPrototype2(prototype);
  } catch {
    return false;
  }
}
function hasPlainArrayPrototype2(value) {
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(prototype) || !hasIntrinsicConstructor2(prototype, "Array")) return false;
  const objectPrototype = Object.getPrototypeOf(prototype);
  return typeof objectPrototype === "object" && objectPrototype !== null && isIntrinsicObjectPrototype2(objectPrototype);
}
function hasOnlyEnumerableStringKeys(value) {
  try {
    return Reflect.ownKeys(value).every((key) => typeof key === "string" && Object.prototype.propertyIsEnumerable.call(value, key));
  } catch {
    return false;
  }
}
function isJsonSchemaRecord(value) {
  return isPlainJsonRecord(value) && hasOnlyEnumerableStringKeys(value);
}
function isPlainJsonArray(value) {
  if (!Array.isArray(value)) return false;
  try {
    if (!hasPlainArrayPrototype2(value) || Reflect.ownKeys(value).length !== value.length + 1) return false;
    for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index)) return false;
    return true;
  } catch {
    return false;
  }
}
function isJsonNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0);
}
function scalarMatches(type, value) {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return isJsonNumber(value);
    case "integer":
      return isJsonNumber(value) && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    /* v8 ignore next -- JsonSchemaScalarType is closed; this retains compile-time exhaustiveness. */
    default:
      return assertNever(type, "JsonSchemaType");
  }
}
var ONE_OF_SIBLING_KEYWORDS = [
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "const"
];
function checkObjectSchemaTail(node, path7, properties, violations) {
  const hasRequired = Object.hasOwn(node, "required");
  const required = hasRequired ? node.required : void 0;
  if (hasRequired) if (!isPlainJsonArray(required) || required.some((entry) => typeof entry !== "string")) violations.push(`${path7}.required must be an array of strings`);
  else {
    const declared = isJsonSchemaRecord(properties) ? properties : {};
    for (const key of required) if (!Object.hasOwn(declared, key)) violations.push(`${path7}.required names "${key}" which is not in properties`);
  }
  if (Object.hasOwn(node, "additionalProperties") && typeof node.additionalProperties !== "boolean") violations.push(`${path7}.additionalProperties must be a boolean`);
}
function checkSchemaNode(root, rootPath, violations, seen) {
  const tasks = [{
    kind: "enter",
    node: root,
    path: rootPath
  }];
  for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
    if (task.kind === "leave") {
      seen.delete(task.node);
      continue;
    }
    if (task.kind === "one-of-tail") {
      for (const key of ONE_OF_SIBLING_KEYWORDS) if (Object.hasOwn(task.node, key)) violations.push(`${task.path}.${key} is not supported beside oneOf`);
      continue;
    }
    if (task.kind === "object-tail") {
      checkObjectSchemaTail(task.node, task.path, task.properties, violations);
      continue;
    }
    const { node, path: path7 } = task;
    if (!isJsonSchemaRecord(node)) {
      violations.push(`${path7} must be a schema object`);
      continue;
    }
    if (seen.has(node)) {
      violations.push(`${path7} is circular`);
      continue;
    }
    seen.add(node);
    tasks.push({
      kind: "leave",
      node
    });
    for (const key of Object.keys(node)) {
      if (CONSTRAINT_KEYWORDS.has(key)) continue;
      if (ANNOTATION_KEYWORDS.has(key)) {
        try {
          if (!isJsonValue(node[key])) violations.push(`${path7}.${key} annotation must be lossless JSON data`);
        } catch {
          violations.push(`${path7}.${key} annotation must be lossless JSON data`);
        }
        continue;
      }
      violations.push(`${path7}.${key} is not a supported keyword (subset: type/oneOf/properties/required/additionalProperties/items/enum/const + annotations)`);
    }
    if (Object.hasOwn(node, "description") && typeof node.description !== "string") violations.push(`${path7}.description must be a string`);
    if (Object.hasOwn(node, "title") && typeof node.title !== "string") violations.push(`${path7}.title must be a string`);
    const hasType = Object.hasOwn(node, "type");
    const hasOneOf = Object.hasOwn(node, "oneOf");
    if (hasType && hasOneOf) {
      violations.push(`${path7} cannot declare both type and oneOf`);
      continue;
    }
    if (!hasType && !hasOneOf) {
      for (const key of ONE_OF_SIBLING_KEYWORDS) if (Object.hasOwn(node, key)) violations.push(`${path7}.${key} requires type or oneOf`);
      continue;
    }
    if (hasOneOf) {
      const oneOf = node.oneOf;
      tasks.push({
        kind: "one-of-tail",
        node,
        path: path7
      });
      if (!isPlainJsonArray(oneOf) || oneOf.length < 2) violations.push(`${path7}.oneOf must be an array of at least two schemas`);
      else for (let index = oneOf.length - 1; index >= 0; index--) tasks.push({
        kind: "enter",
        node: oneOf[index],
        path: `${path7}.oneOf[${index}]`
      });
      continue;
    }
    const type = node.type;
    if (typeof type !== "string" || !SCHEMA_TYPES.includes(type)) {
      violations.push(Array.isArray(type) ? `${path7}.type must be a single type string (type arrays are not supported)` : `${path7}.type must be one of ${SCHEMA_TYPES.join("/")}`);
      continue;
    }
    const schemaType = type;
    for (const [key, types] of Object.entries({
      properties: ["object"],
      required: ["object"],
      additionalProperties: ["object"],
      items: ["array"],
      enum: [
        "string",
        "number",
        "integer",
        "boolean",
        "null"
      ],
      const: [
        "string",
        "number",
        "integer",
        "boolean",
        "null"
      ]
    })) if (Object.hasOwn(node, key) && !types.includes(schemaType)) violations.push(`${path7}.${key} is not supported on type "${schemaType}"`);
    switch (schemaType) {
      case "object": {
        const properties = Object.hasOwn(node, "properties") ? node.properties : void 0;
        tasks.push({
          kind: "object-tail",
          node,
          path: path7,
          properties
        });
        if (Object.hasOwn(node, "properties")) if (!isJsonSchemaRecord(properties)) violations.push(`${path7}.properties must be an object of schemas`);
        else {
          const entries = Object.entries(properties);
          for (let index = entries.length - 1; index >= 0; index--) {
            const entry = entries[index];
            if (entry === void 0) continue;
            tasks.push({
              kind: "enter",
              node: entry[1],
              path: `${path7}.properties.${entry[0]}`
            });
          }
        }
        break;
      }
      case "array":
        if (Object.hasOwn(node, "items")) tasks.push({
          kind: "enter",
          node: node.items,
          path: `${path7}.items`
        });
        break;
      case "string":
      case "number":
      case "integer":
      case "boolean":
      case "null": {
        const hasEnum = Object.hasOwn(node, "enum");
        const allowed = hasEnum ? node.enum : void 0;
        const enumValid = isPlainJsonArray(allowed) && allowed.length > 0 && allowed.every((entry) => scalarMatches(schemaType, entry));
        if (hasEnum && !enumValid) violations.push(`${path7}.enum must be a non-empty array of ${schemaType} values`);
        const hasConst = Object.hasOwn(node, "const");
        const declaredConst = hasConst ? node.const : void 0;
        const constValid = scalarMatches(schemaType, declaredConst);
        if (hasConst) {
          if (!constValid) violations.push(`${path7}.const must be a ${schemaType} value`);
          else if (enumValid && !allowed.includes(declaredConst)) violations.push(`${path7}.const must be one of ${path7}.enum when both are declared`);
        }
        break;
      }
      /* v8 ignore next -- schemaType was narrowed from the closed SCHEMA_TYPES table above. */
      default:
        assertNever(schemaType, "JsonSchemaType");
    }
  }
}
function assertSupportedJsonSchema(schema) {
  const violations = [];
  checkSchemaNode(schema, "schema", violations, /* @__PURE__ */ new Set());
  if (violations.length > 0) throw new JsonSchemaError(violations);
}
function safelyIsJsonValue(value) {
  try {
    return isJsonValue(value);
  } catch {
    return false;
  }
}
function diagnosticPath(path7) {
  return path7 === "" ? "arguments" : path7;
}
function propertyPath(path7, key) {
  return path7 === "" ? key : `${path7}.${key}`;
}
function losslessValueViolation(path7) {
  return [`"${diagnosticPath(path7)}" must be a lossless JSON value`];
}
function appendViolations(target, source) {
  for (const violation of source) target.push(violation);
}
function valueFrame(node, value, path7) {
  return {
    node,
    value,
    path: path7,
    catches: false,
    phase: "start",
    children: [],
    childIndex: 0,
    violations: [],
    tailViolations: [],
    matches: 0
  };
}
function checkScalarValue(node, value, path7) {
  const allowed = Object.hasOwn(node, "enum") ? node.enum : void 0;
  if (allowed !== void 0 && !allowed.includes(value)) return [`"${diagnosticPath(path7)}" must be one of ${JSON.stringify(allowed)}`];
  if (Object.hasOwn(node, "const") && value !== node.const) return [`"${diagnosticPath(path7)}" must be ${JSON.stringify(node.const)}`];
  return [];
}
function checkValue(schema, value, path7) {
  const frames = [valueFrame(schema, value, path7)];
  let rootResult;
  const receive = (result) => {
    const parent = frames.at(-1);
    if (parent === void 0) {
      rootResult = result;
      return;
    }
    if (parent.kind === "oneOf") {
      if (result.length === 0) parent.matches++;
    } else appendViolations(parent.violations, result);
  };
  const finish = (result) => {
    frames.pop();
    receive(result);
  };
  while (frames.length > 0) {
    const frame = frames.at(-1);
    if (frame === void 0) break;
    try {
      if (frame.phase === "children") {
        if (frame.childIndex < frame.children.length) {
          const child = frame.children[frame.childIndex];
          if (child === void 0) throw new Error("missing schema-value child frame");
          frame.childIndex++;
          frames.push(valueFrame(child.node, child.value, child.path));
          continue;
        }
        if (frame.kind === "oneOf") {
          finish(frame.matches === 1 ? [] : [`"${diagnosticPath(frame.path)}" must match exactly one oneOf branch (matched ${frame.matches})`]);
          continue;
        }
        appendViolations(frame.violations, frame.tailViolations);
        if (frame.violations.length > 0) finish(frame.violations);
        else if (frame.kind === "object") finish(safelyIsJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a lossless JSON object`]);
        else finish(safelyIsJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a dense lossless JSON array`]);
        continue;
      }
      const nodeType = Object.hasOwn(frame.node, "type") ? frame.node.type : void 0;
      frame.catches = !(nodeType !== void 0 && !SCHEMA_TYPES.includes(nodeType));
      const oneOf = Object.hasOwn(frame.node, "oneOf") ? frame.node.oneOf : void 0;
      if (oneOf !== void 0) {
        frame.kind = "oneOf";
        frame.children = Array.from(oneOf, (branch) => ({
          node: branch,
          value: frame.value,
          path: frame.path
        }));
        frame.childIndex = 0;
        frame.matches = 0;
        frame.phase = "children";
        continue;
      }
      if (nodeType === void 0) {
        finish(safelyIsJsonValue(frame.value) ? [] : losslessValueViolation(frame.path));
        continue;
      }
      switch (nodeType) {
        case "object": {
          if (!isPlainJsonRecord(frame.value)) {
            finish([`"${diagnosticPath(frame.path)}" must be an object`]);
            break;
          }
          const properties = Object.hasOwn(frame.node, "properties") ? frame.node.properties ?? {} : {};
          const violations = [];
          const required = Object.hasOwn(frame.node, "required") ? frame.node.required ?? [] : [];
          for (const key of required) if (!Object.hasOwn(frame.value, key) || frame.value[key] === void 0) violations.push(`missing required property "${propertyPath(frame.path, key)}"`);
          const children = [];
          for (const [key, child] of Object.entries(properties)) {
            if (!Object.hasOwn(frame.value, key) || frame.value[key] === void 0) continue;
            children.push({
              node: child,
              value: frame.value[key],
              path: propertyPath(frame.path, key)
            });
          }
          const tailViolations = [];
          if (Object.hasOwn(frame.node, "additionalProperties") && frame.node.additionalProperties === false) {
            for (const key of Object.keys(frame.value)) if (!Object.hasOwn(properties, key)) tailViolations.push(`"${propertyPath(frame.path, key)}" is not a declared property (additionalProperties: false)`);
          }
          frame.kind = "object";
          frame.children = children;
          frame.childIndex = 0;
          frame.violations = violations;
          frame.tailViolations = tailViolations;
          frame.phase = "children";
          break;
        }
        case "array": {
          if (!Array.isArray(frame.value)) {
            finish([`"${diagnosticPath(frame.path)}" must be an array`]);
            break;
          }
          const items = Object.hasOwn(frame.node, "items") ? frame.node.items : void 0;
          const children = items === void 0 ? [] : frame.value.flatMap((entry, index) => [{
            node: items,
            value: entry,
            path: `${frame.path}[${index}]`
          }]);
          frame.kind = "array";
          frame.children = children;
          frame.childIndex = 0;
          frame.violations = [];
          frame.phase = "children";
          break;
        }
        case "string":
          finish(typeof frame.value === "string" ? checkScalarValue(frame.node, frame.value, frame.path) : [`"${diagnosticPath(frame.path)}" must be a string`]);
          break;
        case "number":
          finish(typeof frame.value !== "number" ? [`"${diagnosticPath(frame.path)}" must be a number`] : !isJsonNumber(frame.value) ? [`"${diagnosticPath(frame.path)}" must be a finite JSON number`] : checkScalarValue(frame.node, frame.value, frame.path));
          break;
        case "integer":
          finish(!isJsonNumber(frame.value) || !Number.isInteger(frame.value) ? [`"${diagnosticPath(frame.path)}" must be an integer`] : checkScalarValue(frame.node, frame.value, frame.path));
          break;
        case "boolean":
          finish(typeof frame.value === "boolean" ? checkScalarValue(frame.node, frame.value, frame.path) : [`"${diagnosticPath(frame.path)}" must be a boolean`]);
          break;
        case "null":
          finish(frame.value === null ? checkScalarValue(frame.node, frame.value, frame.path) : [`"${diagnosticPath(frame.path)}" must be null`]);
          break;
        default:
          finish(assertNever(nodeType, "JsonSchemaType"));
      }
    } catch (error) {
      let failed = frames.pop();
      while (failed !== void 0 && !failed.catches) failed = frames.pop();
      if (failed === void 0) throw error;
      receive(losslessValueViolation(failed.path));
    }
  }
  return rootResult ?? losslessValueViolation(path7);
}
function validateJsonSchemaValue(schema, value, path7 = "value") {
  return checkValue(schema, value, path7);
}
var ANNOTATION_KEYS = [
  "description",
  "title",
  "default",
  "examples"
];
function authorError(message) {
  throw new JsonSchemaError([message]);
}
function copyAnnotations(source, target) {
  if (Object.hasOwn(source, "description")) target.description = source.description;
  if (Object.hasOwn(source, "title")) target.title = source.title;
  if (Object.hasOwn(source, "default")) target.default = source.default;
  if (Object.hasOwn(source, "examples")) target.examples = source.examples;
}
function assertAuthorKeys(source, path7, allowed) {
  for (const key of Object.keys(source)) if (!allowed.includes(key)) authorError(`${path7}.${key} is not supported by the value schema DSL`);
}
function assignCompiledNode(destination, node) {
  switch (destination.kind) {
    case "root":
      destination.holder.value = node;
      break;
    case "property":
      Object.defineProperty(destination.target, destination.key, {
        value: node,
        enumerable: true,
        configurable: true,
        writable: true
      });
      break;
    case "item":
      destination.target.items = node;
      break;
    case "one-of":
      destination.target[destination.index] = node;
      break;
  }
}
function assignCompiledPropertyMap(destination, compiled) {
  if (destination.kind === "root") destination.holder.value = compiled;
  else destination.target.properties = compiled.properties;
}
function runSchemaCompiler(initial) {
  const seen = /* @__PURE__ */ new Set();
  const tasks = [initial];
  for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
    if (task.kind === "leave") {
      seen.delete(task.input);
      continue;
    }
    if (task.kind === "property-map-tail") {
      if (task.required.length > 0) {
        task.compiled.required = task.required;
        if (task.destination.kind === "object") task.destination.target.required = task.required;
      }
      continue;
    }
    if (task.kind === "property") {
      if (!isJsonSchemaRecord(task.property)) authorError(`${task.path} must be a value schema object`);
      if (Object.hasOwn(task.property, "required") && task.property.required !== true) authorError(`${task.path}.required must be true when present`);
      if (Object.hasOwn(task.property, "required") && task.property.required === true) task.required.push(task.key);
      tasks.push({
        kind: "value",
        input: task.property,
        path: task.path,
        allowRequired: true,
        destination: {
          kind: "property",
          target: task.properties,
          key: task.key
        }
      });
      continue;
    }
    if (task.kind === "property-map") {
      if (!isJsonSchemaRecord(task.input)) authorError(`${task.path} must be an object of value schemas`);
      if (seen.has(task.input)) authorError(`${task.path} is circular`);
      seen.add(task.input);
      const compiled = { properties: {} };
      const required = [];
      assignCompiledPropertyMap(task.destination, compiled);
      tasks.push({
        kind: "leave",
        input: task.input
      });
      tasks.push({
        kind: "property-map-tail",
        compiled,
        required,
        destination: task.destination
      });
      const entries = Object.entries(task.input);
      for (let index = entries.length - 1; index >= 0; index--) {
        const entry = entries[index];
        if (entry === void 0) continue;
        tasks.push({
          kind: "property",
          property: entry[1],
          path: `${task.path}.${entry[0]}`,
          key: entry[0],
          properties: compiled.properties,
          required
        });
      }
      continue;
    }
    const { input, path: path7 } = task;
    if (!isJsonSchemaRecord(input)) authorError(`${path7} must be a value schema object`);
    if (seen.has(input)) authorError(`${path7} is circular`);
    seen.add(input);
    const authorKeys = [...ANNOTATION_KEYS, ...task.allowRequired ? ["required"] : []];
    const node = {};
    assignCompiledNode(task.destination, node);
    tasks.push({
      kind: "leave",
      input
    });
    if (Object.hasOwn(input, "oneOf")) {
      assertAuthorKeys(input, path7, [
        ...authorKeys,
        "oneOf",
        "type"
      ]);
      if (Object.hasOwn(input, "type")) authorError(`${path7} cannot declare both type and oneOf`);
      if (!isPlainJsonArray(input.oneOf)) authorError(`${path7}.oneOf must be an array of at least two value schemas`);
      const branches = [];
      node.oneOf = branches;
      copyAnnotations(input, node);
      for (let index = input.oneOf.length - 1; index >= 0; index--) tasks.push({
        kind: "value",
        input: input.oneOf[index],
        path: `${path7}.oneOf[${index}]`,
        allowRequired: false,
        destination: {
          kind: "one-of",
          target: branches,
          index
        }
      });
      continue;
    }
    const inputType = Object.hasOwn(input, "type") ? input.type : void 0;
    switch (inputType) {
      case "json":
        assertAuthorKeys(input, path7, [...authorKeys, "type"]);
        copyAnnotations(input, node);
        break;
      case "object":
        assertAuthorKeys(input, path7, [
          ...authorKeys,
          "type",
          "properties",
          "additionalProperties"
        ]);
        if (!Object.hasOwn(input, "additionalProperties") || typeof input.additionalProperties !== "boolean") authorError(`${path7}.additionalProperties must be explicitly true or false`);
        node.type = "object";
        copyAnnotations(input, node);
        node.additionalProperties = input.additionalProperties;
        if (Object.hasOwn(input, "properties")) tasks.push({
          kind: "property-map",
          input: input.properties,
          path: `${path7}.properties`,
          destination: {
            kind: "object",
            target: node
          }
        });
        break;
      case "array":
        assertAuthorKeys(input, path7, [
          ...authorKeys,
          "type",
          "items"
        ]);
        node.type = "array";
        copyAnnotations(input, node);
        if (Object.hasOwn(input, "items")) tasks.push({
          kind: "value",
          input: input.items,
          path: `${path7}.items`,
          allowRequired: false,
          destination: {
            kind: "item",
            target: node
          }
        });
        break;
      case "string":
      case "number":
      case "integer":
      case "boolean":
      case "null":
        assertAuthorKeys(input, path7, [
          ...authorKeys,
          "type",
          "enum",
          "const"
        ]);
        node.type = inputType;
        copyAnnotations(input, node);
        if (Object.hasOwn(input, "enum")) {
          if (!isPlainJsonArray(input.enum)) authorError(`${path7}.enum must be a non-empty array of scalar values`);
          node.enum = Array.from(input.enum, (entry) => entry);
        }
        if (Object.hasOwn(input, "const")) node.const = input.const;
        break;
      default:
        authorError(`${path7}.type must be string/number/integer/boolean/null/array/object/json, or use oneOf`);
    }
  }
}
function compilePropertyMap(input, path7) {
  const holder = {};
  runSchemaCompiler({
    kind: "property-map",
    input,
    path: path7,
    destination: {
      kind: "root",
      holder
    }
  });
  return holder.value ?? authorError(`${path7} did not compile`);
}
function compileValueSchema(input, path7) {
  const holder = {};
  runSchemaCompiler({
    kind: "value",
    input,
    path: path7,
    allowRequired: false,
    destination: {
      kind: "root",
      holder
    }
  });
  return holder.value ?? authorError(`${path7} did not compile`);
}
function valueSchemaSpecToJsonSchema(spec) {
  const schema = compileValueSchema(spec, "schema");
  assertSupportedJsonSchema(schema);
  return schema;
}
function parameterSchemaSpecToJsonSchema(spec) {
  const compiled = compilePropertyMap(spec, "parameters");
  const schema = {
    type: "object",
    properties: compiled.properties,
    ...compiled.required === void 0 ? {} : { required: compiled.required }
  };
  assertSupportedJsonSchema(schema);
  return schema;
}
var ToolArgsError = class extends HarnessError {
  /** Individual violations in schema-walk order. */
  violations;
  constructor(violations) {
    super(`invalid arguments: ${violations.join("; ")}`, "INVALID_ARGS");
    this.name = "ToolArgsError";
    this.violations = violations;
  }
};
function defineTool(options) {
  const userExecute = options.execute;
  const userFinalizeContent = options.finalizeContent;
  const userRender = options.output.render;
  const userPresentationMeta = options.output.presentationMeta;
  const userPresentCall = options.presentCall;
  const userPresentResult = options.presentResult;
  const userIsConcurrencySafe = options.isConcurrencySafe;
  if (options.timeoutMs !== void 0 && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) throw new Error(`defineTool(${options.name}): timeoutMs must be a positive finite number`);
  const parameters = parameterSchemaSpecToJsonSchema(options.parameters);
  const outputSchema = valueSchemaSpecToJsonSchema(options.output.schema);
  const validate = (args) => validateJsonSchemaValue(parameters, args, "");
  const tool = {
    name: options.name,
    description: options.description,
    parameters,
    output: {
      schema: outputSchema,
      render(args, value) {
        return userRender(args, value);
      },
      ...userPresentationMeta !== void 0 ? { presentationMeta(args, value) {
        return userPresentationMeta(args, value);
      } } : {}
    },
    ...options.timeoutMs !== void 0 ? { timeoutMs: options.timeoutMs } : {},
    async execute(args, exec) {
      const violations = validate(args);
      if (violations.length > 0) throw new ToolArgsError(violations);
      return userExecute(args, exec);
    }
  };
  if (userFinalizeContent) tool.finalizeContent = (exec, result) => userFinalizeContent(exec, result);
  if (userPresentCall) tool.presentCall = (args) => {
    if (validate(args).length > 0) return void 0;
    return userPresentCall(args);
  };
  if (userPresentResult) tool.presentResult = (args, result) => {
    if (validate(args).length > 0) return void 0;
    return userPresentResult(args, result);
  };
  if (userIsConcurrencySafe) tool.isConcurrencySafe = (args) => {
    if (validate(args).length > 0) return false;
    return userIsConcurrencySafe(args);
  };
  return tool;
}
var RUN_CODE_NAME = "run_code";
var TYPESCRIPT_FLAVOR = {
  description: "Execute a TypeScript program against the available tools. Write the BODY of an async function (erasable syntax only; top-level `await` and `return` work) and call tools as `await tools.name(args)` per the declarations in the system prompt. Only what you print or return comes back \u2014 curate it.",
  codeDescription: "The program: the body of an async TypeScript function."
};
var RUN_CODE_FLAVORS = {
  typescript: TYPESCRIPT_FLAVOR,
  python: {
    description: "Execute a Python program against the available tools. Write the BODY of an async function (top-level `await` and `return` work) and call tools as `await tools.name(args)` per the declarations in the system prompt. Answer with `print(...)` and/or `return <value>` \u2014 only that comes back, so curate it.",
    codeDescription: "The program: the body of an async Python function."
  }
};
var RUN_CODE_DESCRIPTION_PARAM_DESCRIPTION = 'Clear, concise description of what this program does in active voice, 5-10 words (shown in the UI). Examples: "Count TODO markers across packages"; "Read failing test and its fixture"; "Rename config key in every cordis.yml".';
function resolveFlavor(peekRuntime) {
  const runtime = peekRuntime();
  if (runtime === void 0) return TYPESCRIPT_FLAVOR;
  const flavor = RUN_CODE_FLAVORS[runtime.language];
  if (!Object.hasOwn(RUN_CODE_FLAVORS, runtime.language) || flavor === void 0) {
    const known = Object.keys(RUN_CODE_FLAVORS).map((name2) => JSON.stringify(name2)).join(", ");
    throw new Error(`dsh-tools: no run_code schema flavor registered for runtime language ${JSON.stringify(runtime.language)} (known: ${known})`);
  }
  return flavor;
}
var CodeRunFailedError = class extends HarnessError {
  constructor(message) {
    super(message, "CODE_RUN_FAILED");
    this.name = "CodeRunFailedError";
  }
};
function jsonNormalizeArgs(value) {
  let snapshot;
  try {
    snapshot = snapshotJsonValue(value);
  } catch (error) {
    throw new Error(`tool arguments must be lossless JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (snapshot === void 0) throw new Error("tool arguments must be lossless JSON (call the tool with an arguments object, e.g. `{}`)");
  const logged = snapshotJsonValue(snapshot);
  if (logged === void 0) throw new Error("tool arguments could not be detached for durable logging");
  return {
    dispatched: snapshot,
    logged
  };
}
var JSON_INDENT = "  ";
var MAX_JSON_INDENT_CHARS = 10;
function renderJsonValue(value) {
  const chunks = [];
  const tasks = [{
    kind: "value",
    value,
    depth: 0,
    compact: false
  }];
  for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
    if (task.kind === "text") {
      chunks.push(task.text);
      continue;
    }
    const current = task.value;
    if (current === null || typeof current === "boolean" || typeof current === "number") {
      chunks.push(String(current));
      continue;
    }
    if (typeof current === "string") {
      chunks.push(JSON.stringify(current));
      continue;
    }
    const compact = task.compact || (task.depth + 1) * 2 > MAX_JSON_INDENT_CHARS;
    const childDepth = task.depth + 1;
    if (Array.isArray(current)) {
      chunks.push("[");
      if (current.length === 0) {
        chunks.push("]");
        continue;
      }
      tasks.push({
        kind: "text",
        text: compact ? "]" : `
${JSON_INDENT.repeat(task.depth)}]`
      });
      for (let index = current.length - 1; index >= 0; index--) {
        const item = current[index];
        if (item === void 0) throw new Error("cannot render a sparse JSON array");
        tasks.push({
          kind: "value",
          value: item,
          depth: childDepth,
          compact
        });
        tasks.push({
          kind: "text",
          text: compact ? index === 0 ? "" : "," : `${index === 0 ? "\n" : ",\n"}${JSON_INDENT.repeat(childDepth)}`
        });
      }
      continue;
    }
    const keys = Object.keys(current);
    chunks.push("{");
    if (keys.length === 0) {
      chunks.push("}");
      continue;
    }
    tasks.push({
      kind: "text",
      text: compact ? "}" : `
${JSON_INDENT.repeat(task.depth)}}`
    });
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      if (key === void 0) throw new Error("cannot render a missing JSON object key");
      const item = current[key];
      if (item === void 0) throw new Error("cannot render an undefined JSON object property");
      tasks.push({
        kind: "value",
        value: item,
        depth: childDepth,
        compact
      });
      tasks.push({
        kind: "text",
        text: compact ? `${index === 0 ? "" : ","}${JSON.stringify(key)}:` : `${index === 0 ? "\n" : ",\n"}${JSON_INDENT.repeat(childDepth)}${JSON.stringify(key)}: `
      });
    }
  }
  return chunks.join("");
}
function renderValue(value) {
  return typeof value === "string" ? value : renderJsonValue(value);
}
function createRunCodeTool(registry, options) {
  const { requireRuntime, peekRuntime, maxParallel, shapeDispatchLog } = options;
  const definition = defineTool({
    name: RUN_CODE_NAME,
    description: TYPESCRIPT_FLAVOR.description,
    parameters: {
      code: {
        type: "string",
        required: true,
        description: TYPESCRIPT_FLAVOR.codeDescription
      },
      description: {
        type: "string",
        required: true,
        description: RUN_CODE_DESCRIPTION_PARAM_DESCRIPTION
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          logs: {
            type: "array",
            required: true,
            items: { type: "string" }
          },
          result: { type: "json" }
        }
      },
      render: (_args, value) => {
        const rendered = value.result === void 0 ? "" : renderValue(value.result);
        const parts = [value.logs.join("\n"), rendered].filter((part) => part.length > 0);
        return [{
          type: "text",
          text: parts.length > 0 ? parts.join("\n") : "(run_code completed with no output)"
        }];
      }
    },
    async execute(args, exec) {
      if (args.description.trim().length === 0) throw new Error("invalid description: expected a non-empty string");
      const runtime = requireRuntime();
      const runController = new AbortController();
      const onOuterAbort = () => {
        runController.abort(exec.signal.reason);
      };
      exec.signal.addEventListener("abort", onOuterAbort, { once: true });
      let dispatches = 0;
      const pendingQueue = [];
      const inFlight = /* @__PURE__ */ new Set();
      const logWork = /* @__PURE__ */ new Set();
      const commitQueue = [];
      let exclusiveActive = false;
      let driving = false;
      let driverRun = Promise.resolve();
      let wake;
      const wakeup = () => {
        const release = wake;
        wake = void 0;
        release?.();
      };
      const drive = () => {
        if (driving) return driverRun;
        driving = true;
        driverRun = (async () => {
          try {
            for (; ; ) {
              const signal = new Promise((resolve6) => {
                wake = resolve6;
              });
              const commitHead = commitQueue[0];
              if (commitHead !== void 0 && commitHead.settled) {
                commitQueue.shift();
                await commitHead.commit();
                if (commitHead.mode === "exclusive") exclusiveActive = false;
                continue;
              }
              const head = pendingQueue[0];
              if (head !== void 0) {
                if (runController.signal.aborted) {
                  pendingQueue.shift();
                  head.abandon();
                  continue;
                }
                const mode = head.classify();
                if (!exclusiveActive && (mode === "exclusive" ? inFlight.size === 0 : inFlight.size < maxParallel)) {
                  if (mode === "exclusive") exclusiveActive = true;
                  head.mode = mode;
                  pendingQueue.shift();
                  commitQueue.push(head);
                  await head.start();
                  const flight = head.flight.finally(() => {
                    inFlight.delete(flight);
                    wakeup();
                  });
                  inFlight.add(flight);
                  continue;
                }
              }
              if (pendingQueue.length === 0 && commitQueue.length === 0 && inFlight.size === 0) return;
              await signal;
            }
          } finally {
            driving = false;
            wake = void 0;
          }
        })();
        return driverRun;
      };
      const drainDispatches = async () => {
        await drive();
        while (logWork.size > 0) await Promise.allSettled([...logWork]);
      };
      const runOver = () => runController.signal.aborted;
      const binding = (name2) => async (rawArgs) => {
        if (runOver()) throw new Error(`run_code run is over (${String(runController.signal.reason)}); ${name2} not dispatched`);
        const normalized = jsonNormalizeArgs(rawArgs);
        const n3 = ++dispatches;
        const subCallId = CallId(`${String(exec.callId)}:code:${n3}`);
        const input = {
          callId: subCallId,
          rootCallId: exec.rootCallId,
          name: name2,
          arguments: normalized.dispatched,
          ...exec.agent ? { agent: exec.agent } : {},
          parent: exec.token,
          signal: runController.signal
        };
        const scheduler = registry[TOOL_REGISTRY_SCHEDULER];
        const outcome = await new Promise((resolve6, reject) => {
          let parked;
          const settle = (result) => {
            resolve6(result.isError ? {
              isError: true,
              message: result.error.message
            } : {
              isError: false,
              value: result.value
            });
            const agent = exec.agent;
            if (agent === void 0) return;
            const task = (async () => {
              const logged = await shapeDispatchLog({
                exec,
                agent,
                subCallId,
                name: name2,
                isError: result.isError,
                content: result.content
              });
              agent.session.append("tool/code-dispatch", {
                rootCallId: exec.rootCallId,
                parentCallId: exec.callId,
                subCallId,
                name: name2,
                arguments: normalized.logged,
                isError: result.isError,
                content: logged
              });
            })().finally(() => {
              logWork.delete(task);
            });
            logWork.add(task);
          };
          pendingQueue.push({
            flight: Promise.resolve(),
            settled: false,
            classify: () => registry.executionMode(input).kind,
            abandon: () => {
              reject(/* @__PURE__ */ new Error(`run_code run is over (${String(runController.signal.reason)}); ${name2} tool call abandoned`));
            },
            async start() {
              exec.agent?.session.append("tool/code-dispatch-start", {
                rootCallId: exec.rootCallId,
                parentCallId: exec.callId,
                subCallId,
                name: name2,
                arguments: normalized.logged
              });
              const prepared = await scheduler.prepare(input);
              if (prepared.kind === "dispatch") {
                this.flight = scheduler.dispatch(prepared.exec).then((dispatchOutcome) => {
                  parked = {
                    kind: dispatchOutcome.kind,
                    exec: prepared.exec,
                    result: dispatchOutcome.result
                  };
                  this.settled = true;
                });
                return;
              }
              parked = {
                kind: prepared.kind,
                exec: prepared.exec,
                result: prepared.result
              };
              this.settled = true;
            },
            async commit() {
              if (parked === void 0) return;
              const result = parked.kind === "post-result" ? await scheduler.finalize(parked.exec, parked.result) : scheduler.finish(parked.exec, parked.result);
              for (const context of result.additionalContexts ?? []) exec.deferContext(context);
              if (result.concludesTurn) exec.concludeTurn();
              settle(result);
              while (logWork.size > maxParallel) await Promise.race(logWork);
            }
          });
          wakeup();
          drive();
        });
        if (runOver()) throw new Error(`run_code run is over (${String(runController.signal.reason)}); ${name2} result discarded`);
        if (outcome.isError) throw new Error(outcome.message);
        return outcome.value;
      };
      const functions2 = /* @__PURE__ */ Object.create(null);
      for (const schema of registry.schemas(exec.agent)) {
        if (schema.name === "run_code") continue;
        Object.defineProperty(functions2, schema.name, {
          enumerable: true,
          value: binding(schema.name)
        });
      }
      try {
        let result;
        try {
          result = await runtime.run({
            program: args.code,
            bindings: [{
              global: "tools",
              functions: functions2,
              errorClass: {
                name: "ToolCallError",
                memberNameProperty: "toolName"
              }
            }],
            signal: runController.signal
          });
        } finally {
          runController.abort("run_code settled");
          await drainDispatches();
        }
        if (result.error) {
          const logsText = result.logs.length > 0 ? `
Captured output:
${result.logs.join("\n")}` : "";
          throw new CodeRunFailedError(`code run failed (${result.error.kind}): ${result.error.message}${logsText}`);
        }
        return {
          logs: result.logs,
          ...result.value !== void 0 ? { result: result.value } : {}
        };
      } finally {
        exec.signal.removeEventListener("abort", onOuterAbort);
      }
    },
    presentCall: (args) => ({
      card: "generic",
      title: args.description,
      kind: "execute",
      rawInput: args.code
    })
  });
  Object.defineProperty(definition, "description", {
    enumerable: true,
    get: () => resolveFlavor(peekRuntime).description
  });
  Object.defineProperty(definition, "parameters", {
    enumerable: true,
    get: () => parameterSchemaSpecToJsonSchema({
      code: {
        type: "string",
        required: true,
        description: resolveFlavor(peekRuntime).codeDescription
      },
      description: {
        type: "string",
        required: true,
        description: RUN_CODE_DESCRIPTION_PARAM_DESCRIPTION
      }
    })
  });
  return definition;
}
var IDENTIFIER$1 = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function renderKey(name2) {
  return IDENTIFIER$1.test(name2) ? name2 : JSON.stringify(name2);
}
function pad$1(indent) {
  return "  ".repeat(indent);
}
function docLines$1(description, indent) {
  if (typeof description !== "string" || description.length === 0) return [];
  const collapsed = description.replace(/\s+/g, " ").trim();
  return [`${pad$1(indent)}/** ${collapsed.replaceAll("*/", String.raw`*\/`)} */`];
}
function renderScalar(value) {
  return JSON.stringify(value);
}
function renderConstrainedScalar$1(node, type) {
  const broad = type === "integer" ? "number" : type;
  if (Object.hasOwn(node, "const")) return renderScalar(node.const);
  if (Object.hasOwn(node, "enum")) return node.enum.map(renderScalar).join(" | ");
  return broad;
}
function typeDocumentFrom(parts) {
  return {
    parts,
    containsUnionOrIntersection: parts.some((part) => typeof part === "string" ? part.includes("|") || part.includes("&") : part.containsUnionOrIntersection)
  };
}
function typeDocument(...parts) {
  return typeDocumentFrom(parts);
}
function flattenTypeDocument(document2) {
  const chunks = [];
  const tasks = [document2];
  for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
    if (typeof task === "string") {
      chunks.push(task);
      continue;
    }
    for (let index = task.parts.length - 1; index >= 0; index--) {
      const part = task.parts[index];
      if (part !== void 0) tasks.push(part);
    }
  }
  return chunks.join("");
}
function schemaRenderFrame(node, indent) {
  return {
    node,
    indent,
    phase: "start",
    children: [],
    childIndex: 0,
    childDocuments: [],
    entries: []
  };
}
function renderSupportedSchema(schema, indent) {
  const frames = [schemaRenderFrame(schema, indent)];
  let rootDocument;
  const finish = (document2) => {
    frames.pop();
    const parent = frames.at(-1);
    if (parent === void 0) rootDocument = document2;
    else parent.childDocuments.push(document2);
  };
  while (frames.length > 0) {
    const frame = frames.at(-1);
    if (frame === void 0) break;
    if (frame.phase === "children") {
      if (frame.childIndex < frame.children.length) {
        const child = frame.children[frame.childIndex];
        if (child === void 0) throw new Error("missing schema render child");
        frame.childIndex++;
        frames.push(schemaRenderFrame(child.node, child.indent));
        continue;
      }
      if (frame.kind === "oneOf") {
        const parts2 = [];
        for (let index = 0; index < frame.childDocuments.length; index++) {
          if (index > 0) parts2.push(" | ");
          const child = frame.childDocuments[index];
          if (child !== void 0) parts2.push(child);
        }
        finish(typeDocumentFrom(parts2));
        continue;
      }
      if (frame.kind === "array") {
        const child = frame.childDocuments[0];
        if (child === void 0) throw new Error("missing array item type");
        finish(child.containsUnionOrIntersection ? typeDocument("(", child, ")[]") : typeDocument(child, "[]"));
        continue;
      }
      const required = new Set(frame.node.required);
      const parts = ["{"];
      for (let index = 0; index < frame.entries.length; index++) {
        const entry = frame.entries[index];
        const child = frame.childDocuments[index];
        if (entry === void 0 || child === void 0) throw new Error("missing object property type");
        const [name2, prop] = entry;
        for (const line of docLines$1(prop.description, frame.indent + 1)) parts.push("\n", line);
        parts.push("\n", `${pad$1(frame.indent + 1)}${renderKey(name2)}${required.has(name2) ? "" : "?"}: `, child, ";");
      }
      parts.push("\n", `${pad$1(frame.indent)}}`);
      const declared = typeDocumentFrom(parts);
      finish(frame.node.additionalProperties === false ? declared : typeDocument(declared, " & Record<string, JsonValue>"));
      continue;
    }
    const node = frame.node;
    if (node.oneOf !== void 0) {
      frame.kind = "oneOf";
      frame.children = Array.from(node.oneOf, (child) => ({
        node: child,
        indent: frame.indent
      }));
      frame.childIndex = 0;
      frame.childDocuments = [];
      frame.phase = "children";
      continue;
    }
    if (node.type === void 0) {
      finish(typeDocument("JsonValue"));
      continue;
    }
    switch (node.type) {
      case "string":
      case "number":
      case "integer":
      case "boolean":
      case "null":
        finish(typeDocument(renderConstrainedScalar$1(node, node.type)));
        break;
      case "array":
        if (node.items === void 0) finish(typeDocument("JsonValue[]"));
        else {
          frame.kind = "array";
          frame.children = [{
            node: node.items,
            indent: frame.indent
          }];
          frame.childIndex = 0;
          frame.childDocuments = [];
          frame.phase = "children";
        }
        break;
      case "object": {
        const open3 = node.additionalProperties !== false;
        const entries = Object.entries(node.properties ?? {});
        if (entries.length === 0) finish(typeDocument(open3 ? "Record<string, JsonValue>" : "Record<string, never>"));
        else {
          frame.kind = "object";
          frame.entries = entries;
          frame.children = entries.map(([, child]) => ({
            node: child,
            indent: frame.indent + 1
          }));
          frame.childIndex = 0;
          frame.childDocuments = [];
          frame.phase = "children";
        }
        break;
      }
      /* v8 ignore next -- assertSupportedJsonSchema narrowed this closed type union. */
      default:
        finish(typeDocument("unknown"));
    }
  }
  return rootDocument ?? typeDocument("unknown");
}
function jsonSchemaToTs(schema, indent = 0) {
  try {
    assertSupportedJsonSchema(schema);
    return flattenTypeDocument(renderSupportedSchema(schema, indent));
  } catch {
    return "unknown";
  }
}
var SDK_INSTRUCTIONS$1 = `## Writing code for run_code

Pass \`run_code\` the body of an async TypeScript function (erasable syntax only \u2014 no \`enum\` or namespaces; type annotations are advisory, the code runs type-stripped). Inside the program:

- Call tools as \`await tools.name(args)\` \u2014 quoted access for exotic names: \`tools["my-tool"](args)\`. Every call resolves to the tool's typed canonical JSON value. Tool arguments must be lossless JSON.
- A FAILED tool call rejects with \`ToolCallError\`, whose \`toolName\` identifies the failed tool and whose \`message\` is human-readable \u2014 \`try/catch\` it to handle and continue.
- Independent read-only calls MAY overlap under \`Promise.all\` (safe calls run concurrently; mutating calls run alone, in submission order). Sequence dependent work with \`await\`.
- Emit results with \`return\` and/or \`console.log(...)\`. ONLY what you print or return comes back to you \u2014 intermediate tool results never enter the conversation, so extract just what you need.

The available tools:`;
function renderToolsSdk(schemas) {
  const sorted = [...schemas].sort((a3, b2) => a3.name < b2.name ? -1 : a3.name > b2.name ? 1 : 0);
  const argsMembers = [];
  const outputMembers = [];
  for (const schema of sorted) {
    argsMembers.push(...docLines$1(schema.description, 1));
    argsMembers.push(`${pad$1(1)}${renderKey(schema.name)}: ${jsonSchemaToTs(schema.parameters, 1)};`);
    outputMembers.push(`${pad$1(1)}${renderKey(schema.name)}: ${jsonSchemaToTs(schema.output, 1)};`);
  }
  return `${SDK_INSTRUCTIONS$1}

\`\`\`ts
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

${[
    `interface ToolArgsMap {${argsMembers.length > 0 ? `
${argsMembers.join("\n")}
` : ""}}`,
    `interface ToolOutputMap {${outputMembers.length > 0 ? `
${outputMembers.join("\n")}
` : ""}}`,
    "type ToolName = keyof ToolOutputMap",
    [
      "declare class ToolCallError extends Error {",
      '  readonly name: "ToolCallError";',
      "  readonly toolName: ToolName;",
      "}"
    ].join("\n"),
    [
      "declare const tools: {",
      "  [K in ToolName]: (args: ToolArgsMap[K]) => Promise<ToolOutputMap[K]>;",
      "}"
    ].join("\n")
  ].join("\n\n")}
\`\`\``;
}
var IDENTIFIER = new RegExp("^[\\p{XID_Start}_]\\p{XID_Continue}*$", "u");
function isBareIdentifier(name2) {
  return IDENTIFIER.test(name2) && name2.normalize("NFKC") === name2;
}
var RESERVED = /* @__PURE__ */ new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
  "__debug__"
]);
var TYPING_ORDER = [
  "Any",
  "Literal",
  "NotRequired",
  "Protocol",
  "TypedDict"
];
function pad(indent) {
  return "    ".repeat(indent);
}
var UNPRINTABLE = /[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/g;
var LONE_SURROGATE = /[\ud800-\udfff]/gu;
function describe(schema) {
  const description = schema.description;
  if (typeof description !== "string") return void 0;
  const collapsed = description.replace(/\s+/g, " ").replace(UNPRINTABLE, (char) => `\\x${char.charCodeAt(0).toString(16).padStart(2, "0")}`).replace(LONE_SURROGATE, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`).trim();
  return collapsed.length === 0 ? void 0 : collapsed;
}
function docLines(description, indent) {
  const collapsed = describe({ description });
  if (collapsed === void 0) return [];
  const escaped = collapsed.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return [`${pad(indent)}"""${escaped}"""`];
}
function camelCase(raw) {
  const joined = raw.split(/[^\p{XID_Continue}]+|_+/u).filter((part) => part.length > 0).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join("").normalize("NFKC");
  return (new RegExp("^\\p{XID_Start}", "u").test(joined) ? joined : `Tool${joined}`).normalize("NFKC");
}
var MAX_CLASS_NAME_BASE = 120;
var MAX_LIST_NESTING = 180;
function capClassNameBase(base) {
  if (base.length <= MAX_CLASS_NAME_BASE) return base;
  const capped = base.slice(0, MAX_CLASS_NAME_BASE);
  return /[\uD800-\uDBFF]$/.test(capped) ? capped.slice(0, -1) : capped;
}
function allocateClassName(base, state) {
  const capped = capClassNameBase(base);
  let name2 = capped;
  if (state.usedClassNames.has(name2)) {
    let n3 = state.nextClassCounter.get(capped) ?? 2;
    while (state.usedClassNames.has(`${capped}${n3}`)) n3++;
    name2 = `${capped}${n3}`;
    state.nextClassCounter.set(capped, n3 + 1);
  }
  state.usedClassNames.add(name2);
  return name2;
}
function childClassName(base, segment) {
  return capClassNameBase(`${base}${segment}`.normalize("NFKC"));
}
function pyScalar(value) {
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isInteger(value) && !Number.isSafeInteger(value)) return BigInt(value).toString();
  return String(value);
}
function renderConstrainedScalar(node, broad, state) {
  if (node.const !== void 0) {
    state.typing.add("Literal");
    return `Literal[${pyScalar(node.const)}]`;
  }
  if (node.enum !== void 0) {
    state.typing.add("Literal");
    return `Literal[${node.enum.map(pyScalar).join(", ")}]`;
  }
  return broad;
}
function renderType(schema, className, state) {
  const newFrame = (schema2, className2, listDepth) => ({
    schema: schema2,
    className: className2,
    phase: "start",
    listDepth,
    children: [],
    childIndex: 0,
    childTypes: [],
    entries: []
  });
  try {
    assertSupportedJsonSchema(schema);
    const frames = [newFrame(schema, className, 0)];
    let result;
    const finish = (type) => {
      frames.pop();
      const parent = frames.at(-1);
      if (parent === void 0) result = type;
      else parent.childTypes.push(type);
    };
    while (frames.length > 0) {
      const frame = frames.at(-1);
      if (frame === void 0) break;
      if (frame.phase === "children") {
        if (frame.childIndex < frame.children.length) {
          const child = frame.children[frame.childIndex];
          if (child === void 0) throw new Error("missing python render child");
          frame.childIndex++;
          frames.push(newFrame(child.schema, child.className, child.listDepth));
          continue;
        }
        if (frame.kind === "oneOf") {
          let union = "";
          for (const [index, childType] of frame.childTypes.entries()) union = index === 0 ? childType : `${union} | ${childType}`;
          finish(union);
          continue;
        }
        if (frame.kind === "array") {
          finish(`list[${frame.childTypes[0] ?? "Any"}]`);
          continue;
        }
        const node2 = frame.node;
        const name2 = frame.allocated;
        if (node2 === void 0 || name2 === void 0) throw new Error("missing typeddict frame state");
        const required = new Set(node2.required);
        const lines = [`class ${name2}(TypedDict):`];
        for (let index = 0; index < frame.entries.length; index++) {
          const entry = frame.entries[index];
          const fieldType = frame.childTypes[index];
          if (entry === void 0 || fieldType === void 0) throw new Error("missing typeddict field type");
          const [field, fieldSchema] = entry;
          const description = describe(fieldSchema);
          if (description !== void 0) lines.push(`${pad(1)}# ${description}`);
          if (required.has(field)) lines.push(`${pad(1)}${field}: ${fieldType}`);
          else {
            state.typing.add("NotRequired");
            lines.push(`${pad(1)}${field}: NotRequired[${fieldType}]`);
          }
        }
        if (node2.additionalProperties !== false) lines.push(`${pad(1)}# Additional keys beyond those declared are allowed.`);
        if (lines.length === 1) lines.push(`${pad(1)}pass`);
        state.classes.push(lines.join("\n"));
        finish(name2);
        continue;
      }
      frame.phase = "children";
      const node = frame.schema;
      if (node.oneOf !== void 0) {
        frame.kind = "oneOf";
        frame.children = node.oneOf.map((branch, index) => ({
          schema: branch,
          className: childClassName(frame.className, `${index + 1}`),
          listDepth: frame.listDepth
        }));
        continue;
      }
      if (node.type === void 0) {
        state.typing.add("Any");
        finish("Any");
        continue;
      }
      switch (node.type) {
        case "string":
          finish(renderConstrainedScalar(node, "str", state));
          break;
        case "number":
          finish(renderConstrainedScalar(node, "float", state));
          break;
        case "integer":
          finish(renderConstrainedScalar(node, "int", state));
          break;
        case "boolean":
          finish(renderConstrainedScalar(node, "bool", state));
          break;
        case "null":
          finish("None");
          break;
        case "array":
          if (node.items === void 0) {
            state.typing.add("Any");
            finish("list[Any]");
            break;
          }
          if (frame.listDepth >= MAX_LIST_NESTING) {
            state.typing.add("Any");
            finish("Any");
            break;
          }
          frame.kind = "array";
          frame.children = [{
            schema: node.items,
            className: frame.className,
            listDepth: frame.listDepth + 1
          }];
          break;
        case "object": {
          const entries = Object.entries(node.properties ?? {});
          if (className === "" || !entries.every(([name2]) => isBareIdentifier(name2) && !RESERVED.has(name2) && !(name2.startsWith("__") && !name2.endsWith("__")))) {
            state.typing.add("Any");
            finish("dict[str, Any]");
            break;
          }
          if (entries.length === 0 && node.additionalProperties !== false) {
            state.typing.add("Any");
            finish("dict[str, Any]");
            break;
          }
          frame.kind = "typeddict";
          frame.node = node;
          frame.allocated = allocateClassName(frame.className, state);
          state.typing.add("TypedDict");
          frame.entries = entries;
          frame.children = entries.map(([field, child]) => ({
            schema: child,
            className: childClassName(frame.allocated ?? "", camelCase(field)),
            listDepth: 1
          }));
          break;
        }
        /* v8 ignore next 4 -- assertSupportedJsonSchema narrowed this closed type union. */
        default:
          state.typing.add("Any");
          finish("Any");
      }
    }
    return result ?? "Any";
  } catch {
    state.typing.add("Any");
    return "Any";
  }
}
var SDK_INSTRUCTIONS = `## Writing code for run_code

Pass \`run_code\` the body of an async Python function (top-level \`await\` and \`return\` both work). At run time exactly two of the names declared below are bound: \`tools\` and \`ToolCallError\`. Everything else is a STATIC STUB describing argument and return types \u2014 in particular the \`TypedDict\` classes do NOT exist at run time, so build arguments as plain \`dict\`/\`list\` JSON values: \`await tools.name({"field": 1})\`, never \`FooArgs(field=1)\`, which raises \`NameError\`. Inside the program:

- Call tools as \`await tools.name(args)\` \u2014 subscript access for exotic, reserved, or underscore-leading names: \`await tools["my-tool"](args)\`. Every call resolves to the tool's typed canonical JSON value (each method's return type below). Tool arguments must be lossless JSON.
- A FAILED tool call raises \`ToolCallError\`, whose \`toolName\` identifies the failed tool and whose message is human-readable \u2014 wrap in \`try/except\` to handle and continue.
- Independent read-only calls MAY overlap under \`asyncio.gather\` (safe calls run concurrently; mutating calls run alone, in submission order). Sequence dependent work with \`await\`.
- Emit the run's answer with \`print(...)\` and/or a top-level \`return <value>\`; the returned value must be lossless JSON. ONLY what you print and the returned value come back \u2014 intermediate tool results never enter the conversation, so extract just what you need.

The available tools:`;
function renderToolsSdkPy(schemas) {
  const sorted = [...schemas].sort((a3, b2) => a3.name < b2.name ? -1 : a3.name > b2.name ? 1 : 0);
  const state = {
    classes: [],
    usedClassNames: /* @__PURE__ */ new Set(),
    nextClassCounter: /* @__PURE__ */ new Map(),
    typing: /* @__PURE__ */ new Set(["Protocol"])
  };
  const members = [];
  let statements = 0;
  for (const schema of sorted) {
    const argType = renderType(schema.parameters, `${camelCase(schema.name)}Args`, state);
    const outputType = renderType(schema.output, `${camelCase(schema.name)}Output`, state);
    if (isBareIdentifier(schema.name) && !RESERVED.has(schema.name) && !schema.name.startsWith("_")) {
      const doc = docLines(schema.description, 2);
      members.push(doc.length > 0 ? `${pad(1)}async def ${schema.name}(self, args: ${argType}) -> ${outputType}:` : `${pad(1)}async def ${schema.name}(self, args: ${argType}) -> ${outputType}: ...`);
      members.push(...doc);
      statements += 1;
    } else {
      members.push(`${pad(1)}# tools[${JSON.stringify(schema.name)}](args: ${argType}) -> ${outputType}`);
      const description = describe(schema);
      if (description !== void 0) members.push(`${pad(1)}#   ${description}`);
    }
  }
  const body = (statements > 0 ? members : [`${pad(1)}pass`, ...members]).join("\n");
  const imports = TYPING_ORDER.filter((symbol) => state.typing.has(symbol));
  const classBlock = state.classes.length > 0 ? `${state.classes.join("\n\n")}

` : "";
  return `${SDK_INSTRUCTIONS}

\`\`\`python
${`from typing import ${imports.join(", ")}

class ToolCallError(Exception):
    toolName: str

${classBlock}class Tools(Protocol):
${body}

tools: Tools`}
\`\`\``;
}
var SDK_RENDERERS = {
  typescript: renderToolsSdk,
  python: renderToolsSdkPy
};
var TOOL_REGISTRY_SCHEDULER = /* @__PURE__ */ Symbol("@deepseek-ai/dsh-tools.scheduler");
var TOOL_ABORTED = "ABORTED";
var TOOL_ABORTED_BEFORE_DISPATCH = "ABORTED_BEFORE_DISPATCH";
var ToolNotFoundError = class extends HarnessError {
  constructor(toolName) {
    super(`unknown tool "${toolName}"`, "UNKNOWN_TOOL");
    this.name = "ToolNotFoundError";
  }
};
var ToolOutputError = class extends HarnessError {
  /** Schema/value violations in validation order. */
  violations;
  constructor(toolName, violations) {
    super(`tool "${toolName}" returned invalid output: ${violations.join("; ")}`, "INVALID_TOOL_OUTPUT");
    this.name = "ToolOutputError";
    this.violations = violations;
  }
};
function projectionError(toolName, projector, error) {
  return new ToolOutputError(toolName, [`output.${projector} failed: ${errorMessage(error)}`]);
}
function snapshotProjection(toolName, projector, candidate) {
  try {
    const detached = snapshotJsonValue(candidate);
    if (detached === void 0) throw new ToolOutputError(toolName, [`output.${projector} returned non-lossless JSON`]);
    return detached;
  } catch (error) {
    if (error instanceof ToolOutputError) throw error;
    throw projectionError(toolName, projector, error);
  }
}
function snapshotToolValue(toolName, candidate) {
  try {
    const detached = snapshotJsonValue(candidate);
    if (detached === void 0) throw new ToolOutputError(toolName, ["value is not lossless JSON"]);
    return detached;
  } catch (error) {
    if (error instanceof ToolOutputError) throw error;
    throw new ToolOutputError(toolName, [`value snapshot failed: ${errorMessage(error)}`]);
  }
}
function errorMessage(error) {
  try {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
    return String(error);
  } catch {
    return "<unprintable thrown value>";
  }
}
function failureMessageFromContent(content) {
  const text2 = content.map((block) => block.type === "text" ? block.text : `[${block.type} content]`).join("\n");
  return text2.length > 0 ? text2 : "tool result blocked by post-execute policy";
}
function materializePresentation(candidate) {
  const detached = snapshotJsonValue(candidate);
  if (detached === void 0) throw new TypeError("tool result must be losslessly JSON-serializable");
  return deepFreeze(detached);
}
function errorInfo(error) {
  try {
    return error instanceof HarnessError ? {
      name: error.name,
      code: error.code
    } : void 0;
  } catch {
    return;
  }
}
var ToolLayer = class {
  tools;
  restrictions = new AnonymousEntries();
  guards = new AnonymousEntries();
  /**
  * Presentation this scope's agent declared for itself, shadowing the
  * deployment default. One cell rather than an entry table: two answers to
  * "which form does the model see" is a contradiction, not a merge.
  */
  mode;
  constructor(scope) {
    this.tools = new NamedEntries((name2) => /* @__PURE__ */ new Error(scope === void 0 ? `tool "${name2}" is already registered (for a per-agent variant, register through that agent's \`agent.ctx\` instead)` : `tool "${name2}" is already registered in this scope`));
  }
  /** Whether every contribution table in this aggregate layer is empty. */
  isEmpty() {
    return this.tools.isEmpty() && this.restrictions.isEmpty() && this.guards.isEmpty() && this.mode === void 0;
  }
  /** Whether every compiled restriction in this layer admits an inherited tool name. */
  admits(name2) {
    for (const filter of this.restrictions.values()) if (filter.allow !== void 0 && !filter.allow.has(name2) || filter.deny !== void 0 && filter.deny.has(name2)) return false;
    return true;
  }
  /** First monotonic denial from this layer's live guard registrations. */
  guardReason(exec) {
    for (const guard of this.guards.values()) {
      const reason = guard(exec);
      if (reason !== void 0) return reason;
    }
  }
};
function resolveMaxParallelSubCalls(value) {
  const maxParallelSubCalls = value ?? 10;
  if (!Number.isInteger(maxParallelSubCalls) || maxParallelSubCalls < 1) throw new Error("maxParallelSubCalls must be a positive integer");
  return maxParallelSubCalls;
}
var ToolRegistry = class extends Service {
  static inject = ["systemPrompt"];
  static Config = Schema.object({
    mode: Schema.union([
      "native",
      "code",
      "both"
    ]).default("native"),
    maxParallelSubCalls: Schema.natural().min(1).default(10)
  });
  /** Internal staged view consumed by `dsh-agent-loop`'s parallel scheduler. */
  [TOOL_REGISTRY_SCHEDULER] = {
    prepare: (exec) => this.prepareScheduledExecution(exec),
    dispatch: (exec) => this.dispatchScheduledExecution(exec),
    finalize: (exec, result) => this.finalizeScheduledExecution(exec, result),
    finish: (exec, result) => this.finishScheduledExecution(exec, result)
  };
  /** Context deferred by a running tool body, keyed by its scheduler-owned execution. */
  deferredContexts = /* @__PURE__ */ new WeakMap();
  /** Executions whose tool body declared the current turn complete. */
  concludingExecutions = /* @__PURE__ */ new WeakSet();
  /** Original caller cancellation, kept outside the wrapper-mutable execution object. */
  cancellationStates = /* @__PURE__ */ new WeakMap();
  /** Definition-owned final content transform snapshotted before policy begins. */
  contentFinalizers = /* @__PURE__ */ new WeakMap();
  layers = new ScopedLayers((scope) => new ToolLayer(scope), () => {
    this.ctx.emit("tools/change");
  });
  /** Presentation for agents that declare none; {@link presentAs} shadows it per agent. */
  defaultMode;
  maxParallelSubCalls;
  /**
  * Reserved presentation transport, kept outside the filterable registration
  * layers. Built on first need rather than at construction: which agents run
  * a code mode is no longer known when the service is constructed, and the
  * transport is stateless beyond its closures over `this`.
  */
  codeTransport;
  constructor(ctx, config = {}) {
    super(ctx, "tools");
    this.defaultMode = config.mode ?? "native";
    this.maxParallelSubCalls = resolveMaxParallelSubCalls(config.maxParallelSubCalls);
    ctx.systemPrompt.tools((context) => this.wireSchemas(context.scope));
    if (this.defaultMode !== "native") ctx.systemPrompt.section(this.sdkSection());
  }
  /**
  * The generated-SDK prompt section, registered globally by a code-mode
  * deployment and per agent by {@link presentAs}.
  *
  * The body regenerates from the CALLING scope, and renders empty for an
  * agent presenting natively — an agent that opted out under a code-mode
  * deployment still sees the global registration, and an empty section is
  * dropped from the rendered prompt.
  * @returns the section registration.
  */
  sdkSection() {
    return {
      name: "tools:sdk",
      order: 150,
      text: (context) => {
        const mode = this.modeFor(context.scope);
        if (mode === "native") return "";
        const runtime = this.requireCodeRuntime(mode);
        const render3 = SDK_RENDERERS[runtime.language];
        if (render3 === void 0) throw new Error(`dsh-tools: no SDK renderer for ${runtime.language}`);
        return render3(this.sdkSchemas(context.scope));
      }
    };
  }
  /**
  * The presentation one scope's agent sees: its own declaration, else the
  * deployment default.
  * @param scope - the calling agent, or undefined for the global view.
  * @returns the resolved presentation mode.
  */
  modeFor(scope) {
    const layers = this.layers.chainLayers(scope);
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const mode = layers[index]?.mode;
      if (mode !== void 0) return mode;
    }
    return this.defaultMode;
  }
  /**
  * The reserved `run_code` transport, built on first need.
  *
  * It never enters the global layer: per-agent restrictions must not remove
  * it, and a scoped registration must not shadow it. The visibility resolver
  * appends it after resolving the filterable global/scoped capability layers,
  * and only for scopes whose mode actually presents it.
  * @returns the shared transport definition.
  */
  requireCodeTransport() {
    this.codeTransport ??= createRunCodeTool(this, {
      requireRuntime: () => this.requireCodeRuntime(this.defaultMode),
      peekRuntime: () => this.ctx.get("codeRuntime"),
      maxParallel: this.maxParallelSubCalls,
      shapeDispatchLog: (dispatch) => this.shapeDispatchLog(dispatch)
    });
    return this.codeTransport;
  }
  /**
  * Present this agent's tools in `mode` instead of the deployment default.
  *
  * Scoped only, and one declaration per agent: this is how an agent preset
  * composes a Code Mode agent beside native ones in the same process, and a
  * process-global override would be the `mode` config field instead.
  * @param mode - the presentation this agent's model sees.
  * @returns the exact disposer that restores the deployment default.
  */
  presentAs(mode) {
    const ctx = this.ctx;
    if (scopeOf(ctx) === void 0) throw new Error("tools.presentAs() requires a scoped context (agent.ctx): a context-global presentation is the `mode` config field on the tools row");
    return ctx.effect(function* () {
      yield this.layers.effect(ctx, (layer) => {
        if (layer.mode !== void 0) throw new Error(`tools.presentAs("${mode}") conflicts with "${layer.mode}" already declared for this agent; one composition selects one presentation`);
        layer.mode = mode;
        return () => {
          layer.mode = void 0;
        };
      }, { label: "tools.presentAs()" });
      if (mode !== "native") yield ctx.systemPrompt.section(this.sdkSection());
    }.bind(this), "tools.presentAs()");
  }
  /**
  * Build one scope's wire schemas and names for prompt-order validation.
  * Restrictions do not make known tools invalid, but a mode collapse does.
  */
  wireSchemas(scope) {
    const view = this.view(scope);
    const mode = this.modeFor(scope);
    if (mode === "native") return {
      schemas: [...view.visible.values()].map((definition) => this.schemaOf(definition, false)),
      knownNames: [...view.knownNames]
    };
    this.requireCodeRuntime(mode);
    const schemas = [...view.visible.values()].map((definition) => this.schemaOf(definition, false));
    if (mode === "code") return {
      schemas: schemas.filter((schema) => schema.name === RUN_CODE_NAME),
      knownNames: [RUN_CODE_NAME]
    };
    return {
      schemas,
      knownNames: [...view.knownNames, RUN_CODE_NAME]
    };
  }
  /**
  * Resolve the code runtime or throw the actionable misconfiguration error.
  * Read at use time (assembly / run_code execution), NOT via static
  * `inject`: an inject entry would hold `ctx.tools` — and every tool plugin
  * behind it — hostage to a code runtime existing even under `mode:
  * 'native'` (the loop's optional-backend idiom, same as
  * `sessionPersistence`).
  *
  * Assembly and `run_code` execution read separately, so the language is not
  * bound to a request. Harmless while one published backend exists — both
  * reads return the same flavor — but a reload that swapped in a second
  * language between them would hand a program written against one SDK to the
  * other. Binding it is deferred until a second backend ships (the first
  * point it is testable); rationale in the
  * [language-dispatch note](../../../../.agents/notes/implemented/feature/2026-07-31-code-mode-language-dispatch.md).
  */
  requireCodeRuntime(mode) {
    const runtime = this.ctx.get("codeRuntime");
    if (!runtime) throw new Error(`dsh-tools: mode "${mode}" requires a code runtime \u2014 load a ctx.codeRuntime implementation (e.g. @deepseek-ai/dsh-code-runtime-worker) or set tools mode to "native"`);
    if (!Object.hasOwn(SDK_RENDERERS, runtime.language)) {
      const known = Object.keys(SDK_RENDERERS).map((name2) => JSON.stringify(name2)).join(", ");
      throw new Error(`dsh-tools: no SDK renderer registered for runtime language ${JSON.stringify(runtime.language)} (known: ${known})`);
    }
    return runtime;
  }
  /**
  * Register globally or in the calling agent scope. Scoped tools shadow
  * globals; duplicates within one layer and the reserved `run_code` name fail.
  * @param definition - tool schema, execution, and optional finalization/presentation callbacks.
  * @returns the exact disposer that unregisters the tool.
  */
  register(definition) {
    const name2 = definition.name;
    const output = definition.output;
    if (output === void 0 || typeof output !== "object" || typeof output.render !== "function" || output.presentationMeta !== void 0 && typeof output.presentationMeta !== "function") throw new TypeError(`tool "${name2}" must declare output { schema, render, presentationMeta? }`);
    assertSupportedJsonSchema(output.schema);
    const timeoutMs = definition.timeoutMs;
    if (timeoutMs !== void 0 && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) throw new TypeError(`tool "${name2}" timeoutMs must be a positive finite number`);
    if (name2 === "run_code") throw new Error(`tool name "${RUN_CODE_NAME}" is reserved for the Code Mode presentation transport and cannot be registered or shadowed`);
    return this.layers.effect(this.ctx, (layer) => layer.tools.insert(name2, definition), { label: "tools.register()" });
  }
  /**
  * Restrict global tools for the calling agent scope. Empty filters, unknown
  * names, scope-local names, and reserved transport names fail. Restrictions
  * intersect; scoped registrations remain visible.
  * @param filter - global-surface mask: `allow` (keep only) and/or `deny` (remove).
  * @returns the exact disposer that lifts this restriction.
  */
  restrict(filter) {
    const scope = scopeOf(this.ctx);
    if (scope === void 0) throw new Error("tools.restrict() requires a scoped context (agent.ctx): a context-global restriction would mask every agent \u2014 deny the tool for the intended agent instead");
    const allow = filter.allow;
    const deny = filter.deny;
    if (allow === void 0 && deny === void 0) throw new Error("tools.restrict({}) is a no-op: pass `allow` and/or `deny` (an empty filter is almost always a materialized-empty-config bug)");
    const compiled = {
      ...allow !== void 0 ? { allow: new Set(allow) } : {},
      ...deny !== void 0 ? { deny: new Set(deny) } : {}
    };
    if ([...allow ?? [], ...deny ?? []].includes("run_code")) throw new Error(`tools.restrict() cannot name reserved Code Mode presentation transport "${RUN_CODE_NAME}"; restrict end-capability tools instead`);
    const known = this.view(scope).restrictableNames;
    const unknown = [...allow ?? [], ...deny ?? []].filter((name2) => !known.has(name2));
    if (unknown.length > 0) throw new Error(`tools.restrict() names unknown inherited tool${unknown.length > 1 ? "s" : ""} ${unknown.map((n3) => `"${n3}"`).join(", ")}; a restriction filters what this scope inherits, never what it registers itself. Restrictable tools: ${[...known].sort().join(", ") || "(none)"}`);
    return this.layers.effect(this.ctx, (layer) => layer.restrictions.append(compiled), { label: "tools.restrict()" });
  }
  /**
  * Register a monotonic guard after the extensible `tools/pre-execute`
  * waterfall. A plain-context guard applies globally; one registered through
  * `agent.ctx` applies only to that agent. Any matching guard may deny by
  * returning a reason, while no guard can force-allow a call another guard
  * denied. The exact effect disposer is returned for ordered ownership and
  * HMR cleanup.
  * @param guard - synchronous check; a returned string denies the execution.
  * @returns the exact disposer that unregisters the guard.
  */
  guard(guard) {
    return this.layers.effect(this.ctx, (layer) => layer.guards.append(guard), {
      label: "tools.guard()",
      notify: false
    });
  }
  /** First monotonic denial from the global then the scope chain's guard layers, farthest first. */
  guardReason(exec) {
    const globalReason = this.layers.global.guardReason(exec);
    if (globalReason !== void 0) return globalReason;
    if (exec.agent === void 0) return void 0;
    for (const layer of this.layers.chainLayers(exec.agent)) {
      const reason = layer.guardReason(exec);
      if (reason !== void 0) return reason;
    }
  }
  /**
  * Resolve every registry fact one scope needs in one layer traversal. The
  * visible map applies restrictions to the INHERITED surface, then the
  * scope's own registrations and the reserved presentation transport; the
  * other sets retain the pre-restriction facts needed by restriction and
  * prompt-order validation.
  *
  * A restriction filters what a scope inherits — the global layer and every
  * ancestor layer on its chain — and never what its OWN layer registers.
  * That exemption is what a per-child capability filter has to keep intact:
  * the delegation runtime registers a child's reporting and structured-output
  * tools into the child's own layer, and a filter naming the capabilities the
  * child may use must not strip the machinery it answers through.
  *
  * Reading the exempt set as "the global layer" instead of "not mine" held
  * only while every model-facing tool sat in the host composition. Once
  * presets moved them onto the agent plane they became an ANCESTOR
  * contribution, so a child's filter silently stopped constraining anything
  * it was given.
  * @param scope - the viewing scope (the agent), or undefined for the global view.
  * @returns the complete derived view for that scope.
  */
  view(scope) {
    const layers = this.layers.chainLayers(scope);
    const own = this.layers.peek(scope);
    const inherited = new Map(this.layers.global.tools.entries());
    for (const layer of layers) {
      if (layer === own) continue;
      for (const [name2, definition] of layer.tools.entries()) inherited.set(name2, definition);
    }
    const visible = /* @__PURE__ */ new Map();
    const knownNames = /* @__PURE__ */ new Set();
    const restrictableNames = /* @__PURE__ */ new Set();
    for (const [name2, definition] of inherited) {
      knownNames.add(name2);
      restrictableNames.add(name2);
      if (layers.every((layer) => layer.admits(name2))) visible.set(name2, definition);
    }
    if (own !== void 0) for (const [name2, definition] of own.tools.entries()) {
      knownNames.add(name2);
      visible.set(name2, definition);
    }
    if (this.modeFor(scope) !== "native") visible.set(RUN_CODE_NAME, this.requireCodeTransport());
    return {
      visible,
      knownNames,
      restrictableNames
    };
  }
  /**
  * Look up a tool as one scope sees it (scoped
  * shadows global; a restricted-away global reads as absent). Presenters pass
  * the calling agent so the rendered card matches the definition that
  * actually executed.
  * @param name - the tool name as registered.
  * @param scope - the viewing scope (the agent); omitted = the global view.
  * @returns the definition the scope resolves, or undefined when none is visible.
  */
  get(name2, scope) {
    return this.view(scope).visible.get(name2);
  }
  /**
  * Project visible definitions onto the allowlisted model-facing schema fields,
  * excluding execution and presentation callbacks.
  * @param scope - the viewing scope (the agent); omitted = the global view.
  * @returns one deep-cloned schema per visible tool.
  */
  schemas(scope) {
    return [...this.view(scope).visible.values()].map((definition) => this.schemaOf(definition, true));
  }
  /** Project visible callable tools onto the generated Code Mode SDK contract. */
  sdkSchemas(scope) {
    return [...this.view(scope).visible.values()].filter((definition) => definition.name !== RUN_CODE_NAME).map((definition) => {
      const output = snapshotJsonValue(definition.output.schema);
      if (output === void 0) throw new Error(`tool "${definition.name}" output schema must be lossless JSON before SDK projection`);
      return {
        ...this.schemaOf(definition, true),
        output
      };
    });
  }
  /** Project one definition onto the model-facing schema fields. */
  schemaOf(definition, detachParameters) {
    const { name: name2, description, parameters } = definition;
    const detached = detachParameters ? snapshotJsonValue(parameters) : parameters;
    if (detached === void 0) throw new Error(`tool "${name2}" parameters must be lossless JSON before schema projection`);
    return {
      name: name2,
      description,
      parameters: detached
    };
  }
  /**
  * Classify a pending call through the caller's visible tool definition. Only
  * an exact `true` is parallel; unknown, hidden, undeclared, invalid, or
  * throwing classifiers are exclusive.
  * @param exec - call name, parsed arguments, and optional agent scope.
  * @returns the fail-closed scheduling mode.
  */
  executionMode(exec) {
    const tool = this.get(exec.name, exec.agent);
    if (!tool?.isConcurrencySafe) return { kind: "exclusive" };
    try {
      return tool.isConcurrencySafe(exec.arguments) === true ? { kind: "parallel" } : { kind: "exclusive" };
    } catch {
      return { kind: "exclusive" };
    }
  }
  /**
  * Run the `tools/code-dispatch-log` waterfall over one settled sub-dispatch
  * and return the content the bridge should log on `tool/code-dispatch`.
  * Contained: when a listener throws, the method logs the original settled
  * content; that failure must not fail the dispatch or omit the settle event. Private:
  * the ONE consumer is the `run_code` bridge this registry constructs, which
  * receives it as a capability parameter (the `requireRuntime` idiom) — the
  * waterfall, not this invoker, is the public extension point.
  */
  async shapeDispatchLog(dispatch) {
    try {
      return await this.ctx.waterfall(scopeTarget(this, dispatch.agent), "tools/code-dispatch-log", dispatch, () => Promise.resolve(dispatch.content));
    } catch (error) {
      this.ctx.logger.warn(`tools: code-dispatch-log listener failed for ${dispatch.name}: ${errorMessage(error)}; logging the original settled content`);
      return dispatch.content;
    }
  }
  /**
  * Execute through pre-policy, guards, around-dispatch, post-policy,
  * definition-owned content finalization, and final notification. Tool and
  * listener failures resolve as materialized error results; an invisible tool
  * reports `UNKNOWN_TOOL`. The returned outcome is the same lossless, frozen
  * snapshot final observers receive. Cancellation
  * arriving after entry and before final result materialization skips a
  * not-yet-started body with `ABORTED_BEFORE_DISPATCH` or replaces a
  * successful started outcome with `ABORTED`; already-started work is still
  * drained and may retain a tool-owned structured error.
  * @param exec - the typed same-process call input. The registry assigns its
  *   correlation token before policy begins.
  * @returns the materialized final result.
  */
  async execute(exec) {
    return this.prepareExecution(exec, (prepared) => this.completeScheduledExecution(prepared));
  }
  async completeScheduledExecution(prepared) {
    switch (prepared.kind) {
      case "dispatch": {
        const dispatched = await this.dispatchScheduledExecution(prepared.exec);
        return dispatched.kind === "post-result" ? await this.finalizeScheduledExecution(prepared.exec, dispatched.result) : this.finishScheduledExecution(prepared.exec, dispatched.result);
      }
      case "post-result":
        return await this.finalizeScheduledExecution(prepared.exec, prepared.result);
      case "final-result":
        return this.finishScheduledExecution(prepared.exec, prepared.result);
      /* v8 ignore next -- closed-union exhaustiveness guard */
      default:
        return assertNever(prepared, "scheduled tool preparation");
    }
  }
  createExecution(exec) {
    const deferredContexts = [];
    const token = createExecutionToken();
    const callId = exec.callId;
    const rootCallId = exec.rootCallId ?? callId;
    const name2 = exec.name;
    const agent = exec.agent;
    const parent = exec.parent;
    const signal = exec.signal;
    const definition = this.get(name2, agent);
    const finalizeContent = definition?.finalizeContent?.bind(definition);
    const concludingExecutions = this.concludingExecutions;
    const base = {
      token,
      callId,
      rootCallId,
      name: name2,
      signal,
      ...agent !== void 0 ? { agent } : {},
      ...parent !== void 0 ? { parent } : {},
      deferContext(context) {
        deferredContexts.push(context);
      },
      concludeTurn() {
        concludingExecutions.add(this);
      }
    };
    try {
      const detached = snapshotJsonValue(exec.arguments);
      if (detached === void 0) throw new TypeError("tool execution arguments must be losslessly JSON-serializable");
      const execution = {
        ...base,
        arguments: deepFreeze(detached)
      };
      this.deferredContexts.set(execution, deferredContexts);
      this.contentFinalizers.set(execution, finalizeContent);
      this.cancellationStates.set(execution, {
        callerSignal: signal,
        bodyInvoked: false
      });
      return {
        kind: "ready",
        exec: execution
      };
    } catch (error) {
      const execution = {
        ...base,
        arguments: void 0
      };
      this.contentFinalizers.set(execution, finalizeContent);
      return {
        kind: "final-result",
        exec: execution,
        result: toolErrorResult(error)
      };
    }
  }
  /**
  * Run the ordered pre-execute and monotonic guard stages for the scheduler.
  * @param input - the caller-supplied execution input.
  * @returns the prepared execution plus the next scheduler stage.
  * @internal
  */
  async prepareScheduledExecution(input) {
    return this.prepareExecution(input, (prepared) => prepared);
  }
  async prepareExecution(input, next) {
    const created = this.createExecution(input);
    if (created.kind !== "ready") return next(created);
    const exec = created.exec;
    if (this.callerCancelled(exec)) return next({
      kind: "final-result",
      exec,
      result: toolAbortedBeforeDispatchResult()
    });
    try {
      const carrier = scopeTarget(this, exec.agent);
      const gate = await this.ctx.waterfall(carrier, "tools/pre-execute", exec, () => Promise.resolve({ kind: "allow" }));
      const askResolution = gate.kind === "ask" ? await this.serviceAsk(exec, gate) : {
        decision: gate,
        approvalCancelled: false
      };
      const { decision } = askResolution;
      if (this.callerCancelled(exec) && askResolution.approvalCancelled) return await next({
        kind: "post-result",
        exec,
        result: toolAbortedBeforeDispatchResult()
      });
      const denialReason = decision.kind === "allow" ? this.guardReason(exec) : decision.reason;
      if (denialReason !== void 0) return await next({
        kind: "post-result",
        exec,
        result: this.materializeFinalResult({
          content: [{
            type: "text",
            text: `Error: ${denialReason}`
          }],
          isError: true,
          error: { message: denialReason }
        })
      });
      if (this.callerCancelled(exec)) return await next({
        kind: "post-result",
        exec,
        result: toolAbortedBeforeDispatchResult()
      });
      return await next({
        kind: "dispatch",
        exec
      });
    } catch (error) {
      return next({
        kind: "final-result",
        exec,
        result: toolErrorResult(error)
      });
    }
  }
  /** Whether the original caller signal is currently aborted. */
  callerCancelled(exec) {
    const state = this.cancellationStates.get(exec);
    if (state === void 0) throw new Error("tool registry scheduler invariant violated: missing cancellation state");
    return state.callerSignal.aborted;
  }
  /** Canonical cancellation outcome selected by whether the tool body started. */
  cancellationResult(exec, prior) {
    const state = this.cancellationStates.get(exec);
    if (state === void 0) throw new Error("tool registry scheduler invariant violated: missing cancellation state");
    return state.bodyInvoked ? toolAbortedResult(prior) : toolAbortedBeforeDispatchResult(prior);
  }
  /**
  * Dispatch the registered body with the original caller signal fused back
  * into any around-wrapper replacement. Cancellation never abandons the body:
  * a started promise reaches quiescence before its outcome becomes `ABORTED`.
  */
  async dispatchToolBody(exec) {
    const state = this.cancellationStates.get(exec);
    if (state === void 0) throw new Error("tool registry scheduler invariant violated: missing cancellation state");
    const wrapperSignal = exec.signal;
    const fused = fuseToolSignals(state.callerSignal, wrapperSignal);
    const signal = fused.signal;
    if (isAborted(signal)) {
      fused.dispose();
      return toolAbortedBeforeDispatchResult();
    }
    exec.signal = signal;
    try {
      const tool = this.get(exec.name, exec.agent);
      if (!tool) throw new ToolNotFoundError(exec.name);
      state.bodyInvoked = true;
      const returned = await tool.execute(exec.arguments, exec);
      const result = this.createSuccessResult(exec, tool, returned);
      return isAborted(signal) ? toolAbortedResult(result) : result;
    } catch (error) {
      return toolErrorResult(error);
    } finally {
      fused.dispose();
      exec.signal = wrapperSignal;
    }
  }
  /**
  * Run around-dispatch and the tool body. Tool and unknown-tool failures still
  * receive post-execute; pipeline failures are already final.
  * @param exec - the prepared execution.
  * @returns whether the result still needs post-execute.
  * @internal
  */
  async dispatchScheduledExecution(exec) {
    try {
      const mutableExec = exec;
      const carrier = scopeTarget(this, exec.agent);
      const result = await this.ctx.waterfall(carrier, "tools/execute", mutableExec, () => this.dispatchToolBody(mutableExec));
      const normalized = this.normalizeDispatchResult(exec, result);
      const deferredContexts = this.deferredContexts.get(exec);
      if (deferredContexts === void 0) throw new Error("tool registry scheduler invariant violated: unprepared execution");
      const resultWithDeferredContexts = deferredContexts.length === 0 ? normalized : this.markCanonical(exec, {
        ...normalized,
        additionalContexts: [...deferredContexts, ...normalized.additionalContexts ?? []]
      });
      return {
        kind: "post-result",
        result: this.callerCancelled(exec) && !resultWithDeferredContexts.isError ? this.cancellationResult(exec, resultWithDeferredContexts) : resultWithDeferredContexts
      };
    } catch (error) {
      return {
        kind: "final-result",
        result: toolErrorResult(error)
      };
    }
  }
  /**
  * Run ordered post-execute, then apply definition-owned content finalization,
  * materialize, and notify the final outcome.
  * @param exec - the prepared execution.
  * @param result - dispatch/pre result that still needs post-execute.
  * @returns the materialized final result.
  * @internal
  */
  async finalizeScheduledExecution(exec, result) {
    try {
      const postResult = await this.postExecute(exec, result);
      return this.finishScheduledExecution(exec, this.callerCancelled(exec) && !postResult.isError ? this.cancellationResult(exec, postResult) : postResult);
    } catch (error) {
      return this.finishScheduledExecution(exec, toolErrorResult(error));
    }
  }
  /**
  * Materialize the candidate, apply definition-owned content finalization,
  * then materialize and notify the authoritative result.
  * @param exec - the prepared execution.
  * @param result - final result.
  * @returns the materialized final result.
  * @internal
  */
  finishScheduledExecution(exec, result) {
    let materializedResult;
    try {
      materializedResult = this.materializeFinalResult(result);
    } catch (error) {
      materializedResult = this.materializeFinalResult(toolErrorResult(error));
    }
    let finalResult;
    try {
      finalResult = this.materializeFinalResult(this.applyFinalContent(exec, materializedResult));
    } catch (error) {
      finalResult = this.materializeFinalResult(toolErrorResult(error));
    }
    this.notifyResult(exec, finalResult);
    return finalResult;
  }
  /** Apply the snapshotted tool-owned content transform without exposing other result fields. */
  applyFinalContent(exec, result) {
    const finalizeContent = this.contentFinalizers.get(exec);
    if (finalizeContent === void 0) return result;
    const content = finalizeContent(exec, result);
    return content === void 0 ? result : {
      ...result,
      content
    };
  }
  /** Notify observers without exposing a mutation or error channel into the outcome. */
  notifyResult(exec, result) {
    Object.freeze(exec);
    const { name: toolName, callId } = exec;
    const reportFailure = (error) => {
      this.ctx.logger.warn(`tool "${toolName}" (${callId}): tools/result observer failed: ${errorMessage(error)}`);
    };
    const callbacks = this.ctx.events.dispatch("emit", [
      scopeTarget(this, exec.agent),
      "tools/result",
      exec,
      result
    ]);
    for (const callback of callbacks) try {
      const returned = callback(exec, result);
      Promise.resolve(returned).catch(reportFailure);
    } catch (error) {
      reportFailure(error);
    }
  }
  /**
  * Resolve an `ask` decision to allow/deny through the approval seam. The
  * seam is consumed opportunistically with `ctx.get('approval')` — a
  * deployment that composes no ApprovalService keeps the historical degrade
  * to deny, and an unmount mid-session degrades the same way on the next ask.
  * An agent-less execution also degrades: without an agent there is no
  * session to audit to and no UI to route to. Otherwise the outcome maps
  * one-to-one — `allowed-once` proceeds; the three non-grants deny with
  * distinct reasons so the model can tell a human "no" from an absent
  * approval channel.
  */
  async serviceAsk(exec, ask) {
    const approval = this.ctx.get("approval");
    if (approval === void 0) return {
      decision: {
        kind: "deny",
        reason: ask.reason ?? `tool "${exec.name}" requires approval (not yet supported)`
      },
      approvalCancelled: false
    };
    if (exec.agent === void 0) return {
      decision: {
        kind: "deny",
        reason: `tool "${exec.name}" requires approval, but the call has no agent to route it through`
      },
      approvalCancelled: false
    };
    const outcome = await approval.request({
      agent: exec.agent,
      toolName: exec.name,
      callId: exec.callId,
      ...ask.reason !== void 0 ? { reason: ask.reason } : {},
      signal: exec.signal
    });
    switch (outcome) {
      case "allowed-once":
        return {
          decision: { kind: "allow" },
          approvalCancelled: false
        };
      case "rejected":
        return {
          decision: {
            kind: "deny",
            reason: `the user rejected tool "${exec.name}"`
          },
          approvalCancelled: false
        };
      case "cancelled":
        return {
          decision: {
            kind: "deny",
            reason: `approval for tool "${exec.name}" was cancelled`
          },
          approvalCancelled: true
        };
      case "unavailable":
        return {
          decision: {
            kind: "deny",
            reason: `tool "${exec.name}" requires approval, but no approval channel is available`
          },
          approvalCancelled: false
        };
      default:
        return assertNever(outcome, "ApprovalOutcome");
    }
  }
  /**
  * Run the `tools/post-execute` waterfall over a dispatched `result` and apply
  * its {@link PostToolDecision}: `accept` keeps the call successful (replacing
  * `content` when given), `block` turns it into an `isError` whose content is
  * the corrective `feedback`. Either decision may attach `additionalContexts`,
  * which are ferried on the returned result for the loop's active-batch FIFO.
  * Context deferred by the tool body survives an accepted result but is
  * discarded when the outer call is blocked; a block exposes only context the
  * blocking decision explicitly supplied.
  * Runs inside `execute`'s outer try/catch (a throwing listener → isError).
  */
  async postExecute(exec, result) {
    const decision = await this.ctx.waterfall(scopeTarget(this, exec.agent), "tools/post-execute", exec, result, () => Promise.resolve({ kind: "accept" }));
    const decisionContexts = decision.additionalContexts ?? [];
    if (decision.kind === "block") {
      const message = failureMessageFromContent(decision.feedback);
      return this.markCanonical(exec, {
        content: decision.feedback,
        isError: true,
        error: { message },
        ...decisionContexts.length > 0 ? { additionalContexts: decisionContexts } : {}
      });
    }
    if (Object.hasOwn(decision, "content") && Object.hasOwn(decision, "value")) throw new TypeError("tools/post-execute accept decision cannot replace both value and content");
    const additionalContexts = [...result.additionalContexts ?? [], ...decisionContexts];
    if (Object.hasOwn(decision, "value")) {
      if (result.isError) throw new TypeError("tools/post-execute cannot replace the value of a failed result");
      const tool = this.get(exec.name, exec.agent);
      if (tool === void 0) throw new ToolNotFoundError(exec.name);
      const replaced = this.createSuccessResult(exec, tool, decision.value);
      return this.markCanonical(exec, {
        ...replaced,
        ...additionalContexts.length > 0 ? { additionalContexts } : {}
      });
    }
    return this.markCanonical(exec, {
      ...result,
      ...decision.content !== void 0 ? { content: decision.content } : {},
      ...additionalContexts.length > 0 ? { additionalContexts } : {}
    });
  }
  /** Registry-normalized results and the exact dispatch that validated each value. */
  canonicalResults = /* @__PURE__ */ new WeakMap();
  /** Mark one registry-normalized result as canonical only for its owning dispatch. */
  markCanonical(exec, result) {
    this.canonicalResults.set(result, exec.token);
    return result;
  }
  /** Snapshot, validate, render, and optionally project one successful body value. */
  createSuccessResult(exec, tool, candidate) {
    const detached = snapshotToolValue(tool.name, candidate);
    const violations = validateJsonSchemaValue(tool.output.schema, detached, "value");
    if (violations.length > 0) throw new ToolOutputError(tool.name, violations);
    const value = deepFreeze(detached);
    let rendered;
    try {
      rendered = tool.output.render(exec.arguments, value);
    } catch (error) {
      throw projectionError(tool.name, "render", error);
    }
    const content = snapshotProjection(tool.name, "render", rendered);
    let meta;
    if (exec.parent === void 0 && tool.output.presentationMeta !== void 0) {
      let projected;
      try {
        projected = tool.output.presentationMeta(exec.arguments, value);
      } catch (error) {
        throw projectionError(tool.name, "presentationMeta", error);
      }
      meta = snapshotProjection(tool.name, "presentationMeta", projected);
    }
    const concludesTurn = this.concludingExecutions.has(exec);
    return this.markCanonical(exec, this.materializeFinalResult({
      isError: false,
      value,
      content,
      ...meta !== void 0 ? { meta } : {},
      ...concludesTurn ? { concludesTurn: true } : {}
    }));
  }
  /** Normalize an around-dispatch wrapper's authored result through the owning output contract. */
  normalizeDispatchResult(exec, result) {
    if (this.canonicalResults.get(result) === exec.token) return result;
    if (result.isError) return this.markCanonical(exec, {
      isError: true,
      error: result.error,
      content: result.content,
      ...result.meta !== void 0 ? { meta: result.meta } : {},
      ...result.additionalContexts !== void 0 ? { additionalContexts: result.additionalContexts } : {}
    });
    const tool = this.get(exec.name, exec.agent);
    if (tool === void 0) throw new ToolNotFoundError(exec.name);
    const normalized = this.createSuccessResult(exec, tool, result.value);
    return this.markCanonical(exec, {
      ...normalized,
      ...result.additionalContexts !== void 0 ? { additionalContexts: result.additionalContexts } : {}
    });
  }
  /** Materialize the authoritative commit outcome once, immediately before `tools/result`. */
  materializeFinalResult(result) {
    const presentation = {
      content: result.content,
      ...result.meta !== void 0 ? { meta: result.meta } : {},
      ...result.additionalContexts !== void 0 ? { additionalContexts: result.additionalContexts } : {}
    };
    if (result.isError) return materializePresentation({
      isError: true,
      error: result.error,
      ...presentation
    });
    return deepFreeze({
      ...materializePresentation({
        isError: false,
        ...presentation,
        ...result.concludesTurn === true ? { concludesTurn: true } : {}
      }),
      value: result.value
    });
  }
};
function createExecutionToken() {
  return /* @__PURE__ */ Symbol("dsh.tool.execution");
}
function toolErrorResult(error) {
  const info = errorInfo(error);
  const message = errorMessage(error);
  return {
    content: [{
      type: "text",
      text: `Error: ${message}`
    }],
    isError: true,
    error: {
      message,
      ...info ? { info } : {}
    }
  };
}
function isAborted(signal) {
  return signal.aborted;
}
function fuseToolSignals(caller, wrapper) {
  if (caller === wrapper) return {
    signal: caller,
    dispose() {
    }
  };
  const controller = new AbortController();
  let listening = false;
  const dispose = () => {
    if (!listening) return;
    listening = false;
    caller.removeEventListener("abort", abortFromCaller);
    wrapper.removeEventListener("abort", abortFromWrapper);
  };
  const abortFrom = (source) => {
    const reason = source.reason;
    controller.abort(reason);
    dispose();
  };
  const abortFromCaller = () => {
    abortFrom(caller);
  };
  const abortFromWrapper = () => {
    abortFrom(wrapper);
  };
  if (wrapper.aborted) abortFromWrapper();
  else if (caller.aborted) abortFromCaller();
  else {
    listening = true;
    caller.addEventListener("abort", abortFromCaller, { once: true });
    wrapper.addEventListener("abort", abortFromWrapper, { once: true });
  }
  return {
    signal: controller.signal,
    dispose
  };
}
function toolAbortedResult(prior) {
  const additionalContexts = prior?.additionalContexts ?? [];
  return {
    content: [{
      type: "text",
      text: "Error: tool call aborted"
    }],
    isError: true,
    error: {
      message: "tool call aborted",
      info: {
        name: "AbortError",
        code: TOOL_ABORTED
      }
    },
    ...additionalContexts.length > 0 ? { additionalContexts } : {}
  };
}
function toolAbortedBeforeDispatchResult(prior) {
  const additionalContexts = prior?.additionalContexts ?? [];
  return {
    content: [{
      type: "text",
      text: "Error: tool call aborted before dispatch"
    }],
    isError: true,
    error: {
      message: "tool call aborted before dispatch",
      info: {
        name: "AbortError",
        code: TOOL_ABORTED_BEFORE_DISPATCH
      }
    },
    ...additionalContexts.length > 0 ? { additionalContexts } : {}
  };
}

// plugin-src/toolkit-tools.ts
var ENTITY_TYPES = [
  "entry-kind",
  "macro-kind",
  "entry-package",
  "macro-package",
  "entry",
  "macro",
  "relationship",
  "library"
];
function object(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("tool input must be an object");
  }
  return input;
}
function requiredString(value, name2) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name2} must be a non-empty string`);
  return value;
}
function entityType(value) {
  if (!ENTITY_TYPES.includes(value)) {
    throw new TypeError(`entityType must be one of: ${ENTITY_TYPES.join(", ")}`);
  }
  return value;
}
var entityTypeSchema = { type: "string", enum: [...ENTITY_TYPES] };
var baseProperties = { root: { type: "string", description: "Absolute path to the workspace root." }, entityType: entityTypeSchema };
function createToolkitTools(adapter) {
  return [
    {
      name: "snl_entities_list",
      description: "List or search one kind of SNL entity in a workspace.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["root", "entityType"],
        properties: { ...baseProperties, query: { type: "string" }, cursor: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 200 } }
      },
      async execute(raw) {
        const input = object(raw);
        const request = {
          root: requiredString(input.root, "root"),
          entityType: entityType(input.entityType),
          ...input.query !== void 0 ? { query: requiredString(input.query, "query") } : {},
          ...input.cursor !== void 0 ? { cursor: requiredString(input.cursor, "cursor") } : {},
          ...input.limit !== void 0 ? { limit: input.limit } : {}
        };
        if (request.limit !== void 0 && (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > 200)) {
          throw new TypeError("limit must be an integer from 1 through 200");
        }
        return adapter.list(request);
      }
    },
    {
      name: "snl_entity_get",
      description: "Read one SNL entity and its revision token.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["root", "entityType", "id"],
        properties: { ...baseProperties, id: { type: "string" } }
      },
      async execute(raw) {
        const input = object(raw);
        return adapter.get({
          root: requiredString(input.root, "root"),
          entityType: entityType(input.entityType),
          id: requiredString(input.id, "id")
        });
      }
    },
    {
      name: "snl_entity_apply",
      description: "Create, update, or delete one SNL entity through the authoritative entity adapter.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["root", "entityType", "action"],
        properties: {
          ...baseProperties,
          action: { type: "string", enum: ["create", "update", "delete"] },
          id: { type: "string" },
          value: { type: "object" },
          expectedRevision: { type: "string" }
        }
      },
      async execute(raw) {
        const input = object(raw);
        if (!["create", "update", "delete"].includes(input.action)) {
          throw new TypeError("action must be create, update, or delete");
        }
        return adapter.apply({
          root: requiredString(input.root, "root"),
          entityType: entityType(input.entityType),
          action: input.action,
          ...input.id !== void 0 ? { id: requiredString(input.id, "id") } : {},
          ...input.value !== void 0 ? { value: object(input.value) } : {},
          ...input.expectedRevision !== void 0 ? { expectedRevision: requiredString(input.expectedRevision, "expectedRevision") } : {}
        });
      }
    },
    {
      name: "snl_workspace_validate",
      description: "Validate an SNL workspace and return structured issues without modifying it.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["root"],
        properties: { root: baseProperties.root }
      },
      async execute(raw) {
        const input = object(raw);
        return adapter.validate({ root: requiredString(input.root, "root") });
      }
    }
  ];
}

// plugin-src/mcp-server.ts
import { pathToFileURL } from "node:url";
import { resolve as resolve5 } from "node:path";

// lib/entity-crud.ts
import { createHash as createHash2, randomUUID as randomUUID3 } from "node:crypto";
import { constants as constants4, promises as fs4 } from "node:fs";
import path6 from "node:path";

// lib/entity-storage.ts
import { createHash } from "node:crypto";
var PACKAGE_STORAGE_VERSION = 1;
var ENTRY_STORAGE_VERSION = 1;
var MACRO_STORAGE_VERSION = 1;
var CURRENT_PACKAGE_SCHEMA_VERSION = 2;
var CURRENT_ENTRY_SCHEMA_VERSION = 1;
var CURRENT_MACRO_SCHEMA_VERSION = 1;
var UNPACKAGED_PACKAGE_ID = "_unpackaged";
function semanticDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function makeEntityStorageReceipt(entries, macroPackages, legacyBackupPresent) {
  const entryList = Array.isArray(entries) ? entries : [];
  const packages = [...macroPackages].sort(([left], [right]) => left.localeCompare(right));
  return {
    legacy_backup_present: legacyBackupPresent,
    legacy_entries_present: legacyBackupPresent && Array.isArray(entries),
    entry_count: entryList.length,
    macro_package_count: packages.length,
    macro_count: packages.reduce((count, [, value]) => count + (value && typeof value === "object" && !Array.isArray(value) && value.macros && typeof value.macros === "object" && !Array.isArray(value.macros) ? Object.keys(value.macros).length : 0), 0),
    entries_digest: semanticDigest(entryList),
    macro_packages_digest: semanticDigest(packages)
  };
}
var PACKAGE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
var WINDOWS_DEVICE_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
function assertPackageId(packageId) {
  if (packageId !== UNPACKAGED_PACKAGE_ID && (!PACKAGE_ID_RE.test(packageId) || packageId.toLowerCase().endsWith(".json"))) {
    throw new Error(
      `Package id ${JSON.stringify(packageId)} must be 1-64 ASCII letters, digits, dots, underscores, or hyphens, start with a letter or digit, and not end in .json.`
    );
  }
  if (WINDOWS_DEVICE_RE.test(packageId)) {
    throw new Error(`Package id ${JSON.stringify(packageId)} is a reserved Windows device name.`);
  }
}
function entityIdentityHash(kind, ...segments) {
  if (segments.some((segment) => segment.includes("\0"))) {
    throw new Error("Entity identities may not contain NUL characters.");
  }
  return createHash("sha256").update(Buffer.from(`snl-doc/v1\0${kind}\0${segments.join("\0")}`, "utf8")).digest("hex").slice(0, 20);
}
function packageManifestPath(packageId) {
  assertPackageId(packageId);
  return `packages/${packageId}-${entityIdentityHash("package", packageId)}.json`;
}
function entryEntityPath(packageId, entryId) {
  assertPackageId(packageId);
  if (!entryId) throw new Error("Entry id must be non-empty.");
  return `entries/${packageId}-${entityIdentityHash("entry", packageId, entryId)}.json`;
}
function macroEntityPath(packageId, macroName) {
  assertPackageId(packageId);
  if (!macroName) throw new Error("Macro name must be non-empty.");
  return `macros/${packageId}-${entityIdentityHash("macro", packageId, macroName)}.json`;
}
function assertCompatibleSchemaMarker(value, current, label) {
  if (!Object.hasOwn(value, "schema_version")) return;
  if (!Number.isInteger(value.schema_version) || value.schema_version < 1) {
    throw new Error(`${label} schema_version must be a positive integer.`);
  }
  if (value.schema_version > current) {
    throw new Error(
      `${label} schema version ${String(value.schema_version)} is newer than this Toolkit supports (${current}).`
    );
  }
  if (value.schema_version < current) {
    throw new Error(
      `${label} schema_version ${String(value.schema_version)} has no registered migration to ${current}.`
    );
  }
}

// lib/snl-doc.ts
import { constants, promises as fs } from "node:fs";
import * as path2 from "node:path";

// node_modules/@sjtu-ai4math/snl-basics/dist-lib/chunks/semantic-resolver-BQc3L6kb.js
function t(e, t3) {
  return {
    macro_name: e,
    kind: t3?.kind ?? "",
    mdata: t3?.mdata ?? null,
    children: t3?.children ?? []
  };
}
function n() {
  return t("");
}
var o = /^[A-Za-z0-9_\\]$/;
var s = /^[A-Za-z0-9_.-]$/;
var c = /[\p{White_Space}\p{Cc}\p{Cf}\p{Cs}]/u;
function l(e, t3) {
  let n3 = e.codePointAt(t3);
  return n3 === void 0 ? null : String.fromCodePoint(n3);
}
function u(e, t3, n3) {
  let r3 = l(e, t3);
  return r3 === null ? 0 : r3.codePointAt(0) <= 127 ? +!!(n3 ? o : s).test(r3) : c.test(r3) ? 0 : r3.length;
}
function d(e) {
  if (e.length === 0) return false;
  let t3 = 0, n3 = u(e, t3, true);
  if (n3 === 0) return false;
  for (t3 += n3; t3 < e.length; ) {
    if (n3 = u(e, t3, false), n3 === 0) return false;
    t3 += n3;
  }
  return true;
}
var h = class extends Error {
  position;
  constructor(e, t3) {
    super(`${e} at position ${t3}`), this.name = "SnlSyntaxTreeParseError", this.position = t3;
  }
};
function g(e, t3) {
  let n3 = e.length - t3;
  if (n3 >= 2 && e[t3] === "`") {
    let n4 = e.indexOf("`", t3 + 1);
    if (n4 < 0) throw new h("Unclosed ` delimiter", t3);
    return {
      token: {
        type: "BACKTICK_DELIMITED",
        value: e.slice(t3 + 1, n4),
        position: t3
      },
      next: n4 + 1
    };
  }
  if (n3 >= 4 && e[t3] === "$" && e[t3 + 1] === "$") {
    let n4 = e.indexOf("$$", t3 + 2);
    if (n4 < 0) throw new h("Unclosed $$ delimiter", t3);
    return {
      token: {
        type: "DOLLAR2_DELIMITED",
        value: e.slice(t3 + 2, n4),
        position: t3
      },
      next: n4 + 2
    };
  }
  if (n3 >= 2 && e[t3] === "$") {
    let n4 = e.indexOf("$", t3 + 1);
    if (n4 < 0) throw new h("Unclosed $ delimiter", t3);
    return {
      token: {
        type: "DOLLAR_DELIMITED",
        value: e.slice(t3 + 1, n4),
        position: t3
      },
      next: n4 + 1
    };
  }
  if (n3 >= 2 && e[t3] === "%") {
    let n4 = e.indexOf("%", t3 + 1);
    if (n4 < 0) throw new h("Unclosed % delimiter", t3);
    return {
      token: {
        type: "PERCENT_DELIMITED",
        value: e.slice(t3 + 1, n4),
        position: t3
      },
      next: n4 + 1
    };
  }
  return null;
}
function _(e) {
  let t3 = [], n3 = 0;
  for (; n3 < e.length; ) {
    let r3 = e[n3];
    if (/[ \t\r\n\f\v]/.test(r3)) {
      n3 += 1;
      continue;
    }
    if (r3 === "%" || r3 === "$" || r3 === "`") {
      let r4 = g(e, n3);
      if (r4) {
        t3.push(r4.token), n3 = r4.next;
        continue;
      }
    }
    if (r3 === "@") {
      t3.push({
        type: "AT",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (r3 === "#") {
      t3.push({
        type: "HASH",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    let i4 = u(e, n3, true);
    if (i4 > 0) {
      let r4 = n3;
      for (n3 += i4; n3 < e.length; ) {
        let t4 = u(e, n3, false);
        if (t4 === 0) break;
        n3 += t4;
      }
      t3.push({
        type: "IDENT",
        value: e.slice(r4, n3),
        position: r4
      });
      continue;
    }
    if (r3 === "[") {
      t3.push({
        type: "LBRACKET",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (r3 === "]") {
      t3.push({
        type: "RBRACKET",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (r3 === "(") {
      t3.push({
        type: "LPAREN",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (r3 === ")") {
      t3.push({
        type: "RPAREN",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (r3 === ",") {
      t3.push({
        type: "COMMA",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (r3 === "=") {
      t3.push({
        type: "EQ",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (/\d/.test(r3)) {
      let r4 = n3;
      for (; n3 < e.length && /\d/.test(e[n3]); ) n3 += 1;
      t3.push({
        type: "NUMBER",
        value: e.slice(r4, n3),
        position: r4
      });
      continue;
    }
    throw new h(`Unexpected character "${r3}"`, n3);
  }
  return t3.push({
    type: "EOF",
    value: "",
    position: e.length
  }), t3;
}
var v = class {
  cursor = 0;
  tokens;
  constructor(e) {
    this.tokens = e;
  }
  parse() {
    let e = this.parseNode();
    return this.expect("EOF"), e;
  }
  parseNode() {
    let e = this.peek().type === "AT";
    e && this.consume("AT");
    let n3 = this.peek(), r3;
    if (n3.type === "IDENT") this.consume("IDENT"), r3 = t(n3.value);
    else if (n3.type === "PERCENT_DELIMITED") this.consume("PERCENT_DELIMITED"), r3 = t(n3.value), r3.env_mode = "text";
    else if (n3.type === "DOLLAR_DELIMITED") this.consume("DOLLAR_DELIMITED"), r3 = t(n3.value), r3.env_mode = "formula_inline";
    else if (n3.type === "DOLLAR2_DELIMITED") this.consume("DOLLAR2_DELIMITED"), r3 = t(n3.value), r3.env_mode = "formula_display";
    else if (n3.type === "BACKTICK_DELIMITED") this.consume("BACKTICK_DELIMITED"), r3 = t(n3.value), r3.env_mode = "formula_inline", r3.temporary_format = "texttt";
    else throw new h(`Expected macro name (IDENT or %\u2026% / $\u2026$ / $$\u2026$$) but got ${n3.type}`, n3.position);
    if (this.peek().type === "AT") if (this.consume("AT"), this.peek().type === "HASH") {
      if (e) throw new h("Binder name override must not use #", this.peek().position);
      this.consume("HASH");
      let t3 = this.expect("IDENT");
      /^\d+(?:\.\d+)*$/.test(t3.value) ? r3.postfix = {
        type: "tree_path",
        path: t3.value.split(".").map(Number)
      } : r3.postfix = {
        type: "binder_name",
        name: t3.value
      };
    } else {
      let t3 = this.expect("IDENT");
      e ? r3.binder_name = t3.value : r3.postfix = {
        type: "name",
        name: t3.value
      };
    }
    if (this.peek().type === "LBRACKET") {
      this.consume("LBRACKET");
      let e2 = this.expect("IDENT");
      r3.style_name = e2.value, this.expect("RBRACKET");
    }
    if (this.peek().type === "LPAREN" && (this.consume("LPAREN"), r3.children = this.parseNodeList(), this.expect("RPAREN")), e) {
      if (r3.children.length > 0) throw new h("Binder must be a leaf", n3.position);
      r3.binder_explicit = true, r3.kind = "binder";
    }
    return r3;
  }
  parseNodeList() {
    if (this.peek().type === "RPAREN") return [];
    let e = [this.parseArgument()];
    for (; this.peek().type === "COMMA"; ) this.consume("COMMA"), e.push(this.parseArgument());
    return e;
  }
  parseArgument() {
    let e = this.peek().type;
    return e === "COMMA" || e === "RPAREN" ? n() : this.parseNode();
  }
  expect(e) {
    let t3 = this.peek();
    if (t3.type !== e) throw new h(`Expected ${e} but got ${t3.type}`, t3.position);
    return this.cursor += 1, t3;
  }
  consume(e) {
    return this.expect(e);
  }
  peek() {
    return this.tokens[this.cursor];
  }
};
function y(e, t3 = {}) {
  let n3 = new v(_(e)).parse();
  return b(n3), n3;
}
function b(e, t3 = []) {
  e.env_mode && (e.temporary_source = e.macro_name, e.macro_name = t3.length === 0 ? "#" : `#${t3.join(".")}`), e.binder_explicit && e.binder_name === void 0 && (e.binder_name = e.temporary_source ?? e.macro_name), e.children.forEach((e2, n3) => b(e2, [...t3, n3]));
}

// node_modules/@sjtu-ai4math/snl-basics/dist-lib/chunks/source-metrics-B3zTv7qs.js
function r(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) return false;
  let t3 = e;
  if (t3.type !== "i18n" || typeof t3.default_language != "string" || !t3.values || typeof t3.values != "object" || Array.isArray(t3.values)) return false;
  let n3 = t3.values, r3 = Object.keys(n3);
  return r3.length > 0 && Object.prototype.hasOwnProperty.call(n3, t3.default_language) && typeof n3[t3.default_language] == "string" && r3.every((e2) => typeof n3[e2] == "string");
}
function i(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) return false;
  let t3 = e;
  return typeof t3.style_name != "string" || !d(t3.style_name) || "tag" in t3 || "variadic_left" in t3 || "variadic_join" in t3 || "variadic_right" in t3 || !Array.isArray(t3.tags) || !t3.tags.every((e2) => typeof e2 == "string") || t3.separator !== void 0 && typeof t3.separator != "string" || t3.block_template_name !== void 0 && (t3.mode !== "block" || typeof t3.block_template_name != "string") ? false : t3.mode === "text" ? typeof t3.template == "string" || r(t3.template) : t3.mode === "formula_inline" || t3.mode === "formula_display" || t3.mode === "block" ? typeof t3.template == "string" : false;
}
function a(e) {
  return Array.isArray(e) && e.every((e2) => typeof e2 == "string");
}
function o2(e, t3 = true) {
  if (typeof e.name != "string" || !d(e.name) || typeof e.description != "string" || typeof e.dynamic_arity != "boolean" || (t3 || e.tags !== void 0) && !a(e.tags) || e.kind !== void 0 && typeof e.kind != "string" || !e.source || typeof e.source != "object" || Array.isArray(e.source)) return false;
  let r3 = e.source;
  return a(r3.entries) && a(r3.urls);
}
function c2(e) {
  return !e || typeof e != "object" || Array.isArray(e) ? false : Object.values(e).every((e2) => typeof e2 == "string");
}
function l2(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) return false;
  let t3 = Object.getPrototypeOf(e);
  return t3 === Object.prototype || t3 === null;
}
function f(e) {
  if (!l2(e)) return false;
  for (let t3 of Object.values(e)) {
    if (!t3 || typeof t3 != "object" || Array.isArray(t3)) return false;
    let e2 = t3;
    if (!o2(e2) || !c2(e2.default_style)) return false;
    let n3 = e2.styles;
    if (!n3 || n3.length === 0 || n3.some((e3) => !i(e3) || typeof e3.template != "string")) return false;
    let r3 = n3.map((e3) => e3.style_name);
    if (new Set(r3).size !== r3.length || Object.keys(e2.default_style).some((e3) => e3.trim().length === 0) || Object.values(e2.default_style).some((e3) => !r3.includes(e3))) return false;
  }
  return true;
}
var G = 256;
function K(e, t3) {
  return e.reduce((n3, r3, i4) => i4 === 0 ? r3 : `${n3}${e[i4 - 1] !== "" && r3 !== "" ? `,${t3}` : ","}${r3}`, "");
}
var q = class {
  indentSpaces;
  inlineParenthesisDepth;
  constructor(e = 4, t3 = 3) {
    this.assertIntegerInRange(e, "indentSpaces", G), this.assertIntegerInRange(t3, "inlineParenthesisDepth", 2 ** 53 - 1), this.indentSpaces = e, this.inlineParenthesisDepth = t3;
  }
  format(e) {
    return this.formatNode(y(e), 0, " ");
  }
  formatTree(e, t3 = " ") {
    return this.formatNode(e, 0, t3);
  }
  formatNode(e, t3, n3) {
    let r3 = this.formatNodeHead(e);
    if (e.children.length === 0) return r3;
    if (this.parenthesisDepth(e) <= this.inlineParenthesisDepth) return `${r3}(${K(e.children.map((e2) => this.formatNode(e2, 0, n3)), n3)})`;
    let i4 = " ".repeat(this.indentSpaces * (t3 + 1));
    return `${r3}(
${e.children.map((e2) => `${i4}${this.formatNode(e2, t3 + 1, n3)}`).join(",\n")}
${" ".repeat(this.indentSpaces * t3)})`;
  }
  formatNodeHead(e) {
    let t3 = e.binder_explicit ? "@" : "", n3, r3 = e.temporary_source ?? e.macro_name;
    if (e.temporary_format === "texttt") n3 = `\`${r3}\``;
    else switch (e.env_mode) {
      case "text":
        n3 = `%${r3}%`;
        break;
      case "formula_inline":
        n3 = `$${r3}$`;
        break;
      case "formula_display":
        n3 = `$$${r3}$$`;
        break;
      default:
        n3 = e.macro_name;
    }
    let i4 = this.sourceReference(e), a3 = i4 === void 0 ? "" : `@${i4}`, o3 = e.style_name === void 0 ? "" : `[${e.style_name}]`;
    return `${t3}${n3}${a3}${o3}`;
  }
  sourceReference(e) {
    if (e.binder_explicit && e.binder_name && e.binder_name !== e.macro_name) return e.binder_name;
    if (e.postfix?.type === "tree_path") return `#${e.postfix.path.join(".")}`;
    if (e.postfix?.type === "binder_name") return `#${e.postfix.name}`;
    if (e.postfix?.type === "name") return e.postfix.name;
    if (!e.mdata || typeof e.mdata != "object") return;
    let t3 = e.mdata.src;
    return typeof t3 == "string" ? t3 : void 0;
  }
  assertIntegerInRange(e, t3, n3) {
    if (!Number.isSafeInteger(e) || e < 0 || e > n3) throw RangeError(`${t3} must be a non-negative integer no greater than ${n3}`);
  }
  parenthesisDepth(e) {
    let t3 = -1;
    for (let n3 of e.children) t3 = Math.max(t3, this.parenthesisDepth(n3));
    return t3 + 1;
  }
};
var J = new q(0, 2 ** 53 - 1);

// node_modules/katex/dist/katex.mjs
var ParseError = class _ParseError extends Error {
  // The underlying error message without any context added.
  constructor(message, token) {
    var error = "KaTeX parse error: " + message;
    var start;
    var end;
    var loc = token && token.loc;
    if (loc && loc.start <= loc.end) {
      var input = loc.lexer.input;
      start = loc.start;
      end = loc.end;
      if (start === input.length) {
        error += " at end of input: ";
      } else {
        error += " at position " + (start + 1) + ": ";
      }
      var underlined = input.slice(start, end).replace(/[^]/g, "$&\u0332");
      var left;
      if (start > 15) {
        left = "\u2026" + input.slice(start - 15, start);
      } else {
        left = input.slice(0, start);
      }
      var right;
      if (end + 15 < input.length) {
        right = input.slice(end, end + 15) + "\u2026";
      } else {
        right = input.slice(end);
      }
      error += left + underlined + right;
    }
    super(error);
    this.name = "ParseError";
    this.position = void 0;
    this.length = void 0;
    this.rawMessage = void 0;
    Object.setPrototypeOf(this, _ParseError.prototype);
    this.position = start;
    if (start != null && end != null) {
      this.length = end - start;
    }
    this.rawMessage = message;
  }
};
var uppercase = /([A-Z])/g;
var hyphenate2 = (str) => str.replace(uppercase, "-$1").toLowerCase();
var ESCAPE_LOOKUP = {
  "&": "&amp;",
  ">": "&gt;",
  "<": "&lt;",
  '"': "&quot;",
  "'": "&#x27;"
};
var ESCAPE_REGEX = /[&><"']/g;
var escape = (text2) => String(text2).replace(ESCAPE_REGEX, (match) => ESCAPE_LOOKUP[match]);
var getBaseElem = (group) => {
  if (group.type === "ordgroup") {
    if (group.body.length === 1) {
      return getBaseElem(group.body[0]);
    } else {
      return group;
    }
  } else if (group.type === "color") {
    if (group.body.length === 1) {
      return getBaseElem(group.body[0]);
    } else {
      return group;
    }
  } else if (group.type === "font") {
    return getBaseElem(group.body);
  } else {
    return group;
  }
};
var characterNodesTypes = /* @__PURE__ */ new Set(["mathord", "textord", "atom"]);
var isCharacterBox = (group) => characterNodesTypes.has(getBaseElem(group).type);
var protocolFromUrl = (url) => {
  var protocol = /^[\x00-\x20]*([^\\/#?]*?)(:|&#0*58|&#x0*3a|&colon)/i.exec(url);
  if (!protocol) {
    return "_relative";
  }
  if (protocol[2] !== ":") {
    return null;
  }
  if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*$/.test(protocol[1])) {
    return null;
  }
  return protocol[1].toLowerCase();
};
var SETTINGS_SCHEMA = {
  displayMode: {
    type: "boolean",
    description: "Render math in display mode, which puts the math in display style (so \\int and \\sum are large, for example), and centers the math on the page on its own line.",
    cli: "-d, --display-mode"
  },
  output: {
    type: {
      enum: ["htmlAndMathml", "html", "mathml"]
    },
    description: "Determines the markup language of the output.",
    cli: "-F, --format <type>"
  },
  leqno: {
    type: "boolean",
    description: "Render display math in leqno style (left-justified tags)."
  },
  fleqn: {
    type: "boolean",
    description: "Render display math flush left."
  },
  throwOnError: {
    type: "boolean",
    default: true,
    cli: "-t, --no-throw-on-error",
    cliDescription: "Render errors (in the color given by --error-color) instead of throwing a ParseError exception when encountering an error."
  },
  errorColor: {
    type: "string",
    default: "#cc0000",
    cli: "-c, --error-color <color>",
    cliDescription: "A color string given in the format 'rgb' or 'rrggbb' (no #). This option determines the color of errors rendered by the -t option.",
    cliProcessor: (color) => "#" + color
  },
  macros: {
    type: "object",
    cli: "-m, --macro <def>",
    cliDescription: "Define custom macro of the form '\\foo:expansion' (use multiple -m arguments for multiple macros).",
    cliDefault: [],
    cliProcessor: (def, defs) => {
      defs.push(def);
      return defs;
    }
  },
  minRuleThickness: {
    type: "number",
    description: "Specifies a minimum thickness, in ems, for fraction lines, `\\sqrt` top lines, `{array}` vertical lines, `\\hline`, `\\hdashline`, `\\underline`, `\\overline`, and the borders of `\\fbox`, `\\boxed`, and `\\fcolorbox`.",
    processor: (t3) => Math.max(0, t3),
    cli: "--min-rule-thickness <size>",
    cliProcessor: parseFloat
  },
  colorIsTextColor: {
    type: "boolean",
    description: "Makes \\color behave like LaTeX's 2-argument \\textcolor, instead of LaTeX's one-argument \\color mode change.",
    cli: "-b, --color-is-text-color"
  },
  strict: {
    type: [{
      enum: ["warn", "ignore", "error"]
    }, "boolean", "function"],
    description: "Turn on strict / LaTeX faithfulness mode, which throws an error if the input uses features that are not supported by LaTeX.",
    cli: "-S, --strict",
    cliDefault: false
  },
  trust: {
    type: ["boolean", "function"],
    description: "Trust the input, enabling all HTML features such as \\url.",
    cli: "-T, --trust"
  },
  maxSize: {
    type: "number",
    default: Infinity,
    description: "If non-zero, all user-specified sizes, e.g. in \\rule{500em}{500em}, will be capped to maxSize ems. Otherwise, elements and spaces can be arbitrarily large",
    processor: (s2) => Math.max(0, s2),
    cli: "-s, --max-size <n>",
    cliProcessor: parseInt
  },
  maxExpand: {
    type: "number",
    default: 1e3,
    description: "Limit the number of macro expansions to the specified number, to prevent e.g. infinite macro loops. If set to Infinity, the macro expander will try to fully expand as in LaTeX.",
    processor: (n3) => Math.max(0, n3),
    cli: "-e, --max-expand <n>",
    cliProcessor: (n3) => n3 === "Infinity" ? Infinity : parseInt(n3)
  },
  globalGroup: {
    type: "boolean",
    cli: false
  }
};
function getImplicitDefault(type) {
  if (typeof type !== "string") {
    return type.enum[0];
  }
  switch (type) {
    case "boolean":
      return false;
    case "string":
      return "";
    case "number":
      return 0;
    case "object":
      return {};
    default:
      throw new Error("Unexpected schema type; settings must declare an explicit default.");
  }
}
function getDefaultValue(schema) {
  if (schema.default !== void 0) {
    return schema.default;
  }
  var type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  return getImplicitDefault(type);
}
function applySetting(target, prop, options, schema) {
  var optionValue = options[prop];
  target[prop] = optionValue !== void 0 ? schema.processor ? schema.processor(optionValue) : optionValue : getDefaultValue(schema);
}
var Settings = class {
  constructor(options) {
    if (options === void 0) {
      options = {};
    }
    this.displayMode = void 0;
    this.output = void 0;
    this.leqno = void 0;
    this.fleqn = void 0;
    this.throwOnError = void 0;
    this.errorColor = void 0;
    this.macros = void 0;
    this.minRuleThickness = void 0;
    this.colorIsTextColor = void 0;
    this.strict = void 0;
    this.trust = void 0;
    this.maxSize = void 0;
    this.maxExpand = void 0;
    this.globalGroup = void 0;
    options = options || {};
    for (var prop of Object.keys(SETTINGS_SCHEMA)) {
      var schema = SETTINGS_SCHEMA[prop];
      if (schema) {
        applySetting(this, prop, options, schema);
      }
    }
  }
  /**
   * Report nonstrict (non-LaTeX-compatible) input.
   * Can safely not be called if `this.strict` is false in JavaScript.
   */
  reportNonstrict(errorCode2, errorMsg, token) {
    var strict = this.strict;
    if (typeof strict === "function") {
      strict = strict(errorCode2, errorMsg, token);
    }
    if (!strict || strict === "ignore") {
      return;
    } else if (strict === true || strict === "error") {
      throw new ParseError("LaTeX-incompatible input and strict mode is set to 'error': " + (errorMsg + " [" + errorCode2 + "]"), token);
    } else if (strict === "warn") {
      typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to 'warn': " + (errorMsg + " [" + errorCode2 + "]"));
    } else {
      typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to " + ("unrecognized '" + strict + "': " + errorMsg + " [" + errorCode2 + "]"));
    }
  }
  /**
   * Check whether to apply strict (LaTeX-adhering) behavior for unusual
   * input (like `\\`).  Unlike `nonstrict`, will not throw an error;
   * instead, "error" translates to a return value of `true`, while "ignore"
   * translates to a return value of `false`.  May still print a warning:
   * "warn" prints a warning and returns `false`.
   * This is for the second category of `errorCode`s listed in the README.
   */
  useStrictBehavior(errorCode2, errorMsg, token) {
    var strict = this.strict;
    if (typeof strict === "function") {
      try {
        strict = strict(errorCode2, errorMsg, token);
      } catch (error) {
        strict = "error";
      }
    }
    if (!strict || strict === "ignore") {
      return false;
    } else if (strict === true || strict === "error") {
      return true;
    } else if (strict === "warn") {
      typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to 'warn': " + (errorMsg + " [" + errorCode2 + "]"));
      return false;
    } else {
      typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to " + ("unrecognized '" + strict + "': " + errorMsg + " [" + errorCode2 + "]"));
      return false;
    }
  }
  /**
   * Check whether to test potentially dangerous input, and return
   * `true` (trusted) or `false` (untrusted).  The sole argument `context`
   * should be an object with `command` field specifying the relevant LaTeX
   * command (as a string starting with `\`), and any other arguments, etc.
   * If `context` has a `url` field, a `protocol` field will automatically
   * get added by this function (changing the specified object).
   */
  isTrusted(context) {
    if ("url" in context && context.url && !context.protocol) {
      var protocol = protocolFromUrl(context.url);
      if (protocol == null) {
        return false;
      }
      context.protocol = protocol;
    }
    var trust = typeof this.trust === "function" ? this.trust(context) : this.trust;
    return Boolean(trust);
  }
};
var Style = class {
  constructor(id, size, cramped) {
    this.id = void 0;
    this.size = void 0;
    this.cramped = void 0;
    this.id = id;
    this.size = size;
    this.cramped = cramped;
  }
  /**
   * Get the style of a superscript given a base in the current style.
   */
  sup() {
    return styles[sup[this.id]];
  }
  /**
   * Get the style of a subscript given a base in the current style.
   */
  sub() {
    return styles[sub[this.id]];
  }
  /**
   * Get the style of a fraction numerator given the fraction in the current
   * style.
   */
  fracNum() {
    return styles[fracNum[this.id]];
  }
  /**
   * Get the style of a fraction denominator given the fraction in the current
   * style.
   */
  fracDen() {
    return styles[fracDen[this.id]];
  }
  /**
   * Get the cramped version of a style (in particular, cramping a cramped style
   * doesn't change the style).
   */
  cramp() {
    return styles[cramp[this.id]];
  }
  /**
   * Get a text or display version of this style.
   */
  text() {
    return styles[text$1[this.id]];
  }
  /**
   * Return true if this style is tightly spaced (scriptstyle/scriptscriptstyle)
   */
  isTight() {
    return this.size >= 2;
  }
};
var D = 0;
var Dc = 1;
var T = 2;
var Tc = 3;
var S = 4;
var Sc = 5;
var SS = 6;
var SSc = 7;
var styles = [new Style(D, 0, false), new Style(Dc, 0, true), new Style(T, 1, false), new Style(Tc, 1, true), new Style(S, 2, false), new Style(Sc, 2, true), new Style(SS, 3, false), new Style(SSc, 3, true)];
var sup = [S, Sc, S, Sc, SS, SSc, SS, SSc];
var sub = [Sc, Sc, Sc, Sc, SSc, SSc, SSc, SSc];
var fracNum = [T, Tc, S, Sc, SS, SSc, SS, SSc];
var fracDen = [Tc, Tc, Sc, Sc, SSc, SSc, SSc, SSc];
var cramp = [Dc, Dc, Tc, Tc, Sc, Sc, SSc, SSc];
var text$1 = [D, Dc, T, Tc, T, Tc, T, Tc];
var Style$1 = {
  DISPLAY: styles[D],
  TEXT: styles[T],
  SCRIPT: styles[S],
  SCRIPTSCRIPT: styles[SS]
};
var scriptData = [{
  // Latin characters beyond the Latin-1 characters we have metrics for.
  // Needed for Czech, Hungarian and Turkish text, for example.
  name: "latin",
  blocks: [
    [256, 591],
    // Latin Extended-A and Latin Extended-B
    [768, 879]
    // Combining Diacritical marks
  ]
}, {
  // The Cyrillic script used by Russian and related languages.
  // A Cyrillic subset used to be supported as explicitly defined
  // symbols in symbols.js
  name: "cyrillic",
  blocks: [[1024, 1279]]
}, {
  // Armenian
  name: "armenian",
  blocks: [[1328, 1423]]
}, {
  // The Brahmic scripts of South and Southeast Asia
  // Devanagari (0900–097F)
  // Bengali (0980–09FF)
  // Gurmukhi (0A00–0A7F)
  // Gujarati (0A80–0AFF)
  // Oriya (0B00–0B7F)
  // Tamil (0B80–0BFF)
  // Telugu (0C00–0C7F)
  // Kannada (0C80–0CFF)
  // Malayalam (0D00–0D7F)
  // Sinhala (0D80–0DFF)
  // Thai (0E00–0E7F)
  // Lao (0E80–0EFF)
  // Tibetan (0F00–0FFF)
  // Myanmar (1000–109F)
  name: "brahmic",
  blocks: [[2304, 4255]]
}, {
  name: "georgian",
  blocks: [[4256, 4351]]
}, {
  // Chinese and Japanese.
  // The "k" in cjk is for Korean, but we've separated Korean out
  name: "cjk",
  blocks: [
    [12288, 12543],
    // CJK symbols and punctuation, Hiragana, Katakana
    [19968, 40879],
    // CJK ideograms
    [65280, 65376]
    // Fullwidth punctuation
    // TODO: add halfwidth Katakana and Romanji glyphs
  ]
}, {
  // Korean
  name: "hangul",
  blocks: [[44032, 55215]]
}];
function scriptFromCodepoint(codepoint) {
  for (var i4 = 0; i4 < scriptData.length; i4++) {
    var script2 = scriptData[i4];
    for (var _i6 = 0; _i6 < script2.blocks.length; _i6++) {
      var block = script2.blocks[_i6];
      if (codepoint >= block[0] && codepoint <= block[1]) {
        return script2.name;
      }
    }
  }
  return null;
}
var allBlocks = [];
scriptData.forEach((s2) => s2.blocks.forEach((b2) => allBlocks.push(...b2)));
function supportedCodepoint(codepoint) {
  for (var i4 = 0; i4 < allBlocks.length; i4 += 2) {
    if (codepoint >= allBlocks[i4] && codepoint <= allBlocks[i4 + 1]) {
      return true;
    }
  }
  return false;
}
var doubleBrushStroke = (svgPath) => svgPath + " " + svgPath;
var hLinePad = 80;
var sqrtMain = function sqrtMain2(extraVinculum, hLinePad2) {
  return "M95," + (622 + extraVinculum + hLinePad2) + "\nc-2.7,0,-7.17,-2.7,-13.5,-8c-5.8,-5.3,-9.5,-10,-9.5,-14\nc0,-2,0.3,-3.3,1,-4c1.3,-2.7,23.83,-20.7,67.5,-54\nc44.2,-33.3,65.8,-50.3,66.5,-51c1.3,-1.3,3,-2,5,-2c4.7,0,8.7,3.3,12,10\ns173,378,173,378c0.7,0,35.3,-71,104,-213c68.7,-142,137.5,-285,206.5,-429\nc69,-144,104.5,-217.7,106.5,-221\nl" + extraVinculum / 2.075 + " -" + extraVinculum + "\nc5.3,-9.3,12,-14,20,-14\nH400000v" + (40 + extraVinculum) + "H845.2724\ns-225.272,467,-225.272,467s-235,486,-235,486c-2.7,4.7,-9,7,-19,7\nc-6,0,-10,-1,-12,-3s-194,-422,-194,-422s-65,47,-65,47z\nM" + (834 + extraVinculum) + " " + hLinePad2 + "h400000v" + (40 + extraVinculum) + "h-400000z";
};
var sqrtSize1 = function sqrtSize12(extraVinculum, hLinePad2) {
  return "M263," + (601 + extraVinculum + hLinePad2) + "c0.7,0,18,39.7,52,119\nc34,79.3,68.167,158.7,102.5,238c34.3,79.3,51.8,119.3,52.5,120\nc340,-704.7,510.7,-1060.3,512,-1067\nl" + extraVinculum / 2.084 + " -" + extraVinculum + "\nc4.7,-7.3,11,-11,19,-11\nH40000v" + (40 + extraVinculum) + "H1012.3\ns-271.3,567,-271.3,567c-38.7,80.7,-84,175,-136,283c-52,108,-89.167,185.3,-111.5,232\nc-22.3,46.7,-33.8,70.3,-34.5,71c-4.7,4.7,-12.3,7,-23,7s-12,-1,-12,-1\ns-109,-253,-109,-253c-72.7,-168,-109.3,-252,-110,-252c-10.7,8,-22,16.7,-34,26\nc-22,17.3,-33.3,26,-34,26s-26,-26,-26,-26s76,-59,76,-59s76,-60,76,-60z\nM" + (1001 + extraVinculum) + " " + hLinePad2 + "h400000v" + (40 + extraVinculum) + "h-400000z";
};
var sqrtSize2 = function sqrtSize22(extraVinculum, hLinePad2) {
  return "M983 " + (10 + extraVinculum + hLinePad2) + "\nl" + extraVinculum / 3.13 + " -" + extraVinculum + "\nc4,-6.7,10,-10,18,-10 H400000v" + (40 + extraVinculum) + "\nH1013.1s-83.4,268,-264.1,840c-180.7,572,-277,876.3,-289,913c-4.7,4.7,-12.7,7,-24,7\ns-12,0,-12,0c-1.3,-3.3,-3.7,-11.7,-7,-25c-35.3,-125.3,-106.7,-373.3,-214,-744\nc-10,12,-21,25,-33,39s-32,39,-32,39c-6,-5.3,-15,-14,-27,-26s25,-30,25,-30\nc26.7,-32.7,52,-63,76,-91s52,-60,52,-60s208,722,208,722\nc56,-175.3,126.3,-397.3,211,-666c84.7,-268.7,153.8,-488.2,207.5,-658.5\nc53.7,-170.3,84.5,-266.8,92.5,-289.5z\nM" + (1001 + extraVinculum) + " " + hLinePad2 + "h400000v" + (40 + extraVinculum) + "h-400000z";
};
var sqrtSize3 = function sqrtSize32(extraVinculum, hLinePad2) {
  return "M424," + (2398 + extraVinculum + hLinePad2) + "\nc-1.3,-0.7,-38.5,-172,-111.5,-514c-73,-342,-109.8,-513.3,-110.5,-514\nc0,-2,-10.7,14.3,-32,49c-4.7,7.3,-9.8,15.7,-15.5,25c-5.7,9.3,-9.8,16,-12.5,20\ns-5,7,-5,7c-4,-3.3,-8.3,-7.7,-13,-13s-13,-13,-13,-13s76,-122,76,-122s77,-121,77,-121\ns209,968,209,968c0,-2,84.7,-361.7,254,-1079c169.3,-717.3,254.7,-1077.7,256,-1081\nl" + extraVinculum / 4.223 + " -" + extraVinculum + "c4,-6.7,10,-10,18,-10 H400000\nv" + (40 + extraVinculum) + "H1014.6\ns-87.3,378.7,-272.6,1166c-185.3,787.3,-279.3,1182.3,-282,1185\nc-2,6,-10,9,-24,9\nc-8,0,-12,-0.7,-12,-2z M" + (1001 + extraVinculum) + " " + hLinePad2 + "\nh400000v" + (40 + extraVinculum) + "h-400000z";
};
var sqrtSize4 = function sqrtSize42(extraVinculum, hLinePad2) {
  return "M473," + (2713 + extraVinculum + hLinePad2) + "\nc339.3,-1799.3,509.3,-2700,510,-2702 l" + extraVinculum / 5.298 + " -" + extraVinculum + "\nc3.3,-7.3,9.3,-11,18,-11 H400000v" + (40 + extraVinculum) + "H1017.7\ns-90.5,478,-276.2,1466c-185.7,988,-279.5,1483,-281.5,1485c-2,6,-10,9,-24,9\nc-8,0,-12,-0.7,-12,-2c0,-1.3,-5.3,-32,-16,-92c-50.7,-293.3,-119.7,-693.3,-207,-1200\nc0,-1.3,-5.3,8.7,-16,30c-10.7,21.3,-21.3,42.7,-32,64s-16,33,-16,33s-26,-26,-26,-26\ns76,-153,76,-153s77,-151,77,-151c0.7,0.7,35.7,202,105,604c67.3,400.7,102,602.7,104,\n606zM" + (1001 + extraVinculum) + " " + hLinePad2 + "h400000v" + (40 + extraVinculum) + "H1017.7z";
};
var phasePath = function phasePath2(y3) {
  var x3 = y3 / 2;
  return "M400000 " + y3 + " H0 L" + x3 + " 0 l65 45 L145 " + (y3 - 80) + " H400000z";
};
var sqrtTall = function sqrtTall2(extraVinculum, hLinePad2, viewBoxHeight) {
  var vertSegment = viewBoxHeight - 54 - hLinePad2 - extraVinculum;
  return "M702 " + (extraVinculum + hLinePad2) + "H400000" + (40 + extraVinculum) + "\nH742v" + vertSegment + "l-4 4-4 4c-.667.7 -2 1.5-4 2.5s-4.167 1.833-6.5 2.5-5.5 1-9.5 1\nh-12l-28-84c-16.667-52-96.667 -294.333-240-727l-212 -643 -85 170\nc-4-3.333-8.333-7.667-13 -13l-13-13l77-155 77-156c66 199.333 139 419.667\n219 661 l218 661zM702 " + hLinePad2 + "H400000v" + (40 + extraVinculum) + "H742z";
};
var sqrtPath = function sqrtPath2(size, extraVinculum, viewBoxHeight) {
  extraVinculum = 1e3 * extraVinculum;
  var path7 = "";
  switch (size) {
    case "sqrtMain":
      path7 = sqrtMain(extraVinculum, hLinePad);
      break;
    case "sqrtSize1":
      path7 = sqrtSize1(extraVinculum, hLinePad);
      break;
    case "sqrtSize2":
      path7 = sqrtSize2(extraVinculum, hLinePad);
      break;
    case "sqrtSize3":
      path7 = sqrtSize3(extraVinculum, hLinePad);
      break;
    case "sqrtSize4":
      path7 = sqrtSize4(extraVinculum, hLinePad);
      break;
    case "sqrtTall":
      path7 = sqrtTall(extraVinculum, hLinePad, viewBoxHeight);
  }
  return path7;
};
var innerPath = function innerPath2(name2, height) {
  switch (name2) {
    case "\u239C":
      return doubleBrushStroke("M291 0 H417 V" + height + " H291z");
    case "\u2223":
      return doubleBrushStroke("M145 0 H188 V" + height + " H145z");
    case "\u2225":
      return doubleBrushStroke("M145 0 H188 V" + height + " H145z") + doubleBrushStroke("M367 0 H410 V" + height + " H367z");
    case "\u239F":
      return doubleBrushStroke("M457 0 H583 V" + height + " H457z");
    case "\u23A2":
      return doubleBrushStroke("M319 0 H403 V" + height + " H319z");
    case "\u23A5":
      return doubleBrushStroke("M263 0 H347 V" + height + " H263z");
    case "\u23AA":
      return doubleBrushStroke("M384 0 H504 V" + height + " H384z");
    case "\u23D0":
      return doubleBrushStroke("M312 0 H355 V" + height + " H312z");
    case "\u2016":
      return doubleBrushStroke("M257 0 H300 V" + height + " H257z") + doubleBrushStroke("M478 0 H521 V" + height + " H478z");
    default:
      return "";
  }
};
var path = {
  // The doubleleftarrow geometry is from glyph U+21D0 in the font KaTeX Main
  doubleleftarrow: "M262 157\nl10-10c34-36 62.7-77 86-123 3.3-8 5-13.3 5-16 0-5.3-6.7-8-20-8-7.3\n 0-12.2.5-14.5 1.5-2.3 1-4.8 4.5-7.5 10.5-49.3 97.3-121.7 169.3-217 216-28\n 14-57.3 25-88 33-6.7 2-11 3.8-13 5.5-2 1.7-3 4.2-3 7.5s1 5.8 3 7.5\nc2 1.7 6.3 3.5 13 5.5 68 17.3 128.2 47.8 180.5 91.5 52.3 43.7 93.8 96.2 124.5\n 157.5 9.3 8 15.3 12.3 18 13h6c12-.7 18-4 18-10 0-2-1.7-7-5-15-23.3-46-52-87\n-86-123l-10-10h399738v-40H218c328 0 0 0 0 0l-10-8c-26.7-20-65.7-43-117-69 2.7\n-2 6-3.7 10-5 36.7-16 72.3-37.3 107-64l10-8h399782v-40z\nm8 0v40h399730v-40zm0 194v40h399730v-40z",
  // doublerightarrow is from glyph U+21D2 in font KaTeX Main
  doublerightarrow: "M399738 392l\n-10 10c-34 36-62.7 77-86 123-3.3 8-5 13.3-5 16 0 5.3 6.7 8 20 8 7.3 0 12.2-.5\n 14.5-1.5 2.3-1 4.8-4.5 7.5-10.5 49.3-97.3 121.7-169.3 217-216 28-14 57.3-25 88\n-33 6.7-2 11-3.8 13-5.5 2-1.7 3-4.2 3-7.5s-1-5.8-3-7.5c-2-1.7-6.3-3.5-13-5.5-68\n-17.3-128.2-47.8-180.5-91.5-52.3-43.7-93.8-96.2-124.5-157.5-9.3-8-15.3-12.3-18\n-13h-6c-12 .7-18 4-18 10 0 2 1.7 7 5 15 23.3 46 52 87 86 123l10 10H0v40h399782\nc-328 0 0 0 0 0l10 8c26.7 20 65.7 43 117 69-2.7 2-6 3.7-10 5-36.7 16-72.3 37.3\n-107 64l-10 8H0v40zM0 157v40h399730v-40zm0 194v40h399730v-40z",
  // leftarrow is from glyph U+2190 in font KaTeX Main
  leftarrow: "M400000 241H110l3-3c68.7-52.7 113.7-120\n 135-202 4-14.7 6-23 6-25 0-7.3-7-11-21-11-8 0-13.2.8-15.5 2.5-2.3 1.7-4.2 5.8\n-5.5 12.5-1.3 4.7-2.7 10.3-4 17-12 48.7-34.8 92-68.5 130S65.3 228.3 18 247\nc-10 4-16 7.7-18 11 0 8.7 6 14.3 18 17 47.3 18.7 87.8 47 121.5 85S196 441.3 208\n 490c.7 2 1.3 5 2 9s1.2 6.7 1.5 8c.3 1.3 1 3.3 2 6s2.2 4.5 3.5 5.5c1.3 1 3.3\n 1.8 6 2.5s6 1 10 1c14 0 21-3.7 21-11 0-2-2-10.3-6-25-20-79.3-65-146.7-135-202\n l-3-3h399890zM100 241v40h399900v-40z",
  // overbrace is from glyphs U+23A9/23A8/23A7 in font KaTeX_Size4-Regular
  leftbrace: "M6 548l-6-6v-35l6-11c56-104 135.3-181.3 238-232 57.3-28.7 117\n-45 179-50h399577v120H403c-43.3 7-81 15-113 26-100.7 33-179.7 91-237 174-2.7\n 5-6 9-10 13-.7 1-7.3 1-20 1H6z",
  leftbraceunder: "M0 6l6-6h17c12.688 0 19.313.3 20 1 4 4 7.313 8.3 10 13\n 35.313 51.3 80.813 93.8 136.5 127.5 55.688 33.7 117.188 55.8 184.5 66.5.688\n 0 2 .3 4 1 18.688 2.7 76 4.3 172 5h399450v120H429l-6-1c-124.688-8-235-61.7\n-331-161C60.687 138.7 32.312 99.3 7 54L0 41V6z",
  // overgroup is from the MnSymbol package (public domain)
  leftgroup: "M400000 80\nH435C64 80 168.3 229.4 21 260c-5.9 1.2-18 0-18 0-2 0-3-1-3-3v-38C76 61 257 0\n 435 0h399565z",
  leftgroupunder: "M400000 262\nH435C64 262 168.3 112.6 21 82c-5.9-1.2-18 0-18 0-2 0-3 1-3 3v38c76 158 257 219\n 435 219h399565z",
  // Harpoons are from glyph U+21BD in font KaTeX Main
  leftharpoon: "M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3\n-3.3 10.2-9.5 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5\n-18.3 3-21-1.3-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7\n-196 228-6.7 4.7-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40z",
  leftharpoonplus: "M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3-3.3 10.2-9.5\n 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5-18.3 3-21-1.3\n-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7-196 228-6.7 4.7\n-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40zM0 435v40h400000v-40z\nm0 0v40h400000v-40z",
  leftharpoondown: "M7 241c-4 4-6.333 8.667-7 14 0 5.333.667 9 2 11s5.333\n 5.333 12 10c90.667 54 156 130 196 228 3.333 10.667 6.333 16.333 9 17 2 .667 5\n 1 9 1h5c10.667 0 16.667-2 18-6 2-2.667 1-9.667-3-21-32-87.333-82.667-157.667\n-152-211l-3-3h399907v-40zM93 281 H400000 v-40L7 241z",
  leftharpoondownplus: "M7 435c-4 4-6.3 8.7-7 14 0 5.3.7 9 2 11s5.3 5.3 12\n 10c90.7 54 156 130 196 228 3.3 10.7 6.3 16.3 9 17 2 .7 5 1 9 1h5c10.7 0 16.7\n-2 18-6 2-2.7 1-9.7-3-21-32-87.3-82.7-157.7-152-211l-3-3h399907v-40H7zm93 0\nv40h399900v-40zM0 241v40h399900v-40zm0 0v40h399900v-40z",
  // hook is from glyph U+21A9 in font KaTeX Main
  lefthook: "M400000 281 H103s-33-11.2-61-33.5S0 197.3 0 164s14.2-61.2 42.5\n-83.5C70.8 58.2 104 47 142 47 c16.7 0 25 6.7 25 20 0 12-8.7 18.7-26 20-40 3.3\n-68.7 15.7-86 37-10 12-15 25.3-15 40 0 22.7 9.8 40.7 29.5 54 19.7 13.3 43.5 21\n 71.5 23h399859zM103 281v-40h399897v40z",
  leftlinesegment: doubleBrushStroke("M40 281 V428 H0 V94 H40 V241 H400000 v40z"),
  leftbracketunder: doubleBrushStroke("M0 0 h120 V290 H399995 v120 H0z"),
  leftbracketover: doubleBrushStroke("M0 440 h120 V150 H399995 v-120 H0z"),
  leftmapsto: doubleBrushStroke("M40 281 V448H0V74H40V241H400000v40z"),
  // tofrom is from glyph U+21C4 in font KaTeX AMS Regular
  leftToFrom: "M0 147h400000v40H0zm0 214c68 40 115.7 95.7 143 167h22c15.3 0 23\n-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69-70-101l-7-8h399905v-40H95l7-8\nc28.7-32 52-65.7 70-101 10.7-23.3 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 265.3\n 68 321 0 361zm0-174v-40h399900v40zm100 154v40h399900v-40z",
  longequal: doubleBrushStroke("M0 50 h400000 v40H0z m0 194h40000v40H0z"),
  midbrace: "M200428 334\nc-100.7-8.3-195.3-44-280-108-55.3-42-101.7-93-139-153l-9-14c-2.7 4-5.7 8.7-9 14\n-53.3 86.7-123.7 153-211 199-66.7 36-137.3 56.3-212 62H0V214h199568c178.3-11.7\n 311.7-78.3 403-201 6-8 9.7-12 11-12 .7-.7 6.7-1 18-1s17.3.3 18 1c1.3 0 5 4 11\n 12 44.7 59.3 101.3 106.3 170 141s145.3 54.3 229 60h199572v120z",
  midbraceunder: "M199572 214\nc100.7 8.3 195.3 44 280 108 55.3 42 101.7 93 139 153l9 14c2.7-4 5.7-8.7 9-14\n 53.3-86.7 123.7-153 211-199 66.7-36 137.3-56.3 212-62h199568v120H200432c-178.3\n 11.7-311.7 78.3-403 201-6 8-9.7 12-11 12-.7.7-6.7 1-18 1s-17.3-.3-18-1c-1.3 0\n-5-4-11-12-44.7-59.3-101.3-106.3-170-141s-145.3-54.3-229-60H0V214z",
  oiintSize1: "M512.6 71.6c272.6 0 320.3 106.8 320.3 178.2 0 70.8-47.7 177.6\n-320.3 177.6S193.1 320.6 193.1 249.8c0-71.4 46.9-178.2 319.5-178.2z\nm368.1 178.2c0-86.4-60.9-215.4-368.1-215.4-306.4 0-367.3 129-367.3 215.4 0 85.8\n60.9 214.8 367.3 214.8 307.2 0 368.1-129 368.1-214.8z",
  oiintSize2: "M757.8 100.1c384.7 0 451.1 137.6 451.1 230 0 91.3-66.4 228.8\n-451.1 228.8-386.3 0-452.7-137.5-452.7-228.8 0-92.4 66.4-230 452.7-230z\nm502.4 230c0-111.2-82.4-277.2-502.4-277.2s-504 166-504 277.2\nc0 110 84 276 504 276s502.4-166 502.4-276z",
  oiiintSize1: "M681.4 71.6c408.9 0 480.5 106.8 480.5 178.2 0 70.8-71.6 177.6\n-480.5 177.6S202.1 320.6 202.1 249.8c0-71.4 70.5-178.2 479.3-178.2z\nm525.8 178.2c0-86.4-86.8-215.4-525.7-215.4-437.9 0-524.7 129-524.7 215.4 0\n85.8 86.8 214.8 524.7 214.8 438.9 0 525.7-129 525.7-214.8z",
  oiiintSize2: "M1021.2 53c603.6 0 707.8 165.8 707.8 277.2 0 110-104.2 275.8\n-707.8 275.8-606 0-710.2-165.8-710.2-275.8C311 218.8 415.2 53 1021.2 53z\nm770.4 277.1c0-131.2-126.4-327.6-770.5-327.6S248.4 198.9 248.4 330.1\nc0 130 128.8 326.4 772.7 326.4s770.5-196.4 770.5-326.4z",
  rightarrow: "M0 241v40h399891c-47.3 35.3-84 78-110 128\n-16.7 32-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20\n 11 8 0 13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7\n 39-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85\n-40.5-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5\n-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67\n 151.7 139 205zm0 0v40h399900v-40z",
  rightbrace: "M400000 542l\n-6 6h-17c-12.7 0-19.3-.3-20-1-4-4-7.3-8.3-10-13-35.3-51.3-80.8-93.8-136.5-127.5\ns-117.2-55.8-184.5-66.5c-.7 0-2-.3-4-1-18.7-2.7-76-4.3-172-5H0V214h399571l6 1\nc124.7 8 235 61.7 331 161 31.3 33.3 59.7 72.7 85 118l7 13v35z",
  rightbraceunder: "M399994 0l6 6v35l-6 11c-56 104-135.3 181.3-238 232-57.3\n 28.7-117 45-179 50H-300V214h399897c43.3-7 81-15 113-26 100.7-33 179.7-91 237\n-174 2.7-5 6-9 10-13 .7-1 7.3-1 20-1h17z",
  rightgroup: "M0 80h399565c371 0 266.7 149.4 414 180 5.9 1.2 18 0 18 0 2 0\n 3-1 3-3v-38c-76-158-257-219-435-219H0z",
  rightgroupunder: "M0 262h399565c371 0 266.7-149.4 414-180 5.9-1.2 18 0 18\n 0 2 0 3 1 3 3v38c-76 158-257 219-435 219H0z",
  rightharpoon: "M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3\n-3.7-15.3-11-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2\n-10.7 0-16.7 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58\n 69.2 92 94.5zm0 0v40h399900v-40z",
  rightharpoonplus: "M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3-3.7-15.3-11\n-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2-10.7 0-16.7\n 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58 69.2 92 94.5z\nm0 0v40h399900v-40z m100 194v40h399900v-40zm0 0v40h399900v-40z",
  rightharpoondown: "M399747 511c0 7.3 6.7 11 20 11 8 0 13-.8 15-2.5s4.7-6.8\n 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3 8.5-5.8 9.5\n-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3-64.7 57-92 95\n-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 241v40h399900v-40z",
  rightharpoondownplus: "M399747 705c0 7.3 6.7 11 20 11 8 0 13-.8\n 15-2.5s4.7-6.8 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3\n 8.5-5.8 9.5-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3\n-64.7 57-92 95-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 435v40h399900v-40z\nm0-194v40h400000v-40zm0 0v40h400000v-40z",
  righthook: "M399859 241c-764 0 0 0 0 0 40-3.3 68.7-15.7 86-37 10-12 15-25.3\n 15-40 0-22.7-9.8-40.7-29.5-54-19.7-13.3-43.5-21-71.5-23-17.3-1.3-26-8-26-20 0\n-13.3 8.7-20 26-20 38 0 71 11.2 99 33.5 0 0 7 5.6 21 16.7 14 11.2 21 33.5 21\n 66.8s-14 61.2-42 83.5c-28 22.3-61 33.5-99 33.5L0 241z M0 281v-40h399859v40z",
  rightlinesegment: doubleBrushStroke("M399960 241 V94 h40 V428 h-40 V281 H0 v-40z"),
  rightbracketunder: doubleBrushStroke("M399995 0 h-120 V290 H0 v120 H400000z"),
  rightbracketover: doubleBrushStroke("M399995 440 h-120 V150 H0 v-120 H399995z"),
  rightToFrom: "M400000 167c-70.7-42-118-97.7-142-167h-23c-15.3 0-23 .3-23\n 1 0 1.3 5.3 13.7 16 37 18 35.3 41.3 69 70 101l7 8H0v40h399905l-7 8c-28.7 32\n-52 65.7-70 101-10.7 23.3-16 35.7-16 37 0 .7 7.7 1 23 1h23c24-69.3 71.3-125 142\n-167z M100 147v40h399900v-40zM0 341v40h399900v-40z",
  // twoheadleftarrow is from glyph U+219E in font KaTeX AMS Regular
  twoheadleftarrow: "M0 167c68 40\n 115.7 95.7 143 167h22c15.3 0 23-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69\n-70-101l-7-8h125l9 7c50.7 39.3 85 86 103 140h46c0-4.7-6.3-18.7-19-42-18-35.3\n-40-67.3-66-96l-9-9h399716v-40H284l9-9c26-28.7 48-60.7 66-96 12.7-23.333 19\n-37.333 19-42h-46c-18 54-52.3 100.7-103 140l-9 7H95l7-8c28.7-32 52-65.7 70-101\n 10.7-23.333 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 71.3 68 127 0 167z",
  twoheadrightarrow: "M400000 167\nc-68-40-115.7-95.7-143-167h-22c-15.3 0-23 .3-23 1 0 1.3 5.3 13.7 16 37 18 35.3\n 41.3 69 70 101l7 8h-125l-9-7c-50.7-39.3-85-86-103-140h-46c0 4.7 6.3 18.7 19 42\n 18 35.3 40 67.3 66 96l9 9H0v40h399716l-9 9c-26 28.7-48 60.7-66 96-12.7 23.333\n-19 37.333-19 42h46c18-54 52.3-100.7 103-140l9-7h125l-7 8c-28.7 32-52 65.7-70\n 101-10.7 23.333-16 35.7-16 37 0 .7 7.7 1 23 1h22c27.3-71.3 75-127 143-167z",
  // tilde1 is a modified version of a glyph from the MnSymbol package
  tilde1: "M200 55.538c-77 0-168 73.953-177 73.953-3 0-7\n-2.175-9-5.437L2 97c-1-2-2-4-2-6 0-4 2-7 5-9l20-12C116 12 171 0 207 0c86 0\n 114 68 191 68 78 0 168-68 177-68 4 0 7 2 9 5l12 19c1 2.175 2 4.35 2 6.525 0\n 4.35-2 7.613-5 9.788l-19 13.05c-92 63.077-116.937 75.308-183 76.128\n-68.267.847-113-73.952-191-73.952z",
  // ditto tilde2, tilde3, & tilde4
  tilde2: "M344 55.266c-142 0-300.638 81.316-311.5 86.418\n-8.01 3.762-22.5 10.91-23.5 5.562L1 120c-1-2-1-3-1-4 0-5 3-9 8-10l18.4-9C160.9\n 31.9 283 0 358 0c148 0 188 122 331 122s314-97 326-97c4 0 8 2 10 7l7 21.114\nc1 2.14 1 3.21 1 4.28 0 5.347-3 9.626-7 10.696l-22.3 12.622C852.6 158.372 751\n 181.476 676 181.476c-149 0-189-126.21-332-126.21z",
  tilde3: "M786 59C457 59 32 175.242 13 175.242c-6 0-10-3.457\n-11-10.37L.15 138c-1-7 3-12 10-13l19.2-6.4C378.4 40.7 634.3 0 804.3 0c337 0\n 411.8 157 746.8 157 328 0 754-112 773-112 5 0 10 3 11 9l1 14.075c1 8.066-.697\n 16.595-6.697 17.492l-21.052 7.31c-367.9 98.146-609.15 122.696-778.15 122.696\n -338 0-409-156.573-744-156.573z",
  tilde4: "M786 58C457 58 32 177.487 13 177.487c-6 0-10-3.345\n-11-10.035L.15 143c-1-7 3-12 10-13l22-6.7C381.2 35 637.15 0 807.15 0c337 0 409\n 177 744 177 328 0 754-127 773-127 5 0 10 3 11 9l1 14.794c1 7.805-3 13.38-9\n 14.495l-20.7 5.574c-366.85 99.79-607.3 139.372-776.3 139.372-338 0-409\n -175.236-744-175.236z",
  // vec is from glyph U+20D7 in font KaTeX Main
  vec: "M377 20c0-5.333 1.833-10 5.5-14S391 0 397 0c4.667 0 8.667 1.667 12 5\n3.333 2.667 6.667 9 10 19 6.667 24.667 20.333 43.667 41 57 7.333 4.667 11\n10.667 11 18 0 6-1 10-3 12s-6.667 5-14 9c-28.667 14.667-53.667 35.667-75 63\n-1.333 1.333-3.167 3.5-5.5 6.5s-4 4.833-5 5.5c-1 .667-2.5 1.333-4.5 2s-4.333 1\n-7 1c-4.667 0-9.167-1.833-13.5-5.5S337 184 337 178c0-12.667 15.667-32.333 47-59\nH213l-171-1c-8.667-6-13-12.333-13-19 0-4.667 4.333-11.333 13-20h359\nc-16-25.333-24-45-24-59z",
  // widehat1 is a modified version of a glyph from the MnSymbol package
  widehat1: "M529 0h5l519 115c5 1 9 5 9 10 0 1-1 2-1 3l-4 22\nc-1 5-5 9-11 9h-2L532 67 19 159h-2c-5 0-9-4-11-9l-5-22c-1-6 2-12 8-13z",
  // ditto widehat2, widehat3, & widehat4
  widehat2: "M1181 0h2l1171 176c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 220h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",
  widehat3: "M1181 0h2l1171 236c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 280h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",
  widehat4: "M1181 0h2l1171 296c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 340h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",
  // widecheck paths are all inverted versions of widehat
  widecheck1: "M529,159h5l519,-115c5,-1,9,-5,9,-10c0,-1,-1,-2,-1,-3l-4,-22c-1,\n-5,-5,-9,-11,-9h-2l-512,92l-513,-92h-2c-5,0,-9,4,-11,9l-5,22c-1,6,2,12,8,13z",
  widecheck2: "M1181,220h2l1171,-176c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,153l-1167,-153h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",
  widecheck3: "M1181,280h2l1171,-236c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,213l-1167,-213h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",
  widecheck4: "M1181,340h2l1171,-296c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,273l-1167,-273h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",
  // The next ten paths support reaction arrows from the mhchem package.
  // Arrows for \ce{<-->} are offset from xAxis by 0.22ex, per mhchem in LaTeX
  // baraboveleftarrow is mostly from glyph U+2190 in font KaTeX Main
  baraboveleftarrow: "M400000 620h-399890l3 -3c68.7 -52.7 113.7 -120 135 -202\nc4 -14.7 6 -23 6 -25c0 -7.3 -7 -11 -21 -11c-8 0 -13.2 0.8 -15.5 2.5\nc-2.3 1.7 -4.2 5.8 -5.5 12.5c-1.3 4.7 -2.7 10.3 -4 17c-12 48.7 -34.8 92 -68.5 130\ns-74.2 66.3 -121.5 85c-10 4 -16 7.7 -18 11c0 8.7 6 14.3 18 17c47.3 18.7 87.8 47\n121.5 85s56.5 81.3 68.5 130c0.7 2 1.3 5 2 9s1.2 6.7 1.5 8c0.3 1.3 1 3.3 2 6\ns2.2 4.5 3.5 5.5c1.3 1 3.3 1.8 6 2.5s6 1 10 1c14 0 21 -3.7 21 -11\nc0 -2 -2 -10.3 -6 -25c-20 -79.3 -65 -146.7 -135 -202l-3 -3h399890z\nM100 620v40h399900v-40z M0 241v40h399900v-40zM0 241v40h399900v-40z",
  // rightarrowabovebar is mostly from glyph U+2192, KaTeX Main
  rightarrowabovebar: "M0 241v40h399891c-47.3 35.3-84 78-110 128-16.7 32\n-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20 11 8 0\n13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7 39\n-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85-40.5\n-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5\n-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67\n151.7 139 205zm96 379h399894v40H0zm0 0h399904v40H0z",
  // The short left harpoon has 0.5em (i.e. 500 units) kern on the left end.
  // Ref from mhchem.sty: \rlap{\raisebox{-.22ex}{$\kern0.5em
  baraboveshortleftharpoon: "M507,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11\nc1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17\nc2,0.7,5,1,9,1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21\nc-32,-87.3,-82.7,-157.7,-152,-211c0,0,-3,-3,-3,-3l399351,0l0,-40\nc-398570,0,-399437,0,-399437,0z M593 435 v40 H399500 v-40z\nM0 281 v-40 H399908 v40z M0 281 v-40 H399908 v40z",
  rightharpoonaboveshortbar: "M0,241 l0,40c399126,0,399993,0,399993,0\nc4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,\n-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6\nc-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z\nM0 241 v40 H399908 v-40z M0 475 v-40 H399500 v40z M0 475 v-40 H399500 v40z",
  shortbaraboveleftharpoon: "M7,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11\nc1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17c2,0.7,5,1,9,\n1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21c-32,-87.3,-82.7,-157.7,\n-152,-211c0,0,-3,-3,-3,-3l399907,0l0,-40c-399126,0,-399993,0,-399993,0z\nM93 435 v40 H400000 v-40z M500 241 v40 H400000 v-40z M500 241 v40 H400000 v-40z",
  shortrightharpoonabovebar: "M53,241l0,40c398570,0,399437,0,399437,0\nc4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,\n-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6\nc-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z\nM500 241 v40 H399408 v-40z M500 435 v40 H400000 v-40z"
};
var tallDelim = function tallDelim2(label, midHeight) {
  switch (label) {
    case "lbrack":
      return "M403 1759 V84 H666 V0 H319 V1759 v" + midHeight + " v1759 v84 h347 v-84\nH403z M403 1759 V0 H319 V1759 v" + midHeight + " v1759 v84 h84z";
    case "rbrack":
      return "M347 1759 V0 H0 V84 H263 V1759 v" + midHeight + " v1759 H0 v84 H347z\nM347 1759 V0 H263 V1759 v" + midHeight + " v1759 h84z";
    case "vert":
      return "M145 15 v585 v" + midHeight + " v585 c2.667,10,9.667,15,21,15\nc10,0,16.667,-5,20,-15 v-585 v" + -midHeight + " v-585 c-2.667,-10,-9.667,-15,-21,-15\nc-10,0,-16.667,5,-20,15z M188 15 H145 v585 v" + midHeight + " v585 h43z";
    case "doublevert":
      return "M145 15 v585 v" + midHeight + " v585 c2.667,10,9.667,15,21,15\nc10,0,16.667,-5,20,-15 v-585 v" + -midHeight + " v-585 c-2.667,-10,-9.667,-15,-21,-15\nc-10,0,-16.667,5,-20,15z M188 15 H145 v585 v" + midHeight + " v585 h43z\nM367 15 v585 v" + midHeight + " v585 c2.667,10,9.667,15,21,15\nc10,0,16.667,-5,20,-15 v-585 v" + -midHeight + " v-585 c-2.667,-10,-9.667,-15,-21,-15\nc-10,0,-16.667,5,-20,15z M410 15 H367 v585 v" + midHeight + " v585 h43z";
    case "lfloor":
      return "M319 602 V0 H403 V602 v" + midHeight + " v1715 h263 v84 H319z\nMM319 602 V0 H403 V602 v" + midHeight + " v1715 H319z";
    case "rfloor":
      return "M319 602 V0 H403 V602 v" + midHeight + " v1799 H0 v-84 H319z\nMM319 602 V0 H403 V602 v" + midHeight + " v1715 H319z";
    case "lceil":
      return "M403 1759 V84 H666 V0 H319 V1759 v" + midHeight + " v602 h84z\nM403 1759 V0 H319 V1759 v" + midHeight + " v602 h84z";
    case "rceil":
      return "M347 1759 V0 H0 V84 H263 V1759 v" + midHeight + " v602 h84z\nM347 1759 V0 h-84 V1759 v" + midHeight + " v602 h84z";
    case "lparen":
      return "M863,9c0,-2,-2,-5,-6,-9c0,0,-17,0,-17,0c-12.7,0,-19.3,0.3,-20,1\nc-5.3,5.3,-10.3,11,-15,17c-242.7,294.7,-395.3,682,-458,1162c-21.3,163.3,-33.3,349,\n-36,557 l0," + (midHeight + 84) + "c0.2,6,0,26,0,60c2,159.3,10,310.7,24,454c53.3,528,210,\n949.7,470,1265c4.7,6,9.7,11.7,15,17c0.7,0.7,7,1,19,1c0,0,18,0,18,0c4,-4,6,-7,6,-9\nc0,-2.7,-3.3,-8.7,-10,-18c-135.3,-192.7,-235.5,-414.3,-300.5,-665c-65,-250.7,-102.5,\n-544.7,-112.5,-882c-2,-104,-3,-167,-3,-189\nl0,-" + (midHeight + 92) + "c0,-162.7,5.7,-314,17,-454c20.7,-272,63.7,-513,129,-723c65.3,\n-210,155.3,-396.3,270,-559c6.7,-9.3,10,-15.3,10,-18z";
    case "rparen":
      return "M76,0c-16.7,0,-25,3,-25,9c0,2,2,6.3,6,13c21.3,28.7,42.3,60.3,\n63,95c96.7,156.7,172.8,332.5,228.5,527.5c55.7,195,92.8,416.5,111.5,664.5\nc11.3,139.3,17,290.7,17,454c0,28,1.7,43,3.3,45l0," + (midHeight + 9) + "\nc-3,4,-3.3,16.7,-3.3,38c0,162,-5.7,313.7,-17,455c-18.7,248,-55.8,469.3,-111.5,664\nc-55.7,194.7,-131.8,370.3,-228.5,527c-20.7,34.7,-41.7,66.3,-63,95c-2,3.3,-4,7,-6,11\nc0,7.3,5.7,11,17,11c0,0,11,0,11,0c9.3,0,14.3,-0.3,15,-1c5.3,-5.3,10.3,-11,15,-17\nc242.7,-294.7,395.3,-681.7,458,-1161c21.3,-164.7,33.3,-350.7,36,-558\nl0,-" + (midHeight + 144) + "c-2,-159.3,-10,-310.7,-24,-454c-53.3,-528,-210,-949.7,\n-470,-1265c-4.7,-6,-9.7,-11.7,-15,-17c-0.7,-0.7,-6.7,-1,-18,-1z";
    default:
      throw new Error("Unknown stretchy delimiter.");
  }
};
function isMathDomNode(node) {
  return "toText" in node;
}
var DocumentFragment = class {
  // Never used; needed for satisfying interface.
  constructor(children) {
    this.children = void 0;
    this.classes = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.maxFontSize = void 0;
    this.style = void 0;
    this.children = children;
    this.classes = [];
    this.height = 0;
    this.depth = 0;
    this.maxFontSize = 0;
    this.style = {};
  }
  hasClass(className) {
    return this.classes.includes(className);
  }
  /** Convert the fragment into a node. */
  toNode() {
    var frag = document.createDocumentFragment();
    for (var i4 = 0; i4 < this.children.length; i4++) {
      frag.appendChild(this.children[i4].toNode());
    }
    return frag;
  }
  /** Convert the fragment into HTML markup. */
  toMarkup() {
    var markup = "";
    for (var i4 = 0; i4 < this.children.length; i4++) {
      markup += this.children[i4].toMarkup();
    }
    return markup;
  }
  /**
   * Converts the math node into a string, similar to innerText. Applies to
   * MathDomNode's only.
   */
  toText() {
    return this.children.map((child) => {
      if (isMathDomNode(child)) {
        return child.toText();
      }
      throw new Error("Expected MathDomNode with toText, got " + child.constructor.name);
    }).join("");
  }
};
var ptPerUnit = {
  // https://en.wikibooks.org/wiki/LaTeX/Lengths and
  // https://tex.stackexchange.com/a/8263
  "pt": 1,
  // TeX point
  "mm": 7227 / 2540,
  // millimeter
  "cm": 7227 / 254,
  // centimeter
  "in": 72.27,
  // inch
  "bp": 803 / 800,
  // big (PostScript) points
  "pc": 12,
  // pica
  "dd": 1238 / 1157,
  // didot
  "cc": 14856 / 1157,
  // cicero (12 didot)
  "nd": 685 / 642,
  // new didot
  "nc": 1370 / 107,
  // new cicero (12 new didot)
  "sp": 1 / 65536,
  // scaled point (TeX's internal smallest unit)
  // https://tex.stackexchange.com/a/41371
  "px": 803 / 800
  // \pdfpxdimen defaults to 1 bp in pdfTeX and LuaTeX
};
var relativeUnit = {
  "ex": true,
  "em": true,
  "mu": true
};
var validUnit = function validUnit2(unit) {
  if (typeof unit !== "string") {
    unit = unit.unit;
  }
  return unit in ptPerUnit || unit in relativeUnit || unit === "ex";
};
var calculateSize = function calculateSize2(sizeValue, options) {
  var scale;
  if (sizeValue.unit in ptPerUnit) {
    scale = ptPerUnit[sizeValue.unit] / options.fontMetrics().ptPerEm / options.sizeMultiplier;
  } else if (sizeValue.unit === "mu") {
    scale = options.fontMetrics().cssEmPerMu;
  } else {
    var unitOptions;
    if (options.style.isTight()) {
      unitOptions = options.havingStyle(options.style.text());
    } else {
      unitOptions = options;
    }
    if (sizeValue.unit === "ex") {
      scale = unitOptions.fontMetrics().xHeight;
    } else if (sizeValue.unit === "em") {
      scale = unitOptions.fontMetrics().quad;
    } else {
      throw new ParseError("Invalid unit: '" + sizeValue.unit + "'");
    }
    if (unitOptions !== options) {
      scale *= unitOptions.sizeMultiplier / options.sizeMultiplier;
    }
  }
  return Math.min(sizeValue.number * scale, options.maxSize);
};
var makeEm = function makeEm2(n3) {
  return +n3.toFixed(4) + "em";
};
var createClass = function createClass2(classes) {
  return classes.filter((cls) => cls).join(" ");
};
var cssStyleToString = function cssStyleToString2(style) {
  var styles2 = "";
  for (var key of Object.keys(style)) {
    var value = style[key];
    if (value !== void 0) {
      styles2 += hyphenate2(key) + ":" + value + ";";
    }
  }
  return styles2;
};
var initNode = function initNode2(classes, options, style) {
  this.classes = classes || [];
  this.attributes = {};
  this.height = 0;
  this.depth = 0;
  this.maxFontSize = 0;
  this.style = style || {};
  if (options) {
    if (options.style.isTight()) {
      this.classes.push("mtight");
    }
    var color = options.getColor();
    if (color) {
      this.style.color = color;
    }
  }
};
var toNode = function toNode2(tagName) {
  var node = document.createElement(tagName);
  node.className = createClass(this.classes);
  Object.assign(node.style, this.style);
  for (var attr of Object.keys(this.attributes)) {
    node.setAttribute(attr, this.attributes[attr]);
  }
  for (var i4 = 0; i4 < this.children.length; i4++) {
    node.appendChild(this.children[i4].toNode());
  }
  return node;
};
var invalidAttributeNameRegex = /[\s"'>/=\x00-\x1f]/;
var toMarkup = function toMarkup2(tagName) {
  var markup = "<" + tagName;
  if (this.classes.length) {
    markup += ' class="' + escape(createClass(this.classes)) + '"';
  }
  var styles2 = cssStyleToString(this.style);
  if (styles2) {
    markup += ' style="' + escape(styles2) + '"';
  }
  for (var attr of Object.keys(this.attributes)) {
    if (invalidAttributeNameRegex.test(attr)) {
      throw new ParseError("Invalid attribute name '" + attr + "'");
    }
    markup += " " + attr + '="' + escape(this.attributes[attr]) + '"';
  }
  markup += ">";
  for (var i4 = 0; i4 < this.children.length; i4++) {
    markup += this.children[i4].toMarkup();
  }
  markup += "</" + tagName + ">";
  return markup;
};
var Span = class {
  constructor(classes, children, options, style) {
    this.children = void 0;
    this.attributes = void 0;
    this.classes = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.width = void 0;
    this.maxFontSize = void 0;
    this.style = void 0;
    this.italic = void 0;
    initNode.call(this, classes, options, style);
    this.children = children || [];
  }
  /**
   * Sets an arbitrary attribute on the span. Warning: use this wisely. Not
   * all browsers support attributes the same, and having too many custom
   * attributes is probably bad.
   */
  setAttribute(attribute, value) {
    this.attributes[attribute] = value;
  }
  hasClass(className) {
    return this.classes.includes(className);
  }
  toNode() {
    return toNode.call(this, "span");
  }
  toMarkup() {
    return toMarkup.call(this, "span");
  }
};
var Anchor = class {
  constructor(href, classes, children, options) {
    this.children = void 0;
    this.attributes = void 0;
    this.classes = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.maxFontSize = void 0;
    this.style = void 0;
    initNode.call(this, classes, options);
    this.children = children || [];
    this.setAttribute("href", href);
  }
  setAttribute(attribute, value) {
    this.attributes[attribute] = value;
  }
  hasClass(className) {
    return this.classes.includes(className);
  }
  toNode() {
    return toNode.call(this, "a");
  }
  toMarkup() {
    return toMarkup.call(this, "a");
  }
};
var Img = class {
  constructor(src, alt, style) {
    this.src = void 0;
    this.alt = void 0;
    this.classes = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.maxFontSize = void 0;
    this.style = void 0;
    this.alt = alt;
    this.src = src;
    this.classes = ["mord"];
    this.height = 0;
    this.depth = 0;
    this.maxFontSize = 0;
    this.style = style;
  }
  hasClass(className) {
    return this.classes.includes(className);
  }
  toNode() {
    var node = document.createElement("img");
    node.src = this.src;
    node.alt = this.alt;
    node.className = "mord";
    Object.assign(node.style, this.style);
    return node;
  }
  toMarkup() {
    var markup = '<img src="' + escape(this.src) + '"' + (' alt="' + escape(this.alt) + '"');
    var styles2 = cssStyleToString(this.style);
    if (styles2) {
      markup += ' style="' + escape(styles2) + '"';
    }
    markup += "'/>";
    return markup;
  }
};
var iCombinations = {
  "\xEE": "\u0131\u0302",
  "\xEF": "\u0131\u0308",
  "\xED": "\u0131\u0301",
  // 'ī': '\u0131\u0304', // enable when we add Extended Latin
  "\xEC": "\u0131\u0300"
};
var SymbolNode = class {
  constructor(text2, height, depth, italic2, skew, width, classes, style) {
    this.text = void 0;
    this.height = void 0;
    this.depth = void 0;
    this.italic = void 0;
    this.skew = void 0;
    this.width = void 0;
    this.maxFontSize = void 0;
    this.classes = void 0;
    this.style = void 0;
    this.text = text2;
    this.height = height || 0;
    this.depth = depth || 0;
    this.italic = italic2 || 0;
    this.skew = skew || 0;
    this.width = width || 0;
    this.classes = classes || [];
    this.style = style || {};
    this.maxFontSize = 0;
    var script2 = scriptFromCodepoint(this.text.charCodeAt(0));
    if (script2) {
      this.classes.push(script2 + "_fallback");
    }
    if (/[îïíì]/.test(this.text)) {
      this.text = iCombinations[this.text];
    }
  }
  hasClass(className) {
    return this.classes.includes(className);
  }
  /**
   * Creates a text node or span from a symbol node. Note that a span is only
   * created if it is needed.
   */
  toNode() {
    var node = document.createTextNode(this.text);
    var span = null;
    if (this.italic > 0) {
      span = document.createElement("span");
      span.style.marginRight = makeEm(this.italic);
    }
    if (this.classes.length > 0) {
      span = span || document.createElement("span");
      span.className = createClass(this.classes);
    }
    if (Object.keys(this.style).length > 0) {
      span = span || document.createElement("span");
      Object.assign(span.style, this.style);
    }
    if (span) {
      span.appendChild(node);
      return span;
    } else {
      return node;
    }
  }
  /**
   * Creates markup for a symbol node.
   */
  toMarkup() {
    var needsSpan = false;
    var markup = "<span";
    if (this.classes.length) {
      needsSpan = true;
      markup += ' class="';
      markup += escape(createClass(this.classes));
      markup += '"';
    }
    var styles2 = "";
    if (this.italic > 0) {
      styles2 += "margin-right:" + makeEm(this.italic) + ";";
    }
    styles2 += cssStyleToString(this.style);
    if (styles2) {
      needsSpan = true;
      markup += ' style="' + escape(styles2) + '"';
    }
    var escaped = escape(this.text);
    if (needsSpan) {
      markup += ">";
      markup += escaped;
      markup += "</span>";
      return markup;
    } else {
      return escaped;
    }
  }
};
var SvgNode = class {
  constructor(children, attributes) {
    this.children = void 0;
    this.attributes = void 0;
    this.children = children || [];
    this.attributes = attributes || {};
  }
  toNode() {
    var svgNS = "http://www.w3.org/2000/svg";
    var node = document.createElementNS(svgNS, "svg");
    for (var attr of Object.keys(this.attributes)) {
      node.setAttribute(attr, this.attributes[attr]);
    }
    for (var i4 = 0; i4 < this.children.length; i4++) {
      node.appendChild(this.children[i4].toNode());
    }
    return node;
  }
  toMarkup() {
    var markup = '<svg xmlns="http://www.w3.org/2000/svg"';
    for (var attr of Object.keys(this.attributes)) {
      markup += " " + attr + '="' + escape(this.attributes[attr]) + '"';
    }
    markup += ">";
    for (var i4 = 0; i4 < this.children.length; i4++) {
      markup += this.children[i4].toMarkup();
    }
    markup += "</svg>";
    return markup;
  }
};
var PathNode = class {
  constructor(pathName, alternate) {
    this.pathName = void 0;
    this.alternate = void 0;
    this.pathName = pathName;
    this.alternate = alternate;
  }
  toNode() {
    var svgNS = "http://www.w3.org/2000/svg";
    var node = document.createElementNS(svgNS, "path");
    if (this.alternate) {
      node.setAttribute("d", this.alternate);
    } else {
      node.setAttribute("d", path[this.pathName]);
    }
    return node;
  }
  toMarkup() {
    if (this.alternate) {
      return '<path d="' + escape(this.alternate) + '"/>';
    } else {
      return '<path d="' + escape(path[this.pathName]) + '"/>';
    }
  }
};
var LineNode = class {
  constructor(attributes) {
    this.attributes = void 0;
    this.attributes = attributes || {};
  }
  toNode() {
    var svgNS = "http://www.w3.org/2000/svg";
    var node = document.createElementNS(svgNS, "line");
    for (var attr of Object.keys(this.attributes)) {
      node.setAttribute(attr, this.attributes[attr]);
    }
    return node;
  }
  toMarkup() {
    var markup = "<line";
    for (var attr of Object.keys(this.attributes)) {
      markup += " " + attr + '="' + escape(this.attributes[attr]) + '"';
    }
    markup += "/>";
    return markup;
  }
};
function assertSymbolDomNode(group) {
  if (group instanceof SymbolNode) {
    return group;
  } else {
    throw new Error("Expected symbolNode but got " + String(group) + ".");
  }
}
function assertSpan(group) {
  if (group instanceof Span) {
    return group;
  } else {
    throw new Error("Expected span<HtmlDomNode> but got " + String(group) + ".");
  }
}
var hasHtmlDomChildren = (node) => node instanceof Span || node instanceof Anchor || node instanceof DocumentFragment;
var fontMetricsData = {
  "AMS-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "65": [0, 0.68889, 0, 0, 0.72222],
    "66": [0, 0.68889, 0, 0, 0.66667],
    "67": [0, 0.68889, 0, 0, 0.72222],
    "68": [0, 0.68889, 0, 0, 0.72222],
    "69": [0, 0.68889, 0, 0, 0.66667],
    "70": [0, 0.68889, 0, 0, 0.61111],
    "71": [0, 0.68889, 0, 0, 0.77778],
    "72": [0, 0.68889, 0, 0, 0.77778],
    "73": [0, 0.68889, 0, 0, 0.38889],
    "74": [0.16667, 0.68889, 0, 0, 0.5],
    "75": [0, 0.68889, 0, 0, 0.77778],
    "76": [0, 0.68889, 0, 0, 0.66667],
    "77": [0, 0.68889, 0, 0, 0.94445],
    "78": [0, 0.68889, 0, 0, 0.72222],
    "79": [0.16667, 0.68889, 0, 0, 0.77778],
    "80": [0, 0.68889, 0, 0, 0.61111],
    "81": [0.16667, 0.68889, 0, 0, 0.77778],
    "82": [0, 0.68889, 0, 0, 0.72222],
    "83": [0, 0.68889, 0, 0, 0.55556],
    "84": [0, 0.68889, 0, 0, 0.66667],
    "85": [0, 0.68889, 0, 0, 0.72222],
    "86": [0, 0.68889, 0, 0, 0.72222],
    "87": [0, 0.68889, 0, 0, 1],
    "88": [0, 0.68889, 0, 0, 0.72222],
    "89": [0, 0.68889, 0, 0, 0.72222],
    "90": [0, 0.68889, 0, 0, 0.66667],
    "107": [0, 0.68889, 0, 0, 0.55556],
    "160": [0, 0, 0, 0, 0.25],
    "165": [0, 0.675, 0.025, 0, 0.75],
    "174": [0.15559, 0.69224, 0, 0, 0.94666],
    "240": [0, 0.68889, 0, 0, 0.55556],
    "295": [0, 0.68889, 0, 0, 0.54028],
    "710": [0, 0.825, 0, 0, 2.33334],
    "732": [0, 0.9, 0, 0, 2.33334],
    "770": [0, 0.825, 0, 0, 2.33334],
    "771": [0, 0.9, 0, 0, 2.33334],
    "989": [0.08167, 0.58167, 0, 0, 0.77778],
    "1008": [0, 0.43056, 0.04028, 0, 0.66667],
    "8245": [0, 0.54986, 0, 0, 0.275],
    "8463": [0, 0.68889, 0, 0, 0.54028],
    "8487": [0, 0.68889, 0, 0, 0.72222],
    "8498": [0, 0.68889, 0, 0, 0.55556],
    "8502": [0, 0.68889, 0, 0, 0.66667],
    "8503": [0, 0.68889, 0, 0, 0.44445],
    "8504": [0, 0.68889, 0, 0, 0.66667],
    "8513": [0, 0.68889, 0, 0, 0.63889],
    "8592": [-0.03598, 0.46402, 0, 0, 0.5],
    "8594": [-0.03598, 0.46402, 0, 0, 0.5],
    "8602": [-0.13313, 0.36687, 0, 0, 1],
    "8603": [-0.13313, 0.36687, 0, 0, 1],
    "8606": [0.01354, 0.52239, 0, 0, 1],
    "8608": [0.01354, 0.52239, 0, 0, 1],
    "8610": [0.01354, 0.52239, 0, 0, 1.11111],
    "8611": [0.01354, 0.52239, 0, 0, 1.11111],
    "8619": [0, 0.54986, 0, 0, 1],
    "8620": [0, 0.54986, 0, 0, 1],
    "8621": [-0.13313, 0.37788, 0, 0, 1.38889],
    "8622": [-0.13313, 0.36687, 0, 0, 1],
    "8624": [0, 0.69224, 0, 0, 0.5],
    "8625": [0, 0.69224, 0, 0, 0.5],
    "8630": [0, 0.43056, 0, 0, 1],
    "8631": [0, 0.43056, 0, 0, 1],
    "8634": [0.08198, 0.58198, 0, 0, 0.77778],
    "8635": [0.08198, 0.58198, 0, 0, 0.77778],
    "8638": [0.19444, 0.69224, 0, 0, 0.41667],
    "8639": [0.19444, 0.69224, 0, 0, 0.41667],
    "8642": [0.19444, 0.69224, 0, 0, 0.41667],
    "8643": [0.19444, 0.69224, 0, 0, 0.41667],
    "8644": [0.1808, 0.675, 0, 0, 1],
    "8646": [0.1808, 0.675, 0, 0, 1],
    "8647": [0.1808, 0.675, 0, 0, 1],
    "8648": [0.19444, 0.69224, 0, 0, 0.83334],
    "8649": [0.1808, 0.675, 0, 0, 1],
    "8650": [0.19444, 0.69224, 0, 0, 0.83334],
    "8651": [0.01354, 0.52239, 0, 0, 1],
    "8652": [0.01354, 0.52239, 0, 0, 1],
    "8653": [-0.13313, 0.36687, 0, 0, 1],
    "8654": [-0.13313, 0.36687, 0, 0, 1],
    "8655": [-0.13313, 0.36687, 0, 0, 1],
    "8666": [0.13667, 0.63667, 0, 0, 1],
    "8667": [0.13667, 0.63667, 0, 0, 1],
    "8669": [-0.13313, 0.37788, 0, 0, 1],
    "8672": [-0.064, 0.437, 0, 0, 1.334],
    "8674": [-0.064, 0.437, 0, 0, 1.334],
    "8705": [0, 0.825, 0, 0, 0.5],
    "8708": [0, 0.68889, 0, 0, 0.55556],
    "8709": [0.08167, 0.58167, 0, 0, 0.77778],
    "8717": [0, 0.43056, 0, 0, 0.42917],
    "8722": [-0.03598, 0.46402, 0, 0, 0.5],
    "8724": [0.08198, 0.69224, 0, 0, 0.77778],
    "8726": [0.08167, 0.58167, 0, 0, 0.77778],
    "8733": [0, 0.69224, 0, 0, 0.77778],
    "8736": [0, 0.69224, 0, 0, 0.72222],
    "8737": [0, 0.69224, 0, 0, 0.72222],
    "8738": [0.03517, 0.52239, 0, 0, 0.72222],
    "8739": [0.08167, 0.58167, 0, 0, 0.22222],
    "8740": [0.25142, 0.74111, 0, 0, 0.27778],
    "8741": [0.08167, 0.58167, 0, 0, 0.38889],
    "8742": [0.25142, 0.74111, 0, 0, 0.5],
    "8756": [0, 0.69224, 0, 0, 0.66667],
    "8757": [0, 0.69224, 0, 0, 0.66667],
    "8764": [-0.13313, 0.36687, 0, 0, 0.77778],
    "8765": [-0.13313, 0.37788, 0, 0, 0.77778],
    "8769": [-0.13313, 0.36687, 0, 0, 0.77778],
    "8770": [-0.03625, 0.46375, 0, 0, 0.77778],
    "8774": [0.30274, 0.79383, 0, 0, 0.77778],
    "8776": [-0.01688, 0.48312, 0, 0, 0.77778],
    "8778": [0.08167, 0.58167, 0, 0, 0.77778],
    "8782": [0.06062, 0.54986, 0, 0, 0.77778],
    "8783": [0.06062, 0.54986, 0, 0, 0.77778],
    "8785": [0.08198, 0.58198, 0, 0, 0.77778],
    "8786": [0.08198, 0.58198, 0, 0, 0.77778],
    "8787": [0.08198, 0.58198, 0, 0, 0.77778],
    "8790": [0, 0.69224, 0, 0, 0.77778],
    "8791": [0.22958, 0.72958, 0, 0, 0.77778],
    "8796": [0.08198, 0.91667, 0, 0, 0.77778],
    "8806": [0.25583, 0.75583, 0, 0, 0.77778],
    "8807": [0.25583, 0.75583, 0, 0, 0.77778],
    "8808": [0.25142, 0.75726, 0, 0, 0.77778],
    "8809": [0.25142, 0.75726, 0, 0, 0.77778],
    "8812": [0.25583, 0.75583, 0, 0, 0.5],
    "8814": [0.20576, 0.70576, 0, 0, 0.77778],
    "8815": [0.20576, 0.70576, 0, 0, 0.77778],
    "8816": [0.30274, 0.79383, 0, 0, 0.77778],
    "8817": [0.30274, 0.79383, 0, 0, 0.77778],
    "8818": [0.22958, 0.72958, 0, 0, 0.77778],
    "8819": [0.22958, 0.72958, 0, 0, 0.77778],
    "8822": [0.1808, 0.675, 0, 0, 0.77778],
    "8823": [0.1808, 0.675, 0, 0, 0.77778],
    "8828": [0.13667, 0.63667, 0, 0, 0.77778],
    "8829": [0.13667, 0.63667, 0, 0, 0.77778],
    "8830": [0.22958, 0.72958, 0, 0, 0.77778],
    "8831": [0.22958, 0.72958, 0, 0, 0.77778],
    "8832": [0.20576, 0.70576, 0, 0, 0.77778],
    "8833": [0.20576, 0.70576, 0, 0, 0.77778],
    "8840": [0.30274, 0.79383, 0, 0, 0.77778],
    "8841": [0.30274, 0.79383, 0, 0, 0.77778],
    "8842": [0.13597, 0.63597, 0, 0, 0.77778],
    "8843": [0.13597, 0.63597, 0, 0, 0.77778],
    "8847": [0.03517, 0.54986, 0, 0, 0.77778],
    "8848": [0.03517, 0.54986, 0, 0, 0.77778],
    "8858": [0.08198, 0.58198, 0, 0, 0.77778],
    "8859": [0.08198, 0.58198, 0, 0, 0.77778],
    "8861": [0.08198, 0.58198, 0, 0, 0.77778],
    "8862": [0, 0.675, 0, 0, 0.77778],
    "8863": [0, 0.675, 0, 0, 0.77778],
    "8864": [0, 0.675, 0, 0, 0.77778],
    "8865": [0, 0.675, 0, 0, 0.77778],
    "8872": [0, 0.69224, 0, 0, 0.61111],
    "8873": [0, 0.69224, 0, 0, 0.72222],
    "8874": [0, 0.69224, 0, 0, 0.88889],
    "8876": [0, 0.68889, 0, 0, 0.61111],
    "8877": [0, 0.68889, 0, 0, 0.61111],
    "8878": [0, 0.68889, 0, 0, 0.72222],
    "8879": [0, 0.68889, 0, 0, 0.72222],
    "8882": [0.03517, 0.54986, 0, 0, 0.77778],
    "8883": [0.03517, 0.54986, 0, 0, 0.77778],
    "8884": [0.13667, 0.63667, 0, 0, 0.77778],
    "8885": [0.13667, 0.63667, 0, 0, 0.77778],
    "8888": [0, 0.54986, 0, 0, 1.11111],
    "8890": [0.19444, 0.43056, 0, 0, 0.55556],
    "8891": [0.19444, 0.69224, 0, 0, 0.61111],
    "8892": [0.19444, 0.69224, 0, 0, 0.61111],
    "8901": [0, 0.54986, 0, 0, 0.27778],
    "8903": [0.08167, 0.58167, 0, 0, 0.77778],
    "8905": [0.08167, 0.58167, 0, 0, 0.77778],
    "8906": [0.08167, 0.58167, 0, 0, 0.77778],
    "8907": [0, 0.69224, 0, 0, 0.77778],
    "8908": [0, 0.69224, 0, 0, 0.77778],
    "8909": [-0.03598, 0.46402, 0, 0, 0.77778],
    "8910": [0, 0.54986, 0, 0, 0.76042],
    "8911": [0, 0.54986, 0, 0, 0.76042],
    "8912": [0.03517, 0.54986, 0, 0, 0.77778],
    "8913": [0.03517, 0.54986, 0, 0, 0.77778],
    "8914": [0, 0.54986, 0, 0, 0.66667],
    "8915": [0, 0.54986, 0, 0, 0.66667],
    "8916": [0, 0.69224, 0, 0, 0.66667],
    "8918": [0.0391, 0.5391, 0, 0, 0.77778],
    "8919": [0.0391, 0.5391, 0, 0, 0.77778],
    "8920": [0.03517, 0.54986, 0, 0, 1.33334],
    "8921": [0.03517, 0.54986, 0, 0, 1.33334],
    "8922": [0.38569, 0.88569, 0, 0, 0.77778],
    "8923": [0.38569, 0.88569, 0, 0, 0.77778],
    "8926": [0.13667, 0.63667, 0, 0, 0.77778],
    "8927": [0.13667, 0.63667, 0, 0, 0.77778],
    "8928": [0.30274, 0.79383, 0, 0, 0.77778],
    "8929": [0.30274, 0.79383, 0, 0, 0.77778],
    "8934": [0.23222, 0.74111, 0, 0, 0.77778],
    "8935": [0.23222, 0.74111, 0, 0, 0.77778],
    "8936": [0.23222, 0.74111, 0, 0, 0.77778],
    "8937": [0.23222, 0.74111, 0, 0, 0.77778],
    "8938": [0.20576, 0.70576, 0, 0, 0.77778],
    "8939": [0.20576, 0.70576, 0, 0, 0.77778],
    "8940": [0.30274, 0.79383, 0, 0, 0.77778],
    "8941": [0.30274, 0.79383, 0, 0, 0.77778],
    "8994": [0.19444, 0.69224, 0, 0, 0.77778],
    "8995": [0.19444, 0.69224, 0, 0, 0.77778],
    "9416": [0.15559, 0.69224, 0, 0, 0.90222],
    "9484": [0, 0.69224, 0, 0, 0.5],
    "9488": [0, 0.69224, 0, 0, 0.5],
    "9492": [0, 0.37788, 0, 0, 0.5],
    "9496": [0, 0.37788, 0, 0, 0.5],
    "9585": [0.19444, 0.68889, 0, 0, 0.88889],
    "9586": [0.19444, 0.74111, 0, 0, 0.88889],
    "9632": [0, 0.675, 0, 0, 0.77778],
    "9633": [0, 0.675, 0, 0, 0.77778],
    "9650": [0, 0.54986, 0, 0, 0.72222],
    "9651": [0, 0.54986, 0, 0, 0.72222],
    "9654": [0.03517, 0.54986, 0, 0, 0.77778],
    "9660": [0, 0.54986, 0, 0, 0.72222],
    "9661": [0, 0.54986, 0, 0, 0.72222],
    "9664": [0.03517, 0.54986, 0, 0, 0.77778],
    "9674": [0.11111, 0.69224, 0, 0, 0.66667],
    "9733": [0.19444, 0.69224, 0, 0, 0.94445],
    "10003": [0, 0.69224, 0, 0, 0.83334],
    "10016": [0, 0.69224, 0, 0, 0.83334],
    "10731": [0.11111, 0.69224, 0, 0, 0.66667],
    "10846": [0.19444, 0.75583, 0, 0, 0.61111],
    "10877": [0.13667, 0.63667, 0, 0, 0.77778],
    "10878": [0.13667, 0.63667, 0, 0, 0.77778],
    "10885": [0.25583, 0.75583, 0, 0, 0.77778],
    "10886": [0.25583, 0.75583, 0, 0, 0.77778],
    "10887": [0.13597, 0.63597, 0, 0, 0.77778],
    "10888": [0.13597, 0.63597, 0, 0, 0.77778],
    "10889": [0.26167, 0.75726, 0, 0, 0.77778],
    "10890": [0.26167, 0.75726, 0, 0, 0.77778],
    "10891": [0.48256, 0.98256, 0, 0, 0.77778],
    "10892": [0.48256, 0.98256, 0, 0, 0.77778],
    "10901": [0.13667, 0.63667, 0, 0, 0.77778],
    "10902": [0.13667, 0.63667, 0, 0, 0.77778],
    "10933": [0.25142, 0.75726, 0, 0, 0.77778],
    "10934": [0.25142, 0.75726, 0, 0, 0.77778],
    "10935": [0.26167, 0.75726, 0, 0, 0.77778],
    "10936": [0.26167, 0.75726, 0, 0, 0.77778],
    "10937": [0.26167, 0.75726, 0, 0, 0.77778],
    "10938": [0.26167, 0.75726, 0, 0, 0.77778],
    "10949": [0.25583, 0.75583, 0, 0, 0.77778],
    "10950": [0.25583, 0.75583, 0, 0, 0.77778],
    "10955": [0.28481, 0.79383, 0, 0, 0.77778],
    "10956": [0.28481, 0.79383, 0, 0, 0.77778],
    "57350": [0.08167, 0.58167, 0, 0, 0.22222],
    "57351": [0.08167, 0.58167, 0, 0, 0.38889],
    "57352": [0.08167, 0.58167, 0, 0, 0.77778],
    "57353": [0, 0.43056, 0.04028, 0, 0.66667],
    "57356": [0.25142, 0.75726, 0, 0, 0.77778],
    "57357": [0.25142, 0.75726, 0, 0, 0.77778],
    "57358": [0.41951, 0.91951, 0, 0, 0.77778],
    "57359": [0.30274, 0.79383, 0, 0, 0.77778],
    "57360": [0.30274, 0.79383, 0, 0, 0.77778],
    "57361": [0.41951, 0.91951, 0, 0, 0.77778],
    "57366": [0.25142, 0.75726, 0, 0, 0.77778],
    "57367": [0.25142, 0.75726, 0, 0, 0.77778],
    "57368": [0.25142, 0.75726, 0, 0, 0.77778],
    "57369": [0.25142, 0.75726, 0, 0, 0.77778],
    "57370": [0.13597, 0.63597, 0, 0, 0.77778],
    "57371": [0.13597, 0.63597, 0, 0, 0.77778]
  },
  "Caligraphic-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "65": [0, 0.68333, 0, 0.19445, 0.79847],
    "66": [0, 0.68333, 0.03041, 0.13889, 0.65681],
    "67": [0, 0.68333, 0.05834, 0.13889, 0.52653],
    "68": [0, 0.68333, 0.02778, 0.08334, 0.77139],
    "69": [0, 0.68333, 0.08944, 0.11111, 0.52778],
    "70": [0, 0.68333, 0.09931, 0.11111, 0.71875],
    "71": [0.09722, 0.68333, 0.0593, 0.11111, 0.59487],
    "72": [0, 0.68333, 965e-5, 0.11111, 0.84452],
    "73": [0, 0.68333, 0.07382, 0, 0.54452],
    "74": [0.09722, 0.68333, 0.18472, 0.16667, 0.67778],
    "75": [0, 0.68333, 0.01445, 0.05556, 0.76195],
    "76": [0, 0.68333, 0, 0.13889, 0.68972],
    "77": [0, 0.68333, 0, 0.13889, 1.2009],
    "78": [0, 0.68333, 0.14736, 0.08334, 0.82049],
    "79": [0, 0.68333, 0.02778, 0.11111, 0.79611],
    "80": [0, 0.68333, 0.08222, 0.08334, 0.69556],
    "81": [0.09722, 0.68333, 0, 0.11111, 0.81667],
    "82": [0, 0.68333, 0, 0.08334, 0.8475],
    "83": [0, 0.68333, 0.075, 0.13889, 0.60556],
    "84": [0, 0.68333, 0.25417, 0, 0.54464],
    "85": [0, 0.68333, 0.09931, 0.08334, 0.62583],
    "86": [0, 0.68333, 0.08222, 0, 0.61278],
    "87": [0, 0.68333, 0.08222, 0.08334, 0.98778],
    "88": [0, 0.68333, 0.14643, 0.13889, 0.7133],
    "89": [0.09722, 0.68333, 0.08222, 0.08334, 0.66834],
    "90": [0, 0.68333, 0.07944, 0.13889, 0.72473],
    "160": [0, 0, 0, 0, 0.25]
  },
  "Fraktur-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69141, 0, 0, 0.29574],
    "34": [0, 0.69141, 0, 0, 0.21471],
    "38": [0, 0.69141, 0, 0, 0.73786],
    "39": [0, 0.69141, 0, 0, 0.21201],
    "40": [0.24982, 0.74947, 0, 0, 0.38865],
    "41": [0.24982, 0.74947, 0, 0, 0.38865],
    "42": [0, 0.62119, 0, 0, 0.27764],
    "43": [0.08319, 0.58283, 0, 0, 0.75623],
    "44": [0, 0.10803, 0, 0, 0.27764],
    "45": [0.08319, 0.58283, 0, 0, 0.75623],
    "46": [0, 0.10803, 0, 0, 0.27764],
    "47": [0.24982, 0.74947, 0, 0, 0.50181],
    "48": [0, 0.47534, 0, 0, 0.50181],
    "49": [0, 0.47534, 0, 0, 0.50181],
    "50": [0, 0.47534, 0, 0, 0.50181],
    "51": [0.18906, 0.47534, 0, 0, 0.50181],
    "52": [0.18906, 0.47534, 0, 0, 0.50181],
    "53": [0.18906, 0.47534, 0, 0, 0.50181],
    "54": [0, 0.69141, 0, 0, 0.50181],
    "55": [0.18906, 0.47534, 0, 0, 0.50181],
    "56": [0, 0.69141, 0, 0, 0.50181],
    "57": [0.18906, 0.47534, 0, 0, 0.50181],
    "58": [0, 0.47534, 0, 0, 0.21606],
    "59": [0.12604, 0.47534, 0, 0, 0.21606],
    "61": [-0.13099, 0.36866, 0, 0, 0.75623],
    "63": [0, 0.69141, 0, 0, 0.36245],
    "65": [0, 0.69141, 0, 0, 0.7176],
    "66": [0, 0.69141, 0, 0, 0.88397],
    "67": [0, 0.69141, 0, 0, 0.61254],
    "68": [0, 0.69141, 0, 0, 0.83158],
    "69": [0, 0.69141, 0, 0, 0.66278],
    "70": [0.12604, 0.69141, 0, 0, 0.61119],
    "71": [0, 0.69141, 0, 0, 0.78539],
    "72": [0.06302, 0.69141, 0, 0, 0.7203],
    "73": [0, 0.69141, 0, 0, 0.55448],
    "74": [0.12604, 0.69141, 0, 0, 0.55231],
    "75": [0, 0.69141, 0, 0, 0.66845],
    "76": [0, 0.69141, 0, 0, 0.66602],
    "77": [0, 0.69141, 0, 0, 1.04953],
    "78": [0, 0.69141, 0, 0, 0.83212],
    "79": [0, 0.69141, 0, 0, 0.82699],
    "80": [0.18906, 0.69141, 0, 0, 0.82753],
    "81": [0.03781, 0.69141, 0, 0, 0.82699],
    "82": [0, 0.69141, 0, 0, 0.82807],
    "83": [0, 0.69141, 0, 0, 0.82861],
    "84": [0, 0.69141, 0, 0, 0.66899],
    "85": [0, 0.69141, 0, 0, 0.64576],
    "86": [0, 0.69141, 0, 0, 0.83131],
    "87": [0, 0.69141, 0, 0, 1.04602],
    "88": [0, 0.69141, 0, 0, 0.71922],
    "89": [0.18906, 0.69141, 0, 0, 0.83293],
    "90": [0.12604, 0.69141, 0, 0, 0.60201],
    "91": [0.24982, 0.74947, 0, 0, 0.27764],
    "93": [0.24982, 0.74947, 0, 0, 0.27764],
    "94": [0, 0.69141, 0, 0, 0.49965],
    "97": [0, 0.47534, 0, 0, 0.50046],
    "98": [0, 0.69141, 0, 0, 0.51315],
    "99": [0, 0.47534, 0, 0, 0.38946],
    "100": [0, 0.62119, 0, 0, 0.49857],
    "101": [0, 0.47534, 0, 0, 0.40053],
    "102": [0.18906, 0.69141, 0, 0, 0.32626],
    "103": [0.18906, 0.47534, 0, 0, 0.5037],
    "104": [0.18906, 0.69141, 0, 0, 0.52126],
    "105": [0, 0.69141, 0, 0, 0.27899],
    "106": [0, 0.69141, 0, 0, 0.28088],
    "107": [0, 0.69141, 0, 0, 0.38946],
    "108": [0, 0.69141, 0, 0, 0.27953],
    "109": [0, 0.47534, 0, 0, 0.76676],
    "110": [0, 0.47534, 0, 0, 0.52666],
    "111": [0, 0.47534, 0, 0, 0.48885],
    "112": [0.18906, 0.52396, 0, 0, 0.50046],
    "113": [0.18906, 0.47534, 0, 0, 0.48912],
    "114": [0, 0.47534, 0, 0, 0.38919],
    "115": [0, 0.47534, 0, 0, 0.44266],
    "116": [0, 0.62119, 0, 0, 0.33301],
    "117": [0, 0.47534, 0, 0, 0.5172],
    "118": [0, 0.52396, 0, 0, 0.5118],
    "119": [0, 0.52396, 0, 0, 0.77351],
    "120": [0.18906, 0.47534, 0, 0, 0.38865],
    "121": [0.18906, 0.47534, 0, 0, 0.49884],
    "122": [0.18906, 0.47534, 0, 0, 0.39054],
    "160": [0, 0, 0, 0, 0.25],
    "8216": [0, 0.69141, 0, 0, 0.21471],
    "8217": [0, 0.69141, 0, 0, 0.21471],
    "58112": [0, 0.62119, 0, 0, 0.49749],
    "58113": [0, 0.62119, 0, 0, 0.4983],
    "58114": [0.18906, 0.69141, 0, 0, 0.33328],
    "58115": [0.18906, 0.69141, 0, 0, 0.32923],
    "58116": [0.18906, 0.47534, 0, 0, 0.50343],
    "58117": [0, 0.69141, 0, 0, 0.33301],
    "58118": [0, 0.62119, 0, 0, 0.33409],
    "58119": [0, 0.47534, 0, 0, 0.50073]
  },
  "Main-Bold": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0, 0, 0.35],
    "34": [0, 0.69444, 0, 0, 0.60278],
    "35": [0.19444, 0.69444, 0, 0, 0.95833],
    "36": [0.05556, 0.75, 0, 0, 0.575],
    "37": [0.05556, 0.75, 0, 0, 0.95833],
    "38": [0, 0.69444, 0, 0, 0.89444],
    "39": [0, 0.69444, 0, 0, 0.31944],
    "40": [0.25, 0.75, 0, 0, 0.44722],
    "41": [0.25, 0.75, 0, 0, 0.44722],
    "42": [0, 0.75, 0, 0, 0.575],
    "43": [0.13333, 0.63333, 0, 0, 0.89444],
    "44": [0.19444, 0.15556, 0, 0, 0.31944],
    "45": [0, 0.44444, 0, 0, 0.38333],
    "46": [0, 0.15556, 0, 0, 0.31944],
    "47": [0.25, 0.75, 0, 0, 0.575],
    "48": [0, 0.64444, 0, 0, 0.575],
    "49": [0, 0.64444, 0, 0, 0.575],
    "50": [0, 0.64444, 0, 0, 0.575],
    "51": [0, 0.64444, 0, 0, 0.575],
    "52": [0, 0.64444, 0, 0, 0.575],
    "53": [0, 0.64444, 0, 0, 0.575],
    "54": [0, 0.64444, 0, 0, 0.575],
    "55": [0, 0.64444, 0, 0, 0.575],
    "56": [0, 0.64444, 0, 0, 0.575],
    "57": [0, 0.64444, 0, 0, 0.575],
    "58": [0, 0.44444, 0, 0, 0.31944],
    "59": [0.19444, 0.44444, 0, 0, 0.31944],
    "60": [0.08556, 0.58556, 0, 0, 0.89444],
    "61": [-0.10889, 0.39111, 0, 0, 0.89444],
    "62": [0.08556, 0.58556, 0, 0, 0.89444],
    "63": [0, 0.69444, 0, 0, 0.54305],
    "64": [0, 0.69444, 0, 0, 0.89444],
    "65": [0, 0.68611, 0, 0, 0.86944],
    "66": [0, 0.68611, 0, 0, 0.81805],
    "67": [0, 0.68611, 0, 0, 0.83055],
    "68": [0, 0.68611, 0, 0, 0.88194],
    "69": [0, 0.68611, 0, 0, 0.75555],
    "70": [0, 0.68611, 0, 0, 0.72361],
    "71": [0, 0.68611, 0, 0, 0.90416],
    "72": [0, 0.68611, 0, 0, 0.9],
    "73": [0, 0.68611, 0, 0, 0.43611],
    "74": [0, 0.68611, 0, 0, 0.59444],
    "75": [0, 0.68611, 0, 0, 0.90138],
    "76": [0, 0.68611, 0, 0, 0.69166],
    "77": [0, 0.68611, 0, 0, 1.09166],
    "78": [0, 0.68611, 0, 0, 0.9],
    "79": [0, 0.68611, 0, 0, 0.86388],
    "80": [0, 0.68611, 0, 0, 0.78611],
    "81": [0.19444, 0.68611, 0, 0, 0.86388],
    "82": [0, 0.68611, 0, 0, 0.8625],
    "83": [0, 0.68611, 0, 0, 0.63889],
    "84": [0, 0.68611, 0, 0, 0.8],
    "85": [0, 0.68611, 0, 0, 0.88472],
    "86": [0, 0.68611, 0.01597, 0, 0.86944],
    "87": [0, 0.68611, 0.01597, 0, 1.18888],
    "88": [0, 0.68611, 0, 0, 0.86944],
    "89": [0, 0.68611, 0.02875, 0, 0.86944],
    "90": [0, 0.68611, 0, 0, 0.70277],
    "91": [0.25, 0.75, 0, 0, 0.31944],
    "92": [0.25, 0.75, 0, 0, 0.575],
    "93": [0.25, 0.75, 0, 0, 0.31944],
    "94": [0, 0.69444, 0, 0, 0.575],
    "95": [0.31, 0.13444, 0.03194, 0, 0.575],
    "97": [0, 0.44444, 0, 0, 0.55902],
    "98": [0, 0.69444, 0, 0, 0.63889],
    "99": [0, 0.44444, 0, 0, 0.51111],
    "100": [0, 0.69444, 0, 0, 0.63889],
    "101": [0, 0.44444, 0, 0, 0.52708],
    "102": [0, 0.69444, 0.10903, 0, 0.35139],
    "103": [0.19444, 0.44444, 0.01597, 0, 0.575],
    "104": [0, 0.69444, 0, 0, 0.63889],
    "105": [0, 0.69444, 0, 0, 0.31944],
    "106": [0.19444, 0.69444, 0, 0, 0.35139],
    "107": [0, 0.69444, 0, 0, 0.60694],
    "108": [0, 0.69444, 0, 0, 0.31944],
    "109": [0, 0.44444, 0, 0, 0.95833],
    "110": [0, 0.44444, 0, 0, 0.63889],
    "111": [0, 0.44444, 0, 0, 0.575],
    "112": [0.19444, 0.44444, 0, 0, 0.63889],
    "113": [0.19444, 0.44444, 0, 0, 0.60694],
    "114": [0, 0.44444, 0, 0, 0.47361],
    "115": [0, 0.44444, 0, 0, 0.45361],
    "116": [0, 0.63492, 0, 0, 0.44722],
    "117": [0, 0.44444, 0, 0, 0.63889],
    "118": [0, 0.44444, 0.01597, 0, 0.60694],
    "119": [0, 0.44444, 0.01597, 0, 0.83055],
    "120": [0, 0.44444, 0, 0, 0.60694],
    "121": [0.19444, 0.44444, 0.01597, 0, 0.60694],
    "122": [0, 0.44444, 0, 0, 0.51111],
    "123": [0.25, 0.75, 0, 0, 0.575],
    "124": [0.25, 0.75, 0, 0, 0.31944],
    "125": [0.25, 0.75, 0, 0, 0.575],
    "126": [0.35, 0.34444, 0, 0, 0.575],
    "160": [0, 0, 0, 0, 0.25],
    "163": [0, 0.69444, 0, 0, 0.86853],
    "168": [0, 0.69444, 0, 0, 0.575],
    "172": [0, 0.44444, 0, 0, 0.76666],
    "176": [0, 0.69444, 0, 0, 0.86944],
    "177": [0.13333, 0.63333, 0, 0, 0.89444],
    "184": [0.17014, 0, 0, 0, 0.51111],
    "198": [0, 0.68611, 0, 0, 1.04166],
    "215": [0.13333, 0.63333, 0, 0, 0.89444],
    "216": [0.04861, 0.73472, 0, 0, 0.89444],
    "223": [0, 0.69444, 0, 0, 0.59722],
    "230": [0, 0.44444, 0, 0, 0.83055],
    "247": [0.13333, 0.63333, 0, 0, 0.89444],
    "248": [0.09722, 0.54167, 0, 0, 0.575],
    "305": [0, 0.44444, 0, 0, 0.31944],
    "338": [0, 0.68611, 0, 0, 1.16944],
    "339": [0, 0.44444, 0, 0, 0.89444],
    "567": [0.19444, 0.44444, 0, 0, 0.35139],
    "710": [0, 0.69444, 0, 0, 0.575],
    "711": [0, 0.63194, 0, 0, 0.575],
    "713": [0, 0.59611, 0, 0, 0.575],
    "714": [0, 0.69444, 0, 0, 0.575],
    "715": [0, 0.69444, 0, 0, 0.575],
    "728": [0, 0.69444, 0, 0, 0.575],
    "729": [0, 0.69444, 0, 0, 0.31944],
    "730": [0, 0.69444, 0, 0, 0.86944],
    "732": [0, 0.69444, 0, 0, 0.575],
    "733": [0, 0.69444, 0, 0, 0.575],
    "915": [0, 0.68611, 0, 0, 0.69166],
    "916": [0, 0.68611, 0, 0, 0.95833],
    "920": [0, 0.68611, 0, 0, 0.89444],
    "923": [0, 0.68611, 0, 0, 0.80555],
    "926": [0, 0.68611, 0, 0, 0.76666],
    "928": [0, 0.68611, 0, 0, 0.9],
    "931": [0, 0.68611, 0, 0, 0.83055],
    "933": [0, 0.68611, 0, 0, 0.89444],
    "934": [0, 0.68611, 0, 0, 0.83055],
    "936": [0, 0.68611, 0, 0, 0.89444],
    "937": [0, 0.68611, 0, 0, 0.83055],
    "8211": [0, 0.44444, 0.03194, 0, 0.575],
    "8212": [0, 0.44444, 0.03194, 0, 1.14999],
    "8216": [0, 0.69444, 0, 0, 0.31944],
    "8217": [0, 0.69444, 0, 0, 0.31944],
    "8220": [0, 0.69444, 0, 0, 0.60278],
    "8221": [0, 0.69444, 0, 0, 0.60278],
    "8224": [0.19444, 0.69444, 0, 0, 0.51111],
    "8225": [0.19444, 0.69444, 0, 0, 0.51111],
    "8242": [0, 0.55556, 0, 0, 0.34444],
    "8407": [0, 0.72444, 0.15486, 0, 0.575],
    "8463": [0, 0.69444, 0, 0, 0.66759],
    "8465": [0, 0.69444, 0, 0, 0.83055],
    "8467": [0, 0.69444, 0, 0, 0.47361],
    "8472": [0.19444, 0.44444, 0, 0, 0.74027],
    "8476": [0, 0.69444, 0, 0, 0.83055],
    "8501": [0, 0.69444, 0, 0, 0.70277],
    "8592": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8593": [0.19444, 0.69444, 0, 0, 0.575],
    "8594": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8595": [0.19444, 0.69444, 0, 0, 0.575],
    "8596": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8597": [0.25, 0.75, 0, 0, 0.575],
    "8598": [0.19444, 0.69444, 0, 0, 1.14999],
    "8599": [0.19444, 0.69444, 0, 0, 1.14999],
    "8600": [0.19444, 0.69444, 0, 0, 1.14999],
    "8601": [0.19444, 0.69444, 0, 0, 1.14999],
    "8636": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8637": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8640": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8641": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8656": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8657": [0.19444, 0.69444, 0, 0, 0.70277],
    "8658": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8659": [0.19444, 0.69444, 0, 0, 0.70277],
    "8660": [-0.10889, 0.39111, 0, 0, 1.14999],
    "8661": [0.25, 0.75, 0, 0, 0.70277],
    "8704": [0, 0.69444, 0, 0, 0.63889],
    "8706": [0, 0.69444, 0.06389, 0, 0.62847],
    "8707": [0, 0.69444, 0, 0, 0.63889],
    "8709": [0.05556, 0.75, 0, 0, 0.575],
    "8711": [0, 0.68611, 0, 0, 0.95833],
    "8712": [0.08556, 0.58556, 0, 0, 0.76666],
    "8715": [0.08556, 0.58556, 0, 0, 0.76666],
    "8722": [0.13333, 0.63333, 0, 0, 0.89444],
    "8723": [0.13333, 0.63333, 0, 0, 0.89444],
    "8725": [0.25, 0.75, 0, 0, 0.575],
    "8726": [0.25, 0.75, 0, 0, 0.575],
    "8727": [-0.02778, 0.47222, 0, 0, 0.575],
    "8728": [-0.02639, 0.47361, 0, 0, 0.575],
    "8729": [-0.02639, 0.47361, 0, 0, 0.575],
    "8730": [0.18, 0.82, 0, 0, 0.95833],
    "8733": [0, 0.44444, 0, 0, 0.89444],
    "8734": [0, 0.44444, 0, 0, 1.14999],
    "8736": [0, 0.69224, 0, 0, 0.72222],
    "8739": [0.25, 0.75, 0, 0, 0.31944],
    "8741": [0.25, 0.75, 0, 0, 0.575],
    "8743": [0, 0.55556, 0, 0, 0.76666],
    "8744": [0, 0.55556, 0, 0, 0.76666],
    "8745": [0, 0.55556, 0, 0, 0.76666],
    "8746": [0, 0.55556, 0, 0, 0.76666],
    "8747": [0.19444, 0.69444, 0.12778, 0, 0.56875],
    "8764": [-0.10889, 0.39111, 0, 0, 0.89444],
    "8768": [0.19444, 0.69444, 0, 0, 0.31944],
    "8771": [222e-5, 0.50222, 0, 0, 0.89444],
    "8773": [0.027, 0.638, 0, 0, 0.894],
    "8776": [0.02444, 0.52444, 0, 0, 0.89444],
    "8781": [222e-5, 0.50222, 0, 0, 0.89444],
    "8801": [222e-5, 0.50222, 0, 0, 0.89444],
    "8804": [0.19667, 0.69667, 0, 0, 0.89444],
    "8805": [0.19667, 0.69667, 0, 0, 0.89444],
    "8810": [0.08556, 0.58556, 0, 0, 1.14999],
    "8811": [0.08556, 0.58556, 0, 0, 1.14999],
    "8826": [0.08556, 0.58556, 0, 0, 0.89444],
    "8827": [0.08556, 0.58556, 0, 0, 0.89444],
    "8834": [0.08556, 0.58556, 0, 0, 0.89444],
    "8835": [0.08556, 0.58556, 0, 0, 0.89444],
    "8838": [0.19667, 0.69667, 0, 0, 0.89444],
    "8839": [0.19667, 0.69667, 0, 0, 0.89444],
    "8846": [0, 0.55556, 0, 0, 0.76666],
    "8849": [0.19667, 0.69667, 0, 0, 0.89444],
    "8850": [0.19667, 0.69667, 0, 0, 0.89444],
    "8851": [0, 0.55556, 0, 0, 0.76666],
    "8852": [0, 0.55556, 0, 0, 0.76666],
    "8853": [0.13333, 0.63333, 0, 0, 0.89444],
    "8854": [0.13333, 0.63333, 0, 0, 0.89444],
    "8855": [0.13333, 0.63333, 0, 0, 0.89444],
    "8856": [0.13333, 0.63333, 0, 0, 0.89444],
    "8857": [0.13333, 0.63333, 0, 0, 0.89444],
    "8866": [0, 0.69444, 0, 0, 0.70277],
    "8867": [0, 0.69444, 0, 0, 0.70277],
    "8868": [0, 0.69444, 0, 0, 0.89444],
    "8869": [0, 0.69444, 0, 0, 0.89444],
    "8900": [-0.02639, 0.47361, 0, 0, 0.575],
    "8901": [-0.02639, 0.47361, 0, 0, 0.31944],
    "8902": [-0.02778, 0.47222, 0, 0, 0.575],
    "8968": [0.25, 0.75, 0, 0, 0.51111],
    "8969": [0.25, 0.75, 0, 0, 0.51111],
    "8970": [0.25, 0.75, 0, 0, 0.51111],
    "8971": [0.25, 0.75, 0, 0, 0.51111],
    "8994": [-0.13889, 0.36111, 0, 0, 1.14999],
    "8995": [-0.13889, 0.36111, 0, 0, 1.14999],
    "9651": [0.19444, 0.69444, 0, 0, 1.02222],
    "9657": [-0.02778, 0.47222, 0, 0, 0.575],
    "9661": [0.19444, 0.69444, 0, 0, 1.02222],
    "9667": [-0.02778, 0.47222, 0, 0, 0.575],
    "9711": [0.19444, 0.69444, 0, 0, 1.14999],
    "9824": [0.12963, 0.69444, 0, 0, 0.89444],
    "9825": [0.12963, 0.69444, 0, 0, 0.89444],
    "9826": [0.12963, 0.69444, 0, 0, 0.89444],
    "9827": [0.12963, 0.69444, 0, 0, 0.89444],
    "9837": [0, 0.75, 0, 0, 0.44722],
    "9838": [0.19444, 0.69444, 0, 0, 0.44722],
    "9839": [0.19444, 0.69444, 0, 0, 0.44722],
    "10216": [0.25, 0.75, 0, 0, 0.44722],
    "10217": [0.25, 0.75, 0, 0, 0.44722],
    "10815": [0, 0.68611, 0, 0, 0.9],
    "10927": [0.19667, 0.69667, 0, 0, 0.89444],
    "10928": [0.19667, 0.69667, 0, 0, 0.89444],
    "57376": [0.19444, 0.69444, 0, 0, 0]
  },
  "Main-BoldItalic": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0.11417, 0, 0.38611],
    "34": [0, 0.69444, 0.07939, 0, 0.62055],
    "35": [0.19444, 0.69444, 0.06833, 0, 0.94444],
    "37": [0.05556, 0.75, 0.12861, 0, 0.94444],
    "38": [0, 0.69444, 0.08528, 0, 0.88555],
    "39": [0, 0.69444, 0.12945, 0, 0.35555],
    "40": [0.25, 0.75, 0.15806, 0, 0.47333],
    "41": [0.25, 0.75, 0.03306, 0, 0.47333],
    "42": [0, 0.75, 0.14333, 0, 0.59111],
    "43": [0.10333, 0.60333, 0.03306, 0, 0.88555],
    "44": [0.19444, 0.14722, 0, 0, 0.35555],
    "45": [0, 0.44444, 0.02611, 0, 0.41444],
    "46": [0, 0.14722, 0, 0, 0.35555],
    "47": [0.25, 0.75, 0.15806, 0, 0.59111],
    "48": [0, 0.64444, 0.13167, 0, 0.59111],
    "49": [0, 0.64444, 0.13167, 0, 0.59111],
    "50": [0, 0.64444, 0.13167, 0, 0.59111],
    "51": [0, 0.64444, 0.13167, 0, 0.59111],
    "52": [0.19444, 0.64444, 0.13167, 0, 0.59111],
    "53": [0, 0.64444, 0.13167, 0, 0.59111],
    "54": [0, 0.64444, 0.13167, 0, 0.59111],
    "55": [0.19444, 0.64444, 0.13167, 0, 0.59111],
    "56": [0, 0.64444, 0.13167, 0, 0.59111],
    "57": [0, 0.64444, 0.13167, 0, 0.59111],
    "58": [0, 0.44444, 0.06695, 0, 0.35555],
    "59": [0.19444, 0.44444, 0.06695, 0, 0.35555],
    "61": [-0.10889, 0.39111, 0.06833, 0, 0.88555],
    "63": [0, 0.69444, 0.11472, 0, 0.59111],
    "64": [0, 0.69444, 0.09208, 0, 0.88555],
    "65": [0, 0.68611, 0, 0, 0.86555],
    "66": [0, 0.68611, 0.0992, 0, 0.81666],
    "67": [0, 0.68611, 0.14208, 0, 0.82666],
    "68": [0, 0.68611, 0.09062, 0, 0.87555],
    "69": [0, 0.68611, 0.11431, 0, 0.75666],
    "70": [0, 0.68611, 0.12903, 0, 0.72722],
    "71": [0, 0.68611, 0.07347, 0, 0.89527],
    "72": [0, 0.68611, 0.17208, 0, 0.8961],
    "73": [0, 0.68611, 0.15681, 0, 0.47166],
    "74": [0, 0.68611, 0.145, 0, 0.61055],
    "75": [0, 0.68611, 0.14208, 0, 0.89499],
    "76": [0, 0.68611, 0, 0, 0.69777],
    "77": [0, 0.68611, 0.17208, 0, 1.07277],
    "78": [0, 0.68611, 0.17208, 0, 0.8961],
    "79": [0, 0.68611, 0.09062, 0, 0.85499],
    "80": [0, 0.68611, 0.0992, 0, 0.78721],
    "81": [0.19444, 0.68611, 0.09062, 0, 0.85499],
    "82": [0, 0.68611, 0.02559, 0, 0.85944],
    "83": [0, 0.68611, 0.11264, 0, 0.64999],
    "84": [0, 0.68611, 0.12903, 0, 0.7961],
    "85": [0, 0.68611, 0.17208, 0, 0.88083],
    "86": [0, 0.68611, 0.18625, 0, 0.86555],
    "87": [0, 0.68611, 0.18625, 0, 1.15999],
    "88": [0, 0.68611, 0.15681, 0, 0.86555],
    "89": [0, 0.68611, 0.19803, 0, 0.86555],
    "90": [0, 0.68611, 0.14208, 0, 0.70888],
    "91": [0.25, 0.75, 0.1875, 0, 0.35611],
    "93": [0.25, 0.75, 0.09972, 0, 0.35611],
    "94": [0, 0.69444, 0.06709, 0, 0.59111],
    "95": [0.31, 0.13444, 0.09811, 0, 0.59111],
    "97": [0, 0.44444, 0.09426, 0, 0.59111],
    "98": [0, 0.69444, 0.07861, 0, 0.53222],
    "99": [0, 0.44444, 0.05222, 0, 0.53222],
    "100": [0, 0.69444, 0.10861, 0, 0.59111],
    "101": [0, 0.44444, 0.085, 0, 0.53222],
    "102": [0.19444, 0.69444, 0.21778, 0, 0.4],
    "103": [0.19444, 0.44444, 0.105, 0, 0.53222],
    "104": [0, 0.69444, 0.09426, 0, 0.59111],
    "105": [0, 0.69326, 0.11387, 0, 0.35555],
    "106": [0.19444, 0.69326, 0.1672, 0, 0.35555],
    "107": [0, 0.69444, 0.11111, 0, 0.53222],
    "108": [0, 0.69444, 0.10861, 0, 0.29666],
    "109": [0, 0.44444, 0.09426, 0, 0.94444],
    "110": [0, 0.44444, 0.09426, 0, 0.64999],
    "111": [0, 0.44444, 0.07861, 0, 0.59111],
    "112": [0.19444, 0.44444, 0.07861, 0, 0.59111],
    "113": [0.19444, 0.44444, 0.105, 0, 0.53222],
    "114": [0, 0.44444, 0.11111, 0, 0.50167],
    "115": [0, 0.44444, 0.08167, 0, 0.48694],
    "116": [0, 0.63492, 0.09639, 0, 0.385],
    "117": [0, 0.44444, 0.09426, 0, 0.62055],
    "118": [0, 0.44444, 0.11111, 0, 0.53222],
    "119": [0, 0.44444, 0.11111, 0, 0.76777],
    "120": [0, 0.44444, 0.12583, 0, 0.56055],
    "121": [0.19444, 0.44444, 0.105, 0, 0.56166],
    "122": [0, 0.44444, 0.13889, 0, 0.49055],
    "126": [0.35, 0.34444, 0.11472, 0, 0.59111],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.69444, 0.11473, 0, 0.59111],
    "176": [0, 0.69444, 0, 0, 0.94888],
    "184": [0.17014, 0, 0, 0, 0.53222],
    "198": [0, 0.68611, 0.11431, 0, 1.02277],
    "216": [0.04861, 0.73472, 0.09062, 0, 0.88555],
    "223": [0.19444, 0.69444, 0.09736, 0, 0.665],
    "230": [0, 0.44444, 0.085, 0, 0.82666],
    "248": [0.09722, 0.54167, 0.09458, 0, 0.59111],
    "305": [0, 0.44444, 0.09426, 0, 0.35555],
    "338": [0, 0.68611, 0.11431, 0, 1.14054],
    "339": [0, 0.44444, 0.085, 0, 0.82666],
    "567": [0.19444, 0.44444, 0.04611, 0, 0.385],
    "710": [0, 0.69444, 0.06709, 0, 0.59111],
    "711": [0, 0.63194, 0.08271, 0, 0.59111],
    "713": [0, 0.59444, 0.10444, 0, 0.59111],
    "714": [0, 0.69444, 0.08528, 0, 0.59111],
    "715": [0, 0.69444, 0, 0, 0.59111],
    "728": [0, 0.69444, 0.10333, 0, 0.59111],
    "729": [0, 0.69444, 0.12945, 0, 0.35555],
    "730": [0, 0.69444, 0, 0, 0.94888],
    "732": [0, 0.69444, 0.11472, 0, 0.59111],
    "733": [0, 0.69444, 0.11472, 0, 0.59111],
    "915": [0, 0.68611, 0.12903, 0, 0.69777],
    "916": [0, 0.68611, 0, 0, 0.94444],
    "920": [0, 0.68611, 0.09062, 0, 0.88555],
    "923": [0, 0.68611, 0, 0, 0.80666],
    "926": [0, 0.68611, 0.15092, 0, 0.76777],
    "928": [0, 0.68611, 0.17208, 0, 0.8961],
    "931": [0, 0.68611, 0.11431, 0, 0.82666],
    "933": [0, 0.68611, 0.10778, 0, 0.88555],
    "934": [0, 0.68611, 0.05632, 0, 0.82666],
    "936": [0, 0.68611, 0.10778, 0, 0.88555],
    "937": [0, 0.68611, 0.0992, 0, 0.82666],
    "8211": [0, 0.44444, 0.09811, 0, 0.59111],
    "8212": [0, 0.44444, 0.09811, 0, 1.18221],
    "8216": [0, 0.69444, 0.12945, 0, 0.35555],
    "8217": [0, 0.69444, 0.12945, 0, 0.35555],
    "8220": [0, 0.69444, 0.16772, 0, 0.62055],
    "8221": [0, 0.69444, 0.07939, 0, 0.62055]
  },
  "Main-Italic": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0.12417, 0, 0.30667],
    "34": [0, 0.69444, 0.06961, 0, 0.51444],
    "35": [0.19444, 0.69444, 0.06616, 0, 0.81777],
    "37": [0.05556, 0.75, 0.13639, 0, 0.81777],
    "38": [0, 0.69444, 0.09694, 0, 0.76666],
    "39": [0, 0.69444, 0.12417, 0, 0.30667],
    "40": [0.25, 0.75, 0.16194, 0, 0.40889],
    "41": [0.25, 0.75, 0.03694, 0, 0.40889],
    "42": [0, 0.75, 0.14917, 0, 0.51111],
    "43": [0.05667, 0.56167, 0.03694, 0, 0.76666],
    "44": [0.19444, 0.10556, 0, 0, 0.30667],
    "45": [0, 0.43056, 0.02826, 0, 0.35778],
    "46": [0, 0.10556, 0, 0, 0.30667],
    "47": [0.25, 0.75, 0.16194, 0, 0.51111],
    "48": [0, 0.64444, 0.13556, 0, 0.51111],
    "49": [0, 0.64444, 0.13556, 0, 0.51111],
    "50": [0, 0.64444, 0.13556, 0, 0.51111],
    "51": [0, 0.64444, 0.13556, 0, 0.51111],
    "52": [0.19444, 0.64444, 0.13556, 0, 0.51111],
    "53": [0, 0.64444, 0.13556, 0, 0.51111],
    "54": [0, 0.64444, 0.13556, 0, 0.51111],
    "55": [0.19444, 0.64444, 0.13556, 0, 0.51111],
    "56": [0, 0.64444, 0.13556, 0, 0.51111],
    "57": [0, 0.64444, 0.13556, 0, 0.51111],
    "58": [0, 0.43056, 0.0582, 0, 0.30667],
    "59": [0.19444, 0.43056, 0.0582, 0, 0.30667],
    "61": [-0.13313, 0.36687, 0.06616, 0, 0.76666],
    "63": [0, 0.69444, 0.1225, 0, 0.51111],
    "64": [0, 0.69444, 0.09597, 0, 0.76666],
    "65": [0, 0.68333, 0, 0, 0.74333],
    "66": [0, 0.68333, 0.10257, 0, 0.70389],
    "67": [0, 0.68333, 0.14528, 0, 0.71555],
    "68": [0, 0.68333, 0.09403, 0, 0.755],
    "69": [0, 0.68333, 0.12028, 0, 0.67833],
    "70": [0, 0.68333, 0.13305, 0, 0.65277],
    "71": [0, 0.68333, 0.08722, 0, 0.77361],
    "72": [0, 0.68333, 0.16389, 0, 0.74333],
    "73": [0, 0.68333, 0.15806, 0, 0.38555],
    "74": [0, 0.68333, 0.14028, 0, 0.525],
    "75": [0, 0.68333, 0.14528, 0, 0.76888],
    "76": [0, 0.68333, 0, 0, 0.62722],
    "77": [0, 0.68333, 0.16389, 0, 0.89666],
    "78": [0, 0.68333, 0.16389, 0, 0.74333],
    "79": [0, 0.68333, 0.09403, 0, 0.76666],
    "80": [0, 0.68333, 0.10257, 0, 0.67833],
    "81": [0.19444, 0.68333, 0.09403, 0, 0.76666],
    "82": [0, 0.68333, 0.03868, 0, 0.72944],
    "83": [0, 0.68333, 0.11972, 0, 0.56222],
    "84": [0, 0.68333, 0.13305, 0, 0.71555],
    "85": [0, 0.68333, 0.16389, 0, 0.74333],
    "86": [0, 0.68333, 0.18361, 0, 0.74333],
    "87": [0, 0.68333, 0.18361, 0, 0.99888],
    "88": [0, 0.68333, 0.15806, 0, 0.74333],
    "89": [0, 0.68333, 0.19383, 0, 0.74333],
    "90": [0, 0.68333, 0.14528, 0, 0.61333],
    "91": [0.25, 0.75, 0.1875, 0, 0.30667],
    "93": [0.25, 0.75, 0.10528, 0, 0.30667],
    "94": [0, 0.69444, 0.06646, 0, 0.51111],
    "95": [0.31, 0.12056, 0.09208, 0, 0.51111],
    "97": [0, 0.43056, 0.07671, 0, 0.51111],
    "98": [0, 0.69444, 0.06312, 0, 0.46],
    "99": [0, 0.43056, 0.05653, 0, 0.46],
    "100": [0, 0.69444, 0.10333, 0, 0.51111],
    "101": [0, 0.43056, 0.07514, 0, 0.46],
    "102": [0.19444, 0.69444, 0.21194, 0, 0.30667],
    "103": [0.19444, 0.43056, 0.08847, 0, 0.46],
    "104": [0, 0.69444, 0.07671, 0, 0.51111],
    "105": [0, 0.65536, 0.1019, 0, 0.30667],
    "106": [0.19444, 0.65536, 0.14467, 0, 0.30667],
    "107": [0, 0.69444, 0.10764, 0, 0.46],
    "108": [0, 0.69444, 0.10333, 0, 0.25555],
    "109": [0, 0.43056, 0.07671, 0, 0.81777],
    "110": [0, 0.43056, 0.07671, 0, 0.56222],
    "111": [0, 0.43056, 0.06312, 0, 0.51111],
    "112": [0.19444, 0.43056, 0.06312, 0, 0.51111],
    "113": [0.19444, 0.43056, 0.08847, 0, 0.46],
    "114": [0, 0.43056, 0.10764, 0, 0.42166],
    "115": [0, 0.43056, 0.08208, 0, 0.40889],
    "116": [0, 0.61508, 0.09486, 0, 0.33222],
    "117": [0, 0.43056, 0.07671, 0, 0.53666],
    "118": [0, 0.43056, 0.10764, 0, 0.46],
    "119": [0, 0.43056, 0.10764, 0, 0.66444],
    "120": [0, 0.43056, 0.12042, 0, 0.46389],
    "121": [0.19444, 0.43056, 0.08847, 0, 0.48555],
    "122": [0, 0.43056, 0.12292, 0, 0.40889],
    "126": [0.35, 0.31786, 0.11585, 0, 0.51111],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.66786, 0.10474, 0, 0.51111],
    "176": [0, 0.69444, 0, 0, 0.83129],
    "184": [0.17014, 0, 0, 0, 0.46],
    "198": [0, 0.68333, 0.12028, 0, 0.88277],
    "216": [0.04861, 0.73194, 0.09403, 0, 0.76666],
    "223": [0.19444, 0.69444, 0.10514, 0, 0.53666],
    "230": [0, 0.43056, 0.07514, 0, 0.71555],
    "248": [0.09722, 0.52778, 0.09194, 0, 0.51111],
    "338": [0, 0.68333, 0.12028, 0, 0.98499],
    "339": [0, 0.43056, 0.07514, 0, 0.71555],
    "710": [0, 0.69444, 0.06646, 0, 0.51111],
    "711": [0, 0.62847, 0.08295, 0, 0.51111],
    "713": [0, 0.56167, 0.10333, 0, 0.51111],
    "714": [0, 0.69444, 0.09694, 0, 0.51111],
    "715": [0, 0.69444, 0, 0, 0.51111],
    "728": [0, 0.69444, 0.10806, 0, 0.51111],
    "729": [0, 0.66786, 0.11752, 0, 0.30667],
    "730": [0, 0.69444, 0, 0, 0.83129],
    "732": [0, 0.66786, 0.11585, 0, 0.51111],
    "733": [0, 0.69444, 0.1225, 0, 0.51111],
    "915": [0, 0.68333, 0.13305, 0, 0.62722],
    "916": [0, 0.68333, 0, 0, 0.81777],
    "920": [0, 0.68333, 0.09403, 0, 0.76666],
    "923": [0, 0.68333, 0, 0, 0.69222],
    "926": [0, 0.68333, 0.15294, 0, 0.66444],
    "928": [0, 0.68333, 0.16389, 0, 0.74333],
    "931": [0, 0.68333, 0.12028, 0, 0.71555],
    "933": [0, 0.68333, 0.11111, 0, 0.76666],
    "934": [0, 0.68333, 0.05986, 0, 0.71555],
    "936": [0, 0.68333, 0.11111, 0, 0.76666],
    "937": [0, 0.68333, 0.10257, 0, 0.71555],
    "8211": [0, 0.43056, 0.09208, 0, 0.51111],
    "8212": [0, 0.43056, 0.09208, 0, 1.02222],
    "8216": [0, 0.69444, 0.12417, 0, 0.30667],
    "8217": [0, 0.69444, 0.12417, 0, 0.30667],
    "8220": [0, 0.69444, 0.1685, 0, 0.51444],
    "8221": [0, 0.69444, 0.06961, 0, 0.51444],
    "8463": [0, 0.68889, 0, 0, 0.54028]
  },
  "Main-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0, 0, 0.27778],
    "34": [0, 0.69444, 0, 0, 0.5],
    "35": [0.19444, 0.69444, 0, 0, 0.83334],
    "36": [0.05556, 0.75, 0, 0, 0.5],
    "37": [0.05556, 0.75, 0, 0, 0.83334],
    "38": [0, 0.69444, 0, 0, 0.77778],
    "39": [0, 0.69444, 0, 0, 0.27778],
    "40": [0.25, 0.75, 0, 0, 0.38889],
    "41": [0.25, 0.75, 0, 0, 0.38889],
    "42": [0, 0.75, 0, 0, 0.5],
    "43": [0.08333, 0.58333, 0, 0, 0.77778],
    "44": [0.19444, 0.10556, 0, 0, 0.27778],
    "45": [0, 0.43056, 0, 0, 0.33333],
    "46": [0, 0.10556, 0, 0, 0.27778],
    "47": [0.25, 0.75, 0, 0, 0.5],
    "48": [0, 0.64444, 0, 0, 0.5],
    "49": [0, 0.64444, 0, 0, 0.5],
    "50": [0, 0.64444, 0, 0, 0.5],
    "51": [0, 0.64444, 0, 0, 0.5],
    "52": [0, 0.64444, 0, 0, 0.5],
    "53": [0, 0.64444, 0, 0, 0.5],
    "54": [0, 0.64444, 0, 0, 0.5],
    "55": [0, 0.64444, 0, 0, 0.5],
    "56": [0, 0.64444, 0, 0, 0.5],
    "57": [0, 0.64444, 0, 0, 0.5],
    "58": [0, 0.43056, 0, 0, 0.27778],
    "59": [0.19444, 0.43056, 0, 0, 0.27778],
    "60": [0.0391, 0.5391, 0, 0, 0.77778],
    "61": [-0.13313, 0.36687, 0, 0, 0.77778],
    "62": [0.0391, 0.5391, 0, 0, 0.77778],
    "63": [0, 0.69444, 0, 0, 0.47222],
    "64": [0, 0.69444, 0, 0, 0.77778],
    "65": [0, 0.68333, 0, 0, 0.75],
    "66": [0, 0.68333, 0, 0, 0.70834],
    "67": [0, 0.68333, 0, 0, 0.72222],
    "68": [0, 0.68333, 0, 0, 0.76389],
    "69": [0, 0.68333, 0, 0, 0.68056],
    "70": [0, 0.68333, 0, 0, 0.65278],
    "71": [0, 0.68333, 0, 0, 0.78472],
    "72": [0, 0.68333, 0, 0, 0.75],
    "73": [0, 0.68333, 0, 0, 0.36111],
    "74": [0, 0.68333, 0, 0, 0.51389],
    "75": [0, 0.68333, 0, 0, 0.77778],
    "76": [0, 0.68333, 0, 0, 0.625],
    "77": [0, 0.68333, 0, 0, 0.91667],
    "78": [0, 0.68333, 0, 0, 0.75],
    "79": [0, 0.68333, 0, 0, 0.77778],
    "80": [0, 0.68333, 0, 0, 0.68056],
    "81": [0.19444, 0.68333, 0, 0, 0.77778],
    "82": [0, 0.68333, 0, 0, 0.73611],
    "83": [0, 0.68333, 0, 0, 0.55556],
    "84": [0, 0.68333, 0, 0, 0.72222],
    "85": [0, 0.68333, 0, 0, 0.75],
    "86": [0, 0.68333, 0.01389, 0, 0.75],
    "87": [0, 0.68333, 0.01389, 0, 1.02778],
    "88": [0, 0.68333, 0, 0, 0.75],
    "89": [0, 0.68333, 0.025, 0, 0.75],
    "90": [0, 0.68333, 0, 0, 0.61111],
    "91": [0.25, 0.75, 0, 0, 0.27778],
    "92": [0.25, 0.75, 0, 0, 0.5],
    "93": [0.25, 0.75, 0, 0, 0.27778],
    "94": [0, 0.69444, 0, 0, 0.5],
    "95": [0.31, 0.12056, 0.02778, 0, 0.5],
    "97": [0, 0.43056, 0, 0, 0.5],
    "98": [0, 0.69444, 0, 0, 0.55556],
    "99": [0, 0.43056, 0, 0, 0.44445],
    "100": [0, 0.69444, 0, 0, 0.55556],
    "101": [0, 0.43056, 0, 0, 0.44445],
    "102": [0, 0.69444, 0.07778, 0, 0.30556],
    "103": [0.19444, 0.43056, 0.01389, 0, 0.5],
    "104": [0, 0.69444, 0, 0, 0.55556],
    "105": [0, 0.66786, 0, 0, 0.27778],
    "106": [0.19444, 0.66786, 0, 0, 0.30556],
    "107": [0, 0.69444, 0, 0, 0.52778],
    "108": [0, 0.69444, 0, 0, 0.27778],
    "109": [0, 0.43056, 0, 0, 0.83334],
    "110": [0, 0.43056, 0, 0, 0.55556],
    "111": [0, 0.43056, 0, 0, 0.5],
    "112": [0.19444, 0.43056, 0, 0, 0.55556],
    "113": [0.19444, 0.43056, 0, 0, 0.52778],
    "114": [0, 0.43056, 0, 0, 0.39167],
    "115": [0, 0.43056, 0, 0, 0.39445],
    "116": [0, 0.61508, 0, 0, 0.38889],
    "117": [0, 0.43056, 0, 0, 0.55556],
    "118": [0, 0.43056, 0.01389, 0, 0.52778],
    "119": [0, 0.43056, 0.01389, 0, 0.72222],
    "120": [0, 0.43056, 0, 0, 0.52778],
    "121": [0.19444, 0.43056, 0.01389, 0, 0.52778],
    "122": [0, 0.43056, 0, 0, 0.44445],
    "123": [0.25, 0.75, 0, 0, 0.5],
    "124": [0.25, 0.75, 0, 0, 0.27778],
    "125": [0.25, 0.75, 0, 0, 0.5],
    "126": [0.35, 0.31786, 0, 0, 0.5],
    "160": [0, 0, 0, 0, 0.25],
    "163": [0, 0.69444, 0, 0, 0.76909],
    "167": [0.19444, 0.69444, 0, 0, 0.44445],
    "168": [0, 0.66786, 0, 0, 0.5],
    "172": [0, 0.43056, 0, 0, 0.66667],
    "176": [0, 0.69444, 0, 0, 0.75],
    "177": [0.08333, 0.58333, 0, 0, 0.77778],
    "182": [0.19444, 0.69444, 0, 0, 0.61111],
    "184": [0.17014, 0, 0, 0, 0.44445],
    "198": [0, 0.68333, 0, 0, 0.90278],
    "215": [0.08333, 0.58333, 0, 0, 0.77778],
    "216": [0.04861, 0.73194, 0, 0, 0.77778],
    "223": [0, 0.69444, 0, 0, 0.5],
    "230": [0, 0.43056, 0, 0, 0.72222],
    "247": [0.08333, 0.58333, 0, 0, 0.77778],
    "248": [0.09722, 0.52778, 0, 0, 0.5],
    "305": [0, 0.43056, 0, 0, 0.27778],
    "338": [0, 0.68333, 0, 0, 1.01389],
    "339": [0, 0.43056, 0, 0, 0.77778],
    "567": [0.19444, 0.43056, 0, 0, 0.30556],
    "710": [0, 0.69444, 0, 0, 0.5],
    "711": [0, 0.62847, 0, 0, 0.5],
    "713": [0, 0.56778, 0, 0, 0.5],
    "714": [0, 0.69444, 0, 0, 0.5],
    "715": [0, 0.69444, 0, 0, 0.5],
    "728": [0, 0.69444, 0, 0, 0.5],
    "729": [0, 0.66786, 0, 0, 0.27778],
    "730": [0, 0.69444, 0, 0, 0.75],
    "732": [0, 0.66786, 0, 0, 0.5],
    "733": [0, 0.69444, 0, 0, 0.5],
    "915": [0, 0.68333, 0, 0, 0.625],
    "916": [0, 0.68333, 0, 0, 0.83334],
    "920": [0, 0.68333, 0, 0, 0.77778],
    "923": [0, 0.68333, 0, 0, 0.69445],
    "926": [0, 0.68333, 0, 0, 0.66667],
    "928": [0, 0.68333, 0, 0, 0.75],
    "931": [0, 0.68333, 0, 0, 0.72222],
    "933": [0, 0.68333, 0, 0, 0.77778],
    "934": [0, 0.68333, 0, 0, 0.72222],
    "936": [0, 0.68333, 0, 0, 0.77778],
    "937": [0, 0.68333, 0, 0, 0.72222],
    "8211": [0, 0.43056, 0.02778, 0, 0.5],
    "8212": [0, 0.43056, 0.02778, 0, 1],
    "8216": [0, 0.69444, 0, 0, 0.27778],
    "8217": [0, 0.69444, 0, 0, 0.27778],
    "8220": [0, 0.69444, 0, 0, 0.5],
    "8221": [0, 0.69444, 0, 0, 0.5],
    "8224": [0.19444, 0.69444, 0, 0, 0.44445],
    "8225": [0.19444, 0.69444, 0, 0, 0.44445],
    "8230": [0, 0.123, 0, 0, 1.172],
    "8242": [0, 0.55556, 0, 0, 0.275],
    "8407": [0, 0.71444, 0.15382, 0, 0.5],
    "8463": [0, 0.68889, 0, 0, 0.54028],
    "8465": [0, 0.69444, 0, 0, 0.72222],
    "8467": [0, 0.69444, 0, 0.11111, 0.41667],
    "8472": [0.19444, 0.43056, 0, 0.11111, 0.63646],
    "8476": [0, 0.69444, 0, 0, 0.72222],
    "8501": [0, 0.69444, 0, 0, 0.61111],
    "8592": [-0.13313, 0.36687, 0, 0, 1],
    "8593": [0.19444, 0.69444, 0, 0, 0.5],
    "8594": [-0.13313, 0.36687, 0, 0, 1],
    "8595": [0.19444, 0.69444, 0, 0, 0.5],
    "8596": [-0.13313, 0.36687, 0, 0, 1],
    "8597": [0.25, 0.75, 0, 0, 0.5],
    "8598": [0.19444, 0.69444, 0, 0, 1],
    "8599": [0.19444, 0.69444, 0, 0, 1],
    "8600": [0.19444, 0.69444, 0, 0, 1],
    "8601": [0.19444, 0.69444, 0, 0, 1],
    "8614": [0.011, 0.511, 0, 0, 1],
    "8617": [0.011, 0.511, 0, 0, 1.126],
    "8618": [0.011, 0.511, 0, 0, 1.126],
    "8636": [-0.13313, 0.36687, 0, 0, 1],
    "8637": [-0.13313, 0.36687, 0, 0, 1],
    "8640": [-0.13313, 0.36687, 0, 0, 1],
    "8641": [-0.13313, 0.36687, 0, 0, 1],
    "8652": [0.011, 0.671, 0, 0, 1],
    "8656": [-0.13313, 0.36687, 0, 0, 1],
    "8657": [0.19444, 0.69444, 0, 0, 0.61111],
    "8658": [-0.13313, 0.36687, 0, 0, 1],
    "8659": [0.19444, 0.69444, 0, 0, 0.61111],
    "8660": [-0.13313, 0.36687, 0, 0, 1],
    "8661": [0.25, 0.75, 0, 0, 0.61111],
    "8704": [0, 0.69444, 0, 0, 0.55556],
    "8706": [0, 0.69444, 0.05556, 0.08334, 0.5309],
    "8707": [0, 0.69444, 0, 0, 0.55556],
    "8709": [0.05556, 0.75, 0, 0, 0.5],
    "8711": [0, 0.68333, 0, 0, 0.83334],
    "8712": [0.0391, 0.5391, 0, 0, 0.66667],
    "8715": [0.0391, 0.5391, 0, 0, 0.66667],
    "8722": [0.08333, 0.58333, 0, 0, 0.77778],
    "8723": [0.08333, 0.58333, 0, 0, 0.77778],
    "8725": [0.25, 0.75, 0, 0, 0.5],
    "8726": [0.25, 0.75, 0, 0, 0.5],
    "8727": [-0.03472, 0.46528, 0, 0, 0.5],
    "8728": [-0.05555, 0.44445, 0, 0, 0.5],
    "8729": [-0.05555, 0.44445, 0, 0, 0.5],
    "8730": [0.2, 0.8, 0, 0, 0.83334],
    "8733": [0, 0.43056, 0, 0, 0.77778],
    "8734": [0, 0.43056, 0, 0, 1],
    "8736": [0, 0.69224, 0, 0, 0.72222],
    "8739": [0.25, 0.75, 0, 0, 0.27778],
    "8741": [0.25, 0.75, 0, 0, 0.5],
    "8743": [0, 0.55556, 0, 0, 0.66667],
    "8744": [0, 0.55556, 0, 0, 0.66667],
    "8745": [0, 0.55556, 0, 0, 0.66667],
    "8746": [0, 0.55556, 0, 0, 0.66667],
    "8747": [0.19444, 0.69444, 0.11111, 0, 0.41667],
    "8764": [-0.13313, 0.36687, 0, 0, 0.77778],
    "8768": [0.19444, 0.69444, 0, 0, 0.27778],
    "8771": [-0.03625, 0.46375, 0, 0, 0.77778],
    "8773": [-0.022, 0.589, 0, 0, 0.778],
    "8776": [-0.01688, 0.48312, 0, 0, 0.77778],
    "8781": [-0.03625, 0.46375, 0, 0, 0.77778],
    "8784": [-0.133, 0.673, 0, 0, 0.778],
    "8801": [-0.03625, 0.46375, 0, 0, 0.77778],
    "8804": [0.13597, 0.63597, 0, 0, 0.77778],
    "8805": [0.13597, 0.63597, 0, 0, 0.77778],
    "8810": [0.0391, 0.5391, 0, 0, 1],
    "8811": [0.0391, 0.5391, 0, 0, 1],
    "8826": [0.0391, 0.5391, 0, 0, 0.77778],
    "8827": [0.0391, 0.5391, 0, 0, 0.77778],
    "8834": [0.0391, 0.5391, 0, 0, 0.77778],
    "8835": [0.0391, 0.5391, 0, 0, 0.77778],
    "8838": [0.13597, 0.63597, 0, 0, 0.77778],
    "8839": [0.13597, 0.63597, 0, 0, 0.77778],
    "8846": [0, 0.55556, 0, 0, 0.66667],
    "8849": [0.13597, 0.63597, 0, 0, 0.77778],
    "8850": [0.13597, 0.63597, 0, 0, 0.77778],
    "8851": [0, 0.55556, 0, 0, 0.66667],
    "8852": [0, 0.55556, 0, 0, 0.66667],
    "8853": [0.08333, 0.58333, 0, 0, 0.77778],
    "8854": [0.08333, 0.58333, 0, 0, 0.77778],
    "8855": [0.08333, 0.58333, 0, 0, 0.77778],
    "8856": [0.08333, 0.58333, 0, 0, 0.77778],
    "8857": [0.08333, 0.58333, 0, 0, 0.77778],
    "8866": [0, 0.69444, 0, 0, 0.61111],
    "8867": [0, 0.69444, 0, 0, 0.61111],
    "8868": [0, 0.69444, 0, 0, 0.77778],
    "8869": [0, 0.69444, 0, 0, 0.77778],
    "8872": [0.249, 0.75, 0, 0, 0.867],
    "8900": [-0.05555, 0.44445, 0, 0, 0.5],
    "8901": [-0.05555, 0.44445, 0, 0, 0.27778],
    "8902": [-0.03472, 0.46528, 0, 0, 0.5],
    "8904": [5e-3, 0.505, 0, 0, 0.9],
    "8942": [0.03, 0.903, 0, 0, 0.278],
    "8943": [-0.19, 0.313, 0, 0, 1.172],
    "8945": [-0.1, 0.823, 0, 0, 1.282],
    "8968": [0.25, 0.75, 0, 0, 0.44445],
    "8969": [0.25, 0.75, 0, 0, 0.44445],
    "8970": [0.25, 0.75, 0, 0, 0.44445],
    "8971": [0.25, 0.75, 0, 0, 0.44445],
    "8994": [-0.14236, 0.35764, 0, 0, 1],
    "8995": [-0.14236, 0.35764, 0, 0, 1],
    "9136": [0.244, 0.744, 0, 0, 0.412],
    "9137": [0.244, 0.745, 0, 0, 0.412],
    "9651": [0.19444, 0.69444, 0, 0, 0.88889],
    "9657": [-0.03472, 0.46528, 0, 0, 0.5],
    "9661": [0.19444, 0.69444, 0, 0, 0.88889],
    "9667": [-0.03472, 0.46528, 0, 0, 0.5],
    "9711": [0.19444, 0.69444, 0, 0, 1],
    "9824": [0.12963, 0.69444, 0, 0, 0.77778],
    "9825": [0.12963, 0.69444, 0, 0, 0.77778],
    "9826": [0.12963, 0.69444, 0, 0, 0.77778],
    "9827": [0.12963, 0.69444, 0, 0, 0.77778],
    "9837": [0, 0.75, 0, 0, 0.38889],
    "9838": [0.19444, 0.69444, 0, 0, 0.38889],
    "9839": [0.19444, 0.69444, 0, 0, 0.38889],
    "10216": [0.25, 0.75, 0, 0, 0.38889],
    "10217": [0.25, 0.75, 0, 0, 0.38889],
    "10222": [0.244, 0.744, 0, 0, 0.412],
    "10223": [0.244, 0.745, 0, 0, 0.412],
    "10229": [0.011, 0.511, 0, 0, 1.609],
    "10230": [0.011, 0.511, 0, 0, 1.638],
    "10231": [0.011, 0.511, 0, 0, 1.859],
    "10232": [0.024, 0.525, 0, 0, 1.609],
    "10233": [0.024, 0.525, 0, 0, 1.638],
    "10234": [0.024, 0.525, 0, 0, 1.858],
    "10236": [0.011, 0.511, 0, 0, 1.638],
    "10815": [0, 0.68333, 0, 0, 0.75],
    "10927": [0.13597, 0.63597, 0, 0, 0.77778],
    "10928": [0.13597, 0.63597, 0, 0, 0.77778],
    "57376": [0.19444, 0.69444, 0, 0, 0]
  },
  "Math-BoldItalic": {
    "32": [0, 0, 0, 0, 0.25],
    "48": [0, 0.44444, 0, 0, 0.575],
    "49": [0, 0.44444, 0, 0, 0.575],
    "50": [0, 0.44444, 0, 0, 0.575],
    "51": [0.19444, 0.44444, 0, 0, 0.575],
    "52": [0.19444, 0.44444, 0, 0, 0.575],
    "53": [0.19444, 0.44444, 0, 0, 0.575],
    "54": [0, 0.64444, 0, 0, 0.575],
    "55": [0.19444, 0.44444, 0, 0, 0.575],
    "56": [0, 0.64444, 0, 0, 0.575],
    "57": [0.19444, 0.44444, 0, 0, 0.575],
    "65": [0, 0.68611, 0, 0, 0.86944],
    "66": [0, 0.68611, 0.04835, 0, 0.8664],
    "67": [0, 0.68611, 0.06979, 0, 0.81694],
    "68": [0, 0.68611, 0.03194, 0, 0.93812],
    "69": [0, 0.68611, 0.05451, 0, 0.81007],
    "70": [0, 0.68611, 0.15972, 0, 0.68889],
    "71": [0, 0.68611, 0, 0, 0.88673],
    "72": [0, 0.68611, 0.08229, 0, 0.98229],
    "73": [0, 0.68611, 0.07778, 0, 0.51111],
    "74": [0, 0.68611, 0.10069, 0, 0.63125],
    "75": [0, 0.68611, 0.06979, 0, 0.97118],
    "76": [0, 0.68611, 0, 0, 0.75555],
    "77": [0, 0.68611, 0.11424, 0, 1.14201],
    "78": [0, 0.68611, 0.11424, 0, 0.95034],
    "79": [0, 0.68611, 0.03194, 0, 0.83666],
    "80": [0, 0.68611, 0.15972, 0, 0.72309],
    "81": [0.19444, 0.68611, 0, 0, 0.86861],
    "82": [0, 0.68611, 421e-5, 0, 0.87235],
    "83": [0, 0.68611, 0.05382, 0, 0.69271],
    "84": [0, 0.68611, 0.15972, 0, 0.63663],
    "85": [0, 0.68611, 0.11424, 0, 0.80027],
    "86": [0, 0.68611, 0.25555, 0, 0.67778],
    "87": [0, 0.68611, 0.15972, 0, 1.09305],
    "88": [0, 0.68611, 0.07778, 0, 0.94722],
    "89": [0, 0.68611, 0.25555, 0, 0.67458],
    "90": [0, 0.68611, 0.06979, 0, 0.77257],
    "97": [0, 0.44444, 0, 0, 0.63287],
    "98": [0, 0.69444, 0, 0, 0.52083],
    "99": [0, 0.44444, 0, 0, 0.51342],
    "100": [0, 0.69444, 0, 0, 0.60972],
    "101": [0, 0.44444, 0, 0, 0.55361],
    "102": [0.19444, 0.69444, 0.11042, 0, 0.56806],
    "103": [0.19444, 0.44444, 0.03704, 0, 0.5449],
    "104": [0, 0.69444, 0, 0, 0.66759],
    "105": [0, 0.69326, 0, 0, 0.4048],
    "106": [0.19444, 0.69326, 0.0622, 0, 0.47083],
    "107": [0, 0.69444, 0.01852, 0, 0.6037],
    "108": [0, 0.69444, 88e-4, 0, 0.34815],
    "109": [0, 0.44444, 0, 0, 1.0324],
    "110": [0, 0.44444, 0, 0, 0.71296],
    "111": [0, 0.44444, 0, 0, 0.58472],
    "112": [0.19444, 0.44444, 0, 0, 0.60092],
    "113": [0.19444, 0.44444, 0.03704, 0, 0.54213],
    "114": [0, 0.44444, 0.03194, 0, 0.5287],
    "115": [0, 0.44444, 0, 0, 0.53125],
    "116": [0, 0.63492, 0, 0, 0.41528],
    "117": [0, 0.44444, 0, 0, 0.68102],
    "118": [0, 0.44444, 0.03704, 0, 0.56666],
    "119": [0, 0.44444, 0.02778, 0, 0.83148],
    "120": [0, 0.44444, 0, 0, 0.65903],
    "121": [0.19444, 0.44444, 0.03704, 0, 0.59028],
    "122": [0, 0.44444, 0.04213, 0, 0.55509],
    "160": [0, 0, 0, 0, 0.25],
    "915": [0, 0.68611, 0.15972, 0, 0.65694],
    "916": [0, 0.68611, 0, 0, 0.95833],
    "920": [0, 0.68611, 0.03194, 0, 0.86722],
    "923": [0, 0.68611, 0, 0, 0.80555],
    "926": [0, 0.68611, 0.07458, 0, 0.84125],
    "928": [0, 0.68611, 0.08229, 0, 0.98229],
    "931": [0, 0.68611, 0.05451, 0, 0.88507],
    "933": [0, 0.68611, 0.15972, 0, 0.67083],
    "934": [0, 0.68611, 0, 0, 0.76666],
    "936": [0, 0.68611, 0.11653, 0, 0.71402],
    "937": [0, 0.68611, 0.04835, 0, 0.8789],
    "945": [0, 0.44444, 0, 0, 0.76064],
    "946": [0.19444, 0.69444, 0.03403, 0, 0.65972],
    "947": [0.19444, 0.44444, 0.06389, 0, 0.59003],
    "948": [0, 0.69444, 0.03819, 0, 0.52222],
    "949": [0, 0.44444, 0, 0, 0.52882],
    "950": [0.19444, 0.69444, 0.06215, 0, 0.50833],
    "951": [0.19444, 0.44444, 0.03704, 0, 0.6],
    "952": [0, 0.69444, 0.03194, 0, 0.5618],
    "953": [0, 0.44444, 0, 0, 0.41204],
    "954": [0, 0.44444, 0, 0, 0.66759],
    "955": [0, 0.69444, 0, 0, 0.67083],
    "956": [0.19444, 0.44444, 0, 0, 0.70787],
    "957": [0, 0.44444, 0.06898, 0, 0.57685],
    "958": [0.19444, 0.69444, 0.03021, 0, 0.50833],
    "959": [0, 0.44444, 0, 0, 0.58472],
    "960": [0, 0.44444, 0.03704, 0, 0.68241],
    "961": [0.19444, 0.44444, 0, 0, 0.6118],
    "962": [0.09722, 0.44444, 0.07917, 0, 0.42361],
    "963": [0, 0.44444, 0.03704, 0, 0.68588],
    "964": [0, 0.44444, 0.13472, 0, 0.52083],
    "965": [0, 0.44444, 0.03704, 0, 0.63055],
    "966": [0.19444, 0.44444, 0, 0, 0.74722],
    "967": [0.19444, 0.44444, 0, 0, 0.71805],
    "968": [0.19444, 0.69444, 0.03704, 0, 0.75833],
    "969": [0, 0.44444, 0.03704, 0, 0.71782],
    "977": [0, 0.69444, 0, 0, 0.69155],
    "981": [0.19444, 0.69444, 0, 0, 0.7125],
    "982": [0, 0.44444, 0.03194, 0, 0.975],
    "1009": [0.19444, 0.44444, 0, 0, 0.6118],
    "1013": [0, 0.44444, 0, 0, 0.48333],
    "57649": [0, 0.44444, 0, 0, 0.39352],
    "57911": [0.19444, 0.44444, 0, 0, 0.43889]
  },
  "Math-Italic": {
    "32": [0, 0, 0, 0, 0.25],
    "48": [0, 0.43056, 0, 0, 0.5],
    "49": [0, 0.43056, 0, 0, 0.5],
    "50": [0, 0.43056, 0, 0, 0.5],
    "51": [0.19444, 0.43056, 0, 0, 0.5],
    "52": [0.19444, 0.43056, 0, 0, 0.5],
    "53": [0.19444, 0.43056, 0, 0, 0.5],
    "54": [0, 0.64444, 0, 0, 0.5],
    "55": [0.19444, 0.43056, 0, 0, 0.5],
    "56": [0, 0.64444, 0, 0, 0.5],
    "57": [0.19444, 0.43056, 0, 0, 0.5],
    "65": [0, 0.68333, 0, 0.13889, 0.75],
    "66": [0, 0.68333, 0.05017, 0.08334, 0.75851],
    "67": [0, 0.68333, 0.07153, 0.08334, 0.71472],
    "68": [0, 0.68333, 0.02778, 0.05556, 0.82792],
    "69": [0, 0.68333, 0.05764, 0.08334, 0.7382],
    "70": [0, 0.68333, 0.13889, 0.08334, 0.64306],
    "71": [0, 0.68333, 0, 0.08334, 0.78625],
    "72": [0, 0.68333, 0.08125, 0.05556, 0.83125],
    "73": [0, 0.68333, 0.07847, 0.11111, 0.43958],
    "74": [0, 0.68333, 0.09618, 0.16667, 0.55451],
    "75": [0, 0.68333, 0.07153, 0.05556, 0.84931],
    "76": [0, 0.68333, 0, 0.02778, 0.68056],
    "77": [0, 0.68333, 0.10903, 0.08334, 0.97014],
    "78": [0, 0.68333, 0.10903, 0.08334, 0.80347],
    "79": [0, 0.68333, 0.02778, 0.08334, 0.76278],
    "80": [0, 0.68333, 0.13889, 0.08334, 0.64201],
    "81": [0.19444, 0.68333, 0, 0.08334, 0.79056],
    "82": [0, 0.68333, 773e-5, 0.08334, 0.75929],
    "83": [0, 0.68333, 0.05764, 0.08334, 0.6132],
    "84": [0, 0.68333, 0.13889, 0.08334, 0.58438],
    "85": [0, 0.68333, 0.10903, 0.02778, 0.68278],
    "86": [0, 0.68333, 0.22222, 0, 0.58333],
    "87": [0, 0.68333, 0.13889, 0, 0.94445],
    "88": [0, 0.68333, 0.07847, 0.08334, 0.82847],
    "89": [0, 0.68333, 0.22222, 0, 0.58056],
    "90": [0, 0.68333, 0.07153, 0.08334, 0.68264],
    "97": [0, 0.43056, 0, 0, 0.52859],
    "98": [0, 0.69444, 0, 0, 0.42917],
    "99": [0, 0.43056, 0, 0.05556, 0.43276],
    "100": [0, 0.69444, 0, 0.16667, 0.52049],
    "101": [0, 0.43056, 0, 0.05556, 0.46563],
    "102": [0.19444, 0.69444, 0.10764, 0.16667, 0.48959],
    "103": [0.19444, 0.43056, 0.03588, 0.02778, 0.47697],
    "104": [0, 0.69444, 0, 0, 0.57616],
    "105": [0, 0.65952, 0, 0, 0.34451],
    "106": [0.19444, 0.65952, 0.05724, 0, 0.41181],
    "107": [0, 0.69444, 0.03148, 0, 0.5206],
    "108": [0, 0.69444, 0.01968, 0.08334, 0.29838],
    "109": [0, 0.43056, 0, 0, 0.87801],
    "110": [0, 0.43056, 0, 0, 0.60023],
    "111": [0, 0.43056, 0, 0.05556, 0.48472],
    "112": [0.19444, 0.43056, 0, 0.08334, 0.50313],
    "113": [0.19444, 0.43056, 0.03588, 0.08334, 0.44641],
    "114": [0, 0.43056, 0.02778, 0.05556, 0.45116],
    "115": [0, 0.43056, 0, 0.05556, 0.46875],
    "116": [0, 0.61508, 0, 0.08334, 0.36111],
    "117": [0, 0.43056, 0, 0.02778, 0.57246],
    "118": [0, 0.43056, 0.03588, 0.02778, 0.48472],
    "119": [0, 0.43056, 0.02691, 0.08334, 0.71592],
    "120": [0, 0.43056, 0, 0.02778, 0.57153],
    "121": [0.19444, 0.43056, 0.03588, 0.05556, 0.49028],
    "122": [0, 0.43056, 0.04398, 0.05556, 0.46505],
    "160": [0, 0, 0, 0, 0.25],
    "915": [0, 0.68333, 0.13889, 0.08334, 0.61528],
    "916": [0, 0.68333, 0, 0.16667, 0.83334],
    "920": [0, 0.68333, 0.02778, 0.08334, 0.76278],
    "923": [0, 0.68333, 0, 0.16667, 0.69445],
    "926": [0, 0.68333, 0.07569, 0.08334, 0.74236],
    "928": [0, 0.68333, 0.08125, 0.05556, 0.83125],
    "931": [0, 0.68333, 0.05764, 0.08334, 0.77986],
    "933": [0, 0.68333, 0.13889, 0.05556, 0.58333],
    "934": [0, 0.68333, 0, 0.08334, 0.66667],
    "936": [0, 0.68333, 0.11, 0.05556, 0.61222],
    "937": [0, 0.68333, 0.05017, 0.08334, 0.7724],
    "945": [0, 0.43056, 37e-4, 0.02778, 0.6397],
    "946": [0.19444, 0.69444, 0.05278, 0.08334, 0.56563],
    "947": [0.19444, 0.43056, 0.05556, 0, 0.51773],
    "948": [0, 0.69444, 0.03785, 0.05556, 0.44444],
    "949": [0, 0.43056, 0, 0.08334, 0.46632],
    "950": [0.19444, 0.69444, 0.07378, 0.08334, 0.4375],
    "951": [0.19444, 0.43056, 0.03588, 0.05556, 0.49653],
    "952": [0, 0.69444, 0.02778, 0.08334, 0.46944],
    "953": [0, 0.43056, 0, 0.05556, 0.35394],
    "954": [0, 0.43056, 0, 0, 0.57616],
    "955": [0, 0.69444, 0, 0, 0.58334],
    "956": [0.19444, 0.43056, 0, 0.02778, 0.60255],
    "957": [0, 0.43056, 0.06366, 0.02778, 0.49398],
    "958": [0.19444, 0.69444, 0.04601, 0.11111, 0.4375],
    "959": [0, 0.43056, 0, 0.05556, 0.48472],
    "960": [0, 0.43056, 0.03588, 0, 0.57003],
    "961": [0.19444, 0.43056, 0, 0.08334, 0.51702],
    "962": [0.09722, 0.43056, 0.07986, 0.08334, 0.36285],
    "963": [0, 0.43056, 0.03588, 0, 0.57141],
    "964": [0, 0.43056, 0.1132, 0.02778, 0.43715],
    "965": [0, 0.43056, 0.03588, 0.02778, 0.54028],
    "966": [0.19444, 0.43056, 0, 0.08334, 0.65417],
    "967": [0.19444, 0.43056, 0, 0.05556, 0.62569],
    "968": [0.19444, 0.69444, 0.03588, 0.11111, 0.65139],
    "969": [0, 0.43056, 0.03588, 0, 0.62245],
    "977": [0, 0.69444, 0, 0.08334, 0.59144],
    "981": [0.19444, 0.69444, 0, 0.08334, 0.59583],
    "982": [0, 0.43056, 0.02778, 0, 0.82813],
    "1009": [0.19444, 0.43056, 0, 0.08334, 0.51702],
    "1013": [0, 0.43056, 0, 0.05556, 0.4059],
    "57649": [0, 0.43056, 0, 0.02778, 0.32246],
    "57911": [0.19444, 0.43056, 0, 0.08334, 0.38403]
  },
  "SansSerif-Bold": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0, 0, 0.36667],
    "34": [0, 0.69444, 0, 0, 0.55834],
    "35": [0.19444, 0.69444, 0, 0, 0.91667],
    "36": [0.05556, 0.75, 0, 0, 0.55],
    "37": [0.05556, 0.75, 0, 0, 1.02912],
    "38": [0, 0.69444, 0, 0, 0.83056],
    "39": [0, 0.69444, 0, 0, 0.30556],
    "40": [0.25, 0.75, 0, 0, 0.42778],
    "41": [0.25, 0.75, 0, 0, 0.42778],
    "42": [0, 0.75, 0, 0, 0.55],
    "43": [0.11667, 0.61667, 0, 0, 0.85556],
    "44": [0.10556, 0.13056, 0, 0, 0.30556],
    "45": [0, 0.45833, 0, 0, 0.36667],
    "46": [0, 0.13056, 0, 0, 0.30556],
    "47": [0.25, 0.75, 0, 0, 0.55],
    "48": [0, 0.69444, 0, 0, 0.55],
    "49": [0, 0.69444, 0, 0, 0.55],
    "50": [0, 0.69444, 0, 0, 0.55],
    "51": [0, 0.69444, 0, 0, 0.55],
    "52": [0, 0.69444, 0, 0, 0.55],
    "53": [0, 0.69444, 0, 0, 0.55],
    "54": [0, 0.69444, 0, 0, 0.55],
    "55": [0, 0.69444, 0, 0, 0.55],
    "56": [0, 0.69444, 0, 0, 0.55],
    "57": [0, 0.69444, 0, 0, 0.55],
    "58": [0, 0.45833, 0, 0, 0.30556],
    "59": [0.10556, 0.45833, 0, 0, 0.30556],
    "61": [-0.09375, 0.40625, 0, 0, 0.85556],
    "63": [0, 0.69444, 0, 0, 0.51945],
    "64": [0, 0.69444, 0, 0, 0.73334],
    "65": [0, 0.69444, 0, 0, 0.73334],
    "66": [0, 0.69444, 0, 0, 0.73334],
    "67": [0, 0.69444, 0, 0, 0.70278],
    "68": [0, 0.69444, 0, 0, 0.79445],
    "69": [0, 0.69444, 0, 0, 0.64167],
    "70": [0, 0.69444, 0, 0, 0.61111],
    "71": [0, 0.69444, 0, 0, 0.73334],
    "72": [0, 0.69444, 0, 0, 0.79445],
    "73": [0, 0.69444, 0, 0, 0.33056],
    "74": [0, 0.69444, 0, 0, 0.51945],
    "75": [0, 0.69444, 0, 0, 0.76389],
    "76": [0, 0.69444, 0, 0, 0.58056],
    "77": [0, 0.69444, 0, 0, 0.97778],
    "78": [0, 0.69444, 0, 0, 0.79445],
    "79": [0, 0.69444, 0, 0, 0.79445],
    "80": [0, 0.69444, 0, 0, 0.70278],
    "81": [0.10556, 0.69444, 0, 0, 0.79445],
    "82": [0, 0.69444, 0, 0, 0.70278],
    "83": [0, 0.69444, 0, 0, 0.61111],
    "84": [0, 0.69444, 0, 0, 0.73334],
    "85": [0, 0.69444, 0, 0, 0.76389],
    "86": [0, 0.69444, 0.01528, 0, 0.73334],
    "87": [0, 0.69444, 0.01528, 0, 1.03889],
    "88": [0, 0.69444, 0, 0, 0.73334],
    "89": [0, 0.69444, 0.0275, 0, 0.73334],
    "90": [0, 0.69444, 0, 0, 0.67223],
    "91": [0.25, 0.75, 0, 0, 0.34306],
    "93": [0.25, 0.75, 0, 0, 0.34306],
    "94": [0, 0.69444, 0, 0, 0.55],
    "95": [0.35, 0.10833, 0.03056, 0, 0.55],
    "97": [0, 0.45833, 0, 0, 0.525],
    "98": [0, 0.69444, 0, 0, 0.56111],
    "99": [0, 0.45833, 0, 0, 0.48889],
    "100": [0, 0.69444, 0, 0, 0.56111],
    "101": [0, 0.45833, 0, 0, 0.51111],
    "102": [0, 0.69444, 0.07639, 0, 0.33611],
    "103": [0.19444, 0.45833, 0.01528, 0, 0.55],
    "104": [0, 0.69444, 0, 0, 0.56111],
    "105": [0, 0.69444, 0, 0, 0.25556],
    "106": [0.19444, 0.69444, 0, 0, 0.28611],
    "107": [0, 0.69444, 0, 0, 0.53056],
    "108": [0, 0.69444, 0, 0, 0.25556],
    "109": [0, 0.45833, 0, 0, 0.86667],
    "110": [0, 0.45833, 0, 0, 0.56111],
    "111": [0, 0.45833, 0, 0, 0.55],
    "112": [0.19444, 0.45833, 0, 0, 0.56111],
    "113": [0.19444, 0.45833, 0, 0, 0.56111],
    "114": [0, 0.45833, 0.01528, 0, 0.37222],
    "115": [0, 0.45833, 0, 0, 0.42167],
    "116": [0, 0.58929, 0, 0, 0.40417],
    "117": [0, 0.45833, 0, 0, 0.56111],
    "118": [0, 0.45833, 0.01528, 0, 0.5],
    "119": [0, 0.45833, 0.01528, 0, 0.74445],
    "120": [0, 0.45833, 0, 0, 0.5],
    "121": [0.19444, 0.45833, 0.01528, 0, 0.5],
    "122": [0, 0.45833, 0, 0, 0.47639],
    "126": [0.35, 0.34444, 0, 0, 0.55],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.69444, 0, 0, 0.55],
    "176": [0, 0.69444, 0, 0, 0.73334],
    "180": [0, 0.69444, 0, 0, 0.55],
    "184": [0.17014, 0, 0, 0, 0.48889],
    "305": [0, 0.45833, 0, 0, 0.25556],
    "567": [0.19444, 0.45833, 0, 0, 0.28611],
    "710": [0, 0.69444, 0, 0, 0.55],
    "711": [0, 0.63542, 0, 0, 0.55],
    "713": [0, 0.63778, 0, 0, 0.55],
    "728": [0, 0.69444, 0, 0, 0.55],
    "729": [0, 0.69444, 0, 0, 0.30556],
    "730": [0, 0.69444, 0, 0, 0.73334],
    "732": [0, 0.69444, 0, 0, 0.55],
    "733": [0, 0.69444, 0, 0, 0.55],
    "915": [0, 0.69444, 0, 0, 0.58056],
    "916": [0, 0.69444, 0, 0, 0.91667],
    "920": [0, 0.69444, 0, 0, 0.85556],
    "923": [0, 0.69444, 0, 0, 0.67223],
    "926": [0, 0.69444, 0, 0, 0.73334],
    "928": [0, 0.69444, 0, 0, 0.79445],
    "931": [0, 0.69444, 0, 0, 0.79445],
    "933": [0, 0.69444, 0, 0, 0.85556],
    "934": [0, 0.69444, 0, 0, 0.79445],
    "936": [0, 0.69444, 0, 0, 0.85556],
    "937": [0, 0.69444, 0, 0, 0.79445],
    "8211": [0, 0.45833, 0.03056, 0, 0.55],
    "8212": [0, 0.45833, 0.03056, 0, 1.10001],
    "8216": [0, 0.69444, 0, 0, 0.30556],
    "8217": [0, 0.69444, 0, 0, 0.30556],
    "8220": [0, 0.69444, 0, 0, 0.55834],
    "8221": [0, 0.69444, 0, 0, 0.55834]
  },
  "SansSerif-Italic": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0.05733, 0, 0.31945],
    "34": [0, 0.69444, 316e-5, 0, 0.5],
    "35": [0.19444, 0.69444, 0.05087, 0, 0.83334],
    "36": [0.05556, 0.75, 0.11156, 0, 0.5],
    "37": [0.05556, 0.75, 0.03126, 0, 0.83334],
    "38": [0, 0.69444, 0.03058, 0, 0.75834],
    "39": [0, 0.69444, 0.07816, 0, 0.27778],
    "40": [0.25, 0.75, 0.13164, 0, 0.38889],
    "41": [0.25, 0.75, 0.02536, 0, 0.38889],
    "42": [0, 0.75, 0.11775, 0, 0.5],
    "43": [0.08333, 0.58333, 0.02536, 0, 0.77778],
    "44": [0.125, 0.08333, 0, 0, 0.27778],
    "45": [0, 0.44444, 0.01946, 0, 0.33333],
    "46": [0, 0.08333, 0, 0, 0.27778],
    "47": [0.25, 0.75, 0.13164, 0, 0.5],
    "48": [0, 0.65556, 0.11156, 0, 0.5],
    "49": [0, 0.65556, 0.11156, 0, 0.5],
    "50": [0, 0.65556, 0.11156, 0, 0.5],
    "51": [0, 0.65556, 0.11156, 0, 0.5],
    "52": [0, 0.65556, 0.11156, 0, 0.5],
    "53": [0, 0.65556, 0.11156, 0, 0.5],
    "54": [0, 0.65556, 0.11156, 0, 0.5],
    "55": [0, 0.65556, 0.11156, 0, 0.5],
    "56": [0, 0.65556, 0.11156, 0, 0.5],
    "57": [0, 0.65556, 0.11156, 0, 0.5],
    "58": [0, 0.44444, 0.02502, 0, 0.27778],
    "59": [0.125, 0.44444, 0.02502, 0, 0.27778],
    "61": [-0.13, 0.37, 0.05087, 0, 0.77778],
    "63": [0, 0.69444, 0.11809, 0, 0.47222],
    "64": [0, 0.69444, 0.07555, 0, 0.66667],
    "65": [0, 0.69444, 0, 0, 0.66667],
    "66": [0, 0.69444, 0.08293, 0, 0.66667],
    "67": [0, 0.69444, 0.11983, 0, 0.63889],
    "68": [0, 0.69444, 0.07555, 0, 0.72223],
    "69": [0, 0.69444, 0.11983, 0, 0.59722],
    "70": [0, 0.69444, 0.13372, 0, 0.56945],
    "71": [0, 0.69444, 0.11983, 0, 0.66667],
    "72": [0, 0.69444, 0.08094, 0, 0.70834],
    "73": [0, 0.69444, 0.13372, 0, 0.27778],
    "74": [0, 0.69444, 0.08094, 0, 0.47222],
    "75": [0, 0.69444, 0.11983, 0, 0.69445],
    "76": [0, 0.69444, 0, 0, 0.54167],
    "77": [0, 0.69444, 0.08094, 0, 0.875],
    "78": [0, 0.69444, 0.08094, 0, 0.70834],
    "79": [0, 0.69444, 0.07555, 0, 0.73611],
    "80": [0, 0.69444, 0.08293, 0, 0.63889],
    "81": [0.125, 0.69444, 0.07555, 0, 0.73611],
    "82": [0, 0.69444, 0.08293, 0, 0.64584],
    "83": [0, 0.69444, 0.09205, 0, 0.55556],
    "84": [0, 0.69444, 0.13372, 0, 0.68056],
    "85": [0, 0.69444, 0.08094, 0, 0.6875],
    "86": [0, 0.69444, 0.1615, 0, 0.66667],
    "87": [0, 0.69444, 0.1615, 0, 0.94445],
    "88": [0, 0.69444, 0.13372, 0, 0.66667],
    "89": [0, 0.69444, 0.17261, 0, 0.66667],
    "90": [0, 0.69444, 0.11983, 0, 0.61111],
    "91": [0.25, 0.75, 0.15942, 0, 0.28889],
    "93": [0.25, 0.75, 0.08719, 0, 0.28889],
    "94": [0, 0.69444, 0.0799, 0, 0.5],
    "95": [0.35, 0.09444, 0.08616, 0, 0.5],
    "97": [0, 0.44444, 981e-5, 0, 0.48056],
    "98": [0, 0.69444, 0.03057, 0, 0.51667],
    "99": [0, 0.44444, 0.08336, 0, 0.44445],
    "100": [0, 0.69444, 0.09483, 0, 0.51667],
    "101": [0, 0.44444, 0.06778, 0, 0.44445],
    "102": [0, 0.69444, 0.21705, 0, 0.30556],
    "103": [0.19444, 0.44444, 0.10836, 0, 0.5],
    "104": [0, 0.69444, 0.01778, 0, 0.51667],
    "105": [0, 0.67937, 0.09718, 0, 0.23889],
    "106": [0.19444, 0.67937, 0.09162, 0, 0.26667],
    "107": [0, 0.69444, 0.08336, 0, 0.48889],
    "108": [0, 0.69444, 0.09483, 0, 0.23889],
    "109": [0, 0.44444, 0.01778, 0, 0.79445],
    "110": [0, 0.44444, 0.01778, 0, 0.51667],
    "111": [0, 0.44444, 0.06613, 0, 0.5],
    "112": [0.19444, 0.44444, 0.0389, 0, 0.51667],
    "113": [0.19444, 0.44444, 0.04169, 0, 0.51667],
    "114": [0, 0.44444, 0.10836, 0, 0.34167],
    "115": [0, 0.44444, 0.0778, 0, 0.38333],
    "116": [0, 0.57143, 0.07225, 0, 0.36111],
    "117": [0, 0.44444, 0.04169, 0, 0.51667],
    "118": [0, 0.44444, 0.10836, 0, 0.46111],
    "119": [0, 0.44444, 0.10836, 0, 0.68334],
    "120": [0, 0.44444, 0.09169, 0, 0.46111],
    "121": [0.19444, 0.44444, 0.10836, 0, 0.46111],
    "122": [0, 0.44444, 0.08752, 0, 0.43472],
    "126": [0.35, 0.32659, 0.08826, 0, 0.5],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.67937, 0.06385, 0, 0.5],
    "176": [0, 0.69444, 0, 0, 0.73752],
    "184": [0.17014, 0, 0, 0, 0.44445],
    "305": [0, 0.44444, 0.04169, 0, 0.23889],
    "567": [0.19444, 0.44444, 0.04169, 0, 0.26667],
    "710": [0, 0.69444, 0.0799, 0, 0.5],
    "711": [0, 0.63194, 0.08432, 0, 0.5],
    "713": [0, 0.60889, 0.08776, 0, 0.5],
    "714": [0, 0.69444, 0.09205, 0, 0.5],
    "715": [0, 0.69444, 0, 0, 0.5],
    "728": [0, 0.69444, 0.09483, 0, 0.5],
    "729": [0, 0.67937, 0.07774, 0, 0.27778],
    "730": [0, 0.69444, 0, 0, 0.73752],
    "732": [0, 0.67659, 0.08826, 0, 0.5],
    "733": [0, 0.69444, 0.09205, 0, 0.5],
    "915": [0, 0.69444, 0.13372, 0, 0.54167],
    "916": [0, 0.69444, 0, 0, 0.83334],
    "920": [0, 0.69444, 0.07555, 0, 0.77778],
    "923": [0, 0.69444, 0, 0, 0.61111],
    "926": [0, 0.69444, 0.12816, 0, 0.66667],
    "928": [0, 0.69444, 0.08094, 0, 0.70834],
    "931": [0, 0.69444, 0.11983, 0, 0.72222],
    "933": [0, 0.69444, 0.09031, 0, 0.77778],
    "934": [0, 0.69444, 0.04603, 0, 0.72222],
    "936": [0, 0.69444, 0.09031, 0, 0.77778],
    "937": [0, 0.69444, 0.08293, 0, 0.72222],
    "8211": [0, 0.44444, 0.08616, 0, 0.5],
    "8212": [0, 0.44444, 0.08616, 0, 1],
    "8216": [0, 0.69444, 0.07816, 0, 0.27778],
    "8217": [0, 0.69444, 0.07816, 0, 0.27778],
    "8220": [0, 0.69444, 0.14205, 0, 0.5],
    "8221": [0, 0.69444, 316e-5, 0, 0.5]
  },
  "SansSerif-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "33": [0, 0.69444, 0, 0, 0.31945],
    "34": [0, 0.69444, 0, 0, 0.5],
    "35": [0.19444, 0.69444, 0, 0, 0.83334],
    "36": [0.05556, 0.75, 0, 0, 0.5],
    "37": [0.05556, 0.75, 0, 0, 0.83334],
    "38": [0, 0.69444, 0, 0, 0.75834],
    "39": [0, 0.69444, 0, 0, 0.27778],
    "40": [0.25, 0.75, 0, 0, 0.38889],
    "41": [0.25, 0.75, 0, 0, 0.38889],
    "42": [0, 0.75, 0, 0, 0.5],
    "43": [0.08333, 0.58333, 0, 0, 0.77778],
    "44": [0.125, 0.08333, 0, 0, 0.27778],
    "45": [0, 0.44444, 0, 0, 0.33333],
    "46": [0, 0.08333, 0, 0, 0.27778],
    "47": [0.25, 0.75, 0, 0, 0.5],
    "48": [0, 0.65556, 0, 0, 0.5],
    "49": [0, 0.65556, 0, 0, 0.5],
    "50": [0, 0.65556, 0, 0, 0.5],
    "51": [0, 0.65556, 0, 0, 0.5],
    "52": [0, 0.65556, 0, 0, 0.5],
    "53": [0, 0.65556, 0, 0, 0.5],
    "54": [0, 0.65556, 0, 0, 0.5],
    "55": [0, 0.65556, 0, 0, 0.5],
    "56": [0, 0.65556, 0, 0, 0.5],
    "57": [0, 0.65556, 0, 0, 0.5],
    "58": [0, 0.44444, 0, 0, 0.27778],
    "59": [0.125, 0.44444, 0, 0, 0.27778],
    "61": [-0.13, 0.37, 0, 0, 0.77778],
    "63": [0, 0.69444, 0, 0, 0.47222],
    "64": [0, 0.69444, 0, 0, 0.66667],
    "65": [0, 0.69444, 0, 0, 0.66667],
    "66": [0, 0.69444, 0, 0, 0.66667],
    "67": [0, 0.69444, 0, 0, 0.63889],
    "68": [0, 0.69444, 0, 0, 0.72223],
    "69": [0, 0.69444, 0, 0, 0.59722],
    "70": [0, 0.69444, 0, 0, 0.56945],
    "71": [0, 0.69444, 0, 0, 0.66667],
    "72": [0, 0.69444, 0, 0, 0.70834],
    "73": [0, 0.69444, 0, 0, 0.27778],
    "74": [0, 0.69444, 0, 0, 0.47222],
    "75": [0, 0.69444, 0, 0, 0.69445],
    "76": [0, 0.69444, 0, 0, 0.54167],
    "77": [0, 0.69444, 0, 0, 0.875],
    "78": [0, 0.69444, 0, 0, 0.70834],
    "79": [0, 0.69444, 0, 0, 0.73611],
    "80": [0, 0.69444, 0, 0, 0.63889],
    "81": [0.125, 0.69444, 0, 0, 0.73611],
    "82": [0, 0.69444, 0, 0, 0.64584],
    "83": [0, 0.69444, 0, 0, 0.55556],
    "84": [0, 0.69444, 0, 0, 0.68056],
    "85": [0, 0.69444, 0, 0, 0.6875],
    "86": [0, 0.69444, 0.01389, 0, 0.66667],
    "87": [0, 0.69444, 0.01389, 0, 0.94445],
    "88": [0, 0.69444, 0, 0, 0.66667],
    "89": [0, 0.69444, 0.025, 0, 0.66667],
    "90": [0, 0.69444, 0, 0, 0.61111],
    "91": [0.25, 0.75, 0, 0, 0.28889],
    "93": [0.25, 0.75, 0, 0, 0.28889],
    "94": [0, 0.69444, 0, 0, 0.5],
    "95": [0.35, 0.09444, 0.02778, 0, 0.5],
    "97": [0, 0.44444, 0, 0, 0.48056],
    "98": [0, 0.69444, 0, 0, 0.51667],
    "99": [0, 0.44444, 0, 0, 0.44445],
    "100": [0, 0.69444, 0, 0, 0.51667],
    "101": [0, 0.44444, 0, 0, 0.44445],
    "102": [0, 0.69444, 0.06944, 0, 0.30556],
    "103": [0.19444, 0.44444, 0.01389, 0, 0.5],
    "104": [0, 0.69444, 0, 0, 0.51667],
    "105": [0, 0.67937, 0, 0, 0.23889],
    "106": [0.19444, 0.67937, 0, 0, 0.26667],
    "107": [0, 0.69444, 0, 0, 0.48889],
    "108": [0, 0.69444, 0, 0, 0.23889],
    "109": [0, 0.44444, 0, 0, 0.79445],
    "110": [0, 0.44444, 0, 0, 0.51667],
    "111": [0, 0.44444, 0, 0, 0.5],
    "112": [0.19444, 0.44444, 0, 0, 0.51667],
    "113": [0.19444, 0.44444, 0, 0, 0.51667],
    "114": [0, 0.44444, 0.01389, 0, 0.34167],
    "115": [0, 0.44444, 0, 0, 0.38333],
    "116": [0, 0.57143, 0, 0, 0.36111],
    "117": [0, 0.44444, 0, 0, 0.51667],
    "118": [0, 0.44444, 0.01389, 0, 0.46111],
    "119": [0, 0.44444, 0.01389, 0, 0.68334],
    "120": [0, 0.44444, 0, 0, 0.46111],
    "121": [0.19444, 0.44444, 0.01389, 0, 0.46111],
    "122": [0, 0.44444, 0, 0, 0.43472],
    "126": [0.35, 0.32659, 0, 0, 0.5],
    "160": [0, 0, 0, 0, 0.25],
    "168": [0, 0.67937, 0, 0, 0.5],
    "176": [0, 0.69444, 0, 0, 0.66667],
    "184": [0.17014, 0, 0, 0, 0.44445],
    "305": [0, 0.44444, 0, 0, 0.23889],
    "567": [0.19444, 0.44444, 0, 0, 0.26667],
    "710": [0, 0.69444, 0, 0, 0.5],
    "711": [0, 0.63194, 0, 0, 0.5],
    "713": [0, 0.60889, 0, 0, 0.5],
    "714": [0, 0.69444, 0, 0, 0.5],
    "715": [0, 0.69444, 0, 0, 0.5],
    "728": [0, 0.69444, 0, 0, 0.5],
    "729": [0, 0.67937, 0, 0, 0.27778],
    "730": [0, 0.69444, 0, 0, 0.66667],
    "732": [0, 0.67659, 0, 0, 0.5],
    "733": [0, 0.69444, 0, 0, 0.5],
    "915": [0, 0.69444, 0, 0, 0.54167],
    "916": [0, 0.69444, 0, 0, 0.83334],
    "920": [0, 0.69444, 0, 0, 0.77778],
    "923": [0, 0.69444, 0, 0, 0.61111],
    "926": [0, 0.69444, 0, 0, 0.66667],
    "928": [0, 0.69444, 0, 0, 0.70834],
    "931": [0, 0.69444, 0, 0, 0.72222],
    "933": [0, 0.69444, 0, 0, 0.77778],
    "934": [0, 0.69444, 0, 0, 0.72222],
    "936": [0, 0.69444, 0, 0, 0.77778],
    "937": [0, 0.69444, 0, 0, 0.72222],
    "8211": [0, 0.44444, 0.02778, 0, 0.5],
    "8212": [0, 0.44444, 0.02778, 0, 1],
    "8216": [0, 0.69444, 0, 0, 0.27778],
    "8217": [0, 0.69444, 0, 0, 0.27778],
    "8220": [0, 0.69444, 0, 0, 0.5],
    "8221": [0, 0.69444, 0, 0, 0.5]
  },
  "Script-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "65": [0, 0.7, 0.22925, 0, 0.80253],
    "66": [0, 0.7, 0.04087, 0, 0.90757],
    "67": [0, 0.7, 0.1689, 0, 0.66619],
    "68": [0, 0.7, 0.09371, 0, 0.77443],
    "69": [0, 0.7, 0.18583, 0, 0.56162],
    "70": [0, 0.7, 0.13634, 0, 0.89544],
    "71": [0, 0.7, 0.17322, 0, 0.60961],
    "72": [0, 0.7, 0.29694, 0, 0.96919],
    "73": [0, 0.7, 0.19189, 0, 0.80907],
    "74": [0.27778, 0.7, 0.19189, 0, 1.05159],
    "75": [0, 0.7, 0.31259, 0, 0.91364],
    "76": [0, 0.7, 0.19189, 0, 0.87373],
    "77": [0, 0.7, 0.15981, 0, 1.08031],
    "78": [0, 0.7, 0.3525, 0, 0.9015],
    "79": [0, 0.7, 0.08078, 0, 0.73787],
    "80": [0, 0.7, 0.08078, 0, 1.01262],
    "81": [0, 0.7, 0.03305, 0, 0.88282],
    "82": [0, 0.7, 0.06259, 0, 0.85],
    "83": [0, 0.7, 0.19189, 0, 0.86767],
    "84": [0, 0.7, 0.29087, 0, 0.74697],
    "85": [0, 0.7, 0.25815, 0, 0.79996],
    "86": [0, 0.7, 0.27523, 0, 0.62204],
    "87": [0, 0.7, 0.27523, 0, 0.80532],
    "88": [0, 0.7, 0.26006, 0, 0.94445],
    "89": [0, 0.7, 0.2939, 0, 0.70961],
    "90": [0, 0.7, 0.24037, 0, 0.8212],
    "160": [0, 0, 0, 0, 0.25]
  },
  "Size1-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "40": [0.35001, 0.85, 0, 0, 0.45834],
    "41": [0.35001, 0.85, 0, 0, 0.45834],
    "47": [0.35001, 0.85, 0, 0, 0.57778],
    "91": [0.35001, 0.85, 0, 0, 0.41667],
    "92": [0.35001, 0.85, 0, 0, 0.57778],
    "93": [0.35001, 0.85, 0, 0, 0.41667],
    "123": [0.35001, 0.85, 0, 0, 0.58334],
    "125": [0.35001, 0.85, 0, 0, 0.58334],
    "160": [0, 0, 0, 0, 0.25],
    "710": [0, 0.72222, 0, 0, 0.55556],
    "732": [0, 0.72222, 0, 0, 0.55556],
    "770": [0, 0.72222, 0, 0, 0.55556],
    "771": [0, 0.72222, 0, 0, 0.55556],
    "8214": [-99e-5, 0.601, 0, 0, 0.77778],
    "8593": [1e-5, 0.6, 0, 0, 0.66667],
    "8595": [1e-5, 0.6, 0, 0, 0.66667],
    "8657": [1e-5, 0.6, 0, 0, 0.77778],
    "8659": [1e-5, 0.6, 0, 0, 0.77778],
    "8719": [0.25001, 0.75, 0, 0, 0.94445],
    "8720": [0.25001, 0.75, 0, 0, 0.94445],
    "8721": [0.25001, 0.75, 0, 0, 1.05556],
    "8730": [0.35001, 0.85, 0, 0, 1],
    "8739": [-599e-5, 0.606, 0, 0, 0.33333],
    "8741": [-599e-5, 0.606, 0, 0, 0.55556],
    "8747": [0.30612, 0.805, 0.19445, 0, 0.47222],
    "8748": [0.306, 0.805, 0.19445, 0, 0.47222],
    "8749": [0.306, 0.805, 0.19445, 0, 0.47222],
    "8750": [0.30612, 0.805, 0.19445, 0, 0.47222],
    "8896": [0.25001, 0.75, 0, 0, 0.83334],
    "8897": [0.25001, 0.75, 0, 0, 0.83334],
    "8898": [0.25001, 0.75, 0, 0, 0.83334],
    "8899": [0.25001, 0.75, 0, 0, 0.83334],
    "8968": [0.35001, 0.85, 0, 0, 0.47222],
    "8969": [0.35001, 0.85, 0, 0, 0.47222],
    "8970": [0.35001, 0.85, 0, 0, 0.47222],
    "8971": [0.35001, 0.85, 0, 0, 0.47222],
    "9168": [-99e-5, 0.601, 0, 0, 0.66667],
    "10216": [0.35001, 0.85, 0, 0, 0.47222],
    "10217": [0.35001, 0.85, 0, 0, 0.47222],
    "10752": [0.25001, 0.75, 0, 0, 1.11111],
    "10753": [0.25001, 0.75, 0, 0, 1.11111],
    "10754": [0.25001, 0.75, 0, 0, 1.11111],
    "10756": [0.25001, 0.75, 0, 0, 0.83334],
    "10758": [0.25001, 0.75, 0, 0, 0.83334]
  },
  "Size2-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "40": [0.65002, 1.15, 0, 0, 0.59722],
    "41": [0.65002, 1.15, 0, 0, 0.59722],
    "47": [0.65002, 1.15, 0, 0, 0.81111],
    "91": [0.65002, 1.15, 0, 0, 0.47222],
    "92": [0.65002, 1.15, 0, 0, 0.81111],
    "93": [0.65002, 1.15, 0, 0, 0.47222],
    "123": [0.65002, 1.15, 0, 0, 0.66667],
    "125": [0.65002, 1.15, 0, 0, 0.66667],
    "160": [0, 0, 0, 0, 0.25],
    "710": [0, 0.75, 0, 0, 1],
    "732": [0, 0.75, 0, 0, 1],
    "770": [0, 0.75, 0, 0, 1],
    "771": [0, 0.75, 0, 0, 1],
    "8719": [0.55001, 1.05, 0, 0, 1.27778],
    "8720": [0.55001, 1.05, 0, 0, 1.27778],
    "8721": [0.55001, 1.05, 0, 0, 1.44445],
    "8730": [0.65002, 1.15, 0, 0, 1],
    "8747": [0.86225, 1.36, 0.44445, 0, 0.55556],
    "8748": [0.862, 1.36, 0.44445, 0, 0.55556],
    "8749": [0.862, 1.36, 0.44445, 0, 0.55556],
    "8750": [0.86225, 1.36, 0.44445, 0, 0.55556],
    "8896": [0.55001, 1.05, 0, 0, 1.11111],
    "8897": [0.55001, 1.05, 0, 0, 1.11111],
    "8898": [0.55001, 1.05, 0, 0, 1.11111],
    "8899": [0.55001, 1.05, 0, 0, 1.11111],
    "8968": [0.65002, 1.15, 0, 0, 0.52778],
    "8969": [0.65002, 1.15, 0, 0, 0.52778],
    "8970": [0.65002, 1.15, 0, 0, 0.52778],
    "8971": [0.65002, 1.15, 0, 0, 0.52778],
    "10216": [0.65002, 1.15, 0, 0, 0.61111],
    "10217": [0.65002, 1.15, 0, 0, 0.61111],
    "10752": [0.55001, 1.05, 0, 0, 1.51112],
    "10753": [0.55001, 1.05, 0, 0, 1.51112],
    "10754": [0.55001, 1.05, 0, 0, 1.51112],
    "10756": [0.55001, 1.05, 0, 0, 1.11111],
    "10758": [0.55001, 1.05, 0, 0, 1.11111]
  },
  "Size3-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "40": [0.95003, 1.45, 0, 0, 0.73611],
    "41": [0.95003, 1.45, 0, 0, 0.73611],
    "47": [0.95003, 1.45, 0, 0, 1.04445],
    "91": [0.95003, 1.45, 0, 0, 0.52778],
    "92": [0.95003, 1.45, 0, 0, 1.04445],
    "93": [0.95003, 1.45, 0, 0, 0.52778],
    "123": [0.95003, 1.45, 0, 0, 0.75],
    "125": [0.95003, 1.45, 0, 0, 0.75],
    "160": [0, 0, 0, 0, 0.25],
    "710": [0, 0.75, 0, 0, 1.44445],
    "732": [0, 0.75, 0, 0, 1.44445],
    "770": [0, 0.75, 0, 0, 1.44445],
    "771": [0, 0.75, 0, 0, 1.44445],
    "8730": [0.95003, 1.45, 0, 0, 1],
    "8968": [0.95003, 1.45, 0, 0, 0.58334],
    "8969": [0.95003, 1.45, 0, 0, 0.58334],
    "8970": [0.95003, 1.45, 0, 0, 0.58334],
    "8971": [0.95003, 1.45, 0, 0, 0.58334],
    "10216": [0.95003, 1.45, 0, 0, 0.75],
    "10217": [0.95003, 1.45, 0, 0, 0.75]
  },
  "Size4-Regular": {
    "32": [0, 0, 0, 0, 0.25],
    "40": [1.25003, 1.75, 0, 0, 0.79167],
    "41": [1.25003, 1.75, 0, 0, 0.79167],
    "47": [1.25003, 1.75, 0, 0, 1.27778],
    "91": [1.25003, 1.75, 0, 0, 0.58334],
    "92": [1.25003, 1.75, 0, 0, 1.27778],
    "93": [1.25003, 1.75, 0, 0, 0.58334],
    "123": [1.25003, 1.75, 0, 0, 0.80556],
    "125": [1.25003, 1.75, 0, 0, 0.80556],
    "160": [0, 0, 0, 0, 0.25],
    "710": [0, 0.825, 0, 0, 1.8889],
    "732": [0, 0.825, 0, 0, 1.8889],
    "770": [0, 0.825, 0, 0, 1.8889],
    "771": [0, 0.825, 0, 0, 1.8889],
    "8730": [1.25003, 1.75, 0, 0, 1],
    "8968": [1.25003, 1.75, 0, 0, 0.63889],
    "8969": [1.25003, 1.75, 0, 0, 0.63889],
    "8970": [1.25003, 1.75, 0, 0, 0.63889],
    "8971": [1.25003, 1.75, 0, 0, 0.63889],
    "9115": [0.64502, 1.155, 0, 0, 0.875],
    "9116": [1e-5, 0.6, 0, 0, 0.875],
    "9117": [0.64502, 1.155, 0, 0, 0.875],
    "9118": [0.64502, 1.155, 0, 0, 0.875],
    "9119": [1e-5, 0.6, 0, 0, 0.875],
    "9120": [0.64502, 1.155, 0, 0, 0.875],
    "9121": [0.64502, 1.155, 0, 0, 0.66667],
    "9122": [-99e-5, 0.601, 0, 0, 0.66667],
    "9123": [0.64502, 1.155, 0, 0, 0.66667],
    "9124": [0.64502, 1.155, 0, 0, 0.66667],
    "9125": [-99e-5, 0.601, 0, 0, 0.66667],
    "9126": [0.64502, 1.155, 0, 0, 0.66667],
    "9127": [1e-5, 0.9, 0, 0, 0.88889],
    "9128": [0.65002, 1.15, 0, 0, 0.88889],
    "9129": [0.90001, 0, 0, 0, 0.88889],
    "9130": [0, 0.3, 0, 0, 0.88889],
    "9131": [1e-5, 0.9, 0, 0, 0.88889],
    "9132": [0.65002, 1.15, 0, 0, 0.88889],
    "9133": [0.90001, 0, 0, 0, 0.88889],
    "9143": [0.88502, 0.915, 0, 0, 1.05556],
    "10216": [1.25003, 1.75, 0, 0, 0.80556],
    "10217": [1.25003, 1.75, 0, 0, 0.80556],
    "57344": [-499e-5, 0.605, 0, 0, 1.05556],
    "57345": [-499e-5, 0.605, 0, 0, 1.05556],
    "57680": [0, 0.12, 0, 0, 0.45],
    "57681": [0, 0.12, 0, 0, 0.45],
    "57682": [0, 0.12, 0, 0, 0.45],
    "57683": [0, 0.12, 0, 0, 0.45]
  },
  "Typewriter-Regular": {
    "32": [0, 0, 0, 0, 0.525],
    "33": [0, 0.61111, 0, 0, 0.525],
    "34": [0, 0.61111, 0, 0, 0.525],
    "35": [0, 0.61111, 0, 0, 0.525],
    "36": [0.08333, 0.69444, 0, 0, 0.525],
    "37": [0.08333, 0.69444, 0, 0, 0.525],
    "38": [0, 0.61111, 0, 0, 0.525],
    "39": [0, 0.61111, 0, 0, 0.525],
    "40": [0.08333, 0.69444, 0, 0, 0.525],
    "41": [0.08333, 0.69444, 0, 0, 0.525],
    "42": [0, 0.52083, 0, 0, 0.525],
    "43": [-0.08056, 0.53055, 0, 0, 0.525],
    "44": [0.13889, 0.125, 0, 0, 0.525],
    "45": [-0.08056, 0.53055, 0, 0, 0.525],
    "46": [0, 0.125, 0, 0, 0.525],
    "47": [0.08333, 0.69444, 0, 0, 0.525],
    "48": [0, 0.61111, 0, 0, 0.525],
    "49": [0, 0.61111, 0, 0, 0.525],
    "50": [0, 0.61111, 0, 0, 0.525],
    "51": [0, 0.61111, 0, 0, 0.525],
    "52": [0, 0.61111, 0, 0, 0.525],
    "53": [0, 0.61111, 0, 0, 0.525],
    "54": [0, 0.61111, 0, 0, 0.525],
    "55": [0, 0.61111, 0, 0, 0.525],
    "56": [0, 0.61111, 0, 0, 0.525],
    "57": [0, 0.61111, 0, 0, 0.525],
    "58": [0, 0.43056, 0, 0, 0.525],
    "59": [0.13889, 0.43056, 0, 0, 0.525],
    "60": [-0.05556, 0.55556, 0, 0, 0.525],
    "61": [-0.19549, 0.41562, 0, 0, 0.525],
    "62": [-0.05556, 0.55556, 0, 0, 0.525],
    "63": [0, 0.61111, 0, 0, 0.525],
    "64": [0, 0.61111, 0, 0, 0.525],
    "65": [0, 0.61111, 0, 0, 0.525],
    "66": [0, 0.61111, 0, 0, 0.525],
    "67": [0, 0.61111, 0, 0, 0.525],
    "68": [0, 0.61111, 0, 0, 0.525],
    "69": [0, 0.61111, 0, 0, 0.525],
    "70": [0, 0.61111, 0, 0, 0.525],
    "71": [0, 0.61111, 0, 0, 0.525],
    "72": [0, 0.61111, 0, 0, 0.525],
    "73": [0, 0.61111, 0, 0, 0.525],
    "74": [0, 0.61111, 0, 0, 0.525],
    "75": [0, 0.61111, 0, 0, 0.525],
    "76": [0, 0.61111, 0, 0, 0.525],
    "77": [0, 0.61111, 0, 0, 0.525],
    "78": [0, 0.61111, 0, 0, 0.525],
    "79": [0, 0.61111, 0, 0, 0.525],
    "80": [0, 0.61111, 0, 0, 0.525],
    "81": [0.13889, 0.61111, 0, 0, 0.525],
    "82": [0, 0.61111, 0, 0, 0.525],
    "83": [0, 0.61111, 0, 0, 0.525],
    "84": [0, 0.61111, 0, 0, 0.525],
    "85": [0, 0.61111, 0, 0, 0.525],
    "86": [0, 0.61111, 0, 0, 0.525],
    "87": [0, 0.61111, 0, 0, 0.525],
    "88": [0, 0.61111, 0, 0, 0.525],
    "89": [0, 0.61111, 0, 0, 0.525],
    "90": [0, 0.61111, 0, 0, 0.525],
    "91": [0.08333, 0.69444, 0, 0, 0.525],
    "92": [0.08333, 0.69444, 0, 0, 0.525],
    "93": [0.08333, 0.69444, 0, 0, 0.525],
    "94": [0, 0.61111, 0, 0, 0.525],
    "95": [0.09514, 0, 0, 0, 0.525],
    "96": [0, 0.61111, 0, 0, 0.525],
    "97": [0, 0.43056, 0, 0, 0.525],
    "98": [0, 0.61111, 0, 0, 0.525],
    "99": [0, 0.43056, 0, 0, 0.525],
    "100": [0, 0.61111, 0, 0, 0.525],
    "101": [0, 0.43056, 0, 0, 0.525],
    "102": [0, 0.61111, 0, 0, 0.525],
    "103": [0.22222, 0.43056, 0, 0, 0.525],
    "104": [0, 0.61111, 0, 0, 0.525],
    "105": [0, 0.61111, 0, 0, 0.525],
    "106": [0.22222, 0.61111, 0, 0, 0.525],
    "107": [0, 0.61111, 0, 0, 0.525],
    "108": [0, 0.61111, 0, 0, 0.525],
    "109": [0, 0.43056, 0, 0, 0.525],
    "110": [0, 0.43056, 0, 0, 0.525],
    "111": [0, 0.43056, 0, 0, 0.525],
    "112": [0.22222, 0.43056, 0, 0, 0.525],
    "113": [0.22222, 0.43056, 0, 0, 0.525],
    "114": [0, 0.43056, 0, 0, 0.525],
    "115": [0, 0.43056, 0, 0, 0.525],
    "116": [0, 0.55358, 0, 0, 0.525],
    "117": [0, 0.43056, 0, 0, 0.525],
    "118": [0, 0.43056, 0, 0, 0.525],
    "119": [0, 0.43056, 0, 0, 0.525],
    "120": [0, 0.43056, 0, 0, 0.525],
    "121": [0.22222, 0.43056, 0, 0, 0.525],
    "122": [0, 0.43056, 0, 0, 0.525],
    "123": [0.08333, 0.69444, 0, 0, 0.525],
    "124": [0.08333, 0.69444, 0, 0, 0.525],
    "125": [0.08333, 0.69444, 0, 0, 0.525],
    "126": [0, 0.61111, 0, 0, 0.525],
    "127": [0, 0.61111, 0, 0, 0.525],
    "160": [0, 0, 0, 0, 0.525],
    "176": [0, 0.61111, 0, 0, 0.525],
    "184": [0.19445, 0, 0, 0, 0.525],
    "305": [0, 0.43056, 0, 0, 0.525],
    "567": [0.22222, 0.43056, 0, 0, 0.525],
    "711": [0, 0.56597, 0, 0, 0.525],
    "713": [0, 0.56555, 0, 0, 0.525],
    "714": [0, 0.61111, 0, 0, 0.525],
    "715": [0, 0.61111, 0, 0, 0.525],
    "728": [0, 0.61111, 0, 0, 0.525],
    "730": [0, 0.61111, 0, 0, 0.525],
    "770": [0, 0.61111, 0, 0, 0.525],
    "771": [0, 0.61111, 0, 0, 0.525],
    "776": [0, 0.61111, 0, 0, 0.525],
    "915": [0, 0.61111, 0, 0, 0.525],
    "916": [0, 0.61111, 0, 0, 0.525],
    "920": [0, 0.61111, 0, 0, 0.525],
    "923": [0, 0.61111, 0, 0, 0.525],
    "926": [0, 0.61111, 0, 0, 0.525],
    "928": [0, 0.61111, 0, 0, 0.525],
    "931": [0, 0.61111, 0, 0, 0.525],
    "933": [0, 0.61111, 0, 0, 0.525],
    "934": [0, 0.61111, 0, 0, 0.525],
    "936": [0, 0.61111, 0, 0, 0.525],
    "937": [0, 0.61111, 0, 0, 0.525],
    "8216": [0, 0.61111, 0, 0, 0.525],
    "8217": [0, 0.61111, 0, 0, 0.525],
    "8242": [0, 0.61111, 0, 0, 0.525],
    "9251": [0.11111, 0.21944, 0, 0, 0.525]
  }
};
var sigmasAndXis = {
  slant: [0.25, 0.25, 0.25],
  // sigma1
  space: [0, 0, 0],
  // sigma2
  stretch: [0, 0, 0],
  // sigma3
  shrink: [0, 0, 0],
  // sigma4
  xHeight: [0.431, 0.431, 0.431],
  // sigma5
  quad: [1, 1.171, 1.472],
  // sigma6
  extraSpace: [0, 0, 0],
  // sigma7
  num1: [0.677, 0.732, 0.925],
  // sigma8
  num2: [0.394, 0.384, 0.387],
  // sigma9
  num3: [0.444, 0.471, 0.504],
  // sigma10
  denom1: [0.686, 0.752, 1.025],
  // sigma11
  denom2: [0.345, 0.344, 0.532],
  // sigma12
  sup1: [0.413, 0.503, 0.504],
  // sigma13
  sup2: [0.363, 0.431, 0.404],
  // sigma14
  sup3: [0.289, 0.286, 0.294],
  // sigma15
  sub1: [0.15, 0.143, 0.2],
  // sigma16
  sub2: [0.247, 0.286, 0.4],
  // sigma17
  supDrop: [0.386, 0.353, 0.494],
  // sigma18
  subDrop: [0.05, 0.071, 0.1],
  // sigma19
  delim1: [2.39, 1.7, 1.98],
  // sigma20
  delim2: [1.01, 1.157, 1.42],
  // sigma21
  axisHeight: [0.25, 0.25, 0.25],
  // sigma22
  // These font metrics are extracted from TeX by using tftopl on cmex10.tfm;
  // they correspond to the font parameters of the extension fonts (family 3).
  // See the TeXbook, page 441. In AMSTeX, the extension fonts scale; to
  // match cmex7, we'd use cmex7.tfm values for script and scriptscript
  // values.
  defaultRuleThickness: [0.04, 0.049, 0.049],
  // xi8; cmex7: 0.049
  bigOpSpacing1: [0.111, 0.111, 0.111],
  // xi9
  bigOpSpacing2: [0.166, 0.166, 0.166],
  // xi10
  bigOpSpacing3: [0.2, 0.2, 0.2],
  // xi11
  bigOpSpacing4: [0.6, 0.611, 0.611],
  // xi12; cmex7: 0.611
  bigOpSpacing5: [0.1, 0.143, 0.143],
  // xi13; cmex7: 0.143
  // The \sqrt rule width is taken from the height of the surd character.
  // Since we use the same font at all sizes, this thickness doesn't scale.
  sqrtRuleThickness: [0.04, 0.04, 0.04],
  // This value determines how large a pt is, for metrics which are defined
  // in terms of pts.
  // This value is also used in katex.scss; if you change it make sure the
  // values match.
  ptPerEm: [10, 10, 10],
  // The space between adjacent `|` columns in an array definition. From
  // `\showthe\doublerulesep` in LaTeX. Equals 2.0 / ptPerEm.
  doubleRuleSep: [0.2, 0.2, 0.2],
  // The width of separator lines in {array} environments. From
  // `\showthe\arrayrulewidth` in LaTeX. Equals 0.4 / ptPerEm.
  arrayRuleWidth: [0.04, 0.04, 0.04],
  // Two values from LaTeX source2e:
  fboxsep: [0.3, 0.3, 0.3],
  //        3 pt / ptPerEm
  fboxrule: [0.04, 0.04, 0.04]
  // 0.4 pt / ptPerEm
};
var extraCharacterMap = {
  // Latin-1
  "\xC5": "A",
  "\xD0": "D",
  "\xDE": "o",
  "\xE5": "a",
  "\xF0": "d",
  "\xFE": "o",
  // Cyrillic
  "\u0410": "A",
  "\u0411": "B",
  "\u0412": "B",
  "\u0413": "F",
  "\u0414": "A",
  "\u0415": "E",
  "\u0416": "K",
  "\u0417": "3",
  "\u0418": "N",
  "\u0419": "N",
  "\u041A": "K",
  "\u041B": "N",
  "\u041C": "M",
  "\u041D": "H",
  "\u041E": "O",
  "\u041F": "N",
  "\u0420": "P",
  "\u0421": "C",
  "\u0422": "T",
  "\u0423": "y",
  "\u0424": "O",
  "\u0425": "X",
  "\u0426": "U",
  "\u0427": "h",
  "\u0428": "W",
  "\u0429": "W",
  "\u042A": "B",
  "\u042B": "X",
  "\u042C": "B",
  "\u042D": "3",
  "\u042E": "X",
  "\u042F": "R",
  "\u0430": "a",
  "\u0431": "b",
  "\u0432": "a",
  "\u0433": "r",
  "\u0434": "y",
  "\u0435": "e",
  "\u0436": "m",
  "\u0437": "e",
  "\u0438": "n",
  "\u0439": "n",
  "\u043A": "n",
  "\u043B": "n",
  "\u043C": "m",
  "\u043D": "n",
  "\u043E": "o",
  "\u043F": "n",
  "\u0440": "p",
  "\u0441": "c",
  "\u0442": "o",
  "\u0443": "y",
  "\u0444": "b",
  "\u0445": "x",
  "\u0446": "n",
  "\u0447": "n",
  "\u0448": "w",
  "\u0449": "w",
  "\u044A": "a",
  "\u044B": "m",
  "\u044C": "a",
  "\u044D": "e",
  "\u044E": "m",
  "\u044F": "r"
};
function setFontMetrics(fontName, metrics) {
  fontMetricsData[fontName] = metrics;
}
function getCharacterMetrics(character, font, mode) {
  if (!fontMetricsData[font]) {
    throw new Error("Font metrics not found for font: " + font + ".");
  }
  var ch2 = character.charCodeAt(0);
  var metrics = fontMetricsData[font][ch2];
  if (!metrics && character[0] in extraCharacterMap) {
    ch2 = extraCharacterMap[character[0]].charCodeAt(0);
    metrics = fontMetricsData[font][ch2];
  }
  if (!metrics && mode === "text") {
    if (supportedCodepoint(ch2)) {
      metrics = fontMetricsData[font][77];
    }
  }
  if (metrics) {
    return {
      depth: metrics[0],
      height: metrics[1],
      italic: metrics[2],
      skew: metrics[3],
      width: metrics[4]
    };
  }
}
var fontMetricsBySizeIndex = {};
function getGlobalMetrics(size) {
  var sizeIndex;
  if (size >= 5) {
    sizeIndex = 0;
  } else if (size >= 3) {
    sizeIndex = 1;
  } else {
    sizeIndex = 2;
  }
  if (!fontMetricsBySizeIndex[sizeIndex]) {
    var metrics = fontMetricsBySizeIndex[sizeIndex] = {
      cssEmPerMu: sigmasAndXis.quad[sizeIndex] / 18
    };
    for (var key in sigmasAndXis) {
      if (sigmasAndXis.hasOwnProperty(key)) {
        metrics[key] = sigmasAndXis[key][sizeIndex];
      }
    }
  }
  return fontMetricsBySizeIndex[sizeIndex];
}
var symbols2 = {
  "math": {},
  "text": {}
};
function defineSymbol(mode, font, group, replace, name2, acceptUnicodeChar) {
  symbols2[mode][name2] = {
    font,
    group,
    replace
  };
  if (acceptUnicodeChar && replace) {
    symbols2[mode][replace] = symbols2[mode][name2];
  }
}
var math = "math";
var text = "text";
var main = "main";
var ams = "ams";
var accent = "accent-token";
var bin = "bin";
var close = "close";
var inner = "inner";
var mathord = "mathord";
var op = "op-token";
var open = "open";
var punct = "punct";
var rel = "rel";
var spacing = "spacing";
var textord = "textord";
defineSymbol(math, main, rel, "\u2261", "\\equiv", true);
defineSymbol(math, main, rel, "\u227A", "\\prec", true);
defineSymbol(math, main, rel, "\u227B", "\\succ", true);
defineSymbol(math, main, rel, "\u223C", "\\sim", true);
defineSymbol(math, main, rel, "\u22A5", "\\perp");
defineSymbol(math, main, rel, "\u2AAF", "\\preceq", true);
defineSymbol(math, main, rel, "\u2AB0", "\\succeq", true);
defineSymbol(math, main, rel, "\u2243", "\\simeq", true);
defineSymbol(math, main, rel, "\u2223", "\\mid", true);
defineSymbol(math, main, rel, "\u226A", "\\ll", true);
defineSymbol(math, main, rel, "\u226B", "\\gg", true);
defineSymbol(math, main, rel, "\u224D", "\\asymp", true);
defineSymbol(math, main, rel, "\u2225", "\\parallel");
defineSymbol(math, main, rel, "\u22C8", "\\bowtie", true);
defineSymbol(math, main, rel, "\u2323", "\\smile", true);
defineSymbol(math, main, rel, "\u2291", "\\sqsubseteq", true);
defineSymbol(math, main, rel, "\u2292", "\\sqsupseteq", true);
defineSymbol(math, main, rel, "\u2250", "\\doteq", true);
defineSymbol(math, main, rel, "\u2322", "\\frown", true);
defineSymbol(math, main, rel, "\u220B", "\\ni", true);
defineSymbol(math, main, rel, "\u221D", "\\propto", true);
defineSymbol(math, main, rel, "\u22A2", "\\vdash", true);
defineSymbol(math, main, rel, "\u22A3", "\\dashv", true);
defineSymbol(math, main, rel, "\u220B", "\\owns");
defineSymbol(math, main, punct, ".", "\\ldotp");
defineSymbol(math, main, punct, "\u22C5", "\\cdotp");
defineSymbol(math, main, punct, "\u22C5", "\xB7");
defineSymbol(text, main, textord, "\u22C5", "\xB7");
defineSymbol(math, main, textord, "#", "\\#");
defineSymbol(text, main, textord, "#", "\\#");
defineSymbol(math, main, textord, "&", "\\&");
defineSymbol(text, main, textord, "&", "\\&");
defineSymbol(math, main, textord, "\u2135", "\\aleph", true);
defineSymbol(math, main, textord, "\u2200", "\\forall", true);
defineSymbol(math, main, textord, "\u210F", "\\hbar", true);
defineSymbol(math, main, textord, "\u2203", "\\exists", true);
defineSymbol(math, main, textord, "\u2207", "\\nabla", true);
defineSymbol(math, main, textord, "\u266D", "\\flat", true);
defineSymbol(math, main, textord, "\u2113", "\\ell", true);
defineSymbol(math, main, textord, "\u266E", "\\natural", true);
defineSymbol(math, main, textord, "\u2663", "\\clubsuit", true);
defineSymbol(math, main, textord, "\u2118", "\\wp", true);
defineSymbol(math, main, textord, "\u266F", "\\sharp", true);
defineSymbol(math, main, textord, "\u2662", "\\diamondsuit", true);
defineSymbol(math, main, textord, "\u211C", "\\Re", true);
defineSymbol(math, main, textord, "\u2661", "\\heartsuit", true);
defineSymbol(math, main, textord, "\u2111", "\\Im", true);
defineSymbol(math, main, textord, "\u2660", "\\spadesuit", true);
defineSymbol(math, main, textord, "\xA7", "\\S", true);
defineSymbol(text, main, textord, "\xA7", "\\S");
defineSymbol(math, main, textord, "\xB6", "\\P", true);
defineSymbol(text, main, textord, "\xB6", "\\P");
defineSymbol(math, main, textord, "\u2020", "\\dag");
defineSymbol(text, main, textord, "\u2020", "\\dag");
defineSymbol(text, main, textord, "\u2020", "\\textdagger");
defineSymbol(math, main, textord, "\u2021", "\\ddag");
defineSymbol(text, main, textord, "\u2021", "\\ddag");
defineSymbol(text, main, textord, "\u2021", "\\textdaggerdbl");
defineSymbol(math, main, close, "\u23B1", "\\rmoustache", true);
defineSymbol(math, main, open, "\u23B0", "\\lmoustache", true);
defineSymbol(math, main, close, "\u27EF", "\\rgroup", true);
defineSymbol(math, main, open, "\u27EE", "\\lgroup", true);
defineSymbol(math, main, bin, "\u2213", "\\mp", true);
defineSymbol(math, main, bin, "\u2296", "\\ominus", true);
defineSymbol(math, main, bin, "\u228E", "\\uplus", true);
defineSymbol(math, main, bin, "\u2293", "\\sqcap", true);
defineSymbol(math, main, bin, "\u2217", "\\ast");
defineSymbol(math, main, bin, "\u2294", "\\sqcup", true);
defineSymbol(math, main, bin, "\u25EF", "\\bigcirc", true);
defineSymbol(math, main, bin, "\u2219", "\\bullet", true);
defineSymbol(math, main, bin, "\u2021", "\\ddagger");
defineSymbol(math, main, bin, "\u2240", "\\wr", true);
defineSymbol(math, main, bin, "\u2A3F", "\\amalg");
defineSymbol(math, main, bin, "&", "\\And");
defineSymbol(math, main, rel, "\u27F5", "\\longleftarrow", true);
defineSymbol(math, main, rel, "\u21D0", "\\Leftarrow", true);
defineSymbol(math, main, rel, "\u27F8", "\\Longleftarrow", true);
defineSymbol(math, main, rel, "\u27F6", "\\longrightarrow", true);
defineSymbol(math, main, rel, "\u21D2", "\\Rightarrow", true);
defineSymbol(math, main, rel, "\u27F9", "\\Longrightarrow", true);
defineSymbol(math, main, rel, "\u2194", "\\leftrightarrow", true);
defineSymbol(math, main, rel, "\u27F7", "\\longleftrightarrow", true);
defineSymbol(math, main, rel, "\u21D4", "\\Leftrightarrow", true);
defineSymbol(math, main, rel, "\u27FA", "\\Longleftrightarrow", true);
defineSymbol(math, main, rel, "\u21A6", "\\mapsto", true);
defineSymbol(math, main, rel, "\u27FC", "\\longmapsto", true);
defineSymbol(math, main, rel, "\u2197", "\\nearrow", true);
defineSymbol(math, main, rel, "\u21A9", "\\hookleftarrow", true);
defineSymbol(math, main, rel, "\u21AA", "\\hookrightarrow", true);
defineSymbol(math, main, rel, "\u2198", "\\searrow", true);
defineSymbol(math, main, rel, "\u21BC", "\\leftharpoonup", true);
defineSymbol(math, main, rel, "\u21C0", "\\rightharpoonup", true);
defineSymbol(math, main, rel, "\u2199", "\\swarrow", true);
defineSymbol(math, main, rel, "\u21BD", "\\leftharpoondown", true);
defineSymbol(math, main, rel, "\u21C1", "\\rightharpoondown", true);
defineSymbol(math, main, rel, "\u2196", "\\nwarrow", true);
defineSymbol(math, main, rel, "\u21CC", "\\rightleftharpoons", true);
defineSymbol(math, ams, rel, "\u226E", "\\nless", true);
defineSymbol(math, ams, rel, "\uE010", "\\@nleqslant");
defineSymbol(math, ams, rel, "\uE011", "\\@nleqq");
defineSymbol(math, ams, rel, "\u2A87", "\\lneq", true);
defineSymbol(math, ams, rel, "\u2268", "\\lneqq", true);
defineSymbol(math, ams, rel, "\uE00C", "\\@lvertneqq");
defineSymbol(math, ams, rel, "\u22E6", "\\lnsim", true);
defineSymbol(math, ams, rel, "\u2A89", "\\lnapprox", true);
defineSymbol(math, ams, rel, "\u2280", "\\nprec", true);
defineSymbol(math, ams, rel, "\u22E0", "\\npreceq", true);
defineSymbol(math, ams, rel, "\u22E8", "\\precnsim", true);
defineSymbol(math, ams, rel, "\u2AB9", "\\precnapprox", true);
defineSymbol(math, ams, rel, "\u2241", "\\nsim", true);
defineSymbol(math, ams, rel, "\uE006", "\\@nshortmid");
defineSymbol(math, ams, rel, "\u2224", "\\nmid", true);
defineSymbol(math, ams, rel, "\u22AC", "\\nvdash", true);
defineSymbol(math, ams, rel, "\u22AD", "\\nvDash", true);
defineSymbol(math, ams, rel, "\u22EA", "\\ntriangleleft");
defineSymbol(math, ams, rel, "\u22EC", "\\ntrianglelefteq", true);
defineSymbol(math, ams, rel, "\u228A", "\\subsetneq", true);
defineSymbol(math, ams, rel, "\uE01A", "\\@varsubsetneq");
defineSymbol(math, ams, rel, "\u2ACB", "\\subsetneqq", true);
defineSymbol(math, ams, rel, "\uE017", "\\@varsubsetneqq");
defineSymbol(math, ams, rel, "\u226F", "\\ngtr", true);
defineSymbol(math, ams, rel, "\uE00F", "\\@ngeqslant");
defineSymbol(math, ams, rel, "\uE00E", "\\@ngeqq");
defineSymbol(math, ams, rel, "\u2A88", "\\gneq", true);
defineSymbol(math, ams, rel, "\u2269", "\\gneqq", true);
defineSymbol(math, ams, rel, "\uE00D", "\\@gvertneqq");
defineSymbol(math, ams, rel, "\u22E7", "\\gnsim", true);
defineSymbol(math, ams, rel, "\u2A8A", "\\gnapprox", true);
defineSymbol(math, ams, rel, "\u2281", "\\nsucc", true);
defineSymbol(math, ams, rel, "\u22E1", "\\nsucceq", true);
defineSymbol(math, ams, rel, "\u22E9", "\\succnsim", true);
defineSymbol(math, ams, rel, "\u2ABA", "\\succnapprox", true);
defineSymbol(math, ams, rel, "\u2246", "\\ncong", true);
defineSymbol(math, ams, rel, "\uE007", "\\@nshortparallel");
defineSymbol(math, ams, rel, "\u2226", "\\nparallel", true);
defineSymbol(math, ams, rel, "\u22AF", "\\nVDash", true);
defineSymbol(math, ams, rel, "\u22EB", "\\ntriangleright");
defineSymbol(math, ams, rel, "\u22ED", "\\ntrianglerighteq", true);
defineSymbol(math, ams, rel, "\uE018", "\\@nsupseteqq");
defineSymbol(math, ams, rel, "\u228B", "\\supsetneq", true);
defineSymbol(math, ams, rel, "\uE01B", "\\@varsupsetneq");
defineSymbol(math, ams, rel, "\u2ACC", "\\supsetneqq", true);
defineSymbol(math, ams, rel, "\uE019", "\\@varsupsetneqq");
defineSymbol(math, ams, rel, "\u22AE", "\\nVdash", true);
defineSymbol(math, ams, rel, "\u2AB5", "\\precneqq", true);
defineSymbol(math, ams, rel, "\u2AB6", "\\succneqq", true);
defineSymbol(math, ams, rel, "\uE016", "\\@nsubseteqq");
defineSymbol(math, ams, bin, "\u22B4", "\\unlhd");
defineSymbol(math, ams, bin, "\u22B5", "\\unrhd");
defineSymbol(math, ams, rel, "\u219A", "\\nleftarrow", true);
defineSymbol(math, ams, rel, "\u219B", "\\nrightarrow", true);
defineSymbol(math, ams, rel, "\u21CD", "\\nLeftarrow", true);
defineSymbol(math, ams, rel, "\u21CF", "\\nRightarrow", true);
defineSymbol(math, ams, rel, "\u21AE", "\\nleftrightarrow", true);
defineSymbol(math, ams, rel, "\u21CE", "\\nLeftrightarrow", true);
defineSymbol(math, ams, rel, "\u25B3", "\\vartriangle");
defineSymbol(math, ams, textord, "\u210F", "\\hslash");
defineSymbol(math, ams, textord, "\u25BD", "\\triangledown");
defineSymbol(math, ams, textord, "\u25CA", "\\lozenge");
defineSymbol(math, ams, textord, "\u24C8", "\\circledS");
defineSymbol(math, ams, textord, "\xAE", "\\circledR");
defineSymbol(text, ams, textord, "\xAE", "\\circledR");
defineSymbol(math, ams, textord, "\u2221", "\\measuredangle", true);
defineSymbol(math, ams, textord, "\u2204", "\\nexists");
defineSymbol(math, ams, textord, "\u2127", "\\mho");
defineSymbol(math, ams, textord, "\u2132", "\\Finv", true);
defineSymbol(math, ams, textord, "\u2141", "\\Game", true);
defineSymbol(math, ams, textord, "\u2035", "\\backprime");
defineSymbol(math, ams, textord, "\u25B2", "\\blacktriangle");
defineSymbol(math, ams, textord, "\u25BC", "\\blacktriangledown");
defineSymbol(math, ams, textord, "\u25A0", "\\blacksquare");
defineSymbol(math, ams, textord, "\u29EB", "\\blacklozenge");
defineSymbol(math, ams, textord, "\u2605", "\\bigstar");
defineSymbol(math, ams, textord, "\u2222", "\\sphericalangle", true);
defineSymbol(math, ams, textord, "\u2201", "\\complement", true);
defineSymbol(math, ams, textord, "\xF0", "\\eth", true);
defineSymbol(text, main, textord, "\xF0", "\xF0");
defineSymbol(math, ams, textord, "\u2571", "\\diagup");
defineSymbol(math, ams, textord, "\u2572", "\\diagdown");
defineSymbol(math, ams, textord, "\u25A1", "\\square");
defineSymbol(math, ams, textord, "\u25A1", "\\Box");
defineSymbol(math, ams, textord, "\u25CA", "\\Diamond");
defineSymbol(math, ams, textord, "\xA5", "\\yen", true);
defineSymbol(text, ams, textord, "\xA5", "\\yen", true);
defineSymbol(math, ams, textord, "\u2713", "\\checkmark", true);
defineSymbol(text, ams, textord, "\u2713", "\\checkmark");
defineSymbol(math, ams, textord, "\u2136", "\\beth", true);
defineSymbol(math, ams, textord, "\u2138", "\\daleth", true);
defineSymbol(math, ams, textord, "\u2137", "\\gimel", true);
defineSymbol(math, ams, textord, "\u03DD", "\\digamma", true);
defineSymbol(math, ams, textord, "\u03F0", "\\varkappa");
defineSymbol(math, ams, open, "\u250C", "\\@ulcorner", true);
defineSymbol(math, ams, close, "\u2510", "\\@urcorner", true);
defineSymbol(math, ams, open, "\u2514", "\\@llcorner", true);
defineSymbol(math, ams, close, "\u2518", "\\@lrcorner", true);
defineSymbol(math, ams, rel, "\u2266", "\\leqq", true);
defineSymbol(math, ams, rel, "\u2A7D", "\\leqslant", true);
defineSymbol(math, ams, rel, "\u2A95", "\\eqslantless", true);
defineSymbol(math, ams, rel, "\u2272", "\\lesssim", true);
defineSymbol(math, ams, rel, "\u2A85", "\\lessapprox", true);
defineSymbol(math, ams, rel, "\u224A", "\\approxeq", true);
defineSymbol(math, ams, bin, "\u22D6", "\\lessdot");
defineSymbol(math, ams, rel, "\u22D8", "\\lll", true);
defineSymbol(math, ams, rel, "\u2276", "\\lessgtr", true);
defineSymbol(math, ams, rel, "\u22DA", "\\lesseqgtr", true);
defineSymbol(math, ams, rel, "\u2A8B", "\\lesseqqgtr", true);
defineSymbol(math, ams, rel, "\u2251", "\\doteqdot");
defineSymbol(math, ams, rel, "\u2253", "\\risingdotseq", true);
defineSymbol(math, ams, rel, "\u2252", "\\fallingdotseq", true);
defineSymbol(math, ams, rel, "\u223D", "\\backsim", true);
defineSymbol(math, ams, rel, "\u22CD", "\\backsimeq", true);
defineSymbol(math, ams, rel, "\u2AC5", "\\subseteqq", true);
defineSymbol(math, ams, rel, "\u22D0", "\\Subset", true);
defineSymbol(math, ams, rel, "\u228F", "\\sqsubset", true);
defineSymbol(math, ams, rel, "\u227C", "\\preccurlyeq", true);
defineSymbol(math, ams, rel, "\u22DE", "\\curlyeqprec", true);
defineSymbol(math, ams, rel, "\u227E", "\\precsim", true);
defineSymbol(math, ams, rel, "\u2AB7", "\\precapprox", true);
defineSymbol(math, ams, rel, "\u22B2", "\\vartriangleleft");
defineSymbol(math, ams, rel, "\u22B4", "\\trianglelefteq");
defineSymbol(math, ams, rel, "\u22A8", "\\vDash", true);
defineSymbol(math, ams, rel, "\u22AA", "\\Vvdash", true);
defineSymbol(math, ams, rel, "\u2323", "\\smallsmile");
defineSymbol(math, ams, rel, "\u2322", "\\smallfrown");
defineSymbol(math, ams, rel, "\u224F", "\\bumpeq", true);
defineSymbol(math, ams, rel, "\u224E", "\\Bumpeq", true);
defineSymbol(math, ams, rel, "\u2267", "\\geqq", true);
defineSymbol(math, ams, rel, "\u2A7E", "\\geqslant", true);
defineSymbol(math, ams, rel, "\u2A96", "\\eqslantgtr", true);
defineSymbol(math, ams, rel, "\u2273", "\\gtrsim", true);
defineSymbol(math, ams, rel, "\u2A86", "\\gtrapprox", true);
defineSymbol(math, ams, bin, "\u22D7", "\\gtrdot");
defineSymbol(math, ams, rel, "\u22D9", "\\ggg", true);
defineSymbol(math, ams, rel, "\u2277", "\\gtrless", true);
defineSymbol(math, ams, rel, "\u22DB", "\\gtreqless", true);
defineSymbol(math, ams, rel, "\u2A8C", "\\gtreqqless", true);
defineSymbol(math, ams, rel, "\u2256", "\\eqcirc", true);
defineSymbol(math, ams, rel, "\u2257", "\\circeq", true);
defineSymbol(math, ams, rel, "\u225C", "\\triangleq", true);
defineSymbol(math, ams, rel, "\u223C", "\\thicksim");
defineSymbol(math, ams, rel, "\u2248", "\\thickapprox");
defineSymbol(math, ams, rel, "\u2AC6", "\\supseteqq", true);
defineSymbol(math, ams, rel, "\u22D1", "\\Supset", true);
defineSymbol(math, ams, rel, "\u2290", "\\sqsupset", true);
defineSymbol(math, ams, rel, "\u227D", "\\succcurlyeq", true);
defineSymbol(math, ams, rel, "\u22DF", "\\curlyeqsucc", true);
defineSymbol(math, ams, rel, "\u227F", "\\succsim", true);
defineSymbol(math, ams, rel, "\u2AB8", "\\succapprox", true);
defineSymbol(math, ams, rel, "\u22B3", "\\vartriangleright");
defineSymbol(math, ams, rel, "\u22B5", "\\trianglerighteq");
defineSymbol(math, ams, rel, "\u22A9", "\\Vdash", true);
defineSymbol(math, ams, rel, "\u2223", "\\shortmid");
defineSymbol(math, ams, rel, "\u2225", "\\shortparallel");
defineSymbol(math, ams, rel, "\u226C", "\\between", true);
defineSymbol(math, ams, rel, "\u22D4", "\\pitchfork", true);
defineSymbol(math, ams, rel, "\u221D", "\\varpropto");
defineSymbol(math, ams, rel, "\u25C0", "\\blacktriangleleft");
defineSymbol(math, ams, rel, "\u2234", "\\therefore", true);
defineSymbol(math, ams, rel, "\u220D", "\\backepsilon");
defineSymbol(math, ams, rel, "\u25B6", "\\blacktriangleright");
defineSymbol(math, ams, rel, "\u2235", "\\because", true);
defineSymbol(math, ams, rel, "\u22D8", "\\llless");
defineSymbol(math, ams, rel, "\u22D9", "\\gggtr");
defineSymbol(math, ams, bin, "\u22B2", "\\lhd");
defineSymbol(math, ams, bin, "\u22B3", "\\rhd");
defineSymbol(math, ams, rel, "\u2242", "\\eqsim", true);
defineSymbol(math, main, rel, "\u22C8", "\\Join");
defineSymbol(math, ams, rel, "\u2251", "\\Doteq", true);
defineSymbol(math, ams, bin, "\u2214", "\\dotplus", true);
defineSymbol(math, ams, bin, "\u2216", "\\smallsetminus");
defineSymbol(math, ams, bin, "\u22D2", "\\Cap", true);
defineSymbol(math, ams, bin, "\u22D3", "\\Cup", true);
defineSymbol(math, ams, bin, "\u2A5E", "\\doublebarwedge", true);
defineSymbol(math, ams, bin, "\u229F", "\\boxminus", true);
defineSymbol(math, ams, bin, "\u229E", "\\boxplus", true);
defineSymbol(math, ams, bin, "\u22C7", "\\divideontimes", true);
defineSymbol(math, ams, bin, "\u22C9", "\\ltimes", true);
defineSymbol(math, ams, bin, "\u22CA", "\\rtimes", true);
defineSymbol(math, ams, bin, "\u22CB", "\\leftthreetimes", true);
defineSymbol(math, ams, bin, "\u22CC", "\\rightthreetimes", true);
defineSymbol(math, ams, bin, "\u22CF", "\\curlywedge", true);
defineSymbol(math, ams, bin, "\u22CE", "\\curlyvee", true);
defineSymbol(math, ams, bin, "\u229D", "\\circleddash", true);
defineSymbol(math, ams, bin, "\u229B", "\\circledast", true);
defineSymbol(math, ams, bin, "\u22C5", "\\centerdot");
defineSymbol(math, ams, bin, "\u22BA", "\\intercal", true);
defineSymbol(math, ams, bin, "\u22D2", "\\doublecap");
defineSymbol(math, ams, bin, "\u22D3", "\\doublecup");
defineSymbol(math, ams, bin, "\u22A0", "\\boxtimes", true);
defineSymbol(math, ams, rel, "\u21E2", "\\dashrightarrow", true);
defineSymbol(math, ams, rel, "\u21E0", "\\dashleftarrow", true);
defineSymbol(math, ams, rel, "\u21C7", "\\leftleftarrows", true);
defineSymbol(math, ams, rel, "\u21C6", "\\leftrightarrows", true);
defineSymbol(math, ams, rel, "\u21DA", "\\Lleftarrow", true);
defineSymbol(math, ams, rel, "\u219E", "\\twoheadleftarrow", true);
defineSymbol(math, ams, rel, "\u21A2", "\\leftarrowtail", true);
defineSymbol(math, ams, rel, "\u21AB", "\\looparrowleft", true);
defineSymbol(math, ams, rel, "\u21CB", "\\leftrightharpoons", true);
defineSymbol(math, ams, rel, "\u21B6", "\\curvearrowleft", true);
defineSymbol(math, ams, rel, "\u21BA", "\\circlearrowleft", true);
defineSymbol(math, ams, rel, "\u21B0", "\\Lsh", true);
defineSymbol(math, ams, rel, "\u21C8", "\\upuparrows", true);
defineSymbol(math, ams, rel, "\u21BF", "\\upharpoonleft", true);
defineSymbol(math, ams, rel, "\u21C3", "\\downharpoonleft", true);
defineSymbol(math, main, rel, "\u22B6", "\\origof", true);
defineSymbol(math, main, rel, "\u22B7", "\\imageof", true);
defineSymbol(math, ams, rel, "\u22B8", "\\multimap", true);
defineSymbol(math, ams, rel, "\u21AD", "\\leftrightsquigarrow", true);
defineSymbol(math, ams, rel, "\u21C9", "\\rightrightarrows", true);
defineSymbol(math, ams, rel, "\u21C4", "\\rightleftarrows", true);
defineSymbol(math, ams, rel, "\u21A0", "\\twoheadrightarrow", true);
defineSymbol(math, ams, rel, "\u21A3", "\\rightarrowtail", true);
defineSymbol(math, ams, rel, "\u21AC", "\\looparrowright", true);
defineSymbol(math, ams, rel, "\u21B7", "\\curvearrowright", true);
defineSymbol(math, ams, rel, "\u21BB", "\\circlearrowright", true);
defineSymbol(math, ams, rel, "\u21B1", "\\Rsh", true);
defineSymbol(math, ams, rel, "\u21CA", "\\downdownarrows", true);
defineSymbol(math, ams, rel, "\u21BE", "\\upharpoonright", true);
defineSymbol(math, ams, rel, "\u21C2", "\\downharpoonright", true);
defineSymbol(math, ams, rel, "\u21DD", "\\rightsquigarrow", true);
defineSymbol(math, ams, rel, "\u21DD", "\\leadsto");
defineSymbol(math, ams, rel, "\u21DB", "\\Rrightarrow", true);
defineSymbol(math, ams, rel, "\u21BE", "\\restriction");
defineSymbol(math, main, textord, "\u2018", "`");
defineSymbol(math, main, textord, "$", "\\$");
defineSymbol(text, main, textord, "$", "\\$");
defineSymbol(text, main, textord, "$", "\\textdollar");
defineSymbol(math, main, textord, "%", "\\%");
defineSymbol(text, main, textord, "%", "\\%");
defineSymbol(math, main, textord, "_", "\\_");
defineSymbol(text, main, textord, "_", "\\_");
defineSymbol(text, main, textord, "_", "\\textunderscore");
defineSymbol(math, main, textord, "\u2220", "\\angle", true);
defineSymbol(math, main, textord, "\u221E", "\\infty", true);
defineSymbol(math, main, textord, "\u2032", "\\prime");
defineSymbol(math, main, textord, "\u25B3", "\\triangle");
defineSymbol(math, main, textord, "\u0393", "\\Gamma", true);
defineSymbol(math, main, textord, "\u0394", "\\Delta", true);
defineSymbol(math, main, textord, "\u0398", "\\Theta", true);
defineSymbol(math, main, textord, "\u039B", "\\Lambda", true);
defineSymbol(math, main, textord, "\u039E", "\\Xi", true);
defineSymbol(math, main, textord, "\u03A0", "\\Pi", true);
defineSymbol(math, main, textord, "\u03A3", "\\Sigma", true);
defineSymbol(math, main, textord, "\u03A5", "\\Upsilon", true);
defineSymbol(math, main, textord, "\u03A6", "\\Phi", true);
defineSymbol(math, main, textord, "\u03A8", "\\Psi", true);
defineSymbol(math, main, textord, "\u03A9", "\\Omega", true);
defineSymbol(math, main, textord, "A", "\u0391");
defineSymbol(math, main, textord, "B", "\u0392");
defineSymbol(math, main, textord, "E", "\u0395");
defineSymbol(math, main, textord, "Z", "\u0396");
defineSymbol(math, main, textord, "H", "\u0397");
defineSymbol(math, main, textord, "I", "\u0399");
defineSymbol(math, main, textord, "K", "\u039A");
defineSymbol(math, main, textord, "M", "\u039C");
defineSymbol(math, main, textord, "N", "\u039D");
defineSymbol(math, main, textord, "O", "\u039F");
defineSymbol(math, main, textord, "P", "\u03A1");
defineSymbol(math, main, textord, "T", "\u03A4");
defineSymbol(math, main, textord, "X", "\u03A7");
defineSymbol(math, main, textord, "\xAC", "\\neg", true);
defineSymbol(math, main, textord, "\xAC", "\\lnot");
defineSymbol(math, main, textord, "\u22A4", "\\top");
defineSymbol(math, main, textord, "\u22A5", "\\bot");
defineSymbol(math, main, textord, "\u2205", "\\emptyset");
defineSymbol(math, ams, textord, "\u2205", "\\varnothing");
defineSymbol(math, main, mathord, "\u03B1", "\\alpha", true);
defineSymbol(math, main, mathord, "\u03B2", "\\beta", true);
defineSymbol(math, main, mathord, "\u03B3", "\\gamma", true);
defineSymbol(math, main, mathord, "\u03B4", "\\delta", true);
defineSymbol(math, main, mathord, "\u03F5", "\\epsilon", true);
defineSymbol(math, main, mathord, "\u03B6", "\\zeta", true);
defineSymbol(math, main, mathord, "\u03B7", "\\eta", true);
defineSymbol(math, main, mathord, "\u03B8", "\\theta", true);
defineSymbol(math, main, mathord, "\u03B9", "\\iota", true);
defineSymbol(math, main, mathord, "\u03BA", "\\kappa", true);
defineSymbol(math, main, mathord, "\u03BB", "\\lambda", true);
defineSymbol(math, main, mathord, "\u03BC", "\\mu", true);
defineSymbol(math, main, mathord, "\u03BD", "\\nu", true);
defineSymbol(math, main, mathord, "\u03BE", "\\xi", true);
defineSymbol(math, main, mathord, "\u03BF", "\\omicron", true);
defineSymbol(math, main, mathord, "\u03C0", "\\pi", true);
defineSymbol(math, main, mathord, "\u03C1", "\\rho", true);
defineSymbol(math, main, mathord, "\u03C3", "\\sigma", true);
defineSymbol(math, main, mathord, "\u03C4", "\\tau", true);
defineSymbol(math, main, mathord, "\u03C5", "\\upsilon", true);
defineSymbol(math, main, mathord, "\u03D5", "\\phi", true);
defineSymbol(math, main, mathord, "\u03C7", "\\chi", true);
defineSymbol(math, main, mathord, "\u03C8", "\\psi", true);
defineSymbol(math, main, mathord, "\u03C9", "\\omega", true);
defineSymbol(math, main, mathord, "\u03B5", "\\varepsilon", true);
defineSymbol(math, main, mathord, "\u03D1", "\\vartheta", true);
defineSymbol(math, main, mathord, "\u03D6", "\\varpi", true);
defineSymbol(math, main, mathord, "\u03F1", "\\varrho", true);
defineSymbol(math, main, mathord, "\u03C2", "\\varsigma", true);
defineSymbol(math, main, mathord, "\u03C6", "\\varphi", true);
defineSymbol(math, main, bin, "\u2217", "*", true);
defineSymbol(math, main, bin, "+", "+");
defineSymbol(math, main, bin, "\u2212", "-", true);
defineSymbol(math, main, bin, "\u22C5", "\\cdot", true);
defineSymbol(math, main, bin, "\u2218", "\\circ", true);
defineSymbol(math, main, bin, "\xF7", "\\div", true);
defineSymbol(math, main, bin, "\xB1", "\\pm", true);
defineSymbol(math, main, bin, "\xD7", "\\times", true);
defineSymbol(math, main, bin, "\u2229", "\\cap", true);
defineSymbol(math, main, bin, "\u222A", "\\cup", true);
defineSymbol(math, main, bin, "\u2216", "\\setminus", true);
defineSymbol(math, main, bin, "\u2227", "\\land");
defineSymbol(math, main, bin, "\u2228", "\\lor");
defineSymbol(math, main, bin, "\u2227", "\\wedge", true);
defineSymbol(math, main, bin, "\u2228", "\\vee", true);
defineSymbol(math, main, textord, "\u221A", "\\surd");
defineSymbol(math, main, open, "\u27E8", "\\langle", true);
defineSymbol(math, main, open, "\u2223", "\\lvert");
defineSymbol(math, main, open, "\u2225", "\\lVert");
defineSymbol(math, main, close, "?", "?");
defineSymbol(math, main, close, "!", "!");
defineSymbol(math, main, close, "\u27E9", "\\rangle", true);
defineSymbol(math, main, close, "\u2223", "\\rvert");
defineSymbol(math, main, close, "\u2225", "\\rVert");
defineSymbol(math, main, rel, "=", "=");
defineSymbol(math, main, rel, ":", ":");
defineSymbol(math, main, rel, "\u2248", "\\approx", true);
defineSymbol(math, main, rel, "\u2245", "\\cong", true);
defineSymbol(math, main, rel, "\u2265", "\\ge");
defineSymbol(math, main, rel, "\u2265", "\\geq", true);
defineSymbol(math, main, rel, "\u2190", "\\gets");
defineSymbol(math, main, rel, ">", "\\gt", true);
defineSymbol(math, main, rel, "\u2208", "\\in", true);
defineSymbol(math, main, rel, "\uE020", "\\@not");
defineSymbol(math, main, rel, "\u2282", "\\subset", true);
defineSymbol(math, main, rel, "\u2283", "\\supset", true);
defineSymbol(math, main, rel, "\u2286", "\\subseteq", true);
defineSymbol(math, main, rel, "\u2287", "\\supseteq", true);
defineSymbol(math, ams, rel, "\u2288", "\\nsubseteq", true);
defineSymbol(math, ams, rel, "\u2289", "\\nsupseteq", true);
defineSymbol(math, main, rel, "\u22A8", "\\models");
defineSymbol(math, main, rel, "\u2190", "\\leftarrow", true);
defineSymbol(math, main, rel, "\u2264", "\\le");
defineSymbol(math, main, rel, "\u2264", "\\leq", true);
defineSymbol(math, main, rel, "<", "\\lt", true);
defineSymbol(math, main, rel, "\u2192", "\\rightarrow", true);
defineSymbol(math, main, rel, "\u2192", "\\to");
defineSymbol(math, ams, rel, "\u2271", "\\ngeq", true);
defineSymbol(math, ams, rel, "\u2270", "\\nleq", true);
defineSymbol(math, main, spacing, "\xA0", "\\ ");
defineSymbol(math, main, spacing, "\xA0", "\\space");
defineSymbol(math, main, spacing, "\xA0", "\\nobreakspace");
defineSymbol(text, main, spacing, "\xA0", "\\ ");
defineSymbol(text, main, spacing, "\xA0", " ");
defineSymbol(text, main, spacing, "\xA0", "\\space");
defineSymbol(text, main, spacing, "\xA0", "\\nobreakspace");
defineSymbol(math, main, spacing, "", "\\nobreak");
defineSymbol(math, main, spacing, "", "\\allowbreak");
defineSymbol(math, main, punct, ",", ",");
defineSymbol(math, main, punct, ";", ";");
defineSymbol(math, ams, bin, "\u22BC", "\\barwedge", true);
defineSymbol(math, ams, bin, "\u22BB", "\\veebar", true);
defineSymbol(math, main, bin, "\u2299", "\\odot", true);
defineSymbol(math, main, bin, "\u2295", "\\oplus", true);
defineSymbol(math, main, bin, "\u2297", "\\otimes", true);
defineSymbol(math, main, textord, "\u2202", "\\partial", true);
defineSymbol(math, main, bin, "\u2298", "\\oslash", true);
defineSymbol(math, ams, bin, "\u229A", "\\circledcirc", true);
defineSymbol(math, ams, bin, "\u22A1", "\\boxdot", true);
defineSymbol(math, main, bin, "\u25B3", "\\bigtriangleup");
defineSymbol(math, main, bin, "\u25BD", "\\bigtriangledown");
defineSymbol(math, main, bin, "\u2020", "\\dagger");
defineSymbol(math, main, bin, "\u22C4", "\\diamond");
defineSymbol(math, main, bin, "\u22C6", "\\star");
defineSymbol(math, main, bin, "\u25C3", "\\triangleleft");
defineSymbol(math, main, bin, "\u25B9", "\\triangleright");
defineSymbol(math, main, open, "{", "\\{");
defineSymbol(text, main, textord, "{", "\\{");
defineSymbol(text, main, textord, "{", "\\textbraceleft");
defineSymbol(math, main, close, "}", "\\}");
defineSymbol(text, main, textord, "}", "\\}");
defineSymbol(text, main, textord, "}", "\\textbraceright");
defineSymbol(math, main, open, "{", "\\lbrace");
defineSymbol(math, main, close, "}", "\\rbrace");
defineSymbol(math, main, open, "[", "\\lbrack", true);
defineSymbol(text, main, textord, "[", "\\lbrack", true);
defineSymbol(math, main, close, "]", "\\rbrack", true);
defineSymbol(text, main, textord, "]", "\\rbrack", true);
defineSymbol(math, main, open, "(", "\\lparen", true);
defineSymbol(math, main, close, ")", "\\rparen", true);
defineSymbol(text, main, textord, "<", "\\textless", true);
defineSymbol(text, main, textord, ">", "\\textgreater", true);
defineSymbol(math, main, open, "\u230A", "\\lfloor", true);
defineSymbol(math, main, close, "\u230B", "\\rfloor", true);
defineSymbol(math, main, open, "\u2308", "\\lceil", true);
defineSymbol(math, main, close, "\u2309", "\\rceil", true);
defineSymbol(math, main, textord, "\\", "\\backslash");
defineSymbol(math, main, textord, "\u2223", "|");
defineSymbol(math, main, textord, "\u2223", "\\vert");
defineSymbol(text, main, textord, "|", "\\textbar", true);
defineSymbol(math, main, textord, "\u2225", "\\|");
defineSymbol(math, main, textord, "\u2225", "\\Vert");
defineSymbol(text, main, textord, "\u2225", "\\textbardbl");
defineSymbol(text, main, textord, "~", "\\textasciitilde");
defineSymbol(text, main, textord, "\\", "\\textbackslash");
defineSymbol(text, main, textord, "^", "\\textasciicircum");
defineSymbol(math, main, rel, "\u2191", "\\uparrow", true);
defineSymbol(math, main, rel, "\u21D1", "\\Uparrow", true);
defineSymbol(math, main, rel, "\u2193", "\\downarrow", true);
defineSymbol(math, main, rel, "\u21D3", "\\Downarrow", true);
defineSymbol(math, main, rel, "\u2195", "\\updownarrow", true);
defineSymbol(math, main, rel, "\u21D5", "\\Updownarrow", true);
defineSymbol(math, main, op, "\u2210", "\\coprod");
defineSymbol(math, main, op, "\u22C1", "\\bigvee");
defineSymbol(math, main, op, "\u22C0", "\\bigwedge");
defineSymbol(math, main, op, "\u2A04", "\\biguplus");
defineSymbol(math, main, op, "\u22C2", "\\bigcap");
defineSymbol(math, main, op, "\u22C3", "\\bigcup");
defineSymbol(math, main, op, "\u222B", "\\int");
defineSymbol(math, main, op, "\u222B", "\\intop");
defineSymbol(math, main, op, "\u222C", "\\iint");
defineSymbol(math, main, op, "\u222D", "\\iiint");
defineSymbol(math, main, op, "\u220F", "\\prod");
defineSymbol(math, main, op, "\u2211", "\\sum");
defineSymbol(math, main, op, "\u2A02", "\\bigotimes");
defineSymbol(math, main, op, "\u2A01", "\\bigoplus");
defineSymbol(math, main, op, "\u2A00", "\\bigodot");
defineSymbol(math, main, op, "\u222E", "\\oint");
defineSymbol(math, main, op, "\u222F", "\\oiint");
defineSymbol(math, main, op, "\u2230", "\\oiiint");
defineSymbol(math, main, op, "\u2A06", "\\bigsqcup");
defineSymbol(math, main, op, "\u222B", "\\smallint");
defineSymbol(text, main, inner, "\u2026", "\\textellipsis");
defineSymbol(math, main, inner, "\u2026", "\\mathellipsis");
defineSymbol(text, main, inner, "\u2026", "\\ldots", true);
defineSymbol(math, main, inner, "\u2026", "\\ldots", true);
defineSymbol(math, main, inner, "\u22EF", "\\@cdots", true);
defineSymbol(math, main, inner, "\u22F1", "\\ddots", true);
defineSymbol(math, main, textord, "\u22EE", "\\varvdots");
defineSymbol(text, main, textord, "\u22EE", "\\varvdots");
defineSymbol(math, main, accent, "\u02CA", "\\acute");
defineSymbol(math, main, accent, "\u02CB", "\\grave");
defineSymbol(math, main, accent, "\xA8", "\\ddot");
defineSymbol(math, main, accent, "~", "\\tilde");
defineSymbol(math, main, accent, "\u02C9", "\\bar");
defineSymbol(math, main, accent, "\u02D8", "\\breve");
defineSymbol(math, main, accent, "\u02C7", "\\check");
defineSymbol(math, main, accent, "^", "\\hat");
defineSymbol(math, main, accent, "\u20D7", "\\vec");
defineSymbol(math, main, accent, "\u02D9", "\\dot");
defineSymbol(math, main, accent, "\u02DA", "\\mathring");
defineSymbol(math, main, mathord, "\uE131", "\\@imath");
defineSymbol(math, main, mathord, "\uE237", "\\@jmath");
defineSymbol(math, main, textord, "\u0131", "\u0131");
defineSymbol(math, main, textord, "\u0237", "\u0237");
defineSymbol(text, main, textord, "\u0131", "\\i", true);
defineSymbol(text, main, textord, "\u0237", "\\j", true);
defineSymbol(text, main, textord, "\xDF", "\\ss", true);
defineSymbol(text, main, textord, "\xE6", "\\ae", true);
defineSymbol(text, main, textord, "\u0153", "\\oe", true);
defineSymbol(text, main, textord, "\xF8", "\\o", true);
defineSymbol(text, main, textord, "\xC6", "\\AE", true);
defineSymbol(text, main, textord, "\u0152", "\\OE", true);
defineSymbol(text, main, textord, "\xD8", "\\O", true);
defineSymbol(text, main, accent, "\u02CA", "\\'");
defineSymbol(text, main, accent, "\u02CB", "\\`");
defineSymbol(text, main, accent, "\u02C6", "\\^");
defineSymbol(text, main, accent, "\u02DC", "\\~");
defineSymbol(text, main, accent, "\u02C9", "\\=");
defineSymbol(text, main, accent, "\u02D8", "\\u");
defineSymbol(text, main, accent, "\u02D9", "\\.");
defineSymbol(text, main, accent, "\xB8", "\\c");
defineSymbol(text, main, accent, "\u02DA", "\\r");
defineSymbol(text, main, accent, "\u02C7", "\\v");
defineSymbol(text, main, accent, "\xA8", '\\"');
defineSymbol(text, main, accent, "\u02DD", "\\H");
defineSymbol(text, main, accent, "\u25EF", "\\textcircled");
var ligatures = {
  "--": true,
  "---": true,
  "``": true,
  "''": true
};
defineSymbol(text, main, textord, "\u2013", "--", true);
defineSymbol(text, main, textord, "\u2013", "\\textendash");
defineSymbol(text, main, textord, "\u2014", "---", true);
defineSymbol(text, main, textord, "\u2014", "\\textemdash");
defineSymbol(text, main, textord, "\u2018", "`", true);
defineSymbol(text, main, textord, "\u2018", "\\textquoteleft");
defineSymbol(text, main, textord, "\u2019", "'", true);
defineSymbol(text, main, textord, "\u2019", "\\textquoteright");
defineSymbol(text, main, textord, "\u201C", "``", true);
defineSymbol(text, main, textord, "\u201C", "\\textquotedblleft");
defineSymbol(text, main, textord, "\u201D", "''", true);
defineSymbol(text, main, textord, "\u201D", "\\textquotedblright");
defineSymbol(math, main, textord, "\xB0", "\\degree", true);
defineSymbol(text, main, textord, "\xB0", "\\degree");
defineSymbol(text, main, textord, "\xB0", "\\textdegree", true);
defineSymbol(math, main, textord, "\xA3", "\\pounds");
defineSymbol(math, main, textord, "\xA3", "\\mathsterling", true);
defineSymbol(text, main, textord, "\xA3", "\\pounds");
defineSymbol(text, main, textord, "\xA3", "\\textsterling", true);
defineSymbol(math, ams, textord, "\u2720", "\\maltese");
defineSymbol(text, ams, textord, "\u2720", "\\maltese");
var mathTextSymbols = '0123456789/@."';
for (i2 = 0; i2 < mathTextSymbols.length; i2++) {
  ch = mathTextSymbols.charAt(i2);
  defineSymbol(math, main, textord, ch, ch);
}
var ch;
var i2;
var textSymbols = '0123456789!@*()-=+";:?/.,';
for (_i = 0; _i < textSymbols.length; _i++) {
  _ch = textSymbols.charAt(_i);
  defineSymbol(text, main, textord, _ch, _ch);
}
var _ch;
var _i;
var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
for (_i2 = 0; _i2 < letters.length; _i2++) {
  _ch2 = letters.charAt(_i2);
  defineSymbol(math, main, mathord, _ch2, _ch2);
  defineSymbol(text, main, textord, _ch2, _ch2);
}
var _ch2;
var _i2;
defineSymbol(math, ams, textord, "C", "\u2102");
defineSymbol(text, ams, textord, "C", "\u2102");
defineSymbol(math, ams, textord, "H", "\u210D");
defineSymbol(text, ams, textord, "H", "\u210D");
defineSymbol(math, ams, textord, "N", "\u2115");
defineSymbol(text, ams, textord, "N", "\u2115");
defineSymbol(math, ams, textord, "P", "\u2119");
defineSymbol(text, ams, textord, "P", "\u2119");
defineSymbol(math, ams, textord, "Q", "\u211A");
defineSymbol(text, ams, textord, "Q", "\u211A");
defineSymbol(math, ams, textord, "R", "\u211D");
defineSymbol(text, ams, textord, "R", "\u211D");
defineSymbol(math, ams, textord, "Z", "\u2124");
defineSymbol(text, ams, textord, "Z", "\u2124");
defineSymbol(math, main, mathord, "h", "\u210E");
defineSymbol(text, main, mathord, "h", "\u210E");
var wideChar;
for (_i3 = 0; _i3 < letters.length; _i3++) {
  _ch3 = letters.charAt(_i3);
  wideChar = String.fromCharCode(55349, 56320 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56372 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56424 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56580 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56684 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56736 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56788 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56840 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  wideChar = String.fromCharCode(55349, 56944 + _i3);
  defineSymbol(math, main, mathord, _ch3, wideChar);
  defineSymbol(text, main, textord, _ch3, wideChar);
  if (_i3 < 26) {
    wideChar = String.fromCharCode(55349, 56632 + _i3);
    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
    wideChar = String.fromCharCode(55349, 56476 + _i3);
    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
  }
}
var _ch3;
var _i3;
wideChar = String.fromCharCode(55349, 56668);
defineSymbol(math, main, mathord, "k", wideChar);
defineSymbol(text, main, textord, "k", wideChar);
for (_i4 = 0; _i4 < 10; _i4++) {
  _ch4 = _i4.toString();
  wideChar = String.fromCharCode(55349, 57294 + _i4);
  defineSymbol(math, main, mathord, _ch4, wideChar);
  defineSymbol(text, main, textord, _ch4, wideChar);
  wideChar = String.fromCharCode(55349, 57314 + _i4);
  defineSymbol(math, main, mathord, _ch4, wideChar);
  defineSymbol(text, main, textord, _ch4, wideChar);
  wideChar = String.fromCharCode(55349, 57324 + _i4);
  defineSymbol(math, main, mathord, _ch4, wideChar);
  defineSymbol(text, main, textord, _ch4, wideChar);
  wideChar = String.fromCharCode(55349, 57334 + _i4);
  defineSymbol(math, main, mathord, _ch4, wideChar);
  defineSymbol(text, main, textord, _ch4, wideChar);
}
var _ch4;
var _i4;
var extraLatin = "\xD0\xDE\xFE";
for (_i5 = 0; _i5 < extraLatin.length; _i5++) {
  _ch5 = extraLatin.charAt(_i5);
  defineSymbol(math, main, mathord, _ch5, _ch5);
  defineSymbol(text, main, textord, _ch5, _ch5);
}
var _ch5;
var _i5;
var boldUpright = {
  mathClass: "mathbf",
  textClass: "textbf",
  font: "Main-Bold"
};
var italic = {
  mathClass: "mathnormal",
  textClass: "textit",
  font: "Math-Italic"
};
var boldItalic = {
  mathClass: "boldsymbol",
  textClass: "boldsymbol",
  font: "Main-BoldItalic"
};
var script = {
  mathClass: "mathscr",
  textClass: "textscr",
  font: "Script-Regular"
};
var noFont = {
  mathClass: "",
  textClass: "",
  font: ""
};
var fraktur = {
  mathClass: "mathfrak",
  textClass: "textfrak",
  font: "Fraktur-Regular"
};
var doubleStruck = {
  mathClass: "mathbb",
  textClass: "textbb",
  font: "AMS-Regular"
};
var boldFraktur = {
  mathClass: "mathboldfrak",
  textClass: "textboldfrak",
  font: "Fraktur-Regular"
};
var sansSerif = {
  mathClass: "mathsf",
  textClass: "textsf",
  font: "SansSerif-Regular"
};
var boldSansSerif = {
  mathClass: "mathboldsf",
  textClass: "textboldsf",
  font: "SansSerif-Bold"
};
var italicSansSerif = {
  mathClass: "mathitsf",
  textClass: "textitsf",
  font: "SansSerif-Italic"
};
var monospace = {
  mathClass: "mathtt",
  textClass: "texttt",
  font: "Typewriter-Regular"
};
var wideLatinLetterData = [
  boldUpright,
  boldUpright,
  // A-Z, a-z
  italic,
  italic,
  // A-Z, a-z
  boldItalic,
  boldItalic,
  // A-Z, a-z
  // Map fancy A-Z letters to script, not calligraphic.
  // This aligns with unicode-math and math fonts (except Cambria Math).
  script,
  noFont,
  // A-Z script, a-z — no font
  noFont,
  noFont,
  // A-Z bold script, a-z bold script — no font
  fraktur,
  fraktur,
  // A-Z, a-z
  doubleStruck,
  doubleStruck,
  // A-Z double-struck, k double-struck
  // Note that we are using a bold font, but font metrics for regular Fraktur.
  boldFraktur,
  boldFraktur,
  // A-Z, a-z
  sansSerif,
  sansSerif,
  // A-Z, a-z
  boldSansSerif,
  boldSansSerif,
  // A-Z, a-z
  italicSansSerif,
  italicSansSerif,
  // A-Z, a-z
  noFont,
  noFont,
  // A-Z bold italic sans, a-z bold italic sans - no font
  monospace,
  monospace
  // A-Z, a-z
];
var wideNumeralData = [
  boldUpright,
  // 0-9
  noFont,
  // 0-9 double-struck. No KaTeX font.
  sansSerif,
  // 0-9
  boldSansSerif,
  // 0-9
  monospace
  // 0-9
];
var wideCharacterFont = (wideChar2) => {
  var H = wideChar2.charCodeAt(0);
  var L2 = wideChar2.charCodeAt(1);
  var codePoint = (H - 55296) * 1024 + (L2 - 56320) + 65536;
  if (119808 <= codePoint && codePoint < 120484) {
    var i4 = Math.floor((codePoint - 119808) / 26);
    return wideLatinLetterData[i4];
  } else if (120782 <= codePoint && codePoint <= 120831) {
    var _i6 = Math.floor((codePoint - 120782) / 10);
    return wideNumeralData[_i6];
  } else if (codePoint === 120485 || codePoint === 120486) {
    return wideLatinLetterData[0];
  } else if (120486 < codePoint && codePoint < 120782) {
    return noFont;
  } else {
    throw new ParseError("Unsupported character: " + wideChar2);
  }
};
var lookupSymbol = function lookupSymbol2(value, fontName, mode) {
  if (symbols2[mode][value]) {
    var replacement = symbols2[mode][value].replace;
    if (replacement) {
      value = replacement;
    }
  }
  return {
    value,
    metrics: getCharacterMetrics(value, fontName, mode)
  };
};
var makeSymbol = function makeSymbol2(value, fontName, mode, options, classes) {
  var lookup = lookupSymbol(value, fontName, mode);
  var metrics = lookup.metrics;
  value = lookup.value;
  var symbolNode;
  if (metrics) {
    var italic2 = metrics.italic;
    if (mode === "text" || options && options.font === "mathit") {
      italic2 = 0;
    }
    symbolNode = new SymbolNode(value, metrics.height, metrics.depth, italic2, metrics.skew, metrics.width, classes);
  } else {
    typeof console !== "undefined" && console.warn("No character metrics " + ("for '" + value + "' in style '" + fontName + "' and mode '" + mode + "'"));
    symbolNode = new SymbolNode(value, 0, 0, 0, 0, 0, classes);
  }
  if (options) {
    symbolNode.maxFontSize = options.sizeMultiplier;
    if (options.style.isTight()) {
      symbolNode.classes.push("mtight");
    }
    var color = options.getColor();
    if (color) {
      symbolNode.style.color = color;
    }
  }
  return symbolNode;
};
var mathsym = function mathsym2(value, mode, options, classes) {
  if (classes === void 0) {
    classes = [];
  }
  if (options.font === "boldsymbol" && lookupSymbol(value, "Main-Bold", mode).metrics) {
    return makeSymbol(value, "Main-Bold", mode, options, classes.concat(["mathbf"]));
  } else if (value === "\\" || symbols2[mode][value].font === "main") {
    return makeSymbol(value, "Main-Regular", mode, options, classes);
  } else {
    return makeSymbol(value, "AMS-Regular", mode, options, classes.concat(["amsrm"]));
  }
};
var boldSymbol = function boldSymbol2(value, mode, type) {
  if (type !== "textord" && lookupSymbol(value, "Math-BoldItalic", mode).metrics) {
    return {
      fontName: "Math-BoldItalic",
      fontClass: "boldsymbol"
    };
  } else {
    return {
      fontName: "Main-Bold",
      fontClass: "mathbf"
    };
  }
};
var makeOrd = function makeOrd2(group, options, type) {
  var mode = group.mode;
  var text2 = group.text;
  var classes = ["mord"];
  var {
    font,
    fontFamily,
    fontWeight,
    fontShape
  } = options;
  var useFont = mode === "math" || mode === "text" && !!font;
  var fontOrFamily = useFont ? font : fontFamily;
  var wideFontName = "";
  var wideFontClass = "";
  if (text2.charCodeAt(0) === 55349) {
    var wideCharData = wideCharacterFont(text2);
    wideFontName = wideCharData.font;
    wideFontClass = wideCharData[mode + "Class"];
  }
  if (wideFontName) {
    return makeSymbol(text2, wideFontName, mode, options, classes.concat(wideFontClass));
  } else if (fontOrFamily) {
    var fontName;
    var fontClasses;
    if (fontOrFamily === "boldsymbol") {
      var fontData = boldSymbol(text2, mode, type);
      fontName = fontData.fontName;
      fontClasses = [fontData.fontClass];
    } else if (useFont) {
      fontName = fontMap[font].fontName;
      fontClasses = [font];
    } else {
      fontName = retrieveTextFontName(fontFamily, fontWeight, fontShape);
      fontClasses = [fontFamily, fontWeight, fontShape];
    }
    if (lookupSymbol(text2, fontName, mode).metrics) {
      return makeSymbol(text2, fontName, mode, options, classes.concat(fontClasses));
    } else if (ligatures.hasOwnProperty(text2) && fontName.slice(0, 10) === "Typewriter") {
      var parts = [];
      for (var i4 = 0; i4 < text2.length; i4++) {
        parts.push(makeSymbol(text2[i4], fontName, mode, options, classes.concat(fontClasses)));
      }
      return makeFragment(parts);
    }
  }
  if (type === "mathord") {
    return makeSymbol(text2, "Math-Italic", mode, options, classes.concat(["mathnormal"]));
  } else if (type === "textord") {
    var _font = symbols2[mode][text2] && symbols2[mode][text2].font;
    if (_font === "ams") {
      var _fontName = retrieveTextFontName("amsrm", fontWeight, fontShape);
      return makeSymbol(text2, _fontName, mode, options, classes.concat("amsrm", fontWeight, fontShape));
    } else if (_font === "main" || !_font) {
      var _fontName2 = retrieveTextFontName("textrm", fontWeight, fontShape);
      return makeSymbol(text2, _fontName2, mode, options, classes.concat(fontWeight, fontShape));
    } else {
      var _fontName3 = retrieveTextFontName(_font, fontWeight, fontShape);
      return makeSymbol(text2, _fontName3, mode, options, classes.concat(_fontName3, fontWeight, fontShape));
    }
  } else {
    throw new Error("unexpected type: " + type + " in makeOrd");
  }
};
var canCombine = (prev, next) => {
  if (createClass(prev.classes) !== createClass(next.classes) || prev.skew !== next.skew || prev.maxFontSize !== next.maxFontSize || prev.italic !== 0 && prev.hasClass("mathnormal")) {
    return false;
  }
  if (prev.classes.length === 1) {
    var cls = prev.classes[0];
    if (cls === "mbin" || cls === "mord") {
      return false;
    }
  }
  for (var key of Object.keys(prev.style)) {
    if (prev.style[key] !== next.style[key]) {
      return false;
    }
  }
  for (var _key of Object.keys(next.style)) {
    if (prev.style[_key] !== next.style[_key]) {
      return false;
    }
  }
  return true;
};
var tryCombineChars = (chars) => {
  for (var i4 = 0; i4 < chars.length - 1; i4++) {
    var prev = chars[i4];
    var next = chars[i4 + 1];
    if (prev instanceof SymbolNode && next instanceof SymbolNode && canCombine(prev, next)) {
      prev.text += next.text;
      prev.height = Math.max(prev.height, next.height);
      prev.depth = Math.max(prev.depth, next.depth);
      prev.italic = next.italic;
      chars.splice(i4 + 1, 1);
      i4--;
    }
  }
  return chars;
};
var sizeElementFromChildren = function sizeElementFromChildren2(elem) {
  var height = 0;
  var depth = 0;
  var maxFontSize = 0;
  for (var i4 = 0; i4 < elem.children.length; i4++) {
    var child = elem.children[i4];
    if (child.height > height) {
      height = child.height;
    }
    if (child.depth > depth) {
      depth = child.depth;
    }
    if (child.maxFontSize > maxFontSize) {
      maxFontSize = child.maxFontSize;
    }
  }
  elem.height = height;
  elem.depth = depth;
  elem.maxFontSize = maxFontSize;
};
var makeSpan = function makeSpan2(classes, children, options, style) {
  var span = new Span(classes, children, options, style);
  sizeElementFromChildren(span);
  return span;
};
var makeSvgSpan = (classes, children, options, style) => new Span(classes, children, options, style);
var makeLineSpan = function makeLineSpan2(className, options, thickness) {
  var line = makeSpan([className], [], options);
  line.height = Math.max(thickness || options.fontMetrics().defaultRuleThickness, options.minRuleThickness);
  line.style.borderBottomWidth = makeEm(line.height);
  line.maxFontSize = 1;
  return line;
};
var makeAnchor = function makeAnchor2(href, classes, children, options) {
  var anchor = new Anchor(href, classes, children, options);
  sizeElementFromChildren(anchor);
  return anchor;
};
var makeFragment = function makeFragment2(children) {
  var fragment = new DocumentFragment(children);
  sizeElementFromChildren(fragment);
  return fragment;
};
var wrapFragment = function wrapFragment2(group, options) {
  if (group instanceof DocumentFragment) {
    return makeSpan([], [group], options);
  }
  return group;
};
var getVListChildrenAndDepth = function getVListChildrenAndDepth2(params) {
  if (params.positionType === "individualShift") {
    var oldChildren = params.children;
    var children = [oldChildren[0]];
    var _depth = -oldChildren[0].shift - oldChildren[0].elem.depth;
    var currPos = _depth;
    for (var i4 = 1; i4 < oldChildren.length; i4++) {
      var diff = -oldChildren[i4].shift - currPos - oldChildren[i4].elem.depth;
      var size = diff - (oldChildren[i4 - 1].elem.height + oldChildren[i4 - 1].elem.depth);
      currPos = currPos + diff;
      children.push({
        type: "kern",
        size
      });
      children.push(oldChildren[i4]);
    }
    return {
      children,
      depth: _depth
    };
  }
  var depth;
  if (params.positionType === "top") {
    var bottom = params.positionData;
    for (var _i6 = 0; _i6 < params.children.length; _i6++) {
      var child = params.children[_i6];
      bottom -= child.type === "kern" ? child.size : child.elem.height + child.elem.depth;
    }
    depth = bottom;
  } else if (params.positionType === "bottom") {
    depth = -params.positionData;
  } else {
    var firstChild = params.children[0];
    if (firstChild.type !== "elem") {
      throw new Error('First child must have type "elem".');
    }
    if (params.positionType === "shift") {
      depth = -firstChild.elem.depth - params.positionData;
    } else if (params.positionType === "firstBaseline") {
      depth = -firstChild.elem.depth;
    } else {
      throw new Error("Invalid positionType " + params.positionType + ".");
    }
  }
  return {
    children: params.children,
    depth
  };
};
var makeVList = function makeVList2(params, options) {
  var {
    children,
    depth
  } = getVListChildrenAndDepth(params);
  var pstrutSize = 0;
  for (var i4 = 0; i4 < children.length; i4++) {
    var child = children[i4];
    if (child.type === "elem") {
      var elem = child.elem;
      pstrutSize = Math.max(pstrutSize, elem.maxFontSize, elem.height);
    }
  }
  pstrutSize += 2;
  var pstrut = makeSpan(["pstrut"], []);
  pstrut.style.height = makeEm(pstrutSize);
  var realChildren = [];
  var minPos = depth;
  var maxPos = depth;
  var currPos = depth;
  for (var _i22 = 0; _i22 < children.length; _i22++) {
    var _child = children[_i22];
    if (_child.type === "kern") {
      currPos += _child.size;
    } else {
      var _elem = _child.elem;
      var classes = _child.wrapperClasses || [];
      var style = _child.wrapperStyle || {};
      var childWrap = makeSpan(classes, [pstrut, _elem], void 0, style);
      childWrap.style.top = makeEm(-pstrutSize - currPos - _elem.depth);
      if (_child.marginLeft) {
        childWrap.style.marginLeft = _child.marginLeft;
      }
      if (_child.marginRight) {
        childWrap.style.marginRight = _child.marginRight;
      }
      realChildren.push(childWrap);
      currPos += _elem.height + _elem.depth;
    }
    minPos = Math.min(minPos, currPos);
    maxPos = Math.max(maxPos, currPos);
  }
  var vlist = makeSpan(["vlist"], realChildren);
  vlist.style.height = makeEm(maxPos);
  var rows;
  if (minPos < 0) {
    var emptySpan = makeSpan([], []);
    var depthStrut = makeSpan(["vlist"], [emptySpan]);
    depthStrut.style.height = makeEm(-minPos);
    var topStrut = makeSpan(["vlist-s"], [new SymbolNode("\u200B")]);
    rows = [makeSpan(["vlist-r"], [vlist, topStrut]), makeSpan(["vlist-r"], [depthStrut])];
  } else {
    rows = [makeSpan(["vlist-r"], [vlist])];
  }
  var vtable = makeSpan(["vlist-t"], rows);
  if (rows.length === 2) {
    vtable.classes.push("vlist-t2");
  }
  vtable.height = maxPos;
  vtable.depth = -minPos;
  return vtable;
};
var makeGlue = (measurement, options) => {
  var rule = makeSpan(["mspace"], [], options);
  var size = calculateSize(measurement, options);
  rule.style.marginRight = makeEm(size);
  return rule;
};
var retrieveTextFontName = (fontFamily, fontWeight, fontShape) => {
  var baseFontName;
  var fontStylesName;
  switch (fontFamily) {
    case "amsrm":
      baseFontName = "AMS";
      break;
    case "textrm":
      baseFontName = "Main";
      break;
    case "textsf":
      baseFontName = "SansSerif";
      break;
    case "texttt":
      baseFontName = "Typewriter";
      break;
    default:
      baseFontName = fontFamily;
  }
  if (fontWeight === "textbf" && fontShape === "textit") {
    fontStylesName = "BoldItalic";
  } else if (fontWeight === "textbf") {
    fontStylesName = "Bold";
  } else if (fontShape === "textit") {
    fontStylesName = "Italic";
  } else {
    fontStylesName = "Regular";
  }
  return baseFontName + "-" + fontStylesName;
};
var fontMap = {
  // styles
  "mathbf": {
    variant: "bold",
    fontName: "Main-Bold"
  },
  "mathrm": {
    variant: "normal",
    fontName: "Main-Regular"
  },
  "textit": {
    variant: "italic",
    fontName: "Main-Italic"
  },
  "mathit": {
    variant: "italic",
    fontName: "Main-Italic"
  },
  "mathnormal": {
    variant: "italic",
    fontName: "Math-Italic"
  },
  "mathsfit": {
    variant: "sans-serif-italic",
    fontName: "SansSerif-Italic"
  },
  // "boldsymbol" is missing because they require the use of multiple fonts:
  // Math-BoldItalic and Main-Bold.  This is handled by a special case in
  // makeOrd which ends up calling boldsymbol.
  // families
  "mathbb": {
    variant: "double-struck",
    fontName: "AMS-Regular"
  },
  "mathcal": {
    variant: "script",
    fontName: "Caligraphic-Regular"
  },
  "mathfrak": {
    variant: "fraktur",
    fontName: "Fraktur-Regular"
  },
  "mathscr": {
    variant: "script",
    fontName: "Script-Regular"
  },
  "mathsf": {
    variant: "sans-serif",
    fontName: "SansSerif-Regular"
  },
  "mathtt": {
    variant: "monospace",
    fontName: "Typewriter-Regular"
  }
};
var svgData = {
  //   path, width, height
  vec: ["vec", 0.471, 0.714],
  // values from the font glyph
  oiintSize1: ["oiintSize1", 0.957, 0.499],
  // oval to overlay the integrand
  oiintSize2: ["oiintSize2", 1.472, 0.659],
  oiiintSize1: ["oiiintSize1", 1.304, 0.499],
  oiiintSize2: ["oiiintSize2", 1.98, 0.659]
};
var staticSvg = function staticSvg2(value, options) {
  var [pathName, width, height] = svgData[value];
  var path7 = new PathNode(pathName);
  var svgNode = new SvgNode([path7], {
    "width": makeEm(width),
    "height": makeEm(height),
    // Override CSS rule `.katex svg { width: 100% }`
    "style": "width:" + makeEm(width),
    "viewBox": "0 0 " + 1e3 * width + " " + 1e3 * height,
    "preserveAspectRatio": "xMinYMin"
  });
  var span = makeSvgSpan(["overlay"], [svgNode], options);
  span.height = height;
  span.style.height = makeEm(height);
  span.style.width = makeEm(width);
  return span;
};
var thinspace = {
  number: 3,
  unit: "mu"
};
var mediumspace = {
  number: 4,
  unit: "mu"
};
var thickspace = {
  number: 5,
  unit: "mu"
};
var spacings = {
  mord: {
    mop: thinspace,
    mbin: mediumspace,
    mrel: thickspace,
    minner: thinspace
  },
  mop: {
    mord: thinspace,
    mop: thinspace,
    mrel: thickspace,
    minner: thinspace
  },
  mbin: {
    mord: mediumspace,
    mop: mediumspace,
    mopen: mediumspace,
    minner: mediumspace
  },
  mrel: {
    mord: thickspace,
    mop: thickspace,
    mopen: thickspace,
    minner: thickspace
  },
  mopen: {},
  mclose: {
    mop: thinspace,
    mbin: mediumspace,
    mrel: thickspace,
    minner: thinspace
  },
  mpunct: {
    mord: thinspace,
    mop: thinspace,
    mrel: thickspace,
    mopen: thinspace,
    mclose: thinspace,
    mpunct: thinspace,
    minner: thinspace
  },
  minner: {
    mord: thinspace,
    mop: thinspace,
    mbin: mediumspace,
    mrel: thickspace,
    mopen: thinspace,
    mpunct: thinspace,
    minner: thinspace
  }
};
var tightSpacings = {
  mord: {
    mop: thinspace
  },
  mop: {
    mord: thinspace,
    mop: thinspace
  },
  mbin: {},
  mrel: {},
  mopen: {},
  mclose: {
    mop: thinspace
  },
  mpunct: {},
  minner: {
    mop: thinspace
  }
};
var _functions = {};
var _htmlGroupBuilders = {};
var _mathmlGroupBuilders = {};
function defineFunction(_ref) {
  var {
    type,
    names,
    props,
    handler,
    htmlBuilder: htmlBuilder3,
    mathmlBuilder: mathmlBuilder3
  } = _ref;
  var data = {
    type,
    numArgs: props.numArgs,
    argTypes: props.argTypes,
    allowedInArgument: !!props.allowedInArgument,
    allowedInText: !!props.allowedInText,
    allowedInMath: props.allowedInMath === void 0 ? true : props.allowedInMath,
    numOptionalArgs: props.numOptionalArgs || 0,
    infix: !!props.infix,
    primitive: !!props.primitive,
    handler
  };
  for (var i4 = 0; i4 < names.length; ++i4) {
    _functions[names[i4]] = data;
  }
  if (type) {
    if (htmlBuilder3) {
      _htmlGroupBuilders[type] = htmlBuilder3;
    }
    if (mathmlBuilder3) {
      _mathmlGroupBuilders[type] = mathmlBuilder3;
    }
  }
}
function defineFunctionBuilders(_ref2) {
  var {
    type,
    htmlBuilder: htmlBuilder3,
    mathmlBuilder: mathmlBuilder3
  } = _ref2;
  defineFunction({
    type,
    names: [],
    props: {
      numArgs: 0
    },
    handler() {
      throw new Error("Should never be called.");
    },
    htmlBuilder: htmlBuilder3,
    mathmlBuilder: mathmlBuilder3
  });
}
var normalizeArgument = function normalizeArgument2(arg) {
  return arg.type === "ordgroup" && arg.body.length === 1 ? arg.body[0] : arg;
};
var ordargument = function ordargument2(arg) {
  return arg.type === "ordgroup" ? arg.body : [arg];
};
var binLeftCanceller = /* @__PURE__ */ new Set(["leftmost", "mbin", "mopen", "mrel", "mop", "mpunct"]);
var binRightCanceller = /* @__PURE__ */ new Set(["rightmost", "mrel", "mclose", "mpunct"]);
var styleMap$1 = {
  "display": Style$1.DISPLAY,
  "text": Style$1.TEXT,
  "script": Style$1.SCRIPT,
  "scriptscript": Style$1.SCRIPTSCRIPT
};
var DomEnum = {
  mord: "mord",
  mop: "mop",
  mbin: "mbin",
  mrel: "mrel",
  mopen: "mopen",
  mclose: "mclose",
  mpunct: "mpunct",
  minner: "minner"
};
var buildExpression$1 = function buildExpression(expression, options, isRealGroup, surrounding) {
  if (surrounding === void 0) {
    surrounding = [null, null];
  }
  var groups = [];
  for (var i4 = 0; i4 < expression.length; i4++) {
    var output = buildGroup$1(expression[i4], options);
    if (output instanceof DocumentFragment) {
      var children = output.children;
      groups.push(...children);
    } else {
      groups.push(output);
    }
  }
  tryCombineChars(groups);
  if (!isRealGroup) {
    return groups;
  }
  var glueOptions = options;
  if (expression.length === 1) {
    var node = expression[0];
    if (node.type === "sizing") {
      glueOptions = options.havingSize(node.size);
    } else if (node.type === "styling") {
      glueOptions = options.havingStyle(styleMap$1[node.style]);
    }
  }
  var dummyPrev = makeSpan([surrounding[0] || "leftmost"], [], options);
  var dummyNext = makeSpan([surrounding[1] || "rightmost"], [], options);
  var isRoot = isRealGroup === "root";
  _traverseNonSpaceNodes(groups, (node2, prev) => {
    var prevType = prev.classes[0];
    var type = node2.classes[0];
    if (prevType === "mbin" && binRightCanceller.has(type)) {
      prev.classes[0] = "mord";
    } else if (type === "mbin" && binLeftCanceller.has(prevType)) {
      node2.classes[0] = "mord";
    }
  }, {
    node: dummyPrev
  }, dummyNext, isRoot);
  _traverseNonSpaceNodes(groups, (node2, prev) => {
    var _tightSpacings$prevTy, _spacings$prevType;
    var prevType = getTypeOfDomTree(prev);
    var type = getTypeOfDomTree(node2);
    var space = prevType && type ? node2.hasClass("mtight") ? (_tightSpacings$prevTy = tightSpacings[prevType]) == null ? void 0 : _tightSpacings$prevTy[type] : (_spacings$prevType = spacings[prevType]) == null ? void 0 : _spacings$prevType[type] : null;
    if (space) {
      return makeGlue(space, glueOptions);
    }
  }, {
    node: dummyPrev
  }, dummyNext, isRoot);
  return groups;
};
var _traverseNonSpaceNodes = function traverseNonSpaceNodes(nodes, callback, prev, next, isRoot) {
  if (next) {
    nodes.push(next);
  }
  var i4 = 0;
  for (; i4 < nodes.length; i4++) {
    var node = nodes[i4];
    var partialGroup = checkPartialGroup(node);
    if (partialGroup) {
      _traverseNonSpaceNodes(partialGroup.children, callback, prev, null, isRoot);
      continue;
    }
    var nonspace = !node.hasClass("mspace");
    if (nonspace) {
      var result = callback(node, prev.node);
      if (result) {
        if (prev.insertAfter) {
          prev.insertAfter(result);
        } else {
          nodes.unshift(result);
          i4++;
        }
      }
    }
    if (nonspace) {
      prev.node = node;
    } else if (isRoot && node.hasClass("newline")) {
      prev.node = makeSpan(["leftmost"]);
    }
    prev.insertAfter = /* @__PURE__ */ ((index) => (n3) => {
      nodes.splice(index + 1, 0, n3);
      i4++;
    })(i4);
  }
  if (next) {
    nodes.pop();
  }
};
var checkPartialGroup = function checkPartialGroup2(node) {
  if (node instanceof DocumentFragment || node instanceof Anchor || node instanceof Span && node.hasClass("enclosing")) {
    return node;
  }
  return null;
};
var _getOutermostNode = function getOutermostNode(node, side) {
  var partialGroup = checkPartialGroup(node);
  if (partialGroup) {
    var children = partialGroup.children;
    if (children.length) {
      if (side === "right") {
        return _getOutermostNode(children[children.length - 1], "right");
      } else if (side === "left") {
        return _getOutermostNode(children[0], "left");
      }
    }
  }
  return node;
};
var getTypeOfDomTree = function getTypeOfDomTree2(node, side) {
  if (!node) {
    return null;
  }
  if (side) {
    node = _getOutermostNode(node, side);
  }
  var className = node.classes[0];
  return DomEnum[className] || null;
};
var makeNullDelimiter = function makeNullDelimiter2(options, classes) {
  var moreClasses = ["nulldelimiter"].concat(options.baseSizingClasses());
  return makeSpan(classes.concat(moreClasses));
};
var buildGroup$1 = function buildGroup(group, options, baseOptions) {
  if (!group) {
    return makeSpan();
  }
  if (_htmlGroupBuilders[group.type]) {
    var groupNode = _htmlGroupBuilders[group.type](group, options);
    if (baseOptions && options.size !== baseOptions.size) {
      groupNode = makeSpan(options.sizingClasses(baseOptions), [groupNode], options);
      var multiplier = options.sizeMultiplier / baseOptions.sizeMultiplier;
      groupNode.height *= multiplier;
      groupNode.depth *= multiplier;
    }
    return groupNode;
  } else {
    throw new ParseError("Got group of unknown type: '" + group.type + "'");
  }
};
function buildHTMLUnbreakable(children, options) {
  var body = makeSpan(["base"], children, options);
  var strut = makeSpan(["strut"]);
  strut.style.height = makeEm(body.height + body.depth);
  if (body.depth) {
    strut.style.verticalAlign = makeEm(-body.depth);
  }
  body.children.unshift(strut);
  return body;
}
function buildHTML(tree, options) {
  var tag = null;
  if (tree.length === 1 && tree[0].type === "tag") {
    tag = tree[0].tag;
    tree = tree[0].body;
  }
  var expression = buildExpression$1(tree, options, "root");
  var eqnNum;
  if (expression.length === 2 && expression[1].hasClass("tag")) {
    eqnNum = expression.pop();
  }
  var children = [];
  var parts = [];
  for (var i4 = 0; i4 < expression.length; i4++) {
    parts.push(expression[i4]);
    if (expression[i4].hasClass("mbin") || expression[i4].hasClass("mrel") || expression[i4].hasClass("allowbreak")) {
      var nobreak = false;
      while (i4 < expression.length - 1 && expression[i4 + 1].hasClass("mspace") && !expression[i4 + 1].hasClass("newline")) {
        i4++;
        parts.push(expression[i4]);
        if (expression[i4].hasClass("nobreak")) {
          nobreak = true;
        }
      }
      if (!nobreak) {
        children.push(buildHTMLUnbreakable(parts, options));
        parts = [];
      }
    } else if (expression[i4].hasClass("newline")) {
      parts.pop();
      if (parts.length > 0) {
        children.push(buildHTMLUnbreakable(parts, options));
        parts = [];
      }
      children.push(expression[i4]);
    }
  }
  if (parts.length > 0) {
    children.push(buildHTMLUnbreakable(parts, options));
  }
  var tagChild;
  if (tag) {
    tagChild = buildHTMLUnbreakable(buildExpression$1(tag, options, true), options);
    tagChild.classes = ["tag"];
    children.push(tagChild);
  } else if (eqnNum) {
    children.push(eqnNum);
  }
  var htmlNode = makeSpan(["katex-html"], children);
  htmlNode.setAttribute("aria-hidden", "true");
  if (tagChild) {
    var strut = tagChild.children[0];
    strut.style.height = makeEm(htmlNode.height + htmlNode.depth);
    if (htmlNode.depth) {
      strut.style.verticalAlign = makeEm(-htmlNode.depth);
    }
  }
  return htmlNode;
}
function newDocumentFragment(children) {
  return new DocumentFragment(children);
}
var MathNode = class {
  constructor(type, children, classes) {
    this.type = void 0;
    this.attributes = void 0;
    this.children = void 0;
    this.classes = void 0;
    this.type = type;
    this.attributes = {};
    this.children = children || [];
    this.classes = classes || [];
  }
  /**
   * Sets an attribute on a MathML node. MathML depends on attributes to convey a
   * semantic content, so this is used heavily.
   */
  setAttribute(name2, value) {
    this.attributes[name2] = value;
  }
  /**
   * Gets an attribute on a MathML node.
   */
  getAttribute(name2) {
    return this.attributes[name2];
  }
  /**
   * Converts the math node into a MathML-namespaced DOM element.
   */
  toNode() {
    var node = document.createElementNS("http://www.w3.org/1998/Math/MathML", this.type);
    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        node.setAttribute(attr, this.attributes[attr]);
      }
    }
    if (this.classes.length > 0) {
      node.className = createClass(this.classes);
    }
    for (var i4 = 0; i4 < this.children.length; i4++) {
      if (this.children[i4] instanceof TextNode && this.children[i4 + 1] instanceof TextNode) {
        var text2 = this.children[i4].toText() + this.children[++i4].toText();
        while (this.children[i4 + 1] instanceof TextNode) {
          text2 += this.children[++i4].toText();
        }
        node.appendChild(new TextNode(text2).toNode());
      } else {
        node.appendChild(this.children[i4].toNode());
      }
    }
    return node;
  }
  /**
   * Converts the math node into an HTML markup string.
   */
  toMarkup() {
    var markup = "<" + this.type;
    for (var attr in this.attributes) {
      if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
        markup += " " + attr + '="';
        markup += escape(this.attributes[attr]);
        markup += '"';
      }
    }
    if (this.classes.length > 0) {
      markup += ' class ="' + escape(createClass(this.classes)) + '"';
    }
    markup += ">";
    for (var i4 = 0; i4 < this.children.length; i4++) {
      markup += this.children[i4].toMarkup();
    }
    markup += "</" + this.type + ">";
    return markup;
  }
  /**
   * Converts the math node into a string, similar to innerText, but escaped.
   */
  toText() {
    return this.children.map((child) => child.toText()).join("");
  }
};
var TextNode = class {
  constructor(text2) {
    this.text = void 0;
    this.text = text2;
  }
  /**
   * Converts the text node into a DOM text node.
   */
  toNode() {
    return document.createTextNode(this.text);
  }
  /**
   * Converts the text node into escaped HTML markup
   * (representing the text itself).
   */
  toMarkup() {
    return escape(this.toText());
  }
  /**
   * Converts the text node into a string
   * (representing the text itself).
   */
  toText() {
    return this.text;
  }
};
var SpaceNode = class {
  /**
   * Create a Space node with width given in CSS ems.
   */
  constructor(width) {
    this.width = void 0;
    this.character = void 0;
    this.width = width;
    if (width >= 0.05555 && width <= 0.05556) {
      this.character = "\u200A";
    } else if (width >= 0.1666 && width <= 0.1667) {
      this.character = "\u2009";
    } else if (width >= 0.2222 && width <= 0.2223) {
      this.character = "\u2005";
    } else if (width >= 0.2777 && width <= 0.2778) {
      this.character = "\u2005\u200A";
    } else if (width >= -0.05556 && width <= -0.05555) {
      this.character = "\u200A\u2063";
    } else if (width >= -0.1667 && width <= -0.1666) {
      this.character = "\u2009\u2063";
    } else if (width >= -0.2223 && width <= -0.2222) {
      this.character = "\u205F\u2063";
    } else if (width >= -0.2778 && width <= -0.2777) {
      this.character = "\u2005\u2063";
    } else {
      this.character = null;
    }
  }
  /**
   * Converts the math node into a MathML-namespaced DOM element.
   */
  toNode() {
    if (this.character) {
      return document.createTextNode(this.character);
    } else {
      var node = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mspace");
      node.setAttribute("width", makeEm(this.width));
      return node;
    }
  }
  /**
   * Converts the math node into an HTML markup string.
   */
  toMarkup() {
    if (this.character) {
      return "<mtext>" + this.character + "</mtext>";
    } else {
      return '<mspace width="' + makeEm(this.width) + '"/>';
    }
  }
  /**
   * Converts the math node into a string, similar to innerText.
   */
  toText() {
    if (this.character) {
      return this.character;
    } else {
      return " ";
    }
  }
};
var noVariantSymbols = /* @__PURE__ */ new Set(["\\imath", "\\jmath"]);
var rowLikeTypes = /* @__PURE__ */ new Set(["mrow", "mtable"]);
var makeText = function makeText2(text2, mode, options) {
  if (symbols2[mode][text2] && symbols2[mode][text2].replace && text2.charCodeAt(0) !== 55349 && !(ligatures.hasOwnProperty(text2) && options && (options.fontFamily && options.fontFamily.slice(4, 6) === "tt" || options.font && options.font.slice(4, 6) === "tt"))) {
    text2 = symbols2[mode][text2].replace;
  }
  return new TextNode(text2);
};
var makeRow = function makeRow2(body) {
  if (body.length === 1) {
    return body[0];
  } else {
    return new MathNode("mrow", body);
  }
};
var mathFontVariants = {
  mathit: "italic",
  boldsymbol: (group) => group.type === "textord" ? "bold" : "bold-italic",
  mathbf: "bold",
  mathbb: "double-struck",
  mathsfit: "sans-serif-italic",
  mathfrak: "fraktur",
  mathscr: "script",
  mathcal: "script",
  mathsf: "sans-serif",
  mathtt: "monospace"
};
var getVariant = (group, options) => {
  if (group.mode === "text") {
    if (options.fontFamily === "texttt") {
      return "monospace";
    } else if (options.fontFamily === "textsf") {
      if (options.fontShape === "textit" && options.fontWeight === "textbf") {
        return "sans-serif-bold-italic";
      } else if (options.fontShape === "textit") {
        return "sans-serif-italic";
      } else if (options.fontWeight === "textbf") {
        return "bold-sans-serif";
      } else {
        return "sans-serif";
      }
    } else if (options.fontShape === "textit" && options.fontWeight === "textbf") {
      return "bold-italic";
    } else if (options.fontShape === "textit") {
      return "italic";
    } else if (options.fontWeight === "textbf") {
      return "bold";
    }
  }
  var font = options.font;
  if (!font || font === "mathnormal") {
    return null;
  }
  var mode = group.mode;
  var mathVariant = mathFontVariants[font];
  if (mathVariant) {
    return typeof mathVariant === "function" ? mathVariant(group) : mathVariant;
  }
  var text2 = group.text;
  if (noVariantSymbols.has(text2)) {
    return null;
  }
  if (symbols2[mode][text2]) {
    var replacement = symbols2[mode][text2].replace;
    if (replacement) {
      text2 = replacement;
    }
  }
  var fontName = fontMap[font].fontName;
  if (getCharacterMetrics(text2, fontName, mode)) {
    return fontMap[font].variant;
  }
  return null;
};
function isNumberPunctuation(group) {
  if (!group) {
    return false;
  }
  if (group.type === "mi" && group.children.length === 1) {
    var child = group.children[0];
    return child instanceof TextNode && child.text === ".";
  } else if (group.type === "mo" && group.children.length === 1 && group.getAttribute("separator") === "true" && group.getAttribute("lspace") === "0em" && group.getAttribute("rspace") === "0em") {
    var _child = group.children[0];
    return _child instanceof TextNode && _child.text === ",";
  } else {
    return false;
  }
}
var buildExpression2 = function buildExpression3(expression, options, isOrdgroup) {
  if (expression.length === 1) {
    var group = buildGroup2(expression[0], options);
    if (isOrdgroup && group instanceof MathNode && group.type === "mo") {
      group.setAttribute("lspace", "0em");
      group.setAttribute("rspace", "0em");
    }
    return [group];
  }
  var groups = [];
  var lastGroup;
  for (var i4 = 0; i4 < expression.length; i4++) {
    var _group = buildGroup2(expression[i4], options);
    if (_group instanceof MathNode && lastGroup instanceof MathNode) {
      if (_group.type === "mtext" && lastGroup.type === "mtext" && _group.getAttribute("mathvariant") === lastGroup.getAttribute("mathvariant")) {
        lastGroup.children.push(..._group.children);
        continue;
      } else if (_group.type === "mn" && lastGroup.type === "mn") {
        lastGroup.children.push(..._group.children);
        continue;
      } else if (isNumberPunctuation(_group) && lastGroup.type === "mn") {
        lastGroup.children.push(..._group.children);
        continue;
      } else if (_group.type === "mn" && isNumberPunctuation(lastGroup)) {
        _group.children = [...lastGroup.children, ..._group.children];
        groups.pop();
      } else if ((_group.type === "msup" || _group.type === "msub") && _group.children.length >= 1 && (lastGroup.type === "mn" || isNumberPunctuation(lastGroup))) {
        var base = _group.children[0];
        if (base instanceof MathNode && base.type === "mn") {
          base.children = [...lastGroup.children, ...base.children];
          groups.pop();
        }
      } else if (lastGroup.type === "mi" && lastGroup.children.length === 1) {
        var lastChild = lastGroup.children[0];
        if (lastChild instanceof TextNode && lastChild.text === "\u0338" && (_group.type === "mo" || _group.type === "mi" || _group.type === "mn")) {
          var child = _group.children[0];
          if (child instanceof TextNode && child.text.length > 0) {
            child.text = child.text.slice(0, 1) + "\u0338" + child.text.slice(1);
            groups.pop();
          }
        }
      }
    }
    groups.push(_group);
    lastGroup = _group;
  }
  return groups;
};
var buildExpressionRow = function buildExpressionRow2(expression, options, isOrdgroup) {
  return makeRow(buildExpression2(expression, options, isOrdgroup));
};
var buildGroup2 = function buildGroup3(group, options) {
  if (!group) {
    return new MathNode("mrow");
  }
  if (_mathmlGroupBuilders[group.type]) {
    return _mathmlGroupBuilders[group.type](group, options);
  } else {
    throw new ParseError("Got group of unknown type: '" + group.type + "'");
  }
};
function buildMathML(tree, texExpression, options, isDisplayMode, forMathmlOnly) {
  var expression = buildExpression2(tree, options);
  var wrapper;
  if (expression.length === 1 && expression[0] instanceof MathNode && rowLikeTypes.has(expression[0].type)) {
    wrapper = expression[0];
  } else {
    wrapper = new MathNode("mrow", expression);
  }
  var annotation = new MathNode("annotation", [new TextNode(texExpression)]);
  annotation.setAttribute("encoding", "application/x-tex");
  var semantics = new MathNode("semantics", [wrapper, annotation]);
  var math2 = new MathNode("math", [semantics]);
  math2.setAttribute("xmlns", "http://www.w3.org/1998/Math/MathML");
  if (isDisplayMode) {
    math2.setAttribute("display", "block");
  }
  var wrapperClass = forMathmlOnly ? "katex" : "katex-mathml";
  return makeSpan([wrapperClass], [math2]);
}
var sizeStyleMap = [
  // Each element contains [textsize, scriptsize, scriptscriptsize].
  // The size mappings are taken from TeX with \normalsize=10pt.
  [1, 1, 1],
  // size1: [5, 5, 5]              \tiny
  [2, 1, 1],
  // size2: [6, 5, 5]
  [3, 1, 1],
  // size3: [7, 5, 5]              \scriptsize
  [4, 2, 1],
  // size4: [8, 6, 5]              \footnotesize
  [5, 2, 1],
  // size5: [9, 6, 5]              \small
  [6, 3, 1],
  // size6: [10, 7, 5]             \normalsize
  [7, 4, 2],
  // size7: [12, 8, 6]             \large
  [8, 6, 3],
  // size8: [14.4, 10, 7]          \Large
  [9, 7, 6],
  // size9: [17.28, 12, 10]        \LARGE
  [10, 8, 7],
  // size10: [20.74, 14.4, 12]     \huge
  [11, 10, 9]
  // size11: [24.88, 20.74, 17.28] \HUGE
];
var sizeMultipliers = [
  // fontMetrics.js:getGlobalMetrics also uses size indexes, so if
  // you change size indexes, change that function.
  0.5,
  0.6,
  0.7,
  0.8,
  0.9,
  1,
  1.2,
  1.44,
  1.728,
  2.074,
  2.488
];
var sizeAtStyle = function sizeAtStyle2(size, style) {
  return style.size < 2 ? size : sizeStyleMap[size - 1][style.size - 1];
};
var Options = class _Options {
  constructor(data) {
    this.style = void 0;
    this.color = void 0;
    this.size = void 0;
    this.textSize = void 0;
    this.phantom = void 0;
    this.font = void 0;
    this.fontFamily = void 0;
    this.fontWeight = void 0;
    this.fontShape = void 0;
    this.sizeMultiplier = void 0;
    this.maxSize = void 0;
    this.minRuleThickness = void 0;
    this._fontMetrics = void 0;
    this.style = data.style;
    this.color = data.color;
    this.size = data.size || _Options.BASESIZE;
    this.textSize = data.textSize || this.size;
    this.phantom = !!data.phantom;
    this.font = data.font || "";
    this.fontFamily = data.fontFamily || "";
    this.fontWeight = data.fontWeight || "";
    this.fontShape = data.fontShape || "";
    this.sizeMultiplier = sizeMultipliers[this.size - 1];
    this.maxSize = data.maxSize;
    this.minRuleThickness = data.minRuleThickness;
    this._fontMetrics = void 0;
  }
  /**
   * Returns a new options object with the same properties as "this".  Properties
   * from "extension" will be copied to the new options object.
   */
  extend(extension) {
    var data = {
      style: this.style,
      size: this.size,
      textSize: this.textSize,
      color: this.color,
      phantom: this.phantom,
      font: this.font,
      fontFamily: this.fontFamily,
      fontWeight: this.fontWeight,
      fontShape: this.fontShape,
      maxSize: this.maxSize,
      minRuleThickness: this.minRuleThickness
    };
    Object.assign(data, extension);
    return new _Options(data);
  }
  /**
   * Return an options object with the given style. If `this.style === style`,
   * returns `this`.
   */
  havingStyle(style) {
    if (this.style === style) {
      return this;
    } else {
      return this.extend({
        style,
        size: sizeAtStyle(this.textSize, style)
      });
    }
  }
  /**
   * Return an options object with a cramped version of the current style. If
   * the current style is cramped, returns `this`.
   */
  havingCrampedStyle() {
    return this.havingStyle(this.style.cramp());
  }
  /**
   * Return an options object with the given size and in at least `\textstyle`.
   * Returns `this` if appropriate.
   */
  havingSize(size) {
    if (this.size === size && this.textSize === size) {
      return this;
    } else {
      return this.extend({
        style: this.style.text(),
        size,
        textSize: size,
        sizeMultiplier: sizeMultipliers[size - 1]
      });
    }
  }
  /**
   * Like `this.havingSize(BASESIZE).havingStyle(style)`. If `style` is omitted,
   * changes to at least `\textstyle`.
   */
  havingBaseStyle(style) {
    style = style || this.style.text();
    var wantSize = sizeAtStyle(_Options.BASESIZE, style);
    if (this.size === wantSize && this.textSize === _Options.BASESIZE && this.style === style) {
      return this;
    } else {
      return this.extend({
        style,
        size: wantSize
      });
    }
  }
  /**
   * Remove the effect of sizing changes such as \Huge.
   * Keep the effect of the current style, such as \scriptstyle.
   */
  havingBaseSizing() {
    var size;
    switch (this.style.id) {
      case 4:
      case 5:
        size = 3;
        break;
      case 6:
      case 7:
        size = 1;
        break;
      default:
        size = 6;
    }
    return this.extend({
      style: this.style.text(),
      size
    });
  }
  /**
   * Create a new options object with the given color.
   */
  withColor(color) {
    return this.extend({
      color
    });
  }
  /**
   * Create a new options object with "phantom" set to true.
   */
  withPhantom() {
    return this.extend({
      phantom: true
    });
  }
  /**
   * Creates a new options object with the given math font or old text font.
   * @type {[type]}
   */
  withFont(font) {
    return this.extend({
      font
    });
  }
  /**
   * Create a new options objects with the given fontFamily.
   */
  withTextFontFamily(fontFamily) {
    return this.extend({
      fontFamily,
      font: ""
    });
  }
  /**
   * Creates a new options object with the given font weight
   */
  withTextFontWeight(fontWeight) {
    return this.extend({
      fontWeight,
      font: ""
    });
  }
  /**
   * Creates a new options object with the given font weight
   */
  withTextFontShape(fontShape) {
    return this.extend({
      fontShape,
      font: ""
    });
  }
  /**
   * Return the CSS sizing classes required to switch from enclosing options
   * `oldOptions` to `this`. Returns an array of classes.
   */
  sizingClasses(oldOptions) {
    if (oldOptions.size !== this.size) {
      return ["sizing", "reset-size" + oldOptions.size, "size" + this.size];
    } else {
      return [];
    }
  }
  /**
   * Return the CSS sizing classes required to switch to the base size. Like
   * `this.havingSize(BASESIZE).sizingClasses(this)`.
   */
  baseSizingClasses() {
    if (this.size !== _Options.BASESIZE) {
      return ["sizing", "reset-size" + this.size, "size" + _Options.BASESIZE];
    } else {
      return [];
    }
  }
  /**
   * Return the font metrics for this size.
   */
  fontMetrics() {
    if (!this._fontMetrics) {
      this._fontMetrics = getGlobalMetrics(this.size);
    }
    return this._fontMetrics;
  }
  /**
   * Gets the CSS color of the current options object
   */
  getColor() {
    if (this.phantom) {
      return "transparent";
    } else {
      return this.color;
    }
  }
};
Options.BASESIZE = 6;
var optionsFromSettings = function optionsFromSettings2(settings) {
  return new Options({
    style: settings.displayMode ? Style$1.DISPLAY : Style$1.TEXT,
    maxSize: settings.maxSize,
    minRuleThickness: settings.minRuleThickness
  });
};
var displayWrap = function displayWrap2(node, settings) {
  if (settings.displayMode) {
    var classes = ["katex-display"];
    if (settings.leqno) {
      classes.push("leqno");
    }
    if (settings.fleqn) {
      classes.push("fleqn");
    }
    node = makeSpan(classes, [node]);
  }
  return node;
};
var buildTree = function buildTree2(tree, expression, settings) {
  var options = optionsFromSettings(settings);
  var katexNode;
  if (settings.output === "mathml") {
    return buildMathML(tree, expression, options, settings.displayMode, true);
  } else if (settings.output === "html") {
    var htmlNode = buildHTML(tree, options);
    katexNode = makeSpan(["katex"], [htmlNode]);
  } else {
    var mathMLNode = buildMathML(tree, expression, options, settings.displayMode, false);
    var _htmlNode = buildHTML(tree, options);
    katexNode = makeSpan(["katex"], [mathMLNode, _htmlNode]);
  }
  return displayWrap(katexNode, settings);
};
var buildHTMLTree = function buildHTMLTree2(tree, expression, settings) {
  var options = optionsFromSettings(settings);
  var htmlNode = buildHTML(tree, options);
  var katexNode = makeSpan(["katex"], [htmlNode]);
  return displayWrap(katexNode, settings);
};
var stretchyCodePoint = {
  widehat: "^",
  widecheck: "\u02C7",
  widetilde: "~",
  utilde: "~",
  overleftarrow: "\u2190",
  underleftarrow: "\u2190",
  xleftarrow: "\u2190",
  overrightarrow: "\u2192",
  underrightarrow: "\u2192",
  xrightarrow: "\u2192",
  underbrace: "\u23DF",
  overbrace: "\u23DE",
  underbracket: "\u23B5",
  overbracket: "\u23B4",
  overgroup: "\u23E0",
  undergroup: "\u23E1",
  overleftrightarrow: "\u2194",
  underleftrightarrow: "\u2194",
  xleftrightarrow: "\u2194",
  Overrightarrow: "\u21D2",
  xRightarrow: "\u21D2",
  overleftharpoon: "\u21BC",
  xleftharpoonup: "\u21BC",
  overrightharpoon: "\u21C0",
  xrightharpoonup: "\u21C0",
  xLeftarrow: "\u21D0",
  xLeftrightarrow: "\u21D4",
  xhookleftarrow: "\u21A9",
  xhookrightarrow: "\u21AA",
  xmapsto: "\u21A6",
  xrightharpoondown: "\u21C1",
  xleftharpoondown: "\u21BD",
  xrightleftharpoons: "\u21CC",
  xleftrightharpoons: "\u21CB",
  xtwoheadleftarrow: "\u219E",
  xtwoheadrightarrow: "\u21A0",
  xlongequal: "=",
  xtofrom: "\u21C4",
  xrightleftarrows: "\u21C4",
  xrightequilibrium: "\u21CC",
  // Not a perfect match.
  xleftequilibrium: "\u21CB",
  // None better available.
  "\\cdrightarrow": "\u2192",
  "\\cdleftarrow": "\u2190",
  "\\cdlongequal": "="
};
var stretchyMathML = function stretchyMathML2(label) {
  var node = new MathNode("mo", [new TextNode(stretchyCodePoint[label.replace(/^\\/, "")])]);
  node.setAttribute("stretchy", "true");
  return node;
};
var katexImagesData = {
  //   path(s), minWidth, height, align
  overrightarrow: [["rightarrow"], 0.888, 522, "xMaxYMin"],
  overleftarrow: [["leftarrow"], 0.888, 522, "xMinYMin"],
  underrightarrow: [["rightarrow"], 0.888, 522, "xMaxYMin"],
  underleftarrow: [["leftarrow"], 0.888, 522, "xMinYMin"],
  xrightarrow: [["rightarrow"], 1.469, 522, "xMaxYMin"],
  "\\cdrightarrow": [["rightarrow"], 3, 522, "xMaxYMin"],
  // CD minwwidth2.5pc
  xleftarrow: [["leftarrow"], 1.469, 522, "xMinYMin"],
  "\\cdleftarrow": [["leftarrow"], 3, 522, "xMinYMin"],
  Overrightarrow: [["doublerightarrow"], 0.888, 560, "xMaxYMin"],
  xRightarrow: [["doublerightarrow"], 1.526, 560, "xMaxYMin"],
  xLeftarrow: [["doubleleftarrow"], 1.526, 560, "xMinYMin"],
  overleftharpoon: [["leftharpoon"], 0.888, 522, "xMinYMin"],
  xleftharpoonup: [["leftharpoon"], 0.888, 522, "xMinYMin"],
  xleftharpoondown: [["leftharpoondown"], 0.888, 522, "xMinYMin"],
  overrightharpoon: [["rightharpoon"], 0.888, 522, "xMaxYMin"],
  xrightharpoonup: [["rightharpoon"], 0.888, 522, "xMaxYMin"],
  xrightharpoondown: [["rightharpoondown"], 0.888, 522, "xMaxYMin"],
  xlongequal: [["longequal"], 0.888, 334, "xMinYMin"],
  "\\cdlongequal": [["longequal"], 3, 334, "xMinYMin"],
  xtwoheadleftarrow: [["twoheadleftarrow"], 0.888, 334, "xMinYMin"],
  xtwoheadrightarrow: [["twoheadrightarrow"], 0.888, 334, "xMaxYMin"],
  overleftrightarrow: [["leftarrow", "rightarrow"], 0.888, 522],
  overbrace: [["leftbrace", "midbrace", "rightbrace"], 1.6, 548],
  underbrace: [["leftbraceunder", "midbraceunder", "rightbraceunder"], 1.6, 548],
  underleftrightarrow: [["leftarrow", "rightarrow"], 0.888, 522],
  xleftrightarrow: [["leftarrow", "rightarrow"], 1.75, 522],
  xLeftrightarrow: [["doubleleftarrow", "doublerightarrow"], 1.75, 560],
  xrightleftharpoons: [["leftharpoondownplus", "rightharpoonplus"], 1.75, 716],
  xleftrightharpoons: [["leftharpoonplus", "rightharpoondownplus"], 1.75, 716],
  xhookleftarrow: [["leftarrow", "righthook"], 1.08, 522],
  xhookrightarrow: [["lefthook", "rightarrow"], 1.08, 522],
  overlinesegment: [["leftlinesegment", "rightlinesegment"], 0.888, 522],
  underlinesegment: [["leftlinesegment", "rightlinesegment"], 0.888, 522],
  overbracket: [["leftbracketover", "rightbracketover"], 1.6, 440],
  underbracket: [["leftbracketunder", "rightbracketunder"], 1.6, 410],
  overgroup: [["leftgroup", "rightgroup"], 0.888, 342],
  undergroup: [["leftgroupunder", "rightgroupunder"], 0.888, 342],
  xmapsto: [["leftmapsto", "rightarrow"], 1.5, 522],
  xtofrom: [["leftToFrom", "rightToFrom"], 1.75, 528],
  // The next three arrows are from the mhchem package.
  // In mhchem.sty, min-length is 2.0em. But these arrows might appear in the
  // document as \xrightarrow or \xrightleftharpoons. Those have
  // min-length = 1.75em, so we set min-length on these next three to match.
  xrightleftarrows: [["baraboveleftarrow", "rightarrowabovebar"], 1.75, 901],
  xrightequilibrium: [["baraboveshortleftharpoon", "rightharpoonaboveshortbar"], 1.75, 716],
  xleftequilibrium: [["shortbaraboveleftharpoon", "shortrightharpoonabovebar"], 1.75, 716]
};
var wideAccentLabels = /* @__PURE__ */ new Set(["widehat", "widecheck", "widetilde", "utilde"]);
var stretchySvg = function stretchySvg2(group, options) {
  function buildSvgSpan_() {
    var viewBoxWidth = 4e5;
    var label = group.label.slice(1);
    if (wideAccentLabels.has(label) && "base" in group) {
      var numChars = group.base.type === "ordgroup" ? group.base.body.length : 1;
      var viewBoxHeight;
      var pathName;
      var _height;
      if (numChars > 5) {
        if (label === "widehat" || label === "widecheck") {
          viewBoxHeight = 420;
          viewBoxWidth = 2364;
          _height = 0.42;
          pathName = label + "4";
        } else {
          viewBoxHeight = 312;
          viewBoxWidth = 2340;
          _height = 0.34;
          pathName = "tilde4";
        }
      } else {
        var imgIndex = [1, 1, 2, 2, 3, 3][numChars];
        if (label === "widehat" || label === "widecheck") {
          viewBoxWidth = [0, 1062, 2364, 2364, 2364][imgIndex];
          viewBoxHeight = [0, 239, 300, 360, 420][imgIndex];
          _height = [0, 0.24, 0.3, 0.3, 0.36, 0.42][imgIndex];
          pathName = label + imgIndex;
        } else {
          viewBoxWidth = [0, 600, 1033, 2339, 2340][imgIndex];
          viewBoxHeight = [0, 260, 286, 306, 312][imgIndex];
          _height = [0, 0.26, 0.286, 0.3, 0.306, 0.34][imgIndex];
          pathName = "tilde" + imgIndex;
        }
      }
      var path7 = new PathNode(pathName);
      var svgNode = new SvgNode([path7], {
        "width": "100%",
        "height": makeEm(_height),
        "viewBox": "0 0 " + viewBoxWidth + " " + viewBoxHeight,
        "preserveAspectRatio": "none"
      });
      return {
        span: makeSvgSpan([], [svgNode], options),
        minWidth: 0,
        height: _height
      };
    } else {
      var spans = [];
      var data = katexImagesData[label];
      if (!data) {
        throw new Error('No SVG data for "' + label + '".');
      }
      var [paths, _minWidth, _viewBoxHeight] = data;
      var _height2 = _viewBoxHeight / 1e3;
      var numSvgChildren = paths.length;
      var widthClasses;
      var aligns;
      if (numSvgChildren === 1) {
        if (data.length !== 4) {
          throw new Error('Expected 4-tuple for single-path SVG data "' + label + '".');
        }
        widthClasses = ["hide-tail"];
        aligns = [data[3]];
      } else if (numSvgChildren === 2) {
        widthClasses = ["halfarrow-left", "halfarrow-right"];
        aligns = ["xMinYMin", "xMaxYMin"];
      } else if (numSvgChildren === 3) {
        widthClasses = ["brace-left", "brace-center", "brace-right"];
        aligns = ["xMinYMin", "xMidYMin", "xMaxYMin"];
      } else {
        throw new Error("Correct katexImagesData or update code here to support\n                    " + numSvgChildren + " children.");
      }
      for (var i4 = 0; i4 < numSvgChildren; i4++) {
        var _path = new PathNode(paths[i4]);
        var _svgNode = new SvgNode([_path], {
          "width": "400em",
          "height": makeEm(_height2),
          "viewBox": "0 0 " + viewBoxWidth + " " + _viewBoxHeight,
          "preserveAspectRatio": aligns[i4] + " slice"
        });
        var _span = makeSvgSpan([widthClasses[i4]], [_svgNode], options);
        if (numSvgChildren === 1) {
          return {
            span: _span,
            minWidth: _minWidth,
            height: _height2
          };
        } else {
          _span.style.height = makeEm(_height2);
          spans.push(_span);
        }
      }
      return {
        span: makeSpan(["stretchy"], spans, options),
        minWidth: _minWidth,
        height: _height2
      };
    }
  }
  var {
    span,
    minWidth,
    height
  } = buildSvgSpan_();
  span.height = height;
  span.style.height = makeEm(height);
  if (minWidth > 0) {
    span.style.minWidth = makeEm(minWidth);
  }
  return span;
};
var stretchyEnclose = function stretchyEnclose2(inner2, label, topPad, bottomPad, options) {
  var img;
  var totalHeight = inner2.height + inner2.depth + topPad + bottomPad;
  if (/fbox|color|angl/.test(label)) {
    img = makeSpan(["stretchy", label], [], options);
    if (label === "fbox") {
      var color = options.color && options.getColor();
      if (color) {
        img.style.borderColor = color;
      }
    }
  } else {
    var lines = [];
    if (/^[bx]cancel$/.test(label)) {
      lines.push(new LineNode({
        "x1": "0",
        "y1": "0",
        "x2": "100%",
        "y2": "100%",
        "stroke-width": "0.046em"
      }));
    }
    if (/^x?cancel$/.test(label)) {
      lines.push(new LineNode({
        "x1": "0",
        "y1": "100%",
        "x2": "100%",
        "y2": "0",
        "stroke-width": "0.046em"
      }));
    }
    var svgNode = new SvgNode(lines, {
      "width": "100%",
      "height": makeEm(totalHeight)
    });
    img = makeSvgSpan([], [svgNode], options);
  }
  img.height = totalHeight;
  img.style.height = makeEm(totalHeight);
  return img;
};
var ATOMS = {
  "bin": 1,
  "close": 1,
  "inner": 1,
  "open": 1,
  "punct": 1,
  "rel": 1
};
var NON_ATOMS = {
  "accent-token": 1,
  "mathord": 1,
  "op-token": 1,
  "spacing": 1,
  "textord": 1
};
function isAtom(value) {
  return value in ATOMS;
}
function assertNodeType(node, type) {
  if (!node || node.type !== type) {
    throw new Error("Expected node of type " + type + ", but got " + (node ? "node of type " + node.type : String(node)));
  }
  return node;
}
function assertSymbolNodeType(node) {
  var typedNode = checkSymbolNodeType(node);
  if (!typedNode) {
    throw new Error("Expected node of symbol group type, but got " + (node ? "node of type " + node.type : String(node)));
  }
  return typedNode;
}
function checkSymbolNodeType(node) {
  if (node && (node.type === "atom" || NON_ATOMS.hasOwnProperty(node.type))) {
    return node;
  }
  return null;
}
var getBaseSymbol = (group) => {
  if (group instanceof SymbolNode) {
    return group;
  }
  if (hasHtmlDomChildren(group) && group.children.length === 1) {
    return getBaseSymbol(group.children[0]);
  }
};
var htmlBuilder$a = (grp, options) => {
  var base;
  var group;
  var supSubGroup;
  if (grp && grp.type === "supsub") {
    group = assertNodeType(grp.base, "accent");
    base = group.base;
    grp.base = base;
    supSubGroup = assertSpan(buildGroup$1(grp, options));
    grp.base = group;
  } else {
    group = assertNodeType(grp, "accent");
    base = group.base;
  }
  var body = buildGroup$1(base, options.havingCrampedStyle());
  var mustShift = group.isShifty && isCharacterBox(base);
  var skew = 0;
  if (mustShift) {
    var _getBaseSymbol$skew, _getBaseSymbol;
    skew = (_getBaseSymbol$skew = (_getBaseSymbol = getBaseSymbol(body)) == null ? void 0 : _getBaseSymbol.skew) != null ? _getBaseSymbol$skew : 0;
  }
  var accentBelow = group.label === "\\c";
  var clearance = accentBelow ? body.height + body.depth : Math.min(body.height, options.fontMetrics().xHeight);
  var accentBody;
  if (!group.isStretchy) {
    var accent2;
    var width;
    if (group.label === "\\vec") {
      accent2 = staticSvg("vec", options);
      width = svgData.vec[1];
    } else {
      accent2 = makeOrd({
        type: "textord",
        mode: group.mode,
        text: group.label
      }, options, "textord");
      accent2 = assertSymbolDomNode(accent2);
      accent2.italic = 0;
      width = accent2.width;
      if (accentBelow) {
        clearance += accent2.depth;
      }
    }
    accentBody = makeSpan(["accent-body"], [accent2]);
    var accentFull = group.label === "\\textcircled";
    if (accentFull) {
      accentBody.classes.push("accent-full");
      clearance = body.height;
    }
    var left = skew;
    if (!accentFull) {
      left -= width / 2;
    }
    accentBody.style.left = makeEm(left);
    if (group.label === "\\textcircled") {
      accentBody.style.top = ".2em";
    }
    accentBody = makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: body
      }, {
        type: "kern",
        size: -clearance
      }, {
        type: "elem",
        elem: accentBody
      }]
    });
  } else {
    accentBody = stretchySvg(group, options);
    accentBody = makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: body
      }, {
        type: "elem",
        elem: accentBody,
        wrapperClasses: ["svg-align"],
        wrapperStyle: skew > 0 ? {
          width: "calc(100% - " + makeEm(2 * skew) + ")",
          marginLeft: makeEm(2 * skew)
        } : void 0
      }]
    });
  }
  var accentWrap = makeSpan(["mord", "accent"], [accentBody], options);
  if (supSubGroup) {
    supSubGroup.children[0] = accentWrap;
    supSubGroup.height = Math.max(accentWrap.height, supSubGroup.height);
    supSubGroup.classes[0] = "mord";
    return supSubGroup;
  } else {
    return accentWrap;
  }
};
var mathmlBuilder$9 = (group, options) => {
  var accentNode = group.isStretchy ? stretchyMathML(group.label) : new MathNode("mo", [makeText(group.label, group.mode)]);
  var node = new MathNode("mover", [buildGroup2(group.base, options), accentNode]);
  node.setAttribute("accent", "true");
  return node;
};
var NON_STRETCHY_ACCENT_REGEX = new RegExp(["\\acute", "\\grave", "\\ddot", "\\tilde", "\\bar", "\\breve", "\\check", "\\hat", "\\vec", "\\dot", "\\mathring"].map((accent2) => "\\" + accent2).join("|"));
defineFunction({
  type: "accent",
  names: ["\\acute", "\\grave", "\\ddot", "\\tilde", "\\bar", "\\breve", "\\check", "\\hat", "\\vec", "\\dot", "\\mathring", "\\widecheck", "\\widehat", "\\widetilde", "\\overrightarrow", "\\overleftarrow", "\\Overrightarrow", "\\overleftrightarrow", "\\overgroup", "\\overlinesegment", "\\overleftharpoon", "\\overrightharpoon"],
  props: {
    numArgs: 1
  },
  handler: (context, args) => {
    var base = normalizeArgument(args[0]);
    var isStretchy = !NON_STRETCHY_ACCENT_REGEX.test(context.funcName);
    var isShifty = !isStretchy || context.funcName === "\\widehat" || context.funcName === "\\widetilde" || context.funcName === "\\widecheck";
    return {
      type: "accent",
      mode: context.parser.mode,
      label: context.funcName,
      isStretchy,
      isShifty,
      base
    };
  },
  htmlBuilder: htmlBuilder$a,
  mathmlBuilder: mathmlBuilder$9
});
defineFunction({
  type: "accent",
  names: ["\\'", "\\`", "\\^", "\\~", "\\=", "\\u", "\\.", '\\"', "\\c", "\\r", "\\H", "\\v", "\\textcircled"],
  props: {
    numArgs: 1,
    allowedInText: true,
    allowedInMath: true,
    // unless in strict mode
    argTypes: ["primitive"]
  },
  handler: (context, args) => {
    var base = args[0];
    var mode = context.parser.mode;
    if (mode === "math") {
      context.parser.settings.reportNonstrict("mathVsTextAccents", "LaTeX's accent " + context.funcName + " works only in text mode");
      mode = "text";
    }
    return {
      type: "accent",
      mode,
      label: context.funcName,
      isStretchy: false,
      isShifty: true,
      base
    };
  },
  htmlBuilder: htmlBuilder$a,
  mathmlBuilder: mathmlBuilder$9
});
defineFunction({
  type: "accentUnder",
  names: ["\\underleftarrow", "\\underrightarrow", "\\underleftrightarrow", "\\undergroup", "\\underlinesegment", "\\utilde"],
  props: {
    numArgs: 1
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var base = args[0];
    return {
      type: "accentUnder",
      mode: parser.mode,
      label: funcName,
      base
    };
  },
  htmlBuilder: (group, options) => {
    var innerGroup = buildGroup$1(group.base, options);
    var accentBody = stretchySvg(group, options);
    var kern = group.label === "\\utilde" ? 0.12 : 0;
    var vlist = makeVList({
      positionType: "top",
      positionData: innerGroup.height,
      children: [{
        type: "elem",
        elem: accentBody,
        wrapperClasses: ["svg-align"]
      }, {
        type: "kern",
        size: kern
      }, {
        type: "elem",
        elem: innerGroup
      }]
    });
    return makeSpan(["mord", "accentunder"], [vlist], options);
  },
  mathmlBuilder: (group, options) => {
    var accentNode = stretchyMathML(group.label);
    var node = new MathNode("munder", [buildGroup2(group.base, options), accentNode]);
    node.setAttribute("accentunder", "true");
    return node;
  }
});
var paddedNode = (group) => {
  var node = new MathNode("mpadded", group ? [group] : []);
  node.setAttribute("width", "+0.6em");
  node.setAttribute("lspace", "0.3em");
  return node;
};
defineFunction({
  type: "xArrow",
  names: [
    "\\xleftarrow",
    "\\xrightarrow",
    "\\xLeftarrow",
    "\\xRightarrow",
    "\\xleftrightarrow",
    "\\xLeftrightarrow",
    "\\xhookleftarrow",
    "\\xhookrightarrow",
    "\\xmapsto",
    "\\xrightharpoondown",
    "\\xrightharpoonup",
    "\\xleftharpoondown",
    "\\xleftharpoonup",
    "\\xrightleftharpoons",
    "\\xleftrightharpoons",
    "\\xlongequal",
    "\\xtwoheadrightarrow",
    "\\xtwoheadleftarrow",
    "\\xtofrom",
    // The next 3 functions are here to support the mhchem extension.
    // Direct use of these functions is discouraged and may break someday.
    "\\xrightleftarrows",
    "\\xrightequilibrium",
    "\\xleftequilibrium",
    // The next 3 functions are here only to support the {CD} environment.
    "\\\\cdrightarrow",
    "\\\\cdleftarrow",
    "\\\\cdlongequal"
  ],
  props: {
    numArgs: 1,
    numOptionalArgs: 1
  },
  handler(_ref, args, optArgs) {
    var {
      parser,
      funcName
    } = _ref;
    return {
      type: "xArrow",
      mode: parser.mode,
      label: funcName,
      body: args[0],
      below: optArgs[0]
    };
  },
  htmlBuilder(group, options) {
    var style = options.style;
    var newOptions = options.havingStyle(style.sup());
    var upperGroup = wrapFragment(buildGroup$1(group.body, newOptions, options), options);
    var arrowPrefix = group.label.slice(0, 2) === "\\x" ? "x" : "cd";
    upperGroup.classes.push(arrowPrefix + "-arrow-pad");
    var lowerGroup;
    if (group.below) {
      newOptions = options.havingStyle(style.sub());
      lowerGroup = wrapFragment(buildGroup$1(group.below, newOptions, options), options);
      lowerGroup.classes.push(arrowPrefix + "-arrow-pad");
    }
    var arrowBody = stretchySvg(group, options);
    var arrowShift = -options.fontMetrics().axisHeight + 0.5 * arrowBody.height;
    var upperShift = -options.fontMetrics().axisHeight - 0.5 * arrowBody.height - 0.111;
    if (upperGroup.depth > 0.25 || group.label === "\\xleftequilibrium") {
      upperShift -= upperGroup.depth;
    }
    var vlist;
    if (lowerGroup) {
      var lowerShift = -options.fontMetrics().axisHeight + lowerGroup.height + 0.5 * arrowBody.height + 0.111;
      vlist = makeVList({
        positionType: "individualShift",
        children: [{
          type: "elem",
          elem: upperGroup,
          shift: upperShift
        }, {
          type: "elem",
          elem: arrowBody,
          shift: arrowShift,
          wrapperClasses: ["svg-align"]
        }, {
          type: "elem",
          elem: lowerGroup,
          shift: lowerShift
        }]
      });
    } else {
      vlist = makeVList({
        positionType: "individualShift",
        children: [{
          type: "elem",
          elem: upperGroup,
          shift: upperShift
        }, {
          type: "elem",
          elem: arrowBody,
          shift: arrowShift,
          wrapperClasses: ["svg-align"]
        }]
      });
    }
    return makeSpan(["mrel", "x-arrow"], [vlist], options);
  },
  mathmlBuilder(group, options) {
    var arrowNode = stretchyMathML(group.label);
    arrowNode.setAttribute("minsize", group.label.charAt(0) === "x" ? "1.75em" : "3.0em");
    var node;
    if (group.body) {
      var upperNode = paddedNode(buildGroup2(group.body, options));
      if (group.below) {
        var lowerNode = paddedNode(buildGroup2(group.below, options));
        node = new MathNode("munderover", [arrowNode, lowerNode, upperNode]);
      } else {
        node = new MathNode("mover", [arrowNode, upperNode]);
      }
    } else if (group.below) {
      var _lowerNode = paddedNode(buildGroup2(group.below, options));
      node = new MathNode("munder", [arrowNode, _lowerNode]);
    } else {
      node = paddedNode();
      node = new MathNode("mover", [arrowNode, node]);
    }
    return node;
  }
});
function htmlBuilder$9(group, options) {
  var elements = buildExpression$1(group.body, options, true);
  return makeSpan([group.mclass], elements, options);
}
function mathmlBuilder$8(group, options) {
  var node;
  var inner2 = buildExpression2(group.body, options);
  if (group.mclass === "minner") {
    node = new MathNode("mpadded", inner2);
  } else if (group.mclass === "mord") {
    if (group.isCharacterBox) {
      node = inner2[0];
      node.type = "mi";
    } else {
      node = new MathNode("mi", inner2);
    }
  } else {
    if (group.isCharacterBox) {
      node = inner2[0];
      node.type = "mo";
    } else {
      node = new MathNode("mo", inner2);
    }
    if (group.mclass === "mbin") {
      node.attributes.lspace = "0.22em";
      node.attributes.rspace = "0.22em";
    } else if (group.mclass === "mpunct") {
      node.attributes.lspace = "0em";
      node.attributes.rspace = "0.17em";
    } else if (group.mclass === "mopen" || group.mclass === "mclose") {
      node.attributes.lspace = "0em";
      node.attributes.rspace = "0em";
    } else if (group.mclass === "minner") {
      node.attributes.lspace = "0.0556em";
      node.attributes.width = "+0.1111em";
    }
  }
  return node;
}
defineFunction({
  type: "mclass",
  names: ["\\mathord", "\\mathbin", "\\mathrel", "\\mathopen", "\\mathclose", "\\mathpunct", "\\mathinner"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    var body = args[0];
    return {
      type: "mclass",
      mode: parser.mode,
      mclass: "m" + funcName.slice(5),
      // TODO(kevinb): don't prefix with 'm'
      body: ordargument(body),
      isCharacterBox: isCharacterBox(body)
    };
  },
  htmlBuilder: htmlBuilder$9,
  mathmlBuilder: mathmlBuilder$8
});
var binrelClass = (arg) => {
  var atom = arg.type === "ordgroup" && arg.body.length ? arg.body[0] : arg;
  if (atom.type === "atom" && (atom.family === "bin" || atom.family === "rel")) {
    return "m" + atom.family;
  } else {
    return "mord";
  }
};
defineFunction({
  type: "mclass",
  names: ["\\@binrel"],
  props: {
    numArgs: 2
  },
  handler(_ref2, args) {
    var {
      parser
    } = _ref2;
    return {
      type: "mclass",
      mode: parser.mode,
      mclass: binrelClass(args[0]),
      body: ordargument(args[1]),
      isCharacterBox: isCharacterBox(args[1])
    };
  }
});
defineFunction({
  type: "mclass",
  names: ["\\stackrel", "\\overset", "\\underset"],
  props: {
    numArgs: 2
  },
  handler(_ref3, args) {
    var {
      parser,
      funcName
    } = _ref3;
    var baseArg = args[1];
    var shiftedArg = args[0];
    var mclass;
    if (funcName !== "\\stackrel") {
      mclass = binrelClass(baseArg);
    } else {
      mclass = "mrel";
    }
    var baseOp = {
      type: "op",
      mode: baseArg.mode,
      limits: true,
      alwaysHandleSupSub: true,
      parentIsSupSub: false,
      symbol: false,
      suppressBaseShift: funcName !== "\\stackrel",
      body: ordargument(baseArg)
    };
    var supsub = {
      type: "supsub",
      mode: shiftedArg.mode,
      base: baseOp,
      sup: funcName === "\\underset" ? null : shiftedArg,
      sub: funcName === "\\underset" ? shiftedArg : null
    };
    return {
      type: "mclass",
      mode: parser.mode,
      mclass,
      body: [supsub],
      isCharacterBox: isCharacterBox(supsub)
    };
  },
  htmlBuilder: htmlBuilder$9,
  mathmlBuilder: mathmlBuilder$8
});
defineFunction({
  type: "pmb",
  names: ["\\pmb"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    return {
      type: "pmb",
      mode: parser.mode,
      mclass: binrelClass(args[0]),
      body: ordargument(args[0])
    };
  },
  htmlBuilder(group, options) {
    var elements = buildExpression$1(group.body, options, true);
    var node = makeSpan([group.mclass], elements, options);
    node.style.textShadow = "0.02em 0.01em 0.04px";
    return node;
  },
  mathmlBuilder(group, style) {
    var inner2 = buildExpression2(group.body, style);
    var node = new MathNode("mstyle", inner2);
    node.setAttribute("style", "text-shadow: 0.02em 0.01em 0.04px");
    return node;
  }
});
var cdArrowFunctionName = {
  ">": "\\\\cdrightarrow",
  "<": "\\\\cdleftarrow",
  "=": "\\\\cdlongequal",
  "A": "\\uparrow",
  "V": "\\downarrow",
  "|": "\\Vert",
  ".": "no arrow"
};
var newCell = () => {
  return {
    type: "styling",
    body: [],
    mode: "math",
    style: "display",
    resetFont: true
  };
};
var isStartOfArrow = (node) => {
  return node.type === "textord" && node.text === "@";
};
var isLabelEnd = (node, endChar) => {
  return (node.type === "mathord" || node.type === "atom") && node.text === endChar;
};
function cdArrow(arrowChar, labels, parser) {
  var funcName = cdArrowFunctionName[arrowChar];
  switch (funcName) {
    case "\\\\cdrightarrow":
    case "\\\\cdleftarrow":
      return parser.callFunction(funcName, [labels[0]], [labels[1]]);
    case "\\uparrow":
    case "\\downarrow": {
      var leftLabel = parser.callFunction("\\\\cdleft", [labels[0]], []);
      var bareArrow = {
        type: "atom",
        text: funcName,
        mode: "math",
        family: "rel"
      };
      var sizedArrow = parser.callFunction("\\Big", [bareArrow], []);
      var rightLabel = parser.callFunction("\\\\cdright", [labels[1]], []);
      var arrowGroup = {
        type: "ordgroup",
        mode: "math",
        body: [leftLabel, sizedArrow, rightLabel]
      };
      return parser.callFunction("\\\\cdparent", [arrowGroup], []);
    }
    case "\\\\cdlongequal":
      return parser.callFunction("\\\\cdlongequal", [], []);
    case "\\Vert": {
      var arrow = {
        type: "textord",
        text: "\\Vert",
        mode: "math"
      };
      return parser.callFunction("\\Big", [arrow], []);
    }
    default:
      return {
        type: "textord",
        text: " ",
        mode: "math"
      };
  }
}
function parseCD(parser) {
  var parsedRows = [];
  parser.gullet.beginGroup();
  parser.gullet.macros.set("\\cr", "\\\\\\relax");
  parser.gullet.beginGroup();
  while (true) {
    parsedRows.push(parser.parseExpression(false, "\\\\"));
    parser.gullet.endGroup();
    parser.gullet.beginGroup();
    var next = parser.fetch().text;
    if (next === "&" || next === "\\\\") {
      parser.consume();
    } else if (next === "\\end") {
      if (parsedRows[parsedRows.length - 1].length === 0) {
        parsedRows.pop();
      }
      break;
    } else {
      throw new ParseError("Expected \\\\ or \\cr or \\end", parser.nextToken);
    }
  }
  var row = [];
  var body = [row];
  for (var i4 = 0; i4 < parsedRows.length; i4++) {
    var rowNodes = parsedRows[i4];
    var cell = newCell();
    for (var j = 0; j < rowNodes.length; j++) {
      if (!isStartOfArrow(rowNodes[j])) {
        cell.body.push(rowNodes[j]);
      } else {
        row.push(cell);
        j += 1;
        var arrowChar = assertSymbolNodeType(rowNodes[j]).text;
        var labels = new Array(2);
        labels[0] = {
          type: "ordgroup",
          mode: "math",
          body: []
        };
        labels[1] = {
          type: "ordgroup",
          mode: "math",
          body: []
        };
        if ("=|.".includes(arrowChar)) ;
        else if ("<>AV".includes(arrowChar)) {
          for (var labelNum = 0; labelNum < 2; labelNum++) {
            var inLabel = true;
            for (var k = j + 1; k < rowNodes.length; k++) {
              if (isLabelEnd(rowNodes[k], arrowChar)) {
                inLabel = false;
                j = k;
                break;
              }
              if (isStartOfArrow(rowNodes[k])) {
                throw new ParseError("Missing a " + arrowChar + " character to complete a CD arrow.", rowNodes[k]);
              }
              labels[labelNum].body.push(rowNodes[k]);
            }
            if (inLabel) {
              throw new ParseError("Missing a " + arrowChar + " character to complete a CD arrow.", rowNodes[j]);
            }
          }
        } else {
          throw new ParseError('Expected one of "<>AV=|." after @', rowNodes[j]);
        }
        var arrow = cdArrow(arrowChar, labels, parser);
        var wrappedArrow = {
          type: "styling",
          body: [arrow],
          mode: "math",
          style: "display",
          // CD is always displaystyle.
          resetFont: true
        };
        row.push(wrappedArrow);
        cell = newCell();
      }
    }
    if (i4 % 2 === 0) {
      row.push(cell);
    } else {
      row.shift();
    }
    row = [];
    body.push(row);
  }
  parser.gullet.endGroup();
  parser.gullet.endGroup();
  var cols = new Array(body[0].length).fill({
    type: "align",
    align: "c",
    pregap: 0.25,
    // CD package sets \enskip between columns.
    postgap: 0.25
    // So pre and post each get half an \enskip, i.e. 0.25em.
  });
  return {
    type: "array",
    mode: "math",
    body,
    arraystretch: 1,
    addJot: true,
    rowGaps: [null],
    cols,
    colSeparationType: "CD",
    hLinesBeforeRow: new Array(body.length + 1).fill([])
  };
}
defineFunction({
  type: "cdlabel",
  names: ["\\\\cdleft", "\\\\cdright"],
  props: {
    numArgs: 1
  },
  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    return {
      type: "cdlabel",
      mode: parser.mode,
      side: funcName.slice(4),
      label: args[0]
    };
  },
  htmlBuilder(group, options) {
    var newOptions = options.havingStyle(options.style.sup());
    var label = wrapFragment(buildGroup$1(group.label, newOptions, options), options);
    label.classes.push("cd-label-" + group.side);
    label.style.bottom = makeEm(0.8 - label.depth);
    label.height = 0;
    label.depth = 0;
    return label;
  },
  mathmlBuilder(group, options) {
    var label = new MathNode("mrow", [buildGroup2(group.label, options)]);
    label = new MathNode("mpadded", [label]);
    label.setAttribute("width", "0");
    if (group.side === "left") {
      label.setAttribute("lspace", "-1width");
    }
    label.setAttribute("voffset", "0.7em");
    label = new MathNode("mstyle", [label]);
    label.setAttribute("displaystyle", "false");
    label.setAttribute("scriptlevel", "1");
    return label;
  }
});
defineFunction({
  type: "cdlabelparent",
  names: ["\\\\cdparent"],
  props: {
    numArgs: 1
  },
  handler(_ref2, args) {
    var {
      parser
    } = _ref2;
    return {
      type: "cdlabelparent",
      mode: parser.mode,
      fragment: args[0]
    };
  },
  htmlBuilder(group, options) {
    var parent = wrapFragment(buildGroup$1(group.fragment, options), options);
    parent.classes.push("cd-vert-arrow");
    return parent;
  },
  mathmlBuilder(group, options) {
    return new MathNode("mrow", [buildGroup2(group.fragment, options)]);
  }
});
defineFunction({
  type: "textord",
  names: ["\\@char"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    var arg = assertNodeType(args[0], "ordgroup");
    var group = arg.body;
    var number = "";
    for (var i4 = 0; i4 < group.length; i4++) {
      var node = assertNodeType(group[i4], "textord");
      number += node.text;
    }
    var code = parseInt(number);
    var text2;
    if (isNaN(code)) {
      throw new ParseError("\\@char has non-numeric argument " + number);
    } else if (code < 0 || code >= 1114111) {
      throw new ParseError("\\@char with invalid code point " + number);
    } else if (code <= 65535) {
      text2 = String.fromCharCode(code);
    } else {
      code -= 65536;
      text2 = String.fromCharCode((code >> 10) + 55296, (code & 1023) + 56320);
    }
    return {
      type: "textord",
      mode: parser.mode,
      text: text2
    };
  }
});
var htmlBuilder$8 = (group, options) => {
  var elements = buildExpression$1(group.body, options.withColor(group.color), false);
  return makeFragment(elements);
};
var mathmlBuilder$7 = (group, options) => {
  var inner2 = buildExpression2(group.body, options.withColor(group.color));
  var node = new MathNode("mstyle", inner2);
  node.setAttribute("mathcolor", group.color);
  return node;
};
defineFunction({
  type: "color",
  names: ["\\textcolor"],
  props: {
    numArgs: 2,
    allowedInText: true,
    argTypes: ["color", "original"]
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    var color = assertNodeType(args[0], "color-token").color;
    var body = args[1];
    return {
      type: "color",
      mode: parser.mode,
      color,
      body: ordargument(body)
    };
  },
  htmlBuilder: htmlBuilder$8,
  mathmlBuilder: mathmlBuilder$7
});
defineFunction({
  type: "color",
  names: ["\\color"],
  props: {
    numArgs: 1,
    allowedInText: true,
    argTypes: ["color"]
  },
  handler(_ref2, args) {
    var {
      parser,
      breakOnTokenText
    } = _ref2;
    var color = assertNodeType(args[0], "color-token").color;
    parser.gullet.macros.set("\\current@color", color);
    var body = parser.parseExpression(true, breakOnTokenText);
    return {
      type: "color",
      mode: parser.mode,
      color,
      body
    };
  },
  htmlBuilder: htmlBuilder$8,
  mathmlBuilder: mathmlBuilder$7
});
defineFunction({
  type: "cr",
  names: ["\\\\"],
  props: {
    numArgs: 0,
    numOptionalArgs: 0,
    allowedInText: true
  },
  handler(_ref, args, optArgs) {
    var {
      parser
    } = _ref;
    var size = parser.gullet.future().text === "[" ? parser.parseSizeGroup(true) : null;
    var newLine = !parser.settings.displayMode || !parser.settings.useStrictBehavior("newLineInDisplayMode", "In LaTeX, \\\\ or \\newline does nothing in display mode");
    return {
      type: "cr",
      mode: parser.mode,
      newLine,
      size: size && assertNodeType(size, "size").value
    };
  },
  // The following builders are called only at the top level,
  // not within tabular/array environments.
  htmlBuilder(group, options) {
    var span = makeSpan(["mspace"], [], options);
    if (group.newLine) {
      span.classes.push("newline");
      if (group.size) {
        span.style.marginTop = makeEm(calculateSize(group.size, options));
      }
    }
    return span;
  },
  mathmlBuilder(group, options) {
    var node = new MathNode("mspace");
    if (group.newLine) {
      node.setAttribute("linebreak", "newline");
      if (group.size) {
        node.setAttribute("height", makeEm(calculateSize(group.size, options)));
      }
    }
    return node;
  }
});
var globalMap = {
  "\\global": "\\global",
  "\\long": "\\\\globallong",
  "\\\\globallong": "\\\\globallong",
  "\\def": "\\gdef",
  "\\gdef": "\\gdef",
  "\\edef": "\\xdef",
  "\\xdef": "\\xdef",
  "\\let": "\\\\globallet",
  "\\futurelet": "\\\\globalfuture"
};
var checkControlSequence = (tok) => {
  var name2 = tok.text;
  if (/^(?:[\\{}$&#^_]|EOF)$/.test(name2)) {
    throw new ParseError("Expected a control sequence", tok);
  }
  return name2;
};
var getRHS = (parser) => {
  var tok = parser.gullet.popToken();
  if (tok.text === "=") {
    tok = parser.gullet.popToken();
    if (tok.text === " ") {
      tok = parser.gullet.popToken();
    }
  }
  return tok;
};
var letCommand = (parser, name2, tok, global) => {
  var macro = parser.gullet.macros.get(tok.text);
  if (macro == null) {
    tok.noexpand = true;
    macro = {
      tokens: [tok],
      numArgs: 0,
      // reproduce the same behavior in expansion
      unexpandable: !parser.gullet.isExpandable(tok.text)
    };
  }
  parser.gullet.macros.set(name2, macro, global);
};
defineFunction({
  type: "internal",
  names: [
    "\\global",
    "\\long",
    "\\\\globallong"
    // can’t be entered directly
  ],
  props: {
    numArgs: 0,
    allowedInText: true
  },
  handler(_ref) {
    var {
      parser,
      funcName
    } = _ref;
    parser.consumeSpaces();
    var token = parser.fetch();
    if (globalMap[token.text]) {
      if (funcName === "\\global" || funcName === "\\\\globallong") {
        token.text = globalMap[token.text];
      }
      return assertNodeType(parser.parseFunction(), "internal");
    }
    throw new ParseError("Invalid token after macro prefix", token);
  }
});
defineFunction({
  type: "internal",
  names: ["\\def", "\\gdef", "\\edef", "\\xdef"],
  props: {
    numArgs: 0,
    allowedInText: true,
    primitive: true
  },
  handler(_ref2) {
    var {
      parser,
      funcName
    } = _ref2;
    var tok = parser.gullet.popToken();
    var name2 = tok.text;
    if (/^(?:[\\{}$&#^_]|EOF)$/.test(name2)) {
      throw new ParseError("Expected a control sequence", tok);
    }
    var numArgs = 0;
    var insert;
    var delimiters2 = [[]];
    while (parser.gullet.future().text !== "{") {
      tok = parser.gullet.popToken();
      if (tok.text === "#") {
        if (parser.gullet.future().text === "{") {
          insert = parser.gullet.future();
          delimiters2[numArgs].push("{");
          break;
        }
        tok = parser.gullet.popToken();
        if (!/^[1-9]$/.test(tok.text)) {
          throw new ParseError('Invalid argument number "' + tok.text + '"');
        }
        if (parseInt(tok.text) !== numArgs + 1) {
          throw new ParseError('Argument number "' + tok.text + '" out of order');
        }
        numArgs++;
        delimiters2.push([]);
      } else if (tok.text === "EOF") {
        throw new ParseError("Expected a macro definition");
      } else {
        delimiters2[numArgs].push(tok.text);
      }
    }
    var {
      tokens
    } = parser.gullet.consumeArg();
    if (insert) {
      tokens.unshift(insert);
    }
    if (funcName === "\\edef" || funcName === "\\xdef") {
      tokens = parser.gullet.expandTokens(tokens);
      tokens.reverse();
    }
    parser.gullet.macros.set(name2, {
      tokens,
      numArgs,
      delimiters: delimiters2
    }, funcName === globalMap[funcName]);
    return {
      type: "internal",
      mode: parser.mode
    };
  }
});
defineFunction({
  type: "internal",
  names: [
    "\\let",
    "\\\\globallet"
    // can’t be entered directly
  ],
  props: {
    numArgs: 0,
    allowedInText: true,
    primitive: true
  },
  handler(_ref3) {
    var {
      parser,
      funcName
    } = _ref3;
    var name2 = checkControlSequence(parser.gullet.popToken());
    parser.gullet.consumeSpaces();
    var tok = getRHS(parser);
    letCommand(parser, name2, tok, funcName === "\\\\globallet");
    return {
      type: "internal",
      mode: parser.mode
    };
  }
});
defineFunction({
  type: "internal",
  names: [
    "\\futurelet",
    "\\\\globalfuture"
    // can’t be entered directly
  ],
  props: {
    numArgs: 0,
    allowedInText: true,
    primitive: true
  },
  handler(_ref4) {
    var {
      parser,
      funcName
    } = _ref4;
    var name2 = checkControlSequence(parser.gullet.popToken());
    var middle = parser.gullet.popToken();
    var tok = parser.gullet.popToken();
    letCommand(parser, name2, tok, funcName === "\\\\globalfuture");
    parser.gullet.pushToken(tok);
    parser.gullet.pushToken(middle);
    return {
      type: "internal",
      mode: parser.mode
    };
  }
});
var getMetrics = function getMetrics2(symbol, font, mode) {
  var replace = symbols2.math[symbol] && symbols2.math[symbol].replace;
  var metrics = getCharacterMetrics(replace || symbol, font, mode);
  if (!metrics) {
    throw new Error("Unsupported symbol " + symbol + " and font size " + font + ".");
  }
  return metrics;
};
var styleWrap = function styleWrap2(delim, toStyle, options, classes) {
  var newOptions = options.havingBaseStyle(toStyle);
  var span = makeSpan(classes.concat(newOptions.sizingClasses(options)), [delim], options);
  var delimSizeMultiplier = newOptions.sizeMultiplier / options.sizeMultiplier;
  span.height *= delimSizeMultiplier;
  span.depth *= delimSizeMultiplier;
  span.maxFontSize = newOptions.sizeMultiplier;
  return span;
};
var centerSpan = function centerSpan2(span, options, style) {
  var newOptions = options.havingBaseStyle(style);
  var shift = (1 - options.sizeMultiplier / newOptions.sizeMultiplier) * options.fontMetrics().axisHeight;
  span.classes.push("delimcenter");
  span.style.top = makeEm(shift);
  span.height -= shift;
  span.depth += shift;
};
var makeSmallDelim = function makeSmallDelim2(delim, style, center, options, mode, classes) {
  var text2 = makeSymbol(delim, "Main-Regular", mode, options);
  var span = styleWrap(text2, style, options, classes);
  if (center) {
    centerSpan(span, options, style);
  }
  return span;
};
var mathrmSize = function mathrmSize2(value, size, mode, options) {
  return makeSymbol(value, "Size" + size + "-Regular", mode, options);
};
var makeLargeDelim = function makeLargeDelim2(delim, size, center, options, mode, classes) {
  var inner2 = mathrmSize(delim, size, mode, options);
  var span = styleWrap(makeSpan(["delimsizing", "size" + size], [inner2], options), Style$1.TEXT, options, classes);
  if (center) {
    centerSpan(span, options, Style$1.TEXT);
  }
  return span;
};
var makeGlyphSpan = function makeGlyphSpan2(symbol, font, mode) {
  var sizeClass;
  if (font === "Size1-Regular") {
    sizeClass = "delim-size1";
  } else {
    sizeClass = "delim-size4";
  }
  var corner = makeSpan(["delimsizinginner", sizeClass], [makeSpan([], [makeSymbol(symbol, font, mode)])]);
  return {
    type: "elem",
    elem: corner
  };
};
var makeInner = function makeInner2(ch2, height, options) {
  var width = fontMetricsData["Size4-Regular"][ch2.charCodeAt(0)] ? fontMetricsData["Size4-Regular"][ch2.charCodeAt(0)][4] : fontMetricsData["Size1-Regular"][ch2.charCodeAt(0)][4];
  var path7 = new PathNode("inner", innerPath(ch2, Math.round(1e3 * height)));
  var svgNode = new SvgNode([path7], {
    "width": makeEm(width),
    "height": makeEm(height),
    // Override CSS rule `.katex svg { width: 100% }`
    "style": "width:" + makeEm(width),
    "viewBox": "0 0 " + 1e3 * width + " " + Math.round(1e3 * height),
    "preserveAspectRatio": "xMinYMin"
  });
  var span = makeSvgSpan([], [svgNode], options);
  span.height = height;
  span.style.height = makeEm(height);
  span.style.width = makeEm(width);
  return {
    type: "elem",
    elem: span
  };
};
var lapInEms = 8e-3;
var lap = {
  type: "kern",
  size: -1 * lapInEms
};
var verts = /* @__PURE__ */ new Set(["|", "\\lvert", "\\rvert", "\\vert"]);
var doubleVerts = /* @__PURE__ */ new Set(["\\|", "\\lVert", "\\rVert", "\\Vert"]);
var makeStackedDelim = function makeStackedDelim2(delim, heightTotal, center, options, mode, classes) {
  var top;
  var middle;
  var repeat;
  var bottom;
  var svgLabel = "";
  var viewBoxWidth = 0;
  top = repeat = bottom = delim;
  middle = null;
  var font = "Size1-Regular";
  if (delim === "\\uparrow") {
    repeat = bottom = "\u23D0";
  } else if (delim === "\\Uparrow") {
    repeat = bottom = "\u2016";
  } else if (delim === "\\downarrow") {
    top = repeat = "\u23D0";
  } else if (delim === "\\Downarrow") {
    top = repeat = "\u2016";
  } else if (delim === "\\updownarrow") {
    top = "\\uparrow";
    repeat = "\u23D0";
    bottom = "\\downarrow";
  } else if (delim === "\\Updownarrow") {
    top = "\\Uparrow";
    repeat = "\u2016";
    bottom = "\\Downarrow";
  } else if (verts.has(delim)) {
    repeat = "\u2223";
    svgLabel = "vert";
    viewBoxWidth = 333;
  } else if (doubleVerts.has(delim)) {
    repeat = "\u2225";
    svgLabel = "doublevert";
    viewBoxWidth = 556;
  } else if (delim === "[" || delim === "\\lbrack") {
    top = "\u23A1";
    repeat = "\u23A2";
    bottom = "\u23A3";
    font = "Size4-Regular";
    svgLabel = "lbrack";
    viewBoxWidth = 667;
  } else if (delim === "]" || delim === "\\rbrack") {
    top = "\u23A4";
    repeat = "\u23A5";
    bottom = "\u23A6";
    font = "Size4-Regular";
    svgLabel = "rbrack";
    viewBoxWidth = 667;
  } else if (delim === "\\lfloor" || delim === "\u230A") {
    repeat = top = "\u23A2";
    bottom = "\u23A3";
    font = "Size4-Regular";
    svgLabel = "lfloor";
    viewBoxWidth = 667;
  } else if (delim === "\\lceil" || delim === "\u2308") {
    top = "\u23A1";
    repeat = bottom = "\u23A2";
    font = "Size4-Regular";
    svgLabel = "lceil";
    viewBoxWidth = 667;
  } else if (delim === "\\rfloor" || delim === "\u230B") {
    repeat = top = "\u23A5";
    bottom = "\u23A6";
    font = "Size4-Regular";
    svgLabel = "rfloor";
    viewBoxWidth = 667;
  } else if (delim === "\\rceil" || delim === "\u2309") {
    top = "\u23A4";
    repeat = bottom = "\u23A5";
    font = "Size4-Regular";
    svgLabel = "rceil";
    viewBoxWidth = 667;
  } else if (delim === "(" || delim === "\\lparen") {
    top = "\u239B";
    repeat = "\u239C";
    bottom = "\u239D";
    font = "Size4-Regular";
    svgLabel = "lparen";
    viewBoxWidth = 875;
  } else if (delim === ")" || delim === "\\rparen") {
    top = "\u239E";
    repeat = "\u239F";
    bottom = "\u23A0";
    font = "Size4-Regular";
    svgLabel = "rparen";
    viewBoxWidth = 875;
  } else if (delim === "\\{" || delim === "\\lbrace") {
    top = "\u23A7";
    middle = "\u23A8";
    bottom = "\u23A9";
    repeat = "\u23AA";
    font = "Size4-Regular";
  } else if (delim === "\\}" || delim === "\\rbrace") {
    top = "\u23AB";
    middle = "\u23AC";
    bottom = "\u23AD";
    repeat = "\u23AA";
    font = "Size4-Regular";
  } else if (delim === "\\lgroup" || delim === "\u27EE") {
    top = "\u23A7";
    bottom = "\u23A9";
    repeat = "\u23AA";
    font = "Size4-Regular";
  } else if (delim === "\\rgroup" || delim === "\u27EF") {
    top = "\u23AB";
    bottom = "\u23AD";
    repeat = "\u23AA";
    font = "Size4-Regular";
  } else if (delim === "\\lmoustache" || delim === "\u23B0") {
    top = "\u23A7";
    bottom = "\u23AD";
    repeat = "\u23AA";
    font = "Size4-Regular";
  } else if (delim === "\\rmoustache" || delim === "\u23B1") {
    top = "\u23AB";
    bottom = "\u23A9";
    repeat = "\u23AA";
    font = "Size4-Regular";
  }
  var topMetrics = getMetrics(top, font, mode);
  var topHeightTotal = topMetrics.height + topMetrics.depth;
  var repeatMetrics = getMetrics(repeat, font, mode);
  var repeatHeightTotal = repeatMetrics.height + repeatMetrics.depth;
  var bottomMetrics = getMetrics(bottom, font, mode);
  var bottomHeightTotal = bottomMetrics.height + bottomMetrics.depth;
  var middleHeightTotal = 0;
  var middleFactor = 1;
  if (middle !== null) {
    var middleMetrics = getMetrics(middle, font, mode);
    middleHeightTotal = middleMetrics.height + middleMetrics.depth;
    middleFactor = 2;
  }
  var minHeight = topHeightTotal + bottomHeightTotal + middleHeightTotal;
  var repeatCount = Math.max(0, Math.ceil((heightTotal - minHeight) / (middleFactor * repeatHeightTotal)));
  var realHeightTotal = minHeight + repeatCount * middleFactor * repeatHeightTotal;
  var axisHeight = options.fontMetrics().axisHeight;
  if (center) {
    axisHeight *= options.sizeMultiplier;
  }
  var depth = realHeightTotal / 2 - axisHeight;
  var stack = [];
  if (svgLabel.length > 0) {
    var midHeight = realHeightTotal - topHeightTotal - bottomHeightTotal;
    var viewBoxHeight = Math.round(realHeightTotal * 1e3);
    var pathStr = tallDelim(svgLabel, Math.round(midHeight * 1e3));
    var path7 = new PathNode(svgLabel, pathStr);
    var width = makeEm(viewBoxWidth / 1e3);
    var height = makeEm(viewBoxHeight / 1e3);
    var svg = new SvgNode([path7], {
      "width": width,
      "height": height,
      "viewBox": "0 0 " + viewBoxWidth + " " + viewBoxHeight
    });
    var wrapper = makeSvgSpan([], [svg], options);
    wrapper.height = viewBoxHeight / 1e3;
    wrapper.style.width = width;
    wrapper.style.height = height;
    stack.push({
      type: "elem",
      elem: wrapper
    });
  } else {
    stack.push(makeGlyphSpan(bottom, font, mode));
    stack.push(lap);
    if (middle === null) {
      var innerHeight = realHeightTotal - topHeightTotal - bottomHeightTotal + 2 * lapInEms;
      stack.push(makeInner(repeat, innerHeight, options));
    } else {
      var _innerHeight = (realHeightTotal - topHeightTotal - bottomHeightTotal - middleHeightTotal) / 2 + 2 * lapInEms;
      stack.push(makeInner(repeat, _innerHeight, options));
      stack.push(lap);
      stack.push(makeGlyphSpan(middle, font, mode));
      stack.push(lap);
      stack.push(makeInner(repeat, _innerHeight, options));
    }
    stack.push(lap);
    stack.push(makeGlyphSpan(top, font, mode));
  }
  var newOptions = options.havingBaseStyle(Style$1.TEXT);
  var inner2 = makeVList({
    positionType: "bottom",
    positionData: depth,
    children: stack
  });
  return styleWrap(makeSpan(["delimsizing", "mult"], [inner2], newOptions), Style$1.TEXT, options, classes);
};
var vbPad = 80;
var emPad = 0.08;
var sqrtSvg = function sqrtSvg2(sqrtName, height, viewBoxHeight, extraVinculum, options) {
  var path7 = sqrtPath(sqrtName, extraVinculum, viewBoxHeight);
  var pathNode = new PathNode(sqrtName, path7);
  var svg = new SvgNode([pathNode], {
    // Note: 1000:1 ratio of viewBox to document em width.
    "width": "400em",
    "height": makeEm(height),
    "viewBox": "0 0 400000 " + viewBoxHeight,
    "preserveAspectRatio": "xMinYMin slice"
  });
  return makeSvgSpan(["hide-tail"], [svg], options);
};
var makeSqrtImage = function makeSqrtImage2(height, options) {
  var newOptions = options.havingBaseSizing();
  var delim = traverseSequence("\\surd", height * newOptions.sizeMultiplier, stackLargeDelimiterSequence, newOptions);
  var sizeMultiplier = newOptions.sizeMultiplier;
  var extraVinculum = Math.max(0, options.minRuleThickness - options.fontMetrics().sqrtRuleThickness);
  var span;
  var spanHeight;
  var texHeight;
  var viewBoxHeight;
  var advanceWidth;
  if (delim.type === "small") {
    viewBoxHeight = 1e3 + 1e3 * extraVinculum + vbPad;
    if (height < 1) {
      sizeMultiplier = 1;
    } else if (height < 1.4) {
      sizeMultiplier = 0.7;
    }
    spanHeight = (1 + extraVinculum + emPad) / sizeMultiplier;
    texHeight = (1 + extraVinculum) / sizeMultiplier;
    span = sqrtSvg("sqrtMain", spanHeight, viewBoxHeight, extraVinculum, options);
    span.style.minWidth = "0.853em";
    advanceWidth = 0.833 / sizeMultiplier;
  } else if (delim.type === "large") {
    viewBoxHeight = (1e3 + vbPad) * sizeToMaxHeight[delim.size];
    texHeight = (sizeToMaxHeight[delim.size] + extraVinculum) / sizeMultiplier;
    spanHeight = (sizeToMaxHeight[delim.size] + extraVinculum + emPad) / sizeMultiplier;
    span = sqrtSvg("sqrtSize" + delim.size, spanHeight, viewBoxHeight, extraVinculum, options);
    span.style.minWidth = "1.02em";
    advanceWidth = 1 / sizeMultiplier;
  } else {
    spanHeight = height + extraVinculum + emPad;
    texHeight = height + extraVinculum;
    viewBoxHeight = Math.floor(1e3 * height + extraVinculum) + vbPad;
    span = sqrtSvg("sqrtTall", spanHeight, viewBoxHeight, extraVinculum, options);
    span.style.minWidth = "0.742em";
    advanceWidth = 1.056;
  }
  span.height = texHeight;
  span.style.height = makeEm(spanHeight);
  return {
    span,
    advanceWidth,
    // Calculate the actual line width.
    // This actually should depend on the chosen font -- e.g. \boldmath
    // should use the thicker surd symbols from e.g. KaTeX_Main-Bold, and
    // have thicker rules.
    ruleWidth: (options.fontMetrics().sqrtRuleThickness + extraVinculum) * sizeMultiplier
  };
};
var stackLargeDelimiters = /* @__PURE__ */ new Set(["(", "\\lparen", ")", "\\rparen", "[", "\\lbrack", "]", "\\rbrack", "\\{", "\\lbrace", "\\}", "\\rbrace", "\\lfloor", "\\rfloor", "\u230A", "\u230B", "\\lceil", "\\rceil", "\u2308", "\u2309", "\\surd"]);
var stackAlwaysDelimiters = /* @__PURE__ */ new Set(["\\uparrow", "\\downarrow", "\\updownarrow", "\\Uparrow", "\\Downarrow", "\\Updownarrow", "|", "\\|", "\\vert", "\\Vert", "\\lvert", "\\rvert", "\\lVert", "\\rVert", "\\lgroup", "\\rgroup", "\u27EE", "\u27EF", "\\lmoustache", "\\rmoustache", "\u23B0", "\u23B1"]);
var stackNeverDelimiters = /* @__PURE__ */ new Set(["<", ">", "\\langle", "\\rangle", "/", "\\backslash", "\\lt", "\\gt"]);
var sizeToMaxHeight = [0, 1.2, 1.8, 2.4, 3];
var makeSizedDelim = function makeSizedDelim2(delim, size, options, mode, classes) {
  if (delim === "<" || delim === "\\lt" || delim === "\u27E8") {
    delim = "\\langle";
  } else if (delim === ">" || delim === "\\gt" || delim === "\u27E9") {
    delim = "\\rangle";
  }
  if (stackLargeDelimiters.has(delim) || stackNeverDelimiters.has(delim)) {
    return makeLargeDelim(delim, size, false, options, mode, classes);
  } else if (stackAlwaysDelimiters.has(delim)) {
    return makeStackedDelim(delim, sizeToMaxHeight[size], false, options, mode, classes);
  } else {
    throw new ParseError("Illegal delimiter: '" + delim + "'");
  }
};
var stackNeverDelimiterSequence = [{
  type: "small",
  style: Style$1.SCRIPTSCRIPT
}, {
  type: "small",
  style: Style$1.SCRIPT
}, {
  type: "small",
  style: Style$1.TEXT
}, {
  type: "large",
  size: 1
}, {
  type: "large",
  size: 2
}, {
  type: "large",
  size: 3
}, {
  type: "large",
  size: 4
}];
var stackAlwaysDelimiterSequence = [{
  type: "small",
  style: Style$1.SCRIPTSCRIPT
}, {
  type: "small",
  style: Style$1.SCRIPT
}, {
  type: "small",
  style: Style$1.TEXT
}, {
  type: "stack"
}];
var stackLargeDelimiterSequence = [{
  type: "small",
  style: Style$1.SCRIPTSCRIPT
}, {
  type: "small",
  style: Style$1.SCRIPT
}, {
  type: "small",
  style: Style$1.TEXT
}, {
  type: "large",
  size: 1
}, {
  type: "large",
  size: 2
}, {
  type: "large",
  size: 3
}, {
  type: "large",
  size: 4
}, {
  type: "stack"
}];
var delimTypeToFont = function delimTypeToFont2(type) {
  if (type.type === "small") {
    return "Main-Regular";
  } else if (type.type === "large") {
    return "Size" + type.size + "-Regular";
  } else if (type.type === "stack") {
    return "Size4-Regular";
  } else {
    var delimKind = type.type;
    throw new Error("Add support for delim type '" + delimKind + "' here.");
  }
};
var traverseSequence = function traverseSequence2(delim, height, sequence, options) {
  var start = Math.min(2, 3 - options.style.size);
  for (var i4 = start; i4 < sequence.length; i4++) {
    var delimType = sequence[i4];
    if (delimType.type === "stack") {
      break;
    }
    var metrics = getMetrics(delim, delimTypeToFont(delimType), "math");
    var heightDepth = metrics.height + metrics.depth;
    if (delimType.type === "small") {
      var newOptions = options.havingBaseStyle(delimType.style);
      heightDepth *= newOptions.sizeMultiplier;
    }
    if (heightDepth > height) {
      return delimType;
    }
  }
  return sequence[sequence.length - 1];
};
var makeCustomSizedDelim = function makeCustomSizedDelim2(delim, height, center, options, mode, classes) {
  if (delim === "<" || delim === "\\lt" || delim === "\u27E8") {
    delim = "\\langle";
  } else if (delim === ">" || delim === "\\gt" || delim === "\u27E9") {
    delim = "\\rangle";
  }
  var sequence;
  if (stackNeverDelimiters.has(delim)) {
    sequence = stackNeverDelimiterSequence;
  } else if (stackLargeDelimiters.has(delim)) {
    sequence = stackLargeDelimiterSequence;
  } else {
    sequence = stackAlwaysDelimiterSequence;
  }
  var delimType = traverseSequence(delim, height, sequence, options);
  if (delimType.type === "small") {
    return makeSmallDelim(delim, delimType.style, center, options, mode, classes);
  } else if (delimType.type === "large") {
    return makeLargeDelim(delim, delimType.size, center, options, mode, classes);
  } else {
    return makeStackedDelim(delim, height, center, options, mode, classes);
  }
};
var makeLeftRightDelim = function makeLeftRightDelim2(delim, height, depth, options, mode, classes) {
  var axisHeight = options.fontMetrics().axisHeight * options.sizeMultiplier;
  var delimiterFactor = 901;
  var delimiterExtend = 5 / options.fontMetrics().ptPerEm;
  var maxDistFromAxis = Math.max(height - axisHeight, depth + axisHeight);
  var totalHeight = Math.max(
    // In real TeX, calculations are done using integral values which are
    // 65536 per pt, or 655360 per em. So, the division here truncates in
    // TeX but doesn't here, producing different results. If we wanted to
    // exactly match TeX's calculation, we could do
    //   Math.floor(655360 * maxDistFromAxis / 500) *
    //    delimiterFactor / 655360
    // (To see the difference, compare
    //    x^{x^{\left(\rule{0.1em}{0.68em}\right)}}
    // in TeX and KaTeX)
    maxDistFromAxis / 500 * delimiterFactor,
    2 * maxDistFromAxis - delimiterExtend
  );
  return makeCustomSizedDelim(delim, totalHeight, true, options, mode, classes);
};
var delimiterSizes = {
  "\\bigl": {
    mclass: "mopen",
    size: 1
  },
  "\\Bigl": {
    mclass: "mopen",
    size: 2
  },
  "\\biggl": {
    mclass: "mopen",
    size: 3
  },
  "\\Biggl": {
    mclass: "mopen",
    size: 4
  },
  "\\bigr": {
    mclass: "mclose",
    size: 1
  },
  "\\Bigr": {
    mclass: "mclose",
    size: 2
  },
  "\\biggr": {
    mclass: "mclose",
    size: 3
  },
  "\\Biggr": {
    mclass: "mclose",
    size: 4
  },
  "\\bigm": {
    mclass: "mrel",
    size: 1
  },
  "\\Bigm": {
    mclass: "mrel",
    size: 2
  },
  "\\biggm": {
    mclass: "mrel",
    size: 3
  },
  "\\Biggm": {
    mclass: "mrel",
    size: 4
  },
  "\\big": {
    mclass: "mord",
    size: 1
  },
  "\\Big": {
    mclass: "mord",
    size: 2
  },
  "\\bigg": {
    mclass: "mord",
    size: 3
  },
  "\\Bigg": {
    mclass: "mord",
    size: 4
  }
};
var delimiters = /* @__PURE__ */ new Set(["(", "\\lparen", ")", "\\rparen", "[", "\\lbrack", "]", "\\rbrack", "\\{", "\\lbrace", "\\}", "\\rbrace", "\\lfloor", "\\rfloor", "\u230A", "\u230B", "\\lceil", "\\rceil", "\u2308", "\u2309", "<", ">", "\\langle", "\u27E8", "\\rangle", "\u27E9", "\\lt", "\\gt", "\\lvert", "\\rvert", "\\lVert", "\\rVert", "\\lgroup", "\\rgroup", "\u27EE", "\u27EF", "\\lmoustache", "\\rmoustache", "\u23B0", "\u23B1", "/", "\\backslash", "|", "\\vert", "\\|", "\\Vert", "\\uparrow", "\\Uparrow", "\\downarrow", "\\Downarrow", "\\updownarrow", "\\Updownarrow", "."]);
function isMiddleDelimNode(node) {
  return "isMiddle" in node;
}
function checkDelimiter(delim, context) {
  var symDelim = checkSymbolNodeType(delim);
  if (symDelim && delimiters.has(symDelim.text)) {
    return symDelim;
  } else if (symDelim) {
    throw new ParseError("Invalid delimiter '" + symDelim.text + "' after '" + context.funcName + "'", delim);
  } else {
    throw new ParseError("Invalid delimiter type '" + delim.type + "'", delim);
  }
}
defineFunction({
  type: "delimsizing",
  names: ["\\bigl", "\\Bigl", "\\biggl", "\\Biggl", "\\bigr", "\\Bigr", "\\biggr", "\\Biggr", "\\bigm", "\\Bigm", "\\biggm", "\\Biggm", "\\big", "\\Big", "\\bigg", "\\Bigg"],
  props: {
    numArgs: 1,
    argTypes: ["primitive"]
  },
  handler: (context, args) => {
    var delim = checkDelimiter(args[0], context);
    return {
      type: "delimsizing",
      mode: context.parser.mode,
      size: delimiterSizes[context.funcName].size,
      mclass: delimiterSizes[context.funcName].mclass,
      delim: delim.text
    };
  },
  htmlBuilder: (group, options) => {
    if (group.delim === ".") {
      return makeSpan([group.mclass]);
    }
    return makeSizedDelim(group.delim, group.size, options, group.mode, [group.mclass]);
  },
  mathmlBuilder: (group) => {
    var children = [];
    if (group.delim !== ".") {
      children.push(makeText(group.delim, group.mode));
    }
    var node = new MathNode("mo", children);
    if (group.mclass === "mopen" || group.mclass === "mclose") {
      node.setAttribute("fence", "true");
    } else {
      node.setAttribute("fence", "false");
    }
    node.setAttribute("stretchy", "true");
    var size = makeEm(sizeToMaxHeight[group.size]);
    node.setAttribute("minsize", size);
    node.setAttribute("maxsize", size);
    return node;
  }
});
function assertParsed(group) {
  if (!group.body) {
    throw new Error("Bug: The leftright ParseNode wasn't fully parsed.");
  }
}
defineFunction({
  type: "leftright-right",
  names: ["\\right"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler: (context, args) => {
    var color = context.parser.gullet.macros.get("\\current@color");
    if (color && typeof color !== "string") {
      throw new ParseError("\\current@color set to non-string in \\right");
    }
    return {
      type: "leftright-right",
      mode: context.parser.mode,
      delim: checkDelimiter(args[0], context).text,
      color
      // undefined if not set via \color
    };
  }
});
defineFunction({
  type: "leftright",
  names: ["\\left"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler: (context, args) => {
    var delim = checkDelimiter(args[0], context);
    var parser = context.parser;
    ++parser.leftrightDepth;
    var body = parser.parseExpression(false);
    --parser.leftrightDepth;
    parser.expect("\\right", false);
    var right = assertNodeType(parser.parseFunction(), "leftright-right");
    return {
      type: "leftright",
      mode: parser.mode,
      body,
      left: delim.text,
      right: right.delim,
      rightColor: right.color
    };
  },
  htmlBuilder: (group, options) => {
    assertParsed(group);
    var inner2 = buildExpression$1(group.body, options, true, ["mopen", "mclose"]);
    var innerHeight = 0;
    var innerDepth = 0;
    var hadMiddle = false;
    for (var i4 = 0; i4 < inner2.length; i4++) {
      var node = inner2[i4];
      if (isMiddleDelimNode(node)) {
        hadMiddle = true;
      } else {
        innerHeight = Math.max(inner2[i4].height, innerHeight);
        innerDepth = Math.max(inner2[i4].depth, innerDepth);
      }
    }
    innerHeight *= options.sizeMultiplier;
    innerDepth *= options.sizeMultiplier;
    var leftDelim;
    if (group.left === ".") {
      leftDelim = makeNullDelimiter(options, ["mopen"]);
    } else {
      leftDelim = makeLeftRightDelim(group.left, innerHeight, innerDepth, options, group.mode, ["mopen"]);
    }
    inner2.unshift(leftDelim);
    if (hadMiddle) {
      for (var _i6 = 1; _i6 < inner2.length; _i6++) {
        var middleDelim = inner2[_i6];
        if (isMiddleDelimNode(middleDelim)) {
          var isMiddle = middleDelim.isMiddle;
          inner2[_i6] = makeLeftRightDelim(isMiddle.delim, innerHeight, innerDepth, isMiddle.options, group.mode, []);
        }
      }
    }
    var rightDelim;
    if (group.right === ".") {
      rightDelim = makeNullDelimiter(options, ["mclose"]);
    } else {
      var colorOptions = group.rightColor ? options.withColor(group.rightColor) : options;
      rightDelim = makeLeftRightDelim(group.right, innerHeight, innerDepth, colorOptions, group.mode, ["mclose"]);
    }
    inner2.push(rightDelim);
    return makeSpan(["minner"], inner2, options);
  },
  mathmlBuilder: (group, options) => {
    assertParsed(group);
    var inner2 = buildExpression2(group.body, options);
    if (group.left !== ".") {
      var leftNode = new MathNode("mo", [makeText(group.left, group.mode)]);
      leftNode.setAttribute("fence", "true");
      inner2.unshift(leftNode);
    }
    if (group.right !== ".") {
      var rightNode = new MathNode("mo", [makeText(group.right, group.mode)]);
      rightNode.setAttribute("fence", "true");
      if (group.rightColor) {
        rightNode.setAttribute("mathcolor", group.rightColor);
      }
      inner2.push(rightNode);
    }
    return makeRow(inner2);
  }
});
defineFunction({
  type: "middle",
  names: ["\\middle"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler: (context, args) => {
    var delim = checkDelimiter(args[0], context);
    if (!context.parser.leftrightDepth) {
      throw new ParseError("\\middle without preceding \\left", delim);
    }
    return {
      type: "middle",
      mode: context.parser.mode,
      delim: delim.text
    };
  },
  htmlBuilder: (group, options) => {
    var middleDelim;
    if (group.delim === ".") {
      middleDelim = makeNullDelimiter(options, []);
    } else {
      middleDelim = makeSizedDelim(group.delim, 1, options, group.mode, []);
      middleDelim.isMiddle = {
        delim: group.delim,
        options
      };
    }
    return middleDelim;
  },
  mathmlBuilder: (group, options) => {
    var textNode = group.delim === "\\vert" || group.delim === "|" ? makeText("|", "text") : makeText(group.delim, group.mode);
    var middleNode = new MathNode("mo", [textNode]);
    middleNode.setAttribute("fence", "true");
    middleNode.setAttribute("lspace", "0.05em");
    middleNode.setAttribute("rspace", "0.05em");
    return middleNode;
  }
});
var htmlBuilder$7 = (group, options) => {
  var inner2 = wrapFragment(buildGroup$1(group.body, options), options);
  var label = group.label.slice(1);
  var scale = options.sizeMultiplier;
  var img;
  var imgShift;
  var isSingleChar = isCharacterBox(group.body);
  if (label === "sout") {
    img = makeSpan(["stretchy", "sout"]);
    img.height = options.fontMetrics().defaultRuleThickness / scale;
    imgShift = -0.5 * options.fontMetrics().xHeight;
  } else if (label === "phase") {
    var lineWeight = calculateSize({
      number: 0.6,
      unit: "pt"
    }, options);
    var clearance = calculateSize({
      number: 0.35,
      unit: "ex"
    }, options);
    var newOptions = options.havingBaseSizing();
    scale = scale / newOptions.sizeMultiplier;
    var angleHeight = inner2.height + inner2.depth + lineWeight + clearance;
    inner2.style.paddingLeft = makeEm(angleHeight / 2 + lineWeight);
    var viewBoxHeight = Math.floor(1e3 * angleHeight * scale);
    var path7 = phasePath(viewBoxHeight);
    var svgNode = new SvgNode([new PathNode("phase", path7)], {
      "width": "400em",
      "height": makeEm(viewBoxHeight / 1e3),
      "viewBox": "0 0 400000 " + viewBoxHeight,
      "preserveAspectRatio": "xMinYMin slice"
    });
    img = makeSvgSpan(["hide-tail"], [svgNode], options);
    img.style.height = makeEm(angleHeight);
    imgShift = inner2.depth + lineWeight + clearance;
  } else {
    if (/cancel/.test(label)) {
      if (!isSingleChar) {
        inner2.classes.push("cancel-pad");
      }
    } else if (label === "angl") {
      inner2.classes.push("anglpad");
    } else {
      inner2.classes.push("boxpad");
    }
    var topPad;
    var bottomPad;
    var ruleThickness = 0;
    if (/box/.test(label)) {
      ruleThickness = Math.max(
        options.fontMetrics().fboxrule,
        // default
        options.minRuleThickness
      );
      topPad = options.fontMetrics().fboxsep + (label === "colorbox" ? 0 : ruleThickness);
      bottomPad = topPad;
    } else if (label === "angl") {
      ruleThickness = Math.max(options.fontMetrics().defaultRuleThickness, options.minRuleThickness);
      topPad = 4 * ruleThickness;
      bottomPad = Math.max(0, 0.25 - inner2.depth);
    } else {
      topPad = isSingleChar ? 0.2 : 0;
      bottomPad = topPad;
    }
    img = stretchyEnclose(inner2, label, topPad, bottomPad, options);
    if (/fbox|boxed|fcolorbox/.test(label)) {
      img.style.borderStyle = "solid";
      img.style.borderWidth = makeEm(ruleThickness);
    } else if (label === "angl" && ruleThickness !== 0.049) {
      img.style.borderTopWidth = makeEm(ruleThickness);
      img.style.borderRightWidth = makeEm(ruleThickness);
    }
    imgShift = inner2.depth + bottomPad;
    if (group.backgroundColor) {
      img.style.backgroundColor = group.backgroundColor;
      if (group.borderColor) {
        img.style.borderColor = group.borderColor;
      }
    }
  }
  var vlist;
  if (group.backgroundColor) {
    vlist = makeVList({
      positionType: "individualShift",
      children: [
        // Put the color background behind inner;
        {
          type: "elem",
          elem: img,
          shift: imgShift
        },
        {
          type: "elem",
          elem: inner2,
          shift: 0
        }
      ]
    });
  } else {
    var classes = /cancel|phase/.test(label) ? ["svg-align"] : [];
    vlist = makeVList({
      positionType: "individualShift",
      children: [
        // Write the \cancel stroke on top of inner.
        {
          type: "elem",
          elem: inner2,
          shift: 0
        },
        {
          type: "elem",
          elem: img,
          shift: imgShift,
          wrapperClasses: classes
        }
      ]
    });
  }
  if (/cancel/.test(label)) {
    vlist.height = inner2.height;
    vlist.depth = inner2.depth;
  }
  if (/cancel/.test(label) && !isSingleChar) {
    return makeSpan(["mord", "cancel-lap"], [vlist], options);
  } else {
    return makeSpan(["mord"], [vlist], options);
  }
};
var mathmlBuilder$6 = (group, options) => {
  var fboxsep;
  var node = new MathNode(group.label.includes("colorbox") ? "mpadded" : "menclose", [buildGroup2(group.body, options)]);
  switch (group.label) {
    case "\\cancel":
      node.setAttribute("notation", "updiagonalstrike");
      break;
    case "\\bcancel":
      node.setAttribute("notation", "downdiagonalstrike");
      break;
    case "\\phase":
      node.setAttribute("notation", "phasorangle");
      break;
    case "\\sout":
      node.setAttribute("notation", "horizontalstrike");
      break;
    case "\\fbox":
      node.setAttribute("notation", "box");
      break;
    case "\\angl":
      node.setAttribute("notation", "actuarial");
      break;
    case "\\fcolorbox":
    case "\\colorbox":
      fboxsep = options.fontMetrics().fboxsep * options.fontMetrics().ptPerEm;
      node.setAttribute("width", "+" + 2 * fboxsep + "pt");
      node.setAttribute("height", "+" + 2 * fboxsep + "pt");
      node.setAttribute("lspace", fboxsep + "pt");
      node.setAttribute("voffset", fboxsep + "pt");
      if (group.label === "\\fcolorbox") {
        var thk = Math.max(
          options.fontMetrics().fboxrule,
          // default
          options.minRuleThickness
        );
        node.setAttribute("style", "border: " + makeEm(thk) + " solid " + group.borderColor);
      }
      break;
    case "\\xcancel":
      node.setAttribute("notation", "updiagonalstrike downdiagonalstrike");
      break;
  }
  if (group.backgroundColor) {
    node.setAttribute("mathbackground", group.backgroundColor);
  }
  return node;
};
defineFunction({
  type: "enclose",
  names: ["\\colorbox"],
  props: {
    numArgs: 2,
    allowedInText: true,
    argTypes: ["color", "hbox"]
  },
  handler(_ref, args, optArgs) {
    var {
      parser,
      funcName
    } = _ref;
    var color = assertNodeType(args[0], "color-token").color;
    var body = args[1];
    return {
      type: "enclose",
      mode: parser.mode,
      label: funcName,
      backgroundColor: color,
      body
    };
  },
  htmlBuilder: htmlBuilder$7,
  mathmlBuilder: mathmlBuilder$6
});
defineFunction({
  type: "enclose",
  names: ["\\fcolorbox"],
  props: {
    numArgs: 3,
    allowedInText: true,
    argTypes: ["color", "color", "hbox"]
  },
  handler(_ref2, args, optArgs) {
    var {
      parser,
      funcName
    } = _ref2;
    var borderColor = assertNodeType(args[0], "color-token").color;
    var backgroundColor = assertNodeType(args[1], "color-token").color;
    var body = args[2];
    return {
      type: "enclose",
      mode: parser.mode,
      label: funcName,
      backgroundColor,
      borderColor,
      body
    };
  },
  htmlBuilder: htmlBuilder$7,
  mathmlBuilder: mathmlBuilder$6
});
defineFunction({
  type: "enclose",
  names: ["\\fbox"],
  props: {
    numArgs: 1,
    argTypes: ["hbox"],
    allowedInText: true
  },
  handler(_ref3, args) {
    var {
      parser
    } = _ref3;
    return {
      type: "enclose",
      mode: parser.mode,
      label: "\\fbox",
      body: args[0]
    };
  }
});
defineFunction({
  type: "enclose",
  names: ["\\cancel", "\\bcancel", "\\xcancel", "\\phase"],
  props: {
    numArgs: 1
  },
  handler(_ref4, args) {
    var {
      parser,
      funcName
    } = _ref4;
    var body = args[0];
    return {
      type: "enclose",
      mode: parser.mode,
      label: funcName,
      body
    };
  },
  htmlBuilder: htmlBuilder$7,
  mathmlBuilder: mathmlBuilder$6
});
defineFunction({
  type: "enclose",
  names: ["\\sout"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler(_ref5, args) {
    var {
      parser,
      funcName
    } = _ref5;
    if (parser.mode === "math") {
      parser.settings.reportNonstrict("mathVsSout", "LaTeX's \\sout works only in text mode");
    }
    var body = args[0];
    return {
      type: "enclose",
      mode: parser.mode,
      label: funcName,
      body
    };
  },
  htmlBuilder: htmlBuilder$7,
  mathmlBuilder: mathmlBuilder$6
});
defineFunction({
  type: "enclose",
  names: ["\\angl"],
  props: {
    numArgs: 1,
    argTypes: ["hbox"],
    allowedInText: false
  },
  handler(_ref6, args) {
    var {
      parser
    } = _ref6;
    return {
      type: "enclose",
      mode: parser.mode,
      label: "\\angl",
      body: args[0]
    };
  }
});
var _environments = {};
function defineEnvironment(_ref) {
  var {
    type,
    names,
    props,
    handler,
    htmlBuilder: htmlBuilder3,
    mathmlBuilder: mathmlBuilder3
  } = _ref;
  var data = {
    type,
    numArgs: props.numArgs || 0,
    allowedInText: false,
    numOptionalArgs: 0,
    handler
  };
  for (var i4 = 0; i4 < names.length; ++i4) {
    _environments[names[i4]] = data;
  }
  if (htmlBuilder3) {
    _htmlGroupBuilders[type] = htmlBuilder3;
  }
  if (mathmlBuilder3) {
    _mathmlGroupBuilders[type] = mathmlBuilder3;
  }
}
var _macros = {};
function defineMacro(name2, body) {
  _macros[name2] = body;
}
var SourceLocation = class _SourceLocation {
  // End offset, zero-based exclusive.
  constructor(lexer, start, end) {
    this.lexer = void 0;
    this.start = void 0;
    this.end = void 0;
    this.lexer = lexer;
    this.start = start;
    this.end = end;
  }
  /**
   * Merges two `SourceLocation`s from location providers, given they are
   * provided in order of appearance.
   * - Returns the first one's location if only the first is provided.
   * - Returns a merged range of the first and the last if both are provided
   *   and their lexers match.
   * - Otherwise, returns null.
   */
  static range(first, second) {
    if (!second) {
      return first && first.loc;
    } else if (!first || !first.loc || !second.loc || first.loc.lexer !== second.loc.lexer) {
      return null;
    } else {
      return new _SourceLocation(first.loc.lexer, first.loc.start, second.loc.end);
    }
  }
};
var Token = class _Token {
  // used in \noexpand
  constructor(text2, loc) {
    this.text = void 0;
    this.loc = void 0;
    this.noexpand = void 0;
    this.treatAsRelax = void 0;
    this.text = text2;
    this.loc = loc;
  }
  /**
   * Given a pair of tokens (this and endToken), compute a `Token` encompassing
   * the whole input range enclosed by these two.
   */
  range(endToken, text2) {
    return new _Token(text2, SourceLocation.range(this, endToken));
  }
};
function getHLines(parser) {
  var hlineInfo = [];
  parser.consumeSpaces();
  var nxt = parser.fetch().text;
  if (nxt === "\\relax") {
    parser.consume();
    parser.consumeSpaces();
    nxt = parser.fetch().text;
  }
  while (nxt === "\\hline" || nxt === "\\hdashline") {
    parser.consume();
    hlineInfo.push(nxt === "\\hdashline");
    parser.consumeSpaces();
    nxt = parser.fetch().text;
  }
  return hlineInfo;
}
var validateAmsEnvironmentContext = (context) => {
  var settings = context.parser.settings;
  if (!settings.displayMode) {
    throw new ParseError("{" + context.envName + "} can be used only in display mode.");
  }
};
var gatherEnvironments = /* @__PURE__ */ new Set(["gather", "gather*"]);
function getAutoTag(name2) {
  if (!name2.includes("ed")) {
    return !name2.includes("*");
  }
}
function parseArray(parser, _ref, style) {
  var {
    hskipBeforeAndAfter,
    addJot,
    cols,
    arraystretch,
    colSeparationType,
    autoTag,
    singleRow,
    emptySingleRow,
    maxNumCols,
    leqno
  } = _ref;
  parser.gullet.beginGroup();
  if (!singleRow) {
    parser.gullet.macros.set("\\cr", "\\\\\\relax");
  }
  if (!arraystretch) {
    var stretch = parser.gullet.expandMacroAsText("\\arraystretch");
    if (stretch == null) {
      arraystretch = 1;
    } else {
      arraystretch = parseFloat(stretch);
      if (!arraystretch || arraystretch < 0) {
        throw new ParseError("Invalid \\arraystretch: " + stretch);
      }
    }
  }
  parser.gullet.beginGroup();
  var row = [];
  var body = [row];
  var rowGaps = [];
  var hLinesBeforeRow = [];
  var tags = autoTag != null ? [] : void 0;
  function beginRow() {
    if (autoTag) {
      parser.gullet.macros.set("\\@eqnsw", "1", true);
    }
  }
  function endRow() {
    if (tags) {
      if (parser.gullet.macros.get("\\df@tag")) {
        tags.push(parser.subparse([new Token("\\df@tag")]));
        parser.gullet.macros.set("\\df@tag", void 0, true);
      } else {
        tags.push(Boolean(autoTag) && parser.gullet.macros.get("\\@eqnsw") === "1");
      }
    }
  }
  beginRow();
  hLinesBeforeRow.push(getHLines(parser));
  while (true) {
    var cellBody = parser.parseExpression(false, singleRow ? "\\end" : "\\\\");
    parser.gullet.endGroup();
    parser.gullet.beginGroup();
    var cell = {
      type: "ordgroup",
      mode: parser.mode,
      body: cellBody
    };
    if (style) {
      cell = {
        type: "styling",
        mode: parser.mode,
        style,
        resetFont: true,
        body: [cell]
      };
    }
    row.push(cell);
    var next = parser.fetch().text;
    if (next === "&") {
      if (maxNumCols && row.length === maxNumCols) {
        if (singleRow || colSeparationType) {
          throw new ParseError("Too many tab characters: &", parser.nextToken);
        } else {
          parser.settings.reportNonstrict("textEnv", "Too few columns specified in the {array} column argument.");
        }
      }
      parser.consume();
    } else if (next === "\\end") {
      endRow();
      if (row.length === 1 && cell.type === "styling" && cell.body.length === 1 && cell.body[0].type === "ordgroup" && cell.body[0].body.length === 0 && (body.length > 1 || !emptySingleRow)) {
        body.pop();
      }
      if (hLinesBeforeRow.length < body.length + 1) {
        hLinesBeforeRow.push([]);
      }
      break;
    } else if (next === "\\\\") {
      parser.consume();
      var size = void 0;
      if (parser.gullet.future().text !== " ") {
        size = parser.parseSizeGroup(true);
      }
      rowGaps.push(size ? size.value : null);
      endRow();
      hLinesBeforeRow.push(getHLines(parser));
      row = [];
      body.push(row);
      beginRow();
    } else {
      throw new ParseError("Expected & or \\\\ or \\cr or \\end", parser.nextToken);
    }
  }
  parser.gullet.endGroup();
  parser.gullet.endGroup();
  return {
    type: "array",
    mode: parser.mode,
    addJot,
    arraystretch,
    body,
    cols,
    rowGaps,
    hskipBeforeAndAfter,
    hLinesBeforeRow,
    colSeparationType,
    tags,
    leqno
  };
}
function dCellStyle(envName) {
  if (envName.slice(0, 1) === "d") {
    return "display";
  } else {
    return "text";
  }
}
var htmlBuilder$6 = function htmlBuilder(group, options) {
  var r3;
  var c3;
  var nr = group.body.length;
  var hLinesBeforeRow = group.hLinesBeforeRow;
  var nc = 0;
  var body = new Array(nr);
  var hlines = [];
  var ruleThickness = Math.max(
    // From LaTeX \showthe\arrayrulewidth. Equals 0.04 em.
    options.fontMetrics().arrayRuleWidth,
    options.minRuleThickness
  );
  var pt = 1 / options.fontMetrics().ptPerEm;
  var arraycolsep = 5 * pt;
  if (group.colSeparationType && group.colSeparationType === "small") {
    var localMultiplier = options.havingStyle(Style$1.SCRIPT).sizeMultiplier;
    arraycolsep = 0.2778 * (localMultiplier / options.sizeMultiplier);
  }
  var baselineskip = group.colSeparationType === "CD" ? calculateSize({
    number: 3,
    unit: "ex"
  }, options) : 12 * pt;
  var jot = 3 * pt;
  var arrayskip = group.arraystretch * baselineskip;
  var arstrutHeight = 0.7 * arrayskip;
  var arstrutDepth = 0.3 * arrayskip;
  var totalHeight = 0;
  function setHLinePos(hlinesInGap) {
    for (var i4 = 0; i4 < hlinesInGap.length; ++i4) {
      if (i4 > 0) {
        totalHeight += 0.25;
      }
      hlines.push({
        pos: totalHeight,
        isDashed: hlinesInGap[i4]
      });
    }
  }
  setHLinePos(hLinesBeforeRow[0]);
  for (r3 = 0; r3 < group.body.length; ++r3) {
    var inrow = group.body[r3];
    var height = arstrutHeight;
    var depth = arstrutDepth;
    if (nc < inrow.length) {
      nc = inrow.length;
    }
    var outrow = {
      cells: new Array(inrow.length),
      height: 0,
      depth: 0,
      pos: 0
    };
    for (c3 = 0; c3 < inrow.length; ++c3) {
      var elt = buildGroup$1(inrow[c3], options);
      if (depth < elt.depth) {
        depth = elt.depth;
      }
      if (height < elt.height) {
        height = elt.height;
      }
      outrow.cells[c3] = elt;
    }
    var rowGap = group.rowGaps[r3];
    var gap = 0;
    if (rowGap) {
      gap = calculateSize(rowGap, options);
      if (gap > 0) {
        gap += arstrutDepth;
        if (depth < gap) {
          depth = gap;
        }
        gap = 0;
      }
    }
    if (group.addJot && r3 < group.body.length - 1) {
      depth += jot;
    }
    outrow.height = height;
    outrow.depth = depth;
    totalHeight += height;
    outrow.pos = totalHeight;
    totalHeight += depth + gap;
    body[r3] = outrow;
    setHLinePos(hLinesBeforeRow[r3 + 1]);
  }
  var offset = totalHeight / 2 + options.fontMetrics().axisHeight;
  var colDescriptions = group.cols || [];
  var cols = [];
  var colSep;
  var colDescrNum;
  var tagSpans = [];
  if (group.tags && group.tags.some((tag2) => tag2)) {
    for (r3 = 0; r3 < nr; ++r3) {
      var rw = body[r3];
      var shift = rw.pos - offset;
      var tag = group.tags[r3];
      var tagSpan = void 0;
      if (tag === true) {
        tagSpan = makeSpan(["eqn-num"], [], options);
      } else if (tag === false) {
        tagSpan = makeSpan([], [], options);
      } else {
        tagSpan = makeSpan([], buildExpression$1(tag, options, true), options);
      }
      tagSpan.depth = rw.depth;
      tagSpan.height = rw.height;
      tagSpans.push({
        type: "elem",
        elem: tagSpan,
        shift
      });
    }
  }
  for (
    c3 = 0, colDescrNum = 0;
    // Continue while either there are more columns or more column
    // descriptions, so trailing separators don't get lost.
    c3 < nc || colDescrNum < colDescriptions.length;
    ++c3, ++colDescrNum
  ) {
    var _colDescr3;
    var colDescr = colDescriptions[colDescrNum];
    var firstSeparator = true;
    while (((_colDescr = colDescr) == null ? void 0 : _colDescr.type) === "separator") {
      var _colDescr;
      if (!firstSeparator) {
        colSep = makeSpan(["arraycolsep"], []);
        colSep.style.width = makeEm(options.fontMetrics().doubleRuleSep);
        cols.push(colSep);
      }
      if (colDescr.separator === "|" || colDescr.separator === ":") {
        var lineType = colDescr.separator === "|" ? "solid" : "dashed";
        var separator = makeSpan(["vertical-separator"], [], options);
        separator.style.height = makeEm(totalHeight);
        separator.style.borderRightWidth = makeEm(ruleThickness);
        separator.style.borderRightStyle = lineType;
        separator.style.margin = "0 " + makeEm(-ruleThickness / 2);
        var _shift = totalHeight - offset;
        if (_shift) {
          separator.style.verticalAlign = makeEm(-_shift);
        }
        cols.push(separator);
      } else {
        throw new ParseError("Invalid separator type: " + colDescr.separator);
      }
      colDescrNum++;
      colDescr = colDescriptions[colDescrNum];
      firstSeparator = false;
    }
    if (c3 >= nc) {
      continue;
    }
    var sepwidth = void 0;
    if (c3 > 0 || group.hskipBeforeAndAfter) {
      var _colDescr$pregap, _colDescr2;
      sepwidth = (_colDescr$pregap = (_colDescr2 = colDescr) == null ? void 0 : _colDescr2.pregap) != null ? _colDescr$pregap : arraycolsep;
      if (sepwidth !== 0) {
        colSep = makeSpan(["arraycolsep"], []);
        colSep.style.width = makeEm(sepwidth);
        cols.push(colSep);
      }
    }
    var colElems = [];
    for (r3 = 0; r3 < nr; ++r3) {
      var row = body[r3];
      var elem = row.cells[c3];
      if (!elem) {
        continue;
      }
      var _shift2 = row.pos - offset;
      elem.depth = row.depth;
      elem.height = row.height;
      colElems.push({
        type: "elem",
        elem,
        shift: _shift2
      });
    }
    var colVList = makeVList({
      positionType: "individualShift",
      children: colElems
    });
    var colSpan = makeSpan(["col-align-" + (((_colDescr3 = colDescr) == null ? void 0 : _colDescr3.align) || "c")], [colVList]);
    cols.push(colSpan);
    if (c3 < nc - 1 || group.hskipBeforeAndAfter) {
      var _colDescr$postgap, _colDescr4;
      sepwidth = (_colDescr$postgap = (_colDescr4 = colDescr) == null ? void 0 : _colDescr4.postgap) != null ? _colDescr$postgap : arraycolsep;
      if (sepwidth !== 0) {
        colSep = makeSpan(["arraycolsep"], []);
        colSep.style.width = makeEm(sepwidth);
        cols.push(colSep);
      }
    }
  }
  var tableBody = makeSpan(["mtable"], cols);
  if (hlines.length > 0) {
    var line = makeLineSpan("hline", options, ruleThickness);
    var dashes = makeLineSpan("hdashline", options, ruleThickness);
    var vListElems = [{
      type: "elem",
      elem: tableBody,
      shift: 0
    }];
    while (hlines.length > 0) {
      var hline = hlines.pop();
      var lineShift = hline.pos - offset;
      if (hline.isDashed) {
        vListElems.push({
          type: "elem",
          elem: dashes,
          shift: lineShift
        });
      } else {
        vListElems.push({
          type: "elem",
          elem: line,
          shift: lineShift
        });
      }
    }
    tableBody = makeVList({
      positionType: "individualShift",
      children: vListElems
    });
  }
  if (tagSpans.length === 0) {
    return makeSpan(["mord"], [tableBody], options);
  } else {
    var eqnNumCol = makeVList({
      positionType: "individualShift",
      children: tagSpans
    });
    var tagCol = makeSpan(["tag"], [eqnNumCol], options);
    return makeFragment([tableBody, tagCol]);
  }
};
var alignMap = {
  c: "center ",
  l: "left ",
  r: "right "
};
var mathmlBuilder$5 = function mathmlBuilder(group, options) {
  var tbl = [];
  var glue = new MathNode("mtd", [], ["mtr-glue"]);
  var tag = new MathNode("mtd", [], ["mml-eqn-num"]);
  for (var i4 = 0; i4 < group.body.length; i4++) {
    var rw = group.body[i4];
    var row = [];
    for (var j = 0; j < rw.length; j++) {
      row.push(new MathNode("mtd", [buildGroup2(rw[j], options)]));
    }
    if (group.tags && group.tags[i4]) {
      row.unshift(glue);
      row.push(glue);
      if (group.leqno) {
        row.unshift(tag);
      } else {
        row.push(tag);
      }
    }
    tbl.push(new MathNode("mtr", row));
  }
  var table = new MathNode("mtable", tbl);
  var gap = group.arraystretch === 0.5 ? 0.1 : 0.16 + group.arraystretch - 1 + (group.addJot ? 0.09 : 0);
  table.setAttribute("rowspacing", makeEm(gap));
  var menclose = "";
  var align = "";
  if (group.cols && group.cols.length > 0) {
    var cols = group.cols;
    var columnLines = "";
    var prevTypeWasAlign = false;
    var iStart = 0;
    var iEnd = cols.length;
    if (cols[0].type === "separator") {
      menclose += "top ";
      iStart = 1;
    }
    if (cols[cols.length - 1].type === "separator") {
      menclose += "bottom ";
      iEnd -= 1;
    }
    for (var _i6 = iStart; _i6 < iEnd; _i6++) {
      var col = cols[_i6];
      if (col.type === "align") {
        align += alignMap[col.align];
        if (prevTypeWasAlign) {
          columnLines += "none ";
        }
        prevTypeWasAlign = true;
      } else if (col.type === "separator") {
        if (prevTypeWasAlign) {
          columnLines += col.separator === "|" ? "solid " : "dashed ";
          prevTypeWasAlign = false;
        }
      }
    }
    table.setAttribute("columnalign", align.trim());
    if (/[sd]/.test(columnLines)) {
      table.setAttribute("columnlines", columnLines.trim());
    }
  }
  if (group.colSeparationType === "align") {
    var _cols = group.cols || [];
    var spacing2 = "";
    for (var _i22 = 1; _i22 < _cols.length; _i22++) {
      spacing2 += _i22 % 2 ? "0em " : "1em ";
    }
    table.setAttribute("columnspacing", spacing2.trim());
  } else if (group.colSeparationType === "alignat" || group.colSeparationType === "gather") {
    table.setAttribute("columnspacing", "0em");
  } else if (group.colSeparationType === "small") {
    table.setAttribute("columnspacing", "0.2778em");
  } else if (group.colSeparationType === "CD") {
    table.setAttribute("columnspacing", "0.5em");
  } else {
    table.setAttribute("columnspacing", "1em");
  }
  var rowLines = "";
  var hlines = group.hLinesBeforeRow;
  menclose += hlines[0].length > 0 ? "left " : "";
  menclose += hlines[hlines.length - 1].length > 0 ? "right " : "";
  for (var _i32 = 1; _i32 < hlines.length - 1; _i32++) {
    rowLines += hlines[_i32].length === 0 ? "none " : hlines[_i32][0] ? "dashed " : "solid ";
  }
  if (/[sd]/.test(rowLines)) {
    table.setAttribute("rowlines", rowLines.trim());
  }
  if (menclose !== "") {
    table = new MathNode("menclose", [table]);
    table.setAttribute("notation", menclose.trim());
  }
  if (group.arraystretch && group.arraystretch < 1) {
    table = new MathNode("mstyle", [table]);
    table.setAttribute("scriptlevel", "1");
  }
  return table;
};
var alignedHandler = function alignedHandler2(context, args) {
  if (!context.envName.includes("ed")) {
    validateAmsEnvironmentContext(context);
  }
  var cols = [];
  var separationType = context.envName.includes("at") ? "alignat" : "align";
  var isSplit = context.envName === "split";
  var res = parseArray(context.parser, {
    cols,
    addJot: true,
    autoTag: isSplit ? void 0 : getAutoTag(context.envName),
    emptySingleRow: true,
    colSeparationType: separationType,
    maxNumCols: isSplit ? 2 : void 0,
    leqno: context.parser.settings.leqno
  }, "display");
  var numMaths = 0;
  var numCols = 0;
  var emptyGroup = {
    type: "ordgroup",
    mode: context.mode,
    body: []
  };
  if (args[0] && args[0].type === "ordgroup") {
    var arg0 = "";
    for (var i4 = 0; i4 < args[0].body.length; i4++) {
      var textord2 = assertNodeType(args[0].body[i4], "textord");
      arg0 += textord2.text;
    }
    numMaths = Number(arg0);
    numCols = numMaths * 2;
  }
  var isAligned = !numCols;
  res.body.forEach(function(row) {
    for (var _i42 = 1; _i42 < row.length; _i42 += 2) {
      var styling = assertNodeType(row[_i42], "styling");
      var ordgroup = assertNodeType(styling.body[0], "ordgroup");
      ordgroup.body.unshift(emptyGroup);
    }
    if (!isAligned) {
      var curMaths = row.length / 2;
      if (numMaths < curMaths) {
        throw new ParseError("Too many math in a row: " + ("expected " + numMaths + ", but got " + curMaths), row[0]);
      }
    } else if (numCols < row.length) {
      numCols = row.length;
    }
  });
  for (var _i52 = 0; _i52 < numCols; ++_i52) {
    var align = "r";
    var pregap = 0;
    if (_i52 % 2 === 1) {
      align = "l";
    } else if (_i52 > 0 && isAligned) {
      pregap = 1;
    }
    cols[_i52] = {
      type: "align",
      align,
      pregap,
      postgap: 0
    };
  }
  res.colSeparationType = isAligned ? "align" : "alignat";
  return res;
};
defineEnvironment({
  type: "array",
  names: ["array", "darray"],
  props: {
    numArgs: 1
  },
  handler(context, args) {
    var symNode = checkSymbolNodeType(args[0]);
    var colalign = symNode ? [args[0]] : assertNodeType(args[0], "ordgroup").body;
    var cols = colalign.map(function(nde) {
      var node = assertSymbolNodeType(nde);
      var ca = node.text;
      if ("lcr".includes(ca)) {
        return {
          type: "align",
          align: ca
        };
      } else if (ca === "|") {
        return {
          type: "separator",
          separator: "|"
        };
      } else if (ca === ":") {
        return {
          type: "separator",
          separator: ":"
        };
      }
      throw new ParseError("Unknown column alignment: " + ca, nde);
    });
    var res = {
      cols,
      hskipBeforeAndAfter: true,
      // \@preamble in lttab.dtx
      maxNumCols: cols.length
    };
    return parseArray(context.parser, res, dCellStyle(context.envName));
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "matrix*", "pmatrix*", "bmatrix*", "Bmatrix*", "vmatrix*", "Vmatrix*"],
  props: {
    numArgs: 0
  },
  handler(context) {
    var delimiters2 = {
      "matrix": null,
      "pmatrix": ["(", ")"],
      "bmatrix": ["[", "]"],
      "Bmatrix": ["\\{", "\\}"],
      "vmatrix": ["|", "|"],
      "Vmatrix": ["\\Vert", "\\Vert"]
    }[context.envName.replace("*", "")];
    var colAlign = "c";
    var payload = {
      hskipBeforeAndAfter: false,
      cols: [{
        type: "align",
        align: colAlign
      }]
    };
    if (context.envName.charAt(context.envName.length - 1) === "*") {
      var parser = context.parser;
      parser.consumeSpaces();
      if (parser.fetch().text === "[") {
        parser.consume();
        parser.consumeSpaces();
        colAlign = parser.fetch().text;
        if (!"lcr".includes(colAlign)) {
          throw new ParseError("Expected l or c or r", parser.nextToken);
        }
        parser.consume();
        parser.consumeSpaces();
        parser.expect("]");
        parser.consume();
        payload.cols = [{
          type: "align",
          align: colAlign
        }];
      }
    }
    var res = parseArray(context.parser, payload, dCellStyle(context.envName));
    var numCols = Math.max(0, ...res.body.map((row) => row.length));
    res.cols = new Array(numCols).fill({
      type: "align",
      align: colAlign
    });
    return delimiters2 ? {
      type: "leftright",
      mode: context.mode,
      body: [res],
      left: delimiters2[0],
      right: delimiters2[1],
      rightColor: void 0
      // \right uninfluenced by \color in array
    } : res;
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["smallmatrix"],
  props: {
    numArgs: 0
  },
  handler(context) {
    var payload = {
      arraystretch: 0.5
    };
    var res = parseArray(context.parser, payload, "script");
    res.colSeparationType = "small";
    return res;
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["subarray"],
  props: {
    numArgs: 1
  },
  handler(context, args) {
    var symNode = checkSymbolNodeType(args[0]);
    var colalign = symNode ? [args[0]] : assertNodeType(args[0], "ordgroup").body;
    var cols = colalign.map(function(nde) {
      var node = assertSymbolNodeType(nde);
      var ca = node.text;
      if ("lc".includes(ca)) {
        return {
          type: "align",
          align: ca
        };
      }
      throw new ParseError("Unknown column alignment: " + ca, nde);
    });
    if (cols.length > 1) {
      throw new ParseError("{subarray} can contain only one column");
    }
    var payload = {
      cols,
      hskipBeforeAndAfter: false,
      arraystretch: 0.5
    };
    var res = parseArray(context.parser, payload, "script");
    if (res.body.length > 0 && res.body[0].length > 1) {
      throw new ParseError("{subarray} can contain only one column");
    }
    return res;
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["cases", "dcases", "rcases", "drcases"],
  props: {
    numArgs: 0
  },
  handler(context) {
    var payload = {
      arraystretch: 1.2,
      cols: [{
        type: "align",
        align: "l",
        pregap: 0,
        // TODO(kevinb) get the current style.
        // For now we use the metrics for TEXT style which is what we were
        // doing before.  Before attempting to get the current style we
        // should look at TeX's behavior especially for \over and matrices.
        postgap: 1
        /* 1em quad */
      }, {
        type: "align",
        align: "l",
        pregap: 0,
        postgap: 0
      }]
    };
    var res = parseArray(context.parser, payload, dCellStyle(context.envName));
    return {
      type: "leftright",
      mode: context.mode,
      body: [res],
      left: context.envName.includes("r") ? "." : "\\{",
      right: context.envName.includes("r") ? "\\}" : ".",
      rightColor: void 0
    };
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["align", "align*", "aligned", "split"],
  props: {
    numArgs: 0
  },
  handler: alignedHandler,
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["gathered", "gather", "gather*"],
  props: {
    numArgs: 0
  },
  handler(context) {
    if (gatherEnvironments.has(context.envName)) {
      validateAmsEnvironmentContext(context);
    }
    var res = {
      cols: [{
        type: "align",
        align: "c"
      }],
      addJot: true,
      colSeparationType: "gather",
      autoTag: getAutoTag(context.envName),
      emptySingleRow: true,
      leqno: context.parser.settings.leqno
    };
    return parseArray(context.parser, res, "display");
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["alignat", "alignat*", "alignedat"],
  props: {
    numArgs: 1
  },
  handler: alignedHandler,
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["equation", "equation*"],
  props: {
    numArgs: 0
  },
  handler(context) {
    validateAmsEnvironmentContext(context);
    var res = {
      autoTag: getAutoTag(context.envName),
      emptySingleRow: true,
      singleRow: true,
      maxNumCols: 1,
      leqno: context.parser.settings.leqno
    };
    return parseArray(context.parser, res, "display");
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineEnvironment({
  type: "array",
  names: ["CD"],
  props: {
    numArgs: 0
  },
  handler(context) {
    validateAmsEnvironmentContext(context);
    return parseCD(context.parser);
  },
  htmlBuilder: htmlBuilder$6,
  mathmlBuilder: mathmlBuilder$5
});
defineMacro("\\nonumber", "\\gdef\\@eqnsw{0}");
defineMacro("\\notag", "\\nonumber");
defineFunction({
  type: "text",
  // Doesn't matter what this is.
  names: ["\\hline", "\\hdashline"],
  props: {
    numArgs: 0,
    allowedInText: true,
    allowedInMath: true
  },
  handler(context, args) {
    throw new ParseError(context.funcName + " valid only within array environment");
  }
});
var environments = _environments;
defineFunction({
  type: "environment",
  names: ["\\begin", "\\end"],
  props: {
    numArgs: 1,
    argTypes: ["text"]
  },
  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    var nameGroup = args[0];
    if (nameGroup.type !== "ordgroup") {
      throw new ParseError("Invalid environment name", nameGroup);
    }
    var envName = "";
    for (var i4 = 0; i4 < nameGroup.body.length; ++i4) {
      envName += assertNodeType(nameGroup.body[i4], "textord").text;
    }
    if (funcName === "\\begin") {
      if (!environments.hasOwnProperty(envName)) {
        throw new ParseError("No such environment: " + envName, nameGroup);
      }
      var env = environments[envName];
      var {
        args: _args,
        optArgs
      } = parser.parseArguments("\\begin{" + envName + "}", env);
      var context = {
        mode: parser.mode,
        envName,
        parser
      };
      var result = env.handler(context, _args, optArgs);
      parser.expect("\\end", false);
      var endNameToken = parser.nextToken;
      var end = assertNodeType(parser.parseFunction(), "environment");
      if (end.name !== envName) {
        throw new ParseError("Mismatch: \\begin{" + envName + "} matched by \\end{" + end.name + "}", endNameToken);
      }
      return result;
    }
    return {
      type: "environment",
      mode: parser.mode,
      name: envName,
      nameGroup
    };
  }
});
var htmlBuilder$5 = (group, options) => {
  var font = group.font;
  var newOptions = options.withFont(font);
  return buildGroup$1(group.body, newOptions);
};
var mathmlBuilder$4 = (group, options) => {
  var font = group.font;
  var newOptions = options.withFont(font);
  return buildGroup2(group.body, newOptions);
};
var fontAliases = {
  "\\Bbb": "\\mathbb",
  "\\bold": "\\mathbf",
  "\\frak": "\\mathfrak"
};
defineFunction({
  type: "font",
  names: [
    // styles, except \boldsymbol defined below
    "\\mathrm",
    "\\mathit",
    "\\mathbf",
    "\\mathnormal",
    "\\mathsfit",
    // families
    "\\mathbb",
    "\\mathcal",
    "\\mathfrak",
    "\\mathscr",
    "\\mathsf",
    "\\mathtt",
    // aliases, except \bm defined below
    "\\Bbb",
    "\\bold",
    "\\frak"
  ],
  props: {
    numArgs: 1,
    allowedInArgument: true
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var body = normalizeArgument(args[0]);
    var func = funcName;
    if (func in fontAliases) {
      func = fontAliases[func];
    }
    return {
      type: "font",
      mode: parser.mode,
      font: func.slice(1),
      body
    };
  },
  htmlBuilder: htmlBuilder$5,
  mathmlBuilder: mathmlBuilder$4
});
defineFunction({
  type: "mclass",
  names: ["\\boldsymbol", "\\bm"],
  props: {
    numArgs: 1
  },
  handler: (_ref2, args) => {
    var {
      parser
    } = _ref2;
    var body = args[0];
    return {
      type: "mclass",
      mode: parser.mode,
      mclass: binrelClass(body),
      body: [{
        type: "font",
        mode: parser.mode,
        font: "boldsymbol",
        body
      }],
      isCharacterBox: isCharacterBox(body)
    };
  }
});
defineFunction({
  type: "font",
  names: ["\\rm", "\\sf", "\\tt", "\\bf", "\\it", "\\cal"],
  props: {
    numArgs: 0,
    allowedInText: true
  },
  handler: (_ref3, args) => {
    var {
      parser,
      funcName,
      breakOnTokenText
    } = _ref3;
    var {
      mode
    } = parser;
    var body = parser.parseExpression(true, breakOnTokenText);
    return {
      type: "font",
      mode,
      font: "math" + funcName.slice(1),
      body: {
        type: "ordgroup",
        mode: parser.mode,
        body
      }
    };
  },
  htmlBuilder: htmlBuilder$5,
  mathmlBuilder: mathmlBuilder$4
});
var htmlBuilder$4 = (group, options) => {
  var style = options.style;
  var nstyle = style.fracNum();
  var dstyle = style.fracDen();
  var newOptions;
  newOptions = options.havingStyle(nstyle);
  var numerm = buildGroup$1(group.numer, newOptions, options);
  if (group.continued) {
    var hStrut = 8.5 / options.fontMetrics().ptPerEm;
    var dStrut = 3.5 / options.fontMetrics().ptPerEm;
    numerm.height = numerm.height < hStrut ? hStrut : numerm.height;
    numerm.depth = numerm.depth < dStrut ? dStrut : numerm.depth;
  }
  newOptions = options.havingStyle(dstyle);
  var denomm = buildGroup$1(group.denom, newOptions, options);
  var rule;
  var ruleWidth;
  var ruleSpacing;
  if (group.hasBarLine) {
    if (group.barSize) {
      ruleWidth = calculateSize(group.barSize, options);
      rule = makeLineSpan("frac-line", options, ruleWidth);
    } else {
      rule = makeLineSpan("frac-line", options);
    }
    ruleWidth = rule.height;
    ruleSpacing = rule.height;
  } else {
    rule = null;
    ruleWidth = 0;
    ruleSpacing = options.fontMetrics().defaultRuleThickness;
  }
  var numShift;
  var clearance;
  var denomShift;
  if (style.size === Style$1.DISPLAY.size) {
    numShift = options.fontMetrics().num1;
    if (ruleWidth > 0) {
      clearance = 3 * ruleSpacing;
    } else {
      clearance = 7 * ruleSpacing;
    }
    denomShift = options.fontMetrics().denom1;
  } else {
    if (ruleWidth > 0) {
      numShift = options.fontMetrics().num2;
      clearance = ruleSpacing;
    } else {
      numShift = options.fontMetrics().num3;
      clearance = 3 * ruleSpacing;
    }
    denomShift = options.fontMetrics().denom2;
  }
  var frac;
  if (!rule) {
    var candidateClearance = numShift - numerm.depth - (denomm.height - denomShift);
    if (candidateClearance < clearance) {
      numShift += 0.5 * (clearance - candidateClearance);
      denomShift += 0.5 * (clearance - candidateClearance);
    }
    frac = makeVList({
      positionType: "individualShift",
      children: [{
        type: "elem",
        elem: denomm,
        shift: denomShift
      }, {
        type: "elem",
        elem: numerm,
        shift: -numShift
      }]
    });
  } else {
    var axisHeight = options.fontMetrics().axisHeight;
    if (numShift - numerm.depth - (axisHeight + 0.5 * ruleWidth) < clearance) {
      numShift += clearance - (numShift - numerm.depth - (axisHeight + 0.5 * ruleWidth));
    }
    if (axisHeight - 0.5 * ruleWidth - (denomm.height - denomShift) < clearance) {
      denomShift += clearance - (axisHeight - 0.5 * ruleWidth - (denomm.height - denomShift));
    }
    var midShift = -(axisHeight - 0.5 * ruleWidth);
    frac = makeVList({
      positionType: "individualShift",
      children: [{
        type: "elem",
        elem: denomm,
        shift: denomShift
      }, {
        type: "elem",
        elem: rule,
        shift: midShift
      }, {
        type: "elem",
        elem: numerm,
        shift: -numShift
      }]
    });
  }
  newOptions = options.havingStyle(style);
  frac.height *= newOptions.sizeMultiplier / options.sizeMultiplier;
  frac.depth *= newOptions.sizeMultiplier / options.sizeMultiplier;
  var delimSize;
  if (style.size === Style$1.DISPLAY.size) {
    delimSize = options.fontMetrics().delim1;
  } else if (style.size === Style$1.SCRIPTSCRIPT.size) {
    delimSize = options.havingStyle(Style$1.SCRIPT).fontMetrics().delim2;
  } else {
    delimSize = options.fontMetrics().delim2;
  }
  var leftDelim;
  var rightDelim;
  if (group.leftDelim == null) {
    leftDelim = makeNullDelimiter(options, ["mopen"]);
  } else {
    leftDelim = makeCustomSizedDelim(group.leftDelim, delimSize, true, options.havingStyle(style), group.mode, ["mopen"]);
  }
  if (group.continued) {
    rightDelim = makeSpan([]);
  } else if (group.rightDelim == null) {
    rightDelim = makeNullDelimiter(options, ["mclose"]);
  } else {
    rightDelim = makeCustomSizedDelim(group.rightDelim, delimSize, true, options.havingStyle(style), group.mode, ["mclose"]);
  }
  return makeSpan(["mord"].concat(newOptions.sizingClasses(options)), [leftDelim, makeSpan(["mfrac"], [frac]), rightDelim], options);
};
var mathmlBuilder$3 = (group, options) => {
  var node = new MathNode("mfrac", [buildGroup2(group.numer, options), buildGroup2(group.denom, options)]);
  if (!group.hasBarLine) {
    node.setAttribute("linethickness", "0px");
  } else if (group.barSize) {
    var ruleWidth = calculateSize(group.barSize, options);
    node.setAttribute("linethickness", makeEm(ruleWidth));
  }
  if (group.leftDelim != null || group.rightDelim != null) {
    var withDelims = [];
    if (group.leftDelim != null) {
      var leftOp = new MathNode("mo", [new TextNode(group.leftDelim.replace("\\", ""))]);
      leftOp.setAttribute("fence", "true");
      withDelims.push(leftOp);
    }
    withDelims.push(node);
    if (group.rightDelim != null) {
      var rightOp = new MathNode("mo", [new TextNode(group.rightDelim.replace("\\", ""))]);
      rightOp.setAttribute("fence", "true");
      withDelims.push(rightOp);
    }
    return makeRow(withDelims);
  }
  return node;
};
var wrapWithStyle = (frac, style) => {
  if (!style) {
    return frac;
  }
  var wrapper = {
    type: "styling",
    mode: frac.mode,
    style,
    body: [frac]
  };
  return wrapper;
};
defineFunction({
  type: "genfrac",
  names: [
    "\\cfrac",
    "\\dfrac",
    "\\frac",
    "\\tfrac",
    "\\dbinom",
    "\\binom",
    "\\tbinom",
    "\\\\atopfrac",
    // can’t be entered directly
    "\\\\bracefrac",
    "\\\\brackfrac"
    // ditto
  ],
  props: {
    numArgs: 2,
    allowedInArgument: true
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var numer = args[0];
    var denom = args[1];
    var hasBarLine;
    var leftDelim = null;
    var rightDelim = null;
    switch (funcName) {
      case "\\cfrac":
      case "\\dfrac":
      case "\\frac":
      case "\\tfrac":
        hasBarLine = true;
        break;
      case "\\\\atopfrac":
        hasBarLine = false;
        break;
      case "\\dbinom":
      case "\\binom":
      case "\\tbinom":
        hasBarLine = false;
        leftDelim = "(";
        rightDelim = ")";
        break;
      case "\\\\bracefrac":
        hasBarLine = false;
        leftDelim = "\\{";
        rightDelim = "\\}";
        break;
      case "\\\\brackfrac":
        hasBarLine = false;
        leftDelim = "[";
        rightDelim = "]";
        break;
      default:
        throw new Error("Unrecognized genfrac command");
    }
    var continued = funcName === "\\cfrac";
    var style = null;
    if (continued || funcName.startsWith("\\d")) {
      style = "display";
    } else if (funcName.startsWith("\\t")) {
      style = "text";
    }
    return wrapWithStyle({
      type: "genfrac",
      mode: parser.mode,
      numer,
      denom,
      continued,
      hasBarLine,
      leftDelim,
      rightDelim,
      barSize: null
    }, style);
  },
  htmlBuilder: htmlBuilder$4,
  mathmlBuilder: mathmlBuilder$3
});
defineFunction({
  type: "infix",
  names: ["\\over", "\\choose", "\\atop", "\\brace", "\\brack"],
  props: {
    numArgs: 0,
    infix: true
  },
  handler(_ref2) {
    var {
      parser,
      funcName,
      token
    } = _ref2;
    var replaceWith;
    switch (funcName) {
      case "\\over":
        replaceWith = "\\frac";
        break;
      case "\\choose":
        replaceWith = "\\binom";
        break;
      case "\\atop":
        replaceWith = "\\\\atopfrac";
        break;
      case "\\brace":
        replaceWith = "\\\\bracefrac";
        break;
      case "\\brack":
        replaceWith = "\\\\brackfrac";
        break;
      default:
        throw new Error("Unrecognized infix genfrac command");
    }
    return {
      type: "infix",
      mode: parser.mode,
      replaceWith,
      token
    };
  }
});
var stylArray = ["display", "text", "script", "scriptscript"];
var delimFromValue = function delimFromValue2(delimString) {
  var delim = null;
  if (delimString.length > 0) {
    delim = delimString;
    delim = delim === "." ? null : delim;
  }
  return delim;
};
defineFunction({
  type: "genfrac",
  names: ["\\genfrac"],
  props: {
    numArgs: 6,
    allowedInArgument: true,
    argTypes: ["math", "math", "size", "text", "math", "math"]
  },
  handler(_ref3, args) {
    var {
      parser
    } = _ref3;
    var numer = args[4];
    var denom = args[5];
    var leftNode = normalizeArgument(args[0]);
    var leftDelim = leftNode.type === "atom" && leftNode.family === "open" ? delimFromValue(leftNode.text) : null;
    var rightNode = normalizeArgument(args[1]);
    var rightDelim = rightNode.type === "atom" && rightNode.family === "close" ? delimFromValue(rightNode.text) : null;
    var barNode = assertNodeType(args[2], "size");
    var hasBarLine;
    var barSize = null;
    if (barNode.isBlank) {
      hasBarLine = true;
    } else {
      barSize = barNode.value;
      hasBarLine = barSize.number > 0;
    }
    var size = null;
    var styl = args[3];
    if (styl.type === "ordgroup") {
      if (styl.body.length > 0) {
        var textOrd = assertNodeType(styl.body[0], "textord");
        size = stylArray[Number(textOrd.text)];
      }
    } else {
      styl = assertNodeType(styl, "textord");
      size = stylArray[Number(styl.text)];
    }
    return wrapWithStyle({
      type: "genfrac",
      mode: parser.mode,
      numer,
      denom,
      continued: false,
      hasBarLine,
      barSize,
      leftDelim,
      rightDelim
    }, size);
  }
});
defineFunction({
  type: "infix",
  names: ["\\above"],
  props: {
    numArgs: 1,
    argTypes: ["size"],
    infix: true
  },
  handler(_ref4, args) {
    var {
      parser,
      funcName,
      token
    } = _ref4;
    return {
      type: "infix",
      mode: parser.mode,
      replaceWith: "\\\\abovefrac",
      size: assertNodeType(args[0], "size").value,
      token
    };
  }
});
defineFunction({
  type: "genfrac",
  names: ["\\\\abovefrac"],
  props: {
    numArgs: 3,
    argTypes: ["math", "size", "math"]
  },
  handler: (_ref5, args) => {
    var {
      parser,
      funcName
    } = _ref5;
    var numer = args[0];
    var barSize = assertNodeType(args[1], "infix").size;
    if (!barSize) {
      throw new Error("\\\\abovefrac expected size, but got " + String(barSize));
    }
    var denom = args[2];
    var hasBarLine = barSize.number > 0;
    return {
      type: "genfrac",
      mode: parser.mode,
      numer,
      denom,
      continued: false,
      hasBarLine,
      barSize,
      leftDelim: null,
      rightDelim: null
    };
  }
});
var htmlBuilder$3 = (grp, options) => {
  var style = options.style;
  var supSubGroup;
  var group;
  if (grp.type === "supsub") {
    supSubGroup = grp.sup ? buildGroup$1(grp.sup, options.havingStyle(style.sup()), options) : buildGroup$1(grp.sub, options.havingStyle(style.sub()), options);
    group = assertNodeType(grp.base, "horizBrace");
  } else {
    group = assertNodeType(grp, "horizBrace");
  }
  var body = buildGroup$1(group.base, options.havingBaseStyle(Style$1.DISPLAY));
  var braceBody = stretchySvg(group, options);
  var vlist;
  if (group.isOver) {
    vlist = makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: body
      }, {
        type: "kern",
        size: 0.1
      }, {
        type: "elem",
        elem: braceBody,
        wrapperClasses: ["svg-align"]
      }]
    });
  } else {
    vlist = makeVList({
      positionType: "bottom",
      positionData: body.depth + 0.1 + braceBody.height,
      children: [{
        type: "elem",
        elem: braceBody,
        wrapperClasses: ["svg-align"]
      }, {
        type: "kern",
        size: 0.1
      }, {
        type: "elem",
        elem: body
      }]
    });
  }
  if (supSubGroup) {
    var vSpan = makeSpan(["minner", group.isOver ? "mover" : "munder"], [vlist], options);
    if (group.isOver) {
      vlist = makeVList({
        positionType: "firstBaseline",
        children: [{
          type: "elem",
          elem: vSpan
        }, {
          type: "kern",
          size: 0.2
        }, {
          type: "elem",
          elem: supSubGroup
        }]
      });
    } else {
      vlist = makeVList({
        positionType: "bottom",
        positionData: vSpan.depth + 0.2 + supSubGroup.height + supSubGroup.depth,
        children: [{
          type: "elem",
          elem: supSubGroup
        }, {
          type: "kern",
          size: 0.2
        }, {
          type: "elem",
          elem: vSpan
        }]
      });
    }
  }
  return makeSpan(["minner", group.isOver ? "mover" : "munder"], [vlist], options);
};
var mathmlBuilder$2 = (group, options) => {
  var accentNode = stretchyMathML(group.label);
  return new MathNode(group.isOver ? "mover" : "munder", [buildGroup2(group.base, options), accentNode]);
};
defineFunction({
  type: "horizBrace",
  names: ["\\overbrace", "\\underbrace", "\\overbracket", "\\underbracket"],
  props: {
    numArgs: 1
  },
  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    return {
      type: "horizBrace",
      mode: parser.mode,
      label: funcName,
      isOver: funcName.includes("\\over"),
      base: args[0]
    };
  },
  htmlBuilder: htmlBuilder$3,
  mathmlBuilder: mathmlBuilder$2
});
defineFunction({
  type: "href",
  names: ["\\href"],
  props: {
    numArgs: 2,
    argTypes: ["url", "original"],
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser
    } = _ref;
    var body = args[1];
    var href = assertNodeType(args[0], "url").url;
    if (!parser.settings.isTrusted({
      command: "\\href",
      url: href
    })) {
      return parser.formatUnsupportedCmd("\\href");
    }
    return {
      type: "href",
      mode: parser.mode,
      href,
      body: ordargument(body)
    };
  },
  htmlBuilder: (group, options) => {
    var elements = buildExpression$1(group.body, options, false);
    return makeAnchor(group.href, [], elements, options);
  },
  mathmlBuilder: (group, options) => {
    var math2 = buildExpressionRow(group.body, options);
    if (!(math2 instanceof MathNode)) {
      math2 = new MathNode("mrow", [math2]);
    }
    math2.setAttribute("href", group.href);
    return math2;
  }
});
defineFunction({
  type: "href",
  names: ["\\url"],
  props: {
    numArgs: 1,
    argTypes: ["url"],
    allowedInText: true
  },
  handler: (_ref2, args) => {
    var {
      parser
    } = _ref2;
    var href = assertNodeType(args[0], "url").url;
    if (!parser.settings.isTrusted({
      command: "\\url",
      url: href
    })) {
      return parser.formatUnsupportedCmd("\\url");
    }
    var chars = [];
    for (var i4 = 0; i4 < href.length; i4++) {
      var c3 = href[i4];
      if (c3 === "~") {
        c3 = "\\textasciitilde";
      }
      chars.push({
        type: "textord",
        mode: "text",
        text: c3
      });
    }
    var body = {
      type: "text",
      mode: parser.mode,
      font: "\\texttt",
      body: chars
    };
    return {
      type: "href",
      mode: parser.mode,
      href,
      body: ordargument(body)
    };
  }
});
defineFunction({
  type: "hbox",
  names: ["\\hbox"],
  props: {
    numArgs: 1,
    argTypes: ["text"],
    allowedInText: true,
    primitive: true
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    return {
      type: "hbox",
      mode: parser.mode,
      body: ordargument(args[0])
    };
  },
  htmlBuilder(group, options) {
    var elements = buildExpression$1(group.body, options.withFont(""), false);
    return makeFragment(elements);
  },
  mathmlBuilder(group, options) {
    return new MathNode("mrow", buildExpression2(group.body, options.withFont("")));
  }
});
defineFunction({
  type: "html",
  names: ["\\htmlClass", "\\htmlId", "\\htmlStyle", "\\htmlData"],
  props: {
    numArgs: 2,
    argTypes: ["raw", "original"],
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName,
      token
    } = _ref;
    var value = assertNodeType(args[0], "raw").string;
    var body = args[1];
    if (parser.settings.strict) {
      parser.settings.reportNonstrict("htmlExtension", "HTML extension is disabled on strict mode");
    }
    var trustContext;
    var attributes = {};
    switch (funcName) {
      case "\\htmlClass":
        attributes.class = value;
        trustContext = {
          command: "\\htmlClass",
          class: value
        };
        break;
      case "\\htmlId":
        attributes.id = value;
        trustContext = {
          command: "\\htmlId",
          id: value
        };
        break;
      case "\\htmlStyle":
        attributes.style = value;
        trustContext = {
          command: "\\htmlStyle",
          style: value
        };
        break;
      case "\\htmlData": {
        var data = value.split(",");
        for (var i4 = 0; i4 < data.length; i4++) {
          var item = data[i4];
          var firstEquals = item.indexOf("=");
          if (firstEquals < 0) {
            throw new ParseError("\\htmlData key/value '" + item + "' missing equals sign");
          }
          var key = item.slice(0, firstEquals);
          var _value = item.slice(firstEquals + 1);
          attributes["data-" + key.trim()] = _value;
        }
        trustContext = {
          command: "\\htmlData",
          attributes
        };
        break;
      }
      default:
        throw new Error("Unrecognized html command");
    }
    if (!parser.settings.isTrusted(trustContext)) {
      return parser.formatUnsupportedCmd(funcName);
    }
    return {
      type: "html",
      mode: parser.mode,
      attributes,
      body: ordargument(body)
    };
  },
  htmlBuilder: (group, options) => {
    var elements = buildExpression$1(group.body, options, false);
    var classes = ["enclosing"];
    if (group.attributes.class) {
      classes.push(...group.attributes.class.trim().split(/\s+/));
    }
    var span = makeSpan(classes, elements, options);
    for (var attr in group.attributes) {
      if (attr !== "class" && group.attributes.hasOwnProperty(attr)) {
        span.setAttribute(attr, group.attributes[attr]);
      }
    }
    return span;
  },
  mathmlBuilder: (group, options) => {
    return buildExpressionRow(group.body, options);
  }
});
defineFunction({
  type: "htmlmathml",
  names: ["\\html@mathml"],
  props: {
    numArgs: 2,
    allowedInArgument: true,
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser
    } = _ref;
    return {
      type: "htmlmathml",
      mode: parser.mode,
      html: ordargument(args[0]),
      mathml: ordargument(args[1])
    };
  },
  htmlBuilder: (group, options) => {
    var elements = buildExpression$1(group.html, options, false);
    return makeFragment(elements);
  },
  mathmlBuilder: (group, options) => {
    return buildExpressionRow(group.mathml, options);
  }
});
var sizeData = function sizeData2(str) {
  if (/^[-+]? *(\d+(\.\d*)?|\.\d+)$/.test(str)) {
    return {
      number: +str,
      unit: "bp"
    };
  } else {
    var match = /([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(str);
    if (!match) {
      throw new ParseError("Invalid size: '" + str + "' in \\includegraphics");
    }
    var data = {
      number: +(match[1] + match[2]),
      // sign + magnitude, cast to number
      unit: match[3]
    };
    if (!validUnit(data)) {
      throw new ParseError("Invalid unit: '" + data.unit + "' in \\includegraphics.");
    }
    return data;
  }
};
defineFunction({
  type: "includegraphics",
  names: ["\\includegraphics"],
  props: {
    numArgs: 1,
    numOptionalArgs: 1,
    argTypes: ["raw", "url"],
    allowedInText: false
  },
  handler: (_ref, args, optArgs) => {
    var {
      parser
    } = _ref;
    var width = {
      number: 0,
      unit: "em"
    };
    var height = {
      number: 0.9,
      unit: "em"
    };
    var totalheight = {
      number: 0,
      unit: "em"
    };
    var alt = "";
    if (optArgs[0]) {
      var attributeStr = assertNodeType(optArgs[0], "raw").string;
      var attributes = attributeStr.split(",");
      for (var i4 = 0; i4 < attributes.length; i4++) {
        var keyVal = attributes[i4].split("=");
        if (keyVal.length === 2) {
          var str = keyVal[1].trim();
          switch (keyVal[0].trim()) {
            case "alt":
              alt = str;
              break;
            case "width":
              width = sizeData(str);
              break;
            case "height":
              height = sizeData(str);
              break;
            case "totalheight":
              totalheight = sizeData(str);
              break;
            default:
              throw new ParseError("Invalid key: '" + keyVal[0] + "' in \\includegraphics.");
          }
        }
      }
    }
    var src = assertNodeType(args[0], "url").url;
    if (alt === "") {
      alt = src;
      alt = alt.replace(/^.*[\\/]/, "");
      alt = alt.substring(0, alt.lastIndexOf("."));
    }
    if (!parser.settings.isTrusted({
      command: "\\includegraphics",
      url: src
    })) {
      return parser.formatUnsupportedCmd("\\includegraphics");
    }
    return {
      type: "includegraphics",
      mode: parser.mode,
      alt,
      width,
      height,
      totalheight,
      src
    };
  },
  htmlBuilder: (group, options) => {
    var height = calculateSize(group.height, options);
    var depth = 0;
    if (group.totalheight.number > 0) {
      depth = calculateSize(group.totalheight, options) - height;
    }
    var width = 0;
    if (group.width.number > 0) {
      width = calculateSize(group.width, options);
    }
    var style = {
      height: makeEm(height + depth)
    };
    if (width > 0) {
      style.width = makeEm(width);
    }
    if (depth > 0) {
      style.verticalAlign = makeEm(-depth);
    }
    var node = new Img(group.src, group.alt, style);
    node.height = height;
    node.depth = depth;
    return node;
  },
  mathmlBuilder: (group, options) => {
    var node = new MathNode("mglyph", []);
    node.setAttribute("alt", group.alt);
    var height = calculateSize(group.height, options);
    var depth = 0;
    if (group.totalheight.number > 0) {
      depth = calculateSize(group.totalheight, options) - height;
      node.setAttribute("valign", makeEm(-depth));
    }
    node.setAttribute("height", makeEm(height + depth));
    if (group.width.number > 0) {
      var width = calculateSize(group.width, options);
      node.setAttribute("width", makeEm(width));
    }
    node.setAttribute("src", group.src);
    return node;
  }
});
defineFunction({
  type: "kern",
  names: ["\\kern", "\\mkern", "\\hskip", "\\mskip"],
  props: {
    numArgs: 1,
    argTypes: ["size"],
    primitive: true,
    allowedInText: true
  },
  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    var size = assertNodeType(args[0], "size");
    if (parser.settings.strict) {
      var mathFunction = funcName[1] === "m";
      var muUnit = size.value.unit === "mu";
      if (mathFunction) {
        if (!muUnit) {
          parser.settings.reportNonstrict("mathVsTextUnits", "LaTeX's " + funcName + " supports only mu units, " + ("not " + size.value.unit + " units"));
        }
        if (parser.mode !== "math") {
          parser.settings.reportNonstrict("mathVsTextUnits", "LaTeX's " + funcName + " works only in math mode");
        }
      } else {
        if (muUnit) {
          parser.settings.reportNonstrict("mathVsTextUnits", "LaTeX's " + funcName + " doesn't support mu units");
        }
      }
    }
    return {
      type: "kern",
      mode: parser.mode,
      dimension: size.value
    };
  },
  htmlBuilder(group, options) {
    return makeGlue(group.dimension, options);
  },
  mathmlBuilder(group, options) {
    var dimension = calculateSize(group.dimension, options);
    return new SpaceNode(dimension);
  }
});
defineFunction({
  type: "lap",
  names: ["\\mathllap", "\\mathrlap", "\\mathclap"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var body = args[0];
    return {
      type: "lap",
      mode: parser.mode,
      alignment: funcName.slice(5),
      body
    };
  },
  htmlBuilder: (group, options) => {
    var inner2;
    if (group.alignment === "clap") {
      inner2 = makeSpan([], [buildGroup$1(group.body, options)]);
      inner2 = makeSpan(["inner"], [inner2], options);
    } else {
      inner2 = makeSpan(["inner"], [buildGroup$1(group.body, options)]);
    }
    var fix = makeSpan(["fix"], []);
    var node = makeSpan([group.alignment], [inner2, fix], options);
    var strut = makeSpan(["strut"]);
    strut.style.height = makeEm(node.height + node.depth);
    if (node.depth) {
      strut.style.verticalAlign = makeEm(-node.depth);
    }
    node.children.unshift(strut);
    node = makeSpan(["thinbox"], [node], options);
    return makeSpan(["mord", "vbox"], [node], options);
  },
  mathmlBuilder: (group, options) => {
    var node = new MathNode("mpadded", [buildGroup2(group.body, options)]);
    if (group.alignment !== "rlap") {
      var offset = group.alignment === "llap" ? "-1" : "-0.5";
      node.setAttribute("lspace", offset + "width");
    }
    node.setAttribute("width", "0px");
    return node;
  }
});
defineFunction({
  type: "styling",
  names: ["\\(", "$"],
  props: {
    numArgs: 0,
    allowedInText: true,
    allowedInMath: false
  },
  handler(_ref, args) {
    var {
      funcName,
      parser
    } = _ref;
    var outerMode = parser.mode;
    parser.switchMode("math");
    var close2 = funcName === "\\(" ? "\\)" : "$";
    var body = parser.parseExpression(false, close2);
    parser.expect(close2);
    parser.switchMode(outerMode);
    return {
      type: "styling",
      mode: parser.mode,
      style: "text",
      resetFont: true,
      body
    };
  }
});
defineFunction({
  type: "text",
  // Doesn't matter what this is.
  names: ["\\)", "\\]"],
  props: {
    numArgs: 0,
    allowedInText: true,
    allowedInMath: false
  },
  handler(context, args) {
    throw new ParseError("Mismatched " + context.funcName);
  }
});
var chooseMathStyle = (group, options) => {
  switch (options.style.size) {
    case Style$1.DISPLAY.size:
      return group.display;
    case Style$1.TEXT.size:
      return group.text;
    case Style$1.SCRIPT.size:
      return group.script;
    case Style$1.SCRIPTSCRIPT.size:
      return group.scriptscript;
    default:
      return group.text;
  }
};
defineFunction({
  type: "mathchoice",
  names: ["\\mathchoice"],
  props: {
    numArgs: 4,
    primitive: true
  },
  handler: (_ref, args) => {
    var {
      parser
    } = _ref;
    return {
      type: "mathchoice",
      mode: parser.mode,
      display: ordargument(args[0]),
      text: ordargument(args[1]),
      script: ordargument(args[2]),
      scriptscript: ordargument(args[3])
    };
  },
  htmlBuilder: (group, options) => {
    var body = chooseMathStyle(group, options);
    var elements = buildExpression$1(body, options, false);
    return makeFragment(elements);
  },
  mathmlBuilder: (group, options) => {
    var body = chooseMathStyle(group, options);
    return buildExpressionRow(body, options);
  }
});
var assembleSupSub = (base, supGroup, subGroup, options, style, slant, baseShift) => {
  base = makeSpan([], [base]);
  var subIsSingleCharacter = subGroup && isCharacterBox(subGroup);
  var sub2;
  var sup2;
  if (supGroup) {
    var elem = buildGroup$1(supGroup, options.havingStyle(style.sup()), options);
    sup2 = {
      elem,
      kern: Math.max(options.fontMetrics().bigOpSpacing1, options.fontMetrics().bigOpSpacing3 - elem.depth)
    };
  }
  if (subGroup) {
    var _elem = buildGroup$1(subGroup, options.havingStyle(style.sub()), options);
    sub2 = {
      elem: _elem,
      kern: Math.max(options.fontMetrics().bigOpSpacing2, options.fontMetrics().bigOpSpacing4 - _elem.height)
    };
  }
  var finalGroup;
  if (sup2 && sub2) {
    var bottom = options.fontMetrics().bigOpSpacing5 + sub2.elem.height + sub2.elem.depth + sub2.kern + base.depth + baseShift;
    finalGroup = makeVList({
      positionType: "bottom",
      positionData: bottom,
      children: [{
        type: "kern",
        size: options.fontMetrics().bigOpSpacing5
      }, {
        type: "elem",
        elem: sub2.elem,
        marginLeft: makeEm(-slant)
      }, {
        type: "kern",
        size: sub2.kern
      }, {
        type: "elem",
        elem: base
      }, {
        type: "kern",
        size: sup2.kern
      }, {
        type: "elem",
        elem: sup2.elem,
        marginLeft: makeEm(slant)
      }, {
        type: "kern",
        size: options.fontMetrics().bigOpSpacing5
      }]
    });
  } else if (sub2) {
    var top = base.height - baseShift;
    finalGroup = makeVList({
      positionType: "top",
      positionData: top,
      children: [{
        type: "kern",
        size: options.fontMetrics().bigOpSpacing5
      }, {
        type: "elem",
        elem: sub2.elem,
        marginLeft: makeEm(-slant)
      }, {
        type: "kern",
        size: sub2.kern
      }, {
        type: "elem",
        elem: base
      }]
    });
  } else if (sup2) {
    var _bottom = base.depth + baseShift;
    finalGroup = makeVList({
      positionType: "bottom",
      positionData: _bottom,
      children: [{
        type: "elem",
        elem: base
      }, {
        type: "kern",
        size: sup2.kern
      }, {
        type: "elem",
        elem: sup2.elem,
        marginLeft: makeEm(slant)
      }, {
        type: "kern",
        size: options.fontMetrics().bigOpSpacing5
      }]
    });
  } else {
    return base;
  }
  var parts = [finalGroup];
  if (sub2 && slant !== 0 && !subIsSingleCharacter) {
    var spacer = makeSpan(["mspace"], [], options);
    spacer.style.marginRight = makeEm(slant);
    parts.unshift(spacer);
  }
  return makeSpan(["mop", "op-limits"], parts, options);
};
var noSuccessor = /* @__PURE__ */ new Set(["\\smallint"]);
var htmlBuilder$2 = (grp, options) => {
  var supGroup;
  var subGroup;
  var hasLimits = false;
  var group;
  if (grp.type === "supsub") {
    supGroup = grp.sup;
    subGroup = grp.sub;
    group = assertNodeType(grp.base, "op");
    hasLimits = true;
  } else {
    group = assertNodeType(grp, "op");
  }
  var style = options.style;
  var large = false;
  if (style.size === Style$1.DISPLAY.size && group.symbol && !noSuccessor.has(group.name)) {
    large = true;
  }
  var base;
  var symbolItalic;
  if (group.symbol) {
    var fontName = large ? "Size2-Regular" : "Size1-Regular";
    var stash = "";
    if (group.name === "\\oiint" || group.name === "\\oiiint") {
      stash = group.name.slice(1);
      group.name = stash === "oiint" ? "\\iint" : "\\iiint";
    }
    base = makeSymbol(group.name, fontName, "math", options, ["mop", "op-symbol", large ? "large-op" : "small-op"]);
    symbolItalic = base.italic;
    if (stash.length > 0) {
      var oval = staticSvg(stash + "Size" + (large ? "2" : "1"), options);
      base = makeVList({
        positionType: "individualShift",
        children: [{
          type: "elem",
          elem: base,
          shift: 0
        }, {
          type: "elem",
          elem: oval,
          shift: large ? 0.08 : 0
        }]
      });
      group.name = "\\" + stash;
      base.classes.unshift("mop");
      base.italic = symbolItalic;
    }
  } else if (group.body) {
    var inner2 = buildExpression$1(group.body, options, true);
    if (inner2.length === 1 && inner2[0] instanceof SymbolNode) {
      base = inner2[0];
      base.classes[0] = "mop";
    } else {
      base = makeSpan(["mop"], inner2, options);
    }
  } else {
    var output = [];
    for (var i4 = 1; i4 < group.name.length; i4++) {
      output.push(mathsym(group.name[i4], group.mode, options));
    }
    base = makeSpan(["mop"], output, options);
  }
  var baseShift = 0;
  var slant = 0;
  if ((base instanceof SymbolNode || group.name === "\\oiint" || group.name === "\\oiiint") && !group.suppressBaseShift) {
    var _base$italic;
    baseShift = (base.height - base.depth) / 2 - options.fontMetrics().axisHeight;
    slant = (_base$italic = base.italic) != null ? _base$italic : 0;
  }
  if (hasLimits) {
    return assembleSupSub(base, supGroup, subGroup, options, style, slant, baseShift);
  } else {
    if (baseShift) {
      base.style.position = "relative";
      base.style.top = makeEm(baseShift);
    }
    return base;
  }
};
var mathmlBuilder$1 = (group, options) => {
  var node;
  if (group.symbol) {
    node = new MathNode("mo", [makeText(group.name, group.mode)]);
    if (noSuccessor.has(group.name)) {
      node.setAttribute("largeop", "false");
    }
  } else if (group.body) {
    node = new MathNode("mo", buildExpression2(group.body, options));
  } else {
    node = new MathNode("mi", [new TextNode(group.name.slice(1))]);
    var operator = new MathNode("mo", [makeText("\u2061", "text")]);
    if (group.parentIsSupSub) {
      node = new MathNode("mrow", [node, operator]);
    } else {
      node = newDocumentFragment([node, operator]);
    }
  }
  return node;
};
var singleCharBigOps = {
  "\u220F": "\\prod",
  "\u2210": "\\coprod",
  "\u2211": "\\sum",
  "\u22C0": "\\bigwedge",
  "\u22C1": "\\bigvee",
  "\u22C2": "\\bigcap",
  "\u22C3": "\\bigcup",
  "\u2A00": "\\bigodot",
  "\u2A01": "\\bigoplus",
  "\u2A02": "\\bigotimes",
  "\u2A04": "\\biguplus",
  "\u2A06": "\\bigsqcup"
};
defineFunction({
  type: "op",
  names: ["\\coprod", "\\bigvee", "\\bigwedge", "\\biguplus", "\\bigcap", "\\bigcup", "\\intop", "\\prod", "\\sum", "\\bigotimes", "\\bigoplus", "\\bigodot", "\\bigsqcup", "\\smallint", "\u220F", "\u2210", "\u2211", "\u22C0", "\u22C1", "\u22C2", "\u22C3", "\u2A00", "\u2A01", "\u2A02", "\u2A04", "\u2A06"],
  props: {
    numArgs: 0
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var fName = funcName;
    if (fName.length === 1) {
      fName = singleCharBigOps[fName];
    }
    return {
      type: "op",
      mode: parser.mode,
      limits: true,
      parentIsSupSub: false,
      symbol: true,
      name: fName
    };
  },
  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
});
defineFunction({
  type: "op",
  names: ["\\mathop"],
  props: {
    numArgs: 1,
    primitive: true
  },
  handler: (_ref2, args) => {
    var {
      parser
    } = _ref2;
    var body = args[0];
    return {
      type: "op",
      mode: parser.mode,
      limits: false,
      parentIsSupSub: false,
      symbol: false,
      body: ordargument(body)
    };
  },
  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
});
var singleCharIntegrals = {
  "\u222B": "\\int",
  "\u222C": "\\iint",
  "\u222D": "\\iiint",
  "\u222E": "\\oint",
  "\u222F": "\\oiint",
  "\u2230": "\\oiiint"
};
defineFunction({
  type: "op",
  names: ["\\arcsin", "\\arccos", "\\arctan", "\\arctg", "\\arcctg", "\\arg", "\\ch", "\\cos", "\\cosec", "\\cosh", "\\cot", "\\cotg", "\\coth", "\\csc", "\\ctg", "\\cth", "\\deg", "\\dim", "\\exp", "\\hom", "\\ker", "\\lg", "\\ln", "\\log", "\\sec", "\\sin", "\\sinh", "\\sh", "\\tan", "\\tanh", "\\tg", "\\th"],
  props: {
    numArgs: 0
  },
  handler(_ref3) {
    var {
      parser,
      funcName
    } = _ref3;
    return {
      type: "op",
      mode: parser.mode,
      limits: false,
      parentIsSupSub: false,
      symbol: false,
      name: funcName
    };
  },
  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
});
defineFunction({
  type: "op",
  names: ["\\det", "\\gcd", "\\inf", "\\lim", "\\max", "\\min", "\\Pr", "\\sup"],
  props: {
    numArgs: 0
  },
  handler(_ref4) {
    var {
      parser,
      funcName
    } = _ref4;
    return {
      type: "op",
      mode: parser.mode,
      limits: true,
      parentIsSupSub: false,
      symbol: false,
      name: funcName
    };
  },
  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
});
defineFunction({
  type: "op",
  names: ["\\int", "\\iint", "\\iiint", "\\oint", "\\oiint", "\\oiiint", "\u222B", "\u222C", "\u222D", "\u222E", "\u222F", "\u2230"],
  props: {
    numArgs: 0,
    allowedInArgument: true
  },
  handler(_ref5) {
    var {
      parser,
      funcName
    } = _ref5;
    var fName = funcName;
    if (fName.length === 1) {
      fName = singleCharIntegrals[fName];
    }
    return {
      type: "op",
      mode: parser.mode,
      limits: false,
      parentIsSupSub: false,
      symbol: true,
      name: fName
    };
  },
  htmlBuilder: htmlBuilder$2,
  mathmlBuilder: mathmlBuilder$1
});
var htmlBuilder$1 = (grp, options) => {
  var supGroup;
  var subGroup;
  var hasLimits = false;
  var group;
  if (grp.type === "supsub") {
    supGroup = grp.sup;
    subGroup = grp.sub;
    group = assertNodeType(grp.base, "operatorname");
    hasLimits = true;
  } else {
    group = assertNodeType(grp, "operatorname");
  }
  var base;
  if (group.body.length > 0) {
    var body = group.body.map((child2) => {
      var childText = "text" in child2 ? child2.text : void 0;
      if (typeof childText === "string") {
        return {
          type: "textord",
          mode: child2.mode,
          text: childText
        };
      } else {
        return child2;
      }
    });
    var expression = buildExpression$1(body, options.withFont("mathrm"), true);
    for (var i4 = 0; i4 < expression.length; i4++) {
      var child = expression[i4];
      if (child instanceof SymbolNode) {
        child.text = child.text.replace(/\u2212/, "-").replace(/\u2217/, "*");
      }
    }
    base = makeSpan(["mop"], expression, options);
  } else {
    base = makeSpan(["mop"], [], options);
  }
  if (hasLimits) {
    return assembleSupSub(base, supGroup, subGroup, options, options.style, 0, 0);
  } else {
    return base;
  }
};
var mathmlBuilder2 = (group, options) => {
  var expression = buildExpression2(group.body, options.withFont("mathrm"));
  var isAllString = true;
  for (var i4 = 0; i4 < expression.length; i4++) {
    var node = expression[i4];
    if (node instanceof SpaceNode) ;
    else if (node instanceof MathNode) {
      switch (node.type) {
        case "mi":
        case "mn":
        case "mspace":
        case "mtext":
          break;
        // Do nothing yet.
        case "mo": {
          var child = node.children[0];
          if (node.children.length === 1 && child instanceof TextNode) {
            child.text = child.text.replace(/\u2212/, "-").replace(/\u2217/, "*");
          } else {
            isAllString = false;
          }
          break;
        }
        default:
          isAllString = false;
      }
    } else {
      isAllString = false;
    }
  }
  if (isAllString) {
    var word = expression.map((node2) => node2.toText()).join("");
    expression = [new TextNode(word)];
  }
  var identifier = new MathNode("mi", expression);
  identifier.setAttribute("mathvariant", "normal");
  var operator = new MathNode("mo", [makeText("\u2061", "text")]);
  if (group.parentIsSupSub) {
    return new MathNode("mrow", [identifier, operator]);
  } else {
    return newDocumentFragment([identifier, operator]);
  }
};
defineFunction({
  type: "operatorname",
  names: ["\\operatorname@", "\\operatornamewithlimits"],
  props: {
    numArgs: 1
  },
  handler: (_ref, args) => {
    var {
      parser,
      funcName
    } = _ref;
    var body = args[0];
    return {
      type: "operatorname",
      mode: parser.mode,
      body: ordargument(body),
      alwaysHandleSupSub: funcName === "\\operatornamewithlimits",
      limits: false,
      parentIsSupSub: false
    };
  },
  htmlBuilder: htmlBuilder$1,
  mathmlBuilder: mathmlBuilder2
});
defineMacro("\\operatorname", "\\@ifstar\\operatornamewithlimits\\operatorname@");
defineFunctionBuilders({
  type: "ordgroup",
  htmlBuilder(group, options) {
    if (group.semisimple) {
      return makeFragment(buildExpression$1(group.body, options, false));
    }
    return makeSpan(["mord"], buildExpression$1(group.body, options, true), options);
  },
  mathmlBuilder(group, options) {
    return buildExpressionRow(group.body, options, true);
  }
});
defineFunction({
  type: "overline",
  names: ["\\overline"],
  props: {
    numArgs: 1
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    var body = args[0];
    return {
      type: "overline",
      mode: parser.mode,
      body
    };
  },
  htmlBuilder(group, options) {
    var innerGroup = buildGroup$1(group.body, options.havingCrampedStyle());
    var line = makeLineSpan("overline-line", options);
    var defaultRuleThickness = options.fontMetrics().defaultRuleThickness;
    var vlist = makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: innerGroup
      }, {
        type: "kern",
        size: 3 * defaultRuleThickness
      }, {
        type: "elem",
        elem: line
      }, {
        type: "kern",
        size: defaultRuleThickness
      }]
    });
    return makeSpan(["mord", "overline"], [vlist], options);
  },
  mathmlBuilder(group, options) {
    var operator = new MathNode("mo", [new TextNode("\u203E")]);
    operator.setAttribute("stretchy", "true");
    var node = new MathNode("mover", [buildGroup2(group.body, options), operator]);
    node.setAttribute("accent", "true");
    return node;
  }
});
defineFunction({
  type: "phantom",
  names: ["\\phantom"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      parser
    } = _ref;
    var body = args[0];
    return {
      type: "phantom",
      mode: parser.mode,
      body: ordargument(body)
    };
  },
  htmlBuilder: (group, options) => {
    var elements = buildExpression$1(group.body, options.withPhantom(), false);
    return makeFragment(elements);
  },
  mathmlBuilder: (group, options) => {
    var inner2 = buildExpression2(group.body, options);
    return new MathNode("mphantom", inner2);
  }
});
defineMacro("\\hphantom", "\\smash{\\phantom{#1}}");
defineFunction({
  type: "vphantom",
  names: ["\\vphantom"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler: (_ref2, args) => {
    var {
      parser
    } = _ref2;
    var body = args[0];
    return {
      type: "vphantom",
      mode: parser.mode,
      body
    };
  },
  htmlBuilder: (group, options) => {
    var inner2 = makeSpan(["inner"], [buildGroup$1(group.body, options.withPhantom())]);
    var fix = makeSpan(["fix"], []);
    return makeSpan(["mord", "rlap"], [inner2, fix], options);
  },
  mathmlBuilder: (group, options) => {
    var inner2 = buildExpression2(ordargument(group.body), options);
    var phantom = new MathNode("mphantom", inner2);
    var node = new MathNode("mpadded", [phantom]);
    node.setAttribute("width", "0px");
    return node;
  }
});
defineFunction({
  type: "raisebox",
  names: ["\\raisebox"],
  props: {
    numArgs: 2,
    argTypes: ["size", "hbox"],
    allowedInText: true
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    var amount = assertNodeType(args[0], "size").value;
    var body = args[1];
    return {
      type: "raisebox",
      mode: parser.mode,
      dy: amount,
      body
    };
  },
  htmlBuilder(group, options) {
    var body = buildGroup$1(group.body, options);
    var dy = calculateSize(group.dy, options);
    return makeVList({
      positionType: "shift",
      positionData: -dy,
      children: [{
        type: "elem",
        elem: body
      }]
    });
  },
  mathmlBuilder(group, options) {
    var node = new MathNode("mpadded", [buildGroup2(group.body, options)]);
    var dy = group.dy.number + group.dy.unit;
    node.setAttribute("voffset", dy);
    return node;
  }
});
defineFunction({
  type: "internal",
  names: ["\\relax"],
  props: {
    numArgs: 0,
    allowedInText: true,
    allowedInArgument: true
  },
  handler(_ref) {
    var {
      parser
    } = _ref;
    return {
      type: "internal",
      mode: parser.mode
    };
  }
});
defineFunction({
  type: "rule",
  names: ["\\rule"],
  props: {
    numArgs: 2,
    numOptionalArgs: 1,
    allowedInText: true,
    allowedInMath: true,
    argTypes: ["size", "size", "size"]
  },
  handler(_ref, args, optArgs) {
    var {
      parser
    } = _ref;
    var shift = optArgs[0];
    var width = assertNodeType(args[0], "size");
    var height = assertNodeType(args[1], "size");
    return {
      type: "rule",
      mode: parser.mode,
      shift: shift && assertNodeType(shift, "size").value,
      width: width.value,
      height: height.value
    };
  },
  htmlBuilder(group, options) {
    var rule = makeSpan(["mord", "rule"], [], options);
    var width = calculateSize(group.width, options);
    var height = calculateSize(group.height, options);
    var shift = group.shift ? calculateSize(group.shift, options) : 0;
    rule.style.borderRightWidth = makeEm(width);
    rule.style.borderTopWidth = makeEm(height);
    rule.style.bottom = makeEm(shift);
    rule.width = width;
    rule.height = height + shift;
    rule.depth = -shift;
    rule.maxFontSize = height * 1.125 * options.sizeMultiplier;
    return rule;
  },
  mathmlBuilder(group, options) {
    var width = calculateSize(group.width, options);
    var height = calculateSize(group.height, options);
    var shift = group.shift ? calculateSize(group.shift, options) : 0;
    var color = options.color && options.getColor() || "black";
    var rule = new MathNode("mspace");
    rule.setAttribute("mathbackground", color);
    rule.setAttribute("width", makeEm(width));
    rule.setAttribute("height", makeEm(height));
    var wrapper = new MathNode("mpadded", [rule]);
    if (shift >= 0) {
      wrapper.setAttribute("height", makeEm(shift));
    } else {
      wrapper.setAttribute("height", makeEm(shift));
      wrapper.setAttribute("depth", makeEm(-shift));
    }
    wrapper.setAttribute("voffset", makeEm(shift));
    return wrapper;
  }
});
function sizingGroup(value, options, baseOptions) {
  var inner2 = buildExpression$1(value, options, false);
  var multiplier = options.sizeMultiplier / baseOptions.sizeMultiplier;
  for (var i4 = 0; i4 < inner2.length; i4++) {
    var pos = inner2[i4].classes.indexOf("sizing");
    if (pos < 0) {
      Array.prototype.push.apply(inner2[i4].classes, options.sizingClasses(baseOptions));
    } else if (inner2[i4].classes[pos + 1] === "reset-size" + options.size) {
      inner2[i4].classes[pos + 1] = "reset-size" + baseOptions.size;
    }
    inner2[i4].height *= multiplier;
    inner2[i4].depth *= multiplier;
  }
  return makeFragment(inner2);
}
var sizeFuncs = ["\\tiny", "\\sixptsize", "\\scriptsize", "\\footnotesize", "\\small", "\\normalsize", "\\large", "\\Large", "\\LARGE", "\\huge", "\\Huge"];
var htmlBuilder2 = (group, options) => {
  var newOptions = options.havingSize(group.size);
  return sizingGroup(group.body, newOptions, options);
};
defineFunction({
  type: "sizing",
  names: sizeFuncs,
  props: {
    numArgs: 0,
    allowedInText: true
  },
  handler: (_ref, args) => {
    var {
      breakOnTokenText,
      funcName,
      parser
    } = _ref;
    var body = parser.parseExpression(false, breakOnTokenText);
    return {
      type: "sizing",
      mode: parser.mode,
      // Figure out what size to use based on the list of functions above
      size: sizeFuncs.indexOf(funcName) + 1,
      body
    };
  },
  htmlBuilder: htmlBuilder2,
  mathmlBuilder: (group, options) => {
    var newOptions = options.havingSize(group.size);
    var inner2 = buildExpression2(group.body, newOptions);
    var node = new MathNode("mstyle", inner2);
    node.setAttribute("mathsize", makeEm(newOptions.sizeMultiplier));
    return node;
  }
});
defineFunction({
  type: "smash",
  names: ["\\smash"],
  props: {
    numArgs: 1,
    numOptionalArgs: 1,
    allowedInText: true
  },
  handler: (_ref, args, optArgs) => {
    var {
      parser
    } = _ref;
    var smashHeight = false;
    var smashDepth = false;
    var tbArg = optArgs[0] && assertNodeType(optArgs[0], "ordgroup");
    if (tbArg) {
      var letter;
      for (var i4 = 0; i4 < tbArg.body.length; ++i4) {
        var node = tbArg.body[i4];
        letter = assertSymbolNodeType(node).text;
        if (letter === "t") {
          smashHeight = true;
        } else if (letter === "b") {
          smashDepth = true;
        } else {
          smashHeight = false;
          smashDepth = false;
          break;
        }
      }
    } else {
      smashHeight = true;
      smashDepth = true;
    }
    var body = args[0];
    return {
      type: "smash",
      mode: parser.mode,
      body,
      smashHeight,
      smashDepth
    };
  },
  htmlBuilder: (group, options) => {
    var node = makeSpan([], [buildGroup$1(group.body, options)]);
    if (!group.smashHeight && !group.smashDepth) {
      return node;
    }
    if (group.smashHeight) {
      node.height = 0;
    }
    if (group.smashDepth) {
      node.depth = 0;
    }
    if (group.smashHeight && group.smashDepth) {
      return makeSpan(["mord", "smash"], [node], options);
    }
    if (node.children) {
      for (var i4 = 0; i4 < node.children.length; i4++) {
        if (group.smashHeight) {
          node.children[i4].height = 0;
        }
        if (group.smashDepth) {
          node.children[i4].depth = 0;
        }
      }
    }
    var smashedNode = makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: node
      }]
    });
    return makeSpan(["mord"], [smashedNode], options);
  },
  mathmlBuilder: (group, options) => {
    var node = new MathNode("mpadded", [buildGroup2(group.body, options)]);
    if (group.smashHeight) {
      node.setAttribute("height", "0px");
    }
    if (group.smashDepth) {
      node.setAttribute("depth", "0px");
    }
    return node;
  }
});
defineFunction({
  type: "sqrt",
  names: ["\\sqrt"],
  props: {
    numArgs: 1,
    numOptionalArgs: 1
  },
  handler(_ref, args, optArgs) {
    var {
      parser
    } = _ref;
    var index = optArgs[0];
    var body = args[0];
    return {
      type: "sqrt",
      mode: parser.mode,
      body,
      index
    };
  },
  htmlBuilder(group, options) {
    var inner2 = buildGroup$1(group.body, options.havingCrampedStyle());
    if (inner2.height === 0) {
      inner2.height = options.fontMetrics().xHeight;
    }
    inner2 = wrapFragment(inner2, options);
    var metrics = options.fontMetrics();
    var theta = metrics.defaultRuleThickness;
    var phi = theta;
    if (options.style.id < Style$1.TEXT.id) {
      phi = options.fontMetrics().xHeight;
    }
    var lineClearance = theta + phi / 4;
    var minDelimiterHeight = inner2.height + inner2.depth + lineClearance + theta;
    var {
      span: img,
      ruleWidth,
      advanceWidth
    } = makeSqrtImage(minDelimiterHeight, options);
    var delimDepth = img.height - ruleWidth;
    if (delimDepth > inner2.height + inner2.depth + lineClearance) {
      lineClearance = (lineClearance + delimDepth - inner2.height - inner2.depth) / 2;
    }
    var imgShift = img.height - inner2.height - lineClearance - ruleWidth;
    inner2.style.paddingLeft = makeEm(advanceWidth);
    var body = makeVList({
      positionType: "firstBaseline",
      children: [{
        type: "elem",
        elem: inner2,
        wrapperClasses: ["svg-align"]
      }, {
        type: "kern",
        size: -(inner2.height + imgShift)
      }, {
        type: "elem",
        elem: img
      }, {
        type: "kern",
        size: ruleWidth
      }]
    });
    if (!group.index) {
      return makeSpan(["mord", "sqrt"], [body], options);
    } else {
      var newOptions = options.havingStyle(Style$1.SCRIPTSCRIPT);
      var rootm = buildGroup$1(group.index, newOptions, options);
      var toShift = 0.6 * (body.height - body.depth);
      var rootVList = makeVList({
        positionType: "shift",
        positionData: -toShift,
        children: [{
          type: "elem",
          elem: rootm
        }]
      });
      var rootVListWrap = makeSpan(["root"], [rootVList]);
      return makeSpan(["mord", "sqrt"], [rootVListWrap, body], options);
    }
  },
  mathmlBuilder(group, options) {
    var {
      body,
      index
    } = group;
    return index ? new MathNode("mroot", [buildGroup2(body, options), buildGroup2(index, options)]) : new MathNode("msqrt", [buildGroup2(body, options)]);
  }
});
var styleMap = {
  "display": Style$1.DISPLAY,
  "text": Style$1.TEXT,
  "script": Style$1.SCRIPT,
  "scriptscript": Style$1.SCRIPTSCRIPT
};
function isStyleStr(s2) {
  return s2 in styleMap;
}
defineFunction({
  type: "styling",
  names: ["\\displaystyle", "\\textstyle", "\\scriptstyle", "\\scriptscriptstyle"],
  props: {
    numArgs: 0,
    allowedInText: true,
    primitive: true
  },
  handler(_ref, args) {
    var {
      breakOnTokenText,
      funcName,
      parser
    } = _ref;
    var body = parser.parseExpression(true, breakOnTokenText);
    var style = funcName.slice(1, funcName.length - 5);
    if (!isStyleStr(style)) {
      throw new Error("Unknown style: " + style);
    }
    return {
      type: "styling",
      mode: parser.mode,
      // Figure out what style to use by pulling out the style from
      // the function name
      style,
      body
    };
  },
  htmlBuilder(group, options) {
    var newStyle = styleMap[group.style];
    var newOptions = options.havingStyle(newStyle);
    if (group.resetFont) {
      newOptions = newOptions.withFont("");
    }
    return sizingGroup(group.body, newOptions, options);
  },
  mathmlBuilder(group, options) {
    var newStyle = styleMap[group.style];
    var newOptions = options.havingStyle(newStyle);
    if (group.resetFont) {
      newOptions = newOptions.withFont("");
    }
    var inner2 = buildExpression2(group.body, newOptions);
    var node = new MathNode("mstyle", inner2);
    var styleAttributes = {
      "display": ["0", "true"],
      "text": ["0", "false"],
      "script": ["1", "false"],
      "scriptscript": ["2", "false"]
    };
    var attr = styleAttributes[group.style];
    node.setAttribute("scriptlevel", attr[0]);
    node.setAttribute("displaystyle", attr[1]);
    return node;
  }
});
var htmlBuilderDelegate = function htmlBuilderDelegate2(group, options) {
  var base = group.base;
  if (!base) {
    return null;
  } else if (base.type === "op") {
    var delegate = base.limits && (options.style.size === Style$1.DISPLAY.size || base.alwaysHandleSupSub);
    return delegate ? htmlBuilder$2 : null;
  } else if (base.type === "operatorname") {
    var _delegate = base.alwaysHandleSupSub && (options.style.size === Style$1.DISPLAY.size || base.limits);
    return _delegate ? htmlBuilder$1 : null;
  } else if (base.type === "accent") {
    return isCharacterBox(base.base) ? htmlBuilder$a : null;
  } else if (base.type === "horizBrace") {
    var isSup = !group.sub;
    return isSup === base.isOver ? htmlBuilder$3 : null;
  } else {
    return null;
  }
};
defineFunctionBuilders({
  type: "supsub",
  htmlBuilder(group, options) {
    var builderDelegate = htmlBuilderDelegate(group, options);
    if (builderDelegate) {
      return builderDelegate(group, options);
    }
    var {
      base: valueBase,
      sup: valueSup,
      sub: valueSub
    } = group;
    var base = buildGroup$1(valueBase, options);
    var supm;
    var subm;
    var metrics = options.fontMetrics();
    var supShift = 0;
    var subShift = 0;
    var isCharBox = valueBase && isCharacterBox(valueBase);
    if (valueSup) {
      var newOptions = options.havingStyle(options.style.sup());
      supm = buildGroup$1(valueSup, newOptions, options);
      if (!isCharBox) {
        supShift = base.height - newOptions.fontMetrics().supDrop * newOptions.sizeMultiplier / options.sizeMultiplier;
      }
    }
    if (valueSub) {
      var _newOptions = options.havingStyle(options.style.sub());
      subm = buildGroup$1(valueSub, _newOptions, options);
      if (!isCharBox) {
        subShift = base.depth + _newOptions.fontMetrics().subDrop * _newOptions.sizeMultiplier / options.sizeMultiplier;
      }
    }
    var minSupShift;
    if (options.style === Style$1.DISPLAY) {
      minSupShift = metrics.sup1;
    } else if (options.style.cramped) {
      minSupShift = metrics.sup3;
    } else {
      minSupShift = metrics.sup2;
    }
    var multiplier = options.sizeMultiplier;
    var marginRight = makeEm(0.5 / metrics.ptPerEm / multiplier);
    var marginLeft = null;
    if (subm) {
      var isOiint = group.base && group.base.type === "op" && group.base.name && (group.base.name === "\\oiint" || group.base.name === "\\oiiint");
      if (base instanceof SymbolNode || isOiint) {
        var _base$italic;
        marginLeft = makeEm(-((_base$italic = base.italic) != null ? _base$italic : 0));
      }
    }
    var supsub;
    if (supm && subm) {
      supShift = Math.max(supShift, minSupShift, supm.depth + 0.25 * metrics.xHeight);
      subShift = Math.max(subShift, metrics.sub2);
      var ruleWidth = metrics.defaultRuleThickness;
      var maxWidth = 4 * ruleWidth;
      if (supShift - supm.depth - (subm.height - subShift) < maxWidth) {
        subShift = maxWidth - (supShift - supm.depth) + subm.height;
        var psi = 0.8 * metrics.xHeight - (supShift - supm.depth);
        if (psi > 0) {
          supShift += psi;
          subShift -= psi;
        }
      }
      var vlistElem = [{
        type: "elem",
        elem: subm,
        shift: subShift,
        marginRight,
        marginLeft
      }, {
        type: "elem",
        elem: supm,
        shift: -supShift,
        marginRight
      }];
      supsub = makeVList({
        positionType: "individualShift",
        children: vlistElem
      });
    } else if (subm) {
      subShift = Math.max(subShift, metrics.sub1, subm.height - 0.8 * metrics.xHeight);
      var _vlistElem = [{
        type: "elem",
        elem: subm,
        marginLeft,
        marginRight
      }];
      supsub = makeVList({
        positionType: "shift",
        positionData: subShift,
        children: _vlistElem
      });
    } else if (supm) {
      supShift = Math.max(supShift, minSupShift, supm.depth + 0.25 * metrics.xHeight);
      supsub = makeVList({
        positionType: "shift",
        positionData: -supShift,
        children: [{
          type: "elem",
          elem: supm,
          marginRight
        }]
      });
    } else {
      throw new Error("supsub must have either sup or sub.");
    }
    var mclass = getTypeOfDomTree(base, "right") || "mord";
    return makeSpan([mclass], [base, makeSpan(["msupsub"], [supsub])], options);
  },
  mathmlBuilder(group, options) {
    var isBrace = false;
    var isOver;
    var isSup;
    if (group.base && group.base.type === "horizBrace") {
      isSup = !!group.sup;
      if (isSup === group.base.isOver) {
        isBrace = true;
        isOver = group.base.isOver;
      }
    }
    if (group.base && (group.base.type === "op" || group.base.type === "operatorname")) {
      group.base.parentIsSupSub = true;
    }
    var children = [buildGroup2(group.base, options)];
    if (group.sub) {
      children.push(buildGroup2(group.sub, options));
    }
    if (group.sup) {
      children.push(buildGroup2(group.sup, options));
    }
    var nodeType;
    if (isBrace) {
      nodeType = isOver ? "mover" : "munder";
    } else if (!group.sub) {
      var base = group.base;
      if (base && base.type === "op" && base.limits && (options.style === Style$1.DISPLAY || base.alwaysHandleSupSub)) {
        nodeType = "mover";
      } else if (base && base.type === "operatorname" && base.alwaysHandleSupSub && (base.limits || options.style === Style$1.DISPLAY)) {
        nodeType = "mover";
      } else {
        nodeType = "msup";
      }
    } else if (!group.sup) {
      var _base = group.base;
      if (_base && _base.type === "op" && _base.limits && (options.style === Style$1.DISPLAY || _base.alwaysHandleSupSub)) {
        nodeType = "munder";
      } else if (_base && _base.type === "operatorname" && _base.alwaysHandleSupSub && (_base.limits || options.style === Style$1.DISPLAY)) {
        nodeType = "munder";
      } else {
        nodeType = "msub";
      }
    } else {
      var _base2 = group.base;
      if (_base2 && _base2.type === "op" && _base2.limits && options.style === Style$1.DISPLAY) {
        nodeType = "munderover";
      } else if (_base2 && _base2.type === "operatorname" && _base2.alwaysHandleSupSub && (options.style === Style$1.DISPLAY || _base2.limits)) {
        nodeType = "munderover";
      } else {
        nodeType = "msubsup";
      }
    }
    return new MathNode(nodeType, children);
  }
});
defineFunctionBuilders({
  type: "atom",
  htmlBuilder(group, options) {
    return mathsym(group.text, group.mode, options, ["m" + group.family]);
  },
  mathmlBuilder(group, options) {
    var node = new MathNode("mo", [makeText(group.text, group.mode)]);
    if (group.family === "bin") {
      var variant = getVariant(group, options);
      if (variant === "bold-italic") {
        node.setAttribute("mathvariant", variant);
      }
    } else if (group.family === "punct") {
      node.setAttribute("separator", "true");
    } else if (group.family === "open" || group.family === "close") {
      node.setAttribute("stretchy", "false");
    }
    return node;
  }
});
var defaultVariant = {
  "mi": "italic",
  "mn": "normal",
  "mtext": "normal"
};
defineFunctionBuilders({
  type: "mathord",
  htmlBuilder(group, options) {
    return makeOrd(group, options, "mathord");
  },
  mathmlBuilder(group, options) {
    var node = new MathNode("mi", [makeText(group.text, group.mode, options)]);
    var variant = getVariant(group, options) || "italic";
    if (variant !== defaultVariant[node.type]) {
      node.setAttribute("mathvariant", variant);
    }
    return node;
  }
});
defineFunctionBuilders({
  type: "textord",
  htmlBuilder(group, options) {
    return makeOrd(group, options, "textord");
  },
  mathmlBuilder(group, options) {
    var text2 = makeText(group.text, group.mode, options);
    var variant = getVariant(group, options) || "normal";
    var node;
    if (group.mode === "text") {
      node = new MathNode("mtext", [text2]);
    } else if (/[0-9]/.test(group.text)) {
      node = new MathNode("mn", [text2]);
    } else if (group.text === "\\prime") {
      node = new MathNode("mo", [text2]);
    } else {
      node = new MathNode("mi", [text2]);
    }
    if (variant !== defaultVariant[node.type]) {
      node.setAttribute("mathvariant", variant);
    }
    return node;
  }
});
var cssSpace = {
  "\\nobreak": "nobreak",
  "\\allowbreak": "allowbreak"
};
var regularSpace = {
  " ": {},
  "\\ ": {},
  "~": {
    className: "nobreak"
  },
  "\\space": {},
  "\\nobreakspace": {
    className: "nobreak"
  }
};
defineFunctionBuilders({
  type: "spacing",
  htmlBuilder(group, options) {
    if (regularSpace.hasOwnProperty(group.text)) {
      var className = regularSpace[group.text].className || "";
      if (group.mode === "text") {
        var ord = makeOrd(group, options, "textord");
        ord.classes.push(className);
        return ord;
      } else {
        return makeSpan(["mspace", className], [mathsym(group.text, group.mode, options)], options);
      }
    } else if (cssSpace.hasOwnProperty(group.text)) {
      return makeSpan(["mspace", cssSpace[group.text]], [], options);
    } else {
      throw new ParseError('Unknown type of space "' + group.text + '"');
    }
  },
  mathmlBuilder(group, options) {
    var node;
    if (regularSpace.hasOwnProperty(group.text)) {
      node = new MathNode("mtext", [new TextNode("\xA0")]);
    } else if (cssSpace.hasOwnProperty(group.text)) {
      return new MathNode("mspace");
    } else {
      throw new ParseError('Unknown type of space "' + group.text + '"');
    }
    return node;
  }
});
var pad2 = () => {
  var padNode = new MathNode("mtd", []);
  padNode.setAttribute("width", "50%");
  return padNode;
};
defineFunctionBuilders({
  type: "tag",
  mathmlBuilder(group, options) {
    var table = new MathNode("mtable", [new MathNode("mtr", [pad2(), new MathNode("mtd", [buildExpressionRow(group.body, options)]), pad2(), new MathNode("mtd", [buildExpressionRow(group.tag, options)])])]);
    table.setAttribute("width", "100%");
    return table;
  }
});
var textFontFamilies = {
  "\\text": void 0,
  "\\textrm": "textrm",
  "\\textsf": "textsf",
  "\\texttt": "texttt",
  "\\textnormal": "textrm"
};
var textFontWeights = {
  "\\textbf": "textbf",
  "\\textmd": "textmd"
};
var textFontShapes = {
  "\\textit": "textit",
  "\\textup": "textup"
};
var optionsWithFont = (group, options) => {
  var font = group.font;
  if (!font) {
    return options;
  } else if (textFontFamilies[font]) {
    return options.withTextFontFamily(textFontFamilies[font]);
  } else if (textFontWeights[font]) {
    return options.withTextFontWeight(textFontWeights[font]);
  } else if (font === "\\emph") {
    return options.fontShape === "textit" ? options.withTextFontShape("textup") : options.withTextFontShape("textit");
  }
  return options.withTextFontShape(textFontShapes[font]);
};
defineFunction({
  type: "text",
  names: [
    // Font families
    "\\text",
    "\\textrm",
    "\\textsf",
    "\\texttt",
    "\\textnormal",
    // Font weights
    "\\textbf",
    "\\textmd",
    // Font Shapes
    "\\textit",
    "\\textup",
    "\\emph"
  ],
  props: {
    numArgs: 1,
    argTypes: ["text"],
    allowedInArgument: true,
    allowedInText: true
  },
  handler(_ref, args) {
    var {
      parser,
      funcName
    } = _ref;
    var body = args[0];
    return {
      type: "text",
      mode: parser.mode,
      body: ordargument(body),
      font: funcName
    };
  },
  htmlBuilder(group, options) {
    var newOptions = optionsWithFont(group, options);
    var inner2 = buildExpression$1(group.body, newOptions, true);
    return makeSpan(["mord", "text"], inner2, newOptions);
  },
  mathmlBuilder(group, options) {
    var newOptions = optionsWithFont(group, options);
    return buildExpressionRow(group.body, newOptions);
  }
});
defineFunction({
  type: "underline",
  names: ["\\underline"],
  props: {
    numArgs: 1,
    allowedInText: true
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    return {
      type: "underline",
      mode: parser.mode,
      body: args[0]
    };
  },
  htmlBuilder(group, options) {
    var innerGroup = buildGroup$1(group.body, options);
    var line = makeLineSpan("underline-line", options);
    var defaultRuleThickness = options.fontMetrics().defaultRuleThickness;
    var vlist = makeVList({
      positionType: "top",
      positionData: innerGroup.height,
      children: [{
        type: "kern",
        size: defaultRuleThickness
      }, {
        type: "elem",
        elem: line
      }, {
        type: "kern",
        size: 3 * defaultRuleThickness
      }, {
        type: "elem",
        elem: innerGroup
      }]
    });
    return makeSpan(["mord", "underline"], [vlist], options);
  },
  mathmlBuilder(group, options) {
    var operator = new MathNode("mo", [new TextNode("\u203E")]);
    operator.setAttribute("stretchy", "true");
    var node = new MathNode("munder", [buildGroup2(group.body, options), operator]);
    node.setAttribute("accentunder", "true");
    return node;
  }
});
defineFunction({
  type: "vcenter",
  names: ["\\vcenter"],
  props: {
    numArgs: 1,
    argTypes: ["original"],
    // In LaTeX, \vcenter can act only on a box.
    allowedInText: false
  },
  handler(_ref, args) {
    var {
      parser
    } = _ref;
    return {
      type: "vcenter",
      mode: parser.mode,
      body: args[0]
    };
  },
  htmlBuilder(group, options) {
    var body = buildGroup$1(group.body, options);
    var axisHeight = options.fontMetrics().axisHeight;
    var dy = 0.5 * (body.height - axisHeight - (body.depth + axisHeight));
    return makeVList({
      positionType: "shift",
      positionData: dy,
      children: [{
        type: "elem",
        elem: body
      }]
    });
  },
  mathmlBuilder(group, options) {
    var mpadded = new MathNode("mpadded", [buildGroup2(group.body, options)], ["vcenter"]);
    return new MathNode("mrow", [mpadded]);
  }
});
defineFunction({
  type: "verb",
  names: ["\\verb"],
  props: {
    numArgs: 0,
    allowedInText: true
  },
  handler(context, args, optArgs) {
    throw new ParseError("\\verb ended by end of line instead of matching delimiter");
  },
  htmlBuilder(group, options) {
    var text2 = makeVerb(group);
    var body = [];
    var newOptions = options.havingStyle(options.style.text());
    for (var i4 = 0; i4 < text2.length; i4++) {
      var c3 = text2[i4];
      if (c3 === "~") {
        c3 = "\\textasciitilde";
      }
      body.push(makeSymbol(c3, "Typewriter-Regular", group.mode, newOptions, ["mord", "texttt"]));
    }
    return makeSpan(["mord", "text"].concat(newOptions.sizingClasses(options)), tryCombineChars(body), newOptions);
  },
  mathmlBuilder(group, options) {
    var text2 = new TextNode(makeVerb(group));
    var node = new MathNode("mtext", [text2]);
    node.setAttribute("mathvariant", "monospace");
    return node;
  }
});
var makeVerb = (group) => group.body.replace(/ /g, group.star ? "\u2423" : "\xA0");
var functions = _functions;
var spaceRegexString = "[ \r\n	]";
var controlWordRegexString = "\\\\[a-zA-Z@]+";
var controlSymbolRegexString = "\\\\[^\uD800-\uDFFF]";
var controlWordWhitespaceRegexString = "(" + controlWordRegexString + ")" + spaceRegexString + "*";
var controlSpaceRegexString = "\\\\(\n|[ \r	]+\n?)[ \r	]*";
var combiningDiacriticalMarkString = "[\u0300-\u036F]";
var combiningDiacriticalMarksEndRegex = new RegExp(combiningDiacriticalMarkString + "+$");
var tokenRegexString = "(" + spaceRegexString + "+)|" + // whitespace
(controlSpaceRegexString + "|") + // \whitespace
"([!-\\[\\]-\u2027\u202A-\uD7FF\uF900-\uFFFF]" + // single codepoint
(combiningDiacriticalMarkString + "*") + // ...plus accents
"|[\uD800-\uDBFF][\uDC00-\uDFFF]" + // surrogate pair
(combiningDiacriticalMarkString + "*") + // ...plus accents
"|\\\\verb\\*([^]).*?\\4|\\\\verb([^*a-zA-Z]).*?\\5" + // \verb unstarred
("|" + controlWordWhitespaceRegexString) + // \macroName + spaces
("|" + controlSymbolRegexString + ")");
var Lexer = class {
  constructor(input, settings) {
    this.input = void 0;
    this.settings = void 0;
    this.tokenRegex = void 0;
    this.catcodes = void 0;
    this.input = input;
    this.settings = settings;
    this.tokenRegex = new RegExp(tokenRegexString, "g");
    this.catcodes = {
      "%": 14,
      // comment character
      "~": 13
      // active character
    };
  }
  setCatcode(char, code) {
    this.catcodes[char] = code;
  }
  /**
   * This function lexes a single token.
   */
  lex() {
    var input = this.input;
    var pos = this.tokenRegex.lastIndex;
    if (pos === input.length) {
      return new Token("EOF", new SourceLocation(this, pos, pos));
    }
    var match = this.tokenRegex.exec(input);
    if (match === null || match.index !== pos) {
      throw new ParseError("Unexpected character: '" + input[pos] + "'", new Token(input[pos], new SourceLocation(this, pos, pos + 1)));
    }
    var text2 = match[6] || match[3] || (match[2] ? "\\ " : " ");
    if (this.catcodes[text2] === 14) {
      var nlIndex = input.indexOf("\n", this.tokenRegex.lastIndex);
      if (nlIndex === -1) {
        this.tokenRegex.lastIndex = input.length;
        this.settings.reportNonstrict("commentAtEnd", "% comment has no terminating newline; LaTeX would fail because of commenting the end of math mode (e.g. $)");
      } else {
        this.tokenRegex.lastIndex = nlIndex + 1;
      }
      return this.lex();
    }
    return new Token(text2, new SourceLocation(this, pos, this.tokenRegex.lastIndex));
  }
};
var Namespace = class {
  /**
   * Both arguments are optional.  The first argument is an object of
   * built-in mappings which never change.  The second argument is an object
   * of initial (global-level) mappings, which will constantly change
   * according to any global/top-level `set`s done.
   */
  constructor(builtins, globalMacros) {
    if (builtins === void 0) {
      builtins = {};
    }
    if (globalMacros === void 0) {
      globalMacros = {};
    }
    this.current = void 0;
    this.builtins = void 0;
    this.undefStack = void 0;
    this.current = globalMacros;
    this.builtins = builtins;
    this.undefStack = [];
  }
  /**
   * Start a new nested group, affecting future local `set`s.
   */
  beginGroup() {
    this.undefStack.push({});
  }
  /**
   * End current nested group, restoring values before the group began.
   */
  endGroup() {
    if (this.undefStack.length === 0) {
      throw new ParseError("Unbalanced namespace destruction: attempt to pop global namespace; please report this as a bug");
    }
    var undefs = this.undefStack.pop();
    for (var undef in undefs) {
      if (undefs.hasOwnProperty(undef)) {
        if (undefs[undef] == null) {
          delete this.current[undef];
        } else {
          this.current[undef] = undefs[undef];
        }
      }
    }
  }
  /**
   * Ends all currently nested groups (if any), restoring values before the
   * groups began.  Useful in case of an error in the middle of parsing.
   */
  endGroups() {
    while (this.undefStack.length > 0) {
      this.endGroup();
    }
  }
  /**
   * Detect whether `name` has a definition.  Equivalent to
   * `get(name) != null`.
   */
  has(name2) {
    return this.current.hasOwnProperty(name2) || this.builtins.hasOwnProperty(name2);
  }
  /**
   * Get the current value of a name, or `undefined` if there is no value.
   *
   * Note: Do not use `if (namespace.get(...))` to detect whether a macro
   * is defined, as the definition may be the empty string which evaluates
   * to `false` in JavaScript.  Use `if (namespace.get(...) != null)` or
   * `if (namespace.has(...))`.
   */
  get(name2) {
    if (this.current.hasOwnProperty(name2)) {
      return this.current[name2];
    } else {
      return this.builtins[name2];
    }
  }
  /**
   * Set the current value of a name, and optionally set it globally too.
   * Local set() sets the current value and (when appropriate) adds an undo
   * operation to the undo stack.  Global set() may change the undo
   * operation at every level, so takes time linear in their number.
   * A value of undefined means to delete existing definitions.
   */
  set(name2, value, global) {
    if (global === void 0) {
      global = false;
    }
    if (global) {
      for (var i4 = 0; i4 < this.undefStack.length; i4++) {
        delete this.undefStack[i4][name2];
      }
      if (this.undefStack.length > 0) {
        this.undefStack[this.undefStack.length - 1][name2] = value;
      }
    } else {
      var top = this.undefStack[this.undefStack.length - 1];
      if (top && !top.hasOwnProperty(name2)) {
        top[name2] = this.current[name2];
      }
    }
    if (value == null) {
      delete this.current[name2];
    } else {
      this.current[name2] = value;
    }
  }
};
var macros = _macros;
defineMacro("\\noexpand", function(context) {
  var t3 = context.popToken();
  if (context.isExpandable(t3.text)) {
    t3.noexpand = true;
    t3.treatAsRelax = true;
  }
  return {
    tokens: [t3],
    numArgs: 0
  };
});
defineMacro("\\expandafter", function(context) {
  var t3 = context.popToken();
  context.expandOnce(true);
  return {
    tokens: [t3],
    numArgs: 0
  };
});
defineMacro("\\@firstoftwo", function(context) {
  var args = context.consumeArgs(2);
  return {
    tokens: args[0],
    numArgs: 0
  };
});
defineMacro("\\@secondoftwo", function(context) {
  var args = context.consumeArgs(2);
  return {
    tokens: args[1],
    numArgs: 0
  };
});
defineMacro("\\@ifnextchar", function(context) {
  var args = context.consumeArgs(3);
  context.consumeSpaces();
  var nextToken = context.future();
  if (args[0].length === 1 && args[0][0].text === nextToken.text) {
    return {
      tokens: args[1],
      numArgs: 0
    };
  } else {
    return {
      tokens: args[2],
      numArgs: 0
    };
  }
});
defineMacro("\\@ifstar", "\\@ifnextchar *{\\@firstoftwo{#1}}");
defineMacro("\\TextOrMath", function(context) {
  var args = context.consumeArgs(2);
  if (context.mode === "text") {
    return {
      tokens: args[0],
      numArgs: 0
    };
  } else {
    return {
      tokens: args[1],
      numArgs: 0
    };
  }
});
var digitToNumber = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "a": 10,
  "A": 10,
  "b": 11,
  "B": 11,
  "c": 12,
  "C": 12,
  "d": 13,
  "D": 13,
  "e": 14,
  "E": 14,
  "f": 15,
  "F": 15
};
defineMacro("\\char", function(context) {
  var token = context.popToken();
  var base;
  var number = 0;
  if (token.text === "'") {
    base = 8;
    token = context.popToken();
  } else if (token.text === '"') {
    base = 16;
    token = context.popToken();
  } else if (token.text === "`") {
    token = context.popToken();
    if (token.text[0] === "\\") {
      number = token.text.charCodeAt(1);
    } else if (token.text === "EOF") {
      throw new ParseError("\\char` missing argument");
    } else {
      number = token.text.charCodeAt(0);
    }
  } else {
    base = 10;
  }
  if (base) {
    number = digitToNumber[token.text];
    if (number == null || number >= base) {
      throw new ParseError("Invalid base-" + base + " digit " + token.text);
    }
    var digit;
    while ((digit = digitToNumber[context.future().text]) != null && digit < base) {
      number *= base;
      number += digit;
      context.popToken();
    }
  }
  return "\\@char{" + number + "}";
});
var newcommand = (context, existsOK, nonexistsOK, skipIfExists) => {
  var arg = context.consumeArg().tokens;
  if (arg.length !== 1) {
    throw new ParseError("\\newcommand's first argument must be a macro name");
  }
  var name2 = arg[0].text;
  var exists = context.isDefined(name2);
  if (exists && !existsOK) {
    throw new ParseError("\\newcommand{" + name2 + "} attempting to redefine " + (name2 + "; use \\renewcommand"));
  }
  if (!exists && !nonexistsOK) {
    throw new ParseError("\\renewcommand{" + name2 + "} when command " + name2 + " does not yet exist; use \\newcommand");
  }
  var numArgs = 0;
  arg = context.consumeArg().tokens;
  if (arg.length === 1 && arg[0].text === "[") {
    var argText = "";
    var token = context.expandNextToken();
    while (token.text !== "]" && token.text !== "EOF") {
      argText += token.text;
      token = context.expandNextToken();
    }
    if (!argText.match(/^\s*[0-9]+\s*$/)) {
      throw new ParseError("Invalid number of arguments: " + argText);
    }
    numArgs = parseInt(argText);
    arg = context.consumeArg().tokens;
  }
  if (!(exists && skipIfExists)) {
    context.macros.set(name2, {
      tokens: arg,
      numArgs
    });
  }
  return "";
};
defineMacro("\\newcommand", (context) => newcommand(context, false, true, false));
defineMacro("\\renewcommand", (context) => newcommand(context, true, false, false));
defineMacro("\\providecommand", (context) => newcommand(context, true, true, true));
defineMacro("\\message", (context) => {
  var arg = context.consumeArgs(1)[0];
  console.log(arg.reverse().map((token) => token.text).join(""));
  return "";
});
defineMacro("\\errmessage", (context) => {
  var arg = context.consumeArgs(1)[0];
  console.error(arg.reverse().map((token) => token.text).join(""));
  return "";
});
defineMacro("\\show", (context) => {
  var tok = context.popToken();
  var name2 = tok.text;
  console.log(tok, context.macros.get(name2), functions[name2], symbols2.math[name2], symbols2.text[name2]);
  return "";
});
defineMacro("\\bgroup", "{");
defineMacro("\\egroup", "}");
defineMacro("~", "\\nobreakspace");
defineMacro("\\lq", "`");
defineMacro("\\rq", "'");
defineMacro("\\aa", "\\r a");
defineMacro("\\AA", "\\r A");
defineMacro("\\textcopyright", "\\html@mathml{\\textcircled{c}}{\\char`\xA9}");
defineMacro("\\copyright", "\\TextOrMath{\\textcopyright}{\\text{\\textcopyright}}");
defineMacro("\\textregistered", "\\html@mathml{\\textcircled{\\scriptsize R}}{\\char`\xAE}");
defineMacro("\u212C", "\\mathscr{B}");
defineMacro("\u2130", "\\mathscr{E}");
defineMacro("\u2131", "\\mathscr{F}");
defineMacro("\u210B", "\\mathscr{H}");
defineMacro("\u2110", "\\mathscr{I}");
defineMacro("\u2112", "\\mathscr{L}");
defineMacro("\u2133", "\\mathscr{M}");
defineMacro("\u211B", "\\mathscr{R}");
defineMacro("\u212D", "\\mathfrak{C}");
defineMacro("\u210C", "\\mathfrak{H}");
defineMacro("\u2128", "\\mathfrak{Z}");
defineMacro("\\Bbbk", "\\Bbb{k}");
defineMacro("\\llap", "\\mathllap{\\textrm{#1}}");
defineMacro("\\rlap", "\\mathrlap{\\textrm{#1}}");
defineMacro("\\clap", "\\mathclap{\\textrm{#1}}");
defineMacro("\\mathstrut", "\\vphantom{(}");
defineMacro("\\underbar", "\\underline{\\text{#1}}");
defineMacro("\\not", '\\html@mathml{\\mathrel{\\mathrlap\\@not}\\nobreak}{\\char"338}');
defineMacro("\\neq", "\\html@mathml{\\mathrel{\\not=}}{\\mathrel{\\char`\u2260}}");
defineMacro("\\ne", "\\neq");
defineMacro("\u2260", "\\neq");
defineMacro("\\notin", "\\html@mathml{\\mathrel{{\\in}\\mathllap{/\\mskip1mu}}}{\\mathrel{\\char`\u2209}}");
defineMacro("\u2209", "\\notin");
defineMacro("\u2258", "\\html@mathml{\\mathrel{=\\kern{-1em}\\raisebox{0.4em}{$\\scriptsize\\frown$}}}{\\mathrel{\\char`\u2258}}");
defineMacro("\u2259", "\\html@mathml{\\stackrel{\\tiny\\wedge}{=}}{\\mathrel{\\char`\u2258}}");
defineMacro("\u225A", "\\html@mathml{\\stackrel{\\tiny\\vee}{=}}{\\mathrel{\\char`\u225A}}");
defineMacro("\u225B", "\\html@mathml{\\stackrel{\\scriptsize\\star}{=}}{\\mathrel{\\char`\u225B}}");
defineMacro("\u225D", "\\html@mathml{\\stackrel{\\tiny\\mathrm{def}}{=}}{\\mathrel{\\char`\u225D}}");
defineMacro("\u225E", "\\html@mathml{\\stackrel{\\tiny\\mathrm{m}}{=}}{\\mathrel{\\char`\u225E}}");
defineMacro("\u225F", "\\html@mathml{\\stackrel{\\tiny?}{=}}{\\mathrel{\\char`\u225F}}");
defineMacro("\u27C2", "\\perp");
defineMacro("\u203C", "\\mathclose{!\\mkern-0.8mu!}");
defineMacro("\u220C", "\\notni");
defineMacro("\u231C", "\\ulcorner");
defineMacro("\u231D", "\\urcorner");
defineMacro("\u231E", "\\llcorner");
defineMacro("\u231F", "\\lrcorner");
defineMacro("\xA9", "\\copyright");
defineMacro("\xAE", "\\textregistered");
defineMacro("\\ulcorner", '\\html@mathml{\\@ulcorner}{\\mathop{\\char"231c}}');
defineMacro("\\urcorner", '\\html@mathml{\\@urcorner}{\\mathop{\\char"231d}}');
defineMacro("\\llcorner", '\\html@mathml{\\@llcorner}{\\mathop{\\char"231e}}');
defineMacro("\\lrcorner", '\\html@mathml{\\@lrcorner}{\\mathop{\\char"231f}}');
defineMacro("\\vdots", "{\\varvdots\\rule{0pt}{15pt}}");
defineMacro("\u22EE", "\\vdots");
defineMacro("\\varGamma", "\\mathit{\\Gamma}");
defineMacro("\\varDelta", "\\mathit{\\Delta}");
defineMacro("\\varTheta", "\\mathit{\\Theta}");
defineMacro("\\varLambda", "\\mathit{\\Lambda}");
defineMacro("\\varXi", "\\mathit{\\Xi}");
defineMacro("\\varPi", "\\mathit{\\Pi}");
defineMacro("\\varSigma", "\\mathit{\\Sigma}");
defineMacro("\\varUpsilon", "\\mathit{\\Upsilon}");
defineMacro("\\varPhi", "\\mathit{\\Phi}");
defineMacro("\\varPsi", "\\mathit{\\Psi}");
defineMacro("\\varOmega", "\\mathit{\\Omega}");
defineMacro("\\substack", "\\begin{subarray}{c}#1\\end{subarray}");
defineMacro("\\colon", "\\nobreak\\mskip2mu\\mathpunct{}\\mathchoice{\\mkern-3mu}{\\mkern-3mu}{}{}{:}\\mskip6mu\\relax");
defineMacro("\\boxed", "\\fbox{$\\displaystyle{#1}$}");
defineMacro("\\iff", "\\DOTSB\\;\\Longleftrightarrow\\;");
defineMacro("\\implies", "\\DOTSB\\;\\Longrightarrow\\;");
defineMacro("\\impliedby", "\\DOTSB\\;\\Longleftarrow\\;");
defineMacro("\\dddot", "{\\overset{\\raisebox{-0.1ex}{\\normalsize ...}}{#1}}");
defineMacro("\\ddddot", "{\\overset{\\raisebox{-0.1ex}{\\normalsize ....}}{#1}}");
var dotsByToken = {
  ",": "\\dotsc",
  "\\not": "\\dotsb",
  // \keybin@ checks for the following:
  "+": "\\dotsb",
  "=": "\\dotsb",
  "<": "\\dotsb",
  ">": "\\dotsb",
  "-": "\\dotsb",
  "*": "\\dotsb",
  ":": "\\dotsb",
  // Symbols whose definition starts with \DOTSB:
  "\\DOTSB": "\\dotsb",
  "\\coprod": "\\dotsb",
  "\\bigvee": "\\dotsb",
  "\\bigwedge": "\\dotsb",
  "\\biguplus": "\\dotsb",
  "\\bigcap": "\\dotsb",
  "\\bigcup": "\\dotsb",
  "\\prod": "\\dotsb",
  "\\sum": "\\dotsb",
  "\\bigotimes": "\\dotsb",
  "\\bigoplus": "\\dotsb",
  "\\bigodot": "\\dotsb",
  "\\bigsqcup": "\\dotsb",
  "\\And": "\\dotsb",
  "\\longrightarrow": "\\dotsb",
  "\\Longrightarrow": "\\dotsb",
  "\\longleftarrow": "\\dotsb",
  "\\Longleftarrow": "\\dotsb",
  "\\longleftrightarrow": "\\dotsb",
  "\\Longleftrightarrow": "\\dotsb",
  "\\mapsto": "\\dotsb",
  "\\longmapsto": "\\dotsb",
  "\\hookrightarrow": "\\dotsb",
  "\\doteq": "\\dotsb",
  // Symbols whose definition starts with \mathbin:
  "\\mathbin": "\\dotsb",
  // Symbols whose definition starts with \mathrel:
  "\\mathrel": "\\dotsb",
  "\\relbar": "\\dotsb",
  "\\Relbar": "\\dotsb",
  "\\xrightarrow": "\\dotsb",
  "\\xleftarrow": "\\dotsb",
  // Symbols whose definition starts with \DOTSI:
  "\\DOTSI": "\\dotsi",
  "\\int": "\\dotsi",
  "\\oint": "\\dotsi",
  "\\iint": "\\dotsi",
  "\\iiint": "\\dotsi",
  "\\iiiint": "\\dotsi",
  "\\idotsint": "\\dotsi",
  // Symbols whose definition starts with \DOTSX:
  "\\DOTSX": "\\dotsx"
};
var dotsbGroups = /* @__PURE__ */ new Set(["bin", "rel"]);
defineMacro("\\dots", function(context) {
  var thedots = "\\dotso";
  var next = context.expandAfterFuture().text;
  if (next in dotsByToken) {
    thedots = dotsByToken[next];
  } else if (next.slice(0, 4) === "\\not") {
    thedots = "\\dotsb";
  } else if (next in symbols2.math) {
    if (dotsbGroups.has(symbols2.math[next].group)) {
      thedots = "\\dotsb";
    }
  }
  return thedots;
});
var spaceAfterDots = {
  // \rightdelim@ checks for the following:
  ")": true,
  "]": true,
  "\\rbrack": true,
  "\\}": true,
  "\\rbrace": true,
  "\\rangle": true,
  "\\rceil": true,
  "\\rfloor": true,
  "\\rgroup": true,
  "\\rmoustache": true,
  "\\right": true,
  "\\bigr": true,
  "\\biggr": true,
  "\\Bigr": true,
  "\\Biggr": true,
  // \extra@ also tests for the following:
  "$": true,
  // \extrap@ checks for the following:
  ";": true,
  ".": true,
  ",": true
};
defineMacro("\\dotso", function(context) {
  var next = context.future().text;
  if (next in spaceAfterDots) {
    return "\\ldots\\,";
  } else {
    return "\\ldots";
  }
});
defineMacro("\\dotsc", function(context) {
  var next = context.future().text;
  if (next in spaceAfterDots && next !== ",") {
    return "\\ldots\\,";
  } else {
    return "\\ldots";
  }
});
defineMacro("\\cdots", function(context) {
  var next = context.future().text;
  if (next in spaceAfterDots) {
    return "\\@cdots\\,";
  } else {
    return "\\@cdots";
  }
});
defineMacro("\\dotsb", "\\cdots");
defineMacro("\\dotsm", "\\cdots");
defineMacro("\\dotsi", "\\!\\cdots");
defineMacro("\\dotsx", "\\ldots\\,");
defineMacro("\\DOTSI", "\\relax");
defineMacro("\\DOTSB", "\\relax");
defineMacro("\\DOTSX", "\\relax");
defineMacro("\\tmspace", "\\TextOrMath{\\kern#1#3}{\\mskip#1#2}\\relax");
defineMacro("\\,", "\\tmspace+{3mu}{.1667em}");
defineMacro("\\thinspace", "\\,");
defineMacro("\\>", "\\mskip{4mu}");
defineMacro("\\:", "\\tmspace+{4mu}{.2222em}");
defineMacro("\\medspace", "\\:");
defineMacro("\\;", "\\tmspace+{5mu}{.2777em}");
defineMacro("\\thickspace", "\\;");
defineMacro("\\!", "\\tmspace-{3mu}{.1667em}");
defineMacro("\\negthinspace", "\\!");
defineMacro("\\negmedspace", "\\tmspace-{4mu}{.2222em}");
defineMacro("\\negthickspace", "\\tmspace-{5mu}{.277em}");
defineMacro("\\enspace", "\\kern.5em ");
defineMacro("\\enskip", "\\hskip.5em\\relax");
defineMacro("\\quad", "\\hskip1em\\relax");
defineMacro("\\qquad", "\\hskip2em\\relax");
defineMacro("\\tag", "\\@ifstar\\tag@literal\\tag@paren");
defineMacro("\\tag@paren", "\\tag@literal{({#1})}");
defineMacro("\\tag@literal", (context) => {
  if (context.macros.get("\\df@tag")) {
    throw new ParseError("Multiple \\tag");
  }
  return "\\gdef\\df@tag{\\text{#1}}";
});
defineMacro("\\bmod", "\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}\\mathbin{\\rm mod}\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}");
defineMacro("\\pod", "\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern8mu}{\\mkern8mu}{\\mkern8mu}(#1)");
defineMacro("\\pmod", "\\pod{{\\rm mod}\\mkern6mu#1}");
defineMacro("\\mod", "\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern12mu}{\\mkern12mu}{\\mkern12mu}{\\rm mod}\\,\\,#1");
defineMacro("\\newline", "\\\\\\relax");
defineMacro("\\TeX", "\\textrm{\\html@mathml{T\\kern-.1667em\\raisebox{-.5ex}{E}\\kern-.125emX}{TeX}}");
var latexRaiseA = makeEm(fontMetricsData["Main-Regular"]["T".charCodeAt(0)][1] - 0.7 * fontMetricsData["Main-Regular"]["A".charCodeAt(0)][1]);
defineMacro("\\LaTeX", "\\textrm{\\html@mathml{" + ("L\\kern-.36em\\raisebox{" + latexRaiseA + "}{\\scriptstyle A}") + "\\kern-.15em\\TeX}{LaTeX}}");
defineMacro("\\KaTeX", "\\textrm{\\html@mathml{" + ("K\\kern-.17em\\raisebox{" + latexRaiseA + "}{\\scriptstyle A}") + "\\kern-.15em\\TeX}{KaTeX}}");
defineMacro("\\hspace", "\\@ifstar\\@hspacer\\@hspace");
defineMacro("\\@hspace", "\\hskip #1\\relax");
defineMacro("\\@hspacer", "\\rule{0pt}{0pt}\\hskip #1\\relax");
defineMacro("\\ordinarycolon", ":");
defineMacro("\\vcentcolon", "\\mathrel{\\mathop\\ordinarycolon}");
defineMacro("\\dblcolon", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-.9mu}\\vcentcolon}}{\\mathop{\\char"2237}}');
defineMacro("\\coloneqq", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}=}}{\\mathop{\\char"2254}}');
defineMacro("\\Coloneqq", '\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}=}}{\\mathop{\\char"2237\\char"3d}}');
defineMacro("\\coloneq", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}{\\mathop{\\char"3a\\char"2212}}');
defineMacro("\\Coloneq", '\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}{\\mathop{\\char"2237\\char"2212}}');
defineMacro("\\eqqcolon", '\\html@mathml{\\mathrel{=\\mathrel{\\mkern-1.2mu}\\vcentcolon}}{\\mathop{\\char"2255}}');
defineMacro("\\Eqqcolon", '\\html@mathml{\\mathrel{=\\mathrel{\\mkern-1.2mu}\\dblcolon}}{\\mathop{\\char"3d\\char"2237}}');
defineMacro("\\eqcolon", '\\html@mathml{\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\vcentcolon}}{\\mathop{\\char"2239}}');
defineMacro("\\Eqcolon", '\\html@mathml{\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\dblcolon}}{\\mathop{\\char"2212\\char"2237}}');
defineMacro("\\colonapprox", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\approx}}{\\mathop{\\char"3a\\char"2248}}');
defineMacro("\\Colonapprox", '\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\approx}}{\\mathop{\\char"2237\\char"2248}}');
defineMacro("\\colonsim", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\sim}}{\\mathop{\\char"3a\\char"223c}}');
defineMacro("\\Colonsim", '\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\sim}}{\\mathop{\\char"2237\\char"223c}}');
defineMacro("\u2237", "\\dblcolon");
defineMacro("\u2239", "\\eqcolon");
defineMacro("\u2254", "\\coloneqq");
defineMacro("\u2255", "\\eqqcolon");
defineMacro("\u2A74", "\\Coloneqq");
defineMacro("\\ratio", "\\vcentcolon");
defineMacro("\\coloncolon", "\\dblcolon");
defineMacro("\\colonequals", "\\coloneqq");
defineMacro("\\coloncolonequals", "\\Coloneqq");
defineMacro("\\equalscolon", "\\eqqcolon");
defineMacro("\\equalscoloncolon", "\\Eqqcolon");
defineMacro("\\colonminus", "\\coloneq");
defineMacro("\\coloncolonminus", "\\Coloneq");
defineMacro("\\minuscolon", "\\eqcolon");
defineMacro("\\minuscoloncolon", "\\Eqcolon");
defineMacro("\\coloncolonapprox", "\\Colonapprox");
defineMacro("\\coloncolonsim", "\\Colonsim");
defineMacro("\\simcolon", "\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\vcentcolon}");
defineMacro("\\simcoloncolon", "\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\dblcolon}");
defineMacro("\\approxcolon", "\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\vcentcolon}");
defineMacro("\\approxcoloncolon", "\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\dblcolon}");
defineMacro("\\notni", "\\html@mathml{\\not\\ni}{\\mathrel{\\char`\u220C}}");
defineMacro("\\limsup", "\\DOTSB\\operatorname*{lim\\,sup}");
defineMacro("\\liminf", "\\DOTSB\\operatorname*{lim\\,inf}");
defineMacro("\\injlim", "\\DOTSB\\operatorname*{inj\\,lim}");
defineMacro("\\projlim", "\\DOTSB\\operatorname*{proj\\,lim}");
defineMacro("\\varlimsup", "\\DOTSB\\operatorname*{\\overline{lim}}");
defineMacro("\\varliminf", "\\DOTSB\\operatorname*{\\underline{lim}}");
defineMacro("\\varinjlim", "\\DOTSB\\operatorname*{\\underrightarrow{lim}}");
defineMacro("\\varprojlim", "\\DOTSB\\operatorname*{\\underleftarrow{lim}}");
defineMacro("\\gvertneqq", "\\html@mathml{\\@gvertneqq}{\u2269}");
defineMacro("\\lvertneqq", "\\html@mathml{\\@lvertneqq}{\u2268}");
defineMacro("\\ngeqq", "\\html@mathml{\\@ngeqq}{\u2271}");
defineMacro("\\ngeqslant", "\\html@mathml{\\@ngeqslant}{\u2271}");
defineMacro("\\nleqq", "\\html@mathml{\\@nleqq}{\u2270}");
defineMacro("\\nleqslant", "\\html@mathml{\\@nleqslant}{\u2270}");
defineMacro("\\nshortmid", "\\html@mathml{\\@nshortmid}{\u2224}");
defineMacro("\\nshortparallel", "\\html@mathml{\\@nshortparallel}{\u2226}");
defineMacro("\\nsubseteqq", "\\html@mathml{\\@nsubseteqq}{\u2288}");
defineMacro("\\nsupseteqq", "\\html@mathml{\\@nsupseteqq}{\u2289}");
defineMacro("\\varsubsetneq", "\\html@mathml{\\@varsubsetneq}{\u228A}");
defineMacro("\\varsubsetneqq", "\\html@mathml{\\@varsubsetneqq}{\u2ACB}");
defineMacro("\\varsupsetneq", "\\html@mathml{\\@varsupsetneq}{\u228B}");
defineMacro("\\varsupsetneqq", "\\html@mathml{\\@varsupsetneqq}{\u2ACC}");
defineMacro("\\imath", "\\html@mathml{\\@imath}{\u0131}");
defineMacro("\\jmath", "\\html@mathml{\\@jmath}{\u0237}");
defineMacro("\\llbracket", "\\html@mathml{\\mathopen{[\\mkern-3.2mu[}}{\\mathopen{\\char`\u27E6}}");
defineMacro("\\rrbracket", "\\html@mathml{\\mathclose{]\\mkern-3.2mu]}}{\\mathclose{\\char`\u27E7}}");
defineMacro("\u27E6", "\\llbracket");
defineMacro("\u27E7", "\\rrbracket");
defineMacro("\\lBrace", "\\html@mathml{\\mathopen{\\{\\mkern-3.2mu[}}{\\mathopen{\\char`\u2983}}");
defineMacro("\\rBrace", "\\html@mathml{\\mathclose{]\\mkern-3.2mu\\}}}{\\mathclose{\\char`\u2984}}");
defineMacro("\u2983", "\\lBrace");
defineMacro("\u2984", "\\rBrace");
defineMacro("\\minuso", "\\mathbin{\\html@mathml{{\\mathrlap{\\mathchoice{\\kern{0.145em}}{\\kern{0.145em}}{\\kern{0.1015em}}{\\kern{0.0725em}}\\circ}{-}}}{\\char`\u29B5}}");
defineMacro("\u29B5", "\\minuso");
defineMacro("\\darr", "\\downarrow");
defineMacro("\\dArr", "\\Downarrow");
defineMacro("\\Darr", "\\Downarrow");
defineMacro("\\lang", "\\langle");
defineMacro("\\rang", "\\rangle");
defineMacro("\\uarr", "\\uparrow");
defineMacro("\\uArr", "\\Uparrow");
defineMacro("\\Uarr", "\\Uparrow");
defineMacro("\\N", "\\mathbb{N}");
defineMacro("\\R", "\\mathbb{R}");
defineMacro("\\Z", "\\mathbb{Z}");
defineMacro("\\alef", "\\aleph");
defineMacro("\\alefsym", "\\aleph");
defineMacro("\\Alpha", "\\mathrm{A}");
defineMacro("\\Beta", "\\mathrm{B}");
defineMacro("\\bull", "\\bullet");
defineMacro("\\Chi", "\\mathrm{X}");
defineMacro("\\clubs", "\\clubsuit");
defineMacro("\\cnums", "\\mathbb{C}");
defineMacro("\\Complex", "\\mathbb{C}");
defineMacro("\\Dagger", "\\ddagger");
defineMacro("\\diamonds", "\\diamondsuit");
defineMacro("\\empty", "\\emptyset");
defineMacro("\\Epsilon", "\\mathrm{E}");
defineMacro("\\Eta", "\\mathrm{H}");
defineMacro("\\exist", "\\exists");
defineMacro("\\harr", "\\leftrightarrow");
defineMacro("\\hArr", "\\Leftrightarrow");
defineMacro("\\Harr", "\\Leftrightarrow");
defineMacro("\\hearts", "\\heartsuit");
defineMacro("\\image", "\\Im");
defineMacro("\\infin", "\\infty");
defineMacro("\\Iota", "\\mathrm{I}");
defineMacro("\\isin", "\\in");
defineMacro("\\Kappa", "\\mathrm{K}");
defineMacro("\\larr", "\\leftarrow");
defineMacro("\\lArr", "\\Leftarrow");
defineMacro("\\Larr", "\\Leftarrow");
defineMacro("\\lrarr", "\\leftrightarrow");
defineMacro("\\lrArr", "\\Leftrightarrow");
defineMacro("\\Lrarr", "\\Leftrightarrow");
defineMacro("\\Mu", "\\mathrm{M}");
defineMacro("\\natnums", "\\mathbb{N}");
defineMacro("\\Nu", "\\mathrm{N}");
defineMacro("\\Omicron", "\\mathrm{O}");
defineMacro("\\plusmn", "\\pm");
defineMacro("\\rarr", "\\rightarrow");
defineMacro("\\rArr", "\\Rightarrow");
defineMacro("\\Rarr", "\\Rightarrow");
defineMacro("\\real", "\\Re");
defineMacro("\\reals", "\\mathbb{R}");
defineMacro("\\Reals", "\\mathbb{R}");
defineMacro("\\Rho", "\\mathrm{P}");
defineMacro("\\sdot", "\\cdot");
defineMacro("\\sect", "\\S");
defineMacro("\\spades", "\\spadesuit");
defineMacro("\\sub", "\\subset");
defineMacro("\\sube", "\\subseteq");
defineMacro("\\supe", "\\supseteq");
defineMacro("\\Tau", "\\mathrm{T}");
defineMacro("\\thetasym", "\\vartheta");
defineMacro("\\weierp", "\\wp");
defineMacro("\\Zeta", "\\mathrm{Z}");
defineMacro("\\argmin", "\\DOTSB\\operatorname*{arg\\,min}");
defineMacro("\\argmax", "\\DOTSB\\operatorname*{arg\\,max}");
defineMacro("\\plim", "\\DOTSB\\mathop{\\operatorname{plim}}\\limits");
defineMacro("\\bra", "\\mathinner{\\langle{#1}|}");
defineMacro("\\ket", "\\mathinner{|{#1}\\rangle}");
defineMacro("\\braket", "\\mathinner{\\langle{#1}\\rangle}");
defineMacro("\\Bra", "\\left\\langle#1\\right|");
defineMacro("\\Ket", "\\left|#1\\right\\rangle");
var braketHelper = (one) => (context) => {
  var left = context.consumeArg().tokens;
  var middle = context.consumeArg().tokens;
  var middleDouble = context.consumeArg().tokens;
  var right = context.consumeArg().tokens;
  var oldMiddle = context.macros.get("|");
  var oldMiddleDouble = context.macros.get("\\|");
  context.macros.beginGroup();
  var midMacro = (double) => (context2) => {
    if (one) {
      context2.macros.set("|", oldMiddle);
      if (middleDouble.length) {
        context2.macros.set("\\|", oldMiddleDouble);
      }
    }
    var doubled = double;
    if (!double && middleDouble.length) {
      var nextToken = context2.future();
      if (nextToken.text === "|") {
        context2.popToken();
        doubled = true;
      }
    }
    return {
      tokens: doubled ? middleDouble : middle,
      numArgs: 0
    };
  };
  context.macros.set("|", midMacro(false));
  if (middleDouble.length) {
    context.macros.set("\\|", midMacro(true));
  }
  var arg = context.consumeArg().tokens;
  var expanded = context.expandTokens([
    ...right,
    ...arg,
    ...left
    // reversed
  ]);
  context.macros.endGroup();
  return {
    tokens: expanded.reverse(),
    numArgs: 0
  };
};
defineMacro("\\bra@ket", braketHelper(false));
defineMacro("\\bra@set", braketHelper(true));
defineMacro("\\Braket", "\\bra@ket{\\left\\langle}{\\,\\middle\\vert\\,}{\\,\\middle\\vert\\,}{\\right\\rangle}");
defineMacro("\\Set", "\\bra@set{\\left\\{\\:}{\\;\\middle\\vert\\;}{\\;\\middle\\Vert\\;}{\\:\\right\\}}");
defineMacro("\\set", "\\bra@set{\\{\\,}{\\mid}{}{\\,\\}}");
defineMacro("\\angln", "{\\angl n}");
defineMacro("\\blue", "\\textcolor{##6495ed}{#1}");
defineMacro("\\orange", "\\textcolor{##ffa500}{#1}");
defineMacro("\\pink", "\\textcolor{##ff00af}{#1}");
defineMacro("\\red", "\\textcolor{##df0030}{#1}");
defineMacro("\\green", "\\textcolor{##28ae7b}{#1}");
defineMacro("\\gray", "\\textcolor{gray}{#1}");
defineMacro("\\purple", "\\textcolor{##9d38bd}{#1}");
defineMacro("\\blueA", "\\textcolor{##ccfaff}{#1}");
defineMacro("\\blueB", "\\textcolor{##80f6ff}{#1}");
defineMacro("\\blueC", "\\textcolor{##63d9ea}{#1}");
defineMacro("\\blueD", "\\textcolor{##11accd}{#1}");
defineMacro("\\blueE", "\\textcolor{##0c7f99}{#1}");
defineMacro("\\tealA", "\\textcolor{##94fff5}{#1}");
defineMacro("\\tealB", "\\textcolor{##26edd5}{#1}");
defineMacro("\\tealC", "\\textcolor{##01d1c1}{#1}");
defineMacro("\\tealD", "\\textcolor{##01a995}{#1}");
defineMacro("\\tealE", "\\textcolor{##208170}{#1}");
defineMacro("\\greenA", "\\textcolor{##b6ffb0}{#1}");
defineMacro("\\greenB", "\\textcolor{##8af281}{#1}");
defineMacro("\\greenC", "\\textcolor{##74cf70}{#1}");
defineMacro("\\greenD", "\\textcolor{##1fab54}{#1}");
defineMacro("\\greenE", "\\textcolor{##0d923f}{#1}");
defineMacro("\\goldA", "\\textcolor{##ffd0a9}{#1}");
defineMacro("\\goldB", "\\textcolor{##ffbb71}{#1}");
defineMacro("\\goldC", "\\textcolor{##ff9c39}{#1}");
defineMacro("\\goldD", "\\textcolor{##e07d10}{#1}");
defineMacro("\\goldE", "\\textcolor{##a75a05}{#1}");
defineMacro("\\redA", "\\textcolor{##fca9a9}{#1}");
defineMacro("\\redB", "\\textcolor{##ff8482}{#1}");
defineMacro("\\redC", "\\textcolor{##f9685d}{#1}");
defineMacro("\\redD", "\\textcolor{##e84d39}{#1}");
defineMacro("\\redE", "\\textcolor{##bc2612}{#1}");
defineMacro("\\maroonA", "\\textcolor{##ffbde0}{#1}");
defineMacro("\\maroonB", "\\textcolor{##ff92c6}{#1}");
defineMacro("\\maroonC", "\\textcolor{##ed5fa6}{#1}");
defineMacro("\\maroonD", "\\textcolor{##ca337c}{#1}");
defineMacro("\\maroonE", "\\textcolor{##9e034e}{#1}");
defineMacro("\\purpleA", "\\textcolor{##ddd7ff}{#1}");
defineMacro("\\purpleB", "\\textcolor{##c6b9fc}{#1}");
defineMacro("\\purpleC", "\\textcolor{##aa87ff}{#1}");
defineMacro("\\purpleD", "\\textcolor{##7854ab}{#1}");
defineMacro("\\purpleE", "\\textcolor{##543b78}{#1}");
defineMacro("\\mintA", "\\textcolor{##f5f9e8}{#1}");
defineMacro("\\mintB", "\\textcolor{##edf2df}{#1}");
defineMacro("\\mintC", "\\textcolor{##e0e5cc}{#1}");
defineMacro("\\grayA", "\\textcolor{##f6f7f7}{#1}");
defineMacro("\\grayB", "\\textcolor{##f0f1f2}{#1}");
defineMacro("\\grayC", "\\textcolor{##e3e5e6}{#1}");
defineMacro("\\grayD", "\\textcolor{##d6d8da}{#1}");
defineMacro("\\grayE", "\\textcolor{##babec2}{#1}");
defineMacro("\\grayF", "\\textcolor{##888d93}{#1}");
defineMacro("\\grayG", "\\textcolor{##626569}{#1}");
defineMacro("\\grayH", "\\textcolor{##3b3e40}{#1}");
defineMacro("\\grayI", "\\textcolor{##21242c}{#1}");
defineMacro("\\kaBlue", "\\textcolor{##314453}{#1}");
defineMacro("\\kaGreen", "\\textcolor{##71B307}{#1}");
var implicitCommands = {
  "^": true,
  // Parser.js
  "_": true,
  // Parser.js
  "\\limits": true,
  // Parser.js
  "\\nolimits": true
  // Parser.js
};
var MacroExpander = class {
  constructor(input, settings, mode) {
    this.settings = void 0;
    this.expansionCount = void 0;
    this.lexer = void 0;
    this.macros = void 0;
    this.stack = void 0;
    this.mode = void 0;
    this.settings = settings;
    this.expansionCount = 0;
    this.feed(input);
    this.macros = new Namespace(macros, settings.macros);
    this.mode = mode;
    this.stack = [];
  }
  /**
   * Feed a new input string to the same MacroExpander
   * (with existing macros etc.).
   */
  feed(input) {
    this.lexer = new Lexer(input, this.settings);
  }
  /**
   * Switches between "text" and "math" modes.
   */
  switchMode(newMode) {
    this.mode = newMode;
  }
  /**
   * Start a new group nesting within all namespaces.
   */
  beginGroup() {
    this.macros.beginGroup();
  }
  /**
   * End current group nesting within all namespaces.
   */
  endGroup() {
    this.macros.endGroup();
  }
  /**
   * Ends all currently nested groups (if any), restoring values before the
   * groups began.  Useful in case of an error in the middle of parsing.
   */
  endGroups() {
    this.macros.endGroups();
  }
  /**
   * Returns the topmost token on the stack, without expanding it.
   * Similar in behavior to TeX's `\futurelet`.
   */
  future() {
    if (this.stack.length === 0) {
      this.pushToken(this.lexer.lex());
    }
    return this.stack[this.stack.length - 1];
  }
  /**
   * Remove and return the next unexpanded token.
   */
  popToken() {
    this.future();
    return this.stack.pop();
  }
  /**
   * Add a given token to the token stack.  In particular, this get be used
   * to put back a token returned from one of the other methods.
   */
  pushToken(token) {
    this.stack.push(token);
  }
  /**
   * Append an array of tokens to the token stack.
   */
  pushTokens(tokens) {
    this.stack.push(...tokens);
  }
  /**
   * Find an macro argument without expanding tokens and append the array of
   * tokens to the token stack. Uses Token as a container for the result.
   */
  scanArgument(isOptional) {
    var start;
    var end;
    var tokens;
    if (isOptional) {
      this.consumeSpaces();
      if (this.future().text !== "[") {
        return null;
      }
      start = this.popToken();
      ({
        tokens,
        end
      } = this.consumeArg(["]"]));
    } else {
      ({
        tokens,
        start,
        end
      } = this.consumeArg());
    }
    this.pushToken(new Token("EOF", end.loc));
    this.pushTokens(tokens);
    return new Token("", SourceLocation.range(start, end));
  }
  /**
   * Consume all following space tokens, without expansion.
   */
  consumeSpaces() {
    for (; ; ) {
      var token = this.future();
      if (token.text === " ") {
        this.stack.pop();
      } else {
        break;
      }
    }
  }
  /**
   * Consume an argument from the token stream, and return the resulting array
   * of tokens and start/end token.
   */
  consumeArg(delims) {
    var tokens = [];
    var isDelimited = delims && delims.length > 0;
    if (!isDelimited) {
      this.consumeSpaces();
    }
    var start = this.future();
    var tok;
    var depth = 0;
    var match = 0;
    do {
      tok = this.popToken();
      tokens.push(tok);
      if (tok.text === "{") {
        ++depth;
      } else if (tok.text === "}") {
        --depth;
        if (depth === -1) {
          throw new ParseError("Extra }", tok);
        }
      } else if (tok.text === "EOF") {
        throw new ParseError("Unexpected end of input in a macro argument, expected '" + (delims && isDelimited ? delims[match] : "}") + "'", tok);
      }
      if (delims && isDelimited) {
        if ((depth === 0 || depth === 1 && delims[match] === "{") && tok.text === delims[match]) {
          ++match;
          if (match === delims.length) {
            tokens.splice(-match, match);
            break;
          }
        } else {
          match = 0;
        }
      }
    } while (depth !== 0 || isDelimited);
    if (start.text === "{" && tokens[tokens.length - 1].text === "}") {
      tokens.pop();
      tokens.shift();
    }
    tokens.reverse();
    return {
      tokens,
      start,
      end: tok
    };
  }
  /**
   * Consume the specified number of (delimited) arguments from the token
   * stream and return the resulting array of arguments.
   */
  consumeArgs(numArgs, delimiters2) {
    if (delimiters2) {
      if (delimiters2.length !== numArgs + 1) {
        throw new ParseError("The length of delimiters doesn't match the number of args!");
      }
      var delims = delimiters2[0];
      for (var i4 = 0; i4 < delims.length; i4++) {
        var tok = this.popToken();
        if (delims[i4] !== tok.text) {
          throw new ParseError("Use of the macro doesn't match its definition", tok);
        }
      }
    }
    var args = [];
    for (var _i6 = 0; _i6 < numArgs; _i6++) {
      args.push(this.consumeArg(delimiters2 && delimiters2[_i6 + 1]).tokens);
    }
    return args;
  }
  /**
   * Increment `expansionCount` by the specified amount.
   * Throw an error if it exceeds `maxExpand`.
   */
  countExpansion(amount) {
    this.expansionCount += amount;
    if (this.expansionCount > this.settings.maxExpand) {
      throw new ParseError("Too many expansions: infinite loop or need to increase maxExpand setting");
    }
  }
  /**
   * Expand the next token only once if possible.
   *
   * If the token is expanded, the resulting tokens will be pushed onto
   * the stack in reverse order, and the number of such tokens will be
   * returned.  This number might be zero or positive.
   *
   * If not, the return value is `false`, and the next token remains at the
   * top of the stack.
   *
   * In either case, the next token will be on the top of the stack,
   * or the stack will be empty (in case of empty expansion
   * and no other tokens).
   *
   * Used to implement `expandAfterFuture` and `expandNextToken`.
   *
   * If expandableOnly, only expandable tokens are expanded and
   * an undefined control sequence results in an error.
   */
  expandOnce(expandableOnly) {
    var topToken = this.popToken();
    var name2 = topToken.text;
    var expansion = !topToken.noexpand ? this._getExpansion(name2) : null;
    if (expansion == null || expandableOnly && expansion.unexpandable) {
      if (expandableOnly && expansion == null && name2[0] === "\\" && !this.isDefined(name2)) {
        throw new ParseError("Undefined control sequence: " + name2);
      }
      this.pushToken(topToken);
      return false;
    }
    this.countExpansion(1);
    var tokens = expansion.tokens;
    var args = this.consumeArgs(expansion.numArgs, expansion.delimiters);
    if (expansion.numArgs) {
      tokens = tokens.slice();
      for (var i4 = tokens.length - 1; i4 >= 0; --i4) {
        var tok = tokens[i4];
        if (tok.text === "#") {
          if (i4 === 0) {
            throw new ParseError("Incomplete placeholder at end of macro body", tok);
          }
          tok = tokens[--i4];
          if (tok.text === "#") {
            tokens.splice(i4 + 1, 1);
          } else if (/^[1-9]$/.test(tok.text)) {
            tokens.splice(i4, 2, ...args[+tok.text - 1]);
          } else {
            throw new ParseError("Not a valid argument number", tok);
          }
        }
      }
    }
    this.pushTokens(tokens);
    return tokens.length;
  }
  /**
   * Expand the next token only once (if possible), and return the resulting
   * top token on the stack (without removing anything from the stack).
   * Similar in behavior to TeX's `\expandafter\futurelet`.
   * Equivalent to expandOnce() followed by future().
   */
  expandAfterFuture() {
    this.expandOnce();
    return this.future();
  }
  /**
   * Recursively expand first token, then return first non-expandable token.
   */
  expandNextToken() {
    for (; ; ) {
      if (this.expandOnce() === false) {
        var token = this.stack.pop();
        if (token.treatAsRelax) {
          token.text = "\\relax";
        }
        return token;
      }
    }
  }
  /**
   * Fully expand the given macro name and return the resulting list of
   * tokens, or return `undefined` if no such macro is defined.
   */
  expandMacro(name2) {
    return this.macros.has(name2) ? this.expandTokens([new Token(name2)]) : void 0;
  }
  /**
   * Fully expand the given token stream and return the resulting list of
   * tokens.  Note that the input tokens are in reverse order, but the
   * output tokens are in forward order.
   */
  expandTokens(tokens) {
    var output = [];
    var oldStackLength = this.stack.length;
    this.pushTokens(tokens);
    while (this.stack.length > oldStackLength) {
      if (this.expandOnce(true) === false) {
        var token = this.stack.pop();
        if (token.treatAsRelax) {
          token.noexpand = false;
          token.treatAsRelax = false;
        }
        output.push(token);
      }
    }
    this.countExpansion(output.length);
    return output;
  }
  /**
   * Fully expand the given macro name and return the result as a string,
   * or return `undefined` if no such macro is defined.
   */
  expandMacroAsText(name2) {
    var tokens = this.expandMacro(name2);
    if (tokens) {
      return tokens.map((token) => token.text).join("");
    } else {
      return tokens;
    }
  }
  /**
   * Returns the expanded macro as a reversed array of tokens and a macro
   * argument count.  Or returns `null` if no such macro.
   */
  _getExpansion(name2) {
    var definition = this.macros.get(name2);
    if (definition == null) {
      return definition;
    }
    if (name2.length === 1) {
      var catcode = this.lexer.catcodes[name2];
      if (catcode != null && catcode !== 13) {
        return;
      }
    }
    var expansion = typeof definition === "function" ? definition(this) : definition;
    if (typeof expansion === "string") {
      var numArgs = 0;
      if (expansion.includes("#")) {
        var stripped = expansion.replace(/##/g, "");
        while (stripped.includes("#" + (numArgs + 1))) {
          ++numArgs;
        }
      }
      var bodyLexer = new Lexer(expansion, this.settings);
      var tokens = [];
      var tok = bodyLexer.lex();
      while (tok.text !== "EOF") {
        tokens.push(tok);
        tok = bodyLexer.lex();
      }
      tokens.reverse();
      var expanded = {
        tokens,
        numArgs
      };
      return expanded;
    }
    return expansion;
  }
  /**
   * Determine whether a command is currently "defined" (has some
   * functionality), meaning that it's a macro (in the current group),
   * a function, a symbol, or one of the special commands listed in
   * `implicitCommands`.
   */
  isDefined(name2) {
    return this.macros.has(name2) || functions.hasOwnProperty(name2) || symbols2.math.hasOwnProperty(name2) || symbols2.text.hasOwnProperty(name2) || implicitCommands.hasOwnProperty(name2);
  }
  /**
   * Determine whether a command is expandable.
   */
  isExpandable(name2) {
    var macro = this.macros.get(name2);
    return macro != null ? typeof macro === "string" || typeof macro === "function" || !macro.unexpandable : functions.hasOwnProperty(name2) && !functions[name2].primitive;
  }
};
var unicodeSubRegEx = /^[₊₋₌₍₎₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵦᵧᵨᵩᵪ]/;
var uSubsAndSups = Object.freeze({
  "\u208A": "+",
  "\u208B": "-",
  "\u208C": "=",
  "\u208D": "(",
  "\u208E": ")",
  "\u2080": "0",
  "\u2081": "1",
  "\u2082": "2",
  "\u2083": "3",
  "\u2084": "4",
  "\u2085": "5",
  "\u2086": "6",
  "\u2087": "7",
  "\u2088": "8",
  "\u2089": "9",
  "\u2090": "a",
  "\u2091": "e",
  "\u2095": "h",
  "\u1D62": "i",
  "\u2C7C": "j",
  "\u2096": "k",
  "\u2097": "l",
  "\u2098": "m",
  "\u2099": "n",
  "\u2092": "o",
  "\u209A": "p",
  "\u1D63": "r",
  "\u209B": "s",
  "\u209C": "t",
  "\u1D64": "u",
  "\u1D65": "v",
  "\u2093": "x",
  "\u1D66": "\u03B2",
  "\u1D67": "\u03B3",
  "\u1D68": "\u03C1",
  "\u1D69": "\u03D5",
  "\u1D6A": "\u03C7",
  "\u207A": "+",
  "\u207B": "-",
  "\u207C": "=",
  "\u207D": "(",
  "\u207E": ")",
  "\u2070": "0",
  "\xB9": "1",
  "\xB2": "2",
  "\xB3": "3",
  "\u2074": "4",
  "\u2075": "5",
  "\u2076": "6",
  "\u2077": "7",
  "\u2078": "8",
  "\u2079": "9",
  "\u1D2C": "A",
  "\u1D2E": "B",
  "\u1D30": "D",
  "\u1D31": "E",
  "\u1D33": "G",
  "\u1D34": "H",
  "\u1D35": "I",
  "\u1D36": "J",
  "\u1D37": "K",
  "\u1D38": "L",
  "\u1D39": "M",
  "\u1D3A": "N",
  "\u1D3C": "O",
  "\u1D3E": "P",
  "\u1D3F": "R",
  "\u1D40": "T",
  "\u1D41": "U",
  "\u2C7D": "V",
  "\u1D42": "W",
  "\u1D43": "a",
  "\u1D47": "b",
  "\u1D9C": "c",
  "\u1D48": "d",
  "\u1D49": "e",
  "\u1DA0": "f",
  "\u1D4D": "g",
  "\u02B0": "h",
  "\u2071": "i",
  "\u02B2": "j",
  "\u1D4F": "k",
  "\u02E1": "l",
  "\u1D50": "m",
  "\u207F": "n",
  "\u1D52": "o",
  "\u1D56": "p",
  "\u02B3": "r",
  "\u02E2": "s",
  "\u1D57": "t",
  "\u1D58": "u",
  "\u1D5B": "v",
  "\u02B7": "w",
  "\u02E3": "x",
  "\u02B8": "y",
  "\u1DBB": "z",
  "\u1D5D": "\u03B2",
  "\u1D5E": "\u03B3",
  "\u1D5F": "\u03B4",
  "\u1D60": "\u03D5",
  "\u1D61": "\u03C7",
  "\u1DBF": "\u03B8"
});
var unicodeAccents = {
  "\u0301": {
    "text": "\\'",
    "math": "\\acute"
  },
  "\u0300": {
    "text": "\\`",
    "math": "\\grave"
  },
  "\u0308": {
    "text": '\\"',
    "math": "\\ddot"
  },
  "\u0303": {
    "text": "\\~",
    "math": "\\tilde"
  },
  "\u0304": {
    "text": "\\=",
    "math": "\\bar"
  },
  "\u0306": {
    "text": "\\u",
    "math": "\\breve"
  },
  "\u030C": {
    "text": "\\v",
    "math": "\\check"
  },
  "\u0302": {
    "text": "\\^",
    "math": "\\hat"
  },
  "\u0307": {
    "text": "\\.",
    "math": "\\dot"
  },
  "\u030A": {
    "text": "\\r",
    "math": "\\mathring"
  },
  "\u030B": {
    "text": "\\H"
  },
  "\u0327": {
    "text": "\\c"
  }
};
var unicodeSymbols = {
  "\xE1": "a\u0301",
  "\xE0": "a\u0300",
  "\xE4": "a\u0308",
  "\u01DF": "a\u0308\u0304",
  "\xE3": "a\u0303",
  "\u0101": "a\u0304",
  "\u0103": "a\u0306",
  "\u1EAF": "a\u0306\u0301",
  "\u1EB1": "a\u0306\u0300",
  "\u1EB5": "a\u0306\u0303",
  "\u01CE": "a\u030C",
  "\xE2": "a\u0302",
  "\u1EA5": "a\u0302\u0301",
  "\u1EA7": "a\u0302\u0300",
  "\u1EAB": "a\u0302\u0303",
  "\u0227": "a\u0307",
  "\u01E1": "a\u0307\u0304",
  "\xE5": "a\u030A",
  "\u01FB": "a\u030A\u0301",
  "\u1E03": "b\u0307",
  "\u0107": "c\u0301",
  "\u1E09": "c\u0327\u0301",
  "\u010D": "c\u030C",
  "\u0109": "c\u0302",
  "\u010B": "c\u0307",
  "\xE7": "c\u0327",
  "\u010F": "d\u030C",
  "\u1E0B": "d\u0307",
  "\u1E11": "d\u0327",
  "\xE9": "e\u0301",
  "\xE8": "e\u0300",
  "\xEB": "e\u0308",
  "\u1EBD": "e\u0303",
  "\u0113": "e\u0304",
  "\u1E17": "e\u0304\u0301",
  "\u1E15": "e\u0304\u0300",
  "\u0115": "e\u0306",
  "\u1E1D": "e\u0327\u0306",
  "\u011B": "e\u030C",
  "\xEA": "e\u0302",
  "\u1EBF": "e\u0302\u0301",
  "\u1EC1": "e\u0302\u0300",
  "\u1EC5": "e\u0302\u0303",
  "\u0117": "e\u0307",
  "\u0229": "e\u0327",
  "\u1E1F": "f\u0307",
  "\u01F5": "g\u0301",
  "\u1E21": "g\u0304",
  "\u011F": "g\u0306",
  "\u01E7": "g\u030C",
  "\u011D": "g\u0302",
  "\u0121": "g\u0307",
  "\u0123": "g\u0327",
  "\u1E27": "h\u0308",
  "\u021F": "h\u030C",
  "\u0125": "h\u0302",
  "\u1E23": "h\u0307",
  "\u1E29": "h\u0327",
  "\xED": "i\u0301",
  "\xEC": "i\u0300",
  "\xEF": "i\u0308",
  "\u1E2F": "i\u0308\u0301",
  "\u0129": "i\u0303",
  "\u012B": "i\u0304",
  "\u012D": "i\u0306",
  "\u01D0": "i\u030C",
  "\xEE": "i\u0302",
  "\u01F0": "j\u030C",
  "\u0135": "j\u0302",
  "\u1E31": "k\u0301",
  "\u01E9": "k\u030C",
  "\u0137": "k\u0327",
  "\u013A": "l\u0301",
  "\u013E": "l\u030C",
  "\u013C": "l\u0327",
  "\u1E3F": "m\u0301",
  "\u1E41": "m\u0307",
  "\u0144": "n\u0301",
  "\u01F9": "n\u0300",
  "\xF1": "n\u0303",
  "\u0148": "n\u030C",
  "\u1E45": "n\u0307",
  "\u0146": "n\u0327",
  "\xF3": "o\u0301",
  "\xF2": "o\u0300",
  "\xF6": "o\u0308",
  "\u022B": "o\u0308\u0304",
  "\xF5": "o\u0303",
  "\u1E4D": "o\u0303\u0301",
  "\u1E4F": "o\u0303\u0308",
  "\u022D": "o\u0303\u0304",
  "\u014D": "o\u0304",
  "\u1E53": "o\u0304\u0301",
  "\u1E51": "o\u0304\u0300",
  "\u014F": "o\u0306",
  "\u01D2": "o\u030C",
  "\xF4": "o\u0302",
  "\u1ED1": "o\u0302\u0301",
  "\u1ED3": "o\u0302\u0300",
  "\u1ED7": "o\u0302\u0303",
  "\u022F": "o\u0307",
  "\u0231": "o\u0307\u0304",
  "\u0151": "o\u030B",
  "\u1E55": "p\u0301",
  "\u1E57": "p\u0307",
  "\u0155": "r\u0301",
  "\u0159": "r\u030C",
  "\u1E59": "r\u0307",
  "\u0157": "r\u0327",
  "\u015B": "s\u0301",
  "\u1E65": "s\u0301\u0307",
  "\u0161": "s\u030C",
  "\u1E67": "s\u030C\u0307",
  "\u015D": "s\u0302",
  "\u1E61": "s\u0307",
  "\u015F": "s\u0327",
  "\u1E97": "t\u0308",
  "\u0165": "t\u030C",
  "\u1E6B": "t\u0307",
  "\u0163": "t\u0327",
  "\xFA": "u\u0301",
  "\xF9": "u\u0300",
  "\xFC": "u\u0308",
  "\u01D8": "u\u0308\u0301",
  "\u01DC": "u\u0308\u0300",
  "\u01D6": "u\u0308\u0304",
  "\u01DA": "u\u0308\u030C",
  "\u0169": "u\u0303",
  "\u1E79": "u\u0303\u0301",
  "\u016B": "u\u0304",
  "\u1E7B": "u\u0304\u0308",
  "\u016D": "u\u0306",
  "\u01D4": "u\u030C",
  "\xFB": "u\u0302",
  "\u016F": "u\u030A",
  "\u0171": "u\u030B",
  "\u1E7D": "v\u0303",
  "\u1E83": "w\u0301",
  "\u1E81": "w\u0300",
  "\u1E85": "w\u0308",
  "\u0175": "w\u0302",
  "\u1E87": "w\u0307",
  "\u1E98": "w\u030A",
  "\u1E8D": "x\u0308",
  "\u1E8B": "x\u0307",
  "\xFD": "y\u0301",
  "\u1EF3": "y\u0300",
  "\xFF": "y\u0308",
  "\u1EF9": "y\u0303",
  "\u0233": "y\u0304",
  "\u0177": "y\u0302",
  "\u1E8F": "y\u0307",
  "\u1E99": "y\u030A",
  "\u017A": "z\u0301",
  "\u017E": "z\u030C",
  "\u1E91": "z\u0302",
  "\u017C": "z\u0307",
  "\xC1": "A\u0301",
  "\xC0": "A\u0300",
  "\xC4": "A\u0308",
  "\u01DE": "A\u0308\u0304",
  "\xC3": "A\u0303",
  "\u0100": "A\u0304",
  "\u0102": "A\u0306",
  "\u1EAE": "A\u0306\u0301",
  "\u1EB0": "A\u0306\u0300",
  "\u1EB4": "A\u0306\u0303",
  "\u01CD": "A\u030C",
  "\xC2": "A\u0302",
  "\u1EA4": "A\u0302\u0301",
  "\u1EA6": "A\u0302\u0300",
  "\u1EAA": "A\u0302\u0303",
  "\u0226": "A\u0307",
  "\u01E0": "A\u0307\u0304",
  "\xC5": "A\u030A",
  "\u01FA": "A\u030A\u0301",
  "\u1E02": "B\u0307",
  "\u0106": "C\u0301",
  "\u1E08": "C\u0327\u0301",
  "\u010C": "C\u030C",
  "\u0108": "C\u0302",
  "\u010A": "C\u0307",
  "\xC7": "C\u0327",
  "\u010E": "D\u030C",
  "\u1E0A": "D\u0307",
  "\u1E10": "D\u0327",
  "\xC9": "E\u0301",
  "\xC8": "E\u0300",
  "\xCB": "E\u0308",
  "\u1EBC": "E\u0303",
  "\u0112": "E\u0304",
  "\u1E16": "E\u0304\u0301",
  "\u1E14": "E\u0304\u0300",
  "\u0114": "E\u0306",
  "\u1E1C": "E\u0327\u0306",
  "\u011A": "E\u030C",
  "\xCA": "E\u0302",
  "\u1EBE": "E\u0302\u0301",
  "\u1EC0": "E\u0302\u0300",
  "\u1EC4": "E\u0302\u0303",
  "\u0116": "E\u0307",
  "\u0228": "E\u0327",
  "\u1E1E": "F\u0307",
  "\u01F4": "G\u0301",
  "\u1E20": "G\u0304",
  "\u011E": "G\u0306",
  "\u01E6": "G\u030C",
  "\u011C": "G\u0302",
  "\u0120": "G\u0307",
  "\u0122": "G\u0327",
  "\u1E26": "H\u0308",
  "\u021E": "H\u030C",
  "\u0124": "H\u0302",
  "\u1E22": "H\u0307",
  "\u1E28": "H\u0327",
  "\xCD": "I\u0301",
  "\xCC": "I\u0300",
  "\xCF": "I\u0308",
  "\u1E2E": "I\u0308\u0301",
  "\u0128": "I\u0303",
  "\u012A": "I\u0304",
  "\u012C": "I\u0306",
  "\u01CF": "I\u030C",
  "\xCE": "I\u0302",
  "\u0130": "I\u0307",
  "\u0134": "J\u0302",
  "\u1E30": "K\u0301",
  "\u01E8": "K\u030C",
  "\u0136": "K\u0327",
  "\u0139": "L\u0301",
  "\u013D": "L\u030C",
  "\u013B": "L\u0327",
  "\u1E3E": "M\u0301",
  "\u1E40": "M\u0307",
  "\u0143": "N\u0301",
  "\u01F8": "N\u0300",
  "\xD1": "N\u0303",
  "\u0147": "N\u030C",
  "\u1E44": "N\u0307",
  "\u0145": "N\u0327",
  "\xD3": "O\u0301",
  "\xD2": "O\u0300",
  "\xD6": "O\u0308",
  "\u022A": "O\u0308\u0304",
  "\xD5": "O\u0303",
  "\u1E4C": "O\u0303\u0301",
  "\u1E4E": "O\u0303\u0308",
  "\u022C": "O\u0303\u0304",
  "\u014C": "O\u0304",
  "\u1E52": "O\u0304\u0301",
  "\u1E50": "O\u0304\u0300",
  "\u014E": "O\u0306",
  "\u01D1": "O\u030C",
  "\xD4": "O\u0302",
  "\u1ED0": "O\u0302\u0301",
  "\u1ED2": "O\u0302\u0300",
  "\u1ED6": "O\u0302\u0303",
  "\u022E": "O\u0307",
  "\u0230": "O\u0307\u0304",
  "\u0150": "O\u030B",
  "\u1E54": "P\u0301",
  "\u1E56": "P\u0307",
  "\u0154": "R\u0301",
  "\u0158": "R\u030C",
  "\u1E58": "R\u0307",
  "\u0156": "R\u0327",
  "\u015A": "S\u0301",
  "\u1E64": "S\u0301\u0307",
  "\u0160": "S\u030C",
  "\u1E66": "S\u030C\u0307",
  "\u015C": "S\u0302",
  "\u1E60": "S\u0307",
  "\u015E": "S\u0327",
  "\u0164": "T\u030C",
  "\u1E6A": "T\u0307",
  "\u0162": "T\u0327",
  "\xDA": "U\u0301",
  "\xD9": "U\u0300",
  "\xDC": "U\u0308",
  "\u01D7": "U\u0308\u0301",
  "\u01DB": "U\u0308\u0300",
  "\u01D5": "U\u0308\u0304",
  "\u01D9": "U\u0308\u030C",
  "\u0168": "U\u0303",
  "\u1E78": "U\u0303\u0301",
  "\u016A": "U\u0304",
  "\u1E7A": "U\u0304\u0308",
  "\u016C": "U\u0306",
  "\u01D3": "U\u030C",
  "\xDB": "U\u0302",
  "\u016E": "U\u030A",
  "\u0170": "U\u030B",
  "\u1E7C": "V\u0303",
  "\u1E82": "W\u0301",
  "\u1E80": "W\u0300",
  "\u1E84": "W\u0308",
  "\u0174": "W\u0302",
  "\u1E86": "W\u0307",
  "\u1E8C": "X\u0308",
  "\u1E8A": "X\u0307",
  "\xDD": "Y\u0301",
  "\u1EF2": "Y\u0300",
  "\u0178": "Y\u0308",
  "\u1EF8": "Y\u0303",
  "\u0232": "Y\u0304",
  "\u0176": "Y\u0302",
  "\u1E8E": "Y\u0307",
  "\u0179": "Z\u0301",
  "\u017D": "Z\u030C",
  "\u1E90": "Z\u0302",
  "\u017B": "Z\u0307",
  "\u03AC": "\u03B1\u0301",
  "\u1F70": "\u03B1\u0300",
  "\u1FB1": "\u03B1\u0304",
  "\u1FB0": "\u03B1\u0306",
  "\u03AD": "\u03B5\u0301",
  "\u1F72": "\u03B5\u0300",
  "\u03AE": "\u03B7\u0301",
  "\u1F74": "\u03B7\u0300",
  "\u03AF": "\u03B9\u0301",
  "\u1F76": "\u03B9\u0300",
  "\u03CA": "\u03B9\u0308",
  "\u0390": "\u03B9\u0308\u0301",
  "\u1FD2": "\u03B9\u0308\u0300",
  "\u1FD1": "\u03B9\u0304",
  "\u1FD0": "\u03B9\u0306",
  "\u03CC": "\u03BF\u0301",
  "\u1F78": "\u03BF\u0300",
  "\u03CD": "\u03C5\u0301",
  "\u1F7A": "\u03C5\u0300",
  "\u03CB": "\u03C5\u0308",
  "\u03B0": "\u03C5\u0308\u0301",
  "\u1FE2": "\u03C5\u0308\u0300",
  "\u1FE1": "\u03C5\u0304",
  "\u1FE0": "\u03C5\u0306",
  "\u03CE": "\u03C9\u0301",
  "\u1F7C": "\u03C9\u0300",
  "\u038E": "\u03A5\u0301",
  "\u1FEA": "\u03A5\u0300",
  "\u03AB": "\u03A5\u0308",
  "\u1FE9": "\u03A5\u0304",
  "\u1FE8": "\u03A5\u0306",
  "\u038F": "\u03A9\u0301",
  "\u1FFA": "\u03A9\u0300"
};
var Parser = class _Parser {
  constructor(input, settings) {
    this.mode = void 0;
    this.gullet = void 0;
    this.settings = void 0;
    this.leftrightDepth = void 0;
    this.nextToken = void 0;
    this.mode = "math";
    this.gullet = new MacroExpander(input, settings, this.mode);
    this.settings = settings;
    this.leftrightDepth = 0;
    this.nextToken = null;
  }
  /**
   * Checks a result to make sure it has the right type, and throws an
   * appropriate error otherwise.
   */
  expect(text2, consume) {
    if (consume === void 0) {
      consume = true;
    }
    if (this.fetch().text !== text2) {
      throw new ParseError("Expected '" + text2 + "', got '" + this.fetch().text + "'", this.fetch());
    }
    if (consume) {
      this.consume();
    }
  }
  /**
   * Discards the current lookahead token, considering it consumed.
   */
  consume() {
    this.nextToken = null;
  }
  /**
   * Return the current lookahead token, or if there isn't one (at the
   * beginning, or if the previous lookahead token was consume()d),
   * fetch the next token as the new lookahead token and return it.
   */
  fetch() {
    if (this.nextToken == null) {
      this.nextToken = this.gullet.expandNextToken();
    }
    return this.nextToken;
  }
  /**
   * Switches between "text" and "math" modes.
   */
  switchMode(newMode) {
    this.mode = newMode;
    this.gullet.switchMode(newMode);
  }
  /**
   * Main parsing function, which parses an entire input.
   */
  parse() {
    if (!this.settings.globalGroup) {
      this.gullet.beginGroup();
    }
    if (this.settings.colorIsTextColor) {
      this.gullet.macros.set("\\color", "\\textcolor");
    }
    try {
      var parse2 = this.parseExpression(false);
      this.expect("EOF");
      if (!this.settings.globalGroup) {
        this.gullet.endGroup();
      }
      return parse2;
    } finally {
      this.gullet.endGroups();
    }
  }
  /**
   * Fully parse a separate sequence of tokens as a separate job.
   * Tokens should be specified in reverse order, as in a MacroDefinition.
   */
  subparse(tokens) {
    var oldToken = this.nextToken;
    this.consume();
    this.gullet.pushToken(new Token("}"));
    this.gullet.pushTokens(tokens);
    var parse2 = this.parseExpression(false);
    this.expect("}");
    this.nextToken = oldToken;
    return parse2;
  }
  /**
   * Parses an "expression", which is a list of atoms.
   *
   * `breakOnInfix`: Should the parsing stop when we hit infix nodes? This
   *                 happens when functions have higher precedence than infix
   *                 nodes in implicit parses.
   *
   * `breakOnTokenText`: The text of the token that the expression should end
   *                     with, or `null` if something else should end the
   *                     expression.
   */
  parseExpression(breakOnInfix, breakOnTokenText) {
    var body = [];
    while (true) {
      if (this.mode === "math") {
        this.consumeSpaces();
      }
      var lex = this.fetch();
      if (_Parser.endOfExpression.has(lex.text)) {
        break;
      }
      if (breakOnTokenText && lex.text === breakOnTokenText) {
        break;
      }
      if (breakOnInfix && functions[lex.text] && functions[lex.text].infix) {
        break;
      }
      var atom = this.parseAtom(breakOnTokenText);
      if (!atom) {
        break;
      } else if (atom.type === "internal") {
        continue;
      }
      body.push(atom);
    }
    if (this.mode === "text") {
      this.formLigatures(body);
    }
    return this.handleInfixNodes(body);
  }
  /**
   * Rewrites infix operators such as \over with corresponding commands such
   * as \frac.
   *
   * There can only be one infix operator per group.  If there's more than one
   * then the expression is ambiguous.  This can be resolved by adding {}.
   */
  handleInfixNodes(body) {
    var overIndex = -1;
    var funcName;
    for (var i4 = 0; i4 < body.length; i4++) {
      var node = body[i4];
      if (node.type === "infix") {
        if (overIndex !== -1) {
          throw new ParseError("only one infix operator per group", node.token);
        }
        overIndex = i4;
        funcName = node.replaceWith;
      }
    }
    if (overIndex !== -1 && funcName) {
      var numerNode;
      var denomNode;
      var numerBody = body.slice(0, overIndex);
      var denomBody = body.slice(overIndex + 1);
      if (numerBody.length === 1 && numerBody[0].type === "ordgroup") {
        numerNode = numerBody[0];
      } else {
        numerNode = {
          type: "ordgroup",
          mode: this.mode,
          body: numerBody
        };
      }
      if (denomBody.length === 1 && denomBody[0].type === "ordgroup") {
        denomNode = denomBody[0];
      } else {
        denomNode = {
          type: "ordgroup",
          mode: this.mode,
          body: denomBody
        };
      }
      var _node;
      if (funcName === "\\\\abovefrac") {
        _node = this.callFunction(funcName, [numerNode, body[overIndex], denomNode], []);
      } else {
        _node = this.callFunction(funcName, [numerNode, denomNode], []);
      }
      return [_node];
    } else {
      return body;
    }
  }
  /**
   * Handle a subscript or superscript with nice errors.
   */
  handleSupSubscript(name2) {
    var symbolToken = this.fetch();
    var symbol = symbolToken.text;
    this.consume();
    this.consumeSpaces();
    var group;
    do {
      var _group;
      group = this.parseGroup(name2);
    } while (((_group = group) == null ? void 0 : _group.type) === "internal");
    if (!group) {
      throw new ParseError("Expected group after '" + symbol + "'", symbolToken);
    }
    return group;
  }
  /**
   * Converts the textual input of an unsupported command into a text node
   * contained within a color node whose color is determined by errorColor
   */
  formatUnsupportedCmd(text2) {
    var textordArray = [];
    for (var i4 = 0; i4 < text2.length; i4++) {
      textordArray.push({
        type: "textord",
        mode: "text",
        text: text2[i4]
      });
    }
    var textNode = {
      type: "text",
      mode: this.mode,
      body: textordArray
    };
    var colorNode = {
      type: "color",
      mode: this.mode,
      color: this.settings.errorColor,
      body: [textNode]
    };
    return colorNode;
  }
  /**
   * Parses a group with optional super/subscripts.
   */
  parseAtom(breakOnTokenText) {
    var base = this.parseGroup("atom", breakOnTokenText);
    if ((base == null ? void 0 : base.type) === "internal") {
      return base;
    }
    if (this.mode === "text") {
      return base;
    }
    var superscript;
    var subscript;
    while (true) {
      this.consumeSpaces();
      var lex = this.fetch();
      if (lex.text === "\\limits" || lex.text === "\\nolimits") {
        if (base && base.type === "op") {
          var limits = lex.text === "\\limits";
          base.limits = limits;
          base.alwaysHandleSupSub = true;
        } else if (base && base.type === "operatorname") {
          if (base.alwaysHandleSupSub) {
            base.limits = lex.text === "\\limits";
          }
        } else {
          throw new ParseError("Limit controls must follow a math operator", lex);
        }
        this.consume();
      } else if (lex.text === "^") {
        if (superscript) {
          throw new ParseError("Double superscript", lex);
        }
        superscript = this.handleSupSubscript("superscript");
      } else if (lex.text === "_") {
        if (subscript) {
          throw new ParseError("Double subscript", lex);
        }
        subscript = this.handleSupSubscript("subscript");
      } else if (lex.text === "'") {
        if (superscript) {
          throw new ParseError("Double superscript", lex);
        }
        var prime = {
          type: "textord",
          mode: this.mode,
          text: "\\prime"
        };
        var primes = [prime];
        this.consume();
        while (this.fetch().text === "'") {
          primes.push(prime);
          this.consume();
        }
        if (this.fetch().text === "^") {
          primes.push(this.handleSupSubscript("superscript"));
        }
        superscript = {
          type: "ordgroup",
          mode: this.mode,
          body: primes
        };
      } else if (uSubsAndSups[lex.text]) {
        var isSub = unicodeSubRegEx.test(lex.text);
        var subsupTokens = [];
        subsupTokens.push(new Token(uSubsAndSups[lex.text]));
        this.consume();
        while (true) {
          var token = this.fetch().text;
          if (!uSubsAndSups[token]) {
            break;
          }
          if (unicodeSubRegEx.test(token) !== isSub) {
            break;
          }
          subsupTokens.unshift(new Token(uSubsAndSups[token]));
          this.consume();
        }
        var body = this.subparse(subsupTokens);
        if (isSub) {
          subscript = {
            type: "ordgroup",
            mode: "math",
            body
          };
        } else {
          superscript = {
            type: "ordgroup",
            mode: "math",
            body
          };
        }
      } else {
        break;
      }
    }
    if (superscript || subscript) {
      return {
        type: "supsub",
        mode: this.mode,
        base,
        sup: superscript,
        sub: subscript
      };
    } else {
      return base;
    }
  }
  /**
   * Parses an entire function, including its base and all of its arguments.
   */
  parseFunction(breakOnTokenText, name2) {
    var token = this.fetch();
    var func = token.text;
    var funcData = functions[func];
    if (!funcData) {
      return null;
    }
    this.consume();
    if (name2 && name2 !== "atom" && !funcData.allowedInArgument) {
      throw new ParseError("Got function '" + func + "' with no arguments" + (name2 ? " as " + name2 : ""), token);
    } else if (this.mode === "text" && !funcData.allowedInText) {
      throw new ParseError("Can't use function '" + func + "' in text mode", token);
    } else if (this.mode === "math" && funcData.allowedInMath === false) {
      throw new ParseError("Can't use function '" + func + "' in math mode", token);
    }
    var {
      args,
      optArgs
    } = this.parseArguments(func, funcData);
    return this.callFunction(func, args, optArgs, token, breakOnTokenText);
  }
  /**
   * Call a function handler with a suitable context and arguments.
   */
  callFunction(name2, args, optArgs, token, breakOnTokenText) {
    var context = {
      funcName: name2,
      parser: this,
      token,
      breakOnTokenText
    };
    var func = functions[name2];
    if (func && func.handler) {
      return func.handler(context, args, optArgs);
    } else {
      throw new ParseError("No function handler for " + name2);
    }
  }
  /**
   * Parses the arguments of a function or environment
   */
  parseArguments(func, funcData) {
    var totalArgs = funcData.numArgs + funcData.numOptionalArgs;
    if (totalArgs === 0) {
      return {
        args: [],
        optArgs: []
      };
    }
    var args = [];
    var optArgs = [];
    for (var i4 = 0; i4 < totalArgs; i4++) {
      var argType = funcData.argTypes && funcData.argTypes[i4];
      var isOptional = i4 < funcData.numOptionalArgs;
      if ("primitive" in funcData && funcData.primitive && argType == null || // \sqrt expands into primitive if optional argument doesn't exist
      funcData.type === "sqrt" && i4 === 1 && optArgs[0] == null) {
        argType = "primitive";
      }
      var arg = this.parseGroupOfType("argument to '" + func + "'", argType, isOptional);
      if (isOptional) {
        optArgs.push(arg);
      } else if (arg != null) {
        args.push(arg);
      } else {
        throw new ParseError("Null argument, please report this as a bug");
      }
    }
    return {
      args,
      optArgs
    };
  }
  /**
   * Parses a group when the mode is changing.
   */
  parseGroupOfType(name2, type, optional) {
    switch (type) {
      case "color":
        return this.parseColorGroup(optional);
      case "size":
        return this.parseSizeGroup(optional);
      case "url":
        return this.parseUrlGroup(optional);
      case "math":
      case "text":
        return this.parseArgumentGroup(optional, type);
      case "hbox": {
        var group = this.parseArgumentGroup(optional, "text");
        return group != null ? {
          type: "styling",
          mode: group.mode,
          body: [group],
          style: "text",
          // simulate \textstyle
          resetFont: true
        } : null;
      }
      case "raw": {
        var token = this.parseStringGroup("raw", optional);
        return token != null ? {
          type: "raw",
          mode: "text",
          string: token.text
        } : null;
      }
      case "primitive": {
        if (optional) {
          throw new ParseError("A primitive argument cannot be optional");
        }
        var _group2 = this.parseGroup(name2);
        if (_group2 == null) {
          throw new ParseError("Expected group as " + name2, this.fetch());
        }
        return _group2;
      }
      case "original":
      case null:
      case void 0:
        return this.parseArgumentGroup(optional);
      default:
        throw new ParseError("Unknown group type as " + name2, this.fetch());
    }
  }
  /**
   * Discard any space tokens, fetching the next non-space token.
   */
  consumeSpaces() {
    while (this.fetch().text === " ") {
      this.consume();
    }
  }
  /**
   * Parses a group, essentially returning the string formed by the
   * brace-enclosed tokens plus some position information.
   */
  parseStringGroup(modeName, optional) {
    var argToken = this.gullet.scanArgument(optional);
    if (argToken == null) {
      return null;
    }
    var str = "";
    var nextToken;
    while ((nextToken = this.fetch()).text !== "EOF") {
      str += nextToken.text;
      this.consume();
    }
    this.consume();
    argToken.text = str;
    return argToken;
  }
  /**
   * Parses a regex-delimited group: the largest sequence of tokens
   * whose concatenated strings match `regex`. Returns the string
   * formed by the tokens plus some position information.
   */
  parseRegexGroup(regex, modeName) {
    var firstToken = this.fetch();
    var lastToken = firstToken;
    var str = "";
    var nextToken;
    while ((nextToken = this.fetch()).text !== "EOF" && regex.test(str + nextToken.text)) {
      lastToken = nextToken;
      str += lastToken.text;
      this.consume();
    }
    if (str === "") {
      throw new ParseError("Invalid " + modeName + ": '" + firstToken.text + "'", firstToken);
    }
    return firstToken.range(lastToken, str);
  }
  /**
   * Parses a color description.
   */
  parseColorGroup(optional) {
    var res = this.parseStringGroup("color", optional);
    if (res == null) {
      return null;
    }
    var match = /^(#[a-f0-9]{3,4}|#[a-f0-9]{6}|#[a-f0-9]{8}|[a-f0-9]{6}|[a-z]+)$/i.exec(res.text);
    if (!match) {
      throw new ParseError("Invalid color: '" + res.text + "'", res);
    }
    var color = match[0];
    if (/^[0-9a-f]{6}$/i.test(color)) {
      color = "#" + color;
    }
    return {
      type: "color-token",
      mode: this.mode,
      color
    };
  }
  /**
   * Parses a size specification, consisting of magnitude and unit.
   */
  parseSizeGroup(optional) {
    var res;
    var isBlank = false;
    this.gullet.consumeSpaces();
    if (!optional && this.gullet.future().text !== "{") {
      res = this.parseRegexGroup(/^[-+]? *(?:$|\d+|\d+\.\d*|\.\d*) *[a-z]{0,2} *$/, "size");
    } else {
      res = this.parseStringGroup("size", optional);
    }
    if (!res) {
      return null;
    }
    if (!optional && res.text.length === 0) {
      res.text = "0pt";
      isBlank = true;
    }
    var match = /([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(res.text);
    if (!match) {
      throw new ParseError("Invalid size: '" + res.text + "'", res);
    }
    var data = {
      number: +(match[1] + match[2]),
      // sign + magnitude, cast to number
      unit: match[3]
    };
    if (!validUnit(data)) {
      throw new ParseError("Invalid unit: '" + data.unit + "'", res);
    }
    return {
      type: "size",
      mode: this.mode,
      value: data,
      isBlank
    };
  }
  /**
   * Parses an URL, checking escaped letters and allowed protocols,
   * and setting the catcode of % as an active character (as in \hyperref).
   */
  parseUrlGroup(optional) {
    this.gullet.lexer.setCatcode("%", 13);
    this.gullet.lexer.setCatcode("~", 12);
    var res = this.parseStringGroup("url", optional);
    this.gullet.lexer.setCatcode("%", 14);
    this.gullet.lexer.setCatcode("~", 13);
    if (res == null) {
      return null;
    }
    var url = res.text.replace(/\\([#$%&~_^{}])/g, "$1");
    return {
      type: "url",
      mode: this.mode,
      url
    };
  }
  /**
   * Parses an argument with the mode specified.
   */
  parseArgumentGroup(optional, mode) {
    var argToken = this.gullet.scanArgument(optional);
    if (argToken == null) {
      return null;
    }
    var outerMode = this.mode;
    if (mode) {
      this.switchMode(mode);
    }
    this.gullet.beginGroup();
    var expression = this.parseExpression(false, "EOF");
    this.expect("EOF");
    this.gullet.endGroup();
    var result = {
      type: "ordgroup",
      mode: this.mode,
      loc: argToken.loc,
      body: expression
    };
    if (mode) {
      this.switchMode(outerMode);
    }
    return result;
  }
  /**
   * Parses an ordinary group, which is either a single nucleus (like "x")
   * or an expression in braces (like "{x+y}") or an implicit group, a group
   * that starts at the current position, and ends right before a higher explicit
   * group ends, or at EOF.
   */
  parseGroup(name2, breakOnTokenText) {
    var firstToken = this.fetch();
    var text2 = firstToken.text;
    var result;
    if (text2 === "{" || text2 === "\\begingroup") {
      this.consume();
      var groupEnd = text2 === "{" ? "}" : "\\endgroup";
      this.gullet.beginGroup();
      var expression = this.parseExpression(false, groupEnd);
      var lastToken = this.fetch();
      this.expect(groupEnd);
      this.gullet.endGroup();
      result = {
        type: "ordgroup",
        mode: this.mode,
        loc: SourceLocation.range(firstToken, lastToken),
        body: expression,
        // A group formed by \begingroup...\endgroup is a semi-simple group
        // which doesn't affect spacing in math mode, i.e., is transparent.
        // https://tex.stackexchange.com/questions/1930/when-should-one-
        // use-begingroup-instead-of-bgroup
        semisimple: text2 === "\\begingroup" || void 0
      };
    } else {
      result = this.parseFunction(breakOnTokenText, name2) || this.parseSymbol();
      if (result == null && text2[0] === "\\" && !implicitCommands.hasOwnProperty(text2)) {
        if (this.settings.throwOnError) {
          throw new ParseError("Undefined control sequence: " + text2, firstToken);
        }
        result = this.formatUnsupportedCmd(text2);
        this.consume();
      }
    }
    return result;
  }
  /**
   * Form ligature-like combinations of characters for text mode.
   * This includes inputs like "--", "---", "``" and "''".
   * The result will simply replace multiple textord nodes with a single
   * character in each value by a single textord node having multiple
   * characters in its value.  The representation is still ASCII source.
   * The group will be modified in place.
   */
  formLigatures(group) {
    var n3 = group.length - 1;
    for (var i4 = 0; i4 < n3; ++i4) {
      var a3 = group[i4];
      if (a3.type !== "textord") {
        continue;
      }
      var v2 = a3.text;
      var next = group[i4 + 1];
      if (!next || next.type !== "textord") {
        continue;
      }
      if (v2 === "-" && next.text === "-") {
        var afterNext = group[i4 + 2];
        if (i4 + 1 < n3 && afterNext && afterNext.type === "textord" && afterNext.text === "-") {
          group.splice(i4, 3, {
            type: "textord",
            mode: "text",
            loc: SourceLocation.range(a3, afterNext),
            text: "---"
          });
          n3 -= 2;
        } else {
          group.splice(i4, 2, {
            type: "textord",
            mode: "text",
            loc: SourceLocation.range(a3, next),
            text: "--"
          });
          n3 -= 1;
        }
      }
      if ((v2 === "'" || v2 === "`") && next.text === v2) {
        group.splice(i4, 2, {
          type: "textord",
          mode: "text",
          loc: SourceLocation.range(a3, next),
          text: v2 + v2
        });
        n3 -= 1;
      }
    }
  }
  /**
   * Parse a single symbol out of the string. Here, we handle single character
   * symbols and special functions like \verb.
   */
  parseSymbol() {
    var nucleus = this.fetch();
    var text2 = nucleus.text;
    if (/^\\verb[^a-zA-Z]/.test(text2)) {
      this.consume();
      var arg = text2.slice(5);
      var star = arg.charAt(0) === "*";
      if (star) {
        arg = arg.slice(1);
      }
      if (arg.length < 2 || arg.charAt(0) !== arg.slice(-1)) {
        throw new ParseError("\\verb assertion failed --\n                    please report what input caused this bug");
      }
      arg = arg.slice(1, -1);
      return {
        type: "verb",
        mode: "text",
        body: arg,
        star
      };
    }
    if (unicodeSymbols.hasOwnProperty(text2[0]) && !symbols2[this.mode][text2[0]]) {
      if (this.settings.strict && this.mode === "math") {
        this.settings.reportNonstrict("unicodeTextInMathMode", 'Accented Unicode text character "' + text2[0] + '" used in math mode', nucleus);
      }
      text2 = unicodeSymbols[text2[0]] + text2.slice(1);
    }
    var match = combiningDiacriticalMarksEndRegex.exec(text2);
    if (match) {
      text2 = text2.substring(0, match.index);
      if (text2 === "i") {
        text2 = "\u0131";
      } else if (text2 === "j") {
        text2 = "\u0237";
      }
    }
    var symbol;
    if (symbols2[this.mode][text2]) {
      if (this.settings.strict && this.mode === "math" && extraLatin.includes(text2)) {
        this.settings.reportNonstrict("unicodeTextInMathMode", 'Latin-1/Unicode text character "' + text2[0] + '" used in math mode', nucleus);
      }
      var group = symbols2[this.mode][text2].group;
      var loc = SourceLocation.range(nucleus);
      var s2;
      if (isAtom(group)) {
        s2 = {
          type: "atom",
          mode: this.mode,
          family: group,
          loc,
          text: text2
        };
      } else {
        s2 = {
          type: group,
          mode: this.mode,
          loc,
          text: text2
        };
      }
      symbol = s2;
    } else if (text2.charCodeAt(0) >= 128) {
      if (this.settings.strict) {
        if (!supportedCodepoint(text2.charCodeAt(0))) {
          this.settings.reportNonstrict("unknownSymbol", 'Unrecognized Unicode character "' + text2[0] + '"' + (" (" + text2.charCodeAt(0) + ")"), nucleus);
        } else if (this.mode === "math") {
          this.settings.reportNonstrict("unicodeTextInMathMode", 'Unicode text character "' + text2[0] + '" used in math mode', nucleus);
        }
      }
      symbol = {
        type: "textord",
        mode: "text",
        loc: SourceLocation.range(nucleus),
        text: text2
      };
    } else {
      return null;
    }
    this.consume();
    if (match) {
      for (var i4 = 0; i4 < match[0].length; i4++) {
        var accent2 = match[0][i4];
        if (!unicodeAccents[accent2]) {
          throw new ParseError("Unknown accent ' " + accent2 + "'", nucleus);
        }
        var command = unicodeAccents[accent2][this.mode] || unicodeAccents[accent2].text;
        if (!command) {
          throw new ParseError("Accent " + accent2 + " unsupported in " + this.mode + " mode", nucleus);
        }
        symbol = {
          type: "accent",
          mode: this.mode,
          loc: SourceLocation.range(nucleus),
          label: command,
          isStretchy: false,
          isShifty: true,
          base: symbol
        };
      }
    }
    return symbol;
  }
};
Parser.endOfExpression = /* @__PURE__ */ new Set(["}", "\\endgroup", "\\end", "\\right", "&"]);
var parseTree = function parseTree2(toParse, settings) {
  if (!(typeof toParse === "string" || toParse instanceof String)) {
    throw new TypeError("KaTeX can only parse string typed expression");
  }
  var parser = new Parser(toParse, settings);
  delete parser.gullet.macros.current["\\df@tag"];
  var tree = parser.parse();
  delete parser.gullet.macros.current["\\current@color"];
  delete parser.gullet.macros.current["\\color"];
  if (parser.gullet.macros.get("\\df@tag")) {
    if (!settings.displayMode) {
      throw new ParseError("\\tag works only in display equations");
    }
    tree = [{
      type: "tag",
      mode: "text",
      body: tree,
      tag: parser.subparse([new Token("\\df@tag")])
    }];
  }
  return tree;
};
var render = function render2(expression, baseNode, options) {
  baseNode.textContent = "";
  var node = renderToDomTree(expression, options).toNode();
  baseNode.appendChild(node);
};
if (typeof document !== "undefined") {
  if (document.compatMode !== "CSS1Compat") {
    typeof console !== "undefined" && console.warn("Warning: KaTeX doesn't work in quirks mode. Make sure your website has a suitable doctype.");
    render = function render3() {
      throw new ParseError("KaTeX doesn't work in quirks mode.");
    };
  }
}
var renderToString = function renderToString2(expression, options) {
  var markup = renderToDomTree(expression, options).toMarkup();
  return markup;
};
var generateParseTree = function generateParseTree2(expression, options) {
  var settings = new Settings(options);
  return parseTree(expression, settings);
};
var renderError = function renderError2(error, expression, options) {
  if (options.throwOnError || !(error instanceof ParseError)) {
    throw error;
  }
  var node = makeSpan(["katex-error"], [new SymbolNode(expression)]);
  node.setAttribute("title", error.toString());
  node.setAttribute("style", "color:" + options.errorColor);
  return node;
};
var renderToDomTree = function renderToDomTree2(expression, options) {
  var settings = new Settings(options);
  try {
    var tree = parseTree(expression, settings);
    return buildTree(tree, expression, settings);
  } catch (error) {
    return renderError(error, expression, settings);
  }
};
var renderToHTMLTree = function renderToHTMLTree2(expression, options) {
  var settings = new Settings(options);
  try {
    var tree = parseTree(expression, settings);
    return buildHTMLTree(tree, expression, settings);
  } catch (error) {
    return renderError(error, expression, settings);
  }
};
var version2 = "0.16.47";
var __domTree = {
  Span,
  Anchor,
  SymbolNode,
  SvgNode,
  PathNode,
  LineNode
};
var katex = {
  /**
   * Current KaTeX version
   */
  version: version2,
  /**
   * Renders the given LaTeX into an HTML+MathML combination, and adds
   * it as a child to the specified DOM node.
   */
  render,
  /**
   * Renders the given LaTeX into an HTML+MathML combination string,
   * for sending to the client.
   */
  renderToString,
  /**
   * KaTeX error, usually during parsing.
   */
  ParseError,
  /**
   * The schema of Settings
   */
  SETTINGS_SCHEMA,
  /**
   * Parses the given LaTeX into KaTeX's internal parse tree structure,
   * without rendering to HTML or MathML.
   *
   * NOTE: This method is not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */
  __parse: generateParseTree,
  /**
   * Renders the given LaTeX into an HTML+MathML internal DOM tree
   * representation, without flattening that representation to a string.
   *
   * NOTE: This method is not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */
  __renderToDomTree: renderToDomTree,
  /**
   * Renders the given LaTeX into an HTML internal DOM tree representation,
   * without MathML and without flattening that representation to a string.
   *
   * NOTE: This method is not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */
  __renderToHTMLTree: renderToHTMLTree,
  /**
   * extends internal font metrics object with a new object
   * each key in the new object represents a font name
  */
  __setFontMetrics: setFontMetrics,
  /**
   * adds a new symbol to builtin symbols table
   */
  __defineSymbol: defineSymbol,
  /**
   * adds a new function to builtin function list,
   * which directly produce parse tree elements
   * and have their own html/mathml builders
   */
  __defineFunction: defineFunction,
  /**
   * adds a new macro to builtin macro list
   */
  __defineMacro: defineMacro,
  /**
   * Expose the dom tree node types, which can be useful for type checking nodes.
   *
   * NOTE: These methods are not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */
  __domTree
};

// lib/snl-doc-schema.ts
function isMacroDocumentV11(value) {
  if (!isRecord(value)) return false;
  return Object.values(value).every((macro) => {
    if (!isRecord(macro) || typeof macro.name !== "string" || typeof macro.description !== "string" || typeof macro.kind !== "string" || !macro.kind || macro.kind === "partial" || typeof macro.dynamic_arity !== "boolean" || !isRecord(macro.source) || !isStringArray(macro.source.entries) || !isStringArray(macro.source.urls) || !isStringArray(macro.tags) || macro.tags.some((tag) => tag.includes("\\")) || Object.hasOwn(macro, "default_style") || !Array.isArray(macro.styles) || macro.styles.length === 0) {
      return false;
    }
    const names = /* @__PURE__ */ new Set();
    return macro.styles.every((style) => {
      if (!isRecord(style) || typeof style.style_name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(style.style_name) || names.has(style.style_name) || !isStringArray(style.tags) || style.tags.some((tag) => tag.includes("\\")) || Object.keys(style).some((field) => !["style_name", "tags", "template"].includes(field))) {
        return false;
      }
      names.add(style.style_name);
      const projections = macroV11TemplateProjections(style.template);
      if (!projections?.length) return false;
      const contracts = new Set(projections.map((projection) => {
        const placeholders = analyzePlaceholders(projection.body);
        return `${placeholders.variadic ? "dynamic" : "fixed"}:${placeholders.arity}`;
      }));
      return contracts.size === 1 && projections.every((projection) => {
        const placeholders = analyzePlaceholders(projection.body);
        return !placeholders.invalid && placeholders.variadic === macro.dynamic_arity;
      });
    });
  });
}
function macroV11TemplateProjections(value) {
  if (isTemplate(value)) return [value];
  if (!isRecord(value) || value.type !== "i18n" || typeof value.default_language !== "string" || !value.default_language || !isRecord(value.values) || !Object.hasOwn(value.values, value.default_language) || Object.keys(value).some((field) => !["type", "default_language", "values"].includes(field))) {
    return null;
  }
  const projections = Object.values(value.values);
  return projections.length > 0 && projections.every(isTemplate) ? projections : null;
}
function isTemplate(value) {
  if (!isRecord(value) || Object.hasOwn(value, "type") || !["formula_inline", "formula_display", "text", "block"].includes(String(value.mode)) || typeof value.body !== "string" || value.mode !== "block" && !value.body.trim() || value.separator !== void 0 && typeof value.separator !== "string") {
    return false;
  }
  return value.block_template_name === void 0 || value.mode === "block" && typeof value.block_template_name === "string";
}
function analyzePlaceholders(body) {
  let variadic = false;
  let max = -1;
  let invalid2 = false;
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] !== "#" || index > 0 && body[index - 1] === "\\") continue;
    const next = body[index + 1];
    if (next === "*") {
      variadic = true;
      index += 1;
    } else if (next !== void 0 && /\d/.test(next)) {
      let end = index + 2;
      while (end < body.length && /\d/.test(body[end])) end += 1;
      const digits = body.slice(index + 1, end);
      if (/^(?:0|[1-9]\d?)$/.test(digits)) max = Math.max(max, Number(digits));
      else invalid2 = true;
      index = end - 1;
    } else {
      invalid2 = true;
    }
  }
  return { variadic, arity: max + 1, invalid: invalid2 };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// lib/snl-doc.ts
function snlDocRoot(workspaceRoot) {
  return path2.resolve(workspaceRoot, ".SNL_Doc");
}
function configPath(workspaceRoot) {
  return path2.join(snlDocRoot(workspaceRoot), "config.json");
}
function entriesPath(workspaceRoot) {
  return path2.join(snlDocRoot(workspaceRoot), "entries.json");
}
function entryEntitiesDir(workspaceRoot) {
  return path2.join(snlDocRoot(workspaceRoot), "entries");
}
function macroEntitiesDir(workspaceRoot) {
  return path2.join(snlDocRoot(workspaceRoot), "macros");
}
function packageManifestsDir(workspaceRoot) {
  return path2.join(snlDocRoot(workspaceRoot), "packages");
}
function termMacrosDir(workspaceRoot) {
  return path2.join(snlDocRoot(workspaceRoot), "term_macros");
}
async function pathExists(p3) {
  try {
    await fs.lstat(p3);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function readJson(p3) {
  let handle;
  try {
    handle = await fs.open(p3, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error(`${p3} must be a regular, non-symlink file.`);
    return JSON.parse(await handle.readFile("utf8"));
  } catch (error) {
    if (error.code === "ELOOP") {
      throw new Error(`${p3} must be a regular, non-symlink file.`);
    }
    throw error;
  } finally {
    await handle?.close();
  }
}
async function assertSnlDoc(workspaceRoot) {
  const dir = snlDocRoot(workspaceRoot);
  let stat;
  try {
    stat = await fs.lstat(dir);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    throw new Error(
      `No .SNL_Doc/ folder at ${workspaceRoot}. Point --root at the workspace that contains .SNL_Doc/.`
    );
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${dir} must be a regular, non-symlink directory.`);
  }
}
function usesCurrentEntitySchemas(config) {
  return isRecord2(config) && (config.version === "0.0.11" || config.version === "0.1.0");
}
async function readConfig(workspaceRoot) {
  await assertSnlDoc(workspaceRoot);
  const p3 = configPath(workspaceRoot);
  if (!await pathExists(p3)) {
    return { version: "0.0.0" };
  }
  const config = await readJson(p3);
  if (usesCurrentEntitySchemas(config)) assertCurrentKindCatalogs(config);
  return config;
}
function assertCurrentKindCatalogs(config) {
  for (const field of ["entry_kinds", "macro_kinds"]) {
    const catalog = config[field];
    if (!Array.isArray(catalog)) throw new Error(`config.json#${field} must be an array.`);
    const ids = /* @__PURE__ */ new Set();
    catalog.forEach((value, index) => {
      const kind = value;
      if (!isRecord2(value) || typeof value.id !== "string" || !value.id || value.id !== value.id.trim()) {
        throw new Error(`config.json#${field}[${index}].id must be a canonical non-empty string.`);
      }
      if (ids.has(value.id)) {
        throw new Error(`config.json#${field} contains duplicate id ${JSON.stringify(value.id)}.`);
      }
      ids.add(value.id);
      if (field === "entry_kinds") {
        if (!isLocalizedLabel(kind.name, true)) {
          throw new Error(`config.json#entry_kinds[${index}].name must be a non-empty string or valid I18n map.`);
        }
        if (kind.description !== void 0 && !isLocalizedLabel(kind.description, false)) {
          throw new Error(`config.json#entry_kinds[${index}].description must be a string or valid I18n map.`);
        }
        if (typeof kind.defaultCounterName !== "string" || typeof kind.style !== "string") {
          throw new Error(`config.json#entry_kinds[${index}] requires string defaultCounterName and style.`);
        }
      } else if (typeof kind.name !== "string" || typeof kind.description !== "string") {
        throw new Error(`config.json#macro_kinds[${index}] requires string name and description.`);
      }
      assertThemedColoring(kind.coloring, `config.json#${field}[${index}].coloring`);
    });
  }
}
function isLocalizedLabel(value, required) {
  if (typeof value === "string") return !required || !!value.trim();
  if (!isRecord2(value) || value.type !== "i18n" || typeof value.default_language !== "string" || !isRecord2(value.values)) {
    return false;
  }
  const values = Object.values(value.values);
  return values.length > 0 && values.every((item) => typeof item === "string") && (!required || values.some((item) => item.trim()));
}
function assertThemedColoring(value, label) {
  if (!isRecord2(value) || Object.hasOwn(value, "stroke") || Object.hasOwn(value, "background")) {
    throw new Error(`${label} must contain light and dark variants.`);
  }
  for (const theme of ["light", "dark"]) {
    const variant = value[theme];
    if (!isRecord2(variant) || typeof variant.stroke !== "string" || !variant.stroke.trim() || typeof variant.background !== "string" || !variant.background.trim()) {
      throw new Error(`${label}.${theme} requires non-empty string stroke and background.`);
    }
  }
}
function usesEntityStorage(config) {
  if (!isRecord2(config) || typeof config.version !== "string") {
    throw new Error("config.json must be an object with a string version.");
  }
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(config.version);
  if (!match) throw new Error(`config.json has invalid data version ${JSON.stringify(config.version)}.`);
  const parts = match.slice(1).map(Number);
  const current = usesCurrentEntitySchemas(config) || config.version === "0.0.6";
  const legacy = parts[0] === 0 && parts[1] === 0 && parts[2] < 6;
  if (legacy) return false;
  if (!current) {
    throw new Error(`Unsupported future workspace data version ${config.version}; update the Toolkit instead of guessing its storage layout.`);
  }
  if (!Object.prototype.hasOwnProperty.call(config, "entity_storage")) {
    throw new Error(`Workspace data ${config.version} requires entity_storage.version = 1; refusing frozen aggregate fallback.`);
  }
  if (!isRecord2(config.entity_storage) || config.entity_storage.version !== 1) {
    throw new Error(`config.json has unsupported entity_storage version ${JSON.stringify(config.entity_storage?.version)}.`);
  }
  return true;
}
async function assertEntityStorageTopology(workspaceRoot, config) {
  const storage = config.entity_storage;
  if (!storage || storage.version !== 1 || storage.legacy_backup_version !== "0.0.5" || storage.entry_default_package !== UNPACKAGED_PACKAGE_ID || !storage.receipt || typeof storage.receipt !== "object" || Array.isArray(storage.receipt)) {
    throw new Error(`Workspace data ${config.version} requires complete entity_storage v1 metadata and receipt.`);
  }
  for (const [name2, directory] of [
    ["packages", packageManifestsDir(workspaceRoot)],
    ["entries", entryEntitiesDir(workspaceRoot)],
    ["macros", macroEntitiesDir(workspaceRoot)]
  ]) {
    try {
      const stat = await fs.lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error(`${directory} must be a regular, non-symlink directory.`);
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`Current workspace is missing required entity directory ${name2}.`);
      }
      throw error;
    }
  }
  if (config.active_macro_packages !== void 0) {
    if (!Array.isArray(config.active_macro_packages) || !config.active_macro_packages.every((value) => typeof value === "string")) {
      throw new Error("active_macro_packages must be an array of Package IDs.");
    }
    for (const packageId of config.active_macro_packages) {
      if (packageId === UNPACKAGED_PACKAGE_ID) {
        throw new Error("active_macro_packages cannot activate the system _unpackaged Package.");
      }
      if (packageId !== packageId.trim()) {
        throw new Error("active_macro_packages contains a whitespace-padded Package ID.");
      }
      packageManifestPath(packageId);
    }
  }
  const entriesFile = entriesPath(workspaceRoot);
  let legacyEntries = null;
  if (await pathExists(entriesFile)) {
    const stat = await fs.lstat(entriesFile);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`${entriesFile} must be a regular, non-symlink legacy backup file.`);
    }
    legacyEntries = await readJson(entriesFile);
  }
  const legacyPackages = /* @__PURE__ */ new Map();
  for (const { relativePath, value } of await readJsonDirectory(termMacrosDir(workspaceRoot))) {
    legacyPackages.set(path2.basename(relativePath), value);
  }
  const actual = makeEntityStorageReceipt(
    legacyEntries,
    legacyPackages,
    legacyEntries !== null || legacyPackages.size > 0
  );
  if (JSON.stringify(storage.receipt) !== JSON.stringify(actual)) {
    throw new Error("Current entity topology migration receipt does not match the frozen legacy backup.");
  }
  const manifests = await readEntityPackageManifests(workspaceRoot);
  for (const packageId of config.active_macro_packages ?? []) {
    if (!manifests.has(packageId)) {
      throw new Error(`Active Macro Package ${JSON.stringify(packageId)} has no Package manifest.`);
    }
  }
}
async function readEntries(workspaceRoot) {
  const config = await readConfig(workspaceRoot);
  if (usesEntityStorage(config)) {
    await assertEntityStorageTopology(workspaceRoot, config);
    const manifests = await readEntityPackageManifests(workspaceRoot, usesCurrentEntitySchemas(config));
    const records = await readJsonDirectory(entryEntitiesDir(workspaceRoot), true);
    const ids = /* @__PURE__ */ new Set();
    const entries = records.map(({ relativePath, value }) => {
      if (!isRecord2(value) || value.format !== "snl-entry" || value.version !== ENTRY_STORAGE_VERSION || typeof value.package !== "string" || !isRecord2(value.entry) || typeof value.entry.id !== "string" || !value.entry.id || value.entry.id !== value.entry.id.trim() || typeof value.entry.package !== "string") {
        throw new Error(`${relativePath} is not a valid SNL Entry envelope.`);
      }
      assertCompatibleSchemaMarker(value, CURRENT_ENTRY_SCHEMA_VERSION, `${relativePath} Entry envelope`);
      if (value.entry.package !== value.package) {
        throw new Error(`${relativePath} Entry package disagrees with its envelope package.`);
      }
      if (!manifests.has(value.package)) {
        throw new Error(`${relativePath} references missing Package ${JSON.stringify(value.package)}.`);
      }
      assertExpectedEntityPath(relativePath, entryEntityPath(value.package, value.entry.id));
      if (ids.has(value.entry.id)) {
        throw new Error(`Duplicate Entry identity ${JSON.stringify(value.entry.id)}.`);
      }
      ids.add(value.entry.id);
      return value.entry;
    }).sort((left, right) => left.package.localeCompare(right.package) || left.id.localeCompare(right.id));
    if (usesCurrentEntitySchemas(config)) {
      for (const manifest of manifests.values()) {
        const actual = entries.filter((entry) => entry.package === manifest.id).map((entry) => entry.id).sort((left, right) => left.localeCompare(right));
        if (JSON.stringify(manifest.entry_ids) !== JSON.stringify(actual)) {
          throw new Error(
            `Package ${JSON.stringify(manifest.id)} entry_ids does not exactly match its owned Entry entities.`
          );
        }
      }
    }
    return entries;
  }
  const p3 = entriesPath(workspaceRoot);
  if (!await pathExists(p3)) {
    return [];
  }
  const raw = await readJson(p3);
  if (!Array.isArray(raw)) {
    throw new Error(`${p3} is not a JSON array`);
  }
  return raw;
}
function defineIdentity(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true
  });
}
async function readAllMacroPackages(workspaceRoot) {
  const config = await readConfig(workspaceRoot);
  if (usesEntityStorage(config)) {
    await assertEntityStorageTopology(workspaceRoot, config);
    return readEntityMacroPackages(workspaceRoot);
  }
  const dir = termMacrosDir(workspaceRoot);
  if (!await pathExists(dir)) {
    return {};
  }
  const names = await fs.readdir(dir);
  const out = {};
  for (const name2 of names) {
    if (!name2.endsWith(".json")) continue;
    const bare = name2.replace(/\.json$/i, "");
    try {
      defineIdentity(out, bare, await readJson(path2.join(dir, name2)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read macro package '${bare}': ${msg}`);
    }
  }
  return out;
}
async function readEntityMacroPackages(workspaceRoot) {
  const config = await readConfig(workspaceRoot);
  const manifests = await readEntityPackageManifests(workspaceRoot, usesCurrentEntitySchemas(config));
  const macros2 = /* @__PURE__ */ new Map();
  const identities = /* @__PURE__ */ new Set();
  for (const { relativePath, value } of await readJsonDirectory(macroEntitiesDir(workspaceRoot), true)) {
    if (!isRecord2(value) || value.format !== "snl-macro" || value.version !== MACRO_STORAGE_VERSION || typeof value.package !== "string" || !isRecord2(value.macro) || typeof value.macro.name !== "string" || !value.macro.name || value.macro.name !== value.macro.name.trim()) {
      throw new Error(`${relativePath} is not a valid SNL Macro envelope.`);
    }
    assertCompatibleSchemaMarker(value, CURRENT_MACRO_SCHEMA_VERSION, `${relativePath} Macro envelope`);
    const macroDocument = /* @__PURE__ */ Object.create(null);
    macroDocument[value.macro.name] = value.macro;
    const currentMacro = usesCurrentEntitySchemas(config);
    if (currentMacro ? !isMacroDocumentV11(macroDocument) : !f(macroDocument)) {
      throw new Error(
        `${relativePath} Macro payload is not valid Macro v${currentMacro ? "11" : "8"} data.`
      );
    }
    assertExpectedEntityPath(relativePath, macroEntityPath(value.package, value.macro.name));
    if (!manifests.has(value.package)) {
      throw new Error(`${relativePath} references missing Package ${JSON.stringify(value.package)}.`);
    }
    const identity = `${value.package}\0${value.macro.name}`;
    if (identities.has(identity)) throw new Error(`Duplicate Macro identity ${JSON.stringify(identity)}.`);
    identities.add(identity);
    const envelope = value;
    const { name: _name, ...withoutName } = envelope.macro;
    const packageMacros = macros2.get(value.package) ?? {};
    defineIdentity(
      packageMacros,
      value.macro.name,
      withoutName
    );
    macros2.set(value.package, packageMacros);
  }
  const out = {};
  for (const manifest of [...manifests.values()].sort((a3, b2) => a3.id.localeCompare(b2.id))) {
    defineIdentity(out, manifest.id, {
      version: usesCurrentEntitySchemas(config) ? "11" : "8",
      name: manifest.name,
      description: manifest.description,
      macros: macros2.get(manifest.id) ?? {}
    });
  }
  return out;
}
async function readEntityPackageManifests(workspaceRoot, requireCurrentSchema = false) {
  const manifests = /* @__PURE__ */ new Map();
  const foldedIds = /* @__PURE__ */ new Set();
  for (const { relativePath, value } of await readJsonDirectory(packageManifestsDir(workspaceRoot), true)) {
    if (!isRecord2(value) || value.format !== "snl-package" || value.version !== PACKAGE_STORAGE_VERSION || typeof value.id !== "string" || typeof value.name !== "string" || typeof value.description !== "string") {
      throw new Error(`${relativePath} is not a valid SNL Package manifest.`);
    }
    if (requireCurrentSchema) {
      if (value.schema_version !== CURRENT_PACKAGE_SCHEMA_VERSION) {
        throw new Error(
          `${relativePath} must carry current Package manifest schema_version ${CURRENT_PACKAGE_SCHEMA_VERSION}.`
        );
      }
      const entryIds = value.entry_ids;
      if (!Array.isArray(entryIds) || entryIds.some((entryId) => typeof entryId !== "string" || !entryId || entryId !== entryId.trim()) || new Set(entryIds).size !== entryIds.length || entryIds.some((entryId, index) => index > 0 && entryIds[index - 1].localeCompare(entryId) > 0)) {
        throw new Error(
          `${relativePath}#entry_ids must be a present sorted array of unique, non-empty canonical Entry ids.`
        );
      }
    }
    assertExpectedEntityPath(relativePath, packageManifestPath(value.id));
    const folded = value.id.toLowerCase();
    if (foldedIds.has(folded)) {
      throw new Error(`Duplicate Package identity under case-folding: ${value.id}.`);
    }
    foldedIds.add(folded);
    manifests.set(value.id, value);
  }
  if (!manifests.has(UNPACKAGED_PACKAGE_ID)) {
    throw new Error(`Current entity storage requires the ${UNPACKAGED_PACKAGE_ID} Package manifest.`);
  }
  return manifests;
}
async function readJsonDirectory(directory, required = false) {
  if (!await pathExists(directory)) {
    if (required) throw new Error(`Required entity directory is missing: ${directory}.`);
    return [];
  }
  const directoryStat = await fs.lstat(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error(`${directory} must be a real directory, not a symlink.`);
  }
  const base = path2.basename(directory);
  const names = (await fs.readdir(directory)).filter((name2) => name2.endsWith(".json")).sort();
  return Promise.all(names.map(async (name2) => {
    const absolute = path2.join(directory, name2);
    const stat = await fs.lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`${absolute} must be a regular, non-symlink file.`);
    }
    return {
      relativePath: `${base}/${name2}`,
      value: await readJson(absolute)
    };
  }));
}
function assertExpectedEntityPath(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Entity path ${actual} does not match its logical identity path ${expected}.`);
  }
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function readActiveMacros(workspaceRoot) {
  const [config, packages] = await Promise.all([
    readConfig(workspaceRoot),
    readAllMacroPackages(workspaceRoot)
  ]);
  const active = config.active_macro_packages === void 0 ? null : new Set(config.active_macro_packages);
  if (active && usesEntityStorage(config)) {
    for (const packageId of active) {
      if (!Object.prototype.hasOwnProperty.call(packages, packageId)) {
        throw new Error(`active_macro_packages references missing Package ${JSON.stringify(packageId)}.`);
      }
    }
  }
  const flat = {};
  for (const pkgName of Object.keys(packages).sort(
    (left, right) => `${left}.json`.localeCompare(`${right}.json`)
  )) {
    if (active && !active.has(pkgName)) continue;
    const pkg = packages[pkgName];
    if (!pkg?.macros) continue;
    for (const [macroName, entry] of Object.entries(pkg.macros)) {
      const withName = {
        name: macroName,
        ...entry
      };
      defineIdentity(flat, macroName, withName);
    }
  }
  return flat;
}
async function readEntryKinds(workspaceRoot) {
  const cfg = await readConfig(workspaceRoot);
  return cfg.entry_kinds ?? [];
}

// node_modules/@sjtu-ai4math/snl-basics/dist-lib/chunks/context-source-DWcRwFd7.js
function t2(t3) {
  let n3 = /* @__PURE__ */ new Set();
  if (!t3.trim()) return n3;
  let r3;
  try {
    r3 = y(t3);
  } catch {
    return n3;
  }
  let i4 = (e) => {
    if (e.kind === "binder") {
      n3.add(e.binder_name ?? e.temporary_source ?? e.macro_name);
      return;
    }
    e.children.forEach(i4);
  };
  return i4(r3), n3;
}

// lib/snl-parser.ts
function tryParseSnlSyntaxTree(input) {
  try {
    return { ok: true, tree: y(input) };
  } catch (e) {
    if (e instanceof h) {
      return { ok: false, error: e.message, position: e.position };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// lib/lint-entry.ts
function safeExportedBinders(source) {
  if (typeof source !== "string" || !source.trim()) return /* @__PURE__ */ new Set();
  try {
    return t2(source);
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function isValidI18nString(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value;
  if (record.type !== "i18n" || typeof record.default_language !== "string") return false;
  if (typeof record.values !== "object" || record.values === null || Array.isArray(record.values)) return false;
  const values = Object.values(record.values);
  return values.length > 0 && values.every((item) => typeof item === "string");
}
function lintEntry(raw, ctx) {
  const issues = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    issues.push({
      severity: "error",
      code: "entry.not-object",
      message: `Entry payload must be a JSON object, got ${describe2(raw)}.`
    });
    return { issues };
  }
  const e = raw;
  if (typeof e.id !== "string" || e.id.trim() === "") {
    issues.push({
      severity: "error",
      code: "entry.missing-id",
      message: "Field `id` must be a non-empty string.",
      path: "id"
    });
  } else if (ctx.siblingEntries.some((s2) => s2.id === e.id)) {
    issues.push({
      severity: "error",
      code: "entry.duplicate-id",
      message: `Entry id '${e.id}' already exists in the shared pool.`,
      path: "id"
    });
  }
  if (typeof e.kind !== "string" || e.kind.trim() === "") {
    issues.push({
      severity: "error",
      code: "entry.missing-kind",
      message: "Field `kind` must be a non-empty string.",
      path: "kind"
    });
  } else if (!ctx.entryKinds.some((k) => k.id === e.kind)) {
    const known = ctx.entryKinds.map((k) => k.id).join(", ") || "(none defined)";
    issues.push({
      severity: "error",
      code: "entry.unknown-kind",
      message: `kind '${e.kind}' is not in config.entry_kinds. Known: ${known}.`,
      path: "kind"
    });
  }
  if (typeof e.title !== "string" && !isValidI18nString(e.title)) {
    issues.push({
      severity: "error",
      code: "entry.missing-title",
      message: "Field `title` must be a string or valid I18n map.",
      path: "title"
    });
  }
  if (typeof e.content !== "object" || e.content === null || Array.isArray(e.content)) {
    issues.push({
      severity: "error",
      code: "entry.missing-content",
      message: "Field `content` must be an object (may be empty).",
      path: "content"
    });
  } else {
    for (const dialect of ["snl", "typst", "latex", "markdown", "text"]) {
      const val = e.content[dialect];
      const valid = val === void 0 || typeof val === "string" || dialect !== "snl" && isValidI18nString(val);
      if (!valid) {
        issues.push({
          severity: "error",
          code: "entry.bad-content-dialect",
          message: dialect === "snl" ? `content.snl must be a language-invariant string when present, got ${describe2(val)}.` : `content.${dialect} must be a string or valid I18n map when present, got ${describe2(val)}.`,
          path: `content.${dialect}`
        });
      }
    }
  }
  if (!("contribution_info" in e)) {
    issues.push({
      severity: "error",
      code: "entry.missing-contribution-info",
      message: "Field `contribution_info` is required (may be null).",
      path: "contribution_info"
    });
  }
  if (!("pointer" in e)) {
    issues.push({
      severity: "error",
      code: "entry.missing-pointer",
      message: "Field `pointer` is required (may be null).",
      path: "pointer"
    });
  }
  const snl = typeof e.content === "object" && e.content !== null && typeof e.content.snl === "string" ? e.content.snl : "";
  if (snl.trim().length > 0) {
    const parsed = tryParseSnlSyntaxTree(snl);
    if (!parsed.ok) {
      issues.push({
        severity: "error",
        code: "snl.parse",
        message: parsed.error,
        path: "content.snl",
        position: parsed.position
      });
    } else {
      const unresolved = findUnresolvedIdentifiers(snl, ctx.macros);
      for (const name2 of unresolved) {
        issues.push({
          severity: ctx.strictMacros ? "error" : "info",
          code: "snl.identifier-not-in-pool",
          message: `Identifier '${name2}' is not a registered macro; will render as fvar/bvar fallback. May be intentional (bound variable, local free variable) or may indicate a typo / missing macro registration \u2014 agent decides.`,
          path: "content.snl"
        });
      }
      const exportedBinders = /* @__PURE__ */ new Map();
      for (const sibling of ctx.siblingEntries) {
        if (typeof sibling.id === "string") {
          exportedBinders.set(sibling.id, safeExportedBinders(sibling.content?.snl));
        }
      }
      if (typeof e.id === "string") {
        exportedBinders.set(e.id, safeExportedBinders(snl));
      }
      const srcRefs = collectSrcReferences(parsed.tree);
      for (const ref of srcRefs) {
        const declarations = exportedBinders.get(ref.sourceId);
        if (!declarations) {
          issues.push({
            severity: "info",
            code: "snl.src-dangling",
            message: `Cross-entry src-postfix reference \`${ref.binderName}@${ref.sourceId}\` does not resolve to any entry in the shared pool. Tolerated (renders with a warning badge), but likely a typo \u2014 entry ids are stable once created and should point at a real source entry that owns the bound variable. See docs/context-entry-design.md.`,
            path: "content.snl"
          });
        } else if (!declarations.has(ref.binderName)) {
          issues.push({
            severity: "info",
            code: "snl.src-no-declaration",
            message: `Cross-entry source ${JSON.stringify(ref.sourceId)} exists but does not export binder ${JSON.stringify(ref.binderName)}.`,
            path: "content.snl"
          });
        }
      }
    }
  }
  return { issues };
}
function collectSrcReferences(node) {
  const out = /* @__PURE__ */ new Map();
  visit2(node);
  return [...out.values()].sort((a3, b2) => a3.sourceId.localeCompare(b2.sourceId) || a3.binderName.localeCompare(b2.binderName));
  function visit2(n3) {
    if (!n3 || typeof n3 !== "object") return;
    const nn = n3;
    const binderName = typeof nn.temporary_source === "string" ? nn.temporary_source : typeof nn.binder_name === "string" ? nn.binder_name : typeof nn.macro_name === "string" ? nn.macro_name : "";
    if (nn.postfix && typeof nn.postfix === "object") {
      const postfix = nn.postfix;
      if (postfix.type === "name" && typeof postfix.name === "string" && postfix.name.length > 0) {
        const ref = { sourceId: postfix.name, binderName };
        out.set(`${ref.sourceId}\0${ref.binderName}`, ref);
      }
    }
    if (nn.mdata && typeof nn.mdata === "object") {
      const src = nn.mdata.src;
      if (typeof src === "string" && src.length > 0) {
        const ref = { sourceId: src, binderName };
        out.set(`${ref.sourceId}\0${ref.binderName}`, ref);
      }
    }
    if (Array.isArray(nn.children)) for (const child of nn.children) visit2(child);
  }
}
function findUnresolvedIdentifiers(snl, pool) {
  const stripped = snl.replace(/\$\$[\s\S]*?\$\$/g, " ").replace(/\$[\s\S]*?\$/g, " ").replace(/%[\s\S]*?%/g, " ").replace(/`[\s\S]*?`/g, " ");
  const withoutAtIdents = stripped.replace(
    /@[A-Za-z_][A-Za-z0-9_.\-]*/g,
    " "
  );
  const re = /([A-Za-z_][A-Za-z0-9_.\-]*)/g;
  const seen = /* @__PURE__ */ new Set();
  const unresolved = /* @__PURE__ */ new Set();
  let m3;
  while ((m3 = re.exec(withoutAtIdents)) !== null) {
    const name2 = m3[1];
    if (seen.has(name2)) continue;
    seen.add(name2);
    if (!Object.hasOwn(pool, name2)) unresolved.add(name2);
  }
  return [...unresolved].sort();
}
function describe2(v2) {
  if (v2 === null) return "null";
  if (Array.isArray(v2)) return "array";
  return typeof v2;
}

// lib/katex-check.ts
function checkKatex(source, opts = {}) {
  try {
    katex.renderToString(source, {
      throwOnError: true,
      displayMode: opts.displayMode === true,
      macros: opts.macros,
      // Strict rejects a few permissive-but-questionable inputs (Unicode
      // in math, deprecated commands, etc.). We keep it OFF: the
      // extension's runtime KaTeX runs in default (non-strict) mode, so
      // strict mode would raise false positives the author can't
      // reproduce in-app.
      strict: "ignore"
    });
    return { ok: true };
  } catch (err) {
    const raw = err.message ?? String(err);
    const { message, position } = parseKatexError(raw);
    return { ok: false, message, position, raw };
  }
}
function parseKatexError(raw) {
  let msg = raw.replace(/^KaTeX parse error:\s*/, "");
  let position;
  const posMatch = msg.match(/ at position (\d+):\s.*$/);
  if (posMatch) {
    position = Number.parseInt(posMatch[1], 10);
    msg = msg.slice(0, posMatch.index);
  }
  return { message: msg, position };
}
function fillTemplateWithPlaceholders(template, dynamic = {}) {
  const PH = "x";
  const separator = dynamic.separator ?? ", ";
  const variadicBody = [PH, PH, PH].join(separator);
  const out = [];
  let i4 = 0;
  while (i4 < template.length) {
    const ch2 = template[i4];
    if (ch2 === "\\" && template[i4 + 1] === "#") {
      out.push("\\#");
      i4 += 2;
      continue;
    }
    if (ch2 === "#") {
      if (template[i4 + 1] === "*") {
        out.push(variadicBody);
        i4 += 2;
        continue;
      }
      const digitsMatch = template.slice(i4 + 1).match(/^\d+/);
      if (digitsMatch) {
        out.push(PH);
        i4 += 1 + digitsMatch[0].length;
        continue;
      }
      out.push(ch2);
      i4 += 1;
      continue;
    }
    out.push(ch2);
    i4 += 1;
  }
  return out.join("");
}
function templateNeedsKatex(mode, template) {
  if (mode === "formula_inline" || mode === "formula_display") return true;
  return /\\[A-Za-z]/.test(template);
}

// lib/lint-package.ts
var KNOWN_MODES = /* @__PURE__ */ new Set(["formula_inline", "formula_display", "text", "block"]);
var STYLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
var LEGACY_STYLE_FIELDS = [
  "tag",
  "variadic_left",
  "variadic_join",
  "variadic_right",
  "react_renderer_key"
];
function lintPackage(raw, opts = {}) {
  const issues = [];
  if (!isRecord3(raw)) {
    issues.push({ severity: "error", code: "package.not-object", message: `Macro package must be a JSON object, got ${describe3(raw)}.` });
    return { issues };
  }
  const pkg = raw;
  if (typeof pkg.version !== "string" || pkg.version === "") {
    issues.push({ severity: "error", code: "package.missing-version", message: "Field `version` must be a non-empty string.", path: "version" });
  }
  if (typeof pkg.name !== "string" || pkg.name === "") {
    issues.push({ severity: "error", code: "package.missing-name", message: "Field `name` must be a non-empty string.", path: "name" });
  }
  if (pkg.description !== void 0 && typeof pkg.description !== "string") {
    issues.push({ severity: "error", code: "package.bad-description", message: "`description` must be a string when present.", path: "description" });
  }
  if (!isRecord3(pkg.macros)) {
    issues.push({ severity: "error", code: "package.missing-macros", message: "`macros` must be an object (name \u2192 macro).", path: "macros" });
    return { issues };
  }
  if (pkg.version === "11") {
    const document2 = Object.fromEntries(Object.entries(pkg.macros).map(([name2, macro]) => [
      name2,
      isRecord3(macro) ? { name: name2, ...macro } : macro
    ]));
    if (!isMacroDocumentV11(document2)) {
      issues.push({
        severity: "error",
        code: "package.macro-v11",
        message: "Package macros must satisfy the canonical Macro v11 schema.",
        path: "macros"
      });
    }
    if (opts.checkKatex !== false) lintMacroV11Katex(pkg.macros, issues);
    return { issues };
  }
  function lintMacroV11Katex(macros2, issues2) {
    for (const [name2, rawMacro] of Object.entries(macros2)) {
      if (!isRecord3(rawMacro) || rawMacro.kind === "sub" || !Array.isArray(rawMacro.styles)) continue;
      rawMacro.styles.forEach((rawStyle, styleIndex) => {
        if (!isRecord3(rawStyle)) return;
        const projections = macroV11TemplateProjections(rawStyle.template);
        if (!projections) return;
        projections.forEach((template, projectionIndex) => {
          if (!templateNeedsKatex(template.mode, template.body)) return;
          const filled = fillTemplateWithPlaceholders(template.body, {
            separator: template.separator
          });
          const result = checkKatex(filled, { displayMode: template.mode === "formula_display" });
          if (!result.ok) {
            const suffix = projections.length > 1 ? `.values[${projectionIndex}]` : "";
            const path7 = `macros.${name2}.styles[${styleIndex}].template${suffix}.body`;
            issues2.push({
              severity: "error",
              code: "style.katex-compile",
              message: `${path7} does not compile under KaTeX: ${result.message}. Filled preview ('#N' -> x): ${filled}`,
              path: path7,
              position: result.position
            });
          }
        });
      });
    }
  }
  for (const [name2, macro] of Object.entries(pkg.macros)) {
    lintMacroEntry(name2, macro, issues, opts.checkKatex !== false);
  }
  return { issues };
}
function lintMacroEntry(name2, raw, issues, checkKatexEnabled) {
  const path7 = `macros.${name2}`;
  if (!isRecord3(raw)) {
    issues.push({ severity: "error", code: "macro.not-object", message: `${path7}: macro entry must be an object.`, path: path7 });
    return;
  }
  const macro = raw;
  if (typeof macro.description !== "string") {
    issues.push({ severity: "error", code: "macro.missing-description", message: `${path7}.description must be a string (may be empty).`, path: `${path7}.description` });
  }
  if (!isRecord3(macro.source) || !isStringArray2(macro.source.entries) || !isStringArray2(macro.source.urls)) {
    issues.push({ severity: "error", code: "macro.bad-source", message: `${path7}.source must be { entries: string[], urls: string[] } (both arrays required, may be empty).`, path: `${path7}.source` });
  }
  if (typeof macro.dynamic_arity !== "boolean") {
    issues.push({ severity: "error", code: "macro.missing-dynamic-arity", message: `${path7}.dynamic_arity must be a boolean.`, path: `${path7}.dynamic_arity` });
  }
  if (macro.kind !== void 0 && typeof macro.kind !== "string") {
    issues.push({ severity: "error", code: "macro.bad-kind", message: `${path7}.kind must be a string when present.`, path: `${path7}.kind` });
  }
  if (!isStringArray2(macro.tags)) {
    issues.push({ severity: "error", code: "macro.missing-tags", message: `${path7}.tags must be a string array (may be empty).`, path: `${path7}.tags` });
  } else if (macro.tags.some((tag) => tag.includes("\\"))) {
    issues.push({ severity: "error", code: "macro.bad-tags", message: `${path7}.tags must not contain backslashes.`, path: `${path7}.tags` });
  }
  const defaultStyle = macro.default_style;
  if (defaultStyle === void 0) {
    issues.push({ severity: "error", code: "macro.missing-default-style", message: `${path7}.default_style must be a language \u2192 style-name object.`, path: `${path7}.default_style` });
  } else if (!isRecord3(defaultStyle) || Object.values(defaultStyle).some((value) => typeof value !== "string")) {
    issues.push({ severity: "error", code: "macro.bad-default-style", message: `${path7}.default_style must map language keys to style-name strings.`, path: `${path7}.default_style` });
  }
  if (!Array.isArray(macro.styles) || macro.styles.length === 0) {
    issues.push({ severity: "error", code: "macro.missing-styles", message: `${path7}.styles must be a non-empty array.`, path: `${path7}.styles` });
    return;
  }
  const seenNames = /* @__PURE__ */ new Set();
  const maxIndexes = [];
  macro.styles.forEach((rawStyle, index) => {
    const stylePath = `${path7}.styles[${index}]`;
    if (!isRecord3(rawStyle)) {
      issues.push({ severity: "error", code: "style.not-object", message: `${stylePath} must be an object.`, path: stylePath });
      return;
    }
    const style = rawStyle;
    for (const field of LEGACY_STYLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(rawStyle, field)) {
        issues.push({ severity: "error", code: "style.legacy-field", message: `${stylePath}.${field} is a pre-v7 field and is not allowed by Macro v8. Migrate the package.`, path: `${stylePath}.${field}` });
      }
    }
    if (typeof style.style_name !== "string" || style.style_name === "") {
      issues.push({ severity: "error", code: "style.missing-name", message: `${stylePath}.style_name must be a non-empty string.`, path: `${stylePath}.style_name` });
    } else if (!STYLE_NAME_RE.test(style.style_name)) {
      issues.push({ severity: "error", code: "style.bad-name", message: `${stylePath}.style_name must match ${STYLE_NAME_RE}.`, path: `${stylePath}.style_name` });
    } else if (seenNames.has(style.style_name)) {
      issues.push({ severity: "error", code: "style.duplicate-name", message: `${stylePath}.style_name '${style.style_name}' is duplicated within this macro.`, path: `${stylePath}.style_name` });
    } else {
      seenNames.add(style.style_name);
    }
    if (typeof style.mode !== "string" || !KNOWN_MODES.has(style.mode)) {
      issues.push({ severity: "error", code: "style.bad-mode", message: `${stylePath}.mode = ${JSON.stringify(style.mode)} \u2014 must be one of ${[...KNOWN_MODES].join(", ")}.`, path: `${stylePath}.mode` });
    }
    if (!isStringArray2(style.tags)) {
      issues.push({ severity: "error", code: "style.missing-tags", message: `${stylePath}.tags must be a string array (may be empty).`, path: `${stylePath}.tags` });
    } else if (style.tags.some((tag) => tag.includes("\\"))) {
      issues.push({ severity: "error", code: "style.bad-tags", message: `${stylePath}.tags must not contain backslashes.`, path: `${stylePath}.tags` });
    }
    if (style.separator !== void 0 && typeof style.separator !== "string") {
      issues.push({ severity: "error", code: "style.bad-separator", message: `${stylePath}.separator must be a string when present.`, path: `${stylePath}.separator` });
    }
    if (style.block_template_name !== void 0 && typeof style.block_template_name !== "string") {
      issues.push({ severity: "error", code: "style.bad-block-template", message: `${stylePath}.block_template_name must be a string when present.`, path: `${stylePath}.block_template_name` });
    } else if (style.block_template_name !== void 0 && style.mode !== "block") {
      issues.push({ severity: "error", code: "style.block-template-non-block", message: `${stylePath}.block_template_name is valid only in block mode.`, path: `${stylePath}.block_template_name` });
    }
    if (typeof style.template !== "string" || style.template.trim().length === 0) {
      issues.push({ severity: "error", code: "style.missing-template", message: `${stylePath}.template must be a non-empty string.`, path: `${stylePath}.template` });
      return;
    }
    const scan = scanTemplatePlaceholders(style.template);
    maxIndexes.push(scan.maxIndex);
    for (const token of scan.badTokens) {
      issues.push({ severity: "error", code: "style.bad-placeholder", message: `${stylePath}.template contains illegal placeholder '${token}'; only canonical '#0' through '#99' and '#*' are recognised (escape a literal hash as '\\#').`, path: `${stylePath}.template` });
    }
    if (macro.dynamic_arity === true && !scan.hasVariadic) {
      issues.push({ severity: "error", code: "style.dynamic-arity-missing-variadic", message: `${stylePath}.template must contain '#*' because the macro is dynamic_arity.`, path: `${stylePath}.template` });
    } else if (macro.dynamic_arity !== true && scan.hasVariadic) {
      issues.push({ severity: "error", code: "style.variadic-without-dynamic-arity", message: `${stylePath}.template uses '#*' but the macro is not dynamic_arity.`, path: `${stylePath}.template` });
    }
    if (macro.dynamic_arity !== true && style.separator !== void 0) {
      issues.push({ severity: "warning", code: "style.separator-unused", message: `${stylePath}.separator is ignored when the macro is not dynamic_arity.`, path: `${stylePath}.separator` });
    }
    if (checkKatexEnabled && macro.kind !== "partial" && style.template.length > 0 && typeof style.mode === "string" && templateNeedsKatex(style.mode, style.template) && scan.badTokens.length === 0) {
      const filled = fillTemplateWithPlaceholders(style.template, { separator: typeof style.separator === "string" ? style.separator : void 0 });
      const result = checkKatex(filled, { displayMode: style.mode === "formula_display" });
      if (!result.ok) {
        issues.push({ severity: "error", code: "style.katex-compile", message: `${stylePath}.template does not compile under KaTeX: ${result.message}. Filled preview (\u2018#N\u2019 \u2192 x): ${filled}`, path: `${stylePath}.template`, position: result.position });
      }
    }
  });
  if (isRecord3(defaultStyle)) {
    for (const [language, styleName] of Object.entries(defaultStyle)) {
      if (!language.trim() || typeof styleName !== "string" || !seenNames.has(styleName)) {
        issues.push({ severity: "error", code: "macro.bad-default-style", message: `${path7}.default_style[${JSON.stringify(language)}] must name a declared style.`, path: `${path7}.default_style` });
      }
    }
  }
  if (maxIndexes.length > 1 && new Set(maxIndexes).size > 1) {
    issues.push({ severity: "info", code: "macro.style-arity-mismatch", message: `${path7}: styles reference different maximum child indexes (${[...new Set(maxIndexes)].sort((a3, b2) => a3 - b2).join(", ")}). This is legal but may be an oversight.`, path: `${path7}.styles` });
  }
}
function scanTemplatePlaceholders(template) {
  let maxIndex = -1;
  let hasVariadic = false;
  const badTokens = [];
  for (let index = 0; index < template.length; index += 1) {
    if (template[index] !== "#" || index > 0 && template[index - 1] === "\\") continue;
    const next = template[index + 1];
    if (next === "*") {
      hasVariadic = true;
      index += 1;
      continue;
    }
    if (next !== void 0 && /\d/.test(next)) {
      let end2 = index + 2;
      while (end2 < template.length && /\d/.test(template[end2])) end2 += 1;
      const digits = template.slice(index + 1, end2);
      if (/^(?:0|[1-9]\d?)$/.test(digits)) {
        maxIndex = Math.max(maxIndex, Number.parseInt(digits, 10));
      } else {
        badTokens.push(`#${digits}`);
      }
      index = end2 - 1;
      continue;
    }
    let end = index + 1;
    if (next === "#") end += 1;
    else if (next !== void 0 && /[A-Za-z_]/.test(next)) {
      end += 1;
      while (end < template.length && /[A-Za-z0-9_]/.test(template[end])) end += 1;
    } else if (next !== void 0 && !/\s/.test(next)) end += 1;
    badTokens.push(template.slice(index, end));
    index = end - 1;
  }
  return { maxIndex, hasVariadic, badTokens };
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray2(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function describe3(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

// lib/entity-references.ts
import { constants as constants2 } from "node:fs";
import { promises as fs2 } from "node:fs";
import * as path4 from "node:path";

// node_modules/jsonc-parser/lib/esm/impl/scanner.js
function createScanner(text2, ignoreTrivia = false) {
  const len = text2.length;
  let pos = 0, value = "", tokenOffset = 0, token = 16, lineNumber = 0, lineStartOffset = 0, tokenLineStartOffset = 0, prevTokenLineStartOffset = 0, scanError = 0;
  function scanHexDigits(count, exact) {
    let digits = 0;
    let value2 = 0;
    while (digits < count || !exact) {
      let ch2 = text2.charCodeAt(pos);
      if (ch2 >= 48 && ch2 <= 57) {
        value2 = value2 * 16 + ch2 - 48;
      } else if (ch2 >= 65 && ch2 <= 70) {
        value2 = value2 * 16 + ch2 - 65 + 10;
      } else if (ch2 >= 97 && ch2 <= 102) {
        value2 = value2 * 16 + ch2 - 97 + 10;
      } else {
        break;
      }
      pos++;
      digits++;
    }
    if (digits < count) {
      value2 = -1;
    }
    return value2;
  }
  function setPosition(newPosition) {
    pos = newPosition;
    value = "";
    tokenOffset = 0;
    token = 16;
    scanError = 0;
  }
  function scanNumber() {
    let start = pos;
    if (text2.charCodeAt(pos) === 48) {
      pos++;
    } else {
      pos++;
      while (pos < text2.length && isDigit(text2.charCodeAt(pos))) {
        pos++;
      }
    }
    if (pos < text2.length && text2.charCodeAt(pos) === 46) {
      pos++;
      if (pos < text2.length && isDigit(text2.charCodeAt(pos))) {
        pos++;
        while (pos < text2.length && isDigit(text2.charCodeAt(pos))) {
          pos++;
        }
      } else {
        scanError = 3;
        return text2.substring(start, pos);
      }
    }
    let end = pos;
    if (pos < text2.length && (text2.charCodeAt(pos) === 69 || text2.charCodeAt(pos) === 101)) {
      pos++;
      if (pos < text2.length && text2.charCodeAt(pos) === 43 || text2.charCodeAt(pos) === 45) {
        pos++;
      }
      if (pos < text2.length && isDigit(text2.charCodeAt(pos))) {
        pos++;
        while (pos < text2.length && isDigit(text2.charCodeAt(pos))) {
          pos++;
        }
        end = pos;
      } else {
        scanError = 3;
      }
    }
    return text2.substring(start, end);
  }
  function scanString() {
    let result = "", start = pos;
    while (true) {
      if (pos >= len) {
        result += text2.substring(start, pos);
        scanError = 2;
        break;
      }
      const ch2 = text2.charCodeAt(pos);
      if (ch2 === 34) {
        result += text2.substring(start, pos);
        pos++;
        break;
      }
      if (ch2 === 92) {
        result += text2.substring(start, pos);
        pos++;
        if (pos >= len) {
          scanError = 2;
          break;
        }
        const ch22 = text2.charCodeAt(pos++);
        switch (ch22) {
          case 34:
            result += '"';
            break;
          case 92:
            result += "\\";
            break;
          case 47:
            result += "/";
            break;
          case 98:
            result += "\b";
            break;
          case 102:
            result += "\f";
            break;
          case 110:
            result += "\n";
            break;
          case 114:
            result += "\r";
            break;
          case 116:
            result += "	";
            break;
          case 117:
            const ch3 = scanHexDigits(4, true);
            if (ch3 >= 0) {
              result += String.fromCharCode(ch3);
            } else {
              scanError = 4;
            }
            break;
          default:
            scanError = 5;
        }
        start = pos;
        continue;
      }
      if (ch2 >= 0 && ch2 <= 31) {
        if (isLineBreak(ch2)) {
          result += text2.substring(start, pos);
          scanError = 2;
          break;
        } else {
          scanError = 6;
        }
      }
      pos++;
    }
    return result;
  }
  function scanNext() {
    value = "";
    scanError = 0;
    tokenOffset = pos;
    lineStartOffset = lineNumber;
    prevTokenLineStartOffset = tokenLineStartOffset;
    if (pos >= len) {
      tokenOffset = len;
      return token = 17;
    }
    let code = text2.charCodeAt(pos);
    if (isWhiteSpace(code)) {
      do {
        pos++;
        value += String.fromCharCode(code);
        code = text2.charCodeAt(pos);
      } while (isWhiteSpace(code));
      return token = 15;
    }
    if (isLineBreak(code)) {
      pos++;
      value += String.fromCharCode(code);
      if (code === 13 && text2.charCodeAt(pos) === 10) {
        pos++;
        value += "\n";
      }
      lineNumber++;
      tokenLineStartOffset = pos;
      return token = 14;
    }
    switch (code) {
      // tokens: []{}:,
      case 123:
        pos++;
        return token = 1;
      case 125:
        pos++;
        return token = 2;
      case 91:
        pos++;
        return token = 3;
      case 93:
        pos++;
        return token = 4;
      case 58:
        pos++;
        return token = 6;
      case 44:
        pos++;
        return token = 5;
      // strings
      case 34:
        pos++;
        value = scanString();
        return token = 10;
      // comments
      case 47:
        const start = pos - 1;
        if (text2.charCodeAt(pos + 1) === 47) {
          pos += 2;
          while (pos < len) {
            if (isLineBreak(text2.charCodeAt(pos))) {
              break;
            }
            pos++;
          }
          value = text2.substring(start, pos);
          return token = 12;
        }
        if (text2.charCodeAt(pos + 1) === 42) {
          pos += 2;
          const safeLength = len - 1;
          let commentClosed = false;
          while (pos < safeLength) {
            const ch2 = text2.charCodeAt(pos);
            if (ch2 === 42 && text2.charCodeAt(pos + 1) === 47) {
              pos += 2;
              commentClosed = true;
              break;
            }
            pos++;
            if (isLineBreak(ch2)) {
              if (ch2 === 13 && text2.charCodeAt(pos) === 10) {
                pos++;
              }
              lineNumber++;
              tokenLineStartOffset = pos;
            }
          }
          if (!commentClosed) {
            pos++;
            scanError = 1;
          }
          value = text2.substring(start, pos);
          return token = 13;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16;
      // numbers
      case 45:
        value += String.fromCharCode(code);
        pos++;
        if (pos === len || !isDigit(text2.charCodeAt(pos))) {
          return token = 16;
        }
      // found a minus, followed by a number so
      // we fall through to proceed with scanning
      // numbers
      case 48:
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57:
        value += scanNumber();
        return token = 11;
      // literals and unknown symbols
      default:
        while (pos < len && isUnknownContentCharacter(code)) {
          pos++;
          code = text2.charCodeAt(pos);
        }
        if (tokenOffset !== pos) {
          value = text2.substring(tokenOffset, pos);
          switch (value) {
            case "true":
              return token = 8;
            case "false":
              return token = 9;
            case "null":
              return token = 7;
          }
          return token = 16;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16;
    }
  }
  function isUnknownContentCharacter(code) {
    if (isWhiteSpace(code) || isLineBreak(code)) {
      return false;
    }
    switch (code) {
      case 125:
      case 93:
      case 123:
      case 91:
      case 34:
      case 58:
      case 44:
      case 47:
        return false;
    }
    return true;
  }
  function scanNextNonTrivia() {
    let result;
    do {
      result = scanNext();
    } while (result >= 12 && result <= 15);
    return result;
  }
  return {
    setPosition,
    getPosition: () => pos,
    scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
    getToken: () => token,
    getTokenValue: () => value,
    getTokenOffset: () => tokenOffset,
    getTokenLength: () => pos - tokenOffset,
    getTokenStartLine: () => lineStartOffset,
    getTokenStartCharacter: () => tokenOffset - prevTokenLineStartOffset,
    getTokenError: () => scanError
  };
}
function isWhiteSpace(ch2) {
  return ch2 === 32 || ch2 === 9;
}
function isLineBreak(ch2) {
  return ch2 === 10 || ch2 === 13;
}
function isDigit(ch2) {
  return ch2 >= 48 && ch2 <= 57;
}
var CharacterCodes;
(function(CharacterCodes2) {
  CharacterCodes2[CharacterCodes2["lineFeed"] = 10] = "lineFeed";
  CharacterCodes2[CharacterCodes2["carriageReturn"] = 13] = "carriageReturn";
  CharacterCodes2[CharacterCodes2["space"] = 32] = "space";
  CharacterCodes2[CharacterCodes2["_0"] = 48] = "_0";
  CharacterCodes2[CharacterCodes2["_1"] = 49] = "_1";
  CharacterCodes2[CharacterCodes2["_2"] = 50] = "_2";
  CharacterCodes2[CharacterCodes2["_3"] = 51] = "_3";
  CharacterCodes2[CharacterCodes2["_4"] = 52] = "_4";
  CharacterCodes2[CharacterCodes2["_5"] = 53] = "_5";
  CharacterCodes2[CharacterCodes2["_6"] = 54] = "_6";
  CharacterCodes2[CharacterCodes2["_7"] = 55] = "_7";
  CharacterCodes2[CharacterCodes2["_8"] = 56] = "_8";
  CharacterCodes2[CharacterCodes2["_9"] = 57] = "_9";
  CharacterCodes2[CharacterCodes2["a"] = 97] = "a";
  CharacterCodes2[CharacterCodes2["b"] = 98] = "b";
  CharacterCodes2[CharacterCodes2["c"] = 99] = "c";
  CharacterCodes2[CharacterCodes2["d"] = 100] = "d";
  CharacterCodes2[CharacterCodes2["e"] = 101] = "e";
  CharacterCodes2[CharacterCodes2["f"] = 102] = "f";
  CharacterCodes2[CharacterCodes2["g"] = 103] = "g";
  CharacterCodes2[CharacterCodes2["h"] = 104] = "h";
  CharacterCodes2[CharacterCodes2["i"] = 105] = "i";
  CharacterCodes2[CharacterCodes2["j"] = 106] = "j";
  CharacterCodes2[CharacterCodes2["k"] = 107] = "k";
  CharacterCodes2[CharacterCodes2["l"] = 108] = "l";
  CharacterCodes2[CharacterCodes2["m"] = 109] = "m";
  CharacterCodes2[CharacterCodes2["n"] = 110] = "n";
  CharacterCodes2[CharacterCodes2["o"] = 111] = "o";
  CharacterCodes2[CharacterCodes2["p"] = 112] = "p";
  CharacterCodes2[CharacterCodes2["q"] = 113] = "q";
  CharacterCodes2[CharacterCodes2["r"] = 114] = "r";
  CharacterCodes2[CharacterCodes2["s"] = 115] = "s";
  CharacterCodes2[CharacterCodes2["t"] = 116] = "t";
  CharacterCodes2[CharacterCodes2["u"] = 117] = "u";
  CharacterCodes2[CharacterCodes2["v"] = 118] = "v";
  CharacterCodes2[CharacterCodes2["w"] = 119] = "w";
  CharacterCodes2[CharacterCodes2["x"] = 120] = "x";
  CharacterCodes2[CharacterCodes2["y"] = 121] = "y";
  CharacterCodes2[CharacterCodes2["z"] = 122] = "z";
  CharacterCodes2[CharacterCodes2["A"] = 65] = "A";
  CharacterCodes2[CharacterCodes2["B"] = 66] = "B";
  CharacterCodes2[CharacterCodes2["C"] = 67] = "C";
  CharacterCodes2[CharacterCodes2["D"] = 68] = "D";
  CharacterCodes2[CharacterCodes2["E"] = 69] = "E";
  CharacterCodes2[CharacterCodes2["F"] = 70] = "F";
  CharacterCodes2[CharacterCodes2["G"] = 71] = "G";
  CharacterCodes2[CharacterCodes2["H"] = 72] = "H";
  CharacterCodes2[CharacterCodes2["I"] = 73] = "I";
  CharacterCodes2[CharacterCodes2["J"] = 74] = "J";
  CharacterCodes2[CharacterCodes2["K"] = 75] = "K";
  CharacterCodes2[CharacterCodes2["L"] = 76] = "L";
  CharacterCodes2[CharacterCodes2["M"] = 77] = "M";
  CharacterCodes2[CharacterCodes2["N"] = 78] = "N";
  CharacterCodes2[CharacterCodes2["O"] = 79] = "O";
  CharacterCodes2[CharacterCodes2["P"] = 80] = "P";
  CharacterCodes2[CharacterCodes2["Q"] = 81] = "Q";
  CharacterCodes2[CharacterCodes2["R"] = 82] = "R";
  CharacterCodes2[CharacterCodes2["S"] = 83] = "S";
  CharacterCodes2[CharacterCodes2["T"] = 84] = "T";
  CharacterCodes2[CharacterCodes2["U"] = 85] = "U";
  CharacterCodes2[CharacterCodes2["V"] = 86] = "V";
  CharacterCodes2[CharacterCodes2["W"] = 87] = "W";
  CharacterCodes2[CharacterCodes2["X"] = 88] = "X";
  CharacterCodes2[CharacterCodes2["Y"] = 89] = "Y";
  CharacterCodes2[CharacterCodes2["Z"] = 90] = "Z";
  CharacterCodes2[CharacterCodes2["asterisk"] = 42] = "asterisk";
  CharacterCodes2[CharacterCodes2["backslash"] = 92] = "backslash";
  CharacterCodes2[CharacterCodes2["closeBrace"] = 125] = "closeBrace";
  CharacterCodes2[CharacterCodes2["closeBracket"] = 93] = "closeBracket";
  CharacterCodes2[CharacterCodes2["colon"] = 58] = "colon";
  CharacterCodes2[CharacterCodes2["comma"] = 44] = "comma";
  CharacterCodes2[CharacterCodes2["dot"] = 46] = "dot";
  CharacterCodes2[CharacterCodes2["doubleQuote"] = 34] = "doubleQuote";
  CharacterCodes2[CharacterCodes2["minus"] = 45] = "minus";
  CharacterCodes2[CharacterCodes2["openBrace"] = 123] = "openBrace";
  CharacterCodes2[CharacterCodes2["openBracket"] = 91] = "openBracket";
  CharacterCodes2[CharacterCodes2["plus"] = 43] = "plus";
  CharacterCodes2[CharacterCodes2["slash"] = 47] = "slash";
  CharacterCodes2[CharacterCodes2["formFeed"] = 12] = "formFeed";
  CharacterCodes2[CharacterCodes2["tab"] = 9] = "tab";
})(CharacterCodes || (CharacterCodes = {}));

// node_modules/jsonc-parser/lib/esm/impl/string-intern.js
var cachedSpaces = new Array(20).fill(0).map((_2, index) => {
  return " ".repeat(index);
});
var maxCachedValues = 200;
var cachedBreakLinesWithSpaces = {
  " ": {
    "\n": new Array(maxCachedValues).fill(0).map((_2, index) => {
      return "\n" + " ".repeat(index);
    }),
    "\r": new Array(maxCachedValues).fill(0).map((_2, index) => {
      return "\r" + " ".repeat(index);
    }),
    "\r\n": new Array(maxCachedValues).fill(0).map((_2, index) => {
      return "\r\n" + " ".repeat(index);
    })
  },
  "	": {
    "\n": new Array(maxCachedValues).fill(0).map((_2, index) => {
      return "\n" + "	".repeat(index);
    }),
    "\r": new Array(maxCachedValues).fill(0).map((_2, index) => {
      return "\r" + "	".repeat(index);
    }),
    "\r\n": new Array(maxCachedValues).fill(0).map((_2, index) => {
      return "\r\n" + "	".repeat(index);
    })
  }
};

// node_modules/jsonc-parser/lib/esm/impl/parser.js
var ParseOptions;
(function(ParseOptions2) {
  ParseOptions2.DEFAULT = {
    allowTrailingComma: false
  };
})(ParseOptions || (ParseOptions = {}));
function parseTree3(text2, errors = [], options = ParseOptions.DEFAULT) {
  let currentParent = { type: "array", offset: -1, length: -1, children: [], parent: void 0 };
  function ensurePropertyComplete(endOffset) {
    if (currentParent.type === "property") {
      currentParent.length = endOffset - currentParent.offset;
      currentParent = currentParent.parent;
    }
  }
  function onValue(valueNode) {
    currentParent.children.push(valueNode);
    return valueNode;
  }
  const visitor = {
    onObjectBegin: (offset) => {
      currentParent = onValue({ type: "object", offset, length: -1, parent: currentParent, children: [] });
    },
    onObjectProperty: (name2, offset, length) => {
      currentParent = onValue({ type: "property", offset, length: -1, parent: currentParent, children: [] });
      currentParent.children.push({ type: "string", value: name2, offset, length, parent: currentParent });
    },
    onObjectEnd: (offset, length) => {
      ensurePropertyComplete(offset + length);
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onArrayBegin: (offset, length) => {
      currentParent = onValue({ type: "array", offset, length: -1, parent: currentParent, children: [] });
    },
    onArrayEnd: (offset, length) => {
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onLiteralValue: (value, offset, length) => {
      onValue({ type: getNodeType(value), offset, length, parent: currentParent, value });
      ensurePropertyComplete(offset + length);
    },
    onSeparator: (sep2, offset, length) => {
      if (currentParent.type === "property") {
        if (sep2 === ":") {
          currentParent.colonOffset = offset;
        } else if (sep2 === ",") {
          ensurePropertyComplete(offset);
        }
      }
    },
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  };
  visit(text2, visitor, options);
  const result = currentParent.children[0];
  if (result) {
    delete result.parent;
  }
  return result;
}
function visit(text2, visitor, options = ParseOptions.DEFAULT) {
  const _scanner = createScanner(text2, false);
  const _jsonPath = [];
  let suppressedCallbacks = 0;
  function toNoArgVisit(visitFunction) {
    return visitFunction ? () => suppressedCallbacks === 0 && visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
  }
  function toOneArgVisit(visitFunction) {
    return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
  }
  function toOneArgVisitWithPath(visitFunction) {
    return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice()) : () => true;
  }
  function toBeginVisit(visitFunction) {
    return visitFunction ? () => {
      if (suppressedCallbacks > 0) {
        suppressedCallbacks++;
      } else {
        let cbReturn = visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice());
        if (cbReturn === false) {
          suppressedCallbacks = 1;
        }
      }
    } : () => true;
  }
  function toEndVisit(visitFunction) {
    return visitFunction ? () => {
      if (suppressedCallbacks > 0) {
        suppressedCallbacks--;
      }
      if (suppressedCallbacks === 0) {
        visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter());
      }
    } : () => true;
  }
  const onObjectBegin = toBeginVisit(visitor.onObjectBegin), onObjectProperty = toOneArgVisitWithPath(visitor.onObjectProperty), onObjectEnd = toEndVisit(visitor.onObjectEnd), onArrayBegin = toBeginVisit(visitor.onArrayBegin), onArrayEnd = toEndVisit(visitor.onArrayEnd), onLiteralValue = toOneArgVisitWithPath(visitor.onLiteralValue), onSeparator = toOneArgVisit(visitor.onSeparator), onComment = toNoArgVisit(visitor.onComment), onError = toOneArgVisit(visitor.onError);
  const disallowComments = options && options.disallowComments;
  const allowTrailingComma = options && options.allowTrailingComma;
  function scanNext() {
    while (true) {
      const token = _scanner.scan();
      switch (_scanner.getTokenError()) {
        case 4:
          handleError2(
            14
            /* ParseErrorCode.InvalidUnicode */
          );
          break;
        case 5:
          handleError2(
            15
            /* ParseErrorCode.InvalidEscapeCharacter */
          );
          break;
        case 3:
          handleError2(
            13
            /* ParseErrorCode.UnexpectedEndOfNumber */
          );
          break;
        case 1:
          if (!disallowComments) {
            handleError2(
              11
              /* ParseErrorCode.UnexpectedEndOfComment */
            );
          }
          break;
        case 2:
          handleError2(
            12
            /* ParseErrorCode.UnexpectedEndOfString */
          );
          break;
        case 6:
          handleError2(
            16
            /* ParseErrorCode.InvalidCharacter */
          );
          break;
      }
      switch (token) {
        case 12:
        case 13:
          if (disallowComments) {
            handleError2(
              10
              /* ParseErrorCode.InvalidCommentToken */
            );
          } else {
            onComment();
          }
          break;
        case 16:
          handleError2(
            1
            /* ParseErrorCode.InvalidSymbol */
          );
          break;
        case 15:
        case 14:
          break;
        default:
          return token;
      }
    }
  }
  function handleError2(error, skipUntilAfter = [], skipUntil = []) {
    onError(error);
    if (skipUntilAfter.length + skipUntil.length > 0) {
      let token = _scanner.getToken();
      while (token !== 17) {
        if (skipUntilAfter.indexOf(token) !== -1) {
          scanNext();
          break;
        } else if (skipUntil.indexOf(token) !== -1) {
          break;
        }
        token = scanNext();
      }
    }
  }
  function parseString(isValue) {
    const value = _scanner.getTokenValue();
    if (isValue) {
      onLiteralValue(value);
    } else {
      onObjectProperty(value);
      _jsonPath.push(value);
    }
    scanNext();
    return true;
  }
  function parseLiteral() {
    switch (_scanner.getToken()) {
      case 11:
        const tokenValue = _scanner.getTokenValue();
        let value = Number(tokenValue);
        if (isNaN(value)) {
          handleError2(
            2
            /* ParseErrorCode.InvalidNumberFormat */
          );
          value = 0;
        }
        onLiteralValue(value);
        break;
      case 7:
        onLiteralValue(null);
        break;
      case 8:
        onLiteralValue(true);
        break;
      case 9:
        onLiteralValue(false);
        break;
      default:
        return false;
    }
    scanNext();
    return true;
  }
  function parseProperty() {
    if (_scanner.getToken() !== 10) {
      handleError2(3, [], [
        2,
        5
        /* SyntaxKind.CommaToken */
      ]);
      return false;
    }
    parseString(false);
    if (_scanner.getToken() === 6) {
      onSeparator(":");
      scanNext();
      if (!parseValue()) {
        handleError2(4, [], [
          2,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
    } else {
      handleError2(5, [], [
        2,
        5
        /* SyntaxKind.CommaToken */
      ]);
    }
    _jsonPath.pop();
    return true;
  }
  function parseObject() {
    onObjectBegin();
    scanNext();
    let needsComma = false;
    while (_scanner.getToken() !== 2 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError2(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 2 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError2(6, [], []);
      }
      if (!parseProperty()) {
        handleError2(4, [], [
          2,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
      needsComma = true;
    }
    onObjectEnd();
    if (_scanner.getToken() !== 2) {
      handleError2(7, [
        2
        /* SyntaxKind.CloseBraceToken */
      ], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseArray2() {
    onArrayBegin();
    scanNext();
    let isFirstElement = true;
    let needsComma = false;
    while (_scanner.getToken() !== 4 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError2(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 4 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError2(6, [], []);
      }
      if (isFirstElement) {
        _jsonPath.push(0);
        isFirstElement = false;
      } else {
        _jsonPath[_jsonPath.length - 1]++;
      }
      if (!parseValue()) {
        handleError2(4, [], [
          4,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
      needsComma = true;
    }
    onArrayEnd();
    if (!isFirstElement) {
      _jsonPath.pop();
    }
    if (_scanner.getToken() !== 4) {
      handleError2(8, [
        4
        /* SyntaxKind.CloseBracketToken */
      ], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseValue() {
    switch (_scanner.getToken()) {
      case 3:
        return parseArray2();
      case 1:
        return parseObject();
      case 10:
        return parseString(true);
      default:
        return parseLiteral();
    }
  }
  scanNext();
  if (_scanner.getToken() === 17) {
    if (options.allowEmptyContent) {
      return true;
    }
    handleError2(4, [], []);
    return false;
  }
  if (!parseValue()) {
    handleError2(4, [], []);
    return false;
  }
  if (_scanner.getToken() !== 17) {
    handleError2(9, [], []);
  }
  return true;
}
function getNodeType(value) {
  switch (typeof value) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "object": {
      if (!value) {
        return "null";
      } else if (Array.isArray(value)) {
        return "array";
      }
      return "object";
    }
    default:
      return "null";
  }
}

// node_modules/jsonc-parser/lib/esm/main.js
var ScanError;
(function(ScanError2) {
  ScanError2[ScanError2["None"] = 0] = "None";
  ScanError2[ScanError2["UnexpectedEndOfComment"] = 1] = "UnexpectedEndOfComment";
  ScanError2[ScanError2["UnexpectedEndOfString"] = 2] = "UnexpectedEndOfString";
  ScanError2[ScanError2["UnexpectedEndOfNumber"] = 3] = "UnexpectedEndOfNumber";
  ScanError2[ScanError2["InvalidUnicode"] = 4] = "InvalidUnicode";
  ScanError2[ScanError2["InvalidEscapeCharacter"] = 5] = "InvalidEscapeCharacter";
  ScanError2[ScanError2["InvalidCharacter"] = 6] = "InvalidCharacter";
})(ScanError || (ScanError = {}));
var SyntaxKind;
(function(SyntaxKind2) {
  SyntaxKind2[SyntaxKind2["OpenBraceToken"] = 1] = "OpenBraceToken";
  SyntaxKind2[SyntaxKind2["CloseBraceToken"] = 2] = "CloseBraceToken";
  SyntaxKind2[SyntaxKind2["OpenBracketToken"] = 3] = "OpenBracketToken";
  SyntaxKind2[SyntaxKind2["CloseBracketToken"] = 4] = "CloseBracketToken";
  SyntaxKind2[SyntaxKind2["CommaToken"] = 5] = "CommaToken";
  SyntaxKind2[SyntaxKind2["ColonToken"] = 6] = "ColonToken";
  SyntaxKind2[SyntaxKind2["NullKeyword"] = 7] = "NullKeyword";
  SyntaxKind2[SyntaxKind2["TrueKeyword"] = 8] = "TrueKeyword";
  SyntaxKind2[SyntaxKind2["FalseKeyword"] = 9] = "FalseKeyword";
  SyntaxKind2[SyntaxKind2["StringLiteral"] = 10] = "StringLiteral";
  SyntaxKind2[SyntaxKind2["NumericLiteral"] = 11] = "NumericLiteral";
  SyntaxKind2[SyntaxKind2["LineCommentTrivia"] = 12] = "LineCommentTrivia";
  SyntaxKind2[SyntaxKind2["BlockCommentTrivia"] = 13] = "BlockCommentTrivia";
  SyntaxKind2[SyntaxKind2["LineBreakTrivia"] = 14] = "LineBreakTrivia";
  SyntaxKind2[SyntaxKind2["Trivia"] = 15] = "Trivia";
  SyntaxKind2[SyntaxKind2["Unknown"] = 16] = "Unknown";
  SyntaxKind2[SyntaxKind2["EOF"] = 17] = "EOF";
})(SyntaxKind || (SyntaxKind = {}));
var parseTree4 = parseTree3;
var ParseErrorCode;
(function(ParseErrorCode2) {
  ParseErrorCode2[ParseErrorCode2["InvalidSymbol"] = 1] = "InvalidSymbol";
  ParseErrorCode2[ParseErrorCode2["InvalidNumberFormat"] = 2] = "InvalidNumberFormat";
  ParseErrorCode2[ParseErrorCode2["PropertyNameExpected"] = 3] = "PropertyNameExpected";
  ParseErrorCode2[ParseErrorCode2["ValueExpected"] = 4] = "ValueExpected";
  ParseErrorCode2[ParseErrorCode2["ColonExpected"] = 5] = "ColonExpected";
  ParseErrorCode2[ParseErrorCode2["CommaExpected"] = 6] = "CommaExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBraceExpected"] = 7] = "CloseBraceExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBracketExpected"] = 8] = "CloseBracketExpected";
  ParseErrorCode2[ParseErrorCode2["EndOfFileExpected"] = 9] = "EndOfFileExpected";
  ParseErrorCode2[ParseErrorCode2["InvalidCommentToken"] = 10] = "InvalidCommentToken";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfComment"] = 11] = "UnexpectedEndOfComment";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfString"] = 12] = "UnexpectedEndOfString";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfNumber"] = 13] = "UnexpectedEndOfNumber";
  ParseErrorCode2[ParseErrorCode2["InvalidUnicode"] = 14] = "InvalidUnicode";
  ParseErrorCode2[ParseErrorCode2["InvalidEscapeCharacter"] = 15] = "InvalidEscapeCharacter";
  ParseErrorCode2[ParseErrorCode2["InvalidCharacter"] = 16] = "InvalidCharacter";
})(ParseErrorCode || (ParseErrorCode = {}));
function printParseErrorCode(code) {
  switch (code) {
    case 1:
      return "InvalidSymbol";
    case 2:
      return "InvalidNumberFormat";
    case 3:
      return "PropertyNameExpected";
    case 4:
      return "ValueExpected";
    case 5:
      return "ColonExpected";
    case 6:
      return "CommaExpected";
    case 7:
      return "CloseBraceExpected";
    case 8:
      return "CloseBracketExpected";
    case 9:
      return "EndOfFileExpected";
    case 10:
      return "InvalidCommentToken";
    case 11:
      return "UnexpectedEndOfComment";
    case 12:
      return "UnexpectedEndOfString";
    case 13:
      return "UnexpectedEndOfNumber";
    case 14:
      return "InvalidUnicode";
    case 15:
      return "InvalidEscapeCharacter";
    case 16:
      return "InvalidCharacter";
  }
  return "<unknown ParseErrorCode>";
}

// lib/workspace-data-lock.ts
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { open as open2, readFile, unlink } from "node:fs/promises";
import * as path3 from "node:path";
var DATA_WRITE_LOCK_FILENAME = ".data-write.lock";
function errorCode(error) {
  return error && typeof error === "object" && "code" in error ? String(error.code) : void 0;
}
function isLockRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  return record.version === 1 && Number.isInteger(record.pid) && typeof record.hostname === "string" && typeof record.token === "string" && typeof record.purpose === "string" && typeof record.createdAt === "string";
}
function localProcessIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) !== "ESRCH";
  }
}
async function readLock(lockPath) {
  try {
    const value = JSON.parse(await readFile(lockPath, "utf8"));
    return isLockRecord(value) ? value : null;
  } catch {
    return null;
  }
}
async function acquireLock(workspaceRoot, purpose) {
  const lockPath = path3.join(workspaceRoot, ".SNL_Doc", DATA_WRITE_LOCK_FILENAME);
  const record = {
    version: 1,
    pid: process.pid,
    hostname: hostname(),
    token: randomUUID(),
    purpose,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    const handle = await open2(lockPath, "wx", 384);
    try {
      await handle.writeFile(`${JSON.stringify(record)}
`, "utf8");
      await handle.sync();
      return { handle, lockPath, record };
    } catch (error) {
      await handle.close();
      await unlink(lockPath).catch(() => void 0);
      throw error;
    }
  } catch (error) {
    if (errorCode(error) !== "EEXIST") throw error;
    const existing = await readLock(lockPath);
    const stale = existing !== null && existing.hostname === hostname() && !localProcessIsAlive(existing.pid);
    if (stale) {
      throw new Error(
        `SNL workspace data has a stale ${existing.purpose} lock from pid ${existing.pid}. After confirming no writer is active, remove ${lockPath} and retry.`
      );
    }
    const owner = existing ? `${existing.purpose} by pid ${existing.pid} on ${existing.hostname}` : "an unreadable lock (remove it only after confirming no writer is active)";
    throw new Error(`SNL workspace data is locked for ${owner}.`);
  }
}
async function withWorkspaceDataLock(workspaceRoot, purpose, task) {
  const acquired = await acquireLock(workspaceRoot, purpose);
  try {
    return await task();
  } finally {
    await acquired.handle.close();
    const current = await readLock(acquired.lockPath);
    if (current?.token === acquired.record.token) {
      try {
        await unlink(acquired.lockPath);
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
      }
    }
  }
}

// lib/entity-references.ts
async function findEntityReferences(workspaceRoot, entityType2, id) {
  const canonicalWorkspace = await validateWorkspaceBoundary(workspaceRoot);
  validateNonEmptyIdentity(id);
  const files = await loadWorkspaceJson(canonicalWorkspace);
  return collectOccurrences(files, entityType2, id).sort(compareOccurrence);
}
function macroIsActive(files, id) {
  const config = files.find((file) => file.relPath === "config.json")?.data;
  const active = Array.isArray(config?.active_macro_packages) ? new Set(config.active_macro_packages) : null;
  return files.some((file) => {
    if (file.relPath.startsWith("macros/")) {
      const packageId = file.data?.package;
      if (typeof packageId !== "string" || active && !active.has(packageId)) return false;
      return file.data?.macro?.name === id;
    }
    if (!file.relPath.startsWith("term_macros/")) return false;
    const bare = path4.posix.basename(file.relPath, ".json");
    if (active && !active.has(bare)) return false;
    const macros2 = file.data?.macros;
    return isRecord4(macros2) && Object.prototype.hasOwnProperty.call(macros2, id);
  });
}
function collectOccurrences(files, entityType2, id, options = {}) {
  const out = [];
  const includeSnlMacroTokens = entityType2 !== "macro" || options.includeUnresolvedMacroTokens === true || macroIsActive(files, id);
  for (const file of files) {
    collectFileOccurrences(file, entityType2, id, out, includeSnlMacroTokens);
  }
  return out;
}
function collectFileOccurrences(file, entityType2, id, out, includeSnlMacroTokens) {
  const data = file.data;
  if (/^packages\/[^/]+\.json$/.test(file.relPath)) {
    if (entityType2 === "entry" && Array.isArray(data?.entry_ids)) {
      data.entry_ids.forEach((entryId, index) => {
        if (entryId === id) {
          out.push(occurrence(file, entityType2, id, "reference", `entry_ids[${index}]`));
        }
      });
    }
    return;
  }
  if (/^entries\/[^/]+\.json$/.test(file.relPath)) {
    const entry = data?.entry;
    if (entityType2 === "entry" && entry?.id === id) {
      out.push(occurrence(file, entityType2, id, "definition", "entry.id"));
    }
    const snl = entry?.content?.snl;
    if (typeof snl === "string" && snl.trim() !== "") {
      for (const ref of scanSnlReferences(snl, {
        postfixedMacroNames: entityType2 === "macro" && includeSnlMacroTokens ? /* @__PURE__ */ new Set([id]) : void 0
      })) {
        if (ref.entityType !== entityType2 || ref.id !== id) continue;
        if (entityType2 === "macro" && !includeSnlMacroTokens) continue;
        const pos = offsetPosition(snl, ref.start);
        out.push({
          ...occurrence(file, entityType2, id, "reference", "entry.content.snl"),
          offset: ref.start,
          snlLine: pos.line,
          snlColumn: pos.column
        });
      }
    }
    return;
  }
  if (/^macros\/[^/]+\.json$/.test(file.relPath)) {
    const macro = data?.macro;
    if (entityType2 === "macro" && macro?.name === id) {
      out.push(occurrence(file, entityType2, id, "definition", "macro.name"));
    }
    if (entityType2 === "entry" && Array.isArray(macro?.source?.entries)) {
      macro.source.entries.forEach((entryId, index) => {
        if (entryId === id) {
          out.push(occurrence(file, entityType2, id, "reference", `macro.source.entries[${index}]`));
        }
      });
    }
    return;
  }
  if (file.relPath === "entries.json" && Array.isArray(data)) {
    data.forEach((entry, index) => {
      if (entityType2 === "entry" && entry?.id === id) {
        out.push(occurrence(file, entityType2, id, "definition", `[${index}].id`));
      }
      const snl = entry?.content?.snl;
      if (typeof snl === "string" && snl.trim() !== "") {
        for (const ref of scanSnlReferences(snl, {
          postfixedMacroNames: entityType2 === "macro" && includeSnlMacroTokens ? /* @__PURE__ */ new Set([id]) : void 0
        })) {
          if (ref.entityType !== entityType2 || ref.id !== id) continue;
          if (entityType2 === "macro" && !includeSnlMacroTokens) continue;
          const pos = offsetPosition(snl, ref.start);
          out.push({
            ...occurrence(file, entityType2, id, "reference", `[${index}].content.snl`),
            offset: ref.start,
            snlLine: pos.line,
            snlColumn: pos.column
          });
        }
      }
    });
    return;
  }
  if (file.relPath.startsWith("term_macros/")) {
    const macros2 = data?.macros;
    if (!macros2 || typeof macros2 !== "object" || Array.isArray(macros2)) return;
    for (const [macroId, macro] of Object.entries(macros2)) {
      if (entityType2 === "macro" && macroId === id) {
        out.push(occurrence(file, entityType2, id, "definition", `macros[${JSON.stringify(macroId)}]`));
      }
      if (entityType2 === "entry" && Array.isArray(macro?.source?.entries)) {
        macro.source.entries.forEach((entryId, index) => {
          if (entryId === id) {
            out.push(
              occurrence(
                file,
                entityType2,
                id,
                "reference",
                `macros[${JSON.stringify(macroId)}].source.entries[${index}]`
              )
            );
          }
        });
      }
    }
    return;
  }
  if (entityType2 === "entry" && /^libraries\/[^/]+\/graph\.json$/.test(file.relPath) && Array.isArray(data?.nodes)) {
    data.nodes.forEach((node, index) => {
      if (node?.props?.entryId === id) {
        out.push(occurrence(file, entityType2, id, "reference", `nodes[${index}].props.entryId`));
      }
    });
  } else if (file.relPath === "relationships.json" && Array.isArray(data?.relationships)) {
    data.relationships.forEach((rel2, index) => {
      if (entityType2 === "entry" && rel2?.from === id) {
        out.push(occurrence(file, entityType2, id, "reference", `relationships[${index}].from`));
      }
      if (entityType2 === "entry" && rel2?.to === id) {
        out.push(occurrence(file, entityType2, id, "reference", `relationships[${index}].to`));
      }
      if (rel2?.metadata?.generator !== "macro-source-scan") return;
      const witnessField = entityType2 === "macro" ? "macros" : "postfixes";
      const witnesses = rel2.metadata[witnessField];
      if (!Array.isArray(witnesses)) return;
      witnesses.forEach((value, witnessIndex) => {
        if (value === id) {
          out.push(
            occurrence(
              file,
              entityType2,
              id,
              "reference",
              `relationships[${index}].metadata.${witnessField}[${witnessIndex}]`
            )
          );
        }
      });
    });
  }
}
function scanSnlReferences(source, options = {}) {
  y(source);
  const tokens = tokenizeSnl(source);
  const refs = [];
  for (let i4 = 0; i4 < tokens.length; i4++) {
    const token = tokens[i4];
    if (token.type !== "ident") continue;
    const prev = tokens[i4 - 1];
    const next = tokens[i4 + 1];
    if (prev?.type === "lbracket" || prev?.type === "hash") continue;
    if (prev?.type === "at" && !isPostfixAt(tokens[i4 - 2])) continue;
    if (next?.type === "at") {
      if (options.postfixedMacroNames?.has(token.value)) {
        refs.push({ entityType: "macro", id: token.value, start: token.start, end: token.end });
      }
      continue;
    }
    if (prev?.type === "at" && isPostfixAt(tokens[i4 - 2])) {
      refs.push({ entityType: "entry", id: token.value, start: token.start, end: token.end });
      continue;
    }
    if (/^\d+(?:\.\d+)*$/.test(token.value)) continue;
    refs.push({ entityType: "macro", id: token.value, start: token.start, end: token.end });
  }
  return refs;
}
function isPostfixAt(previous) {
  return previous !== void 0 && ["ident", "delimited", "rparen", "rbracket"].includes(previous.type);
}
function tokenizeSnl(source) {
  const tokens = [];
  let i4 = 0;
  while (i4 < source.length) {
    const ch2 = source[i4];
    if (/\s/.test(ch2)) {
      i4++;
      continue;
    }
    if (ch2 === "$" || ch2 === "%" || ch2 === "`") {
      const delimiter = ch2 === "$" && source[i4 + 1] === "$" ? "$$" : ch2;
      const close2 = source.indexOf(delimiter, i4 + delimiter.length);
      if (close2 < 0) throw new Error(`Malformed SNL: unclosed ${delimiter} delimiter at offset ${i4}.`);
      tokens.push({ type: "delimited", value: source.slice(i4, close2 + delimiter.length), start: i4, end: close2 + delimiter.length });
      i4 = close2 + delimiter.length;
      continue;
    }
    if (/[A-Za-z0-9_\\]/.test(ch2)) {
      const start = i4++;
      while (i4 < source.length && /[A-Za-z0-9_.\-]/.test(source[i4])) i4++;
      tokens.push({ type: "ident", value: source.slice(start, i4), start, end: i4 });
      continue;
    }
    const punctuation = {
      "@": "at",
      "#": "hash",
      "(": "lparen",
      ")": "rparen",
      "[": "lbracket",
      "]": "rbracket",
      ",": "comma",
      "=": "eq"
    };
    const type = punctuation[ch2];
    if (!type) throw new Error(`Malformed SNL: unexpected character ${JSON.stringify(ch2)} at offset ${i4}.`);
    tokens.push({ type, value: ch2, start: i4, end: i4 + 1 });
    i4++;
  }
  return tokens;
}
async function validateWorkspaceBoundary(workspaceRoot) {
  const requestedRoot = path4.resolve(workspaceRoot);
  let canonicalRoot;
  try {
    canonicalRoot = await fs2.realpath(requestedRoot);
  } catch {
    throw new Error(`Workspace root does not exist: ${requestedRoot}`);
  }
  const rootStat = await fs2.lstat(canonicalRoot);
  if (!rootStat.isDirectory()) throw new Error(`Workspace root is not a directory: ${canonicalRoot}`);
  const requestedDoc = path4.join(requestedRoot, ".SNL_Doc");
  let docStat;
  try {
    docStat = await fs2.lstat(requestedDoc);
  } catch {
    throw new Error(
      `No .SNL_Doc/ folder at ${requestedRoot}. Point --root at the workspace that contains .SNL_Doc/.`
    );
  }
  if (!docStat.isDirectory() || docStat.isSymbolicLink()) {
    throw new Error(`${requestedDoc} must be a real directory, not a symlink.`);
  }
  const canonicalDoc = await fs2.realpath(requestedDoc);
  const expectedDoc = path4.join(canonicalRoot, ".SNL_Doc");
  if (canonicalDoc !== expectedDoc) {
    throw new Error(`${requestedDoc} escapes the canonical workspace boundary.`);
  }
  return canonicalRoot;
}
async function assertCanonicalDirectory(dir, docRoot2) {
  const stat = await fs2.lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${dir} must be a real directory, not a symlink.`);
  }
  const real = await fs2.realpath(dir);
  const relative2 = path4.relative(docRoot2, real);
  if (relative2.startsWith("..") || path4.isAbsolute(relative2)) {
    throw new Error(`${dir} escapes the canonical .SNL_Doc boundary.`);
  }
}
async function workspaceUsesEntityStorage(root) {
  const configPath2 = path4.join(root, "config.json");
  let handle;
  try {
    handle = await fs2.open(configPath2, constants2.O_RDONLY | constants2.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error(`${configPath2} must be a regular, non-symlink file.`);
    const config = JSON.parse(await handle.readFile("utf8"));
    return usesEntityStorage(config);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    if (error.code === "ELOOP") {
      throw new Error(`${configPath2} must be a regular, non-symlink file.`);
    }
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}
async function appendJsonDirectoryCandidates(root, relativeDirectory, candidates) {
  const directory = path4.join(root, relativeDirectory);
  try {
    await assertCanonicalDirectory(directory, root);
    for (const entry of await fs2.readdir(directory, { withFileTypes: true })) {
      const absolute = path4.join(directory, entry.name);
      if (entry.name.endsWith(".json") && entry.isSymbolicLink()) {
        throw new Error(`${absolute} must not be a symlink.`);
      }
      if (entry.isFile() && entry.name.endsWith(".json")) {
        candidates.push(path4.join(relativeDirectory, entry.name));
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
async function loadWorkspaceJson(workspaceRoot) {
  const root = snlDocRoot(workspaceRoot);
  await assertCanonicalDirectory(root, root);
  const entityStorage = await workspaceUsesEntityStorage(root);
  const candidates = ["config.json", "relationships.json"];
  if (entityStorage) {
    await Promise.all([
      readEntries(workspaceRoot),
      readActiveMacros(workspaceRoot)
    ]);
    await appendJsonDirectoryCandidates(root, "packages", candidates);
    await appendJsonDirectoryCandidates(root, "entries", candidates);
    await appendJsonDirectoryCandidates(root, "macros", candidates);
  } else {
    candidates.push("entries.json");
    await appendJsonDirectoryCandidates(root, "term_macros", candidates);
  }
  const libraryRoot = path4.join(root, "libraries");
  try {
    await assertCanonicalDirectory(libraryRoot, root);
    const libraries = await fs2.readdir(libraryRoot, { withFileTypes: true });
    for (const entry of libraries) {
      if (!entry.name.startsWith(".") && entry.isSymbolicLink()) {
        throw new Error(`${path4.join(libraryRoot, entry.name)} must not be a symlink.`);
      }
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        await assertCanonicalDirectory(path4.join(libraryRoot, entry.name), root);
        candidates.push(path4.join("libraries", entry.name, "graph.json"));
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const unique = [...new Set(candidates)].sort();
  const loaded = [];
  for (const relPath of unique) {
    const absPath = path4.join(root, relPath);
    await assertCanonicalDirectory(path4.dirname(absPath), root);
    let raw;
    let stat;
    let handle;
    try {
      handle = await fs2.open(absPath, constants2.O_RDONLY | constants2.O_NOFOLLOW);
      stat = await handle.stat();
      if (!stat.isFile()) {
        throw new Error(`${absPath} must be a regular, non-symlink file.`);
      }
      raw = await handle.readFile("utf8");
    } catch (error) {
      if (handle) await handle.close();
      if (error.code === "ENOENT") continue;
      if (error.code === "ELOOP") {
        throw new Error(`${absPath} must be a regular, non-symlink file.`);
      }
      throw error;
    }
    await handle.close();
    const errors = [];
    const tree = parseTree4(raw, errors, { disallowComments: true, allowTrailingComma: false });
    if (!tree || errors.length > 0) {
      const detail = errors.map((e) => `${printParseErrorCode(e.error)}@${e.offset}`).join(", ");
      throw new Error(`Failed to parse ${absPath}: ${detail || "empty JSON document"}`);
    }
    validateNoDuplicateKeys(tree, absPath);
    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Failed to parse ${absPath}: ${error.message}`);
    }
    const rel2 = relPath.split(path4.sep).join("/");
    validateSchemaShape(absPath, rel2, data);
    loaded.push({
      absPath,
      relPath: rel2,
      raw,
      data,
      tree,
      mode: stat.mode,
      device: stat.dev,
      inode: stat.ino,
      docRoot: root
    });
  }
  return loaded;
}
function validateNoDuplicateKeys(node, absPath) {
  if (node.type === "object") {
    const seen = /* @__PURE__ */ new Set();
    for (const property2 of node.children ?? []) {
      const key = property2.children?.[0]?.value;
      if (typeof key !== "string") continue;
      if (seen.has(key)) {
        throw new Error(`${absPath}: duplicate JSON property ${JSON.stringify(key)} is not safe to migrate.`);
      }
      seen.add(key);
    }
  }
  for (const child of node.children ?? []) validateNoDuplicateKeys(child, absPath);
}
function validateSchemaShape(absPath, relPath, data) {
  const value = data;
  const fail = (message) => {
    throw new Error(`${absPath}: ${message}`);
  };
  if (relPath === "config.json") {
    if (!isRecord4(value)) fail("config.json must be an object.");
    if (value.active_macro_packages !== void 0 && (!Array.isArray(value.active_macro_packages) || !value.active_macro_packages.every((item) => typeof item === "string"))) {
      fail("config.active_macro_packages must be a string array when present.");
    }
    return;
  }
  if (/^packages\/[^/]+\.json$/.test(relPath)) {
    if (!isRecord4(value) || value.format !== "snl-package" || value.version !== 1 || typeof value.id !== "string" || typeof value.name !== "string" || typeof value.description !== "string") {
      fail("Package manifest must use the snl-package v1 envelope.");
    }
    if (relPath !== packageManifestPath(value.id)) fail("Package manifest path does not match its logical identity.");
    return;
  }
  if (/^entries\/[^/]+\.json$/.test(relPath)) {
    if (!isRecord4(value) || value.format !== "snl-entry" || value.version !== 1 || typeof value.package !== "string" || !isRecord4(value.entry) || typeof value.entry.id !== "string" || !isRecord4(value.entry.content) || value.entry.package !== value.package) {
      fail("Entry entity must use the snl-entry v1 envelope with matching Package identity.");
    }
    if (relPath !== entryEntityPath(value.package, value.entry.id)) fail("Entry entity path does not match its logical identity.");
    if (value.entry.content.snl !== void 0 && typeof value.entry.content.snl !== "string") {
      fail("Entry content.snl must be a string when present.");
    }
    return;
  }
  if (/^macros\/[^/]+\.json$/.test(relPath)) {
    if (!isRecord4(value) || value.format !== "snl-macro" || value.version !== 1 || typeof value.package !== "string" || !isRecord4(value.macro) || typeof value.macro.name !== "string" || !isRecord4(value.macro.source) || !Array.isArray(value.macro.source.entries) || !value.macro.source.entries.every((item) => typeof item === "string")) {
      fail("Macro entity must use the snl-macro v1 envelope with source.entries[].");
    }
    if (relPath !== macroEntityPath(value.package, value.macro.name)) fail("Macro entity path does not match its logical identity.");
    return;
  }
  if (relPath === "entries.json") {
    if (!Array.isArray(value)) fail("entries.json must be an array.");
    value.forEach((entry, index) => {
      if (!isRecord4(entry) || typeof entry.id !== "string" || !isRecord4(entry.content)) {
        fail(`entry ${index} must contain string id and object content.`);
      }
      if (entry.content.snl !== void 0 && typeof entry.content.snl !== "string") {
        fail(`entry ${index} content.snl must be a string when present.`);
      }
    });
    return;
  }
  if (relPath.startsWith("term_macros/")) {
    if (!isRecord4(value) || !isRecord4(value.macros)) fail("macro package must contain an object macros map.");
    for (const [name2, macro] of Object.entries(value.macros)) {
      if (!isRecord4(macro) || !isRecord4(macro.source) || !Array.isArray(macro.source.entries)) {
        fail(`macro ${JSON.stringify(name2)} must contain source.entries[].`);
      }
      if (!macro.source.entries.every((item) => typeof item === "string")) {
        fail(`macro ${JSON.stringify(name2)} source.entries must contain only strings.`);
      }
    }
    return;
  }
  if (/^libraries\/[^/]+\/graph\.json$/.test(relPath)) {
    if (!isRecord4(value) || !Array.isArray(value.nodes) || !Array.isArray(value.relationships)) {
      fail("Library graph must contain nodes[] and relationships[].");
    }
    value.nodes.forEach((node, index) => {
      if (!isRecord4(node) || !isRecord4(node.props)) fail(`graph node ${index} must contain object props.`);
      if (node.props.entryId !== void 0 && typeof node.props.entryId !== "string") {
        fail(`graph node ${index} props.entryId must be a string when present.`);
      }
    });
    return;
  }
  if (relPath === "relationships.json") {
    if (!isRecord4(value) || !Array.isArray(value.relationships)) {
      fail("relationships.json must contain relationships[].");
    }
    value.relationships.forEach((rel2, index) => {
      if (!isRecord4(rel2) || typeof rel2.from !== "string" || typeof rel2.to !== "string") {
        fail(`relationship ${index} must contain string from/to.`);
      }
      if (isRecord4(rel2.metadata) && rel2.metadata.generator === "macro-source-scan") {
        for (const field of ["macros", "postfixes"]) {
          const values = rel2.metadata[field];
          if (values !== void 0 && (!Array.isArray(values) || !values.every((v2) => typeof v2 === "string"))) {
            fail(`relationship ${index} metadata.${field} must be a string array when present.`);
          }
        }
      }
    });
  }
}
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validateNonEmptyIdentity(id) {
  if (id.trim() === "") throw new Error("Identity must be a non-empty string.");
}
function occurrence(file, entityType2, id, role2, jsonPath) {
  let category;
  if (role2 === "definition") category = "definition";
  else if (file.relPath.startsWith("packages/") && jsonPath.startsWith("entry_ids[")) category = "package-membership";
  else if (jsonPath.includes(".content.snl")) category = "snl";
  else if (/^libraries\//.test(file.relPath)) category = "library-index";
  else if (jsonPath.includes(".source.entries[")) category = "macro-source";
  else if (jsonPath.includes(".metadata.macros[") || jsonPath.includes(".metadata.postfixes[")) category = "generated-witness";
  else category = "relationship";
  return { entityType: entityType2, id, role: role2, category, file: file.relPath, path: jsonPath };
}
function offsetPosition(source, offset) {
  const before = source.slice(0, offset).split("\n");
  return { line: before.length, column: before[before.length - 1].length + 1 };
}
function compareOccurrence(a3, b2) {
  return a3.file.localeCompare(b2.file) || a3.path.localeCompare(b2.path) || (a3.offset ?? -1) - (b2.offset ?? -1);
}

// lib/entity-writes.ts
import { constants as constants3, promises as fs3 } from "node:fs";
import * as path5 from "node:path";
import { randomUUID as randomUUID2 } from "node:crypto";
function isRecord5(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function assertCurrentWriteConfig(config, cli) {
  if (!usesEntityStorage(config)) {
    throw new Error(`${cli} requires workspace data 0.0.6, 0.0.11, or 0.1.0 per-entity storage.`);
  }
  if (!isRecord5(config) || !Array.isArray(config.entry_kinds)) {
    throw new Error("Current config.json entry_kinds must be an array.");
  }
  if (!Array.isArray(config.macro_kinds)) {
    throw new Error("Current config.json macro_kinds must be an array.");
  }
}
function effectiveActivePackageIds(config, packages) {
  const configured = config.active_macro_packages;
  return new Set(Array.isArray(configured) ? configured.filter((id) => typeof id === "string") : Object.keys(packages).filter((id) => id !== UNPACKAGED_PACKAGE_ID));
}
async function canonicalWriteWorkspaceRoot(workspaceRoot) {
  const resolved = path5.resolve(workspaceRoot);
  const real = await fs3.realpath(resolved);
  const stat = await fs3.lstat(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || real !== resolved) {
    throw new Error(`Workspace root ${resolved} must be a canonical, non-symlink directory.`);
  }
  const doc = path5.join(resolved, ".SNL_Doc");
  let docStat;
  try {
    docStat = await fs3.lstat(doc);
  } catch {
    throw new Error(`Workspace must contain an existing .SNL_Doc directory: ${doc}.`);
  }
  if (!docStat.isDirectory() || docStat.isSymbolicLink()) {
    throw new Error(`${doc} must be a real directory, not a symlink.`);
  }
  const realDoc = await fs3.realpath(doc);
  if (realDoc !== path5.join(real, ".SNL_Doc")) {
    throw new Error(`${doc} escapes the canonical workspace boundary.`);
  }
  return resolved;
}
function normalizeEntryDraft(raw, packageOverride) {
  if (!isRecord5(raw)) return raw;
  const normalizedOverride = typeof packageOverride === "string" ? packageOverride.trim() : packageOverride;
  const packageId = normalizedOverride !== void 0 ? normalizedOverride : raw.package !== void 0 ? typeof raw.package === "string" ? raw.package.trim() : raw.package : UNPACKAGED_PACKAGE_ID;
  return {
    ...raw,
    id: raw.id === void 0 ? raw.id : typeof raw.id === "string" ? raw.id.trim() : raw.id,
    package: packageId,
    kind: raw.kind === void 0 ? raw.kind : typeof raw.kind === "string" ? raw.kind.trim() : raw.kind,
    title: raw.title === void 0 ? "" : typeof raw.title === "string" ? raw.title.trim() : raw.title,
    content: raw.content === void 0 ? {} : raw.content,
    contribution_info: Object.prototype.hasOwnProperty.call(raw, "contribution_info") ? raw.contribution_info : null,
    pointer: Object.prototype.hasOwnProperty.call(raw, "pointer") ? raw.pointer : null
  };
}
function templateUsesVariadic(value) {
  if (typeof value !== "string") return false;
  for (let index = 0; index < value.length - 1; index += 1) {
    if (value[index] !== "#" || value[index + 1] !== "*") continue;
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) slashes += 1;
    if (slashes % 2 === 0) return true;
  }
  return false;
}
function normalizeMacroDraft(raw, current = false) {
  if (!isRecord5(raw)) return raw;
  const styles2 = Array.isArray(raw.styles) ? raw.styles.map((style) => isRecord5(style) ? { ...style, tags: style.tags === void 0 ? [] : style.tags } : style) : raw.styles;
  const firstStyle = Array.isArray(styles2) && isRecord5(styles2[0]) && typeof styles2[0].style_name === "string" ? styles2[0].style_name : void 0;
  const source = raw.source === void 0 ? {} : raw.source;
  const normalizedSource = isRecord5(source) ? {
    ...source,
    entries: source.entries === void 0 ? [] : source.entries,
    urls: source.urls === void 0 ? [] : source.urls
  } : source;
  return {
    ...raw,
    description: raw.description === void 0 ? "" : raw.description,
    source: normalizedSource,
    kind: current && raw.kind === void 0 ? "const" : raw.kind,
    dynamic_arity: raw.dynamic_arity === void 0 ? Array.isArray(styles2) && styles2.some((style) => isRecord5(style) && (current ? macroV11TemplateUsesVariadic(style.template) : templateUsesVariadic(style.template))) : raw.dynamic_arity,
    ...current ? {} : {
      default_style: raw.default_style === void 0 ? firstStyle ? { en: firstStyle } : void 0 : raw.default_style
    },
    tags: raw.tags === void 0 ? [] : raw.tags,
    styles: styles2
  };
}
function macroV11TemplateUsesVariadic(value) {
  if (!isRecord5(value)) return false;
  if (value.type === "i18n" && isRecord5(value.values)) {
    return Object.values(value.values).some(macroV11TemplateUsesVariadic);
  }
  return templateUsesVariadic(value.body);
}
async function installNewJson(docRoot2, relativePath, value) {
  const target = path5.join(docRoot2, relativePath);
  const directory = path5.dirname(target);
  const dirStat = await fs3.lstat(directory);
  if (!dirStat.isDirectory() || dirStat.isSymbolicLink()) {
    throw new Error(`${directory} must be a regular, non-symlink directory.`);
  }
  const temp = path5.join(directory, `.${path5.basename(target)}.snl-add-${process.pid}-${randomUUID2()}.tmp`);
  let handle;
  try {
    handle = await fs3.open(temp, constants3.O_CREAT | constants3.O_EXCL | constants3.O_WRONLY, 420);
    await handle.writeFile(jsonText(value), "utf8");
    await handle.sync();
    await handle.close();
    handle = void 0;
    await fs3.link(temp, target);
  } finally {
    await handle?.close();
    await fs3.rm(temp, { force: true });
  }
}
function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}
async function readRegularText(file) {
  let handle;
  try {
    handle = await fs3.open(file, constants3.O_RDONLY | constants3.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error(`${file} must be a regular, non-symlink file.`);
    return { text: await handle.readFile("utf8"), mode: stat.mode & 511 };
  } finally {
    await handle?.close();
  }
}
async function replaceJsonIfUnchanged(file, expected, value) {
  const current = await readRegularText(file);
  if (current.text !== expected) throw new Error(`${file} changed during Package creation; refusing to overwrite it.`);
  const directory = path5.dirname(file);
  const temp = path5.join(directory, `.${path5.basename(file)}.snl-add-${process.pid}-${randomUUID2()}.tmp`);
  let handle;
  try {
    handle = await fs3.open(temp, constants3.O_CREAT | constants3.O_EXCL | constants3.O_WRONLY, current.mode);
    await handle.writeFile(jsonText(value), "utf8");
    await handle.sync();
    await handle.close();
    handle = void 0;
    if ((await readRegularText(file)).text !== expected) {
      throw new Error(`${file} changed during Package creation; refusing to overwrite it.`);
    }
    await fs3.rename(temp, file);
  } finally {
    await handle?.close();
    await fs3.rm(temp, { force: true });
  }
}
async function addEntryEntity(workspaceRoot, raw, options = {}) {
  workspaceRoot = await canonicalWriteWorkspaceRoot(workspaceRoot);
  return withWorkspaceDataLock(workspaceRoot, "add Entry entity", async () => {
    const config = await readConfig(workspaceRoot);
    assertCurrentWriteConfig(config, "snl-add-entry");
    const [entries, entryKinds, macros2, packages] = await Promise.all([
      readEntries(workspaceRoot),
      readEntryKinds(workspaceRoot),
      readActiveMacros(workspaceRoot),
      readAllMacroPackages(workspaceRoot)
    ]);
    const normalized = normalizeEntryDraft(raw, options.package);
    const issues = [];
    if (isRecord5(raw) && options.package !== void 0 && Object.prototype.hasOwnProperty.call(raw, "package") && (typeof raw.package !== "string" || raw.package.trim() !== options.package.trim())) {
      issues.push({
        severity: "error",
        code: "entry.package-mismatch",
        message: `Draft package ${JSON.stringify(raw.package)} disagrees with --package ${JSON.stringify(options.package)}.`,
        path: "package"
      });
    }
    const report = lintEntry(normalized, {
      entryKinds,
      macros: macros2,
      siblingEntries: entries,
      strictMacros: options.strictMacros
    });
    issues.push(...report.issues);
    const packageValue = isRecord5(normalized) ? normalized.package : void 0;
    let packageId = "";
    if (typeof packageValue !== "string" || packageValue.length === 0) {
      issues.push({
        severity: "error",
        code: "entry.bad-package",
        message: "Entry package must be a non-empty Package ID string.",
        path: "package"
      });
    } else {
      packageId = packageValue;
      try {
        assertPackageId(packageId);
      } catch (error) {
        issues.push({
          severity: "error",
          code: "entry.bad-package",
          message: error instanceof Error ? error.message : String(error),
          path: "package"
        });
      }
    }
    if (packageId && !Object.prototype.hasOwnProperty.call(packages, packageId)) {
      issues.push({
        severity: "error",
        code: "entry.package-not-found",
        message: `Package ${JSON.stringify(packageId)} does not exist. Create it first or use _unpackaged.`,
        path: "package"
      });
    }
    if (issues.some((issue) => issue.code === "entry.duplicate-id")) {
      const id = isRecord5(normalized) && typeof normalized.id === "string" ? normalized.id : "";
      return {
        status: "conflict",
        entity: "entry",
        code: "entry.duplicate-id",
        message: `Entry id ${JSON.stringify(id)} already exists.`
      };
    }
    if (issues.some((issue) => issue.severity === "error")) {
      return { status: "invalid", entity: "entry", issues };
    }
    const entry = normalized;
    const relativePath = entryEntityPath(entry.package, entry.id);
    const envelope = {
      format: "snl-entry",
      version: ENTRY_STORAGE_VERSION,
      ...usesCurrentEntitySchemas(config) ? { schema_version: CURRENT_ENTRY_SCHEMA_VERSION } : {},
      package: entry.package,
      entry
    };
    const manifestFile = path5.join(
      snlDocRoot(workspaceRoot),
      packageManifestPath(entry.package)
    );
    const originalManifest = usesCurrentEntitySchemas(config) ? await readRegularText(manifestFile) : null;
    const nextManifest = originalManifest ? (() => {
      const manifest = JSON.parse(originalManifest.text);
      const entryIds = Array.isArray(manifest.entry_ids) ? manifest.entry_ids.filter((value) => typeof value === "string") : [];
      return {
        ...manifest,
        entry_ids: [.../* @__PURE__ */ new Set([...entryIds, entry.id])].sort((left, right) => left.localeCompare(right))
      };
    })() : null;
    try {
      await installNewJson(snlDocRoot(workspaceRoot), relativePath, envelope);
      if (originalManifest && nextManifest) {
        try {
          await options.beforePackageManifestInstall?.();
          await replaceJsonIfUnchanged(manifestFile, originalManifest.text, nextManifest);
        } catch (error) {
          const entityFile = path5.join(snlDocRoot(workspaceRoot), relativePath);
          try {
            await removeJsonIfUnchanged(entityFile, jsonText(envelope));
          } catch (rollbackError) {
            throw new Error(
              `${error instanceof Error ? error.message : String(error)} Rollback of ${entityFile} failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}.`,
              { cause: error }
            );
          }
          throw error;
        }
      }
    } catch (error) {
      if (error.code === "EEXIST") {
        return {
          status: "conflict",
          entity: "entry",
          code: "entry.duplicate-id",
          message: `Entry id ${JSON.stringify(entry.id)} already exists.`
        };
      }
      throw error;
    }
    return {
      status: "created",
      entity: "entry",
      id: entry.id,
      package: entry.package,
      path: relativePath,
      issues
    };
  });
}
async function removeJsonIfUnchanged(file, expected) {
  let handle;
  try {
    handle = await fs3.open(file, constants3.O_RDONLY | constants3.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || await handle.readFile("utf8") !== expected) {
      throw new Error("installed entity changed concurrently; refusing to remove it");
    }
    const current = await fs3.lstat(file);
    if (current.isSymbolicLink() || current.dev !== stat.dev || current.ino !== stat.ino) {
      throw new Error("installed entity path changed concurrently; refusing to remove it");
    }
    await fs3.rm(file);
  } finally {
    await handle?.close();
  }
}
async function addMacroEntity(workspaceRoot, packageId, raw, options = {}) {
  workspaceRoot = await canonicalWriteWorkspaceRoot(workspaceRoot);
  return withWorkspaceDataLock(workspaceRoot, "add Macro entity", async () => {
    const config = await readConfig(workspaceRoot);
    assertCurrentWriteConfig(config, "snl-add-macro");
    const packages = await readAllMacroPackages(workspaceRoot);
    const issues = [];
    if (packageId === UNPACKAGED_PACKAGE_ID) {
      issues.push({
        severity: "error",
        code: "macro.system-package",
        message: "Macros cannot be added to the system _unpackaged Package.",
        path: "package"
      });
    } else if (!Object.prototype.hasOwnProperty.call(packages, packageId)) {
      issues.push({
        severity: "error",
        code: "macro.package-not-found",
        message: `Package ${JSON.stringify(packageId)} does not exist. Create it first with snl-add-package.`,
        path: "package"
      });
    }
    const current = usesCurrentEntitySchemas(config);
    const normalized = normalizeMacroDraft(raw, current);
    const name2 = isRecord5(normalized) && typeof normalized.name === "string" ? normalized.name : "";
    if (!name2 || /[@#$%\s()[\]{}]/u.test(name2)) {
      issues.push({
        severity: "error",
        code: "macro.bad-name",
        message: "Macro name must be non-empty and must not contain @, #, $, %, whitespace, parentheses, brackets, or braces.",
        path: "name"
      });
    }
    const macroBody = isRecord5(normalized) ? Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== "name")) : normalized;
    const packageExists = Object.prototype.hasOwnProperty.call(packages, packageId);
    const synthetic = {
      version: current ? "11" : "8",
      name: packageExists ? packages[packageId].name : packageId,
      description: packageExists ? packages[packageId].description : "",
      macros: name2 ? { [name2]: macroBody } : {}
    };
    issues.push(...lintPackage(synthetic, { checkKatex: options.checkKatex !== false }).issues);
    if (packageExists && !effectiveActivePackageIds(config, packages).has(packageId)) {
      issues.push({
        severity: "info",
        code: "macro.package-inactive",
        message: `Package ${JSON.stringify(packageId)} is not active; the Macro is stored but will not resolve until the Package is activated.`,
        path: "package"
      });
    }
    if (name2 && packageExists && Object.prototype.hasOwnProperty.call(packages[packageId].macros, name2)) {
      return {
        status: "conflict",
        entity: "macro",
        code: "macro.duplicate-name",
        message: `Macro ${JSON.stringify(name2)} already exists in Package ${JSON.stringify(packageId)}.`
      };
    }
    if (issues.some((issue) => issue.severity === "error")) {
      return { status: "invalid", entity: "macro", issues };
    }
    const macro = normalized;
    const relativePath = macroEntityPath(packageId, macro.name);
    const envelope = {
      format: "snl-macro",
      version: MACRO_STORAGE_VERSION,
      ...current ? { schema_version: CURRENT_MACRO_SCHEMA_VERSION } : {},
      package: packageId,
      macro
    };
    try {
      await installNewJson(snlDocRoot(workspaceRoot), relativePath, envelope);
    } catch (error) {
      if (error.code === "EEXIST") {
        return {
          status: "conflict",
          entity: "macro",
          code: "macro.duplicate-name",
          message: `Macro ${JSON.stringify(macro.name)} already exists in Package ${JSON.stringify(packageId)}.`
        };
      }
      throw error;
    }
    return {
      status: "created",
      entity: "macro",
      name: macro.name,
      package: packageId,
      path: relativePath,
      issues
    };
  });
}
async function addPackageEntity(workspaceRoot, raw, options = {}) {
  workspaceRoot = await canonicalWriteWorkspaceRoot(workspaceRoot);
  return withWorkspaceDataLock(workspaceRoot, "add Package manifest", async () => {
    const configFile = configPath(workspaceRoot);
    const originalConfig = await readRegularText(configFile);
    const config = JSON.parse(originalConfig.text);
    assertCurrentWriteConfig(config, "snl-add-package");
    const packages = await readAllMacroPackages(workspaceRoot);
    const issues = [];
    if (!isRecord5(raw)) {
      issues.push({ severity: "error", code: "package.not-object", message: "Package draft must be a JSON object." });
      return { status: "invalid", entity: "package", issues };
    }
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!id || id === UNPACKAGED_PACKAGE_ID) {
      issues.push({
        severity: "error",
        code: "package.bad-id",
        message: "Package id must be a non-empty user Package ID and cannot be _unpackaged.",
        path: "id"
      });
    } else {
      try {
        assertPackageId(id);
      } catch (error) {
        issues.push({
          severity: "error",
          code: "package.bad-id",
          message: error instanceof Error ? error.message : String(error),
          path: "id"
        });
      }
    }
    const name2 = raw.name === void 0 ? id : typeof raw.name === "string" ? raw.name.trim() : raw.name;
    const description = raw.description === void 0 ? "" : typeof raw.description === "string" ? raw.description.trim() : raw.description;
    if (typeof name2 !== "string" || !name2) {
      issues.push({ severity: "error", code: "package.bad-name", message: "Package name must be a non-empty string.", path: "name" });
    }
    if (typeof description !== "string") {
      issues.push({ severity: "error", code: "package.bad-description", message: "Package description must be a string.", path: "description" });
    }
    const collision = Object.keys(packages).find((existing) => existing.toLowerCase() === id.toLowerCase());
    if (collision) {
      return {
        status: "conflict",
        entity: "package",
        code: "package.duplicate-id",
        message: `Package id ${JSON.stringify(id)} conflicts with existing Package ${JSON.stringify(collision)}.`
      };
    }
    if (issues.some((issue) => issue.severity === "error")) {
      return { status: "invalid", entity: "package", issues };
    }
    const manifest = {
      ...raw,
      format: "snl-package",
      version: PACKAGE_STORAGE_VERSION,
      ...usesCurrentEntitySchemas(config) ? { schema_version: CURRENT_PACKAGE_SCHEMA_VERSION, entry_ids: [] } : {},
      id,
      name: name2,
      description
    };
    const relativePath = packageManifestPath(id);
    await installNewJson(snlDocRoot(workspaceRoot), relativePath, manifest);
    const configRecord = config;
    const currentActive = effectiveActivePackageIds(configRecord, packages);
    const nextConfig = {
      ...configRecord,
      active_macro_packages: [.../* @__PURE__ */ new Set([...currentActive, id])].sort((left, right) => left.localeCompare(right))
    };
    try {
      if (options.beforeConfigInstall) await options.beforeConfigInstall();
      await replaceJsonIfUnchanged(configFile, originalConfig.text, nextConfig);
    } catch (error) {
      const manifestFile = path5.join(snlDocRoot(workspaceRoot), relativePath);
      throw new Error(
        `${error instanceof Error ? error.message : String(error)} The new Package manifest remains at ${manifestFile}. Its effective activation follows the unchanged config and it may already be active when active_macro_packages is omitted. Guarded failure handling intentionally does not unlink a live path because a non-cooperating writer could replace it between verification and deletion.`,
        { cause: error }
      );
    }
    return { status: "created", entity: "package", id, path: relativePath, active: true };
  });
}

// lib/entity-crud.ts
var ENTITY_TYPES2 = ["entry-kind", "macro-kind", "entry-package", "macro-package", "entry", "macro", "relationship", "library"];
var isRecord6 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var sha = (value) => createHash2("sha256").update(JSON.stringify(value)).digest("hex");
var compare = (a3, b2) => a3.id.localeCompare(b2.id);
function docRoot(root) {
  return path6.join(path6.resolve(root), ".SNL_Doc");
}
async function assertWorkspace(root) {
  const config = await readConfig(root);
  if (!usesEntityStorage(config))
    throw new Error("snl-entity requires current workspace data 0.0.6 per-entity storage.");
}
async function canonicalWriteWorkspace(root) {
  const resolved = path6.resolve(root);
  const real = await fs4.realpath(resolved);
  const stat = await fs4.lstat(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || real !== resolved)
    throw new Error(`Workspace root ${resolved} must be a canonical, non-symlink directory.`);
  const doc = path6.join(resolved, ".SNL_Doc");
  const docStat = await fs4.lstat(doc);
  if (!docStat.isDirectory() || docStat.isSymbolicLink() || await fs4.realpath(doc) !== path6.join(real, ".SNL_Doc"))
    throw new Error(`${doc} must be a canonical, non-symlink directory.`);
  return resolved;
}
async function readJson2(file) {
  return JSON.parse(await fs4.readFile(file, "utf8"));
}
async function jsonFiles(directory) {
  return (await fs4.readdir(directory, { withFileTypes: true })).filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => path6.join(directory, e.name)).sort();
}
function managed(type, id, value) {
  return { type, id, revision: sha(value), value };
}
function requireRecord(value, label) {
  if (!isRecord6(value))
    throw new Error(`${label} must be a JSON object.`);
  return value;
}
function requireId(value, field = "id") {
  if (typeof value[field] !== "string" || !value[field])
    throw new Error(`${field} must be a non-empty string.`);
  return value[field];
}
async function packageRows(root, type) {
  const rows = [];
  const doc = docRoot(root);
  for (const file of await jsonFiles(path6.join(doc, "packages"))) {
    const manifest = requireRecord(await readJson2(file), "Package manifest");
    if (manifest.format !== "snl-package" || manifest.version !== 1)
      throw new Error(`${file} is not a Package v1 manifest.`);
    const id = requireId(manifest);
    if (path6.relative(doc, file) !== packageManifestPath(id))
      throw new Error(`${file} does not match Package identity ${id}.`);
    if (type === "entry-package")
      rows.push(managed(type, id, manifest));
    else {
      const macros2 = /* @__PURE__ */ Object.create(null);
      for (const macroFile of await jsonFiles(path6.join(doc, "macros"))) {
        const envelope = requireRecord(await readJson2(macroFile), "Macro envelope");
        if (envelope.package !== id)
          continue;
        const macro = requireRecord(envelope.macro, "Macro payload");
        const name2 = requireId(macro, "name");
        macros2[name2] = Object.fromEntries(Object.entries(macro).filter(([key]) => key !== "name"));
      }
      rows.push(managed(type, id, { ...manifest, macros: macros2 }));
    }
  }
  return rows.sort(compare);
}
async function entryRows(root) {
  const rows = [];
  const doc = docRoot(root);
  for (const file of await jsonFiles(path6.join(doc, "entries"))) {
    const env = requireRecord(await readJson2(file), "Entry envelope");
    const value = requireRecord(env.entry, "Entry payload");
    const id = requireId(value);
    const pkg = typeof env.package === "string" ? env.package : "";
    if (path6.relative(doc, file) !== entryEntityPath(pkg, id))
      throw new Error(`${file} does not match Entry identity ${id}.`);
    rows.push(managed("entry", id, value));
  }
  return rows.sort(compare);
}
async function macroRows(root) {
  const rows = [];
  const doc = docRoot(root);
  for (const file of await jsonFiles(path6.join(doc, "macros"))) {
    const env = requireRecord(await readJson2(file), "Macro envelope");
    const value = requireRecord(env.macro, "Macro payload");
    const name2 = requireId(value, "name");
    const pkg = typeof env.package === "string" ? env.package : "";
    if (path6.relative(doc, file) !== macroEntityPath(pkg, name2))
      throw new Error(`${file} does not match Macro identity ${name2}.`);
    rows.push(managed("macro", `${pkg}::${name2}`, { package: pkg, ...value }));
  }
  return rows.sort(compare);
}
async function relationshipRows(root) {
  const file = path6.join(docRoot(root), "relationships.json");
  try {
    const data = requireRecord(await readJson2(file), "Relationships file");
    if (!Array.isArray(data.relationships))
      throw new Error("relationships.json#relationships must be an array.");
    return data.relationships.map((v2) => {
      const value = requireRecord(v2, "Relationship");
      return managed("relationship", requireId(value), value);
    }).sort(compare);
  } catch (e) {
    if (e.code === "ENOENT")
      return [];
    throw e;
  }
}
async function libraryRows(root) {
  const base = path6.join(docRoot(root), "libraries");
  const rows = [];
  let entries;
  try {
    entries = await fs4.readdir(base, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT")
      return [];
    throw e;
  }
  for (const entry of entries.sort((a3, b2) => a3.name.localeCompare(b2.name))) {
    if (!entry.isDirectory())
      continue;
    const dir = path6.join(base, entry.name);
    const meta = requireRecord(await readJson2(path6.join(dir, "meta.json")), "Library meta");
    const graph = requireRecord(await readJson2(path6.join(dir, "graph.json")), "Library graph");
    let counters = { counters: [] };
    try {
      counters = requireRecord(await readJson2(path6.join(dir, "counters.json")), "Library counters");
    } catch (e) {
      if (e.code !== "ENOENT")
        throw e;
    }
    rows.push(managed("library", entry.name, { slug: entry.name, meta, graph, counters }));
  }
  return rows.sort(compare);
}
function isManagedEntityType(value) {
  return ENTITY_TYPES2.includes(value);
}
async function listManagedEntities(root, type) {
  await assertWorkspace(root);
  if (type === "entry-kind" || type === "macro-kind") {
    const config = await readConfig(root);
    const field = type === "entry-kind" ? "entry_kinds" : "macro_kinds";
    const values = config[field];
    if (!Array.isArray(values))
      throw new Error(`config.json#${field} must be an array.`);
    return values.map((v2) => {
      const value = requireRecord(v2, type);
      return managed(type, requireId(value), value);
    }).sort(compare);
  }
  if (type === "entry-package" || type === "macro-package")
    return packageRows(root, type);
  if (type === "entry")
    return entryRows(root);
  if (type === "macro")
    return macroRows(root);
  if (type === "relationship")
    return relationshipRows(root);
  return libraryRows(root);
}
async function getManagedEntity(root, type, id) {
  return (await listManagedEntities(root, type)).find((item) => item.id === id);
}
async function atomicWriteJson(file, value) {
  const directory = path6.dirname(file);
  const temp = path6.join(directory, `.${path6.basename(file)}.snl-entity-${process.pid}-${randomUUID3()}.tmp`);
  let handle;
  let mode = 420;
  try {
    mode = (await fs4.stat(file)).mode & 511;
  } catch (error) {
    if (error.code !== "ENOENT")
      throw error;
  }
  try {
    handle = await fs4.open(temp, constants4.O_CREAT | constants4.O_EXCL | constants4.O_WRONLY, mode);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}
`, "utf8");
    await handle.sync();
    await handle.close();
    handle = void 0;
    await fs4.rename(temp, file);
    const dir = await fs4.open(directory, constants4.O_RDONLY);
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  } finally {
    await handle?.close();
    await fs4.rm(temp, { force: true });
  }
}
function invalid(message) {
  return { status: "invalid", code: "entity.invalid", message };
}
function conflict(message) {
  return { status: "conflict", code: "entity.revision-conflict", message };
}
async function mutateConfigEntity(root, type, operation, id, input, ifMatch) {
  return withWorkspaceDataLock(root, `${operation} ${type}`, async () => {
    const file = path6.join(docRoot(root), "config.json");
    const config = requireRecord(await readJson2(file), "config.json");
    if (!usesEntityStorage(config))
      throw new Error("snl-entity requires current workspace data 0.0.6 per-entity storage.");
    const field = type === "entry-kind" ? "entry_kinds" : "macro_kinds";
    const values = config[field];
    if (!Array.isArray(values))
      throw new Error(`config.json#${field} must be an array.`);
    const index = values.findIndex((v2) => isRecord6(v2) && v2.id === id);
    if (operation === "create") {
      const value2 = requireRecord(input, type);
      const problem2 = await validationMessage(root, type, value2);
      if (problem2)
        return invalid(problem2);
      const newId = requireId(value2);
      if (values.some((v2) => isRecord6(v2) && v2.id === newId))
        return { status: "conflict", code: "entity.already-exists", message: `${type} ${JSON.stringify(newId)} already exists.` };
      const next = { ...config, [field]: [...values, value2] };
      await atomicWriteJson(file, next);
      return { status: "ok", operation, type, entity: managed(type, newId, value2) };
    }
    if (index < 0)
      return { status: "not-found", code: "entity.not-found", message: `${type} ${JSON.stringify(id)} was not found.` };
    const current = requireRecord(values[index], type);
    const currentEntity = managed(type, id, current);
    if (!ifMatch || ifMatch !== currentEntity.revision)
      return conflict(`${type} ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
    if (operation === "delete") {
      const nextValues2 = values.filter((_2, i4) => i4 !== index);
      await atomicWriteJson(file, { ...config, [field]: nextValues2 });
      return { status: "ok", operation, type, entity: currentEntity };
    }
    const value = requireRecord(input, type);
    const problem = await validationMessage(root, type, value, id);
    if (problem)
      return invalid(problem);
    if (requireId(value) !== id)
      return invalid(`${type} identity is immutable: payload id must equal ${JSON.stringify(id)}.`);
    const nextValues = [...values];
    nextValues[index] = value;
    await atomicWriteJson(file, { ...config, [field]: nextValues });
    return { status: "ok", operation, type, entity: managed(type, id, value) };
  });
}
async function validationMessage(root, type, value, currentId) {
  const stringField = (field) => typeof value[field] === "string" && value[field] !== "";
  if (type === "entry-kind") {
    if (!stringField("id") || !stringField("name") || !isRecord6(value.coloring) || typeof value.style !== "string")
      return "Entry Kind requires non-empty id/name, coloring object, and string style.";
  } else if (type === "macro-kind") {
    if (!stringField("id") || !stringField("name") || typeof value.description !== "string" || !isRecord6(value.coloring))
      return "Macro Kind requires non-empty id/name, string description, and coloring object.";
  } else if (type === "entry-package" || type === "macro-package") {
    if (!stringField("id") || !stringField("name") || typeof value.description !== "string")
      return "Package requires non-empty id/name and string description.";
  } else if (type === "entry") {
    const issues = lintEntry(value, { entryKinds: await readEntryKinds(root), macros: await readActiveMacros(root), siblingEntries: (await readEntries(root)).filter((entry) => entry.id !== currentId) }).issues.filter((issue) => issue.severity === "error");
    if (issues.length)
      return issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ");
    const packages = await packageRows(root, "entry-package");
    if (!packages.some((pkg) => pkg.id === value.package))
      return `Entry Package ${JSON.stringify(value.package)} does not exist.`;
  } else if (type === "macro") {
    const pkg = typeof value.package === "string" ? value.package : "";
    const name2 = typeof value.name === "string" ? value.name : "";
    const body = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "package" && key !== "name"));
    const report = lintPackage({ version: "8", name: pkg, description: "", macros: name2 ? { [name2]: body } : {} }, { checkKatex: false });
    const errors = report.issues.filter((issue) => issue.severity === "error");
    if (!pkg || !name2 || errors.length)
      return !pkg || !name2 ? "Macro requires non-empty package and name." : errors.map((issue) => `${issue.code}: ${issue.message}`).join("; ");
    if (!(await packageRows(root, "entry-package")).some((row) => row.id === pkg))
      return `Macro Package ${JSON.stringify(pkg)} does not exist.`;
  } else if (type === "relationship") {
    if (!stringField("id") || !stringField("from") || !stringField("to") || !stringField("label"))
      return "Relationship requires non-empty id/from/to/label strings.";
  } else if (type === "library") {
    if (!stringField("slug") || !isRecord6(value.meta) || !isRecord6(value.graph) || !Array.isArray(value.graph.nodes) || !Array.isArray(value.graph.relationships) || !isRecord6(value.counters) || !Array.isArray(value.counters.counters))
      return "Library requires slug, meta, graph nodes/relationships, and counters.";
  }
  return void 0;
}
function identityFor(type, value) {
  if (type === "macro") {
    const pkg = typeof value.package === "string" ? value.package : "";
    return `${pkg}::${requireId(value, "name")}`;
  }
  if (type === "library")
    return requireId(value, "slug");
  return requireId(value);
}
async function createDirect(root, type, input) {
  const value = requireRecord(input, type);
  const problem = await validationMessage(root, type, value);
  if (problem)
    return invalid(problem);
  const id = identityFor(type, value);
  return withWorkspaceDataLock(root, `create ${type}`, async () => {
    if (await getManagedEntity(root, type, id))
      return { status: "conflict", code: "entity.already-exists", message: `${type} ${JSON.stringify(id)} already exists.` };
    if (type === "relationship") {
      const file = path6.join(docRoot(root), "relationships.json");
      let data = { version: 1, relationships: [] };
      try {
        data = requireRecord(await readJson2(file), "relationships.json");
      } catch (e) {
        if (e.code !== "ENOENT")
          throw e;
      }
      if (!Array.isArray(data.relationships))
        throw new Error("relationships.json#relationships must be an array.");
      await atomicWriteJson(file, { ...data, relationships: [...data.relationships, value] });
    } else {
      const dir = path6.join(docRoot(root), "libraries", id);
      if (path6.basename(id) !== id || id === "." || id === "..")
        return invalid("Library slug must be one safe path segment.");
      await fs4.mkdir(dir, { recursive: false });
      try {
        await atomicWriteJson(path6.join(dir, "meta.json"), requireRecord(value.meta, "Library meta"));
        await atomicWriteJson(path6.join(dir, "graph.json"), requireRecord(value.graph, "Library graph"));
        await atomicWriteJson(path6.join(dir, "counters.json"), requireRecord(value.counters, "Library counters"));
      } catch (e) {
        await fs4.rm(dir, { recursive: true, force: true });
        throw e;
      }
    }
    const entity = await getManagedEntity(root, type, id);
    if (!entity)
      throw new Error(`Created ${type} could not be read back.`);
    return { status: "ok", operation: "create", type, entity };
  });
}
async function createManagedEntity(root, type, input) {
  root = await canonicalWriteWorkspace(root);
  await assertWorkspace(root);
  if (type === "entry-kind" || type === "macro-kind")
    return mutateConfigEntity(root, type, "create", void 0, input);
  if (type === "entry-package" || type === "macro-package") {
    const result = await addPackageEntity(root, input);
    if (result.status !== "created")
      return result.status === "conflict" ? { status: "conflict", code: result.code, message: result.message } : invalid(result.issues.map((i4) => `${i4.code}: ${i4.message}`).join("; "));
    const entity = await getManagedEntity(root, type, result.id);
    if (!entity)
      throw new Error("Created Package could not be read back.");
    return { status: "ok", operation: "create", type, entity };
  }
  if (type === "entry") {
    const result = await addEntryEntity(root, input);
    if (result.status !== "created")
      return result.status === "conflict" ? { status: "conflict", code: result.code, message: result.message } : invalid(result.issues.map((i4) => `${i4.code}: ${i4.message}`).join("; "));
    const entity = await getManagedEntity(root, type, result.id);
    if (!entity)
      throw new Error("Created Entry could not be read back.");
    return { status: "ok", operation: "create", type, entity };
  }
  if (type === "macro") {
    const value = requireRecord(input, "Macro");
    const pkg = typeof value.package === "string" ? value.package : "";
    const draft = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "package"));
    const result = await addMacroEntity(root, pkg, draft);
    if (result.status !== "created")
      return result.status === "conflict" ? { status: "conflict", code: result.code, message: result.message } : invalid(result.issues.map((i4) => `${i4.code}: ${i4.message}`).join("; "));
    const id = `${pkg}::${result.name}`;
    const entity = await getManagedEntity(root, type, id);
    if (!entity)
      throw new Error("Created Macro could not be read back.");
    return { status: "ok", operation: "create", type, entity };
  }
  return createDirect(root, type, input);
}
async function locateFile(root, type, entity) {
  const doc = docRoot(root);
  if (type === "entry-package" || type === "macro-package")
    return path6.join(doc, packageManifestPath(entity.id));
  if (type === "entry") {
    const pkg = typeof entity.value.package === "string" ? entity.value.package : "";
    return path6.join(doc, entryEntityPath(pkg, entity.id));
  }
  if (type === "macro") {
    const split = entity.id.indexOf("::");
    return path6.join(doc, macroEntityPath(entity.id.slice(0, split), entity.id.slice(split + 2)));
  }
  throw new Error(`No entity file for ${type}.`);
}
async function mutateDirect(root, type, operation, id, input, ifMatch) {
  return withWorkspaceDataLock(root, `${operation} ${type}`, async () => {
    const current = await getManagedEntity(root, type, id);
    if (!current)
      return { status: "not-found", code: "entity.not-found", message: `${type} ${JSON.stringify(id)} was not found.` };
    if (current.revision !== ifMatch)
      return conflict(`${type} ${JSON.stringify(id)} changed; fetch it again and retry with its current revision.`);
    if (operation === "update") {
      const value = requireRecord(input, type);
      const problem = await validationMessage(root, type, value, id);
      if (problem)
        return invalid(problem);
      if (identityFor(type, value) !== id)
        return invalid(`${type} identity is immutable: payload identity must equal ${JSON.stringify(id)}.`);
      if (type === "relationship") {
        const file = path6.join(docRoot(root), "relationships.json");
        const data = requireRecord(await readJson2(file), "relationships.json");
        const values = data.relationships;
        if (!Array.isArray(values))
          throw new Error("relationships.json#relationships must be an array.");
        await atomicWriteJson(file, { ...data, relationships: values.map((row) => isRecord6(row) && row.id === id ? value : row) });
      } else if (type === "library") {
        const dir = path6.join(docRoot(root), "libraries", id);
        await atomicWriteJson(path6.join(dir, "meta.json"), requireRecord(value.meta, "Library meta"));
        await atomicWriteJson(path6.join(dir, "graph.json"), requireRecord(value.graph, "Library graph"));
        await atomicWriteJson(path6.join(dir, "counters.json"), requireRecord(value.counters, "Library counters"));
      } else {
        const file = await locateFile(root, type, current);
        if (type === "entry-package" || type === "macro-package") {
          const manifest = { ...value, format: "snl-package", version: 1 };
          delete manifest.macros;
          await atomicWriteJson(file, manifest);
        } else if (type === "entry") {
          await atomicWriteJson(file, { format: "snl-entry", version: 1, package: value.package, entry: value });
        } else {
          const split = id.indexOf("::");
          const pkg = id.slice(0, split);
          const macro = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "package"));
          await atomicWriteJson(file, { format: "snl-macro", version: 1, package: pkg, macro });
        }
      }
      const entity = await getManagedEntity(root, type, id);
      if (!entity)
        throw new Error(`Updated ${type} could not be read back.`);
      return { status: "ok", operation, type, entity };
    }
    if (type === "entry") {
      const references = (await findEntityReferences(root, "entry", id)).filter((occurrence2) => occurrence2.role === "reference");
      if (references.length)
        return { status: "conflict", code: "entity.referenced", message: `Entry ${JSON.stringify(id)} still has ${references.length} structured reference(s).` };
      await fs4.unlink(await locateFile(root, type, current));
    } else if (type === "macro") {
      const name2 = id.slice(id.indexOf("::") + 2);
      const references = (await findEntityReferences(root, "macro", name2)).filter((occurrence2) => occurrence2.role === "reference");
      if (references.length)
        return { status: "conflict", code: "entity.referenced", message: `Macro ${JSON.stringify(id)} still has ${references.length} structured reference(s).` };
      await fs4.unlink(await locateFile(root, type, current));
    } else if (type === "relationship") {
      const file = path6.join(docRoot(root), "relationships.json");
      const data = requireRecord(await readJson2(file), "relationships.json");
      const values = data.relationships;
      if (!Array.isArray(values))
        throw new Error("relationships.json#relationships must be an array.");
      await atomicWriteJson(file, { ...data, relationships: values.filter((row) => !(isRecord6(row) && row.id === id)) });
    } else if (type === "library") {
      const dir = path6.join(docRoot(root), "libraries", id);
      const tomb = path6.join(path6.dirname(dir), `.${id}.snl-entity-${randomUUID3()}.deleted`);
      await fs4.rename(dir, tomb);
      await fs4.rm(tomb, { recursive: true });
    } else if (type === "entry-package" || type === "macro-package") {
      if (id === "_unpackaged")
        return invalid("The system _unpackaged Package cannot be deleted.");
      const entries = await entryRows(root);
      const macros2 = await macroRows(root);
      if (entries.some((e) => e.value.package === id) || macros2.some((m3) => m3.value.package === id))
        return { status: "conflict", code: "package.not-empty", message: `Package ${JSON.stringify(id)} still contains entities.` };
      const file = await locateFile(root, type, current);
      await fs4.unlink(file);
      const configFile = path6.join(docRoot(root), "config.json");
      const config = requireRecord(await readJson2(configFile), "config.json");
      if (Array.isArray(config.active_macro_packages))
        await atomicWriteJson(configFile, { ...config, active_macro_packages: config.active_macro_packages.filter((v2) => v2 !== id) });
    } else
      await fs4.unlink(await locateFile(root, type, current));
    return { status: "ok", operation, type, entity: current };
  });
}
async function updateManagedEntity(root, type, id, input, ifMatch) {
  root = await canonicalWriteWorkspace(root);
  await assertWorkspace(root);
  if (type === "entry-kind" || type === "macro-kind")
    return mutateConfigEntity(root, type, "update", id, input, ifMatch);
  return mutateDirect(root, type, "update", id, input, ifMatch);
}
async function deleteManagedEntity(root, type, id, ifMatch) {
  root = await canonicalWriteWorkspace(root);
  await assertWorkspace(root);
  if (type === "entry-kind" || type === "macro-kind")
    return mutateConfigEntity(root, type, "delete", id, void 0, ifMatch);
  return mutateDirect(root, type, "delete", id, void 0, ifMatch);
}

// plugin-src/entity-adapter.ts
function typeOf(value) {
  if (!isManagedEntityType(value)) throw new TypeError(`Unsupported SNL entity type: ${value}`);
  return value;
}
function queryText(value) {
  return JSON.stringify(value).toLocaleLowerCase();
}
function createEntityAdapter() {
  return {
    async list(request) {
      const type = typeOf(request.entityType);
      let entities = await listManagedEntities(request.root, type);
      if (request.query) {
        const needle = request.query.toLocaleLowerCase();
        entities = entities.filter((entity) => entity.id.toLocaleLowerCase().includes(needle) || queryText(entity.value).includes(needle));
      }
      if (request.cursor) entities = entities.filter((entity) => entity.id.localeCompare(request.cursor) > 0);
      const limit = request.limit ?? 100;
      const page = entities.slice(0, limit);
      return {
        entities: page,
        nextCursor: entities.length > page.length ? page.at(-1)?.id ?? null : null
      };
    },
    async get(request) {
      const entity = await getManagedEntity(request.root, typeOf(request.entityType), request.id);
      if (!entity) return { status: "not-found", code: "entity.not-found", message: `${request.entityType} ${JSON.stringify(request.id)} does not exist.` };
      return { entity, revision: entity.revision };
    },
    async apply(request) {
      const type = typeOf(request.entityType);
      if (request.action === "create") {
        if (!request.value) return { status: "invalid", code: "entity.value-required", message: "create requires value." };
        return createManagedEntity(request.root, type, request.value);
      }
      if (!request.id) return { status: "invalid", code: "entity.id-required", message: `${request.action} requires id.` };
      if (!request.expectedRevision) {
        return { status: "invalid", code: "entity.revision-required", message: `${request.action} requires expectedRevision from snl_entity_get.` };
      }
      return request.action === "update" ? updateManagedEntity(request.root, type, request.id, request.value, request.expectedRevision) : deleteManagedEntity(request.root, type, request.id, request.expectedRevision);
    },
    async validate({ root }) {
      const counts = /* @__PURE__ */ Object.create(null);
      for (const type of ENTITY_TYPES2) counts[type] = (await listManagedEntities(root, type)).length;
      return { valid: true, counts, issues: [] };
    }
  };
}

// plugin-src/mcp-server.ts
async function loadEntityAdapter(specifier = process.env.SNL_ENTITY_ADAPTER_MODULE) {
  if (!specifier) return createEntityAdapter();
  const url = specifier.startsWith("file:") || specifier.startsWith("data:") || specifier.startsWith("node:") ? specifier : pathToFileURL(resolve5(specifier)).href;
  const loaded = await import(url);
  const candidate = loaded.createEntityAdapter ? await loaded.createEntityAdapter() : typeof loaded.default === "function" ? await loaded.default() : loaded.default;
  if (!candidate || !["list", "get", "apply", "validate"].every((name2) => typeof candidate[name2] === "function")) {
    throw new Error("SNL entity adapter module must export createEntityAdapter() or a default adapter with list/get/apply/validate methods");
  }
  return candidate;
}

// plugin-src/dsh-adapter.ts
var name = "snl-agent-toolkit";
var inject = ["tools"];
function isRecord7(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function toDshValueSchema(raw) {
  if (!isRecord7(raw)) throw new TypeError("tool schema property must be an object");
  const description = typeof raw.description === "string" ? { description: raw.description } : {};
  const enumeration = Array.isArray(raw.enum) ? { enum: raw.enum } : {};
  switch (raw.type) {
    case "string":
      return { type: "string", ...description, ...enumeration };
    case "integer":
      return { type: "integer", ...description };
    case "number":
      return { type: "number", ...description };
    case "boolean":
      return { type: "boolean", ...description };
    case "array":
      return {
        type: "array",
        ...description,
        ...raw.items !== void 0 ? { items: toDshValueSchema(raw.items) } : {}
      };
    case "object":
      return { type: "object", additionalProperties: true, ...description };
    default:
      throw new TypeError(`unsupported DeepSeek Harness tool schema type: ${String(raw.type)}`);
  }
}
function toDshParameters(inputSchema) {
  if (inputSchema.type !== "object" || !isRecord7(inputSchema.properties)) {
    throw new TypeError("tool input schema must be an object schema with properties");
  }
  const required = new Set(Array.isArray(inputSchema.required) ? inputSchema.required : []);
  return Object.fromEntries(
    Object.entries(inputSchema.properties).map(([key, schema]) => {
      const property2 = {
        ...toDshValueSchema(schema),
        ...required.has(key) ? { required: true } : {}
      };
      return [key, property2];
    })
  );
}
async function apply(ctx, config = {}) {
  const adapter = config.adapter ?? await loadEntityAdapter(config.adapterModule);
  for (const tool of createToolkitTools(adapter)) {
    ctx.tools.register(defineTool({
      name: tool.name,
      description: tool.description,
      parameters: toDshParameters(tool.inputSchema),
      output: {
        schema: { type: "json" },
        render(_args, value) {
          return [{ type: "text", text: JSON.stringify(value, null, 2) }];
        }
      },
      async execute(args, exec) {
        exec.signal.throwIfAborted();
        const value = await tool.execute(args);
        exec.signal.throwIfAborted();
        return value;
      }
    }));
  }
}
export {
  apply,
  inject,
  name
};
