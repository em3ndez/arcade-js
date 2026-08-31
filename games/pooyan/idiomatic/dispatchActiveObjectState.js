// SPDX-License-Identifier: GPL-3.0-only
import { armObjectFromSpawnRing } from "./armObjectFromSpawnRing.js";
import { moveObject } from "./moveObject.js";
import { drawObjectStackedTiles } from "./drawObjectStackedTiles.js";
import { advanceAttractStateIfImageIntact } from "./advanceAttractStateIfImageIntact.js";
/**
 * dispatchActiveObjectState -- run one object record's per-frame state handler.
 *
 * WHAT IT IS
 * ROM 0x7707-0x7714. The per-record dispatcher for the six-slot object-state record array based at
 * OBJECT_STATE_RECORD_BASE (0x8ba0): a stride-0x18 span that runs on into PROJECTILE_TABLE (0x8be8),
 * so the same slots that hold spawned/launched objects are the ones stepped here. Each of those
 * objects carries its own little state machine, and this routine advances exactly one of them by one
 * frame. The caller dispatchAllObjectStates (0x76f4) walks all six slots and passes each record's
 * base address in turn (rec, defaulting to the IX pointer it was handed); this routine services the
 * single record it is given.
 *
 * ROLE IN THE MACHINE
 * This is the innermost layer of the object world's per-frame update. Every record in the array
 * packs its whole per-object state into 0x18 bytes at fixed offsets: +0x00/+0x01 is the presence
 * header, +0x02 is the state index. This dispatcher reads the state index, uses its low two bits to
 * pick one of four object-lifecycle handlers -- arm, move, draw, self-check -- and hands the record
 * to it. The four handlers together are the object's life: a slot is armed from the spawn ring, then
 * moved frame to frame, then drawn as it animates, with a periodic integrity check woven in.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only -- the caller (the record-scan loop) reads back no register or flag. Each
 * selected handler leaves its effects in the record's own 0x18 bytes and the shared object cells it
 * touches (e.g. SPAWN_RING_COUNTER 0x8d57, OBJECT_DRAWN_FLAG 0x8d58).
 */
export function dispatchActiveObjectState(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // PRESENCE GUARD (ROM 0x7707-0x770e). The two header bytes at +0x00 and +0x01 double as the
  // record's liveness flag: OR them together and test bit 0. A slot whose combined header has bit 0
  // clear is dormant -- nothing to service this frame -- so return at once and let the caller move on
  // to the next record. A freshly spawned object is stamped live by setting this bit.
  if (((mem8[rec + 0x00] | mem8[rec + 0x01]) & 1) === 0) return;

  // STATE SELECT (ROM 0x770f-0x7714). Read the state byte at +0x02 and mask it to its low two bits;
  // that value indexes a four-way jump table (ROM word table at 0x7715 -> 0x771d/0x7740/0x7790/0x7881)
  // into the object's own state machine. No continuation is stacked before the hand-off, so the chosen
  // handler returns straight to our caller -- this dispatcher is a pure tail branch, adding nothing of
  // its own to the object's per-frame work.
  switch (mem8[rec + 0x02] & 0x03) {
    // State 0 -- ARM (ROM 0x771d). Bring a new object to life from the spawn ring: reads and steps
    // SPAWN_RING_COUNTER (0x8d57) per arm and seeds the record's opening fields.
    case 0: return armObjectFromSpawnRing(m, rec);
    // State 1 -- MOVE (ROM 0x7740). Advance the live object's position for this frame; the active-object
    // mover that walks the record along its path.
    case 1: return moveObject(m, rec);
    // State 2 -- DRAW (ROM 0x7790). Advance the animation and decrement the frame-hold timer at +0x11,
    // returning while it still runs; marks OBJECT_DRAWN_FLAG (0x8d58) once the object has been drawn.
    case 2: return drawObjectStackedTiles(m, rec);
    // State 3 -- SELF-CHECK (ROM 0x7881). The periodic ROM-image integrity check dispatched over the
    // slot; it only carries the state forward while the checked image is intact.
    case 3: return advanceAttractStateIfImageIntact(m, rec);
  }
}
