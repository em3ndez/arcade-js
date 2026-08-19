// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2b9a  (ROM 0x2b9a-0x2bb2) -- formation helper. When (0x8903) < 2 it (conditionally) runs the
// caller-skip helper loc_2bbf, which may abort this routine (return into loc_2b8d's caller). Then it
// runs the 0x8d30 countdown (returning while non-zero) and, on expiry, sets up IX=0x8c60 / DE=0xffe8
// and falls into the loc_2bb3 spawn loop. loc_2bbf uses the boolean caller-skip protocol.
export function loc_2b9a(m) {
  const { regs, mem } = m;

  regs.hl = 0x8903; m.step(0x2b9d, 10); // 2b9a  ld hl,0x8903
  regs.a = mem.read8(regs.hl); m.step(0x2b9e, 7); // 2b9d  ld a,(hl)
  regs.cp(0x02); m.step(0x2ba0, 7); // 2b9e  cp 0x02
  if (regs.fC) {
    m.push16(0x2ba3); m.step(0x2bbf, 17); // 2ba0  call c,0x2bbf
    if (!m.call(0x2bbf)) return; // loc_2bbf caller-skip -> abort
  } else {
    m.step(0x2ba3, 10); // 2ba0  call c not taken
  }
  regs.hl = 0x8d30; m.step(0x2ba6, 10); // 2ba3  ld hl,0x8d30
  regs.a = mem.read8(regs.hl); m.step(0x2ba7, 7); // 2ba6  ld a,(hl)
  regs.and(regs.a); m.step(0x2ba8, 4); // 2ba7  and a
  if (regs.fZ) {
    m.step(0x2bac, 12); // 2ba8  jr z,0x2bac
  } else {
    m.step(0x2baa, 7);
    regs.decMem8(mem, regs.hl); m.step(0x2bab, 11); // 2baa  dec (hl)
    m.ret(); // 2bab  ret
    return;
  }
  regs.ix = 0x8c60; m.step(0x2bb0, 14); // 2bac  ld ix,0x8c60
  regs.de = 0xffe8; m.step(0x2bb3, 10); // 2bb0  ld de,0xffe8
  return m.call(0x2bb3); // fall into loc_2bb3
}
