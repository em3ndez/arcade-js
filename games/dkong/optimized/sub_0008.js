// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_0008 — hand-optimized rewrite of the translated routine at ROM 0x0008,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. It is a LEAF (it calls nothing), so it imports no code —
 * only the RAM name ATTRACT (from ram.js). It goes live at every `m.call(0x0008)`
 * site through the routine registry (games/dkong/routines.js), which is what makes
 * the caller-skip idiom `if (!m.call(0x0008)) return;` resolve to this rewrite.
 */

import { ATTRACT } from "./ram.js";

/**
 * sub_0008 -- the `rst 0x08` conditional caller-skip helper.
 * [ROM 0x0008-0x000F]
 *
 *   0008  3a 07 60   ld  a,(0x6007)   ; A = ATTRACT
 *   000b  0f         rrca             ; bit 0 of ATTRACT -> carry
 *   000c  d0         ret nc           ; bit clear: normal return to caller
 *   000d  33         inc sp           ; bit set: discard our own return address
 *   000e  33         inc sp           ;          (both halves of it)
 *   000f  c9         ret              ; ...so this ret goes to the CALLER'S CALLER
 *
 * A STACK-SKIP IDIOM invoked as `rst 0x08` from many routines. It tests bit 0 of
 * ATTRACT (0x6007): `rrca` rotates that bit into carry, so `ret nc` returns
 * normally UNLESS the bit is set -- the same `ld a,(0x6007) / rrca` enable test
 * entry_0611 uses on the identical byte, but wired to the STACK instead of a draw.
 *
 * When the bit IS set, the two `inc sp` throw away this routine's own return
 * address without reading it, so the final `ret` pops the NEXT word -- the return
 * address of whoever called our caller. Control resumes two levels up, skipping
 * the rest of the routine that executed `rst 0x08`. The translation models that
 * skip with a BOOLEAN RETURN the caller consumes as an early-return signal:
 *   true  = returned normally (bit clear) -- caller keeps going;
 *   false = skipped (bit set) -- caller must `return` immediately (its own tail
 *           has already been bypassed by the two-level ret).
 *
 * INPUTS:  reads ATTRACT (0x6007); reads the Z80 stack (the two return words).
 * OUTPUTS: SP (+2 normal / +4 skip), PC (caller / caller's-caller), A (ATTRACT
 *          rotated right one bit), F (carry = old bit 0, per rrca), and the
 *          boolean return. Writes NO work RAM -- its whole contract is SP + PC +
 *          A/F + the return value, which is exactly what the unit gate compares
 *          (RAM + the full register file incl. SP, A, F, and pc).
 *
 * The `rrca` is kept verbatim so BOTH A and F match the oracle exactly (A is left
 * rotated and read by nothing downstream; F's carry is only the branch decision).
 * The boolean is the load-bearing output; A/F are preserved for the gate, not
 * because a caller reads them.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block. sub_0008 is atomic on the NMI
 * game-state dispatch path (that handler runs mask-cleared), BUT it is a leaf `rst` helper
 * ALSO reached from the mask-ENABLED main loop: entry_051c (mainloop.js) is a dispatchTask
 * task that does `m.push16(0x051e) / rst 0x08 / if (!m.call(0x0008)) return;`, and the main
 * loop runs with the vblank NMI mask ENABLED. So the NMI CAN land inside this ~4-instruction
 * routine and push a live (now-coarser) PC into the diffed stack RAM -- exactly the
 * mistimed-NMI raster tear the CONVERGENT gate exists for (docs/decompiler-pipeline; see sub_0350), not the
 * strict byte-exact gate a short attract run would pass by never exercising entry_051c. Block
 * totals are the exact SUM of the oracle's per-instruction charges: ld-a,(ATTRACT)+rrca 17 t
 * (the decision block, ending at the `ret nc`); on the SKIP arm, the `ret nc`-not-taken charge
 * + both `inc sp`s fold to 17 t (5+6+6) before the final unconditional `m.ret()` (10 t,
 * charged internally by machine.js, never folded into a preceding total). Branch totals:
 * normal 17+11 = 28 t; skip 17+17+10 = 44 t -- both the oracle's exact sums, so
 * total-preservation keeps the main loop's PRNG spin count (0x6019) deterministic.
 */
export function sub_0008(m) {
  const { regs, mem } = m;

  // Block: ld a,(ATTRACT) [13] + rrca [4] = 17 t -- rotate the enable bit (bit 0) into carry.
  regs.a = mem.read8(ATTRACT);
  regs.rrca();
  m.step(0x000c, 17);

  if (regs.fNC) {
    // ret nc taken: bit 0 clear -- normal return to the caller (SP += 2).
    m.ret(11);
    return true;
  }

  // Block: ret nc NOT taken [5] + inc sp [6] + inc sp [6] = 17 t -- bit 0 set: discard our own
  // return address, then the final ret pops the CALLER'S CALLER return (net SP += 4) -- the skip.
  regs.sp = (regs.sp + 1) & 0xffff;
  regs.sp = (regs.sp + 1) & 0xffff;
  m.step(0x000f, 17);
  m.ret(); // ret -- returns to the caller's caller
  return false;
}
