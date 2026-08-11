<!-- SPDX-License-Identifier: GPL-3.0-only -->
# `record_samples.py` — record Time Pilot's sounds from your own ROM

`games/timeplt/tools/record_samples.py` boots Time Pilot under MAME, sweeps its
sound-command byte, and records what each command actually produces into local
per-command WAV clips. It is the same tool, and the same posture, as The Pit's
and Donkey Kong's `record_samples.py`, adapted to Time Pilot's sound hardware.

arcade-js does **not** emulate Time Pilot's audio subsystem (the second Z80
`tm7`, its program ROM, or the two AY-3-8910 PSGs). It plays audio *above* the
emulation: the board watches the game's writes to the sound latch and a sample
player plays the clip recorded for that command. This tool produces those clips.

## The copyright position

Time Pilot's audio is the ROM authors' copyrighted work, exactly like its sprites
and program ROM. **arcade-js ships none of it.** The repository contains the
*tooling*; you supply the *content*, same as the bring-your-own-ROM design for
`games/timeplt/rom/`. This script drives the MAME you installed against the
romset you own, on your own machine, and writes the result to a **gitignored**
directory — `games/timeplt/audio/samples/`, matched by `.gitignore`'s
`games/*/audio/samples/`. Nothing copyrighted enters the repository. **Do not
commit or redistribute anything it produces.**

## Time Pilot's sound hardware

From MAME `src/mame/konami/timeplt.cpp` and `src/mame/shared/timeplt_a.cpp`
(game `timeplt`). Delivering a command takes **two** addresses, not one — the
important difference from The Pit:

- The main CPU writes the **command byte to `0xC000`** (a `generic_latch_8`; a
  *read* of `0xC000` is the scanline counter, a different device). That write
  does **not** by itself wake the audio CPU.
- The main CPU then **pulses an attention line, LS259 bit 2 at `0xC304`**: `D0=1`
  then `D0=0`. The **low→high edge** asserts the sound Z80's IRQ
  (`sh_irqtrigger_w`); the handler reads the latch back through AY1 port A and
  acts on the command. The trailing `0` re-arms the edge for the next command.
- A **second Z80** (`tpsound`, region `timeplt_audio:tpsound` = `tm7`) sequences
  two **AY-3-8910** PSGs through six RC low-pass filters, summed to one `mono`
  speaker.

So a command is delivered by **three ordered writes** — `0xC000=command`,
`0xC304=1`, `0xC304=0` — and the order matters: the command must be in the latch
*before* the edge, because the edge is what makes the audio CPU read it. This is
exactly what the ROM's own `sendSoundCommand` (`games/timeplt/idiomatic/`) does,
and what this tool reproduces from the main CPU's program space.

## Usage

```sh
# default sweep: commands 0x00-0x1f (where Time Pilot's codes live), pulse +
# sustain pass each, -> games/timeplt/audio/samples/
games/timeplt/tools/record_samples.py --rompath games/timeplt/rom

# see the plan and the exact MAME command line without running anything
games/timeplt/tools/record_samples.py --rompath games/timeplt/rom --dry-run

# prove the capture is clean: residual level at every slot boundary
games/timeplt/tools/record_samples.py --rompath games/timeplt/rom --report-gaps
```

`--rompath` is a MAME rompath holding your `timeplt` romset (it defaults to
`games/timeplt/rom`, where the repo's other timeplt tools look). The tool needs
`mame` on `PATH` (override with `--mame`) and Python 3; it uses `numpy` if
present (it is, in this repo) and falls back to the stdlib otherwise. Or run it
through the Makefile: `make samples GAME=timeplt ROMPATH=games/timeplt/rom`.

### How it runs

1. Boots `timeplt` headless under the project's determinism flags — the same
   `mame_golden.build_mame_argv` the pixel-golden captures use (fresh nvram/cfg,
   `-nocheat`, `-noautosave`, `-frameskip 0`, `-nothrottle`, `-video none`,
   `-sound none`) — plus `-wavwrite`. `-sound none` drops only the live host
   audio device; MAME still synthesises the emulated audio, and `-wavwrite`
   captures it from the pre-mute record buffer.
2. A generated `-autoboot_script` installs **write taps on `0xC000` and `0xC304`**
   that replace every program-originated write with the value the tool is
   currently holding (`0`), so the ROM can neither load a command nor pulse the
   attention line during the sweep. **Only those two single bytes are tapped** —
   `0xC304` sits in the `0xC300-0xC30F` LS259 bank that also carries NMI-enable,
   flip-screen, video-enable and the coin counters, and tapping the whole bank
   would break the machine.
3. For each swept command *V* it schedules **two passes**, each triggering *V*
   with the three-write sequence, then re-issuing a `--stop-value` trigger later.
   The Lua logs the real emulated time of every slot.
4. The one `-wavwrite` recording is split back into one clip per command by those
   measured timestamps, DC-corrected, trimmed, and reported.

### Output format

Clips land in `games/timeplt/audio/samples/` (created; gitignored):

- **`cmd_<decimal>.wav`** — one clip per sounding command, named in **decimal**:
  e.g. `cmd_1.wav` (the coin), `cmd_7.wav` (the player shot). Mono, 16-bit, at
  `--samplerate` (48 kHz default). Silent commands write no file.
- **`index.json`** — the full machine-readable report: per-command `peak`, `rms`,
  `silent`, `sustained`, `loop`, `loop_period_s`, the two sound addresses, the
  exact MAME argv, the sweep parameters, and the count of ROM sound writes the
  muting blocked. This is the **evidence**, not a hand-authored sound map. The
  web player reads it to know which clip to play for each command, and whether it
  loops.

### One-shot vs sustained — different from The Pit

Time Pilot's **stop** (command `0` plus the attention edge) *interrupts* whatever
is playing — unlike The Pit's latched `0`, which a one-shot ignores. So the
**pulse** pass (stop after `--hold`, 0.1 s) truncates *every* command and its
length carries no information; it is kept only as an amplitude probe. The
**sustain** pass (stop after `--sustain-hold`, 10 s) is the classifier: a one-shot
has decayed to silence before that late stop, while a **looping tune is still
sounding** when it hits. Still-sounding-at-the-late-stop ⇒ `sustained`, and the
clip written is one **loop period** (normalised autocorrelation) of it, or the
whole sustain recording (flagged) if no clean period is found.

## Measured results (MAME 0.288, `timeplt`, macOS arm64)

Default low sweep (`--commands 0x00-0x1f`), one ~614 s emulated capture in a few
seconds wall: **30 of 32 commands produced sound; 2 were silent (`0x00`, `0x1F`);
muting blocked ~17.8k ROM sound writes; every slot boundary was at the noise
floor** (peak 0, threshold 64), so the muting is proven, not assumed. Twenty
commands are one-shots (the coin `0x01`, the shot `0x07`, enemy launches, awards,
round cues …); ten are sustained/looping (engine and background tunes).

**The high range is silent.** A sweep of `0x80-0xA5` produced **no** sound (muting
still blocked ~21k writes, so the machine was running) — codes `>= 0x80` are
audio-CPU *control* commands, not sound triggers (only the `tm7` disassembly would
decode them; the multi-command `loc_5634` sends them at round-clear/life-loss).
Every audible request code is `< 0x80`. `index.json` has the full per-command table.

## Honest caveats

- **A dirty gap after a *silent* command is a hard failure (exit 1)** — the taps
  leaked. A dirty gap after a *sounding* command is tune bleed — a note
  (`--report-gaps`), not a failure; `--stop-value 0` silences most tunes, so
  widen `--sustain-gap` or pass a real stop command if one bleeds.
- **Clips are reproducible per schedule, not per value in isolation** — the audio
  CPU is stateful, so treat the clips as strong evidence refined by ear and the
  `index.json` numbers, not a final map.
- **Longer tunes are kept whole** when no clean loop period is found (and noted),
  so looping that clip will seam; raise `--sustain-hold` or lower `--loop-corr`.

## What it cannot do

It cannot label what a sound *is* — that is a human judgement from the clips and
the numbers, though Time Pilot's **named request routines** make it easy (the
routine that fires a command names the event; see `games/timeplt/idiomatic/request*`).
It cannot record a command that needs prior state the sweep does not set up, nor
recover a loop point for a tune that never repeats within the window.
