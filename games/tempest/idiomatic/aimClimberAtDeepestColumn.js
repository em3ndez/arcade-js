// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, COORD_LIST_PTR_HI, TUBE_GEOM_FLAG, SPAWN_DEFICIT_C3, ENEMY_SEGMENT, ENEMY_PHASE, ENEMY_SLOT_DIR, LANE_LIMIT, POKEY2_RANDOM } from "./names.js";

/**
 * aimClimberAtDeepestColumn -- aim a climbing enemy slot at the deepest tube column. ROM 0xa028.
 *
 * Role in the machine: when an enemy that walks up the tube (a climber -- flipper/tanker) needs
 * a lane to head for, it wants the column the player has neglected -- the one with the most
 * depth still to travel, which gives the enemy the longest run and the player the least warning.
 * This routine scans all 16 lane columns and picks the one holding the largest depth value,
 * biasing toward empty columns (an empty lane counts as maximal 0xff). The scan starts from a
 * POKEY-random column so ties between equally-deep lanes break differently each spawn rather
 * than always favoring a fixed column. The chosen lane and its clockwise neighbor are stashed
 * into the slot as its target segment and phase.
 *
 * Behavior: seed the running max COORD_LIST_PTR_HI = 0 and the down-counter SPAWN_DEFICIT_C3 =
 * 0x0f (16 columns). Take the random start column y = POKEY2_RANDOM & 0x0f. Loop the 16 columns:
 * skip column 0x0f while the tube-geometry gate TUBE_GEOM_FLAG is nonzero (an open-tube level
 * has no wrap column there); otherwise read LANE_LIMIT+y, treat 0 as maximal 0xff, and if it is
 * >= the running max keep it (COORD_LIST_PTR_HI = depth, loc_29 = y). Step y down (& 0x0f wrap)
 * and the counter down until it goes negative (bit7 set). The winning column in loc_29 becomes
 * the slot's target segment ENEMY_SEGMENT+x, ENEMY_PHASE+x = (winner+1)&0x0f (the successor
 * column), and bit7 of the slot direction flag ENEMY_SLOT_DIR+x is cleared.
 *
 * Live-out: ENEMY_SEGMENT+x (target lane), ENEMY_PHASE+x (successor lane), ENEMY_SLOT_DIR+x
 * (bit7 cleared), plus the scratch cells COORD_LIST_PTR_HI (final max depth), loc_29 (winner),
 * SPAWN_DEFICIT_C3 (spent to 0xff).
 *
 * Grounding: [seen].
 */
export function aimClimberAtDeepestColumn(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[COORD_LIST_PTR_HI] = 0; // running max depth
  mem8[SPAWN_DEFICIT_C3] = 0x0f; // 16-column down-counter
  let y = mem8[POKEY2_RANDOM] & 0x0f; // random start column
  for (;;) {
    // Skip the wrap column 0x0f on an open (non-closed) tube.
    const gated = y === 0x0f && mem8[TUBE_GEOM_FLAG] !== 0;
    if (!gated) {
      let depth = mem8[u16(LANE_LIMIT + y)];
      if (depth === 0) depth = 0xff; // empty lane counts as maximal
      if (depth >= mem8[COORD_LIST_PTR_HI]) {
        mem8[COORD_LIST_PTR_HI] = depth; // new deepest so far
        mem8[loc_29] = y; // remember the column
      }
    }
    y = (y - 1) & 0x0f;
    const cnt = (mem8[SPAWN_DEFICIT_C3] - 1) & 0xff;
    mem8[SPAWN_DEFICIT_C3] = cnt;
    if (cnt & 0x80) break; // all 16 columns scanned
  }
  const winner = mem8[loc_29];
  mem8[u16(ENEMY_SEGMENT + x)] = winner; // target lane for the climber
  mem8[u16(ENEMY_PHASE + x)] = (winner + 1) & 0x0f; // its successor column
  const flag = u16(ENEMY_SLOT_DIR + x);
  mem8[flag] = mem8[flag] & 0x7f; // clear bit7 of the slot direction flag
}
