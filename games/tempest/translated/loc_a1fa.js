// SPDX-License-Identifier: GPL-3.0-only
// loc_a1fa  (ROM 0xa1fa-0xa23e) -- Y=$02ad,x indexes $03ac,y; if that limit is 0 return. When
// $02d3,x >= limit: clamp/clear, inc $02f2,x, set $039a,y=0xc0, jsr ccf6, seed $29-$2b, jsr ca6c;
// finally if $02f2,x >= 2 clear $02d3,x and dec $0135.
export function loc_a1fa(m) {
  const { regs, mem } = m;
  regs.y = mem.read8((0x02ad + regs.x) & 0xffff); regs.setNZ(regs.y); m.step(0xa1fd, 4);
  regs.a = mem.read8((0x03ac + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xa200, 4);
  if (regs.fZ) { m.step(0xa23e, 3); return m.ret(6); }
  m.step(0xa202, 2);
  regs.a = mem.read8((0x02d3 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa205, 4);
  regs.cmp(mem.read8((0x03ac + regs.y) & 0xffff)); m.step(0xa208, 4);
  if (regs.fNC) {
    m.step(0xa22f, 3);
  } else {
    m.step(0xa20a, 2);
    regs.cmp(0xf0); m.step(0xa20c, 2);
    if (regs.fNC) {
      m.step(0xa210, 3);
    } else {
      m.step(0xa20e, 2);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa210, 2);
    }
    mem.write8((0x03ac + regs.y) & 0xffff, regs.a); m.step(0xa213, 5);
    mem.write8((0x02f2 + regs.x) & 0xffff, regs.inc8(mem.read8((0x02f2 + regs.x) & 0xffff))); m.step(0xa216, 7);
    regs.a = 0xc0; regs.setNZ(regs.a); m.step(0xa218, 2);
    mem.write8((0x039a + regs.y) & 0xffff, regs.a); m.step(0xa21b, 5);
    m.push16(0xa21d); m.step(0xa21e, 6); m.call(0xccf6);
    regs.x = 0xff; regs.setNZ(regs.x); m.step(0xa220, 2);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa222, 2);
    mem.write8(0x2a, regs.a); m.step(0xa224, 3);
    mem.write8(0x2b, regs.a); m.step(0xa226, 3);
    regs.a = 0x01; regs.setNZ(regs.a); m.step(0xa228, 2);
    mem.write8(0x29, regs.a); m.step(0xa22a, 3);
    m.push16(0xa22c); m.step(0xa22d, 6); m.call(0xca6c);
    regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xa22f, 3);
  }
  regs.a = mem.read8((0x02f2 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa232, 4);
  regs.cmp(0x02); m.step(0xa234, 2);
  if (regs.fNC) { m.step(0xa23e, 3); return m.ret(6); }
  m.step(0xa236, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa238, 2);
  mem.write8((0x02d3 + regs.x) & 0xffff, regs.a); m.step(0xa23b, 5);
  mem.write8(0x0135, regs.dec8(mem.read8(0x0135))); m.step(0xa23e, 6);
  return m.ret(6);
}
