#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Idiomatic-comment gate — a comment in the idiomatic layer describes ITS OWN FILE, and nothing else.

The rule (docs/decompiler-pipeline.md, "Output conventions"): in games/<game>/idiomatic/, a comment
may describe the code in the file it sits in. It may not cite the ROM, MAME, the frozen oracle, a
sibling module, a test, a doc, or a to-do. A count of what is IN this file is fine; a count of
anything outside it is not.

Why this is a gate and not a rule. Most process requirements here are reviewer rules, because a
script cannot tell whether a claim is TRUE. This one is different: it is not about truth, it is about
REFERENCE. "Does this comment name something outside this file" is decidable by reading the comment,
which is exactly what a script does well — and it is the one part of the old step-8 prose sweep that
was ever mechanical. See the History note at the foot of docs/reviewer-rules.md.

What this replaces. The understanding formula's step 8 ("sweep the prose the renames just falsified")
existed because cross-file claims were scattered through the routine layer, went stale whenever
understanding improved anywhere else, and had to be hunted by hand on every pass. It was attempted
twice on Donkey Kong and done by token substitution both times, the second time after a reviewer had
written down that a token sweep cannot work. It cannot work because only claims that mention a
RENAMED THING are findable that way, and most stale cross-file claims never mention it: they are
to-dos that have since fired, counts of other files, "only in the whole ROM" assertions, and status
words like "still-untranslated" that the project's own progress falsifies. Forbid the reference and
the sweep has nothing left to hunt.

WHICH FILES ARE EXEMPT, AND WHY. Three, and they share one reason — their JOB is the cross-file map:

  * translated/**            comes from the disassembly; a faithful translation of ROM 0x23DE must
                             say so. The address is that file's identity, not an outside citation.
  * idiomatic/names.js         the registry. It is the single source of truth mapping addresses to
                             names and to modules, so it is where cross-file facts are SUPPOSED to
                             live (docs/names-registry.md, "One source per fact").
  * idiomatic/**/test/**     a test exists to exercise another module; it cannot describe itself
                             without naming its subject. What a test header may claim about its own
                             coverage is governed by reviewer-rules R17, which is a rule because it
                             is about truth, not reference.

Everything else under games/<game>/idiomatic/ is in scope, for every game — nothing here is
per-game, so game #3 inherits it without an edit.

Subcommands
-----------
  check              exit 0 iff no STAGED idiomatic comment cites something outside its file
                     (the pre-commit hook calls this)
  scan [PATH ...]    same test over the WORKING TREE, one line per violation, grep-style; for
                     running the sweep. Defaults to every game. Exits 1 if anything is found.
                     It prints no totals — see violations() for why this tool does no arithmetic.
  selftest           feed known-bad and known-good comments through the matcher and assert the
                     verdicts. Run it after touching the patterns — a gate nobody has watched fail
                     is not known to work (reviewer-rules R17, check 3).

FAIL CLOSED: any git error blocks the commit rather than reading as "nothing to check".

KNOWN LIMITATIONS — recorded because a green here means less than it looks like:

  * VACUOUS WHEN NO IDIOMATIC FILE IS STAGED. `check` reads the staged name list; a commit that
    touches only docs/ or tools/ inspects NOTHING and exits 0. Green is evidence only when an
    in-scope file is in the index. `scan` cannot go vacuous the same way: ANY root matching no
    in-scope file is an ERROR (exit 2), not a pass — checked per root, so one good root cannot
    cover for a typo'd one — because a green scan is what licenses skipping the tree-wide sweep.
  * IT CHECKS REFERENCE, NOT TRUTH. A comment that invents a mechanism for the file it sits in
    passes cleanly. That is the reviewer's job and always was.
  * IT CATCHES REFERENCES BY FORM, NOT BY MEANING. A citation that spells nothing on the list
    passes: a decimal address, a sibling named in English ("the other half lives in
    walkMarioLeft"), "the real arcade hardware" for MAME, "the equivalence test" for a gate, "one
    of the fourteen routines that write this cell" for a count of other files, and "the only
    routine in the whole game that does X" for a whole-ROM claim. Those last two are families
    R21's own rationale names, and no regex decides them. They are the reviewer's half of R21,
    and the reason R21 is not a gate alone.
  * A FILE MAY NAME ITSELF, and for the two name-shaped rules only. A routine in a subdirectory
    whose basename collides with a top-level sibling (`sub/loc_31f6.js` citing `loc_31f6`) is read
    as naming itself, so a real citation of that sibling is suppressed. No such collision exists
    in either layer today.
  * REGEX LITERALS ARE NOT MODELLED. A `/.../ ` containing an unpaired quote can shift the line
    numbers reported after it. No such literal exists in either layer today (checked); the
    failure is a wrong line number on a real finding, not a missed finding.
"""
import argparse
import os
import re
import subprocess
import sys


class GitError(RuntimeError):
    """A git invocation failed — callers turn this into a BLOCK (fail closed)."""


def git(args):
    r = subprocess.run(["git", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise GitError(r.stderr.strip() or f"git {' '.join(args)} failed")
    return r.stdout


def repo_root():
    r = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.strip():
        raise GitError(r.stderr.strip() or "not inside a git work tree")
    return r.stdout.strip()


def blob(ref, path):
    """Staged (ref=':0' — stage 0 of the index) content.

    RAISES on failure rather than returning '' — an empty string scans clean, so swallowing the
    error here would let an unreadable staged file pass as compliant. That is the fail-OPEN this
    module's header promises not to be."""
    r = subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True)
    if r.returncode != 0:
        raise GitError(r.stderr.strip() or f"cannot read {ref}:{path}")
    return r.stdout


# ── what a comment may not name ───────────────────────────────────────────────────────────────
#
# Each entry is (label, regex). The label is what the failure message prints, so it names the RULE
# the author broke rather than the token that tripped it — an author who is told "cites the ROM"
# fixes the sentence, one who is told "matched 0x[0-9a-f]{4}" renames the number.
FORBIDDEN = [
    # A four-hex-digit literal is an address — ROM entry or work-RAM cell. Two-digit values are
    # data (sprite codes, masks, counts) and are none of this gate's business. A genuine 16-bit
    # constant of the file's own (0xffff as a pointer mask) is FLAGGED on purpose, and is not a
    # false positive by design: if the value matters enough to explain, name it (`const PTR_MASK =
    # 0xffff`) and the prose refers to the name. Hex in the CODE is untouched — only in a comment.
    ("cites an address", re.compile(r"0x[0-9a-f]{4}", re.I)),
    # The other two spellings of the same thing.
    ("cites an address", re.compile(r"\$[0-9a-f]{4}(?![0-9a-f])", re.I)),
    ("cites an address", re.compile(r"(?<![0-9a-zA-Z_])[0-9a-f]{4}h(?![A-Za-z0-9])", re.I)),
    # A sibling routine by its address-name. This is BOTH an address and a module reference — the
    # two things the rule names first — and it is the single commonest form of cross-file citation
    # in this codebase, so a gate that misses it misses the point.
    ("cites another routine", re.compile(r"(?<![A-Za-z0-9_])loc_[0-9a-f]{4}(?![A-Za-z0-9_])", re.I)),
    # re.I and the optional plural are both load-bearing: "the rom table" and "the ROMs disagree"
    # are the same citation. The lookbehind is what keeps "from" out.
    ("cites the ROM", re.compile(r"(?<![A-Za-z])ROMs?(?![A-Za-z])", re.I)),
    ("cites MAME", re.compile(r"(?<![A-Za-z])MAME(?![A-Za-z])", re.I)),
    # The repealed header blocks. Each names something outside the file by construction — a gate,
    # an equivalence test, a list of another module's exports — so a header putting one back is
    # refused here rather than only discouraged in prose.
    ("restores a repealed header block", re.compile(r"(?<![A-Za-z])(?:GATE|NAMES)\s*:")),
    ("restores a repealed header block", re.compile(r"memory[- ]equivalent", re.I)),
    ("cites the frozen oracle", re.compile(r"(?<![A-Za-z])oracles?(?![A-Za-z])", re.I)),
    # A path to any sibling: a module, a test, a doc.
    ("cites another file", re.compile(r"[A-Za-z0-9_./-]*\.(?:js|mjs|md|py|lua|cpp)(?![A-Za-z0-9])")),
    # Only the directories that are unambiguously paths here. `core/`, `games/` and friends were in
    # this list and matched ordinary prose ("the core/shell boundary"); anything genuinely pathlike
    # under them ends in a suffix and is caught by the rule above.
    ("cites another directory", re.compile(r"(?<![A-Za-z0-9_])(?:\.\./|translated/|idiomatic/)")),
    # A to-do is a claim about work that has not happened. The filename already carries it: a
    # routine still called loc_<addr> IS the statement "not yet promoted", and unlike a sentence
    # it cannot contradict itself once the promotion lands.
    ("carries a to-do", re.compile(r"(?<![A-Za-z])(?:TODO|FIXME|XXX)(?![A-Za-z])")),
    ("carries a to-do", re.compile(r"promote once|once corroborated|a later understanding pass|for a later understanding pass|name kept neutral", re.I)),
    # Project-status words describe the state of the PORT, not the behaviour of the code, and the
    # port's whole purpose is to falsify them. `UNWIRED` is deliberately case-SENSITIVE: it is a
    # status shout in a header, whereas lowercase "unwired" is ordinary English about hardware
    # ("the two lamp pins are unwired at reset").
    ("cites the port's state", re.compile(r"(?<![A-Za-z])(?:still[- ](?:un)?translated|untranslated|not yet (?:wired|translated|decompiled|named|promoted)|still[- ]oracle)(?![A-Za-z])", re.I)),
    ("cites the port's state", re.compile(r"(?<![A-Za-z])UNWIRED(?![A-Za-z])")),
]

# Exempt by exact position, not by basename: the registry is games/<game>/idiomatic/names.js and
# nothing else. A basename test would silently exempt a future idiomatic/sub/names.js.
EXEMPT_LEAF = "names.js"


def in_scope(path):
    """True for a file this gate governs: games/<game>/idiomatic/**.js, minus the three exemptions
    documented in the module docstring (the registry, tests, and everything under translated/)."""
    parts = path.split("/")
    if len(parts) < 4 or parts[0] != "games" or parts[2] != "idiomatic":
        return False
    if not path.endswith(".js"):
        return False
    if "test" in parts[3:]:
        return False
    return parts[3:] != [EXEMPT_LEAF]


# ── extracting comments ───────────────────────────────────────────────────────────────────────

_MARKER = re.compile(r"^\s*(?:/\*+|\*/|\*)\s?")


def comment_spans(text):
    """[(lineno, comment_text)] for every comment in `text`, leading OR trailing.

    A SINGLE left-to-right scan that tracks strings and comments in the same pass. It cannot be
    done by blanking string literals first: comments are English, English has apostrophes, and
    `the ring's 0/1/4/2` then opens a string that swallows every line until the next quote,
    shifting line numbers and folding later comments into the wrong block. Scanning in one pass
    fixes it structurally — an apostrophe reached while inside a comment is comment text and can
    never open a string.

    Both comment forms are covered deliberately: names_consistency.py scans only lines whose FIRST
    non-space characters are a marker, and its own docstring records that trailing comments "escape
    scanning entirely" — a hole this gate does not inherit.

    Regex literals are not modelled. A `/.../` containing an unescaped `//` or `/*` would be read
    as a comment; none exists in the layer (selftest covers the string and apostrophe forms that
    do), and the failure is toward over-reporting, which a reviewer sees rather than misses.
    """
    out = []
    i, n, line = 0, len(text), 1
    while i < n:
        ch = text[i]
        if ch == "\n":
            line += 1
            i += 1
        elif ch in "'\"`":
            quote, i = ch, i + 1
            while i < n:
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == "\n":
                    # An unterminated ' or " cannot cross a line in valid JS; bail WITHOUT
                    # consuming the newline, so the outer loop counts it exactly once. Counting
                    # it here too shifted every line number after an unpaired quote by one.
                    if quote != "`":
                        break
                    line += 1
                if text[i] == quote:
                    i += 1
                    break
                i += 1
        elif text.startswith("//", i):
            end = text.find("\n", i)
            end = n if end < 0 else end
            out.append((line, text[i + 2 : end]))
            i = end
        elif text.startswith("/*", i):
            end = text.find("*/", i + 2)
            end = n if end < 0 else end + 2
            body = text[i:end]
            for off, raw in enumerate(body.splitlines()):
                out.append((line + off, _MARKER.sub("", raw)))
            line += body.count("\n")
            i = end
        else:
            i += 1
    return out


def blocks(spans):
    """Join runs of consecutive-line comments into (first_line, joined_text, member_spans).

    Flattening before matching is the point, not tidiness: these claims wrap constantly inside JSDoc
    headers ("the only caller sits in the\n * still-untranslated object-processor chain"), and a
    per-line scan splits the sentence and matches neither half. The understanding formula had to
    carry "flatten files before matching" as an instruction precisely because the sweep was manual;
    here it is just how the tool reads.
    """
    out, run, prev = [], [], None
    for span in spans:
        lineno = span[0]
        if prev is not None and lineno == prev + 1:
            run.append(span)
        else:
            if run:
                out.append((run[0][0], " ".join(s[1] for s in run), run))
            run = [span]
        prev = lineno
    if run:
        out.append((run[0][0], " ".join(s[1] for s in run), run))
    return out


def _self_names(path):
    """The names that ARE this file: `loc_2a2f.js` -> {"loc_2a2f", "loc_2a2f.js"}, lowercased.

    A file naming ITSELF in its own header is not a reference to anything outside it — and the
    pipeline REQUIRES an unnamed routine to be called `loc_<addr>`, so without this the header
    every unnamed routine is mandated to write is the header the gate refuses — and most in-scope
    files in an in-progress game are `loc_`-named, so no decompile batch could pass its own hook.
    """
    leaf = os.path.basename(path)
    stem = leaf[:-3] if leaf.endswith(".js") else leaf
    return {stem.lower(), leaf.lower()}


# The self-name exemption applies ONLY to the two rules that match a NAME. Applied to every rule it
# becomes a stem collision: `rom.js` would suppress "the ROM", `mame.js` would suppress "MAME", and
# `oracle.js` would suppress "the frozen oracle" — none of which is the file naming itself.
SELF_EXEMPT_LABELS = {"cites another routine", "cites another file"}


def violations(path, text):
    """[(path, lineno, label, matched_text)] — one entry per comment block per rule it breaks.

    This tool REPORTS; it does not TALLY. No count of the TREE is printed anywhere, and that is a
    design decision rather than an omission: a count of the tree is a derived fact, and the moment one is
    printed it gets quoted into prose, where nothing invalidates it and the next cleaned file makes
    it false. What a caller needs is WHICH comments to fix (this list) and whether any remain (the
    exit code); neither needs arithmetic.

    The line reported is the line the match is ON, not the block's first line. Attributing every
    hit to the block start sends a reader to the SPDX line at the top of the file for a violation
    fifty lines down, because the leading `//` and the JSDoc under it are one run.
    """
    mine = _self_names(path)
    hits = []
    for start, block, spans in blocks(comment_spans(text)):
        for label, pattern in FORBIDDEN:
            skip = mine if label in SELF_EXEMPT_LABELS else frozenset()

            def carries(body, _p=pattern, _skip=skip):
                return next(
                    (m for m in _p.finditer(body) if m.group(0).strip().lower() not in _skip), None
                )

            found = carries(block)
            if not found:
                continue
            # Prefer the member line that carries the match; fall back to the block start for a
            # claim that only exists once the wrapped lines are joined.
            lineno = next((ln for ln, body in spans if carries(body)), start)
            hits.append((path, lineno, label, found.group(0).strip()))
    return hits


# ── subcommands ───────────────────────────────────────────────────────────────────────────────


def staged_paths():
    """In-scope staged paths, read NUL-separated.

    `-z` is not tidiness. Without it git applies `core.quotePath` and hands back a name like
    `"games/dkong/idiomatic/caf\\303\\251.js"` — leading quote and all — which `in_scope` reads as
    a path whose first component is not `games`, and drops SILENTLY. A staged file with blatant
    violations then passes with exit 0, which is fail-OPEN in a gate whose docstring promises the
    opposite."""
    raw = git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"])
    return [p for p in raw.split("\0") if p and in_scope(p)]


def cmd_check(_args):
    try:
        paths = staged_paths()
    except GitError as e:
        print(f"idiomatic_comments: BLOCKED — git failed: {e}", file=sys.stderr)
        return 1
    if not paths:
        return 0
    hits = []
    for p in paths:
        hits += violations(p, blob(":0", p))
    if not hits:
        print("idiomatic_comments: OK — every staged idiomatic comment describes its own file")
        return 0
    print(
        "idiomatic_comments: BLOCKED — these comments name something outside their own file.\n"
        "  An idiomatic comment describes THIS file.\n"
        "  (docs/decompiler-pipeline.md, \"Output conventions\")\n",
        file=sys.stderr,
    )
    for path, lineno, label, matched in hits:
        print(f"  {path}:{lineno}: {label} — {matched!r}", file=sys.stderr)
    return 1


def cmd_scan(args):
    root = repo_root()
    roots = args.paths or ["games"]
    files, empty = [], []
    for r in roots:
        before = len(files)
        for dirpath, _dirnames, filenames in os.walk(os.path.join(root, r)):
            for fn in filenames:
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, root)
                if in_scope(rel):
                    files.append((rel, full))
        if len(files) == before:
            empty.append(r)
    # A root that matches NOTHING is an error, not a pass. Removing the totals took away the only
    # thing that distinguished "clean" from "inspected nothing", and understanding.md makes a green
    # `scan games/<game>` the licence to skip the tree-wide prose sweep — so a mistyped or
    # not-yet-created game name would license skipping it. This is an assertion about coverage, not
    # a tally: it says the run HAD something to look at, never how much.
    if empty:
        # PER ROOT, not "every root was empty". `scan games/dkong games/timepilot` would otherwise
        # report on dkong and quietly license timepilot, which is the same vacuous green one root
        # further out.
        print(
            f"idiomatic_comments: ERROR — no in-scope file under: {', '.join(empty)}.\n"
            "  Those were not inspected, so this run is not a pass for them. Check the path, or\n"
            "  omit a game whose idiomatic layer does not exist yet.",
            file=sys.stderr,
        )
        return 2

    # One line per violation, grep-style, and NO totals. See violations() for why there is no
    # arithmetic in this tool: a tally of the tree is a derived fact, it gets quoted into prose,
    # and the next file cleaned makes the quote false. The list says what to fix; the exit code
    # says whether any remain. Pipe it to `wc -l` if you want a number that expires immediately.
    found = False
    for rel, full in sorted(files):
        try:
            with open(full, encoding="utf-8") as fh:
                text = fh.read()
        except UnicodeDecodeError as e:
            # Aborting mid-walk would print a PARTIAL list under a non-zero exit, which reads as
            # "here is everything left". Name the file and keep going.
            print(f"{rel}: ERROR — not valid UTF-8 ({e.reason}); not inspected", file=sys.stderr)
            found = True
            continue
        for path, lineno, label, matched in violations(rel, text):
            print(f"{path}:{lineno}: {label} — {matched!r}")
            found = True
    return 1 if found else 0


GOOD = [
    "Advance the sprite one animation step, wrapping at the end of the cycle.",
    "Returns false when the walk is blocked, so the caller can skip its move.",
    "The three lead records are seeded here; the rest stay inactive until a spawn.",
    "Mask to the low nibble — the high bits carry the colour, not the frame.",
    'const s = "https://example.invalid/not-a-comment";',
    # Ordinary English that a careless pattern flags. Each is prose about THIS file and must pass.
    "// the low nibble is stashed for a later pass over the row",
    "// the palette bank is kept neutral until the board builds",
    "// the two lamp pins are unwired at reset",
    "// the core/shell boundary is at the third byte",
    "// the value comes from the read, not from a table",
]
BAD = [
    ("cites an address", "// the table at 0x39c3 holds waypoint pairs"),
    ("cites the ROM", "// faithful to the ROM at this point"),
    ("cites MAME", "// measured under MAME across 1500 frames"),
    ("cites the frozen oracle", "// memory-equivalent to the frozen oracle"),
    ("cites another file", "// see equivalence-3009.test.js for the gate"),
    ("cites another directory", "// its callee still lives in translated/"),
    ("carries a to-do", "// TODO: confirm this against a longer run"),
    ("carries a to-do", "// Name kept neutral: promote once corroborated."),
    ("cites the port's state", "// the only caller sits in the still-untranslated object chain"),
    # The wrap case — the whole reason blocks are joined before matching. Neither line matches
    # alone; the sentence does.
    ("cites the port's state", "/**\n * the only caller sits in the\n * still-untranslated chain\n */"),
    # The trailing-comment case — the hole names_consistency.py documents and this gate does not
    # inherit.
    ("cites an address", "const v = mem8[FRAME];  // 0x601a is the frame counter"),
    # A sibling routine by address-name is both an address and a module — the commonest form of
    # cross-file citation here, and the easiest form to leave out of a pattern set.
    ("cites another routine", "// reads through loc_31f6 before returning"),
    ("cites another routine", "// abort the rest of LOC_197A for this frame"),
    ("cites the ROM", "// straight out of the rom table"),
    ("cites the ROM", "// the ROMs disagree about this byte"),
    ("cites the port's state", "// UNWIRED: no captured dispatches"),
    ("cites the port's state", "// consumed by the still-translated caller"),
]


# The apostrophe case, kept as its own fixture because what it protects is LINE ATTRIBUTION, not
# matching: an apostrophe in ordinary prose must not open a string, or every comment after it is
# folded into the wrong block under the wrong line number. Assert the lines, not just the verdict.
APOSTROPHE_SRC = """\
// The ring's four values step 0/1/4/2.
const RING = 1;

// A clean second comment.
const OTHER = 2;

// the table at 0x39c3 holds waypoint pairs
"""


SCOPE_CASES = [
    ("games/dkong/idiomatic/walkMarioLeft.js", True),
    ("games/dkong/idiomatic/loc_2a2f.js", True),
    ("games/dkong/idiomatic/sub/deep.js", True),
    ("games/dkong/idiomatic/names.js", False),
    ("games/dkong/idiomatic/sub/names.js", True),
    ("games/dkong/idiomatic/test/equivalence-3009.test.js", False),
    ("games/dkong/translated/loc_23de.js", False),
    ("games/dkong/idiomatic/notes.md", False),
    ("tools/idiomatic_comments.py", False),
]

# A file naming ITSELF is not a cross-file reference. The pipeline mandates `loc_<addr>` for every
# unnamed routine, so without this the header the pipeline REQUIRES is a header the gate REFUSES.
SELF_NAME_CASES = [
    # The exemption is for NAMES only. A file called rom.js does not get to say "the ROM"; that is
    # a stem collision, not a file naming itself.
    ("games/dkong/idiomatic/rom.js", "// Faithful to the ROM at this point.", ["cites the ROM"]),
    ("games/dkong/idiomatic/mame.js", "// Measured under MAME across many frames.", ["cites MAME"]),
    ("games/dkong/idiomatic/oracle.js", "// Memory-equivalent to the frozen oracle.",
     ["cites the frozen oracle", "restores a repealed header block"]),
    ("games/dkong/idiomatic/loc_9f9f.js", "// loc_9f9f — one-line role.", []),
    ("games/dkong/idiomatic/loc_9f9f.js", "// see loc_9f9f.js for the tail", []),
    # …but a DIFFERENT routine is still a reference, in the same header.
    ("games/dkong/idiomatic/loc_9f9f.js", "// loc_9f9f hands off to loc_2a2f", ["cites another routine"]),
    ("games/dkong/idiomatic/walkMarioLeft.js", "// loc_9f9f is the tail", ["cites another routine"]),
]


def cmd_selftest(_args):
    failures = []
    for path, src, want in SELF_NAME_CASES:
        got = sorted({h[2] for h in violations(path, src)})
        if got != sorted(want):
            failures.append(f"SELF-NAME {path} {src!r}: got {got}, want {sorted(want)}")
    for src in GOOD:
        hits = violations("games/g/idiomatic/x.js", src)
        if hits:
            failures.append(f"FALSE POSITIVE on {src!r}: {hits}")

    spans = comment_spans(APOSTROPHE_SRC)
    if [ln for ln, _ in spans] != [1, 4, 7]:
        failures.append(f"APOSTROPHE line attribution: got {[ln for ln, _ in spans]}, want [1, 4, 7]")
    apo = violations("games/g/idiomatic/x.js", APOSTROPHE_SRC)
    if [(h[1], h[2]) for h in apo] != [(7, "cites an address")]:
        failures.append(f"APOSTROPHE violations: got {[(h[1], h[2]) for h in apo]}, want [(7, 'cites an address')]")

    # A real file opens with an SPDX `//` and a JSDoc directly under it, so the whole header is
    # ONE block. Report the line the match is on, or every header violation in the codebase
    # points at line 1.
    header = (
        "// SPDX-License-Identifier: GPL-3.0-only\n"
        "/**\n"
        " * doSomething — one line of role.\n"
        " *\n"
        " * Runs the thing, then hands back the result.\n"
        " * memory-equivalent to the frozen oracle.\n"
        " */\n"
    )
    hv = sorted((h[1], h[2]) for h in violations("games/g/idiomatic/x.js", header))
    want = [(6, "cites the frozen oracle"), (6, "restores a repealed header block")]
    if hv != want:
        failures.append(f"HEADER attribution: got {hv}, want {want}")
    for expect, src in BAD:
        hits = violations("games/g/idiomatic/x.js", src)
        if not hits:
            failures.append(f"MISSED {expect!r} in {src!r}")
        elif not any(label == expect for _p, _l, label, _m in hits):
            got = sorted({label for _p, _l, label, _m in hits})
            failures.append(f"WRONG LABEL for {src!r}: expected {expect!r}, got {got}")
    for path, want in SCOPE_CASES:
        if in_scope(path) != want:
            failures.append(f"SCOPE wrong for {path}: in_scope={in_scope(path)}, want={want}")
    if failures:
        print("idiomatic_comments selftest: FAIL", file=sys.stderr)
        for f in failures:
            print(f"  {f}", file=sys.stderr)
        return 1
    print(
        f"idiomatic_comments selftest: PASS ({len(GOOD)} good, {len(BAD)} bad, "
        f"{len(SCOPE_CASES)} scope cases, 3 line-attribution assertions)"
    )
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check").set_defaults(fn=cmd_check)
    s = sub.add_parser("scan")
    s.add_argument("paths", nargs="*")
    s.set_defaults(fn=cmd_scan)
    sub.add_parser("selftest").set_defaults(fn=cmd_selftest)
    args = ap.parse_args()
    try:
        return args.fn(args)
    except GitError as e:
        print(f"idiomatic_comments: BLOCKED — git failed: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
