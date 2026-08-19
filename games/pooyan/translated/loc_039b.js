// SPDX-License-Identifier: GPL-3.0-only

// loc_039b  (ROM 0x039b-0x03c1) -- a second routine sharing loc_0378's assigned range (loc_0378
// rets at 0x039a; this is a fresh entry). dk.asm mislabels the span "UNREACHED" -- the attract
// trace never enters it and no caller is visible in that trace, so it is reached off-attract
// (gameplay / dynamic dispatch); the bytes are a complete routine. Gated on (0x8806); paints a
// column at 0x8482 (stride 0x20): N cells of tile 0x0c where N = min((0x8a80)+1, 8), then (8-N)
// cells of tile 0x10. Rets early when the gate is 0, or when N==8 (no blanks left).
export function loc_039b(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8806);
  m.step(0x039e, 13); // 039b  ld a,(0x8806)
  regs.and(regs.a);
  m.step(0x039f, 4); // 039e  and a
  if (regs.fZ) {
    m.ret(11); // 039f  ret z (gate clear)
    return;
  }
  m.step(0x03a0, 5); // 039f  ret z not taken

  regs.hl = 0x8482;
  m.step(0x03a3, 10);
  regs.de = 0x0020;
  m.step(0x03a6, 10);
  regs.a = mem.read8(0x8a80);
  m.step(0x03a9, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x03aa, 4);
  regs.cp(0x08);
  m.step(0x03ac, 7);
  if (regs.fC) {
    m.step(0x03b0, 12); // 03ac  jr c (A < 8, keep it)
  } else {
    m.step(0x03ae, 7); // 03ac  jr c not taken
    regs.a = 0x08;
    m.step(0x03b0, 7); // 03ae  ld a,0x08 (clamp to 8)
  }
  regs.c = regs.a;
  m.step(0x03b1, 4);
  regs.b = regs.a;
  m.step(0x03b2, 4);

  for (;;) {
    // 03b2  fill N cells with tile 0x0c
    mem.write8(regs.hl, 0x0c);
    m.step(0x03b4, 10);
    regs.addHl(regs.de);
    m.step(0x03b5, 11);
    if (regs.djnz() !== 0) {
      m.step(0x03b2, 13); // 03b5  djnz 0x03b2 (taken)
      continue;
    }
    m.step(0x03b7, 8); // 03b5  djnz (not taken)
    break;
  }

  regs.a = 0x08;
  m.step(0x03b9, 7);
  regs.sub(regs.c);
  m.step(0x03ba, 4); // 03b9  sub c -> 8 - N remaining
  if (regs.fZ) {
    m.ret(11); // 03ba  ret z (no blanks left)
    return;
  }
  m.step(0x03bb, 5); // 03ba  ret z not taken
  regs.b = regs.a;
  m.step(0x03bc, 4);

  for (;;) {
    // 03bc  fill the remaining (8 - N) cells with tile 0x10
    mem.write8(regs.hl, 0x10);
    m.step(0x03be, 10);
    regs.addHl(regs.de);
    m.step(0x03bf, 11);
    if (regs.djnz() !== 0) {
      m.step(0x03bc, 13); // 03bf  djnz 0x03bc (taken)
      continue;
    }
    m.step(0x03c1, 8); // 03bf  djnz (not taken)
    break;
  }

  m.ret(); // 03c1  ret
}
