// SPDX-License-Identifier: GPL-3.0-only
/**
 * gameActiveGuard — caller-skip guard: proceed only while a credited game is in play.  ROM 0x0008.
 *
 * Invoked as `rst 0x08` from routines whose bodies must run during a real game but be
 * skipped during attract/demo. In the raw Z80 it is a stack trick: it reads ATTRACT
 * (0x6007 — non-zero while NO credited game is in progress, i.e. attract; 0 once a coin
 * is accepted), rotates bit 0 into carry, and on `ret nc` (bit CLEAR) returns normally so
 * the caller keeps running; on bit SET the two `inc sp` discard its own return address so
 * the final `ret` splices two levels up, skipping the rest of whoever ran the `rst 0x08`.
 * In other words: "run the caller's remainder only while a credited game is active."
 *
 * The idiomatic form drops the stack manipulation entirely (the Z80 stack is the JS call
 * stack) and returns that decision as a boolean the caller consumes as an early return:
 * `if (!gameActiveGuard(m)) return;`. true = proceed (ATTRACT bit clear, game active),
 * false = skip (attract). ATTRACT only ever holds 0 or 1, so bit 0 is the whole flag.
 *
 * The EXACT MIRROR of marioActiveGuard (`rst 0x10`, ROM 0x0010), one opcode apart:
 * that one returns normally on `ret c` (bit SET of MARIO_ACTIVE); this one on `ret nc`
 * (bit CLEAR of ATTRACT). Getting the carry-clear vs carry-set polarity backwards inverts
 * every call — the trap the teeth twin pins.
 *
 * A LEAF — reads one byte, writes nothing, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0008.test.js.
 * GATE:     exhaustive — pure predicate over all 256 ATTRACT byte values vs the oracle's
 *           skip decision, plus real captured dispatches. Reached via `rst 0x08`
 *           (m.call 0x0008) from many callers incl. the main-loop task entry_051c; ~14900
 *           dispatches in a 1500-frame attract run, and BOTH arms occur (proceed while
 *           ATTRACT==0, skip while ATTRACT==1).
 * LIVE-OUT: memory-only (writes none) — the control-flow boolean is the whole output; the
 *           A/F/SP/PC the oracle leaves are dead ABI (the two-level Z80 return becomes JS
 *           control flow, and every caller reloads A the instant the guard returns).
 * NAMES:    ATTRACT (0x6007).
 */

import { ATTRACT } from "./ram.js";

export function gameActiveGuard(m) {
  // `ld a,(ATTRACT) / rrca / ret nc` — carry takes bit 0, and the guard proceeds
  // (returns true) exactly when that bit is CLEAR: not in attract, so a credited
  // game is in progress and the caller's remainder should run.
  return (m.mem.read8(ATTRACT) & 0x01) === 0;
}
