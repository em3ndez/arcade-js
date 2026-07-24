// SPDX-License-Identifier: GPL-3.0-only
/**
 * handler_01c3 — hand-optimized rewrite of the translated routine at ROM 0x01C3,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Every callee is reached through `m.call(0xADDR)`, which
 * resolves via the routine registry (games/dkong/routines.js) to the oracle — or
 * to that callee's own optimized rewrite once one exists — so there is never a
 * copied implementation here to drift. Only RAM *names* are imported (from ram.js).
 */

import { ATTRACT, LEVEL, LIVES, GAME_STATE, BOARD, GAME_SUBSTATE } from "./ram.js";

// Board control latch, not work RAM — it lives in the dkong board, not ram.js.
const FLIPSCREEN = 0x7d82;

/**
 * handler_01c3 -- game state 0: one-time power-on initialization.  [ROM 0x01C3-0x0206]
 *
 * Runs once. It seeds a known baseline, sets the screen up, queues the opening
 * tasks, and advances GAME_STATE so the *next* NMI dispatches a different
 * handler and this one never runs again.
 *
 * LADDER STATUS — rung 3/3: COLLAPSED. It is dead-straight-line code (no branches
 * at all -- just calls), so folding is simple: each straight run BETWEEN calls
 * folds into one m.step at that run's last instruction's own address (the address
 * where PC lands next), same convention as sub_0350/loc_0e4f/entry_0f1b. Each call
 * site's own step (the CALL instruction's fixed 17 t) is left exactly as-is, right
 * before its `m.push16`/`m.call` pair -- per loc_0d5f's still-per-instruction
 * sibling, a register/arithmetic step immediately preceding a call is NEVER folded
 * into the call's own charge, so those seven call sites (0x0874, 0x06b8, 0x0207,
 * 0x0a53, and 0x309f x3) are untouched. Every branch TOTAL sums to the oracle's,
 * EXACTLY (verified against translated/state0.js). `m.ldir` keeps its own internal
 * charge (untouched -- it is not decomposed here).
 *
 * NOT provably mask-cleared on every path across its callees (0x0874/sub_004e-style
 * callers of the board-setup chain are not proven atomic elsewhere in this fleet),
 * so this collapse is gated the same way sub_0350's is: the routine runs once, at
 * power-on, so whichever gate its test uses (strict or convergent) is a lead-side
 * per-routine call.
 */
export function handler_01c3(m) {
  const { regs, mem } = m;

  // Clear the playfield and do the initial object setup.
  m.push16(0x01c6); m.step(0x0874, 17); m.call(0x0874);

  // ld hl,0x01ba[10]+ld de,0x60b2[10]+ld bc,9[10] -- seed 9 bytes from ROM 0x01BA.  30 t
  regs.hl = 0x01ba;
  regs.de = 0x60b2;
  regs.bc = 0x0009;
  m.step(0x01cf, 30);
  m.ldir(0x01d1);

  // ld a,1[7]+ld(ATTRACT),a[13]+ld(LEVEL),a[13]+ld(LIVES),a[13] -- baseline.  46 t
  regs.a = 0x01;
  mem.write8(ATTRACT, regs.a);
  mem.write8(LEVEL, regs.a);
  mem.write8(LIVES, regs.a);
  m.step(0x01dc, 46);

  m.push16(0x01df); m.step(0x06b8, 17); m.call(0x06b8); // draw the lives display, etc.
  m.push16(0x01e2); m.step(0x0207, 17); m.call(0x0207); // unpack DSW0 into the settings block

  // ld a,1[7]+ld(FLIPSCREEN),a[13]+ld(GAME_STATE),a[13]+ld(BOARD),a[13]+xor a[4]
  //   +ld(GAME_SUBSTATE),a[13] -- screen up; advance top-level state; board=25m.  63 t
  regs.a = 0x01;
  mem.write8(FLIPSCREEN, regs.a, 10);
  mem.write8(GAME_STATE, regs.a); // next NMI dispatches attract
  mem.write8(BOARD, regs.a);
  regs.xor(regs.a); // A = 0
  mem.write8(GAME_SUBSTATE, regs.a);
  m.step(0x01f1, 63);

  m.push16(0x01f4); m.step(0x0a53, 17); m.call(0x0a53);

  // Queue the three opening tasks (each a 16-bit D,E pair via 0x309f).
  for (const [de, after, next] of [
    [0x0304, 0x01f7, 0x01fa],
    [0x0202, 0x01fd, 0x0200],
    [0x0200, 0x0203, 0x0206],
  ]) {
    regs.de = de;   m.step(after, 10);
    m.push16(next); m.step(0x309f, 17); m.call(0x309f);
  }

  m.ret();
}
