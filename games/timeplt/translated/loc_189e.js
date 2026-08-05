// SPDX-License-Identifier: GPL-3.0-only

// loc_189e  (ROM 0x189E-0x18C2, Time Pilot)
export function loc_189e(m) {
  const { regs, mem } = m;

  m.push16(0x18a1);
  m.step(0x0b2b, 17); // call 0x0b2b
  m.call(0x0b2b);

  regs.a = 0xff;
  m.step(0x18a3, 7); // ld a,0xff
  mem.write8(0xad30, regs.a);
  m.step(0x18a6, 13); // ld (0xad30),a
  mem.write8(0xad31, regs.a);
  m.step(0x18a9, 13); // ld (0xad31),a

  regs.a = mem.read8(0xa9c1);
  m.step(0x18ac, 13); // ld a,(0xa9c1)
  mem.write8(0xad10, regs.a);
  m.step(0x18af, 13); // ld (0xad10),a
  mem.write8(0xad20, regs.a);
  m.step(0x18b2, 13); // ld (0xad20),a

  m.push16(0x18b5);
  m.step(0x460e, 17); // call 0x460e
  m.call(0x460e);

  regs.hl = 0xa986;
  m.step(0x18b8, 10); // ld hl,0xa986
  regs.a = mem.read8(regs.hl);
  m.step(0x18b9, 7); // ld a,(hl)
  regs.sub(0x02);
  m.step(0x18bb, 7); // sub 0x02
  regs.daa();
  m.step(0x18bc, 4); // daa -- packed-BCD correction of the subtract
  mem.write8(regs.hl, regs.a);
  m.step(0x18bd, 7); // ld (hl),a

  m.push16(0x18c0);
  m.step(0x4afb, 17); // call 0x4afb -- redraw 0xA986 at 0xA47F
  m.call(0x4afb);

  m.step(0x172a, 10); // jp 0x172a -- TAIL, its ret goes to our caller
  return m.call(0x172a);
}
