// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c03 — board-1 (25m) periodic bonus-event scheduler: decide, this pass, whether to
 * dispatch into the bonus-event slot-claim cluster and by which route.  ROM 0x2C03.
 *
 * Called from the board-1 barrel-release path. It runs only when three gates open in a row,
 * then weighs the live bonus against the board's starting bonus and the difficulty/frame
 * phase to pick if — and how — to fire the periodic slot-claim event that the cluster at
 * 0x2C41 carries out (the same cluster reached by all three tails here).
 *
 * The gates, in order:
 *   1. rst 0x30 board test with mask 0x01 — only 25m runs this; the whole routine is skipped
 *      on 50m/75m/100m.
 *   2. rst 0x10 alive test — Mario must be alive.
 *   3. bit0 of the event-gate scratch (0x6393) must be CLEAR (the oracle's `rrca / ret c`).
 * Then, with the live bonus in hand (a zero bonus ends the pass — nothing left to schedule):
 *   - If the starting bonus minus 2 has fallen below the live bonus, hand off immediately to
 *     the stepped-value entry (loc_2c7b), forwarding the stepped value and the bonus.
 *   - Else, if bit1 of the request-flag scratch (0x6382) is set, hand off to the clear-then-
 *     mode-3 entry (loc_2c86), forwarding the bonus.
 *   - Else run a periodic phase test: match the low 5 bits of the frame counter against the
 *     difficulty countdown (difficulty, difficulty-1, .., 1). No match this frame ends the pass.
 *   - On a match, if half the starting bonus has fallen below the live bonus, dispatch the
 *     cluster head (loc_2c41). Otherwise fire only on odd spin-counter frames — on an even one
 *     nothing happens; on an odd one, fall through to that same cluster head.
 *
 * This is the exact TWIN of loc_03a2 (same rst 0x30 / rst 0x10 prologue) but reads the 0x2C..
 * cluster's cells (bonus pacing) with mask 0x01, and its body is the scheduler, not a sprite
 * arm.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c03.test.js.
 * GATE:     capture/clone/replay of real 25m attract dispatches + crafted entries driving
 *           every path — the three gate-closed skips, the zero-bonus early-out, all three
 *           cluster tails (loc_2c7b / loc_2c86 / loc_2c41 via both the phase-match jump and
 *           the odd-spin fall-through), the no-phase-match return, and the even-spin return.
 *           The RAM diff excludes the dead STACK_SCRATCH the oracle's push16/ret churn writes.
 *           Teeth: a twin that inverts the spin-parity return and a twin that drops the +2 step.
 * LIVE-OUT: memory-only. Every exit either returns having written nothing (or only the cluster's
 *           writes) or tail-dispatches a void cluster entry; the oracle's residual registers,
 *           flags, and terminal `ret` are dead ABI the board-1 caller does not read back.
 * NAMES:    boardBitGate (ROM 0x0030), marioActiveGuard (ROM 0x0010), loc_2c7b (ROM 0x2C7B),
 *           loc_2c86 (ROM 0x2C86), loc_2c41 (ROM 0x2C41) — all direct-called. From ram.js:
 *           BONUS_START (0x62B0), BONUS (0x62B1), DIFFICULTY (0x6380), FRAME (0x601A),
 *           SPIN_COUNT (0x6019). The two 0x63xx scratch cells (0x6393 event gate, 0x6382
 *           request flag) are rejected-as-shared engine scratch in ram.js — kept hex here.
 *
 * REGISTER-ABI MARSHALLING (dissolves once the cluster entries take honest args): the cluster
 * entries still read their live-ins from registers, so this routine loads exactly what the
 * oracle's tail `jp` sites leave — the stepped value in the accumulator and the bonus in C
 * before loc_2c7b, the bonus in C before loc_2c86 and loc_2c41. boardBitGate reads its mask
 * from the accumulator, so mask 0x01 is loaded before it.
 */

import { u8 } from "../../../core/int.js";
import { boardBitGate } from "./boardBitGate.js";       // ROM 0x0030 (rst 0x30)
import { marioActiveGuard } from "./marioActiveGuard.js"; // ROM 0x0010 (rst 0x10)
import { loc_2c7b } from "./loc_2c7b.js";               // ROM 0x2C7B — stepped-value entry
import { loc_2c86 } from "./loc_2c86.js";               // ROM 0x2C86 — clear-then-mode-3 entry
import { loc_2c41 } from "./loc_2c41.js";               // ROM 0x2C41 — slot-claim cluster head
import { BONUS_START, BONUS, DIFFICULTY, FRAME, SPIN_COUNT } from "./ram.js";

const BOARD_MASK = 0x01;   // rst-0x30 applicability mask: bit0 = 25m only
const EVENT_GATE = 0x6393; // bit0 SET -> skip this pass (unnamed, rejected-as-shared 0x63xx scratch)
const REQUEST_FLAG = 0x6382; // bit1 SET -> take the loc_2c86 tail (unnamed 0x63xx slot-claim scratch)

export function loc_2c03(m) {
  const { regs, mem } = m;

  // Gate 1 — rst 0x30 board test (mask 0x01: only 25m runs this). boardBitGate reads the mask.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return; // closed off 25m -> skip the whole routine

  // Gate 2 — rst 0x10 alive test (reads MARIO_ACTIVE, no register input).
  if (!marioActiveGuard(m)) return; // Mario dead -> skip

  // Gate 3 — bit0 of the event-gate scratch: return when it is SET (the oracle's `rrca / ret c`).
  if ((mem.read8(EVENT_GATE) & 0x01) !== 0) return;

  // No bonus left -> nothing to schedule.
  const bonus = mem.read8(BONUS);
  if (bonus === 0) return;

  // The starting bonus minus 2 has dropped below the live bonus -> the stepped-value entry,
  // which re-steps this value by +2. Forward the stepped value and the bonus.
  const stepped = u8(mem.read8(BONUS_START) - 2);
  if (stepped < bonus) {
    regs.a = stepped;
    regs.c = bonus;
    return loc_2c7b(m);
  }

  // Request-flag bit1 selects the clear-then-mode-3 cluster entry. Forward the bonus.
  if ((mem.read8(REQUEST_FLAG) & 0x02) !== 0) {
    regs.c = bonus;
    return loc_2c86(m);
  }

  // Periodic phase test: match the low 5 bits of the frame counter against the difficulty
  // countdown (difficulty, difficulty-1, .., 1). No match this frame -> nothing to do.
  const framePhase = mem.read8(FRAME) & 0x1f;
  let countdown = mem.read8(DIFFICULTY);
  let matched = false;
  for (;;) {
    if (framePhase === countdown) { matched = true; break; }
    countdown = u8(countdown - 1);
    if (countdown === 0) break; // walked past 1 with no match
  }
  if (!matched) return;

  // Half the starting bonus has dropped below the live bonus -> dispatch the cluster head.
  const halfStart = mem.read8(BONUS_START) >> 1;
  if (halfStart < bonus) {
    regs.c = bonus;
    return loc_2c41(m);
  }

  // Otherwise fire only on odd spin-counter frames; on an even one there is nothing to do.
  if ((mem.read8(SPIN_COUNT) & 0x01) === 0) return;

  // Odd spin frame: fall through into the same cluster head.
  regs.c = bonus;
  return loc_2c41(m);
}
