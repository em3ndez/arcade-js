// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1c76  (ROM 0x1C76–0x1C8E) — landed-check; set 0x6220, sound; tail-jump 0x1da6.
 */
export function loc_1c76(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6205);
  m.step(0x1c79, 13); // ld a,(0x6205)
  regs.hl = 0x620e;
  m.step(0x1c7c, 10); // ld hl,0x620e
  regs.sub(0x0f);
  m.step(0x1c7e, 7); // sub 0x0f
  regs.cp(mem.read8(regs.hl));
  m.step(0x1c7f, 7); // cp (hl)
  if (regs.fC) { m.step(0x1da6, 10); return m.call(0x1da6); } // jp c
  m.step(0x1c82, 10);
  regs.a = 0x01;
  m.step(0x1c84, 7); // ld a,0x01
  mem.write8(0x6220, regs.a);
  m.step(0x1c87, 13); // ld (0x6220),a
  regs.hl = 0x6084;
  m.step(0x1c8a, 10); // ld hl,0x6084
  mem.write8(regs.hl, 0x03);
  m.step(0x1c8c, 10); // ld (hl),0x03
  m.step(0x1da6, 10); // jp 0x1da6
  return m.call(0x1da6);
}
