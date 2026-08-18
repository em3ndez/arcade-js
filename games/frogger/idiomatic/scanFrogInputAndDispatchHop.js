// SPDX-License-Identifier: GPL-3.0-only
/**
 * scanFrogInputAndDispatchHop — the per-vblank frog input scan and directional hop dispatcher.
 * Returns early while input is locked (a transition gate cell, a counting hop-input timer that also
 * ticks the home-bay slot cursor, or the hit/hold flag). Otherwise, with the frog X/Y cursors armed,
 * it reads the active player's joystick and scans DOWN, UP, RIGHT, LEFT: a direction already mid-hop
 * tail-dispatches its advance handler; a freshly pressed one its begin handler; an idle one clears its
 * arrival and animation-counter cells. UP is skipped once RIGHT or LEFT is already hopping. Joystick is
 * active-low (a clear bit is a press). Player routing: IN2 bit 3 (cocktail) with ACTIVE_PLAYER selects
 * the port — RIGHT/LEFT read the player's main port (P1 IN0, P2 IN1) bits 4/5, while DOWN/UP sit on IN2
 * for P1 (bits 6/4) and cross to IN2 bit 0 / IN0 bit 0 for P2. LIVE-OUT: memory-only.
 */
import {
  HOLD_FLAG, ACTIVE_PLAYER, GATED_COUNTDOWN_ENABLE_FLAG, FROG_HOP_INPUT_TIMER,
  IN0_PORT, IN1_PORT, IN2_PORT,
  FROG_HOP_DOWN_ACTIVE, FROG_HOP_UP_ACTIVE, FROG_HOP_RIGHT_ACTIVE, FROG_HOP_LEFT_ACTIVE,
  FROG_HOP_DOWN_ARRIVAL, FROG_HOP_UP_ARRIVAL, FROG_HOP_RIGHT_ARRIVAL, FROG_HOP_LEFT_ARRIVAL,
  FROG_HOP_DOWN_ANIM_COUNTER, FROG_HOP_UP_ANIM_COUNTER, FROG_HOP_RIGHT_ANIM_COUNTER, FROG_HOP_LEFT_ANIM_COUNTER,
} from "./names.js";
import { loc_23eb } from "./loc_23eb.js";
import {
  beginFrogHopDown, advanceFrogHopDown, beginFrogHopUp, advanceFrogHopUp,
  beginFrogHopRight, advanceFrogHopRight, beginFrogHopLeft, advanceFrogHopLeft,
} from "./animateFrogHop.js";

const IN2_COCKTAIL_BIT = 0x08;
const DOWN_BIT_P1 = 0x40, UP_BIT_P1 = 0x10;
const DOWN_BIT_P2 = 0x01, UP_BIT_P2 = 0x01;
const RIGHT_BIT = 0x10, LEFT_BIT = 0x20;

export function scanFrogInputAndDispatchHop(m) {
  const { mem8 } = m;

  if (mem8[GATED_COUNTDOWN_ENABLE_FLAG] !== 0) return;

  if (mem8[FROG_HOP_INPUT_TIMER] !== 0) {
    mem8[FROG_HOP_INPUT_TIMER] = mem8[FROG_HOP_INPUT_TIMER] - 1;
    return loc_23eb(m);
  }

  if (mem8[HOLD_FLAG] !== 0) return;

  const p2 =(mem8[IN2_PORT] & IN2_COCKTAIL_BIT) !== 0 && mem8[ACTIVE_PLAYER] !== 1;
  const joy = p2 ? mem8[IN1_PORT] : mem8[IN0_PORT];

  if (mem8[FROG_HOP_DOWN_ACTIVE] !== 0) return advanceFrogHopDown(m);
  const downPressed = p2 ? (mem8[IN2_PORT] & DOWN_BIT_P2) === 0 : (mem8[IN2_PORT] & DOWN_BIT_P1) === 0;
  if (downPressed) return beginFrogHopDown(m);
  mem8[FROG_HOP_DOWN_ARRIVAL] = 0;
  mem8[FROG_HOP_DOWN_ANIM_COUNTER] = 0;

  if (mem8[FROG_HOP_UP_ACTIVE] !== 0) return advanceFrogHopUp(m);
  if (((mem8[FROG_HOP_RIGHT_ACTIVE] + mem8[FROG_HOP_LEFT_ACTIVE]) & 0xff) === 0) {
    const upPressed = p2 ? (mem8[IN0_PORT] & UP_BIT_P2) === 0 : (mem8[IN2_PORT] & UP_BIT_P1) === 0;
    if (upPressed) return beginFrogHopUp(m);
    mem8[FROG_HOP_UP_ARRIVAL] = 0;
    mem8[FROG_HOP_UP_ANIM_COUNTER] = 0;
  }

  if (mem8[FROG_HOP_RIGHT_ACTIVE] !== 0) return advanceFrogHopRight(m);
  if ((joy & RIGHT_BIT) === 0) return beginFrogHopRight(m);
  mem8[FROG_HOP_RIGHT_ARRIVAL] = 0;
  mem8[FROG_HOP_RIGHT_ANIM_COUNTER] = 0;

  if (mem8[FROG_HOP_LEFT_ACTIVE] !== 0) return advanceFrogHopLeft(m);
  if ((joy & LEFT_BIT) === 0) return beginFrogHopLeft(m);
  mem8[FROG_HOP_LEFT_ARRIVAL] = 0;
  mem8[FROG_HOP_LEFT_ANIM_COUNTER] = 0;
}
