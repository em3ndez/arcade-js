// SPDX-License-Identifier: GPL-3.0-only
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommands82And03 — queue two fixed sound commands into the sound-command ring.
 *
 * Enqueues command 0x82 then command 0x03 through the ring-enqueue helper; the second enqueue is
 * the routine's tail, so the helper's exit is this routine's exit.
 *
 * LIVE-OUT: memory only (the two filled ring slots + the advanced write pointer); callers reload
 * A after the call, as the enqueue helper's own contract does.
 */

const SOUND_CMD_FIRST = 0x82;
const SOUND_CMD_SECOND = 0x03;

export function queueSoundCommands82And03(m) {
  enqueueSoundCommandRing(m, SOUND_CMD_FIRST);
  enqueueSoundCommandRing(m, SOUND_CMD_SECOND);
}
