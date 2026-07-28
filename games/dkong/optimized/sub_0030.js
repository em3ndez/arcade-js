// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_0030 — hand-optimized rewrite of the translated routine at ROM 0x0030,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. This routine calls nothing (it is a leaf), so there is
 * no `m.call` here; the only import is the RAM *name* BOARD from ram.js.
 */

import { BOARD } from "./ram.js";

/**
 * sub_0030 -- the `rst 0x30` vector helper: a bit-select skip gate.
 * [ROM 0x0030 is `jr 0x0044`; body at 0x0044-0x004D]
 *
 *   0030  18 12        jr   0x0044          ; the rst-0x30 entry point is a jump into the body
 *   0044  21 27 62     ld   hl,0x6227       ; HL = BOARD
 *   0047  46           ld   b,(hl)          ; B  = (BOARD)  -- the rotate count
 *   0048  0f           rrca            loc_0048
 *   0049  10 fd        djnz 0x0048          ; rotate A right B times
 *   004b  d8           ret  c               ; selected bit SET   -> NORMAL return
 *   004c  e1           pop  hl              ; selected bit CLEAR -> drop caller's return addr
 *   004d  c9           ret                  ; ...and return, so the caller's next op is skipped
 *
 * WHAT IT DOES. A `rst 0x30` (opcode 0xF7, a single byte) is a compact "test a
 * bit of A and, if it's clear, skip my caller's next action". It rotates A right
 * B times, where B is the value at BOARD (0x6227), so the final carry holds the
 * bit of A that ends up in position 0 -- effectively a RAM-indexed bit select of
 * A. Then:
 *   - carry SET   -> `ret c` returns NORMALLY to the caller  (this fn returns true);
 *   - carry CLEAR -> `pop hl` discards THIS routine's own return address, so the
 *                    final `ret` lands on the caller's caller -- i.e. the caller's
 *                    instruction after the `rst 0x30` is skipped (this fn returns
 *                    false). Callers spell the skip `if (!m.call(0x0030)) return;`.
 * B is the rotate count; with B==0 the `djnz` underflows and rotates 256 times
 * (a full-circle no-op on A, carry ending as bit 7), exactly as the Z80 does.
 *
 * INPUTS:  A (the value a bit is selected from), (BOARD) 0x6227 (rotate count /
 *          bit index).
 * OUTPUTS: A rotated in place; B = 0 on exit; HL = 0x6227 on the normal-return
 *          branch, or the popped (discarded) return address on the skip branch;
 *          SP += 2 relative to the other branch on the skip branch (the extra
 *          `pop`); F carry = the selected bit. RETURN: the rst-skip boolean the
 *          caller consumes.
 *
 * CONTRACT PRESERVED VERBATIM. The SP manipulation (`pop hl` on the skip branch),
 * the boolean return value, HL, and the carry flag are all load-bearing and are
 * reproduced exactly. The unit gate diffs the whole register file (A, F, B, HL,
 * SP, PC) plus RAM, so none of them may drift; the boolean is what every caller
 * branches on, so a wrong one diverges the whole machine downstream.
 *
 * LADDER STATUS -- named + documented. sub_0030 is an rst-vector leaf reached via
 * `m.call(0x0030)` from 20 sites -- MOST of them mask-ENABLED main-loop /
 * interruptible gameplay routines (sub_03a2 on the main loop; entry_2954,
 * entry_2ed4, sub_2fcb, sub_29af, sub_2207, sub_24ea, entry_2c03, entry_2c8f,
 * sub_25f2, sub_26fa, loc_1e28/1e36, sub_1670, tail_1662, sub_1a33, sub_33a1,
 * entry_2ddb, entry_2e04 ...), plus one NMI-side caller (sub_3fa6). On a main-loop
 * call path the vblank NMI CAN land between this routine's instructions, and the
 * rrca/djnz loop can run up to 256 iterations, so it plainly spans NMI-eligible
 * instruction boundaries -- NOT atomic, by ATOMICITY IS PER-CALL-PATH. So the
 * collapse below is LICENSED by the CONVERGENT gate (docs/decompiler-pipeline), not the strict
 * whole-machine gate, exactly as sub_0350's: a mistimed NMI can push a coarser PC
 * into the diffed stack RAM, which the convergent gate tolerates as long as it
 * heals and non-stack state/pixels stay identical.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block, but the LOOP keeps its
 * per-ITERATION granularity: each `rrca`+`djnz` pair folds into ONE step (17 t while
 * looping, 12 t on the exit iteration), rather than being lumped across iterations,
 * so an NMI can still land between iterations exactly as it could on real hardware
 * (only the finer "between rrca and djnz" landing point is lost -- the licensed
 * cost). Prologue block (jr 0x0044 [12] + ld hl,BOARD [10] + ld b,(hl) [7]) = 29 t,
 * ending at the loop's first iteration. Tail block (ret c not-taken [5] + pop hl
 * [10]) = 15 t. Every total is the oracle's, EXACTLY. Returns true for a normal
 * return.
 */
export function sub_0030(m) {
  const { regs, mem } = m;

  // Prologue: jr 0x0044 (12) + ld hl,BOARD (10) + ld b,(hl) (7) = 29 t, target the
  // loop's first rrca.
  regs.hl = BOARD;
  regs.b = mem.read8(regs.hl);
  m.step(0x0048, 29);

  // rrca + djnz folded PER ITERATION (not across iterations): 4+13=17 t while
  // looping, 4+8=12 t on the exit iteration (B==0 rotates 256x via djnz underflow,
  // same as the oracle).
  do {
    regs.rrca();
    regs.djnz();
    const looping = regs.b !== 0;
    m.step(looping ? 0x0048 : 0x004b, looping ? 17 : 12);
  } while (regs.b !== 0);

  // ret c -- selected bit set: return normally to the caller.
  if (regs.fC) {
    m.ret(11);
    return true;
  }

  // Tail: ret c not-taken (5) + pop hl (10) = 15 t -- selected bit clear: drop our
  // return address so the caller is skipped.
  regs.hl = m.pop16();
  m.step(0x004d, 15);
  m.ret();
  return false;
}
