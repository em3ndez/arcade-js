// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedMarioActorRecord — spawn Mario's actor record at a board-dependent start,
 * advance the sub-state, and post the follow-up task.
 *
 * A one-shot setup step of game-state 1 (the attract demo / intro), dispatched while
 * GAME_SUBSTATE is 2. It is gated by a countdown so the body fires only on the frame the
 * gate expires:
 *
 *   - The sub-state timer tick is the gate. While the timer is still counting down, the
 *     setup is skipped this frame — the hardware's caller-skip, modelled here as a plain
 *     early return when the tick reports `false`.
 *   - Pick Mario's start position from BOARD. On 75m (BOARD == 3) he starts at X = 0x16,
 *     Y = 0xE0; on any other board at X = 0x3F, Y = 0xF0.
 *   - Seed Mario's actor record (active flag, X, Y, sprite code 0x80, attribute 0x02,
 *     move-step timer 0x01) and its 4-byte hardware sprite mirror (X, code, attr, Y).
 *     Every target address is distinct, so the final memory is order-independent.
 *   - Advance GAME_SUBSTATE so the next vblank dispatches the following setup step.
 *   - Enqueue the follow-up task [opcode 0x06, argument 0x01], whose payload goes in D/E.
 *
 * LIVE-OUT: memory-only — Mario's actor fields, his sprite mirror, GAME_SUBSTATE
 * (incremented) and SUBSTATE_TIMER (via the gate), and the task ring.
 */

import {
  BOARD, GAME_SUBSTATE,
  MARIO_ACTIVE, MARIO_X, MARIO_Y, MARIO_SPRITE_CODE, MARIO_SPRITE_ATTR,
  MARIO_MOVE_STEP_TIMER, MARIO_SPRITE_RECORD,
} from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { enqueueTask } from "./enqueueTask.js";

export function seedMarioActorRecord(m) {
  const { regs, mem } = m;

  // The gate: tick SUBSTATE_TIMER. Until it expires this frame's setup is skipped
  // (the hardware caller-skip, here a plain early return on `false`).
  if (!tickSubstateTimer(m)) return;

  // Board-dependent start position.
  const board3 = mem.read8(BOARD) === 0x03; // 75m
  const startX = board3 ? 0x16 : 0x3f;
  const startY = board3 ? 0xe0 : 0xf0;

  // Seed Mario's actor record and its 4-byte sprite mirror (targets are all distinct,
  // so the order below is cosmetic).
  mem.write8(MARIO_ACTIVE, 0x01);
  mem.write8(MARIO_X, startX);
  mem.write8(MARIO_SPRITE_RECORD + 0, startX);
  mem.write8(MARIO_SPRITE_CODE, 0x80);
  mem.write8(MARIO_SPRITE_RECORD + 1, 0x80);
  mem.write8(MARIO_SPRITE_ATTR, 0x02);
  mem.write8(MARIO_SPRITE_RECORD + 2, 0x02);
  mem.write8(MARIO_Y, startY);
  mem.write8(MARIO_SPRITE_RECORD + 3, startY);
  mem.write8(MARIO_MOVE_STEP_TIMER, 0x01);

  // Advance GAME_SUBSTATE so the next vblank dispatches the following step.
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);

  // Enqueue the follow-up task. D = opcode, E = argument.
  regs.d = 0x06;
  regs.e = 0x01;
  enqueueTask(m);
}
