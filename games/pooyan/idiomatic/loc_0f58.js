// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
import { loc_0eb3 } from "./loc_0eb3.js";
/**
 * loc_0f58 — queue four fixed commands in order: two text-ring appends (bytes 0x96 then
 * 0x97) followed by two sound-ring enqueues (bytes 0x18 then 0x15). Straight-line, no
 * branches; every byte is a constant.
 *
 * LIVE-OUT: memory only — the two ring writers' slot writes and advanced pointers. A is
 * not a consumed result here: the final enqueue leaves its ring pointer in A and enqueue
 * sites reload A, so no caller reads it back.
 */

const TEXT_BYTE_A = 0x96;
const TEXT_BYTE_B = 0x97;
const SOUND_BYTE_A = 0x18;
const SOUND_BYTE_B = 0x15;

export function loc_0f58(m) {
  loc_0ea2(m, TEXT_BYTE_A);
  loc_0ea2(m, TEXT_BYTE_B);
  loc_0eb3(m, SOUND_BYTE_A);
  loc_0eb3(m, SOUND_BYTE_B);
}
