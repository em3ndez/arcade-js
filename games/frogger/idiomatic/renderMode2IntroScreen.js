// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderMode2IntroScreen  —  ROM 0x2d88  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   Builds the mode-2 intro/attract screen in a single call — the "FROGGER" title page the machine shows
 *   as one step of its attract cycle. It arms the intro pacing gate, wipes the play field to blank, seeds
 *   a handful of intro work counters, and blits the title tile strip. On the low starting-time variant it
 *   also stamps one time digit and three further title strips.
 *
 * WHERE IT SITS
 *   Dispatched once, at the GAME_MODE (0x83d6) == 2 transition, from the intro/attract mode state machine
 *   dispatchGameModeFrame (ROM 0x0d11) — the sibling of renderMode3ScoreRankingScreen (mode 3, the score
 *   ranking screen) and renderMode4PointTablePhase (mode 4, the point-table page). Those three routines
 *   build the three attract still-screens; this one is the mode-2 title. After it runs, the vblank NMI's
 *   pacing countdown drains POINT_TABLE_DRAW_STATE back down and, when it reaches 0, steps GAME_MODE down
 *   by one, advancing the attract sequence toward attract/play.
 *
 * LIVE-OUT
 *   Memory only. It writes the intro-state cell and four seeded work counters, plus the tilemap/VRAM cells
 *   the field-fill and the strip blits stamp. It returns nothing and leaves no register the caller reads.
 */
import {
  POINT_TABLE_DRAW_STATE, INTRO_COUNTER_829B, OBJECT_ANIM_STATE_8021, INTRO_COUNTER_801B, INTRO_COUNTER_802B, SHARED_TIME_BYTE,
  MAIN_TITLE_STRIP_SRC, INTRO_TITLE_STRIP2_SRC, INTRO_TITLE_STRIP3_SRC, INTRO_TITLE_STRIP4_SRC, MAIN_TITLE_STRIP_VRAM, SCORE_DIGIT_TIME_LOW_VRAM,
} from "./names.js";
import { fillTilemapBlock28x32 } from "./fillTilemapBlock28x32.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writeScoreDigitStepUp } from "./writeScoreDigitStepUp.js";

export function renderMode2IntroScreen(m) {
  const { mem8 } = m;

  // ── Arm the intro pacing gate ─────────────────────────────────────────────────────────
  // POINT_TABLE_DRAW_STATE (0x83d8) is the shared attract frame-pacing / drawn-state gate. The mode state
  // machine dispatchGameModeFrame (0x0d11) returns early while this cell is nonzero, and the vblank NMI
  // decrements it once per frame; when it reaches 0 (and the attract sub-phase counter is also 0) GAME_MODE
  // steps down one, advancing the attract cycle. Stamping 0xff here means "this screen was just drawn — hold
  // it for a full pacing interval before advancing," so the title page lingers instead of flickering past.
  mem8[POINT_TABLE_DRAW_STATE] = 0xff;

  // ── Wipe the play field to blank ───────────────────────────────────────────────────────
  // Clear a 28-wide x 32-tall rectangle of the 32x32 VRAM tile grid to the blank tile (0x10), deliberately
  // stepping over the 4-column HUD/score margin down one edge so the header/credit line is preserved. This
  // gives the title blits below a clean background to draw onto.
  fillTilemapBlock28x32(m);

  // ── Seed the intro work counters ───────────────────────────────────────────────────────
  // Four shared work-RAM cells the intro/attract and start-of-play logic reads. INTRO_COUNTER_829B (0x829b)
  // doubles as the once-per-life "board already laid out" run flag (setUpPlayStartOnce gates on it == 0), so
  // zeroing it re-arms that one-shot. OBJECT_ANIM_STATE_8021 (0x8021) is the object-animation cell block
  // base, zeroed to clear any leftover attract-object animation state. INTRO_COUNTER_801B (0x801b) and
  // INTRO_COUNTER_802B (0x802b) are seeded to their fixed intro start values 5 and 3.
  mem8[INTRO_COUNTER_829B] = 0;
  mem8[OBJECT_ANIM_STATE_8021] = 0;
  mem8[INTRO_COUNTER_801B] = 5;
  mem8[INTRO_COUNTER_802B] = 3;

  // ── Blit the main title strip ──────────────────────────────────────────────────────────
  // copyRunUpTileColumn stamps a run of ROM bytes UP one tilemap column (the Galaxian-derived display holds
  // one on-screen row 32 addresses apart in VRAM, so the destination pointer walks backward by 32 per byte,
  // painting a vertical strip). Here it paints the 11-tile main title strip from ROM MAIN_TITLE_STRIP_SRC
  // (0x2f5c) up the column whose top is MAIN_TITLE_STRIP_VRAM (0xaa8d). On the common path that strip alone
  // is the whole splash.
  copyRunUpTileColumn(m, MAIN_TITLE_STRIP_VRAM, MAIN_TITLE_STRIP_SRC, 11);

  // ── Splash-only unless the shared starting-time byte is low ────────────────────────────
  // SHARED_TIME_BYTE (0x83e4) is the shared starting-time byte (seeded from the difficulty DSW at cold
  // boot). When it is 10 or above the intro screen is just the title strip drawn above, and we are done.
  // Only the low single-digit values (0..9) take the extra arm below.
  if (mem8[SHARED_TIME_BYTE] >= 10) return;

  // ── Low-time arm: the time digit, then three more strips up the column ─────────────────
  // writeScoreDigitStepUp stamps the units digit of SHARED_TIME_BYTE (a single BCD digit here, since it is
  // < 10 — the char ROM lays out tiles 0..9 as the numeral glyphs, so the value is its own tile index) as a
  // glyph at SCORE_DIGIT_TIME_LOW_VRAM (0xab15), then returns the write pointer stepped up one cell. That
  // advanced pointer becomes the destination for strip 2 (7 tiles from INTRO_TITLE_STRIP2_SRC 0x2fae), so
  // the strip continues up the column immediately past the digit.
  copyRunUpTileColumn(m, writeScoreDigitStepUp(m, mem8[SHARED_TIME_BYTE], SCORE_DIGIT_TIME_LOW_VRAM), INTRO_TITLE_STRIP2_SRC, 7);

  // Strips 3 and 4 chain off the pointer the previous blit left behind: copyRunUpTileColumn mirrors its
  // advanced destination into m.regs.hl, and passing dst = undefined defaults the parameter to that mirror
  // — so each strip resumes exactly where the last one ended, climbing the same column. Strip 3 is 4 tiles
  // from INTRO_TITLE_STRIP3_SRC (0x2f73); strip 4 is 7 tiles from INTRO_TITLE_STRIP4_SRC (0x2f92).
  copyRunUpTileColumn(m, undefined, INTRO_TITLE_STRIP3_SRC, 4);
  copyRunUpTileColumn(m, undefined, INTRO_TITLE_STRIP4_SRC, 7);
}
