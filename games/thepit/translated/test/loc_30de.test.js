// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for the translated loc_30de (ROM 0x30de, The Pit) -- seeds the
 * 0x80e8-0x8109 parameter block, derives the byte pair (0x80f6)/(0x8107) from
 * bits 1-2 of the level counter (0x8028), then TAIL-JUMPS to loc_36fe.
 *
 * Self-contained: a minimal mock machine (real Regs from z80.js for exact flags,
 * a flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK/thepit Machine)
 * so the routine runs in isolation without a ROM image. The only exit is an
 * unconditional `jp 0x36fe`, modelled as `m.step(0x36fe,10); return m.call(0x36fe)`;
 * the mock's `call` records the target and does NOT execute it, so the final PC is
 * 0x36fe and m.calls == [0x36fe] proves the tail-jump fired (and that it is not a
 * `ret`). `pcSeq` records every step boundary for a deterministic stepcheck.
 *
 * The routine is entirely straight-line (no branches), so there is exactly one
 * control path and a fixed 317 T-state total. The one piece of real logic is the
 * derived pair:  (0x80f6) = (0x8107) = 0x07 - ((0x8028) & 0x06).
 * It is pinned across the full range of the 2-bit mask AND with the "off" bits
 * (bit 0 and bit 3) set, proving the mask keeps only bits 1-2:
 *   (0x8028)=0x00 -> 0x07 ;  =0x02 -> 0x05 ;  =0x04 -> 0x03 ;  =0x06 -> 0x01
 *   (0x8028)=0x01 -> 0x07 (bit0 ignored) ;  =0x08 -> 0x07 (bit3 ignored)
 *   (0x8028)=0xff -> 0x01 (all bits, mask -> 0x06)
 *
 * TEETH (required mutation): corrupt the store to (0x80f6) so it lands a wrong
 * value (derived+1) while everything else is untouched -- a plausible off-by-one
 * in the `sub b` derivation. The derived-byte golden assertion MUST catch it.
 *
 * Run: node --test games/thepit/translated/test/loc_30de.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_N } from "../../../../core/cpu/z80.js";
import { loc_30de } from "../loc_30de.js";

const CALLER_RET = 0xabcd; // seated on the stack; a `ret` (there is none) would pop it

function makeMachine() {
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
    pc: 0x30de,
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
      return undefined; // tail-jump target is recorded, not executed, in isolation
    },
  };
}

// The fixed constant block -- identical on every input (the derived pair excluded).
const CONSTANTS = [
  [0x80e9, 0x09], [0x80e8, 0xec], [0x80eb, 0x23], [0x80ea, 0x04],
  [0x80f5, 0x01], [0x80f0, 0x01], [0x80f8, 0x04],
  [0x80fa, 0x09], [0x80fb, 0x04], [0x80f9, 0x00], [0x8106, 0x00],
  [0x8101, 0x01], [0x8109, 0x05],
];

function assertConstantBlock(m) {
  for (const [addr, val] of CONSTANTS) {
    assert.equal(m.mem.read8(addr), val, `(0x${addr.toString(16)})=0x${val.toString(16)}`);
  }
}

// The derived pair: (0x80f6) = (0x8107) = 0x07 - ((0x8028) & 0x06).
function assertDerivedPair(m, expected) {
  assert.equal(m.mem.read8(0x80f6), expected, `(0x80f6) = 0x${expected.toString(16)}`);
  assert.equal(m.mem.read8(0x8107), expected, `(0x8107) = 0x${expected.toString(16)} (mirror)`);
}

// Every path ends in the same unconditional tail-jump to loc_36fe.
function assertTailJump(m) {
  assert.equal(m.pc, 0x36fe, "ends at loc_36fe (tail-jump target set by the last step)");
  assert.deepEqual(m.calls, [0x36fe], "tail-jumped via m.call(0x36fe) -- not a ret");
}

// The complete step-boundary trace (deterministic; no branches).
const EXPECTED_PC_SEQ = [
  0x30e0, 0x30e3, 0x30e5, 0x30e8, 0x30ea, 0x30ed, 0x30ef, 0x30f2, 0x30f4, 0x30f7,
  0x30fa, 0x30fc, 0x30ff, 0x3102, 0x3104, 0x3105, 0x3107, 0x3108, 0x310b, 0x310e,
  0x3110, 0x3113, 0x3115, 0x3118, 0x311a, 0x311d, 0x3120, 0x3122, 0x3125, 0x3127,
  0x312a, 0x36fe,
];

// The full golden check for one input. `derived` = 0x07 - ((0x8028) & 0x06).
function assertGolden(m, masked, derived) {
  assert.equal(m.tstates, 317, "T-state total (single straight-line path)");
  assertConstantBlock(m);
  assertDerivedPair(m, derived);
  assert.equal(m.regs.a, 0x05, "A = 0x05 at the tail-jump (last constant loaded)");
  assert.equal(m.regs.b, masked, "B = (0x8028) & 0x06 (never reloaded after)");
  assert.equal(m.regs.fC, false, "carry clear at exit (0x07 - B, B<=6, no borrow)");
  assert.ok(m.regs.f & F_N, "N set at exit (last flag op is `sub b`)");
  assertTailJump(m);
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ, "step boundaries match the disassembly");
}

// ---- Golden: (0x8028)=0x0a -> mask keeps bit1 only -> B=0x02 -> derived=0x05 -------
test("loc_30de golden: (0x8028)=0x0a -> (0x80f6)=(0x8107)=0x05, tail-jump loc_36fe", () => {
  const m = makeMachine();
  m.regs.sp = 0x83ff;
  m.push16(CALLER_RET); // a return address a stray `ret` would pop -- there is none
  m.mem.write8(0x8028, 0x0a);
  loc_30de(m);
  assertGolden(m, 0x02, 0x05);
  // The caller's return address is untouched: no ret ran (it was a tail-jump).
  assert.equal(m.mem.read16(m.regs.sp), CALLER_RET, "caller return addr still on the stack");
});

// ---- Derived byte across the whole 2-bit mask, incl. the ignored bits -------------
test("loc_30de derives (0x80f6)/(0x8107) = 0x07 - ((0x8028) & 0x06)", () => {
  const cases = [
    [0x00, 0x00, 0x07],
    [0x02, 0x02, 0x05],
    [0x04, 0x04, 0x03],
    [0x06, 0x06, 0x01],
    [0x01, 0x00, 0x07], // bit0 set but masked out -> same as 0x00
    [0x08, 0x00, 0x07], // bit3 set but masked out -> same as 0x00
    [0xff, 0x06, 0x01], // all bits -> mask 0x06 -> derived 0x01
  ];
  for (const [in8028, masked, derived] of cases) {
    const m = makeMachine();
    m.mem.write8(0x8028, in8028);
    loc_30de(m);
    assertGolden(m, masked, derived);
  }
});

// ---- MUTATION: a wrong (0x80f6) store (derived+1) must be caught -------------------
test("loc_30de MUTATION: corrupting the (0x80f6) store is caught by the derived assertion", () => {
  const m = makeMachine();
  const realWrite8 = m.mem.write8;
  // Land derived+1 at 0x80f6 on its (single) store; leave every other write alone.
  m.mem.write8 = (a, v) => realWrite8(a, a === 0x80f6 ? (v + 1) & 0xff : v);

  m.mem.write8(0x8028, 0x0a); // masked=0x02 -> derived should be 0x05, mutant lands 0x06
  loc_30de(m);

  assert.equal(m.mem.read8(0x80f6), 0x06, "mutant stored derived+1 at (0x80f6)");
  assert.equal(m.mem.read8(0x8107), 0x05, "(0x8107) still the true derived value");
  assert.throws(
    () => assertGolden(m, 0x02, 0x05),
    /\(0x80f6\)/,
    "the derived-byte golden assertion must fail on the mutant",
  );
});
