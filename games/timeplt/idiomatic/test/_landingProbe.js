// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test-only instrument for comparing a rewrite that RAISES at a tamper landing with an oracle that
 * transfers there and runs on. The landing's own effects have no faithful routine form (a trap that
 * unwinds return words the rewrite never lays down, or bytes run as code), so the two sides are
 * compared AT the transfer: the oracle is stopped on entry to the landing, the rewrite must raise
 * NotImplemented naming that landing, and the machine states are compared at that point.
 *
 * stopAtLandings(m, addrs) — give a clone its own routine map (a clone shares its parent's) with each
 *   landing replaced by a probe that throws `LandingReached`. Everything before the transfer runs
 *   unchanged.
 *
 * landingOf(e, names) — the landing a fault names: the probe's address on the oracle side; on the
 *   rewrite side, the address whose module name (from `names`, a Map addr -> name) a NotImplemented
 *   message starts with. null for any other fault, so a stray crash never passes for a landing.
 */

import { NotImplemented } from "../../../../boards/timeplt/io.js";

export class LandingReached extends Error {
  constructor(addr) {
    super(`landing reached 0x${addr.toString(16).padStart(4, "0")}`);
    this.name = "LandingReached";
    this.addr = addr;
  }
}

export function stopAtLandings(m, addrs) {
  m.routines = new Map(m.routines);
  for (const addr of addrs) m.routines.set(addr, () => { throw new LandingReached(addr); });
  return m;
}

export function landingOf(e, names) {
  if (e instanceof LandingReached) return e.addr;
  if (e instanceof NotImplemented) {
    for (const [addr, name] of names) if (e.message.includes(`not implemented: ${name}:`) || e.message.startsWith(`${name}:`)) return addr;
  }
  return null;
}
