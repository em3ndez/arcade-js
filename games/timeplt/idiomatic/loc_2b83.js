// SPDX-License-Identifier: GPL-3.0-only
/** loc_2b83 — true once an actor's screen position lands on a retire line.
 * One line per axis; a hit is the line or either neighbouring pixel, three values wide, which
 * lets a coordinate moving up to three pixels a frame land ON the line rather than step over
 * it. Both coordinates wrap at 256, so the window is a wrapped distance, not a range.
 * LIVE-OUT: the boolean, mirrored into carry; memory and every other register untouched.
 */

import { u8, u16 } from "../../../core/int.js";
import { F_C } from "../../../core/cpu/z80.js";

const SCREEN_ROW_CELL = 49;
const RETIRE_COLUMN = 4;
const RETIRE_ROW = 248;

const atLine = (coord, line) => u8(coord - line + 1) < 3;

export function loc_2b83(m) {
  const { mem8, regs } = m;
  const columnCell = regs.iy;
  const reached =
    atLine(mem8[u16(columnCell + SCREEN_ROW_CELL)], RETIRE_ROW) ||
    atLine(mem8[columnCell], RETIRE_COLUMN);
  regs.f = (regs.f & ~F_C) | (reached ? F_C : 0);
  return reached;
}
