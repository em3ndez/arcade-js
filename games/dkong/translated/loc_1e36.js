// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e36  (ROM 0x1E36–0x1E49) — writes 0x6A30 block {A,B,0x07,C}, rst-0x30 gate, 0x6085=3, ret. A/B/C live-in.
 */
export function loc_1e36(m) {
  const { regs, mem } = m;
  regs.hl = 0x6a30;
  m.step(0x1e39, 10); // ld hl,0x6a30
  mem.write8(regs.hl, regs.a);
  m.step(0x1e3a, 7); // ld (hl),a
  regs.l = (regs.l + 1) & 0xff;
  m.step(0x1e3b, 4); // inc l
  mem.write8(regs.hl, regs.b);
  m.step(0x1e3c, 7); // ld (hl),b
  regs.l = (regs.l + 1) & 0xff;
  m.step(0x1e3d, 4); // inc l
  mem.write8(regs.hl, 0x07);
  m.step(0x1e3f, 10); // ld (hl),0x07
  regs.l = (regs.l + 1) & 0xff;
  m.step(0x1e40, 4); // inc l
  mem.write8(regs.hl, regs.c);
  m.step(0x1e41, 7); // ld (hl),c
  regs.a = 0x05;
  m.step(0x1e43, 7); // ld a,0x05
  m.push16(0x1e44); m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // caller-skip gate
  regs.hl = 0x6085;
  m.step(0x1e47, 10); // ld hl,0x6085
  mem.write8(regs.hl, 0x03);
  m.step(0x1e49, 10); // 0x6085 = 3
  m.ret(10);
}
