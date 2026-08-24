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
 * advanceEagleApproachAndPaintGridMarker — the eagle/arrow approach state machine, run once per frame.
 *
 * A hold counter gates entry: while it is nonzero it just ticks down and returns. Once it
 * reaches zero the machine drives the player aim-indicator flags from the eagle's approach
 * coordinate against two X thresholds and the records-arrived sub-phase, latching the enemy X
 * when the coordinate crosses the far threshold. When the coordinate sits exactly at the near
 * threshold it steps the sub-phase; on the final sub-phase, once armed, it advances a grid
 * pointer every eighth frame — stamping a marker tile and its colour attribute — and delegates
 * the grid-edge guard and the phase-reset epilogue.
 *
 * LIVE-OUT: none. Each exit leaves scratch registers in a state the sole caller does not read
 * (its next step reloads them), so the contract is memory only.
 */

// The eagle's advancing grid coordinate and its column both live in the target record.
const EAGLE_GRID_POS = ENEMY_TARGET_REC0 + 0x04;
const EAGLE_GRID_COL = ENEMY_TARGET_REC0 + 0x06;

const EAGLE_APPROACH_X = 0x59; // near threshold: step the sub-phase when the coordinate is here
const EAGLE_LATCH_X = 0x60;    // far threshold: latch the enemy X once the coordinate reaches it
const ROW_STRIDE = 0x20;       // one tilemap row
const VRAM_TO_COLOUR = 0x400;  // step back from a tile cell to its colour/attribute cell
const GRID_MARKER_TILE = 0x2c; // stamped at the stepped grid cell
const GRID_STEP_MASK = 0x07;   // advance only on an eighth-frame boundary

const AIM_ON_TARGET = 0x04;  // aim flag: on target
const AIM_BELOW = 0x08;      // aim flag: below target
const AIM_ARMED = 0x10;      // aim flag: approach armed
const CLEAR_ON_TARGET = 0xfb; // ~AIM_ON_TARGET
const CLEAR_BELOW = 0xf7;     // ~AIM_BELOW
const CLEAR_AIM = 0xf3;       // ~(AIM_ON_TARGET | AIM_BELOW)

export function advanceEagleApproachAndPaintGridMarker(m) {
  const { mem8 } = m;

  const hold = mem8[WAVE_HOLD_TIMER];
  if (hold !== 0) {
    mem8[WAVE_HOLD_TIMER] = hold - 1;
    return;
  }

  // With no target present, aim straight from the eagle X; otherwise run the sub-phase branch,
  // which can fall back to that same aim update.
  if ((mem8[ENEMY_TARGET_REC0] | mem8[loc_8a99]) === 0) {
    aimFromEagleX(m);
    return;
  }

  const eagleX = mem8[PLAYER_Y];
  if (eagleX === EAGLE_APPROACH_X) {
    advanceApproachSubPhase(m);
    return;
  }
  if (eagleX > EAGLE_APPROACH_X) {
    aimFromEagleX(m);
    return;
  }
  mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] & CLEAR_ON_TARGET) | AIM_BELOW;
}

/** Update the aim flags from the eagle X: once latched, show on-target; else latch past the far
 *  threshold and show below. */
function aimFromEagleX(m) {
  const { mem8 } = m;
  if (mem8[LATCHED_ENEMY_X] !== 0) {
    mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_ON_TARGET) & CLEAR_BELOW;
    return;
  }
  const eagleX = mem8[PLAYER_Y];
  if (eagleX >= EAGLE_LATCH_X) mem8[LATCHED_ENEMY_X] = eagleX;
  mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] & CLEAR_ON_TARGET) | AIM_BELOW;
}

/** Step the records-arrived sub-phase: 0 -> 1 (clear aim), anything but 2 -> 2 (arm aim), 2 ->
 *  the grid-marker step. */
function advanceApproachSubPhase(m) {
  const { mem8 } = m;
  const arrived = mem8[WAVE_RECORDS_ARRIVED];
  if (arrived === 0) {
    mem8[WAVE_RECORDS_ARRIVED] = 1;
    mem8[PLAYER_AIM_FLAGS] = mem8[PLAYER_AIM_FLAGS] & CLEAR_AIM;
    return;
  }
  if (arrived !== 2) {
    mem8[WAVE_RECORDS_ARRIVED] = 2;
    mem8[PLAYER_AIM_FLAGS] = AIM_ARMED;
    return;
  }
  stepGridMarker(m);
}

/** On the final sub-phase, once per eighth frame, stamp the next grid marker and its colour
 *  attribute; the grid-edge guard and the phase-reset epilogue are delegated. */
function stepGridMarker(m) {
  const { mem8 } = m;

  if (mem8[EAGLE_FINISH_FLAG] !== 0) {
    advanceEaglePhaseAndClearAim(m);
    return;
  }

  mem8[EAGLE_GRID_STEP_TICK] = mem8[EAGLE_GRID_STEP_TICK] + 1;
  if ((mem8[EAGLE_GRID_STEP_TICK] & GRID_STEP_MASK) !== 0) {
    armEagleFinishAtGridEdge(m); // not an eighth-frame boundary: just run the grid-edge guard
    return;
  }

  const rows = (mem8[EAGLE_GRID_COL] >> 3) + 1;
  let cell = u16(EAGLE_GRID_VRAM_BASE - ROW_STRIDE * rows);

  const cols = armEagleFinishAtGridEdge(m); // grid-edge guard; hands back the coordinate for the second axis
  // Reaching the edge runs the phase-reset epilogue, which repoints the running cursor at the
  // records-arrived cell — mirror that so the marker lands where the epilogue leaves it.
  if (mem8[EAGLE_FINISH_FLAG] !== 0) cell = WAVE_RECORDS_ARRIVED;
  cell = u16(cell + ((cols >> 3) + 1));
  mem8[cell] = GRID_MARKER_TILE;

  const colourCell = u16(cell - VRAM_TO_COLOUR);
  const colBits = mem8[EAGLE_GRID_COL] & 0x06;
  const posBits = mem8[EAGLE_GRID_POS] & 0x06;
  const attr = colBits === 0x06
    ? posBits === 0x02 ? 0xc0 : 0x80
    : posBits === 0x02 ? 0x40 : 0x00;
  mem8[colourCell] = attr;
}
