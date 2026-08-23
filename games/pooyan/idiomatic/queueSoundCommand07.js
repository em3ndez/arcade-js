// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand07 — append the fixed byte into the sound-command ring.
 *
 * Loads the constant append value and hands it to the ring appender, which stashes it, appends
 * it only while a game is active or the play-mode latch is set, and advances the ring cursor.
 *
 * LIVE-OUT: A = the advanced ring cursor (0 on the gates-closed path). The appender sets it via
 * its own return-assignment and this tail hands that straight back for a caller that reads it.
 */
const SOUND_CMD = 0x07;

export function queueSoundCommand07(m) {
  return appendSoundCommandGated(m, SOUND_CMD);
}
