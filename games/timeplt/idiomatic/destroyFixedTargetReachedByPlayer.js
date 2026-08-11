// SPDX-License-Identifier: GPL-3.0-only
/** destroyFixedTargetReachedByPlayer — destroy one particular pair of things when they have reached each other. Both must
 * still be live, and both coordinates must fall inside a wrapped window around the meeting point,
 * the window along one axis being wider than the other. When all four tests pass, both are marked
 * destroyed, the hit counter one of them had left is zeroed so nothing survives the contact, and
 * the score is posted. Any test failing leaves everything untouched, so this is a whole-or-nothing check
 * rather than a partial one. LIVE-OUT: memory only. */

import { postChainedHitScore } from "./postChainedHitScore.js";
import { u8 } from "../../../core/int.js";
import { ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_RECORD_SLOT0, ERA_OBJECT_SPRITE_Y_SLOT0, HITS_REMAINING, PLAYER_ENTRY, PLAYER_STATE } from "./names.js";

const TARGET_FIRST_AXIS = 0;
const TARGET_SECOND_AXIS = 0x31;

const FIRST_AXIS_SLACK = 6;
const FIRST_AXIS_WINDOW = 0x0d;
const SECOND_AXIS_SLACK = 0x18;
const SECOND_AXIS_WINDOW = 0x21;

const LIVE = 0xff;
const DESTROYED = 0xf0;

export function destroyFixedTargetReachedByPlayer(m) {
  const { mem8 } = m;
  if (mem8[PLAYER_STATE] !== LIVE) return;
  if (mem8[ERA_OBJECT_RECORD_SLOT0] !== LIVE) return;

  const across = u8(mem8[ERA_OBJECT_ENTRY_SLOT0] - mem8[PLAYER_ENTRY + TARGET_FIRST_AXIS] + FIRST_AXIS_SLACK);
  if (across >= FIRST_AXIS_WINDOW) return;
  const along = u8(mem8[ERA_OBJECT_SPRITE_Y_SLOT0] - mem8[PLAYER_ENTRY + TARGET_SECOND_AXIS] + SECOND_AXIS_SLACK);
  if (along >= SECOND_AXIS_WINDOW) return;

  mem8[PLAYER_STATE] = DESTROYED;
  mem8[ERA_OBJECT_RECORD_SLOT0] = DESTROYED;
  mem8[HITS_REMAINING] = 0;
  postChainedHitScore(m);
}
