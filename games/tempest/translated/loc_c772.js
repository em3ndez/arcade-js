// SPDX-License-Identifier: GPL-3.0-only
// loc_c772  (ROM 0xc772-0xc79f) -- entry c772 zeros y then falls into the c774 body. loc_c774 is the second
// entry (reached from loc_c765's bne with y preserved): emits a {0x40,0x80} header word then two coordinate
// words from ($02/$03,x) and ($00/$01,x) (high bytes masked 5 bits) through ($74),y, caching them in $6a-$6d,
// then tail-jmps loc_df5f to advance the ($74) cursor.
export function loc_c772(m) {
  const { regs, mem } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xc774, 2);
  return loc_c774(m);
}

export function loc_c774(m) {
  const { regs, mem } = m;
  regs.a = 0x40; regs.setNZ(regs.a); m.step(0xc776, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc778, 6);
  regs.a = 0x80; regs.setNZ(regs.a); m.step(0xc77a, 2);
  regs.y = regs.inc8(regs.y); m.step(0xc77b, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc77d, 6);
  regs.y = regs.inc8(regs.y); m.step(0xc77e, 2);
  regs.a = mem.read8((0x02 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xc780, 4);
  mem.write8(0x6c, regs.a); m.step(0xc782, 3);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc784, 6);
  regs.y = regs.inc8(regs.y); m.step(0xc785, 2);
  regs.a = mem.read8((0x03 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xc787, 4);
  mem.write8(0x6d, regs.a); m.step(0xc789, 3);
  regs.and(0x1f); m.step(0xc78b, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc78d, 6);
  regs.a = mem.read8((0x00 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xc78f, 4);
  mem.write8(0x6a, regs.a); m.step(0xc791, 3);
  regs.y = regs.inc8(regs.y); m.step(0xc792, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc794, 6);
  regs.a = mem.read8((0x01 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xc796, 4);
  mem.write8(0x6b, regs.a); m.step(0xc798, 3);
  regs.and(0x1f); m.step(0xc79a, 2);
  regs.y = regs.inc8(regs.y); m.step(0xc79b, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xc79d, 6);
  m.step(0xdf5f, 3); return m.call(0xdf5f);
}
