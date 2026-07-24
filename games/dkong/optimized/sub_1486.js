// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_1486 — hand-optimized rewrite of the translated routine at ROM 0x1486,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Every callee (0x0616 the frame-interrupt helper, 0x15fa the
 * item renderer, 0x057c the 6-digit renderer, 0x309f the task enqueuer) is reached
 * through `m.call(0xADDR)`, the routine registry (games/dkong/routines.js), so each
 * resolves to the oracle — or to its own optimized rewrite once one exists — never a
 * copy. Only RAM *names* are imported (from ram.js); code is never imported.
 */

import { SUBSTATE_TIMER, P1_INPUT } from "./ram.js";

// The two-bit palette-bank select latch (ls259.6h at 0x7D86/0x7D87) — a board
// control OUTPUT, not work RAM, so it lives in the board (io.js writePaletteBank),
// not ram.js. sub_1486's init clears both bits to 0 (bank %00). Same two addresses
// loc_0a8a names PALETTE_BANK_LO/HI.
const PALETTE_BANK_LO = 0x7d86;
const PALETTE_BANK_HI = 0x7d87;

/**
 * sub_1486 -- the on-board BONUS-ITEM mover + value-digit display, the GAME_SUBSTATE
 * (0x600A) phase-21 handler. [ROM 0x1486-0x15F9, 372 bytes; entry 21 (0x15) of
 * loc_06fe's 0x0702 rst-0x28 sub-state table, reached via dispatchGameState -> loc_06fe
 * while GAME_STATE(0x6005)==3 and GAME_SUBSTATE(0x600A)==21. Dispatched from INSIDE the
 * vblank NMI, mask-cleared.]
 *
 * WHAT IT DOES. Drives the collectible bonus item (parasol/hat/bag) that appears on a
 * board: its position walk, its animated sprite, and the countdown value shown beside
 * it. Three top-level modes, selected by the handler's own latch SUBSTATE_TIMER(0x6009)
 * -- reused HERE not as the rst-0x18 countdown but as an init/running/done flag:
 *
 *   INIT (0x6009 == 0), the one-shot setup [0x1494-0x14DB]:
 *     - Clear both palette-bank latches (PALETTE_BANK_LO/HI := 0).  [HARDWARE writes]
 *     - Mark running: SUBSTATE_TIMER(0x6009) := 1.
 *     - Seed the item-state block: (0x6030):=0x0A (position reload), (0x6031):=0
 *       (sprite toggle), (0x6032):=0x10 (anim timer), (0x6033):=0x1E (value=30),
 *       (0x6034):=0x3E (display timer), (0x6035):=0 (position index).
 *     - Set the video pointer (0x6036) := 0x75E8.
 *     - Locate the item's video slot: scan the 0x611C table (stride 0x22, 4 rows) for
 *       the key C = 2*(0x600E)+1; store the matched row ptr at (0x6038) and row-0x0D at
 *       (0x603A). (No match leaves HL at the 4th row, B=0 -- the ROM does not guard it.)
 *     - Render once via sub_15fa (B=0, C=(0x6035)), then FALL INTO the main loop.
 *
 *   MAIN LOOP (0x6009 != 0), every frame [0x14DC-0x15F8], three stages:
 *     1. DISPLAY TIMER [0x14DF]: dec (0x6034); on wrap reload 0x3E and dec the value
 *        (0x6033). Value hitting 0 jumps to EXIT. Otherwise BCD-split the value into
 *        ones/tens and write them to the two on-screen digit cells 0x7552 / 0x7572.
 *     2. POSITION STEP [0x14FF]: reload (0x6030):=0x0A; read P1_INPUT(0x6010). Bit 7
 *        set -> the 0x1546 video-COLUMN walk (0x7588/0x7608 sentinels, wraps the video
 *        ptr 0x6036, and value 0x1D there EXITs). Bit 7 clear -> the low-2-bit step
 *        (0x1514): dec the frame divider (0x6030) and, on its expiry, inc/dec the
 *        position index (0x6035) with wrap across 0..0x1D, re-rendering via sub_15fa.
 *     3. SPRITE ANIMATE [0x158A]: dec the anim timer (0x6032); only on expiry toggle
 *        (0x6031) and redraw the 6-digit sprite -- IX taken from (iy+4/5) with
 *        iy=(0x6038), rendered by sub_057c -- then reload (0x6032):=0x10. Converges on
 *        the single ret at 0x15F9.
 *
 *   EXIT / cleanup (value==0 or the column walk hit 0x1D) [0x15C6]:
 *     - Clear the item slot ((0x6038) -> 0).
 *     - SUBSTATE_TIMER(0x6009) := 0x80 (done).
 *     - dec GAME_SUBSTATE(0x600A) -- the phase STEP-BACK to the previous sub-state (do
 *       NOT fold or drop this; it is how the phase machine advances past this handler).
 *     - Copy the 0x0C-cell video column (0x75E8 walking up by 0x20) into iy=(0x603A).
 *     - Enqueue follow-up tasks 0x0314..0x0318 (5x, DE++ each) then 0x031A, via sub_309f.
 *
 * INPUTS (RAM read): SUBSTATE_TIMER(0x6009) mode latch; 0x600E slot key; the item-state
 *   block 0x6030-0x6036/0x6038/0x603A; P1_INPUT(0x6010); the 0x611C slot table; plus the
 *   task-ring pointers (via sub_309f). OUTPUTS (RAM written): the item-state block; the
 *   on-screen digit cells 0x7552/0x7572; video RAM (via the column walk / sub_15fa /
 *   sub_057c / the exit copy); SUBSTATE_TIMER; GAME_SUBSTATE (decremented at exit); the
 *   task queue; and the two palette-bank HARDWARE latches (init only).
 *
 * IRREDUCIBLE CFG. The ROM has backward cross-jumps (0x1543->0x152D, 0x1587->0x1580,
 *   0x15C3->0x15A0) and multiple fall-throughs, so it does NOT reduce to structured
 *   if/for. It is transcribed as a label-dispatch loop: each ROM label is a switch
 *   case, each `jp` is `label = X; continue`, and ROM fall-through is switch
 *   fall-through -- the same idiom the oracle uses (all paths converge on the single
 *   `ret` at 0x15F9). Named RAM, local hardware-latch constants and section comments
 *   are the readability win; the branch topology is the ROM's.
 *
 * FLAGS. The routine ends in a plain `ret` (not `ret cc`), and its caller (loc_06fe's
 *   rst-0x28 `jp (hl)` tail) consumes no flag it sets -- so no flag is load-bearing to
 *   the CALLER. But the unit gate compares the WHOLE register file (F included) at the
 *   ret, and several in-routine branches DO read the flags of the instruction just
 *   before them (`dec (hl)`/`jp nz`/`jp z` on 0x6034/0x6033/0x6032; `bit 7`/`bit 1`;
 *   `jp p` on the SIGNED `sub 0x01` at 0x153E; the `sbc hl,bc` compares each preceded by
 *   `and a` to clear carry). Every flag-affecting op is therefore kept VERBATIM
 *   (regs.decMem8 / regs.bit / regs.sub / regs.cp / regs.sbcHl / regs.and, etc.), so both
 *   the in-routine branch decisions and the final observable F match the oracle exactly.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (the ROM's own label-dispatch
 *   structure already marks basic-block boundaries, so each `case` folds its
 *   straight-line runs into one charge per branch). Every path's TOTAL is preserved
 *   EXACTLY -- only the charge GRANULARITY changed, not the sum, not the memory-op
 *   order, not any register/flag result. Reasoning:
 *     - sub_1486 IS atomic in the usual sense (it runs inside the vblank NMI, entered
 *       mask-cleared, so no second NMI lands inside it or its callees), so this
 *       collapse is byte-identical to the oracle at every m.step boundary that
 *       survives, and the routine stays on the STRICT whole-machine gate (not the
 *       convergent one) for its unit/branch-arm assertions. Per the lead's
 *       unconditional rule the WHOLE-MACHINE job nonetheless runs under
 *       convergentGate too (any routine with a whole-machine test does), which is
 *       harmless here since a byte-exact collapse trivially converges.
 *     - Two concrete complications were handled explicitly: (a) the INIT branch's
 *       two HARDWARE writes to PALETTE_BANK_LO/HI each keep their OWN m.step
 *       boundary (never folded together or with neighboring instructions), per the
 *       hardware-write rule; (b) every m.call site's own dispatch charge is folded
 *       INTO the preceding straight-line block's total (matching sub_0350's tail-call
 *       pattern) while the `m.call` itself stays unfolded (never inlined).
 *     - HARDWARE-WRITE NOTE: unlike loc_0a8a's palette writes, the ORACLE leaves these
 *       two writes UNTAGGED (no write-bus-cycle offset). So under the emit `--writes`
 *       trace BOTH the oracle and this routine THROW identically (memory.js refuses an
 *       untagged hardware write) -- there is no numeric bus cycle to preserve, and the
 *       write-trace test pins exactly that equivalence (and that a busOffset-adding
 *       variant, which would NOT throw, is caught). Reproducing the oracle means writing
 *       PALETTE_BANK_LO/HI with NO busOffset here too; "fixing" them would DIVERGE.
 *     - Conditional-jump TAKEN paths and unconditional `jp`s charge nothing extra here,
 *       matching the oracle's OWN convention exactly (translated/state0.js does the
 *       same) -- this collapse folds only charges that already existed, never adds or
 *       drops one.
 *
 * REGISTERS. IX/IY/HL/DE/BC/A/F on exit are whatever the last executed instruction (or
 *   the last callee -- sub_309f at exit, sub_057c/sub_15fa mid-loop) leaves; the ROM's
 *   register walks (HL down the state block, the 0x611C search, the iy digit walk) are
 *   kept verbatim so the unit gate's full register-file compare matches on every path.
 */
export function sub_1486(m) {
  const { regs, mem } = m;
  let label = 0x1486;
  for (;;) {
    switch (label) {
      case 0x1486:
        // call 0x0616 -- the shared frame-interrupt/enable helper (interruptible).
        m.push16(0x1489);
        m.step(0x0616, 17); // call 0x0616 (INT)
        m.call(0x0616);

        // ld a,(SUBSTATE_TIMER)(10)+ld a,(hl)(7)+and a(4) = 21 t, exit @ the jp nz (0x148e).
        // 0 => INIT below, nonzero => already running, jump straight to the MAIN LOOP.
        regs.hl = SUBSTATE_TIMER; // 0x6009
        regs.a = mem.read8(regs.hl);
        regs.and(regs.a);
        m.step(0x148e, 21);
        if (regs.fNZ) { label = 0x14dc; continue; } // jp nz,0x14dc -- already running
        m.step(0x1491, 10); // jp nz NOT taken

        // ---- INIT (SUBSTATE_TIMER == 0, so A == 0) --------------------------------
        // Clear both palette-bank latches (bank %00). HARDWARE writes, each kept on its
        // OWN m.step boundary (never folded together or with neighbors) and UNTAGGED to
        // match the oracle byte-for-byte (see the CYCLES/HARDWARE-WRITE note above).
        mem.write8(PALETTE_BANK_LO, regs.a);
        m.step(0x1494, 13); // ld (0x7d86),a -- clear latch
        mem.write8(PALETTE_BANK_HI, regs.a);
        m.step(0x1497, 13); // ld (0x7d87),a

        // Seed SUBSTATE_TIMER + the item-state block 0x6030..0x6035 + the video ptr +
        // locate the item slot: all WORK RAM, no more hardware writes before the render
        // call -- folded into one 188 t block, exit @ the search loop (0x14c1).
        mem.write8(regs.hl, 0x01); // SUBSTATE_TIMER := 1 (running)
        regs.hl = 0x6030;
        mem.write8(regs.hl, 0x0a); // (0x6030) := 0x0A  position reload
        regs.hl = (regs.hl + 1) & 0xffff;
        mem.write8(regs.hl, 0x00); // (0x6031) := 0     sprite toggle
        regs.hl = (regs.hl + 1) & 0xffff;
        mem.write8(regs.hl, 0x10); // (0x6032) := 0x10  anim timer
        regs.hl = (regs.hl + 1) & 0xffff;
        mem.write8(regs.hl, 0x1e); // (0x6033) := 0x1E  value = 30
        regs.hl = (regs.hl + 1) & 0xffff;
        mem.write8(regs.hl, 0x3e); // (0x6034) := 0x3E  display timer
        regs.hl = (regs.hl + 1) & 0xffff;
        mem.write8(regs.hl, 0x00); // (0x6035) := 0     position index
        regs.hl = 0x75e8;
        mem.write16(0x6036, regs.hl); // video pointer := 0x75E8
        regs.hl = 0x611c; // slot table
        regs.a = mem.read8(0x600e);
        regs.rlca(); // A = 2*(0x600E)
        regs.a = regs.inc8(regs.a); // A = 2*(0x600E)+1
        regs.c = regs.a; // C = search key
        regs.de = 0x0022; // stride
        regs.b = 0x04; // 4 entries
        m.step(0x14c1, 188);
      // fall into the search loop
      case 0x14c1:
        // ld a,(hl)(7)+cp c(4) = 11 t, exit @ the jp z (0x14c3).
        regs.a = mem.read8(regs.hl);
        regs.cp(regs.c);
        if (regs.fZ) { label = 0x14c9; continue; } // jp z,0x14c9 -- match; no charge (oracle convention)
        // jp z NOT taken(10)+add hl,de(11) = 21 t, folded with the block above (32 t
        // total) up to the djnz's own charge, exit @ the djnz (0x14c7).
        regs.addHl(regs.de);
        m.step(0x14c7, 32); // ld a,(hl)+cp c+jp z NOT taken+add hl,de = 32 t
        regs.djnz();
        m.step(regs.b ? 0x14c1 : 0x14c9, regs.b ? 13 : 8); // djnz 0x14c1
        if (regs.b) { label = 0x14c1; continue; }
      // fall into 0x14c9 (no match -> HL at 4th row, B=0; the ROM does not guard this)
      case 0x14c9:
        // ld(0x6038),hl(16)+ld de,0xfff3(10)+add hl,de(11)+ld(0x603a),hl(16)+ld b,0(7)+
        // ld a,(0x6035)(13)+ld c,a(4)+render call's own dispatch charge(17) = 94 t.
        mem.write16(0x6038, regs.hl); // slot ptr
        regs.de = 0xfff3; // = -0x0D
        regs.addHl(regs.de); // HL -= 0x0D
        mem.write16(0x603a, regs.hl); // slot - 0x0D
        regs.b = 0x00; // first render: B=0, C=(0x6035)
        regs.a = mem.read8(0x6035);
        regs.c = regs.a;
        m.push16(0x14dc);
        m.step(0x15fa, 94);
        m.call(0x15fa); // render
      // fall into the MAIN LOOP

      // ==== MAIN LOOP stage 1: DISPLAY TIMER + value countdown ====================
      case 0x14dc:
        // ld hl,0x6034(10)+dec (hl)(11) = 21 t, exit @ the jp nz (0x14e0).
        regs.hl = 0x6034;
        regs.decMem8(mem, regs.hl);
        m.step(0x14e0, 21);
        if (regs.fNZ) { label = 0x14fc; continue; } // jp nz,0x14fc -- still counting; no charge
        // jp nz NOT taken(10)+ld(hl),0x3e(10)+dec hl(6)+dec (hl)(11) = 37 t, exit @ jp z (0x14e7).
        mem.write8(regs.hl, 0x3e); // reload display timer
        regs.hl = (regs.hl - 1) & 0xffff; // -> 0x6033 (value)
        regs.decMem8(mem, regs.hl); // value--
        m.step(0x14e7, 37);
        if (regs.fZ) { label = 0x15c6; continue; } // jp z,0x15c6 -- value == 0 EXIT; no charge
        // jp z NOT taken(10)+ld a,(hl)(7)+ld b,0xff(7) = 24 t, exit @ BCD loop (0x14ed).
        regs.a = mem.read8(regs.hl); // the value
        regs.b = 0xff; // tens accumulator (pre-inc)
        m.step(0x14ed, 24);
      // fall into the BCD split loop
      case 0x14ed:
        // inc b(4)+sub 0x0a(7) = 11 t, exit @ the jp nc (0x14f0).
        regs.b = regs.inc8(regs.b);
        regs.sub(0x0a);
        m.step(0x14f0, 11);
        if (regs.fNC) { label = 0x14ed; continue; } // jp nc,0x14ed -- keep subtracting; no charge
        // jp nc NOT taken(10)+add a,0x0a(7)+ld(0x7552),a(13)+ld a,b(4)+ld(0x7572),a(13) = 47 t.
        regs.add(0x0a); // A = ones digit, B = tens digit
        mem.write8(0x7552, regs.a); // ones -> video
        regs.a = regs.b;
        mem.write8(0x7572, regs.a); // tens -> video
        m.step(0x14fc, 47);
      // fall into stage 2

      // ==== MAIN LOOP stage 2: POSITION STEP ======================================
      case 0x14fc:
        // ld hl,0x6030(10)+ld b,(hl)(7)+ld(hl),0x0a(10)+ld a,(0x6010)(13)+bit 7,a(8) = 48 t,
        // exit @ the jp nz bit7 test (0x1507).
        regs.hl = 0x6030;
        regs.b = mem.read8(regs.hl);
        mem.write8(regs.hl, 0x0a); // reload divider
        regs.a = mem.read8(P1_INPUT); // cooked control word
        regs.bit(7, regs.a);
        m.step(0x1507, 48);
        if (regs.fNZ) { label = 0x1546; continue; } // jp nz,0x1546 -- bit7: column walk; no charge
        // jp nz NOT taken(10)+and 0x03(7) = 17 t, exit @ the jp nz #2 (0x150c).
        regs.and(0x03);
        m.step(0x150c, 17);
        if (regs.fNZ) { label = 0x1514; continue; } // jp nz,0x1514 -- low bits set; no charge
        // jp nz NOT taken(10)+inc a(4)+ld(hl),a(7) = 21 t.
        regs.a = regs.inc8(regs.a); // A := 1
        mem.write8(regs.hl, regs.a); // (0x6030) := 1
        m.step(0x1511, 21);
        label = 0x158a;
        continue; // jp 0x158a -- straight to sprite animate
      case 0x1514:
        // dec b(4) = 4 t, exit @ the jp z (0x1515).
        regs.b = regs.dec8(regs.b); // frame divider
        m.step(0x1515, 4);
        if (regs.fZ) { label = 0x151d; continue; } // jp z,0x151d -- divider expired; no charge
        // jp z NOT taken(10)+ld a,b(4)+ld(hl),a(7) = 21 t.
        regs.a = regs.b;
        mem.write8(regs.hl, regs.a); // (0x6030) := B (store the decremented divider)
        m.step(0x151a, 21);
        label = 0x158a;
        continue; // jp 0x158a
      case 0x151d:
        // Divider expired: step the position index (0x6035) in the direction from bit 1.
        // bit 1,a(8) = 8 t, exit @ the jp nz (0x151f).
        regs.bit(1, regs.a);
        m.step(0x151f, 8);
        if (regs.fNZ) { label = 0x1539; continue; } // jp nz,0x1539 -- decrement path; no charge
        // jp nz NOT taken(10)+ld a,(0x6035)(13)+inc a(4)+cp 0x1e(7) = 34 t.
        regs.a = mem.read8(0x6035);
        regs.a = regs.inc8(regs.a);
        regs.cp(0x1e);
        m.step(0x1528, 34);
        if (regs.fNZ) { label = 0x152d; continue; } // jp nz,0x152d -- no wrap; no charge
        // jp nz NOT taken(10)+ld a,0x00(7) = 17 t.
        regs.a = 0x00; // wrap 0x1E -> 0
        m.step(0x152d, 17);
      // fall into store-and-render
      case 0x152d:
        // ld(0x6035),a(13)+ld c,a(4)+ld b,0(7)+render call's own dispatch charge(17) = 41 t.
        mem.write8(0x6035, regs.a);
        regs.c = regs.a;
        regs.b = 0x00;
        m.push16(0x1536);
        m.step(0x15fa, 41);
        m.call(0x15fa); // render
        label = 0x158a;
        continue; // jp 0x158a
      case 0x1539:
        // ld a,(0x6035)(13)+sub 0x01(7) = 20 t, exit @ the jp p (0x153e).
        regs.a = mem.read8(0x6035);
        regs.sub(0x01);
        m.step(0x153e, 20);
        if (regs.fP) { label = 0x152d; continue; } // jp p,0x152d -- SIGNED: >=0 keep it; no charge
        // jp p NOT taken(10)+ld a,0x1d(7) = 17 t.
        regs.a = 0x1d; // underflow -> 0x1D
        m.step(0x1543, 17);
        label = 0x152d;
        continue; // jp 0x152d

      // ---- bit 7 set: the video-COLUMN walk [0x1546] ----------------------------
      case 0x1546:
        // ld a,(0x6035)(13)+cp 0x1c(7) = 20 t, exit @ the jp z (0x154b).
        regs.a = mem.read8(0x6035);
        regs.cp(0x1c);
        m.step(0x154b, 20);
        if (regs.fZ) { label = 0x156d; continue; } // jp z,0x156d -- no charge
        // jp z NOT taken(10)+cp 0x1d(7) = 17 t.
        regs.cp(0x1d);
        m.step(0x1550, 17);
        if (regs.fZ) { label = 0x15c6; continue; } // jp z,0x15c6 -- 0x1D EXITs; no charge
        // jp z NOT taken(10)+ld hl,(0x6036)(16)+ld bc,0x7588(10)+and a(4)+sbc hl,bc(15) = 55 t.
        regs.hl = mem.read16(0x6036); // video ptr
        regs.bc = 0x7588; // upper sentinel
        regs.and(regs.a); // clear carry for sbc
        regs.sbcHl(regs.bc);
        m.step(0x155c, 55);
        if (regs.fZ) { label = 0x158a; continue; } // jp z,0x158a -- at sentinel, no move; no charge
        // jp z NOT taken(10)+add hl,bc(11)+add a,0x11(7)+ld(hl),a(7)+ld bc,0xffe0(10)+
        // add hl,bc(11) = 56 t.
        regs.addHl(regs.bc); // restore HL
        regs.add(0x11);
        mem.write8(regs.hl, regs.a); // stamp the cell
        regs.bc = 0xffe0; // up one row
        regs.addHl(regs.bc);
        m.step(0x1567, 56);
      // fall into store-video-ptr
      case 0x1567:
        mem.write16(0x6036, regs.hl);
        m.step(0x156a, 16); // ld (0x6036),hl
        label = 0x158a;
        continue; // jp 0x158a
      case 0x156d:
        // ld hl,(0x6036)(16)+ld bc,0x20(10)+add hl,bc(11)+and a(4)+ld bc,0x7608(10)+
        // sbc hl,bc(15) = 66 t, exit @ the jp nz (0x157a).
        regs.hl = mem.read16(0x6036);
        regs.bc = 0x0020;
        regs.addHl(regs.bc); // down one row
        regs.and(regs.a); // clear carry for sbc
        regs.bc = 0x7608; // lower sentinel
        regs.sbcHl(regs.bc);
        m.step(0x157a, 66);
        if (regs.fNZ) { label = 0x1586; continue; } // jp nz,0x1586 -- no charge
        // jp nz NOT taken(10)+ld hl,0x75e8(10) = 20 t.
        regs.hl = 0x75e8; // wrap the video ptr to the top
        m.step(0x1580, 20);
      // fall into 0x1580
      case 0x1580:
        // ld a,0x10(7)+ld(hl),a(7) = 14 t.
        regs.a = 0x10;
        mem.write8(regs.hl, regs.a);
        m.step(0x1583, 14);
        label = 0x1567;
        continue; // jp 0x1567 -- store video ptr, then animate
      case 0x1586:
        regs.addHl(regs.bc); // restore HL (undo the sbc)
        m.step(0x1587, 11); // add hl,bc
        label = 0x1580;
        continue; // jp 0x1580

      // ==== MAIN LOOP stage 3: SPRITE ANIMATE =====================================
      case 0x158a:
        // ld hl,0x6032(10)+dec (hl)(11) = 21 t, exit @ the jp nz (0x158e).
        regs.hl = 0x6032;
        regs.decMem8(mem, regs.hl);
        m.step(0x158e, 21);
        if (regs.fNZ) { label = 0x15f9; continue; } // jp nz,0x15f9 -- not this frame; no charge
        // jp nz NOT taken(10)+ld a,(0x6031)(13)+and a(4) = 27 t.
        regs.a = mem.read8(0x6031); // sprite toggle
        regs.and(regs.a);
        m.step(0x1595, 27);
        if (regs.fNZ) { label = 0x15b8; continue; } // jp nz,0x15b8 -- toggle set path; no charge
        // jp nz NOT taken(10)+ld a,0x01(7)+ld(0x6031),a(13)+ld de,0x01bf(10) = 40 t.
        regs.a = 0x01;
        mem.write8(0x6031, regs.a); // toggle := 1
        regs.de = 0x01bf; // digit source ptr
        m.step(0x15a0, 40);
      // fall into the shared render tail
      case 0x15a0:
        // ld iy,(0x6038)(20)+ld l,(iy+4)(19)+ld h,(iy+5)(19)+push hl(11)+pop ix(14)+
        // render call's own dispatch charge(17) = 100 t.
        regs.iy = mem.read16(0x6038);
        regs.l = mem.read8((regs.iy + 0x04) & 0xffff);
        regs.h = mem.read8((regs.iy + 0x05) & 0xffff);
        m.push16(regs.hl);
        regs.ix = m.pop16(); // IX := sprite ptr from (iy+4/5)
        m.push16(0x15b0);
        m.step(0x057c, 100);
        m.call(0x057c); // render the 6 digits
        // ld a,0x10(7)+ld(0x6032),a(13) = 20 t.
        regs.a = 0x10;
        mem.write8(0x6032, regs.a); // reload anim timer
        m.step(0x15b5, 20);
        label = 0x15f9;
        continue; // jp 0x15f9
      case 0x15b8:
        // xor a(4)+ld(0x6031),a(13)+ld de,(0x6038)(20)+inc de x3(18) = 55 t.
        regs.xor(regs.a);
        mem.write8(0x6031, regs.a); // toggle := 0
        regs.de = mem.read16(0x6038);
        regs.de = (regs.de + 1) & 0xffff;
        regs.de = (regs.de + 1) & 0xffff;
        regs.de = (regs.de + 1) & 0xffff; // DE := (0x6038)+3
        m.step(0x15c3, 55);
        label = 0x15a0;
        continue; // jp 0x15a0 -- shared render tail

      // ==== EXIT / cleanup =========================================================
      case 0x15c6:
        // ld de,(0x6038)(20)+xor a(4)+ld(de),a(7)+ld hl,SUBSTATE_TIMER(10)+ld(hl),0x80(10)+
        // inc hl(6)+dec(hl)(11)+ld b,0x0c(7)+ld hl,0x75e8(10)+ld iy,(0x603a)(20)+
        // ld de,0xffe0(10) = 115 t, exit @ the column-copy loop (0x15df).
        regs.de = mem.read16(0x6038);
        regs.xor(regs.a);
        mem.write8(regs.de, regs.a); // clear the item slot
        regs.hl = SUBSTATE_TIMER; // 0x6009
        mem.write8(regs.hl, 0x80); // SUBSTATE_TIMER := 0x80 (done)
        regs.hl = (regs.hl + 1) & 0xffff; // -> GAME_SUBSTATE (0x600A)
        regs.decMem8(mem, regs.hl); // GAME_SUBSTATE-- : the PHASE STEP-BACK
        regs.b = 0x0c; // 0x0C cells to copy
        regs.hl = 0x75e8; // video source
        regs.iy = mem.read16(0x603a); // destination
        regs.de = 0xffe0; // up one row
        m.step(0x15df, 115);
      // fall into the column-copy loop
      case 0x15df:
        // ld a,(hl)(7)+ld(iy+0),a(19)+inc iy(10)+add hl,de(11) = 47 t, plus the djnz's own
        // charge (13 taken / 8 not taken).
        regs.a = mem.read8(regs.hl); // copy 0x0C cells (video -> iy)
        mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
        regs.iy = (regs.iy + 1) & 0xffff;
        regs.addHl(regs.de); // up one row
        regs.djnz();
        if (regs.b) {
          m.step(0x15df, 60); // body(47) + djnz taken(13) = 60 t
          label = 0x15df;
          continue;
        }
        // Enqueue tasks 0x0314..0x0318 (5x, DE++ each): body(47) + djnz NOT taken(8) +
        // ld b,0x05(7) + ld de,0x0314(10) = 72 t.
        regs.b = 0x05;
        regs.de = 0x0314;
        m.step(0x15ed, 72);
      // fall into the enqueue loop
      case 0x15ed:
        m.push16(0x15f0);
        m.step(0x309f, 17); // call 0x309f -- enqueue one follow-up task
        m.call(0x309f);
        regs.de = (regs.de + 1) & 0xffff;
        regs.djnz();
        if (regs.b) {
          m.step(0x15ed, 19); // inc de(6) + djnz taken(13) = 19 t
          label = 0x15ed;
          continue;
        }
        // Enqueue the final task 0x031A: inc de(6) + djnz NOT taken(8) + ld de,0x031a(10) = 24 t.
        regs.de = 0x031a;
        m.step(0x15f6, 24);
        m.push16(0x15f9);
        m.step(0x309f, 17); // call 0x309f -- enqueue the final task
        m.call(0x309f);
      // fall into the single ret
      case 0x15f9:
        m.ret(10); // ret @0x15F9 -- the single ret; all paths converge here
        return;
      default:
        throw new Error(`sub_1486: unreachable label 0x${label.toString(16)}`);
    }
  }
}
