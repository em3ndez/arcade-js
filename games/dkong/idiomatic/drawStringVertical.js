// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawStringVertical — draw a doubly-indirected string down a tilemap column.  ROM 0x05E9.
 *
 * Task-table entry 3 of the main-loop dispatcher (dispatchTask, ROM 0x02E3): a
 * shared "draw a canned string" service. The payload in A selects WHICH string and
 * whether to draw or erase it, through two levels of indirection:
 *
 *   - `add a,a` doubles the payload into a WORD index (drop bit 8 with `and 0x7f`),
 *     which indexes the pointer table at 0x364B. That table entry is a DESCRIPTOR
 *     address.
 *   - The descriptor's first word is the VRAM destination cell; the bytes after it
 *     are the characters, terminated by 0x3F.
 *
 * Characters are stored one per cell stepping the destination back one whole tilemap
 * row (-0x20, the map is 0x20 cells wide) each time — so the string is laid out
 * VERTICALLY, which is what you want on a screen the hardware rotates 270°. (Its
 * siblings sub_0616 / loc_08d5 call it to draw the credit/prompt strings; the power-on
 * task queue draws string 4 at boot.)
 *
 * BLANK MODE. Bit 7 of the payload — the carry `add a,a` produces — is a per-string
 * ERASE flag. When set, every cell is written with the character and then immediately
 * overwritten with the blank tile 0x10, so the net effect is to clear the string's
 * footprint. When clear, the character stands. The flag is constant for the whole run
 * (the oracle carries it across the loop via a `push af`/`pop af` pair; here it is just
 * a boolean). Note bit 7 does NOT change which string is drawn: it survives `add a,a`
 * only into the carry, and `and 0x7f` drops it from the index.
 *
 * The oracle's 0x3F-terminator exit is `jp z,0x0026` — a jump into sub_0020's
 * `pop hl / ret` tail. That is a NORMAL return: the `pop hl` only discards this
 * routine's own outstanding prologue `push af` (balancing the stack) and `ret` goes to
 * the immediate caller, so here it is an ordinary JS `return`. No callees (the tail is
 * inlined), so nothing is imported.
 *
 * Memory-equivalent to the frozen oracle — equivalence-05e9.test.js.
 * GATE:     crafted-entry. Real captured dispatches (fresh clone each, oracle run in
 *           full) — attract reaches it via the task table (payload 4) and sub_0616
 *           (string 5) — replayed oracle-vs-idiomatic on game-visible RAM; plus a
 *           crafted BLANK-MODE arm (payload bit 7, which attract never sets) on real
 *           strings; teeth = a corrupt-first-store twin caught by the captured sweep.
 * LIVE-OUT: memory-only — the VRAM tilemap cells written (character, or blank tile
 *           0x10 in erase mode). No live registers/flags: every caller overwrites the
 *           residual A/HL/DE/F before reading (sub_0616 reloads HL immediately; the
 *           task dispatcher returns to the main loop, which reloads). SP/pc are the
 *           dropped stack model — the oracle's `pop hl / ret` moves them; this JS
 *           return leaves them at entry (asserted, not compared to the oracle).
 * NAMES:    none from names.js — every operand is a ROM literal (pointer table 0x364B,
 *           row step -0x20, terminator 0x3F, blank tile 0x10), not work-RAM.
 */

// -- ROM literals (constants baked into the code, NOT work-RAM, so none are in names.js) --
const STRING_PTR_TABLE = 0x364b; // base of the pointer table, indexed by payload*2
const VRAM_ROW_STEP = 0xffe0; //    -0x20: step back one tilemap row per char (vertical draw)
const STRING_TERMINATOR = 0x3f; //  sentinel byte ending the character run
const BLANK_TILE = 0x10; //         tile written in erase mode (payload bit 7 set)
const TABLE_INDEX_MASK = 0x7f; //   `and 0x7f` after `add a,a`: keep the doubled index, drop bit 8

export function drawStringVertical(m) {
  const { regs, mem } = m;

  const payload = regs.a & 0xff;
  const blankMode = (payload & 0x80) !== 0; // carry out of `add a,a` = payload bit 7
  const index = ((payload << 1) & 0xff) & TABLE_INDEX_MASK; // doubled index into the table

  // Two indirections: payload -> pointer-table entry (descriptor) -> descriptor's
  // first word is the VRAM destination, the bytes after it are the characters.
  const descriptor = mem.read16((STRING_PTR_TABLE + index) & 0xffff);
  let dst = mem.read16(descriptor); //         VRAM destination cell (write pointer)
  let src = (descriptor + 2) & 0xffff; //      first character byte

  for (;;) {
    const ch = mem.read8(src);
    if (ch === STRING_TERMINATOR) return; // 0x3F ends the run — normal return
    mem.write8(dst, ch); //                 store the character
    if (blankMode) mem.write8(dst, BLANK_TILE); // erase mode: overwrite it with the blank tile
    src = (src + 1) & 0xffff; //            next character
    dst = (dst + VRAM_ROW_STEP) & 0xffff; //dest up one tilemap row (-0x20)
  }
}
