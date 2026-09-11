// SPDX-License-Identifier: GPL-3.0-only
// loc_9c4f (ROM 0x9c4f-0x9c57) -- toggles bit $40 of slot x's $0283,x state byte
// (the direction/flags cell whose low 3 bits index the $0160/$0165 delta table in
// loc_9c58) and stores it back. Self-contained: no calls, single rts.
export function loc_9c4f(m) {
  const { regs, mem } = m;
  { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9c52, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.eor(0x40); m.step(0x9c54, 2);
  mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0x9c57, 5); // sta abs,x = 5 fixed
  return m.ret(6);                                                   // 9c57 rts
}
