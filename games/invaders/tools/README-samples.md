<!-- SPDX-License-Identifier: GPL-3.0-only -->
# `record_samples.py` — record Space Invaders' sounds from your own ROM

`games/invaders/tools/record_samples.py` drives **your** MAME against **your** Space
Invaders romset and captures the machine's sounds to individual WAV files on **your**
disk. It is a **discovery sweep**: it triggers each sound-port line, records what came
out, and reports peak/RMS so it is obvious which lines made sound. That output is the
evidence a sound map is built from.

---

## The copyright position

Space Invaders' audio is Taito's copyrighted work — exactly like its program ROM. **This
repository ships none of it, and never will.** The posture is identical to the bring-your-
own-ROM design in `games/invaders/rom/`:

| ships in git | never ships in git |
| --- | --- |
| the recorder, the sweep, the analysis | any Space Invaders audio |

You generate the samples locally, from a romset you own. The output directory
`games/invaders/audio/samples/` is gitignored (`games/*/audio/samples/`). **Do not commit
or redistribute anything this tool produces.**

## Why record instead of extract

Space Invaders has **no sound CPU and no sample ROM** — its sound is pure **discrete
analogue circuits** (the mw8080bw board), which MAME synthesises from a netlist. There is
nothing to extract; the only way to get the sounds is to trigger the circuits and record
what they make.

## How a sound is isolated

The running program writes its own attract-mode sounds, which would contaminate every
clip. We cannot mute an `OUT` after the fact (the discrete circuit fires on the write
*edge*), and NOPping the ROM's `OUT` instructions does not stick (MAME ROM is read-only to
lua). So the recorder **freezes the CPU with interrupts disabled**: it boots far enough to
initialise, then pokes `DI; jmp $` into work RAM and parks the PC there so the 8080 spins
forever, its RST1/RST2 interrupts masked (those ISRs are what ran the contaminating
sound). The mw8080bw audio device keeps running independently, and the lua-injected OUT
3/5 latch is the only thing driving it — a clean sound over a truly silent baseline.

## What the sweep measures

The two sound ports (SOUND_PORT3_SHADOW `0x2094` → OUT 3, SOUND_PORT5_SHADOW `0x2098` →
OUT 5) each carry one trigger per bit:

* **OUT 3** b0 UFO · b1 player shot · b2 player explosion · b3 invader die · b4 extra life
  · b5 amp/UFO-mute control (no sound of its own).
* **OUT 5** b0–b3 the four fleet-march steps · b4 UFO-hit (saucer explosion).

Each bit is captured both **edge-pulsed** (how the game fires a one-shot) and **held** (to
measure whether the sound is a steady continuous tone). `index.json`'s `measured` field is
that MAME measurement — `silent`, `steady-tone`, or `one-shot`. Whether a sound **loops**
in the port is **not** decided here: MAME cannot tell a game-held loop (the UFO) from a
game-pulsed one-shot that merely rings while this harness holds its bit. That call is made
when authoring `manifest.audio.map`, from the game's actual OUT-port hold-vs-pulse usage.

## Running it

```
games/invaders/tools/record_samples.py --out games/invaders/audio/samples
```

Reads `--rompath` (default `~/Downloads`) and needs `mame` on PATH. Writes one WAV per
non-silent line plus `index.json` to the gitignored samples directory.
