// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0a1b — one step of the two-player board-setup chain.
 *
 * An in-game sub-state handler, dispatched once the sub-state selector reaches 4. It is the
 * middle step of the two-player round/board setup cascade: the two-player entry advances the
 * selector to 3, a P2-context restore step advances it to 4, THIS routine advances it to 5,
 * and a mirror-image sibling then advances it to 6. Four things happen here before the
 * hand-off:
 *
 *   1. Clear both palette-bank latches, selecting palette bank 0.
 *   2. Post two deferred-work messages to the task ring — [opcode 0x03, arg 0x03] then
 *      [opcode 0x02, arg 0x01]. The mirror-image sibling posts the analogous batch for the
 *      other player and stamps the P1 "1UP" marker; this pair sets up the P2 side.
 *   3. Stamp player 2's "2UP" score marker into video RAM — the same P2 column the score
 *      display later maintains.
 *   4. Advance the sub-state selector to 5, chaining the cascade on.
 *
 * NAME: kept neutral. The mechanics are fully understood, but the semantic purpose of the two
 * posted tasks — task-handler opcodes 0x03 and 0x02 — is not independently confirmed, so an
 * English name would overclaim.
 *
 * A LEAF over its two callees: its only direct writes are the two palette latches and
 * GAME_SUBSTATE; the ring and the video cells are written through them.
 *
 * LIVE-OUT: memory-only — the two palette latches (board outputs), the task ring and its
 * tail, the three P2 video cells, and GAME_SUBSTATE.
 */

import { GAME_SUBSTATE } from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { draw2UpLabel } from "./draw2UpLabel.js";

// The two-bit palette-bank select: board control latches, not work RAM. Writing 0 to both
// selects palette bank 0.
const PALETTE_BANK_LO = 0x7d86; // palette-bank bit 0
const PALETTE_BANK_HI = 0x7d87; // palette-bank bit 1

export function loc_0a1b(m) {
  const { regs, mem } = m;

  // 1. Select palette bank 0.
  mem.write8(PALETTE_BANK_LO, 0);
  mem.write8(PALETTE_BANK_HI, 0);

  // 2. Post the P2-side deferred-work pair. Each message travels as an (opcode,
  //    argument) register pair, which is the task-ring primitive's calling convention.
  regs.d = 0x03;
  regs.e = 0x03;
  enqueueTask(m);
  regs.d = 0x02;
  regs.e = 0x01;
  enqueueTask(m);

  // 3. Stamp player 2's "2UP" score marker.
  draw2UpLabel(m);

  // 4. Advance the setup cascade: GAME_SUBSTATE 4 -> 5, chaining to the next step.
  mem.write8(GAME_SUBSTATE, 0x05);
}
