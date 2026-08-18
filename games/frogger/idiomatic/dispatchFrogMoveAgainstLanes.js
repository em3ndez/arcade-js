// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchFrogMoveAgainstLanes  —  ROM 0x11bf  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The lower half of the per-frame "does this frog move survive?" resolver. Once per gameplay frame,
 *   after the lanes have scrolled, it decides whether the frog's current row is BLOCKED, SAFE, or FATAL
 *   by scanning the sprite objects in the frog's lane against the frog's horizontal position. It is a
 *   sixteen-way dispatch keyed on the frog's row byte FROG_Y (0x8047): six of the sixteen arms hand the
 *   decision to the upper half (resolveFrogMoveAgainstLanes, ROM 0x12e4), and the other ten each own one
 *   lane object-list and run a band scan against it.
 *
 *   The screen splits at FROG_Y 0x80: the ROAD band (Y >= 0x80, lower screen, moving cars) and the
 *   RIVER band (Y < 0x80, upper screen, floating logs). The two bands run the SAME lane scan but INVERT
 *   its verdict — on the road a car under the frog is fatal and open road is safe; on the river a log
 *   under the frog is a ride and open water drowns you.
 *
 * WHERE IT SITS
 *   Run once per in-play frame from the collision/world-step cascade (driveInPlayFrameUpdate), bracketed
 *   there by ±1 nudges of two lane-list indices so the scan reads the pre-scroll object positions. It is
 *   the ENTRY of the two-half resolver and delegates to the upper half for the row arms it does not own;
 *   the upper half in turn calls back into this file's shared kill tail. Inert (falls straight through
 *   the two gates below) on any frame where the frog is mid-hop or its move is already resolved.
 *
 * LIVE-OUT
 *   Memory only. The delegating / return arms write nothing themselves; the killing arms go through
 *   killFrogAtLane, which raises the hold/kill flag (and, mid-river, the second-bank cell). It returns
 *   nothing the caller reads.
 */
import {
  FROG_STATE_DEMO_FLAG, HOLD_FLAG, FROG_Y, FROG_X, SECOND_BANK,
  SPRITE_BLOCK2_BASE, LANE_OBJLIST_8109, LANE_OBJLIST_8112, LANE_OBJLIST_811B, LANE_OBJLIST_8124, LANE_OBJLIST_8136, LANE_OBJLIST_813F, LANE_OBJLIST_8148, LANE_OBJLIST_8151, LANE_OBJLIST_815A,
} from "./names.js";
import { resolveFrogMoveAgainstLanes } from "./resolveFrogMoveAgainstLanes.js";

/**
 * killFrogAtLane  —  ROM 0x12d0  ·  grounding: [code]
 *
 * The shared frog-kill tail, reached from BOTH halves of the lane resolver and from the diver-collision
 * test (mountOrKillFrogOnTwoPairFigure). It unconditionally latches the frog as hit/held by raising
 * HOLD_FLAG (0x8004) — the "move resolved / frog already hit" flag that stops any further lane scan this
 * frame and hands the frog to the death/hop handling downstream. Then, ONLY in the mid-river sub-band
 * (0x30 <= FROG_Y < 0x80), it also raises SECOND_BANK (0x829c), the drown / mid-river-death cell that
 * driveFrogDeathAnimation (0x16f8) reads to pick the water-death phase. Above the river (Y >= 0x80, the
 * road) and in the top home-bay strip (Y < 0x30) it leaves SECOND_BANK untouched and only flags the
 * hold — which is why a road-band "kill" and a plain HOLD_FLAG raise are indistinguishable.
 *
 * LIVE-OUT: memory only (HOLD_FLAG always; SECOND_BANK only mid-river).
 */
export function killFrogAtLane(m) {
  const { mem8 } = m;

  // Latch the frog as hit/held. HOLD_FLAG (0x8004) is the per-frame "already resolved" gate that
  // dispatchFrogMoveAgainstLanes tests on entry, so raising it here also suppresses any later scan.
  mem8[HOLD_FLAG] = 1;

  // The second-bank / drown cell applies ONLY in the mid-river band. Return without touching it in the
  // road band (Y >= 0x80) and in the top home-bay strip (Y < 0x30).
  const y = mem8[FROG_Y];
  if (y >= 0x80) return;
  if (y < 0x30) return;

  // Mid-river (0x30 <= Y < 0x80): raise SECOND_BANK (0x829c) so the death driver plays a water death.
  mem8[SECOND_BANK] = 1;
}

// The ten lane arms, keyed on the HIGH nibble of the frog's row byte FROG_Y (0x8047). Each entry is
// [lane object-list base cell, band width in pixels]. The object-list base is the very cell the matching
// frog-animation render arm repopulates every frame, so the scan reads back exactly the [count, x0, x1,
// …] layout the renderer just wrote. The six nibbles absent from this map (0, 1, 2, 8, 14, 15) delegate
// to the upper half instead; nibble 8 is the deliberate gap — the row that scans no lane.
//   nibble 3 → SPRITE_BLOCK2_BASE 0x8100 (width 60)   nibble  9 → LANE_OBJLIST_8136 0x8136 (width 34)
//   nibble 4 → LANE_OBJLIST_8109 0x8109 (width 31)    nibble 10 → LANE_OBJLIST_813f 0x813f (width 18)
//   nibble 5 → LANE_OBJLIST_8112 0x8112 (width 92)    nibble 11 → LANE_OBJLIST_8148 0x8148 (width 18)
//   nibble 6 → LANE_OBJLIST_811b 0x811b (width 44)    nibble 12 → LANE_OBJLIST_8151 0x8151 (width 18)
//   nibble 7 → LANE_OBJLIST_8124 0x8124 (width 47)    nibble 13 → LANE_OBJLIST_815a 0x815a (width 18)
const LANE_BY_NIBBLE = new Map([
  [3, [SPRITE_BLOCK2_BASE, 60]], [4, [LANE_OBJLIST_8109, 31]], [5, [LANE_OBJLIST_8112, 92]], [6, [LANE_OBJLIST_811B, 44]],
  [7, [LANE_OBJLIST_8124, 47]], [9, [LANE_OBJLIST_8136, 34]], [10, [LANE_OBJLIST_813F, 18]], [11, [LANE_OBJLIST_8148, 18]],
  [12, [LANE_OBJLIST_8151, 18]], [13, [LANE_OBJLIST_815A, 18]],
]);

export function dispatchFrogMoveAgainstLanes(m) {
  const { mem8 } = m;

  // ── Gate 1: demo / attract ────────────────────────────────────────────────────────────
  // FROG_STATE_DEMO_FLAG (0x83cd) is raised during the attract demo and the board-complete re-arm. The
  // scripted demo frog is not subject to lane collisions, so the resolver does nothing while it is set.
  if (mem8[FROG_STATE_DEMO_FLAG] !== 0) return;

  // ── Gate 2: move already resolved this frame ──────────────────────────────────────────
  // HOLD_FLAG (0x8004) is the "frog already hit / move already resolved" latch. Once any path (this frame
  // or a prior cluster) has raised it, no further lane scan runs — exactly one verdict per frame.
  if (mem8[HOLD_FLAG] !== 0) return;

  // ── Row dispatch ──────────────────────────────────────────────────────────────────────
  // FROG_Y (0x8047) is the frog's game-space row (0xE0 at the screen bottom rising to 0x40 at the top as
  // it climbs). Its LOW nibble sub-positions the frog between the lane rows: a value >= 9 means the frog
  // is between rows (no lane to scan here), so hand the whole decision to the upper half, whose +15 bias
  // owns those sub-rows.
  const frogRow = mem8[FROG_Y];
  if ((frogRow & 0x0f) >= 9) return resolveFrogMoveAgainstLanes(m);

  // The HIGH nibble names the lane. Six nibbles own no lane here and also delegate; the other ten each
  // pick a [lane-list base, band width] and run the band scan.
  const lane = LANE_BY_NIBBLE.get(frogRow >> 4);
  if (!lane) return resolveFrogMoveAgainstLanes(m);
  return scanLane(m, lane[0], lane[1]);
}

/**
 * scanLane — the band scan shared by every lane arm (part of ROM 0x11bf, grounding [seen]).
 *
 * Walks one lane object-list looking for a sprite object horizontally overlapping the frog, then turns
 * that hit/miss into a survive/die verdict whose meaning is INVERTED between the two bands. `laneBase` is
 * the object-list base cell and `width` its band width in pixels (both taken from LANE_BY_NIBBLE).
 */
function scanLane(m, laneBase, width) {
  const { mem8 } = m;

  // Road band = FROG_Y (0x8047) >= 0x80 (lower screen, cars); below that is the river (logs). The band
  // selects both the X-collision offset (below) and, at the loop's exits, which of hit/miss is fatal.
  const roadBand = mem8[FROG_Y] >= 128;

  // Build the horizontal window [bandLow, bandLow+width) in frog X-space. FROG_X (0x8044) is biased by
  // the ROM's per-band collision offset: +3 on the road, +12 on the river. When the window's top runs
  // past the 0xff byte edge it WRAPS, and the in-band test flips from AND to OR (see below).
  const bandLow = (mem8[FROG_X] + (roadBand ? 3 : 12)) & 0xff;
  const bandHighRaw = bandLow + width;
  const wrapped = bandHighRaw > 0xff;
  const bandHigh = bandHighRaw & 0xff;

  // Lane object-list layout is [count, x0, x1, …]: the leading count byte at laneBase is the object
  // count, and a stored 0 means "scan the full 256" (|| 256) — matching the Z80's 8-bit down-counter,
  // which wraps 0 → 256 iterations.
  let remaining = mem8[laneBase] || 256;
  let objPtr = laneBase;
  for (;;) {
    objPtr = objPtr + 1;
    const objX = mem8[objPtr];

    // In-band test: a normal window is objX inside [bandLow, bandHigh); a wrapped window is the
    // complement — objX at/after bandLow OR before the wrapped top.
    const inBand = wrapped ? objX >= bandLow || objX < bandHigh
                           : objX >= bandLow && objX < bandHigh;
    if (inBand) {
      // Object sits under the frog. RIVER: it's a log — let the frog ride (hand to the upper half, no
      // kill). ROAD: it's a car — fatal, go through the shared kill tail.
      if (!roadBand) return resolveFrogMoveAgainstLanes(m);
      return killFrogAtLane(m);
    }

    // Not this object — step the 8-bit counter and keep scanning until it wraps back to 0.
    remaining = (remaining - 1) & 0xff;
    if (remaining !== 0) continue;

    // Lane exhausted with no object under the frog. RIVER: open water — the frog drowns (kill tail).
    // ROAD: open road — safe, hand to the upper half.
    if (!roadBand) return killFrogAtLane(m);
    return resolveFrogMoveAgainstLanes(m);
  }
}
