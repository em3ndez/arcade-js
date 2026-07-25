// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_15fa  (ROM 0x15FA–0x1614) — build a 4-byte sprite record at 0x6974 from the 0x360F table indexed by C*2 (BC live-in).
 */
export function sub_15fa(m) {
  const { regs, mem } = m;
  m.push16(regs.de);
  m.step(0x15fb, 11); // push de
  m.push16(regs.hl);
  m.step(0x15fc, 11); // push hl
  regs.c = regs.sla(regs.c);
  m.step(0x15fe, 8); // sla c -- C *= 2
  regs.hl = 0x360f;
  m.step(0x1601, 10); // ld hl,0x360f
  regs.addHl(regs.bc);
  m.step(0x1602, 11); // add hl,bc
  regs.exDeHl();
  m.step(0x1603, 4); // ex de,hl -- DE = record ptr
  regs.hl = 0x6974;
  m.step(0x1606, 10); // ld hl,0x6974
  regs.a = mem.read8(regs.de);
  m.step(0x1607, 7); // ld a,(de)
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1608, 6); // inc de
  mem.write8(regs.hl, regs.a);
  m.step(0x1609, 7); // 0x6974 = record[0]
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x160a, 6); // inc hl
  mem.write8(regs.hl, 0x72);
  m.step(0x160c, 10); // 0x6975 = 0x72
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x160d, 6); // inc hl
  mem.write8(regs.hl, 0x0c);
  m.step(0x160f, 10); // 0x6976 = 0x0C
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1610, 6); // inc hl
  regs.a = mem.read8(regs.de);
  m.step(0x1611, 7); // ld a,(de)
  mem.write8(regs.hl, regs.a);
  m.step(0x1612, 7); // 0x6977 = record[1]
  regs.hl = m.pop16();
  m.step(0x1613, 10); // pop hl
  regs.de = m.pop16();
  m.step(0x1614, 10); // pop de
  m.ret(10);
}
