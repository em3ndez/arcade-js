// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for translated loc_2329 (ROM 0x2329-0x23d6, Pooyan) -- the bidirectional
 * position driver for the object at IX. Bit 2 of (ix+7) selects the RISE path (dec (ix+4), clamp
 * low to 0x41); bit 3 selects the DESCENT path (inc (ix+4), clamp high to 0xc0). Each path calls a
 * mover (loc_23d7 / loc_2405), may step the ring counter at 0x88bd (mod 8), and on wrap recomputes
 * (0x88bc)&3 and re-renders three status fields via loc_3325 (with loc_0c45 supplying DE).
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so
 * a MISSING push16 desyncs SP -- every path asserts SP back at the pre-seat baseline (0x8780).
 * call(0x0c45) additionally returns DE=0xdead (the value push de/pop de round-trips at 0x23b7/0x23be).
 *
 * Coverage -- every branch outcome is exercised:
 *   A1 rise, all-7 zero scan -> ret 0x2358        A2 rise -> loc_2359 (jr nz 0x2346) -> ret nz 0x2365
 *   A3 rise clamp -> wrap -> render tail (0x23ce nt) A4 loc_2359 via jr nc 0x234b -> ret nz
 *   A5 loc_2359 via jr nz 0x2354 (loop) -> ret nz  B1 descent bit3 clear -> ret z 0x236e
 *   B2 descent -> ret z 0x239d (scan+sum zero)     B3 descent clamp -> loc_239e (jr nz 0x2385) -> ret nz
 *   B4 descent -> wrap -> render tail (0x23ce taken) B5 loc_239e via jr nz 0x238e -> ret nz
 *   B6 loc_239e via ret z 0x239d not-taken -> ret nz
 * TEETH: mis-charge `dec (ix+4)` (23 T) as 19 T -> the 438-T golden (A1) catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_2329.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2329 } from "../loc_2329.js";

const CALLER_RET = 0xabcd;
const IX = 0xa000;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x2329, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Each callee's `ret` pops the return address loc_2329 pushed at the call site -- model that pop
    // so a missing push16 desyncs SP. loc_0c45 also hands back DE (push de/pop de must round-trip it).
    call(addr) { this.calls.push(addr); this.pop16(); if (addr === 0x0c45) regs.de = 0xdead; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

const PC_A1 = [0x232d, 0x232f, 0x2332, 0x2335, 0x2337, 0x233d, 0x23d7, 0x2343, 0x2344, 0x2346, 0x2348, 0x2349, 0x234b, 0x234d, 0x234f, 0x2351, 0x2352, 0x2353, 0x2354, 0x2356, 0x2351, 0x2352, 0x2353, 0x2354, 0x2356, 0x2351, 0x2352, 0x2353, 0x2354, 0x2356, 0x2351, 0x2352, 0x2353, 0x2354, 0x2356, 0x2351, 0x2352, 0x2353, 0x2354, 0x2356, 0x2351, 0x2352, 0x2353, 0x2354, 0x2356, 0x2351, 0x2352, 0x2353, 0x2354, 0x2356, 0x2358, CALLER_RET];
const PC_A2 = [0x232d, 0x232f, 0x2332, 0x2335, 0x2337, 0x233d, 0x23d7, 0x2343, 0x2344, 0x2346, 0x2359, 0x23ec, 0x235f, 0x2360, 0x2361, 0x2363, 0x2364, 0x2365, CALLER_RET];
const PC_A3 = [0x232d, 0x232f, 0x2332, 0x2335, 0x2337, 0x2339, 0x233d, 0x23d7, 0x2343, 0x2344, 0x2346, 0x2359, 0x23ec, 0x235f, 0x2360, 0x2361, 0x2363, 0x2364, 0x2365, 0x2366, 0x2367, 0x2368, 0x23ad, 0x23ae, 0x23b0, 0x23b1, 0x23b4, 0x0c45, 0x23b8, 0x23bb, 0x3325, 0x23bf, 0x23c1, 0x3325, 0x23c6, 0x23c9, 0x23cc, 0x23ce, 0x23d0, 0x23d3, 0x3325, CALLER_RET];
const PC_A4 = [0x232d, 0x232f, 0x2332, 0x2335, 0x2337, 0x233d, 0x23d7, 0x2343, 0x2344, 0x2346, 0x2348, 0x2349, 0x234b, 0x2359, 0x23ec, 0x235f, 0x2360, 0x2361, 0x2363, 0x2364, 0x2365, CALLER_RET];
const PC_A5 = [0x232d, 0x232f, 0x2332, 0x2335, 0x2337, 0x233d, 0x23d7, 0x2343, 0x2344, 0x2346, 0x2348, 0x2349, 0x234b, 0x234d, 0x234f, 0x2351, 0x2352, 0x2353, 0x2354, 0x2356, 0x2351, 0x2352, 0x2353, 0x2354, 0x2359, 0x23ec, 0x235f, 0x2360, 0x2361, 0x2363, 0x2364, 0x2365, CALLER_RET];
const PC_B1 = [0x232d, 0x236a, 0x236e, CALLER_RET];
const PC_B2 = [0x232d, 0x236a, 0x236e, 0x236f, 0x2372, 0x2375, 0x2377, 0x237d, 0x23d7, 0x2383, 0x2385, 0x2387, 0x238a, 0x238c, 0x238d, 0x238e, 0x2390, 0x2391, 0x238c, 0x238d, 0x238e, 0x2390, 0x2391, 0x238c, 0x238d, 0x238e, 0x2390, 0x2391, 0x2393, 0x2396, 0x2399, 0x239a, 0x239c, 0x239d, CALLER_RET];
const PC_B3 = [0x232d, 0x236a, 0x236e, 0x236f, 0x2372, 0x2375, 0x2377, 0x2379, 0x237d, 0x23d7, 0x2383, 0x2385, 0x239e, 0x2405, 0x23a4, 0x23a5, 0x23a6, 0x23a8, 0x23a9, 0x23aa, CALLER_RET];
const PC_B4 = [0x232d, 0x236a, 0x236e, 0x236f, 0x2372, 0x2375, 0x2377, 0x237d, 0x23d7, 0x2383, 0x2385, 0x239e, 0x2405, 0x23a4, 0x23a5, 0x23a6, 0x23a8, 0x23a9, 0x23aa, 0x23ab, 0x23ac, 0x23ad, 0x23ae, 0x23b0, 0x23b1, 0x23b4, 0x0c45, 0x23b8, 0x23bb, 0x3325, 0x23bf, 0x23c1, 0x3325, 0x23c6, 0x23c9, 0x23cc, 0x23ce, 0x23d3, 0x3325, CALLER_RET];
const PC_B5 = [0x232d, 0x236a, 0x236e, 0x236f, 0x2372, 0x2375, 0x2377, 0x237d, 0x23d7, 0x2383, 0x2385, 0x2387, 0x238a, 0x238c, 0x238d, 0x238e, 0x239e, 0x2405, 0x23a4, 0x23a5, 0x23a6, 0x23a8, 0x23a9, 0x23aa, CALLER_RET];
const PC_B6 = [0x232d, 0x236a, 0x236e, 0x236f, 0x2372, 0x2375, 0x2377, 0x237d, 0x23d7, 0x2383, 0x2385, 0x2387, 0x238a, 0x238c, 0x238d, 0x238e, 0x2390, 0x2391, 0x238c, 0x238d, 0x238e, 0x2390, 0x2391, 0x238c, 0x238d, 0x238e, 0x2390, 0x2391, 0x2393, 0x2396, 0x2399, 0x239a, 0x239c, 0x239d, 0x239e, 0x2405, 0x23a4, 0x23a5, 0x23a6, 0x23a8, 0x23a9, 0x23aa, CALLER_RET];

// ---- RISE path (bit 2 of (ix+7) set) ----

function setupA1(m) {
  m.mem.write8(IX + 7, 0x04);        // bit 2 set -> rise
  m.mem.write8(IX + 4, 0x50);        // dec -> 0x4f (>= 0x41, jr nc taken)
  m.mem.write16(0x88be, 0x89e6);     // l == 0xe6 (jr nz not taken), HL = 0x89e6
  m.mem.write8(0x89e6, 0x00);        // (hl) < 0x35 (jr nc not taken) -> enter the 7-slot scan
  // slots 0x89e7..0x89ed already 0 -> loop completes -> ret 0x2358
}

test("loc_2329 A1 RISE: 7-slot scan all zero -> ret at 0x2358", () => {
  const m = makeMachine(); seatCaller(m); setupA1(m);
  loc_2329(m);
  assert.equal(m.tstates, 438, "A1 T-state total");
  assert.deepEqual(m.pcSeq, PC_A1, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret 0x2358 to the seated caller");
  assert.deepEqual(m.calls, [0x23d7], "one mover call, no counter step");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to the pre-seat baseline");
});

test("loc_2329 A2 RISE: (0x88be) low != 0xe6 -> loc_2359 -> ret nz at 0x2365", () => {
  const m = makeMachine(); seatCaller(m);
  m.mem.write8(IX + 7, 0x04);
  m.mem.write8(IX + 4, 0x50);
  m.mem.write16(0x88be, 0x8900);     // l == 0x00 != 0xe6 -> jr nz taken -> loc_2359
  m.mem.write8(0x88bd, 0x00);        // inc -> 0x01, &7 != 0 -> ret nz
  loc_2329(m);
  assert.equal(m.tstates, 218, "A2 T-state total");
  assert.deepEqual(m.pcSeq, PC_A2);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x23d7, 0x23ec]);
  assert.equal(m.mem.read8(0x88bd), 0x01, "rising ring counter bumped");
  assert.equal(m.regs.sp, 0x8780, "stack baseline");
});

test("loc_2329 A3 RISE: low clamp + wrap -> render tail (0x23ce not taken)", () => {
  const m = makeMachine(); seatCaller(m);
  m.mem.write8(IX + 7, 0x04);
  m.mem.write8(IX + 4, 0x30);        // dec -> 0x2f (< 0x41) -> jr nc NOT taken -> clamp to 0x41
  m.mem.write16(0x88be, 0x8900);
  m.mem.write8(0x88bd, 0x07);        // inc -> 0x08, &7 == 0 -> wrap
  m.mem.write8(0x88bc, 0x01);        // dec hl / inc (0x88bc) -> 0x02; tail &3 -> 0x02, bit0 clear
  loc_2329(m);
  assert.equal(m.tstates, 456, "A3 T-state total");
  assert.deepEqual(m.pcSeq, PC_A3);
  assert.equal(m.pc, CALLER_RET, "ret 0x23d6 to the seated caller");
  assert.deepEqual(m.calls, [0x23d7, 0x23ec, 0x0c45, 0x3325, 0x3325, 0x3325]);
  assert.equal(m.mem.read8(IX + 4), 0x41, "(ix+4) clamped up to 0x41");
  assert.equal(m.mem.read8(0x88bd), 0x00, "counter wrapped to 0");
  assert.equal(m.mem.read8(0x88bc), 0x02, "(0x88bc) masked to &3");
  assert.equal(m.regs.de, 0x270e, "bit0 clear -> DE = 0x270e for the final render");
  assert.equal(m.regs.sp, 0x8780, "push de/pop de + every call balanced");
});

test("loc_2329 A4 RISE: scan seed >= 0x35 -> loc_2359 via jr nc 0x234b -> ret nz", () => {
  const m = makeMachine(); seatCaller(m);
  m.mem.write8(IX + 7, 0x04);
  m.mem.write8(IX + 4, 0x50);
  m.mem.write16(0x88be, 0x89e6);     // l == 0xe6 -> jr nz not taken
  m.mem.write8(0x89e6, 0x40);        // (hl) >= 0x35 -> jr nc taken -> loc_2359
  m.mem.write8(0x88bd, 0x00);
  loc_2329(m);
  assert.equal(m.tstates, 239, "A4 T-state total");
  assert.deepEqual(m.pcSeq, PC_A4);
  assert.deepEqual(m.calls, [0x23d7, 0x23ec]);
  assert.equal(m.mem.read8(0x88bd), 0x01);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_2329 A5 RISE: scan finds nonzero slot -> loc_2359 via jr nz 0x2354 -> ret nz", () => {
  const m = makeMachine(); seatCaller(m);
  m.mem.write8(IX + 7, 0x04);
  m.mem.write8(IX + 4, 0x50);
  m.mem.write16(0x88be, 0x89e6);
  m.mem.write8(0x89e6, 0x00);        // enter the scan
  m.mem.write8(0x89e7, 0x00);        // slot 1 zero -> loop continues
  m.mem.write8(0x89e8, 0x05);        // slot 2 nonzero -> jr nz taken -> loc_2359
  m.mem.write8(0x88bd, 0x00);
  loc_2329(m);
  assert.equal(m.tstates, 314, "A5 T-state total");
  assert.deepEqual(m.pcSeq, PC_A5);
  assert.deepEqual(m.calls, [0x23d7, 0x23ec]);
  assert.equal(m.mem.read8(0x88bd), 0x01);
  assert.equal(m.regs.sp, 0x8780);
});

// ---- DESCENT path (bit 2 clear, bit 3 gate) ----

test("loc_2329 B1 DESCENT: bit 3 clear -> ret z at 0x236e", () => {
  const m = makeMachine(); seatCaller(m);
  m.mem.write8(IX + 7, 0x00);        // bit 2 clear (jr z), bit 3 clear (ret z)
  loc_2329(m);
  assert.equal(m.tstates, 63, "B1 T-state total");
  assert.deepEqual(m.pcSeq, PC_B1);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_2329 B2 DESCENT: (0x88be)==0xf6, zero scan+sum -> ret z at 0x239d", () => {
  const m = makeMachine(); seatCaller(m);
  m.mem.write8(IX + 7, 0x08);        // bit 3 set -> descent
  m.mem.write8(IX + 4, 0x50);        // inc -> 0x51 (< 0xc0) -> jr c taken
  m.mem.write8(0x88be, 0xf6);        // == 0xf6 -> jr nz not taken
  // 0x8a38..0x8a3a already 0 -> scan completes; 0x8083 + 0x8343 = 0 -> ret z
  loc_2329(m);
  assert.equal(m.tstates, 337, "B2 T-state total");
  assert.deepEqual(m.pcSeq, PC_B2);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x23d7], "no counter step -- returned before loc_2405");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_2329 B3 DESCENT: high clamp + (0x88be)!=0xf6 -> loc_239e -> ret nz at 0x23aa", () => {
  const m = makeMachine(); seatCaller(m);
  m.mem.write8(IX + 7, 0x08);
  m.mem.write8(IX + 4, 0xd0);        // inc -> 0xd1 (>= 0xc0) -> jr c NOT taken -> clamp to 0xc0
  m.mem.write8(0x88be, 0x00);        // != 0xf6 -> jr nz taken -> loc_239e
  m.mem.write8(0x88bd, 0x05);        // dec -> 0x04, &7 != 0 -> ret nz
  loc_2329(m);
  assert.equal(m.tstates, 255, "B3 T-state total");
  assert.deepEqual(m.pcSeq, PC_B3);
  assert.deepEqual(m.calls, [0x23d7, 0x2405]);
  assert.equal(m.mem.read8(IX + 4), 0xc0, "(ix+4) clamped down to 0xc0");
  assert.equal(m.mem.read8(0x88bd), 0x04, "falling ring counter stepped down");
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_2329 B4 DESCENT: wrap -> render tail (0x23ce taken)", () => {
  const m = makeMachine(); seatCaller(m);
  m.mem.write8(IX + 7, 0x08);
  m.mem.write8(IX + 4, 0x50);
  m.mem.write8(0x88be, 0x00);        // != 0xf6 -> loc_239e
  m.mem.write8(0x88bd, 0x01);        // dec -> 0x00, &7 == 0 -> wrap
  m.mem.write8(0x88bc, 0x00);        // dec (0x88bc) -> 0xff; tail &3 -> 0x03, bit0 set
  loc_2329(m);
  assert.equal(m.tstates, 448, "B4 T-state total");
  assert.deepEqual(m.pcSeq, PC_B4);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [0x23d7, 0x2405, 0x0c45, 0x3325, 0x3325, 0x3325]);
  assert.equal(m.mem.read8(0x88bd), 0x00, "counter wrapped to 0");
  assert.equal(m.mem.read8(0x88bc), 0x03, "(0x88bc) masked to &3 (bit0 set)");
  assert.equal(m.regs.de, 0x270a, "bit0 set -> DE = 0x270a for the final render");
  assert.equal(m.regs.sp, 0x8780, "push de/pop de + every call balanced");
});

test("loc_2329 B5 DESCENT: scan slot nonzero -> loc_239e via jr nz 0x238e -> ret nz", () => {
  const m = makeMachine(); seatCaller(m);
  m.mem.write8(IX + 7, 0x08);
  m.mem.write8(IX + 4, 0x50);
  m.mem.write8(0x88be, 0xf6);        // == 0xf6 -> enter the 0x8a38 scan
  m.mem.write8(0x8a38, 0x07);        // slot 0 nonzero -> jr nz taken -> loc_239e
  m.mem.write8(0x88bd, 0x05);
  loc_2329(m);
  assert.equal(m.tstates, 276, "B5 T-state total");
  assert.deepEqual(m.pcSeq, PC_B5);
  assert.deepEqual(m.calls, [0x23d7, 0x2405]);
  assert.equal(m.mem.read8(0x88bd), 0x04);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_2329 B6 DESCENT: zero scan but nonzero sum -> ret z 0x239d not taken -> loc_239e", () => {
  const m = makeMachine(); seatCaller(m);
  m.mem.write8(IX + 7, 0x08);
  m.mem.write8(IX + 4, 0x50);
  m.mem.write8(0x88be, 0xf6);
  // 0x8a38..0x8a3a zero -> scan completes
  m.mem.write8(0x8083, 0x05);        // 0x8343(0) + 0x8083(5) = 5, &0x0f != 0 -> ret z NOT taken
  m.mem.write8(0x88bd, 0x05);        // loc_239e -> dec -> 0x04 -> ret nz
  loc_2329(m);
  assert.equal(m.tstates, 405, "B6 T-state total");
  assert.deepEqual(m.pcSeq, PC_B6);
  assert.deepEqual(m.calls, [0x23d7, 0x2405]);
  assert.equal(m.mem.read8(0x88bd), 0x04);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_2329 MUTATION: `dec (ix+4)` mis-charged 19T (not 23T) is caught", () => {
  const m = makeMachine(); seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x2332 ? 19 : cycles);
  setupA1(m);
  loc_2329(m);
  assert.equal(m.tstates, 434, "mutation loses 4 T (23 -> 19)");
  assert.throws(
    () => assert.equal(m.tstates, 438, "A1 T-state total"),
    /438/,
    "the 438-T golden must fail on the mutant",
  );
});
