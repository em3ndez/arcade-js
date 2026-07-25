// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2ea7  (ROM 0x2EA7–0x2ED1) — inactive object: spawn on (0x6396) bit0 (via sub_0057), else just advance.
 */
export function loc_2ea7(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.a = mem.read8(0x6396);
  m.step(0x2eaa, 13); // ld a,(0x6396)
  regs.rrca();
  m.step(0x2eab, 4); // rrca
  if (regs.fNC) { m.step(0x2e78, 10); return m.call(0x2e78); } // jp nc,0x2e78 (no spawn)
  m.step(0x2eae, 10);
  regs.xor(regs.a);
  m.step(0x2eaf, 4); // xor a
  mem.write8(0x6396, regs.a);
  m.step(0x2eb2, 13); // ld (0x6396),a -- clear spawn flag
  mem.write8(R(0x05), 0x50);
  m.step(0x2eb6, 19); // ld (ix+0x05),0x50
  mem.write8(R(0x0d), 0x01);
  m.step(0x2eba, 19); // ld (ix+0x0d),0x01
  m.push16(0x2ebd); m.step(0x0057, 17); m.call(0x0057); // call 0x0057
  regs.and(0x0f);
  m.step(0x2ebf, 7); // and 0x0f
  regs.add(0xf8);
  m.step(0x2ec1, 7); // add a,0xf8
  mem.write8(R(0x03), regs.a);
  m.step(0x2ec4, 19); // ld (ix+0x03),a
  mem.write8(R(0x00), 0x01);
  m.step(0x2ec8, 19); // ld (ix+0x00),0x01 -- activate
  regs.hl = 0x39aa;
  m.step(0x2ecb, 10); // ld hl,0x39aa
  mem.write8(R(0x0e), regs.l);
  m.step(0x2ece, 19); // ld (ix+0x0e),l
  mem.write8(R(0x0f), regs.h);
  m.step(0x2ed1, 19); // ld (ix+0x0f),h
  m.step(0x2e78, 10); // jp 0x2e78
  return m.call(0x2e78);
}
