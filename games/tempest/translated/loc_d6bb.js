// SPDX-License-Identifier: GPL-3.0-only
// loc_d6bb  (ROM 0xd6bb-0xd6f6) -- reads $0e00/$0d00, indexes ROM tables 0xd6f7/0xd6ff/0xd6b3,
// writes $0156/$0158/$09/$0ac/$0ad, then jsr $dbe0 and stores A to $016a; rts.
export function loc_d6bb(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0e00); regs.setNZ(regs.a); m.step(0xd6be, 4);
  mem.write8(0x0a, regs.a); m.step(0xd6c0, 3);
  regs.and(0x38); m.step(0xd6c2, 2);
  regs.a = regs.lsr(regs.a); m.step(0xd6c3, 2);
  regs.a = regs.lsr(regs.a); m.step(0xd6c4, 2);
  regs.a = regs.lsr(regs.a); m.step(0xd6c5, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xd6c6, 2);
  regs.a = mem.read8((0xd6f7 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xd6c9, 4 + ((0xf7 + regs.x) > 0xff ? 1 : 0));
  mem.write8(0x0156, regs.a); m.step(0xd6cc, 4);
  regs.a = mem.read8(0x0d00); regs.setNZ(regs.a); m.step(0xd6cf, 4);
  regs.eor(0x02); m.step(0xd6d1, 2);
  mem.write8(0x09, regs.a); m.step(0xd6d3, 3);
  regs.a = mem.read8(0x0a); regs.setNZ(regs.a); m.step(0xd6d5, 3);
  regs.a = regs.rol(regs.a); m.step(0xd6d6, 2);
  regs.a = regs.rol(regs.a); m.step(0xd6d7, 2);
  regs.a = regs.rol(regs.a); m.step(0xd6d8, 2);
  regs.and(0x03); m.step(0xd6da, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xd6db, 2);
  regs.a = mem.read8((0xd6ff + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xd6de, 4 + ((0xff + regs.x) > 0xff ? 1 : 0));
  mem.write8(0x0158, regs.a); m.step(0xd6e1, 4);
  regs.a = mem.read8(0x0a); regs.setNZ(regs.a); m.step(0xd6e3, 3);
  regs.and(0x06); m.step(0xd6e5, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xd6e6, 2);
  regs.a = mem.read8((0xd6b3 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xd6e9, 4 + ((0xb3 + regs.y) > 0xff ? 1 : 0));
  mem.write8(0xac, regs.a); m.step(0xd6eb, 3);
  regs.a = mem.read8((0xd6b4 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xd6ee, 4 + ((0xb4 + regs.y) > 0xff ? 1 : 0));
  mem.write8(0xad, regs.a); m.step(0xd6f0, 3);
  m.push16((0xd6f0 + 2) & 0xffff); m.step(0xd6f3, 6); m.call(0xdbe0);
  mem.write8(0x016a, regs.a); m.step(0xd6f6, 4);
  return m.ret(6);
}
