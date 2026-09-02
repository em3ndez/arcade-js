// SPDX-License-Identifier: GPL-3.0-only
import { DRAW_PHASE_FLAG } from "./names.js";

// Raster draw-phase predicate: carry := (mem[de] & 0x80) === the draw-phase flag byte -- true when the
// object's phase bit (bit7 of the byte at DE) matches the current raster half (the flag is 0x80 in the
// vblank half, 0x00 in the mid-screen half). Callers dispatch this via m.call and skip the object when
// carry is clear (it does not belong to this half-frame). Two load-bearing live-outs: the carry, and HL
// left at the flag address by the address-load (a frozen caller advances HL and reads through it).
export function objectMatchesDrawPhase(m, de = m.regs.de) {
  return (m.regs.hl = DRAW_PHASE_FLAG, m.regs.fC = (m.mem8[de] & 0x80) === m.mem8[DRAW_PHASE_FLAG]);
}
