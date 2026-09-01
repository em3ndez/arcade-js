// SPDX-License-Identifier: GPL-3.0-only
// loc_1a5c  (ROM 0x1a5c-0x1a68) -- RAM clear. From HL=0x2400, stores 0x00 and bumps HL until
// H reaches 0x40 (HL==0x4000), i.e. zeroes work RAM 0x2400-0x3fff. Called from loc_1956.
export function loc_1a5c(m) {
  const { regs, mem } = m;

  regs.hl = 0x2400; m.step(0x1a5f, 10); // 1a5c  lxi h,0x2400
  for (;;) { // loc_1a5f
    mem.write8(regs.hl, 0x00); m.step(0x1a61, 10); // 1a5f  mvi m,0x00
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1a62, 5); // 1a61  inx h
    regs.a = regs.h; m.step(0x1a63, 5); // 1a62  mov a,h
    regs.cp(0x40); m.step(0x1a65, 7); // 1a63  cpi 0x40
    if (regs.fNZ) { m.step(0x1a5f, 10); continue; } // 1a65  jnz 0x1a5f
    m.step(0x1a68, 10); break; // 1a65  jnz (not taken)
  }
  return m.ret(10); // 1a68  ret
}
