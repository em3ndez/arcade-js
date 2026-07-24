// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1b45 — hand-optimized rewrite of the translated routine at ROM 0x1B45,
 * proven equal to its oracle by the equivalence harness (equivalence-1b45.test.js).
 *
 * One routine per file. Its one tail target (0x1d03 = entry_1d03, reached by the
 * `jp nz`) is invoked through `m.call`, the routine registry (games/dkong/routines.js),
 * so it resolves to the oracle or to entry_1d03's own optimized rewrite — never a
 * copied implementation here. Only RAM *names* are imported (from ram.js).
 */

import { P1_INPUT } from "./ram.js";

/**
 * loc_1b45 -- the LADDER "climb up" input test.  [ROM 0x1B45-0x1B4D]
 *
 *   1b45  3a 10 60     ld   a,(0x6010)   ; A = P1_INPUT (this frame's cooked control word)
 *   1b48  cb 57        bit  2,a          ; test bit 2 = Up held?  (Z := NOT Up)
 *   1b4a  c2 03 1d     jp   nz,0x1d03    ; Up held -> hand off to the climb-up stepper
 *   1b4d  c9           ret               ; Up not held -> stay put on the ladder
 *
 * WHAT IT DOES. This is the third and last test in the on-ladder input chain that
 * starts at loc_1b38. loc_1b38 has already established, before it tail-jumps here,
 * that (a) Down (bit 3) is NOT held — Down is handled earlier by its own jp — and
 * (b) MARIO_ON_LADDER (0x6215) is non-zero, i.e. Mario is currently on a ladder.
 * So the only question loc_1b45 answers is: with Mario on a ladder, is the player
 * holding UP?
 *
 *   - Up held  (P1_INPUT bit 2 set): tail-jump to entry_1d03 (0x1D03), the walk/
 *     climb animation stepper, which counts down the 4-frame climb timer (0x620F),
 *     moves Mario UP by 2px (0x6205 -= 2 via the shared body loc_1d11), and advances
 *     the climb animation. entry_1d03 is documented "ONE caller: 0x1B4A jp nz" — that
 *     caller is exactly this instruction.
 *   - Up not held (bit 2 clear): plain `ret` — Mario stands still on the ladder this
 *     frame.
 *
 * INPUTS  : RAM 0x6010 (P1_INPUT) bit 2 (Up). The stack (a caller return address to
 *           ret to; on the climb path, entry_1d03's own ret returns there).
 * OUTPUTS : on the climb path only — entry_1d03's effects (climb timer 0x620F,
 *           Mario Y 0x6205, sprite/anim bytes). Register file on every path:
 *           A := P1_INPUT (bit 2,a does not modify A), F := the `bit 2,a` result,
 *           and SP/PC. No boolean is returned; the caller (loc_1b38's chain, up to
 *           loc_197a) ignores it, so the tail jump's result is inert but `return`ed
 *           for hygiene (matches the oracle).
 *
 * FLAGS -- `bit 2,a` is KEPT VERBATIM. It is the routine's LAST flag-writer before
 * both exits (`jp`/`ret` touch no flags), so the F it leaves — Z from bit 2, plus the
 * BIT op's H=1/N=0 and its S/P/V and F3/F5 side-effects — must reach the register
 * file the unit gate compares byte for byte. It is also the flag this routine's own
 * `jp nz` branches on. So it cannot be simplified to `input & 0x04`; the Z80 BIT
 * semantics are load-bearing. A is likewise left = the input byte (BIT does not write
 * its operand), which the unit gate also checks. There is no dead register churn to
 * drop here — the routine's entire job is to read A and set F — so the readability
 * win is names, structure, and the docstring, not de-scaffolding.
 *
 * CYCLES -- KEPT PER-INSTRUCTION (NOT collapsed). loc_1b45 sits inside the
 * entry_1ac3 player-movement cascade, which is reached only from loc_197a — the
 * in-game update cascade the vblank NMI is documented to land inside mid-run
 * (docs/06 "Atomicity is the precondition"). A 0x1xxx cascade routine like this one
 * is therefore INTERRUPTIBLE, and docs/06 is explicit that a short run showing no NMI
 * landing in the 0x1xxx band is "not a licence to collapse them." Collapsing would
 * need the CONVERGENT gate to license it (as sub_0350 does), but loc_1b45 cannot be
 * reached by a whole-machine run in this harness: it dispatches only in real
 * gameplay with Mario on a ladder, and neither attract nor a driven coin+start input
 * tape advances the JS machine into that state (verified: game state 0x6005 stays 0,
 * no credit accrues; and no sibling 0x1a-0x1d cascade routine has been collapsed).
 * Rather than collapse an interruptible routine we cannot convergent-gate, the
 * charges stay one-per-instruction, so the per-frame cycle distribution is BYTE-
 * IDENTICAL to the oracle by construction — nothing to license. Equivalence is
 * proven by the unit gate from a crafted entry with full-branch + cycle-total teeth
 * (the sub_13ca precedent); the branch totals are the oracle's exactly (Up-not-held
 * 41 t = 13+8+10+10; the climb arm charges 31 t of prologue = 13+8+10 before
 * entry_1d03's tail).
 *
 * The climb path's `jp nz,0x1d03` is a TAIL jump with NO push16: entry_1d03's own
 * `ret` returns to loc_1b45's caller, not to here. entry_1d03 is reached via
 * `m.call(0x1d03)` so it resolves to the oracle or to its own optimized rewrite; it
 * is left to whatever the registry holds and is interruptible in its own right.
 */
export function loc_1b45(m) {
  const { regs, mem } = m;

  // Read this frame's cooked control word and test the Up bit (P1_INPUT bit 2).
  regs.a = mem.read8(P1_INPUT);
  m.step(0x1b48, 13); // ld a,(P1_INPUT)
  regs.bit(2, regs.a); // Z := NOT(Up); this is the routine's exit-flags writer
  m.step(0x1b4a, 8); // bit 2,a

  if (regs.fNZ) {
    // Up held on the ladder -> hand off to the climb-up stepper (Y -= 2, anim step).
    m.step(0x1d03, 10); // jp nz,0x1d03 taken (tail jump: no push16; its ret returns to OUR caller)
    return m.call(0x1d03);
  }

  // Up not held -> stand still on the ladder; return up the entry_1ac3 chain.
  m.step(0x1b4d, 10); // jp nz not taken
  m.ret(10); // ret
}
