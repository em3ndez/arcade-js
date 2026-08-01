// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2d83 — aim the string renderer at the fixed source string at 0x39CC and emit its
 * first character.  ROM 0x2D83.
 *
 * Reached from loc_2d15 (a conditional branch) to (re)start the per-character string
 * renderer on the source string that begins at 0x39CC. It points the renderer's cursor
 * at that string — both the RENDER_STR_PTR cell and the cursor register the per-character
 * body reads — then tails into loc_2d54 to emit the first character's 4-byte record.
 *
 * The live hand-off is the cursor REGISTER: loc_2d54 reads the string cursor from it. The
 * RENDER_STR_PTR cell this routine also stamps is only a starting value — on this string
 * the first character (0xBB) is never the 0x7F terminator, so loc_2d54 always takes the
 * emit path and immediately re-advances RENDER_STR_PTR past the character (to 0x39CE),
 * overwriting the stamp before anything reads it. The stamp is kept because the oracle
 * writes it; it carries no state forward on the reachable path.
 *
 * REGISTER-ABI MARSHALLING (dissolves once loc_2d54 takes an honest cursor param):
 * loc_2d54 still reads its string cursor from the cursor register, so this routine loads
 * exactly what the oracle's tail-jump site leaves there — the string start 0x39CC.
 *
 * NAME: kept loc_ — the cursor setup and hand-off are pinned to the oracle, but which
 * on-screen string 0x39CC is (and what loc_2d15's branch selects) is not corroborated to
 * the routine-name bar. Promote once grounded.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2d83.test.js.
 * GATE:     the real captured 0x2D83 dispatch(es) from an attract run, plus crafted
 *           entries that place the renderer's object/destination pointers in writable RAM
 *           so the emitted record is observable. The RAM diff uses the standard
 *           memory-equivalence contract (excludes the dead STACK_SCRATCH); on this
 *           routine's only reachable path (always emit, never terminator) neither side
 *           writes that region, so the exclusion masks nothing here. Teeth: a twin that
 *           hands loc_2d54 the wrong string cursor and a twin that drops the render.
 * LIVE-OUT: memory-only. The oracle's residual registers/flags and the single net `ret`
 *           (loc_2d54 returns on this routine's behalf via the tail jump) are dead ABI —
 *           the caller consumes none of them; the net return is modelled in the gate.
 * NAMES:    RENDER_STR_PTR (0x62A8) from ram.js. STRING_START (0x39CC) is a ROM address —
 *           the source-string data — kept as a hex const (no ram.js name; it is ROM).
 */

import { RENDER_STR_PTR } from "./ram.js";
import { loc_2d54 } from "./loc_2d54.js"; // ROM 0x2D54 — the per-character render body

const STRING_START = 0x39cc; // ROM address of the source string this renderer draws

export function loc_2d83(m) {
  const { regs, mem } = m;

  // Aim the renderer at the string: hand the cursor to the per-character body in the
  // cursor register it reads, and stamp the starting cursor cell (which loc_2d54 then
  // overwrites as it advances).
  regs.hl = STRING_START;
  mem.write16(RENDER_STR_PTR, STRING_START);

  // Emit the first character's record (and, on this string, advance past it).
  return loc_2d54(m);
}
