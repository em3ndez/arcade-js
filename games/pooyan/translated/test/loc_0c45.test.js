// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for the loc_0c45 cluster (ROM 0x0c45-0x0cf7): the word-lookup helper loc_0c45,
// the state dispatcher loc_0c4e, and dispatch handlers loc_0c5c (state 0) and loc_0c77 (state 1).
//
// Self-contained mock machine (real Regs for exact flags, flat 64K RAM, step/call/ret/push16/pop16
// mirroring the pooyan Machine). Every exit is a `ret`, so the caller's return address is seated on
// the stack and the final PC proves which exit fired. Delegated calls are recorded in m.calls; a
// returning callee is stubbed to balance its pushed return (SP += 2), and rst 0x10 (loc_0010) also
// advances HL by B and zeroes B (its memset side effect) so the (0x880b) store can be asserted.
//
// Run: node --test games/pooyan/translated/test/loc_0c45.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0c45, loc_0c4e, loc_0c5c, loc_0c77 } from "../loc_0c45.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only (tail dispatch); no balance
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// A returning-callee stub: balances the pushed return (SP += 2); rst 0x10 also runs its memset side
// effect on HL/B. Install on tests whose routine makes mid-body `call`/`rst 0x10`/`rst 0x38`.
function installBalancingCalls(m) {
  m.call = (addr) => {
    m.calls.push(addr);
    m.regs.sp = (m.regs.sp + 2) & 0xffff;
    if (addr === 0x0010) { m.regs.hl = (m.regs.hl + m.regs.b) & 0xffff; m.regs.b = 0; }
    return undefined;
  };
}

// ── loc_0c45: word-table lookup helper ────────────────────────────────────────────────────────
test("loc_0c45: A=3, HL=0x8900 -> DE = table[3] word, HL advanced; 56 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 3;
  m.regs.hl = 0x8900;
  m.mem.write16(0x8906, 0xbeef); // table[3] at base + 2*3

  loc_0c45(m);

  assert.equal(m.tstates, 56, "loc_0c45 T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.regs.de, 0xbeef, "DE = table[3]");
  assert.equal(m.regs.a, 6, "A = index*2");
  assert.equal(m.regs.hl, 0x8907, "HL = base + 2*index + 1");
  assert.deepEqual(m.pcSeq,
    [0x0c46, 0x0c48, 0x0c49, 0x0c4a, 0x0c4b, 0x0c4c, 0x0c4d, CALLER_RET],
    "step boundaries");
});

test("loc_0c45 MUTATION: `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 3;
  m.regs.hl = 0x8900;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0c4a ? 7 : c);
  loc_0c45(m);
  assert.equal(m.tstates, 52, "mutation loses 4 T (11 -> 7)");
  assert.notEqual(m.tstates, 56, "golden T-state total catches the mutant");
});

// ── loc_0c4e: state dispatcher -- pushes 0x0d78, dispatches via loc_0028, then continues at 0x0d78 ──
test("loc_0c4e: pushes 0x0d78, dispatches loc_0028, continues at 0x0d78, rets to caller; balanced; 45 T", () => {
  const m = makeMachine();
  seatCaller(m); // CALLER_RET stands in for the NMI epilogue 0x06fa loc_066d pushed

  // loc_0028 is the rst-0x28 tail dispatcher: it pops the table base (0x0c56) AND the dispatched state
  // handler ret's popping the 0x0d78 loc_0c4e pushed -- net SP += 4 -- landing control at 0x0d78.
  // 0x0d78 is loc_0c4e's continuation, which rets to the caller (0x06fa).
  m.call = (addr) => {
    m.calls.push(addr);
    if (addr === 0x0028) { m.regs.sp = (m.regs.sp + 4) & 0xffff; m.step(0x0d78, 0); }
    else { m.ret(0); } // 0x0d78 continuation rets to the caller
    return undefined;
  };
  m.mem.write8(0x880a, 1); // state 1

  loc_0c4e(m);

  assert.equal(m.tstates, 45, "loc_0c4e T-state total (own instrs; the mock charges 0)");
  assert.deepEqual(m.calls, [0x0028, 0x0d78], "dispatch, then the 0x0d78 continuation");
  assert.equal(m.pc, CALLER_RET, "the 0x0d78 continuation rets to loc_0c4e's caller (0x06fa)");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline -- the continuation consumes the caller return");
  assert.deepEqual(m.pcSeq, [0x0c51, 0x0c52, 0x0c55, 0x0028, 0x0d78, CALLER_RET], "step boundaries");
});

// ── loc_0c5c: state 0 -- clear scratch, seat pointer, bump state, call 0x02b9 ──────────────────
test("loc_0c5c: clears scratch, seats 0x8442, bumps (0x880a), delegates 0x02b9; 133 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x880a, 0x05); // state -> 0x06

  loc_0c5c(m);

  assert.equal(m.tstates, 133, "loc_0c5c T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "call push balanced, ret popped the caller");
  assert.deepEqual(m.calls, [0x02b9], "delegates to 0x02b9");
  assert.equal(m.mem.read8(0x8819), 0x00, "(0x8819) cleared");
  assert.equal(m.mem.read8(0x8806), 0x00, "(0x8806) cleared");
  assert.equal(m.mem.read16(0x880b), 0x8442, "(0x880b) = tile pointer 0x8442");
  assert.equal(m.mem.read8(0x8809), 0x0f, "(0x8809) = 0x0f countdown seed");
  assert.equal(m.mem.read8(0x880a), 0x06, "(0x880a) state incremented");
  assert.deepEqual(m.pcSeq,
    [0x0c5d, 0x0c60, 0x0c63, 0x0c66, 0x0c69, 0x0c6c, 0x0c6f, 0x0c71, 0x0c72, 0x0c73, 0x02b9, CALLER_RET],
    "step boundaries");
});

// ── loc_0c77 Path 1: (0x8809) countdown not yet zero -> two fills then `ret nz` ───────────────
function setupC77Path1(m) {
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write16(0x880b, 0x8442); // fill destination pointer
  m.mem.write8(0x8809, 0x0f);    // dec -> 0x0e (non-zero) -> ret nz
}

function assertC77Path1(m) {
  assert.equal(m.tstates, 139, "loc_0c77 Path 1 T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.equal(m.regs.sp, 0x8780, "both rst 0x10 pushes balanced");
  assert.deepEqual(m.calls, [0x0010, 0x0010], "two rst 0x10 memsets");
  assert.equal(m.mem.read16(0x880b), 0x8482, "(0x880b) = 0x8442 + 0x1d + 3 + 0x1d + 3");
  assert.equal(m.mem.read8(0x8809), 0x0e, "(0x8809) decremented, still non-zero");
  assert.equal(m.regs.b, 0x00, "B = 0 after the second memset");
}

test("loc_0c77 Path 1: countdown non-zero -> two fills, HL advanced, ret nz; 139 T", () => {
  const m = makeMachine();
  setupC77Path1(m);
  loc_0c77(m);
  assertC77Path1(m);
  assert.deepEqual(m.pcSeq,
    [0x0c7a, 0x0c7c, 0x0c7e, 0x0010, 0x0c82, 0x0c83, 0x0c85, 0x0010, 0x0c87, 0x0c8a, 0x0c8d, 0x0c8e, CALLER_RET],
    "Path 1 step boundaries");
});

test("loc_0c77 MUTATION: `ld hl,(0x880b)` mis-charged 10T (not 16T) is caught", () => {
  const m = makeMachine();
  setupC77Path1(m);
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (n, c) => { if (first && n === 0x0c7a) { first = false; return realStep(n, 10); } return realStep(n, c); };
  loc_0c77(m);
  assert.equal(m.tstates, 133, "mutation loses 6 T (16 -> 10)");
  assert.throws(() => assertC77Path1(m), /Path 1 T-state total/, "golden T-state assertion catches the mutant");
});

// ── loc_0c77 Path 2: countdown hits 0 -> the 256-byte ROM-checksum loop (off boot/attract path) ──
// Craft a terminating sum: A starts 0xC1 (byte @0x0779); 24 bytes of 0x80 give 12 carries and return
// A to 0xC1; the rest are 0x00 -> after 256 adds A==0xC1 && C==0x0C, so it breaks in one pass.
function setupC77Checksum(m) {
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write16(0x880b, 0x8442);
  m.mem.write8(0x8809, 0x01);   // dec -> 0 -> falls through the `ret nz` into the checksum
  m.mem.write8(0x0779, 0xc1);
  for (let i = 0; i < 24; i++) m.mem.write8(0x077a + i, 0x80);
}

test("loc_0c77 Path 2: 256-iteration checksum loop; the add-step is present and timed", () => {
  const full = makeMachine();
  setupC77Checksum(full);
  loc_0c77(full);
  const addLandings = full.pcSeq.filter((p) => p === 0x0c9a).length;
  assert.equal(addLandings, 256, "`add a,(hl)` lands at 0x0c9a once per iteration -- the step fires");

  // MUTATION: a MISSING `m.step(0x0c9a, 7)` (the real defect) drops 256*7 = 1792 T with no value change.
  const mut = makeMachine();
  setupC77Checksum(mut);
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x0c9a ? 0 : c);
  loc_0c77(mut);
  assert.equal(full.tstates - mut.tstates, 1792, "the 256 add steps contribute 1792 T; a dropped step is caught");
});
