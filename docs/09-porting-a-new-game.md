# 9. Porting a new game

Nothing in the method is Donkey Kong specific. A new game differs along two independent axes — its
**CPU** and its **board** — and brings one thing of its own, its **ROM**.

## The three layers

```
core/cpu/<chip>.js        the processor        shared by every game using that CPU
boards/<driver>/          the arcade hardware  shared by every game on that PCB
games/<romset>/           the translated ROM   one per game
```

- **CPU** (`core/cpu/z80.js`, and future siblings) is fully game-agnostic. A new Z80 game reuses it
  verbatim; a new CPU (6502, 6809, …) is a new module here.
- **Board** (`boards/<driver>/`: memory map, i/o chips, video/palette/geometry) is named after its
  **MAME driver**. Games on the same PCB share it — Donkey Kong Jr. and Donkey Kong 3 would reuse
  `boards/dkong/`; Frogger would need `boards/galaxian/`.
- **Game** (`games/<id>/`) is the ROM translation plus a **manifest** declaring its cpu, board, ROM
  images (with checksums), and metadata.

A game's `manifest.js` ties the three together, and the machine assembles CPU + board + translated
ROM at load time.

## The manifest's `inputs` block is required for the web player

`web/` is game-agnostic: it derives its keyboard map and its worker port list entirely from
`manifest.inputs`, never from hardcoded literals. A manifest that omits `inputs` can still pass
every gate — the pixel harness never reads it — but it can't be played in the browser. Declare:

- **`ports`** — the input-port addresses the board exposes, e.g. `{ in0, in1, in2 }`, matching the
  board's i/o module (`boards/<driver>/io.js`).
- **`actions`** — logical action name → `{ port, bit }`, e.g. `right: { port: 0x7c00, bit: 0x01 }`.
  One entry per button/direction the game reads, plus `coin` and `start1` (and `start2` if the
  cabinet has a two-player start).
- **`keys`** — `KeyboardEvent.code` → action name, e.g. `ArrowRight: "right"`. The web player builds
  its per-port key→bit maps from this at load time; it needs no per-game code of its own.

See `games/dkong/manifest.js` for the reference shape.

## The steps

The porting-specific glue is the three layers above, the `inputs` block below, keeping the ROM out
below, and registering the game — add its id to `games/registry.js`, write `games/<id>/manifest.js`
(ROM part list + sha256 checksums + the `inputs` block), and a `Makefile` `rom` target.

The **method** sequence that turns the ROM into validated JavaScript — lift → call graph &
reachability → RAM naming → bottom-up decompile, each routine memory-equivalence-gated →
pixel-exact-vs-MAME capstone — lives in exactly one place: **The pipeline for the next game** in
[the decompiler pipeline](08-decompiler-pipeline.md). Follow it there; it builds on the disassembly,
translation, and gate mechanics in docs 2–6.

## The ROM stays out

Arcade ROM data is copyrighted and is **never committed**. Each game ships a manifest that lists the
part filenames and their checksums; `make -C games/<id> rom` assembles the images from a dump the user
supplies and verifies them against the pinned sha256, so a wrong romset fails loudly. This repo
distributes tools, translation, and analysis metadata — never the original bytes.

## A validation gotcha you *will* hit: RNG that races the beam

Most arcade games seed randomness from a spin counter the main loop increments while waiting for the
vblank interrupt. It is timing-derived, so a cycle-accurate-but-not-exact translation forks it within
a few frames and every RNG-driven sprite drifts — a long pixel diff then looks broken though the logic
is identical. Don't chase cycle-exactness for it; **pin the entropy** for equivalence testing instead
(declare `manifest.entropyPin`, run with `--pin-entropy`). The full method — discovery, the pin, and
the convergent diff for the residual DMA artifact — is the *Entropy pinning* section of
[the decompiler pipeline](08-decompiler-pipeline.md).
