import { SOUND_ENABLE_LATCH } from "./names.js";
// SPDX-License-Identifier: GPL-3.0-only
/**
 * enableSound — switch the master sound-enable line on (unmute the audio).
 *
 * The audio hardware has a single master enable line: high plays, low silences. This drives it high,
 * the "on" half of a pair sharing the line (its mirror drives it low to mute). Boot and each
 * round/screen setup mute while rebuilding the display, then call this to unmute; it has no inputs.
 */
export function enableSound(m) {
  // Each control-latch address carries one line and takes the low bit, so storing 1 turns sound on.
  m.mem8[SOUND_ENABLE_LATCH] = 1;
}
