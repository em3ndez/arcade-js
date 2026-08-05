// SPDX-License-Identifier: GPL-3.0-only

// loc_0e70  (ROM 0x0e70-0x0e8c, Time Pilot)
export function loc_0e70(m) {
  const { regs, mem } = m;

  regs.a = regs.b;
  m.step(0x0e71, 4); // 0e70  ld a,b
  regs.a = regs.inc8(regs.a);
  m.step(0x0e72, 4); // 0e71  inc a
  mem.write8(regs.de, regs.a);
  m.step(0x0e73, 7); // 0e72  ld (de),a
  regs.a = regs.dec8(regs.a);
  m.step(0x0e74, 4); // 0e73  dec a
  regs.de = (regs.de - 1) & 0xffff;
  m.step(0x0e75, 6); // 0e74  dec de
  mem.write8(regs.de, regs.a);
  m.step(0x0e76, 7); // 0e75  ld (de),a

  m.push16(0x0e77);
  m.step(0x0028, 11); // 0e76  rst 0x28 -- DE += 0x20
  m.call(0x0028);

  regs.a = regs.b;
  m.step(0x0e78, 4); // 0e77  ld a,b
  regs.add(0x02);
  m.step(0x0e7a, 7); // 0e78  add a,0x02
  mem.write8(regs.de, regs.a);
  m.step(0x0e7b, 7); // 0e7a  ld (de),a
  regs.a = regs.inc8(regs.a);
  m.step(0x0e7c, 4); // 0e7b  inc a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0e7d, 6); // 0e7c  inc de
  mem.write8(regs.de, regs.a);
  m.step(0x0e7e, 7); // 0e7d  ld (de),a

  regs.hl = 0xfc00;
  m.step(0x0e81, 10); // 0e7e  ld hl,0xfc00
  regs.addHl(regs.de);
  m.step(0x0e82, 11); // 0e81  add hl,de -- HL = DE - 0x400, the colour cell

  m.push16(0x0e83);
  m.step(0x0028, 11); // 0e82  rst 0x28 -- DE += 0x20
  m.call(0x0028);

  mem.write8(regs.hl, regs.c);
  m.step(0x0e84, 7); // 0e83  ld (hl),c
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x0e85, 6); // 0e84  dec hl
  mem.write8(regs.hl, regs.c);
  m.step(0x0e86, 7); // 0e85  ld (hl),c

  regs.exDeHl();
  m.step(0x0e87, 4); // 0e86  ex de,hl

  m.push16(0x0e88);
  m.step(0x0020, 11); // 0e87  rst 0x20 -- the colour pointer -= 0x20
  m.call(0x0020);

  regs.exDeHl();
  m.step(0x0e89, 4); // 0e88  ex de,hl

  mem.write8(regs.hl, regs.c);
  m.step(0x0e8a, 7); // 0e89  ld (hl),c
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0e8b, 6); // 0e8a  inc hl
  mem.write8(regs.hl, regs.c);
  m.step(0x0e8c, 7); // 0e8b  ld (hl),c

  m.ret(); // 0e8c  ret
}
