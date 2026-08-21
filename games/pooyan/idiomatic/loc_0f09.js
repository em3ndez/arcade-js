// SPDX-License-Identifier: GPL-3.0-only
import { sendSoundCommand } from "./sendSoundCommand.js";
/**
 * Emit one preset sound command to the audio CPU.
 *
 * Hands a single fixed command code to the sound sender, which latches it and strobes the
 * sound processor's interrupt. This wrapper only supplies the command code.
 *
 * LIVE-OUT: memory only (the sound-command latch and its interrupt strobe); no register survives.
 */
const SOUND_CMD = 0x0b; // the preset sound-command code this wrapper emits

export function loc_0f09(m) {
  return sendSoundCommand(m, SOUND_CMD);
}
