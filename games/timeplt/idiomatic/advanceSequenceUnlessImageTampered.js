// SPDX-License-Identifier: GPL-3.0-only
/** advanceSequenceUnlessImageTampered — present the checksum the caller carried, then relay by its verdict: the one value a
 * genuine image yields steps the attract sequence, anything else springs the tamper trap. Reads and writes nothing itself; the chosen arm owns all of that. LIVE-OUT: that arm's memory and its return. */

import { presentChecksumForTamperTest } from "./presentChecksumForTamperTest.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { loc_0f8d as springTamperTrap } from "./loc_0f8d.js";

const GENUINE_IMAGE_CHECKSUM = 0x67;

export function advanceSequenceUnlessImageTampered(m) {
  const checksum = presentChecksumForTamperTest(m);
  if (checksum !== GENUINE_IMAGE_CHECKSUM) return springTamperTrap(m);
  return advanceSequenceSubStep(m);
}
