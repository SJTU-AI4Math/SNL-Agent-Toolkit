#!/usr/bin/env python3
"""Author the SNL writing-convention Entries in the Toolkit spec workspace.

Canonical mutations only: every entity is created through the unified CLI
(`snl entry create --input -`), never by writing `.SNL_Doc` files by hand.
Idempotent: an already-existing id is reported and skipped.

Run from the repository root:
    python3 CLI_Scripts/author-writing-conventions.py
"""
from __future__ import annotations

import json
import subprocess
import sys

ROOT = "."
PKG = "Skills"
KIND = "entry-kind.concept"
SKILL_MD = "Skills/SNL Ecosystem/SKILL.md"
SUBSECTION_KIND = "2bef5063-2d07-4f35-8f54-e15d7a1c5e59"

# Clause = (prose, [concept refs]). Prose must not contain a bare delimiter
# character outside the text node: the rendered clause is `%prose%(refs)`.
C = tuple[str, list[str]]


def i18n(en: str, zh: str) -> dict:
    return {"type": "i18n", "default_language": "en", "values": {"en": en, "zh-CN": zh}}


def concept(
    entry_id: str, en_title: str, zh_title: str, clauses: list[C]
) -> dict:
    """Build one concept Entry whose SNL body is a single-rooted `__list__`."""
    parts = []
    for prose, refs in clauses:
        parts.append(f"%{prose}%" if not refs else f"%{prose}%({', '.join(refs)})")
    body = "__list__(" + ", ".join(parts) + ")"
    return {
        "id": entry_id,
        "package": PKG,
        "kind": KIND,
        "title": i18n(en_title, zh_title),
        "content": {"snl": body},
        "contribution_info": None,
        "pointer": {
            "file": SKILL_MD,
            "mode": "regex",
            "pattern": rf"^  \* \*\*{en_title} \({zh_title}\)\*\*$",
            "flags": "m",
        },
    }


ENTRIES = [
    concept("Skill.SNLeco.cpt.SNLRoot", "SNL Root", "SNL 根节点", [
        ("A #0 is the unique top-level node of one #1, and the parser must reach end of input after it", ["SNLRoot", "EntryContent"]),
        ("Two text nodes written as siblings at the top level are two roots rather than one tree, and the second one is rejected at parse time", ["SNLRoot"]),
        ("Multi-part prose is written as a single variadic text macro whose body is a dynamic argument list, so that the whole passage stays one root", ["SNLRoot"]),
        ("Adjacent text nodes with nothing between them do not stay two nodes: they fuse into one node and the later segment is dropped without any error", ["SNLRoot"]),
    ]),
    concept("Skill.SNLeco.cpt.TextNodeBoundary", "Text Node Boundary", "文本节点边界", [
        ("A #0 is a leaf, so terminal punctuation belongs inside its delimiters, while a bare punctuation character outside them is read as syntax", ["TextNodeBoundary", "SNLRoot"]),
        ("An operator that could live inside a formula node is never parked between two nodes", ["TextNodeBoundary"]),
        ("A placeholder inside a text node names an entry of the params table and is not a literal, and pure-text rendering leaves it unfilled because the fill happens in the formula layer", ["TextNodeBoundary"]),
        ("A #0 carries no language projection, so a literal text node is never localized and never claimed to be", ["TextNodeBoundary", "I18N"]),
    ]),
    concept("Skill.SNLeco.cpt.FormulaNode", "Formula Node", "公式节点", [
        ("Every mathematical symbol is written as a #0 and never as a bare non-ASCII character", ["FormulaNode"]),
        ("A bare non-ASCII character is an identifier character, so it reaches generated code and rendered output as a literal codepoint instead of a symbol definition", ["FormulaNode"]),
        ("The two forms may render identically, so the violation is found in the stored source rather than in the rendering", ["FormulaNode"]),
        ("Binder and source syntax keep their sigils around the formula node", ["FormulaNode", "EntryContent"]),
    ]),
    concept("Skill.SNLeco.cpt.DeclarationArity", "Declaration Arity", "声明元数", [
        ("Context is expressed by a dedicated context container whose first argument holds the declarations and hypotheses, and whose second argument holds the body in that context", ["DeclarationArity", "EntryContent"]),
        ("A declaration macro expresses the declaration itself and takes no hypothesis argument, so composed context-carrying declaration macros are not introduced", ["DeclarationArity"]),
        ("A definition declaration has fixed arity three, and the meaning of each argument is invariant under every style", ["DeclarationArity", "TermMacroStyle"]),
        ("Unwritten information is an explicit empty argument slot and never a guessed type or an invented body", ["DeclarationArity"]),
    ]),
    concept("Skill.SNLeco.cpt.PointwiseApplication", "Pointwise Application", "点态应用", [
        ("A #0 carries at most one argument list, so an expression that applies a result to a further argument is not a single node", ["PointwiseApplication"]),
        ("Entry-level statements are therefore written at function level, and pointwise formulas belong to the prose body", ["PointwiseApplication", "EntryContent"]),
        ("A bound variable is the exception, because its first application is legal for the binder is the binding site", ["PointwiseApplication"]),
        ("Granularity follows the mathematical structure and not the order in which a source document presents it", ["PointwiseApplication", "Entry"]),
    ]),
    concept("Skill.SNLeco.cpt.StructureDeclaration", "Structure Declaration", "结构声明", [
        ("A multi-clause definition is declared with a structure macro and never as nested conjunctions, which erase the labels a reader needs", ["StructureDeclaration"]),
        ("A structure declaration enumerates its members, each member pairing a label with a condition, and the rendered form lists those labelled members", ["StructureDeclaration"]),
        ("A property of a structure is named by qualifying the structure with the property, and it stays in the package that owns the structure", ["StructureDeclaration", "MacroPackage"]),
    ]),
    concept("Skill.SNLeco.cpt.SyntaxTreeFidelity", "Syntax Tree Fidelity", "语法树忠实度", [
        ("A tree whose shape is a string is not a refinement, and a structure index does not detect it because a string-shaped tree can score well", ["SyntaxTreeFidelity"]),
        ("When a passage resists a syntactic decision, the honest response is an accepted low structure index rather than a blind decomposition", ["SyntaxTreeFidelity"]),
        ("Promoting every phrase to a constant macro with an absent or wrong source inflates the index and turns macro management into a liability", ["SyntaxTreeFidelity", "TermMacroSource"]),
    ]),
]

SECTION = {
    "id": "Skill.SNLeco.subsec.SyntaxConventions",
    "package": PKG,
    "kind": SUBSECTION_KIND,
    "title": i18n("Syntax Conventions", "语法约定"),
    "content": {},
    "contribution_info": None,
    "pointer": None,
}


def create(payload: dict) -> tuple[bool, str]:
    proc = subprocess.run(
        ["snl", "--root", ROOT, "entry", "create", "--input", "-", "--json"],
        input=json.dumps(payload), capture_output=True, text=True,
    )
    try:
        result = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return False, f"unparsable stdout: {proc.stdout[:200]} {proc.stderr[:200]}"
    if result.get("ok"):
        return True, "created"
    return False, str(result.get("error", {}).get("message", result))[:200]


def main() -> int:
    failures = 0
    for payload in ENTRIES:
        ok, detail = create(payload)
        if ok:
            status = "OK  "
        elif "exist" in detail.lower() or "duplicate" in detail.lower():
            status, detail = "SKIP", ""
        else:
            status, failures = "FAIL", failures + 1
        print(f"{status} {payload['id']:52} {detail}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
