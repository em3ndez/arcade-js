// SPDX-License-Identifier: GPL-3.0-only
/**
 * replicateGroupStrided — copy ONE 4-byte source group into B strided destination
 * slots. ROM 0x122A.
 *
 * A struct-field initialiser, NOT a blitter. It takes a 4-byte template at HL and
 * stamps that SAME four bytes into B destination records, each record C+4 bytes
 * after the previous — so it seeds a run of records with a common header/value.
 * The source is re-read from HL every pass (never advanced): the oracle brackets
 * the inner copy in `push hl`/`pop hl`, discarding the four `inc hl`, so pass N
 * copies the identical group as pass 0. C and HL both survive the call (the oracle
 * saves HL actively and restores C via `pop bc`), which is what lets its callers
 * issue a second `call 0x122a` after reloading only DE and B (loc_0fd7 @0x1017),
 * and lets three routines pass C on to a later `call 0x11d3` without reloading it.
 *
 * Destination addressing is 8-bit in E, confined to page D: the oracle steps the
 * pointer with `inc e` (not `inc de`) and advances the stride via A (`ld a,e /
 * add a,c / ld e,a`), so D never changes and E WRAPS within D's 256-byte page. A
 * 16-bit increment would silently turn a wrap into a page crossing — the routine's
 * documented hazard.
 *
 * TWIN, do not merge: sub_11ec (ROM 0x11EC) is the source-inverted twin — no
 * push/pop, so ITS source advances cumulatively (walks 2*B consecutive bytes) at
 * stride C+2. The two must not share a helper.
 *
 * Reached from 11 board/cutscene setup sites (0fec 100f 1017 1028 1037 1090 10cc
 * 113a 1163 118f 11b8); every destination lands in work/sprite RAM.
 *
 * Memory-equivalent to the frozen oracle — equivalence-122a.test.js.
 * GATE:     crafted-entry — 4 real captured attract dispatches (B∈{2,5,8},
 *           C∈{0x0c,0x1c}) + crafted entries for the arms attract does not exercise
 *           (the B==0 → 256-pass edge, an E page-wrap, a C==0 contiguous stride).
 *           Not exhaustive: the input is source bytes × destination bytes × B × C ×
 *           DE. Teeth: a cumulative-source twin (caught on every real B>1 dispatch)
 *           and a 16-bit-increment page-cross twin (caught by the page-wrap craft).
 * LIVE-OUT: memory (the B copies of the 4-byte group) + regs E/A/B and the
 *           preserved C/D/H/L. E is advanced by B*(C+4) mod 256 within page D; A
 *           exits equal to the final E (`ld e,a` after the last `add a,c`); B counts
 *           down to 0. C, D, H, L are untouched here and the oracle preserves them,
 *           so they are held byte-faithful (C and HL are read by downstream callers;
 *           see above). FLAGS are dropped as dead: the carry out of the final
 *           `add a,c` escapes through the `ret`, but every one of the 11 call sites
 *           overwrites HL/IX or returns immediately — none branches on it.
 * NAMES:    none — HL/DE/B/C and the target bytes are all caller-supplied; the
 *           routine references no fixed game RAM address.
 */
export function replicateGroupStrided(m) {
  const { regs, mem } = m;

  const src = regs.hl; // 4-byte source group; re-read every pass (never advances)
  const stride = regs.c; // C — extra spacing after each 4-byte copy (record size = C+4)
  const page = regs.d << 8; // D selects the destination page and is never modified
  // `djnz` decrements THEN tests, so B == 0 means 256 passes, not zero. No known
  // call site does it, but the oracle's do-while would, so mirror it faithfully.
  const groups = regs.b === 0 ? 256 : regs.b;

  let e = regs.e; // the in-page destination offset; 8-bit, wraps within page D
  for (let g = 0; g < groups; g++) {
    for (let i = 0; i < 4; i++) {
      mem.write8(page | e, mem.read8((src + i) & 0xffff)); // ld a,(hl) / ld (de),a
      e = (e + 1) & 0xff; // inc e — 8-bit, stays inside page D
    }
    e = (e + stride) & 0xff; // ld a,e / add a,c / ld e,a — advance E past the gap
  }

  // Live-out registers, matching the oracle. C/D/H/L are left untouched (preserved).
  regs.e = e;
  regs.a = e; // A exits equal to the final E
  regs.b = 0; // both djnz loops ran to zero
}
