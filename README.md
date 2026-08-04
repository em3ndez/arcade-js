# arcade-js

**An experiment in using AI agents to port existing software.** The disassembly, the
translation, the tests and the tooling in this repo were produced by agents. Arcade ROMs are
the testbed, chosen for one reason: **you can prove whether the port is correct.**

Most porting work has no oracle. You rewrite something, it looks right, and "faithful" stays
a matter of opinion. An arcade ROM doesn't have that problem — MAME already runs it, so there
is a reference implementation emitting exact expected output. Correctness becomes falsifiable
and frame-by-frame: did our JavaScript produce the same pixels as the original machine code,
or did it not?

Concretely, then: arcade games **translated from their original machine code to JavaScript**,
validated **pixel-exact against MAME**. Not a re-implementation from observation — the ROM is
disassembled and translated instruction by instruction, then checked frame against frame until
the pixels match.

That falsifiable translation is the foundation. On top of it the port is made **readable** — routines
are decompiled to idiomatic JavaScript, each still proven memory-equivalent to the translation (a sweep
that's complete for The Pit and ongoing for Donkey Kong) — and **understood** — the game's mechanics
*grounded by playing it in MAME*, not guessed from the code.
The same oracle does double duty: a **gate** that proves the pixels match, and a **probe** we drive
to learn what the game means. The whole method is one page: [docs/README.md](docs/README.md).

**Donkey Kong** is the first subject, and it is complete. **The Pit** (Zilec/Centuri, 1982) is
the second, and it was chosen deliberately: **no public disassembly of it exists**, so there was
nothing for a model to have memorized — the agents had to recover it from the raw ROM. That makes
it the sharper test of the thesis, and the same falsifiable pixel gate keeps it honest. The repo
is structured to host many: multiple CPUs, multiple arcade boards, and multiple game romsets,
sharing what they genuinely share.

How the agents were organised — the division of labour, the failure modes we actually hit, and
what the tooling had to do about them — is written up in
[docs/how-the-agents-worked.md](docs/how-the-agents-worked.md).

![Donkey Kong running in the arcade-js browser player](docs/media/player-screenshot.png)

> **Status — Donkey Kong:** plays. All four boards, natural board-to-board progression, and the
> level loop all work — finish 100m and it wraps back to 25m at the next level, indefinitely —
> and the rendering is pixel-validated frame-by-frame against MAME 0.288.
>
> **Status — The Pit:** in progress. Its whole boot→attract sequence runs and renders pixel-exact
> against MAME; **all 169 of its routines are now rewritten into idiomatic JavaScript**
> (memory-equivalent to the oracle, with memory and routines named from evidence, proposer≠confirmer);
> and its full mechanics — objective, cast, win/lose — have been mapped by *playing it under MAME*.
> End-to-end gameplay pixel-validation is the remaining work.

## What's here (and what isn't)

This repo ships our **tools**, our **translation** (the JavaScript — our own expression of the
ROM's logic), and our **understanding** — each game's `gameplay.md` (how it's played, from public
research) and `mechanisms.md` (the code-grounded model of how it works). It does **not** ship the
copyrighted ROM data, nor the gitignored **build metadata** — `dk.asm`, `coverage.json`,
`blocks.def`, `unreached.txt` under `games/dkong/out/` (regenerate locally with `make trace`). You
supply your own ROM; `make rom-dkong` assembles and **sha256-verifies** it locally. See
[`games/dkong/rom/README.md`](games/dkong/rom/README.md).

### You still need the ROM — here's why

The translation replaces the ROM's **logic**, not its **contents**. A ROM is not only code:

- **Graphics and palette are pure data.** `gfx1` (8×8 tiles), `gfx2` (16×16 sprites) and the
  colour `proms` have no code in them at all. Without them there is nothing to draw.
- **The code reads the ROM as data.** Donkey Kong's first game-state handler runs
  `ld hl,0x01ba` / `ldir`, copying a table straight out of ROM. So the engine still maps the
  ROM into the address space and reads from it — our JavaScript is what *executes*, the ROM
  is still what it *reads*.

Which is exactly why the copyright line falls where it does: the JavaScript is our own
expression of the logic and it ships; the original data is Nintendo's and it never does.

## How we know it's right

If the question is whether agents can port software faithfully, the answer is only worth as
much as what could have proven it wrong. These gates are the experiment's instrumentation,
and every one of them runs from a clean checkout:

![MAME 0.288 and arcade-js running the same frames side by side](docs/media/intro-sidebyside.gif)

*Donkey Kong's game-start intro: MAME on the left, arcade-js on the right, driven by the same
input tape and aligned with the pixel gate's own frame offset. Both panels are rendered from
the very `frames.rgb` artifacts the gate diffs — not a screen recording of two windows. Shown
at 2× speed; over this 35-second run the largest single-frame difference is 0.17%.*

- **Pixel gate.** Capture a golden from **live MAME 0.288** under a pinned, determinism-
  controlled command line, run the same input tape through our engine, and diff the frames.
  Movement 6/6 and bonus-item 9/9 scenarios pass across all four board types. Those scenarios
  poke the board state to start on a given board, which keeps each one short and deterministic
  — that's a property of the fixtures, not a limit of the game, which progresses on its own.
- **Decoder cross-check.** Our Z80 decoder is checked against `z80dasm` over the whole ROM:
  6411 instruction boundaries, zero disagreements in either direction (`make verify`).
- **Step audit.** Every `m.step()` target in the translation is verified to land on a real
  instruction boundary (`make stepcheck`). The static tracer reaches ~82% of the ROM, and a
  target it never decoded is reported as **unresolved rather than excused** — either the step is
  wrong, or the tracer is missing an entry point and the map is simply incomplete. Both are work;
  neither is a pass. Treating them as gaps hid 836 bytes of live code for two weeks.
- **Several thousand unit tests** (`npm test`), with mutation patches recorded next to the
  assertions they justify, so a test that cannot fail is visible as such. Each idiomatic rewrite
  additionally carries a memory-equivalence test against the frozen oracle, with deliberately-broken
  twins it must catch.
- **State and write diffs.** RAM and the hardware write surface are diffed independently of
  pixels, which separates "the CPU translation is wrong" from "the video model is wrong."

## Layout

```
core/                 game-agnostic engine
  cpu/z80.js          the Z80 processor        (any Z80 game reuses this)
  cpu/test/           unit tests for the CPU core
  audio.js            sample-player abstraction (audio lives ABOVE emulation)
boards/               arcade hardware, named by MAME driver (a "board")
  dkong/              memory map · i8257/watchdog/latches · video/palette/geometry
  dkong/hardware.json the same, as JSON: the single source the shared Python gate
                      tools read via --hardware, instead of hardcoding DK addresses
  dkong/test/         unit tests for the board
games/                one directory per romset (dkong, thepit)
  dkong/
    manifest.js       declares its cpu + board + rom set + inputs + metadata
    translated/       the assembly-JS translation of the ROM (the frozen oracle)
    idiomatic/        readable-JS rewrites, each gated memory-equivalent to the oracle
    audio/            sound-command → sample trigger map
    rom/              gitignored — `make rom-dkong` builds it locally
    tapes/            test input tapes (published)
    test/             unit + integration tests for the translation
    entrypoints.json  disassembly entry points (folded into the trace)
    tools/            per-game gate runners (emit.js · move_suite.py · prize_suite.py)
  thepit/             the second game — same shape; its mechanisms.md maps the game
                      as understood so far (see docs/mechanisms)
web/                  browser front-end: pick a game and play it
tools/                disassembler · tracer · MAME golden capture · pixel/state diff ·
                       gate runner (verdict.sh) — shared, game-agnostic
docs/                 the method: one model (docs/README.md) + a technique guide per move
```

Tests are colocated with the code they test (`core/**/test/`, `boards/**/test/`,
`games/**/test/` — see `npm test`'s glob), not in a separate top-level `test/`.

The three layers — **CPU**, **board**, **game** — are independent axes. A game's
`manifest.js` names its CPU (`z80`) and board (`dkong`); the machine assembles
CPU + board + translated ROM. Frogger, for example, would reuse `core/cpu/z80.js` on a
future `boards/galaxian/`. A board is named for the **MAME machine config** it implements —
usually identical to the driver file (`dkong`), but not always: The Pit runs the `thepit` config
*inside* MAME's `taito/roundup.cpp` family file, so it lives at `boards/thepit/` while its hardware
is cited from `roundup.cpp`. The manifest also declares an `inputs` block (ports, actions,
key bindings) that `web/` reads to build its keyboard map — see [porting](docs/porting.md) — so a manifest
without it can't be played in the browser.

## Quickstart

Bring your own `dkong.zip` and you'll be playing in about a minute:

```sh
make rom-dkong     # assemble your ROM locally (sha256-checked)
make serve         # dev server (sets COOP/COEP), then open the printed URL
```

Pick Donkey Kong, press **5** to drop a coin and **1** to start — arrows or WASD to move,
space to jump.

```sh
npm test           # the full unit suite (ROM-dependent ones skip cleanly if you haven't built one)
```

(`make rom-dkong` is an alias for `make -C games/dkong rom`; `make serve` is an alias for
`npm run serve` — either form works, pick one.)

Requirements: Node, Python 3 (+ numpy, Pillow for the pixel gate), z80dasm (cross-checks the
decoder for `make verify`), and — for regenerating MAME goldens — MAME 0.288 and ffmpeg.

## Adding a game

See **[docs/README.md](docs/README.md)** — the whole method — and [`docs/`](docs/) for the
technique guides. In short: pick (or write) the CPU and board, translate the ROM into
`games/<name>/`, prove it pixel-exact against MAME, then decompile it to idiomatic JS and *ground*
its mechanics by playing it under MAME.

## License

[GPLv3](LICENSE). The translation and tools are ours and free software; the original ROM
data is not included and is not ours.
