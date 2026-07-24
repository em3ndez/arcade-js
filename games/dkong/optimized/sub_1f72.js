// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_1f72 — hand-optimized rewrite of the translated routine at ROM 0x1F72,
 * proven equal to its oracle by the equivalence harness.
 *
 * It is the SETUP WRAPPER at the head of the object-slot scan: it gates on the
 * board phase (0x6227 == 1), and on that phase presets the four scan registers and
 * falls through into loc_1f83 (0x1F83), the per-slot check. loc_1f83 (and the rest of
 * the scan loop: loc_1f8d, loc_1f93, the exx branches, loc_21ba) is reached through
 * `m.call(0x1f83)`, the routine registry — so it resolves to the oracle or to its own
 * optimized rewrite (being optimized in parallel), never a copy here.
 *
 * The one address literal it reads, 0x6227, is BOARD in ram.js (a confirmed name);
 * the two table bases it loads, 0x6700 and 0x6980, are SCRATCH_6700 / SCRATCH_6980
 * (footprint placeholders) — kept hex here with a comment, with naming candidates
 * (OBJ_TABLE / OBJ_SPRITE_BUF) reported alongside this rewrite.
 */

const BOARD = 0x6227;          // ram.js BOARD -- the scan runs ONLY on board phase 1
const OBJ_TABLE_BASE = 0x6700; // IX: base of the 10-record object table (SCRATCH_6700, stride 0x20)
const OBJ_SPRITE_BUF = 0x6980; // HL: base of the parallel 4-byte-per-slot sprite buffer (SCRATCH_6980)
const SLOT_STRIDE = 0x0020;    // DE: bytes per object record (add ix,de advances one slot)
const SLOT_COUNT = 0x0a;       // B: 10 object slots to scan

/**
 * sub_1f72 -- gate on board phase 1, then preset the object-scan cursor and fall
 * through into the per-slot check loc_1f83.  [ROM 0x1F72-0x1F83]
 *
 *   1f72  3a 27 62     ld   a,(0x6227)   ; A = BOARD phase
 *   1f75  3d           dec  a            ; == 1 ?  (Z set iff phase 1)
 *   1f76  c0           ret  nz           ; NOT phase 1 -> return, scan nothing
 *   1f77  dd 21 00 67  ld   ix,0x6700    ; IX = object-record table base
 *   1f7b  21 80 69     ld   hl,0x6980    ; HL = parallel sprite-buffer cursor
 *   1f7e  11 20 00     ld   de,0x0020    ; DE = record stride (32)
 *   1f81  06 0a        ld   b,0x0a       ; B  = 10 slots
 *   1f83  ...          (falls through into loc_1f83, the per-slot check)
 *
 * WHAT IT DOES. This is the loop PROLOGUE for the object-slot scan documented on
 * loc_1f83 / loc_1f8d / loc_1f93. sub_1f72 runs the scan only during board phase 1
 * (0x6227 == 1); on any other phase the `ret nz` bails immediately and no object is
 * touched. On phase 1 it loads the loop's register-state contract -- IX = the 10-record
 * object table at 0x6700 (stride DE = 0x20), HL = the parallel 4-byte-per-slot sprite
 * buffer at 0x6980, B = 10 -- and falls straight through into loc_1f83, which checks the
 * first record's active byte and either dispatches (loc_1f93) or advances (loc_1f8d).
 *
 * THE TAIL IS A FALL-THROUGH, NOT A CALL. loc_1f83 sits at the very next byte (0x1F83)
 * after `ld b,0x0a`; the oracle models the fall-through as `return m.call(0x1f83)`, with
 * NO stack push and NO extra cycle charge (it is not a Z80 `call`). This rewrite keeps
 * that exactly: the registry dispatches loc_1f83 (oracle or optimized), sub_1f72 adds
 * nothing to the stack, and its own return value is loc_1f83's (inert to sub_1f72's
 * caller). The full loop's RET back to sub_1f72's caller happens inside loc_1f8d.
 *
 * INPUTS  : RAM 0x6227 (BOARD phase). The stack carries sub_1f72's return address, which
 *           the `ret nz` arm consumes. No live-in registers -- IX/HL/DE/B are all set here.
 * OUTPUTS : NOT-phase-1 arm: returns to the caller (A = phase-1, F from `dec a`, SP popped
 *           one frame); nothing written. Phase-1 arm: IX/HL/DE/B preset as above, A = 0
 *           and F = `dec a`'s result (Z set) at the loc_1f83 boundary, then whatever the
 *           whole scan subtree leaves. sub_1f72 itself writes no work RAM.
 *
 * FLAGS -- `dec a` is KEPT verbatim (regs.dec8): its Z flag IS the `ret nz` branch
 * condition, so it is not droppable churn. On the phase-1 arm those flags reach the
 * loc_1f83 boundary unchanged (the four `ld` are flag-neutral); loc_1f83's own `ld a,
 * (ix+0)` / `dec a` overwrite A/F immediately, but reproducing the oracle's boundary F
 * exactly (via regs.dec8) keeps the register file identical regardless.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block, totals preserved exactly. The
 * routine writes NO hardware latch (its only memory touch is a READ of 0x6227), so no
 * bus-cycle boundary pins an intermediate m.step, and the fold is licensed purely by
 * total-preservation.
 *   - Pre-branch block (both arms): ld a(13) + dec a(4) = 17 t, charged at the branch
 *     instruction 0x1F76 immediately before the `ret nz` test.
 *   - NOT-phase-1 arm: + `ret nz` taken 11 t (m.ret) = 28 t own total.
 *   - Phase-1 arm: `ret nz` not-taken 5 + ld ix 14 + ld hl 10 + ld de 10 + ld b 7 = 46 t
 *     folded into one m.step at 0x1F83 (the ret-nz not-taken is a fall-through, so it
 *     folds with the following straight-line loads) -> 17 + 46 = 63 t own total, then the
 *     fall-through m.call(0x1f83) (0 t of its own). Both totals equal the oracle's, so the
 *     per-frame cycle budget -- hence the main-loop spin count 0x6019 (PRNG entropy) -- is
 *     unchanged.
 *
 * GATE -- STRICT whole-machine, byte-exact (see equivalence-1f72.test.js). MEASURED, not
 * assumed (the oracle's "not yet wired" docstring is STALE): the loc_197a NMI cascade now
 * dispatches sub_1f72 -- 816 dispatches over 1400 attract frames (first ~frame 586, once
 * the demo starts PLAYING 25m), so the strict gate is non-vacuous. It is ATOMIC: all
 * 816/816 dispatches occur INSIDE the NMI (io.nmiMask == 0; outside-NMI 0), where
 * entry_0066 has cleared the NMI mask so the interrupt cannot re-enter -- and the NMI's
 * pushed PC never lands in [0x1F72,0x1F83] (0 landings; 0 anywhere in the 0x1900-0x2FFF
 * band; all 1394 landings fall in the 0x02BD-0x0372 main-loop band). An atomic,
 * total-preserving collapse pushes no mistimed PC and tears no raster, so it passes the
 * byte-exact strict gate directly and needs no convergent gate.
 *
 * BRANCH COVERAGE. Attract exercises ONLY the phase-1 arm (board is 1 at all 816
 * dispatches -- the 25m demo never leaves phase 1), which the strict whole-machine gate
 * and the natural unit entry both cover. The NOT-phase-1 (`ret nz`) arm is never reached
 * naturally, so it is proven from a crafted identical-both-sides entry (0x6227 != 1) with
 * its cycle TOTAL pinned and a dropped-charge twin as the teeth.
 */
export function sub_1f72(m) {
  const { regs, mem } = m;

  // 1f72 ld a,(BOARD) ; 1f75 dec a  -- Z set iff board phase 1. dec8 kept: its Z flag
  // is the `ret nz` condition. (13 + 4 = 17 t, charged at the branch site 0x1F76.)
  regs.a = regs.dec8(mem.read8(BOARD));
  m.step(0x1f76, 17);

  // 1f76 ret nz -- not phase 1: scan nothing, return to the caller (11 t).
  if (regs.fNZ) {
    m.ret(11);
    return;
  }

  // Phase 1: preset the scan cursor (IX object table / HL sprite buffer / DE stride /
  // B slot count) and fall through into loc_1f83. The ret-nz not-taken (5 t) folds with
  // the four loads -> 46 t, charged at the fall-through target 0x1F83.
  regs.ix = OBJ_TABLE_BASE;
  regs.hl = OBJ_SPRITE_BUF;
  regs.de = SLOT_STRIDE;
  regs.b = SLOT_COUNT;
  m.step(0x1f83, 46);

  // Fall-through into loc_1f83 -- NOT a call: no stack push, no added cycle. The registry
  // resolves loc_1f83 (oracle or optimized); its return value is sub_1f72's (inert).
  return m.call(0x1f83);
}
