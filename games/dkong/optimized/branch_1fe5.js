// SPDX-License-Identifier: GPL-3.0-only
/**
 * branch_1fe5 — hand-optimized rewrite of the translated routine at ROM 0x1FE5,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its single tail (0x1ff6 = shared_1ff6, the +/-X clamp &
 * sprite-record tail, reached by the `jp 0x1ff6`) is invoked through `m.call`, the
 * routine registry (games/dkong/routines.js), so it resolves to the oracle or to
 * shared_1ff6's own optimized rewrite — never a copied implementation here. No
 * absolute named RAM address is touched (the one write is the IX-relative object
 * field ix+3), so nothing is imported from ram.js.
 */

// Object-record field offset. IX points at the current object record (0x6700 +
// slot*0x20 in the sub_1f72 per-frame scan); ix+3 is its X coordinate. Same field
// convention already used in optimized/sub_2079.js ("SLOT_X = 0x03: object X
// coordinate, velocity-stepped by branch_1fe5/1fef"). Left as a raw offset — ram.js
// names ABSOLUTE addresses, not object-record offsets (see the report: no candidate).
const SLOT_X = 0x03;

/**
 * branch_1fe5 -- the "+X" (move-right) velocity step for an active object, then
 * TAIL-JUMP into the shared clamp/sprite tail.  [ROM 0x1FE5-0x1FEE, then jp 0x1ff6]
 *
 *   1fe5  d9           exx                ; swap in the shadow BC/DE/HL bank
 *   1fe6  01 00 01     ld   bc,0x0100     ; shadow BC := +X velocity vector
 *   1fe9  dd 34 03     inc  (ix+0x03)     ; object X += 1 (step one pixel right)
 *   1fec  c3 f6 1f     jp   0x1ff6        ; TAIL jump into shared_1ff6 (no push)
 *
 * WHAT IT DOES. One of the four direction arms loc_1f93 dispatches for a moving
 * object (it rotates (ix+2) through `rra` and jumps here on bit-1 set). This is the
 * RIGHT arm: it seeds the shadow BC with the +X velocity vector 0x0100 (high byte
 * 0x01 = +1 in X, low byte 0x00) and advances the object's X coordinate (ix+3) by
 * one, then falls into the common tail shared_1ff6, which range-clamps the new X,
 * writes the sprite record, and continues the object scan. Its mirror twin
 * branch_1fef is the LEFT arm: same shape but BC := 0xFF04 and `dec (ix+3)`.
 *
 * The `exx` selects the shadow register bank so the velocity vector loaded into BC
 * is the *shadow* BC the downstream tail/callees consume; `exx` swaps BC/DE/HL only,
 * NOT IX/IY/AF, so IX still addresses the same object record and the flag register is
 * untouched by it.
 *
 * INPUTS  : IX (object-record base, 0x6720-region work RAM in the live scan); the
 *           stack (a caller return address for shared_1ff6's eventual `ret`).
 * OUTPUTS : RAM (ix+0x03) := old+1. Register file at the tail transfer: the shadow
 *           bank is now active with BC := 0x0100 (DE/HL take their shadow values via
 *           exx); A/IX/IY/SP unchanged; F := the Z80 `inc` flags from the (ix+3)
 *           step (S/Z/H/PV per the new value, carry preserved); PC := 0x1ff6. Then
 *           shared_1ff6's effects. Its (skip-capable) return value is forwarded.
 *
 * FLAGS. Only `inc (ix+3)` writes a flag, and it is the LAST flag-writer before the
 *   exit, so F at the tail transfer is exactly the inc's result -- it is KEPT, not
 *   dropped (docs/decompiler-pipeline: keep the flag-producing op when it is the last writer before
 *   the exit). `incMem8` reproduces the Z80 inc semantics (carry preserved, S/Z/H/PV
 *   set) identically to the oracle's `inc8`, so the whole register file (incl. F and
 *   the undocumented F3/F5 bits) matches. `exx` and `ld bc` set no flags. There is no
 *   dead register churn to strip here: all three effects (bank swap, velocity vector,
 *   X step) are load-bearing -- the velocity BC is read by a downstream callee (its
 *   sign is the whole difference between this arm and branch_1fef).
 *
 * CYCLES -- COLLAPSED to ONE m.step for the whole straight-line block (there is no
 *   branch): exx[4] + ld bc[10] + inc (ix+3)[23] + jp[10] = 47 t, folded into a
 *   single charge at the block-exit PC 0x1ff6, exactly the oracle's total.
 *   total-preservation keeps the main-loop spin count (0x6019, the PRNG entropy)
 *   deterministic.
 *
 *   The one memory write is to the object record ix+3 (WORK RAM, 0x6723 in the live
 *   scan) -- NOT a tagged hardware latch (0x7800-0f / 0x7c00 / 0x7c80 / 0x7d00-07 /
 *   0x7d80-87) -- so no hidden bus cycle sits inside the block and the full collapse
 *   across it is safe; there is no --writes trace to preserve.
 *
 *   branch_1fe5 is NOT atomic: loc_1f93 dispatches it from sub_1f72's object scan,
 *   which runs in the INTERRUPTIBLE per-frame update cascade loc_197a (@0x1986) and
 *   during attract's demo play, so the vblank NMI can land inside its 47 t window
 *   (measured: ~550 dispatches in a 1200-frame attract run). The collapse is
 *   therefore LICENSED by the CONVERGENT gate (docs/decompiler-pipeline; equivalence-1fe5.test.js uses
 *   convergentGate + SCENARIOS.attract, not the strict whole-machine gate): a
 *   mistimed NMI pushes the coarse block-exit PC into the DEAD stack (excluded) and
 *   can leave a single-frame raster tear that heals next frame; non-stack RAM stays
 *   byte-identical and nothing persistent survives.
 *
 * The `jp 0x1ff6` is a TAIL jump with NO push16: shared_1ff6's eventual `ret`
 * returns to branch_1fe5's caller, not to here. shared_1ff6 is reached via
 * `m.call(0x1ff6)` so it resolves to the oracle or its own optimized rewrite; it is
 * left per-instruction (it too is interruptible and has skip-capable callees).
 * `return` forwards its answer (the `rst`-skip boolean shared_1ff6 may propagate).
 */
export function branch_1fe5(m) {
  const { regs, mem } = m;
  const objX = (regs.ix + SLOT_X) & 0xffff; // object X coordinate field (ix+3)

  // Swap to the shadow BC/DE/HL bank (IX/IY/AF untouched), then load the +X
  // velocity vector into the now-active shadow BC. branch_1fef's -X twin uses 0xFF04.
  regs.exx();
  regs.bc = 0x0100;

  // Step the object one pixel right: inc (ix+3). incMem8 preserves the Z80 inc
  // flags exactly (carry kept, S/Z/H/PV set) -- F here is the last flag write before
  // the exit, so it must match the oracle.
  regs.incMem8(mem, objX);

  // One collapsed charge for the whole block incl. the tail jp:
  // exx[4] + ld bc[10] + inc (ix+3)[23] + jp[10] = 47 t, exit PC 0x1ff6.
  m.step(0x1ff6, 47);
  // TAIL jump (jp, NO push16): shared_1ff6's ret returns to OUR caller. `return`
  // forwards its (skip-capable) answer.
  return m.call(0x1ff6);
}
