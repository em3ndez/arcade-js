// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fillByteRun } from "./fillByteRun.js";
import { ascendEnemyActorAndLinkedSlotOnTimer } from "./ascendEnemyActorAndLinkedSlotOnTimer.js";
import {
  HUD_INTEGRITY_STRIP_A,
  ROUND_IN_PROGRESS,
  PHASE_TIMER,
  PLAY_STATE_INDEX,
  FRAME_TIMER_BLOCK_BASE,
  ACTOR_TABLE,
  PLAYFIELD_PAINT_START,
} from "./names.js";
/**
 * reinitRoundArenaAndPlayfieldIfImageIntact — screen re-init gated by a colour-map integrity checksum.
 *
 * Sums ten colour-map cells one row apart into an 8-bit accumulator; if the sum is not the clean
 * sentinel the routine hands off to the per-object frame updater and returns. On a matching sum it
 * arms a fresh screen: raises the round-in-progress flag and seeds the phase timer and play
 * sub-state, clears the per-frame timer block, zeroes the whole actor/object arena, and paints the
 * playfield with a square of the blank tile, one row per pass.
 *
 * LIVE-OUT: memory only — reached by tail transfer from the integrity guards; the exit registers
 * are init scratch and no caller consumes them.
 */

const CKSUM_COUNT = 0x0a; //    colour-map cells summed
const ROW_STRIDE = 0x20; //     one tilemap row (the checksum walks up, the paint walks down)
const CKSUM_EXPECTED = 0x5a; // the clean-image sum sentinel
const ARMED = 0x01; //          flag/seed value written into the three state cells
const TIMER_BLOCK_LEN = 0x09; // per-frame timer cells cleared
const FILL_ZERO = 0x00;
const ARENA_WIPE_LEN = 0x241; // actor/object arena bytes cleared
const PAINT_TILE = 0x10; //     blank tile stamped across the playfield
const PAINT_SPAN = 0x1d; //     tiles per row and rows painted
const ROW_GAP = ROW_STRIDE - PAINT_SPAN; // step from a row's last tile to the next row's first

export function reinitRoundArenaAndPlayfieldIfImageIntact(m, rec = m.regs.ix) {
  const { mem8 } = m;

  let sum = 0;
  let probe = HUD_INTEGRITY_STRIP_A;
  for (let i = 0; i < CKSUM_COUNT; i++) {
    sum = (sum + mem8[probe]) & 0xff;
    probe = u16(probe - ROW_STRIDE);
  }
  if (sum !== CKSUM_EXPECTED) {
    ascendEnemyActorAndLinkedSlotOnTimer(m, rec); // rec = this record, threaded from the enemy-scan loop
    return;
  }

  mem8[ROUND_IN_PROGRESS] = ARMED;
  mem8[PHASE_TIMER] = ARMED;
  mem8[PLAY_STATE_INDEX] = ARMED;

  fillByteRun(m, FRAME_TIMER_BLOCK_BASE, FILL_ZERO, TIMER_BLOCK_LEN);
  for (let i = 0; i < ARENA_WIPE_LEN; i++) mem8[ACTOR_TABLE + i] = FILL_ZERO;

  let cursor = PLAYFIELD_PAINT_START;
  for (let row = 0; row < PAINT_SPAN; row++) {
    const advanced = fillByteRun(m, cursor, PAINT_TILE, PAINT_SPAN);
    cursor = u16(advanced + ROW_GAP);
  }
}
