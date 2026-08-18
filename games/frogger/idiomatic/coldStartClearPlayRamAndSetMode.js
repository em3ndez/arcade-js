// SPDX-License-Identifier: GPL-3.0-only
/**
 * coldStartClearPlayRamAndSetMode  —  ROM 0x0567  ·  grounding: [code] (MAME-grounding pending)
 *
 * WHAT IT IS
 *   Part 3 — the final, shared stage — of Frogger's cold-start "wipe work RAM for a new game" chain.
 *   It scrubs the playfield and the per-game work RAM back to a clean slate, redraws the score/credit
 *   header, then parks the machine in the attract SCORE-RANKING screen. After a coin drops and a game
 *   finishes, this is what returns the cabinet to its idle attract state with every gate, flag, and
 *   difficulty index zeroed.
 *
 * WHERE IT SITS
 *   The common tail of three cold-start entries, all of which fall/branch into it:
 *     · coldStartClearSlotGates (part 1) → coldStartClearAltSlotGates (part 2, 0x0557) → here,
 *       the fresh-new-game path that first zeros both players' home-bay slot gates;
 *     · clearPlayerOneHomeBayGates (0x0534), the player-1-only cold board re-init;
 *     · the player-2 continue path, which also lands in part 2 and flows down.
 *   It runs three RAM/HW init callees (credit line, high-score-rank pack, score header), block-clears
 *   three work-RAM spans, zeros the game-state bytes, sets the mode, then tail-transfers into the
 *   foreground main loop's pace-tail re-entry so the machine resumes free-running.
 *
 * LIVE-OUT
 *   Memory only (plus the two screen-flip HW latches). It returns whatever the pace-tail coroutine
 *   returns and leaves no register the caller reads.
 */
import {
  SPRITE_BLOCK2_BASE, loc_8000, LIVE_OBJECT_PAGE,
  FROG_READY_FLAG, PLAY_FLAG, ATTRACT_SEQUENCER_PHASE, CONTINUE_FLAG, CONTINUE_FLAG_2P,
  FLIP_X_LATCH, FLIP_Y_LATCH, PLAYER1_DIFFICULTY_INDEX,
  ATTRACT_PHASE_COMPANION, SCREEN_FLIP_LATCH, POINT_TABLE_DRAW_STATE,
  IN_PLAY_BOARD_INIT_GUARD, INIT_GUARD_LATCH, TWO_PLAYER_START_FLAG, GAME_MODE, loc_83c4,
} from "./names.js";
import { endForegroundPassAtPaceTail } from "./endForegroundPassAtPaceTail.js";
import { clearActivePlayerWorkRam } from "./clearActivePlayerWorkRam.js";
import { forceClearPlayerWorkRam } from "./forceClearPlayerWorkRam.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { renderCreditLine } from "./renderCreditLine.js";
import { packScoreRankPair } from "./packScoreRankPair.js";
import { renderScoreHeader } from "./renderScoreHeader.js";
import { u16 } from "../../../core/int.js";

// Mode 3 = the attract SCORE-RANKING screen. GAME_MODE (0x83d6) is grounded as 0 while attract cycles
// and ~0x05 at coin/play; the intro/attract dispatcher (dispatchGameModeFrame 0x0d11) reads it and, for
// mode 3, draws the ranked-high-scores page. A cold start deliberately boots into this screen.
const GAME_MODE_SCORE_RANK = 0x03;

// Lengths of the three contiguous work-RAM spans the ROM block-clears here (originally LDIR fills).
const PLAY_RAM_LEN = 0x160;    // sprite/actor block: SPRITE_BLOCK2_BASE 0x8100 .. 0x825f
const OBJ0_LEN = 0x05;         // low object bytes:   loc_8000        0x8000 .. 0x8004
const OBJ_PAGE_LEN = 0x2f;     // live-object page:   LIVE_OBJECT_PAGE 0x800c .. 0x803a

export function coldStartClearPlayRamAndSetMode(m) {
  const { mem8, mem16 } = m;

  // ── Repaint the screen and run the header/score-setup callees ─────────────────────────
  // clearTilemapToTile16 wipes the whole 32x32 tilemap (0xa800..0xabff) to the blank tile 0x10, giving
  // the score-ranking screen a clean canvas. clearActivePlayerWorkRam is the guarded frog/gate wipe:
  // in a 1-player game (PLAY_FLAG 0x83fe == 1) it no-ops to preserve that player's state, otherwise it
  // force-clears. The last three lay down the attract header: renderCreditLine draws the CREDIT line,
  // packScoreRankPair (0x0f69) ranks both players' final scores into the display field for the ranking
  // page, and renderScoreHeader redraws the HI-SCORE / 1-UP / 2-UP score row.
  clearTilemapToTile16(m);
  clearActivePlayerWorkRam(m);
  renderCreditLine(m);
  packScoreRankPair(m);
  renderScoreHeader(m);

  // ── Block-clear three work-RAM spans (the ROM's three LDIR fills) ─────────────────────
  // Zero the sprite/actor block (0x8100..0x825f — sprites, lane object lists, and the low slot/gate
  // cells), the five low object bytes at loc_8000 (0x8000..0x8004, which also aliases the frog-anim
  // index cell), and the 0x2f-byte live-object page (0x800c..0x803a). u16() wraps each address into the
  // 16-bit Z80 space exactly as the hardware pointer would. Together these evict every stale sprite,
  // object, and lane record left over from the finished game.
  for (let i = 0; i < PLAY_RAM_LEN; i++) mem8[u16(SPRITE_BLOCK2_BASE + i)] = 0;
  for (let i = 0; i < OBJ0_LEN; i++) mem8[u16(loc_8000 + i)] = 0;
  for (let i = 0; i < OBJ_PAGE_LEN; i++) mem8[u16(LIVE_OBJECT_PAGE + i)] = 0;

  // ── Zero the scattered game-state bytes ───────────────────────────────────────────────
  // Individually-addressed flags and latches that the block clears above do not cover. Each is set back
  // to its idle/attract value:
  mem8[FROG_READY_FLAG] = 0;            // 0x83c3: frog-object-ready flag — no live frog yet
  mem8[PLAY_FLAG] = 0;                  // 0x83fe: in-play flag AND player count — 0 == attract
  mem8[ATTRACT_SEQUENCER_PHASE] = 0;    // 0x83bf: attract-demo sequencer phase — rewind to phase 0
  mem8[CONTINUE_FLAG] = 0;              // 0x83c9: player-1-path continue flag
  mem8[CONTINUE_FLAG_2P] = 0;           // 0x83ca: player-2-path continue flag
  mem8[FLIP_X_LATCH] = 0;               // 0xb810: flip_x HW IO latch — restore upright orientation
  mem8[FLIP_Y_LATCH] = 0;              // 0xb80c: flip_y HW IO latch — restore upright orientation
  // One 16-bit write to PLAYER1_DIFFICULTY_INDEX (0x8293). PLAYER2_DIFFICULTY_INDEX sits directly above
  // at 0x8294, so this single word store clears BOTH players' difficulty indices at once — exactly the
  // ROM's `ld (0x8293),hl` with hl=0. loadActivePlayerLaneParams later reads these to pick lane params.
  mem16[PLAYER1_DIFFICULTY_INDEX] = 0;
  mem8[ATTRACT_PHASE_COMPANION] = 0;    // 0x83bb: attract companion byte, write-only-to-0 (holds no state)
  mem8[SCREEN_FLIP_LATCH] = 0;          // 0x83cb: work-RAM shadow of the cocktail screen-flip bit
  mem8[POINT_TABLE_DRAW_STATE] = 0;     // 0x83d8: shared attract frame-pacing / drawn-state gate
  mem8[loc_83c4] = 0;                   // 0x83c4: role ungrounded (loc_ per names-debt; ground via MAME)
  mem8[IN_PLAY_BOARD_INIT_GUARD] = 0;   // 0x83ba: once-per-board in-play-init guard — re-arm it
  mem8[INIT_GUARD_LATCH] = 0;           // 0x8295: one-shot page-swap init guard — re-arm it
  mem8[TWO_PLAYER_START_FLAG] = 0;      // 0x825b: 2-player start flag

  // ── Park the machine in the attract score-ranking mode ────────────────────────────────
  // With state wiped, select mode 3 so the next attract frame draws the SCORE RANKING page.
  mem8[GAME_MODE] = GAME_MODE_SCORE_RANK;

  // ── Force-clear the player work RAM, then tail into the foreground pace tail ───────────
  // forceClearPlayerWorkRam (0x07eb — unconditional) zeros the frog object block (0x8044..0x8063) and the
  // home-bay gate block (0x8420..0x842b) with no 1-player guard, guaranteeing a clean frog/bay slate
  // even where clearActivePlayerWorkRam above chose to skip. Then tail-transfer into
  // endForegroundPassAtPaceTail (0x0368) — the main loop's pace-tail re-entry — handing control back to
  // the coroutine driver, which resumes free-running the foreground until the next vblank NMI.
  forceClearPlayerWorkRam(m);
  return endForegroundPassAtPaceTail(m);
}
