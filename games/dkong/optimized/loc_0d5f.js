// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0d5f — hand-optimized rewrite of the translated routine at ROM 0x0D5F,
 * proven equal to its oracle by the equivalence harness. Names its work-RAM operands
 * from ram.js; the sprite-record sub-fields (0x6903/0x690B) and ROM table addresses
 * (0x385C, 0x003D coefficient tables) stay hex.
 */

import { SUBSTATE_TIMER, GAME_SUBSTATE, BOARD, SPRITE_OBJ_BLOCK, SPRITE_BUFFER } from "./ram.js";

/**
 * loc_0d5f -- finish board setup: advance the substate and seed the board sprites.
 * [ROM 0x0D5F-0x0DA6]
 *
 * The tail of the per-board build chain (reached from loc_3fa0). It runs two setup
 * helpers (sub_0f56, sub_2441), then arms the sub-state machine: SUBSTATE_TIMER(0x6009)
 * = 0x40 and GAME_SUBSTATE(0x600A) += 1 (so the board-setup substate advances). It
 * copies a 0x28-byte sprite template from ROM 0x385C into SPRITE_OBJ_BLOCK (via sub_004e,
 * which leaves HL at 0x3884 — LIVE across the call), then an 8-byte ldir into
 * SPRITE_BUFFER. Finally, on BOARD(0x6227):
 *   - == 4 (100m rivets): seed the rivet sprite records (rst 0x38 fill + two sub_003d
 *     strided fills over SPRITE_BUFFER), then return.
 *   - else: test bit 1 of the board number (rrca x2); if set, return; otherwise adjust
 *     sprite-record field +3 (0x690B) by -4 via rst 0x38, then return.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (a call/rst site ends a block).
 * Reached via the board-build chain (loc_3fa0) and calling the interruptible
 * sub_004e; atomicity across its callers is not provable on every path. A collapse's
 * only observable effect on an interrupted path is the coarse PC pushed into the dead
 * stack or a healing single-frame pixel tear -- never a persistent divergence, since
 * every fold is between pure register loads and/or WORK-RAM writes (0x6009/0x600A --
 * not a 0x7Dxx hardware latch), never across a hardware write. Licensed by the
 * CONVERGENT gate (same reasoning as sub_0350). Every `call`/`rst` keeps its
 * push16/step scaffolding (the call's OWN charge folded with the register loads that
 * precede it, matching sub_30bd's convention), and callees route through m.call (the
 * registry). Block totals are the oracle's EXACTLY:
 *   arm substate (hl=0x6009[10]+ld(hl),0x40[10]+inc hl[6]+inc (hl)[11]) = 37 t, exit 0x0d6c
 *   sub_004e prep+call (hl=0x385c[10]+call[17])                        = 27 t, exit 0x004e
 *   ldir prep (de=SPRITE_BUFFER[10]+bc=8[10])                          = 20 t, exit 0x0d78
 *   BOARD check (a=(BOARD)[13]+cp 4[7])                                = 20 t, exit 0x0d7f
 *   BOARD==4: jr taken[12]+hl=SPRITE_OBJ_BLOCK[10]+c=0x44[7]+rst38[11] = 40 t, exit 0x0038
 *             de=4[10]+bc=0x0210[10]+hl=SPRITE_BUFFER[10]+call 003d[17]= 47 t, exit 0x003d
 *             bc=0x02f8[10]+hl=0x6903[10]+call 003d[17]                = 37 t, exit 0x003d
 *   else:     jr not-taken[7]+rrca[4]+rrca[4]                          = 15 t, exit 0x0d83
 *             (fC: ret c taken, 11 t -- unchanged, ret's own charge kept separate)
 *             ret-c not-taken[5]+hl=0x690b[10]+c=0xfc[7]+rst38[11]     = 33 t, exit 0x0038
 * The naming of SUBSTATE_TIMER/GAME_SUBSTATE/BOARD and the documented
 * HL-live-across-sub_004e idiom are the win.
 */
export function loc_0d5f(m) {
  const { regs, mem } = m;

  m.push16(0x0d62);
  m.step(0x0f56, 17);
  m.call(0x0f56);

  m.push16(0x0d65);
  m.step(0x2441, 17);
  m.call(0x2441);

  // arm the board-setup substate: SUBSTATE_TIMER = 0x40, GAME_SUBSTATE += 1.
  // Folded: 10+10+6+11 = 37 t (no hardware write; 0x6009/0x600A are work RAM).
  regs.hl = SUBSTATE_TIMER;
  mem.write8(regs.hl, 0x40);
  regs.hl = (regs.hl + 1) & 0xffff; // -> GAME_SUBSTATE (0x600A)
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // inc (hl) -- sets flags
  m.step(0x0d6c, 37);

  // copy the 0x28-byte sprite template from ROM 0x385C into SPRITE_OBJ_BLOCK.
  // HL IS LIVE across sub_004e: it leaves HL = 0x385C + 0x28 = 0x3884, the source
  // the ldir below consumes -- do NOT re-derive HL. Folded: 10+17 = 27 t.
  regs.hl = 0x385c;
  m.push16(0x0d72);
  m.step(0x004e, 27);
  m.call(0x004e);

  // Folded: 10 (de) + 10 (bc) = 20 t.
  regs.de = SPRITE_BUFFER;
  regs.bc = 0x0008;
  m.step(0x0d78, 20);
  m.ldirAt(0x0d78, 0x0d7a);

  // Folded: 13 (read) + 7 (cp) = 20 t.
  regs.a = mem.read8(BOARD);
  regs.cp(0x04);
  m.step(0x0d7f, 20);

  if (regs.fZ) {
    // BOARD == 4 -- the 100m rivets setup arm (0x0D8B-0x0DA6).
    // Folded: jr taken[12] + hl=SPRITE_OBJ_BLOCK[10] + c=0x44[7] + rst 0x38[11] = 40 t.
    regs.hl = SPRITE_OBJ_BLOCK; // 0x6908
    regs.c = 0x44;
    m.push16(0x0d91);
    m.step(0x0038, 40);
    m.call(0x0038);

    // Folded: de=4[10] + bc=0x0210[10] + hl=SPRITE_BUFFER[10] + call 0x003d[17] = 47 t.
    regs.de = 0x0004;
    regs.bc = 0x0210;
    regs.hl = SPRITE_BUFFER; // 0x6900
    m.push16(0x0d9d);
    m.step(0x003d, 47);
    m.call(0x003d);

    // Folded: bc=0x02f8[10] + hl=0x6903[10] + call 0x003d[17] = 37 t.
    regs.bc = 0x02f8;
    regs.hl = 0x6903; // SPRITE_BUFFER + 3
    m.push16(0x0da6);
    m.step(0x003d, 37);
    m.call(0x003d);

    m.ret(); // 0x0DA6 -- returns to loc_0d5f's caller
    return;
  }

  // Folded: jr not-taken[7] + rrca[4] + rrca[4] = 15 t (test bit 1 of the board
  // number by rotating it into carry).
  regs.rrca();
  regs.rrca();
  m.step(0x0d83, 15);
  if (regs.fC) {
    m.ret(11); // ret c -- bit 1 of BOARD was set (kept separate: the ret's own charge)
    return;
  }

  // adjust sprite-record field +3 (0x690B) by -4 via rst 0x38.
  // Folded: ret-c not-taken[5] + hl=0x690b[10] + c=0xfc[7] + rst 0x38[11] = 33 t.
  regs.hl = 0x690b; // SPRITE_BUFFER + 0x0B
  regs.c = 0xfc; // -4 signed
  m.push16(0x0d8a);
  m.step(0x0038, 33);
  m.call(0x0038);

  m.ret(); // 0x0D8A
}
