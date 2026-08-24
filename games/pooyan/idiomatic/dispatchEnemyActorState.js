// SPDX-License-Identifier: GPL-3.0-only
import { advanceEnemyActorToDescentStateOnDelay } from "./advanceEnemyActorToDescentStateOnDelay.js";
import { descendEnemyActorAndSeatSpawnSlot } from "./descendEnemyActorAndSeatSpawnSlot.js";
import { ascendEnemyActorAndLinkedSlotOnTimer } from "./ascendEnemyActorAndLinkedSlotOnTimer.js";
import { reinitRoundArenaAndPlayfieldIfImageIntact } from "./reinitRoundArenaAndPlayfieldIfImageIntact.js";
/**
 * dispatchEnemyActorState — dispatch the record's per-frame state handler, record based at IX.
 *
 * The record's state byte at IX+2 selects one of four handlers (0..3). Each is a tail
 * hand-off — no continuation is stacked here — so the selected handler returns straight
 * to our caller.
 *
 * LIVE-OUT: memory only — the caller's record-scan loop parks its own loop registers
 * across the call and reads no register or return value back; every effect is in memory.
 */
const STATE_OFFSET = 0x02; // record state byte, selects the handler

export function dispatchEnemyActorState(m, rec = m.regs.ix) {
  const { mem8 } = m;

  switch (mem8[rec + STATE_OFFSET]) {
    case 0: return advanceEnemyActorToDescentStateOnDelay(m, rec);
    case 1: return descendEnemyActorAndSeatSpawnSlot(m, rec);
    case 2: return ascendEnemyActorAndLinkedSlotOnTimer(m, rec);
    case 3: return reinitRoundArenaAndPlayfieldIfImageIntact(m, rec);
  }
}
