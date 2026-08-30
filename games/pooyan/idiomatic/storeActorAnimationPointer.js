// SPDX-License-Identifier: GPL-3.0-only
/**
 * storeActorAnimationPointer — point an actor at a new animation script and rewind it to the
 * script's first step.  ROM 0x5c75-0x5c7f.
 *
 * Each on-screen actor (Pooyan, an enemy, a projectile) carries a small record; three of its
 * fields describe which animation it is playing.  +0x0c:0x0d hold a 16-bit pointer to the
 * actor's current animation/frame script in ROM, and +0x0e is the index of the step within
 * that script the actor is currently showing.  This routine assigns a new script and, because
 * the old step index would be meaningless against a different script, zeroes it so the actor
 * restarts cleanly at step 0.  The record base arrives in IY and the new pointer in DE; it
 * calls nothing (a PURE LEAF).  [seen]
 *
 * The pointer is stored little-endian — low byte at +0x0c, high byte at +0x0d — matching how
 * the Z80 loads a 16-bit value back out of the record.
 *
 * LIVE-OUT: memory only — (iy+0x0c:0x0d) := the new script pointer, (iy+0x0e) := 0.  No
 * register is left for the caller to read back.
 */
export function storeActorAnimationPointer(m, record = m.regs.iy, pointer = m.regs.de) {
  const { mem8 } = m;
  const base = record;

  // Store the new animation-script pointer little-endian: low byte at +0x0c, high at +0x0d.
  mem8[base + 0x0c] = pointer;
  mem8[base + 0x0d] = pointer >> 8;

  // Rewind the actor to the first step of the new script: the step/frame index at +0x0e is
  // stale against a different script, so clear it to 0.
  mem8[base + 0x0e] = 0x00; // reset the step/frame index
}
