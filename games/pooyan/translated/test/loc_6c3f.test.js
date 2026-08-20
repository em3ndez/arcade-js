// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6c3f (ROM 0x6c3f, Pooyan) -- the ix/iy proximity test.
 * Gated on bit0 of (hl); computes |x-delta| (must be < 0x18) and |y-delta| (must be < 0x0e) from
 * the two records, then on a hit marks 0x8d54, sets an above/below indicator on 0x8a87 chosen from
 * (ix+2) and the y-sign, writes 0x8d52/0x8d53, and returns TWO levels up (pop af drops its own
 * return address, so the closing `ret` reaches the caller's caller -- bailing loc_6c18's scan loop).
 *
 * The mock models a two-deep stack: GRANDPARENT_RET then OWN_RET on top. A normal `ret` (gate/band
 * fails) pops OWN_RET and leaves GRANDPARENT_RET seated (sp = 0x877e); a `pop af; ret` hit path pops
 * both and unwinds to the pre-seat baseline (sp = 0x8780) -- the stack-fidelity tooth. The routine
 * has no calls, so the mock's popping `call` is present for template shape but never exercised.
 *
 * Paths: A gate-closed; B x-band-fail (exercises the neg branch); C y-band-fail (non-neg branch);
 * D hit y>=0,(ix+2)>=0x51 (indicator "above", no tail write); E hit y>=0,(ix+2)<0x51 ("below" via
 * block 0x6c93, C=2); F hit y<0,(ix+2)>=0xb6 ("above" C=1); G hit y<0,(ix+2)<0x51 ("below" via
 * 0x6c9b->0x6c93); H hit y<0,0x51<=(ix+2)<0xb6 ("below" terminal 0x6c9f, no tail write).
 * MUTATION: mis-charge `bit 0,(hl)` (12 T) as 8 T -> the 23-T golden of path A must fail.
 *
 * Run: node --test games/pooyan/translated/test/loc_6c3f.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6c3f } from "../loc_6c3f.js";

const OWN_RET = 0x6c28;         // return address the `call 0x6c3f` at 0x6c25 pushed
const GRANDPARENT_RET = 0x9999; // loc_6c18's own return, seated below
const BASELINE = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6c3f, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
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
    ret(c = 10) { this.step(this.pop16(), c); },
    // A callee's `ret` pops whatever the call site pushed -- model the pop (unused here: loc_6c3f
    // issues no calls, but keeping the popping mock keeps a missing-push16 bug detectable by shape).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

// Seat GRANDPARENT_RET then OWN_RET; ix=0x8840, iy=0x887c, hl=0x8be8 (bit0 gate) as loc_6c18 sets up.
function seat(m) {
  m.regs.sp = BASELINE;
  m.push16(GRANDPARENT_RET);
  m.push16(OWN_RET);
  m.regs.ix = 0x8840;
  m.regs.iy = 0x887c;
  m.regs.hl = 0x8be8;
  m.mem.write8(0x8be8, 0x01); // gate open by default
}

test("loc_6c3f A: bit0 of (hl) clear -> ret z to OWN_RET", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8be8, 0x00);

  loc_6c3f(m);

  assert.equal(m.tstates, 23, "bit 0,(hl) 12 + ret z 11");
  assert.deepEqual(m.pcSeq, [0x6c41, OWN_RET]);
  assert.equal(m.pc, OWN_RET, "normal ret to own caller");
  assert.equal(m.regs.sp, BASELINE - 2, "OWN_RET consumed, GRANDPARENT still seated");
  assert.equal(m.mem.read8(0x8d54), 0x00, "no hit recorded");
});

test("loc_6c3f B: |x-delta| >= 0x18 -> ret nc (neg branch)", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8840, 0x80); // ix+0
  m.mem.write8(0x887c, 0x00); // iy+0 -> x-delta = 0x20 - 0x90 = negative, |.| = 0x70

  loc_6c3f(m);

  assert.equal(m.tstates, 148, "x-band fail via neg");
  assert.deepEqual(m.pcSeq, [
    0x6c41, 0x6c42, 0x6c44, 0x6c46, 0x6c49, 0x6c4a, 0x6c4b, 0x6c4e, 0x6c4f, 0x6c50,
    0x6c53, 0x6c55, 0x6c56, 0x6c58, 0x6c5a, 0x6c5c, OWN_RET,
  ], "neg at 0x6c58 then ret nc at 0x6c5c");
  assert.equal(m.pc, OWN_RET);
  assert.equal(m.regs.sp, BASELINE - 2);
  assert.equal(m.mem.read8(0x8d54), 0x00);
});

test("loc_6c3f C: |y-delta| >= 0x0e -> ret nc (non-neg branch)", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8840, 0x50); m.mem.write8(0x887c, 0x50); // x-delta = 0x10 (in band)
  m.mem.write8(0x8842, 0x00); m.mem.write8(0x887e, 0x20); // y-delta = 0x28 (out of band, no neg)

  loc_6c3f(m);

  assert.equal(m.tstates, 206, "y-band fail, jr nc taken (no neg)");
  assert.deepEqual(m.pcSeq, [
    0x6c41, 0x6c42, 0x6c44, 0x6c46, 0x6c49, 0x6c4a, 0x6c4b, 0x6c4e, 0x6c4f, 0x6c50,
    0x6c53, 0x6c55, 0x6c56, 0x6c5a, 0x6c5c, 0x6c5d, 0x6c5f, 0x6c62, 0x6c64, 0x6c65,
    0x6c6b, 0x6c6d, OWN_RET,
  ], "jr nc at 0x6c65 taken -> 0x6c6b, ret nc at 0x6c6d");
  assert.equal(m.pc, OWN_RET);
  assert.equal(m.regs.sp, BASELINE - 2);
  assert.equal(m.mem.read8(0x8d54), 0x00);
});

test("loc_6c3f D: hit, y>=0, (ix+2)>=0x51 -> above (0x6ca5), pop-af ret to grandparent", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8840, 0x50); m.mem.write8(0x887c, 0x50); // x-delta 0x10
  m.mem.write8(0x8842, 0x60); m.mem.write8(0x887e, 0x60); // (ix+2)=0x60, y-delta 8 (>=0)
  m.mem.write8(0x8a87, 0x08);                              // bit3 pre-set to prove res3 clears it

  loc_6c3f(m);

  assert.equal(m.tstates, 334);
  assert.deepEqual(m.pcSeq, [
    0x6c41, 0x6c42, 0x6c44, 0x6c46, 0x6c49, 0x6c4a, 0x6c4b, 0x6c4e, 0x6c4f, 0x6c50,
    0x6c53, 0x6c55, 0x6c56, 0x6c5a, 0x6c5c, 0x6c5d, 0x6c5f, 0x6c62, 0x6c64, 0x6c65,
    0x6c6b, 0x6c6d, 0x6c6e, 0x6c71, 0x6c73, 0x6c76, 0x6c79, 0x6c7a, 0x6c8f, 0x6c91,
    0x6ca5, 0x6ca7, 0x6ca9, 0x6caa, GRANDPARENT_RET,
  ]);
  assert.equal(m.pc, GRANDPARENT_RET, "pop af drops OWN_RET, ret reaches grandparent");
  assert.equal(m.regs.sp, BASELINE, "stack fully unwound (both returns consumed)");
  assert.equal(m.mem.read8(0x8d54), 0x01);
  assert.equal(m.mem.read8(0x8a87), 0x04, "bit2 set, bit3 cleared");
  assert.equal(m.mem.read8(0x8d52), 0x00, "no tail write on the 0x6ca5 path");
  assert.equal(m.mem.read8(0x8d53), 0x00);
});

test("loc_6c3f E: hit, y>=0, (ix+2)<0x51 -> below via 0x6c93, C=2, shared tail", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8840, 0x50); m.mem.write8(0x887c, 0x50);
  m.mem.write8(0x8842, 0x40); m.mem.write8(0x887e, 0x40); // (ix+2)=0x40, y-delta 8
  m.mem.write8(0x8a87, 0x04);                              // bit2 pre-set to prove res2 clears it

  loc_6c3f(m);

  assert.equal(m.tstates, 379);
  assert.deepEqual(m.pcSeq, [
    0x6c41, 0x6c42, 0x6c44, 0x6c46, 0x6c49, 0x6c4a, 0x6c4b, 0x6c4e, 0x6c4f, 0x6c50,
    0x6c53, 0x6c55, 0x6c56, 0x6c5a, 0x6c5c, 0x6c5d, 0x6c5f, 0x6c62, 0x6c64, 0x6c65,
    0x6c6b, 0x6c6d, 0x6c6e, 0x6c71, 0x6c73, 0x6c76, 0x6c79, 0x6c7a, 0x6c8f, 0x6c91,
    0x6c93, 0x6c95, 0x6c97, 0x6c99, 0x6c86, 0x6c89, 0x6c8a, 0x6c8b, 0x6c8d, 0x6c8e,
    GRANDPARENT_RET,
  ]);
  assert.equal(m.pc, GRANDPARENT_RET);
  assert.equal(m.regs.sp, BASELINE);
  assert.equal(m.mem.read8(0x8d54), 0x01);
  assert.equal(m.mem.read8(0x8a87), 0x08, "bit3 set, bit2 cleared");
  assert.equal(m.mem.read8(0x8d52), 0x02, "C=2 written to 0x8d52");
  assert.equal(m.mem.read8(0x8d53), 0x18);
});

test("loc_6c3f F: hit, y<0, (ix+2)>=0xb6 -> above (0x6c80), C=1, shared tail", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8840, 0x50); m.mem.write8(0x887c, 0x50);
  m.mem.write8(0x8842, 0xc0); m.mem.write8(0x887e, 0xb0); // (ix+2)=0xc0, y-delta = -8
  m.mem.write8(0x8a87, 0x08);

  loc_6c3f(m);

  assert.equal(m.tstates, 372);
  assert.deepEqual(m.pcSeq, [
    0x6c41, 0x6c42, 0x6c44, 0x6c46, 0x6c49, 0x6c4a, 0x6c4b, 0x6c4e, 0x6c4f, 0x6c50,
    0x6c53, 0x6c55, 0x6c56, 0x6c5a, 0x6c5c, 0x6c5d, 0x6c5f, 0x6c62, 0x6c64, 0x6c65,
    0x6c67, 0x6c69, 0x6c6b, 0x6c6d, 0x6c6e, 0x6c71, 0x6c73, 0x6c76, 0x6c79, 0x6c7a,
    0x6c7c, 0x6c7e, 0x6c80, 0x6c82, 0x6c84, 0x6c86, 0x6c89, 0x6c8a, 0x6c8b, 0x6c8d,
    0x6c8e, GRANDPARENT_RET,
  ]);
  assert.equal(m.pc, GRANDPARENT_RET);
  assert.equal(m.regs.sp, BASELINE);
  assert.equal(m.mem.read8(0x8a87), 0x04, "bit2 set, bit3 cleared");
  assert.equal(m.mem.read8(0x8d52), 0x01, "C=1 written to 0x8d52");
  assert.equal(m.mem.read8(0x8d53), 0x18);
});

test("loc_6c3f G: hit, y<0, (ix+2)<0x51 -> below via 0x6c9b->0x6c93, C=2", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8840, 0x50); m.mem.write8(0x887c, 0x50);
  m.mem.write8(0x8842, 0x40); m.mem.write8(0x887e, 0x30); // (ix+2)=0x40, y-delta = -8
  m.mem.write8(0x8a87, 0x04);

  loc_6c3f(m);

  assert.equal(m.tstates, 408);
  assert.deepEqual(m.pcSeq, [
    0x6c41, 0x6c42, 0x6c44, 0x6c46, 0x6c49, 0x6c4a, 0x6c4b, 0x6c4e, 0x6c4f, 0x6c50,
    0x6c53, 0x6c55, 0x6c56, 0x6c5a, 0x6c5c, 0x6c5d, 0x6c5f, 0x6c62, 0x6c64, 0x6c65,
    0x6c67, 0x6c69, 0x6c6b, 0x6c6d, 0x6c6e, 0x6c71, 0x6c73, 0x6c76, 0x6c79, 0x6c7a,
    0x6c7c, 0x6c7e, 0x6c9b, 0x6c9d, 0x6c93, 0x6c95, 0x6c97, 0x6c99, 0x6c86, 0x6c89,
    0x6c8a, 0x6c8b, 0x6c8d, 0x6c8e, GRANDPARENT_RET,
  ]);
  assert.equal(m.pc, GRANDPARENT_RET);
  assert.equal(m.regs.sp, BASELINE);
  assert.equal(m.mem.read8(0x8a87), 0x08, "bit3 set, bit2 cleared");
  assert.equal(m.mem.read8(0x8d52), 0x02);
  assert.equal(m.mem.read8(0x8d53), 0x18);
});

test("loc_6c3f H: hit, y<0, 0x51<=(ix+2)<0xb6 -> below terminal 0x6c9f (no tail write)", () => {
  const m = makeMachine();
  seat(m);
  m.mem.write8(0x8840, 0x50); m.mem.write8(0x887c, 0x50);
  m.mem.write8(0x8842, 0x80); m.mem.write8(0x887e, 0x70); // (ix+2)=0x80, y-delta = -8
  m.mem.write8(0x8a87, 0x04);

  loc_6c3f(m);

  assert.equal(m.tstates, 353);
  assert.deepEqual(m.pcSeq, [
    0x6c41, 0x6c42, 0x6c44, 0x6c46, 0x6c49, 0x6c4a, 0x6c4b, 0x6c4e, 0x6c4f, 0x6c50,
    0x6c53, 0x6c55, 0x6c56, 0x6c5a, 0x6c5c, 0x6c5d, 0x6c5f, 0x6c62, 0x6c64, 0x6c65,
    0x6c67, 0x6c69, 0x6c6b, 0x6c6d, 0x6c6e, 0x6c71, 0x6c73, 0x6c76, 0x6c79, 0x6c7a,
    0x6c7c, 0x6c7e, 0x6c9b, 0x6c9d, 0x6c9f, 0x6ca1, 0x6ca3, 0x6ca4, GRANDPARENT_RET,
  ]);
  assert.equal(m.pc, GRANDPARENT_RET);
  assert.equal(m.regs.sp, BASELINE);
  assert.equal(m.mem.read8(0x8a87), 0x08, "bit3 set, bit2 cleared");
  assert.equal(m.mem.read8(0x8d52), 0x00, "no tail write on 0x6c9f path");
  assert.equal(m.mem.read8(0x8d53), 0x00);
});

test("loc_6c3f MUTATION: `bit 0,(hl)` mis-charged 8T (not 12T) is caught by the 23-T golden", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x6c41 ? 8 : c);
  seat(m);
  m.mem.write8(0x8be8, 0x00); // path A

  loc_6c3f(m);

  assert.equal(m.tstates, 19, "mutation loses 4 T (12 -> 8)");
  assert.throws(
    () => assert.equal(m.tstates, 23, "path A T-state total"),
    /23/,
    "the 23-T golden must fail on the mutant",
  );
});
