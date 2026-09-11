// SPDX-License-Identifier: GPL-3.0-only
// loc_df92  (ROM 0xdf92-0xdfb0) -- emit a 4-byte vector record from ($00..$03,x): x,y (hi bytes masked
// 5 bits), and the last byte xor'd through $73 (mask 5 bits). Entry loc_dfac stores that last byte and
// bne loc_df5f (advance cursor); the fall-path continues into loc_dfb1.
export function loc_df92(m) {
  const { regs, mem } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xdf94, 2);
  regs.a = mem.read8((0x02 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xdf96, 4);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xdf98, 6);
  regs.a = mem.read8((0x03 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xdf9a, 4);
  regs.and(0x1f); m.step(0xdf9c, 2);
  regs.y = regs.inc8(regs.y); m.step(0xdf9d, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xdf9f, 6);
  regs.a = mem.read8((0x00 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xdfa1, 4);
  regs.y = regs.inc8(regs.y); m.step(0xdfa2, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xdfa4, 6);
  regs.a = mem.read8((0x01 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xdfa6, 4);
  regs.eor(mem.read8(0x73)); m.step(0xdfa8, 3);
  regs.and(0x1f); m.step(0xdfaa, 2);
  regs.eor(mem.read8(0x73)); m.step(0xdfac, 3);
  return loc_dfac(m);
}

export function loc_dfac(m) {
  const { regs, mem } = m;
  regs.y = regs.inc8(regs.y); m.step(0xdfad, 2);
  mem.write8((mem.read16(0x0074) + regs.y) & 0xffff, regs.a); m.step(0xdfaf, 6);
  if (regs.fNZ) { m.step(0xdf5f, 3); return m.call(0xdf5f); }
  m.step(0xdfb1, 2); return m.call(0xdfb1);
}
