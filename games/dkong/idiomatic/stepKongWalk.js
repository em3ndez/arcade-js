// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepKongWalk — drive sub_25f2's object #1, then slide its 10-sprite group one step along X.  ROM 0x16d5.
 *
 * The tail of the dispatchKongWalkFrame / loc_16d0 / endKongWalkAndAdvanceInterlude substate family that animates a
 * horizontally-moving group of sprites (the family reads record #2's X at 0x6910 vs
 * 0x5A/0x5D to decide when the group has reached a boundary). One tick of that motion
 * is exactly three steps:
 *
 *   1. Advance object #1 (loc_2602): tick its even-frame countdown (reload + reverse its
 *      step-direction sign on underflow), REPUBLISH its signed per-frame step into M50_OBJ1_STEP
 *      (0x63A3) (0 on even frames, 0xFF/0x01 by sign on odd frames), and every 32nd frame advance
 *      its mirrored sprite-animation pair at 0x69E4.
 *   2. Take that freshly-published step (M50_OBJ1_STEP) as the shift amount C.
 *   3. rst 0x38 → the stride-4, count-10 form of addStrided: add C to byte +0 (the X
 *      field) of each of the 10 records in SPRITE_OBJ_BLOCK (0x6908, 0x690C, … 0x692C),
 *      sliding the whole group left/right by the object's step. This is one of the
 *      "rst-0x38 stride-4 add-loops" ram.js documents as how the block's fields are
 *      positioned.
 *
 * On even frames the published step is 0, so the group holds still that frame and only the
 * object's internal state advances; on odd frames it slides ±1 px. The scene the group
 * belongs to is UNCONFIRMED — loc_2602 (the meaning-bearing callee) declined an English
 * name for the same reason (the sprite-record trap) — so this routine keeps the neutral
 * stepKongWalk name; a reviewer who promotes loc_2602 can
 * promote this in the same pass. Not a leaf: it calls loc_2602 (0x2602) and addStrided
 * (0x003d, reached via loc_0038's rst-0x38 stride-4/count-10 setup), both separately gated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-16d5.test.js.
 * GATE:     crafted-entry; attract never dispatches 0x16d5 (0×/2500 frames, asserted — the
 *           sub_25f2 object cascade it drives runs only in real gameplay; stepKongWalk's own
 *           call to 0x2602 would register on that dispatch hook, and 0x2602 is 0× too), so
 *           real states are reproduced by pokes on a booted machine: a 256-value FRAME sweep
 *           (parity → publish 0 vs ±1, the 32nd-frame arm), a block-X byte sweep on both
 *           step signs exercising addStrided's 8-bit wrap, and a countdown/direction grid
 *           driving loc_2602's underflow+reverse arm. Teeth: a wrong-base twin and a
 *           skip-the-drive twin, both caught by the RAM diff.
 * LIVE-OUT: memory-only. stepKongWalk is the tail of the dispatchKongWalkFrame substate family, dispatched
 *           from the in-game substate table (0x0702) and tail-returning through the NMI
 *           dispatcher, which reads no register or flag this routine leaves — A/B/C/DE/HL
 *           are dead ABI. The RAM diff (+ SP/pc) backstops that.
 * NAMES:    SPRITE_OBJ_BLOCK (0x6908) — the 10-record sprite-object group whose X field
 *           (byte +0) is shifted; M50_OBJ1_STEP (0x63A3) — object #1's published step, read
 *           here as the shift amount. Both from ram.js. Object #1's remaining state bytes stay
 *           hex, matching loc_2602's treatment of the same object.
 */

import { SPRITE_OBJ_BLOCK, M50_OBJ1_STEP } from "./ram.js";
import { loc_2602 } from "./loc_2602.js";
import { addStrided } from "./addStrided.js";

export function stepKongWalk(m) {
  const { regs, mem } = m;

  // 1. Advance object #1: this REPUBLISHES the object's signed per-frame step into 0x63A3.
  loc_2602(m);

  // 2. The step just published becomes the addend for the block shift (C in the rst path).
  regs.c = mem.read8(M50_OBJ1_STEP);

  // 3. rst 0x38 (loc_0038 fixes stride 4 and count 10, then falls into addStrided): add C
  //    to byte +0 (X) of each of the 10 records in the sprite-object block.
  regs.de = 0x0004; // stride — one whole 4-byte record
  regs.b = 0x0a; // ten records
  regs.hl = SPRITE_OBJ_BLOCK; // 0x6908
  addStrided(m);
}
