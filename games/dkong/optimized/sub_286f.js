// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_286f — hand-optimized rewrite of the translated routine at ROM 0x286f,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its one callee (0x0028 = sub_0028, the rst-0x28 jump-table
 * dispatcher) is invoked through `m.call`, the routine registry
 * (games/dkong/routines.js), so it resolves to the oracle or to sub_0028's own
 * optimized rewrite — never a copied implementation here. Only the RAM *name*
 * BOARD (0x6227) is imported from ram.js.
 */

import { BOARD } from "./ram.js";

/**
 * sub_286f -- the per-BOARD collision-handler DISPATCH.  [ROM 0x286f-0x2873, then
 * rst 0x28 into sub_0028 @ 0x0028]
 *
 *   286f  3a 27 62     ld   a,(0x6227)   ; A = BOARD (the dispatch index)
 *   2872  e5           push hl           ; save HL for the target's `pop hl`
 *   2873  ef           rst  0x28         ; push 0x2874 (the inline table base), jp 0x0028
 *
 * WHAT IT DOES. The 0x6227 (BOARD) collision-dispatch. It reads BOARD as a table
 * index, saves the caller's HL, and executes `rst 0x28`. `rst 0x28` is a one-byte
 * CALL to 0x0028 that pushes its own return address — which is 0x2874, the byte
 * right after the `rst`, where an INLINE two-byte-per-entry jump table lives. The
 * dispatcher sub_0028 pops that table base, forms &table[A*2], loads the target
 * address, and `jp (hl)` into the per-board collision handler (in attract BOARD=1,
 * so table[1]=0x2880 -> sub_2880).
 *
 * THE STACK CHOREOGRAPHY (why there is no `ret` here). The pushed 0x2874 is NOT a
 * return address to come back to — it is data the dispatcher consumes. The target
 * opens with `pop hl` (recovering the HL saved above) and later does its own `ret`,
 * which pops the ORIGINAL caller's return address. So control returns to
 * sub_286f's CALLER, skipping past sub_286f entirely; sub_286f never executes a
 * `ret` of its own. In JS terms `m.call(0x0028)` runs the whole dispatched subtree
 * and unwinds, and this function then simply falls off its end.
 *
 * INPUTS  : RAM 0x6227 (BOARD) -- the dispatch index; HL -- the caller's collision
 *           pointer, consumed by the target's `pop hl`; the stack -- a caller
 *           return address the target's `ret` lands on.
 * OUTPUTS : A := BOARD; two stack pushes (HL, then the table base 0x2874); PC ->
 *           0x0028; then sub_0028's dispatch-subtree effects. Register file A, HL,
 *           F, SP, PC. NO boolean is returned: both callers (sub_2808 @0x2816 and
 *           loc_281d @0x283e) read register A next (`and a`) and IGNORE the JS
 *           return, exactly as the oracle drops it -- so this returns `undefined`
 *           (no `return m.call(...)`), matching the oracle's contract rather than
 *           the tail-jump routines that propagate their callee's answer.
 *
 * The read target 0x6227 is the well-evidenced BOARD (ram.js: the current
 * stage 1..4; poking it advances the board, and per-board setup dispatches on it).
 * No new naming candidate.
 *
 * FLAGS -- nothing to preserve or drop: `ld a,(nn)`, `push hl` and `rst` set NO
 * flags, so F is carried through verbatim (untouched). A is overwritten with BOARD;
 * every other register but SP/PC is untouched -- so the whole register file (incl.
 * F and the F3/F5 bits) matches the oracle on entry to sub_0028.
 *
 * CYCLES -- COLLAPSED to ONE m.step for the whole straight-line block (there are no
 * branches in sub_286f itself; the index only steers sub_0028's subtree). The three
 * instruction charges 13 + 11 + 11 = 35 t fold into a single charge at the block-
 * exit PC 0x0028 (the rst target), exactly the oracle's total. total-preservation
 * keeps the main loop's spin count (0x6019, the PRNG entropy) deterministic.
 *
 * The only stores are the two stack pushes (WORK RAM near the 0x6BFF stack top) --
 * NOT a tagged hardware latch (0x7800-0f / 0x7c00 / 0x7c80 / 0x7d00-07 / 0x7d80-87).
 * So no hardware bus cycle is hidden inside the block and the full collapse across
 * the pushes is safe; there is no write-trace test to add.
 *
 * sub_286f is NOT atomic: it is dispatched from the interruptible per-frame update
 * cascade loc_197a (via game-state-3 gameplay -> sub_2808 -> here), ~816x in a
 * 1400-frame attract run, so the vblank NMI can land inside its 35 t window. The
 * collapse is therefore LICENSED by the CONVERGENT gate (docs/decompiler-pipeline;
 * equivalence-286f.test.js uses convergentGate with SCENARIOS.attract, not the
 * strict whole-machine gate): a mistimed NMI pushes the coarse block-exit PC into
 * the DEAD stack (excluded) and can leave a single-frame raster tear that heals next
 * frame; non-stack RAM stays byte-identical and nothing persistent survives.
 *
 * sub_0028 is reached via `m.call(0x0028)` so it resolves to the oracle or its own
 * optimized rewrite; it is left per-instruction (it is interruptible too and uses
 * `tick()`). The `site` label is forwarded verbatim -- sub_0028 passes it to
 * dispatchGameState purely for debug provenance.
 */
export function sub_286f(m) {
  const { regs, mem } = m;

  // ld a,(BOARD) -- the dispatch index for the rst-0x28 table at 0x2874.
  regs.a = mem.read8(BOARD);

  // push hl -- saved for the dispatched target's `pop hl` (balances the stack).
  m.push16(regs.hl);

  // rst 0x28 pushes ITS return address = 0x2874, the inline jump-table base that
  // sub_0028 pops and indexes; then jumps to 0x0028.
  m.push16(0x2874);

  // One collapsed charge for the whole block incl. the rst: 13 + 11 + 11 = 35 t,
  // exit PC 0x0028.
  m.step(0x0028, 35);

  // rst-0x28 dispatch: sub_0028 reads table[A] and `jp (hl)` to the per-board
  // handler. The target's own `ret` returns to OUR caller, so nothing comes back
  // here -- the JS return is `undefined`, which both callers ignore (they read A).
  m.call(0x0028, "0x2874 (0x6227 collision dispatch)");
}
