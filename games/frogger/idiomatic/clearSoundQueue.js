// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSoundQueue — reset the sound-command queue at game start by zeroing its
 * 48-byte region: the pending-command count and the command slots above it.
 * LIVE-OUT: memory only.
 */
import { SOUND_QUEUE_COUNT } from "./names.js";

export function clearSoundQueue(m) {
  const { mem8 } = m;
  for (let i = 0; i < 48; i++) mem8[(SOUND_QUEUE_COUNT + i) & 0xffff] = 0;
}
