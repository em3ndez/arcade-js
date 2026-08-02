// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_11a6  (ROM 0x11A6–0x11D2) — 45 bytes, 15 instructions.
 *
 *   11a6  11 83 66     ld   de,0x6683
 *   11a9  01 0e 02     ld   bc,0x020e
 *   11ac  cd ec 11     call 0x11ec
 *   11af  21 08 3e     ld   hl,0x3e08
 *   11b2  11 87 66     ld   de,0x6687
 *   11b5  01 0c 02     ld   bc,0x020c
 *   11b8  cd 2a 12     call 0x122a
 *   11bb  dd 21 80 66  ld   ix,0x6680
 *   11bf  dd 36 00 01  ld   (ix+0x00),0x01
 *   11c3  dd 36 10 01  ld   (ix+0x10),0x01
 *   11c7  21 18 6a     ld   hl,0x6a18
 *   11ca  06 02        ld   b,0x02
 *   11cc  11 10 00     ld   de,0x0010
 *   11cf  cd d3 11     call 0x11d3
 *   11d2  c9           ret
 *
 * Three call sites: 0x1003 (here), 0x1073, 0x1140.
 *
 * SUB_11A6 TAKES AN UNDOCUMENTED HL PARAMETER, and the dependency graph does
 * not record it. HL is not set anywhere in this routine, and the `call 0x11ec`
 * at 0x11AC hands it straight to a routine whose first instruction is
 * `ld a,(hl)`. All three call sites supply it adjacently with `ld hl,nn`:
 *
 *     1000  ld hl,0x3e0c   1003  call 0x11a6
 *     1070  ld hl,0x3e10   1073  call 0x11a6
 *     113d  ld hl,0x3e14   1140  call 0x11a6
 *
 * "On every path" was checked three ways, not assumed: the `ld hl,nn` is the
 * IMMEDIATELY preceding instruction at all three sites; a grep for references
 * to all six addresses finds ZERO, so nothing jumps into them; and none of the
 * three containing blocks holds an internal label or any branch. BOUND: those
 * last two rest on a listing that is reachability-driven at 77% coverage, so
 * they rule out a KNOWN entry, not a computed jump from unreached code.
 *
 * The stride-4 run continues INTO this routine -- 0x11AF loads HL = 0x3E08,
 * four below the lowest caller-supplied value. So 0x3E08 / 0x3E0C / 0x3E10 /
 * 0x3E14 are one stride-4 run. That the four are 4 apart is a fact; what the
 * run contains is NOT established. Nobody has read those bytes.
 *
 * DE CHANGES ROLE ACROSS THE THREE CALLS -- a 16-bit address (0x6683, 0x6687),
 * then a STRIDE (0x0010). HL likewise: an inherited pointer, then a ROM table
 * pointer (0x3E08), then a destination (0x6A18). Naming either register by
 * role names it wrongly for at least one call.
 *
 * C IS NEVER SET BEFORE THE THIRD CALL. It is written 0x0E at 0x11A9 and 0x0C
 * at 0x11B5 and never again -- `ld b,0x02` at 0x11CA writes B only. So C on
 * entry to sub_11d3 is whatever sub_122a left, which is 0x0C: sub_122a
 * restores BC via `pop bc`. sub_11d3 does not read C at all, so nothing here
 * depends on it; recorded because the question is natural and the answer is
 * not visible from this routine alone.
 *
 * B is loaded 0x02 THREE times (0x11A9, 0x11B5, 0x11CA). Both callees clobber
 * B -- each runs its own djnz to zero -- so none of the three is redundant.
 *
 * `ld (ix+d),n` is the IMMEDIATE form (dd 36 d n, 4 bytes, 19 T), a different
 * instruction from `ld (ix+d),a` (dd 77 d, 3 bytes, 19 T).
 *
 * Two (ix+d),0x01 writes land 0x10 apart off IX = 0x6680, i.e. at 0x6680 and
 * 0x6690, and the count and stride then handed to sub_11d3 (B = 0x02,
 * DE = 0x0010) agree with that pair. The three numbers agreeing is a fact;
 * what they describe is not established here.
 */
export function loc_11a6(m) {
  const { regs, mem } = m;

  regs.de = 0x6683; // an ADDRESS here
  m.step(0x11a9, 10); // ld de,0x6683
  regs.bc = 0x020e;
  m.step(0x11ac, 10); // ld bc,0x020e

  // HL is NOT set here -- it is this routine's live-in, passed through.
  m.push16(0x11af);
  m.step(0x11ec, 17); // call 0x11ec
  m.call(0x11ec);

  regs.hl = 0x3e08; // ROM table pointer, 4 below the caller's 0x3E0C
  m.step(0x11b2, 10); // ld hl,0x3e08
  regs.de = 0x6687; // still an ADDRESS
  m.step(0x11b5, 10); // ld de,0x6687
  regs.bc = 0x020c;
  m.step(0x11b8, 10); // ld bc,0x020c

  m.push16(0x11bb);
  m.step(0x122a, 17); // call 0x122a
  m.call(0x122a);

  regs.ix = 0x6680;
  m.step(0x11bf, 14); // ld ix,0x6680
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
  m.step(0x11c3, 19); // ld (ix+0x00),0x01  -> 0x6680
  mem.write8((regs.ix + 0x10) & 0xffff, 0x01);
  m.step(0x11c7, 19); // ld (ix+0x10),0x01  -> 0x6690, stride 0x10

  regs.hl = 0x6a18; // a DESTINATION here
  m.step(0x11ca, 10); // ld hl,0x6a18
  regs.b = 0x02; // B only -- C still holds sub_122a's restored 0x0C
  m.step(0x11cc, 7); // ld b,0x02
  regs.de = 0x0010; // a STRIDE here, unlike 0x11A6 and 0x11B2
  m.step(0x11cf, 10); // ld de,0x0010

  m.push16(0x11d2);
  m.step(0x11d3, 17); // call 0x11d3
  m.call(0x11d3);

  m.ret(); // 11d2
}
