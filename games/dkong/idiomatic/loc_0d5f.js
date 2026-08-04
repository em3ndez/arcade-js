// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0d5f — board-setup continuation: run the common per-board init, scatter the
 * object records, arm the setup dwell timer and advance the sub-state, stage the
 * sprite-object block, then apply a per-board sprite offset. ROM 0x0d5f.
 *
 * The tail of the board-setup sub-state (GAME_SUBSTATE == 10). It is reached through
 * the setup dispatch chain — loc_0cc6 (the arm every board converges on) tail-jumps to
 * loc_3fa0, which tail-jumps here — so no caller consumes a register loc_0d5f leaves;
 * its work is entirely in memory. In order it:
 *
 *   1. Runs the big common per-board init (loc_0f56): clears the player/object RAM,
 *      recomputes the bonus fields from LEVEL, and — via its own rst-0x28 tail — runs
 *      the per-board setup (25m/50m/75m/100m) selected by BOARD. loc_0f56 has no `ret`
 *      of its own; the board-setup arm it dispatches to returns straight back here.
 *   2. Scatters this board's ROM object-init records into the OBJ_PARAM_TABLE0 /
 *      OBJ_PARAM_TABLE1 attribute arrays (0x6300/0x6310) via loadBoardObjectRecords.
 *   3. Arms the setup dwell: SUBSTATE_TIMER (0x6009) = 0x40 (64 frames), then
 *      inc GAME_SUBSTATE (0x600A) — the "wait 64 frames, then advance one sub-state"
 *      idiom that ends board setup.
 *   4. Stages the board's sprite-object graphics from a single ROM template at 0x385C:
 *      loadSpriteObjectBlock copies its first 0x28 bytes into SPRITE_OBJ_BLOCK (0x6908,
 *      the ten 4-byte object records) and — crucially — LEAVES HL at 0x385C+0x28 =
 *      0x3884; the 8-byte copy that follows continues from that same advanced HL into
 *      the head of the sprite buffer (0x6900, two more records). HL is live across the
 *      call, so it is read from the callee's advanced value, never re-derived.
 *   5. Applies a per-board sprite offset keyed off BOARD (0x6227):
 *        - 100m (BOARD == 4): shift the whole X column of the ten records right by 0x44
 *          (addToSpriteObjectColumn @ 0x6908), then two rivet-layout field nudges
 *          (addStrided: +0x10 x2 at 0x6900, then −8 x2 at 0x6903).
 *        - 50m / 75m (BOARD bit 1 set, i.e. 2 or 3): no offset — return.
 *        - 25m (BOARD == 1): shift the whole Y column up by 4 (add 0xFC = −4 to the
 *          record field at 0x690B across all ten records).
 *      The oracle selects the "no offset" case with `rrca / rrca / ret c`, which tests
 *      bit 1 of BOARD; `board & 0x02` reproduces that carry faithfully for all 256
 *      values, not only {1,2,3,4}.
 *
 * CALLEES. All five are idiomatic and called directly, including initBoardState (ROM 0x0F56),
 * which this unit dissolved from a frozen-oracle import — see the note at that call site for the
 * measurement it rests on, and for why no gate can vouch for it.
 * All five still take their inputs in the Z80 register file (they are the older
 * regs-passing idiomatic style, not honest-param), so at each call site this routine
 * still sets the registers they read (HL for the block load; HL/C for the column add;
 * HL/DE/B/C for addStrided) — the one place registers remain. loc_0d5f itself reads no
 * live-in register (loc_0f56 overwrites B/HL/A before reading anything), so it needs no
 * parameters; the Z80 call stack becomes the JS call stack (no push16/m.call/ret).
 *
 * NAME. Kept as loc_0d5f, not promoted: it is a multi-responsibility glue node (delegate
 * init, load records, arm the timer, stage sprites, per-board offset) with no single
 * honest verb — the oracle itself manages only "board-setup continuation," and a crisp
 * English name would over-claim one of its five jobs.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0d5f.test.js.
 * GATE:     crafted-entry — the single real board-1 dispatch attract produces (25m is
 *           the only board attract sets up) validates the common path + the 25m arm;
 *           the 50m/75m/100m arms are reached by an identical-both-sides BOARD poke
 *           (2/3/4 — Karl-sanctioned board poke) on that real entry. Fresh clone per
 *           case (writes RAM, and loc_0f56 has state). Teeth: a dropped GAME_SUBSTATE
 *           advance and a wrong per-board offset (X shift instead of Y on 25m).
 * LIVE-OUT: memory-only. Reached through the board-setup dispatch tail (loc_0cc6 ->
 *           loc_3fa0, both tail jumps), which consumes no return register; the oracle's
 *           residual A/HL/DE/BC/flags are dead ABI, and SP/pc are the Z80 call mechanism
 *           the JS call stack replaces (not part of the contract). The oracle's push16/
 *           m.call/ret stack traffic lands in the dead STACK_SCRATCH region and is
 *           excluded from the compare.
 * NAMES:    SUBSTATE_TIMER (0x6009), GAME_SUBSTATE (0x600A), BOARD (0x6227),
 *           SPRITE_OBJ_BLOCK (0x6908), SPRITE_BUFFER (0x6900) from names.js. Hex-kept:
 *           OBJECT_TEMPLATE_SRC 0x385C (a ROM data address / immediate) and the two
 *           rivet-arm addStrided delta immediates (0x10, 0xF8 applied at SPRITE_BUFFER /
 *           SPRITE_BUFFER+3).
 */

import { initBoardState } from "./initBoardState.js"; // ROM 0x0f56
import { loadBoardObjectRecords } from "./loadBoardObjectRecords.js"; // ROM 0x2441
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38)
import { addStrided } from "./addStrided.js"; // ROM 0x003d
import { SUBSTATE_TIMER, GAME_SUBSTATE, BOARD, SPRITE_OBJ_BLOCK, SPRITE_BUFFER } from "./names.js";

// ROM template of sprite-object records copied into the sprite buffer (ROM data — kept hex).
const OBJECT_TEMPLATE_SRC = 0x385c;
const HEAD_COPY_BYTES = 8; // the 8 bytes (2 records) copied to SPRITE_BUFFER after the 0x28-byte block

export function loc_0d5f(m) {
  const { regs, mem } = m;

  // (1) Common per-board init + the per-board setup dispatch.
  // Stack note, because this one is not obvious: the oracle at 0x0F56 ends in a `jp` TAIL into
  // the per-board setup routine, so in ISOLATION it consumes a stack word this twin does not.
  // It is safe here because the tail's target is itself an idiomatic override, and the seam
  // (games/dkong/machine.js) closes that bracket either way. The swap itself is MEASURED neutral:
  // in situ, oracle and twin both net a delta of 0 over all 3 invocations.
  // ★ WHAT NO GATE CAN TELL YOU ABOUT IT. An earlier version of this comment claimed this call
  // site "sits in the MAIN-LOOP/task subtree, not the NMI subtree", and that a deliberate 2-byte
  // delta injected here IS caught. BOTH HALVES WERE FALSE. Instrumented with an in-NMI flag over
  // 6000 flip frames, all 3 invocations report inNmi=true, SP 0x6BF0 — this is the NMI subtree,
  // the blind region: perFrame's epilogue forces SP = frameBase + 12 before the frame boundary the
  // gate samples, so the delta is absorbed. Injecting `m.regs.sp += 2` right after this call and
  // re-running golive PASSES 4/4. So this dissolve rests on the direct in-situ measurement above
  // and on nothing else; no gate vouches for it, exactly as for the ones left undissolved.
  initBoardState(m);

  // (2) Scatter this board's ROM object-init records into OBJ_PARAM_TABLE0 / OBJ_PARAM_TABLE1
  //     (0x6300/0x6310).
  loadBoardObjectRecords(m);

  // (3) Arm the setup dwell timer, then advance the game sub-state by one.
  mem.write8(SUBSTATE_TIMER, 0x40); // wait 64 frames
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff); // then proceed to the next sub-state

  // (4) Stage the sprite-object graphics from the ROM template at 0x385C.
  //     loadSpriteObjectBlock copies its first 0x28 bytes into SPRITE_OBJ_BLOCK (0x6908)
  //     and leaves HL at 0x385C + 0x28 = 0x3884 — HL is LIVE into the head copy below.
  regs.hl = OBJECT_TEMPLATE_SRC;
  loadSpriteObjectBlock(m); // HL -> 0x3884 on return

  //     Continue the SAME template stream: copy the next 8 bytes into the head of the
  //     sprite buffer (0x6900, two more records). Faithful `ld de,0x6900 / ld bc,8 / ldir`.
  let src = regs.hl; // 0x3884, advanced by loadSpriteObjectBlock
  let dst = SPRITE_BUFFER; // 0x6900
  for (let i = 0; i < HEAD_COPY_BYTES; i++) {
    mem.write8(dst, mem.read8(src));
    src = (src + 1) & 0xffff;
    dst = (dst + 1) & 0xffff;
  }
  regs.hl = src; // 0x388C — ldir terminal state (dead into the branch below, kept faithful)
  regs.de = dst; // 0x6908
  regs.bc = 0;

  // (5) Per-board sprite offset, selected by BOARD.
  const board = mem.read8(BOARD);

  if (board === 4) {
    // 100m rivets: shift the X column of all ten records right by 0x44, then two
    // rivet-layout field nudges (addStrided sets B = count, C = signed delta, DE = stride).
    regs.hl = SPRITE_OBJ_BLOCK; // 0x6908 — the X field of each record
    regs.c = 0x44;
    addToSpriteObjectColumn(m); // rst 0x38: + 0x44 into X of all ten records

    regs.de = 0x0004; // stride 4 (leaves DE = 4 for the second call too)
    regs.b = 0x02;
    regs.c = 0x10; // ld bc,0x0210
    regs.hl = SPRITE_BUFFER; // 0x6900 — += 0x10, two stride-4 bytes
    addStrided(m);

    regs.b = 0x02;
    regs.c = 0xf8; // ld bc,0x02F8 — += 0xF8 (−8)
    regs.hl = SPRITE_BUFFER + 3; // 0x6903 — two stride-4 bytes
    addStrided(m);
    return;
  }

  // 50m / 75m (BOARD bit 1 set): no per-board offset. Faithful to `rrca/rrca/ret c`.
  if (board & 0x02) return;

  // 25m: shift the Y column of all ten records up by 4 (add −4 to the field at 0x690B).
  regs.hl = SPRITE_OBJ_BLOCK + 3; // 0x690B — the Y field of each record
  regs.c = 0xfc; // −4
  addToSpriteObjectColumn(m); // rst 0x38: + 0xFC into Y of all ten records
}
