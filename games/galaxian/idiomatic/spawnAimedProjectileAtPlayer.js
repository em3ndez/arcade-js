// SPDX-License-Identifier: GPL-3.0-only
// Claim a free slot in the 14-entry object table and populate it from the IX object: mark it active, copy
// the sprite Y and X, and store a scaled X velocity toward the target (mirrored when the target is to the
// left). Returns without writing when the table is full. Feeds the moving-object subsystem.
import { computeJitteredXVelocity } from "./computeJitteredXVelocity.js";
import { loc_4202, loc_4260 } from "./names.js";

const SLOT_COUNT = 14; // entries in the table
const SLOT_STRIDE = 5; // bytes per entry
const OBJ_Y = 3;       // sprite Y within the IX object record
const OBJ_X = 4;       // sprite X

export function spawnAimedProjectileAtPlayer(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Find the first free slot: bit 0 of its first byte clear.
  let slot = -1;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const p = loc_4260 + i * SLOT_STRIDE;
    if (!(mem8[p] & 0x01)) { slot = p; break; }
  }
  if (slot < 0) return; // table full -- nothing to fill

  // Fill the slot from the IX object.
  mem8[slot] = 0x01;                                // entry[0]: mark active
  mem8[slot + 1] = mem8[obj + OBJ_Y];              // entry[1]: sprite Y
  const vertical = (0xf0 - mem8[slot + 1]) & 0xff; // vertical delta (divisor for the scaler)
  mem8[slot + 3] = mem8[obj + OBJ_X];              // entry[3]: sprite X (entry[2] left untouched)

  // entry[4]: scaled X velocity toward the target, mirrored when the target is to the left.
  const horizontal = mem8[loc_4202] - mem8[obj + OBJ_X];
  if (horizontal < 0) {
    const scaled = computeJitteredXVelocity(m, (-horizontal) & 0xff, vertical);
    const mirrored = (-scaled) & 0xff;
    mem8[slot + 4] = mirrored;
  } else {
    mem8[slot + 4] = computeJitteredXVelocity(m, horizontal, vertical);
  }
}
