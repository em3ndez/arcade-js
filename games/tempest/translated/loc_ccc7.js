// SPDX-License-Identifier: GPL-3.0-only
// loc_ccc7  (ROM 0xccc7-0xcce9) -- register a sound: A=sound id -> Y, scan channel table $cb01,y over the 16
//   channel slots (x=0x0f..0); first nonzero table byte claims slot x ($bf=x, $c0,x=byte, $e0,x/$f0,x=1,
//   $bf=0xff), then loops. Restores X/Y from $31/$32 and RTS.
export function loc_ccc7(m) {
  const { regs, mem } = m;
  mem.write8(0x31, regs.x); m.step(0xccc9, 3);
  mem.write8(0x32, regs.y); m.step(0xcccb, 3);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xcccc, 2);
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xccce, 2);
  while (true) {
    { const b = 0xcb01, ad = (b + regs.y) & 0xffff, pc = ((b ^ ad) & 0xff00) ? 1 : 0;
      regs.a = mem.read8(ad); regs.setNZ(regs.a); m.step(0xccd1, 4 + pc); }
    if (regs.fZ) {
      m.step(0xcce1, 3);
    } else {
      m.step(0xccd3, 2);
      mem.write8(0xbf, regs.x); m.step(0xccd5, 3);
      mem.write8((0xc0 + regs.x) & 0xff, regs.a); m.step(0xccd7, 4);
      regs.a = 0x01; regs.setNZ(regs.a); m.step(0xccd9, 2);
      mem.write8((0xe0 + regs.x) & 0xff, regs.a); m.step(0xccdb, 4);
      mem.write8((0xf0 + regs.x) & 0xff, regs.a); m.step(0xccdd, 4);
      regs.a = 0xff; regs.setNZ(regs.a); m.step(0xccdf, 2);
      mem.write8(0xbf, regs.a); m.step(0xcce1, 3);
    }
    regs.y = regs.dec8(regs.y); m.step(0xcce2, 2);
    regs.x = regs.dec8(regs.x); m.step(0xcce3, 2);
    if (regs.fPl) { m.step(0xccce, 3); continue; }
    m.step(0xcce5, 2); break;
  }
  regs.x = mem.read8(0x31); regs.setNZ(regs.x); m.step(0xcce7, 3);
  regs.y = mem.read8(0x32); regs.setNZ(regs.y); m.step(0xcce9, 3);
  return m.ret(6);
}
