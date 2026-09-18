// SPDX-License-Identifier: GPL-3.0-only
/**
 * paceActorCadence — cadence front end for the actor phase body: count the period-8 timer down
 * one tick, reload it to 8 on the tick it runs out, then run the phase body. Reached each frame
 * on the actor's move path (handed here when the actor's X sits in the high half of the field).
 * It advances the cadence timer by one every entry; on the single tick the count runs out it
 * reloads to the full period of 8, keeping the new count otherwise. It then runs the phase body
 * (easeActorToRest), which reads the very byte written here, and whose return is our own.
 */

import { ENEMY3_TIMER } from "./names.js";
import { easeActorToRest } from "./easeActorToRest.js";

export function paceActorCadence(m) {
  const { mem8 } = m;

  // Count the period-8 cadence timer down one tick (wrapping as the 8-bit counter does), then reload to 8 when it runs out.
  const counter = mem8[ENEMY3_TIMER];
  const ticked = counter === 0 ? 255 : counter - 1;
  mem8[ENEMY3_TIMER] = ticked === 0 ? 8 : ticked;

  // Run the phase body on the freshly-updated timer; its return is ours.
  return easeActorToRest(m);
}
