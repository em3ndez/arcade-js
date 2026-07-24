// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0038 — hand-optimized rewrite of the translated routine at ROM 0x0038,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its single successor, sub_003d (0x003D), is reached through
 * `m.call(0x003d)` — the routine registry (games/dkong/routines.js) — so it resolves
 * to the oracle or to sub_003d's own optimized rewrite, never a copy. loc_0038 reads
 * and writes NO fixed game address (it only loads two registers with immediates), so
 * nothing is imported from ram.js.
 */

/**
 * loc_0038 -- the `rst 0x38` entry: fix the stride/count, then FALL THROUGH.
 * [ROM 0x0038-0x003C, then falls through into sub_003d @ 0x003D]
 *
 *   0038  11 04 00   ld   de,0x0004   ; stride = 4
 *   003b  06 0a      ld   b,0x0a      ; count  = 10
 *   003d  ...        (falls through into sub_003d, no CALL, nothing pushed)
 *
 * WHAT IT DOES. This is the fixed-parameter doorway to sub_003d, the shared
 * "add C to a strided run of B bytes from HL" primitive. A `rst 0x38` (opcode 0xFF,
 * an 11 T call to 0x0038) lands here; loc_0038 hard-wires the two loop parameters the
 * rst form always uses -- stride DE = 4 and count B = 0x0A -- and then FALLS THROUGH
 * into sub_003d, which does the actual add-loop over the ten stride-4 bytes at HL.
 * The caller supplies HL (the base) and C (the addend); the rst form is used to lay
 * out the ten stride-4 fields of the 0x6908 sprite-object block during board and
 * opening-cutscene setup (observed live from frame ~160, HL = 0x6908, C in
 * {0x30, 0x80, 0xFC, ...}). The direct entry at 0x003D lets a caller choose DE/B
 * itself; that path does not pass through here.
 *
 * THE FALL-THROUGH IS NOT A CALL. 0x003B runs straight into 0x003D with nothing
 * pushed, so sub_003d's single `ret` at 0x0043 pops the address the `rst 0x38`
 * pushed at the original call site -- it returns to loc_0038's caller, not to
 * loc_0038. That is why `m.call(0x003d)` here has NO matching `m.push16`: modelling
 * a push (as if this were `call 0x003d`) would leave an extra word on the stack and
 * unbalance SP, which the unit gate (it compares SP) would catch. Keep it a bare
 * fall-through, exactly as the oracle does.
 *
 * INPUTS  (read):  none directly. HL and C are the caller's, read by sub_003d.
 * OUTPUTS (written): DE = 0x0004, B = 0x0A (the parameters sub_003d then consumes);
 *                  no memory, no flags. Everything the RAM sees -- the ten bytes
 *                  += C, HL advanced by 10*4, A, B := 0, and F (the final add-hl
 *                  carry) -- is produced by sub_003d, reached via m.call.
 *
 * FLAGS. `ld de,nn` and `ld b,n` touch NO flags, so loc_0038 leaves F exactly as it
 * found it, and the routine's only flag output is sub_003d's final `add hl,de`
 * carry, produced by the oracle (or optimized) sub_003d through m.call. Nothing is
 * dropped: both DE and B are load-bearing (sub_003d reads DE as the stride and B as
 * the djnz count), so there is no dead register churn to remove here -- the win is
 * the name, the plain-English contract, and the fall-through documented explicitly.
 *
 * ATOMICITY / CYCLES -- COLLAPSED to one m.step (17 T = 10+7) at the fall-through exit.
 *   loc_0038 is the `rst 0x38` vector -- the same rst family as sub_0008/sub_0010/
 *   sub_0018 -- reached from 40+ sites (board setup, cutscene object staging, per-frame
 *   object updates), so it is NOT provably atomic on every call path: a vblank NMI could
 *   in principle land between the two instructions on an unexercised or mask-enabled
 *   trajectory. Per the collapse-sweep recipe this is exactly the case the CONVERGENT
 *   gate exists to license (the same reasoning as sub_0350): the collapse's only
 *   observable effect on an interrupted path is the coarse PC pushed into the dead stack
 *   or a healing single-frame pixel tear -- never a persistent divergence, because the
 *   two folded instructions (`ld de,nn` / `ld b,n`) write no memory and touch no flags,
 *   so nothing but PC/SP-position is at stake at the fold boundary. Proven by the
 *   CONVERGENT gate below over a long driven gameplay run (coin+start+play, far past this
 *   routine's 40+ dispatch sites, well beyond the ~220 dispatches a short run sees). No
 *   hardware (0x7Dxx) write happens here -- only register loads -- so there is no
 *   write-bus-cycle position at stake either way.
 *
 * loc_0038 has NO data-dependent branch: it unconditionally sets DE and B and falls
 * through, whatever the caller passes. The single path is proven by the EQUAL/unit
 * gate and exercised 7x (>=1 required) by the driven whole-machine run, so branch
 * coverage is complete with no synthesised arms.
 */
export function loc_0038(m) {
  const { regs } = m;

  // ld de,0x0004 (stride) + ld b,0x0a (count) -- both pure register loads, no
  // memory/flag effects, folded into one exit charge.
  regs.de = 0x0004;
  regs.b = 0x0a;
  m.step(0x003d, 17); // 10 + 7

  // FALL-THROUGH into sub_003d (0x003D): NOT a call, so no m.push16 -- sub_003d's
  // `ret` pops whatever the `rst 0x38` pushed at the caller's site (see header).
  m.call(0x003d);
}
