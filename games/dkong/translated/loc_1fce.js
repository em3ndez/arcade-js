// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1fce  (ROM 0x1FCE–0x1FE4) — the (ix+17)!=(ix+5) tail. ALSO the SHARED ENTRY tail-.
 *  reached from 0x210B. Steps (ix+0f); on expiry toggles (ix+7), reloads =4.
 */
export function loc_1fce(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.a = mem.read8(R(0x0f));
  m.step(0x1fd1, 19); // ld a,(ix+0x0f)
  regs.a = regs.dec8(regs.a);
  m.step(0x1fd2, 4); // dec a
  if (regs.fNZ) {
    m.step(0x1fdf, 10); // jp nz,0x1fdf -- skip the reload
  } else {
    m.step(0x1fd5, 10);
    regs.a = mem.read8(R(0x07));
    m.step(0x1fd8, 19); // ld a,(ix+0x07)
    regs.xor(0x01);
    m.step(0x1fda, 7); // xor 0x01
    mem.write8(R(0x07), regs.a);
    m.step(0x1fdd, 19); // ld (ix+0x07),a
    regs.a = 0x04;
    m.step(0x1fdf, 7); // ld a,0x04
  }
  mem.write8(R(0x0f), regs.a);
  m.step(0x1fe2, 19); // ld (ix+0x0f),a
  m.step(0x21ba, 10); // jp 0x21ba
  return m.call(0x21ba);
}
