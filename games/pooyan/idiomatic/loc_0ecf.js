// SPDX-License-Identifier: GPL-3.0-only
import { loc_0eb3 } from "./loc_0eb3.js";
/**
 * loc_0ecf — enqueue sound command 0 (silence) into the sound-command ring.
 *
 * A thin selector: it names the fixed command byte and hands it to the ring-enqueue helper,
 * which stores it and advances the write pointer.
 *
 * LIVE-OUT: memory only (the filled slot + advanced write pointer); the value is a constant.
 */

const SOUND_CMD_SILENCE = 0x00;

export function loc_0ecf(m) {
  loc_0eb3(m, SOUND_CMD_SILENCE);
}
