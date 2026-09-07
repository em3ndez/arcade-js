// SPDX-License-Identifier: GPL-3.0-only
//
// clearAndRedrawScoreField (ROM 0x21fe) -- [seen]
//
// WHAT IT IS
//   Zero one packed-BCD score field selected by index, plus a companion scratch byte, then repaint it
//   on screen. It is command-queue channel 4 (the score-clear handler): a caller enqueues it with a
//   field index and the drain runs it later.
//
// ROLE IN THE MACHINE
//   Three score fields exist, each three packed-BCD digit bytes:
//     index 0 -> PLAYER1_SCORE_BCD (0x40a2), companion PLAYER1_BONUS_MARKER_AWARDED (0x40ad)
//     index 1 -> PLAYER2_SCORE_BCD (0x40a5), companion PLAYER2_BONUS_MARKER_AWARDED (0x40ae)
//     index 2 -> HIGH_SCORE_BCD  (0x40a8), which has no separate scratch so it re-zeros its own byte 0
//   The per-player companion is that player's one-shot bonus-marker flag, cleared here so a new round
//   re-arms the extra-life award. After zeroing, it repaints through drawScoreFieldByIndex (channel 5).
//   An index of 3 or more DESCENDS: it recurses over every lower field from index-1 down to 0, which is
//   exactly how round start (startGameRoundAndClearScores) wipes both players' scores in one command.
//   Default arg mirrors the register convention (A carries the index).
//
// LIVE-OUT: the selected field's three digit bytes + companion zeroed; the field repainted to VRAM.
import { drawScoreFieldByIndex } from "./drawScoreFieldByIndex.js";
import { u8 } from "../../../core/int.js";
import { PLAYER1_SCORE_BCD, PLAYER2_SCORE_BCD, HIGH_SCORE_BCD, PLAYER1_BONUS_MARKER_AWARDED, PLAYER2_BONUS_MARKER_AWARDED } from "./names.js";

export function clearAndRedrawScoreField(m, index = m.regs.a) {
  const { mem8 } = m;

  // Index >= 3 is the "clear all" sweep: recurse over fields index-1, index-2, ... down to 0, each
  // handled by the single-field path below. The 8-bit decrement matches the ROM's byte counter.
  if (index >= 3) {
    let i = index;
    for (;;) {
      i = u8(i - 1);
      clearAndRedrawScoreField(m, i);
      if (i === 0) return;
    }
  }

  // Single field: resolve the score base and the companion scratch cell to zero alongside it.
  // Players clear their bonus-marker flag; the high score has no separate flag, so scratch aliases
  // its own first byte (harmless -- byte 0 is zeroed below regardless).
  let base, scratch;
  if (index === 0) { base = PLAYER1_SCORE_BCD; scratch = PLAYER1_BONUS_MARKER_AWARDED; }
  else if (index === 1) { base = PLAYER2_SCORE_BCD; scratch = PLAYER2_BONUS_MARKER_AWARDED; }
  else { base = HIGH_SCORE_BCD; scratch = HIGH_SCORE_BCD; }

  // Zero the three packed-BCD digit bytes and the companion scratch cell.
  mem8[base] = 0;
  mem8[base + 1] = 0;
  mem8[base + 2] = 0;
  mem8[scratch] = 0;

  // Repaint the now-zeroed field in place (channel-5 field painter).
  return drawScoreFieldByIndex(m, index);
}
