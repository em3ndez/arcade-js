// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_02c9 } from "./loc_02c9.js";
import { loc_02e3 } from "./loc_02e3.js";
import { clearActorArena } from "./clearActorArena.js";
import { loc_0010 } from "./loc_0010.js";
import { loc_0038 } from "./loc_0038.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import {
  WAVE_EVENT_LATCH,
  loc_8d23,
  loc_8e21,
  ROPE_EXTEND_TIMER,
  loc_8f17,
  TWO_PLAYER_FLAG,
  loc_89e3,
  CABINET_MODE_FLAG,
  ACTIVE_PLAYER,
  FLIP_SCREEN_FLAG,
  DISPLAY_CMD_0602,
  DISPLAY_CMD_0603,
  ATTRACT_FIELD_ATTRIB_SRC,
  PHASE_TIMER,
  PLAY_STATE_INDEX,
  PLAYER0_STATE_BANK,
  PLAYER1_STATE_BANK,
  SPEED_INDEX,
  WAVE_ARRIVAL_COUNTER,
  ROPE_SEGMENT_COUNT,
  loc_8905,
  loc_8906,
  loc_890a,
  ROUND_INIT_MSG_TABLE,
  DISPLAY_MSG_BUF,
} from "./names.js";
/**
 * loc_1601 — round-init handler. Blanks one tilemap row and returns early until the fill drains;
 * once drained it re-arms the fill, clears the actor arena and several round-init cells, then on the
 * first entry of a two-player round raises the once-per-round latch, enqueues a player-select display
 * command, floods the colour/attribute map and picks the first-entry phase-timer seed. The shared
 * tail seeds the phase timer, advances the play sub-state, restores the active player's saved state
 * page into the live page, adjusts the rope-segment count, and (unless gated) copies the round message
 * table into the message buffer.
 *
 * LIVE-OUT: memory only. Every exit is a plain return of a dispatched state handler whose caller
 * does not read a result register back.
 */

const CLEAR_A_LEN = 0xc0; // bytes zeroed from the first round-init block
const CLEAR_B_LEN = 0x0c; // bytes zeroed from the second round-init block
const BANK_SIZE = 0x3f; //  bytes restored from the saved player bank into the live page
const LIVE_STATE_PAGE = SPEED_INDEX; // base of the live actor/state page
const PHASE_TIMER_SINGLE = 0x02; // phase-timer seed when not a two-player round
const PHASE_TIMER_FIRST = 0x80; //  phase-timer seed on the first entry of a round
const ROPE_SEG_BIAS = 0x02; //      subtracted from the arrival count for the rope-segment count
const MSG_TERMINATOR = 0xff; //     ends the round-message copy (not stored)

export function loc_1601(m) {
  const { mem8 } = m;

  if (!loc_02c9(m)) return; // fill not yet drained
  loc_02e3(m);
  clearActorArena(m);

  mem8[WAVE_EVENT_LATCH] = 0x00;
  loc_0010(m, loc_8d23, 0x00, CLEAR_A_LEN);
  loc_0010(m, loc_8e21, 0x00, CLEAR_B_LEN);
  mem8[ROPE_EXTEND_TIMER] = 0x00;
  mem8[loc_8f17] = 0x00;

  let phaseTimer;
  if (mem8[TWO_PLAYER_FLAG] === 0) {
    phaseTimer = PHASE_TIMER_SINGLE;
  } else if (mem8[loc_89e3] !== 0) {
    phaseTimer = mem8[loc_89e3]; // latch already set this round
  } else {
    mem8[loc_89e3] = 0x01; // raise the once-per-round latch
    const player = (mem8[ACTIVE_PLAYER] - 1) & 0xff;
    if (mem8[CABINET_MODE_FLAG] === 0) mem8[FLIP_SCREEN_FLAG] = player;
    loc_0038(m, player !== 0 ? DISPLAY_CMD_0602 : DISPLAY_CMD_0603);
    fillAttributeColumns(m, ATTRACT_FIELD_ATTRIB_SRC);
    phaseTimer = PHASE_TIMER_FIRST;
  }

  mem8[PHASE_TIMER] = phaseTimer;
  mem8[PLAY_STATE_INDEX] = mem8[PLAY_STATE_INDEX] + 1;

  const bank = mem8[ACTIVE_PLAYER] === 0 ? PLAYER0_STATE_BANK : PLAYER1_STATE_BANK;
  for (let i = 0; i < BANK_SIZE; i++) mem8[LIVE_STATE_PAGE + i] = mem8[bank + i];

  if (mem8[WAVE_ARRIVAL_COUNTER] !== 0) {
    mem8[ROPE_SEGMENT_COUNT] = mem8[WAVE_ARRIVAL_COUNTER] - ROPE_SEG_BIAS;
  }

  if (mem8[loc_8906] !== 0) return;
  mem8[loc_8905] = 0x00;
  mem8[loc_890a] = 0x00;

  let src = ROUND_INIT_MSG_TABLE;
  let dst = DISPLAY_MSG_BUF;
  for (;;) {
    const b = mem8[src];
    if (b === MSG_TERMINATOR) return;
    mem8[dst] = b;
    src = u16(src + 1);
    dst = u16(dst + 1);
  }
}
