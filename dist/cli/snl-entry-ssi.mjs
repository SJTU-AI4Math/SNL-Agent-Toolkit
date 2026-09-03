#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e2) {
    throw mod = 0, e2;
  }
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

// node_modules/react/cjs/react.production.js
var require_react_production = __commonJS({
  "node_modules/react/cjs/react.production.js"(exports) {
    "use strict";
    var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element");
    var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
    var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
    var REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode");
    var REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler");
    var REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer");
    var REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context");
    var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
    var REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense");
    var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
    var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
    var REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity");
    var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
    function getIteratorFn(maybeIterable) {
      if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
      maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
      return "function" === typeof maybeIterable ? maybeIterable : null;
    }
    var ReactNoopUpdateQueue = {
      isMounted: function() {
        return false;
      },
      enqueueForceUpdate: function() {
      },
      enqueueReplaceState: function() {
      },
      enqueueSetState: function() {
      }
    };
    var assign = Object.assign;
    var emptyObject = {};
    function Component(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    Component.prototype.isReactComponent = {};
    Component.prototype.setState = function(partialState, callback) {
      if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
        throw Error(
          "takes an object of state variables to update or a function which returns an object of state variables."
        );
      this.updater.enqueueSetState(this, partialState, callback, "setState");
    };
    Component.prototype.forceUpdate = function(callback) {
      this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
    };
    function ComponentDummy() {
    }
    ComponentDummy.prototype = Component.prototype;
    function PureComponent(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
    pureComponentPrototype.constructor = PureComponent;
    assign(pureComponentPrototype, Component.prototype);
    pureComponentPrototype.isPureReactComponent = true;
    var isArrayImpl = Array.isArray;
    function noop() {
    }
    var ReactSharedInternals = { H: null, A: null, T: null, S: null };
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function ReactElement(type, key, props) {
      var refProp = props.ref;
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        ref: void 0 !== refProp ? refProp : null,
        props
      };
    }
    function cloneAndReplaceKey(oldElement, newKey) {
      return ReactElement(oldElement.type, newKey, oldElement.props);
    }
    function isValidElement(object) {
      return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    function escape(key) {
      var escaperLookup = { "=": "=0", ":": "=2" };
      return "$" + key.replace(/[=:]/g, function(match) {
        return escaperLookup[match];
      });
    }
    var userProvidedKeyEscapeRegex = /\/+/g;
    function getElementKey(element, index) {
      return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index.toString(36);
    }
    function resolveThenable(thenable) {
      switch (thenable.status) {
        case "fulfilled":
          return thenable.value;
        case "rejected":
          throw thenable.reason;
        default:
          switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
            function(fulfilledValue) {
              "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
            },
            function(error) {
              "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
            }
          )), thenable.status) {
            case "fulfilled":
              return thenable.value;
            case "rejected":
              throw thenable.reason;
          }
      }
      throw thenable;
    }
    function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
      var type = typeof children;
      if ("undefined" === type || "boolean" === type) children = null;
      var invokeCallback = false;
      if (null === children) invokeCallback = true;
      else
        switch (type) {
          case "bigint":
          case "string":
          case "number":
            invokeCallback = true;
            break;
          case "object":
            switch (children.$$typeof) {
              case REACT_ELEMENT_TYPE:
              case REACT_PORTAL_TYPE:
                invokeCallback = true;
                break;
              case REACT_LAZY_TYPE:
                return invokeCallback = children._init, mapIntoArray(
                  invokeCallback(children._payload),
                  array,
                  escapedPrefix,
                  nameSoFar,
                  callback
                );
            }
        }
      if (invokeCallback)
        return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c3) {
          return c3;
        })) : null != callback && (isValidElement(callback) && (callback = cloneAndReplaceKey(
          callback,
          escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(
            userProvidedKeyEscapeRegex,
            "$&/"
          ) + "/") + invokeCallback
        )), array.push(callback)), 1;
      invokeCallback = 0;
      var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
      if (isArrayImpl(children))
        for (var i4 = 0; i4 < children.length; i4++)
          nameSoFar = children[i4], type = nextNamePrefix + getElementKey(nameSoFar, i4), invokeCallback += mapIntoArray(
            nameSoFar,
            array,
            escapedPrefix,
            type,
            callback
          );
      else if (i4 = getIteratorFn(children), "function" === typeof i4)
        for (children = i4.call(children), i4 = 0; !(nameSoFar = children.next()).done; )
          nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i4++), invokeCallback += mapIntoArray(
            nameSoFar,
            array,
            escapedPrefix,
            type,
            callback
          );
      else if ("object" === type) {
        if ("function" === typeof children.then)
          return mapIntoArray(
            resolveThenable(children),
            array,
            escapedPrefix,
            nameSoFar,
            callback
          );
        array = String(children);
        throw Error(
          "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
        );
      }
      return invokeCallback;
    }
    function mapChildren(children, func, context) {
      if (null == children) return children;
      var result = [], count = 0;
      mapIntoArray(children, result, "", "", function(child) {
        return func.call(context, child, count++);
      });
      return result;
    }
    function lazyInitializer(payload) {
      if (-1 === payload._status) {
        var ctor = payload._result;
        ctor = ctor();
        ctor.then(
          function(moduleObject) {
            if (0 === payload._status || -1 === payload._status)
              payload._status = 1, payload._result = moduleObject;
          },
          function(error) {
            if (0 === payload._status || -1 === payload._status)
              payload._status = 2, payload._result = error;
          }
        );
        -1 === payload._status && (payload._status = 0, payload._result = ctor);
      }
      if (1 === payload._status) return payload._result.default;
      throw payload._result;
    }
    var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
      if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
        var event = new window.ErrorEvent("error", {
          bubbles: true,
          cancelable: true,
          message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
          error
        });
        if (!window.dispatchEvent(event)) return;
      } else if ("object" === typeof process && "function" === typeof process.emit) {
        process.emit("uncaughtException", error);
        return;
      }
      console.error(error);
    };
    var Children = {
      map: mapChildren,
      forEach: function(children, forEachFunc, forEachContext) {
        mapChildren(
          children,
          function() {
            forEachFunc.apply(this, arguments);
          },
          forEachContext
        );
      },
      count: function(children) {
        var n4 = 0;
        mapChildren(children, function() {
          n4++;
        });
        return n4;
      },
      toArray: function(children) {
        return mapChildren(children, function(child) {
          return child;
        }) || [];
      },
      only: function(children) {
        if (!isValidElement(children))
          throw Error(
            "React.Children.only expected to receive a single React element child."
          );
        return children;
      }
    };
    exports.Activity = REACT_ACTIVITY_TYPE;
    exports.Children = Children;
    exports.Component = Component;
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.Profiler = REACT_PROFILER_TYPE;
    exports.PureComponent = PureComponent;
    exports.StrictMode = REACT_STRICT_MODE_TYPE;
    exports.Suspense = REACT_SUSPENSE_TYPE;
    exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
    exports.__COMPILER_RUNTIME = {
      __proto__: null,
      c: function(size) {
        return ReactSharedInternals.H.useMemoCache(size);
      }
    };
    exports.cache = function(fn) {
      return function() {
        return fn.apply(null, arguments);
      };
    };
    exports.cacheSignal = function() {
      return null;
    };
    exports.cloneElement = function(element, config, children) {
      if (null === element || void 0 === element)
        throw Error(
          "The argument must be a React element, but you passed " + element + "."
        );
      var props = assign({}, element.props), key = element.key;
      if (null != config)
        for (propName in void 0 !== config.key && (key = "" + config.key), config)
          !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
      var propName = arguments.length - 2;
      if (1 === propName) props.children = children;
      else if (1 < propName) {
        for (var childArray = Array(propName), i4 = 0; i4 < propName; i4++)
          childArray[i4] = arguments[i4 + 2];
        props.children = childArray;
      }
      return ReactElement(element.type, key, props);
    };
    exports.createContext = function(defaultValue) {
      defaultValue = {
        $$typeof: REACT_CONTEXT_TYPE,
        _currentValue: defaultValue,
        _currentValue2: defaultValue,
        _threadCount: 0,
        Provider: null,
        Consumer: null
      };
      defaultValue.Provider = defaultValue;
      defaultValue.Consumer = {
        $$typeof: REACT_CONSUMER_TYPE,
        _context: defaultValue
      };
      return defaultValue;
    };
    exports.createElement = function(type, config, children) {
      var propName, props = {}, key = null;
      if (null != config)
        for (propName in void 0 !== config.key && (key = "" + config.key), config)
          hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
      var childrenLength = arguments.length - 2;
      if (1 === childrenLength) props.children = children;
      else if (1 < childrenLength) {
        for (var childArray = Array(childrenLength), i4 = 0; i4 < childrenLength; i4++)
          childArray[i4] = arguments[i4 + 2];
        props.children = childArray;
      }
      if (type && type.defaultProps)
        for (propName in childrenLength = type.defaultProps, childrenLength)
          void 0 === props[propName] && (props[propName] = childrenLength[propName]);
      return ReactElement(type, key, props);
    };
    exports.createRef = function() {
      return { current: null };
    };
    exports.forwardRef = function(render) {
      return { $$typeof: REACT_FORWARD_REF_TYPE, render };
    };
    exports.isValidElement = isValidElement;
    exports.lazy = function(ctor) {
      return {
        $$typeof: REACT_LAZY_TYPE,
        _payload: { _status: -1, _result: ctor },
        _init: lazyInitializer
      };
    };
    exports.memo = function(type, compare) {
      return {
        $$typeof: REACT_MEMO_TYPE,
        type,
        compare: void 0 === compare ? null : compare
      };
    };
    exports.startTransition = function(scope) {
      var prevTransition = ReactSharedInternals.T, currentTransition = {};
      ReactSharedInternals.T = currentTransition;
      try {
        var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
        null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
        "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
      } catch (error) {
        reportGlobalError(error);
      } finally {
        null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
      }
    };
    exports.unstable_useCacheRefresh = function() {
      return ReactSharedInternals.H.useCacheRefresh();
    };
    exports.use = function(usable) {
      return ReactSharedInternals.H.use(usable);
    };
    exports.useActionState = function(action, initialState, permalink) {
      return ReactSharedInternals.H.useActionState(action, initialState, permalink);
    };
    exports.useCallback = function(callback, deps) {
      return ReactSharedInternals.H.useCallback(callback, deps);
    };
    exports.useContext = function(Context) {
      return ReactSharedInternals.H.useContext(Context);
    };
    exports.useDebugValue = function() {
    };
    exports.useDeferredValue = function(value, initialValue) {
      return ReactSharedInternals.H.useDeferredValue(value, initialValue);
    };
    exports.useEffect = function(create, deps) {
      return ReactSharedInternals.H.useEffect(create, deps);
    };
    exports.useEffectEvent = function(callback) {
      return ReactSharedInternals.H.useEffectEvent(callback);
    };
    exports.useId = function() {
      return ReactSharedInternals.H.useId();
    };
    exports.useImperativeHandle = function(ref, create, deps) {
      return ReactSharedInternals.H.useImperativeHandle(ref, create, deps);
    };
    exports.useInsertionEffect = function(create, deps) {
      return ReactSharedInternals.H.useInsertionEffect(create, deps);
    };
    exports.useLayoutEffect = function(create, deps) {
      return ReactSharedInternals.H.useLayoutEffect(create, deps);
    };
    exports.useMemo = function(create, deps) {
      return ReactSharedInternals.H.useMemo(create, deps);
    };
    exports.useOptimistic = function(passthrough, reducer) {
      return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
    };
    exports.useReducer = function(reducer, initialArg, init) {
      return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
    };
    exports.useRef = function(initialValue) {
      return ReactSharedInternals.H.useRef(initialValue);
    };
    exports.useState = function(initialState) {
      return ReactSharedInternals.H.useState(initialState);
    };
    exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
      return ReactSharedInternals.H.useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
      );
    };
    exports.useTransition = function() {
      return ReactSharedInternals.H.useTransition();
    };
    exports.version = "19.2.8";
  }
});

// node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "node_modules/react/cjs/react.development.js"(exports, module) {
    "use strict";
    "production" !== process.env.NODE_ENV && (function() {
      function defineDeprecationWarning(methodName, info) {
        Object.defineProperty(Component.prototype, methodName, {
          get: function() {
            console.warn(
              "%s(...) is deprecated in plain JavaScript React classes. %s",
              info[0],
              info[1]
            );
          }
        });
      }
      function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable)
          return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
      }
      function warnNoop(publicInstance, callerName) {
        publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
        var warningKey = publicInstance + "." + callerName;
        didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error(
          "Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.",
          callerName,
          publicInstance
        ), didWarnStateUpdateForUnmountedComponent[warningKey] = true);
      }
      function Component(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      function ComponentDummy() {
      }
      function PureComponent(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      function noop() {
      }
      function testStringCoercion(value) {
        return "" + value;
      }
      function checkKeyStringCoercion(value) {
        try {
          testStringCoercion(value);
          var JSCompiler_inline_result = false;
        } catch (e2) {
          JSCompiler_inline_result = true;
        }
        if (JSCompiler_inline_result) {
          JSCompiler_inline_result = console;
          var JSCompiler_temp_const = JSCompiler_inline_result.error;
          var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
          JSCompiler_temp_const.call(
            JSCompiler_inline_result,
            "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
            JSCompiler_inline_result$jscomp$0
          );
          return testStringCoercion(value);
        }
      }
      function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type)
          return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
          case REACT_ACTIVITY_TYPE:
            return "Activity";
        }
        if ("object" === typeof type)
          switch ("number" === typeof type.tag && console.error(
            "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
          ), type.$$typeof) {
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_CONTEXT_TYPE:
              return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
              return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
              var innerType = type.render;
              type = type.displayName;
              type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
              return type;
            case REACT_MEMO_TYPE:
              return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
              innerType = type._payload;
              type = type._init;
              try {
                return getComponentNameFromType(type(innerType));
              } catch (x2) {
              }
          }
        return null;
      }
      function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
          return "<...>";
        try {
          var name = getComponentNameFromType(type);
          return name ? "<" + name + ">" : "<...>";
        } catch (x2) {
          return "<...>";
        }
      }
      function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
      }
      function UnknownOwner() {
        return Error("react-stack-top-frame");
      }
      function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
          var getter = Object.getOwnPropertyDescriptor(config, "key").get;
          if (getter && getter.isReactWarning) return false;
        }
        return void 0 !== config.key;
      }
      function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
          specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
            "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
            displayName
          ));
        }
        warnAboutAccessingKey.isReactWarning = true;
        Object.defineProperty(props, "key", {
          get: warnAboutAccessingKey,
          configurable: true
        });
      }
      function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
          "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
        ));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
      }
      function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          props,
          _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
          enumerable: false,
          get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: null
        });
        Object.defineProperty(type, "_debugStack", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
      }
      function cloneAndReplaceKey(oldElement, newKey) {
        newKey = ReactElement(
          oldElement.type,
          newKey,
          oldElement.props,
          oldElement._owner,
          oldElement._debugStack,
          oldElement._debugTask
        );
        oldElement._store && (newKey._store.validated = oldElement._store.validated);
        return newKey;
      }
      function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
      }
      function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
      }
      function escape(key) {
        var escaperLookup = { "=": "=0", ":": "=2" };
        return "$" + key.replace(/[=:]/g, function(match) {
          return escaperLookup[match];
        });
      }
      function getElementKey(element, index) {
        return "object" === typeof element && null !== element && null != element.key ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index.toString(36);
      }
      function resolveThenable(thenable) {
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
          default:
            switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
              function(fulfilledValue) {
                "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
              },
              function(error) {
                "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            )), thenable.status) {
              case "fulfilled":
                return thenable.value;
              case "rejected":
                throw thenable.reason;
            }
        }
        throw thenable;
      }
      function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
        var type = typeof children;
        if ("undefined" === type || "boolean" === type) children = null;
        var invokeCallback = false;
        if (null === children) invokeCallback = true;
        else
          switch (type) {
            case "bigint":
            case "string":
            case "number":
              invokeCallback = true;
              break;
            case "object":
              switch (children.$$typeof) {
                case REACT_ELEMENT_TYPE:
                case REACT_PORTAL_TYPE:
                  invokeCallback = true;
                  break;
                case REACT_LAZY_TYPE:
                  return invokeCallback = children._init, mapIntoArray(
                    invokeCallback(children._payload),
                    array,
                    escapedPrefix,
                    nameSoFar,
                    callback
                  );
              }
          }
        if (invokeCallback) {
          invokeCallback = children;
          callback = callback(invokeCallback);
          var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
          isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c3) {
            return c3;
          })) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(
            callback,
            escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(
              userProvidedKeyEscapeRegex,
              "$&/"
            ) + "/") + childKey
          ), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
          return 1;
        }
        invokeCallback = 0;
        childKey = "" === nameSoFar ? "." : nameSoFar + ":";
        if (isArrayImpl(children))
          for (var i4 = 0; i4 < children.length; i4++)
            nameSoFar = children[i4], type = childKey + getElementKey(nameSoFar, i4), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if (i4 = getIteratorFn(children), "function" === typeof i4)
          for (i4 === children.entries && (didWarnAboutMaps || console.warn(
            "Using Maps as children is not supported. Use an array of keyed ReactElements instead."
          ), didWarnAboutMaps = true), children = i4.call(children), i4 = 0; !(nameSoFar = children.next()).done; )
            nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i4++), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if ("object" === type) {
          if ("function" === typeof children.then)
            return mapIntoArray(
              resolveThenable(children),
              array,
              escapedPrefix,
              nameSoFar,
              callback
            );
          array = String(children);
          throw Error(
            "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
          );
        }
        return invokeCallback;
      }
      function mapChildren(children, func, context) {
        if (null == children) return children;
        var result = [], count = 0;
        mapIntoArray(children, result, "", "", function(child) {
          return func.call(context, child, count++);
        });
        return result;
      }
      function lazyInitializer(payload) {
        if (-1 === payload._status) {
          var ioInfo = payload._ioInfo;
          null != ioInfo && (ioInfo.start = ioInfo.end = performance.now());
          ioInfo = payload._result;
          var thenable = ioInfo();
          thenable.then(
            function(moduleObject) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 1;
                payload._result = moduleObject;
                var _ioInfo = payload._ioInfo;
                null != _ioInfo && (_ioInfo.end = performance.now());
                void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
              }
            },
            function(error) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 2;
                payload._result = error;
                var _ioInfo2 = payload._ioInfo;
                null != _ioInfo2 && (_ioInfo2.end = performance.now());
                void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            }
          );
          ioInfo = payload._ioInfo;
          if (null != ioInfo) {
            ioInfo.value = thenable;
            var displayName = thenable.displayName;
            "string" === typeof displayName && (ioInfo.name = displayName);
          }
          -1 === payload._status && (payload._status = 0, payload._result = thenable);
        }
        if (1 === payload._status)
          return ioInfo = payload._result, void 0 === ioInfo && console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?",
            ioInfo
          ), "default" in ioInfo || console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))",
            ioInfo
          ), ioInfo.default;
        throw payload._result;
      }
      function resolveDispatcher() {
        var dispatcher = ReactSharedInternals.H;
        null === dispatcher && console.error(
          "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem."
        );
        return dispatcher;
      }
      function releaseAsyncTransition() {
        ReactSharedInternals.asyncTransitions--;
      }
      function enqueueTask(task) {
        if (null === enqueueTaskImpl)
          try {
            var requireString = ("require" + Math.random()).slice(0, 7);
            enqueueTaskImpl = (module && module[requireString]).call(
              module,
              "timers"
            ).setImmediate;
          } catch (_err) {
            enqueueTaskImpl = function(callback) {
              false === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = true, "undefined" === typeof MessageChannel && console.error(
                "This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."
              ));
              var channel = new MessageChannel();
              channel.port1.onmessage = callback;
              channel.port2.postMessage(void 0);
            };
          }
        return enqueueTaskImpl(task);
      }
      function aggregateErrors(errors) {
        return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
      }
      function popActScope(prevActQueue, prevActScopeDepth) {
        prevActScopeDepth !== actScopeDepth - 1 && console.error(
          "You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. "
        );
        actScopeDepth = prevActScopeDepth;
      }
      function recursivelyFlushAsyncActWork(returnValue, resolve3, reject) {
        var queue = ReactSharedInternals.actQueue;
        if (null !== queue)
          if (0 !== queue.length)
            try {
              flushActQueue(queue);
              enqueueTask(function() {
                return recursivelyFlushAsyncActWork(returnValue, resolve3, reject);
              });
              return;
            } catch (error) {
              ReactSharedInternals.thrownErrors.push(error);
            }
          else ReactSharedInternals.actQueue = null;
        0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve3(returnValue);
      }
      function flushActQueue(queue) {
        if (!isFlushing) {
          isFlushing = true;
          var i4 = 0;
          try {
            for (; i4 < queue.length; i4++) {
              var callback = queue[i4];
              do {
                ReactSharedInternals.didUsePromise = false;
                var continuation = callback(false);
                if (null !== continuation) {
                  if (ReactSharedInternals.didUsePromise) {
                    queue[i4] = callback;
                    queue.splice(0, i4);
                    return;
                  }
                  callback = continuation;
                } else break;
              } while (1);
            }
            queue.length = 0;
          } catch (error) {
            queue.splice(0, i4 + 1), ReactSharedInternals.thrownErrors.push(error);
          } finally {
            isFlushing = false;
          }
        }
      }
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
      var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo"), REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
        isMounted: function() {
          return false;
        },
        enqueueForceUpdate: function(publicInstance) {
          warnNoop(publicInstance, "forceUpdate");
        },
        enqueueReplaceState: function(publicInstance) {
          warnNoop(publicInstance, "replaceState");
        },
        enqueueSetState: function(publicInstance) {
          warnNoop(publicInstance, "setState");
        }
      }, assign = Object.assign, emptyObject = {};
      Object.freeze(emptyObject);
      Component.prototype.isReactComponent = {};
      Component.prototype.setState = function(partialState, callback) {
        if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
          throw Error(
            "takes an object of state variables to update or a function which returns an object of state variables."
          );
        this.updater.enqueueSetState(this, partialState, callback, "setState");
      };
      Component.prototype.forceUpdate = function(callback) {
        this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
      };
      var deprecatedAPIs = {
        isMounted: [
          "isMounted",
          "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."
        ],
        replaceState: [
          "replaceState",
          "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."
        ]
      };
      for (fnName in deprecatedAPIs)
        deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
      ComponentDummy.prototype = Component.prototype;
      deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
      deprecatedAPIs.constructor = PureComponent;
      assign(deprecatedAPIs, Component.prototype);
      deprecatedAPIs.isPureReactComponent = true;
      var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE = /* @__PURE__ */ Symbol.for("react.client.reference"), ReactSharedInternals = {
        H: null,
        A: null,
        T: null,
        S: null,
        actQueue: null,
        asyncTransitions: 0,
        isBatchingLegacy: false,
        didScheduleLegacyUpdate: false,
        didUsePromise: false,
        thrownErrors: [],
        getCurrentStack: null,
        recentlyCreatedOwnerStacks: 0
      }, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
        return null;
      };
      deprecatedAPIs = {
        react_stack_bottom_frame: function(callStackForError) {
          return callStackForError();
        }
      };
      var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
      var didWarnAboutElementRef = {};
      var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(
        deprecatedAPIs,
        UnknownOwner
      )();
      var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
      var didWarnAboutMaps = false, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
          var event = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
            error
          });
          if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof process && "function" === typeof process.emit) {
          process.emit("uncaughtException", error);
          return;
        }
        console.error(error);
      }, didWarnAboutMessageChannel = false, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = false, isFlushing = false, queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function(callback) {
        queueMicrotask(function() {
          return queueMicrotask(callback);
        });
      } : enqueueTask;
      deprecatedAPIs = Object.freeze({
        __proto__: null,
        c: function(size) {
          return resolveDispatcher().useMemoCache(size);
        }
      });
      var fnName = {
        map: mapChildren,
        forEach: function(children, forEachFunc, forEachContext) {
          mapChildren(
            children,
            function() {
              forEachFunc.apply(this, arguments);
            },
            forEachContext
          );
        },
        count: function(children) {
          var n4 = 0;
          mapChildren(children, function() {
            n4++;
          });
          return n4;
        },
        toArray: function(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        },
        only: function(children) {
          if (!isValidElement(children))
            throw Error(
              "React.Children.only expected to receive a single React element child."
            );
          return children;
        }
      };
      exports.Activity = REACT_ACTIVITY_TYPE;
      exports.Children = fnName;
      exports.Component = Component;
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.Profiler = REACT_PROFILER_TYPE;
      exports.PureComponent = PureComponent;
      exports.StrictMode = REACT_STRICT_MODE_TYPE;
      exports.Suspense = REACT_SUSPENSE_TYPE;
      exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
      exports.__COMPILER_RUNTIME = deprecatedAPIs;
      exports.act = function(callback) {
        var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
        actScopeDepth++;
        var queue = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [], didAwaitActCall = false;
        try {
          var result = callback();
        } catch (error) {
          ReactSharedInternals.thrownErrors.push(error);
        }
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        if (null !== result && "object" === typeof result && "function" === typeof result.then) {
          var thenable = result;
          queueSeveralMicrotasks(function() {
            didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
              "You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"
            ));
          });
          return {
            then: function(resolve3, reject) {
              didAwaitActCall = true;
              thenable.then(
                function(returnValue) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  if (0 === prevActScopeDepth) {
                    try {
                      flushActQueue(queue), enqueueTask(function() {
                        return recursivelyFlushAsyncActWork(
                          returnValue,
                          resolve3,
                          reject
                        );
                      });
                    } catch (error$0) {
                      ReactSharedInternals.thrownErrors.push(error$0);
                    }
                    if (0 < ReactSharedInternals.thrownErrors.length) {
                      var _thrownError = aggregateErrors(
                        ReactSharedInternals.thrownErrors
                      );
                      ReactSharedInternals.thrownErrors.length = 0;
                      reject(_thrownError);
                    }
                  } else resolve3(returnValue);
                },
                function(error) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(
                    ReactSharedInternals.thrownErrors
                  ), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
                }
              );
            }
          };
        }
        var returnValue$jscomp$0 = result;
        popActScope(prevActQueue, prevActScopeDepth);
        0 === prevActScopeDepth && (flushActQueue(queue), 0 !== queue.length && queueSeveralMicrotasks(function() {
          didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
            "A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"
          ));
        }), ReactSharedInternals.actQueue = null);
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        return {
          then: function(resolve3, reject) {
            didAwaitActCall = true;
            0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
              return recursivelyFlushAsyncActWork(
                returnValue$jscomp$0,
                resolve3,
                reject
              );
            })) : resolve3(returnValue$jscomp$0);
          }
        };
      };
      exports.cache = function(fn) {
        return function() {
          return fn.apply(null, arguments);
        };
      };
      exports.cacheSignal = function() {
        return null;
      };
      exports.captureOwnerStack = function() {
        var getCurrentStack = ReactSharedInternals.getCurrentStack;
        return null === getCurrentStack ? null : getCurrentStack();
      };
      exports.cloneElement = function(element, config, children) {
        if (null === element || void 0 === element)
          throw Error(
            "The argument must be a React element, but you passed " + element + "."
          );
        var props = assign({}, element.props), key = element.key, owner = element._owner;
        if (null != config) {
          var JSCompiler_inline_result;
          a: {
            if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(
              config,
              "ref"
            ).get) && JSCompiler_inline_result.isReactWarning) {
              JSCompiler_inline_result = false;
              break a;
            }
            JSCompiler_inline_result = void 0 !== config.ref;
          }
          JSCompiler_inline_result && (owner = getOwner());
          hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
          for (propName in config)
            !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
        }
        var propName = arguments.length - 2;
        if (1 === propName) props.children = children;
        else if (1 < propName) {
          JSCompiler_inline_result = Array(propName);
          for (var i4 = 0; i4 < propName; i4++)
            JSCompiler_inline_result[i4] = arguments[i4 + 2];
          props.children = JSCompiler_inline_result;
        }
        props = ReactElement(
          element.type,
          key,
          props,
          owner,
          element._debugStack,
          element._debugTask
        );
        for (key = 2; key < arguments.length; key++)
          validateChildKeys(arguments[key]);
        return props;
      };
      exports.createContext = function(defaultValue) {
        defaultValue = {
          $$typeof: REACT_CONTEXT_TYPE,
          _currentValue: defaultValue,
          _currentValue2: defaultValue,
          _threadCount: 0,
          Provider: null,
          Consumer: null
        };
        defaultValue.Provider = defaultValue;
        defaultValue.Consumer = {
          $$typeof: REACT_CONSUMER_TYPE,
          _context: defaultValue
        };
        defaultValue._currentRenderer = null;
        defaultValue._currentRenderer2 = null;
        return defaultValue;
      };
      exports.createElement = function(type, config, children) {
        for (var i4 = 2; i4 < arguments.length; i4++)
          validateChildKeys(arguments[i4]);
        i4 = {};
        var key = null;
        if (null != config)
          for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = true, console.warn(
            "Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform"
          )), hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key), config)
            hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i4[propName] = config[propName]);
        var childrenLength = arguments.length - 2;
        if (1 === childrenLength) i4.children = children;
        else if (1 < childrenLength) {
          for (var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++)
            childArray[_i] = arguments[_i + 2];
          Object.freeze && Object.freeze(childArray);
          i4.children = childArray;
        }
        if (type && type.defaultProps)
          for (propName in childrenLength = type.defaultProps, childrenLength)
            void 0 === i4[propName] && (i4[propName] = childrenLength[propName]);
        key && defineKeyPropWarningGetter(
          i4,
          "function" === typeof type ? type.displayName || type.name || "Unknown" : type
        );
        var propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        return ReactElement(
          type,
          key,
          i4,
          getOwner(),
          propName ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
          propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
      exports.createRef = function() {
        var refObject = { current: null };
        Object.seal(refObject);
        return refObject;
      };
      exports.forwardRef = function(render) {
        null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error(
          "forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...))."
        ) : "function" !== typeof render ? console.error(
          "forwardRef requires a render function but was given %s.",
          null === render ? "null" : typeof render
        ) : 0 !== render.length && 2 !== render.length && console.error(
          "forwardRef render functions accept exactly two parameters: props and ref. %s",
          1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined."
        );
        null != render && null != render.defaultProps && console.error(
          "forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?"
        );
        var elementType = { $$typeof: REACT_FORWARD_REF_TYPE, render }, ownName;
        Object.defineProperty(elementType, "displayName", {
          enumerable: false,
          configurable: true,
          get: function() {
            return ownName;
          },
          set: function(name) {
            ownName = name;
            render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
          }
        });
        return elementType;
      };
      exports.isValidElement = isValidElement;
      exports.lazy = function(ctor) {
        ctor = { _status: -1, _result: ctor };
        var lazyType = {
          $$typeof: REACT_LAZY_TYPE,
          _payload: ctor,
          _init: lazyInitializer
        }, ioInfo = {
          name: "lazy",
          start: -1,
          end: -1,
          value: null,
          owner: null,
          debugStack: Error("react-stack-top-frame"),
          debugTask: console.createTask ? console.createTask("lazy()") : null
        };
        ctor._ioInfo = ioInfo;
        lazyType._debugInfo = [{ awaited: ioInfo }];
        return lazyType;
      };
      exports.memo = function(type, compare) {
        null == type && console.error(
          "memo: The first argument must be a component. Instead received: %s",
          null === type ? "null" : typeof type
        );
        compare = {
          $$typeof: REACT_MEMO_TYPE,
          type,
          compare: void 0 === compare ? null : compare
        };
        var ownName;
        Object.defineProperty(compare, "displayName", {
          enumerable: false,
          configurable: true,
          get: function() {
            return ownName;
          },
          set: function(name) {
            ownName = name;
            type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
          }
        });
        return compare;
      };
      exports.startTransition = function(scope) {
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        currentTransition._updatedFibers = /* @__PURE__ */ new Set();
        ReactSharedInternals.T = currentTransition;
        try {
          var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
        } catch (error) {
          reportGlobalError(error);
        } finally {
          null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn(
            "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."
          )), null !== prevTransition && null !== currentTransition.types && (null !== prevTransition.types && prevTransition.types !== currentTransition.types && console.error(
            "We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."
          ), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
        }
      };
      exports.unstable_useCacheRefresh = function() {
        return resolveDispatcher().useCacheRefresh();
      };
      exports.use = function(usable) {
        return resolveDispatcher().use(usable);
      };
      exports.useActionState = function(action, initialState, permalink) {
        return resolveDispatcher().useActionState(
          action,
          initialState,
          permalink
        );
      };
      exports.useCallback = function(callback, deps) {
        return resolveDispatcher().useCallback(callback, deps);
      };
      exports.useContext = function(Context) {
        var dispatcher = resolveDispatcher();
        Context.$$typeof === REACT_CONSUMER_TYPE && console.error(
          "Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?"
        );
        return dispatcher.useContext(Context);
      };
      exports.useDebugValue = function(value, formatterFn) {
        return resolveDispatcher().useDebugValue(value, formatterFn);
      };
      exports.useDeferredValue = function(value, initialValue) {
        return resolveDispatcher().useDeferredValue(value, initialValue);
      };
      exports.useEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useEffect(create, deps);
      };
      exports.useEffectEvent = function(callback) {
        return resolveDispatcher().useEffectEvent(callback);
      };
      exports.useId = function() {
        return resolveDispatcher().useId();
      };
      exports.useImperativeHandle = function(ref, create, deps) {
        return resolveDispatcher().useImperativeHandle(ref, create, deps);
      };
      exports.useInsertionEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useInsertionEffect(create, deps);
      };
      exports.useLayoutEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useLayoutEffect(create, deps);
      };
      exports.useMemo = function(create, deps) {
        return resolveDispatcher().useMemo(create, deps);
      };
      exports.useOptimistic = function(passthrough, reducer) {
        return resolveDispatcher().useOptimistic(passthrough, reducer);
      };
      exports.useReducer = function(reducer, initialArg, init) {
        return resolveDispatcher().useReducer(reducer, initialArg, init);
      };
      exports.useRef = function(initialValue) {
        return resolveDispatcher().useRef(initialValue);
      };
      exports.useState = function(initialState) {
        return resolveDispatcher().useState(initialState);
      };
      exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
        return resolveDispatcher().useSyncExternalStore(
          subscribe,
          getSnapshot,
          getServerSnapshot
        );
      };
      exports.useTransition = function() {
        return resolveDispatcher().useTransition();
      };
      exports.version = "19.2.8";
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  }
});

// node_modules/react/index.js
var require_react = __commonJS({
  "node_modules/react/index.js"(exports, module) {
    "use strict";
    if (process.env.NODE_ENV === "production") {
      module.exports = require_react_production();
    } else {
      module.exports = require_react_development();
    }
  }
});

// node_modules/react/cjs/react-jsx-runtime.production.js
var require_react_jsx_runtime_production = __commonJS({
  "node_modules/react/cjs/react-jsx-runtime.production.js"(exports) {
    "use strict";
    var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element");
    var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
    function jsxProd(type, config, maybeKey) {
      var key = null;
      void 0 !== maybeKey && (key = "" + maybeKey);
      void 0 !== config.key && (key = "" + config.key);
      if ("key" in config) {
        maybeKey = {};
        for (var propName in config)
          "key" !== propName && (maybeKey[propName] = config[propName]);
      } else maybeKey = config;
      config = maybeKey.ref;
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        ref: void 0 !== config ? config : null,
        props: maybeKey
      };
    }
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsx = jsxProd;
    exports.jsxs = jsxProd;
  }
});

// node_modules/react/cjs/react-jsx-runtime.development.js
var require_react_jsx_runtime_development = __commonJS({
  "node_modules/react/cjs/react-jsx-runtime.development.js"(exports) {
    "use strict";
    "production" !== process.env.NODE_ENV && (function() {
      function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type)
          return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
          case REACT_ACTIVITY_TYPE:
            return "Activity";
        }
        if ("object" === typeof type)
          switch ("number" === typeof type.tag && console.error(
            "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
          ), type.$$typeof) {
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_CONTEXT_TYPE:
              return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
              return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
              var innerType = type.render;
              type = type.displayName;
              type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
              return type;
            case REACT_MEMO_TYPE:
              return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
              innerType = type._payload;
              type = type._init;
              try {
                return getComponentNameFromType(type(innerType));
              } catch (x2) {
              }
          }
        return null;
      }
      function testStringCoercion(value) {
        return "" + value;
      }
      function checkKeyStringCoercion(value) {
        try {
          testStringCoercion(value);
          var JSCompiler_inline_result = false;
        } catch (e2) {
          JSCompiler_inline_result = true;
        }
        if (JSCompiler_inline_result) {
          JSCompiler_inline_result = console;
          var JSCompiler_temp_const = JSCompiler_inline_result.error;
          var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
          JSCompiler_temp_const.call(
            JSCompiler_inline_result,
            "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
            JSCompiler_inline_result$jscomp$0
          );
          return testStringCoercion(value);
        }
      }
      function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
          return "<...>";
        try {
          var name = getComponentNameFromType(type);
          return name ? "<" + name + ">" : "<...>";
        } catch (x2) {
          return "<...>";
        }
      }
      function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
      }
      function UnknownOwner() {
        return Error("react-stack-top-frame");
      }
      function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
          var getter = Object.getOwnPropertyDescriptor(config, "key").get;
          if (getter && getter.isReactWarning) return false;
        }
        return void 0 !== config.key;
      }
      function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
          specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
            "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
            displayName
          ));
        }
        warnAboutAccessingKey.isReactWarning = true;
        Object.defineProperty(props, "key", {
          get: warnAboutAccessingKey,
          configurable: true
        });
      }
      function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
          "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
        ));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
      }
      function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          props,
          _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
          enumerable: false,
          get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: null
        });
        Object.defineProperty(type, "_debugStack", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
      }
      function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
        var children = config.children;
        if (void 0 !== children)
          if (isStaticChildren)
            if (isArrayImpl(children)) {
              for (isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)
                validateChildKeys(children[isStaticChildren]);
              Object.freeze && Object.freeze(children);
            } else
              console.error(
                "React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead."
              );
          else validateChildKeys(children);
        if (hasOwnProperty.call(config, "key")) {
          children = getComponentNameFromType(type);
          var keys = Object.keys(config).filter(function(k4) {
            return "key" !== k4;
          });
          isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
          didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error(
            'A props object containing a "key" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />',
            isStaticChildren,
            children,
            keys,
            children
          ), didWarnAboutKeySpread[children + isStaticChildren] = true);
        }
        children = null;
        void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
        hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
        if ("key" in config) {
          maybeKey = {};
          for (var propName in config)
            "key" !== propName && (maybeKey[propName] = config[propName]);
        } else maybeKey = config;
        children && defineKeyPropWarningGetter(
          maybeKey,
          "function" === typeof type ? type.displayName || type.name || "Unknown" : type
        );
        return ReactElement(
          type,
          children,
          maybeKey,
          getOwner(),
          debugStack,
          debugTask
        );
      }
      function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
      }
      function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
      }
      var React = require_react(), REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo"), REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = /* @__PURE__ */ Symbol.for("react.activity"), REACT_CLIENT_REFERENCE = /* @__PURE__ */ Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
        return null;
      };
      React = {
        react_stack_bottom_frame: function(callStackForError) {
          return callStackForError();
        }
      };
      var specialPropKeyWarningShown;
      var didWarnAboutElementRef = {};
      var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(
        React,
        UnknownOwner
      )();
      var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
      var didWarnAboutKeySpread = {};
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.jsx = function(type, config, maybeKey) {
        var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        return jsxDEVImpl(
          type,
          config,
          maybeKey,
          false,
          trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
          trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
      exports.jsxs = function(type, config, maybeKey) {
        var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        return jsxDEVImpl(
          type,
          config,
          maybeKey,
          true,
          trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
          trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
    })();
  }
});

// node_modules/react/jsx-runtime.js
var require_jsx_runtime = __commonJS({
  "node_modules/react/jsx-runtime.js"(exports, module) {
    "use strict";
    if (process.env.NODE_ENV === "production") {
      module.exports = require_react_jsx_runtime_production();
    } else {
      module.exports = require_react_jsx_runtime_development();
    }
  }
});

// src/cli/entry-ssi.ts
import * as path3 from "node:path";

// node_modules/@sjtu-ai4math/snl-basics/dist-lib/chunks/semantic-resolver-BM9_sSrv.js
function t(e2, t4) {
  return {
    macro_name: e2,
    kind: t4?.kind ?? "",
    mdata: t4?.mdata ?? null,
    children: t4?.children ?? []
  };
}
function n() {
  return t("");
}
var o = /^[A-Za-z0-9_\\]$/;
var s = /^[A-Za-z0-9_.-]$/;
var c = /[\p{White_Space}\p{Cc}\p{Cf}\p{Cs}]/u;
function l(e2, t4) {
  let n4 = e2.codePointAt(t4);
  return n4 === void 0 ? null : String.fromCodePoint(n4);
}
function u(e2, t4, n4) {
  let r3 = l(e2, t4);
  return r3 === null ? 0 : r3.codePointAt(0) <= 127 ? +!!(n4 ? o : s).test(r3) : c.test(r3) ? 0 : r3.length;
}
function d(e2) {
  if (e2.length === 0) return false;
  let t4 = 0, n4 = u(e2, t4, true);
  if (n4 === 0) return false;
  for (t4 += n4; t4 < e2.length; ) {
    if (n4 = u(e2, t4, false), n4 === 0) return false;
    t4 += n4;
  }
  return true;
}
var p = 100;
function m(e2, t4, n4 = false) {
  return {
    positional_arity: e2,
    variadic: t4,
    invalid: n4 || !Number.isInteger(e2) || e2 < 0 || e2 > p
  };
}
function v(e2) {
  let t4 = e2.replace(/\\#/g, "ESCAPED_HASH"), n4 = -1;
  for (let e3 of t4.matchAll(/#(\d{1,2})(?!\d)/g)) n4 = Math.max(n4, Number(e3[1]));
  return m(n4 + 1, /#\*/.test(t4), /#\d{3,}/.test(t4));
}
var b = class extends Error {
  position;
  constructor(e2, t4) {
    super(`${e2} at position ${t4}`), this.name = "SnlSyntaxTreeParseError", this.position = t4;
  }
};
function x(e2, t4) {
  let n4 = e2.length - t4;
  if (n4 >= 2 && e2[t4] === "`") {
    let n5 = e2.indexOf("`", t4 + 1);
    if (n5 < 0) throw new b("Unclosed ` delimiter", t4);
    return {
      token: {
        type: "BACKTICK_DELIMITED",
        value: e2.slice(t4 + 1, n5),
        position: t4
      },
      next: n5 + 1
    };
  }
  if (n4 >= 4 && e2[t4] === "$" && e2[t4 + 1] === "$") {
    let n5 = e2.indexOf("$$", t4 + 2);
    if (n5 < 0) throw new b("Unclosed $$ delimiter", t4);
    return {
      token: {
        type: "DOLLAR2_DELIMITED",
        value: e2.slice(t4 + 2, n5),
        position: t4
      },
      next: n5 + 2
    };
  }
  if (n4 >= 2 && e2[t4] === "$") {
    let n5 = e2.indexOf("$", t4 + 1);
    if (n5 < 0) throw new b("Unclosed $ delimiter", t4);
    return {
      token: {
        type: "DOLLAR_DELIMITED",
        value: e2.slice(t4 + 1, n5),
        position: t4
      },
      next: n5 + 1
    };
  }
  if (n4 >= 2 && e2[t4] === "%") {
    let n5 = e2.indexOf("%", t4 + 1);
    if (n5 < 0) throw new b("Unclosed % delimiter", t4);
    return {
      token: {
        type: "PERCENT_DELIMITED",
        value: e2.slice(t4 + 1, n5),
        position: t4
      },
      next: n5 + 1
    };
  }
  return null;
}
function S(e2) {
  let t4 = [], n4 = 0;
  for (; n4 < e2.length; ) {
    let r3 = e2[n4];
    if (/[ \t\r\n\f\v]/.test(r3)) {
      n4 += 1;
      continue;
    }
    if (r3 === "%" || r3 === "$" || r3 === "`") {
      let r4 = x(e2, n4);
      if (r4) {
        t4.push(r4.token), n4 = r4.next;
        continue;
      }
    }
    if (r3 === "@") {
      t4.push({
        type: "AT",
        value: r3,
        position: n4
      }), n4 += 1;
      continue;
    }
    if (r3 === "#") {
      t4.push({
        type: "HASH",
        value: r3,
        position: n4
      }), n4 += 1;
      continue;
    }
    let i4 = u(e2, n4, true);
    if (i4 > 0) {
      let r4 = n4;
      for (n4 += i4; n4 < e2.length; ) {
        let t5 = u(e2, n4, false);
        if (t5 === 0) break;
        n4 += t5;
      }
      t4.push({
        type: "IDENT",
        value: e2.slice(r4, n4),
        position: r4
      });
      continue;
    }
    if (r3 === "[") {
      t4.push({
        type: "LBRACKET",
        value: r3,
        position: n4
      }), n4 += 1;
      continue;
    }
    if (r3 === "]") {
      t4.push({
        type: "RBRACKET",
        value: r3,
        position: n4
      }), n4 += 1;
      continue;
    }
    if (r3 === "(") {
      t4.push({
        type: "LPAREN",
        value: r3,
        position: n4
      }), n4 += 1;
      continue;
    }
    if (r3 === ")") {
      t4.push({
        type: "RPAREN",
        value: r3,
        position: n4
      }), n4 += 1;
      continue;
    }
    if (r3 === ",") {
      t4.push({
        type: "COMMA",
        value: r3,
        position: n4
      }), n4 += 1;
      continue;
    }
    if (r3 === "=") {
      t4.push({
        type: "EQ",
        value: r3,
        position: n4
      }), n4 += 1;
      continue;
    }
    if (/\d/.test(r3)) {
      let r4 = n4;
      for (; n4 < e2.length && /\d/.test(e2[n4]); ) n4 += 1;
      t4.push({
        type: "NUMBER",
        value: e2.slice(r4, n4),
        position: r4
      });
      continue;
    }
    throw new b(`Unexpected character "${r3}"`, n4);
  }
  return t4.push({
    type: "EOF",
    value: "",
    position: e2.length
  }), t4;
}
var C = class {
  cursor = 0;
  tokens;
  constructor(e2) {
    this.tokens = e2;
  }
  parse() {
    let e2 = this.parseNode();
    return this.expect("EOF"), e2;
  }
  parseNode() {
    let e2 = this.peek().type === "AT";
    e2 && this.consume("AT");
    let n4 = this.peek(), r3;
    if (n4.type === "IDENT") this.consume("IDENT"), r3 = t(n4.value);
    else if (n4.type === "PERCENT_DELIMITED") this.consume("PERCENT_DELIMITED"), r3 = t(n4.value), r3.env_mode = "text";
    else if (n4.type === "DOLLAR_DELIMITED") this.consume("DOLLAR_DELIMITED"), r3 = t(n4.value), r3.env_mode = "formula_inline";
    else if (n4.type === "DOLLAR2_DELIMITED") this.consume("DOLLAR2_DELIMITED"), r3 = t(n4.value), r3.env_mode = "formula_display";
    else if (n4.type === "BACKTICK_DELIMITED") this.consume("BACKTICK_DELIMITED"), r3 = t(n4.value), r3.env_mode = "formula_inline", r3.temporary_format = "texttt";
    else throw new b(`Expected macro name (IDENT or %\u2026% / $\u2026$ / $$\u2026$$) but got ${n4.type}`, n4.position);
    if (this.peek().type === "AT") if (this.consume("AT"), this.peek().type === "HASH") {
      if (e2) throw new b("Binder name override must not use #", this.peek().position);
      this.consume("HASH");
      let t4 = this.expect("IDENT");
      /^\d+(?:\.\d+)*$/.test(t4.value) ? r3.postfix = {
        type: "tree_path",
        path: t4.value.split(".").map(Number)
      } : r3.postfix = {
        type: "binder_name",
        name: t4.value
      };
    } else {
      let t4 = this.expect("IDENT");
      e2 ? r3.binder_name = t4.value : r3.postfix = {
        type: "name",
        name: t4.value
      };
    }
    if (this.peek().type === "LBRACKET") {
      this.consume("LBRACKET");
      let e3 = this.expect("IDENT");
      r3.style_name = e3.value, this.expect("RBRACKET");
    }
    if (this.peek().type === "LPAREN" && (this.consume("LPAREN"), r3.children = this.parseNodeList(), this.expect("RPAREN")), e2) {
      if (r3.children.length > 0) throw new b("Binder must be a leaf", n4.position);
      r3.binder_explicit = true, r3.kind = "binder";
    }
    return r3;
  }
  parseNodeList() {
    if (this.peek().type === "RPAREN") return [];
    let e2 = [this.parseArgument()];
    for (; this.peek().type === "COMMA"; ) this.consume("COMMA"), e2.push(this.parseArgument());
    return e2;
  }
  parseArgument() {
    let e2 = this.peek().type;
    return e2 === "COMMA" || e2 === "RPAREN" ? n() : this.parseNode();
  }
  expect(e2) {
    let t4 = this.peek();
    if (t4.type !== e2) throw new b(`Expected ${e2} but got ${t4.type}`, t4.position);
    return this.cursor += 1, t4;
  }
  consume(e2) {
    return this.expect(e2);
  }
  peek() {
    return this.tokens[this.cursor];
  }
};
function w(e2, t4 = {}) {
  let n4 = new C(S(e2)).parse();
  return T(n4), n4;
}
function T(e2, t4 = []) {
  e2.env_mode && (e2.temporary_source = e2.macro_name, e2.macro_name = t4.length === 0 ? "#" : `#${t4.join(".")}`), e2.binder_explicit && e2.binder_name === void 0 && (e2.binder_name = e2.temporary_source ?? e2.macro_name), e2.children.forEach((e3, n4) => T(e3, [...t4, n4]));
}
function E(e2) {
  try {
    return {
      ok: true,
      tree: w(e2)
    };
  } catch (e3) {
    return e3 instanceof b ? {
      ok: false,
      error: e3.message,
      position: e3.position
    } : {
      ok: false,
      error: e3 instanceof Error ? e3.message : String(e3)
    };
  }
}
function D(e2) {
  if (!e2 || typeof e2 != "object" || Array.isArray(e2)) return e2;
  let t4 = { ...e2 };
  return delete t4.bindRef, Object.keys(t4).length > 0 ? t4 : null;
}
function O(e2) {
  return {
    ...e2,
    mdata: D(e2.mdata),
    postfix: e2.postfix?.type === "tree_path" ? {
      type: "tree_path",
      path: [...e2.postfix.path]
    } : e2.postfix ? { ...e2.postfix } : void 0,
    source: void 0,
    children: e2.children.map(O)
  };
}
function k(e2, t4) {
  return e2.length === t4.length && e2.every((e3, n4) => e3 === t4[n4]);
}
function A(e2, t4) {
  let n4 = 0;
  for (; n4 < e2.length && n4 < t4.length && e2[n4] === t4[n4]; ) n4 += 1;
  return n4;
}
function j(e2, t4, n4) {
  return e2.filter((e3) => !n4 || e3.order < t4.order).sort((e3, n5) => A(n5.path, t4.path) - A(e3.path, t4.path) || n5.order - e3.order)[0];
}
function M(e2) {
  return e2.temporary_source ?? e2.macro_name;
}
function N(e2, t4) {
  let n4 = O(e2), r3 = [], i4 = [], a4 = 0, o4 = (e3, n5) => {
    i4.push({
      node: e3,
      path: n5,
      order: a4++
    }), e3.scope = void 0;
    let s5 = e3.env_mode ? void 0 : t4[e3.macro_name], c3 = n5.length === 0 && e3.env_mode === "text", l3 = s5?.kind === "sub";
    if (c3 || l3 || e3.kind === "sub") e3.kind = "sub", e3.binder_name = void 0, e3.source = void 0, (e3.postfix || e3.binder_explicit) && r3.push({
      code: "SNL_SUB_IGNORES_BINDER_SUFFIX",
      severity: "warning",
      tree_path: [...n5],
      message: "sub nodes ignore binder declarations and postfix sources"
    });
    else if (e3.binder_explicit) e3.kind = "binder", e3.binder_name ??= e3.macro_name;
    else if (s5) {
      if (e3.kind = s5.kind || "const", e3.style_name && !s5.styles.some((t5) => t5.style_name === e3.style_name) && (r3.push({
        code: "SNL_STYLE_NOT_FOUND",
        severity: "warning",
        tree_path: [...n5],
        message: `style ${JSON.stringify(e3.style_name)} was not found; using the first style`
      }), e3.style_name = void 0), e3.postfix?.type === "name" && (e3.binder_name = e3.postfix.name), e3.source = void 0, e3.mdata && typeof e3.mdata == "object") {
        let t5 = { ...e3.mdata };
        delete t5.src, e3.mdata = Object.keys(t5).length > 0 ? t5 : null;
      }
    } else e3.kind && e3.kind !== "bvar" && e3.kind !== "fvar" || (e3.kind = "", e3.binder_name = void 0);
    e3.children.forEach((e4, t5) => o4(e4, [...n5, t5]));
  };
  o4(n4, []);
  let s4 = i4.flatMap((e3) => {
    let t5 = e3.node.binder_name;
    return t5 && (e3.node.kind === "binder" || e3.node.kind !== "" && e3.node.source === void 0) ? [{
      ...e3,
      binderName: t5
    }] : [];
  });
  for (let e3 of i4) {
    let { node: t5, path: n5 } = e3;
    if (t5.kind !== "") continue;
    let a5;
    if (t5.postfix?.type === "name") {
      let e4 = t5.mdata && typeof t5.mdata == "object" ? t5.mdata.srcStatus : void 0;
      e4 === "dangling" || e4 === "srcResolvedNoDecl" ? r3.push({
        code: e4 === "dangling" ? "SNL_ENTRY_SOURCE_NOT_FOUND" : "SNL_ENTRY_SOURCE_NO_DECL",
        severity: "warning",
        tree_path: [...n5],
        message: `Entry source ${JSON.stringify(t5.postfix.name)} did not export this reference`
      }) : a5 = {
        type: "entry",
        entry_id: t5.postfix.name
      };
    } else if (t5.postfix?.type === "tree_path") {
      let e4 = i4.find((e5) => e5.node.kind !== "sub" && k(e5.path, t5.postfix.type === "tree_path" ? t5.postfix.path : []));
      e4 ? a5 = {
        type: "tree_path",
        path: [...e4.path]
      } : r3.push({
        code: "SNL_DANGLING_TREE_SOURCE",
        severity: "warning",
        tree_path: [...n5],
        message: `tree source #${t5.postfix.path.join(".")} does not name a semantic node`
      });
    } else {
      let i5 = t5.postfix?.type === "binder_name" ? t5.postfix.name : M(t5), o5 = j(s4.filter((e4) => e4.binderName === i5), e3, true);
      o5 ? a5 = {
        type: "tree_path",
        path: [...o5.path]
      } : t5.postfix?.type === "binder_name" && r3.push({
        code: "SNL_BINDER_NAME_NOT_FOUND",
        severity: "warning",
        tree_path: [...n5],
        message: `binder source ${JSON.stringify(i5)} was not found in the current context`
      });
    }
    a5 ? (t5.kind = "bvar", t5.source = a5) : (t5.kind = "fvar", t5.source = void 0);
  }
  return {
    tree: n4,
    diagnostics: r3
  };
}

// node_modules/@sjtu-ai4math/snl-basics/dist-lib/chunks/table-renderer-options-olFKzBkn.js
var e = Object.freeze({ composition: "rows" });
var t2 = /* @__PURE__ */ new Set(["composition", "css"]);
var n2 = /* @__PURE__ */ new Set(["light", "dark"]);
var r = /* @__PURE__ */ new Set([
  "color",
  "background",
  "border"
]);
function i(e2) {
  return !!e2 && typeof e2 == "object" && !Array.isArray(e2);
}
var a = /* @__PURE__ */ new Set([
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
  "color-mix",
  "light-dark",
  "device-cmyk",
  "var",
  "calc",
  "min",
  "max",
  "clamp"
]);
function o2(e2) {
  if (e2.length > 128 || /[\u0000-\u001f\u007f-\u009f]/.test(e2)) return false;
  let t4 = e2.trim();
  if (t4 === "") return true;
  if (/[;{}\\'"]/.test(t4) || t4.includes("/*") || t4.includes("*/")) return false;
  if (/^#[0-9a-f]{3,4}$/i.test(t4) || /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(t4) || /^[a-z][a-z0-9-]*$/i.test(t4)) return true;
  if (!/^[a-z0-9_#.%(),+*/\s-]+$/i.test(t4)) return false;
  let n4 = [...t4.matchAll(/([a-z][a-z0-9-]*)\s*\(/gi)];
  if (n4.length === 0 || n4[0].index !== 0 || n4.some((e3) => !a.has(e3[1].toLowerCase()))) return false;
  let r3 = [];
  for (let e3 of t4) if (e3 === "(") r3.push(false);
  else if (e3 === ")") {
    if (r3.length === 0 || !r3.pop()) return false;
    r3.length > 0 && (r3[r3.length - 1] = true);
  } else r3.length > 0 && !/\s/.test(e3) && (r3[r3.length - 1] = true);
  return r3.length === 0;
}
function s2(e2, t4) {
  if (!i(e2) || Object.keys(e2).some((e3) => !r.has(e3)) || typeof e2.color != "string" || typeof e2.background != "string" || typeof e2.border != "string") throw Error(`table.css.${t4} must contain string color, background, and border fields`);
  for (let n4 of [
    e2.color,
    e2.background,
    e2.border
  ]) if (!o2(n4)) throw Error(`table.css.${t4} contains an invalid CSS color`);
  return {
    color: e2.color,
    background: e2.background,
    border: e2.border
  };
}
function c2(r3) {
  let a4 = r3.table;
  if (a4 === void 0) return e;
  if (!i(a4) || Object.keys(a4).some((e2) => !t2.has(e2)) || a4.composition !== "rows" && a4.composition !== "cells") throw Error('template.table must select composition "rows" or "cells"');
  if (a4.css === void 0) return { composition: a4.composition };
  if (!i(a4.css) || Object.keys(a4.css).some((e2) => !n2.has(e2)) || !Object.hasOwn(a4.css, "light") || !Object.hasOwn(a4.css, "dark")) throw Error("template.table.css must contain complete light and dark themes");
  return {
    composition: a4.composition,
    css: {
      light: s2(a4.css.light, "light"),
      dark: s2(a4.css.dark, "dark")
    }
  };
}

// node_modules/@sjtu-ai4math/snl-basics/dist-lib/chunks/source-metrics-Dy9B86dH.js
function i2(e2) {
  if (!e2 || typeof e2 != "object" || Array.isArray(e2)) return false;
  let t4 = e2;
  if (t4.type !== "i18n" || typeof t4.default_language != "string" || !t4.values || typeof t4.values != "object" || Array.isArray(t4.values)) return false;
  let n4 = t4.values, r3 = Object.keys(n4);
  return r3.length > 0 && Object.prototype.hasOwnProperty.call(n4, t4.default_language) && typeof n4[t4.default_language] == "string" && r3.every((e3) => typeof n4[e3] == "string");
}
function a2(e2) {
  if (!e2 || typeof e2 != "object" || Array.isArray(e2)) return false;
  let t4 = e2;
  return typeof t4.style_name != "string" || !d(t4.style_name) || "tag" in t4 || "variadic_left" in t4 || "variadic_join" in t4 || "variadic_right" in t4 || !Array.isArray(t4.tags) || !t4.tags.every((e3) => typeof e3 == "string") || t4.separator !== void 0 && typeof t4.separator != "string" || t4.block_template_name !== void 0 && (t4.mode !== "block" || typeof t4.block_template_name != "string") ? false : t4.mode === "text" ? typeof t4.template == "string" || i2(t4.template) : t4.mode === "formula_inline" || t4.mode === "formula_display" || t4.mode === "block" ? typeof t4.template == "string" : false;
}
function o3(e2) {
  return Array.isArray(e2) && e2.every((e3) => typeof e3 == "string");
}
function s3(e2, t4 = true) {
  if (typeof e2.name != "string" || !d(e2.name) || typeof e2.description != "string" || typeof e2.dynamic_arity != "boolean" || (t4 || e2.tags !== void 0) && !o3(e2.tags) || e2.kind !== void 0 && typeof e2.kind != "string" || !e2.source || typeof e2.source != "object" || Array.isArray(e2.source)) return false;
  let r3 = e2.source;
  return o3(r3.entries) && o3(r3.urls);
}
function l2(e2) {
  return !e2 || typeof e2 != "object" || Array.isArray(e2) ? false : Object.values(e2).every((e3) => typeof e3 == "string");
}
function u2(e2) {
  if (!e2 || typeof e2 != "object" || Array.isArray(e2)) return false;
  let t4 = Object.getPrototypeOf(e2);
  return t4 === Object.prototype || t4 === null;
}
function p2(e2) {
  if (!u2(e2)) return false;
  for (let t4 of Object.values(e2)) {
    if (!t4 || typeof t4 != "object" || Array.isArray(t4)) return false;
    let e3 = t4;
    if (!s3(e3) || !l2(e3.default_style)) return false;
    let n4 = e3.styles;
    if (!n4 || n4.length === 0 || n4.some((e4) => !a2(e4) || typeof e4.template != "string")) return false;
    let r3 = n4.map((e4) => e4.style_name);
    if (new Set(r3).size !== r3.length || Object.keys(e3.default_style).some((e4) => e4.trim().length === 0) || Object.values(e3.default_style).some((e4) => !r3.includes(e4))) return false;
  }
  return true;
}
function k2(e2) {
  if (!e2 || typeof e2 != "object" || Array.isArray(e2)) return false;
  let t4 = e2;
  if ("type" in t4 || ![
    "formula_inline",
    "formula_display",
    "text",
    "block"
  ].includes(String(t4.mode)) || typeof t4.body != "string" || t4.separator !== void 0 && typeof t4.separator != "string" || t4.block_template_name !== void 0 && (t4.mode !== "block" || typeof t4.block_template_name != "string")) return false;
  if (t4.table !== void 0) {
    if (t4.mode !== "block") return false;
    try {
      c2(t4);
    } catch {
      return false;
    }
  }
  return true;
}
var A2 = /* @__PURE__ */ new Set([
  "type",
  "default_language",
  "values"
]);
function j2(e2) {
  if (k2(e2)) return [e2];
  if (!e2 || typeof e2 != "object" || Array.isArray(e2)) return null;
  let t4 = e2;
  if (t4.type !== "i18n" || typeof t4.default_language != "string" || Object.keys(t4).some((e3) => !A2.has(e3)) || !t4.values || typeof t4.values != "object" || Array.isArray(t4.values)) return null;
  let n4 = t4.values;
  return !Object.prototype.hasOwnProperty.call(n4, t4.default_language) || Object.keys(n4).length === 0 || !Object.values(n4).every(k2) ? null : Object.values(n4);
}
function M2(t4) {
  let n4 = v(t4.body);
  return `${n4.variadic ? "dynamic" : "fixed"}:${n4.positional_arity}`;
}
var N2 = [
  "tag",
  "mode",
  "separator",
  "block_template_name",
  "variadic_left",
  "variadic_join",
  "variadic_right",
  "react_renderer_key"
];
var P = /* @__PURE__ */ new Set([
  "style_name",
  "tags",
  "template"
]);
function F(t4) {
  if (!u2(t4)) return false;
  for (let r3 of Object.values(t4)) {
    if (!r3 || typeof r3 != "object" || Array.isArray(r3)) return false;
    let t5 = r3;
    if (!s3(t5) || typeof t5.kind != "string" || t5.kind.length === 0 || t5.kind === "partial" || "default_style" in t5 || !Array.isArray(t5.styles) || t5.styles.length === 0) return false;
    let i4 = [];
    for (let r4 of t5.styles) {
      if (!r4 || typeof r4 != "object" || Array.isArray(r4)) return false;
      let a4 = r4, s4 = j2(a4.template);
      if (typeof a4.style_name != "string" || !d(a4.style_name) || !o3(a4.tags) || !s4 || N2.some((e2) => e2 in a4) || Object.keys(a4).some((e2) => !P.has(e2)) || new Set(s4.map(M2)).size !== 1 || s4.some((n4) => {
        let r5 = v(n4.body);
        return r5.invalid || r5.variadic !== t5.dynamic_arity;
      })) return false;
      i4.push(a4.style_name);
    }
    if (new Set(i4).size !== i4.length) return false;
  }
  return true;
}
var K = 256;
function q(e2, t4) {
  return e2.reduce((n4, r3, i4) => i4 === 0 ? r3 : `${n4}${e2[i4 - 1] !== "" && r3 !== "" ? `,${t4}` : ","}${r3}`, "");
}
var J = class {
  indentSpaces;
  inlineParenthesisDepth;
  constructor(e2 = 4, t4 = 3) {
    this.assertIntegerInRange(e2, "indentSpaces", K), this.assertIntegerInRange(t4, "inlineParenthesisDepth", 2 ** 53 - 1), this.indentSpaces = e2, this.inlineParenthesisDepth = t4;
  }
  format(e2) {
    return this.formatNode(w(e2), 0, " ");
  }
  formatTree(e2, t4 = " ") {
    return this.formatNode(e2, 0, t4);
  }
  formatNode(e2, t4, n4) {
    let r3 = this.formatNodeHead(e2);
    if (e2.children.length === 0) return r3;
    if (this.parenthesisDepth(e2) <= this.inlineParenthesisDepth) return `${r3}(${q(e2.children.map((e3) => this.formatNode(e3, 0, n4)), n4)})`;
    let i4 = " ".repeat(this.indentSpaces * (t4 + 1));
    return `${r3}(
${e2.children.map((e3) => `${i4}${this.formatNode(e3, t4 + 1, n4)}`).join(",\n")}
${" ".repeat(this.indentSpaces * t4)})`;
  }
  formatNodeHead(e2) {
    let t4 = e2.binder_explicit ? "@" : "", n4, r3 = e2.temporary_source ?? e2.macro_name;
    if (e2.temporary_format === "texttt") n4 = `\`${r3}\``;
    else switch (e2.env_mode) {
      case "text":
        n4 = `%${r3}%`;
        break;
      case "formula_inline":
        n4 = `$${r3}$`;
        break;
      case "formula_display":
        n4 = `$$${r3}$$`;
        break;
      default:
        n4 = e2.macro_name;
    }
    let i4 = this.sourceReference(e2), a4 = i4 === void 0 ? "" : `@${i4}`, o4 = e2.style_name === void 0 ? "" : `[${e2.style_name}]`;
    return `${t4}${n4}${a4}${o4}`;
  }
  sourceReference(e2) {
    if (e2.binder_explicit && e2.binder_name && e2.binder_name !== e2.macro_name) return e2.binder_name;
    if (e2.postfix?.type === "tree_path") return `#${e2.postfix.path.join(".")}`;
    if (e2.postfix?.type === "binder_name") return `#${e2.postfix.name}`;
    if (e2.postfix?.type === "name") return e2.postfix.name;
    if (!e2.mdata || typeof e2.mdata != "object") return;
    let t4 = e2.mdata.src;
    return typeof t4 == "string" ? t4 : void 0;
  }
  assertIntegerInRange(e2, t4, n4) {
    if (!Number.isSafeInteger(e2) || e2 < 0 || e2 > n4) throw RangeError(`${t4} must be a non-negative integer no greater than ${n4}`);
  }
  parenthesisDepth(e2) {
    let t4 = -1;
    for (let n4 of e2.children) t4 = Math.max(t4, this.parenthesisDepth(n4));
    return t4 + 1;
  }
};
var Y = new J(0, 2 ** 53 - 1);

// node_modules/@sjtu-ai4math/snl-basics/dist-lib/index.js
var import_react = __toESM(require_react(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);

// node_modules/@sjtu-ai4math/snl-basics/dist-lib/chunks/context-source-9vDBjOdS.js
function t3(t4) {
  let n4 = /* @__PURE__ */ new Set();
  if (!t4.trim()) return n4;
  let r3;
  try {
    r3 = w(t4);
  } catch {
    return n4;
  }
  let i4 = (e2) => {
    if (e2.kind === "binder") {
      n4.add(e2.binder_name ?? e2.temporary_source ?? e2.macro_name);
      return;
    }
    e2.children.forEach(i4);
  };
  return i4(r3), n4;
}

// lib/snl-doc.ts
import { constants as constants2, promises as fs2 } from "node:fs";
import * as path2 from "node:path";

// lib/guarded-json-file.ts
import { constants, promises as fs } from "node:fs";
import path from "node:path";
async function readCanonicalDirectoryIdentity(directory) {
  const resolved = path.resolve(directory);
  const stat = await fs.lstat(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(resolved) !== resolved) {
    throw new Error(`${resolved} must be a canonical, non-symlink directory.`);
  }
  return { dev: stat.dev, ino: stat.ino };
}
async function assertCanonicalDirectory(directory, expected) {
  const observed = await readCanonicalDirectoryIdentity(directory);
  if (expected && (observed.dev !== expected.dev || observed.ino !== expected.ino)) {
    throw new Error(`${path.resolve(directory)} changed concurrently; refusing to use a replacement directory.`);
  }
  return observed;
}
async function readRegularText(file) {
  const directory = path.dirname(file);
  const directoryIdentity = await assertCanonicalDirectory(directory);
  let handle;
  try {
    handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    await assertCanonicalDirectory(directory, directoryIdentity);
    if (!stat.isFile()) throw new Error(`${file} must be a regular, non-symlink file.`);
    return {
      text: await handle.readFile("utf8"),
      mode: stat.mode & 511,
      dev: stat.dev,
      ino: stat.ino,
      directoryDev: directoryIdentity.dev,
      directoryIno: directoryIdentity.ino
    };
  } catch (error) {
    if (error.code === "ELOOP")
      throw new Error(`${file} must be a regular, non-symlink file.`, { cause: error });
    throw error;
  } finally {
    await handle?.close();
  }
}

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
function assertCompatibleSchemaMarker(value, current, label, required = false) {
  if (!Object.hasOwn(value, "schema_version")) {
    if (required) throw new Error(`${label} must carry schema_version ${current}.`);
    return;
  }
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
    await fs2.lstat(p3);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function readJson(p3) {
  let handle;
  try {
    handle = await fs2.open(p3, constants2.O_RDONLY | constants2.O_NOFOLLOW);
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
    stat = await fs2.lstat(dir);
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
  return isRecord(config) && (config.version === "0.0.11" || config.version === "0.1.0");
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
      if (!isRecord(value) || typeof value.id !== "string" || !value.id || value.id !== value.id.trim()) {
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
  if (!isRecord(value) || value.type !== "i18n" || typeof value.default_language !== "string" || !isRecord(value.values)) {
    return false;
  }
  const values = Object.values(value.values);
  return values.length > 0 && values.every((item) => typeof item === "string") && (!required || values.some((item) => item.trim()));
}
function assertCurrentEntryPayload(value, label) {
  if (typeof value.kind !== "string" || !value.kind.trim() || value.kind !== value.kind.trim() || !isLocalizedLabel(value.title, false) || !isRecord(value.content) || !Object.hasOwn(value, "contribution_info") || !Object.hasOwn(value, "pointer")) {
    throw new Error(`${label} is not a valid schema-1 Entry payload.`);
  }
  if (value.content.snl !== void 0 && typeof value.content.snl !== "string") {
    throw new Error(`${label}#content.snl must be a string when present.`);
  }
  for (const field of ["typst", "latex", "markdown", "text"]) {
    if (value.content[field] !== void 0 && !isLocalizedLabel(value.content[field], false)) {
      throw new Error(`${label}#content.${field} must be a string or valid I18n map when present.`);
    }
  }
}
function assertThemedColoring(value, label) {
  if (!isRecord(value) || Object.hasOwn(value, "stroke") || Object.hasOwn(value, "background")) {
    throw new Error(`${label} must contain light and dark variants.`);
  }
  for (const theme of ["light", "dark"]) {
    const variant = value[theme];
    if (!isRecord(variant) || typeof variant.stroke !== "string" || !variant.stroke.trim() || typeof variant.background !== "string" || !variant.background.trim()) {
      throw new Error(`${label}.${theme} requires non-empty string stroke and background.`);
    }
  }
}
function usesEntityStorage(config) {
  if (!isRecord(config) || typeof config.version !== "string") {
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
  if (!isRecord(config.entity_storage) || config.entity_storage.version !== 1) {
    throw new Error(`config.json has unsupported entity_storage version ${JSON.stringify(config.entity_storage?.version)}.`);
  }
  return true;
}
async function assertEntityStorageTopology(workspaceRoot, config) {
  const storage = config.entity_storage;
  if (!storage || storage.version !== 1 || storage.legacy_backup_version !== "0.0.5" || storage.entry_default_package !== UNPACKAGED_PACKAGE_ID || !storage.receipt || typeof storage.receipt !== "object" || Array.isArray(storage.receipt)) {
    throw new Error(`Workspace data ${config.version} requires complete entity_storage v1 metadata and receipt.`);
  }
  for (const [name, directory] of [
    ["packages", packageManifestsDir(workspaceRoot)],
    ["entries", entryEntitiesDir(workspaceRoot)],
    ["macros", macroEntitiesDir(workspaceRoot)]
  ]) {
    try {
      const stat = await fs2.lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error(`${directory} must be a regular, non-symlink directory.`);
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`Current workspace is missing required entity directory ${name}.`);
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
    const stat = await fs2.lstat(entriesFile);
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
    const entryKindIds = new Set((config.entry_kinds ?? []).map((kind) => kind.id));
    const ids = /* @__PURE__ */ new Set();
    const entries = records.map(({ relativePath, value }) => {
      if (!isRecord(value) || value.format !== "snl-entry" || value.version !== ENTRY_STORAGE_VERSION || typeof value.package !== "string" || !isRecord(value.entry) || typeof value.entry.id !== "string" || !value.entry.id || value.entry.id !== value.entry.id.trim() || typeof value.entry.package !== "string") {
        throw new Error(`${relativePath} is not a valid SNL Entry envelope.`);
      }
      assertCompatibleSchemaMarker(
        value,
        CURRENT_ENTRY_SCHEMA_VERSION,
        `${relativePath} Entry envelope`,
        config.version === "0.1.0"
      );
      if (usesCurrentEntitySchemas(config)) {
        assertCurrentEntryPayload(value.entry, `${relativePath} Entry payload`);
        if (!entryKindIds.has(value.entry.kind)) {
          throw new Error(`${relativePath} Entry references missing Entry Kind ${JSON.stringify(value.entry.kind)}.`);
        }
      }
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
  const names = await fs2.readdir(dir);
  const out = {};
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const bare = name.replace(/\.json$/i, "");
    try {
      defineIdentity(out, bare, await readJson(path2.join(dir, name)));
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
  const macros = /* @__PURE__ */ new Map();
  const identities = /* @__PURE__ */ new Set();
  for (const { relativePath, value } of await readJsonDirectory(macroEntitiesDir(workspaceRoot), true)) {
    if (!isRecord(value) || value.format !== "snl-macro" || value.version !== MACRO_STORAGE_VERSION || typeof value.package !== "string" || !isRecord(value.macro) || typeof value.macro.name !== "string" || !value.macro.name || value.macro.name !== value.macro.name.trim()) {
      throw new Error(`${relativePath} is not a valid SNL Macro envelope.`);
    }
    assertCompatibleSchemaMarker(
      value,
      CURRENT_MACRO_SCHEMA_VERSION,
      `${relativePath} Macro envelope`,
      config.version === "0.1.0"
    );
    const macroDocument = /* @__PURE__ */ Object.create(null);
    macroDocument[value.macro.name] = value.macro;
    const currentMacro = usesCurrentEntitySchemas(config);
    if (currentMacro ? !F(macroDocument) : !p2(macroDocument)) {
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
    const packageMacros = macros.get(value.package) ?? {};
    defineIdentity(
      packageMacros,
      value.macro.name,
      withoutName
    );
    macros.set(value.package, packageMacros);
  }
  const out = {};
  for (const manifest of [...manifests.values()].sort((a4, b3) => a4.id.localeCompare(b3.id))) {
    defineIdentity(out, manifest.id, {
      version: usesCurrentEntitySchemas(config) ? "11" : "8",
      name: manifest.name,
      description: manifest.description,
      macros: macros.get(manifest.id) ?? {}
    });
  }
  return out;
}
async function readEntityPackageManifests(workspaceRoot, requireCurrentSchema = false) {
  const manifests = /* @__PURE__ */ new Map();
  const foldedIds = /* @__PURE__ */ new Set();
  for (const { relativePath, value } of await readJsonDirectory(packageManifestsDir(workspaceRoot), true)) {
    if (!isRecord(value) || value.format !== "snl-package" || value.version !== PACKAGE_STORAGE_VERSION || typeof value.id !== "string" || typeof value.name !== "string" || typeof value.description !== "string") {
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
  const resolvedDirectory = path2.resolve(directory);
  const directoryStat = await fs2.lstat(resolvedDirectory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || await fs2.realpath(resolvedDirectory) !== resolvedDirectory) {
    throw new Error(`${directory} must be a canonical real directory, not a symlink.`);
  }
  const base = path2.basename(directory);
  const names = (await fs2.readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  const rows = await Promise.all(names.map(async (name) => {
    const absolute = path2.join(directory, name);
    const text = (await readRegularText(absolute)).text;
    let value;
    try {
      value = JSON.parse(text);
    } catch (error) {
      throw new Error(`Invalid JSON in ${absolute}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    return { relativePath: `${base}/${name}`, value };
  }));
  const finalDirectoryStat = await fs2.lstat(resolvedDirectory);
  if (!finalDirectoryStat.isDirectory() || finalDirectoryStat.isSymbolicLink() || finalDirectoryStat.dev !== directoryStat.dev || finalDirectoryStat.ino !== directoryStat.ino) {
    throw new Error(`${directory} changed concurrently while its entities were read.`);
  }
  return rows;
}
function assertExpectedEntityPath(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Entity path ${actual} does not match its logical identity path ${expected}.`);
  }
}
function isRecord(value) {
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

// lib/entry-analysis.ts
var EntryAnalysisError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "EntryAnalysisError";
  }
  code;
};
function metadata(node) {
  return node.mdata && typeof node.mdata === "object" ? node.mdata : {};
}
function contextIndex(entries) {
  return new Map(entries.map((entry) => [entry.id, t3(entry.content?.snl ?? "")]));
}
function entrySourceId(node) {
  if (node.source?.type === "entry") return node.source.entry_id;
  if (node.postfix?.type === "name") return node.postfix.name;
  const legacy = metadata(node).src;
  return typeof legacy === "string" ? legacy : "";
}
function applyContextLookup(tree, index) {
  const visit = (node) => {
    const meta = metadata(node);
    const src = entrySourceId(node);
    if (src && node.kind !== "binder") {
      const declarations = index.get(src);
      if (!declarations) {
        node.kind = "fvar";
        node.source = void 0;
        node.mdata = { ...meta, srcStatus: "dangling" };
      } else if (!declarations.has(semanticName(node))) {
        node.kind = "fvar";
        node.source = void 0;
        node.mdata = { ...meta, srcStatus: "srcResolvedNoDecl" };
      } else {
        node.kind = "bvar";
        node.source = { type: "entry", entry_id: src };
        const { srcStatus: _status, ...clean } = meta;
        node.mdata = Object.keys(clean).length ? clean : null;
      }
    }
    node.children.forEach(visit);
  };
  visit(tree);
}
function countTokens(text) {
  return text.match(/[\p{Script=Han}]|[\p{L}\p{M}\p{N}]+/gu)?.length ?? 0;
}
function nodeWeight(name) {
  return 1 + 0.2 * Math.log2(1 + Math.max(0, countTokens(name) - 6));
}
function semanticName(node) {
  return node.temporary_source ?? node.binder_name ?? node.macro_name;
}
function numeric(node) {
  return node.children.length === 0 && node.env_mode !== "text" && node.env_mode !== "block" && node.kind !== "binder" && node.kind !== "bvar" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(semanticName(node).trim());
}
function analyzeStructuralIndex(root, macros, entryIds) {
  const binders = /* @__PURE__ */ new Set();
  const collect = (node) => {
    if (node.kind === "binder") binders.add(node.binder_name ?? node.temporary_source ?? node.macro_name);
    node.children.forEach(collect);
  };
  collect(root);
  let weakSemanticFreedom = 0, strongSemanticFreedom = 0, weightedTotal = 0, weightedWeakSemanticFreedom = 0, weightedStrongSemanticFreedom = 0;
  const walk = (node) => {
    if (!numeric(node)) {
      const meta = metadata(node), src = entrySourceId(node), bindRef = typeof meta.bindRef === "string" ? meta.bindRef : "", srcStatus = typeof meta.srcStatus === "string" ? meta.srcStatus : "";
      const macro = Object.hasOwn(macros, node.macro_name) ? macros[node.macro_name] : void 0;
      const catalogConstant = !src && !node.env_mode && !["fvar", "bvar", "binder"].includes(node.kind ?? "") && Boolean(macro);
      let sourced = node.kind === "binder";
      if (src) sourced = node.kind === "bvar" && !srcStatus && entryIds.has(src);
      else if (node.kind === "bvar" && node.source?.type === "tree_path") sourced = true;
      else if (node.kind === "bvar" && bindRef && binders.has(node.macro_name)) sourced = true;
      else if (!node.env_mode && node.kind !== "fvar" && node.kind !== "bvar" && macro) sourced = (macro.source?.urls ?? []).some(Boolean) || (macro.source?.entries ?? []).some((id) => entryIds.has(id));
      const weight = catalogConstant || node.kind === "binder" || node.kind === "bvar" && sourced ? 1 : nodeWeight(semanticName(node));
      weightedTotal += weight;
      if (!sourced) {
        strongSemanticFreedom++;
        weightedStrongSemanticFreedom += weight;
        if (!catalogConstant) {
          weakSemanticFreedom++;
          weightedWeakSemanticFreedom += weight;
        }
      }
    }
    node.children.forEach(walk);
  };
  walk(root);
  return { weakSemanticFreedom, strongSemanticFreedom, weightedTotal, weightedWeakSemanticFreedom, weightedStrongSemanticFreedom, structuralIndex: weightedTotal === 0 ? 1 : Math.min(1, Math.max(0, 1 - weightedStrongSemanticFreedom / weightedTotal)) };
}
async function loadEntry(root, id) {
  const [entries, macros] = await Promise.all([readEntries(root), readActiveMacros(root)]);
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) throw new EntryAnalysisError("entry.not-found", `Entry not found: ${id}`);
  return { entry, entries, macros };
}
function parseEntry(entry, macros) {
  const snl = entry.content?.snl;
  if (typeof snl !== "string" || !snl.trim()) throw new EntryAnalysisError("entry.invalid", `Entry ${entry.id} has no SNL content.`);
  const parsed = E(snl);
  if (!parsed.ok) throw new EntryAnalysisError("entry.invalid", `Entry ${entry.id} SNL parse failed: ${parsed.error}`);
  return N(
    parsed.tree,
    macros
  ).tree;
}
async function computeEntrySsi(root, id) {
  const { entry, entries, macros } = await loadEntry(root, id);
  const tree = parseEntry(entry, macros);
  applyContextLookup(tree, contextIndex(entries));
  return analyzeStructuralIndex(tree, macros, new Set(entries.map((candidate) => candidate.id)));
}

// lib/cli-args.ts
function parseArgs(argv, specs) {
  const bySpec = {};
  const shortAlias = {};
  for (const s4 of specs) {
    bySpec[s4.name] = s4;
    if (s4.short) shortAlias[s4.short] = s4.name;
  }
  const flags = {};
  const positional = [];
  for (const s4 of specs) {
    if (s4.default !== void 0) flags[s4.name] = s4.default;
  }
  let i4 = 0;
  let seenDashDash = false;
  while (i4 < argv.length) {
    const tok = argv[i4];
    if (seenDashDash) {
      positional.push(tok);
      i4++;
      continue;
    }
    if (tok === "--") {
      seenDashDash = true;
      i4++;
      continue;
    }
    if (tok.startsWith("--")) {
      const eq = tok.indexOf("=");
      const name = eq === -1 ? tok.slice(2) : tok.slice(2, eq);
      const inlineVal = eq === -1 ? void 0 : tok.slice(eq + 1);
      const spec = bySpec[name];
      if (!spec) throw new Error(`Unknown flag: --${name}`);
      if (spec.hasValue === false) {
        if (inlineVal !== void 0) {
          throw new Error(`Flag --${name} is boolean; did you mean --${name}?`);
        }
        flags[name] = true;
        i4++;
      } else {
        if (inlineVal !== void 0) {
          flags[name] = inlineVal;
          i4++;
        } else {
          const next = argv[i4 + 1];
          if (next === void 0 || next.startsWith("-")) {
            throw new Error(`Flag --${name} requires a value`);
          }
          flags[name] = next;
          i4 += 2;
        }
      }
    } else if (tok.startsWith("-") && tok.length === 2) {
      const short = tok.slice(1);
      const name = shortAlias[short];
      if (!name) throw new Error(`Unknown flag: -${short}`);
      const spec = bySpec[name];
      if (spec.hasValue === false) {
        flags[name] = true;
        i4++;
      } else {
        const next = argv[i4 + 1];
        if (next === void 0 || next.startsWith("-")) {
          throw new Error(`Flag -${short} (--${name}) requires a value`);
        }
        flags[name] = next;
        i4 += 2;
      }
    } else {
      positional.push(tok);
      i4++;
    }
  }
  return { flags, positional };
}
function formatUsage(cliName, synopsis, specs) {
  const lines = [`Usage: ${cliName} ${synopsis}`, "", "Options:"];
  for (const s4 of specs) {
    const flagStr = s4.short ? `-${s4.short}, --${s4.name}` : `    --${s4.name}`;
    const kind = s4.hasValue === false ? "" : " <value>";
    const dflt = s4.default !== void 0 ? ` (default: ${JSON.stringify(s4.default)})` : "";
    lines.push(`  ${flagStr}${kind}${dflt}`);
    if (s4.help) lines.push(`      ${s4.help}`);
  }
  return lines.join("\n");
}
var ROOT_FLAG = {
  name: "root",
  short: "r",
  hasValue: true,
  default: ".",
  help: "Path to the workspace containing .SNL_Doc/ (defaults to $PWD)."
};
var JSON_FLAG = {
  name: "json",
  hasValue: false,
  default: false,
  help: "Output JSON instead of human-readable text."
};
var HELP_FLAG = {
  name: "help",
  short: "h",
  hasValue: false,
  default: false,
  help: "Show usage and exit."
};

// src/cli/entry-ssi.ts
var SPECS = [ROOT_FLAG, JSON_FLAG, HELP_FLAG];
var usage = () => formatUsage("snl-entry-ssi", "[options] <entry-id>", SPECS);
async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), SPECS);
  } catch (error) {
    const message = error.message;
    const jsonMode = process.argv.slice(2).includes("--json");
    if (jsonMode) process.stdout.write(JSON.stringify({ status: "error", code: "invocation.invalid", message }) + "\n");
    else process.stderr.write(`${message}

${usage()}
`);
    return 2;
  }
  if (parsed.flags.help === true) {
    process.stdout.write(usage() + "\n");
    return 0;
  }
  if (parsed.positional.length !== 1) {
    const message = "Expected exactly one Entry id.";
    if (parsed.flags.json === true) process.stdout.write(JSON.stringify({ status: "error", code: "invocation.invalid", message }) + "\n");
    else process.stderr.write(`${message}

${usage()}
`);
    return 2;
  }
  try {
    const entryId = parsed.positional[0];
    const metrics = await computeEntrySsi(path3.resolve(String(parsed.flags.root)), entryId);
    const result = { status: "ok", entryId, metrics };
    process.stdout.write(parsed.flags.json === true ? JSON.stringify(result, null, 2) + "\n" : `${entryId}	SSI=${metrics.structuralIndex.toFixed(6)}	strong=${metrics.strongSemanticFreedom}	weak=${metrics.weakSemanticFreedom}
`);
    return 0;
  } catch (error) {
    const message = error.message;
    if (parsed.flags.json === true) process.stdout.write(JSON.stringify({ status: "error", code: message.startsWith("Entry not found:") ? "entry.not-found" : "entry.analysis-failed", message }) + "\n");
    else process.stderr.write(`${message}
`);
    return 2;
  }
}
process.exitCode = await main();
