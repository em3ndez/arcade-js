// SPDX-License-Identifier: GPL-3.0-only
/**
 * loadActivePlayerLaneParams  —  ROM 0x223d  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-difficulty lane-parameter loader. Frogger keeps five ROM "tiers" of lane layout, one per
 *   difficulty step, and this routine installs the tier the active player has currently reached: it reads
 *   that player's difficulty index, follows a little-endian pointer table to the matching ROM block, and
 *   copies the whole 33-byte block down into work RAM at ACTIVE_LANE_PARAM_BLOCK (0x8270).
 *
 *   Those 33 bytes are eleven contiguous render triples — (row-advance, row-count, column) — one per
 *   frog-animation render arm 0..10, packed so arm k reads its triple at offset 3*k (see mechanisms.md
 *   "Loading the active player's lane parameters"). Because every arm's row/column counts come out of this
 *   block, swapping the block is exactly what makes a harder board scroll/animate differently. The block
 *   is a snapshot of ROM data, not live state — nothing here reads back what the arms later do with it.
 *
 * WHERE IT SITS
 *   Called on every board (re)layout, never during attract — its callers are all game-start / board-init
 *   paths: startNewGame (each life), initInPlayBoardOnce and setUpPlayStartOnce (once-per-board / once-per-
 *   life layout), and advanceBoardForeground, which first bumps the difficulty index modulo 5 and then
 *   calls here so the *next* board reloads the harder tier. The difficulty index is the only selector, so
 *   rotating it (board advance) is what walks the machine through the five lane configurations.
 *
 * LIVE-OUT
 *   Memory only. It writes the 33-byte ACTIVE_LANE_PARAM_BLOCK and nothing else; it returns nothing and
 *   leaves no register the caller reads (in the ROM it runs under EXX and every caller reloads A).
 */
import { ACTIVE_PLAYER, PLAYER1_DIFFICULTY_INDEX, PLAYER2_DIFFICULTY_INDEX, LANE_PARAM_PTR_TABLE, ACTIVE_LANE_PARAM_BLOCK } from "./names.js";

// ACTIVE_PLAYER (0x83fd) holds the player number, 1 or 2. Player 1 is the only value treated specially;
// any other value (2 in a real game, and the test's out-of-range probes) takes the player-2 branch.
const PLAYER_ONE = 1;

// The lane-parameter block is exactly 33 bytes = eleven 3-byte render triples, one per anim arm 0..10.
const BLOCK_SIZE = 33;

// LANE_PARAM_PTR_TABLE (0x2260) is a table of 16-bit little-endian block pointers, one per difficulty
// tier, so each entry is 2 bytes wide and the tier's pointer lives at table + 2*difficulty.
const POINTER_WIDTH = 2;

export function loadActivePlayerLaneParams(m) {
  const { mem8, mem16 } = m;

  // ── Pick the active player's difficulty cell ─────────────────────────────────────────
  // Player 1 uses PLAYER1_DIFFICULTY_INDEX (0x8293); anyone else uses PLAYER2_DIFFICULTY_INDEX (0x8294),
  // the adjacent cell. Selecting the cell (not yet its value) mirrors the ROM, which forms the pointer to
  // whichever index the active player owns.
  const indexCell = mem8[ACTIVE_PLAYER] === PLAYER_ONE ? PLAYER1_DIFFICULTY_INDEX : PLAYER2_DIFFICULTY_INDEX;

  // ── Read the difficulty tier (0..4) ──────────────────────────────────────────────────
  // The value in that cell is how far this player has climbed; advanceBoardForeground increments it and
  // wraps 5 back to 0, so it always indexes one of the five tiers in the pointer table.
  const difficulty = mem8[indexCell];

  // ── Follow the pointer table to that tier's ROM block ─────────────────────────────────
  // Index LANE_PARAM_PTR_TABLE (0x2260) by 2*difficulty and read the 16-bit little-endian entry there;
  // that word is the ROM address of the 33-byte parameter block for this difficulty tier.
  const srcBlock = mem16[LANE_PARAM_PTR_TABLE + POINTER_WIDTH * difficulty];

  // ── Copy the 33-byte block into work RAM ─────────────────────────────────────────────
  // Byte-for-byte copy from the ROM block into ACTIVE_LANE_PARAM_BLOCK (0x8270). Once landed, the eleven
  // render arms read their (row-advance, row-count, column) triples straight out of this window, so this
  // single copy retunes every arm for the new board at once.
  for (let i = 0; i < BLOCK_SIZE; i++) {
    mem8[ACTIVE_LANE_PARAM_BLOCK + i] = mem8[srcBlock + i];
  }
}
