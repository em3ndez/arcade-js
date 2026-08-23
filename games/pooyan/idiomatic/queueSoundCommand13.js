// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand13 — queue command 0x13 into the command ring.
 * LIVE-OUT: A = the advanced ring cursor left by the append (callers read it back).
 */
const SOUND_CMD = 0x13;

export function queueSoundCommand13(m) {
  return appendSoundCommandGated(m, SOUND_CMD);
}
