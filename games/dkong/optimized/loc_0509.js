// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0509 — hand-optimized rewrite of the translated routine at ROM 0x0509,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Both callees (0x04f9, 0x04e1) are reached through
 * `m.call(0xADDR)`, which resolves via the routine registry
 * (games/dkong/routines.js) to the oracle — or to that callee's own optimized
 * rewrite once one exists (0x04e1 already has one) — so there is never a copied
 * implementation here to drift. Only the RAM *name* MARIO_X is imported (from ram.js).
 */

import { MARIO_X } from "./ram.js";

/**
 * loc_0509 -- the bit6-clear arm of the (0x6227)==4 colour-blink block. [ROM 0x0509-0x0513]
 *
 *   0509  3a 03 62     ld   a,(0x6203)      ; A = MARIO_X
 *   050c  fe 80        cp   0x80            ; which half of the screen is Mario on?
 *   050e  d2 f9 04     jp   nc,0x04f9       ; X >= 0x80 -> loc_04f9 (blink OFF)
 *   0511  c3 e1 04     jp   0x04e1          ; X <  0x80 -> loc_04e1 (blink ON)
 *
 * WHAT IT DOES. A tiny two-way router. loc_04be reaches it (`jp z,0x0509`) when
 * bit 6 of the colour-cycle frame counter C is CLEAR; loc_0509 then picks the
 * blink polarity from which half of the screen Mario is on. It is the same
 * MARIO_X < 0x80 test loc_04be's OTHER (bit6-set) arm makes, routed to the same
 * two blink leaves but SWAPPED: here X >= 0x80 turns the blink OFF and X < 0x80
 * turns it ON (loc_04be's bit6-set arm does the opposite), which is how the blink
 * phase alternates with the frame counter's bit 6.
 *   - X >= 0x80 (right half): tail-jump loc_04f9 -- clears bit7 of 0x6901/0x6905 (OFF).
 *   - X <  0x80 (left half):  tail-jump loc_04e1 -- sets   bit7 of 0x6901/0x6905 (ON).
 *
 * INPUTS.  MARIO_X (0x6203); C (the colour-cycle frame counter, forwarded
 * UNTOUCHED to loc_04f9/loc_04e1 -> loc_04ac, which branches on it). OUTPUTS.
 * None of its own -- every store happens in the leaf it tail-jumps to. A ends
 * holding MARIO_X and F holds `cp 0x80`'s result at the tail-call boundary; both
 * are immediately overwritten by the leaf (its first act reloads A from 0x6901),
 * so nothing downstream consumes them -- but they are kept EXACT because the unit
 * gate compares the whole register file (F, A included) at that boundary.
 *
 * TAIL-CALLS, NOT CALLS. Both exits are `jp` (not `call`): control leaves loc_0509
 * for good and the leaf's own `ret` returns to loc_0509's caller's caller. So there
 * is NO `m.push16` -- pushing a return address would unbalance SP against the leaf's
 * `ret`. Modelled exactly as the ROM: `m.call(0x04f9)` / `m.call(0x04e1)` with no push.
 *
 * ATOMIC? NO -- ATOMICITY IS PER-CALL-PATH: loc_0509's ONLY caller is loc_04be
 * (state0.js `jp z,0x0509`), reached via loc_197a -> entry_03fb -> the loc_0413
 * colour tree -> loc_0486 -> loc_04be -- the INTERRUPTIBLE per-frame in-game cascade
 * with the vblank NMI mask ENABLED. The NMI can land inside this router (and inside
 * the interruptible blink leaves it tail-jumps to) -- so the collapse below is
 * LICENSED by the CONVERGENT gate (docs/decompiler-pipeline), not the strict whole-machine gate,
 * exactly as sub_0350's. Same decision as loc_04be / loc_04e1 / loc_04ac / entry_03fb
 * / loc_197a.
 *
 * FLAGS. `cp 0x80`'s result is kept verbatim on both exits (see INPUTS): produced
 * identically by `regs.cp(0x80)`, and neither `jp` touches flags, so F matches the
 * oracle at the tail-call boundary.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block. Behaviourally byte-identical to
 * ../translated/state0.js. Branch totals (own instrs, unchanged by the collapse):
 * Block 1 (ld a,(MARIO_X) [13] + cp 0x80 [7]) = 20 t; X>=0x80 exit adds the `jp nc`
 * taken charge (10) = 30 t own total; X<0x80 exit folds `jp nc` not-taken (10) + `jp
 * 0x04e1` (10) = 20 t (Block 2), for 40 t own total.
 */
export function loc_0509(m) {
  const { regs, mem } = m;

  // Block 1: ld a,(MARIO_X) (13) + cp 0x80 (7) = 20 t.
  regs.a = mem.read8(MARIO_X);
  regs.cp(0x80);
  m.step(0x050e, 20);

  if (regs.fNC) {
    // jp nc,0x04f9 taken -- X >= 0x80 (right half) -> blink OFF. own total 30 t.
    m.step(0x04f9, 10);
    return m.call(0x04f9);
  }

  // Block 2: jp nc NOT taken (10) + jp 0x04e1 (10) = 20 t -- X < 0x80 (left half) ->
  // blink ON. own total 40 t.
  m.step(0x04e1, 20);
  return m.call(0x04e1);
}
