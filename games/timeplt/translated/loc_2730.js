// SPDX-License-Identifier: GPL-3.0-only

// loc_2730  (ROM 0x2730-0x2754, Time Pilot)
export function loc_2730(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xaa6f);
  m.step(0x2733, 13); // 2730  ld a,(0xaa6f)
  regs.cp(0x76);
  m.step(0x2735, 7); // 2733  cp 0x76

  if (regs.fNZ) {
    m.step(0x2530, 10); // 2735  jp nz,0x2530
    return m.call(0x2530);
  }
  m.step(0x2738, 10); // 2735  jp nz not taken

  m.push16(0x273b);
  m.step(0x0b2b, 17); // 2738  call 0x0b2b
  m.call(0x0b2b);

  m.push16(0x273e);
  m.step(0x210e, 17); // 273b  call 0x210e
  m.call(0x210e);

  regs.xor(regs.a);
  m.step(0x273f, 4); // 273e  xor a
  mem.write8(0xad31, regs.a);
  m.step(0x2742, 13); // 273f  ld (0xad31),a
  mem.write8(0xad20, regs.a);
  m.step(0x2745, 13); // 2742  ld (0xad20),a
  mem.write8(0xad30, regs.a);
  m.step(0x2748, 13); // 2745  ld (0xad30),a
  mem.write8(0xa9ac, regs.a);
  m.step(0x274b, 13); // 2748  ld (0xa9ac),a

  regs.a = regs.inc8(regs.a);
  m.step(0x274c, 4); // 274b  inc a
  mem.write8(0xad10, regs.a);
  m.step(0x274f, 13); // 274c  ld (0xad10),a

  regs.a = 0x03;
  m.step(0x2751, 7); // 274f  ld a,0x03
  mem.write8(0xa9ab, regs.a);
  m.step(0x2754, 13); // 2751  ld (0xa9ab),a

  m.ret(); // 2754  ret
}
