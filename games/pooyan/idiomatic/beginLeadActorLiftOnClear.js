// SPDX-License-Identifier: GPL-3.0-only
import { seedFourRecordsAndCopyDisplayTiles } from "./seedFourRecordsAndCopyDisplayTiles.js";
import { queueSoundRun26 } from "./queueSoundRun26.js";
import {
  TAMPER_STRIKES_SLOTSWEEP,
  TAMPER_STRIKES_ROM,
  ACTOR_TABLE,
  ACTOR_TABLE_SLOT1,
  WAVE_TEARDOWN_STATE,
  SHAPE_TABLE_26BD,
} from "./names.js";
/**
 * beginLeadActorLiftOnClear — state-0 handler of the lead actor's six-way state machine.
 *
 * WHAT IT IS
 *   The actor arena is one flat array of fixed 0x18-byte records based at ACTOR_TABLE (0x8a80).
 *   Slot 0 — the record at 0x8a80 itself — is the player / lead actor. Its +0x02 field is a state
 *   index that the per-frame lead-actor driver masks to three bits and uses to pick one of six
 *   handlers; this is the handler for state 0. State 0 is the entry / arming state: the lead actor
 *   waits here, and this handler is what kicks it into its rise ("lift") sequence.
 *
 * ROLE IN THE MACHINE
 *   Two things must be true before the lead actor may leave state 0. First, the field must be quiet:
 *   the two anti-tamper strike counters — set only when a ROM/code checksum guard has caught a
 *   corrupted image — must both read zero. On an intact machine they are always zero, so in normal
 *   play the handler always proceeds; the gate exists to freeze the lead actor on a tampered board.
 *   When it does proceed it primes the record for the next state (seeds the pacing delay, advances
 *   the state index), preserves a copy of the record, lifts the actor up one row, repaints its
 *   tiles for the new state, and — unless a wave is being torn down — plays the state's sound.
 *
 *   ROM 0x2442 (dispatched from the lead-actor driver as table[0] of the state jump table 0x2436).
 *   Grounding: [seen]
 *
 * LIVE-OUT: memory only — reached by tail dispatch from the per-frame lead-actor driver, which
 *   reads nothing back. All effects land in the lead record and the sound queue.
 */

const FRAME_DELAY_SEED = 0x10; // value written to the record's +0x11 frame-delay field
const RECORD_LEN = 0x18; //       length of one actor record, i.e. bytes copied by the snapshot
const POS_DROP = 0x10; //         amount subtracted from the record's +0x04 vertical-position field

export function beginLeadActorLiftOnClear(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // GATE: idle while the machine's integrity is in doubt.
  // The two anti-tamper strike counters, TAMPER_STRIKES_SLOTSWEEP (0x89e8) and TAMPER_STRIKES_ROM
  // (0x89ef), are bumped by the slot-sweep and ROM checksum guards. OR them together: if either is
  // nonzero a guard has fired, so leave the lead actor parked in state 0 and do nothing this frame.
  // On an untampered board both are zero and execution falls through.
  if ((mem8[TAMPER_STRIKES_SLOTSWEEP] | mem8[TAMPER_STRIKES_ROM]) !== 0) return; // still active

  // SEED THE PACING DELAY for the next state.
  // The record's +0x11 frame-delay field paces the lead-actor transitions: the state-1 handler
  // counts it down each frame and only acts on expiry. Reload it to 0x10 so state 1 dwells 16
  // frames before it fires.
  mem8[rec + 0x11] = FRAME_DELAY_SEED;

  // ADVANCE THE STATE INDEX.
  // Bump the record's +0x02 state field by one, moving the lead actor from state 0 into state 1;
  // next frame the driver will dispatch the state-1 handler instead of this one.
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1; // advance state

  // SNAPSHOT THE WHOLE LEAD RECORD.
  // Copy all 0x18 bytes of the lead record (ACTOR_TABLE, 0x8a80) into the second actor slot
  // (ACTOR_TABLE_SLOT1, 0x8a98), preserving the lead actor's full per-frame state in the adjacent
  // record as the lift sequence begins to mutate the live slot 0.
  for (let i = 0; i < RECORD_LEN; i++) mem8[ACTOR_TABLE_SLOT1 + i] = mem8[ACTOR_TABLE + i]; // snapshot

  // THE LIFT: raise the actor by one row.
  // +0x04 is the record's vertical position (the value the player's three sprite rows are derived
  // from). Subtracting 0x10 shifts it up one 16-pixel row — the upward "lift" the state begins.
  mem8[rec + 0x04] = mem8[rec + 0x04] - POS_DROP; // drop the position field one row

  // REPAINT THE ACTOR'S TILES FOR THE NEW STATE.
  // Load the shape / display-tile source table SHAPE_TABLE_26BD (ROM 0x26bd) into the actor records,
  // so the lead actor is drawn with the artwork for the state it just entered.
  seedFourRecordsAndCopyDisplayTiles(m, SHAPE_TABLE_26BD, rec); // load the shape table into the actor records

  // SOUND GATE: stay silent while a wave is being torn down.
  // WAVE_TEARDOWN_STATE (0x8f24) is nonzero while the wave/boss teardown sequence runs; during
  // teardown skip the sound so the lift does not step on the teardown audio.
  if (mem8[WAVE_TEARDOWN_STATE] !== 0) return;

  // Otherwise queue this state's tile-run sound, opening with sound-command byte 0x26.
  queueSoundRun26(m); // queue the state's tile-run sound
}
