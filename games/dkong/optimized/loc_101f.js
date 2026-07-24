// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_101f — hand-optimized rewrite of the translated routine at ROM 0x101F,
 * proven equal to its oracle by the equivalence harness. A board-setup coordinator over
 * the shared fill helpers; only its single 0x62B9 store is a work-RAM write of its own.
 */

/**
 * loc_101f -- board-2 (50m / conveyors) sprite-and-object setup.  [ROM 0x101F-0x1086]
 *
 * rst-0x28 table entry 2: the per-board setup sub_0f56 dispatches to for BOARD == 2. A
 * fixed chain over the shared helpers, four ldir blocks, and a final flag:
 *   - sub_122a (ROM 0x3DEC -> 0x6407, B=5, C=0x1C), sub_1186 (fill 0x6507 / gather 0x6980),
 *   - sub_122a (ROM 0x3E18 -> 0x65A7, B=6, C=0x0C),
 *   - sub_11d3 gather from IX=0x65A0 into 0x69B8 (B=6, DE=0x10),
 *   - sub_11fa scatter with HL=0x3DFA live-in,
 *   - ldir 4 bytes 0x3E04 -> 0x69FC, ldir 8 bytes 0x3E1C -> 0x6944, ldir 0x18 bytes
 *     0x3E24 -> 0x69E4,
 *   - sub_11a6 with HL=0x3E10 live-in,
 *   - ldir 0x0C bytes 0x3E3C -> 0x6A0C,
 *   - 0x62B9 = 1 (a board-2 flag), ret.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (straight-line register-load groups
 * folded into a single charge at the block's exit PC, right before the next call/ldir
 * scaffold). loc_101f is reached only via the per-board setup dispatch -- a one-shot,
 * dispatch-time coordinator, not a per-frame routine -- so the same reasoning that lets
 * sub_122a collapse applies here. Every fold sums the oracle's own per-instruction values
 * (10t per `ld rr,nn`, 7t per 8-bit immediate load); `m.call`/`m.push16`/`m.ldir` scaffolding
 * is untouched, and the single-load blocks (one `ld hl,nn` with nothing to fold beside it)
 * are left as they were.
 */
export function loc_101f(m) {
  const { regs, mem } = m;

  // ld hl,0x3dec; ld de,0x6407; ld bc,0x051c.  10+10+10 = 30 t, exit 0x1028.
  regs.hl = 0x3dec;
  regs.de = 0x6407;
  regs.bc = 0x051c;
  m.step(0x1028, 30);
  m.push16(0x102b);
  m.step(0x122a, 17);
  m.call(0x122a);

  m.push16(0x102e);
  m.step(0x1186, 17);
  m.call(0x1186);

  // ld hl,0x3e18; ld de,0x65a7; ld bc,0x060c.  10+10+10 = 30 t, exit 0x1037.
  regs.hl = 0x3e18;
  regs.de = 0x65a7;
  regs.bc = 0x060c;
  m.step(0x1037, 30);
  m.push16(0x103a);
  m.step(0x122a, 17);
  m.call(0x122a);

  // ld ix,0x65a0; ld hl,0x69b8; ld de,0x0010; ld b,6.  14+10+10+7 = 41 t, exit 0x1046.
  regs.ix = 0x65a0;
  regs.hl = 0x69b8;
  regs.de = 0x0010; // stride
  regs.b = 0x06;
  m.step(0x1046, 41);
  m.push16(0x1049);
  m.step(0x11d3, 17);
  m.call(0x11d3);

  regs.hl = 0x3dfa; // live-in to sub_11fa
  m.step(0x104c, 10);
  m.push16(0x104f);
  m.step(0x11fa, 17);
  m.call(0x11fa);

  // ld hl,0x3e04; ld de,0x69fc; ld bc,0x0004.  10+10+10 = 30 t, exit 0x1058.
  regs.hl = 0x3e04;
  regs.de = 0x69fc;
  regs.bc = 0x0004;
  m.step(0x1058, 30);
  m.ldir(0x105a);

  // ld hl,0x3e1c; ld de,0x6944; ld bc,0x0008.  10+10+10 = 30 t, exit 0x1063.
  regs.hl = 0x3e1c;
  regs.de = 0x6944;
  regs.bc = 0x0008;
  m.step(0x1063, 30);
  m.ldir(0x1065);

  // ld hl,0x3e24; ld de,0x69e4; ld bc,0x0018.  10+10+10 = 30 t, exit 0x106e.
  regs.hl = 0x3e24;
  regs.de = 0x69e4;
  regs.bc = 0x0018;
  m.step(0x106e, 30);
  m.ldir(0x1070);

  regs.hl = 0x3e10; // live-in to sub_11a6
  m.step(0x1073, 10);
  m.push16(0x1076);
  m.step(0x11a6, 17);
  m.call(0x11a6);

  // ld hl,0x3e3c; ld de,0x6a0c; ld bc,0x000c.  10+10+10 = 30 t, exit 0x107f.
  regs.hl = 0x3e3c;
  regs.de = 0x6a0c;
  regs.bc = 0x000c;
  m.step(0x107f, 30);
  m.ldir(0x1081);

  // ld a,1; ld (0x62b9),a.  7+13 = 20 t, exit 0x1086.
  regs.a = 0x01;
  mem.write8(0x62b9, regs.a); // 0x62B9 = 1 (board-2 flag)
  m.step(0x1086, 20);

  m.ret(); // 0x1086
}
