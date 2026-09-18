// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadPlayerState — make the selected player's saved level/score the current live state.
 *
 * Each player keeps a saved copy of five fields (level, then the score fields the HUD draws), but
 * the game plays from one shared slot; this copies the selected player's copy into that slot (a
 * sibling copies it back when switching away). The fields interleave as triples [shared, player-1,
 * player-2] a stride of three apart from LEVEL, so player 1's copy sits one byte past each shared
 * cell and any other player's two. ACTIVE_PLAYER (1 or 2) selects; callers set it beforehand.
 */

import { LEVEL, ACTIVE_PLAYER } from "./names.js";

export function loadPlayerState(m) {
  const { mem8 } = m;

  // Player 1's saved copy is one byte past each shared cell; any other player's is two.
  const savedCopyOffset = mem8[ACTIVE_PLAYER] === 1 ? 1 : 2;

  // Copy the selected player's five saved fields into the shared slot that the HUD
  // and the difficulty/scoring code read as the current player's live state.
  for (let field = 0; field < 5; field++) {
    const sharedCell = LEVEL + field * 3;
    mem8[sharedCell] = mem8[sharedCell + savedCopyOffset];
  }
}
