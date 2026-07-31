// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceTrackedObject — route the tracked object to its per-frame handler by its state gates.  ROM 0x13de.
 *
 * The body of the per-frame object/state dispatcher, entered each frame from the countdown
 * gate (dispatchObjectFrameByStateTimer) once the object's state timer is idle. It holds no logic of its own: it reads
 * a chain of the tracked object's control bytes and hands the frame to exactly one handler.
 *
 * The chain, in order — each gate either acts or falls through to the next:
 *   - object mid-work this frame  -> stage the object's deferral record and stop
 *   - no live object              -> nothing to advance this frame
 *   - a spawn sub-phase running    -> defer; let the spawn finish first
 *   - carve state armed (== 1)     -> the fixed-frame prologue (stampFixedFrameAndResolveTile) + shared tile tail
 *   - carve state past armed (> 1) -> stage the deferral record
 *   - motion marker "negative"     -> step the moving object's walk animation
 *   - motion marker positive       -> run the player walk step
 *   - goal not yet reached         -> advance the object from its control input
 *   - goal crossing recorded       -> walk the object forward past the crossing
 *   - terrain reveal finished      -> locate the tile cell and dispatch on the tile under it
 *   - otherwise                    -> advance the object from its control input
 *
 * Before dispatching it loads the object's position-bias pair (the word at PLAYER_STEP_Y) into the D
 * and E registers, the way the countdown gate's oracle does. The per-frame handlers read that
 * pair straight out of the registers: the shared tile tail (stampFixedFrameAndResolveTile -> resolveObjectTile) takes the
 * horizontal column bias from D, and the still-oracle position handlers reached below (via the
 * at-rest router) take both bytes as the object's move deltas — so this is a genuine register
 * boundary that has to survive. The direct tile branch is additionally handed the column bias as
 * an explicit argument. The chosen handler is the object's whole remaining work this frame, and
 * its return unwinds to this routine's caller, so handing off is this routine's own return. The
 * routine writes no memory of its own.
 *
 * Memory-equivalent to the frozen oracle — equivalence-13de.test.js.
 * GATE:     RAM-only over real captured attract dispatches (advanceTrackedObject runs whenever the object's
 *           state timer is idle) + crafted entries for the state arms attract does not reach.
 *           Excludes the dead stack scratch the still-oracle handler chain parks below the entry
 *           stack pointer (the idiomatic handlers are stack-free); no real work-RAM output lives
 *           in that window. Teeth: a twin that drops the "no live object" guard, and one that
 *           routes a positive motion marker to the wrong walk handler.
 * LIVE-OUT: memory-only for the caller — every write comes from the chosen handler, and the
 *           caller reads no register back. The genuine register live-out is the object's
 *           position-bias pair loaded into D and E, which the tile-cell tail and the still-oracle
 *           position handlers read.
 * NAMES:    PLAYER_ACTIVE, BOARD_END_PHASE, DIG_COLLISION_STATE, GOAL_TILE_LATCH, PIT_CROSS_ACTIVE,
 *           PIT_FLOOR_REVEAL_CURSOR, PLAYER_STEP_Y, PLAYER_STEP_X (0x806d, the pair's high byte) from ram.js;
 *           LOCKED_COLUMN 0x807a (busy-this-frame flag), OBJECT_MOTION_MODE 0x8075 (motion marker).
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
} from "./ram.js";
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

  // Load the object's position-bias pair into D and E the way the oracle does: the tile-cell
  // tail (stampFixedFrameAndResolveTile -> resolveObjectTile) reads the column bias from D, and the still-oracle position
  // handlers reached below read both bytes as the object's move deltas.
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
