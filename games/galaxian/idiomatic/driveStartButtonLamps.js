// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveStartButtonLamps — blink the two start-button lamps to invite play.
 *
 * WHAT IT IS
 *   The routine behind the flashing 1-player / 2-player start-button lamps on the press-start screen. It
 *   drives the two lamp latches from the current credit/start count, gated so the lamps blink.
 *
 * ROLE IN THE MACHINE
 *   RST-28 state index 3, and also called by the press-start sub-handlers. The gate is bit 5 of the
 *   free-running FRAME_COUNTER (0x425f): that bit toggles every 32 frames, so the lamps flash. While bit 5
 *   is clear both lamps are forced off; while it is set the lit lamps reflect the credit count loc_4002 —
 *   no credit leaves the lamps as they are, one credit lights lamp 0 (1-player), two or more light both.
 *   The lamp latches START_LAMP_0/1 (0x6000/0x6001) are the same LS259 board addresses that read back as
 *   inputs on the read side.
 *
 * ROM 0x0473.  Grounding: [seen].
 *
 * LIVE-OUT: START_LAMP_0 / START_LAMP_1 written per the credit count and blink phase.
 */
import { FRAME_COUNTER, loc_4002, START_LAMP_0, START_LAMP_1 } from "./names.js";

export function driveStartButtonLamps(m) {
  const { mem8 } = m;

  // Blink gate: on the half of the 32-frame cycle where FRAME_COUNTER bit 5 is clear, both lamps are
  // forced dark — this is what makes the lit lamps flash.
  if ((mem8[FRAME_COUNTER] & 0x20) === 0) { // bit 5 clear: lamps disabled
    mem8[START_LAMP_0] = 0;
    mem8[START_LAMP_1] = 0;
    return;
  }

  // Gate open: light lamps to match the bank.
  const credits = mem8[loc_4002];
  if (credits === 0) return; // no credits: leave the lamps as they are
  // One credit lights just lamp 0 (1-player); a second credit adds lamp 1 (2-player).
  mem8[START_LAMP_0] = 1; // at least one credit
  if (credits >= 2) mem8[START_LAMP_1] = 1; // two or more
}
