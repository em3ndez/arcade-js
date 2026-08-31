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
    "mainLoopStep.js": "the main-loop state-driver body (loc_020f), direct-called by the mainLoop generator so it can yield at the vblank; the generator imports it rather than dispatching through ROUTINES. Memory-equivalent to the frozen loop body (equivalence-020f); not a dispatch entry.",
    "dispatchOneHunterRecordState.js": "DISSOLVED boolean caller-skip dispatcher; direct-called by idiomatic loc_2c2c; switches ((ix+2)&0x1f)-0x11 to climbHunterToLaunchRowThenPromoteGroup/2cb3/2d24/2d4a; not oracle-served",
    "climbHunterStepAndRetireAtTop.js": "DISSOLVED hunter state-2 caller-skip -> boolean; direct-called by idiomatic dispatchOneHunterRecordState; not oracle-served",
    "clearWaveHoldTimerToArmNextWave.js": "DISSOLVED hunter state-3 caller-skip -> boolean; direct-called by idiomatic dispatchOneHunterRecordState; not oracle-served",
    "loc_0728.js": "DISSOLVED into loc_0714 (SCC fold); idiomatic-unreachable; not oracle-served",
    "initSpawnedActorRecordAndDeriveSpeed.js": "DISSOLVED unconditional caller-skip -> false (always skips); direct-called by loc_54f9/loc_5544/loc_5594 (wired overrides); not oracle-served",
    "spawnEnemyIntoFreeActorSlot.js": "DISSOLVED caller-skip -> boolean (spawn path); direct-called by loc_56e8/loc_588e (wired overrides); not oracle-served",
    "loc_5733.js": "DISSOLVED caller-skip -> boolean; direct-called by loc_53a0 (a wired ROUTINES override); not oracle-served",
    "testEnemyRecordHitAndRegister.js": "DISSOLVED caller-skip -> boolean; direct-called by loc_5b86 (a wired ROUTINES override); not oracle-served",
    "latchObjectTypeAndScanEnemyRecords.js": "DISSOLVED caller-skip -> boolean; direct-called by loc_5f6a (a wired ROUTINES override); not oracle-served",
    "scanObjectBankForActorCollision.js": "DISSOLVED caller-skip -> boolean (true=keep scanning, false=abort); direct-called by loc_6404 (a wired ROUTINES override); not oracle-served",
    "verifyTerminatorTableOrCountTamper.js": "DISSOLVED caller-skip -> boolean (true=keep scanning, false=abort); direct-called by scanObjectBankForActorCollision (a wired ROUTINES override); not oracle-served",
    "spawnPairedEnemyRecordAndAnnounceWave.js": "DISSOLVED caller-skip -> boolean (true=already active/keep sweeping, false=spawned/abort); direct-called by loc_6905 (a wired ROUTINES override); not oracle-served",
    "spawnEnemyIntoFreeSlotCyclingAnim.js": "DISSOLVED caller-skip -> boolean (true=already active/keep sweeping, false=spawned/abort); direct-called by loc_6a0f (a wired ROUTINES override); not oracle-served",
    "dispatchEnemyActorAnimTickState.js": "DISSOLVED dispatch propagator -> boolean; direct-called by loc_7627 (a wired ROUTINES override); switches (ix+2)&3 to tickEnemyAnimAndReseedPoolAtCycleEnd/7675/76a6; not oracle-served",
    "tickEnemyAnimAndReseedPoolAtCycleEnd.js": "DISSOLVED caller-skip -> boolean (true=keep walking, false=abort); direct-called by the idiomatic dispatcher dispatchEnemyActorAnimTickState; not oracle-served",
    "drainPhaseCountdownAndReseedWave.js": "DISSOLVED caller-skip -> boolean (true=keep walking, false=abort); direct-called by the idiomatic dispatcher dispatchEnemyActorAnimTickState; not oracle-served",
    "holdEnemyAnimGatedByDrawnFlag.js": "DISSOLVED plain-ret handler (returns keep-walking); direct-called by the idiomatic dispatcher dispatchEnemyActorAnimTickState; not oracle-served",
    "classifyAndRouteObjectRecordByRound.js": "DISSOLVED tail-call -> boolean (object-proximity SCC entry); direct-called by idiomatic latchObjectTypeAndEnterProximityScan via the wired loc_602f; not oracle-served",
    "latchObjectTypeAndEnterProximityScan.js": "DISSOLVED fall-through -> boolean (true=normal/inert, false=hit skip); direct-called by loc_602f (a wired ROUTINES override); not oracle-served",
    "gateEvenRoundOverlapAndRouteHit.js": "DISSOLVED tail-call -> boolean (miss->60f2, hit->60bc); direct-called within the idiomatic SCC; not oracle-served",
    "loc_60f2.js": "DISSOLVED scan loop -> boolean; direct-called within the idiomatic SCC (recurses to classifyAndRouteObjectRecordByRound); not oracle-served",
    "resolveOddRoundCollisionAndAward.js": "DISSOLVED award caller-skip -> boolean; direct-called within the idiomatic SCC; not oracle-served",
    "resolveKind50AndD0CollisionAward.js": "DISSOLVED tail-call -> boolean; direct-called by idiomatic resolveOddRoundCollisionAndAward; not oracle-served",
    "testKindF0TightOverlap.js": "DISSOLVED tail-call -> boolean; direct-called by idiomatic resolveOddRoundCollisionAndAward; not oracle-served",
    "resolveShotHitEngageOrSeedRecord.js": "DISSOLVED hit-handler caller-skip -> boolean; direct-called by idiomatic gateEvenRoundOverlapAndRouteHit; not oracle-served",
    // DISSOLVED caller-skips (pop-af; ret -> boolean). A caller-skip pops its own return (a net SP move
    // outside the withOmittedRet seam's 0/+2 window), so it cannot be a ROUTINES override. Per the runbook
    // each is dissolved into a boolean its caller early-returns on and is called DIRECTLY by that (wired)
    // caller -- it runs as JS, never the frozen oracle. Also recorded `dead` in tools/idiomatic-boundaries.txt.
    // The five jump-table dispatchers (0x6da6/0x7442/0x15a1/0x72cf/0x0fd5) are deferred to their own unit.
    "stageFormationReadyMarkersOrSkipTick.js":
      "DISSOLVED caller-skip -> boolean (true=normal, false=skip); direct-called by loc_2b9a " +
      "(a wired ROUTINES override), so it runs as JS and is never oracle-served. Not a ROUTINES " +
      "override: the pop-af skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "launchFormationObjectIntoFreeSlot.js":
      "DISSOLVED caller-skip -> boolean (true=normal, false=skip); direct-called by loc_2bb3 " +
      "(a wired ROUTINES override), so it runs as JS and is never oracle-served. Not a ROUTINES " +
      "override: the pop-af skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "climbHunterToLaunchRowThenPromoteGroup.js":
      "DISSOLVED caller-skip -> boolean (true=normal, false=skip); direct-called by loc_2a01 " +
      "(a wired ROUTINES override), so it runs as JS and is never oracle-served. Not a ROUTINES " +
      "override: the pop-af skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "testHangingRopeGrabConnect.js":
      "DISSOLVED caller-skip -> boolean (true=normal, false=skip); direct-called by advanceHangingRopeObjectWithGrabCheck " +
      "(a wired ROUTINES override), so it runs as JS and is never oracle-served. Not a ROUTINES " +
      "override: the pop-af skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "seedFormationChildIntoFreeSlotAndLaunchParent.js":
      "DISSOLVED caller-skip -> boolean (true=normal, false=skip); direct-called by loc_3c92 " +
      "(a wired ROUTINES override), so it runs as JS and is never oracle-served. Not a ROUTINES " +
      "override: the pop-af skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "testTargetPairOverlapAndClaimRecord.js":
      "DISSOLVED caller-skip -> boolean (true=normal, false=skip); direct-called by loc_5d4d " +
      "(a wired ROUTINES override), so it runs as JS and is never oracle-served. Not a ROUTINES " +
      "override: the pop-af skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "testTargetSlotGrabAndCatchObject.js":
      "DISSOLVED caller-skip -> boolean (true=normal, false=skip); direct-called by loc_5e11 " +
      "(a wired ROUTINES override), so it runs as JS and is never oracle-served. Not a ROUTINES " +
      "override: the pop-af skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "clearActiveObjectTypeAndAbortHandler.js":
      "DISSOLVED caller-skip -> boolean (true=normal, false=skip); direct-called by loc_613d " +
      "(a wired ROUTINES override), so it runs as JS and is never oracle-served. Not a ROUTINES " +
      "override: the pop-af skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "retireParityTargetSlotAndQueueSound.js":
      "DISSOLVED caller-skip -> boolean (true=normal, false=skip); direct-called by loc_62e6 " +
      "(a wired ROUTINES override), so it runs as JS and is never oracle-served. Not a ROUTINES " +
      "override: the pop-af skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "scanTargetSlotsAndSpawnOnProximityHit.js":
      "DISSOLVED caller-skip -> boolean (true=normal, false=skip); direct-called by loc_6381 " +
      "(a wired ROUTINES override), so it runs as JS and is never oracle-served. Not a ROUTINES " +
      "override: the pop-af skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "testTargetProximityAndSetAimDirection.js":
      "DISSOLVED caller-skip -> boolean (true=normal, false=skip); direct-called by loc_6c18 " +
      "(a wired ROUTINES override), so it runs as JS and is never oracle-served. Not a ROUTINES " +
      "override: the pop-af skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "seedFreeEnemyRecordFromRoundTables.js":
      "DISSOLVED caller-skip -> boolean (true=normal, false=skip); direct-called by loc_1171 " +
      "(a wired ROUTINES override), so it runs as JS and is never oracle-served. Not a ROUTINES " +
      "override: the pop-af skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "initDescendingObjectSlot.js":
      "DISSOLVED caller-skip -> boolean (true=slot busy/keep sweeping, false=slot initialized/abort); " +
      "direct-called by moveFormationAndSpawnObject (a wired ROUTINES override), so it runs as JS and is never oracle-served. " +
      "Not a ROUTINES override: the pop-af/ret skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "activateLaneActorSlot.js":
      "DISSOLVED caller-skip -> boolean (true=already active/keep sweeping, false=activated/abort); " +
      "direct-called by spawnNextScriptedEnemy (a wired ROUTINES override), so it runs as JS and is never oracle-served. " +
      "Not a ROUTINES override: the pop-af/ret skip moves SP outside the withOmittedRet seam's 0/+2 window.",
    "launchWolfIntoSlot.js":
      "DISSOLVED caller-skip -> boolean (true=slot occupied/keep sweeping, false=launched/abort); " +
      "direct-called by spawnNextEnemyOnDelay (a wired ROUTINES override), so it runs as JS and is never oracle-served. " +
      "Not a ROUTINES override: the caller-skip's net SP move is outside the withOmittedRet seam's 0/+2 window.",
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
