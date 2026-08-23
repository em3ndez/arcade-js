// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand0E — append the fixed byte 0x0e into the command ring: load a constant byte and
 * hand it to the ring-append helper, whose gate, cursor advance and returned cursor are
 * this entry's whole effect and result.
 *
 * LIVE-OUT: A = the helper's advanced ring cursor (0 when the append gates are closed),
 * set through the helper's own return-assignment for a caller that reads A back.
 */

const RING_BYTE = 0x0e; // the byte this entry appends

export function queueSoundCommand0E(m) {
  return appendSoundCommandGated(m, RING_BYTE);
}
