// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_30fa — hand-optimized rewrite of the translated routine at ROM 0x30FA,
 * proven equal to its oracle by the equivalence harness. A read-and-dispatch tail; it
 * writes no work RAM (only reads the 0x6380 animation index) and names none.
 */

/**
 * sub_30fa -- dispatch on the animation-phase index 0x6380 (clamped) via rst 0x28.  [ROM 0x30FA-0x3113]
 *
 * Four callers. It reads the phase index at 0x6380, clamps it to 5 (values >= 6 become 5),
 * then TAIL-dispatches through the inline rst-0x28 table at 0x3104 to the selected guard
 * (the guard_31xx family). The guard's skip-boolean (the sub_0008 convention) is returned
 * straight up to this routine's caller.
 *
 * The dispatcher is reached through m.call(0x0028) (the registry) with the table base
 * label, matching the translation; the rst pushes 0x3104 (the table base) which sub_0028's
 * `pop hl` consumes.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (the per-instruction charges of
 * each straight-line run folded into a single charge at the block's exit PC). The
 * read + compare folds to 20 t (exit 0x30ff, the `jr c` decision); the taken (A < 6)
 * arm is a single already-atomic instruction (12 t); the not-taken arm plus the
 * clamp folds to 14 t (exit 0x3103). Every fold's TOTAL is the oracle's, EXACTLY --
 * total-preservation keeps the main loop's spin count (0x6019, the PRNG entropy)
 * deterministic. The `rst 0x28` tail dispatch keeps its push16/step/m.call
 * scaffolding untouched.
 *
 * Four call paths, not all provably mask-cleared, so the collapse coarsens where an
 * in-flight NMI's PC would land (a block-exit address, not the exact instruction) --
 * the CONVERGENT gate's license (docs/decompiler-pipeline); see equivalence-30fa.test.js.
 */
export function sub_30fa(m) {
  const { regs, mem } = m;

  // Block A: read the phase index and compare it to 6.  13+7 = 20 t.
  regs.a = mem.read8(0x6380);
  regs.cp(0x06);
  m.step(0x30ff, 20);
  if (regs.fC) {
    m.step(0x3103, 12); // jr c taken (A < 6) -- already one instruction, 12 T
  } else {
    // jr c not taken(7) + clamp to 5(7) = 14 t.
    regs.a = 0x05; // clamp
    m.step(0x3103, 14);
  }

  // rst 0x28 -- TAIL dispatch. Push the table base (0x3104); sub_0028 indexes it and
  // returns the selected guard's skip-boolean, which we pass straight up.
  m.push16(0x3104);
  m.step(0x0028, 11);
  return m.call(0x0028, "0x3104 (sub_30fa dispatch)");
}
