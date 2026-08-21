// SPDX-License-Identifier: GPL-3.0-only
import { loc_0eb3 } from "./loc_0eb3.js";
/**
 * loc_0ef1 — enqueue a fixed sound-effect command into the sound-command ring.
 *
 * Loads the one command byte this entry point stands for and hands it to the ring
 * enqueue helper.
 *
 * LIVE-OUT: memory only (ring slot + advanced write pointer). The helper leaves an
 * internal pointer in A, but enqueue sites reload A, so it is not a consumed live-out.
 */
const SOUND_COMMAND = 0x05;

export function loc_0ef1(m) {
  return loc_0eb3(m, SOUND_COMMAND);
}
