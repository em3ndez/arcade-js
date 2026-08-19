// SPDX-License-Identifier: GPL-3.0-only
//
// loc_3278  (ROM 0x3278-0x32b6) -- board-clear check (reached from loc_324d; its first two bytes also
// double as the 0x68ac compare value in loc_30f1's guard). Once per arm ((0x8f55) gate) it 16-bit
// sums the playfield tile columns (0x8402.., stepping l by 1 within a 0x1f-wide column then +3 to the
// next, over pages up to 0x88) into DE, and looks the sum up in the 4-entry 2-byte table at 0x68eb:
// a low-byte miss tail-jumps to 0x76d4, a full match ret's, a high-byte miss tail-jumps to 0x3829.
export function loc_3278(m) {
  const { regs, mem } = m;

  regs.a = regs.a ^ regs.h; m.step(0x3279, 4); // 3278  xor h (overlap header byte)
  regs.l = regs.b; m.step(0x327a, 4); // 3279  ld l,b (overlap header byte)
  regs.hl = 0x8f55; m.step(0x327d, 10);
  regs.a = mem.read8(regs.hl); m.step(0x327e, 7); // 327d  ld a,(hl)
  regs.and(regs.a); m.step(0x327f, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x3280, 5);
  regs.incMem8(mem, regs.hl); m.step(0x3281, 11); // 3280  inc (hl)
  regs.hl = 0x8402; m.step(0x3284, 10);
  regs.de = 0x0000; m.step(0x3287, 10);
  for (;;) {
    regs.a = mem.read8(regs.hl); m.step(0x3288, 7); // 3287  ld a,(hl)
    regs.add(regs.e); m.step(0x3289, 4);
    regs.e = regs.a; m.step(0x328a, 4);
    if (regs.fNC) {
      m.step(0x328d, 12);
    } else {
      m.step(0x328c, 7);
      regs.d = regs.inc8(regs.d); m.step(0x328d, 4);
    }
    regs.l = regs.inc8(regs.l); m.step(0x328e, 4);
    regs.a = regs.l; m.step(0x328f, 4);
    regs.and(0x1f); m.step(0x3291, 7);
    regs.cp(0x1f); m.step(0x3293, 7);
    if (regs.fNZ) { m.step(0x3287, 12); continue; }
    m.step(0x3295, 7);
    regs.a = regs.l; m.step(0x3296, 4);
    regs.add(0x03); m.step(0x3298, 7);
    regs.l = regs.a; m.step(0x3299, 4);
    if (regs.fNC) { m.step(0x3287, 12); continue; }
    m.step(0x329b, 7);
    regs.h = regs.inc8(regs.h); m.step(0x329c, 4);
    regs.a = regs.h; m.step(0x329d, 4);
    regs.cp(0x88); m.step(0x329f, 7);
    if (regs.fC) { m.step(0x3287, 12); continue; }
    m.step(0x32a1, 7); break;
  }
  regs.hl = 0x68eb; m.step(0x32a4, 10);
  regs.b = 0x04; m.step(0x32a6, 7);
  regs.a = regs.e; m.step(0x32a7, 4);
  for (;;) {
    regs.cp(mem.read8(regs.hl)); m.step(0x32a8, 7); // 32a7  cp (hl)
    if (regs.fZ) { m.step(0x32b0, 12); break; }
    m.step(0x32aa, 7);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x32ab, 6);
    if (regs.djnz() !== 0) { m.step(0x32a7, 13); continue; }
    m.step(0x32ad, 8); m.step(0x76d4, 10); return m.call(0x76d4);
  }
  for (;;) {
    regs.a = regs.d; m.step(0x32b1, 4);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x32b2, 6);
    regs.cp(mem.read8(regs.hl)); m.step(0x32b3, 7); // 32b2  cp (hl)
    if (regs.fZ) { m.ret(11); return; } // 32b3  ret z (board matches a stored layout)
    m.step(0x32b4, 5);
    if (regs.djnz() !== 0) { m.step(0x32b0, 13); continue; }
    m.step(0x32b6, 8); m.step(0x3829, 10); return m.call(0x3829);
  }
}
