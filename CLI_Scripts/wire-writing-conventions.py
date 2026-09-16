#!/usr/bin/env python3
"""Fix authoring pointers and wire the Syntax Conventions section into the graph.

Companion to author-writing-conventions.py. Idempotent: re-running produces the
same workspace. Every mutation goes through the unified CLI.

Run from the repository root:
    python3 CLI_Scripts/wire-writing-conventions.py
"""
from __future__ import annotations

import json
import re
import subprocess
import sys

ROOT = "."
SKILL_MD = "Skills/SNL Ecosystem/SKILL.md"
LIBRARY = "Skill"
SECTION_ID = "Skill.SNLeco.subsec.SyntaxConventions"

CONCEPTS = {
    "Skill.SNLeco.cpt.SNLRoot": "SNL Root (SNL 根节点)",
    "Skill.SNLeco.cpt.TextNodeBoundary": "Text Node Boundary (文本节点边界)",
    "Skill.SNLeco.cpt.FormulaNode": "Formula Node (公式节点)",
    "Skill.SNLeco.cpt.DeclarationArity": "Declaration Arity (声明元数)",
    "Skill.SNLeco.cpt.PointwiseApplication": "Pointwise Application (点态应用)",
    "Skill.SNLeco.cpt.StructureDeclaration": "Structure Declaration (结构声明)",
    "Skill.SNLeco.cpt.SyntaxTreeFidelity": "Syntax Tree Fidelity (语法树忠实度)",
}


def cli(*args: str, stdin: str | None = None) -> dict:
    proc = subprocess.run(
        ["snl", "--root", ROOT, *args, "--json"],
        input=stdin, capture_output=True, text=True,
    )
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        raise SystemExit(f"unparsable CLI output for {args}: {proc.stdout[:300]} {proc.stderr[:300]}")


def head(text: str, entry_id: str) -> tuple[dict, str]:
    """Return (flat value, revision) for one Entry."""
    payloads = {p["id"]: p for p in ENTRIES_PAYLOADS}
    value = payloads[entry_id]
    got = cli("entry", "get", entry_id)
    if not got.get("ok"):
        raise SystemExit(f"cannot read {entry_id}: {got}")
    entity = got["data"]["entity"]
    value = dict(entity["value"])
    value["package"] = entity["value"]["package"]
    return value, entity["revision"]


ENTRIES_PAYLOADS: list[dict] = []  # filled in main()


def main() -> int:
    global ENTRIES_PAYLOADS

    # 1. Pointers derived from the real SKILL.md lines.
    text = open(SKILL_MD, encoding="utf-8").read()
    pointers: dict[str, dict] = {}
    for entry_id, label in CONCEPTS.items():
        m = re.search(rf"^([ \t]*)\* \*\*{re.escape(label)}\*\*[ \t]*$", text, re.M)
        if not m:
            raise SystemExit(f"SKILL.md has no line for {label}")
        pointers[entry_id] = {
            "file": SKILL_MD,
            "mode": "regex",
            "pattern": rf"^{re.escape(m.group(1))}\* \*\*{re.escape(label)}\*\*$",
            "flags": "m",
        }

    payloads = []
    for entry_id in CONCEPTS:
        got = cli("entry", "get", entry_id)
        value = dict(got["data"]["entity"]["value"])
        value["package"] = got["data"]["entity"]["value"]["package"]
        value["pointer"] = pointers[entry_id]
        payloads.append((entry_id, got["data"]["entity"]["revision"], value))
    ENTRIES_PAYLOADS = [p[2] for p in payloads]

    for entry_id, revision, value in payloads:
        res = cli("entry", "update", entry_id, "--input", "-", "--if-match", revision, stdin=json.dumps(value))
        print(f"{'OK  ' if res.get('ok') else 'FAIL'} pointer {entry_id:42} {'' if res.get('ok') else str(res.get('error'))[:120]}")

    # 2. Graph nodes: one per new Entry plus the section.
    lib = cli("library", "get", LIBRARY)
    graph = lib["data"]["entity"]["value"]["graph"]
    nodes = graph["nodes"]
    rels = graph["relationships"]
    by_entry = {n.get("props", {}).get("entryId"): n["id"] for n in nodes}
    next_index = 1 + max(
        (int(n["id"][2:]) for n in nodes if re.fullmatch(r"n_\d+", n["id"])), default=0
    )

    def node_for(entry_id: str) -> str:
        nonlocal next_index
        if entry_id in by_entry:
            return by_entry[entry_id]
        node_id = f"n_{next_index}"
        next_index += 1
        nodes.append({"id": node_id, "label": "Entry", "props": {"entryId": entry_id}})
        by_entry[entry_id] = node_id
        return node_id

    section_node = node_for(SECTION_ID)
    parent = by_entry.get("Skill.SKILL.md-SNLeco")
    if parent is None:
        raise SystemExit("Skill.SKILL.md-SNLeco node missing")

    def link(parent_id: str, child_id: str) -> None:
        if not any(r["from"] == parent_id and r["to"] == child_id for r in rels):
            rels.append({"from": parent_id, "to": child_id, "label": "branch"})

    link(parent, section_node)
    for entry_id in CONCEPTS:
        link(section_node, node_for(entry_id))

    value = lib["data"]["entity"]["value"]
    payload = {
        "slug": value["slug"],
        "meta": value["meta"],
        "graph": {"nodes": nodes, "relationships": rels},
        "counters": value["counters"],
    }
    res = cli("library", "update", LIBRARY, "--input", "-", "--if-match", lib["data"]["entity"]["revision"], stdin=json.dumps(payload))
    print(f"{'OK  ' if res.get('ok') else 'FAIL'} graph {LIBRARY} {'' if res.get('ok') else str(res.get('error'))[:200]}")
    return 0 if res.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
