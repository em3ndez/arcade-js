// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e28  (ROM 0x1E28–0x1E49) — ROUND-3: writes the 0x6A30 param block, rst-0x30.
 * caller-skip gate, then 0x6085=3, ret. Its ret @0x1E49 IS the loc_1e49 byte
 * (shared; modelled as a plain ret here, NOT a call to loc_1e49). DE,B live-in from
 * loc_3e70.
 */
export function loc_1e28(m) {
  const { regs, mem } = m;
  m.push16(0x1e2b);
  m.step(0x309f, 17); // call 0x309f -- queue task
  m.call(0x309f);
  regs.a = mem.read8(0x6205);
  m.step(0x1e2e, 13); // ld a,(0x6205)
  regs.add(0x14);
  m.step(0x1e30, 7); // add a,0x14
  regs.c = regs.a;
  m.step(0x1e31, 4); // ld c,a
  regs.a = mem.read8(0x6203);
  m.step(0x1e34, 13); // ld a,(0x6203)
  m.step(0x1e35, 4); // nop
  m.step(0x1e36, 4); // nop
  regs.hl = 0x6a30;
  m.step(0x1e39, 10); // ld hl,0x6a30
  mem.write8(regs.hl, regs.a);
  m.step(0x1e3a, 7); // ld (hl),a -- 0x6A30 = (0x6203)
  regs.l = (regs.l + 1) & 0xff;
  m.step(0x1e3b, 4); // inc l
  mem.write8(regs.hl, regs.b);
  m.step(0x1e3c, 7); // ld (hl),b -- 0x6A31 = B
  regs.l = (regs.l + 1) & 0xff;
  m.step(0x1e3d, 4); // inc l
  mem.write8(regs.hl, 0x07);
  m.step(0x1e3f, 10); // ld (hl),0x07 -- 0x6A32 = 7
  regs.l = (regs.l + 1) & 0xff;
  m.step(0x1e40, 4); // inc l
  mem.write8(regs.hl, regs.c);
  m.step(0x1e41, 7); // ld (hl),c -- 0x6A33 = C
  regs.a = 0x05;
  m.step(0x1e43, 7); // ld a,0x05
  m.push16(0x1e44);
  m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // rst-0x30 CALLER-SKIP -- gate fired, back to our caller
  regs.hl = 0x6085;
  m.step(0x1e47, 10); // ld hl,0x6085
  mem.write8(regs.hl, 0x03);
  m.step(0x1e49, 10); // ld (hl),0x03 -- 0x6085 = 3
  m.ret(10); // 0x1E49 (== loc_1e49; one ret, not double-integrated)
}
