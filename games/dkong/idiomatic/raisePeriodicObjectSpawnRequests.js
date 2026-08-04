// SPDX-License-Identifier: GPL-3.0-only
/**
 * raisePeriodicObjectSpawnRequests — on 50m and 100m, while Mario is alive, raise two one-shot
 * request latches on a difficulty-scaled period.
 *
 * Called every frame by the per-frame cascade. Two skip gates open the routine, and then a
 * periodic trigger decides whether this is a firing frame. On a firing frame both latches go
 * to 1; on every other frame the routine does nothing at all.
 *   - a board test against the mask 0x0A. The mask's set bits are the current-board bit only
 *     on 50m and 100m, so on 25m and 75m the whole routine is skipped.
 *   - an alive test: Mario must be alive and being processed, else skip.
 *
 * The trigger is a low-bit mask on the frame counter that NARROWS as difficulty rises, so the
 * requests come more often the harder the board:
 *   - steps = (DIFFICULTY + 1) >> 1, plus one more on 50m. Across the in-play difficulty range
 *     of 1..5 that is 1 to 4 steps.
 *   - the mask's run of set low bits is folded down once per step: 1 step gives 0xFF, 2 gives
 *     0x7F, 3 gives 0x3F, 4 gives 0x1F, on to 8 giving 0x01. A step count of 0 — which needs a
 *     wrapped DIFFICULTY byte — or of 9 and up folds every bit away and leaves mask 0.
 *   - the trigger fires on the frames where the frame counter lands zero under the mask, i.e.
 *     every 2^(9 - steps) frames: 0xFF is one frame in 256, 0x1F one in 32, and mask 0 fires
 *     every frame.
 *
 * The routine only RAISES the two latches. It never clears them and never checks whether the
 * previous request was serviced, so a request that is not consumed before the next firing
 * frame is simply re-asserted. What it does NOT decide is which object eventually appears on
 * screen; that is settled wherever the latches are read.
 *
 * LIVE-OUT: memory-only — the two request latches, and only on a firing frame.
 */
import { DIFFICULTY, BOARD, FRAME, EVENT_REQ_313C, OBJ_SPAWN_REQ } from "./names.js";
import { boardBitGate } from "./boardBitGate.js";
import { marioActiveGuard } from "./marioActiveGuard.js";
import { u8 } from "../../../core/int.js";

const BOARD_MASK = 0x0a; // applicability mask: the current-board bit only on 50m/100m

export function raisePeriodicObjectSpawnRequests(m) {
  const { regs, mem } = m;

  // Gate 1 — the board test. The mask is passed in regs.a, and 0x0A selects the
  // current-board bit only on 50m (BOARD 2) and 100m (BOARD 4).
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return; // not 50m/100m -> skip the whole routine

  // Gate 2 — the alive test, which takes no input of its own.
  if (!marioActiveGuard(m)) return; // Mario dead -> skip

  // Step count grows with difficulty (and by one more on 50m); it narrows the trigger mask.
  let steps = u8(mem.read8(DIFFICULTY) + 1) >> 1;
  if (mem.read8(BOARD) === 2) steps += 1;

  // Fold the mask's run of set low bits down once per step, from a wide 0xFE seed with one
  // set bit folded in at the top. Wider mask (low difficulty) = rarer trigger; a 0 or large
  // step count folds the mask all the way to 0 (fires every frame).
  let mask = 0xfe;
  const turns = steps === 0 ? 256 : steps; // a 0 step count runs the full 256-turn wrap
  for (let i = 0; i < turns; i++) {
    mask = ((i === 0 ? 0x80 : 0) | (mask >> 1)) & 0xff;
  }

  // Trigger fires on the frames that land zero under the mask; otherwise nothing this frame.
  if ((mem.read8(FRAME) & mask) !== 0) return;

  // Firing frame: raise both one-shot request latches.
  mem.write8(EVENT_REQ_313C, 1);
  mem.write8(OBJ_SPAWN_REQ, 1);
}
