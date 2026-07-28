// SPDX-License-Identifier: GPL-3.0-only
/**
 * branch_1fef — hand-optimized rewrite of the translated routine at ROM 0x1FEF,
 * proven equal to its oracle by the equivalence harness.
 *
 * The mirror twin of branch_1fe5 (optimized/branch_1fe5.js): same shape, the -X
 * (move-LEFT) arm instead of the +X (move-RIGHT) arm. Two things differ from the twin,
 * and both matter to equivalence: the velocity vector is 0xFF04 (not 0x0100), the X
 * step is `dec (ix+3)` (not `inc`), and — the structural difference — this arm has NO
 * tail `jp`: it FALLS THROUGH into shared_1ff6, which sits at the very next address
 * 0x1ff6. So its collapsed total is 37 t (exx[4] + ld bc[10] + dec (ix+3)[23]) with no
 * 10 t jump, where the +X twin pays 47 t for its explicit `jp 0x1ff6`.
 *
 * One routine per file. Its single tail (0x1ff6 = shared_1ff6, the +/-X clamp &
 * sprite-record tail, reached here by falling through) is invoked through `m.call`, the
 * routine registry (games/dkong/routines.js), so it resolves to the oracle or to
 * shared_1ff6's own optimized rewrite — never a copied implementation here. No absolute
 * named RAM address is touched (the one write is the IX-relative object field ix+3), so
 * nothing is imported from ram.js.
 */

// Object-record field offset. IX points at the current object record (0x6700 +
// slot*0x20 in the sub_1f72 per-frame scan); ix+3 is its X coordinate. Same field
// convention used in optimized/branch_1fe5.js and optimized/sub_2079.js ("SLOT_X =
// 0x03: object X coordinate, velocity-stepped by branch_1fe5/1fef"). Left as a raw
// offset — ram.js names ABSOLUTE addresses, not object-record offsets (see the report:
// no candidate).
const SLOT_X = 0x03;

/**
 * branch_1fef -- the "-X" (move-left) velocity step for an active object, then FALL
 * THROUGH into the shared clamp/sprite tail.  [ROM 0x1FEF-0x1FF5, then falls into 0x1ff6]
 *
 *   1fef  d9           exx                ; swap in the shadow BC/DE/HL bank
 *   1ff0  01 04 ff     ld   bc,0xff04     ; shadow BC := -X velocity vector
 *   1ff3  dd 35 03     dec  (ix+0x03)     ; object X -= 1 (step one pixel left)
 *   1ff6               (falls into shared_1ff6; NO jp)
 *
 * WHAT IT DOES. One of the four direction arms loc_1f93 dispatches for a moving object
 * (it rotates (ix+2) through `rra` and jumps here on the -X bit). This is the LEFT arm:
 * it seeds the shadow BC with the -X velocity vector 0xFF04 (high byte 0xFF = -1 in X;
 * low byte 0x04) and steps the object's X coordinate (ix+3) down by one, then continues
 * straight into the common tail shared_1ff6, which range-clamps the new X, writes the
 * sprite record, and continues the object scan. Its mirror twin branch_1fe5 is the
 * RIGHT arm: same shape but BC := 0x0100, `inc (ix+3)`, and an explicit `jp 0x1ff6`.
 *
 * The `exx` selects the shadow register bank so the velocity vector loaded into BC is
 * the *shadow* BC the downstream tail/callees consume; `exx` swaps BC/DE/HL only, NOT
 * IX/IY/AF, so IX still addresses the same object record and the flag register is
 * untouched by it.
 *
 * INPUTS  : IX (object-record base, 0x6720-region work RAM in the live scan); the stack
 *           (a caller return address for shared_1ff6's eventual `ret`).
 * OUTPUTS : RAM (ix+0x03) := old-1. Register file at the tail transfer: the shadow bank
 *           is now active with BC := 0xFF04 (DE/HL take their shadow values via exx);
 *           A/IX/IY/SP unchanged; F := the Z80 `dec` flags from the (ix+3) step (S/Z/H/PV
 *           per the new value, N set, carry preserved); PC := 0x1ff6. Then shared_1ff6's
 *           effects. Its (skip-capable) return value is forwarded.
 *
 * FLAGS. Only `dec (ix+3)` writes a flag, and it is the LAST flag-writer before the
 *   exit, so F at the tail transfer is exactly the dec's result -- it is KEPT, not
 *   dropped (docs/decompiler-pipeline: keep the flag-producing op when it is the last writer before the
 *   exit). `decMem8` reproduces the Z80 dec semantics (carry preserved, N set, S/Z/H/PV
 *   per the result) identically to the oracle's `dec8`, so the whole register file (incl.
 *   F and the undocumented F3/F5 bits) matches. `exx` and `ld bc` set no flags. There is
 *   no dead register churn to strip here: all three effects (bank swap, velocity vector,
 *   X step) are load-bearing -- the velocity BC is read by a downstream callee (its sign
 *   is the whole difference between this arm and branch_1fe5).
 *
 * CYCLES -- COLLAPSED to ONE m.step for the whole straight-line block (there is no
 *   branch): exx[4] + ld bc[10] + dec (ix+3)[23] = 37 t, folded into a single charge at
 *   the block-exit PC 0x1ff6, exactly the oracle's total. NOTE the 37 (vs the twin's 47):
 *   branch_1fef FALLS THROUGH into shared_1ff6, so there is NO `jp` and no 10 t jump
 *   charge. total-preservation keeps the main-loop spin count (0x6019, the PRNG entropy)
 *   deterministic.
 *
 *   The one memory write is to the object record ix+3 (WORK RAM, 0x6723 in the live scan)
 *   -- NOT a tagged hardware latch (0x7800-0f / 0x7c00 / 0x7c80 / 0x7d00-07 / 0x7d80-87)
 *   -- so no hidden bus cycle sits inside the block and the full collapse across it is
 *   safe; there is no --writes trace to preserve.
 *
 *   branch_1fef is NOT atomic: loc_1f93 dispatches it from sub_1f72's object scan, which
 *   runs in the INTERRUPTIBLE per-frame update cascade loc_197a (@0x1986) and during
 *   attract's demo play, so the vblank NMI can land inside its 37 t window. The collapse
 *   is therefore LICENSED by the CONVERGENT gate (docs/decompiler-pipeline; equivalence-1fef.test.js uses
 *   convergentGate + SCENARIOS.attract, not the strict whole-machine gate): a mistimed
 *   NMI pushes the coarse block-exit PC into the DEAD stack (excluded) and can leave a
 *   single-frame raster tear that heals next frame; non-stack RAM stays byte-identical
 *   and nothing persistent survives.
 *
 * The transfer to shared_1ff6 is a FALL-THROUGH (no jp, no push16): shared_1ff6's
 * eventual `ret` returns to branch_1fef's caller, not to here. shared_1ff6 is reached via
 * `m.call(0x1ff6)` so it resolves to the oracle or its own optimized rewrite; it is left
 * per-instruction (it too is interruptible and has skip-capable callees). `return`
 * forwards its answer (the `rst`-skip boolean shared_1ff6 may propagate).
 */
export function branch_1fef(m) {
  const { regs, mem } = m;
  const objX = (regs.ix + SLOT_X) & 0xffff; // object X coordinate field (ix+3)

  // Swap to the shadow BC/DE/HL bank (IX/IY/AF untouched), then load the -X velocity
  // vector into the now-active shadow BC. branch_1fe5's +X twin uses 0x0100.
  regs.exx();
  regs.bc = 0xff04;

  // Step the object one pixel left: dec (ix+3). decMem8 preserves the Z80 dec flags
  // exactly (carry kept, N set, S/Z/H/PV per the result) -- F here is the last flag
  // write before the exit, so it must match the oracle.
  regs.decMem8(mem, objX);

  // One collapsed charge for the whole block. NO tail jp (it falls through), so:
  // exx[4] + ld bc[10] + dec (ix+3)[23] = 37 t, exit PC 0x1ff6.
  m.step(0x1ff6, 37);
  // FALL-THROUGH into shared_1ff6 (no push16): its ret returns to OUR caller. `return`
  // forwards its (skip-capable) answer.
  return m.call(0x1ff6);
}
