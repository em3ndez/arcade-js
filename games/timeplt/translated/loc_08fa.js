// SPDX-License-Identifier: GPL-3.0-only

// loc_08fa  (ROM 0x08FA-0x094C, Time Pilot)
export function loc_08fa(m) {
  const { regs, mem } = m;

  regs.c = regs.e;
  m.step(0x08fb, 4); // ld c,e
  regs.bc = 0x014a;
  m.step(0x08fe, 10); // ld bc,0x014a
  regs.c = regs.c;
  m.step(0x08ff, 4); // ld c,c -- a no-op that still costs 4
  regs.bc = 0x0148;
  m.step(0x0902, 10); // ld bc,0x0148
  regs.b = regs.a;
  m.step(0x0903, 4); // ld b,a
  regs.bc = 0x0146;
  m.step(0x0906, 10); // ld bc,0x0146
  regs.b = regs.l;
  m.step(0x0907, 4); // ld b,l
  regs.bc = 0x0140;
  m.step(0x090a, 10); // ld bc,0x0140
  regs.a = 0x01;
  m.step(0x090c, 7); // ld a,0x01
  regs.a = regs.inc8(regs.a);
  m.step(0x090d, 4); // inc a -- A = 2; inc leaves carry alone
  regs.bc = 0x013a;
  m.step(0x0910, 10); // ld bc,0x013a

  if (regs.fC) {
    m.step(0x0913, 12); // jr c,0x0913 taken
    regs.bc = 0x012f;
    m.step(0x0916, 10); // ld bc,0x012f
    regs.l = regs.dec8(regs.l);
    m.step(0x0917, 4); // dec l
    regs.bc = 0x0127;
    m.step(0x091a, 10); // ld bc,0x0127
    regs.h = regs.inc8(regs.h);
    m.step(0x091b, 4); // inc h
    regs.bc = 0x0121;
    m.step(0x091e, 10); // ld bc,0x0121
    regs.e = 0x01;
    m.step(0x0920, 7); // ld e,0x01
    m.step(0x0923, 12); // jr 0x0923
  } else {
    m.step(0x0912, 7); // jr c (not taken)
    mem.write8(0x2f01, regs.a, 10);
    m.step(0x0915, 13); // ld (0x2f01),a -- a WRITE TO ROM; the bus throws
    regs.bc = 0x012d;
    m.step(0x0918, 10); // ld bc,0x012d
    regs.daa();
    m.step(0x0919, 4); // daa
    regs.bc = 0x0124;
    m.step(0x091c, 10); // ld bc,0x0124
    regs.hl = 0x1e01;
    m.step(0x091f, 10); // ld hl,0x1e01
    regs.bc = 0x0118;
    m.step(0x0922, 10); // ld bc,0x0118
    regs.d = regs.dec8(regs.d);
    m.step(0x0923, 4); // dec d
  }

  regs.bc = 0x0112;
  m.step(0x0926, 10); // ld bc,0x0112
  regs.c = regs.inc8(regs.c);
  m.step(0x0927, 4); // inc c
  regs.bc = 0x0109;
  m.step(0x092a, 10); // ld bc,0x0109
  regs.b = 0x01;
  m.step(0x092c, 7); // ld b,0x01
  m.step(0x092d, 4); // nop
  regs.bc = 0x00fd;
  m.step(0x0930, 10); // ld bc,0x00fd

  if (regs.fM) {
    m.step(0xf700, 10); // jp m,0xf700 taken
    return m.call(0xf700);
  }
  m.step(0x0933, 10); // jp m NOT taken (jp costs 10 either way)

  m.step(0x0934, 4); // nop
  regs.af = m.pop16();
  m.step(0x0935, 10); // pop af -- takes a word the caller never pushed
  m.step(0x0936, 4); // nop
  regs.xor(0x00);
  m.step(0x0938, 7); // xor 0x00 -- A unchanged, C cleared, PV = parity of A
  regs.exDeHl();
  m.step(0x0939, 4); // ex de,hl
  m.step(0x093a, 4); // nop
  m.push16(regs.hl);
  m.step(0x093b, 11); // push hl
  m.step(0x093c, 4); // nop

  if (regs.fPO) {
    m.step(0xde00, 10); // jp po,0xde00 taken
    return m.call(0xde00);
  }
  m.step(0x093f, 10); // jp po NOT taken

  m.step(0x0940, 4); // nop

  if (regs.fC) {
    m.ret(11); // 0940  ret c (taken) -- unreachable from here, xor cleared carry
    return;
  }
  m.step(0x0941, 5); // ret c (not taken)

  m.step(0x0942, 4); // nop
  m.push16(regs.de);
  m.step(0x0943, 11); // push de
  m.step(0x0944, 4); // nop
  regs.de = m.pop16();
  m.step(0x0945, 10); // pop de
  m.step(0x0946, 4); // nop

  if (regs.fZ) {
    m.step(0xc600, 10); // jp z,0xc600 taken
    return m.call(0xc600);
  }
  m.step(0x0949, 10); // jp z NOT taken

  m.step(0x094a, 4); // nop
  m.step(0xbc00, 10); // jp 0xbc00
  return m.call(0xbc00);
}
