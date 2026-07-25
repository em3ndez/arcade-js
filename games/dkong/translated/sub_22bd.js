// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_22bd  (ROM 0x22BD–0x22CA) — bit-3-of-L selected copy of (HL) -> (DE).
 *
 *   22bd  7e           ld   a,(hl)
 *   22be  cb 5d        bit  3,l           ; Z = !bit3(L)
 *   22c0  11 4b 69     ld   de,0x694b
 *   22c3  c2 c9 22     jp   nz,0x22c9     ; bit3 set -> keep 0x694B
 *   22c6  11 47 69     ld   de,0x6947     ; bit3 clear -> 0x6947
 *   22c9  12           ld   (de),a        ; loc_22c9
 *   22ca  c9           ret
 */
export function sub_22bd(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);
  m.step(0x22be, 7); // ld a,(hl)
  regs.bit(3, regs.l); // bit 3,l -- register form, F3/F5 from operand (correct)
  m.step(0x22c0, 8);
  regs.de = 0x694b;
  m.step(0x22c3, 10); // ld de,0x694b
  if (regs.fNZ) {
    m.step(0x22c9, 10); // jp nz,0x22c9 -- bit3 set, keep DE=0x694B
  } else {
    m.step(0x22c6, 10); // jp nz not taken
    regs.de = 0x6947;
    m.step(0x22c9, 10); // ld de,0x6947
  }
  mem.write8(regs.de, regs.a);
  m.step(0x22ca, 7); // ld (de),a
  m.ret(); // ret (0x22CA)
}
