// SPDX-License-Identifier: GPL-3.0-only
/**
 * soundDriverTick — re-drive the write-only audio latches from their work-RAM shadows once per
 * vblank. Silent during attract. Walks the eight sound-trigger shadows (each a frame countdown)
 * to their latch bits, then drives the tune latch (priority tune while its frame counter runs,
 * else background tune) and the sound-CPU IRQ line.
 *
 * LIVE-OUT: memory plus device latches — the decremented shadows in work RAM and the three
 * write-only audio outputs. No live registers or flags.
 */

import {
  ATTRACT,
  SND_TRIGGER,
  SND_IRQ_TRIGGER,
  SND_BGM,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  SOUND_TRIGGER_LATCH,
  SOUND_TUNE_LATCH,
  SOUND_IRQ,
} from "./names.js";

export function soundDriverTick(m) {
  const { mem8 } = m;

  if (mem8[ATTRACT] !== 0) return;

  for (let i = 0; i < 8; i++) {
    const shadow = mem8[SND_TRIGGER + i];
    let bit;
    if (shadow === 0) {
      bit = 0;
    } else {
      mem8[SND_TRIGGER + i] = (shadow - 1);
      bit = 1;
    }
    mem8[SOUND_TRIGGER_LATCH + i] = bit;
  }

  const priorityFrames = mem8[SND_PRIORITY_FRAMES];
  let tune;
  if (priorityFrames !== 0) {
    mem8[SND_PRIORITY_FRAMES] = (priorityFrames - 1);
    tune = mem8[SND_PRIORITY];
  } else {
    tune = mem8[SND_BGM];
  }
  mem8[SOUND_TUNE_LATCH] = tune;

  const irqTrigger = mem8[SND_IRQ_TRIGGER];
  let irq;
  if (irqTrigger === 0) {
    irq = 0;
  } else {
    mem8[SND_IRQ_TRIGGER] = (irqTrigger - 1);
    irq = 1;
  }
  mem8[SOUND_IRQ] = irq;
}
