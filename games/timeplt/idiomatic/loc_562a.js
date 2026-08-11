// SPDX-License-Identifier: GPL-3.0-only
/** loc_562a — append one sound code to the tail of the pending-sound queue. The queue's first
 * cell holds how many entries are waiting; this steps that count on and writes the code into the
 * cell the new count selects, so entries land in arrival order and the count doubles as the
 * queue's length. Nothing tests for room, and the count wraps at a byte. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { SOUND_QUEUE_COUNT } from "./names.js";


export function loc_562a(m, command) {
  const { mem8 } = m;
  const length = u8(mem8[SOUND_QUEUE_COUNT] + 1);
  mem8[SOUND_QUEUE_COUNT] = length;
  mem8[u16(SOUND_QUEUE_COUNT + length)] = command;
}
