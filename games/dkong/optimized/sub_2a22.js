// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_2a22 — hand-optimized rewrite of the translated routine at ROM 0x2a22,
 * proven equal to its oracle by the equivalence harness.
 *
 * A one-block PARAMETER WRAPPER: it presets B/DE/IX and tail-shares the collision
 * search in entry_2913 (0x2913). entry_2913 is invoked through `m.call`, the routine
 * registry (games/dkong/routines.js), so it resolves to the oracle or to entry_2913's
 * own optimized rewrite — never a copy here. No RAM name is imported: the routine's
 * only address literal, 0x6600, is `SCRATCH_6600` in ram.js (a footprint placeholder),
 * and — matching loc_1087's convention for the same address — it is kept hex with a
 * comment rather than dressed in a placeholder name. See the naming candidate reported
 * with this rewrite.
 */

// entry_2913 searches B records of DE bytes each starting at IX. sub_2a22 is the
// wrapper that aims that search at the 6-record object table based at 0x6600.
const OBJ_TABLE_BASE = 0x6600; // ram.js SCRATCH_6600 -- base of the 6-record object table
const OBJ_TABLE_COUNT = 0x06; // B: 6 records to scan
const OBJ_TABLE_STRIDE = 0x0010; // DE: 16 bytes per record

/**
 * sub_2a22 -- run entry_2913's collision search over the 6-record object table at
 * 0x6600.  [ROM 0x2A22-0x2A2E]
 *
 *   2a22  06 06        ld   b,0x06        ; B  = record count (6)
 *   2a24  11 10 00     ld   de,0x0010     ; DE = record stride (16 bytes)
 *   2a27  dd 21 00 66  ld   ix,0x6600     ; IX = table base (SCRATCH_6600)
 *   2a2b  cd 13 29     call 0x2913        ; entry_2913 -> A = hit(1)/miss(0), sub_0008 skip
 *   2a2e  c9           ret                ; runs ONLY on entry_2913's A=0 (normal) exit
 *
 * WHAT IT DOES. This is a thin argument-loading wrapper around entry_2913, the
 * proximity/collision query (docs on that routine in optimized/entry_2913.js). The
 * caller (sub_29af, ROM 0x29AF -- the object-collision resolver) has already set the
 * search subject: IY = 0x6200 (Mario's record), C = Mario X (0x6205), and HL = the
 * box half-spans (H=0x04 Y, L=0x08 X). sub_2a22 supplies the *object list* to test
 * against: the 6-entry table at 0x6600 (stride 0x10), and calls entry_2913 to find
 * the first active record whose box contains Mario.
 *
 * The 0x6600 table is that game's spawnable object list: it is initialised as 6
 * records of stride 0x10 by the board setup (loc_1087), spawned into by sub_27da,
 * animated by sub_2797, gathered to sprite RAM (0x6958) by sub_11d3, and searched
 * here -- every one of them agreeing on `B=6, DE=0x10, base=0x6600`.
 *
 * THE RETURN CONTRACT IS entry_2913's sub_0008 SKIP CONVENTION, and honouring it is
 * the one non-trivial thing this wrapper does:
 *   - MISS (list exhausted, A=0): entry_2913 returns TRUE (normal) and control is
 *     back here at 0x2A2E, so sub_2a22 runs its OWN `ret` (0x2A2E) to return to its
 *     caller (0x29C0 in sub_29af).
 *   - HIT (A=1): entry_2913 discards this routine's return address (0x2A2E) via its
 *     double `inc sp` and has ALREADY returned to sub_2a22's caller (0x29C0). It
 *     signals this by returning FALSE, so sub_2a22 must NOT run its `ret` -- doing so
 *     would pop the caller's-caller frame and double-return. The `if (!m.call(...))
 *     return;` is exactly that guard.
 * Both arms leave A = hit/miss for sub_29af (which reads it at 0x29C1); sub_2a22's own
 * return value is inert (sub_29af ignores it), so nothing is returned, matching the
 * oracle's fall-off-the-end (undefined) on both paths.
 *
 * INPUTS  : the stack (sub_2a22's return address 0x29C0, and below it the frame
 *           entry_2913 skips to on a hit). Live subject state set by sub_29af:
 *           IY, C, H, L. RAM: the 6 records at 0x6600 (their +0 active bit and the
 *           +3/+5/+9/+a box fields entry_2913 reads).
 * OUTPUTS : registers B (record countdown -- WHICH record hit, sub_29af re-walks it),
 *           DE (stride), IX (restored to 0x6600 by entry_2913's pop), A (hit/miss),
 *           F, SP, PC. NO work RAM: entry_2913 is a read-only query and this wrapper
 *           writes none either.
 *
 * FLAGS -- nothing here reads a flag: the three `ld` are flag-neutral and entry_2913
 * sets A/F itself. The register file on return (A, B, DE, IX, F, SP) is entry_2913's,
 * reproduced by calling the same routine with the same inputs; the unit gate compares
 * the whole file.
 *
 * CYCLES -- the three setup `ld` form ONE basic block and are COLLAPSED to a single
 * m.step at the block's exit PC (0x2A2B): 7 + 10 + 14 = 31 t, the exact oracle sum.
 * The CALL is a boundary and is NOT folded across: `push16` (the pushed return
 * address 0x2A2E) + `m.step(0x2913, 17)` (the call's own 17 t) + `m.call(0x2913)`
 * stay verbatim, as does the trailing `m.ret()` (10 t, charged internally). No
 * hardware-latch write occurs here (nor in entry_2913, a read-only query), so no
 * bus-cycle boundary is pinned. Per-branch OWN totals (excluding the callee): A=0
 * (miss) = 31 + 17 + 10 = 58 t; A=1 (hit) = 31 + 17 = 48 t (its `ret` is not run).
 *
 * REACHABILITY / why the collapse is licensed by an EXPLICIT cycle-total test rather
 * than the convergent gate: sub_2a22 is NOT an untranslated frontier -- its dispatcher
 * is live (loc_1bb2 airborne -> entry_1c05 -> entry_2b1c -> sub_29af -> here). It is
 * BOARD-GATED: reachable only on loc_1087's board with Mario airborne over one of the
 * 0x6600 objects, a state the 25m attract/gameplay scenarios never visit (measured 0
 * dispatches / 1600 attract frames), so a whole-machine / convergent run cannot exercise
 * it (0 invocations -> vacuous) UNTIL a multi-board tape covers that board. It is therefore
 * proven for now from crafted entries, like sub_13ca, and because no whole-machine run covers
 * the total, equivalence-2a22.test.js pins each branch's cycle total against the oracle
 * DIRECTLY, with a dropped-charge twin as the teeth. The collapse only redistributes 31 t
 * across three trivial `ld`; its total is preserved exactly, so the main loop's spin
 * count (0x6019, the PRNG entropy) is unchanged.
 */
export function sub_2a22(m) {
  const { regs } = m;

  // Block: ld b,0x06 (7) + ld de,0x0010 (10) + ld ix,0x6600 (14) = 31 t, exit 0x2A2B.
  regs.b = OBJ_TABLE_COUNT;
  regs.de = OBJ_TABLE_STRIDE;
  regs.ix = OBJ_TABLE_BASE;
  m.step(0x2a2b, 31);

  // call 0x2913 -- pushes 0x2A2E, charges the CALL's 17 t, then runs entry_2913.
  m.push16(0x2a2e);
  m.step(0x2913, 17);
  if (!m.call(0x2913)) {
    // HIT (A=1): entry_2913 already discarded 0x2A2E and returned to OUR caller
    // (0x29C0). Running the ret below would double-return past the caller's frame.
    return;
  }

  // MISS (A=0): control is back at 0x2A2E -- run our own ret to the caller. (10 t)
  m.ret();
}
