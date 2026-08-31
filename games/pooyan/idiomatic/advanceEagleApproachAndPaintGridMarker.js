// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  WAVE_HOLD_TIMER,
  ENEMY_TARGET_REC0,
  loc_8a99,
  PLAYER_AIM_FLAGS,
  LATCHED_ENEMY_X,
  PLAYER_Y,
  WAVE_RECORDS_ARRIVED,
  EAGLE_FINISH_FLAG,
  EAGLE_GRID_STEP_TICK,
  EAGLE_GRID_VRAM_BASE,
} from "./names.js";
import { armEagleFinishAtGridEdge } from "./armEagleFinishAtGridEdge.js";
import { advanceEaglePhaseAndClearAim } from "./advanceEaglePhaseAndClearAim.js";

/**
 * advanceEagleApproachAndPaintGridMarker — the eagle bonus wave's approach state machine.
 *
 * WHAT IT IS
 *   ROM 0x71ce-0x7286. Grounding: [seen]. Runs once per frame during the eagle bonus wave's
 *   approach phase, overlaid on the per-frame walk of the eagle records. It does two jobs at
 *   once: it drives the player's on-screen aim indicator, and it paints the eagle's advancing
 *   "grid" of marker tiles — the trail of cells the eagle fills in as it sweeps across.
 *
 * ROLE IN THE MACHINE
 *   The bonus stage flies an eagle over a lattice of grid cells. As the eagle's approach
 *   coordinate advances, this routine (a) tells the aim indicator whether the player's shot is
 *   lined up — on-target, or below — via the indicator bits in PLAYER_AIM_FLAGS (0x8a87), and
 *   (b) walks a cursor through the video-RAM grid region based at EAGLE_GRID_VRAM_BASE (0x87e0),
 *   stamping one marker tile plus its colour attribute per step so the eagle's trail fills in
 *   cell by cell. The grid-edge test and the end-of-phase cleanup are handed to two helpers
 *   (armEagleFinishAtGridEdge and advanceEaglePhaseAndClearAim).
 *
 * SHAPE (once the hold gate WAVE_HOLD_TIMER at 0x8f36 has drained to zero)
 *   With no eagle target present it just refreshes the aim flags from the approach coordinate.
 *   Otherwise it compares the eagle's approach coordinate — read from PLAYER_Y (0x8a84), which
 *   in this phase carries the eagle's advancing X rather than the player's Y — to two thresholds:
 *     - past the far threshold EAGLE_LATCH_X (0x60)  -> refresh aim, latching the enemy X once;
 *     - exactly at the near threshold EAGLE_APPROACH_X (0x59) -> step the records-arrived
 *       sub-phase, whose final state paints the next grid marker every eighth frame;
 *     - short of the near threshold -> force the "below" aim indicator.
 *
 * LIVE-OUT
 *   Memory only. Across its exits it can leave: the aim-indicator bits in PLAYER_AIM_FLAGS
 *   (0x8a87), the latched enemy screen-X in LATCHED_ENEMY_X (0x8f5b), the records-arrived
 *   sub-phase in WAVE_RECORDS_ARRIVED (0x8f39), the eighth-frame tick in EAGLE_GRID_STEP_TICK
 *   (0x8f3b), and a marker tile (0x2c) + its colour attribute stamped into the grid region at
 *   EAGLE_GRID_VRAM_BASE (0x87e0). It returns no value; the sole caller reloads its own scratch,
 *   so nothing left in registers is part of the contract.
 */

// The eagle's grid position and column both live in the active eagle target record, ENEMY_TARGET_REC0
// (0x8c90). +0x04 is the record's position/row source and +0x06 its column source; the grid-marker
// step below derives the video-RAM cursor and the colour attribute from these two fields.
const EAGLE_GRID_POS = ENEMY_TARGET_REC0 + 0x04; // 0x8c94: eagle position source (row axis of the cell)
const EAGLE_GRID_COL = ENEMY_TARGET_REC0 + 0x06; // 0x8c96: eagle column source (drives the cursor's row count + colour)

// The two approach-X thresholds the eagle coordinate (read from PLAYER_Y, 0x8a84) is tested against.
const EAGLE_APPROACH_X = 0x59; // near threshold: sitting exactly here steps the records-arrived sub-phase
const EAGLE_LATCH_X = 0x60;    // far threshold: reaching it latches the enemy X into LATCHED_ENEMY_X

// Geometry of the tilemap grid region the marker walks.
const ROW_STRIDE = 0x20;       // one tilemap row is 0x20 cells; stepping up a row subtracts this
const VRAM_TO_COLOUR = 0x400;  // a tile cell and its colour/attribute cell are 0x400 apart (subtract to reach colour)
const GRID_MARKER_TILE = 0x2c; // the tile code stamped into the grid cell the eagle has reached
const GRID_STEP_MASK = 0x07;   // low 3 bits of the step tick: advance the marker only on an eighth-frame boundary

// Aim-indicator bits packed into PLAYER_AIM_FLAGS (0x8a87) alongside the joystick input in the low bits.
const AIM_ON_TARGET = 0x04;  // bit 2: the shot is lined up on the eagle
const AIM_BELOW = 0x08;      // bit 3: the shot sits below the eagle
const AIM_ARMED = 0x10;      // bit 4: the approach is armed (grid-step sub-phase reached)
const CLEAR_ON_TARGET = 0xfb; // ~AIM_ON_TARGET: mask that clears the on-target bit
const CLEAR_BELOW = 0xf7;     // ~AIM_BELOW: mask that clears the below bit
const CLEAR_AIM = 0xf3;       // ~(AIM_ON_TARGET | AIM_BELOW): mask that clears both indicator bits at once

export function advanceEagleApproachAndPaintGridMarker(m) {
  const { mem8 } = m;

  // HOLD GATE (ROM 0x71ce). WAVE_HOLD_TIMER (0x8f36) is the inter-wave hold countdown. While it is
  // still running the whole approach machine is suppressed: tick it down one and return, so the
  // eagle does not begin its approach until the hold has fully drained.
  const hold = mem8[WAVE_HOLD_TIMER];
  if (hold !== 0) {
    mem8[WAVE_HOLD_TIMER] = hold - 1;
    return;
  }

  // TARGET-PRESENT CHECK (ROM 0x71d7). Combine the presence byte of the eagle target record
  // ENEMY_TARGET_REC0 (0x8c90) with the companion cell at 0x8a99: if both are zero there is no live
  // eagle to track, so only the aim indicator is refreshed from the coordinate and the machine exits.
  // When a target is present we fall through to the threshold branch, which can still reuse that same
  // aim update.
  if ((mem8[ENEMY_TARGET_REC0] | mem8[loc_8a99]) === 0) {
    aimFromEagleX(m);
    return;
  }

  // THRESHOLD BRANCH (ROM 0x71fd). PLAYER_Y (0x8a84) holds the eagle's advancing approach coordinate
  // in this phase. Steer on where it sits relative to the near threshold EAGLE_APPROACH_X (0x59):
  const eagleX = mem8[PLAYER_Y];
  if (eagleX === EAGLE_APPROACH_X) {
    // Exactly at the near threshold: advance the records-arrived sub-phase (which, at its end, paints
    // the grid marker).
    advanceApproachSubPhase(m);
    return;
  }
  if (eagleX > EAGLE_APPROACH_X) {
    // Beyond the near threshold: the eagle is still approaching, so refresh the aim indicator (and
    // latch the enemy X once it passes the far threshold).
    aimFromEagleX(m);
    return;
  }
  // Short of the near threshold (ROM 0x7206): the eagle is not yet on target, so clear the on-target
  // bit and raise the "below" bit in PLAYER_AIM_FLAGS (0x8a87).
  mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] & CLEAR_ON_TARGET) | AIM_BELOW;
}

/**
 * aimFromEagleX (ROM 0x71e3) — refresh the aim indicator from the eagle's approach coordinate.
 *
 * The latch LATCHED_ENEMY_X (0x8f5b) records the eagle's screen-X the first time it crosses the far
 * threshold. Once that latch is set the shot is considered lined up, so raise the on-target bit and
 * drop the below bit. Until it is set, the eagle is still short of the firing line: show "below", and
 * capture the X into the latch the moment the coordinate reaches EAGLE_LATCH_X (0x60).
 */
function aimFromEagleX(m) {
  const { mem8 } = m;
  // Already latched (ROM 0x71e7): the eagle has reached the firing line — mark on-target, clear below.
  if (mem8[LATCHED_ENEMY_X] !== 0) {
    mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_ON_TARGET) & CLEAR_BELOW;
    return;
  }
  // Not yet latched (ROM 0x71e9): once the eagle's approach X (PLAYER_Y, 0x8a84) reaches the far
  // threshold, capture it into LATCHED_ENEMY_X (0x8f5b) so subsequent frames read on-target.
  const eagleX = mem8[PLAYER_Y];
  if (eagleX >= EAGLE_LATCH_X) mem8[LATCHED_ENEMY_X] = eagleX;
  // Until the latch takes, keep the indicator at "below": clear on-target, raise below.
  mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] & CLEAR_ON_TARGET) | AIM_BELOW;
}

/**
 * advanceApproachSubPhase (ROM 0x720b) — walk the records-arrived sub-phase while the eagle sits
 * exactly on the near threshold.
 *
 * WAVE_RECORDS_ARRIVED (0x8f39) is a small 0/1/2 progression that ratchets the approach forward each
 * time the eagle pauses at the near threshold:
 *   0 -> 1 : first touch — clear both aim-indicator bits (nothing to show yet);
 *   1 -> 2 : arm the approach — set only the armed bit in PLAYER_AIM_FLAGS;
 *   2      : armed and holding — begin/continue the grid-marker painting.
 */
function advanceApproachSubPhase(m) {
  const { mem8 } = m;
  const arrived = mem8[WAVE_RECORDS_ARRIVED];
  // First touch (ROM 0x720f): step 0 -> 1 and clear both aim-indicator bits.
  if (arrived === 0) {
    mem8[WAVE_RECORDS_ARRIVED] = 1;
    mem8[PLAYER_AIM_FLAGS] = mem8[PLAYER_AIM_FLAGS] & CLEAR_AIM;
    return;
  }
  // Not yet armed (ROM 0x721b): step (anything but 2) -> 2 and set the armed bit only.
  if (arrived !== 2) {
    mem8[WAVE_RECORDS_ARRIVED] = 2;
    mem8[PLAYER_AIM_FLAGS] = AIM_ARMED;
    return;
  }
  // Armed (ROM 0x722a): drive the grid-marker step.
  stepGridMarker(m);
}

/**
 * stepGridMarker (ROM 0x722a) — the armed sub-phase: once per eighth frame, stamp the next grid
 * marker tile and its colour attribute into the grid region; otherwise just run the grid-edge guard.
 *
 * The eagle's trail is a run of marker tiles across the grid region based at EAGLE_GRID_VRAM_BASE
 * (0x87e0). This picks the cell from the eagle's record fields, writes GRID_MARKER_TILE (0x2c) there,
 * and sets the matching colour/attribute cell 0x400 below it. The grid-edge guard and the phase-reset
 * epilogue are delegated to the helpers.
 */
function stepGridMarker(m) {
  const { mem8 } = m;

  // FINISH SHORT-CIRCUIT (ROM 0x722f). If the finish latch EAGLE_FINISH_FLAG (0x8f3e) is already set
  // the approach is over — hand straight to the phase-reset epilogue and do no more painting.
  if (mem8[EAGLE_FINISH_FLAG] !== 0) {
    advanceEaglePhaseAndClearAim(m);
    return;
  }

  // EIGHTH-FRAME GATE (ROM 0x7234). Bump the step tick EAGLE_GRID_STEP_TICK (0x8f3b) every frame; the
  // marker only advances when the low 3 bits are zero (one cell per eight frames). On the seven
  // in-between frames just run the grid-edge guard and return.
  mem8[EAGLE_GRID_STEP_TICK] = mem8[EAGLE_GRID_STEP_TICK] + 1;
  if ((mem8[EAGLE_GRID_STEP_TICK] & GRID_STEP_MASK) !== 0) {
    armEagleFinishAtGridEdge(m); // not an eighth-frame boundary: just run the grid-edge guard
    return;
  }

  // CURSOR ROW (ROM 0x723b). Turn the eagle column source EAGLE_GRID_COL (0x8c96) into a cell count
  // (>>3, +1) and step the video-RAM cursor that many rows up from EAGLE_GRID_VRAM_BASE (0x87e0);
  // each row up subtracts one tilemap row (ROW_STRIDE, 0x20).
  const rows = (mem8[EAGLE_GRID_COL] >> 3) + 1;
  let cell = u16(EAGLE_GRID_VRAM_BASE - ROW_STRIDE * rows);

  // CURSOR COLUMN (ROM 0x724f). The grid-edge guard both advances the eagle toward the edge and hands
  // back the coordinate used for the horizontal step.
  const cols = armEagleFinishAtGridEdge(m); // grid-edge guard; hands back the coordinate for the second axis
  // Reaching the edge runs the phase-reset epilogue, which repoints the running cursor at the
  // records-arrived cell — mirror that so the marker lands where the epilogue leaves it.
  if (mem8[EAGLE_FINISH_FLAG] !== 0) cell = WAVE_RECORDS_ARRIVED;
  // Step the cursor right by (coordinate>>3)+1 cells and stamp the marker tile (ROM 0x725d).
  cell = u16(cell + ((cols >> 3) + 1));
  mem8[cell] = GRID_MARKER_TILE;

  // COLOUR ATTRIBUTE (ROM 0x725f). The colour/attribute cell sits VRAM_TO_COLOUR (0x400) below the
  // tile cell. Pick the palette-select value from two low bits of the eagle's column source
  // EAGLE_GRID_COL (0x8c96) and position source EAGLE_GRID_POS (0x8c94):
  //   column bits == 0x06 -> 0xc0 (position bits == 0x02) else 0x80;
  //   otherwise           -> 0x40 (position bits == 0x02) else 0x00.
  const colourCell = u16(cell - VRAM_TO_COLOUR);
  const colBits = mem8[EAGLE_GRID_COL] & 0x06;
  const posBits = mem8[EAGLE_GRID_POS] & 0x06;
  const attr = colBits === 0x06
    ? posBits === 0x02 ? 0xc0 : 0x80
    : posBits === 0x02 ? 0x40 : 0x00;
  mem8[colourCell] = attr;
}
