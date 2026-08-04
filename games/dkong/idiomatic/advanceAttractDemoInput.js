// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceAttractDemoInput — advance the canned-input script that drives the attract-mode
 * demo.
 *
 * Called once per demo frame, immediately before the shared per-frame update. The in-game
 * path enters that same cascade one instruction later, so this routine runs during the demo
 * and nowhere else. It replays a fixed script of (input, duration) pairs, feeding each step's
 * input into the same cooked control word the movement code normally reads from the joystick
 * — so the demo "plays itself."
 *
 * The script is a table of 2-byte pairs; a step index selects the pair and a per-step
 * countdown holds it:
 *
 *   - INPUT. The step index picks a pair (entry = index doubled, low byte only — the table
 *     page never carries). This step's input byte is written over the cooked control word,
 *     so the demo issues that input this frame.
 *   - HOLD or ADVANCE. The countdown is read, then decremented. Its value BEFORE the
 *     decrement decides: still non-zero means keep holding this step (the routine is done
 *     for the frame); zero means the step has run out, so reload the countdown from the
 *     pair's duration byte and step the index to the next pair. A duration of N therefore
 *     holds its input for N+1 frames (the countdown walks N..0, advancing on the 0 frame).
 *
 * Because the countdown reload happens only on the advance frame, the input byte is
 * re-issued every frame the step is held.
 *
 * A LEAF: reads the step index and countdown (and the fixed script table), writes the cooked
 * control word plus the countdown and index; calls nothing and returns nothing a caller
 * consumes.
 *
 * It is the only reader and writer of both script cells, and each advance it makes coincides
 * with a fresh value in the cooked control word — the scripted joystick that plays the demo.
 *
 * LIVE-OUT: memory-only — P1_INPUT, the step index and the countdown.
 */

import { P1_INPUT, DEMO_SCRIPT_INDEX as SCRIPT_INDEX, DEMO_SCRIPT_COUNTDOWN as SCRIPT_COUNTDOWN } from "./names.js";

const SCRIPT_TABLE = 0x21d1;     // table of (input, duration) pairs; entry = base + 2*index (low byte)

// Rotate the 8-bit value left by one, bit7 wrapping into bit0 — i.e. double it within a
// byte, so the high bit re-enters at the bottom instead of carrying out.
const rotl8 = (v) => ((v << 1) | (v >> 7)) & 0xff;

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function advanceAttractDemoInput(m) {
  const { mem } = m;

  const index = mem.read8(SCRIPT_INDEX);
  // Address of this step's input byte: the index doubled, added into the table base's low
  // byte with 8-bit wrap; the high byte (the table's own page) never carries.
  const inputLo = (rotl8(index) + (SCRIPT_TABLE & 0xff)) & 0xff;
  const inputAddr = (SCRIPT_TABLE & 0xff00) | inputLo;

  // Issue this step's canned input into the cooked control word the movement code reads.
  mem.write8(P1_INPUT, mem.read8(inputAddr));

  // Count the step down; the PRE-decrement value decides hold vs advance.
  const remaining = mem.read8(SCRIPT_COUNTDOWN);
  mem.write8(SCRIPT_COUNTDOWN, remaining - 1);
  if (remaining !== 0) return; // still holding this step this frame

  // The step ran out: reload the countdown from the pair's duration byte (the next byte in
  // the table) and advance to the following pair.
  const durationAddr = (SCRIPT_TABLE & 0xff00) | ((inputLo + 1) & 0xff);
  mem.write8(SCRIPT_COUNTDOWN, mem.read8(durationAddr));
  mem.write8(SCRIPT_INDEX, index + 1);
}
