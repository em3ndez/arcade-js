// SPDX-License-Identifier: GPL-3.0-only
/**
 * initBoardState — reset the per-board work RAM, compute the board's bonus/timer
 * values, seed the shared top sprites, then dispatch to the board's object setup.
 * ROM 0x0F56.
 *
 * Called once per board build, from loc_0d5f (`call 0x0F56`). It lays down the common
 * initial state every board needs and then hands off to the board-specific object
 * seeding. Concretely:
 *
 *   1. Zero the player/motion state block 0x6200–0x6226 (39 bytes) and the big
 *      object-record + sprite-buffer span 0x6280–0x6AFF (17×0x80). A clean slate.
 *   2. Copy the 0x40-byte board-object template from ROM 0x3D9C into 0x6280 (over the
 *      just-cleared span — this is the object-record header block).
 *   3. Bonus starting value = min(LEVEL*10 + 0x28, 0x50), all mod 256. Stored three
 *      times: BONUS_START / BONUS / BONUS_EVENT_MARK (0x62B0/B1/B2). The *10 is the
 *      oracle's `and a`/`rla` triple-double (A*8) summed with two more copies of A —
 *      byte-wrapping arithmetic, reproduced with `& 0xff`.
 *   4. Bonus tick period = max(0xDC − 2*bonus, 0x28) into BONUS_PERIOD / BONUS_TICK
 *      (0x62B3/B4). (The 0x28 floor is unreachable for the clamped bonus range, but is
 *      faithfully kept.)
 *   5. Set the two constant hit-box copies 0x6209 = 4, 0x620A = 8.
 *   6. Unless BOARD is the 100m rivet board (BOARD bit 2 set — only value 4 has it),
 *      seed three 4-byte sprite records at 0x6A00 (X = 0x4F/0x5F/0x6F, code 0x3A,
 *      attr 0x0F, Y 0x18) inside the sprite shadow buffer.
 *   7. Dispatch on BOARD (0x6227) to the per-board object setup — the ROM 0x0FCD
 *      rst-0x28 jump table, expressed here as a table of function references
 *      (doc-06): 1→25m, 2→50m, 3→75m, 4→100m.
 *
 * The Z80 exits this routine by `ld a,c / rst 0x28` (tail-dispatch through the 0x0FCD
 * table) — it has no `ret` of its own; the dispatched board setup's `ret` returns to
 * the caller's 0x0D62 (`call 0x2441`). The idiomatic model drops that stack dance:
 * the rst-0x28 trampoline becomes a direct JS call through BOARD_SETUP, and the Z80
 * call stack becomes the JS call stack.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0f56.test.js.
 * GATE:     crafted-entry — real captured attract dispatches (BOARD 1, the only board
 *           attract plays) + crafted BOARD 2/3/4 and a full LEVEL 0..255 sweep (poke
 *           0x6227 / 0x6229 identically both sides) for the arms/values attract never
 *           reaches; teeth = a period-doubling bug and a wrong bit-gate twin.
 * LIVE-OUT: memory-only. No `ret`: a tail-dispatch whose eventual return lands on a
 *           `call` (0x0D62) that reads no register this routine leaves. SP/PC/flags are
 *           dead — the JS call stack replaces the Z80 stack (compared: RAM −STACK_SCRATCH).
 * NAMES:    LEVEL, BOARD, BONUS_START/BONUS/BONUS_EVENT_MARK/BONUS_PERIOD/BONUS_TICK
 *           (ram.js). Hex-kept: the 0x6200–0x6226 / 0x6280–0x6AFF clear spans and the
 *           0x6A00 sprite triple (bulk regions), ROM source 0x3D9C (a ROM offset), and
 *           0x6209/0x620A (rejected in ram.js — unused constant 4/8 copies).
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
} from "./ram.js";

// The ROM 0x0FCD rst-0x28 jump table, as a table of function references (doc-06's
// idiom for computed dispatch). Indexed by BOARD (0x6227): 1=25m, 2=50m, 3=75m,
// 4=100m. The ROM table's index 0 is the unused 0x0000 slot; BOARD is never 0 here.
const BOARD_SETUP = {
  1: seed25mBoardObjects, // ROM 0x0FD7
  2: seed50mBoardObjects, // ROM 0x101F
  3: seed75mBoardObjects, // ROM 0x1087
  4: seed100mBoardObjects, // ROM 0x1131
};

export function initBoardState(m) {
  const { mem } = m;

  // 1. Clear the player/motion state block, then the object-record + sprite-buffer span.
  for (let a = 0x6200; a <= 0x6226; a++) mem.write8(a, 0x00); // 0x27 bytes
  for (let a = 0x6280; a < 0x6b00; a++) mem.write8(a, 0x00); // 17 blocks of 0x80

  // 2. Overwrite the head of that span with the board-object template from ROM.
  for (let i = 0; i < 0x40; i++) mem.write8(0x6280 + i, mem.read8(0x3d9c + i));

  // 3. Bonus starting value = min(LEVEL*10 + 0x28, 0x50), byte arithmetic throughout.
  let bonus = (mem.read8(LEVEL) * 10 + 0x28) & 0xff;
  if (bonus > 0x50) bonus = 0x50; // `cp 0x51` keeps < 0x51, else clamps to 0x50
  mem.write8(BONUS_START, bonus);
  mem.write8(BONUS, bonus);
  mem.write8(BONUS_EVENT_MARK, bonus);

  // 4. Bonus tick period = max(0xDC - 2*bonus, 0x28).
  let period = (0xdc - 2 * bonus) & 0xff;
  if (period < 0x28) period = 0x28; // `cp 0x28` keeps >= 0x28, else clamps to 0x28
  mem.write8(BONUS_PERIOD, period);
  mem.write8(BONUS_TICK, period);

  // 5. The two constant hit-box copies.
  mem.write8(0x6209, 0x04);
  mem.write8(0x620a, 0x08);

  // 6. Read BOARD once (both the bit-2 gate and the dispatch index use it). On every
  //    board except the 100m rivet board (bit 2 set == value 4), seed three sprite
  //    records at 0x6A00 in the sprite shadow buffer.
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
