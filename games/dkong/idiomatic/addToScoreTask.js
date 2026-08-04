// SPDX-License-Identifier: GPL-3.0-only
/**
 * addToScoreTask — the "add to a score" task: bump the player-up's score by a table
 * amount, redraw it, and promote it to the high score if it now leads.  ROM 0x051C.
 *
 * Dispatched as task opcode 0 (add-to-score). The task payload chosen by the
 * enqueuer selects a three-byte packed-BCD addend from the ROM table at 0x3529
 * (payload 1 -> +100, 5 -> +500, 11 -> +1000, ...; payload 0 and 10 add nothing).
 *
 * The work, in order:
 *   1. A caller-skip guard: while no credited game is in progress (attract), the
 *      whole task is skipped and nothing happens.
 *   2. Pick the score counter of the player currently up.
 *   3. Add the selected addend into that three-byte counter, least-significant
 *      byte first, rippling the carry upward and BCD-correcting each byte.
 *   4. Repaint the player's score readout from the updated counter.
 *   5. Compare the updated score against the stored high score, most-significant
 *      byte first. If the new score is lower, stop. If every byte is equal, stop.
 *      As soon as a byte is greater, the score leads: copy just the bytes not yet
 *      proven equal (the low end) over the high-score counter and repaint the
 *      on-screen high score.
 *
 * The high-score compare walks DOWN from the top byte while the add walked UP, so
 * the end-of-counter pointer is saved across the repaint and repositioned to the
 * top byte for the compare. The count left when a greater byte is found is exactly
 * how many low bytes still need copying — reloading it to three would clobber bytes
 * the compare already proved equal, so it is deliberately carried over.
 *
 * The BCD add starts with a clear carry so the first byte is not perturbed by any
 * leftover carry from computing the table index — the reason the oracle spends an
 * otherwise value-less instruction there.
 *
 * Memory-equivalent to the frozen oracle entry_051c — equivalence-051c.test.js.
 * GATE:     real captured dispatches (attract reaches this task, taking the skip
 *           guard) plus crafted entries seeded from a real attract machine that
 *           drive every arm: the attract skip, the add-then-lower / add-then-equal
 *           no-promote exits, all three copy widths (top / middle / low byte first
 *           greater), a full carry ripple, and both players. Compared over RAM minus
 *           the dead STACK_SCRATCH the oracle's push/return churn writes, plus pc and
 *           SP. Teeth: a twin that reloads the copy width to three and a twin that
 *           skips the clear-carry so the low byte carries in wrongly.
 * LIVE-OUT: memory-only — the updated score counter, the high-score counter (when it
 *           leads), and the six-digit score and high-score readouts. The oracle's
 *           residual registers/flags and its two-level guard return are dead ABI (the
 *           task dispatcher issues its next task without reading them); the terminal
 *           return the harness supplies lines pc + SP up with the oracle.
 * NAMES:    CURRENT_PLAYER (0x600D) and HIGH_SCORE (0x60B8) from names.js. The addend
 *           table at 0x3529 is ROM, the score counters arrive from
 *           selectCurrentPlayerScoreCounter, and the readout cells are video RAM
 *           owned by the renderers — none carry a names.js name. gameActiveGuard
 *           (0x0008), selectCurrentPlayerScoreCounter (0x055F), loc_056b (0x056B) and
 *           drawHighScore (0x05DA) are all direct-called.
 */

import { CURRENT_PLAYER, HIGH_SCORE } from "./names.js";
import { gameActiveGuard } from "./gameActiveGuard.js";                     // ROM 0x0008 (rst 0x08)
import { selectCurrentPlayerScoreCounter } from "./selectCurrentPlayerScoreCounter.js"; // ROM 0x055F
import { loc_056b } from "./loc_056b.js";                                   // ROM 0x056B
import { drawHighScore } from "./drawHighScore.js";                         // ROM 0x05DA

const SCORE_ADDEND_TABLE = 0x3529; // ROM: 3-byte packed-BCD addends, one per task payload

export function addToScoreTask(m) {
  const { regs, mem } = m;

  // The enqueuer left the task payload in the accumulator; it indexes the addend table.
  const payload = regs.a & 0xff;

  // Skip the whole task while no credited game is in progress (attract).
  if (!gameActiveGuard(m)) return;

  // The score counter of the player currently up (base of its 3 packed-BCD bytes).
  regs.de = selectCurrentPlayerScoreCounter(m);

  // Each addend is 3 bytes; the index is (payload * 3) taken as a single byte, matching
  // the oracle's 8-bit multiply before it offsets the table base.
  let addendPtr = (SCORE_ADDEND_TABLE + ((payload * 3) & 0xff)) & 0xffff;

  // Add the addend into the counter, least-significant byte first. The chain starts with
  // a clear carry; each BCD-corrected byte's carry feeds the next.
  let carry = 0;
  for (let i = 0; i < 3; i++) {
    regs.a = mem.read8(regs.de);
    regs.add(mem.read8(addendPtr), carry); // add addend byte + carry-in
    regs.daa();                            // BCD-correct (follows an add: no-borrow correction)
    carry = regs.fC ? 1 : 0;               // carry-out for the next byte
    mem.write8(regs.de, regs.a);
    regs.de = (regs.de + 1) & 0xffff;      // walk the counter up
    addendPtr = (addendPtr + 1) & 0xffff;  // walk the addend up
  }
  const scoreEnd = regs.de; // one past the counter's top byte

  // Repaint the player's score readout. loc_056b takes the player selector in the
  // accumulator and the render source at the counter's most-significant pair; it clobbers
  // the counter pointer, so the end pointer is kept for the compare below.
  regs.de = (scoreEnd - 1) & 0xffff;   // most-significant pair, the render source
  regs.a = mem.read8(CURRENT_PLAYER);  // selector: the player up now
  loc_056b(m);

  // Compare the updated score against the high score, top byte first, walking down.
  regs.de = (scoreEnd - 1) & 0xffff;   // counter's top byte
  let hsPtr = (HIGH_SCORE + 2) & 0xffff; // high score's top byte
  let width = 3;                        // bytes still to resolve (also the copy width)
  for (;;) {
    const scoreByte = mem.read8(regs.de);
    const hsByte = mem.read8(hsPtr);
    if (scoreByte < hsByte) return;      // new score lower here -> it does not lead
    if (scoreByte !== hsByte) break;     // new score greater here -> promote the low bytes
    regs.de = (regs.de - 1) & 0xffff;
    hsPtr = (hsPtr - 1) & 0xffff;
    width -= 1;
    if (width === 0) return;             // every byte equal -> nothing to promote
  }

  // The new score leads. Re-fetch the counter base (the compare walked the pointer down)
  // and copy the still-unresolved low bytes over the high score, low byte first.
  regs.de = selectCurrentPlayerScoreCounter(m);
  let hsDst = HIGH_SCORE;
  for (let i = 0; i < width; i++) {
    mem.write8(hsDst, mem.read8(regs.de));
    regs.de = (regs.de + 1) & 0xffff;
    hsDst = (hsDst + 1) & 0xffff;
  }

  // Repaint the on-screen high score from the promoted counter.
  drawHighScore(m);
}
