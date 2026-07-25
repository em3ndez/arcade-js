// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2146  (ROM 0x2146–0x2152) — the (ix+5) < 0xE0 path -- 2407 + 22cb, snapshot (ix+5).
 */
export function loc_2146(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  m.push16(0x2149);
  m.step(0x2407, 17); // call 0x2407
  m.call(0x2407);
  m.push16(0x214c);
  m.step(0x22cb, 17); // call 0x22cb
  m.call(0x22cb);
  regs.a = mem.read8(R(0x05));
  m.step(0x214f, 19); // ld a,(ix+0x05)
  mem.write8(R(0x19), regs.a);
  m.step(0x2152, 19); // ld (ix+0x19),a
  regs.xor(regs.a); // A = 0
  m.step(0x2153, 4); // xor a
  return m.call(0x2153);
}
