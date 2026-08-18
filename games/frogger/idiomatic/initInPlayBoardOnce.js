// SPDX-License-Identifier: GPL-3.0-only
/**
 * initInPlayBoardOnce  —  ROM 0x0d4c  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The heavy one-shot setup that lays a fresh in-play board. When a new board starts it wipes the
 *   per-player and per-board scratch cells, builds the lane/object/field state for the level, and paints
 *   the static furniture — the two board HUD strips, the player-select prompt line, and the extra-life
 *   score-target readout — into VRAM. A once-per-board guard makes the expensive body run exactly once
 *   no matter how many frames call in.
 *
 * WHERE IT SITS
 *   Reached from the in-play board/life dispatcher at the start of a board. It is the "build the world"
 *   half of the board lifecycle: it seeds the state that the per-frame play loop (the lane resolver, the
 *   frog-animation pipeline, the collision arm) then reads and mutates every frame. Note the ordering
 *   quirk below — clearActivePlayerWorkRam runs on EVERY call, ahead of the guard; only the rest of the
 *   body is guarded.
 *
 * LIVE-OUT
 *   Memory only. It writes RAM scratch cells, the once-per-board guard, and a batch of VRAM tile cells,
 *   and calls several memory-only helpers. It returns nothing and leaves no register the caller reads.
 */
import {
  IN_PLAY_BOARD_INIT_GUARD, PLAYER1_DIFFICULTY_INDEX, PLAYER2_DIFFICULTY_INDEX,
  TWO_PLAYER_START_FLAG, ANIM_FRAME_INDEX, IN_PLAY_BOARD_STATE_BYTE, INTRO_COUNTER_801B, POINT_TABLE_SPRITE_ATTR_8029,
  POINT_TABLE_PHASE2_STRIP_VRAM, PLAYER_SELECT_PROMPT_SRC, INTRO_TITLE_STRIP2_SRC, PTS_SUFFIX_STRIP, EXTRA_LIFE_SCORE_TARGET,
  EXTRA_LIFE_SCORE_TARGET_VRAM, BOARD_INIT_HUD_STRIP1_VRAM, BOARD_INIT_HUD_STRIP2_VRAM, BOARD_INIT_HUD_STRIP1_SRC, BOARD_INIT_HUD_STRIP3_SRC,
} from "./names.js";
import { loadActivePlayerLaneParams } from "./loadActivePlayerLaneParams.js";
import { clearActivePlayerWorkRam } from "./clearActivePlayerWorkRam.js";
import { activateFrogObject } from "./activateFrogObject.js";
import { fillTilemapBlock28x32 } from "./fillTilemapBlock28x32.js";
import { clearObjectBlocksAndMirrorToObjRam } from "./clearObjectBlocksAndMirrorToObjRam.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { blitPlayerSelectPrompt } from "./blitPlayerSelectPrompt.js";
import { writeScoreField } from "./writeScoreField.js";

export function initInPlayBoardOnce(m) {
  const { mem8 } = m;

  // ── Always-run prelude: clear the active player's work RAM ────────────────────────────
  // In the ROM the call to clearActivePlayerWorkRam (0x07e6) sits BEFORE the guard test, so it fires on
  // every entry — even on the frames where the guard below short-circuits the rest of the body. That
  // helper is itself a no-op in a one-player game (PLAY_FLAG 0x83fe == 1) and otherwise zeroes the frog
  // object block (0x8044-0x8063) and the home-bay gate block (0x8420-0x842b).
  clearActivePlayerWorkRam(m);

  // ── Once-per-board guard ──────────────────────────────────────────────────────────────
  // IN_PLAY_BOARD_INIT_GUARD (0x83ba) is the "this board is already built" latch. It is 0 for a fresh
  // board and set to 1 at the end of the setup below. Any later frame that re-enters this routine finds
  // it non-zero and bails, so the expensive world-build runs exactly once per board. (ROM: `or a` /
  // `ret nz` on the flag byte.)
  if (mem8[IN_PLAY_BOARD_INIT_GUARD] !== 0) return;

  // ── Zero the per-player and per-board scratch cells ───────────────────────────────────
  // The ROM loads HL = 0 and does two 16-bit stores plus two byte stores, all writing 0:
  //   • PLAYER1_DIFFICULTY_INDEX (0x8293) + PLAYER2_DIFFICULTY_INDEX (0x8294): the difficulty/level index
  //     each player feeds into loadActivePlayerLaneParams to pick a lane-parameter block. The Z80 stores
  //     these as one 16-bit write to 0x8293; here it is the equivalent pair of byte writes.
  //   • ANIM_FRAME_INDEX (0x81b3): the 16-bit animation-frame cursor into the frame-source pointer table
  //     — reset so the board's object animation starts at frame 0.
  //   • TWO_PLAYER_START_FLAG (0x825b): the 2-player-start flag, cleared for the new board.
  //   • IN_PLAY_BOARD_STATE_BYTE (0x829a): a per-board state byte, cleared here at board init.
  mem8[PLAYER1_DIFFICULTY_INDEX] = 0;
  mem8[PLAYER2_DIFFICULTY_INDEX] = 0;
  m.mem16[ANIM_FRAME_INDEX] = 0;
  mem8[TWO_PLAYER_START_FLAG] = 0;
  mem8[IN_PLAY_BOARD_STATE_BYTE] = 0;

  // Mark the board built (ROM `inc a` on the freshly-zeroed A, then store): the guard flips 0 → 1 so this
  // whole block never runs again for this board.
  mem8[IN_PLAY_BOARD_INIT_GUARD] = 1;

  // ── Lane / object / field setup ───────────────────────────────────────────────────────
  // The four world-build helpers, in ROM order:
  //   • loadActivePlayerLaneParams  (0x223d): copies the active player's 33-byte lane-parameter block
  //                                           (chosen by difficulty index) into ACTIVE_LANE_PARAM_BLOCK.
  //   • activateFrogObject          (0x0804): marks the frog object active and clears its position cells.
  //   • fillTilemapBlock28x32       (0x0766): fills the 28×32 playfield background with the blank tile.
  //   • clearObjectBlocksAndMirrorToObjRam (0x064b): zeroes the live object/sprite blocks and mirrors the
  //                                           cleared head into OBJRAM.
  loadActivePlayerLaneParams(m);
  activateFrogObject(m);
  fillTilemapBlock28x32(m);
  clearObjectBlocksAndMirrorToObjRam(m);

  // ── Seed two object/animation cells ───────────────────────────────────────────────────
  // Two fixed seed values the ROM writes just before the HUD paint:
  //   • INTRO_COUNTER_801B (0x801b) = 4: a shared work-RAM counter seeded for this board's intro/anim use.
  //   • POINT_TABLE_SPRITE_ATTR_8029 (0x8029) = 6: the point-table sprite-record ATTR/Y field.
  mem8[INTRO_COUNTER_801B] = 0x04;
  mem8[POINT_TABLE_SPRITE_ATTR_8029] = 0x06;

  // ── Board HUD strips 1 and 2 ──────────────────────────────────────────────────────────
  // copyRunUpTileColumn (0x0028, the ROM `rst 0x28` primitive) copies `count` bytes from a flat ROM tile
  // source UP a VRAM column (destination steps back one 32-cell row per byte), and hands back both
  // pointers left just past the strip. Strip 1: 4 tiles from BOARD_INIT_HUD_STRIP1_SRC (0x2f77) up the
  // column at BOARD_INIT_HUD_STRIP1_VRAM (0xaa28). We keep the returned source pointer for the next strip.
  const { de: strip1SrcEnd } = copyRunUpTileColumn(m, BOARD_INIT_HUD_STRIP1_VRAM, BOARD_INIT_HUD_STRIP1_SRC, 0x04);

  // The ROM here does `inc e`, NOT `inc de`: it advances only DE's LOW byte, with no carry into the high
  // byte. That deliberately skips one source byte before strip 2 (0x2f7b → 0x2f7c) — an 8-bit-only bump
  // that we reproduce exactly by holding the high byte and wrapping the low byte at 0xff.
  const strip2Src = ((strip1SrcEnd >>> 8) << 8) | ((strip1SrcEnd + 1) & 0xff);
  // Strip 2: 12 (0x0c) tiles from that adjusted source up the column at BOARD_INIT_HUD_STRIP2_VRAM (0xaaad).
  copyRunUpTileColumn(m, BOARD_INIT_HUD_STRIP2_VRAM, strip2Src, 0x0c);

  // ── Player-select prompt line ─────────────────────────────────────────────────────────
  // Draw the "ONE PLAYER ONLY" / "ONE OR TWO PLAYERS" prompt (chosen inside by the credit count). It owns
  // its own VRAM destination, so nothing here chains into it.
  blitPlayerSelectPrompt(m);

  // ── Chained prompt / title tile strips ────────────────────────────────────────────────
  // A run of four strips blitted into one continuous VRAM column: each copyRunUpTileColumn returns its
  // advanced destination pointer (`.hl`) and we feed that into the next call, so the four strips stack up
  // the same column. Only the FIRST call names its VRAM base (POINT_TABLE_PHASE2_STRIP_VRAM 0xab74); the
  // rest chain off `.hl`. Each call supplies its own fresh ROM source:
  //   • 3 tiles from PLAYER_SELECT_PROMPT_SRC (0x2f88)
  //   • 6 tiles from BOARD_INIT_HUD_STRIP3_SRC (0x2fa8)
  //   • 5 tiles from INTRO_TITLE_STRIP2_SRC   (0x2fae)
  const promptRun = copyRunUpTileColumn(m, POINT_TABLE_PHASE2_STRIP_VRAM, PLAYER_SELECT_PROMPT_SRC, 0x03);
  const promptRun2 = copyRunUpTileColumn(m, promptRun.hl, BOARD_INIT_HUD_STRIP3_SRC, 0x06);
  const promptRun3 = copyRunUpTileColumn(m, promptRun2.hl, INTRO_TITLE_STRIP2_SRC, 0x05);
  // Final strip of the chain: 7 tiles continuing from where strip 3's SOURCE left off, plus one. Unlike
  // the strip-1→2 hand-off above, the ROM does a full 16-bit `inc de` here, so a plain `+ 1` on the
  // returned source pointer is faithful (copyRunUpTileColumn masks the source to 16 bits internally).
  copyRunUpTileColumn(m, promptRun3.hl, promptRun3.de + 1, 0x07);

  // ── Extra-life score-target readout ───────────────────────────────────────────────────
  // Print the extra-life threshold score. writeScoreField (0x0b95) draws a 16-bit packed-BCD word as four
  // digit cells plus a fixed trailing '0' (Frogger stores scores as value/10 with an implicit ones-place
  // zero), stepping up one VRAM row per cell. The value is the ROM word at EXTRA_LIFE_SCORE_TARGET (0x2e08,
  // = 0x2000 → displays as 20000); it is drawn at EXTRA_LIFE_SCORE_TARGET_VRAM (0xa994). The return is the
  // VRAM pointer left just past the readout, which the " PTS" suffix continues from.
  const scoreTargetPtr = writeScoreField(m, m.mem16[EXTRA_LIFE_SCORE_TARGET], EXTRA_LIFE_SCORE_TARGET_VRAM);

  // Append the 4-tile " PTS" suffix strip (PTS_SUFFIX_STRIP 0x2fba) directly above the score digits,
  // continuing up the same VRAM column from the pointer writeScoreField handed back.
  copyRunUpTileColumn(m, scoreTargetPtr, PTS_SUFFIX_STRIP, 0x04);
}
