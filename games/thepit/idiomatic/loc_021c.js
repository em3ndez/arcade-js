// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_021c — warm-restart state entry: arm game mode 3, reset the work stack, enable
 * the frame interrupt, run the blank-screen display setup, then hand off to the
 * fixed-screen painter that holds a static screen forever.  ROM 0x021c.
 *
 * Reached from the boot fork loc_01f9 when the restart flag (0x8000) is nonzero. In
 * order it:
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
 * The interrupt enable is now the idiomatic enableNmi (0x4b14), a direct JS call. Two
 * callees are still the frozen oracle, reached through the registry and each bracketed
 * with the return address it pops off the work stack — a genuine oracle boundary that
 * keeps the stack byte-identical to the original: the blank-screen display setup
 * (0x4b44) and the fixed-screen painter (0x3ba8). The painter is a tail hand-off — it
 * owns the (never-taken) return.
 *
 * Memory-equivalent to the frozen oracle — equivalence-021c.test.js.
 * GATE:     crafted-entry — never reached in a plain boot/attract run (the restart
 *           flag is zero at cold boot, 0 dispatches in 1500 frames), so the gate runs
 *           it from a real captured attract state with the never-returning painter
 *           (0x3ba8) stubbed identically on both sides, and diffs full RAM. Teeth: a
 *           wrong game-mode value, and a dropped stack reset.
 * LIVE-OUT: memory-only — the game-mode cell set to 3, plus the interrupt-enable and
 *           display-setup writes; the stack reset lands the callee return addresses at
 *           the top of work RAM. Nothing reads a register back (the routine exits into
 *           a forever loop and the caller's frame was discarded).
 * NAMES:    GAME_MODE (0x8001) from ram.js. The interrupt-mask port (0xb000) is
 *           hardware, not work RAM, and stays inside enableNmi.
 */

import { enableNmi } from "./enableNmi.js";
import { GAME_MODE } from "./ram.js";

export function loc_021c(m) {
  const { mem8, regs } = m;

  // Arm game mode 3.
  mem8[GAME_MODE] = 3;

  // Hard restart: drop the stack to the top of work RAM, discarding the caller's
  // return frame. Every callee below pushes and pops relative to this fresh top, so
  // resetting it here is what lands their return addresses where the original does.
  regs.sp = 0x83ff;

  // Enable the frame interrupt.
  enableNmi(m);

  // Run the blank-screen display setup — clear the screen and seed the board-mode
  // fills (still oracle; returns through the work stack).
  m.push16(0x022a);
  m.call(0x4b44);

  // Tail hand-off to the fixed-screen painter: it paints a canned screen and holds it
  // forever, so this is the routine's exit and it never returns.
  return m.call(0x3ba8);
}
