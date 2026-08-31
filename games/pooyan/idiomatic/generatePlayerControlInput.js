// SPDX-License-Identifier: GPL-3.0-only
import {
  LAUNCH_ARMED_FLAG,
  ACTOR_TABLE,
  WAVE_TEARDOWN_STATE,
  SECONDARY_TEARDOWN_FLAG,
  FLIP_SCREEN_FLAG,
  IN1_PORT,
  IN2_PORT,
} from "./names.js";

/**
 * generatePlayerControlInput — sample the player's controls into the lead actor's control byte, once per frame.
 * ROM 0x1042-0x107c.  Grounding: [seen].
 *
 * The lead actor is slot 0 of the actor table (ACTOR_TABLE, 0x8a80) — the player-controlled
 * hunter. Every frame the machine has to translate the raw hardware input lines into the one
 * byte, ACTOR_TABLE+0x07, that the rest of the actor code reads as "what is the player asking
 * for this frame". This routine is that translation, and it is the sole writer of that byte for
 * the live-play case.
 *
 * The shape is: unconditionally re-arm the per-frame launch latch (LAUNCH_ARMED_FLAG, 0x8f3f),
 * then decide whether the player is even allowed to steer this frame. Two conditions veto input
 * — the slot is not in its live/running state, or the machine is in a global pause/teardown —
 * and either one zeroes the control byte (a released, all-clear input) and returns. When neither
 * vetoes, the routine reads the physical input port, stores its ONE'S COMPLEMENT (the cabinet
 * wiring is active-low: a pressed switch pulls its line to 0, so complementing turns "pressed"
 * into a 1 bit), and finally masks off bit 4 whenever the actor is between shots.
 *
 * Bit 4 (CONTROL_BIT4, 0x10) is the fire/launch request. Gating it on the sub-timer
 * (ACTOR_TABLE+0x1e) being zero enforces the between-shots cooldown at the input layer: while a
 * shot's timer is still counting the launch bit is allowed through, and only once the timer has
 * drained to zero is a fresh fire suppressed here — the launch arming for the next shot is owned
 * by LAUNCH_ARMED_FLAG and the shot machinery, not by re-reading the trigger every frame.
 *
 * The input port is chosen by screen orientation: on a flipped (cocktail second-player) screen
 * the controls are read from IN1_PORT (0xa0a0), otherwise from IN2_PORT (0xa0c0) — the cabinet
 * routes the two players' panels to different ports and FLIP_SCREEN_FLAG (0x881f) tracks which
 * way the image is currently drawn.
 *
 * A pure leaf: it calls nothing.
 *
 * LIVE-OUT: memory only — LAUNCH_ARMED_FLAG re-armed, and the slot-0 control byte
 * (ACTOR_TABLE+0x07) rebuilt (or cleared). No register is read back by any caller.
 */

const ACTOR_STATE = 0x02; //    actor record: state byte
const ACTOR_CONTROL = 0x07; //  actor record: control/input byte
const ACTOR_SUBTIMER = 0x1e; // actor record: sub-timer
const CONTROL_BIT4 = 0x10; //   bit 4 of the control byte

export function generatePlayerControlInput(m) {
  const { mem8 } = m;

  // Re-arm the launch latch every frame, before any veto. The shot machinery consumes and
  // clears LAUNCH_ARMED_FLAG (0x8f3f) when it fires; setting it back to 1 here is what makes a
  // fresh launch possible on the next eligible frame.
  mem8[LAUNCH_ARMED_FLAG] = 1;

  // Veto the input this frame if the player slot is not live, OR the machine is paused/tearing
  // down a wave. Slot liveness is ACTOR_TABLE+0x02 (the state byte) being 0; the global stop is
  // WAVE_TEARDOWN_STATE (0x8f24) OR SECONDARY_TEARDOWN_FLAG (0x8f57) being nonzero. Either way,
  // stamp a released/all-clear control byte (0) and leave — the player cannot steer.
  if (
    mem8[ACTOR_TABLE + ACTOR_STATE] !== 0 ||
    (mem8[WAVE_TEARDOWN_STATE] | mem8[SECONDARY_TEARDOWN_FLAG]) !== 0
  ) {
    mem8[ACTOR_TABLE + ACTOR_CONTROL] = 0;
    return;
  }

  // Read the physical control panel and normalise it. The cabinet input is active-low, so the
  // raw port has 0 bits where switches are pressed; the one's complement flips that into the
  // "1 = requested" convention the actor code expects. FLIP_SCREEN_FLAG (0x881f) picks which
  // player's panel we are: IN1_PORT (0xa0a0) on a flipped screen, IN2_PORT (0xa0c0) otherwise.
  const port = mem8[FLIP_SCREEN_FLAG] !== 0 ? IN1_PORT : IN2_PORT;
  let control = ~mem8[port] & 0xff;

  // Enforce the between-shots cooldown on the fire request. When the actor's sub-timer
  // (ACTOR_TABLE+0x1e) has drained to 0 the previous shot is fully done, so we suppress the
  // launch bit (bit 4) here; while the timer still runs the bit passes through untouched.
  if (mem8[ACTOR_TABLE + ACTOR_SUBTIMER] === 0) control &= ~CONTROL_BIT4;

  // Commit the assembled request as the lead actor's control byte for this frame.
  mem8[ACTOR_TABLE + ACTOR_CONTROL] = control;
}
