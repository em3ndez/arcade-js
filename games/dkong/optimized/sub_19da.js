// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_19da — hand-optimized rewrite of the translated routine at ROM 0x19da,
 * proven equal to its oracle by the equivalence harness.
 *
 * A 3-entry, stride-4 TABLE SEARCH: compare MARIO_X (0x6203) against each of the
 * three bytes at 0x6A0C / 0x6A10 / 0x6A14. On the first X-match it TAIL-JUMPS to
 * entry_19ed (0x19ED) — a `jp z`, NOT a `call`, so there is no stack push and
 * entry_19ed's own `ret` returns to sub_19da's CALLER. On no match it `ret`s.
 * entry_19ed is invoked through `m.call`, the routine registry
 * (games/dkong/routines.js), so it resolves to the oracle or to entry_19ed's own
 * optimized rewrite — never inlined here.
 *
 * The only evidenced address is MARIO_X (imported). The table base 0x6A0C is a
 * FOOTPRINT PLACEHOLDER (ram.js SCRATCH_6a0c) — matching sub_2a22's convention for
 * 0x6600, it is kept hex with a comment rather than dressed in a placeholder name.
 */

import { MARIO_X } from "./ram.js"; // 0x6203

const TABLE_BASE = 0x6a0c; // ram.js SCRATCH_6a0c -- base of the 3-entry, stride-4 X table
const TABLE_COUNT = 0x03; // B: 3 entries to scan
const CONFIRM = 0x19ed; // entry_19ed -- the X-match confirm half (tail-jump target)

/**
 * sub_19da -- scan the 3-entry stride-4 table at 0x6A0C for MARIO_X.  [ROM 0x19DA-0x19EC]
 *
 *   19da  3a 03 62     ld   a,(0x6203)    ; A = MARIO_X
 *   19dd  06 03        ld   b,0x03        ; B = 3 entries
 *   19df  21 0c 6a     ld   hl,0x6a0c     ; HL = table base
 * loc_19e2:
 *   19e2  be           cp   (hl)          ; A - table[i]
 *   19e3  ca ed 19     jp   z,0x19ed      ; X-match -> TAIL-JUMP to entry_19ed (no push)
 *   19e6  2c           inc  l             ; +1 \
 *   19e7  2c           inc  l             ; +2  } stride 4
 *   19e8  2c           inc  l             ; +3 /
 *   19e9  2c           inc  l             ; +4 -- next slot
 *   19ea  10 f6        djnz 0x19e2        ; loop over the 3 entries
 *   19ec  c9           ret                ; no match
 *
 * WHAT IT DOES. Reached ONCE per frame from the in-game NMI update cascade
 * loc_197a @ 0x19B0 (`call 0x19da`). It walks a 3-entry table of X coordinates
 * (stride 4: HL advances by 4 each iteration via four `inc l`) and, on the first
 * entry equal to Mario's X, tail-jumps into entry_19ed to CONFIRM the object hit
 * (Y match + eligibility, then register it into 0x6340/0x6342/0x6343). No X-match
 * on any of the three entries -> plain `ret`.
 *
 * THE MATCH IS A `jp`, NOT A `call`, and honouring that is the one non-trivial
 * thing here: there is NO `m.push16` before `m.call(0x19ED)`. entry_19ed's `ret`
 * therefore pops sub_19da's OWN return address and returns to sub_19da's caller
 * (0x19B0 in loc_197a) -- a tail-jump. Adding a push would leave a stale frame and
 * return one level short.
 *
 * INPUTS  : RAM MARIO_X (0x6203) and the 3 table bytes at 0x6A0C/0x6A10/0x6A14.
 *           The stack carries sub_19da's own return address, which BOTH exits
 *           consume (the tail-jump path via entry_19ed's ret, the no-match path
 *           via our own ret).
 * OUTPUTS : No work RAM of its own (entry_19ed writes 0x6340/0x6342/0x6343 on a
 *           confirmed hit; that is entry_19ed's, reproduced by calling the same
 *           routine with identical inputs). Registers A (=MARIO_X on the search;
 *           entry_19ed then reloads it), B (entries remaining: on a match B = the
 *           count when it hit; on no-match B = 0), HL (matched slot ptr on a match,
 *           else 0x6A18 past the table), F, SP, PC.
 *
 * FLAGS -- kept verbatim, because both flag-producers are OBSERVABLE:
 *   - `cp (hl)` sets the Z the loop branches on, and is the last flag-writer before
 *     the tail-jump, so the F entering entry_19ed matches the oracle's.
 *   - the four `inc l` are the LAST flag-writers on the no-match path (djnz sets no
 *     flags, ret sets none), so the routine's exit F on that path is the 4th inc l's
 *     S/Z/H/PV with carry preserved from the final `cp`. Replacing them with a plain
 *     `l += 4` would drop that F and the unit gate's whole-register compare catches it
 *     (see the behavioural teeth). So the collapse redistributes only the CYCLE
 *     charges; every register/flag op is the identical z80.js helper in oracle order.
 *
 * CYCLES -- COLLAPSED per the decompiler-pipeline doc, one m.step per basic block / per loop iteration,
 * each charging the block's exact oracle total at the block's exit PC:
 *   - prologue (0x19DA-0x19DF): 13+7+10 = 30 t, exit 0x19E2.
 *   - a NO-MATCH iteration that loops: cp 7 + jp-not-taken 10 + inc l x4 16 +
 *     djnz-taken 13 = 46 t, exit 0x19E2 (loop top).
 *   - the LAST no-match iteration: cp 7 + jp-not-taken 10 + inc l x4 16 +
 *     djnz-not-taken 8 = 41 t, exit 0x19EC; then `ret` 10 t.
 *   - a MATCH iteration: cp 7 + jp-z-taken 10 = 17 t, exit 0x19ED; then the
 *     tail-jump `m.call(0x19ED)` (entry_19ed charges its own cycles + ret).
 * Per-arm OWN totals (excluding entry_19ed): no-match = 30 + 46 + 46 + 41 + 10 =
 * 173 t; match on entry k = 30 + 46*(k-1) + 17 t. The collapse only redistributes
 * these within the routine; each arm's TOTAL is byte-identical to the oracle, so the
 * main-loop spin count (0x6019, the PRNG entropy) is unchanged.
 *
 * No hardware-latch write occurs here (the routine only READS RAM), so no bus-cycle
 * boundary is pinned and no write-trace test is needed. The one `m.call` is a
 * boundary and is NOT folded across.
 *
 * REACHABILITY / GATE (MEASURED, not from the oracle prose -- its "-> NotImplemented
 * frontier" note is STALE: entry_19ed is fully translated and reached). sub_19da is
 * dispatched from loc_197a's per-frame NMI update cascade. Probed over 1400 attract
 * frames: 816 dispatches, and it is ATOMIC -- io.nmiMask == 0 at 816/816 entries
 * (entry_0066 clears the NMI mask inside the handler, so the interrupt cannot
 * re-enter), and the NMI's pushed PC NEVER lands in [0x19DA,0x19EC] (0 landings over
 * 1394 NMIs; none anywhere in 0x1900-0x19FF; all in the 0x02BD-0x0372 main-loop band).
 * An atomic routine whose collapse preserves each arm's exact total tears no raster
 * and mistimes no pushed PC, so it passes the BYTE-EXACT (STRICT) whole-machine gate
 * directly -- NOT the convergent gate. The natural attract run exercises ONLY the
 * no-match arm (816/816); the three match arms are covered by synthesised entries
 * with per-arm cycle-total pins. See equivalence-19da.test.js.
 */
export function sub_19da(m) {
  const { regs, mem } = m;

  // Prologue block: ld a,(MARIO_X) 13 + ld b,0x03 7 + ld hl,0x6a0c 10 = 30 t, exit 0x19E2.
  regs.a = mem.read8(MARIO_X);
  regs.b = TABLE_COUNT;
  regs.hl = TABLE_BASE;
  m.step(0x19e2, 30);

  for (;;) {
    // cp (hl) -- flag producer (the loop's Z), kept verbatim.
    regs.cp(mem.read8(regs.hl));
    if (regs.fZ) {
      // X-MATCH: cp 7 + jp z taken 10 = 17 t, exit 0x19ED. Tail-JUMP (no push16):
      // entry_19ed's ret returns to sub_19da's caller.
      m.step(0x19ed, 17);
      return m.call(CONFIRM);
    }

    // No match this slot: advance HL by stride 4 (four `inc l`, each a flag producer --
    // on the no-match exit these are the routine's last flag-writers).
    regs.l = regs.inc8(regs.l);
    regs.l = regs.inc8(regs.l);
    regs.l = regs.inc8(regs.l);
    regs.l = regs.inc8(regs.l);

    regs.djnz(); // dec b; sets no flags
    if (regs.b !== 0) {
      // djnz taken: cp 7 + jp-not 10 + inc16 + djnz-taken 13 = 46 t, back to loop top.
      m.step(0x19e2, 46);
      continue;
    }
    // djnz not taken (all 3 entries scanned, no match): 41 t, exit 0x19EC.
    m.step(0x19ec, 41);
    break;
  }

  m.ret(); // 0x19EC ret -- 10 t, returns to sub_19da's caller.
}
