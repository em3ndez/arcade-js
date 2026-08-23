// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommands95And10 — queue two commands into the command ring: first 0x95, then 0x10.
 * LIVE-OUT: A = the advanced ring cursor left by the second append (callers read it back).
 */
const SOUND_CMD_FIRST = 0x95;
const SOUND_CMD_SECOND = 0x10;

export function queueSoundCommands95And10(m) {
  appendSoundCommandGated(m, SOUND_CMD_FIRST);
  return appendSoundCommandGated(m, SOUND_CMD_SECOND);
}
