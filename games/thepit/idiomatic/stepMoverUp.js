// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepMoverUp — commit one preset move-step for the tracked mover: step its X down a
 * pixel and, on the movement cadence, republish its travel direction.  ROM 0x3476.
 *
 * The per-object move driver (stepEnemyMover) probes the tiles around the mover each
 * frame and, once it has settled on where the object should go, tail-jumps into one
 * of four near-identical preset entry points. This is the "direction 0" preset (its
 * three siblings 0x347d/0x3484/0x348b are the other directions). Because the driver
 * reaches here by tail-jump, this routine's return goes straight back to the
 * driver's own caller.
 *
 * Two things happen:
 *   - Every call, the object's vertical position (ENEMY_WORK_Y 0x8086, screen-vertical) is
 *     decreased by one pixel — moving it UP the screen — this preset's move delta (it
 *     wraps within a byte).
 *   - The object's movement-cadence countdown is ticked. It runs freely most
 *     frames; only on the frame it reaches zero does the object re-commit its
 *     motion — the countdown is reloaded from its period byte and the published
 *     travel-direction index is (re)stamped to this preset's value, 0, the index
 *     the driver dispatches on next frame.
 *
 * The sibling presets that carry an orientation flag also refresh the sprite's
 * facing on that cadence tick; this preset carries no such flag, so it never
 * touches the sprite code — that whole branch of the shared body is unreachable
 * from this entry.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3476.test.js.
 * GATE:     real captured attract dispatches (this entry IS reached in attract,
 *           always on the running path) + a crafted near-leaf sweep over its three
 *           input bytes (cadence countdown, reload period, vertical position) that also
 *           covers the expire path and the byte wraps, matched against the oracle,
 *           plus teeth.
 * LIVE-OUT: memory only — the cadence countdown (0x808b), the vertical position (0x8086),
 *           and, on the cadence tick, the travel-direction index (0x8092). The new
 *           coordinate the oracle leaves in the accumulator is dead ABI: the driver reaches
 *           here by tail-jump and reads no register back.
 * NAMES:    ENEMY_ACTION_TIMER (0x808b) is this object's cadence countdown here — loc_3490's
 *           reading of that dual-use byte, the same one reseedMoverCadenceAndRearmState periodically
 *           reseeds. ENEMY_WORK_MOVE_PERIOD (0x8091) is the reload period; the direction
 *           index (0x8092) has no ram.js name yet and stays hex; the vertical position is
 *           ENEMY_WORK_Y (0x8086, screen-vertical).
 */

import { ENEMY_ACTION_TIMER, ENEMY_WORK_DIR, ENEMY_WORK_MOVE_PERIOD, ENEMY_WORK_Y } from "./ram.js";

export function stepMoverUp(m) {
  const { mem8 } = m;

  // Tick the movement-cadence countdown (stored back; 0 becomes 255 on wrap).
  const cadence = mem8[ENEMY_ACTION_TIMER] - 1;
  mem8[ENEMY_ACTION_TIMER] = cadence;

  // On the frame the countdown expires, re-commit the motion: reload the countdown
  // from its period byte and (re)publish this preset's travel-direction index (0).
  if (cadence === 0) {
    mem8[ENEMY_ACTION_TIMER] = mem8[ENEMY_WORK_MOVE_PERIOD]; // reload period for the cadence countdown
    mem8[ENEMY_WORK_DIR] = 0; // published travel-direction index the driver reads next frame
  }

  // Step the object UP the screen one pixel every frame: decrement its vertical position
  // (ENEMY_WORK_Y 0x8086, screen-vertical). This preset's move delta.
  mem8[ENEMY_WORK_Y] = mem8[ENEMY_WORK_Y] - 1;
}
