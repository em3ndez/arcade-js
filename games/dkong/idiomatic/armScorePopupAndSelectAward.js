// SPDX-License-Identifier: GPL-3.0-only
/**
 * armScorePopupAndSelectAward — sub_1dbd's state-1 handler: arm the state-2 countdown, advance the state
 * 1 -> 2, then dispatch to the effect-sprite setter selected by EFFECT_SELECT's (0x6342)
 * low bits (or, if none are set, by the current LEVEL).  ROM 0x1dc9.
 *
 * sub_1dbd is the rst-0x28 router on the effect-sprite state byte EFFECT_STATE (0x6340; 0 =
 * idle effectStateIdle, 1 = here, 2 = the countdown loc_1e4a, 3 = reset). This is the one-shot that
 * runs when the machine enters state 1: it stores EFFECT_TIMER (0x6341) := 0x40 (the value the
 * state-2 countdown loc_1e4a works down) and advances EFFECT_STATE (0x6340) := 2 unconditionally,
 * on every path, before doing anything else. Then it spawns exactly one effect sprite by
 * tail-jumping to one of the sibling setters:
 *
 *   - EFFECT_SELECT bit 0 set -> pickAwardTierByObjectCount  (RNG-free encoder over the remaining EFFECT_SELECT bits)
 *   - else bit 1 set     -> stageAward300Popup  (constant setter B=0x7D / DE=0x0003)
 *   - else bit 2 set     -> pickRandomAwardTier  (dispatch on RANDOM's low two bits)
 *   - else (bits 0-2 all clear) -> cue the effect sound (SND_TRIGGER[5] := 3), then pick
 *     the setter by LEVEL: 1 -> stageAward300Popup, 2 -> stageAward500Popup, otherwise -> stageAward800Popup.
 *
 * The oracle walks EFFECT_SELECT's bits with a chain of `rra`s (carry = bit 0, then bit 1, then
 * bit 2) — "first set bit wins" is exactly the if/else-if here without the register model —
 * and walks the LEVEL cases with a `dec a` chain off (0x6229). Every exit is a TAIL jump,
 * so in this layer each is a direct JS call and the Z80 stack becomes the JS call stack.
 *
 * NAME: kept the neutral loc_ — the mechanics are certain (arm the timer, advance the
 * state, dispatch one effect setter), but the specific effect this whole family spawns is
 * not confirmed to the routine-name evidence bar. Its entire cohort — the setters
 * pickAwardTierByObjectCount / stageAward300Popup / stageAward500Popup / stageAward800Popup, the RNG sub-dispatcher pickRandomAwardTier, and the
 * shared tail stageAwardPopupAtHitObject / stampScorePopupSprite — all stayed neutral for the same reason; naming the
 * dispatcher past them would overclaim. Promote the family together once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1dc9.test.js.
 * GATE:     crafted-entry — oracle-vs-idiomatic on real captured 0x1dc9 dispatches (attract
 *           reaches this while the 25m demo plays; sub_1dbd calls it whenever EFFECT_STATE == 1),
 *           compared on RAM − STACK_SCRATCH. Plus an EXHAUSTIVE EFFECT_SELECT sweep (0..255) that
 *           crafts every top-level arm attract does not naturally reach, and an EXHAUSTIVE
 *           LEVEL sweep (0..255) on a forced fall-through base that crafts the 1/2/>=3
 *           LEVEL sub-dispatch. Each swept value uses a FRESH clone (the routine and its
 *           callees write memory / advance the task ring). Two teeth: a dispatch bit-order
 *           swap (bit 1 tested before bit 0) and a wrong state-advance constant (EFFECT_STATE := 3).
 * LIVE-OUT: memory-only — EFFECT_TIMER (0x6341) := 0x40, EFFECT_STATE (0x6340) := 2 (both
 *           unconditional), plus, on the fall-through arm, SND_TRIGGER[5] := 3; everything else
 *           is written by the chosen setter's chain (task ring + TASK_TAIL, the sprite record
 *           POPUP_SPRITE (0x6A30).., the gated
 *           sound). No register is a live-out: the rst-0x28 caller consumes none after the
 *           state handler. The one register that stays is the BOUNDARY into pickAwardTierByObjectCount, which
 *           still reads A (its low two bits) — set from EFFECT_SELECT >> 1 below; A's high bit and
 *           the oracle's residual A/HL/flags are dead. SP/pc are the dropped stack model:
 *           on the bit-0 arm they track the still-oracle loc_1e28 tail and match it exactly;
 *           on the other arms the fully-idiomatic setters leave them at entry while the
 *           oracle's `ret` chain moves them within STACK_SCRATCH — dead either way.
 * NAMES:    LEVEL (0x6229), SND_TRIGGER (0x6080; the effect sound is SND_TRIGGER[5] = 0x6085),
 *           and the sub_1dbd effect-sprite cluster EFFECT_STATE (0x6340) / EFFECT_TIMER (0x6341) /
 *           EFFECT_SELECT (0x6342) — the state / countdown / select bytes — all imported from
 *           ram.js. (ram.js tags the EFFECT_* names "[code]": the state-machine STRUCTURE is
 *           certain, the "effect-sprite" semantic is the interpretation still to ground vs MAME.)
 */
import { LEVEL, SND_TRIGGER, EFFECT_STATE, EFFECT_TIMER, EFFECT_SELECT } from "./ram.js";
import { pickAwardTierByObjectCount } from "./pickAwardTierByObjectCount.js"; // ROM 0x3E70 — EFFECT_SELECT bit 0 arm (reads register A)
import { stageAward300Popup } from "./stageAward300Popup.js"; // ROM 0x1E00 — EFFECT_SELECT bit 1 arm; LEVEL == 1 arm
import { pickRandomAwardTier } from "./pickRandomAwardTier.js"; // ROM 0x1DF5 — EFFECT_SELECT bit 2 arm (RNG sub-dispatch)
import { stageAward500Popup } from "./stageAward500Popup.js"; // ROM 0x1E08 — LEVEL == 2 arm
import { stageAward800Popup } from "./stageAward800Popup.js"; // ROM 0x1E10 — LEVEL >= 3 (and 0) arm

const EFFECT_SOUND = SND_TRIGGER + 5; // 0x6085 — the effect sound latch, cued on the LEVEL path

export function armScorePopupAndSelectAward(m) {
  const { regs, mem } = m;

  // Unconditional on every path: arm the state-2 countdown, then advance the state.
  mem.write8(EFFECT_TIMER, 0x40); // countdown value the state-2 handler loc_1e4a works down
  mem.write8(EFFECT_STATE, 0x02); // *** STATE ADVANCE 1 -> 2 ***

  // Dispatch on the low three bits of the effect-select byte EFFECT_SELECT (first set bit wins).
  const select = mem.read8(EFFECT_SELECT);

  if (select & 0x01) {
    // bit 0 -> pickAwardTierByObjectCount. It reads register A (its low two bits). The oracle enters it with
    // A = EFFECT_SELECT rotated right once through carry; pickAwardTierByObjectCount consumes only A bits 0-1
    // (= EFFECT_SELECT bits 1-2), so the rotated-in high bit is dead. Hand it that byte here —
    // this is the one register that stays, at the boundary into the (register-reading) callee.
    regs.a = select >> 1;
    return pickAwardTierByObjectCount(m);
  }
  if (select & 0x02) return stageAward300Popup(m); // bit 1
  if (select & 0x04) return pickRandomAwardTier(m); // bit 2 (RNG-dispatched)

  // No select bit set: cue the effect sound, then pick the setter by the current LEVEL.
  mem.write8(EFFECT_SOUND, 0x03);
  const level = mem.read8(LEVEL);
  if (level === 1) return stageAward300Popup(m);
  if (level === 2) return stageAward500Popup(m);
  return stageAward800Popup(m); // LEVEL not in {1, 2} (level >= 3, or 0)
}
