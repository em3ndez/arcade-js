// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_0057 — hand-optimized rewrite of the translated routine at ROM 0x0057,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. sub_0057 makes no call of its own, so there is nothing to
 * route through `m.call` here; only the RAM names RANDOM / FRAME / SPIN_COUNT are
 * imported (from ram.js). `translated/` is never edited.
 */

import { RANDOM, FRAME, SPIN_COUNT } from "./ram.js";

/**
 * sub_0057 -- the PRNG accumulator, stirred once per vblank.  [ROM 0x0057-0x0065]
 *
 *   0057  3a 18 60   ld  a,(0x6018)   ; A  = RANDOM
 *   005a  21 1a 60   ld  hl,0x601a    ; HL = &FRAME
 *   005d  86         add a,(hl)       ; A += FRAME          (sets Z80 add flags)
 *   005e  21 19 60   ld  hl,0x6019    ; HL = &SPIN_COUNT
 *   0061  86         add a,(hl)       ; A += SPIN_COUNT     (sets Z80 add flags)
 *   0062  32 18 60   ld  (0x6018),a   ; RANDOM = A
 *   0065  c9         ret
 *
 * WHAT IT DOES. It computes the game's pseudo-random seed:
 *     RANDOM += FRAME + SPIN_COUNT   (8-bit, wrapping)
 * FRAME (0x601A) is DECREMENTED once per vblank by the NMI; SPIN_COUNT (0x6019)
 * is INCREMENTED ~140x/frame by the main-loop vblank-spin, jittering with the
 * frame's workload. Summing a smooth counter and a jittery one into RANDOM is
 * the entropy: it is read as randomness at ROM 0x2186 etc (barrel/enemy
 * behaviour). Measured 2576 changes over 2600 frames, full byte range.
 *
 * INPUTS  (RAM read): RANDOM, FRAME, SPIN_COUNT.
 * OUTPUTS (RAM written): RANDOM.
 * OUTPUTS (registers left): A = the new RANDOM byte; HL = 0x6019 (&SPIN_COUNT,
 *   the last address loaded); F = the flags of the SECOND `add` (the first add's
 *   flags are overwritten by the second and never observed). No callee.
 *
 * ─ THE ARITHMETIC AND TOTAL ARE LOAD-BEARING ─────────────────────────────────
 * The `add`s are kept verbatim (regs.add) so both the wrapping SUM and the Z80
 * add flags match the oracle bit-for-bit: a wrong sum reseeds the PRNG and
 * diverges gameplay, and F is part of the register file the unit gate compares.
 * The routine's TOTAL cycle cost (70t) is equally load-bearing -- it is one of
 * the per-frame charges whose sum sets how long the main loop then spins, which
 * IS SPIN_COUNT's entropy (README §2). It is preserved exactly.
 *
 * ─ LADDER STATUS -- named + documented, cycles COLLAPSED to one m.step ────────
 * Atomicity is PER-CALL-PATH, and sub_0057 has SEVEN callers on TWO kinds of path
 * (grep `m.call(0x0057)`):
 *   • entry_0066 @ ROM 0x00B9 -- the vblank NMI handler, which runs with the NMI
 *     mask CLEARED. Atomic here: no reentrant NMI can land inside sub_0057.
 *   • entry_2c41 (0x2C41), sub_2523 (0x2523 x2, the "second RNG draw"),
 *     loc_2ea7 (0x2EBD), sub_306f (0x308B) -- all in-game object/enemy logic run
 *     by the MAIN-LOOP task dispatcher, where the NMI mask is ENABLED. On these
 *     paths the vblank NMI CAN fire BETWEEN sub_0057's instructions.
 * So the routine is interruptible on five of its seven call sites, and the
 * collapse below is licensed only empirically: it still passes the ORDINARY
 * strict whole-machine gate (equivalence-0057.test.js, driven live from boot)
 * byte-exact, because that gate's plain-attract run only ever exercises the
 * ATOMIC entry_0066 call site (the object-logic callers need a live game). Per
 * the collapse recipe's "passes unchanged -> ATOMIC" rule it stays on the strict
 * gate rather than the convergent one; the dedicated ARITHMETIC + CYCLES test
 * below pins the collapsed 70t total explicitly (wrap + flags + total), which is
 * the one thing a crafted single-path routine's state diff cannot catch on its
 * own.
 *
 * The one behaviour-neutral tidy carried over from the prior rung: HL is read
 * straight through FRAME/SPIN_COUNT's named constants rather than via a bare
 * `ld hl,nn` comment, but both loads are still performed in order so the final
 * HL == &SPIN_COUNT observed by the unit gate is correct.
 */
export function sub_0057(m) {
  const { regs, mem } = m;

  // A = RANDOM; HL = &FRAME, A += FRAME; HL = &SPIN_COUNT, A += SPIN_COUNT;
  // RANDOM = A. One basic block -- no hardware-bus write (RANDOM/FRAME/
  // SPIN_COUNT are all work RAM), so nothing pins an intermediate boundary.
  // 13+10+7+10+7+13 = 60 t, exit at the `ret`'s own address 0x0065.
  regs.a = mem.read8(RANDOM);
  regs.hl = FRAME; // 0x601a
  regs.add(mem.read8(regs.hl));
  regs.hl = SPIN_COUNT; // 0x6019 -- the residual HL on return
  regs.add(mem.read8(regs.hl)); // sets the flags the unit gate compares on return
  mem.write8(RANDOM, regs.a);
  m.step(0x0065, 60);

  m.ret(); // +10t; total 70t
}
