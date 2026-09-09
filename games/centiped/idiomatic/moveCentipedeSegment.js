// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loadObjectTileInputs } from "./loadObjectTileInputs.js";
import { resolveTileCellAtXY } from "./resolveTileCellAtXY.js";
import { detectColumnCollision } from "./detectColumnCollision.js";
import { foldSignedMagnitude } from "./foldSignedMagnitude.js";
import { negateA } from "./negateA.js";
import { advanceSegmentLoopIndex } from "./advanceSegmentLoopIndex.js";
import { advanceSegmentCoordAndArm } from "./advanceSegmentCoordAndArm.js";
import { reverseSegmentDeltaAndStepCoord } from "./reverseSegmentDeltaAndStepCoord.js";
import { commitSegmentCoord } from "./commitSegmentCoord.js";
import {
  loc_00, loc_34, loc_35, loc_44, loc_54, loc_63, loc_64, loc_74,
  loc_88, loc_94, loc_97, loc_ef, loc_f0,
} from "./names.js";

/**
 * moveCentipedeSegment — the heart of the per-segment walk: advance one body slot X by one step.
 *
 * Role in the machine: `beginCentipedeSegmentSweep` enters here seeded at the last slot (0x0b); this
 * routine advances that slot's phase and coordinate by one motion step, decides — through a cascade
 * of wall / edge / neighbour tests — which of the sibling step handlers should carry the walk on,
 * and tail-transfers to it. The loop-tail handler (`advanceSegmentLoopIndex`) steps the cursor to the
 * previous slot and re-enters here, so one call ripples down the whole strip. Every exit is a tail
 * transfer to a step handler; the ordinary "keep walking" finish carries the new coordinate through
 * the coordinate-store handler.
 *
 * Reads the phase byte $34+X (a negative phase — bit7 set — means the slot is retired and hands
 * straight to the wrap/decrement tail), advances it on even $00 frames, re-seeds the $44/$74 heading
 * deltas when the segment sits on its home column, then runs the wall / edge / neighbour tests.
 *
 * ROM: the segment mover in the centipede-motion block. Grounding: [code] — read from behaviour; the
 * cells it touches ($34/$44/$54/$63/$64/$74 slot fields, $00 frame counter, $97 edge flag, $ef/$f0
 * fold selectors, $94/$88 home-column probe) are bare zero-page placeholders.
 *
 * Live-out: mutates $34+X (phase), and via its handlers $44+X/$74+X (deltas), $64+X (coordinate),
 * $97 (edge flag); returns whatever the selected step handler returns.
 */
export function moveCentipedeSegment(m, x = m.regs.x) {
  const { mem8 } = m;

  // Retired slot: a phase with bit7 set marks a slot that is no longer an active body cell, so we
  // skip all motion and drop straight to the loop tail (which advances to the previous slot).
  // negative phase -> the wrap/decrement tail
  if ((mem8[u8(loc_34 + x)] & 0x80) !== 0) return advanceSegmentLoopIndex(m, x);

  // Motion is paced to the frame clock: only on even $00 frames do we bump this slot's phase counter.
  // Bit3 is force-cleared (& 0xf7) so the phase cycles inside a bounded field rather than running away.
  // even $00 frame: bump the phase, keeping bit3 clear
  if ((mem8[loc_00] & 0x01) === 0) {
    mem8[u8(loc_34 + x)] = u8(mem8[u8(loc_34 + x)] + 1) & 0xf7;
  }

  // Classify where in its cell the segment sits: fold the coordinate $64+X through the wave scramble
  // $f0 to get its position key. A key >= 9 is mid-cell (take the low 3 bits as the offset); a key < 9
  // is near a cell edge — and if the segment is still early in its phase (< 0x10) we raise the $97
  // edge flag, then take the raw low 3 bits of the coordinate as the offset instead.
  // classify the coordinate's low bits; near an edge below phase 0x10, flag $97
  const low = u8(mem8[u8(loc_64 + x)] ^ mem8[loc_f0]);
  let masked;
  if (low >= 0x09) {
    masked = low & 0x07;
  } else {
    if (mem8[u8(loc_34 + x)] < 0x10) mem8[loc_97] = 0x01;
    masked = mem8[u8(loc_64 + x)] & 0x07;
  }
  // A nonzero offset means the segment is mid-cell (not grid-aligned) -> defer the alignment decisions
  // and route through the edge resolver, which handles the "still travelling between cells" case.
  if (masked !== 0) return resolveEdgeExit(m, x);

  // Grid-aligned on the home column: when the home-column probe ($94 indexed by $88) reads 1, snap
  // both heading deltas back to a clean +/-2 (magnitude 2, keeping each one's current sign). This is
  // how a segment re-acquires a straight heading each time it re-crosses its home column.
  // on the home column, re-seed both heading deltas to +/-2 by their current sign
  if (mem8[loc_94 + mem8[loc_88]] === 0x01) {
    mem8[u8(loc_44 + x)] = mem8[u8(loc_44 + x)] & 0x80 ? 0xfe : 0x02;
    mem8[u8(loc_74 + x)] = mem8[u8(loc_74 + x)] & 0x80 ? 0xfe : 0x02;
  }

  // Phase bit6 selects a distance test: measure the signed gap between the reference field $63+X and
  // the live coordinate $64+X, fold it to a magnitude, and if that magnitude is >= 8 the segment has
  // drifted too far and must turn (edge resolver); otherwise it is in range and takes the plain step.
  // bit6 of the phase -> a distance check between $63+X and $64+X
  if ((mem8[u8(loc_34 + x)] & 0x40) !== 0) {
    const diff = u8(mem8[u8(loc_63 + x)] - mem8[u8(loc_64 + x)]);
    const mag = foldSignedMagnitude(m, diff, (diff & 0x80) !== 0);
    if (mag >= 0x08) return resolveEdgeExit(m, x);
    return advanceSegmentCoordAndArm(m, x);
  }

  // Phase bit5 is the "already committed to a turn" flag -> go straight to the edge resolver.
  // bit5 set -> straight to the edge handler
  if ((mem8[u8(loc_34 + x)] & 0x20) !== 0) return resolveEdgeExit(m, x);

  // Otherwise band-test the sub-coordinate $54+X against the two wall bands. In the high band (>=0xf0,
  // hard against one wall) the neighbour link $74+X and the heading sign decide between reversing,
  // turning, or probing ahead. The mid band (>=0x10) always probes the tile ahead. In the low band
  // (<0x10, the opposite wall), a set link with a positive heading turns, a set link with a negative
  // heading probes ahead, and a clear link reverses.
  const coord = mem8[u8(loc_54 + x)];
  if (coord >= 0xf0) {
    if (mem8[u8(loc_74 + x)] === 0) return reverseSegmentDeltaAndStepCoord(m, x);
    if ((mem8[u8(loc_44 + x)] & 0x80) === 0) return resolveEdgeExit(m, x);
    return probeAheadAndCollide(m, x);
  }
  if (coord >= 0x10) return probeAheadAndCollide(m, x);
  if (mem8[u8(loc_74 + x)] !== 0) {
    if ((mem8[u8(loc_44 + x)] & 0x80) !== 0) return resolveEdgeExit(m, x);
    return probeAheadAndCollide(m, x);
  }
  return reverseSegmentDeltaAndStepCoord(m, x);
}

// probeAheadAndCollide — look at the tile cell the segment is about to enter and decide whether the
// path is clear. An empty cell with no live column-neighbour lets the ordinary step run; a blocking
// cell, or a cell in the mushroom band (0x38..0x3b), diverts to the edge resolver — and a mushroom
// also latches phase bit5 so subsequent frames know the segment is committed to turning here. This is
// what makes the centipede bounce off mushrooms and walls instead of walking through them. [code]
function probeAheadAndCollide(m, x) {
  const { mem8 } = m;
  // Fetch the (Y-step, coordinate) inputs for this slot and resolve the tile cell they point at.
  const [yStep, aCoord] = loadObjectTileInputs(m, x);
  const [cell] = resolveTileCellAtXY(m, aCoord, yStep);
  if (cell !== 0) {
    // Non-empty tile: below the mushroom band it is a solid obstacle -> turn.
    if (cell < 0x38) return resolveEdgeExit(m, x);
    // At or above the top of the mushroom band it is likewise a wall -> turn.
    if (cell >= 0x3c) return resolveEdgeExit(m, x);
    mem8[u8(loc_34 + x)] |= 0x20; // in the mushroom band: mark bit5, then divert
    return resolveEdgeExit(m, x);
  }
  // Empty tile ahead: only take the plain step if no other segment shares this column right in front.
  if (!detectColumnCollision(m, x)) return advanceSegmentCoordAndArm(m, x); // clear ahead -> plain step
  return resolveEdgeExit(m, x);
}

// resolveEdgeExit — the edge/turn resolver. It classifies the segment against the wall using the sign
// of the vertical link $74+X, the direction selector $ef, and the folded coordinate keyed through
// $f0, then finishes through one of three tails: reverse-direction, direct-store, or negate-then-store.
// This is the routine that turns a "hit something" verdict into a concrete new heading. [code]
function resolveEdgeExit(m, x) {
  const { mem8 } = m;
  const v74 = mem8[u8(loc_74 + x)];
  const key = u8(mem8[u8(loc_64 + x)] ^ mem8[loc_f0]);
  // No vertical link -> a full direction reversal.
  if (v74 === 0) return reverseSegmentDeltaAndStepCoord(m, x);
  // Positive link (advancing away from the wall) -> the forward-edge branch.
  if ((v74 & 0x80) === 0) return resolveForwardEdge(m, x, key);
  // moving back toward the wall
  // Negative link (heading back toward the wall): $ef selects how the folded coordinate is judged.
  if (mem8[loc_ef] === 0) {
    if (key >= 0x30) return negateTailThenStore(m, x);
    return storeCoordAndStep(m, x);
  }
  const raw = u8(key ^ mem8[loc_f0]); // undo the fold -> the raw coordinate
  if (raw < 0xc9) return negateTailThenStore(m, x);
  return storeCoordAndStep(m, x);
}

// resolveForwardEdge — the forward-edge branch (segment advancing away from the wall). When the folded
// coordinate is low it walks the trailing neighbour slots to find one that should "fold back" — so the
// tail of the centipede snaps to the grid and reverses in step with the head — before committing to
// the turn. A high folded coordinate just stores and steps on. [code]
function resolveForwardEdge(m, x, key) {
  const { mem8 } = m;
  // Not near the fold boundary -> nothing special, store and continue.
  if (key >= 0x09) return storeCoordAndStep(m, x);
  // Distance-check slots turn immediately; others clear phase bit5 first.
  if ((mem8[u8(loc_34 + x)] & 0x40) !== 0) return negateTailThenStore(m, x);
  mem8[u8(loc_34 + x)] &= 0xdf; // clear bit5
  // The last slot has no trailing neighbour to fold, so it just turns.
  if (x === 0x0b) return negateTailThenStore(m, x);
  // Peek at the immediate trailing neighbour's phase: a retired (bit7) or non-distance (bit6 clear)
  // neighbour means there is nothing to fold behind us -> just turn.
  let y = u8(x + 1);
  const head = mem8[loc_34 + y];
  if ((head & 0x80) !== 0) return negateTailThenStore(m, x);
  if ((head & 0x40) === 0) return negateTailThenStore(m, x);
  // walk the trailing neighbour slots
  // Scan outward for the neighbour that terminates the run (the last slot, or a retired / non-distance
  // slot). That neighbour, if it is near the fold boundary, is snapped to the grid: its phase bits are
  // masked, its heading delta negated, its coordinate floored to the cell, and its link cleared — then
  // this segment turns. This is the body-follows-head fold propagating down the tail.
  while (true) {
    let foldHere = false;
    if (y === 0x0b) {
      foldHere = true;
    } else {
      const next = mem8[loc_35 + y];
      if ((next & 0x80) !== 0) foldHere = true;
      else if ((next & 0x40) === 0) foldHere = true;
    }
    if (foldHere) {
      const cell = u8(mem8[loc_64 + y] ^ mem8[loc_f0]);
      if (cell < 0x09) {
        mem8[loc_34 + y] &= 0x07;
        mem8[loc_44 + y] = negateA(m, mem8[loc_44 + y]);
        mem8[loc_64 + y] &= 0xf8;
        mem8[loc_74 + y] = 0x00;
      }
      return negateTailThenStore(m, x);
    }
    y = u8(y + 1);
    if (y >= 0x0c) return negateTailThenStore(m, x);
  }
}

// negateTailThenStore — reverse this segment's vertical delta ($74+X two's-complement negated) and
// then fall into the coordinate store. Used when the turn requires flipping the vertical component
// before the horizontal coordinate is committed. [code]
function negateTailThenStore(m, x) {
  const { mem8 } = m;
  mem8[u8(loc_74 + x)] = negateA(m, mem8[u8(loc_74 + x)]);
  return storeCoordAndStep(m, x);
}

// storeCoordAndStep — fold the vertical delta $74+X into the coordinate $64+X ($ef selects add vs.
// subtract, i.e. which way along the axis the step goes), leave the result in A, and hand it to the
// coordinate-store step handler. This is the ordinary "commit the new coordinate" tail. [code]
function storeCoordAndStep(m, x) {
  const { mem8 } = m;
  const base = mem8[u8(loc_64 + x)];
  const step = mem8[u8(loc_74 + x)];
  const out = mem8[loc_ef] !== 0 ? u8(base + step) : u8(base - step);
  return (m.regs.a = out), commitSegmentCoord(m, x);
}
