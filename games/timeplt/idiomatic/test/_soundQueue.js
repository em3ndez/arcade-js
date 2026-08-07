// SPDX-License-Identifier: GPL-3.0-only
/**
 * Shared plumbing for the sound-request family's equivalence gates (0x560C, 0x5617, 0x5628,
 * 0x562A and the entry shims that tail-jump into them). Three things every gate needs:
 *
 *   1. A PRISTINE ENTRY. `captureEntry` returns null rather than throwing when the shared tape
 *      never reaches an address — several entries here are dispatched only through paths it does
 *      not drive, and those gates say so and run from a crafted entry taken at the tail. Every
 *      caller asserts on the null, so it can never be read as a pass.
 *   2. A MASKED DIFF. Each oracle brackets its work with `push hl` / `push af`, and the enqueue
 *      body pushes a return address for its restart, so up to six dead bytes below the entry
 *      stack pointer differ from the stack-free rewrite. `outsideScratch` returns every
 *      divergence NOT in that window, so the exclusion cannot quietly widen into real memory.
 *      The window is an upper bound, not a prediction.
 *   3. THE COMMAND BYTE OFF THE STACK. The body at 0x562A recovers its command with `pop af`, so
 *      at its entry the byte is the high half of the pushed pair; `spilledCommand` is that read.
 *
 * `withPokedImage` exists because the ROM buffer is shared by every clone and is not part of
 * dumpState: it is how a gate shows a shim really READS its code byte rather than baking it in.
 */
import { makeMachine, ENTRY_FRAMES } from "./_harness.js";
import { buildRoutines } from "../../routines.js";

/** The queue's first cell: how many sound codes are waiting. The entries follow it. */
export const QUEUE_LENGTH = 0xac43;

/** The second permission cell 0x5617 consults — the demo-sound switch, unpacked once at boot. */
export const DEMO_SOUNDS = 0xa9c6;

const oracles = buildRoutines();

/** The frozen oracle registered at an address. */
export const oracleAt = (addr) => oracles.get(addr);

const captured = new Map();

/** The machine cloned at `target`'s FIRST dispatch under the shared tape, or null. */
export function captureEntry(target, frames = ENTRY_FRAMES) {
  if (captured.has(target)) return captured.get(target);
  const oracle = oracleAt(target);
  if (!oracle) throw new Error(`no oracle registered at 0x${target.toString(16)}`);
  let entry = null;
  const host = makeMachine(
    new Map([
      [
        target,
        (mm) => {
          if (entry === null) entry = mm.clone();
          return oracle(mm);
        },
      ],
    ]),
  );
  host.runFrames(frames);
  if (host.stoppedBy) throw new Error(`capture run stopped early: ${host.stoppedBy}`);
  captured.set(target, entry);
  return entry;
}

/** Every differing byte of two state dumps, as {addr, a, b} — the scratch window included. */
export function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** Those divergences falling OUTSIDE [sp - bytes, sp) — the ones that are real. */
export function outsideScratch(a, b, sp, bytes) {
  return allDiffs(a, b).filter((d) => d.addr === null || d.addr < sp - bytes || d.addr >= sp);
}

/** First real divergence, or null. */
export function realDiff(a, b, sp, bytes) {
  return outsideScratch(a, b, sp, bytes)[0] ?? null;
}

/** The command byte the entry prologue spilled. */
export const spilledCommand = (m) => m.mem8[(m.regs.sp + 1) & 0xffff];

/** Run `body` with one program-image byte forced, then put it back whatever happens. */
export function withPokedImage(m, addr, value, body) {
  const image = m.mem.rom;
  const was = image[addr];
  image[addr] = value;
  try {
    return body();
  } finally {
    image[addr] = was;
  }
}

export const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
export const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");
