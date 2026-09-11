// SPDX-License-Identifier: GPL-3.0-only
// loc_abac  (ROM 0xabac-0xac07) -- calls ac20 (edge check), writes 8 to $0100; if $071b|$071c|$071d==0
// calls ac36 (set $01c9 bits 0-1). Then per $01c9 bit0 copies a 0x18/0x0f-length block $ac08,x->$0606,x,
// per bit1 fills $0706,x with 1; if ($01c9&3) latches $0a&0xf8 -> $071e and $016a&3 -> $071f; finally
// clears $01c9 bits 0-1, rts.
export function loc_abac(m) {
  const { regs, mem } = m;
  m.push16(0xabae); m.step(0xabaf, 6); m.call(0xac20);
  regs.a = 0x08; regs.setNZ(regs.a); m.step(0xabb1, 2);
  mem.write8(0x0100, regs.a); m.step(0xabb4, 4);
  regs.a = mem.read8(0x071b); regs.setNZ(regs.a); m.step(0xabb7, 4);
  regs.ora(mem.read8(0x071c)); m.step(0xabba, 4);
  regs.ora(mem.read8(0x071d)); m.step(0xabbd, 4);
  if (regs.fNZ) {
    m.step(0xabc2, 3);
  } else {
    m.step(0xabbf, 2);
    m.push16(0xabc1); m.step(0xabc2, 6); m.call(0xac36);
  }
  regs.x = 0x17; regs.setNZ(regs.x); m.step(0xabc4, 2);
  regs.a = mem.read8(0x01c9); regs.setNZ(regs.a); m.step(0xabc7, 4);
  regs.and(0x01); m.step(0xabc9, 2);
  if (regs.fNZ) {
    m.step(0xabcd, 3);
  } else {
    m.step(0xabcb, 2);
    regs.x = 0x0e; regs.setNZ(regs.x); m.step(0xabcd, 2);
  }
  do {
    regs.a = mem.read8((0xac08 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xabd0, 4);
    mem.write8((0x0606 + regs.x) & 0xffff, regs.a); m.step(0xabd3, 5);
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xabd4, 2);
    if (regs.fN) { m.step(0xabd6, 2); break; }
    m.step(0xabcd, 3);
  } while (true);
  regs.x = 0x17; regs.setNZ(regs.x); m.step(0xabd8, 2);
  regs.a = mem.read8(0x01c9); regs.setNZ(regs.a); m.step(0xabdb, 4);
  regs.and(0x02); m.step(0xabdd, 2);
  if (regs.fNZ) {
    m.step(0xabe1, 3);
  } else {
    m.step(0xabdf, 2);
    regs.x = 0x0e; regs.setNZ(regs.x); m.step(0xabe1, 2);
  }
  do {
    regs.a = 0x01; regs.setNZ(regs.a); m.step(0xabe3, 2);
    mem.write8((0x0706 + regs.x) & 0xffff, regs.a); m.step(0xabe6, 5);
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xabe7, 2);
    if (regs.fN) { m.step(0xabe9, 2); break; }
    m.step(0xabe1, 3);
  } while (true);
  regs.a = mem.read8(0x01c9); regs.setNZ(regs.a); m.step(0xabec, 4);
  regs.and(0x03); m.step(0xabee, 2);
  if (regs.fZ) {
    m.step(0xabff, 3);
  } else {
    m.step(0xabf0, 2);
    regs.a = mem.read8(0x0a); regs.setNZ(regs.a); m.step(0xabf2, 3);
    regs.and(0xf8); m.step(0xabf4, 2);
    mem.write8(0x071e, regs.a); m.step(0xabf7, 4);
    regs.a = mem.read8(0x016a); regs.setNZ(regs.a); m.step(0xabfa, 4);
    regs.and(0x03); m.step(0xabfc, 2);
    mem.write8(0x071f, regs.a); m.step(0xabff, 4);
  }
  regs.a = mem.read8(0x01c9); regs.setNZ(regs.a); m.step(0xac02, 4);
  regs.and(0xfc); m.step(0xac04, 2);
  mem.write8(0x01c9, regs.a); m.step(0xac07, 4);
  return m.ret(6);
}
