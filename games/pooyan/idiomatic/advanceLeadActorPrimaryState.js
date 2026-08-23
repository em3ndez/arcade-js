// SPDX-License-Identifier: GPL-3.0-only
import { runLaunchAndTargetActorPipeline } from "./runLaunchAndTargetActorPipeline.js";
import { loc_25a6 } from "./loc_25a6.js";
import { loc_308b } from "./loc_308b.js";
import { TAMPER_FREEZE_FLAG, ACTOR_TABLE, ACTOR_GROUP_STATE_DISPATCH } from "./names.js";
/**
 * advanceLeadActorPrimaryState — per-frame driver for the lead actor group.
 *
 * Runs three per-frame sub-passes in order, then aborts if the freeze flag is set. Otherwise it
 * dispatches the lead actor record's state (low three bits) through the shared spine trampoline into
 * the inline handler table; the selected handler returns straight to this driver's caller. Balanced
 * seating (plain-return abort, tail dispatch). LIVE-OUT: none — the dispatch index and record base
 * are marshalled into the still-frozen spine through the register bridge.
 */

const STATE_MASK = 0x07; // three-bit state index

export function advanceLeadActorPrimaryState(m) {
  const { mem8 } = m;
  runLaunchAndTargetActorPipeline(m);
  loc_25a6(m);
  loc_308b(m);
  if (mem8[TAMPER_FREEZE_FLAG] !== 0) return; // frozen -> skip the dispatch
  m.regs.ix = ACTOR_TABLE; // record base the dispatched handler reads (register bridge)
  m.regs.a = mem8[ACTOR_TABLE + 0x02] & STATE_MASK; // dispatch index (register bridge)
  m.push16(ACTOR_GROUP_STATE_DISPATCH); // inline jump-table base
  return m.call(0x0028); // rst-0x28 spine dispatcher (unlifted) -> handler -> caller
}
