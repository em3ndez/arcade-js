// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1cc2 — hand-optimized rewrite of the translated routine at ROM 0x1CC2,
 * proven equal to its oracle by the equivalence harness.
 *
 * It imports the two work-RAM names it writes (both confirmed in ram.js):
 * MARIO_SPRITE_CODE (0x6207) and MARIO_MOVE_STEP_TIMER (0x620F).
 */

import { MARIO_SPRITE_CODE, MARIO_MOVE_STEP_TIMER } from "./ram.js";

/**
 * loc_1cc2 -- SHARED WALK TAIL: store the sprite code, ring the footstep, reload
 * the sub-step timer, hand off to the sprite copy.  [ROM 0x1CC2-0x1CD1]
 *
 *   1cc2  21 07 62     ld   hl,0x6207     ; HL -> MARIO_SPRITE_CODE
 *   1cc5  77           ld   (hl),a        ; store the sprite-code byte the walk arm built
 *   1cc6  1f           rra                ; A bit0 -> carry (the walk-phase / footstep tick)
 *   1cc7  dc 8f 1d     call c,0x1d8f      ; carry set -> footstep sound (sub_1d8f: 0x6080=3)
 *   1cca  3e 02        ld   a,0x02        ; reload value for the sub-step timer
 *   1ccc  32 0f 62     ld   (0x620f),a    ; MARIO_MOVE_STEP_TIMER = 2 (2 more 1px frames)
 *   1ccf  c3 a6 1d     jp   0x1da6        ; -> entry_1da6 (player sprite-record copy)
 *
 * WHAT IT DOES. Both walk-step handlers (loc_1c8f rightward, loc_1cab leftward)
 * tail-jump here on their "begin a NEW step" arm with A = the sprite-code byte they
 * just built ((walk-anim & 3), plus bit7 facing-right from loc_1c8f). loc_1cc2:
 *   1. Writes A to MARIO_SPRITE_CODE (0x6207) -- the byte entry_1da6 will copy into
 *      Mario's hardware sprite record.
 *   2. `rra` shifts A's bit0 into carry. That bit is the low walk-anim bit, toggling
 *      each new step; `call c,0x1d8f` rings the footstep SND_TRIGGER (0x6080=3) only
 *      on the odd phase, so the footstep clicks every other step, not every step.
 *   3. Reloads MARIO_MOVE_STEP_TIMER (0x620F) = 2, arming the next two 1px shift
 *      frames before the walk animation advances again.
 *   4. Tail-jumps to entry_1da6, whose `ret` returns to loc_1c8f/loc_1cab's caller.
 * The tail `jp 0x1da6` is a TAIL transfer (no push): entry_1da6 runs and ITS `ret`
 * returns to the walk handler's caller -- hence `return m.call(0x1da6)`.
 *
 * INPUTS  : A (the sprite-code byte from the walk arm). The stack (a caller return
 *           address for the tail callee's `ret`).
 * OUTPUTS : RAM 0x6207 := A, 0x620F := 2; on the odd walk phase also 0x6080 := 3
 *           (written INSIDE the preserved callee sub_1d8f, not here). HL := 0x6207,
 *           A := 0x02, F from `rra` (C=old bit0, H=0, N=0). Then entry_1da6's full
 *           effect (0x694C-0x694F sprite record) and PC/SP via the tail call.
 *           loc_1cc2's OWN work-RAM writes are 0x6207 and 0x620F -- NO hardware latch.
 *
 * FLAGS -- `rra` is KEPT verbatim and is the ONLY flag-writer. Its carry is BOTH the
 *   `call c` branch condition AND the last flag left before the tail (nothing after it
 *   writes flags; entry_1da6 on the far side of the tail sets its own), so keeping it
 *   makes loc_1cc2's own F handoff (C/H/N and the untouched S/Z/PV) bit-identical to
 *   the oracle for free. The unit gate compares the whole register file incl. F/F3/F5.
 *   There is essentially no droppable churn -- the win is names, flat control flow,
 *   the docstring, and the cycle collapse.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block, EXACT per-arm totals (doc 06).
 * The `call c,0x1d8f` is a BOUNDARY (conditional CALL); its `push16`(0x1CCA) +
 * `m.step(0x1d8f,17)` + `m.call(0x1d8f)` stay verbatim and the fold does NOT cross it.
 * sub_1d8f's own 0x6080 write is work RAM (a sound latch counter, NOT a tagged hardware
 * latch) and lives inside that preserved callee, so no bus-cycle boundary is pinned
 * inside a fold. Blocks:
 *   - BB0 (0x1CC2-0x1CC6): ld hl(10) + ld (hl),a(7) + rra(4)                     = 21 t, PC 0x1CC7.
 *   - call c TAKEN:        the CALL's 17 t (with push16 0x1CCA) -> sub_1d8f.
 *     call c NOT TAKEN:    10 t, PC 0x1CCA.
 *   - BB2 (0x1CCA-0x1CCF): ld a,0x02(7) + ld (0x620f),a(13) + jp 0x1da6(10)       = 30 t, PC 0x1DA6.
 * Per-arm own totals (measured against the oracle with the two callees stubbed):
 *   - carry SET (footstep):     21 + 17 + 30 = 68 t, SP one push deeper (0x1CCA).
 *   - carry CLEAR (no footstep): 21 + 10 + 30 = 61 t.
 * Each equals the oracle sum exactly, so the frame's cycle budget -- hence SPIN_COUNT
 * 0x6019 (the PRNG entropy) -- is unchanged.
 *
 * REACHABILITY / ATOMICITY (MEASURED; why the collapse is licensed under the STRICT gate).
 * loc_1cc2 is the shared tail that loc_1c8f/loc_1cab reach on their "new step" arm,
 * inside the per-frame movement cascade under loc_197a (entry_1ac3 -> loc_1ae6 ->
 * loc_1c8f/loc_1cab -> loc_1cc2). Probed over 900 attract frames: 70 entries (first
 * ~frame 634), BOTH arms reached naturally -- carry set (footstep) 17x, carry clear 53x.
 * It is ATOMIC: every one of the 70 entries occurs with io.nmiMask CLEARED (inside the
 * vblank NMI, whose handler zeroed the mask on entry so it cannot re-enter -- 70/70
 * in-NMI, 0 out) and the NMI's pushed PC NEVER lands in [0x1CC2,0x1CD2) (0 landings over
 * 894 NMIs). So the loc_197a cascade is ATOMIC here: an atomic collapse pushes no
 * mistimed PC and tears no raster, and it passes the BYTE-EXACT whole-machine gate
 * directly -- NOT the convergent gate. See equivalence-1cc2.test.js.
 */
export function loc_1cc2(m) {
  const { regs, mem } = m;

  // BB0: ld hl,0x6207 ; ld (hl),a ; rra  -> store the sprite code, carry := old A bit0.
  regs.hl = MARIO_SPRITE_CODE; // 0x6207
  mem.write8(regs.hl, regs.a); // store the walk-arm's sprite-code byte
  regs.rra(); // A bit0 -> carry (the walk-phase / footstep tick); H=0,N=0,S/Z/PV kept
  m.step(0x1cc7, 21); // ld hl(10) + ld (hl),a(7) + rra(4)

  if (regs.fC) {
    // call c taken: odd walk phase -> footstep sound. BOUNDARY: push 0x1CCA, charge the
    // CALL's 17 t, then run sub_1d8f (writes SND_TRIGGER 0x6080 = 3, work RAM).
    m.push16(0x1cca);
    m.step(0x1d8f, 17);
    m.call(0x1d8f);
  } else {
    // call c NOT taken: even phase, no footstep this step.
    m.step(0x1cca, 10);
  }

  // BB2: ld a,0x02 ; ld (0x620f),a ; jp 0x1da6  -> reload the sub-step timer, tail off.
  regs.a = 0x02;
  mem.write8(MARIO_MOVE_STEP_TIMER, regs.a); // 0x620F := 2
  m.step(0x1da6, 30); // ld a,0x02(7) + ld (0x620f),a(13) + jp 0x1da6(10)
  return m.call(0x1da6); // entry_1da6: copy the player sprite record; its ret returns to our caller
}
