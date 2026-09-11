// SPDX-License-Identifier: GPL-3.0-only
// loc_ccc3  (ROM 0xccc3-0xccc6) -- sound gate: BIT $05, and if bit7 clear (BPL) branch to the RTS at 0xcce9
//   (the tail of loc_ccc7 -- not a routine entry, so the RTS is inlined here); else fall into loc_ccc7 to
//   register the sound id in A. A is unchanged by BIT (Z from A&$05, N/V from $05 bits 7/6).
export function loc_ccc3(m) {
  const { regs, mem } = m;
  regs.bit(mem.read8(0x05)); m.step(0xccc5, 3);
  if (regs.fPl) { m.step(0xcce9, 3); return m.ret(6); }
  m.step(0xccc7, 2); return m.call(0xccc7);
}
