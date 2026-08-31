// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_572b } from "./loc_572b.js";

/**
 * seedFirstFreeSpriteBlockInRun — find the first free record in a run and bring one enemy to life.
 *
 * ROM 0x588e-0x589a. Grounding: [seen].
 *
 * WHAT IT IS
 *   The launch loop of the enemy-attack subsystem. Enemies live in a small array of fixed-size
 *   actor records; when the spawn cadence elapses the machine wants exactly one fresh enemy
 *   seated into the first empty slot it can find. This routine is the driver of that search: it
 *   receives the base of a run of records, a count of how many to consider, and a column
 *   selector, then walks the run one record at a time offering each to the per-slot spawn body
 *   (loc_572b) until one of them takes.
 *
 * ROLE IN THE MACHINE
 *   The spawn gate reaches this point only after it has decided a new enemy is due (the live
 *   census sits below both the stage threshold and the roster cap). At that moment IX already
 *   points at the base of the enemy-actor record run, B holds how many records to sweep, and C
 *   carries the spawn column. This routine turns that decision into an actual actor: it hands
 *   each record in turn to loc_572b, which either declines (the record is already occupied) or
 *   claims it — stamping the slot's active flag, state and animation, reloading the spawn-cadence
 *   countdown, and bumping the live-enemy census. Because the run is walked in address order, the
 *   enemy is always born in the lowest-numbered free slot.
 *
 * LIVE-OUT: memory only — nothing reads a register back. Whatever loc_572b seats into the chosen
 *   record (its active flag, kind and animation), plus the reloaded spawn-cadence countdown and
 *   the incremented live-enemy census, are all left in work RAM for the next frame to observe.
 */

const BLOCK_STRIDE = 0x18; // one fixed-size actor record; stepping IX by this walks to the next slot
const INIT_SEED = 0x04; // the "kind" field handed to loc_572b, stamped into the record it claims

export function seedFirstFreeSpriteBlockInRun(m, base = m.regs.ix, count = m.regs.b, col = m.regs.c) {
  // Set up the sweep over the record run. `cursor` starts at the run base (IX) and marches slot by
  // slot; `remaining` starts at the record count (B) and counts down, so an all-occupied run is
  // bounded — the loop gives up rather than running off the end of the array.
  let cursor = base;
  let remaining = count;
  do {
    // Offer this record to the per-slot spawn body (loc_572b, ROM 0x572b), carrying the spawn
    // column in C and the kind seed in E. It reports back which of two things happened: a record
    // that is already live is left untouched and reports false, so the search must continue; but
    // the moment it fills a free record it reports true — one enemy has been born, so abandon the
    // rest of the run. This is the one-enemy-per-cadence-tick contract.
    if (loc_572b(m, cursor, col, INIT_SEED)) return; // seeded a fresh block -> stop the run
    // The record here was occupied. Advance to the next record in the run (add ix,de with de=0x18),
    // wrapping at 16 bits exactly as the address register would.
    cursor = u16(cursor + BLOCK_STRIDE);
    // Count this record off (the Z80 djnz over B); the 8-bit wrap makes an entry count of 0 behave
    // as a full 256-record pass, matching the hardware's decrement-and-branch.
    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0); // keep scanning until a free slot is claimed or the whole run is spent
}
