// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchBonusExpiredStep — run the bonus-expired state machine's current step.  ROM 0x1A07.
 *
 * BONUS_EXPIRED_STEP (0x6386) is a tiny four-state machine that drives the
 * "on-screen BONUS reached 0 → kill the player" sequence. The per-frame gameplay
 * cascade loc_197a calls this router every frame (its ONE caller, at ROM 0x19BF)
 * via the ROM's `ld a,(0x6386) / rst 0x28` — an rst-0x28 inline jump table whose
 * four target words at ROM 0x1A0B are:
 *
 *   step 0  idx0  bonusExpiredIdle                        (0x1A1E) BONUS still > 0 — no-op
 *   step 1  idx1  startBonusExpiredDelay                  (0x1A15) INIT: clear delay, go step 2
 *   step 2  idx2  advanceBonusExpiredStepWhenDelayExpires (0x1A1F) DELAY: count down; at 0 → step 3
 *   step 3  idx3  advanceSubstateWhenGrounded             (0x1A2A) WAIT+EXIT: once grounded, exit
 *
 * Because rst-0x28 dispatches by JUMP (not call), each handler's `ret` returns to
 * loc_197a, not to this router — i.e. the router is transparent, and its result to
 * loc_197a is a caller-skip boolean: true = "cascade continues this frame", false =
 * "abort the rest of loc_197a for this frame". Only the idx3 handler ever produces a
 * false (its grounded arm takes the death exit); steps 0/1/2 always continue, so this
 * router returns their constant true. In the oracle that split is literally
 * `{ handler(); return true; }` for idx0/1/2 vs `return handler()` for idx3, mirrored
 * exactly below.
 *
 * The oracle's rst-0x28 pointer walk (double the step, pop the inline table base,
 * read table[step], jp) is pure address plumbing over a fixed 4-entry ROM table on a
 * byte (0x6386) only ever 0..3, so it collapses to a direct switch on the step. Steps
 * ≥ 4 are the ROM table's `dw 0x0000` frontier (a wild `jp 0x0000`); the byte never
 * leaves 0..3 in play, so like the oracle this is a non-executing frontier — reproduced
 * as a NotImplemented throw rather than a silent fall-through.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1a07.test.js.
 * GATE:     crafted-entry — real captured attract dispatches (all step 0, ~hundreds/run;
 *           BONUS never expires in attract) with a fresh clone per side, PLUS crafted
 *           step 1/2/3 entries (attract never reaches them) poked identically on both
 *           sides and swept over the handlers' own inputs (delay byte for step 2,
 *           MARIO_AIRBORNE for step 3). Compared on RAM (minus STACK_SCRATCH) + the
 *           caller-skip boolean; teeth = a mis-routed-step twin (RAM) and a
 *           dropped-skip twin (return). SP set into STACK_SCRATCH so the oracle's
 *           rst/ret residue lands in the excluded region.
 * LIVE-OUT: memory (whatever the dispatched handler writes) + the boolean caller-skip
 *           return that loc_197a consumes (`if (!m.call(0x1a07)) return;`). No live
 *           registers/flags out — loc_197a's very next act is another call (0x2FCB)
 *           that overwrites A/flags, so the oracle's residual regs are dead ABI; SP/pc
 *           are the dropped Z80 stack model.
 * NAMES:    BONUS_EXPIRED_STEP (0x6386) from names.js — the dispatcher's state byte. The
 *           four handlers own the RAM they touch (delay counter, sub-state, timer, …).
 */

import { NotImplemented } from "../../../boards/dkong/io.js";
import { BONUS_EXPIRED_STEP } from "./names.js";
import { bonusExpiredIdle } from "./bonusExpiredIdle.js"; // ROM 0x1A1E — idx0 no-op
import { startBonusExpiredDelay } from "./startBonusExpiredDelay.js"; // ROM 0x1A15 — idx1 INIT
import { advanceBonusExpiredStepWhenDelayExpires } from "./advanceBonusExpiredStepWhenDelayExpires.js"; // ROM 0x1A1F — idx2 DELAY
import { advanceSubstateWhenGrounded } from "./advanceSubstateWhenGrounded.js"; // ROM 0x1A2A — idx3 WAIT+EXIT

export function dispatchBonusExpiredStep(m) {
  const step = m.mem.read8(BONUS_EXPIRED_STEP);

  switch (step) {
    case 0: // idx0 — idle: BONUS not yet expired, do nothing; cascade continues.
      bonusExpiredIdle(m);
      return true;
    case 1: // idx1 — INIT: clear the delay counter, advance to step 2; cascade continues.
      startBonusExpiredDelay(m);
      return true;
    case 2: // idx2 — DELAY: tick the counter down, advance to step 3 at 0; cascade continues.
      advanceBonusExpiredStepWhenDelayExpires(m);
      return true;
    case 3: // idx3 — WAIT+EXIT: hold until grounded, then take the death exit. This is
      // the only step that can abort the frame, so its skip boolean is propagated as-is.
      return advanceSubstateWhenGrounded(m);
    default:
      // step ≥ 4: the ROM jump table holds `dw 0x0000` past idx3 (a wild jp 0x0000).
      // BONUS_EXPIRED_STEP is never out of 0..3 in play — a non-executing frontier.
      throw new NotImplemented(
        `dispatchBonusExpiredStep: BONUS_EXPIRED_STEP=0x${(step & 0xff).toString(16)} ` +
          "out of the 0..3 range (rst-0x28 table past idx3 is dw 0x0000 -> wild jp 0x0000); " +
          "non-executing frontier.",
      );
  }
}
