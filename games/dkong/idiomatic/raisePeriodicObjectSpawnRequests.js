// SPDX-License-Identifier: GPL-3.0-only
/**
 * raisePeriodicObjectSpawnRequests — on 50m and 100m, while Mario is alive, raise two one-shot
 * request latches on a difficulty-scaled period. A board gate and an alive gate open the routine;
 * a narrowing low-bit mask on the frame counter (narrower as difficulty rises) picks the firing
 * frames. The routine only raises the latches; it never clears them.
 *
 * LIVE-OUT: memory-only — the two request latches, and only on a firing frame.
 */
import { DIFFICULTY, BOARD, FRAME, EVENT_REQ_313C, OBJ_SPAWN_REQ } from "./names.js";
import { boardBitGate } from "./boardBitGate.js";
import { marioActiveGuard } from "./marioActiveGuard.js";
import { u8 } from "../../../core/int.js";

const BOARD_MASK = 0x0a; // current-board bit only on 50m/100m

export function raisePeriodicObjectSpawnRequests(m) {
  const { regs, mem8 } = m;

  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return;

  if (!marioActiveGuard(m)) return;

  // Step count grows with difficulty (and by one more on 50m); it narrows the trigger mask.
  let steps = u8(mem8[DIFFICULTY] + 1) >> 1;
  if (mem8[BOARD] === 2) steps += 1;

  let mask = 0xfe;
  const turns = steps === 0 ? 256 : steps; // a 0 step count runs the full 256-turn wrap
  for (let i = 0; i < turns; i++) {
    mask = ((i === 0 ? 0x80 : 0) | (mask >> 1)) & 0xff;
  }

  if ((mem8[FRAME] & mask) !== 0) return;

  mem8[EVENT_REQ_313C] = 1;
  mem8[OBJ_SPAWN_REQ] = 1;
}
