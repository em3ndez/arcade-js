// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderTimeBar  —  ROM 0x0a16  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   Redraws the small "column-30" time indicator in the HUD — a vertical stack of bar-segment tiles
 *   whose height equals the active player's remaining-time count. This is NOT the big green time bar
 *   that visibly drains across the top of the play field (that lives in still-unlifted ROM code); it is
 *   the separate numeric-height indicator the ROM keeps in one tile column, one segment per unit of time.
 *
 * WHERE IT SITS
 *   A pure redraw called whenever the time total may have changed on screen: at board start from
 *   setUpBoardOrContinueLife (ROM 0x83ea path), and after the 20000-point threshold award in
 *   addScoreAndAwardExtraLife bumps the time-remaining byte (see mechanisms.md — "the extra time from
 *   the threshold award shows through renderTimeBar"). It reads state and stamps VRAM; it never advances
 *   the clock itself.
 *
 * LIVE-OUT
 *   Memory only. It writes a run of bar tiles plus one cap tile into the HUD's time column in VRAM,
 *   returns nothing, and leaves no register the caller reads. When the sentinel says the bar is
 *   disabled it falls straight through the first `return` touching nothing.
 */
import { SHARED_TIME_BYTE, TIME_REMAINING_P1, TIME_REMAINING_P2, PLAY_FLAG, ACTIVE_PLAYER, TIME_BAR_COLUMN_VRAM } from "./names.js";

// The single bar segment: tile 0x4d, drawn once per remaining-time unit up the column.
const BAR_TILE = 0x4d;

// The terminator: tile 0x10 is the blank/empty HUD tile. It caps the bar just past its top segment and,
// because the whole column is redrawn from the same base each call, blanks the one cell the bar vacates
// as the count ticks down a unit per redraw — so the indicator shrinks cleanly without leaving stragglers.
const CAP_TILE = 0x10;

// One screen row is 0x20 tile cells wide, so stepping the VRAM pointer by -0x20 moves it straight UP one
// row. The bar is drawn upward from its base cell, one segment per row.
const ROW_STRIDE = 0x20;

export function renderTimeBar(m) {
  const { mem8 } = m;

  // ── Disabled sentinel ────────────────────────────────────────────────────────────────
  // SHARED_TIME_BYTE (0x83e4) doubles as an inactive sentinel: 0xff means "there is no time bar here"
  // (modes/boards that show no clock), so we draw nothing at all. This gate is checked against the
  // SHARED byte even during play, before the per-player count is selected below.
  if (mem8[SHARED_TIME_BYTE] === 255) return;

  // ── Pick the count source ────────────────────────────────────────────────────────────
  // The bar's height is a remaining-time byte. In play (PLAY_FLAG 0x83fe non-zero) that is the ACTIVE
  // player's own counter — TIME_REMAINING_P1 (0x83e5) for player 1, TIME_REMAINING_P2 (0x83e6) for
  // player 2, chosen by ACTIVE_PLAYER (0x83fd). Outside play (attract/intro) there is no active player,
  // so the shared byte SHARED_TIME_BYTE (0x83e4) — already known non-0xff from the gate — is the source.
  let timeSource = SHARED_TIME_BYTE;
  if (mem8[PLAY_FLAG] !== 0) timeSource = mem8[ACTIVE_PLAYER] === 1 ? TIME_REMAINING_P1 : TIME_REMAINING_P2;

  // ── Draw the bar, then cap it ────────────────────────────────────────────────────────
  // Starting at the bar's base cell TIME_BAR_COLUMN_VRAM (0xabbe), stamp BAR_TILE (0x4d) `count` times,
  // walking one screen row UP (−0x20) per segment. When the loop ends `vramCell` sits one row above the
  // topmost segment; writing CAP_TILE (0x10) there terminates the bar (and blanks the cell just vacated
  // when the count shrank by one since the previous redraw).
  let count = mem8[timeSource];
  let vramCell = TIME_BAR_COLUMN_VRAM;
  while (count-- > 0) {
    mem8[vramCell] = BAR_TILE;
    vramCell -= ROW_STRIDE;
  }
  mem8[vramCell] = CAP_TILE;
}
