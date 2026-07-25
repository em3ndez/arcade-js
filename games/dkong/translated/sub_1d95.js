// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_1d95  (ROM 0x1D95–0x1DA5) — entry_1c4f call-z target (0x6225==1). A live-in.
 *  Stores A->0x6225; unless 0x6227==1, sets 0x608A=0x0D / 0x608B=0x03.
 */
export function sub_1d95(m) {
  const { regs, mem } = m;
  mem.write8(0x6225, regs.a);
  m.step(0x1d98, 13); // ld (0x6225),a
  regs.a = mem.read8(0x6227);
  m.step(0x1d9b, 13); // ld a,(0x6227)
  regs.a = regs.dec8(regs.a);
  m.step(0x1d9c, 4); // dec a
  if (regs.fZ) { m.ret(11); return; } // ret z -- 0x6227 == 1
  m.step(0x1d9d, 5);
  regs.hl = 0x608a;
  m.step(0x1da0, 10); // ld hl,0x608a
  mem.write8(regs.hl, 0x0d);
  m.step(0x1da2, 10); // ld (hl),0x0d
  regs.l = (regs.l + 1) & 0xff;
  m.step(0x1da3, 4); // inc l
  mem.write8(regs.hl, 0x03);
  m.step(0x1da5, 10); // ld (hl),0x03
  m.ret(10); // 0x1DA5
}
