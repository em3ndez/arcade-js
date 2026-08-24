// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueFixedSoundCommandRun — enqueue a fixed run of four sound-command bytes 0x29,0x15,0x16,0x17 into the sound-command ring.
 *
 * Each byte is handed to the gated sound-command append (which reads A); the final append is a tail
 * call whose ret returns to our caller.
 *
 * LIVE-OUT: memory only — the bytes appended to the sound-command ring.
 */
const SOUND_CMDS = [0x29, 0x15, 0x16, 0x17]; // sound-command bytes appended in order

export function queueFixedSoundCommandRun(m) {
  appendSoundCommandGated(m, SOUND_CMDS[0]); // one command byte at a time
  appendSoundCommandGated(m, SOUND_CMDS[1]);
  appendSoundCommandGated(m, SOUND_CMDS[2]);
  return appendSoundCommandGated(m, SOUND_CMDS[3]); // tail append
}
