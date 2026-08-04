// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchIntroCutsceneStep — vector the opening Kong-climb cutscene to its current step
 * handler.
 *
 * The opening Kong-climb cutscene is the short animated intro that plays at the head of
 * every board before gameplay begins; it owns one in-game sub-state, and the sub-state
 * dispatcher reaches this routine once per frame while it is active. This routine is the
 * cutscene's own per-frame dispatcher: it reads the cutscene STEP index INTRO_STEP and
 * vectors through an 8-entry inline jump table to the handler for that step:
 *   0 — seed the cutscene's walk/animation pointers.
 *   1 — advance Kong's climb.
 *   2 — advance Kong's climb, and re-aim the sequence-advance pointer at INTRO_STEP.
 *   3 — the shared gated tick: once the sub-state timer expires, bump the byte the
 *       sequence-advance pointer aims at (INTRO_STEP) — a metered pause that moves the
 *       cutscene on to the next frame's arm.
 *   4 — next cutscene beat (re-aims the sequence-advance pointer at INTRO_STEP).
 *   5 — the same metered pause as step 3.
 *   6 — next cutscene beat.
 *   7 — final beat; fires the Kong roar as priority audio.
 * INTRO_STEP walks 0 -> 1 -> ... -> 7 over the cutscene; each arm is a short cutscene-setup
 * step that typically advances the step for the next frame, directly or via the gated tick.
 * None of them is the interruptible per-frame gameplay loop — that is a different sub-state,
 * one dispatch level up.
 *
 * The vector normally goes through a shared trampoline that recovers the inline table base
 * off the stack, reads the little-endian word at table[selector], and jumps to it. Here the
 * trampoline is folded in, because this table's base is a compile-time constant: the whole
 * mechanism is "read table[step], dispatch". The dispatch itself is genuine computed control
 * flow into a table of targets, so it routes through the generic address dispatcher rather
 * than a local JS function table. The trampoline's register/flag handoff is NOT reproduced —
 * no arm reads it.
 *
 * LIVE-OUT: memory-only — the step handler's writes. Nothing at this level returns a value.
 */

import { INTRO_STEP } from "./names.js";
import { loc_00ca } from "../translated/loc_00ca.js";

// The inline jump table: 8 little-endian target addresses, indexed by INTRO_STEP. Fixed
// program data, not work RAM.
const INTRO_STEP_TABLE = 0x0a7a;

// The dispatch-site label; it only ever surfaces inside a NotImplemented throw, naming
// which inline table an out-of-range selector fell off of.
const DISPATCH_TABLE_0A7A = "0x0A7A (0x6385 sequence)";

export function dispatchIntroCutsceneStep(m) {
  const { mem } = m;

  // The opening-cutscene step index (0..7).
  const step = mem.read8(INTRO_STEP);

  // Doubling the index to a 2-byte table offset is an 8-BIT operation — selector 0x80
  // wraps the offset back to 0 — so the address math is `base + (2*step & 0xff)`, NOT
  // `base + 2*step`. Then read the little-endian target word at table[step].
  const entry = (INTRO_STEP_TABLE + ((step * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // Dispatch to the step handler. The arm's return value is discarded at this level.
  loc_00ca(m, target, DISPATCH_TABLE_0A7A);
}
