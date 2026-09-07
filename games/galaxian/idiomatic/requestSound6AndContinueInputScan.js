// SPDX-License-Identifier: GPL-3.0-only
import { loc_41df } from "./names.js";
import { armInputFlagAndDrawInputColumns } from "./armInputFlagAndDrawInputColumns.js";

/**
 * requestSound6AndContinueInputScan (ROM 0x1c5d) -- one link in the attract-mode input-scan chain
 * that watches the panel controls and, on certain button/stick bits, posts a sound request.
 *
 * WHAT IT IS
 *   Galaxian folds its two input ports into a single byte and tests it a few bits at a time to decide
 *   whether the player is touching the controls. This link handles the bits-2-3 window: if either the
 *   IN0 byte (caller's B) or the IN1 byte (caller's C) has bit 2 or bit 3 set (mask 0x0c), it seeds the
 *   shared sound-request selector loc_41df (0x41df) with the value 6. That selector is the single cell
 *   armSoundSequenceBySelector (0x1819) keys on to arm a sound sequence, gated on the sound driver
 *   flag loc_4006 bit 0 -- so seeding it here is how a control input turns into an audible cue.
 *
 * ROLE IN THE MACHINE
 *   Reached as a fall-through from requestSoundOnInput1AndContinueScan (0x1c50), which handles the IN1
 *   low-two-bits window just above. After this link seeds (or skips) the selector it does not stop: it
 *   tail-calls armInputFlagAndDrawInputColumns (0x1c68) to continue the input-column scan and draw the
 *   attract-mode dip-switch readout, handing the same folded IN0/IN1 bytes downstream for its own bit
 *   tests (its shared bit-4 test, then the screen-fill seed). See mechanisms.md "Sound requests and the
 *   shared selector" and "The attract input readout and the screen fill".
 *
 * Grounding: [seen] (names.js cert for 0x1c5d).
 *
 * LIVE-OUT: whatever armInputFlagAndDrawInputColumns returns; loc_41df is set to 6 on a matching input.
 */
const SCAN_BITS = 0x0c;   // bits 2-3 of the folded input ports
const CONTROL_SEED = 6;

export function requestSound6AndContinueInputScan(m, in0 = m.regs.b, in1 = m.regs.c) {
  const { mem8 } = m;

  // Fold the two input bytes and test the bits-2-3 window. When either port shows one of those bits set,
  // post the sound request by writing selector value 6 into the shared control cell loc_41df; the sound
  // driver picks it up on a later frame (gated on loc_4006 bit 0) and arms the matching sequence.
  if ((in0 | in1) & SCAN_BITS) mem8[loc_41df] = CONTROL_SEED;
  // Continue the scan regardless: hand the same folded bytes to the input-flag / column-draw link so the
  // attract readout keeps painting and the remaining input bits get tested.
  return armInputFlagAndDrawInputColumns(m, in0, in1);
}
