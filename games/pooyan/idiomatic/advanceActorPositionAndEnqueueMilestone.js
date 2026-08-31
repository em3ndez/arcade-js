// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { u8 } from "../../../core/int.js";
/**
 * advanceActorPositionAndEnqueueMilestone — the per-frame handler for an actor while it sits in
 * dispatch STATE 3.
 *
 * WHAT IT IS: one leaf of the actor state machine. Every actor lives as a fixed-size record inside
 * the actor table (ACTOR_TABLE, 0x8a80, stride 0x18). Field +0x02 of a record is its dispatch
 * index; the per-frame driver reads that index and calls the matching handler. When the index is
 * 3 it lands here. This handler does three things in order: it keeps the actor's animation
 * ticking (a two-tile flip), it slides the actor along its 16-bit travel coordinate by a fixed
 * step each frame, and it watches that coordinate for two "milestone" values — points along the
 * path where the machine must react (each fires a display command). When the actor finally travels
 * past the far limit, the handler retires state 3 by bumping the record's dispatch index so a later
 * frame runs the next state.
 *
 * ROM: 0x2a32-0x2a78. GROUNDING: [seen].
 *
 * THE RECORD FIELDS THIS HANDLER TOUCHES (all relative to the record base `rec`):
 *   +0x02  dispatch/state index — which handler the per-frame driver calls (3 == this one)
 *   +0x05  low byte of the actor's 16-bit travel coordinate (sub-position)
 *   +0x06  high byte of that coordinate (the coarse position watched for milestones)
 *   +0x0b  a free-running frame tick, used only to pace the tile flip (every 4th frame)
 *   +0x0f  the on-screen display tile code, flipped between two frames of animation
 *   +0x11  a per-record frame-delay reload cell, restamped every frame this state runs
 *
 * LIVE-OUT: none (memory only — the record fields above plus any command left in the display ring).
 * This is a dispatch handler; whatever runs after it reads the record, not a register left behind
 * here.
 */

// Value restamped into the per-record frame-delay cell (rec+0x11) every frame this state runs, so
// the shared timing machinery keeps counting from a fixed reload.
const FRAME_DELAY = 0x03;
// The two tile codes the display-tile cell (rec+0x0f) alternates between — the two frames of this
// actor's walk/flap animation.
const TILE_A = 0x15;
const TILE_B = 0x1e;
// Amount added to the coordinate's low byte (rec+0x05) each frame. Combined with the fixed +1 into
// the high byte below, the 16-bit coordinate climbs by 0x0180 per frame.
const POS_STEP_LOW = 0x80;
// The two high-byte values that mark milestones along the actor's path; reaching either enqueues
// its display command and ends the frame early.
const MILESTONE_A = 0x52;
const MILESTONE_B = 0x64;
// While the high byte is still below this the actor is mid-travel and state 3 is kept; at or past
// it the actor has arrived and the state advances.
const ADVANCE_LIMIT = 0xac;
// The two display-command words enqueued at the milestones (class 0x06, arguments 0x94 / 0x95).
// A separate consumer drains the display ring and acts on these.
const DISPLAY_CMD_A = (0x06 << 8) | 0x94;
const DISPLAY_CMD_B = (0x06 << 8) | 0x95;

export function advanceActorPositionAndEnqueueMilestone(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Restamp the per-record frame-delay cell so the timing machinery reloads from a known value,
  // then tick the record's free-running frame counter (rec+0x0b). Every fourth frame (counter
  // divisible by 4) toggle the display tile (rec+0x0f) between its two animation frames — this is
  // what makes the actor visibly animate at a quarter of the frame rate.
  mem8[rec + 0x11] = FRAME_DELAY;
  mem8[rec + 0x0b] = mem8[rec + 0x0b] + 1;
  if ((mem8[rec + 0x0b] & 0x03) === 0) {
    mem8[rec + 0x0f] = mem8[rec + 0x0f] === TILE_A ? TILE_B : TILE_A;
  }

  // Advance the actor's 16-bit travel coordinate (rec+0x05 low, rec+0x06 high). The low byte gains
  // a fixed step; storing it back into a byte cell drops any overflow, which we recover as the
  // carry. The high byte then gains that carry PLUS one more — so the coarse position always climbs
  // by at least one whole unit per frame, faster when the low byte overflows.
  const low = mem8[rec + 0x05] + POS_STEP_LOW;
  mem8[rec + 0x05] = low; // store truncates to the byte
  const carry = low > 0xff ? 1 : 0;
  const high = u8(mem8[rec + 0x06] + carry + 1);
  mem8[rec + 0x06] = high;

  // React to where the actor now sits. Hitting either milestone high-byte value enqueues that
  // milestone's display command into the ring and ends the frame immediately (the actor stays in
  // state 3). If the actor is still short of the far limit, there is nothing more to do this frame,
  // so return without touching the state. Only once it has travelled at or past the limit does the
  // handler retire state 3 by bumping the record's dispatch index (rec+0x02) to the next state.
  if (high === MILESTONE_A) { enqueueDisplayCommand(m, DISPLAY_CMD_A); return; }
  if (high === MILESTONE_B) { enqueueDisplayCommand(m, DISPLAY_CMD_B); return; }
  if (high < ADVANCE_LIMIT) return;
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1;
}
