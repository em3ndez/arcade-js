// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchFrogAnimationArm  —  ROM 0x0faf  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The frog-animation arm dispatcher. Frogger repaints every lane's sprite objects through a set of
 *   eleven "render arms" (0..10), one arm per scanned lane plus one empty slot. Which arm runs is chosen
 *   by a single work-RAM cell, the animation-index cell loc_8000 (0x8000) [seen]. This routine reads that
 *   index and hands control to the matching arm.
 *
 * WHERE IT SITS
 *   In the ROM the index selects an entry from a fixed 11-slot jump table, FROG_ANIM_ARM_TABLE (0x0fbe),
 *   and jumps there. The table never changes at runtime, so we skip the pointer indirection and dispatch
 *   on the index value directly — case k is exactly what table slot k pointed at. Each arm sets up its
 *   own sprite/plot state (its parameter triple from ACTIVE_LANE_PARAM_BLOCK (0x8270), a VRAM destination,
 *   a tile source, and a pair of plot cursors aimed at that arm's lane object list) and then falls into
 *   the shared tile-column loop renderFrogAnimTileColumns (0x0ff1). That loop stamps the tiles, repopulates
 *   the lane object list the move resolver later scans, and — via advanceFrogAnimIndexAndRedispatch
 *   (0x1029) — bumps the index and re-dispatches the NEXT arm, cascading through arm 10 before wrapping the
 *   index back to 0. So one call here, entered at index 0, renders the whole eleven-arm sweep and drains
 *   back to our caller with a single net return.
 *
 * LIVE-OUT
 *   Memory only (VRAM tiles, the lane object lists, and the anim-index cell, all written downstream by the
 *   arms and the render loop). Returns nothing the caller reads.
 */
import { NotImplemented } from "../../../boards/frogger/io.js";
import { loc_8000 } from "./names.js";
import { advanceFrogAnimIndexAndRedispatch } from "./advanceFrogAnimIndexAndRedispatch.js";
import { renderFrogAnimArm0 } from "./renderFrogAnimArm0.js";
import { renderFrogAnimArm1 } from "./renderFrogAnimArm1.js";
import { renderFrogAnimArm2 } from "./renderFrogAnimArm2.js";
import { renderFrogAnimArm3 } from "./renderFrogAnimArm3.js";
import { renderFrogAnimArm4 } from "./renderFrogAnimArm4.js";
import { renderFrogAnimArm6 } from "./renderFrogAnimArm6.js";
import { renderFrogAnimArm7 } from "./renderFrogAnimArm7.js";
import { renderFrogAnimArm8 } from "./renderFrogAnimArm8.js";
import { renderFrogAnimArm9 } from "./renderFrogAnimArm9.js";
import { renderFrogAnimArm10 } from "./renderFrogAnimArm10.js";


export function dispatchFrogAnimationArm(m) {
  // ── Read the arm selector ─────────────────────────────────────────────────────────────
  // loc_8000 (0x8000) is the page-0x80 work-RAM base, but here it is read as the animation-index cell:
  // a value 0..10 naming which render arm to run this frame. It is bumped by
  // advanceFrogAnimIndexAndRedispatch (0x1029) after each arm renders and wraps back to 0 at the end of
  // the sweep, so on the usual per-frame entry it starts at 0 and this dispatch drives the full cascade.
  const index = m.mem8[loc_8000];

  // ── Jump to the selected arm ──────────────────────────────────────────────────────────
  // The ROM indexes FROG_ANIM_ARM_TABLE (0x0fbe) with `index` and jumps; because that table is fixed ROM
  // data, each case below is the literal target of table slot `index`. Every arm is a tail hand-off: it
  // configures its render state and falls into the shared render loop, whose tail advances the index and
  // re-dispatches the next arm — so control does not come back here between arms, and the whole chain
  // returns through us exactly once.
  switch (index) {
    case 0: return renderFrogAnimArm0(m);
    case 1: return renderFrogAnimArm1(m);
    case 2: return renderFrogAnimArm2(m);
    case 3: return renderFrogAnimArm3(m);
    case 4: return renderFrogAnimArm4(m);
    // Arm 5 is the empty slot: nibble-8's lane is the shared gap the move resolver never scans, so this
    // arm has no render body. It steps straight to the index advance, which draws nothing for this slot
    // and moves on to arm 6.
    case 5: return advanceFrogAnimIndexAndRedispatch(m);
    case 6: return renderFrogAnimArm6(m);
    case 7: return renderFrogAnimArm7(m);
    case 8: return renderFrogAnimArm8(m);
    case 9: return renderFrogAnimArm9(m);
    case 10: return renderFrogAnimArm10(m);
    // The ROM's index cell is only ever written in range 0..10 (seeded to 0, bumped one at a time, wrapped
    // to 0 at 11 by advanceFrogAnimIndexAndRedispatch), so the hardware jump table has no out-of-range
    // entry. Reaching here means the index cell was corrupted — surface it as a bug rather than jump wild.
    default:
      throw new NotImplemented(`dispatchFrogAnimationArm: anim index ${index} outside 0..10`);
  }
}
