// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_144c — route an at-rest object to its per-frame handler on its move-command bits.  ROM 0x144c.
 *
 * Reached when an object is idle this frame (its motion marker is clear). The caller
 * hands over the object's per-frame move command — the attract demo's steering byte
 * during the demo, or the debounced joystick otherwise — and this picks the first
 * handler whose command bit is set, in fixed priority:
 *
 *   - a first direction bit  -> position the object and test whether it hit the boundary.
 *   - a second direction bit -> derive the object's tile row and dispatch on it.
 *   - either of two more bits -> reconcile the object's animation phase.
 *   - no direction bit at all -> the object is standing still: reset its animation phase,
 *     then either run the goal handler if it has already reached the goal tile, or defer
 *     the frame by building the object's record.
 *
 * The three direction/phase handlers are still the frozen oracle; the object's position
 * deltas ride in through machine registers untouched (the caller sets them, each handler
 * reads them), so this passes the object's move command and those deltas straight through
 * and clobbers none of them. The goal handler and the record builder on the standing-still
 * path are already decompiled, so they are called directly (the goal handler's columnBias
 * parameter defaults to the D register, which this routine leaves untouched).
 *
 * Memory-equivalent to the frozen oracle — equivalence-144c.test.js.
 * GATE:     crafted-entry — the three direction-bit arms are reached naturally in attract
 *           (286 dispatches over 2000 frames: the two-bit phase arm 227×, the tile-row arm
 *           36×, the position arm 23×) and gated on those real captured entries; the two
 *           standing-still arms never occur in attract, so they are gated on real states
 *           with the move command cleared and the goal latch poked set / clear. RAM-only
 *           diff over the full state dump.
 * LIVE-OUT: memory-only — the object handler each arm runs writes the frame's work, and on
 *           the standing-still path this clears the phase byte. No register live-out: the
 *           register deltas are consumed by the still-oracle handlers (they pass through
 *           here), and the caller reads no register back from this routine.
 * NAMES:    GOAL_TILE_LATCH from ram.js; the animation-phase byte 0x801a has no ram.js name
 *           yet, so it is a local constant; the three direction/phase handler addresses are
 *           still-oracle routines reached through the registry, and the goal handler loc_186f
 *           is decompiled and called directly.
 */

import { GOAL_TILE_LATCH } from "./ram.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { loc_186f } from "./loc_186f.js";

const OBJECT_PHASE = 0x801a; // the object's animation-phase byte; the phase arm reconciles it, the idle path resets it

export function loc_144c(m) {
  const { regs, mem8 } = m;

  // The object's per-frame move command; its low bits pick the action.
  const moveCommand = regs.l;

  // First-match-wins over the command's direction bits, each running one object handler.
  if (moveCommand & 0x01) return m.call(0x1493); // position the object; test the boundary
  if (moveCommand & 0x02) return m.call(0x167f); // derive the object's tile row and dispatch
  if (moveCommand & 0x0c) return m.call(0x1468); // reconcile the object's animation phase

  // No direction bit set: the object stands still this frame. Reset its animation phase.
  mem8[OBJECT_PHASE] = 0;

  // If the object has already reached the goal tile, run the goal handler; otherwise
  // defer the frame by building the object's record.
  if (mem8[GOAL_TILE_LATCH] !== 0) return loc_186f(m); // locate the cell, classify the tile under it (columnBias defaults to regs.d)
  return stageObjectSpriteRecord(m); // build the object's deferral record
}
