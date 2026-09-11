// SPDX-License-Identifier: GPL-3.0-only
// loc_b0dd  (ROM 0xb0dd-0xb0e6) -- if A==$72 rts; else store A->$72, tail-jmp 0xdf6a.
export function loc_b0dd(m) {
  const { regs, mem } = m;
  regs.cmp(mem.read8(0x72)); m.step(0xb0df, 3);
  if (regs.fZ) { m.step(0xb0e6, 3); return m.ret(6); }
  m.step(0xb0e1, 2);
  mem.write8(0x72, regs.a); m.step(0xb0e3, 3);
  m.step(0xdf6a, 3); return m.call(0xdf6a);
}
