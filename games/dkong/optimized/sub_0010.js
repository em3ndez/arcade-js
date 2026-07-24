// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_0010 — hand-optimized rewrite of the translated routine at ROM 0x0010,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. It has NO callee (a pure read-rotate-return leaf), so
 * nothing here is reached through `m.call`; only the RAM name MARIO_ACTIVE is
 * imported (from ram.js). The calling convention is preserved exactly: `m.ret`
 * pops the return address the caller's `rst 0x10` pushed, and on the skip branch
 * the two `inc sp` discard it first so the `ret` lands one frame higher.
 */

import { MARIO_ACTIVE } from "./ram.js";

/**
 * sub_0010 -- the `rst 0x10` player-alive skip gate. [ROM 0x0010-0x0017]
 *
 *   0010  3a 00 62   ld  a,(0x6200)   ; A = MARIO_ACTIVE
 *   0013  0f         rrca             ; bit 0 -> carry
 *   0014  d8         ret c            ; bit 0 SET -> return NORMALLY (caller resumes)
 *   0015  33         inc sp           ; bit 0 CLEAR -> discard OUR return address...
 *   0016  33         inc sp
 *   0017  c9         ret              ; ...so this ret lands in the CALLER'S CALLER
 *
 * WHAT IT DOES. The `rst 0x10` vector helper: a one-byte call every player-context
 * routine uses to gate itself on whether Mario is alive. It reads MARIO_ACTIVE
 * (0x6200, 1 = alive/processed, 0 = dead/inert), rotates bit 0 into carry, and
 * returns a SKIP BOOLEAN under the settled sub_0008 convention (mainloop.js):
 * true = the caller resumes normally; false = the caller is spliced past and must
 * `return` at once (`if (!m.call(0x0010)) return;`). So the callers' bodies (the
 * difficulty tick entry_2ddb, the periodic-event arms entry_2c03/sub_03a2, the
 * movement handlers) run only while Mario is active. Reached only via
 * `m.call(0x0010)` from many routines -- a LEAF, never a dispatch target.
 *
 * THE POLARITY TRAP. sub_0010 is the EXACT MIRROR of sub_0008 (`rst 0x08`) with the
 * opposite polarity: sub_0008 tests the SAME `rrca` bit but returns normally on
 * `ret nc` (bit CLEAR), whereas sub_0010 returns normally on `ret c` (bit SET). They
 * are one opcode apart (0xD0 vs 0xD8) and mean OPPOSITE things -- copying sub_0008's
 * `if (regs.fNC)` onto this routine takes the wrong branch on EVERY call, and the
 * write-gate (RAM only) cannot see it because sub_0010 writes NO memory. So the
 * `rrca` + carry test is kept verbatim and the unit gate compares the full register
 * file. The teeth test flips exactly this (`fNC` for `fC`) and it is CAUGHT as an SP
 * divergence.
 *
 * INPUTS: MARIO_ACTIVE (0x6200). OUTPUTS: none to RAM -- this routine writes NO
 * memory. It changes only registers: A (= 0x6200 rotated right one), F (the `rrca`
 * result), SP (+2 on the normal ret, +4 on the splice), and PC (the popped return).
 * RETURN: boolean skip flag (true = normal, false = spliced).
 *
 * FLAGS. The caller consumes the RETURN VALUE, not F -- but the unit gate compares
 * A and F, and `rrca` sets them exactly as the oracle (carry = old bit 0; A rotated),
 * so both are kept verbatim. A ends = (0x6200 >> 1) | (bit0 << 7); F = the rrca flags.
 * SP is load-bearing: the two `inc sp` ARE the caller-skip mechanism, so SP is
 * reproduced exactly (+2 normal, +4 splice).
 *
 * CYCLES -- COLLAPSED to one m.step per basic block. sub_0010 IS reached from the
 * INTERRUPTIBLE main-loop path loc_197a (the per-frame in-game update cascade,
 * documented decisively NON-atomic) via entry_2c03/entry_2ddb, both `rst 0x10`-ing into
 * here while the NMI mask is SET -- so the vblank NMI CAN fire inside this 4-6
 * instruction body on the gameplay path, and a collapse's coarse block-exit PC can land
 * in the diffed stack instead of the oracle's exact per-instruction PC. That is exactly
 * the case the CONVERGENT gate (docs/06; equivalence-0010.test.js) is for: pixels are
 * ground truth, a mistimed-NMI raster tear or dead-stack PC is tolerated if it heals,
 * and a PERSISTENT divergence (e.g. a wrong cycle total forking the PRNG) still fails.
 * Two blocks:
 *   A (ld a,(MARIO_ACTIVE); rrca)                                    13+4      = 17 t
 *   B, splice only (ret-c-not-taken; inc sp; inc sp)                 5+6+6     = 17 t
 * Each charge is the oracle's own per-instruction value; only the granularity changed.
 * Per-branch TOTAL is unchanged (normal 17+11=28; splice 17+17+10=44 t).
 */
export function sub_0010(m) {
  const { regs, mem } = m;

  // Block A: ld a,(MARIO_ACTIVE); rrca -- rotate the alive bit (bit 0) into carry.  13+4=17 t.
  regs.a = mem.read8(MARIO_ACTIVE);
  regs.rrca();
  m.step(0x0014, 17);

  if (regs.fC) {
    // ret c taken -- bit 0 SET: Mario alive, return NORMALLY (caller resumes).
    m.ret(11);
    return true;
  }

  // Block B: ret c NOT taken; inc sp; inc sp -- discard our own return address so the
  // final ret unwinds to the caller's CALLER (the splice).  5+6+6 = 17 t.
  regs.sp = (regs.sp + 2) & 0xffff;
  m.step(0x0017, 17);
  m.ret(); // ret -- returns to the caller's CALLER
  return false;
}
