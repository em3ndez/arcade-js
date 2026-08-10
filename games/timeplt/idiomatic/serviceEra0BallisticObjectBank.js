// SPDX-License-Identifier: GPL-3.0-only
/** serviceEra0BallisticObjectBank — in era zero only, run one frame of the three-slot ballistic-object bank from the top:
 * seat the cursors, then step an empty first slot, fly a ballistic (0xFF) first slot before stepping
 * it, or hand any other first-slot marker to the servicing sweep; outside era zero do nothing.
 * LIVE-OUT: memory. */

import { advanceSlotThenSweepObjectBankByHead } from "./advanceSlotThenSweepObjectBankByHead.js";
import { sweepObjectSlotBankServicingFirstSlot } from "./sweepObjectSlotBankServicingFirstSlot.js";
import { flyAlongBallisticArc } from "./flyAlongBallisticArc.js";

const ERA_INDEX = 0xad04;
const RECORD_SEAT = 0xa8c0;
const SPRITE_SEAT = 0xaa28;
const BANK_SLOTS = 0x03;
const EMPTY = 0x00;
const BALLISTIC = 0xff;

export function serviceEra0BallisticObjectBank(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] !== 0) return;

  regs.ix = RECORD_SEAT;
  regs.iy = SPRITE_SEAT;
  regs.b = BANK_SLOTS;

  const marker = mem8[regs.ix];
  if (marker === EMPTY) return advanceSlotThenSweepObjectBankByHead(m);
  if (marker !== BALLISTIC) return sweepObjectSlotBankServicingFirstSlot(m);
  flyAlongBallisticArc(m);
  return advanceSlotThenSweepObjectBankByHead(m);
}
