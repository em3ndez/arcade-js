// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_1186 — hand-optimized rewrite of the translated routine at ROM 0x1186,
 * proven equal to its oracle by the equivalence harness. A small fill+gather coordinator;
 * it names no work RAM.
 */

/**
 * sub_1186 -- fill the 0x6500 object block and gather it into its sprite mirror. [ROM 0x1186-0x11A1]
 *
 * Called from the board-2 and board-3 setups (0x101F, 0x1087). Two steps over the shared
 * helpers:
 *   - sub_122a: strided fill of the 4-byte inline data at 0x11A2 into 0x6507 (BC = 0x0A0C,
 *     so B = 0x0A passes, C = 0x0C stride),
 *   - sub_11d3: permuting gather from IX = 0x6500 into 0x6980 (B = 0x0A, DE = 0x0010 stride;
 *     C still holds sub_122a's restored 0x0C).
 * Then ret. 0x11A2 is a 4-byte DATA block, not code.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block. Dead-straight-line code (no
 * branches, just two calls), so each straight run BETWEEN calls folds into one
 * m.step at that run's last instruction's own address, same convention as
 * handler_01c3: the register-load steps preceding each call fold together, but a
 * call site's own step (the CALL/RST instruction's fixed cost) is left exactly
 * as-is next to its `m.push16`/`m.call` pair. Both branch TOTALS sum to the
 * oracle's, EXACTLY (30 t then 41 t of our own charges, verified against
 * translated/state0.js; the m.call internals are untouched either way).
 */
export function sub_1186(m) {
  const { regs } = m;

  // ld hl,0x11a2[10]+ld de,0x6507[10]+ld bc,0x0a0c[10] -- fill args.  30 t
  regs.hl = 0x11a2; // -> 4-byte data block, not code
  regs.de = 0x6507;
  regs.bc = 0x0a0c; // B = 0x0A passes, C = 0x0C stride
  m.step(0x118f, 30);
  m.push16(0x1192);
  m.step(0x122a, 17);
  m.call(0x122a);

  // ld ix,0x6500[14]+ld hl,0x6980[10]+ld b,0x0a[7]+ld de,0x0010[10] -- gather args.  41 t
  regs.ix = 0x6500;
  regs.hl = 0x6980;
  regs.b = 0x0a; // C left by sub_122a
  regs.de = 0x0010; // stride
  m.step(0x119e, 41);
  m.push16(0x11a1);
  m.step(0x11d3, 17);
  m.call(0x11d3);

  m.ret(); // 0x11A1
}
