// SPDX-License-Identifier: GPL-3.0-only
/**
 * noopHighStateHandler — inert handler for the high object-states (14, 15, 16).
 *
 * WHAT IT IS
 *   A phantom no-op: a real, callable routine whose entire body on the machine is a single
 *   return instruction. It reads nothing, writes nothing, and touches no hardware register.
 *
 * ROM address: 0x4378 (a one-byte body: `ret`). Grounding tag: [seen].
 *
 * ROLE IN THE MACHINE
 *   Every animate thing on the field — the player, enemies, projectiles, rope/lift segments,
 *   spawned objects — is an entry in a stride-0x18 record array, and each record carries a
 *   per-frame state byte at offset +2. Once a frame, dispatchObjectStateHandler masks that byte
 *   to five bits ((IX+2)&0x1f), rejects an inactive record and any state index >= 0x11, and
 *   hands the surviving record to one of seventeen state handlers (indices 0..16). The dispatch
 *   is a flat table lookup, so every legal index must resolve to a real routine — there is no
 *   "skip this index" branch.
 *
 *   Several of those seventeen states are meant to be dormant for this game: the object sits in
 *   the state but the machine deliberately does nothing to it that frame. Rather than special-
 *   case those indices, the table points them at a routine that does nothing and returns. This
 *   handler is the target for the three highest live indices — object-states 14, 15, and 16 —
 *   while its companion noopLowStateHandler serves the dormant low indices (3 through 7, and 10).
 *   Splitting the inert slots across two identical stubs is simply how the original code lays the
 *   jump table out; both behave the same (return at once).
 *
 *   Because it reads and writes nothing, it is safe to reach from any of those states in any
 *   order; it cannot fail, cannot stall a record, and cannot perturb the rest of the machine.
 *
 * LIVE-OUT: none — the record and all of memory are left exactly as they were found.
 */
export function noopHighStateHandler(m) {
  // Object-states 14/15/16 are dormant slots in the per-object state machine: for these states
  // the machine intentionally performs no update this frame. There is no memory cell to step, no
  // sprite band to redraw, and no hardware register to poke — control returns immediately, and
  // dispatchObjectStateHandler moves on to the next record.
  return;
}
