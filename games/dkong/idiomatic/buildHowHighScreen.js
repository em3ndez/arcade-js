// SPDX-License-Identifier: GPL-3.0-only
/**
 * buildHowHighScreen — build the "HOW HIGH CAN YOU GET?" interlude screen, then step
 * the in-game sub-state forward.  ROM 0x0bda.
 *
 * Sub-state 8 of the credited game (GAME_STATE 3), dispatched by dispatchInGameSubstate
 * on GAME_SUBSTATE (0x600A) through the 0x0702 table — the last build step of the
 * pre-gameplay "how high can you get?" intro. It draws a diagonal stack of girders whose
 * height grows as the player climbs from board to board, with a little climbing figure on
 * each girder, then hands off to the next sub-state. It runs once per intro and does, in
 * order:
 *
 *   1. SILENCE the sound channels (silenceSound, ROM 0x011C) — unconditional, before the
 *      frame gate.
 *   2. FRAME GATE (tickSubstateTimer, the rst-0x18 helper): decrement SUBSTATE_TIMER and
 *      run the rest only on the frame it hits 0; while it is still counting, return early
 *      (the whole build is skipped this frame). Everything below is behind this gate.
 *   3. CLEAR the playfield + sprite shadow buffer (clearPlayfieldAndSprites, ROM 0x0874).
 *   4. POST a task to redraw the lives/marker (enqueueTask with opcode 6, argument =
 *      MARIO_ACTIVE) — the shared deferred-work primitive; opcode/arg ride in D/E.
 *   5. SEED the screen's fixed state: palette bank 1 (0x7D86=1, 0x7D87=0), the level-start
 *      tune (SND_PRIORITY=2, held SND_PRIORITY_FRAMES=3), and the climb-figure bookkeeping
 *      (record index 0x63A7 = 0, VRAM walk pointer 0x63A8 = 0x76DC).
 *   6. HEIGHT INDEX: clamp HOW_HIGH_INDEX to at most 5, then bump it by one when the
 *      board-sequence pointer's low byte (BOARD_SEQ_PTR) differs from its saved copy
 *      (HOW_HIGH_LAST_SEQ) — i.e. the player advanced a board — and save the new copy.
 *      HOW_HIGH_INDEX is the height reached, so the girder stack is that many rows tall.
 *   7. PAINT HOW_HIGH_INDEX rows (a do-while, so a count of 0 wraps to 256). Each row:
 *        - fills six 4-tile groups of the girder into VRAM at 0x75BC, tile codes 0x50..0x67
 *          written descending with a +0x23 stride between groups, and
 *        - copies one 3-byte climb-figure record from ROM 0x3CF0 (indexed by the 0x63A7
 *          counter × 4) into the next VRAM sprite slot (0x63A8, which walks down 4 per row),
 *          writing the fixed tile 0x8B just below it.
 *   8. POST the composition task (enqueueTask with DE = 0x0307), then re-arm SUBSTATE_TIMER
 *      to 0xA0 and advance GAME_SUBSTATE by 2 so the next NMI dispatches onward.
 *
 * Reads no input byte; every effect is on fixed RAM/VRAM. The only register marshalling
 * left is loading D/E for enqueueTask, whose ABI takes the message pair there.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0bda.test.js.
 * GATE:     crafted-entry — the one real captured dispatch from a driven coin+start game
 *           (sub-state 8 fires once per intro: gate-expired / clamp-keep / step-take / 1
 *           row), fresh clone per case, PLUS crafted entries the run never reaches, poked
 *           identically on both sides: the gate-skip early return, the clamp-set-5 arm, the
 *           step-skip arm, several row counts, and the 256-row do-while wrap. Compared on
 *           RAM − STACK_SCRATCH against the oracle. Teeth = a wrong HOW_HIGH_LAST_SEQ store.
 * LIVE-OUT: memory-only — the cleared playfield + sprite buffer, the two task-ring posts,
 *           the seeded sound/palette/climb-figure bytes, HOW_HIGH_INDEX / HOW_HIGH_LAST_SEQ,
 *           the girder + sprite VRAM, SUBSTATE_TIMER, and GAME_SUBSTATE. No live registers
 *           or flags: this is an rst-0x28 sub-state handler whose `ret` returns up the NMI
 *           service path, which consumes none of them. SP/pc are the dropped stack model —
 *           the oracle's `call`s and terminal `ret` leave only push residue in STACK_SCRATCH
 *           (measured 0x6bec–0x6bef at the real dispatch), excluded by the contract; the
 *           direct-call layer replaces the `ret` with a JS return, so SP/pc are untouched.
 * NAMES:    MARIO_ACTIVE, SND_PRIORITY, SND_PRIORITY_FRAMES, HOW_HIGH_INDEX, BOARD_SEQ_PTR,
 *           HOW_HIGH_LAST_SEQ, SUBSTATE_TIMER, GAME_SUBSTATE (ram.js); imports silenceSound
 *           (0x011C), tickSubstateTimer (0x0018), clearPlayfieldAndSprites (0x0874),
 *           enqueueTask (0x309F) — the four decompiled callees. The palette-bank latches,
 *           the climb-figure index/walk-pointer scratch, the girder VRAM base, and the ROM
 *           record table stay hex (board control / engine scratch / video RAM / ROM, none in
 *           ram.js).
 */

import {
  MARIO_ACTIVE,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  HOW_HIGH_INDEX,
  BOARD_SEQ_PTR,
  HOW_HIGH_LAST_SEQ,
  SUBSTATE_TIMER,
  GAME_SUBSTATE,
} from "./ram.js";
import { silenceSound } from "./silenceSound.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { enqueueTask } from "./enqueueTask.js";

// ls259.6h palette-bank latch — 0x7D86 = bit 0, 0x7D87 = bit 1 (board control outputs,
// not work RAM). buildHowHighScreen selects bank 1: bit0 = 1, bit1 = 0.
const PALETTE_BANK_BIT0 = 0x7d86;
const PALETTE_BANK_BIT1 = 0x7d87;

// Climb-figure bookkeeping (engine scratch, not in ram.js): 0x63A7 = record index into the
// ROM table below (stepped once per row); 0x63A8 = 16-bit VRAM walk pointer for the sprite
// slots (walks down 4 per row). Seeded here to 0 and 0x76DC.
const CLIMB_FIGURE_INDEX = 0x63a7;
const CLIMB_FIGURE_WALK_PTR = 0x63a8;
const CLIMB_FIGURE_WALK_START = 0x76dc;
const CLIMB_FIGURE_ROM_TABLE = 0x3cf0; // ROM: 4-byte climb-figure records (3 read + 1 skipped)
const CLIMB_FIGURE_FOOT_TILE = 0x8b; // fixed tile written just below each figure

// Girder tile fill: 6 groups × 4 tiles, codes 0x50..0x67, written into VRAM descending from
// 0x75BC with a +0x23 stride between groups; the next row steps by -0xA1.
const GIRDER_VRAM_BASE = 0x75bc;
const GIRDER_TILE_FIRST = 0x50;
const GIRDER_TILE_LAST = 0x67;
const GIRDER_GROUP_STRIDE = 0x23;
const GIRDER_ROW_STEP = -0xa1 & 0xffff; // 0xFF5F: down one girder row

const HEIGHT_MAX = 5; // HOW_HIGH_INDEX is clamped to at most this
const SUBSTATE_TIMER_RELOAD = 0xa0; // re-armed before handing off

export function buildHowHighScreen(m) {
  const { regs, mem } = m;

  // 1. Silence sound — unconditional, ahead of the frame gate.
  silenceSound(m);

  // 2. Frame gate: run the build only on the frame SUBSTATE_TIMER expires; otherwise the
  //    rst-0x18 helper returns us straight to our caller.
  if (!tickSubstateTimer(m)) return;

  // 3. Blank the playfield + sprite shadow buffer for the fresh screen.
  clearPlayfieldAndSprites(m);

  // 4. Post the lives/marker redraw task (opcode 6, argument = MARIO_ACTIVE); enqueueTask
  //    reads the pair from D/E.
  regs.d = 0x06;
  regs.e = mem.read8(MARIO_ACTIVE);
  enqueueTask(m);

  // 5. Seed the screen's fixed state.
  mem.write8(PALETTE_BANK_BIT0, 0x01); //          palette bank 1: bit 0 set
  mem.write8(PALETTE_BANK_BIT1, 0x00); //                          bit 1 clear
  mem.write8(SND_PRIORITY, 0x02); //               level-start tune
  mem.write8(SND_PRIORITY_FRAMES, 0x03); //        held 3 frames
  mem.write8(CLIMB_FIGURE_INDEX, 0x00); //         record index reset
  mem.write16(CLIMB_FIGURE_WALK_PTR, CLIMB_FIGURE_WALK_START); // VRAM walk pointer

  // 6. Height index: clamp to <= 5, then bump when the board advanced (BOARD_SEQ_PTR moved
  //    off HOW_HIGH_LAST_SEQ), and save the new copy.
  if (mem.read8(HOW_HIGH_INDEX) >= HEIGHT_MAX + 1) mem.write8(HOW_HIGH_INDEX, HEIGHT_MAX);
  const seqLo = mem.read8(BOARD_SEQ_PTR);
  if (seqLo !== mem.read8(HOW_HIGH_LAST_SEQ)) {
    mem.write8(HOW_HIGH_INDEX, (mem.read8(HOW_HIGH_INDEX) + 1) & 0xff);
  }
  mem.write8(HOW_HIGH_LAST_SEQ, seqLo);

  // 7. Paint HOW_HIGH_INDEX rows of the girder + one climb figure each. do-while, so a row
  //    count of 0 wraps to 256 (matching the oracle's `dec b / jp nz`).
  let rows = mem.read8(HOW_HIGH_INDEX);
  let fillPtr = GIRDER_VRAM_BASE;
  do {
    // Girder fill: six groups of 4 tiles, codes 0x50..0x67, descending; the group's first
    // three writes each step VRAM down one, then a +0x23 stride to the next group. The loop
    // exits the instant the 4th tile of a group is 0x67.
    let tile = GIRDER_TILE_FIRST;
    for (;;) {
      mem.write8(fillPtr, tile); tile = (tile + 1) & 0xff; fillPtr = (fillPtr - 1) & 0xffff;
      mem.write8(fillPtr, tile); tile = (tile + 1) & 0xff; fillPtr = (fillPtr - 1) & 0xffff;
      mem.write8(fillPtr, tile); tile = (tile + 1) & 0xff; fillPtr = (fillPtr - 1) & 0xffff;
      mem.write8(fillPtr, tile); // 4th tile — `tile` is not advanced past it
      if (tile === GIRDER_TILE_LAST) break;
      tile = (tile + 1) & 0xff;
      fillPtr = (fillPtr + GIRDER_GROUP_STRIDE) & 0xffff;
    }

    // Climb figure: copy 3 ROM bytes from record (index × 4) into the next sprite slot.
    const idx = mem.read8(CLIMB_FIGURE_INDEX);
    mem.write8(CLIMB_FIGURE_INDEX, (idx + 1) & 0xff); // step the index for the next row
    let recPtr = (CLIMB_FIGURE_ROM_TABLE + ((idx << 2) & 0xff)) & 0xffff;
    const ix = mem.read16(CLIMB_FIGURE_WALK_PTR); // current VRAM walk pointer

    mem.write8((ix + 0x60) & 0xffff, mem.read8(recPtr)); recPtr = (recPtr + 1) & 0xffff;
    mem.write8((ix + 0x40) & 0xffff, mem.read8(recPtr)); recPtr = (recPtr + 1) & 0xffff;
    mem.write8((ix + 0x20) & 0xffff, mem.read8(recPtr));
    mem.write8((ix - 0x20) & 0xffff, CLIMB_FIGURE_FOOT_TILE); // negative displacement

    mem.write16(CLIMB_FIGURE_WALK_PTR, (ix - 4) & 0xffff); // next sprite slot, 4 down
    fillPtr = (fillPtr + GIRDER_ROW_STEP) & 0xffff; //        next girder row

    rows = (rows - 1) & 0xff;
  } while (rows !== 0);

  // 8. Post the composition task (DE = 0x0307), re-arm the timer, advance the sub-state by 2.
  regs.d = 0x03;
  regs.e = 0x07;
  enqueueTask(m);

  mem.write8(SUBSTATE_TIMER, SUBSTATE_TIMER_RELOAD);
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 2) & 0xff); // two `inc (hl)`
}
