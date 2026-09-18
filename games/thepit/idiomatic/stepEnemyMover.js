// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepEnemyMover — per-frame step for one enemy/object mover: arrival, capture, retarget, and
 * steer into a travel-direction preset. Runs once per frame for the mover the working block (its
 * target column, current column, position, state) describes. In order:
 *   - ARRIVED: if the mover already occupies its target column, tick its dwell timer and stop.
 *   - STATE FAN-OUT on the signed state byte ENEMY_WORK_STATE: a negative state runs the dormant
 *     housekeeping; a positive state runs the active step; a zero state counts down a (re)spawn
 *     delay and, at zero, drops the mover back at its start position and runs the active step.
 *   - PLAYER BOX: while the player-capture box is live and the mover overlaps it, award a point,
 *     park the mover dormant, and run the dormant tick.
 *   - OBJECT BOX: otherwise, if the mover is free and overlaps the tracked object's box, lock it
 *     onto the object, arm the capture pose + sound, and tick its dwell.
 *   - STEER: otherwise decode the tilemap cell under the mover and its sub-tile phase from the
 *     pixel position, then — keyed by target column and travel direction — probe the neighbouring
 *     tiles and hand the mover to one of four movement presets (up / mirrored / down / unmirrored),
 *     which commit the step and republish the direction. Top-row and far-edge cells take fixed
 *     presets without probing.
 *
 * The two vertical presets (stepMoverUp / stepMoverDown) are named for the axis; the two horizontal
 * presets (stepMoverMirrored / stepMoverUnmirrored) are named for their mirror relationship, though
 * their left-vs-right sign stays ambiguous.
 */

import { u8 } from "../../../core/int.js";
import { F_Z } from "../../../core/cpu/z80.js";
import {
  ENEMY_WORK_STATE,
  ENEMY_WORK_X,
  ENEMY_WORK_Y,
  ENEMY_ACTION_TIMER,
  LOCKED_COLUMN,
  ENEMY_WORK_DIR,
  PROBE_CELL_PTR,
  SUBTILE_PHASE,
  ENEMY_WORK_SPRITE,
  PLAYER_FACING,
  PLAYER_Y,
  PLAYER_X,
  REACTION_OBJ_X,
  REACTION_OBJ_Y,
  DIG_COLLISION_STATE,
  ENEMY1_X,
  ENEMY_WORK_TARGET_COL,
  LASER_STATE,
} from "./names.js";
import { tickObjectDwellThenTransition } from "./tickObjectDwellThenTransition.js";
import { advanceDormantMover } from "./advanceDormantMover.js";
import { awardOnePoint } from "./awardOnePoint.js";
import { requestSound20 } from "./requestSound20.js";
import { tileInProbeRow } from "./tileInProbeRow.js";
import { probeRowBackTilePair } from "./probeRowBackTilePair.js";
import { nextTileInProbeRow } from "./nextTileInProbeRow.js";
import { probeRowAheadTilePair } from "./probeRowAheadTilePair.js";
import { stepMoverUp } from "./stepMoverUp.js";
import { stepMoverMirrored } from "./stepMoverMirrored.js";
import { stepMoverDown } from "./stepMoverDown.js";
import { stepMoverUnmirrored } from "./stepMoverUnmirrored.js";

export function stepEnemyMover(m) {
  const { mem8 } = m;

  // Arrived at the target column: just tick the dwell timer and stop.
  if (mem8[LOCKED_COLUMN] === mem8[ENEMY_WORK_TARGET_COL]) return tickObjectDwellThenTransition(m);

  const moverState = mem8[ENEMY_WORK_STATE];
  if (moverState & 0x80) return advanceDormantMover(m); // negative: dormant housekeeping
  if (moverState !== 0) return handlePlayerBoxOverlap(m); // positive: run the active step

  // Zero state: count down the (re)spawn delay; the mover only reappears on the tick
  // that reaches zero.
  const delay = mem8[ENEMY_ACTION_TIMER] - 1;
  mem8[ENEMY_ACTION_TIMER] = delay;
  if (delay !== 0) return; // still waiting (a 0 -> 255 wrap counts as still waiting)

  // Delay elapsed: drop the mover back at its start position and run the active step.
  mem8[ENEMY_WORK_STATE] = 1;
  mem8[ENEMY_ACTION_TIMER] = 1;
  mem8[ENEMY_WORK_X] = 228; // start position
  mem8[ENEMY_WORK_Y] = 35; // (35 is the top row)
  mem8[ENEMY1_X] = 236;
  return handlePlayerBoxOverlap(m);
}

/**
 * True when `pos` falls inside a collision box built off `boxCoord`: the box's leading
 * edge sits `ahead` pixels past the coordinate and it is `span` pixels wide, using the
 * wrap-around byte arithmetic the hardware compares with.
 */
function withinBox(pos, boxCoord, ahead, span) {
  const leadingEdge = u8(boxCoord + ahead);
  if (leadingEdge < pos) return false; // pos is beyond the leading edge
  const trailingEdge = u8(leadingEdge - span);
  return trailingEdge < pos; // inside only while pos is past the trailing edge
}

/** While the player-capture box is live and the mover overlaps it, award a
 *  point and park the mover; otherwise fall through to the object-box test. */
function handlePlayerBoxOverlap(m) {
  const { mem8 } = m;

  if (mem8[LASER_STATE] === 0) return handleObjectBoxOverlap(m);

  const moverX = mem8[ENEMY_WORK_X];
  const moverY = mem8[ENEMY_WORK_Y];
  const overlaps =
    withinBox(moverX, mem8[REACTION_OBJ_X], 4, 12) &&
    withinBox(moverY, mem8[REACTION_OBJ_Y], 3, 7);
  if (!overlaps) return handleObjectBoxOverlap(m);

  // Caught by the player box: score a point, park the mover in a negative state, and
  // run the dormant tick straight away.
  awardOnePoint(m);
  mem8[ENEMY_WORK_STATE] = 192; // parked (bit 7 set -> read as negative next frame)
  return advanceDormantMover(m);
}

/** If the mover is free (no column lock, no dig reaction) and overlaps the
 *  tracked object's box, lock it onto the object and arm the capture pose + sound;
 *  otherwise fall through to the edge/steer classification. */
function handleObjectBoxOverlap(m) {
  const { mem8 } = m;

  // A column-locked mover, or one a dig reaction already owns, skips the retarget test.
  if (mem8[LOCKED_COLUMN] !== 0 || mem8[DIG_COLLISION_STATE] !== 0) {
    return classifyEdgeCell(m);
  }

  const moverX = mem8[ENEMY_WORK_X];
  const moverY = mem8[ENEMY_WORK_Y];
  const overlaps =
    withinBox(moverX, mem8[PLAYER_Y], 8, 18) && withinBox(moverY, mem8[PLAYER_X], 7, 15);
  if (!overlaps) return classifyEdgeCell(m);

  // Overlaps the tracked object: lock onto it, arm the capture-pose sprite and dwell
  // countdown, play the capture sound, then tick the dwell timer.
  mem8[LOCKED_COLUMN] = mem8[ENEMY_WORK_TARGET_COL]; // lock to the target column
  mem8[ENEMY_WORK_X] = mem8[PLAYER_Y]; // snap onto the object
  mem8[ENEMY_WORK_Y] = mem8[PLAYER_X];
  mem8[ENEMY_ACTION_TIMER] = 129; // arm the dwell countdown
  mem8[ENEMY_WORK_SPRITE] = 23;
  mem8[PLAYER_FACING] = 53; // capture-pose sprite
  requestSound20(m);
  return tickObjectDwellThenTransition(m);
}

/** The top-row and far-edge cells take fixed presets without probing;
 *  everything else goes to the position decoder. */
function classifyEdgeCell(m) {
  const { mem8 } = m;
  const moverY = mem8[ENEMY_WORK_Y];

  if (moverY !== 35) {
    // Not the top row: only the far-edge column is special.
    const moverX = mem8[ENEMY_WORK_X];
    if (moverX !== 220) return decodePositionAndSteer(m);
    return moverY < 51 ? stepMoverDown(m) : stepMoverUnmirrored(m);
  }

  // Top row.
  const moverX = mem8[ENEMY_WORK_X];
  if (mem8[ENEMY_WORK_TARGET_COL] === 4) {
    if (moverX === 229) return; // resting exactly at the column-4 seam: nothing to do
    return stepMoverUnmirrored(m);
  }
  return moverX >= 221 ? stepMoverUnmirrored(m) : stepMoverDown(m);
}

/**
 * Derive the tilemap cell pointer + sub-tile phase from the mover's pixel
 * position, then steer by the target column and travel direction.
 */
function decodePositionAndSteer(m) {
  const { mem8, mem16 } = m;
  const moverX = mem8[ENEMY_WORK_X];
  const moverY = mem8[ENEMY_WORK_Y];

  // Sub-tile phase: the low 3 bits of (moverY + 5) lifted into the top of the byte —
  // the row selector the tile probes index their tables by (always a multiple of 32).
  const cellY = u8(moverY + 5);
  mem8[SUBTILE_PHASE] = (cellY & 7) << 5;

  // Tilemap cell pointer (32 cells per row): the row is 31 minus the
  // 8-pixel cell of (moverX + 4); the column is the 8-pixel cell of (moverY + 5).
  const row = 31 - (u8(moverX + 4) >> 3);
  const column = cellY >> 3;
  mem16[PROBE_CELL_PTR] = 0x9000 + row * 32 + column;

  const direction = mem8[ENEMY_WORK_DIR];
  if (mem8[ENEMY_WORK_TARGET_COL] === 5) return steerColumnFive(m, direction);
  return steerColumnOther(m, direction);
}

/** nextTileInProbeRow reports its tile-match only through the zero flag; wrap it to a boolean. */
function probeRowAhead(m) {
  nextTileInProbeRow(m);
  return (m.regs.f & F_Z) !== 0;
}

/** The gated steer arms only run their probe chain when the mover sits on an 8-pixel
 *  cell boundary; off the boundary they commit a fixed preset immediately. */
function onCellBoundary(m) {
  return (m.mem8[ENEMY_WORK_X] + 4) % 8 === 0;
}

/** Try each [probe, preset] in order; hand off to the first preset whose probe matches,
 *  or to `fallback` if none do. */
function steerChain(m, chain, fallback) {
  for (const [probe, preset] of chain) {
    if (probe(m)) return preset(m);
  }
  return fallback(m);
}

/** Steer for a mover whose target column is not 5 (one arm per travel direction, plus the default). */
function steerColumnOther(m, direction) {
  if (direction === 1) {
    if (!onCellBoundary(m)) return stepMoverMirrored(m);
    return steerChain(
      m,
      [[probeRowAhead, stepMoverDown], [probeRowBackTilePair, stepMoverMirrored], [tileInProbeRow, stepMoverUp]],
      stepMoverUnmirrored,
    );
  }
  if (direction === 2) {
    return steerChain(
      m,
      [[probeRowAheadTilePair, stepMoverUnmirrored], [probeRowAhead, stepMoverDown], [probeRowBackTilePair, stepMoverMirrored]],
      stepMoverUp,
    );
  }
  if (direction === 3) {
    if (!onCellBoundary(m)) return stepMoverUnmirrored(m);
    return steerChain(
      m,
      [[tileInProbeRow, stepMoverUp], [probeRowAheadTilePair, stepMoverUnmirrored], [probeRowAhead, stepMoverDown]],
      stepMoverMirrored,
    );
  }
  // direction 0 (or any value past 3)
  return steerChain(
    m,
    [[probeRowBackTilePair, stepMoverMirrored], [tileInProbeRow, stepMoverUp], [probeRowAheadTilePair, stepMoverUnmirrored]],
    stepMoverDown,
  );
}

/** Steer for a mover whose target column is 5 (one arm per travel direction, plus the default). */
function steerColumnFive(m, direction) {
  if (direction === 1) {
    if (!onCellBoundary(m)) return stepMoverMirrored(m);
    return steerChain(
      m,
      [[tileInProbeRow, stepMoverUp], [probeRowBackTilePair, stepMoverMirrored], [probeRowAhead, stepMoverDown]],
      stepMoverUnmirrored,
    );
  }
  if (direction === 2) {
    return steerChain(
      m,
      [[probeRowBackTilePair, stepMoverMirrored], [probeRowAhead, stepMoverDown], [probeRowAheadTilePair, stepMoverUnmirrored]],
      stepMoverUp,
    );
  }
  if (direction === 3) {
    if (!onCellBoundary(m)) return stepMoverUnmirrored(m);
    return steerChain(
      m,
      [[probeRowAhead, stepMoverDown], [probeRowAheadTilePair, stepMoverUnmirrored], [tileInProbeRow, stepMoverUp]],
      stepMoverMirrored,
    );
  }
  // direction 0 (or any value past 3)
  return steerChain(
    m,
    [[probeRowAheadTilePair, stepMoverUnmirrored], [tileInProbeRow, stepMoverUp], [probeRowBackTilePair, stepMoverMirrored]],
    stepMoverDown,
  );
}
