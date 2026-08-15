// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSoundQueue — reset the sound-command queue at game start by zeroing its
 * 48-byte region: the pending-command count and the command slots above it.
 * LIVE-OUT: memory only.
 */
import { loc_8300 } from "./names.js";

export function clearSoundQueue(m) {
  const { mem8 } = m;
  for (let i = 0; i < 48; i++) mem8[(loc_8300 + i) & 0xffff] = 0;
}
