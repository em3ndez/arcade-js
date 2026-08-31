// SPDX-License-Identifier: GPL-3.0-only
import { spawnObjectIntoFreeSlot } from "./spawnObjectIntoFreeSlot.js";
import { ENEMY_ACTOR_TABLE, SPRITE_OBJECT_TABLE } from "./names.js";
/**
 * spawnObjectGatedByArmedActorCount — a spawn request that fires only when the wave is in the
 * right shape.
 *
 * WHAT IT IS
 *   A guarded front door to the shared free-slot spawner. A caller hands it one actor "record" (a
 *   0x18-byte block describing an object in the world). Depending on a single arm bit inside that
 *   record, this routine either lets the spawn happen immediately or first demands that the enemy
 *   population be in a very specific state — exactly one enemy currently sitting in the counted
 *   spawn state — and abandons the spawn otherwise. It never itself writes an actor; when the gate
 *   opens it seats a scan window over the sprite-object pool and lets the free-slot spawner do the
 *   work, adopting whatever that spawner returns.
 *
 * ROLE IN THE MACHINE
 *   Enemy waves in Pooyan are released a piece at a time, and some releases must be rationed so the
 *   board does not flood: a follow-up object may only appear while precisely one predecessor is
 *   alive in the "just spawned / in the counted phase" state. This routine is that ration valve.
 *   The record's arm bit selects the mode: armed means "only spawn when the population count is
 *   exactly one"; unarmed means "spawn unconditionally". Both open modes converge on the same
 *   sprite-object spawn; the armed-but-wrong-count case is the only one that refuses.
 *
 * ROM 0x365d-0x367e.
 * Grounding: [seen].
 *
 * LIVE-OUT: none of its own — a dispatched state handler. The two open paths delegate to the
 *   free-slot spawner, which is what actually fills a record and leaves the world changed; this
 *   routine reads no register back from it and simply forwards its result. On the closed (bail)
 *   path it leaves the accumulator holding the last state byte it scanned — a harmless value result
 *   the caller does not depend on.
 */

// Layout of the tables and records this gate reaches into. RECORD_STRIDE is the byte distance
// between successive records in both the enemy-actor and sprite-object pools; the other four
// constants name the fields and magic values the precondition tests.
const RECORD_STRIDE = 0x18; // bytes between records in ENEMY_ACTOR_TABLE / SPRITE_OBJECT_TABLE
const SCAN_RECORDS = 6; // enemy-actor records examined by the population count
const SLOT_COUNT = 0x05; // sprite-object window is 5 slots offered to the free-slot spawner
const STATE_FIELD = 0x02; // +0x02 state byte of each enemy-actor record (the dispatched sub-state)
const ARM_FIELD = 0x0b; //  rec+0x0b bit0 arms the count precondition on this actor's own record
const SPAWN_STATE = 0x03; // the enemy state value the precondition counts occurrences of

export function spawnObjectGatedByArmedActorCount(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // --- The arm gate (ROM 0x365d-0x3676) ---
  // Bit0 of this actor record's own +0x0b flag byte decides whether a precondition applies. When
  // it is clear this whole block is skipped and the spawn proceeds unconditionally. When it is set,
  // the spawn is rationed: it is only allowed while exactly one enemy actor is currently sitting in
  // the counted spawn state.
  if (mem8[rec + ARM_FIELD] & 0x01) {
    // Population count (ROM 0x3666-0x3675). Walk the first SCAN_RECORDS enemy-actor records of
    // ENEMY_ACTOR_TABLE (0x8ae0) at the 0x18 stride and read each record's +0x02 state byte — the
    // same per-object sub-state the enemy dispatcher runs on. Tally how many of those records hold
    // SPAWN_STATE (0x03). `state` keeps the last byte read, which also becomes the bail result.
    let count = 0;
    let state = 0;
    for (let k = 0; k < SCAN_RECORDS; k++) {
      state = mem8[ENEMY_ACTOR_TABLE + STATE_FIELD + k * RECORD_STRIDE];
      if (state === SPAWN_STATE) count++;
    }
    // The "exactly one" test (ROM 0x3676 ret nz). Subtracting one and masking to a byte yields zero
    // only when the tally was exactly one; any other count (including zero) is non-zero here and
    // closes the gate. Bailing leaves the accumulator holding the last scanned state byte as a
    // harmless value result and does not spawn anything this pass.
    if (((count - 1) & 0xff) !== 0) return (m.regs.a = state); // not exactly one -> bail
  }

  // --- Gate open: hand off to the free-slot spawner (ROM 0x3677-0x367e, falls through to 0x3680) ---
  // Whether the arm bit was clear or the population count was exactly one, control reaches here.
  // Seat a scan window over the sprite-object pool SPRITE_OBJECT_TABLE (0x8b70) — 5 records at the
  // 0x18 stride — and pass this actor record through as the spawn template. The free-slot spawner
  // finds the first empty record in that window and creates the new object into it; its result is
  // this routine's result.
  return spawnObjectIntoFreeSlot(m, SPRITE_OBJECT_TABLE, RECORD_STRIDE, SLOT_COUNT, rec);
}
