// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";
import { waitLongDelay } from "./waitLongDelay.js";
import { TASK_FLAGS, ATTRACT_ANIM_ACK, loc_207e, loc_2050, loc_2080, loc_1bc0, loc_3311 } from "./names.js";

/**
 * runHandshakedAttractAnim — drive one reveal step of the attract screen via an ISR handshake.
 *
 * WHAT IT IS
 *   One step of the credit/high-score attract "reveal" animation. It seeds the attract-demo object
 *   record, arms the animation task for the interrupt to run, waits for the interrupt to acknowledge
 *   the step (a bit that goes set then clear), draws the fixed sprite, and settles with a delay.
 *
 * ROLE IN THE MACHINE
 *   The attract sequence runs off the interrupt heartbeat (mechanisms.md, the attract sequence). This
 *   routine block-copies a fixed ROM descriptor at loc_1bc0 into the attract-demo object table at
 *   loc_2050 (0x10 bytes) -- which is what makes the walker dispatch object handler 0x050e each reveal
 *   cycle -- seeds loc_2080=2 and loc_207e=0xff (an alien-shot step cell; the =2 role at loc_2080 is
 *   ungrounded), and arms TASK_FLAGS (0x20c1) = 4 so the mid-screen interrupt runs that task's walk.
 *   The handshake is on ATTRACT_ANIM_ACK (0x2055) bit0: the object handler toggles it 0->1->0, so this
 *   flow yields until it is set (the step started/ran) then yields until it clears (the step completed).
 *   drawSprite8x8 paints sprite id 0x26 at loc_3311, and waitLongDelay is the 0x80-frame settle pace.
 *
 * ROM 0x189e.  Grounding: [seen].
 *
 * LIVE-OUT: memory + IO; yields across the two handshake spins and the settle delay.
 */
export function* runHandshakedAttractAnim(m) {
  // Seed the attract-demo object record: block-copy the fixed ROM descriptor (loc_1bc0) into the
  // attract object table at loc_2050, which arms object handler 0x050e for the walker to dispatch.
  blockCopy(m, loc_1bc0, loc_2050, 0x10);
  // Prime the step's state cells (loc_2080=2 role ungrounded; loc_207e=0xff is an alien-shot step cell).
  m.mem8[loc_2080] = 0x02;
  m.mem8[loc_207e] = 0xff;
  // Arm the per-frame task bitfield so the interrupt runs the attract-demo walk for this step.
  m.mem8[TASK_FLAGS] = 0x04;
  // Handshake with the interrupt: wait for it to raise the ack bit (step underway)...
  while ((m.mem8[ATTRACT_ANIM_ACK] & 0x01) === 0) yield;
  // ...then wait for it to drop the ack bit again (step complete).
  while ((m.mem8[ATTRACT_ANIM_ACK] & 0x01) !== 0) yield;
  // Draw the revealed sprite (id 0x26) at its fixed screen slot, then settle for the long attract delay.
  drawSprite8x8(m, 0x26, loc_3311);
  yield* waitLongDelay(m);
}
