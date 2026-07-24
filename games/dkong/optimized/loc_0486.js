// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0486 — hand-optimized rewrite of the translated routine at ROM 0x0486,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its three tail callees (0x04be loc_04be, 0x04a1 loc_04a1,
 * 0x04a3 loc_04a3) are reached through `m.call`, the routine registry
 * (games/dkong/routines.js), so each resolves to the oracle or to a future
 * optimized rewrite — never a copy. Only the RAM name BOARD is imported (from ram.js).
 */

import { BOARD } from "./ram.js";

/**
 * loc_0486 -- the "redraw the colour columns" tail of the per-frame intro /
 * attract colour-cycle animation. [ROM 0x0486-0x04A0, then tail-calls
 * loc_04a1 / loc_04a3 / loc_04be]
 *
 *   0486  3a 90 63   ld  a,(0x6390)   ; A = colour-cycle frame counter (the PHASE)
 *   0489  4f         ld  c,a          ; C = phase -- handed to the colour writer sub_0514
 *   048a  11 20 00   ld  de,0x0020    ; DE = 0x20 = the row stride sub_0514 walks
 *   048d  3a 27 62   ld  a,(0x6227)   ; A = BOARD (1..4)
 *   0490  fe 04      cp  0x04         ; board 4 == 100m rivets?
 *   0492  ca be 04   jp  z,0x04be     ; -> loc_04be (100m's two-column blink block)
 *   0495  79         ld  a,c          ; A = phase
 *   0496  a7         and a            ; phase == 0?
 *   0497  ca a1 04   jp  z,0x04a1     ; phase 0 -> loc_04a1 (colour byte 0x10)
 *   049a  3e ef      ld  a,0xef       ; else default colour byte 0xEF
 *   049c  cb 71      bit 6,c          ; high half of the 0..0x7F phase cycle?
 *   049e  c2 a3 04   jp  nz,0x04a3    ; bit6 set -> loc_04a3, keep A = 0xEF
 *   04a1             (falls into loc_04a1, which forces A = 0x10)
 *
 * WHAT IT DOES. This is the leaf every arm of the colour-cycle tree funnels into
 * to actually repaint the animated colour columns for the current frame. It is a
 * tail target reached SEVEN ways -- from loc_0413 (the FRAME!=0 idle branch,
 * which is how it runs in practice), loc_0426, loc_0450 (×2), loc_0464, and
 * loc_0478 -- all inside the loc_197a per-frame update cascade. It picks the
 * colour BYTE for this frame and where to write it:
 *
 *   - BOARD == 4 (100m)          -> loc_04be : the rivet board's dedicated block,
 *                                   two sub_0514 columns + an X-position blink.
 *   - BOARD != 4, phase == 0     -> loc_04a1 : colour byte 0x10 (via loc_04a1 -> loc_04a3).
 *   - BOARD != 4, phase's bit6=1 -> loc_04a3 : colour byte 0xEF (the high half of the
 *                                   0x00..0x7F phase cycle -- the counter is reset at
 *                                   0x80 by loc_0464, so bit6 marks the second quarter-
 *                                   pair, giving the 0xEF/0x10 colour alternation).
 *   - BOARD != 4, phase's bit6=0 -> loc_04a1 : falls through, colour byte 0x10.
 *
 * So 0x6390's bit6 is the colour-cycle toggle: A = 0xEF for phase 0x40..0x7F and
 * A = 0x10 for phase 0x00..0x3F, which loc_04a3 writes down a colour column via
 * sub_0514 (using C = phase and DE = 0x20). 0x6390 is currently UNNAMED in ram.js
 * -- the world verifier left the 0x6390/0x6391/0x6393 animation block hex -- so it
 * stays a hex literal here and is reported as a naming candidate; only BOARD =
 * 0x6227 is an established name.
 *
 * INPUTS:  reads 0x6390 (phase counter) and BOARD (0x6227).
 * OUTPUTS: writes NO RAM itself -- it only sets up registers (C = phase, DE = 0x20,
 *          A = the colour byte) and tail-calls loc_04a1 / loc_04a3 / loc_04be,
 *          which do the visible colour-RAM writes. No hardware latch is touched
 *          here (the tails' sub_0514 writes go to colour VRAM, not a 0x7Dxx latch),
 *          so there is no bus-cycle-positioned write and no write-trace concern in
 *          this routine.
 *
 * FLAGS. The routine never returns a `cc` -- every path tail-calls, so its
 * observable "return" is whatever the tail routine leaves. Each flag-setting op
 * (`cp 0x04`, `and a`, `bit 6,c`) is consumed IMMEDIATELY by the very next `jp`
 * and then overwritten by the tail routine's own first flag op before anything
 * reads it. The ops are nonetheless kept VERBATIM (`regs.cp`, `regs.and`,
 * `regs.bit`) so A and F match the oracle bit-for-bit at every m.call boundary --
 * the unit gate compares the whole register file, F included. C and DE are the
 * real live outputs the tail's sub_0514 consumes, so they must be exact.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (the per-instruction charges of
 * each straight-line run folded into a single charge at the block's exit PC). The
 * prologue (read the phase into C, set DE=0x20, read BOARD, compare to 4) folds to
 * 47 t (exit 0x0492, the `jp z,0x04be` decision); the BOARD==4 taken arm is a single
 * already-atomic instruction (10 t, tail to loc_04be); the not-taken charge plus
 * `ld a,c` / `and a` folds to 18 t (exit 0x0497, the `jp z,0x04a1` decision); the
 * phase==0 taken arm is a single instruction (10 t, tail to loc_04a1); the not-taken
 * charge plus `ld a,0xef` / `bit 6,c` folds to 25 t (exit 0x049e, the `jp nz,0x04a3`
 * decision); both final arms (bit6 set -> loc_04a3, bit6 clear -> fall into loc_04a1)
 * are already single instructions. Every fold's TOTAL is the oracle's, EXACTLY --
 * total-preservation keeps the main loop's spin count (0x6019, the PRNG entropy)
 * deterministic. Every tail still reaches its callee through m.call (the registry).
 *
 * loc_0486 is a LEAF reached only via m.call -- SEVEN ways, all inside the loc_197a
 * main-loop per-frame colour cascade (and the scheduled task entry_0400), where every
 * caller is interruptible with the NMI mask ENABLED. So the collapse coarsens where
 * an in-flight NMI's PC would land (a block-exit address, not the exact instruction)
 * -- the CONVERGENT gate's license (docs/06). "Atomic" is a property of the SCENARIO
 * tested, not of the routine, so even though the OLD strict driven whole-machine test
 * (1830 frames of coin+start-1 gameplay) happened to pass unchanged after this
 * collapse, that is a brittle guarantee that could false-fail on a benign tear under
 * a different scenario -- equivalence-0486.test.js therefore gates this routine with
 * convergentGate (a custom driven scenario) rather than the strict comparison.
 */
export function loc_0486(m) {
  const { regs, mem } = m;

  // Block A: read the colour-cycle phase into C, set the row stride DE=0x20, read
  // BOARD, and compare it to 4.  13+4+10+13+7 = 47 t.
  regs.a = mem.read8(0x6390); // 0x6390 UNNAMED in ram.js (animation block left hex)
  regs.c = regs.a;
  regs.de = 0x0020;
  regs.a = mem.read8(BOARD);
  regs.cp(0x04);
  m.step(0x0492, 47);
  if (regs.fZ) {
    // board == 4: hand off to the 100m two-column blink block.
    m.step(0x04be, 10); // jp z,0x04be taken -- already one instruction
    return m.call(0x04be);
  }

  // Block B (jp z not taken -- board != 4): is the phase counter 0?
  //   10+4+4 = 18 t.
  regs.a = regs.c;
  regs.and(regs.a);
  m.step(0x0497, 18);
  if (regs.fZ) {
    // phase == 0: colour byte 0x10 (loc_04a1 loads it, then falls into loc_04a3).
    m.step(0x04a1, 10); // jp z,0x04a1 taken -- already one instruction
    return m.call(0x04a1);
  }

  // Block C (jp z not taken -- phase != 0): default colour 0xEF; is the phase in the
  // cycle's high half?  10+7+8 = 25 t.
  regs.a = 0xef;
  const b6 = regs.bit(6, regs.c);
  m.step(0x049e, 25);
  if (b6) {
    // bit6 set (phase 0x40..0x7F): keep colour 0xEF and write it (loc_04a3).
    m.step(0x04a3, 10); // jp nz,0x04a3 taken -- already one instruction
    return m.call(0x04a3);
  }

  // bit6 clear (phase 0x01..0x3F): fall into loc_04a1, which overrides A = 0x10.
  m.step(0x04a1, 10); // jp nz NOT taken -- already one instruction
  return m.call(0x04a1);
}
