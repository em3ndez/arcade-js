// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  FORMATION_ENABLE_FLAG,
  FORMATION_STATE,
  FORMATION_SLOT_TABLE,
  ENEMY_ACTOR_TABLE,
  ROPE_DRAW_STEP_TIMER,
} from "./names.js";
import { launchHunterFormationAndSeedSlots } from "./launchHunterFormationAndSeedSlots.js";
import { advanceLeadHunterSwoopAndArmDive } from "./advanceLeadHunterSwoopAndArmDive.js";
import { verifyFormationGuardChecksum } from "./verifyFormationGuardChecksum.js";
import { advanceWaveTeardownByState } from "./advanceWaveTeardownByState.js";

/**
 * dispatchFormationPhaseOrQueueLaunchSlots — the formation manager.
 *
 * Does nothing while disabled. Once the formation is active it dispatches the formation phase (the
 * low two bits of the state, less one) to the matching phase handler, then runs the shared
 * epilogue. Otherwise it scans the actor records for launch-ready slots (idle or queued with a
 * clear ready byte), registers each record pointer into the slot table and marks it queued; when
 * the fourth entry fills the table it arms the formation, and when the scan finds none it resets
 * the slot-table head.
 *
 * LIVE-OUT: none — a void manager; the caller reads nothing back.
 */

const RECORD_COUNT = 0x11;
const RECORD_STRIDE = 0x18;
const OFF_STATE = 0x00; //     record state byte
const OFF_READY = 0x01; //     0 => this record may launch
const OFF_SUBSTATE = 0x02; //  spawn sub-state written on launch
const IDLE_STATE = 0x00;
const QUEUED_STATE = 0x05;
const SPAWN_SUBSTATE = 0x10;
const SLOT_TABLE_FULL = 0x28; // slot-pointer low byte once four entries are stored
const ARM_VALUE = 0x20; //      formation-arm value

export function dispatchFormationPhaseOrQueueLaunchSlots(m) {
  const { mem8, mem16 } = m;

  if (mem8[FORMATION_ENABLE_FLAG] === 0) return; // disabled

  if (mem8[FORMATION_STATE] !== 0) {
    switch (u8((mem8[FORMATION_STATE] & 0x03) - 1)) { // formation phase -> its handler
      case 0: launchHunterFormationAndSeedSlots(m); break;
      case 1: advanceLeadHunterSwoopAndArmDive(m); break;
      case 2: verifyFormationGuardChecksum(m); break;
    }
    return advanceWaveTeardownByState(m); // shared formation epilogue
  }

  // scan the actor records for launch-ready slots
  let rec = ENEMY_ACTOR_TABLE;
  let slot = FORMATION_SLOT_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    const state = mem8[rec + OFF_STATE];
    if ((state === IDLE_STATE || state === QUEUED_STATE) && mem8[rec + OFF_READY] === 0) {
      mem16[slot] = rec; //                  store the record pointer (little-endian)
      mem8[rec + OFF_STATE] = QUEUED_STATE;
      mem8[rec + OFF_SUBSTATE] = SPAWN_SUBSTATE;
      slot += 2;
      if ((slot & 0xff) === SLOT_TABLE_FULL) {
        mem8[FORMATION_STATE] = 1; // table full -> arm the formation
        mem8[ROPE_DRAW_STEP_TIMER] = ARM_VALUE;
        return;
      }
    }
    rec += RECORD_STRIDE;
  }
  mem8[FORMATION_SLOT_TABLE] = 0; // scanned all, table never filled -> reset the head
}
