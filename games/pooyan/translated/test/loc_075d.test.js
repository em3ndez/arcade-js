// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_075d (ROM 0x075d, Pooyan) -- the tile-attribute
 * column-fill. Self-contained mock machine (real Regs for exact flags, flat 64K RAM,
 * step/ret/push16/pop16 mirroring the DK Machine). A caller return address is seated so
 * the single `ret` exit proves the final PC.
 *
 * The routine's control flow is fully data-agnostic: it always fills 31 columns
 * (l = 0x40..0x5e) of 30 rows each = 930 writes, advancing BC once per column, and
 * exits when (l & 0x1f) == 0x1f. So there is exactly ONE path. It is pinned with:
 *   - total T = 46215 (independently hand-derived AND cross-checked by a byte-level sim),
 *   - the full instruction-boundary set (guards opcode decode / boundary drift),
 *   - the ordered prefix of the first inner iteration (jr c taken loops back to 0x0763),
 *   - sampled attribute-RAM cells and final BC / HL / A and the `ret` landing.
 *
 * TEETH (required mutation): mis-charge the first `add hl,de` (11 T) as 7 T -- a plausible
 * copy error (the ld/add family 8-bit vs 16-bit timing). The golden T-state must catch it.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_075d } from "../loc_075d.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x075d, pcSeq: [],
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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780; // inside work RAM
  m.push16(CALLER_RET);
}

// Distinct per-column source: (0x8800 + m) = m + 1, so column m is filled with m+1.
function setup(m) {
  seatCaller(m);
  for (let i = 0; i < 64; i++) m.mem.write8(0x8800 + i, i + 1);
  m.regs.bc = 0x8800;
}

// Every instruction boundary the routine can step to (off the byte-level disassembly).
const BOUNDARIES = new Set([
  0x0760, 0x0763, 0x0764, 0x0765, 0x0766, 0x0767, 0x0769,
  0x076b, 0x076d, 0x076f, 0x0770, 0x0771, 0x0772, 0x0774, 0x0776, 0x0778,
  CALLER_RET,
]);

// Ordered prefix: entry (ld hl / ld de) + first inner iteration, whose `jr c` is taken
// (h still 0x80 < 0x84) and loops straight back to 0x0763.
const EXPECTED_PREFIX = [0x0760, 0x0763, 0x0764, 0x0765, 0x0766, 0x0767, 0x0769, 0x0763];

test("loc_075d: 31-column attribute fill, single deterministic path", () => {
  const m = makeMachine();
  setup(m);
  loc_075d(m);

  assert.equal(m.tstates, 46215, "total T for the 31x30 fill");
  assert.equal(m.pcSeq.length, 5831, "step count: 2 + 930*6 (inner) + 31*8 (outer) + 1 (ret)");
  assert.equal(m.pc, CALLER_RET, "exits via `ret` -> caller address");
  assert.deepEqual(m.calls, [], "no calls / tail-jumps");

  // opcode-boundary integrity: nothing was ever stepped to outside the known set.
  const seen = new Set(m.pcSeq);
  for (const a of seen) assert.ok(BOUNDARIES.has(a), `stepped to unexpected 0x${a.toString(16)}`);
  for (const a of BOUNDARIES) assert.ok(seen.has(a), `never reached 0x${a.toString(16)}`);
  assert.deepEqual(m.pcSeq.slice(0, EXPECTED_PREFIX.length), EXPECTED_PREFIX, "first-iteration order");

  // memory: column m (entry l = 0x40+m) filled with source byte (0x8800+m) = m+1, all 30 rows.
  const b = (a) => m.mem.read8(a);
  assert.equal(b(0x8040), 0x01, "col 0x40 row0 = source[0]");
  assert.equal(b(0x8060), 0x01, "col 0x40 row1 = same source byte");
  assert.equal(b(0x83e0), 0x01, "col 0x40 last row = same source byte");
  assert.equal(b(0x8041), 0x02, "col 0x41 row0 = source[1]");
  assert.equal(b(0x805e), 0x1f, "col 0x5e (last) row0 = source[30]");
  assert.equal(b(0x807e), 0x1f, "col 0x5e row1 = same");
  assert.equal(b(0x805f), 0x00, "col 0x5f never filled (exit before its inner loop)");

  assert.equal(m.regs.bc, 0x881f, "BC advanced 31 times (0x8800 -> 0x881f)");
  assert.equal(m.regs.hl, 0x805f, "HL final");
  assert.equal(m.regs.a, 0x1f, "A = 0x1f at the exit test");
});

test("loc_075d MUTATION: first `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x0766) { first = false; return realStep(nextAddr, 7); }
    return realStep(nextAddr, cycles);
  };
  setup(m);
  loc_075d(m);

  assert.equal(m.tstates, 46211, "mutation loses exactly 4 T (11 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 46215, "total T for the 31x30 fill"),
    /46215/,
    "the golden T-state assertion must fail on the mutant",
  );
});
