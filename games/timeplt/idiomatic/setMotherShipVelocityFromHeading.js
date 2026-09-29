// SPDX-License-Identifier: GPL-3.0-only
/** setMotherShipVelocityFromHeading — run the arm the era index selects, then run the block just past the table of arms.
 * The mask admits eight indices where the table defines five, so an index past the end reads the
 * first bytes of that block as though they were an entry: two of those words name no routine and
 * fault, and the last names the six-digit painter, which is run as the machine would run it.
 * Each arm is a direct call that hands its pair on to the block after it. LIVE-OUT: memory. */

import { NotImplemented } from "../../../boards/timeplt/io.js";
import { ERA_INDEX } from "./names.js";
import { fileTwoPairsIntoObjectRecordHighByteFirst } from "./fileTwoPairsIntoObjectRecordHighByteFirst.js";
import { loc_5942 } from "./loc_5942.js";
import { loc_594e } from "./loc_594e.js";
import { loc_5965 } from "./loc_5965.js";
import { loc_596b } from "./loc_596b.js";
import { paintSixDigitFieldSuppressingLeadingZeros } from "./paintSixDigitFieldSuppressingLeadingZeros.js";

const ARM_MASK = 0x07;

/** An index past the defined arms whose table word names no routine at all. */
function noRoutineThere(index) {
  return () => {
    throw new NotImplemented(
      `setMotherShipVelocityFromHeading: era arm ${index} reads a table word that names no routine`,
    );
  };
}

// The table in index order: five defined arms, then the three words the block past it supplies.
const ARMS = [
  loc_5942,
  loc_594e,
  loc_594e,
  loc_5965,
  loc_596b,
  noRoutineThere(5),
  noRoutineThere(6),
  paintSixDigitFieldSuppressingLeadingZeros,
];

export function setMotherShipVelocityFromHeading(m) {
  ARMS[m.mem8[ERA_INDEX] & ARM_MASK](m);
  fileTwoPairsIntoObjectRecordHighByteFirst(m);
}
