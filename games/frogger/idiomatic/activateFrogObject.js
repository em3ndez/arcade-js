// SPDX-License-Identifier: GPL-3.0-only
/**
 * activateFrogObject  —  ROM 0x0804  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The "spawn the frog" primitive. When a board is laid out it puts the frog object into its
 *   start-of-life state: marks the object ACTIVE and zeroes the two sub-fields that carry the frog's
 *   sprite code and its vertical row, so the next frog appears clean at its spawn origin rather than
 *   inheriting whatever the previous frog left behind. In a two-player game — and only then — it also
 *   seeds the frog's pair of 16-bit timers to a fixed start-of-life count.
 *
 * WHERE IT SITS
 *   Called from initInPlayBoardOnce (0x0d4c), the once-per-board in-play layout pass, as one link in its
 *   lane/object/field setup chain (loadActivePlayerLaneParams → activateFrogObject → fillTilemapBlock28x32
 *   → clearObjectBlocksAndMirrorToObjRam). It runs once when a fresh board is built, not per frame.
 *
 * LIVE-OUT
 *   Memory only. It writes at most five cells (three object bytes, plus two timer words in two-player) and
 *   returns nothing; no register or flag survives for the caller to read.
 */
import { FROG_X, FROG_SPRITE_CODE, FROG_Y, PLAY_FLAG, FROG_TIMER_A, FROG_TIMER_B } from "./names.js";

// PLAY_FLAG (0x83fe) encodes the session kind: 0 = attract/not in play, 1 = one-player game, 2 = two.
// Only value 2 (a two-player game) takes the timer-seeding tail below.
const TWO_PLAYER = 2;

// Start-of-life seed for both frog timers (0x40). See the timer step below for what FROG_TIMER_A drives.
const TIMER_INIT = 64;

export function activateFrogObject(m) {
  const { mem8, mem16 } = m;

  // ── Mark the frog object ACTIVE ──────────────────────────────────────────────────────
  // FROG_X (0x8044) is the base byte of the frog object block and doubles as the frog's game-space X.
  // Storing 1 here is the "object is live" mark that resetFrogObject and the lane-scan move dispatcher
  // key off — the value 1 (rather than a real X) is the activation sentinel; the frog's true spawn X is
  // written later by the reseed/reset path.
  mem8[FROG_X] = 1;

  // ── Clear the sprite code ────────────────────────────────────────────────────────────
  // FROG_SPRITE_CODE (0x8045) holds the tile/sprite code the river-ride and move handlers later stamp
  // with the frog's ride/move/home graphic. Zeroing it here drops any stale graphic from the last life.
  mem8[FROG_SPRITE_CODE] = 0;

  // ── Clear the row / Y ────────────────────────────────────────────────────────────────
  // FROG_Y (0x8047) is the frog's game-space vertical position (E0 = bottom start row, 40 = home row).
  // Zeroing it resets the object's Y sub-field; the spawn/reseed path parks the frog at its real start Y.
  mem8[FROG_Y] = 0;

  // ── Gate: only a two-player game seeds the timers ────────────────────────────────────
  // In a one-player game (PLAY_FLAG == 1) or attract (0) we are done after the three object bytes above.
  // Only a two-player game (PLAY_FLAG 0x83fe == 2) falls through to seed the frog timers.
  if (mem8[PLAY_FLAG] !== TWO_PLAYER) return;

  // ── Seed the two 16-bit frog timers ──────────────────────────────────────────────────
  // FROG_TIMER_A (0x83d2) is the per-life hold-off timer the in-play service counts down: while it is
  // non-zero the service runs only the minimal world step (lane motion + frame buffer) and holds off the
  // full gameplay/collision cascade, which begins only once the timer reaches 0. Seeding it to 0x40 here
  // gives the freshly-spawned two-player frog a brief settle-in grace before the board goes fully live.
  // FROG_TIMER_B (0x83da) is its companion word, seeded to the same count on the same two-player path.
  // Both are 16-bit, so they use mem16 (a word write, not a byte).
  mem16[FROG_TIMER_A] = TIMER_INIT;
  mem16[FROG_TIMER_B] = TIMER_INIT;
}
