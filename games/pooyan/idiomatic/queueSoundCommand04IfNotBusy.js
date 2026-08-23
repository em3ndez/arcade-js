// SPDX-License-Identifier: GPL-3.0-only
import { WAVE_TEARDOWN_STATE, GRAB_ACTIVE_FLAG } from "./names.js";
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand04IfNotBusy — conditionally enqueue the 0x04 command byte. While either the wave-teardown
 * state or the grab-active flag is non-zero the command is dropped; when both are clear it
 * hands command 0x04 to the page-0x8a ring appender.
 *
 * LIVE-OUT: A. On a busy gate A holds the gate byte just tested (AF is not restored); on the
 * append path A is the appender's advanced cursor. Set via return-assignment for a
 * register-dispatched caller; consumption is unconfirmed, so it is set on every path.
 */

const APPEND_COMMAND = 0x04;

export function queueSoundCommand04IfNotBusy(m) {
  const { mem8 } = m;

  const teardown = mem8[WAVE_TEARDOWN_STATE];
  if (teardown !== 0) return (m.regs.a = teardown); // wave-teardown busy
  const grab = mem8[GRAB_ACTIVE_FLAG];
  if (grab !== 0) return (m.regs.a = grab); // grab busy

  return appendSoundCommandGated(m, APPEND_COMMAND); // tail append
}
