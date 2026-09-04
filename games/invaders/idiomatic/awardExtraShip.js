// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { activePlayerFlagPtr } from "./activePlayerFlagPtr.js";
import { currentPlayerRecordPtr } from "./currentPlayerRecordPtr.js";
import { readActivePlayerPageTopByte } from "./readActivePlayerPageTopByte.js";
import { drawSpriteColumn } from "./drawSpriteColumn.js";
import { drawLivesDigit } from "./drawLivesDigit.js";
import { startSound } from "./startSound.js";
import { LIVES_DIGIT_SCREEN_ADDR, RESERVE_SHIP_SPRITE, SFX_OFF_TIMER } from "./names.js";

/**
 * awardExtraShip — grant the once-per-game bonus ship when the active player's score crosses the
 * dip-switch bonus threshold.
 *
 * WHAT IT IS
 *   Space Invaders gives each player one free ship the first time their score reaches a threshold
 *   (1000 or 1500 points, selectable by an operator dip switch). This routine is the gate + grant: it
 *   checks the "not yet awarded" flag, checks the score, and — if both allow — bumps the reserve-ship
 *   count, paints the newly-earned reserve-ship icon and redraws the lives digit, latches the flag so it can never fire
 *   again this game, and cues the award chime.
 *
 * ROLE IN THE MACHINE
 *   Called once per frame from the in-game main loop (mainLoop). The per-player "extra ship still
 *   available" flag lives in the EXTRA_SHIP_AWARD_FLAG pair (one byte per player); activePlayerFlagPtr returns the
 *   loc_20e7 pair slot for the active player, and this routine reads/writes two bytes below it
 *   (flagPtr - 2 -> the matching EXTRA_SHIP_AWARD_FLAG-pair byte). The bonus threshold is read live from input
 *   port 2 bit 3 (the bonus-score dip): set selects 0x10 (BCD 1000), clear selects 0x15 (BCD 1500).
 *   The score compared against it is the high byte of the active player's BCD score, i.e. the second
 *   byte of the descriptor from currentPlayerRecordPtr (PLAYER1_OBJ_DESC / PLAYER2_OBJ_DESC — the
 *   top two BCD digits). The reserve-ship count is the byte at the top of the active player's RAM
 *   page (page:0xff, via readActivePlayerPageTopByte). Granting draws one RESERVE_SHIP_SPRITE icon
 *   (RESERVE_SHIP_SPRITE 0x1c60) into the reserve-icon row, redraws the lives digit
 *   (drawLivesDigit -> LIVES_DIGIT_SCREEN_ADDR), and cues sound bit 4 (startSound 0x10) after seeding
 *   SFX_OFF_TIMER (0x2099) to 0xff so the chime rings its full window before advanceFleetMarchSound
 *   auto-silences it.
 *
 * ROM 0x0935.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: A = the port-3 sound latch (startSound's value-out) on the granting path; the early
 * returns leave the registers as the callee helpers left them. The effect is in memory + video RAM.
 */
export function awardExtraShip(m) {
  // Gate 1 — has this player already collected the bonus ship? activePlayerFlagPtr hands back the
  // active player's loc_20e7-pair slot; two bytes below it is the matching EXTRA_SHIP_AWARD_FLAG-pair byte, the
  // "extra ship not yet awarded" flag (startGameFlow seeds it to 1). Zero means already awarded: bail.
  const flagPtr = activePlayerFlagPtr(m);
  if (m.mem8[flagPtr - 2] === 0) return;

  // Gate 2 — has the score reached the bonus threshold? Input port 2 bit 3 is the operator bonus-score
  // dip: set picks 0x10 (BCD 1000), clear picks 0x15 (BCD 1500). The score to test is the high byte of
  // the active player's BCD total (currentPlayerRecordPtr + 1 = the descriptor's second byte, the top
  // two BCD digits). Below the threshold: not earned yet, bail.
  const threshold = (m.io.portIn(0x02) & 0x08) ? 0x10 : 0x15;
  const tally = m.mem8[currentPlayerRecordPtr(m) + 1];
  if (tally < threshold) return;

  // Grant — bump the reserve-ship count. readActivePlayerPageTopByte addresses the byte at the top of
  // the active player's page (page:0xff), which holds the reserve-ship count; add one for the new ship.
  const [countPtr] = readActivePlayerPageTopByte(m);
  m.mem8[countPtr] = u8(m.mem8[countPtr] + 1);
  const count = m.mem8[countPtr];

  // Paint the newly-earned icon. The reserve-ship icons sit in a row keyed off LIVES_DIGIT_SCREEN_ADDR:
  // start from that address's high byte (0x25) and step +2 per ship (`count` times), leaving the low
  // byte 0x01, so the icon lands in the column slot for the new ship count. Then blit a 16-row
  // RESERVE_SHIP_SPRITE column there.
  let hi = u8(LIVES_DIGIT_SCREEN_ADDR >> 8);
  let n = count;
  do { hi = u8(hi + 2); n = u8(n - 1); } while (n !== 0);
  drawSpriteColumn(m, (hi << 8) | (LIVES_DIGIT_SCREEN_ADDR & 0xff), RESERVE_SHIP_SPRITE, 0x10);

  // Update the numeric lives digit to count+1 (the reserves plus the ship in play), then latch the
  // award flag to 0 (re-read the pointer; the active player has not changed) so the bonus fires only
  // once per game.
  drawLivesDigit(m, u8(count + 1));
  m.mem8[activePlayerFlagPtr(m) - 2] = 0x00;

  // Cue the award chime: seed SFX_OFF_TIMER (0x2099) to 0xff so the one-shot has a long window, then
  // startSound(0x10) raises port-3 bit 4. advanceFleetMarchSound counts the timer down and clears the
  // bit when it expires, so the chime rings and then self-silences.
  m.mem8[SFX_OFF_TIMER] = 0xff;
  return startSound(m, 0x10);
}
