// SPDX-License-Identifier: GPL-3.0-only
/**
 * silenceSound — zero every sound output and its work-RAM shadow. The sound hardware is write-only
 * latches; the program keeps a readable shadow of the trigger latches in work RAM. This writes 0 to
 * the eight ls259.6h trigger latch bits and their SND_TRIGGER shadow, the four-byte sound-control
 * block (work RAM only), and the audio-CPU IRQ line and ls175.3d latch. A leaf reached at boot and
 * on the reset / game-over / new-life transitions.
 *
 * LIVE-OUT: memory-only.
 */

import {
  SND_TRIGGER,
  SND_IRQ_TRIGGER,
  SND_BGM,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
} from "./names.js";

// Hardware sound latches (board control outputs, NOT work RAM).
const SOUND_LATCH_6H = 0x7d00; // ls259.6h addressable latch, one address per bit (data on bit 0)
const AUDIO_IRQ = 0x7d80;
const SOUND_LATCH_3D = 0x7c00;

export function silenceSound(m) {
  const { mem, mem8 } = m;

  // Clear the eight ls259.6h latch bits and their work-RAM shadow together.
  for (let i = 0; i < 8; i++) {
    mem.write8(SOUND_LATCH_6H + i, 0);
    mem8[SND_TRIGGER + i] = 0;
  }

  mem8[SND_IRQ_TRIGGER] = 0;
  mem8[SND_BGM] = 0;
  mem8[SND_PRIORITY] = 0;
  mem8[SND_PRIORITY_FRAMES] = 0;

  mem.write8(AUDIO_IRQ, 0);
  mem.write8(SOUND_LATCH_3D, 0);
}
