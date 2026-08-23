// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand12 — queue the page-0x8a text-ring command 0x12.
 *
 * Loads the fixed command byte and tail-calls the ring appender, whose exit becomes this
 * routine's exit.
 *
 * LIVE-OUT: A = the ring cursor the appender leaves (0 when its game-active/play-mode gates are
 * both closed); returned and set through the appender's own return-assignment bridge.
 */

const SOUND_CMD_TEXT = 0x12;

export function queueSoundCommand12(m) {
  return appendSoundCommandGated(m, SOUND_CMD_TEXT); // tail: the A live-out flows from the appender
}
