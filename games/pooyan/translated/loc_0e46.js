// SPDX-License-Identifier: GPL-3.0-only

// loc_0e46  (ROM 0x0e46-0x0e52) -- clear bit 2 (AND 0xfb) of six bytes at (HL), (HL+4), ... stepping
// by DE=4 for B=6 slots; caller passes HL (a 6-entry actor/attribute table base). Split out of the
// 0x0e00 batch range as its own routine (no static caller found -- reached by gameplay/dynamic dispatch).
export function loc_0e46(m) {
  const { regs, mem } = m;

  regs.de = 0x0004; m.step(0x0e49, 10); // 0e46  ld de,0x0004 (stride)
  regs.b = 0x06; m.step(0x0e4b, 7); // 0e49  ld b,0x06 (6 slots)
  for (;;) {
    regs.a = 0xfb; m.step(0x0e4d, 7); // 0e4b  ld a,0xfb (~bit2)
    regs.and(mem.read8(regs.hl)); m.step(0x0e4e, 7); // 0e4d  and (hl)
    mem.write8(regs.hl, regs.a); m.step(0x0e4f, 7); // 0e4e  ld (hl),a
    regs.addHl(regs.de); m.step(0x0e50, 11); // 0e4f  add hl,de
    if (regs.djnz() !== 0) { m.step(0x0e4b, 13); continue; } // 0e50  djnz 0x0e4b
    m.step(0x0e52, 8);
    break;
  }
  m.ret(); // 0e52  ret
}
