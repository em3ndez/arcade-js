// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c49 — one entry of the bonus-event slot-claim cluster (0x2C41): stash mode byte 1,
 * then hand off to the shared slot-claim entry with the caller's bonus value.  ROM 0x2C49.
 *
 * This is the cluster's "mode byte 1" entry. It sets the mode byte to 1 and tails into the shared
 * slot-claim entry (loc_2c4b), which records the mode byte into BARREL_CLAIM_MODE and runs the
 * shared body with that byte bumped by one — so this entry always leaves BARREL_CLAIM_MODE = 1 and
 * 0x638F = 2. The mode byte is a hard constant here (unlike its sibling loc_2c4b, which takes it in
 * a register), so nothing the caller holds can change the two stored values.
 *
 * The shared path then runs the periodic-event gate against the caller's bonus value: only when the
 * next-event mark (BONUS_EVENT_MARK) equals it does it step the mark down by 8 and claim the first
 * free object slot, raising bit 7 on that same BARREL_CLAIM_MODE byte (so a claimed slot leaves it
 * at 0x81 — mode value 1 with the kind-select bit set); on a miss it does just the mode writes.
 *
 * GROUNDED — observed live in MAME 0.288 on the real dkong ROM (understanding pass 12,
 * scratchpad/pass12-grounding.md): bit 7 of BARREL_CLAIM_MODE is the 25m BARREL-KIND select. One
 * frame after a bit-7-set claim, stampReleasedBarrelKind stamps the freshly-released OBJ_ARRAY_67 barrel record
 * with sprite code/attr/mode 0x19 / 0x0C / 0x01 instead of the default 0x15 / 0x0B / 0x00 — 46/46
 * agreement over every captured dispatch, no exceptions (38 clear, 8 set), all of them ordinary
 * board-1 25m gameplay (ZERO in the opening Kong-climb cutscene). The bit-7-SET (attr 0x0C) kind
 * DROPS with its X pinned at 59; the bit-7-CLEAR (attr 0x0B) kind ROLLS along the girders.
 * Grounding deliberately did NOT establish which NAMED Donkey Kong object either kind is.
 *
 * The bonus value is the caller's live-in: this entry is still reached from the translated cluster
 * (entry_2c7b, via `jp z,0x2c49`), which passes it in a register, so it is read at that oracle
 * boundary and forwarded as an honest argument.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c49.test.js.
 * GATE:     exhaustive over the bonus value with the gate held closed (isolating the three constant
 *           writes — BARREL_CLAIM_MODE = 1, 0x638F = 2, 0x6392 = 1 — and proving they do not depend
 *           on the bonus), plus crafted gate-open entries over every first-free-slot position (records
 *           0..4) and the all-occupied case — proving the mark steps down by 8 and the mode byte
 *           rises to 0x81 only on a claim; + real captured 0x2C49 dispatches from an attract run.
 *           Teeth: a wrong mode byte, a mode byte forwarded from the caller instead of the constant 1,
 *           and a mis-forwarded bonus.
 * LIVE-OUT: memory-only — BARREL_CLAIM_MODE plus everything the shared entry writes (0x638F, 0x6392,
 *           BONUS_EVENT_MARK). The oracle threads residual registers/flags out and its terminal pops
 *           are dead; nothing reads a register the routine leaves behind. Nothing writes the stack,
 *           so the gate needs no STACK_SCRATCH exclusion.
 * NAMES:    loc_2c4b (ROM 0x2C4B) direct-called with honest args. BARREL_CLAIM_MODE (0x6382) is
 *           named in ram.js and imported there — this entry writes it only through loc_2c4b, so it
 *           needs no import of its own; the other cells the shared path touches (0x638F, 0x6392,
 *           BONUS_EVENT_MARK, OBJ_ARRAY_64) carry their names inside loc_2c4b / loc_2c4f.
 */

import { loc_2c4b } from "./loc_2c4b.js"; // ROM 0x2C4B — the shared slot-claim entry

const MODE_BYTE = 0x01; // the mode byte this entry stashes into BARREL_CLAIM_MODE via loc_2c4b

/**
 * @param {object} m  the machine (reads the bonus live-in from registers, writes memory).
 * @returns {void}
 */
export function loc_2c49(m) {
  const { regs } = m;

  // Mode byte 1, and the caller's bonus value (the register live-in from the translated cluster).
  loc_2c4b(m, MODE_BYTE, regs.c);
}
