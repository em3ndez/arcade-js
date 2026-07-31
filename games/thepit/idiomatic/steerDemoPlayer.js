// SPDX-License-Identifier: GPL-3.0-only
/**
 * steerDemoPlayer — generate the attract demo's per-frame steering: from the demo
 * player's position, emit the one-of-four move direction (written where the joystick
 * would go) that walks the auto-played digger along the maze walls.  ROM 0x03e8.
 *
 * The direction code (DEMO_STEER_DIR) is read by the movement dispatcher IN PLACE OF THE
 * JOYSTICK in the mode this routine runs in — the attract demo (stepObjectFromControl selects
 * mem[DEMO_STEER_DIR] over the debounced joystick when the game-mode byte is >= 3). So this
 * classifier is what steers the demo object along the maze walls: each call it picks
 * the single direction the wall it is against implies, and hands that to movement.
 *
 * Every frame it does three things:
 *
 *   1. Periodic HUD panel redraw. When the free-running frame counter wraps to zero,
 *      repaint the fixed on-screen panel (column 6, row 10).
 *   2. A 30-frame service tick. A private countdown ticks down each frame; only when
 *      it reaches zero does it reload to 30 and run the once-every-30-frames chores.
 *      If the object's state-lockout timer is still running the object is mid-sequence,
 *      so the whole frame is given up here and nothing below runs. Otherwise, unless the
 *      object is in its spawn sub-phase, one playfield column is recoloured by one
 *      palette step (a slow background colour cycle).
 *   3. The classification proper. If the tracked object is live this frame, take its
 *      probe point (a few pixels inside its box), find which maze-wall segment it is
 *      against, and store the matching direction code. With no live object the previous
 *      frame's code is left untouched.
 *
 * The maze is partitioned into six horizontal bands. A cached band hint lets a
 * roughly-stationary probe re-scan only the band it was last in; if the probe has
 * moved out of that band, the scan falls through band by band (re-stamping the hint
 * as it crosses each new band) until a wall segment matches. Each band is a short
 * list of wall lines: a wall runs along one exact coordinate value, and once the
 * probe sits on that line a half-plane test on the other coordinate picks which of
 * the four direction bits to raise.
 *
 * Its only caller is the main loop (mainLoop), which runs it while the game-mode byte
 * is 4, passes nothing and reads nothing back — the whole product is the direction
 * code left in work RAM (DEMO_STEER_DIR).
 *
 * The periodic panel redraw (drawCreditsDisplay) is reached through a return-address bracket:
 * drawCreditsDisplay is itself idiomatic, but it still calls the two frozen-oracle copy/fill
 * helpers (0x3dea, 0x3ddb), and the bracket keeps the Z80 stack pointer where those
 * oracle helpers expect it, so their stack scratch matches the oracle run exactly. When
 * those two helpers are decompiled the bracket dissolves too. The column recolour
 * (cyclePanelColumnColour) needs no bracket — its whole chain (the cell-address helpers and the colour
 * filler) is already idiomatic — so it is a plain direct call.
 *
 * Memory-equivalent to the frozen oracle — equivalence-03e8.test.js.
 * GATE:     crafted-entry + real dispatch — captured at real attract dispatches (the
 *           main loop runs it every frame) for the timer/service arms, plus a dense
 *           crafted sweep of probe X/Y and band hint that forces the classifier down
 *           every band and wall line. Compares observable RAM (the exit pc + SP and the
 *           dead stack-scratch window are excluded); teeth caught.
 * LIVE-OUT: memory-only — the direction code (DEMO_STEER_DIR), the band hint, the countdown
 *           timer, and the panel/colour cells the two painters write. The residual
 *           register file is dead here (the caller overwrites it at once), so it is
 *           deliberately not part of the contract.
 * NAMES:    PLAYER_ACTIVE, PLAYER_Y, PLAYER_X, PLAY_PHASE_COUNTER, BOARD_END_PHASE, TRANSITION_TIMER,
 *           DEMO_STEER_DIR from ram.js. DEMO_STEER_SERVICE_TIMER (0x800b) and DEMO_STEER_BAND_HINT
 *           (0x800c) are private to this per-frame service (enterPlayMode only inits them).
 */

import {
  PLAY_PHASE_COUNTER,
  PLAYER_Y,
  PLAYER_X,
  BOARD_END_PHASE,
  DEMO_STEER_DIR,
  PLAYER_ACTIVE,
  TRANSITION_TIMER,
  DEMO_STEER_SERVICE_TIMER,
  DEMO_STEER_BAND_HINT,
} from "./ram.js";
import { drawCreditsDisplay } from "./drawCreditsDisplay.js";
import { cyclePanelColumnColour } from "./cyclePanelColumnColour.js";
import { u8 } from "../../../core/int.js";

// -- the six maze bands ------------------------------------------------------
// Each returns one of the four direction bits when the probe sits on one of the band's
// wall lines, or null to let the scan fall through to the next band. `probeX` is the
// probe's X line, `probeY` its Y line. On each wall line a threshold on the other
// coordinate splits the wall into two facings (which side of the wall the probe is on
// -> which way to go).

// Band scanned when the hint is 6 or below. It does not re-stamp the hint (a hit here
// leaves the cached band as it was).
function scanBandTop(probeX, probeY) {
  if (probeX === 48) return probeY <= 55 ? 4 : 2;
  if (probeY === 56) return probeX <= 87 ? 2 : 4;
  if (probeX === 88) return probeY <= 63 ? 4 : 2;
  if (probeY === 64) return probeX <= 103 ? 2 : 4;
  if (probeX === 104) return probeY <= 83 ? 4 : 2;
  if (probeY === 84) return probeX <= 143 ? 2 : 4;
  if (probeX === 144) return probeY <= 127 ? 4 : 2;
  if (probeY === 128) return probeX <= 191 ? 2 : 4;
  if (probeX === 192) return probeY <= 159 ? 4 : 2;
  if (probeY === 160) return probeX <= 199 ? 2 : 4;
  if (probeX === 200) return probeY <= 191 ? 4 : 2;
  if (probeY === 192) return probeX <= 223 ? 2 : 4;
  if (probeX === 224) return probeY <= 215 ? 4 : 1;
  return null;
}

function scanBand7(probeX, probeY) {
  if (probeY === 216) return probeX > 176 ? 1 : 4;
  if (probeX === 176) return probeY <= 231 ? 4 : 1;
  if (probeY === 232) return probeX > 168 ? 1 : 8;
  return null;
}

function scanBand10(probeX, probeY) {
  if (probeX === 168) return probeY > 216 ? 8 : 1;
  if (probeY === 216) return probeX > 72 ? 1 : 4;
  if (probeX === 72) return probeY <= 223 ? 4 : 1;
  if (probeY === 224) return probeX > 24 ? 1 : 8;
  return null;
}

function scanBand14(probeX, probeY) {
  if (probeX === 24) return probeY > 192 ? 8 : 2;
  if (probeY === 192) return probeX <= 47 ? 2 : 8;
  if (probeX === 48) return probeY > 168 ? 8 : 2;
  if (probeY === 168) return probeX <= 71 ? 2 : 8;
  if (probeX === 72) return probeY > 160 ? 8 : 2;
  if (probeY === 160) return probeX <= 87 ? 2 : 8;
  if (probeX === 88) return probeY > 128 ? 8 : 2;
  if (probeY === 128) return probeX <= 95 ? 2 : 8;
  if (probeX === 96) return probeY > 108 ? 8 : 1;
  return null;
}

function scanBand23(probeX, probeY) {
  if (probeY === 108) return probeX > 88 ? 1 : 8;
  if (probeX === 88) return probeY > 92 ? 8 : 1;
  if (probeY === 92) return probeX > 80 ? 1 : 8;
  if (probeX === 80) return probeY > 88 ? 8 : 1;
  if (probeY === 88) return probeX > 40 ? 1 : 8;
  if (probeX === 40) return probeY > 72 ? 8 : 1;
  if (probeY === 72) return probeX > 24 ? 1 : 8;
  return null;
}

// The last band always resolves (its final line falls through to a fixed direction).
function scanBand30(probeX, probeY) {
  if (probeX === 24) return probeY > 56 ? 8 : 2;
  if (probeY === 56) return probeX <= 47 ? 2 : 8;
  return 8;
}

// The six maze bands top-to-bottom, keyed by the Y-band boundary they cover: `below` is
// the exclusive upper hint value for the band (bands 0-6 / 7-9 / 10-13 / 14-22 / 23-29 /
// 30-up), `scan` is its wall-line test, and `restamp` is the hint value stamped as the
// scan enters this band (null for the top band, which leaves the cached hint unchanged).
const BANDS = [
  { below: 7,        scan: scanBandTop, restamp: null }, // a hit here leaves the hint as-is
  { below: 10,       scan: scanBand7,   restamp: 7 },
  { below: 14,       scan: scanBand10,  restamp: 10 },
  { below: 23,       scan: scanBand14,  restamp: 14 },
  { below: 30,       scan: scanBand23,  restamp: 23 },
  { below: Infinity, scan: scanBand30,  restamp: 30 },   // the last band always resolves
];

/**
 * Scan the maze bands for the wall segment under the probe point (probeX, probeY) and
 * return the direction bit it implies. Starts at the band the cached hint names, then
 * falls through the remaining bands in order — re-stamping the hint as it enters each new
 * band — until a wall line matches.
 */
function classifyBands(m, probeX, probeY) {
  const { mem8 } = m;
  const hint = mem8[DEMO_STEER_BAND_HINT];

  // Because `below` increases while `hint` is fixed, once `hint < below` holds it holds
  // for every later band too: the loop runs from the hint's start band through the end,
  // re-stamping DEMO_STEER_BAND_HINT as it enters each band, exactly like the `hint < N` ladder did.
  for (const band of BANDS) {
    if (hint >= band.below) continue;                     // not into this band yet
    if (band.restamp !== null) mem8[DEMO_STEER_BAND_HINT] = band.restamp;
    const dir = band.scan(probeX, probeY);
    if (dir !== null) return dir;
  }
}

export function steerDemoPlayer(m) {
  const { mem8 } = m;

  // 1. Periodic HUD panel redraw when the frame counter has wrapped to zero.
  if (mem8[PLAY_PHASE_COUNTER] === 0) {
    // drawCreditsDisplay is idiomatic but still calls two oracle copy/fill helpers; the bracket
    // holds the stack pointer where they expect it (see header). Dissolves when they do.
    m.push16(0x03ef);
    drawCreditsDisplay(m);
  }

  // 2. 30-frame service tick.
  const timer = mem8[DEMO_STEER_SERVICE_TIMER] - 1;
  mem8[DEMO_STEER_SERVICE_TIMER] = timer;
  if (timer === 0) {
    mem8[DEMO_STEER_SERVICE_TIMER] = 30; // reload the countdown
    if (mem8[TRANSITION_TIMER] !== 0) {
      // The object is locked in a timed state — give up the whole frame, no classify.
      m.ret();
      return;
    }
    if (mem8[BOARD_END_PHASE] === 0) {
      // Not mid-spawn: recolour one playfield column by one palette step. Its whole
      // chain is idiomatic, so this is a plain direct call.
      cyclePanelColumnColour(m);
    }
  }

  // 3. Classify the maze wall under the probe — only when the tracked object is live;
  //    otherwise the previous frame's direction code stands.
  if (mem8[PLAYER_ACTIVE] === 0) {
    m.ret();
    return;
  }

  // The probe point sits a few pixels inside the tracked object's bounding box.
  const probeX = u8(mem8[PLAYER_Y] + 3);
  const probeY = u8(mem8[PLAYER_X] + 5);

  mem8[DEMO_STEER_DIR] = classifyBands(m, probeX, probeY);
  m.ret();
}
