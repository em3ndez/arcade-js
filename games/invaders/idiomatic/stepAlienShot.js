// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  OBJECT_WORK_BUFFER, TASK_FLAGS, SHIP_READY_FLAG, ALIEN_SHOT_RATE_GATE0, ALIEN_SHOT_RATE_GATE_1, loc_2074, loc_2075, ALIEN_SHOT_COLUMN_CURSOR,
  PLAYER_SHIP_X, loc_20cf, ALIEN_SHOT_COORD, loc_207c, ALIEN_SHOT_STEP, ALIEN_SHOT_SPRITE_FRAME_CEILING, ALIEN_SHOT_SPRITE_PTR,
  COLLISION_FLAG, loc_2015,
} from "./names.js";
import { findLiveAlienInColumn } from "./findLiveAlienInColumn.js";
import { alienIndexToScreenCoords } from "./alienIndexToScreenCoords.js";
import { objectMatchesDrawPhase } from "./objectMatchesDrawPhase.js";
import { stepAlienShotBlowup } from "./stepAlienShotBlowup.js";
import { eraseAlienShot } from "./eraseAlienShot.js";
import { drawAlienShotWithCollision } from "./drawAlienShotWithCollision.js";
import { scaleYToBlock } from "./scaleYToBlock.js";

/**
 * stepAlienShot — the per-frame alien-shot handler: step a live shot, or try to launch a new one.
 *
 * WHAT IT IS
 *   Runs one frame of one alien shot. If a shot is currently live it advances it (animate, descend,
 *   redraw with collision, and retire when it reaches the shield/ground bands or hits something); if no
 *   shot is live it decides whether to launch a fresh one this frame from a chosen firing column.
 *
 * ROLE IN THE MACHINE
 *   The state lives in a shared eleven-byte object work buffer whose status byte is OBJECT_WORK_BUFFER (0x2073): bit
 *   7 = shot is live, bit 0 = its terminal blowup animation is in progress (see mechanisms.md, "Alien shot
 *   rate and rendering"). The alien-shot record handlers (alienShotSlot2/3/4Handler) prime that strip into
 *   the work buffer, seat the per-column rate cells, and call this. The rate scales with how much of the
 *   fleet remains: selectAlienShotRate stores the cadence in loc_20cf, which the gates below test against
 *   the per-column rate cells ALIEN_SHOT_RATE_GATE0/ALIEN_SHOT_RATE_GATE_1. Launch cells: SHIP_READY_FLAG/loc_2075 are gate flags, ALIEN_SHOT_COLUMN_CURSOR a
 *   16-bit cursor into a firing-column list, loc_2074 the launch-attempt counter, PLAYER_SHIP_X the Y source
 *   scaled to a column, ALIEN_SHOT_COORD/loc_207c the shot's descriptor coordinate + phase byte, ALIEN_SHOT_STEP the
 *   per-frame descent step (set to 0xfb = -5 by setAlienShotStepWhenFew when few aliens remain), ALIEN_SHOT_SPRITE_FRAME_CEILING
 *   the sprite-frame wrap ceiling, and ALIEN_SHOT_SPRITE_PTR (0x2079) the shot's draw/erase descriptor.
 *   TASK_FLAGS (0x20c1) == 4 forces an immediate launch.
 *
 * ROM 0x0563-0x062e.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: the shot's status byte, coordinate, sprite frame, and (on collision) COLLISION_FLAG / loc_2015;
 * the shot may be drawn to or erased from video RAM.
 */
export function stepAlienShot(m) {
  // Dispatch on the live bit (bit 7) of the status byte: live -> step it, idle -> maybe launch a new one.
  if (m.mem8[OBJECT_WORK_BUFFER] & 0x80) return stepActiveShot(m);
  return maybeLaunchShot(m);
}

// Bring the shot live: set bit 7 of the status byte and bump the launch-attempt counter.
function activateShot(m) {
  m.mem8[OBJECT_WORK_BUFFER] |= 0x80;
  m.mem8[loc_2074] = m.mem8[loc_2074] + 1;
}

// Idle path: decide whether to launch a shot this frame. Gated by task state and the two per-column rate
// timers; then pick a firing column and, if it holds a live alien, seat the shot's start and go live.
function maybeLaunchShot(m) {
  // TASK_FLAGS == 4 is the unconditional-fire request: launch immediately.
  if (m.mem8[TASK_FLAGS] === 4) return activateShot(m);

  // SHIP_READY_FLAG is the enable gate for this slot; zero means "not allowed to fire" — nothing to do.
  if (m.mem8[SHIP_READY_FLAG] === 0) return;

  // Reset the launch-attempt counter before evaluating the rate gates for this attempt.
  m.mem8[loc_2074] = 0;

  // Rate gate: the cadence (loc_20cf, set by selectAlienShotRate) is compared against the two per-column
  // rate cells. A nonzero rate cell that the cadence has reached suppresses firing this frame (too soon).
  const rate = m.mem8[loc_20cf];
  const gate0 = m.mem8[ALIEN_SHOT_RATE_GATE0];
  if (gate0 !== 0 && rate >= gate0) return;
  const gate1 = m.mem8[ALIEN_SHOT_RATE_GATE_1];
  if (gate1 !== 0 && rate >= gate1) return;

  // Choose the firing column. Mode by loc_2075:
  //   0 -> derive it from the ship/Y source PLAYER_SHIP_X (+8), scaled to a grid block via scaleYToBlock,
  //        clamped to 0..11 (the 11 columns of the alien rack).
  //   else -> read the next column from the cursor list ALIEN_SHOT_COLUMN_CURSOR and advance that 16-bit cursor.
  let column;
  if (m.mem8[loc_2075] === 0) {
    const [, , steps] = scaleYToBlock(m, u8(m.mem8[PLAYER_SHIP_X] + 8));
    column = steps < 12 ? steps : 11;
  } else {
    const cursor = m.mem16[ALIEN_SHOT_COLUMN_CURSOR];
    column = m.mem8[cursor];
    m.mem16[ALIEN_SHOT_COLUMN_CURSOR] = cursor + 1;
  }

  // Find the lowest live alien in that column; with none there, abort the launch this frame.
  const [found, , slot] = findLiveAlienInColumn(m, column);
  if (!found) return;

  // Seat the shot's start coordinate from that alien's screen position (offset so the shot leaves just
  // below/left of the alien: high byte = cellC+7, low byte = cellL-10), then bring the shot live.
  const [cellL, cellC] = alienIndexToScreenCoords(m, slot);
  m.mem16[ALIEN_SHOT_COORD] = (u8(cellC + 7) << 8) | u8(cellL - 10);
  return activateShot(m);
}

// Live path: advance a shot already in flight — gate to this raster half, run the blowup while it is
// blowing up, else animate + descend + redraw and decide whether to keep flying or retire.
function stepActiveShot(m) {
  // Only service this object in the raster half its phase byte (loc_207c) belongs to, so it is not torn.
  if (!objectMatchesDrawPhase(m, loc_207c)) return;

  // Already blowing up (bit 0 of the status byte)? Run the terminal-explosion animation instead of moving.
  if (m.mem8[OBJECT_WORK_BUFFER] & 0x01) return stepAlienShotBlowup(m);

  // Tick the step/animation counter and erase the shot from its old position before moving it.
  m.mem8[loc_2074] = m.mem8[loc_2074] + 1;
  eraseAlienShot(m);

  // Advance the shot's sprite frame: the descriptor's leading graphics byte (at ALIEN_SHOT_SPRITE_PTR) steps
  // by 3 each move and wraps by 12 once it passes the frame-range ceiling ALIEN_SHOT_SPRITE_FRAME_CEILING — cycling the animation.
  let sprite = u8(m.mem8[ALIEN_SHOT_SPRITE_PTR] + 3);
  if (sprite >= m.mem8[ALIEN_SHOT_SPRITE_FRAME_CEILING]) sprite = u8(sprite - 12);
  m.mem8[ALIEN_SHOT_SPRITE_PTR] = sprite;

  // Move the shot along its travel by the signed per-frame step (ALIEN_SHOT_STEP; 0xfb = -5 when few aliens), then
  // redraw it with collision detection so a hit against a shield/target/player latches COLLISION_FLAG.
  m.mem8[ALIEN_SHOT_COORD] = m.mem8[ALIEN_SHOT_COORD] + m.mem8[ALIEN_SHOT_STEP];
  drawAlienShotWithCollision(m);

  // Retire test on the shot's coordinate (ALIEN_SHOT_COORD), matching the 8080 compares (0x15=21, 0x1e=30, 0x27=39):
  const y = m.mem8[ALIEN_SHOT_COORD];
  if (y >= 21) {
    // Still above the low bands: if nothing was hit this frame, keep flying (leave it live, do not blow up).
    if (m.mem8[COLLISION_FLAG] === 0) return;
    // It hit something up here; when the hit falls in the y=30..39 band clear loc_2015 — the round-start arm
    // sentinel that advanceRoundState / isArmTriggerSet poll for 0xff (this band is where that arm is cancelled).
    if (y >= 30 && y < 39) m.mem8[loc_2015] = 0;
  }
  // Reached the ground band (y < 21), or hit something above it: enter the blowup by setting status bit 0,
  // so the next frames run stepAlienShotBlowup.
  m.mem8[OBJECT_WORK_BUFFER] |= 0x01;
}
