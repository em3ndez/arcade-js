// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectHammerSpriteBlinkByTimer — pick which object-sprite build path lays down this frame's record,
 * based on how far the hammer's duration counter has run.  ROM 0x2FB7.
 *
 * One of the build arms feeding the shared object-sprite record write (commitSpriteRecordAtMarioOffset),
 * reached from the hammer updater (loc_2f43) on the branch where the counter's low
 * byte advanced without wrapping. It reads the counter's high byte and splits:
 *
 *   - high byte zero (the counter is still in its first 256 counts): commit the
 *     record directly through commitSpriteRecordAtMarioOffset with the caller's attribute unchanged — no
 *     blink.
 *   - high byte non-zero (past 256, i.e. the counter's later stretch as it heads for
 *     its ~512-count expiry): route through blinkHammerSpriteOnFramePhase, which flashes the sprite's
 *     colour attribute on the frame counter's blink phase before committing the same
 *     record. This is the half of the hammer's life where it flashes to warn of its
 *     coming expiry [guess — the warning-flash purpose is blinkHammerSpriteOnFramePhase's, carried from the
 *     still-translated caller chain; the mechanism here is just the high-byte split].
 *
 * Either path lays down the same 4-byte sprite record; this arm only selects whether
 * the attribute blinks. The record's inputs — destination address, object base, tile
 * code and attribute — pass straight through untouched to whichever tail runs; this
 * arm sets none of them. They arrive through the register file because commitSpriteRecordAtMarioOffset's
 * callers are all still the translated oracle (the genuine boundary the pipeline
 * permits), and dissolve into honest parameters once the whole arm/updater chain is
 * decompiled.
 *
 * GROUNDED (DK understanding pass 4, independent confirmer): reads HAMMER_TIMER_HI (named 0x6395);
 * its sole caller loc_2f43 is the active-hammer chain of entry_2ed4 (the MARIO_HAMMER_ACTIVE
 * dispatch), and the blink threshold (high byte nonzero) matches ram.js's hammer expiry (~512
 * frames). The [guess] expiry-warning purpose is carried from the caller chain, not asserted here.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2fb7.test.js.
 * GATE:     captured + crafted. 0x2FB7 is dispatched during attract (the hammer grab),
 *           and because it fans out into blinkHammerSpriteOnFramePhase it covers BOTH the direct-write
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
 *           record/object cell; commitSpriteRecordAtMarioOffset / blinkHammerSpriteOnFramePhase are direct-called.
 */

import { HAMMER_TIMER_HI } from "./ram.js";
import { commitSpriteRecordAtMarioOffset } from "./commitSpriteRecordAtMarioOffset.js"; // ROM 0x2F7C — the shared object-sprite record write
import { blinkHammerSpriteOnFramePhase } from "./blinkHammerSpriteOnFramePhase.js"; // ROM 0x2FBE — the blink-phase build arm (tails into commitSpriteRecordAtMarioOffset)

export function selectHammerSpriteBlinkByTimer(m) {
  const { mem } = m;

  // High byte of the hammer duration counter still zero -> write the record directly.
  // Once it sets (the counter's later stretch), route through the blink arm instead.
  if (mem.read8(HAMMER_TIMER_HI) === 0) {
    commitSpriteRecordAtMarioOffset(m);
  } else {
    blinkHammerSpriteOnFramePhase(m);
  }
}
