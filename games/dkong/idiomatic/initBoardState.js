// SPDX-License-Identifier: GPL-3.0-only
/**
 * initBoardState — reset the per-board work RAM, compute the board's bonus and timer
 * values, seed the shared top sprites, then tail-dispatch to the board's own object
 * setup (this routine has no return of its own). Bonus = min(LEVEL*10 + 40, 80); tick
 * period = max(220 - 2*bonus, 40); the top sprites are skipped on the 100m rivet board.
 *
 * LIVE-OUT: memory only — the two cleared spans plus whatever the dispatched setup writes.
 */
import { seed25mBoardObjects } from "./seed25mBoardObjects.js";
import { seed50mBoardObjects } from "./seed50mBoardObjects.js";
import { seed75mBoardObjects } from "./seed75mBoardObjects.js";
import { seed100mBoardObjects } from "./seed100mBoardObjects.js";
import {
  LEVEL,
  BOARD,
  BONUS_START,
  BONUS,
  BONUS_EVENT_MARK,
  BONUS_PERIOD,
  BONUS_TICK,
  MARIO_ACTIVE,
  BOARD_OBJ_SCRATCH,
  TOP_SPRITES,
  MARIO_STATE_CLEAR_END,
  BOARD_STATE_CLEAR_END,
  loc_6209,
  loc_620a,
} from "./names.js";

const BOARD_SETUP = {
  1: seed25mBoardObjects,
  2: seed50mBoardObjects,
  3: seed75mBoardObjects,
  4: seed100mBoardObjects,
};

export function initBoardState(m) {
  const { mem8 } = m;

  for (let a = MARIO_ACTIVE; a <= MARIO_STATE_CLEAR_END; a++) mem8[a] = 0x00;
  for (let a = BOARD_OBJ_SCRATCH; a < BOARD_STATE_CLEAR_END; a++) mem8[a] = 0x00;

  for (let i = 0; i < 0x40; i++) mem8[BOARD_OBJ_SCRATCH + i] = mem8[0x3d9c + i];

  let bonus = (mem8[LEVEL] * 10 + 0x28) & 0xff;
  if (bonus > 0x50) bonus = 0x50;
  mem8[BONUS_START] = bonus;
  mem8[BONUS] = bonus;
  mem8[BONUS_EVENT_MARK] = bonus;

  let period = (0xdc - 2 * bonus) & 0xff;
  if (period < 0x28) period = 0x28;
  mem8[BONUS_PERIOD] = period;
  mem8[BONUS_TICK] = period;

  mem8[loc_6209] = 0x04;
  mem8[loc_620a] = 0x08;

  // Bit 2 is set only for BOARD 4 (100m rivet), which skips the top sprites.
  const board = mem8[BOARD];
  if ((board & 0x04) === 0) {
    let code = 0x4f;
    for (let i = 0; i < 3; i++) {
      const rec = TOP_SPRITES + i * 4;
      mem8[rec + 0] = code;
      mem8[rec + 1] = 0x3a;
      mem8[rec + 2] = 0x0f;
      mem8[rec + 3] = 0x18;
      code = (code + 0x10) & 0xff;
    }
  }

  BOARD_SETUP[board](m);
}
