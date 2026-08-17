#!/usr/bin/env node

// bin/impl/snoogle.ts
import * as path2 from "node:path";

// node_modules/fuse.js/dist/fuse.mjs
function isArray(value) {
  return !Array.isArray ? getTag(value) === "[object Array]" : Array.isArray(value);
}
function baseToString(value) {
  if (typeof value == "string") return value;
  if (typeof value === "bigint") return value.toString();
  const result = value + "";
  return result == "0" && 1 / value == -Infinity ? "-0" : result;
}
function toString(value) {
  return value == null ? "" : baseToString(value);
}
function isString(value) {
  return typeof value === "string";
}
function isNumber(value) {
  return typeof value === "number";
}
function isBoolean(value) {
  return value === true || value === false || isObjectLike(value) && getTag(value) == "[object Boolean]";
}
function isObject(value) {
  return typeof value === "object";
}
function isObjectLike(value) {
  return isObject(value) && value !== null;
}
function isDefined(value) {
  return value !== void 0 && value !== null;
}
function isBlank(value) {
  return !value.trim().length;
}
function getTag(value) {
  return value == null ? value === void 0 ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(value);
}
var INCORRECT_INDEX_TYPE = "Incorrect 'index' type";
var INVALID_DOC_INDEX = "Invalid doc index: must be a non-negative integer within the bounds of the docs array";
var LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY = (key) => `Invalid value for key ${key}`;
var PATTERN_LENGTH_TOO_LARGE = (max) => `Pattern length exceeds max of ${max}.`;
var MISSING_KEY_PROPERTY = (name) => `Missing ${name} property in key`;
var INVALID_KEY_WEIGHT_VALUE = (key) => `Property 'weight' in key '${key}' must be a positive integer`;
var FUSE_MATCH_TOKEN_SEARCH_UNSUPPORTED = "Fuse.match does not support useTokenSearch: token search requires corpus-level statistics (df, fieldCount) that a one-off string comparison does not have. Use new Fuse(...).search(...) instead.";
var hasOwn = Object.prototype.hasOwnProperty;
var KeyStore = class {
  constructor(keys) {
    this._keys = [];
    this._keyMap = {};
    let totalWeight = 0;
    keys.forEach((key) => {
      const obj = createKey(key);
      this._keys.push(obj);
      this._keyMap[obj.id] = obj;
      totalWeight += obj.weight;
    });
    this._keys.forEach((key) => {
      key.weight /= totalWeight;
    });
  }
  get(keyId) {
    return this._keyMap[keyId];
  }
  keys() {
    return this._keys;
  }
  toJSON() {
    return JSON.stringify(this._keys);
  }
};
function createKey(key) {
  let path3 = null;
  let id = null;
  let src = null;
  let weight = 1;
  let getFn = null;
  if (isString(key) || isArray(key)) {
    src = key;
    path3 = createKeyPath(key);
    id = createKeyId(key);
  } else {
    if (!hasOwn.call(key, "name")) throw new Error(MISSING_KEY_PROPERTY("name"));
    const name = key.name;
    src = name;
    if (hasOwn.call(key, "weight") && key.weight !== void 0) {
      weight = key.weight;
      if (weight <= 0) throw new Error(INVALID_KEY_WEIGHT_VALUE(createKeyId(name)));
    }
    path3 = createKeyPath(name);
    id = createKeyId(name);
    getFn = key.getFn ?? null;
  }
  return {
    path: path3,
    id,
    weight,
    src,
    getFn
  };
}
function createKeyPath(key) {
  return isArray(key) ? key : key.split(".");
}
function createKeyId(key) {
  return isArray(key) ? key.join(".") : key;
}
function get(obj, path3) {
  const list = [];
  let arr = false;
  const deepGet = (obj2, path4, index, arrayIndex) => {
    if (!isDefined(obj2)) return;
    if (!path4[index]) list.push(arrayIndex !== void 0 ? {
      v: obj2,
      i: arrayIndex
    } : obj2);
    else {
      const value = obj2[path4[index]];
      if (!isDefined(value)) return;
      if (index === path4.length - 1 && (isString(value) || isNumber(value) || isBoolean(value) || typeof value === "bigint")) list.push(arrayIndex !== void 0 ? {
        v: toString(value),
        i: arrayIndex
      } : toString(value));
      else if (isArray(value)) {
        arr = true;
        for (let i2 = 0, len = value.length; i2 < len; i2 += 1) deepGet(value[i2], path4, index + 1, i2);
      } else if (path4.length) deepGet(value, path4, index + 1, arrayIndex);
    }
  };
  deepGet(obj, isString(path3) ? path3.split(".") : path3, 0);
  return arr ? list : list[0];
}
var MatchOptions = {
  includeMatches: false,
  findAllMatches: false,
  minMatchCharLength: 1
};
var BasicOptions = {
  isCaseSensitive: false,
  ignoreDiacritics: false,
  includeScore: false,
  keys: [],
  shouldSort: true,
  sortFn: (a2, b2) => a2.score === b2.score ? a2.idx < b2.idx ? -1 : 1 : a2.score < b2.score ? -1 : 1
};
var FuzzyOptions = {
  location: 0,
  threshold: 0.6,
  distance: 100
};
var AdvancedOptions = {
  useExtendedSearch: false,
  useTokenSearch: false,
  tokenize: void 0,
  tokenMatch: "any",
  getFn: get,
  ignoreLocation: false,
  ignoreFieldNorm: false,
  fieldNormWeight: 1
};
var Config = Object.freeze({
  ...BasicOptions,
  ...MatchOptions,
  ...FuzzyOptions,
  ...AdvancedOptions
});
function isWordSeparator(code) {
  return code >= 9 && code <= 13 || code === 32 || code === 160;
}
function norm(weight = 1, mantissa = 3) {
  const cache = /* @__PURE__ */ new Map();
  const m2 = Math.pow(10, mantissa);
  return {
    get(value) {
      let numTokens = 0;
      let inWord = false;
      for (let i2 = 0; i2 < value.length; i2++) if (!isWordSeparator(value.charCodeAt(i2))) {
        if (!inWord) {
          numTokens++;
          inWord = true;
        }
      } else inWord = false;
      if (numTokens === 0) numTokens = 1;
      if (cache.has(numTokens)) return cache.get(numTokens);
      const n2 = Math.round(m2 / Math.pow(numTokens, 0.5 * weight)) / m2;
      cache.set(numTokens, n2);
      return n2;
    },
    clear() {
      cache.clear();
    }
  };
}
var FuseIndex = class {
  constructor({ getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
    this.norm = norm(fieldNormWeight, 3);
    this.getFn = getFn;
    this.isCreated = false;
    this.docs = [];
    this.keys = [];
    this._keysMap = {};
    this.setIndexRecords();
  }
  setSources(docs = []) {
    this.docs = docs;
  }
  setIndexRecords(records = []) {
    this.records = records;
  }
  setKeys(keys = []) {
    this.keys = keys;
    this._keysMap = {};
    keys.forEach((key, idx) => {
      this._keysMap[key.id] = idx;
    });
  }
  create() {
    if (this.isCreated || !this.docs.length) return;
    this.isCreated = true;
    const len = this.docs.length;
    this.records = new Array(len);
    let recordCount = 0;
    if (isString(this.docs[0])) for (let i2 = 0; i2 < len; i2++) {
      const record = this._createStringRecord(this.docs[i2], i2);
      if (record) this.records[recordCount++] = record;
    }
    else for (let i2 = 0; i2 < len; i2++) this.records[recordCount++] = this._createObjectRecord(this.docs[i2], i2);
    this.records.length = recordCount;
    this.norm.clear();
  }
  add(doc, docIndex) {
    if (!Number.isInteger(docIndex) || docIndex < 0) throw new Error(INVALID_DOC_INDEX);
    if (isString(doc)) {
      const record2 = this._createStringRecord(doc, docIndex);
      if (record2) this.records.push(record2);
      return record2;
    }
    const record = this._createObjectRecord(doc, docIndex);
    this.records.push(record);
    return record;
  }
  removeAt(idx) {
    if (!Number.isInteger(idx) || idx < 0) throw new Error(INVALID_DOC_INDEX);
    for (let i2 = 0, len = this.records.length; i2 < len; i2 += 1) if (this.records[i2].i === idx) {
      this.records.splice(i2, 1);
      break;
    }
    for (let i2 = 0, len = this.records.length; i2 < len; i2 += 1) if (this.records[i2].i > idx) this.records[i2].i -= 1;
  }
  removeAll(indices) {
    const toRemove = /* @__PURE__ */ new Set();
    for (const v2 of indices) if (Number.isInteger(v2) && v2 >= 0) toRemove.add(v2);
    if (toRemove.size === 0) return;
    this.records = this.records.filter((r2) => !toRemove.has(r2.i));
    const sorted = Array.from(toRemove).sort((a2, b2) => a2 - b2);
    for (const record of this.records) {
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const mid = lo + hi >>> 1;
        if (sorted[mid] < record.i) lo = mid + 1;
        else hi = mid;
      }
      record.i -= lo;
    }
  }
  getValueForItemAtKeyId(item, keyId) {
    return item[this._keysMap[keyId]];
  }
  size() {
    return this.records.length;
  }
  _createStringRecord(doc, docIndex) {
    if (!isDefined(doc) || isBlank(doc)) return null;
    return {
      v: doc,
      i: docIndex,
      n: this.norm.get(doc)
    };
  }
  _createObjectRecord(doc, docIndex) {
    const record = {
      i: docIndex,
      $: {}
    };
    for (let keyIndex = 0, keyLen = this.keys.length; keyIndex < keyLen; keyIndex++) {
      const key = this.keys[keyIndex];
      const value = key.getFn ? key.getFn(doc) : this.getFn(doc, key.path);
      if (!isDefined(value)) continue;
      if (isArray(value)) {
        const subRecords = [];
        for (let i2 = 0, len = value.length; i2 < len; i2 += 1) {
          const item = value[i2];
          if (!isDefined(item)) continue;
          if (isString(item)) {
            if (!isBlank(item)) {
              const subRecord = {
                v: item,
                i: i2,
                n: this.norm.get(item)
              };
              subRecords.push(subRecord);
            }
          } else if (isDefined(item.v)) {
            const text = isString(item.v) ? item.v : toString(item.v);
            if (!isBlank(text)) {
              const subRecord = {
                v: text,
                i: item.i,
                n: this.norm.get(text)
              };
              subRecords.push(subRecord);
            }
          }
        }
        record.$[keyIndex] = subRecords;
      } else if (isString(value) && !isBlank(value)) {
        const subRecord = {
          v: value,
          n: this.norm.get(value)
        };
        record.$[keyIndex] = subRecord;
      }
    }
    return record;
  }
  toJSON() {
    return {
      keys: this.keys.map(({ getFn, ...key }) => key),
      records: this.records
    };
  }
};
function createIndex(keys, docs, { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
  const myIndex = new FuseIndex({
    getFn,
    fieldNormWeight
  });
  myIndex.setKeys(keys.map(createKey));
  myIndex.setSources(docs);
  myIndex.create();
  return myIndex;
}
function parseIndex(data, { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
  const { keys, records } = data;
  const myIndex = new FuseIndex({
    getFn,
    fieldNormWeight
  });
  myIndex.setKeys(keys);
  myIndex.setIndexRecords(records);
  return myIndex;
}
function convertMaskToIndices(matchmask = [], minMatchCharLength = Config.minMatchCharLength) {
  const indices = [];
  let start = -1;
  let end = -1;
  let i2 = 0;
  for (let len = matchmask.length; i2 < len; i2 += 1) {
    const match = matchmask[i2];
    if (match && start === -1) start = i2;
    else if (!match && start !== -1) {
      end = i2 - 1;
      if (end - start + 1 >= minMatchCharLength) indices.push([start, end]);
      start = -1;
    }
  }
  if (matchmask[i2 - 1] && i2 - start >= minMatchCharLength) indices.push([start, i2 - 1]);
  return indices;
}
function search(text, pattern, patternAlphabet, { location = Config.location, distance = Config.distance, threshold = Config.threshold, findAllMatches = Config.findAllMatches, minMatchCharLength = Config.minMatchCharLength, includeMatches = Config.includeMatches, ignoreLocation = Config.ignoreLocation } = {}) {
  if (pattern.length > 32) throw new Error(PATTERN_LENGTH_TOO_LARGE(32));
  const patternLen = pattern.length;
  const textLen = text.length;
  const expectedLocation = Math.max(0, Math.min(location, textLen));
  let currentThreshold = threshold;
  let bestLocation = expectedLocation;
  const calcScore = (errors, currentLocation) => {
    const accuracy = errors / patternLen;
    if (ignoreLocation) return accuracy;
    const proximity = Math.abs(expectedLocation - currentLocation);
    if (!distance) return proximity ? 1 : accuracy;
    return accuracy + proximity / distance;
  };
  const computeMatches = minMatchCharLength > 1 || includeMatches;
  const matchMask = computeMatches ? Array(textLen) : [];
  let index;
  while ((index = text.indexOf(pattern, bestLocation)) > -1) {
    const score = calcScore(0, index);
    currentThreshold = Math.min(score, currentThreshold);
    bestLocation = index + patternLen;
    if (computeMatches) {
      let i2 = 0;
      while (i2 < patternLen) {
        matchMask[index + i2] = 1;
        i2 += 1;
      }
    }
  }
  bestLocation = -1;
  let lastBitArr = [];
  let finalScore = 1;
  let bestErrors = 0;
  let binMax = patternLen + textLen;
  const mask = 1 << patternLen - 1;
  for (let i2 = 0; i2 < patternLen; i2 += 1) {
    let binMin = 0;
    let binMid = binMax;
    while (binMin < binMid) {
      if (calcScore(i2, expectedLocation + binMid) <= currentThreshold) binMin = binMid;
      else binMax = binMid;
      binMid = Math.floor((binMax - binMin) / 2 + binMin);
    }
    binMax = binMid;
    let start = Math.max(1, expectedLocation - binMid + 1);
    const finish = findAllMatches ? textLen : Math.min(expectedLocation + binMid, textLen) + patternLen;
    const bitArr = Array(finish + 2);
    bitArr[finish + 1] = (1 << i2) - 1;
    for (let j2 = finish; j2 >= start; j2 -= 1) {
      const currentLocation = j2 - 1;
      const charMatch = patternAlphabet[text[currentLocation]];
      bitArr[j2] = (bitArr[j2 + 1] << 1 | 1) & charMatch;
      if (i2) bitArr[j2] |= (lastBitArr[j2 + 1] | lastBitArr[j2]) << 1 | 1 | lastBitArr[j2 + 1];
      if (bitArr[j2] & mask) {
        finalScore = calcScore(i2, currentLocation);
        if (finalScore <= currentThreshold) {
          currentThreshold = finalScore;
          bestLocation = currentLocation;
          bestErrors = i2;
          if (bestLocation <= expectedLocation) break;
          start = Math.max(1, 2 * expectedLocation - bestLocation);
        }
      }
    }
    if (calcScore(i2 + 1, expectedLocation) > currentThreshold) break;
    lastBitArr = bitArr;
  }
  if (computeMatches && bestLocation >= 0) {
    const matchEnd = Math.min(textLen - 1, bestLocation + patternLen - 1 + bestErrors);
    for (let k2 = bestLocation; k2 <= matchEnd; k2 += 1) if (patternAlphabet[text[k2]]) matchMask[k2] = 1;
  }
  const result = {
    isMatch: bestLocation >= 0,
    score: Math.max(1e-3, finalScore)
  };
  if (computeMatches) {
    const indices = convertMaskToIndices(matchMask, minMatchCharLength);
    if (!indices.length) result.isMatch = false;
    else if (includeMatches) result.indices = indices;
  }
  return result;
}
function createPatternAlphabet(pattern) {
  const mask = {};
  for (let i2 = 0, len = pattern.length; i2 < len; i2 += 1) {
    const char = pattern.charAt(i2);
    mask[char] = (mask[char] || 0) | 1 << len - i2 - 1;
  }
  return mask;
}
function mergeIndices(indices) {
  if (indices.length <= 1) return indices;
  indices.sort((a2, b2) => a2[0] - b2[0] || a2[1] - b2[1]);
  const merged = [indices[0]];
  for (let i2 = 1, len = indices.length; i2 < len; i2 += 1) {
    const last = merged[merged.length - 1];
    const curr = indices[i2];
    if (curr[0] <= last[1] + 1) last[1] = Math.max(last[1], curr[1]);
    else merged.push(curr);
  }
  return merged;
}
var NON_DECOMPOSABLE_MAP = {
  "\u0142": "l",
  "\u0141": "L",
  "\u0111": "d",
  "\u0110": "D",
  "\xF8": "o",
  "\xD8": "O",
  "\u0127": "h",
  "\u0126": "H",
  "\u0167": "t",
  "\u0166": "T",
  "\u0131": "i",
  "\xDF": "ss"
};
var NON_DECOMPOSABLE_RE = new RegExp("[" + Object.keys(NON_DECOMPOSABLE_MAP).join("") + "]", "g");
var stripDiacritics = typeof String.prototype.normalize === "function" ? (str) => str.normalize("NFD").replace(/[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u1885\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]/g, "").replace(NON_DECOMPOSABLE_RE, (ch) => NON_DECOMPOSABLE_MAP[ch]) : (str) => str;
var BitapSearch = class {
  constructor(pattern, { location = Config.location, threshold = Config.threshold, distance = Config.distance, includeMatches = Config.includeMatches, findAllMatches = Config.findAllMatches, minMatchCharLength = Config.minMatchCharLength, isCaseSensitive = Config.isCaseSensitive, ignoreDiacritics = Config.ignoreDiacritics, ignoreLocation = Config.ignoreLocation } = {}) {
    this.options = {
      location,
      threshold,
      distance,
      includeMatches,
      findAllMatches,
      minMatchCharLength,
      isCaseSensitive,
      ignoreDiacritics,
      ignoreLocation
    };
    pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
    pattern = ignoreDiacritics ? stripDiacritics(pattern) : pattern;
    this.pattern = pattern;
    this.chunks = [];
    if (!this.pattern.length) return;
    const addChunk = (pattern2, startIndex) => {
      this.chunks.push({
        pattern: pattern2,
        alphabet: createPatternAlphabet(pattern2),
        startIndex
      });
    };
    const len = this.pattern.length;
    if (len > 32) {
      let i2 = 0;
      const remainder = len % 32;
      const end = len - remainder;
      while (i2 < end) {
        addChunk(this.pattern.substr(i2, 32), i2);
        i2 += 32;
      }
      if (remainder) {
        const startIndex = len - 32;
        addChunk(this.pattern.substr(startIndex), startIndex);
      }
    } else addChunk(this.pattern, 0);
  }
  searchIn(text) {
    const { isCaseSensitive, ignoreDiacritics, includeMatches } = this.options;
    text = isCaseSensitive ? text : text.toLowerCase();
    text = ignoreDiacritics ? stripDiacritics(text) : text;
    if (this.pattern === text) {
      if (text.length < this.options.minMatchCharLength) return {
        isMatch: false,
        score: 1
      };
      const result2 = {
        isMatch: true,
        score: 0
      };
      if (includeMatches) result2.indices = [[0, text.length - 1]];
      return result2;
    }
    const { location, distance, threshold, findAllMatches, minMatchCharLength, ignoreLocation } = this.options;
    const allIndices = [];
    let totalScore = 0;
    let hasMatches = false;
    this.chunks.forEach(({ pattern, alphabet, startIndex }) => {
      const { isMatch, score, indices } = search(text, pattern, alphabet, {
        location: location + startIndex,
        distance,
        threshold,
        findAllMatches,
        minMatchCharLength,
        includeMatches,
        ignoreLocation
      });
      if (isMatch) hasMatches = true;
      totalScore += score;
      if (isMatch && indices) allIndices.push(...indices);
    });
    const result = {
      isMatch: hasMatches,
      score: hasMatches ? totalScore / this.chunks.length : 1
    };
    if (hasMatches && includeMatches) result.indices = mergeIndices(allIndices);
    return result;
  }
};
var MULTI_MATCH_TYPES = /* @__PURE__ */ new Set(["fuzzy", "include"]);
function isInverse(type) {
  return type.startsWith("inverse");
}
var matchers = [
  {
    type: "exact",
    multiRegex: /^="(.*)"$/,
    singleRegex: /^=(.*)$/,
    create: (pattern) => ({
      type: "exact",
      search(text) {
        const isMatch = text === pattern;
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, pattern.length - 1]
        };
      }
    })
  },
  {
    type: "include",
    multiRegex: /^'"(.*)"$/,
    singleRegex: /^'(.*)$/,
    create: (pattern) => ({
      type: "include",
      search(text) {
        let location = 0;
        let index;
        const indices = [];
        const patternLen = pattern.length;
        while ((index = text.indexOf(pattern, location)) > -1) {
          location = index + patternLen;
          indices.push([index, location - 1]);
        }
        const isMatch = !!indices.length;
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices
        };
      }
    })
  },
  {
    type: "prefix-exact",
    multiRegex: /^\^"(.*)"$/,
    singleRegex: /^\^(.*)$/,
    create: (pattern) => ({
      type: "prefix-exact",
      search(text) {
        const isMatch = text.startsWith(pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, pattern.length - 1]
        };
      }
    })
  },
  {
    type: "inverse-prefix-exact",
    multiRegex: /^!\^"(.*)"$/,
    singleRegex: /^!\^(.*)$/,
    create: (pattern) => ({
      type: "inverse-prefix-exact",
      search(text) {
        const isMatch = !text.startsWith(pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, text.length - 1]
        };
      }
    })
  },
  {
    type: "inverse-suffix-exact",
    multiRegex: /^!"(.*)"\$$/,
    singleRegex: /^!(.*)\$$/,
    create: (pattern) => ({
      type: "inverse-suffix-exact",
      search(text) {
        const isMatch = !text.endsWith(pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, text.length - 1]
        };
      }
    })
  },
  {
    type: "suffix-exact",
    multiRegex: /^"(.*)"\$$/,
    singleRegex: /^(.*)\$$/,
    create: (pattern) => ({
      type: "suffix-exact",
      search(text) {
        const isMatch = text.endsWith(pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [text.length - pattern.length, text.length - 1]
        };
      }
    })
  },
  {
    type: "inverse-exact",
    multiRegex: /^!"(.*)"$/,
    singleRegex: /^!(.*)$/,
    create: (pattern) => ({
      type: "inverse-exact",
      search(text) {
        const isMatch = text.indexOf(pattern) === -1;
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, text.length - 1]
        };
      }
    })
  },
  {
    type: "fuzzy",
    multiRegex: /^"(.*)"$/,
    singleRegex: /^(.*)$/,
    create: (pattern, options = {}) => {
      const bitap = new BitapSearch(pattern, {
        location: options.location ?? Config.location,
        threshold: options.threshold ?? Config.threshold,
        distance: options.distance ?? Config.distance,
        includeMatches: options.includeMatches ?? Config.includeMatches,
        findAllMatches: options.findAllMatches ?? Config.findAllMatches,
        minMatchCharLength: options.minMatchCharLength ?? Config.minMatchCharLength,
        isCaseSensitive: options.isCaseSensitive ?? Config.isCaseSensitive,
        ignoreDiacritics: options.ignoreDiacritics ?? Config.ignoreDiacritics,
        ignoreLocation: options.ignoreLocation ?? Config.ignoreLocation
      });
      return {
        type: "fuzzy",
        search(text) {
          return bitap.searchIn(text);
        }
      };
    }
  }
];
var matchersLen = matchers.length;
var ESCAPED_PIPE = "\0";
var OR_TOKEN = "|";
function tokenize(pattern) {
  const tokens = [];
  const len = pattern.length;
  let i2 = 0;
  while (i2 < len) {
    while (i2 < len && pattern[i2] === " ") i2++;
    if (i2 >= len) break;
    let j2 = i2;
    while (j2 < len && pattern[j2] !== " " && pattern[j2] !== '"') j2++;
    if (j2 < len && pattern[j2] === '"') {
      j2++;
      while (j2 < len) {
        if (pattern[j2] === '"') {
          const next = j2 + 1;
          if (next >= len || pattern[next] === " ") {
            j2++;
            break;
          }
          if (pattern[next] === "$" && (next + 1 >= len || pattern[next + 1] === " ")) {
            j2 += 2;
            break;
          }
        }
        j2++;
      }
      tokens.push(pattern.substring(i2, j2));
      i2 = j2;
    } else {
      while (j2 < len && pattern[j2] !== " ") j2++;
      tokens.push(pattern.substring(i2, j2));
      i2 = j2;
    }
  }
  return tokens;
}
function getMatch(pattern, exp) {
  const matches = pattern.match(exp);
  return matches ? matches[1] : null;
}
function parseQuery(pattern, options = {}) {
  return pattern.replace(/\\\|/g, ESCAPED_PIPE).split(OR_TOKEN).map((item) => {
    const query = tokenize(item.replace(/\u0000/g, "|").trim()).filter((item2) => item2 && !!item2.trim());
    const results = [];
    for (let i2 = 0, len = query.length; i2 < len; i2 += 1) {
      const queryItem = query[i2];
      let found = false;
      let idx = -1;
      while (!found && ++idx < matchersLen) {
        const def = matchers[idx];
        const token = getMatch(queryItem, def.multiRegex);
        if (token) {
          results.push(def.create(token, options));
          found = true;
        }
      }
      if (found) continue;
      idx = -1;
      while (++idx < matchersLen) {
        const def = matchers[idx];
        const token = getMatch(queryItem, def.singleRegex);
        if (token) {
          results.push(def.create(token, options));
          break;
        }
      }
    }
    return results;
  });
}
var ExtendedSearch = class {
  constructor(pattern, { isCaseSensitive = Config.isCaseSensitive, ignoreDiacritics = Config.ignoreDiacritics, includeMatches = Config.includeMatches, minMatchCharLength = Config.minMatchCharLength, ignoreLocation = Config.ignoreLocation, findAllMatches = Config.findAllMatches, location = Config.location, threshold = Config.threshold, distance = Config.distance } = {}) {
    this.query = null;
    this.options = {
      isCaseSensitive,
      ignoreDiacritics,
      includeMatches,
      minMatchCharLength,
      findAllMatches,
      ignoreLocation,
      location,
      threshold,
      distance
    };
    pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
    pattern = ignoreDiacritics ? stripDiacritics(pattern) : pattern;
    this.pattern = pattern;
    this.query = parseQuery(this.pattern, this.options);
  }
  static condition(_2, options) {
    return options.useExtendedSearch;
  }
  searchIn(text) {
    const query = this.query;
    if (!query) return {
      isMatch: false,
      score: 1
    };
    const { includeMatches, isCaseSensitive, ignoreDiacritics } = this.options;
    text = isCaseSensitive ? text : text.toLowerCase();
    text = ignoreDiacritics ? stripDiacritics(text) : text;
    let numMatches = 0;
    const allIndices = [];
    let totalScore = 0;
    let hasInverse = false;
    for (let i2 = 0, qLen = query.length; i2 < qLen; i2 += 1) {
      const searchers = query[i2];
      allIndices.length = 0;
      numMatches = 0;
      hasInverse = false;
      for (let j2 = 0, pLen = searchers.length; j2 < pLen; j2 += 1) {
        const matcher = searchers[j2];
        const { isMatch, indices, score } = matcher.search(text);
        if (isMatch) {
          numMatches += 1;
          totalScore += score;
          if (isInverse(matcher.type)) hasInverse = true;
          if (includeMatches) if (MULTI_MATCH_TYPES.has(matcher.type)) allIndices.push(...indices);
          else allIndices.push(indices);
        } else {
          totalScore = 0;
          numMatches = 0;
          allIndices.length = 0;
          hasInverse = false;
          break;
        }
      }
      if (numMatches) {
        const result = {
          isMatch: true,
          score: totalScore / numMatches
        };
        if (hasInverse) result.hasInverse = true;
        if (includeMatches) result.indices = mergeIndices(allIndices);
        return result;
      }
    }
    return {
      isMatch: false,
      score: 1
    };
  }
};
var registeredSearchers = [];
function register(...args) {
  registeredSearchers.push(...args);
}
function createSearcher(pattern, options) {
  for (let i2 = 0, len = registeredSearchers.length; i2 < len; i2 += 1) {
    const searcherClass = registeredSearchers[i2];
    if (searcherClass.condition(pattern, options)) return new searcherClass(pattern, options);
  }
  return new BitapSearch(pattern, options);
}
var LogicalOperator = {
  AND: "$and",
  OR: "$or"
};
var KeyType = {
  PATH: "$path",
  PATTERN: "$val"
};
var isExpression = (query) => !!(query[LogicalOperator.AND] || query[LogicalOperator.OR]);
var isPath = (query) => !!query[KeyType.PATH];
var isLeaf = (query) => !isArray(query) && isObject(query) && !isExpression(query);
var convertToExplicit = (query) => ({ [LogicalOperator.AND]: Object.keys(query).map((key) => ({ [key]: query[key] })) });
function parse(query, options, { auto = true } = {}) {
  const next = (query2) => {
    if (isString(query2)) {
      const obj = {
        keyId: null,
        pattern: query2
      };
      if (auto) obj.searcher = createSearcher(query2, options);
      return obj;
    }
    const keys = Object.keys(query2);
    const isQueryPath = isPath(query2);
    if (!isQueryPath && keys.length > 1 && !isExpression(query2)) return next(convertToExplicit(query2));
    if (isLeaf(query2)) {
      const key = isQueryPath ? query2[KeyType.PATH] : keys[0];
      const pattern = isQueryPath ? query2[KeyType.PATTERN] : query2[key];
      if (!isString(pattern)) throw new Error(LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY(key));
      const obj = {
        keyId: createKeyId(key),
        pattern
      };
      if (auto) obj.searcher = createSearcher(pattern, options);
      return obj;
    }
    const node = {
      children: [],
      operator: keys[0]
    };
    keys.forEach((key) => {
      const value = query2[key];
      if (isArray(value)) value.forEach((item) => {
        node.children.push(next(item));
      });
    });
    return node;
  };
  if (!isExpression(query)) query = convertToExplicit(query);
  return next(query);
}
function computeScoreSingle(matches, { ignoreFieldNorm = Config.ignoreFieldNorm }) {
  let totalScore = 1;
  matches.forEach(({ key, norm: norm2, score }) => {
    const weight = key ? key.weight : null;
    totalScore *= Math.pow(score === 0 && weight ? Number.EPSILON : score, (weight || 1) * (ignoreFieldNorm ? 1 : norm2));
  });
  return totalScore;
}
function computeScore(results, { ignoreFieldNorm = Config.ignoreFieldNorm }) {
  results.forEach((result) => {
    result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
  });
}
var MaxHeap = class {
  constructor(limit, comparator) {
    this.limit = limit;
    this.heap = [];
    this.comparator = comparator;
  }
  get size() {
    return this.heap.length;
  }
  insert(item) {
    if (this.size < this.limit) {
      this.heap.push(item);
      this._bubbleUp(this.size - 1);
    } else if (this.comparator(item, this.heap[0]) < 0) {
      this.heap[0] = item;
      this._sinkDown(0);
    }
  }
  extractSorted() {
    return this.heap.sort(this.comparator);
  }
  _bubbleUp(i2) {
    const heap = this.heap;
    while (i2 > 0) {
      const parent = i2 - 1 >> 1;
      if (this.comparator(heap[i2], heap[parent]) <= 0) break;
      const tmp = heap[i2];
      heap[i2] = heap[parent];
      heap[parent] = tmp;
      i2 = parent;
    }
  }
  _sinkDown(i2) {
    const heap = this.heap;
    const len = heap.length;
    let largest = i2;
    do {
      i2 = largest;
      const left = 2 * i2 + 1;
      const right = 2 * i2 + 2;
      if (left < len && this.comparator(heap[left], heap[largest]) > 0) largest = left;
      if (right < len && this.comparator(heap[right], heap[largest]) > 0) largest = right;
      if (largest !== i2) {
        const tmp = heap[i2];
        heap[i2] = heap[largest];
        heap[largest] = tmp;
      }
    } while (largest !== i2);
  }
};
function formatMatches(result) {
  const matches = [];
  result.matches.forEach((match) => {
    if (!isDefined(match.indices) || !match.indices.length) return;
    const obj = {
      indices: match.indices,
      value: match.value
    };
    if (match.key) obj.key = match.key.id;
    if (match.idx > -1) obj.refIndex = match.idx;
    matches.push(obj);
  });
  return matches;
}
function format(results, docs, { includeMatches = Config.includeMatches, includeScore = Config.includeScore } = {}) {
  return results.map((result) => {
    const { idx } = result;
    const data = {
      item: docs[idx],
      refIndex: idx
    };
    if (includeMatches) data.matches = formatMatches(result);
    if (includeScore) data.score = result.score;
    return data;
  });
}
var DEFAULT_TOKEN = /[\p{L}\p{M}\p{N}_]+/gu;
var warned = /* @__PURE__ */ new WeakSet();
function warnNonGlobal(regex) {
  if (!warned.has(regex)) {
    warned.add(regex);
    console.warn(`[Fuse] tokenize regex ${regex} lacks the global flag; only the first match per text will be returned. Add the 'g' flag.`);
  }
}
function resolveTokenize(tokenize2) {
  if (typeof tokenize2 === "function") {
    let validated = false;
    return (text) => {
      const result = tokenize2(text);
      if (!validated) {
        validated = true;
        if (!Array.isArray(result) || result.some((t2) => typeof t2 !== "string")) throw new Error(`[Fuse] tokenize function must return string[]; received ${Array.isArray(result) ? "array containing non-strings" : typeof result}.`);
      }
      return result;
    };
  }
  if (tokenize2 instanceof RegExp) {
    if (!tokenize2.global) warnNonGlobal(tokenize2);
    return (text) => text.match(tokenize2) || [];
  }
  return (text) => text.match(DEFAULT_TOKEN) || [];
}
function createAnalyzer({ isCaseSensitive = false, ignoreDiacritics = false, tokenize: tokenize2 } = {}) {
  const tokenizeFn = resolveTokenize(tokenize2);
  return { tokenize(text) {
    if (!isCaseSensitive) text = text.toLowerCase();
    if (ignoreDiacritics) text = stripDiacritics(text);
    return tokenizeFn(text);
  } };
}
var TokenSearch = class {
  static condition(_2, options) {
    return options.useTokenSearch;
  }
  constructor(pattern, options) {
    this.options = options;
    this.analyzer = createAnalyzer({
      isCaseSensitive: options.isCaseSensitive,
      ignoreDiacritics: options.ignoreDiacritics,
      tokenize: options.tokenize
    });
    const queryTerms = this.analyzer.tokenize(pattern);
    const { df, fieldCount } = options._invertedIndex;
    this.termSearchers = [];
    this.idfWeights = [];
    for (const term of queryTerms) {
      this.termSearchers.push(new BitapSearch(term, {
        location: options.location,
        threshold: options.threshold,
        distance: options.distance,
        includeMatches: options.includeMatches,
        findAllMatches: options.findAllMatches,
        minMatchCharLength: options.minMatchCharLength,
        isCaseSensitive: options.isCaseSensitive,
        ignoreDiacritics: options.ignoreDiacritics,
        ignoreLocation: true
      }));
      const docFreq = df.get(term) || 0;
      const idf = Math.log(1 + (fieldCount - docFreq + 0.5) / (docFreq + 0.5));
      this.idfWeights.push(idf);
    }
    this.combineAll = options.tokenMatch === "all";
    this.numTerms = this.termSearchers.length;
    this.useMask = this.numTerms <= 31;
  }
  searchIn(text) {
    if (!this.termSearchers.length) return {
      isMatch: false,
      score: 1
    };
    const allIndices = [];
    let weightedScore = 0;
    let maxPossibleScore = 0;
    let matchedCount = 0;
    let matchedMask = 0;
    const matchedTerms = this.combineAll && !this.useMask ? /* @__PURE__ */ new Set() : null;
    for (let i2 = 0; i2 < this.termSearchers.length; i2++) {
      const result = this.termSearchers[i2].searchIn(text);
      const idf = this.idfWeights[i2];
      maxPossibleScore += idf;
      if (result.isMatch) {
        matchedCount++;
        weightedScore += idf * (1 - result.score);
        if (result.indices) allIndices.push(...result.indices);
        if (this.combineAll) if (this.useMask) matchedMask |= 1 << i2;
        else matchedTerms.add(i2);
      }
    }
    if (matchedCount === 0) return {
      isMatch: false,
      score: 1
    };
    const normalized = maxPossibleScore > 0 ? 1 - weightedScore / maxPossibleScore : 0;
    const searchResult = {
      isMatch: true,
      score: Math.max(1e-3, normalized)
    };
    if (this.options.includeMatches && allIndices.length) searchResult.indices = mergeIndices(allIndices);
    if (this.combineAll) {
      if (this.useMask) searchResult.matchedMask = matchedMask;
      else searchResult.matchedTerms = matchedTerms;
      searchResult.termCount = this.numTerms;
    }
    return searchResult;
  }
};
function addField(index, text, docIdx, analyzer) {
  const tokens = analyzer.tokenize(text);
  if (!tokens.length) return;
  index.fieldCount++;
  index.docFieldCount.set(docIdx, (index.docFieldCount.get(docIdx) || 0) + 1);
  const distinctTerms = new Set(tokens);
  let perDocTerms = index.docTermFieldHits.get(docIdx);
  if (!perDocTerms) {
    perDocTerms = /* @__PURE__ */ new Map();
    index.docTermFieldHits.set(docIdx, perDocTerms);
  }
  for (const term of distinctTerms) {
    perDocTerms.set(term, (perDocTerms.get(term) || 0) + 1);
    index.df.set(term, (index.df.get(term) || 0) + 1);
  }
}
function ingestRecord(index, record, keyCount, analyzer) {
  const { i: docIdx, v: v2, $: fields } = record;
  if (v2 !== void 0) {
    addField(index, v2, docIdx, analyzer);
    return;
  }
  if (!fields) return;
  for (let keyIdx = 0; keyIdx < keyCount; keyIdx++) {
    const value = fields[keyIdx];
    if (!value) continue;
    if (Array.isArray(value)) for (const sub of value) addField(index, sub.v, docIdx, analyzer);
    else addField(index, value.v, docIdx, analyzer);
  }
}
function buildInvertedIndex(records, keyCount, analyzer) {
  const index = {
    fieldCount: 0,
    df: /* @__PURE__ */ new Map(),
    docFieldCount: /* @__PURE__ */ new Map(),
    docTermFieldHits: /* @__PURE__ */ new Map()
  };
  for (const record of records) ingestRecord(index, record, keyCount, analyzer);
  return index;
}
function addToInvertedIndex(index, record, keyCount, analyzer) {
  ingestRecord(index, record, keyCount, analyzer);
}
function removeFromInvertedIndex(index, docIdx) {
  const fieldCount = index.docFieldCount.get(docIdx);
  if (fieldCount === void 0) return;
  index.fieldCount -= fieldCount;
  index.docFieldCount.delete(docIdx);
  const perDocTerms = index.docTermFieldHits.get(docIdx);
  if (!perDocTerms) return;
  for (const [term, hits] of perDocTerms) {
    const next = (index.df.get(term) || 0) - hits;
    if (next <= 0) index.df.delete(term);
    else index.df.set(term, next);
  }
  index.docTermFieldHits.delete(docIdx);
}
function removeAndShiftInvertedIndex(index, removedIndices) {
  if (removedIndices.length === 0) return;
  const sorted = Array.from(new Set(removedIndices)).sort((a2, b2) => a2 - b2);
  for (const idx of sorted) removeFromInvertedIndex(index, idx);
  const shift = (oldIdx) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = lo + hi >>> 1;
      if (sorted[mid] < oldIdx) lo = mid + 1;
      else hi = mid;
    }
    return oldIdx - lo;
  };
  const firstRemoved = sorted[0];
  const shiftedDocFieldCount = /* @__PURE__ */ new Map();
  for (const [oldKey, count] of index.docFieldCount) shiftedDocFieldCount.set(oldKey > firstRemoved ? shift(oldKey) : oldKey, count);
  index.docFieldCount = shiftedDocFieldCount;
  const shiftedDocTermFieldHits = /* @__PURE__ */ new Map();
  for (const [oldKey, terms] of index.docTermFieldHits) shiftedDocTermFieldHits.set(oldKey > firstRemoved ? shift(oldKey) : oldKey, terms);
  index.docTermFieldHits = shiftedDocTermFieldHits;
}
var Fuse = class {
  constructor(docs, options, index) {
    this.options = {
      ...Config,
      ...options
    };
    if (this.options.useExtendedSearch && false) ;
    if (this.options.useTokenSearch && false) ;
    this._keyStore = new KeyStore(this.options.keys);
    this._docs = docs;
    this._myIndex = null;
    this._invertedIndex = null;
    this.setCollection(docs, index);
    this._lastQuery = null;
    this._lastSearcher = null;
  }
  _getSearcher(query) {
    if (this._lastQuery === query) return this._lastSearcher;
    const searcher = createSearcher(query, this._invertedIndex ? {
      ...this.options,
      _invertedIndex: this._invertedIndex
    } : this.options);
    this._lastQuery = query;
    this._lastSearcher = searcher;
    return searcher;
  }
  setCollection(docs, index) {
    this._docs = docs;
    if (index && !(index instanceof FuseIndex)) throw new Error(INCORRECT_INDEX_TYPE);
    this._myIndex = index || createIndex(this.options.keys, this._docs, {
      getFn: this.options.getFn,
      fieldNormWeight: this.options.fieldNormWeight
    });
    if (this.options.useTokenSearch) {
      const analyzer = createAnalyzer({
        isCaseSensitive: this.options.isCaseSensitive,
        ignoreDiacritics: this.options.ignoreDiacritics,
        tokenize: this.options.tokenize
      });
      this._invertedIndex = buildInvertedIndex(this._myIndex.records, this._myIndex.keys.length, analyzer);
    }
    this._invalidateSearcherCache();
  }
  add(doc) {
    if (!isDefined(doc)) return;
    this._docs.push(doc);
    const record = this._myIndex.add(doc, this._docs.length - 1);
    if (this._invertedIndex && record) {
      const analyzer = createAnalyzer({
        isCaseSensitive: this.options.isCaseSensitive,
        ignoreDiacritics: this.options.ignoreDiacritics,
        tokenize: this.options.tokenize
      });
      addToInvertedIndex(this._invertedIndex, record, this._myIndex.keys.length, analyzer);
    }
    this._invalidateSearcherCache();
  }
  remove(predicate = () => false) {
    const results = [];
    const indicesToRemove = [];
    for (let i2 = 0, len = this._docs.length; i2 < len; i2 += 1) if (predicate(this._docs[i2], i2)) {
      results.push(this._docs[i2]);
      indicesToRemove.push(i2);
    }
    if (indicesToRemove.length) {
      if (this._invertedIndex) removeAndShiftInvertedIndex(this._invertedIndex, indicesToRemove);
      const toRemove = new Set(indicesToRemove);
      this._docs = this._docs.filter((_2, i2) => !toRemove.has(i2));
      this._myIndex.removeAll(indicesToRemove);
      this._invalidateSearcherCache();
    }
    return results;
  }
  removeAt(idx) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= this._docs.length) throw new Error(INVALID_DOC_INDEX);
    if (this._invertedIndex) removeAndShiftInvertedIndex(this._invertedIndex, [idx]);
    const doc = this._docs.splice(idx, 1)[0];
    this._myIndex.removeAt(idx);
    this._invalidateSearcherCache();
    return doc;
  }
  _invalidateSearcherCache() {
    this._lastQuery = null;
    this._lastSearcher = null;
  }
  getIndex() {
    return this._myIndex;
  }
  _normalizedKeys() {
    return this._myIndex.keys.map((key) => this._keyStore.get(key.id) || key);
  }
  search(query, options) {
    const { limit = -1 } = options || {};
    const { includeMatches, includeScore, shouldSort, sortFn, ignoreFieldNorm } = this.options;
    if (isString(query) && !query.trim()) {
      let docs = this._docs.map((item, idx) => ({
        item,
        refIndex: idx
      }));
      if (isNumber(limit) && limit > -1) docs = docs.slice(0, limit);
      return docs;
    }
    const useHeap = shouldSort && isNumber(limit) && limit > 0 && isString(query);
    const comparator = sortFn;
    const stable = (a2, b2) => comparator(a2, b2) || a2.idx - b2.idx;
    let results;
    if (useHeap) {
      const heap = new MaxHeap(limit, stable);
      if (isString(this._docs[0])) this._searchStringList(query, {
        heap,
        ignoreFieldNorm
      });
      else this._searchObjectList(query, {
        heap,
        ignoreFieldNorm
      });
      results = heap.extractSorted();
    } else {
      results = isString(query) ? isString(this._docs[0]) ? this._searchStringList(query) : this._searchObjectList(query) : this._searchLogical(query);
      computeScore(results, { ignoreFieldNorm });
      if (shouldSort) results.sort(isString(query) ? stable : comparator);
      if (isNumber(limit) && limit > -1) results = results.slice(0, limit);
    }
    return format(results, this._docs, {
      includeMatches,
      includeScore
    });
  }
  _searchStringList(query, { heap, ignoreFieldNorm } = {}) {
    const searcher = this._getSearcher(query);
    const requireAllTokens = this.options.useTokenSearch && this.options.tokenMatch === "all";
    const { records } = this._myIndex;
    const results = heap ? null : [];
    records.forEach(({ v: text, i: idx, n: norm2 }) => {
      if (!isDefined(text)) return;
      const searchResult = searcher.searchIn(text);
      if (searchResult.isMatch) {
        const match = {
          score: searchResult.score,
          value: text,
          norm: norm2,
          indices: searchResult.indices
        };
        if (requireAllTokens) {
          match.matchedMask = searchResult.matchedMask;
          match.matchedTerms = searchResult.matchedTerms;
          match.termCount = searchResult.termCount;
        }
        const matches = [match];
        if (!requireAllTokens || this._coversAllTokens(matches)) {
          const result = {
            item: text,
            idx,
            matches
          };
          if (heap) {
            result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
            heap.insert(result);
          } else results.push(result);
        }
      }
    });
    return results;
  }
  _searchLogical(query) {
    const expression = parse(query, this.options);
    const keys = this._normalizedKeys();
    const evaluate = (node, item, idx) => {
      if (!("children" in node)) {
        const { keyId, searcher } = node;
        let matches;
        if (keyId === null) {
          matches = [];
          keys.forEach((key, keyIndex) => {
            matches.push(...this._findMatches({
              key,
              value: item[keyIndex],
              searcher
            }));
          });
        } else matches = this._findMatches({
          key: this._keyStore.get(keyId),
          value: this._myIndex.getValueForItemAtKeyId(item, keyId),
          searcher
        });
        if (matches && matches.length) return [{
          idx,
          item,
          matches
        }];
        return [];
      }
      const { children, operator } = node;
      const res = [];
      for (let i2 = 0, len = children.length; i2 < len; i2 += 1) {
        const child = children[i2];
        const result = evaluate(child, item, idx);
        if (result.length) res.push(...result);
        else if (operator === LogicalOperator.AND) return [];
      }
      return res;
    };
    const records = this._myIndex.records;
    const resultMap = /* @__PURE__ */ new Map();
    const results = [];
    records.forEach(({ $: item, i: idx }) => {
      if (isDefined(item)) {
        const expResults = evaluate(expression, item, idx);
        if (expResults.length) {
          if (!resultMap.has(idx)) {
            resultMap.set(idx, {
              idx,
              item,
              matches: []
            });
            results.push(resultMap.get(idx));
          }
          expResults.forEach(({ matches }) => {
            resultMap.get(idx).matches.push(...matches);
          });
        }
      }
    });
    return results;
  }
  _searchObjectList(query, { heap, ignoreFieldNorm } = {}) {
    const searcher = this._getSearcher(query);
    const requireAllTokens = this.options.useTokenSearch && this.options.tokenMatch === "all";
    const { records } = this._myIndex;
    const keys = this._normalizedKeys();
    const results = heap ? null : [];
    records.forEach(({ $: item, i: idx }) => {
      if (!isDefined(item)) return;
      const matches = [];
      let anyKeyFailed = false;
      let hasInverse = false;
      keys.forEach((key, keyIndex) => {
        const keyMatches = this._findMatches({
          key,
          value: item[keyIndex],
          searcher
        });
        if (keyMatches.length) {
          matches.push(...keyMatches);
          if (keyMatches[0].hasInverse) hasInverse = true;
        } else anyKeyFailed = true;
      });
      if (hasInverse && anyKeyFailed) return;
      if (matches.length && (!requireAllTokens || this._coversAllTokens(matches))) {
        const result = {
          idx,
          item,
          matches
        };
        if (heap) {
          result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
          heap.insert(result);
        } else results.push(result);
      }
    });
    return results;
  }
  _findMatches({ key, value, searcher }) {
    if (!isDefined(value)) return [];
    const matches = [];
    if (isArray(value)) value.forEach(({ v: text, i: idx, n: norm2 }) => {
      if (!isDefined(text)) return;
      const searchResult = searcher.searchIn(text);
      if (searchResult.isMatch) {
        const match = {
          score: searchResult.score,
          key,
          value: text,
          idx,
          norm: norm2,
          indices: searchResult.indices,
          hasInverse: searchResult.hasInverse
        };
        if (searchResult.termCount !== void 0) {
          match.matchedMask = searchResult.matchedMask;
          match.matchedTerms = searchResult.matchedTerms;
          match.termCount = searchResult.termCount;
        }
        matches.push(match);
      }
    });
    else {
      const { v: text, n: norm2 } = value;
      const searchResult = searcher.searchIn(text);
      if (searchResult.isMatch) {
        const match = {
          score: searchResult.score,
          key,
          value: text,
          norm: norm2,
          indices: searchResult.indices,
          hasInverse: searchResult.hasInverse
        };
        if (searchResult.termCount !== void 0) {
          match.matchedMask = searchResult.matchedMask;
          match.matchedTerms = searchResult.matchedTerms;
          match.termCount = searchResult.termCount;
        }
        matches.push(match);
      }
    }
    return matches;
  }
  _coversAllTokens(matches) {
    const termCount = matches.length ? matches[0].termCount : void 0;
    if (termCount === void 0) return true;
    if (termCount <= 31) {
      let coverage2 = 0;
      for (let i2 = 0; i2 < matches.length; i2++) coverage2 |= matches[i2].matchedMask || 0;
      return coverage2 === 2 ** termCount - 1;
    }
    const coverage = /* @__PURE__ */ new Set();
    for (let i2 = 0; i2 < matches.length; i2++) {
      const terms = matches[i2].matchedTerms;
      if (terms) for (const t2 of terms) coverage.add(t2);
    }
    return coverage.size === termCount;
  }
};
Fuse.version = "7.5.0";
Fuse.createIndex = createIndex;
Fuse.parseIndex = parseIndex;
Fuse.config = Config;
Fuse.match = function(pattern, text, options) {
  if (options && options.useTokenSearch) throw new Error(FUSE_MATCH_TOKEN_SEARCH_UNSUPPORTED);
  return createSearcher(pattern, {
    ...Config,
    ...options
  }).searchIn(text);
};
Fuse.parseQuery = parse;
register(ExtendedSearch);
register(TokenSearch);
Fuse.use = function(...plugins) {
  plugins.forEach((plugin) => register(plugin));
};
var entry_default = Fuse;

// lib/snl-doc.ts
import { constants, promises as fs } from "node:fs";
import * as path from "node:path";

// node_modules/@sjtu-ai4math/snl-basics/dist-lib/chunks/semantic-resolver-BQc3L6kb.js
function t(e, t2) {
  return {
    macro_name: e,
    kind: t2?.kind ?? "",
    mdata: t2?.mdata ?? null,
    children: t2?.children ?? []
  };
}
function n() {
  return t("");
}
var o = /^[A-Za-z0-9_\\]$/;
var s = /^[A-Za-z0-9_.-]$/;
var c = /[\p{White_Space}\p{Cc}\p{Cf}\p{Cs}]/u;
function l(e, t2) {
  let n2 = e.codePointAt(t2);
  return n2 === void 0 ? null : String.fromCodePoint(n2);
}
function u(e, t2, n2) {
  let r2 = l(e, t2);
  return r2 === null ? 0 : r2.codePointAt(0) <= 127 ? +!!(n2 ? o : s).test(r2) : c.test(r2) ? 0 : r2.length;
}
function d(e) {
  if (e.length === 0) return false;
  let t2 = 0, n2 = u(e, t2, true);
  if (n2 === 0) return false;
  for (t2 += n2; t2 < e.length; ) {
    if (n2 = u(e, t2, false), n2 === 0) return false;
    t2 += n2;
  }
  return true;
}
function p(e) {
  let t2 = e.replace(/\\#/g, "ESCAPED_HASH"), n2 = -1;
  for (let e2 of t2.matchAll(/#(\d{1,2})(?!\d)/g)) n2 = Math.max(n2, Number(e2[1]));
  return {
    positional_arity: n2 + 1,
    variadic: /#\*/.test(t2),
    invalid: /#\d{3,}/.test(t2)
  };
}
var h = class extends Error {
  position;
  constructor(e, t2) {
    super(`${e} at position ${t2}`), this.name = "SnlSyntaxTreeParseError", this.position = t2;
  }
};
function g(e, t2) {
  let n2 = e.length - t2;
  if (n2 >= 2 && e[t2] === "`") {
    let n3 = e.indexOf("`", t2 + 1);
    if (n3 < 0) throw new h("Unclosed ` delimiter", t2);
    return {
      token: {
        type: "BACKTICK_DELIMITED",
        value: e.slice(t2 + 1, n3),
        position: t2
      },
      next: n3 + 1
    };
  }
  if (n2 >= 4 && e[t2] === "$" && e[t2 + 1] === "$") {
    let n3 = e.indexOf("$$", t2 + 2);
    if (n3 < 0) throw new h("Unclosed $$ delimiter", t2);
    return {
      token: {
        type: "DOLLAR2_DELIMITED",
        value: e.slice(t2 + 2, n3),
        position: t2
      },
      next: n3 + 2
    };
  }
  if (n2 >= 2 && e[t2] === "$") {
    let n3 = e.indexOf("$", t2 + 1);
    if (n3 < 0) throw new h("Unclosed $ delimiter", t2);
    return {
      token: {
        type: "DOLLAR_DELIMITED",
        value: e.slice(t2 + 1, n3),
        position: t2
      },
      next: n3 + 1
    };
  }
  if (n2 >= 2 && e[t2] === "%") {
    let n3 = e.indexOf("%", t2 + 1);
    if (n3 < 0) throw new h("Unclosed % delimiter", t2);
    return {
      token: {
        type: "PERCENT_DELIMITED",
        value: e.slice(t2 + 1, n3),
        position: t2
      },
      next: n3 + 1
    };
  }
  return null;
}
function _(e) {
  let t2 = [], n2 = 0;
  for (; n2 < e.length; ) {
    let r2 = e[n2];
    if (/[ \t\r\n\f\v]/.test(r2)) {
      n2 += 1;
      continue;
    }
    if (r2 === "%" || r2 === "$" || r2 === "`") {
      let r3 = g(e, n2);
      if (r3) {
        t2.push(r3.token), n2 = r3.next;
        continue;
      }
    }
    if (r2 === "@") {
      t2.push({
        type: "AT",
        value: r2,
        position: n2
      }), n2 += 1;
      continue;
    }
    if (r2 === "#") {
      t2.push({
        type: "HASH",
        value: r2,
        position: n2
      }), n2 += 1;
      continue;
    }
    let i2 = u(e, n2, true);
    if (i2 > 0) {
      let r3 = n2;
      for (n2 += i2; n2 < e.length; ) {
        let t3 = u(e, n2, false);
        if (t3 === 0) break;
        n2 += t3;
      }
      t2.push({
        type: "IDENT",
        value: e.slice(r3, n2),
        position: r3
      });
      continue;
    }
    if (r2 === "[") {
      t2.push({
        type: "LBRACKET",
        value: r2,
        position: n2
      }), n2 += 1;
      continue;
    }
    if (r2 === "]") {
      t2.push({
        type: "RBRACKET",
        value: r2,
        position: n2
      }), n2 += 1;
      continue;
    }
    if (r2 === "(") {
      t2.push({
        type: "LPAREN",
        value: r2,
        position: n2
      }), n2 += 1;
      continue;
    }
    if (r2 === ")") {
      t2.push({
        type: "RPAREN",
        value: r2,
        position: n2
      }), n2 += 1;
      continue;
    }
    if (r2 === ",") {
      t2.push({
        type: "COMMA",
        value: r2,
        position: n2
      }), n2 += 1;
      continue;
    }
    if (r2 === "=") {
      t2.push({
        type: "EQ",
        value: r2,
        position: n2
      }), n2 += 1;
      continue;
    }
    if (/\d/.test(r2)) {
      let r3 = n2;
      for (; n2 < e.length && /\d/.test(e[n2]); ) n2 += 1;
      t2.push({
        type: "NUMBER",
        value: e.slice(r3, n2),
        position: r3
      });
      continue;
    }
    throw new h(`Unexpected character "${r2}"`, n2);
  }
  return t2.push({
    type: "EOF",
    value: "",
    position: e.length
  }), t2;
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
    let n2 = this.peek(), r2;
    if (n2.type === "IDENT") this.consume("IDENT"), r2 = t(n2.value);
    else if (n2.type === "PERCENT_DELIMITED") this.consume("PERCENT_DELIMITED"), r2 = t(n2.value), r2.env_mode = "text";
    else if (n2.type === "DOLLAR_DELIMITED") this.consume("DOLLAR_DELIMITED"), r2 = t(n2.value), r2.env_mode = "formula_inline";
    else if (n2.type === "DOLLAR2_DELIMITED") this.consume("DOLLAR2_DELIMITED"), r2 = t(n2.value), r2.env_mode = "formula_display";
    else if (n2.type === "BACKTICK_DELIMITED") this.consume("BACKTICK_DELIMITED"), r2 = t(n2.value), r2.env_mode = "formula_inline", r2.temporary_format = "texttt";
    else throw new h(`Expected macro name (IDENT or %\u2026% / $\u2026$ / $$\u2026$$) but got ${n2.type}`, n2.position);
    if (this.peek().type === "AT") if (this.consume("AT"), this.peek().type === "HASH") {
      if (e) throw new h("Binder name override must not use #", this.peek().position);
      this.consume("HASH");
      let t2 = this.expect("IDENT");
      /^\d+(?:\.\d+)*$/.test(t2.value) ? r2.postfix = {
        type: "tree_path",
        path: t2.value.split(".").map(Number)
      } : r2.postfix = {
        type: "binder_name",
        name: t2.value
      };
    } else {
      let t2 = this.expect("IDENT");
      e ? r2.binder_name = t2.value : r2.postfix = {
        type: "name",
        name: t2.value
      };
    }
    if (this.peek().type === "LBRACKET") {
      this.consume("LBRACKET");
      let e2 = this.expect("IDENT");
      r2.style_name = e2.value, this.expect("RBRACKET");
    }
    if (this.peek().type === "LPAREN" && (this.consume("LPAREN"), r2.children = this.parseNodeList(), this.expect("RPAREN")), e) {
      if (r2.children.length > 0) throw new h("Binder must be a leaf", n2.position);
      r2.binder_explicit = true, r2.kind = "binder";
    }
    return r2;
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
    let t2 = this.peek();
    if (t2.type !== e) throw new h(`Expected ${e} but got ${t2.type}`, t2.position);
    return this.cursor += 1, t2;
  }
  consume(e) {
    return this.expect(e);
  }
  peek() {
    return this.tokens[this.cursor];
  }
};
function y(e, t2 = {}) {
  let n2 = new v(_(e)).parse();
  return b(n2), n2;
}
function b(e, t2 = []) {
  e.env_mode && (e.temporary_source = e.macro_name, e.macro_name = t2.length === 0 ? "#" : `#${t2.join(".")}`), e.binder_explicit && e.binder_name === void 0 && (e.binder_name = e.temporary_source ?? e.macro_name), e.children.forEach((e2, n2) => b(e2, [...t2, n2]));
}

// node_modules/@sjtu-ai4math/snl-basics/dist-lib/chunks/source-metrics-B3zTv7qs.js
function r(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) return false;
  let t2 = e;
  if (t2.type !== "i18n" || typeof t2.default_language != "string" || !t2.values || typeof t2.values != "object" || Array.isArray(t2.values)) return false;
  let n2 = t2.values, r2 = Object.keys(n2);
  return r2.length > 0 && Object.prototype.hasOwnProperty.call(n2, t2.default_language) && typeof n2[t2.default_language] == "string" && r2.every((e2) => typeof n2[e2] == "string");
}
function i(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) return false;
  let t2 = e;
  return typeof t2.style_name != "string" || !d(t2.style_name) || "tag" in t2 || "variadic_left" in t2 || "variadic_join" in t2 || "variadic_right" in t2 || !Array.isArray(t2.tags) || !t2.tags.every((e2) => typeof e2 == "string") || t2.separator !== void 0 && typeof t2.separator != "string" || t2.block_template_name !== void 0 && (t2.mode !== "block" || typeof t2.block_template_name != "string") ? false : t2.mode === "text" ? typeof t2.template == "string" || r(t2.template) : t2.mode === "formula_inline" || t2.mode === "formula_display" || t2.mode === "block" ? typeof t2.template == "string" : false;
}
function a(e) {
  return Array.isArray(e) && e.every((e2) => typeof e2 == "string");
}
function o2(e, t2 = true) {
  if (typeof e.name != "string" || !d(e.name) || typeof e.description != "string" || typeof e.dynamic_arity != "boolean" || (t2 || e.tags !== void 0) && !a(e.tags) || e.kind !== void 0 && typeof e.kind != "string" || !e.source || typeof e.source != "object" || Array.isArray(e.source)) return false;
  let r2 = e.source;
  return a(r2.entries) && a(r2.urls);
}
function c2(e) {
  return !e || typeof e != "object" || Array.isArray(e) ? false : Object.values(e).every((e2) => typeof e2 == "string");
}
function l2(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) return false;
  let t2 = Object.getPrototypeOf(e);
  return t2 === Object.prototype || t2 === null;
}
function f(e) {
  if (!l2(e)) return false;
  for (let t2 of Object.values(e)) {
    if (!t2 || typeof t2 != "object" || Array.isArray(t2)) return false;
    let e2 = t2;
    if (!o2(e2) || !c2(e2.default_style)) return false;
    let n2 = e2.styles;
    if (!n2 || n2.length === 0 || n2.some((e3) => !i(e3) || typeof e3.template != "string")) return false;
    let r2 = n2.map((e3) => e3.style_name);
    if (new Set(r2).size !== r2.length || Object.keys(e2.default_style).some((e3) => e3.trim().length === 0) || Object.values(e2.default_style).some((e3) => !r2.includes(e3))) return false;
  }
  return true;
}
function O(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) return false;
  let t2 = e;
  return "type" in t2 || ![
    "formula_inline",
    "formula_display",
    "text",
    "block"
  ].includes(String(t2.mode)) || typeof t2.body != "string" || t2.separator !== void 0 && typeof t2.separator != "string" ? false : t2.block_template_name === void 0 || t2.mode === "block" && typeof t2.block_template_name == "string";
}
var k = /* @__PURE__ */ new Set([
  "type",
  "default_language",
  "values"
]);
function A(e) {
  if (O(e)) return [e];
  if (!e || typeof e != "object" || Array.isArray(e)) return null;
  let t2 = e;
  if (t2.type !== "i18n" || typeof t2.default_language != "string" || Object.keys(t2).some((e2) => !k.has(e2)) || !t2.values || typeof t2.values != "object" || Array.isArray(t2.values)) return null;
  let n2 = t2.values;
  return !Object.prototype.hasOwnProperty.call(n2, t2.default_language) || Object.keys(n2).length === 0 || !Object.values(n2).every(O) ? null : Object.values(n2);
}
function j(t2) {
  let n2 = p(t2.body);
  return `${n2.variadic ? "dynamic" : "fixed"}:${n2.positional_arity}`;
}
var M = [
  "tag",
  "mode",
  "separator",
  "block_template_name",
  "variadic_left",
  "variadic_join",
  "variadic_right",
  "react_renderer_key"
];
var N = /* @__PURE__ */ new Set([
  "style_name",
  "tags",
  "template"
]);
function P(t2) {
  if (!l2(t2)) return false;
  for (let r2 of Object.values(t2)) {
    if (!r2 || typeof r2 != "object" || Array.isArray(r2)) return false;
    let t3 = r2;
    if (!o2(t3) || typeof t3.kind != "string" || t3.kind.length === 0 || t3.kind === "partial" || "default_style" in t3 || !Array.isArray(t3.styles) || t3.styles.length === 0) return false;
    let i2 = [];
    for (let r3 of t3.styles) {
      if (!r3 || typeof r3 != "object" || Array.isArray(r3)) return false;
      let o3 = r3, s2 = A(o3.template);
      if (typeof o3.style_name != "string" || !d(o3.style_name) || !a(o3.tags) || !s2 || M.some((e) => e in o3) || Object.keys(o3).some((e) => !N.has(e)) || new Set(s2.map(j)).size !== 1 || s2.some((n2) => {
        let r4 = p(n2.body);
        return r4.invalid || r4.variadic !== t3.dynamic_arity;
      })) return false;
      i2.push(o3.style_name);
    }
    if (new Set(i2).size !== i2.length) return false;
  }
  return true;
}
var G = 256;
function K(e, t2) {
  return e.reduce((n2, r2, i2) => i2 === 0 ? r2 : `${n2}${e[i2 - 1] !== "" && r2 !== "" ? `,${t2}` : ","}${r2}`, "");
}
var q = class {
  indentSpaces;
  inlineParenthesisDepth;
  constructor(e = 4, t2 = 3) {
    this.assertIntegerInRange(e, "indentSpaces", G), this.assertIntegerInRange(t2, "inlineParenthesisDepth", 2 ** 53 - 1), this.indentSpaces = e, this.inlineParenthesisDepth = t2;
  }
  format(e) {
    return this.formatNode(y(e), 0, " ");
  }
  formatTree(e, t2 = " ") {
    return this.formatNode(e, 0, t2);
  }
  formatNode(e, t2, n2) {
    let r2 = this.formatNodeHead(e);
    if (e.children.length === 0) return r2;
    if (this.parenthesisDepth(e) <= this.inlineParenthesisDepth) return `${r2}(${K(e.children.map((e2) => this.formatNode(e2, 0, n2)), n2)})`;
    let i2 = " ".repeat(this.indentSpaces * (t2 + 1));
    return `${r2}(
${e.children.map((e2) => `${i2}${this.formatNode(e2, t2 + 1, n2)}`).join(",\n")}
${" ".repeat(this.indentSpaces * t2)})`;
  }
  formatNodeHead(e) {
    let t2 = e.binder_explicit ? "@" : "", n2, r2 = e.temporary_source ?? e.macro_name;
    if (e.temporary_format === "texttt") n2 = `\`${r2}\``;
    else switch (e.env_mode) {
      case "text":
        n2 = `%${r2}%`;
        break;
      case "formula_inline":
        n2 = `$${r2}$`;
        break;
      case "formula_display":
        n2 = `$$${r2}$$`;
        break;
      default:
        n2 = e.macro_name;
    }
    let i2 = this.sourceReference(e), a2 = i2 === void 0 ? "" : `@${i2}`, o3 = e.style_name === void 0 ? "" : `[${e.style_name}]`;
    return `${t2}${n2}${a2}${o3}`;
  }
  sourceReference(e) {
    if (e.binder_explicit && e.binder_name && e.binder_name !== e.macro_name) return e.binder_name;
    if (e.postfix?.type === "tree_path") return `#${e.postfix.path.join(".")}`;
    if (e.postfix?.type === "binder_name") return `#${e.postfix.name}`;
    if (e.postfix?.type === "name") return e.postfix.name;
    if (!e.mdata || typeof e.mdata != "object") return;
    let t2 = e.mdata.src;
    return typeof t2 == "string" ? t2 : void 0;
  }
  assertIntegerInRange(e, t2, n2) {
    if (!Number.isSafeInteger(e) || e < 0 || e > n2) throw RangeError(`${t2} must be a non-negative integer no greater than ${n2}`);
  }
  parenthesisDepth(e) {
    let t2 = -1;
    for (let n2 of e.children) t2 = Math.max(t2, this.parenthesisDepth(n2));
    return t2 + 1;
  }
};
var J = new q(0, 2 ** 53 - 1);

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
function snlDocRoot(workspaceRoot) {
  return path.resolve(workspaceRoot, ".SNL_Doc");
}
function configPath(workspaceRoot) {
  return path.join(snlDocRoot(workspaceRoot), "config.json");
}
function entriesPath(workspaceRoot) {
  return path.join(snlDocRoot(workspaceRoot), "entries.json");
}
function entryEntitiesDir(workspaceRoot) {
  return path.join(snlDocRoot(workspaceRoot), "entries");
}
function macroEntitiesDir(workspaceRoot) {
  return path.join(snlDocRoot(workspaceRoot), "macros");
}
function packageManifestsDir(workspaceRoot) {
  return path.join(snlDocRoot(workspaceRoot), "packages");
}
function termMacrosDir(workspaceRoot) {
  return path.join(snlDocRoot(workspaceRoot), "term_macros");
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
      const stat = await fs.lstat(directory);
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
    const stat = await fs.lstat(entriesFile);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`${entriesFile} must be a regular, non-symlink legacy backup file.`);
    }
    legacyEntries = await readJson(entriesFile);
  }
  const legacyPackages = /* @__PURE__ */ new Map();
  for (const { relativePath, value } of await readJsonDirectory(termMacrosDir(workspaceRoot))) {
    legacyPackages.set(path.basename(relativePath), value);
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
      if (!isRecord(value) || value.format !== "snl-entry" || value.version !== ENTRY_STORAGE_VERSION || typeof value.package !== "string" || !isRecord(value.entry) || typeof value.entry.id !== "string" || !value.entry.id || value.entry.id !== value.entry.id.trim() || typeof value.entry.package !== "string") {
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
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const bare = name.replace(/\.json$/i, "");
    try {
      defineIdentity(out, bare, await readJson(path.join(dir, name)));
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
    assertCompatibleSchemaMarker(value, CURRENT_MACRO_SCHEMA_VERSION, `${relativePath} Macro envelope`);
    const macroDocument = /* @__PURE__ */ Object.create(null);
    macroDocument[value.macro.name] = value.macro;
    const currentMacro = usesCurrentEntitySchemas(config);
    if (currentMacro ? !P(macroDocument) : !f(macroDocument)) {
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
  for (const manifest of [...manifests.values()].sort((a2, b2) => a2.id.localeCompare(b2.id))) {
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
  const directoryStat = await fs.lstat(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error(`${directory} must be a real directory, not a symlink.`);
  }
  const base = path.basename(directory);
  const names = (await fs.readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(names.map(async (name) => {
    const absolute = path.join(directory, name);
    const stat = await fs.lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`${absolute} must be a regular, non-symlink file.`);
    }
    return {
      relativePath: `${base}/${name}`,
      value: await readJson(absolute)
    };
  }));
}
function assertExpectedEntityPath(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Entity path ${actual} does not match its logical identity path ${expected}.`);
  }
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// lib/snoogle-query.ts
var FIELD_WEIGHTS = {
  primary: 1,
  secondary: 0.85,
  tertiary: 0.65
};
var ALL_TIERS = ["primary", "secondary", "tertiary"];
var TAIL_TIERS = ["primary", "secondary"];
var MIDDLE_TIERS = ["tertiary"];
function tokenizeSnoogleQuery(query) {
  return query.trim().split(/\s+/u).filter(Boolean);
}
function expandSnoogleToken(token) {
  if (!token.includes(".")) return [{ text: token, tiers: ALL_TIERS }];
  const segments = token.split(".").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length <= 1) return segments.length === 0 ? [] : [{ text: segments[0], tiers: ALL_TIERS }];
  return [
    { text: segments.at(-1), tiers: TAIL_TIERS },
    ...segments.slice(0, -1).map((text) => ({ text, tiers: MIDDLE_TIERS }))
  ];
}
function exactnessFactor(needle, fieldText) {
  const field = fieldText.toLowerCase();
  if (needle === field) return 1;
  if (field.length === 0) return 0.85;
  const coverage = Math.min(1, needle.length / field.length);
  return (field.startsWith(needle) ? 0.9 : 0.85) * (0.6 + 0.4 * coverage);
}
var SnoogleSearchIndex = class {
  documents;
  weights;
  minTokenScore;
  fuse;
  hasFields;
  constructor(documents, options = {}) {
    this.documents = documents;
    this.weights = {
      primary: options.fieldWeights?.primary ?? FIELD_WEIGHTS.primary,
      secondary: options.fieldWeights?.secondary ?? FIELD_WEIGHTS.secondary,
      tertiary: options.fieldWeights?.tertiary ?? FIELD_WEIGHTS.tertiary
    };
    this.minTokenScore = options.minTokenScore ?? 0.2;
    const indexedFields = [];
    documents.forEach((document, documentIndex) => {
      Object.keys(FIELD_WEIGHTS).forEach((tier) => {
        for (const rawText of document.fields[tier]) {
          const text = rawText.trim();
          if (text) indexedFields.push({ documentIndex, text, tier });
        }
      });
    });
    this.hasFields = indexedFields.length > 0;
    this.fuse = new entry_default(indexedFields, {
      keys: ["text"],
      includeScore: true,
      ignoreLocation: true,
      threshold: options.fuseThreshold ?? 0.72,
      minMatchCharLength: 1,
      shouldSort: false
    });
  }
  search(query) {
    const tokens = tokenizeSnoogleQuery(query);
    if (tokens.length === 0) {
      return [...this.documents].sort((a2, b2) => a2.id.localeCompare(b2.id)).map((document) => ({ value: document.value, score: 0, tokenScores: [] }));
    }
    if (!this.hasFields) return [];
    const scoresByDocument = this.documents.map(() => []);
    for (const token of tokens) {
      const probes = expandSnoogleToken(token);
      if (probes.length === 0) continue;
      const probeScores = probes.map((probe) => {
        const needle = probe.text.toLowerCase();
        const best = new Array(this.documents.length).fill(0);
        for (const result of this.fuse.search(probe.text)) {
          if (!probe.tiers.includes(result.item.tier)) continue;
          const score = Math.max(0, 1 - (result.score ?? 1)) * this.weights[result.item.tier] * exactnessFactor(needle, result.item.text);
          best[result.item.documentIndex] = Math.max(best[result.item.documentIndex], score);
        }
        return best;
      });
      for (let index = 0; index < this.documents.length; index += 1) {
        const parts = probeScores.map((scores) => scores[index]);
        scoresByDocument[index].push(parts.some((score) => score <= 0) ? 0 : Math.exp(parts.reduce((sum, score) => sum + Math.log(score), 0) / parts.length));
      }
    }
    const ranked = [];
    this.documents.forEach((document, index) => {
      const tokenScores = scoresByDocument[index];
      if (tokenScores.length !== tokens.length || tokenScores.some((score2) => score2 < this.minTokenScore)) return;
      const score = Math.exp(tokenScores.reduce((sum, value) => sum + Math.log(value), 0) / tokenScores.length);
      ranked.push({ id: document.id, value: document.value, score, tokenScores });
    });
    ranked.sort((a2, b2) => b2.score - a2.score || a2.id.localeCompare(b2.id));
    return ranked.map(({ id: _id, ...result }) => result);
  }
};
function splitSnoogleNamespace(id) {
  const segments = id.split(".").map((segment) => segment.trim()).filter(Boolean);
  return { tail: segments.at(-1) ?? id, middle: segments.slice(0, -1) };
}
function createSnoogleSearchDocument({ id, value, labels = [] }) {
  const namespace = splitSnoogleNamespace(id);
  return { id, value, fields: { primary: [namespace.tail], secondary: labels, tertiary: namespace.middle } };
}
function rankSnoogleDocuments(query, documents, options = {}) {
  return new SnoogleSearchIndex(documents, options).search(query);
}
async function querySnoogl(workspaceRoot, mode, query) {
  if (mode === "entry") {
    const entries = await readEntries(workspaceRoot);
    const hits2 = entries.map((entry) => ({
      kind: "entry",
      id: entry.id,
      title: localizedText(entry.title),
      entryKind: entry.kind ?? null,
      score: 0
    }));
    const results2 = rankSnoogleDocuments(query.trim().toLowerCase(), hits2.map((hit) => createSnoogleSearchDocument({ id: hit.id, value: hit, labels: hit.title ? [hit.title] : [] }))).map((result) => ({ ...result.value, score: result.score }));
    return { schemaVersion: 1, mode, query, results: results2 };
  }
  function localizedText(value) {
    if (typeof value === "string") return value;
    return value.values[value.default_language] ?? value.values.en ?? Object.values(value.values)[0] ?? "";
  }
  const [config, packages] = await Promise.all([readConfig(workspaceRoot), readAllMacroPackages(workspaceRoot)]);
  const active = config.active_macro_packages === void 0 ? null : new Set(config.active_macro_packages);
  const hits = [];
  for (const packageId of Object.keys(packages).sort((a2, b2) => a2.localeCompare(b2))) {
    if (active && !active.has(packageId)) continue;
    const pkg = packages[packageId];
    for (const [id, macro] of Object.entries(pkg.macros)) {
      hits.push({
        kind: "macro",
        id,
        packageId,
        packageName: pkg.name,
        macroKind: typeof macro.kind === "string" && macro.kind ? macro.kind : null,
        tags: Array.isArray(macro.tags) ? [...macro.tags] : [],
        sourceEntries: Array.isArray(macro.source?.entries) ? [...macro.source.entries] : [],
        score: 0
      });
    }
  }
  const results = rankSnoogleDocuments(query.trim().toLowerCase(), hits.map((hit) => createSnoogleSearchDocument({ id: hit.id, value: hit, labels: hit.tags }))).map((result) => ({ ...result.value, score: result.score }));
  return { schemaVersion: 1, mode, query, results };
}

// lib/cli-args.ts
function parseArgs(argv, specs) {
  const bySpec = {};
  const shortAlias = {};
  for (const s2 of specs) {
    bySpec[s2.name] = s2;
    if (s2.short) shortAlias[s2.short] = s2.name;
  }
  const flags = {};
  const positional = [];
  for (const s2 of specs) {
    if (s2.default !== void 0) flags[s2.name] = s2.default;
  }
  let i2 = 0;
  let seenDashDash = false;
  while (i2 < argv.length) {
    const tok = argv[i2];
    if (seenDashDash) {
      positional.push(tok);
      i2++;
      continue;
    }
    if (tok === "--") {
      seenDashDash = true;
      i2++;
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
        i2++;
      } else {
        if (inlineVal !== void 0) {
          flags[name] = inlineVal;
          i2++;
        } else {
          const next = argv[i2 + 1];
          if (next === void 0 || next.startsWith("-")) {
            throw new Error(`Flag --${name} requires a value`);
          }
          flags[name] = next;
          i2 += 2;
        }
      }
    } else if (tok.startsWith("-") && tok.length === 2) {
      const short = tok.slice(1);
      const name = shortAlias[short];
      if (!name) throw new Error(`Unknown flag: -${short}`);
      const spec = bySpec[name];
      if (spec.hasValue === false) {
        flags[name] = true;
        i2++;
      } else {
        const next = argv[i2 + 1];
        if (next === void 0 || next.startsWith("-")) {
          throw new Error(`Flag -${short} (--${name}) requires a value`);
        }
        flags[name] = next;
        i2 += 2;
      }
    } else {
      positional.push(tok);
      i2++;
    }
  }
  return { flags, positional };
}
function formatUsage(cliName, synopsis, specs) {
  const lines = [`Usage: ${cliName} ${synopsis}`, "", "Options:"];
  for (const s2 of specs) {
    const flagStr = s2.short ? `-${s2.short}, --${s2.name}` : `    --${s2.name}`;
    const kind = s2.hasValue === false ? "" : " <value>";
    const dflt = s2.default !== void 0 ? ` (default: ${JSON.stringify(s2.default)})` : "";
    lines.push(`  ${flagStr}${kind}${dflt}`);
    if (s2.help) lines.push(`      ${s2.help}`);
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

// bin/impl/snoogle.ts
var MACRO_FLAG = { name: "macro", hasValue: true, help: "Search the Macro catalog with one free-form query." };
var ENTRY_FLAG = { name: "entry", hasValue: true, help: "Search the Entry catalog with one free-form query." };
var SPECS = [ROOT_FLAG, MACRO_FLAG, ENTRY_FLAG, JSON_FLAG, HELP_FLAG];
function usage() {
  return formatUsage("snoogle", "(--macro <query> | --entry <query>)", SPECS);
}
async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), SPECS);
  } catch (error) {
    process.stderr.write(`${error.message}

${usage()}
`);
    return 2;
  }
  if (parsed.flags.help === true) {
    process.stdout.write(usage() + "\n");
    return 0;
  }
  const macro = parsed.flags.macro;
  const entry = parsed.flags.entry;
  if (parsed.positional.length || typeof macro === "string" === (typeof entry === "string")) {
    process.stderr.write(`Expected exactly one mutually exclusive --macro <query> or --entry <query>.

${usage()}
`);
    return 2;
  }
  const mode = typeof macro === "string" ? "macro" : "entry";
  const query = String(mode === "macro" ? macro : entry);
  try {
    const response = await querySnoogl(path2.resolve(String(parsed.flags.root)), mode, query);
    if (parsed.flags.json === true) process.stdout.write(JSON.stringify(response, null, 2) + "\n");
    else {
      process.stdout.write(`SNoogL ${mode} query ${JSON.stringify(query)}: ${response.results.length} result(s)
`);
      for (const hit of response.results) {
        const detail = hit.kind === "entry" ? hit.title : `${hit.packageId} (${hit.packageName})`;
        process.stdout.write(`  ${hit.id}	${hit.score.toFixed(6)}${detail ? `	${detail}` : ""}
`);
      }
    }
    return 0;
  } catch (error) {
    process.stderr.write(`${error.message}
`);
    return 2;
  }
}
process.exitCode = await main();
