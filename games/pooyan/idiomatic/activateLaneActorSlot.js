// SPDX-License-Identifier: GPL-3.0-only
import { seedSpawnColumnAndRunBody } from "./seedSpawnColumnAndRunBody.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { ACTIVE_LANE_COUNT, ROUND_COUNTER, SCRIPT_FLAG_TABLE, SCRIPT_VALUE_BYTE } from "./names.js";
/**
 * activateLaneActorSlot — claim one lane-actor record if it is free, and say so.
 * ROM 0x5374 (0x5374-0x539f). Grounding: [seen].
 *
 * WHAT IT IS
 * The per-slot half of the scripted lane-spawn machine. Enemies that march in "lanes" are held in a
 * pool of six stride-0x18 records at the enemy-actor table (0x8ae0); IX points at one of them. The
 * lane script driver walks that pool record by record and hands each one to this routine, asking a
 * single question: is this slot free, and if so, bring one enemy to life in it. Exactly one actor is
 * born per pass — the first free slot wins and the walk stops there.
 *
 * ROLE IN THE MACHINE
 * The record's head word (the two bytes at ix+0 / ix+1) is its occupancy marker: non-zero means a
 * live actor already owns the slot. When that is the case there is nothing to do here and the caller
 * should move on to the next record. When the slot is empty this routine takes ownership of it —
 * counting the new lane actor, stamping the record live, choosing the enemy's kind for this round,
 * running the shared spawn body that fills in the rest of the record, and folding a per-script flag
 * into the record's variant byte — after which the caller's sweep is finished and must stop.
 *
 * The return value carries that keep-going / stop decision back to the caller: true when the slot was
 * already live (keep sweeping the remaining records), false when this call activated a slot (abort the
 * sweep — the one-spawn-per-pass budget is spent). In the machine the "stop" case is a skip-return:
 * the routine drops one stack level and returns above its immediate caller, unwinding the walk in one
 * step.
 *
 * LIVE-OUT: work RAM — the lane tally at ACTIVE_LANE_COUNT (0x8d79), the record's head byte, its
 * kind/state written by the spawn body, and its variant flags at ix+0x07 — plus the boolean
 * caller-skip signal. Nothing is left in a CPU register.
 */
export function activateLaneActorSlot(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // Occupancy test on the record head word (ix+0 low, ix+1 high, ROM 0x5374-0x537a). If either byte
  // is set the slot already holds a live actor, so leave it untouched and tell the caller to keep
  // scanning the rest of the pool.
  if ((mem8[ix + 0x00] | mem8[ix + 0x01]) !== 0) return true; // slot live (ret nz)

  // Slot is free — claim it. Bump the running count of activated lane actors at ACTIVE_LANE_COUNT
  // (0x8d79); this counter ramps up as lane actors are born and is drained again as their slots init.
  mem8[ACTIVE_LANE_COUNT] = mem8[ACTIVE_LANE_COUNT] + 1;
  // Stamp the record head live so the pool scan (and every other sweep) thereafter treats this slot
  // as occupied.
  mem8[ix + 0x00] = 0x01;
  // Choose the enemy kind for this spawn from the round parity: bit0 of ROUND_COUNTER (0x8907)
  // selects the round's stage-type / facing variant, so an odd round spawns kind 0x1d and an even
  // round kind 0x04. This byte is handed to the spawn body as its kind parameter.
  const kind = (mem8[ROUND_COUNTER] & 0x01) ? 0x1d : 0x04; // E by round parity

  // Run the shared spawn body on this record: it seeds the entry column to 0xff and then initialises
  // the record for the chosen kind, filling in the state, coordinate and animation fields that turn a
  // bare live marker into a fully-formed enemy actor.
  seedSpawnColumnAndRunBody(m, ix, kind); // spawn-one-actor: seed the column then run the spawn body

  // Fold in the per-script variant flags. The matched script-row value at SCRIPT_VALUE_BYTE (0x8d74)
  // indexes the flag table at SCRIPT_FLAG_TABLE (0x53a6) to fetch a flag byte, which is OR'd into the
  // record's variant/flag field at ix+0x07 — leaving any bits already set there intact.
  const [flag] = fetchByteFromTableIndex(m, SCRIPT_FLAG_TABLE, mem8[SCRIPT_VALUE_BYTE]);
  mem8[ix + 0x07] = flag | mem8[ix + 0x07];

  // A slot was activated this pass — the one-spawn budget is spent, so signal the caller to stop the
  // sweep instead of testing any further records.
  return false; // activated -> abort the sweep
}
