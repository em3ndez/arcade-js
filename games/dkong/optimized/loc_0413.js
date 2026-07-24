// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0413 — hand-optimized rewrite of the translated routine at ROM 0x0413,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its two tail callees (0x0426 loc_0426, 0x0486 loc_0486)
 * are reached through `m.call`, the routine registry (games/dkong/routines.js),
 * so each resolves to the oracle or to a future optimized rewrite — never a copy.
 * Only the RAM name FRAME is imported (from ram.js).
 */

import { FRAME } from "./ram.js";

/**
 * loc_0413 -- head of the per-frame colour-cycle / intro-animation update.
 * [ROM 0x0413-0x0425, then falls into loc_0426 @ 0x0426]
 *
 *   0413  3a 91 63   ld  a,(0x6391)   ; A = colour-cycle "active" latch
 *   0416  a7         and a            ; set Z from the latch
 *   0417  c2 26 04   jp  nz,0x0426    ; latch set -> advance the frame counter
 *   041a  3a 1a 60   ld  a,(0x601a)   ; A = FRAME (the vblank down-counter)
 *   041d  a7         and a            ; set Z from FRAME
 *   041e  c2 86 04   jp  nz,0x0486    ; FRAME != 0 -> just redraw the colour tail
 *   0421  3e 01      ld  a,0x01
 *   0423  32 91 63   ld  (0x6391),a   ; FRAME == 0 sync point: arm the latch
 *   0426             (falls into loc_0426, advancing the counter)
 *
 * WHAT IT DOES. This is the gate at the top of the colour-cycle animation that
 * entry_03fb (the ATTRACT / intro colour driver, ROM 0x03FB, dispatched every
 * frame by the loc_197a update cascade) tail-jumps into, and that the scheduled
 * task at ROM 0x0400 (entry_0400) also reaches. It decides, once per frame,
 * whether to ADVANCE the animation's own frame counter (0x6390, stepped in
 * loc_0426) or merely REDRAW the current colour columns (loc_0486):
 *
 *   - latch (0x6391) already set  -> loc_0426  (advance counter; the running phase)
 *   - latch clear, FRAME != 0     -> loc_0486  (idle: redraw only, don't advance)
 *   - latch clear, FRAME == 0     -> arm the latch (0x6391 := 1), fall into loc_0426
 *
 * So 0x6391 is a one-shot "animation active" latch: it is ARMED here the single
 * frame FRAME wraps to 0, and CLEARED by loc_0464 when the 0x6390 counter reaches
 * 0x80 -- pinning the animation phase to the 256-frame FRAME cycle. (0x6391 is
 * currently UNNAMED in ram.js -- the world verifier left the 0x6390/0x6391/0x6393
 * block hex -- so it stays a hex literal here and is reported as a naming
 * candidate; only FRAME=0x601a is an established name.)
 *
 * INPUTS:  reads (0x6391) and FRAME (0x601a).
 * OUTPUTS: on the FRAME==0 branch, writes (0x6391)=1 (work RAM, NOT a hardware
 *          latch -- no bus-cycle-positioned write, so no write-trace concern);
 *          then tail-calls loc_0426 / loc_0486 which do the visible work.
 *
 * FLAGS. The routine never returns a `cc` -- every path tail-calls, so its
 * observable "return" is whatever loc_0426 / loc_0486 leave. The Z flag each
 * `and a` sets is consumed IMMEDIATELY by the very next `jp`/`jp` and then
 * overwritten by the first flag-setting op of the tail routine (loc_0426's
 * `inc (hl)`, loc_0486's compares) before anything reads it. The flag ops are
 * nonetheless kept VERBATIM (`regs.and(regs.a)`), so A and F match the oracle
 * bit-for-bit at every point -- the unit gate compares the whole register file.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (the per-instruction charges of
 * each straight-line run folded into a single charge at the block's exit PC). The
 * latch-test prologue folds to 17 t (exit 0x0417, the `jp nz,0x0426` decision); the
 * taken (latch set) arm is a single already-atomic instruction (10 t, tail to
 * loc_0426); the not-taken charge plus the FRAME test folds to 27 t (exit 0x041e,
 * the `jp nz,0x0486` decision); the taken (FRAME != 0) arm is a single instruction
 * (10 t, tail to loc_0486); the not-taken charge plus arming the latch folds to 30 t
 * (exit 0x0426, the fall-through tail into loc_0426). Every fold's TOTAL is the
 * oracle's, EXACTLY -- total-preservation keeps the main loop's spin count (0x6019,
 * the PRNG entropy) deterministic. Every tail still reaches its callee through
 * m.call (the registry).
 *
 * loc_0413 is a LEAF reached via m.call, and by the atomicity-is-per-call-path rule
 * it is NOT atomic: every one of its callers is interruptible with the NMI mask
 * ENABLED --
 *   - entry_03fb <- loc_197a (the main-loop per-frame update cascade; loc_197a
 *     itself is kept per-instruction for exactly this reason), and
 *   - entry_0400 (a dispatchTask task, ROM 0x0400).
 * So the collapse coarsens where an in-flight NMI's PC would land (a block-exit
 * address, not the exact instruction) -- the CONVERGENT gate's license (docs/06).
 * "Atomic" is a property of the SCENARIO tested, not of the routine, so
 * equivalence-0413.test.js gates the whole-machine job with convergentGate (a
 * custom driven scenario) rather than a strict comparison, even though a strict
 * driven run happens to still pass after this collapse.
 */
export function loc_0413(m) {
  const { regs, mem } = m;

  // Block A: is the colour-cycle animation latch set?  13+4 = 17 t.
  regs.a = mem.read8(0x6391);
  regs.and(regs.a);
  m.step(0x0417, 17);

  if (regs.fNZ) {
    // Latch set: advance the animation's frame counter (loc_0426).
    m.step(0x0426, 10); // jp nz,0x0426 taken -- already one instruction
    return m.call(0x0426);
  }

  // Block B (jp nz not taken): has the vblank counter wrapped to 0 this frame?
  //   10+13+4 = 27 t.
  regs.a = mem.read8(FRAME);
  regs.and(regs.a);
  m.step(0x041e, 27);

  if (regs.fNZ) {
    // Latch clear and FRAME != 0: idle phase -- just redraw the colour tail.
    m.step(0x0486, 10); // jp nz,0x0486 taken -- already one instruction
    return m.call(0x0486);
  }

  // Block C (jp nz not taken -- FRAME == 0 sync point): arm the "animation active"
  // latch, then fall into loc_0426.  10+7+13 = 30 t.
  regs.a = 0x01;
  mem.write8(0x6391, regs.a);
  m.step(0x0426, 30);
  return m.call(0x0426);
}
