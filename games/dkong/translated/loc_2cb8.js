// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2cb8  (ROM 0x2CB8–0x2CE5) — free-slot claim; flows into entry_2ce6.
 * IX/B live-in (from entry_2c8f's jp nc,0x2CB8 -- still a NotImplemented stub
 * there). Not yet wired into the live dispatcher.
 * (0x62AC) = 0x6980 + (10-B)*4; (0x6386)=1 only if (0x62B1) dec -> 0. `ld (nn),ix`
 * @0x2CB8 is 20T (precedented at state0.js:11248, not a first-use).
 */
export function loc_2cb8(m) {
  const { regs, mem } = m;
  mem.write16(0x62aa, regs.ix); // ld (0x62aa),ix -- 20T
  m.step(0x2cbc, 20);
  mem.write8((regs.ix + 0x00) & 0xffff, 0x02);
  m.step(0x2cc0, 19); // ld (ix+0x00),0x02
  regs.d = 0x00;
  m.step(0x2cc2, 7); // ld d,0x00
  regs.a = 0x0a;
  m.step(0x2cc4, 7); // ld a,0x0a
  regs.sub(regs.b);
  m.step(0x2cc5, 4); // sub b -- 10 - B
  regs.add(regs.a);
  m.step(0x2cc6, 4); // add a,a (*2)
  regs.add(regs.a);
  m.step(0x2cc7, 4); // add a,a (*4)
  regs.e = regs.a;
  m.step(0x2cc8, 4); // ld e,a (DE = (10-B)*4)
  regs.hl = 0x6980;
  m.step(0x2ccb, 10); // ld hl,0x6980
  regs.addHl(regs.de);
  m.step(0x2ccc, 11); // add hl,de
  mem.write16(0x62ac, regs.hl);
  m.step(0x2ccf, 16); // ld (0x62ac),hl
  regs.a = 0x01;
  m.step(0x2cd1, 7); // ld a,0x01
  mem.write8(0x6393, regs.a);
  m.step(0x2cd4, 13); // ld (0x6393),a
  regs.de = 0x0501;
  m.step(0x2cd7, 10); // ld de,0x0501
  m.push16(0x2cda); m.step(0x309f, 17); m.call(0x309f); // call 0x309f
  regs.hl = 0x62b1;
  m.step(0x2cdd, 10); // ld hl,0x62b1
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x2cde, 11); // dec (0x62b1)
  if (regs.fNZ) { m.step(0x2ce6, 10); return m.call(0x2ce6); } // jp nz,0x2ce6
  m.step(0x2ce1, 10);
  regs.a = 0x01;
  m.step(0x2ce3, 7); // ld a,0x01
  mem.write8(0x6386, regs.a);
  m.step(0x2ce6, 13); // ld (0x6386),a -- falls into entry_2ce6
  return m.call(0x2ce6);
}
