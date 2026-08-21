// SPDX-License-Identifier: GPL-3.0-only
import { loc_0eb3 } from "./loc_0eb3.js";
/**
 * loc_0f6c — enqueue two sound commands, 0x19 then 0x15, into the sound-command ring.
 *
 * Each command is handed in turn to the ring enqueuer, which stores it and advances the
 * write pointer (wrapping the last slot to the first).
 *
 * LIVE-OUT: memory only — the two filled ring slots and the advanced write pointer. The
 * enqueuer leaves A clobbered but every enqueue site reloads A, so A is not a consumed output.
 */

const SOUND_CMD_FIRST = 0x19;
const SOUND_CMD_SECOND = 0x15;

export function loc_0f6c(m) {
  loc_0eb3(m, SOUND_CMD_FIRST);
  loc_0eb3(m, SOUND_CMD_SECOND);
}
