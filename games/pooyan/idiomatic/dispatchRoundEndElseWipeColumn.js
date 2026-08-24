// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
import { loc_02e3 } from "./loc_02e3.js";
import { u8, u16 } from "../../../core/int.js";
import { clearActorsAndEnterContinueState } from "./clearActorsAndEnterContinueState.js";
import { reseedOtherPlayerForTurn } from "./reseedOtherPlayerForTurn.js";
import { loc_1ce7 } from "./loc_1ce7.js";
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
 * dispatchRoundEndElseWipeColumn — round-clear / game-over / player-swap master of the play-state dispatch handler.
 *
 * Ticks the phase timer. When the reset latch is armed and the timer expires it stamps the reset
 * column, runs an integrity checksum (a byte sum must equal the magic value) that gates the re-init,
 * disarms the latch, and branches on the two-player / active-player / player-zero-lives flags into
 * one of the split-out tails. Otherwise it runs the frozen pre-pass and, every eighth tick, wipes a
 * vertical column with the current fill tile and steps that tile with a clamp.
 *
 * LIVE-OUT: none — a void handler ending in returns and tail delegates.
 */

const WIPE_ROWS = 0x1c;
const ROW_STRIDE = 0x20;
const TICK_MASK = 0x07;
const TILE_CLAMP_LIMIT = 0x10;
const TILE_CLAMP_VALUE = 0x06;
const RESET_TILE = 0x10;
const ATTR_ROWS = 8;
const CKSUM_ROWS = 0x0a;
const CKSUM_MAGIC = 0xaa;
const BANK_LEN = 0x3f;

export function dispatchRoundEndElseWipeColumn(m) {
  const { mem8, mem16 } = m;

  mem8[PHASE_TIMER] = u8(mem8[PHASE_TIMER] - 1);
  const armed = mem8[RESET_SCAN_LATCH] !== 0;
  const reinit = armed && mem8[PHASE_TIMER] === 0; // armed and the timer has expired

  if (!reinit) {
    m.push16(0x1c77); m.call(0x7e94); // frozen per-frame pre-pass
    if (mem8[HIGH_SCORE_INSERT_RANK] === 0) return;
    if ((mem8[PHASE_TIMER] & TICK_MASK) !== 0) return; // only every eighth tick

    const tile = mem8[WIPE_COLUMN_FILL_TILE];
    let ptr = mem16[WIPE_COLUMN_VRAM_PTR];
    for (let i = 0; i < WIPE_ROWS; i++) { mem8[ptr] = tile; ptr = u16(ptr + ROW_STRIDE); }
    let next = u8(tile + 1);
    if (next >= TILE_CLAMP_LIMIT) next = TILE_CLAMP_VALUE; // clamp the step tile
    mem8[WIPE_COLUMN_FILL_TILE] = next;
    return;
  }

  let attr = RESET_ATTR_COLUMN; // stamp the reset column bottom-up
  for (let i = 0; i < ATTR_ROWS; i++) { mem8[attr] = RESET_TILE; attr = u16(attr - ROW_STRIDE); }

  let sum = 0; // integrity byte sum over the strip
  let cell = HUD_INTEGRITY_STRIP_A;
  for (let i = 0; i < CKSUM_ROWS; i++) { sum = u8(sum + mem8[cell]); cell = u16(cell - ROW_STRIDE); }
  if (sum !== CKSUM_MAGIC) return; // checksum mismatch -> abort the re-init
  mem8[RESET_SCAN_LATCH] = 0; // disarm

  if (mem8[TWO_PLAYER_FLAG] === 0) return clearActorsAndEnterContinueState(m);
  if (mem8[ACTIVE_PLAYER] === 0) return reseedOtherPlayerForTurn(m);
  if (mem8[PLAYER0_LIVES] === 0) return clearActorsAndEnterContinueState(m);

  mem8[ACTIVE_PLAYER] = 0;
  mem8[PLAY_STATE_INDEX] = 0;
  loc_0010(m, PLAYER1_STATE_BANK, 0, BANK_LEN); // zero-fill player one's state bank
  mem8[FLIP_SCREEN_FLAG] = 1; // the fill leaves A zero -> increment is one
  loc_02e3(m); // reset the display pointer
  return loc_1ce7(m); // fall into the cap-first column stamp
}
