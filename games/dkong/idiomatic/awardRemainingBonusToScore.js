// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardRemainingBonusToScore — award two table-selected BCD score amounts from the packed digit byte in
 * BONUS_DISPLAY, one per nibble.  ROM 0x0691.
 *
 * Reached from loc_062a's task-entry-10 dispatch on its A==0 arm (`jp z,0x0691`). The routine
 * reads BONUS_DISPLAY (0x638C), the on-screen bonus readout, as two digits one per nibble —
 * the packed-BCD reading is CODE-DERIVED (this routine's own `and 0x0f` / rrca-x4 nibble
 * split, plus the `daa` in stepBonusDisplayDown that maintains the cell), NOT an observed property of the
 * byte — and runs the add-to-score task (addToScoreTask) once per digit:
 *   - low nibble  -> addToScoreTask payload = (byte & 0x0f): indexes the "small" addend (table index
 *     = the digit itself; index 0 adds nothing).
 *   - high nibble -> addToScoreTask payload = (byte >> 4) + 0x0a: the SAME task, but its addend-table
 *     index is offset by ten, so the high digit selects a "large" addend (index 10 + digit;
 *     index 10 adds nothing). This is the rrca-x4 nibble swap in the oracle: rotating the byte
 *     right four places drops its high nibble into the low position, which `and 0x0f` then keeps.
 *
 * awardRemainingBonusToScore is the twin of renderBonusDisplay (39 bytes away) with INVERTED register roles — renderBonusDisplay keeps
 * the original byte in C and the low nibble in B; awardRemainingBonusToScore keeps the original in B and leaves the
 * low nibble in A. Here the nibbles are score-task payloads rather than tile digits, and the tail
 * `jp 0x051c` means the second add's return belongs to awardRemainingBonusToScore's own caller (loc_062a's caller).
 * The oracle's `push bc` at 0x0697 saves the original byte across the first call and `pop bc`
 * restores it for the high-nibble computation; the idiomatic form keeps the byte in a local, so no
 * register need survive the call. (The C the oracle pushes there is the caller's, never set on this
 * path and never read — addToScoreTask's first act is `ld c,a`, overwriting it — so it cannot reach RAM.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-0691.test.js.
 * GATE:     exhaustive over awardRemainingBonusToScore's ONE input byte — sweeps all 256 values of
 *           BONUS_DISPLAY on a
 *           crafted base (ATTRACT cleared so addToScoreTask's body runs; a mid score under a lower high
 *           score so the adds and a promotion are observable), for both players, proving awardRemainingBonusToScore
 *           feeds the correct two payloads for every possible byte. addToScoreTask's own arms are its
 *           gate's job (equivalence-051c). RAM minus the dead STACK_SCRATCH the oracle's push/call
 *           churn writes. Reachability probed; teeth pin the +0x0a offset and the nibble routing.
 *           GROUNDED on the real dkong ROM under MAME 0.288 (understanding pass 12) at six live
 *           dispatches: BONUS_DISPLAY read 0x47 / 0x48 / 0x57 / 0x60 / 0x54 / 0x67, and each
 *           produced exactly the two payloads the nibble split predicts — the low nibble, then
 *           (high nibble)+0x0A — with addToScoreTask entered exactly twice per call, and the
 *           index-0 case (BONUS_DISPLAY = 0x60) leaving the score at 015200 unchanged across its first
 *           add. All six bytes had both nibbles <= 9, consistent with packed BCD; six samples do
 *           not prove the cell can never carry 0xA-0xF, and that is not claimed. Those dispatches
 *           needed a forced GAME_SUBSTATE poke — over 49,700 logged frames of unpoked attract and
 *           credited play there were ZERO natural dispatches, so how the game naturally posts a
 *           task-10 payload of 0 remains unobserved.
 * LIVE-OUT: memory-only — the score counter, the high-score counter (when it leads) and the score /
 *           high-score readouts addToScoreTask writes. awardRemainingBonusToScore returns nothing a caller reads: loc_062a
 *           tail-jumps in and the terminal return unwinds to loc_062a's caller, which reloads.
 * NAMES:    BONUS_DISPLAY (0x638C) from ram.js — the on-screen bonus readout, read here as a
 *           packed digit-pair. loc_062a's task-10 divide writes it (quotient in the high
 *           nibble) on its other arm, so the value this arm reads is whatever that left behind;
 *           the A==0 arm skips that write. addToScoreTask (ROM 0x051C, the add-to-score task)
 *           is direct-called.
 */

import { BONUS_DISPLAY } from "./ram.js";
import { addToScoreTask } from "./addToScoreTask.js"; // ROM 0x051C — the add-to-score task (payload in the accumulator)

export function awardRemainingBonusToScore(m) {
  const { regs, mem } = m;

  // The packed digit byte: low nibble is the small addend's index, high nibble the large one's.
  const packed = mem.read8(BONUS_DISPLAY);

  // First digit: the low nibble is the add-to-score payload directly.
  regs.a = packed & 0x0f;
  addToScoreTask(m);

  // Second digit: the high nibble, its addend-table index offset by ten.
  regs.a = ((packed >> 4) + 0x0a) & 0xff;
  addToScoreTask(m);
}
