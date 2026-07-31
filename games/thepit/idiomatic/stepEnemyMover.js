// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepEnemyMover — per-frame step for one enemy/object mover: arrival, capture, retarget,
 * and steer into a travel-direction preset.  ROM 0x319d.
 *
 * Runs once per frame for the mover the working block (its target column, current
 * column, position, state) describes. In order:
 *
 *   - ARRIVED. If the mover already occupies its target column, tick its dwell timer
 *     (tickObjectDwellThenTransition) and stop — nothing else moves this frame.
 *   - STATE FAN-OUT on the signed state byte ENEMY_WORK_STATE: a negative state runs the
 *     dormant housekeeping (advanceDormantMover); a positive state runs the active
 *     step below; a zero state counts down a (re)spawn delay and, when it reaches
 *     zero, drops the mover back at its start position and runs the active step.
 *   - PLAYER BOX. While the player-capture box is live and the mover overlaps it,
 *     award a point, park the mover dormant, and run the dormant tick.
 *   - OBJECT BOX. Otherwise, if the mover is free and overlaps the tracked object's
 *     box, lock it onto the object, arm the capture pose + sound, and tick its dwell.
 *   - STEER. Otherwise decode the tilemap cell under the mover and its sub-tile phase
 *     from the pixel position, then — keyed by the target column and travel direction
 *     — probe the neighbouring tiles and hand the mover to one of four movement
 *     presets (stepMoverUp / stepMoverMirrored / stepMoverDown / stepMoverUnmirrored), which commit the step
 *     and republish the direction. Top-row and far-edge cells take fixed presets without probing.
 *
 * The mover's VERTICAL axis (0x8086) is now pinned, so its two vertical presets are named
 * (stepMoverUp / stepMoverDown). The two horizontal presets (stepMoverMirrored / stepMoverUnmirrored)
 * are named for their mirror relationship, though their left-vs-right sign stays rotation-ambiguous;
 * the four tile probes, the dormant tick and the dwell timer are likewise named now. This routine
 * itself earned a name (stepEnemyMover) as the per-frame step for one enemy mover.
 *
 * Memory-equivalent to the frozen oracle — equivalence-319d.test.js.
 * GATE:     real captured attract dispatches (the entry state machine + edge cells —
 *           the demo runs the mover thousands of times but never takes a probe arm) +
 *           crafted entries that force the player-box capture, the object-box retarget,
 *           and every column/direction steer arm, each compared to the oracle over
 *           work RAM (dumpState) outside the dead stack scratch. The arrival/capture
 *           tails that reach the round-boundary transition are stubbed identically on
 *           both sides so they terminate. Teeth catch a wrong capture pose and a wrong
 *           park state.
 * LIVE-OUT: memory-only — the mover's state/timer/position bytes, the probe cell
 *           pointer + sub-tile phase, the retarget/capture writes, and whatever the
 *           tail preset/transition leaves. The mover is reached by tail-jump; no
 *           caller reads a value register back (dead ABI).
 * NAMES:    ENEMY_WORK_STATE (0x8090), ENEMY_ACTION_TIMER (0x808b, the dwell/respawn countdown),
 *           ENEMY_WORK_DIR (0x8092), PROBE_CELL_PTR (0x8089), SUBTILE_PHASE (0x808d),
 *           ENEMY_WORK_SPRITE (0x8084), PLAYER_FACING (0x8069), PLAYER_Y/PLAYER_X (0x8068/0x806b),
 *           REACTION_OBJ_X/Y (0x8094/0x8097), DIG_COLLISION_STATE (0x80c1), ENEMY1_X
 *           (0x80e8), ENEMY_WORK_TARGET_COL (0x8093), LASER_STATE (0x80a1, the player-box
 *           owner flag here) from ram.js. The mover's own current column is LOCKED_COLUMN (0x807a),
 *           and its position bytes are ENEMY_WORK_X/ENEMY_WORK_Y (0x8083/0x8086).
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
} from "./ram.js";
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

/** loc_31d0 — while the player-capture box is live and the mover overlaps it, award a
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

/** loc_3203 — if the mover is free (no column lock, no dig reaction) and overlaps the
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

/** loc_3258 — the top-row and far-edge cells take fixed presets without probing;
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
 * loc_3289 — derive the tilemap cell pointer + sub-tile phase from the mover's pixel
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

  // Tilemap cell pointer (base 0x9000, 32 cells per row): the row is 31 minus the
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

/** loc_32f2/3311/3326 + the default arm — steer for a mover whose target column is not 5. */
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

/** loc_3369/3388/339d + the default arm — steer for a mover whose target column is 5. */
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
