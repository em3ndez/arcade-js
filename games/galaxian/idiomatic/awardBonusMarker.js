// SPDX-License-Identifier: GPL-3.0-only
import { drawMarkerRow } from "./drawMarkerRow.js";
import { CURRENT_PLAYER, PLAYER1_BONUS_MARKER_AWARDED, loc_41c7, loc_421d } from "./names.js";

/**
 * awardBonusMarker — grant the once-per-player bonus marker when the active player first trips the
 * score threshold, then repaint the marker row.
 *
 * WHAT IT IS
 *   A gate-and-grant one-shot. It indexes a per-player guard-flag table by the active player, bails if
 *   this player already earned the marker, and otherwise flags the slot, cues a sound, bumps the marker
 *   counter, and redraws the on-screen marker row.
 *
 * ROLE IN THE MACHINE
 *   PLAYER1_BONUS_MARKER_AWARDED (0x40ad) is the base of a per-player one-shot flag table; adding
 *   CURRENT_PLAYER (0x400d, the active player index 0/1) selects this player's slot (player one at
 *   0x40ad, player two at 0x40ae). The guard makes the award fire at most once per player per game.
 *   On the grant it raises sound-envelope trigger loc_41c7 (0x41c7) to cue the award sound, increments
 *   the marker counter loc_421d (0x421d), and calls drawMarkerRow with the new count to repaint the
 *   5-slot marker row at MARKER_ROW_VRAM.
 *
 * ROM 0x229c.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: on the early return, nothing changes. On the grant: guard slot = 1, loc_41c7 = 1,
 * loc_421d incremented, and the drawMarkerRow result (marker row repainted) returned.
 */

export function awardBonusMarker(m) {
  const { mem8 } = m;

  // Select this player's guard-flag slot: base 0x40ad + the active player index (0/1).
  const flag = PLAYER1_BONUS_MARKER_AWARDED + mem8[CURRENT_PLAYER];
  // One-shot guard: if this player's slot is already flagged, the marker was awarded — do nothing.
  if ((mem8[flag] & 1) !== 0) return;

  // Grant: latch the guard so it can never fire again this game for this player.
  mem8[flag] = 1;
  // Cue the award sound by raising the sound-envelope trigger.
  mem8[loc_41c7] = 1;
  // Bump the marker counter that drives how many marker tiles the row shows.
  mem8[loc_421d]++;

  // Repaint the marker row with the new count.
  return drawMarkerRow(m, mem8[loc_421d]);
}
