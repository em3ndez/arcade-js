// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20c3 — turn an object's vertical arc around at a quarter of the speed it arrived with,
 * restart the arc from a whole-pixel position, and hand the record to the shared object-sprite
 * tail.  ROM 0x20C3.
 *
 * WHAT IT DOES AND WHAT THAT RESTS ON. The ballistic integrator stepBallisticMotion (ROM 0x239C,
 * already idiomatic and gated) stores a vertical arc on a record as a CONSTANT launch speed in
 * +0x12/+0x13 plus a count of frames elapsed in +0x14, moving the object down by
 * (16·frames + 8 − launchSpeed) every frame; +0x04 and +0x06 are the fractional low halves of the
 * two coordinates it integrates. Because the speed field is the speed the arc STARTED with, an arc
 * cannot be reversed by negating it — the elapsed frames have to be folded back in, as
 * 16·frames − launchSpeed with the frame count restarted. reverseMarioVerticalArc (ROM 0x1BD8) is
 * that operation written out for Mario, on Mario's copies of these very fields (MARIO_AIR_VY_HI,
 * MARIO_AIR_VY_LO, MARIO_AIR_FRAMES). This routine applies the same reflection to an object record
 * and then takes a QUARTER of it, so the object comes back slower than it arrived, and it clears
 * both coordinate fractions as well — the same three-field clear loc_2153 (ROM 0x2153) performs on
 * its own at the sibling site.
 *
 * MEASURED, AND IT COULD HAVE COME OUT THE OTHER WAY. Over 4000 attract frames all 49 dispatches
 * land on OBJ_ARRAY_67 records, and on every one of them the stored speed equals
 * ((16·frames − launchSpeed) & 0xFFFF) >> 2. Read out of the same run's per-frame dumps, the
 * object's vertical step REVERSES SIGN across 48 of the 49 (the one exception has already damped
 * to a standstill), and on 49 of 49 the departing step is SMALLER in magnitude than the arriving
 * one — the first few, in 1/256 px per frame with positive downward, are +392 → −80, +144 → −18.
 * A re-launch, a position edit, or an undamped reflection would each have failed that; the gate
 * asserts it rather than leaving it as a reading of this body.
 *
 * WHAT IS NOT CLAIMED: which game event brings a record here — that is the four callers' business,
 * and none of them is derived here — and why the quartering shift discards the sign rather than
 * preserving it. Attract never once produces a reflection with the high bit set (0 of 49), so no
 * run distinguishes a logical from a sign-preserving shift; this file reproduces the ROM's logical
 * one without asserting that the difference is unreachable.
 *
 * Memory-equivalent to the frozen oracle — equivalence-20c3.test.js.
 * GATE:     captured + crafted + live, all three replaying the WHOLE tail chain (the shared tail
 *           at ROM 0x21BA, the object loop, and its return), which is the frozen oracle on both
 *           sides. 0x20C3 IS naturally reached: 49 dispatches in 4000 attract frames, first at
 *           frame 966, on 7 OBJ_ARRAY_67 records and through ALL FOUR of its callers (ROM 0x2083
 *           ×24, ROM 0x20B5 ×12, ROM 0x20E1 ×11, ROM 0x20A2 ×2, measured by hooking them, not
 *           inferred). EVERY one is replayed inline — no sampling. Attract's VALUE coverage is
 *           narrow and the gate asserts each hole rather than leaving it implied: of the 49
 *           reflections, 0 have the high bit set, 0 have either low bit set, and the stored high
 *           byte is 0 on all 49 — so the captured arm alone cannot see a sign-preserving shift, a
 *           rounded shift, or a dropped high-byte store. A crafted sweep over all 256 frame counts
 *           × 16 launch speeds on a real capture of each of the 6 entry shapes — 24576 entries,
 *           poked identically on both sides — covers those. LIVE: wired at 0x20C3 for a whole
 *           4000-frame attract run, the per-frame trace is byte-identical to the pure all-oracle
 *           baseline INCLUDING the stack region; a control arm without the cycle restoration forks
 *           at frame 966 on SPIN_COUNT, so that comparison is sensitive rather than lenient.
 *           Teeth: EIGHT broken twins — three of them invisible to the captured arm entirely
 *           (caught only by the crafted sweep), one invisible to both RAM and the return value
 *           (caught only by the register comparison, on 10 of the 49), and one invisible to RAM
 *           and registers alike (caught only by the return assertion). Which arm catches which is
 *           asserted in BOTH directions, so a hole that quietly closes fails the gate too.
 * LIVE-OUT: memory — the five record bytes — plus the propagated return value, plus everything the
 *           frozen tail leaves, which the rewrite reaches through that same frozen tail.
 *           DERIVED: there are exactly FOUR callers (ROM 0x2083, 0x20A2, 0x20B5, 0x20E1 — every
 *           reference to this address in the lift); each arrives by a JUMP and hands this routine's
 *           result straight back without reading a register, and the chain above them
 *           (ROM 0x2053 ← 0x1F93) does not read one either. The ACCUMULATOR and every FLAG the
 *           oracle leaves are dead: the tail's second instruction overwrites the accumulator, and
 *           between the increment at ROM 0x21C0 and the 16-bit add at ROM 0x1F90 every flag bit is
 *           rewritten before the first conditional. MEASURED: dropping the accumulator clear leaves
 *           both the exit register file and a 4000-frame attract trace unchanged.
 *           The damped speed is also mirrored into the register pair the oracle leaves it in,
 *           because the tail's leading register-set exchange parks it in the ALTERNATE file where a
 *           later pass of the object loop can pick it up. NO reader was identified, and dropping
 *           the mirror leaves the 4000-frame trace unchanged — so it is kept because it is what the
 *           oracle leaves, and it is the unit gate's register comparison (which sees it move on 10
 *           of 49 dispatches) that holds it, not a known consumer. Said plainly rather than dressed
 *           up as a live-out.
 * NAMES:    none imported — every access is relative to the caller's record pointer, and none of
 *           the five offsets carries a shared OBJ_* offset name in names.js, so they stay local
 *           consts here as they do in loc_2153 and stepBallisticMotion. The record pointer is NOT a
 *           parameter: the tail at ROM 0x21BA is still frozen and re-reads the index register
 *           itself, so a caller passing anything else would be obeyed here and ignored one call
 *           later. It becomes an honest parameter once that tail is decompiled. Direct-called:
 *           loc_2407 (ROM 0x2407), already idiomatic. One address dispatch remains, to the shared
 *           tail at ROM 0x21BA, which is being decompiled in this same batch.
 */

import { loc_2407 } from "./loc_2407.js"; // ROM 0x2407

// Object-record fields, addressed off the record pointer the caller left set. None carries a
// shared OBJ_* offset name in names.js, so they stay local consts; the readings are
// stepBallisticMotion's, since that is the routine that reads all five back.
const LAUNCH_VY_HI = 0x12; //     upper half of the speed the vertical arc started with
const LAUNCH_VY_LO = 0x13; //     lower half of it
const AIRBORNE_FRAMES = 0x14; //  frames elapsed on this arc; scales the gravity term
const X_FRAC = 0x04; //           fractional low half of the coordinate whose high byte is OBJ_X
const Y_FRAC = 0x06; //           fractional low half of the coordinate whose high byte is OBJ_Y

export function loc_20c3(m) {
  const { regs, mem8 } = m;

  // 16 × elapsed frames minus the launch speed — the arc's own reflection, which is what turns the
  // object around without moving it. loc_2407 reads both fields off this same record.
  const reflected = loc_2407(m);

  // A quarter of the reflection goes back as the new launch speed, so the return trip is slower
  // than the arrival. The shift drops the low two bits and does not preserve sign.
  const damped = reflected >>> 2;

  const record = regs.ix;
  mem8[record + LAUNCH_VY_HI] = damped >> 8;
  mem8[record + LAUNCH_VY_LO] = damped;

  // Restart the arc: gravity counts from zero again and both coordinates resume from a whole pixel.
  mem8[record + AIRBORNE_FRAMES] = 0;
  mem8[record + X_FRAC] = 0;
  mem8[record + Y_FRAC] = 0;

  // BOUNDARY: the oracle leaves the damped speed in this register pair and the tail's leading
  // register-set exchange parks it in the alternate file. Mirrored so the exit register file
  // matches the oracle's; see the LIVE-OUT note for what is and is not known about its readers.
  regs.hl = damped;

  // The shared object-sprite tail, reached by a jump — so its result is this routine's result.
  return m.call(0x21ba);
}
