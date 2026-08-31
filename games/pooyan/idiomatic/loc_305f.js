// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { queueSoundCommand0D } from "./queueSoundCommand0D.js";
import {
  GRAB_WINDOW_TABLE,
  PLAYER_Y,
  FORMATION_STATE,
  WAVE_TEARDOWN_STATE,
  GRAB_ACTIVE_FLAG,
} from "./names.js";
/**
 * loc_305f — rope-grab trigger test (dissolved caller-skip).
 *
 * Looks up this cell's catch-window half-width from a table keyed by the low two bits of IXL,
 * then tests the tracked player coordinate against a fixed-width window around it. Outside that
 * window, or with the formation or wave-teardown state busy, no grab fires; inside and idle it
 * raises the grab-active latch, enqueues the grab command, and takes the grab path.
 *
 * Returns true on the normal path and false on the grab path. The false return is the dissolved
 * caller-skip: the invoking rope-cell handler early-returns on it and abandons the cell update.
 *
 * LIVE-OUT: none — the boolean is the only result; no register is read back across it.
 */
const LOW_MARGIN = 0x07; // window low edge sits this far below the player coordinate
const WINDOW_SPAN = 0x0e; // low edge to high edge span

export function loc_305f(m, ixl = m.regs.ix & 0xff) {
  const { mem8 } = m;

  const [halfWidth] = fetchByteFromTableIndex(m, GRAB_WINDOW_TABLE, ixl & 0x03);
  const loEdge = (mem8[PLAYER_Y] - LOW_MARGIN) & 0xff;
  const hiEdge = (loEdge + WINDOW_SPAN) & 0xff;
  if (hiEdge < halfWidth) return true; // player beyond the far edge
  if (loEdge >= halfWidth) return true; // player before the near edge
  if ((mem8[FORMATION_STATE] | mem8[WAVE_TEARDOWN_STATE]) !== 0) return true;

  mem8[GRAB_ACTIVE_FLAG] = 0x01; // raise the grab-active latch
  queueSoundCommand0D(m); // enqueue the grab command
  return false;
}
