// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22cb — entry point of object-velocity setup: seed one object record's two velocity
 * fields, choosing the source by mode then difficulty, and defer to one of four arms.
 * A clear mode latch picks magnitude from the level; otherwise difficulty 1..5 selects,
 * sharpening from random toward player-aimed.
 *
 * LIVE-OUT: memory-only — the record's two velocity fields, written by the dispatched arm.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";
import {
  BARREL_DIFFICULTY_LATCH,
  DIFFICULTY,
} from "./names.js";
import { loc_22e1 } from "./loc_22e1.js";
import { loc_22f6 } from "./loc_22f6.js";
import { loc_2303 } from "./loc_2303.js";
import { loc_231a } from "./loc_231a.js";

// Multiplexed cell: another reader takes it as a spawn/movement gate, so it is named only
// for its role here.

export function loc_22cb(m, objRecord = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[BARREL_DIFFICULTY_LATCH] === 0) {
    return loc_22e1(m, objRecord);
  }

  const difficulty = mem8[DIFFICULTY];
  switch (difficulty) {
    case 1:
    case 2:
      return loc_22f6(m, objRecord);
    case 3:
    case 4:
      return loc_2303(m);
    case 5:
      return loc_231a(m);
    default:
      throw new NotImplemented(
        `loc_22cb: object-velocity dispatch on unexpected difficulty ${difficulty}`,
      );
  }
}
