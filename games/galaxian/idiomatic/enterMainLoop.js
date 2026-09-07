// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterMainLoop -- main-loop entry: wipe the score/HUD scratch, then hand off to the per-frame generator.
 *
 * WHAT IT IS
 *   The one-time setup at the head of the free-running main loop. It clears the 30-byte score/HUD scratch
 *   block, then transfers control to mainLoop, the generator that does the per-frame foreground work from
 *   here on (the vblank interrupt is the separate heartbeat).
 *
 * ROLE IN THE MACHINE
 *   The block cleared runs from PLAYER1_SCORE_BCD (0x40a2) for 0x1e = 30 bytes, i.e. 0x40a2-0x40bf. That
 *   span holds the two players' packed-BCD scores and the surrounding HUD scratch, and it ends exactly at
 *   0x40c0, the floor of the command-queue ring above it -- so the wipe zeroes the score area without
 *   touching the queue body. After the wipe there is no return; control passes to mainLoop for good.
 *
 * ROM 0x2000.  Grounding: [seen]. Cell: PLAYER1_SCORE_BCD (0x40a2), base of the cleared scratch block.
 *
 * LIVE-OUT: mem8[0x40a2..0x40bf] all zero; then whatever mainLoop yields (this call does not return).
 */
import { PLAYER1_SCORE_BCD } from "./names.js";
import { mainLoop } from "./mainLoop.js";

export function enterMainLoop(m) {
  const { mem8 } = m;
  // Zero the 30-byte score/HUD scratch (0x40a2-0x40bf), stopping right at the command-queue floor 0x40c0.
  for (let i = 0; i < 0x1e; i++) mem8[PLAYER1_SCORE_BCD + i] = 0; // clear the 30-byte scratch block
  // Hand control to the free-running per-frame main-loop generator; there is no return here.
  return mainLoop(m); // hand off to the per-frame generator
}
