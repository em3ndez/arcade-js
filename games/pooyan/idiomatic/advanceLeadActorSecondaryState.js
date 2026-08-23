// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  ROUND_COUNTER,
  PLAY_STATE_INDEX,
  FORMATION_STATE,
  ACTOR_TABLE,
  LEAD_ACTOR_STATE,
  ACTOR_SECONDARY_STATE_DISPATCH,
  SPAWN_FORMATION_EPILOGUE_ADDR,
} from "./names.js";
import { loc_2101 } from "./loc_2101.js";
/**
 * advanceLeadActorSecondaryState — per-frame driver for the lead actor's secondary state machine.
 *
 * Runs the frontier sub-dispatch, then steers the play sub-state: an even round forces sub-state 6,
 * a busy formation forces 4. Otherwise it seats the shared spawn/formation epilogue, ticks the
 * actor's frame delay, and while the delay runs transfers straight there; on expiry it dispatches
 * the actor's state (low three bits) through the shared spine into the secondary-state handler table.
 * The handler and the delay-ret both land the epilogue downstream of this driver, not inside it.
 *
 * LIVE-OUT: none — record base and dispatch index are register-bridged into the frozen spine.
 */
const FRAME_DELAY = 0x11; // actor-record frame-delay offset
const STATE_MASK = 0x07; // three-bit secondary-state index

export function advanceLeadActorSecondaryState(m) {
  const { mem8 } = m;
  loc_2101(m);
  if ((mem8[ROUND_COUNTER] & 1) === 0) { mem8[PLAY_STATE_INDEX] = 0x06; return; }
  if (mem8[FORMATION_STATE] !== 0) { mem8[PLAY_STATE_INDEX] = 0x04; return; }

  m.regs.ix = ACTOR_TABLE; // record base the epilogue + dispatched handler read (register bridge)
  m.push16(SPAWN_FORMATION_EPILOGUE_ADDR); // transfer target: handler/ret lands the epilogue downstream
  mem8[ACTOR_TABLE + FRAME_DELAY] = u8(mem8[ACTOR_TABLE + FRAME_DELAY] - 1);
  if (mem8[ACTOR_TABLE + FRAME_DELAY] !== 0) return m.ret(); // delay still running -> transfer to epilogue

  m.regs.a = mem8[LEAD_ACTOR_STATE] & STATE_MASK; // dispatch index (register bridge)
  m.push16(ACTOR_SECONDARY_STATE_DISPATCH); // inline jump-table base
  return m.call(0x0028); // rst-0x28 spine dispatcher (unlifted) -> handler -> transfer to epilogue
}
