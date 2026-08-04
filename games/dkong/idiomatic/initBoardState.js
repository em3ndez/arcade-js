// SPDX-License-Identifier: GPL-3.0-only
/**
 * initBoardState — reset the per-board work RAM, compute the board's bonus/timer values,
 * seed the shared top sprites, then dispatch to the board's own object setup.
 *
 * Called once per board build. It lays down the common initial state every board needs and
 * then hands off to the board-specific object seeding. Concretely:
 *
 *   1. Zero the player/motion state block (39 bytes) and the big object-record +
 *      sprite-buffer span (17 blocks of 128 bytes). A clean slate.
 *   2. Copy the 64-byte board-object template out of program memory over the head of the
 *      span just cleared — that head is the object-record header block.
 *   3. Bonus starting value = min(LEVEL*10 + 40, 80), all at byte width. Stored three
 *      times: BONUS_START, BONUS and BONUS_EVENT_MARK.
 *   4. Bonus tick period = max(220 − 2*bonus, 40) into BONUS_PERIOD and BONUS_TICK. The
 *      floor of 40 is unreachable for the clamped bonus range above, but the hardware
 *      applies it and so does this.
 *   5. Set the two constant hit-box copies to 4 and 8.
 *   6. Unless BOARD is the 100m rivet board (bit 2 set — only the value 4 has it), seed
 *      three 4-byte sprite records near the top of the sprite shadow buffer: X stepping
 *      0x4F / 0x5F / 0x6F, code 0x3A, attribute 0x0F, Y 0x18.
 *   7. Dispatch on BOARD to the per-board object setup: 1 = 25m, 2 = 50m, 3 = 75m,
 *      4 = 100m, as a table of function references.
 *
 * Step 7 is a TAIL dispatch — this routine has no return of its own, and the board setup it
 * picks returns straight to whoever asked for the board build.
 *
 * LIVE-OUT: memory-only, and the bulk of it is the two cleared spans plus whatever the
 * dispatched board setup writes.
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
} from "./names.js";

// The per-board object setup, as a table of function references indexed by BOARD:
// 1=25m, 2=50m, 3=75m, 4=100m. BOARD is never 0 here — index 0 is an unused slot.
const BOARD_SETUP = {
  1: seed25mBoardObjects,
  2: seed50mBoardObjects,
  3: seed75mBoardObjects,
  4: seed100mBoardObjects,
};

export function initBoardState(m) {
  const { mem } = m;

  // 1. Clear the player/motion state block, then the object-record + sprite-buffer span.
  for (let a = 0x6200; a <= 0x6226; a++) mem.write8(a, 0x00); // 39 bytes
  for (let a = 0x6280; a < 0x6b00; a++) mem.write8(a, 0x00); // 17 blocks of 128

  // 2. Overwrite the head of that span with the board-object template.
  for (let i = 0; i < 0x40; i++) mem.write8(0x6280 + i, mem.read8(0x3d9c + i));

  // 3. Bonus starting value = min(LEVEL*10 + 40, 80), byte arithmetic throughout.
  let bonus = (mem.read8(LEVEL) * 10 + 0x28) & 0xff;
  if (bonus > 0x50) bonus = 0x50; // clamped to 80
  mem.write8(BONUS_START, bonus);
  mem.write8(BONUS, bonus);
  mem.write8(BONUS_EVENT_MARK, bonus);

  // 4. Bonus tick period = max(220 - 2*bonus, 40).
  let period = (0xdc - 2 * bonus) & 0xff;
  if (period < 0x28) period = 0x28; // floored at 40
  mem.write8(BONUS_PERIOD, period);
  mem.write8(BONUS_TICK, period);

  // 5. The two constant hit-box copies.
  mem.write8(0x6209, 0x04);
  mem.write8(0x620a, 0x08);

  // 6. Read BOARD once (both the bit-2 gate and the dispatch index use it). On every
  //    board except the 100m rivet board (bit 2 set == value 4), seed three sprite
  //    records near the top of the sprite shadow buffer.
  const board = mem.read8(BOARD);
  if ((board & 0x04) === 0) {
    let code = 0x4f;
    for (let i = 0; i < 3; i++) {
      const rec = 0x6a00 + i * 4;
      mem.write8(rec + 0, code);
      mem.write8(rec + 1, 0x3a);
      mem.write8(rec + 2, 0x0f);
      mem.write8(rec + 3, 0x18);
      code = (code + 0x10) & 0xff;
    }
  }

  // 7. Tail-dispatch to the board's own object setup.
  BOARD_SETUP[board](m);
}
