// SPDX-License-Identifier: GPL-3.0-only
import { DRAW_PHASE_FLAG } from "./names.js";

/**
 * objectMatchesDrawPhase — predicate: does this object belong to the raster half currently being drawn?
 *
 * WHAT IT IS
 *   Space Invaders splits each frame into two raster halves and services every object in exactly one of
 *   them, so no sprite is torn across the electron beam. Each object carries a phase bit (bit 7 of its
 *   first byte); this routine reports, via the carry flag, whether that bit matches the half-frame that
 *   is live right now.
 *
 * ROLE IN THE MACHINE
 *   DRAW_PHASE_FLAG (0x2072) names the current raster half: the vblank interrupt body stamps it 0x80 at
 *   frame top, and the mid-screen body clears it to 0x00 (see mechanisms.md "Frame tasks, timers, boot,
 *   and scoring"). This compares the object's bit 7 (mem[DE] & 0x80 — either 0x80 or 0x00) against that
 *   flag byte and sets carry when they are equal. The three object dispatchers call it and `rnc`-skip
 *   (skip when carry clear) any object that does not belong to this half-frame.
 *
 * ROM 0x1a06.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: carry = (object phase bit === current half); HL = DRAW_PHASE_FLAG's address, left there by
 *   the address-load that fetches the flag (a load-bearing side effect — a frozen caller advances HL and
 *   reads through it). `de` (the object pointer) defaults from the register when omitted.
 */
export function objectMatchesDrawPhase(m, de = m.regs.de) {
  // Seat HL at DRAW_PHASE_FLAG (the ROM loads its address to read it) and set carry when the object's
  // phase bit (bit 7 of the byte at DE) equals the current raster-half flag.
  return (m.regs.hl = DRAW_PHASE_FLAG, m.regs.fC = (m.mem8[de] & 0x80) === m.mem8[DRAW_PHASE_FLAG]);
}
