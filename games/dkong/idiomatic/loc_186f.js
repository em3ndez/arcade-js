// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_186f — one timer-gated step of the board-advance render sequence: stage a
 * sprite-object frame, pulse a sound latch, advance the step.  ROM 0x186f.
 *
 * A step handler in the board-cleared / advance interlude (GAME_SUBSTATE 0x600A == 0x16),
 * the even-board (BOARD bit0 clear → 50m / 100m, table at 0x1648) sibling of loc_1670.
 * loc_1615 dispatches this family through the 0x6388 step selector; this is the step whose
 * table entry is 0x186f. Every sibling has the same shape — hold a pose for a run of frames,
 * then on expiry swap in the next sprite-object animation frame and advance the step — and
 * this is the leanest of them: no per-board rst-0x30 / rst-0x38 tail, and it does not re-arm
 * the pose timer, so the `inc` of the step selector is what carries the sequence onward.
 *
 * On each frame:
 *   - rst 0x18 (tickSubstateTimer) ticks SUBSTATE_TIMER (0x6009). While it counts down the
 *     routine only decrements and returns — the pose is held. On the single expiry frame:
 *   - Copy this step's 40-byte (10-record × 4) sprite-object frame from the ROM table at
 *     0x3A1F into SPRITE_OBJ_BLOCK (loadSpriteObjectBlock; HL = the copy source).
 *   - Arm sound latch SND_TRIGGER[4] (0x6084) to 3 — the standard 3-frame assert that
 *     sub_00e0 walks down over the next three vblanks.
 *   - Advance the render-sequence step selector 0x6388 (`inc (hl)`), so the next NMI
 *     dispatches the following step.
 *
 * Reached via dispatchGameState's rst-0x28 tail, which discards this handler's return, so
 * nothing downstream reads a register or flag it leaves.
 * NAME: kept as loc_186f — the mechanics are understood but the exact visual the animation
 * depicts is not independently confirmed, and the whole sibling family stayed address-named.
 *
 * CALLEES (both landed idiomatic leaves, called directly — no stack modelling):
 * tickSubstateTimer (0x0018), loadSpriteObjectBlock (0x004e).
 *
 * Memory-equivalent to the frozen oracle — equivalence-186f.test.js.
 * GATE:     crafted-entry — attract never reaches GAME_SUBSTATE 0x16 (it does not complete a
 *           board), so 0x186f dispatches 0 times; validated on real booted-attract state with
 *           surgical pokes: EXHAUSTIVE sweep of SUBSTATE_TIMER 0..255 (only 0x01 expires; the
 *           copy overwrites its own targets from ROM so the work branch is otherwise constant)
 *           and EXHAUSTIVE sweep of the 0x6388 step byte at expiry (the `inc`, incl. 0xFF→0x00
 *           wrap). Teeth: a dropped step `inc`, a dropped sound latch, and an inverted gate.
 * LIVE-OUT: memory-only. Every write lands in work RAM (SUBSTATE_TIMER, the 40-byte
 *           SPRITE_OBJ_BLOCK, the 0x6084 sound latch, the 0x6388 selector) — no 0x7Dxx
 *           hardware latch, so there is no bus-positioned write to preserve. The rst-0x28
 *           dispatch tail reads no register/flag this leaves; the oracle's residual A/HL/DE/
 *           BC/flags are dead ABI, and its SP/pc are the Z80 caller-skip mechanism the boolean
 *           gate replaces.
 * NAMES:    SUBSTATE_TIMER (0x6009), SND_TRIGGER (0x6080 → +4 = latch bit 4), BOARD_ADVANCE_STEP
 *           (0x6388 — the board-advance render-sequence step) from ram.js. Hex-kept: ROM table
 *           base 0x3A1F (an immediate).
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js"; // ROM 0x0018 (rst 0x18)
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e
import { SUBSTATE_TIMER, SND_TRIGGER, BOARD_ADVANCE_STEP } from "./ram.js";

const COPY_SOURCE = 0x3a1f; // ROM base of this step's 40-byte sprite-object frame
const SND_LATCH = SND_TRIGGER + 4; // 0x6084 — SND_TRIGGER[4]
const SND_ASSERT_FRAMES = 0x03; // 3-frame sound-latch assert (sub_00e0 counts it down)

export function loc_186f(m) {
  const { regs, mem } = m;

  // rst 0x18 — hold this pose until the frame timer expires. While it counts down,
  // decrement and abort to the dispatcher (the oracle's inc-sp caller-skip).
  if (!tickSubstateTimer(m)) return;

  // Timer expired — swap in this step's sprite-object frame: copy the 40-byte
  // (10-record × 4) template from ROM 0x3A1F into SPRITE_OBJ_BLOCK (HL = the copy source).
  regs.hl = COPY_SOURCE;
  loadSpriteObjectBlock(m);

  // Pulse the 3-frame sound-latch assert, then advance the render-sequence step selector.
  mem.write8(SND_LATCH, SND_ASSERT_FRAMES);
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);
}
