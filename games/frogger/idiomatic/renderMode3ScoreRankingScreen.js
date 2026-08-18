// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderMode3ScoreRankingScreen  —  ROM 0x0bb3  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The one-call painter for the attract-mode "SCORE RANKING" screen — the page that cycles in the demo
 *   showing the FROGGER logo, a "SCORE RANKING" header, the five ranked high scores each followed by
 *   " PTS", and the "KONAMI 1981" footer. It is GAME_MODE 3 of the intro/attract sequence. In one pass it
 *   (1) steps the attract pacing machinery, (2) lays a blank background, (3) wipes leftover demo objects,
 *   (4) stamps the "your rank" markers, (5) blits the header, and (6) draws five rows of "rank digit +
 *   fixed strip + high-score field + ' PTS'", then falls through into the shared final-strip tail.
 *
 * WHERE IT SITS
 *   The mode-3 arm of the attract state machine. dispatchGameModeFrame (ROM 0x0d11) calls it to build the
 *   ranking page the first time mode 3 is entered; on later frames the page holds and only its tail,
 *   blitMode3FinalStrip (0x0c17), re-runs. It does not run during ordinary play, so its equivalence test
 *   drives it over crafted machine states rather than a captured live dispatch.
 *
 *   Its data source is the high-score table maintained upstream: packScoreRankPair (0x0f69) ranks both
 *   players' final scores at new-game init and records the results, insertHighScoreEntry (0x0a84) keeps
 *   the descending five-entry key table this routine reads, and placeScoreRankMarkers (below) turns the
 *   packed rank codes into the on-screen "you placed here" markers.
 *
 * LIVE-OUT
 *   Memory only. It writes VRAM tile cells (the whole ranking page) plus a handful of attract work cells
 *   it resets. It returns whatever blitMode3FinalStrip returns (nothing the caller reads); the tail-return
 *   exists so that tail's memory effects are part of this call.
 */
import { ATTRACT_DEMO_PHASE_COUNTER, POINT_TABLE_DRAW_STATE, START_LATCH, OBJECT_ANIM_STATE_8019, OBJECT_ANIM_STATE_801F, HIGH_SCORE_TABLE_BASE, SCORE_RANKING_HEADER_STRIP, PTS_SUFFIX_STRIP, SCORE_DISPLAY_VRAM_PAGE, SCORE_RANKING_RANK_DIGIT_VRAM_PAGE, SCORE_RANKING_HEADER_DST } from "./names.js";
import { fillTilemapBlock22x32 } from "./fillTilemapBlock22x32.js";
import { placeScoreRankMarkers } from "./placeScoreRankMarkers.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";
import { writeScoreField } from "./writeScoreField.js";
import { blitMode3FinalStrip } from "./blitMode3FinalStrip.js";

// Lengths of the three ROM tile strips this screen blits, in tiles (each is a DJNZ loop count in the ROM).
const HEADER_LEN = 0x0d;     // 13-tile "SCORE RANKING" header strip (SCORE_RANKING_HEADER_STRIP, 0x2ee5)
const RANK_STRIP_LEN = 0x03; // 3-tile fixed strip drawn beside each rank digit; five of them run back-to-back in ROM
const SCORE_STRIP_LEN = 0x04; // 4-tile " PTS" suffix drawn after each score field (PTS_SUFFIX_STRIP, 0x2fba)

// Low-byte base of each of the two per-rank VRAM columns. The column address is (page | ((2*rank + base) &
// 0xff)); the "+2 per rank" walks one rank-row down the screen, and the base positions rank 1's row. For
// ranks 1..5 the 8-bit add never actually wraps (rank 5 gives 0xd7 / 0xf7); the & 0xff mirrors the ROM's
// 8-bit arithmetic exactly.
const RANK_DIGIT_COL_BASE = 0xcd; // rank-digit column, page SCORE_RANKING_RANK_DIGIT_VRAM_PAGE (0xaa00)
const SCORE_FIELD_COL_BASE = 0xed; // score-field column, page SCORE_DISPLAY_VRAM_PAGE (0xa900)

export function renderMode3ScoreRankingScreen(m) {
  const { mem8 } = m;

  // ── Step 1: reset the attract pacing machinery ───────────────────────────────────────
  // These three cells pace the intro/attract sequence and gate the START buttons; the mode-3 draw resets
  // them so the screen dwells and hands off cleanly.
  //   • POINT_TABLE_DRAW_STATE (0x83d8) is the shared attract frame-pacing / drawn-state gate. Stepping it
  //     down one is this frame's tick of the intro pacer: per the NMI's attract arm, when this gate drains
  //     to 0 AND the phase counter below is 0, GAME_MODE steps down and advances the sequence.
  //   • ATTRACT_DEMO_PHASE_COUNTER (0x83d7) is that phase counter; zeroing it arms the "advance" condition.
  //   • START_LATCH (0x83b3) is the start-already-latched flag; clearing it re-arms START-button reading so
  //     a coin/START can pull out of attract.
  mem8[POINT_TABLE_DRAW_STATE] = mem8[POINT_TABLE_DRAW_STATE] - 1;
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = 0;
  mem8[START_LATCH] = 0;

  // ── Step 2: lay the blank canvas ─────────────────────────────────────────────────────
  // Flood-fill a 22×32 block of the tilemap with the blank background tile 0x10 (from VRAM 0xa808). This
  // narrower-than-play-area fill is the empty page onto which the header, ranks, and scores are stamped.
  fillTilemapBlock22x32(m);

  // ── Step 3: wipe leftover attract-demo objects off the page ──────────────────────────
  // OBJECT_ANIM_STATE_8019 (0x8019) is a work cell in the 0x800d–0x801f object/animation block; the mode-3
  // draw seeds it = 3 (a work value, not a screen id). Then five cells at a stride of 4, based at
  // OBJECT_ANIM_STATE_801F (0x801f) — 0x801f/0x8023/0x8027/0x802b/0x802f — are zeroed to clear any demo
  // objects still parked in that block so they do not bleed onto the ranking screen.
  mem8[OBJECT_ANIM_STATE_8019] = 3;
  for (let cellAddr = OBJECT_ANIM_STATE_801F, i = 0; i < 5; i++, cellAddr += 4) mem8[cellAddr] = 0;

  // ── Step 4: stamp the "your rank" markers ────────────────────────────────────────────
  // For each player who placed on the high-score table, drop the constant marker tile at the row matching
  // that player's rank code (produced upstream by packScoreRankPair). Rank is encoded as position, not a
  // drawn numeral; a player who did not place stamps nothing.
  placeScoreRankMarkers(m);

  // ── Step 5: blit the "SCORE RANKING" header ──────────────────────────────────────────
  // Copy the 13-tile header strip (SCORE_RANKING_HEADER_STRIP, 0x2ee5) up the VRAM column
  // SCORE_RANKING_HEADER_DST (0xaaac). copyRunUpTileColumn walks the destination up one tilemap row (32
  // cells) per tile — the Galaxian-derived display stores a column as a run of cells 32 apart.
  copyRunUpTileColumn(m, SCORE_RANKING_HEADER_DST, SCORE_RANKING_HEADER_STRIP, HEADER_LEN);

  // The five per-rank 3-tile strips form one continuous ROM run immediately after the header strip. Start a
  // source cursor at the first of them and advance it 3 tiles per rank as the loop consumes them in order.
  let stripSrc = SCORE_RANKING_HEADER_STRIP + HEADER_LEN;

  // ── Step 6: draw the five ranked rows ────────────────────────────────────────────────
  // Each row is: the rank numeral, a fixed 3-tile strip beside it, the rank's high score, and a " PTS"
  // suffix — laid down at the rank's own row of the two side-by-side VRAM columns.
  for (let rank = 1; rank <= 5; rank++) {
    // Stamp the rank numeral (1..5). writeScoreDigitStepUp draws the digit whose glyph IS its value (the
    // char ROM lays tiles 0..9 out as the numerals) into the rank-digit column, then hands back the write
    // pointer stepped one cell past the digit so the strip below chains straight onto it.
    const rankPtr = writeScoreDigitStepUp(m, rank, SCORE_RANKING_RANK_DIGIT_VRAM_PAGE | ((2 * rank + RANK_DIGIT_COL_BASE) & 0xff));

    // Blit this rank's fixed 3-tile strip up from where the digit left off, then advance the ROM cursor to
    // the next rank's strip.
    copyRunUpTileColumn(m, rankPtr, stripSrc, RANK_STRIP_LEN);
    stripSrc += RANK_STRIP_LEN;

    // Read rank r's 16-bit packed-BCD high score from the descending table HIGH_SCORE_TABLE_BASE (0x83f1,
    // spanning 0x83f1..0x83fa): word r lives at base + 2*(r-1), little-endian (low byte then high byte).
    const scoreWordAddr = HIGH_SCORE_TABLE_BASE + 2 * (rank - 1);
    const score = mem8[scoreWordAddr] | (mem8[scoreWordAddr + 1] << 8);

    // Draw that score as a 5-cell field (four BCD digits plus the always-"0" ones place) in the score
    // column, and take back the pointer stepped past the field for the suffix.
    const fieldPtr = writeScoreField(m, score, SCORE_DISPLAY_VRAM_PAGE | ((2 * rank + SCORE_FIELD_COL_BASE) & 0xff));

    // Blit the shared 4-tile " PTS" suffix up from the end of the score field.
    copyRunUpTileColumn(m, fieldPtr, PTS_SUFFIX_STRIP, SCORE_STRIP_LEN);
  }

  // ── Step 7: fall through into the shared final-strip tail ────────────────────────────
  // blitMode3FinalStrip (0x0c17) is the closing brushstroke shared with the per-frame mode-3 path: it
  // zeros the mode-3 strip-state cell and blits the 15-tile final strip up VRAM column 0xaafc. Tail-return
  // so its memory effects belong to this call (in the ROM this is a straight fall-through, not a call).
  return blitMode3FinalStrip(m);
}
