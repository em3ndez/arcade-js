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
 * dispatchFormationPhaseOrQueueLaunchSlots — the hunter-formation manager.
 *
 * WHAT IT IS
 *   ROM 0x308b (0x308b-0x30ea). One of the active-play coordinator's per-frame sub-drivers.
 *   It owns the "hunter formation": a squad of enemy attackers that are gathered together and
 *   then launched as a coordinated group rather than one at a time. Grounding: [seen].
 *
 * ROLE IN THE MACHINE
 *   The routine is a two-mode manager keyed on FORMATION_STATE (0x8f08):
 *
 *     - GATHER (FORMATION_STATE == 0): the formation is being assembled. Walk the enemy actor
 *       records and pick launch-ready ones, recording each into a four-entry slot table. When
 *       the fourth entry lands, the squad is complete: arm the formation so that from the next
 *       frame on it runs the DISPATCH mode below. If a whole scan finds no more recruits, rewind
 *       the slot-table head so the next frame starts collecting from the top again.
 *
 *     - DISPATCH (FORMATION_STATE != 0): the formation is live. The low two bits of the state,
 *       less one, name the current phase (state 1 -> phase 0, state 2 -> phase 1, state 3 ->
 *       phase 2); run that phase's handler, then always run the shared teardown epilogue that
 *       every formation frame passes through.
 *
 * WHEN IT DOES NOTHING
 *   The whole subsystem is gated by FORMATION_ENABLE_FLAG (0x8f04). While that flag is clear the
 *   routine returns immediately, so no formation is gathered, dispatched, or torn down.
 *
 * LIVE-OUT: none — a void manager; the caller reads nothing back. Its effects are the writes it
 *   leaves in memory: FORMATION_STATE (0x8f08), the four slot-pointer entries and head byte in
 *   FORMATION_SLOT_TABLE (0x8920), the state/substate bytes of the enemy actor records it
 *   recruits (ENEMY_ACTOR_TABLE, 0x8ae0), and the ROPE_DRAW_STEP_TIMER (0x8f09) arm value.
 */

// The enemy actor pool scanned during GATHER: RECORD_COUNT records, each RECORD_STRIDE bytes
// wide, starting at ENEMY_ACTOR_TABLE (0x8ae0). The three offsets below name the fields this
// manager reads and writes inside one record.
const RECORD_COUNT = 0x11;
const RECORD_STRIDE = 0x18;
const OFF_STATE = 0x00; //     record state byte — IDLE_STATE / QUEUED_STATE gate a recruit
const OFF_READY = 0x01; //     0 => this record may launch (nonzero => skip it)
const OFF_SUBSTATE = 0x02; //  spawn sub-state written on launch
const IDLE_STATE = 0x00;
const QUEUED_STATE = 0x05;
const SPAWN_SUBSTATE = 0x10;
// FORMATION_SLOT_TABLE lives at 0x8920, so its slot pointer walks 0x20, 0x22, 0x24, 0x26 as the
// first three entries are stored; the fourth store advances it to low byte 0x28 — the table is
// then full (four entries, two bytes each).
const SLOT_TABLE_FULL = 0x28; // slot-pointer low byte once four entries are stored
const ARM_VALUE = 0x20; //      formation-arm value seeded into ROPE_DRAW_STEP_TIMER (0x8f09)

export function dispatchFormationPhaseOrQueueLaunchSlots(m) {
  const { mem8, mem16 } = m;

  // Master gate: the formation subsystem is inert unless FORMATION_ENABLE_FLAG (0x8f04) is set.
  if (mem8[FORMATION_ENABLE_FLAG] === 0) return; // disabled

  // DISPATCH mode. A nonzero FORMATION_STATE (0x8f08) means the squad is armed and running: pick
  // the phase handler from the state's low two bits minus one, then fall into the shared epilogue.
  if (mem8[FORMATION_STATE] !== 0) {
    // Phase = (state & 3) - 1, wrapped to a byte. States 1/2/3 select phases 0/1/2; a state whose
    // low bits are 0 wraps to 0xff and matches no case, running only the epilogue below.
    switch (u8((mem8[FORMATION_STATE] & 0x03) - 1)) { // formation phase -> its handler
      case 0: launchHunterFormationAndSeedSlots(m); break; // phase 0: launch the squad, seed slots
      case 1: advanceLeadHunterSwoopAndArmDive(m); break;  // phase 1: lead-hunter swoop / arm dive
      case 2: verifyFormationGuardChecksum(m); break;      // phase 2: guard-block self-check
    }
    return advanceWaveTeardownByState(m); // shared formation epilogue
  }

  // GATHER mode (FORMATION_STATE == 0): assemble the squad. Walk the RECORD_COUNT enemy actor
  // records at ENEMY_ACTOR_TABLE (0x8ae0), stride RECORD_STRIDE, and register launch-ready ones
  // into the four-entry slot table at FORMATION_SLOT_TABLE (0x8920).
  // scan the actor records for launch-ready slots
  let rec = ENEMY_ACTOR_TABLE;
  let slot = FORMATION_SLOT_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    // A record is a recruit when it is idle or already queued AND its ready byte (+1) is clear.
    const state = mem8[rec + OFF_STATE];
    if ((state === IDLE_STATE || state === QUEUED_STATE) && mem8[rec + OFF_READY] === 0) {
      // Register this recruit: store its record address as the next slot's 16-bit pointer, mark
      // the record queued, and stamp its spawn sub-state so it launches with the squad.
      mem16[slot] = rec; //                  store the record pointer (little-endian)
      mem8[rec + OFF_STATE] = QUEUED_STATE;
      mem8[rec + OFF_SUBSTATE] = SPAWN_SUBSTATE;
      slot += 2; // advance to the next two-byte slot
      // Fourth entry just landed (slot low byte reached 0x28): the squad is complete. Arm the
      // formation — set FORMATION_STATE (0x8f08) to 1 so the next frame enters DISPATCH mode, and
      // seed the arm value into ROPE_DRAW_STEP_TIMER (0x8f09).
      if ((slot & 0xff) === SLOT_TABLE_FULL) {
        mem8[FORMATION_STATE] = 1; // table full -> arm the formation
        mem8[ROPE_DRAW_STEP_TIMER] = ARM_VALUE;
        return;
      }
    }
    rec += RECORD_STRIDE; // step to the next record in the pool
  }
  // Whole pool scanned without filling the table: rewind the slot-table head to 0 so the next
  // frame's gather begins collecting from the first slot again (no partial fill carries over).
  mem8[FORMATION_SLOT_TABLE] = 0; // scanned all, table never filled -> reset the head
}
