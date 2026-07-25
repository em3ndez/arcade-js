// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1732 — one animation-gated step of the board-advance render sequence.  ROM 0x1732.
 *
 * A step handler in the board-cleared / advance interlude (GAME_SUBSTATE 0x600A == 0x16).
 * loc_1615 dispatches this family through the 0x6388 step selector; for the odd boards
 * (BOARD bit0 set → 25m / 75m) the table at 0x1623 is [1654, 1670, 168a, 1732, 1757, 178e],
 * so this is step index 3. Where its siblings hold a pose on the substate timer, this step
 * holds on an animation position instead:
 *
 *   1. Tick the sprite-object-block animation one frame (animateSpriteObjectBlock, ROM
 *      0x306f): a private 1-in-8 phase counter (0x62AF) advances every call, and on the
 *      eighth call the whole ten-record group scrolls up 4px and its code bytes animate.
 *   2. `ld a,(0x6913) / cp 0x2c / ret nc` — read sprite-object record 2's Y (0x6913) and
 *      HOLD this step (return) while it is still 0x2c or lower on the screen. The block
 *      only climbs on the eighth call, so most frames just tick the phase counter and hold.
 *   3. Once that record has scrolled ABOVE the top threshold (Y < 0x2c), finish the step:
 *      park records 0, 1 and object-record 1 at X = 0, reposition object-records 7 and 9
 *      to X = 0x6B / 0x6A, bump one shadow-buffer sprite code byte (0x6A21), and advance
 *      the render-sequence step selector (0x6388) so loc_1615 moves on to step 4 (0x1757).
 *
 * The only callee is the already-decompiled idiomatic animateSpriteObjectBlock; it is
 * called directly (no stack modelling). The rest is plain shadow-buffer / selector writes.
 *
 * NAME: kept as loc_1732 — the mechanics are understood but the exact visual the animation
 * depicts is not independently confirmed, and the whole sibling family stayed address-named
 * (loc_1662 / loc_1670).
 *
 * Memory-equivalent to the frozen oracle — equivalence-1732.test.js.
 * GATE:     crafted-entry — attract never reaches GAME_SUBSTATE 0x16 (it does not complete a
 *           board), so 0x1732 dispatches 0 times; validated on real booted-attract state with
 *           surgical pokes. EXHAUSTIVE sweep of the 0x6913 gate byte 0..255 (partition at
 *           0x2c: < 0x2c resets + advances the step, >= 0x2c holds) and EXHAUSTIVE sweep of
 *           the 0x62AF phase byte 0..255 (the 32 values that step the animation scroll the
 *           probe by -4 and flip the branch, exercising the animateSpriteObjectBlock
 *           composition). Compared on RAM (−STACK_SCRATCH). Teeth: a wrong-threshold twin and
 *           a wrong-reset-value twin.
 * LIVE-OUT: memory-only — the phase counter (0x62AF), the scrolled sprite-object block, and
 *           on reset the parked X bytes + 0x6A21 + the step selector 0x6388. Reached via the
 *           rst-0x28 dispatch tail, which discards this handler's return; the oracle's residual
 *           A/flags (the `cp 0x2c` result) are dead ABI. SP/pc are not compared: the oracle
 *           models the call's push/pop in STACK_SCRATCH, this routine needs no stack at all.
 * NAMES:    SPRITE_BUFFER (0x6900), SPRITE_OBJ_BLOCK (0x6908) from ram.js — records are 4 bytes
 *           (+0 X, +1 code, +2 attr, +3 Y). Hex-kept: the step selector 0x6388 (unnamed in
 *           ram.js — the shared board-advance render-sequence counter, same one loc_1662/1670
 *           advance) and the scroll probe 0x6913 (= record 2's Y = SPRITE_OBJ_BLOCK + 0x0B).
 */

import { animateSpriteObjectBlock } from "./animateSpriteObjectBlock.js"; // ROM 0x306f
import { SPRITE_BUFFER, SPRITE_OBJ_BLOCK } from "../optimized/ram.js";

const STEP_SELECTOR = 0x6388; // board-advance render-sequence step index (unnamed in ram.js)
const SCROLL_PROBE = SPRITE_OBJ_BLOCK + 0x0b; // 0x6913 — sprite-object record 2's Y (field 3)
const SCROLL_TOP = 0x2c; // reset once the probed record's Y has scrolled ABOVE this (Y < 0x2c)

export function loc_1732(m) {
  const { mem } = m;

  // 1. Advance the sprite-object-block animation one frame (1-in-8 phase; on the eighth
  //    call it scrolls the ten-record group up 4px and animates the code bytes).
  animateSpriteObjectBlock(m);

  // 2. `ld a,(0x6913) / cp 0x2c / ret nc` — hold this step until record 2's Y has climbed
  //    above the top threshold. Y still 0x2c or lower → nothing more this frame.
  if (mem.read8(SCROLL_PROBE) >= SCROLL_TOP) return;

  // 3. Reached the top — finish the step. `xor a` supplies the 0 stored to three X bytes.
  mem.write8(SPRITE_BUFFER + 0x00, 0x00); // 0x6900 — record 0 field 0 (X)
  mem.write8(SPRITE_BUFFER + 0x04, 0x00); // 0x6904 — record 1 field 0 (X)
  mem.write8(SPRITE_OBJ_BLOCK + 0x04, 0x00); // 0x690c — object-record 1 field 0 (X)
  mem.write8(SPRITE_OBJ_BLOCK + 0x1c, 0x6b); // 0x6924 — object-record 7 field 0 (X)
  mem.write8(SPRITE_OBJ_BLOCK + 0x24, 0x6a); // 0x692c — object-record 9 field 0 (X)

  // `ld hl,0x6a21 / inc (hl)` — bump a shadow-buffer sprite code byte to the next tile.
  const codeByte = SPRITE_BUFFER + 0x121; // 0x6a21 — field 1 (code) of a later shadow record
  mem.write8(codeByte, (mem.read8(codeByte) + 1) & 0xff);

  // `ld hl,0x6388 / inc (hl)` — advance the render-sequence step selector (→ step 4, 0x1757).
  mem.write8(STEP_SELECTOR, (mem.read8(STEP_SELECTOR) + 1) & 0xff);
}
