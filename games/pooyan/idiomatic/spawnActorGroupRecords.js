// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { seatActorRecordAndQueueSpawnDisplay } from "./seatActorRecordAndQueueSpawnDisplay.js";
import { queueSound82ThenRun1C } from "./queueSound82ThenRun1C.js";
import { SHARED_FRAME_DELAY_TIMER, BLINK_PHASE } from "./names.js";
/**
 * spawnActorGroupRecords — actor-group state-0 (spawn) handler.
 *
 * ROM 0x6505-0x6522.  Grounding: [seen].
 *
 * WHAT IT IS
 *   The one-shot initialiser for a group of animated on-screen objects. The machine drives such a
 *   group through a small state machine: a state index selects a handler through the rst-0x28
 *   dispatch, and state 0 — this routine, dispatch index 0 — is the handler that runs when the
 *   group is first spawned. It lays down the group's shared animation timers, installs the group's
 *   three constituent objects, and kicks off the sound/tile output that accompanies the spawn.
 *
 * ROLE IN THE MACHINE
 *   1. Seeds the two shared per-frame countdown cells that the group's later (per-frame) state
 *      handlers tick down: the frame-delay gate SHARED_FRAME_DELAY_TIMER (0x8929) and the
 *      animation countdown BLINK_PHASE (0x892b).
 *   2. Seats the three object records that make up the group into the display pipeline, one per
 *      pass, walking the record table backward, and bumps each record's animation-phase byte so
 *      the three objects start out of step with one another.
 *   3. Emits the group's sound + tile command run onto the page-0x8a command ring.
 *
 * LIVE-OUT
 *   IX — the record pointer stepped past all three records (entry base - 3*0x18 stride).
 *   A  — the command-ring cursor left by the final emit (0 while the game-active gate is closed).
 *   Both are handed back to the actor-group dispatcher that selected this handler; the loop counter
 *   and scratch pointers do not survive.
 */

const RECORD_STRIDE = 0x18;
const RECORD_COUNT = 0x03;
const REC_PHASE_FIELD = 0x02; // record byte bumped each pass
const DELAY_SEED = 0x1c; //     seeded into the shared frame-delay timer
const PHASE_SEED = 0x08; //     seeded into the blink-phase cell

export function spawnActorGroupRecords(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // Seed the two shared countdown cells that this group's per-frame handlers will drain.
  //   0x8929 (SHARED_FRAME_DELAY_TIMER) = 0x1c: the frame-delay gate — decremented while nonzero
  //     to pace several object-update sweeps, then reseeded by whichever handler owns the group.
  //   0x892b (BLINK_PHASE) = 0x08: on this object-animation path the cell is an animation countdown
  //     that the group's per-frame handler (cycleActorGroupSpriteFramesOnTimer, 0x66a1) decrements
  //     and reloads to advance the sprite frames.
  mem8[SHARED_FRAME_DELAY_TIMER] = DELAY_SEED;
  mem8[BLINK_PHASE] = PHASE_SEED;

  // Install the group's three object records. IX points at the last (highest-address) record; the
  // table is laid out with a 0x18-byte stride, so each pass processes one record and then steps
  // DOWN one stride to the previous one (RECORD_STRIDE subtracted, wrapped to 16 bits).
  let record = ix;
  for (let i = 0; i < RECORD_COUNT; i++) {
    // Write this record's live fields and queue the display command(s) that make the object appear.
    seatActorRecordAndQueueSpawnDisplay(m, record); // seat the object record + enqueue its spawn display command(s)
    // Advance this object's animation phase (record byte +0x02). Doing it per record staggers the
    // three objects so they do not animate in lockstep.
    mem8[u16(record + REC_PHASE_FIELD)] = mem8[u16(record + REC_PHASE_FIELD)] + 1;
    // Step down to the previous record in the table.
    record = u16(record - RECORD_STRIDE);
  }

  // Emit the group's accompanying sound + tile command run: queueSound82ThenRun1C (0x0f88) writes a
  // lead byte then tail-appends a four-byte sound-command run to the page-0x8a command ring, and
  // yields the ring cursor left after the append. Hand back the stepped record pointer in IX and
  // that cursor in A.
  return [(m.regs.ix = record), queueSound82ThenRun1C(m)]; // IX = advanced pointer; A = emit's ring cursor
}
