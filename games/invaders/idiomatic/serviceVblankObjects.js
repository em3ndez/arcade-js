// SPDX-License-Identifier: GPL-3.0-only
import { drawPendingAlien } from "./drawPendingAlien.js";
import { walkVblankObjectTable } from "./walkVblankObjectTable.js";
import { tickSaucerSpawnTimer } from "./tickSaucerSpawnTimer.js";
import { loc_2080, loc_2032 } from "./names.js";

/**
 * serviceVblankObjects -- the shared vblank record tail run once per frame during play and the demo.
 *
 * WHAT IT IS
 *   The per-frame batch of object work the vblank interrupt performs after the fleet-march beat: publish a
 *   latch byte, redraw the pending marching alien, run the object-record table, and step the saucer spawn
 *   timer. It is the single body that both the live game and the attract demo share -- in-game it runs
 *   every frame (idiomaticVblankNmi), and in attract it is the bit0 arm of the task dispatcher
 *   (dispatchAttractTask -> runAttractObjectTail).
 *
 * ROLE IN THE MACHINE
 *   Copies the byte at loc_2032 into loc_2080 (both keep loc_ placeholder names -- their roles are not
 *   confidently recovered, so only the copy itself is asserted here). drawPendingAlien paints the one alien
 *   the march selector queued into ALIEN_DRAW_ADDR this pass. walkVblankObjectTable dispatches the 16-byte
 *   object records at GAME_OBJECT_TABLE (0x2010) to their handlers; a handler may arm a warm restart
 *   (round end, death), which sets m.nextMain so the engine swaps the main flow. tickSaucerSpawnTimer
 *   counts the rolling SAUCER_TIMER down toward the next saucer.
 *
 * ROM 0x0072.  Grounding: §4 clock-free spine (its leaves drawPendingAlien / walkVblankObjectTable /
 * tickSaucerSpawnTimer carry [seen] certs; the loc_2032->loc_2080 copy's meaning is [guess]).
 *
 * LIVE-OUT: memory + video RAM. Returns early (skipping the saucer tick) when a warm restart was armed.
 */
export function serviceVblankObjects(m) {
  // Propagate the loc_2032 byte forward into loc_2080 at the top of the tail (roles ungrounded; see above).
  m.mem8[loc_2080] = m.mem8[loc_2032];
  // Draw the marching alien the selector queued for this frame (or tick the explosion despawn instead).
  drawPendingAlien(m);
  // Run the object-record table: each active record's handler steps its own object in place.
  walkVblankObjectTable(m);
  // A handler armed a warm restart (round end / death): return at once so the interrupt exits
  // promptly and the engine can swap the main flow -- skip the saucer step this frame.
  if (m.nextMain) return;
  // Advance the saucer spawn countdown toward the next mystery ship.
  tickSaucerSpawnTimer(m);
}
