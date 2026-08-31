// SPDX-License-Identifier: GPL-3.0-only
import { tickEnemyAnimAndReseedPoolAtCycleEnd } from "./tickEnemyAnimAndReseedPoolAtCycleEnd.js";
import { drainPhaseCountdownAndReseedWave } from "./drainPhaseCountdownAndReseedWave.js";
import { holdEnemyAnimGatedByDrawnFlag } from "./holdEnemyAnimGatedByDrawnFlag.js";

// One enemy the game tracks is an ACTOR RECORD — a fixed-layout block of bytes in the enemy pool,
// records spaced 0x18 bytes apart. The byte at offset +0x02 is that record's DISPATCH-STATE field,
// and its low two bits name which of the three per-record tick behaviours the record is running.
const STATE_FIELD = 0x02; // offset of the dispatch-state byte inside one enemy-actor record
const STATE_MASK = 0x03; //  low two bits of that byte select the tick state (0 / 1 / 2)

/**
 * dispatchEnemyActorAnimTickState — per-record animation-tick dispatcher for the enemy-actor pool.  ROM 0x7638-0x7643.
 *
 * WHAT IT IS
 *   Every enemy the game tracks lives as an ACTOR RECORD — a fixed-size struct in the enemy pool,
 *   records spaced 0x18 bytes apart — and each record carries a small DISPATCH-STATE byte at
 *   offset +0x02. Once per frame a walk visits a run of those records in table order and hands
 *   each one to this dispatcher, with the record's base address arriving in the record pointer
 *   (ix). This routine's whole job is to read that record's state byte, reduce it to the range
 *   0..2, and route the record to the matching per-record tick handler.
 *
 * ITS ROLE IN THE MACHINE
 *   This is the fan-out node of the enemy-actor animation-tick machine. The three states it
 *   selects are the only reachable ones, and together they drive one wave phase to the next:
 *     - state 0 (tickEnemyAnimAndReseedPoolAtCycleEnd) advances a record's animation cadence and, when the cycle completes,
 *       kicks the whole run of records over into state 1;
 *     - state 1 (drainPhaseCountdownAndReseedWave) paces out the shared phase countdown (0x892e) and, at zero, reseeds
 *       the pool into its hold state and hands off to the next stretch of the sequence;
 *     - state 2 (holdEnemyAnimGatedByDrawnFlag) is the settled/hold state: it gates on the pool-wide drawn flag
 *       (0x8d58) and otherwise just steps the record's own animation.
 *   The dispatcher itself keeps no state and touches no memory beyond reading the one selector
 *   byte at +0x02; every side effect belongs to the handler it routes to.
 *
 * ITS PLACE IN THE WALK
 *   Reached once per record from the shared per-frame walk (advanceEnemyActorStateWalk, ROM
 *   0x7627), which steps a run of enemy-actor records (stride 0x18) in table order and stops
 *   early the moment a tick asks it to. States 0 and 1 can make that request — each returns
 *   false after it reseeds the pool, so the walk abandons the rest of this frame's pass rather
 *   than tick records whose state has just changed underneath it; state 2 always returns true
 *   (keep walking). This dispatcher passes the selected handler's boolean straight back to the
 *   walk unchanged.
 *
 * GROUNDING: [seen] — the shared animation-tick walk this dispatcher belongs to
 *   (advanceEnemyActorStateWalk, ROM 0x7627) and all three state handlers it selects
 *   (tickEnemyAnimAndReseedPoolAtCycleEnd / drainPhaseCountdownAndReseedWave / holdEnemyAnimGatedByDrawnFlag) carry the [seen] tag; every tick reaches its handler
 *   through this node.
 *
 * LIVE-OUT: none in registers — the return value is the selected handler's control-flow boolean,
 *   passed straight through (true = the walk keeps stepping records; false = abort this frame's
 *   walk). Memory: nothing of its own — whatever the routed handler wrote.
 */
export function dispatchEnemyActorAnimTickState(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // Read this record's dispatch-state byte (record base ix, offset +0x02) and mask it to its low
  // two bits (STATE_MASK) to get the tick state 0..2, then route the record to that state's
  // handler. The handler runs to completion and its control-flow boolean flows straight back to
  // the walk.
  switch (mem8[ix + STATE_FIELD] & STATE_MASK) {
    case 0:
      // State 0 — advance the record's animation cadence; on cycle completion it reseeds the
      // whole run into state 1 and returns false to abort the walk for this frame.
      return tickEnemyAnimAndReseedPoolAtCycleEnd(m, ix);
    case 1:
      // State 1 — drain the shared phase countdown; while it runs, tick it and keep walking; at
      // zero, reseed the pool into its hold state and return false to abort the walk.
      return drainPhaseCountdownAndReseedWave(m, ix);
    case 2:
      // State 2 — settled/hold: gate on the pool-wide drawn flag, otherwise step this record's
      // own animation; always returns true so the walk carries on to the next record.
      return holdEnemyAnimGatedByDrawnFlag(m, ix);
  }
}
