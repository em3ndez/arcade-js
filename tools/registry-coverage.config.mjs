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
    //
    // -- batch 2: 42 leaf modules (decompiled + equivalence-proven, 0-cruft); same go-live hold as batch 1.
    //    5 planned 'leaves' (0x6da6/0x7442/0x15a1/0x72cf/0x0fd5) were JUMP-TABLE DISPATCHERS, not
    //    memory-transform leaves -- DEFERRED (dispatch plumbing, like 0x2e45/0x40d0), not decompiled. --
    "adjustSpawnColumn.js":
      "0x57b4: register C (the adjusted column), returned; the caller consumes C, so wiring needs a bridge to write the return back into C. Early-return branches return the unchanged input col. Held UNWIRED (go-live).",
    "advanceActorAnimFrame.js":
      "0x403c: memory-only — all state persists in the IY record (advanced stream pointer written back to +0x0c:+0x0d; new frame fields to +0x0e/+0x0f/+0x10). No register/flag live-out; the oracle's final HL/A are scratch that no caller reads. Held UNWIRED (go-live).",
    "advanceActorDropStateOnDelay.js":
      "0x24db: memory-only (record fields +0x02/+0x04/+0x06/+0x0f/+0x11); early-return path leaves the dec's Z flag but the state dispatcher reads no reg/flag. Held UNWIRED (go-live).",
    "advanceEaglePhaseAndClearAim.js":
      "0x7292: memory-only (see module JSDoc). Bare dispatch, held UNWIRED (go-live).",
    "advanceRisingActorStep.js":
      "0x2ab3: memory-only (the actor record at IX); no register or flag survives — both ret paths are register-transparent. Held UNWIRED (go-live).",
    "advanceTileAnimForwardOnOdd.js":
      "0x2405: memory-only (see module JSDoc). Bare dispatch, held UNWIRED (go-live).",
    "binToPackedBcd.js":
      "0x1131: A (packed BCD = count mod 100) and C (hundreds = count div 100); both consumed by loc_10c2 (A drawn as a 2-digit HUD field, C folded into the hundreds slot). Returned as { a, hundreds }. Memory untouched. Held UNWIRED (go-live).",
    "blit2x2TileBlock.js":
      "0x3325: HL advanced to the bottom-left cell (dest + 0x20) -- RETURNED and CONSUMED by callers, so needs a bridge to write HL back. DE/A are plumbing (callers restore DE via push/pop, never read A). Plus the four VRAM writes (the memory effect). Held UNWIRED (go-live).",
    "blitGlyphBlock4x3.js":
      "0x1f8c: memory-only (see module JSDoc). Bare dispatch, held UNWIRED (go-live).",
    "blitTile3x3Block.js":
      "0x3307: returns a value live-out (see module JSDoc); held UNWIRED (go-live) -- a consumed live-out needs a cruft-free bridge before wiring.",
    "byteToPackedBcd.js":
      "0x062a: register A (the packed-BCD result), returned; caller loc_05ee consumes only A (splits it into HUD digit nibbles), daa carry-out not read. Held UNWIRED (go-live).",
    "clearActorArena.js":
      "0x19bc: memory-only: 0x200 zeroed bytes at ACTOR_TABLE (0x8a80..0x8c7f); no register/flag returned. Held UNWIRED (go-live).",
    "clearActorArenaAndCounters.js":
      "0x2ae8: memory-only (returns nothing). Oracle leaves A=6, HL=DE=0x8cc1, BC=0 as ldir plumbing but no caller reads them. Held UNWIRED (go-live).",
    "copyBiasedTileString.js":
      "0x1b80: memory-only (biased bytes written to the dest buffer); oracle leaves A=0xa0 and advanced DE/HL but no caller reads them. Held UNWIRED (go-live).",
    "copyObjectRecordsToDisplayList.js":
      "0x032a: Returns the advanced list pointer (page kept, low byte += 4*count); caller loc_02ef chains its next copy from it -- needs a wiring bridge. IX/B/A/DE are plumbing, not consumed. Held UNWIRED (go-live).",
    "deriveStackedSpriteYs.js":
      "0x23d7: memory-only — A is left = base Y - 6, but no caller consumes it (all four callers loc_2334/236a/2901/32bd reload from RAM or ret immediately after the call, verified). Held UNWIRED (go-live).",
    "dispatchActiveObjectState.js":
      "0x7707: returns a value live-out (see module JSDoc); held UNWIRED (go-live) -- a consumed live-out needs a cruft-free bridge before wiring.",
    "fillAttributeColumns.js":
      "0x075d: memory-only — no register live-out (loc_1dd3 notes HL/DE/A are reloaded; no caller reads the advanced BC). Held UNWIRED (go-live).",
    "flagHighScoreTableCorruptOnChecksumMiss.js":
      "0x0644: memory-only — raises HISCORE_TABLE_CORRUPT_FLAG (0x8df8):=1 on any mismatch; no register/flag is returned (matches the 5b06 checksum-guard template's memory-only contract). Held UNWIRED (go-live).",
    "flagTamperOnRound5ChecksumMiss.js":
      "0x5b06: memory-only (see module JSDoc). Bare dispatch, held UNWIRED (go-live).",
    "foldTargetPresenceBits.js":
      "0x22d0: A (returned): the rotate-folded accumulator. Seeded 0 and only ever rotated, so it resolves to 0 for every input; no memory writes, no other caller-consumed register. Held UNWIRED (go-live).",
    "mirrorSpriteListVertically.js":
      "0x0378: memory-only (rewrites the 0x60-byte list in place; caller loc_0320 rets straight after, no register/flag consumed). Held UNWIRED (go-live).",
    "paintColumnBodyTilesUp.js":
      "0x1cec: memory-only: two tiles at start-0x20 (0x25) and start-0x40 (0x20). HL advances to start-0x40 but NO caller consumes it. Held UNWIRED (go-live).",
    "paintPhaseGauge.js":
      "0x2065: memory-only (up to 5 gauge tiles from 0x863f upward, stride -0x20); no caller reads a register. Held UNWIRED (go-live).",
    "paintTileBlock2x2.js":
      "0x0a40: memory-only (see module JSDoc). Bare dispatch, held UNWIRED (go-live).",
    "paintTileBlock2x2Above.js":
      "0x780f: memory-only (see module JSDoc). Bare dispatch, held UNWIRED (go-live).",
    "precheckCollisionBounds.js":
      "0x5f53: return { e, a, carry }: carry = (A < 0xe0) is the branch result (primary); e = biased X left in the E register; a = biased Y+8 left in A. Held UNWIRED (go-live).",
    "renderDigitWithBlanking.js":
      "0x059d: { next, blankBudget } — advanced cursor (IX+=DE) and remaining blank budget (C), BOTH threaded by caller loc_0552 across a field's digits; needs a bridge writing IX and C back. Held UNWIRED (go-live).",
    "renderPanelFromTable.js":
      "0x0460: Memory only -- the painted panel VRAM. Returns nothing; no register/flag consumed (caller loc_03e9 rets right after). Held UNWIRED (go-live).",
    "renderPhaseGauge.js":
      "0x03c2: memory-only (up to 5 gauge tiles from 0x863f upward, stride -0x20); no caller reads a register. Held UNWIRED (go-live).",
    "renderStageCountdownDigits.js":
      "0x34c9: memory-only (two HUD tiles 0x8743/0x8763); callers loc_1ead/1f14/3fb5 discard every register/flag. Held UNWIRED (go-live).",
    "retreatTileAnimScript.js":
      "0x23ec: Memory only -- the parity gate (0x8f37), the tile byte at the cursor, and the cursor word (0x88be). Plain-ret, no register or flag survives. Void. Held UNWIRED (go-live).",
    "saveLivePageToPlayer0Bank.js":
      "0x1bab: memory-only (see module JSDoc). Bare dispatch, held UNWIRED (go-live).",
    "saveLiveStateToPlayerBank.js":
      "0x1a47: memory-only (status byte, the 0x3f-byte dest-bank copy, PLAY_STATE_INDEX). No register or flag is returned. Held UNWIRED (go-live).",
    "seedObjectRecord.js":
      "0x0a0c: { descPtr, coordPtr } — DE+2 and HL+2, BOTH consumed by caller loc_099c (reads descriptor sentinel from DE, keeps walking HL); needs a bridge writing both DE and HL back. IX (record base) untouched. Held UNWIRED (go-live).",
    "seedTileFillCursor.js":
      "0x02e6: A = 0x20, RETURNED and CONSUMED: caller loc_0092 writes it to the watchdog 0xa000 immediately after the call (needs an A bridge). Plus memory: TILE_FILL_PTR(0x880b):=ptr (16-bit LE), FILL_ROW_COUNTER(0x8809):=0x20. Held UNWIRED (go-live).",
    "selectActivePlayerScoreBuffer.js":
      "0x04f2: DE = the chosen 16-bit buffer pointer, returned; the caller consumes it as a pointer, so wiring must write DE back (needs a bridge). The oracle preserves A and flags (push af/pop af) — NOT a live-out. Held UNWIRED (go-live).",
    "sendSoundCommand.js":
      "0x0e8f: memory-only (see module JSDoc). Bare dispatch, held UNWIRED (go-live).",
    "tickActorAnimHold.js":
      "0x5d1e: memory-only — mutates cells in the record at IX (rec+0x12 timer, rec+0x13 phase, rec+0x16 armed); nothing returned. Confirmed via caller loc_5d0b, which banks its loop counter/stride with exx across the call and reads no register back. Held UNWIRED (go-live).",
    "verifyRomChecksum.js":
      "0x3fe9: memory-only — the tamper counter, incremented ONLY on a checksum deviation; no register/flag live-out (dispatch handler, rets to dispatcher). Held UNWIRED (go-live).",
    "verifyRomSignature.js":
      "0x208c: Memory only -- sets SIGNATURE_MISMATCH_FLAG (0x8ef0)=1 on the first mismatch, else leaves it untouched. No register/flag consumed (caller loc_0254 returns immediately after the call). Held UNWIRED (go-live).",
    "verifyTableChecksum.js":
      "0x585b: memory-only (tamper flag at 0x882b := 1 on mismatch, untouched on match); accumulator regs A/D/HL/B are scratch, no caller reads them. Held UNWIRED (go-live).",
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
