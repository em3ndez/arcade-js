// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_3fc0 (ROM 0x3FC0) — pin a fixed pose into Mario's hardware
 * sprite record and return a pointer to that record's Y field.
 *
 * sub_3fc0 is a LEAF that reads NO memory and NO registers: it hardcodes its pointer,
 * stores a constant 3 into the record's code byte (MARIO_SPRITE_RECORD+SPRITE_CODE,
 * 0x694D), steps over the attribute byte with two write-free advances, and leaves the
 * pointer at the record's Y byte (MARIO_SPRITE_RECORD+SPRITE_Y, 0x694F). So its whole
 * observable effect is a CONSTANT: mem[0x694D] := 3, nothing else written, and the
 * pointer 0x694F handed back.
 *
 * The pointer is a genuine LIVE-OUT — the sole caller (descend_2284, ROM 0x2285, still
 * translated) increments the byte at it right after the call — so the idiomatic routine
 * RETURNS it and the gate compares that return against the oracle's residual pointer.
 * Everything else the oracle leaves (residual registers/flags) is dead ABI.
 *
 * 0x3FC0 is NOT dispatched during attract (its only caller is unwired), so capture
 * yields nothing and there are no "real" dispatches to replay. That is fine here, and
 * the gate turns it into a strength: because the routine is provably input-independent,
 * the proof is to run it against the oracle over many self-consistent base states with
 * the three record bytes (code / attr / Y) pre-poked to ADVERSARIAL values and the
 * entry pointer varied — and show the write, the untouched neighbours, and the returned
 * pointer are invariant every single time.
 *
 * Contract compared per case: full RAM (firstStateDiff over the whole memory dump —
 * the routine performs no dissolved call, both sides do exactly one read-only `ret`, so
 * even the stack region matches and no STACK_SCRATCH exclusion is needed), pc, SP, and
 * the returned pointer vs the oracle's residual pointer.
 *
 *   1. EQUAL (adversarial grid) — loc_3fc0 == oracle across a grid of base states ×
 *      pre-poked {code, attr, Y} × entry pointers. Proves input-independence: the only
 *      byte that changes is 0x694D -> 3, the neighbours 0x694E/0x694F are untouched, and
 *      the returned pointer is always 0x694F.
 *
 *   2. TEETH — three broken twins, each MUST be caught:
 *      (a) wrong write address — stamps the attribute byte (0x694E) instead of the code
 *          byte; caught by the RAM diff.
 *      (b) spurious neighbour write — also clobbers the Y byte (0x694F); caught by the
 *          RAM diff (the caller relies on Y being left alone).
 *      (c) wrong returned pointer — returns the attribute address (0x694E) not the Y
 *          address; RAM/pc/SP all match, so ONLY the live-out check catches it. This is
 *          what proves the pointer live-out is genuinely verified.
 *
 *   3. REACHABILITY (informational) — hook 0x3FC0 across a long attract run and confirm
 *      it is not naturally dispatched (documents why crafted entries stand in for real
 *      captures); any dispatch that DID occur is verified against the oracle too.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-3fc0.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_3fc0 as oracle } from "../../translated/sub_3fc0.js";
import { pinMarioClimbPose as loc_3fc0 } from "../pinMarioClimbPose.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { MARIO_SPRITE_RECORD, SPRITE_CODE, SPRITE_ATTR, SPRITE_Y } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x3fc0;
const RET_ADDR = 0x2288; // the real return site inside descend_2284 (call at 0x2285 -> 0x2288)

const CODE_CELL = MARIO_SPRITE_RECORD + SPRITE_CODE; // 0x694D — the byte the routine stamps to 3
const ATTR_CELL = MARIO_SPRITE_RECORD + SPRITE_ATTR; // 0x694E — stepped over, never written
const Y_CELL = MARIO_SPRITE_RECORD + SPRITE_Y;       // 0x694F — the returned pointer

const hx = (v) => "0x" + (v & 0xffff).toString(16);

/**
 * A crafted 0x3FC0 entry: a clone of `base` with a controlled stack (so the oracle's
 * terminal `ret` is well-defined), an arbitrary entry pointer (which the routine must
 * ignore), and the three record bytes pre-poked to chosen values so the write and the
 * two untouched neighbours are all pinned by adversarial data.
 */
function craft(base, { code = 0x00, attr = 0xaa, y = 0x55, hl = 0x0000, sp = 0x6c00 } = {}) {
  const m = base.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
  m.regs.sp = sp;
  m.push16(RET_ADDR);
  m.regs.hl = hl; // entry pointer — the routine hardcodes its own, so this must not matter
  m.mem.write8(CODE_CELL, code);
  m.mem.write8(ATTR_CELL, attr);
  m.mem.write8(Y_CELL, y);
  return m;
}

/**
 * Run the oracle and a candidate on two fresh, byte-identical clones of `entry`, then
 * diff the memory-equivalence contract: full RAM + pc + SP + the returned pointer. The
 * oracle performs its own terminal `ret`; the candidate models no stack, so one
 * modelled `ret` after it lines up pc + SP.
 */
function contractDiffs(entry, candidate) {
  const o = entry.clone();
  oracle(o); // writes CODE_CELL=3, leaves the pointer at 0x694F, then rets

  const c = entry.clone();
  const ret = candidate(c); // writes CODE_CELL=3, returns 0x694F, touches no stack
  c.ret();                  // model the terminal ret to align pc + SP with the oracle

  const diffs = [];
  const ram = firstStateDiff(o.dumpState(), c.dumpState(), (off) => o.stateOffsetToAddr(off));
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  if (ret !== o.regs.hl) diffs.push(`live-out pointer oracle=${hx(o.regs.hl)} cand=${hx(ret)}`);
  return { diffs, ret, oracleHl: o.regs.hl };
}

// A few real, self-consistent base machines (fresh power-on + several attract depths),
// so the crafted record bytes sit inside genuine work RAM, not a blank image.
function baseMachines() {
  const bases = [];
  for (const frames of [0, 60, 180, 600]) {
    const m = new Machine(ROM);
    if (frames > 0) m.runFrames(frames);
    bases.push(m.clone());
  }
  return bases;
}

// -- 1. EQUAL (adversarial grid) ----------------------------------------------

test("EQUAL: loc_3fc0 == oracle across base states × adversarial record bytes × entry pointers", () => {
  const bases = baseMachines();
  const codes = [0x00, 0x03, 0x7f, 0xff]; // prior code byte, incl. one already == 3
  const attrs = [0x00, 0xaa];             // neighbour that must stay untouched
  const ys = [0x00, 0x55, 0xff];          // returned-pointer target that must stay untouched
  const hls = [0x0000, 0x694f, 0x1234, 0xffff]; // entry pointer that must be ignored

  let count = 0;
  for (const base of bases) {
    for (const code of codes) {
      for (const attr of attrs) {
        for (const y of ys) {
          for (const hl of hls) {
            const entry = craft(base, { code, attr, y, hl });
            const { diffs, ret, oracleHl } = contractDiffs(entry, loc_3fc0);
            count++;
            assert.equal(
              diffs.length,
              0,
              `code=${hx(code)} attr=${hx(attr)} y=${hx(y)} hl=${hx(hl)}: ${diffs.join("; ")}`,
            );
            // Pin the exact invariants the routine is claimed to produce.
            assert.equal(ret, Y_CELL, "returned pointer must be the record's Y address (0x694F)");
            assert.equal(oracleHl, Y_CELL, "oracle must leave the pointer at 0x694F");
          }
        }
      }
    }
  }
  assert.ok(count >= 4 * 4 * 2 * 3 * 4, "must have compared the full adversarial grid");
  console.log(`  EQUAL: ${count} (base × code × attr × y × pointer) combos — RAM + pc + SP + pointer identical`);
});

// -- 2. TEETH -----------------------------------------------------------------

/** (a) wrong write address: stamps the attribute byte instead of the code byte. */
function brokenWrongAddr(m) {
  m.mem.write8(ATTR_CELL, 3); // BUG: +2 not +1 — leaves the code byte unchanged
  return Y_CELL;
}

/** (b) spurious neighbour write: also clobbers the Y byte the caller relies on. */
function brokenExtraWrite(m) {
  m.mem.write8(CODE_CELL, 3);
  m.mem.write8(Y_CELL, 0); // BUG: writes the Y byte, which the oracle leaves alone
  return Y_CELL;
}

/** (c) wrong returned pointer: memory is correct, but the handed-back pointer is off by one. */
function brokenWrongPointer(m) {
  m.mem.write8(CODE_CELL, 3);
  return ATTR_CELL; // BUG: +2 not +3 — only the live-out check can catch this
}

test("TEETH: wrong-address, spurious-write, and wrong-pointer twins are all CAUGHT", () => {
  const base = baseMachines()[2]; // attract@180
  // Adversarial entry: code != 3 (so the wrong-address twin's missing write shows), and
  // attr/Y non-zero (so a stray or dropped write on either neighbour diverges).
  const entry = craft(base, { code: 0x00, attr: 0xaa, y: 0x55, hl: 0x0000 });

  const a = contractDiffs(entry, brokenWrongAddr).diffs;
  assert.ok(a.length > 0, "the wrong-address twin escaped — the RAM check is worthless");
  assert.ok(a[0].startsWith(`RAM@${hx(CODE_CELL)}`), `expected the diff at ${hx(CODE_CELL)}, got ${a[0]}`);

  const b = contractDiffs(entry, brokenExtraWrite).diffs;
  assert.ok(b.length > 0, "the spurious-neighbour-write twin escaped — the RAM check is worthless");
  assert.ok(b[0].startsWith(`RAM@${hx(Y_CELL)}`), `expected the diff at ${hx(Y_CELL)}, got ${b[0]}`);

  const c = contractDiffs(entry, brokenWrongPointer).diffs;
  assert.ok(c.length > 0, "the wrong-pointer twin escaped — the live-out check is worthless");
  assert.ok(c[0].startsWith("live-out pointer"), `expected a live-out pointer diff, got ${c[0]}`);
  // Prove it was ONLY the pointer: RAM/pc/SP matched, so a RAM-only gate would have missed it.
  assert.equal(c.length, 1, `wrong-pointer twin should diverge ONLY on the pointer, got: ${c.join("; ")}`);

  console.log(`  TEETH: wrong-address caught (${a[0]}); spurious-write caught (${b[0]}); wrong-pointer caught (${c[0]})`);
});

// -- 3. REACHABILITY (informational) ------------------------------------------

test("REACHABILITY: 0x3FC0 is not naturally dispatched in attract (crafted entries stand in)", () => {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    if (caps.length < 16) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(1500);

  // Its only caller is unwired, so we expect zero — but if any did occur, verify it too.
  for (const cap of caps) {
    const { diffs } = contractDiffs(cap, loc_3fc0);
    assert.equal(diffs.length, 0, `unexpected real 0x3FC0 dispatch diverged: ${diffs.join("; ")}`);
  }
  console.log(`  REACHABILITY: ${caps.length} natural 0x3FC0 dispatches in 1500 attract frames (expected 0)`);
});
