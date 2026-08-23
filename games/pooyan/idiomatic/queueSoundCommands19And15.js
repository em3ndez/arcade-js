// SPDX-License-Identifier: GPL-3.0-only
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommands19And15 — enqueue two sound commands, 0x19 then 0x15, into the sound-command ring.
 *
 * Each command is handed in turn to the ring enqueuer, which stores it and advances the
 * write pointer (wrapping the last slot to the first).
 *
 * LIVE-OUT: memory only — the two filled ring slots and the advanced write pointer. The
 * enqueuer leaves A clobbered but every enqueue site reloads A, so A is not a consumed output.
 */

const SOUND_CMD_FIRST = 0x19;
const SOUND_CMD_SECOND = 0x15;

export function queueSoundCommands19And15(m) {
  enqueueSoundCommandRing(m, SOUND_CMD_FIRST);
  enqueueSoundCommandRing(m, SOUND_CMD_SECOND);
}
