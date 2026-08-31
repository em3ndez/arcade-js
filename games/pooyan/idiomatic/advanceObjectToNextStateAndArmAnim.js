// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { ANIM_PARAM_68EF } from "./names.js";

// ---------------------------------------------------------------------------
// Record field offsets (bytes from the record base).
//
// The object this routine drives is one entry in the enemy actor table, a
// fixed-layout block of work-RAM bytes. dispatchSpecialObjectRecordState reads
// the record's +0x02 phase byte to pick which per-frame handler runs; this
// routine is the phase-0 (arrive/arm) handler, and its job is to reseed the
// record so the phase-1 handler (advanceObjectAscentStep) can march it up the
// screen on every following frame.
//
// Two of these offsets are the record's on-screen coordinate bytes: the sprite
// display list is rebuilt each frame from the records, taking +0x04 as the X
// byte and +0x06 as the Y byte. The paired low bytes just below them (+0x03,
// +0x05) are the fractional halves of a fixed-point position, so +0x03:+0x04 is
// the sub-pixel X and +0x05:+0x06 is the sub-pixel Y. +0x09 holds the per-frame
// ascent step that phase 1 subtracts out of that Y position.
// ---------------------------------------------------------------------------
const PHASE_FIELD = 0x02; // record phase byte: the state selector the dispatcher switches on; bumped to hand the object to the next phase's handler
const SUBPOS_A = 0x03; // sub-position field cleared to zero: fractional (low) byte of the fixed-point X position, reset so motion starts on a whole pixel
const SUBPOS_B = 0x05; // sub-position field cleared to zero: fractional (low) byte of the fixed-point Y position, reset so the ascent starts on a whole pixel
const FIELD_04 = 0x04; // seated to 0x08: the record's X display byte (horizontal screen position), fixed here for the ascent
const FIELD_06 = 0x06; // seated to 0x1e: the record's Y display byte (starting row) that the ascent handler walks upward toward its arrival threshold
const FIELD_09 = 0x09; // seated to 0x18 after the animation is armed: the per-frame ascent step subtracted out of the Y position by the next phase

/**
 * advanceObjectToNextStateAndArmAnim — advance an object to its next state: bump the phase, zero its two sub-position
 * fields, seat two fixed field values, arm its animation from the state parameter block,
 * then seat one more field.
 *
 * WHAT IT IS: the phase-0 (arrive-and-arm) handler for a special object record living in the
 * enemy actor table. The record's +0x02 byte is a small state machine that
 * dispatchSpecialObjectRecordState switches on each frame; while that byte reads 0 this routine
 * runs, and its whole purpose is to prime the record for the ascent that follows and then hand
 * the object off to phase 1.
 *
 * ROLE IN THE MACHINE: it is the setup step of a rising object. It plants the object's screen
 * position, points it at its ascent animation, seats the climb speed, and advances the phase so
 * that from the very next frame advanceObjectAscentStep (phase 1) takes over — subtracting the
 * step it seeds here out of the Y position until the object reaches the top of its travel.
 *
 * ROM: 0x683a.  GROUNDING: [seen].
 *
 * LIVE-OUT: memory only — the record fields and its animation pointer. Concretely: the bumped
 * +0x02 phase, the cleared +0x03/+0x05 fractional bytes, the seated +0x04/+0x06 coordinates and
 * +0x09 ascent step, plus the animation-sequence pointer and frame index written by
 * setActorAnimation.
 */
export function advanceObjectToNextStateAndArmAnim(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Advance the object to its next state. +0x02 is the phase byte the dispatcher
  // switches on; incrementing it from 0 to 1 means the following frame is routed
  // to the phase-1 handler (advanceObjectAscentStep) instead of back here, so
  // this arm step runs exactly once.
  mem8[rec + PHASE_FIELD] = mem8[rec + PHASE_FIELD] + 1;

  // Clear the two fractional sub-position bytes so the fixed-point X (+0x03:+0x04)
  // and Y (+0x05:+0x06) each start exactly on a whole pixel. Without this the
  // ascent would inherit whatever fractional remainder the previous life of this
  // record left behind.
  mem8[rec + SUBPOS_A] = 0x00;
  mem8[rec + SUBPOS_B] = 0x00;

  // Plant the object's on-screen position. +0x04 is the X byte the display-list
  // builder copies into the sprite's horizontal slot; 0x08 fixes the column for
  // this ascent.
  mem8[rec + FIELD_04] = 0x08;

  // +0x06 is the Y byte copied into the sprite's vertical slot. 0x1e is the
  // starting row at the bottom of the climb; the phase-1 handler decrements this
  // each frame (carrying a borrow out of the +0x05 fraction) until it drops below
  // its arrival threshold, which is what makes the object appear to rise.
  mem8[rec + FIELD_06] = 0x1e;

  // Arm the object's animation: point the record at the ANIM_PARAM_68EF
  // animation-sequence table (ROM 0x68ef) and restart it at frame 0, so the
  // rising object plays its ascent look from the beginning. setActorAnimation
  // writes the record's +0x0C/+0x0D sequence pointer and +0x0E frame index.
  setActorAnimation(m, rec, ANIM_PARAM_68EF);

  // Seat the ascent step last (matching the original ordering, after the anim is
  // armed). +0x09 is the amount the phase-1 handler subtracts out of the
  // +0x05:+0x06 Y position on every frame — 0x18 sub-pixels per frame is this
  // object's climb speed.
  mem8[rec + FIELD_09] = 0x18;
}
