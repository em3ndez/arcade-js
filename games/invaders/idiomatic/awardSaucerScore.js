// SPDX-License-Identifier: GPL-3.0-only
import { SCORE_ADD_PENDING, SAUCER_SCORE_KEY_PTR, SAUCER_SCORE_KEY_TABLE, SAUCER_SCORE_SPRITE_TABLE, loc_2087, SCORE_ADD_VALUE } from "./names.js";
import { resolveSpriteScreenAddr } from "./resolveSpriteScreenAddr.js";
import { drawThreeSprites } from "./drawThreeSprites.js";

/**
 * awardSaucerScore — pay out the mystery-ship (flying-saucer) bonus when it is shot down.
 *
 * WHAT IT IS
 *   When the player destroys the saucer, the game must both credit a score and paint the point value
 *   (100 / 150 / 300...) at the spot where the saucer died. This routine does the score-side half: it
 *   queues the score-add, looks up which score belongs to this saucer kill, and draws the three-glyph
 *   score number on screen.
 *
 * ROLE IN THE MACHINE
 *   The saucer's payout is not fixed — it is keyed off a rolling counter so the value cycles. A pointer
 *   cell SAUCER_SCORE_KEY_PTR (0x208d) holds the address of the current "key" byte; the key selects one
 *   of the entries in the parallel tables SAUCER_SCORE_KEY_TABLE (0x1d4c, the keys) and
 *   SAUCER_SCORE_SPRITE_TABLE (0x1d50, the matching score-sprite ids). This routine raises the pending-
 *   score flag SCORE_ADD_PENDING (0x20f1) so the main loop's applyPendingScoreAdd folds the value into
 *   the running total, stamps the matched sprite id into the saucer sprite record loc_2087 (0x2087),
 *   stores key*16 as the actual point value in SCORE_ADD_VALUE (0x20f2), and hands off to the draw path
 *   (resolveSpriteScreenAddr -> drawThreeSprites) to render the number. Reached by `jz 0x070c` from the
 *   saucer handler (0x0682) when its countdown cell hits 0x18.
 *
 * ROM 0x070c-0x073b.  Grounding: [seen].
 *
 * LIVE-OUT: HL / DE / C, inherited from the drawThreeSprites -> drawSpriteList tail.
 */
export function awardSaucerScore(m) {
  // Raise the pending-score flag: a later main-loop pass (applyPendingScoreAdd) will BCD-add the value
  // seeded below into the active player's score accumulator.
  m.mem8[SCORE_ADD_PENDING] = 1;

  // Read the current score key. SAUCER_SCORE_KEY_PTR (0x208d) is a 16-bit pointer cell (little-endian);
  // dereferencing it once gives the address of the live key byte, and reading there gives the key value.
  const key = m.mem8[m.mem16[SAUCER_SCORE_KEY_PTR]];

  // Parallel-table lookup: walk the key table and the sprite table in lockstep (up to four entries)
  // until the key table's byte equals `key`. `entry` then points at the matching score-sprite id.
  let entry = SAUCER_SCORE_SPRITE_TABLE;
  let probe = SAUCER_SCORE_KEY_TABLE;
  let count = 0x04;
  while (m.mem8[probe] !== key) {
    entry += 1;
    probe += 1;
    count -= 1;
    if (count === 0) break;
  }

  // Stamp the matched score-sprite id into the saucer sprite record (loc_2087) so the draw path below
  // renders the correct point-value glyphs.
  m.mem8[loc_2087] = m.mem8[entry];

  // Store the actual point value as key*16 (key << 4) into the 16-bit SCORE_ADD_VALUE (0x20f2/0x20f3);
  // this is the number applyPendingScoreAdd will add to the score.
  m.mem16[SCORE_ADD_VALUE] = key << 4;

  // Fold the saucer sprite record into a screen address (loads its descriptor + coordToScreenAddr)...
  resolveSpriteScreenAddr(m);

  // ...then blit the three-glyph score number at that screen position.
  return drawThreeSprites(m);
}
