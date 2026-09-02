// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { readActivePlayerPageTopByte } from "./readActivePlayerPageTopByte.js";
import { drawReserveLifeIcons } from "./drawReserveLifeIcons.js";
import { drawLivesDigit } from "./drawLivesDigit.js";

// When ships remain, stash the reserve count in the page cell, paint the reserve-ship row, then plot the lives digit.
export function loc_1a7f(m) {
  const [hl, a] = readActivePlayerPageTopByte(m);
  if (a === 0) return;
  const reserve = u8(a - 1);
  m.mem8[hl] = reserve;
  drawReserveLifeIcons(m, reserve, reserve === 0);
  return drawLivesDigit(m, a);
}
