// SPDX-License-Identifier: GPL-3.0-only
import { descendObjectThenAdvanceStateAtBottom } from "./descendObjectThenAdvanceStateAtBottom.js";
import { reinitRoundArenaAndPlayfieldIfImageIntact } from "./reinitRoundArenaAndPlayfieldIfImageIntact.js";
/**
 * dispatchDescendingObjectState — advance one descending-object record by one frame.
 *
 * WHAT IT IS
 * ----------
 * The per-object state handler for a single actor record. Once a frame the object driver
 * (runObjectsElseVerifyTilemapChecksum) walks the 18 enemy-actor records that begin at
 * ENEMY_ACTOR_TABLE (0x8ae0) — each record 0x18 bytes wide, taken in turn — and hands each
 * one to this routine. Every record is a little state machine describing one on-screen
 * object; this routine reads the record's current state and runs the matching one-frame
 * step for it.
 *
 * A record is a fixed block of fields addressed relative to its base (here `rec`):
 *   rec+0x01  active flag  — nonzero while the slot holds a live object
 *   rec+0x02  state byte   — which phase of the object's life the record is in (1-based)
 * The individual step handlers reach deeper into the record (position, speed, and so on);
 * this dispatcher itself only needs the active flag and the state byte.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This is the fan-out point of the descending-object subsystem. It performs no work of its
 * own beyond choosing which per-state step to run for this record, then handing off to it.
 * The two live states are:
 *   state 1 → descendObjectThenAdvanceStateAtBottom — slide the object one step down the
 *             screen; when it reaches the bottom, re-arm the tilemap-sum latch and bump the
 *             record on to its next state.
 *   state 2 → reinitRoundArenaAndPlayfieldIfImageIntact — the screen re-init step, run
 *             behind a colour-map integrity checksum.
 *
 * ROM 0x6a98-0x6aa3.
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only. Whatever the selected step writes back — into this record or into
 * shared work RAM — is the entire effect; the walking caller brackets its own loop registers
 * around each call and reads nothing back from this routine.
 */

export function dispatchDescendingObjectState(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Guard: skip a dead slot. rec+0x01 is the record's active flag; a zero there means the
  // slot holds no live object this frame, so there is nothing to step and we return at once.
  if (mem8[rec + 0x01] === 0) return; // inactive slot

  // Dispatch on the object's state. The state byte at rec+0x02 is 1-based, so (state-1)
  // gives a zero-based selector; masking with 0x03 keeps it inside the small jump table the
  // ROM keeps inline at 0x6aa4, whose two entries point at the step handlers below (0x6aa8
  // and 0x67df). Only states 1 and 2 map to a live handler; any other state value falls
  // through the switch with no step taken for this record this frame.
  switch ((mem8[rec + 0x02] - 1) & 0x03) {
    // state 1 → table slot 0 (ROM 0x6aa8): step the descending object one frame, advancing
    // its state once the object bottoms out.
    case 0: return descendObjectThenAdvanceStateAtBottom(m, rec);
    // state 2 → table slot 1 (ROM 0x67df): re-initialise the round arena / playfield,
    // gated on the colour-map integrity checksum.
    case 1: return reinitRoundArenaAndPlayfieldIfImageIntact(m, rec);
  }
}
