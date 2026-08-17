// SPDX-License-Identifier: GPL-3.0-only
/**
 * dequeueSoundCommand — drain one queued sound command: when the pending count is non-zero, decrement it,
 * issue the front command to the sound chip, then shift the remaining queue down one slot.
 * LIVE-OUT: memory (the count and the shifted queue) plus the sound-chip ports the issuer pulses.
 */
import { SOUND_QUEUE_COUNT } from "./names.js";
import { issueSoundCommand } from "./issueSoundCommand.js";

export function dequeueSoundCommand(m) {
  const { mem8 } = m;

  const pending = mem8[SOUND_QUEUE_COUNT];
  if (pending === 0) return;

  mem8[SOUND_QUEUE_COUNT] = pending - 1;
  issueSoundCommand(m, mem8[SOUND_QUEUE_COUNT + 1]);

  for (let i = 0; i < pending; i++) {
    mem8[(SOUND_QUEUE_COUNT + 1 + i)] = mem8[(SOUND_QUEUE_COUNT + 2 + i)];
  }
}
