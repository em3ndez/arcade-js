// SPDX-License-Identifier: GPL-3.0-only
/**
 * raisePeriodicObjectSpawnRequests — raise two periodic event requests, on 50m/100m, while Mario is alive.  ROM 0x2DDB.
 *
 * Called every frame by the per-frame cascade loc_197a. Two skip gates open the routine,
 * then it fires a difficulty-scaled periodic trigger: when the trigger lands this frame it
 * raises two one-shot request latches (EVENT_REQ_313C and OBJ_SPAWN_REQ) to 1; otherwise it does nothing.
 *   • rst 0x30 with the board mask 0x0A (boardBitGate): bits 1 and 3 of the mask are the
 *     current-board bit only on 50m (BOARD 2) and 100m (BOARD 4) — so on 25m / 75m the whole
 *     routine is skipped.
 *   • rst 0x10 (marioActiveGuard): Mario must be alive / being processed, else skip.
 *
 * The trigger is a low-bit mask on the frame counter that NARROWS as difficulty rises, so
 * the event fires more often the harder the board:
 *   • steps = (DIFFICULTY + 1) >> 1, plus one more on 50m (BOARD 2). Across the in-play
 *     difficulty range (1..5) this is 1..4.
 *   • The mask starts wide (all-but-one low bits set) and its run of set low bits is folded
 *     down once per step: 1 step -> 0xFF, 2 -> 0x7F, 3 -> 0x3F, 4 -> 0x1F, ... 8 -> 0x01, and
 *     a 0 or >=9 step count leaves no bits (mask 0, fires every frame).
 *   • The event fires on the frames where FRAME lands zero under the mask — i.e. every
 *     2^(9-steps)th frame (mask 0x7F -> every 128, 0x1F -> every 32, mask 0 -> every frame).
 * On a firing frame both request latches are set to 1; they are consumed elsewhere
 * (OBJ_SPAWN_REQ by sub_2523 as its pending "request", EVENT_REQ_313C by entry_313c) and this
 * routine only raises them, never clears them.
 *
 * NAME: PROMOTED in understanding pass 12. The corroboration is that BOTH cells it writes are
 * [seen]-GROUNDED in names.js and BOTH name this routine as their producer: OBJ_SPAWN_REQ (0x639A) —
 * "Object-SPAWN request into OBJ_ARRAY_65A0 (the 50m moving objects), consumed by
 * service50mObjectSpawnRequest ... Producer: loc_2ddb" — and EVENT_REQ_313C (0x63A0), whose note
 * records that two producers raise it, the first being "loc_2ddb's difficulty-scaled periodic
 * trigger (50m/100m)". When this file was first written those cells were unrated engine scratch;
 * they have since been grounded live vs MAME ({0,1}, 128-frame rise period on 100m, consumed within
 * a frame or two), which is exactly what closes its old "not grounded here" caveat. The verb is
 * chosen by EFFECT per the naming rules: what this routine CAUSES is objects being requested.
 * WHAT THIS NAME DOES NOT CLAIM: which on-screen object eventually appears. That is the consumer's
 * business (service50mObjectSpawnRequest / spawnRequestedFireAndRecolorLiveFires), and it is not asserted here.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2ddb.test.js.
 * GATE:     captured + crafted. Real attract dispatches exercise the rst-0x30-closed skip
 *           (attract plays 25m, so the board gate is shut). Crafted entries on a real attract
 *           base then drive boards 2 and 4 with Mario alive across a difficulty sweep and the
 *           full 0..255 frame range (so the exact mask boundary is swept for every mask value
 *           0xFF..0x00, including the difficulty-0 / difficulty-wrap edges), the alive-gate
 *           skip, and the board-gate skip on 25m / 75m. The RAM diff excludes the dead
 *           STACK_SCRATCH the oracle's rst push16/ret churn writes; pc + SP are compared after
 *           modelling the single terminal caller-return that every path nets (one m.ret()).
 *           Teeth: twins that skip the alive gate, skip the board gate, use the wrong board
 *           mask, drop the 50m step bump, invert the trigger polarity, and raise only one latch.
 * LIVE-OUT: memory-only. raisePeriodicObjectSpawnRequests is called by the per-frame cascade loc_197a, which issues its
 *           next call without reading any register this routine leaves (the residual A / B and
 *           the flags are all dead). The two boolean-guard returns replace the rst-0x30 /
 *           rst-0x10 caller-skip stack idiom; the terminal ret pops the one caller-return every
 *           path consumes.
 * NAMES:    DIFFICULTY (0x6380), BOARD (0x6227), FRAME (0x601A), EVENT_REQ_313C (0x63A0),
 *           OBJ_SPAWN_REQ (0x639A) — all from names.js. The board mask 0x0A is a literal.
 *           Callees direct-called: boardBitGate (ROM 0x0030, reads regs.a + BOARD 0x6227),
 *           marioActiveGuard (ROM 0x0010, reads MARIO_ACTIVE 0x6200).
 */

import { DIFFICULTY, BOARD, FRAME, EVENT_REQ_313C, OBJ_SPAWN_REQ } from "./names.js";
import { boardBitGate } from "./boardBitGate.js";        // ROM 0x0030 (rst 0x30)
import { marioActiveGuard } from "./marioActiveGuard.js"; // ROM 0x0010 (rst 0x10)
import { u8 } from "../../../core/int.js";

const BOARD_MASK = 0x0a; // rst-0x30 applicability mask: the current-board bit only on 50m/100m

export function raisePeriodicObjectSpawnRequests(m) {
  const { regs, mem } = m;

  // Gate 1 — rst 0x30 board test. boardBitGate reads the mask from regs.a; mask 0x0A
  // selects the current-board bit only on 50m (BOARD 2) and 100m (BOARD 4).
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return; // not 50m/100m -> skip the whole routine

  // Gate 2 — rst 0x10 alive test (reads MARIO_ACTIVE, no register input).
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
