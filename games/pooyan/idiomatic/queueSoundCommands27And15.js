// SPDX-License-Identifier: GPL-3.0-only
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommands27And15 — enqueue two fixed sound commands, in order, into the sound-command ring.
 *
 * LIVE-OUT: none (memory only — two filled ring slots and the advanced write pointer). The
 * enqueue helper leaves the ring pointer in A, which enqueue sites reload, so A is not a result.
 */

const SOUND_CMD_FIRST = 0x27;
const SOUND_CMD_SECOND = 0x15;

export function queueSoundCommands27And15(m) {
  enqueueSoundCommandRing(m, SOUND_CMD_FIRST);
  enqueueSoundCommandRing(m, SOUND_CMD_SECOND);
}
