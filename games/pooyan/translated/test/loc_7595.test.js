// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_7595 (ROM 0x7595-0x7617): launch one object into a free slot.
// Two exits: `ret c` (slot occupied, normal return to loc_756d's loop) and the caller-skip
// `pop af`/`ret` (a launch happened -- discards loc_756d's in-loop return and returns to
// loc_756d's OWN caller). The spawn path delegates rst 0x20 (x2), loc_0c45 and loc_0x381e; the
// stub balances each pushed return and models the two lookups (A := 0x99, DE := 0xbeef).
//
// Run: node --test games/pooyan/translated/test/loc_7595.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7595 } from "../loc_7595.js";

const CALLER_RET = 0xabcd;  // loc_756d's caller
const LOOP_RET = 0x758d;    // loc_756d's in-loop return (what `pop af` discards)

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

// Spawn-path stub: balance the pushed return AND model the two delegated lookups so the stores
// downstream are assertable.
function installSpawnCalls(m) {
  m.call = (addr) => {
    m.calls.push(addr);
    m.regs.sp = (m.regs.sp + 2) & 0xffff;
    if (addr === 0x0020) m.regs.a = 0x99;      // rst 0x20 table lookup result
    if (addr === 0x0c45) m.regs.de = 0xbeef;   // loc_0c45 word lookup
    return undefined;
  };
}

// ── occupied slot -> ret c (fast path) ─────────────────────────────────────────────────────────
test("loc_7595: slot active (low bit of (ix+0)|(ix+1) set) -> ret c; 53 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = 0x8ae0;
  m.mem.write8(0x8ae0, 0x01); // (ix+0) bit0 set -> occupied

  loc_7595(m);

  assert.equal(m.tstates, 53, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret c to the loop");
  assert.deepEqual(m.calls, [], "no work when occupied");
  assert.deepEqual(m.pcSeq, [0x7598, 0x759b, 0x759c, CALLER_RET], "step boundaries");
});

test("loc_7595 MUTATION: `or (ix+1)` at 0x759b mis-charged 15T (not 19T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = 0x8ae0;
  m.mem.write8(0x8ae0, 0x01);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x759b ? 15 : c);

  loc_7595(m);

  assert.equal(m.tstates, 49, "mutation loses 4 T (19 -> 15)");
  assert.notEqual(m.tstates, 53, "golden T-state total catches the mutant");
});

// ── free slot, wave >= 2 -> full spawn + caller-skip double return ──────────────────────────────
function setupSpawn(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);   // loc_756d's caller (final ret target)
  m.push16(LOOP_RET);     // loc_756d's in-loop return (pop af discards this)
  installSpawnCalls(m);
  m.regs.ix = 0x8ae0;
  m.regs.iy = 0x8b70;
  m.mem.write8(0x8ae0, 0x00); // slot free
  m.mem.write8(0x8ae1, 0x00);
  m.mem.write8(0x892d, 0x02); // wave 2 -> IY record built
  m.mem.write8(0x8922, 0x03);
}

test("loc_7595: free slot, wave 2 -> spawn, delegations, caller-skip return; 651 T", () => {
  const m = makeMachine();
  setupSpawn(m);

  loc_7595(m);

  assert.equal(m.tstates, 651, "T total");
  assert.equal(m.pc, CALLER_RET, "caller-skip: returns to loc_756d's caller, not the loop");
  assert.equal(m.regs.af, LOOP_RET, "pop af swallowed loc_756d's in-loop return");
  assert.equal(m.regs.sp, 0x8780, "pop af + ret consumed both seated returns");
  assert.deepEqual(m.calls, [0x0020, 0x0c45, 0x0020, 0x381e], "delegation order");
  assert.equal(m.mem.read8(0x8ae0), 0x01, "(ix+0) marked active");
  assert.equal(m.mem.read8(0x8b87), 0x99, "(iy+0x17) = first rst 0x20 lookup");
  assert.equal(m.mem.read8(0x8b7c), 0xef, "(iy+0x0c) = loc_0c45 word low");
  assert.equal(m.mem.read8(0x8b7d), 0xbe, "(iy+0x0d) = loc_0c45 word high");
  assert.equal(m.mem.read8(0x8929), 0x99, "(0x8929) frame delay reseeded from rst 0x20");
  assert.equal(m.mem.read8(0x892d), 0x03, "wave counter advanced 2 -> 3");
  assert.equal(m.mem.read8(0x8b81), 0x0c, "(iy+0x11) = wave*4 = 12");
});

test("loc_7595 MUTATION: dropping the rst 0x20 step (both sites) loses 22 T", () => {
  const full = makeMachine();
  setupSpawn(full);
  loc_7595(full);

  const mut = makeMachine();
  setupSpawn(mut);
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x0020 ? 0 : c);
  loc_7595(mut);

  assert.equal(full.tstates - mut.tstates, 22, "two rst 0x20 steps contribute 11 T each");
});
