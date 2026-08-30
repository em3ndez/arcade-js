// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceRisingActorStep — one per-frame step of an actor in its "rising" state (state 6).
 * ROM 0x2ab3. [seen]
 *
 * Runs for an actor whose state byte selects this handler: an object that is travelling
 * upward until it reaches the top of its track, at which point it settles and moves on to
 * its next state. It works entirely on the actor's own record (based at IX), doing three
 * things each frame: re-arm the per-frame timer, flap the display tile, and climb.
 *
 * The vertical travel is tracked by the rise counter at rec+0x06, which is incremented every
 * frame and drives the actor upward until it reaches the top-of-track value 0xc0. Until then
 * the routine returns early — the climb continues next frame. When the counter finally
 * reaches 0xc0 the actor has arrived: its base Y (rec+0x04) is nudged down by 3 to seat it,
 * its state byte (rec+0x02) is advanced to the following state, and a long inter-state delay
 * is loaded so the next state does not begin immediately.
 *
 * LIVE-OUT: memory only — the actor record at IX (per-frame delay, frame counter, display
 * tile, rise counter, and on arrival the base Y, state byte and the long delay). No register
 * or flag survives; a leaf that calls nothing.
 */
export function advanceRisingActorStep(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Re-arm the short per-frame delay (rec+0x11 = 2): the dispatcher that runs actor states
  // uses this as the number of frames to wait before stepping this actor again, so while
  // rising the actor is serviced at a steady quick cadence.
  mem8[rec + 0x11] = 0x02;

  // Animate the flap: rec+0x0b is a free-running frame counter. Every 4th frame (low two
  // bits zero) toggle the display tile (rec+0x0f) between its two wing pictures, 0x15 and
  // 0x1e, giving the slow up-and-down flap of a rising actor.
  mem8[rec + 0x0b] = mem8[rec + 0x0b] + 1;
  if ((mem8[rec + 0x0b] & 0x03) === 0) {
    mem8[rec + 0x0f] = mem8[rec + 0x0f] === 0x15 ? 0x1e : 0x15;
  }

  // Climb: bump the rise counter (rec+0x06) one step upward. While it is still below the
  // top-of-track value 0xc0 the actor has not arrived yet, so nothing more happens this
  // frame — it keeps rising on the following frames.
  mem8[rec + 0x06] = mem8[rec + 0x06] + 1;
  if (mem8[rec + 0x06] < 0xc0) return;

  // Reached the top of the track: seat the actor by nudging its base Y (rec+0x04) down by 3,
  // advance its state byte (rec+0x02) to the next state in its sequence, and load the long
  // inter-state delay (rec+0x11 = 0x40) so the newly entered state waits before it begins.
  mem8[rec + 0x04] = mem8[rec + 0x04] - 0x03;
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1;
  mem8[rec + 0x11] = 0x40;
}
