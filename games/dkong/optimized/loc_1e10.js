// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e10 — hand-optimized rewrite of the translated routine at ROM 0x1E10,
 * proven equal to its oracle by the equivalence harness (CRAFTED-ENTRY gate;
 * see optimized/test/equivalence-1e10.test.js).
 *
 * One of three sibling "setter" arms of the BOARD-COMPLETION / how-high cutscene
 * dispatch family (loc_1e00 / loc_1e08 / loc_1e10). Each arm loads one fixed
 * (B, DE) parameter pair and hands control to the shared continuation loc_1e15,
 * which consumes the pair. loc_1e10 imports nothing from ram.js: it reads no RAM,
 * writes no RAM, and touches no stack of its own — its whole footprint is two
 * register writes and a fall-through.
 */

/**
 * loc_1e10 -- board-completion setter arm B=0x7F / DE=0x0008.  [ROM 0x1E10-0x1E14,
 * then FALLS THROUGH into loc_1e15 @0x1E15 — the code is contiguous, there is NO jp]
 *
 *   1e10  06 7f        ld   b,0x7f       ; this arm's board-completion record byte
 *   1e12  11 08 00     ld   de,0x0008    ; this arm's task id (D=0x00, E=0x08)
 *   ; ---- 0x1E15 is the next ROM byte: execution FALLS INTO loc_1e15 ----
 *
 * WHAT IT DOES. A pure parameter setter. It selects this arm's (B, DE) and lets
 * execution fall straight into the shared continuation loc_1e15 (`return
 * m.call(0x1e15)` models the fall-through — resolved through the routine registry,
 * so 0x1E15 runs its oracle or its own optimized rewrite, and that continuation's
 * `ret` returns to loc_1e10's caller). Downstream, loc_1e15 spends the pair:
 *   - DE is passed to sub_309f (0x309F "enqueue a task": D -> ring slot, E -> slot+1);
 *   - B is carried to loc_1e36 (0x1E36), which writes it as byte 1 of the 4-byte
 *     0x6A30 record {A, B, 0x07, C}. Verified end-to-end: after the real chain runs
 *     from a crafted entry, 0x6A31 == 0x7F (the test's real-downstream EQUAL arm).
 * The three siblings differ ONLY in this pair, so they choose between three
 * board-completion sequences:
 *     loc_1e00: B=0x7D, DE=0x0003
 *     loc_1e08: B=0x7E, DE=0x0005
 *     loc_1e10: B=0x7F, DE=0x0008   <- this one
 *
 * WHEN IT RUNS. Reached only during an actual board completion, through the
 * INTERRUPTIBLE per-frame dispatch cascade (loc_127c / the loc_197a update family
 * -> sub_1dbd router -> loc_1dc9). loc_1dc9 tail-jumps here on TWO paths:
 *   - unconditionally @0x1DF2 when 0x6229 (the level/round counter) is neither 1
 *     (-> loc_1e00) nor 2 (-> loc_1e08); and
 *   - via loc_1df5 when 0x6018 bit1 is set on the 0x6342-bit2 branch.
 *
 * INPUTS  : none (reads no RAM, no registers, no flags).
 * OUTPUTS : registers B := 0x7F and DE := 0x0008; pc transfers to 0x1E15; then
 *           loc_1e15's own effects. loc_1e10 writes no RAM, no stack, and no flags
 *           (`ld r,n` / `ld rr,nn` set none), so F and SP pass through unchanged —
 *           they match the oracle by construction.
 *
 * FLAGS -- nothing to drop: neither load writes a flag, so exit F == entry F.
 *
 * NAMES -- 0x7F and 0x0008 stay hex: opaque sequence-selector magic for the
 * board-completion cutscene (a record/sprite code and a task id), evidenced only
 * by where they land downstream, not by any control poke — so no ram.js name is
 * proposed.
 *
 * CYCLES -- KEPT PER-INSTRUCTION (7 t + 10 t = 17 t before the fall-through), i.e.
 * the oracle's exact charge distribution is preserved, NOT collapsed. Two reasons,
 * either sufficient: (1) loc_1e10 is INTERRUPTIBLE — it runs inside the loc_197a
 * per-frame update cascade, the demonstrated NMI-lands-mid-routine surface, so a
 * collapse would risk pushing a coarse block-exit PC; and (2) it is measured
 * UNREACHABLE in every available whole-machine scenario (0 dispatches over attract
 * 1200/4000 frames and the gameplay tape — it only fires on a real board
 * completion), so a collapse could not be convergent-verified regardless. Per
 * docs/06 that pairing is kept per-instruction; a 2-instruction setter gains
 * nothing from a collapse anyway. The crafted-entry test pins the exact 17 t total
 * with teeth (a dropped charge is caught).
 */
export function loc_1e10(m) {
  const { regs } = m;

  regs.b = 0x7f; // board-completion record byte for this arm (-> loc_1e36's 0x6A31)
  m.step(0x1e12, 7); // ld b,0x7f

  regs.de = 0x0008; // task id for this arm (D=0x00, E=0x08 -> sub_309f enqueue)
  m.step(0x1e15, 10); // ld de,0x0008 -- NEXT pc is 0x1E15: FALL-THROUGH into loc_1e15

  // Fall-through (NOT a jp): 0x1E15 is the next ROM byte. Modeled as a tail call
  // through the registry so loc_1e15 resolves to its oracle or optimized rewrite;
  // its ret returns to loc_1e10's caller.
  return m.call(0x1e15);
}
