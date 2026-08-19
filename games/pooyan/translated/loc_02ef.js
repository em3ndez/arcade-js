// SPDX-License-Identifier: GPL-3.0-only

// loc_02ef  (ROM 0x02EF-0x0329) — sprite display-list builder: copies four groups of object
// records into the sprite list at 0x8840 (loc_032a raw, loc_0343 with coord math), then ticks
// two frame counters (0x8898, 0x889c) and, once (0x881f) reaches 0, runs the loc_0378 pass.
export function loc_02ef(m) {
  const { regs, mem } = m;

  regs.hl = 0x8840;
  m.step(0x02f2, 10); // display list base
  regs.ix = 0x8a80;
  m.step(0x02f6, 14);
  regs.de = 0x0018;
  m.step(0x02f9, 10); // record stride
  regs.b = 0x02;
  m.step(0x02fb, 7);
  m.push16(0x02fe);
  m.step(0x032a, 17); // call 0x032a
  m.call(0x032a);

  regs.ix = 0x8c90;
  m.step(0x0302, 14);
  regs.b = 0x02;
  m.step(0x0304, 7);
  m.push16(0x0307);
  m.step(0x032a, 17); // call 0x032a
  m.call(0x032a);

  regs.ix = 0x8ae0;
  m.step(0x030b, 14);
  regs.b = 0x12;
  m.step(0x030d, 7);
  m.push16(0x0310);
  m.step(0x0343, 17); // call 0x0343 -- 18 moving-object records
  m.call(0x0343);

  regs.ix = 0x8ab0;
  m.step(0x0314, 14);
  regs.b = 0x02;
  m.step(0x0316, 7);
  m.push16(0x0319);
  m.step(0x032a, 17); // call 0x032a
  m.call(0x032a);

  regs.hl = 0x8898;
  m.step(0x031c, 10);
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x031d, 11); // dec (0x8898)
  regs.hl = 0x889c;
  m.step(0x0320, 10);
  // loc_0320: (external jp nz,0x0320 lands here with HL preset)
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x0321, 11); // dec (0x889c)
  regs.a = mem.read8(0x881f);
  m.step(0x0324, 13);
  regs.and(regs.a);
  m.step(0x0325, 4);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- counter live, done
    return;
  }
  m.step(0x0326, 5);

  m.push16(0x0329);
  m.step(0x0378, 17); // call 0x0378
  m.call(0x0378);
  m.ret(); // 0x0329
}
