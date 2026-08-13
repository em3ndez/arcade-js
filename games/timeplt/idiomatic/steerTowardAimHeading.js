// SPDX-License-Identifier: GPL-3.0-only
/** steerTowardAimHeading — turn an object one step toward the heading it is aiming for.
 * The two headings are points on a 256-step circle, so their difference taken as a wrapped
 * byte says how far round the aim lies: under half a turn away and the short way is forward,
 * otherwise it is back. The size of a step is not the object's own — it is fetched from a
 * fixed table through one global cell, so every object turning this frame turns by the same
 * amount. LIVE-OUT: memory only, one byte, and nothing at all once the aim is reached. */

import { ERA_INDEX, TURN_RATE_BY_ERA_TABLE } from "./names.js";
import { u8, u16 } from "../../../core/int.js";
import { fetchTableByte } from "./fetchTableByte.js";

const AIM_HEADING = 1;
const HEADING = 2;
const HALF_TURN = 128;

/** Close enough to stop turning: the aim at most one step ahead, or two steps behind. */
const arrived = (away) => u8(away + 2) < 4;

export function steerTowardAimHeading(m, object = m.regs.ix) {
  const { mem8 } = m;
  const headingCell = u16(object + HEADING);
  const heading = mem8[headingCell];
  const away = u8(mem8[u16(object + AIM_HEADING)] - heading);
  if (arrived(away)) return;

  const step = turnRate(m, mem8[ERA_INDEX]);
  mem8[headingCell] = away < HALF_TURN ? heading + step : heading - step;
}

/** The table fetch wants its base and its index in the registers it reads them from. */
function turnRate(m, index) {
  m.regs.hl = TURN_RATE_BY_ERA_TABLE;
  m.regs.a = index;
  return fetchTableByte(m);
}
