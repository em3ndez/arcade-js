// SPDX-License-Identifier: GPL-3.0-only
/**
 * recordHammerHitOnObject — test the wielded hammer's own hitbox against the board's hazards and,
 * on an overlap, record which object it struck.  ROM 0x281D.
 *
 * Scans the two-record hammer pair OBJ_PAIR_6680 for the record that is IN PLAY (bit0 of its
 * +0x01 HAMMER_IN_PLAY field set), stepping 0x10 bytes between the two. If neither is in play it
 * does nothing. When one is, that record's reference point AND ITS HITBOX are handed to the
 * current board's collision handler, which sweeps that board's hazard object arrays for one
 * overlapping the hammer.
 *
 * ★ THE OFFSET TRAP — what +0x09 / +0x0A actually are. An earlier version of this header called
 * record +9/+10 "the low/high position bytes". That is WRONG. recordPtr walks OBJ_PAIR_6680, so
 * every offset here belongs to the OBJECT-record namespace (SPRITE_BUFFER does not begin until
 * 0x6900, so the sprite-record field set is not in play at all). In that namespace +0x09 is
 * OBJ_HIT_EXTENT_X and +0x0A is OBJ_HIT_EXTENT_Y — the per-axis BASE TOLERANCES the search runs
 * with, not coordinates. The four things marshalled to the handler are:
 *
 *   IY = the record base          -> findCollidingObject's reference POINTER; its +3 is OBJ_X,
 *                                    the axis-2 reference coordinate
 *   C  = record OBJ_Y (+5)        -> the axis-1 reference coordinate
 *   H  = record OBJ_HIT_EXTENT_X  -> the axis-2 (X) base tolerance
 *   L  = record OBJ_HIT_EXTENT_Y  -> the axis-1 (Y) base tolerance
 *
 * Verified SEMANTICALLY, not numerically (the two extents can hold equal bytes, so agreeing values
 * would prove nothing): findCollidingObject's axis 1 compares a candidate record's +5 (OBJ_Y) and
 * falls back on +0x0A, and its axis 2 compares +3 (OBJ_X) and falls back on +0x09 — the axes agree
 * on both sides of the call.
 *
 * The correction STRENGTHENS the routine's story. driveHammerSprite stamps exactly these two
 * extents into the selected hammer record on every frame the hammer is in hand — 0x06/0x03 on the
 * main swing pose and 0x05/0x06 on the alternate pose — so the "tolerance" handed to the board
 * handler is the SWINGING HAMMER'S HITBOX, changing shape frame to frame with the swing. Each
 * hazard record the sweep visits then contributes its OWN +0x09/+0x0A as the extra span past that
 * base window, so the test is hammer-box against hazard-box.
 *
 * The handler reports a byte: 0 for no overlap (this routine then does nothing), or
 * nonzero for a hit. On a hit it records four things about the collided hazard:
 *   - the nonzero hit marker itself,
 *   - the index of the hit object within the sweep array that found it — the array's
 *     initial count (OBJ_SEARCH_COUNT, stamped by the handler) minus the count still
 *     left when the hit fired,
 *   - the low byte of that array's record stride,
 *   - the base address of that array.
 *
 * NAME (promoted from loc_281d, DK understanding pass 13 — independent proposer ≠ confirmer,
 * confidence HIGH). Every strand of the corroboration is OUTSIDE this routine:
 *   - WHAT IT SCANS is the hammer pair. MARIO_HAMMER_PENDING (0x6218, [seen]) describes itself as
 *     "a touched-but-not-yet-held hammer" and names ROM 0x295A as its writer — inside
 *     latchHammerTouch, the routine that SETS the very HAMMER_IN_PLAY bit this scan looks for.
 *     driveHammerSprite reads the same bit to pick which of the pair it animates in Mario's hands.
 *     And seedSpriteObjectPair, which activates the pair, is called from seed25mBoardObjects,
 *     seed50mBoardObjects and seed100mBoardObjects and from NO other board setup — the pair exists
 *     on exactly the boards that have hammers and not on 75m, DK's one hammer-free board.
 *   - WHAT CONSUMES THE RECORD is a closed reference chain: COLLIDED_OBJECT_BASE/STRIDE/INDEX have
 *     exactly one writer each (here) and exactly one reader each, all three inside
 *     buildEffectSprite (ROM 0x1EA0), which walks base + index*stride back to the struck record,
 *     clears its OBJ_ACTIVE (the hazard vanishes) and fires SND_PRIORITY = 6.
 *   - AN INDEPENDENT SUBSYSTEM agrees on the event: audio/README.md — produced by the audio
 *     hardware work, not by this decompile — lists priority tune 0x06 as `hammer_hit`, "hammer
 *     smashes a barrel/fireball". (That row is tagged INFERRED there, so it is corroboration, not
 *     proof.)
 * WHAT THE NAME DOES NOT CLAIM: not that this routine resolves the hit — it only RECORDS where the
 * struck object was found, and buildEffectSprite does the smash; not that the struck object is any
 * particular named DK hazard (grounding gets as far as COLLIDED_OBJECT_BASE = the OBJ_ARRAY_67 /
 * OBJ_ARRAY_64 bases, and no further); and not that Mario is already HOLDING the hammer, since
 * HAMMER_IN_PLAY is set at the touch and cleared only at expiry, so this also runs on the frames
 * between a touch and the hammer reaching his hands (buildPendingHammerSprite is stamping the same
 * extents at the same Mario-anchored position during that window).
 *
 * Memory-equivalent to the frozen oracle — equivalence-281d.test.js.
 * GATE:     captured — 0x281D is dispatched every frame by the object-update cascade
 *           (loc_197a, ROM 0x19B9). Real attract dispatches span all three arms: the
 *           no-active-record early-out, found-but-no-overlap, and the found+overlap
 *           record-writing path (all reached in attract). The full oracle board handler
 *           runs on BOTH sides, so a wrong marshalled field or a live register the folded
 *           call would have supplied surfaces as divergent RAM. The RAM diff excludes the
 *           dead STACK_SCRATCH the folded rst-0x28 trampoline (inside dispatchBoardCollision)
 *           leaves its table-base word in. Teeth: a twin that drops the hit-index subtraction
 *           and a twin that stores the wrong array base.
 * LIVE-OUT: memory-only. The caller (loc_197a) issues its next call without reading any
 *           register this leaves behind, so the residual registers/flags and the terminal
 *           return are dead ABI. pc/SP net from the handler's own return plus the routine's
 *           terminal return, so both are checked too.
 * NAMES:    OBJ_PAIR_6680 (0x6680) and OBJ_SEARCH_COUNT (0x63B9) from ram.js; the collision-hit
 *           record COLLIDED_OBJECT_INDEX (0x6354) / COLLIDED_OBJECT_STRIDE (0x6353) /
 *           COLLIDED_OBJECT_BASE (0x6351, 16-bit) from ram.js. The record-field offsets are all
 *           ram.js names too: HAMMER_IN_PLAY (+0x01 — SCOPED to this pair, see ram.js: +0x01
 *           carries unrelated roles on other records, so there is deliberately no generic OBJ_*
 *           name at that offset), OBJ_Y (+0x05), OBJ_HIT_EXTENT_X (+0x09), OBJ_HIT_EXTENT_Y
 *           (+0x0A). The 0x6350 hit marker stays hex because ram.js genuinely does not name it —
 *           the named collision group starts one byte later at COLLIDED_OBJECT_BASE (0x6351). It is
 *           SHARED with the effect-sequence gate: this routine is its only nonzero writer, loc_1e8c
 *           and loc_03a2 read it, and animateEffectSpriteThenRearmEffect's teardown is the only
 *           thing that clears it. The 0x283E return marker is a ROM code address, not work RAM.
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
} from "./ram.js";
import { dispatchBoardCollision } from "./dispatchBoardCollision.js"; // ROM 0x286F

// Stride between the two records of the hammer pair (0x6680 -> 0x6690).
const RECORD_STRIDE = 0x10;

// Return marker the board collision handler unwinds to. dispatchBoardCollision is
// idiomatic in form but still RUNS the frozen translated per-board handlers: it routes
// through loc_00ca, which reaches them by ROM address (m.call(0x2880/0x28B0/0x28E0/0x2901)).
// Their object search returns by popping the stack — on a hit via an inc-sp/inc-sp/ret
// caller-skip, on a miss via a normal ret. So this is a genuine oracle boundary: the handler
// needs a return address on the stack, and this routine must supply it exactly as the oracle
// call site does (its own push16). It is NOT a dissolvable call-return bracket — dropping it
// makes the handler pop the wrong word and unwind two bytes off.
//
// All four handlers and their shared search ARE now decompiled and named —
// search25mObjectOverlap (0x2880), search50mObjectOverlap (0x28B0), search75mObjectOverlap
// (0x28E0), search100mObjectOverlap (0x2901) and findCollidingObject (0x2913) — so the
// remaining dependency is not the decompile but the DISPATCH: this marker dissolves once
// dispatchBoardCollision calls those idiomatic handlers directly instead of vectoring through
// loc_00ca into the oracle. A ROM code address, kept hex.
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

  // Marshal the in-play hammer's reference point and hitbox into the registers the still-oracle
  // board handler reads: the record base (whose +3 = OBJ_X is the axis-2 reference), the axis-1
  // reference coordinate, and the two per-axis base tolerances — this swing pose's hammer box.
  regs.iy = recordPtr;
  regs.c = mem.read8(recordPtr + OBJ_Y);
  regs.h = mem.read8(recordPtr + OBJ_HIT_EXTENT_X); // axis-2 (X) base tolerance
  regs.l = mem.read8(recordPtr + OBJ_HIT_EXTENT_Y); // axis-1 (Y) base tolerance

  // Dispatch to the current board's collision handler. It leaves the hit/miss byte in A,
  // the sweep counter in B, the hit array's stride low byte in E, and the hit array's
  // base in IX.
  m.push16(HANDLER_RETURN);
  dispatchBoardCollision(m);

  // No overlap: nothing to record.
  const overlap = regs.a;
  if (overlap === 0) { m.ret(); return; }

  // Record the collided hazard: the marker, the hit's index within its sweep array
  // (array count minus the count still left when it fired), the array's stride low byte,
  // and the array's base.
  // 0x6350 — the hit-effect latch, genuinely unnamed in ram.js (the named collision group starts
  // one byte later, at COLLIDED_OBJECT_BASE 0x6351). Whole-ROM scan: written ONLY here (always
  // nonzero — the `and a / ret z` two instructions earlier guarantees it), read by loc_1e8c and
  // loc_03a2, and cleared only by animateEffectSpriteThenRearmEffect's teardown. Setting it here
  // suspends gameplay from the NEXT frame until that teardown reopens the gate.
  mem.write8(0x6350, overlap);
  mem.write8(COLLIDED_OBJECT_INDEX, mem.read8(OBJ_SEARCH_COUNT) - regs.b);
  mem.write8(COLLIDED_OBJECT_STRIDE, regs.e);
  mem.write16(COLLIDED_OBJECT_BASE, regs.ix);
  m.ret();
}
