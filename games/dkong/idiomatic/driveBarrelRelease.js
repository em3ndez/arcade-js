// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveBarrelRelease — the release half of the 25m barrel engine: while a barrel is already on its
 * way out, step the release animation; otherwise, if a release is armed, find a free barrel record
 * and hand the claim on. Either way this is the routine that decides a barrel leaves.
 *
 * FOUR GATES DECIDE WHAT IT DOES, and three of them simply end the frame's work here:
 *   1. The per-board mask admits the girder board only, so the whole routine is skipped elsewhere.
 *   2. Mario must be alive.
 *   3. EVENT_GATE bit 0 SET means a barrel already went out this pass: control goes straight to
 *      the release animation and NOTHING is scanned.
 *   4. RELEASE_ARMED bit 0 CLEAR means nothing is armed, so there is nothing to place.
 *
 * With all four open it walks the ten OBJ_ARRAY_67 barrel records and stops at the first whose
 * OBJ_ACTIVE has BOTH low bits clear — neither already in motion (bit 0) nor already claimed
 * (bit 1). The record and the countdown are handed to the claim, which turns the count into that
 * record's index. Ten records with none free returns having written nothing.
 *
 * WHY THE WALK COUNTS DOWN. The loop variable is not a cursor, it is the ARGUMENT: the claim
 * derives the record's slot index from what is LEFT, so counting up and handing over the visit
 * number would place the barrel in the mirror-image slot. That is the one thing about this loop
 * that is not free to be rewritten.
 *
 * WHAT THE NAME RESTS ON, from this body alone: neither arm advances a barrel that is already
 * running and neither arm draws one — one steps the release, the other claims a record for a
 * release armed elsewhere. The routine's whole output is which record the next barrel comes out
 * of, and when.
 *
 * NOT CLAIMED: the two gate bytes are read here as latches, and nothing in this file establishes
 * who raises or clears them. Neither has a shared name, so both stay file-local consts.
 *
 * Reads BOARD (through the board mask), Mario's alive flag, EVENT_GATE, RELEASE_ARMED, and each
 * scanned record's OBJ_ACTIVE. Writes nothing of its own — every write is made by the hand-offs.
 *
 * LIVE-OUT: memory-only. Nothing reads back a register or a flag this routine leaves behind, and
 * the two values loaded for the claim are consumed inside that call.
 */

import { boardBitGate } from "./boardBitGate.js";
import { marioActiveGuard } from "./marioActiveGuard.js";
import { advanceBarrelRelease } from "./advanceBarrelRelease.js";
import { releaseBarrelIntoFreeSlot } from "./releaseBarrelIntoFreeSlot.js";
import { OBJ_ARRAY_67, OBJ_ACTIVE } from "./names.js";

const BOARD_MASK = 1;          // per-board applicability mask: bit0 = the girder board only
const EVENT_GATE = 0x6393;     // bit0 SET -> a barrel already went out this pass (unnamed scratch)
const RELEASE_ARMED = 0x6392;  // bit0 SET -> a release is armed for this pass (unnamed scratch)
const BARREL_SLOTS = 10;       // records in OBJ_ARRAY_67
const RECORD_STRIDE = 32;      // bytes per object record
const SLOT_ACTIVE = 0x01;      // OBJ_ACTIVE bit 0 — the record is a barrel already in motion
const SLOT_OCCUPIED = 0x02;    // OBJ_ACTIVE bit 1 — the record is claimed but not yet moving

export function driveBarrelRelease(m) {
  const { regs, mem8 } = m;

  // Only the girder board runs this, and only while Mario is alive.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return;
  if (!marioActiveGuard(m)) return;

  // A barrel is already going out this pass -> step the release, look for nothing.
  if ((mem8[EVENT_GATE] & 0x01) !== 0) return advanceBarrelRelease(m);

  // Nothing armed -> nothing to place.
  if ((mem8[RELEASE_ARMED] & 0x01) === 0) return;

  // Walk the ten barrel records for the first that is neither moving nor already claimed. The
  // walk counts DOWN, because the claim derives the record's index from what is left.
  let record = OBJ_ARRAY_67;
  for (let remaining = BARREL_SLOTS; remaining > 0; remaining--) {
    if ((mem8[record + OBJ_ACTIVE] & (SLOT_ACTIVE | SLOT_OCCUPIED)) === 0) {
      // REGISTER MARSHALLING: the claim reads both of these out of the register file.
      regs.ix = record;   // the free record
      regs.b = remaining; // and the countdown it turns into that record's index
      return releaseBarrelIntoFreeSlot(m);
    }
    record += RECORD_STRIDE;
  }

  // Ten records, none free: nothing to release this pass.
}
