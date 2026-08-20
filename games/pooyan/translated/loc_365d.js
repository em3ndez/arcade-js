// SPDX-License-Identifier: GPL-3.0-only

// loc_365d  (ROM 0x365d-0x367e) -- pre-spawn gate. When (ix+0x0b) bit0 is set, scan 6 records
// (base 0x8ae2, stride 0x18) counting those whose first byte == 3 into C; if that count isn't
// exactly 1, ret. Otherwise (or when the bit was clear) seat the IY scan window (0x8b70, stride
// 0x18, 5 slots) and fall through into loc_3680, which walks it. The 0x366c body is the djnz loop
// latch of the count scan (no external entry) so it is inlined here.
export function loc_365d(m) {
  const { regs, mem } = m;

  regs.bit(0, mem.read8((regs.ix + 0x0b) & 0xffff)); m.step(0x3661, 20); // 365d bit 0,(ix+0x0b)
  if (regs.fZ) {
    m.step(0x3677, 12);                                                  // 3661 jr z,0x3677 taken
  } else {
    m.step(0x3663, 7);                                                  // jr z not taken
    regs.hl = 0x8ae2;                              m.step(0x3666, 10);
    regs.de = 0x0018;                              m.step(0x3669, 10);
    regs.c = regs.d;                               m.step(0x366a, 4);   // C = 0 (D high byte of 0x0018)
    regs.b = 0x06;                                 m.step(0x366c, 7);
    for (;;) { // loc_366c: count stride-0x18 records whose (hl) == 3 into C
      regs.a = mem.read8(regs.hl);                 m.step(0x366d, 7);
      regs.cp(0x03);                               m.step(0x366f, 7);
      if (regs.fZ) {
        m.step(0x3671, 7);                                              // 366f jr nz not taken
        regs.c = regs.inc8(regs.c);               m.step(0x3672, 4);    // 3671 inc c
      } else {
        m.step(0x3672, 12);                                             // 366f jr nz,0x3672 taken
      }
      regs.addHl(regs.de);                         m.step(0x3673, 11);
      if (regs.djnz()) { m.step(0x366c, 13); } else { m.step(0x3675, 8); break; } // 3673 djnz 0x366c
    }
    regs.c = regs.dec8(regs.c);                    m.step(0x3676, 4);
    if (regs.fNZ) { return m.ret(11); }                                // 3676 ret nz (count != 1)
    m.step(0x3677, 5);                                                 // ret nz not taken
  }

  // loc_3677: seat the IY scan window, then fall through into loc_3680
  regs.iy = 0x8b70;                                m.step(0x367b, 14);
  regs.de = 0x0018;                                m.step(0x367e, 10);
  regs.b = 0x05;                                   m.step(0x3680, 7);  // 367e ld b,0x05 -> falls through
  return m.call(0x3680);
}
