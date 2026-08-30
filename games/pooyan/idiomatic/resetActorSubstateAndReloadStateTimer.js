// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetActorSubstateAndReloadStateTimer — return an enemy actor record to its first sub-state
 * and arm its state timer for a fresh dwell.
 *
 * ROM 0x3a48-0x3a50. Grounding: [seen].
 *
 * Enemy actors are 0x18-byte records in the arena that begins at 0x8a80. Two fields matter
 * here, both relative to the record the caller hands over:
 *   +0x02 — the actor's sub-state / phase index, the value a dispatcher masks (&7) to pick
 *           which state handler runs; it steps through the states of the actor's behaviour.
 *   +0x11 — a per-state countdown timer that a state handler ticks down to decide when to
 *           advance the actor.
 * This routine drops the sub-state back to 0 (the first state) and reloads the timer to 0x20
 * (32 frames), the standard dwell for that first state. It is the small "start this actor's
 * state machine over" tail reached from the actor-update path (jumped to when a position test
 * upstream selects the reset branch rather than the seat-a-new-animation branch).
 *
 * The record base is taken from the index register the caller left pointing at the record.
 *
 * LIVE-OUT: memory only — the two record fields (+0x02 and +0x11) on the actor record. No
 * register or flag survives for a caller. Calls nothing.
 */
export function resetActorSubstateAndReloadStateTimer(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Sub-state index (+0x02) back to 0 — the actor re-enters its first state.
  mem8[rec + 0x02] = 0x00;

  // State timer (+0x11) reloaded to 0x20 (32 frames), the first state's dwell before the
  // handler advances the actor again.
  mem8[rec + 0x11] = 0x20;
}
