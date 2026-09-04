// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_EXPLOSION_TIMER, ALIEN_EXPLOSION_ADDR } from "./names.js";
import { clearSpriteColumn } from "./clearSpriteColumn.js";
import { retirePlayerShot } from "./retirePlayerShot.js";

/**
 * tickAlienExplosionDespawn — time out and erase a killed alien's explosion sprite.
 *
 * WHAT IT IS
 *   Counts the alien-explosion despawn timer down one tick per call; while it is still running it does
 *   nothing, and on the tick it reaches zero it wipes the explosion graphic and retires the player shot
 *   that made the kill.
 *
 * ROLE IN THE MACHINE
 *   Part of the player-shot collision teardown (mechanisms.md). When a player shot kills an alien the
 *   resolver enters the explosion state and arms ALIEN_EXPLOSION_TIMER (0x2003); this routine drives its
 *   timed disappearance. On expiry it reloads the explosion sprite's stored screen position from
 *   ALIEN_EXPLOSION_ADDR (0x2064) into HL, clears the sprite's sixteen-row column (clearSpriteColumn),
 *   and runs the shared retirement tail retirePlayerShot (status -> 4, clear the hit latch and silence).
 *
 * ROM 0x1538.  Grounding: [seen].
 *
 * LIVE-OUT: on expiry, HL = the reloaded explosion address and A from retirePlayerShot's tail; while
 * the timer is still running, an early bare return.
 */
export function tickAlienExplosionDespawn(m) {
  // Decrement the despawn countdown; while it has not reached zero the explosion stays on screen.
  m.mem8[ALIEN_EXPLOSION_TIMER] = m.mem8[ALIEN_EXPLOSION_TIMER] - 1;
  if (m.mem8[ALIEN_EXPLOSION_TIMER] !== 0) return;
  // Expired: reload the stored screen position into HL, clear the 16-row sprite column, then retire the
  // player shot that scored the kill (the shared teardown tail).
  // seat the column start, clear 16 rows, then run the deactivation tail
  return (m.regs.hl = m.mem16[ALIEN_EXPLOSION_ADDR]), clearSpriteColumn(m, 0x10), retirePlayerShot(m);
}
