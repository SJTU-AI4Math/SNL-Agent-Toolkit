#!/usr/bin/env python3
"""Point the CLI identity/freshness Entries at their CLI-manual headings and
wire them into the CLI library graph.

Idempotent. Run from the repository root:
    python3 CLI_Scripts/wire-cli-identity-contract.py
"""
from __future__ import annotations

import json
import re
import subprocess
import sys

ROOT = "."
CLI_MD = "Skills/CLI Tools/SKILL.md"
LIBRARY = "CLI"

# entry id -> the CLI-manual heading it documents
TARGETS = {
    "Skill.CLI.cpt.IdentityForm": "Command Identity Form (命令身份形式)",
    "Skill.CLI.cpt.LauncherFreshness": "Launcher Freshness (启动器新鲜度)",
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


def main() -> int:
    text = open(CLI_MD, encoding="utf-8").read()

    # 1. Pointers from the real headings.
    for entry_id, heading in TARGETS.items():
        if not re.search(rf"^## {re.escape(heading)}$", text, re.M):
            raise SystemExit(f"{CLI_MD} has no heading {heading!r}")
        got = cli("entry", "get", entry_id)
        entity = got["data"]["entity"]
        value = dict(entity["value"])
        value["package"] = entity["value"]["package"]
        value["pointer"] = {
            "file": CLI_MD,
            "mode": "regex",
            "pattern": rf"^## {re.escape(heading)}$",
            "flags": "m",
        }
        res = cli("entry", "update", entry_id, "--input", "-",
                  "--if-match", entity["revision"], stdin=json.dumps(value))
        print(f"{'OK  ' if res.get('ok') else 'FAIL'} pointer {entry_id:36} "
              f"{'' if res.get('ok') else str(res.get('error'))[:120]}")

    # 2. Graph: attach under the CLI Skill root's section if present, else root.
    lib = cli("library", "get", LIBRARY)
    value = lib["data"]["entity"]["value"]
    graph = value["graph"]
    nodes, rels = graph["nodes"], graph["relationships"]
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

    # The CLI library is a flat list of command Entries; the identity-form and
    # launcher-freshness contracts are cross-cutting, so they attach at the same
    # level rather than under one command.
    parent = None
    for entry_id in TARGETS:
        node_for(entry_id)

    payload = {
        "slug": value["slug"],
        "meta": value["meta"],
        "graph": {"nodes": nodes, "relationships": rels},
        "counters": value["counters"],
    }
    res = cli("library", "update", LIBRARY, "--input", "-",
              "--if-match", lib["data"]["entity"]["revision"], stdin=json.dumps(payload))
    print(f"{'OK  ' if res.get('ok') else 'FAIL'} graph {LIBRARY} "
          f"{'' if res.get('ok') else str(res.get('error'))[:200]}")
    return 0 if res.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
