// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2f97  (ROM 0x2F97–0x2FB4) — (0x6217) bit0 clear: ret if (0x6218) bit0 clear; else build an alt B/C -> loc_2f7c.
 */
export function loc_2f97(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.a = mem.read8(0x6218);
  m.step(0x2f9a, 13); // ld a,(0x6218)
  regs.rrca();
  m.step(0x2f9b, 4); // rrca
  if (regs.fNC) { m.ret(11); return; } // ret nc (EXIT-2)
  m.step(0x2f9c, 5);
  mem.write8(R(0x09), 0x06);
  m.step(0x2fa0, 19); // ld (ix+0x09),0x06
  mem.write8(R(0x0a), 0x03);
  m.step(0x2fa4, 19); // ld (ix+0x0a),0x03
  regs.a = mem.read8(0x6207);
  m.step(0x2fa7, 13); // ld a,(0x6207)
  regs.rlca();
  m.step(0x2fa8, 4); // rlca -- carry = bit7, consumed by the rra below
  regs.a = 0x3c;
  m.step(0x2faa, 7); // ld a,0x3c
  regs.rra();
  m.step(0x2fab, 4); // rra -- A = 0x3C >> 1 with carry-in from the rlca
  regs.b = regs.a;
  m.step(0x2fac, 4); // ld b,a
  regs.c = 0x07;
  m.step(0x2fae, 7); // ld c,0x07
  regs.a = mem.read8(0x6089);
  m.step(0x2fb1, 13); // ld a,(0x6089)
  mem.write8(0x6389, regs.a);
  m.step(0x2fb4, 13); // ld (0x6389),a
  m.step(0x2f7c, 10); // jp 0x2f7c
  return m.call(0x2f7c);
}
