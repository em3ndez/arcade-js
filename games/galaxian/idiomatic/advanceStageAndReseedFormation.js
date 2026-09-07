// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceStageAndReseedFormation -- consume the armed stage-advance one-shot and rebuild the formation.
 *
 * WHAT IT IS
 *   The per-frame handler that finishes a stage transition. Galaxian advances to a harder stage once the
 *   alien block has been emptied: armFormationAdvanceTrigger (0x1621) sets a delayed one-shot, and this
 *   routine is the delayed consumer that actually rebuilds the board a notch harder. It fires on exactly
 *   the one tick where the enable flag is set and its countdown decrements to zero; every other tick it
 *   either bails immediately or just ticks the countdown down.
 *
 * ROLE IN THE MACHINE
 *   Runs once per frame off the interrupt-driven background timer layer (mechanisms.md "Advancing the
 *   stage and rebuilding the formation"). The enable byte is loc_4222 bit0 with its countdown in the
 *   adjacent byte loc_4223 -- together the delayed one-shot armFormationAdvanceTrigger writes as a 16-bit
 *   word. On the firing tick it: disarms the enable; rebuilds all 128 one-bit-per-cell formation flags
 *   from the packed 16-byte ROM template loc_051b via unpackBitmaskToFlagBytes; zeroes the pace/difficulty
 *   ramp counter loc_421a (rampCounterToCeiling's 0..7 counter) and the free-running FRAME_COUNTER
 *   (0x425f); reseeds the 16-bit formation anchor loc_420e to 1; steps the stage selector loc_421b (low
 *   byte saturating at SELECTOR_MAX, high byte counting without limit); enqueues a stage command word via
 *   the deferred command queue (loc_0700); and services a pending two-slot request in loc_421e, raising
 *   loc_4177 and, while the count remains, loc_4178.
 *
 * ROM 0x1637.  Grounding: [seen].
 *
 * LIVE-OUT: memory only -- the reseeded flag block, the reset anchor/pace/frame counters, the stepped
 * stage selector, the queued command word, and the two request slots. No register result the caller reads.
 */
import { unpackBitmaskToFlagBytes } from "./unpackBitmaskToFlagBytes.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import {
  loc_4222, loc_4223, loc_421a, FRAME_COUNTER, loc_420e, loc_421b, loc_421e,
  loc_4177, loc_4178, loc_051b, loc_0700,
} from "./names.js";

// The stage selector's low byte tops out here: difficulty stops climbing past the seventh notch even as
// the high byte (the raw stage count) keeps incrementing forever.
const SELECTOR_MAX = 7;

export function advanceStageAndReseedFormation(m) {
  const { mem8, mem16 } = m;

  // Gate: the enable flag's bit 0 must be set and the countdown must land on zero this tick.
  // loc_4222 bit0 is the "armed" bit armFormationAdvanceTrigger set; loc_4223 is the paired countdown.
  // While the enable is clear there is nothing to do; while the countdown is still winding down we tick
  // it once and leave -- the rebuild only happens on the single frame the countdown crosses to zero.
  if (!(mem8[loc_4222] & 1)) return;
  const countdown = (mem8[loc_4223] - 1) & 0xff;
  mem8[loc_4223] = countdown;
  if (countdown !== 0) return;

  // Disarm the enable so this one-shot cannot re-fire, then rebuild the 128-flag formation block from the
  // packed ROM template loc_051b. unpackBitmaskToFlagBytes expands that 16-byte LSB-first bitmask into the
  // 128-byte one-bit-per-cell flag block FLAG_BITS_BASE (0x4100) -- a full fresh wall for the new stage.
  mem8[loc_4222] = 0;
  unpackBitmaskToFlagBytes(m, loc_051b);

  // Reset the two free-running counters the fresh board should start clean: loc_421a is rampCounterToCeiling's
  // 0..7 pace/difficulty ramp (back to the slowest pace), FRAME_COUNTER (0x425f) is the per-frame counter
  // that paces draw phases and the start-lamp gate.
  mem8[loc_421a] = 0;
  mem8[FRAME_COUNTER] = 0;
  mem16[loc_420e] = 1; // reseed the formation anchor

  // Step the stage selector: its high byte counts up, its low byte advances but saturates at the max.
  // loc_421b packs stage-count (high) over difficulty-index (low). The high byte is the raw number of
  // stages cleared; the low byte is the difficulty tier that pacing/launch code reads, clamped at
  // SELECTOR_MAX so the game plateaus in difficulty even as the stage number keeps rising.
  const sel = mem16[loc_421b];
  const low = sel & 0xff;
  const nextHigh = ((sel >> 8) + 1) & 0xff;
  const nextLow = low < SELECTOR_MAX ? low + 1 : SELECTOR_MAX;
  mem16[loc_421b] = (nextHigh << 8) | nextLow;

  // Defer the stage's visible/audible work: enqueueCommandWord appends the channel/parameter word loc_0700
  // to the command ring buffer, so the actual VRAM/sound writes happen later when the queue drains.
  enqueueCommandWord(m, loc_0700);

  // Service a pending request: raise the first slot, decrement the count, raise the second while it remains.
  // loc_421e holds how many of the two request slots to raise this transition. Zero means nothing pending.
  // Otherwise raise slot loc_4177, count one off, and -- only if the count had not already reached one --
  // raise the second slot loc_4178 and clear the request. This caps the raise at the two available slots.
  const request = mem8[loc_421e];
  if (request === 0) return;
  mem8[loc_4177] = 1;
  const remaining = (request - 1) & 0xff;
  mem8[loc_421e] = remaining;
  if (remaining === 0) return;
  mem8[loc_4178] = 1;
  mem8[loc_421e] = 0;
}
