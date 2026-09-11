// SPDX-License-Identifier: GPL-3.0-only
// loc_bd3e  (ROM 0xbd3e-0xbd9f) -- given $57: if <0x10 emit the trivial (a=1,y=0) form, else drive the
// EAROM/math-box at $6040/$6060/$6070 (16-bit subtract to $6095/$6096, spin on $6040 bit7, normalize
// $79 through a into an exponent in $78) then write a 2-byte (mantissa, exponent|0x70) entry at (0x74),y.
export function loc_bd3e(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0057); regs.setNZ(regs.a); m.step(0xbd40, 3);
  regs.cmp(0x10); m.step(0xbd42, 2);
  // bd42 bcc 0xbd8c
  if (regs.fNC) {
    m.step(0xbd8c, 3);
    regs.a = 0x01; regs.setNZ(regs.a); m.step(0xbd8e, 2);
    regs.y = 0x00; regs.setNZ(regs.y); m.step(0xbd90, 2);
  } else {
    m.step(0xbd44, 2);
    regs.sec(); m.step(0xbd45, 2);
    regs.sbc(mem.read8(0x005f)); m.step(0xbd47, 3);
    mem.write8(0x6095, regs.a); m.step(0xbd4a, 4);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xbd4c, 2);
    regs.sbc(mem.read8(0x005b)); m.step(0xbd4e, 3);
    mem.write8(0x6096, regs.a); m.step(0xbd51, 4);
    regs.a = 0x18; regs.setNZ(regs.a); m.step(0xbd53, 2);
    mem.write8(0x608c, regs.a); m.step(0xbd56, 4);
    regs.a = mem.read8(0x00a0); regs.setNZ(regs.a); m.step(0xbd58, 3);
    mem.write8(0x608e, regs.a); m.step(0xbd5b, 4);
    mem.write8(0x6094, regs.a); m.step(0xbd5e, 4);
    // bd5e bit 0x6040 / bd61 bmi 0xbd5e -- spin while $6040 bit7 set
    while (true) {
      regs.bit(mem.read8(0x6040)); m.step(0xbd61, 4);
      if (regs.fN) { m.step(0xbd5e, 3); continue; }
      m.step(0xbd63, 2); break;
    }
    regs.a = mem.read8(0x6060); regs.setNZ(regs.a); m.step(0xbd66, 4);
    mem.write8(0x0079, regs.a); m.step(0xbd68, 3);
    regs.a = mem.read8(0x6070); regs.setNZ(regs.a); m.step(0xbd6b, 4);
    mem.write8(0x007a, regs.a); m.step(0xbd6d, 3);
    regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xbd6f, 2);
    mem.write8(0x608c, regs.x); m.step(0xbd72, 4);
    regs.sec(); m.step(0xbd73, 2);
    regs.sbc(0x01); m.step(0xbd75, 2);
    // bd75 bne 0xbd79
    if (regs.fZ) {
      m.step(0xbd77, 2);
      regs.a = 0x01; regs.setNZ(regs.a); m.step(0xbd79, 2);
    } else {
      m.step(0xbd79, 3);
    }
    regs.x = 0x00; regs.setNZ(regs.x); m.step(0xbd7b, 2);
    // bd7b inx / bd7c asl 0x79 / bd7e rol a / bd7f bcc 0xbd7b -- normalize loop
    while (true) {
      regs.x = (regs.x + 1) & 0xff; regs.setNZ(regs.x); m.step(0xbd7c, 2);
      mem.write8(0x0079, regs.asl(mem.read8(0x0079))); m.step(0xbd7e, 5);
      regs.a = regs.rol(regs.a); m.step(0xbd7f, 2);
      if (regs.fNC) { m.step(0xbd7b, 3); continue; }
      m.step(0xbd81, 2); break;
    }
    regs.a = regs.lsr(regs.a); m.step(0xbd82, 2);
    regs.eor(0x7f); m.step(0xbd84, 2);
    regs.clc(); m.step(0xbd85, 2);
    regs.adc(0x01); m.step(0xbd87, 2);
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0xbd88, 2);
    regs.a = regs.x; regs.setNZ(regs.a); m.step(0xbd89, 2);
    regs.clv(); m.step(0xbd8a, 2);
    m.step(0xbd90, 3);
  }
  // bd90 convergence
  mem.write8(0x0078, regs.a); m.step(0xbd92, 3);
  m.push8(regs.a); m.step(0xbd93, 3);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xbd94, 2);
  regs.y = mem.read8(0x00a9); regs.setNZ(regs.y); m.step(0xbd96, 3);
  mem.write8(((mem.read8(0x0074) | (mem.read8(0x0075) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xbd98, 6);
  regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xbd99, 2);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xbd9a, 4);
  regs.ora(0x70); m.step(0xbd9c, 2);
  mem.write8(((mem.read8(0x0074) | (mem.read8(0x0075) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xbd9e, 6);
  regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xbd9f, 2);
  return m.ret(6);
}
