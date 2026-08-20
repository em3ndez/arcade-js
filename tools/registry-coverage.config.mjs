// SPDX-License-Identifier: GPL-3.0-only

export const UNWIRED = {
  frogger: {
    // DISSOLVED caller-skips, NOT oracle-served. A caller-skip pops the caller's return (net SP +4), which is
    // outside the withOmittedRet seam's 0/+2 window, so it cannot be a ROUTINES override. Per the runbook it is
    // dissolved into a boolean skip-signal the caller early-returns on, called DIRECTLY by a sibling (runs as JS,
    // never the frozen oracle). Recorded so the coverage gate knows they are intentionally not ROUTINES-dispatched.
    "awardBonusPoints.js":
      "DISSOLVED caller-skip -> boolean: returns true (cursor set) to make the goal-award caller skip its " +
      "remainder, else adds the score and returns false. Direct-called by awardHomeBayGoal (runs as JS, not " +
      "oracle-served). Not a ROUTINES override: the +4 SP move is outside the seam's 0/+2 window.",
    "tickAttractCellFrameClock.js":
      "DISSOLVED double caller-skip -> boolean: false = tick not elapsed (caller skips its remainder), true = " +
      "elapsed (frame tile in A). Direct-called by driveAttractDemoSequencer (runs as JS, not oracle-served). " +
      "Not a ROUTINES override: the double-skip's +4 SP move is outside the seam's 0/+2 window.",
  },
  timeplt: {
    "replayCloudBands.js":
      "the beam-sync render step (docs/beam-sync.md): runCommandRingDrainLoop calls it directly before its vblank " +
      "yield to repaint the frame's beam-multiplexed scenery in scanline bands. It has no ROM " +
      "address, so no ROUTINES entry can name it, and it is not a dispatch target -- the frozen " +
      "layer never transfers to it; it reads m.beamPlan (recorded by the multiplexers) and drives " +
      "the machine's band accumulator, state-neutrally. A render support routine, not a ROM routine.",
    "serviceVerticalBlankInterrupt.js":
      "the vblank NMI SERVICE, reached only through the interrupt seam: loc_00d8 lands the NMI, " +
      "pushes AF and falls into it. It saves both register banks and unwinds the whole interrupt " +
      "frame, moving SP by 4 net. `withOmittedRet` seats a dispatch only where the rewrite leaves " +
      "SP where it found it or moves it by one return slot -- 0 or +2 -- so the seam cannot place " +
      "this address, and wiring it in ROUTINES stops the generator on the first NMI (seam reports " +
      "SP moved by 4, pc left at 0x0b93). Same class as sendOneQueuedSoundThenUnwindTheFrameInterrupt.js. " +
      "The module and its equivalence-00d9 gate are correct and stay; the frozen layer runs it " +
      "in-game via m.call (loc_00d8 -> 0x00d9, recorded in no-stale-mcall ALLOWED).",
    "sendOneQueuedSoundThenUnwindTheFrameInterrupt.js":
      "the vblank EPILOGUE: it unwinds the whole interrupt frame, so it legitimately moves SP by " +
      "22. `withOmittedRet` places a dispatch only where the rewrite leaves SP where it found it " +
      "or moves it by one return slot -- 0 or +2 -- so the seam cannot seat this address at all, " +
      "and wiring it fails the assembled-game and seam gates by name. Nothing reaches it as a " +
      "call either: the word 0x0174 occurs once in the image, at 0x0156, as the resume address " +
      "the frame service PUSHES, so control RETURNS into it rather than calling it. The module " +
      "and its gate are correct and stay; what is missing is a seam that can model a routine " +
      "whose whole job is to dismantle the frame its caller is standing on.",
    "dispatchInlineWordTableIndexedByA.js":
      "RST 0x30's argument IS the stack slot. The caller's transfer leaves the inline table's " +
      "address where a return address would sit, and the routine pops it -- consuming it is what " +
      "turns the caller's next bytes into a table instead of instructions. A dispatch entry takes " +
      "only the machine, so it would have to model that pop, which the memory-equivalence " +
      "contract keeps out of idiomatic code. Eight sites in translated/ reach it. Four are " +
      "already decompiled and ALL FOUR dissolved the transfer -- they read the inline table " +
      "directly and none of them calls this address -- so the route out is demonstrated, not " +
      "hoped for. The remaining four are frozen, and each dissolves it in its own unit by passing " +
      "the table address as an argument, at which point nothing here touches the stack.",
    "placeTileAtTableSuppliedOffset.js":
      "Not a dispatch entry: it is an interior continuation. Decoding the image from EVERY byte " +
      "offset -- which over-generates and cannot under-generate -- finds exactly one transfer to " +
      "0x3074 in the whole 24KB, a `djnz` at 0x3081, and 0x307F..0x3089 is a CAPTION RECORD " +
      "(destination, colour, then glyph codes) rather than instructions, so that transfer is a " +
      "decode of data and not a real entry. The genuine way in is a fall-through from 0x306A, " +
      "four instructions that load the two coordinate registers off the sprite entry and point HL " +
      "at a table -- and 0x306A has no transcribed routine, which is why 0x3074 stands alone at " +
      "all. Both tapes dispatch it zero times, asserted in its gate. A ROUTINES entry would claim " +
      "an entry point the image does not have; it becomes dispatchable when 0x306A is lifted and " +
      "swallows it.",
    "loc_5254.js":
      "Not a dispatch entry: it is an interior continuation of destroyTargetsHitByShots, and the " +
      "frozen layer never transfers to it. A scan of the whole 24 KB for the little-endian word " +
      "0x5254, at every alignment, finds no occurrence, so no table can name it -- and the same " +
      "scan is shown able to find an entry point in the same breath, returning six occurrences of " +
      "0x5211's word, each behind a `c3`, `cd` or `c2`. Both paths in are interior to 0x5211's " +
      "own body: a `jr nz` at 0x5215 and the fall-through of the `djnz` at 0x5252. The frozen " +
      "transcription says the same thing by giving loc_5211 the range 0x5211-0x5269 and holding " +
      "0x5254-0x5269 a second time inside it, and loc_5211 reaches that stretch by falling into " +
      "it rather than by calling 0x5254. The idiomatic destroyTargetsHitByShots has already " +
      "SWALLOWED the continuation -- its own body reloads the two target cursors from 0xA991 and " +
      "0xA993 and the inner count from the shadow accumulator between passes, which is the whole " +
      "of what this module does -- so a ROUTINES entry would claim an entry point the image does " +
      "not have and override an address the enclosing routine's rewrite already covers.",
    "appendSoundCommandToQueue.js":
      "Not a dispatch entry at all. The little-endian word for its address occurs nowhere in the " +
      "ROM image, so no table can name it, and every path in reaches it from a point interior to " +
      "another routine -- two conditional branches and a fall-through, all three of which have " +
      "idiomatic twins that call it directly. Its idiomatic form also takes the sound code as a " +
      "second parameter, which the override map has no way to supply.",
    "stepMotherShip.js":
      "the Mother-Ship's per-frame stepper, reached ONLY when MOTHER_SHIP_ARMED 0xad0d != 0 -- through the " +
      "jr nz at 0x43c0 inside armMotherShipOrStep. Neither driven tape reaches it (its target hits zero while " +
      "the control anchor 0x43b7 hits hundreds), so the wired pixel render cannot exercise it and " +
      "a ROUTINES entry would claim a dispatch the tapes never make. Its caller armMotherShipOrStep is WIRED " +
      "and reaches it by m.call (recorded in no-stale-mcall ALLOWED, stubbed in equivalence-43b7). " +
      "The module and its equivalence-43f0 gate are correct (byte-identical to the oracle in work " +
      "RAM, verified) and stay; the frozen layer runs it in-game when the Mother-Ship is on the field.",
  },
  pooyan: {
    // Batch 1: 10 leaf modules, all decompiled + equivalence-proven (green equivalence-<addr>) and
    // 0-cruft, but ALL held UNWIRED for one shared reason: pooyan is not yet go-live on the generator
    // engine. A clock-free idiomatic override spends no T-states where the oracle spends many, so under
    // the cycle-driven runFrames a wired override drifts the NMI phase (boot-statediff diverges from
    // ~frame 179, first in the NMI stack) -- it cannot be validated until the convergence config
    // (manifest nmiReturnPC / stateExclude.stack) is measured. The frozen oracle serves each address
    // meanwhile. Group 1 below (memory-only) wires bare once go-live; group 2 ALSO needs a cruft-free
    // register/flag dispatch bridge (the dkong *FromRegisters pattern writes regs + calls regs.and/addHl,
    // register cruft idiomatic_gate counts, which pooyan's implicit-0 budget forbids).
    //
    // -- group 1: memory-only, wire bare post-go-live --
    "paintColumnBodyTiles.js":
      "0x02aa: memory-only (VRAM writes via pointer params). Returns HL for faithfulness but both callers " +
      "reload HL, so bare dispatch is correct. Held for the go-live reason above.",
    "clearBit2AcrossSixSlots.js":
      "0x0e46: memory-only (clears bit 2 across six stride-4 entries at HL). Bare dispatch. Held for go-live. " +
      "CAVEAT: no static caller found (nothing in the translated layer dispatches 0x0e46), so its bare-dispatch " +
      "correctness is unverifiable until its dynamic call site is reached -- a further reason to hold.",
    "setActorAnimation.js":
      "0x381e: memory-only (DE -> ix+0x0C/0x0D, reset ix+0x0E). Bare dispatch, reached ~219x in attract. Held for go-live.",
    "storeActorAnimationPointer.js":
      "0x5c75: memory-only (DE -> iy+0x0c/0x0d, reset iy+0x0e). Bare dispatch. Held for go-live.",
    //
    // -- group 2: register/flag live-out, also needs a cruft-free bridge --
    "blankTileColumn.js":
      "0x02b1: HL is a GENUINE live-out -- loc_0254 issues 0x02b1 back-to-back without reloading HL, so " +
      "each call consumes the pointer the previous left. A single-register HL bridge is expressible " +
      "cruft-free (return (m.regs.hl = ...)), but it is held with the flag/multi-register siblings below " +
      "until the bridge convention + a gameplay boot-statediff validate the dispatch path.",
    "initActorRecord.js":
      "0x619f: HL live-out -- the oracle advances HL to rec+0x17 and its callers loc_60bc/loc_60d9 tail-jump " +
      "into loc_611f WITHOUT reloading HL, which reads the scan key at rec+0x14 (HL += 0xfffd). Wired bare it " +
      "diverges at frame 1754 (first addr 0x8a40, a real work-RAM cell -- NOT the stack phase artifact). The " +
      "module returns the advanced pointer; needs the same cruft-free HL bridge as blankTileColumn. (BC ends " +
      "0x0004 as plumbing; no caller confirmed to read it.)",
    "splitBcdByte.js":
      "0x0429: three live-outs the callers read -- A (high BCD digit), HL (advanced by DE) and the Z flag " +
      "(leading-zero test). The module returns { high, next } and Z-sense = high===0; a bridge must set " +
      "regs.a/regs.hl and the Z flag, and setting Z is a read-modify-write of regs.f = register cruft.",
    "drawStackedBcdDigits.js":
      "0x1119: loc_6f42 reads HL (advanced), E (input byte) AND BC == 0xffe0 back after the call. A bridge " +
      "must restore all three; the module is memory-only + returns { next, byte }, and BC is a machine " +
      "residue no idiomatic body should hold.",
    "advanceFallStep.js":
      "0x3fd5: the live-out is the CARRY flag (callers use ret c). The module returns a boolean; a bridge " +
      "must set carry, i.e. read-modify-write regs.f = register cruft under the implicit-0 budget.",
    "stampObjectAndDecCounter.js":
      "0x57e5: live-outs are A (byte from (BC)) and the Z flag (dec counter). The module returns " +
      "{ a, counter }; a bridge must set regs.a and the Z flag. No confirmed caller (register-dispatched, " +
      "0 dispatches in attract), so the exact flag consumer is unverified -- another reason to hold it.",
  },
};

/**
 * DEBT: modules ALREADY unwired the first time this guard ran for a game. Recorded, not blessed.
 *
 * ★ THE FINDING, not just a list. Every module below is COMMITTED, carries a green
 * equivalence-<addr> gate, is named by no ROUTINES entry, and is imported by no idiomatic sibling,
 * so nothing but its own test ever calls it and the frozen oracle runs at each address instead --
 * this is the Donkey Kong batch the method doc describes as accumulating unnoticed, still unwired.
 * Green gates are WHY it survived: a gate imports its module rather than dispatching to it.
 *
 * ★ NOT ESTABLISHED: what each one NEEDS. Some are leaves to wire, some should dissolve into the
 * caller that still m.calls them, and two -- loc_00ca, loc_02e3 -- are the computed-jp dispatchers
 * this game's override seam reaches outside `Machine.call`, where wiring may be wrong. No entry is
 * a verdict. Donkey Kong is a finished port; clearing this is a unit of work and Karl's to open.
 *
 * Checked as a SUBSET: a new one fails, removing an old one does not. Re-derive, never hand-edit.
 */
export const DEBT = {
  dkong: [
    "loc_00ca.js",
    "loc_02e3.js",
    "loc_0400.js",
    "loc_062a.js",
    "loc_1c05.js",
    "loc_1f8d.js",
    "loc_1fac.js",
    "loc_202f.js",
    "loc_2038.js",
    "loc_2053.js",
    "loc_2079.js",
    "loc_2083.js",
    "loc_20a2.js",
    "loc_20b5.js",
    "loc_20c3.js",
    "loc_20e1.js",
    "loc_2101.js",
    "loc_2118.js",
    "loc_2146.js",
    "loc_2153.js",
    "loc_215f.js",
    "loc_29af.js",
    "loc_2b1c.js",
  ],
};
