#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Review gate — make an independent review a MECHANICAL PREREQUISITE for every commit.

The top-level rule: no commit lands until a SEPARATE reviewer has read exactly those
staged changes and recorded a PASS. Memory and docs cannot enforce that — an agent that
forgets ships unreviewed code. A git hook can: it refuses the commit.

How it works
------------
* ``diff_id`` = sha256 of the staged diff (``git diff --cached``, stable flags incl.
  ``--full-index`` so the id does not drift with ``core.abbrev``). It changes the instant
  the staged content changes, so a review is bound to the EXACT bytes that will be
  committed. Review v1 then edit to v2 and the token no longer matches — you are forced to
  re-review the change.
* A reviewer records ``.reviews/<diff_id>.json`` = {"verdict": "PASS", ...} after reading
  the staged diff.
* The ``pre-commit`` hook runs ``check``: no matching PASS token -> exit 1 -> commit blocked.

So the only path to a commit is: stage -> review (writes the token) -> commit.

FAIL CLOSED: any git error (not-a-repo, a failing ``git diff``) blocks the commit rather
than being mistaken for an empty diff. A gate that errors open is worthless.

Honest limits (stated, not hidden)
----------------------------------
``git commit --no-verify`` bypasses any local hook, and a misbehaving agent could forge a
token. History-rewrite paths (rebase -x / cherry-pick / revert / auto-merge) do not fire
pre-commit at all. This gate stops FORGETTING — the actual failure mode here — not a
determined bypass; hard enforcement needs a server-side check on push. reviewer != author
is recorded but not cryptographically enforced.

Subcommands
-----------
  id                     print the current staged diff_id
  check                  exit 0 iff a PASS token exists for the staged diff (the hook calls this)
  record --verdict PASS --reviewer WHO [--summary S]   write the token for the staged diff
  install                wire the repo to use hooks/ (git config core.hooksPath hooks)
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time


class GitError(RuntimeError):
    """A git invocation failed — callers turn this into a BLOCK (fail closed)."""


def repo_root():
    """Absolute repo root, or raise GitError (so the gate fails closed outside a work tree)."""
    r = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True
    )
    if r.returncode != 0 or not r.stdout.strip():
        raise GitError(r.stderr.strip() or "not inside a git work tree")
    return r.stdout.strip()


def git(args):
    """Run git at REPO; raise GitError on any non-zero exit so callers fail CLOSED.

    The previous version discarded the return code and returned only stdout, so a failing
    `git diff --cached` came back as "" and read as "nothing to review -> allow" — a
    fail-OPEN. Raising here is what makes an errored diff block the commit.
    """
    r = subprocess.run(["git", *args], capture_output=True, text=True, cwd=REPO)
    if r.returncode != 0:
        raise GitError(f"`git {' '.join(args)}` failed (exit {r.returncode}): {r.stderr.strip()}")
    return r.stdout


def staged_diff():
    """The staged diff, flags pinned so the hash is reproducible between record and check.

    --no-color / --no-ext-diff strip environment-dependent formatting; -U0 drops context so
    unrelated nearby edits don't perturb the id; --full-index pins the index blob SHAs to
    full length so the id doesn't drift as the repo's object count grows (core.abbrev).
    """
    return git(["diff", "--cached", "--no-color", "--no-ext-diff", "-U0", "--full-index"])


def diff_id(diff):
    return hashlib.sha256(diff.encode()).hexdigest()


def token_path(did):
    return os.path.join(REVIEWS, did + ".json")


def cmd_id(_args):
    print(diff_id(staged_diff()))
    return 0


def cmd_check(_args):
    diff = staged_diff()  # GitError -> caught in main() -> BLOCK (fail closed)
    if not diff.strip():
        # Genuinely nothing staged with content to review (e.g. --allow-empty or a pure
        # merge/reword). No code to review, so do not block. (A git ERROR does not reach
        # here — staged_diff() raises, and main() blocks.)
        return 0
    did = diff_id(diff)
    path = token_path(did)
    if not os.path.exists(path):
        sys.stderr.write(
            "\nCOMMIT BLOCKED — these staged changes have not been reviewed.\n"
            f"  staged diff {did[:12]} has no review token.\n"
            "  An INDEPENDENT reviewer (not the author) must read the staged diff and record a PASS:\n"
            "    python3 tools/review_gate.py record --verdict PASS --reviewer <who> --summary <one line>\n"
            f"  Recording the review is what writes .reviews/{did[:12]}...json. Then commit.\n"
            "  Do NOT --no-verify around this — that is the exact rule it enforces.\n\n"
        )
        return 1
    try:
        tok = json.load(open(path))
    except (OSError, json.JSONDecodeError) as e:
        sys.stderr.write(f"\nCOMMIT BLOCKED — review token {path} is unreadable ({e}).\n\n")
        return 1
    if tok.get("verdict") != "PASS":
        sys.stderr.write(
            f"\nCOMMIT BLOCKED — review verdict is {tok.get('verdict')!r}, not PASS ({path}).\n\n"
        )
        return 1
    return 0


def cmd_record(args):
    diff = staged_diff()
    if not diff.strip():
        sys.stderr.write("nothing staged to review.\n")
        return 1
    did = diff_id(diff)
    os.makedirs(REVIEWS, exist_ok=True)
    files = git(["diff", "--cached", "--name-only"]).split()
    record = {
        "diff_id": did,
        "verdict": args.verdict,
        "reviewer": args.reviewer,
        "summary": args.summary or "",
        "files": files,
        "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    json.dump(record, open(token_path(did), "w"), indent=2)
    print(f"recorded {args.verdict} for diff {did[:12]} ({len(files)} file(s)) by {args.reviewer}")
    return 0


def cmd_install(_args):
    git(["config", "core.hooksPath", "hooks"])
    print("installed: core.hooksPath = hooks (pre-commit review gate active)")
    return 0


# REPO is resolved once at import; if we are not in a work tree it stays None and every
# subcommand fails closed via the guard in main().
try:
    REPO = repo_root()
except GitError:
    REPO = None
REVIEWS = os.path.join(REPO, ".reviews") if REPO else None


def main():
    p = argparse.ArgumentParser(description="Review gate — block commits lacking an independent review")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("id")
    sub.add_parser("check")
    sub.add_parser("install")
    r = sub.add_parser("record")
    r.add_argument("--verdict", required=True, choices=["PASS", "FAIL"])
    r.add_argument("--reviewer", required=True, help="who reviewed (agent id / name) — must not be the author")
    r.add_argument("--summary", help="one-line review summary")
    args = p.parse_args()
    if REPO is None:
        sys.stderr.write("COMMIT BLOCKED — review gate: not inside a git work tree (failing closed).\n")
        return 1
    try:
        return {"id": cmd_id, "check": cmd_check, "record": cmd_record, "install": cmd_install}[args.cmd](args)
    except GitError as e:
        sys.stderr.write(f"COMMIT BLOCKED — review gate git error (failing closed): {e}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
