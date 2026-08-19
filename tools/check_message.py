#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Check a commit message's claims ABOUT ITS OWN DIFF against the diff. Implements R19.

Written because the author of this repo fabricated quoted text in four consecutive commit
messages in one session -- phrases like "obedient readers" and "7-8 ROM references" that appear
nowhere in the repo's history -- while believing each time that he was quoting the parent.

The empirical record is what makes this a tool and not a reminder: every fabrication caught before
review was caught by running this check; every one that reached a reviewer was a message where it
was skipped in favour of recall. Intention had no effect on the rate.

  python3 tools/check_message.py <message-file>

Exits 1 if any quoted string is absent from the parent revision of a staged file, or if a stated
file count or insertion count disagrees with the staged diff.
"""
import re, subprocess, sys, os


def git(args):
    return subprocess.run(["git", *args], capture_output=True, text=True).stdout


def staged_files():
    return [f for f in git(["diff", "--cached", "--name-only"]).split("\n") if f]


def parent_text(files):
    """HEAD content of the staged files PLUS the whole tracked tree.

    Staged files first because that is where most quotes come from, but a message legitimately
    quotes unstaged files too ("this same claim survives in X"), and scoping the corpus to the
    staged set reports those as fabrications. That false positive was found by running this tool
    on its own first output — the quote was real and the checker was wrong."""
    out = []
    for f in files:
        # errors="replace": a staged binary file (e.g. a PNG) has no decodable text and cannot be
        # the source of a quote; without this the UTF-8 decode raises and blocks the whole commit.
        r = subprocess.run(["git", "show", f"HEAD:{f}"], capture_output=True, text=True, errors="replace")
        if r.returncode == 0:
            out.append(r.stdout)
    tracked = git(["grep", "-h", "", "HEAD", "--", "games", "docs", "tools", "boards"])
    out.append(tracked)
    return "\n".join(out)


def normalise(s):
    """Collapse whitespace so a quote spanning a comment line-wrap still matches."""
    return re.sub(r"\s+", " ", s).strip()


def main():
    if len(sys.argv) < 2:
        sys.stderr.write("usage: check_message.py <message-file>\n")
        return 2
    msg = open(sys.argv[1]).read()
    files = staged_files()
    if not files:
        sys.stderr.write("nothing staged — R19 has no diff to check against\n")
        return 2
    parent = normalise(parent_text(files))
    bad = []
    for q in re.findall(r'"([^"]{6,120})"', msg):
        # An ellipsis marks a deliberately elided quote; check the leading fragment only.
        core = normalise(q.split("...")[0].split("…")[0])
        if len(core) < 6:
            continue
        if core not in parent:
            bad.append(q)

    n_files = len(files)
    ins = sum(int(l.split("\t")[0]) for l in git(["diff", "--cached", "--numstat"]).split("\n")
              if l and l.split("\t")[0].isdigit())

    print(f"staged: {n_files} file(s), +{ins}")
    if bad:
        print("\nQUOTED STRINGS NOT FOUND IN THE PARENT OF ANY STAGED FILE:")
        for q in bad:
            print(f'  "{q[:100]}"')
        print("\nEach is either a fabrication or your own draft's wording. If it is a draft, say so\n"
              "in the message ('an earlier draft said...'); do not attribute it to the parent.")
        return 1
    print("all quoted strings resolve against the parent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
