// SPDX-License-Identifier: GPL-3.0-only
import { loc_2778 } from "./loc_2778.js";
import { loc_210b } from "./loc_210b.js";
import { loc_2157 } from "./loc_2157.js";
/**
 * loc_2101 — boot-frontier sub-dispatch.
 *
 * Runs the three frontier sub-passes in order, once per call: the launch-sequence state driver,
 * the one-shot slot-arming advance, and the paired-slot integrity scan; then returns.
 *
 * LIVE-OUT: none — a void sequencer; each sub-pass acts on memory and the caller reads nothing back.
 */
export function loc_2101(m) {
  m.push16(0x2104); // return slot the tail-dispatcher's ret consumes
  loc_2778(m);
  loc_210b(m);
  loc_2157(m);
}
