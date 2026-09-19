// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceAttractDemoInput — advance the canned-input script that drives the attract-mode demo,
 * replaying a table of (input, duration) pairs into the cooked control word the movement code
 * reads, so the demo plays itself.
 *
 * LIVE-OUT: memory-only — P1_INPUT, the step index and the countdown.
 */

import { P1_INPUT, DEMO_SCRIPT_INDEX as SCRIPT_INDEX, DEMO_SCRIPT_COUNTDOWN as SCRIPT_COUNTDOWN, ATTRACT_SCRIPT_TABLE } from "./names.js";

// Rotate left by one within a byte — double it, bit7 re-entering at bit0 instead of carrying out.
const rotl8 = (v) => ((v << 1) | (v >> 7)) & 0xff;

export function advanceAttractDemoInput(m) {
  const { mem8 } = m;

  const index = mem8[SCRIPT_INDEX];
  // This step's input byte: index doubled, added into the table base's low byte with 8-bit wrap.
  const inputLo = (rotl8(index) + (ATTRACT_SCRIPT_TABLE & 0xff)) & 0xff;
  const inputAddr = (ATTRACT_SCRIPT_TABLE & 0xff00) | inputLo;

  mem8[P1_INPUT] = mem8[inputAddr];

  // The PRE-decrement value decides hold vs advance.
  const remaining = mem8[SCRIPT_COUNTDOWN];
  mem8[SCRIPT_COUNTDOWN] = remaining - 1;
  if (remaining !== 0) return;

  // Step ran out: reload the countdown from the pair's duration byte and advance the index.
  const durationAddr = (ATTRACT_SCRIPT_TABLE & 0xff00) | ((inputLo + 1) & 0xff);
  mem8[SCRIPT_COUNTDOWN] = mem8[durationAddr];
  mem8[SCRIPT_INDEX] = index + 1;
}
