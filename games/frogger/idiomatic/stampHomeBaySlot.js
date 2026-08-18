// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeBaySlot  —  ROM 0x25ce  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The "shared eraser" of Frogger's empty-bay animation. While a home bay sits empty it is not blank —
 *   a creature (the bonus fly, or the surfacing crocodile/gator) is animated cycling through the empty
 *   bays one at a time. This routine re-stamps the plain empty-home tile back over whichever bay a
 *   creature is currently sitting in, wiping the creature and restoring the bare bay graphic. Both
 *   creature paths end their cycle here: the fly path calls it at frame-counter 0x70, the gator path at
 *   0xb0 (see mechanisms.md "The slot cursor and the empty-bay animation").
 *
 * WHERE IT SITS
 *   Driven from the per-frame collision/scoring orchestrator as part of the empty-bay animation, keyed
 *   off PENDING_HOME_BAY_SLOT (0x8121) — the selector 1..5 that the creature stampers publish to name
 *   the bay currently showing a creature. It is a leaf: it reads work RAM, writes VRAM + RAM, and takes
 *   no register live-in. On the great majority of frames the selector is 0 (the cursor's rest phase) or
 *   the bay is already won, so most calls fall straight through the first two `return`s untouched.
 *
 * LIVE-OUT
 *   Memory only. It stamps four VRAM tile cells and may clear two selector cells. It returns nothing and
 *   leaves no register the caller reads.
 */
import {
  ACTIVE_PLAYER, PENDING_HOME_BAY_SLOT, HOME_BAY_SLOT_CURSOR_MIRROR, HOLD_FLAG,
  HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY3_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_PRIMARY,
  HOME_BAY1_OCCUPANCY_ALT, HOME_BAY2_OCCUPANCY_ALT, HOME_BAY3_OCCUPANCY_ALT, HOME_BAY4_OCCUPANCY_ALT, HOME_BAY5_OCCUPANCY_ALT,
  HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM,
} from "./names.js";

// ACTIVE_PLAYER (0x83fd) holds 1 for player 1; any other value means player 2. It selects which bank of
// occupancy gates this stamp consults (primary for player 1, alternate otherwise).
const PLAYER_ONE = 1;

// Tile 0x10 (16) is the plain empty-home graphic — the bare bay a frog can still land in. It is what we
// paint to erase the creature, and is deliberately distinct from the frog-in-home tiles (0x6c..0x6f)
// that mark a *won* bay.
const EMPTY_HOME_TILE = 16;

// One screen row is 32 tile cells wide, so +32 from a cell steps straight down into the row below.
const ROW_STRIDE = 32;

// Dispatch table keyed by the selector value 1..5, one row per home bay. Each row is
//   [ VRAM base of the bay's 2x2 tile block,
//     primary-bank occupancy gate (player 1),
//     alternate-bank occupancy gate (player 2) ].
// The VRAM bases DESCEND in address as the bay index rises (bay 1 is highest). The gate pair mirrors the
// two parallel banks in mechanisms.md "The occupancy gates and the per-player home tally": a nonzero
// gate means that bay is already won for that player.
const SLOTS = {
  1: [HOME_SLOT1_VRAM, HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY1_OCCUPANCY_ALT],
  2: [HOME_SLOT2_VRAM, HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_ALT],
  3: [HOME_SLOT3_VRAM, HOME_BAY3_OCCUPANCY_PRIMARY, HOME_BAY3_OCCUPANCY_ALT],
  4: [HOME_SLOT4_VRAM, HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_ALT],
  5: [HOME_SLOT5_VRAM, HOME_BAY5_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_ALT],
};

export function stampHomeBaySlot(m) {
  const { mem8 } = m;

  // ── Which bay? ───────────────────────────────────────────────────────────────────────
  // PENDING_HOME_BAY_SLOT (0x8121) names the bay currently showing a creature: 1..5 for a real bay, 0
  // for the cursor's rest phase (and only 0..5 ever occur, since the cursor wraps mod 6). Look the
  // selector up in the dispatch table; anything outside 1..5 has no row, so there is nothing to erase
  // and we return untouched — the ROM's out-of-range fall-through.
  const slot = SLOTS[mem8[PENDING_HOME_BAY_SLOT]];
  if (!slot) return;

  // ── Skip a bay that is already won ────────────────────────────────────────────────────
  // Pick this bay's occupancy gate for the active player: the primary-bank gate when ACTIVE_PLAYER
  // (0x83fd) == 1, the alternate-bank gate otherwise. A nonzero gate means the bay already holds a
  // frog-in-home, so the empty-bay animation must NOT paint over it — every bay stamper honours this
  // guard so a filled bay is never clobbered by a second landing or by the creature cycle.
  const [base, primaryGate, altGate] = slot;
  const occupancyGate = mem8[ACTIVE_PLAYER] === PLAYER_ONE ? primaryGate : altGate;
  if (mem8[occupancyGate] !== 0) return;

  // ── Stamp the empty-home tile over the creature ───────────────────────────────────────
  // Paint tile 0x10 into the bay's 2x2 VRAM block at `base` (HOME_SLOTn_VRAM): top row at base/base+1,
  // bottom row one screen row (+ROW_STRIDE) below at base+32/base+33. This is the erase that clears the
  // fly (fly path, frame 0x70) or the surfaced gator (gator path, frame 0xb0) back to a bare bay.
  mem8[base] = EMPTY_HOME_TILE;
  mem8[base + 1] = EMPTY_HOME_TILE;
  mem8[base + ROW_STRIDE] = EMPTY_HOME_TILE;
  mem8[base + ROW_STRIDE + 1] = EMPTY_HOME_TILE;

  // ── Release or defer the selector pair ────────────────────────────────────────────────
  // With the erase done the creature cycle for this bay is finished, so clear the selector pair back to
  // 0: PENDING_HOME_BAY_SLOT (0x8121) and its mirror HOME_BAY_SLOT_CURSOR_MIRROR (0x8120). But if
  // HOLD_FLAG (0x8004) is set — the game is paused on a hold/hit — leave the selector PENDING so the
  // erase is retried on a later frame rather than being consumed now. This defers the clear without
  // undoing the tiles just stamped.
  if (mem8[HOLD_FLAG] !== 0) return;
  mem8[PENDING_HOME_BAY_SLOT] = 0;
  mem8[HOME_BAY_SLOT_CURSOR_MIRROR] = 0;
}
