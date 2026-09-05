![Space Invaders](invaders.jpg)

# RAM Usage

Work RAM lives at `0x2000`–`0x23FF`. Each name below describes the cell by its role in
the running game; the hex address is the stable identity. Cells that share a byte, or
whose role is only partly pinned, carry a terse caveat.

>>> memory

| Address | Name | Description |
| --- | --- | --- |
| 2000 | alienDrawPending |  |
| 2002 | playerShotHit |  |
| 2003 | alienExplosionTimer |  |
| 2005 | alienMarchFrameToggle |  |
| 2006 | alienDrawIndex |  |
| 2007 | fleetStepDy |  |
| 200b | alienDrawAddr |  |
| 200d | fleetMoveDir |  |
| 200e | fleetDropDelta |  |
| 2010 | gameObjectTable |  |
| 2012 | playerShipDrawPending | record-0 draw-pending flag, cleared after each redraw |
| 2018 | playerShipSpriteDesc | record-0 current animation sprite descriptor (5 bytes) |
| 201a | playerShipCoordLo | record-0 animation coordinate word (low of the descriptor) |
| 201b | playerShipX |  |
| 201d | demoShipDir |  |
| 201e | inputCodeStageFlag |  |
| 2020 | objectTableMid | mid-screen object/timer record-table base ($008C passes to the walker; vblank uses GAME_OBJECT_TABLE 0x2010) |
| 2025 | playerShotStatus |  |
| 2026 | playerShotRetireTimer |  |
| 2027 | playerShotDesc |  |
| 202b | playerShotRowCount |  |
| 202c | playerShotYStep |  |
| 202d | fireButtonLatch |  |
| 2030 | alienShotSlot2Record | object-record cells + per-record ROM templates (object handlers 0x0476/0x04b6/0x050f/0x0682) ── The object table 0x2010.. |
| 2038 | alienShot2StepGate | object-record cells + per-record ROM templates (object handlers 0x0476/0x04b6/0x050f/0x0682) ── The object table 0x2010.. |
| 2040 | alienShotSlot3Record | object-record cells + per-record ROM templates (object handlers 0x0476/0x04b6/0x050f/0x0682) ── The object table 0x2010.. |
| 2045 | alienShotSlot3Desc | object-record cells + per-record ROM templates (object handlers 0x0476/0x04b6/0x050f/0x0682) ── The object table 0x2010.. |
| 2050 | attractObjectTable | anim descriptor scratch (runHandshakedAttractAnim blockCopy dst) |
| 2055 | attractAnimAck | ISR anim-step handshake bit0 (runHandshakedAttractAnim spins on it) -- a descriptor-mirror byte maintained by the shared blockCopy $1A32 |
| 2058 | alienShot4ColumnCursor | object-record cells + per-record ROM templates (object handlers 0x0476/0x04b6/0x050f/0x0682) ── The object table 0x2010.. |
| 2061 | collisionFlag |  |
| 2062 | alienExplosionSpriteDesc |  |
| 2064 | alienExplosionAddr |  |
| 2067 | activePlayerPage |  |
| 2068 | fleetMarchEnable |  |
| 2069 | shipReadyFlag |  |
| 206b | lastAlienFlag |  |
| 206c | typePaceCount | per-record type-pace byte (typeDrawScriptRecord/drawScoreAdvanceTable) |
| 206d | warmRestartSuppress | record-0 warm-restart suppress flag |
| 206e | alienShotSlot3DisableFlag | object-record cells + per-record ROM templates (object handlers 0x0476/0x04b6/0x050f/0x0682) ── The object table 0x2010.. |
| 2070 | alienShotRateGate0 |  |
| 2071 | alienShotRateGate1 |  |
| 2072 | drawPhaseFlag |  |
| 2073 | objectWorkBuffer |  |
| 2076 | alienShotColumnCursor |  |
| 2078 | alienShotBlowupTimer |  |
| 2079 | alienShotSpritePtr |  |
| 207b | alienShotCoord |  |
| 207d | alienShotRowCount |  |
| 207e | alienShotStep |  |
| 207f | alienShotSpriteFrameCeiling |  |
| 2081 | shieldSaveRestoreMode |  |
| 2082 | alienCount |  |
| 2084 | saucerActive |  |
| 2085 | saucerHit |  |
| 208c | saucerStepDx | object-record cells + per-record ROM templates (object handlers 0x0476/0x04b6/0x050f/0x0682) ── The object table 0x2010.. |
| 208d | saucerScoreKeyPtr |  |
| 208f | saucerDirSeqPtr | object-record cells + per-record ROM templates (object handlers 0x0476/0x04b6/0x050f/0x0682) ── The object table 0x2010.. |
| 2091 | saucerTimer |  |
| 2093 | creditScreenShown | attract credit-screen-shown latch (0 = not yet shown) |
| 2094 | soundPort3Shadow |  |
| 2095 | fleetSoundStep |  |
| 2096 | fleetSoundTimer |  |
| 2097 | fleetSoundPeriod |  |
| 2098 | soundPort5Shadow |  |
| 2099 | sfxOffTimer |  |
| 209a | tiltResetActive | tilt/panic reset-in-progress guard (set while the warm restart runs, cleared at its end) |
| 209b | fleetSoundOffTimer |  |
| 20c0 | frameDelayTimer | vblank-decremented busy-wait counter ($0010 `dcr m`) |
| 20c1 | taskFlags |  |
| 20c2 | animFrameCounter |  |
| 20c3 | animCoordStepLo |  |
| 20c5 | animSpriteCoord |  |
| 20c7 | animSpriteSrc |  |
| 20ca | animEndCoord |  |
| 20cb | animDoneFlag |  |
| 20cc | animBaseSpriteSrc |  |
| 20ce | twoPlayerGame |  |
| 20e5 | extraShipAwardFlag |  |
| 20e9 | gameActive |  |
| 20ea | coinInputLatch | coin-switch edge latch: armed while IN1 b0 idle, banks one CREDIT_COUNT on the press edge ($0010) |
| 20eb | creditCount |  |
| 20ec | screenModeToggle | attract-screen alternator, flipped 0/1 each finishAttractCycle pass |
| 20ed | attractDemoPtr |  |
| 20ef | gameInProgress |  |
| 20f1 | scoreAddPending |  |
| 20f2 | scoreAddValue |  |
| 20f3 | scoreAddValueHi |  |
| 20f4 | highScoreObjDesc |  |
| 20f8 | player1ObjDesc |  |
| 20fc | player2ObjDesc |  |
| 2100 | alienFieldP1 |  |
| 2142 | player1ShieldBuffer |  |
| 21fe | player1RoundCounter | player-1 object-record byte cleared at game start |
| 21ff | player1ShipCount | starting-ships latch (runAttractCycle) |
| 2200 | alienFieldP2 |  |
| 2242 | player2ShieldBuffer |  |
| 22fc | player2FleetRefCoord | player-2 object-record coordinate word (seeded at game start) |
| 22ff | player2Ships | player-2 starting-ships latch (player-1 mirror PLAYER1_SHIP_COUNT) |
