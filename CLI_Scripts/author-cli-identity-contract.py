#!/usr/bin/env python3
"""Author the CLI identity-form contract Entries in the Toolkit spec workspace.

Records the observed identity-form divergence between macro and Entry commands,
and the stale-launcher hazard, as specification Entries.

Idempotent. Run from the repository root:
    python3 CLI_Scripts/author-cli-identity-contract.py
"""
from __future__ import annotations

import json
import subprocess
import sys

ROOT = "."
PKG = "Skills"
KIND = "entry-kind.concept"
SKILL_MD = "Skills/SNL Ecosystem/SKILL.md"


def i18n(en: str, zh: str) -> dict:
    return {"type": "i18n", "default_language": "en", "values": {"en": en, "zh-CN": zh}}


def concept(entry_id: str, en_title: str, zh_title: str, clauses: list[tuple[str, list[str]]]) -> dict:
    parts = [
        f"%{prose}%" if not refs else f"%{prose}%({', '.join(refs)})"
        for prose, refs in clauses
    ]
    return {
        "id": entry_id,
        "package": PKG,
        "kind": KIND,
        "title": i18n(en_title, zh_title),
        "content": {"snl": "__list__(" + ", ".join(parts) + ")"},
        "contribution_info": None,
        "pointer": {
            "file": SKILL_MD,
            "mode": "regex",
            "pattern": rf"^  \* \*\*{en_title} \({zh_title}\)\*\*$",
            "flags": "m",
        },
    }


ENTRIES = [
    concept("Skill.CLI.cpt.IdentityForm", "Command Identity Form", "命令身份形式", [
        ("A #0 is the string a command accepts to name one entity, and the accepted form differs between command families rather than being uniform", ["IdentityForm"]),
        ("A macro read requires the package-qualified form, while an Entry read takes the bare identifier; the same tree therefore uses two spellings for two lookups", ["IdentityForm", "MacroPackage"]),
        ("A macro mutation identifies its target through the package separator inside the stored identity, so a bare identifier never reaches the lookup", ["IdentityForm"]),
        ("An unrecognized form is reported as a missing entity rather than as a malformed identity, which presents an argument error as absence", ["IdentityForm"]),
        ("An author resolves this by trying the bare form first and switching to the qualified form on not-found, because no single documented form covers both", ["IdentityForm"]),
    ]),
    concept("Skill.CLI.cpt.LauncherFreshness", "Launcher Freshness", "启动器新鲜度", [
        ("A #0 is the executing entry point resolved from the search path, and it may be a copy taken earlier instead of the shipped bundle", ["LauncherFreshness"]),
        ("A stale launcher validates an older contract: it accepts data the current build rejects and reports a clean workspace while the reader refuses the same workspace entirely", ["LauncherFreshness", "EntryTag"]),
        ("A source-versus-behaviour contradiction is therefore diagnosed by resolving the executing path before suspecting the code or the workspace", ["LauncherFreshness"]),
        ("The repository ships its build output, so refreshing the launcher is a pointer replacement and never a build step", ["LauncherFreshness"]),
        ("A launcher outside the repository must be re-pointed rather than copied, so that it tracks the shipped bundle", ["LauncherFreshness"]),
    ]),
]


def cli(*args: str, stdin: str | None = None) -> dict:
    proc = subprocess.run(
        ["snl", "--root", ROOT, *args, "--json"],
        input=stdin, capture_output=True, text=True,
    )
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {"ok": False, "error": {"message": f"unparsable: {proc.stdout[:200]}"}}


def main() -> int:
    failures = 0
    for payload in ENTRIES:
        got = cli("entry", "get", payload["id"])
        if got.get("ok"):
            print(f"SKIP {payload['id']:44} already exists")
            continue
        res = cli("entry", "create", "--input", "-", stdin=json.dumps(payload))
        ok = res.get("ok")
        if not ok:
            failures += 1
        print(f"{'OK  ' if ok else 'FAIL'} {payload['id']:44} {'' if ok else str(res.get('error'))[:140]}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
