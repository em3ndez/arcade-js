// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageAward800Popup — effect-sprite setter: load (B, DE) then hand off to the feeder stageAwardPopupAtHitObject.
 * ROM 0x1e10.
 *
 * The third of sub_1dbd's (0x6340) three constant setters — stageAward300Popup (B=0x7D,
 * DE=0x0003), stageAward500Popup (B=0x7E, DE=0x0005) and this one — each of which loads its own
 * fixed (B, DE) parameter pair and tail-jumps into the shared feeder stageAwardPopupAtHitObject. B is the
 * effect sprite's code byte and DE is the deferred-task message (D = opcode 0, E =
 * argument 8); both are pure parameters this routine sets, and stageAwardPopupAtHitObject then posts the
 * task, reads the sprite's X/Y from the 0x6343 parameter block, and stamps the 4-byte
 * hardware sprite record (see stageAwardPopupAtHitObject / stampScorePopupSprite).
 *
 * stageAward800Popup READS nothing — it overwrites B and DE with constants regardless of their
 * entry value — so its whole contribution is those two register loads plus the tail-jump.
 * The oracle's `jp 0x1e15` is a tail JUMP (no push): in the idiomatic layer that is a
 * direct call to stageAwardPopupAtHitObject, and the Z80 stack becomes the JS call stack.
 *
 * NAME: kept the neutral loc_ — the mechanics are certain (set two constants, delegate),
 * but the specific effect this sprite is (and thus a meaningful English name) is not
 * confirmed to the routine-name evidence bar. Its sibling setters stageAward300Popup/1e08 and
 * pickAwardTierByObjectCount, and the feeder stageAwardPopupAtHitObject / tail stampScorePopupSprite, all stayed neutral for the same
 * reason; promoting this setter past them would overclaim. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e10.test.js.
 * GATE:     crafted-entry — attract never dispatches 0x1e10 (it plays level-1 25m only:
 *           armScorePopupAndSelectAward's `jp 0x1e10` tail needs level >= 3, and pickRandomAwardTier's `jp c,0x1e10`
 *           needs RNG 0x6018 bit1 set). Validated on (a) a GENUINE 0x1e10 entry forced
 *           down the pickRandomAwardTier RNG path (poke 0x6018 bit1 identically, real state
 *           otherwise), (b) real captured 0x1e15-boundary states — a faithful stageAward800Popup
 *           continuation, since stageAward800Popup reads neither B nor DE — and (c) a BOARD-
 *           exhaustive sweep (0..255) covering stampScorePopupSprite's 50m/100m closed sound gate.
 *           Teeth: wrong-B (caught at record byte 0x6A31) and wrong-E (caught at the
 *           task ring's argument byte).
 * LIVE-OUT: memory-only — everything is written by the stageAwardPopupAtHitObject chain: the task ring +
 *           TASK_TAIL (via enqueueTask), the block[0] clear at *(0x6343), and the sprite
 *           record 0x6A30..0x6A33 + gate-open 0x6085 (via stampScorePopupSprite). B/D/E are set only
 *           as stageAwardPopupAtHitObject's live-in and are consumed within this same dispatch; the caller
 *           (armScorePopupAndSelectAward / pickRandomAwardTier tail-jump here) reads no register afterward. SP/pc are
 *           the dropped stack model — the oracle's tail-jump becomes the JS call.
 * NAMES:    stageAwardPopupAtHitObject (ROM 0x1E15) is the idiomatic feeder, imported and called directly;
 *           it owns all the RAM writes and their names.js names. The literals 0x7F (B, the
 *           sprite code byte) and 0x0008 (DE, the deferred-task message) are this setter's
 *           fixed parameters, kept as literals exactly as the oracle loads them.
 */
import { stageAwardPopupAtHitObject } from "./stageAwardPopupAtHitObject.js"; // ROM 0x1E15 — the shared feeder

export function stageAward800Popup(m) {
  const { regs } = m;

  // The setter's fixed parameters: B = the effect sprite's code byte; DE = the
  // deferred-task message (D = opcode 0x00, E = argument 0x08).
  regs.b = 0x7f;
  regs.de = 0x0008;

  // `jp 0x1e15` — tail-jump into the shared feeder. B and DE are its live-in.
  stageAwardPopupAtHitObject(m);
}
