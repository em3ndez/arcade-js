// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
import {
  ACTIVE_PLAYER,
  P1_SCORE_BCD,
  P2_SCORE_BCD,
  HIGH_SCORE_TABLE,
  HIGH_SCORE_INSERT_RANK,
  HIGH_SCORE_TIME_TABLE,
  PLAY_TIMER_BCD_P1,
  PLAY_TIMER_BCD_P2,
  PLAY_TIMER_GATE_P1,
  PLAY_TIMER_GATE_P2,
  PANEL_TILE_SOURCE,
} from "./names.js";
/**
 * loc_1ab2 — insert the finished player's score into the sorted ten-entry high-score table.
 *
 * The table holds ten 3-byte packed-BCD scores, most-significant byte last, ranked high to
 * low. The routine scans for the first entry the just-finished player's score (its buffer
 * chosen by the active-player select) ranks at or above, comparing MSB first. If it beats
 * none of the ten it returns unchanged. Otherwise it records the winning rank, opens a
 * 3-byte slot by shifting the tail of the table down one entry, and writes the score in.
 * Two parallel side tables ride along: a per-entry play-time pair (copied from the active
 * play-timer bank) is shifted and a gate marker seeded, and the display-tile side table is
 * shifted and the new entry's three cells cleared to the blank tile via the fill helper.
 *
 * LIVE-OUT: memory only — the table, both side tables, the rank cell and the gate marker.
 */

const ENTRIES = 10; // ranked slots in the table
const STRIDE = 3; // bytes per score entry
const TILE_BLANK = 0x10; // blank tile written into the display side table's new cells

/** MSB-first unsigned compare of two 3-byte entries: true when the record at `a` >= the one at `b`. */
function recordAtLeast(mem8, a, b) {
  if (mem8[a + 2] !== mem8[b + 2]) return mem8[a + 2] >= mem8[b + 2];
  if (mem8[a + 1] !== mem8[b + 1]) return mem8[a + 1] >= mem8[b + 1];
  return mem8[a] >= mem8[b];
}

/** Overlap-safe descending shift: dst, dst-1, ... each copied from the matching src cell. */
function shiftBlockDown(mem8, srcTop, dstTop, count) {
  for (let i = 0; i < count; i++) mem8[dstTop - i] = mem8[srcTop - i];
}

export function loc_1ab2(m) {
  const { mem8 } = m;
  const newScore = (mem8[ACTIVE_PLAYER] & 0x01) !== 0 ? P2_SCORE_BCD : P1_SCORE_BCD;

  // rank = the first entry the new score reaches or beats (MSB first)
  let rank = 0;
  let slot = HIGH_SCORE_TABLE;
  while (rank < ENTRIES && !recordAtLeast(mem8, newScore, slot)) {
    rank += 1;
    slot += STRIDE;
  }
  if (rank >= ENTRIES) return; // beat none of the ten

  mem8[HIGH_SCORE_INSERT_RANK] = rank + 1;
  const shift = STRIDE * (ENTRIES - rank); // bytes from the slot to the table's end

  // open the slot and write the 3-byte score
  shiftBlockDown(mem8, HIGH_SCORE_TABLE + 0x1d, HIGH_SCORE_TABLE + 0x20, shift);
  mem8[slot] = mem8[newScore];
  mem8[slot + 1] = mem8[newScore + 1];
  mem8[slot + 2] = mem8[newScore + 2];

  // play-time side table + gate marker, per active player
  const player1 = mem8[ACTIVE_PLAYER] !== 0;
  const timerBank = player1 ? PLAY_TIMER_BCD_P2 : PLAY_TIMER_BCD_P1;
  mem8[player1 ? PLAY_TIMER_GATE_P2 : PLAY_TIMER_GATE_P1] = 0x01;
  shiftBlockDown(mem8, HIGH_SCORE_TIME_TABLE - 3, HIGH_SCORE_TIME_TABLE, shift);
  const sideSlot = HIGH_SCORE_TIME_TABLE - shift;
  mem8[sideSlot] = mem8[timerBank + 2];
  mem8[sideSlot - 1] = mem8[timerBank + 1];

  // display-tile side table: shift down a slot, then blank the new entry's three cells
  shiftBlockDown(mem8, PANEL_TILE_SOURCE + 0x1c, PANEL_TILE_SOURCE + 0x1f, shift);
  loc_0010(m, PANEL_TILE_SOURCE + 0x1e - shift, TILE_BLANK, STRIDE);
}
