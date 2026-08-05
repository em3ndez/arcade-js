// SPDX-License-Identifier: GPL-3.0-only

// loc_59a0  (ROM 0x59A0-0x59C4, Time Pilot)
export function loc_59a0(m) {
  const { regs, mem } = m;

  regs.c = regs.a;
  m.step(0x59a1, 4); // ld c,a -- keep the angle for the second lookup
  regs.add(regs.a);
  m.step(0x59a2, 4); // add a,a -- two bytes per entry

  if (regs.fNC) {
    m.step(0x59a5, 12); // jr nc,0x59a5 taken
  } else {
    m.step(0x59a4, 7); // jr nc NOT taken
    regs.h = regs.inc8(regs.h);
    m.step(0x59a5, 4); // inc h
  }

  regs.add(regs.l);
  m.step(0x59a6, 4); // add a,l
  regs.l = regs.a;
  m.step(0x59a7, 4); // ld l,a

  if (regs.fNC) {
    m.step(0x59aa, 12); // jr nc,0x59aa taken
  } else {
    m.step(0x59a9, 7); // jr nc NOT taken
    regs.h = regs.inc8(regs.h);
    m.step(0x59aa, 4); // inc h
  }

  regs.e = mem.read8(regs.hl);
  m.step(0x59ab, 7); // ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x59ac, 6); // inc hl
  regs.d = mem.read8(regs.hl);
  m.step(0x59ad, 7); // ld d,(hl)
  regs.e = regs.sla(regs.e);
  m.step(0x59af, 8); // sla e
  regs.d = regs.rl(regs.d);
  m.step(0x59b1, 8); // rl d -- DE = 2 * T[angle]

  regs.a = regs.c;
  m.step(0x59b2, 4); // ld a,c
  regs.add(0xc0);
  m.step(0x59b4, 7); // add a,0xc0 -- C set iff angle >= 0x40
  regs.bc = 0x0180;
  m.step(0x59b7, 10); // ld bc,0x0180 -- +0xC0 entries; flag-neutral, the add's carry survives

  if (regs.fNC) {
    m.step(0x59bc, 12); // jr nc,0x59bc taken
  } else {
    m.step(0x59b9, 7); // jr nc NOT taken
    regs.bc = 0xff80;
    m.step(0x59bc, 10); // ld bc,0xff80 -- -0x40 entries, the same one mod 256
  }

  regs.addHl(regs.bc);
  m.step(0x59bd, 11); // add hl,bc
  regs.b = mem.read8(regs.hl);
  m.step(0x59be, 7); // ld b,(hl)
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x59bf, 6); // dec hl
  regs.c = mem.read8(regs.hl);
  m.step(0x59c0, 7); // ld c,(hl)
  regs.c = regs.sla(regs.c);
  m.step(0x59c2, 8); // sla c
  regs.b = regs.rl(regs.b);
  m.step(0x59c4, 8); // rl b -- BC = 2 * T[(angle-0x40) & 0xff]

  m.ret(); // 59c4  ret
}
