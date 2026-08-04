// SPDX-License-Identifier: GPL-3.0-only
/**
 * silenceSound — zero every sound output and its work-RAM shadow.
 *
 * The sound hardware is a set of write-only latches, so the program cannot read back
 * what it last wrote; it keeps a readable shadow of the trigger latches in work RAM
 * instead. To silence everything at once this routine writes 0 to all of it:
 *
 *   - the eight ls259.6h sound-trigger latch bits (one address per bit) and their
 *     work-RAM shadow SND_TRIGGER[0..7], cleared as a pair per index;
 *   - the four-byte sound-control block SND_IRQ_TRIGGER / SND_BGM / SND_PRIORITY /
 *     SND_PRIORITY_FRAMES, work RAM only — no hardware side;
 *   - the audio-CPU IRQ line and the ls175.3d sound latch.
 *
 * It reads nothing and takes no arguments: every store writes a zero the routine
 * produces itself, so its effect is a constant regardless of prior machine state.
 * A LEAF — calls nothing. Reached at boot, with the vblank NMI still masked, and on
 * the reset / game-over / new-life transitions.
 *
 * Only the work-RAM block is readable state afterwards; the hardware latches are
 * write-only board outputs, so nothing can read them back — but they are issued
 * faithfully, which is what makes the shipped game actually go silent.
 *
 * LIVE-OUT: memory-only. Callers reload their own registers before use and consume
 * nothing this routine leaves behind.
 */

import {
  SND_TRIGGER,
  SND_IRQ_TRIGGER,
  SND_BGM,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
} from "./names.js";

// ---- Hardware sound latches (board control outputs, NOT work RAM) -----------
// ls259.6h addressable latch — one address per bit (data on bit 0); the eight
// per-effect sound triggers, mirrored in SND_TRIGGER because the latch is
// write-only from the CPU side.
const SOUND_LATCH_6H = 0x7d00;
// The audio-CPU interrupt line: pulsing it interrupts the sound CPU.
const AUDIO_IRQ = 0x7d80;
// ls175.3d sound latch: the tune/effect byte handed to the sound CPU.
const SOUND_LATCH_3D = 0x7c00;

export function silenceSound(m) {
  const { mem } = m;

  // Clear the eight ls259.6h latch bits and their work-RAM shadow together.
  for (let i = 0; i < 8; i++) {
    mem.write8(SOUND_LATCH_6H + i, 0); // hardware latch bit (write-only)
    mem.write8(SND_TRIGGER + i, 0); //   its shadow, SND_TRIGGER[i]
  }

  // The sound-control block — work RAM only, no hardware side.
  mem.write8(SND_IRQ_TRIGGER, 0);
  mem.write8(SND_BGM, 0);
  mem.write8(SND_PRIORITY, 0);
  mem.write8(SND_PRIORITY_FRAMES, 0);

  // The two remaining hardware sound outputs.
  mem.write8(AUDIO_IRQ, 0); //      audio-CPU IRQ line off
  mem.write8(SOUND_LATCH_3D, 0); // ls175.3d latch cleared
}
