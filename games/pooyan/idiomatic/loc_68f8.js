// SPDX-License-Identifier: GPL-3.0-only
import { loc_6905 } from "./loc_6905.js";
import { loc_69ad } from "./loc_69ad.js";
import { loc_6a0f } from "./loc_6a0f.js";
import { loc_6a7f } from "./loc_6a7f.js";
/**
 * loc_68f8 — per-frame group update.
 *
 * Runs the four object sub-passes in order, once per frame: the delay-gated enemy-spawn
 * sweep, the paired descending-object stepper, the enemy-spawn sweep driver, and the
 * per-frame object driver with its one-shot tilemap check.
 *
 * LIVE-OUT: none — a void sequencer; each sub-pass acts on memory and the caller reads
 * nothing back.
 */
export function loc_68f8(m) {
  loc_6905(m);
  loc_69ad(m);
  loc_6a0f(m);
  loc_6a7f(m);
}
