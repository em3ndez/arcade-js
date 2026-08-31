// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { beginTwoPlayerStartOfLife } from "./beginTwoPlayerStartOfLife.js";
import { startOnePlayerGameOnCredit } from "./startOnePlayerGameOnCredit.js";
import {
  INPUT_PORT0,
  CREDIT_COUNT,
  CREDIT_CHECKSUM_TABLE,
  CREDIT_TAMPER_COUNTER,
} from "./names.js";
/**
 * startSelectedPlayerGameConsumingCredits — the credit-spending start handler.
 *
 * WHAT IT IS
 *   The final stage of the button-driven start path. It runs once a credit is on hand and the
 *   start-gate bits have latched; its job is to read which start button the player pressed and
 *   turn that press into a game — charging the correct number of credits and dropping the
 *   machine into start-of-life setup.
 *
 * ROLE IN THE MACHINE
 *   The coin, service and start buttons all arrive on one active-low hardware port. The per-frame
 *   interrupt service complements that port (so a pressed control reads as a set bit) and shifts
 *   it through a short edge-detect history ring whose head is INPUT_PORT0 (0x8810). In that
 *   already-inverted byte the start-button assignments are fixed:
 *     - bit 3 (0x08) = one-player start
 *     - bit 4 (0x10) = two-player start
 *   This routine is the fork that reads those two bits and commits the game:
 *     - bit 3 set  -> hand off to the one-player start, which spends a single credit.
 *     - bit 4 set  -> two-player start: spend TWO credits, run an anti-tamper integrity check
 *                     over a small ROM table, then enter the two-player start-of-life.
 *     - neither    -> no start button this handler cares about is down; return.
 *
 * ROM 0x0d78.
 * Grounding: [seen]
 *
 * LIVE-OUT: none — the effects are all in memory. CREDIT_COUNT (0x8802) is debited, and if the
 *   integrity table folds wrong CREDIT_TAMPER_COUNTER (0x89ea) is bumped. The tail continues into
 *   the two-player start-of-life setup, which commits the rest of the new-game state.
 */
// The ROM integrity table is 0x14 (20) bytes long. That same count seeds BOTH halves of the
// 16-bit accumulator that folds the table (see the loop below), so the constant does double duty
// as the byte count and as the fold seed.
const CHECKSUM_LEN = 0x14;
// The folded checksum is masked with this pattern before the tamper test. An unmodified table
// folds to a value that clears every bit in the mask, so a legitimate table yields zero here and
// only a corrupted one survives nonzero.
const FOLD_MASK = 0xab;

export function startSelectedPlayerGameConsumingCredits(m) {
  const { mem8 } = m;

  // Read this frame's debounced start/coin sample from the head of the IN0 edge-detect ring
  // (INPUT_PORT0, 0x8810). It is already complemented, so a pressed button reads as a set bit.
  const in0 = mem8[INPUT_PORT0];
  // Bit 3 (0x08) = one-player start. A solo game costs a single credit, so the entire two-credit
  // path below is skipped: hand straight off to the one-player start handler.
  if (in0 & 0x08) return startOnePlayerGameOnCredit(m); // bit 3: 1P-start branch
  // Bit 4 (0x10) = two-player start. If it is clear, neither start button of interest is down, so
  // there is nothing to commit — return without touching credits.
  if ((in0 & 0x10) === 0) return; // bit 4 clear: nothing to do
  // A two-player game costs two credits. Read the running credit count (CREDIT_COUNT, 0x8802) and
  // refuse the start if the player cannot afford both — the press is simply ignored.
  const credits = mem8[CREDIT_COUNT];
  if (credits < 2) return;
  // Afford it: charge the two credits up front.
  mem8[CREDIT_COUNT] = credits - 2;

  // Anti-tamper integrity check over the small ROM table at CREDIT_CHECKSUM_TABLE (0x776b). A
  // 16-bit running total is folded across the table's CHECKSUM_LEN (0x14) bytes: the low half
  // (`sum`) accumulates the bytes, and the high half (`carry`) counts each time the low half
  // overflows 8 bits. Both halves start seeded from the byte count itself, so a legitimate,
  // unmodified table always folds down to the fixed pattern that FOLD_MASK tests for.
  let sum = CHECKSUM_LEN; // E seeded from the byte count
  let carry = CHECKSUM_LEN; // D seeded from E
  let ptr = CREDIT_CHECKSUM_TABLE;
  for (let n = CHECKSUM_LEN; n > 0; n--) {
    // Fold the next table byte into the low half; an 8-bit overflow tallies into the high half.
    const t = sum + mem8[ptr];
    if (t > 0xff) carry = u8(carry + 1);
    sum = t & 0xff;
    ptr = u16(ptr + 1);
  }
  // Fold the two halves together and mask. A clean table yields zero; any nonzero result means the
  // ROM table has been altered, so record a strike in CREDIT_TAMPER_COUNTER (0x89ea). The debit
  // above stands regardless — the check does not refund the charge.
  if ((u8(sum + carry) & FOLD_MASK) !== 0) {
    mem8[CREDIT_TAMPER_COUNTER] = u8(mem8[CREDIT_TAMPER_COUNTER] + 1);
  }
  // Enter the two-player start-of-life setup, which seeds the two-player flag and commits the rest
  // of the fresh-game state.
  return beginTwoPlayerStartOfLife(m);
}
