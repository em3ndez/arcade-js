// SPDX-License-Identifier: GPL-3.0-only
import { initRoundState } from "./initRoundState.js";
import { plotRecordFieldColumns } from "./plotRecordFieldColumns.js";
import { mainLoop } from "./mainLoop.js";

/**
 * loc_200e — the game entry (ROM 0x200e). This is the trunk the whole frame loop hangs from: it
 * brings one round into existence and then never returns. Three acts, strictly in order — seed the
 * round's working state, lay down the static record field, then hand off to the per-frame main loop.
 *
 * Written as a JavaScript generator on purpose: `mainLoop` pauses once per displayed frame at the
 * vertical-blank heartbeat, and because this entry enters the loop as a continuation of itself
 * (`yield*`), those per-frame pauses propagate all the way back out to the engine that drives the
 * machine. So the entry is not a setup-and-return function — it *is* the running game.
 *
 * On the real 6502 the `cli` that opens this code enables the 32V IRQ; in the idiomatic layer that
 * is vestigial, because the engine fires the frame interrupt as a direct, always-unmasked call.
 *
 * Role: main-loop spine / game entry.  Grounding: [code].  Live-out: never returns (drives forever).
 */
export function* loc_200e(m) {
  // Act 1 — seed the round's working state: the zero-page cells a fresh board needs before
  // anything can read or move them (see initRoundState / the round-lifecycle subsystem).
  initRoundState(m);
  // Act 2 — lay the record field: the static playfield scaffolding the round is played on, drawn
  // once here so the field exists before the first frame simulates on top of it.
  plotRecordFieldColumns(m);
  // Act 3 — become the main loop. `yield*` makes this entry a continuation of the loop, so each of
  // the loop's frame-boundary vblank yields surfaces back through here to the driving engine.
  yield* mainLoop(m);
}
