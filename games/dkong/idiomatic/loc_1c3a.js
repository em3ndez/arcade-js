// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c3a — tick the airborne counter; on the tick that reaches zero settle Mario's landing,
 * otherwise arm the land-check phase, zero the ballistic block, and refresh his sprite record.
 * The counter and landing flag arrive in registers.
 *
 * LIVE-OUT: memory-only — the land-check phase byte and the five ballistic cells on the airborne
 * arm, plus everything the two tails write (Mario's landed/active state and his sprite record).
 */

import {
  MARIO_AIR_LANDCHECK,
  MARIO_AIR_VX_HI,
  MARIO_AIR_VX_LO,
  MARIO_AIR_VY_HI,
  MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES,
} from "./names.js";
import { settleMarioOnLanding } from "./settleMarioOnLanding.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

export function loc_1c3a(m, counter = m.regs.b, landingFlag = m.regs.a) {
  const { mem8 } = m;

  // Tick reaches zero -> Mario just landed; hand off to the landing-settle routine.
  const airCounter = counter - 1;
  if (airCounter === 0) {
    settleMarioOnLanding(m);
    return;
  }

  // Still airborne: arm the land-check phase (landing-flag register + 1, so 1 in play) and zero
  // the whole ballistic block.
  mem8[MARIO_AIR_LANDCHECK] = landingFlag + 1;
  mem8[MARIO_AIR_VX_HI] = 0;
  mem8[MARIO_AIR_VX_LO] = 0;
  mem8[MARIO_AIR_VY_HI] = 0;
  mem8[MARIO_AIR_VY_LO] = 0;
  mem8[MARIO_AIR_FRAMES] = 0;

  writeMarioSpriteRecord(m);
}
