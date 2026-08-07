#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Refuse a commit that changes what a game renders unless that game's pixel gate PASSED.

WHY THIS EXISTS. The gates the idiomatic loop runs all day -- per-routine memory-equivalence and
the assembled swap -- compare RAM outside the stack window and a declared live-out. Neither looks
at a pixel. A layer can therefore be green on every gate the loop runs and wrong on the glass. That
is not hypothetical: Time Pilot's idiomatic layer ran a full day of batches with the pixel gate
wired into nothing, and the gap was noticed by a person, twice, not by a gate.

Documentation was the first fix and it is the wrong shape. A doc item and a reviewer rule both fire
when someone chooses to look, which is exactly the moment a person who forgot is not having.
Forgetting is a WRITE-TIME failure, so the remedy has to be a write-time interlock.

★★ WHAT THIS GATE CANNOT SEE TODAY, STATED FIRST BECAUSE IT IS THE THING MOST LIKELY TO MISLEAD.
The declared suites render the ORACLE, not the idiomatic layer. `games/<g>/tools/render.js` builds
its machine from `buildRoutines()`, which is `translated/_registry.generated.js` alone; THE
RENDERER IS NOT AMONG THE CALLERS of `resolveAllIdiomatic`, the only route to `idiomatic/`. The
shipped player reaches it only when a game's `manifest.runtime` is "idiomatic" -- Time Pilot's is
"translated". So while a game's runtime is "translated", ITS IDIOMATIC LAYER IS DORMANT AND AN
IDIOMATIC PIXEL REGRESSION IS NOT COVERED BY THIS GATE, and cannot be until go-live points the
renderer at that layer.

This was measured, not assumed: every timeplt idiomatic module was poisoned with a throwing import
and the rendered frames came back byte-identical, with a positive control confirming the poison
fires when the module is actually loaded. A green suite proves nothing about idiomatic code until
that changes. This gate still fires on idiomatic paths, because the day the renderer resolves them
the interlock must already be in place -- but do not read its PASS as covering them. `cmd_check`
says so on the spot: a PASS driven only by idiomatic paths, for a game whose runtime is not
"idiomatic", is printed with the dormancy caveat attached rather than as a bare PASS.

★ THE FAILURE MODE THIS TOOL MUST NOT REPRODUCE. `pixel_suite.py` exits 0 when it cannot run --
no MAME on PATH, or no romset -- because to a fresh clone that is not a failure of the
translation. That is right for the suite and fatal for a gate built on its exit code: the machine
that cannot check anything would report success, which is the same silent-skip defect
`no-stale-mcall` has (`if (addr === undefined) continue`, no record, no failure). So this gate
NEVER trusts the exit code alone. It requires the suite's literal PASS line, and treats every other
outcome -- SKIP, INCOMPLETE, FAIL, a crash, a timeout -- as a refusal. An absence of failure is not
a pass.

★ WHAT THIS DELIBERATELY DOES NOT OWN, recorded because an unowned property with no record of
being unowned is a trap -- and each exclusion gets its OWN reason, because one reason covering a
list is how a wrong exclusion hides inside a right one.

  - `core/` -- shared by every game. Firing would demand every declared game's suite, and a
    machine holding one romset cannot evaluate the others, so the gate would refuse commits it is
    unable to judge rather than commits that are wrong.
  - `tools/pixel_gate.py` -- the shared half of the instrument, and it holds `ROUGH_TOLERANCE`.
    Loosening that changes every game's verdict. Excluded for the same reason as `core/` and for
    no better one: this is the sharpest hole left in this gate, and it is left open knowingly.
  - `boards/<board>/` and `games/<g>/manifest.js` are NOT excluded. The cost argument above does
    not reach them: a board is one-to-one with a game here and contains the renderer itself
    (`boards/<b>/video.js`), and a manifest is single-game. Each costs one suite run. The board is
    resolved through each manifest's `board:` field, not by assuming the directory name matches
    the game.
"""
import os
import re
import subprocess
import sys
import tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

#: Staged paths that can change what a game's pixel suite renders, or what the suite itself
#: measures. Deliberately WIDER than the idiomatic layer: `translated/` is the layer the suite
#: actually executes today, so it is the one directory whose changes this gate can genuinely
#: attribute, and leaving it out would have meant firing only where the instrument is blind.
#: All of these are single-game and cost one suite run.
RENDER_AFFECTING = re.compile(
    r"^games/([^/]+)/(?:idiomatic/|translated/|routines\.js$|machine\.js$|manifest\.js$"
    r"|tools/render\.js$|tools/pixel_suite\.py$)"
)

#: A board directory is shared machinery, but one-to-one with a game in this repo -- and it holds
#: the renderer. Matched separately because the path carries a BOARD id, which must be resolved to
#: the game(s) that declare it rather than assumed equal to the directory name.
BOARD_PATH = re.compile(r"^boards/([^/]+)/")

#: Paths under `idiomatic/` specifically -- used to qualify a PASS that only these triggered.
IDIOMATIC_ONLY = re.compile(r"^games/([^/]+)/idiomatic/")

#: Manifest field reads, ANCHORED TO A DECLARATION LINE. Unanchored, these match inside a `//`
#: comment: two manifests carry `// Live runtime: "idiomatic" runs the whole game...` ABOVE the
#: real field, and an unanchored read takes the comment. Today those comments happen to agree with
#: their declarations, so every game still resolves correctly and nothing looks wrong -- the defect
#: is invisible on the present corpus and would surface only when a comment and a declaration
#: disagree. For `runtime` that failure is silent and unsafe in the worst direction: a comment
#: saying "idiomatic" above a translated declaration SUPPRESSES the dormancy caveat, removing the
#: warning precisely where it is needed.
MANIFEST_RUNTIME = re.compile(r'^\s*runtime:\s*"([^"]+)"', re.M)
MANIFEST_BOARD = re.compile(r'^\s*board:\s*"([^"]+)"', re.M)

#: The line `pixel_suite.py` prints only on a real, complete, passing comparison. Shared by
#: timeplt and thepit. The `^` under re.M is load-bearing: the suite also prints INDENTED
#: per-window lines ending in "-> PASS", and those must not satisfy this.
PIXEL_SUITE_PASS = re.compile(r"^pixel_suite: PASS", re.M)

#: game -> [(argv, success pattern)]. A game absent from here CANNOT be evaluated, and this gate
#: refuses rather than assuming. Adding a game means verifying its success line at the source,
#: not guessing it from another game's format.
SUITES = {
    "timeplt": [(["python3", "games/timeplt/tools/pixel_suite.py"], PIXEL_SUITE_PASS)],
    "thepit": [(["python3", "games/thepit/tools/pixel_suite.py"], PIXEL_SUITE_PASS)],
}

#: game -> why it has no single automated suite here, and what to run by hand instead.
#:
#: Donkey Kong's pixel validation is real but split across per-mechanic suites with a different
#: report format (`move_suite.py`, `prize_suite.py`), and their pass lines are NOT wired here
#: because they were never observed matching. Both always exit 0 and `move_suite.py` prints no
#: summary line at all, so a naive predicate would match a per-row PASS while siblings failed. A
#: predicate never seen to match is an instrument that returns a believable answer without having
#: measured anything -- worse than none, because this one would be trusted.
MANUAL = {
    "dkong": (
        "Donkey Kong's pixel gates are games/dkong/tools/move_suite.py and prize_suite.py, not a\n"
        "  single pixel_suite.py. Both always exit 0 and their PASS-line formats differ, so no\n"
        "  predicate is encoded here -- an unverified one would be trusted and is worse than none.\n"
        "  Run both by hand and paste the verdicts into the review."
    ),
}

#: game -> the written reason this game's pixel gate is not required.
#:
#: ★ AN ENTRY EXEMPTS THE GAME UNTIL IT IS REMOVED. It is not scoped to one commit, and nothing
#: here can make it so: once adjudicated it keeps waiving every later commit silently. Prefer
#: fixing the suite. Empty by design -- an entry is legitimate only when the gate genuinely cannot
#: run and the reason is one a reviewer can check, since silence reads exactly like the oversight
#: this catches.
EXEMPT = {}


def staged_paths():
    """Every staged path, INCLUDING deletions and both ends of a rename.

    `--name-only` reports only a rename's destination, so a module moved OUT of a watched
    directory would look like an unrelated add. `--name-status -z` gives the source too, and
    deletions are included rather than filtered out: removing a module changes what renders.
    """
    out = subprocess.run(["git", "diff", "--cached", "--name-status", "-z"],
                         cwd=REPO, capture_output=True, text=True, check=True).stdout
    fields = [f for f in out.split("\0") if f]
    paths, i = [], 0
    while i < len(fields):
        status = fields[i]
        # A rename/copy status (R100, C75) is followed by BOTH source and destination.
        n = 2 if status[:1] in ("R", "C") else 1
        paths.extend(fields[i + 1:i + 1 + n])
        i += 1 + n
    return paths


def board_to_games():
    """board id -> [game ids], read from each manifest's `board:` field.

    Read rather than assumed: the board is the MAME driver name and need not match the game
    directory. A board that no manifest claims maps to nothing, which is correct -- an unclaimed
    board cannot change any game's pixels.
    """
    out = {}
    games_dir = os.path.join(REPO, "games")
    if not os.path.isdir(games_dir):
        return out
    for game in sorted(os.listdir(games_dir)):
        mf = os.path.join(games_dir, game, "manifest.js")
        if not os.path.isfile(mf):
            continue
        with open(mf, encoding="utf-8") as fh:
            m = MANIFEST_BOARD.search(fh.read())
        if m:
            out.setdefault(m.group(1), []).append(game)
    return out


def affected_games(paths):
    """Games whose render-affecting files are in the staged set, in stable order."""
    seen, boards = [], None
    for p in paths:
        m = RENDER_AFFECTING.match(p)
        if m:
            if m.group(1) not in seen:
                seen.append(m.group(1))
            continue
        b = BOARD_PATH.match(p)
        if b:
            if boards is None:
                boards = board_to_games()
            for game in boards.get(b.group(1), []):
                if game not in seen:
                    seen.append(game)
    return seen


def game_runtime(game):
    """A game's declared `runtime`, or None if it cannot be read."""
    mf = os.path.join(REPO, "games", game, "manifest.js")
    try:
        with open(mf, encoding="utf-8") as fh:
            m = MANIFEST_RUNTIME.search(fh.read())
    except OSError:
        return None
    return m.group(1) if m else None


def run_suite(argv, pattern, timeout=900):
    """(ok, output). ok ONLY when the process exits 0 AND prints its literal pass line.

    Both halves are load-bearing, but not for the reason it is tempting to give: the anchored
    pattern already rejects the suite's indented per-window lines, so the pattern alone would not
    be fooled by "one window passed." The exit code earns its place against a suite that prints
    PASS and then dies -- a crash or a non-zero exit after the verdict line.
    """
    try:
        r = subprocess.run(argv, cwd=REPO, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError as e:
        return False, f"could not execute {' '.join(argv)}: {e}"
    except subprocess.TimeoutExpired:
        return False, f"{' '.join(argv)} exceeded {timeout}s and was killed"
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        return False, out + f"\n[exit {r.returncode}]"
    return bool(pattern.search(out)), out


def dormancy_caveat(game, paths):
    """The warning to hang on a PASS that cannot mean what it looks like, or "".

    A PASS driven ONLY by `idiomatic/` paths, for a game whose runtime is not "idiomatic", is the
    exact artifact the docs exist to qualify: the suite rendered the oracle and never executed a
    line of what was staged. Printing it bare invites the reading it is meant to prevent, so the
    caveat travels with the verdict instead of living only in a document someone has to consult.
    """
    matched, boards = [], None
    for p in paths:
        m = RENDER_AFFECTING.match(p)
        if m:
            if m.group(1) == game:
                matched.append(p)
            continue
        b = BOARD_PATH.match(p)
        if b:
            # A board path is a REAL render change the suite executed, so it must count as
            # matched -- otherwise a board edit staged beside idiomatic ones is invisible here
            # and the caveat claims "this PASS does not cover the staged change" when it does.
            if boards is None:
                boards = board_to_games()
            if game in boards.get(b.group(1), []):
                matched.append(p)
    if not matched or not all(IDIOMATIC_ONLY.match(p) for p in matched):
        return ""
    if game_runtime(game) == "idiomatic":
        return ""
    return ("\n  ★ but the staged paths are idiomatic/ ONLY, and this game's runtime is not "
            f'"idiomatic" -- the suite rendered the ORACLE and executed none of them.\n'
            "    This PASS does NOT cover the staged change. See docs/pixel-gate.md.")


def cmd_check(_args=None):
    paths = staged_paths()
    games = affected_games(paths)
    if not games:
        return 0

    failed = []
    for game in games:
        if game in EXEMPT:
            print(f"pixel_gate_required: {game} EXEMPT -- {EXEMPT[game]}")
            continue
        if game not in SUITES:
            manual = MANUAL.get(game)
            print(f"pixel_gate_required: {game} CANNOT BE EVALUATED", file=sys.stderr)
            print(f"  {manual}" if manual else
                  f"  No pixel suite is declared for {game} in tools/pixel_gate_required.py.",
                  file=sys.stderr)
            failed.append(game)
            continue
        for argv, pattern in SUITES[game]:
            print(f"pixel_gate_required: {game} -- running {' '.join(argv)}")
            ok, out = run_suite(argv, pattern)
            tail = "\n".join(out.strip().splitlines()[-12:])
            if ok:
                print(f"  {game}: PASS{dormancy_caveat(game, paths)}\n{tail}")
            else:
                print(f"  {game}: REFUSED -- the suite did not print its PASS line.\n{tail}",
                      file=sys.stderr)
                failed.append(game)

    if failed:
        print(
            "\npixel_gate_required: REFUSING THE COMMIT.\n"
            f"  Staged render-affecting changes for: {', '.join(failed)}\n"
            "  The per-routine and assembled-swap gates never look at a pixel, so a green suite\n"
            "  says nothing about the glass. SKIP (no MAME, no romset) and INCOMPLETE are NOT\n"
            "  passes -- they mean nothing was checked.\n"
            "  Either make the suite runnable and green, or add a checkable reason to EXEMPT in\n"
            "  tools/pixel_gate_required.py so the waiver lands in the diff and gets reviewed.",
            file=sys.stderr)
        return 1
    return 0


def _fixture(tmpdir, name, text, rc):
    """A stand-in suite that prints `text` and exits `rc`, so the selftest drives the REAL
    subprocess path in run_suite instead of re-implementing its predicate."""
    path = os.path.join(tmpdir, name)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("import sys\nsys.stdout.write(%r)\nsys.exit(%d)\n" % (text, rc))
    return ["python3", path]


def _selftest_staged_paths():
    """Drive the REAL `staged_paths` against a REAL git index. Returns the failure count.

    The cmd_check arms monkeypatch `staged_paths`, so they never execute the git invocation and
    cannot notice it losing deletions or a rename's source path -- asserting against itself, one
    level down from the predicate. Only a real index exercises the flags: narrowing them back to
    `--name-only --diff-filter=ACMR` is invisible to every other arm here.
    """
    global REPO
    bad, saved = 0, REPO
    with tempfile.TemporaryDirectory() as repo:
        def git(*a):
            subprocess.run(["git", *a], cwd=repo, check=True,
                           capture_output=True, text=True)
        try:
            git("init", "-q")
            git("config", "user.email", "selftest@example.invalid")
            git("config", "user.name", "selftest")
            os.makedirs(os.path.join(repo, "games", "tp", "idiomatic"))
            os.makedirs(os.path.join(repo, "archive"))
            for n in ("gone.js", "moved.js"):
                with open(os.path.join(repo, "games", "tp", "idiomatic", n), "w") as fh:
                    fh.write("// %s\n" % ("x" * 200))
            git("add", "-A")
            git("commit", "-qm", "base")
            git("rm", "-q", "games/tp/idiomatic/gone.js")
            git("mv", "games/tp/idiomatic/moved.js", "archive/moved.js")

            REPO = repo
            paths = staged_paths()
            for label, want in [("deleted module", "games/tp/idiomatic/gone.js"),
                                ("rename SOURCE", "games/tp/idiomatic/moved.js")]:
                ok = want in paths
                bad += not ok
                print(f"  [{'ok ' if ok else 'BAD'}] real git: {label} in staged_paths -> {ok}")
            fires = affected_games(paths) == ["tp"]
            bad += not fires
            print(f"  [{'ok ' if fires else 'BAD'}] real git: a module LEAVING the layer fires "
                  f"the gate -> {fires}")
        finally:
            REPO = saved
    return bad


def _selftest_manifest_reads():
    """Manifest fields must come from a DECLARATION, never from a `//` comment.

    The real corpus cannot supply the discriminating case: two shipped manifests carry
    `// Live runtime: "idiomatic" ...` above their real field, and both happen to AGREE with it,
    so an unanchored read returns the right answer on every game today. Construct the manifest
    where they disagree. The unsafe direction is the one that matters -- a comment reading
    "idiomatic" above a translated declaration suppresses the dormancy caveat, deleting the
    warning exactly where it is needed.
    """
    global REPO
    bad, saved = 0, REPO
    with tempfile.TemporaryDirectory() as root:
        gdir = os.path.join(root, "games", "trap")
        os.makedirs(gdir)
        with open(os.path.join(gdir, "manifest.js"), "w", encoding="utf-8") as fh:
            fh.write('// Live runtime: "idiomatic" runs the whole game on the readable layer.\n'
                     '// board: "decoy"\n'
                     'export const manifest = {\n'
                     '  board: "trapboard",\n'
                     '  runtime: "translated",\n'
                     '};\n')
        try:
            REPO = root
            for label, got, want in [
                ("runtime read past a contradicting comment", game_runtime("trap"), "translated"),
                ("board read past a contradicting comment",
                 sorted(board_to_games().keys()), ["trapboard"]),
            ]:
                ok = got == want
                bad += not ok
                print(f"  [{'ok ' if ok else 'BAD'}] manifest: {label} -> {got!r} "
                      f"(expected {want!r})")
            # And the caveat must still fire for this game: runtime really is "translated".
            fired = bool(dormancy_caveat("trap", ["games/trap/idiomatic/x.js"]))
            bad += not fired
            print(f"  [{'ok ' if fired else 'BAD'}] manifest: caveat NOT suppressed by the "
                  f"comment -> {fired}")
        finally:
            REPO = saved
    return bad


def cmd_selftest(_args=None):
    """Prove this gate can REFUSE -- by driving run_suite and cmd_check, not a copy of them.

    A selftest that recomputes the predicate inline instead of calling it asserts against itself:
    it stays green even with the pattern check deleted from `run_suite` outright, which is the one
    defect this whole tool exists to avoid. Drive the real functions. Controls run first; if the
    PASS case is not ACCEPTED, the refusals below prove only that the predicate rejects everything.
    """
    bad = 0
    with tempfile.TemporaryDirectory() as tmp:
        cases = [
            ("PASS (control -- must be ACCEPTED)", "  boot -> PASS\npixel_suite: PASS\n", 0, True),
            ("SKIP, no mame -- exit 0, THE FAILURE MODE", "pixel_suite: SKIP -- no `mame` on PATH\n", 0, False),
            ("SKIP, no romset -- exit 0", "pixel_suite: SKIP -- romset timeplt not found\n", 0, False),
            ("INCOMPLETE -- short render", "pixel_suite: INCOMPLETE -- 3 of 1801\n", 1, False),
            ("FAIL -- real divergence", "pixel_suite: FAIL\n", 1, False),
            ("silence -- suite printed nothing", "", 0, False),
            ("indented window PASS, NO verdict line", "  boot+attract -> PASS\n", 0, False),
            ("PASS line then non-zero exit (a crash after the verdict)", "pixel_suite: PASS\n", 3, False),
        ]
        for i, (label, text, rc, want) in enumerate(cases):
            argv = _fixture(tmp, f"s{i}.py", text, rc)
            got, _ = run_suite(argv, PIXEL_SUITE_PASS)
            mark = "ok " if got == want else "BAD"
            bad += got != want
            print(f"  [{mark}] {label}: accepted={got} expected={want}")

        # A suite that cannot be executed at all must refuse, not crash the hook.
        got, _ = run_suite(["python3", os.path.join(tmp, "does-not-exist.py")], PIXEL_SUITE_PASS)
        mark = "ok " if got is False else "BAD"
        bad += got is not False
        print(f"  [{mark}] missing suite file: accepted={got} expected=False")

        # A suite that HANGS must refuse. Without this arm the timeout handler can be mutated to
        # return True and every other arm stays green -- a wedged render would read as a pass.
        hang = os.path.join(tmp, "hang.py")
        with open(hang, "w", encoding="utf-8") as fh:
            fh.write("import time\nprint('pixel_suite: PASS')\ntime.sleep(30)\n")
        got, _ = run_suite(["python3", hang], PIXEL_SUITE_PASS, timeout=1)
        mark = "ok " if got is False else "BAD"
        bad += got is not False
        print(f"  [{mark}] suite HANGS past its timeout: accepted={got} expected=False")

        # Drive cmd_check end-to-end: the decision to refuse lives there, not in run_suite.
        real_staged, real_suites = globals()["staged_paths"], SUITES
        try:
            for label, paths, suites, want_rc in [
                ("cmd_check: no render-affecting paths -> allow",
                 ["docs/pixel-gate.md"], {}, 0),
                ("cmd_check: idiomatic staged, suite passes -> allow",
                 ["games/timeplt/idiomatic/loc_1.js"],
                 {"timeplt": [(_fixture(tmp, "ok.py", "pixel_suite: PASS\n", 0), PIXEL_SUITE_PASS)]}, 0),
                ("cmd_check: idiomatic staged, suite SKIPs -> REFUSE",
                 ["games/timeplt/idiomatic/loc_1.js"],
                 {"timeplt": [(_fixture(tmp, "skip.py", "pixel_suite: SKIP\n", 0), PIXEL_SUITE_PASS)]}, 1),
                ("cmd_check: undeclared game staged -> REFUSE",
                 ["games/dkong/idiomatic/marioWalk.js"], {}, 1),
                ("cmd_check: a BOARD path reaches its game -> REFUSE (undeclared here)",
                 ["boards/dkong/video.js"], {}, 1),
                ("cmd_check: an unclaimed board reaches nothing -> allow",
                 ["boards/nosuchboard/video.js"], {}, 0),
            ]:
                globals()["staged_paths"] = lambda p=paths: p
                globals()["SUITES"] = suites
                rc = cmd_check()
                mark = "ok " if rc == want_rc else "BAD"
                bad += rc != want_rc
                print(f"  [{mark}] {label}: rc={rc} expected={want_rc}")
        finally:
            globals()["staged_paths"], globals()["SUITES"] = real_staged, real_suites

    bad += _selftest_staged_paths()
    bad += _selftest_manifest_reads()

    # The path matcher decides whether the gate fires at all; one that never fires is a gate that
    # never runs, and it would look exactly like a clean repo.
    #
    # ★ The `*ness.js` / `*-notes.md` entries are not padding. The real tree contains no path that
    # starts with "idiomatic" WITHOUT being the directory, so against real data a regex that has
    # lost its trailing slash behaves identically to one that has not. These are the discriminating
    # cases the corpus cannot supply; without them that mutation is invisible.
    for path, want_game in [
        ("games/timeplt/idiomatic/loc_1234.js", "timeplt"),
        ("games/timeplt/idiomatic/names.js", "timeplt"),
        ("games/timeplt/translated/loc_1234.js", "timeplt"),
        ("games/timeplt/routines.js", "timeplt"),
        ("games/timeplt/machine.js", "timeplt"),
        ("games/timeplt/tools/render.js", "timeplt"),
        ("games/timeplt/tools/pixel_suite.py", "timeplt"),
        ("games/dkong/idiomatic/marioWalk.js", "dkong"),
        ("games/timeplt/manifest.js", "timeplt"),
        ("boards/timeplt/video.js", "timeplt"),
        ("boards/nosuchboard/video.js", None),
        ("games/timeplt/idiomaticness.js", None),
        ("games/timeplt/translated-notes.md", None),
        ("games/timeplt/routines.js.bak", None),
        ("games/timeplt/audio/samples/x.wav", None),
        ("docs/pixel-gate.md", None),
        ("tools/review_gate.py", None),
        ("core/machine.js", None),
    ]:
        got = affected_games([path])
        got_game = got[0] if got else None
        mark = "ok " if got_game == want_game else "BAD"
        bad += got_game != want_game
        print(f"  [{mark}] {path} -> {got_game} (expected {want_game})")

    # The dormancy caveat must appear exactly when a PASS cannot mean what it looks like, and must
    # NOT appear otherwise -- a caveat printed on every PASS is noise that gets filtered out.
    for label, game, paths, want in [
        ("idiomatic-only on a translated-runtime game -> CAVEAT",
         "timeplt", ["games/timeplt/idiomatic/loc_1.js"], True),
        ("idiomatic AND translated staged -> no caveat (the suite ran that code)",
         "timeplt", ["games/timeplt/idiomatic/loc_1.js", "games/timeplt/translated/loc_1.js"], False),
        ("idiomatic-only on an idiomatic-runtime game -> no caveat",
         "thepit", ["games/thepit/idiomatic/x.js"], False),
        # A board path IS a render change the suite executed, so it must count as matched --
        # otherwise the caveat claims the PASS does not cover a change that it does cover.
        ("idiomatic AND a board path -> no caveat (the suite rendered the board change)",
         "timeplt", ["games/timeplt/idiomatic/x.js", "boards/timeplt/video.js"], False),
        ("a board path for ANOTHER game does not clear the caveat",
         "timeplt", ["games/timeplt/idiomatic/x.js", "boards/dkong/video.js"], True),
    ]:
        got = bool(dormancy_caveat(game, paths))
        mark = "ok " if got == want else "BAD"
        bad += got != want
        print(f"  [{mark}] caveat: {label} -> {got}")

    print("pixel_gate_required selftest: " + ("OK" if not bad else f"{bad} FAILING CASE(S)"))
    return 1 if bad else 0


def cmd_run(game):
    """Run one game's declared pixel suite(s) on demand, outside any staged-diff context."""
    if game not in SUITES:
        manual = MANUAL.get(game)
        print(f"pixel_gate_required: no pixel suite is declared for {game}.", file=sys.stderr)
        if manual:
            print(f"  {manual}", file=sys.stderr)
        return 2
    rc = 0
    for argv, pattern in SUITES[game]:
        ok, out = run_suite(argv, pattern)
        print(out.rstrip())
        if not ok:
            print(f"pixel_gate_required: {game} did NOT pass -- "
                  "SKIP and INCOMPLETE are not passes.", file=sys.stderr)
            rc = 1
    return rc


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "check":
        return cmd_check()
    if cmd == "selftest":
        return cmd_selftest()
    if cmd == "run":
        if len(sys.argv) < 3:
            print(f"usage: {sys.argv[0]} run <game>", file=sys.stderr)
            return 2
        return cmd_run(sys.argv[2])
    print(f"usage: {sys.argv[0]} [check|selftest|run <game>]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
