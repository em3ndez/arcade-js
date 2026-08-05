// SPDX-License-Identifier: GPL-3.0-only

// loc_3dda  (ROM 0x3DDA–0x3DEA)
export function loc_3dda(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad04);
  m.step(0x3ddd, 13); // ld a,(0xad04)
  regs.a = regs.dec8(regs.a);
  m.step(0x3dde, 4); // dec a
  if (regs.fNZ) {
    m.ret(11); // ret nz
    return;
  }
  m.step(0x3ddf, 5); // ret nz not taken

  regs.ix = 0xa8e0;
  m.step(0x3de3, 14); // ld ix,0xa8e0
  regs.iy = 0xaa2c;
  m.step(0x3de7, 14); // ld iy,0xaa2c

  m.push16(0x3dea);
  m.step(0x3deb, 17); // call 0x3deb
  m.call(0x3deb);

  m.ret(); // 0x3dea
}
