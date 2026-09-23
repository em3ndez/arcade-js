// SPDX-License-Identifier: GPL-3.0-only
/** layOutEnemyAimPointsFromScrollAngle — when the mode byte in C selects sub-mode 7, lay a sprite object's twelve coordinate
 * fields (0x10-0x1b) out as six XY pairs around centre (0x78 across, 0x84 down): the scroll angle
 * turned a quarter and the scroll angle itself, each drawn through the velocity table at an x8 and an
 * x16 radius, the quarter-turned direction also mirrored to its negatives; every other sub-mode
 * returns without a write. LIVE-OUT: fields 0x10-0x1b of that object; no return value. */

import { loc_59d1 } from "./loc_59d1.js";
import { u8, u16 } from "../../../core/int.js";
import { ENEMY_AIM_ANCHOR_Y, PLAYER_HEADING } from "./names.js";

const SUBMODE_MASK = 0x0f;
const SUBMODE = 0x07;
const QUARTER_TURN = 0x40;
const ACROSS = 0x78;
const DOWN = 0x84;

/** Store term's high byte at the x8 and x16 radii, offset from centre; MIRROR also seats the
 *  negatives (centre - h, a neg-then-add) four fields along from each. */
function plot(m, base, term, centre, off8, off16, mirror) {
  const { mem8 } = m;
  const h8 = u8(u16(term << 3) >> 8);
  mem8[u16(base + off8)] = u8(h8 + centre);
  if (mirror) mem8[u16(base + off8 + 4)] = u8(centre - h8);
  const h16 = u8(u16(u16(term << 3) << 1) >> 8);
  mem8[u16(base + off16)] = u8(h16 + centre);
  if (mirror) mem8[u16(base + off16 + 4)] = u8(centre - h16);
}

export function layOutEnemyAimPointsFromScrollAngle(m, c = m.regs.c) {
  const { regs, mem8 } = m;
  if ((c & SUBMODE_MASK) !== SUBMODE) return;
  const base = (regs.ix = ENEMY_AIM_ANCHOR_Y);

  const [deQuarter, bcQuarter] = loc_59d1(m, u8(mem8[PLAYER_HEADING] + QUARTER_TURN));
  plot(m, base, deQuarter, ACROSS, 0x10, 0x12, true);
  plot(m, base, bcQuarter, DOWN, 0x11, 0x13, true);

  const [deStraight, bcStraight] = loc_59d1(m, mem8[PLAYER_HEADING]);
  plot(m, base, deStraight, ACROSS, 0x18, 0x1a, false);
  plot(m, base, bcStraight, DOWN, 0x19, 0x1b, false);
}
