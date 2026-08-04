// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedMarioActorRecord — spawn Mario's actor record at a board-dependent start,
 * advance the sub-state, and post the follow-up task.  ROM 0x123C.
 *
 * A one-shot setup step of game-state 1 (the attract demo / intro), dispatched as
 * entry 2 of the 0x0748 rst-0x28 sub-state table while GAME_SUBSTATE (0x600A) == 2.
 * It is gated by a countdown so the body fires only on the frame the gate expires:
 *
 *   - The `rst 0x18` gate (tickSubstateTimer) ticks SUBSTATE_TIMER (0x6009). While
 *     it is still counting down, the setup is skipped this frame — the Z80 caller-
 *     skip, modelled as a plain early return on the callee's `false`.
 *   - Pick Mario's start position from BOARD (0x6227): a 16-bit constant whose two
 *     bytes are two independent fields. BOARD == 3 (75m) → 0xE016 (X = 0x16, Y =
 *     0xE0); any other board → 0xF03F (X = 0x3F, Y = 0xF0). The low byte becomes
 *     Mario's X, the high byte his Y.
 *   - Seed Mario's actor record at 0x6200 (active flag, X, Y, sprite code 0x80,
 *     attribute 0x02, move-step timer 0x01) and its 4-byte hardware sprite mirror at
 *     0x694C (X, code, attr, Y), in the ROM's exact write order. Every target address
 *     is distinct, so final memory is order-independent; ROM order is kept anyway.
 *   - Advance GAME_SUBSTATE so the next NMI dispatches the following setup step.
 *   - Enqueue the follow-up task [opcode 0x06, argument 0x01].
 *
 * Callees: tickSubstateTimer (rst 0x18, 0x0018) and enqueueTask (0x309F) — both the
 * idiomatic versions, called directly. The task payload is passed in D/E, enqueueTask's
 * existing register ABI.
 *
 * Memory-equivalent to the frozen oracle — equivalence-123c.test.js.
 * GATE:     crafted-entry — 88 real attract dispatches (87 skip-arm + 1 body-arm, all
 *           BOARD == 1) + crafted body-arm entries for BOARD == 1 and the unreached
 *           BOARD == 3 (0xE016) arm + a crafted skip-arm entry. Teeth: a board-field
 *           swap and a gate-polarity inversion, both caught.
 * LIVE-OUT: memory-only — the 0x6200 actor fields, the 0x694C sprite mirror,
 *           GAME_SUBSTATE (incremented, via the gate also SUBSTATE_TIMER), and the task
 *           ring (via enqueueTask). The routine is dispatched from the rst-0x28 table
 *           inside the vblank NMI, whose tail makes no `ret cc` and reads none of its
 *           registers; the oracle's residual A/BC/DE/HL/IX and flags are dead ABI, so
 *           registers are NOT part of the contract (pc/SP model the single return the
 *           caller-skip collapses to). Confirmed against the oracle over RAM + pc + SP.
 * NAMES:    MARIO_ACTIVE (0x6200), MARIO_X (0x6203), MARIO_Y (0x6205),
 *           MARIO_SPRITE_CODE (0x6207), MARIO_SPRITE_ATTR (0x6208),
 *           MARIO_MOVE_STEP_TIMER (0x620F), MARIO_SPRITE_RECORD (0x694C),
 *           GAME_SUBSTATE (0x600A), BOARD (0x6227) — all from names.js.
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

  // rst 0x18 gate: tick SUBSTATE_TIMER (0x6009). Until it expires this frame's setup
  // is skipped (the Z80 caller-skip, now a plain early return on `false`).
  if (!tickSubstateTimer(m)) return;

  // Board-dependent start: low byte -> Mario's X, high byte -> his Y.
  //   BOARD == 3 (75m) -> 0xE016;  otherwise -> 0xF03F.
  const board3 = mem.read8(BOARD) === 0x03; // ROM `cp 0x03`; the flags it sets are dead
  const startX = board3 ? 0x16 : 0x3f; // C
  const startY = board3 ? 0xe0 : 0xf0; // B

  // Seed Mario's actor record at 0x6200 and its 4-byte sprite mirror at 0x694C, in
  // the ROM's exact write order (targets are all distinct, so order is cosmetic).
  mem.write8(MARIO_ACTIVE, 0x01);              // ld (ix+0x00),0x01   0x6200
  mem.write8(MARIO_X, startX);                 // ld (ix+0x03),c      0x6203
  mem.write8(MARIO_SPRITE_RECORD + 0, startX); // ld (hl),c           0x694C
  mem.write8(MARIO_SPRITE_CODE, 0x80);         // ld (ix+0x07),0x80   0x6207
  mem.write8(MARIO_SPRITE_RECORD + 1, 0x80);   // ld (hl),0x80        0x694D
  mem.write8(MARIO_SPRITE_ATTR, 0x02);         // ld (ix+0x08),0x02   0x6208
  mem.write8(MARIO_SPRITE_RECORD + 2, 0x02);   // ld (hl),0x02        0x694E
  mem.write8(MARIO_Y, startY);                 // ld (ix+0x05),b      0x6205
  mem.write8(MARIO_SPRITE_RECORD + 3, startY); // ld (hl),b           0x694F
  mem.write8(MARIO_MOVE_STEP_TIMER, 0x01);     // ld (ix+0x0f),0x01   0x620F

  // Advance GAME_SUBSTATE (0x600A) so the next NMI dispatches the following step.
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff); // inc (hl)

  // Enqueue the follow-up task. D = opcode, E = argument — enqueueTask's payload ABI.
  regs.d = 0x06;
  regs.e = 0x01;
  enqueueTask(m);
}
