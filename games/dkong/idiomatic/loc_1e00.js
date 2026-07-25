// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e00 — load this effect-sprite's (code, task-message) params and hand off to the
 * shared continuation loc_1e15.  ROM 0x1e00.
 *
 * One of the three sibling setters (loc_1e00 / loc_1e08 / loc_1e10) that loc_1df5
 * dispatches on bits 0/1 of RANDOM (0x6018); this is the "both bits clear" arm. Each
 * setter loads its own constant (B, DE) pair and tail-jumps to loc_1e15, which posts the
 * task and stamps the effect-sprite record. For this arm:
 *
 *   - B  = 0x7D  — the sprite's code byte, stored by loc_1e36 into record[1] (0x6A31).
 *   - DE = 0x0003 — the deferred-task message (D = opcode 0x00, E = argument 0x03),
 *                   posted by loc_1e15's enqueueTask onto the task ring.
 *
 * Then it delegates to loc_1e15 (the oracle's `jp 0x1e15` is a tail jump — the shipped
 * artifact just calls the routine; the Z80 stack becomes the JS call stack). B and DE
 * are this routine's only outputs into that call; A/C/HL/flags are untouched and loc_1e15
 * does not read them.
 *
 * NAME: kept the neutral loc_ — the MECHANICS are certain (it loads two constants and
 * delegates), but the specific effect this sprite is and what task (0x00,0x03) does are
 * not established to the routine-name evidence bar. Its whole family — the sibling
 * setters and the shared loc_1e15 / loc_1e36 tail — stayed neutral for the same reason;
 * naming the feeder past its own continuation would overclaim. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e00.test.js.
 * GATE:     crafted-entry — oracle-vs-idiomatic on real captured 25m dispatches (attract
 *           reaches this arm on BOARD 1 with a free ring slot), plus crafted arms attract
 *           never reaches: a BOARD-exhaustive sweep (0..255) covering loc_1e36's closed
 *           50m/100m sound gate, and a full-ring DROP entry exercising enqueueTask's
 *           silent-drop path. Straight-line body (no branches of its own); all branching
 *           lives in the loc_1e15 → enqueueTask / loc_1e36 chain, already decompiled and
 *           gated. Teeth: wrong sprite-code constant and wrong task-message constant.
 * LIVE-OUT: memory-only — everything the loc_1e15 tail writes: the task ring + TASK_TAIL
 *           (via enqueueTask), the block[0] clear at *(0x6343), and the sprite record
 *           0x6A30..0x6A33 + gate-open 0x6085 (via loc_1e36). B and DE are consumed inside
 *           that same dispatch; loc_1e00's caller chain (loc_1df5 → sub_1dbd's cascade)
 *           reads no register/flag afterward, so B/DE/A/C/HL and all flags are dead. SP/pc
 *           are the dropped stack model (the oracle's tail-jump becomes a direct call).
 * NAMES:    loc_1e15 (ROM 0x1E15) is the idiomatic callee, imported and called directly.
 *           The 0x7D / 0x0003 constants are kept literal — their game-semantic meaning
 *           (sprite code, task message) is described but unconfirmed, matching loc_1e15.
 */
import { loc_1e15 } from "./loc_1e15.js"; // ROM 0x1E15

const SPRITE_CODE = 0x7d; // -> B, stamped into the sprite record byte +1 by loc_1e36
const TASK_MESSAGE = 0x0003; // -> DE (D = opcode 0x00, E = argument 0x03), posted by loc_1e15

export function loc_1e00(m) {
  const { regs } = m;

  // Load this arm's constant (code, task-message) pair, then delegate to the shared
  // continuation. loc_1e15 reads B (via loc_1e36) and D/E (via enqueueTask); nothing else.
  regs.b = SPRITE_CODE;
  regs.de = TASK_MESSAGE;
  loc_1e15(m);
}
