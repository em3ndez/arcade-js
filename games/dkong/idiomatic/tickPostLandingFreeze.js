// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickPostLandingFreeze — count down Mario's post-landing freeze; unfreeze on expiry.
 * ROM 0x1B55.
 *
 * A branch of the movement machine (entry_1ac3 tail-jumps here — `jp nz 0x1b55` — on
 * the frame Mario's MARIO_FREEZE_TIMER is nonzero). Landing loads that timer to 4
 * (entry_1c4f, ROM 0x1C65) so Mario is unresponsive for four frames after a jump.
 * Each of those frames this routine does one thing: decrement the timer and, while it
 * is still nonzero, return immediately — the mover does nothing else, Mario stays put.
 *
 * On the frame the decrement reaches ZERO the freeze expires, and the routine performs
 * the one-shot unfreeze:
 *
 *   - MARIO_HAMMER_ACTIVE <- MARIO_HAMMER_PENDING  (0x6217 <- 0x6218): commit a hammer
 *     that was only touched during the airborne frames now that Mario is settled.
 *   - MARIO_SPRITE_CODE  &= 0x80                   (0x6207): strip the tile/animation
 *     nibble, keeping only bit 7 (facing/flip), so Mario resumes from a clean stand pose.
 *   - MARIO_WALK_ANIM     = 0                       (0x6202): reset the walk-cycle index.
 *   - then tail-calls writeMarioSpriteRecord (ROM 0x1DA6) to push the just-cleaned
 *     state into Mario's hardware sprite record for this frame's DMA blit.
 *
 * No live-in registers (the timer address and the work bytes are all memory); takes only
 * the machine. The Z80 `dec (hl)` is modelled as an 8-bit wrap so a 0 timer would go to
 * 0xFF (nonzero) exactly like the ROM — though in play the timer is always loaded to 4.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1b55.test.js.
 * GATE:     crafted-entry — real attract dispatches cover BOTH arms (each of the 4
 *           landings ticks 4->3->2->1 early-return then 1->0 expiry); crafted entries
 *           vary MARIO_HAMMER_PENDING / MARIO_SPRITE_CODE / MARIO_WALK_ANIM to sentinels
 *           to pin the copy/strip/clear that attract leaves at 0. Reached whenever Mario
 *           is post-landing frozen.
 * LIVE-OUT: memory-only — MARIO_FREEZE_TIMER, and on expiry MARIO_HAMMER_ACTIVE /
 *           MARIO_SPRITE_CODE / MARIO_WALK_ANIM plus the four sprite-record bytes
 *           (0x694C..0x694F, via the callee). entry_1ac3 reaches here by an
 *           unconditional tail-jump and both arms exit through a single net `ret`, so no
 *           successor reads a flag this sets; the oracle's residual A/HL/flags are dead
 *           ABI (the whole-machine gate backstops that).
 * NAMES:    MARIO_FREEZE_TIMER (0x621E), MARIO_HAMMER_PENDING (0x6218),
 *           MARIO_HAMMER_ACTIVE (0x6217), MARIO_SPRITE_CODE (0x6207),
 *           MARIO_WALK_ANIM (0x6202) — all from ram.js.
 */

import {
  MARIO_FREEZE_TIMER,
  MARIO_HAMMER_PENDING,
  MARIO_HAMMER_ACTIVE,
  MARIO_SPRITE_CODE,
  MARIO_WALK_ANIM,
} from "./ram.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

export function tickPostLandingFreeze(m) {
  const { mem } = m;

  // dec (MARIO_FREEZE_TIMER) — 8-bit wrap, exactly as `dec (hl)`.
  const remaining = (mem.read8(MARIO_FREEZE_TIMER) - 1) & 0xff;
  mem.write8(MARIO_FREEZE_TIMER, remaining);
  if (remaining !== 0) return; // ret nz — still frozen, mover does nothing more

  // Freeze expired this frame — unfreeze.
  mem.write8(MARIO_HAMMER_ACTIVE, mem.read8(MARIO_HAMMER_PENDING)); // 0x6217 <- 0x6218
  mem.write8(MARIO_SPRITE_CODE, mem.read8(MARIO_SPRITE_CODE) & 0x80); // keep facing bit only
  mem.write8(MARIO_WALK_ANIM, 0);

  // jp 0x1da6 — refresh Mario's hardware sprite record from the cleaned state.
  writeMarioSpriteRecord(m);
}
