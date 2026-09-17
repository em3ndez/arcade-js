// SPDX-License-Identifier: GPL-3.0-only
/**
 * settleFireOnGirderSlope — on the girder board only, settle a fire's height onto the slope
 * of the girder it stands on by advancing its stepped coordinate a single girder step. A tail
 * the walk and turn paths fall into; the record pointer arrives in a register.
 *
 * LIVE-OUT: memory only — the single stored coordinate.
 */

import { BOARD, OBJ_STATE } from "./names.js";
import { snapYToGirder } from "./snapYToGirder.js";

const OBJ_COMPANION_COORD = 0x0e;
const OBJ_STEPPED_COORD = 0x0f;

const BOARD_GIRDER = 0x01;

export function settleFireOnGirderSlope(m, ix = m.regs.ix) {
  const { regs, mem8 } = m;

  if (mem8[BOARD] !== BOARD_GIRDER) return;

  const objBase = ix;

  const companion = mem8[(objBase + OBJ_COMPANION_COORD) & 0xffff];
  const coord = mem8[(objBase + OBJ_STEPPED_COORD) & 0xffff];
  const state = mem8[(objBase + OBJ_STATE) & 0xffff];

  mem8[(objBase + OBJ_STEPPED_COORD) & 0xffff] = snapYToGirder(companion, coord, state);
}
