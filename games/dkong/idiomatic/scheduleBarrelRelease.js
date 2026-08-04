// SPDX-License-Identifier: GPL-3.0-only
/**
 * scheduleBarrelRelease — the 25m periodic bonus-event scheduler: decide, this pass, whether to
 * dispatch into the bonus-event slot-claim cluster, and by which route.
 *
 * It runs only when three gates open in a row, and then weighs the live bonus against the board's
 * starting bonus and against the difficulty/frame phase, to pick whether — and how — to fire the
 * periodic slot claim. What that claim eventually produces is the release of a 25m barrel of the
 * alternate kind, so this is the pacing of barrels rather than the release itself.
 *
 * The gates, in order:
 *   1. The board test, with the 25m bit: only 25m runs this at all, and the whole routine is
 *      skipped on 50m, 75m and 100m.
 *   2. The alive test — Mario must be alive.
 *   3. Bit 0 of the event-gate scratch must be CLEAR.
 * Then, with the live bonus in hand (a zero bonus ends the pass — nothing left to schedule):
 *   - If the starting bonus minus 2 has fallen below the live bonus, hand off immediately to the
 *     stepped-value entry, forwarding the stepped value and the bonus.
 *   - Else, if bit 1 of BARREL_CLAIM_MODE is set, hand off to the clear-then-mode-3 entry,
 *     forwarding the bonus.
 *   - Else run a periodic phase test: match the low 5 bits of the frame counter against the
 *     difficulty countdown (difficulty, difficulty-1, .., 1). No match this frame ends the pass.
 *   - On a match, if half the starting bonus has fallen below the live bonus, dispatch the cluster
 *     head. Otherwise fire only on odd spin-counter frames — on an even one nothing happens; on an
 *     odd one, fall through to that same cluster head.
 *
 * BARREL_CLAIM_MODE is a mode byte and not a bare flag: its low bits carry the claim's mode value
 * while its top bit selects the barrel kind further downstream. This routine tests bit 1 of it and
 * writes none of it.
 *
 * All three cluster entries take their live-ins in registers, so the values they read are loaded
 * just before each tail call; the board test likewise takes its applicability mask in a register.
 *
 * LIVE-OUT: memory-only. Every exit either returns having written nothing of its own, or
 * tail-dispatches a cluster entry that returns nothing.
 */

import { u8 } from "../../../core/int.js";
import { boardBitGate } from "./boardBitGate.js";
import { marioActiveGuard } from "./marioActiveGuard.js";
import { loc_2c7b } from "./loc_2c7b.js";
import { loc_2c86 } from "./loc_2c86.js";
import { loc_2c41 } from "./loc_2c41.js";
import { BONUS_START, BONUS, DIFFICULTY, FRAME, SPIN_COUNT, BARREL_CLAIM_MODE } from "./names.js";

const BOARD_MASK = 0x01;   // applicability mask for the board test: bit 0 = 25m only
const EVENT_GATE = 0x6393; // bit 0 SET -> skip this pass. Shared engine scratch, so it has no name.

export function scheduleBarrelRelease(m) {
  const { regs, mem } = m;

  // Gate 1 — the board test, which reads its mask from a register: only 25m runs this.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return; // closed off 25m -> skip the whole routine

  // Gate 2 — the alive test, which reads MARIO_ACTIVE and takes no input.
  if (!marioActiveGuard(m)) return; // Mario dead -> skip

  // Gate 3 — bit 0 of the event-gate scratch: return when it is SET.
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

  // Bit1 of the slot-claim mode byte selects the clear-then-mode-3 cluster entry. Forward the bonus.
  if ((mem.read8(BARREL_CLAIM_MODE) & 0x02) !== 0) {
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
