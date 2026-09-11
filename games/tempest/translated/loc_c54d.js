// SPDX-License-Identifier: GPL-3.0-only
// loc_c54d  (ROM 0xc54d-0xc5c1) -- if $0115 set, saves $5f/$5b/$a0, forces $5f=0xe8/$5b=0xff/$a0=0x28,
// then an 8-pass loop ($37: 7..0) that for each nonzero $03fe,x entry picks a $9e value, jsr $df4c and
// jsr $bd09, and restores the saved cells. Tail: if $011f set and $42>=0x15, inc $0200,$40.
export function loc_c54d(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0115); regs.setNZ(regs.a); m.step(0xc550, 4);
  if (regs.fZ) {
    m.step(0xc5b1, 3);
  } else {
    m.step(0xc552, 2);
    regs.a = mem.read8(0x5f); regs.setNZ(regs.a); m.step(0xc554, 3);
    m.push8(regs.a); m.step(0xc555, 3);
    regs.a = mem.read8(0x5b); regs.setNZ(regs.a); m.step(0xc557, 3);
    m.push8(regs.a); m.step(0xc558, 3);
    regs.a = mem.read8(0xa0); regs.setNZ(regs.a); m.step(0xc55a, 3);
    m.push8(regs.a); m.step(0xc55b, 3);
    regs.a = 0xe8; regs.setNZ(regs.a); m.step(0xc55d, 2);
    mem.write8(0x5f, regs.a); m.step(0xc55f, 3);
    regs.a = 0xff; regs.setNZ(regs.a); m.step(0xc561, 2);
    mem.write8(0x5b, regs.a); m.step(0xc563, 3);
    regs.a = 0x28; regs.setNZ(regs.a); m.step(0xc565, 2);
    mem.write8(0xa0, regs.a); m.step(0xc567, 3);
    regs.x = 0x07; regs.setNZ(regs.x); m.step(0xc569, 2);
    mem.write8(0x37, regs.x); m.step(0xc56b, 3);
    for (;;) {
      regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xc56d, 3);
      regs.a = mem.read8((0x03fe + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc570, ((0x03fe & 0xff00) !== ((0x03fe + regs.x) & 0xffff & 0xff00)) ? 5 : 4);
      if (regs.fZ) {
        m.step(0xc5a4, 3);
      } else {
        m.step(0xc572, 2);
        mem.write8(0x57, regs.a); m.step(0xc574, 3);
        regs.a = 0x80; regs.setNZ(regs.a); m.step(0xc576, 2);
        mem.write8(0x56, regs.a); m.step(0xc578, 3);
        regs.a = 0x80; regs.setNZ(regs.a); m.step(0xc57a, 2);
        mem.write8(0x58, regs.a); m.step(0xc57c, 3);
        regs.a = mem.read8(0x9f); regs.setNZ(regs.a); m.step(0xc57e, 3);
        regs.cmp(0x05); m.step(0xc580, 2);
        if (regs.fC) {
          m.step(0xc587, 3);
          regs.a = regs.x; regs.setNZ(regs.a); m.step(0xc588, 2);
          regs.and(0x07); m.step(0xc58a, 2);
          regs.cmp(0x07); m.step(0xc58c, 2);
          if (regs.fNZ) {
            m.step(0xc590, 3);
          } else {
            m.step(0xc58e, 2);
            regs.a = 0x04; regs.setNZ(regs.a); m.step(0xc590, 2);
          }
        } else {
          m.step(0xc582, 2);
          regs.a = 0x06; regs.setNZ(regs.a); m.step(0xc584, 2);
          regs.clv(); m.step(0xc585, 2);
          m.step(0xc590, 3);
        }
        mem.write8(0x9e, regs.a); m.step(0xc592, 3);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0xc593, 2);
        regs.a = 0x08; regs.setNZ(regs.a); m.step(0xc595, 2);
        m.push16(0xc597); m.step(0xc598, 6); m.call(0xdf4c);
        regs.a = mem.read8(0x37); regs.setNZ(regs.a); m.step(0xc59a, 3);
        regs.and(0x03); m.step(0xc59c, 2);
        regs.a = regs.asl(regs.a); m.step(0xc59d, 2);
        regs.adc(0x0a); m.step(0xc59f, 2);
        mem.write8(0x55, regs.a); m.step(0xc5a1, 3);
        m.push16(0xc5a3); m.step(0xc5a4, 6); m.call(0xbd09);
      }
      mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xc5a6, 5);
      if (regs.fPl) { m.step(0xc56b, 3); continue; }
      m.step(0xc5a8, 2); break;
    }
    regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xc5a9, 4);
    mem.write8(0xa0, regs.a); m.step(0xc5ab, 3);
    regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xc5ac, 4);
    mem.write8(0x5b, regs.a); m.step(0xc5ae, 3);
    regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xc5af, 4);
    mem.write8(0x5f, regs.a); m.step(0xc5b1, 3);
  }
  regs.a = mem.read8(0x011f); regs.setNZ(regs.a); m.step(0xc5b4, 4);
  if (regs.fZ) { m.step(0xc5c1, 3); return m.ret(6); }
  m.step(0xc5b6, 2);
  regs.x = mem.read8(0x42); regs.setNZ(regs.x); m.step(0xc5b8, 3);
  regs.cpx(0x15); m.step(0xc5ba, 2);
  if (regs.fNC) { m.step(0xc5c1, 3); return m.ret(6); }
  m.step(0xc5bc, 2);
  regs.x = mem.read8(0x40); regs.setNZ(regs.x); m.step(0xc5be, 3);
  mem.write8((0x0200 + regs.x) & 0xffff, regs.inc8(mem.read8((0x0200 + regs.x) & 0xffff))); m.step(0xc5c1, 7);
  return m.ret(6);
}
