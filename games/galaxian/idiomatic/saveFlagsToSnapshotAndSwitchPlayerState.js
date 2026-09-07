// SPDX-License-Identifier: GPL-3.0-only
/**
 * saveFlagsToSnapshotAndSwitchPlayerState — player-2 board terminal: snapshot the field and hand back to
 * player 1.
 *
 * WHAT IT IS
 *   A state-machine terminal handler (index 7 of runPlayerTwoPlayFrame's sub-state table). Most frames it
 *   just ticks a dwell timer and does nothing; on the frame that timer expires it tears down this player's
 *   turn: it resets the sequence/player cells, selects the next game state, packs the live formation flags
 *   into player 2's saved-state block, and copies an 8-byte companion block right after them so the board
 *   can be restored when this player is dealt back in.
 *
 * ROLE IN THE MACHINE
 *   ROM 0x0818. The mirror of packFlagsToBitmapAndSwitchPlayerState (0x073d, player 1's terminal): where
 *   that one packs into PACKED_FLAG_BITMAP (0x4180), sets CURRENT_PLAYER=1 and moves to GAME_STATE 4, this
 *   one packs into SAVED_STATE_SNAPSHOT (0x41a0), sets CURRENT_PLAYER=0 and drops GAME_STATE to 3 — i.e.
 *   ends player 2's board and returns control to player 1 (game-state 3). The pack is done by
 *   packFlagBytesToBitmask (0x0764), which reads bit 0 of the 128 flag bytes at FLAG_BITS_BASE (0x4100),
 *   LSB-first, into a 16-byte bitmap and returns the destination advanced +16 for the chained block copy.
 *
 *   Grounding: [seen].
 *
 * LIVE-OUT: memory only — SEQUENCE_STATE, CURRENT_PLAYER, GAME_STATE, and the saved-state block at
 * SAVED_STATE_SNAPSHOT plus its trailing companion bytes; no register result the caller reads.
 */
import { packFlagBytesToBitmask } from "./packFlagBytesToBitmask.js";
import {
  loc_4009, SEQUENCE_STATE, CURRENT_PLAYER, GAME_STATE,
  SAVED_STATE_SNAPSHOT, loc_4218,
} from "./names.js";

// The companion block copied after the packed bitmap is the 8-byte board template kept at loc_4218 (the
// same 8 bytes the restore/entry handlers seed and read back).
const COMPANION_BYTES = 8;

export function saveFlagsToSnapshotAndSwitchPlayerState(m) {
  const { mem8 } = m;

  // Tick the dwell timer (loc_4009) down one, wrapping in 8 bits. While it is still counting there is
  // nothing to do this frame — the turn stays up until the timer drains.
  const remaining = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = remaining;
  if (remaining !== 0) return;

  // Timer expired: reset the sequence step and active-player cells, and pick the next game state. Setting
  // GAME_STATE=3 hands play back to player 1; CURRENT_PLAYER=0 marks player 1 as the active side again.
  mem8[SEQUENCE_STATE] = 0;
  mem8[CURRENT_PLAYER] = 0;
  mem8[GAME_STATE] = 3;

  // Snapshot the packed formation flags into player 2's saved-state block at SAVED_STATE_SNAPSHOT; the
  // pack returns the destination pointer advanced past the 16-byte bitmap...
  const after = packFlagBytesToBitmask(m, SAVED_STATE_SNAPSHOT);
  // ...and the 8-byte companion block (loc_4218) is copied right after it, so restore reads one contiguous
  // saved record when this player is dealt back in.
  for (let i = 0; i < COMPANION_BYTES; i++) mem8[after + i] = mem8[loc_4218 + i];
}
