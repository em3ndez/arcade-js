// SPDX-License-Identifier: GPL-3.0-only
/**
 * armScorePopupAndSelectAward — the score-popup machine's arm step: start the display countdown,
 * advance EFFECT_STATE to the countdown state, and hand off to one of five award-value setters.
 *
 * EFFECT_TIMER and EFFECT_STATE are written unconditionally on every path, so entering here always
 * commits the popup. The setter is chosen from the low three bits of EFFECT_SELECT, first set bit
 * winning: bit 0 -> tier from the remaining select bits (only the two above bit 0 matter); bit 1 ->
 * a fixed value; bit 2 -> a random tier; no bit set -> cue the award sound and pick by LEVEL (1 ->
 * low, 2 -> middle, else high). Each is a hand-off, not a call that returns.
 *
 * LIVE-OUT: memory-only — EFFECT_TIMER and EFFECT_STATE on every path, the award sound shadow on the
 * LEVEL path, and whatever the chosen setter stages.
 */
import { LEVEL, SND_TRIGGER, EFFECT_STATE, EFFECT_TIMER, EFFECT_SELECT } from "./names.js";
import { pickAwardTierByObjectCount } from "./pickAwardTierByObjectCount.js";
import { stageAward300Popup } from "./stageAward300Popup.js";
import { pickRandomAwardTier } from "./pickRandomAwardTier.js";
import { stageAward500Popup } from "./stageAward500Popup.js";
import { stageAward800Popup } from "./stageAward800Popup.js";

// The award sound-trigger shadow, cued only on the LEVEL path.
const EFFECT_SOUND = SND_TRIGGER + 5;

export function armScorePopupAndSelectAward(m) {
  const { mem8 } = m;

  mem8[EFFECT_TIMER] = 0x40;
  mem8[EFFECT_STATE] = 0x02;

  const select = mem8[EFFECT_SELECT];

  if (select & 0x01) {
    return pickAwardTierByObjectCount(m, select >> 1); // tier from the select bits above bit 0
  }
  if (select & 0x02) return stageAward300Popup(m);
  if (select & 0x04) return pickRandomAwardTier(m);

  mem8[EFFECT_SOUND] = 0x03;
  const level = mem8[LEVEL];
  if (level === 1) return stageAward300Popup(m);
  if (level === 2) return stageAward500Popup(m);
  return stageAward800Popup(m);
}
