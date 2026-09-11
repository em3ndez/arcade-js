// SPDX-License-Identifier: GPL-3.0-only
// loc_c36e  (ROM 0xc36e-0xc3b9) -- if A!=0 rts; else stashes Y in $37, loads a 4-byte vector from
// $032a/$031a/$034a/$033a,y into $61-$64, calls $c772 (copies $74/$75 -> $b0/$b1), picks X (0x0f or 0x0e per
// $0111), then loops $38+1 times drawing via $c423 (with a nibble-carry bump of $37); JSRs $c772 $c423.
export function loc_c36e(m) {
  const { regs, mem } = m;
  if (!regs.fZ) {
    m.step(0xc3b9, 3);
    return m.ret(6);
  }
  m.step(0xc370, 2);
  mem.write8(0x37, regs.y); m.step(0xc372, 3);
  regs.a = mem.read8((0x032a + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc375, 4);
  mem.write8(0x61, regs.a); m.step(0xc377, 3);
  regs.a = mem.read8((0x031a + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc37a, 4);
  mem.write8(0x62, regs.a); m.step(0xc37c, 3);
  regs.a = mem.read8((0x034a + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc37f, 4);
  mem.write8(0x63, regs.a); m.step(0xc381, 3);
  regs.a = mem.read8((0x033a + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc384, 4);
  mem.write8(0x64, regs.a); m.step(0xc386, 3);
  regs.x = 0x61; regs.setNZ(regs.x); m.step(0xc388, 2);
  m.push16((0xc388 + 2) & 0xffff); m.step(0xc38b, 6); m.call(0xc772);
  regs.a = mem.read8(0x74); regs.setNZ(regs.a); m.step(0xc38d, 3);
  mem.write8(0xb0, regs.a); m.step(0xc38f, 3);
  regs.a = mem.read8(0x75); regs.setNZ(regs.a); m.step(0xc391, 3);
  mem.write8(0xb1, regs.a); m.step(0xc393, 3);
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xc395, 2);
  regs.a = mem.read8(0x0111); regs.setNZ(regs.a); m.step(0xc398, 4);
  if (regs.fZ) {
    m.step(0xc39b, 3);
  } else {
    m.step(0xc39a, 2);
    regs.x = regs.dec8(regs.x); m.step(0xc39b, 2);
  }
  regs.a = 0xc0; regs.setNZ(regs.a); m.step(0xc39d, 2);
  mem.write8(0x73, regs.a); m.step(0xc39f, 3);
  mem.write8(0x38, regs.x); m.step(0xc3a1, 3);
  while (true) {
    mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xc3a3, 5);
    regs.a = mem.read8(0x37); regs.setNZ(regs.a); m.step(0xc3a5, 3);
    regs.and(0x0f); m.step(0xc3a7, 2);
    regs.cmp(0x0f); m.step(0xc3a9, 2);
    if (!regs.fZ) {
      m.step(0xc3b2, 3);
    } else {
      m.step(0xc3ab, 2);
      regs.a = mem.read8(0x37); regs.setNZ(regs.a); m.step(0xc3ad, 3);
      regs.clc(); m.step(0xc3ae, 2);
      regs.adc(0x10); m.step(0xc3b0, 2);
      mem.write8(0x37, regs.a); m.step(0xc3b2, 3);
    }
    m.push16((0xc3b2 + 2) & 0xffff); m.step(0xc3b5, 6); m.call(0xc423);
    mem.write8(0x38, regs.dec8(mem.read8(0x38))); m.step(0xc3b7, 5);
    if (!regs.fN) { m.step(0xc3a1, 3); continue; }
    m.step(0xc3b9, 2); break;
  }
  return m.ret(6);
}
