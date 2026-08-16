// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginNextLifeOrIntro — the continue / next-life path. Redraws the score header, then if no life
 * remains (the restart gate is zero) resumes the play loop at the pace tail. Otherwise it re-activates
 * the frog, clears the active player's work RAM, zeroes the per-life HUD cells and the fourteen-byte
 * HUD slot block, plays the restart jingle, and either runs the intro countdown (when the intro gate
 * is set) or hands play to the other player before resuming. LIVE-OUT: memory-only.
 */
import { SCORE_DISPLAY_CURSOR_LO, SCORE_DISPLAY_CURSOR_HI, loc_83cc, BOARD_LAYOUT_GATE, loc_83cf, PACE_TAIL } from "./names.js";
import { renderScoreHeader } from "./renderScoreHeader.js";
import { activateFrogObject } from "./activateFrogObject.js";
import { clearActivePlayerWorkRam } from "./clearActivePlayerWorkRam.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { handOffToOtherPlayer } from "./handOffToOtherPlayer.js";

const LIFE_RESTART_FLAG = 0x83ce; // zero resumes play, non-zero runs the next-life setup
const PER_LIFE_HUD_BASE = 0x83a0;
const RUN_INTRO_TIMER = 0x048f; // intro-countdown entry, still served by the frozen layer
const RESTART_SOUND = 0x80;

export function beginNextLifeOrIntro(m) {
  const { regs, mem8 } = m;

  renderScoreHeader(m);
  if (mem8[LIFE_RESTART_FLAG] === 0) return m.call(PACE_TAIL);

  activateFrogObject(m);
  clearActivePlayerWorkRam(m);
  mem8[SCORE_DISPLAY_CURSOR_LO] = 0;
  mem8[SCORE_DISPLAY_CURSOR_HI] = 0;
  mem8[loc_83cc] = 0;
  mem8[BOARD_LAYOUT_GATE] = 0;
  for (let i = 0; i < 14; i++) mem8[PER_LIFE_HUD_BASE + i] = 0;

  regs.a = RESTART_SOUND;
  enqueueSoundCommand(m);

  if (mem8[loc_83cf] !== 0) return m.call(RUN_INTRO_TIMER);
  handOffToOtherPlayer(m);
  return m.call(PACE_TAIL);
}
