// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceTrackedObject — route the tracked object to its per-frame handler by its state gates.
 * The body of the per-frame object/state dispatcher, entered once the object's state timer is idle.
 * It holds no logic of its own: it reads a chain of the object's control bytes and hands the frame
 * to exactly one handler. The chain, in order — each gate acts or falls through:
 *   - object mid-work this frame  -> stage the deferral record and stop
 *   - no live object / spawn sub-phase running -> nothing to advance
 *   - carve state armed (== 1) -> the fixed-frame prologue + shared tile tail; past armed -> defer
 *   - motion marker negative -> step the walk animation; positive -> the player walk step
 *   - goal not reached / crossing recorded / terrain reveal finished -> the matching handler
 * Before dispatching it loads the object's position-bias pair (PLAYER_STEP_Y / PLAYER_STEP_X) into
 * the D and E registers: the handlers read that pair as the column bias and the move deltas, so it
 * is a genuine register boundary. The chosen handler is the whole frame's work and its own return.
 */

import {
  PLAYER_ACTIVE,
  BOARD_END_PHASE,
  DIG_COLLISION_STATE,
  GOAL_TILE_LATCH,
  PIT_CROSS_ACTIVE,
  PIT_FLOOR_REVEAL_CURSOR,
  PLAYER_STEP_X,
  PLAYER_STEP_Y,
  OBJECT_MOTION_MODE,
  LOCKED_COLUMN,
} from "./names.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { stampFixedFrameAndResolveTile } from "./stampFixedFrameAndResolveTile.js";
import { advanceObjectWalkFrame } from "./advanceObjectWalkFrame.js";
import { walkActor } from "./walkActor.js";
import { stepObjectFromControl } from "./stepObjectFromControl.js";
import { advanceActorWalk } from "./advanceActorWalk.js";
import { resolveObjectTile } from "./resolveObjectTile.js";

export function advanceTrackedObject(m) {
  const { mem8, regs } = m;

  // Object still mid-work this frame: stage its deferral record and stop.
  if (mem8[LOCKED_COLUMN] !== 0) return stageObjectSpriteRecord(m);

  // No live object, or a spawn sub-phase is still running: nothing to advance this frame.
  if (mem8[PLAYER_ACTIVE] === 0) return;
  if (mem8[BOARD_END_PHASE] !== 0) return;

  // Load the object's position-bias pair into D and E: the tile-cell tail reads the column bias
  // from D, and the position handlers reached below read both bytes as the object's move deltas.
  const columnBias = mem8[PLAYER_STEP_X];
  regs.e = mem8[PLAYER_STEP_Y];
  regs.d = columnBias;

  // Carve/arm state: armed runs the fixed-frame prologue plus the shared tile tail; any state
  // past armed stages the deferral record instead.
  const armState = mem8[DIG_COLLISION_STATE];
  if (armState === 1) return stampFixedFrameAndResolveTile(m);
  if (armState !== 0) return stageObjectSpriteRecord(m);

  // Motion marker: a "negative" marker (high bit set) steps the moving object's walk animation;
  // a positive marker runs the player walk step; zero falls through to the goal/control gates.
  const motionMarker = mem8[OBJECT_MOTION_MODE];
  if (motionMarker >= 128) return advanceObjectWalkFrame(m);
  if (motionMarker !== 0) return walkActor(m);

  // Goal not yet reached: advance the object straight from its control input.
  if (mem8[GOAL_TILE_LATCH] === 0) return stepObjectFromControl(m);

  // Goal reached, and the crossing point was recorded: walk the object forward past it.
  if (mem8[PIT_CROSS_ACTIVE] !== 0) return advanceActorWalk(m);

  // Terrain reveal finished: locate the object's tile cell and dispatch on the tile under it.
  if (mem8[PIT_FLOOR_REVEAL_CURSOR] === 0) return resolveObjectTile(m, columnBias);

  // Otherwise advance the object from its control input.
  return stepObjectFromControl(m);
}
