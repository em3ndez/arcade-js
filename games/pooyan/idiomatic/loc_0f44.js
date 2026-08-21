// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
/**
 * loc_0f44 — queue command 0x13 into the command ring.
 * LIVE-OUT: A = the advanced ring cursor left by the append (callers read it back).
 */
const SOUND_CMD = 0x13;

export function loc_0f44(m) {
  return loc_0ea2(m, SOUND_CMD);
}
