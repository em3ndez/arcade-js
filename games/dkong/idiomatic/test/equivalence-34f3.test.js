// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for publishFireSprites (ROM 0x34F3) — the five-object -> five-sprite-record
 * gather.
 *
 * publishFireSprites walks the five-record object array OBJ_ARRAY_64 (stride 0x20) and, for each
 * record whose occupancy flag (+0) is non-zero, copies fields +3/+7/+8/+5 into a 4-byte
 * destination record at 0x69D0 (bytes +0/+1/+2/+3). Empty objects are skipped but still
 * consume a destination record so records stay object-aligned. It calls nothing and its
 * observable effect is memory (the 0x69D0 region); the oracle's terminal return is dead
 * ABI, so the contract is memory-only (RAM over the whole dump).
 *
 * The routine IS reached in a live run: ROM 0x30F6 is not a routine, it is the `call 0x34f3`
 * INSIDE loc_30ed, and loc_30ed calls publishFireSprites directly today. (An earlier version of
 * this header said its "sole caller, ROM 0x30F6, is not translated" and that the routine was
 * unwired; both halves were stale.) Its natural traffic is sourced from loc_30ed's own GATE —
 * 1532 natural loc_30ed dispatches over 4000 attract frames, 481 of them on the full arm that
 * reaches here. The gate below is nonetheless CRAFTED rather than captured, because the crafted
 * set is what proves the equivalence: it drives occupancy patterns no attract run produces.
 * Built from CRAFTED entries on a realistic attract base:
 *
 *   1. EQUAL (occupancy patterns) — the FULL 32 combinations of "each of the five
 *      objects empty or occupied". Occupied objects carry per-object, per-field distinct
 *      values (so any wrong field, wrong order, or wrong record shows), and the whole
 *      destination region is pre-patterned with 0xAA so both a spurious write (over an
 *      empty record) and a missing write show up in the diff. Covers every empty/occupied
 *      mix, hence pointer-alignment across empties.
 *
 *   2. EQUAL (flag semantics) — occupancy is "non-zero", not "bit0 set": objects flagged
 *      0x80 / 0xFF / 0x02 are all occupied. One all-occupied case per flag value.
 *
 *   3. TEETH — three deliberately-broken twins, each of which the SAME crafted suite
 *      MUST catch:
 *        (a) swapped field order (tile code and attribute exchanged) — caught on any
 *            occupied record where code != attr.
 *        (b) bit0-only occupancy (treats an even flag as empty) — caught on a 0x80-flag
 *            object the oracle gathers but the twin skips.
 *        (c) empty does not advance the destination — caught by a mixed pattern where an
 *            occupied record after an empty one lands at the wrong destination address.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-34f3.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_34f3 as oracle } from "../../translated/loc_34f3.js";
import { publishFireSprites } from "../publishFireSprites.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  OBJ_ARRAY_64,
  OBJ_ACTIVE,
  OBJ_X,
  OBJ_Y,
  OBJ_SPRITE_CODE,
  OBJ_SPRITE_ATTR,
} from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const OBJECT_COUNT = 5;
const OBJECT_STRIDE = 0x20;
const GATHER_DEST = 0x69d0;
// The oracle ends with a return that only READS the stack; point SP at work RAM so that
// read is well-defined. It writes no RAM through the stack, so this never affects the
// compared memory (publishFireSprites models no stack at all).
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A real, self-consistent machine: boot + a stretch of attract so the surrounding work
// RAM (and the sprite buffer around 0x69D0) holds realistic values. The five source
// objects and the destination region are then set explicitly per case.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

// Lay out the five source objects and pre-pattern the five destination records.
// `objects[i]` is either { flag } (empty) or { flag, x, code, attr, y } (occupied).
function craft(base, objects, destFill = 0xaa) {
  const m = base.clone();
  m.regs.sp = SAFE_SP;
  for (let a = GATHER_DEST; a < GATHER_DEST + OBJECT_COUNT * 4; a++) m.mem.write8(a, destFill);
  objects.forEach((obj, i) => {
    const b = OBJ_ARRAY_64 + i * OBJECT_STRIDE;
    m.mem.write8(b + OBJ_ACTIVE, obj.flag & 0xff);
    if (obj.flag !== 0) {
      m.mem.write8(b + OBJ_X, obj.x & 0xff);
      m.mem.write8(b + OBJ_SPRITE_CODE, obj.code & 0xff);
      m.mem.write8(b + OBJ_SPRITE_ATTR, obj.attr & 0xff);
      m.mem.write8(b + OBJ_Y, obj.y & 0xff);
    }
  });
  return m;
}

// Run oracle and candidate on two fresh, byte-identical clones and diff RAM over the
// whole dump (memory-only contract; neither side writes the stack, so no exclusion).
function ramDiff(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();
  a.nextNmi = Infinity; a.nextBoundary = Infinity;
  b.nextNmi = Infinity; b.nextBoundary = Infinity;
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// Occupied object with per-object, per-field distinct values (distinct across fields AND
// objects, so a wrong field / wrong order / wrong record all diverge).
const occ = (i) => ({ flag: 0x01, x: 0x10 + i, code: 0x20 + i, attr: 0x30 + i, y: 0x40 + i });
const empty = () => ({ flag: 0x00 });

// -- 1. EQUAL (all 32 occupancy patterns) -------------------------------------

test("EQUAL: publishFireSprites == oracle across all 32 empty/occupied patterns", () => {
  const base = attractBase();
  let count = 0;
  for (let pattern = 0; pattern < (1 << OBJECT_COUNT); pattern++) {
    const objects = [];
    for (let i = 0; i < OBJECT_COUNT; i++) objects.push((pattern >> i) & 1 ? occ(i) : empty());
    const d = ramDiff(craft(base, objects), publishFireSprites);
    assert.equal(d, null, d && `pattern ${pattern.toString(2).padStart(5, "0")}: RAM@${hx(d.addr)} oracle=${d.a} cand=${d.b}`);
    count++;
  }
  assert.equal(count, 32, "must have swept all 32 occupancy patterns");
  console.log(`  EQUAL: ${count} occupancy patterns — RAM identical to the oracle`);
});

// -- 2. EQUAL (occupancy is non-zero, not bit0) -------------------------------

test("EQUAL: non-zero-but-even flags (0x80/0xFF/0x02) are treated as occupied", () => {
  const base = attractBase();
  for (const flag of [0x80, 0xff, 0x02]) {
    const objects = [];
    for (let i = 0; i < OBJECT_COUNT; i++) objects.push({ flag, x: 0x10 + i, code: 0x20 + i, attr: 0x30 + i, y: 0x40 + i });
    const d = ramDiff(craft(base, objects), publishFireSprites);
    assert.equal(d, null, d && `flag ${hx(flag)}: RAM@${hx(d.addr)} oracle=${d.a} cand=${d.b}`);
    // sanity: the oracle really did gather (record +0 of object 0 == its X 0x10).
    const a = craft(base, objects); a.nextNmi = Infinity; a.nextBoundary = Infinity; oracle(a);
    assert.equal(a.mem.read8(GATHER_DEST), 0x10, `flag ${hx(flag)} should have been gathered as occupied`);
  }
  console.log("  EQUAL: flags 0x80/0xFF/0x02 gathered as occupied — RAM identical");
});

// -- 3. TEETH -----------------------------------------------------------------

/** Twin (a): swaps the tile-code and attribute fields into the wrong record bytes. */
function brokenSwapCodeAttr(m) {
  const { mem } = m;
  const srcPage = OBJ_ARRAY_64 & 0xff00;
  let objLo = OBJ_ARRAY_64 & 0xff;
  let dst = GATHER_DEST;
  for (let i = 0; i < OBJECT_COUNT; i++) {
    if (mem.read8(srcPage | ((objLo + OBJ_ACTIVE) & 0xff)) !== 0) {
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_X) & 0xff)));
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_SPRITE_ATTR) & 0xff))); // BUG: attr here
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_SPRITE_CODE) & 0xff))); // BUG: code here
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_Y) & 0xff)));
      dst = (dst + 1) & 0xffff;
    } else {
      dst = (dst & 0xff00) | ((dst + 4) & 0xff);
    }
    objLo = (objLo + OBJECT_STRIDE) & 0xff;
  }
}

/** Twin (b): occupancy test is bit0 only — an even flag reads as empty. */
function brokenBit0Occupancy(m) {
  const { mem } = m;
  const srcPage = OBJ_ARRAY_64 & 0xff00;
  let objLo = OBJ_ARRAY_64 & 0xff;
  let dst = GATHER_DEST;
  for (let i = 0; i < OBJECT_COUNT; i++) {
    if ((mem.read8(srcPage | ((objLo + OBJ_ACTIVE) & 0xff)) & 0x01) !== 0) { // BUG: bit0 only
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_X) & 0xff)));
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_SPRITE_CODE) & 0xff)));
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_SPRITE_ATTR) & 0xff)));
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_Y) & 0xff)));
      dst = (dst + 1) & 0xffff;
    } else {
      dst = (dst & 0xff00) | ((dst + 4) & 0xff);
    }
    objLo = (objLo + OBJECT_STRIDE) & 0xff;
  }
}

/** Twin (c): empty objects do NOT advance the destination — records misalign. */
function brokenEmptyNoAdvance(m) {
  const { mem } = m;
  const srcPage = OBJ_ARRAY_64 & 0xff00;
  let objLo = OBJ_ARRAY_64 & 0xff;
  let dst = GATHER_DEST;
  for (let i = 0; i < OBJECT_COUNT; i++) {
    if (mem.read8(srcPage | ((objLo + OBJ_ACTIVE) & 0xff)) !== 0) {
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_X) & 0xff)));
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_SPRITE_CODE) & 0xff)));
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_SPRITE_ATTR) & 0xff)));
      dst = (dst & 0xff00) | ((dst + 1) & 0xff);
      mem.write8(dst, mem.read8(srcPage | ((objLo + OBJ_Y) & 0xff)));
      dst = (dst + 1) & 0xffff;
    } else {
      /* BUG: no destination advance for empty objects */
    }
    objLo = (objLo + OBJECT_STRIDE) & 0xff;
  }
}

test("TEETH: swapped-field, bit0-occupancy, and empty-no-advance twins are all CAUGHT", () => {
  const base = attractBase();

  // (a) swapped code/attr — an all-occupied case (code 0x20+i != attr 0x30+i).
  const allOcc = [];
  for (let i = 0; i < OBJECT_COUNT; i++) allOcc.push(occ(i));
  const swapDiff = ramDiff(craft(base, allOcc), brokenSwapCodeAttr);
  assert.notEqual(swapDiff, null, "the swapped-field twin escaped — the gate is worthless");

  // (b) bit0-only occupancy — object flagged 0x80 (occupied, even). Oracle gathers it,
  // the twin skips it, leaving the 0xAA pre-pattern.
  const evenFlag = [];
  for (let i = 0; i < OBJECT_COUNT; i++) evenFlag.push({ flag: 0x80, x: 0x10 + i, code: 0x20 + i, attr: 0x30 + i, y: 0x40 + i });
  const bit0Diff = ramDiff(craft(base, evenFlag), brokenBit0Occupancy);
  assert.notEqual(bit0Diff, null, "the bit0-occupancy twin escaped — the gate is worthless");

  // (c) empty-no-advance — mixed pattern [empty, occupied, empty, occupied, empty].
  const mixed = [empty(), occ(1), empty(), occ(3), empty()];
  const advDiff = ramDiff(craft(base, mixed), brokenEmptyNoAdvance);
  assert.notEqual(advDiff, null, "the empty-no-advance twin escaped — the gate is worthless");

  console.log(
    `  TEETH: swapped-field caught (RAM@${hx(swapDiff.addr)}); ` +
      `bit0-occupancy caught (RAM@${hx(bit0Diff.addr)}); ` +
      `empty-no-advance caught (RAM@${hx(advDiff.addr)})`,
  );
});
