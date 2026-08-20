// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_7960 (ROM 0x7960, Pooyan) -- the shared ROM-integrity + nibble-render
 * handler (called by loc_1b43 / loc_1b8c). rst 0x38 enqueues, a 0x5b-byte checksum over the 0x2901 table
 * folds into E,D (16-bit) and L,H (running, even IX only); a 4-byte mismatch tail-jumps to a trap. Two
 * bytes at 0x8a32|0x8a35 (per 0x880d) are split into nibbles down 0x862d (stride -0x20); rst 0x10 clears
 * 3 bytes; the first nonzero of 7 flags at 0x89e7 diverts to a second checksum (sum to a 0xc9 sentinel,
 * guard at 0x7a0b/0x7a0c, traps 0x07d0/0x1a85). The `jr nz,0x79d2` lands mid `dec ix` (dd 2b) so B's
 * last bit executes the bare 0x2b = `dec hl` -- an overlapping-instruction trick modelled exactly.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`): every
 * rst here (0x0038, 0x0010) reloads any register it needs afterward, and no callee writes a byte this
 * routine later reads, so `call` need not model callee side effects -- only the pop. Because it pops, a
 * call site that forgot its push16 desyncs the stack (the final ret/tail pop misses CALLER_RET) -- the
 * balance assertion then has teeth. A `ref()` reference simulator (address-keyed, independent of the
 * translation's control-flow shape) computes the golden pcSeq / T / calls / final PC for each scenario.
 *
 * TEETH: RET-path total is also pinned to the independently hand-summed 10182 T. MUTATION mis-charges
 * `add hl,de` (11 T) as 7 T -> both goldens catch it. POSITIVE CONTROL: a no-op'd push16 desyncs the
 * stack so the baseline-SP assertion throws (and the impl was hand-checked with a real push16 deleted).
 *
 * Run: node --test games/pooyan/translated/test/loc_7960.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7960 } from "../loc_7960.js";

const CALLER_RET = 0xabcd;
const SP_TOP = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x7960, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
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
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // The callee's `ret` pops the return address the call site pushed -- model that pop so the stack
    // stays balanced (a missing push16 at the call site then desyncs SP and fails the balance tooth).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = SP_TOP;
  m.push16(CALLER_RET);
}

// ── reference model: address-keyed replay of the routine, independent of the translation's shape ──
// Returns { seq, t, calls, finalPc } for the given RAM. Faithfully computes the checksum carries so the
// branch sequence is data-driven. `caller` is where the terminal `ret` lands.
function ref(ram, caller) {
  const seq = [];
  let t = 0;
  const calls = [];
  const r8 = (a) => ram[a & 0xffff];
  const st = (a, c) => { seq.push(a); t += c; };
  const done = (pc) => ({ seq, t, calls, finalPc: pc });

  st(0x7963, 10);                                   // ld de,0x0609
  calls.push(0x0038); st(0x0038, 11);               // rst 0x38
  st(0x7968, 14);                                   // ld ix,0x2901
  st(0x796b, 10);                                   // ld hl,0
  st(0x796c, 4); st(0x796d, 4);                     // ld e,l ; ld d,e
  st(0x796f, 7);                                    // ld b,0x5b

  let e = 0, d = 0, l = 0, h = 0, ix = 0x2901;
  for (let i = 0; i < 0x5b; i++) {
    st(0x7972, 19);
    let a = r8(ix);
    let s = a + e; a = s & 0xff; st(0x7973, 4);
    e = a; st(0x7974, 4);
    if (s <= 0xff) { st(0x7977, 12); }
    else { st(0x7976, 7); d = (d + 1) & 0xff; st(0x7977, 4); }
    const c = a; st(0x7978, 4);
    st(0x797a, 8);                                  // ld a,ixl
    st(0x797c, 7);                                  // and 0x01
    if (ix & 1) { st(0x7984, 12); }
    else {
      st(0x797e, 7);
      a = c; st(0x797f, 4);
      let s2 = a + l; a = s2 & 0xff; st(0x7980, 4);
      l = a; st(0x7981, 4);
      if (s2 <= 0xff) { st(0x7984, 12); }
      else { st(0x7983, 7); h = (h + 1) & 0xff; st(0x7984, 4); }
    }
    ix = (ix + 1) & 0xffff; st(0x7986, 10);
    if (i < 0x5a) st(0x796f, 13); else st(0x7988, 8);
  }

  st(0x7989, 4); st(0x798c, 19);                    // ld a,e ; cp (ix+0)
  if (e !== r8(ix)) { calls.push(0x7a0b); st(0x7a0b, 10); return done(0x7a0b); }
  st(0x798f, 10);
  st(0x7990, 4); st(0x7993, 19);                    // ld a,d ; cp (ix+1)
  if (d !== r8(ix + 1)) { calls.push(0x0fa0); st(0x0fa0, 10); return done(0x0fa0); }
  st(0x7996, 10);
  st(0x7997, 4); st(0x799a, 19);                    // ld a,l ; cp (ix+2)
  if (l !== r8(ix + 2)) { calls.push(0x1388); st(0x1388, 10); return done(0x1388); }
  st(0x799d, 10);
  st(0x799e, 4); st(0x79a1, 19);                    // ld a,h ; cp (ix+3)
  if (h !== r8(ix + 3)) { calls.push(0x1770); st(0x1770, 10); return done(0x1770); }
  st(0x79a4, 10);

  const sel = r8(0x880d);
  st(0x79a7, 13); st(0x79a8, 4); st(0x79ac, 14);    // ld a,(880d) ; and a ; ld ix,0x8a32
  if (sel === 0) { st(0x79b1, 12); }
  else { st(0x79ae, 7); st(0x79b1, 11); }           // ld ixl,0x35
  st(0x79b4, 10); st(0x79b7, 10); st(0x79b9, 7);    // ld hl,862d ; ld de,ffe0 ; ld b,2
  for (let it = 0, b = 2; it < 2; it++) {
    st(0x79bc, 19); st(0x79bd, 4); st(0x79bf, 7);
    st(0x79c0, 4); st(0x79c1, 4); st(0x79c2, 4); st(0x79c3, 4);
    st(0x79c4, 7); st(0x79c5, 11); st(0x79c6, 4); st(0x79c8, 7); st(0x79c9, 7); st(0x79ca, 11);
    st(0x79cc, 8);                                  // bit 0,b
    if (b & 1) { st(0x79d2, 12); st(0x79d3, 6); }   // jr nz -> dec hl (overlap)
    else { st(0x79ce, 7); st(0x79d0, 10); st(0x79d1, 11); st(0x79d3, 10); }
    b = (b - 1) & 0xff;
    if (b !== 0) st(0x79b9, 13); else st(0x79d5, 8);
  }

  st(0x79d7, 15); st(0x79d8, 10); st(0x79d9, 4); st(0x79db, 7); // push ix ; pop hl ; xor a ; ld b,3
  calls.push(0x0010); st(0x0010, 11);               // rst 0x10
  st(0x79df, 10); st(0x79e1, 7);                    // ld hl,89e7 ; ld b,7

  let hl = 0x89e7, toTail = false;
  for (let it = 0, b = 7; it < 7; it++) {
    const byte = r8(hl);
    st(0x79e2, 7); st(0x79e3, 4);                   // ld a,(hl) ; and a
    if (byte !== 0) { st(0x79ef, 12); toTail = true; break; }
    st(0x79e5, 7); hl = (hl + 1) & 0xffff; st(0x79e6, 6);
    b = (b - 1) & 0xff;
    if (b !== 0) st(0x79e1, 13); else st(0x79e8, 8);
  }
  if (!toTail) { st(caller, 10); return done(caller); } // 0x79e8 ret

  // tail: DE = 0xffe0 left by the render (E=0xe0, D=0xff), sum until 0xc9
  e = 0xe0; d = 0xff;
  for (;;) {
    let a = r8(hl);
    st(0x79f0, 7); st(0x79f2, 7);                   // ld a,(hl) ; cp 0xc9
    if (a === 0xc9) { st(0x79fc, 12); break; }
    st(0x79f4, 7);
    let s = a + e; a = s & 0xff; st(0x79f5, 4);      // add a,e
    if (s <= 0xff) { st(0x79f8, 12); }
    else { st(0x79f7, 7); d = (d + 1) & 0xff; st(0x79f8, 4); }
    e = a; st(0x79f9, 4); hl = (hl + 1) & 0xffff; st(0x79fa, 6);
    st(0x79ef, 12);                                 // jr 0x79ef
  }
  st(0x79ff, 10); st(0x7a00, 4); st(0x7a01, 7);          // ld hl,7a0b ; ld a,e ; cp (hl)
  if (e !== r8(0x7a0b)) { calls.push(0x07d0); st(0x07d0, 10); return done(0x07d0); }
  st(0x7a04, 10); st(0x7a05, 4); st(0x7a06, 6); st(0x7a07, 7); // jp-nc ; ld a,d ; inc hl ; cp (hl)
  if (d !== r8(0x7a0c)) { calls.push(0x1a85); st(0x1a85, 10); return done(0x1a85); }
  st(0x7a0a, 10); st(caller, 10);                   // fall to 0x7a0a ret
  return done(caller);
}

function baseTable(ram) {
  // all-zero 0x5b-byte table at 0x2901 -> E=D=L=H=0; guards 0x295c..0x295f = 0 pass all 4 checks
  for (let a = 0x2901; a <= 0x295f; a++) ram[a] = 0x00;
}

test("loc_7960 RET path: checksum ok, all 7 flags zero -> ret at 0x79e8", () => {
  const m = makeMachine();
  seatCaller(m);
  baseTable(m.ram);
  m.mem.write8(0x880d, 0x00);        // sel 0 -> IX stays 0x8a32 (jr z taken)
  m.mem.write8(0x8a32, 0x3a);        // nibble source hi byte
  m.mem.write8(0x8a31, 0x7c);        // nibble source lo byte
  // 0x89e7..0x89ed all zero -> scan runs all 7 iters then returns

  loc_7960(m);

  const g = ref(m.ram, CALLER_RET);
  assert.equal(m.tstates, 10182, "RET-path T pinned to the hand-summed total");
  assert.equal(m.tstates, g.t, "RET-path T matches the reference model");
  assert.deepEqual(m.pcSeq, g.seq, "RET-path pcSeq matches the reference model");
  assert.equal(m.pc, CALLER_RET, "ret at 0x79e8 lands on the seated caller");
  assert.deepEqual(m.calls, [0x0038, 0x0010], "rst 0x38 then rst 0x10, no traps");
  assert.deepEqual(m.calls, g.calls);
  // nibble writes down 0x862d (stride -0x20): 0x8a32=0x3a -> hi 3 @0x862d, lo a @0x860d, 0x51 @0x85ed;
  // 0x8a31=0x7c -> hi 7 @0x85cd, lo c @0x85ad; final row takes the overlapping `dec hl` (no 0x51)
  assert.equal(m.mem.read8(0x862d), 0x03);
  assert.equal(m.mem.read8(0x860d), 0x0a);
  assert.equal(m.mem.read8(0x85ed), 0x51);
  assert.equal(m.mem.read8(0x85cd), 0x07);
  assert.equal(m.mem.read8(0x85ad), 0x0c);
  assert.equal(m.mem.read8(0x858d), 0x00, "no second 0x51 spacer on B's last bit");
  assert.equal(m.regs.sp, SP_TOP, "stack fully unwound (every push16 matched a callee ret/final ret)");
});

test("loc_7960 phase-1 carry: 0xff table folds carries (inc d/inc h), guard mismatch -> trap 0x7a0b throws", () => {
  const m = makeMachine();
  seatCaller(m);
  for (let a = 0x2901; a <= 0x295b; a++) m.ram[a] = 0xff; // carrying table
  for (let a = 0x295c; a <= 0x295f; a++) m.ram[a] = 0x00; // guard != real E -> trap at check 1

  assert.throws(() => loc_7960(m), /trap 0x7a0b/, "checksum-E mismatch fires the anti-tamper trap");

  const g = ref(m.ram, CALLER_RET);
  // sanity: some inc-d carry actually happened in the reference (D != 0 for a 91*0xff sum)
  assert.ok(g.seq.includes(0x7976), "the E-carry (inc d) branch was taken at least once");
  assert.ok(g.seq.includes(0x7983), "the L-carry (inc h) branch was taken at least once");
});

for (const [name, badAddr, target] of [
  ["D", 0x295d, 0x0fa0],
  ["L", 0x295e, 0x1388],
  ["H", 0x295f, 0x1770],
]) {
  test(`loc_7960 phase-1 trap: ${name} byte mismatch -> throws ${target.toString(16)}`, () => {
    const m = makeMachine();
    seatCaller(m);
    baseTable(m.ram);
    m.mem.write8(badAddr, 0x01);     // earlier checks pass (0), this one fails
    assert.throws(() => loc_7960(m), new RegExp(`trap 0x${target.toString(16).padStart(4, "0")}`));
  });
}

test("loc_7960 TAIL-RET path: sel!=0 (ixl=0x35), flag set -> tail sum matches guard -> ret at 0x7a0a", () => {
  const m = makeMachine();
  seatCaller(m);
  baseTable(m.ram);
  m.mem.write8(0x880d, 0x01);        // sel != 0 -> jr z NOT taken, ld ixl,0x35 (IX=0x8a35)
  m.mem.write8(0x89e7, 0x05);        // first flag nonzero -> scan diverts to tail immediately
  m.mem.write8(0x89e8, 0x30);        // tail byte forcing add-a,e carry (inc d)
  m.mem.write8(0x89e9, 0xc9);        // 0xc9 sentinel ends the tail sum
  // tail: E starts 0xe0. 0x05 -> 0xe5 (no carry). 0x30 -> 0x115 -> E=0x15, D: 0xff->0x00 (inc d).
  m.mem.write8(0x7a0b, 0x15);        // guard E matches -> jp nz 0x07d0 not taken
  m.mem.write8(0x7a0c, 0x00);        // guard D matches -> jp nz 0x1a85 not taken -> ret

  loc_7960(m);

  const g = ref(m.ram, CALLER_RET);
  assert.deepEqual(m.pcSeq, g.seq, "tail pcSeq (jr nc taken + inc-d carry both exercised)");
  assert.equal(m.tstates, g.t);
  assert.equal(m.pc, CALLER_RET, "ret at 0x7a0a to the seated caller");
  assert.deepEqual(m.calls, [0x0038, 0x0010], "no tail trap taken");
  assert.ok(g.seq.includes(0x79f7), "tail E-carry (inc d) exercised");
  assert.ok(g.seq.includes(0x79f8), "tail no-carry path exercised");
  assert.equal(m.regs.sp, SP_TOP, "stack unwound to baseline");
});

test("loc_7960 TAIL trap: E mismatch -> throws 0x07d0", () => {
  const m = makeMachine();
  seatCaller(m);
  baseTable(m.ram);
  m.mem.write8(0x880d, 0x00);
  m.mem.write8(0x89e7, 0x05);
  m.mem.write8(0x89e8, 0x30);
  m.mem.write8(0x89e9, 0xc9);
  m.mem.write8(0x7a0b, 0x00);        // E(=0x15) != guard -> 0x07d0
  m.mem.write8(0x7a0c, 0x00);

  assert.throws(() => loc_7960(m), /trap 0x07d0/);
});

test("loc_7960 TAIL: D mismatch -> tail-jump 0x1a85 (registered m.call, unchanged)", () => {
  const m = makeMachine();
  seatCaller(m);
  baseTable(m.ram);
  m.mem.write8(0x880d, 0x00);
  m.mem.write8(0x89e7, 0x05);
  m.mem.write8(0x89e8, 0x30);
  m.mem.write8(0x89e9, 0xc9);
  m.mem.write8(0x7a0b, 0x15);        // E matches, jp nz 0x07d0 not taken
  m.mem.write8(0x7a0c, 0x01);        // D(=0x00) != guard -> 0x1a85

  loc_7960(m);

  const g = ref(m.ram, CALLER_RET);
  assert.deepEqual(m.pcSeq, g.seq);
  assert.equal(m.tstates, g.t);
  assert.equal(m.pc, 0x1a85);
  assert.deepEqual(m.calls, [0x0038, 0x0010, 0x1a85]);
  assert.equal(m.regs.sp, SP_TOP, "tail-jump unwinds to baseline");
});

test("loc_7960 MUTATION: `add hl,de` mis-charged 7T (not 11T) is caught by both goldens", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x79c5 ? 7 : cycles);
  seatCaller(m);
  baseTable(m.ram);
  m.mem.write8(0x880d, 0x00);

  loc_7960(m);

  // 0x79c5 (`add hl,de`) is stepped on both render rows of the RET path -> loses 4 T x2 = 8 T
  assert.equal(m.tstates, 10174, "mutation loses 8 T (11 -> 7, twice)");
  assert.throws(() => assert.equal(m.tstates, 10182), /10182/, "the 10182-T golden must fail on the mutant");
});

test("loc_7960 POSITIVE CONTROL: a no-op'd push16 desyncs the stack -> baseline-SP assert throws", () => {
  const m = makeMachine();
  seatCaller(m);                     // seat CALLER_RET with the real push16 first
  m.push16 = () => {};               // then drop the routine's push16s -> each callee `pop` underflows
  baseTable(m.ram);
  m.mem.write8(0x880d, 0x00);

  loc_7960(m);

  assert.throws(
    () => assert.equal(m.regs.sp, SP_TOP, "baseline"),
    "with push16 suppressed the stack cannot return to baseline",
  );
});
