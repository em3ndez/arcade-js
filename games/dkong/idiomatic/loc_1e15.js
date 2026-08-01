// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e15 — post the queued task, fetch the effect sprite's X/Y from an indirect
 * parameter block, then hand off to the record-stamp tail.  ROM 0x1e15.
 *
 * The shared convergence of the three setters loc_1e00 / loc_1e08 / loc_1e10, each of
 * which loads its own (B, DE) and tail-jumps here. B is the sprite's code byte and DE
 * is a deferred-task message; both are the setters' parameters. This routine:
 *
 *   1. enqueueTask(D,E) — post the setter's message onto the task ring (fire-and-
 *      forget; its result is not read). B, D and E survive the call.
 *   2. Load a pointer from the indirect slot EFFECT_PARAM_PTR (0x6343) to a small parameter block.
 *   3. Read block[0] into A (the sprite's X) and CLEAR block[0] in place — a
 *      consume-once read. Then read block[3] into C (the sprite's Y). The `inc l`x3
 *      pointer walk is 8-bit (page fixed), matching the oracle.
 *   4. Tail into loc_1e36, which stamps the 4-byte hardware sprite record
 *      {A, B, 0x07, C} at POPUP_SPRITE (0x6A30) and cues a board-gated sound.
 *
 * Part of the sub_1dbd effect state machine (EFFECT_STATE 0x6340; see loc_1e36).
 *
 * NAME: kept the neutral loc_ — the memory mechanics are understood, but the specific
 * effect this sprite is (and the identity of the EFFECT_PARAM_PTR (0x6343) parameter
 * block) are not confirmed to the routine-name evidence bar. Its own tail loc_1e36 stayed neutral for
 * the same reason; promoting the feeder past its tail would overclaim. Promote once
 * corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e15.test.js.
 * GATE:     crafted-entry — oracle-vs-idiomatic on real captured 25m dispatches
 *           (BOARD 1, sound gate open), plus crafted arms attract never reaches: a
 *           BOARD-exhaustive sweep (0..255) covering loc_1e36's closed 50m/100m gate,
 *           a parameter-block content sweep pinning the block[0]/block[3] offsets and
 *           the byte-0 clear, and a full-ring DROP entry exercising enqueueTask's
 *           silent-drop path. Three teeth: wrong-C-offset, no-clear, and drop-the-task.
 * LIVE-OUT: memory-only — the task ring + TASK_TAIL (via enqueueTask), the block[0]
 *           clear at *(EFFECT_PARAM_PTR), and the POPUP_SPRITE record 0x6A30..0x6A33 +
 *           gate-open 0x6085 (a SND_TRIGGER latch) (via loc_1e36). A and C are set only as
 *           loc_1e36's live-in and are consumed
 *           within this same dispatch; the caller (loc_1e00's caller) reads no register
 *           afterward, so A/C/HL and the `inc l` flags are all dead. SP/pc are the
 *           dropped stack model (the oracle's push/call/ret becomes the JS call stack).
 * NAMES:    enqueueTask (ROM 0x309F) and loc_1e36 (ROM 0x1E36) are the idiomatic
 *           callees, imported and called directly. EFFECT_PARAM_PTR (0x6343) from ram.js —
 *           the effect param pointer (word); the block IDENTITY it derefs is unconfirmed,
 *           but the cell is named.
 */
import { enqueueTask } from "./enqueueTask.js"; // ROM 0x309F
import { loc_1e36 } from "./loc_1e36.js";       // ROM 0x1E36
import { EFFECT_PARAM_PTR } from "./ram.js";    // 0x6343 — indirect word: HL = the parameter block's address

export function loc_1e15(m) {
  const { regs, mem } = m;

  // Post the setter's deferred-task message (D=opcode, E=argument). B/D/E preserved.
  enqueueTask(m);

  // HL = the parameter block's address, read INDIRECTLY from the word at EFFECT_PARAM_PTR.
  const block = mem.read16(EFFECT_PARAM_PTR);

  // block[0] -> A (the sprite X), then CLEAR it in place (read-then-consume).
  regs.a = mem.read8(block);
  mem.write8(block, 0x00);

  // block[3] -> C (the sprite Y). `inc l` x3 is 8-bit: the high byte of the pointer
  // is fixed, so the read address wraps within the page exactly as the oracle's does.
  regs.c = mem.read8((block & 0xff00) | ((block + 3) & 0xff));

  // Tail into the shared record-stamp + board-gated sound. A, B, C are its live-in.
  loc_1e36(m);
}
