// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { queueSoundCommand0F } from "./queueSoundCommand0F.js";
import { scanDisplaySlotsAndTickBoardClear } from "./scanDisplaySlotsAndTickBoardClear.js";
import {
  FRAME_TIMER_BLOCK_BASE,
  FORMATION_SLOT_TABLE,
  HUNTER_SCRIPT_PTR,
  LAUNCH_SCRIPT_PTR,
  DIVE_SCRIPT_DATA,
  WAVE_TEARDOWN_STATE,
  FORMATION_STATE,
  PLAYER_Y,
} from "./names.js";

/**
 * advanceLeadHunterSwoopAndArmDive — the lead hunter's per-frame swoop step.
 *
 * WHAT IT IS
 *   Pooyan's hunters gather into a formation and then peel off to swoop across the play area. This
 *   is the second phase of the hunter-formation dispatcher (the launch phase seats the formation;
 *   this phase flies it). Once per frame it walks the lead hunter one step along a scripted path,
 *   and once the hunter has crossed the player's vertical position it ARMS A DIVE — repointing the
 *   hunter onto its dive script and latching the dive/teardown flags so the wave begins to attack.
 *   It closes by copying the lead hunter's live coordinates into three trailing display records, so
 *   the formation draws as a staggered group of four that all track the lead.
 *
 * ROLE IN THE MACHINE
 *   The lead hunter is one record; its pointer is the first word of the FORMATION_SLOT_TABLE
 *   (0x8920). The other three words of that table point at the display records this routine stamps.
 *   The hunter's motion is data-driven: a two-byte-per-entry script (pointer in HUNTER_SCRIPT_PTR,
 *   0x8f4b) supplies each frame's sub-pixel and screen-X advance. Arming latches LAUNCH_SCRIPT_PTR
 *   (0x8f4a, the dive-armed flag), WAVE_TEARDOWN_STATE (0x8f24) and FORMATION_STATE (0x8f08), which
 *   the other formation drivers read to run the attack/teardown; each significant transition also
 *   queues the fixed sound command 0x0f to the audio CPU.
 *
 * ROM 0x316e-0x323d.  Grounding: [seen].
 *
 * LIVE-OUT: on the main path IX (advanced to FORMATION_SLOT_TABLE+8) and B (drained to 0), inherited
 * from the four-slot-scan tail and defensive there (that scan records no verified consumer). The early
 * wave-timer countdown returns with the registers untouched.
 */

// --- Lead-hunter record field offsets (relative to the record pointer in FORMATION_SLOT_TABLE[0]) ---
const REC_X = 0x03; //         hunter rec+3: whole-pixel screen X (the drawn horizontal position)
const REC_X_STEP = 0x04; //    hunter rec+4: X carry / tile-column progress; folds into the dive threshold
const REC_SUBPIXEL_LO = 0x05; // hunter rec+5: sub-pixel X, low byte (fractional accumulator)
const REC_SUBPIXEL_HI = 0x06; // hunter rec+6: sub-pixel X, high byte (carry out of rec+5)
const REC_DWELL = 0x09; //     hunter rec+9: dwell counter, ticked while the script byte is zero
// --- Gate thresholds and stamp geometry ---
const DIVE_TILE_LIMIT = 0x1b; // rec+4 tile-column at which the armed dive re-primes the wave timer
const THRESHOLD_BIAS = 0x18; // added to the rotated rec+4 to form the player-crossing dive threshold
const DISPLAY_RECORD_COUNT = 0x04; // display slots the tail board-clear scan walks (the four formation slots)
const OFFSET_STAMP = 0x03; //  each display record is stamped three bytes past the pointer it holds
const SLOT_BUMP = 0x02; //     the +2 bias applied to the tile-progress / sub-pixel-high bytes of some records

// rotate-left-by-3 of an 8-bit value: spreads rec+4's tile progress into a coarser screen-space threshold
const rotl3 = (v) => ((v << 3) | (v >> 5)) & 0xff;

export function advanceLeadHunterSwoopAndArmDive(m) {
  const { mem8 } = m;

  // Wave timer (0x8928): the formation holds for a fixed number of frames between swoop advances.
  // While the timer is nonzero, spend one frame counting it down and do nothing else this frame.
  // wave timer: count down and return until it reaches zero
  if (mem8[FRAME_TIMER_BLOCK_BASE] !== 0) {
    mem8[FRAME_TIMER_BLOCK_BASE] = mem8[FRAME_TIMER_BLOCK_BASE] - 1;
    return;
  }

  // Resolve the lead hunter's record: its 16-bit base pointer is the first word of the
  // FORMATION_SLOT_TABLE (0x8920/0x8921, low byte first). All rec+N accesses below hang off it.
  // the lead hunter's record pointer is the FORMATION_SLOT_TABLE word
  const hunter = mem8[FORMATION_SLOT_TABLE] | (mem8[u16(FORMATION_SLOT_TABLE + 1)] << 8);

  // Fetch the current script instruction: HUNTER_SCRIPT_PTR (0x8f4b) is a 16-bit read cursor into the
  // hunter's active movement script (the swoop script before the dive arms, the dive script after). The byte it
  // points at selects this frame's motion mode.
  const scriptPtr = mem8[HUNTER_SCRIPT_PTR] | (mem8[u16(HUNTER_SCRIPT_PTR + 1)] << 8);
  const scriptByte = mem8[scriptPtr];

  let carry; // the amount added into the hunter's X below
  if (scriptByte === 0) {
    // Motion mode A — dwell. A zero script byte means "hold this script step": tick the dwell counter
    // (rec+9); when it wraps 0xff->0x00 nudge the tile-progress byte (rec+4) forward one. The dwell
    // value itself becomes the amount carried into the screen-X advance below, so a dwelling hunter
    // still creeps sideways. The script pointer is NOT consumed here — the zero byte is revisited.
    // dwell: tick rec+9, step rec+4 on its wrap
    const dwell = u8(mem8[u16(hunter + REC_DWELL)] + 1);
    mem8[u16(hunter + REC_DWELL)] = dwell;
    if (dwell === 0) mem8[u16(hunter + REC_X_STEP)] = mem8[u16(hunter + REC_X_STEP)] + 1;
    carry = dwell;
  } else {
    // Motion mode B — scripted step. Add the script byte into the sub-pixel X accumulator (rec+5),
    // carrying overflow into rec+6. The second byte of the two-byte script entry is the whole-pixel
    // X advance carried below; then advance HUNTER_SCRIPT_PTR past this two-byte entry so the next
    // frame reads the following instruction.
    // step the sub-pixel X by the script byte, carrying into rec+6
    const sub = mem8[u16(hunter + REC_SUBPIXEL_LO)] + scriptByte;
    mem8[u16(hunter + REC_SUBPIXEL_LO)] = sub;
    if (sub > 0xff) mem8[u16(hunter + REC_SUBPIXEL_HI)] = mem8[u16(hunter + REC_SUBPIXEL_HI)] + 1;
    // consume a two-byte script entry; its second byte is the X advance
    const next = u16(scriptPtr + 1);
    carry = mem8[next];
    const advanced = u16(next + 1);
    mem8[HUNTER_SCRIPT_PTR] = advanced;
    mem8[u16(HUNTER_SCRIPT_PTR + 1)] = advanced >> 8;
  }

  // Commit the horizontal move: add the carried amount into the whole-pixel screen X (rec+3). An
  // overflow past 0xff steps the tile-progress byte (rec+4) forward — that byte is what the dive
  // gate measures below, so it tracks how far the hunter has travelled across the field.
  // advance the hunter's X by the carried amount, stepping rec+4 on overflow
  const xSum = carry + mem8[u16(hunter + REC_X)];
  if (xSum > 0xff) mem8[u16(hunter + REC_X_STEP)] = mem8[u16(hunter + REC_X_STEP)] + 1;
  mem8[u16(hunter + REC_X)] = xSum;

  // The dive gate. LAUNCH_SCRIPT_PTR (0x8f4a) doubles as the dive-armed flag: nonzero means the dive
  // has already been armed on an earlier frame. rec+4 (tile progress) is the quantity both branches test.
  const diveArmed = mem8[LAUNCH_SCRIPT_PTR] !== 0;
  const step = mem8[u16(hunter + REC_X_STEP)];
  if (diveArmed) {
    // Already diving. Once the hunter has run out to tile 0x1b, re-prime the wave timer (0x8928) from
    // the tile-progress value and advance the formation launch state (0x8f08) so the next formation
    // phase takes over; announce the transition with sound command 0x0f.
    // past tile 0x1b: re-prime the wave timer and bump the formation state
    if (step >= DIVE_TILE_LIMIT) {
      mem8[FRAME_TIMER_BLOCK_BASE] = step;
      mem8[FORMATION_STATE] = mem8[FORMATION_STATE] + 1;
      queueSoundCommand0F(m);
    }
  } else {
    // Not yet armed. Fold rec+4 into a screen-space threshold (rotate-left-3 then + 0x18) and compare
    // it against the player's vertical position PLAYER_Y (0x8a84). When the player sits above the
    // threshold the hunter has crossed the player, so arm the dive: latch the wave-teardown state
    // (0x8f24) and the dive-armed flag (0x8f4a), repoint the movement script at the ROM dive script
    // DIVE_SCRIPT_DATA (0x3348), and announce the dive with sound command 0x0f.
    // arm the dive once the hunter crosses the player position
    const threshold = u8(rotl3(step) + THRESHOLD_BIAS);
    if (mem8[PLAYER_Y] < threshold) {
      mem8[WAVE_TEARDOWN_STATE] = 1;
      mem8[LAUNCH_SCRIPT_PTR] = 1;
      mem8[HUNTER_SCRIPT_PTR] = DIVE_SCRIPT_DATA;
      mem8[u16(HUNTER_SCRIPT_PTR + 1)] = DIVE_SCRIPT_DATA >> 8;
      queueSoundCommand0F(m);
    }
  }

  // Publish the lead hunter's position into the three trailing display records (their pointers are the
  // FORMATION_SLOT_TABLE words at +2/+4/+6). Each record gets four bytes written three past its
  // pointer: screen X (rec+3), a tile-progress byte, sub-pixel-low (rec+5), and a sub-pixel-high byte.
  // The tile-progress (c = rec+4) and sub-pixel-high (b = rec+6) are read once; the +2 biasing below
  // staggers the three followers around the lead so the formation reads as a spread group.
  // stamp the hunter's live coordinates into the three display records; C (rec+4) and B (rec+6) are
  // captured once, while X (rec+3) and the sub-pixel low (rec+5) are re-read per record
  const c = mem8[u16(hunter + REC_X_STEP)];
  const b = mem8[u16(hunter + REC_SUBPIXEL_HI)];
  const stamp = (ptrCell, byte2, byte4) => {
    let dst = u16((mem8[ptrCell] | (mem8[u16(ptrCell + 1)] << 8)) + OFFSET_STAMP);
    mem8[dst] = mem8[u16(hunter + REC_X)];
    dst = u16(dst + 1);
    mem8[dst] = byte2;
    dst = u16(dst + 1);
    mem8[dst] = mem8[u16(hunter + REC_SUBPIXEL_LO)];
    dst = u16(dst + 1);
    mem8[dst] = byte4;
  };
  // Follower 1 at the same tile column, one sub-pixel band down (+2 on the high byte).
  stamp(u16(FORMATION_SLOT_TABLE + 0x02), c, u8(b + SLOT_BUMP));
  // Follower 2 one tile column over (+2 on the progress byte), same sub-pixel band.
  stamp(u16(FORMATION_SLOT_TABLE + 0x04), u8(c + SLOT_BUMP), b);
  // Follower 3 offset on both axes (+2 on each), diagonally trailing the lead.
  stamp(u16(FORMATION_SLOT_TABLE + 0x06), u8(c + SLOT_BUMP), u8(b + SLOT_BUMP));

  // Fall into the shared four-slot board-clear scan over the FORMATION_SLOT_TABLE records, which ticks
  // the per-slot return counter and diverts to the board-clear path when the board is complete.
  return scanDisplaySlotsAndTickBoardClear(m, FORMATION_SLOT_TABLE, DISPLAY_RECORD_COUNT);
}
