// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fillByteRun } from "./fillByteRun.js";
import { queueSoundCommand0E } from "./queueSoundCommand0E.js";
import { scanDisplaySlotsAndTickBoardClear } from "./scanDisplaySlotsAndTickBoardClear.js";
import {
  FORMATION_SLOT_TABLE,
  HUNTER_LAUNCH_PARAM_TABLE,
  FRAME_TIMER_BLOCK_BASE,
  FORMATION_STATE,
  FORMATION_LAUNCH_VRAM_CLEAR,
  HUNTER_SCRIPT_PTR,
  HUNTER_SCRIPT_TABLE,
  SELFCHECK_ROUTINE_BASE_ADDR,
  TAMPER_COPY_3278,
  BONUS_AWARD_DSW,
} from "./names.js";
/**
 * launchHunterFormationAndSeedSlots — hunter-formation launch (dispatch state 0).
 *
 * Seeds four formation-slot records (each pointed to by a slot-table entry) with four bytes from a
 * the parameter table plus a fixed frame delay; primes the frame-timer block and bumps the formation
 * state; blanks a 3x3 video block; seats the formation script pointer; emits a sound command and runs
 * the return-scan. It then verifies a self-check copy against its original; a mismatch wipes work
 * RAM upward from BONUS_AWARD_DSW.
 *
 * LIVE-OUT: none — a dispatch-state handler whose caller discards register results.
 */

const SLOT_COUNT = 0x04; //    formation slots seeded
const FRAME_DELAY = 0x30; //   per-slot delay written to record+9
const REC_ANIM = 0x04; //      record field <- param byte 0
const REC_COORD = 0x06; //     record field <- param byte 1
const REC_TILE_A = 0x0f; //    record field <- param byte 2
const REC_TILE_B = 0x10; //    record field <- param byte 3
const REC_DELAY = 0x09; //     record field <- FRAME_DELAY
const WAVE_TIMER_SEED = 0x0c; // value primed into the frame-timer block
const TILE_BLANK = 0x10; //    blank tile flooded into the video block
const BLANK_ROWS = 0x03; //    rows in the cleared block
const BLANK_WIDTH = 0x03; //   tiles per row cleared
const ROW_REMAINDER = 0x1d; // step from a row's end to the next row start (net +0x20)
const CMP_LEN = 0x40; //       body bytes compared by the self-check

export function launchHunterFormationAndSeedSlots(m) {
  const { mem8, mem16 } = m;

  // Seed the four formation-slot records from the parameter table (4 bytes per slot).
  let entry = FORMATION_SLOT_TABLE;
  let param = HUNTER_LAUNCH_PARAM_TABLE;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const rec = mem8[entry] | (mem8[u16(entry + 1)] << 8);
    mem8[u16(rec + REC_ANIM)] = mem8[param];
    mem8[u16(rec + REC_COORD)] = mem8[u16(param + 1)];
    mem8[u16(rec + REC_TILE_A)] = mem8[u16(param + 2)];
    mem8[u16(rec + REC_TILE_B)] = mem8[u16(param + 3)];
    mem8[u16(rec + REC_DELAY)] = FRAME_DELAY;
    entry = u16(entry + 2);
    param = u16(param + 4);
  }

  mem8[FRAME_TIMER_BLOCK_BASE] = WAVE_TIMER_SEED;
  mem8[FORMATION_STATE] = (mem8[FORMATION_STATE] + 1);

  // Blank a 3x3 video block, moving one row down between rows.
  let cell = FORMATION_LAUNCH_VRAM_CLEAR;
  for (let row = 0; row < BLANK_ROWS; row++) {
    cell = fillByteRun(m, cell, TILE_BLANK, BLANK_WIDTH);
    cell = u16(cell + ROW_REMAINDER);
  }

  mem16[HUNTER_SCRIPT_PTR] = HUNTER_SCRIPT_TABLE;

  queueSoundCommand0E(m);
  scanDisplaySlotsAndTickBoardClear(m, u16(FORMATION_SLOT_TABLE + 8), 0); // IX past the 4 slots, B=0 -> a full 256-slot sweep

  // self-check: the copy at TAMPER_COPY_3278 (a two-byte pointer header, then CMP_LEN body
  // bytes) must match the original at SELFCHECK_ROUTINE_BASE_ADDR; a mismatch wipes work RAM.
  const orig = SELFCHECK_ROUTINE_BASE_ADDR;
  let src = orig;
  let ref = TAMPER_COPY_3278;
  let remaining = CMP_LEN;
  let tampered = false;
  if (mem8[ref] !== (orig & 0xff)) {
    tampered = true;
  } else if (mem8[u16(ref + 1)] !== (orig >> 8)) {
    tampered = true;
  } else {
    ref = u16(ref + 2);
    for (;;) {
      if (mem8[src] !== mem8[ref]) { tampered = true; break; }
      src = u16(src + 1);
      ref = u16(ref + 1);
      remaining = (remaining - 1) & 0xff;
      if (remaining === 0) break;
    }
  }
  if (!tampered) return; // image verified

  // Tamper response: propagate zero across work RAM (count = remaining * 256).
  const wipeCount = remaining << 8;
  mem8[BONUS_AWARD_DSW] = 0;
  for (let i = 1; i <= wipeCount; i++) mem8[u16(BONUS_AWARD_DSW + i)] = 0;
}
