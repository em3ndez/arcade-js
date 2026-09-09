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
 * moveCentipedeSegment — advance one centipede segment (slot X) by one motion step. Reads the phase
 * byte $34+X (a negative phase hands straight to the wrap/dec tail), advances it on even $00 frames,
 * re-seeds the $44/$74 heading deltas when the segment sits on its home column, then runs the wall /
 * edge / neighbour tests that pick which step handler continues the walk. Every exit is a tail
 * transfer to one of the sibling step handlers; the ordinary finish routes through the
 * coordinate-store handler carrying the new coordinate. [code]
 */
export function moveCentipedeSegment(m, x = m.regs.x) {
  const { mem8 } = m;
  // negative phase -> the wrap/decrement tail
  if ((mem8[u8(loc_34 + x)] & 0x80) !== 0) return advanceSegmentLoopIndex(m, x);
  // even $00 frame: bump the phase, keeping bit3 clear
  if ((mem8[loc_00] & 0x01) === 0) {
    mem8[u8(loc_34 + x)] = u8(mem8[u8(loc_34 + x)] + 1) & 0xf7;
  }
  // classify the coordinate's low bits; near an edge below phase 0x10, flag $97
  const low = u8(mem8[u8(loc_64 + x)] ^ mem8[loc_f0]);
  let masked;
  if (low >= 0x09) {
    masked = low & 0x07;
  } else {
    if (mem8[u8(loc_34 + x)] < 0x10) mem8[loc_97] = 0x01;
    masked = mem8[u8(loc_64 + x)] & 0x07;
  }
  if (masked !== 0) return resolveEdgeExit(m, x);
  // on the home column, re-seed both heading deltas to +/-2 by their current sign
  if (mem8[loc_94 + mem8[loc_88]] === 0x01) {
    mem8[u8(loc_44 + x)] = mem8[u8(loc_44 + x)] & 0x80 ? 0xfe : 0x02;
    mem8[u8(loc_74 + x)] = mem8[u8(loc_74 + x)] & 0x80 ? 0xfe : 0x02;
  }
  // bit6 of the phase -> a distance check between $63+X and $64+X
  if ((mem8[u8(loc_34 + x)] & 0x40) !== 0) {
    const diff = u8(mem8[u8(loc_63 + x)] - mem8[u8(loc_64 + x)]);
    const mag = foldSignedMagnitude(m, diff, (diff & 0x80) !== 0);
    if (mag >= 0x08) return resolveEdgeExit(m, x);
    return advanceSegmentCoordAndArm(m, x);
  }
  // bit5 set -> straight to the edge handler
  if ((mem8[u8(loc_34 + x)] & 0x20) !== 0) return resolveEdgeExit(m, x);
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

// Probe the tile cell ahead of the segment; an empty cell with no column neighbour keeps the plain
// step, a blocking/marked cell diverts to the edge handler. [code]
function probeAheadAndCollide(m, x) {
  const { mem8 } = m;
  const [yStep, aCoord] = loadObjectTileInputs(m, x);
  const [cell] = resolveTileCellAtXY(m, aCoord, yStep);
  if (cell !== 0) {
    if (cell < 0x38) return resolveEdgeExit(m, x);
    if (cell >= 0x3c) return resolveEdgeExit(m, x);
    mem8[u8(loc_34 + x)] |= 0x20; // in the mushroom band: mark bit5, then divert
    return resolveEdgeExit(m, x);
  }
  if (!detectColumnCollision(m, x)) return advanceSegmentCoordAndArm(m, x); // clear ahead -> plain step
  return resolveEdgeExit(m, x);
}

// The edge/turn resolver: classify the segment against the wall via $74+X sign, $ef and the folded
// coordinate, then finish through the negate-then-store tail, the direct store tail, or the wrap
// handler. [code]
function resolveEdgeExit(m, x) {
  const { mem8 } = m;
  const v74 = mem8[u8(loc_74 + x)];
  const key = u8(mem8[u8(loc_64 + x)] ^ mem8[loc_f0]);
  if (v74 === 0) return reverseSegmentDeltaAndStepCoord(m, x);
  if ((v74 & 0x80) === 0) return resolveForwardEdge(m, x, key);
  // moving back toward the wall
  if (mem8[loc_ef] === 0) {
    if (key >= 0x30) return negateTailThenStore(m, x);
    return storeCoordAndStep(m, x);
  }
  const raw = u8(key ^ mem8[loc_f0]); // undo the fold -> the raw coordinate
  if (raw < 0xc9) return negateTailThenStore(m, x);
  return storeCoordAndStep(m, x);
}

// The forward-edge branch (segment advancing away from the wall): a low folded coordinate walks the
// trailing neighbour slots looking for one to fold back before turning. [code]
function resolveForwardEdge(m, x, key) {
  const { mem8 } = m;
  if (key >= 0x09) return storeCoordAndStep(m, x);
  if ((mem8[u8(loc_34 + x)] & 0x40) !== 0) return negateTailThenStore(m, x);
  mem8[u8(loc_34 + x)] &= 0xdf; // clear bit5
  if (x === 0x0b) return negateTailThenStore(m, x);
  let y = u8(x + 1);
  const head = mem8[loc_34 + y];
  if ((head & 0x80) !== 0) return negateTailThenStore(m, x);
  if ((head & 0x40) === 0) return negateTailThenStore(m, x);
  // walk the trailing neighbour slots
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

// Negate $74+X (reverse the vertical delta) before the coordinate store. [code]
function negateTailThenStore(m, x) {
  const { mem8 } = m;
  mem8[u8(loc_74 + x)] = negateA(m, mem8[u8(loc_74 + x)]);
  return storeCoordAndStep(m, x);
}

// Fold $74+X into the $64+X coordinate ($ef selects add vs subtract) and hand the result, in A, to
// the coordinate-store step handler. [code]
function storeCoordAndStep(m, x) {
  const { mem8 } = m;
  const base = mem8[u8(loc_64 + x)];
  const step = mem8[u8(loc_74 + x)];
  const out = mem8[loc_ef] !== 0 ? u8(base + step) : u8(base - step);
  return (m.regs.a = out), commitSegmentCoord(m, x);
}
