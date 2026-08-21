// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
/**
 * loc_0f21 — queue two commands into the command ring: first 0x95, then 0x10.
 * LIVE-OUT: A = the advanced ring cursor left by the second append (callers read it back).
 */
const SOUND_CMD_FIRST = 0x95;
const SOUND_CMD_SECOND = 0x10;

export function loc_0f21(m) {
  loc_0ea2(m, SOUND_CMD_FIRST);
  return loc_0ea2(m, SOUND_CMD_SECOND);
}
