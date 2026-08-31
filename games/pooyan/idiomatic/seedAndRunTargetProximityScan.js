// SPDX-License-Identifier: GPL-3.0-only
import { loc_638a } from "./loc_638a.js";
import { SPRITE_TARGET_SLOTS, PROJECTILE_TABLE } from "./names.js";
/**
 * seedAndRunTargetProximityScan — seed the proximity scan and run it. Points the coordinate cursor at the sprite
 * target-slot table and the record cursor at the projectile list, sets the slot count, and
 * hands off. A thin wrapper with no work after the hand-off, so it forwards the scan's boolean.
 * LIVE-OUT: the forwarded boolean (false = a hit was claimed and the outer scan must abort,
 * true = exhausted); the actor box and interrupt-parity register pass through to the scan.
 */

const SLOT_COUNT = 0x03;

export function seedAndRunTargetProximityScan(m, box = m.regs.iy, ireg = m.regs.i) {
  return loc_638a(m, SPRITE_TARGET_SLOTS, SLOT_COUNT, PROJECTILE_TABLE, box, ireg);
}
