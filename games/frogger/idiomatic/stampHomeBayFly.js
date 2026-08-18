// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeBayFly  —  ROM 0x23fa  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   One frame of the empty-bay FLY animation. Frogger's five home bays sit across the top row; while a
 *   bay is still empty it is not left blank — a bonus creature drifts through it. Two creatures share the
 *   bays: a crocodile (three poses) and a fly (a single stamp, later erased). This routine draws the fly:
 *   it stamps the 2x2 fly-bonus tile quad (44,45 over 46,47) into the bay that is currently showing the
 *   creature.
 *
 * WHERE IT SITS
 *   Part of the empty-bay creature cycle driven each in-play frame from the collision/scoring
 *   orchestrator. A rotating cursor (HOME_BAY_SLOT_CURSOR 0x8123, advanced once per in-play frame by
 *   loc_23eb as an increment-and-wrap mod 6) names which bay is animating: values 1..5 name a bay, 0 is a
 *   rest phase. A free-running phase counter (SCROLL_TIMER_COUNTER 0x8122) times the animation, and the
 *   low bit of LIVES_COUNT (0x83b7) selects the creature — crocodile when clear, fly when set. On the fly
 *   path only two stampers fire: THIS routine at the counter's wrap to 0, and the shared eraser
 *   stampHomeBaySlot at phase 0x70, which re-stamps the empty home tile back over the fly.
 *
 *   Unlike the multi-pose crocodile (whose later pose reads a mirrored cursor snapshot so both poses hit
 *   the same bay), the fly is a single stamp, so it reads the LIVE cursor HOME_BAY_SLOT_CURSOR directly
 *   and copies it into PENDING_HOME_BAY_SLOT (0x8121) so the shared eraser knows which bay to blank next.
 *
 * LIVE-OUT
 *   Memory only. It publishes the pending-slot selector and, on an empty bay, stamps four VRAM tile
 *   cells. It returns nothing and leaves no register the caller reads.
 */
import {
  HOME_BAY_SLOT_CURSOR, PENDING_HOME_BAY_SLOT, ACTIVE_PLAYER,
  HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM,
  HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY3_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_PRIMARY,
  HOME_BAY1_OCCUPANCY_ALT, HOME_BAY2_OCCUPANCY_ALT, HOME_BAY3_OCCUPANCY_ALT, HOME_BAY4_OCCUPANCY_ALT, HOME_BAY5_OCCUPANCY_ALT,
} from "./names.js";

// Per-bay lookup tables, indexed 0..4 by (slot - 1). Each home bay has a fixed VRAM base for its 2x2 tile
// block and a pair of one-byte occupancy gates — one per player bank. Note the VRAM bases run DOWNWARD in
// address as the on-screen bay index runs left-to-right (0xab64 for bay 1 .. 0xa864 for bay 5); the arrays
// keep them in on-screen order regardless.
const HOME_BAY = [HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM];
const FLAGS_PRIMARY = [HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY3_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_PRIMARY];
const FLAGS_ALT = [HOME_BAY1_OCCUPANCY_ALT, HOME_BAY2_OCCUPANCY_ALT, HOME_BAY3_OCCUPANCY_ALT, HOME_BAY4_OCCUPANCY_ALT, HOME_BAY5_OCCUPANCY_ALT];

// Valid slot values name a home bay 1..5; 0 (and out-of-range) is the animation's rest phase — no bay.
const FIRST_SLOT = 1;
const LAST_SLOT = 5;

// One screen row is 32 tile cells, so +32 from a top cell lands directly below it in the next row.
const ROW_STRIDE = 32;

// The fly-bonus creature is a 2x2 quad of tiles 44..47 (0x2c..0x2f): 44,45 on top, 46,47 below.
const TILE_TL = 44; // top-left
const TILE_TR = 45; // top-right
const TILE_BL = 46; // bottom-left
const TILE_BR = 47; // bottom-right

export function stampHomeBayFly(m) {
  const { mem8 } = m;

  // ── Read the live cursor and publish it as the pending selector ───────────────────────
  // The fly path stamps once (at the phase counter's wrap), so no cursor snapshot is needed — read the
  // live slot cursor HOME_BAY_SLOT_CURSOR (0x8123) directly. Echo it into PENDING_HOME_BAY_SLOT (0x8121)
  // so the shared eraser stampHomeBaySlot, which dispatches on that cell at phase 0x70, later blanks the
  // correct bay. This publish happens unconditionally, even on a rest phase or a filled bay, so the
  // pending selector always names the bay the creature was in.
  const slot = mem8[HOME_BAY_SLOT_CURSOR];
  mem8[PENDING_HOME_BAY_SLOT] = slot;

  // ── Gate 1: is the cursor pointing at a real bay? ─────────────────────────────────────
  // Only 1..5 name a bay; 0 is the animation's rest phase and anything else is out of range. Bail without
  // drawing. `i` is the 0-based index into the per-bay lookup tables above.
  if (slot < FIRST_SLOT || slot > LAST_SLOT) return;
  const i = slot - 1;

  // ── Gate 2: is this bay still empty? ──────────────────────────────────────────────────
  // Each bay carries an occupancy gate per player; ACTIVE_PLAYER (0x83fd) picks the bank — primary when
  // it holds 1, the alternate bank otherwise. A nonzero gate means the frog already won that bay, so the
  // empty-bay fly must NOT be stamped over the frog-in-home graphic. Bail if it is filled.
  const occupancyGate = mem8[ACTIVE_PLAYER] === 1 ? FLAGS_PRIMARY[i] : FLAGS_ALT[i];
  if (mem8[occupancyGate] !== 0) return;

  // ── Stamp the 2x2 fly quad into the bay's VRAM ────────────────────────────────────────
  // vram is this bay's fixed VRAM base (top-left cell). Lay the top row at +0/+1, then step down one
  // screen row (+ROW_STRIDE) and lay the bottom row. This 2x2 block is the fly-bonus creature the player
  // sees drifting through the still-empty bay.
  let vram = HOME_BAY[i];
  mem8[vram] = TILE_TL;
  mem8[vram + 1] = TILE_TR;
  vram += ROW_STRIDE;
  mem8[vram] = TILE_BL;
  mem8[vram + 1] = TILE_BR;
}
