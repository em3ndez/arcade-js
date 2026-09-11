// SPDX-License-Identifier: GPL-3.0-only
// loc_db5a  (ROM 0xdb5a-0xdb6e) -- if ($01ca | $01c7)==0, calls loc_de11 and seeds $7c=$01c9, $00=2; rts.
export function loc_db5a(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x01ca); regs.setNZ(regs.a); m.step(0xdb5d, 4);
  regs.ora(mem.read8(0x01c7)); m.step(0xdb60, 4);
  if (regs.fNZ) { m.step(0xdb6e, 3); return m.ret(6); }
  m.step(0xdb62, 2);
  m.push16((0xdb62 + 2) & 0xffff); m.step(0xdb65, 6); m.call(0xde11);
  regs.a = mem.read8(0x01c9); regs.setNZ(regs.a); m.step(0xdb68, 4);
  mem.write8(0x7c, regs.a); m.step(0xdb6a, 3);
  regs.a = 0x02; regs.setNZ(regs.a); m.step(0xdb6c, 2);
  mem.write8(0x00, regs.a); m.step(0xdb6e, 3);
  return m.ret(6);
}
