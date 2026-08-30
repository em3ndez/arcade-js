// SPDX-License-Identifier: GPL-3.0-only

// loc_50f1  (ROM 0x50f1-0x510f) -- a gated table-checksum walker.
// If (0x89fb) != 0 it tail-jumps to loc_5119 (the alternate handler). Otherwise it walks the
// byte table at 0x6ac5, adding each byte into E (carrying into D) until it hits the 0xc9
// terminator; then it loads HL=0x5119, sets A=E, compares against (0x5119), and tail-jumps
// into 0x6ac5 (the table is re-entered as code). No manual push/pop -- SP stays balanced;
// both exits are tail jumps that reuse the caller's frame.
export function loc_50f1(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x89fb);
  m.step(0x50f4, 13); // 50f1  ld a,(0x89fb)
  regs.and(regs.a);
  m.step(0x50f5, 4); // 50f4  and a
  if (regs.fNZ) {
    m.step(0x5119, 12); // 50f5  jr nz,0x5119 (tail -> alternate handler)
    return m.call(0x5119);
  }
  m.step(0x50f7, 7); // 50f5  jr nz (not taken)

  regs.hl = 0x6ac5;
  m.step(0x50fa, 10); // 50f7  ld hl,0x6ac5
  regs.de = 0x0000;
  m.step(0x50fd, 10); // 50fa  ld de,0x0000

  // loop 0x50fd..0x5108: sum table bytes into DE until the 0xc9 terminator.
  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x50fe, 7); // 50fd  ld a,(hl)
    regs.cp(0xc9);
    m.step(0x5100, 7); // 50fe  cp 0xc9
    if (regs.fZ) {
      m.step(0x510a, 12); // 5100  jr z,0x510a (taken -- terminator found)
      break;
    }
    m.step(0x5102, 7); // 5100  jr z (not taken)
    regs.add(regs.e);
    m.step(0x5103, 4); // 5102  add a,e
    regs.e = regs.a;
    m.step(0x5104, 4); // 5103  ld e,a
    if (regs.fNC) {
      m.step(0x5107, 12); // 5104  jr nc,0x5107 (taken -- no carry)
    } else {
      m.step(0x5106, 7); // 5104  jr nc (not taken)
      regs.d = regs.inc8(regs.d);
      m.step(0x5107, 4); // 5106  inc d
    }
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x5108, 6); // 5107  inc hl
    m.step(0x50fd, 12); // 5108  jr 0x50fd
  }

  // loc_510a
  regs.hl = 0x5119;
  m.step(0x510d, 10); // 510a  ld hl,0x5119
  regs.a = regs.e;
  m.step(0x510e, 4); // 510d  ld a,e
  regs.cp(mem.read8(regs.hl));
  m.step(0x510f, 7); // 510e  cp (hl)
  m.step(0x6ac5, 10); // 510f  jp 0x6ac5 (tail -- re-enter the table as code)
  return m.call(0x6ac5);
}
