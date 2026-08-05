// SPDX-License-Identifier: GPL-3.0-only

// loc_2cbc  (ROM 0x2CBC–0x2CDA, plus 0x2CF5–0x2D14)
export function loc_2cbc(m) {
  const { regs, mem } = m;

  regs.ix = 0xa900;
  m.step(0x2cc0, 14); // ld ix,0xa900
  regs.iy = 0xaa30;
  m.step(0x2cc4, 14); // ld iy,0xaa30
  regs.a = mem.read8(0xad04);
  m.step(0x2cc7, 13); // ld a,(0xad04)
  regs.and(regs.a);
  m.step(0x2cc8, 4); // and a

  if (regs.fZ) {
    m.step(0x2cf5, 12); // jr z,0x2cf5 taken

    for (const [target, ret] of [
      [0x2d15, 0x2cf8], [0x2d36, 0x2cfb], [0x2d36, 0x2cfe], [0x2d68, 0x2d01],
    ]) {
      m.push16(ret);
      m.step(target, 17); // call target
      m.call(target);
    }
    m.ret(); // 0x2d01
    return;
  }
  m.step(0x2cca, 7); // jr z not taken

  regs.cp(0x04);
  m.step(0x2ccc, 7); // cp 0x04
  if (regs.fZ) {
    m.step(0x2d02, 12); // jr z,0x2d02 taken

    for (const [target, ret] of [
      [0x2d2d, 0x2d05], [0x2d2d, 0x2d08], [0x2d62, 0x2d0b],
      [0x2d62, 0x2d0e], [0x2d68, 0x2d11], [0x2d68, 0x2d14],
    ]) {
      m.push16(ret);
      m.step(target, 17); // call target
      m.call(target);
    }
    m.ret(); // 0x2d14
    return;
  }
  m.step(0x2cce, 7); // jr z not taken

  for (const [target, ret] of [
    [0x2d21, 0x2cd1], [0x2d36, 0x2cd4], [0x2d36, 0x2cd7], [0x2d68, 0x2cda],
  ]) {
    m.push16(ret);
    m.step(target, 17); // call target
    m.call(target);
  }

  m.ret(); // 0x2cda
}
