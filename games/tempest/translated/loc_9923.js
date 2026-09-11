// SPDX-License-Identifier: GPL-3.0-only
// loc_9923  (ROM 0x9923-0x994c) -- on a slot timer expiry: seed $29=0xf0, $2a=$0203,x, save x in $35, call
// loc_99a5; if $29 still set, call loc_994d to allocate a slot; on success dec $03ab and clear the slot
// timer $0243,x, else set $2f=0xff and re-arm the timer (inc $0243,x).
export function loc_9923(m) {
  const { regs, mem } = m;
  regs.a = 0xf0; regs.setNZ(regs.a); m.step(0x9925, 2);
  mem.write8(0x29, regs.a); m.step(0x9927, 3);
  regs.a = mem.read8((0x0203 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x992a, 4);
  mem.write8(0x2a, regs.a); m.step(0x992c, 3);
  mem.write8(0x35, regs.x); m.step(0x992e, 3);
  m.push16(0x9930); m.step(0x9931, 6); m.call(0x99a5);
  regs.x = mem.read8(0x35); regs.setNZ(regs.x); m.step(0x9933, 3);
  regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0x9935, 3);
  if (regs.fZ) {
    m.step(0x9945, 3);
  } else {
    m.step(0x9937, 2);
    m.push16(0x9939); m.step(0x993a, 6); m.call(0x994d);
    if (regs.fZ) {
      m.step(0x9945, 3);
    } else {
      m.step(0x993c, 2);
      { const v = (mem.read8(0x03ab) - 1) & 0xff; mem.write8(0x03ab, v); regs.setNZ(v); } m.step(0x993f, 6);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9941, 2);
      mem.write8((0x0243 + regs.x) & 0xffff, regs.a); m.step(0x9944, 5);
      return m.ret(6);
    }
  }
  // 9945
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0x9947, 2);
  mem.write8(0x2f, regs.a); m.step(0x9949, 3);
  { const v = (mem.read8((0x0243 + regs.x) & 0xffff) + 1) & 0xff; mem.write8((0x0243 + regs.x) & 0xffff, v); regs.setNZ(v); } m.step(0x994c, 7);
  return m.ret(6);
}
