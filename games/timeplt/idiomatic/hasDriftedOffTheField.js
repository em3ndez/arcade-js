// SPDX-License-Identifier: GPL-3.0-only
/** hasDriftedOffTheField — answer whether one of an object's two sprite-entry coordinates has arrived in a
 * three-wide band that sits a little short of the wrap, and when it has NOT, hand the question on
 * to the same test taken on the other coordinate. So the answer is an OR of two windows on two
 * axes, and only the first of them is decided here. Nothing is written.
 * LIVE-OUT: the answer, returned and mirrored into carry. */

import { u8, u16 } from "../../../core/int.js";
import { F_C } from "../../../core/cpu/z80.js";
import { hasReachedHorizontalEdgeWindow } from "./hasReachedHorizontalEdgeWindow.js";

const COORDINATE = 0x31;
const BAND = 3;
const STARTS_BELOW_WRAP = 16;

export function hasDriftedOffTheField(m, spriteEntry = m.regs.iy) {
  const { mem8 } = m;
  const coordinate = u8(mem8[u16(spriteEntry + COORDINATE)] + STARTS_BELOW_WRAP);
  if (coordinate >= BAND) return hasReachedHorizontalEdgeWindow(m, spriteEntry);
  return (m.regs.a = coordinate, m.regs.f = F_C, true);
}
