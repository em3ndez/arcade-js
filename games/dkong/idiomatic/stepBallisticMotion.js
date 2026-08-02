// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBallisticMotion — advance an airborne actor one frame along its ballistic arc.  ROM 0x239C.
 *
 * The actor is an object record pointed at by IX. Two of its fields are 16-bit
 * fixed-point coordinates (big-endian: high byte at the lower offset, fractional
 * low byte next), each with its own 16-bit signed per-frame velocity, plus a
 * one-byte "frames airborne" counter that drives a ramping gravity term:
 *
 *   +0x03:+0x04  coordinate A (X for Mario)     += velocity A (+0x10:+0x11)
 *   +0x05:+0x06  coordinate B (Y for Mario)     -= velocity B (+0x12:+0x13),
 *                                               then += gravity(t)
 *   +0x14        t = frames airborne            incremented after use
 *
 * gravity(t) = (2·t + 1)·8 = 16·t + 8 — the discrete integral of a constant
 * downward acceleration, so coordinate B follows a parabola: velocity B first
 * carries it one way (a jump rising: Y decreases), the accumulating gravity term
 * overtakes it, and it falls back. Coordinate A just drifts at constant velocity.
 * The counter t is bumped every frame so the gravity term grows linearly.
 *
 * For Mario the record is at 0x6200 and the fields are exactly the ram.js names:
 * A = MARIO_X:MARIO_X_FRAC (0x6203:0x6204), velocity A = MARIO_AIR_VX (0x6210:0x6211),
 * B = MARIO_Y:MARIO_Y_FRAC (0x6205:0x6206), velocity B = MARIO_AIR_VY (0x6212:0x6213),
 * t = MARIO_AIR_FRAMES (0x6214). ram.js records the resulting per-frame ΔY as
 * -(V + 8 - 16n) with n the POST-increment counter — algebraically identical to
 * (-V + 16·t + 8) with t = n-1, the pre-increment value this routine reads.
 * Confirmed on real attract dispatches: a vertical jump (VX=0, VY=0x0148, t=0,1,2,…)
 * steps Y 0xf000 → 0xeec0 → 0xed90 → … byte-for-byte. The same routine also runs
 * the airborne object handlers (branch_2053, branch_20ec) with IX on their records.
 *
 * A LEAF: reads/writes only the IX record (five bytes written), calls nothing, and
 * references no fixed RAM address — IX is a live-in the caller sets.
 *
 * Memory-equivalent to the frozen oracle — equivalence-239c.test.js.
 * GATE:     crafted-entry + real captures; 25m attract dispatches it 1210×/2000
 *           frames (all IX=0x6200, Mario's jump/fall) — those are replayed for the
 *           memory-equivalence diff; the object-IX path (unreached by 25m attract)
 *           and every carry/borrow/16-bit-wrap/gravity-ramp edge are covered by a
 *           crafted sweep on a real machine state. Teeth: a no-+8 gravity twin.
 * LIVE-OUT: memory (the five written record bytes: +0x03,+0x04,+0x05,+0x06,+0x14)
 *           + register HL — the new coordinate-B value. branch_20ec consumes H via
 *           `ld a,h` immediately after the call; L is produced as its coherent low
 *           half and gated too. A/B/C and all flags are DEAD: the other three
 *           callers reload A/DE/HL from memory or a nested call before any read
 *           (advanceMarioAirborneFrame→sub_241f, loc_1bec→entry_1c05, branch_2053→sub_2a2f), and
 *           branch_20ec's own `cp`/`sub` overwrite the flags first.
 * NAMES:    none imported — every access is IX-relative (the Mario field mapping
 *           lives in the prose above); record offsets stay hex.
 */
export function stepBallisticMotion(m) {
  const { regs, mem } = m;
  const at = (d) => (regs.ix + d) & 0xffff;

  // Coordinate A += velocity A (16-bit, big-endian: hi at the lower offset).
  const posA = (mem.read8(at(0x03)) << 8) | mem.read8(at(0x04));
  const velA = (mem.read8(at(0x10)) << 8) | mem.read8(at(0x11));
  const newA = (posA + velA) & 0xffff;
  mem.write8(at(0x03), newA >> 8);
  mem.write8(at(0x04), newA & 0xff);

  // Coordinate B -= velocity B, then += the ramping gravity term.
  const posB = (mem.read8(at(0x05)) << 8) | mem.read8(at(0x06));
  const velB = (mem.read8(at(0x12)) << 8) | mem.read8(at(0x13));
  const t = mem.read8(at(0x14));        // frames airborne, read BEFORE the bump
  const gravity = 16 * t + 8;           // (2·t+1)·8; max 0x0FF8 at t=0xFF, still 16-bit
  const newB = (posB - velB + gravity) & 0xffff;
  mem.write8(at(0x05), newB >> 8);
  mem.write8(at(0x06), newB & 0xff);
  mem.write8(at(0x14), (t + 1) & 0xff); // bump the airborne-frame counter

  // LIVE-OUT: HL = the new coordinate-B value (H is read by branch_20ec).
  regs.h = newB >> 8;
  regs.l = newB & 0xff;
}
