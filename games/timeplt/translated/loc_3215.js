// SPDX-License-Identifier: GPL-3.0-only

// loc_3215  (ROM 0x3215-0x3239, Time Pilot)
export function loc_3215(m) {
  const { regs, mem } = m;

  m.push16(0x3218);
  m.step(0x0b2b, 17); // call 0x0b2b
  m.call(0x0b2b);

  regs.xor(regs.a);
  m.step(0x3219, 4); // xor a
  mem.write8(0xad31, regs.a);
  m.step(0x321c, 13); // ld (0xad31),a
  mem.write8(0xad20, regs.a);
  m.step(0x321f, 13); // ld (0xad20),a
  regs.a = regs.dec8(regs.a);
  m.step(0x3220, 4); // dec a -- 0x00 -> 0xFF
  mem.write8(0xad30, regs.a);
  m.step(0x3223, 13); // ld (0xad30),a

  regs.a = mem.read8(0xa9c1);
  m.step(0x3226, 13); // ld a,(0xa9c1)
  mem.write8(0xad10, regs.a);
  m.step(0x3229, 13); // ld (0xad10),a

  regs.hl = 0xa986;
  m.step(0x322c, 10); // ld hl,0xa986
  regs.a = mem.read8(regs.hl);
  m.step(0x322d, 7); // ld a,(hl)
  regs.sub(0x01);
  m.step(0x322f, 7); // sub 0x01 -- leaves the H and N that daa reads
  regs.daa();
  m.step(0x3230, 4); // daa -- BCD borrow
  mem.write8(regs.hl, regs.a);
  m.step(0x3231, 7); // ld (hl),a

  m.push16(0x3234);
  m.step(0x4afb, 17); // call 0x4afb
  m.call(0x4afb);

  m.push16(0x3237);
  m.step(0x4b30, 17); // call 0x4b30
  m.call(0x4b30);

  m.step(0x172a, 10); // jp 0x172a -- TAIL jump, nothing pushed
  return m.call(0x172a);
}
