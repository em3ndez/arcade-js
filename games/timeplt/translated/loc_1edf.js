// SPDX-License-Identifier: GPL-3.0-only

// loc_1edf  (ROM 0x1edf-0x1f00, Time Pilot)
export function loc_1edf(m) {
  const { regs, mem } = m;

  regs.ix = 0xa800;
  m.step(0x1ee3, 14); // 1edf  ld ix,0xa800
  regs.iy = 0xaa10;
  m.step(0x1ee7, 14); // 1ee3  ld iy,0xaa10

  regs.a = mem.read8(0xa800);
  m.step(0x1eea, 13); // 1ee7  ld a,(0xa800)
  regs.and(regs.a);
  m.step(0x1eeb, 4); // 1eea  and a

  if (regs.fZ) {
    m.ret(11); // ret z taken
    return;
  }
  m.step(0x1eec, 5); // ret z not taken

  regs.a = regs.inc8(regs.a);
  m.step(0x1eed, 4); // 1eec  inc a -- Z iff (0xa800) was 0xff

  if (regs.fNZ) {
    m.step(0x2010, 10); // jp nz taken
    return m.call(0x2010);
  }
  m.step(0x1ef0, 10); // jp nz not taken (jp cc costs 10 either way)

  regs.a = mem.read8(0xad30);
  m.step(0x1ef3, 13); // 1ef0  ld a,(0xad30)
  regs.and(regs.a);
  m.step(0x1ef4, 4); // 1ef3  and a

  if (regs.fZ) {
    m.step(0x214b, 10); // jp z taken
    return m.call(0x214b);
  }
  m.step(0x1ef7, 10); // jp z not taken

  m.push16(0x1efa);
  m.step(0x1ed1, 17); // 1ef7  call 0x1ed1
  m.call(0x1ed1);

  regs.and(0x0f);
  m.step(0x1efc, 7); // 1efa  and 0x0f -- low nibble of 0x1ed1's result

  if (regs.fNZ) {
    m.step(0x1f01, 12); // jr nz taken
    return m.call(0x1f01);
  }
  m.step(0x1efe, 7); // jr nz not taken

  m.step(0x1f42, 10); // 1efe  jp 0x1f42
  return m.call(0x1f42);
}
