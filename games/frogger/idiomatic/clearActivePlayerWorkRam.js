// SPDX-License-Identifier: GPL-3.0-only
/** clearActivePlayerWorkRam — return in a one-player game (PLAY_FLAG holds 1), else fall into the
 * unconditional clear that zeroes the frog object block and the home-bay gate bytes. */
import { PLAY_FLAG } from "./names.js";
import { forceClearPlayerWorkRam } from "./forceClearPlayerWorkRam.js";

export function clearActivePlayerWorkRam(m) {
  if (m.mem8[PLAY_FLAG] === 1) return;
  return forceClearPlayerWorkRam(m);
}
