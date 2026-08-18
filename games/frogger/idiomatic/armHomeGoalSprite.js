// SPDX-License-Identifier: GPL-3.0-only
/**
 * armHomeGoalSprite  —  ROM 0x27cb  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The "goal celebration sprite" trigger. When the frog reaches one of the five home bays at the top
 *   of the board, this routine paints a fresh sprite descriptor for the bonus/goal graphic that briefly
 *   flashes at that bay, and arms a countdown that keeps the sprite on screen for a fixed span. It does
 *   NOT drive the fly bonus (that is driveFlyPatrol / animateFlyEatCollision) — it reuses the same
 *   physical sprite block for a different, one-shot "you made it home" flourish.
 *
 * WHERE IT SITS
 *   Called from the home-arrival handler awardHomeBayGoal (see mechanisms.md "The home bays"): the last
 *   thing that handler does, when a collision/eat was latched (COLLISION_SUBFLAG 0x8134 nonzero) at the
 *   instant the frog reached the bay, is arm this celebration sprite and clear the sub-flag. The single
 *   live-in is the lead byte, which the caller passes in register Z80 B — the bay's screen Y row. The
 *   five real caller values are 0x18, 0x48, 0x78, 0xa8, 0xd8, i.e. the five home bays spaced 0x30 apart.
 *
 *   The sprite it arms is torn down elsewhere: the master collision orchestrator
 *   orchestrateCollisionsAndFrogInput (0x1a55) ticks the arm cell HOME_GOAL_SPRITE_ARM_CELL (0x8340)
 *   down one per frame, and when it drains to 0, clearFlySpriteBlock (0x27de) zeroes the four-cell block.
 *   So this routine only ARMS; the countdown and the clear are somebody else's job.
 *
 * LIVE-OUT
 *   Memory only — five RAM writes and nothing else. It returns no value and leaves no register the
 *   caller reads (all five callers do `xor a` right after the call). The four descriptor cells are later
 *   consumed by the sprite-DMA shadow blit (copied to OBJRAM at 0xb040 so the video hardware draws them).
 */
import { FLY_SPRITE_X, HOME_GOAL_SPRITE_ARM_CELL } from "./names.js";

// The three fixed descriptor bytes written after the lead byte, filling the rest of the four-cell
// fly/goal sprite block FLY_SPRITE_X..+3 (0x8040-0x8043). Per mechanisms.md the block is laid out as
// {lead, code, color, byte3}, so these name the sprite's graphic and palette for the goal flourish:
const SPRITE_CODE = 25; // 0x19 -> FLY_SPRITE_CODE (0x8041): which sprite tile to draw
const SPRITE_COLOR = 3; //        -> color cell        (0x8042): its palette
const SPRITE_BYTE3 = 16; // 0x10 -> the fourth cell   (0x8043): trailing descriptor byte

// Value loaded into the arm cell HOME_GOAL_SPRITE_ARM_CELL (0x8340). It is a down-counter, so 160 (0xa0)
// is how many frames the goal sprite stays armed before the orchestrator's tick drains it and the block
// is cleared. mechanisms.md records this exact value ("arms ... to 160" / "= 0xa0").
const ARM_COUNTDOWN = 160;

export function armHomeGoalSprite(m, leadByte = m.regs.b) {
  const { mem8 } = m;

  // ── Stamp the four-cell sprite descriptor ─────────────────────────────────────────────
  // Write the whole fly/goal sprite block FLY_SPRITE_X..+3 (0x8040-0x8043) in one go. The lead byte is
  // the caller's argument — the home bay's Y position, delivered in register B (defaulted above) — and
  // positions the goal graphic on the bay the frog just filled. The remaining three cells are the fixed
  // {code, color, byte3} tail, so the same descriptor shape is stamped for every bay; only the lead byte
  // (the row) varies. This overwrites whatever the shared block last held (the fly patrol also lives
  // here), which is why the goal sprite fully re-specifies all four cells rather than trusting leftovers.
  mem8[FLY_SPRITE_X] = leadByte;
  mem8[FLY_SPRITE_X + 1] = SPRITE_CODE;
  mem8[FLY_SPRITE_X + 2] = SPRITE_COLOR;
  mem8[FLY_SPRITE_X + 3] = SPRITE_BYTE3;

  // ── Arm the on-screen countdown ───────────────────────────────────────────────────────
  // Load HOME_GOAL_SPRITE_ARM_CELL (0x8340) with the ARM_COUNTDOWN so the sprite is "live". From here
  // the orchestrator (0x1a55) decrements this cell every frame; while it is nonzero the DMA blit keeps
  // copying the block to OBJRAM and the player sees the goal flourish, and when it hits 0
  // clearFlySpriteBlock (0x27de) wipes the block, ending the display. Must be written LAST: it is the
  // signal that the descriptor above is valid and ready to draw.
  mem8[HOME_GOAL_SPRITE_ARM_CELL] = ARM_COUNTDOWN;
}
