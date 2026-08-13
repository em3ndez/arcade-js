// SPDX-License-Identifier: GPL-3.0-only
/** setMotherShipVelocityFromHeading — run the arm the era index selects, then run the block just past the table of arms.
 * The mask admits eight indices where the table defines five, so an index past the end reads the
 * first bytes of that block as though they were an entry; reading the word through the same
 * arithmetic the machine uses keeps that case honest rather than assuming it away. Every arm
 * leaves through a stack slot, so the slot is laid down for it first. LIVE-OUT: memory. */

import { ERA_INDEX, fileTwoPairsIntoObjectRecordHighByteFirst_ADDR, MOTHER_SHIP_VELOCITY_ARM_TABLE } from "./names.js";
import { fileTwoPairsIntoObjectRecordHighByteFirst } from "./fileTwoPairsIntoObjectRecordHighByteFirst.js";

const ARM_MASK = 0x07;

export function setMotherShipVelocityFromHeading(m) {
  const arm = m.mem16[MOTHER_SHIP_VELOCITY_ARM_TABLE + 2 * (m.mem8[ERA_INDEX] & ARM_MASK)];
  m.push16(fileTwoPairsIntoObjectRecordHighByteFirst_ADDR);
  m.call(arm);
  fileTwoPairsIntoObjectRecordHighByteFirst(m);
}
