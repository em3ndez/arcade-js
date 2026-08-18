// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardBonusPoints  —  ROM 0x2673  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The reward step for landing a frog in a home bay. When the frog reaches an empty bay it pays out the
 *   bay bonus: it pops up the floating "200" score sprite over the bay, arms that sprite's on-screen
 *   countdown, and adds 200 points to the active player's score. It has a second, quieter arm: if the bay
 *   it landed on is still mid-way through a creature stamp (a gator surfacing / a fly being drawn), the
 *   award is not safe to run this frame, so it instead freezes the frog and tells its caller to abandon
 *   the rest of the home-arrival handling until next frame.
 *
 * WHERE IT SITS
 *   Called from awardHomeBayGoal (the shared five-bay goal handler) at exactly one point: after the frog
 *   is confirmed fully on the home row and the pending-slot key matches this bay — i.e. the frog landed in
 *   the very bay currently showing the fly/creature bonus. The bay's screen Y is passed in as the popup
 *   position. In the original ROM this was a CALLER-SKIP: the mirror-set arm popped the caller's return
 *   address off the stack so the caller's remaining code never ran. That stack trick is dissolved here
 *   into an ordinary boolean return — `true` means "caller, skip your remainder" — and awardHomeBayGoal
 *   honours it with `... && awardBonusPoints(m, p.bayY)) return;`.
 *
 * LIVE-OUT
 *   Memory only. On the award arm it writes the 4-byte goal-award popup record, the goal-sprite arm cell,
 *   and (through the scoring core) the score cells. On the skip arm it writes only the hold flag. It
 *   returns a boolean skip-signal to its caller and leaves no register the caller reads.
 */
import { HOME_BAY_SLOT_CURSOR_MIRROR, GOAL_AWARD_RECORD, HOME_GOAL_SPRITE_ARM_CELL, HOLD_FLAG } from "./names.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";

// The floating "200" popup is drawn from a 4-byte hardware sprite descriptor seeded into GOAL_AWARD_RECORD
// (0x805c-0x805f). In the Galaxian/Frogger sprite-descriptor byte order [Y, code, color, X], only the Y
// (byte 0) varies per bay — that is the popupPos argument — while the remaining three bytes are fixed for
// the "200" glyph. Naming the fixed bytes here keeps the four writes below self-describing.
const POPUP_SPRITE_CODE  = 0x19; // descriptor byte 1: sprite code of the "200"-points popup glyph
const POPUP_SPRITE_COLOR = 0x03; // descriptor byte 2: color attribute for the popup
const POPUP_SPRITE_X     = 0x20; // descriptor byte 3: fixed X screen position of the popup

// HOME_GOAL_SPRITE_ARM_CELL (0x8340) is a per-frame down-counter that keeps the goal-celebration popup
// alive on screen; seeding it to 0xa0 (160 frames) starts that countdown. When it later drains,
// clearFourByteCounterBlock zeros the popup record above and the sprite disappears.
const GOAL_SPRITE_ARM_COUNT = 0xa0;

// The home-bay bonus, in packed BCD: 0x20 = 200 displayed points, handed to the scoring core as its delta.
const SCORE_DELTA = 0x20;

// popupPos defaults to the Z80 B register (the ROM's calling convention): B carried the bay's screen Y at
// entry. awardHomeBayGoal passes it explicitly as p.bayY, so the default only matters to the oracle-parity
// gate, which drives the routine straight from a captured register file.
export function awardBonusPoints(m, popupPos = m.regs.b) {
  const { mem8 } = m;

  // ── Skip arm: a creature stamp is still mid-cycle in this bay ─────────────────────────
  // HOME_BAY_SLOT_CURSOR_MIRROR (0x8120) is nonzero while a home-bay creature (gator emerging/full, or the
  // bonus fly) is part-way through being stamped. Awarding on top of that half-drawn state would corrupt
  // the bay, so instead raise HOLD_FLAG (0x8004) to freeze the frog and return true — the boolean form of
  // the ROM's caller-skip — telling awardHomeBayGoal to abort the rest of the home-arrival handling and
  // retry next frame, once the stamp has settled and the mirror is clear.
  if (mem8[HOME_BAY_SLOT_CURSOR_MIRROR] !== 0) {
    mem8[HOLD_FLAG] = 0x01;
    return true;
  }

  // ── Award arm: seed the floating "200" popup sprite ──────────────────────────────────
  // The mirror is clear, so it is safe to pay out. Write the 4-byte sprite descriptor into GOAL_AWARD_RECORD
  // (0x805c-0x805f): the bay's screen Y as the popup's vertical position, then the fixed code/color/X for
  // the "200" glyph. This is what the player sees rise over the bay they just filled.
  mem8[GOAL_AWARD_RECORD]     = popupPos;           // byte 0 (Y): this bay's screen row
  mem8[GOAL_AWARD_RECORD + 1] = POPUP_SPRITE_CODE;  // byte 1 (code)
  mem8[GOAL_AWARD_RECORD + 2] = POPUP_SPRITE_COLOR; // byte 2 (color)
  mem8[GOAL_AWARD_RECORD + 3] = POPUP_SPRITE_X;     // byte 3 (X)

  // ── Arm the popup's on-screen lifetime ───────────────────────────────────────────────
  // Start the goal-celebration countdown by loading HOME_GOAL_SPRITE_ARM_CELL (0x8340) with 0xa0. The
  // collision orchestrator ticks this down every frame and clears the record above when it hits zero.
  mem8[HOME_GOAL_SPRITE_ARM_CELL] = GOAL_SPRITE_ARM_COUNT;

  // ── Pay the points ───────────────────────────────────────────────────────────────────
  // Add the 200-point (BCD 0x20) bay bonus to the active player's score through the shared scoring core
  // addScoreAndAwardExtraLife (ROM 0x08e0), which also handles the packed-BCD carry, the one-time
  // 20000-point threshold bonus, and the high-score trail.
  addScoreAndAwardExtraLife(m, SCORE_DELTA);

  // Return false: nothing to skip — awardHomeBayGoal continues on to stamp the home tiles and reset the frog.
  return false;
}
