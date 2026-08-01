// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSubstateAndArmTimer — step to the next in-state sub-state and hold it for
 * 0x40 frames.  ROM 0x19d2.
 *
 * The shared tail of the per-frame update cascade (loc_197a, whose last act is
 * `return`-ing into it) and of the idx3 WAIT+EXIT handler (loc_1a2a, which `jp`s
 * here). Both reach it to close out the current sub-state: it bumps GAME_SUBSTATE
 * (0x600A) by one — advancing the rst-0x28 sub-state dispatch index to the next
 * handler within the current GAME_STATE — and re-arms SUBSTATE_TIMER (0x6009) to 0x40,
 * so the new sub-state waits 64 frames before it may proceed (the rst-0x18 gate,
 * tickSubstateTimer, counts that byte down 1/frame). This is the "advance to the next
 * sub-state, after a delay" specialisation of the "wait N then go to sub-state M"
 * idiom, with M = current+1 and N = 0x40. Sibling advanceToNextBoard ends the same
 * way (SUBSTATE_TIMER = 0x30, GAME_SUBSTATE = 8) but SETS M; this one INCREMENTS it.
 *
 * A LEAF: its only input is GAME_SUBSTATE's current byte (the +1 wraps mod 256);
 * SUBSTATE_TIMER is set unconditionally. It loads its own HL, so the caller's HL is
 * not a live-in. Writes memory, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-19d2.test.js.
 * GATE:     exhaustive — the only live-in is GAME_SUBSTATE's byte; compared to the
 *           oracle over all 256 of its values on RAM (whole dump, incl. the stack
 *           region neither side writes) + real captured 0x19d2 dispatches from an
 *           attract run. Reached as the shared tail of loc_197a / loc_1a2a.
 * LIVE-OUT: memory-only — GAME_SUBSTATE (incremented) and SUBSTATE_TIMER (= 0x40). The
 *           oracle's residual HL/A/F are dead ABI (the dispatch this returns to reads
 *           none); SP/pc are the dropped Z80 stack model, so its `ret` residue lands
 *           only in STACK_SCRATCH, excluded from the contract.
 * NAMES:    GAME_SUBSTATE (0x600A), SUBSTATE_TIMER (0x6009) — from ram.js.
 */

import { GAME_SUBSTATE, SUBSTATE_TIMER } from "./ram.js";

const SUBSTATE_WAIT_FRAMES = 0x40; // frames the new sub-state holds before it proceeds

export function advanceSubstateAndArmTimer(m) {
  const { mem } = m;
  // inc (0x600A): advance the sub-state dispatch index to the next handler (8-bit wrap).
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);
  // re-arm the rst-0x18 countdown so the new sub-state waits before it may proceed.
  mem.write8(SUBSTATE_TIMER, SUBSTATE_WAIT_FRAMES);
}
