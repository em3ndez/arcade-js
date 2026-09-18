import { SOUND_ENABLE_LATCH } from "./names.js";
// SPDX-License-Identifier: GPL-3.0-only
/**
 * disableSound — pull the sound-enable control line low, silencing the audio.
 *
 * The Pit gates its whole audio path behind a single hardware control line (bit 3 of the
 * addressable control latch). This routine drives that line to 0, which mutes sound; its twin
 * drives the same line to 1 to un-mute. Cold boot and round setup both call it, to keep the cabinet
 * quiet while the game state is rebuilt. It reads no memory and returns nothing.
 */
export function disableSound(m) {
  // Drive the sound-enable control line low; only the low bit reaches the latch, so 0 clears it.
  m.mem8[SOUND_ENABLE_LATCH] = 0;
}
