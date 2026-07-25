// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyBytePairsStrided — scatter B consecutive source byte-pairs into strided records.  ROM 0x11ec.
 *
 * A memory-init primitive. It walks a CONTIGUOUS source (HL) and lays its bytes,
 * two per pass, into a destination array (DE) whose records are spaced apart:
 *
 *   - Each pass reads two adjacent source bytes (HL, then HL+1) and stores them at
 *     destination offsets +0 and +2 of the current record. Offset +1 is NEVER
 *     written — the routine does two `inc e` between the stores, skipping it.
 *   - HL advances CUMULATIVELY (+2 per pass), so over B passes it consumes 2*B
 *     consecutive source bytes. HL is a full 16-bit `inc`, so the source MAY cross a
 *     ROM/RAM page.
 *   - The destination advances by C+2 per pass (the two `inc e` = +2, then `add a,c`
 *     = +C). That advance is 8-bit on E alone — D (the page) is never touched — so
 *     the destination low byte WRAPS within its 256-byte page and cannot carry out.
 *
 * THIS IS sub_122a's TWIN WITH THE SOURCE SEMANTICS INVERTED, and the distinction is
 * load-bearing: sub_122a brackets its inner loop in `push hl`/`pop hl`, so it re-reads
 * the SAME source pair every pass (a broadcast); this routine has no push/pop, so HL
 * walks forward (a scatter). Near-identical bytes, opposite meaning — they must NOT be
 * folded into one C-keyed helper. (Frozen-oracle header, sub_11ec.js.)
 *
 * Inputs (all live-in registers): HL = source pointer, DE = destination (D = page,
 * E = low byte), B = pass count, C = the per-pass low-byte advance beyond the fixed +2.
 * B == 0 means 256 passes (`djnz` decrements then tests). A LEAF: calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-11ec.test.js.
 * GATE:     crafted-entry — the one real attract dispatch (B=2, C=0x0e, via sub_11a6)
 *           plus crafted entries for the other two call-site shapes (0x10C0: B=6,
 *           C=0x0e; 0x1157: B=2, C=0x1e), the 8-bit E-wrap edge, the 16-bit HL
 *           page-cross, the B=0 256-pass edge, and a distinct-source footprint pin.
 *           Not exhaustive (input is memory contents × HL × DE × B × C). Reached from
 *           3 sites; attract hits only sub_11a6's.
 * LIVE-OUT: memory-only — the 2*B destination bytes. All three callers reload HL, DE
 *           and BC (via `ld hl,nn`/`ld de,nn`/`ld bc,nn`) immediately after the call
 *           and read no flag, so A/B/C/HL/E and the final `add a,c` carry are all dead
 *           ABI. The oracle's terminal `ret` (SP += 2, PC vector) is the dropped
 *           control-flow model — the JS call stack replaces it — so pc/SP carry no
 *           residue.
 * NAMES:    none from ram.js — HL/DE/B/C and the target bytes are all caller-supplied;
 *           the routine references no fixed game RAM address.
 */
export function copyBytePairsStrided(m) {
  const { regs, mem } = m;

  let src = regs.hl; // source pointer; full 16-bit inc, so it may cross a page
  const page = regs.de & 0xff00; // destination page (D) — never changes
  let lo = regs.de & 0xff; // destination low byte (E) — 8-bit, wraps within the page
  const stride = regs.c; // C: extra low-byte advance beyond the fixed +2 (net = C+2)
  // `djnz` decrements THEN tests, so B == 0 means 256 passes, not zero.
  const passes = regs.b === 0 ? 256 : regs.b;

  for (let i = 0; i < passes; i++) {
    // First source byte -> record offset +0.
    mem.write8(page | lo, mem.read8(src));
    src = (src + 1) & 0xffff;

    // Two `inc e`: skip offset +1, so the next store lands at +2. 8-bit — no carry into D.
    lo = (lo + 2) & 0xff;

    // Second source byte -> record offset +2.
    mem.write8(page | lo, mem.read8(src));
    src = (src + 1) & 0xffff;

    // `ld a,e / add a,c / ld e,a`: advance the low byte by C, 8-bit. Net record stride
    // is therefore C+2; D is untouched, so the destination stays within its page.
    lo = (lo + stride) & 0xff;
  }
}
