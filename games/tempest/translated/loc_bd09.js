// SPDX-License-Identifier: GPL-3.0-only
// loc_bd09  (ROM 0xbd09-0xbd3d) -- calls c098/c765/bd3e, builds a 2-byte vector-list entry at (0x74),y
// from $78 (color/intensity nibble + 0x60), reloads x/a from the $cec8/$cec9 table indexed by $55,
// then tail-jumps to 0xdf59.
export function loc_bd09(m) {
  const { regs, mem } = m;
  m.push16(0xbd0b); m.step(0xbd0c, 6); m.call(0xc098);
  regs.x = 0x61; regs.setNZ(regs.x); m.step(0xbd0e, 2);
  m.push16(0xbd10); m.step(0xbd11, 6); m.call(0xc765);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xbd13, 2);
  mem.write8(0x00a9, regs.a); m.step(0xbd15, 3);
  m.push16(0xbd17); m.step(0xbd18, 6); m.call(0xbd3e);
  regs.a = mem.read8(0x0078); regs.setNZ(regs.a); m.step(0xbd1a, 3);
  regs.eor(0x07); m.step(0xbd1c, 2);
  regs.a = regs.asl(regs.a); m.step(0xbd1d, 2);
  regs.cmp(0x0a); m.step(0xbd1f, 2);
  // bd1f bcs 0xbd23
  if (regs.fC) {
    m.step(0xbd23, 3);
  } else {
    m.step(0xbd21, 2);
    regs.a = 0x0a; regs.setNZ(regs.a); m.step(0xbd23, 2);
  }
  regs.a = regs.asl(regs.a); m.step(0xbd24, 2);
  regs.a = regs.asl(regs.a); m.step(0xbd25, 2);
  regs.a = regs.asl(regs.a); m.step(0xbd26, 2);
  regs.a = regs.asl(regs.a); m.step(0xbd27, 2);
  mem.write8(((mem.read8(0x0074) | (mem.read8(0x0075) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xbd29, 6);
  regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xbd2a, 2);
  regs.a = 0x60; regs.setNZ(regs.a); m.step(0xbd2c, 2);
  mem.write8(((mem.read8(0x0074) | (mem.read8(0x0075) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xbd2e, 6);
  regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0xbd2f, 2);
  mem.write8(0x00a9, regs.y); m.step(0xbd31, 3);
  regs.y = mem.read8(0x0055); regs.setNZ(regs.y); m.step(0xbd33, 3);
  regs.x = mem.read8((0xcec9 + regs.y) & 0xffff); regs.setNZ(regs.x); m.step(0xbd36, 4);
  regs.a = mem.read8((0xcec8 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbd39, 4);
  regs.y = mem.read8(0x00a9); regs.setNZ(regs.y); m.step(0xbd3b, 3);
  m.step(0xdf59, 3); return m.call(0xdf59);
}
