// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c3a — tick the airborne counter; on the tick that reaches zero settle Mario's landing,
 * otherwise arm the land-check phase and reset his ballistic state.
 *
 * Entered from the airborne handler with the mover's own counter in one register and a landing
 * flag in another. It ticks that counter down one:
 *
 *   - When the tick reaches zero Mario has just landed: hand off to the landing-settle routine,
 *     which reads the landing flag from the register bank the mover set up — zero in normal
 *     play — and refreshes the sprite record on its own tail.
 *   - Otherwise he is still airborne: arm the land-check phase, storing the landing-flag
 *     register plus one (that register is zero in play, so this stores 1), and zero the whole
 *     ballistic block — horizontal velocity high and low, vertical velocity high and low, and
 *     the airborne-frame count — then refresh Mario's hardware sprite record.
 *
 * The counter and landing flag arrive in registers because the caller hands them over that way.
 *
 * Reads: the two caller-supplied registers. Writes: the land-check phase byte and the five
 * ballistic cells on the airborne arm, plus everything the two tails write — Mario's landed and
 * active state and his sprite record.
 *
 * LIVE-OUT: memory-only. Both arms converge on a sprite refresh and nothing downstream reads a
 * register this routine leaves.
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

export function loc_1c3a(m) {
  const { regs, mem } = m;

  // Tick the mover's airborne object-counter down one. When that tick reaches zero Mario
  // has just landed; hand off to the landing-settle routine, which reads the landing flag
  // (0 in normal play) from the register bank the mover set up and refreshes the sprite
  // record on its own tail.
  const airCounter = regs.b - 1;
  if (airCounter === 0) {
    settleMarioOnLanding(m);
    return;
  }

  // Still airborne: arm the land-check phase — the landing-flag register plus one (that
  // register is 0 in play, so this stores 1) — and zero the whole ballistic block:
  // horizontal velocity, vertical velocity, and the airborne-frame count.
  mem.write8(MARIO_AIR_LANDCHECK, regs.a + 1);
  mem.write8(MARIO_AIR_VX_HI, 0);
  mem.write8(MARIO_AIR_VX_LO, 0);
  mem.write8(MARIO_AIR_VY_HI, 0);
  mem.write8(MARIO_AIR_VY_LO, 0);
  mem.write8(MARIO_AIR_FRAMES, 0);

  // The convergence tail: copy Mario's settled fields into his hardware sprite record.
  writeMarioSpriteRecord(m);
}
