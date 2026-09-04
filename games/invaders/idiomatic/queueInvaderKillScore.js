// SPDX-License-Identifier: GPL-3.0-only
import { startSound } from "./startSound.js";
import { invaderScoreEntryPtr } from "./invaderScoreEntryPtr.js";
import { GAME_IN_PROGRESS, SCORE_ADD_PENDING, SCORE_ADD_VALUE, SCORE_ADD_VALUE_HI, loc_2062 } from "./names.js";

/**
 * queueInvaderKillScore — sound the invader-die cue and queue the killed alien's points.
 *
 * WHAT IT IS
 *   Called the instant a player shot kills an alien. When a game is in progress it fires the
 *   invader-die tone and writes the pending-score-add packet with the point value for that alien's
 *   row, so a later pass folds the points into the score. It always returns a pointer to the sprite
 *   descriptor the caller draws as the kill explosion.
 *
 * ROLE IN THE MACHINE
 *   Reached from resolvePlayerShotHit after it clears the struck alien from the grid. `b` is the
 *   alien's row/block index; invaderScoreEntryPtr clamps it to one of three consecutive point-value
 *   entries at loc_1da0 (the classic per-row scoring: bottom rows worth less, top row most). The three
 *   pending cells are the score-add packet — SCORE_ADD_VALUE (0x20f2) gets the looked-up byte,
 *   SCORE_ADD_VALUE_HI (0x20f3) is cleared, and SCORE_ADD_PENDING (0x20f1) is raised — consumed by
 *   applyPendingScoreAdd. All of this is gated on GAME_IN_PROGRESS (0x20ef) so demo kills score nothing.
 *   startSound(0x08) raises port-3 bit 3, the invader-die cue. The returned HL = loc_2062 is the
 *   sprite-descriptor cell the caller decodes (loadSpriteDescriptor) and blits as the explosion.
 *
 * ROM 0x0a5f-...  Grounding: [seen].  (loc_2062 keeps a placeholder name; its role here is read from
 *   the caller, which feeds the returned pointer to the descriptor decoder.)
 *
 * LIVE-OUT: HL = loc_2062 (also returned); on the in-game path memory + the port-3 sound latch.
 */
export function queueInvaderKillScore(m, b = m.regs.b) {
  // Only score/sound during a real game — demo (attract) kills are silent and worthless.
  if (m.mem8[GAME_IN_PROGRESS]) {
    // Fire the invader-die cue (port-3 bit 3, mask 0x08).
    startSound(m, 0x08);
    // Look up this row's point value (invaderScoreEntryPtr clamps b to one of three table slots) and
    // stage it as the pending score-add value.
    m.mem8[SCORE_ADD_VALUE] = m.mem8[invaderScoreEntryPtr(m, b)];
    // Raise the pending flag so a later applyPendingScoreAdd folds the value into the score...
    m.mem8[SCORE_ADD_PENDING] = 0x01;
    // ...and clear the high byte so the add is a single-byte value.
    m.mem8[SCORE_ADD_VALUE_HI] = 0x00;
  }
  // Always return the sprite-descriptor pointer the caller decodes and blits as the kill explosion.
  return (m.regs.hl = loc_2062);
}
