# Semantic disassembly generator

`gen_semantic_disasm.py` emits a **semantic (annotated) disassembly** of the Time Pilot main-CPU
ROM: the raw reachability-driven disassembly with the project's English routine names, work-RAM cell
names, and routine roles merged in as trailing comments.

## Usage

```
python3 games/timeplt/tools/gen_semantic_disasm.py
```

It reads `games/timeplt/out/dk.asm` (the raw disassembly, itself produced by `tools/trace.py` from
YOUR ROM) and writes `games/timeplt/out/timeplt-semantic.asm`. The raw `dk.asm` is only ever read.

## Ship the tool, not the output

The output reproduces the ROM's disassembled **byte stream** (the `; <addr> <hex>` columns are the
ROM's own bytes), exactly like `dk.asm`. So both live in the gitignored `out/` directory and are
**never committed** — regenerate them from your own ROM. This tool is the shipped artifact: it is
original reverse-engineering, carries no ROM bytes, and reads `dk.asm` at runtime. Same posture as
the ROM data and the recorded audio (see `README-samples.md`): the repo ships the tool, not the
copyrighted output.

## The three maps (all built live from the idiomatic layer)

| map | `0xADDR ->` | source |
|---|---|---|
| CELL | work-RAM cell NAME | `idiomatic/names.js` `export const NAME = 0xADDR;` |
| ROUTINE | English routine name | `idiomatic/test/equivalence-<addr>.test.js` (address from the filename; name from the first idiomatic import) |
| ROLE | one-paragraph role | the `ROUTINES` table in `idiomatic/names.js` |

Addresses with no equivalence test stay `loc_<addr>` (unlifted stubs, tamper traps, and the ~14
lifted routines that live inside UNREACHED `defb` spans and so have no `loc_` label to annotate).

## What it annotates

- `loc_<addr>:` label -> `  ; <RoutineName>`, with the wrapped role paragraph inserted above the
  label when the address has a ROLE entry.
- RAM operand `(0xADDR)` / `,0xADDR` where the address is a named cell -> `  ; <CELL_NAME>` (aligned
  in a right-hand column).
- ROM branch `call/jp/jr/djnz 0xADDR` where the target is a routine head -> `  ; -> <RoutineName>`.

## Guarantees (asserted by the tool's self-test each run)

- **Lossless.** Strip every annotation the tool added and the result is **byte-identical** to raw
  `dk.asm` (the one intended edit — the `Donkey Kong maincpu` -> `Time Pilot maincpu` header swap — is
  reversed in the check). The check runs against the bytes on disk, not the in-memory model.
- **No invented names.** Every name inlined originates in one of the three maps; asserted.
- **No address is both a cell and a routine** (the cell page `0xA8xx-0xAExx` and the ROM are
  disjoint); asserted.
