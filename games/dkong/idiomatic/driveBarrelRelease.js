// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveBarrelRelease — the release half of the 25m barrel engine. On the girder board, while Mario
 * is alive: if a barrel already went out this pass (EVENT_GATE), step its release animation; else if
 * a release is armed (BARREL_RELEASE_ARMED), walk the ten OBJ_ARRAY_67 records and hand the first free one
 * (both low OBJ_ACTIVE bits clear) to the claim. None free writes nothing.
 *
 * The walk counts DOWN because the claim derives the record's slot index from the remaining count,
 * not from a cursor — counting up would place the barrel in the mirror slot.
 *
 * LIVE-OUT: memory-only.
 */

import { boardBitGate } from "./boardBitGate.js";
import { marioActiveGuard } from "./marioActiveGuard.js";
import { advanceBarrelRelease } from "./advanceBarrelRelease.js";
import { releaseBarrelIntoFreeSlot } from "./releaseBarrelIntoFreeSlot.js";
import {
  BARREL_RELEASE_ARMED,
  OBJ_ACTIVE,
  OBJ_ARRAY_67,
} from "./names.js";

const BOARD_MASK = 1;          // per-board applicability mask: bit0 = the girder board only
const EVENT_GATE = 0x6393;     // bit0 SET -> a barrel already went out this pass (unnamed scratch)
const BARREL_SLOTS = 10;       // records in OBJ_ARRAY_67
const RECORD_STRIDE = 32;      // bytes per object record
const SLOT_ACTIVE = 0x01;      // OBJ_ACTIVE bit 0 — the record is a barrel already in motion
const SLOT_OCCUPIED = 0x02;    // OBJ_ACTIVE bit 1 — the record is claimed but not yet moving

export function driveBarrelRelease(m) {
  const { regs, mem8 } = m;

  if (!boardBitGate(m, BOARD_MASK)) return;
  if (!marioActiveGuard(m)) return;

  if ((mem8[EVENT_GATE] & 0x01) !== 0) return advanceBarrelRelease(m);

  if ((mem8[BARREL_RELEASE_ARMED] & 0x01) === 0) return;

  let record = OBJ_ARRAY_67;
  for (let remaining = BARREL_SLOTS; remaining > 0; remaining--) {
    if ((mem8[record + OBJ_ACTIVE] & (SLOT_ACTIVE | SLOT_OCCUPIED)) === 0) {
      regs.ix = record;   // the free record
      regs.b = remaining; // and the countdown it turns into that record's index
      return releaseBarrelIntoFreeSlot(m);
    }
    record += RECORD_STRIDE;
  }
}
