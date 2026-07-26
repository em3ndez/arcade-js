// SPDX-License-Identifier: GPL-3.0-only
/**
 * classifyWallCollision — per-frame maze-wall collision classifier: works out which
 * wall segment the player's probe point is touching and stores a 4-way
 * blocked-direction bitmask the player movement reads.  ROM 0x03e8.
 *
 * Every frame it does three things:
 *
 *   1. Periodic HUD panel redraw. When the free-running frame counter wraps to zero,
 *      repaint the fixed on-screen panel (column 6, row 10).
 *   2. A 30-frame housekeeping tick. A private countdown ticks down each frame; only
 *      when it reaches zero does it reload to 30 and do the once-every-30-frames
 *      chores — and, unless a busy flag is set, recolour one playfield column by one
 *      palette step. When that busy flag IS set on a tick frame, the frame is spent
 *      on housekeeping and the classification below is skipped for that frame.
 *   3. The classification proper. If there is a live probe object this frame, take its
 *      probe point (a few pixels inside its box), find which maze-wall segment it is
 *      against, and store the matching blocked-direction bit. With no live probe the
 *      previous frame's mask is left untouched.
 *
 * The maze is partitioned into six horizontal bands. A cached band hint lets a
 * roughly-stationary probe re-scan only the band it was last in; if the probe has
 * moved out of that band, the scan falls through band by band (re-stamping the hint
 * as it crosses each new band) until a wall segment matches. Each band is a short
 * list of wall lines: a wall runs along one exact coordinate value, and once the
 * probe sits on that line a half-plane test on the other coordinate picks which of
 * the four blocked-direction bits to raise.
 *
 * Called from the game's main loop, which passes nothing and reads nothing back —
 * the whole product is the bitmask left in work RAM. It reaches into the still-oracle
 * panel/colour painters through the machine's return stack (they tail into a colour
 * filler that has not been decompiled yet), so each of those two calls is bracketed
 * with the return address the filler unwinds to; when that filler is decompiled those
 * brackets dissolve into plain calls.
 *
 * Memory-equivalent to the frozen oracle — equivalence-03e8.test.js.
 * GATE:     crafted-entry + real dispatch — captured at real attract dispatches (the
 *           main loop runs it every frame) for the timer/housekeeping arms, plus a
 *           dense crafted sweep of probe X/Y and band hint that forces the classifier
 *           down every band and wall line. Compares RAM + exit pc + SP; teeth caught.
 * LIVE-OUT: memory-only — the blocked-direction mask (DIG_DIRS), the band hint, the
 *           countdown timer, and the panel/colour cells the two painters write. The
 *           residual register file is dead here (the caller overwrites it at once), so
 *           it is deliberately not part of the contract.
 * NAMES:    FRAME_COUNTER, OBJ_X, OBJ_Y, SPAWN_PHASE, DIG_DIRS from ram.js. Local:
 *           WALL_TIMER (0x800b, the 30-frame countdown), BAND_HINT (0x800c, the cached
 *           band index). Hex-kept: 0x8079 (probe-present gate) and 0x807c (busy-tick
 *           gate) — their exact roles are not yet pinned, so no asserted name.
 */

import { FRAME_COUNTER, OBJ_X, OBJ_Y, SPAWN_PHASE, DIG_DIRS } from "./ram.js";
import { loc_4894 } from "./loc_4894.js";
import { loc_48c4 } from "./loc_48c4.js";

// The 30-frame countdown this routine ticks down and reloads; not in ram.js.
const WALL_TIMER = 0x800b;
// Cached maze band the probe was last classified in (the six band indices are
// 0-and-below / 7 / 10 / 14 / 23 / 30); not in ram.js.
const BAND_HINT = 0x800c;

// -- the six maze bands ------------------------------------------------------
// Each returns one of the four blocked-direction bits when the probe sits on one of
// the band's wall lines, or null to let the scan fall through to the next band. `b`
// is the probe's X line, `c` its Y line. On each wall line a threshold on the other
// coordinate splits the wall into two facings.

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

// The last band always resolves (its final line falls through to a fixed bit).
function scanBand30(b, c) {
  if (b === 24) return c > 56 ? 8 : 2;
  if (c === 56) return b <= 47 ? 2 : 8;
  return 8;
}

/**
 * Scan the maze bands for the wall segment under the probe point (b, c) and return
 * the blocked-direction bit. Starts at the band the cached hint names, then falls
 * through the remaining bands in order — re-stamping the hint as it enters each new
 * band — until a wall line matches.
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
    m.push16(0x03ef); // oracle boundary: the painter tails into a still-oracle filler
    loc_4894(m);
  }

  // 2. 30-frame housekeeping tick.
  const timer = (mem.read8(WALL_TIMER) - 1) % 256;
  mem.write8(WALL_TIMER, timer);
  if (timer === 0) {
    mem.write8(WALL_TIMER, 30); // reload the countdown
    if (mem.read8(0x807c) !== 0) {
      // Busy this tick — spend the frame on housekeeping, skip classification.
      m.ret();
      return;
    }
    if (mem.read8(SPAWN_PHASE) === 0) {
      m.push16(0x0409); // oracle boundary: the colour filler unwinds to this address
      loc_48c4(m);
    }
  }

  // 3. Classify the maze wall under the probe — only when a probe object is live;
  //    otherwise the previous frame's blocked-direction mask stands.
  if (mem.read8(0x8079) === 0) {
    m.ret();
    return;
  }

  // The probe point sits a few pixels inside the tracked object's bounding box.
  const b = (mem.read8(OBJ_X) + 3) % 256;
  const c = (mem.read8(OBJ_Y) + 5) % 256;

  mem.write8(DIG_DIRS, classifyBands(m, b, c));
  m.ret();
}
