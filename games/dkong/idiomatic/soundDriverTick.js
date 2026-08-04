// SPDX-License-Identifier: GPL-3.0-only
/**
 * soundDriverTick — push the queued sound state to the audio hardware, once per vblank interrupt.
 *
 * Donkey Kong's audio is driven through a set of WRITE-ONLY latches: game code cannot read them
 * back, so it keeps a shadow copy of each in work RAM and a driver — this routine — re-drives the
 * real hardware from those shadows every frame. It runs in three parts:
 *
 *   1. ENABLE GUARD. Read ATTRACT; if non-zero (no credited game in progress) return immediately —
 *      the driver is silent during attract.
 *   2. EIGHT SOUND TRIGGERS. Walk the eight SND_TRIGGER shadow bytes in lockstep with the eight
 *      bits of the addressable sound latch: a non-zero shadow is a frame countdown — decrement it
 *      and drive its latch bit to 1 (assert the sound); a zero shadow drives its bit to 0
 *      (release). So a shadow byte holds a trigger asserted for N frames.
 *   3. TUNE + IRQ TAIL.
 *      - Tune latch: if SND_PRIORITY_FRAMES is running, tick it down and play the priority tune
 *        SND_PRIORITY; otherwise play the looping background tune SND_BGM.
 *      - IRQ line: if SND_IRQ_TRIGGER is non-zero, tick it down and drive the line to 1 (fire a
 *        queued IRQ tune); otherwise drive it to 0.
 *
 * A LEAF: it calls nothing. The three latch groups are write-only board devices, not work RAM, so
 * they carry the routine's real output alongside the decremented shadows.
 *
 * LIVE-OUT: memory plus device latches — the decremented shadows in work RAM (the eight triggers,
 * the priority frame counter and the IRQ trigger) and the three write-only audio outputs. No live
 * registers or flags: the caller overwrites or restores everything before reading it.
 */

import {
  ATTRACT,
  SND_TRIGGER,
  SND_IRQ_TRIGGER,
  SND_BGM,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
} from "./names.js";

// ---- Hardware output latches (board devices, NOT work RAM) --------------------
const SOUND_TRIGGER_LATCH = 0x7d00; // eight-bit addressable latch, data on bit 0
const SOUND_TUNE_LATCH = 0x7c00; // tune-index latch
const SOUND_IRQ = 0x7d80; // sound-CPU interrupt line

export function soundDriverTick(m) {
  const { mem } = m;

  // 1. Enable guard: silent unless a credited game is in progress.
  if (mem.read8(ATTRACT) !== 0) return;

  // 2. Eight sound triggers: shadow countdown -> latch bit.
  for (let i = 0; i < 8; i++) {
    const shadow = mem.read8(SND_TRIGGER + i);
    let bit;
    if (shadow === 0) {
      bit = 0; // release
    } else {
      mem.write8(SND_TRIGGER + i, (shadow - 1) & 0xff); // tick the countdown
      bit = 1; // assert
    }
    mem.write8(SOUND_TRIGGER_LATCH + i, bit);
  }

  // 3a. Tune latch: priority tune while its frame counter is running, else the
  //     looping background tune.
  const priorityFrames = mem.read8(SND_PRIORITY_FRAMES);
  let tune;
  if (priorityFrames !== 0) {
    mem.write8(SND_PRIORITY_FRAMES, (priorityFrames - 1) & 0xff);
    tune = mem.read8(SND_PRIORITY);
  } else {
    tune = mem.read8(SND_BGM);
  }
  mem.write8(SOUND_TUNE_LATCH, tune);

  // 3b. IRQ line: fire a queued IRQ tune, else release.
  const irqTrigger = mem.read8(SND_IRQ_TRIGGER);
  let irq;
  if (irqTrigger === 0) {
    irq = 0;
  } else {
    mem.write8(SND_IRQ_TRIGGER, (irqTrigger - 1) & 0xff);
    irq = 1;
  }
  mem.write8(SOUND_IRQ, irq);
}
