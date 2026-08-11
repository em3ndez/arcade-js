// SPDX-License-Identifier: GPL-3.0-only
/** dispatchEra4CollisionByFrameParity — the era-4 per-frame collision dispatch, split by frame parity. On even frames run the
 * whole player-versus-object collision-and-destruction pass. On odd frames stage one shot-versus-
 * target sweep over a run of object slots and hand it the shared destruction body: while the mother
 * ship is armed the run is nine long and a following mother-ship mutual-kill pass runs after it;
 * while it is clear the run is eleven long and no mother-ship pass follows. The two cursor cells the
 * shared body reloads between passes are staged in memory first so every pass restarts on this run.
 * LIVE-OUT: memory. */

import { runAllCollisionSweepsThisFrame } from "./runAllCollisionSweepsThisFrame.js";
import { destroyTargetsHitByShots } from "./destroyTargetsHitByShots.js";
import { destroyMotherShipAndShotOnMutualHit } from "./destroyMotherShipAndShotOnMutualHit.js";
import { ACTOR_ENTRY_SLOT0, ACTOR_RECORD_SLOT0, FRAME_TICK, MOTHER_SHIP_ARMED, PLAYER_SHOT_ARRAY } from "./names.js";

const TARGET_ENTRY_CURSOR = 0xa991;
const TARGET_RECORD_CURSOR = 0xa993;
const SHOTS = 0x06;
const REACH = 0x07;
const SPAN = 0x0f;
const ARMED_TARGETS = 0x09;
const OPEN_TARGETS = 0x0b;

export function dispatchEra4CollisionByFrameParity(m) {
  const { regs, mem8, mem16 } = m;
  if ((mem8[FRAME_TICK] & 0x01) === 0) return runAllCollisionSweepsThisFrame(m);

  const armed = mem8[MOTHER_SHIP_ARMED] !== 0;
  const targets = armed ? ARMED_TARGETS : OPEN_TARGETS;

  regs.de = ACTOR_RECORD_SLOT0;
  regs.iy = ACTOR_ENTRY_SLOT0;
  regs.ix = PLAYER_SHOT_ARRAY;
  regs.a_ = targets;
  regs.b = targets;
  regs.c = SHOTS;
  mem16[TARGET_RECORD_CURSOR] = ACTOR_RECORD_SLOT0;
  mem16[TARGET_ENTRY_CURSOR] = ACTOR_ENTRY_SLOT0;
  regs.l = REACH;
  regs.h = SPAN;

  if (armed) {
    destroyTargetsHitByShots(m);
    return destroyMotherShipAndShotOnMutualHit(m);
  }
  return destroyTargetsHitByShots(m);
}
