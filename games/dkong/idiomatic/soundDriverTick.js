// SPDX-License-Identifier: GPL-3.0-only
/**
 * soundDriverTick — push the queued sound state to the audio hardware, once per
 * vblank NMI.  ROM 0x00E0.
 *
 * The Z80 side of Donkey Kong's audio is a set of small write-only latches: game
 * code cannot read them back, so it keeps a shadow copy of each in work RAM and a
 * driver — this routine — re-drives the real hardware from those shadows every
 * frame. It runs in three parts:
 *
 *   1. ENABLE GUARD. Read ATTRACT (0x6007); if non-zero (no credited game in
 *      progress) return immediately — the driver is silent during attract. (This
 *      is the `and a / ret nz` gate on the same byte sub_0008/entry_0611 consult.)
 *   2. EIGHT SOUND TRIGGERS. Walk the eight SND_TRIGGER shadow bytes (0x6080-
 *      0x6087) in lockstep with the eight ls259.6h latch bits (0x7D00-0x7D07): a
 *      non-zero shadow is a frame countdown — decrement it and drive its latch bit
 *      to 1 (assert the sound); a zero shadow drives its bit to 0 (release). So a
 *      shadow byte holds a trigger asserted for N frames.
 *   3. TUNE + IRQ TAIL.
 *      - Tune latch (0x7C00, ls175.3d): if SND_PRIORITY_FRAMES (0x608B) is running,
 *        tick it down and play the priority tune SND_PRIORITY (0x608A); otherwise
 *        play the looping background tune SND_BGM (0x6089).
 *      - IRQ line (0x7D80): if SND_IRQ_TRIGGER (0x6088) is non-zero, tick it down
 *        and drive the line to 1 (fire a queued IRQ tune); otherwise drive it 0.
 *
 * A LEAF: it calls nothing. The three latch groups are write-only board devices
 * (io.js), not work RAM, so they carry the routine's real output alongside the
 * decremented shadows in work RAM.
 *
 * Memory-equivalent to the frozen oracle — equivalence-00e0.test.js.
 * GATE:     crafted-entry. Real attract dispatches cover the guard early-return
 *           (attract holds ATTRACT non-zero, so 1493/1494 dispatches take it, plus
 *           one natural all-zero full pass at power-on); ATTRACT=0 crafted entries
 *           drive the loop + tune + IRQ arms attract never reaches with data.
 * LIVE-OUT: memory + device latches — the decremented shadows in work RAM
 *           (SND_TRIGGER[i], SND_PRIORITY_FRAMES, SND_IRQ_TRIGGER) and the three
 *           write-only audio outputs (the eight ls259.6h bits 0x7D00-0x7D07, the
 *           0x7C00 tune latch, the 0x7D80 IRQ line). No live registers/flags/SP/pc:
 *           the sole caller (perFrame, ROM 0x00B5, inside the NMI) overwrites HL/A
 *           and restores B/DE/etc. from the stack before reading any of them, and
 *           the Z80 `ret` becomes the JS return.
 * NAMES:    ATTRACT, SND_TRIGGER[8], SND_PRIORITY_FRAMES, SND_PRIORITY, SND_BGM,
 *           SND_IRQ_TRIGGER (names.js). The three latch bases stay hex — they are
 *           board output devices routed by memory.js/io.js, not work RAM.
 */

import {
  ATTRACT,
  SND_TRIGGER,
  SND_IRQ_TRIGGER,
  SND_BGM,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
} from "./names.js";

// ---- Hardware output latches (board devices, NOT work RAM — see io.js) --------
const SOUND_TRIGGER_LATCH = 0x7d00; // [8] ls259.6h addressable latch, data on bit 0
const SOUND_TUNE_LATCH = 0x7c00; // ls175.3d tune-index latch
const SOUND_IRQ = 0x7d80; // I8035 sound-CPU interrupt line

export function soundDriverTick(m) {
  const { mem } = m;

  // 1. Enable guard: silent unless a credited game is in progress.
  if (mem.read8(ATTRACT) !== 0) return;

  // 2. Eight sound triggers: shadow countdown -> ls259.6h latch bit.
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
