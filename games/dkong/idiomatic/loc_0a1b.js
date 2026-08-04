// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0a1b — one step of the two-player board-setup chain.  ROM 0x0A1B.
 *
 * A GAME_SUBSTATE handler in game-state 3 (in-game): dispatched from loc_06fe's
 * rst-0x28 table at ROM 0x0702 when GAME_SUBSTATE (0x600A) == 4. It is the middle
 * step of the two-player round/board setup cascade —
 *
 *     loc_0986 (2P → 3) → sub_09fe (restore P2 context → 4) → THIS (→ 5) → loc_0a37 (→ 6)
 *
 * and does four things, then hands off by advancing the substate:
 *
 *   1. Clears both palette-bank latches to select palette bank 0 (0x7D86 <- 0,
 *      0x7D87 <- 0).
 *   2. Posts two deferred-work messages to the task ring via enqueueTask —
 *      [opcode 0x03, arg 0x03] then [opcode 0x02, arg 0x01]. Its mirror-image
 *      sibling loc_0a37 posts the analogous batch for the other player and stamps
 *      the P1 "1UP" marker; here the pair sets up the P2 side.
 *   3. Stamps player 2's "2UP" score marker into video RAM (draw2UpLabel — the
 *      unconditional fall-through tail at ROM 0x0A2E; it is exactly the P2 column
 *      sub_0315 later maintains).
 *   4. Advances GAME_SUBSTATE to 5, chaining the cascade to loc_0a37.
 *
 * NAME: kept the neutral loc_0a1b, matching its sibling loc_0a37. The mechanics are
 * fully understood, but the semantic purpose of the two posted tasks (task-handler
 * opcodes 0x03 and 0x02, indexing the ROM 0x0307 dispatch table) is not
 * independently confirmed here, so an English name would overclaim — the neutral
 * name encodes "correct, not yet fully understood," per the doc-06 naming rule.
 *
 * A LEAF over enqueueTask + draw2UpLabel: its only direct writes are the two palette
 * latches and GAME_SUBSTATE; the ring and video cells are written through the callees.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0a1b.test.js.
 * GATE:     crafted-entry — 1-player attract NEVER dispatches this (it is the
 *           two-player alternation board-setup step, and attract is 1P, so
 *           loc_0986 takes its non-2P arm). Validated on a real captured in-game
 *           2-player machine (driven by a coin+START2 input tape) with the task-ring
 *           state crafted per arm (clean write / occupied-slot DROP / wrap) and the
 *           palette bank + GAME_SUBSTATE + target video cells pre-dirtied, all
 *           poked IDENTICALLY on both sides, plus a teeth twin.
 * LIVE-OUT: memory-only — the two palette latches (IO), the task ring + tail and the
 *           three P2 video cells (via the callees), and GAME_SUBSTATE. The successor
 *           is the rst-0x28 substate dispatcher / main loop, which reads none of the
 *           registers or flags the routine leaves (the oracle's terminal A=0x05 is
 *           dead ABI). SP/pc are the dropped stack model — the oracle's per-call
 *           push/ret residue lands in STACK_SCRATCH, excluded by the contract.
 * NAMES:    GAME_SUBSTATE (0x600A) from names.js; imports enqueueTask (ROM 0x309F) and
 *           draw2UpLabel (ROM 0x09EE), the idiomatic callees. The two 0x7D8x targets
 *           are board control latches (palette bank), not work RAM, so they stay
 *           local hex constants — the same reason the optimized layer held them hex.
 */

import { GAME_SUBSTATE } from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { draw2UpLabel } from "./draw2UpLabel.js";

// ls259.6h control latches, decoded by boards/dkong/memory.js
// (case 0x7d86/0x7d87 -> io.writePaletteBank(addr-0x7d86, value&1)): the two-bit
// palette-bank select. Board hardware, not work RAM, so not in names.js. Writing 0 to
// both selects palette bank 0.
const PALETTE_BANK_LO = 0x7d86; // palette-bank bit 0
const PALETTE_BANK_HI = 0x7d87; // palette-bank bit 1

export function loc_0a1b(m) {
  const { regs, mem } = m;

  // 1. Select palette bank 0.
  mem.write8(PALETTE_BANK_LO, 0);
  mem.write8(PALETTE_BANK_HI, 0);

  // 2. Post the P2-side deferred-work pair. The message travels in the D/E pair
  //    (D = opcode, E = argument), which is enqueueTask's ABI.
  regs.d = 0x03;
  regs.e = 0x03;
  enqueueTask(m);
  regs.d = 0x02;
  regs.e = 0x01;
  enqueueTask(m);

  // 3. Stamp player 2's "2UP" score marker (the shared ROM 0x0A2E tail).
  draw2UpLabel(m);

  // 4. Advance the setup cascade: GAME_SUBSTATE 4 -> 5 (chains to loc_0a37).
  mem.write8(GAME_SUBSTATE, 0x05);
}
