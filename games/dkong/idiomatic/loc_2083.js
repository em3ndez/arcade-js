// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2083 — count the object one step further into this sub-state, running the first two steps'
 * own arms; from the third step on, publish the arm-select byte that puts the object on a
 * one-pixel-per-frame horizontal walk in the direction its ballistic step was going, and hand the
 * record to the shared object-sprite tail.
 *
 * LIVE-OUT: memory, plus pc, SP, the exit register file and the propagated return value — all
 * produced by the continuation.
 */

import { publishBarrelSprite } from "./publishBarrelSprite.js";
import { u8, u16 } from "../../../core/int.js";
import { loc_20a2 } from "./loc_20a2.js";
import { loc_20c3 } from "./loc_20c3.js";

// Record offsets: +2 is the per-slot walk selector (bit 1 walks one pixel right, bit 2 one left),
// +14 this sub-state's step counter, +16 the whole-pixel half of the per-frame step (1 right, 255 left).
const ARM_SELECT = 2;
const SUBSTATE = 14;
const STEP_WHOLE = 16;

const RIGHTWARD_ONE_PIXEL = 1;
const SELECT_WALK_RIGHT = 2;
const SELECT_WALK_LEFT = 4;

export function loc_2083(m, ix = m.regs.ix) {
  const { mem8 } = m;
  const at = (offset) => u16(ix + offset);

  // Read back at byte width, so a record at 255 rolls to 0 and takes the last arm.
  const step = u8(mem8[at(SUBSTATE)] + 1);
  mem8[at(SUBSTATE)] = step;

  if (step === 1) return loc_20a2(m);
  if (step === 2) return loc_20c3(m);

  mem8[at(ARM_SELECT)] =
    mem8[at(STEP_WHOLE)] === RIGHTWARD_ONE_PIXEL ? SELECT_WALK_RIGHT : SELECT_WALK_LEFT;

  return publishBarrelSprite(m);
}
