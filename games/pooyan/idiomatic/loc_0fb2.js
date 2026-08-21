// SPDX-License-Identifier: GPL-3.0-only
import { loc_0eb3 } from "./loc_0eb3.js";
/**
 * loc_0fb2 — enqueue two fixed sound commands, in order, into the sound-command ring.
 *
 * LIVE-OUT: none (memory only — two filled ring slots and the advanced write pointer). The
 * enqueue helper leaves the ring pointer in A, which enqueue sites reload, so A is not a result.
 */

const SOUND_CMD_FIRST = 0x27;
const SOUND_CMD_SECOND = 0x15;

export function loc_0fb2(m) {
  loc_0eb3(m, SOUND_CMD_FIRST);
  loc_0eb3(m, SOUND_CMD_SECOND);
}
