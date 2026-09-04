// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { objectMatchesDrawPhase } from "./objectMatchesDrawPhase.js";
import { drawSaucerSprite } from "./drawSaucerSprite.js";
import { loc_050f } from "./loc_050f.js";
import { playSaucerHitSoundAndDrawSprite } from "./playSaucerHitSoundAndDrawSprite.js";
import { awardSaucerScore } from "./awardSaucerScore.js";
import { clearSoundPort3Bit } from "./clearSoundPort3Bit.js";
import { resolveSpriteScreenAddr } from "./resolveSpriteScreenAddr.js";
import { clearScreenStrip } from "./clearScreenStrip.js";
import { copyTemplateToRecord } from "./copyTemplateToRecord.js";
import { stopSaucerSound } from "./stopSaucerSound.js";
import { loc_2080, loc_2083, loc_2056, SAUCER_ACTIVE, ALIEN_COUNT, loc_208a, loc_208c, SAUCER_HIT, loc_2086, SOUND_PORT5_SHADOW } from "./names.js";

// The mystery-ship object handler. Only runs in the saucer mode; otherwise it hands off to the plain step
// handler. When no saucer is on the field it launches one (once enough aliens are gone) and draws it. Then,
// gated on the draw phase: if the saucer is alive it walks across the row and stops at the screen edges; if
// it was just hit it counts its explosion phases down, cueing the hit sound, awarding the score, and
// silencing the tone, then clears the strip and reloads the record template.
export function loc_0682(m) {
  if (m.mem8[loc_2080] !== 2) return;
  if (m.mem8[loc_2083] === 0) return loc_050f(m);
  if (m.mem8[loc_2056] !== 0) return loc_050f(m);
  if (m.mem8[SAUCER_ACTIVE] === 0) {
    if (m.mem8[ALIEN_COUNT] < 8) return loc_050f(m);
    m.mem8[SAUCER_ACTIVE] = 1;
    drawSaucerSprite(m);
  }
  if (!objectMatchesDrawPhase(m, loc_208a)) return;
  if (m.mem8[SAUCER_HIT] === 0) {
    m.mem8[loc_208a] = u8(m.mem8[loc_208a] + m.mem8[loc_208c]);
    drawSaucerSprite(m);
    const x = m.mem8[loc_208a];
    if (x >= 40 && x < 225) return;
  } else {
    clearSoundPort3Bit(m, 0xfe);
    m.mem8[loc_2086] = u8(m.mem8[loc_2086] - 1);
    const phase = m.mem8[loc_2086];
    if (phase === 31) return playSaucerHitSoundAndDrawSprite(m);
    if (phase === 24) return awardSaucerScore(m);
    if (phase !== 0) return;
    m.mem8[SOUND_PORT5_SHADOW] &= 0xef;
    m.io.portOut(0x05, m.mem8[SOUND_PORT5_SHADOW] & 0x20);
  }
  resolveSpriteScreenAddr(m);
  clearScreenStrip(m);
  copyTemplateToRecord(m, loc_2083, 10);
  return stopSaucerSound(m);
}
