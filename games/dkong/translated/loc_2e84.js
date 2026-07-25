// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2e84  (ROM 0x2E84–0x2E99) — state 4: rise (ix+5)+=3; at 0xF8 deactivate the object; -> loc_2e6c.
 */
export function loc_2e84(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.a = 0x03;
  m.step(0x2e86, 7); // ld a,0x03
  regs.add(mem.read8(R(0x05)));
  m.step(0x2e89, 19); // add a,(ix+0x05)
  mem.write8(R(0x05), regs.a);
  m.step(0x2e8c, 19); // ld (ix+0x05),a
  regs.cp(0xf8);
  m.step(0x2e8e, 7); // cp 0xf8
  if (regs.fC) { m.step(0x2e6c, 10); return m.call(0x2e6c); } // jp c,0x2e6c (< 0xF8)
  m.step(0x2e91, 10);
  mem.write8(R(0x03), 0x00);
  m.step(0x2e95, 19); // ld (ix+0x03),0x00
  mem.write8(R(0x00), 0x00);
  m.step(0x2e99, 19); // ld (ix+0x00),0x00 -- deactivate
  m.step(0x2e6c, 10); // jp 0x2e6c
  return m.call(0x2e6c);
}
