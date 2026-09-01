# Computer Archeology contrib emitter

`gen_ca_contrib.py` is a **generic, multi-game** emitter for the two data-driven
[Computer Archeology](https://computerarcheology.com) contribution pages. Given a game
name it derives every path from `games/<game>/` and writes into
`games/<game>/contrib/computerarcheology/`:

| page | content | built from |
|---|---|---|
| `RAMUse.md` | one table row per work-RAM cell | `idiomatic/names.js` `export const NAME = 0xADDR;` (+ its comment) |
| `Code.md` | the reachability-driven disassembly, in CA style | `out/dk.asm` (raw disasm) + `names.js` ROUTINES roles + cell names |

`Hardware.md` and `README.md` are **hand-authored per game** (irreducible prose); the
emitter does not generate them.

## Usage

```
python3 tools/gen_ca_contrib.py <game> [out_dir]
```

`out_dir` defaults to the game's own `contrib/computerarcheology/`. Pass an explicit
directory (e.g. a scratch dir) to emit elsewhere **without** writing into a finished
game's committed contrib — this is how the generalization diff is run (regenerate an
already-contrib'd game to scratch, diff against its committed pages).

## Output format — mirrors the committed The Pit pages exactly

The target is `games/thepit/contrib/computerarcheology/{RAMUse,Code}.md` (the accepted
CA contribution), byte-for-format:

- **Instruction line**: address + raw bytes LEADING, UPPERCASE mnemonic, operands in
  `$hex`, then a trailing `;` cross-reference comment — the `;` sits at column 50:
  `AAAA: BB BB BB   MNE  OPS   ; {token}`.
- **Branch token**: `CALL`/`JP`/`JR`/`DJNZ` to a named routine → `{code.<name>}`; to an
  unnamed-but-reachable address → `{code.loc_<addr>}`.
- **Memory token**: a parenthesised absolute access resolves against the hardware map —
  work RAM → `{hard.workRam[+off]}`, program ROM → `{hard.rom[+addr]}`. Every work-RAM
  access is tokened (named or not); unnamed I/O ports are left bare (no Hardware.md
  anchor to point at).
- **Routine head**: an address carrying a ROUTINES English name is emitted as that name
  as a LABEL, preceded by a `;`-wrapped header block built from its role; every other
  head stays `loc_<addr>`.
- **Unreached span**: `; ---- $A-$B: data ----` header + 16-byte hex rows
  (region-relative), matching The Pit's data blocks.

The `>>>` lines (`>>> memory`, `>>> cpu`, `>>> binary`, `>>> deploy`) are functional CA
site-generator markup and are emitted verbatim.

## Sources (all read-only)

- `idiomatic/names.js` — the cell map (`export const`) and the `ROUTINES` table (name +
  role + cert). The ROUTINES regex is widened vs `gen_semantic_disasm.build_role_map` to
  also catch multi-line entries and entries carrying a `why:` field, with a parse-gap
  assert (every `0xADDR: {` opener must be captured).
- `out/dk.asm` — the raw reachability-driven disassembly (itself produced by
  `tools/trace.py` from YOUR ROM). Only ever read.
- `rom/maincpu.bin` — YOUR ROM (ground truth, local/BYO, never committed). Read only to
  supply the exact bytes of `FORCE_DATA` spans / `FORCE_CODE` re-decodes (robust to dk.asm
  coverage holes and straddling boundaries) and to verify the byte round-trip. Absent it,
  the emitter falls back to scraping dk.asm.
- `manifest.js` — title / CPU / ROM parts for the top matter.

## Cell descriptions and shared group headers

A cell's description comes from (in precedence) its inline `// ...` comment, else the
JSDoc block above it, else the `// ──` group header it sits under. Whichever the source,
the text is cleaned (no JSDoc frame, no `[code]`/`[seen]`/`[guess]` tag, no
`NAME (0xADDR) —` self-preamble) and reduced to its first COMPLETE sentence, never cut
mid-clause.

A group header documents several cells at once, and its opening sentence often singles
out ONE of them by name (`HIGH_SCORE_HI is the MSB ...`). Attributing that to a sibling
would state a falsehood, so a cell taking the group-header fallback skips any sentence
that names a DIFFERENT cell constant and takes the first that names only itself or none.
(The sibling-name test matches multi-word `UPPER_SNAKE` constants; a hypothetical
single-word `ALL_CAPS`-with-no-underscore constant would slip through — none exist in the
current corpus.)

## Committed, not gitignored

Unlike `gen_semantic_disasm.py` (whose `out/*.asm` is gitignored), the CA contrib pages
are **committed**, exactly as `games/dkong` and `games/thepit` commit theirs — `Code.md`
carries the ROM's disassembled byte stream, which is what a CA contribution is. This is
the project's established call for this artifact. The raw `out/*.asm` still stays local.
Byline on every page: **Disassembled by Karl Stiefvater**.
