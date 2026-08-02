// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2954  (ROM 0x2954–0x2973).
 */
export function loc_2954(m) {
  const { regs, mem } = m;

  regs.a = 0x0b;
  m.step(0x2956, 7); // ld a,0x0b -- the bit sub_0030 tests
  m.push16(0x2957);
  m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // gate: selected bit clear -> skipped

  m.push16(0x295a);
  m.step(0x2974, 17); // call 0x2974
  m.call(0x2974); // both arms land at 0x295A; A/B = the 2913 result

  mem.write8(0x6218, regs.a);
  m.step(0x295d, 13); // ld (0x6218),a
  regs.rrca();
  m.step(0x295e, 4); // rrca
  regs.rrca();
  m.step(0x295f, 4); // rrca -- A: 1 -> 0x40, 0 -> 0
  mem.write8(0x6085, regs.a);
  m.step(0x2962, 13); // ld (0x6085),a

  regs.a = regs.b;
  m.step(0x2963, 4); // ld a,b -- B names which object entry hit
  regs.and(regs.a);
  m.step(0x2964, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z -- B=0 (miss)
    return;
  }
  m.step(0x2965, 5); // ret z NOT taken

  regs.cp(0x01);
  m.step(0x2967, 7); // cp 0x01
  if (regs.fZ) {
    m.step(0x296f, 10); // jp z,0x296f -- B=1
    mem.write8((regs.ix + 0x11) & 0xffff, 0x01);
    m.step(0x2973, 19); // ld (ix+0x11),0x01 -> 0x6691
    m.ret();
    return;
  }
  m.step(0x296a, 10); // jp z NOT taken -- B=2

  mem.write8((regs.ix + 0x01) & 0xffff, 0x01);
  m.step(0x296e, 19); // ld (ix+0x01),0x01 -> 0x6681
  m.ret(); // ret (0x2973)
}
