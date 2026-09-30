// SPDX-License-Identifier: GPL-3.0-only
/** setMotherShipVelocityFromHeading — run the arm the era index selects, then run the block just past the table of arms.
 * The mask admits eight indices where the table defines five, so an index past the end reads the
 * first bytes of that block as though they were an entry: two of those words name no routine and
 * fault, and the last names the six-digit painter, which is run as the machine would run it.
 * Each defined arm only chooses a velocity table (the four loc_59xx arm bodies load it
 * and jump to the heading-velocity sampler), so here each is its table: the object's heading is
 * sampled from it and the component pair it yields is filed into the object's record by the block
 * after the arms. The object's record is an argument. LIVE-OUT: memory. */

import { NotImplemented } from "../../../boards/timeplt/io.js";
import { ERA_INDEX, OPENING_ERA_VELOCITY_TABLE, VELOCITY_TABLE_08FA, loc_2e3e, loc_59d7 } from "./names.js";
import { fileTwoPairsIntoObjectRecordHighByteFirst } from "./fileTwoPairsIntoObjectRecordHighByteFirst.js";
import { velocityForHeading } from "./velocityForHeading.js";
import { paintSixDigitFieldSuppressingLeadingZeros } from "./paintSixDigitFieldSuppressingLeadingZeros.js";

const ARM_MASK = 0x07;
const HEADING = 2;

// The five defined arms in index order, each as the velocity table it samples.
const ARM_TABLES = [
  loc_59d7,
  OPENING_ERA_VELOCITY_TABLE,
  OPENING_ERA_VELOCITY_TABLE,
  loc_2e3e,
  VELOCITY_TABLE_08FA,
];
// The index whose table word, read past the end, names the six-digit painter.
const PAINTER_ARM = 7;

export function setMotherShipVelocityFromHeading(m, record = m.regs.ix) {
  const arm = m.mem8[ERA_INDEX] & ARM_MASK;

  if (arm < ARM_TABLES.length) {
    const [alongFirstAxis, alongSecondAxis] = velocityForHeading(m, ARM_TABLES[arm], m.mem8[record + HEADING]);
    return fileTwoPairsIntoObjectRecordHighByteFirst(
      m, record, alongFirstAxis >> 8, alongFirstAxis & 0xff, alongSecondAxis >> 8, alongSecondAxis & 0xff,
    );
  }

  // The painter is run on whatever pointer, cursor and pen the registers hold, and the block after the
  // arms then files the pairs it leaves behind. This does NOT reproduce the machine, where the table
  // dispatch hands it HL = the painter's own entry address and DE = the table pointer past entry 7;
  // the arm is unreachable on a genuine image (ERA_INDEX is 0..4).
  if (arm === PAINTER_ARM) {
    paintSixDigitFieldSuppressingLeadingZeros(m);
    return fileTwoPairsIntoObjectRecordHighByteFirst(m, record);
  }

  throw new NotImplemented(`setMotherShipVelocityFromHeading: era arm ${arm} reads a table word that names no routine`);
}
