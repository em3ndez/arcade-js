// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_168a — one timer-gated step of the board-advance render sequence: re-init the
 * sprite-object block from a ROM template, then tail into the shared advance tail.
 * ROM 0x168a.
 *
 * A step handler in the board-cleared / advance interlude (GAME_SUBSTATE 0x600A == 0x16),
 * the near-twin of loc_186f: same rst-0x18 pose gate and the same sub_004e block copy,
 * differing only in its body and its tail. loc_1615 dispatches this family through the
 * 0x6388 step selector; this is the step whose odd-board table entry (0x1623) is 0x168a.
 *
 * On each frame:
 *   - rst 0x18 (tickSubstateTimer) ticks SUBSTATE_TIMER (0x6009). While it counts down the
 *     routine only decrements and returns — the pose is held. On the single expiry frame:
 *   - Copy a 40-byte (10-record × 4) sprite-object template from ROM 0x388C into
 *     SPRITE_OBJ_BLOCK (loadSpriteObjectBlock; HL = the copy source).
 *   - Re-stamp one just-copied byte — SPRITE_OBJ_BLOCK+4 (0x690C) — back to a fixed 0x66,
 *     then clear three bookkeeping bytes to 0: SPRITE_OBJ_BLOCK+0x1C (0x6924),
 *     SPRITE_OBJ_BLOCK+0x24 (0x692C), and the board-object byte 0x62AF.
 *   - jp 0x1662 — tail into the shared board-advance tail (loc_1662), which advances the
 *     0x6388 step selector, runs the per-board rst-0x30 gate, and (on 25m) subtracts 4 from
 *     field 3 of every sprite-object record. The Z80 `jp` reuses this frame, so loc_1662's
 *     `ret` returns to loc_168a's caller; the direct call models that as a plain tail call.
 *
 * Reached via dispatchGameState's rst-0x28 tail, which discards this handler's return, so
 * nothing downstream reads a register or flag it leaves.
 * NAME: kept as loc_168a — the mechanics are understood but the exact visual the animation
 * depicts is not independently confirmed, and the whole sibling family (loc_1654/loc_1662/
 * loc_1670/loc_186f) stayed address-named.
 *
 * CALLEES (all landed idiomatic leaves, called directly — no stack modelling):
 * tickSubstateTimer (0x0018), loadSpriteObjectBlock (0x004e), loc_1662 (0x1662, the tail).
 *
 * Memory-equivalent to the frozen oracle — equivalence-168a.test.js.
 * GATE:     crafted-entry — attract never reaches GAME_SUBSTATE 0x16 (it does not complete a
 *           board), so 0x168a dispatches 0 times; validated on real booted-attract state with
 *           surgical pokes: EXHAUSTIVE sweep of SUBSTATE_TIMER 0..255 (only 0x01 expires) and
 *           EXHAUSTIVE sweep of BOARD 0..255 at expiry (drives loc_1662's per-board gate both
 *           ways). Teeth: a dropped 0x690C re-stamp, a dropped 0x62AF clear, an inverted gate.
 * LIVE-OUT: memory-only. Every write lands in work RAM (SUBSTATE_TIMER, the 40-byte
 *           SPRITE_OBJ_BLOCK, 0x690C/0x6924/0x692C, 0x62AF, plus loc_1662's 0x6388 and the
 *           strided column) — no 0x7Dxx hardware latch, so there is no bus-positioned write to
 *           preserve. The rst-0x28 dispatch tail reads no register/flag this leaves; the
 *           oracle's residual A/HL/DE/BC/flags are dead ABI, and its SP/pc are the Z80
 *           caller-skip / tail-jump mechanism the boolean gate and direct call replace.
 * NAMES:    SUBSTATE_TIMER (0x6009, inside tickSubstateTimer) and SPRITE_OBJ_BLOCK (0x6908)
 *           from ram.js. Hex-kept: ROM template base 0x388C (an immediate); 0x62AF, which
 *           ram.js explicitly leaves unnamed as board-object bookkeeping.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js"; // ROM 0x0018 (rst 0x18)
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e
import { loc_1662 } from "./loc_1662.js"; // ROM 0x1662 (jp — shared board-advance tail)
import { SPRITE_OBJ_BLOCK } from "../optimized/ram.js";

const COPY_SOURCE = 0x388c; // ROM base of this step's 40-byte sprite-object template
const STAMP_ADDR = SPRITE_OBJ_BLOCK + 0x04; // 0x690C — a copied byte forced back to 0x66
const STAMP_VALUE = 0x66;
const CLEAR_A = SPRITE_OBJ_BLOCK + 0x1c; // 0x6924
const CLEAR_B = SPRITE_OBJ_BLOCK + 0x24; // 0x692C
const BOARD_BOOKKEEPING = 0x62af; // board-object bookkeeping, unnamed in ram.js

export function loc_168a(m) {
  const { regs, mem } = m;

  // rst 0x18 — hold this pose until the frame timer expires. While it counts down,
  // decrement and abort to the dispatcher (the oracle's inc-sp caller-skip).
  if (!tickSubstateTimer(m)) return;

  // Timer expired — re-init the sprite-object block: copy the 40-byte (10-record × 4)
  // template from ROM 0x388C into SPRITE_OBJ_BLOCK (HL = the copy source).
  regs.hl = COPY_SOURCE;
  loadSpriteObjectBlock(m);

  // Re-stamp one copied byte back to the fixed 0x66, then clear three bookkeeping bytes.
  mem.write8(STAMP_ADDR, STAMP_VALUE);
  mem.write8(CLEAR_A, 0);
  mem.write8(CLEAR_B, 0);
  mem.write8(BOARD_BOOKKEEPING, 0);

  // jp 0x1662 — tail into the shared advance tail (advance 0x6388, per-board gate, strided
  // subtract). The Z80 tail-jump reuses this frame; the direct call is the tail call.
  loc_1662(m);
}
