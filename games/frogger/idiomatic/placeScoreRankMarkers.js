// SPDX-License-Identifier: GPL-3.0-only
/**
 * placeScoreRankMarkers  —  ROM 0x0c3d  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The "your rank" marker stamper for the attract-mode SCORE RANKING screen. When a game ends, each
 *   player's final score is ranked against the high-score table and gets a small rank *code*; this routine
 *   turns those two codes into two on-screen position markers. It does not draw any numeral — the rank is
 *   encoded purely as *which row* receives the constant marker tile. Nothing is stamped for a player who
 *   did not place (rank code 0).
 *
 * WHERE IT SITS
 *   Called once per screen build from renderMode3ScoreRankingScreen (ROM 0x0bb3), which paints the whole
 *   mode-3 attract ranking screen (FROGGER logo, "SCORE RANKING" header, the five ranked high scores). Its
 *   input is produced upstream at new-game init by packScoreRankPair (ROM 0x0f69): that routine ranks both
 *   players' final scores and packs the two resulting rank codes into the field this routine reads. So the
 *   data flow is:  packScoreRankPair (writes) → placeScoreRankMarkers (reads + stamps) → screen shows the
 *   two markers.
 *
 *   The actual byte-poke is delegated to the shared row helper loc_0c4a (ROM 0x0c4a): given a page, a row
 *   base, an offset (the rank code) and a value, it writes the value into RAM at page(base − offset), and
 *   writes nothing when the offset is 0. This routine simply invokes it twice — once per rank code.
 *
 * LIVE-OUT
 *   Memory only. It returns nothing and leaves no register the caller reads. Its whole observable effect is
 *   at most two single-byte writes into work-RAM page 0x80 (one per nonzero rank code).
 */
import { INTRO_DIGIT_FIELD } from "./names.js";
import { loc_0c4a } from "./loc_0c4a.js";

// The three fixed arguments this routine feeds to the row helper loc_0c4a on both passes. They map to the
// helper's H / D / E parameters respectively; only the rank code (the helper's C/offset) changes per pass.
const RAM_PAGE = 0x80;    // H: the work-RAM page the markers land in (0x80xx), NOT a tilemap/VRAM page
const ROW_BASE = 48;      // D: 0x30 — the row the offset is subtracted from, so a code lands at 0x80(48 − code)
const MARKER_TILE = 4;    // E: 0x04 — the constant marker byte stamped to mark a rank slot

export function placeScoreRankMarkers(m) {
  // ── Read the packed rank pair ─────────────────────────────────────────────────────────
  // INTRO_DIGIT_FIELD (0x83fb) is a two-byte cell holding both players' rank codes, packed by
  // packScoreRankPair (0x0f69): the larger score's code in the low byte (0x83fb), the smaller score's code
  // in the high byte (0x83fc). One 16-bit read fetches both at once (little-endian, so low byte = 0x83fb).
  const rankPair = m.mem16[INTRO_DIGIT_FIELD];
  const largerScoreRank = rankPair & 0xff;   // low byte 0x83fb — the higher-scoring player's rank code
  const smallerScoreRank = rankPair >> 8;    // high byte 0x83fc — the lower-scoring player's rank code

  // ── Pass 1: stamp the higher-scoring player's marker ──────────────────────────────────
  // Hand the code to loc_0c4a as its offset (C). For a nonzero code the helper writes MARKER_TILE into
  // RAM at 0x80(ROW_BASE − code) — a nonzero rank picks a distinct row, so the marker's *position* encodes
  // the rank. A code of 0 means "did not place," and the helper's C==0 skip leaves that slot untouched.
  loc_0c4a(m, largerScoreRank, ROW_BASE, RAM_PAGE, MARKER_TILE);

  // ── Pass 2: stamp the lower-scoring player's marker ───────────────────────────────────
  // Identical treatment for the high byte. In one-player and no-placement cases this code is often 0, so
  // this pass frequently writes nothing — matching the ROM, which unconditionally calls the helper twice
  // and lets the helper's own guard decide whether a byte lands.
  loc_0c4a(m, smallerScoreRank, ROW_BASE, RAM_PAGE, MARKER_TILE);
}
