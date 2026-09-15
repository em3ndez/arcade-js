// SPDX-License-Identifier: GPL-3.0-only
//
// frame-tear -- the teeth for the worker->reader frame delivery (web/frame-ring.js). The reader used to copy
// each frame pixel-by-pixel straight out of a 2-slot shared ring with no re-check, so a stalled reader could
// be overwritten mid-copy by the writer -> a torn frame (junk lines / weird text, worst on vector games).
// The live tear is a rare jank race that can't be triggered on demand, so this proves the fix deterministically:
// a POSITIVE CONTROL reproduces tearing on the old 2-slot per-pixel reader, and the shipped ring
// (SLOTS/snapshotFrame) is shown to NEVER present a torn frame -- it either snapshots one consistent frame or
// discards when the writer laps. Node's set() is atomic, so tearing is modelled by an injectable mid-copy lap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SLOTS, writeBase, snapshotFrame } from "../frame-ring.js";

const FB = 16; // stand-in FRAME_BYTES (small)

// A tiny model of the shared ring matching the worker: publish() fills slot (counter % slots) then bumps the
// counter, so after publishing frame N the counter is N+1 and frame N lives in slot N%slots -- exactly what
// the reader targets as (counter-1)%slots.
function makeRing(slots) {
  const fb = new Uint8Array(slots * FB);
  let counter = 0;
  return {
    fb,
    get counter() { return counter; },
    publish(val) { const b = (counter % slots) * FB; fb.fill(val, b, b + FB); counter += 1; },
  };
}
const torn = (buf) => new Set(buf).size > 1;

test("the ring has slack (SLOTS >= 3) -- the writer needs 3 frames to reach the reader's slot", () => {
  assert.ok(SLOTS >= 3, `SLOTS is ${SLOTS}; a 2-slot ring has zero reader slack and tears`);
});

test("POSITIVE CONTROL: the old 2-slot per-pixel reader TEARS when the writer laps mid-copy", () => {
  const r = makeRing(2);
  r.publish(1);                           // frame 1 -> slot 0 (the reader's slot below)
  const c = r.counter;                    // reader targets slot (c-1)%2
  const base = (((c - 1) % 2) + 2) % 2 * FB;
  const out = new Uint8Array(FB);
  for (let i = 0; i < FB; i++) {
    if (i === FB >> 1) { r.publish(0xAA); r.publish(0xBB); } // writer laps 2 frames mid per-pixel copy
    out[i] = r.fb[base + i];              // per-pixel read straight from shared memory (the old bug)
  }
  assert.ok(torn(out), "old 2-slot reader did NOT tear -- the test cannot detect tearing (control is broken)");
});

test("snapshotFrame presents ONE consistent frame when the writer advances < SLOTS-1 (slack)", () => {
  const r = makeRing(SLOTS);
  r.publish(1);                           // frame 1 -> the reader's slot (counter now 1)
  const c = r.counter;                    // reader's slot = (c-1)%SLOTS holds frame value 1
  for (let k = 0; k < SLOTS - 2; k++) r.publish(0x40 + k); // advance SLOTS-2 -> the OTHER slots, not ours
  const snap = new Uint8Array(FB);
  const present = snapshotFrame(r.fb, snap, FB, c, () => r.counter);
  assert.equal(present, true, "should present: writer advanced < SLOTS-1, reader's slot cannot be mid-write");
  assert.ok(!torn(snap) && snap[0] === 1, `snapshot is not the single clean frame: [${[...snap]}]`);
});

// BOUNDARY: the frame that overwrites the reader's slot (counter-1) is index counter+SLOTS-1, and the counter
// still reads counter+SLOTS-1 WHILE that fill is in flight (the bump happens after). So advance == SLOTS-1 must
// DISCARD -- a naive `< SLOTS` guard would wrongly present here, admitting a torn frame.
test("snapshotFrame DISCARDS at advance == SLOTS-1 (the slot-overwriting frame's counter -- mid-write possible)", () => {
  const r = makeRing(SLOTS);
  r.publish(1);
  const c = r.counter;
  for (let k = 0; k < SLOTS - 1; k++) r.publish(0x40 + k); // advance SLOTS-1
  const snap = new Uint8Array(FB);
  const present = snapshotFrame(r.fb, snap, FB, c, () => r.counter);
  assert.equal(present, false, "must discard at advance==SLOTS-1: the overwriting frame's fill may be in flight");
});

test("snapshotFrame DISCARDS when the writer laps >= SLOTS during the copy", () => {
  const r = makeRing(SLOTS);
  const c = r.counter;
  const snap = new Uint8Array(FB);
  const present = snapshotFrame(r.fb, snap, FB, c, () => c + SLOTS); // writer lapped the ring mid-copy
  assert.equal(present, false, "must discard: the writer lapped the reader's slot -> a torn frame is possible");
});

test("snapshotFrame NEVER presents a torn frame across every lap count 0..2*SLOTS", () => {
  for (let advance = 0; advance <= 2 * SLOTS; advance++) {
    const r = makeRing(SLOTS);
    for (let w = 0; w < 5; w++) r.publish(0x50 + w);        // warm the counter
    const c = r.counter;
    const snap = new Uint8Array(FB);
    const present = snapshotFrame(r.fb, snap, FB, c, () => c + advance);
    if (present) assert.ok(!torn(snap), `presented a torn frame at advance=${advance}: [${[...snap]}]`);
  }
});
