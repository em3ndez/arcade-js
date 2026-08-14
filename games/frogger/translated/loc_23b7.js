// SPDX-License-Identifier: GPL-3.0-only

// loc_23b7  (ROM 0x23B7-0x23E5) — in-play river-object arrival setup, called each vblank by loc_2341.
// Loads HL/DE with the frog X/Y pointers, then for each of the four ride lanes: if its direction flag
// (0x8248-0x824B) is set, tail-jump to that lane's commit handler (0x1bba/0x1c0d/0x1c76/0x1cd5);
// otherwise clear the lane's mirror flag (0x824C-0x824F, written with the just-read 0).
export function loc_23b7(m) {
  const { regs, mem } = m;

  regs.hl = 0x8044;
  m.step(0x23ba, 10); // -- frog X
  regs.de = 0x8047;
  m.step(0x23bd, 10); // -- frog Y

  regs.a = mem.read8(0x8248);
  m.step(0x23c0, 13); // -- lane-0 direction flag
  regs.and(regs.a);
  m.step(0x23c1, 4);
  if (regs.fNZ) { m.step(0x1bba, 10); return m.call(0x1bba); }
  m.step(0x23c4, 10);
  mem.write8(0x824c, regs.a);
  m.step(0x23c7, 13);

  regs.a = mem.read8(0x8249);
  m.step(0x23ca, 13); // -- lane-1 direction flag
  regs.and(regs.a);
  m.step(0x23cb, 4);
  if (regs.fNZ) { m.step(0x1c0d, 10); return m.call(0x1c0d); }
  m.step(0x23ce, 10);
  mem.write8(0x824d, regs.a);
  m.step(0x23d1, 13);

  regs.a = mem.read8(0x824a);
  m.step(0x23d4, 13); // -- lane-2 direction flag
  regs.and(regs.a);
  m.step(0x23d5, 4);
  if (regs.fNZ) { m.step(0x1c76, 10); return m.call(0x1c76); }
  m.step(0x23d8, 10);
  mem.write8(0x824e, regs.a);
  m.step(0x23db, 13);

  regs.a = mem.read8(0x824b);
  m.step(0x23de, 13); // -- lane-3 direction flag
  regs.and(regs.a);
  m.step(0x23df, 4);
  if (regs.fNZ) { m.step(0x1cd5, 10); return m.call(0x1cd5); }
  m.step(0x23e2, 10);
  mem.write8(0x824f, regs.a);
  m.step(0x23e5, 13);

  m.ret();
}
