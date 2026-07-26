// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_2cb7 (ROM 0x2cb7-0x2d05), The Pit.
//
// loc_2cb7 is the per-tick handler for the timed/tracked object that shares the record +
// overlap tails with loc_2c04. It clears 0x8080, then advances the countdown byte 0x80b1:
//   - 0x80b1 == 0x40  -> jp z  0x2d6b   (reload/reset path)
//   - after dec, != 0 -> jp nz 0x2c91   (overlap-record tail; tick not expired)
//   - expired: reload 0x80b1 = 1, and unless 0x80c1 (captured flag) is already set, run a
//     two-axis capture-window test between object bytes 0x8068/0x806b and target bytes
//     0x80a9/0x80ac; any miss -> jr .. 0x2d06; both hit -> snap (0x8068)=(0x80a9)+4,
//     raise 0x80c1, call leaf 0x4c9f, jp 0x2bd3.
//
// The call seam is stubbed: 0x4c9f is a regular call that pushed its own return address, so
// the stub behaves as a bare `ret` (pop -> pc). Every jp/jr that leaves the routine pushed
// nothing, so its stub pops the SENTINEL and the T-state total stays loc_2cb7's OWN cost.
//
// Five path specs -- reload sentinel (jp z), not-expired (jp nz), already-captured
// (jr nz), window-A miss (jr nc), window-B miss (jr nc), and the full capture (jp 0x2bd3)
// -- plus a deliberate mutation (the final `jr c,0x2d06` at 0x2cf6 flipped to `jr nc`) that
// the capture spec must catch.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_2cb7 } from "../loc_2cb7.js";

const LEAF = 0x4c9f; // leaf side-effect call on the capture path
const TAIL_CAPTURE = 0x2bd3; // capture-path tail-jump target
const TAIL_RELOAD = 0x2d6b; // reload/reset tail-jump target
const TAIL_RECORD = 0x2c91; // shared overlap-record tail-jump target
const TAIL_OUT = 0x2d06; // capture-window "miss" / already-captured tail-jump target
const SENTINEL = 0xbeef; // caller return address the tail-callee's ret lands on
const SP0 = 0x8780; // SP inside work RAM so pushes/pops are mapped

function buildRom() {
  return new Uint8Array(0x5000); // AddressSpace requires a 20480-byte ROM; contents unused
}

// Minimal machine: real mem/io/regs + the step/call/push16 seam. The call stub records the
// target and models a bare `ret` (pop -> pc). loc_2cb7 has no register-returning calls.
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x2cb7;
    this.calls = [];
    this.regs.sp = SP0;
  }
  step(nextAddr, t) {
    this.pc = nextAddr;
    this.cycles += t;
  }
  push16(v) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, v & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
  }
  pop16() {
    const lo = this.mem.read8(this.regs.sp);
    const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
    this.regs.sp = (this.regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16(); // bare ret: pop the (just-pushed, or caller's) return address
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function run(mem = {}) {
  const m = new TestMachine(buildRom());
  for (const [addr, val] of Object.entries(mem)) m.mem.write8(Number(addr), val);
  m.push16(SENTINEL); // the caller's return address
  loc_2cb7(m);
  return {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    flag8080: m.mem.read8(0x8080),
    counter: m.mem.read8(0x80b1),
    captured: m.mem.read8(0x80c1),
    objX: m.mem.read8(0x8068),
    mem: m.mem,
  };
}

// ============================================================================
// SPEC 1: countdown already at the reload sentinel 0x40 -> jp z tail-jump to 0x2d6b.
//   2cb7..2cc1: ld a(7)+ld(13)+ld a(13)+cp(7)+jp z TAKEN(10) = 50
// ============================================================================
test("loc_2cb7: countdown == 0x40 -> jp z tail-jump to 0x2d6b, 50 T", () => {
  const r = run({ 0x80b1: 0x40 });
  assert.equal(r.cycles, 50, "reload-sentinel path is 50 T");
  assert.equal(r.flag8080, 0x00, "0x8080 cleared first");
  assert.equal(r.counter, 0x40, "0x80b1 untouched on the sentinel path");
  assert.deepEqual(r.calls, [TAIL_RELOAD], "tail-jumps to 0x2d6b only");
  assert.equal(r.pc, SENTINEL, "0x2d6b's ret returns to loc_2cb7's caller");
  assert.equal(r.sp, SP0, "stack balanced");
});

// ============================================================================
// SPEC 2: countdown not expired (0x05 -> 0x04) -> jp nz tail-jump to 0x2c91.
//   +dec a(4)+ld(13)+jp nz TAKEN(10) on top of the 50-T head (jp z NOT taken) = 77
// ============================================================================
test("loc_2cb7: countdown 0x05 -> dec to 0x04, jp nz tail-jump to 0x2c91, 77 T", () => {
  const r = run({ 0x80b1: 0x05 });
  assert.equal(r.cycles, 77, "not-expired path is 77 T");
  assert.equal(r.counter, 0x04, "0x80b1 decremented to 0x04 and stored");
  assert.deepEqual(r.calls, [TAIL_RECORD], "tail-jumps to the shared record tail 0x2c91");
  assert.equal(r.pc, SENTINEL, "0x2c91's ret returns to loc_2cb7's caller");
});

// ============================================================================
// SPEC 3: countdown expires (1 -> 0) but 0x80c1 already set -> jr nz tail-jump to 0x2d06.
//   50 (jp z nt) +4+13(dec/store)+10(jp nz nt) +7+13(reload)+13(ld 0x80c1)+4(and a)
//   +12(jr nz TAKEN) = 126
// ============================================================================
test("loc_2cb7: expired but already captured (0x80c1=0x07) -> jr nz to 0x2d06, 126 T", () => {
  const r = run({ 0x80b1: 0x01, 0x80c1: 0x07 });
  assert.equal(r.cycles, 126, "already-captured path is 126 T");
  assert.equal(r.counter, 0x01, "0x80b1 reloaded to 1");
  assert.equal(r.captured, 0x07, "0x80c1 left untouched (already set)");
  assert.deepEqual(r.calls, [TAIL_OUT], "tail-jumps to 0x2d06");
  assert.equal(r.pc, SENTINEL, "returns to caller");
});

// ============================================================================
// SPEC 4: expired, not captured, window A (0x80ac axis) misses low -> jr nc to 0x2d06.
//   (0x80ac)+0x0a = 0x2a >= (0x806b)=0x10 -> below the window.
//   126-base minus the jr nz(taken,12)+ that path... recomputed straight:
//   through jr nz NOT taken(7) = 121; +13(ld 0x806b)+4(ld b)+13(ld 0x80ac)+7(add 0x0a)
//   +4(cp b)+12(jr nc TAKEN) = 174
// ============================================================================
test("loc_2cb7: window-A miss (0x80ac+0x0a >= 0x806b) -> jr nc to 0x2d06, 174 T", () => {
  const r = run({ 0x80b1: 0x01, 0x80c1: 0x00, 0x80ac: 0x20, 0x806b: 0x10 });
  assert.equal(r.cycles, 174, "window-A miss path is 174 T");
  assert.equal(r.counter, 0x01, "0x80b1 reloaded to 1");
  assert.equal(r.captured, 0x00, "0x80c1 stays clear on a miss");
  assert.deepEqual(r.calls, [TAIL_OUT], "tail-jumps to 0x2d06");
  assert.equal(r.pc, SENTINEL, "returns to caller");
});

// ============================================================================
// SPEC 5: expired, not captured, window A hits but window B (0x80a9 axis) misses low ->
//   the SECOND `jr nc` (at 0x2cf1) fires. Exercises the second axis distinctly.
//   0x80ac=0x20,0x806b=0x2c (window A: 0x2a < 0x2c <= 0x2d, pass);
//   0x80a9=0x40,0x8068=0x10 -> (0x80a9)-0x04=0x3c >= 0x10 -> below window B.
//   174-shape but window A falls through: through jr nc(2ce0) NOT taken(7)=169;
//   +7(add 0x03)+4(cp b)+7(jr c nt)+13(ld 0x8068)+4(ld c)+13(ld 0x80a9)+7(sub 0x04)
//   +4(cp c)+12(jr nc TAKEN) = 240
// ============================================================================
test("loc_2cb7: window-A hit, window-B miss -> jr nc(0x2cf1) to 0x2d06, 240 T", () => {
  const r = run({ 0x80b1: 0x01, 0x80c1: 0x00, 0x80ac: 0x20, 0x806b: 0x2c, 0x80a9: 0x40, 0x8068: 0x10 });
  assert.equal(r.cycles, 240, "window-B miss path is 240 T");
  assert.equal(r.objX, 0x10, "0x8068 not snapped on a miss");
  assert.equal(r.captured, 0x00, "0x80c1 stays clear");
  assert.deepEqual(r.calls, [TAIL_OUT], "tail-jumps to 0x2d06");
});

// ============================================================================
// SPEC 6: FULL CAPTURE -- both windows hit -> snap 0x8068, raise 0x80c1, call 0x4c9f,
//   tail-jump to 0x2bd3.
//   0x80ac=0x20,0x806b=0x2c (window A pass); 0x80a9=0x40,0x8068=0x40 (window B:
//   0x3c < 0x40 <= 0x44, pass). Capture snaps 0x8068 = (0x80a9)+0x04 = 0x44.
//   Straight-line total = 313 T (all conditional branches fall through).
// ============================================================================
function spec6(r) {
  assert.equal(r.cycles, 313, "full-capture path is 313 T");
  assert.equal(r.flag8080, 0x00, "0x8080 cleared");
  assert.equal(r.counter, 0x01, "0x80b1 reloaded to 1");
  assert.equal(r.captured, 0x01, "0x80c1 raised to 1 on capture");
  assert.equal(r.objX, 0x44, "0x8068 snapped to (0x80a9)+0x04 = 0x44");
  assert.deepEqual(r.calls, [LEAF, TAIL_CAPTURE], "leaf 0x4c9f then tail-jump 0x2bd3");
  assert.equal(r.pc, SENTINEL, "0x2bd3's ret returns to loc_2cb7's caller");
  assert.equal(r.sp, SP0, "stack balanced");
}
const CAPTURE_FIXTURE = { 0x80b1: 0x01, 0x80c1: 0x00, 0x80ac: 0x20, 0x806b: 0x2c, 0x80a9: 0x40, 0x8068: 0x40 };

test("loc_2cb7: full capture -> snap 0x8068=0x44, 0x80c1=1, call 0x4c9f, jp 0x2bd3, 313 T", () => {
  spec6(run(CAPTURE_FIXTURE));
});

// ============================================================================
// MUTATION: flip the final window guard `jr c,0x2d06` (0x2cf6) to `jr nc`. On the capture
// fixture, C is CLEAR at 0x2cf6 (0x44 >= 0x40 = c), so the real routine falls through and
// captures; the mutant with `jr nc` instead TAKES the branch and tail-jumps to 0x2d06 --
// no snap, no 0x80c1, no 0x4c9f. spec6 rejects it (calls/objX/captured/cycles all differ).
// ============================================================================
function loc_2cb7_mutant(m) {
  const { regs, mem } = m;
  regs.a = 0x00; m.step(0x2cb9, 7);
  mem.write8(0x8080, regs.a); m.step(0x2cbc, 13);
  regs.a = mem.read8(0x80b1); m.step(0x2cbf, 13);
  regs.cp(0x40); m.step(0x2cc1, 7);
  if (regs.fZ) { m.step(0x2d6b, 10); return m.call(0x2d6b); }
  m.step(0x2cc4, 10);
  regs.a = regs.dec8(regs.a); m.step(0x2cc5, 4);
  mem.write8(0x80b1, regs.a); m.step(0x2cc8, 13);
  if (regs.fNZ) { m.step(0x2c91, 10); return m.call(0x2c91); }
  m.step(0x2ccb, 10);
  regs.a = 0x01; m.step(0x2ccd, 7);
  mem.write8(0x80b1, regs.a); m.step(0x2cd0, 13);
  regs.a = mem.read8(0x80c1); m.step(0x2cd3, 13);
  regs.and(regs.a); m.step(0x2cd4, 4);
  if (regs.fNZ) { m.step(0x2d06, 12); return m.call(0x2d06); }
  m.step(0x2cd6, 7);
  regs.a = mem.read8(0x806b); m.step(0x2cd9, 13);
  regs.b = regs.a; m.step(0x2cda, 4);
  regs.a = mem.read8(0x80ac); m.step(0x2cdd, 13);
  regs.add(0x0a); m.step(0x2cdf, 7);
  regs.cp(regs.b); m.step(0x2ce0, 4);
  if (regs.fNC) { m.step(0x2d06, 12); return m.call(0x2d06); }
  m.step(0x2ce2, 7);
  regs.add(0x03); m.step(0x2ce4, 7);
  regs.cp(regs.b); m.step(0x2ce5, 4);
  if (regs.fC) { m.step(0x2d06, 12); return m.call(0x2d06); }
  m.step(0x2ce7, 7);
  regs.a = mem.read8(0x8068); m.step(0x2cea, 13);
  regs.c = regs.a; m.step(0x2ceb, 4);
  regs.a = mem.read8(0x80a9); m.step(0x2cee, 13);
  regs.sub(0x04); m.step(0x2cf0, 7);
  regs.cp(regs.c); m.step(0x2cf1, 4);
  if (regs.fNC) { m.step(0x2d06, 12); return m.call(0x2d06); }
  m.step(0x2cf3, 7);
  regs.add(0x08); m.step(0x2cf5, 7);
  regs.cp(regs.c); m.step(0x2cf6, 4);
  if (regs.fNC) { m.step(0x2d06, 12); return m.call(0x2d06); } // BUG: real is `jr c` (branch on carry SET)
  m.step(0x2cf8, 7);
  mem.write8(0x8068, regs.a); m.step(0x2cfb, 13);
  regs.a = 0x01; m.step(0x2cfd, 7);
  mem.write8(0x80c1, regs.a); m.step(0x2d00, 13);
  m.push16(0x2d03); m.step(0x4c9f, 17); m.call(0x4c9f);
  m.step(0x2bd3, 10); return m.call(0x2bd3);
}

test("mutation (jr c -> jr nc at 0x2cf6) is caught by the capture spec", () => {
  const m = new TestMachine(buildRom());
  for (const [addr, val] of Object.entries(CAPTURE_FIXTURE)) m.mem.write8(Number(addr), val);
  m.push16(SENTINEL);
  loc_2cb7_mutant(m);
  const bad = {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    flag8080: m.mem.read8(0x8080),
    counter: m.mem.read8(0x80b1),
    captured: m.mem.read8(0x80c1),
    objX: m.mem.read8(0x8068),
    mem: m.mem,
  };
  // The mutant tail-jumped to 0x2d06 instead of capturing.
  assert.deepEqual(bad.calls, [TAIL_OUT], "mutant escapes to 0x2d06 instead of capturing");
  assert.equal(bad.captured, 0x00, "mutant never raises 0x80c1");
  assert.equal(bad.objX, 0x40, "mutant never snaps 0x8068");
  assert.throws(() => spec6(bad), "the capture spec rejects the flipped-branch mutant");
});
