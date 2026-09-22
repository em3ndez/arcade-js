// SPDX-License-Identifier: GPL-3.0-only
/**
 * probeMarioDescentLanding — the board split at the head of the player-vs-tilemap descent probe:
 * off 25m (BOARD != 1) delegate the whole probe to the two-point form; on 25m run a single-point
 * probe that snaps Mario onto the tile surface under him when he is within three pixels of it.
 *
 * Return `{ skip, verdict }`: skip is the caller-skip (true = normal return, false = the two-frame
 * collision-walk unwind; only the off-25m arm can return true). verdict is the descent value the
 * airborne handler branches on (formerly left in A) — 1 where Mario landed/snapped, else 0.
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

export function probeMarioDescentLanding(m, ix = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[BOARD] !== BOARD_25M) return loc_2b53(m, ix);

  const probeHl = (mem8[MARIO_X] << 8) | u8(mem8[MARIO_Y] + PROBE_OFFSET);
  const probe = probeTileForLanding(m, probeHl, ix);
  if (probe.skip === false) return { skip: false, verdict: probe.a };

  if (probe.a === 0) return { skip: loc_2b51(m), verdict: 0 };

  const probeCoord = probe.e;
  const surfaceBoundary = probe.c;
  if (u8(probeCoord - surfaceBoundary) >= SNAP_REACH) return { skip: loc_2b74(m), verdict: 0 };

  mem8[MARIO_Y] = surfaceBoundary - PROBE_OFFSET;
  // keep the two result bytes on the register file; the snap's verdict is 1
  return (m.regs.a = 1, m.regs.b = 1, { skip: loc_2b51(m), verdict: 1 });
}
