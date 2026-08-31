// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { clearBoardRamAndBlankFillRow } from "./clearBoardRamAndBlankFillRow.js";
import { armTileFillFromPlayfieldBase } from "./armTileFillFromPlayfieldBase.js";
import { clearActorArena } from "./clearActorArena.js";
import { fillByteRun } from "./fillByteRun.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
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
 * initRoundArenaAndRestorePlayerBank — round-init handler (ROM 0x1601).
 *
 * WHAT IT IS
 *   The very first handler of the in-play sub-state machine (index 0). While a round is
 *   playing, every frame the game descends three dispatch levels — main loop → main game
 *   state → in-play sub-state — and the low bits of PLAY_STATE_INDEX (0x880a) pick which
 *   sub-state handler runs. Index 0 is round setup: it stands up the playfield and the
 *   actor arena for a fresh round, then hands the round on to index 1 by bumping the index.
 *
 * ROLE IN THE MACHINE
 *   This is where a round is born. It (a) paints the tilemap in over several frames, one
 *   row at a time, gating itself until that fill drains; (b) wipes the actor arena and the
 *   round-init RAM cells left over from the previous round; (c) on the first entry of a
 *   round does the one-time cosmetic setup (screen-flip orientation, a player-select
 *   banner, the colour/attribute flood) behind a once-per-round latch; and (d) restores
 *   the active player's saved state page into the live page so a returning player resumes
 *   exactly where they paused, seeds the phase timer that paces the next step, sets the
 *   rope-segment count for the wave, and copies the round message string onto the field.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only. This handler communicates entirely through RAM and returns no
 *   value. Across its exits it leaves: the round-init cells and actor arena cleared;
 *   PHASE_TIMER (0x8808) seeded; PLAY_STATE_INDEX (0x880a) advanced by one; the live
 *   state page at SPEED_INDEX (0x8900) reloaded from the active player's bank;
 *   ROPE_SEGMENT_COUNT (0x8931) set from the wave-arrival counter; and (unless gated)
 *   the round message copied into DISPLAY_MSG_BUF (0x89f0).
 */

// --- Round-init constants (magnitudes and sentinels used below) --------------------------
const CLEAR_A_LEN = 0xc0; //        bytes zeroed from the first round-init block (at 0x8d23)
const CLEAR_B_LEN = 0x0c; //        bytes zeroed from the second round-init block (at 0x8e21)
const BANK_SIZE = 0x3f; //          bytes restored from the saved player bank into the live page
const LIVE_STATE_PAGE = SPEED_INDEX; // base (0x8900) of the live actor/state page
const PHASE_TIMER_SINGLE = 0x02; // phase-timer seed for a one-player round / non-first entry
const PHASE_TIMER_FIRST = 0x80; //  longer phase-timer seed on the first entry of a round
const ROPE_SEG_BIAS = 0x02; //      subtracted from the wave-arrival count for the rope-segment count
const MSG_TERMINATOR = 0xff; //     ends the round-message copy (the 0xff byte is not stored)

export function initRoundArenaAndRestorePlayerBank(m) {
  const { mem8 } = m;

  // Fill-drain gate. The playfield tilemap is painted in over successive frames, one row
  // per entry; clearBoardRamAndBlankFillRow (ROM 0x02c9) blanks the next row of board RAM
  // and reports whether the whole fill has drained yet. Until it has, bail out for this
  // frame so the field appears row-by-row rather than all at once.
  if (!clearBoardRamAndBlankFillRow(m)) return; // fill not yet drained
  // Fill drained: re-seat the scroll/playfield pointer to the base (ROM 0x02e3) and wipe
  // the actor arena (ROM 0x19bc) so no sprites survive from the previous round.
  armTileFillFromPlayfieldBase(m);
  clearActorArena(m);

  // Clear the round-init RAM cells carried over from the last round. WAVE_EVENT_LATCH
  // (0x8d21) is the periodic-event one-shot; the two byte runs blank the round-init blocks
  // at 0x8d23 (0xc0 bytes) and 0x8e21 (0x0c bytes); ROPE_EXTEND_TIMER (0x8f16) and 0x8f17
  // are the rope-extend sub-timer pair. All start the round at zero.
  mem8[WAVE_EVENT_LATCH] = 0x00;
  fillByteRun(m, loc_8d23, 0x00, CLEAR_A_LEN);
  fillByteRun(m, loc_8e21, 0x00, CLEAR_B_LEN);
  mem8[ROPE_EXTEND_TIMER] = 0x00;
  mem8[loc_8f17] = 0x00;

  // Choose the phase-timer seed, and (only on the first entry of a two-player round) run
  // the one-time cosmetic setup behind a once-per-round latch.
  let phaseTimer;
  if (mem8[TWO_PLAYER_FLAG] === 0) {
    // One-player game (TWO_PLAYER_FLAG at 0x880e is 0): always the short seed, no banner.
    phaseTimer = PHASE_TIMER_SINGLE;
  } else if (mem8[loc_89e3] !== 0) {
    // Two-player round whose once-per-round latch (0x89e3) is already raised: this is not
    // the first entry, so skip the cosmetic setup and reuse the latch value as the seed.
    phaseTimer = mem8[loc_89e3]; // latch already set this round
  } else {
    // First entry of a two-player round: raise the once-per-round latch (0x89e3) so the
    // block below runs exactly once, then do the one-time setup.
    mem8[loc_89e3] = 0x01; // raise the once-per-round latch
    // Derive the orientation value from the active player index (0x880d): player 0 -> 0xff,
    // player 1 -> 0x00.
    const player = (mem8[ACTIVE_PLAYER] - 1) & 0xff;
    // Upright cabinets (CABINET_MODE_FLAG at 0x880f == 0) set the screen-flip flag (0x881f)
    // per player so the display faces the active side; cocktail cabinets leave it alone.
    if (mem8[CABINET_MODE_FLAG] === 0) mem8[FLIP_SCREEN_FLAG] = player;
    // Enqueue the player-select banner display command — a different code per player side.
    enqueueDisplayCommand(m, player !== 0 ? DISPLAY_CMD_0602 : DISPLAY_CMD_0603);
    // Flood the colour/attribute columns from the ROM source table at 0x0779.
    fillAttributeColumns(m, ATTRACT_FIELD_ATTRIB_SRC);
    // First entry gets the longer phase-timer hold so the banner stays up.
    phaseTimer = PHASE_TIMER_FIRST;
  }

  // Shared tail (runs on every drained entry). Commit the chosen phase-timer seed into
  // PHASE_TIMER (0x8808), which the next handler counts down to pace the round, and step
  // PLAY_STATE_INDEX (0x880a) to index 1 so the following frame runs the next setup step.
  mem8[PHASE_TIMER] = phaseTimer;
  mem8[PLAY_STATE_INDEX] = mem8[PLAY_STATE_INDEX] + 1;

  // Restore the active player's saved state into the live page. Each player keeps a 0x3f-byte
  // saved bank (player 0 at 0x8940, player 1 at 0x8980); ACTIVE_PLAYER (0x880d) picks which,
  // and the block is copied into the live actor/state page at 0x8900 so a returning player
  // resumes exactly where they left off.
  const bank = mem8[ACTIVE_PLAYER] === 0 ? PLAYER0_STATE_BANK : PLAYER1_STATE_BANK;
  for (let i = 0; i < BANK_SIZE; i++) mem8[LIVE_STATE_PAGE + i] = mem8[bank + i];

  // Set the rope-segment count for this wave from the per-stage arrival counter
  // (WAVE_ARRIVAL_COUNTER at 0x8903): ROPE_SEGMENT_COUNT (0x8931) is bounded to arrivals - 2.
  // A zero arrival count leaves the segment count untouched.
  if (mem8[WAVE_ARRIVAL_COUNTER] !== 0) {
    mem8[ROPE_SEGMENT_COUNT] = mem8[WAVE_ARRIVAL_COUNTER] - ROPE_SEG_BIAS;
  }

  // Round-message copy — gated by 0x8906. When that guard cell is nonzero the message is
  // suppressed and the handler exits here.
  if (mem8[loc_8906] !== 0) return;
  // Otherwise clear the two message-control cells (0x8905 and 0x890a) before the copy.
  mem8[loc_8905] = 0x00;
  mem8[loc_890a] = 0x00;

  // Copy the 0xff-terminated round-message string from the ROM table at 0x16ae into the
  // display message buffer at 0x89f0, byte by byte, stopping at (and not storing) the
  // 0xff terminator.
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
