// SPDX-License-Identifier: GPL-3.0-only
import { gateEnemySpawnOnActiveCountAndInit } from "./gateEnemySpawnOnActiveCountAndInit.js";
import { spawnEnemyIntoFreeActorSlot } from "./spawnEnemyIntoFreeActorSlot.js";
import {
  ENEMY_SPAWN_TIMER,
  ROUND_COUNTER,
  STAGE_COUNTDOWN,
  ACTIVE_ENEMY_COUNT,
  SPEED_INDEX,
  ENEMY_ACTOR_TABLE,
} from "./names.js";

// The enemy-actor pool: six fixed-layout records, each 0x18 (24) bytes, packed end-to-end
// starting at ENEMY_ACTOR_TABLE (0x8ae0). A spawn sweep walks these six slots in order looking
// for an empty one to fill.
const SLOT_COUNT = 0x06;
const SLOT_STRIDE = 0x18;
// The "kind" byte handed to the spawn body for every actor this driver seats. It is written into
// the new record's +0x04 field and marks the actor as this driver's flavour of enemy (a wolf on
// the attack line), distinct from the kind bytes other spawn drivers stamp when they reuse the
// same free-slot door.
const SPAWN_E_FIELD = 0x1d;

/**
 * tickEnemySpawnTimerAndGateSpawn — the enemy-spawn cadence tick.
 *
 * ROM 0x56e8-0x572a. Grounding: [seen].
 *
 * WHAT IT IS
 *   The throttle at the head of the enemy-attack subsystem. Enemies (the diving wolves) live in
 *   the six-slot ENEMY_ACTOR_TABLE (0x8ae0); this routine is the per-frame gatekeeper that decides
 *   whether *this* frame is allowed to bring one more of them to life. It fires once per frame and
 *   almost always does nothing — it exists to space spawns out over time and to hold the number of
 *   live enemies within the wave's budget.
 *
 * ROLE IN THE MACHINE
 *   Two clocks meter the attack. The first is a plain countdown, ENEMY_SPAWN_TIMER (0x8d07): while
 *   it is nonzero this routine simply decrements it and leaves, so spawns can only be considered on
 *   the frames the timer reads zero. The second is a census gate: even when the timer has elapsed,
 *   a new enemy is seated only if the wave still owes one and the board is not already saturated.
 *   The odd/even parity of ROUND_COUNTER (0x8907) splits the machine in two — even rounds delegate
 *   the whole decision to the dedicated even-round spawn gate, while odd rounds run the census gate
 *   inline here before sweeping the pool. When everything clears, exactly one actor is born (the
 *   spawn body aborts the sweep the moment it fills a slot), and the spawn body reloads
 *   ENEMY_SPAWN_TIMER so the next spawn is once again a countdown away.
 *
 * LIVE-OUT
 *   None — a void per-frame driver; the caller returns straight after and reads no register back.
 *   Everything it produces lives in RAM: the decremented spawn timer (0x8d07), and, when a spawn
 *   fires, the freshly seeded slot record plus the bumped live-enemy census ACTIVE_ENEMY_COUNT
 *   (0x8d40) and the reloaded spawn timer that the spawn body writes.
 */
export function tickEnemySpawnTimerAndGateSpawn(m) {
  const { mem8 } = m;

  // Cadence countdown (ROM 0x56eb-0x56f2). Sample the spawn-cadence timer at ENEMY_SPAWN_TIMER
  // (0x8d07). While it is still running (nonzero), tick it down by one and leave — no spawn is even
  // considered until it reaches zero, which is how consecutive spawns are spaced out in time.
  const timer = mem8[ENEMY_SPAWN_TIMER];
  if (timer !== 0) {
    mem8[ENEMY_SPAWN_TIMER] = timer - 1; // nonzero -> no underflow; mem8 masks the byte
    return;
  }

  // Round-parity split (ROM 0x56f6-0x56fb). The timer has elapsed, so a spawn is now on the table.
  // ROUND_COUNTER (0x8907) bit 0 selects which spawn machine runs. On an EVEN round, hand the whole
  // decision to the even-round spawn gate and return through it — the gate's own return unwinds this
  // frame — passing the round counter itself as the gate's seed value.
  const round = mem8[ROUND_COUNTER];
  if (!(round & 0x01)) return gateEnemySpawnOnActiveCountAndInit(m, round); // even round -> spawn gate (tail; seed = round)

  // Odd-round census gate, part 1 (ROM 0x56fe-0x5704). Compute the wave's remaining spawn budget as
  // the per-stage countdown STAGE_COUNTDOWN (0x8901) minus the live-enemy census ACTIVE_ENEMY_COUNT
  // (0x8d40). Two guards bail with nothing spawned: an EQUAL count means the board already holds
  // every enemy this stage will field, and a countdown BELOW the census (a borrow on the subtract)
  // means the same — no room to add another. Only a positive surplus continues; that surplus, `col`,
  // is carried into the spawn body as its scan-state head.
  const stageCountdown = mem8[STAGE_COUNTDOWN];
  const active = mem8[ACTIVE_ENEMY_COUNT];
  if (stageCountdown === active) return;
  if (stageCountdown < active) return;
  const col = stageCountdown - active;

  // Odd-round census gate, part 2 — the concurrency cap (ROM 0x5708-0x5718). SPEED_INDEX (0x8900)
  // is the round's difficulty/speed step; it also sets how many enemies may be on the board at once.
  // Below 3, the cap is SPEED_INDEX+4 (so it grows with difficulty from 4 up to 6); at 3 or above it
  // pins to 6, the size of the pool. If the live census has already reached that cap, bail — the
  // board is saturated and no slot may be filled this frame.
  const speed = mem8[SPEED_INDEX];
  const threshold = speed < 0x03 ? speed + 0x04 : 0x06;
  if (active >= threshold) return;

  // Slot sweep (ROM 0x571c-0x572a). The gate has passed, so walk the six actor records in order,
  // handing each to the spawn body along with the surplus `col` (its scan-state head) and the kind
  // byte SPAWN_E_FIELD. The spawn body skips any slot that is already live and reports back; the
  // first empty slot it fills, it returns truthy, and we abort the sweep immediately — so at most
  // one enemy is born per elapsed cadence tick. When no slot could be filled, the sweep simply runs
  // out over all six records and the frame ends with nothing spawned.
  let rec = ENEMY_ACTOR_TABLE;
  for (let n = SLOT_COUNT; n > 0; n--) {
    if (spawnEnemyIntoFreeActorSlot(m, rec, col, SPAWN_E_FIELD)) return; // spawned -> abort the sweep
    rec += SLOT_STRIDE;
  }
}
