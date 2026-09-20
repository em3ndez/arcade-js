// SPDX-License-Identifier: GPL-3.0-only
/**
 * silenceSound — zero every sound output and its work-RAM shadow: the eight trigger latch
 * bits and their SND_TRIGGER shadow, the four-byte sound-control block, and the audio-CPU
 * IRQ line. Reached at boot and on the reset / game-over / new-life transitions.
 *
 * LIVE-OUT: memory-only.
 */

import {
  SND_TRIGGER,
  SND_IRQ_TRIGGER,
  SND_BGM,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  SOUND_TRIGGER_LATCH,
  SOUND_IRQ,
  SOUND_TUNE_LATCH,
} from "./names.js";

export function silenceSound(m) {
  const { mem8 } = m;

  for (let i = 0; i < 8; i++) {
    mem8[SOUND_TRIGGER_LATCH + i] = 0;
    mem8[SND_TRIGGER + i] = 0;
  }

  mem8[SND_IRQ_TRIGGER] = 0;
  mem8[SND_BGM] = 0;
  mem8[SND_PRIORITY] = 0;
  mem8[SND_PRIORITY_FRAMES] = 0;

  mem8[SOUND_IRQ] = 0;
  mem8[SOUND_TUNE_LATCH] = 0;
}
