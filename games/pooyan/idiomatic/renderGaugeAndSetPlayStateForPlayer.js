// SPDX-License-Identifier: GPL-3.0-only
import { renderPhaseGauge } from "./renderPhaseGauge.js";
import { ACTIVE_PLAYER, PLAY_STATE_INDEX } from "./names.js";
/**
 * renderGaugeAndSetPlayStateForPlayer — repaint the phase gauge, then hand the in-play
 * sub-state machine to the bank-save handler that belongs to whichever player is at the
 * controls.
 *
 * WHAT IT IS
 * ROM 0x1a85-0x1a95. Grounding: [seen]. This is the "phases still remain" exit of the
 * phase-gauge sub-state handler (advancePhaseGaugeCountdown, index 7 of the in-play
 * sub-state machine). A Pooyan stage is divided into a few "phases"; GAUGE_PHASE_COUNTER
 * (work RAM 0x8908) holds how many are left, and the gauge handler drains one per phase.
 * When that counter reaches zero the round ends down a different path (phase exhaustion);
 * while phases are still left the handler finishes right here — refresh the on-screen gauge
 * to match the drained counter, then step the play sub-state so the next frame parks the
 * player whose phase just completed.
 *
 * ROLE IN THE MACHINE
 * The play frame runs a sub-state machine whose index lives in PLAY_STATE_INDEX (0x880a);
 * its low five bits pick one of nineteen handlers from the jump table at ROM 0x15a8. A game
 * runs one or two players out of a single shared live round page at 0x8900, and ACTIVE_PLAYER
 * (0x880d) records whose turn is running (bit 0 clear -> player 1, set -> player 2). When a
 * player's phase finishes, that live page has to be block-copied down into that player's own
 * saved bank — player 1 into PLAYER0_STATE_BANK (0x8940), player 2 into PLAYER1_STATE_BANK
 * (0x8980) — so the other player's parked page can later be swapped back up. The dispatcher
 * table has two adjacent snapshot handlers for exactly this: index 0x0a saves the live page
 * into player 1's bank, index 0x0b saves it into player 2's. This routine chooses between
 * them by seating PLAY_STATE_INDEX at 0x0a for player 1 or 0x0b for player 2.
 *
 * LIVE-OUT: memory only — the repainted phase-gauge tiles (tilemap RAM from 0x863f upward)
 * and the in-play sub-state index PLAY_STATE_INDEX (0x880a), left holding 0x0a or 0x0b. No
 * register or flag survives for a caller.
 */
const PLAY_STATE_BASE = 0x0a; // sub-state 0x0a snapshots player 1's page; +1 (0x0b) snapshots player 2's

export function renderGaugeAndSetPlayStateForPlayer(m) {
  const { mem8 } = m;

  // Repaint the phase gauge so the five-cell HUD bar matches GAUGE_PHASE_COUNTER (0x8908)
  // after this phase's drain. The bar is drawn straight into tilemap RAM from the bottom
  // cell PHASE_GAUGE_BASE_TILE (0x863f) upward; a zero counter is the "leave it alone" case
  // and no tile is touched.
  renderPhaseGauge(m);

  // Seat the in-play sub-state index (0x880a) on the bank-save handler for the active player,
  // so next frame's sub-state dispatch (table at ROM 0x15a8, indexed by (0x880a)&0x1f) parks
  // the live round page into that player's saved bank. ACTIVE_PLAYER (0x880d) is zero for
  // player 1 and nonzero for player 2: index 0x0a snapshots the page into player 1's bank
  // (0x8940), 0x0b into player 2's bank (0x8980).
  mem8[PLAY_STATE_INDEX] = mem8[ACTIVE_PLAYER] !== 0 ? PLAY_STATE_BASE + 1 : PLAY_STATE_BASE;
}
