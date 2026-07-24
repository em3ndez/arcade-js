// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_30bd — hand-optimized rewrite of the translated routine at ROM 0x30BD,
 * proven equal to its oracle by the equivalence harness. A sprite-buffer processing pass;
 * it drives sub_30e4 over four regions and names no work RAM.
 */

/**
 * sub_30bd -- run the sub_30e4 pass over four sprite-buffer regions.  [ROM 0x30BD-0x30D9]
 *
 * Two callers. It calls sub_30e4 four times, each over a run of B records starting at HL:
 *   0x6950 (B=2), 0x6980 (B=0x0A), 0x69B8 (B=0x0B), 0x6A0C (B=5).
 * sub_30e4 preserves H, so the middle two reload L ONLY (HL stays in page 0x69); the last
 * reloads the full HL. The final call is a TAIL jump (no push) -- sub_30e4's ret returns to
 * sub_30bd's caller.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (each block runs to the point of its
 * own call/tail-jump into sub_30e4). No hardware writes (only register loads + one stack
 * push per real call, which is memory-order-safe to fold since nothing reads the
 * intermediate PC/cycle state). Per-block totals, EXACTLY the oracle's sum:
 *   block 1 (ld hl,0x6950 [10] + ld b,0x02 [7] + call 0x30e4 [17])          = 34 t, exit 0x30e4
 *   block 2 (ld l,0x80 [7] + ld b,0x0a [7] + call 0x30e4 [17])              = 31 t, exit 0x30e4
 *   block 3 (ld l,0xb8 [7] + ld b,0x0b [7] + call 0x30e4 [17])              = 31 t, exit 0x30e4
 *   block 4 (ld hl,0x6a0c [10] + ld b,0x05 [7] + jp 0x30e4 [10], tail)      = 27 t, exit 0x30e4
 */
export function sub_30bd(m) {
  const { regs } = m;

  regs.hl = 0x6950;
  regs.b = 0x02;
  m.push16(0x30c5); // call 0x30e4 -- real call, rets back to 0x30c5
  m.step(0x30e4, 34); // ld hl,0x6950[10] + ld b,0x02[7] + call[17]
  m.call(0x30e4); // preserves H

  regs.l = 0x80; // L only -- HL = 0x6980, H preserved at 0x69
  regs.b = 0x0a;
  m.push16(0x30cc); // call 0x30e4 -- rets back to 0x30cc
  m.step(0x30e4, 31); // ld l,0x80[7] + ld b,0x0a[7] + call[17]
  m.call(0x30e4);

  regs.l = 0xb8; // HL = 0x69B8
  regs.b = 0x0b;
  m.push16(0x30d3); // call 0x30e4 -- rets back to 0x30d3
  m.step(0x30e4, 31); // ld l,0xb8[7] + ld b,0x0b[7] + call[17]
  m.call(0x30e4);

  regs.hl = 0x6a0c; // full HL reload for the last run
  regs.b = 0x05;

  // TAIL JUMP: no push. sub_30e4's ret returns to sub_30bd's caller.
  m.step(0x30e4, 27); // ld hl,0x6a0c[10] + ld b,0x05[7] + jp[10]
  return m.call(0x30e4);
}
