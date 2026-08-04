// SPDX-License-Identifier: GPL-3.0-only
/**
 * armScorePopupAndSelectAward — the score-popup machine's arm step: start the countdown the popup
 * will be shown for, advance the machine to its countdown state, and choose which award value
 * gets staged.
 *
 * A score popup is the small points figure that appears on screen when the player earns an
 * award. EFFECT_STATE walks that popup through idle, arm, display countdown and reset; this
 * routine is the one-shot the machine runs on entering the arm state.
 *
 * Two writes happen first and happen on EVERY path, before any choice is made: EFFECT_TIMER is
 * loaded with the count the display state will work back down, and EFFECT_STATE is stepped on to
 * that display state. Neither is conditional, so entering here always commits the popup.
 *
 * Then exactly one award value is staged, by handing control to one of five value setters. The
 * choice reads the low three bits of EFFECT_SELECT, first set bit winning:
 *
 *   - bit 0 — the tier is derived from the REMAINING select bits, which this routine passes on
 *     as a small number; only the two bits above bit 0 are read by that derivation, so the rest
 *     of the byte does not affect the award.
 *   - bit 1 — a fixed award value.
 *   - bit 2 — a tier drawn from the random byte, so this award varies from event to event.
 *   - no bit set — an award sound is cued, and the tier is taken from the current LEVEL
 *     instead: level 1 gets the low award, level 2 the middle one, and every other level
 *     (including 0) the high one. A player deeper into the game is paid more for the same event.
 *
 * Each of those five is a HAND-OFF, not a call that comes back — this routine's own work is
 * finished by the time the choice is made, and the setter finishes the popup.
 *
 * LIVE-OUT: memory-only — EFFECT_TIMER and EFFECT_STATE on every path, the award sound latch on
 * the LEVEL path, and whatever the chosen setter stages for itself.
 */
import { LEVEL, SND_TRIGGER, EFFECT_STATE, EFFECT_TIMER, EFFECT_SELECT } from "./names.js";
import { pickAwardTierByObjectCount } from "./pickAwardTierByObjectCount.js";
import { stageAward300Popup } from "./stageAward300Popup.js";
import { pickRandomAwardTier } from "./pickRandomAwardTier.js";
import { stageAward500Popup } from "./stageAward500Popup.js";
import { stageAward800Popup } from "./stageAward800Popup.js";

/** The award sound latch, cued only on the LEVEL path. */
const EFFECT_SOUND = SND_TRIGGER + 5;

export function armScorePopupAndSelectAward(m) {
  const { regs, mem } = m;

  // On every path: load the display countdown, then advance the popup state.
  mem.write8(EFFECT_TIMER, 0x40);
  mem.write8(EFFECT_STATE, 0x02);

  // Choose the award from the low three bits of the select byte — first set bit wins.
  const select = mem.read8(EFFECT_SELECT);

  if (select & 0x01) {
    // The tier comes from the select bits ABOVE bit 0, so shift them down and hand them over.
    // Only two of them are read, which is why the bit shifted in at the top does not matter.
    regs.a = select >> 1;
    return pickAwardTierByObjectCount(m);
  }
  if (select & 0x02) return stageAward300Popup(m);
  if (select & 0x04) return pickRandomAwardTier(m);

  // No select bit set: cue the award sound, then pick the value by the current level.
  mem.write8(EFFECT_SOUND, 0x03);
  const level = mem.read8(LEVEL);
  if (level === 1) return stageAward300Popup(m);
  if (level === 2) return stageAward500Popup(m);
  return stageAward800Popup(m); // every other level, including 0
}
