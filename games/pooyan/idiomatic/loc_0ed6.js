// SPDX-License-Identifier: GPL-3.0-only
import { loc_0eb3 } from "./loc_0eb3.js";
/**
 * loc_0ed6 — enqueue the fixed sound command 0x02 into the sound-command ring. A one-line
 * wrapper: it selects command id 0x02 and hands it to the ring-enqueue helper.
 *
 * LIVE-OUT: none — memory only (the helper's filled slot + advanced pointer); sites reload A.
 */

const SOUND_COMMAND = 0x02; // the sound-command id this wrapper enqueues

export function loc_0ed6(m) {
  return loc_0eb3(m, SOUND_COMMAND);
}
