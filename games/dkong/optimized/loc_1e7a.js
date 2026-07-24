// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e7a — hand-optimized rewrite of the translated routine at ROM 0x1e7a,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its one callee on the taken branch (0x1e6d = loc_1e6d,
 * reached by the `jp 0x1e6d` fall-through) is invoked through `m.call`, the routine
 * registry (games/dkong/routines.js), so it resolves to the oracle or to loc_1e6d's
 * own optimized rewrite — never a copied implementation here. loc_1e7a touches no
 * absolute RAM address itself (it works purely on register A and the flags), so
 * nothing is imported from ram.js.
 */

/**
 * loc_1e7a -- the Mario-Y guard inside the 0x1E57 sprite-orientation family.
 * [ROM 0x1E7A-0x1E7F, then on the taken branch jp loc_1e6d @ 0x1E6D]
 *
 *   1e7a  fe 31        cp   0x31          ; A (= Mario's Y) vs row 0x31
 *   1e7c  d0           ret  nc            ; Y >= 0x31 -> normal return, mirror flag untouched
 *   1e7d  c3 6d 1e     jp   0x1e6d        ; Y <  0x31 -> into loc_1e6d, carry SET
 *
 * WHAT IT DOES. This is one leaf of the routine that decides the horizontal
 * MIRROR of a sprite in the 0x1E57 cluster (loc_1e6d writes the sprite-record
 * mirror byte 0x694D — 0x00 vs 0x80 — from the carry it is handed). sub_1e57 is
 * the only caller: it selects this leaf with `jp c,0x1e7a` after loading A from
 * MARIO_Y (0x6205), so on entry **A is Mario's Y position**.
 *
 * loc_1e7a is the "is Mario near the top of the screen?" test:
 *   - Y at/below row 0x31 (A >= 0x31, no carry): `ret nc` — return to sub_1e57's
 *     caller and leave the mirror byte as it was. This is the overwhelmingly common
 *     case (100% of the 816 attract dispatches take it).
 *   - Y above row 0x31 (A < 0x31, carry set): fall through into loc_1e6d. Because
 *     `cp 0x31` set the carry on exactly this branch, loc_1e6d sees carry=1 and so
 *     writes mirror byte 0x694D := 0x00, then loc_1e85 latches GAME_SUBSTATE
 *     (0x600A) := 0x16 and UNWINDS two stack levels (this leaf never returns
 *     normally — `m.call(0x1e6d)` propagates loc_1e85's `false`).
 *
 * INPUTS  : register A (Mario's Y, loaded by sub_1e57 from 0x6205). The stack
 *           (sub_1e57's return chain, consumed on the carry branch by loc_1e85's
 *           unwind).
 * OUTPUTS : NONE written by this routine directly. On the no-carry branch: just a
 *           `ret` (register file incl. F = the `cp 0x31` result). On the carry
 *           branch: loc_1e6d's / loc_1e85's effects (0x694D := 0, 0x600A := 0x16,
 *           two-level unwind) reached via `m.call`. Register file (A, F, HL, PC,
 *           SP) matches the oracle on both branches.
 *
 * The threshold 0x31 is a Y-row literal, kept as a named local (not a ram.js
 * address). loc_1e7a reads no absolute RAM address, so ram.js imports nothing.
 *
 * FLAGS -- `cp 0x31` is KEPT VERBATIM and NOTHING is dropped. Its carry is
 * load-bearing twice over: this routine's own branch reads it (`ret nc` /
 * fall-through), AND on the carry branch loc_1e6d reads that same carry to pick the
 * mirror value. On the no-carry branch `cp` is also the last flag-writer before the
 * `ret`, so the returned F must equal the oracle's. The unit gate compares the whole
 * register file including F (and the F3/F5 bits), so the verbatim `cp` is what makes
 * it match. There is no dead register churn to drop.
 *
 * CYCLES -- kept at the oracle's per-branch granularity, which for this routine is
 * ALREADY minimal (there is nothing to collapse):
 *   - no-carry branch: `cp` 7 t + `ret nc` 11 t = 18 t. One m.step + one m.ret; the
 *     `ret` cannot fold into the m.step (it does the pop + return), so this arm is
 *     already one-charge-per-instruction-that-can't-merge.
 *   - carry branch: `cp` 7 t + `ret nc` not-taken 5 t + `jp` 10 t = 22 t before the
 *     callee. This arm is KEPT PER-INSTRUCTION rather than collapsed to a single 22 t
 *     lump: loc_1e7a runs inside the interruptible per-frame update cascade loc_197a,
 *     so the vblank NMI CAN land in this window, but the carry branch is NEVER taken
 *     in the attract run the convergent gate exercises (0 of 816 dispatches) — so a
 *     collapse of it cannot be whole-machine verified. Per docs/06 ("genuinely
 *     interruptible AND the convergent run can't verify a collapse -> keep
 *     per-instruction"), it stays split. It matches the oracle charge-for-charge; the
 *     branch's exact TOTAL (102 t incl. the loc_1e6d/loc_1e85 tail cascade) is
 *     asserted by the unit branch-coverage test.
 * total-preservation on the exercised (no-carry) arm keeps the main loop's spin count
 * (0x6019, the PRNG entropy) deterministic — the convergent gate's teeth catch a
 * wrong total there.
 *
 * The `jp 0x1e6d` is a TAIL jump with NO push16: loc_1e6d (and the loc_1e85 it flows
 * into) unwind to sub_1e57's caller, not back here. loc_1e6d is reached via
 * `m.call(0x1e6d)` so it resolves to the oracle or to its own optimized rewrite; it
 * is left per-instruction because IT is interruptible too. `return` propagates the
 * callee's boolean (loc_1e85 returns `false` = "unwound"; the no-carry arm returns
 * `true` = "normal return").
 */
export function loc_1e7a(m) {
  const { regs } = m;

  // A holds Mario's Y (loaded by the caller sub_1e57 from MARIO_Y 0x6205).
  const MARIO_Y_TOP_THRESHOLD = 0x31; // screen row; below it, Mario is "near the top"

  // cp sets carry iff Y < 0x31; that carry is read here AND by loc_1e6d, so keep it verbatim.
  regs.cp(MARIO_Y_TOP_THRESHOLD);
  m.step(0x1e7c, 7); // cp 0x31

  if (!regs.fC) {
    // Y at/below row 0x31: normal return, mirror byte left untouched. 7 + 11 = 18 t.
    m.ret(11); // ret nc
    return true;
  }

  // Y above row 0x31: fall into loc_1e6d with carry SET (so loc_1e6d writes 0x694D := 0).
  // Kept per-instruction (interruptible + not exercised by the convergent run): 5 + 10 t.
  m.step(0x1e7d, 5); // ret nc not taken
  m.step(0x1e6d, 10); // jp 0x1e6d
  return m.call(0x1e6d);
}
