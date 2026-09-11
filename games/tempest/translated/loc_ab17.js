// SPDX-License-Identifier: GPL-3.0-only
// loc_ab17  (ROM 0xab17-0xab97) -- vector-list drawer: reads a list ptr from ($ac),x35; sets scale/pos
// via loc_ab0d/df6a/df75/b0d1/b0dd; then loops list at ($3b) emitting word pairs from $31e4,x into
// ($74),y until a bit7-set entry; tail-jmp loc_df5f. (zp),y timings: lda=5(+1 cross), sta=6.
export function loc_ab17(m) {
  const { regs, mem } = m;
  mem.write8(0x35, regs.x); m.step(0xab19, 3);
  mem.write8(0x2b, regs.a); m.step(0xab1b, 3);
  regs.y = mem.read8(0x35); regs.setNZ(regs.y); m.step(0xab1d, 3);
  regs.a = mem.read8(((mem.read8(0xac) | (mem.read8(0xad) << 8)) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xab1f, 5);
  mem.write8(0x3b, regs.a); m.step(0xab21, 3);
  regs.y = regs.inc8(regs.y); m.step(0xab22, 2);
  regs.a = mem.read8(((mem.read8(0xac) | (mem.read8(0xad) << 8)) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xab24, 5);
  mem.write8(0x3c, regs.a); m.step(0xab26, 3);
  regs.cpx(0x2c); m.step(0xab28, 2);
  if (regs.fNZ) {
    m.step(0xab32, 3);
  } else {
    m.step(0xab2a, 2);
    regs.a = mem.read8(0x74); regs.setNZ(regs.a); m.step(0xab2c, 3);
    mem.write8(0xb6, regs.a); m.step(0xab2e, 3);
    regs.a = mem.read8(0x75); regs.setNZ(regs.a); m.step(0xab30, 3);
    mem.write8(0xb7, regs.a); m.step(0xab32, 3);
  }
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xab34, 2);
  regs.a = mem.read8(((mem.read8(0x3b) | (mem.read8(0x3c) << 8)) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xab36, 5);
  mem.write8(0x2a, regs.a); m.step(0xab38, 3);
  m.push16(0xab3a); m.step(0xab3b, 6); m.call(0xab0d);
  // loc_ab98 tail-enters here at 0xab3b
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xab3d, 2);
  mem.write8(0x73, regs.a); m.step(0xab3f, 3);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xab41, 2);
  mem.write8(0x72, regs.a); m.step(0xab43, 3);
  m.push16(0xab45); m.step(0xab46, 6); m.call(0xdf6a);
  regs.a = mem.read8(0x2a); regs.setNZ(regs.a); m.step(0xab48, 3);
  regs.x = mem.read8(0x2b); regs.setNZ(regs.x); m.step(0xab4a, 3);
  m.push16(0xab4c); m.step(0xab4d, 6); m.call(0xdf75);
  regs.y = mem.read8(0x35); regs.setNZ(regs.y); m.step(0xab4f, 3);
  regs.a = mem.read8(((mem.read8(0xac) | (mem.read8(0xad) << 8)) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xab51, 5);
  mem.write8(0x3b, regs.a); m.step(0xab53, 3);
  regs.y = regs.inc8(regs.y); m.step(0xab54, 2);
  regs.a = mem.read8(((mem.read8(0xac) | (mem.read8(0xad) << 8)) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xab56, 5);
  mem.write8(0x3c, regs.a); m.step(0xab58, 3);
  regs.x = mem.read8(0x35); regs.setNZ(regs.x); m.step(0xab5a, 3);
  regs.a = mem.read8((0xd121 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xab5d, 4);
  m.push8(regs.a); m.step(0xab5e, 3);
  regs.a = regs.lsr(regs.a); m.step(0xab5f, 2);
  regs.a = regs.lsr(regs.a); m.step(0xab60, 2);
  regs.a = regs.lsr(regs.a); m.step(0xab61, 2);
  regs.a = regs.lsr(regs.a); m.step(0xab62, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xab63, 2);
  m.push16(0xab65); m.step(0xab66, 6); m.call(0xb0d1);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xab67, 4);
  regs.and(0x0f); m.step(0xab69, 2);
  m.push16(0xab6b); m.step(0xab6c, 6); m.call(0xb0dd);
  regs.y = 0x01; regs.setNZ(regs.y); m.step(0xab6e, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xab70, 2);
  mem.write8(0x2a, regs.a); m.step(0xab72, 3);
  do {
    regs.a = mem.read8(((mem.read8(0x3b) | (mem.read8(0x3c) << 8)) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xab74, 5);
    mem.write8(0x2b, regs.a); m.step(0xab76, 3);
    regs.and(0x7f); m.step(0xab78, 2);
    regs.y = regs.inc8(regs.y); m.step(0xab79, 2);
    mem.write8(0x2c, regs.y); m.step(0xab7b, 3);
    regs.x = regs.a; regs.setNZ(regs.x); m.step(0xab7c, 2);
    regs.a = mem.read8((0x31e4 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xab7f, 4);
    regs.y = mem.read8(0x2a); regs.setNZ(regs.y); m.step(0xab81, 3);
    mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xab83, 6);
    regs.y = regs.inc8(regs.y); m.step(0xab84, 2);
    regs.a = mem.read8((0x31e5 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xab87, 4);
    mem.write8(((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xab89, 6);
    regs.y = regs.inc8(regs.y); m.step(0xab8a, 2);
    mem.write8(0x2a, regs.y); m.step(0xab8c, 3);
    regs.y = mem.read8(0x2c); regs.setNZ(regs.y); m.step(0xab8e, 3);
    regs.bit(mem.read8(0x2b)); m.step(0xab90, 3);
    if (regs.fPl) { m.step(0xab72, 3); continue; }
    m.step(0xab92, 2);
    break;
  } while (true);
  regs.y = mem.read8(0x2a); regs.setNZ(regs.y); m.step(0xab94, 3);
  regs.y = regs.dec8(regs.y); m.step(0xab95, 2);
  m.step(0xdf5f, 3); return m.call(0xdf5f);
}
