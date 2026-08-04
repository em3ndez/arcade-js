// SPDX-License-Identifier: GPL-3.0-only
/**
 * recordHammerHitOnObject — test the wielded hammer's own hitbox against the board's hazards and,
 * on an overlap, record which object it struck.
 *
 * It scans the two-record hammer pair for the record that is IN PLAY (bit 0 of its HAMMER_IN_PLAY
 * field set), stepping one record stride between the two. If neither is in play it does nothing.
 * When one is, that record's reference point AND ITS HITBOX go to the current board's collision
 * handler, which sweeps that board's hazard-object arrays for one that overlaps the hammer.
 *
 * THE HITBOX IS A PAIR OF TOLERANCES, NOT A SECOND POSITION — the offset trap in this routine.
 * Everything read here is walked off the hammer pair, so every offset belongs to the OBJECT-record
 * layout, in which OBJ_HIT_EXTENT_X and OBJ_HIT_EXTENT_Y are per-axis BASE TOLERANCES rather than
 * coordinates. Reading them as a low/high position pair is wrong. Four things are handed over:
 *
 *   the record base          -> the search's reference POINTER; the record's OBJ_X read off it is
 *                               the X reference coordinate
 *   the record's OBJ_Y       -> the Y reference coordinate
 *   OBJ_HIT_EXTENT_X         -> the X base tolerance
 *   OBJ_HIT_EXTENT_Y         -> the Y base tolerance
 *
 * Those two extents are re-stamped into the in-play hammer record on every frame the hammer is in
 * hand, and they hold different values for the different swing poses — so the box handed to the
 * board handler is the SWINGING HAMMER'S, changing shape frame to frame with the swing. Each
 * hazard record the sweep visits then contributes its own extent pair as the extra span past that
 * base window, which makes the test hammer-box against hazard-box.
 *
 * The handler reports a byte: 0 for no overlap (this routine then does nothing), or nonzero for a
 * hit. On a hit it records four things about the collided hazard:
 *   - the nonzero hit marker itself,
 *   - the index of the hit object within the sweep array that found it — the array's initial
 *     count, which the handler stamps into OBJ_SEARCH_COUNT, minus the count still left when the
 *     hit fired,
 *   - the low byte of that array's record stride,
 *   - the base address of that array.
 *
 * WHAT THE NAME DOES NOT CLAIM: not that this routine resolves the hit — it only RECORDS where the
 * struck object was found, and the smash happens a step later; not that the struck object is any
 * particular named hazard, since what gets recorded reaches only as far as which array it sat in;
 * and not that Mario is already HOLDING the hammer, because the in-play bit is set the moment he
 * touches one and cleared only at expiry, so this also runs on the frames between the touch and
 * the hammer reaching his hands.
 *
 * LIVE-OUT: memory-only.
 */

import {
  OBJ_PAIR_6680,
  OBJ_SEARCH_COUNT,
  OBJ_Y,
  OBJ_HIT_EXTENT_X,
  OBJ_HIT_EXTENT_Y,
  HAMMER_IN_PLAY,
  COLLIDED_OBJECT_BASE,
  COLLIDED_OBJECT_STRIDE,
  COLLIDED_OBJECT_INDEX,
} from "./names.js";
import { dispatchBoardCollision } from "./dispatchBoardCollision.js";

// Stride between the two records of the hammer pair.
const RECORD_STRIDE = 0x10;

// Return marker the board collision handler unwinds to. Its object search returns by popping the
// stack — on a hit through a caller-skip that steps two bytes past the return, on a miss through
// a plain return — so it needs a return address sitting there and this routine puts one there.
// The push is load-bearing, not a call/return bracket that could be dropped: without it the
// handler pops the wrong word and unwinds two bytes off.
const HANDLER_RETURN = 0x283e;

export function recordHammerHitOnObject(m) {
  const { regs, mem } = m;

  // Find the pair's in-play record (bit0 of its HAMMER_IN_PLAY flag byte set).
  let recordPtr = OBJ_PAIR_6680;
  let active = false;
  for (let i = 0; i < 2; i++) {
    if ((mem.read8(recordPtr + HAMMER_IN_PLAY) & 0x01) !== 0) { active = true; break; }
    recordPtr += RECORD_STRIDE;
  }
  if (!active) { m.ret(); return; }

  // Hand the in-play hammer's reference point and hitbox to the board collision handler, which
  // takes them in registers: the record base (whose OBJ_X is the X reference), the Y reference
  // coordinate, and the two per-axis base tolerances — this swing pose's hammer box.
  regs.iy = recordPtr;
  regs.c = mem.read8(recordPtr + OBJ_Y);
  regs.h = mem.read8(recordPtr + OBJ_HIT_EXTENT_X); // X base tolerance
  regs.l = mem.read8(recordPtr + OBJ_HIT_EXTENT_Y); // Y base tolerance

  // Dispatch to the current board's collision handler. It reports back the hit/miss byte, the
  // sweep count still left, the hit array's stride low byte, and the hit array's base.
  m.push16(HANDLER_RETURN);
  dispatchBoardCollision(m);

  // No overlap: nothing to record.
  const overlap = regs.a;
  if (overlap === 0) { m.ret(); return; }

  // Record the collided hazard: the marker, the hit's index within its sweep array
  // (array count minus the count still left when it fired), the array's stride low byte,
  // and the array's base.
  // The hit-effect latch. It carries no shared name — the named collision group starts one byte
  // later. It is always written NONZERO here, since the no-overlap early-out just above has
  // already returned for a zero, and setting it suspends gameplay from the NEXT frame until the
  // effect sequence's teardown clears it again.
  mem.write8(0x6350, overlap);
  mem.write8(COLLIDED_OBJECT_INDEX, mem.read8(OBJ_SEARCH_COUNT) - regs.b);
  mem.write8(COLLIDED_OBJECT_STRIDE, regs.e);
  mem.write16(COLLIDED_OBJECT_BASE, regs.ix);
  m.ret();
}
