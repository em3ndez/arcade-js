// SPDX-License-Identifier: GPL-3.0-only

// loc_6b13  (ROM 0x6b13-0x6b3a) -- frame-gated two-tile blitter.
// (0x8f06) is a hold countdown: while non-zero, decrement and return. On expiry it reloads the
// countdown to 0x0c and advances the phase counter (0x8f07); phase bit0 selects one of two data
// blocks (0x2744 / 0x2748). loc_3325 is then called twice to paint at screen cell 0x84b4 and again
// at 0x84b4-0x60 (0x8454), one row up, with DE restored between the two calls.
export function loc_6b13(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f06;
  m.step(0x6b16, 10); // 6b13  ld hl,08f06h
  regs.a = mem.read8(regs.hl);
  m.step(0x6b17, 7); // 6b16  ld a,(hl)
  regs.and(regs.a);
  m.step(0x6b18, 4); // 6b17  and a
  if (regs.fNZ) {
    m.step(0x6b1a, 7); // 6b18  jr z (not taken -- still holding)
    regs.decMem8(mem, regs.hl);
    m.step(0x6b1b, 11); // 6b1a  dec (hl)
    m.ret(); // 6b1b  ret
    return;
  }
  m.step(0x6b1c, 12); // 6b18  jr z (hold expired)
  mem.write8(regs.hl, 0x0c);
  m.step(0x6b1e, 10); // 6b1c  ld (hl),00ch  (reload countdown)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x6b1f, 6); // 6b1e  inc hl -> 0x8f07
  regs.incMem8(mem, regs.hl);
  m.step(0x6b20, 11); // 6b1f  inc (hl)  (advance phase)
  regs.a = mem.read8(regs.hl);
  m.step(0x6b21, 7); // 6b20  ld a,(hl)
  regs.and(0x01);
  m.step(0x6b23, 7); // 6b21  and 001h  (phase bit0)
  regs.de = 0x2744;
  m.step(0x6b26, 10); // 6b23  ld de,02744h
  regs.hl = 0x84b4;
  m.step(0x6b29, 10); // 6b26  ld hl,084b4h
  if (regs.fZ) {
    m.step(0x6b2e, 12); // 6b29  jr z (phase even -> DE = 0x2744)
  } else {
    m.step(0x6b2b, 7); // 6b29  jr z (not taken)
    regs.de = 0x2748;
    m.step(0x6b2e, 10); // 6b2b  ld de,02748h  (phase odd)
  }
  m.push16(regs.de);
  m.step(0x6b2f, 11); // 6b2e  push de
  m.push16(0x6b32);
  m.step(0x3325, 17); // 6b2f  call 03325h -- pattern A: push the return so loc_3325's ret pops it
  m.call(0x3325);
  regs.de = 0xffa0;
  m.step(0x6b35, 10); // 6b32  ld de,0ffa0h  (-0x60)
  regs.addHl(regs.de);
  m.step(0x6b36, 11); // 6b35  add hl,de
  regs.de = m.pop16();
  m.step(0x6b37, 10); // 6b36  pop de
  m.push16(0x6b3a);
  m.step(0x3325, 17); // 6b37  call 03325h -- pattern A
  m.call(0x3325);
  m.ret(); // 6b3a  ret
}
