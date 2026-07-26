// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_2f71 (ROM 0x2f71-0x3045, The Pit) -- the
 * per-frame scroll/animate update over the 0x80db-0x80e7 counter block that
 * TAIL-JUMPS to loc_312d.
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM standing in for ROM+work+video RAM, and step/call/ret/push16/
 * pop16/read16/write16 mirroring the DK Machine) so the routine runs in isolation.
 * The mock's `call` RECORDS the target and does NOT execute it -- so the callee's
 * register/flag effects are absent, exactly the drafter contract: we test THIS
 * routine's per-instruction fidelity, with every callee stubbed. `pcSeq` records
 * every step boundary for a deterministic stepcheck.
 *
 * Every path ends in the unconditional `jp 0x312d`, modelled as
 * `m.step(0x312d,10); return m.call(0x312d)` (no `ret`), so the final PC is 0x312d
 * and 0x312d is the LAST recorded call.
 *
 * Paths pinned against the disassembly:
 *   1. SHORT: (0x80e7)=0 -> `jp z,0x2fc0` skips stage 1; (0x80e3)=4 -> dec=3 (nz)
 *      -> `jr nz,0x2fde`; (3 & 0x03)=3 (nz) -> `jp nz,0x3029` skips the oscillator;
 *      publish + tail-jump. Full pcSeq + T-total (229) + the four 0x822c writes.
 *      The MUTATION targets this... no -- the mutation targets Path 2 (below).
 *   2. SCROLL+OSC: (0x80e7)=1, (0x8077)=0 (skip gate call), (0x80e5)=1 -> wrap ->
 *      reload from (0x80e4)=5, (0x80e6)=0x0a-6=4 -> copy 6 table bytes UP the
 *      0x938c column (stride -0x20); (0x80e3)=1 -> wrap -> reload 8 + toggle
 *      (0x80dc) 0x38->0x39; oscillator bumps x/velocity/y/step; y<0x86 so no clamp
 *      call. Full effect set + T-total (1059). Exercises djnz, IX, ld (nn),hl.
 *   3. BOTH CALLS: (0x806b)==0x6b fires the gate call 0x4c7b; y>=0x86 fires the
 *      clamp call 0x4b1a. Asserts the call ORDER [0x4c7b,0x4b1a,0x312d] and the
 *      clamp/animate memory effects.
 *
 * TEETH (required mutation): mis-charge the `ld ix,(0x80e1)` step (0x2faf) as 16 T
 * instead of the correct 20 T -- the classic "forgot the DD prefix adds 4 T to the
 * 16 of `ld hl,(nn)`" timing error. Same memory result, wrong cycle budget. Path 2
 * is re-run with that one step mis-charged and the golden T-state assertion MUST
 * catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_2f71.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2f71 } from "../loc_2f71.js";

function makeMachine(startPc = 0x2f71) {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
      ram[(a + 1) & 0xffff] = (v >> 8) & 0xff;
    },
  };
  return {
    regs,
    mem,
    ram,
    calls: [],
    tstates: 0,
    pc: startPc,
    pcSeq: [],
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.tstates += cycles;
      this.pcSeq.push(nextAddr);
    },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) {
      this.step(this.pop16(), cycles);
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callee is stubbed in isolation -- recorded, not executed
    },
  };
}

const b = (m, a) => m.mem.read8(a);

function assertTailJump(m) {
  assert.equal(m.pc, 0x312d, "ends at loc_312d (tail-jump target set by the last step)");
  assert.equal(m.calls[m.calls.length - 1], 0x312d, "last transfer is the tail-jump m.call(0x312d)");
}

// ---- Path 1: SHORT -- (0x80e7)=0 -> skip stage 1; off-beat -> skip oscillator ------
const EXPECTED_PC_SEQ_1 = [
  0x2f74, 0x2f75, 0x2fc0, // ld a,(80e7); and a; jp z,0x2fc0 TAKEN
  0x2fc3, 0x2fc4, 0x2fc7, // ld a,(80e3); dec a; ld (80e3),a
  0x2fde, 0x2fe0, 0x3029, // jr nz,0x2fde TAKEN; and 0x03; jp nz,0x3029 TAKEN
  0x302c, 0x302f, 0x3030, 0x3033, 0x3034, 0x3035, 0x3036, 0x3039, 0x303a, 0x303b,
  0x303e, 0x303f, 0x3040, 0x3043, 0x3044, 0x3045, 0x312d, // publish + tail-jump
];

function setupPath1(m) {
  m.mem.write8(0x80e7, 0x00); // stage-1 enable OFF -> jp z,0x2fc0
  m.mem.write8(0x80e3, 0x04); // frame counter: dec -> 3 (nz), (3 & 3)=3 (nz) -> skip osc
  m.mem.write8(0x8051, 0x05); // hero/camera x
  m.mem.write8(0x80db, 0x30); // x
  m.mem.write8(0x80dc, 0x39); // sprite frame
  m.mem.write8(0x80dd, 0x02);
  m.mem.write8(0x80de, 0x40); // y
}

function assertPath1(m) {
  assert.equal(m.tstates, 229, "Path 1 T-state total");
  assert.equal(b(m, 0x80e3), 0x03, "(0x80e3) decremented 4 -> 3");
  // the untouched oscillator state flows straight to publish:
  assert.equal(b(m, 0x822c), 0x2b, "(0x822c) = x(0x30) - camera(0x05) = 0x2b");
  assert.equal(b(m, 0x822d), 0x39, "(0x822d) = sprite frame (0x80dc)");
  assert.equal(b(m, 0x822e), 0x02, "(0x822e) = (0x80dd)");
  assert.equal(b(m, 0x822f), 0x45, "(0x822f) = y(0x40) + camera(0x05) = 0x45");
  assert.equal(m.regs.a, 0x45, "A = 0x45 at the tail-jump (last add a,b)");
  assert.deepEqual(m.calls, [0x312d], "only transfer is the tail-jump (no gate/clamp call)");
  assertTailJump(m);
}

test("loc_2f71 Path 1: disabled + off-beat -> publish only", () => {
  const m = makeMachine();
  setupPath1(m);
  loc_2f71(m);
  assertPath1(m);
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_1, "Path 1 step boundaries match the disassembly");
});

// ---- Path 2: SCROLL copy + oscillator (no calls) ------------------------------------
function setupPath2(m) {
  m.mem.write8(0x80e7, 0x01); // stage-1 enabled
  m.mem.write8(0x8077, 0x00); // gate off -> jr z,0x2f88 (no call 0x4c7b)
  m.mem.write8(0x80e5, 0x01); // reveal counter: dec -> 0 -> wrap
  m.mem.write8(0x80e4, 0x05); // reload value for (0x80e5)
  m.mem.write8(0x80e6, 0x0a); // table index: 0x0a - 6 = 4 (no underflow)
  m.mem.write8(0x80e3, 0x01); // frame counter: dec -> 0 -> wrap (animate)
  m.mem.write8(0x80dc, 0x38); // frame == 0x38 -> toggles to 0x39
  m.mem.write8(0x80df, 0x01); // x velocity
  m.mem.write8(0x80db, 0x10); // x
  m.mem.write8(0x80e0, 0xfc); // vertical step
  m.mem.write8(0x80de, 0x10); // y
  m.mem.write8(0x8051, 0x00); // camera 0
  // tile table bytes at 0x3048 + 4 = 0x304c..0x3051
  const tbl = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66];
  tbl.forEach((v, i) => m.mem.write8(0x304c + i, v));
}

function assertPath2(m) {
  assert.equal(m.tstates, 1059, "Path 2 T-state total (djnz x6, IX load, ld (nn),hl)");
  // stage 1: reveal reload + table index advance + IX source pointer
  assert.equal(b(m, 0x80e5), 0x05, "(0x80e5) reloaded from (0x80e4)");
  assert.equal(b(m, 0x80e6), 0x04, "(0x80e6) = 0x0a - 6 = 4");
  assert.equal(m.mem.read16(0x80e1), 0x304c, "(0x80e1) = 0x3048 + 4 = 0x304c");
  assert.equal(m.regs.ix, 0x3052, "IX advanced past all 6 table bytes (0x304c + 6)");
  // the 6-byte column copy, stride -0x20 starting at 0x938c
  assert.equal(b(m, 0x938c), 0x11, "col[0] = table[0]");
  assert.equal(b(m, 0x936c), 0x22, "col[1] one row up = table[1]");
  assert.equal(b(m, 0x934c), 0x33, "col[2]");
  assert.equal(b(m, 0x932c), 0x44, "col[3]");
  assert.equal(b(m, 0x930c), 0x55, "col[4]");
  assert.equal(b(m, 0x92ec), 0x66, "col[5] top of the column");
  // stage 2: frame reload + sprite toggle + oscillator
  assert.equal(b(m, 0x80e3), 0x08, "(0x80e3) reloaded to 8 on wrap");
  assert.equal(b(m, 0x80dc), 0x39, "(0x80dc) toggled 0x38 -> 0x39");
  assert.equal(b(m, 0x80db), 0x11, "x = 0x10 + velocity 0x01");
  assert.equal(b(m, 0x80df), 0x01, "velocity set to +1 (x < 0x19)");
  assert.equal(b(m, 0x80e0), 0xfd, "vertical step incremented 0xfc -> 0xfd");
  assert.equal(b(m, 0x80de), 0x0d, "y = 0x10 + 0xfd = 0x0d (wraps, < 0x86 so no clamp)");
  // publish
  assert.equal(b(m, 0x822c), 0x11, "(0x822c) = x - camera(0)");
  assert.equal(b(m, 0x822d), 0x39, "(0x822d) = toggled frame");
  assert.equal(b(m, 0x822f), 0x0d, "(0x822f) = y + camera(0)");
  assert.deepEqual(m.calls, [0x312d], "no gate/clamp call fired on this path");
  assertTailJump(m);
}

test("loc_2f71 Path 2: reveal-copy + animate + oscillate", () => {
  const m = makeMachine();
  setupPath2(m);
  loc_2f71(m);
  assertPath2(m);
});

// ---- Path 3: BOTH CALLS -- gate call 0x4c7b + clamp call 0x4b1a ---------------------
function setupPath3(m) {
  m.mem.write8(0x80e7, 0x01); // stage-1 enabled
  m.mem.write8(0x8077, 0x01); // gate arm 1
  m.mem.write8(0x806b, 0x6b); // gate arm 2 (== 0x6b) -> fires call 0x4c7b
  m.mem.write8(0x80e5, 0x02); // reveal counter: dec -> 1 (nz) -> skip the copy
  m.mem.write8(0x80e3, 0x01); // frame counter: dec -> 0 -> wrap (animate)
  m.mem.write8(0x80dc, 0x39); // frame != 0x38 -> stays 0x38
  m.mem.write8(0x80df, 0x01); // velocity
  m.mem.write8(0x80db, 0x30); // x -> 0x31 (in [0x19,0x38): velocity held)
  m.mem.write8(0x80e0, 0x80); // step -> 0x81
  m.mem.write8(0x80de, 0x10); // y -> 0x10 + 0x81 = 0x91 >= 0x86 -> clamp + call 0x4b1a
  m.mem.write8(0x80dd, 0x00);
  m.mem.write8(0x8051, 0x00); // camera 0
}

test("loc_2f71 Path 3: gate call 0x4c7b + clamp call 0x4b1a, in order", () => {
  const m = makeMachine();
  setupPath3(m);
  loc_2f71(m);

  assert.deepEqual(
    m.calls,
    [0x4c7b, 0x4b1a, 0x312d],
    "gate call, then clamp call, then the tail-jump -- in that order",
  );
  assert.equal(b(m, 0x80e5), 0x01, "(0x80e5) decremented 2 -> 1 (copy skipped)");
  assert.equal(b(m, 0x80e3), 0x08, "(0x80e3) reloaded to 8");
  assert.equal(b(m, 0x80dc), 0x38, "(0x80dc) stays 0x38 (was 0x39, not 0x38)");
  assert.equal(b(m, 0x80db), 0x31, "x = 0x30 + 1");
  assert.equal(b(m, 0x80df), 0x01, "velocity held (x in [0x19,0x38))");
  assert.equal(b(m, 0x80de), 0x86, "y clamped to 0x86");
  assert.equal(b(m, 0x80dd), 0x01, "(0x80dd) bumped 0 -> 1 (bit 3 cleared)");
  // (0x80e0) result depends on the STUBBED call preserving A (=0x86): or 0xf8 -> 0xfe,
  // dec -> 0xfd. In the live game 0x4b1a would set A, so this asserts the drafter
  // path only, not the integrated value.
  assert.equal(b(m, 0x80e0), 0xfd, "(0x80e0) = (0x86 | 0xf8) - 1 with A preserved by the stub");
  assert.equal(b(m, 0x822c), 0x31, "(0x822c) = x - camera(0)");
  assert.equal(b(m, 0x822f), 0x86, "(0x822f) = clamped y + camera(0)");
  assertTailJump(m);
});

// ---- MUTATION (TEETH): `ld ix,(0x80e1)` mis-charged 16 T instead of 20 T ------------
test("loc_2f71 MUTATION: `ld ix,(0x80e1)` mis-charged 16T (not 20T) is caught", () => {
  const m = makeMachine();
  setupPath2(m);
  const realStep = m.step.bind(m);
  let mutated = false;
  m.step = (nextAddr, cycles) => {
    // The step FOLLOWING `ld ix,(0x80e1)` lands on 0x2faf carrying the load's 20 T.
    if (!mutated && nextAddr === 0x2faf) { mutated = true; return realStep(nextAddr, 16); }
    return realStep(nextAddr, cycles);
  };

  loc_2f71(m);

  assert.equal(m.tstates, 1055, "mutation drops exactly 4 T (20 -> 16)");
  assert.throws(
    () => assertPath2(m),
    /Path 2 T-state total/,
    "the golden T-state assertion must fail on the mutant",
  );
});
