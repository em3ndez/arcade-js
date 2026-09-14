// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, ENEMY_DEPTH } from "./names.js";
import { gateSound1f } from "./gateSound1f.js";
import { insertTimedObjectOfType } from "./insertTimedObjectOfType.js";

/**
 * insertObjectFromSlotDepth -- spawn a new object seeded from an existing slot's depth. ROM 0xa3ca.
 *
 * Role in the machine: when an enemy is retired or split (a Flipper hit, a Spiker leaving a spike, an
 * enemy reaching the rim) the game frequently spawns a replacement object at the same point down the
 * tube. This helper is the shared "insert seeded from a slot's depth" step used by those spawn/retire
 * chains (spawnLaneEnemyAndAward, respawnEnemyAndAward): it cues the spawn sound, reads the source
 * slot's depth, and hands off to the generic object inserter.
 *
 * Behavior: ring the fixed sound cue for the spawn (gateSound1f, keyed on X/Y), copy the Y-indexed depth
 * byte from the enemy-depth table loc_2df into the insert scratch field loc_29 (so the new object starts
 * at the source slot's depth down the tube), then tail-call insertTimedObjectOfType with A/X/Y to place
 * the fresh object in the slot table.
 *
 * Live-out: the insert scratch loc_29 (seeded depth), the queued sound, and the newly inserted object
 * (whatever insertTimedObjectOfType writes and returns). Grounding: [seen].
 */
export function insertObjectFromSlotDepth(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  gateSound1f(m, x, y);                          // cue the spawn sound
  mem8[loc_29] = mem8[u16(ENEMY_DEPTH + y)];     // seed insert depth from slot Y's depth (loc_2df,y)
  return insertTimedObjectOfType(m, a, x, y);    // place the fresh object
}
