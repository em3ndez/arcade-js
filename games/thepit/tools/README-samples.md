<!-- SPDX-License-Identifier: GPL-3.0-only -->
# `record_samples.py` — record The Pit's sounds from your own ROM

`games/thepit/tools/record_samples.py` boots The Pit under MAME, sweeps its
sound-command byte, and records what each command actually produces into local
per-command WAV clips. It is the same tool, and the same posture, as Donkey
Kong's `games/dkong/tools/record_samples.py`, adapted to The Pit's much simpler
sound hardware.

arcade-js does **not** emulate The Pit's audio subsystem (the second Z80, its
program ROM, or the two AY-3-8910 PSGs). It plays audio *above* the emulation:
the board watches the game's writes to the sound latch and a sample player plays
the clip recorded for that command. This tool produces those clips.

## The copyright position

The Pit's audio is the ROM authors' copyrighted work, exactly like its sprites
and program ROM. **arcade-js ships none of it.** The repository contains the
*tooling*; you supply the *content*, same as the bring-your-own-ROM design for
`games/thepit/rom/`. This script drives the MAME you installed against the
romset you own, on your own machine, and writes the result to a **gitignored**
directory — `games/thepit/audio/samples/`, matched by `.gitignore`'s
`games/*/audio/samples/`. Nothing copyrighted enters the repository. **Do not
commit or redistribute anything it produces.**

## Why record instead of read the ROM out

The sound is produced by a live machine: a Z80 sequencing two AY-3-8910 PSGs in
real time. There is no ready-made clip sitting in the ROM to copy out — the
waveform only exists once the audio CPU has run. Recording MAME's mixed output
captures exactly what the hardware makes, which is also exactly what the sample
player has to reproduce.

## The Pit's sound hardware

From `mame-src/src/mame/taito/roundup.cpp` (`roundup_state`, game `thepitu1`):

- The main CPU writes **one command byte to `0xB800`** (a `generic_latch_8`
  named `soundlatch`). That is the only sound write the main program makes.
- A **second Z80** (`audiocpu`, 2.5 MHz) runs its own program ROM (`p30`). It is
  interrupted **every frame by the VSYNC timer**; its IRQ handler reads the
  soundlatch (through AY1 port A), acts on any pending command, and clears the
  latch by writing audio I/O port `0x00`.
- Two AY-3-8910 PSGs (ay1 at ports `0x8e`/`0x8f`, ay2 at `0x8c`/`0x8d`) mixed to
  `mono`.

The important consequence, and why triggering is trivial here: **the soundlatch
write does not itself assert the audio IRQ — the free-running VSYNC IRQ does.**
So to play command *V* you just leave *V* in `0xB800` for at least one frame;
the audio CPU samples it on its own schedule. Writing `0xB800` from the main
CPU's program space (what this tool does) reaches the latch exactly as the ROM's
own write would. There is no IRQ timing to get right.

## Usage

```sh
# default sweep: commands 0x00-0x1f and 0x80-0x98, pulse + sustain pass each,
# -> games/thepit/audio/samples/
games/thepit/tools/record_samples.py --rompath ~/Downloads

# see the plan and the exact MAME command line without running anything
games/thepit/tools/record_samples.py --rompath ~/Downloads --dry-run

# prove the capture is clean: residual level at every slot boundary
games/thepit/tools/record_samples.py --rompath ~/Downloads --report-gaps

# just the commands a real attract run was seen to send
games/thepit/tools/record_samples.py --rompath ~/Downloads --commands 130,134,137,138,143-148
```

`--rompath` is a MAME rompath holding your `thepitu1` romset. The tool needs
`mame` on `PATH` (override with `--mame`) and Python 3; it uses `numpy` if
present (it is, in this repo) and falls back to the stdlib otherwise.

### How it runs

1. Boots `thepitu1` headless under the project's determinism flags — the same
   `mame_golden.build_mame_argv` the pixel-golden captures use (fresh
   nvram/cfg, `-nocheat`, `-noautosave`, `-frameskip 0`, `-nothrottle`,
   `-video none`, `-sound none`) — plus `-wavwrite`. `-sound none` drops only
   the live host audio device; MAME still synthesises the emulated audio and
   `-wavwrite` captures it.
2. A generated `-autoboot_script` installs a **write tap on `0xB800`** that
   replaces every program-originated write with the value the tool is currently
   holding (`0` during the silence gaps). The ROM cannot touch the sound latch
   during the sweep, so attract-mode sounds cannot contaminate the clips.
3. For each swept command *V* it schedules **two passes**, each a single write
   of *V* to `0xB800` followed later by a `--stop-value` write, with a fixed
   silence gap between slots. The Lua logs the real emulated time of every slot.
4. The one `-wavwrite` recording is split back into one clip per command by
   those measured timestamps, DC-corrected, trimmed, and reported.

### Output format

Clips land in `games/thepit/audio/samples/` (created; gitignored):

- **`cmd_<decimal>.wav`** — one clip per sounding command, named in **decimal**
  to match how the commands are usually referred to: e.g. `cmd_137.wav`,
  `cmd_143.wav`. Mono, 16-bit, at `--samplerate` (48 kHz default). Silent
  commands write no file.
- **`index.json`** — the full machine-readable report: per-command `peak`,
  `rms`, `silent`, `pulse_duration_s`, `sustain_duration_s`, `sustained`,
  `loop_period_s`, plus the exact MAME argv, the sweep parameters, and the count
  of ROM sound writes the muting blocked. This is the **evidence**; it is not a
  hand-authored sound map.

Peak/RMS is printed per command so it is obvious which values made sound and
which were silent — the point of a discovery sweep.

### Two passes, and why

The **pulse** pass writes `--stop-value` early (`--hold`, default 0.1 s after
the trigger); the **sustain** pass writes it late (`--sustain-hold`, default
10 s). That difference is exactly what tells a looping tune from a one-shot:

- A **looping tune** keeps playing until it is stopped, so its length **tracks
  the stop time** — short in the pulse pass, long in the sustain pass. It is
  classified `sustained`, and the clip written is one **loop period** measured
  by normalised autocorrelation (or the whole sustain recording, flagged, if no
  clean period is found).
- A **one-shot** self-terminates at the same length no matter when the stop is
  written, so the two passes match. The clip written is the sustain pass (its
  later stop cannot cut a self-terminating sound short).

## DC-offset correction — why the tool needs it

The Pit's two AY-3-8910s sit at a **large idle DC bias that steps by ~2000 LSB
between sounds** (measured: ≈ −4100 while a sound plays, ≈ −6140 when silent). A
naive mean-removal over a whole slot is dragged toward the loud part and then
reads the constant-DC silent tail as *signal* — which makes a 1.3 s one-shot
look like an 11 s sustained tune. Each slot segment is therefore centred on its
**median** (a robust idle-level estimate: silence dominates a slot window, or
the whole window *is* one sustained sound), and the written clip is additionally
mean-removed so it carries no DC step to click at the seam.

## Measured results (MAME 0.288, `thepitu1`, macOS arm64)

Default sweep (`--commands 0x00-0x1f,0x80-0x98`), one 919 s emulated capture in
~14 s wall. **23 of 57 commands produced sound; 34 were silent; muting blocked
5435 ROM sound writes; every silent command's gap was at the noise floor**
(peak ≈ 1, threshold 64), so the muting is proven, not assumed.

- **Silent:** `0x00`–`0x1f` (0–31) and `0x80`, `0x81` (128, 129).
- **Sounding:** `0x82`–`0x98` (130–152). All ten commands a 2000-frame attract
  run was observed to send — 130, 134, 137, 138, 143, 144, 145, 146, 147, 148 —
  produce sound. Most are looping tunes; a few (`0x87`/135, `0x8e`/142) read as
  one-shots. Commands `0x90`/144 and `0x96`–`0x98`/150–152 yielded clean short
  loop periods (0.59 s and 2.48 s); the rest are longer/through-composed and are
  kept whole with a `loop-seam` note.

`index.json` carries the full per-command table.

## Honest caveats

- **Stop is not universal.** `--stop-value` defaults to `0` ("no command"),
  which silences most tunes after a ~1 s latency, but **six of The Pit's tunes
  (e.g. `0x86`/134, `0x94`–`0x98`/148–152) do not respond to it** and play until
  a different command arrives. Their slots therefore *bleed* into the following
  gap: `--report-gaps` flags exactly which, as a note (not a muting failure —
  the ROM writes are still blocked). The next clip may start with a brief tail.
  The remedy is to find the game's real stop command in the sweep results and
  pass it as `--stop-value`, or to widen `--sustain-gap`.
- **Muting failure vs tune bleed are distinguished.** A dirty gap after a
  *silent* command means the ROM's writes leaked through — that is a hard
  problem (exit 1). A dirty gap after a *sounding* command is tune bleed — a
  note. In practice only the latter occurs.
- **Clips are reproducible per schedule, not per value in isolation.** The audio
  CPU is stateful: the exact rendering of some commands depends on what played
  before. The sweep records each command from a muted, gap-separated schedule;
  that is consistent and repeatable, but it is *not* the same as capturing each
  command from a pristine machine. Treat the clips as strong evidence, refined
  by ear and by the `index.json` numbers, not as a final sound map.
- **Longer tunes are kept whole.** When no clean loop period is found the whole
  sustain recording is written and noted, so looping that clip will seam. Raise
  `--sustain-hold` (longer capture) or lower `--loop-corr` to hunt a period.

## What it cannot do

It cannot label what a sound *is* (jump, dig, coin, tune-N) — that is a human
judgement made from the clips and the `index.json` numbers. It cannot record a
command that the audio CPU only plays given some prior state the sweep does not
set up. And it cannot recover a clean loop point for a through-composed tune
that never repeats within the capture window.
