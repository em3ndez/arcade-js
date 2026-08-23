// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand0D — append a fixed command byte to the page-0x8a command ring.
 *
 * Loads the one byte this entry point stands for and hands it to the ring-append helper,
 * which gates on game-active / play-mode before writing.
 *
 * LIVE-OUT: A = the helper's advanced ring cursor (0 on the gates-closed path), forwarded
 * via return-assignment. The helper leaves A unrestored and callers read it back.
 */
const RING_COMMAND = 0x0d;

export function queueSoundCommand0D(m) {
  return appendSoundCommandGated(m, RING_COMMAND);
}
