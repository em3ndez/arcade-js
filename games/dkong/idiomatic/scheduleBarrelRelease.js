// SPDX-License-Identifier: GPL-3.0-only
/**
 * scheduleBarrelRelease — the 25m periodic bonus-event scheduler: decide, this pass, whether to
 * dispatch into the bonus-event slot-claim cluster, and by which route.
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

const BOARD_MASK = 0x01;   // board-test mask: bit 0 = 25m only
const EVENT_GATE = 0x6393; // bit 0 set -> skip this pass

export function scheduleBarrelRelease(m) {
  const { regs, mem8 } = m;

  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return;

  if (!marioActiveGuard(m)) return;

  if ((mem8[EVENT_GATE] & 0x01) !== 0) return;

  const bonus = mem8[BONUS];
  if (bonus === 0) return;

  const stepped = u8(mem8[BONUS_START] - 2);
  if (stepped < bonus) {
    regs.a = stepped;
    regs.c = bonus;
    return loc_2c7b(m);
  }

  if ((mem8[BARREL_CLAIM_MODE] & 0x02) !== 0) {
    regs.c = bonus;
    return loc_2c86(m);
  }

  // Periodic phase test: match the low 5 bits of FRAME against the difficulty countdown.
  const framePhase = mem8[FRAME] & 0x1f;
  let countdown = mem8[DIFFICULTY];
  let matched = false;
  for (;;) {
    if (framePhase === countdown) { matched = true; break; }
    countdown = u8(countdown - 1);
    if (countdown === 0) break;
  }
  if (!matched) return;

  const halfStart = mem8[BONUS_START] >> 1;
  if (halfStart < bonus) {
    regs.c = bonus;
    return loc_2c41(m);
  }

  // Otherwise fire only on odd spin-counter frames.
  if ((mem8[SPIN_COUNT] & 0x01) === 0) return;

  regs.c = bonus;
  return loc_2c41(m);
}
