// SPDX-License-Identifier: GPL-3.0-only
/**
 * endMessageScrollOnExpiryFromDe — the DE-entry adapter to endMessageScrollOnExpiry (0x18e8).
 *
 * WHAT IT IS
 *   A thin terminator tail of the message scroller. In the ROM the countdown pointer arrives in the DE
 *   register pair, so this entry does an `ex de,hl` to move it into HL and then falls straight into
 *   endMessageScrollOnExpiry, which ticks that counter down and, on its zero-crossing, clears
 *   MESSAGE_SCROLL_ENABLE (0x40b0) to stop the scroll.
 *
 * ROLE IN THE MACHINE
 *   Lets a caller that already holds the countdown pointer in DE reach the shared expiry routine without
 *   reloading HL itself. Here that `ex de,hl` is modeled by defaulting the counterPtr parameter to the DE
 *   register pair before handing it to the shared implementation (imported aliased as loc_18e8).
 *
 * ROM 0x18e7.  Grounding: [seen].
 *
 * LIVE-OUT: whatever endMessageScrollOnExpiry returns; MESSAGE_SCROLL_ENABLE cleared on the zero-crossing.
 */
import { endMessageScrollOnExpiry as loc_18e8 } from "./endMessageScrollOnExpiry.js";

export function endMessageScrollOnExpiryFromDe(m, counterPtr = m.regs.de) {
  // Default the pointer to DE (the ROM's ex de,hl), then delegate to the shared tick-and-terminate routine.
  return loc_18e8(m, counterPtr);
}
