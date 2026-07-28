// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_0347 — hand-optimized rewrite of the translated routine at ROM 0x0347,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. It is a pure LEAF — it calls nothing, so there is no
 * `m.call` here. It imports no code; the two VRAM addresses it selects between
 * are hardware video RAM (0x7400-0x77FF), not work RAM, so they are NOT in
 * ram.js — they live as local constants, the same way handler_01c3 keeps the
 * flip-screen latch 0x7D82 local.
 */

// Player-turn marker VRAM column bases (hardware video RAM, not work RAM — hence
// not in ram.js). sub_0347 returns one of these in HL keyed on A's zero-ness; its
// only caller, sub_0315, passes A = CURRENT_PLAYER (0x600D: 0 = P1, non-zero = P2)
// and then draws a 3-cell vertical marker down the selected column (stepping DE =
// -32 = one tilemap row). Corroborated independently: sub_0a53 (ROM 0x0A53) seeds
// the P1 marker's three cells 0x7740/0x7720/0x7700 with tile "1", and sub_09ee
// (ROM 0x09EE) seeds the P2 marker's 0x74E0/0x74C0/0x74A0 with tile "2" — the
// "1UP"/"2UP" active-player indicator sub_0315 then blinks each 16th frame.
const VRAM_P1_MARK = 0x7740; // "1UP" marker column base (also written by sub_0a53)
const VRAM_P2_MARK = 0x74e0; // "2UP" marker column base (also written by sub_09ee)

/**
 * sub_0347 -- select a player-marker VRAM column base by A.  [ROM 0x0347-0x034F]
 *
 *   0347  21 40 77   ld  hl,0x7740   ; HL = P1 marker column (default)
 *   034a  a7         and a           ; set Z from A (A unchanged), clear carry
 *   034b  c8         ret z           ; A == 0 (player 1): keep HL = P1 marker
 *   034c  21 e0 74   ld  hl,0x74e0   ; else HL = P2 marker column
 *   034f  c9         ret
 *
 * INPUT  : A (the caller's sub_0315 loads CURRENT_PLAYER 0x600D into it).
 * OUTPUT : HL = VRAM_P1_MARK if A == 0, else VRAM_P2_MARK. A is left UNCHANGED
 *          (`and a` is a zero-test, not a modify); F carries the AND result
 *          (Z set iff A == 0, carry cleared, H set, parity of A). No RAM is
 *          written — the routine's entire observable effect is HL (+ F).
 *
 * FLAGS KEPT VERBATIM. The `and a` is preserved exactly so BOTH A and F match the
 * oracle: the unit gate compares the whole register file (F included). The caller
 * consumes neither A's flags directly nor carry here (it uses only HL), but the
 * NMI pushes AF, so F must be identical or a pushed-AF byte would reach diffed
 * stack RAM — so the flag is reproduced rather than dropped.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (the per-instruction charges of
 * each straight-line run folded into a single charge at the block's exit PC). The
 * prologue (default HL to the P1 column, zero-test A) folds to 14 t (exit 0x034b,
 * the `ret z` decision); the taken (Z) arm is a single already-atomic instruction
 * (11 t); the not-taken arm plus selecting the P2 column folds to 15 t (exit
 * 0x034f, the final `ret`, which keeps its own m.ret scaffolding untouched). Every
 * fold's TOTAL is the oracle's, EXACTLY -- total-preservation keeps the main loop's
 * spin count (0x6019, the PRNG entropy) deterministic.
 *
 * Although this is a flagless-looking 5-instruction leaf, it is reached ONLY via
 * `m.call(0x0347)` from sub_0315, which runs in the INTERRUPTIBLE main-loop band
 * (mainLoop calls sub_0315 every pass, so during the vblank spin it is re-invoked
 * ~140x/frame), and the vblank NMI is MEASURED to land INSIDE this routine on real
 * runs. So the collapse coarsens where an in-flight NMI's PC would land (a
 * block-exit address, not the exact instruction) -- exactly the CONVERGENT gate's
 * license (docs/decompiler-pipeline): an earlier attempt at this same collapse, gated with the
 * STRICT whole-machine comparison, diverged in dead stack RAM (excluded by the
 * convergent gate, not by the strict one) -- see equivalence-0347.test.js, which
 * gates the whole-machine job with convergentGate. The optimization win here is
 * therefore NAMES (0x7740/0x74E0 as the P1/P2 marker VRAM columns) + structured
 * control flow + fewer m.step charges, all proven under the gate that actually
 * fits an interruptible leaf.
 *
 * BRANCHES (both proven EQUAL by the test; the natural/driven run only ever takes
 * the Z arm because a 1-player game holds CURRENT_PLAYER == 0, so the NZ arm is
 * SYNTHESISED):
 *   Z  (A == 0, player 1): HL = 0x7740, total 10+4+11        = 25 t.
 *   NZ (A != 0, player 2): HL = 0x74E0, total 10+4+5+10+10   = 39 t.
 */
export function sub_0347(m) {
  const { regs } = m;

  // Block A: default HL to the player-1 marker column, then zero-test A (A is
  // CURRENT_PLAYER, unchanged by `and a`).  10+4 = 14 t.
  regs.hl = VRAM_P1_MARK;
  regs.and(regs.a);
  m.step(0x034b, 14);

  if (regs.fZ) {
    // ret z taken: A == 0 (player 1) -- keep HL = P1 marker. (11 t.)
    m.ret(11);
    return;
  }

  // Block B (ret z not taken -- player 2): select the P2 marker column.
  //   5+10 = 15 t.
  regs.hl = VRAM_P2_MARK;
  m.step(0x034f, 15);
  m.ret(); // ret (10 t) -- own scaffolding, untouched
}
