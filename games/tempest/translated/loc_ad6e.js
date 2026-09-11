// SPDX-License-Identifier: GPL-3.0-only
// loc_ad6e  (ROM 0xad6e-0xadcd) -- per-frame tick of the active $0606,x slot: clamp its value via
// loc_adce, gate on $4e bits 3-4, then step $0602/$0604 (jsr $ddf7/$ad22 to re-arm, or zero the slot).
export function loc_ad6e(m) {
  const { regs, mem } = m;
  regs.a = 0x06; regs.setNZ(regs.a); m.step(0xad70, 2);
  mem.write8(0x0001, regs.a); m.step(0xad72, 3);
  regs.a = mem.read8(0x0003); regs.setNZ(regs.a); m.step(0xad74, 3);
  regs.and(0x1f); m.step(0xad76, 2);
  if (regs.fZ) {
    m.step(0xad78, 2);
    mem.write8(0x0605, regs.dec8(mem.read8(0x0605))); m.step(0xad7b, 6);
    if (regs.fZ) {
      m.step(0xad7d, 2);
      regs.y = 0x14; regs.setNZ(regs.y); m.step(0xad7f, 2);
      mem.write8(0x0000, regs.y); m.step(0xad81, 3);
      return m.ret(6);
    }
    m.step(0xad82, 3);
  } else {
    m.step(0xad82, 3);
  }
  // ad82:
  regs.x = mem.read8(0x0602); regs.setNZ(regs.x); m.step(0xad85, 4);
  regs.a = mem.read8((0x0606 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xad88, 4);
  m.push16(0xad8a); m.step(0xad8b, 6); m.call(0xadce);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xad8c, 2);
  if (!regs.fN) {
    // bpl taken: positive slot value -> clamp-high path (cmp #0x1b)
    m.step(0xad93, 3);
    regs.cmp(0x1b); m.step(0xad95, 2);
    if (regs.fC) {
      m.step(0xad97, 2);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0xad99, 2);
    } else {
      m.step(0xad99, 3);
    }
  } else {
    m.step(0xad8e, 2);
    regs.a = 0x1a; regs.setNZ(regs.a); m.step(0xad90, 2);
    regs.clv(); m.step(0xad91, 2);
    m.step(0xad99, 3);
  }
  // ad99:
  regs.x = mem.read8(0x0602); regs.setNZ(regs.x); m.step(0xad9c, 4);
  mem.write8((0x0606 + regs.x) & 0xffff, regs.a); m.step(0xad9f, 5);
  regs.a = mem.read8(0x004e); regs.setNZ(regs.a); m.step(0xada1, 3);
  regs.and(0x18); m.step(0xada3, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xada4, 2);
  regs.a = mem.read8(0x004e); regs.setNZ(regs.a); m.step(0xada6, 3);
  regs.and(0x67); m.step(0xada8, 2);
  mem.write8(0x004e, regs.a); m.step(0xadaa, 3);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xadab, 2);
  if (regs.fZ) { m.step(0xadcd, 3); return m.ret(6); }
  m.step(0xadad, 2);
  mem.write8(0x0602, regs.dec8(mem.read8(0x0602))); m.step(0xadb0, 6);
  mem.write8(0x0604, regs.dec8(mem.read8(0x0604))); m.step(0xadb3, 6);
  if (regs.fN) {
    m.step(0xadb5, 2);
    regs.x = mem.read8(0x003d); regs.setNZ(regs.x); m.step(0xadb7, 3);
    regs.a = mem.read8((0x0600 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xadba, 4);
    regs.cmp(0x04); m.step(0xadbc, 2);
    if (regs.fNC) {
      m.step(0xadbe, 2);
      m.push16(0xadc0); m.step(0xadc1, 6); m.call(0xddf7);
    } else {
      m.step(0xadc1, 3);
    }
    // adc1:
    m.push16(0xadc3); m.step(0xadc4, 6); m.call(0xad22);
    regs.clv(); m.step(0xadc5, 2);
    m.step(0xadcd, 3);
    return m.ret(6);
  }
  m.step(0xadc7, 3);
  regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xadc8, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xadca, 2);
  mem.write8((0x0606 + regs.x) & 0xffff, regs.a); m.step(0xadcd, 5);
  return m.ret(6);
}
