// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceObjectAndQueueMessageColumn -- object-AI state 14: a dwell-then-emit message-column tick.
 *
 * WHAT IT IS
 *   One handler in the sixteen-entry object-AI state table (the driveObjectSlot dispatch table at ROM
 *   0x0ce6, selected by an object record's state index at byte ix+2). This is the state-14 slot: the
 *   message-column emitter that the attract-mode / bonus text uses. Each frame it advances the object's
 *   own free-running tick and counts its dwell timer down; while the timer still runs it does nothing more.
 *
 * ROLE IN THE MACHINE
 *   When the dwell timer reaches zero the handler emits one command word on channel 6, carrying the
 *   object's payload selector (ix+7) biased by 75 as the command parameter. That word is dispatched
 *   downstream to renderMessageColumn (ROM 0x22f1), which paints the next column of the scrolling
 *   message; the handler then bumps the object's state index so the machine moves on to the next state.
 *   The +75 bias maps the raw selector byte into the parameter range renderMessageColumn expects.
 *
 * ROM 0x10c2.  Grounding: [seen] (write-tap confirmed through the object-AI dispatch/consumer chain).
 *
 * LIVE-OUT: object record cells -- tick ix+4, dwell timer ix+16, state index ix+2 -- and the command-word
 * queue written through enqueueCommandWord.
 */
import { enqueueCommandWord } from "./enqueueCommandWord.js";

const OBJ_STATE = 2;     // dispatch state index
const OBJ_TICK = 4;      // free-running tick counter
const OBJ_SELECTOR = 7;  // payload selector byte
const OBJ_TIMER = 16;    // dwell countdown

const CMD_CHANNEL = 6;   // command-word channel
const PAYLOAD_BIAS = 75; // maps the selector into the command param

export function advanceObjectAndQueueMessageColumn(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Advance this object's own free-running tick counter (ix+4) once per frame.
  mem8[obj + OBJ_TICK]++;
  // Count the dwell timer (ix+16) down by one. The byte store truncates, so a 0 timer wraps to 255.
  mem8[obj + OBJ_TIMER] = mem8[obj + OBJ_TIMER] - 1; // store truncates: a 0 timer wraps to 255
  // While the dwell is still running (non-zero) hold in this state and emit nothing this frame.
  if (mem8[obj + OBJ_TIMER] !== 0) return; // timer still running

  // Dwell elapsed: build the channel-6 command parameter from the payload selector (ix+7) plus the bias.
  const param = (mem8[obj + OBJ_SELECTOR] + PAYLOAD_BIAS) & 0xff;
  // Enqueue the packed command word (channel in the high byte, param in the low) for renderMessageColumn.
  enqueueCommandWord(m, (CMD_CHANNEL << 8) | param);
  // Advance the object's dispatch state (ix+2) so next frame runs the following state handler.
  mem8[obj + OBJ_STATE]++;
}
