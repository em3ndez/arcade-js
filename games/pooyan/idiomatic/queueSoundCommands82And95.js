// SPDX-License-Identifier: GPL-3.0-only
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommands82And95 — enqueue two fixed command bytes (0x82 then 0x95) into the sound-command ring
 * buffer via the enqueue helper; the second is a tail call.
 *
 * LIVE-OUT: memory only — the two filled ring slots and the advanced write pointer. The helper
 * leaves the advanced pointer in A, but every enqueue site reloads A, so no register survives.
 */

const CMD_FIRST = 0x82;
const CMD_SECOND = 0x95;

export function queueSoundCommands82And95(m) {
  enqueueSoundCommandRing(m, CMD_FIRST);
  enqueueSoundCommandRing(m, CMD_SECOND);
}
