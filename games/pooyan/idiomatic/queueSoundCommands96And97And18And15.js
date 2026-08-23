// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommands96And97And18And15 — queue four fixed commands in order: two text-ring appends (bytes 0x96 then
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

export function queueSoundCommands96And97And18And15(m) {
  appendSoundCommandGated(m, TEXT_BYTE_A);
  appendSoundCommandGated(m, TEXT_BYTE_B);
  enqueueSoundCommandRing(m, SOUND_BYTE_A);
  enqueueSoundCommandRing(m, SOUND_BYTE_B);
}
