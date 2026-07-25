// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_066a  (ROM 0x066A–0x0690) — A JOIN: reached by fallthrough from 0x0667
 * and by `jp 0x066a` from 0x06B5. Splits (0x638C) into BCD nibbles and writes
 * four tile cells.
 *
 *   066a  4f           ld   c,a          ; keep the ORIGINAL in C
 *   066b  e6 0f        and  0x0f
 *   066d  47           ld   b,a          ; low nibble in B
 *   066e  79           ld   a,c
 *   066f  0f 0f 0f 0f  rrca x4
 *   0673  e6 0f        and  0x0f         ; high nibble in A
 *   0675  c2 89 06     jp   nz,0x0689
 *   0678  3e 03        ld   a,0x03
 *   067a  32 89 60     ld   (0x6089),a
 *   067d  3e 70        ld   a,0x70
 *   067f  32 86 74     ld   (0x7486),a
 *   0682  32 a6 74     ld   (0x74a6),a
 *   0685  80           add  a,b
 *   0686  47           ld   b,a
 *   0687  3e 10        ld   a,0x10
 *   0689  32 e6 74     ld   (0x74e6),a   ; loc_0689
 *   068c  78           ld   a,b
 *   068d  32 c6 74     ld   (0x74c6),a
 *   0690  c9           ret
 *
 * THE FOUR VRAM STORES ARE OUT OF ADDRESS ORDER: 0x7486, 0x74A6, 0x74E6,
 * 0x74C6 -- 0x74E6 is written BEFORE 0x74C6. All four addresses are distinct,
 * so sorting them leaves final memory identical and no state diff would
 * notice; writediff gates the write TRACE and would go red. Left in ROM order.
 *
 * The high-nibble-zero arm suppresses a leading digit: it writes 0x70 to two
 * cells and enters the shared tail with A = 0x10, where the non-zero arm
 * enters with A = the high nibble itself.
 */
export function loc_066a(m) {
  const { regs, mem } = m;

  regs.c = regs.a; // the ORIGINAL -- loc_0691 keeps it in B instead
  m.step(0x066b, 4); // ld c,a
  regs.and(0x0f);
  m.step(0x066d, 7); // and 0x0f
  regs.b = regs.a; // low nibble
  m.step(0x066e, 4); // ld b,a
  regs.a = regs.c;
  m.step(0x066f, 4); // ld a,c
  for (const next of [0x0670, 0x0671, 0x0672, 0x0673]) {
    regs.rrca();
    m.step(next, 4); // rrca
  }
  regs.and(0x0f); // high nibble
  m.step(0x0675, 7); // and 0x0f
  if (regs.fNZ) {
    m.step(0x0689, 10); // jp nz,0x0689 taken -- A is the high nibble
    return m.call(0x0689);
  }
  m.step(0x0678, 10); // jp nz not taken

  regs.a = 0x03;
  m.step(0x067a, 7); // ld a,0x03
  mem.write8(0x6089, regs.a);
  m.step(0x067d, 13); // ld (0x6089),a
  regs.a = 0x70;
  m.step(0x067f, 7); // ld a,0x70
  mem.write8(0x7486, regs.a);
  m.step(0x0682, 13); // ld (0x7486),a
  mem.write8(0x74a6, regs.a);
  m.step(0x0685, 13); // ld (0x74a6),a
  regs.add(regs.b); // leaves the flags the 0x0690 ret hands back on THIS arm
  m.step(0x0686, 4); // add a,b
  regs.b = regs.a;
  m.step(0x0687, 4); // ld b,a
  regs.a = 0x10;
  m.step(0x0689, 7); // ld a,0x10

  return m.call(0x0689); // fallthrough, NOT a jump
}
