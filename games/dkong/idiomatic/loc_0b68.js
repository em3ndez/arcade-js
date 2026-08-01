// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0b68 — step 6 of the opening Kong-climb cutscene: scroll the sprite-object block
 * diagonally each frame and, every time the scroll path repeats, stamp the next board band;
 * advance the cutscene once all bands are placed.  ROM 0x0B68.
 *
 * The opening Kong-climb cutscene is in-game sub-state 7 (GAME_SUBSTATE 0x600A == 7): the
 * short intro at the head of every board, whose step index INTRO_STEP (0x6385) walks 0..7
 * one handler per step, dispatched every frame by dispatchIntroCutsceneStep (0x0A76). This
 * is entry 6 of that table. It is re-dispatched every frame while INTRO_STEP == 6 and, per
 * frame:
 *
 *   - Gate on even frames only: read FRAME (0x601A) and return if its bit 0 is set. The
 *     scroll advances every other frame (the oracle's `rrca / ret c`).
 *   - Read the next signed Y-delta from a ROM table via the walk cursor at 0x63C4. Then:
 *       · byte != 0x7F (the common case): advance the cursor one byte and scroll all ten
 *         records of the sprite-object block (0x6908) one step — every record's Y (+3 column,
 *         0x690B) += the signed delta, every record's X (+0 column, 0x6908) -= 1 — via the
 *         rst-0x38 strided add over the 10-record, stride-4 block. Return.
 *       · byte == 0x7F (the path wrapped): loop the cursor back to the table start (0x38CB),
 *         trigger a sound (SND_TRIGGER+2 = 0x6082 := 3), and draw the next board band. The
 *         band's ROM record address is BAND_TABLE(0x38DC) + ((count-1) nibble-swapped) — four
 *         `rlca`, which is *16 for the small band count (0x638D, seeded to 5 by step 4's
 *         loc_0B06) — handed to loc_0da7, which walks that segment table and draws its
 *         girders/ladders. Then decrement the band count (0x638D); while it is still non-zero,
 *         return (more bands to place on later wraps).
 *   - When the band count reaches 0 the scene is complete: arm SUBSTATE_TIMER (0x6009) to
 *     0xB0 (a 176-frame metered hold) and inc INTRO_STEP (0x6385) 6 -> 7, so the next frame
 *     dispatches the final beat (loc_0BB3, the Kong roar).
 *
 * Callees, both called directly (no m.call / no stack modelling):
 *   - addStrided (ROM 0x003D) is the landed idiomatic leaf reached by `rst 0x38`; the rst
 *     entry loc_0038 fixes stride 4 / count 10 then falls into it. addStrided still reads the
 *     Z80 register file, so strideAddTen() below sets the regs it consumes (HL/C/DE/B) — the
 *     one register-ABI boundary this routine keeps. addStrided touches no SP/pc.
 *   - loc_0da7 (ROM 0x0DA7) is the landed idiomatic segment-table drawer; it reads DE as the
 *     record-table pointer, so DE is set before the call. It is SP-neutral (it pins SP to its
 *     entry value each record and returns at the terminator), but it calls the frozen oracle
 *     leaf sub_2ff0, which advances m.pc/cycles — so this routine's pc is NOT held on the
 *     sentinel arm (that is dropped stack/cycle model, outside the memory contract).
 *
 * NAME: kept neutral. The mechanic — even-frame diagonal scroll of the sprite-object block +
 * per-wrap band stamp via loc_0da7, advancing the step when the band count drains — is fully
 * proven against the oracle. What is NOT earned to the name bar: which sprites the block holds
 * at this step (loc_0B06 reloads 0x6900 with a fresh template at step 4, so step 2's "climbing
 * figure" read does not carry forward) and whether loc_0da7's segments here are specifically
 * girders vs generic board line-segments. Single-proposer inferences below the promotion bar;
 * the sibling beat loc_0B06 was likewise kept neutral. Promote with corroboration.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0b68.test.js.
 * GATE:     crafted-entry — reached only in a credited game's opening cutscene (GAME_STATE 3,
 *           GAME_SUBSTATE 7, INTRO_STEP 6); 0 dispatches in plain attract. A driven coin+start
 *           run dispatches it 170x — 85 even-frame no-op, 80 diagonal-scroll, 5 sentinel/band,
 *           and 1 natural step-6 -> 7 advance — each replayed oracle-vs-idiomatic on a FRESH
 *           clone and compared on RAM − STACK_SCRATCH. The last-band advance (count 1 -> 0), a
 *           still-more-bands sentinel (count > 1), and a scroll case are also forced on real
 *           captured states identically both sides. Teeth: a flipped X-scroll direction and a
 *           dropped INTRO_STEP advance.
 * LIVE-OUT: memory-only. The caller (dispatchIntroCutsceneStep's rst-0x28 tail) discards this
 *           handler's return and reads no register/flag it leaves — the oracle's residual
 *           A/HL/DE/flags are dead ABI, and its SP/pc are the Z80 caller-skip mechanism, not
 *           part of the memory contract (SP/pc are not compared against the oracle; the
 *           oracle's push/call/ret churn lands in the dead STACK_SCRATCH region).
 * NAMES:    FRAME (0x601A), SUBSTATE_TIMER (0x6009), INTRO_STEP (0x6385), SND_TRIGGER (0x6080;
 *           +2 = 0x6082), SPRITE_OBJ_BLOCK (0x6908) from ram.js. Hex-kept: 0x63C4 scroll cursor
 *           and 0x638D band count (both unnamed in ram.js); 0x38CB / 0x38DC are ROM table bases.
 */

import { addStrided } from "./addStrided.js"; // ROM 0x003d — add C to B stride-DE bytes (rst 0x38 body)
import { loc_0da7 } from "./loc_0da7.js"; // ROM 0x0da7 — walk a board-layout segment table and draw it
import { FRAME, SUBSTATE_TIMER, INTRO_STEP, SND_TRIGGER, SPRITE_OBJ_BLOCK } from "./ram.js";

const SCROLL_CURSOR = 0x63c4; // 16-bit walk cursor into the ROM Y-delta table (unnamed in ram.js)
const SCROLL_TABLE = 0x38cb; // ROM base of the per-step signed-Y-delta table; 0x7F wraps it
const BAND_COUNT = 0x638d; // board bands left to stamp this beat, seeded to 5 (unnamed in ram.js)
const BAND_TABLE = 0x38dc; // ROM base of the 16-byte-strided band-record table
const SENTINEL = 0x7f; // table byte meaning "path wrapped"

const OBJ_X = SPRITE_OBJ_BLOCK; // 0x6908 — record 0's X byte (start of the stride-4 X column)
const OBJ_Y = SPRITE_OBJ_BLOCK + 3; // 0x690B — record 0's Y byte (start of the stride-4 Y column)

// Four `rlca` on an 8-bit accumulator = a nibble swap (rotate-left-4). For the small band
// count it is *16; the rotate is faithful for every input, not just count < 16.
const nibbleSwap = (v) => (((v << 4) | (v >> 4)) & 0xff);

// `rst 0x38`: loc_0038 fixes stride 4 / count 10, then falls into addStrided (0x003D), adding
// `c` into each of the ten stride-4 bytes starting at `hl`. addStrided reads the Z80 register
// file, so set the regs it consumes here — the routine's one register-ABI boundary.
function strideAddTen(m, hl, c) {
  const { regs } = m;
  regs.hl = hl;
  regs.c = c;
  regs.de = 0x0004; // ld de,0x0004  (the stride)
  regs.b = 0x0a; // ld b,0x0a      (ten bytes)
  addStrided(m);
}

export function loc_0b68(m) {
  const { mem, regs } = m;

  // ld a,(0x601a) / rrca / ret c — advance only on even frames (FRAME bit 0 clear).
  if (mem.read8(FRAME) & 0x01) return;

  // ld hl,(0x63c4) / ld a,(hl) / cp 0x7f — read the next Y-delta through the walk cursor.
  const cursor = mem.read16(SCROLL_CURSOR);
  const delta = mem.read8(cursor);

  if (delta !== SENTINEL) {
    // Diagonal scroll: advance the cursor, then nudge every record's Y by the signed delta
    // and its X left by one (0xFF = -1), each a stride-4 add over the ten-record block.
    mem.write16(SCROLL_CURSOR, (cursor + 1) & 0xffff);
    strideAddTen(m, OBJ_Y, delta);
    strideAddTen(m, OBJ_X, 0xff);
    return;
  }

  // 0x7f — the scroll path wrapped. Loop the cursor back to the table start and trigger the
  // stamp sound.
  mem.write16(SCROLL_CURSOR, SCROLL_TABLE);
  mem.write8(SND_TRIGGER + 2, 0x03); // 0x6082 := 3 (a 3-frame sound assert)

  // Draw the next board band. Its ROM record address = BAND_TABLE + ((count-1) nibble-swapped);
  // loc_0da7 reads DE as that record-table pointer.
  const bandIdx = nibbleSwap((mem.read8(BAND_COUNT) - 1) & 0xff);
  regs.de = (BAND_TABLE + bandIdx) & 0xffff;
  loc_0da7(m); // ROM 0x0da7

  // dec (0x638d) / ret nz — one band placed; stay in step 6 until the count drains.
  const bandsLeft = (mem.read8(BAND_COUNT) - 1) & 0xff;
  mem.write8(BAND_COUNT, bandsLeft);
  if (bandsLeft !== 0) return;

  // All bands placed: arm the metered hold and advance the cutscene to step 7 (the roar).
  mem.write8(SUBSTATE_TIMER, 0xb0); // 176-frame hold
  mem.write8(INTRO_STEP, (mem.read8(INTRO_STEP) + 1) & 0xff); // step 6 -> 7
}
