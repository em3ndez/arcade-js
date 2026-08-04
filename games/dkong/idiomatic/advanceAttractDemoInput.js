// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceAttractDemoInput — advance the canned-input script that drives the attract-mode
 * demo.  ROM 0x21EE.
 *
 * Called once per demo frame from the attract cascade (handler_1977 `call 0x21ee`, right
 * before the shared per-frame update at 0x197A; the in-game path enters that cascade one
 * instruction later and skips this). It replays a fixed script of (input, duration) pairs
 * from a ROM table, feeding each step's input into the same cooked control word the
 * movement code normally reads from the joystick — so the demo "plays itself."
 *
 * The script is a table of 2-byte pairs in ROM; a step index selects the pair and a
 * per-step countdown holds it:
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
 * A LEAF: reads the step index and countdown (and the fixed ROM table), writes the cooked
 * control word plus the countdown and index; calls nothing and returns nothing a caller
 * consumes.
 *
 * GROUNDED (DK understanding pass 5, independent confirmer): sole reader/writer of the named
 * P1_INPUT (0x6010), DEMO_SCRIPT_INDEX (0x63CC) and DEMO_SCRIPT_COUNTDOWN (0x63CD); names.js names
 * this the sole r/w of both script cells and notes each advance coincides with a fresh P1_INPUT
 * ([seen], live). mechanisms.md documents it as the scripted-joystick attract-demo player, and
 * its caller handler_1977 enters only on the attract path.
 *
 * Memory-equivalent to the frozen oracle — equivalence-21ee.test.js.
 * GATE:     exhaustive over the entire input space — all 256×256 (step index, countdown)
 *           pairs against the fixed ROM table, covering the doubling/wrap, both the hold and
 *           advance branches, the countdown reload and the index step — plus real captured
 *           0x21EE dispatches from an attract run.
 * LIVE-OUT: memory-only (P1_INPUT, the step index, the countdown) plus the control-flow
 *           return itself. The oracle's residual registers/flags are dead: the caller falls
 *           into the 0x197A cascade, whose first act reloads before reading anything here.
 * NAMES:    P1_INPUT (0x6010), DEMO_SCRIPT_INDEX (0x63CC), DEMO_SCRIPT_COUNTDOWN (0x63CD) from
 *           names.js. The script table (0x21D1) is ROM.
 */

import { P1_INPUT, DEMO_SCRIPT_INDEX as SCRIPT_INDEX, DEMO_SCRIPT_COUNTDOWN as SCRIPT_COUNTDOWN } from "./names.js";

const SCRIPT_TABLE = 0x21d1;     // ROM: table of (input, duration) pairs; entry = base + 2*index (low byte)

// Z80 `rlca`: rotate the 8-bit value left one, bit7 wrapping into bit0 — i.e. double it
// within a byte, so the high bit re-enters at the bottom instead of carrying out.
const rotl8 = (v) => ((v << 1) | (v >> 7)) & 0xff;

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function advanceAttractDemoInput(m) {
  const { mem } = m;

  const index = mem.read8(SCRIPT_INDEX);
  // Address of this step's input byte: the index doubled, added into the table base's low
  // byte with 8-bit wrap; the high byte (the table's ROM page) never carries.
  const inputLo = (rotl8(index) + (SCRIPT_TABLE & 0xff)) & 0xff;
  const inputAddr = (SCRIPT_TABLE & 0xff00) | inputLo;

  // Issue this step's canned input into the cooked control word the movement code reads.
  mem.write8(P1_INPUT, mem.read8(inputAddr));

  // Count the step down; the PRE-decrement value decides hold vs advance.
  const remaining = mem.read8(SCRIPT_COUNTDOWN);
  mem.write8(SCRIPT_COUNTDOWN, remaining - 1);
  if (remaining !== 0) return; // still holding this step this frame

  // The step ran out: reload the countdown from the pair's duration byte (the next ROM byte)
  // and advance to the following pair.
  const durationAddr = (SCRIPT_TABLE & 0xff00) | ((inputLo + 1) & 0xff);
  mem.write8(SCRIPT_COUNTDOWN, mem.read8(durationAddr));
  mem.write8(SCRIPT_INDEX, index + 1);
}
