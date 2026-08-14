// SPDX-License-Identifier: GPL-3.0-only

// loc_0028  (ROM 0x0028-0x0034) — the rst 0x28 target: copy B bytes from (DE) up a
// tilemap column into (HL). Each byte written, HL steps UP one 0x20-tile row
// (L -= 0x20, borrowing into H); DE advances forward through the source.
export function loc_0028(m) {
  const { regs, mem } = m;

  for (;;) {
    // loc_0028:
    regs.a = mem.read8(regs.de);
    m.step(0x0029, 7);

    mem.write8(regs.hl, regs.a);
    m.step(0x002a, 7);

    regs.a = regs.l;
    m.step(0x002b, 4);

    regs.sub(0x20);
    m.step(0x002d, 7); // sub 0x20 -- move up one tile row

    regs.l = regs.a;
    m.step(0x002e, 4);

    if (regs.fNC) {
      m.step(0x0031, 12); // jr nc,0x0031 (taken) -- no row wrap
    } else {
      m.step(0x0030, 7);
      regs.h = regs.dec8(regs.h);
      m.step(0x0031, 4); // dec h -- L underflowed, borrow into H
    }

    // loc_0031:
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x0032, 6);

    if (m.regs.djnz() !== 0) {
      m.step(0x0028, 13);
      continue;
    }
    m.step(0x0034, 8);
    break;
  }

  m.ret();
}
