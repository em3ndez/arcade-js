// SPDX-License-Identifier: GPL-3.0-only
/**
 * probeMarioDescentLanding — the board split at the head of the player-vs-tilemap descent probe:
 * off 25m (BOARD != 1) delegate the whole probe to the two-point form; on 25m run a single-point
 * probe that snaps Mario onto the tile surface under him when he is within three pixels of it.
 *
 * Return (caller-skip): true = normal return; false = the two-frame collision-walk unwind. Only
 * the off-25m arm can return true.
 *
 * LIVE-OUT: MARIO_Y on the snap arm; the two result bytes the consumer reads back; and the
 * caller-skip boolean.
 */

import { u8 } from "../../../core/int.js";
import { loc_2b53 } from "./loc_2b53.js";
import { probeTileForLanding } from "./probeTileForLanding.js";
import { loc_2b51 } from "./loc_2b51.js";
import { loc_2b74 } from "./loc_2b74.js";
import { BOARD, MARIO_X, MARIO_Y } from "./names.js";

const BOARD_25M = 1;
const PROBE_OFFSET = 7;
const SNAP_REACH = 4;

export function probeMarioDescentLanding(m) {
  const { regs, mem8 } = m;

  if (mem8[BOARD] !== BOARD_25M) return loc_2b53(m);

  const probeHl = (mem8[MARIO_X] << 8) | u8(mem8[MARIO_Y] + PROBE_OFFSET);
  if (probeTileForLanding(m, probeHl) === false) return false;

  // regs.a/e/c below are probeTileForLanding's outputs, read back off the bridge.
  if (regs.a === 0) return loc_2b51(m);

  const probeCoord = regs.e;
  const surfaceBoundary = regs.c;
  if (u8(probeCoord - surfaceBoundary) >= SNAP_REACH) return loc_2b74(m);

  mem8[MARIO_Y] = surfaceBoundary - PROBE_OFFSET;
  return (m.regs.a = 1, m.regs.b = 1, loc_2b51(m)); // keep the two result bytes on the bridge
}
