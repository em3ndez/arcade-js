// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ef1 } from "./loc_0ef1.js";
/**
 * loc_5f02 — enqueue the fixed sound-effect command, then return.
 *
 * A thin trampoline: it defers entirely to the sound-command enqueue entry, whose single
 * effect is to push one fixed command byte into the sound-command ring.
 *
 * LIVE-OUT: memory only (the filled ring slot and the advanced write pointer). No register is
 * a consumed live-out; the enqueue path reloads A at every use site.
 */
export function loc_5f02(m) {
  return loc_0ef1(m);
}
