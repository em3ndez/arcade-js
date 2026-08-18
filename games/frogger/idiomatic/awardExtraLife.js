// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardExtraLife  —  ROM 0x0a5f  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The board-completion extra-life award. Each time the player fills all five home bays and finishes a
 *   board, Frogger grants one more life: this routine bumps the active player's life count, mirrors the
 *   new total into the on-screen lives count, and drops one more marker into the vertical lives row that
 *   runs down the left edge of the play-field.
 *
 * WHERE IT SITS
 *   The tail of the board-complete finisher fillAllHomeSlotsAndAwardLife (ROM 0x0670). Once the
 *   left-to-right "all frogs home" reveal has swept a completion frog into every bay and the bays have
 *   been reset to empty, that routine calls straight here to grant the life before the next board is laid.
 *   It therefore runs exactly ONCE per completed board — not once per frame.
 *
 * LIVE-OUT
 *   Memory only. It clears one scratch flag, writes the active player's life cell, mirrors it into the
 *   shared display count, and — unless the row is already full — stamps one VRAM tile. It returns nothing
 *   and leaves no register the caller reads.
 */
import { loc_83cc, ACTIVE_PLAYER, PLAYER1_LIVES, PLAYER2_LIVES, LIVES_COUNT, LIVES_ROW_MARKER_BASE } from "./names.js";

// ACTIVE_PLAYER (0x83fd) holds the active player NUMBER: it reads 1 for player 1 and 2 for player 2.
const PLAYER_ONE = 1;

// The lives row only has room for markers down to row 15 (base + 15*0x20). Once the new count reaches 16
// no further marker is drawn. This caps the DRAWN MARKERS, not the life count itself — the count is stored
// in full above, and renderLivesRow (ROM 0x0a48) likewise clamps its redraw to 15 markers.
const MARKER_CAP = 16;

// Tile 0x4c (76) is the single-frog lives-marker glyph — the same tile renderLivesRow paints down the row.
const MARKER_TILE = 76;

// One screen row is 32 tile cells wide, so +32 (0x20) in the tilemap steps straight down one row.
const ROW_STRIDE = 32;

export function awardExtraLife(m) {
  const { mem8 } = m;

  // ── Close out the score field ─────────────────────────────────────────────────────────
  // loc_83cc (0x83cc) is the score-field-seeded scratch flag that clearAndSeedScoreField (ROM 0x0629)
  // raises to 1 when it lays out a fresh score field. Awarding the life is part of closing the board, so we
  // clear it back to 0 here (beginNextLifeOrIntro clears it the same way on a life restart). Its precise
  // role beyond "field seeded" is not fully pinned down — hence the loc_ placeholder name.
  mem8[loc_83cc] = 0;

  // ── Select the active player's life counter ───────────────────────────────────────────
  // Frogger keeps a separate life count per player: PLAYER1_LIVES (0x83b8) and PLAYER2_LIVES (0x83b9).
  // ACTIVE_PLAYER (0x83fd) says whose turn it is, so pick that player's cell to bump.
  const countCell = mem8[ACTIVE_PLAYER] === PLAYER_ONE ? PLAYER1_LIVES : PLAYER2_LIVES;

  // ── Bump the count and mirror it to the display count ─────────────────────────────────
  // Increment the player's life count, masking to a byte to reproduce the Z80's 8-bit INC wrap. Store it
  // back to that player's own cell, then mirror it into LIVES_COUNT (0x83b7) — the single live count that
  // renderLivesRow (ROM 0x0a48) and the in-play engine read for the CURRENT player.
  const count = (mem8[countCell] + 1) & 0xff;
  mem8[countCell] = count;
  mem8[LIVES_COUNT] = count;

  // ── Row full → stop before drawing a marker ───────────────────────────────────────────
  // Once the new count reaches 16 there is no row left to stamp, so leave the lives row as-is. The count
  // itself was already stored above, so a capped row never loses the life — only its marker is not drawn.
  if (count >= MARKER_CAP) return;

  // ── Stamp the new life's marker ───────────────────────────────────────────────────────
  // Drop the marker glyph (tile 0x4c) into the lives row at LIVES_ROW_MARKER_BASE (0xa85e), stepped down
  // one screen row per life (count × 0x20). So each successive life adds a marker one row further down the
  // column — visually growing the stack of lives the player has in hand.
  mem8[LIVES_ROW_MARKER_BASE + count * ROW_STRIDE] = MARKER_TILE;
}
