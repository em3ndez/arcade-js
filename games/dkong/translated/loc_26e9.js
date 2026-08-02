// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_26e9  (ROM 0x26E9–0x26F9) — (0x601A)&1==0 -> ret A=0; else (HL)=0xFF if bit7(HL) set else 0x01.
 */
export function loc_26e9(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x601a);
  m.step(0x26ec, 13); // ld a,(0x601a)
  regs.and(0x01);
  m.step(0x26ee, 7); // and 0x01
  if (regs.fZ) { m.ret(11); return; } // ret z -- returns A=0 (a value)
  m.step(0x26ef, 5);
  const b7 = regs.bit(7, mem.read8(regs.hl));
  m.step(0x26f1, 12); // bit 7,(hl)
  regs.a = 0xff;
  m.step(0x26f3, 7); // ld a,0xff
  if (b7) {
    m.step(0x26f8, 10); // jp nz,0x26f8
  } else {
    m.step(0x26f6, 10);
    regs.a = 0x01;
    m.step(0x26f8, 7); // ld a,0x01
  }
  mem.write8(regs.hl, regs.a);
  m.step(0x26f9, 7); // ld (hl),a
  m.ret();
}
