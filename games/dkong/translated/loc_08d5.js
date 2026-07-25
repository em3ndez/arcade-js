// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_08d5  (ROM 0x08D5–0x08F7) — -> A = mem[0x7D00] & B.
 *
 *   08d5  06 04        ld   b,0x04
 *   08d7  1e 09        ld   e,0x09
 *   08d9  3a 01 60     ld   a,(0x6001)
 *   08dc  fe 01        cp   0x01
 *   08de  ca e4 08     jp   z,0x08e4      ; ==1 -> B=4,E=9 ; else B=0xC,E=0xA
 *   08e1  06 0c        ld   b,0x0c
 *   08e3  1c           inc  e
 *   08e4  3a 1a 60     ld   a,(0x601a)
 *   08e7  e6 07        and  0x07
 *   08e9  c2 f3 08     jp   nz,0x08f3     ; (0x601A&7)!=0 -> SKIP the two calls
 *   08ec  7b           ld   a,e
 *   08ed  cd e9 05     call 0x05e9        ; handler_05e9 (returns normally)
 *   08f0  cd 16 06     call 0x0616        ; sub_0616
 *   08f3  3a 00 7d     ld   a,(0x7d00)
 *   08f6  a0           and  b
 *   08f7  c9           ret                ; A (and flags) = mem[0x7D00] & B
 */
export function loc_08d5(m) {
  const { regs, mem } = m;

  regs.b = 0x04;
  m.step(0x08d7, 7); // ld b,0x04
  regs.e = 0x09;
  m.step(0x08d9, 7); // ld e,0x09
  regs.a = mem.read8(0x6001);
  m.step(0x08dc, 13); // ld a,(0x6001)
  regs.cp(0x01);
  m.step(0x08de, 7); // cp 0x01

  if (regs.fZ) {
    m.step(0x08e4, 10); // jp z,0x08e4 taken -- B stays 0x04, E stays 0x09
  } else {
    m.step(0x08e1, 10); // jp z not taken
    regs.b = 0x0c;
    m.step(0x08e3, 7); // ld b,0x0c
    regs.e = regs.inc8(regs.e); // inc e -- 8-bit, D untouched
    m.step(0x08e4, 4);
  }

  // -- loc_08e4 --
  regs.a = mem.read8(0x601a);
  m.step(0x08e7, 13); // ld a,(0x601a)
  regs.and(0x07);
  m.step(0x08e9, 7); // and 0x07

  if (regs.fNZ) {
    m.step(0x08f3, 10); // jp nz,0x08f3 -- SKIP the calls (the common case)
  } else {
    m.step(0x08ec, 10); // jp nz not taken
    regs.a = regs.e;
    m.step(0x08ed, 4); // ld a,e
    m.push16(0x08f0); // call 0x05e9
    m.step(0x05e9, 17);
    m.call(0x05e9); // returns normally to 0x08F0 (see the header)
    m.push16(0x08f3); // call 0x0616
    m.step(0x0616, 17);
    m.call(0x0616);
  }

  // -- loc_08f3 --
  regs.a = mem.read8(0x7d00);
  m.step(0x08f6, 13); // ld a,(0x7d00)
  regs.and(regs.b); // and b -- A and flags are the return value
  m.step(0x08f7, 4);
  m.ret(); // ret (0x08F7)
}
