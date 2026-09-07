// SPDX-License-Identifier: GPL-3.0-only
// packFlagsToBitmapAndSwitchPlayerState -- ROM 0x073d, grounding [seen].
// The terminal state (index 7 of runPlayerOnePlayFrame's dispatch table). It
// first runs down a dwell timer; while the timer is still counting it just
// returns and stays in this state. When the timer expires it clears the
// sequence/inhibit state, snapshots the live board by packing the flag bytes
// into PACKED_FLAG_BITMAP (0x4180) and copying an 8-byte companion template
// after it, then switches player state -- setting CURRENT_PLAYER (0x400d) = 1
// and advancing GAME_STATE (0x4005) = 4. (Its mirror,
// saveFlagsToSnapshotAndSwitchPlayerState, packs into SAVED_STATE_SNAPSHOT and
// sets CURRENT_PLAYER = 0 / GAME_STATE = 3.)
// Live-out: SEQUENCE_STATE, loc_4222, loc_422b cleared; PACKED_FLAG_BITMAP + 8
// template bytes written; CURRENT_PLAYER = 1; GAME_STATE = 4.
import { packFlagBytesToBitmask } from "./packFlagBytesToBitmask.js";
import {
  loc_4009,
  SEQUENCE_STATE,
  loc_4222,
  loc_422b,
  PACKED_FLAG_BITMAP,
  loc_4218,
  CURRENT_PLAYER,
  GAME_STATE,
} from "./names.js";

// Number of template bytes copied just after the packed bitmap, and the game
// state (4) this terminal advances to.
const TEMPLATE_BYTES = 8;
const NEXT_STATE = 4;

export function packFlagsToBitmapAndSwitchPlayerState(m) {
  const { mem8 } = m;

  // Dwell timer: decrement loc_4009 (0x4009) mod 256 and stay in this state
  // until it reaches zero, so the switch waits out the between-turns pause.
  const remaining = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = remaining;
  if (remaining !== 0) return;

  // Timer expired -- clear the sequence state machine SEQUENCE_STATE (0x400a)
  // and two status/inhibit cells (loc_4222, loc_422b) before the handoff.
  mem8[SEQUENCE_STATE] = 0;
  mem8[loc_4222] = 0;
  mem8[loc_422b] = 0;

  // Freeze the board: pack the 128 flag bytes into PACKED_FLAG_BITMAP (0x4180).
  // packFlagBytesToBitmask returns the pointer just past the 16-byte bitmap,
  // which is where the 8-byte companion template (from loc_4218) is copied.
  const dst = packFlagBytesToBitmask(m, PACKED_FLAG_BITMAP);
  for (let i = 0; i < TEMPLATE_BYTES; i++) mem8[dst + i] = mem8[loc_4218 + i];

  // Switch player state: set the current-player index CURRENT_PLAYER (0x400d) to
  // 1 and advance GAME_STATE (0x4005) to 4, the next top-level machine step.
  mem8[CURRENT_PLAYER] = 1;
  mem8[GAME_STATE] = NEXT_STATE;
}
