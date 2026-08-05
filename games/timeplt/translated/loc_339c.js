// SPDX-License-Identifier: GPL-3.0-only

// loc_339c  (ROM 0x339C-0x33B7, Time Pilot)
export function loc_339c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad32);
  m.step(0x339f, 13); // ld a,(0xad32)
  regs.and(regs.a);
  const zero = regs.fZ; // the two instructions before the jr are flag-neutral
  m.step(0x33a0, 4); // and a
  regs.de = 0xad1b;
  m.step(0x33a3, 10); // ld de,0xad1b
  regs.a = mem.read8(0xad14);
  m.step(0x33a6, 13); // ld a,(0xad14)

  if (zero) {
    m.step(0x33ae, 12); // jr z,0x33ae taken -- keep the 0xAD1B/0xAD14 pair
  } else {
    m.step(0x33a8, 7); // jr z NOT taken
    regs.de = 0xad2b;
    m.step(0x33ab, 10); // ld de,0xad2b
    regs.a = mem.read8(0xad24);
    m.step(0x33ae, 13); // ld a,(0xad24)
  }

  regs.add(regs.a);
  m.step(0x33af, 4); // add a,a -- x2, the 0x0F8D entry stride
  regs.hl = 0x0f8d;
  m.step(0x33b2, 10); // ld hl,0x0f8d

  m.push16(0x33b3);
  m.step(0x0018, 11); // rst 0x18 -- HL = 0x0f8d + A
  m.call(0x0018);

  m.ldi(0x33b5); // ldi -- entry byte 0; HL++/DE++/BC--, sets PV/H/N
  m.ldi(0x33b7); // ldi -- entry byte 1

  m.ret(); // 33b7
}
