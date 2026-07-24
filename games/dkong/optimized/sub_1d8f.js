// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_1d8f — hand-optimized rewrite of the translated routine at ROM 0x1D8F,
 * proven equal to its oracle by the equivalence harness.
 *
 * This is a one-line SOUND TRIGGER: it stores 3 into the first ls259.6h sound
 * counter (SND_TRIGGER[0] = 0x6080), which the per-NMI sound driver sub_00e0
 * (ROM 0x00E0) reads, decrements, and drives onto hardware latch 0x7D00 — so a
 * value of 3 holds that sound asserted for 3 frames. 0x6080 is already evidenced
 * as SND_TRIGGER in ram.js (the store-3 idiom is documented on it), so this
 * rewrite IMPORTS the name and proposes NO new naming candidate.
 */

import { SND_TRIGGER } from "./ram.js"; // 0x6080 — ls259.6h sound counter [0] (drives 0x7D00)

/** Game code asserts a sound by storing 3 into its counter — a 3-frame hold that
 *  sub_00e0 counts back down to 0 (documented on SND_TRIGGER in ram.js). */
const SOUND_ASSERT_FRAMES = 0x03;

/**
 * sub_1d8f -- request the SND_TRIGGER[0] sound for 3 frames.  [ROM 0x1D8F-0x1D94]
 *
 *   1d8f  3e 03        ld   a,0x03          ; A = 3-frame assert value
 *   1d91  32 80 60     ld   (0x6080),a      ; SND_TRIGGER[0] := 3
 *   1d94  c9           ret
 *
 * WHAT IT DOES. Latches a 3-frame request for the sound on ls259.6h bit 0
 * (work-RAM shadow 0x6080, hardware latch 0x7D00). Its two callers gate it and
 * pass the request through this single unconditional store:
 *   - 0x1CC7 (`call c`, in entry_1ac3's loc_1cc2) — the footstep/turn sound; and
 *   - 0x1D61 (`call z`).
 * The routine itself takes no decision — the callers' conditions do — so there is
 * exactly ONE straight-line path here.
 *
 * INPUTS  : none read (A is overwritten with the literal 3). The stack carries the
 *           `ret` address.
 * OUTPUTS : RAM SND_TRIGGER[0] (0x6080) := 3. Register A := 3 (live at the boundary,
 *           compared by the unit gate). F is UNTOUCHED (neither `ld` writes a flag),
 *           so the entry F survives to the exit F — observable, and reproduced by not
 *           touching regs.f. BC/DE/HL/IX/IY untouched. PC/SP move via `ret`.
 *
 * FLAGS -- nothing to keep or drop: `ld a,n` and `ld (nn),a` are both flag-neutral,
 *   and `ret` sets no flags, so the exit F is simply the entry F. The unit gate
 *   compares the whole register file incl. F, so leaving regs.f alone is required and
 *   sufficient — there is no flag-producing op to reproduce.
 *
 * CYCLES -- FULLY COLLAPSED. The two straight-line loads form one basic block and fold
 *   into a single m.step at the block's exit PC 0x1D94: 7 (ld a,0x03) + 13 (ld (nn),a)
 *   = 20 t, charged once immediately before the control transfer; then m.ret(10) —
 *   30 t total, exactly the oracle's 7+13+10. The store targets 0x6080, which is WORK
 *   RAM, NOT a tagged hardware latch (those are 0x7800-0f / 0x7C00 / 0x7C80 /
 *   0x7D00-07 / 0x7D80-87) — the oracle's write carries no busOffset — so no hardware
 *   bus cycle hides inside the block and folding across the store is safe. The hardware
 *   assert to 0x7D00 happens LATER, in sub_00e0. Total-preservation keeps the main-loop
 *   spin count 0x6019 (PRNG entropy) deterministic, so the strict whole-machine gate
 *   stays byte-exact.
 *
 * REACHABILITY / ATOMICITY (MEASURED, not assumed — the oracle's "not yet wired into
 *   the live dispatcher" note is STALE). sub_1d8f IS reached: probed at 0x1D8F over an
 *   all-oracle run, it dispatched 49 times in 1600 attract frames (first ~f640, once the
 *   attract demo starts PLAYING 25m and Mario walks) and 21 times in 1600 driven-gameplay
 *   frames (coin+start+held-right). It is ATOMIC on EVERY measured call path: every single
 *   dispatch occurs INSIDE the NMI with the NMI mask CLEARED (in-NMI 49/49 attract,
 *   21/21 driven; mask-set 0/0), and this routine is a pure LEAF (no m.call) so the mask
 *   stays clear through its whole body and the NMI cannot re-enter — correspondingly the
 *   NMI's pushed PC never lands in [0x1D8F,0x1D94) (0 of 1594 accepted NMIs). An atomic
 *   byte-exact collapse pushes no mistimed PC and tears no raster, so it passes the STRICT
 *   whole-machine gate directly and does NOT need the convergent gate. See
 *   equivalence-1d8f.test.js.
 */
export function sub_1d8f(m) {
  const { regs, mem } = m;

  // ld a,0x03 ; ld (0x6080),a -- request the SND_TRIGGER[0] sound for 3 frames.
  regs.a = SOUND_ASSERT_FRAMES;
  mem.write8(SND_TRIGGER, regs.a); // 0x6080 -- work RAM (no busOffset), not a hardware latch

  // One collapsed charge for the branch-free block: 7 + 13 = 20 t at the exit PC 0x1D94
  // (atomic -> byte-exact; no hardware-latch write pins an inner boundary), then the ret.
  m.step(0x1d94, 20);
  m.ret(10);
}
