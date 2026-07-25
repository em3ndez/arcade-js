// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateIntroClimbStep — step 2 of the opening Kong-climb cutscene: animate the climb
 * each frame and, once the climber reaches the top, hand the cutscene to its next phase.
 * ROM 0x0ae8.
 *
 * The opening Kong-climb cutscene (in-game sub-state 7, the short intro that plays at the
 * head of every board) walks INTRO_STEP (0x6385) 0->7, one handler per step, dispatched
 * every frame by dispatchIntroCutsceneStep (0x0A76). This is entry 2 of that 0x0A7A table
 * — the phase that plays the actual climb. Where step 1 (runIntroClimbStep) is a one-shot
 * that stages the climb pose, this step RUNS the climb: it is re-dispatched every frame
 * while INTRO_STEP == 2 and, per frame:
 *
 *   - animateSpriteObjectBlock (0x306F): advance the ten-record sprite-object block one
 *     animation frame (scrolling the climbing figures up 4px on every eighth call) and
 *     bump the private tick counter 0x62AF. Called unconditionally.
 *   - Every 16th tick (low nibble of 0x62AF == 0), scrollClimbGraphicStep (0x304A) slides
 *     the climb-graphic strip up one tilemap row — the periodic background scroll.
 *   - Read the climbing figure's Y (SPRITE_OBJ_BLOCK+3 = 0x690B, record 0's Y byte, walked
 *     upward = smaller as the sprite scrolls). While it is still >= 0x5D the climb has not
 *     topped out, so return and repeat next frame.
 *
 * When that Y finally drops below 0x5D the climb has reached the top. Advance the cutscene:
 *   - arm SUBSTATE_TIMER (0x6009) to 0x20 — a 32-frame metered pause for the next phase;
 *   - inc INTRO_STEP (0x6385) 2 -> 3, so the next frame dispatches the following step;
 *   - point SEQ_ADVANCE_PTR (0x63C0) at INTRO_STEP, so the shared gated tick (loc_3069,
 *     step 3) advances INTRO_STEP again once that timer expires.
 *
 * Callees animateSpriteObjectBlock (0x306F) and scrollClimbGraphicStep (0x304A) are the
 * landed idiomatic leaves, called directly; each reads/writes only through `m` and needs
 * no register setup. Neither models the Z80 stack, so this routine leaves SP and pc exactly
 * as it found them — the oracle's push16/call/ret churn lands in the dead STACK_SCRATCH
 * region and is outside the memory contract. No hardware (0x7Dxx) writes of its own: every
 * store this routine makes is work RAM (the callees also touch video RAM).
 *
 * Memory-equivalent to the frozen oracle — equivalence-0ae8.test.js.
 * GATE:     crafted + captured — reached only in a credited game's opening cutscene
 *           (GAME_STATE 3, GAME_SUBSTATE 7, INTRO_STEP 2); 0x0ae8 dispatches ZERO times in
 *           plain attract. A driven coin+start run dispatches it ~248x — mostly the "still
 *           climbing" exit-A arm, the periodic scroll arm, and one natural "topped out"
 *           exit-B — and each real dispatch is replayed oracle-vs-idiomatic on a FRESH
 *           clone and compared on RAM − STACK_SCRATCH. The never-natural
 *           call-taken-AND-exit-B combination, plus a guaranteed plain exit-B, are forced
 *           on real captured states (poke 0x690B < 0x5D and/or 0x62AF), identically both
 *           sides. Teeth: a dropped INTRO_STEP advance and a wrong scroll gate (& 0x07).
 * LIVE-OUT: memory-only. The caller (dispatchIntroCutsceneStep's rst-0x28 tail) discards
 *           this handler's return and reads no register/flag it leaves — the oracle's
 *           residual A/HL/flags are dead ABI, and its SP/pc are the Z80 caller-skip
 *           mechanism, not part of the memory contract.
 * NAMES:    SUBSTATE_TIMER (0x6009), INTRO_STEP (0x6385), SEQ_ADVANCE_PTR (0x63C0),
 *           SPRITE_OBJ_BLOCK (0x6908) from ram.js. Hex-kept: 0x62AF — the private 1-in-16
 *           cutscene tick counter animateSpriteObjectBlock owns (unnamed in ram.js).
 */

import { animateSpriteObjectBlock } from "./animateSpriteObjectBlock.js"; // ROM 0x306f
import { scrollClimbGraphicStep } from "./scrollClimbGraphicStep.js"; // ROM 0x304a
import { SUBSTATE_TIMER, INTRO_STEP, SEQ_ADVANCE_PTR, SPRITE_OBJ_BLOCK } from "../optimized/ram.js";

const TICK_COUNTER = 0x62af; // private 1-in-16 cutscene tick counter (unnamed in ram.js)
const CLIMBER_Y = SPRITE_OBJ_BLOCK + 3; // 0x690B — record 0's Y byte: the climbing figure

export function animateIntroClimbStep(m) {
  const { mem } = m;

  // call 0x306f — advance the climb animation and bump the tick counter 0x62AF.
  animateSpriteObjectBlock(m);

  // ld a,(0x62af) / and 0x0f / call z,0x304a — every 16th tick (low nibble 0) scroll the
  // climb graphic up one tilemap row.
  if ((mem.read8(TICK_COUNTER) & 0x0f) === 0) {
    scrollClimbGraphicStep(m);
  }

  // ld a,(0x690b) / cp 0x5d / ret nc — while the climbing figure's Y is still >= 0x5D the
  // climb has not reached the top; stay in step 2 and repeat next frame.
  if (mem.read8(CLIMBER_Y) >= 0x5d) return;

  // The climb topped out — advance the cutscene to its next phase.
  mem.write8(SUBSTATE_TIMER, 0x20);                           // arm the 32-frame pause
  mem.write8(INTRO_STEP, (mem.read8(INTRO_STEP) + 1) & 0xff); // step 2 -> 3
  mem.write16(SEQ_ADVANCE_PTR, INTRO_STEP);                   // point 0x63C0 at 0x6385
}
