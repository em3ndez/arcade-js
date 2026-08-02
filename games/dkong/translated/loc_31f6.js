// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_31f6  (ROM 0x31F6–0x3201) — 12 bytes, 6 instructions.
 *
 *   31f6  3a 18 60     ld   a,(0x6018)
 *   31f9  e6 03        and  0x03
 *   31fb  fe 01        cp   0x01
 *   31fd  c0           ret  nz            ; returns A = 0x6018&3 (0/2/3), != 1
 *   31fe  3a 1a 60     ld   a,(0x601a)
 *   3201  c9           ret                ; returns A = 0x601a
 *
 *
 * only caller is 0x31E3 inside the untranslated sub_31dd, and nothing in
 * translated src references loc_31f6. Leaf.
 *
 * A value-returning helper: A = mem[0x6018] & 3; if that is 1, return
 * A = mem[0x601a], else return A = mem[0x6018] & 3 (one of 0/2/3). A is LIVE-OUT
 * -- sub_31dd does `cp 0x01` on it immediately -- so the early `ret nz` returns
 * a REAL value (0/2/3), not "nothing". `ret nz` FALLS THROUGH on Z;
 * stated, not assumed terminal. 0x6018/0x601a not interpreted.
 */
export function loc_31f6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6018);
  m.step(0x31f9, 13); // ld a,(0x6018)
  regs.and(0x03);
  m.step(0x31fb, 7); // and 0x03
  regs.cp(0x01);
  m.step(0x31fd, 7); // cp 0x01
  if (regs.fNZ) {
    m.ret(11); // ret nz -- returns A = 0x6018&3 (!= 1), a real value
    return;
  }
  m.step(0x31fe, 5); // ret nz NOT taken -- fall through

  regs.a = mem.read8(0x601a);
  m.step(0x3201, 13); // ld a,(0x601a)
  m.ret(); // 3201 -- returns A = 0x601a
}
