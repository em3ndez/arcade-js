// SPDX-License-Identifier: GPL-3.0-only
import { insertType1WithHeadFlag } from "./primeTopPriorityObject.js";

/**
 * insertObjectHeadTag9 / insertObjectHeadTag7 -- two tagged entry points that spawn a type-1 object
 * with a fixed head flag. ROM 0xa343 (tag 0x09) and ROM 0xa347 (tag 0x07).
 *
 * Role in the machine: several call sites need to insert a "type-1" object (the head/lead object of an
 * enemy or effect) while stamping the head-flag cell loc_13b with a caller-specific tag. Rather than
 * pass the tag as a parameter, the ROM has two adjacent entry points that each preset the tag before
 * falling into the shared insert. Tag 0x09 is used when the spike-collision path spawns the head object;
 * tag 0x07 is used by the moving-spike and slot-steering paths (advanceMovingSpike, steerSlotCoordinate).
 *
 * Behavior: each entry simply calls insertType1WithHeadFlag with its literal tag and the caller's X/Y --
 * that shared routine writes the tag into head-flag loc_13b and inserts the type-1 object. insertObject-
 * HeadTag9 stamps 0x09; insertObjectHeadTag7 stamps 0x07. Both tail-return the insert's result.
 *
 * Live-out: the head-flag cell loc_13b (set to the entry's tag) and the newly inserted type-1 object.
 * Grounding: [seen].
 */
export function insertObjectHeadTag9(m, x = m.regs.x, y = m.regs.y) {
  return insertType1WithHeadFlag(m, 0x09, x, y);   // stamp head flag loc_13b = 0x09, then insert
}

export function insertObjectHeadTag7(m, x = m.regs.x, y = m.regs.y) {
  return insertType1WithHeadFlag(m, 0x07, x, y);   // stamp head flag loc_13b = 0x07, then insert
}
