// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_13de — route the tracked object to its per-frame handler by its state gates.  ROM 0x13de.
 *
 * The body of the per-frame object/state dispatcher, entered each frame from the countdown
 * gate (loc_13c9) once the object's state timer is idle. It holds no logic of its own: it reads
 * a chain of the tracked object's control bytes and hands the frame to exactly one handler.
 *
 * The chain, in order — each gate either acts or falls through to the next:
 *   - object mid-work this frame  -> stage the object's deferral record and stop
 *   - no live object              -> nothing to advance this frame
 *   - a spawn sub-phase running    -> defer; let the spawn finish first
 *   - carve state armed (== 1)     -> the fixed-frame prologue (loc_186a) + shared tile tail
 *   - carve state past armed (> 1) -> stage the deferral record
 *   - motion marker "negative"     -> step the moving object's walk animation
 *   - motion marker positive       -> run the player walk step
 *   - goal not yet reached         -> advance the object from its control input
 *   - goal crossing recorded       -> walk the object forward past the crossing
 *   - terrain reveal finished      -> locate the tile cell and dispatch on the tile under it
 *   - otherwise                    -> advance the object from its control input
 *
 * Before dispatching it loads the object's position-bias pair (the word at 0x806c) into the D
 * and E registers, the way the countdown gate's oracle does. The per-frame handlers read that
 * pair straight out of the registers: the shared tile tail (loc_186a -> loc_186f) takes the
 * horizontal column bias from D, and the still-oracle position handlers reached below (via the
 * at-rest router) take both bytes as the object's move deltas — so this is a genuine register
 * boundary that has to survive. The direct tile branch is additionally handed the column bias as
 * an explicit argument. The chosen handler is the object's whole remaining work this frame, and
 * its return unwinds to this routine's caller, so handing off is this routine's own return. The
 * routine writes no memory of its own.
 *
 * Memory-equivalent to the frozen oracle — equivalence-13de.test.js.
 * GATE:     RAM-only over real captured attract dispatches (loc_13de runs whenever the object's
 *           state timer is idle) + crafted entries for the state arms attract does not reach.
 *           Excludes the dead stack scratch the still-oracle handler chain parks below the entry
 *           stack pointer (the idiomatic handlers are stack-free); no real work-RAM output lives
 *           in that window. Teeth: a twin that drops the "no live object" guard, and one that
 *           routes a positive motion marker to the wrong walk handler.
 * LIVE-OUT: memory-only for the caller — every write comes from the chosen handler, and the
 *           caller reads no register back. The genuine register live-out is the object's
 *           position-bias pair loaded into D and E, which the tile-cell tail and the still-oracle
 *           position handlers read.
 * NAMES:    OBJECT_ACTIVE, SPAWN_PHASE, DIG_OBJ_ARM_STATE, GOAL_TILE_LATCH, GOAL_CROSSING_LATCH,
 *           REVEAL_CURSOR from ram.js; 0x807a (busy-this-frame flag), 0x8075 (motion marker) and
 *           the position-bias pair at 0x806c/0x806d have no ram.js name yet and stay hex.
 */

import {
  OBJECT_ACTIVE,
  SPAWN_PHASE,
  DIG_OBJ_ARM_STATE,
  GOAL_TILE_LATCH,
  GOAL_CROSSING_LATCH,
  REVEAL_CURSOR,
} from "./ram.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { loc_186a } from "./loc_186a.js";
import { advanceObjectWalkFrame } from "./advanceObjectWalkFrame.js";
import { walkActor } from "./walkActor.js";
import { stepObjectFromControl } from "./stepObjectFromControl.js";
import { advanceActorWalk } from "./advanceActorWalk.js";
import { loc_186f } from "./loc_186f.js";

// Tracked-object control bytes that have no ram.js name yet.
const BUSY_THIS_FRAME = 0x807a; // nonzero while the object is mid-work this frame
const MOTION_MARKER = 0x8075; // signed walk-mode selector; a set high bit routes to the object walker
const BIAS_LO = 0x806c; // low byte of the object's position-bias pair (read from E by the position handlers)
const COLUMN_BIAS = 0x806d; // high byte = horizontal column bias (read from D by the tile-cell tail)

export function loc_13de(m) {
  const { mem8, regs } = m;

  // Object still mid-work this frame: stage its deferral record and stop.
  if (mem8[BUSY_THIS_FRAME] !== 0) return stageObjectSpriteRecord(m);

  // No live object, or a spawn sub-phase is still running: nothing to advance this frame.
  if (mem8[OBJECT_ACTIVE] === 0) return;
  if (mem8[SPAWN_PHASE] !== 0) return;

  // Load the object's position-bias pair into D and E the way the oracle does: the tile-cell
  // tail (loc_186a -> loc_186f) reads the column bias from D, and the still-oracle position
  // handlers reached below read both bytes as the object's move deltas.
  const columnBias = mem8[COLUMN_BIAS];
  regs.e = mem8[BIAS_LO];
  regs.d = columnBias;

  // Carve/arm state: armed runs the fixed-frame prologue plus the shared tile tail; any state
  // past armed stages the deferral record instead.
  const armState = mem8[DIG_OBJ_ARM_STATE];
  if (armState === 1) return loc_186a(m);
  if (armState !== 0) return stageObjectSpriteRecord(m);

  // Motion marker: a "negative" marker (high bit set) steps the moving object's walk animation;
  // a positive marker runs the player walk step; zero falls through to the goal/control gates.
  const motionMarker = mem8[MOTION_MARKER];
  if (motionMarker >= 128) return advanceObjectWalkFrame(m);
  if (motionMarker !== 0) return walkActor(m);

  // Goal not yet reached: advance the object straight from its control input.
  if (mem8[GOAL_TILE_LATCH] === 0) return stepObjectFromControl(m);

  // Goal reached, and the crossing point was recorded: walk the object forward past it.
  if (mem8[GOAL_CROSSING_LATCH] !== 0) return advanceActorWalk(m);

  // Terrain reveal finished: locate the object's tile cell and dispatch on the tile under it.
  if (mem8[REVEAL_CURSOR] === 0) return loc_186f(m, columnBias);

  // Otherwise advance the object from its control input.
  return stepObjectFromControl(m);
}
