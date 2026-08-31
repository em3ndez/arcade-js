// SPDX-License-Identifier: GPL-3.0-only
import { ROUND_COUNTER, SPAWN_STEP_TIMER, STATE_TIMER_RELOAD_TABLE } from "./names.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { restartActorAnimIfFlagBit0Set } from "./restartActorAnimIfFlagBit0Set.js";
import { dispatchSpawnScheduleUnlessActorFlagged } from "./dispatchSpawnScheduleUnlessActorFlagged.js";
import { spawnChildActorIntoFreeSpriteSlot } from "./spawnChildActorIntoFreeSpriteSlot.js";
/**
 * dispatchActorSpawnBySubStateAndPaceCadence — the per-frame router for one actor record's
 * "growth" life cycle, driven by the sub-state byte the record carries at offset +0x06.
 *
 * WHAT IT IS
 * Every spawning actor in the object world (an enemy that hatches, a formation member that
 * fills in, a child that buds off a parent) advances through a small numeric life cycle held
 * in its own record. That number lives at rec+0x06. This routine is the single place that
 * reads it each frame and decides which of three phases the record is in, then either hands
 * off to the matching handler or does the middle-phase pacing work itself.
 *
 *   • sub-state below 0x07  — the record is still coming into existence. It has not finished
 *     spawning, so nothing here should tick its cadence; control hands off to the spawn-step
 *     guard, which restarts the actor's animation when its own flag bit says so.
 *   • sub-state 0x14 or above — the record is fully grown and settled. Cadence pacing is over;
 *     control hands off to the field-compare dispatch, which routes a grown actor by its
 *     schedule as long as it is not flagged out.
 *   • anything in between (0x07..0x13) — the record is in its active growth window. This is
 *     where the routine does real work: it paces how often the record buds a child.
 *
 * ROLE IN THE MACHINE
 * The pacing uses one shared step timer, SPAWN_STEP_TIMER (RAM 0x8d6b). That timer is not
 * per-record; it is a single countdown that spaces successive spawns so children appear at a
 * measured rhythm rather than every frame. Each frame the record is in its growth window,
 * the routine either counts that timer down by one, or — when it hits zero — reloads it and
 * emits one child. The reload value is chosen per round, so later rounds spawn on a tighter
 * or looser beat than early ones.
 *
 * ROM 0x1399-0x13bb.
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only — it mutates SPAWN_STEP_TIMER (0x8d6b) and, on a spawn frame, the
 * child sprite slot and parent record written by the child-spawn helper. It returns nothing
 * the caller consumes.
 */
export function dispatchActorSpawnBySubStateAndPaceCadence(m, rec = m.regs.ix, count = m.regs.b) {
  const { mem8 } = m;

  // Read the record's life-cycle sub-state (rec+0x06). This single byte selects the phase
  // for the whole frame; the two range tests below carve it into the three phases.
  const state = mem8[rec + 0x06];

  // Phase 1 — still spawning (sub-state < 0x07). The record has not finished coming up, so
  // the cadence timer must not run yet. Hand off to the spawn-step guard, which restarts the
  // actor's animation only when bit0 of the record's flag byte (rec+0x08) is set. (ROM 0x1389.)
  if (state < 0x07) return restartActorAnimIfFlagBit0Set(m, rec);

  // Phase 3 — fully grown (sub-state >= 0x14). Growth and cadence are done; hand off to the
  // spawned-flag guard that fronts the field-compare dispatch, which routes a settled actor by
  // its schedule unless it has been flagged out of play. (ROM 0x1391.)
  if (state >= 0x14) return dispatchSpawnScheduleUnlessActorFlagged(m, rec);

  // Phase 2 — active growth window (0x07..0x13). Pace the child-spawn cadence with the shared
  // step timer at SPAWN_STEP_TIMER (RAM 0x8d6b). A zero timer means this frame is a spawn beat;
  // a nonzero timer means we are still counting down toward the next beat.
  if (mem8[SPAWN_STEP_TIMER] === 0) {
    // Spawn beat, but first honor the caller's supply budget. The count in B is the running
    // tally of actors already produced; at 0x80 or above the supply is spent, so bail without
    // touching the timer or spawning. (ROM 0x13b0 ret nc.)
    if (count >= 0x80) return; // count exhausted

    // Choose this round's cadence from the per-round reload table. The round counter's low
    // three bits (ROUND_COUNTER 0x8907 & 0x07) index STATE_TIMER_RELOAD_TABLE (ROM 0x13d3),
    // so the spawn rhythm changes as play advances through the rounds.
    const idx = mem8[ROUND_COUNTER] & 0x07;

    // Fetch the reload byte from the table (base + index, then read that ROM byte).
    const [reload] = fetchByteFromTableIndex(m, STATE_TIMER_RELOAD_TABLE, idx);

    // Re-arm the shared step timer so the next spawn beat lands `reload` frames later.
    mem8[SPAWN_STEP_TIMER] = reload;

    // Emit one child: find a free sprite-object slot and spawn a child actor into it, bumping
    // the animation counter and seeding the parent record along the way. (ROM 0x13bc.)
    return spawnChildActorIntoFreeSpriteSlot(m, rec);
  }

  // Not a spawn beat: tick the shared step timer down by one and wait for the next frame.
  // (ROM 0x13ac dec (hl).)
  mem8[SPAWN_STEP_TIMER] = mem8[SPAWN_STEP_TIMER] - 1;
}
