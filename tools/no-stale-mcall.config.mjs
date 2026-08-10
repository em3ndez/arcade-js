// SPDX-License-Identifier: GPL-3.0-only

export const ALLOWED = {
  thepit: {
    "initRoundAndEnterMainLoop.js": [0x0348], // -> mainLoop
    "enterPlayMode.js": [0x031a], // -> round init (falls into mainLoop)
    "advanceToNextLevel.js": [0x031a],
    "setUpRoundAndHoldIntro.js": [0x031a],
    "holdRoundIntroLoop.js": [0x031a],
    "resetStateAndShowSetup.js": [0x01f9], // -> reset/entry handler (re-enters play)
    "submitHighScoresAndReset.js": [0x01f9],
    "rearmMachineAndBranchOnCredits.js": [0x021c], // -> credit-screen hold (displays forever)
  },
  timeplt: {
    "enableInterruptAndEnterForegroundLoop.js": [0x0b93],
    "enterCommandRingDrain.js": [0x0b93], // -> the drain, same exception: a direct import wires the generator in unconditionally and hangs; reaching it through the map lets the gate sever it

    "sumImageBlockForTheTamperCheck.js": [0x07ad], // -> the tamper hand-off; equivalence-43e8 severs the chain here with a routine-map stub to record the handover, and that interception only works through m.call, so a direct import blinds four of its arms (dissolve attempted, reverted)

    "armAttractScreenShowingHighScore.js": [0x01c2], // -> blankNextLine, the countdown guard: on the guard-block path (the common dispatch) armAttractScreenShowingHighScore returns straight after this call, so the scratch regs the frozen loop leaves in hl/b/de are live-out; the lifted blankNextLine never writes them and its register ceiling is only [a,f,sp]. Same class as sumImageBlockForTheTamperCheck.js -> 0x07ad

    "setTheLaunchFacingInsideOneAimWindow.js": [0x42b7], // -> the launcher (batch-4 lift of loc_42b7); equivalence-429c stubs the launcher through the routine map to test 429c in isolation, sweeping each of its three input bytes 256x against a recorder, and that interception only works through m.call, so a direct import runs the real launcher on the candidate against the recorder stub on the oracle and breaks seven arms. Same class as sumImageBlockForTheTamperCheck.js -> 0x07ad (dissolve attempted, reverted)

    "serviceRoundThenResolvePlayerState.js": [0x43b7],
    "loc_43b7.js": [0x43f0],
    "loc_00d8.js": [0x00d9],
    "loc_1651.js": [0x167b],
    "seatTheStackAndSettleTheControlLatch.js": [0x0069],
    "armThePenRouteThenColdStartOnATamperedImage.js": [0x0069],
  },
};

/**
 * DEBT: calls that already existed the first time the guard ran for a game. Recorded, not blessed.
 * ★ NOT ESTABLISHED as dissolvable: none of these is a forever loop (checked), but many are tail
 * chains that never return and at least one pops its caller's return deliberately (load-bearing ABI);
 * no entry is a verdict. Checked as a SUBSET, keyed by caller AND target, so a NEW caller reaching an
 * indebted callee still fails. Re-derive with `findStaleMcalls`; never hand-edit.
 */
export const DEBT = {
  dkong: {
    "advanceBarrelMotion.js": [0x1fac, 0x1fe5, 0x1fef, 0x2053, 0x20ec],
    "advanceBarrelTileAnimation.js": [0x21ba],
    "advanceFallingBarrel.js": [0x2101, 0x2104, 0x2118],
    "advanceFire.js": [0x333d],
    "advanceLiveFires.js": [0x3202],
    "advanceRollingBarrel.js": [0x202f, 0x2038, 0x215f, 0x21ba, 0x24b4],
    "loc_02e3.js": [0x062a],
    "loc_1bec.js": [0x1c05],
    "loc_1bf2.js": [0x1c05],
    "loc_1c05.js": [0x2b1c],
    "loc_1f8d.js": [0x1f83],
    "loc_1fac.js": [0x1fce, 0x21ba],
    "loc_202f.js": [0x2038],
    "loc_2038.js": [0x21ba],
    "loc_2053.js": [0x2079, 0x2083, 0x21ba, 0x24b4],
    "loc_2079.js": [0x21ba],
    "loc_2083.js": [0x20a2, 0x20c3, 0x21ba],
    "loc_20a2.js": [0x20b5, 0x20c3],
    "loc_20b5.js": [0x20c3, 0x20e1],
    "loc_20c3.js": [0x21ba],
    "loc_20e1.js": [0x20c3],
    "loc_2101.js": [0x2104, 0x24b4],
    "loc_2118.js": [0x2146, 0x2153],
    "loc_2146.js": [0x2153],
    "loc_2153.js": [0x21ba],
    "loc_215f.js": [0x21ba],
    "loc_2b1c.js": [0x29af],
    "publishBarrelSprite.js": [0x1f8d],
    "retireBarrelAtEndOfRange.js": [0x1fce, 0x21ba],
    "retireBarrelIntoOilDrum.js": [0x21ba],
    "runAttractDemoFrame.js": [0x197a],
    "runGameplayFrame.js": [0x1f72],
    "serviceBarrelSlotIfLive.js": [0x1f8d, 0x1f93],
    "stepBarrelLeft.js": [0x1ff6],
    "stepBarrelRight.js": [0x1ff6],
    "update25mBarrels.js": [0x1f83],
    "updateFires.js": [0x31b1],
  },
};
