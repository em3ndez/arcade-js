// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_34, loc_35, loc_54, loc_61, loc_62, loc_64, loc_71, loc_72, loc_73,
  loc_80, loc_8b, loc_8d, loc_9f, loc_a1, loc_d7, loc_ef, loc_f0,
  SFX_TIMER_CH4,
} from "./names.js";
import { foldSignedMagnitude } from "./foldSignedMagnitude.js";
import { loadObjectTileInputs } from "./loadObjectTileInputs.js";
import { resolveTileCellAtXY } from "./resolveTileCellAtXY.js";
import { decrementActiveObjectDelay } from "./decrementActiveObjectDelay.js";
import { stampEmptyTileCell } from "./stampEmptyTileCell.js";
import { loc_3037 } from "./loc_3037.js";
import { loc_303e } from "./loc_303e.js";
import { loc_3046 } from "./loc_3046.js";
import { advanceSegmentSlotLoop } from "./advanceSegmentSlotLoop.js";

/**
 * routeSegmentByRange -- the per-slot decision hub of the centipede segment sweep: it
 * range-tests one segment slot against the head/reference point and routes it to the
 * one handler its class and proximity call for.
 *
 * ROLE IN THE MACHINE: the centipede is stored as a chain of segment slots. Each frame
 * a sweep walks the slots; for every slot this routine decides "is this slot close
 * enough (and of the right kind) to act on now, or do we move on to the next slot?".
 * The parallel object arrays are the usual Centipede layout: a coordinate/attribute
 * byte at $34+slot (ROM 0x0034), a heading byte at $35+slot (ROM 0x0035), a fine row
 * at $54+slot (ROM 0x0054), and a column at $64+slot (ROM 0x0064). The head/reference
 * position lives in $72 (ROM 0x0072, horizontal) and $62 (ROM 0x0062, vertical), with
 * $f0 (ROM 0x00f0) and $ef (ROM 0x00ef) as the fold/direction selectors. Slot indices
 * carry meaning: 0x0d is the ballistic (shot) slot, 0x0c the active head slot, and
 * anything below 0x0c a trailing body slot. Behaviour-derived. [code]
 *
 * MECHANISM overview: a coarse X-band gate rejects slots whose coordinate is in a dead
 * zone; a folded horizontal distance to the head rejects slots too far away; then a
 * folded vertical distance is measured and the slot is dispatched by class -- trailing
 * body slots tick their delay and redraw, the head slot steers a collision or bumps a
 * shared limit, and the ballistic slot runs finishBallistic. Every "too far / wrong
 * band" outcome funnels to advanceSegmentSlotLoop, which steps to the next slot (or
 * ends the sweep). "Folded" throughout means the signed delta is reduced to a
 * magnitude via foldSignedMagnitude so a single "< window" compare works either way.
 *
 * LIVE-OUT: whatever the chosen handler returns; direct RAM writes happen only in the
 * trailing-slot and head-slot branches (noted inline).
 */
export function routeSegmentByRange(m, x = m.regs.x) {
  const { mem8 } = m;

  // Coarse X-band gate on the slot coordinate.
  // Only coordinates in the low run (< 0x76) or the high run (0xb9..0xf7) are eligible;
  // the gap between is the off-field dead zone, so those slots are punted to the next one.
  const coord = mem8[(loc_34 + x) & 0xff];
  if (!(coord < 0x76 || (coord >= 0xb9 && coord < 0xf8))) return advanceSegmentSlotLoop(m, x); // next slot

  // Folded horizontal distance to the head; too far and this slot is skipped.
  // First an XOR-fold of the slot column against $f0 acts as a cheap "very far" reject
  // (>= 0xf8), then the true signed distance to $72 is folded to a magnitude in y.
  const h = mem8[(loc_64 + x) & 0xff] ^ mem8[loc_f0];
  if (h >= 0xf8) return advanceSegmentSlotLoop(m, x); // next slot
  const dx = u8(mem8[(loc_64 + x) & 0xff] - mem8[loc_72]);
  let y = foldSignedMagnitude(m, dx, (dx & 0x80) !== 0);

  // The active head slot ($0c) has extra near/wide gates that can skip the tighter y-window test.
  // When the head is both near (its attribute XOR $ef under 0x20) and the column limit is
  // wide open, a looser y-window (0x07) applies and the standard 0x05 window is bypassed.
  let viaWindow = true;
  if (x === 0x0c) {
    const near = (mem8[(loc_34 + x) & 0xff] ^ mem8[loc_ef]) < 0x20;
    const wide = (mem8[loc_80] ^ mem8[loc_f0]) >= 0x04;
    if (near && wide) {
      if (y >= 0x07) return advanceSegmentSlotLoop(m, x); // next slot
      viaWindow = false;
    }
  }
  // Standard horizontal window: unless a head-slot special above waived it, a magnitude
  // of 5 or more is out of range for this pass -> advance to the next slot.
  if (viaWindow && y >= 0x05) return advanceSegmentSlotLoop(m, x); // next slot

  // Folded vertical distance, then dispatch by slot class.
  // Reuse y for the vertical magnitude: signed row distance from $54+x to the reference $62.
  const dy = u8(mem8[(loc_54 + x) & 0xff] - mem8[loc_62]);
  y = foldSignedMagnitude(m, dy, (dy & 0x80) !== 0);

  // Slot 0x0d is the ballistic (shot) slot: a slightly wider vertical window (0x0a),
  // and on a hit it runs the shot-origin finish rather than a segment move.
  if (x === 0x0d) {
    if (y >= 0x0a) return advanceSegmentSlotLoop(m, x); // next slot
    return finishBallistic(m, y);
  }

  if (x < 0x0c) {
    // Trailing slot: tick the delay, clear a heading bit, resolve/stamp its cell, then redraw.
    // Tight vertical window (0x06); in range, this body segment takes a step this frame.
    if (y >= 0x06) return advanceSegmentSlotLoop(m, x); // next slot
    // $8b is the step-select scratch. Bit 6 of the slot's attribute picks the advance
    // step: set -> a full 0x10 step; clear -> 0x00 step but $8b is bumped (a phase tick).
    mem8[loc_8b] = 0x00;
    let step = 0x10;
    if ((mem8[(loc_34 + x) & 0xff] & 0x40) === 0) {
      step = 0x00;
      mem8[loc_8b] = u8(mem8[loc_8b] + 1);
    }
    decrementActiveObjectDelay(m, x, step); // pass the step into the delay/advance spine explicitly
    // Clear the "turned" heading bit (0x40) for every trailing slot except the last body
    // slot 0x0b, and only when the slot is not already flagged (heading bit 7 clear).
    if (x !== 0x0b && (mem8[(loc_35 + x) & 0xff] & 0x80) === 0) {
      mem8[(loc_35 + x) & 0xff] = mem8[(loc_35 + x) & 0xff] & 0xbf;
    }
    // Resolve this slot's grid cell and blank it (the segment is leaving that square),
    // recording the slot in $8d so the redraw tail knows which one moved.
    loadObjectTileInputs(m, x);
    resolveTileCellAtXY(m);
    mem8[loc_8d] = x;
    stampEmptyTileCell(m);
    return loc_303e(m, mem8[loc_8d]);
  }

  // Head slot ($0c): steer a nearby collision or bump the shared column limit.
  // "Near" = attribute XOR $ef under 0x20; near-and-in-range the head reacts to a
  // collision, otherwise it widens the shared column limit $80 (ROM 0x0080) to 0x04.
  if ((mem8[(loc_34 + x) & 0xff] ^ mem8[loc_ef]) < 0x20) {
    if (y >= 0x06) return advanceSegmentSlotLoop(m, x); // next slot
    if (mem8[loc_80] !== 0x04) {
      mem8[loc_80] = 0x04;
      return loc_3046(m);
    }
    return loc_3037(m, 0x02);
  }
  // Far head slot: a wider vertical window (0x0a); in range it seeds the mover with a
  // full 0x10 step rather than the near-collision's 0x02.
  if (y >= 0x0a) return advanceSegmentSlotLoop(m, x); // next slot
  return loc_3037(m, 0x10);
}

// The ballistic (last) slot finish: this runs when the shot slot 0x0d is in range.
// It seeds the shot-origin redraw index $d7 (ROM 0x00d7), tri-states that index by how
// far the shot was fired, arms the two sweep cells $9f/$a1 (ROM 0x009f/0x00a1), silences
// the channel-4 SFX timer, and clamps the shared vertical limit $61 (ROM 0x0061) into
// [0x10, 0xf0] before handing off to the mover seed. [code]
function finishBallistic(m, y) {
  const { mem8 } = m;
  // Base redraw index; the fired distance (folded magnitude of $71 - $73) will bump it.
  mem8[loc_d7] = 0xb6;
  const d = u8(mem8[loc_71] - mem8[loc_73]);
  const dist = foldSignedMagnitude(m, d, (d & 0x80) !== 0);
  // Tri-state the redraw index and mover step by distance band: far (>=0x40) keeps the
  // base index and step 0x03; near (<0x40) bumps once (step 0x09); very near (>=0x16
  // within that) bumps a second time (step 0x06) -- a closer shot draws a longer trail.
  let step = 0x03;
  if (dist < 0x40) {
    mem8[loc_d7] = u8(mem8[loc_d7] + 1);
    step = 0x09;
    if (dist >= 0x16) {
      mem8[loc_d7] = u8(mem8[loc_d7] + 1);
      step = 0x06;
    }
  }
  // Arm the two sweep cells to 0x80 and silence the channel-4 SFX timer for this shot.
  mem8[loc_9f] = 0x80;
  mem8[loc_a1] = 0x80;
  mem8[SFX_TIMER_CH4] = 0x00;
  // Clamp the shared vertical limit $61 into [0x10, 0xf0]: values already inside the
  // band pass straight to the mover; an over-high value snaps to 0xf0, an under-low to 0x10.
  if (0xf0 >= mem8[loc_61]) {
    if (0x10 < mem8[loc_61]) return loc_3037(m, step);
    mem8[loc_61] = 0x10;
  } else {
    mem8[loc_61] = 0xf0;
  }
  return loc_3037(m, step);
}
