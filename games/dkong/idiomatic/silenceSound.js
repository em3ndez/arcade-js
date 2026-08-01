// SPDX-License-Identifier: GPL-3.0-only
/**
 * silenceSound — zero every sound output and its work-RAM shadow.  ROM 0x011c.
 *
 * The sound hardware is a set of write-only latches, so the ROM cannot read back
 * what it last wrote; it keeps a readable shadow of the trigger latches in work
 * RAM instead. To silence everything at once this routine writes 0 to all of it:
 *
 *   - the eight ls259.6h sound-trigger latch bits (0x7D00-0x7D07, one address per
 *     bit) and their work-RAM shadow SND_TRIGGER[0..7] (0x6080-0x6087), cleared as
 *     a pair per index;
 *   - the four-byte sound-control block SND_IRQ_TRIGGER / SND_BGM / SND_PRIORITY /
 *     SND_PRIORITY_FRAMES (0x6088-0x608B), work RAM only — no hardware side;
 *   - the audio-CPU IRQ line (0x7D80) and the ls175.3d sound latch (0x7C00).
 *
 * It reads nothing and takes no arguments: A is zeroed internally and every store
 * writes that 0, so its effect is a constant regardless of prior machine state.
 * A LEAF — calls nothing. Reached at boot (bootInit calls it at ROM 0x02B5 with
 * the vblank NMI still masked) and on the reset / game-over / new-life transitions
 * (loc_12f2, loc_197a, sub_1708, loc_17b6, sub_017b, loc_1344, loc_0986, loc_0bda).
 *
 * Of these writes, only the work-RAM span 0x6080-0x608B lands in the diffed state
 * dump; the hardware latches are write-only board outputs (io side, not RAM), so
 * they never appear there but are issued faithfully so the shipped game is silent.
 *
 * Memory-equivalent to the frozen oracle — equivalence-011c.test.js.
 * GATE:     crafted-entry — input-independent, straight-line (no data-dependent
 *           branch, so no unreached arms); validated on real captured dispatches
 *           (fresh clone per case, it writes RAM) PLUS crafted pre-dirtied entries
 *           that prove it clears any prior contents. Reached from boot.
 * LIVE-OUT: memory-only — callers (bootInit, loc_12f2, …) reload their own A / HL /
 *           DE / BC before use and consume no register or flag this leaves; the
 *           oracle's terminal `ret` (an SP+2 pop) is the modelled stack ABI the
 *           direct-call layer replaces with a JS return, so SP is not live either.
 * NAMES:    SND_TRIGGER[8], SND_IRQ_TRIGGER, SND_BGM, SND_PRIORITY,
 *           SND_PRIORITY_FRAMES (ram.js). The three hardware latch addresses are
 *           board control outputs, not work RAM, so they stay local hex constants.
 */

import {
  SND_TRIGGER,
  SND_IRQ_TRIGGER,
  SND_BGM,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
} from "./ram.js";

// ---- Hardware sound latches (board control outputs, NOT work RAM) -----------
// ls259.6h addressable latch — one address per bit at 0x7D00-0x7D07 (data on bit
// 0); the eight per-effect sound triggers, mirrored in SND_TRIGGER because the
// latch is write-only from the Z80 side.
const SOUND_LATCH_6H = 0x7d00;
// The audio-CPU interrupt line (writeAudioIrq): pulsing it interrupts the sound CPU.
const AUDIO_IRQ = 0x7d80;
// ls175.3d sound latch (writeSoundLatch3d): the tune/effect byte handed to the sound CPU.
const SOUND_LATCH_3D = 0x7c00;

export function silenceSound(m) {
  const { mem } = m;

  // Clear the eight ls259.6h latch bits and their work-RAM shadow together.
  for (let i = 0; i < 8; i++) {
    mem.write8(SOUND_LATCH_6H + i, 0); // hardware latch bit (write-only)
    mem.write8(SND_TRIGGER + i, 0); //   its shadow, SND_TRIGGER[i]
  }

  // The sound-control block — work RAM only, no hardware side.
  mem.write8(SND_IRQ_TRIGGER, 0); //     0x6088
  mem.write8(SND_BGM, 0); //              0x6089
  mem.write8(SND_PRIORITY, 0); //         0x608A
  mem.write8(SND_PRIORITY_FRAMES, 0); //  0x608B

  // The two remaining hardware sound outputs.
  mem.write8(AUDIO_IRQ, 0); //      0x7D80 — audio-CPU IRQ line off
  mem.write8(SOUND_LATCH_3D, 0); // 0x7C00 — ls175.3d latch cleared
}
