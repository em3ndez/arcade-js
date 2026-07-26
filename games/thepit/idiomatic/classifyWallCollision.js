// SPDX-License-Identifier: GPL-3.0-only
/**
 * classifyWallCollision — per-frame maze-wall classifier: works out which wall
 * segment the tracked object's probe point is touching and stores a one-of-four
 * direction code the movement dispatcher consumes.  ROM 0x03e8.
 *
 * The direction code (DIG_DIRS) is read by the movement dispatcher IN PLACE OF THE
 * JOYSTICK in the mode this routine runs in — the attract demo (loc_1420 selects
 * mem[DIG_DIRS] over the debounced joystick when the game-mode byte is >= 3). So this
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
 * Its only caller is the main loop (loc_0348), which runs it while the game-mode byte
 * is 4, passes nothing and reads nothing back — the whole product is the direction
 * code left in work RAM (DIG_DIRS).
 *
 * The periodic panel redraw (loc_4894) is reached through a return-address bracket:
 * loc_4894 is itself idiomatic, but it still calls the two frozen-oracle copy/fill
 * helpers (0x3dea, 0x3ddb), and the bracket keeps the Z80 stack pointer where those
 * oracle helpers expect it, so their stack scratch matches the oracle run exactly. When
 * those two helpers are decompiled the bracket dissolves too. The column recolour
 * (loc_48c4) needs no bracket — its whole chain (the cell-address helpers and the colour
 * filler) is already idiomatic — so it is a plain direct call.
 *
 * Memory-equivalent to the frozen oracle — equivalence-03e8.test.js.
 * GATE:     crafted-entry + real dispatch — captured at real attract dispatches (the
 *           main loop runs it every frame) for the timer/service arms, plus a dense
 *           crafted sweep of probe X/Y and band hint that forces the classifier down
 *           every band and wall line. Compares observable RAM (the exit pc + SP and the
 *           dead stack-scratch window are excluded); teeth caught.
 * LIVE-OUT: memory-only — the direction code (DIG_DIRS), the band hint, the countdown
 *           timer, and the panel/colour cells the two painters write. The residual
 *           register file is dead here (the caller overwrites it at once), so it is
 *           deliberately not part of the contract.
 * NAMES:    OBJECT_ACTIVE, OBJ_X, OBJ_Y, FRAME_COUNTER, SPAWN_PHASE, STATE_TIMER,
 *           DIG_DIRS from ram.js. Local: HOUSEKEEPING_TIMER (0x800b) and BAND_HINT
 *           (0x800c) — both private to this per-frame service (loc_03be only inits them),
 *           so they stay local rather than shared.
 */

import {
  FRAME_COUNTER,
  OBJ_X,
  OBJ_Y,
  SPAWN_PHASE,
  DIG_DIRS,
  OBJECT_ACTIVE,
  STATE_TIMER,
} from "./ram.js";
import { loc_4894 } from "./loc_4894.js";
import { loc_48c4 } from "./loc_48c4.js";

// The per-frame countdown that paces the 30-frame service tick (the background column
// recolour). Reloads to 30 each time it fires. Private to this routine; not in ram.js.
const HOUSEKEEPING_TIMER = 0x800b;
// Cached maze band the probe was last classified in — a resume hint so a
// roughly-stationary probe re-scans only its last band. The six band indices are
// 0-and-below / 7 / 10 / 14 / 23 / 30. Private to this routine; not in ram.js.
const BAND_HINT = 0x800c;

// -- the six maze bands ------------------------------------------------------
// Each returns one of the four direction bits when the probe sits on one of the band's
// wall lines, or null to let the scan fall through to the next band. `b` is the probe's
// X line, `c` its Y line. On each wall line a threshold on the other coordinate splits
// the wall into two facings (which side of the wall the probe is on -> which way to go).

// Band scanned when the hint is 6 or below. It does not re-stamp the hint (a hit here
// leaves the cached band as it was).
function scanBandTop(b, c) {
  if (b === 48) return c <= 55 ? 4 : 2;
  if (c === 56) return b <= 87 ? 2 : 4;
  if (b === 88) return c <= 63 ? 4 : 2;
  if (c === 64) return b <= 103 ? 2 : 4;
  if (b === 104) return c <= 83 ? 4 : 2;
  if (c === 84) return b <= 143 ? 2 : 4;
  if (b === 144) return c <= 127 ? 4 : 2;
  if (c === 128) return b <= 191 ? 2 : 4;
  if (b === 192) return c <= 159 ? 4 : 2;
  if (c === 160) return b <= 199 ? 2 : 4;
  if (b === 200) return c <= 191 ? 4 : 2;
  if (c === 192) return b <= 223 ? 2 : 4;
  if (b === 224) return c <= 215 ? 4 : 1;
  return null;
}

function scanBand7(b, c) {
  if (c === 216) return b > 176 ? 1 : 4;
  if (b === 176) return c <= 231 ? 4 : 1;
  if (c === 232) return b > 168 ? 1 : 8;
  return null;
}

function scanBand10(b, c) {
  if (b === 168) return c > 216 ? 8 : 1;
  if (c === 216) return b > 72 ? 1 : 4;
  if (b === 72) return c <= 223 ? 4 : 1;
  if (c === 224) return b > 24 ? 1 : 8;
  return null;
}

function scanBand14(b, c) {
  if (b === 24) return c > 192 ? 8 : 2;
  if (c === 192) return b <= 47 ? 2 : 8;
  if (b === 48) return c > 168 ? 8 : 2;
  if (c === 168) return b <= 71 ? 2 : 8;
  if (b === 72) return c > 160 ? 8 : 2;
  if (c === 160) return b <= 87 ? 2 : 8;
  if (b === 88) return c > 128 ? 8 : 2;
  if (c === 128) return b <= 95 ? 2 : 8;
  if (b === 96) return c > 108 ? 8 : 1;
  return null;
}

function scanBand23(b, c) {
  if (c === 108) return b > 88 ? 1 : 8;
  if (b === 88) return c > 92 ? 8 : 1;
  if (c === 92) return b > 80 ? 1 : 8;
  if (b === 80) return c > 88 ? 8 : 1;
  if (c === 88) return b > 40 ? 1 : 8;
  if (b === 40) return c > 72 ? 8 : 1;
  if (c === 72) return b > 24 ? 1 : 8;
  return null;
}

// The last band always resolves (its final line falls through to a fixed direction).
function scanBand30(b, c) {
  if (b === 24) return c > 56 ? 8 : 2;
  if (c === 56) return b <= 47 ? 2 : 8;
  return 8;
}

/**
 * Scan the maze bands for the wall segment under the probe point (b, c) and return the
 * direction bit it implies. Starts at the band the cached hint names, then falls through
 * the remaining bands in order — re-stamping the hint as it enters each new band — until
 * a wall line matches.
 */
function classifyBands(m, b, c) {
  const { mem } = m;
  const hint = mem.read8(BAND_HINT);

  // The `hint < N` ladder both picks the starting band and, because a lower start
  // satisfies every later condition too, drives the fall-through cascade onward.
  if (hint < 7) {
    const r = scanBandTop(b, c);
    if (r !== null) return r;
  }
  if (hint < 10) {
    mem.write8(BAND_HINT, 7);
    const r = scanBand7(b, c);
    if (r !== null) return r;
  }
  if (hint < 14) {
    mem.write8(BAND_HINT, 10);
    const r = scanBand10(b, c);
    if (r !== null) return r;
  }
  if (hint < 23) {
    mem.write8(BAND_HINT, 14);
    const r = scanBand14(b, c);
    if (r !== null) return r;
  }
  if (hint < 30) {
    mem.write8(BAND_HINT, 23);
    const r = scanBand23(b, c);
    if (r !== null) return r;
  }
  mem.write8(BAND_HINT, 30);
  return scanBand30(b, c);
}

export function classifyWallCollision(m) {
  const { mem } = m;

  // 1. Periodic HUD panel redraw when the frame counter has wrapped to zero.
  if (mem.read8(FRAME_COUNTER) === 0) {
    // loc_4894 is idiomatic but still calls two oracle copy/fill helpers; the bracket
    // holds the stack pointer where they expect it (see header). Dissolves when they do.
    m.push16(0x03ef);
    loc_4894(m);
  }

  // 2. 30-frame service tick.
  const timer = (mem.read8(HOUSEKEEPING_TIMER) - 1) % 256;
  mem.write8(HOUSEKEEPING_TIMER, timer);
  if (timer === 0) {
    mem.write8(HOUSEKEEPING_TIMER, 30); // reload the countdown
    if (mem.read8(STATE_TIMER) !== 0) {
      // The object is locked in a timed state — give up the whole frame, no classify.
      m.ret();
      return;
    }
    if (mem.read8(SPAWN_PHASE) === 0) {
      // Not mid-spawn: recolour one playfield column by one palette step. Its whole
      // chain is idiomatic, so this is a plain direct call.
      loc_48c4(m);
    }
  }

  // 3. Classify the maze wall under the probe — only when the tracked object is live;
  //    otherwise the previous frame's direction code stands.
  if (mem.read8(OBJECT_ACTIVE) === 0) {
    m.ret();
    return;
  }

  // The probe point sits a few pixels inside the tracked object's bounding box.
  const b = (mem.read8(OBJ_X) + 3) % 256;
  const c = (mem.read8(OBJ_Y) + 5) % 256;

  mem.write8(DIG_DIRS, classifyBands(m, b, c));
  m.ret();
}
