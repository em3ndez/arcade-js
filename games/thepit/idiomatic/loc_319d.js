// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_319d — per-frame step for one enemy/object mover: arrival, capture, retarget,
 * and steer into a travel-direction preset.  ROM 0x319d.
 *
 * Runs once per frame for the mover the working block (its target column, current
 * column, position, state) describes. In order:
 *
 *   - ARRIVED. If the mover already occupies its target column, tick its dwell timer
 *     (loc_3458) and stop — nothing else moves this frame.
 *   - STATE FAN-OUT on the signed state byte MOVER_STATE: a negative state runs the
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
 *     presets (loc_3476/347d/3484/348b), which commit the step and republish the
 *     direction. Top-row and far-edge cells take fixed presets without probing.
 *
 * The routine keeps its address name: the whole mover cluster it hubs — the four
 * presets it steers into, the four tile probes it consults, the dormant tick and the
 * dwell timer — all stay neutral loc_ names because the tilemap's on-screen axis and
 * what a probe "match" means for travel are not yet pinned. A single verb here would
 * claim more than the evidence supports.
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
 * NAMES:    MOVER_STATE (0x8090), ANIM_RAND (0x808b, the dwell/respawn countdown),
 *           MOVER_DIRECTION (0x8092), PROBE_CELL_PTR (0x8089), SUBTILE_PHASE (0x808d),
 *           ACTOR_STATE (0x8084), SPRITE_CODE (0x8069), OBJ_X/OBJ_Y (0x8068/0x806b),
 *           REACTION_OBJ_X/Y (0x8094/0x8097), DIG_OBJ_ARM_STATE (0x80c1), OBJ1_X
 *           (0x80e8) from ram.js. The mover's own target column (0x8093), current
 *           column (0x807a), position bytes (0x8083/0x8086) and the player-box owner
 *           flag (0x80a1) have no ram.js name yet and stay hex.
 */

import { u8 } from "../../../core/int.js";
import { F_Z } from "../../../core/cpu/z80.js";
import {
  MOVER_STATE,
  ANIM_RAND,
  MOVER_DIRECTION,
  PROBE_CELL_PTR,
  SUBTILE_PHASE,
  ACTOR_STATE,
  SPRITE_CODE,
  OBJ_X,
  OBJ_Y,
  REACTION_OBJ_X,
  REACTION_OBJ_Y,
  DIG_OBJ_ARM_STATE,
  OBJ1_X,
} from "./ram.js";
import { loc_3458 } from "./loc_3458.js";
import { advanceDormantMover } from "./advanceDormantMover.js";
import { awardOnePoint } from "./awardOnePoint.js";
import { requestSound20 } from "./requestSound20.js";
import { tileInProbeRow } from "./tileInProbeRow.js";
import { loc_33da } from "./loc_33da.js";
import { loc_3410 } from "./loc_3410.js";
import { loc_3425 } from "./loc_3425.js";
import { loc_3476 } from "./loc_3476.js";
import { loc_347d } from "./loc_347d.js";
import { loc_3484 } from "./loc_3484.js";
import { loc_348b } from "./loc_348b.js";

// The mover's own working-block bytes that have no ram.js name yet.
const TARGET_COLUMN = 0x8093; // the column the mover is heading for
const CURRENT_COLUMN = 0x807a; // the column it is locked to (0 = free)
const MOVER_X = 0x8083; // one pixel-position axis of the mover
const MOVER_Y = 0x8086; // the other pixel-position axis
const PLAYER_BOX_OWNER = 0x80a1; // nonzero while the player-capture box is live

export function loc_319d(m) {
  const { mem8 } = m;

  // Arrived at the target column: just tick the dwell timer and stop.
  if (mem8[CURRENT_COLUMN] === mem8[TARGET_COLUMN]) return loc_3458(m);

  const moverState = mem8[MOVER_STATE];
  if (moverState & 0x80) return advanceDormantMover(m); // negative: dormant housekeeping
  if (moverState !== 0) return handlePlayerBoxOverlap(m); // positive: run the active step

  // Zero state: count down the (re)spawn delay; the mover only reappears on the tick
  // that reaches zero.
  const delay = mem8[ANIM_RAND] - 1;
  mem8[ANIM_RAND] = delay;
  if (delay !== 0) return; // still waiting (a 0 -> 255 wrap counts as still waiting)

  // Delay elapsed: drop the mover back at its start position and run the active step.
  mem8[MOVER_STATE] = 1;
  mem8[ANIM_RAND] = 1;
  mem8[MOVER_X] = 228; // start position
  mem8[MOVER_Y] = 35; // (35 is the top row)
  mem8[OBJ1_X] = 236;
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

  if (mem8[PLAYER_BOX_OWNER] === 0) return handleObjectBoxOverlap(m);

  const moverX = mem8[MOVER_X];
  const moverY = mem8[MOVER_Y];
  const overlaps =
    withinBox(moverX, mem8[REACTION_OBJ_X], 4, 12) &&
    withinBox(moverY, mem8[REACTION_OBJ_Y], 3, 7);
  if (!overlaps) return handleObjectBoxOverlap(m);

  // Caught by the player box: score a point, park the mover in a negative state, and
  // run the dormant tick straight away.
  awardOnePoint(m);
  mem8[MOVER_STATE] = 192; // parked (bit 7 set -> read as negative next frame)
  return advanceDormantMover(m);
}

/** loc_3203 — if the mover is free (no column lock, no dig reaction) and overlaps the
 *  tracked object's box, lock it onto the object and arm the capture pose + sound;
 *  otherwise fall through to the edge/steer classification. */
function handleObjectBoxOverlap(m) {
  const { mem8 } = m;

  // A column-locked mover, or one a dig reaction already owns, skips the retarget test.
  if (mem8[CURRENT_COLUMN] !== 0 || mem8[DIG_OBJ_ARM_STATE] !== 0) {
    return classifyEdgeCell(m);
  }

  const moverX = mem8[MOVER_X];
  const moverY = mem8[MOVER_Y];
  const overlaps =
    withinBox(moverX, mem8[OBJ_X], 8, 18) && withinBox(moverY, mem8[OBJ_Y], 7, 15);
  if (!overlaps) return classifyEdgeCell(m);

  // Overlaps the tracked object: lock onto it, arm the capture-pose sprite and dwell
  // countdown, play the capture sound, then tick the dwell timer.
  mem8[CURRENT_COLUMN] = mem8[TARGET_COLUMN]; // lock to the target column
  mem8[MOVER_X] = mem8[OBJ_X]; // snap onto the object
  mem8[MOVER_Y] = mem8[OBJ_Y];
  mem8[ANIM_RAND] = 129; // arm the dwell countdown
  mem8[ACTOR_STATE] = 23;
  mem8[SPRITE_CODE] = 53; // capture-pose sprite
  requestSound20(m);
  return loc_3458(m);
}

/** loc_3258 — the top-row and far-edge cells take fixed presets without probing;
 *  everything else goes to the position decoder. */
function classifyEdgeCell(m) {
  const { mem8 } = m;
  const moverY = mem8[MOVER_Y];

  if (moverY !== 35) {
    // Not the top row: only the far-edge column is special.
    const moverX = mem8[MOVER_X];
    if (moverX !== 220) return decodePositionAndSteer(m);
    return moverY < 51 ? loc_3484(m) : loc_348b(m);
  }

  // Top row.
  const moverX = mem8[MOVER_X];
  if (mem8[TARGET_COLUMN] === 4) {
    if (moverX === 229) return; // resting exactly at the column-4 seam: nothing to do
    return loc_348b(m);
  }
  return moverX >= 221 ? loc_348b(m) : loc_3484(m);
}

/**
 * loc_3289 — derive the tilemap cell pointer + sub-tile phase from the mover's pixel
 * position, then steer by the target column and travel direction.
 */
function decodePositionAndSteer(m) {
  const { mem8, mem16 } = m;
  const moverX = mem8[MOVER_X];
  const moverY = mem8[MOVER_Y];

  // Sub-tile phase: the low 3 bits of (moverY + 5) lifted into the top of the byte —
  // the row selector the tile probes index their tables by (always a multiple of 32).
  const cellY = u8(moverY + 5);
  mem8[SUBTILE_PHASE] = (cellY & 7) << 5;

  // Tilemap cell pointer (base 0x9000, 32 cells per row): the row is 31 minus the
  // 8-pixel cell of (moverX + 4); the column is the 8-pixel cell of (moverY + 5).
  const row = 31 - (u8(moverX + 4) >> 3);
  const column = cellY >> 3;
  mem16[PROBE_CELL_PTR] = 0x9000 + row * 32 + column;

  const direction = mem8[MOVER_DIRECTION];
  if (mem8[TARGET_COLUMN] === 5) return steerColumnFive(m, direction);
  return steerColumnOther(m, direction);
}

/** loc_3410 reports its tile-match only through the zero flag; wrap it to a boolean. */
function probeRowAhead(m) {
  loc_3410(m);
  return (m.regs.f & F_Z) !== 0;
}

/** The gated steer arms only run their probe chain when the mover sits on an 8-pixel
 *  cell boundary; off the boundary they commit a fixed preset immediately. */
function onCellBoundary(m) {
  return (m.mem8[MOVER_X] + 4) % 8 === 0;
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
    if (!onCellBoundary(m)) return loc_347d(m);
    return steerChain(
      m,
      [[probeRowAhead, loc_3484], [loc_33da, loc_347d], [tileInProbeRow, loc_3476]],
      loc_348b,
    );
  }
  if (direction === 2) {
    return steerChain(
      m,
      [[loc_3425, loc_348b], [probeRowAhead, loc_3484], [loc_33da, loc_347d]],
      loc_3476,
    );
  }
  if (direction === 3) {
    if (!onCellBoundary(m)) return loc_348b(m);
    return steerChain(
      m,
      [[tileInProbeRow, loc_3476], [loc_3425, loc_348b], [probeRowAhead, loc_3484]],
      loc_347d,
    );
  }
  // direction 0 (or any value past 3)
  return steerChain(
    m,
    [[loc_33da, loc_347d], [tileInProbeRow, loc_3476], [loc_3425, loc_348b]],
    loc_3484,
  );
}

/** loc_3369/3388/339d + the default arm — steer for a mover whose target column is 5. */
function steerColumnFive(m, direction) {
  if (direction === 1) {
    if (!onCellBoundary(m)) return loc_347d(m);
    return steerChain(
      m,
      [[tileInProbeRow, loc_3476], [loc_33da, loc_347d], [probeRowAhead, loc_3484]],
      loc_348b,
    );
  }
  if (direction === 2) {
    return steerChain(
      m,
      [[loc_33da, loc_347d], [probeRowAhead, loc_3484], [loc_3425, loc_348b]],
      loc_3476,
    );
  }
  if (direction === 3) {
    if (!onCellBoundary(m)) return loc_348b(m);
    return steerChain(
      m,
      [[probeRowAhead, loc_3484], [loc_3425, loc_348b], [tileInProbeRow, loc_3476]],
      loc_347d,
    );
  }
  // direction 0 (or any value past 3)
  return steerChain(
    m,
    [[loc_3425, loc_348b], [tileInProbeRow, loc_3476], [loc_33da, loc_347d]],
    loc_3484,
  );
}
