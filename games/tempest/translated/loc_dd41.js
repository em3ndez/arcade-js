// SPDX-License-Identifier: GPL-3.0-only
// loc_dd41  (ROM 0xdd41-0xdddb) -- prologue: $6095:$6096 = $040c:$040d + ($040f:$0410 << 1), forced to 1
// if zero; $0409->$608d; jsr dce6 ($040a/$040b) -> A/Y stored to $0412/$0413; jsr df39 (A=$3d,X=$ce).
// Then 5 passes ($37 = 4..0) of binary->BCD double-dabble: read 3 bytes via ($3b) into $56-$58, 24 shifts
// (rol $56/$57/$58 + decimal-mode double of $31-$34), jsr dfb1 (A=$31,Y=4) then jsr df75 (A=$d0,X=$f8); rts.
export function loc_dd41(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x040f); regs.setNZ(regs.a); m.step(0xdd44, 4);
  regs.a = regs.asl(regs.a); m.step(0xdd45, 2);
  mem.write8(0x0029, regs.a); m.step(0xdd47, 3);
  regs.a = mem.read8(0x0410); regs.setNZ(regs.a); m.step(0xdd4a, 4);
  regs.a = regs.rol(regs.a); m.step(0xdd4b, 2);
  mem.write8(0x002a, regs.a); m.step(0xdd4d, 3);
  regs.a = mem.read8(0x040c); regs.setNZ(regs.a); m.step(0xdd50, 4);
  regs.clc(); m.step(0xdd51, 2);
  regs.adc(mem.read8(0x0029)); m.step(0xdd53, 3);
  mem.write8(0x6095, regs.a); m.step(0xdd56, 4);
  mem.write8(0x0029, regs.a); m.step(0xdd58, 3);
  regs.a = mem.read8(0x040d); regs.setNZ(regs.a); m.step(0xdd5b, 4);
  regs.adc(mem.read8(0x002a)); m.step(0xdd5d, 3);
  mem.write8(0x6096, regs.a); m.step(0xdd60, 4);
  regs.ora(mem.read8(0x0029)); m.step(0xdd62, 3);
  if (regs.fNZ) {
    m.step(0xdd69, 3);
  } else {
    m.step(0xdd64, 2);
    regs.a = 0x01; regs.setNZ(regs.a); m.step(0xdd66, 2);
    mem.write8(0x6095, regs.a); m.step(0xdd69, 4);
  }
  regs.a = mem.read8(0x0409); regs.setNZ(regs.a); m.step(0xdd6c, 4);
  mem.write8(0x608d, regs.a); m.step(0xdd6f, 4);
  regs.a = mem.read8(0x040a); regs.setNZ(regs.a); m.step(0xdd72, 4);
  regs.x = mem.read8(0x040b); regs.setNZ(regs.x); m.step(0xdd75, 4);
  m.push16(0xdd77); m.step(0xdd78, 6); m.call(0xdce6);
  mem.write8(0x0412, regs.a); m.step(0xdd7b, 4);
  mem.write8(0x0413, regs.y); m.step(0xdd7e, 4);
  regs.a = 0x3d; regs.setNZ(regs.a); m.step(0xdd80, 2);
  regs.x = 0xce; regs.setNZ(regs.x); m.step(0xdd82, 2);
  m.push16(0xdd84); m.step(0xdd85, 6); m.call(0xdf39);
  regs.a = 0x06; regs.setNZ(regs.a); m.step(0xdd87, 2);
  mem.write8(0x003b, regs.a); m.step(0xdd89, 3);
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0xdd8b, 2);
  mem.write8(0x003c, regs.a); m.step(0xdd8d, 3);
  mem.write8(0x0037, regs.a); m.step(0xdd8f, 3);
  while (true) {
    regs.y = 0x00; regs.setNZ(regs.y); m.step(0xdd91, 2);
    mem.write8(0x0031, regs.y); m.step(0xdd93, 3);
    mem.write8(0x0032, regs.y); m.step(0xdd95, 3);
    mem.write8(0x0033, regs.y); m.step(0xdd97, 3);
    mem.write8(0x0034, regs.y); m.step(0xdd99, 3);
    regs.a = mem.read8((mem.read16(0x003b) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xdd9b, 5);
    mem.write8(0x0056, regs.a); m.step(0xdd9d, 3);
    mem.write8(0x003b, regs.inc8(mem.read8(0x003b))); m.step(0xdd9f, 5);
    regs.a = mem.read8((mem.read16(0x003b) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xdda1, 5);
    mem.write8(0x0057, regs.a); m.step(0xdda3, 3);
    mem.write8(0x003b, regs.inc8(mem.read8(0x003b))); m.step(0xdda5, 5);
    regs.a = mem.read8((mem.read16(0x003b) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xdda7, 5);
    mem.write8(0x0058, regs.a); m.step(0xdda9, 3);
    mem.write8(0x003b, regs.inc8(mem.read8(0x003b))); m.step(0xddab, 5);
    regs.sed(); m.step(0xddac, 2);
    regs.y = 0x17; regs.setNZ(regs.y); m.step(0xddae, 2);
    mem.write8(0x0038, regs.y); m.step(0xddb0, 3);
    while (true) {
      mem.write8(0x0056, regs.rol(mem.read8(0x0056))); m.step(0xddb2, 5);
      mem.write8(0x0057, regs.rol(mem.read8(0x0057))); m.step(0xddb4, 5);
      mem.write8(0x0058, regs.rol(mem.read8(0x0058))); m.step(0xddb6, 5);
      regs.y = 0x03; regs.setNZ(regs.y); m.step(0xddb8, 2);
      regs.x = 0x00; regs.setNZ(regs.x); m.step(0xddba, 2);
      while (true) {
        regs.a = mem.read8((0x0031 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xddbc, 4);
        regs.adc(mem.read8((0x0031 + regs.x) & 0xff)); m.step(0xddbe, 4);
        mem.write8((0x0031 + regs.x) & 0xff, regs.a); m.step(0xddc0, 4);
        regs.x = regs.inc8(regs.x); m.step(0xddc1, 2);
        regs.y = regs.dec8(regs.y); m.step(0xddc2, 2);
        if (!regs.fN) { m.step(0xddba, 3); continue; }
        m.step(0xddc4, 2); break;
      }
      mem.write8(0x0038, regs.dec8(mem.read8(0x0038))); m.step(0xddc6, 5);
      if (!regs.fN) { m.step(0xddb0, 3); continue; }
      m.step(0xddc8, 2); break;
    }
    regs.cld(); m.step(0xddc9, 2);
    regs.a = 0x31; regs.setNZ(regs.a); m.step(0xddcb, 2);
    regs.y = 0x04; regs.setNZ(regs.y); m.step(0xddcd, 2);
    m.push16(0xddcf); m.step(0xddd0, 6); m.call(0xdfb1);
    regs.a = 0xd0; regs.setNZ(regs.a); m.step(0xddd2, 2);
    regs.x = 0xf8; regs.setNZ(regs.x); m.step(0xddd4, 2);
    m.push16(0xddd6); m.step(0xddd7, 6); m.call(0xdf75);
    mem.write8(0x0037, regs.dec8(mem.read8(0x0037))); m.step(0xddd9, 5);
    if (!regs.fN) { m.step(0xdd8f, 3); continue; }
    m.step(0xdddb, 2); break;
  }
  return m.ret(6);
}
