// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0bb3  (ROM 0x0BB3–0x0BD9) — wrap the 0x6385 sequence, advance the selectors.
 *
 *   0bb3  21 8a 60     ld   hl,0x608a
 *   0bb6  3a 09 60     ld   a,(0x6009)
 *   0bb9  fe 90        cp   0x90
 *   0bbb  20 0b        jr   nz,0x0bc8
 *   0bbd  36 0f        ld   (hl),0x0f     ; 0x608A = 0x0F
 *   0bbf  23           inc  hl
 *   0bc0  36 03        ld   (hl),0x03     ; 0x608B = 0x03
 *   0bc2  21 19 69     ld   hl,0x6919
 *   0bc5  34           inc  (hl)
 *   0bc6  18 09        jr   0x0bd1
 *   0bc8  fe 18        cp   0x18          ; loc_0bc8
 *   0bca  20 05        jr   nz,0x0bd1
 *   0bcc  21 19 69     ld   hl,0x6919
 *   0bcf  35           dec  (hl)
 *   0bd0  00           nop
 *   0bd1  df           rst  0x18          ; loc_0bd1 -- the merge + gate
 *   0bd2  af           xor  a
 *   0bd3  32 85 63     ld   (0x6385),a    ; wrap the sequence to arm 0
 *   0bd6  34           inc  (hl)          ; 0x6009 (HL = 0x6009, rst side effect)
 *   0bd7  23           inc  hl
 *   0bd8  34           inc  (hl)          ; 0x600A -- the outer selector
 *   0bd9  c9           ret
 */
export function loc_0bb3(m) {
  const { regs, mem } = m;

  regs.hl = 0x608a;
  m.step(0x0bb6, 10); // ld hl,0x608a
  regs.a = mem.read8(0x6009);
  m.step(0x0bb9, 13); // ld a,(0x6009)
  regs.cp(0x90);
  m.step(0x0bbb, 7); // cp 0x90

  if (regs.fNZ) {
    m.step(0x0bc8, 12); // jr nz,0x0bc8 taken
    regs.cp(0x18);
    m.step(0x0bca, 7); // cp 0x18
    if (regs.fNZ) {
      m.step(0x0bd1, 12); // jr nz,0x0bd1 -- HL still 0x608A (dead)
    } else {
      m.step(0x0bcc, 7); // jr nz not taken
      regs.hl = 0x6919;
      m.step(0x0bcf, 10); // ld hl,0x6919
      regs.decMem8(mem, regs.hl); // dec (hl) -- flag-correct RMW
      m.step(0x0bd0, 11);
      m.step(0x0bd1, 4); // nop -- REAL instruction, do not elide
    }
  } else {
    m.step(0x0bbd, 7); // jr nz not taken
    mem.write8(regs.hl, 0x0f);
    m.step(0x0bbf, 10); // ld (hl),0x0f
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0bc0, 6); // inc hl
    mem.write8(regs.hl, 0x03);
    m.step(0x0bc2, 10); // ld (hl),0x03
    regs.hl = 0x6919;
    m.step(0x0bc5, 10); // ld hl,0x6919
    regs.incMem8(mem, regs.hl); // inc (hl)
    m.step(0x0bc6, 11);
    m.step(0x0bd1, 12); // jr 0x0bd1
  }

  // -- loc_0bd1: the merge. HL from above is DEAD; sub_0018 sets HL = 0x6009. --
  m.push16(0x0bd2); // rst 0x18 PUSHES its return address
  m.step(0x0018, 11); // rst 0x18
  if (!m.call(0x0018)) return; // countdown not expired -- skipped to our caller

  regs.xor(regs.a); // xor a -- A = 0
  m.step(0x0bd3, 4);
  mem.write8(0x6385, regs.a); // sequence wraps to arm 0
  m.step(0x0bd6, 13);
  regs.incMem8(mem, regs.hl); // inc (hl) -- HL == 0x6009 (rst side effect)
  m.step(0x0bd7, 11);
  regs.hl = (regs.hl + 1) & 0xffff; // HL = 0x600A
  m.step(0x0bd8, 6);
  regs.incMem8(mem, regs.hl); // inc (hl) -- 0x600A, the OUTER selector
  m.step(0x0bd9, 11);
  m.ret(); // ret (0x0BD9)
}
