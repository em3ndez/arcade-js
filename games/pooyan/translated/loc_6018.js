// SPDX-License-Identifier: GPL-3.0-only

// loc_6018  (ROM 0x6018-0x6024) -- the advance + djnz-back latch of the 6-slot overlap scan.
// loc_5fa2's empty/miss branches tail-jump here; it steps IX by 4 and HL by 0x18 to the next
// slot, decrements the slot counter B, and tail-jumps back to loc_5fa2's entry while B!=0 (the
// jp nz targets loc_5fa2's head -- a routine entry, so it is a tail call, not a mid-routine jump).
// On B==0 the scan is exhausted and it rets to loc_5fa2's caller.
export function loc_6018(m) {
  const { regs, mem } = m;

  regs.de = 0x0004;             m.step(0x601b, 10);
  regs.addIx(regs.de);          m.step(0x601d, 15);
  regs.e = 0x18;                m.step(0x601f, 7);
  regs.addHl(regs.de);          m.step(0x6020, 11);
  regs.b = regs.dec8(regs.b);   m.step(0x6021, 4);
  if (regs.fNZ) { m.step(0x5fa2, 10); return m.call(0x5fa2); } // jp nz,0x5fa2 -- next slot
  m.step(0x6024, 10);
  return m.ret(10);
}
