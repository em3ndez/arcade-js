// SPDX-License-Identifier: GPL-3.0-only
/**
 * redrawScoreHud — repaint both players' on-screen score displays, draw the status
 * label, and tint the two HUD colour columns.  ROM 0x472c.
 *
 * The score-HUD refresh, invoked from the title/round-transition redraw. It sweeps
 * both player slots and then, for the active player, draws the status label and the
 * HUD colour columns:
 *   - For player 1 then player 2: copy that player's saved state into the shared
 *     display slot, repaint its four score digits, and blank the two cells directly
 *     above that player's score column (so stale digits above the score are cleared).
 *   - Reselect the active player and re-copy its state into the shared slot, so later
 *     HUD work sees the live player again.
 *   - From the player count, draw the status label: one or two players get the in-game
 *     status panel; otherwise — no players (the game-over screen) or three or more —
 *     the "GAME OVER" label.
 *   - Tint colour 2 up two HUD colour columns, bottom cell upward, one screen row (32
 *     cells) apart: nine cells in the first column, ten in the second.
 *
 * Sibling idiomatic files consistently describe this as "the HUD redraw" that
 * "repaints both players' score displays", which is exactly what the code does, so it
 * earns an English name rather than its address.
 *
 * Memory-equivalent to the frozen oracle — equivalence-472c.test.js.
 * GATE:     real captured attract dispatch (the game-over / player-count-0 arm, which
 *           draws the "GAME OVER" label) + a crafted player-count-1 entry that forces
 *           the in-game-panel arm; oracle vs idiomatic diffed on clones for whole RAM +
 *           pc + SP. Teeth: a wrong blank offset and a wrong HUD colour.
 * LIVE-OUT: memory-only — both players' repainted score digits, the blanked cells, the
 *           status label, and the two tinted colour columns. Every caller reloads its
 *           registers right after the call, so the residual register file (and the
 *           transient stack return-slots) are dead. pc + SP still match: the routine
 *           returns to its still-oracle caller through the balanced stack.
 * NAMES:    GAME_MODE (0x8001), GAME_STATE2 (0x8002) from ram.js. Hex-kept: 0x8028 is
 *           the shared display slot; 0x4644 is the still-oracle state-copy callee (and
 *           its stack return slots are call linkage); 0x8ba1 / 0x8961 are the two HUD
 *           colour-column bottom cells.
 */

import { drawScoreDigits } from "./drawScoreDigits.js";
import { drawGameOverLabel } from "./drawGameOverLabel.js";
import { loc_47e1 } from "./loc_47e1.js";
import { GAME_MODE, GAME_STATE2 } from "./ram.js";

// One screen row = 32 cells across the 32-wide tile/colour map.
const ROW = 32;

// The status label is picked from the player count: one or two players get the
// in-game panel, any other count the "GAME OVER" label.
const HUD_COLOUR = 2;
const FIRST_COLUMN_BOTTOM = 0x8ba1;
const FIRST_COLUMN_CELLS = 9;
const SECOND_COLUMN_BOTTOM = 0x8961;
const SECOND_COLUMN_CELLS = 10;

export function redrawScoreHud(m) {
  const { mem8 } = m;

  // Copy a selected player's saved state into the shared display slot at 0x8028.
  // 0x4644 is still the frozen oracle, so it returns through the stack — hand it its
  // own return slot (dead scratch that a later push overwrites).
  const copySelectedPlayerState = (returnSlot) => {
    m.push16(returnSlot);
    m.call(0x4644);
  };

  // Remember the active player; the per-player sweep reselects each slot in turn.
  const activePlayer = mem8[GAME_STATE2];

  // Player 1 then player 2: refresh the score column and clear the cells above it.
  for (const [player, stateCopyReturn] of [[1, 0x4738], [2, 0x474b]]) {
    mem8[GAME_STATE2] = player;
    copySelectedPlayerState(stateCopyReturn);
    drawScoreDigits(m); // repaint the four digits; hands the score-column base back in ix
    const columnBase = m.regs.ix;
    mem8[columnBase - ROW] = 0; // blank the cell one row above the score
    mem8[columnBase - 2 * ROW] = 0; // and the cell two rows above
  }

  // Reselect the active player and re-copy its state for the downstream HUD work.
  mem8[GAME_STATE2] = activePlayer;
  copySelectedPlayerState(0x475d);

  // Draw the status label from the player count. Both label routines are idiomatic but
  // tail-return through the stack (their leaf helpers are still the oracle), so each is
  // handed the return slot the oracle would push for it.
  const players = mem8[GAME_MODE];
  if (players === 1 || players === 2) {
    m.push16(0x4768);
    loc_47e1(m); // in-game status panel
  } else {
    m.push16(0x476d);
    drawGameOverLabel(m); // "GAME OVER" label
  }

  // Tint colour 2 up the two HUD colour columns, bottom cell upward, one row apart.
  let cell = FIRST_COLUMN_BOTTOM;
  for (let i = 0; i < FIRST_COLUMN_CELLS; i++) {
    mem8[cell] = HUD_COLOUR;
    cell -= ROW;
  }
  cell = SECOND_COLUMN_BOTTOM;
  for (let i = 0; i < SECOND_COLUMN_CELLS; i++) {
    mem8[cell] = HUD_COLOUR;
    cell -= ROW;
  }

  // Return to the still-oracle caller through the balanced stack.
  m.ret();
}
