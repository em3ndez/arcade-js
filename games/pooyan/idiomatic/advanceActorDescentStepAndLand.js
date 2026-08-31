// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { tickPhaseTimerAndMaybeRunResetScan } from "./tickPhaseTimerAndMaybeRunResetScan.js";
import { advanceRisingActorStep } from "./advanceRisingActorStep.js";
import { advanceLeadActorDescentToLanding } from "./advanceLeadActorDescentToLanding.js";
import {
  FORMATION_SPAWN_TIMER,
  FIELD_ATTRIB_SRC_B,
  FIELD_ATTRIB_SRC_C,
  FIELD_ATTRIB_REF_2980,
  DESCENT_STATE_COMPLETE_DISPLAY_CMD,
  loc_8343,
} from "./names.js";
/**
 * advanceActorDescentStepAndLand -- descent state handler for an actor record.
 *
 * WHAT IT IS
 *   The per-frame handler for actor state 1, the "descent" phase of the 0x8a80 actor
 *   state machine. An actor record is a stride-0x18 block based at IX; its state index
 *   lives at (IX+0x02) -- for the lead actor in slot 0 that is LEAD_ACTOR_STATE (0x8a82) --
 *   and a small dispatch table picks this routine as the state-1 entry. While the actor
 *   sits in state 1 it eases downward one step per frame, flapping its display tile
 *   between two shapes, until it reaches its landing row. On that frame it arms the next
 *   formation spawn, advances into the following state, and (on an intact program image)
 *   queues the display command that repaints the landed actor.
 *
 * ROLE IN THE MACHINE
 *   This is the "actor drops into position and lands" beat. Each frame the actor's descent
 *   counter (IX+0x06) is walked down toward a fixed floor, and the render tile alternates
 *   so the actor visibly animates on the way. The frame the counter crosses the floor is
 *   the landing frame: the handler reseeds the formation-spawn timer so the next wave can
 *   be scheduled, bumps the actor into its next state, and enqueues a repaint command.
 *   Two ROM integrity self-checks guard that landing frame -- if the checked attribute
 *   tables have been altered, the handler diverts into a different state handler instead
 *   of completing normally.
 *
 * ROM: 0x29a0-0x2a00.
 * Grounding: [seen].
 *
 * WHAT IT LEAVES IN MEMORY
 *   In the actor record at IX every frame: the frame-hold timer (IX+0x11), the animation
 *   tick (IX+0x0b), the display tile (IX+0x0f), and the descent counter (IX+0x06). On the
 *   landing frame it also bumps the state index (IX+0x02), reseeds FORMATION_SPAWN_TIMER
 *   (0x8d30), and may enqueue DESCENT_STATE_COMPLETE_DISPLAY_CMD (0x0614) into the display
 *   ring. It has no return value of its own; when the gate byte or an integrity self-check
 *   diverts, it hands control to another state handler and that handler's result stands in
 *   for this one's.
 */

const FRAME_HOLD = 0x11; //    record offsets: display-hold timer (frames to hold the current tile)
const ANIM_TICK = 0x0b; //     free-running per-frame animation tick
const DISPLAY_TILE = 0x0f; //  current display tile/shape code
const DESCENT_COUNTER = 0x06; // descent position counter, walked toward the floor
const STATE_FIELD = 0x02; //   actor state index (dispatch selector; LEAD_ACTOR_STATE for slot 0)

const FRAME_HOLD_SHORT = 0x03; // reseed on the common (still-descending) path -- brisk animation
const FRAME_HOLD_LONG = 0x18; //  reseed once the floor is reached -- hold the landed pose longer
const TICK_MASK = 0x03; //        toggle the tile every fourth frame (low two bits zero)
const TILE_A = 0x15; //           the two display-tile shapes the descent flaps between
const TILE_B = 0x1e;
const DESCENT_STEP = 0x02; //     counter drops by this each frame
const DESCENT_FLOOR = 0x2c; //    at/above this the actor is still descending -> just return
const SPAWN_TIMER_BASE = 0x30; // formation-spawn-timer reseed base (gate byte is 0 on this path)
const CKSUM_LEN = 0x20; //        bytes in each ROM integrity self-check block
const CKSUM_TARGET = 0x37; //     valid running sum of the first (0x0879) block on an intact ROM

export function advanceActorDescentStepAndLand(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Per-frame animation. Reseat the record's display-hold timer (IX+0x11) to its short
  // value so state 1 holds each frame only briefly and the descent reads as motion. Then
  // bump the animation tick (IX+0x0b) and, on every fourth frame (low two bits zero), flip
  // the display tile (IX+0x0f) between its two shapes (0x15 <-> 0x1e) -- the two-frame flap.
  mem8[rec + FRAME_HOLD] = FRAME_HOLD_SHORT;
  mem8[rec + ANIM_TICK] = mem8[rec + ANIM_TICK] + 1;
  if ((mem8[rec + ANIM_TICK] & TICK_MASK) === 0) {
    mem8[rec + DISPLAY_TILE] = mem8[rec + DISPLAY_TILE] === TILE_A ? TILE_B : TILE_A;
  }

  // Descent step. Walk the descent counter (IX+0x06) down by two each frame. While it is
  // still at or above the floor (0x2c) the actor is mid-descent, so leave the record as-is
  // and return -- everything below is the landing sequence, reached only once the counter
  // drops below the floor.
  const counter = u8(mem8[rec + DESCENT_COUNTER] - DESCENT_STEP);
  mem8[rec + DESCENT_COUNTER] = counter;
  if (counter >= DESCENT_FLOOR) return; // still descending

  // Landing frame reached. The gate byte at 0x8343 diverts the landing: when it is nonzero
  // the handler runs the phase-timer tick / reset-scan path instead and returns that result,
  // skipping the spawn-arm and integrity checks below.
  if (mem8[loc_8343] !== 0) return tickPhaseTimerAndMaybeRunResetScan(m); // gate set -> countdown/redirect

  // Normal landing path (gate byte is zero). Reseed the formation-spawn countdown
  // FORMATION_SPAWN_TIMER (0x8d30) to base 0x30 (adding the zero gate byte) so the next
  // enemy formation is scheduled; stretch the display-hold (IX+0x11) to its long value for
  // the landed pose; then advance the actor's state index (IX+0x02) to the next state.
  mem8[FORMATION_SPAWN_TIMER] = mem8[loc_8343] + SPAWN_TIMER_BASE; // gate byte is 0 -> base
  mem8[rec + FRAME_HOLD] = FRAME_HOLD_LONG;
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1; // advance the record state

  // First ROM integrity self-check. Sum the 0x20-byte attribute-column source table at ROM
  // 0x0879 (FIELD_ATTRIB_SRC_B); an intact table totals 0x37. A different total means the
  // program image has been altered, so the handler diverts into the rising-actor step
  // handler and returns its result rather than completing the landing.
  let sum = 0;
  for (let i = 0; i < CKSUM_LEN; i++) sum = u8(sum + mem8[FIELD_ATTRIB_SRC_B + i]);
  if (sum !== CKSUM_TARGET) return advanceRisingActorStep(m, rec); // sum miss -> state-6 handler

  // Second ROM integrity self-check. Byte-compare the 0x20-byte attribute-column table at
  // ROM 0x0859 (FIELD_ATTRIB_SRC_C) against its reference copy at ROM 0x2980
  // (FIELD_ATTRIB_REF_2980). Any mismatch means a tampered image, so the handler diverts
  // into the state-0 lead-actor handler and returns its result.
  for (let i = 0; i < CKSUM_LEN; i++) {
    if (mem8[FIELD_ATTRIB_REF_2980 + i] !== mem8[FIELD_ATTRIB_SRC_C + i]) return advanceLeadActorDescentToLanding(m, rec);
  }

  // Both self-checks passed: the landing is complete. Enqueue the descent-complete display
  // command (0x0614) into the display ring, which repaints the landed actor.
  enqueueDisplayCommand(m, DESCENT_STATE_COMPLETE_DISPLAY_CMD); // clean check -> enqueue the descent display command
}
