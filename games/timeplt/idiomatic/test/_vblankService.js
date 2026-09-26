// SPDX-License-Identifier: GPL-3.0-only
/**
 * Shared plumbing for the vertical-blank service gates — 0x0066 (the vector), 0x00D8 (the entry the
 * vector jumps to), 0x00D9 (the service body) and 0x0174 (its close). The four rewrites are the
 * DISSOLVED form of one interrupt: the idiomatic engine fires the interrupt as a direct JS call
 * (machine.js fireNmi, `idiomaticNmi`), so there is no pushed resume address, no register-bank
 * save and restore, no trampoline slot for the phase arm to return through, and no final `ret`.
 * The frozen oracle keeps all of that — it is a real Z80 on a real stack — so what the two share is
 * the service's product, and that is what every gate here compares:
 *
 *   1. MEMORY outside the dead stack scratch. The window is [the lowest SP the ORACLE's own pushes
 *      reach, the entry SP): the banks it stacks, the trampoline slot, the arm's nested return
 *      words — each dead the moment it is popped. Measured per entry by instrumenting the oracle's
 *      push16, never assumed; every gate also pins that the floor stays above all game data.
 *   2. DEVICES — the control latches, the watchdog kicks, the sound latch and the unmapped-access
 *      counters, none of which the state dump carries.
 *   3. SP. Called directly, the rewrite leaves SP where it found it: it pops no slot, because its
 *      direct caller lays none down. Where the address is a dispatchable routine (`placedAt`), the
 *      rewrite placed through the game's dispatch seam (withOmittedRet) must land SP and pc exactly
 *      where the oracle's own `ret` does — the seam supplies the omitted ret.
 *
 * The REGISTER FILE is not compared, deliberately and by construction: the oracle restores the
 * interrupted code's registers because a Z80 foreground can hold state in them across an interrupt;
 * the idiomatic foreground holds none (the interrupt fires at the drain loop's yield, where every
 * value it uses is re-read from memory), so no register is live-out of the dissolved interrupt. The
 * whole-game gates (games/timeplt/test/idiomatic.test.js SP-INERT and idiomatic/test/idiomatic.test.js
 * byte-for-byte against the cycle-driven oracle) are what establish that in the running game.
 *
 * ⚠ CONSEQUENCE, stated: the dissolved rewrites are NOT register-faithful drop-in overrides for the
 * CYCLE-DRIVEN engine, where a translated foreground is live in registers when the interrupt lands.
 * Measured: wired at 0x0066 under runFrames (through the seam) the translated foreground faults on
 * an unmapped write into ROM. The cycle engine keeps the frozen vector; only runIdiomaticGame fires
 * the rewrite, and it fires it directly.
 */
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES } from "./_harness.js";
import { buildRoutines } from "../../routines.js";
import { withOmittedRet } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

/** Every game-data write lands at or below here; the stack seats far above it. */
export const DATA_TOP = 0xadff;

export const TAPES = [
  ["attract", { tape: [] }],
  ["coin-start", {}],
];

export const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

/** Decoded graphics make a clone slow and nothing here renders. */
export function lean(mm) {
  mm.assets = {};
  mm.video = null;
  return mm;
}

const frozen = buildRoutines();
const cache = new Map();

/**
 * Entries at every `stride`-th dispatch of `target` in the cycle-driven ORACLE run (the frozen
 * routine registered there runs every dispatch), up to `limit`. Asserts the run went the distance.
 */
export function captureAt(target, label, opts, { limit = 120, stride = 1 } = {}) {
  const key = `${target}|${label}|${limit}|${stride}`;
  if (cache.has(key)) return cache.get(key);
  const body = frozen.get(target);
  const entries = [];
  let seen = 0;
  const m = makeMachine(
    new Map([[target, (mm, ...args) => {
      if (entries.length < limit && seen % stride === 0) entries.push(lean(mm.clone()));
      seen++;
      return body(mm, ...args);
    }]]),
    opts,
  );
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the ${label} capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, `the ${label} capture run ran short`);
  cache.set(key, entries);
  return entries;
}

/** Everything the state dump does NOT carry, so a device write cannot hide from a gate. */
export const deviceSignature = (c) =>
  `${[...c.io.latch].join(",")}|wd=${c.io.watchdogKicks}|snd=${c.io.soundData}` +
  `|ur=${c.mem.unmappedReads}|uw=${c.mem.unmappedWrites}`;

/** Run a frozen routine on a clone, recording the lowest SP its own pushes reach. */
export function runOracle(oracle, entry) {
  const m = entry.clone();
  const seat = m.regs.sp;
  let low = seat;
  const push = m.push16.bind(m);
  m.push16 = (v) => {
    const r = push(v);
    if (m.regs.sp < low) low = m.regs.sp;
    return r;
  };
  let threw = null;
  try {
    oracle(m);
  } catch (e) {
    threw = String(e?.message ?? e).slice(0, 60);
  }
  return { m, seat, low, threw };
}

function runRewrite(candidate, entry) {
  const m = entry.clone();
  let threw = null;
  try {
    candidate(m);
  } catch (e) {
    threw = String(e?.message ?? e).slice(0, 60);
  }
  return { m, threw };
}

/**
 * The dissolved contract on one entry: null when oracle and rewrite agree on memory outside the
 * oracle's dead stack scratch, on every device, and on SP (unmoved when called directly; with
 * `placedAt`, placed through the seam, level with the oracle and on the same pc). Otherwise the
 * first disagreement, as a string.
 */
export function dissolvedDiff(oracle, candidate, entry, { placedAt = null } = {}) {
  const o = runOracle(oracle, entry);
  const r = runRewrite(candidate, entry);
  if (o.threw !== r.threw) return `threw ${o.threw} vs ${r.threw}`;
  const dead = (addr) => addr != null && addr >= o.low && addr < o.seat;
  const d = firstStateDiff(o.m.dumpState(), r.m.dumpState(), (off) => o.m.stateOffsetToAddr(off), dead);
  if (d) return `${hex4(d.addr ?? 0)}: frozen=${d.a} rewrite=${d.b}`;
  const sa = deviceSignature(o.m);
  const sb = deviceSignature(r.m);
  if (sa !== sb) return `devices ${sa} vs ${sb}`;
  if (r.m.regs.sp !== entry.regs.sp) {
    return `called directly the rewrite moved SP ${hex4(entry.regs.sp)} -> ${hex4(r.m.regs.sp)}`;
  }
  if (placedAt !== null) {
    const p = entry.clone();
    withOmittedRet(candidate, placedAt)(p);
    if (p.regs.sp !== o.m.regs.sp) return `placed SP ${hex4(p.regs.sp)} vs the oracle's ${hex4(o.m.regs.sp)}`;
    if (p.pc !== o.m.pc) return `placed pc ${hex4(p.pc)} vs the oracle's ${hex4(o.m.pc)}`;
  }
  return null;
}

/** The oracle's dead-stack depth below the seat on one entry (bytes). */
export const oracleDepth = (oracle, entry) => {
  const o = runOracle(oracle, entry);
  return o.seat - o.low;
};

/** Bytes of the whole dump the oracle moves from an entry — the vacuity guard. */
export function footprint(oracle, entry) {
  const before = entry.dumpState().slice();
  const o = runOracle(oracle, entry);
  const now = o.m.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) n++;
  return n;
}
