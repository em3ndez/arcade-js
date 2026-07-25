// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1d51  (ROM 0x1D51–0x1D64) — phase-1 arm: adjust (0x6203), toggle 0x6224, conditionally trigger sound.
 */
export function loc_1d51(m) {
  const { regs, mem } = m;
  regs.l = (regs.l - 1) & 0xff;
  m.step(0x1d52, 4); // dec l (hl 0x6205 -> 0x6204)
  regs.l = (regs.l - 1) & 0xff;
  m.step(0x1d53, 4); // dec l -> 0x6203
  regs.a = mem.read8(regs.hl);
  m.step(0x1d54, 7); // ld a,(hl)  (0x6203)
  regs.or(0x03);
  m.step(0x1d56, 7); // or 0x03
  regs.a = regs.res(2, regs.a); // res 2,a -- RETURNS the value (cpu.js res())
  m.step(0x1d58, 8); // res 2,a
  mem.write8(regs.hl, regs.a);
  m.step(0x1d59, 7); // ld (hl),a
  regs.a = mem.read8(0x6224);
  m.step(0x1d5c, 13); // ld a,(0x6224)
  regs.xor(0x01);
  m.step(0x1d5e, 7); // xor 0x01
  mem.write8(0x6224, regs.a);
  m.step(0x1d61, 13); // ld (0x6224),a
  if (regs.fZ) {
    m.push16(0x1d64); // call z,0x1d8f taken -- pushes return
    m.step(0x1d8f, 17);
    m.call(0x1d8f); // sound trigger (rets to 0x1d64)
  } else {
    m.step(0x1d64, 10); // call z NOT taken
  }
  m.step(0x1d49, 10); // jp 0x1d49
  return m.call(0x1d49);
}
