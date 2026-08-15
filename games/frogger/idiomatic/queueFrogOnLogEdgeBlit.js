// SPDX-License-Identifier: GPL-3.0-only
/**
 * queueFrogOnLogEdgeBlit — enqueue the frog-on-log edge blit command via the sound/tile-command ring.
 * Bails unless the game is in play, the phase index is in range, and the busy gate is clear.
 * LIVE-OUT: memory-only (the command ring the enqueue writes).
 */
import { PLAY_FLAG, loc_81a2, loc_8140 } from "./names.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

const PHASE_HI = 0x0f;         // phase must be below this ...
const PHASE_LO = 0x02;         // ... and at or above this
const BLIT_CMD = 0xd0;

export function queueFrogOnLogEdgeBlit(m) {
  const { regs, mem8 } = m;
  if (mem8[PLAY_FLAG] === 0) return;

  const phase = mem8[loc_81a2];
  if (phase >= PHASE_HI || phase < PHASE_LO) return;
  if (mem8[loc_8140] !== 0) return;

  regs.a = BLIT_CMD;
  enqueueSoundCommand(m);
}
