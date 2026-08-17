#!/usr/bin/env node

// bin/impl/entry-latex.ts
import * as path2 from "node:path";

// ../../.openclaw/workspace/cat-repos/SNL-Agent-Toolkit/node_modules/@sjtu-ai4math/snl-basics/dist-lib/chunks/template-bHqW1VSc.js
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
var f = class extends Error {
  position;
  constructor(e, t3) {
    super(`${e} at position ${t3}`), this.name = "SnlSyntaxTreeParseError", this.position = t3;
  }
};
function p(e, t3) {
  let n3 = e.length - t3;
  if (n3 >= 2 && e[t3] === "`") {
    let n4 = e.indexOf("`", t3 + 1);
    if (n4 < 0) throw new f("Unclosed ` delimiter", t3);
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
    if (n4 < 0) throw new f("Unclosed $$ delimiter", t3);
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
    if (n4 < 0) throw new f("Unclosed $ delimiter", t3);
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
    if (n4 < 0) throw new f("Unclosed % delimiter", t3);
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
function m(e) {
  let t3 = [], n3 = 0;
  for (; n3 < e.length; ) {
    let r3 = e[n3];
    if (/[ \t\r\n\f\v]/.test(r3)) {
      n3 += 1;
      continue;
    }
    if (r3 === "%" || r3 === "$" || r3 === "`") {
      let r4 = p(e, n3);
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
    let i3 = u(e, n3, true);
    if (i3 > 0) {
      let r4 = n3;
      for (n3 += i3; n3 < e.length; ) {
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
    throw new f(`Unexpected character "${r3}"`, n3);
  }
  return t3.push({
    type: "EOF",
    value: "",
    position: e.length
  }), t3;
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
    let t3 = this.peek();
    if (t3.type !== e) throw new f(`Expected ${e} but got ${t3.type}`, t3.position);
    return this.cursor += 1, t3;
  }
  consume(e) {
    return this.expect(e);
  }
  peek() {
    return this.tokens[this.cursor];
  }
};
function g(e, t3 = {}) {
  let n3 = new h(m(e)).parse();
  return _(n3), n3;
}
function _(e, t3 = []) {
  e.env_mode && (e.temporary_source = e.macro_name, e.macro_name = t3.length === 0 ? "#" : `#${t3.join(".")}`), e.binder_explicit && e.binder_name === void 0 && (e.binder_name = e.temporary_source ?? e.macro_name), e.children.forEach((e2, n3) => _(e2, [...t3, n3]));
}
function v(e) {
  try {
    return {
      ok: true,
      tree: g(e)
    };
  } catch (e2) {
    return e2 instanceof f ? {
      ok: false,
      error: e2.message,
      position: e2.position
    } : {
      ok: false,
      error: e2 instanceof Error ? e2.message : String(e2)
    };
  }
}
function y(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) return e;
  let t3 = { ...e };
  return delete t3.bindRef, Object.keys(t3).length > 0 ? t3 : null;
}
function b(e) {
  return {
    ...e,
    mdata: y(e.mdata),
    postfix: e.postfix?.type === "tree_path" ? {
      type: "tree_path",
      path: [...e.postfix.path]
    } : e.postfix ? { ...e.postfix } : void 0,
    source: void 0,
    children: e.children.map(b)
  };
}
function x(e, t3) {
  return e.length === t3.length && e.every((e2, n3) => e2 === t3[n3]);
}
function S(e, t3) {
  let n3 = 0;
  for (; n3 < e.length && n3 < t3.length && e[n3] === t3[n3]; ) n3 += 1;
  return n3;
}
function C(e, t3, n3) {
  return e.filter((e2) => !n3 || e2.order < t3.order).sort((e2, n4) => S(n4.path, t3.path) - S(e2.path, t3.path) || n4.order - e2.order)[0];
}
function w(e) {
  return e.temporary_source ?? e.macro_name;
}
function T(e, t3) {
  let n3 = b(e), r3 = [], i3 = [], a3 = 0, o2 = (e2, n4) => {
    i3.push({
      node: e2,
      path: n4,
      order: a3++
    }), e2.scope = void 0;
    let s4 = e2.env_mode ? void 0 : t3[e2.macro_name], c3 = n4.length === 0 && e2.env_mode === "text", l3 = s4?.kind === "sub";
    if (c3 || l3 || e2.kind === "sub") e2.kind = "sub", e2.binder_name = void 0, e2.source = void 0, (e2.postfix || e2.binder_explicit) && r3.push({
      code: "SNL_SUB_IGNORES_BINDER_SUFFIX",
      severity: "warning",
      tree_path: [...n4],
      message: "sub nodes ignore binder declarations and postfix sources"
    });
    else if (e2.binder_explicit) e2.kind = "binder", e2.binder_name ??= e2.macro_name;
    else if (s4) {
      if (e2.kind = s4.kind || "const", e2.style_name && !s4.styles.some((t4) => t4.style_name === e2.style_name) && (r3.push({
        code: "SNL_STYLE_NOT_FOUND",
        severity: "warning",
        tree_path: [...n4],
        message: `style ${JSON.stringify(e2.style_name)} was not found; using the first style`
      }), e2.style_name = void 0), e2.postfix?.type === "name" && (e2.binder_name = e2.postfix.name), e2.source = void 0, e2.mdata && typeof e2.mdata == "object") {
        let t4 = { ...e2.mdata };
        delete t4.src, e2.mdata = Object.keys(t4).length > 0 ? t4 : null;
      }
    } else e2.kind && e2.kind !== "bvar" && e2.kind !== "fvar" || (e2.kind = "", e2.binder_name = void 0);
    e2.children.forEach((e3, t4) => o2(e3, [...n4, t4]));
  };
  o2(n3, []);
  let s3 = i3.flatMap((e2) => {
    let t4 = e2.node.binder_name;
    return t4 && (e2.node.kind === "binder" || e2.node.kind !== "" && e2.node.source === void 0) ? [{
      ...e2,
      binderName: t4
    }] : [];
  });
  for (let e2 of i3) {
    let { node: t4, path: n4 } = e2;
    if (t4.kind !== "") continue;
    let a4;
    if (t4.postfix?.type === "name") {
      let e3 = t4.mdata && typeof t4.mdata == "object" ? t4.mdata.srcStatus : void 0;
      e3 === "dangling" || e3 === "srcResolvedNoDecl" ? r3.push({
        code: e3 === "dangling" ? "SNL_ENTRY_SOURCE_NOT_FOUND" : "SNL_ENTRY_SOURCE_NO_DECL",
        severity: "warning",
        tree_path: [...n4],
        message: `Entry source ${JSON.stringify(t4.postfix.name)} did not export this reference`
      }) : a4 = {
        type: "entry",
        entry_id: t4.postfix.name
      };
    } else if (t4.postfix?.type === "tree_path") {
      let e3 = i3.find((e4) => e4.node.kind !== "sub" && x(e4.path, t4.postfix.type === "tree_path" ? t4.postfix.path : []));
      e3 ? a4 = {
        type: "tree_path",
        path: [...e3.path]
      } : r3.push({
        code: "SNL_DANGLING_TREE_SOURCE",
        severity: "warning",
        tree_path: [...n4],
        message: `tree source #${t4.postfix.path.join(".")} does not name a semantic node`
      });
    } else {
      let i4 = t4.postfix?.type === "binder_name" ? t4.postfix.name : w(t4), o3 = C(s3.filter((e3) => e3.binderName === i4), e2, true);
      o3 ? a4 = {
        type: "tree_path",
        path: [...o3.path]
      } : t4.postfix?.type === "binder_name" && r3.push({
        code: "SNL_BINDER_NAME_NOT_FOUND",
        severity: "warning",
        tree_path: [...n4],
        message: `binder source ${JSON.stringify(i4)} was not found in the current context`
      });
    }
    a4 ? (t4.kind = "bvar", t4.source = a4) : (t4.kind = "fvar", t4.source = void 0);
  }
  return {
    tree: n3,
    diagnostics: r3
  };
}

// ../../.openclaw/workspace/cat-repos/SNL-Agent-Toolkit/node_modules/@sjtu-ai4math/snl-basics/dist-lib/chunks/source-metrics-BZAk_eo6.js
function n2(e) {
  if (!e || typeof e != "object" || Array.isArray(e)) return false;
  let t3 = e;
  if (t3.type !== "i18n" || typeof t3.default_language != "string" || !t3.values || typeof t3.values != "object" || Array.isArray(t3.values)) return false;
  let n3 = t3.values, r3 = Object.keys(n3);
  return r3.length > 0 && Object.prototype.hasOwnProperty.call(n3, t3.default_language) && typeof n3[t3.default_language] == "string" && r3.every((e2) => typeof n3[e2] == "string");
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
  let t3 = Object.getPrototypeOf(e);
  return t3 === Object.prototype || t3 === null;
}
function d2(e) {
  if (!c2(e)) return false;
  for (let t3 of Object.values(e)) {
    if (!t3 || typeof t3 != "object" || Array.isArray(t3)) return false;
    let e2 = t3;
    if (!a(e2) || !s2(e2.default_style)) return false;
    let n3 = e2.styles;
    if (!n3 || n3.length === 0 || n3.some((e3) => !r(e3) || typeof e3.template != "string")) return false;
    let i3 = n3.map((e3) => e3.style_name);
    if (new Set(i3).size !== i3.length || Object.keys(e2.default_style).some((e3) => e3.trim().length === 0) || Object.values(e2.default_style).some((e3) => !i3.includes(e3))) return false;
  }
  return true;
}
var N = 256;
function P(e, t3) {
  return e.reduce((n3, r3, i3) => i3 === 0 ? r3 : `${n3}${e[i3 - 1] !== "" && r3 !== "" ? `,${t3}` : ","}${r3}`, "");
}
var F = class {
  indentSpaces;
  inlineParenthesisDepth;
  constructor(e = 4, t3 = 3) {
    this.assertIntegerInRange(e, "indentSpaces", N), this.assertIntegerInRange(t3, "inlineParenthesisDepth", 2 ** 53 - 1), this.indentSpaces = e, this.inlineParenthesisDepth = t3;
  }
  format(t3) {
    return this.formatNode(g(t3), 0, " ");
  }
  formatTree(e, t3 = " ") {
    return this.formatNode(e, 0, t3);
  }
  formatNode(e, t3, n3) {
    let r3 = this.formatNodeHead(e);
    if (e.children.length === 0) return r3;
    if (this.parenthesisDepth(e) <= this.inlineParenthesisDepth) return `${r3}(${P(e.children.map((e2) => this.formatNode(e2, 0, n3)), n3)})`;
    let i3 = " ".repeat(this.indentSpaces * (t3 + 1));
    return `${r3}(
${e.children.map((e2) => `${i3}${this.formatNode(e2, t3 + 1, n3)}`).join(",\n")}
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
    let i3 = this.sourceReference(e), a3 = i3 === void 0 ? "" : `@${i3}`, o2 = e.style_name === void 0 ? "" : `[${e.style_name}]`;
    return `${t3}${n3}${a3}${o2}`;
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
var I = new F(0, 2 ** 53 - 1);

// lib/snl-doc.ts
import { constants, promises as fs } from "node:fs";
import * as path from "node:path";

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
async function readConfig(workspaceRoot) {
  await assertSnlDoc(workspaceRoot);
  const p3 = configPath(workspaceRoot);
  if (!await pathExists(p3)) {
    return { version: "0.0.0" };
  }
  const config = await readJson(p3);
  if (config.version === "0.1.0") assertCurrentKindCatalogs(config);
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
  const current = config.version === "0.1.0" || config.version === "0.0.6";
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
    const manifests = await readEntityPackageManifests(workspaceRoot, config.version === "0.1.0");
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
    if (config.version === "0.1.0") {
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
  const manifests = await readEntityPackageManifests(workspaceRoot, config.version === "0.1.0");
  const macros = /* @__PURE__ */ new Map();
  const identities = /* @__PURE__ */ new Set();
  for (const { relativePath, value } of await readJsonDirectory(macroEntitiesDir(workspaceRoot), true)) {
    if (!isRecord2(value) || value.format !== "snl-macro" || value.version !== MACRO_STORAGE_VERSION || typeof value.package !== "string" || !isRecord2(value.macro) || typeof value.macro.name !== "string" || !value.macro.name || value.macro.name !== value.macro.name.trim()) {
      throw new Error(`${relativePath} is not a valid SNL Macro envelope.`);
    }
    assertCompatibleSchemaMarker(value, CURRENT_MACRO_SCHEMA_VERSION, `${relativePath} Macro envelope`);
    const macroDocument = /* @__PURE__ */ Object.create(null);
    macroDocument[value.macro.name] = value.macro;
    const currentMacro = config.version === "0.1.0";
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
  for (const manifest of [...manifests.values()].sort((a3, b3) => a3.id.localeCompare(b3.id))) {
    defineIdentity(out, manifest.id, {
      version: config.version === "0.1.0" ? "11" : "8",
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

// lib/snl-render.ts
var LATEX_TO_TEXT_CHARS = {
  // Set operations
  "\\cup": "\u222A",
  "\\cap": "\u2229",
  "\\setminus": "\u2216",
  "\\emptyset": "\u2205",
  "\\subseteq": "\u2286",
  "\\subset": "\u2282",
  "\\supseteq": "\u2287",
  "\\supset": "\u2283",
  "\\in": "\u2208",
  "\\notin": "\u2209",
  "\\ni": "\u220B",
  // Logic
  "\\land": "\u2227",
  "\\wedge": "\u2227",
  "\\lor": "\u2228",
  "\\vee": "\u2228",
  "\\lnot": "\xAC",
  "\\neg": "\xAC",
  "\\implies": "\u21D2",
  "\\Rightarrow": "\u21D2",
  "\\Leftrightarrow": "\u21D4",
  "\\iff": "\u21D4",
  "\\forall": "\u2200",
  "\\exists": "\u2203",
  "\\top": "\u22A4",
  "\\bot": "\u22A5",
  // Relations
  "\\leq": "\u2264",
  "\\le": "\u2264",
  "\\geq": "\u2265",
  "\\ge": "\u2265",
  "\\neq": "\u2260",
  "\\ne": "\u2260",
  "\\approx": "\u2248",
  "\\equiv": "\u2261",
  "\\sim": "\u223C",
  "\\cong": "\u2245",
  "\\mapsto": "\u21A6",
  "\\to": "\u2192",
  "\\rightarrow": "\u2192",
  "\\leftarrow": "\u2190",
  "\\leftrightarrow": "\u2194",
  // Arithmetic / operators
  "\\times": "\xD7",
  "\\div": "\xF7",
  "\\pm": "\xB1",
  "\\mp": "\u2213",
  "\\cdot": "\xB7",
  "\\ast": "\u2217",
  "\\star": "\u22C6",
  "\\circ": "\u2218",
  "\\bullet": "\u2022",
  "\\oplus": "\u2295",
  "\\otimes": "\u2297",
  "\\odot": "\u2299",
  "\\ominus": "\u2296",
  // Big operators
  "\\sum": "\u2211",
  "\\prod": "\u220F",
  "\\coprod": "\u2210",
  "\\int": "\u222B",
  "\\iint": "\u222C",
  "\\iiint": "\u222D",
  "\\oint": "\u222E",
  "\\bigcup": "\u22C3",
  "\\bigcap": "\u22C2",
  "\\bigoplus": "\u2295",
  "\\bigotimes": "\u2297",
  // Common symbols
  "\\infty": "\u221E",
  "\\partial": "\u2202",
  "\\nabla": "\u2207",
  "\\hbar": "\u210F",
  "\\ell": "\u2113",
  "\\Re": "\u211C",
  "\\Im": "\u2111",
  "\\aleph": "\u2135",
  "\\wp": "\u2118",
  // Number sets
  "\\mathbb{N}": "\u2115",
  "\\mathbb{Z}": "\u2124",
  "\\mathbb{Q}": "\u211A",
  "\\mathbb{R}": "\u211D",
  "\\mathbb{C}": "\u2102",
  "\\mathbb{F}": "\u{1D53D}",
  "\\mathbb{P}": "\u2119",
  "\\mathbb{H}": "\u210D",
  // Lowercase greek
  "\\alpha": "\u03B1",
  "\\beta": "\u03B2",
  "\\gamma": "\u03B3",
  "\\delta": "\u03B4",
  "\\epsilon": "\u03B5",
  "\\varepsilon": "\u03B5",
  "\\zeta": "\u03B6",
  "\\eta": "\u03B7",
  "\\theta": "\u03B8",
  "\\vartheta": "\u03D1",
  "\\iota": "\u03B9",
  "\\kappa": "\u03BA",
  "\\lambda": "\u03BB",
  "\\mu": "\u03BC",
  "\\nu": "\u03BD",
  "\\xi": "\u03BE",
  "\\pi": "\u03C0",
  "\\varpi": "\u03D6",
  "\\rho": "\u03C1",
  "\\varrho": "\u03F1",
  "\\sigma": "\u03C3",
  "\\varsigma": "\u03C2",
  "\\tau": "\u03C4",
  "\\upsilon": "\u03C5",
  "\\phi": "\u03C6",
  "\\varphi": "\u03D5",
  "\\chi": "\u03C7",
  "\\psi": "\u03C8",
  "\\omega": "\u03C9",
  // Uppercase greek (only the visually-distinct ones)
  "\\Gamma": "\u0393",
  "\\Delta": "\u0394",
  "\\Theta": "\u0398",
  "\\Lambda": "\u039B",
  "\\Xi": "\u039E",
  "\\Pi": "\u03A0",
  "\\Sigma": "\u03A3",
  "\\Upsilon": "\u03A5",
  "\\Phi": "\u03A6",
  "\\Psi": "\u03A8",
  "\\Omega": "\u03A9",
  // Spacing / whitespace
  "\\,": " ",
  "\\;": " ",
  "\\!": "",
  "\\ ": " ",
  "\\quad": "  ",
  "\\qquad": "    ",
  // Ellipsis
  "\\ldots": "\u2026",
  "\\cdots": "\u22EF",
  "\\dots": "\u2026",
  "\\vdots": "\u22EE",
  "\\ddots": "\u22F1",
  // Delimiters (leave the char as-is; drop the \left/\right sizing)
  "\\left": "",
  "\\right": "",
  "\\lVert": "\u2016",
  "\\rVert": "\u2016",
  "\\|": "\u2016",
  "\\lvert": "|",
  "\\rvert": "|",
  "\\langle": "\u27E8",
  "\\rangle": "\u27E9",
  "\\lceil": "\u2308",
  "\\rceil": "\u2309",
  "\\lfloor": "\u230A",
  "\\rfloor": "\u230B"
};
function latexToText(input, notes) {
  let s3 = input;
  const wrappers = [
    "mathrm",
    "mathbf",
    "mathit",
    "mathsf",
    "mathtt",
    "mathcal",
    "mathscr",
    "mathfrak",
    "text",
    "textrm",
    "textbf",
    "textit",
    "textsf",
    "texttt",
    "operatorname",
    "boldsymbol",
    "bm"
  ];
  const wrapperRe = new RegExp(
    `\\\\(?:${wrappers.join("|")})\\s*\\{([^{}]*)\\}`,
    "g"
  );
  for (let i3 = 0; i3 < 5; i3++) {
    const next = s3.replace(wrapperRe, (_2, inner) => inner);
    if (next === s3) break;
    s3 = next;
  }
  const fracRe = /\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g;
  for (let i3 = 0; i3 < 5; i3++) {
    const next = s3.replace(fracRe, (_2, a3, b3) => `(${a3})/(${b3})`);
    if (next === s3) break;
    s3 = next;
  }
  s3 = s3.replace(
    /\\sqrt(?:\[([^\]]*)\])?\s*\{([^{}]*)\}/g,
    (_2, n3, x3) => n3 ? `${n3}\u221A(${x3})` : `\u221A(${x3})`
  );
  const mapped = Object.entries(LATEX_TO_TEXT_CHARS).sort(
    (a3, b3) => b3[0].length - a3[0].length
  );
  for (const [cmd, glyph] of mapped) {
    if (!s3.includes(cmd)) continue;
    const re = new RegExp(
      cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "g"
    );
    s3 = s3.replace(re, glyph);
  }
  const survivorRe = /\\[A-Za-z]+/g;
  const survivors = /* @__PURE__ */ new Set();
  let m3;
  while ((m3 = survivorRe.exec(s3)) !== null) survivors.add(m3[0]);
  for (const cmd of survivors) {
    notes.push(
      `Unmapped LaTeX command in text synth: \`${cmd}\` (survived as-is).`
    );
  }
  s3 = s3.replace(/_\{([^{}]*)\}/g, "_$1").replace(/\^\{([^{}]*)\}/g, "^$1");
  s3 = s3.replace(/[{}]/g, "");
  return s3;
}
function joinVariadic(template, rendered) {
  const defaultSep = template.mode === "text" ? "" : ", ";
  return rendered.join(template.separator ?? defaultSep);
}
function fillTemplate(template, values) {
  const ESCAPED = "HASH";
  let out = template.replace(/\\#/g, ESCAPED);
  out = out.replace(/#(\d{1,2})/g, (_2, d3) => {
    const v3 = values[`child${Number(d3)}`];
    return v3 === void 0 ? `#${d3}` : v3;
  });
  out = out.replace(/#\*/g, () => {
    const j2 = values["children_joined"];
    return j2 === void 0 ? "#*" : j2;
  });
  return out.split(ESCAPED).join("\\#");
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function projectTemplate(value) {
  let candidate = value;
  if (isRecord3(candidate) && candidate.type === "i18n" && typeof candidate.default_language === "string" && isRecord3(candidate.values)) {
    candidate = candidate.values[candidate.default_language] ?? candidate.values.en ?? Object.values(candidate.values)[0];
  }
  if (!isRecord3(candidate) || typeof candidate.mode !== "string" || !["formula_inline", "formula_display", "text", "block"].includes(candidate.mode) || typeof candidate.body !== "string") {
    return void 0;
  }
  return candidate;
}
function normalizeStyle(value) {
  if (!isRecord3(value) || typeof value.style_name !== "string") return void 0;
  const current = projectTemplate(value.template);
  if (current) return { style_name: value.style_name, template: current };
  if (typeof value.mode !== "string" || !["formula_inline", "formula_display", "text", "block"].includes(value.mode) || typeof value.template !== "string") {
    return void 0;
  }
  return {
    style_name: value.style_name,
    template: {
      mode: value.mode,
      body: value.template,
      ...typeof value.separator === "string" ? { separator: value.separator } : {},
      ...isRecord3(value.latex) ? { latex: value.latex } : {},
      ...typeof value.text === "string" ? { text: value.text } : {}
    }
  };
}
function pickStyle(macro, node) {
  if (macro.styles.length === 0) return void 0;
  const requested = node.style_name;
  const legacyDefault = macro.default_style;
  const defaultName = typeof legacyDefault === "string" ? legacyDefault : legacyDefault?.en;
  const selectedName = requested ?? defaultName;
  const selected = selectedName ? macro.styles.find((style) => style.style_name === selectedName) : macro.styles[0];
  if (!selected && requested) {
    throw new Error(`Unknown style "${requested}" for macro "${macro.name}".`);
  }
  return normalizeStyle(selected);
}
function escapeTemporaryText(value) {
  return value.replace(/([\\{}%$#&_])/g, "\\$1").replace(/~/g, "\\textasciitilde{}").replace(/\^/g, "\\textasciicircum{}");
}
function escapeIdent(name) {
  return name.replace(/_/g, "\\_");
}
function ownMacro(macros, name) {
  return Object.hasOwn(macros, name) ? macros[name] : void 0;
}
function wrapForParent(child, parentMode) {
  const childText = child.mode === "text";
  const parentText = parentMode === "text";
  if (!parentText && childText) return `\\text{${child.output}}`;
  if (parentText && !childText && child.mode !== "block") return `$${child.output}$`;
  return child.output;
}
function renderNode(node, mode, macros, notes) {
  const envMode = node.env_mode;
  if (typeof envMode === "string" && envMode.length > 0) {
    const raw = node.temporary_source ?? node.macro_name;
    if (node.temporary_format === "texttt") {
      return { output: mode === "latex" ? `\\texttt{${escapeTemporaryText(raw)}}` : raw, mode: "formula_inline" };
    }
    if (envMode === "text") {
      return { output: mode === "latex" ? escapeTemporaryText(raw) : raw, mode: "text" };
    }
    if (mode === "latex") {
      return { output: raw, mode: envMode };
    }
    return { output: `$${latexToText(raw, notes)}$`, mode: envMode };
  }
  const name = node.macro_name;
  const children = Array.isArray(node.children) ? node.children : [];
  const macro = ownMacro(macros, name);
  if (!macro && children.length === 0) {
    return { output: mode === "latex" ? escapeIdent(name) : name, mode: "formula_inline" };
  }
  if (!macro) {
    const renderedChildren2 = children.map((c3) => renderNode(c3, mode, macros, notes));
    notes.push(
      `Unregistered macro '${name}' \u2014 emitted as \`${name}(...)\` fallback.`
    );
    return { output: `${name}(${renderedChildren2.map((child) => child.output).join(", ")})`, mode: "formula_inline" };
  }
  const style = pickStyle(macro, node);
  if (!style) {
    const renderedChildren2 = children.map((c3) => renderNode(c3, mode, macros, notes));
    notes.push(
      `Macro '${name}' has no styles \u2014 emitted as \`${name}(...)\` fallback.`
    );
    return { output: `${name}(${renderedChildren2.map((child) => child.output).join(", ")})`, mode: "formula_inline" };
  }
  const template = style.template;
  const renderedChildren = children.map((c3) => renderNode(c3, mode, macros, notes));
  const wrappedChildren = mode === "latex" ? renderedChildren.map((child) => wrapForParent(child, template.mode)) : renderedChildren.map((child) => child.output);
  const values = {};
  wrappedChildren.forEach((v3, i3) => {
    values[`child${i3}`] = v3;
  });
  if (macro.dynamic_arity) {
    if (!template.body.includes("#*")) {
      throw new Error(`Dynamic macro '${name}' style '${style.style_name}' requires #* in its template.`);
    }
    values["children_joined"] = joinVariadic(template, wrappedChildren);
  }
  if (mode === "latex") {
    const explicit = template.latex?.synthesis?.macro;
    const src = typeof explicit === "string" && explicit.length > 0 ? explicit : template.body;
    return { output: fillTemplate(src, values), mode: template.mode };
  }
  const explicitText = template.text;
  if (typeof explicitText === "string" && explicitText.length > 0) {
    return { output: fillTemplate(explicitText, values), mode: template.mode };
  }
  const converted = latexToText(template.body, notes);
  return { output: fillTemplate(converted, values), mode: template.mode };
}
function renderTreeAsLatex(tree, macros) {
  const notes = [];
  const output = renderNode(tree, "latex", macros, notes).output;
  return { output, notes: dedupe(notes) };
}
function dedupe(a3) {
  return [...new Set(a3)];
}

// lib/entry-analysis.ts
async function loadEntry(root, id) {
  const [entries, macros] = await Promise.all([readEntries(root), readActiveMacros(root)]);
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Entry not found: ${id}`);
  return { entry, entries, macros };
}
function parseEntry(entry, macros) {
  const snl = entry.content?.snl;
  if (typeof snl !== "string" || !snl.trim()) throw new Error(`Entry ${entry.id} has no SNL content.`);
  const parsed = v(snl);
  if (!parsed.ok) throw new Error(`Entry ${entry.id} SNL parse failed: ${parsed.error}`);
  return T(
    parsed.tree,
    macros
  ).tree;
}
async function computeEntryBareLatex(root, id) {
  const { entry, macros } = await loadEntry(root, id);
  return renderTreeAsLatex(parseEntry(entry, macros), macros);
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

// bin/impl/entry-latex.ts
var SPECS = [ROOT_FLAG, JSON_FLAG, HELP_FLAG];
var usage = () => formatUsage("snl-entry-latex", "[options] <entry-id>", SPECS);
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
    const rendered = await computeEntryBareLatex(path2.resolve(String(parsed.flags.root)), entryId);
    if (rendered.output.includes("\\htmlData")) throw new Error("Internal error: bare LaTeX output contains \\htmlData.");
    const result = { status: "ok", entryId, latex: rendered.output, notes: rendered.notes };
    process.stdout.write(parsed.flags.json === true ? JSON.stringify(result, null, 2) + "\n" : rendered.output + "\n");
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
