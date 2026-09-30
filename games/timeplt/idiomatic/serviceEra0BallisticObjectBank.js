// SPDX-License-Identifier: GPL-3.0-only
/** serviceEra0BallisticObjectBank — in era zero only, run one frame of the three-slot ballistic-object bank from the top:
 * start the cursors at the first slot, then step an empty first slot, fly a ballistic (0xFF) first slot
 * before stepping it, or hand any other first-slot marker to the servicing sweep; outside era zero do
 * nothing. LIVE-OUT: memory; in era zero, returns where the bank's cursors stopped
 * ({ record, sprite, count }). */

import { advanceSlotThenSweepObjectBankByHead } from "./advanceSlotThenSweepObjectBankByHead.js";
import { sweepObjectSlotBankServicingFirstSlot } from "./sweepObjectSlotBankServicingFirstSlot.js";
import { flyAlongBallisticArc } from "./flyAlongBallisticArc.js";
import { ERA_INDEX, ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_RECORD_SLOT0 } from "./names.js";

const BANK_SLOTS = 0x03;
const EMPTY = 0x00;
const BALLISTIC = 0xff;

export function serviceEra0BallisticObjectBank(m) {
  const { mem8 } = m;
  if (mem8[ERA_INDEX] !== 0) return;

  const record = ERA_OBJECT_RECORD_SLOT0;
  const sprite = ERA_OBJECT_ENTRY_SLOT0;
  const marker = mem8[record];
  if (marker === EMPTY) return advanceSlotThenSweepObjectBankByHead(m, record, sprite, BANK_SLOTS);
  if (marker !== BALLISTIC) return sweepObjectSlotBankServicingFirstSlot(m, record, sprite, BANK_SLOTS);
  flyAlongBallisticArc(m, record, sprite);
  return advanceSlotThenSweepObjectBankByHead(m, record, sprite, BANK_SLOTS);
}
