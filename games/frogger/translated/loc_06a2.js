// SPDX-License-Identifier: GPL-3.0-only

// loc_06a2  (ROM 0x06A2-0x06ED) — home-marker dispatcher on A (a lane/home-column value). A cp-ladder
// on 0xC0/0x90/0x70/0x50/0x30 stamps one home slot's 2x2 block (bases 0xAB64/0xAAA4/0xA9E4/0xA924/
// 0xA864) with tiles 0xFC/0xFD/0xFE/0xFF via the shared tail block_06df; A==0x10 delegates to loc_0670
// (stamp all five); any other A returns. Arms 0x06C1-0x06DE are hand-unrolled (not a table) and fold in.
export function loc_06a2(m) {
  const { regs } = m;

  regs.cp(0xc0);
  m.step(0x06a4, 7);
  if (regs.fZ) { m.step(0x06c1, 10); return arm06df(m, 0x06c1, 0xab64); }
  m.step(0x06a7, 10);

  regs.cp(0x90);
  m.step(0x06a9, 7);
  if (regs.fZ) { m.step(0x06c7, 10); return arm06df(m, 0x06c7, 0xaaa4); }
  m.step(0x06ac, 10);

  regs.cp(0x70);
  m.step(0x06ae, 7);
  if (regs.fZ) { m.step(0x06cd, 10); return arm06df(m, 0x06cd, 0xa9e4); }
  m.step(0x06b1, 10);

  regs.cp(0x50);
  m.step(0x06b3, 7);
  if (regs.fZ) { m.step(0x06d3, 10); return arm06df(m, 0x06d3, 0xa924); }
  m.step(0x06b6, 10);

  regs.cp(0x30);
  m.step(0x06b8, 7);
  if (regs.fZ) { m.step(0x06d9, 10); return arm06df(m, 0x06d9, 0xa864); }
  m.step(0x06bb, 10);

  regs.cp(0x10);
  m.step(0x06bd, 7);
  if (regs.fZ) { m.step(0x0670, 10); return m.call(0x0670); } // jp z,0x0670 -- stamp all five
  m.step(0x06c0, 10);

  m.ret(); // 0x06c0 -- no lane matched
}

// Arm 0x06C1-0x06DE: load HL=base, jp 0x06DF, into the shared stamp tail.
function arm06df(m, entry, base) {
  const { regs } = m;
  regs.hl = base;
  m.step(entry + 3, 10); // ld hl,base
  m.step(0x06df, 10); // jp 0x06df
  return block_06df(m);
}

// loc_06df: stamp the slot's 2x2 block (offsets 0,1,0x20,0x21) with tiles 0xFC/0xFD/0xFE/0xFF.
function block_06df(m) {
  const { regs, mem } = m;

  mem.write8(regs.hl, 0xfc);
  m.step(0x06e1, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x06e2, 6);
  mem.write8(regs.hl, 0xfd);
  m.step(0x06e4, 10); // top row: base=0xFC, base+1=0xFD

  regs.bc = 0x001f;
  m.step(0x06e7, 10);
  regs.addHl(regs.bc);
  m.step(0x06e8, 11); // HL += 0x1f -> base+0x20

  mem.write8(regs.hl, 0xfe);
  m.step(0x06ea, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x06eb, 6);
  mem.write8(regs.hl, 0xff);
  m.step(0x06ed, 10); // bottom row: base+0x20=0xFE, base+0x21=0xFF

  m.ret();
}
