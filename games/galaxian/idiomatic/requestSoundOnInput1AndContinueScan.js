// SPDX-License-Identifier: GPL-3.0-only
import { IN1, loc_41df } from "./names.js";
import { requestSound6AndContinueInputScan } from "./requestSound6AndContinueInputScan.js";

/**
 * requestSoundOnInput1AndContinueScan (ROM 0x1c50) -- the head of the attract-mode input-scan chain
 * that turns a fresh read of input port IN1 into a sound request and then continues the scan.
 *
 * WHAT IT IS
 *   This is the first link that fires when the machine samples the controls. It reads input port IN1
 *   (0x6800) live from the hardware and looks at its low two bits (mask 0x03). If either is set it seeds
 *   the shared sound-request selector loc_41df (0x41df) with 0x16 -- the value armSoundSequenceBySelector
 *   (0x1819) keys on to arm the corresponding sound sequence, gated on sound driver flag loc_4006 bit 0.
 *   It then tail-continues into the next link, which tests a different bit window and draws the readout.
 *
 * ROLE IN THE MACHINE
 *   Entry point of the input-scan / attract-readout chain. It reads IN1 itself, but keeps the caller's
 *   already-loaded IN0 byte (register B) untouched, and hands BOTH bytes down to
 *   requestSound6AndContinueInputScan (0x1c5d): the full IN1 byte and the caller's IN0 so the downstream
 *   links can do their own folded IN0|IN1 bit tests (bits 2-3, then the shared bit 4). See mechanisms.md
 *   "Sound requests and the shared selector".
 *
 * Grounding: [seen] (names.js cert for 0x1c50).
 *
 * LIVE-OUT: whatever the delegate chain returns; loc_41df is set to 0x16 when IN1's low two bits show input.
 */
const LOW_TWO_BITS = 0x03; // Z iff neither low bit set
const CONTROL_SEED = 0x16;

export function requestSoundOnInput1AndContinueScan(m, in0 = m.regs.b) {
  const { mem8 } = m;

  const in1 = mem8[IN1]; // read IN1 fresh from the port; keep the full byte for the delegate's tests
  // Low-two-bits window of IN1: if the player is pressing one of those controls, post the sound request
  // by writing selector value 0x16 into the shared control cell loc_41df for the sound driver to pick up.
  if (in1 & LOW_TWO_BITS) mem8[loc_41df] = CONTROL_SEED;

  // Continue the scan: the delegate does its own IN0|IN1 bit tests.
  // Pass the caller's IN0 (B) and the full IN1 byte just read so the downstream folded-port tests see both.
  return requestSound6AndContinueInputScan(m, in0, in1);
}
