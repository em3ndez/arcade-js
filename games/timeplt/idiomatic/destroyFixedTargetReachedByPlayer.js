// SPDX-License-Identifier: GPL-3.0-only
/** destroyFixedTargetReachedByPlayer — destroy one particular pair of things when they have reached each other. Both must
 * still be live, and both coordinates must fall inside a wrapped window around the meeting point,
 * the window along one axis being wider than the other. When all four tests pass, both are marked
 * destroyed, the hit counter one of them had left is zeroed so nothing survives the contact, and
 * the score is posted. Any test failing leaves everything untouched, so this is a whole-or-nothing check
 * rather than a partial one. LIVE-OUT: memory only. */

import { postChainedHitScore } from "./postChainedHitScore.js";
import { u8 } from "../../../core/int.js";
import { HITS_REMAINING, PLAYER_STATE } from "./names.js";

const TARGET_ENTRY = 0xaa10;
const TARGET_FIRST_AXIS = 0;
const TARGET_SECOND_AXIS = 0x31;

const MOVER_FIRST_AXIS = 0xaa28;
const MOVER_SECOND_AXIS = 0xaa59;
const FIRST_AXIS_SLACK = 6;
const FIRST_AXIS_WINDOW = 0x0d;
const SECOND_AXIS_SLACK = 0x18;
const SECOND_AXIS_WINDOW = 0x21;

const TARGET_STATE = 0xa8c0;
const LIVE = 0xff;
const DESTROYED = 0xf0;

export function destroyFixedTargetReachedByPlayer(m) {
  const { mem8 } = m;
  if (mem8[PLAYER_STATE] !== LIVE) return;
  if (mem8[TARGET_STATE] !== LIVE) return;

  const across = u8(mem8[MOVER_FIRST_AXIS] - mem8[TARGET_ENTRY + TARGET_FIRST_AXIS] + FIRST_AXIS_SLACK);
  if (across >= FIRST_AXIS_WINDOW) return;
  const along = u8(mem8[MOVER_SECOND_AXIS] - mem8[TARGET_ENTRY + TARGET_SECOND_AXIS] + SECOND_AXIS_SLACK);
  if (along >= SECOND_AXIS_WINDOW) return;

  mem8[PLAYER_STATE] = DESTROYED;
  mem8[TARGET_STATE] = DESTROYED;
  mem8[HITS_REMAINING] = 0;
  postChainedHitScore(m);
}
