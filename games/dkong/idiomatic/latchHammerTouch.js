// SPDX-License-Identifier: GPL-3.0-only
/**
 * latchHammerTouch — latch whether Mario is touching one of the two hammer objects, select the
 * one he touched, and pulse the pickup sound.
 *
 * Reached from the movement machine's airborne tail on the frames its counter wraps, so it runs
 * a handful of times per demo rather than every frame. Four steps:
 *
 *   1. A board gate first, with a mask naming exactly the boards a hammer can appear on — 25m,
 *      50m and 100m; 75m is DK's one hammer-free board and is excluded. Closed, and the whole
 *      latch is skipped, leaving every cell below untouched.
 *   2. A search tests Mario's position against the two-record hammer pair and leaves its
 *      outcome in the register file: an overlap flag, plus a count-minus-index residue naming
 *      the matched record (2 = the pair's first record, 1 = its second, 0 = no overlap).
 *   3. The overlap flag is stored UNCONDITIONALLY into MARIO_HAMMER_PENDING and drives the
 *      item/score sound trigger — asserted for 64 frames on a touch, silenced on a miss.
 *      Because both writes are unconditional, a run with no overlap CLEARS a latch and a sound
 *      a previous run set. Nothing here puts the hammer in Mario's hands: the movement machine
 *      transfers MARIO_HAMMER_PENDING into the held-hammer flag once the post-landing freeze
 *      expires.
 *   4. On an overlap only, the touched record's HAMMER_IN_PLAY field is set to 1 — "this is the
 *      hammer Mario grabbed". Two readers act on that mark: the hammer-hit collision scan finds
 *      the record whose HAMMER_IN_PLAY bit is set and tests THAT record's hitbox against the
 *      board's hazards, and the hammer sprite driver reads the same bit to choose which of the
 *      pair it animates. Both therefore land on the record this routine marked.
 *
 * The mark is not sticky forever: the sprite driver clears it when the hammer's timer expires,
 * in the same act that drops the held-hammer flag, deactivates the record, parks the sprite and
 * restores the saved background tune. So the flag is SET on the touch here and CLEARED at
 * hammer expiry.
 *
 * WHAT THIS DOES NOT CLAIM: not that Mario ends up HOLDING a hammer — this only latches the
 * touch; not HOW MANY hammers a board shows (the pair is always two records, seeded from three
 * different position tables nobody has read); and not that the touch is a pickup the player
 * sees — the sound and the latch are what is established, not the on-screen event.
 *
 * LIVE-OUT: memory-only. The routine returns nothing, and the caller chain reads no register or
 * flag it leaves behind.
 */

import { MARIO_HAMMER_PENDING, SND_TRIGGER, OBJ_PAIR_6680, HAMMER_IN_PLAY } from "./names.js";
import { boardBitGate } from "./boardBitGate.js";
import { findHammerOverlappingMario } from "./findHammerOverlappingMario.js";

// Board applicability mask: bit0 25m, bit1 50m, bit3 100m — the boards a hammer can appear on
// (75m, bit2, is excluded).
const HAMMER_BOARDS = 0x0b;

// The item/score sound trigger, and how long this routine asserts it. Most writers of this
// trigger span store 3 (a brief blip); a hammer pickup holds it for 64 frames.
const PICKUP_SOUND = SND_TRIGGER + 5;
const PICKUP_SOUND_FRAMES = 64;

// Stride between the two records of the hammer pair.
const PAIR_STRIDE = 0x10;

export function latchHammerTouch(m) {
  const { regs, mem } = m;

  // Board gate — a hammer exists only on 25m/50m/100m. Closed, and nothing below happens.
  regs.a = HAMMER_BOARDS;
  if (!boardBitGate(m)) return;

  // Does Mario overlap either hammer this frame, and which one?
  findHammerOverlappingMario(m);
  const touching = regs.a; // 1 = overlapping a hammer, 0 = neither
  const matched = regs.b;  // 2 = the pair's first record, 1 = its second, 0 = no overlap

  // Latch the touch for the movement machine to consume after the landing freeze, and pulse
  // the pickup sound. Both writes are unconditional, so a miss clears whatever a touch set.
  mem.write8(MARIO_HAMMER_PENDING, touching);
  mem.write8(PICKUP_SOUND, touching ? PICKUP_SOUND_FRAMES : 0);

  // No overlap -> there is no record to select.
  if (matched === 0) return;

  // Mark the touched record as the hammer now in play, so the sprite driver animates that
  // hammer and the hammer-hit collision scan tests that record's hitbox.
  const touched = matched === 1 ? OBJ_PAIR_6680 + PAIR_STRIDE : OBJ_PAIR_6680;
  mem.write8(touched + HAMMER_IN_PLAY, 0x01);
}
