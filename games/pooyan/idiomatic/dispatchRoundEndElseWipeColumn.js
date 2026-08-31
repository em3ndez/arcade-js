// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import { armTileFillFromPlayfieldBase } from "./armTileFillFromPlayfieldBase.js";
import { u8, u16 } from "../../../core/int.js";
import { clearActorsAndEnterContinueState } from "./clearActorsAndEnterContinueState.js";
import { reseedOtherPlayerForTurn } from "./reseedOtherPlayerForTurn.js";
import { stampCappedTileColumnUp } from "./stampCappedTileColumnUp.js";
import { dispatchWriteAnimStateAndPollStart } from "./dispatchWriteAnimStateAndPollStart.js";
import {
  PHASE_TIMER,
  RESET_SCAN_LATCH,
  HIGH_SCORE_INSERT_RANK,
  WIPE_COLUMN_FILL_TILE,
  WIPE_COLUMN_VRAM_PTR,
  RESET_ATTR_COLUMN,
  HUD_INTEGRITY_STRIP_A,
  TWO_PLAYER_FLAG,
  ACTIVE_PLAYER,
  PLAYER0_LIVES,
  PLAY_STATE_INDEX,
  PLAYER1_STATE_BANK,
  FLIP_SCREEN_FLAG,
} from "./names.js";
/**
 * dispatchRoundEndElseWipeColumn -- the round-end / game-over / player-swap decision point.
 *
 * WHAT IT IS
 *   Index 14 of the in-play sub-state dispatch (PLAY_STATE_INDEX & 0x1f indexes the jump table
 *   at ROM 0x15a8). While the machine sits in the post-round sub-state this handler runs every
 *   frame. It is the moment a round has finished playing and the game must decide what comes
 *   next -- hand the turn to the other player, drop into the continue / game-over path, or reset
 *   the field in place for the same player -- and, until that moment actually arrives, it keeps
 *   the between-rounds / high-score-entry screen alive by animating a vertical tilemap column.
 *
 * ROLE IN THE MACHINE
 *   An earlier round-end stage arms a reset-scan latch (RESET_SCAN_LATCH) and seeds the phase
 *   timer (PHASE_TIMER). This handler ticks that timer down once per frame. The two act as a
 *   one-shot: the transition commits only on the single frame the latch is armed AND the timer
 *   reaches zero. Every other frame takes the "else" path -- run the write-anim pre-pass, then
 *   (throttled to one frame in eight) wipe one vertical tilemap column with a stepping fill tile,
 *   which is the shimmering column effect on the high-score-entry screen. On the commit frame it
 *   stamps the reset column, verifies an anti-tamper checksum, disarms the latch, and branches on
 *   the two-player / active-player / player-0-lives situation into one of the split-out tails.
 *
 * ROM: 0x1c66-0x1ce6.  Grounding: [seen].
 *
 * WRITES (what it leaves in memory, per path)
 *   Wipe path  : repaints a 0x1c-cell vertical tilemap column and advances WIPE_COLUMN_FILL_TILE.
 *   Commit path: stamps the reset attribute column and clears RESET_SCAN_LATCH; on the in-place
 *                reseed branch it also zeroes ACTIVE_PLAYER and PLAY_STATE_INDEX, zero-fills
 *                PLAYER1_STATE_BANK, and sets FLIP_SCREEN_FLAG to normal orientation.
 * LIVE-OUT: none -- a void handler ending in returns and tail delegates.
 */

const WIPE_ROWS = 0x1c;         // rows repainted per column-wipe pass (0x1c cells)
const ROW_STRIDE = 0x20;        // one tilemap row is 0x20 bytes apart
const TICK_MASK = 0x07;         // the wipe advances only on every eighth frame
const TILE_CLAMP_LIMIT = 0x10;  // stepped fill tile wraps once it would reach 0x10...
const TILE_CLAMP_VALUE = 0x06;  // ...back down to 0x06, so it cycles tiles 0x06..0x0f
const RESET_TILE = 0x10;        // blank tile stamped down the reset column
const ATTR_ROWS = 8;            // reset column is 8 cells tall
const CKSUM_ROWS = 0x0a;        // anti-tamper checksum sums 0x0a cells...
const CKSUM_MAGIC = 0xaa;       // ...whose byte sum must equal 0xaa on an intact field
const BANK_LEN = 0x3f;          // a per-player saved state bank is 0x3f bytes

export function dispatchRoundEndElseWipeColumn(m) {
  const { mem8, mem16 } = m;

  // Tick the round-end timer. PHASE_TIMER drains one per frame; RESET_SCAN_LATCH was armed by an
  // earlier round-end stage. The transition fires exactly on the frame the latch is armed AND the
  // timer has just hit zero -- otherwise this is a between-rounds animation frame.
  mem8[PHASE_TIMER] = u8(mem8[PHASE_TIMER] - 1);
  const armed = mem8[RESET_SCAN_LATCH] !== 0;
  const reinit = armed && mem8[PHASE_TIMER] === 0; // armed and the timer has expired

  if (!reinit) {
    // --- Between-rounds path: nothing to commit this frame, just keep the screen moving. ---
    // First the write-anim pre-pass, which also polls the start button while we wait here.
    dispatchWriteAnimStateAndPollStart(m); // the write-anim dispatch pre-pass
    // The column wipe belongs to the high-score-entry screen: it only runs once an entry rank has
    // been latched (HIGH_SCORE_INSERT_RANK nonzero). With no pending entry there is nothing to draw.
    if (mem8[HIGH_SCORE_INSERT_RANK] === 0) return;
    // Throttle the effect: repaint the column on one frame in eight so it shimmers rather than blurs.
    if ((mem8[PHASE_TIMER] & TICK_MASK) !== 0) return; // only every eighth tick

    // Repaint one vertical tilemap column: write the current fill tile into 0x1c cells, walking
    // downward one row (ROW_STRIDE) at a time from the column cursor WIPE_COLUMN_VRAM_PTR.
    const tile = mem8[WIPE_COLUMN_FILL_TILE];
    let ptr = mem16[WIPE_COLUMN_VRAM_PTR];
    for (let i = 0; i < WIPE_ROWS; i++) { mem8[ptr] = tile; ptr = u16(ptr + ROW_STRIDE); }
    // Advance the fill tile for the next pass. Once the step would reach 0x10 it wraps back to
    // 0x06, so successive passes cycle the column through tile codes 0x06..0x0f and animate.
    let next = u8(tile + 1);
    if (next >= TILE_CLAMP_LIMIT) next = TILE_CLAMP_VALUE; // clamp the step tile
    mem8[WIPE_COLUMN_FILL_TILE] = next;
    return;
  }

  // --- Commit path: latch armed and timer expired, so the round-end transition fires now. ---

  // Stamp the reset column: write the blank tile (0x10) into 8 cells climbing the column upward
  // from RESET_ATTR_COLUMN, stepping one row (ROW_STRIDE) toward the top of the field each time.
  let attr = RESET_ATTR_COLUMN; // stamp the reset column bottom-up
  for (let i = 0; i < ATTR_ROWS; i++) { mem8[attr] = RESET_TILE; attr = u16(attr - ROW_STRIDE); }

  // Anti-tamper gate before we re-init anything. Sum 0x0a tilemap cells climbing upward from
  // HUD_INTEGRITY_STRIP_A; on an intact machine that strip sums to 0xaa. Any other value means the
  // field data has been corrupted, so bail out and leave the machine exactly where it is.
  let sum = 0; // integrity byte sum over the strip
  let cell = HUD_INTEGRITY_STRIP_A;
  for (let i = 0; i < CKSUM_ROWS; i++) { sum = u8(sum + mem8[cell]); cell = u16(cell - ROW_STRIDE); }
  if (sum !== CKSUM_MAGIC) return; // checksum mismatch -> abort the re-init
  // Checksum good: disarm the latch so the transition below happens exactly once.
  mem8[RESET_SCAN_LATCH] = 0; // disarm

  // Decide who plays next, in priority order:
  //  - One-player game (TWO_PLAYER_FLAG clear): there is no other player to hand off to, so tail
  //    into the full-clear / continue path (which becomes game-over when no credit remains).
  if (mem8[TWO_PLAYER_FLAG] === 0) return clearActorsAndEnterContinueState(m);
  //  - Two-player game and player 0 just finished (ACTIVE_PLAYER == 0): hand the turn to player 1.
  if (mem8[ACTIVE_PLAYER] === 0) return reseedOtherPlayerForTurn(m);
  //  - Player 1 just finished but player 0 has no lives left: fall to the continue / game-over path.
  if (mem8[PLAYER0_LIVES] === 0) return clearActorsAndEnterContinueState(m);

  // Otherwise both players are still in a two-player game and it is player 0's turn again: reset
  // the field in place and hand the turn back to player 0.
  mem8[ACTIVE_PLAYER] = 0; // select player 0's banks again
  mem8[PLAY_STATE_INDEX] = 0; // restart the in-play sub-state from the top
  fillByteRun(m, PLAYER1_STATE_BANK, 0, BANK_LEN); // zero-fill player one's state bank
  // The byte-fill above leaves its constant fill value (0) behind; incrementing that yields 1,
  // which is written to FLIP_SCREEN_FLAG to restore normal (upright) screen orientation.
  mem8[FLIP_SCREEN_FLAG] = 1; // the fill leaves A zero -> increment is one
  armTileFillFromPlayfieldBase(m); // reset the display pointer
  return stampCappedTileColumnUp(m); // fall into the cap-first column stamp
}
