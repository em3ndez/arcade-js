// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2fb7 — pick which object-sprite build path lays down this frame's record,
 * based on how far the hammer's duration counter has run.  ROM 0x2FB7.
 *
 * One of the build arms feeding the shared object-sprite record write (loc_2f7c),
 * reached from the hammer updater (loc_2f43) on the branch where the counter's low
 * byte advanced without wrapping. It reads the counter's high byte and splits:
 *
 *   - high byte zero (the counter is still in its first 256 counts): commit the
 *     record directly through loc_2f7c with the caller's attribute unchanged — no
 *     blink.
 *   - high byte non-zero (past 256, i.e. the counter's later stretch as it heads for
 *     its ~512-count expiry): route through loc_2fbe, which flashes the sprite's
 *     colour attribute on the frame counter's blink phase before committing the same
 *     record. This is the half of the hammer's life where it flashes to warn of its
 *     coming expiry [guess — the warning-flash purpose is loc_2fbe's, carried from the
 *     still-translated caller chain; the mechanism here is just the high-byte split].
 *
 * Either path lays down the same 4-byte sprite record; this arm only selects whether
 * the attribute blinks. The record's inputs — destination address, object base, tile
 * code and attribute — pass straight through untouched to whichever tail runs; this
 * arm sets none of them. They arrive through the register file because loc_2f7c's
 * callers are all still the translated oracle (the genuine boundary the pipeline
 * permits), and dissolve into honest parameters once the whole arm/updater chain is
 * decompiled.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2fb7.test.js.
 * GATE:     captured + crafted. 0x2FB7 is dispatched during attract (the hammer grab),
 *           and because it fans out into loc_2fbe it covers BOTH the direct-write
 *           branch (high byte zero) and the blink branch (high byte set); captured
 *           dispatches replay the real path, crafted entries then pin both branches —
 *           and inside the blink branch both blink phases — against both object
 *           records, several pass-through attributes, and the 8-bit X/Y position
 *           wraps. Full RAM dump compared: neither this arm nor its tails write the
 *           stack, so no exclusion. Teeth: an inverted branch, a swapped branch, and a
 *           forced always-direct twin.
 * LIVE-OUT: memory-only. This arm tail-calls the chosen record write and its own
 *           caller discards the result; the oracle's residual registers/flags and the
 *           tails' terminal return reach no consumer. pc/SP are not compared.
 * NAMES:    HAMMER_TIMER_HI (0x6395) from ram.js. The chosen tail owns every
 *           record/object cell; loc_2f7c / loc_2fbe are direct-called.
 */

import { HAMMER_TIMER_HI } from "./ram.js";
import { loc_2f7c } from "./loc_2f7c.js"; // ROM 0x2F7C — the shared object-sprite record write
import { loc_2fbe } from "./loc_2fbe.js"; // ROM 0x2FBE — the blink-phase build arm (tails into loc_2f7c)

export function loc_2fb7(m) {
  const { mem } = m;

  // High byte of the hammer duration counter still zero -> write the record directly.
  // Once it sets (the counter's later stretch), route through the blink arm instead.
  if (mem.read8(HAMMER_TIMER_HI) === 0) {
    loc_2f7c(m);
  } else {
    loc_2fbe(m);
  }
}
