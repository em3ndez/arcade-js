// SPDX-License-Identifier: GPL-3.0-only
/** layOutEnemyAimPointsFromScrollAngle — when the mode byte in C selects sub-mode 7, lay a sprite object's twelve coordinate
 * fields (0x10-0x1b) out as six XY pairs around centre (0x78 across, 0x84 down): the scroll angle
 * turned a quarter and the scroll angle itself, each drawn through the velocity table at an x8 and an
 * x16 radius, the quarter-turned direction also mirrored to its negatives; every other sub-mode
 * returns without a write. LIVE-OUT: fields 0x10-0x1b of that object; no return value. */

import { loc_59d1 } from "./loc_59d1.js";
import { u8, u16 } from "../../../core/int.js";

const SUBMODE_MASK = 0x0f;
const SUBMODE = 0x07;
const OBJECT = 0xac64;
const SCROLL_ANGLE = 0xa802;
const QUARTER_TURN = 0x40;
const ACROSS = 0x78;
const DOWN = 0x84;

/** Store term's high byte at the x8 and x16 radii, offset from centre; MIRROR also seats the
 *  negatives (centre - h, a neg-then-add) four fields along from each. */
function plot(m, term, centre, off8, off16, mirror) {
  const { regs, mem8 } = m;
  regs.hl = u16(term << 3);
  regs.a = u8(regs.h + centre); mem8[u16(regs.ix + off8)] = regs.a;
  if (mirror) { regs.a = u8(centre - regs.h); mem8[u16(regs.ix + off8 + 4)] = regs.a; }
  regs.hl = u16(regs.hl << 1);
  regs.a = u8(regs.h + centre); mem8[u16(regs.ix + off16)] = regs.a;
  if (mirror) { regs.a = u8(centre - regs.h); mem8[u16(regs.ix + off16 + 4)] = regs.a; }
}

export function layOutEnemyAimPointsFromScrollAngle(m) {
  const { regs, mem8 } = m;
  if ((regs.c & SUBMODE_MASK) !== SUBMODE) return;
  regs.ix = OBJECT;

  regs.a = u8(mem8[SCROLL_ANGLE] + QUARTER_TURN);
  loc_59d1(m);
  plot(m, regs.de, ACROSS, 0x10, 0x12, true);
  plot(m, regs.bc, DOWN, 0x11, 0x13, true);

  regs.a = mem8[SCROLL_ANGLE];
  loc_59d1(m);
  plot(m, regs.de, ACROSS, 0x18, 0x1a, false);
  plot(m, regs.bc, DOWN, 0x19, 0x1b, false);
}
