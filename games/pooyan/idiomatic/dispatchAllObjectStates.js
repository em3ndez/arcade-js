// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { dispatchActiveObjectState } from "./dispatchActiveObjectState.js";
import { OBJECT_STATE_RECORD_BASE } from "./names.js";

/**
 * dispatchAllObjectStates -- step every slot of the object-state record array by one frame.
 *
 * WHAT IT IS
 * ROM 0x76f4-0x7706. The outer sweep of the object world's per-frame update: it walks the six
 * fixed-size records of the object-state array and advances each one's little state machine by a
 * single frame. All the moving objects that share this pool -- spawned things, launched things,
 * projectiles -- get their one tick of life here, once per frame.
 *
 * ROLE IN THE MACHINE
 * The object-state records are a flat array of 0x18-byte slots based at OBJECT_STATE_RECORD_BASE
 * (0x8ba0). There are six of them, and the array is deliberately laid out so that its span runs on
 * into PROJECTILE_TABLE (0x8be8): the fourth slot the sweep visits is the first projectile record,
 * so the very same records that hold spawned/launched objects are the ones stepped here. This
 * routine owns only the iteration -- pointing at each slot in turn and handing it off. The actual
 * per-record work (deciding whether the slot is live and which of its lifecycle handlers to run for
 * its current state) belongs to dispatchActiveObjectState, which this sweep calls once per slot.
 * Together they form the object world's per-frame update: this outer loop is the "for every object"
 * and dispatchActiveObjectState is the "do one object".
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only. This routine returns nothing and the caller reads back no register or
 * flag; every effect lands in the object records themselves (each slot's own 0x18 bytes) and the
 * shared object cells the individual handlers touch.
 */
export function dispatchAllObjectStates(m) {
  // Start the record pointer at the base of the six-slot object-state array (OBJECT_STATE_RECORD_BASE
  // = 0x8ba0). This is the address handed to the per-record dispatcher for the first slot, and it
  // walks forward from here one record at a time.
  let rec = OBJECT_STATE_RECORD_BASE;
  // Visit all six object-state slots. The count is fixed at six regardless of how many slots are
  // actually live -- the per-record dispatcher itself skips a dormant slot (its presence header has
  // bit 0 clear) -- so this loop unconditionally offers every slot its one frame of service.
  for (let i = 0; i < 6; i++) {
    // Service the record at the current pointer: dispatchActiveObjectState (ROM 0x7707) checks the
    // slot's +0x00/+0x01 presence header and, if live, runs the lifecycle handler its +0x02 state
    // byte selects (arm / move / draw / self-check). Whatever it does stays in the record and the
    // shared object cells; nothing is returned to us.
    dispatchActiveObjectState(m, rec);
    // Advance to the next 0x18-byte slot. The stride 0x18 matches the record size, so the pointer
    // steps 0x8ba0 -> 0x8bb8 -> 0x8bd0 -> 0x8be8 (PROJECTILE_TABLE) -> 0x8c00 -> 0x8c18 across the
    // six iterations. u16 keeps the address a 16-bit value, exactly as the hardware pointer wraps.
    rec = u16(rec + 0x18);
  }
}
