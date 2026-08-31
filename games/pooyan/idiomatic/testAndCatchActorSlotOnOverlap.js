// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { precheckCollisionBounds } from "./precheckCollisionBounds.js";
import { advanceActorSweepToNextSlot } from "./advanceActorSweepToNextSlot.js";
import { queueHitSound } from "./queueHitSound.js";
import { fillByteRun } from "./fillByteRun.js";
import { STRUCK_TARGET_LATCH } from "./names.js";
/**
 * testAndCatchActorSlotOnOverlap — one iteration of the actor-sweep loop body.
 *
 * WHAT IT IS
 * ----------
 * The body of a counted loop that hunts for a collision. Once per frame, on odd rounds,
 * the actor updater walks the enemy/actor records looking for any that overlap the
 * current target box; this routine is the per-slot test at the heart of that walk. It
 * decides one thing for one slot: does this actor sit close enough to the target to
 * count as caught? If so it catches it and plays the hit sound; if not it hands to the
 * loop tail, which steps the cursors to the next slot and comes back here.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * Collision. The odd-round overlap sweep is a small chain of routines:
 *     sweepActorRecordSlotsBothParitiesOnOddRound (the gated driver)
 *       -> dispatchTargetPairCollisionSweep       (one parity pair)
 *         -> testAndCatchActorSlotOnOverlap        (ROM 0x5ebd, this loop BODY)
 *           -> advanceActorSweepToNextSlot         (the loop TAIL, advance + count)
 * The body screens a slot through a cascade of cheap rejections (empty, busy,
 * off-screen, horizontally too far, vertically too far); the first one that fires
 * hands straight to the tail so the sweep moves on. Only a slot that survives every
 * gate is a genuine overlap, and that slot is "caught": its record header is torn down
 * so it stops acting, the shot's struck target is wiped, and the hit sound is queued.
 *
 * ROM 0x5ebd-0x5f01.
 * Grounding: [seen].
 *
 * The three record pointers it works with, all handed in from the sweep driver:
 *   hl -> the actor slot's own record: byte +0 is a lead/presence byte (0 == empty),
 *         byte +2 is a state byte (>= 0x04 == busy, mid-action, not catchable).
 *   ix -> the same actor's stride-4 coordinate record in the sprite display list;
 *         precheckCollisionBounds reads its X (+0) and Y (+2) and biases them.
 *   iy -> the target box being tested against: byte +0 is the target centre X, byte
 *         +2 its centre Y.
 *
 * LIVE-OUT: memory only. On a catch it leaves the slot torn down (lead 0, then 01/08
 * in the two following bytes), the struck target's record zero-filled, and the hit
 * request appended to the sound ring. The loop cursors it forwards to the tail are
 * dead — the tail re-derives its own advance from them and nothing reads them back here.
 */

// Actor state byte (record +2) at or above this counts as busy: the actor is already
// mid-action (being caught, animating a catch) and must not be caught again this pass.
const STATE_LIMIT = 0x04; // slot state byte >= this -> busy, skip
// Horizontal catch window: |target X - actor X| must be strictly under this to count.
const DX_LIMIT = 0x0a;
// Vertical catch window: |target Y (margined) - actor Y| must be strictly under this.
const DY_LIMIT = 0x09;
// Fixed downward nudge added to the target's centre Y before the vertical compare, so
// the catch box sits a little below the target centre where the actor is grabbed.
const Y_MARGIN = 0x08;
// Offset of the struck target's flag byte; its bit0, when set, means the target has
// already been consumed this frame and its record must be left intact (skip the wipe).
const TARGET_FLAG_OFFSET = 0x07; // struck target flag byte; bit0 set -> skip the fill
// Length of the struck-target record wiped on a fresh catch: 0x17 bytes zeroed from the
// target's base, tearing down its whole record so it stops being drawn or scanned.
const TARGET_FILL_LEN = 0x17; // bytes zeroed at the struck target

/** Absolute value of an 8-bit subtraction result given whether the subtract borrowed. */
function absDiff(raw, borrow) {
  // The hardware subtract sets a borrow (carry) when the minuend was smaller; in that
  // case the raw byte result is the negative wrapped into 8 bits, so negate it back to
  // the positive magnitude. With no borrow the raw result is already the magnitude.
  return borrow ? (-raw) & 0xff : raw;
}

export function testAndCatchActorSlotOnOverlap(m, hl = m.regs.hl, ix = m.regs.ix, iy = m.regs.iy, count = m.regs.b) {
  const { mem8, mem16 } = m;

  // Gate 1 — empty slot. The record's lead byte (hl+0) is 0 when no actor occupies this
  // slot; there is nothing to test, so hand straight to the loop tail.
  if (mem8[hl] === 0) return advanceActorSweepToNextSlot(m, hl, ix, count, iy); // empty slot
  // Gate 2 — busy slot. The state byte (hl+2) at or past STATE_LIMIT means the actor is
  // already mid-action and cannot be caught again; skip it.
  if (mem8[u16(hl + 2)] >= STATE_LIMIT) return advanceActorSweepToNextSlot(m, hl, ix, count, iy); // busy slot

  // Gate 3 — on-screen check. precheckCollisionBounds (ROM 0x5f53) reads the actor's
  // coordinate record at ix, biases its X by the screen orientation (FLIP_SCREEN_FLAG
  // at 0x881f) and adds a fixed margin to its Y, then reports whether that Y still clears
  // the bottom of the visible field. e = biased X, y = margined Y, onScreen = the gate.
  const [e, y, onScreen] = precheckCollisionBounds(m, ix);
  // An actor that has dropped off the bottom of the field cannot collide; skip it.
  if (!onScreen) return advanceActorSweepToNextSlot(m, hl, ix, count, iy); // off-screen

  // Gate 4 — horizontal proximity. Compare the target's centre X (target record iy+0)
  // against the actor's biased X and take the absolute gap; the subtract's borrow tells
  // absDiff which side was larger so it can recover the magnitude.
  const dx = absDiff((mem8[iy] - e) & 0xff, mem8[iy] < e);
  // Reject the moment the horizontal gap reaches the catch window's width.
  if (dx >= DX_LIMIT) return advanceActorSweepToNextSlot(m, hl, ix, count, iy); // horizontal gap too wide

  // Gate 5 — vertical proximity. Take the target's centre Y (target record iy+2), nudge
  // it down by the fixed catch margin, and compare against the actor's margined Y; again
  // absDiff turns the borrow-flagged subtraction into an absolute gap.
  const yTarget = (mem8[iy + 2] + Y_MARGIN) & 0xff;
  const dy = absDiff((yTarget - y) & 0xff, yTarget < y);
  // Reject the moment the vertical gap reaches the catch window's height.
  if (dy >= DY_LIMIT) return advanceActorSweepToNextSlot(m, hl, ix, count, iy); // vertical gap too wide

  // Hit: catch the slot.
  // The actor cleared every gate, so it overlaps the target. Tear down its record header
  // in place: clear the lead byte (hl+0), then stamp 01 into hl+1 and 08 into hl+2. The
  // 01/08 pair puts the record into its "caught" state so downstream passes animate the
  // capture instead of treating it as a live threat.
  mem8[hl] = 0x00;
  mem8[u16(hl + 1)] = 0x01;
  mem8[u16(hl + 2)] = 0x08;

  // Reload the target that was struck. STRUCK_TARGET_LATCH (0x8d65) holds the pointer to
  // the target record the collision resolved against; read it as a 16-bit address.
  const target = mem16[STRUCK_TARGET_LATCH];
  // Wipe the struck target's record — but only if its flag byte (+0x07) bit0 is clear.
  // A set bit0 means this target was already consumed this frame, so its record must be
  // left standing; otherwise zero its whole 0x17-byte record so it stops being drawn or
  // scanned.
  if ((mem8[u16(target + TARGET_FLAG_OFFSET)] & 0x01) === 0) {
    fillByteRun(m, target, 0x00, TARGET_FILL_LEN); // zero-fill the struck target record
  }
  // Queue the collision "hit" sound effect and return. queueHitSound (ROM 0x5f02) drops
  // the fixed hit command into the sound-command ring for the audio processor to play.
  return queueHitSound(m); // hit-sound enqueue
}
