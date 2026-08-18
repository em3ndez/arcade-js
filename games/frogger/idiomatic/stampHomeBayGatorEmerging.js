// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeBayGatorEmerging  —  ROM 0x2496  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   One frame of the "empty home bay" creature animation — the crocodile just breaking the surface.
 *   Frogger's board finishes at five home bays across the top row; while a bay sits empty (not yet won)
 *   the machine animates a creature drifting through it, one bay at a time. On the crocodile path this
 *   routine draws the FIRST pose of that animation: the gator's snout emerging at the bottom of the bay.
 *   A later frame promotes it to the full gator (stampHomeBayGatorFull), and later still the shared
 *   eraser (stampHomeBaySlot) wipes it back to the empty-home tile.
 *
 * WHERE IT SITS
 *   Called from the collision/scoring orchestrator on the crocodile frame — specifically at the moment
 *   the free-running home-bay frame counter wraps to 0. The creature to draw is chosen by the low bit of
 *   LIVES_COUNT (0x83b7): bit clear picks the crocodile path (this routine + stampHomeBayGatorFull), bit
 *   set picks the fly path (stampHomeBayFly). Which bay it acts on is chosen by the rotating slot cursor
 *   HOME_BAY_SLOT_CURSOR (0x8123), advanced once per in-play frame by loc_23eb.
 *
 * LIVE-OUT
 *   Memory only. It publishes the slot cursor to the mirror cell and, when the target bay is still empty,
 *   stamps four VRAM tile cells. It returns nothing and leaves no register the caller reads.
 */
import {
  HOME_BAY_SLOT_CURSOR, HOME_BAY_SLOT_CURSOR_MIRROR, ACTIVE_PLAYER,
  HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM,
  HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY3_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_PRIMARY,
  HOME_BAY1_OCCUPANCY_ALT, HOME_BAY2_OCCUPANCY_ALT, HOME_BAY3_OCCUPANCY_ALT, HOME_BAY4_OCCUPANCY_ALT, HOME_BAY5_OCCUPANCY_ALT,
} from "./names.js";

// The five home-bay VRAM bases, indexed by (slot - 1). Note the addresses DESCEND as the slot number
// rises: bay 1 is at the highest address (HOME_SLOT1_VRAM 0xab64) and bay 5 at the lowest (0xa864),
// because bay 1 is the leftmost column and the tilemap runs right-to-left. Each base is the top-left
// cell of that bay's 2x2 tile quad.
const HOME_BAY = [HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM];

// The two parallel banks of five occupancy gates, one gate per bay, both indexed by (slot - 1). A gate
// reads non-zero once its bay is won and zero while empty. ACTIVE_PLAYER (0x83fd) selects the bank so
// each player keeps an independent set of five bay flags: the primary bank (contiguous 0x825e..0x8262)
// is read when it holds 1, the alternate bank (contiguous 0x8263..0x8267) otherwise.
const FLAGS_PRIMARY = [HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY3_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_PRIMARY];
const FLAGS_ALT = [HOME_BAY1_OCCUPANCY_ALT, HOME_BAY2_OCCUPANCY_ALT, HOME_BAY3_OCCUPANCY_ALT, HOME_BAY4_OCCUPANCY_ALT, HOME_BAY5_OCCUPANCY_ALT];

// Cursor values 1..5 name a bay (a 1-based index into the five bays); value 0 is a rest phase where
// nothing is stamped, so the cursor is only actionable inside this inclusive range.
const FIRST_SLOT = 1;
const LAST_SLOT = 5;

// One screen row is 32 tile cells wide, so adding 32 to a tile address steps straight down one row —
// this is how the bottom half of the 2x2 quad is reached from its top-left cell.
const ROW_STRIDE = 32;

// The 2x2 tile quad of the emerging gator, ROM layout "16/16 over 208/209". The top row is tile 16
// (0x10, the plain empty-home tile) in both cells because at this pose only the snout has surfaced; the
// gator graphic itself is the bottom row, tiles 208/209 (0xd0/0xd1) breaking the waterline.
const TILE_TL = 16;   // top-left  — empty-home tile (nothing above the waterline yet)
const TILE_TR = 16;   // top-right — empty-home tile
const TILE_BL = 208;  // bottom-left  — emerging gator, left half
const TILE_BR = 209;  // bottom-right — emerging gator, right half

export function stampHomeBayGatorEmerging(m) {
  const { mem8 } = m;

  // ── Publish which bay is being animated ───────────────────────────────────────────────
  // Read the rotating slot cursor HOME_BAY_SLOT_CURSOR (0x8123) and copy it into the mirror cell
  // HOME_BAY_SLOT_CURSOR_MIRROR (0x8120). This mirror is the hand-off between the crocodile stampers:
  // stampHomeBayGatorFull reads it (and republishes it to PENDING_HOME_BAY_SLOT) so the full-gator pose
  // and the shared eraser both act on the very bay this routine drew — even after the cursor has since
  // advanced. The publish happens every frame, before the range gate below, so the mirror always tracks.
  const slot = mem8[HOME_BAY_SLOT_CURSOR];
  mem8[HOME_BAY_SLOT_CURSOR_MIRROR] = slot;

  // ── Rest-phase gate ───────────────────────────────────────────────────────────────────
  // Only cursor values 1..5 point at a real bay; value 0 (and anything out of range) is the rest phase
  // in the mod-6 cycle, where no creature is drawn. Bail out with nothing stamped.
  if (slot < FIRST_SLOT || slot > LAST_SLOT) return;
  const i = slot - 1;

  // ── Skip a bay that is already won ────────────────────────────────────────────────────
  // Look up this bay's occupancy gate in the bank chosen by ACTIVE_PLAYER (0x83fd): the primary bank
  // when it holds 1, otherwise the alternate bank. If the gate reads non-zero the bay is already filled
  // (a frog is home there), so the empty-bay animation must not paint over it — leave it untouched.
  const flag = mem8[ACTIVE_PLAYER] === 1 ? FLAGS_PRIMARY[i] : FLAGS_ALT[i];
  if (mem8[flag] !== 0) return;

  // ── Stamp the emerging-gator quad into the bay ────────────────────────────────────────
  // Draw the 2x2 tile quad at this bay's VRAM base: top row at base+0 / base+1, bottom row one screen
  // row (+32) below at base+ROW_STRIDE / base+ROW_STRIDE+1. The top cells hold the empty-home tile and
  // the bottom cells hold the surfacing gator, so the player sees just a snout appear at the waterline.
  const base = HOME_BAY[i];
  mem8[base] = TILE_TL;
  mem8[base + 1] = TILE_TR;
  mem8[base + ROW_STRIDE] = TILE_BL;
  mem8[base + ROW_STRIDE + 1] = TILE_BR;
}
