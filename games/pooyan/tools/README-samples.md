<!-- SPDX-License-Identifier: GPL-3.0-only -->
# `record_samples.py` — record Pooyan's sounds from your own ROM

`games/pooyan/tools/record_samples.py` boots Pooyan under MAME, sweeps its
sound-command byte, and records what each command actually produces into local
per-command WAV clips. It is the same tool, and the same posture, as Time Pilot's,
The Pit's and Donkey Kong's `record_samples.py`. Because **Pooyan and Time Pilot
share the exact same Konami audio device** (`TIMEPLT_AUDIO`), this recorder is
adapted from Time Pilot's — the trigger mechanism is identical — with Pooyan's own
sound addresses.

arcade-js does **not** emulate Pooyan's audio subsystem (the second Z80
`tpsound`, its program ROM, or the two AY-3-8910 PSGs). It plays audio *above* the
emulation: the board watches the game's writes to the sound latch and a sample
player plays the clip recorded for that command. This tool produces those clips.

## The copyright position

Pooyan's audio is the ROM authors' copyrighted work, exactly like its sprites and
program ROM. **arcade-js ships none of it.** The repository contains the *tooling*;
you supply the *content*, same as the bring-your-own-ROM design for
`games/pooyan/rom/`. This script drives the MAME you installed against the romset
you own, on your own machine, and writes the result to a **gitignored** directory —
`games/pooyan/audio/samples/`, matched by `.gitignore`'s `games/*/audio/samples/`.
Nothing copyrighted enters the repository. **Do not commit or redistribute anything
it produces.**

## Pooyan's sound hardware

From MAME `src/mame/konami/pooyan.cpp` and the shared
`src/mame/shared/timeplt_a.cpp` (game `pooyan`, device `TIMEPLT_AUDIO`).
Delivering a command takes **two** addresses, not one — the important difference
from The Pit, and the same shape as Time Pilot:

- The main CPU writes the **command byte to `0xA100`** (`timeplt_audio`
  `sound_data_w`, `pooyan.cpp:306`). That write does **not** by itself wake the
  audio CPU.
- The main CPU then **pulses an attention line, LS259 "mainlatch" bit 1 at
  `0xA181`**: `D0=1` then `D0=0`. That bit's `q_out` drives `timeplt_audio`
  `sh_irqtrigger_w` (`pooyan.cpp:307,429`), and its **low→high edge** asserts the
  sound Z80's IRQ (`timeplt_a.cpp:133`, `if (m_last_irq_state == 0 && state)`); the
  handler reads the latch back and acts on the command. The trailing `0` re-arms
  the edge for the next command.
- A **second Z80** (`tpsound`, region `timeplt_audio:tpsound`) sequences two
  **AY-3-8910** PSGs through RC low-pass filters, summed to one `mono` speaker.

So a command is delivered by **three ordered writes** — `0xA100=command`,
`0xA181=1`, `0xA181=0` — and the order matters: the command must be in the latch
*before* the edge, because the edge is what makes the audio CPU read it. This is
exactly what the ROM's own sound-send routine does, and what this tool reproduces
from the main CPU's program space.

**Why not tap the whole LS259.** `0xA181` sits in the `0xA180-0xA187` mainlatch
bank (`pooyan.cpp:307,427-434`) that also carries NMI-enable (bit 0), the
amplifier mute (bit 2), the two coin counters (bits 3/4) and flip-screen (bit 7).
Tapping the whole bank would break the machine, so the tool taps the single byte
`0xA181`, never the range.

## Usage

```sh
# default sweep: commands 0x00-0x1f (where Konami's small sound codes live),
# pulse + sustain pass each, -> games/pooyan/audio/samples/
games/pooyan/tools/record_samples.py --rompath games/pooyan/rom

# see the plan and the exact MAME command line without running anything
games/pooyan/tools/record_samples.py --rompath games/pooyan/rom --dry-run

# prove the capture is clean: residual level at every slot boundary
games/pooyan/tools/record_samples.py --rompath games/pooyan/rom --report-gaps
```

`--rompath` is a MAME rompath holding your `pooyan` romset (it defaults to
`games/pooyan/rom`, where the repo's other pooyan tools look). The tool needs
`mame` on `PATH` (override with `--mame`) and Python 3; it uses `numpy` if present
(it is, in this repo) and falls back to the stdlib otherwise. Or run it through the
Makefile: `make samples GAME=pooyan ROMPATH=games/pooyan/rom`.

### How it runs

1. Boots `pooyan` headless under the project's determinism flags — the same
   `mame_golden.build_mame_argv` the pixel-golden captures use (fresh nvram/cfg,
   `-nocheat`, `-noautosave`, `-frameskip 0`, `-nothrottle`, `-video none`,
   `-sound none`) — plus `-wavwrite`. The romset MAME loads comes from the board's
   `hardware.json` `"driver"` (`pooyan`), so the shared harness stays
   game-agnostic. `-sound none` drops only the live host audio device; MAME still
   synthesises the emulated audio, and `-wavwrite` captures it.
2. A generated `-autoboot_script` installs **write taps on `0xA100` and `0xA181`**
   that replace every program-originated write with the value the tool is
   currently holding (`0`), so the ROM can neither load a command nor pulse the
   attention line during the sweep. **Only those two single bytes are tapped** —
   `0xA181` sits in the `0xA180-0xA187` LS259 bank that also carries NMI-enable,
   the amplifier mute, flip-screen and the coin counters, and tapping the whole
   bank would break the machine.
3. For each swept command *V* it schedules **two passes**, each triggering *V*
   with the three-write sequence, then re-issuing a `--stop-value` trigger later.
   The Lua logs the real emulated time of every slot.
4. The one `-wavwrite` recording is split back into one clip per command by those
   measured timestamps, DC-corrected, trimmed, and reported.

### Output format

Clips land in `games/pooyan/audio/samples/` (created; gitignored):

- **`cmd_<decimal>.wav`** — one clip per sounding command, named in **decimal**:
  e.g. `cmd_7.wav`. Mono, 16-bit, at `--samplerate` (48 kHz default). Silent
  commands write no file.
- **`index.json`** — the full machine-readable report: per-command `peak`, `rms`,
  `silent`, `sustained`, `loop`, `loop_period_s`, the two sound addresses
  (`sound_latch` `0xA100`, `audio_attention` `0xA181`), the exact MAME argv, the
  sweep parameters, and the count of ROM sound writes the muting blocked. This is
  the **evidence**, not a hand-authored sound map. The web player reads it to know
  which clip to play for each command, and whether it loops.

### One-shot vs sustained — different from The Pit

Pooyan's **stop** (command `0` plus the attention edge) *interrupts* whatever is
playing — unlike The Pit's latched `0`, which a one-shot ignores. So the **pulse**
pass (stop after `--hold`, 0.1 s) truncates *every* command and its length carries
no information; it is kept only as an amplitude probe. The **sustain** pass (stop
after `--sustain-hold`, 10 s) is the classifier: a one-shot has decayed to silence
before that late stop, while a **looping tune is still sounding** when it hits.
Still-sounding-at-the-late-stop ⇒ `sustained`, and the clip written is one **loop
period** (normalised autocorrelation) of it, or the whole sustain recording
(flagged) if no clean period is found.

## The music beds (`--background`)

The per-command sweep records each sound code **in isolation**. But Pooyan's
**melody** is not any one code: the un-emulated audio Z80 sequences it
**continuously**, and the main CPU only **selects** it with control codes that are
silent on their own (the framed music *runs* — a lead byte followed by the trailer
`0x15,0x16,0x17`). The clip model, which plays one recorded sample per latch write,
therefore cannot carry it. The port ships a **multi-context stem jukebox**: three
looping **beds**, one per music-select code, that the web player mixes in under the
effects. `--background` regenerates all three from your ROM:

```sh
# regenerate the three beds into games/pooyan/audio/samples/ from YOUR ROM
games/pooyan/tools/record_samples.py --background --rompath games/pooyan/rom
# or through the Makefile
make samples GAME=pooyan ROMPATH=games/pooyan/rom SAMPLEFLAGS=--background
```

**The three beds**, keyed by the music-select code the sound sequencer uses:

| file | code | context | ~length | ~level (AC) |
|------|------|---------|---------|-------------|
| `bed_intro.wav`  | `0x1c` | start-of-game jingle (through-composed cue) | 10.1 s | −32 dBFS |
| `bed_board1.wav` | `0x1a` | board-1 gameplay music (loop) | 26.4 s | −40 dBFS |
| `bed_board2.wav` | `0x1e` | board-2 / round music (loop; `0x1f/0x20/0x21` same family) | 49.6 s | −36 dBFS |

**How they are captured.** ONE isolated-music capture yields all three, split on the
music-select timeline. It plays the gameplay golden tape
(`games/pooyan/tapes/coin_start_play.lua`) for **150 s** — long enough to reach
board-2 music (selected at ~t83 s, running to ~t150 s) — under the *same* determinism
argv as the sweep and the pixel goldens (`mame_golden.build_mame_argv`), with an
effects-mute tap that **suppresses** the sounding effects `0x00-0x14` **and** the
per-kill / "caught" accent pair `0x82`/`0x95` (0x82 fires on every enemy retire —
grounded 1:1 against `STAGE_COUNTDOWN`), letting the framed music runs through so only
the sequenced melody sounds. Each context is cut from its own window (intro t4-15 s,
board-1 t15-83 s, board-2 the body after the loud round-2 fanfare t90-140 s) by the
same method as `games/pooyan/scratchpad/extract_bed.py` (the tool the approved beds
were cut with): dominant-period **normalised autocorrelation**, median-centre the PSG
idle DC, cut one period from a **representative** (full-level) rising zero-crossing —
snapping the end to the lowest-seam rising zero-crossing — then a **~20 ms equal-power
crossfade** at the seam. A through-composed cue like the intro (autocorrelation below
`BED_PERIODIC_CORR`) keeps its whole window instead of one period. Levels are the
**natural** per-context AC levels — deliberately **not** loudness-normalized — so the
beds keep MAME's real relative mix (intro loud, board-1 quiet, board-2 mid).

**Deterministic and self-checking.** MAME's audio is bit-reproducible under the golden
argv and the extraction is a fixed function of the capture, so re-running reproduces
every bed **byte-for-byte** (verified: identical sha256 across runs). The tool prints
each bed's period, correlation, level and seam, then **fails (exit 1)** if a looping
bed's `loop_corr` is below its per-bed floor, if a seam is too large a fraction of
peak for the crossfade to hide, or if a bed comes out (near-)silent. The three wavs
land in the **gitignored** `games/pooyan/audio/samples/` — ROM-derived, copyrighted
audio, **never committed**, exactly like the per-command clips.

**What the player does with them.** `games/pooyan/audio/sounds.js` `backgroundMusic`
selects the bed by the latched **music-select code**: `0x1c → bed_intro`,
`0x1a → bed_board1`, `0x1e` (and the round family `0x1f/0x20/0x21`) `→ bed_board2`.
`stop: [0x00]` is the silence selector, fired at game-over (grounded). `0x82` is **not**
a music trigger and must never be a start value — it is the per-kill accent.

**Honest fidelity limits.** Three beds cover the intro and the first two board types;
**board 3+ tunes are not captured** (they reuse the round-music family but the sequencer
varies them). Pooyan's **tempo speeds up** under time pressure; the efficient clearing
tape never triggers that state, so **no sped-up variant is captured** — the beds are the
steady tempo. Per-life death does not silence the music (only game-over does), and
board-clear cross-selects the next board's tune with no intervening stop.

## DC-offset correction — why the tool needs it

Pooyan's two AY-3-8910s, like every PSG of that family, sit at a large idle DC bias
that **steps between sounds** (The Pit's recorder measured ≈ 2000 16-bit LSB). A
naive mean-removal over a whole slot is dragged toward the loud part and then reads
the constant-DC silent tail as *signal* — which can make a short one-shot look like
a long sustained tune. Each slot segment is therefore centred on its **median** (a
robust idle-level estimate: silence dominates a slot window, or the whole window
*is* one sustained sound), and the written clip is additionally mean-removed so it
carries no DC step to click at the seam.

## Honest caveats

- **A dirty gap after a *silent* command is a hard failure (exit 1)** — the taps
  leaked. A dirty gap after a *sounding* command is tune bleed — a note
  (`--report-gaps`), not a failure; `--stop-value 0` silences most tunes, so widen
  `--sustain-gap` or pass a real stop command if one bleeds.
- **The high range may be control, not sound.** As on Time Pilot, codes `>= 0x80`
  may be audio-CPU *control* commands rather than sound triggers; the default sweep
  is the low range where the audible request codes live. Widen `--commands` to
  probe higher, and read `index.json` — a silent high code is evidence, not a bug.
- **Clips are reproducible per schedule, not per value in isolation** — the audio
  CPU is stateful, so treat the clips as strong evidence refined by ear and the
  `index.json` numbers, not a final map.
- **Longer tunes are kept whole** when no clean loop period is found (and noted),
  so looping that clip will seam; raise `--sustain-hold` or lower `--loop-corr`.
- **Not yet run here.** This adaptation was written and parse-checked without
  running MAME (the romset may be absent). The mechanism is confirmed against the
  MAME source and against the validated Time Pilot recorder that shares the same
  audio device; the first real capture should be sanity-checked with
  `--report-gaps` and by ear.

## What it cannot do

It cannot label what a sound *is* — that is a human judgement from the clips and
the `index.json` numbers. It cannot record a command that needs prior audio-CPU
state the sweep does not set up, nor recover a loop point for a tune that never
repeats within the window.
