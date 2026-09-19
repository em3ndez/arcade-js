// SPDX-License-Identifier: GPL-3.0-only
/**
 * allSlotsClear — does a strided table of ten object slots (base, stride; count fixed at ten)
 * read all-zero? Short-circuits false at the first non-zero cell.
 *
 * LIVE-OUT: the verdict only — true = all clear, false = a slot is occupied. Writes no memory.
 */
import { u16 } from "../../../core/int.js";

export function allSlotsClear(mem, base, stride) {
  let addr = u16(base);
  for (let slot = 0; slot < 10; slot++) {
    if (mem.read8(addr) !== 0) return false;
    addr = u16(addr + stride); // 16-bit wrap
  }
  return true;
}

/**
 * allSlotsClearFromRegisters — the seam entry the override resolvers dispatch as fn(m). Base and
 * stride arrive in HL/DE; the verdict is the caller-skip boolean (true = all clear, caller
 * continues; false = a slot is occupied, caller aborts). Writes no memory.
 * The all-clear arm replays the walk's final register/flag state; the occupied arm drops residuals.
 */
export function allSlotsClearFromRegisters(m, base = m.regs.hl, stride = m.regs.de) {
  const { regs, mem } = m;

  if (!allSlotsClear(mem, base, stride)) return false; // caller-skip; residuals dropped

  regs.a = 0x00; // tenth cell, zero on this arm
  regs.and(regs.a); // zero test: Z set, S clear, PV even, carry cleared
  regs.hl = u16(base + 9 * stride);
  regs.addHl(stride); // tenth advance — rewrites half-carry/subtract/carry, keeps the above
  regs.b = 0x00;
  return true;
}
