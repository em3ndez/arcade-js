// SPDX-License-Identifier: GPL-3.0-only

// loc_3dfb  (ROM 0x3DFB–0x3E04)
export function loc_3dfb(m) {
  const { regs, mem } = m;

  m.push16(0x3dfe);
  m.step(0x40ab, 17); // call 0x40ab
  m.call(0x40ab);

  regs.a = mem.read8(0xa8f6);
  m.step(0x3e01, 13); // ld a,(0xa8f6)
  mem.write8((regs.ix + 0x0e) & 0xffff, regs.a);
  m.step(0x3e04, 19); // ld (ix+0x0e),a

  m.ret(); // 3e04
}
