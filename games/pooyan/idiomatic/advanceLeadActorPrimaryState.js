// SPDX-License-Identifier: GPL-3.0-only
import { runLaunchAndTargetActorPipeline } from "./runLaunchAndTargetActorPipeline.js";
import { loc_25a6 } from "./loc_25a6.js";
import { loc_308b } from "./loc_308b.js";
import { TAMPER_FREEZE_FLAG, ACTOR_TABLE } from "./names.js";
import { beginLeadActorLiftOnClear } from "./beginLeadActorLiftOnClear.js";
import { dropLeadActorAfterDelay } from "./dropLeadActorAfterDelay.js";
import { nudgeLeadActorAndAdvanceOnDelay } from "./nudgeLeadActorAndAdvanceOnDelay.js";
import { descendLeadActorToLanding } from "./descendLeadActorToLanding.js";
import { advanceActorDropStateOnDelay } from "./advanceActorDropStateOnDelay.js";
import { advancePlayStateToPhase7OnActorDelay } from "./advancePlayStateToPhase7OnActorDelay.js";

/**
 * advanceLeadActorPrimaryState — per-frame driver for the lead actor group.
 *
 * Runs three per-frame sub-passes in order, aborts if the freeze flag is set, then runs the handler
 * for the lead actor record's state (low three bits); the handler returns straight to this driver's
 * caller (a tail dispatch). The record base (ACTOR_TABLE) is passed to each handler.
 *
 * LIVE-OUT: none — a void per-frame dispatch.
 */
const STATE_MASK = 0x07; // three-bit state index

export function advanceLeadActorPrimaryState(m) {
  const { mem8 } = m;
  runLaunchAndTargetActorPipeline(m);
  loc_25a6(m);
  loc_308b(m);
  if (mem8[TAMPER_FREEZE_FLAG] !== 0) return; // frozen -> skip the dispatch
  switch (mem8[ACTOR_TABLE + 0x02] & STATE_MASK) {
    case 0: return beginLeadActorLiftOnClear(m, ACTOR_TABLE);
    case 1: return dropLeadActorAfterDelay(m, ACTOR_TABLE);
    case 2: return nudgeLeadActorAndAdvanceOnDelay(m, ACTOR_TABLE);
    case 3: return descendLeadActorToLanding(m, ACTOR_TABLE);
    case 4: return advanceActorDropStateOnDelay(m, ACTOR_TABLE);
    case 5: return advancePlayStateToPhase7OnActorDelay(m, ACTOR_TABLE);
  }
}
