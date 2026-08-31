// SPDX-License-Identifier: GPL-3.0-only
import { addCreditsAndQueueDisplay } from "./addCreditsAndQueueDisplay.js";
/**
 * addFullWrapCreditAmount — the full-wrap entry into the shared credit-accumulate tail.
 *
 * WHAT IT IS: a two-byte on-ramp that seeds one fixed award amount and then drops straight
 * into the common credit-accumulate tail. It is the special case of coin pricing where a
 * coin slot is configured so that a single accepted coin is worth the maximum award, and it
 * exists only to preload that maximum before the shared add-and-clamp code runs.
 *
 * ROLE IN THE MACHINE: coins are priced by the coinage subsystem's accumulate-and-compare.
 * Each accepted coin on a slot adds 0x10 to that slot's accumulator; once the accumulator
 * overtakes the slot's coinage descriptor, the group is subtracted back off and the
 * descriptor's low nibble is handed on as the number of credits the coin group just bought.
 * There is one reserved descriptor value: a low nibble of 0x0f means "full wrap" — instead
 * of awarding a small nibble count, the coin group is treated as buying the cap. That is the
 * case this routine serves. Where a normal award would carry a small credit count into the
 * accumulate tail, the full-wrap case comes here first, which substitutes the cap constant
 * for that count and then continues into the exact same tail the ordinary awards use.
 *
 * ROM 0x5a8a-0x5a8b (`ld a,0x63`), which falls straight through into the shared
 * accumulate-and-clamp body at ROM 0x5a8c. Grounding: [seen].
 *
 * LIVE-OUT: memory only — via the accumulate tail. The tail adds this seeded amount onto the
 * credit-count byte CREDIT_COUNT (0x8802), clamps that byte to its ceiling, and queues a
 * credit-display refresh. Because the amount seeded here (0x63) is already the ceiling and
 * the tail clamps at that same ceiling, a full wrap always leaves the credit count pinned at
 * its maximum, whatever it held before. No caller reads a result back.
 */
const WRAP_AMOUNT = 0x63; // the full-wrap award: 0x63 = 99 decimal, the credit-count ceiling (largest 2-digit total the HUD can show)
/**
 * Seed the award to the wrap constant and continue into the accumulate tail.
 *
 * The full-wrap descriptor does not carry a small credit count to add; it means "award the
 * cap". So the amount handed to the shared tail is fixed at WRAP_AMOUNT (0x63) rather than a
 * descriptor nibble. That amount is passed straight into addCreditsAndQueueDisplay, the
 * common ending every credit event funnels through: it adds the amount onto CREDIT_COUNT
 * (0x8802), pins the byte at the 0x63 ceiling, and tails into the credit-display refresh so
 * the two on-screen credit digits are re-drawn to match. Nothing else happens here — the
 * whole purpose of this entry is to preload the award before that shared tail runs.
 */
export function addFullWrapCreditAmount(m) {
  return addCreditsAndQueueDisplay(m, WRAP_AMOUNT);
}
