// SPDX-License-Identifier: GPL-3.0-only
import { advanceEagleToArrivalAndTallyWave } from "./advanceEagleToArrivalAndTallyWave.js";
import { advanceEagleDiveClimbToRetireAtLimit } from "./advanceEagleDiveClimbToRetireAtLimit.js";
import { despawnEagleAndSeedHoldOnWaveEmpty } from "./despawnEagleAndSeedHoldOnWaveEmpty.js";
/**
 * dispatchActiveEagleRecordState — the per-frame state driver for ONE eagle-wave record.
 *
 * WHAT IT IS
 *   During the eagle bonus stage the machine flies a small flock of eagles across the top of
 *   the field. Each eagle is one actor record inside the enemy actor table (ENEMY_ACTOR_TABLE,
 *   0x8ae0), a fixed 0x18-byte struct. The wave driver walks the wave's live records one at a
 *   time and hands each record, in turn, to this routine. `rec` is the base address of the
 *   record currently being serviced.
 *
 * ROLE IN THE MACHINE
 *   This is the little state machine that lives on every eagle. It first decides whether the
 *   record is even alive; if it is, a single state byte inside the record (rec+2) says which of
 *   the eagle's three life-phases it is in, and control is routed to the matching phase handler:
 *     phase 0  approach   — the eagle is flying in toward its assigned grid slot
 *     phase 1  dive/climb  — the eagle is descending (or, for the climbers, ascending) its column
 *     phase 2  retire      — the eagle is done and is being torn out of the wave
 *   Exactly one phase runs per frame per record; the phase handler is responsible for advancing
 *   the state byte when its phase completes, so next frame this record enters the next phase.
 *
 * ROM ADDRESS: 0x72cf.
 * GROUNDING: [seen] (per its names.js cert), as are all three phase handlers it routes to.
 *
 * LIVE-OUT: memory only. Everything a phase does is written back into the record and the shared
 *   eagle-wave state cells (arrival tally, live-record count, inter-wave hold timer, display
 *   command queue). The wave driver that called us holds its own scan cursor and reads no
 *   register or return value back from this routine.
 */
const ACTIVE_BIT = 0x01; // record is alive when bit0 of (rec+0)|(rec+1) is set
const STATE_OFFSET = 0x02; // rec+2 holds the eagle's life-phase (0=approach, 1=dive/climb, 2=retire)

export function dispatchActiveEagleRecordState(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // LIVENESS GATE (ROM 0x72cf-0x72d6).
  // A record slot is a reusable struct: when no eagle occupies it, the slot's two lead bytes
  // (rec+0 and rec+1) are cleared. The machine folds both bytes together and tests bit0 of the
  // result — if that bit is clear the slot is empty and there is nothing to drive this frame, so
  // we return immediately and leave the slot untouched.
  if (((mem8[rec + 0x00] | mem8[rec + 0x01]) & ACTIVE_BIT) === 0) return; // inactive record

  // PHASE DISPATCH (ROM 0x72d7-0x72da).
  // The live eagle's phase byte at rec+2 indexes a three-entry jump table in ROM, so the value is
  // always one of 0/1/2 — no other phase can be reached and there is no default arm. Each handler
  // is entered as a tail call: it does the whole frame's work for this eagle and returns straight
  // back to the wave driver.
  switch (mem8[rec + STATE_OFFSET]) { // (ix+2) is bounded 0..2 — no other state dispatches
    // Phase 0 — APPROACH. Check whether the eagle has flown into this record's assigned grid slot:
    // its column (EAGLE_X_COORD >> 3) must match the target column (rec+6) or the one just before
    // it, and its row (EAGLE_Y_COORD >> 3, +4) must fall inside a five-row window above the target
    // row (rec+4). On arrival it advances the phase byte, arms the eagle's animation and sets
    // rec+9; even records also bump the wave's arrived count and, once every record of the wave has
    // arrived, queue the wave-arrival display command.
    case 0: return advanceEagleToArrivalAndTallyWave(m, rec);
    // Phase 1 — DIVE/CLIMB. Runs the animation mover, then integrates the record's 16-bit vertical
    // position by its per-record speed: even records descend (adding, a carry stepping the row down)
    // and odd records climb (subtracting, a borrow stepping the row up). When the eagle reaches its
    // row limit (bottom row 0x1d for divers, top row 0x04 for climbers) it advances the phase byte
    // into retire.
    case 1: return advanceEagleDiveClimbToRetireAtLimit(m, rec);
    // Phase 2 — RETIRE. Tears this eagle out of the wave: it zero-fills the record's 0x18 bytes and
    // decrements the wave's live-record count. When that count hits zero — the wave's last eagle has
    // left — it seeds the inter-wave hold timer (to 0x30) so the machine pauses before launching the
    // next wave.
    case 2: return despawnEagleAndSeedHoldOnWaveEmpty(m, rec);
  }
}
