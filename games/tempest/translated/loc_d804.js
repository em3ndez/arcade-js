// SPDX-License-Identifier: GPL-3.0-only
// loc_d804  (ROM 0xd804-0xd8a8) -- draws a set of vector items via jsr chains; a dec-counted draw loop,
// two masked-cmp branches ($4d & $d8b6,x), a clv/bvc merge, and falls through into loc_d8a9.
// NOTE: abs,x / abs,y reads charge the base 4 T here; add +1 on a real page cross (index-dependent).
export function loc_d804(m) {
  const { regs, mem } = m;
  m.push16((0xd804 + 2) & 0xffff); m.step(0xd807, 6); m.call(0xd6bb);
  m.push16((0xd807 + 2) & 0xffff); m.step(0xd80a, 6); m.call(0xaaa8);
  m.push16((0xd80a + 2) & 0xffff); m.step(0xd80d, 6); m.call(0xdd0d);
  m.push16((0xd80d + 2) & 0xffff); m.step(0xd810, 6); m.call(0xdd41);
  regs.a = mem.read8(0x0158); regs.setNZ(regs.a); m.step(0xd813, 4);
  mem.write8(0x37, regs.a); m.step(0xd815, 3);
  m.push16((0xd815 + 2) & 0xffff); m.step(0xd818, 6); m.call(0xdf53);
  regs.a = 0xe8; regs.setNZ(regs.a); m.step(0xd81a, 2);
  regs.x = 0xc0; regs.setNZ(regs.x); m.step(0xd81c, 2);
  m.push16((0xd81c + 2) & 0xffff); m.step(0xd81f, 6); m.call(0xdf75);
  for (;;) {
    regs.a = 0x32; regs.setNZ(regs.a); m.step(0xd821, 2);
    regs.x = 0x6c; regs.setNZ(regs.x); m.step(0xd823, 2);
    m.push16((0xd823 + 2) & 0xffff); m.step(0xd826, 6); m.call(0xdf39);
    mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xd828, 5);
    if (regs.fNZ) { m.step(0xd81f, 3); continue; }
    m.step(0xd82a, 2); break;
  }
  regs.a = mem.read8(0x016a); regs.setNZ(regs.a); m.step(0xd82d, 4);
  regs.and(0x03); m.step(0xd82f, 2);
  regs.a = regs.asl(regs.a); m.step(0xd830, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xd831, 2);
  regs.a = mem.read8((0x3f1f + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xd834, 4);
  regs.x = mem.read8((0x3f1e + regs.y) & 0xffff); regs.setNZ(regs.x); m.step(0xd837, 4);
  m.push16((0xd837 + 2) & 0xffff); m.step(0xd83a, 6); m.call(0xdf39);
  regs.a = mem.read8(0x0200); regs.setNZ(regs.a); m.step(0xd83d, 4);
  m.push16((0xd83d + 2) & 0xffff); m.step(0xd840, 6); m.call(0xadce);
  mem.write8(0x0200, regs.a); m.step(0xd843, 4);
  regs.and(0x06); m.step(0xd845, 2);
  m.push8(regs.a); m.step(0xd846, 3);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xd847, 2);
  regs.a = mem.read8((0x3f17 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xd84a, 4);
  regs.x = mem.read8((0x3f16 + regs.y) & 0xffff); regs.setNZ(regs.x); m.step(0xd84d, 4);
  m.push16((0xd84d + 2) & 0xffff); m.step(0xd850, 6); m.call(0xdf39);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xd851, 4);
  regs.a = regs.lsr(regs.a); m.step(0xd852, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xd853, 2);
  regs.a = mem.read8(0x4d); regs.setNZ(regs.a); m.step(0xd855, 3);
  regs.and(mem.read8((0xd8b6 + regs.x) & 0xffff)); m.step(0xd858, 4);
  regs.cmp(mem.read8((0xd8b6 + regs.x) & 0xffff)); m.step(0xd85b, 4);
  if (regs.fNZ) {
    m.step(0xd877, 3);
  } else {
    m.step(0xd85d, 2);
    regs.x = regs.dec8(regs.x); m.step(0xd85e, 2);
    regs.x = regs.dec8(regs.x); m.step(0xd85f, 2);
    if (regs.fPl) {
      m.step(0xd864, 3);
      if (regs.fNZ) {
        m.step(0xd86c, 3);
        m.push16((0xd86c + 2) & 0xffff); m.step(0xd86f, 6); m.call(0xdded);
        regs.a = mem.read8(0x01c9); regs.setNZ(regs.a); m.step(0xd872, 4);
        regs.ora(0x03); m.step(0xd874, 2);
        mem.write8(0x01c9, regs.a); m.step(0xd877, 4);
      } else {
        m.step(0xd866, 2);
        m.push16((0xd866 + 2) & 0xffff); m.step(0xd869, 6); m.call(0xdde9);
        regs.clv(); m.step(0xd86a, 2);
        m.step(0xd877, 3);
      }
    } else {
      m.step(0xd861, 2);
      m.step(0xd93f, 3); return m.call(0xd93f);
    }
  }
  regs.a = mem.read8(0x01ca); regs.setNZ(regs.a); m.step(0xd87a, 4);
  regs.and(mem.read8(0x01c6)); m.step(0xd87d, 4);
  if (regs.fZ) {
    m.step(0xd886, 3);
  } else {
    m.step(0xd87f, 2);
    regs.a = 0x34; regs.setNZ(regs.a); m.step(0xd881, 2);
    regs.x = 0x6e; regs.setNZ(regs.x); m.step(0xd883, 2);
    m.push16((0xd883 + 2) & 0xffff); m.step(0xd886, 6); m.call(0xdf39);
  }
  m.push16((0xd886 + 2) & 0xffff); m.step(0xd889, 6); m.call(0xdf53);
  regs.a = mem.read8(0x09); regs.setNZ(regs.a); m.step(0xd88b, 3);
  regs.and(0x1c); m.step(0xd88d, 2);
  regs.a = regs.lsr(regs.a); m.step(0xd88e, 2);
  regs.a = regs.lsr(regs.a); m.step(0xd88f, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xd890, 2);
  regs.a = mem.read8((0xd8ba + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xd893, 4);
  regs.y = 0xee; regs.setNZ(regs.y); m.step(0xd895, 2);
  regs.x = 0x1b; regs.setNZ(regs.x); m.step(0xd897, 2);
  m.push16((0xd897 + 2) & 0xffff); m.step(0xd89a, 6); m.call(0xd8a9);
  regs.a = mem.read8(0x09); regs.setNZ(regs.a); m.step(0xd89c, 3);
  regs.a = regs.lsr(regs.a); m.step(0xd89d, 2);
  regs.a = regs.lsr(regs.a); m.step(0xd89e, 2);
  regs.a = regs.lsr(regs.a); m.step(0xd89f, 2);
  regs.a = regs.lsr(regs.a); m.step(0xd8a0, 2);
  regs.a = regs.lsr(regs.a); m.step(0xd8a1, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xd8a2, 2);
  regs.a = mem.read8((0xd8c2 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xd8a5, 4);
  regs.y = 0x32; regs.setNZ(regs.y); m.step(0xd8a7, 2);
  regs.x = 0xf8; regs.setNZ(regs.x); m.step(0xd8a9, 2);
  return m.call(0xd8a9);
}
