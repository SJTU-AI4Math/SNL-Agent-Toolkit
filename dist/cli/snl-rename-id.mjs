#!/usr/bin/env node

// bin/impl/rename-id.ts
import * as path4 from "node:path";

// lib/entity-references.ts
import { constants as constants2 } from "node:fs";
import { promises as fs2 } from "node:fs";
import * as path3 from "node:path";
import { createHash as createHash2 } from "node:crypto";

// ../../.openclaw/workspace/cat-repos/SNL-Agent-Toolkit/node_modules/jsonc-parser/lib/esm/impl/scanner.js
function createScanner(text, ignoreTrivia = false) {
  const len = text.length;
  let pos = 0, value = "", tokenOffset = 0, token = 16, lineNumber = 0, lineStartOffset = 0, tokenLineStartOffset = 0, prevTokenLineStartOffset = 0, scanError = 0;
  function scanHexDigits(count, exact) {
    let digits = 0;
    let value2 = 0;
    while (digits < count || !exact) {
      let ch = text.charCodeAt(pos);
      if (ch >= 48 && ch <= 57) {
        value2 = value2 * 16 + ch - 48;
      } else if (ch >= 65 && ch <= 70) {
        value2 = value2 * 16 + ch - 65 + 10;
      } else if (ch >= 97 && ch <= 102) {
        value2 = value2 * 16 + ch - 97 + 10;
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
    if (text.charCodeAt(pos) === 48) {
      pos++;
    } else {
      pos++;
      while (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
      }
    }
    if (pos < text.length && text.charCodeAt(pos) === 46) {
      pos++;
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
      } else {
        scanError = 3;
        return text.substring(start, pos);
      }
    }
    let end = pos;
    if (pos < text.length && (text.charCodeAt(pos) === 69 || text.charCodeAt(pos) === 101)) {
      pos++;
      if (pos < text.length && text.charCodeAt(pos) === 43 || text.charCodeAt(pos) === 45) {
        pos++;
      }
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
        end = pos;
      } else {
        scanError = 3;
      }
    }
    return text.substring(start, end);
  }
  function scanString() {
    let result = "", start = pos;
    while (true) {
      if (pos >= len) {
        result += text.substring(start, pos);
        scanError = 2;
        break;
      }
      const ch = text.charCodeAt(pos);
      if (ch === 34) {
        result += text.substring(start, pos);
        pos++;
        break;
      }
      if (ch === 92) {
        result += text.substring(start, pos);
        pos++;
        if (pos >= len) {
          scanError = 2;
          break;
        }
        const ch2 = text.charCodeAt(pos++);
        switch (ch2) {
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
      if (ch >= 0 && ch <= 31) {
        if (isLineBreak(ch)) {
          result += text.substring(start, pos);
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
    let code = text.charCodeAt(pos);
    if (isWhiteSpace(code)) {
      do {
        pos++;
        value += String.fromCharCode(code);
        code = text.charCodeAt(pos);
      } while (isWhiteSpace(code));
      return token = 15;
    }
    if (isLineBreak(code)) {
      pos++;
      value += String.fromCharCode(code);
      if (code === 13 && text.charCodeAt(pos) === 10) {
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
        if (text.charCodeAt(pos + 1) === 47) {
          pos += 2;
          while (pos < len) {
            if (isLineBreak(text.charCodeAt(pos))) {
              break;
            }
            pos++;
          }
          value = text.substring(start, pos);
          return token = 12;
        }
        if (text.charCodeAt(pos + 1) === 42) {
          pos += 2;
          const safeLength = len - 1;
          let commentClosed = false;
          while (pos < safeLength) {
            const ch = text.charCodeAt(pos);
            if (ch === 42 && text.charCodeAt(pos + 1) === 47) {
              pos += 2;
              commentClosed = true;
              break;
            }
            pos++;
            if (isLineBreak(ch)) {
              if (ch === 13 && text.charCodeAt(pos) === 10) {
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
          value = text.substring(start, pos);
          return token = 13;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16;
      // numbers
      case 45:
        value += String.fromCharCode(code);
        pos++;
        if (pos === len || !isDigit(text.charCodeAt(pos))) {
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
          code = text.charCodeAt(pos);
        }
        if (tokenOffset !== pos) {
          value = text.substring(tokenOffset, pos);
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
function isWhiteSpace(ch) {
  return ch === 32 || ch === 9;
}
function isLineBreak(ch) {
  return ch === 10 || ch === 13;
}
function isDigit(ch) {
  return ch >= 48 && ch <= 57;
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

// ../../.openclaw/workspace/cat-repos/SNL-Agent-Toolkit/node_modules/jsonc-parser/lib/esm/impl/string-intern.js
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
var supportedEols = ["\n", "\r", "\r\n"];

// ../../.openclaw/workspace/cat-repos/SNL-Agent-Toolkit/node_modules/jsonc-parser/lib/esm/impl/format.js
function format(documentText, range, options) {
  let initialIndentLevel;
  let formatText;
  let formatTextStart;
  let rangeStart;
  let rangeEnd;
  if (range) {
    rangeStart = range.offset;
    rangeEnd = rangeStart + range.length;
    formatTextStart = rangeStart;
    while (formatTextStart > 0 && !isEOL(documentText, formatTextStart - 1)) {
      formatTextStart--;
    }
    let endOffset = rangeEnd;
    while (endOffset < documentText.length && !isEOL(documentText, endOffset)) {
      endOffset++;
    }
    formatText = documentText.substring(formatTextStart, endOffset);
    initialIndentLevel = computeIndentLevel(formatText, options);
  } else {
    formatText = documentText;
    initialIndentLevel = 0;
    formatTextStart = 0;
    rangeStart = 0;
    rangeEnd = documentText.length;
  }
  const eol = getEOL(options, documentText);
  const eolFastPathSupported = supportedEols.includes(eol);
  let numberLineBreaks = 0;
  let indentLevel = 0;
  let indentValue;
  if (options.insertSpaces) {
    indentValue = cachedSpaces[options.tabSize || 4] ?? repeat(cachedSpaces[1], options.tabSize || 4);
  } else {
    indentValue = "	";
  }
  const indentType = indentValue === "	" ? "	" : " ";
  let scanner = createScanner(formatText, false);
  let hasError = false;
  function newLinesAndIndent() {
    if (numberLineBreaks > 1) {
      return repeat(eol, numberLineBreaks) + repeat(indentValue, initialIndentLevel + indentLevel);
    }
    const amountOfSpaces = indentValue.length * (initialIndentLevel + indentLevel);
    if (!eolFastPathSupported || amountOfSpaces > cachedBreakLinesWithSpaces[indentType][eol].length) {
      return eol + repeat(indentValue, initialIndentLevel + indentLevel);
    }
    if (amountOfSpaces <= 0) {
      return eol;
    }
    return cachedBreakLinesWithSpaces[indentType][eol][amountOfSpaces];
  }
  function scanNext() {
    let token = scanner.scan();
    numberLineBreaks = 0;
    while (token === 15 || token === 14) {
      if (token === 14 && options.keepLines) {
        numberLineBreaks += 1;
      } else if (token === 14) {
        numberLineBreaks = 1;
      }
      token = scanner.scan();
    }
    hasError = token === 16 || scanner.getTokenError() !== 0;
    return token;
  }
  const editOperations = [];
  function addEdit(text, startOffset, endOffset) {
    if (!hasError && (!range || startOffset < rangeEnd && endOffset > rangeStart) && documentText.substring(startOffset, endOffset) !== text) {
      editOperations.push({ offset: startOffset, length: endOffset - startOffset, content: text });
    }
  }
  let firstToken = scanNext();
  if (options.keepLines && numberLineBreaks > 0) {
    addEdit(repeat(eol, numberLineBreaks), 0, 0);
  }
  if (firstToken !== 17) {
    let firstTokenStart = scanner.getTokenOffset() + formatTextStart;
    let initialIndent = indentValue.length * initialIndentLevel < 20 && options.insertSpaces ? cachedSpaces[indentValue.length * initialIndentLevel] : repeat(indentValue, initialIndentLevel);
    addEdit(initialIndent, formatTextStart, firstTokenStart);
  }
  while (firstToken !== 17) {
    let firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
    let secondToken = scanNext();
    let replaceContent = "";
    let needsLineBreak = false;
    while (numberLineBreaks === 0 && (secondToken === 12 || secondToken === 13)) {
      let commentTokenStart = scanner.getTokenOffset() + formatTextStart;
      addEdit(cachedSpaces[1], firstTokenEnd, commentTokenStart);
      firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
      needsLineBreak = secondToken === 12;
      replaceContent = needsLineBreak ? newLinesAndIndent() : "";
      secondToken = scanNext();
    }
    if (secondToken === 2) {
      if (firstToken !== 1) {
        indentLevel--;
      }
      ;
      if (options.keepLines && numberLineBreaks > 0 || !options.keepLines && firstToken !== 1) {
        replaceContent = newLinesAndIndent();
      } else if (options.keepLines) {
        replaceContent = cachedSpaces[1];
      }
    } else if (secondToken === 4) {
      if (firstToken !== 3) {
        indentLevel--;
      }
      ;
      if (options.keepLines && numberLineBreaks > 0 || !options.keepLines && firstToken !== 3) {
        replaceContent = newLinesAndIndent();
      } else if (options.keepLines) {
        replaceContent = cachedSpaces[1];
      }
    } else {
      switch (firstToken) {
        case 3:
        case 1:
          indentLevel++;
          if (options.keepLines && numberLineBreaks > 0 || !options.keepLines) {
            replaceContent = newLinesAndIndent();
          } else {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 5:
          if (options.keepLines && numberLineBreaks > 0 || !options.keepLines) {
            replaceContent = newLinesAndIndent();
          } else {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 12:
          replaceContent = newLinesAndIndent();
          break;
        case 13:
          if (numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (!needsLineBreak) {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 6:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (!needsLineBreak) {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 10:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (secondToken === 6 && !needsLineBreak) {
            replaceContent = "";
          }
          break;
        case 7:
        case 8:
        case 9:
        case 11:
        case 2:
        case 4:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else {
            if ((secondToken === 12 || secondToken === 13) && !needsLineBreak) {
              replaceContent = cachedSpaces[1];
            } else if (secondToken !== 5 && secondToken !== 17) {
              hasError = true;
            }
          }
          break;
        case 16:
          hasError = true;
          break;
      }
      if (numberLineBreaks > 0 && (secondToken === 12 || secondToken === 13)) {
        replaceContent = newLinesAndIndent();
      }
    }
    if (secondToken === 17) {
      if (options.keepLines && numberLineBreaks > 0) {
        replaceContent = newLinesAndIndent();
      } else {
        replaceContent = options.insertFinalNewline ? eol : "";
      }
    }
    const secondTokenStart = scanner.getTokenOffset() + formatTextStart;
    addEdit(replaceContent, firstTokenEnd, secondTokenStart);
    firstToken = secondToken;
  }
  return editOperations;
}
function repeat(s3, count) {
  let result = "";
  for (let i3 = 0; i3 < count; i3++) {
    result += s3;
  }
  return result;
}
function computeIndentLevel(content, options) {
  let i3 = 0;
  let nChars = 0;
  const tabSize = options.tabSize || 4;
  while (i3 < content.length) {
    let ch = content.charAt(i3);
    if (ch === cachedSpaces[1]) {
      nChars++;
    } else if (ch === "	") {
      nChars += tabSize;
    } else {
      break;
    }
    i3++;
  }
  return Math.floor(nChars / tabSize);
}
function getEOL(options, text) {
  for (let i3 = 0; i3 < text.length; i3++) {
    const ch = text.charAt(i3);
    if (ch === "\r") {
      if (i3 + 1 < text.length && text.charAt(i3 + 1) === "\n") {
        return "\r\n";
      }
      return "\r";
    } else if (ch === "\n") {
      return "\n";
    }
  }
  return options && options.eol || "\n";
}
function isEOL(text, offset) {
  return "\r\n".indexOf(text.charAt(offset)) !== -1;
}

// ../../.openclaw/workspace/cat-repos/SNL-Agent-Toolkit/node_modules/jsonc-parser/lib/esm/impl/parser.js
var ParseOptions;
(function(ParseOptions2) {
  ParseOptions2.DEFAULT = {
    allowTrailingComma: false
  };
})(ParseOptions || (ParseOptions = {}));
function parseTree(text, errors = [], options = ParseOptions.DEFAULT) {
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
    onObjectProperty: (name, offset, length) => {
      currentParent = onValue({ type: "property", offset, length: -1, parent: currentParent, children: [] });
      currentParent.children.push({ type: "string", value: name, offset, length, parent: currentParent });
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
  visit(text, visitor, options);
  const result = currentParent.children[0];
  if (result) {
    delete result.parent;
  }
  return result;
}
function findNodeAtLocation(root, path5) {
  if (!root) {
    return void 0;
  }
  let node = root;
  for (let segment of path5) {
    if (typeof segment === "string") {
      if (node.type !== "object" || !Array.isArray(node.children)) {
        return void 0;
      }
      let found = false;
      for (const propertyNode of node.children) {
        if (Array.isArray(propertyNode.children) && propertyNode.children[0].value === segment && propertyNode.children.length === 2) {
          node = propertyNode.children[1];
          found = true;
          break;
        }
      }
      if (!found) {
        return void 0;
      }
    } else {
      const index = segment;
      if (node.type !== "array" || index < 0 || !Array.isArray(node.children) || index >= node.children.length) {
        return void 0;
      }
      node = node.children[index];
    }
  }
  return node;
}
function visit(text, visitor, options = ParseOptions.DEFAULT) {
  const _scanner = createScanner(text, false);
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
          handleError(
            14
            /* ParseErrorCode.InvalidUnicode */
          );
          break;
        case 5:
          handleError(
            15
            /* ParseErrorCode.InvalidEscapeCharacter */
          );
          break;
        case 3:
          handleError(
            13
            /* ParseErrorCode.UnexpectedEndOfNumber */
          );
          break;
        case 1:
          if (!disallowComments) {
            handleError(
              11
              /* ParseErrorCode.UnexpectedEndOfComment */
            );
          }
          break;
        case 2:
          handleError(
            12
            /* ParseErrorCode.UnexpectedEndOfString */
          );
          break;
        case 6:
          handleError(
            16
            /* ParseErrorCode.InvalidCharacter */
          );
          break;
      }
      switch (token) {
        case 12:
        case 13:
          if (disallowComments) {
            handleError(
              10
              /* ParseErrorCode.InvalidCommentToken */
            );
          } else {
            onComment();
          }
          break;
        case 16:
          handleError(
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
  function handleError(error, skipUntilAfter = [], skipUntil = []) {
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
          handleError(
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
      handleError(3, [], [
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
        handleError(4, [], [
          2,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
    } else {
      handleError(5, [], [
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
          handleError(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 2 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (!parseProperty()) {
        handleError(4, [], [
          2,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
      needsComma = true;
    }
    onObjectEnd();
    if (_scanner.getToken() !== 2) {
      handleError(7, [
        2
        /* SyntaxKind.CloseBraceToken */
      ], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseArray() {
    onArrayBegin();
    scanNext();
    let isFirstElement = true;
    let needsComma = false;
    while (_scanner.getToken() !== 4 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 4 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (isFirstElement) {
        _jsonPath.push(0);
        isFirstElement = false;
      } else {
        _jsonPath[_jsonPath.length - 1]++;
      }
      if (!parseValue()) {
        handleError(4, [], [
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
      handleError(8, [
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
        return parseArray();
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
    handleError(4, [], []);
    return false;
  }
  if (!parseValue()) {
    handleError(4, [], []);
    return false;
  }
  if (_scanner.getToken() !== 17) {
    handleError(9, [], []);
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

// ../../.openclaw/workspace/cat-repos/SNL-Agent-Toolkit/node_modules/jsonc-parser/lib/esm/impl/edit.js
function setProperty(text, originalPath, value, options) {
  const path5 = originalPath.slice();
  const errors = [];
  const root = parseTree(text, errors);
  let parent = void 0;
  let lastSegment = void 0;
  while (path5.length > 0) {
    lastSegment = path5.pop();
    parent = findNodeAtLocation(root, path5);
    if (parent === void 0 && value !== void 0) {
      if (typeof lastSegment === "string") {
        value = { [lastSegment]: value };
      } else {
        value = [value];
      }
    } else {
      break;
    }
  }
  if (!parent) {
    if (value === void 0) {
      throw new Error("Can not delete in empty document");
    }
    return withFormatting(text, { offset: root ? root.offset : 0, length: root ? root.length : 0, content: JSON.stringify(value) }, options);
  } else if (parent.type === "object" && typeof lastSegment === "string" && Array.isArray(parent.children)) {
    const existing = findNodeAtLocation(parent, [lastSegment]);
    if (existing !== void 0) {
      if (value === void 0) {
        if (!existing.parent) {
          throw new Error("Malformed AST");
        }
        const propertyIndex = parent.children.indexOf(existing.parent);
        let removeBegin;
        let removeEnd = existing.parent.offset + existing.parent.length;
        if (propertyIndex > 0) {
          let previous = parent.children[propertyIndex - 1];
          removeBegin = previous.offset + previous.length;
        } else {
          removeBegin = parent.offset + 1;
          if (parent.children.length > 1) {
            let next = parent.children[1];
            removeEnd = next.offset;
          }
        }
        return withFormatting(text, { offset: removeBegin, length: removeEnd - removeBegin, content: "" }, options);
      } else {
        return withFormatting(text, { offset: existing.offset, length: existing.length, content: JSON.stringify(value) }, options);
      }
    } else {
      if (value === void 0) {
        return [];
      }
      const newProperty = `${JSON.stringify(lastSegment)}: ${JSON.stringify(value)}`;
      const index = options.getInsertionIndex ? options.getInsertionIndex(parent.children.map((p3) => p3.children[0].value)) : parent.children.length;
      let edit;
      if (index > 0) {
        let previous = parent.children[index - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      } else if (parent.children.length === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty };
      } else {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty + "," };
      }
      return withFormatting(text, edit, options);
    }
  } else if (parent.type === "array" && typeof lastSegment === "number" && Array.isArray(parent.children)) {
    const insertIndex = lastSegment;
    if (insertIndex === -1) {
      const newProperty = `${JSON.stringify(value)}`;
      let edit;
      if (parent.children.length === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty };
      } else {
        const previous = parent.children[parent.children.length - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      }
      return withFormatting(text, edit, options);
    } else if (value === void 0 && parent.children.length >= 0) {
      const removalIndex = lastSegment;
      const toRemove = parent.children[removalIndex];
      let edit;
      if (parent.children.length === 1) {
        edit = { offset: parent.offset + 1, length: parent.length - 2, content: "" };
      } else if (parent.children.length - 1 === removalIndex) {
        let previous = parent.children[removalIndex - 1];
        let offset = previous.offset + previous.length;
        let parentEndOffset = parent.offset + parent.length;
        edit = { offset, length: parentEndOffset - 2 - offset, content: "" };
      } else {
        edit = { offset: toRemove.offset, length: parent.children[removalIndex + 1].offset - toRemove.offset, content: "" };
      }
      return withFormatting(text, edit, options);
    } else if (value !== void 0) {
      let edit;
      const newProperty = `${JSON.stringify(value)}`;
      if (!options.isArrayInsertion && parent.children.length > lastSegment) {
        const toModify = parent.children[lastSegment];
        edit = { offset: toModify.offset, length: toModify.length, content: newProperty };
      } else if (parent.children.length === 0 || lastSegment === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: parent.children.length === 0 ? newProperty : newProperty + "," };
      } else {
        const index = lastSegment > parent.children.length ? parent.children.length : lastSegment;
        const previous = parent.children[index - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      }
      return withFormatting(text, edit, options);
    } else {
      throw new Error(`Can not ${value === void 0 ? "remove" : options.isArrayInsertion ? "insert" : "modify"} Array index ${insertIndex} as length is not sufficient`);
    }
  } else {
    throw new Error(`Can not add ${typeof lastSegment !== "number" ? "index" : "property"} to parent of type ${parent.type}`);
  }
}
function withFormatting(text, edit, options) {
  if (!options.formattingOptions) {
    return [edit];
  }
  let newText = applyEdit(text, edit);
  let begin = edit.offset;
  let end = edit.offset + edit.content.length;
  if (edit.length === 0 || edit.content.length === 0) {
    while (begin > 0 && !isEOL(newText, begin - 1)) {
      begin--;
    }
    while (end < newText.length && !isEOL(newText, end)) {
      end++;
    }
  }
  const edits = format(newText, { offset: begin, length: end - begin }, { ...options.formattingOptions, keepLines: false });
  for (let i3 = edits.length - 1; i3 >= 0; i3--) {
    const edit2 = edits[i3];
    newText = applyEdit(newText, edit2);
    begin = Math.min(begin, edit2.offset);
    end = Math.max(end, edit2.offset + edit2.length);
    end += edit2.content.length - edit2.length;
  }
  const editLength = text.length - (newText.length - end) - begin;
  return [{ offset: begin, length: editLength, content: newText.substring(begin, end) }];
}
function applyEdit(text, edit) {
  return text.substring(0, edit.offset) + edit.content + text.substring(edit.offset + edit.length);
}

// ../../.openclaw/workspace/cat-repos/SNL-Agent-Toolkit/node_modules/jsonc-parser/lib/esm/main.js
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
var parseTree2 = parseTree;
var findNodeAtLocation2 = findNodeAtLocation;
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
function modify(text, path5, value, options) {
  return setProperty(text, path5, value, options);
}
function applyEdits(text, edits) {
  let sortedEdits = edits.slice(0).sort((a3, b2) => {
    const diff = a3.offset - b2.offset;
    if (diff === 0) {
      return a3.length - b2.length;
    }
    return diff;
  });
  let lastModifiedOffset = text.length;
  for (let i3 = sortedEdits.length - 1; i3 >= 0; i3--) {
    let e = sortedEdits[i3];
    if (e.offset + e.length <= lastModifiedOffset) {
      text = applyEdit(text, e);
    } else {
      throw new Error("Overlapping edit");
    }
    lastModifiedOffset = e.offset;
  }
  return text;
}

// lib/snl-doc.ts
import { constants, promises as fs } from "node:fs";
import * as path from "node:path";

// ../../.openclaw/workspace/cat-repos/SNL-Agent-Toolkit/node_modules/@sjtu-ai4math/snl-basics/dist-lib/chunks/template-bHqW1VSc.js
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
  let n3 = e.codePointAt(t2);
  return n3 === void 0 ? null : String.fromCodePoint(n3);
}
function u(e, t2, n3) {
  let r3 = l(e, t2);
  return r3 === null ? 0 : r3.codePointAt(0) <= 127 ? +!!(n3 ? o : s).test(r3) : c.test(r3) ? 0 : r3.length;
}
function d(e) {
  if (e.length === 0) return false;
  let t2 = 0, n3 = u(e, t2, true);
  if (n3 === 0) return false;
  for (t2 += n3; t2 < e.length; ) {
    if (n3 = u(e, t2, false), n3 === 0) return false;
    t2 += n3;
  }
  return true;
}
var f = class extends Error {
  position;
  constructor(e, t2) {
    super(`${e} at position ${t2}`), this.name = "SnlSyntaxTreeParseError", this.position = t2;
  }
};
function p(e, t2) {
  let n3 = e.length - t2;
  if (n3 >= 2 && e[t2] === "`") {
    let n4 = e.indexOf("`", t2 + 1);
    if (n4 < 0) throw new f("Unclosed ` delimiter", t2);
    return {
      token: {
        type: "BACKTICK_DELIMITED",
        value: e.slice(t2 + 1, n4),
        position: t2
      },
      next: n4 + 1
    };
  }
  if (n3 >= 4 && e[t2] === "$" && e[t2 + 1] === "$") {
    let n4 = e.indexOf("$$", t2 + 2);
    if (n4 < 0) throw new f("Unclosed $$ delimiter", t2);
    return {
      token: {
        type: "DOLLAR2_DELIMITED",
        value: e.slice(t2 + 2, n4),
        position: t2
      },
      next: n4 + 2
    };
  }
  if (n3 >= 2 && e[t2] === "$") {
    let n4 = e.indexOf("$", t2 + 1);
    if (n4 < 0) throw new f("Unclosed $ delimiter", t2);
    return {
      token: {
        type: "DOLLAR_DELIMITED",
        value: e.slice(t2 + 1, n4),
        position: t2
      },
      next: n4 + 1
    };
  }
  if (n3 >= 2 && e[t2] === "%") {
    let n4 = e.indexOf("%", t2 + 1);
    if (n4 < 0) throw new f("Unclosed % delimiter", t2);
    return {
      token: {
        type: "PERCENT_DELIMITED",
        value: e.slice(t2 + 1, n4),
        position: t2
      },
      next: n4 + 1
    };
  }
  return null;
}
function m(e) {
  let t2 = [], n3 = 0;
  for (; n3 < e.length; ) {
    let r3 = e[n3];
    if (/[ \t\r\n\f\v]/.test(r3)) {
      n3 += 1;
      continue;
    }
    if (r3 === "%" || r3 === "$" || r3 === "`") {
      let r4 = p(e, n3);
      if (r4) {
        t2.push(r4.token), n3 = r4.next;
        continue;
      }
    }
    if (r3 === "@") {
      t2.push({
        type: "AT",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (r3 === "#") {
      t2.push({
        type: "HASH",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    let i3 = u(e, n3, true);
    if (i3 > 0) {
      let r4 = n3;
      for (n3 += i3; n3 < e.length; ) {
        let t3 = u(e, n3, false);
        if (t3 === 0) break;
        n3 += t3;
      }
      t2.push({
        type: "IDENT",
        value: e.slice(r4, n3),
        position: r4
      });
      continue;
    }
    if (r3 === "[") {
      t2.push({
        type: "LBRACKET",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (r3 === "]") {
      t2.push({
        type: "RBRACKET",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (r3 === "(") {
      t2.push({
        type: "LPAREN",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (r3 === ")") {
      t2.push({
        type: "RPAREN",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (r3 === ",") {
      t2.push({
        type: "COMMA",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (r3 === "=") {
      t2.push({
        type: "EQ",
        value: r3,
        position: n3
      }), n3 += 1;
      continue;
    }
    if (/\d/.test(r3)) {
      let r4 = n3;
      for (; n3 < e.length && /\d/.test(e[n3]); ) n3 += 1;
      t2.push({
        type: "NUMBER",
        value: e.slice(r4, n3),
        position: r4
      });
      continue;
    }
    throw new f(`Unexpected character "${r3}"`, n3);
  }
  return t2.push({
    type: "EOF",
    value: "",
    position: e.length
  }), t2;
}
var h = class {
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
    else throw new f(`Expected macro name (IDENT or %\u2026% / $\u2026$ / $$\u2026$$) but got ${n3.type}`, n3.position);
    if (this.peek().type === "AT") if (this.consume("AT"), this.peek().type === "HASH") {
      if (e) throw new f("Binder name override must not use #", this.peek().position);
      this.consume("HASH");
      let t2 = this.expect("IDENT");
      /^\d+(?:\.\d+)*$/.test(t2.value) ? r3.postfix = {
        type: "tree_path",
        path: t2.value.split(".").map(Number)
      } : r3.postfix = {
        type: "binder_name",
        name: t2.value
      };
    } else {
      let t2 = this.expect("IDENT");
      e ? r3.binder_name = t2.value : r3.postfix = {
        type: "name",
        name: t2.value
      };
    }
    if (this.peek().type === "LBRACKET") {
      this.consume("LBRACKET");
      let e2 = this.expect("IDENT");
      r3.style_name = e2.value, this.expect("RBRACKET");
    }
    if (this.peek().type === "LPAREN" && (this.consume("LPAREN"), r3.children = this.parseNodeList(), this.expect("RPAREN")), e) {
      if (r3.children.length > 0) throw new f("Binder must be a leaf", n3.position);
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
    let t2 = this.peek();
    if (t2.type !== e) throw new f(`Expected ${e} but got ${t2.type}`, t2.position);
    return this.cursor += 1, t2;
  }
  consume(e) {
    return this.expect(e);
  }
  peek() {
    return this.tokens[this.cursor];
  }
};
function g(e, t2 = {}) {
  let n3 = new h(m(e)).parse();
  return _(n3), n3;
}
function _(e, t2 = []) {
  e.env_mode && (e.temporary_source = e.macro_name, e.macro_name = t2.length === 0 ? "#" : `#${t2.join(".")}`), e.binder_explicit && e.binder_name === void 0 && (e.binder_name = e.temporary_source ?? e.macro_name), e.children.forEach((e2, n3) => _(e2, [...t2, n3]));
}

// ../../.openclaw/workspace/cat-repos/SNL-Agent-Toolkit/node_modules/@sjtu-ai4math/snl-basics/dist-lib/chunks/source-metrics-BZAk_eo6.js
function n2(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) return false;
  let t2 = e;
  if (t2.type !== "i18n" || typeof t2.default_language != "string" || !t2.values || typeof t2.values != "object" || Array.isArray(t2.values)) return false;
  let n3 = t2.values, r3 = Object.keys(n3);
  return r3.length > 0 && Object.prototype.hasOwnProperty.call(n3, t2.default_language) && typeof n3[t2.default_language] == "string" && r3.every((e2) => typeof n3[e2] == "string");
}
function r(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) return false;
  let r3 = e;
  return typeof r3.style_name != "string" || !d(r3.style_name) || "tag" in r3 || "variadic_left" in r3 || "variadic_join" in r3 || "variadic_right" in r3 || !Array.isArray(r3.tags) || !r3.tags.every((e2) => typeof e2 == "string") || r3.separator !== void 0 && typeof r3.separator != "string" || r3.block_template_name !== void 0 && (r3.mode !== "block" || typeof r3.block_template_name != "string") ? false : r3.mode === "text" ? typeof r3.template == "string" || n2(r3.template) : r3.mode === "formula_inline" || r3.mode === "formula_display" || r3.mode === "block" ? typeof r3.template == "string" : false;
}
function i(e) {
  return Array.isArray(e) && e.every((e2) => typeof e2 == "string");
}
function a(e, n3 = true) {
  if (typeof e.name != "string" || !d(e.name) || typeof e.description != "string" || typeof e.dynamic_arity != "boolean" || (n3 || e.tags !== void 0) && !i(e.tags) || e.kind !== void 0 && typeof e.kind != "string" || !e.source || typeof e.source != "object" || Array.isArray(e.source)) return false;
  let r3 = e.source;
  return i(r3.entries) && i(r3.urls);
}
function s2(e) {
  return !e || typeof e != "object" || Array.isArray(e) ? false : Object.values(e).every((e2) => typeof e2 == "string");
}
function c2(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) return false;
  let t2 = Object.getPrototypeOf(e);
  return t2 === Object.prototype || t2 === null;
}
function d2(e) {
  if (!c2(e)) return false;
  for (let t2 of Object.values(e)) {
    if (!t2 || typeof t2 != "object" || Array.isArray(t2)) return false;
    let e2 = t2;
    if (!a(e2) || !s2(e2.default_style)) return false;
    let n3 = e2.styles;
    if (!n3 || n3.length === 0 || n3.some((e3) => !r(e3) || typeof e3.template != "string")) return false;
    let i3 = n3.map((e3) => e3.style_name);
    if (new Set(i3).size !== i3.length || Object.keys(e2.default_style).some((e3) => e3.trim().length === 0) || Object.values(e2.default_style).some((e3) => !i3.includes(e3))) return false;
  }
  return true;
}
var N = 256;
function P(e, t2) {
  return e.reduce((n3, r3, i3) => i3 === 0 ? r3 : `${n3}${e[i3 - 1] !== "" && r3 !== "" ? `,${t2}` : ","}${r3}`, "");
}
var F = class {
  indentSpaces;
  inlineParenthesisDepth;
  constructor(e = 4, t2 = 3) {
    this.assertIntegerInRange(e, "indentSpaces", N), this.assertIntegerInRange(t2, "inlineParenthesisDepth", 2 ** 53 - 1), this.indentSpaces = e, this.inlineParenthesisDepth = t2;
  }
  format(t2) {
    return this.formatNode(g(t2), 0, " ");
  }
  formatTree(e, t2 = " ") {
    return this.formatNode(e, 0, t2);
  }
  formatNode(e, t2, n3) {
    let r3 = this.formatNodeHead(e);
    if (e.children.length === 0) return r3;
    if (this.parenthesisDepth(e) <= this.inlineParenthesisDepth) return `${r3}(${P(e.children.map((e2) => this.formatNode(e2, 0, n3)), n3)})`;
    let i3 = " ".repeat(this.indentSpaces * (t2 + 1));
    return `${r3}(
${e.children.map((e2) => `${i3}${this.formatNode(e2, t2 + 1, n3)}`).join(",\n")}
${" ".repeat(this.indentSpaces * t2)})`;
  }
  formatNodeHead(e) {
    let t2 = e.binder_explicit ? "@" : "", n3, r3 = e.temporary_source ?? e.macro_name;
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
    let i3 = this.sourceReference(e), a3 = i3 === void 0 ? "" : `@${i3}`, o2 = e.style_name === void 0 ? "" : `[${e.style_name}]`;
    return `${t2}${n3}${a3}${o2}`;
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
  assertIntegerInRange(e, t2, n3) {
    if (!Number.isSafeInteger(e) || e < 0 || e > n3) throw RangeError(`${t2} must be a non-negative integer no greater than ${n3}`);
  }
  parenthesisDepth(e) {
    let t2 = -1;
    for (let n3 of e.children) t2 = Math.max(t2, this.parenthesisDepth(n3));
    return t2 + 1;
  }
};
var I = new F(0, 2 ** 53 - 1);

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
  let invalid = false;
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
      else invalid = true;
      index = end - 1;
    } else {
      invalid = true;
    }
  }
  return { variadic, arity: max + 1, invalid };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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
    if (!isRecord2(value) || value.format !== "snl-macro" || value.version !== MACRO_STORAGE_VERSION || typeof value.package !== "string" || !isRecord2(value.macro) || typeof value.macro.name !== "string" || !value.macro.name || value.macro.name !== value.macro.name.trim()) {
      throw new Error(`${relativePath} is not a valid SNL Macro envelope.`);
    }
    assertCompatibleSchemaMarker(value, CURRENT_MACRO_SCHEMA_VERSION, `${relativePath} Macro envelope`);
    const macroDocument = /* @__PURE__ */ Object.create(null);
    macroDocument[value.macro.name] = value.macro;
    const currentMacro = usesCurrentEntitySchemas(config);
    if (currentMacro ? !isMacroDocumentV11(macroDocument) : !d2(macroDocument)) {
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
  for (const manifest of [...manifests.values()].sort((a3, b2) => a3.id.localeCompare(b2.id))) {
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

// lib/workspace-data-lock.ts
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { open, readFile, unlink } from "node:fs/promises";
import * as path2 from "node:path";
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
  const lockPath = path2.join(workspaceRoot, ".SNL_Doc", DATA_WRITE_LOCK_FILENAME);
  const record = {
    version: 1,
    pid: process.pid,
    hostname: hostname(),
    token: randomUUID(),
    purpose,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    const handle = await open(lockPath, "wx", 384);
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
function sha256(value) {
  return createHash2("sha256").update(value).digest("hex");
}
function comparePlannedOutput(left, right) {
  return left.sourceFile.localeCompare(right.sourceFile) || left.targetFile.localeCompare(right.targetFile) || left.sha256.localeCompare(right.sha256);
}
function canonicalJson(value) {
  if (value === void 0 || typeof value === "function" || typeof value === "symbol") return void 0;
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item) ?? "null").join(",")}]`;
  }
  const fields = Object.keys(value).sort().flatMap((key) => {
    const encoded = canonicalJson(value[key]);
    return encoded === void 0 ? [] : [`${JSON.stringify(key)}:${encoded}`];
  });
  return `{${fields.join(",")}}`;
}
function planFingerprint(plan) {
  const payload = Object.fromEntries(Object.entries(plan).filter(([key]) => key !== "fingerprint"));
  return sha256(canonicalJson(payload) ?? "");
}
function fingerprintPlan(payload) {
  const plan = payload;
  plan.fingerprint = planFingerprint(plan);
  return plan;
}
function sameCanonicalPlan(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}
async function renameEntityId(workspaceRoot, entityType, oldId, newId, options = {}) {
  const canonicalWorkspace = await validateWorkspaceBoundary(workspaceRoot);
  if (options.dryRun) {
    return renameEntityIdUnlocked(canonicalWorkspace, entityType, oldId, newId, options);
  }
  return withWorkspaceDataLock(canonicalWorkspace, `rename ${entityType} identity`, () => renameEntityIdUnlocked(canonicalWorkspace, entityType, oldId, newId, options));
}
async function renameEntityIdUnlocked(canonicalWorkspace, entityType, oldId, newId, options, expectedPlan) {
  validateNonEmptyIdentity(oldId);
  validateNonEmptyIdentity(newId);
  if (entityType === "macro" && /[@#$%\s()[\]{}]/u.test(newId)) {
    throw new Error(
      `Macro id '${newId}' contains a character forbidden by the SNL-Doc macro schema.`
    );
  }
  if (oldId === newId) throw new Error("Old and new ids are identical.");
  const files = await loadWorkspaceJson(canonicalWorkspace);
  const occurrences = collectOccurrences(files, entityType, oldId).sort(compareOccurrence);
  const definitions = occurrences.filter((o2) => o2.role === "definition");
  if (definitions.length === 0) {
    throw new Error(`No ${entityType} definition found for '${oldId}'.`);
  }
  if (definitions.length !== 1) {
    throw new Error(
      `Expected one ${entityType} definition for '${oldId}', found ${definitions.length}; resolve the identity collision before renaming.`
    );
  }
  if (occurrences.some((o2) => o2.path.endsWith(".content.snl")) && !isTraceableSnlIdentity(entityType, newId)) {
    throw new Error(
      `${entityType} id '${newId}' is not representable as an SNL identifier, but '${oldId}' has SNL references.`
    );
  }
  const destinationOccurrences = collectOccurrences(files, entityType, newId, {
    includeUnresolvedMacroTokens: entityType === "macro"
  });
  if (destinationOccurrences.length > 0) {
    throw new Error(
      `${entityType} id '${newId}' already appears in ${destinationOccurrences.length} structured location(s); refusing to merge two identities.`
    );
  }
  const rewriteSnlMacroTokens = entityType !== "macro" || macroIsActive(files, oldId);
  const currentWorkspace = usesCurrentEntitySchemas(files.find((file) => file.relPath === "config.json")?.data);
  const changed = /* @__PURE__ */ new Map();
  for (const file of files) {
    const edits = buildStructuredEdits(
      file,
      entityType,
      oldId,
      newId,
      rewriteSnlMacroTokens
    );
    if (edits.length > 0) {
      let targetRelPath = file.relPath;
      if (entityType === "entry" && /^entries\/[^/]+\.json$/.test(file.relPath) && file.data?.entry?.id === oldId) {
        targetRelPath = entryEntityPath(file.data.package, newId);
      } else if (entityType === "macro" && /^macros\/[^/]+\.json$/.test(file.relPath) && file.data?.macro?.name === oldId) {
        targetRelPath = macroEntityPath(file.data.package, newId);
      }
      let next = applyTextEdits(file.raw, edits);
      if (currentWorkspace && /^entries\/[^/]+\.json$/.test(file.relPath)) {
        next = stampSchemaVersion(next, CURRENT_ENTRY_SCHEMA_VERSION);
      } else if (currentWorkspace && /^macros\/[^/]+\.json$/.test(file.relPath)) {
        next = stampSchemaVersion(next, CURRENT_MACRO_SCHEMA_VERSION);
      }
      changed.set(file.absPath, {
        ...file,
        next,
        targetAbsPath: path3.join(file.docRoot, targetRelPath),
        targetRelPath
      });
    }
  }
  const plan = fingerprintPlan({
    entityType,
    oldId,
    newId,
    occurrences,
    changedFiles: [...changed.values()].map((f3) => f3.targetRelPath).sort(),
    sourceRevisions: files.map((file) => ({
      file: file.relPath,
      sha256: createHash2("sha256").update(file.raw).digest("hex")
    })),
    plannedOutputs: [...changed.values()].map((file) => ({
      sourceFile: file.relPath,
      targetFile: file.targetRelPath,
      sha256: sha256(file.next)
    })).sort(comparePlannedOutput)
  });
  if (expectedPlan && !sameCanonicalPlan(plan, expectedPlan)) {
    throw new Error("Rename plan is stale because workspace sources or planned outputs changed; rescan before applying.");
  }
  if (options.dryRun || changed.size === 0) return plan;
  const replacements = [...changed.values()].map((file) => ({
    ...file,
    temp: `${file.targetAbsPath}.snl-rename-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`
  }));
  try {
    await Promise.all(
      replacements.map(async (file) => {
        await assertCanonicalDirectory(path3.dirname(file.targetAbsPath), file.docRoot);
        if (file.targetAbsPath !== file.absPath && await pathExistsNoFollow(file.targetAbsPath)) {
          throw new Error(`Rename destination already exists: ${file.targetAbsPath}.`);
        }
        await fs2.writeFile(file.temp, file.next, {
          encoding: "utf8",
          mode: file.mode,
          flag: "wx"
        });
        await fs2.chmod(file.temp, file.mode);
      })
    );
    if (options.beforeInstall) await options.beforeInstall();
    for (const file of replacements) await assertUnchangedRegularFile(file);
    const installed = [];
    try {
      for (const file of replacements) {
        if (options.beforeInstallFile) await options.beforeInstallFile(file.relPath);
        await assertUnchangedRegularFile(file);
        await assertCanonicalDirectory(path3.dirname(file.targetAbsPath), file.docRoot);
        if (file.targetAbsPath !== file.absPath && await pathExistsNoFollow(file.targetAbsPath)) {
          throw new Error(`Rename destination already exists: ${file.targetAbsPath}.`);
        }
        if (file.targetAbsPath === file.absPath) {
          await fs2.rename(file.temp, file.absPath);
          installed.push(file);
        } else {
          await fs2.link(file.temp, file.targetAbsPath);
          installed.push(file);
          await fs2.rm(file.temp);
          await fs2.rm(file.absPath);
        }
      }
      const verifiedFiles = await loadWorkspaceJson(canonicalWorkspace);
      const stale = collectOccurrences(verifiedFiles, entityType, oldId);
      const current = collectOccurrences(verifiedFiles, entityType, newId);
      const currentDefinitions = current.filter((o2) => o2.role === "definition");
      if (stale.length !== 0 || current.length !== occurrences.length || currentDefinitions.length !== 1) {
        throw new Error(
          `Post-write verification failed: old=${stale.length}, new=${current.length}, definitions=${currentDefinitions.length}, expected=${occurrences.length}.`
        );
      }
    } catch (error) {
      const rollbackFailures = (await Promise.all(installed.map(async (file) => {
        try {
          if (options.beforeRestoreFile) await options.beforeRestoreFile(file.relPath);
          await restoreReplacement(file);
          return null;
        } catch (rollbackError) {
          return `${file.relPath}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`;
        }
      }))).filter((message) => message !== null);
      if (rollbackFailures.length > 0) {
        const original = error instanceof Error ? error.message : String(error);
        const combined = new Error(
          `${original} Rollback failed for ${rollbackFailures.join("; ")}. Workspace may be inconsistent.`
        );
        combined.cause = error;
        throw combined;
      }
      throw error;
    }
  } finally {
    await Promise.all(replacements.map((f3) => fs2.rm(f3.temp, { force: true })));
  }
  return plan;
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
    const bare = path3.posix.basename(file.relPath, ".json");
    if (active && !active.has(bare)) return false;
    const macros = file.data?.macros;
    return isRecord3(macros) && Object.prototype.hasOwnProperty.call(macros, id);
  });
}
function collectOccurrences(files, entityType, id, options = {}) {
  const out = [];
  const includeSnlMacroTokens = entityType !== "macro" || options.includeUnresolvedMacroTokens === true || macroIsActive(files, id);
  for (const file of files) {
    collectFileOccurrences(file, entityType, id, out, includeSnlMacroTokens);
  }
  return out;
}
function collectFileOccurrences(file, entityType, id, out, includeSnlMacroTokens) {
  const data = file.data;
  if (/^packages\/[^/]+\.json$/.test(file.relPath)) {
    if (entityType === "entry" && Array.isArray(data?.entry_ids)) {
      data.entry_ids.forEach((entryId, index) => {
        if (entryId === id) {
          out.push(occurrence(file, entityType, id, "reference", `entry_ids[${index}]`));
        }
      });
    }
    return;
  }
  if (/^entries\/[^/]+\.json$/.test(file.relPath)) {
    const entry = data?.entry;
    if (entityType === "entry" && entry?.id === id) {
      out.push(occurrence(file, entityType, id, "definition", "entry.id"));
    }
    const snl = entry?.content?.snl;
    if (typeof snl === "string" && snl.trim() !== "") {
      for (const ref of scanSnlReferences(snl, {
        postfixedMacroNames: entityType === "macro" && includeSnlMacroTokens ? /* @__PURE__ */ new Set([id]) : void 0
      })) {
        if (ref.entityType !== entityType || ref.id !== id) continue;
        if (entityType === "macro" && !includeSnlMacroTokens) continue;
        const pos = offsetPosition(snl, ref.start);
        out.push({
          ...occurrence(file, entityType, id, "reference", "entry.content.snl"),
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
    if (entityType === "macro" && macro?.name === id) {
      out.push(occurrence(file, entityType, id, "definition", "macro.name"));
    }
    if (entityType === "entry" && Array.isArray(macro?.source?.entries)) {
      macro.source.entries.forEach((entryId, index) => {
        if (entryId === id) {
          out.push(occurrence(file, entityType, id, "reference", `macro.source.entries[${index}]`));
        }
      });
    }
    return;
  }
  if (file.relPath === "entries.json" && Array.isArray(data)) {
    data.forEach((entry, index) => {
      if (entityType === "entry" && entry?.id === id) {
        out.push(occurrence(file, entityType, id, "definition", `[${index}].id`));
      }
      const snl = entry?.content?.snl;
      if (typeof snl === "string" && snl.trim() !== "") {
        for (const ref of scanSnlReferences(snl, {
          postfixedMacroNames: entityType === "macro" && includeSnlMacroTokens ? /* @__PURE__ */ new Set([id]) : void 0
        })) {
          if (ref.entityType !== entityType || ref.id !== id) continue;
          if (entityType === "macro" && !includeSnlMacroTokens) continue;
          const pos = offsetPosition(snl, ref.start);
          out.push({
            ...occurrence(file, entityType, id, "reference", `[${index}].content.snl`),
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
    const macros = data?.macros;
    if (!macros || typeof macros !== "object" || Array.isArray(macros)) return;
    for (const [macroId, macro] of Object.entries(macros)) {
      if (entityType === "macro" && macroId === id) {
        out.push(occurrence(file, entityType, id, "definition", `macros[${JSON.stringify(macroId)}]`));
      }
      if (entityType === "entry" && Array.isArray(macro?.source?.entries)) {
        macro.source.entries.forEach((entryId, index) => {
          if (entryId === id) {
            out.push(
              occurrence(
                file,
                entityType,
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
  if (entityType === "entry" && /^libraries\/[^/]+\/graph\.json$/.test(file.relPath) && Array.isArray(data?.nodes)) {
    data.nodes.forEach((node, index) => {
      if (node?.props?.entryId === id) {
        out.push(occurrence(file, entityType, id, "reference", `nodes[${index}].props.entryId`));
      }
    });
  } else if (file.relPath === "relationships.json" && Array.isArray(data?.relationships)) {
    data.relationships.forEach((rel, index) => {
      if (entityType === "entry" && rel?.from === id) {
        out.push(occurrence(file, entityType, id, "reference", `relationships[${index}].from`));
      }
      if (entityType === "entry" && rel?.to === id) {
        out.push(occurrence(file, entityType, id, "reference", `relationships[${index}].to`));
      }
      if (rel?.metadata?.generator !== "macro-source-scan") return;
      const witnessField = entityType === "macro" ? "macros" : "postfixes";
      const witnesses = rel.metadata[witnessField];
      if (!Array.isArray(witnesses)) return;
      witnesses.forEach((value, witnessIndex) => {
        if (value === id) {
          out.push(
            occurrence(
              file,
              entityType,
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
function buildStructuredEdits(file, entityType, oldId, newId, rewriteSnlMacroTokens) {
  const edits = [];
  const data = file.data;
  if (/^packages\/[^/]+\.json$/.test(file.relPath)) {
    if (entityType === "entry" && Array.isArray(data?.entry_ids) && data.entry_ids.includes(oldId)) {
      const entryIds = data.entry_ids.map((value) => value === oldId ? newId : value);
      edits.push(jsonValueEdit(
        file,
        ["entry_ids"],
        [...entryIds].sort((left, right) => String(left).localeCompare(String(right)))
      ));
    }
    return edits;
  }
  if (/^entries\/[^/]+\.json$/.test(file.relPath)) {
    const entry = data?.entry;
    if (entityType === "entry" && entry?.id === oldId) {
      edits.push(stringValueEdit(file, ["entry", "id"], newId));
    }
    if (typeof entry?.content?.snl === "string" && entry.content.snl.trim() !== "" && (entityType !== "macro" || rewriteSnlMacroTokens)) {
      const next = replaceSnlReferences(entry.content.snl, entityType, oldId, newId);
      if (next !== entry.content.snl) {
        edits.push(stringValueEdit(file, ["entry", "content", "snl"], next));
      }
    }
    return edits;
  }
  if (/^macros\/[^/]+\.json$/.test(file.relPath)) {
    const macro = data?.macro;
    if (entityType === "macro" && macro?.name === oldId) {
      edits.push(stringValueEdit(file, ["macro", "name"], newId));
    }
    if (entityType === "entry" && Array.isArray(macro?.source?.entries)) {
      macro.source.entries.forEach((value, index) => {
        if (value === oldId) {
          edits.push(stringValueEdit(file, ["macro", "source", "entries", index], newId));
        }
      });
    }
    return edits;
  }
  if (file.relPath === "entries.json" && Array.isArray(data)) {
    data.forEach((entry, index) => {
      if (entityType === "entry" && entry?.id === oldId) {
        edits.push(stringValueEdit(file, [index, "id"], newId));
      }
      if (typeof entry?.content?.snl === "string" && entry.content.snl.trim() !== "" && (entityType !== "macro" || rewriteSnlMacroTokens)) {
        const next = replaceSnlReferences(entry.content.snl, entityType, oldId, newId);
        if (next !== entry.content.snl) {
          edits.push(stringValueEdit(file, [index, "content", "snl"], next));
        }
      }
    });
    return edits;
  }
  if (file.relPath.startsWith("term_macros/")) {
    const macros = data?.macros;
    if (!macros || typeof macros !== "object" || Array.isArray(macros)) return edits;
    if (entityType === "macro" && Object.prototype.hasOwnProperty.call(macros, oldId)) {
      edits.push(propertyKeyEdit(file, ["macros", oldId], newId));
    }
    if (entityType === "entry") {
      for (const [macroId, macro] of Object.entries(macros)) {
        if (!Array.isArray(macro?.source?.entries)) continue;
        macro.source.entries.forEach((value, index) => {
          if (value === oldId) {
            edits.push(stringValueEdit(file, ["macros", macroId, "source", "entries", index], newId));
          }
        });
      }
    }
    return edits;
  }
  if (entityType === "entry" && /^libraries\/[^/]+\/graph\.json$/.test(file.relPath) && Array.isArray(data?.nodes)) {
    data.nodes.forEach((node, index) => {
      if (node?.props?.entryId === oldId) {
        edits.push(stringValueEdit(file, ["nodes", index, "props", "entryId"], newId));
      }
    });
  } else if (file.relPath === "relationships.json" && Array.isArray(data?.relationships)) {
    data.relationships.forEach((rel, index) => {
      if (entityType === "entry" && rel?.from === oldId) {
        edits.push(stringValueEdit(file, ["relationships", index, "from"], newId));
      }
      if (entityType === "entry" && rel?.to === oldId) {
        edits.push(stringValueEdit(file, ["relationships", index, "to"], newId));
      }
      if (rel?.metadata?.generator !== "macro-source-scan") return;
      const witnessField = entityType === "macro" ? "macros" : "postfixes";
      const witnesses = rel.metadata[witnessField];
      if (!Array.isArray(witnesses)) return;
      witnesses.forEach((value, witnessIndex) => {
        if (value === oldId) {
          edits.push(
            stringValueEdit(
              file,
              ["relationships", index, "metadata", witnessField, witnessIndex],
              newId
            )
          );
        }
      });
    });
  }
  return edits;
}
function stringValueEdit(file, jsonPath, value) {
  const node = findNodeAtLocation2(file.tree, jsonPath);
  if (!node || node.type !== "string") {
    throw new Error(`${file.absPath}: expected string at ${JSON.stringify(jsonPath)}.`);
  }
  return { offset: node.offset, length: node.length, content: JSON.stringify(value) };
}
function jsonValueEdit(file, jsonPath, value) {
  const node = findNodeAtLocation2(file.tree, jsonPath);
  if (!node) throw new Error(`${file.absPath}: expected value at ${JSON.stringify(jsonPath)}.`);
  return { offset: node.offset, length: node.length, content: JSON.stringify(value) };
}
function stampSchemaVersion(raw, schemaVersion) {
  const edits = modify(raw, ["schema_version"], schemaVersion, {
    formattingOptions: { insertSpaces: true, tabSize: 2, eol: raw.includes("\r\n") ? "\r\n" : "\n" }
  });
  return applyEdits(raw, edits);
}
function propertyKeyEdit(file, valuePath, key) {
  const valueNode = findNodeAtLocation2(file.tree, valuePath);
  const keyNode = valueNode?.parent?.children?.[0];
  if (!valueNode || valueNode.parent?.type !== "property" || !keyNode || keyNode.type !== "string") {
    throw new Error(`${file.absPath}: expected property at ${JSON.stringify(valuePath)}.`);
  }
  return { offset: keyNode.offset, length: keyNode.length, content: JSON.stringify(key) };
}
function applyTextEdits(raw, edits) {
  const ordered = [...edits].sort((a3, b2) => b2.offset - a3.offset);
  for (let i3 = 1; i3 < ordered.length; i3++) {
    if (ordered[i3 - 1].offset < ordered[i3].offset + ordered[i3].length) {
      throw new Error("Internal error: overlapping JSON source edits.");
    }
  }
  let next = raw;
  for (const edit of ordered) {
    next = next.slice(0, edit.offset) + edit.content + next.slice(edit.offset + edit.length);
  }
  return next;
}
function scanSnlReferences(source, options = {}) {
  g(source);
  const tokens = tokenizeSnl(source);
  const refs = [];
  for (let i3 = 0; i3 < tokens.length; i3++) {
    const token = tokens[i3];
    if (token.type !== "ident") continue;
    const prev = tokens[i3 - 1];
    const next = tokens[i3 + 1];
    if (prev?.type === "lbracket" || prev?.type === "hash") continue;
    if (prev?.type === "at" && !isPostfixAt(tokens[i3 - 2])) continue;
    if (next?.type === "at") {
      if (options.postfixedMacroNames?.has(token.value)) {
        refs.push({ entityType: "macro", id: token.value, start: token.start, end: token.end });
      }
      continue;
    }
    if (prev?.type === "at" && isPostfixAt(tokens[i3 - 2])) {
      refs.push({ entityType: "entry", id: token.value, start: token.start, end: token.end });
      continue;
    }
    if (/^\d+(?:\.\d+)*$/.test(token.value)) continue;
    refs.push({ entityType: "macro", id: token.value, start: token.start, end: token.end });
  }
  return refs;
}
function replaceSnlReferences(source, entityType, oldId, newId) {
  const matches = scanSnlReferences(source, {
    postfixedMacroNames: entityType === "macro" ? /* @__PURE__ */ new Set([oldId]) : void 0
  }).filter((r3) => r3.entityType === entityType && r3.id === oldId);
  let next = source;
  for (const match of matches.reverse()) {
    next = next.slice(0, match.start) + newId + next.slice(match.end);
  }
  return next;
}
function isPostfixAt(previous) {
  return previous !== void 0 && ["ident", "delimited", "rparen", "rbracket"].includes(previous.type);
}
function tokenizeSnl(source) {
  const tokens = [];
  let i3 = 0;
  while (i3 < source.length) {
    const ch = source[i3];
    if (/\s/.test(ch)) {
      i3++;
      continue;
    }
    if (ch === "$" || ch === "%" || ch === "`") {
      const delimiter = ch === "$" && source[i3 + 1] === "$" ? "$$" : ch;
      const close = source.indexOf(delimiter, i3 + delimiter.length);
      if (close < 0) throw new Error(`Malformed SNL: unclosed ${delimiter} delimiter at offset ${i3}.`);
      tokens.push({ type: "delimited", value: source.slice(i3, close + delimiter.length), start: i3, end: close + delimiter.length });
      i3 = close + delimiter.length;
      continue;
    }
    if (/[A-Za-z0-9_\\]/.test(ch)) {
      const start = i3++;
      while (i3 < source.length && /[A-Za-z0-9_.\-]/.test(source[i3])) i3++;
      tokens.push({ type: "ident", value: source.slice(start, i3), start, end: i3 });
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
    const type = punctuation[ch];
    if (!type) throw new Error(`Malformed SNL: unexpected character ${JSON.stringify(ch)} at offset ${i3}.`);
    tokens.push({ type, value: ch, start: i3, end: i3 + 1 });
    i3++;
  }
  return tokens;
}
async function validateWorkspaceBoundary(workspaceRoot) {
  const requestedRoot = path3.resolve(workspaceRoot);
  let canonicalRoot;
  try {
    canonicalRoot = await fs2.realpath(requestedRoot);
  } catch {
    throw new Error(`Workspace root does not exist: ${requestedRoot}`);
  }
  const rootStat = await fs2.lstat(canonicalRoot);
  if (!rootStat.isDirectory()) throw new Error(`Workspace root is not a directory: ${canonicalRoot}`);
  const requestedDoc = path3.join(requestedRoot, ".SNL_Doc");
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
  const expectedDoc = path3.join(canonicalRoot, ".SNL_Doc");
  if (canonicalDoc !== expectedDoc) {
    throw new Error(`${requestedDoc} escapes the canonical workspace boundary.`);
  }
  return canonicalRoot;
}
async function assertCanonicalDirectory(dir, docRoot) {
  const stat = await fs2.lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${dir} must be a real directory, not a symlink.`);
  }
  const real = await fs2.realpath(dir);
  const relative2 = path3.relative(docRoot, real);
  if (relative2.startsWith("..") || path3.isAbsolute(relative2)) {
    throw new Error(`${dir} escapes the canonical .SNL_Doc boundary.`);
  }
}
async function workspaceUsesEntityStorage(root) {
  const configPath2 = path3.join(root, "config.json");
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
  const directory = path3.join(root, relativeDirectory);
  try {
    await assertCanonicalDirectory(directory, root);
    for (const entry of await fs2.readdir(directory, { withFileTypes: true })) {
      const absolute = path3.join(directory, entry.name);
      if (entry.name.endsWith(".json") && entry.isSymbolicLink()) {
        throw new Error(`${absolute} must not be a symlink.`);
      }
      if (entry.isFile() && entry.name.endsWith(".json")) {
        candidates.push(path3.join(relativeDirectory, entry.name));
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
  const libraryRoot = path3.join(root, "libraries");
  try {
    await assertCanonicalDirectory(libraryRoot, root);
    const libraries = await fs2.readdir(libraryRoot, { withFileTypes: true });
    for (const entry of libraries) {
      if (!entry.name.startsWith(".") && entry.isSymbolicLink()) {
        throw new Error(`${path3.join(libraryRoot, entry.name)} must not be a symlink.`);
      }
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        await assertCanonicalDirectory(path3.join(libraryRoot, entry.name), root);
        candidates.push(path3.join("libraries", entry.name, "graph.json"));
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const unique = [...new Set(candidates)].sort();
  const loaded = [];
  for (const relPath of unique) {
    const absPath = path3.join(root, relPath);
    await assertCanonicalDirectory(path3.dirname(absPath), root);
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
    const tree = parseTree2(raw, errors, { disallowComments: true, allowTrailingComma: false });
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
    const rel = relPath.split(path3.sep).join("/");
    validateSchemaShape(absPath, rel, data);
    loaded.push({
      absPath,
      relPath: rel,
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
    for (const property of node.children ?? []) {
      const key = property.children?.[0]?.value;
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
    if (!isRecord3(value)) fail("config.json must be an object.");
    if (value.active_macro_packages !== void 0 && (!Array.isArray(value.active_macro_packages) || !value.active_macro_packages.every((item) => typeof item === "string"))) {
      fail("config.active_macro_packages must be a string array when present.");
    }
    return;
  }
  if (/^packages\/[^/]+\.json$/.test(relPath)) {
    if (!isRecord3(value) || value.format !== "snl-package" || value.version !== 1 || typeof value.id !== "string" || typeof value.name !== "string" || typeof value.description !== "string") {
      fail("Package manifest must use the snl-package v1 envelope.");
    }
    if (relPath !== packageManifestPath(value.id)) fail("Package manifest path does not match its logical identity.");
    return;
  }
  if (/^entries\/[^/]+\.json$/.test(relPath)) {
    if (!isRecord3(value) || value.format !== "snl-entry" || value.version !== 1 || typeof value.package !== "string" || !isRecord3(value.entry) || typeof value.entry.id !== "string" || !isRecord3(value.entry.content) || value.entry.package !== value.package) {
      fail("Entry entity must use the snl-entry v1 envelope with matching Package identity.");
    }
    if (relPath !== entryEntityPath(value.package, value.entry.id)) fail("Entry entity path does not match its logical identity.");
    if (value.entry.content.snl !== void 0 && typeof value.entry.content.snl !== "string") {
      fail("Entry content.snl must be a string when present.");
    }
    return;
  }
  if (/^macros\/[^/]+\.json$/.test(relPath)) {
    if (!isRecord3(value) || value.format !== "snl-macro" || value.version !== 1 || typeof value.package !== "string" || !isRecord3(value.macro) || typeof value.macro.name !== "string" || !isRecord3(value.macro.source) || !Array.isArray(value.macro.source.entries) || !value.macro.source.entries.every((item) => typeof item === "string")) {
      fail("Macro entity must use the snl-macro v1 envelope with source.entries[].");
    }
    if (relPath !== macroEntityPath(value.package, value.macro.name)) fail("Macro entity path does not match its logical identity.");
    return;
  }
  if (relPath === "entries.json") {
    if (!Array.isArray(value)) fail("entries.json must be an array.");
    value.forEach((entry, index) => {
      if (!isRecord3(entry) || typeof entry.id !== "string" || !isRecord3(entry.content)) {
        fail(`entry ${index} must contain string id and object content.`);
      }
      if (entry.content.snl !== void 0 && typeof entry.content.snl !== "string") {
        fail(`entry ${index} content.snl must be a string when present.`);
      }
    });
    return;
  }
  if (relPath.startsWith("term_macros/")) {
    if (!isRecord3(value) || !isRecord3(value.macros)) fail("macro package must contain an object macros map.");
    for (const [name, macro] of Object.entries(value.macros)) {
      if (!isRecord3(macro) || !isRecord3(macro.source) || !Array.isArray(macro.source.entries)) {
        fail(`macro ${JSON.stringify(name)} must contain source.entries[].`);
      }
      if (!macro.source.entries.every((item) => typeof item === "string")) {
        fail(`macro ${JSON.stringify(name)} source.entries must contain only strings.`);
      }
    }
    return;
  }
  if (/^libraries\/[^/]+\/graph\.json$/.test(relPath)) {
    if (!isRecord3(value) || !Array.isArray(value.nodes) || !Array.isArray(value.relationships)) {
      fail("Library graph must contain nodes[] and relationships[].");
    }
    value.nodes.forEach((node, index) => {
      if (!isRecord3(node) || !isRecord3(node.props)) fail(`graph node ${index} must contain object props.`);
      if (node.props.entryId !== void 0 && typeof node.props.entryId !== "string") {
        fail(`graph node ${index} props.entryId must be a string when present.`);
      }
    });
    return;
  }
  if (relPath === "relationships.json") {
    if (!isRecord3(value) || !Array.isArray(value.relationships)) {
      fail("relationships.json must contain relationships[].");
    }
    value.relationships.forEach((rel, index) => {
      if (!isRecord3(rel) || typeof rel.from !== "string" || typeof rel.to !== "string") {
        fail(`relationship ${index} must contain string from/to.`);
      }
      if (isRecord3(rel.metadata) && rel.metadata.generator === "macro-source-scan") {
        for (const field of ["macros", "postfixes"]) {
          const values = rel.metadata[field];
          if (values !== void 0 && (!Array.isArray(values) || !values.every((v3) => typeof v3 === "string"))) {
            fail(`relationship ${index} metadata.${field} must be a string array when present.`);
          }
        }
      }
    });
  }
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function pathExistsNoFollow(file) {
  try {
    await fs2.lstat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function assertFileContent(filePath, expected, label) {
  let handle;
  try {
    handle = await fs2.open(filePath, constants2.O_RDONLY | constants2.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || await handle.readFile("utf8") !== expected) {
      throw new Error(`${label} changed concurrently; refusing destructive rollback: ${filePath}.`);
    }
  } catch (error) {
    if (error.code === "ELOOP") {
      throw new Error(`${label} became a symlink; refusing destructive rollback: ${filePath}.`);
    }
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}
async function restoreReplacement(file) {
  await assertFileContent(file.targetAbsPath, file.next, "Installed rename output");
  if (file.targetAbsPath !== file.absPath) {
    if (await pathExistsNoFollow(file.absPath)) {
      throw new Error(`Rename source reappeared concurrently; refusing destructive rollback: ${file.absPath}.`);
    }
    await fs2.rm(file.targetAbsPath);
  }
  await restoreOriginal(file);
}
async function restoreOriginal(file) {
  await assertCanonicalDirectory(path3.dirname(file.absPath), file.docRoot);
  const restoreTemp = `${file.absPath}.snl-restore-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`;
  try {
    await fs2.writeFile(restoreTemp, file.raw, {
      encoding: "utf8",
      mode: file.mode,
      flag: "wx"
    });
    await fs2.chmod(restoreTemp, file.mode);
    await fs2.rename(restoreTemp, file.absPath);
  } finally {
    await fs2.rm(restoreTemp, { force: true });
  }
}
async function assertUnchangedRegularFile(file) {
  await assertCanonicalDirectory(path3.dirname(file.absPath), file.docRoot);
  let handle;
  try {
    handle = await fs2.open(file.absPath, constants2.O_RDONLY | constants2.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.dev !== file.device || stat.ino !== file.inode) {
      throw new Error(`${file.absPath} changed identity during rename planning.`);
    }
    if (await handle.readFile("utf8") !== file.raw) {
      throw new Error(`${file.absPath} changed during rename planning; refusing to overwrite it.`);
    }
  } catch (error) {
    if (error.code === "ELOOP") {
      throw new Error(`${file.absPath} became a symlink during rename planning.`);
    }
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}
function validateNonEmptyIdentity(id) {
  if (id.trim() === "") throw new Error("Identity must be a non-empty string.");
}
function isTraceableSnlIdentity(entityType, id) {
  const pattern = entityType === "macro" ? /^[A-Za-z_\\][A-Za-z0-9_.\-]*$/ : /^[A-Za-z0-9_\\][A-Za-z0-9_.\-]*$/;
  return pattern.test(id);
}
function occurrence(file, entityType, id, role, jsonPath) {
  let category;
  if (role === "definition") category = "definition";
  else if (file.relPath.startsWith("packages/") && jsonPath.startsWith("entry_ids[")) category = "package-membership";
  else if (jsonPath.includes(".content.snl")) category = "snl";
  else if (/^libraries\//.test(file.relPath)) category = "library-index";
  else if (jsonPath.includes(".source.entries[")) category = "macro-source";
  else if (jsonPath.includes(".metadata.macros[") || jsonPath.includes(".metadata.postfixes[")) category = "generated-witness";
  else category = "relationship";
  return { entityType, id, role, category, file: file.relPath, path: jsonPath };
}
function offsetPosition(source, offset) {
  const before = source.slice(0, offset).split("\n");
  return { line: before.length, column: before[before.length - 1].length + 1 };
}
function compareOccurrence(a3, b2) {
  return a3.file.localeCompare(b2.file) || a3.path.localeCompare(b2.path) || (a3.offset ?? -1) - (b2.offset ?? -1);
}

// lib/cli-args.ts
function parseArgs(argv, specs) {
  const bySpec = {};
  const shortAlias = {};
  for (const s3 of specs) {
    bySpec[s3.name] = s3;
    if (s3.short) shortAlias[s3.short] = s3.name;
  }
  const flags = {};
  const positional = [];
  for (const s3 of specs) {
    if (s3.default !== void 0) flags[s3.name] = s3.default;
  }
  let i3 = 0;
  let seenDashDash = false;
  while (i3 < argv.length) {
    const tok = argv[i3];
    if (seenDashDash) {
      positional.push(tok);
      i3++;
      continue;
    }
    if (tok === "--") {
      seenDashDash = true;
      i3++;
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
        i3++;
      } else {
        if (inlineVal !== void 0) {
          flags[name] = inlineVal;
          i3++;
        } else {
          const next = argv[i3 + 1];
          if (next === void 0 || next.startsWith("-")) {
            throw new Error(`Flag --${name} requires a value`);
          }
          flags[name] = next;
          i3 += 2;
        }
      }
    } else if (tok.startsWith("-") && tok.length === 2) {
      const short = tok.slice(1);
      const name = shortAlias[short];
      if (!name) throw new Error(`Unknown flag: -${short}`);
      const spec = bySpec[name];
      if (spec.hasValue === false) {
        flags[name] = true;
        i3++;
      } else {
        const next = argv[i3 + 1];
        if (next === void 0 || next.startsWith("-")) {
          throw new Error(`Flag -${short} (--${name}) requires a value`);
        }
        flags[name] = next;
        i3 += 2;
      }
    } else {
      positional.push(tok);
      i3++;
    }
  }
  return { flags, positional };
}
function formatUsage(cliName, synopsis, specs) {
  const lines = [`Usage: ${cliName} ${synopsis}`, "", "Options:"];
  for (const s3 of specs) {
    const flagStr = s3.short ? `-${s3.short}, --${s3.name}` : `    --${s3.name}`;
    const kind = s3.hasValue === false ? "" : " <value>";
    const dflt = s3.default !== void 0 ? ` (default: ${JSON.stringify(s3.default)})` : "";
    lines.push(`  ${flagStr}${kind}${dflt}`);
    if (s3.help) lines.push(`      ${s3.help}`);
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

// bin/impl/rename-id.ts
var TYPE_FLAG = {
  name: "type",
  short: "t",
  hasValue: true,
  help: "Identity type: 'entry' or 'macro'."
};
var DRY_RUN_FLAG = {
  name: "dry-run",
  hasValue: false,
  default: false,
  help: "Validate and print the rename plan without writing files."
};
var SPECS = [ROOT_FLAG, TYPE_FLAG, DRY_RUN_FLAG, JSON_FLAG, HELP_FLAG];
async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), SPECS);
  } catch (error) {
    emitError(error.message, process.argv.slice(2).includes("--json"), true);
    return 2;
  }
  if (parsed.flags.help === true) {
    process.stdout.write(usage() + "\n");
    return 0;
  }
  const type = parsed.flags.type;
  const [oldId, newId] = parsed.positional;
  if (type !== "entry" && type !== "macro" || !oldId || !newId || parsed.positional.length !== 2) {
    emitError("Expected --type entry|macro and exactly <old-id> <new-id>.", parsed.flags.json === true, true);
    return 2;
  }
  try {
    const dryRun = parsed.flags["dry-run"] === true;
    const plan = await renameEntityId(
      path4.resolve(String(parsed.flags.root)),
      type,
      oldId,
      newId,
      { dryRun }
    );
    if (parsed.flags.json === true) {
      process.stdout.write(JSON.stringify({ ...plan, dryRun }, null, 2) + "\n");
    } else {
      process.stdout.write(
        `${dryRun ? "Would rename" : "Renamed"} ${type} '${oldId}' -> '${newId}'
  occurrences: ${plan.occurrences.length}
  files: ${plan.changedFiles.length}
`
      );
      for (const file of plan.changedFiles) process.stdout.write(`    ${file}
`);
    }
    return 0;
  } catch (error) {
    emitError(error.message, parsed.flags.json === true);
    return 2;
  }
  function emitError(message, asJson, includeUsage = false) {
    if (asJson) {
      process.stdout.write(JSON.stringify({ status: "error", code: "rename.failed", message }) + "\n");
    } else {
      process.stderr.write(`${message}${includeUsage ? `

${usage()}` : ""}
`);
    }
  }
}
function usage() {
  return formatUsage("snl-rename-id", "--type entry|macro <old-id> <new-id>", SPECS);
}
process.exitCode = await main();
