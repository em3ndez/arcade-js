// SPDX-License-Identifier: GPL-3.0-only
/** clearActivePlayerWorkRam — return in a one-player game (PLAY_FLAG holds 1), else fall into the
 * unconditional clear that zeroes the frog object block and the home-bay gate bytes. */
import { PLAY_FLAG } from "./names.js";

const FORCE_CLEAR_WORK_RAM = 0x07eb; // unconditional force-clear (kept as a dispatch)
const FORCE_CLEAR_RET = 0x07f0;      // sentinel fed to that tail's ret so a direct call stays balanced

export function clearActivePlayerWorkRam(m) {
  if (m.mem8[PLAY_FLAG] === 1) return;
  m.push16(FORCE_CLEAR_RET);
  return m.call(FORCE_CLEAR_WORK_RAM);
}
