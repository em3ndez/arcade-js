// SPDX-License-Identifier: GPL-3.0-only
import { GAME_MODE, SEG_SPREAD_A_LO_4, EAROM_REGION_PENDING, PENDING_WORK_FLAGS, EAROM_MODE } from "./names.js";
import { armEaromReadback } from "./armEaromReadback.js";

/**
 * beginEaromSequenceIfIdle — kick off an EAROM access only when none is in flight. ROM 0xdb5a.
 *
 * Role in the machine: the EAROM is Tempest's non-volatile store (high-score table and bookkeeping),
 * driven a nibble at a time by a slow multi-frame state machine. This is the front door: it starts a new
 * EAROM read/write walk, but only if the store is currently idle, so a fresh request never stomps a
 * sequence that is still clocking bits.
 *
 * Behavior: it ORs the two EAROM guard cells — EAROM_MODE (loc_1c7, the active-operation flag) and
 * EAROM_REGION_PENDING (loc_1ca, the queued-region flag) — and bails immediately if either is set (a
 * sequence is already pending or running). When both are clear it arms the readback state machine via
 * armEaromReadback (the 0xde11 seeder), copies the pending-work flags (loc_1c9) into the loc_7c scratch
 * cell so the walk knows what to service, and stamps the game-mode cell (loc_0) to 0x02.
 *
 * Live-out: the armed EAROM readback state (from armEaromReadback), SEG_SPREAD_A_LO_4 (loc_7c) seeded
 * from the pending-work flags, and GAME_MODE (loc_0) = 0x02. Grounding: [seen].
 */
export function beginEaromSequenceIfIdle(m) {
  const { mem8 } = m;
  // Idle only when both EAROM guards are clear; any nonzero means a sequence is already pending/running.
  if ((mem8[EAROM_MODE] | mem8[EAROM_REGION_PENDING]) !== 0) return;
  armEaromReadback(m);                                  // arm the nibble-clocking readback state machine
  mem8[SEG_SPREAD_A_LO_4] = mem8[PENDING_WORK_FLAGS];   // seed the walk's scratch from the pending-work flags
  mem8[GAME_MODE] = 0x02;                               // advance the game-mode cell
}
