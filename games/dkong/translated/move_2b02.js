// SPDX-License-Identifier: GPL-3.0-only

/**
 * move_2b02  (ROM 0x2B02–0x2B1B) — A=velocity: X+=A, mirror 0x694C, clamp via sub_241F, edge-adjust X.
 */
export function move_2b02(m) {
  const { regs, mem } = m;
  regs.add(regs.b);
  m.step(0x2b03, 4); // velocity + X
  mem.write8(0x6203, regs.a);
  m.step(0x2b06, 13);
  mem.write8(0x694c, regs.a);
  m.step(0x2b09, 13); // mirror
  m.push16(0x2b0c); m.step(0x241f, 17); m.call(0x241f); // clamp -> DE
  regs.hl = 0x6203;
  m.step(0x2b0f, 10);
  regs.e = regs.dec8(regs.e);
  m.step(0x2b10, 4);
  if (regs.fZ) {
    m.step(0x2b18, 10); // right edge -> dec X
    mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
    m.step(0x2b19, 11);
    m.ret(10);
    return;
  }
  m.step(0x2b13, 10);
  regs.d = regs.dec8(regs.d);
  m.step(0x2b14, 4);
  if (regs.fZ) {
    m.step(0x2b1a, 10); // left edge -> inc X
    mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
    m.step(0x2b1b, 11);
    m.ret(10);
    return;
  }
  m.step(0x2b17, 10);
  m.ret(10);
}
