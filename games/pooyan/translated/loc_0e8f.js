// SPDX-License-Identifier: GPL-3.0-only

// loc_0e8f  (ROM 0x0e8f-0x0ea1) -- send the sound command in A to the audio CPU:
// latch A at 0xa100, then strobe the audio-IRQ latch bit (mainlatch b1) high, wait, low.
export function loc_0e8f(m) {
  const { regs, mem } = m;

  mem.write8(0xa100, regs.a);
  m.step(0x0e92, 13); // 0e8f  ld (0xa100),a -- A = sound command byte
  regs.a = 0x01;
  m.step(0x0e94, 7); // 0e92  ld a,0x01
  mem.write8(0xa181, regs.a);
  m.step(0x0e97, 13); // 0e94  ld (0xa181),a -- raise audio-IRQ (mainlatch b1)
  m.step(0x0e98, 4); // 0e97  nop -- 6x nop: IRQ strobe pulse width
  m.step(0x0e99, 4);
  m.step(0x0e9a, 4);
  m.step(0x0e9b, 4);
  m.step(0x0e9c, 4);
  m.step(0x0e9d, 4);
  regs.a = regs.dec8(regs.a);
  m.step(0x0e9e, 4); // 0e9d  dec a -- A: 1 -> 0
  mem.write8(0xa181, regs.a);
  m.step(0x0ea1, 13); // 0e9e  ld (0xa181),a -- lower audio-IRQ (mainlatch b1)
  m.ret(); // 0ea1  ret
}
