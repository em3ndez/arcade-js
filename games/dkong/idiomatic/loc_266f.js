// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_266f — force object 2's step-direction latch negative-going, then run the shared
 * publish/animate tail.
 *
 * One arm of object 2's per-frame update inside the 50m object cascade, taken when the object's Y
 * has risen past a fixed threshold. The step-direction latch it works on is a shared named cell
 * rather than a pointer the caller supplies, because every real entry arrives with the caller's
 * pointer already fixed on that same cell.
 *
 * It forces the step direction negative unless it already is:
 *   - sign bit already set (already stepping negative) — leave the latch untouched and drop
 *     straight into the shared tail;
 *   - otherwise stamp a full negative step into it first.
 * Either way control falls into the shared tail, which reduces the latch to a ±1 unit step,
 * publishes both polarities to the mover's shadow bytes, and every 32nd frame advances object 2's
 * mirrored sprite pair.
 *
 * NOT CLAIMED: WHICH on-screen 50m object this steers, and what the Y threshold that routes here
 * represents.
 *
 * LIVE-OUT: memory-only — the latch, plus everything the shared tail writes.
 */

import { M50_OBJ2_STEP_DIR } from "./names.js";
import { loc_264c } from "./loc_264c.js";

export function loc_266f(m) {
  const { mem } = m;

  // Force object-2's step direction negative unless the sign bit is already set: on the
  // not-yet-negative case stamp the latch to a full negative step before the shared tail.
  if ((mem.read8(M50_OBJ2_STEP_DIR) & 0x80) === 0) {
    mem.write8(M50_OBJ2_STEP_DIR, 0xff);
  }
  return loc_264c(m);
}
