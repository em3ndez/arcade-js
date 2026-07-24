// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_06fe — hand-optimized rewrite of the translated routine at ROM 0x06FE,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its one callee (sub_0028 at 0x0028) is reached through
 * `m.call`, the routine registry (games/dkong/routines.js), so it resolves to the
 * oracle or to a future optimized rewrite. Only the RAM name GAME_SUBSTATE is
 * imported (from ram.js).
 */

import { GAME_SUBSTATE } from "./ram.js";

// The dispatch-site label handed to sub_0028; it only ever surfaces in a
// NotImplemented error, naming which inline jump table a null/out-of-range
// selector fell off of. Kept identical to the oracle's DISPATCH_TABLE_0702.
const DISPATCH_TABLE_0702 = "0x0702 (0x600A game sub-state)";

/**
 * loc_06fe -- the in-game (GAME_STATE==3) SUB-STATE dispatcher.
 * [ROM 0x06FE-0x0701]
 *
 *   06fe  3a 0a 60   ld  a,(0x600a)   ; A = GAME_SUBSTATE (0x600A)
 *   0701  ef         rst 0x28         ; -> inline table 0x0702-0x073B, 29 entries;
 *                                     ;    sub_0028 does jp (hl) to table[A]
 *
 * WHAT IT DOES. Reached from dispatchGameState (the NMI's rst 0x28 table at
 * 0x00CA, entry 3) once per frame while a credited game is running. It loads the
 * in-game sub-state index GAME_SUBSTATE (0x600A) and vectors through the 29-entry
 * inline jump table at 0x0702 via the shared trampoline sub_0028: 7=opening Kong-
 * climb cutscene, 8=how-high interlude, 10=board setup, 13=gameplay, 14=P1 death,
 * 0x16=board-cleared/advance, etc. Six table slots (idx 9, 24-28) are 0x0000 and A
 * is NOT range-checked, so a null/out-of-range selector vectors to 0x0000 / off the
 * table; the ROM has no guard, and dispatchGameState surfaces such a target as a
 * loud NotImplemented throw rather than a silent reset.
 *
 * INPUTS.  RAM: GAME_SUBSTATE (0x600A), read into A. ROM: the jump table at 0x0702
 *   (read by sub_0028, not here). Registers on entry: none consumed.
 * OUTPUTS. Pushes the table base 0x0702 onto the stack (rst 0x28's own return
 *   address, which sub_0028 pops to find the table) -- a write into diffed stack
 *   RAM. A = GAME_SUBSTATE. Then whatever the dispatched sub-state handler writes.
 *   The flags/registers on exit are entirely sub_0028's / the handler's; loc_06fe
 *   sets none of its own that anything reads.
 *
 * NO INTERNAL BRANCH. loc_06fe is straight-line: read -> push -> call. It does not
 * branch on A; the data-dependent behaviour lives entirely in the callee (the
 * table lookup + jp (hl)). So there is one path through this routine, exercised
 * for every 0x600A value; the "branches" a reviewer thinks of are the dispatched
 * handlers, one m.call level down.
 *
 * CYCLE DECISION -- COLLAPSED to a single m.step(0x0028, 24) (13 + 11). It runs
 * inside the NMI with the mask cleared for the attract-state handlers in this
 * batch, but loc_06fe is the IN-GAME (state-3) dispatcher: m.call(0x0028) routes to
 * the longest per-frame work in the game (gameplay at idx 13), so a frame boundary
 * is plausibly crossed mid-routine. The fleet-wide rule is that atomicity is a
 * property of the SCENARIO exercised, not the routine, so rather than treat that
 * plausibility as a reason to withhold the collapse, the whole-machine test uses
 * the CONVERGENT license unconditionally (see equivalence-06fe.test.js) -- the
 * SAME single-step collapse this routine's own note already recorded as staying
 * EQUAL over 1500 whole-machine frames, now gated the way every collapsed
 * interruptible routine in this fleet is, rather than kept per-instruction on a
 * "didn't happen to fail yet" basis. The `rst 0x28` PUSH (0x0702 into diffed stack
 * RAM 0x6Bxx) still happens between the two folded charges' memory-op ORDER (ld
 * a,(0x600a) -> push16 -> the rst entry), only the m.step granularity changes.
 *
 * FLAGS. loc_06fe computes no flags of its own (neither `ld a,(nn)` nor `rst`
 * touches F); F on exit is whatever sub_0028 / the handler leaves. The prologue is
 * kept verbatim so A, F, SP and PC all match the oracle exactly -- the unit gate
 * compares the whole register file.
 */
export function loc_06fe(m) {
  const { regs, mem } = m;

  // ld a,(GAME_SUBSTATE)[13]+rst 0x28[11] -- the in-game sub-state selector, then
  // push the table base 0x0702 (the rst's own return address, which sub_0028 pops
  // to locate the table) and enter the inline-jump-table trampoline. sub_0028 reads
  // table[A*2] from ROM and jp (hl)'s to the sub-state handler.  24 t
  regs.a = mem.read8(GAME_SUBSTATE);
  m.push16(0x0702);
  m.step(0x0028, 24);
  m.call(0x0028, DISPATCH_TABLE_0702);
}
