// SPDX-License-Identifier: GPL-3.0-only

// loc_0028  (ROM 0x0028-0x0032) -- rst 0x28 dispatch trampoline. The rst pushes the caller's inline
// jump-table base; index A selects word table[A] and jp (hl)'s to that handler. Tail dispatch: the
// handler ret's to whatever the caller pushed BELOW the table base (see loc_0899 / loc_0c4e).
export function loc_0028(m) {
  const { regs, mem } = m;

  regs.add(regs.a);
  m.step(0x0029, 4); // 0028  add a,a -- index *= 2
  regs.hl = m.pop16();
  m.step(0x002a, 10); // 0029  pop hl -- inline table base
  regs.e = regs.a;
  m.step(0x002b, 4); // 002a  ld e,a
  regs.d = 0x00;
  m.step(0x002d, 7); // 002b  ld d,0x00
  regs.addHl(regs.de);
  m.step(0x002e, 11); // 002d  add hl,de
  regs.e = mem.read8(regs.hl);
  m.step(0x002f, 7); // 002e  ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0030, 6); // 002f  inc hl
  regs.d = mem.read8(regs.hl);
  m.step(0x0031, 7); // 0030  ld d,(hl)
  regs.exDeHl();
  m.step(0x0032, 4); // 0031  ex de,hl -- HL = handler address

  const target = regs.hl;
  m.step(target, 4); // 0032  jp (hl) -- dynamic dispatch to table[A]
  return m.call(target);
}
