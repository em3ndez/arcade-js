// SPDX-License-Identifier: GPL-3.0-only
import { loc_88, loc_94, loc_87, loc_9c, loc_41, loc_ef, loc_9f } from "./names.js";
import { seedSegmentSpawnState } from "./seedSegmentSpawnState.js";

/**
 * tickSpawnCadence — the finest of the three periodic-scheduling clocks, pacing the per-slot
 * spawn rhythm that decides when the next centipede segment is seeded.
 *
 * Role in the machine: it shares its "channel" selector $88 with the actor spawner, and it is
 * one leg of the timing loop formed with `serviceTimerBank` and `spawnActorOnTimer`. Each pass it
 * either steps an idle slot's phase and re-arms the gate, or — once the folded timing key the
 * master timer bank keeps refreshed clears a threshold — ticks a shared countdown and, on zero,
 * seeds the next segment spawn.
 *
 * Cells: $88 the shared slot selector; $94+x a per-slot byte read here as a gate (the spawner
 * writes it as a tally); $87 the shared arm byte (also the spawner's busy gate); $9c+x the slot's
 * phase counter; $41 the folded key `serviceTimerBank` refreshes; $ef the flip/orientation mask;
 * $9f the shared segment-spawn countdown.
 *
 * Grounding: [code] — control flow read from behaviour; the exact combined meaning of $94/$87 is
 * behaviour-derived, not MAME-grounded. Live-out: $9c+x and $87 on the idle path, else $9f (and a
 * segment-spawn seed via `seedSegmentSpawnState`).
 */
export function tickSpawnCadence(m) {
  // Which per-slot "channel" this pass services — the same selector the actor spawner uses.
  const x = m.mem8[loc_88];

  // Idle-slot gate: the slot's own byte $94+x OR-ed with the shared arm byte $87. When both are
  // clear the slot is idle and ready to advance, so step its phase counter $9c+x by one and re-arm
  // the gate by stamping 0x40 into $87. That is the whole job on an idle tick — return.
  if ((m.mem8[(loc_94 + x) & 0xff] | m.mem8[loc_87]) === 0) {
    m.mem8[(loc_9c + x) & 0xff] = m.mem8[(loc_9c + x) & 0xff] + 1;
    m.mem8[loc_87] = 0x40;
    return;
  }

  // Not idle: range-test the folded timing key $41 ^ $ef — $41 being the value `serviceTimerBank`
  // refreshes when the master timer re-arms, XORed with the orientation mask. Below 0x9c the beat
  // has not arrived yet, so bail without touching the countdown.
  if ((m.mem8[loc_41] ^ m.mem8[loc_ef]) < 0x9c) return;

  // Past the threshold: tick the shared segment-spawn countdown $9f, and each time it reaches zero
  // hand off to seed the next segment spawn. This is the point where the timer bank, the arming
  // handshake and this cadence stepper all converge to release one segment.
  m.mem8[loc_9f] = m.mem8[loc_9f] - 1;
  if (m.mem8[loc_9f] === 0) seedSegmentSpawnState(m);
}
