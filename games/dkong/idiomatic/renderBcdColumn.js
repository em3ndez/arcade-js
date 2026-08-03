// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderBcdColumn — draw a packed 3-byte BCD value as six digits up a video column.  ROM 0x057c.
 *
 * A caller-supplied entry into the packed-BCD renderer. The caller hands it a
 * source pointer in DE (the three packed bytes, two BCD/hex digits each) and a
 * destination VRAM cell in IX, and this routine paints the six digits climbing a
 * column, one tilemap row up per digit. It is the same ROM code as draw_0578
 * (0x0578) entered one instruction later, so it skips draw_0578's hard-wired
 * `ld ix,0x7641` and uses the caller's IX instead — which is why the score column
 * (draw_0578, fixed cell) and the on-board bonus-item value (sub_1486, cell chosen
 * from the item's sprite record) share one renderer.
 *
 * The prologue fixes the DK-standard parameters, then falls into the shared
 * expansion loop expandBcdDigits (0x0583):
 *
 *   - `ex de,hl` moves the source pointer into HL (it arrives in DE, live-in). The
 *     old HL is parked in DE and then immediately overwritten, so it is discarded.
 *   - `ld de,0xffe0` sets the per-digit stride to -0x20 — back one tilemap row, so
 *     successive digits climb the column.
 *   - `ld bc,0x0304` sets B = 3 source bytes (→ 6 digits); C = 4 is a dead marker
 *     the loop never reads.
 *   - expandBcdDigits then emits, per source byte, the HIGH nibble then the LOW,
 *     walking the source pointer HL backwards (so descending source bytes render
 *     into ascending display cells) and stepping IX by DE through
 *     storeDigitAndAdvance (0x0593).
 *
 * Called by sub_1486 (the on-board bonus-item value display) via `call 0x057c`;
 * draw_0578 and draw_056b reach the same code by falling/branching into 0x057c.
 *
 * Live-in: DE = source pointer, IX = destination VRAM cell. Calls only
 * expandBcdDigits (which owns the loop and the per-digit store).
 *
 * Memory-equivalent to the frozen oracle — equivalence-057c.test.js.
 * GATE:     crafted-entry, grounded in real captured RAM. Attract never dispatches
 *           0x057c itself — its one direct caller, sub_1486's bonus-item value
 *           display, only runs when a prize is collected, which the 25m attract demo
 *           never does. So the gate seeds entries from REAL captured machine states
 *           at the shared loop 0x0583 (reachable in attract: the score/high-score/
 *           credit renders, IX = 0x7641/0x7781/0x74bf, real VRAM), reconstructs the
 *           sub_057c entry that produced each (DE = the real source pointer, IX = the
 *           real dest cell), and adds the exact sub_1486 params (DE = 0x01bf) plus the
 *           IX-advance and HL-dec 16-bit-wrap edges and differing-nibble source bytes.
 *           Each compared oracle-vs-candidate over RAM (minus STACK_SCRATCH) + pc + SP
 *           + declared live-out. Teeth: a twin with the wrong stride magnitude
 *           (-0x10 instead of -0x20) lands digits 2..6 at the wrong cells and is
 *           caught on every entry (via RAM and the final IX).
 * LIVE-OUT: memory-only — the six digit cells written into VRAM through 0x0593.
 *           The caller sub_1486 reloads A (`ld a,0x10`) the instant this returns and
 *           reads none of the output registers, so HL (source-3), DE (0xffe0),
 *           B (0)/C (4), IX (start-0xC0) and A (last masked nibble) are all dead to
 *           it; they are reproduced identically to the oracle and compared for free.
 *           FLAGS are dead too (the caller's `ld a,0x10` sets none that survive).
 * NAMES:    none from ram.js — the source pointer, destination cell and stride are
 *           all caller-supplied; this routine references no fixed game RAM address.
 *           The literals are ROM constants: 0xffe0 = the -0x20 row stride, 0x0304 =
 *           B (3 bytes) : C (4, dead).
 */
import { expandBcdDigits } from "./expandBcdDigits.js"; // ROM 0x0583

const ROW_STEP = 0xffe0; //  ld de,0xffe0 — -0x20: back one tilemap row per digit (draws up a column)
const BYTE_COUNT = 0x0304; // ld bc,0x0304 — B := 3 source bytes (6 digits); C := 4 (dead marker)

export function renderBcdColumn(m) {
  const { regs } = m;

  regs.exDeHl();       // ex de,hl — HL := source pointer (was DE, live-in); old HL parked in DE...
  regs.de = ROW_STEP;  // ld de,0xffe0 — ...and immediately overwritten with the -0x20 row stride
  regs.bc = BYTE_COUNT; // ld bc,0x0304 — B := 3 source bytes, C := 4 (dead)

  expandBcdDigits(m);  // fall into the shared BCD-expansion loop (0x0583): 6 digits up the column
}
