// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadPlayerState — make the selected player's saved level/score the current live state.  ROM 0x4644.
 *
 * Each player keeps their own saved state (level first, then the score fields the
 * HUD draws). The game plays and displays from a single SHARED slot, so switching
 * to a player means copying that player's saved copy into the shared slot; the
 * sibling routine copies it back the other way when switching away.
 *
 * The layout interleaves the copies: each saved field is a triple of adjacent bytes
 * [shared cell, player-1 copy, player-2 copy], and the five triples sit a stride of
 * three apart starting at LEVEL. Player 1's copy is one byte past the shared cell,
 * every other player's two bytes past. Which player is selected comes from
 * GAME_STATE2 (1 for player 1, 2 for player 2); callers set it before calling, so
 * the HUD redraw can load each player's score in turn.
 *
 * Touches only work RAM; hands nothing back to its caller.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4644.test.js.
 * GATE:     crafted-entry; attract never starts a game, so this is never dispatched —
 *           the gate runs it from a real captured attract state with GAME_STATE2 and
 *           both players' source blocks poked identically on both sides (player 1/2/0).
 * LIVE-OUT: memory-only — the five refreshed shared cells. The oracle's residual
 *           registers/flags are dead: callers overwrite them before reading.
 * NAMES:    LEVEL (0x8028, base of the interleaved player-state block), GAME_STATE2
 *           (0x8002, the selected-player index).
 */

import { LEVEL, GAME_STATE2 } from "./ram.js";

export function loadPlayerState(m) {
  const { mem8 } = m;

  // Player 1's saved copy is one byte past each shared cell; any other player's is two.
  const savedCopyOffset = mem8[GAME_STATE2] === 1 ? 1 : 2;

  // Copy the selected player's five saved fields into the shared slot that the HUD
  // and the difficulty/scoring code read as the current player's live state.
  for (let field = 0; field < 5; field++) {
    const sharedCell = LEVEL + field * 3;
    mem8[sharedCell] = mem8[sharedCell + savedCopyOffset];
  }
}
