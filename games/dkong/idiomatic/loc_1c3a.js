// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c3a — tick the airborne object-counter; on the tick that reaches zero settle the
 * landing, otherwise arm the land-check phase and reset the ballistic state.  ROM 0x1C3A.
 *
 * Entered from the airborne handler (entry_1c05) by a tail branch, with the mover's
 * object-counter in one register and a landing flag in another. It ticks the counter
 * down one:
 *
 *   - When the tick reaches zero, Mario has just landed: hand off to the landing-settle
 *     routine settleMarioOnLanding, which reads the landing flag from the register bank the mover set
 *     up (0 in normal play). That routine tail-refreshes the sprite record itself.
 *   - Otherwise he is still airborne: arm the land-check phase (the landing-register value
 *     plus one — in play that register is 0 here, so this stores 1) and zero the whole
 *     ballistic block — horizontal velocity hi/lo, vertical velocity hi/lo, and the
 *     airborne-frame count — then refresh Mario's hardware sprite record.
 *
 * Register boundary: the counter and landing flag are still passed in registers because
 * the sole caller (entry_1c05) is the frozen translated oracle; this reads them from the
 * register bank exactly as that caller loads them. Both tail branches reach an idiomatic
 * callee directly (no address dispatch, no stack model).
 *
 * Memory-equivalent to the frozen oracle — equivalence-1c3a.test.js.
 * GATE:     captured + crafted. Real attract dispatches (the airborne handler runs while
 *           the 25m demo jumps) cover the still-airborne arm and the counter-zero landing
 *           arm; crafted entries pin the landing-flag+1 store for nonzero flags, the
 *           counter=0 non-landing case (register wrap, not b<=1), and the landing arm's
 *           pending-pickup path (settleMarioOnLanding -> loc_1d95), whose dissolved push16/ret makes
 *           the STACK_SCRATCH exclusion load-bearing. Teeth: a dropped land-check +1, a
 *           skipped ballistic-block clear, and an inverted counter branch.
 * LIVE-OUT: memory-only — MARIO_AIR_LANDCHECK, the five ballistic cells, and everything
 *           the two tail callees write (Mario's landed/active/sprite state, the sprite
 *           record). Every path reaches the convergence tail by an unconditional branch
 *           and returns through its single terminal `ret`, so no successor reads a leftover
 *           register or flag; the counter and landing register are dead past the branch.
 * NAMES:    MARIO_AIR_LANDCHECK (0x621F), MARIO_AIR_VX_HI/LO (0x6210/0x6211),
 *           MARIO_AIR_VY_HI/LO (0x6212/0x6213), MARIO_AIR_FRAMES (0x6214) — all from
 *           names.js. The two direct-called callees (settleMarioOnLanding, writeMarioSpriteRecord) own
 *           the rest.
 */

import {
  MARIO_AIR_LANDCHECK,
  MARIO_AIR_VX_HI,
  MARIO_AIR_VX_LO,
  MARIO_AIR_VY_HI,
  MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES,
} from "./names.js";
import { settleMarioOnLanding } from "./settleMarioOnLanding.js"; // ROM 0x1C4F
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js"; // ROM 0x1DA6

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
