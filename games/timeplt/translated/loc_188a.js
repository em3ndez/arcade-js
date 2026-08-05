// SPDX-License-Identifier: GPL-3.0-only

// loc_188a  (ROM 0x188A-0x189D, Time Pilot)
export function loc_188a(m) {
  const { regs, mem } = m;

  m.push16(0x188d);
  m.step(0x0b06, 17); // call 0x0b06
  m.call(0x0b06);

  m.push16(0x1890);
  m.step(0x0b39, 17); // call 0x0b39
  m.call(0x0b39);

  regs.a = mem.read8(0xa9ae);
  m.step(0x1893, 13); // ld a,(0xa9ae)

  const bit4 = regs.bit(4, regs.a);
  m.step(0x1895, 8); // bit 4,a

  if (bit4) {
    m.step(0x189e, 10); // jp nz,0x189e (taken) -- TAIL into the routine at 0x189E
    return m.call(0x189e);
  }
  m.step(0x1898, 10); // jp nz,0x189e (not taken; jp costs 10 either way)

  const bit3 = regs.bit(3, regs.a);
  m.step(0x189a, 8); // bit 3,a

  if (bit3) {
    m.step(0x3215, 10); // jp nz,0x3215 (taken) -- TAIL
    return m.call(0x3215);
  }
  m.step(0x189d, 10); // jp nz,0x3215 (not taken)

  m.ret(); // 189d  ret
}
