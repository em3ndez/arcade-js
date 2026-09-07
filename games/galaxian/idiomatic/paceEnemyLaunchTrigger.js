// SPDX-License-Identifier: GPL-3.0-only
// paceEnemyLaunchTrigger -- ROM 0x1515, grounding [seen].
// The pacemaker that meters the trickle of diving attackers out of the standing
// formation. It is a gated prescaler over a block of per-attacker sub-counters:
// it ticks a master counter and, on expiry, sweeps a difficulty-scaled span of
// those sub-counters, refilling each that reached zero and raising the one-shot
// spawn-trigger flag SUBCOUNTER_REFILL_FLAG (0x4228). launchAttackerFromFormation
// (ROM 0x1344) consumes that flag on a later pass to launch one new diver, so
// this routine is what decides HOW OFTEN a fresh attacker peels off.
// Live-out: master counter loc_424a (0x424a), the sub-counter block just after
// it, and SUBCOUNTER_REFILL_FLAG (raised only if a sub-counter refilled).
import {
  OBJ_ACTIVE_FLAG,
  loc_4220,
  loc_422b,
  loc_421a,
  loc_421b,
  loc_424a,
  SUBCOUNTER_REFILL_FLAG,
  SUBCOUNTER_RELOAD_TABLE,
} from "./names.js";
import { reloadExpiredCounterAndTally } from "./reloadExpiredCounterAndTally.js";

export function paceEnemyLaunchTrigger(m) {
  const { mem8 } = m;

  // Gate the pacemaker off unless the object subsystem is live and no inhibit is
  // asserted: OBJ_ACTIVE_FLAG (0x4200) bit0 must be set, and neither the
  // region-clear flag loc_4220 (0x4220) nor the inhibit flag loc_422b (0x422b)
  // bit0 may be set. Any of these bails with no state change.
  if ((mem8[OBJ_ACTIVE_FLAG] & 0x01) === 0) return;
  if (mem8[loc_4220] & 0x01) return;
  if (mem8[loc_422b] & 0x01) return;

  // Width of the sub-counter sweep, widening with difficulty: the pace counter
  // loc_421a (0x421a) plus the stage loc_421b (0x421b, but only once the stage
  // is >= 2), taken mod 16, plus one. A wider span expires more sub-counters per
  // pass, so more attackers launch as the pace and stage climb.
  const pace = mem8[loc_421a];
  const stage = mem8[loc_421b];
  const span = ((pace + (stage >= 2 ? stage : 0)) & 0x0f) + 1;

  // Tick the master counter loc_424a (0x424a) down one (mod 256). Until it hits
  // zero the timer has not fired: hold the refill flag low and stop.
  const master = (mem8[loc_424a] - 1) & 0xff;
  mem8[loc_424a] = master;
  if (master !== 0) {
    mem8[SUBCOUNTER_REFILL_FLAG] = 0;
    return;
  }

  // Master expired: reload it from the head of SUBCOUNTER_RELOAD_TABLE (0x15e3),
  // then sweep `span` sub-counters that live in the cells just past the master.
  mem8[loc_424a] = mem8[SUBCOUNTER_RELOAD_TABLE];
  let refills = 0;
  for (let i = 1; i <= span; i++) {
    // Decrement each sub-counter (mod 256); when one reaches zero, refill it
    // from the matching reload-table entry and tally the refill. The running
    // tally is threaded through reloadExpiredCounterAndTally so it survives.
    const cell = loc_424a + i;
    const remaining = (mem8[cell] - 1) & 0xff;
    mem8[cell] = remaining;
    if (remaining === 0) {
      refills = reloadExpiredCounterAndTally(m, SUBCOUNTER_RELOAD_TABLE + i, cell, refills);
    }
  }

  // Raise the spawn-trigger flag only if at least one sub-counter refilled this
  // pass; launchAttackerFromFormation consumes it to launch a new attacker.
  if (refills !== 0) mem8[SUBCOUNTER_REFILL_FLAG] = 1;
}
