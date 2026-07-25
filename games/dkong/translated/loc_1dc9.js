// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1dc9  (ROM 0x1DC9–0x1DF4) — rst 0x28 dispatch target, sub_1dbd entry 1.
 *
 *   1dc9  3e 40        ld   a,0x40
 *   1dcb  32 41 63     ld   (0x6341),a
 *   1dce  3e 02        ld   a,0x02
 *   1dd0  32 40 63     ld   (0x6340),a     ; STATE ADVANCE 1 -> 2, unconditional
 *   1dd3  3a 42 63     ld   a,(0x6342)
 *   1dd6  1f           rra                 ; carry = bit 0 of 0x6342
 *   1dd7  da 70 3e     jp   c,0x3e70
 *   1dda  1f           rra                 ; carry = bit 1
 *   1ddb  da 00 1e     jp   c,0x1e00
 *   1dde  1f           rra                 ; carry = bit 2
 *   1ddf  da f5 1d     jp   c,0x1df5
 *   1de2  21 85 60     ld   hl,0x6085
 *   1de5  36 03        ld   (hl),0x03
 *   1de7  3a 29 62     ld   a,(0x6229)
 *   1dea  3d           dec  a
 *   1deb  ca 00 1e     jp   z,0x1e00
 *   1dee  3d           dec  a
 *   1def  ca 08 1e     jp   z,0x1e08
 *   1df2  c3 10 1e     jp   0x1e10
 *
 * Stack-clean: no push/pop/rst/call and no ret. Every exit is a TAIL JUMP.
 */
export function loc_1dc9(m) {
  const { regs, mem } = m;

  regs.a = 0x40;
  m.step(0x1dcb, 7); // ld a,0x40
  mem.write8(0x6341, regs.a);
  m.step(0x1dce, 13); // ld (0x6341),a
  regs.a = 0x02;
  m.step(0x1dd0, 7); // ld a,0x02
  mem.write8(0x6340, regs.a); // *** STATE ADVANCE 1 -> 2, unconditional ***
  m.step(0x1dd3, 13); // ld (0x6340),a

  regs.a = mem.read8(0x6342);
  m.step(0x1dd6, 13); // ld a,(0x6342)

  regs.rra(); // carry = bit 0; A's rotated-in bit is dead. FIRST use of rra.
  m.step(0x1dd7, 4); // rra
  if (regs.fC) {
    m.step(0x3e70, 10); // jp c,0x3e70 taken (tail)
    return m.call(0x3e70);
  }
  m.step(0x1dda, 10); // jp c,0x3e70 not taken

  regs.rra(); // carry = bit 1
  m.step(0x1ddb, 4); // rra
  if (regs.fC) {
    m.step(0x1e00, 10); // jp c,0x1e00 taken (tail)
    return m.call(0x1e00);
  }
  m.step(0x1dde, 10); // jp c,0x1e00 not taken

  regs.rra(); // carry = bit 2
  m.step(0x1ddf, 4); // rra
  if (regs.fC) {
    m.step(0x1df5, 10); // jp c,0x1df5 taken (tail)
    return m.call(0x1df5);
  }
  m.step(0x1de2, 10); // jp c,0x1df5 not taken

  regs.hl = 0x6085;
  m.step(0x1de5, 10); // ld hl,0x6085
  mem.write8(regs.hl, 0x03);
  m.step(0x1de7, 10); // ld (hl),0x03  -- 0x6085:=3, fall-through path only

  regs.a = mem.read8(0x6229);
  m.step(0x1dea, 13); // ld a,(0x6229)
  regs.a = regs.dec8(regs.a);
  m.step(0x1deb, 4); // dec a
  if (regs.fZ) {
    m.step(0x1e00, 10); // jp z,0x1e00 taken (tail) -- 0x6229 == 1
    return m.call(0x1e00);
  }
  m.step(0x1dee, 10); // jp z,0x1e00 not taken

  regs.a = regs.dec8(regs.a); // NOT reloaded -- continues the dec chain
  m.step(0x1def, 4); // dec a
  if (regs.fZ) {
    m.step(0x1e08, 10); // jp z,0x1e08 taken (tail)  -- 0x6229 == 2 (level 2) -- wired
    return m.call(0x1e08);
  }
  m.step(0x1df2, 10); // jp z,0x1e08 not taken

  m.step(0x1e10, 10); // jp 0x1e10 (unconditional tail) -- 0x6229 not in {1,2} (level >=3)
  return m.call(0x1e10); // loc_1e10 already translated (0x1E10-0x1E14 -> loc_1e15); wire the level>=3 tail
}
