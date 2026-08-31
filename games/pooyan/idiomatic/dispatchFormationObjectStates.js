// SPDX-License-Identifier: GPL-3.0-only
import { FORMATION_TABLE } from "./names.js";
import { dispatchObjectStateHandler } from "./dispatchObjectStateHandler.js";

// The four formation objects sit back-to-back in the formation record table, each stored as one
// fixed-size 0x18-byte object record (liveness header at +0/+1, state selector at +2, position and
// script fields beyond). To walk from one record to the next you step the pointer over one whole
// record — that is the 0x18 stride.
const RECORD_STRIDE = 0x18; // bytes between consecutive formation records
// A formation is exactly four slots wide; the ROM loads a loop count of four (ld b,0x04).
const RECORD_COUNT = 4;

/**
 * dispatchFormationObjectStates — step every live formation object forward by one frame.
 *
 * WHAT IT IS
 *   The enemy formation is a squadron of up to four objects that gather, hold together, and then
 *   peel off to attack. Each of the four is a self-contained object carrying its whole per-frame
 *   state inside one fixed-size 0x18-byte record, and the four records sit back-to-back in the
 *   formation table at FORMATION_TABLE (0x8c30). This routine is the once-per-frame sweep that
 *   visits all four records in turn and advances each one by a single step of its own state
 *   machine.
 *
 * ROLE IN THE MACHINE
 *   This is the "formation-state dispatch" pass of the active-play worker frame. Each frame the
 *   worker runs ten subsystem updates in a fixed order — HUD refresh, lead-actor input, sub-state
 *   advance, the object-update gate, enemy spawns, the general per-object state sweep, THIS
 *   formation sweep, the sprite display-list rebuild, the actor pipeline, and the sound-ring drain
 *   — and this routine is the seventh, the one dedicated to the four formation slots. The same
 *   pass also runs inside the shared post-handler tail that keeps objects animating and the screen
 *   refreshed during the scripted countdown sub-states. It owns none of the object logic itself:
 *   it is a pure driver that hands each record to the shared per-object state dispatcher and lets
 *   that dispatcher route the record to the handler for whatever state the record is in.
 *
 * ROM 0x40bd-0x40cf. Seeds the record pointer to FORMATION_TABLE, a 0x18 record stride, and a
 * count of four, then loops calling the per-object dispatcher once per record. The ROM parks the
 * loop counter and stride in the alternate register bank across each call so the per-object
 * dispatcher is free to clobber the main registers; the net effect is exactly the fixed four-pass
 * loop below.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only. Each visited record — and whatever display or sound state the handler
 * chosen for its state happens to touch — is mutated in place; nothing is handed back in a
 * register, and the sole callers are straight-line sequencers that read no result.
 *
 * @param {object} m  machine state (mem8 = the 64K address space as bytes)
 */
export function dispatchFormationObjectStates(m) {
  // Start at the base of the formation table — record 0, the first of the four formation slots
  // (FORMATION_TABLE = 0x8c30). The ROM seeds this pointer into IX before entering the loop.
  let record = FORMATION_TABLE;
  // Sweep all four formation slots in order. The ROM drives this as a djnz loop counting B down
  // from four; here it is the equivalent fixed four-iteration loop. One iteration = one state step
  // for one formation object, so across a whole worker frame every live formation object advances
  // by exactly one frame.
  for (let i = 0; i < RECORD_COUNT; i++) {
    // Hand this record to the shared per-object state dispatcher. That dispatcher first checks the
    // record's liveness header (bit 0 of +0 OR +1) and skips dormant/empty slots for free, then
    // reads the state selector at +2 (masked to its low five bits) and transfers control to the
    // one handler implementing that state — advancing a live formation object by a single frame of
    // its own state machine.
    dispatchObjectStateHandler(m, record);
    // Advance to the next formation record. Adding the 0x18 stride moves the pointer one whole
    // record forward (ROM: add ix,de with DE = 0x18), lining up the following slot for the next
    // pass of the loop.
    record += RECORD_STRIDE;
  }
}
