// SPDX-License-Identifier: GPL-3.0-only
/**
 * resolveFrogMoveAgainstLanes  —  ROM 0x12e4  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The UPPER HALF of the per-frame frog-vs-lane resolver — the routine that decides, once the frog has
 *   just hopped, whether that horizontal move lands it on a car (road: blocked/fatal), a log (river: safe
 *   ride), or empty water (river: drown). "Lane" here means one horizontal band of the playfield: the five
 *   road rows of traffic and the five river rows of logs/turtles. Each band's obstacles live in a small
 *   work-RAM list of X-positions, and this routine scans the one list the frog is standing in.
 *
 * WHERE IT SITS
 *   The decision is split across two mirror halves, each a 16-way dispatch keyed on a nibble of the frog's
 *   row. The LOWER half dispatchFrogMoveAgainstLanes (ROM 0x11bf) is the entry point the game calls each
 *   frame; it owns some row nibbles and hands the rest to THIS upper half. Both halves share one ten-entry
 *   lane map, the shared band-scan below, and the kill tail killFrogAtLane (ROM 0x12d0). The +15 bias this
 *   half applies to the row (vs. the lower half keying on the raw row) is what makes the two halves
 *   partition the frog's exact sub-row between them — together they cover every row boundary.
 *
 *   The lane object-lists this routine reads are (re)written every frame by the frog-animation render
 *   arms: render arm k repopulates lane nibble k+3's list (count byte + object X-positions), so the render
 *   pass and this collision scan are two ends of the very same data structure.
 *
 * LIVE-OUT
 *   Memory only. On a road hit it writes HOLD_FLAG (0x8004) = 1 (the "move resolved / frog stopped" latch);
 *   on a river-water miss it tail-calls killFrogAtLane, whose own writes (HOLD_FLAG, and SECOND_BANK 0x829c
 *   in the mid-river band) are its live-out. It returns nothing and leaves no register the caller reads.
 */
import {
  HOLD_FLAG, FROG_Y, LANE_LOW_BOUND_SELECTOR, FROG_X,
  SPRITE_BLOCK2_BASE, LANE_OBJLIST_8109, LANE_OBJLIST_8112, LANE_OBJLIST_811B, LANE_OBJLIST_8124, LANE_OBJLIST_8136, LANE_OBJLIST_813F, LANE_OBJLIST_8148, LANE_OBJLIST_8151, LANE_OBJLIST_815A,
} from "./names.js";

import { killFrogAtLane } from "./dispatchFrogMoveAgainstLanes.js";

// Row nibble → [lane object-list base, band width], decoded from the ROM arm-pointer table at 0x130b.
// The KEY is the high nibble of (FROG_Y 0x8047 + 15): ten of the sixteen possible nibbles name a real lane
// (rows 0x3x..0x7x are the five river lanes, rows 0x9x..0xDx the five road lanes); the six not listed
// (0-2, 8, 14-15) are the "no-lane arm" — the top HUD strip, the goal-bay row, and the gap between river
// and road — which scan nothing. Each VALUE pairs the list's work-RAM base with that lane's band WIDTH:
// the pixel span, ahead of the frog's X, in which an obstacle counts as overlapping this hop. The bases
// are the same lists the render arms fill each frame (SPRITE_BLOCK2_BASE 0x8100 is nibble-3's list; the
// LANE_OBJLIST_* consts are 0x8109, 0x8112, … 0x815a for nibbles 4..13).
const LANES = new Map([
  [3, [SPRITE_BLOCK2_BASE, 60]],
  [4, [LANE_OBJLIST_8109, 31]],
  [5, [LANE_OBJLIST_8112, 92]],
  [6, [LANE_OBJLIST_811B, 44]],
  [7, [LANE_OBJLIST_8124, 47]],
  [9, [LANE_OBJLIST_8136, 34]],
  [10, [LANE_OBJLIST_813F, 18]],
  [11, [LANE_OBJLIST_8148, 18]],
  [12, [LANE_OBJLIST_8151, 18]],
  [13, [LANE_OBJLIST_815A, 18]],
]);

export function resolveFrogMoveAgainstLanes(m) {
  const { mem8 } = m;

  // ── The mirror gate: is the move already resolved this frame? ─────────────────────────
  // HOLD_FLAG (0x8004) is the "move resolved / frog already hit" latch. Once any earlier step this frame
  // has raised it — a block, a kill, a ride locked in — no further lane scan may run, so we bail. The
  // lower half checks this same flag; re-checking it here is what lets the lower half safely delegate to
  // this half without re-clearing state.
  if (mem8[HOLD_FLAG] !== 0) return;

  // ── Pick the lane from the frog's row ─────────────────────────────────────────────────
  // FROG_Y (0x8047) is the frog's game-space row (0xE0 at the screen bottom, falling toward 0x40 as the
  // frog climbs). Bias it by +15: `key` is the row adjusted to its band boundary, so this upper half keys
  // on a half-row shifted from the lower half — together the two halves partition the frog's exact sub-row.
  const key = (mem8[FROG_Y] + 15) & 0xff;

  // The LOW nibble sub-selects within a band. Below 5 the frog sits in the no-lane arm (arm 0) — a strip
  // that carries no obstacle list — so there is nothing to scan and the move is unconditionally allowed.
  if ((key & 0x0f) < 5) return;

  // The HIGH nibble selects the lane. A nibble absent from the map (0-2, 8, 14-15) is likewise a no-lane
  // arm: no obstacles, move allowed.
  const lane = LANES.get((key & 0xf0) >> 4);
  if (!lane) return;

  // Scan the selected lane's obstacle list against the frog's move band.
  const [laneBase, width] = lane;
  return scanLane(m, laneBase, width);
}

// Band-scan of one lane's object list against the frog's just-moved position. Shared with the lower half.
function scanLane(m, laneBase, width) {
  const { mem8 } = m;

  // ── Build the horizontal overlap window [low, low+width) in frog X-space ───────────────
  // FROG_X (0x8044) is the frog's horizontal position; `offset` nudges the window's left edge so it sits
  // over the frog's body rather than its corner. This upper half picks the offset from LANE_LOW_BOUND_
  // SELECTOR (0x802f): 12 px when it is < 128, else 3 px. (The lower half selects the same 12/3 pair from
  // FROG_Y instead — the two halves land on the same window from different selectors.)
  const offset = mem8[LANE_LOW_BOUND_SELECTOR] < 128 ? 12 : 3;
  const low = (mem8[FROG_X] + offset) & 0xff;

  // The window is `width` pixels wide. If low+width overflows a byte the window wraps past the 0xFF/0x00
  // seam, so the in-band test must flip from an AND (a normal interval) to an OR (the two split ends of a
  // wrapped interval). `top` is the wrapped upper bound; `wrapped` records which test to use.
  const highRaw = low + width;
  const wrapped = highRaw > 0xff;
  const top = highRaw & 0xff;

  // ── Walk the lane's object list ───────────────────────────────────────────────────────
  // The list is laid out as a leading COUNT byte at `laneBase`, then that many obstacle X-positions at
  // laneBase+1, laneBase+2, …. A stored count of 0 means "scan the full 256" (0 → 256 here), matching the
  // ROM's 8-bit down-counter that wraps 0x00→0xFF when decremented.
  let remaining = mem8[laneBase] || 256;
  let p = laneBase;
  for (;;) {
    p = p + 1;
    const objX = mem8[p];

    // Is this obstacle inside the frog's move window? Straight interval when the window fits in a byte,
    // split interval when it wrapped past the seam.
    const inBand = wrapped ? objX >= low || objX < top : objX >= low && objX < top;
    if (inBand) {
      // An obstacle overlaps the frog. The meaning splits at FROG_Y 0x80 — the road (Y >= 0x80, lower
      // screen) versus the river (Y < 0x80, upper screen):
      //   • River: the obstacle is a LOG to ride. The hop is safe — return without touching HOLD_FLAG so
      //     the frog rides on (the lower half routes this back through here, which likewise returns).
      if (mem8[FROG_Y] < 128) return;
      //   • Road: the obstacle is a CAR. The hop is blocked/fatal — latch HOLD_FLAG (0x8004) = 1 to stop
      //     the frog on the spot (equivalent here to the kill tail, which returns before touching
      //     SECOND_BANK in the road band).
      mem8[HOLD_FLAG] = 1;
      return;
    }

    // Not in band — retire this obstacle and keep scanning until the count is exhausted.
    remaining = (remaining - 1) & 0xff;
    if (remaining !== 0) continue;

    // ── Lane clear (no obstacle overlapped) ─────────────────────────────────────────────
    // Again the road/river split at FROG_Y 0x80:
    //   • River (Y < 0x80): a clear lane is OPEN WATER — the frog has nothing to land on and drowns via
    //     the shared kill tail killFrogAtLane (ROM 0x12d0), which raises HOLD_FLAG and, in the mid-river
    //     sub-band 0x30 <= FROG_Y < 0x80, the drown cell SECOND_BANK (0x829c).
    if (mem8[FROG_Y] < 128) return killFrogAtLane(m);
    //   • Road (Y >= 0x80): a clear lane is SAFE ROAD — the move is allowed, return.
    return;
  }
}
