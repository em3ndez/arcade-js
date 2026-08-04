// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Donkey Kong machine: address space + I/O + register file, plus the
 * frame accounting both validation modes are indexed by.
 *
 * FRAME SAMPLING CONTRACT (do not drift): state and frame buffers
 * are sampled at the frame boundary BEFORE that frame's CPU execution.
 *   state[0] = power-on state, before a single instruction runs
 *   state[N] = state after frames 0..N-1 have executed
 * This matches what MAME's frame notifier provides, so both sides sample
 * identically. Sampling after execution instead puts every frame off by one
 * and reads as a translation bug.
 */

import { AddressSpace } from "../../boards/dkong/memory.js";
import { IO, Inputs, NotImplemented } from "../../boards/dkong/io.js";
import { Regs } from "../../core/cpu/z80.js";
import { makeIndexedView } from "../../core/mem-views.js";
import { loc_0000 as romReset } from "./translated/loc_0000.js";
import { bootOnly } from "./translated/bootOnly.js";
import { loc_0066 } from "./translated/loc_0066.js";
import { ORACLE_ROUTINES, buildRoutines } from "./routines.js";
import {
  buildPalette, CYCLES_PER_LINE, decodeSprites, decodeTiles, drawSprites,
  renderFrameRGB, renderRowRGB,
  SCREEN_H, splitProms, VBLANK_LINES,
} from "../../boards/dkong/video.js";

/**
 * Z80 T-states per video frame, DERIVED not fitted:
 *
 *   frame rate = pixclock / (htotal * vtotal) = 6144000 / (384 * 264)
 *              = 60.606060... Hz
 *   cycles     = 3072000 / 60.60606... = 50688 exactly
 *
 * It comes out an exact integer, which is a good sign we have the right
 * numbers rather than approximately the right ones.
 *
 * WHY CYCLE COUNTING IS NEEDED AT ALL: boot's RAM clear is ~29 T-states per
 * byte (ld (hl),a=7, inc hl=6, dec c=4, jr nz taken=12) over 6144 bytes,
 * which is 3.5 frames. So the first several frame boundaries fall INSIDE the
 * boot loops, and state[1..3] cannot be produced by "run boot, then sample" --
 * they require suspending mid-loop at the exact cycle the boundary lands on.
 */
export const CYCLES_PER_FRAME = 50688;

/**
 * The vblank NMI asserts AT THE FRAME BOUNDARY -- cycle N * 50688 -- not
 * partway into the frame.
 *
 * This was measured by tapping reads of 0x0066 (the NMI vector, so the
 * tap fires when the handler's first byte is fetched): NMI entries at 202771,
 * 253451, 304141, 354826, 405518, 456213 -- every one at frame N.000x.
 *
 * A PREVIOUS VERSION HAD 46080 HERE, from 50688 * 240 / 264 (VBSTART/VTOTAL).
 * That arithmetic is correct; the ERROR WAS UPSTREAM OF IT. MAME's frame
 * origin for this driver is the vblank point itself, not the top of the
 * visible display, so "46080 cycles into the frame" measures from the wrong
 * origin. Worth recording because the failure mode is instructive: the
 * constant was not slightly off, the REFERENCE FRAME was wrong, and fitting
 * a better-looking number would have made one frame agree while hiding that.
 *
 * The 10-21 cycle spread in the measurements is the CPU finishing whatever
 * instruction it was in before accepting the interrupt. We do not model that
 * as a constant: the NMI is checked at instruction boundaries, so the jitter
 * falls out of where the boundary happens to land.
 */
export const NMI_CYCLE_IN_FRAME = 0;

/**
 * Thrown to unwind out of the translated code once enough frames have been
 * captured. Boot is a straight-line routine with no "stop here" concept, so
 * the only way to suspend it at an arbitrary cycle is to unwind. Not an
 * error condition -- runFrames() catches it.
 */
export class FramesComplete extends Error {
  constructor() {
    super("requested frame count captured");
    this.name = "FramesComplete";
  }
}

/**
 * SEAM_CALLER_SKIP — ROM addresses whose FROZEN ORACLE twin implements the Z80
 * CALLER-SKIP idiom, so that a `false` return means the oracle consumed TWO stack
 * words rather than one.
 *
 * The idiom (`inc sp / inc sp / ret` or `pop hl / ret`) discards the routine's own
 * return address before returning, so control resumes in the CALLER'S CALLER — the
 * caller is skipped. The idiomatic rewrite models that as a plain `return false`
 * and touches no stack at all (its callers guard it with `if (!f(m)) return;`), so
 * the seam owes TWO brackets on that path, not one. This is the second arm of the
 * same defect the seam closes; without it the flip leaks 2 bytes per skip.
 *
 * DERIVED FROM `translated/`, NOT GUESSED. Every entry either (a) was MEASURED at
 * +4 on its `false` path in an instrumented 600-frame pure-oracle attract run, or
 * (b) has the two-word discard literally in its oracle body immediately before the
 * `ret` that precedes `return false`. Membership is re-derived and asserted by
 * `idiomatic/test/golive.test.js` ("the caller-skip table matches the frozen
 * oracle"), so the table cannot drift away from the oracle silently.
 *
 * WHAT THIS TABLE CANNOT EXPRESS, stated plainly rather than left implicit: a few
 * oracle routines return `false` from MORE THAN ONE path with DIFFERENT stack
 * effects — 0x2B29 skips two words when it tails into 0x2B51, but only one when it
 * propagates 0x2B9B's double-skip (which consumed its words inside 0x2BE1). A
 * per-address table picks one. 0x2B29 is listed for the two-word path because that
 * is the only one reachable in the measured runs; the one-word path needs
 * 0x2BE1's `A <= C` arm, never observed. The exact fix for that class is to move
 * the caller's `push16` into the seam when `translated/` is next regenerated, which
 * makes the bracket explicit instead of inferred. (That analysis lives in a local
 * scratchpad note, which is untracked and does NOT survive a clone — the reasoning
 * is therefore restated here rather than referenced: emit the return address into
 * the seam at the call site, so the callee's bracket is data rather than an
 * inference from adjacency.)
 *
 * DELIBERATELY ABSENT (they return `false` but consume only ONE word, so listing
 * them would make the seam over-pop): 0x2B53 / 0x2B9B / 0x2BE1 (the double-skip is
 * performed inside 0x2BE1, which discards the word 0x2B53 itself pushed — net one
 * bracket at the seam), 0x06B8 (its oracle notes the `false` is NOT a skip signal),
 * and 0x2880 (its oracle's extra word is an ENTRY-side `pop hl` recovering a value
 * its dispatcher pushed, not a skip; its idiomatic twin returns `true` on every
 * path by design).
 */
const SEAM_CALLER_SKIP = new Set([
  // ── added when decompile batch 3 wired these into ROUTINES ──────────────────
  0x1e8c, // runHitEffectInsteadOfPlay  effect-latch frame gate  pop hl / ret  (MEASURED false:+4 x146 of 1938)
  0x30fa, // loc_30fa  difficulty->gate selector pop hl / ret     (MEASURED false:+4 x896 of 1792)
  0x33a1, // loc_33a1  movement-path height gate inc sp x2 / ret  (SOURCE-JUSTIFIED, not measured:
          //   ROM 0x33A1 = `3e 07 f7 dd 7e 0f fe 59 d0 33 33 c9`; the `33 33 c9` tail IS the idiom.
          //   Attract reaches only the `ret nc` arm, so an oracle run CANNOT see this one. (Counts
          //   vary sharply with engine and pin: 13 in a 4000-frame unpinned runCycleFree pass here,
          //   0 in an 8000-frame PINNED run, 49 unpinned — so no single number is quoted. What is
          //   invariant across all of them is that the skip arm is never taken.) —
          //   it is here on the ROM bytes, like the 11 other unmeasured entries below.)
  // ★ 0x3e99 is deliberately NOT here even though its oracle nets +4. That +4 is a consumed
  //   ARGUMENT, not a discarded return address: the dispatcher pushes a bounds word and
  //   idiomatic loc_3e99 pops it ITSELF (`const bounds = m.pop16()`), so the seam's ordinary
  //   one-word bracket already balances the frame. (Listing it would in fact be INERT rather
  //   than harmful — MEASURED: seamWrap applies the skip only under `r === false`, and
  //   loc_3e99 returns a NUMBER (0/1/3/7); the `sp !== spEntry` guard also declines it, since
  //   its own pop16 has already moved SP. It is omitted because it is not a caller-skip, not
  //   because listing it would over-pop — an earlier version of this comment said the latter
  //   and was wrong.)
  //   ★ A +4 measurement alone does not mean caller-skip — check WHICH word was consumed.
  0x0008, // loc_0008 gameActiveGuard      inc sp x2 / ret   (measured false:+4)
  0x0010, // loc_0010 marioActiveGuard     inc sp x2 / ret   (measured false:+4)
  0x0018, // loc_0018 tickSubstateTimer    inc sp x2 / ret   (measured false:+4)
  0x0020, // loc_0020 tickSubstatePrescaler pop hl / ret     (measured false:+4)
  0x0030, // loc_0030 boardBitGate         pop hl / ret      (measured false:+4)
  0x1783, // loc_1783 allSlotsClear        jp 0x0026 -> pop hl / ret
  0x1a2a, // loc_1a2a advanceSubstateWhenGrounded  pop hl + tail 0x19d2 whose ret pops
  0x1e85, // loc_1e85 enterBoardAdvanceAndUnwind   pop hl / ret
  0x2257, // loc_2257                      pop hl / ret
  0x236e, // findOppositeLadderEnd         pop hl / ret
  0x2913, // loc_2913 findCollidingObject  pop ix / inc sp x2 / ret
  0x2b29, // loc_2b29                      tails into 0x2b51 (measured false:+4)
  0x2b51, // loc_2b51                      pop hl / ret      (measured false:+4)
  0x2b74, // loc_2b74                      pop hl / ret
  0x2b91, // loc_2b91                      pop hl / ret
  0x3110, // loc_3110                      inc sp x2 / ret   (measured false:+4)
  0x311b, // loc_311b                      inc sp x2 / ret
  0x3126, // loc_3126                      inc sp x2 / ret
  0x3131, // loc_3131                      inc sp x2 / ret
  0x313c, // spawnRequestedFireAndRecolorLiveFires  inc sp x2 / ret   (measured false:+4)
]);

/**
 * SEAM_TAIL_NO_RET — ROM addresses reached by a translated `jp` TAIL whose frozen
 * oracle twin does NOT return through a `ret`, so the seam must consume nothing.
 *
 * The emitter writes a `jp` tail as a bare `m.call(T)` with no push. Almost every
 * such target ends in `ret` and so consumes the bracket the outermost `call` in the
 * tail chain opened — measured +2 on every tail-entered address in an instrumented
 * 900-frame pure-oracle attract run EXCEPT these four, which are the board-layout
 * walk: 0x0DD3 and its three segment drawers all end by jumping BACK to the walk
 * head at 0x0DA7, so the chain is a loop and its guest-stack delta is exactly 0.
 * Consuming a bracket for them steals a word from the enclosing frame (it shows up
 * immediately as `UnmappedAccess: unmapped read at 0x6c00` when the NMI epilogue
 * then rets off the top of the stack).
 *
 * COVERAGE OF THIS CLAIM, stated rather than implied: the +2 default is measured
 * over the ATTRACT sequence only (900 frames, every tail-entered dispatch). A
 * gameplay-only tail chain that likewise never rets would not be in this set and
 * would over-pop. It would not pass silently — the whole-flip gate in
 * idiomatic/test/golive.test.js asserts SP is unchanged at every vblank yield, and
 * an over-pop drives SP UP, which that assertion catches on the first frame.
 */
const SEAM_TAIL_NO_RET = new Set([
  0x0dd3, // loc_0dd3            jp 0x0da7 -- back to the walk head
  0x0e19, // drawGirderSpan      jp 0x0da7
  0x0e2a, // drawSegmentEndCap   jp 0x0da7
  0x0e4f, // drawLadder          jp 0x0da7
]);

/** Exported so the go-live gate can re-derive both tables from the frozen oracle. */
export { SEAM_CALLER_SKIP, SEAM_TAIL_NO_RET };

/**
 * THE TRANSLATED->IDIOMATIC SEAM: close the Z80 call bracket that a frozen
 * translated caller opened for an idiomatic callee.
 *
 * THE DEFECT THIS EXISTS TO FIX. A translated call site is emitted as
 * `m.push16(RET); m.step(T, 17); m.call(T)` — the push lives in the CALLER and the
 * matching pop lives in the CALLEE's `ret`. That is fine while both sides are
 * translated, and fine while both sides are idiomatic (an idiomatic caller
 * direct-calls its idiomatic callee and emits no push at all). It breaks at the
 * SEAM: a frozen translated caller cannot drop its push, and an idiomatic callee
 * models the `ret` as a plain JS `return` and never pops. Every such transition
 * leaked exactly 2 bytes of guest stack. Under `resolveAllIdiomatic()` that is
 * 12-14 bytes PER FRAME; SP walked from 0x6C00 down into the task ring at
 * 0x60C0-0x60FF by frame 237 and the game died on dispatched stack garbage.
 *
 * WHY HERE AND NOT IN `Machine.call`. There are THREE dispatch paths into an
 * override, not one: `this.routines` (built by copying `this.overrides`), and the
 * two translated computed-`jp` dispatchers that bypass `Machine.call` entirely and
 * invoke `m.overrides.get(target)(m)` directly (`translated/loc_02e3.js` and
 * `translated/loc_00ca.js` — between them exactly the 2 bytes/frame that separated
 * the measured -12 from the -14). Wrapping each override ONCE where it is
 * registered covers all three with one implementation; a fix inside `Machine.call`
 * would cover only two.
 *
 * WHY THE BRACKET IS NOT INFERRED FROM SP. "Is the word at SP an unpopped push?"
 * has a false positive: at a tail-`jp` site emitted as a bare `m.call(T)` with NO
 * push, the word at SP can be a REGISTER SAVE (the NMI prologue's `push hl`), which
 * an SP-only test cannot tell from a call bracket, and popping it corrupts the
 * frame. So the bracket is taken from the EMISSION SHAPE instead, which is exact:
 * the emitter writes the push IMMEDIATELY before the dispatch for a `call` and
 * writes no push at all for a `jp` tail. `lastPushSp === sp at dispatch` is
 * therefore a precise test for "my caller opened a bracket for me", not a heuristic.
 *
 * ★ PRECONDITION, stated because it is load-bearing and easy to lose: adjacency is
 * exact only while nothing can interleave between the emitter's `push16(RET)` and
 * its `m.call(T)`. Both cycle-free engines suppress the scheduler NMI, so it holds
 * everywhere the seam runs today. `runFrames`' `tick()` CAN fire mid-sequence,
 * which would clear `lastPushSp` and under-pop; that path has no override users
 * today (its only callers install delegating hooks), but wiring overrides into a
 * scheduler-driven run would break this assumption and must re-derive the bracket.
 *
 * The computed-`jp` dispatchers are the one case where that adjacency is not
 * visible (0x00CA's continuation is pushed, then `rst 0x28`'s own return address is
 * pushed and popped by `loc_0028` before the target is reached). Those two sites
 * are recognised structurally — they do not go through `Machine.call`, so the
 * wrapper sees no matching dispatch frame — and a dispatched target ALWAYS returns
 * through a continuation its dispatcher's caller pushed, so its bracket is open by
 * construction.
 *
 * SAFETY PROPERTIES worth stating because they are what makes this cheap to trust:
 *   - The consumption is guarded on SP being back where the wrapper entered. A
 *     capturing hook that delegates to the oracle has already let the oracle's
 *     `ret` move SP, so the wrapper declines — self-correcting, no special case.
 *   - Nothing here runs unless at least one override is installed; see the
 *     constructor. With an empty override map the Machine's own prototype methods
 *     are untouched, so the pure-oracle path is unchanged BY CONSTRUCTION.
 *
 * @param {Machine} m
 * @returns {{lastPushSp:number, frames:Array}} the seam's bookkeeping
 */
function installCallBracketSeam(m) {
  const seam = {
    lastPushSp: -1, // guest SP straight after the most recent push16; -1 once invalidated
    frames: [], // one record per Machine.call dispatch: { spEntry, opened, taken }
  };

  const basePush = m.push16.bind(m);
  const basePop = m.pop16.bind(m);
  const baseCall = m.call.bind(m);

  m.push16 = (value) => {
    basePush(value);
    seam.lastPushSp = m.regs.sp;
  };
  m.pop16 = () => {
    seam.lastPushSp = -1; // any pop breaks push/dispatch adjacency
    return basePop();
  };
  m.call = (addr, ...args) => {
    // `opened` is decided HERE, at the dispatch, while the adjacency is still
    // observable: the emitter's `push16(RET); step(...); call(T)` leaves lastPushSp
    // equal to SP, and a bare `call(T)` (a `jp` tail) does not.
    seam.frames.push({ spEntry: m.regs.sp, opened: seam.lastPushSp === m.regs.sp, taken: false });
    try {
      return baseCall(addr, ...args);
    } finally {
      seam.frames.pop();
    }
  };

  return seam;
}

/**
 * Consume ONE open call bracket sitting at the CURRENT SP, walking OUT through the
 * live dispatch frames, and report whether one was found.
 *
 * It serves two of the three shapes the oracle's `ret` can take at the seam:
 *
 *  - a `jp` TAIL into an idiomatic routine. The emitter writes a bare `m.call(T)`
 *    with no push, so the tail routine has no bracket OF ITS OWN — the oracle's
 *    `ret` there returns on its caller's behalf, consuming the bracket the
 *    OUTERMOST `call` in the tail chain opened. Several dispatch frames can share
 *    one SP (a chain of tails), which is why this keeps walking outward past
 *    unbracketed frames instead of stopping at the first one.
 *  - the caller-skip's SECOND word: after the callee's own `ret`, SP has reached the
 *    caller's frame and the oracle's skip pops the bracket the caller's own caller
 *    opened.
 *
 * Finding nothing is a real answer, not a failure: when the chain was entered by a
 * plain JS call from idiomatic code the bracket was dissolved at emission and there
 * is correctly nothing to pop. That is also what keeps a routine whose oracle twin
 * does NOT `ret` (a tail chain that jumps onward, e.g. the board-layout walk at
 * 0x0DD3/0x0E19/0x0E2A/0x0E4F, measured net-zero on the guest stack) from being
 * over-popped — no frame stands at its SP.
 */
function consumeBracketAtSp(m, seam) {
  const sp = m.regs.sp;
  for (let i = seam.frames.length - 1; i >= 0; i--) {
    const f = seam.frames[i];
    if (f.spEntry < sp) continue; // a deeper frame we have already unwound past
    if (f.spEntry > sp) return false; // out past the matching level: nothing to consume
    if (!f.opened) continue; // a `jp` tail in the same chain — its bracket is further out
    f.opened = false;
    m.ret(0); // cycle-free: the idiomatic layer does not model T-states
    return true;
  }
  return false;
}

/**
 * Wrap ONE resolved override so it closes the call bracket its translated caller
 * opened. See installCallBracketSeam for why this lives at registration time.
 */
function seamWrap(addr, fn, seam) {
  // A generator is the engine-driven control spine (boot/mainLoop). It is entered by
  // runGeneratorGame, never by a translated caller, and opens no bracket. Leave it be.
  if (fn.constructor && fn.constructor.name === "GeneratorFunction") return fn;
  const skips = SEAM_CALLER_SKIP.has(addr);
  const tailRets = !SEAM_TAIL_NO_RET.has(addr);
  return function seamed(mm, ...args) {
    const spEntry = mm.regs.sp;
    const top = seam.frames[seam.frames.length - 1];
    const own = top !== undefined && !top.taken && top.spEntry === spEntry ? top : undefined;
    if (own !== undefined) own.taken = true; // this dispatch frame is now accounted for

    const r = fn(mm, ...args);

    // Only if the body left SP where it found it. An override that delegates to the
    // oracle (the memory-equivalence capturing hook) has already had its `ret` run,
    // so SP has moved off the bracket and this correctly declines to touch it.
    if (mm.regs.sp !== spEntry) return r;

    if (own === undefined) {
      // Reached WITHOUT a Machine.call dispatch frame of our own: one of the two
      // translated computed-`jp` dispatchers invoked us as m.overrides.get(t)(m).
      // A dispatched target always returns through a continuation its dispatcher's
      // caller pushed (0x02BD for the task ring, 0x00D2 for the NMI state table),
      // so its bracket is open by construction and is not a dispatch frame.
      mm.ret(0);
    } else if (own.opened) {
      own.opened = false;
      mm.ret(0); // the `ret` the idiomatic body replaced with a JS `return`
    } else if (!tailRets || !consumeBracketAtSp(mm, seam)) {
      // A `jp` tail: either the oracle's twin does not `ret` at all (SEAM_TAIL_NO_RET),
      // or there is no bracket anywhere out the chain because it was entered from
      // idiomatic code and dissolved at emission. Either way the oracle would not
      // have consumed a word here — so neither do we, and there is no skip to apply.
      return r;
    }
    if (r === false && skips) consumeBracketAtSp(mm, seam);
    return r;
  };
}

/**
 * Build the per-routine OVERRIDE MAP: dispatch/call target (a number) ->
 * handler function. This is what lets an idiomatic rewrite (or the gate's capturing
 * hook) replace its `translated/` counterpart WITHOUT editing the call site —
 * m.call(addr) consults the layered registry, and `dispatchGameState` / `dispatchTask`
 * consult this map before their translated chain.
 *
 * INPUT SHAPE. `spec` is a caller-supplied object/Map. A value is either an
 * ALREADY-RESOLVED function (what resolveAllIdiomatic and the memory-equivalence
 * gate hand in) or the declarative `{ module, export }` form:
 *
 *   {
 *     "0xADDR": { module: "./idiomatic/<name>.js", export: "<name>" },
 *   }
 *
 * The KEY is the rst-0x28 dispatch target — the exact address `dispatchGameState`
 * switches on — as a hex string (a number is also accepted from a test). The
 * VALUE is declarative: the module (relative to this game's directory) and the
 * named export to route that address to.
 *
 * RESOLUTION IS ASYNC, so it is NOT done here. Turning `{ module, export }` into
 * a function needs a dynamic `import()`, which a constructor cannot await, so the
 * declarative form is resolved by `resolveOverrides()` (below) BEFORE construction
 * and handed in via `opts.overrides` as already-resolved functions. This split is
 * what keeps the resolution identical in Node and in the browser worker: both call
 * `resolveOverrides()`, which uses the dynamic import available in both.
 *
 * THE DEFAULT CONSTRUCTOR PATH NEEDS NONE OF THAT. It builds from `opts.overrides`
 * only; when that is omitted this produces an empty Map with no imports and no
 * async — every such player gets the exact translated behaviour, and the override
 * branch in `dispatchGameState` / `dispatchTask` is inert. No game currently ships a
 * declarative `manifest.optimized` block; the resolver stays for when one is added,
 * and buildOverrides throws on a raw `{ module, export }` value so a missing resolver
 * is named loudly rather than silently ignored.
 *
 * THE CALL BRACKET IS CLOSED HERE. Each resolved override is wrapped ONCE, at
 * registration, by seamWrap — see installCallBracketSeam for the whole argument.
 * The wrapping is what makes the idiomatic layer safe to run whole: the wrapped
 * function is the one value that lands in BOTH `this.overrides` (which the two
 * translated computed-`jp` dispatchers read directly) and `this.routines` (which is
 * built by copying it), so all three dispatch paths get one implementation.
 *
 * AN EMPTY SPEC PRODUCES AN EMPTY MAP AND NOTHING ELSE. Both the seam bookkeeping
 * and the per-routine wrapper are created only after an override has actually been
 * seen, so a Machine with no overrides — every oracle test, every convergence
 * baseline — keeps the Machine's own prototype `push16` / `pop16` / `call` and runs
 * the identical code it ran before. The pure-oracle path is unchanged BY
 * CONSTRUCTION rather than by argument. (The shipped DK player is NOT on this path:
 * manifest.js sets `runtime: "idiomatic"`,
 * so web/worker.js hands the player `resolveAllIdiomatic(...)` — the full override
 * map, seam installed. The player's cover is idiomatic/test/golive.test.js test 2.)
 *
 * @param {object|Map} [spec]
 * @param {Machine} [machine] the Machine these overrides are being built for
 * @returns {Map<number, function>}
 */
function buildOverrides(spec, machine) {
  const map = new Map();
  if (!spec) return map;
  const entries = spec instanceof Map ? [...spec.entries()] : Object.entries(spec);
  let seam = null;
  for (const [key, val] of entries) {
    const addr = typeof key === "number" ? key : parseInt(key, 16);
    if (typeof val === "function") {
      // already resolved (a test, or resolveOverrides' output)
      if (machine === undefined) {
        map.set(addr, val); // no Machine to hang the seam on (a bare spec normalisation)
      } else {
        if (seam === null) seam = installCallBracketSeam(machine);
        map.set(addr, seamWrap(addr, val, seam));
      }
    } else if (val && typeof val === "object" && "module" in val) {
      throw new Error(
        `override for 0x${addr.toString(16).padStart(4, "0")} is the declarative ` +
          "{ module, export } form; resolve it with resolveOverrides() first and pass " +
          "the result as opts.overrides. The Machine constructor cannot dynamic-import " +
          "synchronously.",
      );
    } else {
      throw new Error(
        `override for key ${key} must be a function or { module, export }, got ${typeof val}`,
      );
    }
  }
  return map;
}

/**
 * Resolve a declarative `manifest.optimized` block ({ "hhhh": { module, export } })
 * to a `Map<number, function>` ready to hand to `new Machine(rom, { overrides })`.
 * Async because it dynamic-imports each module; dynamic import exists in Node and in
 * the browser worker alike, so one resolver serves both.
 *
 * Module paths are resolved relative to `baseUrl`, which defaults to this file
 * (games/dkong/machine.js), so manifest entries like "./idiomatic/<name>.js" resolve
 * against the game directory — the same base the audio paths use.
 *
 * @param {object} [spec]     manifest.optimized: { "0xADDR": { module, export } }
 * @param {string|URL} [baseUrl]
 * @returns {Promise<Map<number, function>>}
 */
export async function resolveOverrides(spec = {}, baseUrl = import.meta.url) {
  const map = new Map();
  for (const [key, ent] of Object.entries(spec)) {
    const addr = parseInt(key, 16);
    const url = new URL(ent.module, baseUrl).href;
    const mod = await import(url);
    const fn = mod[ent.export];
    if (typeof fn !== "function") {
      throw new Error(
        `override ${key}: module ${ent.module} has no function export "${ent.export}"`,
      );
    }
    map.set(addr, fn);
  }
  return map;
}

export class Machine {
  /**
   * @param {Uint8Array} rom 16KB maincpu image
   * @param {object} [opts]
   * @param {Inputs} [opts.inputs]
   */
  /**
   * @param {Uint8Array} rom     16KB maincpu image
   * @param {object} [opts]
   * @param {Uint8Array} [opts.gfx1]  tile ROMs -- enables frame rendering
   * @param {Uint8Array} [opts.proms] colour PROMs -- enables frame rendering
   */
  constructor(rom, opts = {}) {
    const { inputs, gfx1, proms, gfx2, overrides } = opts;
    // Retained so clone() can build a fresh Machine on the SAME rom + assets
    // (the constructor's options bag) without the caller re-supplying them.
    this.rom = rom;
    this.assets = opts;
    this.io = new IO({ inputs: inputs ?? new Inputs() });
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.mem.clock = () => this.cycles;

    // Indexable views over memory for the idiomatic layer's readability: mem8[ADDR]
    // and mem16[ADDR] forward to this.mem's read8/write8 and read16/write16. Pure
    // sugar — the oracle and the live engine keep calling this.mem directly. Rebuilt
    // per instance, so clone() (which reruns this constructor) gets views bound to its
    // own memory. See core/mem-views.js.
    this.mem8 = makeIndexedView(this.mem, 8);
    this.mem16 = makeIndexedView(this.mem, 16);

    this.frame = 0;
    this.booted = false;

    // Per-routine override map: dispatch/call target -> handler. Empty and
    // therefore INERT unless a caller supplies an already-resolved map/object via
    // opts.overrides — the seam the memory-equivalence harness drives (a live
    // idiomatic routine, or a capturing hook at a target address). See buildOverrides.
    this.overrides = buildOverrides(overrides, this);

    // The whole dispatch table the swap layer resolves through: the oracle registry
    // (routines.js) with any overrides laid over the top. m.call(addr) invokes
    // routines.get(addr), so an override replaces its oracle at EVERY call site, not
    // just at a dispatch point. With no overrides this is the oracle table, so
    // behaviour is byte-identical to pure translated code. A FRESH Map is taken so
    // the passed-in registry (also held in this.assets) is never mutated — clone()
    // rebuilds from it and re-layers.
    const routines = opts.routines instanceof Map ? opts.routines : ORACLE_ROUTINES;
    this.routines = new Map(routines);
    for (const [addr, fn] of this.overrides) this.routines.set(addr, fn);

    this.cycles = 0;
    this.frames = []; // captured state dumps, one per frame boundary
    this.videoFrames = []; // completed RGB frames, one per frame, opt-in
    this.captureVideo = false; // off by default: 172032 bytes per frame
    this.rasterBuf = null; // frame being painted, row by row
    this.rasterRow = 0; // next scanline to paint, 0..SCREEN_H
    this.nextRowCycle = 0; // absolute cycle the next scanline starts at
    this.droppedFrames = 0; // frames abandoned mid-paint; only the last may be
    this.nextBoundary = Infinity; // set by runFrames()
    this.maxFrames = Infinity;
    this.maxCycles = Infinity;

    // Next vblank, in absolute cycles. Advances every frame whether or not
    // the NMI is masked -- vblank happens regardless; the mask only decides
    // whether the CPU notices.
    this.nextNmi = NMI_CYCLE_IN_FRAME;

    // Video decode is done once at construction: the tile ROMs and PROMs are
    // immutable, so nothing about them can change per frame.
    this.video = null;
    if (gfx1 && proms) {
      this.video = {
        tiles: decodeTiles(gfx1),
        charColour: splitProms(proms).charColour,
        palette: buildPalette(proms),
        // gfx2 is optional: without it the tilemap still renders and sprites
        // are simply not drawn (the pre-sprite behaviour). With it, the sprite
        // post-pass in finishRasterFrame runs.
        sprites: gfx2 ? decodeSprites(gfx2) : null,
      };
    }

    // ROM address of the NEXT instruction to execute -- what the Z80 pushes
    // when it accepts an NMI. Maintained by step(); tick() invalidates it.
    this.pc = 0x0000;
    this.pcKnown = false;
    this.nmiCount = 0;
    this.stoppedBy = null; // why a bounded run ended, if not the budget

    // Poke tape: [{addr,val,frame,mode}] set by emit.js --poke, matching
    // lua/poke_ram.lua. Applied at each frame boundary BEFORE that frame's CPU
    // exec (and before the state sample, so state[N] reflects the poke) --
    // hold rewrites every frame from `frame` on, once writes only at `frame`.
    this.pokes = null;

    // Input tape: [{port,bits,frame,mode}] set by emit.js --input. Asserts
    // coin/start/joystick bits on IN0/IN1/IN2 so the ROM's own credit/start
    // logic drives gameplay. once = frame N only (a momentary pulse -- the
    // default), hold = every frame from N (a held direction).
    this.inputTape = null;
  }

  /** Apply --poke entries due for `frameIndex`, at the frame boundary. */
  applyPokes(frameIndex) {
    if (!this.pokes) return;
    for (const p of this.pokes) {
      // dur frames from p.frame (null = indefinite hold); holdN releases after
      // N so the game's own code manages the byte during play.
      const due = frameIndex >= p.frame &&
        (p.dur == null || frameIndex < p.frame + p.dur);
      if (due) this.mem.write8(p.addr, p.val);
    }
  }

  /**
   * Set io.inputAssert for `frameIndex` from the --input tape. Stays active
   * for that whole frame's reads (the NMI may read IN2 mid-frame); recomputed
   * at the next boundary so a `once` pulse clears the frame after.
   */
  applyInputs(frameIndex) {
    if (!this.inputTape) return;
    const assert = {};
    for (const t of this.inputTape) {
      // dur frames from t.frame (null = indefinite); e.g. dur 6 = MAME's coin hold.
      const due = frameIndex >= t.frame &&
        (t.dur == null || frameIndex < t.frame + t.dur);
      if (due) assert[t.port] = (assert[t.port] || 0) | t.bits;
    }
    this.io.inputAssert = assert;
  }

  /**
   * Execute one translated instruction: `nextAddr` is the ROM address of the
   * instruction AFTER this one (the branch target when a jump is taken),
   * `cycles` its T-state cost.
   *
   * WHY THE PC RIDES ALONG. If an NMI is accepted here, the Z80 pushes the
   * address of the next instruction, and that value lands on the stack inside
   * the work RAM that is diffed against MAME. Keeping the PC as separate bookkeeping meant it
   * went stale the moment control entered a routine that did not maintain it
   * -- a review found the first real NMI pushing 0x02C5 while two calls deep
   * in 0x06xx code. Carrying it as an argument makes the stale case
   * unrepresentable rather than merely discouraged.
   */
  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.pcKnown = true;
    this.tick(cycles);
  }

  /**
   * Vector the vblank NMI, exactly as the Z80 would: push the current PC and
   * jump to 0x0066.
   *
   * THE PUSHED PC MATTERS AND IS NOT A FREE CHOICE. It lands on the stack at
   * the top of work RAM, inside the 5120 bytes diffed against MAME, so it
   * must be the value the ROM would have had there -- not a sentinel, not
   * zero. That is why translated code maintains `m.pc`.
   *
   * No reentrancy guard is needed, and deliberately so: the handler's first
   * real act is `xor a / ld (0x7d84),a`, clearing the NMI mask. The hardware
   * gate is the guard, so modelling it faithfully gets the mutual exclusion
   * for free rather than bolting on a JS flag that could disagree with it.
   */
  fireNmi() {
    if (!this.pcKnown) {
      throw new Error(
        `NMI accepted at cycle ${this.cycles} but the ROM PC is unknown: the ` +
          "routine executing here uses tick() rather than step(), so the " +
          "value pushed would be stale. The pushed PC lands in diffed work " +
          "RAM, so pushing a guess is worse than stopping. Convert that " +
          "routine to step().",
      );
    }
    this.nmiCount += 1;
    // THE Z80 SPENDS 11 T-STATES ACCEPTING AN NMI before the handler's first
    // byte is fetched: an acknowledge M1 cycle plus the PC push. Charging
    // nothing for it started the handler 11 cycles early on every interrupt.
    //
    // Found as a CONSTANT 11-cycle offset -- not jitter -- between our NMI
    // entry (202760) and MAME's (202771), and again at sub_0141's entry
    // (202908 vs 202919). A constant offset at two points inside the same
    // handler is a missing fixed cost, not instruction-boundary alignment.
    this.push16(this.pc);
    this.cycles += 11;
    loc_0066(this);
  }

  /**
   * Advance the T-state clock and capture a state dump whenever a frame
   * boundary is crossed. Translated instructions call this with their real
   * T-state cost, so boundaries land exactly where they do on hardware.
   *
   * The capture happens MID-INSTRUCTION-STREAM by design: state[N] is
   * whatever memory holds at the instant the boundary is crossed, which is
   * how MAME's frame notifier samples too.
   */
  tick(n) {
    this.cycles += n;

    // ORDER MATTERS AND IS NOT ARBITRARY. The state sample and the NMI
    // assertion happen at the SAME instant (cycle N * 50688), and sampling
    // is defined to occur BEFORE execution -- so state[N] must never contain
    // frame N's own NMI effects. Capturing first is what makes that true.
    // Drain BEFORE the boundary check, and the ORDERING is what makes this
    // safe -- not a margin. Row 223 is due at N*50688 + 50496, only 192
    // cycles before the frame ends, and the largest real tick is the
    // 3121-cycle DMA stall. So the margin is NEGATIVE by 16x and would drop
    // frames constantly if safety depended on it. It does not: entering the
    // boundary loop requires cycles >= (N+1)*50688 > row 223's due time, so
    // draining first paints every row regardless of tick size.
    //
    // (These numbers were 45888 and "4800 cycles early" while VBLANK_LINES
    // was mistakenly VBEND. A reader checking "is 3121 < 4800?" would have
    // concluded there was headroom. There is none; the ordering is the
    // guarantee.)
    this.drainRaster();

    while (this.cycles >= this.nextBoundary && this.frames.length < this.maxFrames) {
      this.applyInputs(this.frames.length); // assert inputs for frame N
      this.applyPokes(this.frames.length); // poke frame N before sampling state[N]
      this.frames.push(this.dumpState());
      // The frame the beam has just FINISHED painting is complete now, so
      // this is where it is published. videoFrames[N] is the image of frame
      // N -- composed row by row DURING frame N, not snapshotted at either
      // end of it. See renderRowRGB for why a snapshot is not sufficient.
      if (this.captureVideo) this.finishRasterFrame();
      this.nextBoundary += CYCLES_PER_FRAME;
    }

    this.drainRaster();

    // Stopping is bounded by CYCLES, not by frame count. Those are different
    // things and conflating them cost a real artifact: throwing the instant
    // the last frame was captured stopped execution at the frame boundary,
    // which is exactly one instant BEFORE the NMI is checked -- so a
    // 5-frame run produced a hardware write trace containing no NMI writes
    // at all. Frame capture is a sampling concern; how far to execute is not.
    if (this.cycles >= this.maxCycles) throw new FramesComplete();

    // Vblank is checked at an instruction boundary, which is where tick() is
    // called from -- the Z80 also only accepts an NMI between instructions,
    // which is where the measured 10-21 cycle entry jitter comes from.
    if (this.cycles >= this.nextNmi) {
      this.nextNmi += CYCLES_PER_FRAME;
      if (this.io.nmiMask) this.fireNmi();
    }

    // A bare tick() is an instruction whose successor address was never
    // recorded, so the PC is stale from here until the next step().
    // INVALIDATING AT THE END, after the NMI check, is what makes the guard
    // in fireNmi able to fire at all: it lets pcKnown return to false once a
    // step() has run. Not every routine maintains the PC (boot.js and nmi.js
    // still do not), so without this invalidation the guard would be inert.
    this.pcKnown = false;
  }

  /**
   * Run from reset, capturing `count` state frames.
   * frame 0 = power-on, sampled before a single instruction runs.
   */
  runFrames(count) {
    this.applyPokes(0); // frame-0 pokes (pre-boot) before sampling state[0]
    this.frames = [this.dumpState()]; // state[0], power-on
    this.videoFrames = [];
    this.droppedFrames = 0;
    // Frame 0 starts being PAINTED here; it is published when the boundary
    // into frame 1 is crossed. Nothing to snapshot -- the image of frame 0 is
    // not knowable until frame 0 has been executed.
    if (this.captureVideo) this.startRasterFrame(0);
    if (count <= 1) return this.frames; // nothing to execute

    this.maxFrames = count;
    // Run a little past the last sampled frame so per-frame side effects that
    // land just after a boundary -- the NMI is 11-30 cycles after it -- are
    // still executed and traced. Frames beyond `count` simply are not
    // captured.
    this.maxCycles = count * CYCLES_PER_FRAME + CYCLES_PER_FRAME;
    this.cycles = 0;
    this.nextBoundary = CYCLES_PER_FRAME;
    this.nextNmi = NMI_CYCLE_IN_FRAME;
    this.stoppedBy = null;
    try {
      this.reset();
    } catch (e) {
      if (e instanceof FramesComplete) {
        // Ran the full cycle budget -- the normal end of a bounded run.
      } else if (e instanceof NotImplemented) {
        // Translation ran out. The frames already captured are still valid,
        // so keep them and record WHY we stopped rather than discarding the
        // run or pretending it completed.
        this.stoppedBy = e.message;
      } else {
        throw e;
      }
    } finally {
      // Leave the Machine usable. Without this the frame limit stays armed
      // and every later tick throws.
      this.maxFrames = Infinity;
      this.maxCycles = Infinity;
      this.nextBoundary = Infinity;
    }
    return this.frames;
  }

  /**
   * Z80 reset: entry at PC=0x0000. Faithfully NEVER RETURNS -- boot falls
   * through into the main loop, which spins forever waiting on vblank. It
   * exits only via FramesComplete or a NotImplemented stub.
   */
  reset() {
    romReset(this);
    this.booted = true;
  }

  /** Reset through the end of boot only. See bootOnly() in ./translated/bootOnly.js. */
  runBoot() {
    bootOnly(this);
    this.booted = true;
  }

  /**
   * Async factory: build the routine registry, then construct. Mirrors
   * `games/thepit/machine.js`'s `Machine.create` so the SHARED cross-game tools have one
   * construction interface to call.
   *
   * DK's registry is available synchronously (`buildRoutines()` copies ORACLE_ROUTINES,
   * which is statically imported), so this adds no capability the constructor lacks — it
   * adds the SHAPE the tools expect. `tools/swap_check.mjs` calls `Machine.create(rom, …)`;
   * without this method it died with `TypeError: Machine.create is not a function` on its
   * first line for DK, so the whole-game swap gate had never once run for this game. That
   * was worth fixing in the Machine rather than in the tool: the tool is shared, The Pit
   * already offers this exact entry point, and games/dkong's other factory
   * (`makeMachineFactory`) is a different shape that would have needed a second code path
   * in every shared tool forever.
   *
   * @param {Uint8Array} rom
   * @param {object} [opts]  forwarded to the constructor (gfx/proms/overrides optional)
   * @returns {Promise<Machine>}
   */
  static async create(rom, opts = {}) {
    const routines = await buildRoutines();
    return new Machine(rom, { ...opts, routines });
  }

  /**
   * THE STACK IS REAL MEMORY AND IT IS DIFFED.
   *
   * Control flow between translated routines is ordinary JS calling, but that
   * is not sufficient: the Z80 stack lives at the top of work RAM (`ld
   * sp,0x6c00` puts it at 0x6BFF downward), which is inside the 5120-byte
   * region diffed against MAME. If a translated `call` does not write its
   * return address to memory, our RAM differs from MAME's at addresses no
   * routine ever names.
   *
   * It also matters semantically: `rst 0x28` reads its own return address off
   * the stack to find an inline jump table, and the `pop hl / ret` idiom
   * returns past its caller. Those only work if the bytes are actually there.
   *
   * Note the Z80 does NOT clear popped bytes -- they stay in RAM after the
   * `ret`, which is why post-boot 0x6BFE/0x6BFF hold 0xB8/0x02 rather than
   * zero. So each translated `call NNNN` pushes its literal return address
   * (known at translation time) and the callee's `ret` pops it.
   */
  push16(value) {
    const { regs, mem } = this;
    regs.sp = (regs.sp - 2) & 0xffff;
    mem.write8(regs.sp, value & 0xff);
    mem.write8((regs.sp + 1) & 0xffff, (value >> 8) & 0xff);
  }

  pop16() {
    const { regs, mem } = this;
    const lo = mem.read8(regs.sp);
    const hi = mem.read8((regs.sp + 1) & 0xffff);
    regs.sp = (regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }

  // RET: pop the return address and continue there. The popped value IS the
  // next PC, so it is what step() records -- which is why `ret` cannot just be
  // a JS `return`.
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }

  /**
   * Invoke the routine at ROM address `addr` through the swap registry: the
   * idiomatic rewrite if one is registered, else the translated oracle. Every
   * inter-routine call is written this way -- `m.call(0x0874)` for `call 0x0874` --
   * which is what makes any routine independently swappable rather than only the two
   * dispatch targets. This dispatches WHICH implementation runs; the `push16`/`step`
   * that model the CALL's stack push and cycle cost stay at the call site next to it,
   * so with an empty override map this is byte-identical to a direct call.
   *
   * Extra args are forwarded for the two routines the translation parameterised
   * (`sub_0028`, `draw_0578`); the return value is forwarded for the rst skip-idiom
   * (`if (!m.call(0x0008)) return;`).
   */
  call(addr, ...args) {
    const fn = this.routines.get(addr);
    if (fn === undefined) {
      throw new Error(
        `m.call: no routine registered at 0x${addr.toString(16).padStart(4, "0")}`,
      );
    }
    return fn(this, ...args);
  }

  // LDIR at an arbitrary site: block-copy (DE)<-(HL), BC down, until BC==0.
  // `self` is the ROM address of the LDIR itself (charged 21 T-states per
  // iteration that repeats), `nextAddr` the instruction after it (16 on exit).
  ldirAt(self, nextAddr) {
    const { regs, mem } = this;
    for (;;) {
      mem.write8(regs.de, mem.read8(regs.hl));
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.de = (regs.de + 1) & 0xffff;
      regs.bc = (regs.bc - 1) & 0xffff;
      if (regs.bc === 0) {
        this.step(nextAddr, 16);
        return;
      }
      this.step(self, 21);
    }
  }

  // The fixed-site LDIR at ROM 0x01CF.
  ldir(nextAddr) {
    return this.ldirAt(0x01cf, nextAddr);
  }

  /**
   * Render the current frame to 256x224 RGB888, per the frame-sampling contract.
   * Requires gfx1 and proms at construction.
   */
  renderFrame() {
    if (!this.video) throw new Error("renderFrame needs gfx1 and proms");
    const rgb = renderFrameRGB(
      this.mem.videoRam,
      this.video.tiles,
      this.video.charColour,
      this.video.palette,
      { gfxBank: 0, paletteBank: this.io.paletteBank, flip: this.io.flipScreen },
    );
    // SPRITE POST-PASS — renderFrameRGB paints the TILEMAP ONLY (its own docblock says so).
    // Without this, everything that is a sprite — Mario, Kong, the barrels, Pauline, the
    // hammers — is simply absent, and the frame still looks plausible because the girders,
    // ladders and HUD are all tilemap. That is the failure mode this call exists to prevent.
    // Identical pass, and identical opts, to the raster path's end-of-frame sprite layer in
    // finishRasterFrame; the two render paths must agree or the runtime that uses this one
    // (the idiomatic runtime — web/worker.js renders on demand here) draws a spriteless game.
    if (this.video.sprites) {
      drawSprites(
        rgb, this.mem.spriteRam, this.video.sprites, this.video.palette,
        { flip: this.io.flipScreen, paletteBank: this.io.paletteBank, spriteBank: this.io.spriteBank },
      );
    }
    return rgb;
  }

  /**
   * Paint every scanline the beam has passed since the last call, each from
   * video RAM AS IT STANDS AT THAT MOMENT. That is what makes a mid-frame
   * flip or a mid-frame VRAM rewrite come out as the composite the hardware
   * actually produces rather than as a snapshot of either side of it.
   *
   * GRANULARITY IS THE TICK, NOT THE SCANLINE. Rows are painted after an
   * instruction completes, using the flip and palette-bank state as of then,
   * so a tick spanning several lines paints them all with end-of-tick state.
   * Harmless for the 3121-cycle DMA stall (it targets sprite RAM at 0x7000,
   * touches neither videoRam nor flip), but it is an approximation and not a
   * scanline-exact model -- recorded so it is not mistaken for one.
   */
  drainRaster() {
    if (!this.captureVideo || this.rasterBuf === null) return;
    while (this.rasterRow < SCREEN_H && this.cycles >= this.nextRowCycle) {
      renderRowRGB(
        this.rasterBuf, this.rasterRow, this.mem.videoRam, this.video.tiles,
        this.video.charColour, this.video.palette,
        { gfxBank: 0, paletteBank: this.io.paletteBank, flip: this.io.flipScreen },
      );
      this.rasterRow++;
      this.nextRowCycle += CYCLES_PER_LINE;
    }
  }

  /**
   * Begin painting frame `n`. The first DISPLAYED scanline starts
   * VBLANK_LINES (40) in from the frame origin, which is the VBLANK POINT --
   * not VBEND (16), which numbers raster lines from a different zero.
   */
  startRasterFrame(n) {
    if (!this.video) throw new Error("raster capture needs gfx1 and proms");
    this.rasterBuf = new Uint8Array(256 * SCREEN_H * 3);
    this.rasterRow = 0;
    this.nextRowCycle = n * CYCLES_PER_FRAME + VBLANK_LINES * CYCLES_PER_LINE;
  }

  /**
   * Publish the frame just finished, and start the next.
   *
   * A frame whose scanlines were not all painted is DROPPED rather than
   * published half-black. The only way to reach here with rows outstanding is
   * a run that stopped mid-frame, and an incomplete frame that looks like a
   * real one is worse than a missing one -- it would diff as a rendering
   * fault rather than as the short run it is.
   */
  finishRasterFrame() {
    if (this.rasterBuf !== null && this.rasterRow === SCREEN_H) {
      // SPRITE POST-PASS. The tilemap scanlines are all painted; sprites are a
      // frame-level pass on top, from OUR sprite RAM at end-of-frame. This is
      // the end-to-end counterpart of the earlier isolated draw check, where
      // GOLDEN sprite RAM was fed straight into this same sprite pass -- here
      // the sprite RAM is what our own CPU + DMA produced, so a red now is
      // translation-or-timing, never the draw model (that was proven correct
      // against golden sprite RAM). Sprite RAM is zero on the
      // pre-sprite frames, so drawSprites is a no-op there and the frames
      // 0-516 are byte-unchanged.
      if (this.video.sprites) {
        drawSprites(
          this.rasterBuf, this.mem.spriteRam, this.video.sprites,
          this.video.palette,
          {
            flip: this.io.flipScreen,
            paletteBank: this.io.paletteBank,
            spriteBank: this.io.spriteBank,
          },
        );
      }
      this.videoFrames.push(this.rasterBuf);
    } else if (this.rasterBuf !== null) {
      // NOT reachable on the run-stopped-mid-frame path, contrary to what
      // this said: that path THROWS and never returns here (measured -- a
      // 7-frame run stopping at 0x0763 leaves rasterRow at 6 and drops
      // nothing). With drainRaster() now running before the boundary, the
      // only way to arrive with rows outstanding is a tick longer than a
      // frame. Kept as a tripwire for exactly that, not as normal operation.
      this.droppedFrames += 1;
    }
    // The state for the boundary we are on has ALREADY been pushed, so
    // frames.length is N+1 when frame N is beginning. Passing frames.length
    // put nextRowCycle a whole frame ahead, no scanline ever came due, and
    // every frame was silently dropped as unfinished -- which the emitter's
    // count assertion caught rather than writing a one-frame file.
    this.startRasterFrame(this.frames.length - 1);
  }

  /** 5120-byte state dump: work + sprite + video, per the frame-sampling contract. */
  dumpState() {
    return this.mem.dumpState();
  }

  /** Map a dumpState() byte offset back to its RAM address (delegates to mem). */
  stateOffsetToAddr(off) {
    return this.mem.stateOffsetToAddr(off);
  }

  /**
   * A fresh Machine on this one's ROM + assets, restored to this machine's
   * observable state: all RAM, the full register file, and IO value-state. The
   * clone's frame machinery is neutralised (boundaries/NMI/budget set to
   * Infinity) so that running ONE routine on it in isolation cannot trip a frame
   * sample, fire an NMI, or throw FramesComplete -- the unit gate measures the
   * routine, not the scheduler.
   *
   * A clone rebuilds from `this.assets` (the source's constructor opts), so it
   * carries whatever `overrides` the source was built with — including the unit
   * gate's snapshot override. That is harmless here: the unit gate invokes the
   * routine under test DIRECTLY (translatedFn/idiomaticFn on the clone), so the
   * override map is consulted only for an m.call the target makes INTO itself,
   * where the snapshot delegates to the oracle — exactly the callee-is-oracle
   * isolation the unit gate wants. (Whole-machine equivalence backstops the one
   * case this can't distinguish: an idiomatic routine that recurses into itself.)
   */
  clone() {
    const c = new Machine(this.rom, this.assets);
    c.mem.workRam.set(this.mem.workRam);
    c.mem.spriteRam.set(this.mem.spriteRam);
    c.mem.videoRam.set(this.mem.videoRam);
    c.mem.discardedWrites = this.mem.discardedWrites;

    c.regs.copyFrom(this.regs);
    c.io.loadStateFrom(this.io);

    c.cycles = this.cycles;
    c.pc = this.pc;
    c.pcKnown = this.pcKnown;
    c.frame = this.frame;
    c.nmiCount = this.nmiCount;
    c.booted = this.booted;

    c.nextBoundary = Infinity;
    c.nextNmi = Infinity;
    c.maxFrames = Infinity;
    c.maxCycles = Infinity;
    return c;
  }
}

/**
 * Resolve the WHOLE idiomatic layer to an override Map<addr, fn> — every routine in
 * idiomatic/names.js's ROUTINES. This is what web/worker.js ships and what the full-flip
 * gate wires.
 *
 * MODULE FROM `name`, EXPORT FROM `entry ?? name`. The module is always
 * `idiomatic/<name>.js` — `name` IS the filename, that stays one-to-one. The EXPORT is
 * allowed to differ because a wired address is dispatched as `fn(m)`, one argument, and a
 * few idiomatic routines are deliberately PURE functions of their Z80 register inputs
 * (`snapYToGirder(x, y, step)`) so their idiomatic callers can pass proper arguments.
 * Registering a pure function at a ROM address hands it the Machine as its first
 * coordinate and it silently degrades to a no-op. `entry` names the ROM-level ABI wrapper
 * beside it — same module, machine-shaped — so the address gets a correct entry point
 * without disturbing the pure function. See the `entry` note in idiomatic/names.js.
 */
export async function resolveAllIdiomatic(baseUrl = import.meta.url) {
  const { ROUTINES } = await import(new URL("idiomatic/names.js", baseUrl).href);
  const spec = {};
  for (const [addr, meta] of Object.entries(ROUTINES)) {
    spec[Number(addr).toString(16)] = {
      module: `./idiomatic/${meta.name}.js`,
      export: meta.entry ?? meta.name,
    };
  }
  return resolveOverrides(spec, baseUrl);
}

export async function makeMachineFactory(rom, assets = {}) {
  const routines = await buildRoutines();
  return (overrides) => new Machine(rom, { ...assets, routines, overrides });
}
