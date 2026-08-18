# The comment gate — rationale, history, and known limitations

`tools/comment_gate.py` enforces two mechanical rules about comments. The tool's module docstring
keeps only the rule statements and the subcommand list; the reasoning, the war stories, and the
operational caveats live here so the tool itself stays under its own density cap.

## The two rules

**DENSITY.** Comment lines may not exceed `code lines // DENSITY_DIVISOR + DENSITY_FLOOR`, in `.js`,
`.mjs`, `.py` and `.lua` under `boards/ games/ tools/ core/ web/`, minus `node_modules`. A line
carrying code AND a trailing comment counts as both. Prose that outgrows its code becomes a second,
unverified account of the program that goes stale silently.

**REFERENCE** (`games/<game>/idiomatic/` only). A comment describes the file it sits in — not the
ROM, MAME, the oracle, a sibling module, a test, a doc, or a to-do. Exempt: `translated/**`,
`names.js`, and tests, whose job IS the cross-file map.

Both are decidable by a script. Whether a comment is TRUE is the reviewer's job.

## Why density, and the cap's history

- **2 → 4 (2026-08-08, Karl's call)**, after measuring what the 0.50 cap was actually doing: every
  file carrying a round-3 blocker sat AT the ceiling — pixel_suite.py 0.50, render.js 0.49,
  assembled-swap.test.js 0.49, pixel_gate_required.py 0.48, loc_32eb.js 0.48. Not one comfortably
  inside it. A cap was being treated as a target, and the prose written to fill it is where that
  round's five false claims lived. Forced to compress nine lines to two, the lines that went
  contained a falsehood no gate could see. Errors concentrate in the elaboration, so halving the
  elaboration is the cheapest instrument available — it costs no review time and fires before a
  reviewer is ever spawned.
- **+ DENSITY_FLOOR = 4 (2026-08-10, Karl's call).** Always allow at least four comment lines
  regardless of code size. The `/DIVISOR` cap alone starves small routines whose honest header
  (5–11 lines) predates the rule, so a pure rename could not land without gutting documentation
  prior passes wrote. The floor is that headroom.
- The gate checks STAGED files only, so a change to the cap is self-limiting: a file pays when it is
  next touched, not today. At the 2→4 change: 3,083 in-scope files, 1,561 already over the old 0.50
  cap, 2,852 over the new one — not a wall, the migration, spread over whenever each file is next edited.

## Exemptions — none by KIND, one by POSITION

**NOTHING IS EXEMPT BY KIND** — not the transcription layer, not generated files, not the gate file
itself. Every kind-exemption that was once here began as an assumption about what the rule would do
to a class of files, and each was wrong when the class was finally measured. Narrowing the rule to
JS only was a scope cut dressed as a principle, and it exempted the gate from the rule it enforces.

One file is exempt **by POSITION**: `games/<game>/idiomatic/names.js`, the address-to-name map,
whose comments are each entry's own content rather than commentary on code. Exempt by exact position,
not basename — a basename test would silently exempt a future `idiomatic/sub/names.js`.

`translated/` is governed like everywhere else; a trailing mnemonic is a comment restating the line
beside it, so when a transcription trips the cap the remedy is to delete it.

## Whole-file, so an over-cap file is frozen against every edit

`density_violations` recomputes the cap per file with no delta awareness, so a commit REMOVING fifty
comment lines from an over-cap file blocks exactly as one adding a line does. No partial credit, no
escape hatch. The consequence is procedural: when a one-line correction lands on a file already over,
bringing that file under the cap becomes a prerequisite UNIT, sequenced first and reviewed on its
own. Do not park the correction in the working tree meanwhile — a parked edit makes a tree-wide grep
report the fix as already made, and that is the state that most tempts a `--no-verify`.

## Lexing: a wrong counter fails in both directions

Counting comments needs a real lexer for the host language, and a wrong one fails both ways —
blocking an honest file, or letting prose through. Three review rounds found hand-written lexers
wrong on Python string prefixes, shell parameter expansion, and `<<` in shell arithmetic.

**Why a prefix test is not enough.** Deciding a line by whether it starts with `//` fails both
directions: a `//` inside a template literal is not a comment, a script blocked for the banner it
PRINTS cannot be brought into compliance, and a trailing `// <claim>` after code is prose a
leading-prefix test never sees. So the JS scanner tracks quotes, template literals and regex
literals, and charges a line as COMMENT if any comment sits on it and CODE if any non-comment text
does — both, when both do.

- **Python** uses `tokenize`, which ships with the interpreter and IS the reference lexer.
- **Lua** is hand-written (the repo takes no third-party Python), so it needs an argument for being
  trusted, in two parts that cover different things. The corpus cross-check against Pygments' Lua
  lexer, over every `.lua` file in the tree, agrees exactly — but that says nothing about the long
  bracket, because **no file in the repo contains a long bracket of any kind** (no `[[`, `[=[`, or
  `--[[`); the corpus establishes agreement only on the forms the tree actually uses, and
  long-bracket handling is carried entirely by the `DENSITY_CASES` fixtures. And agreement is not the
  standard of correctness: Pygments is WRONG on an unterminated `--[[` at EOF — it emits the first
  line as a comment and the rest as code, where Lua runs the comment to EOF — and this scanner is
  right there, so agreeing would have made it wrong.
- **Shell stays out** — no second implementation to check a hand-written one against, and the
  hand-written one WAS measured wrong.

Telling a JS regex literal from division needs a parser, not a scanner. Guessing it wrong failed OPEN
in both directions at once — a quote inside the regex body opened a phantom string that swallowed the
following comment lines AND inflated the code count, so the cap rose while the prose it was meant to
catch went invisible. It is not guessed at any more: after a value keyword the reading is a regex —
the test is on token SPELLING, so `in` and `of` are left out as ordinary identifiers — and after
`)`, `]` or `}` the file is scanned BOTH ways and refused if the readings disagree. At those
ambiguous positions two cheap facts settle almost every line: a regex must CLOSE on its own line,
and never opens on whitespace (`/ c` is division). An earlier attempt
only caught the case where the phantom string ran off the end of the line, which made correctness
depend on the parity of apostrophes in the prose being measured: one `don't` in a trailing comment
closed the string and the comment vanished. Both rules now share one scanner, so neither can be fixed
without the other. A gate that refuses a file it cannot read is recoverable; one that waves it through is not.

## Known limitations — a green means less than it looks like

- **FAIL CLOSED** on a git error, and on any file the scanner cannot lex.
- **`check` is VACUOUS when nothing in scope is staged** — green is evidence only when an in-scope file is staged.
- The reference rule catches citations **by form, not meaning**.

## The cleanup phase — `idiomaticComplete`

Once a game's idiomatic port is finished (`idiomatic_gate` reports 0 cruft, including 0 unlifted for a
closure game), it enters a CLEANUP phase where each routine is reworked to carry *verbose* explanatory
comments — the deliberate opposite of the density discipline. The switch is a single game-local flag,
`idiomaticComplete: true`, in `games/<game>/manifest.js` (deliberately NOT a repo-wide list — game settings
live with the game).

When a game declares it, **both** comment_gate rules step aside for that game's `idiomatic/**`:
- the DENSITY cap no longer applies (comments may exceed code), and
- the REFERENCE rule no longer applies (a comment may cite the ROM, MAME, the oracle, or hardware — exactly
  the context a mechanism explanation needs).

`names.js` and `test/` are unaffected. The flag is read from the **INDEX**, so verbose mode takes effect
only once the flag itself is committed.

**Enforced, not trusted.** `idiomatic_gate check` blocks any game that declares `idiomaticComplete: true`
while it still holds cruft (cruft + unlifted must be 0). A game earns the verbose exemption only by actually
being done — the flag cannot be flipped merely to escape the comment rules on an unfinished port.
