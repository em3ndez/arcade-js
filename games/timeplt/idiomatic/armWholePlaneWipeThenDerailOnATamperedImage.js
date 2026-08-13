// SPDX-License-Identifier: GPL-3.0-only
/** armWholePlaneWipeThenDerailOnATamperedImage — seat the whole-plane wipe's cursor and line count,
 * then fold a fixed run of the program image into one eight-bit total and hold it against a genuine
 * image's value. A mismatch hands control to a tail that unwinds the interrupt frame one word out of
 * step, returning to a non-address; the wipe is armed either way. LIVE-OUT: memory only. */

import { u8, u16 } from "../../../core/int.js";
import { BLANK_LINES_LEFT, BLANK_LINE_CURSOR, loadDefaultHighScores_ADDR, loc_a400 } from "./names.js";
import { loc_0167 } from "./loc_0167.js";

const WHOLE_PLANE = 0x20;

const CHECKED_BYTES = 0xf0;
const GENUINE_TOTAL = 0x11;

export function armWholePlaneWipeThenDerailOnATamperedImage(m) {
  const { mem8, mem16 } = m;
  mem16[BLANK_LINE_CURSOR] = loc_a400;
  mem8[BLANK_LINES_LEFT] = WHOLE_PLANE;

  let total = 0;
  for (let i = 0; i < CHECKED_BYTES; i++) total = u8(total + mem8[u16(loadDefaultHighScores_ADDR + i)]);
  if (total !== GENUINE_TOTAL) return loc_0167(m);
}
