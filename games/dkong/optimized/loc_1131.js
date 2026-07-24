// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1131 — hand-optimized rewrite of the translated routine at ROM 0x1131,
 * proven equal to its oracle by the equivalence harness. A board-setup coordinator over
 * the shared fill helpers; it names no work RAM.
 */

/**
 * loc_1131 -- board-4 (100m / rivets) sprite-and-object setup.  [ROM 0x1131-0x117D]
 *
 * rst-0x28 table entry 4: the per-board setup sub_0f56 dispatches to for BOARD == 4. A
 * fixed chain over the shared helpers:
 *   - sub_122a: strided fill of ROM 0x3DF0 into 0x6407 (B=5, C=0x1C),
 *   - sub_11a6 with HL=0x3E14 live-in (object slots 0x6680/0x6690),
 *   - ldir 0x0C bytes ROM 0x3E54 -> 0x6A0C,
 *   - sub_11ec: interleaved copy of ROM 0x1182 (the 2nd inline data unit, used first) into
 *     0x64A3 (B=2, C=0x1E),
 *   - sub_122a: strided fill of ROM 0x117E (the 1st unit, used second) into 0x64A7 (B=2, C=0x1C),
 *   - IX=0x64A0; mark IX+0 and IX+0x20 live (=0x01, stride 0x20),
 *   - sub_11d3: permuting gather into 0x6950 (B=2, DE=0x20 stride),
 *   - ret.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block. loc_1131 is a straight-line
 * coordinator (no data-dependent branch of its own): every block boundary here is a
 * call into a shared fill helper, so each block folds its setup instructions'
 * charges together with that call's own instruction charge, then invokes `m.call`
 * unchanged (never inlined). `m.ldir` keeps its own internal per-iteration charging
 * (untouched -- see machine.js's ldirAt), so the block before it stops at its last
 * setup instruction with no extra call-charge to fold in. This routine has NO
 * whole-machine dispatch (it is reached only via the board-setup dispatch tree, cold
 * on a driven board-1 game) so there is no convergent/strict whole-machine choice to
 * make here -- see the crafted-entry test's added cycle-total assertion instead.
 * Every block total is the oracle's, EXACTLY:
 *   Block 1 (3 setup ops [10+10+10] + sub_122a's call charge [17])        = 47 t
 *   Block 2 (1 setup op [10] + sub_11a6's call charge [17])               = 27 t
 *   Block 3 (3 setup ops [10+10+10], ldir's own charges follow)          = 30 t
 *   Block 4 (3 setup ops [10+10+10] + sub_11ec's call charge [17])        = 47 t
 *   Block 5 (3 setup ops [10+10+10] + sub_122a's call charge [17])        = 47 t
 *   Block 6 (object marks [14+19+19] + gather setup [10+7+10] +
 *            sub_11d3's call charge [17])                                 = 96 t
 */
export function loc_1131(m) {
  const { regs, mem } = m;

  // Block 1: 3 setup ops (10+10+10=30) + sub_122a's call charge (17) = 47 t.
  regs.hl = 0x3df0;
  regs.de = 0x6407;
  regs.bc = 0x051c;
  m.push16(0x113d);
  m.step(0x122a, 47);
  m.call(0x122a);

  // Block 2: 1 setup op (10) + sub_11a6's call charge (17) = 27 t.
  regs.hl = 0x3e14; // live-in to sub_11a6
  m.push16(0x1143);
  m.step(0x11a6, 27);
  m.call(0x11a6);

  // Block 3: 3 setup ops (10+10+10=30) -- ldir's own internal charges follow.
  regs.hl = 0x3e54;
  regs.de = 0x6a0c;
  regs.bc = 0x000c;
  m.step(0x114c, 30);
  m.ldir(0x114e); // ldir 0x0C bytes -> 0x6A0C

  // Block 4: 3 setup ops (10+10+10=30) + sub_11ec's call charge (17) = 47 t.
  regs.hl = 0x1182; // 2nd data unit, used first
  regs.de = 0x64a3;
  regs.bc = 0x021e;
  m.push16(0x115a);
  m.step(0x11ec, 47);
  m.call(0x11ec);

  // Block 5: 3 setup ops (10+10+10=30) + sub_122a's call charge (17) = 47 t.
  regs.hl = 0x117e; // 1st data unit, used second
  regs.de = 0x64a7;
  regs.bc = 0x021c;
  m.push16(0x1166);
  m.step(0x122a, 47);
  m.call(0x122a);

  // Block 6: object-slot marks (14+19+19=52) + gather setup (10+7+10=27) +
  // sub_11d3's call charge (17) = 96 t.
  regs.ix = 0x64a0;
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
  mem.write8((regs.ix + 0x20) & 0xffff, 0x01); // stride 0x20
  regs.hl = 0x6950;
  regs.b = 0x02;
  regs.de = 0x0020; // stride
  m.push16(0x117d);
  m.step(0x11d3, 96);
  m.call(0x11d3);

  m.ret(); // 0x117D
}
