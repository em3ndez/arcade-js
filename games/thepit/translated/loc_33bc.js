// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_33bc  (ROM 0x33bc–0x33d9) — searches a 32-byte table row for a map byte.
 *
 * DE is loaded from the byte at 0x808d (D forced to 0, so DE is 0..0xff), which
 * indexes a row of the table based at 0x34fe (each row 0x20 bytes: HL = 0x34fe +
 * DE). The byte searched for is read through the pointer at (0x8089); that
 * pointer is stepped back one column (`dec hl`) when the phase counter at 0x8086,
 * plus 5, is a multiple of 8 — i.e. when ((0x8086)+5) & 7 == 0. The row is then
 * scanned with `cpir` (BC = 0x20): Z is left SET iff the byte was found, and HL
 * points one past the match. A keeps the search byte throughout.
 *
 *   33bc  3a 8d 80     ld   a,(0x808d)
 *   33bf  5f           ld   e,a
 *   33c0  16 00        ld   d,0x00
 *   33c2  2a 89 80     ld   hl,(0x8089)
 *   33c5  3a 86 80     ld   a,(0x8086)
 *   33c8  c6 05        add  a,0x05
 *   33ca  e6 07        and  0x07
 *   33cc  20 01        jr   nz,0x33cf
 *   33ce  2b           dec  hl
 * loc_33cf:
 *   33cf  7e           ld   a,(hl)
 *   33d0  21 fe 34     ld   hl,0x34fe
 *   33d3  19           add  hl,de
 *   33d4  01 20 00     ld   bc,0x0020
 *   33d7  ed b1        cpir
 *   33d9  c9           ret
 *
 * cpir cost is NOT constant: 21 T per repeating iteration + 16 T for the
 * terminating one => 21*(n-1)+16 for the n iterations regs.cpir(mem) reports.
 * `dec hl` is the 16-bit form (opcode 0x2b) and affects NO flags, so the Z it is
 * NOT allowed to touch belongs to the preceding `and 0x07` — which is dead here
 * anyway, since cpir overwrites the whole flag set before the unconditional ret.
 */
export function loc_33bc(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x808d);
  m.step(0x33bf, 13); // ld a,(0x808d)
  regs.e = regs.a;
  m.step(0x33c0, 4); // ld e,a
  regs.d = 0x00;
  m.step(0x33c2, 7); // ld d,0x00
  regs.hl = mem.read16(0x8089);
  m.step(0x33c5, 16); // ld hl,(0x8089)
  regs.a = mem.read8(0x8086);
  m.step(0x33c8, 13); // ld a,(0x8086)
  regs.add(0x05);
  m.step(0x33ca, 7); // add a,0x05
  regs.and(0x07);
  m.step(0x33cc, 7); // and 0x07
  if (regs.fNZ) {
    m.step(0x33cf, 12); // jr nz,0x33cf -- taken (skip dec hl)
  } else {
    m.step(0x33ce, 7); // jr nz,0x33cf -- not taken
    regs.hl = (regs.hl - 1) & 0xffff; // dec hl (16-bit; affects no flags)
    m.step(0x33cf, 6); // dec hl
  }

  // loc_33cf:
  regs.a = mem.read8(regs.hl);
  m.step(0x33d0, 7); // ld a,(hl)
  regs.hl = 0x34fe;
  m.step(0x33d3, 10); // ld hl,0x34fe
  regs.addHl(regs.de);
  m.step(0x33d4, 11); // add hl,de
  regs.bc = 0x0020;
  m.step(0x33d7, 10); // ld bc,0x0020
  const n = regs.cpir(mem); // leaves HL one past the match; Z set iff a byte matched
  m.step(0x33d9, 21 * (n - 1) + 16); // cpir -- NOT constant (first-use cost)
  m.ret(); // ret (0x33d9)
}
