// SPDX-License-Identifier: GPL-3.0-only
/** serviceEra0BallisticObjectBank — in era zero only, run one frame of the three-slot ballistic-object bank from the top:
 * seat the cursors, then step an empty first slot, fly a ballistic (0xFF) first slot before stepping
 * it, or hand any other first-slot marker to the servicing sweep; outside era zero do nothing.
 * LIVE-OUT: memory. */

import { advanceSlotThenSweepObjectBankByHead } from "./advanceSlotThenSweepObjectBankByHead.js";
import { sweepObjectSlotBankServicingFirstSlot } from "./sweepObjectSlotBankServicingFirstSlot.js";
import { flyAlongBallisticArc } from "./flyAlongBallisticArc.js";
import { ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_RECORD_SLOT0 } from "./names.js";

const ERA_INDEX = 0xad04;
const BANK_SLOTS = 0x03;
const EMPTY = 0x00;
const BALLISTIC = 0xff;

export function serviceEra0BallisticObjectBank(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] !== 0) return;

  regs.ix = ERA_OBJECT_RECORD_SLOT0;
  regs.iy = ERA_OBJECT_ENTRY_SLOT0;
  regs.b = BANK_SLOTS;

  const marker = mem8[regs.ix];
  if (marker === EMPTY) return advanceSlotThenSweepObjectBankByHead(m);
  if (marker !== BALLISTIC) return sweepObjectSlotBankServicingFirstSlot(m);
  flyAlongBallisticArc(m);
  return advanceSlotThenSweepObjectBankByHead(m);
}
