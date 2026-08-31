// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { queueCreditDisplayRefresh } from "./queueCreditDisplayRefresh.js";
import { CREDIT_COUNT } from "./names.js";
/**
 * addCreditsAndQueueDisplay — the shared accumulate-and-clamp tail of credit accrual.
 *
 * WHAT IT IS: the tiny common ending that every coin-and-credit event funnels through to
 * actually move the on-screen credit total. The three per-frame credit-accrual steps —
 * the service-credit step, the coin-slot-1 step, and the coin-slot-2 step — each decide
 * *how many* credits an event is worth (a service credit awards one; a coin runs the
 * coinage accumulate-and-compare and awards the descriptor's low nibble; a full wrap
 * awards the cap). They all then hand that award amount to this routine, which does the
 * two things common to all of them: add the award to the stored credit count and hold
 * that count at its ceiling.
 *
 * ROLE IN THE MACHINE: coins and start buttons arrive on one hardware input port and are
 * debounced and priced by the coin subsystem, but the single running tally of "how many
 * games are paid for" lives in one work-RAM byte, the credit count CREDIT_COUNT (0x8802).
 * This routine is the *only* place that byte grows: whatever the event is worth, this is
 * where it is added on and where the byte is prevented from exceeding what the two-digit
 * credit display can show. After adjusting the byte it tails straight into the display
 * refresh so the number the player sees is re-drawn to match. The event's worth is decided
 * upstream; this routine only ever adds it on. Starting a game consumes from the same byte
 * elsewhere; this routine only ever adds.
 *
 * ROM 0x5a8c-0x5a96 (the add-and-clamp body), which falls straight through into the
 * display-refresh queueing at ROM 0x5a97. Grounding: [seen].
 *
 * NOTE ON NAMING: despite the "score"/"drip" wording carried by some of the accrual
 * routines, the byte accumulated here is the *credit count*, not a score. It is kept as a
 * plain binary count capped at 99; it is converted to packed BCD only when the HUD digits
 * are painted, not here.
 *
 * LIVE-OUT: memory only — the updated credit count byte CREDIT_COUNT (0x8802) and, via the
 * tail, a queued credit-display refresh request. No caller reads the result back.
 */
const SCORE_CAP = 0x63; // the credit-count ceiling: 0x63 = 99 decimal, the largest 2-digit credit total the HUD can show

export function addCreditsAndQueueDisplay(m, a = m.regs.a) {
  const { mem8 } = m;
  // STEP 1 — accumulate the award onto the running credit count.
  // The incoming award amount arrives in the accumulator (register A): each accrual step
  // has already computed how many credits its event is worth and left that in A (the
  // full-wrap entry seeds A with the cap first). Here it is added to the current value of
  // the credit-count byte CREDIT_COUNT (0x8802). The add is taken modulo 256 (u8) because
  // it is a single 8-bit register operation on the hardware — a sum past 0xff wraps — and
  // the clamp below keeps the stored result inside the valid credit range regardless.
  const sum = u8(a + mem8[CREDIT_COUNT]);
  // STEP 2 — store the sum, but clamp it at the ceiling.
  // The candidate total is compared against SCORE_CAP (0x63 = 99). A total below the cap is
  // stored as-is; a total that reaches or exceeds the cap is pinned to exactly 0x63. This
  // is what keeps the credit count from ever presenting more than the two on-screen credit
  // digits can render, no matter how many coins are fed in. The write lands back in the
  // same CREDIT_COUNT byte (0x8802) that the game reads whenever it decides a game is paid
  // for.
  mem8[CREDIT_COUNT] = sum < SCORE_CAP ? sum : SCORE_CAP;
  // STEP 3 — tail into the credit-display refresh.
  // The stored credit total has changed, so the two credit digits on the HUD are stale.
  // Rather than repaint them here, control drops into queueCreditDisplayRefresh, which posts
  // a "redraw credits" request; the digits are actually re-drawn later when the main loop
  // acts on that request. Every credit-changing event ends on this same tail.
  return queueCreditDisplayRefresh(m);
}
