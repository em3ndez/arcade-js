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
 * advanceLeadHunterSwoopAndArmDive — the lead-hunter swoop step.
 *
 * A wave timer runs first: while it is nonzero it just counts down and returns. Once it reaches zero
 * the lead hunter (its record pointer is the FORMATION_SLOT_TABLE word) is advanced. A byte pulled
 * from the active movement script decides the motion: a nonzero byte steps the hunter's 16-bit
 * sub-pixel X (rec+5/rec+6) by that amount, consumes a two-byte script entry, and carries the entry's
 * second byte into the X advance; a zero byte instead ticks a dwell counter (rec+9), stepping rec+4
 * on its wrap, and carries the dwell into the X advance. Either way the carried amount is added into
 * the hunter's X (rec+3), stepping rec+4 on overflow.
 *
 * Then one of two gates fires. While the dive is not yet armed, the hunter's rec+4 is folded (rotate
 * left 3, +0x18) into a screen threshold and, once it crosses the player position, the dive is armed:
 * the teardown state and the dive flag are latched, the script pointer is pointed at the dive script,
 * and a ring command is queued. While the dive IS armed, once rec+4 reaches tile 0x1b the wave timer
 * is re-primed from rec+4, the formation state is bumped, and a ring command is queued.
 *
 * Finally the hunter's live coordinates are stamped into three display records (their pointers sit at
 * FORMATION_SLOT_TABLE+2/+4/+6), and the routine falls into the four-slot board-clear scan.
 *
 * LIVE-OUT: on the main path IX (advanced to FORMATION_SLOT_TABLE+8) and B (drained to 0), inherited
 * from the four-slot-scan tail and defensive there (that scan records no verified consumer). The early
 * wave-timer countdown returns with the registers untouched.
 */

const REC_X = 0x03; //         hunter rec+3: screen X
const REC_X_STEP = 0x04; //    hunter rec+4: X carry / tile progress
const REC_SUBPIXEL_LO = 0x05; // hunter rec+5: sub-pixel X low
const REC_SUBPIXEL_HI = 0x06; // hunter rec+6: sub-pixel X high
const REC_DWELL = 0x09; //     hunter rec+9: dwell counter
const DIVE_TILE_LIMIT = 0x1b; // rec+4 tile at which the armed dive re-primes the wave timer
const THRESHOLD_BIAS = 0x18; // added to the rotated rec+4 to form the player-crossing threshold
const DISPLAY_RECORD_COUNT = 0x04; // display slots the tail scan walks
const OFFSET_STAMP = 0x03; //  each display record is stamped three bytes past its pointer
const SLOT_BUMP = 0x02; //     the +2 bias applied to the counter/base bytes of some records

const rotl3 = (v) => ((v << 3) | (v >> 5)) & 0xff;

export function advanceLeadHunterSwoopAndArmDive(m) {
  const { mem8 } = m;

  // wave timer: count down and return until it reaches zero
  if (mem8[FRAME_TIMER_BLOCK_BASE] !== 0) {
    mem8[FRAME_TIMER_BLOCK_BASE] = mem8[FRAME_TIMER_BLOCK_BASE] - 1;
    return;
  }

  // the lead hunter's record pointer is the FORMATION_SLOT_TABLE word
  const hunter = mem8[FORMATION_SLOT_TABLE] | (mem8[u16(FORMATION_SLOT_TABLE + 1)] << 8);

  const scriptPtr = mem8[HUNTER_SCRIPT_PTR] | (mem8[u16(HUNTER_SCRIPT_PTR + 1)] << 8);
  const scriptByte = mem8[scriptPtr];

  let carry; // the amount added into the hunter's X below
  if (scriptByte === 0) {
    // dwell: tick rec+9, step rec+4 on its wrap
    const dwell = u8(mem8[u16(hunter + REC_DWELL)] + 1);
    mem8[u16(hunter + REC_DWELL)] = dwell;
    if (dwell === 0) mem8[u16(hunter + REC_X_STEP)] = mem8[u16(hunter + REC_X_STEP)] + 1;
    carry = dwell;
  } else {
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

  // advance the hunter's X by the carried amount, stepping rec+4 on overflow
  const xSum = carry + mem8[u16(hunter + REC_X)];
  if (xSum > 0xff) mem8[u16(hunter + REC_X_STEP)] = mem8[u16(hunter + REC_X_STEP)] + 1;
  mem8[u16(hunter + REC_X)] = xSum;

  const diveArmed = mem8[LAUNCH_SCRIPT_PTR] !== 0;
  const step = mem8[u16(hunter + REC_X_STEP)];
  if (diveArmed) {
    // past tile 0x1b: re-prime the wave timer and bump the formation state
    if (step >= DIVE_TILE_LIMIT) {
      mem8[FRAME_TIMER_BLOCK_BASE] = step;
      mem8[FORMATION_STATE] = mem8[FORMATION_STATE] + 1;
      queueSoundCommand0F(m);
    }
  } else {
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
  stamp(u16(FORMATION_SLOT_TABLE + 0x02), c, u8(b + SLOT_BUMP));
  stamp(u16(FORMATION_SLOT_TABLE + 0x04), u8(c + SLOT_BUMP), b);
  stamp(u16(FORMATION_SLOT_TABLE + 0x06), u8(c + SLOT_BUMP), u8(b + SLOT_BUMP));

  return scanDisplaySlotsAndTickBoardClear(m, FORMATION_SLOT_TABLE, DISPLAY_RECORD_COUNT);
}
