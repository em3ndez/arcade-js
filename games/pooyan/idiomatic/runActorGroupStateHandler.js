// SPDX-License-Identifier: GPL-3.0-only
import { spawnActorGroupRecords } from "./spawnActorGroupRecords.js";
import { animateActorGroupGrowShrink } from "./animateActorGroupGrowShrink.js";
import { advanceActorGroupRiseAndCycleTiles } from "./advanceActorGroupRiseAndCycleTiles.js";
/**
 * runActorGroupStateHandler — run the fountain actor-group's per-frame state handler.
 *
 * WHAT IT IS
 *   The top of the small state machine that owns one animated actor group — the "fountain":
 *   three stacked, identical actor records that the game grows, shrinks, and creeps up the screen
 *   as a single on-screen object. Like every actor in Pooyan, that group is a 0x18-byte record in
 *   the actor arena; this group's base record sits at HUNTER_TABLE_BASE (0x8c78), and the pointer
 *   to it arrives in `rec`. Each frame the object driver hands the group here, and this routine
 *   reads the group's own state index and runs exactly one of three handlers for it — no more.
 *   It does no work of its own beyond that selection; it is a pure fan-out to the phase handler
 *   the group's state byte names.
 *
 * ROLE IN THE MACHINE
 *   The group advances through three phases, and its current phase lives in the state field at
 *   +0x02 of its own record — the same offset every actor record uses for its state-machine
 *   selector (the arena's uniform "+0x02 = state index" convention). That byte indexes an inline
 *   three-entry jump table in ROM at 0x64ff, so state 0/1/2 route to the spawn, grow/shrink, and
 *   rise/cycle handlers respectively:
 *     - state 0  spawnActorGroupRecords (ROM 0x6505) — the one-shot spawn: seats the three
 *                constituent records, seeds the group's shared animation timers, and kicks off the
 *                spawn sound/tile run. It advances the state so the group leaves this phase.
 *     - state 1  animateActorGroupGrowShrink (ROM 0x6566) — the per-frame grow/shrink pulse: on a
 *                paced beat it pushes the three copies' X and size out (grow) or pulls them back in
 *                (shrink), redrawing the group so it appears to breathe.
 *     - state 2  advanceActorGroupRiseAndCycleTiles (ROM 0x6666) — the per-frame steady tick: inch
 *                each idle record up the play field (retiring one that reaches the top), then step
 *                the group's shared sprite-frame animation.
 *   The state byte only ever holds 0, 1, or 2 in practice, so the switch needs no other arm; a
 *   stray value falls through and the group is left untouched for the frame.
 *
 * ROM: 0x64fb-0x6504.
 * Grounding: [seen].
 *
 * LIVE-OUT: memory only. The selected handler writes the group's records and shared animation
 *   cells in work RAM; nothing this routine produces is read back from a register — the caller
 *   reloads its own pointers after the call.
 */
export function runActorGroupStateHandler(m, rec = m.regs.ix) {
  const { mem8 } = m;
  // Read the group's phase from the state field at +0x02 of its record (the arena-wide
  // "+0x02 = state index" convention) and route to that phase's handler. In the machine this
  // byte indexes the inline three-word jump table at ROM 0x64ff; the chosen handler runs the
  // group's whole per-frame update and returns straight to our caller.
  switch (mem8[rec + 0x02]) {
    case 0:
      // Phase 0 — spawn. One-shot initialiser: seat the three constituent records, seed the
      // shared frame-delay / blink-phase timers, and emit the spawn sound + tile run. It steps
      // the group past this phase so the next frame no longer lands here.
      return spawnActorGroupRecords(m, rec);
    case 1:
      // Phase 1 — grow/shrink pulse. One frame of the breathing animation: on the paced flip
      // beat push the three copies' X/size outward (grow) or draw them back in (shrink), keeping
      // all three record banks in step so they move as one object.
      return animateActorGroupGrowShrink(m, rec);
    case 2:
      // Phase 2 — rise + cycle. The steady-state tick: creep each still-idle record up the play
      // field one sub-row at a time (retiring any that reaches the top), then advance the group's
      // shared sprite-frame animation on its fixed cadence.
      return advanceActorGroupRiseAndCycleTiles(m, rec);
  }
}
