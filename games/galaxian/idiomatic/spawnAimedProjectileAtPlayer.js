// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnAimedProjectileAtPlayer — fire one enemy shot aimed at the player.
 *
 * WHAT IT IS
 *   Claims the first free entry in the fourteen-entry projectile table at loc_4260 (0x4260, stride 5)
 *   and seeds it from the diving object in IX: an active flag, the object's sprite Y and X, and an X
 *   velocity scaled so the shot travels toward the player. The table is full-checked first; on a full
 *   table it writes nothing and returns.
 *
 * ROLE IN THE MACHINE
 *   Tail-called by the flight-state handlers advanceObjectFlightAndFire (0x0e2b) and
 *   advanceHomingObjectFlightAndFire (0x0faf) on a firing-row match, so a swooping alien drops an aimed
 *   bullet at the right point of its arc (see mechanisms.md "The object-AI driver"). The velocity is
 *   NOT a straight slope: computeJitteredXVelocity (0x1218) divides the horizontal reach by the
 *   vertical reach and adds a bounded RNG jitter, so the aim is loose. loc_4202 (0x4202) is the player-X
 *   reference the horizontal delta is measured against; advanceAndRenderProjectiles later integrates
 *   and draws whatever this seeds.
 *
 *   Entry layout used here: [0] active flag (bit0), [1] sprite Y, [3] sprite X, [4] X velocity. Entry
 *   [2] is left untouched by this routine.
 *
 * ROM 0x11e0.  Grounding: [seen]. Cells: projectile table loc_4260 (0x4260), player-X ref loc_4202.
 *
 * LIVE-OUT: one filled projectile entry (or nothing, table full). obj defaults to m.regs.ix.
 */
import { computeJitteredXVelocity } from "./computeJitteredXVelocity.js";
import { loc_4202, loc_4260 } from "./names.js";

const SLOT_COUNT = 14; // entries in the table
const SLOT_STRIDE = 5; // bytes per entry
const OBJ_Y = 3;       // sprite Y within the IX object record
const OBJ_X = 4;       // sprite X

export function spawnAimedProjectileAtPlayer(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Walk the fourteen entries in order; the first whose active bit (bit0 of entry[0]) is clear is free.
  // slot stays -1 if none is.
  let slot = -1;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const p = loc_4260 + i * SLOT_STRIDE;
    if (!(mem8[p] & 0x01)) { slot = p; break; }
  }
  if (slot < 0) return; // table full -- nothing to fill

  // Fill the slot from the IX object.
  mem8[slot] = 0x01;                                // entry[0]: mark active
  mem8[slot + 1] = mem8[obj + OBJ_Y];              // entry[1]: sprite Y
  // Vertical reach from the shot's Y down to the firing line 0xf0; this is the DIVISOR fed to the slope
  // scaler, so a shot near the bottom (small reach) gets a steeper horizontal step.
  const vertical = (0xf0 - mem8[slot + 1]) & 0xff; // vertical delta (divisor for the scaler)
  mem8[slot + 3] = mem8[obj + OBJ_X];              // entry[3]: sprite X (entry[2] left untouched)

  // Horizontal reach = player-X (loc_4202) minus the shot's X. Its sign says which side the player is
  // on; the scaler works on the magnitude, and we mirror the result when the player is to the left.
  // entry[4]: scaled X velocity toward the target, mirrored when the target is to the left.
  const horizontal = mem8[loc_4202] - mem8[obj + OBJ_X];
  if (horizontal < 0) {
    // Player to the left: scale the magnitude (-horizontal), then negate so the velocity points left.
    const scaled = computeJitteredXVelocity(m, (-horizontal) & 0xff, vertical);
    const mirrored = (-scaled) & 0xff;
    mem8[slot + 4] = mirrored;
  } else {
    // Player at or to the right: the scaled magnitude is already the rightward velocity, store as-is.
    mem8[slot + 4] = computeJitteredXVelocity(m, horizontal, vertical);
  }
}
