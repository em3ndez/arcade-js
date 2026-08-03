// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_215f — hand one object's position to the grader, then fall into the shared object-
 * sprite tail.  ROM 0x215F.
 *
 * The object walk routes a slot here when the low three bits of the field that becomes the
 * search key are 3. This routine computes nothing of its own and touches no work RAM: it
 * stages the three values loc_216d grades with — that search key, a vertical discriminator
 * five greater than the row field, and one column's worth of table entries as the scan
 * count — runs the grader, and jumps into loc_21ba, the tail every branch of that walk
 * shares.
 *
 * WHAT THE ROLE LINE RESTS ON, AND WHERE IT STOPS. Reading the two live-ins as a position
 * is loc_216d's derivation, not a restatement of this body: the grader compares the key
 * against MARIO_X and the discriminator against MARIO_Y − 4, so the pair is positional
 * rather than a pair of opaque tags. The scan count is the stride of the de-interleaved
 * object-parameter table, corroborated twice outside this routine — loadBoardObjectRecords
 * scatters each record's three fields to +0 / +0x15 / +0x2A, and loc_236e reads the two
 * paired slots at exactly one and two counts past a match — so it is the number of entries
 * per field column, not an arbitrary limit.
 *
 * NOT CLAIMED, because it was not derived here: why the row field is offset by five
 * before it becomes the discriminator, and what kind of object a slot selected by
 * (search key & 7) == 3 holds.
 *
 * Memory-equivalent to the frozen oracle — equivalence-215f.test.js.
 * GATE:     captured + swept + live; ATTRACT only, gameplay is not covered by any case.
 *           EVERY one of the 605 real dispatches in a 4000-frame attract run is replayed,
 *           not a sample, and the test asserts the set spans all three of the lookup's
 *           outcomes and both velocity signs. Attract shows only 27 distinct search keys
 *           and 58 row fields, so both live-ins are additionally swept over all 256 values
 *           on a real captured base — which is also the only way the 251..255 rows, whose
 *           +5 wraps, get exercised. Both sides run the shared tail and everything
 *           downstream of it, so a register left wrong surfaces as a RAM diff instead of
 *           being invisible; the return value is asserted too, and the RAM diff excludes
 *           the dead STACK_SCRATCH the oracle's call/ret churn writes. Then the rewrite is
 *           wired live at 0x215F for a 2500-frame attract run, every frame byte-identical
 *           to the all-oracle baseline with the guest SP unchanged. Teeth: a twin that
 *           drops the +5, a twin that swaps the two live-ins, and a twin that scans 10
 *           entries instead of 21. NOT PINNED BY THE GATE, measured: a scan count LARGER
 *           than 21 is indistinguishable on every state these cases reach — 21 rests on
 *           the table's de-interleave stride, not on the tests.
 * LIVE-OUT: memory-only, plus the value the shared tail returns. The only machine state
 *           this rewrite leaves different from the oracle is the shadow register bank
 *           (measured over all 605 captures: B', C', E', H', L'), because the tail's
 *           register-bank swap moves this routine's residue there. Scrambling exactly
 *           those five after every oracle dispatch leaves a 2500-frame attract run
 *           byte-identical. DERIVED to match: the whole ROM swaps banks in exactly six
 *           routines — the shared tail plus the walk's five branch heads — and of those
 *           five, one reads none of the residue, two reload the velocity and then the
 *           record fields, and two go straight into the position update at ROM 0x239C,
 *           which rewrites all four of B, C, H and L. E is re-derived by every routine
 *           that reads it.
 * NAMES:    none — this routine reads and writes no work RAM. loc_216d is in ROUTINES, so
 *           it is direct-called; 0x21BA has no idiomatic twin in ROUTINES yet, so the tail is still
 *           m.call.
 */

import { loc_216d } from "./loc_216d.js";

// Entries per field column in the de-interleaved object-parameter table: the grader's
// lookup scans exactly one column, and the paired slots it returns sit one and two
// columns further on.
const PARAM_TABLE_COLUMN = 21;

// How much higher than the record's row field the vertical discriminator sits.
const DISCRIMINATOR_OFFSET = 5;

export function loc_215f(
  m,
  searchKey = m.regs.h, /* oracle-boundary default: sole caller 0x1ff6 still frozen */
  rowField = m.regs.l, /* oracle-boundary default: sole caller 0x1ff6 still frozen */
) {
  const { regs } = m;

  // loc_216d and its own lookup callee take their inputs in registers — that callee is a
  // genuine oracle boundary, so the ABI stays register-shaped until the walk above is
  // decompiled and the whole cluster's signatures are promoted together.
  regs.d = rowField + DISCRIMINATOR_OFFSET;
  regs.a = searchKey;
  regs.bc = PARAM_TABLE_COLUMN;
  loc_216d(m);

  return m.call(0x21ba);
}
