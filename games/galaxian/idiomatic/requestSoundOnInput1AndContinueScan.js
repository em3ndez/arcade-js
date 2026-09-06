// SPDX-License-Identifier: GPL-3.0-only
// requestSoundOnInput1AndContinueScan — read input port IN1; if either of its low two bits is set, seed the control byte, then continue
// the input scan by delegating to the sound-request/column-draw link. The full IN1 byte and the IN0 byte the
// caller holds are handed to the delegate for its own IN0|IN1 bit tests (bits 2-3, then bit 4).
import { IN1, loc_41df } from "./names.js";
import { requestSound6AndContinueInputScan } from "./requestSound6AndContinueInputScan.js";

const LOW_TWO_BITS = 0x03; // Z iff neither low bit set
const CONTROL_SEED = 0x16;

export function requestSoundOnInput1AndContinueScan(m, in0 = m.regs.b) {
  const { mem8 } = m;

  const in1 = mem8[IN1]; // read IN1 fresh from the port; keep the full byte for the delegate's tests
  if (in1 & LOW_TWO_BITS) mem8[loc_41df] = CONTROL_SEED;

  // Continue the scan: the delegate does its own IN0|IN1 bit tests.
  return requestSound6AndContinueInputScan(m, in0, in1);
}
