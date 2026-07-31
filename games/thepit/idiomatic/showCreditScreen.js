// SPDX-License-Identifier: GPL-3.0-only
/**
 * showCreditScreen — warm-restart state entry: arm game mode 3, reset the work stack, enable
 * the frame interrupt, run the blank-screen display setup, then hand off to the
 * fixed-screen painter that holds a static screen forever.  ROM 0x021c.
 *
 * Reached from the boot fork rearmMachineAndBranchOnCredits when the credit count (CREDIT_COUNT) is nonzero
 * (credits present). In order it:
 *   1. Arms the game-mode cell to 3.
 *   2. Resets the stack pointer to the top of work RAM — a hard restart that discards
 *      the caller's return frame, so this routine never returns to its caller.
 *   3. Enables the frame (vblank) interrupt.
 *   4. Runs the display-mode-0 setup (blank the screen, seed the board-mode fills).
 *   5. Tail-hands to the fixed-screen painter, which paints a canned screen and then
 *      spins forever displaying it — control never comes back.
 *
 * What game-mode 3 and the held screen mean is not pinned, so the name stays neutral;
 * the sequence above is exactly what the code does.
 *
 * The interrupt enable is now the idiomatic enableNmi (0x4b14), the blank-screen display
 * setup is the idiomatic blankScreen (0x4b44), and the fixed-screen painter is the idiomatic
 * holdFixedScreen (0x3ba8) — all direct JS calls, none left as an oracle boundary. The
 * painter is a tail hand-off: it paints a canned screen and then spins forever displaying
 * it, so it owns the (never-taken) return.
 *
 * Memory-equivalent to the frozen oracle — equivalence-021c.test.js.
 * GATE:     crafted-entry — never reached in a plain boot/attract run (the restart
 *           flag is zero at cold boot, 0 dispatches in 1500 frames), so the gate runs
 *           it from a real captured attract state. The painter never returns (it spins
 *           forever on the display loop), so both arms run the real painter under the
 *           SAME bounded frame-tick hook (drain the per-frame countdown; throw after a
 *           fixed number of watchdog reads — the harness holdFixedScreen's own gate
 *           uses), stopping at the identical point, and diff RAM outside the dead stack
 *           scratch. Teeth: a wrong game-mode value, and a dropped stack reset.
 * LIVE-OUT: memory-only — the game-mode cell set to 3, plus the interrupt-enable and
 *           display-setup writes; the stack reset lands the callee return addresses at
 *           the top of work RAM. Nothing reads a register back (the routine exits into
 *           a forever loop and the caller's frame was discarded).
 * NAMES:    GAME_STATE (0x8001) from ram.js. The interrupt-mask port (0xb000) is
 *           hardware, not work RAM, and stays inside enableNmi.
 */

import { enableNmi } from "./enableNmi.js";
import { blankScreen } from "./blankScreen.js";
import { holdFixedScreen } from "./holdFixedScreen.js";
import { GAME_STATE, STACK_TOP } from "./ram.js";

export function* showCreditScreen(m) {
  const { mem8, regs } = m;

  // Arm game mode 3.
  mem8[GAME_STATE] = 3;

  // Hard restart: drop the stack to the top of work RAM, discarding the caller's
  // return frame. Every callee below pushes and pops relative to this fresh top, so
  // resetting it here is what lands their return addresses where the original does.
  regs.sp = STACK_TOP;

  // Enable the frame interrupt.
  enableNmi(m);

  // Run the blank-screen display setup — clear the screen and seed the board-mode fills.
  blankScreen(m);

  // Tail hand-off to the fixed-screen painter: it paints a canned screen and holds it
  // forever, so this is the routine's exit and it never returns.
  return yield* holdFixedScreen(m);
}
