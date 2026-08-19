// SPDX-License-Identifier: GPL-3.0-only

// loc_756d  (ROM 0x756d-0x7594) -- per-frame arrow/projectile spawner driver.
// A frame-delay counter at (0x8929): while non-zero, just decrement it and return. Once elapsed,
// and unless the wave index (0x892d) has reached 8 (all waves done), walk 8 object records --
// IX over the 0x8ae0 table, IY over the 0x8b70 table, stride 0x18 -- calling loc_7595 on each to
// try to launch it. The exx around the call preserves the loop counter B and stride DE across the
// callee (loc_7595 clobbers the main register set); B and DE ride in the alternate set during it.
export function loc_756d(m) {
  const { regs, mem } = m;

  regs.hl = 0x8929;
  m.step(0x7570, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x7571, 7);
  regs.and(regs.a);
  m.step(0x7572, 4);
  if (regs.fZ) {
    m.step(0x7576, 12); // 7572  jr z,0x7576 -- delay elapsed
  } else {
    m.step(0x7574, 7);
    regs.decMem8(mem, regs.hl);
    m.step(0x7575, 11); // 7574  dec (hl) -- tick the frame delay
    m.ret(); // 7575  ret
    return;
  }

  regs.a = mem.read8(0x892d);
  m.step(0x7579, 13); // 7576  ld a,(0x892d) -- wave index
  regs.cp(0x08);
  m.step(0x757b, 7);
  if (regs.fZ) { m.ret(11); return; } // 757b  ret z -- all 8 waves spawned
  m.step(0x757c, 5);
  regs.ix = 0x8ae0;
  m.step(0x7580, 14);
  regs.iy = 0x8b70;
  m.step(0x7584, 14);
  regs.de = 0x0018;
  m.step(0x7587, 10);
  regs.b = 0x08;
  m.step(0x7589, 7);

  for (;;) {
    regs.exx();
    m.step(0x758a, 4); // 7589  exx -- park B/DE in the alt set
    m.push16(0x758d);
    m.step(0x7595, 17);
    if (!m.call(0x7595)) return; // 758a  call 0x7595 -- launched -> caller-skip aborts the loop
    regs.exx();
    m.step(0x758e, 4); // 758d  exx -- restore B/DE
    regs.addIx(regs.de);
    m.step(0x7590, 15); // 758e  add ix,de -- next record
    regs.addIy(regs.de);
    m.step(0x7592, 15); // 7590  add iy,de
    if (regs.djnz() !== 0) { m.step(0x7589, 13); continue; } // 7592  djnz 0x7589
    m.step(0x7594, 8);
    break;
  }
  m.ret(); // 7594  ret
}
