// SPDX-License-Identifier: GPL-3.0-only
/**
 * marioActiveGuard — caller-skip guard: proceed only while Mario is alive.  ROM 0x0010.
 *
 * Invoked as `rst 0x10` from the player-motion / hammer / bonus update routines. In
 * the raw Z80 it is a stack trick: it reads MARIO_ACTIVE (0x6200, 1 = alive/processed,
 * 0 = dead/inert), rotates bit 0 into carry, and on `ret c` (bit SET) returns normally
 * so the caller keeps running; on bit CLEAR the two `inc sp` discard its own return
 * address so the final `ret` splices two levels up, skipping the rest of whoever ran
 * the `rst 0x10`. In other words: "run the caller's remainder only while Mario is alive."
 *
 * The idiomatic form drops the stack manipulation entirely (the Z80 stack is the JS
 * call stack) and returns that decision as a boolean the caller consumes as an early
 * return: `if (!marioActiveGuard(m)) return;`. true = proceed (bit set), false = skip.
 *
 * The EXACT MIRROR of sub_0008 (`rst 0x08`, ROM 0x0008), one opcode apart: sub_0008
 * returns normally on `ret nc` (bit CLEAR of ATTRACT), this on `ret c` (bit SET of
 * MARIO_ACTIVE). Copying sub_0008's carry-clear polarity here inverts every call — the
 * polarity trap the teeth twin pins.
 *
 * A LEAF — reads one byte, writes nothing, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0010.test.js.
 * GATE:     exhaustive — pure predicate over all 256 MARIO_ACTIVE byte values vs the
 *           oracle's skip decision, plus real captured dispatches. Reached only via
 *           m.call (entry_2c03/2ddb/2e04/2ed4, sub_03a2); both branches occur in play.
 * LIVE-OUT: memory-only (writes none) — the control-flow boolean is the whole output;
 *           the A/F/SP/PC the oracle leaves are dead ABI, every caller reloads A the
 *           instant the guard returns (e.g. entry_2ddb `ld a,(0x6380)`).
 * NAMES:    MARIO_ACTIVE (0x6200).
 */

import { MARIO_ACTIVE } from "./ram.js";

export function marioActiveGuard(m) {
  // `ld a,(MARIO_ACTIVE) / rrca / ret c` — carry takes bit 0, and the guard proceeds
  // (returns true) exactly when that bit is set: Mario is alive and being processed.
  return (m.mem.read8(MARIO_ACTIVE) & 0x01) !== 0;
}
