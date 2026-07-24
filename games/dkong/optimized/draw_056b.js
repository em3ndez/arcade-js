// SPDX-License-Identifier: GPL-3.0-only
/**
 * draw_056b — hand-optimized rewrite of the translated routine at ROM 0x056B,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its one callee (0x0578, draw_0578) is reached through
 * `m.call`, the routine registry (games/dkong/routines.js), so it resolves to the
 * oracle or to a future optimized rewrite — never a copy. No RAM names are
 * imported: the routine touches only register IX and two VRAM tilemap column
 * bases, which are video RAM (not work RAM 0x6000-0x6BFF), so they are not in
 * ram.js and stay hex here with a comment.
 */

/**
 * draw_056b -- pick the score's VRAM column, then join the BCD renderer.
 * [ROM 0x056B-0x0577, then TAIL-JOINS draw_0578 at 0x057C]
 *
 *   056b  dd 21 81 77  ld   ix,0x7781   ; default = P1 score column
 *   056f  a7           and  a           ; test A (which player/slot)
 *   0570  28 0a        jr   z,0x057c    ; A == 0 -> keep P1 column
 *   0572  dd 21 21 75  ld   ix,0x7521   ; A != 0 -> P2 score column
 *   0576  18 04        jr   0x057c
 *   ...  falls into draw_0578 at 0x057C (AFTER draw_0578's own `ld ix`)
 *
 * A SELECTS THE DESTINATION COLUMN, NOTHING ELSE. This is the alternate
 * entry of draw_0578 (ROM 0x0578, "render a 3-byte little-endian BCD counter
 * as 6 digits, high nibble first, stepping one tilemap row -0x20 per digit").
 * draw_0578's normal entry loads IX = 0x7641 for the high-score column; this
 * entry instead chooses between two score columns from A and then jumps PAST
 * that `ld ix` (to 0x057C), so the two entry points differ ONLY in which IX
 * they establish. draw_056b writes NO memory itself — every store (the 6 VRAM
 * digits) happens downstream in draw_0578 -> loop_0583 -> sub_0593, run via the
 * oracle. So there is no hardware-latch write here and no write-trace concern.
 *
 * INPUTS:
 *   A  — column selector: 0 => P1 column 0x7781, non-zero => P2 column 0x7521.
 *        (handler_05c6 passes the task payload 0/1; entry_051c passes 0x600D,
 *         the CURRENT_PLAYER flag. Both map 0->P1, non-zero->P2.)
 *   DE — the 3-byte BCD source's most-significant byte, set by the caller and
 *        consumed by draw_0578 (via `ex de,hl`); untouched here.
 * OUTPUTS:
 *   IX — the chosen VRAM tilemap column base (0x7781 or 0x7521).
 *   Then draw_0578 renders 6 BCD digits into VRAM from that column downward.
 *   F  — `and a` sets Z (from A), clears C, sets H; A is unchanged.
 *   The `ret` that eventually runs belongs to draw_056b's OWN caller: this is a
 *   tail-join (jr into draw_0578), so nothing is pushed and no push16 appears
 *   below — draw_0578's terminal `ret` returns on draw_056b's behalf.
 *
 * FLAGS -- `and a` kept verbatim. Two reasons it must be byte-exact, not just
 * "produce Z for the branch": (1) the branch consumes Z; (2) this routine is
 * NON-ATOMIC (see below), so if the vblank NMI lands between `and a` and the
 * tail-join it pushes AF into diffed stack RAM — F has to match the oracle at
 * that instruction boundary. `regs.and(regs.a)` reproduces the oracle's exact
 * Z/C/H/S/PV, so the unit gate (which compares the whole register file, F
 * included) passes.
 *
 * LADDER STATUS -- rung 4 (idiomatic), CYCLES COLLAPSED to one m.step per basic
 * block. draw_056b is a LEAF reached ONLY via `m.call(0x056b)`, and both of its
 * call sites are MAIN-LOOP tasks (dispatched by dispatchTask with the NMI mask
 * ENABLED):
 *   - entry_051c  @ ROM 0x053B  (`call 0x056b`,   task 0: add-to-score render)
 *   - handler_05c6 @ ROM 0x05D7 (`jp nz,0x056b`,  task 2: draw a BCD counter)
 * By the per-call-path atomicity rule this is NOT atomic: the NMI can fire
 * between these instructions. A collapse's only observable effect on such an
 * interrupted path is the coarse PC/F pushed into the dead stack or a healing
 * single-frame pixel tear — never a persistent divergence, since the fold writes
 * no memory and crosses no hardware write. Licensed by the CONVERGENT gate (same
 * reasoning as sub_0350; equivalence-056b.test.js uses convergentGate, not the
 * strict whole-machine gate). The per-branch TOTALS are the oracle's exactly:
 * Z-taken (prologue 14+4=18, +12 tail) = 30 T; Z-not-taken (prologue 18, + the
 * not-taken jr[7]+ld ix[14]+jr[12]=33 folded) = 51 T.
 */
export function draw_056b(m) {
  const { regs } = m;

  // VRAM tilemap column bases for the on-screen score digits (video RAM, not
  // work RAM — not named in ram.js). 0x7781 pairs with the A==0 slot (P1),
  // 0x7521 with the A!=0 slot (P2); see handler_05c6's payload 0/1 mapping.
  const VRAM_SCORE_COL_P1 = 0x7781;
  const VRAM_SCORE_COL_P2 = 0x7521;

  // ld ix,0x7781 (default P1 column) / and a (test the selector A) -- folded:
  // 14 + 4 = 18 t, the common prologue (and a's flags decide the branch below).
  regs.ix = VRAM_SCORE_COL_P1;
  regs.and(regs.a); // Z <- (A == 0); clears C, sets H — kept verbatim (see header)
  m.step(0x0570, 18);

  if (regs.fZ) {
    // jr z taken: A == 0, keep the P1 column. path total 18+12 = 30 T.
    m.step(0x057c, 12);
  } else {
    // jr z not taken -> ld ix,0x7521 (P2 column) -> jr, folded: 7+14+12 = 33 t.
    // path total 18+33 = 51 T.
    regs.ix = VRAM_SCORE_COL_P2;
    m.step(0x057c, 33);
  }

  // Tail-join draw_0578 at 0x057C (enteredAt057C = true skips its own `ld ix`).
  // No push16: this is a jump into the renderer, whose `ret` returns for us.
  return m.call(0x0578, true);
}
