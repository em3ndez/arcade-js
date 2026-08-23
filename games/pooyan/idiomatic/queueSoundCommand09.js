// SPDX-License-Identifier: GPL-3.0-only
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommand09 — enqueue sound command 9 into the sound-command ring.
 *
 * A thin selector: it names the fixed command byte and hands it to the ring-enqueue helper,
 * which stores it and advances the write pointer.
 *
 * LIVE-OUT: memory only (the filled slot + advanced write pointer); the value is a constant.
 */

const SOUND_CMD_NINE = 0x09;

export function queueSoundCommand09(m) {
  enqueueSoundCommandRing(m, SOUND_CMD_NINE);
}
