// SPDX-License-Identifier: GPL-3.0-only
/**
 * 0x5277 — NOT A ROUTINE. This is a reachability proof, not an equivalence gate, and there is no
 * `loc_5277.js` to gate: nothing in the image reaches the address, so there is no behaviour for a
 * rewrite to be equivalent to and a module would be an invention.
 *
 * WHAT THE BYTES ARE. Decoded from 0x5277 they are real, sensible code — an eight-bit sum over the
 * 256 bytes starting at 0x27DE, less 0xC5, and a call taken only if the remainder is non-zero. The
 * address that call names is read as a DATA TABLE by an instruction elsewhere in the image, so
 * taking it would execute data. That is the shape of an anti-tamper trap: inert on a genuine image,
 * fatal on an altered one. The CHECKSUM arm below computes the sum from the shipped ROM and shows
 * it is exactly 0xC5, so even if the block were entered the guarded call would not be taken.
 *
 * ★ AN ABSENCE IS EVIDENCE ONLY WITH A POSITIVE CONTROL, so every arm here runs its scan a second
 *   time against an address that IS reached, in the same breath, and asserts a hit. Two of the
 *   controls are chosen deliberately: 0x5286, which is the live entry to this same region and is
 *   named by an ordinary call; and 0x181E, which no instruction branches to at all and which is
 *   reached only because its little-endian word sits in an inline dispatch table — so the scans are
 *   shown to catch the table-pointer form, which is the way an address hides from a branch scan.
 *
 * WHY THE ABSOLUTE SCAN IS COMPLETE, since it uses no disassembler. Every Z80 form that names an
 * absolute address — every `call`, every `jp`, and every sixteen-bit immediate load that could put
 * one in a register — carries that address as a little-endian word in the instruction stream, and
 * so does a pointer in a table. A scan for the word at EVERY byte offset therefore cannot miss one,
 * whatever the instruction alignment. Only the relative forms escape it, and they are scanned
 * separately, exactly.
 *
 * WHAT IT DOES NOT ESTABLISH, stated rather than implied:
 *   - A jump through a register whose value was COMPUTED rather than loaded is not covered. Nothing
 *     here rules that out; it is the one channel a byte scan cannot see.
 *   - A HIT in the word scan is not a reference. The control address 0x181E matches at a second
 *     offset that lies inside a table of coordinate pairs, straddling two of them. Only a MISS is
 *     conclusive, and that asymmetry is why the absence and not the hits carries the argument.
 *   - The execution arms speak for the states these two tapes drive, and for no others.
 *
 * Run: node --test games/timeplt/idiomatic/test/unreachable-5277.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { buildRoutines } from "../../routines.js";

const TARGET = 0x5277;

/** Reached by an ordinary call, and the live entry to the region this block sits in. */
const CALLED_CONTROL = 0x5286;
/** Reached by NO branch at all — only by its word sitting in an inline dispatch table. */
const TABLE_CONTROL = 0x181e;

const PROGRAM_BYTES = 0x6000;
const CHECKSUM_FROM = 0x27de;
const CHECKSUM_LENGTH = 256;
const CHECKSUM_EXPECTED = 0xc5;
const GUARDED_TARGET = 0x53d4;
/** The instruction elsewhere that reads the guarded address as the base of a byte table. */
const TABLE_READER = 0x536a;

const RETURN_OPCODE = 0xc9;
const RELATIVE_OPCODES = [0x10, 0x18, 0x20, 0x28, 0x30, 0x38];

/** A relative branch inside the block itself, so the relative scan is shown to work on these bytes. */
const SELF_LOOP_TARGET = 0x527d;
const SELF_LOOP_FROM = 0x527f;

const CORPUS_FRAMES = 2500;
const SESSIONS = [
  ["coin-start", {}],
  ["demo", { tape: [] }],
];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

let imageCache = null;
function image() {
  if (imageCache === null) {
    const m = makeMachine();
    imageCache = new Uint8Array(PROGRAM_BYTES);
    for (let at = 0; at < PROGRAM_BYTES; at++) imageCache[at] = m.mem8[at];
  }
  return imageCache;
}

/** Every offset where the little-endian word for `addr` appears, at any alignment. */
function wordOffsets(addr) {
  const rom = image();
  const low = addr & 0xff;
  const high = (addr >> 8) & 0xff;
  const out = [];
  for (let at = 0; at < rom.length - 1; at++) if (rom[at] === low && rom[at + 1] === high) out.push(at);
  return out;
}

/** Every offset holding a relative-branch opcode whose displacement lands on `addr`. */
function relativeOffsets(addr) {
  const rom = image();
  const out = [];
  for (let at = 0; at < rom.length - 1; at++) {
    if (!RELATIVE_OPCODES.includes(rom[at])) continue;
    const displacement = (rom[at + 1] << 24) >> 24;
    if (((at + 2 + displacement) & 0xffff) === addr) out.push(at);
  }
  return out;
}

/** How many times each address is entered, over one session, by the machine's own dispatch. */
function dispatchCounts(opts, addresses) {
  const base = buildRoutines();
  const counts = new Map(addresses.map((a) => [a, 0]));
  const overrides = new Map();
  for (const addr of addresses) {
    const frozen = base.get(addr);
    assert.notEqual(frozen, undefined, `${hex4(addr)} is not in the dispatch table at all`);
    overrides.set(addr, (mm, ...args) => {
      counts.set(addr, counts.get(addr) + 1);
      return frozen(mm, ...args);
    });
  }
  const m = makeMachine(overrides, opts);
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return counts;
}

// ── the proof ───────────────────────────────────────────────────────────────────────────

test("NO ABSOLUTE REFERENCE: the word for this address is nowhere in the image", { skip }, () => {
  const hits = wordOffsets(TARGET);
  const called = wordOffsets(CALLED_CONTROL);
  const tabled = wordOffsets(TABLE_CONTROL);
  assert.ok(called.length > 0, "the scan cannot even find an address the ROM plainly calls, so a " +
    "zero for the target measures the scan and not the ROM");
  assert.ok(tabled.length > 0, "the scan cannot find an address reached only through a dispatch " +
    "table, which is exactly the form it exists to catch");
  assert.deepEqual(hits, [], `something in the image names ${hex4(TARGET)} at ${hits.map(hex4)}`);
  console.log(
    `  NO ABSOLUTE REFERENCE: ${hex4(TARGET)} 0 hits; controls ${hex4(CALLED_CONTROL)} ` +
      `${called.map(hex4)} and ${hex4(TABLE_CONTROL)} ${tabled.map(hex4)}`,
  );
});

test("NO RELATIVE BRANCH: nothing in the image branches to it by displacement", { skip }, () => {
  const hits = relativeOffsets(TARGET);
  const control = relativeOffsets(SELF_LOOP_TARGET);
  assert.deepEqual(control, [SELF_LOOP_FROM], "the relative scan no longer finds the loop that " +
    "sits INSIDE this very block, so it is not reading these bytes the way this file assumes");
  assert.deepEqual(hits, [], `a relative branch at ${hits.map(hex4)} lands on ${hex4(TARGET)}`);
  console.log(
    `  NO RELATIVE BRANCH: ${hex4(TARGET)} 0 hits; the control at ${hex4(SELF_LOOP_FROM)} is found`,
  );
});

test("NOTHING FALLS IN: the byte before it ends a routine", { skip }, () => {
  assert.equal(image()[TARGET - 1], RETURN_OPCODE, "the byte before the target is no longer a " +
    "return, so execution reaching it from above is newly possible and this file is stale");
  console.log(`  NOTHING FALLS IN: ${hex4(TARGET - 1)} holds a return`);
});

test("NEVER DISPATCHED: two tapes reach it zero times, and the same tap sees a live entry", { skip }, () => {
  for (const [label, opts] of SESSIONS) {
    const counts = dispatchCounts(opts, [TARGET, CALLED_CONTROL]);
    assert.ok(
      counts.get(CALLED_CONTROL) > 0,
      `the ${label} tap counts zero at ${hex4(CALLED_CONTROL)} too, so a zero at the target says ` +
        "nothing about the ROM",
    );
    assert.equal(counts.get(TARGET), 0, `the ${label} session entered ${hex4(TARGET)}`);
    console.log(
      `  NEVER DISPATCHED: ${label} — ${hex4(TARGET)} 0, control ${hex4(CALLED_CONTROL)} ` +
        `${counts.get(CALLED_CONTROL)}`,
    );
  }
});

test("THE FROZEN ENTRY REFUSES: anything reaching it raises rather than running", { skip }, () => {
  const frozen = buildRoutines().get(TARGET);
  const m = makeMachine();
  assert.throws(() => frozen(m), /5277/, "the frozen entry no longer refuses, so a future caller " +
    "would run whatever a transcription of these bytes happens to do, silently");
  console.log("  THE FROZEN ENTRY REFUSES: entering it raises");
});

test("CHECKSUM: the sum the block computes is the value it tests for", { skip }, () => {
  const rom = image();
  let sum = 0;
  for (let i = 0; i < CHECKSUM_LENGTH; i++) sum = (sum + rom[CHECKSUM_FROM + i]) & 0xff;
  assert.equal(sum, CHECKSUM_EXPECTED, "the sum over the guarded block no longer matches the " +
    "constant this code subtracts, so either the image or this file's account of it has changed");
  assert.ok(
    wordOffsets(GUARDED_TARGET).includes(TABLE_READER + 1),
    `${hex4(GUARDED_TARGET)} is no longer loaded as a table base at ${hex4(TABLE_READER)}, so the ` +
      "reading that the guarded call would enter data is no longer supported",
  );
  console.log(
    `  CHECKSUM: ${CHECKSUM_LENGTH} bytes from ${hex4(CHECKSUM_FROM)} sum to ` +
      `${hex4(sum).slice(-2)}; ${hex4(GUARDED_TARGET)} is a table base at ${hex4(TABLE_READER)}`,
  );
});
