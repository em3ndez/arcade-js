// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_68ac (ROM 0x68ac, Pooyan) -- once-only (0x8f55 latch) tile-region
 * checksum + table dispatch. Sums a stride-0x20 region from 0x8402 into DE (E=low, D=carry count),
 * scanning columns until l&0x1f==0x1f, +3 to the next row, until h>=0x88; then matches E against the
 * 4-entry table at 0x68eb (no match -> tamper throw; 0x76d4 is data) and, on a match, D against the
 * paired entry (ret z, else tamper throw; 0x3829 is data -- cf. sibling loc_3278). The scan's control flow is fixed (data only feeds the sum/carry), so the
 * expected pcSeq+T are built by an INDEPENDENT replay derived from the disassembly, not from loc_68ac.js.
 * The mock's `call` POPS the pushed return (models a tail routine's ret) -- the stack tooth.
 *
 * Run: node --test games/pooyan/translated/test/loc_68ac.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_68ac } from "../loc_68ac.js";

const CALLER_RET = 0xabcd;
// The scan reads 0x8402..0x87fe, so the seated stack must sit clear of that window (else the pushed
// return address bytes land in the checksummed region).
const SP_BASE = 0x9000;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x68ac, pcSeq: [],
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
    // The tail routine's `ret` pops the return the seat/tail pushed -- model that pop so the stack
    // balances; a missing push16 then desyncs SP and the final ret/tail pops garbage.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = SP_BASE;
  m.push16(CALLER_RET);
}

// prologue (latch clear): ld hl,0x8f55; ld a,(hl); and a; ret nz nt; inc (hl); ld hl,0x8402; ld de,0.
const PRO_SEQ = [0x68af, 0x68b0, 0x68b1, 0x68b2, 0x68b3, 0x68b6, 0x68b9];
const PRO_T = 10 + 7 + 4 + 5 + 11 + 10 + 10;

// Independent replay of the accumulate scan (0x68b9..0x68d3), derived from the disassembly. Returns the
// emitted pcSeq, its T total, and the final E/D.
function simScan(ram) {
  const seq = []; let t = 0;
  const push = (a, c) => { seq.push(a); t += c; };
  let h = 0x84, l = 0x02, e = 0, d = 0;
  for (;;) {
    let a = ram[((h << 8) | l) & 0xffff];  push(0x68ba, 7); // ld a,(hl)
    const sum = a + e;                                       // add a,e
    const carry = sum > 0xff; a = sum & 0xff;  push(0x68bb, 4);
    e = a;  push(0x68bc, 4);                                 // ld e,a
    if (!carry) { push(0x68bf, 12); }                       // jr nc
    else { push(0x68be, 7); d = (d + 1) & 0xff; push(0x68bf, 4); } // inc d
    l = (l + 1) & 0xff;  push(0x68c0, 4);                    // inc l
    a = l;  push(0x68c1, 4);                                 // ld a,l
    a &= 0x1f;  push(0x68c3, 7);                             // and 0x1f
    const z1 = a === 0x1f;  push(0x68c5, 7);                 // cp 0x1f
    if (!z1) { push(0x68b9, 12); continue; }                // jr nz
    push(0x68c7, 7);
    a = l;  push(0x68c8, 4);                                 // ld a,l
    const s2 = a + 0x03; const c2 = s2 > 0xff; l = s2 & 0xff;  push(0x68ca, 7); // add a,0x03
    push(0x68cb, 4);                                         // ld l,a
    if (!c2) { push(0x68b9, 12); continue; }                // jr nc
    push(0x68cd, 7);
    h = (h + 1) & 0xff;  push(0x68ce, 4);                    // inc h
    a = h;  push(0x68cf, 4);                                 // ld a,h
    const cc = h < 0x88;  push(0x68d1, 7);                   // cp 0x88
    if (cc) { push(0x68b9, 12); continue; }                 // jr c
    push(0x68d3, 7);
    break;
  }
  return { seq, t, e, d };
}

// Independent replay of the table lookup (0x68d3..0x68e8), derived from the disassembly.
function simTable(ram, e, d) {
  const seq = []; let t = 0;
  const push = (a, c) => { seq.push(a); t += c; };
  push(0x68d6, 10); push(0x68d8, 7); push(0x68d9, 4);       // ld hl,0x68eb; ld b,4; ld a,e
  let hl = 0x68eb, b = 0x04; const ea = e & 0xff;
  let matched = false;
  for (;;) {
    const z = ea === ram[hl & 0xffff];  push(0x68da, 7);    // cp (hl)
    if (z) { push(0x68e2, 12); matched = true; break; }     // jr z
    push(0x68dc, 7);
    hl = (hl + 1) & 0xffff;  push(0x68dd, 6);               // inc hl
    b = (b - 1) & 0xff;
    if (b !== 0) { push(0x68d9, 13); continue; }            // djnz
    push(0x68df, 8);
    break;
  }
  if (!matched) { push(0x76d4, 10); return { seq, t, tail: "jp76d4" }; }
  const da = d & 0xff;
  for (;;) {
    push(0x68e3, 4);                                         // ld a,d
    hl = (hl + 1) & 0xffff;  push(0x68e4, 6);               // inc hl
    const z = da === ram[hl & 0xffff];  push(0x68e5, 7);    // cp (hl)
    if (z) { push(CALLER_RET, 11); return { seq, t, tail: "ret" }; } // ret z
    push(0x68e6, 5);
    b = (b - 1) & 0xff;
    if (b !== 0) { push(0x68e2, 13); continue; }            // djnz
    push(0x68e8, 8);
    break;
  }
  push(0x3829, 10);
  return { seq, t, tail: "jp3829" };
}

function runFull(m) {
  seatCaller(m);
  const scan = simScan(m.ram);
  const tbl = simTable(m.ram, scan.e, scan.d);
  loc_68ac(m);
  return { scan, tbl, expSeq: [...PRO_SEQ, ...scan.seq, ...tbl.seq], expT: PRO_T + scan.t + tbl.t };
}

test("loc_68ac Path 1: latch 0x8f55 set -> ret nz (no scan)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f55, 0x01);

  loc_68ac(m);

  assert.equal(m.tstates, 10 + 7 + 4 + 11, "ld hl + ld a + and a + ret nz taken");
  assert.deepEqual(m.pcSeq, [0x68af, 0x68b0, 0x68b1, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, SP_BASE);
  assert.equal(m.mem.read8(0x8f55), 0x01, "latch not re-incremented on the bail path");
});

test("loc_68ac Path 2: all-zero scan, E match idx0, D match -> ret z", () => {
  const m = makeMachine();
  const { tbl, expSeq, expT } = runFull(m); // table region is 0 -> E=0 hits idx0, D=0 hits idx0+1

  assert.equal(tbl.tail, "ret");
  assert.deepEqual(m.pcSeq, expSeq);
  assert.equal(m.tstates, expT);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, SP_BASE);
  assert.equal(m.mem.read8(0x8f55), 0x01, "latch set by inc (hl)");
});

test("loc_68ac Path 3: all-zero scan, no E match -> tamper throw (0x76d4 is data)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x68eb, 0x01); m.mem.write8(0x68ec, 0x02);
  m.mem.write8(0x68ed, 0x03); m.mem.write8(0x68ee, 0x04); // none equal E=0
  assert.throws(() => loc_68ac(m), /tamper checksum failed \(E no match\)/);
  assert.equal(m.mem.read8(0x8f55), 0x01, "latch set by inc (hl) before the trap");
  assert.deepEqual(m.calls, [], "no tail dispatch -- the trap throws, never jumps into data");
});

test("loc_68ac Path 4: all-zero scan, E match idx0, no D match -> tamper throw (0x3829 is data)", () => {
  const m = makeMachine();
  seatCaller(m);
  // ram[0x68eb]=0 -> E=0 matches idx0; the four D candidates are all nonzero.
  m.mem.write8(0x68ec, 0x11); m.mem.write8(0x68ed, 0x22);
  m.mem.write8(0x68ee, 0x33); m.mem.write8(0x68ef, 0x44);
  assert.throws(() => loc_68ac(m), /tamper checksum failed \(D no match\)/);
  assert.deepEqual(m.calls, [], "no tail dispatch -- the trap throws, never jumps into data");
});

test("loc_68ac Path 5: accumulate carry (inc d), E match idx2, D match -> ret z", () => {
  const m = makeMachine();
  m.mem.write8(0x8402, 0x80); m.mem.write8(0x8403, 0x80); // 0x80+0x80 -> carry: D=1, E=0
  m.mem.write8(0x68eb, 0xaa); m.mem.write8(0x68ec, 0xbb); // idx0/1 miss E=0
  m.mem.write8(0x68ed, 0x00);                              // idx2 hits E=0
  m.mem.write8(0x68ee, 0x01);                              // paired D entry hits D=1
  const { scan, tbl, expSeq, expT } = runFull(m);

  assert.equal(scan.d, 1, "one carry -> D incremented once");
  assert.equal(scan.e, 0, "0x80+0x80 wraps E to 0");
  assert.equal(tbl.tail, "ret");
  assert.deepEqual(m.pcSeq, expSeq);
  assert.equal(m.tstates, expT);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, SP_BASE);
});

test("loc_68ac MUTATION: prologue ld hl mis-charged 9T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x68af ? 9 : cycles);
  seatCaller(m);
  const scan = simScan(m.ram);
  const tbl = simTable(m.ram, scan.e, scan.d);
  const golden = PRO_T + scan.t + tbl.t;

  loc_68ac(m);

  assert.equal(m.tstates, golden - 1, "mutation loses 1 T");
  assert.throws(() => assert.equal(m.tstates, golden, "loc_68ac full T total"), /full T total/);
});
