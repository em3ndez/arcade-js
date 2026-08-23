// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand0F — append the fixed command byte into the page-0x8a sound-command ring: hand a preset byte to the
 * ring-append helper, which stashes it and (while a game is active or the play-mode latch is set)
 * writes it at the ring cursor and steps the cursor.
 *
 * LIVE-OUT: A = the advanced ring cursor the append leaves (0 when both gates are shut), read back by
 * a register-dispatched caller since the AF pair is not restored across the hand-off.
 */
const RING_BYTE = 0x0f; // the fixed byte this wrapper appends

export function queueSoundCommand0F(m) {
  return appendSoundCommandGated(m, RING_BYTE);
}
