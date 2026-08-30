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
 * loc_1042 — rebuild the lead actor's (slot 0) control byte from the input port each frame.
 *
 * Always arms the launch flag. If slot 0 is inactive or a global pause/teardown is set, it
 * clears the control byte and returns. Otherwise it reads the input port selected by screen
 * orientation, stores its complement, and — when the actor has no live sub-timer — also clears
 * bit 4 of that byte.
 *
 * LIVE-OUT: memory only — the launch flag and the slot-0 control byte. No register output.
 */

const ACTOR_STATE = 0x02; //    actor record: state byte
const ACTOR_CONTROL = 0x07; //  actor record: control/input byte
const ACTOR_SUBTIMER = 0x1e; // actor record: sub-timer
const CONTROL_BIT4 = 0x10; //   bit 4 of the control byte

export function loc_1042(m) {
  const { mem8 } = m;
  mem8[LAUNCH_ARMED_FLAG] = 1;

  // Inactive slot, or a global pause/teardown -> clear the control byte and return.
  if (
    mem8[ACTOR_TABLE + ACTOR_STATE] !== 0 ||
    (mem8[WAVE_TEARDOWN_STATE] | mem8[SECONDARY_TEARDOWN_FLAG]) !== 0
  ) {
    mem8[ACTOR_TABLE + ACTOR_CONTROL] = 0;
    return;
  }

  // Select the input port by screen orientation, store its complement.
  const port = mem8[FLIP_SCREEN_FLAG] !== 0 ? IN1_PORT : IN2_PORT;
  let control = ~mem8[port] & 0xff;

  // With no live sub-timer, also clear bit 4 of the control byte.
  if (mem8[ACTOR_TABLE + ACTOR_SUBTIMER] === 0) control &= ~CONTROL_BIT4;

  mem8[ACTOR_TABLE + ACTOR_CONTROL] = control;
}
