// SPDX-License-Identifier: GPL-3.0-only

// loc_5634  (ROM 0x5634-0x565E, Time Pilot)
export function loc_5634(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x167c);
  m.step(0x5637, 13); // ld a,(0x167c) -- the ROM byte 0x86
  m.push16(0x563a);
  m.step(0x5628, 17); // call 0x5628
  m.call(0x5628);

  regs.a = mem.read8(0x0a9c);
  m.step(0x563d, 13); // ld a,(0x0a9c) -- the ROM byte 0x9c
  m.push16(0x5640);
  m.step(0x5628, 17); // call 0x5628
  m.call(0x5628);

  regs.a = mem.read8(0x1484);
  m.step(0x5643, 13); // ld a,(0x1484) -- the ROM byte 0x9d
  m.push16(0x5646);
  m.step(0x5628, 17); // call 0x5628
  m.call(0x5628);

  regs.a = mem.read8(0x0c78);
  m.step(0x5649, 13); // ld a,(0x0c78) -- the ROM byte 0x9e
  m.push16(0x564c);
  m.step(0x5628, 17); // call 0x5628
  m.call(0x5628);

  regs.a = mem.read8(0x07d3);
  m.step(0x564f, 13); // ld a,(0x07d3) -- the ROM byte 0x9f
  m.push16(0x5652);
  m.step(0x5628, 17); // call 0x5628
  m.call(0x5628);

  regs.a = mem.read8(0x33b4);
  m.step(0x5655, 13); // ld a,(0x33b4) -- the ROM byte 0xa0
  m.push16(0x5658);
  m.step(0x5628, 17); // call 0x5628
  m.call(0x5628);

  regs.a = mem.read8(0xad04);
  m.step(0x565b, 13); // ld a,(0xad04)

  regs.add(0x8c);
  m.step(0x565d, 7); // add a,0x8c

  m.step(0x5628, 12); // 565d  jr 0x5628
  return m.call(0x5628);
}
