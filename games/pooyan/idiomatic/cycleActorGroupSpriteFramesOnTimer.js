// SPDX-License-Identifier: GPL-3.0-only
import { copyDisplayTilesIntoActorRecords } from "./copyDisplayTilesIntoActorRecords.js";
import {
  BLINK_PHASE,
  ANIM_PHASE_TOGGLE_892C,
  TILE_SRC_ROW_66BF,
  TILE_SRC_ROW_66C2,
} from "./names.js";
/**
 * cycleActorGroupSpriteFramesOnTimer — countdown-gated sprite-frame cycler for the hunter group.
 *
 * WHAT IT IS
 *   The animation clock for a group of three actor records. Each of Pooyan's on-screen actors owns
 *   one 0x18-byte record in the arena, and the byte at +0x0f in a record is the display byte the video
 *   hardware reads to draw that actor's shape. This routine does not paint every frame: it runs a
 *   small countdown, and only when the countdown drains to zero does it flip the group to its next
 *   animation frame -- so the hunters cycle their sprite shapes on a fixed cadence rather than every
 *   tick.
 *
 * ROLE IN THE MACHINE
 *   It is the tail of the hunter-group per-frame update advanceActorGroupRiseAndCycleTiles (0x6666):
 *   that driver first steps the three hunter actors upward, then calls in here to advance their
 *   animation frame. The group base handed in (IX) is HUNTER_TABLE_BASE (0x8c78); the three records
 *   painted are that record and its two lower banks (one record backward per step). The two candidate
 *   shapes are 3-tile source rows in ROM, TILE_SRC_ROW_66BF (0x66bf) and TILE_SRC_ROW_66C2 (0x66c2),
 *   chosen by the parity of a phase toggle so the group alternates between two frames.
 *
 * ROM: 0x66a1-0x66be.
 * Grounding: [seen].
 *
 * LIVE-OUT: none -- the sole caller issues this then returns, reading nothing back. IX is a live-in
 * that names which actor-record group to paint and is forwarded to the tile-run copier.
 */

const RELOAD = 0x08; //        BLINK_PHASE reload value: eight ticks between animation-frame flips
const RECORD_COUNT = 0x03; //  three actor records painted per flip (the hunter record + two lower banks)
const RECORD_STRIDE = -0x18; // one 0x18-byte actor record backward per step through the group
const STRIDE_LOW = 0xe8; //    low byte of the -0x18 stride word (0xffe8); doubles as the reset display-command low byte the copier reads on its board-teardown path

export function cycleActorGroupSpriteFramesOnTimer(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // Tick the frame-cadence countdown. BLINK_PHASE (0x892b) is the per-tick counter that spaces the
  // animation flips apart. Decrement it (with 8-bit wrap) and store it back; while it is still
  // non-zero the group keeps its current shape, so return at once and do no painting this tick.
  const remaining = (mem8[BLINK_PHASE] - 1) & 0xff;
  mem8[BLINK_PHASE] = remaining;
  if (remaining !== 0) return; // countdown still live -- hold the current frame

  // Countdown drained: it is time to advance to the next animation frame. Reload the counter to
  // RELOAD (0x08) so the next flip is eight ticks away.
  mem8[BLINK_PHASE] = RELOAD;

  // Advance the frame-select toggle. ANIM_PHASE_TOGGLE_892C (0x892c) increments (8-bit wrap) each
  // time the countdown fires; its bit 0 alternates 0/1 across successive flips and picks which of the
  // two shapes the group shows.
  const phase = (mem8[ANIM_PHASE_TOGGLE_892C] + 1) & 0xff;
  mem8[ANIM_PHASE_TOGGLE_892C] = phase;

  // Choose the source row by the toggle's bit 0: even -> TILE_SRC_ROW_66BF (ROM 0x66bf), odd ->
  // TILE_SRC_ROW_66C2 (ROM 0x66c2). Each is a 3-tile source row of display codes, one per record.
  const table = (phase & 0x01) === 0 ? TILE_SRC_ROW_66BF : TILE_SRC_ROW_66C2;

  // Stamp the chosen shape into the group. Starting at IX (the hunter group base), walk RECORD_COUNT
  // (3) records backward one record at a time (RECORD_STRIDE -0x18), copying one source tile into
  // each record's +0x0f display byte. STRIDE_LOW (0xe8) is the low byte of that stride word and is
  // also the reset display-command low byte the copier would use if it finds the board being torn
  // down and diverts into the board/HUD reset instead of finishing the paint.
  copyDisplayTilesIntoActorRecords(m, table, RECORD_COUNT, RECORD_STRIDE, ix, STRIDE_LOW);
}
