# The Pit — Main CPU (Z80)

>>> cpu Z80

>>> binary 0000:roms/p38b.ic38 + roms/p39b.ic39 + roms/p40b.ic40 + roms/p41b.ic41 + roms/p33b.ic33

>>> memoryTable hard 
[Hardware Info](Hardware.md)

>>> memoryTable ram 
[RAM Usage](RAMUse.md)

; The Pit (Zilec Electronics / Centuri / Taito, 1982; MAME `thepitu1`) — main-CPU (Z80) program
; ROM, 0x0000-0x4FFF (20480 bytes, five 4K parts). You are an astronaut-explorer: dig down through
; a dirt field to a bottom treasure chamber, grab jewels, and climb back up to your ship (the
; final stretch is the "Pit" crossing). Rival explorers roam the tunnels; you fire a horizontal
; laser. This listing was reverse-engineered by reachability-driven disassembly of the ROM against
; MAME 0.288 and three rounds of live grounding; unreached spans are marked as untraced data.
; Labels and comments come from the grounded model (mechanisms.md) and the idiomatic
; decompilation; the `ram.` / `hard.` / `code.` operand tags are resolved by the CA toolchain
; against RAMUse.md / Hardware.md / this file's labels.
;
; ARCHITECTURE. Reset (0x0000) jumps to cold-boot init (0x01a4). The in-game/attract MAIN LOOP is
; loc_0348 (runs forever): it enables the NMI, runs the demo autopilot when attract, then the
; player dispatcher 0x13c9 (also the master board-transition gate), mountain erosion 0x241c, the
; jewel glitter 0x06ac, and the laser 0x24f3 which TAIL-CHAINS the whole actor pipeline
; (dig/hazards 0x29ad -> chamber creature 0x2f71 -> enemies 0x312d/0x316f -> enemy-3/ship 0x3748).
; The real per-frame service is the vblank NMI serviceVblankNmi (0x0066): credit watchdog, sound-
; ring drain to 0xb800, sprite DMA 0x8220->0x9840, frame timers, input debounce, coin accounting.
; Death is loc_0278 (only two triggers: enemy contact and transition-timer expiry in death mode);
; level-advance is advanceToNextLevel (0x02fd).

; resetVector — the power-on entry: the very first thing the processor runs after reset, it hands
; straight off to cold-boot init and never comes back. ROM 0x0000.
resetVector:
0000: C3 A4 01        JP      $01A4               ; {code.coldBootInit} reset -> hands straight off to cold-boot init; never returns

; ==== UNREACHED 0x0003-0x0065 (99 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
0003:                 DEFB    $98,$59,$6B,$C8,$A8,$99,$AC,$9B,$7F,$98,$AE,$9C,$69,$9B,$F8,$81
0013:                 DEFB    $9C,$99,$9A,$E5,$A8,$99,$98,$9B,$9B,$99,$59,$9C,$93,$88,$DF,$91
0023:                 DEFB    $EB,$99,$54,$9D,$29,$5D,$55,$58,$E1,$58,$AB,$6D,$2C,$99,$9C,$29
0033:                 DEFB    $76,$68,$B6,$A9,$96,$C3,$A4,$01,$D7,$A9,$13,$4F,$88,$A9,$98,$39
0043:                 DEFB    $6B,$99,$16,$DD,$29,$D9,$DD,$99,$5C,$14,$58,$54,$98,$C9,$9A,$9B
0053:                 DEFB    $61,$88,$9C,$9B,$6B,$A8,$81,$99,$5B,$8A,$54,$9C,$4A,$99,$9D,$DD
0063:                 DEFB    $EB,$D9,$86

; serviceVblankNmi — the per-frame vblank interrupt service: acknowledge, guard the credit count,
; fire a queued sound, blit sprites, tick timers, debounce inputs, and bank coins. ROM 0x0066.
serviceVblankNmi:
0066: 08              EX      AF,AF'
0067: D9              EXX
0068: 3E 00           LD      A,$00
006A: 32 00 B0        LD      ($B000),A           ; {hard.mainLatch} LS259 b0 = 0  -> NMI acknowledge
006D: 3A 00 80        LD      A,($8000)           ; {ram.creditCount}
0070: FE 0A           CP      $0A
0072: D2 A4 01        JP      NC,$01A4            ; {code.coldBootInit} credit >= 10 -> reset
0075: 47              LD      B,A
0076: 3A 1C 80        LD      A,($801C)           ; {ram.creditMirrorA}
0079: B8              CP      B
007A: C2 A4 01        JP      NZ,$01A4            ; {code.coldBootInit} copy 1 mismatch -> reset
007D: 3A 2C 81        LD      A,($812C)           ; {ram.creditMirrorB}
0080: B8              CP      B
0081: C2 A4 01        JP      NZ,$01A4            ; {code.coldBootInit} copy 2 mismatch -> reset
0084: 3A 1F 80        LD      A,($801F)           ; {ram.soundTail}
0087: 5F              LD      E,A
0088: 3A 1E 80        LD      A,($801E)           ; {ram.soundHead}
008B: BB              CP      E
008C: 28 17           JR      Z,$00A5             ; {code.loc_00a5} ring empty -> skip
008E: 7B              LD      A,E
008F: 3C              INC     A
0090: E6 07           AND     $07
0092: 32 1F 80        LD      ($801F),A           ; {ram.soundTail}
0095: 21 20 80        LD      HL,$8020            ; {ram.soundRing}
0098: 16 00           LD      D,$00
009A: 19              ADD     HL,DE
009B: 7E              LD      A,(HL)
009C: 36 00           LD      (HL),$00
009E: CB 7F           BIT     7,A
00A0: 28 03           JR      Z,$00A5             ; {code.loc_00a5}
00A2: 32 00 B8        LD      ($B800),A           ; {hard.soundLatch} sound latch

loc_00a5:
00A5: 11 40 98        LD      DE,$9840            ; {hard.spriteRam}
00A8: 21 20 82        LD      HL,$8220            ; {ram.spriteStagingBase}
00AB: 01 20 00        LD      BC,$0020
00AE: ED B0           LDIR                        ; 0x8220.. -> sprite RAM 0x9840
00B0: 3A 09 80        LD      A,($8009)           ; {ram.frameWaitCountdown}
00B3: 3D              DEC     A
00B4: 32 09 80        LD      ($8009),A           ; {ram.frameWaitCountdown}
00B7: 3A 06 80        LD      A,($8006)
00BA: 3D              DEC     A
00BB: 32 06 80        LD      ($8006),A
00BE: 20 0C           JR      NZ,$00CC            ; {code.loc_00cc}
00C0: 3A 0F 80        LD      A,($800F)
00C3: 3D              DEC     A
00C4: 32 0F 80        LD      ($800F),A
00C7: 3E 3C           LD      A,$3C
00C9: 32 06 80        LD      ($8006),A

loc_00cc:
00CC: 3A 07 80        LD      A,($8007)           ; {ram.frameCounterPrescaler}
00CF: 3D              DEC     A
00D0: 32 07 80        LD      ($8007),A           ; {ram.frameCounterPrescaler}
00D3: 20 0C           JR      NZ,$00E1            ; {code.loc_00e1}
00D5: 3A 10 80        LD      A,($8010)           ; {ram.playPhaseCounter}
00D8: 3C              INC     A
00D9: 32 10 80        LD      ($8010),A           ; {ram.playPhaseCounter}
00DC: 3E 3C           LD      A,$3C
00DE: 32 07 80        LD      ($8007),A           ; {ram.frameCounterPrescaler}

loc_00e1:
00E1: 3A 16 80        LD      A,($8016)           ; {ram.in1Prev}
00E4: 47              LD      B,A
00E5: 3A 00 A8        LD      A,($A800)           ; {hard.in1} IN1 (coin/start, active high)
00E8: B8              CP      B
00E9: 20 03           JR      NZ,$00EE            ; {code.loc_00ee}
00EB: 32 15 80        LD      ($8015),A           ; {ram.in1Debounced} stable -> latch edge byte

loc_00ee:
00EE: 32 16 80        LD      ($8016),A           ; {ram.in1Prev}
00F1: 3A 19 80        LD      A,($8019)           ; {ram.in0Prev}
00F4: 47              LD      B,A
00F5: 3A 00 A0        LD      A,($A000)           ; {hard.in0} IN0 (joystick, active low, muxed)
00F8: B8              CP      B
00F9: 20 03           JR      NZ,$00FE            ; {code.loc_00fe}
00FB: 32 18 80        LD      ($8018),A           ; {ram.in0Debounced}

loc_00fe:
00FE: 32 19 80        LD      ($8019),A           ; {ram.in0Prev}
0101: 3A 15 80        LD      A,($8015)           ; {ram.in1Debounced}
0104: 4F              LD      C,A
0105: 21 03 80        LD      HL,$8003            ; {ram.coinSwAccum}
0108: CB 41           BIT     0,C
010A: 28 04           JR      Z,$0110             ; {code.loc_0110}
010C: 36 55           LD      (HL),$55
010E: 18 32           JR      $0142               ; {code.loc_0142}

loc_0110:
0110: 7E              LD      A,(HL)
0111: 36 AA           LD      (HL),$AA
0113: FE 55           CP      $55
0115: 20 2B           JR      NZ,$0142            ; {code.loc_0142}
0117: 3A 00 80        LD      A,($8000)           ; {ram.creditCount}
011A: 3C              INC     A
011B: FE 0A           CP      $0A
011D: 38 02           JR      C,$0121             ; {code.loc_0121}
011F: 3E 09           LD      A,$09

loc_0121:
0121: 32 00 80        LD      ($8000),A           ; {ram.creditCount}
0124: 32 1C 80        LD      ($801C),A           ; {ram.creditMirrorA}
0127: 32 2C 81        LD      ($812C),A           ; {ram.creditMirrorB}
012A: 3A 48 80        LD      A,($8048)           ; {ram.variant}
012D: B7              OR      A
012E: 20 09           JR      NZ,$0139            ; {code.loc_0139}
0130: 3A 01 80        LD      A,($8001)           ; {ram.gameState}
0133: 3D              DEC     A
0134: FE 02           CP      $02
0136: DA 9C 01        JP      C,$019C             ; {code.loc_019c}

loc_0139:
0139: CD 4D 4C        CALL    $4C4D               ; {code.enableSound}
013C: CD 5B 4C        CALL    $4C5B               ; {code.requestSound3}
013F: C3 1C 02        JP      $021C               ; {code.showCreditScreen}

loc_0142:
0142: 3A 48 80        LD      A,($8048)           ; {ram.variant}
0145: B7              OR      A
0146: 20 08           JR      NZ,$0150            ; {code.loc_0150}
0148: 3A 01 80        LD      A,($8001)           ; {ram.gameState}
014B: 3D              DEC     A
014C: FE 02           CP      $02
014E: 38 4C           JR      C,$019C             ; {code.loc_019c}

loc_0150:
0150: 3A 4C 80        LD      A,($804C)           ; {ram.coinsPerCreditA}
0153: 57              LD      D,A
0154: 1E 01           LD      E,$01
0156: 21 04 80        LD      HL,$8004            ; {ram.start1SwAccum}
0159: CB 51           BIT     2,C
015B: 20 04           JR      NZ,$0161            ; {code.loc_0161}
015D: 36 AA           LD      (HL),$AA
015F: 18 07           JR      $0168               ; {code.loc_0168}

loc_0161:
0161: 7E              LD      A,(HL)
0162: 36 55           LD      (HL),$55
0164: FE AA           CP      $AA
0166: 28 18           JR      Z,$0180             ; {code.loc_0180}

loc_0168:
0168: 3A 4D 80        LD      A,($804D)           ; {ram.coinsPerCreditB}
016B: 57              LD      D,A
016C: 1E 02           LD      E,$02
016E: 21 05 80        LD      HL,$8005            ; {ram.start2SwAccum}
0171: CB 49           BIT     1,C
0173: 20 04           JR      NZ,$0179            ; {code.loc_0179}
0175: 36 AA           LD      (HL),$AA
0177: 18 23           JR      $019C               ; {code.loc_019c}

loc_0179:
0179: 7E              LD      A,(HL)
017A: 36 55           LD      (HL),$55
017C: FE AA           CP      $AA
017E: 20 1C           JR      NZ,$019C            ; {code.loc_019c}

loc_0180:
0180: 3A 00 80        LD      A,($8000)           ; {ram.creditCount}
0183: 92              SUB     D
0184: 38 16           JR      C,$019C             ; {code.loc_019c}
0186: 32 00 80        LD      ($8000),A           ; {ram.creditCount}
0189: 32 1C 80        LD      ($801C),A           ; {ram.creditMirrorA}
018C: 32 2C 81        LD      ($812C),A           ; {ram.creditMirrorB}
018F: 7B              LD      A,E
0190: 32 01 80        LD      ($8001),A           ; {ram.gameState}
0193: 32 1D 80        LD      ($801D),A
0196: 32 2D 81        LD      ($812D),A
0199: C3 2D 02        JP      $022D               ; {code.startGame}

loc_019c:
019C: 3E 01           LD      A,$01
019E: 32 00 B0        LD      ($B000),A           ; {hard.mainLatch} LS259 b0 = 1 -> re-enable NMI
01A1: 08              EX      AF,AF'
01A2: D9              EXX
01A3: C9              RET

; coldBootInit — power-on cold-boot init: bring the machine up from reset, seed its work RAM, run
; the one-time screen/table/sound setup, then hand off to the attract flow. ROM 0x01a4.
coldBootInit:
01A4: F3              DI                          ; mask IRQ (no diffed effect; latch gates the NMI)
01A5: ED 56           IM      1                   ; interrupt mode 1 (no diffed effect)
01A7: 31 FF 83        LD      SP,$83FF            ; stack top at the top of work RAM
01AA: CD 10 4B        CALL    $4B10               ; {code.disableFrameInterrupt} A=0 -> LS259 latch (clears NMI/mux/etc.)
01AD: 3E 00           LD      A,$00
01AF: 32 00 80        LD      ($8000),A           ; {ram.creditCount}
01B2: 32 1C 80        LD      ($801C),A           ; {ram.creditMirrorA}
01B5: 32 2C 81        LD      ($812C),A           ; {ram.creditMirrorB}
01B8: 32 01 80        LD      ($8001),A           ; {ram.gameState}
01BB: 3E 06           LD      A,$06
01BD: 32 15 80        LD      ($8015),A           ; {ram.in1Debounced}
01C0: 32 16 80        LD      ($8016),A           ; {ram.in1Prev}
01C3: 3E 55           LD      A,$55
01C5: 32 04 80        LD      ($8004),A           ; {ram.start1SwAccum}
01C8: 32 05 80        LD      ($8005),A           ; {ram.start2SwAccum}
01CB: 07              RLCA                        ; 0x55 rotates left-circular to 0xAA
01CC: 32 03 80        LD      ($8003),A           ; {ram.coinSwAccum} stores 0xAA
01CF: CD EA 4B        CALL    $4BEA               ; {code.resetScoreAndSoundQueue} zero two work-RAM blocks
01D2: CD C7 4B        CALL    $4BC7               ; {code.initScoreDisplay} init two work-RAM tables
01D5: CD 4D 4C        CALL    $4C4D               ; {code.enableSound} set sound-enable latch
01D8: CD 44 4B        CALL    $4B44               ; {code.blankScreen} screen/palette setup (A=0 entry)
01DB: CD 3C 4B        CALL    $4B3C               ; {code.setupBoardModeC0} display setup (A=0xC0)
01DE: CD 57 4C        CALL    $4C57               ; {code.requestSound2} sound-request stub
01E1: 3E 01           LD      A,$01
01E3: 32 02 80        LD      ($8002),A           ; {ram.activePlayer}
01E6: CD 55 4B        CALL    $4B55               ; {code.applyDipSwitches} read DSW at 0xb000
01E9: 01 00 00        LD      BC,$0000

loc_01ec:
01EC: 10 FE           DJNZ    $01EC               ; {code.loc_01ec} decrement B (no flags), spin while non-zero
01EE: 0D              DEC     C
01EF: 20 FB           JR      NZ,$01EC            ; {code.loc_01ec} another 256-count pass while C != 0
01F1: 3E 3C           LD      A,$3C
01F3: CD FF 4B        CALL    $4BFF               ; {code.waitFrames} arm a 0x3c-frame vblank delay
01F6: C3 AC 03        JP      $03AC               ; {code.resetStateAndShowSetup} tail-jump (pushes nothing; 0x03ac's control flow is ours)

; rearmMachineAndBranchOnCredits — the boot/restart state entry: re-arm the machine, then fork on
; the credit count to either the held credit screen or into play. ROM 0x01f9.
rearmMachineAndBranchOnCredits:
01F9: 31 FF 83        LD      SP,$83FF
01FC: CD 14 4B        CALL    $4B14               ; {code.enableNmi} enable NMI (LS259 b0)
01FF: 3E 01           LD      A,$01
0201: 32 02 80        LD      ($8002),A           ; {ram.activePlayer} 0x8002 <- 1
0204: CD 55 4B        CALL    $4B55               ; {code.applyDipSwitches} read+decode the DSW
0207: 3A 00 80        LD      A,($8000)           ; {ram.creditCount}
020A: B7              OR      A                   ; test the flag at 0x8000
020B: C2 1C 02        JP      NZ,$021C            ; {code.showCreditScreen} 0x8000 nonzero: tail-jump to the 0x021c state handler
020E: CD 47 4C        CALL    $4C47               ; {code.disableSound} disable sound (LS259 b3)
0211: 3E 00           LD      A,$00
0213: 32 01 80        LD      ($8001),A           ; {ram.gameState} 0x8001 <- 0
0216: CD 81 3B        CALL    $3B81               ; {code.showFixedScreen} paint the fixed screen
0219: C3 BE 03        JP      $03BE               ; {code.enterPlayMode} unconditional tail-jump to the 0x03be state handler

; showCreditScreen — warm-restart state entry: arm game mode 3, reset the work stack, enable the
; frame interrupt, run the blank-screen display setup, then hand off to the fixed-screen painter
; that holds a static screen forever. ROM 0x021c.
showCreditScreen:
021C: 3E 03           LD      A,$03
021E: 32 01 80        LD      ($8001),A           ; {ram.gameState} mode cell = 3
0221: 31 FF 83        LD      SP,$83FF            ; reset stack, discarding caller's return
0224: CD 14 4B        CALL    $4B14               ; {code.enableNmi} enable the NMI
0227: CD 44 4B        CALL    $4B44               ; {code.blankScreen} A=0 display-mode setup
022A: C3 A8 3B        JP      $3BA8               ; {code.holdFixedScreen} tail-jump into the fixed-screen painter (never returns)

; startGame — set up a fresh game once a credit is registered, then enter play. ROM 0x022d.
startGame:
022D: 31 FF 83        LD      SP,$83FF            ; stack top = end of work RAM
0230: 3E 00           LD      A,$00
0232: 32 48 80        LD      ($8048),A           ; {ram.variant} clear 0x8048
0235: CD 14 4B        CALL    $4B14               ; {code.enableNmi}
0238: CD 4D 4C        CALL    $4C4D               ; {code.enableSound}
023B: CD 44 4B        CALL    $4B44               ; {code.blankScreen}
023E: CD 5F 4C        CALL    $4C5F               ; {code.requestSound4}
0241: CD EA 4B        CALL    $4BEA               ; {code.resetScoreAndSoundQueue}
0244: CD 55 4B        CALL    $4B55               ; {code.applyDipSwitches}
0247: 3A 4E 80        LD      A,($804E)           ; {ram.loopDelayBase}
024A: 32 11 80        LD      ($8011),A           ; {ram.mainLoopDelay} 0x804e -> 0x8011
024D: 3E 01           LD      A,$01
024F: 32 28 80        LD      ($8028),A           ; {ram.level} 0x8028 = 1
0252: 3A 53 80        LD      A,($8053)           ; {ram.startingMen}
0255: 32 2B 80        LD      ($802B),A           ; {ram.menLeft} 0x8053 -> 0x802b
0258: 3E 01           LD      A,$01
025A: 32 02 80        LD      ($8002),A           ; {ram.activePlayer} 0x8002 = 1
025D: CD 32 46        CALL    $4632               ; {code.saveActivePlayerRecord} prime player slot (mode 1)
0260: 3E 02           LD      A,$02
0262: 32 02 80        LD      ($8002),A           ; {ram.activePlayer} 0x8002 = 2
0265: CD 32 46        CALL    $4632               ; {code.saveActivePlayerRecord} prime player slot (mode 2)
0268: 3A 01 80        LD      A,($8001)           ; {ram.gameState}
026B: 32 02 80        LD      ($8002),A           ; {ram.activePlayer} 0x8002 = (0x8001)
026E: CD 44 46        CALL    $4644               ; {code.loadPlayerState}
0271: 3A 2B 80        LD      A,($802B)           ; {ram.menLeft}
0274: 3C              INC     A                   ; flags set (carry preserved); dead before loc_0278
0275: 32 2B 80        LD      ($802B),A           ; {ram.menLeft} PC now at 0x0278

; dockManAndDispatchRoundBoundary — round/state-boundary dispatcher: dock the active player's man
; count, persist their record, then hand off to next-round setup or end-of-round teardown. ROM
; 0x0278.
dockManAndDispatchRoundBoundary:
0278: 3A 01 80        LD      A,($8001)           ; {ram.gameState} the mode/count byte
027B: FE 03           CP      $03                 ; C set iff (0x8001) < 3
027D: D2 AC 03        JP      NC,$03AC            ; {code.resetStateAndShowSetup} (0x8001) >= 3 bails to loc_03ac (tail-jump)
0280: 3A 2B 80        LD      A,($802B)           ; {ram.menLeft}
0283: 3D              DEC     A                   ; counter (0x802b)--
0284: 32 2B 80        LD      ($802B),A           ; {ram.menLeft}
0287: CD 32 46        CALL    $4632               ; {code.saveActivePlayerRecord} ordinary call, returns to 0x028a
028A: 3A 01 80        LD      A,($8001)           ; {ram.gameState} reload the mode/count byte
028D: 3D              DEC     A                   ; Z set iff (0x8001)==1
028E: 20 11           JR      NZ,$02A1            ; {code.stepRoundSubPhaseAndBranch} (0x8001)!=1 tail-jumps to loc_02a1
0290: 32 2D 80        LD      ($802D),A
0293: 3C              INC     A
0294: 32 02 80        LD      ($8002),A           ; {ram.activePlayer}
0297: 3A 2C 80        LD      A,($802C)
029A: A7              AND     A
029B: C2 CA 02        JP      NZ,$02CA            ; {code.setUpRoundAndHoldIntro} (0x802c)!=0 tail-jumps to loc_02ca
029E: C3 71 03        JP      $0371               ; {code.submitHighScoresAndReset} unconditional tail-jump to loc_0371

; stepRoundSubPhaseAndBranch — sequence the round sub-phase byte and hand off to setup or
; teardown. ROM 0x02a1.
stepRoundSubPhaseAndBranch:
02A1: 3A 02 80        LD      A,($8002)           ; {ram.activePlayer}
02A4: FE 01           CP      $01
02A6: 20 0B           JR      NZ,$02B3            ; {code.loc_02b3}
02A8: 3C              INC     A
02A9: 32 02 80        LD      ($8002),A           ; {ram.activePlayer}
02AC: 3A 2D 80        LD      A,($802D)
02AF: A7              AND     A
02B0: C2 CA 02        JP      NZ,$02CA            ; {code.setUpRoundAndHoldIntro}

loc_02b3:
02B3: 3E 01           LD      A,$01
02B5: 32 02 80        LD      ($8002),A           ; {ram.activePlayer}
02B8: 3A 2C 80        LD      A,($802C)
02BB: A7              AND     A
02BC: 20 0C           JR      NZ,$02CA            ; {code.setUpRoundAndHoldIntro}
02BE: 3E 02           LD      A,$02
02C0: 32 02 80        LD      ($8002),A           ; {ram.activePlayer}
02C3: 3A 2D 80        LD      A,($802D)
02C6: A7              AND     A
02C7: CA 71 03        JP      Z,$0371             ; {code.submitHighScoresAndReset}

; setUpRoundAndHoldIntro — one-time round-start setup: make the selected player's saved progress
; the live state, configure the round from the dip switches, unmute the audio, build the board
; screen and play the start sound, then hold an intro (repaint the two HUD panels and one
; playfield strip over eight short frame-waits) before handing off to the round-loop setup, which
; never returns here. ROM 0x02ca.
setUpRoundAndHoldIntro:
02CA: CD 44 46        CALL    $4644               ; {code.loadPlayerState}
02CD: CD 55 4B        CALL    $4B55               ; {code.applyDipSwitches}
02D0: CD 4D 4C        CALL    $4C4D               ; {code.enableSound}
02D3: CD 40 4B        CALL    $4B40               ; {code.setupBoardMode90}
02D6: CD 5F 4C        CALL    $4C5F               ; {code.requestSound4}
02D9: 3E 08           LD      A,$08               ; loop count -> (0x800a)
02DB: 32 0A 80        LD      ($800A),A           ; {ram.loopCounter}
02DE: CD 3A 48        CALL    $483A               ; {code.drawMenLeftPanel} returns to loc_02e1, the loop head

; holdRoundIntroLoop — the round-start intro-hold loop: repaint the "PLAYERS" HUD label and one
; playfield strip, spaced by two short frame-waits, for a caller-armed number of passes, then hand
; off to the round-loop setup. ROM 0x02e1.
holdRoundIntroLoop:
02E1: CD E1 47        CALL    $47E1               ; {code.drawPlayerLabel}
02E4: 3E 0A           LD      A,$0A
02E6: CD FF 4B        CALL    $4BFF               ; {code.waitFrames} A=0x0a argument
02E9: CD 16 48        CALL    $4816               ; {code.paintPlayfieldStripCol1Row11}
02EC: 3E 05           LD      A,$05
02EE: CD FF 4B        CALL    $4BFF               ; {code.waitFrames} A=0x05 argument
02F1: 3A 0A 80        LD      A,($800A)           ; {ram.loopCounter} reload counter
02F4: 3D              DEC     A                   ; Z set when counter hits 0
02F5: 32 0A 80        LD      ($800A),A           ; {ram.loopCounter} store, no flags
02F8: 20 E7           JR      NZ,$02E1            ; {code.holdRoundIntroLoop} loop back while counter != 0, else fall to 0x02fa
02FA: C3 1A 03        JP      $031A               ; {code.initRoundAndEnterMainLoop} unconditional TAIL-jump; loc_031a's ret returns to OUR caller

; advanceToNextLevel — clear the current level and set up the next one. ROM 0x02fd.
advanceToNextLevel:
02FD: 3A 01 80        LD      A,($8001)           ; {ram.gameState} load the game-state byte
0300: FE 03           CP      $03                 ; carry set when state < 3
0302: D2 AC 03        JP      NC,$03AC            ; {code.resetStateAndShowSetup} state >= 3: TAIL-jump to the reset path (loc_03ac)
0305: 3A 28 80        LD      A,($8028)           ; {ram.level} else: reload the counter
0308: 3C              INC     A
0309: 32 28 80        LD      ($8028),A           ; {ram.level} bump the counter (work RAM, no bus offset)
030C: CD 32 46        CALL    $4632               ; {code.saveActivePlayerRecord}
030F: 3E A0           LD      A,$A0               ; argument for the next call
0311: CD 46 4B        CALL    $4B46               ; {code.setupBoardDisplay}
0314: CD EC 3B        CALL    $3BEC               ; {code.showBonusScreen}
0317: CD 32 46        CALL    $4632               ; {code.saveActivePlayerRecord} returns to 0x031a

; initRoundAndEnterMainLoop — final per-round (re)init: run the pre-play setup chain, derive the
; main loop's per-frame pacing delay, clear the frame counter and the first sound slot, then hand
; off into the main game loop. ROM 0x031a.
initRoundAndEnterMainLoop:
031A: CD 67 4C        CALL    $4C67               ; {code.requestSound6}
031D: CD 44 46        CALL    $4644               ; {code.loadPlayerState}
0320: CD 73 06        CALL    $0673               ; {code.paintScreen} paint the screen (tilemap+colour)
0323: 3A 01 80        LD      A,($8001)           ; {ram.gameState}
0326: 3D              DEC     A
0327: FE 02           CP      $02
0329: DC E1 47        CALL    C,$47E1             ; {code.drawPlayerLabel} only when (0x8001)-1 < 2 (carry)
032C: CD 62 13        CALL    $1362               ; {code.seedObjectStartState}
032F: CD E8 23        CALL    $23E8               ; {code.seedMountainErosion}
0332: CD CF 24        CALL    $24CF               ; {code.resetReactionState}
0335: 3A 28 80        LD      A,($8028)           ; {ram.level}
0338: 47              LD      B,A
0339: 3A 4E 80        LD      A,($804E)           ; {ram.loopDelayBase}
033C: 90              SUB     B                   ; A = (0x804e) - (0x8028)
033D: 32 11 80        LD      ($8011),A           ; {ram.mainLoopDelay} store the per-frame delay count
0340: 3E 00           LD      A,$00
0342: 32 20 80        LD      ($8020),A           ; {ram.soundRing} clear
0345: 32 10 80        LD      ($8010),A           ; {ram.playPhaseCounter} PC advances to 0x0348 (fall-through)

; mainLoop — the in-game/attract-demo main loop: drive one frame of game work, forever. ROM
; 0x0348.
mainLoop:
0348: 31 FF 83        LD      SP,$83FF            ; re-seat the stack at the top of work RAM
034B: 3A 00 B8        LD      A,($B800)           ; {hard.watchdog} READ kicks the watchdog (value discarded)
034E: CD 14 4B        CALL    $4B14               ; {code.enableNmi} per-frame service
0351: 3A 01 80        LD      A,($8001)           ; {ram.gameState} game-mode byte
0354: FE 04           CP      $04                 ; Z <- (0x8001 == 4)
0356: CC E8 03        CALL    Z,$03E8             ; {code.steerDemoPlayer} run 0x03e8 only when the mode byte is 4
0359: CD C9 13        CALL    $13C9               ; {code.dispatchObjectFrameByStateTimer} per-frame service
035C: CD 1C 24        CALL    $241C               ; {code.erodeMountain} per-frame service
035F: CD AC 06        CALL    $06AC               ; {code.glitterJewels} per-frame service
0362: CD F3 24        CALL    $24F3               ; {code.advancePlayerLaser} per-frame service
0365: 3A 11 80        LD      A,($8011)           ; {ram.mainLoopDelay} outer delay count
0368: 06 00           LD      B,$00               ; inner delay count (0 -> 256 spins)

loc_036a:
036A: 10 FE           DJNZ    $036A               ; {code.loc_036a} decrement B (no flags), spin while non-zero
036C: 3D              DEC     A                   ; sets Z when the outer count hits 0
036D: 20 FB           JR      NZ,$036A            ; {code.loc_036a} another 256-spin pass while A != 0
036F: 18 D7           JR      $0348               ; {code.mainLoop} unconditional loop-back to the top (never rets)

; submitHighScoresAndReset — game-over teardown: offer each finishing player's final score to the
; "BEST SCORES TODAY" table (entering initials if it places), then reset the game state and hand
; off to the attract/entry handler. ROM 0x0371.
submitHighScoresAndReset:
0371: 31 FF 83        LD      SP,$83FF
0374: CD 63 4C        CALL    $4C63               ; {code.requestSound5}
0377: 3A 01 80        LD      A,($8001)           ; {ram.gameState} player number
037A: 3D              DEC     A
037B: FE 02           CP      $02
037D: 30 2D           JR      NC,$03AC            ; {code.resetStateAndShowSetup}
037F: 3E E0           LD      A,$E0
0381: CD 46 4B        CALL    $4B46               ; {code.setupBoardDisplay}
0384: 3E 14           LD      A,$14
0386: CD FF 4B        CALL    $4BFF               ; {code.waitFrames}
0389: 3E 01           LD      A,$01
038B: 32 02 80        LD      ($8002),A           ; {ram.activePlayer}
038E: CD BF 4C        CALL    $4CBF               ; {code.submitPlayerHighScore}
0391: 3A 48 80        LD      A,($8048)           ; {ram.variant}
0394: B7              OR      A                   ; Z <- (0x8048 == 0)
0395: C4 F8 4D        CALL    NZ,$4DF8            ; {code.runHighScoreInitialsEntry}
0398: 3A 01 80        LD      A,($8001)           ; {ram.gameState}
039B: 32 02 80        LD      ($8002),A           ; {ram.activePlayer}
039E: FE 02           CP      $02
03A0: 20 0A           JR      NZ,$03AC            ; {code.resetStateAndShowSetup}
03A2: CD BF 4C        CALL    $4CBF               ; {code.submitPlayerHighScore}
03A5: 3A 48 80        LD      A,($8048)           ; {ram.variant}
03A8: B7              OR      A                   ; Z <- (0x8048 == 0)
03A9: C4 F8 4D        CALL    NZ,$4DF8            ; {code.runHighScoreInitialsEntry}

; resetStateAndShowSetup — reset/round-restart epilogue: begin a fresh attract cycle with no
; active player, commit the cabinet settings, show the setup screen, then hand off to the
; reset/entry handler. ROM 0x03ac.
resetStateAndShowSetup:
03AC: 3E 00           LD      A,$00
03AE: 32 01 80        LD      ($8001),A           ; {ram.gameState} clear player number
03B1: 3C              INC     A                   ; A = 1
03B2: 32 02 80        LD      ($8002),A           ; {ram.activePlayer} arm 0x8002 = 1
03B5: CD 55 4B        CALL    $4B55               ; {code.applyDipSwitches} decode DSW
03B8: CD 6F 3A        CALL    $3A6F               ; {code.showSetupScreen} setup
03BB: C3 F9 01        JP      $01F9               ; {code.rearmMachineAndBranchOnCredits} unconditional tail-jump to the 0x01f9 reset/entry handler

; enterPlayMode — switch the game into active play and seed the per-round counters. ROM 0x03be.
enterPlayMode:
03BE: 3E 04           LD      A,$04
03C0: 32 01 80        LD      ($8001),A           ; {ram.gameState} enter game-mode 4
03C3: 3E 01           LD      A,$01
03C5: 32 1B 80        LD      ($801B),A           ; {ram.demoSteerDir}
03C8: 32 02 80        LD      ($8002),A           ; {ram.activePlayer} arm 0x8002 = 1
03CB: 3E 03           LD      A,$03
03CD: 32 29 80        LD      ($8029),A
03D0: CD 47 4C        CALL    $4C47               ; {code.disableSound}
03D3: CD 55 4B        CALL    $4B55               ; {code.applyDipSwitches} decode DSW
03D6: 3E 0C           LD      A,$0C
03D8: 32 4E 80        LD      ($804E),A           ; {ram.loopDelayBase} delay base
03DB: 3E 01           LD      A,$01
03DD: 32 0B 80        LD      ($800B),A           ; 0x03e8 phase countdown
03E0: 3E 00           LD      A,$00
03E2: 32 0C 80        LD      ($800C),A           ; 0x03e8 phase index = 0
03E5: C3 1A 03        JP      $031A               ; {code.initRoundAndEnterMainLoop} unconditional tail-jump into the round/play (re)init at

; steerDemoPlayer — generate the attract demo's per-frame steering: from the demo player's
; position, emit the one-of-four move direction (written where the joystick would go) that walks
; the auto-played digger along the maze walls. ROM 0x03e8.
steerDemoPlayer:
03E8: 3A 10 80        LD      A,($8010)           ; {ram.playPhaseCounter}
03EB: A7              AND     A
03EC: CC 94 48        CALL    Z,$4894             ; {code.drawCreditsDisplay}
03EF: 3A 0B 80        LD      A,($800B)
03F2: 3D              DEC     A
03F3: 32 0B 80        LD      ($800B),A
03F6: 20 11           JR      NZ,$0409            ; {code.loc_0409}
03F8: 3E 1E           LD      A,$1E
03FA: 32 0B 80        LD      ($800B),A
03FD: 3A 7C 80        LD      A,($807C)           ; {ram.transitionTimer}
0400: A7              AND     A
0401: C0              RET     NZ
0402: 3A 7B 80        LD      A,($807B)           ; {ram.boardEndPhase}
0405: A7              AND     A
0406: CC C4 48        CALL    Z,$48C4             ; {code.cyclePanelColumnColour}

loc_0409:
0409: 3A 79 80        LD      A,($8079)           ; {ram.playerActive}
040C: A7              AND     A
040D: C8              RET     Z
040E: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
0411: C6 03           ADD     A,$03
0413: 47              LD      B,A
0414: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
0417: C6 05           ADD     A,$05
0419: 4F              LD      C,A
041A: 3A 0C 80        LD      A,($800C)
041D: FE 07           CP      $07
041F: 38 17           JR      C,$0438             ; {code.loc_0438}
0421: FE 0A           CP      $0A
0423: DA EE 04        JP      C,$04EE             ; {code.loc_04ee}
0426: FE 0E           CP      $0E
0428: DA 1D 05        JP      C,$051D             ; {code.loc_051d}
042B: FE 17           CP      $17
042D: DA 5A 05        JP      C,$055A             ; {code.loc_055a}
0430: FE 1E           CP      $1E
0432: DA DD 05        JP      C,$05DD             ; {code.loc_05dd}
0435: C3 40 06        JP      $0640               ; {code.loc_0640}

loc_0438:
0438: 3E 30           LD      A,$30
043A: B8              CP      B
043B: 20 09           JR      NZ,$0446            ; {code.loc_0446}
043D: 3E 37           LD      A,$37
043F: B9              CP      C
0440: D2 69 06        JP      NC,$0669            ; {code.loc_0669}
0443: C3 65 06        JP      $0665               ; {code.loc_0665}

loc_0446:
0446: 3E 38           LD      A,$38
0448: B9              CP      C
0449: 20 09           JR      NZ,$0454            ; {code.loc_0454}
044B: 3E 57           LD      A,$57
044D: B8              CP      B
044E: D2 65 06        JP      NC,$0665            ; {code.loc_0665}
0451: C3 69 06        JP      $0669               ; {code.loc_0669}

loc_0454:
0454: 3E 58           LD      A,$58
0456: B8              CP      B
0457: 20 09           JR      NZ,$0462            ; {code.loc_0462}
0459: 3E 3F           LD      A,$3F
045B: B9              CP      C
045C: D2 69 06        JP      NC,$0669            ; {code.loc_0669}
045F: C3 65 06        JP      $0665               ; {code.loc_0665}

loc_0462:
0462: 3E 40           LD      A,$40
0464: B9              CP      C
0465: 20 09           JR      NZ,$0470            ; {code.loc_0470}
0467: 3E 67           LD      A,$67
0469: B8              CP      B
046A: D2 65 06        JP      NC,$0665            ; {code.loc_0665}
046D: C3 69 06        JP      $0669               ; {code.loc_0669}

loc_0470:
0470: 3E 68           LD      A,$68
0472: B8              CP      B
0473: 20 09           JR      NZ,$047E            ; {code.loc_047e}
0475: 3E 53           LD      A,$53
0477: B9              CP      C
0478: D2 69 06        JP      NC,$0669            ; {code.loc_0669}
047B: C3 65 06        JP      $0665               ; {code.loc_0665}

loc_047e:
047E: 3E 54           LD      A,$54
0480: B9              CP      C
0481: 20 09           JR      NZ,$048C            ; {code.loc_048c}
0483: 3E 8F           LD      A,$8F
0485: B8              CP      B
0486: D2 65 06        JP      NC,$0665            ; {code.loc_0665}
0489: C3 69 06        JP      $0669               ; {code.loc_0669}

loc_048c:
048C: 3E 90           LD      A,$90
048E: B8              CP      B
048F: 20 09           JR      NZ,$049A            ; {code.loc_049a}
0491: 3E 7F           LD      A,$7F
0493: B9              CP      C
0494: D2 69 06        JP      NC,$0669            ; {code.loc_0669}
0497: C3 65 06        JP      $0665               ; {code.loc_0665}

loc_049a:
049A: 3E 80           LD      A,$80
049C: B9              CP      C
049D: 20 09           JR      NZ,$04A8            ; {code.loc_04a8}
049F: 3E BF           LD      A,$BF
04A1: B8              CP      B
04A2: D2 65 06        JP      NC,$0665            ; {code.loc_0665}
04A5: C3 69 06        JP      $0669               ; {code.loc_0669}

loc_04a8:
04A8: 3E C0           LD      A,$C0
04AA: B8              CP      B
04AB: 20 09           JR      NZ,$04B6            ; {code.loc_04b6}
04AD: 3E 9F           LD      A,$9F
04AF: B9              CP      C
04B0: D2 69 06        JP      NC,$0669            ; {code.loc_0669}
04B3: C3 65 06        JP      $0665               ; {code.loc_0665}

loc_04b6:
04B6: 3E A0           LD      A,$A0
04B8: B9              CP      C
04B9: 20 09           JR      NZ,$04C4            ; {code.loc_04c4}
04BB: 3E C7           LD      A,$C7
04BD: B8              CP      B
04BE: D2 65 06        JP      NC,$0665            ; {code.loc_0665}
04C1: C3 69 06        JP      $0669               ; {code.loc_0669}

loc_04c4:
04C4: 3E C8           LD      A,$C8
04C6: B8              CP      B
04C7: 20 09           JR      NZ,$04D2            ; {code.loc_04d2}
04C9: 3E BF           LD      A,$BF
04CB: B9              CP      C
04CC: D2 69 06        JP      NC,$0669            ; {code.loc_0669}
04CF: C3 65 06        JP      $0665               ; {code.loc_0665}

loc_04d2:
04D2: 3E C0           LD      A,$C0
04D4: B9              CP      C
04D5: 20 09           JR      NZ,$04E0            ; {code.loc_04e0}
04D7: 3E DF           LD      A,$DF
04D9: B8              CP      B
04DA: D2 65 06        JP      NC,$0665            ; {code.loc_0665}
04DD: C3 69 06        JP      $0669               ; {code.loc_0669}

loc_04e0:
04E0: 3E E0           LD      A,$E0
04E2: B8              CP      B
04E3: 20 09           JR      NZ,$04EE            ; {code.loc_04ee}
04E5: 3E D7           LD      A,$D7
04E7: B9              CP      C
04E8: D2 69 06        JP      NC,$0669            ; {code.loc_0669}
04EB: C3 61 06        JP      $0661               ; {code.loc_0661}

loc_04ee:
04EE: 3E 07           LD      A,$07
04F0: 32 0C 80        LD      ($800C),A
04F3: 3E D8           LD      A,$D8
04F5: B9              CP      C
04F6: 20 09           JR      NZ,$0501            ; {code.loc_0501}
04F8: 3E B0           LD      A,$B0
04FA: B8              CP      B
04FB: DA 61 06        JP      C,$0661             ; {code.loc_0661}
04FE: C3 69 06        JP      $0669               ; {code.loc_0669}

loc_0501:
0501: 3E B0           LD      A,$B0
0503: B8              CP      B
0504: 20 09           JR      NZ,$050F            ; {code.loc_050f}
0506: 3E E7           LD      A,$E7
0508: B9              CP      C
0509: D2 69 06        JP      NC,$0669            ; {code.loc_0669}
050C: C3 61 06        JP      $0661               ; {code.loc_0661}

loc_050f:
050F: 3E E8           LD      A,$E8
0511: B9              CP      C
0512: 20 09           JR      NZ,$051D            ; {code.loc_051d}
0514: 3E A8           LD      A,$A8
0516: B8              CP      B
0517: DA 61 06        JP      C,$0661             ; {code.loc_0661}
051A: C3 6D 06        JP      $066D               ; {code.loc_066d}

loc_051d:
051D: 3E 0A           LD      A,$0A
051F: 32 0C 80        LD      ($800C),A
0522: 3E A8           LD      A,$A8
0524: B8              CP      B
0525: 20 09           JR      NZ,$0530            ; {code.loc_0530}
0527: 3E D8           LD      A,$D8
0529: B9              CP      C
052A: DA 6D 06        JP      C,$066D             ; {code.loc_066d}
052D: C3 61 06        JP      $0661               ; {code.loc_0661}

loc_0530:
0530: 3E D8           LD      A,$D8
0532: B9              CP      C
0533: 20 09           JR      NZ,$053E            ; {code.loc_053e}
0535: 3E 48           LD      A,$48
0537: B8              CP      B
0538: DA 61 06        JP      C,$0661             ; {code.loc_0661}
053B: C3 69 06        JP      $0669               ; {code.loc_0669}

loc_053e:
053E: 3E 48           LD      A,$48
0540: B8              CP      B
0541: 20 09           JR      NZ,$054C            ; {code.loc_054c}
0543: 3E DF           LD      A,$DF
0545: B9              CP      C
0546: D2 69 06        JP      NC,$0669            ; {code.loc_0669}
0549: C3 61 06        JP      $0661               ; {code.loc_0661}

loc_054c:
054C: 3E E0           LD      A,$E0
054E: B9              CP      C
054F: 20 09           JR      NZ,$055A            ; {code.loc_055a}
0551: 3E 18           LD      A,$18
0553: B8              CP      B
0554: DA 61 06        JP      C,$0661             ; {code.loc_0661}
0557: C3 6D 06        JP      $066D               ; {code.loc_066d}

loc_055a:
055A: 3E 0E           LD      A,$0E
055C: 32 0C 80        LD      ($800C),A
055F: 3E 18           LD      A,$18
0561: B8              CP      B
0562: 20 09           JR      NZ,$056D            ; {code.loc_056d}
0564: 3E C0           LD      A,$C0
0566: B9              CP      C
0567: DA 6D 06        JP      C,$066D             ; {code.loc_066d}
056A: C3 65 06        JP      $0665               ; {code.loc_0665}

loc_056d:
056D: 3E C0           LD      A,$C0
056F: B9              CP      C
0570: 20 09           JR      NZ,$057B            ; {code.loc_057b}
0572: 3E 2F           LD      A,$2F
0574: B8              CP      B
0575: D2 65 06        JP      NC,$0665            ; {code.loc_0665}
0578: C3 6D 06        JP      $066D               ; {code.loc_066d}

loc_057b:
057B: 3E 30           LD      A,$30
057D: B8              CP      B
057E: 20 09           JR      NZ,$0589            ; {code.loc_0589}
0580: 3E A8           LD      A,$A8
0582: B9              CP      C
0583: DA 6D 06        JP      C,$066D             ; {code.loc_066d}
0586: C3 65 06        JP      $0665               ; {code.loc_0665}

loc_0589:
0589: 3E A8           LD      A,$A8
058B: B9              CP      C
058C: 20 09           JR      NZ,$0597            ; {code.loc_0597}
058E: 3E 47           LD      A,$47
0590: B8              CP      B
0591: D2 65 06        JP      NC,$0665            ; {code.loc_0665}
0594: C3 6D 06        JP      $066D               ; {code.loc_066d}

loc_0597:
0597: 3E 48           LD      A,$48
0599: B8              CP      B
059A: 20 09           JR      NZ,$05A5            ; {code.loc_05a5}
059C: 3E A0           LD      A,$A0
059E: B9              CP      C
059F: DA 6D 06        JP      C,$066D             ; {code.loc_066d}
05A2: C3 65 06        JP      $0665               ; {code.loc_0665}

loc_05a5:
05A5: 3E A0           LD      A,$A0
05A7: B9              CP      C
05A8: 20 09           JR      NZ,$05B3            ; {code.loc_05b3}
05AA: 3E 57           LD      A,$57
05AC: B8              CP      B
05AD: D2 65 06        JP      NC,$0665            ; {code.loc_0665}
05B0: C3 6D 06        JP      $066D               ; {code.loc_066d}

loc_05b3:
05B3: 3E 58           LD      A,$58
05B5: B8              CP      B
05B6: 20 09           JR      NZ,$05C1            ; {code.loc_05c1}
05B8: 3E 80           LD      A,$80
05BA: B9              CP      C
05BB: DA 6D 06        JP      C,$066D             ; {code.loc_066d}
05BE: C3 65 06        JP      $0665               ; {code.loc_0665}

loc_05c1:
05C1: 3E 80           LD      A,$80
05C3: B9              CP      C
05C4: 20 09           JR      NZ,$05CF            ; {code.loc_05cf}
05C6: 3E 5F           LD      A,$5F
05C8: B8              CP      B
05C9: D2 65 06        JP      NC,$0665            ; {code.loc_0665}
05CC: C3 6D 06        JP      $066D               ; {code.loc_066d}

loc_05cf:
05CF: 3E 60           LD      A,$60
05D1: B8              CP      B
05D2: 20 09           JR      NZ,$05DD            ; {code.loc_05dd}
05D4: 3E 6C           LD      A,$6C
05D6: B9              CP      C
05D7: DA 6D 06        JP      C,$066D             ; {code.loc_066d}
05DA: C3 61 06        JP      $0661               ; {code.loc_0661}

loc_05dd:
05DD: 3E 17           LD      A,$17
05DF: 32 0C 80        LD      ($800C),A
05E2: 3E 6C           LD      A,$6C
05E4: B9              CP      C
05E5: 20 09           JR      NZ,$05F0            ; {code.loc_05f0}
05E7: 3E 58           LD      A,$58
05E9: B8              CP      B
05EA: DA 61 06        JP      C,$0661             ; {code.loc_0661}
05ED: C3 6D 06        JP      $066D               ; {code.loc_066d}

loc_05f0:
05F0: 3E 58           LD      A,$58
05F2: B8              CP      B
05F3: 20 09           JR      NZ,$05FE            ; {code.loc_05fe}
05F5: 3E 5C           LD      A,$5C
05F7: B9              CP      C
05F8: DA 6D 06        JP      C,$066D             ; {code.loc_066d}
05FB: C3 61 06        JP      $0661               ; {code.loc_0661}

loc_05fe:
05FE: 3E 5C           LD      A,$5C
0600: B9              CP      C
0601: 20 09           JR      NZ,$060C            ; {code.loc_060c}
0603: 3E 50           LD      A,$50
0605: B8              CP      B
0606: DA 61 06        JP      C,$0661             ; {code.loc_0661}
0609: C3 6D 06        JP      $066D               ; {code.loc_066d}

loc_060c:
060C: 3E 50           LD      A,$50
060E: B8              CP      B
060F: 20 09           JR      NZ,$061A            ; {code.loc_061a}
0611: 3E 58           LD      A,$58
0613: B9              CP      C
0614: DA 6D 06        JP      C,$066D             ; {code.loc_066d}
0617: C3 61 06        JP      $0661               ; {code.loc_0661}

loc_061a:
061A: 3E 58           LD      A,$58
061C: B9              CP      C
061D: 20 09           JR      NZ,$0628            ; {code.loc_0628}
061F: 3E 28           LD      A,$28
0621: B8              CP      B
0622: DA 61 06        JP      C,$0661             ; {code.loc_0661}
0625: C3 6D 06        JP      $066D               ; {code.loc_066d}

loc_0628:
0628: 3E 28           LD      A,$28
062A: B8              CP      B
062B: 20 07           JR      NZ,$0634            ; {code.loc_0634}
062D: 3E 48           LD      A,$48
062F: B9              CP      C
0630: 38 3B           JR      C,$066D             ; {code.loc_066d}
0632: 18 2D           JR      $0661               ; {code.loc_0661}

loc_0634:
0634: 3E 48           LD      A,$48
0636: B9              CP      C
0637: 20 07           JR      NZ,$0640            ; {code.loc_0640}
0639: 3E 18           LD      A,$18
063B: B8              CP      B
063C: 38 23           JR      C,$0661             ; {code.loc_0661}
063E: 18 2D           JR      $066D               ; {code.loc_066d}

loc_0640:
0640: 3E 1E           LD      A,$1E
0642: 32 0C 80        LD      ($800C),A
0645: 3E 18           LD      A,$18
0647: B8              CP      B
0648: 20 07           JR      NZ,$0651            ; {code.loc_0651}
064A: 3E 38           LD      A,$38
064C: B9              CP      C
064D: 38 1E           JR      C,$066D             ; {code.loc_066d}
064F: 18 14           JR      $0665               ; {code.loc_0665}

loc_0651:
0651: 3E 38           LD      A,$38
0653: B9              CP      C
0654: 20 05           JR      NZ,$065B            ; {code.loc_065b}
0656: 3E 2F           LD      A,$2F
0658: B8              CP      B
0659: 30 0A           JR      NC,$0665            ; {code.loc_0665}

loc_065b:
065B: 18 10           JR      $066D               ; {code.loc_066d}

; ==== UNREACHED 0x065d-0x0660 (4 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
065D:                 DEFB    $3E,$00,$18,$0E

loc_0661:
0661: 3E 01           LD      A,$01
0663: 18 0A           JR      $066F               ; {code.loc_066f}

loc_0665:
0665: 3E 02           LD      A,$02
0667: 18 06           JR      $066F               ; {code.loc_066f}

loc_0669:
0669: 3E 04           LD      A,$04
066B: 18 02           JR      $066F               ; {code.loc_066f}

loc_066d:
066D: 3E 08           LD      A,$08

loc_066f:
066F: 32 1B 80        LD      ($801B),A           ; {ram.demoSteerDir}
0672: C9              RET

; paintScreen — lay down a whole screen: a selectable tile layer and its colour layer from ROM,
; the two fixed playfield edge columns and the score HUD, then arm the screen's cell-animation
; counter. ROM 0x0673.
paintScreen:
0673: 3E 01           LD      A,$01
0675: CD FF 4B        CALL    $4BFF               ; {code.waitFrames}
0678: 11 00 90        LD      DE,$9000            ; {hard.videoRam}
067B: 21 62 07        LD      HL,$0762
067E: 3A 28 80        LD      A,($8028)           ; {ram.level}
0681: CB 47           BIT     0,A
0683: 20 03           JR      NZ,$0688            ; {code.loc_0688} taken (bit 0 set) keeps HL=0x0762; else fall through
0685: 21 62 0B        LD      HL,$0B62

loc_0688:
0688: 01 00 04        LD      BC,$0400
068B: ED B0           LDIR                        ; copy 0x400 bytes to video RAM
068D: 3E 01           LD      A,$01
068F: CD FF 4B        CALL    $4BFF               ; {code.waitFrames}
0692: 11 00 88        LD      DE,$8800
0695: 21 62 0F        LD      HL,$0F62
0698: 01 00 04        LD      BC,$0400
069B: ED B0           LDIR                        ; copy 0x400 bytes to colour RAM
069D: CD F4 46        CALL    $46F4               ; {code.drawLeftEdgeColumn}
06A0: CD 2C 47        CALL    $472C               ; {code.redrawScoreHud}
06A3: CD A1 47        CALL    $47A1               ; {code.drawRightEdgeColumn}
06A6: 3E 01           LD      A,$01
06A8: 32 5C 80        LD      ($805C),A           ; {ram.glitterCountdown}
06AB: C9              RET                         ; unconditional, 10 T

; glitterJewels — cycle the colour of the on-screen diamond cells so they glitter: each frame
; advance one diamond cell's colour attribute through the palette; a diamond that has been
; collected drops out of the set and holds a fixed colour. ROM 0x06ac.
glitterJewels:
06AC: 06 03           LD      B,$03
06AE: 0E 07           LD      C,$07
06B0: 3A 5C 80        LD      A,($805C)           ; {ram.glitterCountdown}
06B3: 3D              DEC     A
06B4: 32 5C 80        LD      ($805C),A           ; {ram.glitterCountdown}
06B7: FE 04           CP      $04
06B9: 28 08           JR      Z,$06C3             ; {code.loc_06c3}
06BB: A7              AND     A
06BC: 20 12           JR      NZ,$06D0            ; {code.loc_06d0}
06BE: 3E 08           LD      A,$08
06C0: 32 5C 80        LD      ($805C),A           ; {ram.glitterCountdown}

loc_06c3:
06C3: 21 FD 89        LD      HL,$89FD            ; loc_06c3
06C6: 11 FD 91        LD      DE,$91FD            ; {hard.videoRam}
06C9: 1A              LD      A,(DE)
06CA: FE 3C           CP      $3C
06CC: 28 64           JR      Z,$0732             ; {code.loc_0732}
06CE: 70              LD      (HL),B
06CF: C9              RET

loc_06d0:
06D0: FE 07           CP      $07                 ; loc_06d0
06D2: 20 0D           JR      NZ,$06E1            ; {code.loc_06e1}
06D4: 21 73 88        LD      HL,$8873
06D7: 11 73 90        LD      DE,$9073            ; {hard.videoRam}
06DA: 1A              LD      A,(DE)
06DB: FE 3A           CP      $3A
06DD: 28 53           JR      Z,$0732             ; {code.loc_0732}
06DF: 71              LD      (HL),C
06E0: C9              RET

loc_06e1:
06E1: FE 06           CP      $06                 ; loc_06e1
06E3: 20 0D           JR      NZ,$06F2            ; {code.loc_06f2}
06E5: 21 5D 89        LD      HL,$895D
06E8: 11 5D 91        LD      DE,$915D            ; {hard.videoRam}
06EB: 1A              LD      A,(DE)
06EC: FE 3B           CP      $3B
06EE: 28 42           JR      Z,$0732             ; {code.loc_0732}
06F0: 70              LD      (HL),B
06F1: C9              RET

loc_06f2:
06F2: FE 05           CP      $05                 ; loc_06f2
06F4: 20 0D           JR      NZ,$0703            ; {code.loc_0703}
06F6: 21 D9 88        LD      HL,$88D9
06F9: 11 D9 90        LD      DE,$90D9            ; {hard.videoRam}
06FC: 1A              LD      A,(DE)
06FD: FE 3A           CP      $3A
06FF: 28 31           JR      Z,$0732             ; {code.loc_0732}
0701: 71              LD      (HL),C
0702: C9              RET

loc_0703:
0703: FE 03           CP      $03                 ; loc_0703
0705: 20 0D           JR      NZ,$0714            ; {code.loc_0714}
0707: 21 B6 89        LD      HL,$89B6
070A: 11 B6 91        LD      DE,$91B6            ; {hard.videoRam}
070D: 1A              LD      A,(DE)
070E: FE 3A           CP      $3A
0710: 28 20           JR      Z,$0732             ; {code.loc_0732}
0712: 71              LD      (HL),C
0713: C9              RET

loc_0714:
0714: FE 02           CP      $02                 ; loc_0714
0716: 20 0D           JR      NZ,$0725            ; {code.loc_0725}
0718: 21 7D 8A        LD      HL,$8A7D
071B: 11 7D 92        LD      DE,$927D            ; {hard.videoRam}
071E: 1A              LD      A,(DE)
071F: FE 3D           CP      $3D
0721: 28 0F           JR      Z,$0732             ; {code.loc_0732}
0723: 70              LD      (HL),B
0724: C9              RET

loc_0725:
0725: 21 3A 8B        LD      HL,$8B3A            ; loc_0725
0728: 11 3A 93        LD      DE,$933A            ; {hard.videoRam}
072B: 1A              LD      A,(DE)
072C: FE 3A           CP      $3A
072E: 28 02           JR      Z,$0732             ; {code.loc_0732}
0730: 71              LD      (HL),C
0731: C9              RET

loc_0732:
0732: 7E              LD      A,(HL)              ; loc_0732
0733: 3C              INC     A
0734: E6 07           AND     $07
0736: 77              LD      (HL),A
0737: C9              RET

; ==== UNREACHED 0x0738-0x1361 (3114 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
0738:                 DEFB    $3A,$54,$80,$DD,$2A,$60,$80,$DD,$77,$00,$3C,$DD,$77,$01,$3C,$DD
0748:                 DEFB    $77,$20,$3C,$DD,$77,$21,$3A,$57,$80,$DD,$2A,$5E,$80,$DD,$77,$00
0758:                 DEFB    $DD,$77,$01,$DD,$77,$20,$DD,$77,$21,$C9,$24,$24,$24,$24,$24,$24
0768:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0778:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0788:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0798:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
07A8:                 DEFB    $2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A
07B8:                 DEFB    $2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2B,$24,$24,$24,$24,$24,$24,$24
07C8:                 DEFB    $70,$70,$2A,$78,$78,$96,$9A,$70,$70,$70,$70,$70,$70,$3A,$C1,$78
07D8:                 DEFB    $78,$78,$78,$78,$78,$78,$78,$78,$2B,$00,$02,$00,$24,$24,$24,$24
07E8:                 DEFB    $2A,$70,$2A,$78,$78,$78,$78,$70,$95,$78,$78,$78,$78,$95,$78,$78
07F8:                 DEFB    $78,$95,$78,$78,$95,$78,$78,$78,$2B,$00,$0E,$00,$24,$24,$24,$24
0808:                 DEFB    $2A,$70,$2A,$78,$78,$78,$78,$70,$78,$96,$9A,$78,$78,$95,$78,$95
0818:                 DEFB    $78,$78,$78,$95,$78,$78,$78,$78,$2B,$00,$1B,$00,$24,$24,$24,$24
0828:                 DEFB    $2A,$70,$2A,$78,$78,$96,$9A,$70,$70,$70,$C1,$78,$96,$9A,$70,$70
0838:                 DEFB    $70,$70,$70,$3A,$C1,$78,$78,$78,$2B,$00,$18,$00,$24,$24,$24,$24
0848:                 DEFB    $2A,$70,$70,$78,$78,$78,$96,$9A,$78,$78,$70,$78,$78,$78,$70,$78
0858:                 DEFB    $78,$78,$78,$95,$78,$78,$78,$78,$2B,$00,$0C,$00,$24,$24,$24,$33
0868:                 DEFB    $2A,$2A,$70,$78,$78,$78,$78,$78,$78,$78,$70,$78,$78,$78,$70,$78
0878:                 DEFB    $78,$2A,$2A,$2A,$2A,$78,$2A,$2A,$2B,$15,$1C,$00,$24,$24,$33,$2A
0888:                 DEFB    $2A,$2A,$70,$78,$78,$95,$78,$78,$96,$9A,$70,$70,$70,$70,$C1,$78
0898:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$26,$2B,$0A,$24,$24,$24,$24,$2C,$2A
08A8:                 DEFB    $2A,$2A,$70,$70,$78,$78,$95,$78,$95,$78,$70,$78,$95,$78,$78,$78
08B8:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$3B,$2B,$11,$24,$24,$24,$33,$2C,$2A
08C8:                 DEFB    $2A,$2A,$2A,$70,$78,$78,$78,$78,$78,$78,$70,$78,$96,$9A,$95,$78
08D8:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$26,$2B,$24,$24,$24,$24,$2C,$2C,$2A
08E8:                 DEFB    $2A,$2A,$2A,$70,$96,$9A,$96,$9A,$78,$78,$70,$78,$78,$78,$78,$78
08F8:                 DEFB    $95,$2A,$41,$41,$26,$26,$26,$2A,$2B,$00,$1D,$24,$33,$2C,$2C,$2A
0908:                 DEFB    $2A,$2A,$2A,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70
0918:                 DEFB    $3A,$2A,$41,$41,$26,$26,$26,$26,$2B,$00,$12,$24,$2C,$2C,$2C,$2A
0928:                 DEFB    $2A,$2A,$2A,$78,$78,$78,$78,$78,$96,$9A,$70,$78,$78,$78,$78,$78
0938:                 DEFB    $95,$2A,$41,$41,$26,$26,$26,$26,$2B,$00,$19,$24,$2C,$2C,$2C,$2A
0948:                 DEFB    $2A,$2A,$2A,$96,$9A,$78,$78,$78,$78,$78,$70,$78,$78,$78,$78,$78
0958:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$3C,$2B,$00,$24,$24,$2C,$2C,$2C,$2A
0968:                 DEFB    $2A,$2A,$2A,$78,$78,$78,$78,$95,$78,$78,$70,$78,$78,$78,$78,$78
0978:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$26,$2B,$00,$0E,$24,$32,$2C,$2C,$2A
0988:                 DEFB    $2A,$2A,$2A,$78,$78,$96,$9A,$78,$78,$78,$70,$78,$78,$78,$78,$78
0998:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$2A,$2B,$15,$11,$24,$24,$2C,$2C,$2A
09A8:                 DEFB    $2A,$2A,$78,$78,$78,$78,$95,$78,$78,$78,$70,$78,$78,$95,$78,$78
09B8:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$26,$2B,$0A,$1D,$24,$24,$32,$2C,$2A
09C8:                 DEFB    $2A,$2A,$78,$96,$9A,$78,$96,$9A,$78,$78,$70,$78,$78,$78,$78,$95
09D8:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$3D,$2B,$11,$24,$24,$24,$24,$2C,$2A
09E8:                 DEFB    $2A,$78,$78,$78,$96,$9A,$78,$78,$96,$9A,$70,$70,$70,$70,$70,$C1
09F8:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$26,$2B,$24,$24,$24,$24,$24,$32,$2A
0A08:                 DEFB    $2A,$78,$78,$78,$78,$78,$96,$9A,$78,$78,$78,$78,$78,$95,$78,$70
0A18:                 DEFB    $78,$2A,$2A,$2A,$2A,$78,$2A,$2A,$2B,$00,$01,$00,$24,$24,$24,$2A
0A28:                 DEFB    $95,$78,$2A,$2A,$2A,$78,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$78,$70
0A38:                 DEFB    $78,$78,$96,$9A,$78,$78,$78,$78,$2B,$00,$0E,$00,$24,$24,$24,$2A
0A48:                 DEFB    $78,$78,$2A,$78,$2A,$27,$36,$27,$27,$27,$27,$27,$27,$2A,$78,$70
0A58:                 DEFB    $78,$78,$78,$78,$78,$95,$78,$78,$2B,$00,$1B,$00,$24,$24,$24,$2A
0A68:                 DEFB    $78,$78,$2A,$78,$2A,$27,$36,$27,$27,$27,$27,$27,$27,$2A,$78,$70
0A78:                 DEFB    $78,$78,$95,$78,$95,$78,$78,$78,$2B,$00,$18,$00,$24,$24,$24,$24
0A88:                 DEFB    $78,$78,$2A,$78,$2A,$27,$36,$27,$27,$27,$27,$27,$27,$2A,$9A,$70
0A98:                 DEFB    $70,$70,$70,$70,$3A,$C1,$78,$78,$2B,$00,$0C,$00,$24,$24,$24,$2A
0AA8:                 DEFB    $78,$78,$2A,$78,$78,$27,$36,$27,$27,$27,$27,$27,$27,$2A,$78,$78
0AB8:                 DEFB    $78,$78,$78,$78,$95,$78,$78,$78,$2B,$15,$1C,$00,$24,$24,$24,$2A
0AC8:                 DEFB    $78,$78,$78,$78,$2A,$27,$36,$27,$27,$27,$27,$27,$27,$2A,$78,$78
0AD8:                 DEFB    $78,$78,$78,$95,$78,$78,$78,$78,$2B,$0A,$24,$24,$24,$24,$24,$2A
0AE8:                 DEFB    $2A,$78,$78,$78,$2A,$27,$36,$27,$27,$27,$27,$27,$27,$2A,$78,$78
0AF8:                 DEFB    $78,$78,$78,$78,$78,$78,$78,$78,$2B,$11,$24,$24,$24,$24,$24,$2A
0B08:                 DEFB    $2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A
0B18:                 DEFB    $2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2B,$24,$24,$24,$24,$24,$24,$24
0B28:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0B38:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0B48:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0B58:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0B68:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0B78:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0B88:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0B98:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0BA8:                 DEFB    $2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A
0BB8:                 DEFB    $2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2B,$24,$24,$24,$24,$24,$24,$24
0BC8:                 DEFB    $70,$70,$2A,$78,$78,$96,$9A,$70,$70,$70,$70,$70,$70,$3A,$C1,$78
0BD8:                 DEFB    $78,$78,$78,$78,$78,$78,$78,$78,$2B,$00,$02,$00,$24,$24,$24,$24
0BE8:                 DEFB    $2A,$70,$2A,$78,$78,$78,$78,$70,$96,$9A,$95,$78,$95,$78,$78,$78
0BF8:                 DEFB    $78,$78,$78,$95,$78,$78,$78,$78,$2B,$00,$0E,$00,$24,$24,$24,$24
0C08:                 DEFB    $2A,$70,$2A,$78,$78,$78,$78,$70,$78,$78,$78,$95,$78,$78,$78,$78
0C18:                 DEFB    $95,$96,$9A,$96,$9A,$78,$78,$78,$2B,$00,$1B,$00,$24,$24,$24,$24
0C28:                 DEFB    $2A,$70,$2A,$78,$78,$96,$9A,$70,$70,$70,$70,$78,$78,$78,$70,$70
0C38:                 DEFB    $70,$70,$70,$3A,$C1,$78,$78,$78,$2B,$00,$18,$00,$24,$24,$24,$24
0C48:                 DEFB    $2A,$70,$70,$78,$78,$78,$78,$78,$78,$78,$70,$78,$78,$78,$70,$78
0C58:                 DEFB    $78,$78,$78,$95,$78,$78,$78,$78,$2B,$00,$0C,$00,$24,$24,$24,$33
0C68:                 DEFB    $2A,$2A,$70,$78,$78,$78,$78,$78,$78,$78,$70,$78,$96,$9A,$70,$78
0C78:                 DEFB    $78,$2A,$2A,$2A,$2A,$78,$2A,$2A,$2B,$15,$1C,$00,$24,$24,$33,$2A
0C88:                 DEFB    $2A,$2A,$70,$78,$78,$78,$78,$78,$96,$9A,$70,$70,$70,$70,$70,$78
0C98:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$26,$2B,$0A,$24,$24,$24,$24,$2C,$2A
0CA8:                 DEFB    $2A,$2A,$70,$70,$78,$78,$78,$96,$9A,$78,$70,$78,$95,$78,$78,$78
0CB8:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$3B,$2B,$11,$24,$24,$24,$33,$2C,$2A
0CC8:                 DEFB    $2A,$2A,$2A,$70,$78,$78,$78,$78,$78,$78,$70,$78,$78,$78,$95,$78
0CD8:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$26,$2B,$24,$24,$24,$24,$2C,$2C,$2A
0CE8:                 DEFB    $2A,$2A,$2A,$70,$78,$78,$78,$78,$78,$78,$70,$78,$78,$78,$78,$78
0CF8:                 DEFB    $95,$2A,$41,$41,$26,$26,$26,$2A,$2B,$00,$1D,$24,$33,$2C,$2C,$2A
0D08:                 DEFB    $2A,$2A,$2A,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70
0D18:                 DEFB    $3A,$2A,$41,$41,$26,$26,$26,$26,$2B,$00,$12,$26,$2C,$2C,$2C,$2A
0D28:                 DEFB    $2A,$2A,$2A,$78,$78,$78,$78,$78,$96,$9A,$70,$78,$78,$78,$78,$78
0D38:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$26,$2B,$00,$19,$24,$2C,$2C,$2C,$2A
0D48:                 DEFB    $2A,$2A,$2A,$96,$9A,$78,$78,$78,$78,$78,$70,$78,$78,$78,$78,$96
0D58:                 DEFB    $9A,$2A,$41,$41,$26,$26,$26,$3C,$2B,$00,$24,$24,$2C,$2C,$2C,$2A
0D68:                 DEFB    $2A,$2A,$2A,$78,$78,$78,$78,$95,$78,$78,$70,$78,$78,$78,$78,$78
0D78:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$26,$2B,$00,$0E,$24,$32,$2C,$2C,$2A
0D88:                 DEFB    $2A,$2A,$2A,$78,$78,$96,$9A,$78,$78,$78,$70,$78,$78,$95,$78,$78
0D98:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$2A,$2B,$15,$11,$24,$24,$2C,$2C,$2A
0DA8:                 DEFB    $2A,$2A,$78,$78,$78,$78,$95,$78,$78,$78,$70,$78,$78,$78,$78,$78
0DB8:                 DEFB    $95,$2A,$41,$41,$26,$26,$26,$26,$2B,$0A,$1D,$24,$24,$32,$2C,$2A
0DC8:                 DEFB    $2A,$2A,$78,$96,$9A,$78,$96,$9A,$78,$78,$70,$78,$78,$78,$95,$78
0DD8:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$3D,$2B,$11,$24,$24,$24,$24,$2C,$2A
0DE8:                 DEFB    $2A,$78,$78,$78,$95,$78,$78,$78,$96,$9A,$70,$70,$70,$70,$70,$70
0DF8:                 DEFB    $78,$2A,$41,$41,$26,$26,$26,$26,$2B,$24,$24,$24,$24,$24,$32,$2A
0E08:                 DEFB    $2A,$78,$78,$78,$96,$9A,$78,$96,$9A,$78,$78,$78,$78,$96,$9A,$70
0E18:                 DEFB    $78,$2A,$2A,$2A,$2A,$78,$2A,$2A,$2B,$00,$01,$00,$24,$24,$24,$2A
0E28:                 DEFB    $95,$78,$2A,$2A,$2A,$78,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$78,$70
0E38:                 DEFB    $96,$9A,$78,$78,$78,$78,$78,$78,$2B,$00,$0E,$00,$24,$24,$24,$2A
0E48:                 DEFB    $78,$78,$2A,$78,$2A,$27,$36,$27,$27,$27,$27,$27,$27,$2A,$78,$70
0E58:                 DEFB    $78,$95,$78,$96,$9A,$95,$78,$78,$2B,$00,$1B,$00,$24,$24,$24,$2A
0E68:                 DEFB    $78,$78,$2A,$78,$2A,$27,$36,$27,$27,$27,$27,$27,$27,$2A,$78,$70
0E78:                 DEFB    $78,$78,$95,$78,$95,$78,$78,$78,$2B,$00,$18,$00,$24,$24,$24,$24
0E88:                 DEFB    $78,$78,$2A,$78,$2A,$27,$36,$27,$27,$27,$27,$27,$27,$2A,$78,$70
0E98:                 DEFB    $70,$70,$70,$70,$3A,$C1,$78,$78,$2B,$00,$0C,$00,$24,$24,$24,$2A
0EA8:                 DEFB    $78,$78,$2A,$78,$78,$27,$36,$27,$27,$27,$27,$27,$27,$2A,$95,$78
0EB8:                 DEFB    $78,$78,$78,$78,$95,$78,$78,$78,$2B,$15,$1C,$00,$24,$24,$24,$2A
0EC8:                 DEFB    $78,$78,$78,$78,$2A,$27,$36,$27,$27,$27,$27,$27,$27,$2A,$78,$78
0ED8:                 DEFB    $78,$78,$78,$95,$78,$78,$78,$78,$2B,$0A,$24,$24,$24,$24,$24,$2A
0EE8:                 DEFB    $2A,$78,$78,$78,$2A,$27,$36,$27,$27,$27,$27,$27,$27,$2A,$78,$78
0EF8:                 DEFB    $78,$78,$78,$78,$78,$78,$78,$78,$2B,$11,$24,$24,$24,$24,$24,$2A
0F08:                 DEFB    $2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A
0F18:                 DEFB    $2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2B,$24,$24,$24,$24,$24,$24,$24
0F28:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0F38:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0F48:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
0F58:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$00,$00,$90,$90,$90,$90
0F68:                 DEFB    $90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90
0F78:                 DEFB    $90,$90,$90,$90,$90,$90,$90,$90,$90,$02,$00,$00,$90,$90,$90,$90
0F88:                 DEFB    $90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90
0F98:                 DEFB    $90,$90,$90,$90,$90,$90,$90,$90,$90,$02,$00,$00,$90,$90,$90,$90
0FA8:                 DEFB    $90,$90,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
0FB8:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$B2,$00,$00,$90,$90,$90,$90
0FC8:                 DEFB    $07,$07,$00,$07,$07,$0F,$0F,$87,$87,$87,$87,$87,$87,$87,$87,$87
0FD8:                 DEFB    $07,$07,$07,$07,$07,$07,$07,$07,$00,$B2,$82,$82,$90,$90,$90,$90
0FE8:                 DEFB    $90,$07,$00,$07,$07,$07,$07,$87,$0F,$0F,$07,$07,$07,$0F,$0F,$0F
0FF8:                 DEFB    $07,$07,$0F,$0F,$0F,$07,$07,$07,$00,$B2,$82,$82,$90,$90,$90,$90
1008:                 DEFB    $90,$07,$00,$07,$07,$07,$07,$87,$07,$07,$0F,$0F,$07,$07,$87,$87
1018:                 DEFB    $87,$87,$87,$87,$87,$87,$07,$07,$00,$B2,$82,$82,$90,$90,$90,$90
1028:                 DEFB    $90,$07,$00,$07,$07,$0F,$0F,$87,$87,$87,$87,$07,$07,$07,$87,$07
1038:                 DEFB    $07,$07,$07,$0F,$07,$07,$07,$07,$00,$B2,$82,$82,$90,$90,$90,$90
1048:                 DEFB    $90,$87,$87,$07,$07,$07,$07,$07,$07,$07,$87,$07,$07,$07,$87,$07
1058:                 DEFB    $07,$07,$07,$0F,$07,$07,$07,$07,$00,$B2,$82,$82,$90,$90,$90,$90
1068:                 DEFB    $90,$90,$87,$07,$07,$07,$07,$07,$07,$07,$87,$07,$07,$07,$87,$07
1078:                 DEFB    $07,$00,$00,$00,$00,$07,$00,$00,$00,$B2,$82,$82,$90,$90,$90,$90
1088:                 DEFB    $90,$90,$87,$07,$07,$07,$07,$07,$0F,$0F,$87,$87,$87,$87,$87,$0F
1098:                 DEFB    $07,$00,$03,$03,$03,$03,$03,$03,$00,$B2,$00,$00,$90,$90,$90,$90
10A8:                 DEFB    $90,$90,$87,$87,$07,$07,$07,$0F,$0F,$07,$87,$07,$0F,$07,$07,$07
10B8:                 DEFB    $07,$00,$03,$03,$03,$03,$03,$03,$00,$B2,$00,$00,$90,$90,$90,$90
10C8:                 DEFB    $90,$90,$00,$87,$07,$07,$07,$07,$07,$07,$87,$07,$07,$07,$0F,$07
10D8:                 DEFB    $07,$00,$03,$03,$03,$03,$03,$03,$00,$B2,$00,$00,$90,$90,$90,$90
10E8:                 DEFB    $90,$90,$00,$87,$07,$07,$07,$07,$0F,$0F,$87,$07,$07,$07,$07,$07
10F8:                 DEFB    $0F,$00,$03,$03,$03,$03,$03,$00,$00,$B2,$03,$00,$90,$90,$90,$90
1108:                 DEFB    $90,$90,$00,$87,$87,$87,$87,$87,$87,$87,$87,$87,$87,$87,$87,$87
1118:                 DEFB    $87,$00,$03,$03,$03,$03,$03,$03,$00,$B2,$03,$00,$90,$90,$90,$90
1128:                 DEFB    $90,$90,$00,$07,$07,$07,$07,$07,$0F,$0F,$87,$07,$07,$07,$07,$07
1138:                 DEFB    $07,$00,$03,$03,$03,$03,$03,$03,$00,$B2,$03,$00,$90,$90,$90,$90
1148:                 DEFB    $90,$90,$00,$0F,$0F,$07,$07,$07,$07,$07,$87,$07,$07,$07,$07,$0F
1158:                 DEFB    $0F,$00,$03,$03,$03,$03,$03,$03,$00,$B2,$00,$00,$90,$90,$90,$90
1168:                 DEFB    $90,$90,$00,$07,$07,$07,$07,$0F,$07,$07,$87,$07,$07,$07,$07,$07
1178:                 DEFB    $07,$00,$03,$03,$03,$03,$03,$03,$00,$B2,$03,$00,$90,$90,$90,$90
1188:                 DEFB    $90,$90,$00,$07,$07,$0F,$0F,$07,$07,$07,$87,$07,$07,$0F,$07,$07
1198:                 DEFB    $07,$00,$03,$03,$03,$03,$03,$00,$00,$B2,$03,$00,$90,$90,$90,$90
11A8:                 DEFB    $90,$90,$07,$07,$07,$07,$0F,$07,$07,$07,$87,$07,$07,$07,$07,$07
11B8:                 DEFB    $07,$00,$03,$03,$03,$03,$03,$03,$00,$B2,$03,$00,$90,$90,$90,$90
11C8:                 DEFB    $90,$90,$07,$0F,$0F,$07,$0F,$0F,$07,$07,$87,$07,$07,$07,$07,$0F
11D8:                 DEFB    $07,$00,$03,$03,$03,$03,$03,$03,$00,$B2,$00,$00,$90,$90,$90,$90
11E8:                 DEFB    $00,$07,$07,$07,$0F,$0F,$07,$07,$0F,$0F,$87,$87,$87,$87,$87,$87
11F8:                 DEFB    $07,$00,$03,$03,$03,$03,$03,$03,$00,$B2,$00,$00,$90,$90,$90,$90
1208:                 DEFB    $00,$07,$07,$07,$07,$07,$0F,$0F,$07,$07,$07,$07,$07,$0F,$07,$87
1218:                 DEFB    $07,$00,$00,$00,$00,$07,$00,$00,$00,$B2,$82,$82,$90,$90,$90,$90
1228:                 DEFB    $0F,$07,$00,$00,$00,$07,$00,$00,$00,$00,$00,$00,$00,$00,$07,$87
1238:                 DEFB    $07,$07,$07,$0F,$07,$07,$07,$07,$00,$B2,$82,$82,$90,$90,$90,$90
1248:                 DEFB    $07,$07,$00,$07,$00,$88,$88,$88,$88,$A0,$A0,$20,$20,$F0,$07,$87
1258:                 DEFB    $07,$07,$07,$07,$07,$0F,$07,$07,$00,$B2,$82,$82,$90,$90,$90,$90
1268:                 DEFB    $07,$07,$00,$07,$00,$88,$88,$88,$88,$A0,$A0,$20,$20,$F0,$07,$87
1278:                 DEFB    $07,$07,$0F,$07,$0F,$07,$07,$07,$00,$B2,$82,$82,$90,$90,$90,$87
1288:                 DEFB    $07,$07,$00,$07,$00,$88,$88,$88,$88,$A0,$A0,$20,$20,$F0,$07,$87
1298:                 DEFB    $87,$87,$87,$87,$87,$87,$07,$07,$00,$B2,$82,$82,$90,$90,$90,$90
12A8:                 DEFB    $07,$07,$00,$07,$07,$88,$88,$88,$88,$A0,$A0,$20,$20,$F0,$0F,$07
12B8:                 DEFB    $07,$07,$07,$07,$0F,$07,$07,$07,$00,$B2,$82,$82,$90,$90,$90,$90
12C8:                 DEFB    $07,$07,$07,$07,$00,$88,$88,$88,$88,$A0,$A0,$20,$20,$F0,$07,$07
12D8:                 DEFB    $07,$07,$07,$0F,$07,$07,$07,$07,$00,$B2,$00,$00,$90,$90,$90,$90
12E8:                 DEFB    $00,$07,$07,$07,$00,$88,$88,$88,$88,$A0,$A0,$20,$20,$F0,$07,$07
12F8:                 DEFB    $07,$07,$07,$07,$07,$07,$07,$07,$00,$B2,$00,$00,$90,$90,$90,$90
1308:                 DEFB    $90,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
1318:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$B2,$00,$00,$90,$90,$90,$90
1328:                 DEFB    $90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90
1338:                 DEFB    $90,$90,$90,$90,$90,$90,$90,$90,$90,$02,$00,$00,$90,$90,$90,$90
1348:                 DEFB    $90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90,$90
1358:                 DEFB    $90,$90,$90,$90,$90,$90,$90,$90,$90,$02

; seedObjectStartState — drop the tracked-object / level state block back to its fixed start-of-
; play defaults. ROM 0x1362.
seedObjectStartState:
1362: 3E 00           LD      A,$00
1364: 32 68 80        LD      ($8068),A           ; {ram.playerY}
1367: 3E 23           LD      A,$23
1369: 32 6B 80        LD      ($806B),A           ; {ram.playerX}
136C: 3E 19           LD      A,$19
136E: 32 73 80        LD      ($8073),A           ; {ram.playerTileRow}
1371: 3E 05           LD      A,$05
1373: 32 71 80        LD      ($8071),A           ; {ram.playerTileCol}
1376: 3E 02           LD      A,$02
1378: 32 6A 80        LD      ($806A),A           ; {ram.playerSpriteAttr}
137B: 3E 01           LD      A,$01
137D: 32 6C 80        LD      ($806C),A           ; {ram.playerStepY}
1380: 32 6D 80        LD      ($806D),A           ; {ram.playerStepX}
1383: 3E 32           LD      A,$32
1385: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
1388: 3E 01           LD      A,$01
138A: 32 70 80        LD      ($8070),A
138D: 3E 00           LD      A,$00
138F: 32 1A 80        LD      ($801A),A           ; {ram.playerAnimPhase}
1392: 32 75 80        LD      ($8075),A
1395: 32 A2 80        LD      ($80A2),A           ; {ram.reactionState}
1398: 32 A4 80        LD      ($80A4),A           ; {ram.reactionTimer}
139B: 32 A7 80        LD      ($80A7),A           ; {ram.expectedTile}
139E: 32 A8 80        LD      ($80A8),A           ; {ram.nextTile}
13A1: 32 76 80        LD      ($8076),A           ; {ram.prizeGate}
13A4: 32 77 80        LD      ($8077),A           ; {ram.pitCrossActive}
13A7: 32 78 80        LD      ($8078),A           ; {ram.treasureCollected}
13AA: 32 7A 80        LD      ($807A),A
13AD: 32 79 80        LD      ($8079),A           ; {ram.playerActive}
13B0: 32 7E 80        LD      ($807E),A           ; {ram.carveSeamLeft}
13B3: 32 7F 80        LD      ($807F),A           ; {ram.carveSeamRight}
13B6: 32 80 80        LD      ($8080),A           ; {ram.moveBlockFlag}
13B9: 32 7C 80        LD      ($807C),A           ; {ram.transitionTimer}
13BC: 32 7B 80        LD      ($807B),A           ; {ram.boardEndPhase}
13BF: 32 7D 80        LD      ($807D),A           ; {ram.postTransitionMode}
13C2: 32 81 80        LD      ($8081),A           ; {ram.crystalCount}
13C5: 32 82 80        LD      ($8082),A           ; {ram.diamondCount}
13C8: C9              RET

; dispatchObjectFrameByStateTimer — per-frame head of the object/state dispatcher, gated by the
; state-lockout timer. ROM 0x13c9.
dispatchObjectFrameByStateTimer:
13C9: 3A 7C 80        LD      A,($807C)           ; {ram.transitionTimer}
13CC: A7              AND     A
13CD: 28 0F           JR      Z,$13DE             ; {code.advanceTrackedObject}
13CF: 3D              DEC     A
13D0: 32 7C 80        LD      ($807C),A           ; {ram.transitionTimer}
13D3: C0              RET     NZ
13D4: 3A 7D 80        LD      A,($807D)           ; {ram.postTransitionMode}
13D7: A7              AND     A
13D8: CA 78 02        JP      Z,$0278             ; {code.dockManAndDispatchRoundBoundary}
13DB: C3 FD 02        JP      $02FD               ; {code.advanceToNextLevel}

; advanceTrackedObject — route the tracked object to its per-frame handler by its state gates. ROM
; 0x13de.
advanceTrackedObject:
13DE: 3A 7A 80        LD      A,($807A)
13E1: B7              OR      A
13E2: C2 5B 1B        JP      NZ,$1B5B            ; {code.stageObjectSpriteRecord}
13E5: 3A 79 80        LD      A,($8079)           ; {ram.playerActive}
13E8: A7              AND     A
13E9: C8              RET     Z
13EA: 3A 7B 80        LD      A,($807B)           ; {ram.boardEndPhase}
13ED: A7              AND     A
13EE: C0              RET     NZ
13EF: 3A 6C 80        LD      A,($806C)           ; {ram.playerStepY}
13F2: 5F              LD      E,A
13F3: 3A 6D 80        LD      A,($806D)           ; {ram.playerStepX}
13F6: 57              LD      D,A
13F7: 3A C1 80        LD      A,($80C1)           ; {ram.digCollisionState}
13FA: 3D              DEC     A
13FB: CA 6A 18        JP      Z,$186A             ; {code.stampFixedFrameAndResolveTile}
13FE: 3C              INC     A
13FF: C2 5B 1B        JP      NZ,$1B5B            ; {code.stageObjectSpriteRecord}
1402: 3A 75 80        LD      A,($8075)
1405: A7              AND     A
1406: FA 59 16        JP      M,$1659             ; {code.advanceObjectWalkFrame}
1409: C2 4A 18        JP      NZ,$184A            ; {code.walkActor}
140C: 3A E7 80        LD      A,($80E7)           ; {ram.goalTileLatch}
140F: A7              AND     A
1410: 28 0E           JR      Z,$1420             ; {code.stepObjectFromControl}
1412: 3A 77 80        LD      A,($8077)           ; {ram.pitCrossActive}
1415: A7              AND     A
1416: C2 D0 19        JP      NZ,$19D0            ; {code.advanceActorWalk}
1419: 3A E6 80        LD      A,($80E6)           ; {ram.pitFloorRevealCursor}
141C: A7              AND     A
141D: CA 6F 18        JP      Z,$186F             ; {code.resolveObjectTile}

; stepObjectFromControl — advance the tracked object one frame from its control input. ROM 0x1420.
stepObjectFromControl:
1420: 3A A2 80        LD      A,($80A2)           ; {ram.reactionState}
1423: A7              AND     A
1424: C2 5B 1B        JP      NZ,$1B5B            ; {code.stageObjectSpriteRecord}
1427: 3A 01 80        LD      A,($8001)           ; {ram.gameState}
142A: FE 03           CP      $03
142C: 3A 1B 80        LD      A,($801B)           ; {ram.demoSteerDir}
142F: 30 03           JR      NC,$1434            ; {code.advanceObjectFrame}
1431: 3A 18 80        LD      A,($8018)           ; {ram.in0Debounced}

; advanceObjectFrame — pick the tracked object's per-frame update from its mode and move command.
; ROM 0x1434.
advanceObjectFrame:
1434: 6F              LD      L,A
1435: 3A 75 80        LD      A,($8075)
1438: A7              AND     A
1439: 28 11           JR      Z,$144C             ; {code.routeIdleObjectByMoveCommand}
143B: CB 45           BIT     0,L
143D: C2 59 16        JP      NZ,$1659            ; {code.advanceObjectWalkFrame}
1440: CB 4D           BIT     1,L
1442: C2 4A 18        JP      NZ,$184A            ; {code.walkActor}
1445: A7              AND     A
1446: FA 59 16        JP      M,$1659             ; {code.advanceObjectWalkFrame}
1449: C3 4A 18        JP      $184A               ; {code.walkActor}

; routeIdleObjectByMoveCommand — route an at-rest object to its per-frame handler on its move-
; command bits. ROM 0x144c.
routeIdleObjectByMoveCommand:
144C: CB 45           BIT     0,L
144E: C2 93 14        JP      NZ,$1493            ; {code.stepObjectRowFlipped}
1451: CB 4D           BIT     1,L
1453: C2 7F 16        JP      NZ,$167F            ; {code.stepObjectRowUnflipped}
1456: 7D              LD      A,L
1457: E6 0C           AND     $0C
1459: 20 0D           JR      NZ,$1468            ; {code.windUpObjectMove}
145B: 32 1A 80        LD      ($801A),A           ; {ram.playerAnimPhase}
145E: 3A E7 80        LD      A,($80E7)           ; {ram.goalTileLatch}
1461: A7              AND     A
1462: C2 6F 18        JP      NZ,$186F            ; {code.resolveObjectTile}
1465: C3 5B 1B        JP      $1B5B               ; {code.stageObjectSpriteRecord}

; windUpObjectMove — settle the object's animation phase toward a move command, then run its
; handler. ROM 0x1468.
windUpObjectMove:
1468: 3A 1A 80        LD      A,($801A)           ; {ram.playerAnimPhase}
146B: BD              CP      L
146C: 28 1D           JR      Z,$148B             ; {code.loc_148b}
146E: A7              AND     A
146F: 20 08           JR      NZ,$1479            ; {code.loc_1479}
1471: 7D              LD      A,L
1472: F6 C0           OR      $C0
1474: 32 1A 80        LD      ($801A),A           ; {ram.playerAnimPhase}
1477: 18 12           JR      $148B               ; {code.loc_148b}

loc_1479:
1479: D6 20           SUB     $20
147B: 32 1A 80        LD      ($801A),A           ; {ram.playerAnimPhase}
147E: E6 0C           AND     $0C
1480: BD              CP      L
1481: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1484: 7D              LD      A,L
1485: 32 1A 80        LD      ($801A),A           ; {ram.playerAnimPhase}
1488: C3 5B 1B        JP      $1B5B               ; {code.stageObjectSpriteRecord}

loc_148b:
148B: CB 55           BIT     2,L
148D: C2 6A 18        JP      NZ,$186A            ; {code.stampFixedFrameAndResolveTile}
1490: C3 02 1A        JP      $1A02               ; {code.stepObjectAndResolveTile}

; stepObjectRowFlipped — step the tracked object the opposite way along its move axis: derive its
; tile row and route on it, firing the dig one-shot at the boundary row. ROM 0x1493.
stepObjectRowFlipped:
1493: 3A 7E 80        LD      A,($807E)           ; {ram.carveSeamLeft}
1496: A7              AND     A
1497: C2 5B 1B        JP      NZ,$1B5B            ; {code.stageObjectSpriteRecord}
149A: 3E B2           LD      A,$B2
149C: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
149F: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
14A2: 93              SUB     E
14A3: C6 03           ADD     A,$03
14A5: CB 3F           SRL     A
14A7: CB 3F           SRL     A
14A9: CB 3F           SRL     A
14AB: ED 44           NEG
14AD: C6 1F           ADD     A,$1F
14AF: 32 73 80        LD      ($8073),A           ; {ram.playerTileRow}
14B2: 67              LD      H,A
14B3: FE 16           CP      $16
14B5: 20 16           JR      NZ,$14CD            ; {code.locateObjectCellCheckGoal}
14B7: 3A 76 80        LD      A,($8076)           ; {ram.prizeGate}
14BA: B7              OR      A
14BB: 28 10           JR      Z,$14CD             ; {code.locateObjectCellCheckGoal}
14BD: 3E 00           LD      A,$00
14BF: 32 76 80        LD      ($8076),A           ; {ram.prizeGate}
14C2: 32 BD 80        LD      ($80BD),A           ; {ram.hazardActiveCount}
14C5: 3E 09           LD      A,$09
14C7: 32 AA 80        LD      ($80AA),A           ; {ram.hazardState}
14CA: C3 D3 2B        JP      $2BD3               ; {code.stageDigObjectSpriteRecord}

; locateObjectCellCheckGoal — locate the object's tilemap cell, latch a goal crossing if the goal
; is just ahead, else resolve the tile under it. ROM 0x14cd.
locateObjectCellCheckGoal:
14CD: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
14D0: C6 05           ADD     A,$05
14D2: 57              LD      D,A
14D3: CB 3F           SRL     A
14D5: CB 3F           SRL     A
14D7: CB 3F           SRL     A
14D9: 32 71 80        LD      ($8071),A           ; {ram.playerTileCol}
14DC: 4F              LD      C,A
14DD: 3E 00           LD      A,$00
14DF: 47              LD      B,A
14E0: CB 3C           SRL     H
14E2: 1F              RRA
14E3: CB 3C           SRL     H
14E5: 1F              RRA
14E6: CB 3C           SRL     H
14E8: 1F              RRA
14E9: 6F              LD      L,A
14EA: 09              ADD     HL,BC
14EB: 01 00 90        LD      BC,$9000            ; {hard.videoRam}
14EE: 09              ADD     HL,BC
14EF: 22 6E 80        LD      ($806E),HL          ; {ram.playerCellPtr}
14F2: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr}
14F6: 3E 00           LD      A,$00
14F8: 32 A8 80        LD      ($80A8),A           ; {ram.nextTile}
14FB: DD 7E 01        LD      A,(IX+$01)
14FE: FE 27           CP      $27
1500: 20 13           JR      NZ,$1515            ; {code.collectAlignedLootElseResolveTile}
1502: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
1505: C6 03           ADD     A,$03
1507: E6 07           AND     $07
1509: 20 0A           JR      NZ,$1515            ; {code.collectAlignedLootElseResolveTile}
150B: 3C              INC     A
150C: 32 E7 80        LD      ($80E7),A           ; {ram.goalTileLatch}
150F: 32 77 80        LD      ($8077),A           ; {ram.pitCrossActive}
1512: C3 59 16        JP      $1659               ; {code.advanceObjectWalkFrame}

; collectAlignedLootElseResolveTile — resolve the tile the object is sitting on: collect a loot
; tile it has landed squarely on (score + remove it), otherwise resolve how it meets the terrain.
; ROM 0x1515.
collectAlignedLootElseResolveTile:
1515: DD 7E 00        LD      A,(IX+$00)
1518: 32 A5 80        LD      ($80A5),A           ; {ram.curTile}
151B: 32 A7 80        LD      ($80A7),A           ; {ram.expectedTile}
151E: 47              LD      B,A
151F: 7A              LD      A,D
1520: E6 07           AND     $07
1522: 20 44           JR      NZ,$1568            ; {code.resolveObjectTerrainStep}
1524: 78              LD      A,B
1525: FE 3A           CP      $3A
1527: 20 0C           JR      NZ,$1535            ; {code.loc_1535}
1529: CD 7B 46        CALL    $467B               ; {code.awardTenPoints}
152C: 3A 81 80        LD      A,($8081)           ; {ram.crystalCount}
152F: 3C              INC     A
1530: 32 81 80        LD      ($8081),A           ; {ram.crystalCount}
1533: 18 27           JR      $155C               ; {code.loc_155c}

loc_1535:
1535: 78              LD      A,B
1536: FE 3B           CP      $3B
1538: 28 08           JR      Z,$1542             ; {code.loc_1542}
153A: FE 3C           CP      $3C
153C: 28 04           JR      Z,$1542             ; {code.loc_1542}
153E: FE 3D           CP      $3D
1540: 20 26           JR      NZ,$1568            ; {code.resolveObjectTerrainStep}

loc_1542:
1542: 3A 78 80        LD      A,($8078)           ; {ram.treasureCollected}
1545: B7              OR      A
1546: 20 0A           JR      NZ,$1552            ; {code.loc_1552}
1548: 3A BD 80        LD      A,($80BD)           ; {ram.hazardActiveCount}
154B: B7              OR      A
154C: 20 1A           JR      NZ,$1568            ; {code.resolveObjectTerrainStep}
154E: 3C              INC     A
154F: 32 78 80        LD      ($8078),A           ; {ram.treasureCollected}

loc_1552:
1552: CD 83 46        CALL    $4683               ; {code.awardTwentyPoints}
1555: 3A 82 80        LD      A,($8082)           ; {ram.diamondCount}
1558: 3C              INC     A
1559: 32 82 80        LD      ($8082),A           ; {ram.diamondCount}

loc_155c:
155C: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr}
1560: 3E 70           LD      A,$70
1562: DD 77 00        LD      (IX+$00),A
1565: C3 59 16        JP      $1659               ; {code.advanceObjectWalkFrame}

; resolveObjectTerrainStep — resolve a moving object's step against the terrain directly under it
; (and, off the grid, the tile one step ahead): hold against a solid, push a pushable block, or
; walk on. ROM 0x1568.
resolveObjectTerrainStep:
1568: 78              LD      A,B
1569: FE 26           CP      $26
156B: 20 03           JR      NZ,$1570            ; {code.loc_1570}
156D: 32 76 80        LD      ($8076),A           ; {ram.prizeGate}

loc_1570:
1570: 78              LD      A,B
1571: FE 27           CP      $27
1573: 20 03           JR      NZ,$1578            ; {code.loc_1578}
1575: 32 E7 80        LD      ($80E7),A           ; {ram.goalTileLatch}

loc_1578:
1578: FE 2A           CP      $2A
157A: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
157D: FE 41           CP      $41
157F: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1582: FE C1           CP      $C1
1584: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1587: FE 95           CP      $95
1589: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
158C: FE C4           CP      $C4
158E: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1591: FE C5           CP      $C5
1593: 28 0D           JR      Z,$15A2             ; {code.loc_15a2}
1595: FE 96           CP      $96
1597: 38 0E           JR      C,$15A7             ; {code.loc_15a7}
1599: FE 9A           CP      $9A
159B: DA 5B 1B        JP      C,$1B5B             ; {code.stageObjectSpriteRecord}
159E: FE 9E           CP      $9E
15A0: 30 43           JR      NC,$15E5            ; {code.loc_15e5}

loc_15a2:
15A2: CB 52           BIT     2,D
15A4: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}

loc_15a7:
15A7: FE 71           CP      $71
15A9: 38 3A           JR      C,$15E5             ; {code.loc_15e5}
15AB: FE 9E           CP      $9E
15AD: 30 36           JR      NC,$15E5            ; {code.loc_15e5}
15AF: 5F              LD      E,A
15B0: D6 71           SUB     $71
15B2: 06 00           LD      B,$00
15B4: CB 27           SLA     A
15B6: CB 27           SLA     A
15B8: CB 27           SLA     A
15BA: CB 10           RL      B
15BC: 4F              LD      C,A
15BD: 7A              LD      A,D
15BE: E6 07           AND     $07
15C0: B1              OR      C
15C1: 4F              LD      C,A
15C2: 21 78 1B        LD      HL,$1B78
15C5: 09              ADD     HL,BC
15C6: 7E              LD      A,(HL)
15C7: 32 A7 80        LD      ($80A7),A           ; {ram.expectedTile}
15CA: BB              CP      E
15CB: 28 18           JR      Z,$15E5             ; {code.loc_15e5}
15CD: 7A              LD      A,D
15CE: E6 07           AND     $07
15D0: 20 18           JR      NZ,$15EA            ; {code.loc_15ea}
15D2: 3A A3 80        LD      A,($80A3)
15D5: 32 A4 80        LD      ($80A4),A           ; {ram.reactionTimer}
15D8: 3E 01           LD      A,$01
15DA: 32 A2 80        LD      ($80A2),A           ; {ram.reactionState}
15DD: 3E B5           LD      A,$B5
15DF: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
15E2: C3 5B 1B        JP      $1B5B               ; {code.stageObjectSpriteRecord}

loc_15e5:
15E5: 7A              LD      A,D
15E6: E6 07           AND     $07
15E8: 28 6F           JR      Z,$1659             ; {code.advanceObjectWalkFrame}

loc_15ea:
15EA: DD 7E 01        LD      A,(IX+$01)
15ED: 32 A6 80        LD      ($80A6),A
15F0: FE 2A           CP      $2A
15F2: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
15F5: FE 41           CP      $41
15F7: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
15FA: FE C1           CP      $C1
15FC: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
15FF: FE C4           CP      $C4
1601: 28 0D           JR      Z,$1610             ; {code.loc_1610}
1603: FE 95           CP      $95
1605: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1608: FE 96           CP      $96
160A: 38 0A           JR      C,$1616             ; {code.loc_1616}
160C: FE 9A           CP      $9A
160E: 30 3F           JR      NC,$164F            ; {code.loc_164f}

loc_1610:
1610: 15              DEC     D
1611: CB 52           BIT     2,D
1613: C2 5B 1B        JP      NZ,$1B5B            ; {code.stageObjectSpriteRecord}

loc_1616:
1616: FE 71           CP      $71
1618: 38 35           JR      C,$164F             ; {code.loc_164f}
161A: FE 9E           CP      $9E
161C: 30 31           JR      NC,$164F            ; {code.loc_164f}
161E: 5F              LD      E,A
161F: D6 71           SUB     $71
1621: 06 00           LD      B,$00
1623: CB 27           SLA     A
1625: CB 27           SLA     A
1627: CB 27           SLA     A
1629: CB 10           RL      B
162B: 4F              LD      C,A
162C: 7A              LD      A,D
162D: E6 07           AND     $07
162F: B1              OR      C
1630: 4F              LD      C,A
1631: 21 E0 1C        LD      HL,$1CE0
1634: 09              ADD     HL,BC
1635: 7E              LD      A,(HL)
1636: 32 A8 80        LD      ($80A8),A           ; {ram.nextTile}
1639: BB              CP      E
163A: 28 13           JR      Z,$164F             ; {code.loc_164f}

loc_163c:
163C: 3A A3 80        LD      A,($80A3)
163F: 32 A4 80        LD      ($80A4),A           ; {ram.reactionTimer}
1642: 3E 01           LD      A,$01
1644: 32 A2 80        LD      ($80A2),A           ; {ram.reactionState}
1647: 3E B5           LD      A,$B5
1649: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
164C: C3 5B 1B        JP      $1B5B               ; {code.stageObjectSpriteRecord}

loc_164f:
164F: 3A A5 80        LD      A,($80A5)           ; {ram.curTile}
1652: 5F              LD      E,A
1653: 3A A7 80        LD      A,($80A7)           ; {ram.expectedTile}
1656: BB              CP      E
1657: 20 E3           JR      NZ,$163C            ; {code.loc_163c}

; advanceObjectWalkFrame — step a moving object's walk animation, then build its record. ROM
; 0x1659.
advanceObjectWalkFrame:
1659: 3A 6C 80        LD      A,($806C)           ; {ram.playerStepY}
165C: 5F              LD      E,A
165D: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
1660: 93              SUB     E
1661: 32 68 80        LD      ($8068),A           ; {ram.playerY}
1664: C6 03           ADD     A,$03
1666: E6 07           AND     $07
1668: 5F              LD      E,A
1669: 28 02           JR      Z,$166D             ; {code.loc_166d}
166B: 3E FF           LD      A,$FF

loc_166d:
166D: 32 75 80        LD      ($8075),A
1670: 7B              LD      A,E
1671: E6 02           AND     $02
1673: 3E B2           LD      A,$B2
1675: 28 02           JR      Z,$1679             ; {code.loc_1679}
1677: 3E B3           LD      A,$B3

loc_1679:
1679: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
167C: C3 5B 1B        JP      $1B5B               ; {code.stageObjectSpriteRecord}

; stepObjectRowUnflipped — advance the tracked object one step along the row axis: derive its tile
; row and route on it, firing the dig one-shot at the trigger row. ROM 0x167f.
stepObjectRowUnflipped:
167F: 3A 7F 80        LD      A,($807F)           ; {ram.carveSeamRight}
1682: A7              AND     A
1683: C2 5B 1B        JP      NZ,$1B5B            ; {code.stageObjectSpriteRecord}
1686: 3E 32           LD      A,$32
1688: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
168B: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
168E: 83              ADD     A,E
168F: C6 0B           ADD     A,$0B
1691: CB 3F           SRL     A
1693: CB 3F           SRL     A
1695: CB 3F           SRL     A
1697: ED 44           NEG
1699: C6 1F           ADD     A,$1F
169B: 32 73 80        LD      ($8073),A           ; {ram.playerTileRow}
169E: 67              LD      H,A
169F: FE 07           CP      $07
16A1: 20 16           JR      NZ,$16B9            ; {code.locateActorCellCheckGoal}
16A3: 3A 76 80        LD      A,($8076)           ; {ram.prizeGate}
16A6: B7              OR      A
16A7: 28 10           JR      Z,$16B9             ; {code.locateActorCellCheckGoal}
16A9: 3E 00           LD      A,$00
16AB: 32 76 80        LD      ($8076),A           ; {ram.prizeGate}
16AE: 32 BD 80        LD      ($80BD),A           ; {ram.hazardActiveCount}
16B1: 3E 09           LD      A,$09
16B3: 32 AA 80        LD      ($80AA),A           ; {ram.hazardState}
16B6: C3 D3 2B        JP      $2BD3               ; {code.stageDigObjectSpriteRecord}

; locateActorCellCheckGoal — route a moving actor's horizontal step: if it has reached the goal
; terminator tile, latch the goal crossing and walk it on; otherwise resolve the terrain step it
; is entering. ROM 0x16b9.
locateActorCellCheckGoal:
16B9: 3A E7 80        LD      A,($80E7)           ; {ram.goalTileLatch}
16BC: A7              AND     A
16BD: 28 05           JR      Z,$16C4             ; {code.loc_16c4}
16BF: 7D              LD      A,L
16C0: FE 17           CP      $17
16C2: 28 37           JR      Z,$16FB             ; {code.loc_16fb}

loc_16c4:
16C4: 3A 6B 80        LD      A,($806B)           ; {ram.playerX} loc_16c4
16C7: C6 05           ADD     A,$05
16C9: 57              LD      D,A
16CA: CB 3F           SRL     A
16CC: CB 3F           SRL     A
16CE: CB 3F           SRL     A
16D0: 32 71 80        LD      ($8071),A           ; {ram.playerTileCol}
16D3: 4F              LD      C,A
16D4: 3E 00           LD      A,$00
16D6: 47              LD      B,A
16D7: CB 3C           SRL     H
16D9: 1F              RRA
16DA: CB 3C           SRL     H
16DC: 1F              RRA
16DD: CB 3C           SRL     H
16DF: 1F              RRA
16E0: 6F              LD      L,A
16E1: 09              ADD     HL,BC
16E2: 01 00 90        LD      BC,$9000            ; {hard.videoRam}
16E5: 09              ADD     HL,BC
16E6: 22 6E 80        LD      ($806E),HL          ; {ram.playerCellPtr}
16E9: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr}
16ED: DD 7E 01        LD      A,(IX+$01)
16F0: FE 27           CP      $27
16F2: 28 07           JR      Z,$16FB             ; {code.loc_16fb}
16F4: DD 7E 21        LD      A,(IX+$21)
16F7: FE 27           CP      $27
16F9: 20 09           JR      NZ,$1704            ; {code.resolveActorTerrainStep}

loc_16fb:
16FB: 32 E7 80        LD      ($80E7),A           ; {ram.goalTileLatch} loc_16fb
16FE: 32 77 80        LD      ($8077),A           ; {ram.pitCrossActive}
1701: C3 D0 19        JP      $19D0               ; {code.advanceActorWalk}

; resolveActorTerrainStep — resolve a moving actor's horizontal step against the terrain it is
; entering: collect a loot tile in its path, hold against a wall, bump-react on a blocked
; diagonal, or let it walk on. ROM 0x1704.
resolveActorTerrainStep:
1704: 3E 00           LD      A,$00
1706: 32 A8 80        LD      ($80A8),A           ; {ram.nextTile} pre-clear next-tile slot
1709: DD 7E 00        LD      A,(IX+$00)          ; tile under actor
170C: 32 A5 80        LD      ($80A5),A           ; {ram.curTile}
170F: 32 A7 80        LD      ($80A7),A           ; {ram.expectedTile}
1712: 47              LD      B,A                 ; keep tile in B
1713: 7A              LD      A,D                 ; direction/flags
1714: E6 07           AND     $07                 ; on-grid step? (sets Z read next)
1716: 20 43           JR      NZ,$175B            ; {code.loc_175b} on grid)
1718: 78              LD      A,B
1719: FE 3A           CP      $3A
171B: 20 0C           JR      NZ,$1729            ; {code.loc_1729} tile == 0x3a)
171D: CD 7B 46        CALL    $467B               ; {code.awardTenPoints} +10 score sfx
1720: 3A 81 80        LD      A,($8081)           ; {ram.crystalCount}
1723: 3C              INC     A
1724: 32 81 80        LD      ($8081),A           ; {ram.crystalCount} bump 0x3a counter
1727: 18 26           JR      $174F               ; {code.loc_174f}

loc_1729:
1729: FE 3B           CP      $3B
172B: 28 08           JR      Z,$1735             ; {code.loc_1735}
172D: FE 3C           CP      $3C
172F: 28 04           JR      Z,$1735             ; {code.loc_1735}
1731: FE 3D           CP      $3D
1733: 20 26           JR      NZ,$175B            ; {code.loc_175b} tile == 0x3d, fall into loc_1735)

loc_1735:
1735: 3A 78 80        LD      A,($8078)           ; {ram.treasureCollected}
1738: B7              OR      A                   ; 0x8078 already set?
1739: 20 0A           JR      NZ,$1745            ; {code.loc_1745}
173B: 3A BD 80        LD      A,($80BD)           ; {ram.hazardActiveCount}
173E: B7              OR      A                   ; gate byte
173F: 20 1A           JR      NZ,$175B            ; {code.loc_175b}
1741: 3C              INC     A                   ; A: 0 -> 1
1742: 32 78 80        LD      ($8078),A           ; {ram.treasureCollected} mark set, fall into loc_1745

loc_1745:
1745: CD 83 46        CALL    $4683               ; {code.awardTwentyPoints} +20 score
1748: 3A 82 80        LD      A,($8082)           ; {ram.diamondCount}
174B: 3C              INC     A
174C: 32 82 80        LD      ($8082),A           ; {ram.diamondCount} bump 0x3b/c/d counter

loc_174f:
174F: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr} actor display cell ptr
1753: 3E 70           LD      A,$70
1755: DD 77 00        LD      (IX+$00),A          ; blank consumed tile
1758: C3 4A 18        JP      $184A               ; {code.walkActor}

loc_175b:
175B: 78              LD      A,B                 ; tile
175C: FE 26           CP      $26
175E: 20 03           JR      NZ,$1763            ; {code.loc_1763} tile == 0x26)
1760: 32 76 80        LD      ($8076),A           ; {ram.prizeGate} stash 0x26 tile, fall into loc_1763

loc_1763:
1763: 78              LD      A,B                 ; tile
1764: FE 2A           CP      $2A
1766: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1769: FE 41           CP      $41
176B: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
176E: FE C1           CP      $C1
1770: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1773: FE C9           CP      $C9
1775: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1778: FE 95           CP      $95
177A: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
177D: FE C4           CP      $C4
177F: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1782: FE C5           CP      $C5
1784: 28 0D           JR      Z,$1793             ; {code.loc_1793}
1786: FE 96           CP      $96
1788: 38 0E           JR      C,$1798             ; {code.loc_1798}
178A: FE 9A           CP      $9A
178C: DA 5B 1B        JP      C,$1B5B             ; {code.stageObjectSpriteRecord}
178F: FE 9E           CP      $9E
1791: 30 43           JR      NC,$17D6            ; {code.loc_17d6} 0x9a-0x9d, fall into loc_1793)

loc_1793:
1793: CB 52           BIT     2,D
1795: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord} fall into loc_1798)

loc_1798:
1798: FE 71           CP      $71
179A: 38 3A           JR      C,$17D6             ; {code.loc_17d6}
179C: FE 9E           CP      $9E
179E: 30 36           JR      NC,$17D6            ; {code.loc_17d6} 0x71..0x9d)
17A0: 5F              LD      E,A                 ; keep tile for compare
17A1: D6 71           SUB     $71                 ; table row index
17A3: 06 00           LD      B,$00
17A5: CB 27           SLA     A
17A7: CB 27           SLA     A
17A9: CB 27           SLA     A                   ; row*8, carry -> bit8
17AB: CB 10           RL      B                   ; capture bit8 into B
17AD: 4F              LD      C,A
17AE: 7A              LD      A,D
17AF: E6 07           AND     $07                 ; direction column
17B1: B1              OR      C                   ; BC = row*8 + dir
17B2: 4F              LD      C,A
17B3: 21 78 1B        LD      HL,$1B78            ; current-tile table
17B6: 09              ADD     HL,BC
17B7: 7E              LD      A,(HL)              ; expected tile
17B8: 32 A7 80        LD      ($80A7),A           ; {ram.expectedTile}
17BB: BB              CP      E                   ; matches actual?
17BC: 28 18           JR      Z,$17D6             ; {code.loc_17d6} mismatch)
17BE: 7A              LD      A,D
17BF: E6 07           AND     $07                 ; on-grid step?
17C1: 20 18           JR      NZ,$17DB            ; {code.loc_17db}
17C3: 3A A3 80        LD      A,($80A3)
17C6: 32 A4 80        LD      ($80A4),A           ; {ram.reactionTimer}
17C9: 3E 02           LD      A,$02
17CB: 32 A2 80        LD      ($80A2),A           ; {ram.reactionState}
17CE: 3E 35           LD      A,$35
17D0: 32 69 80        LD      ($8069),A           ; {ram.playerFacing} arm 0x35 event
17D3: C3 5B 1B        JP      $1B5B               ; {code.stageObjectSpriteRecord}

loc_17d6:
17D6: 7A              LD      A,D
17D7: E6 07           AND     $07                 ; on-grid step?
17D9: 28 6F           JR      Z,$184A             ; {code.walkActor} fall into loc_17db)

loc_17db:
17DB: DD 7E 01        LD      A,(IX+$01)          ; next tile
17DE: 32 A6 80        LD      ($80A6),A
17E1: FE 2A           CP      $2A
17E3: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
17E6: FE 41           CP      $41
17E8: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
17EB: FE C1           CP      $C1
17ED: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
17F0: FE C4           CP      $C4
17F2: 28 0D           JR      Z,$1801             ; {code.loc_1801}
17F4: FE 95           CP      $95
17F6: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
17F9: FE 96           CP      $96
17FB: 38 0A           JR      C,$1807             ; {code.loc_1807}
17FD: FE 9A           CP      $9A
17FF: 30 3F           JR      NC,$1840            ; {code.loc_1840} 0x96-0x99, fall into loc_1801)

loc_1801:
1801: 15              DEC     D
1802: CB 52           BIT     2,D
1804: C2 5B 1B        JP      NZ,$1B5B            ; {code.stageObjectSpriteRecord} fall into loc_1807)

loc_1807:
1807: FE 71           CP      $71
1809: 38 35           JR      C,$1840             ; {code.loc_1840}
180B: FE 9E           CP      $9E
180D: 30 31           JR      NC,$1840            ; {code.loc_1840} 0x71..0x9d)
180F: 5F              LD      E,A                 ; keep next tile
1810: D6 71           SUB     $71                 ; table row index
1812: 06 00           LD      B,$00
1814: CB 27           SLA     A
1816: CB 27           SLA     A
1818: CB 27           SLA     A                   ; row*8, carry -> bit8
181A: CB 10           RL      B                   ; capture bit8 into B
181C: 4F              LD      C,A
181D: 7A              LD      A,D
181E: E6 07           AND     $07                 ; direction column
1820: B1              OR      C                   ; BC = row*8 + dir
1821: 4F              LD      C,A
1822: 21 E0 1C        LD      HL,$1CE0            ; next-tile table
1825: 09              ADD     HL,BC
1826: 7E              LD      A,(HL)              ; expected next tile
1827: 32 A8 80        LD      ($80A8),A           ; {ram.nextTile}
182A: BB              CP      E                   ; matches actual?
182B: 28 13           JR      Z,$1840             ; {code.loc_1840} mismatch, fall into loc_182d)

loc_182d:
182D: 3A A3 80        LD      A,($80A3)
1830: 32 A4 80        LD      ($80A4),A           ; {ram.reactionTimer}
1833: 3E 02           LD      A,$02
1835: 32 A2 80        LD      ($80A2),A           ; {ram.reactionState}
1838: 3E 35           LD      A,$35
183A: 32 69 80        LD      ($8069),A           ; {ram.playerFacing} arm 0x35 event
183D: C3 5B 1B        JP      $1B5B               ; {code.stageObjectSpriteRecord}

loc_1840:
1840: 3A A5 80        LD      A,($80A5)           ; {ram.curTile} saved current tile
1843: 5F              LD      E,A
1844: 3A A7 80        LD      A,($80A7)           ; {ram.expectedTile} possibly table-overwritten
1847: BB              CP      E
1848: 20 E3           JR      NZ,$182D            ; {code.loc_182d} fall into loc_184a)

; walkActor — advance an actor's walk: accumulate its position, pick the walk frame, then build
; its display record. ROM 0x184a.
walkActor:
184A: 3A 6C 80        LD      A,($806C)           ; {ram.playerStepY} per-step delta
184D: 5F              LD      E,A
184E: 3A 68 80        LD      A,($8068)           ; {ram.playerY} animation phase
1851: 83              ADD     A,E                 ; advance phase
1852: 32 68 80        LD      ($8068),A           ; {ram.playerY}
1855: C6 03           ADD     A,$03
1857: E6 07           AND     $07
1859: 32 75 80        LD      ($8075),A           ; terrain byte
185C: E6 02           AND     $02                 ; bit1 (sets Z read below)
185E: 3E 32           LD      A,$32
1860: 28 02           JR      Z,$1864             ; {code.loc_1864}
1862: 3E 33           LD      A,$33

loc_1864:
1864: 32 69 80        LD      ($8069),A           ; {ram.playerFacing} sprite code
1867: C3 5B 1B        JP      $1B5B               ; {code.stageObjectSpriteRecord}

; stampFixedFrameAndResolveTile — stamp the actor's fixed animation frame, then run the shared
; cell/tile tail. ROM 0x186a.
stampFixedFrameAndResolveTile:
186A: 3E 34           LD      A,$34               ; frame/sprite id 0x34 (no flags)
186C: 32 69 80        LD      ($8069),A           ; {ram.playerFacing} store the frame id; PC now at 0x186f (work RAM, no bus offset)

; resolveObjectTile — locate the tracked object's tile cell, read the tile under it, and hand the
; object to the matching per-frame handler. ROM 0x186f.
resolveObjectTile:
186F: 3A 68 80        LD      A,($8068)           ; {ram.playerY} vertical position counter
1872: C6 03           ADD     A,$03               ; +3 bias
1874: CB 3F           SRL     A                   ; >> 3 (three logical shifts) -> row cell
1876: CB 3F           SRL     A
1878: CB 3F           SRL     A                   ; (pos+3) >> 3
187A: ED 44           NEG                         ; screen row grows downward -> negate
187C: C6 1F           ADD     A,$1F               ; +0x1f -> row index 0..0x1f
187E: 32 73 80        LD      ($8073),A           ; {ram.playerTileRow} store row
1881: 67              LD      H,A                 ; H = row (feeds the *0x20 build below)
1882: 3A 6B 80        LD      A,($806B)           ; {ram.playerX} horizontal position counter
1885: 82              ADD     A,D                 ; + caller's D bias
1886: C6 0C           ADD     A,$0C               ; +0x0c bias
1888: 5F              LD      E,A                 ; E = biased column (kept for the 0x53 test)
1889: CB 3F           SRL     A                   ; >> 3 -> column cell
188B: CB 3F           SRL     A
188D: CB 3F           SRL     A                   ; column cell
188F: 32 71 80        LD      ($8071),A           ; {ram.playerTileCol} store column
1892: 4F              LD      C,A                 ; BC = column (low part of the offset)
1893: 3E 00           LD      A,$00
1895: 47              LD      B,A                 ; BC = column
1896: CB 3C           SRL     H                   ; H:A >>= 1, three times: L = (row & 7)<<5,
1898: 1F              RRA                         ; H = row >> 3 -- i.e. HL = row * 0x20
1899: CB 3C           SRL     H
189B: 1F              RRA
189C: CB 3C           SRL     H
189E: 1F              RRA                         ; HL now = row * 0x20 (H:A shifted right 3)
189F: 6F              LD      L,A                 ; L = low byte of row*0x20
18A0: 09              ADD     HL,BC               ; + column
18A1: 01 00 90        LD      BC,$9000            ; {hard.videoRam} video-RAM base
18A4: 09              ADD     HL,BC               ; -> absolute cell address
18A5: 22 6E 80        LD      ($806E),HL          ; {ram.playerCellPtr} store the actor cell pointer
18A8: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr} IX = that pointer
18AC: 3E 00           LD      A,$00
18AE: 32 A8 80        LD      ($80A8),A           ; {ram.nextTile} clear the next-tile slot
18B1: DD 7E 00        LD      A,(IX+$00)          ; tile currently under the actor
18B4: 32 A5 80        LD      ($80A5),A           ; {ram.curTile} publish it (two copies)
18B7: 32 A7 80        LD      ($80A7),A           ; {ram.expectedTile}
18BA: 47              LD      B,A                 ; keep tile in B
18BB: FE 27           CP      $27                 ; is it the special 0x27 tile?
18BD: 20 10           JR      NZ,$18CF            ; {code.collectLootTile} tile != 0x27 -> classify at loc_18cf (tail-jump)
18BF: 32 E7 80        LD      ($80E7),A           ; {ram.goalTileLatch} yes: latch 0x27 at 0x80e7
18C2: 3A 6B 80        LD      A,($806B)           ; {ram.playerX} horizontal position again
18C5: FE 53           CP      $53                 ; past column 0x53?
18C7: 38 06           JR      C,$18CF             ; {code.collectLootTile} 0x806b < 0x53 -> classify at loc_18cf (tail-jump)
18C9: 32 77 80        LD      ($8077),A           ; {ram.pitCrossActive} store the crossing position
18CC: C3 D0 19        JP      $19D0               ; {code.advanceActorWalk} tail-jump into loc_19d0

; collectLootTile — collect the scoring loot tile the actor has aligned onto: award its points,
; play the pickup sound, bump that loot kind's count, and blank the tile so it is removed from the
; playfield (delegates to the dig-arm otherwise). ROM 0x18cf.
collectLootTile:
18CF: 7B              LD      A,E                 ; actor position accumulator
18D0: 3C              INC     A
18D1: E6 07           AND     $07                 ; Z set iff (E+1) is a multiple of 8
18D3: 20 4A           JR      NZ,$191F            ; {code.triggerDigReaction} not a boundary; on to loc_191f
18D5: 78              LD      A,B                 ; tile code under the actor
18D6: FE 3A           CP      $3A
18D8: 20 0C           JR      NZ,$18E6            ; {code.loc_18e6} tile == 0x3a
18DA: CD 7B 46        CALL    $467B               ; {code.awardTenPoints} award +10 (sound 0x10)
18DD: 3A 81 80        LD      A,($8081)           ; {ram.crystalCount}
18E0: 3C              INC     A
18E1: 32 81 80        LD      ($8081),A           ; {ram.crystalCount} bump the 0x3a-kind counter
18E4: 18 2D           JR      $1913               ; {code.loc_1913} to the shared cell-blank tail

loc_18e6:
18E6: 3A 76 80        LD      A,($8076)           ; {ram.prizeGate} feature-enabled flag
18E9: A7              AND     A                   ; Z iff disabled
18EA: 28 33           JR      Z,$191F             ; {code.triggerDigReaction} disabled; on to loc_191f
18EC: 78              LD      A,B
18ED: FE 3B           CP      $3B
18EF: 28 08           JR      Z,$18F9             ; {code.loc_18f9} tile 0x3b
18F1: FE 3C           CP      $3C
18F3: 28 04           JR      Z,$18F9             ; {code.loc_18f9} tile 0x3c
18F5: FE 3D           CP      $3D
18F7: 20 26           JR      NZ,$191F            ; {code.triggerDigReaction} unrecognised tile; on to loc_191f

loc_18f9:
18F9: 3A 78 80        LD      A,($8078)           ; {ram.treasureCollected} latch byte
18FC: B7              OR      A                   ; NZ iff already latched
18FD: 20 0A           JR      NZ,$1909            ; {code.loc_1909} already latched; award directly
18FF: 3A BD 80        LD      A,($80BD)           ; {ram.hazardActiveCount} guard condition
1902: B7              OR      A
1903: 20 1A           JR      NZ,$191F            ; {code.triggerDigReaction} guard set; skip the award, on to loc_191f
1905: 3C              INC     A                   ; A := 1
1906: 32 78 80        LD      ($8078),A           ; {ram.treasureCollected} set the latch to 1; fall into Block E

loc_1909:
1909: CD 83 46        CALL    $4683               ; {code.awardTwentyPoints} award +20
190C: 3A 82 80        LD      A,($8082)           ; {ram.diamondCount}
190F: 3C              INC     A
1910: 32 82 80        LD      ($8082),A           ; {ram.diamondCount} bump the 0x3b/3c/3d counter; fall into Block G

loc_1913:
1913: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr} the actor's video-RAM cell pointer
1917: 3E 70           LD      A,$70               ; blank tile id
1919: DD 77 00        LD      (IX+$00),A          ; overwrite the collected tile with blank
191C: C3 D0 19        JP      $19D0               ; {code.advanceActorWalk} tail-jump into the movement continuation

; triggerDigReaction — classify the tile under a digging actor and stage its reaction. ROM 0x191f.
triggerDigReaction:
191F: 78              LD      A,B                 ; tile code under the actor
1920: FE 36           CP      $36
1922: 38 05           JR      C,$1929             ; {code.loc_1929} B < 0x36, on to loc_1929
1924: FE 3A           CP      $3A
1926: DA 5B 1B        JP      C,$1B5B             ; {code.stageObjectSpriteRecord} B in [0x36,0x3a): handled elsewhere

loc_1929:
1929: FE 2A           CP      $2A
192B: CA B9 19        JP      Z,$19B9             ; {code.loc_19b9}
192E: FE 2B           CP      $2B
1930: CA B9 19        JP      Z,$19B9             ; {code.loc_19b9}
1933: FE 41           CP      $41
1935: CA B9 19        JP      Z,$19B9             ; {code.loc_19b9}
1938: FE C1           CP      $C1
193A: CA B9 19        JP      Z,$19B9             ; {code.loc_19b9}
193D: FE 95           CP      $95
193F: CA B9 19        JP      Z,$19B9             ; {code.loc_19b9}
1942: FE C4           CP      $C4
1944: 28 09           JR      Z,$194F             ; {code.loc_194f} 0xc4: check bit 2 of E
1946: FE 96           CP      $96
1948: 38 0A           JR      C,$1954             ; {code.loc_1954} B < 0x96, straight to the dig block
194A: FE 9A           CP      $9A
194C: D2 D0 19        JP      NC,$19D0            ; {code.advanceActorWalk} B >= 0x9a: nothing here, keep moving

loc_194f:
194F: CB 53           BIT     2,E                 ; Z = !(bit2 of E)
1951: C2 B9 19        JP      NZ,$19B9            ; {code.loc_19b9} bit2 set -> the latch tail

loc_1954:
1954: FE 71           CP      $71
1956: DA D0 19        JP      C,$19D0             ; {code.advanceActorWalk} B < 0x71: keep moving
1959: FE 9A           CP      $9A
195B: D2 D0 19        JP      NC,$19D0            ; {code.advanceActorWalk} B in [0x71,0x9a): do the lookup
195E: 57              LD      D,A                 ; keep the running tile code in D
195F: D6 71           SUB     $71                 ; index base (tile - 0x71)
1961: 06 00           LD      B,$00
1963: CB 27           SLA     A
1965: CB 27           SLA     A
1967: CB 27           SLA     A                   ; (tile-0x71) << 3, bit 8 spilt to carry
1969: CB 10           RL      B                   ; catch that carry as BC bit 8
196B: 4F              LD      C,A
196C: 7B              LD      A,E
196D: E6 07           AND     $07                 ; sub-tile offset (E & 7)
196F: B1              OR      C
1970: 4F              LD      C,A                 ; BC = ((tile-0x71)<<3) | (E&7)
1971: 21 48 1E        LD      HL,$1E48            ; the "under" tile table
1974: 09              ADD     HL,BC
1975: 7E              LD      A,(HL)              ; expected tile
1976: 32 A7 80        LD      ($80A7),A           ; {ram.expectedTile}
1979: BA              CP      D                   ; matches the running tile?
197A: 28 54           JR      Z,$19D0             ; {code.advanceActorWalk} same tile, no reaction; keep moving
197C: 3A A3 80        LD      A,($80A3)
197F: 32 A4 80        LD      ($80A4),A           ; {ram.reactionTimer}
1982: 3E 03           LD      A,$03
1984: 32 A2 80        LD      ($80A2),A           ; {ram.reactionState}
1987: 3E 36           LD      A,$36
1989: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
198C: 7B              LD      A,E
198D: E6 07           AND     $07                 ; on an 8-cell boundary the neighbour lookup is skipped
198F: 28 28           JR      Z,$19B9             ; {code.loc_19b9} (E&7)==0, straight to the latch tail
1991: DD 7E 01        LD      A,(IX+$01)          ; neighbour tile code
1994: 32 A6 80        LD      ($80A6),A
1997: FE 71           CP      $71
1999: 38 1E           JR      C,$19B9             ; {code.loc_19b9} neighbour < 0x71: no second lookup
199B: FE 9A           CP      $9A
199D: 30 1A           JR      NC,$19B9            ; {code.loc_19b9} neighbour in [0x71,0x9a): look it up
199F: D6 71           SUB     $71
19A1: 06 00           LD      B,$00
19A3: CB 27           SLA     A
19A5: CB 27           SLA     A
19A7: CB 27           SLA     A
19A9: CB 10           RL      B
19AB: 4F              LD      C,A
19AC: 7B              LD      A,E
19AD: E6 07           AND     $07
19AF: B1              OR      C
19B0: 4F              LD      C,A                 ; BC = ((neighbour-0x71)<<3) | (E&7)
19B1: 21 B0 1F        LD      HL,$1FB0            ; the neighbour tile table
19B4: 09              ADD     HL,BC
19B5: 7E              LD      A,(HL)
19B6: 32 A8 80        LD      ($80A8),A           ; {ram.nextTile} fall into loc_19b9

loc_19b9:
19B9: 3A C1 80        LD      A,($80C1)           ; {ram.digCollisionState} is this actor armed?
19BC: A7              AND     A                   ; Z iff 0x80c1 == 0
19BD: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord} not armed; just rebuild + ret
19C0: 3E 02           LD      A,$02
19C2: 32 C1 80        LD      ($80C1),A           ; {ram.digCollisionState} set state 2
19C5: 3E 40           LD      A,$40
19C7: 32 B1 80        LD      ($80B1),A           ; {ram.digObjTimer}
19CA: CD 9F 4C        CALL    $4C9F               ; {code.requestSound20} request sound 0x14
19CD: C3 5B 1B        JP      $1B5B               ; {code.stageObjectSpriteRecord} tail-jump; loc_1b5b's ret unwinds to OUR caller

; advanceActorWalk — carry an actor's walk forward one frame: advance its position, pick the walk
; frame, then commit + record it. ROM 0x19d0.
advanceActorWalk:
19D0: 3A 6D 80        LD      A,($806D)           ; {ram.playerStepX} per-frame step
19D3: 5F              LD      E,A
19D4: 3A 6B 80        LD      A,($806B)           ; {ram.playerX} current position
19D7: 83              ADD     A,E                 ; new position
19D8: 32 6B 80        LD      ($806B),A           ; {ram.playerX} store it back
19DB: E6 02           AND     $02                 ; Z iff bit 1 clear (A discarded next; flag kept)
19DD: 3E 34           LD      A,$34               ; default frame (does NOT touch flags)
19DF: 28 02           JR      Z,$19E3             ; {code.drawActorWalkFrame} bit 1 clear: keep 0x34
19E1: 3E B4           LD      A,$B4               ; flipped frame (bit 1 set)

; drawActorWalkFrame — commit the actor's animation frame, then fire the crossing's far-edge one-
; shot. ROM 0x19e3.
drawActorWalkFrame:
19E3: 32 69 80        LD      ($8069),A           ; {ram.playerFacing} latch the direction/animation code
19E6: 3A 77 80        LD      A,($8077)           ; {ram.pitCrossActive} feature/enable flag
19E9: A7              AND     A                   ; Z iff 0x8077 == 0
19EA: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord} inactive; rebuild + ret via loc_1b5b
19ED: 3A 6B 80        LD      A,($806B)           ; {ram.playerX} position accumulator (trailing coord)
19F0: FE 8A           CP      $8A                 ; reached the far edge?
19F2: DA 5B 1B        JP      C,$1B5B             ; {code.stageObjectSpriteRecord} position < 0x8a: not at the edge yet
19F5: 3E B4           LD      A,$B4
19F7: 32 7C 80        LD      ($807C),A           ; {ram.transitionTimer} latch the boundary state
19FA: 3E 00           LD      A,$00
19FC: 32 68 80        LD      ($8068),A           ; {ram.playerY} clear the leading byte
19FF: C3 5B 1B        JP      $1B5B               ; {code.stageObjectSpriteRecord} tail-jump; loc_1b5b's ret unwinds to OUR caller

; stepObjectAndResolveTile — step the tracked object one frame along its climb axis and resolve
; the tile it lands on: collect loot, carve into terrain, block, or keep moving. ROM 0x1a02.
stepObjectAndResolveTile:
1A02: 3A 80 80        LD      A,($8080)           ; {ram.moveBlockFlag} climb/vertical gate
1A05: A7              AND     A                   ; Z iff gate == 0
1A06: C2 5B 1B        JP      NZ,$1B5B            ; {code.stageObjectSpriteRecord}
1A09: 3E B4           LD      A,$B4
1A0B: 32 69 80        LD      ($8069),A           ; {ram.playerFacing} default sprite code
1A0E: 3A 68 80        LD      A,($8068)           ; {ram.playerY} animation phase
1A11: C6 03           ADD     A,$03
1A13: CB 3F           SRL     A
1A15: CB 3F           SRL     A
1A17: CB 3F           SRL     A                   ; (phase+3) >> 3
1A19: ED 44           NEG
1A1B: C6 1F           ADD     A,$1F               ; H := 0x1f - ((phase+3)>>3)
1A1D: 32 73 80        LD      ($8073),A           ; {ram.playerTileRow}
1A20: 67              LD      H,A                 ; row anchor
1A21: 3A 6B 80        LD      A,($806B)           ; {ram.playerX} column
1A24: FE 23           CP      $23
1A26: 20 0F           JR      NZ,$1A37            ; {code.loc_1a37} column == 0x23, top rung)
1A28: 3A 78 80        LD      A,($8078)           ; {ram.treasureCollected}
1A2B: A7              AND     A
1A2C: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1A2F: 3E 01           LD      A,$01
1A31: 32 7B 80        LD      ($807B),A           ; {ram.boardEndPhase} latch top-rung flag
1A34: C3 5B 1B        JP      $1B5B               ; {code.stageObjectSpriteRecord}

loc_1a37:
1A37: FE 53           CP      $53
1A39: 30 08           JR      NC,$1A43            ; {code.loc_1a43} column < 0x53)
1A3B: 3E 00           LD      A,$00
1A3D: 32 E7 80        LD      ($80E7),A           ; {ram.goalTileLatch} clear scratch
1A40: 3A 6B 80        LD      A,($806B)           ; {ram.playerX} reload column, fall into loc_1a43

loc_1a43:
1A43: 92              SUB     D                   ; column - move delta
1A44: C6 05           ADD     A,$05
1A46: 5F              LD      E,A                 ; E := column - d + 5 (sub-cell accumulator)
1A47: CB 3F           SRL     A
1A49: CB 3F           SRL     A
1A4B: CB 3F           SRL     A                   ; E >> 3 (cell column)
1A4D: 32 71 80        LD      ($8071),A           ; {ram.playerTileCol}
1A50: 4F              LD      C,A
1A51: 3E 00           LD      A,$00
1A53: 47              LD      B,A                 ; BC := E>>3
1A54: CB 3C           SRL     H
1A56: 1F              RRA
1A57: CB 3C           SRL     H
1A59: 1F              RRA
1A5A: CB 3C           SRL     H
1A5C: 1F              RRA                         ; slide H's low 3 bits into A's top
1A5D: 6F              LD      L,A
1A5E: 09              ADD     HL,BC               ; fold in the cell column
1A5F: 01 00 90        LD      BC,$9000            ; {hard.videoRam} tilemap base
1A62: 09              ADD     HL,BC
1A63: 22 6E 80        LD      ($806E),HL          ; {ram.playerCellPtr} actor cell pointer
1A66: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr}
1A6A: 3E 00           LD      A,$00
1A6C: 32 A8 80        LD      ($80A8),A           ; {ram.nextTile} pre-clear neighbour slot
1A6F: DD 7E 00        LD      A,(IX+$00)          ; tile under actor
1A72: 32 A5 80        LD      ($80A5),A           ; {ram.curTile}
1A75: 32 A7 80        LD      ($80A7),A           ; {ram.expectedTile}
1A78: 47              LD      B,A                 ; keep tile in B
1A79: 7B              LD      A,E
1A7A: E6 07           AND     $07                 ; on a cell boundary?
1A7C: 20 36           JR      NZ,$1AB4            ; {code.loc_1ab4} on boundary)
1A7E: 78              LD      A,B
1A7F: FE 3A           CP      $3A
1A81: 20 0C           JR      NZ,$1A8F            ; {code.loc_1a8f} tile == 0x3a)
1A83: CD 7B 46        CALL    $467B               ; {code.awardTenPoints} +10 score sfx
1A86: 3A 81 80        LD      A,($8081)           ; {ram.crystalCount}
1A89: 3C              INC     A
1A8A: 32 81 80        LD      ($8081),A           ; {ram.crystalCount} bump 0x3a counter
1A8D: 18 19           JR      $1AA8               ; {code.loc_1aa8}

loc_1a8f:
1A8F: FE 3B           CP      $3B
1A91: 28 08           JR      Z,$1A9B             ; {code.loc_1a9b}
1A93: FE 3C           CP      $3C
1A95: 28 04           JR      Z,$1A9B             ; {code.loc_1a9b}
1A97: FE 3D           CP      $3D
1A99: 20 19           JR      NZ,$1AB4            ; {code.loc_1ab4} tile == 0x3d, fall into loc_1a9b)

loc_1a9b:
1A9B: 32 78 80        LD      ($8078),A           ; {ram.treasureCollected} record consumed tile code
1A9E: CD 83 46        CALL    $4683               ; {code.awardTwentyPoints} +20 score
1AA1: 3A 82 80        LD      A,($8082)           ; {ram.diamondCount}
1AA4: 3C              INC     A
1AA5: 32 82 80        LD      ($8082),A           ; {ram.diamondCount} bump 0x3b/c/d counter, fall into loc_1aa8

loc_1aa8:
1AA8: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr} actor cell ptr
1AAC: 3E 70           LD      A,$70
1AAE: DD 77 00        LD      (IX+$00),A          ; blank consumed cell
1AB1: C3 45 1B        JP      $1B45               ; {code.loc_1b45}

loc_1ab4:
1AB4: 78              LD      A,B                 ; tile code
1AB5: FE 2A           CP      $2A
1AB7: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1ABA: FE 41           CP      $41
1ABC: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1ABF: FE C1           CP      $C1
1AC1: CA 5B 1B        JP      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1AC4: FE C5           CP      $C5
1AC6: 28 0D           JR      Z,$1AD5             ; {code.loc_1ad5}
1AC8: FE 95           CP      $95
1ACA: 38 10           JR      C,$1ADC             ; {code.loc_1adc}
1ACC: FE 9A           CP      $9A
1ACE: DA 5B 1B        JP      C,$1B5B             ; {code.stageObjectSpriteRecord}
1AD1: FE 9E           CP      $9E
1AD3: 30 70           JR      NC,$1B45            ; {code.loc_1b45} 0x9a-0x9d, fall into loc_1ad5)

loc_1ad5:
1AD5: CB 53           BIT     2,E
1AD7: 20 03           JR      NZ,$1ADC            ; {code.loc_1adc} Z80 jr cc not-taken is 7 T, not 10)
1AD9: C3 5B 1B        JP      $1B5B               ; {code.stageObjectSpriteRecord}

loc_1adc:
1ADC: FE 71           CP      $71
1ADE: 38 65           JR      C,$1B45             ; {code.loc_1b45}
1AE0: FE 9E           CP      $9E
1AE2: 30 61           JR      NC,$1B45            ; {code.loc_1b45} 0x71..0x9d)
1AE4: 57              LD      D,A                 ; keep tile code in D
1AE5: D6 71           SUB     $71                 ; table row index
1AE7: 06 00           LD      B,$00
1AE9: CB 27           SLA     A
1AEB: CB 27           SLA     A
1AED: CB 27           SLA     A                   ; row*8, carry -> bit8
1AEF: CB 10           RL      B                   ; capture bit8 into B
1AF1: 4F              LD      C,A
1AF2: 7B              LD      A,E
1AF3: E6 07           AND     $07                 ; sub-cell offset
1AF5: EE 07           XOR     $07                 ; mirror it (7 - (E&7))
1AF7: B1              OR      C                   ; BC = row*8 | mirrored offset
1AF8: 4F              LD      C,A
1AF9: 21 18 21        LD      HL,$2118            ; current-cell table
1AFC: 09              ADD     HL,BC
1AFD: 7E              LD      A,(HL)              ; expected tile
1AFE: 32 A7 80        LD      ($80A7),A           ; {ram.expectedTile}
1B01: BA              CP      D                   ; matches the running tile?
1B02: 28 41           JR      Z,$1B45             ; {code.loc_1b45} mismatch: stage reaction)
1B04: 3A A3 80        LD      A,($80A3)
1B07: 32 A4 80        LD      ($80A4),A           ; {ram.reactionTimer}
1B0A: 3E 04           LD      A,$04
1B0C: 32 A2 80        LD      ($80A2),A           ; {ram.reactionState}
1B0F: 3E F6           LD      A,$F6
1B11: 32 69 80        LD      ($8069),A           ; {ram.playerFacing} arm 0xf6 event
1B14: 7B              LD      A,E
1B15: 3C              INC     A
1B16: E6 07           AND     $07                 ; next sub-cell on a boundary?
1B18: 28 41           JR      Z,$1B5B             ; {code.stageObjectSpriteRecord}
1B1A: DD 7E FF        LD      A,(IX-$01)          ; neighbour tile
1B1D: 32 A6 80        LD      ($80A6),A
1B20: FE 71           CP      $71
1B22: 38 37           JR      C,$1B5B             ; {code.stageObjectSpriteRecord}
1B24: FE 9E           CP      $9E
1B26: 30 33           JR      NC,$1B5B            ; {code.stageObjectSpriteRecord} neighbour in [0x71,0x9e))
1B28: D6 71           SUB     $71                 ; table row index
1B2A: 06 00           LD      B,$00
1B2C: CB 27           SLA     A
1B2E: CB 27           SLA     A
1B30: CB 27           SLA     A                   ; row*8, carry -> bit8
1B32: CB 10           RL      B                   ; capture bit8 into B
1B34: 4F              LD      C,A
1B35: 7B              LD      A,E
1B36: 3C              INC     A
1B37: E6 07           AND     $07                 ; next sub-cell offset
1B39: B1              OR      C                   ; BC = row*8 | offset
1B3A: 4F              LD      C,A
1B3B: 21 80 22        LD      HL,$2280            ; neighbour-cell table
1B3E: 09              ADD     HL,BC
1B3F: 7E              LD      A,(HL)
1B40: 32 A8 80        LD      ($80A8),A           ; {ram.nextTile}
1B43: 18 16           JR      $1B5B               ; {code.stageObjectSpriteRecord}

loc_1b45:
1B45: 3A 6D 80        LD      A,($806D)           ; {ram.playerStepX} per-step delta
1B48: 57              LD      D,A
1B49: 3A 6B 80        LD      A,($806B)           ; {ram.playerX} column
1B4C: 92              SUB     D                   ; advance column by the delta
1B4D: 32 6B 80        LD      ($806B),A           ; {ram.playerX}
1B50: E6 02           AND     $02                 ; bit1 selects the sprite frame
1B52: 3E B4           LD      A,$B4
1B54: 28 02           JR      Z,$1B58             ; {code.loc_1b58}
1B56: 3E 34           LD      A,$34

loc_1b58:
1B58: 32 69 80        LD      ($8069),A           ; {ram.playerFacing} sprite code; fall into loc_1b5b epilogue

; stageObjectSpriteRecord — build the object's 4-byte deferral record at 0x8220, biasing its ends.
; ROM 0x1b5b.
stageObjectSpriteRecord:
1B5B: 21 20 82        LD      HL,$8220            ; {ram.spriteStagingBase}
1B5E: 3A 51 80        LD      A,($8051)           ; {ram.spriteCoordBias}
1B61: 47              LD      B,A
1B62: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
1B65: 90              SUB     B
1B66: 77              LD      (HL),A
1B67: 23              INC     HL
1B68: 3A 69 80        LD      A,($8069)           ; {ram.playerFacing}
1B6B: 77              LD      (HL),A
1B6C: 23              INC     HL
1B6D: 3A 6A 80        LD      A,($806A)           ; {ram.playerSpriteAttr}
1B70: 77              LD      (HL),A
1B71: 23              INC     HL
1B72: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
1B75: 80              ADD     A,B
1B76: 77              LD      (HL),A
1B77: C9              RET

; ==== UNREACHED 0x1b78-0x23e7 (2160 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
1B78:                 DEFB    $70,$71,$71,$71,$71,$71,$71,$71,$70,$71,$72,$72,$72,$72,$72,$72
1B88:                 DEFB    $70,$71,$72,$73,$73,$73,$73,$73,$70,$71,$72,$73,$74,$74,$74,$74
1B98:                 DEFB    $70,$71,$72,$73,$74,$75,$75,$75,$70,$71,$72,$73,$74,$75,$76,$76
1BA8:                 DEFB    $70,$71,$72,$73,$74,$75,$76,$77,$70,$71,$72,$73,$74,$75,$76,$77
1BB8:                 DEFB    $70,$70,$85,$84,$83,$82,$81,$80,$70,$70,$70,$8A,$89,$88,$87,$86
1BC8:                 DEFB    $70,$70,$70,$70,$8E,$8D,$8C,$8B,$70,$70,$70,$70,$70,$91,$90,$8F
1BD8:                 DEFB    $70,$70,$70,$70,$70,$70,$93,$92,$70,$70,$70,$70,$70,$70,$70,$94
1BE8:                 DEFB    $70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$85,$84,$83,$82,$81,$80
1BF8:                 DEFB    $70,$70,$85,$84,$83,$82,$81,$81,$70,$70,$85,$84,$83,$82,$82,$82
1C08:                 DEFB    $70,$70,$85,$84,$83,$83,$83,$83,$70,$70,$85,$84,$84,$84,$84,$84
1C18:                 DEFB    $70,$70,$85,$85,$85,$85,$85,$85,$70,$70,$70,$8A,$89,$88,$87,$86
1C28:                 DEFB    $70,$70,$70,$8A,$89,$88,$87,$87,$70,$70,$70,$8A,$89,$88,$88,$88
1C38:                 DEFB    $70,$70,$70,$8A,$89,$89,$89,$89,$70,$70,$70,$8A,$8A,$8A,$8A,$8A
1C48:                 DEFB    $70,$70,$70,$70,$8E,$8D,$8C,$8B,$70,$70,$70,$70,$8E,$8D,$8C,$8C
1C58:                 DEFB    $70,$70,$70,$70,$8E,$8D,$8D,$8D,$70,$70,$70,$70,$8E,$8E,$8E,$8E
1C68:                 DEFB    $70,$70,$70,$70,$70,$91,$90,$8F,$70,$70,$70,$70,$70,$91,$90,$90
1C78:                 DEFB    $70,$70,$70,$70,$70,$91,$91,$91,$70,$70,$70,$70,$70,$70,$93,$92
1C88:                 DEFB    $70,$70,$70,$70,$70,$70,$93,$93,$70,$70,$70,$70,$70,$70,$70,$94
1C98:                 DEFB    $99,$DD,$9D,$08,$19,$F5,$98,$B8,$89,$79,$B8,$99,$89,$FB,$89,$8B
1CA8:                 DEFB    $99,$81,$99,$09,$D1,$99,$0D,$38,$99,$B8,$D9,$B1,$19,$1B,$11,$F9
1CB8:                 DEFB    $99,$A9,$99,$97,$D1,$51,$D9,$19,$00,$00,$00,$00,$C5,$9D,$9C,$9B
1CC8:                 DEFB    $00,$00,$00,$00,$C5,$9D,$9C,$9B,$00,$00,$00,$00,$C5,$9D,$9C,$9C
1CD8:                 DEFB    $00,$00,$00,$00,$C5,$9D,$9D,$9D,$71,$70,$70,$70,$70,$70,$70,$70
1CE8:                 DEFB    $72,$85,$70,$70,$70,$70,$70,$70,$73,$84,$8A,$70,$70,$70,$70,$70
1CF8:                 DEFB    $74,$83,$89,$8E,$70,$70,$70,$70,$75,$82,$88,$8D,$91,$70,$70,$70
1D08:                 DEFB    $76,$81,$87,$8C,$90,$93,$70,$70,$77,$80,$86,$8B,$8F,$92,$94,$70
1D18:                 DEFB    $78,$79,$7A,$7B,$7C,$7D,$7E,$7F,$79,$79,$7A,$7B,$7C,$7D,$7E,$7F
1D28:                 DEFB    $7A,$7A,$7A,$7B,$7C,$7D,$7E,$7F,$7B,$7B,$7B,$7B,$7C,$7D,$7E,$7F
1D38:                 DEFB    $7C,$7C,$7C,$7C,$7C,$7D,$7E,$7F,$7D,$7D,$7D,$7D,$7D,$7D,$7E,$7F
1D48:                 DEFB    $7E,$7E,$7E,$7E,$7E,$7E,$7E,$7F,$7F,$7F,$7F,$7F,$7F,$7F,$7F,$7F
1D58:                 DEFB    $80,$80,$86,$8B,$8F,$92,$94,$70,$81,$81,$87,$8C,$90,$93,$70,$70
1D68:                 DEFB    $82,$82,$88,$8D,$91,$70,$70,$70,$83,$83,$89,$8E,$70,$70,$70,$70
1D78:                 DEFB    $84,$84,$8A,$70,$70,$70,$70,$70,$85,$85,$70,$70,$70,$70,$70,$70
1D88:                 DEFB    $86,$86,$86,$8B,$8F,$92,$94,$70,$87,$87,$87,$8C,$90,$93,$70,$70
1D98:                 DEFB    $88,$88,$88,$8D,$91,$70,$70,$70,$89,$89,$89,$8E,$70,$70,$70,$70
1DA8:                 DEFB    $8A,$8A,$8A,$70,$70,$70,$70,$70,$8B,$8B,$8B,$8B,$8F,$92,$94,$70
1DB8:                 DEFB    $8C,$8C,$8C,$8C,$90,$93,$70,$70,$8D,$8D,$8D,$8D,$91,$70,$70,$70
1DC8:                 DEFB    $8E,$8E,$8E,$8E,$70,$70,$70,$70,$8F,$8F,$8F,$8F,$8F,$92,$94,$70
1DD8:                 DEFB    $90,$90,$90,$90,$90,$93,$70,$70,$91,$91,$91,$91,$91,$70,$70,$70
1DE8:                 DEFB    $92,$92,$92,$92,$92,$92,$94,$70,$93,$93,$93,$93,$93,$93,$70,$70
1DF8:                 DEFB    $94,$94,$94,$94,$94,$94,$94,$70,$DA,$9B,$51,$D8,$BD,$B1,$4C,$99
1E08:                 DEFB    $97,$98,$99,$C4,$00,$00,$00,$00,$97,$98,$99,$C4,$00,$00,$00,$00
1E18:                 DEFB    $98,$98,$99,$C4,$00,$00,$00,$00,$99,$99,$99,$C4,$00,$00,$00,$00
1E28:                 DEFB    $F9,$DD,$58,$B9,$49,$8D,$0D,$91,$C5,$DD,$75,$A9,$3B,$B9,$FF,$8D
1E38:                 DEFB    $FC,$B3,$77,$B9,$0F,$99,$8D,$AF,$AB,$1D,$F7,$D9,$9C,$9C,$89,$90
1E48:                 DEFB    $70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70
1E58:                 DEFB    $70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70
1E68:                 DEFB    $70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70
1E78:                 DEFB    $70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70
1E88:                 DEFB    $79,$70,$70,$70,$70,$70,$70,$70,$7A,$7A,$70,$70,$70,$70,$70,$70
1E98:                 DEFB    $7B,$7B,$7B,$70,$70,$70,$70,$70,$7C,$7C,$7C,$7C,$70,$70,$70,$70
1EA8:                 DEFB    $7D,$7D,$7D,$7D,$7D,$70,$70,$70,$7E,$7E,$7E,$7E,$7E,$7E,$70,$70
1EB8:                 DEFB    $7F,$7F,$7F,$7F,$7F,$7F,$7F,$70,$80,$70,$70,$70,$70,$70,$70,$70
1EC8:                 DEFB    $81,$70,$70,$70,$70,$70,$70,$70,$82,$70,$70,$70,$70,$70,$70,$70
1ED8:                 DEFB    $83,$70,$70,$70,$70,$70,$70,$70,$84,$70,$70,$70,$70,$70,$70,$70
1EE8:                 DEFB    $85,$70,$70,$70,$70,$70,$70,$70,$86,$86,$70,$70,$70,$70,$70,$70
1EF8:                 DEFB    $87,$87,$70,$70,$70,$70,$70,$70,$88,$88,$70,$70,$70,$70,$70,$70
1F08:                 DEFB    $89,$89,$70,$70,$70,$70,$70,$70,$8A,$8A,$70,$70,$70,$70,$70,$70
1F18:                 DEFB    $8B,$8B,$8B,$70,$70,$70,$70,$70,$8C,$8C,$8C,$70,$70,$70,$70,$70
1F28:                 DEFB    $8D,$8D,$8D,$70,$70,$70,$70,$70,$8E,$8E,$8E,$70,$70,$70,$70,$70
1F38:                 DEFB    $8F,$8F,$8F,$8F,$70,$70,$70,$70,$90,$90,$90,$90,$70,$70,$70,$70
1F48:                 DEFB    $91,$91,$91,$91,$70,$70,$70,$70,$92,$92,$92,$92,$92,$70,$70,$70
1F58:                 DEFB    $93,$93,$93,$93,$93,$70,$70,$70,$94,$94,$94,$94,$94,$94,$70,$70
1F68:                 DEFB    $06,$E5,$EB,$D2,$A2,$F1,$66,$FF,$C4,$C4,$C4,$C4,$00,$00,$00,$00
1F78:                 DEFB    $97,$C4,$C4,$C4,$00,$00,$00,$00,$98,$98,$C4,$C4,$00,$00,$00,$00
1F88:                 DEFB    $99,$99,$99,$C4,$00,$00,$00,$00,$58,$82,$35,$8B,$E2,$8F,$AE,$3A
1F98:                 DEFB    $2E,$E8,$37,$00,$CF,$D6,$0E,$BB,$4C,$F6,$3E,$32,$3F,$F7,$A5,$9B
1FA8:                 DEFB    $66,$9A,$66,$E0,$26,$9E,$D4,$F0,$71,$70,$70,$70,$70,$70,$70,$70
1FB8:                 DEFB    $72,$85,$70,$70,$70,$70,$70,$70,$73,$84,$8A,$70,$70,$70,$70,$70
1FC8:                 DEFB    $74,$83,$89,$8E,$70,$70,$70,$70,$75,$82,$88,$8D,$91,$70,$70,$70
1FD8:                 DEFB    $76,$81,$87,$8C,$90,$93,$70,$70,$77,$80,$86,$8B,$8F,$92,$94,$70
1FE8:                 DEFB    $78,$79,$7A,$7B,$7C,$7D,$7E,$7F,$79,$79,$7A,$7B,$7C,$7D,$7E,$7F
1FF8:                 DEFB    $7A,$7A,$7A,$7B,$7C,$7D,$7E,$7F,$7B,$7B,$7B,$7B,$7C,$7D,$7E,$7F
2008:                 DEFB    $7C,$7C,$7C,$7C,$7C,$7D,$7E,$7F,$7D,$7D,$7D,$7D,$7D,$7D,$7E,$7F
2018:                 DEFB    $7E,$7E,$7E,$7E,$7E,$7E,$7E,$7F,$7F,$7F,$7F,$7F,$7F,$7F,$7F,$7F
2028:                 DEFB    $80,$80,$86,$8B,$8F,$92,$94,$70,$81,$81,$87,$8C,$90,$93,$70,$70
2038:                 DEFB    $82,$82,$88,$8D,$91,$70,$70,$70,$83,$83,$89,$8E,$70,$70,$70,$70
2048:                 DEFB    $84,$84,$8A,$70,$70,$70,$70,$70,$85,$85,$70,$70,$70,$70,$70,$70
2058:                 DEFB    $86,$86,$86,$8B,$8F,$92,$94,$70,$87,$87,$87,$8C,$90,$93,$70,$70
2068:                 DEFB    $88,$88,$88,$8D,$91,$70,$70,$70,$89,$89,$89,$8E,$70,$70,$70,$70
2078:                 DEFB    $8A,$8A,$8A,$70,$70,$70,$70,$70,$8B,$8B,$8B,$8B,$8F,$92,$94,$70
2088:                 DEFB    $8C,$8C,$8C,$8C,$90,$93,$70,$70,$8D,$8D,$8D,$8D,$91,$70,$70,$70
2098:                 DEFB    $8E,$8E,$8E,$8E,$70,$70,$70,$70,$8F,$8F,$8F,$8F,$8F,$92,$94,$70
20A8:                 DEFB    $90,$90,$90,$90,$90,$93,$70,$70,$91,$91,$91,$91,$91,$70,$70,$70
20B8:                 DEFB    $92,$92,$92,$92,$92,$92,$94,$70,$93,$93,$93,$93,$93,$93,$70,$70
20C8:                 DEFB    $94,$94,$94,$94,$94,$94,$94,$70,$95,$95,$95,$95,$95,$95,$95,$95
20D8:                 DEFB    $97,$98,$99,$C4,$C4,$C4,$C4,$C4,$97,$98,$99,$C4,$C4,$C4,$C4,$C4
20E8:                 DEFB    $98,$98,$99,$C4,$C4,$C4,$C4,$C4,$99,$99,$99,$C4,$C4,$C4,$C4,$C4
20F8:                 DEFB    $99,$49,$49,$ED,$E9,$61,$69,$7B,$9A,$96,$9E,$C7,$93,$B6,$97,$D4
2108:                 DEFB    $9B,$93,$98,$D6,$99,$8A,$9E,$B6,$99,$92,$9E,$C2,$99,$96,$9A,$0E
2118:                 DEFB    $71,$71,$71,$71,$71,$71,$71,$70,$72,$72,$72,$72,$72,$72,$70,$70
2128:                 DEFB    $73,$73,$73,$73,$73,$70,$70,$70,$74,$74,$74,$74,$70,$70,$70,$70
2138:                 DEFB    $75,$75,$75,$70,$70,$70,$70,$70,$76,$76,$70,$70,$70,$70,$70,$70
2148:                 DEFB    $77,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70
2158:                 DEFB    $70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70
2168:                 DEFB    $70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70
2178:                 DEFB    $70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70,$70
2188:                 DEFB    $70,$70,$70,$70,$70,$70,$70,$70,$80,$70,$70,$70,$70,$70,$70,$70
2198:                 DEFB    $81,$81,$70,$70,$70,$70,$70,$70,$82,$82,$82,$70,$70,$70,$70,$70
21A8:                 DEFB    $83,$83,$85,$83,$70,$70,$70,$70,$84,$84,$84,$84,$84,$70,$70,$70
21B8:                 DEFB    $85,$85,$85,$85,$85,$85,$70,$70,$86,$70,$70,$70,$70,$70,$70,$70
21C8:                 DEFB    $87,$87,$70,$70,$70,$70,$70,$70,$88,$88,$88,$70,$70,$70,$70,$70
21D8:                 DEFB    $89,$89,$89,$89,$70,$70,$70,$70,$8A,$8A,$8A,$8A,$8A,$70,$70,$70
21E8:                 DEFB    $8B,$70,$70,$70,$70,$70,$70,$70,$8C,$8C,$70,$70,$70,$70,$70,$70
21F8:                 DEFB    $8D,$8D,$8D,$70,$70,$70,$70,$70,$8E,$8E,$8E,$8E,$70,$70,$70,$70
2208:                 DEFB    $8F,$70,$70,$70,$70,$70,$70,$70,$90,$90,$70,$70,$70,$70,$70,$70
2218:                 DEFB    $91,$91,$91,$70,$70,$70,$70,$70,$92,$70,$70,$70,$70,$70,$70,$70
2228:                 DEFB    $93,$93,$70,$70,$70,$70,$70,$70,$94,$70,$70,$70,$70,$70,$70,$70
2238:                 DEFB    $95,$95,$95,$95,$95,$95,$95,$95,$96,$96,$96,$96,$96,$96,$96,$96
2248:                 DEFB    $97,$97,$97,$97,$97,$97,$97,$97,$98,$98,$98,$98,$98,$98,$98,$98
2258:                 DEFB    $99,$99,$99,$99,$99,$99,$99,$99,$C5,$C5,$C5,$C5,$C5,$C5,$C5,$C5
2268:                 DEFB    $9B,$C5,$C5,$C5,$C5,$C5,$C5,$C5,$9C,$9C,$C5,$C5,$C5,$C5,$C5,$C5
2278:                 DEFB    $9D,$9D,$9D,$C5,$C5,$C5,$C5,$C5,$70,$71,$71,$71,$71,$71,$71,$71
2288:                 DEFB    $70,$71,$72,$72,$72,$72,$72,$72,$70,$71,$72,$73,$73,$73,$73,$73
2298:                 DEFB    $70,$71,$72,$73,$74,$74,$74,$74,$70,$71,$72,$73,$74,$75,$75,$75
22A8:                 DEFB    $70,$71,$72,$73,$74,$75,$76,$76,$70,$71,$72,$73,$74,$75,$76,$77
22B8:                 DEFB    $70,$71,$72,$73,$74,$75,$76,$77,$70,$70,$85,$84,$83,$82,$81,$80
22C8:                 DEFB    $70,$70,$70,$8A,$89,$88,$87,$86,$70,$70,$70,$70,$8E,$8D,$8C,$8B
22D8:                 DEFB    $70,$70,$70,$70,$70,$91,$90,$8F,$70,$70,$70,$70,$70,$70,$93,$92
22E8:                 DEFB    $70,$70,$70,$70,$70,$70,$70,$94,$70,$70,$70,$70,$70,$70,$70,$70
22F8:                 DEFB    $70,$70,$85,$84,$83,$82,$81,$80,$70,$70,$85,$84,$83,$82,$81,$81
2308:                 DEFB    $70,$70,$85,$84,$83,$82,$82,$82,$70,$70,$85,$84,$83,$83,$83,$83
2318:                 DEFB    $70,$70,$85,$84,$84,$84,$84,$84,$70,$70,$85,$85,$85,$85,$85,$85
2328:                 DEFB    $70,$70,$70,$8A,$89,$88,$87,$86,$70,$70,$70,$8A,$89,$88,$87,$87
2338:                 DEFB    $70,$70,$70,$8A,$89,$88,$88,$88,$70,$70,$70,$8A,$89,$89,$89,$89
2348:                 DEFB    $70,$70,$70,$8A,$8A,$8A,$8A,$8A,$70,$70,$70,$70,$8E,$8D,$8C,$8B
2358:                 DEFB    $70,$70,$70,$70,$8E,$8D,$8C,$8C,$70,$70,$70,$70,$8E,$8D,$8D,$8D
2368:                 DEFB    $70,$70,$70,$70,$8E,$8E,$8E,$8E,$70,$70,$70,$70,$70,$91,$90,$8F
2378:                 DEFB    $70,$70,$70,$70,$70,$91,$90,$90,$70,$70,$70,$70,$70,$91,$91,$91
2388:                 DEFB    $70,$70,$70,$70,$70,$70,$93,$92,$70,$70,$70,$70,$70,$70,$93,$93
2398:                 DEFB    $70,$70,$70,$70,$70,$70,$70,$94,$95,$95,$95,$95,$95,$95,$95,$95
23A8:                 DEFB    $96,$96,$96,$96,$96,$96,$96,$96,$97,$97,$97,$97,$97,$97,$97,$97
23B8:                 DEFB    $98,$98,$98,$98,$98,$98,$98,$98,$99,$99,$99,$99,$99,$99,$99,$99
23C8:                 DEFB    $C5,$C5,$C5,$C5,$C5,$9D,$9C,$9B,$C5,$C5,$C5,$C5,$C5,$9D,$9C,$9B
23D8:                 DEFB    $C5,$C5,$C5,$C5,$C5,$9D,$9C,$9C,$C5,$C5,$C5,$C5,$C5,$9D,$9D,$9D

; seedMountainErosion — seed the mountain-erosion tilemap write pointer (0x9104) and its level-
; scaled countdown, then conditionally cue a sound and stamp a two-tile "cap" into the tilemap.
; ROM 0x23e8. (§2.6)
seedMountainErosion:
23E8: 21 04 91        LD      HL,$9104            ; {hard.videoRam}
23EB: 22 65 80        LD      ($8065),HL          ; {ram.mountainErodePtr} save the tilemap pointer
23EE: 3A 28 80        LD      A,($8028)           ; {ram.level}
23F1: CB 27           SLA     A
23F3: CB 27           SLA     A                   ; a = 4 * (0x8028)
23F5: 47              LD      B,A
23F6: 3A 4F 80        LD      A,($804F)           ; {ram.stepTimerBase}
23F9: 90              SUB     B                   ; a = (0x804f) - 4*(0x8028)
23FA: 32 67 80        LD      ($8067),A           ; {ram.mountainErodeTimer} store the countdown
23FD: DD 21 64 92     LD      IX,$9264            ; {hard.videoRam}
2401: DD 7E 00        LD      A,(IX+$00)          ; tile at 0x9264
2404: FE 32           CP      $32
2406: CC A3 4C        CALL    Z,$4CA3             ; {code.requestSound21} only when that tile == 0x32
2409: DD 21 E4 90     LD      IX,$90E4            ; {hard.videoRam}
240D: DD 7E 00        LD      A,(IX+$00)          ; tile at 0x90e4
2410: FE FE           CP      $FE
2412: C0              RET     NZ                  ; head cell not 0xFE -> done
2413: DD 36 00 AE     LD      (IX+$00),$AE        ; 0x90e4 = 0xAE
2417: DD 36 E0 AC     LD      (IX-$20),$AC        ; 0x90C4 = 0xAC
241B: C9              RET

; erodeMountain — one frame-gated step of the mountain erosion: walk a tile-column write pointer
; down the mountain (writing tile 0x31) as it visibly eats away. ROM 0x241c. (§2.6)
erodeMountain:
241C: 3A 10 80        LD      A,($8010)           ; {ram.playPhaseCounter}
241F: FE 0A           CP      $0A
2421: D8              RET     C                   ; phase byte still below 0x0A, nothing to do
2422: 3A 67 80        LD      A,($8067)           ; {ram.mountainErodeTimer}
2425: 3D              DEC     A
2426: 28 04           JR      Z,$242C             ; {code.loc_242c} timer expired this frame -> run the step
2428: 32 67 80        LD      ($8067),A           ; {ram.mountainErodeTimer} store the decremented timer (ld (nn),a leaves flags)
242B: C0              RET     NZ                  ; still counting down, return

loc_242c:
242C: CD 8B 4C        CALL    $4C8B               ; {code.requestSound15}
242F: DD 2A 65 80     LD      IX,($8065)          ; {ram.mountainErodePtr}
2433: DD 7E E0        LD      A,(IX-$20)
2436: FE AE           CP      $AE
2438: 20 0A           JR      NZ,$2444            ; {code.loc_2444}
243A: DD 36 E0 FE     LD      (IX-$20),$FE
243E: DD 36 C0 FD     LD      (IX-$40),$FD
2442: 18 04           JR      $2448               ; {code.loc_2448}

loc_2444:
2444: DD 36 E0 24     LD      (IX-$20),$24

loc_2448:
2448: DD 7E 00        LD      A,(IX+$00)
244B: FE 24           CP      $24
244D: 28 44           JR      Z,$2493             ; {code.loc_2493}
244F: FE 33           CP      $33
2451: 28 40           JR      Z,$2493             ; {code.loc_2493}
2453: FE 32           CP      $32
2455: 28 3C           JR      Z,$2493             ; {code.loc_2493}
2457: FE 30           CP      $30
2459: 28 07           JR      Z,$2462             ; {code.loc_2462}
245B: 3C              INC     A
245C: DD 77 00        LD      (IX+$00),A
245F: C3 E8 23        JP      $23E8               ; {code.seedMountainErosion} tail-jump

loc_2462:
2462: DD 7E FF        LD      A,(IX-$01)
2465: FE 24           CP      $24
2467: 28 11           JR      Z,$247A             ; {code.loc_247a}
2469: DD 77 00        LD      (IX+$00),A
246C: DD 7E FE        LD      A,(IX-$02)
246F: DD 77 FF        LD      (IX-$01),A
2472: 3E 24           LD      A,$24
2474: DD 77 FE        LD      (IX-$02),A
2477: C3 E8 23        JP      $23E8               ; {code.seedMountainErosion} tail-jump

loc_247a:
247A: DD 7E 20        LD      A,(IX+$20)
247D: FE 24           CP      $24
247F: 28 12           JR      Z,$2493             ; {code.loc_2493}
2481: DD 7E 40        LD      A,(IX+$40)
2484: FE 24           CP      $24
2486: 28 0B           JR      Z,$2493             ; {code.loc_2493}
2488: DD 36 20 2D     LD      (IX+$20),$2D
248C: DD 36 00 24     LD      (IX+$00),$24
2490: C3 E8 23        JP      $23E8               ; {code.seedMountainErosion} tail-jump

loc_2493:
2493: 2A 65 80        LD      HL,($8065)          ; {ram.mountainErodePtr}
2496: 11 C0 93        LD      DE,$93C0            ; {hard.videoRam}
2499: 7A              LD      A,D
249A: BC              CP      H
249B: D8              RET     C                   ; pointer high byte past 0x93 -> stop
249C: 36 31           LD      (HL),$31
249E: 11 20 00        LD      DE,$0020
24A1: 19              ADD     HL,DE
24A2: 22 65 80        LD      ($8065),HL          ; {ram.mountainErodePtr}
24A5: 11 A4 92        LD      DE,$92A4            ; {hard.videoRam}
24A8: 7B              LD      A,E
24A9: BD              CP      L
24AA: C0              RET     NZ                  ; pointer low byte not yet 0xA4 -> return
24AB: 7A              LD      A,D
24AC: BC              CP      H
24AD: 28 01           JR      Z,$24B0             ; {code.loc_24b0}
24AF: C9              RET

loc_24b0:
24B0: 3A 7B 80        LD      A,($807B)           ; {ram.boardEndPhase}
24B3: A7              AND     A
24B4: 28 11           JR      Z,$24C7             ; {code.loc_24c7}
24B6: FE 02           CP      $02
24B8: D0              RET     NC                  ; 0x807b >= 2 -> return
24B9: 3A 0D 81        LD      A,($810D)           ; {ram.enemy3Y}
24BC: FE 17           CP      $17
24BE: D8              RET     C                   ; 0x810d < 0x17 -> return
24BF: 3E 16           LD      A,$16
24C1: 32 0D 81        LD      ($810D),A           ; {ram.enemy3Y}
24C4: 32 1E 81        LD      ($811E),A           ; {ram.enemy3TwinY}

loc_24c7:
24C7: 3E 02           LD      A,$02
24C9: 32 7B 80        LD      ($807B),A           ; {ram.boardEndPhase}
24CC: C3 6B 4C        JP      $4C6B               ; {code.requestSound7} tail-jump

; resetReactionState — reset the per-object reaction state machine to idle and seed its companion
; control bytes at round start, then hand off to the dig-object / round-parameter seeding chain.
; ROM 0x24cf.
resetReactionState:
24CF: 3E 03           LD      A,$03
24D1: 32 96 80        LD      ($8096),A           ; {ram.reactionObjAttr}
24D4: 3E 00           LD      A,$00
24D6: 32 94 80        LD      ($8094),A           ; {ram.reactionObjX}
24D9: 32 97 80        LD      ($8097),A           ; {ram.reactionObjY}
24DC: 32 A2 80        LD      ($80A2),A           ; {ram.reactionState}
24DF: 32 A4 80        LD      ($80A4),A           ; {ram.reactionTimer}
24E2: 3C              INC     A
24E3: 32 A1 80        LD      ($80A1),A           ; {ram.laserState}
24E6: 3E 18           LD      A,$18
24E8: 32 A3 80        LD      ($80A3),A
24EB: 3E 01           LD      A,$01
24ED: 32 9C 80        LD      ($809C),A
24F0: C3 7A 28        JP      $287A               ; {code.seedDigObjectBlock}

; advancePlayerLaser — per-frame driver of the player's horizontal laser AND the dig/push carve
; reaction, which time-multiplex ONE sprite slot (0x8094-0x80a4); also tail-chains the whole actor
; pipeline each frame (dig-carve/hazards → chamber creature → enemies → enemy-3). ROM 0x24f3.
; (§2.3)
advancePlayerLaser:
24F3: 3A 77 80        LD      A,($8077)           ; {ram.pitCrossActive}
24F6: A7              AND     A
24F7: 20 06           JR      NZ,$24FF            ; {code.loc_24ff}
24F9: 3A C1 80        LD      A,($80C1)           ; {ram.digCollisionState}
24FC: A7              AND     A
24FD: 28 08           JR      Z,$2507             ; {code.loc_2507}

loc_24ff:
24FF: 3E 09           LD      A,$09
2501: 32 95 80        LD      ($8095),A           ; {ram.reactionObjCode}
2504: C3 77 26        JP      $2677               ; {code.loc_2677}

loc_2507:
2507: 3A A1 80        LD      A,($80A1)           ; {ram.laserState}
250A: E6 08           AND     $08
250C: C2 2D 27        JP      NZ,$272D            ; {code.loc_272d}
250F: 3A BD 80        LD      A,($80BD)           ; {ram.hazardActiveCount}
2512: FE 02           CP      $02
2514: CA 96 26        JP      Z,$2696             ; {code.loc_2696}
2517: 3A A4 80        LD      A,($80A4)           ; {ram.reactionTimer}
251A: FE 18           CP      $18
251C: CC 73 4C        CALL    Z,$4C73             ; {code.requestSound9}
251F: 3A A2 80        LD      A,($80A2)           ; {ram.reactionState}
2522: 3D              DEC     A
2523: 28 0F           JR      Z,$2534             ; {code.loc_2534}
2525: 3D              DEC     A
2526: CA 87 25        JP      Z,$2587             ; {code.loc_2587}
2529: 3D              DEC     A
252A: CA DA 25        JP      Z,$25DA             ; {code.loc_25da}
252D: 3D              DEC     A
252E: CA 28 26        JP      Z,$2628             ; {code.loc_2628}
2531: C3 96 26        JP      $2696               ; {code.loc_2696}

loc_2534:
2534: 3E A8           LD      A,$A8
2536: 32 95 80        LD      ($8095),A           ; {ram.reactionObjCode}
2539: 3A A4 80        LD      A,($80A4)           ; {ram.reactionTimer}
253C: 3D              DEC     A
253D: 32 A4 80        LD      ($80A4),A           ; {ram.reactionTimer}
2540: 20 2B           JR      NZ,$256D            ; {code.loc_256d}
2542: 3E 09           LD      A,$09
2544: 32 95 80        LD      ($8095),A           ; {ram.reactionObjCode}
2547: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr}
254B: 3A A7 80        LD      A,($80A7)           ; {ram.expectedTile}
254E: A7              AND     A
254F: 28 03           JR      Z,$2554             ; {code.loc_2554}
2551: DD 77 00        LD      (IX+$00),A

loc_2554:
2554: 3A A8 80        LD      A,($80A8)           ; {ram.nextTile}
2557: A7              AND     A
2558: 28 03           JR      Z,$255D             ; {code.loc_255d}
255A: DD 77 01        LD      (IX+$01),A

loc_255d:
255D: 3E B2           LD      A,$B2
255F: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
2562: CD AB 28        CALL    $28AB               ; {code.spawnDigEntity}
2565: 3E 00           LD      A,$00
2567: 32 A2 80        LD      ($80A2),A           ; {ram.reactionState}
256A: C3 77 26        JP      $2677               ; {code.loc_2677}

loc_256d:
256D: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
2570: D6 08           SUB     $08
2572: 32 94 80        LD      ($8094),A           ; {ram.reactionObjX}
2575: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
2578: 32 97 80        LD      ($8097),A           ; {ram.reactionObjY}
257B: 3A 96 80        LD      A,($8096)           ; {ram.reactionObjAttr}
257E: 3D              DEC     A
257F: E6 07           AND     $07
2581: 32 96 80        LD      ($8096),A           ; {ram.reactionObjAttr}
2584: C3 77 26        JP      $2677               ; {code.loc_2677}

loc_2587:
2587: 3E 28           LD      A,$28
2589: 32 95 80        LD      ($8095),A           ; {ram.reactionObjCode}
258C: 3A A4 80        LD      A,($80A4)           ; {ram.reactionTimer}
258F: 3D              DEC     A
2590: 32 A4 80        LD      ($80A4),A           ; {ram.reactionTimer}
2593: 20 2B           JR      NZ,$25C0            ; {code.loc_25c0}
2595: 3E 00           LD      A,$00
2597: 32 A2 80        LD      ($80A2),A           ; {ram.reactionState}
259A: 3E 09           LD      A,$09
259C: 32 95 80        LD      ($8095),A           ; {ram.reactionObjCode}
259F: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr}
25A3: 3A A7 80        LD      A,($80A7)           ; {ram.expectedTile}
25A6: A7              AND     A
25A7: 28 03           JR      Z,$25AC             ; {code.loc_25ac}
25A9: DD 77 00        LD      (IX+$00),A

loc_25ac:
25AC: 3A A8 80        LD      A,($80A8)           ; {ram.nextTile}
25AF: A7              AND     A
25B0: 28 03           JR      Z,$25B5             ; {code.loc_25b5}
25B2: DD 77 01        LD      (IX+$01),A

loc_25b5:
25B5: 3E 32           LD      A,$32
25B7: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
25BA: CD AB 28        CALL    $28AB               ; {code.spawnDigEntity}
25BD: C3 77 26        JP      $2677               ; {code.loc_2677}

loc_25c0:
25C0: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
25C3: C6 08           ADD     A,$08
25C5: 32 94 80        LD      ($8094),A           ; {ram.reactionObjX}
25C8: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
25CB: 32 97 80        LD      ($8097),A           ; {ram.reactionObjY}
25CE: 3A 96 80        LD      A,($8096)           ; {ram.reactionObjAttr}
25D1: 3D              DEC     A
25D2: E6 07           AND     $07
25D4: 32 96 80        LD      ($8096),A           ; {ram.reactionObjAttr}
25D7: C3 77 26        JP      $2677               ; {code.loc_2677}

loc_25da:
25DA: 3E 29           LD      A,$29
25DC: 32 95 80        LD      ($8095),A           ; {ram.reactionObjCode}
25DF: 3A A4 80        LD      A,($80A4)           ; {ram.reactionTimer}
25E2: 3D              DEC     A
25E3: 32 A4 80        LD      ($80A4),A           ; {ram.reactionTimer}
25E6: 20 27           JR      NZ,$260F            ; {code.loc_260f}
25E8: 3E 00           LD      A,$00
25EA: 32 A2 80        LD      ($80A2),A           ; {ram.reactionState}
25ED: 3E 09           LD      A,$09
25EF: 32 95 80        LD      ($8095),A           ; {ram.reactionObjCode}
25F2: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr}
25F6: 3A A7 80        LD      A,($80A7)           ; {ram.expectedTile}
25F9: A7              AND     A
25FA: 28 03           JR      Z,$25FF             ; {code.loc_25ff}
25FC: DD 77 00        LD      (IX+$00),A

loc_25ff:
25FF: 3A A8 80        LD      A,($80A8)           ; {ram.nextTile}
2602: A7              AND     A
2603: 28 03           JR      Z,$2608             ; {code.loc_2608}
2605: DD 77 01        LD      (IX+$01),A

loc_2608:
2608: 3E 34           LD      A,$34
260A: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
260D: 18 68           JR      $2677               ; {code.loc_2677}

loc_260f:
260F: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
2612: 32 94 80        LD      ($8094),A           ; {ram.reactionObjX}
2615: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
2618: C6 08           ADD     A,$08
261A: 32 97 80        LD      ($8097),A           ; {ram.reactionObjY}
261D: 3A 96 80        LD      A,($8096)           ; {ram.reactionObjAttr}
2620: 3D              DEC     A
2621: E6 07           AND     $07
2623: 32 96 80        LD      ($8096),A           ; {ram.reactionObjAttr}
2626: 18 4F           JR      $2677               ; {code.loc_2677}

loc_2628:
2628: 3E 69           LD      A,$69
262A: 32 95 80        LD      ($8095),A           ; {ram.reactionObjCode}
262D: 3A A4 80        LD      A,($80A4)           ; {ram.reactionTimer}
2630: 3D              DEC     A
2631: 32 A4 80        LD      ($80A4),A           ; {ram.reactionTimer}
2634: 20 2A           JR      NZ,$2660            ; {code.loc_2660}
2636: 3E 09           LD      A,$09
2638: 32 95 80        LD      ($8095),A           ; {ram.reactionObjCode}
263B: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr}
263F: 3A A7 80        LD      A,($80A7)           ; {ram.expectedTile}
2642: A7              AND     A
2643: 28 03           JR      Z,$2648             ; {code.loc_2648}
2645: DD 77 00        LD      (IX+$00),A

loc_2648:
2648: 3A A8 80        LD      A,($80A8)           ; {ram.nextTile}
264B: A7              AND     A
264C: 28 03           JR      Z,$2651             ; {code.loc_2651}
264E: DD 77 FF        LD      (IX-$01),A

loc_2651:
2651: 3E B4           LD      A,$B4
2653: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
2656: CD AB 28        CALL    $28AB               ; {code.spawnDigEntity}
2659: 3E 00           LD      A,$00
265B: 32 A2 80        LD      ($80A2),A           ; {ram.reactionState}
265E: 18 17           JR      $2677               ; {code.loc_2677}

loc_2660:
2660: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
2663: 32 94 80        LD      ($8094),A           ; {ram.reactionObjX}
2666: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
2669: D6 08           SUB     $08
266B: 32 97 80        LD      ($8097),A           ; {ram.reactionObjY}
266E: 3A 96 80        LD      A,($8096)           ; {ram.reactionObjAttr}
2671: 3D              DEC     A
2672: E6 07           AND     $07
2674: 32 96 80        LD      ($8096),A           ; {ram.reactionObjAttr}

loc_2677:
2677: 21 24 82        LD      HL,$8224
267A: 3A 51 80        LD      A,($8051)           ; {ram.spriteCoordBias}
267D: 47              LD      B,A
267E: 3A 94 80        LD      A,($8094)           ; {ram.reactionObjX}
2681: 90              SUB     B
2682: 77              LD      (HL),A
2683: 23              INC     HL
2684: 3A 95 80        LD      A,($8095)           ; {ram.reactionObjCode}
2687: 77              LD      (HL),A
2688: 23              INC     HL
2689: 3A 96 80        LD      A,($8096)           ; {ram.reactionObjAttr}
268C: 77              LD      (HL),A
268D: 23              INC     HL
268E: 3A 97 80        LD      A,($8097)           ; {ram.reactionObjY}
2691: 80              ADD     A,B
2692: 77              LD      (HL),A
2693: C3 AD 29        JP      $29AD               ; {code.advanceDigCarveObject}

loc_2696:
2696: 3A 79 80        LD      A,($8079)           ; {ram.playerActive}
2699: B7              OR      A
269A: 28 1F           JR      Z,$26BB             ; {code.loc_26bb}
269C: 3A 7B 80        LD      A,($807B)           ; {ram.boardEndPhase}
269F: B7              OR      A
26A0: 20 19           JR      NZ,$26BB            ; {code.loc_26bb}
26A2: 3A E7 80        LD      A,($80E7)           ; {ram.goalTileLatch}
26A5: B7              OR      A
26A6: 20 13           JR      NZ,$26BB            ; {code.loc_26bb}
26A8: 3A 18 80        LD      A,($8018)           ; {ram.in0Debounced}
26AB: 47              LD      B,A
26AC: 3A A1 80        LD      A,($80A1)           ; {ram.laserState}
26AF: B7              OR      A
26B0: 28 0C           JR      Z,$26BE             ; {code.loc_26be}
26B2: CB 60           BIT     4,B
26B4: 20 05           JR      NZ,$26BB            ; {code.loc_26bb}
26B6: 3E 00           LD      A,$00
26B8: 32 A1 80        LD      ($80A1),A           ; {ram.laserState}

loc_26bb:
26BB: C3 AD 29        JP      $29AD               ; {code.advanceDigCarveObject}

loc_26be:
26BE: CB 60           BIT     4,B
26C0: 28 F9           JR      Z,$26BB             ; {code.loc_26bb}
26C2: 0E F8           LD      C,$F8
26C4: 3A 69 80        LD      A,($8069)           ; {ram.playerFacing}
26C7: FE B2           CP      $B2
26C9: 28 0E           JR      Z,$26D9             ; {code.loc_26d9}
26CB: FE B3           CP      $B3
26CD: 28 0A           JR      Z,$26D9             ; {code.loc_26d9}
26CF: 0E 08           LD      C,$08
26D1: FE 32           CP      $32
26D3: 28 04           JR      Z,$26D9             ; {code.loc_26d9}
26D5: FE 33           CP      $33
26D7: 20 E2           JR      NZ,$26BB            ; {code.loc_26bb}

loc_26d9:
26D9: 79              LD      A,C
26DA: 32 A1 80        LD      ($80A1),A           ; {ram.laserState}
26DD: CD 7F 4C        CALL    $4C7F               ; {code.requestSound12}
26E0: 3E 03           LD      A,$03
26E2: 32 96 80        LD      ($8096),A           ; {ram.reactionObjAttr}
26E5: 3E 3A           LD      A,$3A
26E7: 32 95 80        LD      ($8095),A           ; {ram.reactionObjCode}
26EA: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
26ED: 32 94 80        LD      ($8094),A           ; {ram.reactionObjX}
26F0: C6 03           ADD     A,$03
26F2: CB 3F           SRL     A
26F4: CB 3F           SRL     A
26F6: CB 3F           SRL     A
26F8: ED 44           NEG
26FA: C6 1F           ADD     A,$1F
26FC: 67              LD      H,A
26FD: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
2700: 32 97 80        LD      ($8097),A           ; {ram.reactionObjY}
2703: C6 05           ADD     A,$05
2705: 06 00           LD      B,$00
2707: CB 3F           SRL     A
2709: CB 18           RR      B
270B: CB 3F           SRL     A
270D: CB 18           RR      B
270F: CB 3F           SRL     A
2711: CB 18           RR      B
2713: 4F              LD      C,A
2714: 78              LD      A,B
2715: 32 9E 80        LD      ($809E),A           ; {ram.scrollSubphase}
2718: 3E 00           LD      A,$00
271A: 47              LD      B,A
271B: CB 3C           SRL     H
271D: 1F              RRA
271E: CB 3C           SRL     H
2720: 1F              RRA
2721: CB 3C           SRL     H
2723: 1F              RRA
2724: 6F              LD      L,A
2725: 09              ADD     HL,BC
2726: 01 00 90        LD      BC,$9000            ; {hard.videoRam}
2729: 09              ADD     HL,BC
272A: 22 9A 80        LD      ($809A),HL          ; {ram.laserScanPtr}

loc_272d:
272D: 3A A1 80        LD      A,($80A1)           ; {ram.laserState}
2730: 4F              LD      C,A
2731: 11 20 00        LD      DE,$0020
2734: CB 79           BIT     7,C
2736: 20 03           JR      NZ,$273B            ; {code.loc_273b}
2738: 11 E0 FF        LD      DE,$FFE0

loc_273b:
273B: 3A 94 80        LD      A,($8094)           ; {ram.reactionObjX}
273E: 81              ADD     A,C
273F: 32 94 80        LD      ($8094),A           ; {ram.reactionObjX}
2742: 2A 9A 80        LD      HL,($809A)          ; {ram.laserScanPtr}
2745: 19              ADD     HL,DE
2746: 22 9A 80        LD      ($809A),HL          ; {ram.laserScanPtr}
2749: DD 2A 9A 80     LD      IX,($809A)          ; {ram.laserScanPtr}
274D: 3A 9E 80        LD      A,($809E)           ; {ram.scrollSubphase}
2750: 5F              LD      E,A
2751: FE A0           CP      $A0
2753: DD 7E 00        LD      A,(IX+$00)
2756: 38 03           JR      C,$275B             ; {code.loc_275b}
2758: DD 7E 01        LD      A,(IX+$01)

loc_275b:
275B: 16 00           LD      D,$00
275D: 21 7A 27        LD      HL,$277A
2760: 19              ADD     HL,DE
2761: 01 20 00        LD      BC,$0020
2764: ED B1           CPIR
2766: C2 77 26        JP      NZ,$2677            ; {code.loc_2677}
2769: 3E 00           LD      A,$00
276B: 32 94 80        LD      ($8094),A           ; {ram.reactionObjX}
276E: 3C              INC     A
276F: 32 A1 80        LD      ($80A1),A           ; {ram.laserState}
2772: 3E 09           LD      A,$09
2774: 32 95 80        LD      ($8095),A           ; {ram.reactionObjCode}
2777: C3 77 26        JP      $2677               ; {code.loc_2677}

; ==== UNREACHED 0x277a-0x2879 (256 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
277A:                 DEFB    $2A,$41,$C1,$C5,$95,$96,$97,$98,$99,$9A,$9B,$9C,$9D,$74,$75,$76
278A:                 DEFB    $77,$78,$79,$7A,$7B,$80,$81,$82,$83,$86,$87,$88,$89,$8B,$8C,$8D
279A:                 DEFB    $2A,$41,$C1,$C4,$95,$96,$97,$98,$99,$9A,$9B,$9C,$9D,$75,$76,$77
27AA:                 DEFB    $78,$79,$7A,$7B,$7C,$80,$81,$82,$86,$87,$88,$8B,$8C,$8D,$8F,$90
27BA:                 DEFB    $2A,$41,$C1,$C4,$95,$96,$97,$98,$99,$9A,$9B,$9C,$75,$76,$77,$78
27CA:                 DEFB    $79,$7A,$7B,$7C,$7D,$80,$81,$86,$87,$8B,$8C,$8F,$90,$92,$93,$00
27DA:                 DEFB    $2A,$41,$C1,$C4,$95,$96,$97,$98,$99,$9A,$9B,$77,$78,$79,$7A,$7B
27EA:                 DEFB    $7C,$7D,$7E,$80,$86,$8B,$8F,$92,$94,$00,$00,$00,$00,$00,$00,$00
27FA:                 DEFB    $2A,$41,$C1,$C4,$95,$96,$97,$98,$99,$9A,$78,$79,$7A,$7B,$7F,$00
280A:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
281A:                 DEFB    $2A,$41,$C1,$C5,$95,$96,$9A,$9B,$9C,$9D,$71,$72,$73,$74,$75,$76
282A:                 DEFB    $77,$78,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
283A:                 DEFB    $2A,$41,$C1,$C5,$95,$96,$97,$9A,$9B,$9C,$9D,$72,$73,$74,$75,$76
284A:                 DEFB    $77,$78,$79,$80,$81,$82,$83,$84,$85,$00,$00,$00,$00,$00,$00,$00
285A:                 DEFB    $2A,$41,$C1,$C5,$95,$96,$97,$98,$9A,$9B,$9C,$9D,$73,$74,$75,$76
286A:                 DEFB    $77,$78,$79,$7A,$80,$81,$82,$83,$84,$86,$87,$88,$89,$8A,$00,$00

; seedDigObjectBlock — seed the dig/target object control block at round start, then hand off to
; the round/level parameter-seeding chain. ROM 0x287a.
seedDigObjectBlock:
287A: 3E 30           LD      A,$30
287C: 32 AA 80        LD      ($80AA),A           ; {ram.hazardState}
287F: 3E 07           LD      A,$07
2881: 32 AB 80        LD      ($80AB),A           ; {ram.hazardType}
2884: 3E 00           LD      A,$00
2886: 32 A9 80        LD      ($80A9),A           ; {ram.hazardX}
2889: 32 AC 80        LD      ($80AC),A           ; {ram.hazardY}
288C: 32 B1 80        LD      ($80B1),A           ; {ram.digObjTimer}
288F: 32 BD 80        LD      ($80BD),A           ; {ram.hazardActiveCount}
2892: 32 C1 80        LD      ($80C1),A           ; {ram.digCollisionState}
2895: 32 C0 80        LD      ($80C0),A           ; {ram.digObjSubtype}
2898: 11 C3 80        LD      DE,$80C3            ; {ram.dropQueue}
289B: 21 AB 2D        LD      HL,$2DAB
289E: 01 18 00        LD      BC,$0018
28A1: ED B0           LDIR                        ; copy 0x18 bytes from ROM 0x2dab -> 0x80c3
28A3: 3E 20           LD      A,$20
28A5: 32 C2 80        LD      ($80C2),A
28A8: C3 2F 2F        JP      $2F2F               ; {code.seedChamberCreature} tail-jump: 0x2f2f's ret returns to loc_287a's caller

; spawnDigEntity — stage a dig entity at the actor's aligned tilemap cell, and commit it into the
; map the first pass the spawn slot is free. ROM 0x28ab.
spawnDigEntity:
28AB: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr}
28AF: DD 22 BA 80     LD      ($80BA),IX          ; {ram.stagedCellPtr}
28B3: 06 11           LD      B,$11
28B5: 2E 00           LD      L,$00
28B7: DD 5E FF        LD      E,(IX-$01)
28BA: DD 56 00        LD      D,(IX+$00)
28BD: 3E 70           LD      A,$70
28BF: BA              CP      D
28C0: 20 22           JR      NZ,$28E4            ; {code.loc_28e4}
28C2: 3E C1           LD      A,$C1
28C4: BB              CP      E
28C5: 28 12           JR      Z,$28D9             ; {code.loc_28d9}
28C7: 3E 95           LD      A,$95
28C9: BB              CP      E
28CA: 28 0D           JR      Z,$28D9             ; {code.loc_28d9}
28CC: 3E C5           LD      A,$C5
28CE: BB              CP      E
28CF: C0              RET     NZ                  ; E is none of 0xc1/0x95/0xc5: nothing to place
28D0: 3E 70           LD      A,$70
28D2: BA              CP      D
28D3: C0              RET     NZ                  ; (dead in practice: D is 0x70 on this arm, but modelled faithfully)
28D4: 06 15           LD      B,$15
28D6: 2C              INC     L
28D7: 18 1F           JR      $28F8               ; {code.loc_28f8}

loc_28d9:
28D9: DD 7E FE        LD      A,(IX-$02)
28DC: FE C1           CP      $C1
28DE: 20 18           JR      NZ,$28F8            ; {code.loc_28f8}
28E0: 2E 02           LD      L,$02               ; sub-type 2
28E2: 18 14           JR      $28F8               ; {code.loc_28f8}

loc_28e4:
28E4: 06 0D           LD      B,$0D
28E6: 3E C5           LD      A,$C5
28E8: BA              CP      D
28E9: C0              RET     NZ                  ; D neither 0x70 nor 0xc5: nothing to place
28EA: 3E C1           LD      A,$C1
28EC: BB              CP      E
28ED: 20 04           JR      NZ,$28F3            ; {code.loc_28f3}
28EF: 3E 9D           LD      A,$9D               ; sprite id 0x9d
28F1: 18 07           JR      $28FA               ; {code.loc_28fa}

loc_28f3:
28F3: 3E 2A           LD      A,$2A
28F5: BB              CP      E
28F6: 28 02           JR      Z,$28FA             ; {code.loc_28fa} keep A = 0x2a as the sprite id

loc_28f8:
28F8: 3E 70           LD      A,$70

loc_28fa:
28FA: 32 BF 80        LD      ($80BF),A           ; {ram.stagedDigSpriteId}
28FD: 7D              LD      A,L
28FE: 32 C0 80        LD      ($80C0),A           ; {ram.digObjSubtype}
2901: 3A 94 80        LD      A,($8094)           ; {ram.reactionObjX}
2904: D6 04           SUB     $04
2906: 32 B6 80        LD      ($80B6),A           ; {ram.stagedTargetX}
2909: 3A A2 80        LD      A,($80A2)           ; {ram.reactionState}
290C: FE 04           CP      $04                 ; sets the flag the jr nz below tests
290E: 3A 6B 80        LD      A,($806B)           ; {ram.playerX} a plain load; leaves the cp 0x04 flags intact
2911: 20 01           JR      NZ,$2914            ; {code.loc_2914}
2913: 3D              DEC     A                   ; bias Y by one when (0x80a2) == 4

loc_2914:
2914: C6 05           ADD     A,$05
2916: E6 F8           AND     $F8
2918: 90              SUB     B                   ; subtract the step count selected during classification
2919: 32 B9 80        LD      ($80B9),A           ; {ram.stagedTargetY}
291C: 3A A3 80        LD      A,($80A3)
291F: CB 27           SLA     A
2921: 32 BC 80        LD      ($80BC),A           ; {ram.stagedDigTimer}
2924: 3A BD 80        LD      A,($80BD)           ; {ram.hazardActiveCount}
2927: 3C              INC     A
2928: 32 BD 80        LD      ($80BD),A           ; {ram.hazardActiveCount}
292B: 3D              DEC     A                   ; Z reflects whether the ORIGINAL (0x80bd) was zero
292C: 28 06           JR      Z,$2934             ; {code.commitDigEntity}
292E: 3E 08           LD      A,$08
2930: 32 B1 80        LD      ($80B1),A           ; {ram.digObjTimer}
2933: C9              RET

; commitDigEntity — commit one dig entity into its tilemap cell and patch the neighbours. ROM
; 0x2934.
commitDigEntity:
2934: 3E 30           LD      A,$30
2936: 32 AA 80        LD      ($80AA),A           ; {ram.hazardState} commit state 0x30
2939: 3E 07           LD      A,$07
293B: 32 AB 80        LD      ($80AB),A           ; {ram.hazardType}
293E: DD 2A BA 80     LD      IX,($80BA)          ; {ram.stagedCellPtr} reload the saved object pointer
2942: DD 22 AF 80     LD      ($80AF),IX
2946: 3A B6 80        LD      A,($80B6)           ; {ram.stagedTargetX}
2949: 32 A9 80        LD      ($80A9),A           ; {ram.hazardX}
294C: 32 BE 80        LD      ($80BE),A
294F: 3A B9 80        LD      A,($80B9)           ; {ram.stagedTargetY}
2952: 32 AC 80        LD      ($80AC),A           ; {ram.hazardY}
2955: 3A BC 80        LD      A,($80BC)           ; {ram.stagedDigTimer}
2958: 32 B1 80        LD      ($80B1),A           ; {ram.digObjTimer}
295B: DD 5E FF        LD      E,(IX-$01)          ; OLD neighbour tile, captured BEFORE the overwrite below
295E: 3A BF 80        LD      A,($80BF)           ; {ram.stagedDigSpriteId}
2961: DD 77 FF        LD      (IX-$01),A          ; write the classified sprite id
2964: 3E 70           LD      A,$70
2966: DD 77 00        LD      (IX+$00),A
2969: 7B              LD      A,E                 ; classify the captured neighbour tile
296A: FE C1           CP      $C1
296C: 28 1C           JR      Z,$298A             ; {code.loc_298a}
296E: FE 95           CP      $95
2970: 28 18           JR      Z,$298A             ; {code.loc_298a}
2972: FE C5           CP      $C5
2974: 28 14           JR      Z,$298A             ; {code.loc_298a}
2976: FE 96           CP      $96
2978: D8              RET     C                   ; neighbour tile below 0x96: keep the just-written sprite id
2979: FE 9A           CP      $9A
297B: D0              RET     NC                  ; neighbour tile 0x9a or above: keep the just-written sprite id
297C: D6 96           SUB     $96                 ; index 0..3 into the 0x2dc3 tile-translation table
297E: 4F              LD      C,A
297F: 06 00           LD      B,$00
2981: 21 C3 2D        LD      HL,$2DC3
2984: 09              ADD     HL,BC
2985: 7E              LD      A,(HL)              ; the remapped tile
2986: DD 77 FF        LD      (IX-$01),A          ; overwrite (ix-0x01) with the table value
2989: C9              RET

loc_298a:
298A: 3A C0 80        LD      A,($80C0)           ; {ram.digObjSubtype}
298D: B7              OR      A
298E: C8              RET     Z                   ; sub-type 0: nothing more to commit
298F: FE 02           CP      $02
2991: 20 09           JR      NZ,$299C            ; {code.loc_299c}
2993: 3E 10           LD      A,$10
2995: 32 B1 80        LD      ($80B1),A           ; {ram.digObjTimer} arm state 0x10 for the sub-type-2 entity
2998: 3E 70           LD      A,$70
299A: 18 0D           JR      $29A9               ; {code.loc_29a9} write tile 0x70 to (ix-0x02)

loc_299c:
299C: DD 7E FE        LD      A,(IX-$02)
299F: D6 96           SUB     $96                 ; index into the 0x2dc3 tile-translation table
29A1: 4F              LD      C,A
29A2: 06 00           LD      B,$00
29A4: 21 C3 2D        LD      HL,$2DC3
29A7: 09              ADD     HL,BC
29A8: 7E              LD      A,(HL)

loc_29a9:
29A9: DD 77 FE        LD      (IX-$02),A
29AC: C9              RET

; advanceDigCarveObject — per-frame driver for the dig/carve object. ROM 0x29ad.
advanceDigCarveObject:
29AD: 3E 00           LD      A,$00
29AF: 32 80 80        LD      ($8080),A           ; {ram.moveBlockFlag} clear the vertical-overlap flag
29B2: 32 7F 80        LD      ($807F),A           ; {ram.carveSeamRight} clear the right-overlap flag
29B5: 32 7E 80        LD      ($807E),A           ; {ram.carveSeamLeft} clear the left-overlap flag
29B8: 3A 78 80        LD      A,($8078)           ; {ram.treasureCollected}
29BB: B7              OR      A
29BC: 28 15           JR      Z,$29D3             ; {code.loc_29d3} (0x8078) idle: skip the spawn gate
29BE: 3A 76 80        LD      A,($8076)           ; {ram.prizeGate}
29C1: B7              OR      A
29C2: 28 0F           JR      Z,$29D3             ; {code.loc_29d3} (0x8076) idle: skip the spawn gate
29C4: 3A BD 80        LD      A,($80BD)           ; {ram.hazardActiveCount}
29C7: B7              OR      A
29C8: CA F2 2B        JP      Z,$2BF2             ; {code.startNextDigSpawn} no projectile active: go spawn one
29CB: 3A AA 80        LD      A,($80AA)           ; {ram.hazardState}
29CE: FE 30           CP      $30
29D0: C2 B7 2C        JP      NZ,$2CB7            ; {code.captureTargetOnOverlap} projectile not in the carve phase: handle elsewhere

loc_29d3:
29D3: 3A BD 80        LD      A,($80BD)           ; {ram.hazardActiveCount}
29D6: B7              OR      A
29D7: CA 71 2F        JP      Z,$2F71             ; {code.advanceChamberCreature}
29DA: FE 02           CP      $02
29DC: 20 25           JR      NZ,$2A03            ; {code.loc_2a03}
29DE: 16 00           LD      D,$00
29E0: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
29E3: 47              LD      B,A
29E4: 3A B9 80        LD      A,($80B9)           ; {ram.stagedTargetY}
29E7: C6 0C           ADD     A,$0C
29E9: B8              CP      B
29EA: 20 13           JR      NZ,$29FF            ; {code.loc_29ff}
29EC: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
29EF: 4F              LD      C,A
29F0: 3A B6 80        LD      A,($80B6)           ; {ram.stagedTargetX}
29F3: E6 FE           AND     $FE
29F5: B9              CP      C
29F6: 30 07           JR      NC,$29FF            ; {code.loc_29ff}
29F8: C6 08           ADD     A,$08
29FA: B9              CP      C
29FB: 38 02           JR      C,$29FF             ; {code.loc_29ff}
29FD: 16 01           LD      D,$01

loc_29ff:
29FF: 7A              LD      A,D
2A00: 32 80 80        LD      ($8080),A           ; {ram.moveBlockFlag}

loc_2a03:
2A03: 3A B1 80        LD      A,($80B1)           ; {ram.digObjTimer}
2A06: A7              AND     A
2A07: CA B1 2A        JP      Z,$2AB1             ; {code.loc_2ab1}
2A0A: 3D              DEC     A
2A0B: 32 B1 80        LD      ($80B1),A           ; {ram.digObjTimer}
2A0E: 20 42           JR      NZ,$2A52            ; {code.loc_2a52}
2A10: 3A A9 80        LD      A,($80A9)           ; {ram.hazardX}
2A13: 3D              DEC     A
2A14: 32 A9 80        LD      ($80A9),A           ; {ram.hazardX}
2A17: 3A C1 80        LD      A,($80C1)           ; {ram.digCollisionState}
2A1A: A7              AND     A
2A1B: CA B1 2A        JP      Z,$2AB1             ; {code.loc_2ab1}
2A1E: 3A AC 80        LD      A,($80AC)           ; {ram.hazardY}
2A21: C6 08           ADD     A,$08
2A23: 32 AC 80        LD      ($80AC),A           ; {ram.hazardY}
2A26: CD 77 4C        CALL    $4C77               ; {code.requestSound10}
2A29: 3E 09           LD      A,$09
2A2B: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
2A2E: CD 5B 1B        CALL    $1B5B               ; {code.stageObjectSpriteRecord}
2A31: 3E 00           LD      A,$00
2A33: 32 BD 80        LD      ($80BD),A           ; {ram.hazardActiveCount}
2A36: 3E B4           LD      A,$B4
2A38: 32 7C 80        LD      ($807C),A           ; {ram.transitionTimer}
2A3B: 3A C0 80        LD      A,($80C0)           ; {ram.digObjSubtype}
2A3E: FE 02           CP      $02
2A40: C2 D3 2B        JP      NZ,$2BD3            ; {code.stageDigObjectSpriteRecord}
2A43: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr}
2A47: DD 36 FE C1     LD      (IX-$02),$C1
2A4B: DD 36 FD 70     LD      (IX-$03),$70
2A4F: C3 D3 2B        JP      $2BD3               ; {code.stageDigObjectSpriteRecord}

loc_2a52:
2A52: E6 07           AND     $07
2A54: 28 0F           JR      Z,$2A65             ; {code.loc_2a65}
2A56: E6 03           AND     $03
2A58: 20 2D           JR      NZ,$2A87            ; {code.loc_2a87}
2A5A: 3A A9 80        LD      A,($80A9)           ; {ram.hazardX}
2A5D: 3C              INC     A
2A5E: 32 A9 80        LD      ($80A9),A           ; {ram.hazardX}
2A61: 06 B7           LD      B,$B7
2A63: 18 09           JR      $2A6E               ; {code.loc_2a6e}

loc_2a65:
2A65: 3A A9 80        LD      A,($80A9)           ; {ram.hazardX}
2A68: 3D              DEC     A
2A69: 32 A9 80        LD      ($80A9),A           ; {ram.hazardX}
2A6C: 06 37           LD      B,$37

loc_2a6e:
2A6E: 3A C1 80        LD      A,($80C1)           ; {ram.digCollisionState}
2A71: B7              OR      A
2A72: 28 13           JR      Z,$2A87             ; {code.loc_2a87}
2A74: 78              LD      A,B
2A75: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
2A78: 3A C0 80        LD      A,($80C0)           ; {ram.digObjSubtype}
2A7B: FE 02           CP      $02
2A7D: 20 08           JR      NZ,$2A87            ; {code.loc_2a87}
2A7F: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr}
2A83: DD 36 FD C1     LD      (IX-$03),$C1

loc_2a87:
2A87: 3A 80 80        LD      A,($8080)           ; {ram.moveBlockFlag}
2A8A: 57              LD      D,A
2A8B: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
2A8E: 47              LD      B,A
2A8F: 3A AC 80        LD      A,($80AC)           ; {ram.hazardY}
2A92: C6 0C           ADD     A,$0C
2A94: B8              CP      B
2A95: 20 13           JR      NZ,$2AAA            ; {code.loc_2aaa}
2A97: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
2A9A: 4F              LD      C,A
2A9B: 3A A9 80        LD      A,($80A9)           ; {ram.hazardX}
2A9E: E6 FE           AND     $FE
2AA0: B9              CP      C
2AA1: 30 07           JR      NC,$2AAA            ; {code.loc_2aaa}
2AA3: C6 08           ADD     A,$08
2AA5: B9              CP      C
2AA6: 38 02           JR      C,$2AAA             ; {code.loc_2aaa}
2AA8: 16 01           LD      D,$01

loc_2aaa:
2AAA: 7A              LD      A,D
2AAB: 32 80 80        LD      ($8080),A           ; {ram.moveBlockFlag}
2AAE: C3 D3 2B        JP      $2BD3               ; {code.stageDigObjectSpriteRecord}

loc_2ab1:
2AB1: 3A C1 80        LD      A,($80C1)           ; {ram.digCollisionState}
2AB4: A7              AND     A
2AB5: 20 2F           JR      NZ,$2AE6            ; {code.loc_2ae6}
2AB7: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
2ABA: 47              LD      B,A
2ABB: 3A AC 80        LD      A,($80AC)           ; {ram.hazardY}
2ABE: C6 0A           ADD     A,$0A
2AC0: B8              CP      B
2AC1: 30 23           JR      NC,$2AE6            ; {code.loc_2ae6}
2AC3: C6 03           ADD     A,$03
2AC5: B8              CP      B
2AC6: 38 1E           JR      C,$2AE6             ; {code.loc_2ae6}
2AC8: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
2ACB: 4F              LD      C,A
2ACC: 3A A9 80        LD      A,($80A9)           ; {ram.hazardX}
2ACF: D6 03           SUB     $03
2AD1: B9              CP      C
2AD2: 30 12           JR      NC,$2AE6            ; {code.loc_2ae6}
2AD4: C6 0B           ADD     A,$0B
2AD6: B9              CP      C
2AD7: 38 0D           JR      C,$2AE6             ; {code.loc_2ae6}
2AD9: D6 04           SUB     $04
2ADB: 32 68 80        LD      ($8068),A           ; {ram.playerY}
2ADE: 3E 01           LD      A,$01
2AE0: 32 C1 80        LD      ($80C1),A           ; {ram.digCollisionState}
2AE3: C3 87 2A        JP      $2A87               ; {code.loc_2a87}

loc_2ae6:
2AE6: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
2AE9: 47              LD      B,A
2AEA: 3A AC 80        LD      A,($80AC)           ; {ram.hazardY}
2AED: D6 05           SUB     $05
2AEF: B8              CP      B
2AF0: 30 24           JR      NC,$2B16            ; {code.loc_2b16}
2AF2: C6 11           ADD     A,$11
2AF4: 38 20           JR      C,$2B16             ; {code.loc_2b16}
2AF6: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
2AF9: C6 03           ADD     A,$03
2AFB: E6 F8           AND     $F8
2AFD: 4F              LD      C,A
2AFE: 3A A9 80        LD      A,($80A9)           ; {ram.hazardX}
2B01: 3D              DEC     A
2B02: B9              CP      C
2B03: 28 0C           JR      Z,$2B11             ; {code.loc_2b11}
2B05: C6 10           ADD     A,$10
2B07: B9              CP      C
2B08: 20 0C           JR      NZ,$2B16            ; {code.loc_2b16}
2B0A: 3E 01           LD      A,$01
2B0C: 32 7E 80        LD      ($807E),A           ; {ram.carveSeamLeft}
2B0F: 18 05           JR      $2B16               ; {code.loc_2b16}

loc_2b11:
2B11: 3E 01           LD      A,$01
2B13: 32 7F 80        LD      ($807F),A           ; {ram.carveSeamRight}

loc_2b16:
2B16: 3A A9 80        LD      A,($80A9)           ; {ram.hazardX}
2B19: C6 07           ADD     A,$07
2B1B: CB 3F           SRL     A
2B1D: CB 3F           SRL     A
2B1F: CB 3F           SRL     A                   ; a = (row+7)>>3
2B21: ED 44           NEG
2B23: C6 1F           ADD     A,$1F               ; a = 0x1f - (row+7)>>3 (invert row into tilemap Y)
2B25: 67              LD      H,A
2B26: 3A AC 80        LD      A,($80AC)           ; {ram.hazardY}
2B29: C6 01           ADD     A,$01
2B2B: 32 AC 80        LD      ($80AC),A           ; {ram.hazardY} advance the dig column
2B2E: C6 09           ADD     A,$09
2B30: 5F              LD      E,A
2B31: CB 3F           SRL     A
2B33: CB 3F           SRL     A
2B35: CB 3F           SRL     A                   ; c = (col+9)>>3 (tilemap X)
2B37: 4F              LD      C,A
2B38: 3E 00           LD      A,$00
2B3A: 47              LD      B,A                 ; bc = tilemap X
2B3B: CB 3C           SRL     H
2B3D: 1F              RRA
2B3E: CB 3C           SRL     H
2B40: 1F              RRA
2B41: CB 3C           SRL     H
2B43: 1F              RRA                         ; (h:a) >>= 3 : hl = Y*32 (five-bit Y shifted into the high byte)
2B44: 6F              LD      L,A
2B45: 09              ADD     HL,BC               ; hl = Y*32 + X
2B46: 01 00 90        LD      BC,$9000            ; {hard.videoRam}
2B49: 09              ADD     HL,BC               ; hl = VRAM base + cell
2B4A: 22 AF 80        LD      ($80AF),HL
2B4D: DD 2A AF 80     LD      IX,($80AF)
2B51: 16 C1           LD      D,$C1
2B53: DD 7E 01        LD      A,(IX+$01)
2B56: FE 2A           CP      $2A
2B58: 28 52           JR      Z,$2BAC             ; {code.loc_2bac}
2B5A: FE 2B           CP      $2B
2B5C: 28 4E           JR      Z,$2BAC             ; {code.loc_2bac}
2B5E: FE C1           CP      $C1
2B60: 28 4A           JR      Z,$2BAC             ; {code.loc_2bac}
2B62: FE 95           CP      $95
2B64: 28 46           JR      Z,$2BAC             ; {code.loc_2bac}
2B66: FE C4           CP      $C4
2B68: 20 04           JR      NZ,$2B6E            ; {code.loc_2b6e}
2B6A: CB 53           BIT     2,E
2B6C: 20 36           JR      NZ,$2BA4            ; {code.loc_2ba4}

loc_2b6e:
2B6E: FE 71           CP      $71
2B70: 38 61           JR      C,$2BD3             ; {code.stageDigObjectSpriteRecord}
2B72: FE 9A           CP      $9A
2B74: 30 5D           JR      NC,$2BD3            ; {code.stageDigObjectSpriteRecord}
2B76: D6 71           SUB     $71
2B78: 06 00           LD      B,$00
2B7A: CB 27           SLA     A
2B7C: CB 27           SLA     A
2B7E: CB 27           SLA     A                   ; a = (tile-0x71)<<3, the high bit rotated into b next
2B80: CB 10           RL      B                   ; pull the shifted-out bit 8 into b (bc = (tile-0x71)*8)
2B82: 4F              LD      C,A
2B83: 7B              LD      A,E
2B84: E6 07           AND     $07
2B86: B1              OR      C
2B87: 4F              LD      C,A
2B88: 21 C7 2D        LD      HL,$2DC7
2B8B: 09              ADD     HL,BC
2B8C: 56              LD      D,(HL)              ; the translated tile
2B8D: 7A              LD      A,D
2B8E: A7              AND     A
2B8F: 20 0E           JR      NZ,$2B9F            ; {code.loc_2b9f}
2B91: 7B              LD      A,E
2B92: E6 07           AND     $07
2B94: FE 07           CP      $07
2B96: 20 3B           JR      NZ,$2BD3            ; {code.stageDigObjectSpriteRecord}
2B98: 3E 70           LD      A,$70
2B9A: DD 77 01        LD      (IX+$01),A
2B9D: 18 34           JR      $2BD3               ; {code.stageDigObjectSpriteRecord}

loc_2b9f:
2B9F: 7B              LD      A,E
2BA0: E6 07           AND     $07
2BA2: 28 08           JR      Z,$2BAC             ; {code.loc_2bac}

loc_2ba4:
2BA4: 7A              LD      A,D
2BA5: DD 77 01        LD      (IX+$01),A
2BA8: 3E C4           LD      A,$C4
2BAA: 18 02           JR      $2BAE               ; {code.loc_2bae}

loc_2bac:
2BAC: 3E C1           LD      A,$C1

loc_2bae:
2BAE: DD 77 00        LD      (IX+$00),A
2BB1: CD 9B 4C        CALL    $4C9B               ; {code.requestSound19}
2BB4: 3A BD 80        LD      A,($80BD)           ; {ram.hazardActiveCount}
2BB7: 3D              DEC     A
2BB8: 32 BD 80        LD      ($80BD),A           ; {ram.hazardActiveCount}
2BBB: C2 34 29        JP      NZ,$2934            ; {code.commitDigEntity} more projectiles pending: back to loc_28ab's commit path
2BBE: 3E 00           LD      A,$00
2BC0: 32 A9 80        LD      ($80A9),A           ; {ram.hazardX}
2BC3: 3E 09           LD      A,$09
2BC5: 32 AA 80        LD      ($80AA),A           ; {ram.hazardState}
2BC8: 3A C0 80        LD      A,($80C0)           ; {ram.digObjSubtype}
2BCB: FE 02           CP      $02
2BCD: 20 04           JR      NZ,$2BD3            ; {code.stageDigObjectSpriteRecord}
2BCF: DD 36 FF C1     LD      (IX-$01),$C1        ; then falls through into loc_2bd3

; stageDigObjectSpriteRecord — compose the dig object's sprite so it draws at its cell. ROM
; 0x2bd3.
stageDigObjectSpriteRecord:
2BD3: 21 28 82        LD      HL,$8228
2BD6: 3A 51 80        LD      A,($8051)           ; {ram.spriteCoordBias}
2BD9: 47              LD      B,A
2BDA: 3A A9 80        LD      A,($80A9)           ; {ram.hazardX}
2BDD: 90              SUB     B
2BDE: 77              LD      (HL),A
2BDF: 23              INC     HL
2BE0: 3A AA 80        LD      A,($80AA)           ; {ram.hazardState}
2BE3: 77              LD      (HL),A
2BE4: 23              INC     HL
2BE5: 3A AB 80        LD      A,($80AB)           ; {ram.hazardType}
2BE8: 77              LD      (HL),A
2BE9: 23              INC     HL
2BEA: 3A AC 80        LD      A,($80AC)           ; {ram.hazardY}
2BED: 80              ADD     A,B
2BEE: 77              LD      (HL),A
2BEF: C3 71 2F        JP      $2F71               ; {code.advanceChamberCreature} tail-jump: 0x2f71's ret returns to loc_2bd3's caller

; startNextDigSpawn — start the next queued dig-object spawn, or clear the spawn-active flag when
; nothing is queued. ROM 0x2bf2.
startNextDigSpawn:
2BF2: 21 C3 80        LD      HL,$80C3            ; {ram.dropQueue} point HL at the 24-entry pending table
2BF5: 06 18           LD      B,$18               ; scan count = 24 entries

loc_2bf7:
2BF7: 7E              LD      A,(HL)              ; current table entry
2BF8: A7              AND     A                   ; Z set iff the entry is zero (A unchanged)
2BF9: 20 09           JR      NZ,$2C04            ; {code.spawnPendingDigObject} non-zero entry found: hand off to the placement path
2BFB: 23              INC     HL                  ; advance to the next entry
2BFC: 10 F9           DJNZ    $2BF7               ; {code.loc_2bf7} decrement B (no flags), loop while entries remain
2BFE: 32 BD 80        LD      ($80BD),A           ; {ram.hazardActiveCount} A is 0 here: clear the pending flag
2C01: C3 71 2F        JP      $2F71               ; {code.advanceChamberCreature} tail-jump: 0x2f71's ret returns to loc_2bf2's caller

; spawnPendingDigObject — pop a random queued column and spawn a dig object there. ROM 0x2c04.
spawnPendingDigObject:
2C04: 3E 01           LD      A,$01
2C06: 32 BD 80        LD      ($80BD),A           ; {ram.hazardActiveCount} raise the "active" flag
2C09: CD 97 4C        CALL    $4C97               ; {code.requestSound18} leaf side effect; resumes in-line
2C0C: 3E 10           LD      A,$10
2C0E: 32 AA 80        LD      ($80AA),A           ; {ram.hazardState} record byte 2
2C11: 3E 06           LD      A,$06
2C13: 32 AB 80        LD      ($80AB),A           ; {ram.hazardType} record byte 3
2C16: 3A C2 80        LD      A,($80C2)
2C19: 32 B1 80        LD      ($80B1),A           ; {ram.digObjTimer} copy a lifetime/limit byte

loc_2c1c:
2C1C: CD 1A 4B        CALL    $4B1A               ; {code.advanceRandom} RNG leaf; returns a fresh random byte in A
2C1F: E6 1F           AND     $1F                 ; mask to 0..31
2C21: FE 18           CP      $18                 ; reject 24..31
2C23: 30 F7           JR      NC,$2C1C            ; {code.loc_2c1c} out of range: draw again
2C25: 47              LD      B,A                 ; b = column/slot index
2C26: 5F              LD      E,A
2C27: 16 00           LD      D,$00               ; de = index
2C29: 21 C3 80        LD      HL,$80C3            ; {ram.dropQueue} table base
2C2C: 19              ADD     HL,DE               ; hl = &table[index]
2C2D: 7E              LD      A,(HL)              ; slot value
2C2E: A7              AND     A                   ; Z iff the slot is empty
2C2F: 28 EB           JR      Z,$2C1C             ; {code.loc_2c1c} empty slot: draw again
2C31: 4F              LD      C,A                 ; c = chosen slot value
2C32: 7B              LD      A,E                 ; a = column index
2C33: FE 0C           CP      $0C                 ; left half (< 12) vs right half
2C35: 30 12           JR      NC,$2C49            ; {code.loc_2c49} right half: keep this slot, skip the pairing check
2C37: 1E 0C           LD      E,$0C               ; de = 0x000c (d still 0)
2C39: 19              ADD     HL,DE               ; hl = &pairedRightSlot (index + 0x0c)
2C3A: 7E              LD      A,(HL)              ; the paired right slot value
2C3B: A7              AND     A                   ; Z iff the pair is empty
2C3C: 20 06           JR      NZ,$2C44            ; {code.loc_2c44} pair non-empty: switch to it
2C3E: 11 F4 FF        LD      DE,$FFF4            ; -0x0c
2C41: 19              ADD     HL,DE               ; back HL to the original (left) slot
2C42: 18 05           JR      $2C49               ; {code.loc_2c49}

loc_2c44:
2C44: 4F              LD      C,A                 ; c = paired slot value
2C45: 78              LD      A,B
2C46: C6 0C           ADD     A,$0C               ; move column into the right half
2C48: 47              LD      B,A

loc_2c49:
2C49: 3E 00           LD      A,$00
2C4B: 77              LD      (HL),A              ; clear the chosen slot
2C4C: 79              LD      A,C
2C4D: C6 01           ADD     A,$01               ; value + 1
2C4F: 32 A9 80        LD      ($80A9),A           ; {ram.hazardX} record byte 1
2C52: 78              LD      A,B                 ; a = column index
2C53: FE 0C           CP      $0C                 ; carry set iff left half (< 12)
2C55: 3E B7           LD      A,$B7               ; left-half column base (flags untouched)
2C57: 38 02           JR      C,$2C5B             ; {code.loc_2c5b} left half: keep 0xb7
2C59: 3E BF           LD      A,$BF               ; right-half column base

loc_2c5b:
2C5B: 32 AC 80        LD      ($80AC),A           ; {ram.hazardY} column base
2C5E: 3A A9 80        LD      A,($80A9)           ; {ram.hazardX}
2C61: CB 3F           SRL     A
2C63: CB 3F           SRL     A
2C65: CB 3F           SRL     A                   ; a = row >> 3
2C67: ED 44           NEG
2C69: C6 1F           ADD     A,$1F               ; a = 0x1f - (row>>3): invert row into tilemap Y
2C6B: 67              LD      H,A
2C6C: 3A AC 80        LD      A,($80AC)           ; {ram.hazardY}
2C6F: 3C              INC     A
2C70: 5F              LD      E,A
2C71: CB 3F           SRL     A
2C73: CB 3F           SRL     A
2C75: CB 3F           SRL     A                   ; c = (col+1) >> 3 (tilemap X)
2C77: 4F              LD      C,A
2C78: 3E 00           LD      A,$00
2C7A: 47              LD      B,A                 ; bc = tilemap X
2C7B: CB 3C           SRL     H
2C7D: 1F              RRA
2C7E: CB 3C           SRL     H
2C80: 1F              RRA
2C81: CB 3C           SRL     H
2C83: 1F              RRA                         ; (h:a) >>= 3 : hl = Y * 32
2C84: 6F              LD      L,A
2C85: 09              ADD     HL,BC               ; hl = Y*32 + X
2C86: 01 00 90        LD      BC,$9000            ; {hard.videoRam}
2C89: 09              ADD     HL,BC               ; + VRAM base
2C8A: 3E 25           LD      A,$25               ; tile code to paint
2C8C: 01 E1 FF        LD      BC,$FFE1            ; -0x1f
2C8F: 09              ADD     HL,BC               ; final cell address
2C90: 77              LD      (HL),A              ; paint tile 0x25 into the cell

; flagObjectTargetOverlap — flag whether the freshly-placed target cell coincides with the tracked
; object, then hand off to build the cell's record. ROM 0x2c91.
flagObjectTargetOverlap:
2C91: 16 00           LD      D,$00               ; default: no overlap
2C93: 3A 6B 80        LD      A,($806B)           ; {ram.playerX} tracked object coord (row band)
2C96: 47              LD      B,A
2C97: 3A AC 80        LD      A,($80AC)           ; {ram.hazardY} cell column base
2C9A: C6 0C           ADD     A,$0C
2C9C: B8              CP      B                   ; same row band?
2C9D: 20 11           JR      NZ,$2CB0            ; {code.loc_2cb0} different band: leave d = 0
2C9F: 3A 68 80        LD      A,($8068)           ; {ram.playerY} tracked object X
2CA2: 4F              LD      C,A
2CA3: 3A A9 80        LD      A,($80A9)           ; {ram.hazardX} cell row/X value
2CA6: B9              CP      C
2CA7: 30 07           JR      NC,$2CB0            ; {code.loc_2cb0} object not to the right of the cell: leave d = 0
2CA9: C6 08           ADD     A,$08               ; top of the 8-pixel window
2CAB: B9              CP      C
2CAC: 38 02           JR      C,$2CB0             ; {code.loc_2cb0} object beyond the 8-pixel window: leave d = 0
2CAE: 16 01           LD      D,$01               ; overlap detected

loc_2cb0:
2CB0: 7A              LD      A,D
2CB1: 32 80 80        LD      ($8080),A           ; {ram.moveBlockFlag} publish the overlap flag
2CB4: C3 D3 2B        JP      $2BD3               ; {code.stageDigObjectSpriteRecord} tail-jump: 0x2bd3's ret returns to loc_2c91's caller

; captureTargetOnOverlap — tick the dig target's countdown and, on expiry, snap the tracked object
; onto the target when it overlaps, marking the target captured. ROM 0x2cb7.
captureTargetOnOverlap:
2CB7: 3E 00           LD      A,$00
2CB9: 32 80 80        LD      ($8080),A           ; {ram.moveBlockFlag} clear the per-tick overlap/capture flag
2CBC: 3A B1 80        LD      A,($80B1)           ; {ram.digObjTimer} the countdown byte
2CBF: FE 40           CP      $40                 ; has the countdown reached the reload sentinel?
2CC1: CA 6B 2D        JP      Z,$2D6B             ; {code.stampGlyphColumn} yes: tail-jump to the 0x2d6b reload/reset path
2CC4: 3D              DEC     A                   ; otherwise tick the countdown down by one
2CC5: 32 B1 80        LD      ($80B1),A           ; {ram.digObjTimer} store it back (ld (nn),a preserves dec's Z)
2CC8: C2 91 2C        JP      NZ,$2C91            ; {code.flagObjectTargetOverlap} not expired: tail-jump into the shared overlap-record tail
2CCB: 3E 01           LD      A,$01
2CCD: 32 B1 80        LD      ($80B1),A           ; {ram.digObjTimer} expired: reload the countdown to 1
2CD0: 3A C1 80        LD      A,($80C1)           ; {ram.digCollisionState} the "already captured" flag
2CD3: A7              AND     A                   ; Z iff not yet captured
2CD4: 20 30           JR      NZ,$2D06            ; {code.advanceDigTarget} already captured: tail-jump out
2CD6: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
2CD9: 47              LD      B,A                 ; b = tracked object byte 0x806b
2CDA: 3A AC 80        LD      A,($80AC)           ; {ram.hazardY}
2CDD: C6 0A           ADD     A,$0A               ; lower edge of window A
2CDF: B8              CP      B
2CE0: 30 24           JR      NC,$2D06            ; {code.advanceDigTarget} (0x80ac)+0x0a >= (0x806b): below the window -> out
2CE2: C6 03           ADD     A,$03               ; a = (0x80ac)+0x0d, upper edge of window A
2CE4: B8              CP      B
2CE5: 38 1F           JR      C,$2D06             ; {code.advanceDigTarget} (0x80ac)+0x0d < (0x806b): above the window -> out
2CE7: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
2CEA: 4F              LD      C,A                 ; c = tracked object byte 0x8068
2CEB: 3A A9 80        LD      A,($80A9)           ; {ram.hazardX}
2CEE: D6 04           SUB     $04                 ; lower edge of window B
2CF0: B9              CP      C
2CF1: 30 13           JR      NC,$2D06            ; {code.advanceDigTarget} (0x80a9)-0x04 >= (0x8068): below the window -> out
2CF3: C6 08           ADD     A,$08               ; a = (0x80a9)+0x04, upper edge of window B
2CF5: B9              CP      C
2CF6: 38 0E           JR      C,$2D06             ; {code.advanceDigTarget} (0x80a9)+0x04 < (0x8068): above the window -> out
2CF8: 32 68 80        LD      ($8068),A           ; {ram.playerY} CAPTURE: snap the object X onto (0x80a9)+0x04
2CFB: 3E 01           LD      A,$01
2CFD: 32 C1 80        LD      ($80C1),A           ; {ram.digCollisionState} raise the "captured" flag
2D00: CD 9F 4C        CALL    $4C9F               ; {code.requestSound20} leaf side effect; resumes in-line
2D03: C3 D3 2B        JP      $2BD3               ; {code.stageDigObjectSpriteRecord} tail-jump: 0x2bd3's ret returns to loc_2cb7's caller

; advanceDigTarget — advance the dig target one step and route on the tile it now covers: embed it
; into the terrain when it reaches solid ground, else just re-stage its sprite. ROM 0x2d06.
advanceDigTarget:
2D06: 3A A9 80        LD      A,($80A9)           ; {ram.hazardX} target X (pixel)
2D09: CB 3F           SRL     A
2D0B: CB 3F           SRL     A
2D0D: CB 3F           SRL     A                   ; a = X >> 3 (tile column)
2D0F: ED 44           NEG
2D11: C6 1F           ADD     A,$1F               ; a = 0x1f - (X>>3): column measured from the right edge
2D13: 67              LD      H,A
2D14: 3A AC 80        LD      A,($80AC)           ; {ram.hazardY} target Y (pixel)
2D17: C6 01           ADD     A,$01               ; advance Y by one
2D19: 32 AC 80        LD      ($80AC),A           ; {ram.hazardY} store the advanced Y back (touches no flags)
2D1C: 3C              INC     A                   ; a = Y+2
2D1D: 5F              LD      E,A
2D1E: CB 3F           SRL     A
2D20: CB 3F           SRL     A
2D22: CB 3F           SRL     A                   ; a = (Y+2) >> 3 (tile row)
2D24: 4F              LD      C,A
2D25: 3E 00           LD      A,$00
2D27: 47              LD      B,A                 ; bc = (Y+2) >> 3 (tile row)
2D28: CB 3C           SRL     H                   ; bit 0 of h -> carry
2D2A: 1F              RRA                         ; carry -> bit 7 of a
2D2B: CB 3C           SRL     H
2D2D: 1F              RRA
2D2E: CB 3C           SRL     H
2D30: 1F              RRA                         ; three srl/rra pairs shift h's low 3 bits down into the top of a
2D31: 6F              LD      L,A
2D32: 09              ADD     HL,BC               ; fold in the tile row
2D33: 01 00 90        LD      BC,$9000            ; {hard.videoRam} video-RAM base
2D36: 09              ADD     HL,BC               ; hl = video-RAM tile cell
2D37: 22 AF 80        LD      ($80AF),HL          ; stash the computed cell address
2D3A: DD 2A AF 80     LD      IX,($80AF)          ; reload it into ix for indexed access
2D3E: DD 7E E2        LD      A,(IX-$1E)          ; the probed tile, a fixed offset from the cell
2D41: FE 2A           CP      $2A
2D43: 28 09           JR      Z,$2D4E             ; {code.landDigTarget} tile 0x2a -> tail-jump to loc_2d4e
2D45: FE 2B           CP      $2B
2D47: 28 05           JR      Z,$2D4E             ; {code.landDigTarget} tile 0x2b -> tail-jump to loc_2d4e
2D49: FE 41           CP      $41
2D4B: C2 D3 2B        JP      NZ,$2BD3            ; {code.stageDigObjectSpriteRecord} tile is none of 0x2a/0x2b/0x41 -> tail-jump to loc_2bd3

; landDigTarget — land the descending dig/capture target when it reaches terrain. ROM 0x2d4e.
landDigTarget:
2D4E: CD 93 4C        CALL    $4C93               ; {code.requestSound17} request sound 0x11; pushes 0x2d51, resumes in-line
2D51: 3E 41           LD      A,$41               ; the tile code to stamp
2D53: DD 77 E1        LD      (IX-$1F),A          ; stamp tile 0x41 into the cell just before (ix-0x1e)
2D56: 3E 00           LD      A,$00
2D58: 32 BD 80        LD      ($80BD),A           ; {ram.hazardActiveCount} clear 0x80bd
2D5B: 32 A9 80        LD      ($80A9),A           ; {ram.hazardX} clear the target/prize X byte 0x80a9
2D5E: 3E 09           LD      A,$09
2D60: 32 AA 80        LD      ($80AA),A           ; {ram.hazardState} seed 0x80aa = 0x09
2D63: 3E 07           LD      A,$07
2D65: 32 AB 80        LD      ($80AB),A           ; {ram.hazardType} seed 0x80ab = 0x07
2D68: C3 D3 2B        JP      $2BD3               ; {code.stageDigObjectSpriteRecord} tail-jump: 0x2bd3's ret returns to loc_2d4e's caller

; stampGlyphColumn — stamp the fixed five-tile glyph down the object's map column, paint its
; colour column, re-arm the object's state timer, then hand off to the background-animation
; update. ROM 0x2d6b.
stampGlyphColumn:
2D6B: DD 2A 6E 80     LD      IX,($806E)          ; {ram.playerCellPtr} the object/tilemap pointer for this glyph
2D6F: 3E 23           LD      A,$23
2D71: DD 77 3F        LD      (IX+$3F),A          ; tile code 0x23
2D74: 3E 18           LD      A,$18
2D76: DD 77 1F        LD      (IX+$1F),A          ; tile code 0x18
2D79: 3E 17           LD      A,$17
2D7B: DD 77 FF        LD      (IX-$01),A          ; tile code 0x17
2D7E: 3E 14           LD      A,$14
2D80: DD 77 DF        LD      (IX-$21),A          ; tile code 0x14
2D83: 3E 3E           LD      A,$3E
2D85: DD 77 BF        LD      (IX-$41),A          ; tile code 0x3e
2D88: 2A 6E 80        LD      HL,($806E)          ; {ram.playerCellPtr} same pointer word, now for the colour column
2D8B: 01 00 F8        LD      BC,$F800
2D8E: 11 BF FF        LD      DE,$FFBF
2D91: 09              ADD     HL,BC
2D92: 19              ADD     HL,DE               ; HL = (0x806e) + 0xf800 + 0xffbf = pointer - 0x0841
2D93: 11 20 00        LD      DE,$0020            ; column stride (one tilemap column apart)
2D96: 3E 06           LD      A,$06               ; colour value written to every cell
2D98: 06 05           LD      B,$05               ; 5 cells

loc_2d9a:
2D9A: 77              LD      (HL),A
2D9B: 19              ADD     HL,DE               ; advance one column
2D9C: 10 FC           DJNZ    $2D9A               ; {code.loc_2d9a} decrement B (no flags), loop while cells remain
2D9E: 3E 00           LD      A,$00
2DA0: 32 78 80        LD      ($8078),A           ; {ram.treasureCollected} reset state byte 0x8078 to 0
2DA3: 3E B4           LD      A,$B4
2DA5: 32 7C 80        LD      ($807C),A           ; {ram.transitionTimer} reset state byte 0x807c to 0xb4
2DA8: C3 71 2F        JP      $2F71               ; {code.advanceChamberCreature} tail-jump: 0x2f71's ret returns to loc_2d6b's caller

; ==== UNREACHED 0x2dab-0x2f2e (388 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
2DAB:                 DEFB    $50,$58,$60,$68,$70,$78,$80,$88,$90,$98,$A0,$A8,$50,$58,$60,$68
2DBB:                 DEFB    $70,$78,$80,$88,$90,$98,$A0,$A8,$74,$83,$89,$8E,$00,$00,$00,$00
2DCB:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$73,$00,$00,$00
2DDB:                 DEFB    $00,$00,$00,$00,$74,$00,$00,$00,$00,$00,$00,$00,$75,$00,$00,$00
2DEB:                 DEFB    $00,$00,$00,$00,$76,$00,$00,$00,$00,$00,$00,$00,$77,$00,$00,$00
2DFB:                 DEFB    $00,$00,$00,$00,$78,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
2E0B:                 DEFB    $9A,$9A,$9A,$9A,$00,$00,$00,$00,$9A,$9A,$9A,$9A,$00,$00,$00,$00
2E1B:                 DEFB    $9A,$9A,$9A,$9A,$00,$00,$00,$00,$9A,$9A,$9A,$9A,$00,$00,$00,$00
2E2B:                 DEFB    $9A,$9A,$9A,$9A,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
2E3B:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$9B,$9B,$9B,$9B,$00,$00,$00,$00
2E4B:                 DEFB    $9C,$9C,$9C,$9C,$00,$00,$00,$00,$9D,$9D,$9D,$9D,$00,$00,$00,$00
2E5B:                 DEFB    $9D,$9D,$9D,$9D,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
2E6B:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$9B,$9B,$9B,$9B,$00,$00,$00,$00
2E7B:                 DEFB    $9C,$9C,$9C,$9C,$00,$00,$00,$00,$9D,$9D,$9D,$9D,$00,$00,$00,$00
2E8B:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
2E9B:                 DEFB    $9B,$9B,$9B,$9B,$00,$00,$00,$00,$9C,$9C,$9C,$9C,$00,$00,$00,$00
2EAB:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
2EBB:                 DEFB    $9B,$9B,$9B,$9B,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
2ECB:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
2EDB:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$95,$95,$00,$00
2EEB:                 DEFB    $00,$00,$00,$00,$96,$96,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
2EFB:                 DEFB    $C1,$C1,$C1,$C1,$00,$00,$00,$00,$C1,$C1,$C1,$C1,$00,$00,$00,$00
2F0B:                 DEFB    $C1,$C1,$C1,$C1,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
2F1B:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
2F2B:                 DEFB    $00,$00,$00,$00

; seedChamberCreature — seed the left-chamber creature + Pit sliding-floor-reveal parameters (the
; first block of round/level setup), derive the reveal-period byte, then hand off to
; seedEnemyRecords. ROM 0x2f2f. (§2.8)
seedChamberCreature:
2F2F: 3E 39           LD      A,$39
2F31: 32 DC 80        LD      ($80DC),A           ; {ram.chamberCreatureFrame}
2F34: 3E 28           LD      A,$28
2F36: 32 DB 80        LD      ($80DB),A           ; {ram.chamberCreatureX}
2F39: 3E 78           LD      A,$78
2F3B: 32 DE 80        LD      ($80DE),A           ; {ram.chamberCreatureFallY}
2F3E: 3E C0           LD      A,$C0
2F40: 32 DD 80        LD      ($80DD),A           ; {ram.chamberCreatureAttr}
2F43: 3E 01           LD      A,$01
2F45: 32 DF 80        LD      ($80DF),A
2F48: 3E FC           LD      A,$FC
2F4A: 32 E0 80        LD      ($80E0),A
2F4D: 3E 01           LD      A,$01
2F4F: 32 E3 80        LD      ($80E3),A           ; {ram.chamberCreatureAnimPhase}
2F52: 32 E5 80        LD      ($80E5),A           ; {ram.pitFloorRevealGate} same A (0x01) reused as the second counter's reload
2F55: 3E 00           LD      A,$00
2F57: 32 E7 80        LD      ($80E7),A           ; {ram.goalTileLatch}
2F5A: 3E 96           LD      A,$96
2F5C: 32 E6 80        LD      ($80E6),A           ; {ram.pitFloorRevealCursor}
2F5F: 3A 28 80        LD      A,($8028)           ; {ram.level} the level/difficulty counter
2F62: 3C              INC     A                   ; (inc8 leaves carry alone; the cp below sets it)
2F63: FE 04           CP      $04                 ; carry set iff A < 4
2F65: 38 02           JR      C,$2F69             ; {code.loc_2f69} A<4: skip the cap; A>=4: clamp to 4
2F67: 3E 04           LD      A,$04

loc_2f69:
2F69: EE 07           XOR     $07
2F6B: 32 E4 80        LD      ($80E4),A           ; {ram.pitFloorRevealPeriod} the derived animation reload byte
2F6E: C3 DE 30        JP      $30DE               ; {code.seedEnemyRecords} unconditional tail-jump; loc_30de's ret returns to OUR caller

; advanceChamberCreature — per-frame driver for the left-chamber creature's sprite (§2.8): bounce
; it sideways within a fixed band, accelerate its own fall-Y until it hits the floor and RNG-
; resets, cycle its sprite frame, publish its screen-relative sprite record, and — once the goal-
; zone latch is set — dissolve one more column of the Pit sliding-floor reveal into view. ROM
; 0x2f71.
advanceChamberCreature:
2F71: 3A E7 80        LD      A,($80E7)           ; {ram.goalTileLatch} the enable flag
2F74: A7              AND     A
2F75: CA C0 2F        JP      Z,$2FC0             ; {code.advanceChamberCreatureAnimation} disabled: skip the whole reveal stage
2F78: 3A 77 80        LD      A,($8077)           ; {ram.pitCrossActive}
2F7B: A7              AND     A
2F7C: 28 0A           JR      Z,$2F88             ; {code.revealTerrainColumn}
2F7E: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
2F81: FE 6B           CP      $6B
2F83: 20 03           JR      NZ,$2F88            ; {code.revealTerrainColumn}
2F85: CD 7B 4C        CALL    $4C7B               ; {code.requestSound11}

; revealTerrainColumn — reveal the next column of the scrolling terrain backdrop on its frame
; gate, then hand off to the background phase clock. ROM 0x2f88.
revealTerrainColumn:
2F88: 3A E5 80        LD      A,($80E5)           ; {ram.pitFloorRevealGate} the per-column frame-gate countdown
2F8B: 3D              DEC     A
2F8C: 32 E5 80        LD      ($80E5),A           ; {ram.pitFloorRevealGate} store the decremented gate
2F8F: 20 2F           JR      NZ,$2FC0            ; {code.advanceChamberCreatureAnimation} gate not yet 0: skip this step, delegate to loc_2fc0
2F91: 3A E4 80        LD      A,($80E4)           ; {ram.pitFloorRevealPeriod} reload the reveal counter from (0x80e4)
2F94: 32 E5 80        LD      ($80E5),A           ; {ram.pitFloorRevealGate} reload the gate
2F97: 3A E6 80        LD      A,($80E6)           ; {ram.pitFloorRevealCursor} the table cursor (byte offset into 0x3048)
2F9A: D6 06           SUB     $06                 ; step the cursor back one 6-tile column (sets carry on underflow)
2F9C: 38 22           JR      C,$2FC0             ; {code.advanceChamberCreatureAnimation} cursor underflowed past the table start: skip, delegate
2F9E: 32 E6 80        LD      ($80E6),A           ; {ram.pitFloorRevealCursor} store the advanced cursor
2FA1: 5F              LD      E,A
2FA2: 16 00           LD      D,$00               ; DE = the row index (0..0xff)
2FA4: 21 48 30        LD      HL,$3048            ; base of the tile-pattern table
2FA7: 19              ADD     HL,DE               ; hl = &table[cursor]
2FA8: 22 E1 80        LD      ($80E1),HL          ; stash the source pointer
2FAB: DD 2A E1 80     LD      IX,($80E1)          ; ix = the source pointer (same value, reloaded via memory)
2FAF: 21 8C 93        LD      HL,$938C            ; {hard.videoRam} destination: bottom cell of a video-RAM column
2FB2: 11 E0 FF        LD      DE,$FFE0            ; -0x20: walk one tile-row UP per byte written
2FB5: 06 06           LD      B,$06               ; 6 tiles in the column

; drawTerrainColumn — write one vertical strip of tiles up a backdrop column, then tick the
; animation clock. ROM 0x2fb7.
drawTerrainColumn:
2FB7: DD 7E 00        LD      A,(IX+$00)          ; next table byte
2FBA: 77              LD      (HL),A              ; store into the tilemap cell
2FBB: 19              ADD     HL,DE               ; step dest by DE (-0x20 -> one row up)
2FBC: DD 23           INC     IX                  ; advance the source pointer
2FBE: 10 F7           DJNZ    $2FB7               ; {code.drawTerrainColumn} decrement B (no flags), loop while non-zero

; advanceChamberCreatureAnimation — the per-frame phase clock for the chamber creature's sprite-
; flip animation: tick the phase countdown and route the frame to one of three shared
; continuations. ROM 0x2fc0. (§2.8)
advanceChamberCreatureAnimation:
2FC0: 3A E3 80        LD      A,($80E3)           ; {ram.chamberCreatureAnimPhase} load the animation phase countdown
2FC3: 3D              DEC     A                   ; advance it (dec8 sets Z; the jr below branches on it)
2FC4: 32 E3 80        LD      ($80E3),A           ; {ram.chamberCreatureAnimPhase} write the decremented counter back
2FC7: 20 15           JR      NZ,$2FDE            ; {code.loc_2fde} counter not expired: take the still-running path (loc_2fde)
2FC9: 3E 08           LD      A,$08
2FCB: 32 E3 80        LD      ($80E3),A           ; {ram.chamberCreatureAnimPhase} reload the phase countdown to 8
2FCE: 3A DC 80        LD      A,($80DC)           ; {ram.chamberCreatureFrame} the current animation tile byte
2FD1: 47              LD      B,A
2FD2: 3E 38           LD      A,$38
2FD4: B8              CP      B                   ; is the current tile already 0x38?
2FD5: 20 02           JR      NZ,$2FD9            ; {code.setChamberCreatureFrame} tile != 0x38: keep A=0x38, commit via loc_2fd9
2FD7: 3E 39           LD      A,$39

; setChamberCreatureFrame — commit the chosen chamber-creature sprite-flip tile, then hand off to
; the shared animation-update tail. ROM 0x2fd9. (§2.8)
setChamberCreatureFrame:
2FD9: 32 DC 80        LD      ($80DC),A           ; {ram.chamberCreatureFrame} commit the caller's toggled tile byte (0x38/0x39)
2FDC: 18 05           JR      $2FE3               ; {code.loc_2fe3} unconditional tail-jump; loc_2fe3's ret returns to OUR caller

loc_2fde:
2FDE: E6 03           AND     $03                 ; every-4th-frame gate on the running counter
2FE0: C2 29 30        JP      NZ,$3029            ; {code.loc_3029} off-phase: skip the wave step, jump straight to the tail

loc_2fe3:
2FE3: 3A DF 80        LD      A,($80DF)
2FE6: 4F              LD      C,A
2FE7: 3A DB 80        LD      A,($80DB)           ; {ram.chamberCreatureX}
2FEA: 81              ADD     A,C
2FEB: 32 DB 80        LD      ($80DB),A           ; {ram.chamberCreatureX}
2FEE: FE 38           CP      $38
2FF0: 38 04           JR      C,$2FF6             ; {code.loc_2ff6}
2FF2: 3E FF           LD      A,$FF
2FF4: 18 06           JR      $2FFC               ; {code.loc_2ffc}

loc_2ff6:
2FF6: FE 19           CP      $19
2FF8: 30 05           JR      NC,$2FFF            ; {code.loc_2fff} x in [0x19,0x38): leave velocity unchanged
2FFA: 3E 01           LD      A,$01

loc_2ffc:
2FFC: 32 DF 80        LD      ($80DF),A

loc_2fff:
2FFF: 3A E0 80        LD      A,($80E0)
3002: 3C              INC     A                   ; accelerate the step
3003: 32 E0 80        LD      ($80E0),A
3006: 47              LD      B,A
3007: 3A DE 80        LD      A,($80DE)           ; {ram.chamberCreatureFallY}
300A: 80              ADD     A,B
300B: 32 DE 80        LD      ($80DE),A           ; {ram.chamberCreatureFallY}
300E: FE 86           CP      $86
3010: 38 17           JR      C,$3029             ; {code.loc_3029} still on-screen: straight to publish
3012: 3E 86           LD      A,$86
3014: 32 DE 80        LD      ($80DE),A           ; {ram.chamberCreatureFallY} clamp y
3017: CD 1A 4B        CALL    $4B1A               ; {code.advanceRandom}
301A: F6 F8           OR      $F8
301C: 3D              DEC     A
301D: 32 E0 80        LD      ($80E0),A           ; reset the accelerating step
3020: 3A DD 80        LD      A,($80DD)           ; {ram.chamberCreatureAttr}
3023: 3C              INC     A
3024: E6 F7           AND     $F7                 ; clear bit 3
3026: 32 DD 80        LD      ($80DD),A           ; {ram.chamberCreatureAttr}

loc_3029:
3029: 21 2C 82        LD      HL,$822C
302C: 3A 51 80        LD      A,($8051)           ; {ram.spriteCoordBias} hero/camera x
302F: 47              LD      B,A
3030: 3A DB 80        LD      A,($80DB)           ; {ram.chamberCreatureX}
3033: 90              SUB     B                   ; x - camera
3034: 77              LD      (HL),A
3035: 23              INC     HL
3036: 3A DC 80        LD      A,($80DC)           ; {ram.chamberCreatureFrame}
3039: 77              LD      (HL),A              ; sprite frame
303A: 23              INC     HL
303B: 3A DD 80        LD      A,($80DD)           ; {ram.chamberCreatureAttr}
303E: 77              LD      (HL),A
303F: 23              INC     HL
3040: 3A DE 80        LD      A,($80DE)           ; {ram.chamberCreatureFallY}
3043: 80              ADD     A,B                 ; y + camera
3044: 77              LD      (HL),A
3045: C3 2D 31        JP      $312D               ; {code.updateEnemy1} unconditional tail-jump; loc_312d's ret returns to OUR caller

; ==== UNREACHED 0x3048-0x30dd (150 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
3048:                 DEFB    $27,$27,$27,$27,$27,$27,$39,$27,$27,$27,$27,$27,$38,$27,$27,$27
3058:                 DEFB    $27,$27,$37,$27,$27,$27,$27,$27,$36,$27,$27,$27,$27,$27,$36,$39
3068:                 DEFB    $27,$27,$27,$27,$36,$38,$27,$27,$27,$27,$36,$37,$27,$27,$27,$27
3078:                 DEFB    $36,$36,$27,$27,$27,$27,$36,$36,$39,$27,$27,$27,$36,$36,$38,$27
3088:                 DEFB    $27,$27,$36,$36,$37,$27,$27,$27,$36,$36,$36,$27,$27,$27,$36,$36
3098:                 DEFB    $36,$39,$27,$27,$36,$36,$36,$38,$27,$27,$36,$36,$36,$37,$27,$27
30A8:                 DEFB    $36,$36,$36,$36,$27,$27,$36,$36,$36,$36,$39,$27,$36,$36,$36,$36
30B8:                 DEFB    $38,$27,$36,$36,$36,$36,$37,$27,$36,$36,$36,$36,$36,$27,$36,$36
30C8:                 DEFB    $36,$36,$36,$39,$36,$36,$36,$36,$36,$38,$36,$36,$36,$36,$36,$37
30D8:                 DEFB    $36,$36,$36,$36,$36,$36

; seedEnemyRecords — seed the enemy records (the second block of round/level setup), derive the
; difficulty-scaled enemy-speed pair (0x07-(level&6) = 7,5,3,1), then hand off to
; seedActorSpawnState (enemy #3). ROM 0x30de. (§2.4)
seedEnemyRecords:
30DE: 3E 09           LD      A,$09
30E0: 32 E9 80        LD      ($80E9),A           ; {ram.enemy1Sprite}
30E3: 3E EC           LD      A,$EC
30E5: 32 E8 80        LD      ($80E8),A           ; {ram.enemy1X}
30E8: 3E 23           LD      A,$23
30EA: 32 EB 80        LD      ($80EB),A
30ED: 3E 04           LD      A,$04
30EF: 32 EA 80        LD      ($80EA),A           ; {ram.enemy1Attr}
30F2: 3E 01           LD      A,$01
30F4: 32 F5 80        LD      ($80F5),A           ; {ram.enemy1State}
30F7: 32 F0 80        LD      ($80F0),A           ; {ram.enemy1Timer} same A (0x01) reused
30FA: 3E 04           LD      A,$04
30FC: 32 F8 80        LD      ($80F8),A           ; {ram.enemy1TargetCol}
30FF: 3A 28 80        LD      A,($8028)           ; {ram.level} the level/difficulty counter
3102: E6 06           AND     $06                 ; keep only bits 1 and 2 (H set, N=0, C=0, S/Z/PV from result)
3104: 47              LD      B,A                 ; B = (0x8028) & 0x06
3105: 3E 07           LD      A,$07
3107: 90              SUB     B                   ; A = 0x07 - B (B<=6 so no borrow; C clear, N set)
3108: 32 F6 80        LD      ($80F6),A           ; {ram.enemy1MovePeriod} derived byte
310B: 32 07 81        LD      ($8107),A           ; {ram.enemy2MovePeriod} same derived byte, mirrored
310E: 3E 09           LD      A,$09
3110: 32 FA 80        LD      ($80FA),A           ; {ram.enemy2Sprite}
3113: 3E 04           LD      A,$04
3115: 32 FB 80        LD      ($80FB),A           ; {ram.enemy2Attr}
3118: 3E 00           LD      A,$00
311A: 32 F9 80        LD      ($80F9),A           ; {ram.enemy2X}
311D: 32 06 81        LD      ($8106),A           ; {ram.enemy2State} same A (0x00) reused
3120: 3E 01           LD      A,$01
3122: 32 01 81        LD      ($8101),A           ; {ram.enemy2Timer}
3125: 3E 05           LD      A,$05
3127: 32 09 81        LD      ($8109),A           ; {ram.enemy2TargetCol}
312A: C3 FE 36        JP      $36FE               ; {code.seedActorSpawnState} unconditional tail-jump; loc_36fe's ret returns to OUR caller

; updateEnemy1 — the per-frame enemy pass: drive enemy 1 (record 0x80e8) through the shared
; move/collision driver (stepEnemyMover), stage its sprite record, then hand off enemy 2. ROM
; 0x312d. (§2.4)
updateEnemy1:
312D: 3A 10 80        LD      A,($8010)           ; {ram.playPhaseCounter}
3130: FE 08           CP      $08
3132: DA 48 37        JP      C,$3748             ; {code.advanceTwoSpriteActor} skip both objects when 0x8010 < 8
3135: 21 E8 80        LD      HL,$80E8            ; {ram.enemy1X} object 1 record -> scratch
3138: 11 83 80        LD      DE,$8083
313B: 01 11 00        LD      BC,$0011
313E: ED B0           LDIR
3140: CD 9D 31        CALL    $319D               ; {code.stepEnemyMover} run object 1 movement/collision
3143: 21 83 80        LD      HL,$8083            ; scratch -> object 1 record
3146: 11 E8 80        LD      DE,$80E8            ; {ram.enemy1X}
3149: 01 11 00        LD      BC,$0011
314C: ED B0           LDIR
314E: 11 30 82        LD      DE,$8230            ; sprite record 1
3151: 21 E8 80        LD      HL,$80E8            ; {ram.enemy1X}
3154: 01 03 00        LD      BC,$0003
3157: ED B0           LDIR                        ; 3 bytes 0x80e8..0x80ea -> 0x8230..0x8232
3159: 3A 51 80        LD      A,($8051)           ; {ram.spriteCoordBias} the shared bias
315C: 47              LD      B,A
315D: 7E              LD      A,(HL)              ; A = object1[3] (HL = 0x80eb)
315E: 80              ADD     A,B                 ; A = object1[3] + bias
315F: 12              LD      (DE),A              ; -> sprite1[3] (0x8233)
3160: 3A 01 80        LD      A,($8001)           ; {ram.gameState}
3163: FE 04           CP      $04
3165: 20 08           JR      NZ,$316F            ; {code.updateEnemy2} if 0x8001 != 4 -> object 2 (loc_316f)
3167: 3A 10 80        LD      A,($8010)           ; {ram.playPhaseCounter}
316A: FE 0A           CP      $0A
316C: DA 48 37        JP      C,$3748             ; {code.advanceTwoSpriteActor} 0x8001==4 && 0x8010<0x0a -> stop after obj 1

; updateEnemy2 — advance enemy 2 (record 0x80f9) one frame and stage its sprite. ROM 0x316f.
; (§2.4)
updateEnemy2:
316F: 21 F9 80        LD      HL,$80F9            ; {ram.enemy2X} source: live object record
3172: 11 83 80        LD      DE,$8083            ; dest: scratch record
3175: 01 11 00        LD      BC,$0011            ; PC now at the ldir
3178: ED B0           LDIR                        ; 0x11 bytes; leaves HL=0x810a, DE=0x8094, BC=0
317A: CD 9D 31        CALL    $319D               ; {code.stepEnemyMover} resumes in-line; its ret pops 0x317d
317D: 21 83 80        LD      HL,$8083            ; source: scratch record
3180: 11 F9 80        LD      DE,$80F9            ; {ram.enemy2X} dest: live object record
3183: 01 11 00        LD      BC,$0011            ; PC now at the ldir
3186: ED B0           LDIR                        ; 0x11 bytes; leaves HL=0x8094, DE=0x810a, BC=0
3188: 11 34 82        LD      DE,$8234            ; dest: display record
318B: 21 F9 80        LD      HL,$80F9            ; {ram.enemy2X} source: live object record
318E: 01 03 00        LD      BC,$0003            ; PC now at the ldir
3191: ED B0           LDIR                        ; 0x80f9..0x80fb -> 0x8234..0x8236 (HL->0x80fc)
3193: 3A 51 80        LD      A,($8051)           ; {ram.spriteCoordBias} the shared bias
3196: 47              LD      B,A                 ; B = bias
3197: 7E              LD      A,(HL)              ; A = record[3] (HL = 0x80fc)
3198: 80              ADD     A,B                 ; A = record[3] + bias
3199: 12              LD      (DE),A              ; store the biased 4th byte at 0x8237
319A: C3 48 37        JP      $3748               ; {code.advanceTwoSpriteActor} TAIL-JUMP: 0x3748's ret returns to loc_316f's caller

; stepEnemyMover — per-frame step for one enemy/object mover: arrival, capture, retarget, and
; steer into a travel-direction preset. ROM 0x319d.
stepEnemyMover:
319D: 3A 93 80        LD      A,($8093)           ; {ram.enemyWorkTargetCol}
31A0: 47              LD      B,A
31A1: 3A 7A 80        LD      A,($807A)
31A4: B8              CP      B
31A5: CA 58 34        JP      Z,$3458             ; {code.tickObjectDwellThenTransition}
31A8: 3A 90 80        LD      A,($8090)           ; {ram.enemyWorkState}
31AB: B7              OR      A
31AC: FA DA 34        JP      M,$34DA             ; {code.advanceDormantMover}
31AF: 20 1F           JR      NZ,$31D0            ; {code.loc_31d0}
31B1: 3A 8B 80        LD      A,($808B)           ; {ram.enemyActionTimer}
31B4: 3D              DEC     A
31B5: 32 8B 80        LD      ($808B),A           ; {ram.enemyActionTimer}
31B8: C0              RET     NZ
31B9: 3E 01           LD      A,$01
31BB: 32 90 80        LD      ($8090),A           ; {ram.enemyWorkState}
31BE: 32 8B 80        LD      ($808B),A           ; {ram.enemyActionTimer}
31C1: 3E E4           LD      A,$E4
31C3: 32 83 80        LD      ($8083),A
31C6: 3E 23           LD      A,$23
31C8: 32 86 80        LD      ($8086),A
31CB: 3E EC           LD      A,$EC
31CD: 32 E8 80        LD      ($80E8),A           ; {ram.enemy1X}

loc_31d0:
31D0: 3A A1 80        LD      A,($80A1)           ; {ram.laserState}
31D3: B7              OR      A
31D4: 28 2D           JR      Z,$3203             ; {code.loc_3203}
31D6: 3A 83 80        LD      A,($8083)
31D9: 67              LD      H,A
31DA: 3A 94 80        LD      A,($8094)           ; {ram.reactionObjX}
31DD: C6 04           ADD     A,$04
31DF: BC              CP      H
31E0: 38 21           JR      C,$3203             ; {code.loc_3203}
31E2: D6 0C           SUB     $0C
31E4: BC              CP      H
31E5: 30 1C           JR      NC,$3203            ; {code.loc_3203}
31E7: 3A 86 80        LD      A,($8086)
31EA: 6F              LD      L,A
31EB: 3A 97 80        LD      A,($8097)           ; {ram.reactionObjY}
31EE: C6 03           ADD     A,$03
31F0: BD              CP      L
31F1: 38 10           JR      C,$3203             ; {code.loc_3203}
31F3: D6 07           SUB     $07
31F5: BD              CP      L
31F6: 30 0B           JR      NC,$3203            ; {code.loc_3203}
31F8: CD 73 46        CALL    $4673               ; {code.awardOnePoint}
31FB: 3E C0           LD      A,$C0
31FD: 32 90 80        LD      ($8090),A           ; {ram.enemyWorkState}
3200: C3 DA 34        JP      $34DA               ; {code.advanceDormantMover}

loc_3203:
3203: 3A 7A 80        LD      A,($807A)
3206: B7              OR      A
3207: 20 4F           JR      NZ,$3258            ; {code.loc_3258}
3209: 3A C1 80        LD      A,($80C1)           ; {ram.digCollisionState}
320C: B7              OR      A
320D: 20 49           JR      NZ,$3258            ; {code.loc_3258}
320F: 3A 83 80        LD      A,($8083)
3212: 67              LD      H,A
3213: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
3216: C6 08           ADD     A,$08
3218: BC              CP      H
3219: 38 3D           JR      C,$3258             ; {code.loc_3258}
321B: D6 12           SUB     $12
321D: BC              CP      H
321E: 30 38           JR      NC,$3258            ; {code.loc_3258}
3220: 3A 86 80        LD      A,($8086)
3223: 6F              LD      L,A
3224: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
3227: C6 07           ADD     A,$07
3229: BD              CP      L
322A: 38 2C           JR      C,$3258             ; {code.loc_3258}
322C: D6 0F           SUB     $0F
322E: BD              CP      L
322F: 30 27           JR      NC,$3258            ; {code.loc_3258}
3231: 3A 93 80        LD      A,($8093)           ; {ram.enemyWorkTargetCol}
3234: 32 7A 80        LD      ($807A),A
3237: 3A 68 80        LD      A,($8068)           ; {ram.playerY}
323A: 32 83 80        LD      ($8083),A
323D: 3A 6B 80        LD      A,($806B)           ; {ram.playerX}
3240: 32 86 80        LD      ($8086),A
3243: 3E 81           LD      A,$81
3245: 32 8B 80        LD      ($808B),A           ; {ram.enemyActionTimer}
3248: 3E 17           LD      A,$17
324A: 32 84 80        LD      ($8084),A           ; {ram.enemyWorkSprite}
324D: 3E 35           LD      A,$35
324F: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
3252: CD 9F 4C        CALL    $4C9F               ; {code.requestSound20}
3255: C3 58 34        JP      $3458               ; {code.tickObjectDwellThenTransition}

loc_3258:
3258: 3A 86 80        LD      A,($8086)
325B: FE 23           CP      $23
325D: 20 18           JR      NZ,$3277            ; {code.loc_3277}
325F: 3A 93 80        LD      A,($8093)           ; {ram.enemyWorkTargetCol}
3262: FE 04           CP      $04
3264: 3A 83 80        LD      A,($8083)
3267: 20 06           JR      NZ,$326F            ; {code.loc_326f}
3269: FE E5           CP      $E5
326B: C2 8B 34        JP      NZ,$348B            ; {code.stepMoverUnmirrored}
326E: C9              RET

loc_326f:
326F: FE DD           CP      $DD
3271: D2 8B 34        JP      NC,$348B            ; {code.stepMoverUnmirrored}
3274: C3 84 34        JP      $3484               ; {code.stepMoverDown}

loc_3277:
3277: 3A 83 80        LD      A,($8083)
327A: FE DC           CP      $DC
327C: 20 0B           JR      NZ,$3289            ; {code.loc_3289}
327E: 3A 86 80        LD      A,($8086)
3281: FE 33           CP      $33
3283: DA 84 34        JP      C,$3484             ; {code.stepMoverDown}
3286: C3 8B 34        JP      $348B               ; {code.stepMoverUnmirrored}

loc_3289:
3289: 3A 83 80        LD      A,($8083)
328C: C6 04           ADD     A,$04
328E: CB 3F           SRL     A
3290: CB 3F           SRL     A
3292: CB 3F           SRL     A
3294: ED 44           NEG
3296: C6 1F           ADD     A,$1F
3298: 67              LD      H,A
3299: 3A 86 80        LD      A,($8086)
329C: C6 05           ADD     A,$05
329E: 06 00           LD      B,$00
32A0: CB 3F           SRL     A
32A2: CB 18           RR      B
32A4: CB 3F           SRL     A
32A6: CB 18           RR      B
32A8: CB 3F           SRL     A
32AA: CB 18           RR      B
32AC: 4F              LD      C,A
32AD: 78              LD      A,B
32AE: 32 8D 80        LD      ($808D),A           ; {ram.subtilePhase}
32B1: 3E 00           LD      A,$00
32B3: 47              LD      B,A
32B4: CB 3C           SRL     H
32B6: 1F              RRA
32B7: CB 3C           SRL     H
32B9: 1F              RRA
32BA: CB 3C           SRL     H
32BC: 1F              RRA
32BD: 6F              LD      L,A
32BE: 09              ADD     HL,BC
32BF: 01 00 90        LD      BC,$9000            ; {hard.videoRam}
32C2: 09              ADD     HL,BC
32C3: 22 89 80        LD      ($8089),HL          ; {ram.probeCellPtr}
32C6: 3A 93 80        LD      A,($8093)           ; {ram.enemyWorkTargetCol}
32C9: FE 05           CP      $05
32CB: CA 45 33        JP      Z,$3345             ; {code.loc_3345}
32CE: 3A 92 80        LD      A,($8092)           ; {ram.enemyWorkDir}
32D1: 3D              DEC     A
32D2: CA F2 32        JP      Z,$32F2             ; {code.loc_32f2}
32D5: 3D              DEC     A
32D6: CA 11 33        JP      Z,$3311             ; {code.loc_3311}
32D9: 3D              DEC     A
32DA: CA 26 33        JP      Z,$3326             ; {code.loc_3326}
32DD: CD DA 33        CALL    $33DA               ; {code.probeRowBackTilePair}
32E0: CA 7D 34        JP      Z,$347D             ; {code.stepMoverMirrored}
32E3: CD BC 33        CALL    $33BC               ; {code.tileInProbeRow}
32E6: CA 76 34        JP      Z,$3476             ; {code.stepMoverUp}
32E9: CD 25 34        CALL    $3425               ; {code.probeRowAheadTilePair}
32EC: CA 8B 34        JP      Z,$348B             ; {code.stepMoverUnmirrored}
32EF: C3 84 34        JP      $3484               ; {code.stepMoverDown}

loc_32f2:
32F2: 3A 83 80        LD      A,($8083)
32F5: C6 04           ADD     A,$04
32F7: E6 07           AND     $07
32F9: C2 7D 34        JP      NZ,$347D            ; {code.stepMoverMirrored}
32FC: CD 10 34        CALL    $3410               ; {code.nextTileInProbeRow}
32FF: CA 84 34        JP      Z,$3484             ; {code.stepMoverDown}
3302: CD DA 33        CALL    $33DA               ; {code.probeRowBackTilePair}
3305: CA 7D 34        JP      Z,$347D             ; {code.stepMoverMirrored}
3308: CD BC 33        CALL    $33BC               ; {code.tileInProbeRow}
330B: CA 76 34        JP      Z,$3476             ; {code.stepMoverUp}
330E: C3 8B 34        JP      $348B               ; {code.stepMoverUnmirrored}

loc_3311:
3311: CD 25 34        CALL    $3425               ; {code.probeRowAheadTilePair}
3314: CA 8B 34        JP      Z,$348B             ; {code.stepMoverUnmirrored}
3317: CD 10 34        CALL    $3410               ; {code.nextTileInProbeRow}
331A: CA 84 34        JP      Z,$3484             ; {code.stepMoverDown}
331D: CD DA 33        CALL    $33DA               ; {code.probeRowBackTilePair}
3320: CA 7D 34        JP      Z,$347D             ; {code.stepMoverMirrored}
3323: C3 76 34        JP      $3476               ; {code.stepMoverUp}

loc_3326:
3326: 3A 83 80        LD      A,($8083)
3329: C6 04           ADD     A,$04
332B: E6 07           AND     $07
332D: C2 8B 34        JP      NZ,$348B            ; {code.stepMoverUnmirrored}
3330: CD BC 33        CALL    $33BC               ; {code.tileInProbeRow}
3333: CA 76 34        JP      Z,$3476             ; {code.stepMoverUp}
3336: CD 25 34        CALL    $3425               ; {code.probeRowAheadTilePair}
3339: CA 8B 34        JP      Z,$348B             ; {code.stepMoverUnmirrored}
333C: CD 10 34        CALL    $3410               ; {code.nextTileInProbeRow}
333F: CA 84 34        JP      Z,$3484             ; {code.stepMoverDown}
3342: C3 7D 34        JP      $347D               ; {code.stepMoverMirrored}

loc_3345:
3345: 3A 92 80        LD      A,($8092)           ; {ram.enemyWorkDir}
3348: 3D              DEC     A
3349: CA 69 33        JP      Z,$3369             ; {code.loc_3369}
334C: 3D              DEC     A
334D: CA 88 33        JP      Z,$3388             ; {code.loc_3388}
3350: 3D              DEC     A
3351: CA 9D 33        JP      Z,$339D             ; {code.loc_339d}
3354: CD 25 34        CALL    $3425               ; {code.probeRowAheadTilePair}
3357: CA 8B 34        JP      Z,$348B             ; {code.stepMoverUnmirrored}
335A: CD BC 33        CALL    $33BC               ; {code.tileInProbeRow}
335D: CA 76 34        JP      Z,$3476             ; {code.stepMoverUp}
3360: CD DA 33        CALL    $33DA               ; {code.probeRowBackTilePair}
3363: CA 7D 34        JP      Z,$347D             ; {code.stepMoverMirrored}
3366: C3 84 34        JP      $3484               ; {code.stepMoverDown}

loc_3369:
3369: 3A 83 80        LD      A,($8083)
336C: C6 04           ADD     A,$04
336E: E6 07           AND     $07
3370: C2 7D 34        JP      NZ,$347D            ; {code.stepMoverMirrored}
3373: CD BC 33        CALL    $33BC               ; {code.tileInProbeRow}
3376: CA 76 34        JP      Z,$3476             ; {code.stepMoverUp}
3379: CD DA 33        CALL    $33DA               ; {code.probeRowBackTilePair}
337C: CA 7D 34        JP      Z,$347D             ; {code.stepMoverMirrored}
337F: CD 10 34        CALL    $3410               ; {code.nextTileInProbeRow}
3382: CA 84 34        JP      Z,$3484             ; {code.stepMoverDown}
3385: C3 8B 34        JP      $348B               ; {code.stepMoverUnmirrored}

loc_3388:
3388: CD DA 33        CALL    $33DA               ; {code.probeRowBackTilePair}
338B: CA 7D 34        JP      Z,$347D             ; {code.stepMoverMirrored}
338E: CD 10 34        CALL    $3410               ; {code.nextTileInProbeRow}
3391: CA 84 34        JP      Z,$3484             ; {code.stepMoverDown}
3394: CD 25 34        CALL    $3425               ; {code.probeRowAheadTilePair}
3397: CA 8B 34        JP      Z,$348B             ; {code.stepMoverUnmirrored}
339A: C3 76 34        JP      $3476               ; {code.stepMoverUp}

loc_339d:
339D: 3A 83 80        LD      A,($8083)
33A0: C6 04           ADD     A,$04
33A2: E6 07           AND     $07
33A4: C2 8B 34        JP      NZ,$348B            ; {code.stepMoverUnmirrored}
33A7: CD 10 34        CALL    $3410               ; {code.nextTileInProbeRow}
33AA: CA 84 34        JP      Z,$3484             ; {code.stepMoverDown}
33AD: CD 25 34        CALL    $3425               ; {code.probeRowAheadTilePair}
33B0: CA 8B 34        JP      Z,$348B             ; {code.stepMoverUnmirrored}
33B3: CD BC 33        CALL    $33BC               ; {code.tileInProbeRow}
33B6: CA 76 34        JP      Z,$3476             ; {code.stepMoverUp}
33B9: C3 7D 34        JP      $347D               ; {code.stepMoverMirrored}

; tileInProbeRow — is the tile at an object's probe cell listed in this phase's probe-table row?
; ROM 0x33bc.
tileInProbeRow:
33BC: 3A 8D 80        LD      A,($808D)           ; {ram.subtilePhase}
33BF: 5F              LD      E,A
33C0: 16 00           LD      D,$00
33C2: 2A 89 80        LD      HL,($8089)          ; {ram.probeCellPtr}
33C5: 3A 86 80        LD      A,($8086)
33C8: C6 05           ADD     A,$05
33CA: E6 07           AND     $07
33CC: 20 01           JR      NZ,$33CF            ; {code.loc_33cf}
33CE: 2B              DEC     HL

loc_33cf:
33CF: 7E              LD      A,(HL)
33D0: 21 FE 34        LD      HL,$34FE
33D3: 19              ADD     HL,DE
33D4: 01 20 00        LD      BC,$0020
33D7: ED B1           CPIR
33D9: C9              RET

; probeRowBackTilePair — probe two phase-keyed ROM tables for the tile one row back from the probe
; cell. ROM 0x33da.
probeRowBackTilePair:
33DA: 3A 8D 80        LD      A,($808D)           ; {ram.subtilePhase}
33DD: C6 20           ADD     A,$20
33DF: 5F              LD      E,A
33E0: 16 00           LD      D,$00               ; de = (0x808d)+0x20
33E2: 2A 89 80        LD      HL,($8089)          ; {ram.probeCellPtr}
33E5: 01 E0 FF        LD      BC,$FFE0
33E8: 09              ADD     HL,BC               ; hl = (0x8089) - 0x20
33E9: 22 34 81        LD      ($8134),HL          ; {ram.savedCellPtr} save that pointer
33EC: 7E              LD      A,(HL)              ; key1 = byte one row up
33ED: 21 FE 34        LD      HL,$34FE
33F0: 19              ADD     HL,DE               ; hl = 0x34fe + de
33F1: 01 20 00        LD      BC,$0020
33F4: ED B1           CPIR                        ; search 32 entries for key1
33F6: C0              RET     NZ                  ; not found -> done
33F7: 3A 8D 80        LD      A,($808D)           ; {ram.subtilePhase}
33FA: A7              AND     A
33FB: C8              RET     Z                   ; (0x808d) == 0 -> done
33FC: D6 20           SUB     $20
33FE: 5F              LD      E,A                 ; de = (0x808d)-0x20 (d still 0)
33FF: DD 2A 34 81     LD      IX,($8134)          ; {ram.savedCellPtr} the saved pointer
3403: DD 7E 01        LD      A,(IX+$01)          ; key2 = adjacent byte
3406: 21 FE 35        LD      HL,$35FE
3409: 19              ADD     HL,DE               ; hl = 0x35fe + de
340A: 01 20 00        LD      BC,$0020
340D: ED B1           CPIR                        ; search a second 32-entry table
340F: C9              RET

; nextTileInProbeRow — one of four sibling table searches the object-movement dispatcher uses to
; decide whether a move in a given direction is allowed. ROM 0x3410.
nextTileInProbeRow:
3410: 3A 8D 80        LD      A,($808D)           ; {ram.subtilePhase}
3413: 5F              LD      E,A
3414: 16 00           LD      D,$00
3416: 2A 89 80        LD      HL,($8089)          ; {ram.probeCellPtr}
3419: 23              INC     HL
341A: 7E              LD      A,(HL)
341B: 21 FE 35        LD      HL,$35FE
341E: 19              ADD     HL,DE
341F: 01 20 00        LD      BC,$0020
3422: ED B1           CPIR
3424: C9              RET

; probeRowAheadTilePair — a two-stage tile-table probe: does the tile one row on from the object's
; current cell (and, conditionally, the one beside it) belong to the table rows keyed by the
; object's sub-tile phase? ROM 0x3425.
probeRowAheadTilePair:
3425: 3A 8D 80        LD      A,($808D)           ; {ram.subtilePhase}
3428: C6 20           ADD     A,$20
342A: 5F              LD      E,A
342B: 16 00           LD      D,$00
342D: 2A 89 80        LD      HL,($8089)          ; {ram.probeCellPtr}
3430: 01 20 00        LD      BC,$0020
3433: 09              ADD     HL,BC
3434: 22 34 81        LD      ($8134),HL          ; {ram.savedCellPtr}
3437: 7E              LD      A,(HL)
3438: 21 FE 34        LD      HL,$34FE
343B: 19              ADD     HL,DE
343C: ED B1           CPIR
343E: C0              RET     NZ                  ; key not found in the 0x34fe row -> done
343F: 3A 8D 80        LD      A,($808D)           ; {ram.subtilePhase}
3442: A7              AND     A
3443: C8              RET     Z                   ; index 0 -> done
3444: D6 20           SUB     $20
3446: 5F              LD      E,A
3447: DD 2A 34 81     LD      IX,($8134)          ; {ram.savedCellPtr}
344B: DD 7E 01        LD      A,(IX+$01)
344E: 21 FE 35        LD      HL,$35FE
3451: 19              ADD     HL,DE
3452: 01 20 00        LD      BC,$0020
3455: ED B1           CPIR
3457: C9              RET

; tickObjectDwellThenTransition — tick a per-object state countdown; blink its sprite while it
; runs and hand off to the round/mode transition when it expires. ROM 0x3458.
tickObjectDwellThenTransition:
3458: 3A 8B 80        LD      A,($808B)           ; {ram.enemyActionTimer}
345B: 3D              DEC     A
345C: 32 8B 80        LD      ($808B),A           ; {ram.enemyActionTimer}
345F: CA 78 02        JP      Z,$0278             ; {code.dockManAndDispatchRoundBoundary}
3462: E6 03           AND     $03
3464: C0              RET     NZ
3465: 3A 84 80        LD      A,($8084)           ; {ram.enemyWorkSprite}
3468: EE 80           XOR     $80
346A: 32 84 80        LD      ($8084),A           ; {ram.enemyWorkSprite}
346D: 3A 69 80        LD      A,($8069)           ; {ram.playerFacing}
3470: EE 80           XOR     $80
3472: 32 69 80        LD      ($8069),A           ; {ram.playerFacing}
3475: C9              RET

; stepMoverUp — commit one preset move-step for the tracked mover: step its X down a pixel and, on
; the movement cadence, republish its travel direction. ROM 0x3476.
stepMoverUp:
3476: 01 FF 00        LD      BC,$00FF            ; C=step -1 in X, B=0
3479: 16 00           LD      D,$00               ; direction index 0
347B: 18 13           JR      $3490               ; {code.loc_3490}

; stepMoverMirrored — advance one object-mover step for movement direction 1: step the mover's
; horizontal position one pixel on the cadence beat and refresh its facing and walk-frame. ROM
; 0x347d.
stepMoverMirrored:
347D: 01 00 01        LD      BC,$0100            ; C=0 (no X step), B=1 (bit0 set -> sprite branch live)
3480: 16 01           LD      D,$01               ; direction index 1
3482: 18 0C           JR      $3490               ; {code.loc_3490}

; stepMoverDown — one fixed-direction preset of the patrol mover: step its position one unit
; forward each frame and, on the cadence tick, re-arm the cadence and publish this preset's facing
; index. ROM 0x3484.
stepMoverDown:
3484: 01 01 00        LD      BC,$0001            ; C=step +1 in X, B=0 (bit0 clear -> sprite branch dead)
3487: 16 02           LD      D,$02               ; direction index 2
3489: 18 05           JR      $3490               ; {code.loc_3490}

; stepMoverUnmirrored — advance one object-mover step for movement direction 3: step the mover's
; horizontal position one pixel on the cadence beat and refresh its facing and walk-frame. ROM
; 0x348b.
stepMoverUnmirrored:
348B: 01 00 FF        LD      BC,$FF00            ; C=0 (no X step), B=0xff (bit0 set -> sprite live; bit7 set -> no mirror)
348E: 16 03           LD      D,$03               ; falls through -- NO jr

loc_3490:
3490: 3A 8B 80        LD      A,($808B)           ; {ram.enemyActionTimer} frame counter
3493: 3D              DEC     A                   ; Z set iff it just hit 0
3494: 32 8B 80        LD      ($808B),A           ; {ram.enemyActionTimer} store back (no flags)
3497: 20 39           JR      NZ,$34D2            ; {code.loc_34d2} counter still running -> position only
3499: 3A 91 80        LD      A,($8091)           ; {ram.enemyWorkMovePeriod} counter reload value
349C: 32 8B 80        LD      ($808B),A           ; {ram.enemyActionTimer} reload the counter
349F: 7A              LD      A,D
34A0: 32 92 80        LD      ($8092),A           ; {ram.enemyWorkDir} publish direction index (D=2)
34A3: CB 40           BIT     0,B                 ; Z = !(bit0 of B)
34A5: 28 2B           JR      Z,$34D2             ; {code.loc_34d2} bit0(B)=0 -> skip sprite update
34A7: 3A 83 80        LD      A,($8083)
34AA: 80              ADD     A,B
34AB: 32 83 80        LD      ($8083),A
34AE: C6 04           ADD     A,$04
34B0: E6 06           AND     $06                 ; selector in {0,2,4,6}
34B2: 20 02           JR      NZ,$34B6            ; {code.loc_34b6}
34B4: 1E 17           LD      E,$17               ; selector 0

loc_34b6:
34B6: FE 02           CP      $02
34B8: 20 02           JR      NZ,$34BC            ; {code.loc_34bc}
34BA: 1E 14           LD      E,$14               ; selector 2

loc_34bc:
34BC: FE 04           CP      $04
34BE: 20 02           JR      NZ,$34C2            ; {code.loc_34c2}
34C0: 1E 15           LD      E,$15               ; selector 4

loc_34c2:
34C2: FE 06           CP      $06
34C4: 20 02           JR      NZ,$34C8            ; {code.loc_34c8}
34C6: 1E 16           LD      E,$16               ; selector 6

loc_34c8:
34C8: 7B              LD      A,E                 ; the chosen orientation code
34C9: CB 78           BIT     7,B                 ; Z = !(bit7 of B)
34CB: 20 02           JR      NZ,$34CF            ; {code.loc_34cf} bit7(B)=1 -> keep as-is (no mirror)
34CD: EE 80           XOR     $80                 ; else flip bit 7 (mirror the sprite)

loc_34cf:
34CF: 32 84 80        LD      ($8084),A           ; {ram.enemyWorkSprite} store sprite code

loc_34d2:
34D2: 3A 86 80        LD      A,($8086)           ; X position
34D5: 81              ADD     A,C                 ; advance by the X delta (C=0 here -> unchanged)
34D6: 32 86 80        LD      ($8086),A           ; advance the X position by C
34D9: C9              RET

; advanceDormantMover — mover housekeeping: advance two cadence counters each call. ROM 0x34da.
advanceDormantMover:
34DA: 3A 90 80        LD      A,($8090)           ; {ram.enemyWorkState}
34DD: 3C              INC     A
34DE: 32 90 80        LD      ($8090),A           ; {ram.enemyWorkState}
34E1: 28 0D           JR      Z,$34F0             ; {code.reseedMoverCadenceAndRearmState}
34E3: E6 03           AND     $03
34E5: C0              RET     NZ
34E6: 3A 85 80        LD      A,($8085)
34E9: 3C              INC     A
34EA: E6 F7           AND     $F7
34EC: 32 85 80        LD      ($8085),A
34EF: C9              RET

; reseedMoverCadenceAndRearmState — periodic refresh: reseed the random/animation byte and re-arm
; the actor state byte. ROM 0x34f0.
reseedMoverCadenceAndRearmState:
34F0: CD 1A 4B        CALL    $4B1A               ; {code.advanceRandom} return addr 0x34f3; callee returns the new LFSR low byte in A
34F3: F6 80           OR      $80                 ; force bit 7 set on the returned byte
34F5: 32 8B 80        LD      ($808B),A           ; {ram.enemyActionTimer} store the masked random byte (work RAM, no bus offset)
34F8: 3E 09           LD      A,$09
34FA: 32 84 80        LD      ($8084),A           ; {ram.enemyWorkSprite} re-arm the state/timer byte to 9
34FD: C9              RET

; ==== UNREACHED 0x34fe-0x36fd (512 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
34FE:                 DEFB    $70,$9B,$9C,$9D,$71,$72,$73,$74,$75,$76,$77,$80,$81,$82,$83,$84
350E:                 DEFB    $85,$86,$87,$88,$89,$8A,$8B,$8C,$8D,$8E,$8F,$90,$91,$92,$93,$94
351E:                 DEFB    $70,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
352E:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
353E:                 DEFB    $70,$00,$00,$00,$71,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
354E:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
355E:                 DEFB    $70,$00,$00,$00,$71,$72,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
356E:                 DEFB    $85,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
357E:                 DEFB    $70,$00,$00,$00,$71,$72,$73,$00,$00,$00,$00,$00,$00,$00,$00,$84
358E:                 DEFB    $85,$00,$00,$00,$00,$8A,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
359E:                 DEFB    $70,$00,$00,$00,$71,$72,$73,$74,$00,$00,$00,$00,$00,$00,$83,$84
35AE:                 DEFB    $85,$00,$00,$00,$89,$8A,$00,$00,$00,$8E,$00,$00,$00,$00,$00,$00
35BE:                 DEFB    $70,$00,$00,$9D,$71,$72,$73,$74,$75,$00,$00,$00,$00,$82,$83,$84
35CE:                 DEFB    $85,$00,$00,$88,$89,$8A,$00,$00,$8D,$8E,$00,$00,$91,$00,$00,$00
35DE:                 DEFB    $70,$00,$9C,$9D,$71,$72,$73,$74,$75,$76,$00,$00,$81,$82,$83,$84
35EE:                 DEFB    $85,$00,$87,$88,$89,$8A,$00,$8C,$8D,$8E,$00,$90,$91,$00,$93,$00
35FE:                 DEFB    $70,$97,$98,$99,$79,$7A,$7B,$7C,$7D,$7E,$7F,$80,$81,$82,$83,$84
360E:                 DEFB    $85,$86,$87,$88,$89,$8A,$8B,$8C,$8D,$8E,$8F,$90,$91,$92,$93,$94
361E:                 DEFB    $70,$00,$98,$99,$00,$7A,$7B,$7C,$7D,$7E,$7F,$00,$00,$00,$00,$00
362E:                 DEFB    $00,$86,$87,$88,$89,$8A,$8B,$8C,$8D,$8E,$8F,$90,$91,$92,$93,$94
363E:                 DEFB    $70,$00,$00,$99,$00,$00,$7B,$7C,$7D,$7E,$7F,$00,$00,$00,$00,$00
364E:                 DEFB    $00,$00,$00,$00,$00,$00,$8B,$8C,$8D,$8E,$8F,$90,$91,$92,$93,$94
365E:                 DEFB    $70,$00,$00,$00,$00,$00,$00,$7C,$7D,$7E,$7F,$00,$00,$00,$00,$00
366E:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$8F,$90,$91,$92,$93,$94
367E:                 DEFB    $70,$00,$00,$00,$00,$00,$00,$00,$7D,$7E,$7F,$00,$00,$00,$00,$00
368E:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$92,$93,$94
369E:                 DEFB    $70,$00,$00,$00,$00,$00,$00,$00,$00,$7E,$7F,$00,$00,$00,$00,$00
36AE:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$94
36BE:                 DEFB    $70,$00,$00,$00,$00,$00,$00,$00,$00,$00,$7F,$00,$00,$00,$00,$00
36CE:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
36DE:                 DEFB    $70,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
36EE:                 DEFB    $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00

; seedActorSpawnState — put the two-body actor (a primary sprite and its twin) into its fixed
; starting state and drop it back to the un-spawned phase. ROM 0x36fe.
seedActorSpawnState:
36FE: 3E 2E           LD      A,$2E
3700: 32 0B 81        LD      ($810B),A           ; {ram.enemy3Tile}
3703: 3E 24           LD      A,$24
3705: 32 0A 81        LD      ($810A),A           ; {ram.enemy3X}
3708: 3E 00           LD      A,$00
370A: 32 0D 81        LD      ($810D),A           ; {ram.enemy3Y}
370D: 3E 97           LD      A,$97
370F: 32 0C 81        LD      ($810C),A           ; {ram.enemy3Attr}
3712: 3E 00           LD      A,$00
3714: 32 0E 81        LD      ($810E),A           ; {ram.enemy3StepX}
3717: 3E 01           LD      A,$01
3719: 32 0F 81        LD      ($810F),A           ; {ram.enemy3StepY}
371C: 3E 01           LD      A,$01
371E: 32 12 81        LD      ($8112),A           ; {ram.enemy3Timer}
3721: 3E 00           LD      A,$00
3723: 32 7B 80        LD      ($807B),A           ; {ram.boardEndPhase}
3726: 3E 2F           LD      A,$2F
3728: 32 1C 81        LD      ($811C),A           ; {ram.enemy3TwinTile}
372B: 3E 34           LD      A,$34
372D: 32 1B 81        LD      ($811B),A           ; {ram.enemy3TwinX}
3730: 3E 00           LD      A,$00
3732: 32 1E 81        LD      ($811E),A           ; {ram.enemy3TwinY}
3735: 3E 97           LD      A,$97
3737: 32 1D 81        LD      ($811D),A           ; {ram.enemy3TwinAttr}
373A: 3E 00           LD      A,$00
373C: 32 1F 81        LD      ($811F),A
373F: 32 20 81        LD      ($8120),A
3742: 3E 01           LD      A,$01
3744: 32 23 81        LD      ($8123),A           ; {ram.enemy3TwinTimer}
3747: C9              RET

; advanceTwoSpriteActor — per-frame update for the two-sprite actor (a primary body plus its
; shadow twin): dispatch by spawn state and animation phase, and on the running phases march +
; walk-animate it inline. ROM 0x3748.
advanceTwoSpriteActor:
3748: 3A 7B 80        LD      A,($807B)           ; {ram.boardEndPhase}
374B: B7              OR      A
374C: C2 CF 37        JP      NZ,$37CF            ; {code.spawnAltPhaseActor}
374F: 3A 10 80        LD      A,($8010)           ; {ram.playPhaseCounter}
3752: FE 0A           CP      $0A
3754: D2 13 3A        JP      NC,$3A13            ; {code.advanceActorMovers}
3757: FE 03           CP      $03
3759: 38 23           JR      C,$377E             ; {code.loc_377e}
375B: FE 06           CP      $06
375D: 38 08           JR      C,$3767             ; {code.loc_3767}
375F: FE 09           CP      $09
3761: DA C8 38        JP      C,$38C8             ; {code.advanceOrRebuildTwinActor}
3764: C3 84 39        JP      $3984               ; {code.spawnTwinActor}

loc_3767:
3767: 3A 79 80        LD      A,($8079)           ; {ram.playerActive}
376A: A7              AND     A
376B: 20 11           JR      NZ,$377E            ; {code.loc_377e} already spawned)
376D: 3E 00           LD      A,$00
376F: 32 0F 81        LD      ($810F),A           ; {ram.enemy3StepY} step vector high := 0x00
3772: 3D              DEC     A                   ; A: 0x00 -> 0xff
3773: 32 0E 81        LD      ($810E),A           ; {ram.enemy3StepX} step vector low := 0xff
3776: 32 79 80        LD      ($8079),A           ; {ram.playerActive} mark spawned (0xff)
3779: 3E 2D           LD      A,$2D
377B: 32 68 80        LD      ($8068),A           ; {ram.playerY} initial tile

loc_377e:
377E: 3A 0E 81        LD      A,($810E)           ; {ram.enemy3StepX}
3781: 6F              LD      L,A                 ; step low
3782: 3A 0F 81        LD      A,($810F)           ; {ram.enemy3StepY}
3785: 67              LD      H,A                 ; step high; HL = step vector
3786: 3A 12 81        LD      A,($8112)           ; {ram.enemy3Timer}
3789: 3D              DEC     A                   ; sets Z read at 0x378d
378A: 32 12 81        LD      ($8112),A           ; {ram.enemy3Timer} store; flags survive
378D: 20 18           JR      NZ,$37A7            ; {code.loc_37a7} underflowed)
378F: 3E 08           LD      A,$08
3791: 32 12 81        LD      ($8112),A           ; {ram.enemy3Timer} reload counter
3794: 3A 0B 81        LD      A,($810B)           ; {ram.enemy3Tile}
3797: 47              LD      B,A                 ; current tile
3798: 3E 2E           LD      A,$2E
379A: B8              CP      B                   ; tile == 0x2e ?
379B: 20 02           JR      NZ,$379F            ; {code.loc_379f} was 0x2e)
379D: 3E AF           LD      A,$AF               ; toggle to 0xaf

loc_379f:
379F: 32 0B 81        LD      ($810B),A           ; {ram.enemy3Tile} new tile
37A2: EE 01           XOR     $01                 ; tile ^ 1
37A4: 32 1C 81        LD      ($811C),A           ; {ram.enemy3TwinTile} sprite-shadow tile

loc_37a7:
37A7: 3A 12 81        LD      A,($8112)           ; {ram.enemy3Timer}
37AA: E6 03           AND     $03                 ; every-4th-tick gate
37AC: 20 1E           JR      NZ,$37CC            ; {code.loc_37cc}
37AE: 3A 0A 81        LD      A,($810A)           ; {ram.enemy3X} X
37B1: FE 11           CP      $11
37B3: 38 17           JR      C,$37CC             ; {code.loc_37cc}
37B5: 85              ADD     A,L                 ; advance X by step low
37B6: 32 0A 81        LD      ($810A),A           ; {ram.enemy3X}
37B9: C6 10           ADD     A,$10
37BB: 32 1B 81        LD      ($811B),A           ; {ram.enemy3TwinX} sprite-shadow X
37BE: 3A 0D 81        LD      A,($810D)           ; {ram.enemy3Y} Y
37C1: FE 17           CP      $17
37C3: 30 07           JR      NC,$37CC            ; {code.loc_37cc}
37C5: 84              ADD     A,H                 ; advance Y by step high
37C6: 32 0D 81        LD      ($810D),A           ; {ram.enemy3Y}
37C9: 32 1E 81        LD      ($811E),A           ; {ram.enemy3TwinY} sprite-shadow Y

loc_37cc:
37CC: C3 4C 3A        JP      $3A4C               ; {code.stageActorSpriteRecords}

; spawnAltPhaseActor — bring the alt-phase actor (a primary sprite + its shadow twin) to life on
; its first frame, then animate it every frame after. ROM 0x37cf.
spawnAltPhaseActor:
37CF: 3A 7B 80        LD      A,($807B)           ; {ram.boardEndPhase} alt-phase byte
37D2: 3C              INC     A                   ; Z set iff byte was 0xff
37D3: 28 75           JR      Z,$384A             ; {code.advanceAltPhaseActor}
37D5: FE 03           CP      $03                 ; Z iff original byte was 2
37D7: 3E 16           LD      A,$16               ; (no flags; the cp's Z survives)
37D9: 28 01           JR      Z,$37DC             ; {code.loc_37dc} keep Y = 0x16)
37DB: 3C              INC     A                   ; Y = 0x17

loc_37dc:
37DC: 32 0D 81        LD      ($810D),A           ; {ram.enemy3Y} primary Y
37DF: 32 1E 81        LD      ($811E),A           ; {ram.enemy3TwinY} twin Y mirror
37E2: 3E FF           LD      A,$FF
37E4: 32 7B 80        LD      ($807B),A           ; {ram.boardEndPhase} mark alt-phase active
37E7: CD 6B 4C        CALL    $4C6B               ; {code.requestSound7} request sound 0x07 (returns here)
37EA: 3E 10           LD      A,$10
37EC: 32 0A 81        LD      ($810A),A           ; {ram.enemy3X} primary X
37EF: C6 10           ADD     A,$10               ; A = 0x20
37F1: 32 1B 81        LD      ($811B),A           ; {ram.enemy3TwinX} twin X mirror
37F4: 3E 2E           LD      A,$2E
37F6: 32 0B 81        LD      ($810B),A           ; {ram.enemy3Tile} primary tile
37F9: 3E 2F           LD      A,$2F
37FB: 32 1C 81        LD      ($811C),A           ; {ram.enemy3TwinTile} twin tile
37FE: 3E 01           LD      A,$01
3800: 32 12 81        LD      ($8112),A           ; {ram.enemy3Timer} timer
3803: 3E 97           LD      A,$97
3805: 32 0C 81        LD      ($810C),A           ; {ram.enemy3Attr}
3808: 32 1D 81        LD      ($811D),A           ; {ram.enemy3TwinAttr} same A (0x97)
380B: DD 21 A3 93     LD      IX,$93A3            ; {hard.videoRam} video RAM cursor
380F: FD 21 A3 8B     LD      IY,$8BA3            ; colour RAM cursor
3813: 06 90           LD      B,$90               ; colour byte
3815: 3E 24           LD      A,$24               ; tile byte
3817: DD 77 E0        LD      (IX-$20),A
381A: FD 70 E0        LD      (IY-$20),B
381D: DD 77 E1        LD      (IX-$1F),A
3820: FD 70 E1        LD      (IY-$1F),B
3823: DD 77 00        LD      (IX+$00),A
3826: FD 70 00        LD      (IY+$00),B
3829: DD 77 01        LD      (IX+$01),A
382C: FD 70 01        LD      (IY+$01),B
382F: DD 77 A0        LD      (IX-$60),A
3832: FD 70 A0        LD      (IY-$60),B
3835: DD 77 A1        LD      (IX-$5F),A
3838: FD 70 A1        LD      (IY-$5F),B
383B: DD 77 C0        LD      (IX-$40),A
383E: FD 70 C0        LD      (IY-$40),B
3841: DD 77 C1        LD      (IX-$3F),A
3844: FD 70 C1        LD      (IY-$3F),B
3847: C3 4C 3A        JP      $3A4C               ; {code.stageActorSpriteRecords}

; advanceAltPhaseActor — per-frame animate + march step for an active object. ROM 0x384a.
advanceAltPhaseActor:
384A: 3A 12 81        LD      A,($8112)           ; {ram.enemy3Timer}
384D: 3D              DEC     A                   ; sets Z read at 0x3851
384E: 32 12 81        LD      ($8112),A           ; {ram.enemy3Timer} store; flags survive
3851: 20 18           JR      NZ,$386B            ; {code.loc_386b} underflowed)
3853: 3E 08           LD      A,$08
3855: 32 12 81        LD      ($8112),A           ; {ram.enemy3Timer} reload counter
3858: 3A 0B 81        LD      A,($810B)           ; {ram.enemy3Tile}
385B: 47              LD      B,A                 ; current tile
385C: 3E 2E           LD      A,$2E
385E: B8              CP      B                   ; tile == 0x2e ?
385F: 20 02           JR      NZ,$3863            ; {code.loc_3863} was 0x2e)
3861: 3E AF           LD      A,$AF               ; toggle to 0xaf

loc_3863:
3863: 32 0B 81        LD      ($810B),A           ; {ram.enemy3Tile} new tile
3866: EE 01           XOR     $01                 ; tile ^ 1
3868: 32 1C 81        LD      ($811C),A           ; {ram.enemy3TwinTile} sprite-shadow tile

loc_386b:
386B: 3A 12 81        LD      A,($8112)           ; {ram.enemy3Timer}
386E: E6 03           AND     $03                 ; every-4th-tick gate
3870: C2 4C 3A        JP      NZ,$3A4C            ; {code.stageActorSpriteRecords}
3873: 3A 0D 81        LD      A,($810D)           ; {ram.enemy3Y} Y
3876: FE 17           CP      $17
3878: 38 20           JR      C,$389A             ; {code.loc_389a}
387A: 3A 0A 81        LD      A,($810A)           ; {ram.enemy3X} X
387D: FE 24           CP      $24
387F: 38 3B           JR      C,$38BC             ; {code.loc_38bc}
3881: 3A 0D 81        LD      A,($810D)           ; {ram.enemy3Y} Y (re-read)
3884: FE 17           CP      $17
3886: 20 12           JR      NZ,$389A            ; {code.loc_389a} Y == 0x17)
3888: 3E 00           LD      A,$00
388A: 32 79 80        LD      ($8079),A           ; {ram.playerActive} clear
388D: 32 68 80        LD      ($8068),A           ; {ram.playerY} clear tile
3890: 3C              INC     A                   ; A: 0x00 -> 0x01
3891: 32 7D 80        LD      ($807D),A           ; {ram.postTransitionMode} set flag
3894: CD 5B 1B        CALL    $1B5B               ; {code.stageObjectSpriteRecord}
3897: 3A 0D 81        LD      A,($810D)           ; {ram.enemy3Y} reload Y

loc_389a:
389A: A7              AND     A                   ; Y == 0 ?
389B: 20 15           JR      NZ,$38B2            ; {code.loc_38b2} Y == 0)
389D: 3A 7C 80        LD      A,($807C)           ; {ram.transitionTimer}
38A0: A7              AND     A                   ; (0x807c) == 0 ?
38A1: C0              RET     NZ                  ; 0x807c busy)
38A2: 3E 78           LD      A,$78
38A4: 32 7C 80        LD      ($807C),A           ; {ram.transitionTimer} arm timer
38A7: 3E 09           LD      A,$09
38A9: 32 0B 81        LD      ($810B),A           ; {ram.enemy3Tile} tile := 0x09
38AC: 32 1C 81        LD      ($811C),A           ; {ram.enemy3TwinTile} shadow := 0x09
38AF: C3 4C 3A        JP      $3A4C               ; {code.stageActorSpriteRecords}

loc_38b2:
38B2: 3D              DEC     A                   ; Y - 1
38B3: 32 0D 81        LD      ($810D),A           ; {ram.enemy3Y} store Y
38B6: 32 1E 81        LD      ($811E),A           ; {ram.enemy3TwinY} sprite-shadow Y
38B9: C3 4C 3A        JP      $3A4C               ; {code.stageActorSpriteRecords}

loc_38bc:
38BC: 3C              INC     A                   ; X + 1
38BD: 32 0A 81        LD      ($810A),A           ; {ram.enemy3X} store X
38C0: C6 10           ADD     A,$10
38C2: 32 1B 81        LD      ($811B),A           ; {ram.enemy3TwinX} sprite-shadow X
38C5: C3 4C 3A        JP      $3A4C               ; {code.stageActorSpriteRecords}

; advanceOrRebuildTwinActor — per-frame gate for the two-body actor: keep it moving while it is in
; the high half of the field, otherwise rebuild it at the start edge and redraw. ROM 0x38c8.
advanceOrRebuildTwinActor:
38C8: 3A 0A 81        LD      A,($810A)           ; {ram.enemy3X} actor X
38CB: FE 80           CP      $80                 ; carry iff X < 0x80
38CD: D2 45 39        JP      NC,$3945            ; {code.paceActorCadence} re-init)
38D0: 3E F0           LD      A,$F0
38D2: 32 0A 81        LD      ($810A),A           ; {ram.enemy3X} primary X := 0xf0
38D5: C6 10           ADD     A,$10               ; A = 0x00 (0xf0+0x10 wraps)
38D7: 32 1B 81        LD      ($811B),A           ; {ram.enemy3TwinX} twin X mirror := 0x00
38DA: 3E 1F           LD      A,$1F
38DC: 32 0D 81        LD      ($810D),A           ; {ram.enemy3Y} primary Y := 0x1f
38DF: 32 1E 81        LD      ($811E),A           ; {ram.enemy3TwinY} twin Y mirror := 0x1f
38E2: 3E 2A           LD      A,$2A
38E4: 32 1C 81        LD      ($811C),A           ; {ram.enemy3TwinTile} twin tile := 0x2a
38E7: 3E 2B           LD      A,$2B
38E9: 32 0B 81        LD      ($810B),A           ; {ram.enemy3Tile} primary tile := 0x2b
38EC: 3E 00           LD      A,$00
38EE: 32 0E 81        LD      ($810E),A           ; {ram.enemy3StepX}
38F1: 3E 01           LD      A,$01
38F3: 32 0F 81        LD      ($810F),A           ; {ram.enemy3StepY}
38F6: 32 12 81        LD      ($8112),A           ; {ram.enemy3Timer} timer := 0x01 (same A)
38F9: 3E 93           LD      A,$93
38FB: 32 0C 81        LD      ($810C),A           ; {ram.enemy3Attr}
38FE: 32 1D 81        LD      ($811D),A           ; {ram.enemy3TwinAttr}
3901: DD 21 A3 93     LD      IX,$93A3            ; {hard.videoRam} video RAM cursor
3905: FD 21 A3 8B     LD      IY,$8BA3            ; colour RAM cursor
3909: 06 97           LD      B,$97               ; colour byte
390B: 3E B8           LD      A,$B8               ; first tile code
390D: DD 77 E0        LD      (IX-$20),A          ; 0x9383
3910: FD 70 E0        LD      (IY-$20),B          ; 0x8b83
3913: 3C              INC     A                   ; A = 0xb9
3914: DD 77 E1        LD      (IX-$1F),A          ; 0x9384
3917: FD 70 E1        LD      (IY-$1F),B          ; 0x8b84
391A: 3C              INC     A                   ; A = 0xba
391B: DD 77 00        LD      (IX+$00),A          ; 0x93a3
391E: FD 70 00        LD      (IY+$00),B          ; 0x8ba3
3921: 3C              INC     A                   ; A = 0xbb
3922: DD 77 01        LD      (IX+$01),A          ; 0x93a4
3925: FD 70 01        LD      (IY+$01),B          ; 0x8ba4
3928: 3C              INC     A                   ; A = 0xbc
3929: DD 77 A0        LD      (IX-$60),A          ; 0x9343
392C: FD 70 A0        LD      (IY-$60),B          ; 0x8b43
392F: 3C              INC     A                   ; A = 0xbd
3930: DD 77 A1        LD      (IX-$5F),A          ; 0x9344
3933: FD 70 A1        LD      (IY-$5F),B          ; 0x8b44
3936: 3C              INC     A                   ; A = 0xbe
3937: DD 77 C0        LD      (IX-$40),A          ; 0x9363
393A: FD 70 C0        LD      (IY-$40),B          ; 0x8b63
393D: 3C              INC     A                   ; A = 0xbf
393E: DD 77 C1        LD      (IX-$3F),A          ; 0x9364
3941: FD 70 C1        LD      (IY-$3F),B          ; 0x8b64
3944: C9              RET

; paceActorCadence — cadence front end for the actor phase body: count the period-8 timer down one
; tick, reload it to 8 on the tick it runs out, then run the phase body. ROM 0x3945.
paceActorCadence:
3945: 3A 12 81        LD      A,($8112)           ; {ram.enemy3Timer}
3948: 3D              DEC     A
3949: 32 12 81        LD      ($8112),A           ; {ram.enemy3Timer}
394C: 20 1A           JR      NZ,$3968            ; {code.easeActorToRest}
394E: 3E 08           LD      A,$08
3950: 32 12 81        LD      ($8112),A           ; {ram.enemy3Timer}
3953: 18 13           JR      $3968               ; {code.easeActorToRest}

; ==== UNREACHED 0x3955-0x3967 (19 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
3955:                 DEFB    $3A,$0B,$81,$47,$3E,$2E,$B8,$20,$02,$3E,$AF,$32,$0B,$81,$EE,$01
3965:                 DEFB    $32,$1C,$81

; easeActorToRest — per-frame coordinate stepper: eases an actor's coordinate down to a resting
; floor and keeps its shadow twin a fixed 16 ahead. ROM 0x3968.
easeActorToRest:
3968: 3A 12 81        LD      A,($8112)           ; {ram.enemy3Timer} animation timer
396B: E6 03           AND     $03                 ; every-4th-tick gate (sets Z read at 0x396d)
396D: C2 4C 3A        JP      NZ,$3A4C            ; {code.stageActorSpriteRecords}
3970: 3A 0A 81        LD      A,($810A)           ; {ram.enemy3X} coordinate
3973: FE C1           CP      $C1                 ; sets carry if coord < 0xc1 (A intact)
3975: DA 4C 3A        JP      C,$3A4C             ; {code.stageActorSpriteRecords} coord >= 0xc1)
3978: 3D              DEC     A                   ; coord - 1
3979: 32 0A 81        LD      ($810A),A           ; {ram.enemy3X} store coordinate
397C: C6 10           ADD     A,$10               ; coord + 0x10 (sprite offset)
397E: 32 1B 81        LD      ($811B),A           ; {ram.enemy3TwinX} sprite-shadow
3981: C3 4C 3A        JP      $3A4C               ; {code.stageActorSpriteRecords}

; spawnTwinActor — spawn the two-body (primary + twin) actor once when its spawn is due: paint its
; tile+colour figure, seed both object records, and stage its sprite records for the move/animate
; driver. ROM 0x3984.
spawnTwinActor:
3984: 3A 0D 81        LD      A,($810D)           ; {ram.enemy3Y} spawn "requested" flag
3987: A7              AND     A                   ; set Z iff the flag is 0
3988: C8              RET     Z                   ; not requested this frame -> return to caller
3989: 3E 00           LD      A,$00
398B: 32 0D 81        LD      ($810D),A           ; {ram.enemy3Y} clear the request flag
398E: 32 1E 81        LD      ($811E),A           ; {ram.enemy3TwinY} clear its twin mirror
3991: DD 21 E4 90     LD      IX,$90E4            ; {hard.videoRam} video RAM cursor
3995: FD 21 E4 88     LD      IY,$88E4            ; colour RAM cursor
3999: 06 93           LD      B,$93               ; colour byte for every cell
399B: 3E A8           LD      A,$A8               ; first tile byte
399D: DD 77 A0        LD      (IX-$60),A          ; tile 0xa8
39A0: FD 70 A0        LD      (IY-$60),B
39A3: 3C              INC     A                   ; 0xa9
39A4: DD 77 A1        LD      (IX-$5F),A          ; tile 0xa9
39A7: FD 70 A1        LD      (IY-$5F),B
39AA: 3C              INC     A                   ; 0xaa
39AB: DD 77 C0        LD      (IX-$40),A          ; tile 0xaa
39AE: FD 70 C0        LD      (IY-$40),B
39B1: 3C              INC     A                   ; 0xab
39B2: DD 77 C1        LD      (IX-$3F),A          ; tile 0xab
39B5: FD 70 C1        LD      (IY-$3F),B
39B8: 3C              INC     A                   ; 0xac
39B9: DD 77 E0        LD      (IX-$20),A          ; tile 0xac
39BC: FD 70 E0        LD      (IY-$20),B
39BF: 3C              INC     A                   ; 0xad
39C0: DD 77 E1        LD      (IX-$1F),A          ; tile 0xad
39C3: FD 70 E1        LD      (IY-$1F),B
39C6: 3C              INC     A                   ; 0xae
39C7: DD 77 00        LD      (IX+$00),A          ; tile 0xae
39CA: FD 70 00        LD      (IY+$00),B
39CD: 3C              INC     A                   ; 0xaf
39CE: DD 77 01        LD      (IX+$01),A          ; tile 0xaf
39D1: FD 70 01        LD      (IY+$01),B
39D4: 3E 09           LD      A,$09
39D6: 32 0B 81        LD      ($810B),A           ; {ram.enemy3Tile} primary tile field
39D9: 32 1C 81        LD      ($811C),A           ; {ram.enemy3TwinTile} twin tile field
39DC: 3E 00           LD      A,$00
39DE: 32 0A 81        LD      ($810A),A           ; {ram.enemy3X} primary X/coord
39E1: 32 1B 81        LD      ($811B),A           ; {ram.enemy3TwinX} twin X/coord
39E4: 32 0C 81        LD      ($810C),A           ; {ram.enemy3Attr}
39E7: 32 1D 81        LD      ($811D),A           ; {ram.enemy3TwinAttr}
39EA: 32 17 81        LD      ($8117),A
39ED: 32 28 81        LD      ($8128),A
39F0: 3E B4           LD      A,$B4
39F2: 32 12 81        LD      ($8112),A           ; {ram.enemy3Timer} primary timer
39F5: 32 23 81        LD      ($8123),A           ; {ram.enemy3TwinTimer} twin timer
39F8: 3E 06           LD      A,$06
39FA: 32 1A 81        LD      ($811A),A           ; primary field = 0x06
39FD: 3C              INC     A                   ; 0x07
39FE: 32 2B 81        LD      ($812B),A           ; twin field = 0x07 (+1)
3A01: 3A 28 80        LD      A,($8028)           ; {ram.level}
3A04: E6 06           AND     $06                 ; keep bits 1..2
3A06: 47              LD      B,A
3A07: 3E 07           LD      A,$07
3A09: 90              SUB     B                   ; A = 0x07 - (0x8028 & 0x06)
3A0A: 32 18 81        LD      ($8118),A           ; primary start value
3A0D: 32 29 81        LD      ($8129),A           ; twin start value
3A10: C3 4C 3A        JP      $3A4C               ; {code.stageActorSpriteRecords}

; advanceActorMovers — advance the two-sprite actor's record(s) through the shared move/collision
; driver, then stage its sprite records for display. ROM 0x3a13.
advanceActorMovers:
3A13: 21 0A 81        LD      HL,$810A            ; {ram.enemy3X}
3A16: 11 83 80        LD      DE,$8083
3A19: 01 11 00        LD      BC,$0011
3A1C: ED B0           LDIR                        ; record 1 -> scratch (0x11 bytes)
3A1E: CD 9D 31        CALL    $319D               ; {code.stepEnemyMover} move/collision driver on the scratch block
3A21: 21 83 80        LD      HL,$8083
3A24: 11 0A 81        LD      DE,$810A            ; {ram.enemy3X}
3A27: 01 11 00        LD      BC,$0011
3A2A: ED B0           LDIR                        ; scratch -> record 1
3A2C: 3A 78 80        LD      A,($8078)           ; {ram.treasureCollected}
3A2F: B7              OR      A                   ; test the second-record gate
3A30: CA 4C 3A        JP      Z,$3A4C             ; {code.stageActorSpriteRecords} no -> tail-jump to loc_3a4c
3A33: 21 1B 81        LD      HL,$811B            ; {ram.enemy3TwinX}
3A36: 11 83 80        LD      DE,$8083
3A39: 01 11 00        LD      BC,$0011
3A3C: ED B0           LDIR                        ; record 2 -> scratch (0x11 bytes)
3A3E: CD 9D 31        CALL    $319D               ; {code.stepEnemyMover} move/collision driver on the scratch block
3A41: 21 83 80        LD      HL,$8083
3A44: 11 1B 81        LD      DE,$811B            ; {ram.enemy3TwinX}
3A47: 01 11 00        LD      BC,$0011
3A4A: ED B0           LDIR                        ; scratch -> record 2 ; PC now at loc_3a4c

; stageActorSpriteRecords — stage the current actor's two hardware sprite records (its main body
; and its shadow "twin") into the sprite buffer. ROM 0x3a4c.
stageActorSpriteRecords:
3A4C: 11 38 82        LD      DE,$8238            ; {ram.enemy3SpriteSlot} dest record 1
3A4F: 21 0A 81        LD      HL,$810A            ; {ram.enemy3X} source record 1
3A52: 01 03 00        LD      BC,$0003            ; PC now at the ldir
3A55: ED B0           LDIR                        ; 3 bytes; leaves HL=0x810d, DE=0x823b, BC=0
3A57: 3A 51 80        LD      A,($8051)           ; {ram.spriteCoordBias} the shared bias
3A5A: 47              LD      B,A                 ; B = bias
3A5B: 7E              LD      A,(HL)              ; A = source1[3] (HL = 0x810d)
3A5C: 80              ADD     A,B                 ; A = source1[3] + bias
3A5D: 12              LD      (DE),A              ; -> dest1[3] (DE = 0x823b)
3A5E: 78              LD      A,B                 ; stash bias in A (ld bc below clobbers B)
3A5F: 11 3C 82        LD      DE,$823C            ; {ram.enemy3TwinSpriteSlot} dest record 2
3A62: 21 1B 81        LD      HL,$811B            ; {ram.enemy3TwinX} source record 2
3A65: 01 03 00        LD      BC,$0003            ; PC now at the ldir
3A68: ED B0           LDIR                        ; 3 bytes; leaves HL=0x811e, DE=0x823f, BC=0
3A6A: 47              LD      B,A                 ; restore bias into B
3A6B: 7E              LD      A,(HL)              ; A = source2[3] (HL = 0x811e)
3A6C: 80              ADD     A,B                 ; A = source2[3] + bias
3A6D: 12              LD      (DE),A              ; -> dest2[3] (DE = 0x823f)
3A6E: C9              RET                         ; returns to loc_3a13's caller

; showSetupScreen — paint the round-setup screen (playfield furniture + two HUD count records) and
; hold it briefly while a colour band cycles. ROM 0x3a6f.
showSetupScreen:
3A6F: CD 44 4B        CALL    $4B44               ; {code.blankScreen}
3A72: CD F4 46        CALL    $46F4               ; {code.drawLeftEdgeColumn}
3A75: CD 2C 47        CALL    $472C               ; {code.redrawScoreHud}
3A78: 3E 01           LD      A,$01
3A7A: 0E 02           LD      C,$02
3A7C: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt}
3A7F: CD 49 3D        CALL    $3D49               ; {code.drawSetupCreditsPanel}
3A82: CD 8A 3D        CALL    $3D8A               ; {code.drawGameOverText}
3A85: CD 2A 49        CALL    $492A               ; {code.drawCopyrightLine}
3A88: CD 85 47        CALL    $4785               ; {code.drawBestScoresTodayLabel}
3A8B: CD A1 47        CALL    $47A1               ; {code.drawRightEdgeColumn}
3A8E: DD 21 8C 92     LD      IX,$928C            ; {hard.videoRam}
3A92: DD 36 00 01     LD      (IX+$00),$01
3A96: 3E 0C           LD      A,$0C
3A98: 32 58 80        LD      ($8058),A           ; {ram.tileCol}
3A9B: 3E 0D           LD      A,$0D
3A9D: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
3AA0: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
3AA3: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
3AA6: 3E 06           LD      A,$06
3AA8: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3AAB: DD 21 B0 49     LD      IX,$49B0
3AAF: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
3AB2: 3E 0C           LD      A,$0C
3AB4: 0E 07           LD      C,$07
3AB6: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt}
3AB9: DD 21 8E 92     LD      IX,$928E            ; {hard.videoRam}
3ABD: 3A 4C 80        LD      A,($804C)           ; {ram.coinsPerCreditA}
3AC0: DD 77 00        LD      (IX+$00),A
3AC3: 3E 0E           LD      A,$0E
3AC5: 32 58 80        LD      ($8058),A           ; {ram.tileCol}
3AC8: 3E 0C           LD      A,$0C
3ACA: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
3ACD: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
3AD0: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
3AD3: 3A 4C 80        LD      A,($804C)           ; {ram.coinsPerCreditA}
3AD6: A7              AND     A
3AD7: 28 08           JR      Z,$3AE1             ; {code.loc_3ae1}
3AD9: DD 21 6C 49     LD      IX,$496C
3ADD: 3E 07           LD      A,$07
3ADF: 18 06           JR      $3AE7               ; {code.loc_3ae7}

loc_3ae1:
3AE1: DD 21 AE 49     LD      IX,$49AE
3AE5: 3E 09           LD      A,$09

loc_3ae7:
3AE7: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3AEA: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
3AED: 3A 4C 80        LD      A,($804C)           ; {ram.coinsPerCreditA}
3AF0: 3D              DEC     A
3AF1: 20 08           JR      NZ,$3AFB            ; {code.loc_3afb}
3AF3: DD 21 8E 91     LD      IX,$918E            ; {hard.videoRam}
3AF7: DD 36 00 24     LD      (IX+$00),$24

loc_3afb:
3AFB: 3E 0E           LD      A,$0E
3AFD: 0E 07           LD      C,$07
3AFF: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt}
3B02: DD 21 92 92     LD      IX,$9292            ; {hard.videoRam}
3B06: DD 36 00 02     LD      (IX+$00),$02
3B0A: 3E 12           LD      A,$12
3B0C: 32 58 80        LD      ($8058),A           ; {ram.tileCol}
3B0F: 3E 0C           LD      A,$0C
3B11: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
3B14: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
3B17: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
3B1A: 3E 07           LD      A,$07
3B1C: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3B1F: DD 21 B1 49     LD      IX,$49B1
3B23: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
3B26: 3E 12           LD      A,$12
3B28: 0E 03           LD      C,$03
3B2A: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt}
3B2D: DD 21 94 92     LD      IX,$9294            ; {hard.videoRam}
3B31: 3A 4D 80        LD      A,($804D)           ; {ram.coinsPerCreditB}
3B34: DD 77 00        LD      (IX+$00),A
3B37: 3E 14           LD      A,$14
3B39: 32 58 80        LD      ($8058),A           ; {ram.tileCol}
3B3C: 3E 0C           LD      A,$0C
3B3E: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
3B41: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
3B44: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
3B47: 3A 4D 80        LD      A,($804D)           ; {ram.coinsPerCreditB}
3B4A: A7              AND     A
3B4B: 28 08           JR      Z,$3B55             ; {code.loc_3b55}
3B4D: DD 21 6C 49     LD      IX,$496C
3B51: 3E 07           LD      A,$07
3B53: 18 06           JR      $3B5B               ; {code.loc_3b5b}

loc_3b55:
3B55: DD 21 AE 49     LD      IX,$49AE
3B59: 3E 09           LD      A,$09

loc_3b5b:
3B5B: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3B5E: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
3B61: 3E 14           LD      A,$14
3B63: 0E 03           LD      C,$03
3B65: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt}
3B68: 3E 1E           LD      A,$1E
3B6A: 32 0A 80        LD      ($800A),A           ; {ram.loopCounter}

loc_3b6d:
3B6D: 3E 06           LD      A,$06
3B6F: CD 13 3E        CALL    $3E13               ; {code.cycleColumnColour}
3B72: 3E 0F           LD      A,$0F
3B74: CD FF 4B        CALL    $4BFF               ; {code.waitFrames}
3B77: 3A 0A 80        LD      A,($800A)           ; {ram.loopCounter}
3B7A: 3D              DEC     A
3B7B: 32 0A 80        LD      ($800A),A           ; {ram.loopCounter}
3B7E: 20 ED           JR      NZ,$3B6D            ; {code.loc_3b6d}
3B80: C9              RET

; showFixedScreen — paint a canned full-screen image from ROM and hold it briefly. ROM 0x3b81.
showFixedScreen:
3B81: CD 44 4B        CALL    $4B44               ; {code.blankScreen}
3B84: 3E 01           LD      A,$01
3B86: CD FF 4B        CALL    $4BFF               ; {code.waitFrames}
3B89: 11 00 90        LD      DE,$9000            ; {hard.videoRam}
3B8C: 21 32 3E        LD      HL,$3E32
3B8F: 01 00 04        LD      BC,$0400
3B92: ED B0           LDIR                        ; copy 0x400 bytes to video RAM
3B94: 11 00 88        LD      DE,$8800
3B97: 3E 93           LD      A,$93
3B99: 01 04 00        LD      BC,$0004

loc_3b9c:
3B9C: 12              LD      (DE),A
3B9D: 13              INC     DE
3B9E: 10 FC           DJNZ    $3B9C               ; {code.loc_3b9c} decrement B (no flags), loop while non-zero
3BA0: 0D              DEC     C
3BA1: 20 F9           JR      NZ,$3B9C            ; {code.loc_3b9c} another 256-byte pass while C != 0
3BA3: 3E A0           LD      A,$A0
3BA5: C3 FF 4B        JP      $4BFF               ; {code.waitFrames} tail-jump (pushes nothing; 0x4bff's ret returns to OUR caller)

; holdFixedScreen — paint a canned full-screen image from ROM, then hold it on display forever.
; ROM 0x3ba8.
holdFixedScreen:
3BA8: 3E 01           LD      A,$01
3BAA: CD FF 4B        CALL    $4BFF               ; {code.waitFrames}
3BAD: 11 00 90        LD      DE,$9000            ; {hard.videoRam}
3BB0: 21 32 42        LD      HL,$4232
3BB3: 01 00 04        LD      BC,$0400
3BB6: ED B0           LDIR                        ; copy 0x400 bytes of tilemap to video RAM
3BB8: 11 00 88        LD      DE,$8800
3BBB: 3E 02           LD      A,$02
3BBD: 01 04 00        LD      BC,$0004

loc_3bc0:
3BC0: 12              LD      (DE),A
3BC1: 13              INC     DE
3BC2: 10 FC           DJNZ    $3BC0               ; {code.loc_3bc0} decrement B (no flags), loop while non-zero
3BC4: 0D              DEC     C
3BC5: 20 F9           JR      NZ,$3BC0            ; {code.loc_3bc0} another 256-byte pass while C != 0
3BC7: 0E 07           LD      C,$07
3BC9: 3E 12           LD      A,$12
3BCB: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt} colour strip at 0x8840+0x12, attr 0x07
3BCE: 0E 04           LD      C,$04
3BD0: 3E 16           LD      A,$16
3BD2: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt} colour strip at 0x8840+0x16, attr 0x04
3BD5: 0E 06           LD      C,$06
3BD7: 3E 1A           LD      A,$1A
3BD9: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt} colour strip at 0x8840+0x1a, attr 0x06
3BDC: CD 49 3D        CALL    $3D49               ; {code.drawSetupCreditsPanel} finish screen setup

loc_3bdf:
3BDF: CD 7E 3D        CALL    $3D7E               ; {code.cycleStagedColumnColour}
3BE2: 3E 0F           LD      A,$0F
3BE4: CD FF 4B        CALL    $4BFF               ; {code.waitFrames}
3BE7: CD 55 4B        CALL    $4B55               ; {code.applyDipSwitches}
3BEA: 18 F3           JR      $3BDF               ; {code.loc_3bdf} unconditional, back to loc_3bdf

; showBonusScreen — paint a tier-selected status screen, then hold it with a count-length sound +
; score + colour-cycle animation. ROM 0x3bec.
showBonusScreen:
3BEC: 3E 05           LD      A,$05
3BEE: 32 0A 80        LD      ($800A),A           ; {ram.loopCounter}
3BF1: 3A 81 80        LD      A,($8081)           ; {ram.crystalCount}
3BF4: FE 04           CP      $04
3BF6: 20 08           JR      NZ,$3C00            ; {code.loc_3c00} skip the +5 unless (0x8081)==0x04
3BF8: 3A 0A 80        LD      A,($800A)           ; {ram.loopCounter}
3BFB: C6 05           ADD     A,$05
3BFD: 32 0A 80        LD      ($800A),A           ; {ram.loopCounter}

loc_3c00:
3C00: 3A 82 80        LD      A,($8082)           ; {ram.diamondCount}
3C03: FE 03           CP      $03
3C05: 20 08           JR      NZ,$3C0F            ; {code.loc_3c0f} skip the +5 unless (0x8082)==0x03
3C07: 3A 0A 80        LD      A,($800A)           ; {ram.loopCounter}
3C0A: C6 05           ADD     A,$05
3C0C: 32 0A 80        LD      ($800A),A           ; {ram.loopCounter}

loc_3c0f:
3C0F: CD C1 3C        CALL    $3CC1               ; {code.drawSharedPanel}
3C12: 3E 0F           LD      A,$0F
3C14: 32 58 80        LD      ($8058),A           ; {ram.tileCol}
3C17: 3E 0B           LD      A,$0B
3C19: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
3C1C: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
3C1F: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
3C22: 3E 0C           LD      A,$0C
3C24: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3C27: 3A 0A 80        LD      A,($800A)           ; {ram.loopCounter}
3C2A: FE 0F           CP      $0F
3C2C: 28 10           JR      Z,$3C3E             ; {code.loc_3c3e} row-1 text pointer, selected by the count
3C2E: FE 0A           CP      $0A
3C30: 28 06           JR      Z,$3C38             ; {code.loc_3c38}
3C32: DD 21 14 4A     LD      IX,$4A14
3C36: 18 0A           JR      $3C42               ; {code.loc_3c42}

loc_3c38:
3C38: DD 21 21 4A     LD      IX,$4A21
3C3C: 18 04           JR      $3C42               ; {code.loc_3c42}

loc_3c3e:
3C3E: DD 21 2E 4A     LD      IX,$4A2E

loc_3c42:
3C42: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
3C45: 3E 11           LD      A,$11
3C47: 32 58 80        LD      ($8058),A           ; {ram.tileCol}
3C4A: 3E 0B           LD      A,$0B
3C4C: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
3C4F: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
3C52: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
3C55: 3E 0C           LD      A,$0C
3C57: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3C5A: 3A 0A 80        LD      A,($800A)           ; {ram.loopCounter}
3C5D: FE 0F           CP      $0F
3C5F: CA 73 3C        JP      Z,$3C73             ; {code.loc_3c73} row-2 text pointer, selected by the count
3C62: FE 0A           CP      $0A
3C64: CA 6D 3C        JP      Z,$3C6D             ; {code.loc_3c6d}
3C67: DD 21 3B 4A     LD      IX,$4A3B
3C6B: 18 0A           JR      $3C77               ; {code.loc_3c77}

loc_3c6d:
3C6D: DD 21 48 4A     LD      IX,$4A48
3C71: 18 04           JR      $3C77               ; {code.loc_3c77}

loc_3c73:
3C73: DD 21 55 4A     LD      IX,$4A55

loc_3c77:
3C77: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
3C7A: 3E 11           LD      A,$11
3C7C: 0E A3           LD      C,$A3
3C7E: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt}
3C81: 3E 15           LD      A,$15
3C83: 32 58 80        LD      ($8058),A           ; {ram.tileCol}
3C86: 3E 09           LD      A,$09
3C88: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
3C8B: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
3C8E: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
3C91: 3E 0F           LD      A,$0F
3C93: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3C96: DD 21 07 4A     LD      IX,$4A07
3C9A: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
3C9D: 3E 15           LD      A,$15
3C9F: 0E A6           LD      C,$A6
3CA1: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt}

loc_3ca4:
3CA4: CD 6F 4C        CALL    $4C6F               ; {code.requestSound8}
3CA7: 01 10 00        LD      BC,$0010
3CAA: CD 89 46        CALL    $4689               ; {code.addScore}
3CAD: 3E 0F           LD      A,$0F
3CAF: CD 13 3E        CALL    $3E13               ; {code.cycleColumnColour}
3CB2: 3E 0F           LD      A,$0F
3CB4: CD FF 4B        CALL    $4BFF               ; {code.waitFrames}
3CB7: 3A 0A 80        LD      A,($800A)           ; {ram.loopCounter}
3CBA: 3D              DEC     A
3CBB: 32 0A 80        LD      ($800A),A           ; {ram.loopCounter} flag-neutral, preserves dec's Z
3CBE: 20 E4           JR      NZ,$3CA4            ; {code.loc_3ca4} loop while the count is non-zero
3CC0: C9              RET

; drawSharedPanel — lay out a fixed panel: the left edge column and both players' score HUD, three
; labelled tile/colour runs, then the right edge and playfield columns. ROM 0x3cc1.
drawSharedPanel:
3CC1: CD F4 46        CALL    $46F4               ; {code.drawLeftEdgeColumn}
3CC4: CD 2C 47        CALL    $472C               ; {code.redrawScoreHud}
3CC7: 3E 07           LD      A,$07
3CC9: 32 58 80        LD      ($8058),A           ; {ram.tileCol}
3CCC: 3E 09           LD      A,$09
3CCE: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
3CD1: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
3CD4: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
3CD7: 3E A5           LD      A,$A5
3CD9: 32 57 80        LD      ($8057),A           ; {ram.boardMode}
3CDC: 3E 0F           LD      A,$0F
3CDE: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3CE1: DD 21 7B 49     LD      IX,$497B
3CE5: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
3CE8: CD 01 3E        CALL    $3E01               ; {code.fillColourColumn}
3CEB: 3E 09           LD      A,$09
3CED: 32 58 80        LD      ($8058),A           ; {ram.tileCol}
3CF0: 3E 0D           LD      A,$0D
3CF2: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
3CF5: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
3CF8: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
3CFB: 3E A5           LD      A,$A5
3CFD: 32 57 80        LD      ($8057),A           ; {ram.boardMode}
3D00: 3E 01           LD      A,$01
3D02: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3D05: DD 21 02 80     LD      IX,$8002            ; {ram.activePlayer}
3D09: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
3D0C: 3E 07           LD      A,$07
3D0E: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3D11: DD 21 B1 49     LD      IX,$49B1
3D15: CD DB 3D        CALL    $3DDB               ; {code.copyCappedTileColumn}
3D18: 3E 08           LD      A,$08
3D1A: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3D1D: CD 01 3E        CALL    $3E01               ; {code.fillColourColumn}
3D20: 3E 0D           LD      A,$0D
3D22: 32 58 80        LD      ($8058),A           ; {ram.tileCol}
3D25: 3E 09           LD      A,$09
3D27: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
3D2A: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
3D2D: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
3D30: 3E 0F           LD      A,$0F
3D32: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3D35: DD 21 F7 49     LD      IX,$49F7
3D39: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
3D3C: 3E 0D           LD      A,$0D
3D3E: 0E A3           LD      C,$A3
3D40: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt}
3D43: CD 85 47        CALL    $4785               ; {code.drawBestScoresTodayLabel}
3D46: C3 A1 47        JP      $47A1               ; {code.drawRightEdgeColumn} tail-jump (pushes nothing; 0x47a1's ret returns to OUR caller)

; drawSetupCreditsPanel — paint one fixed 9-cell HUD/text panel at column 1, row 12. ROM 0x3d49.
drawSetupCreditsPanel:
3D49: 3E 01           LD      A,$01
3D4B: 32 58 80        LD      ($8058),A           ; {ram.tileCol}
3D4E: 3E 0C           LD      A,$0C
3D50: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
3D53: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
3D56: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
3D59: 3E 06           LD      A,$06
3D5B: 32 57 80        LD      ($8057),A           ; {ram.boardMode}
3D5E: 3E 01           LD      A,$01
3D60: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3D63: DD 21 00 80     LD      IX,$8000            ; {ram.creditCount}
3D67: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
3D6A: 3E 08           LD      A,$08
3D6C: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3D6F: DD 21 6D 49     LD      IX,$496D
3D73: CD DB 3D        CALL    $3DDB               ; {code.copyCappedTileColumn}
3D76: 3E 09           LD      A,$09
3D78: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
3D7B: C3 01 3E        JP      $3E01               ; {code.fillColourColumn} tail-jump (pushes nothing; 0x3e01's ret returns to OUR caller)

; cycleStagedColumnColour — advance the byte at BOARD_MODE, keeping bit 3 clear, then paint it
; down a column of cells. ROM 0x3d7e.
cycleStagedColumnColour:
3D7E: 3A 57 80        LD      A,($8057)           ; {ram.boardMode}
3D81: 3C              INC     A
3D82: E6 F7           AND     $F7
3D84: 32 57 80        LD      ($8057),A           ; {ram.boardMode}
3D87: C3 01 3E        JP      $3E01               ; {code.fillColourColumn} tail-jump; loc_3e01's ret returns to OUR caller

; drawGameOverText — paint one fixed 9-cell vertical strip at column 6, row 12. ROM 0x3d8a.
drawGameOverText:
3D8A: 3E 06           LD      A,$06
3D8C: 32 58 80        LD      ($8058),A           ; {ram.tileCol} column byte = 6
3D8F: 3E 0C           LD      A,$0C
3D91: 32 59 80        LD      ($8059),A           ; {ram.tileRow} row byte = 12
3D94: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset} row/col -> tilemap offset @0x805a
3D97: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors} offset -> colour@0x805e, video@0x8060
3D9A: 3E 06           LD      A,$06
3D9C: 32 57 80        LD      ($8057),A           ; {ram.boardMode} fill/tile byte = 6
3D9F: 3E 09           LD      A,$09
3DA1: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength} row count = 9
3DA4: DD 21 A5 49     LD      IX,$49A5            ; descending source pointer
3DA8: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn} copy 9 tiles down the video column
3DAB: C3 01 3E        JP      $3E01               ; {code.fillColourColumn} tail-jump; loc_3e01's ret returns to OUR caller

; rowColToTileOffset — turn a (row, column) tile-cell into a linear tilemap offset. ROM 0x3dae.
rowColToTileOffset:
3DAE: 3A 59 80        LD      A,($8059)           ; {ram.tileRow}
3DB1: 67              LD      H,A
3DB2: 3E 00           LD      A,$00
3DB4: CB 3C           SRL     H
3DB6: 1F              RRA
3DB7: CB 3C           SRL     H
3DB9: 1F              RRA
3DBA: CB 3C           SRL     H
3DBC: 1F              RRA
3DBD: 6F              LD      L,A
3DBE: 3A 58 80        LD      A,($8058)           ; {ram.tileCol}
3DC1: 4F              LD      C,A
3DC2: 06 00           LD      B,$00
3DC4: 09              ADD     HL,BC
3DC5: 22 5A 80        LD      ($805A),HL          ; {ram.tilemapOffset}
3DC8: C9              RET

; deriveTileWriteCursors — turn a tile's tilemap offset into its colour-RAM and video-RAM write
; cursors. ROM 0x3dc9.
deriveTileWriteCursors:
3DC9: 2A 5A 80        LD      HL,($805A)          ; {ram.tilemapOffset}
3DCC: 11 00 88        LD      DE,$8800
3DCF: 19              ADD     HL,DE
3DD0: 22 5E 80        LD      ($805E),HL          ; {ram.colourRamCursor}
3DD3: 11 00 08        LD      DE,$0800
3DD6: 19              ADD     HL,DE
3DD7: 22 60 80        LD      ($8060),HL
3DDA: C9              RET

; copyCappedTileColumn — copy a tile-code run down a video-RAM column, but cap the top cell. ROM
; 0x3ddb.
copyCappedTileColumn:
3DDB: 3A 55 80        LD      A,($8055)           ; {ram.plotRunLength} A = strip height (loop count)
3DDE: 47              LD      B,A                 ; B = count
3DDF: 2A 60 80        LD      HL,($8060)          ; HL = write cursor
3DE2: 11 20 00        LD      DE,$0020            ; stride = 32 (one row down)
3DE5: 3A 0F 4B        LD      A,($4B0F)           ; A = the FIRST (cap) byte
3DE8: 18 0D           JR      $3DF7               ; {code.loc_3df7} enter the loop at loc_3df7, past loc_3df4's (ix) load

; copyTileColumn — copy a stored run of tile codes straight down a video-RAM column. ROM 0x3dea.
copyTileColumn:
3DEA: 3A 55 80        LD      A,($8055)           ; {ram.plotRunLength}
3DED: 47              LD      B,A
3DEE: 2A 60 80        LD      HL,($8060)
3DF1: 11 20 00        LD      DE,$0020

loc_3df4:
3DF4: DD 7E 00        LD      A,(IX+$00)          ; A = next source byte

loc_3df7:
3DF7: 77              LD      (HL),A              ; write the cell
3DF8: 19              ADD     HL,DE               ; sets H/N/C, keeps S/Z/PV
3DF9: DD 2B           DEC     IX                  ; source pointer walks down
3DFB: 10 F7           DJNZ    $3DF4               ; {code.loc_3df4} decrement B (no flags), loop while non-zero
3DFD: 22 60 80        LD      ($8060),HL          ; store the advanced cursor
3E00: C9              RET

; fillColourColumn — paint a vertical run of colour-RAM cells with one colour byte. ROM 0x3e01.
fillColourColumn:
3E01: 2A 5E 80        LD      HL,($805E)          ; {ram.colourRamCursor} column base pointer
3E04: 11 20 00        LD      DE,$0020            ; stride: one row down the column
3E07: 3A 55 80        LD      A,($8055)           ; {ram.plotRunLength}
3E0A: 47              LD      B,A                 ; row count -> B (djnz)
3E0B: 3A 57 80        LD      A,($8057)           ; {ram.boardMode} the fill byte

loc_3e0e:
3E0E: 77              LD      (HL),A              ; loc_3e0e -- the djnz loop body
3E0F: 19              ADD     HL,DE
3E10: 10 FC           DJNZ    $3E0E               ; {code.loc_3e0e}
3E12: C9              RET

; cycleColumnColour — advance the shared colour index and repaint one screen column with it. ROM
; 0x3e13.
cycleColumnColour:
3E13: 5F              LD      E,A                 ; E = entry A -> column byte offset
3E14: 3A 57 80        LD      A,($8057)           ; {ram.boardMode} the current colour index
3E17: 3C              INC     A                   ; ++
3E18: E6 F7           AND     $F7                 ; keep it out of bit 3 (mask 1111_0111)
3E1A: 4F              LD      C,A                 ; C = the advanced index
3E1B: 18 01           JR      $3E1E               ; {code.loc_3e1e} skip loc_3e1d's own `ld e,a`

; fillColourColumnAt — paint a full-height colour-RAM column with one colour. ROM 0x3e1d.
fillColourColumnAt:
3E1D: 5F              LD      E,A                 ; loc_3e1d entry: column offset A -> E

loc_3e1e:
3E1E: 16 00           LD      D,$00               ; loc_3e1e (also reached from loc_3e13)
3E20: 21 40 88        LD      HL,$8840            ; colour RAM, top of the column (row 2)
3E23: 19              ADD     HL,DE               ; + column offset -> base pointer
3E24: 79              LD      A,C                 ; A = the index to paint
3E25: 32 57 80        LD      ($8057),A           ; {ram.boardMode} write the advanced index back
3E28: 11 20 00        LD      DE,$0020            ; stride: one row down the 32-wide map
3E2B: 06 1C           LD      B,$1C               ; 28 rows -> B (djnz)

loc_3e2d:
3E2D: 77              LD      (HL),A              ; loc_3e2d -- the djnz loop body
3E2E: 19              ADD     HL,DE               ; advance one row
3E2F: 10 FC           DJNZ    $3E2D               ; {code.loc_3e2d}
3E31: C9              RET

; ==== UNREACHED 0x3e32-0x4631 (2048 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
3E32:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
3E42:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
3E52:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
3E62:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
3E72:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
3E82:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
3E92:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$24,$24
3EA2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
3EB2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$24,$24
3EC2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
3ED2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$29,$29,$29,$29,$29,$29,$29
3EE2:                 DEFB    $29,$29,$29,$29,$29,$29,$29,$29,$29,$29,$29,$29,$29,$29,$24,$24
3EF2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$24,$24
3F02:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
3F12:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$24,$24
3F22:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$0C,$24,$24
3F32:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$24,$24
3F42:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$17,$24,$24
3F52:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$24,$24
3F62:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$12,$24,$24
3F72:                 DEFB    $24,$24,$29,$24,$29,$24,$29,$24,$29,$24,$24,$24,$24,$24,$24,$24
3F82:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
3F92:                 DEFB    $24,$24,$29,$24,$29,$24,$29,$24,$29,$24,$24,$24,$24,$24,$24,$24
3FA2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$12,$24,$24
3FB2:                 DEFB    $24,$24,$29,$29,$29,$29,$29,$24,$29,$24,$24,$24,$24,$24,$24,$24
3FC2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$1B,$24,$24
3FD2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$24,$24
3FE2:                 DEFB    $29,$24,$29,$29,$29,$29,$29,$29,$29,$29,$29,$29,$24,$1E,$24,$24
3FF2:                 DEFB    $24,$24,$29,$29,$29,$29,$29,$24,$24,$24,$24,$24,$24,$24,$24,$24
4002:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$1D,$24,$24
4012:                 DEFB    $24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4022:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$17,$24,$24
4032:                 DEFB    $24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4042:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$0E,$24,$24
4052:                 DEFB    $24,$24,$29,$29,$29,$29,$29,$24,$24,$24,$24,$24,$24,$24,$24,$24
4062:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$0C,$24,$24
4072:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$29,$29,$29,$29,$29,$29,$24
4082:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4092:                 DEFB    $24,$24,$29,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$29,$24
40A2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
40B2:                 DEFB    $24,$24,$29,$29,$29,$29,$29,$24,$29,$24,$24,$24,$24,$24,$29,$24
40C2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$02,$24,$24
40D2:                 DEFB    $24,$24,$29,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$29,$24
40E2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$08,$24,$24
40F2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$29,$24
4102:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$09,$24,$24
4112:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$29,$24
4122:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$01,$24,$24
4132:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$29,$24
4142:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$3F,$24,$24
4152:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$29,$24
4162:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4172:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$29,$29,$29,$29,$29,$29,$29
4182:                 DEFB    $29,$29,$29,$29,$29,$29,$29,$29,$29,$29,$29,$29,$29,$29,$24,$24
4192:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$24,$24
41A2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
41B2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$29,$24,$24,$24,$24,$24,$24,$24
41C2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
41D2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
41E2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
41F2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4202:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4212:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4222:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4232:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4242:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4252:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4262:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4272:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4282:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4292:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
42A2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$1C,$1C,$24,$24,$24,$24,$24,$24,$24
42B2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
42C2:                 DEFB    $24,$24,$1C,$24,$24,$24,$1C,$15,$15,$24,$1C,$24,$24,$24,$24,$24
42D2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
42E2:                 DEFB    $24,$24,$1D,$24,$24,$24,$1D,$0E,$0E,$24,$1D,$24,$24,$24,$24,$24
42F2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4302:                 DEFB    $24,$24,$17,$15,$24,$24,$17,$20,$20,$24,$17,$1C,$24,$24,$24,$24
4312:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4322:                 DEFB    $24,$24,$12,$0E,$24,$24,$12,$0E,$0E,$24,$12,$15,$24,$24,$24,$24
4332:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$1D,$24,$24,$24,$24,$24,$24,$24
4342:                 DEFB    $24,$24,$18,$20,$19,$24,$18,$13,$13,$24,$18,$0E,$24,$24,$24,$24
4352:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$12,$24,$1D,$15,$24,$24,$24,$24
4362:                 DEFB    $24,$24,$19,$0E,$12,$24,$19,$24,$24,$24,$19,$20,$24,$24,$24,$24
4372:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$17,$19,$24,$1C,$0E,$24,$19,$1D,$24
4382:                 DEFB    $24,$24,$24,$13,$11,$24,$24,$0E,$15,$24,$24,$0E,$24,$24,$24,$24
4392:                 DEFB    $24,$24,$24,$24,$24,$24,$0E,$20,$24,$24,$0A,$20,$24,$12,$12,$24
43A2:                 DEFB    $24,$24,$00,$24,$1C,$24,$00,$10,$15,$24,$00,$13,$24,$24,$24,$24
43B2:                 DEFB    $24,$24,$24,$24,$24,$1D,$16,$18,$16,$24,$0E,$0E,$24,$11,$19,$24
43C2:                 DEFB    $24,$24,$00,$0E,$24,$24,$00,$1B,$0A,$24,$00,$24,$24,$24,$24,$24
43D2:                 DEFB    $24,$24,$24,$24,$24,$0C,$0A,$0D,$18,$24,$15,$13,$24,$1C,$24,$24
43E2:                 DEFB    $24,$24,$00,$10,$18,$24,$00,$0A,$16,$24,$00,$07,$24,$24,$24,$24
43F2:                 DEFB    $24,$24,$24,$24,$24,$0E,$10,$24,$1D,$24,$24,$24,$24,$24,$1B,$24
4402:                 DEFB    $24,$24,$05,$1B,$1D,$24,$00,$15,$1C,$24,$05,$24,$24,$24,$24,$24
4412:                 DEFB    $24,$24,$24,$24,$24,$13,$24,$10,$1D,$0D,$1D,$0E,$17,$18,$0E,$24
4422:                 DEFB    $24,$24,$24,$0A,$24,$24,$01,$24,$24,$24,$01,$15,$24,$24,$24,$24
4432:                 DEFB    $24,$24,$24,$24,$24,$0B,$1C,$12,$18,$17,$0A,$10,$0E,$1D,$19,$24
4442:                 DEFB    $24,$24,$24,$15,$17,$24,$24,$03,$04,$24,$24,$15,$24,$24,$24,$24
4452:                 DEFB    $24,$24,$24,$24,$24,$18,$12,$0D,$0B,$0A,$24,$1B,$11,$24,$19,$24
4462:                 DEFB    $24,$24,$1C,$24,$1B,$24,$1C,$24,$24,$24,$1C,$0A,$24,$24,$24,$24
4472:                 DEFB    $24,$24,$24,$24,$24,$24,$11,$24,$24,$24,$1D,$0A,$1D,$17,$1E,$24
4482:                 DEFB    $24,$24,$1E,$01,$1E,$24,$1E,$15,$15,$24,$1E,$24,$24,$24,$24,$24
4492:                 DEFB    $24,$24,$24,$24,$24,$0E,$1D,$18,$0E,$24,$0C,$15,$24,$1B,$24,$24
44A2:                 DEFB    $24,$24,$17,$24,$1D,$24,$17,$15,$15,$24,$17,$1D,$24,$24,$24,$24
44B2:                 DEFB    $24,$24,$24,$24,$24,$11,$24,$1D,$11,$24,$0E,$24,$24,$1E,$1E,$24
44C2:                 DEFB    $24,$24,$18,$1D,$0E,$24,$18,$0A,$0A,$24,$18,$0C,$24,$24,$24,$24
44D2:                 DEFB    $24,$24,$24,$24,$24,$1D,$0F,$24,$1D,$24,$15,$0E,$24,$1D,$1B,$24
44E2:                 DEFB    $24,$24,$0B,$0C,$1B,$24,$0B,$24,$24,$24,$0B,$0E,$24,$24,$24,$24
44F2:                 DEFB    $24,$24,$24,$24,$24,$24,$18,$1C,$24,$24,$15,$17,$24,$0E,$11,$24
4502:                 DEFB    $24,$24,$24,$0E,$24,$24,$24,$1D,$24,$24,$24,$15,$24,$24,$24,$24
4512:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$12,$18,$24,$18,$18,$24,$1B,$1D,$24
4522:                 DEFB    $24,$24,$0E,$15,$0D,$24,$0E,$0C,$24,$24,$0E,$15,$24,$24,$24,$24
4532:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$1D,$24,$0C,$24,$24,$24,$24,$24
4542:                 DEFB    $24,$24,$15,$15,$17,$24,$15,$0E,$1B,$24,$15,$18,$24,$24,$24,$24
4552:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4562:                 DEFB    $24,$24,$10,$18,$0A,$24,$0B,$15,$18,$24,$19,$0C,$24,$24,$24,$24
4572:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4582:                 DEFB    $24,$24,$17,$0C,$24,$24,$1E,$15,$24,$24,$12,$24,$24,$24,$24,$24
4592:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
45A2:                 DEFB    $24,$24,$12,$24,$24,$24,$18,$18,$24,$24,$1B,$24,$24,$24,$24,$24
45B2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
45C2:                 DEFB    $24,$24,$1C,$24,$24,$24,$0D,$0C,$24,$24,$1D,$24,$24,$24,$24,$24
45D2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
45E2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
45F2:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4602:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4612:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4622:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24

; saveActivePlayerRecord — copy the live working game record into the backup slot of the player
; whose turn it is, so their progress survives the turn switch. ROM 0x4632.
saveActivePlayerRecord:
4632: FD 21 28 80     LD      IY,$8028            ; {ram.level}
4636: DD 21 29 80     LD      IX,$8029
463A: 3A 02 80        LD      A,($8002)           ; {ram.activePlayer}
463D: 3D              DEC     A
463E: 28 14           JR      Z,$4654             ; {code.loc_4654} (0x8002)==1 -> keep ix=0x8029
4640: DD 23           INC     IX                  ; else dest = 0x802A
4642: 18 10           JR      $4654               ; {code.loc_4654}

; loadPlayerState — make the selected player's saved level/score the current live state. ROM
; 0x4644.
loadPlayerState:
4644: DD 21 28 80     LD      IX,$8028            ; {ram.level}
4648: FD 21 29 80     LD      IY,$8029
464C: 3A 02 80        LD      A,($8002)           ; {ram.activePlayer}
464F: 3D              DEC     A
4650: 28 02           JR      Z,$4654             ; {code.loc_4654}
4652: FD 23           INC     IY

loc_4654:
4654: FD 7E 00        LD      A,(IY+$00)          ; loc_4654
4657: DD 77 00        LD      (IX+$00),A
465A: FD 7E 03        LD      A,(IY+$03)
465D: DD 77 03        LD      (IX+$03),A
4660: FD 7E 06        LD      A,(IY+$06)
4663: DD 77 06        LD      (IX+$06),A
4666: FD 7E 09        LD      A,(IY+$09)
4669: DD 77 09        LD      (IX+$09),A
466C: FD 7E 0C        LD      A,(IY+$0C)
466F: DD 77 0C        LD      (IX+$0C),A

loc_4672:
4672: C9              RET                         ; return to caller

; awardOnePoint — add one point to the running score. ROM 0x4673.
awardOnePoint:
4673: CD 83 4C        CALL    $4C83               ; {code.requestSound13} queue sound-effect 0x0D (returns to 0x4676)
4676: 01 01 00        LD      BC,$0001            ; score increment = 1 point
4679: 18 0E           JR      $4689               ; {code.addScore} tail-jump into the shared scorer (its ret returns to OUR caller)

; awardTenPoints — add 10 to the active player's score (with its sound), then repaint the digits.
; ROM 0x467b.
awardTenPoints:
467B: CD 8F 4C        CALL    $4C8F               ; {code.requestSound16} sound effect 0x10
467E: 01 10 00        LD      BC,$0010            ; BCD score increment (+10)
4681: 18 06           JR      $4689               ; {code.addScore} tail-jump; loc_4689's ret returns to OUR caller

; awardTwentyPoints — add 20 to the active player's score (with its sound), then repaint the
; digits. ROM 0x4683.
awardTwentyPoints:
4683: CD 8F 4C        CALL    $4C8F               ; {code.requestSound16} sound/effect kick; its register effects are overwritten below
4686: 01 20 00        LD      BC,$0020            ; BCD points-to-add = 0x20

; addScore — add points to the active player's score and repaint the digits. ROM 0x4689.
addScore:
4689: 3A 01 80        LD      A,($8001)           ; {ram.gameState} active-player slot
468C: 3D              DEC     A
468D: FE 02           CP      $02                 ; carry set iff (0x8001)-1 < 2, i.e. slot in {1,2}
468F: 30 E1           JR      NC,$4672            ; {code.loc_4672} carry clear ((0x8001)-1 >= 2) jumps to the bare ret at
4691: 3A 31 80        LD      A,($8031)           ; {ram.scoreLo} score low BCD byte
4694: 81              ADD     A,C
4695: 27              DAA                         ; BCD-correct the low byte (may set carry)
4696: 32 31 80        LD      ($8031),A           ; {ram.scoreLo}
4699: 3A 34 80        LD      A,($8034)           ; {ram.scoreHi} score high BCD byte
469C: 88              ADC     A,B                 ; + the carry the low-byte daa left
469D: 27              DAA                         ; BCD-correct the high byte
469E: 32 34 80        LD      ($8034),A           ; {ram.scoreHi}
46A1: 18 0C           JR      $46AF               ; {code.drawScoreDigits} TAIL into loc_46af; it pushes nothing, so loc_46af's own

; ==== UNREACHED 0x46a3-0x46ae (12 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
46A3:                 DEFB    $28,$0A,$47,$3A,$0D,$80,$E6,$77,$B8,$CA,$A4,$01

; drawScoreDigits — repaint the active player's on-screen score digits. ROM 0x46af.
drawScoreDigits:
46AF: 3A 02 80        LD      A,($8002)           ; {ram.activePlayer}
46B2: 3D              DEC     A
46B3: 20 06           JR      NZ,$46BB            ; {code.loc_46bb}
46B5: DD 21 01 93     LD      IX,$9301            ; {hard.videoRam}
46B9: 18 04           JR      $46BF               ; {code.loc_46bf}

loc_46bb:
46BB: DD 21 C1 90     LD      IX,$90C1            ; {hard.videoRam}

loc_46bf:
46BF: 3A 31 80        LD      A,($8031)           ; {ram.scoreLo}
46C2: 4F              LD      C,A
46C3: E6 0F           AND     $0F
46C5: DD 77 00        LD      (IX+$00),A
46C8: 79              LD      A,C
46C9: CB 3F           SRL     A
46CB: CB 3F           SRL     A
46CD: CB 3F           SRL     A
46CF: CB 3F           SRL     A
46D1: DD 77 20        LD      (IX+$20),A
46D4: 3A 34 80        LD      A,($8034)           ; {ram.scoreHi}
46D7: 4F              LD      C,A
46D8: 06 00           LD      B,$00
46DA: CB 3F           SRL     A
46DC: CB 3F           SRL     A
46DE: CB 3F           SRL     A
46E0: CB 3F           SRL     A
46E2: 20 03           JR      NZ,$46E7            ; {code.loc_46e7}
46E4: 3E 24           LD      A,$24
46E6: 47              LD      B,A

loc_46e7:
46E7: DD 77 60        LD      (IX+$60),A
46EA: 79              LD      A,C
46EB: E6 0F           AND     $0F
46ED: 20 01           JR      NZ,$46F0            ; {code.loc_46f0}
46EF: 78              LD      A,B

loc_46f0:
46F0: DD 77 40        LD      (IX+$40),A
46F3: C9              RET

; drawLeftEdgeColumn — stamp the fixed playfield edge column: a 32-tile picture strip up video
; column 0, then three fixed colour runs that tint it. ROM 0x46f4.
drawLeftEdgeColumn:
46F4: DD 21 AB 4A     LD      IX,$4AAB            ; IX = tile source strip
46F8: 21 E0 93        LD      HL,$93E0            ; {hard.videoRam} HL = top of the video column
46FB: 11 E0 FF        LD      DE,$FFE0            ; DE = -0x20 (one row up per pass)
46FE: 06 20           LD      B,$20               ; 32 tiles

loc_4700:
4700: DD 7E 00        LD      A,(IX+$00)          ; A = next source tile
4703: 77              LD      (HL),A              ; write it
4704: 19              ADD     HL,DE               ; sets H/N/C, keeps S/Z/PV
4705: DD 23           INC     IX                  ; source pointer walks up
4707: 10 F7           DJNZ    $4700               ; {code.loc_4700} B-- (no flags), loop while non-zero
4709: 21 A0 8B        LD      HL,$8BA0            ; HL = top of first colour column
470C: 11 E0 FF        LD      DE,$FFE0            ; DE = -0x20
470F: 3E 02           LD      A,$02               ; colour 0x02
4711: 06 09           LD      B,$09               ; 9 cells

loc_4713:
4713: 77              LD      (HL),A
4714: 19              ADD     HL,DE
4715: 10 FC           DJNZ    $4713               ; {code.loc_4713} -> loc_4713
4717: 21 40 89        LD      HL,$8940            ; HL = top of second colour column
471A: 06 09           LD      B,$09               ; 9 cells (A still 0x02)

loc_471c:
471C: 77              LD      (HL),A
471D: 19              ADD     HL,DE
471E: 10 FC           DJNZ    $471C               ; {code.loc_471c} -> loc_471c
4720: 21 80 8A        LD      HL,$8A80            ; HL = top of third colour column
4723: 3E 03           LD      A,$03               ; colour 0x03
4725: 06 0A           LD      B,$0A               ; 10 cells

loc_4727:
4727: 77              LD      (HL),A
4728: 19              ADD     HL,DE
4729: 10 FC           DJNZ    $4727               ; {code.loc_4727} -> loc_4727
472B: C9              RET                         ; unconditional, 10 T

; redrawScoreHud — repaint both players' on-screen score displays, draw the status label, and tint
; the two HUD colour columns. ROM 0x472c.
redrawScoreHud:
472C: 3A 02 80        LD      A,($8002)           ; {ram.activePlayer} A = active player index
472F: 5F              LD      E,A                 ; save active player index
4730: 3E 01           LD      A,$01
4732: 32 02 80        LD      ($8002),A           ; {ram.activePlayer} select player 1
4735: CD 44 46        CALL    $4644               ; {code.loadPlayerState} copy player 1 state -> shared slot
4738: CD AF 46        CALL    $46AF               ; {code.drawScoreDigits} draw player 1 score digits
473B: DD 36 E0 00     LD      (IX-$20),$00        ; blank cell one row up
473F: DD 36 C0 00     LD      (IX-$40),$00        ; blank cell two rows up
4743: 3E 02           LD      A,$02
4745: 32 02 80        LD      ($8002),A           ; {ram.activePlayer} select player 2
4748: CD 44 46        CALL    $4644               ; {code.loadPlayerState} copy player 2 state -> shared slot
474B: CD AF 46        CALL    $46AF               ; {code.drawScoreDigits} draw player 2 score digits
474E: DD 36 E0 00     LD      (IX-$20),$00
4752: DD 36 C0 00     LD      (IX-$40),$00
4756: 7B              LD      A,E                 ; restore active player index
4757: 32 02 80        LD      ($8002),A           ; {ram.activePlayer}
475A: CD 44 46        CALL    $4644               ; {code.loadPlayerState} copy active player state -> shared slot
475D: 3A 01 80        LD      A,($8001)           ; {ram.gameState} player count
4760: 3D              DEC     A
4761: FE 02           CP      $02                 ; carry set iff (count-1) < 2
4763: 30 05           JR      NC,$476A            ; {code.loc_476a} (count-1) >= 2  -> 3+ player HUD
4765: CD E1 47        CALL    $47E1               ; {code.drawPlayerLabel} return addr = 0x4768
4768: 18 03           JR      $476D               ; {code.loc_476d}

loc_476a:
476A: CD E5 48        CALL    $48E5               ; {code.drawGameOverLabel} return addr = 0x476d

loc_476d:
476D: 21 A1 8B        LD      HL,$8BA1            ; first colour column
4770: 11 E0 FF        LD      DE,$FFE0            ; -0x20 per pass (one row up)
4773: 3E 02           LD      A,$02               ; colour 0x02
4775: 06 09           LD      B,$09               ; 9 cells

loc_4777:
4777: 77              LD      (HL),A
4778: 19              ADD     HL,DE               ; sets H/N/C, keeps S/Z/PV
4779: 10 FC           DJNZ    $4777               ; {code.loc_4777} B-- (no flags), loop while non-zero
477B: 21 61 89        LD      HL,$8961            ; second colour column
477E: 06 0A           LD      B,$0A               ; 10 cells (A still 0x02)

loc_4780:
4780: 77              LD      (HL),A
4781: 19              ADD     HL,DE
4782: 10 FC           DJNZ    $4780               ; {code.loc_4780}
4784: C9              RET                         ; unconditional, 10 T

; drawBestScoresTodayLabel — stamp a fixed edge column, then hand off to the colour fill to tint
; it. ROM 0x4785.
drawBestScoresTodayLabel:
4785: DD 21 CB 4A     LD      IX,$4ACB            ; IX = tile source strip
4789: 21 FE 93        LD      HL,$93FE            ; {hard.videoRam} HL = top of the video column
478C: 11 E0 FF        LD      DE,$FFE0            ; DE = -0x20 (one row up per pass)
478F: 06 20           LD      B,$20               ; 32 tiles

loc_4791:
4791: DD 7E 00        LD      A,(IX+$00)          ; A = next source tile
4794: 77              LD      (HL),A              ; write it
4795: 19              ADD     HL,DE               ; sets H/N/C, keeps S/Z/PV
4796: DD 23           INC     IX                  ; source pointer walks up
4798: 10 F7           DJNZ    $4791               ; {code.loc_4791} B-- (no flags), loop while non-zero
479A: 0E 01           LD      C,$01               ; fill byte for loc_3e1d's colour column
479C: 3E 1E           LD      A,$1E               ; column offset for the colour column
479E: C3 1D 3E        JP      $3E1D               ; {code.fillColourColumnAt} tail-jump; loc_3e1d's ret returns to OUR caller

; drawRightEdgeColumn — draw the rightmost playfield column: a 28-tile strip from work RAM up
; video column 31, a base colour, then three 3-cell colour accents. ROM 0x47a1.
drawRightEdgeColumn:
47A1: DD 21 82 82     LD      IX,$8282            ; IX = work-RAM source strip
47A5: 21 BF 93        LD      HL,$93BF            ; {hard.videoRam} HL = top of the video column
47A8: 11 E0 FF        LD      DE,$FFE0            ; DE = -0x20 (one row up per pass)
47AB: 06 1C           LD      B,$1C               ; 28 tiles

loc_47ad:
47AD: DD 7E 00        LD      A,(IX+$00)          ; A = next source byte
47B0: 77              LD      (HL),A              ; write it
47B1: DD 23           INC     IX                  ; source pointer walks up
47B3: 19              ADD     HL,DE               ; sets H/N/C, keeps S/Z/PV
47B4: 10 F7           DJNZ    $47AD               ; {code.loc_47ad} B-- (no flags), loop while non-zero
47B6: 0E 02           LD      C,$02               ; loc_3e1d fill byte
47B8: 3E 1F           LD      A,$1F               ; loc_3e1d column selector
47BA: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt} fill a colour column
47BD: 21 9F 8B        LD      HL,$8B9F            ; HL = top of the trim column
47C0: 11 E0 FF        LD      DE,$FFE0            ; DE = -0x20 (within a column)
47C3: 01 20 FF        LD      BC,$FF20            ; BC = -0xE0 (hop to next column)
47C6: 36 06           LD      (HL),$06
47C8: 19              ADD     HL,DE
47C9: 36 06           LD      (HL),$06
47CB: 19              ADD     HL,DE
47CC: 36 06           LD      (HL),$06
47CE: 09              ADD     HL,BC               ; hop to next column (-0xE0)
47CF: 36 04           LD      (HL),$04
47D1: 19              ADD     HL,DE
47D2: 36 04           LD      (HL),$04
47D4: 19              ADD     HL,DE
47D5: 36 04           LD      (HL),$04
47D7: 09              ADD     HL,BC               ; hop to next column (-0xE0)
47D8: 36 07           LD      (HL),$07
47DA: 19              ADD     HL,DE
47DB: 36 07           LD      (HL),$07
47DD: 19              ADD     HL,DE
47DE: 36 07           LD      (HL),$07
47E0: C9              RET                         ; unconditional, 10 T

; drawPlayerLabel — paint one fixed vertical panel (a tile column plus its matching colour column)
; into the playfield at screen column 1, row 12. ROM 0x47e1.
drawPlayerLabel:
47E1: 3E 01           LD      A,$01
47E3: 32 58 80        LD      ($8058),A           ; {ram.tileCol} column group
47E6: 3E 0C           LD      A,$0C
47E8: 32 59 80        LD      ($8059),A           ; {ram.tileRow} row
47EB: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset} row 0x8059 -> 16-bit tilemap offset at 0x805a
47EE: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors} offset 0x805a -> colour-RAM (0x805e) + video-RAM (0x8060)
47F1: 3E 07           LD      A,$07
47F3: 32 57 80        LD      ($8057),A           ; {ram.boardMode} fill byte
47F6: 3E 01           LD      A,$01
47F8: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength} run length = 1
47FB: DD 21 02 80     LD      IX,$8002            ; {ram.activePlayer} copy source
47FF: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn} copy 1 byte down the column from ix=0x8002
4802: 3E 07           LD      A,$07
4804: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength} run length = 7
4807: DD 21 B1 49     LD      IX,$49B1            ; ROM table source
480B: CD DB 3D        CALL    $3DDB               ; {code.copyCappedTileColumn} fill 7 cells (first fixed byte, then ix walked back)
480E: 3E 09           LD      A,$09
4810: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength} run length = 9
4813: C3 01 3E        JP      $3E01               ; {code.fillColourColumn} TAIL into loc_3e01; it pushes nothing, so loc_3e01's own

; paintPlayfieldStripCol1Row11 — paint one fixed vertical tile strip of the round's static
; playfield, then its matching colour column. ROM 0x4816.
paintPlayfieldStripCol1Row11:
4816: 3E 01           LD      A,$01
4818: 32 58 80        LD      ($8058),A           ; {ram.tileCol} column = 1
481B: 3E 0B           LD      A,$0B
481D: 32 59 80        LD      ($8059),A           ; {ram.tileRow} row = 0x0b
4820: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset} row/col -> tile offset @0x805a
4823: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors} offset -> colour/video addrs @0x805e/0x8060
4826: 3E 00           LD      A,$00
4828: 32 57 80        LD      ($8057),A           ; {ram.boardMode} fill byte = 0x00
482B: 3E 0A           LD      A,$0A
482D: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength} strip height = 0x0a
4830: DD 21 4F 49     LD      IX,$494F            ; source table (walked by loc_3ddb)
4834: CD DB 3D        CALL    $3DDB               ; {code.copyCappedTileColumn} fill the tilemap strip
4837: C3 01 3E        JP      $3E01               ; {code.fillColourColumn} TAIL into loc_3e01; no push, so loc_3e01's ret returns

; drawMenLeftPanel — paint one HUD/text panel at column 5, in one of two variants. ROM 0x483a.
drawMenLeftPanel:
483A: 3E 05           LD      A,$05
483C: 32 58 80        LD      ($8058),A           ; {ram.tileCol}
483F: 3A 2B 80        LD      A,($802B)           ; {ram.menLeft}
4842: 3D              DEC     A                   ; sets S/Z/H/PV/N, keeps C
4843: 28 30           JR      Z,$4875             ; {code.loc_4875}
4845: 3E 0B           LD      A,$0B
4847: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
484A: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
484D: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
4850: 3E 97           LD      A,$97
4852: 32 57 80        LD      ($8057),A           ; {ram.boardMode}
4855: 3E 09           LD      A,$09
4857: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
485A: DD 21 BA 49     LD      IX,$49BA
485E: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
4861: 3E 01           LD      A,$01
4863: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
4866: DD 21 2B 80     LD      IX,$802B            ; {ram.menLeft}
486A: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
486D: 3E 0A           LD      A,$0A
486F: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
4872: C3 01 3E        JP      $3E01               ; {code.fillColourColumn} tail-jump (pushes nothing; 0x3e01's ret returns to OUR caller)

loc_4875:
4875: 3E 0C           LD      A,$0C
4877: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
487A: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
487D: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
4880: 3E 96           LD      A,$96
4882: 32 57 80        LD      ($8057),A           ; {ram.boardMode}
4885: 3E 08           LD      A,$08
4887: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength}
488A: DD 21 C2 49     LD      IX,$49C2
488E: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
4891: C3 01 3E        JP      $3E01               ; {code.fillColourColumn} tail-jump (pushes nothing; 0x3e01's ret returns to OUR caller)

; drawCreditsDisplay — paint one fixed 9-cell HUD/text panel at column 6, row 10. ROM 0x4894.
drawCreditsDisplay:
4894: 3E 06           LD      A,$06
4896: 32 58 80        LD      ($8058),A           ; {ram.tileCol} column coordinate
4899: 3E 0A           LD      A,$0A
489B: 32 59 80        LD      ($8059),A           ; {ram.tileRow} row coordinate
489E: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset} row -> tilemap offset word (0x805a)
48A1: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors} offset -> colour (0x805e) + video (0x8060) addresses
48A4: 3E 96           LD      A,$96
48A6: 32 57 80        LD      ($8057),A           ; {ram.boardMode} colour fill byte for the 0x3e01 tail
48A9: 3E 01           LD      A,$01
48AB: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength} row count = 1 for the first (0x3dea) copy
48AE: DD 21 00 80     LD      IX,$8000            ; {ram.creditCount} source pointer for the 1-cell copy (DD prefix: 14 T)
48B2: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn} copy the 1-byte run into the top cell of the column
48B5: 3E 08           LD      A,$08
48B7: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength} row count = 8 for the strip and the 0x3e01 tail
48BA: DD 21 6D 49     LD      IX,$496D            ; text source for the 8-cell strip (DD prefix: 14 T)
48BE: CD DB 3D        CALL    $3DDB               ; {code.copyCappedTileColumn} fill the 8-cell strip (first = 0x4b0f cap, rest from IX)
48C1: C3 01 3E        JP      $3E01               ; {code.fillColourColumn} tail-jump into the column colour fill (runs its own `ret`)

; cyclePanelColumnColour — recolour a fixed nine-cell colour-RAM column, cycling its colour one
; step each call. ROM 0x48c4.
cyclePanelColumnColour:
48C4: 3E 09           LD      A,$09
48C6: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength} row count for the 0x3e01 tail (9 cells)
48C9: 3A 57 80        LD      A,($8057)           ; {ram.boardMode} the current colour byte
48CC: 3C              INC     A                   ; advance the colour one step (inc8 preserves carry)
48CD: E6 F7           AND     $F7                 ; clear bit 3: the counter cycles but never sets bit 3
48CF: 32 57 80        LD      ($8057),A           ; {ram.boardMode} write the bumped colour back (also the 0x3e01 fill byte)
48D2: 3E 06           LD      A,$06
48D4: 32 58 80        LD      ($8058),A           ; {ram.tileCol} column coordinate
48D7: 3E 0A           LD      A,$0A
48D9: 32 59 80        LD      ($8059),A           ; {ram.tileRow} row coordinate
48DC: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset} row/col -> tilemap offset word (0x805a)
48DF: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors} offset -> colour (0x805e) + video (0x8060) addresses
48E2: C3 01 3E        JP      $3E01               ; {code.fillColourColumn} tail-jump into the column fill (runs its own `ret`)

; drawGameOverLabel — stamp the nine-character "GAME OVER" label down its HUD text column. ROM
; 0x48e5.
drawGameOverLabel:
48E5: 3E 01           LD      A,$01
48E7: 32 58 80        LD      ($8058),A           ; {ram.tileCol} column coordinate
48EA: 3E 0C           LD      A,$0C
48EC: 32 59 80        LD      ($8059),A           ; {ram.tileRow} row coordinate
48EF: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset} row -> offset word (0x805a)
48F2: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors} offset -> colour/video addresses (0x805e ...)
48F5: 3E 06           LD      A,$06
48F7: 32 57 80        LD      ($8057),A           ; {ram.boardMode} fill byte for the 0x3e01 tail
48FA: 3E 09           LD      A,$09
48FC: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength} row count for 0x3dea and 0x3e01
48FF: DD 21 A5 49     LD      IX,$49A5            ; source pointer for the copy (DD prefix: 14 T, not 10)
4903: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn} copy the 9-byte run down the column
4906: C3 01 3E        JP      $3E01               ; {code.fillColourColumn} tail-jump into the column fill (runs its own `ret`)

; ==== UNREACHED 0x4909-0x4929 (33 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
4909:                 DEFB    $3A,$57,$80,$3C,$E6,$F7,$32,$57,$80,$3E,$01,$32,$58,$80,$3E,$0C
4919:                 DEFB    $32,$59,$80,$CD,$AE,$3D,$CD,$C9,$3D,$3E,$09,$32,$55,$80,$C3,$01
4929:                 DEFB    $3E

; drawCopyrightLine — paint one 32-tile screen column, then colour it. ROM 0x492a.
drawCopyrightLine:
492A: DD 21 C7 49     LD      IX,$49C7            ; source: ROM tile table
492E: 21 F9 93        LD      HL,$93F9            ; {hard.videoRam} dest: video RAM, bottom of the column
4931: 11 E0 FF        LD      DE,$FFE0            ; stride -0x20 (one row UP each write)
4934: 06 20           LD      B,$20               ; 32 tiles -> B (djnz)

loc_4936:
4936: DD 7E 00        LD      A,(IX+$00)          ; loc_4936 -- djnz loop body
4939: 77              LD      (HL),A              ; store the tile
493A: 19              ADD     HL,DE               ; HL -= 0x20 (H,N,C set; S/Z/PV kept)
493B: DD 23           INC     IX                  ; next source byte (no flags)
493D: 10 F7           DJNZ    $4936               ; {code.loc_4936}
493F: 0E 02           LD      C,$02               ; colour byte for loc_3e1d
4941: 3E 19           LD      A,$19               ; column offset for loc_3e1d
4943: C3 1D 3E        JP      $3E1D               ; {code.fillColourColumnAt} TAIL -> colour-RAM column fill

; ==== UNREACHED 0x4946-0x4b0f (458 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
4946:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4956:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24
4966:                 DEFB    $0C,$1B,$0E,$0D,$12,$1D,$1C,$0C,$18,$17,$10,$1B,$0A,$1D,$1E,$15
4976:                 DEFB    $0A,$1D,$12,$18,$17,$1C,$24,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A
4986:                 DEFB    $2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A,$2A
4996:                 DEFB    $2A,$2A,$2A,$2A,$2A,$2A,$2A,$10,$0A,$16,$0E,$24,$18,$1F,$0E,$1B
49A6:                 DEFB    $0F,$1B,$0E,$0E,$24,$19,$15,$0A,$22,$0E,$1B,$1C,$24,$16,$0E,$17
49B6:                 DEFB    $24,$15,$0E,$0F,$1D,$15,$0A,$1C,$1D,$24,$16,$0A,$17,$1D,$11,$0E
49C6:                 DEFB    $24,$24,$24,$24,$24,$24,$24,$24,$3F,$01,$09,$08,$02,$24,$0C,$0E
49D6:                 DEFB    $17,$1D,$1E,$1B,$12,$24,$12,$17,$0C,$24,$24,$24,$24,$24,$24,$24
49E6:                 DEFB    $24,$1E,$19,$22,$18,$1E,$24,$11,$0A,$1F,$0E,$24,$0E,$0A,$1B,$17
49F6:                 DEFB    $0E,$0D,$24,$11,$0A,$1F,$0E,$24,$0A,$17,$18,$1D,$11,$0E,$1B,$24
4A06:                 DEFB    $10,$18,$24,$1C,$12,$17,$10,$15,$0E,$24,$0B,$18,$17,$1E,$1C,$24
4A16:                 DEFB    $0D,$18,$1E,$0B,$15,$0E,$24,$0B,$18,$17,$1E,$1C,$24,$1D,$1B,$12
4A26:                 DEFB    $19,$15,$0E,$24,$0B,$18,$17,$1E,$1C,$24,$24,$05,$00,$00,$00,$24
4A36:                 DEFB    $19,$18,$12,$17,$1D,$1C,$24,$01,$00,$00,$00,$00,$24,$19,$18,$12
4A46:                 DEFB    $17,$1D,$1C,$24,$01,$05,$00,$00,$00,$24,$19,$18,$12,$17,$1D,$1C
4A56:                 DEFB    $24,$1D,$11,$0E,$24,$10,$1B,$0E,$0A,$1D,$0E,$1C,$1D,$24,$1C,$0C
4A66:                 DEFB    $18,$1B,$0E,$24,$1D,$11,$0E,$24,$02,$17,$0D,$24,$0B,$0E,$1C,$1D
4A76:                 DEFB    $24,$1C,$0C,$18,$1B,$0E,$24,$1D,$11,$0E,$24,$03,$1B,$0D,$24,$0B
4A86:                 DEFB    $0E,$1C,$1D,$24,$1C,$0C,$18,$1B,$0E,$24,$1B,$0E,$0C,$18,$1B,$0D
4A96:                 DEFB    $24,$22,$18,$1E,$1B,$24,$12,$17,$12,$1D,$12,$0A,$15,$1C,$24,$0B
4AA6:                 DEFB    $0E,$15,$18,$20,$24,$24,$24,$24,$24,$1C,$0C,$18,$1B,$0E,$01,$24
4AB6:                 DEFB    $24,$0C,$0E,$17,$1D,$1E,$1B,$12,$24,$24,$24,$1C,$0C,$18,$1B,$0E
4AC6:                 DEFB    $02,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$24,$0B,$0E,$1C,$1D
4AD6:                 DEFB    $24,$1C,$0C,$18,$1B,$0E,$1C,$24,$1D,$18,$0D,$0A,$22,$24,$24,$24
4AE6:                 DEFB    $24,$24,$24,$24,$24,$00,$01,$02,$03,$04,$05,$06,$07,$08,$09,$0A
4AF6:                 DEFB    $0B,$0C,$0D,$0E,$0F,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$1A
4B06:                 DEFB    $1B,$1C,$1D,$1E,$1F,$20,$21,$22,$23,$24

; disableFrameInterrupt — switch the per-frame (vblank) interrupt off. ROM 0x4b10.
disableFrameInterrupt:
4B10: 3E 00           LD      A,$00
4B12: 18 02           JR      $4B16               ; {code.loc_4b16} unconditional -- skips ld a,0x01 @4b14

; enableNmi — switch on the per-frame vblank interrupt. ROM 0x4b14.
enableNmi:
4B14: 3E 01           LD      A,$01

loc_4b16:
4B16: 32 00 B0        LD      ($B000),A           ; {hard.mainLatch} LS259 latch: bit 0 (NMI mask) <- 0
4B19: C9              RET

; advanceRandom — step the game's pseudo-random generator and hand back a fresh byte. ROM 0x4b1a.
advanceRandom:
4B1A: 3A 0D 80        LD      A,($800D)           ; {ram.prngLow}
4B1D: 4F              LD      C,A                 ; C = low byte
4B1E: 3A 0E 80        LD      A,($800E)           ; {ram.prngHigh}
4B21: 47              LD      B,A                 ; B = high byte
4B22: B1              OR      C                   ; A = B | C -> Z iff value == 0; carry cleared
4B23: 20 02           JR      NZ,$4B27            ; {code.loc_4b27} value non-zero -> keep C
4B25: 0E 02           LD      C,$02               ; reseed to escape the all-zero lockup

loc_4b27:
4B27: CB 39           SRL     C                   ; loc_4b27
4B29: 79              LD      A,C
4B2A: CB 3F           SRL     A
4B2C: A9              XOR     C                   ; feedback tap; carry cleared
4B2D: CB 21           SLA     C
4B2F: CB 3F           SRL     A                   ; carry := feedback bit for the rra chain
4B31: 78              LD      A,B
4B32: 1F              RRA                         ; rotate high byte right through the feedback carry
4B33: 32 0E 80        LD      ($800E),A           ; {ram.prngHigh} store new high byte
4B36: 79              LD      A,C
4B37: 1F              RRA                         ; rotate low byte right through the carry from above
4B38: 32 0D 80        LD      ($800D),A           ; {ram.prngLow} store new low byte
4B3B: C9              RET

; setupBoardModeC0 — stow the 0xC0 board-mode byte, then run the shared display-setup body. ROM
; 0x4b3c.
setupBoardModeC0:
4B3C: 3E C0           LD      A,$C0
4B3E: 18 06           JR      $4B46               ; {code.setupBoardDisplay} unconditional -- into the shared tail

; setupBoardMode90 — stow the 0x90 board-mode byte, then rebuild the screen for that board. ROM
; 0x4b40.
setupBoardMode90:
4B40: 3E 90           LD      A,$90
4B42: 18 02           JR      $4B46               ; {code.setupBoardDisplay} unconditional -- skips ld a,0x00 @4b44

; blankScreen — the mode-0 door into the shared display-setup body. ROM 0x4b44.
blankScreen:
4B44: 3E 00           LD      A,$00               ; loc_4b44 entry (NOT reached from 0x4b40)

; setupBoardDisplay — record the board-mode byte and rebuild the whole screen for it. ROM 0x4b46.
setupBoardDisplay:
4B46: 32 57 80        LD      ($8057),A           ; {ram.boardMode} loc_4b46 shared tail -- store the byte
4B49: CD 11 4C        CALL    $4C11               ; {code.clearSpriteAndAttributeRam} return addr = 0x4b4c
4B4C: CD 27 4C        CALL    $4C27               ; {code.fillVideoRam} return addr = 0x4b4f
4B4F: CD 37 4C        CALL    $4C37               ; {code.fillColorRam} return addr = 0x4b52
4B52: C3 1C 4C        JP      $4C1C               ; {code.clearSpriteStagingBuffer} tail-jump (pushes nothing; 0x4c1c's ret returns to OUR caller)

; applyDipSwitches — read the cabinet DIP switches and commit their settings to the game's runtime
; configuration (difficulty/bonus parameters + the flip-screen hardware). ROM 0x4b55.
applyDipSwitches:
4B55: 3A 00 B0        LD      A,($B000)           ; {hard.dsw} A = DSW
4B58: 47              LD      B,A                 ; keep the whole DSW in B for bit tests
4B59: E6 03           AND     $03
4B5B: EE 03           XOR     $03
4B5D: 20 05           JR      NZ,$4B64            ; {code.loc_4b64} (DSW & 3) != 3 -> loc_4b64
4B5F: 21 00 00        LD      HL,$0000
4B62: 18 13           JR      $4B77               ; {code.loc_4b77}

loc_4b64:
4B64: 21 01 02        LD      HL,$0201
4B67: CB 40           BIT     0,B
4B69: 28 05           JR      Z,$4B70             ; {code.loc_4b70}
4B6B: 21 02 03        LD      HL,$0302
4B6E: 18 07           JR      $4B77               ; {code.loc_4b77}

loc_4b70:
4B70: CB 48           BIT     1,B
4B72: 28 03           JR      Z,$4B77             ; {code.loc_4b77}
4B74: 21 02 04        LD      HL,$0402

loc_4b77:
4B77: 22 4C 80        LD      ($804C),HL          ; {ram.coinsPerCreditA}
4B7A: 3E 0C           LD      A,$0C
4B7C: CB 50           BIT     2,B
4B7E: 20 02           JR      NZ,$4B82            ; {code.loc_4b82}
4B80: D6 02           SUB     $02

loc_4b82:
4B82: 32 4E 80        LD      ($804E),A           ; {ram.loopDelayBase}
4B85: 3E 37           LD      A,$37
4B87: CB 58           BIT     3,B
4B89: 28 02           JR      Z,$4B8D             ; {code.loc_4b8d}
4B8B: D6 0A           SUB     $0A

loc_4b8d:
4B8D: 32 4F 80        LD      ($804F),A           ; {ram.stepTimerBase}
4B90: 3E 00           LD      A,$00
4B92: CB 60           BIT     4,B
4B94: 28 01           JR      Z,$4B97             ; {code.loc_4b97}
4B96: 3C              INC     A

loc_4b97:
4B97: 32 50 80        LD      ($8050),A
4B9A: 57              LD      D,A
4B9B: 3E 00           LD      A,$00
4B9D: CB 68           BIT     5,B
4B9F: 28 01           JR      Z,$4BA2             ; {code.loc_4ba2}
4BA1: 3C              INC     A

loc_4ba2:
4BA2: 32 52 80        LD      ($8052),A
4BA5: 4F              LD      C,A
4BA6: 3A 02 80        LD      A,($8002)           ; {ram.activePlayer}
4BA9: 3D              DEC     A
4BAA: A1              AND     C
4BAB: AA              XOR     D
4BAC: 32 06 B0        LD      ($B006),A           ; {hard.mainLatch} LS259 b6 <- A&1
4BAF: 32 07 B0        LD      ($B007),A           ; {hard.mainLatch} LS259 b7 <- A&1
4BB2: CB 27           SLA     A
4BB4: 32 51 80        LD      ($8051),A           ; {ram.spriteCoordBias}
4BB7: 3E 03           LD      A,$03
4BB9: CB 70           BIT     6,B
4BBB: 28 01           JR      Z,$4BBE             ; {code.loc_4bbe}
4BBD: 3C              INC     A

loc_4bbe:
4BBE: 32 53 80        LD      ($8053),A           ; {ram.startingMen}
4BC1: CB 78           BIT     7,B
4BC3: C2 47 4F        JP      NZ,$4F47            ; {code.showColourTestScreen} CONDITIONAL TAIL-jump (10 T whether taken or not)
4BC6: C9              RET

; initScoreDisplay — blank the numeric-readout strip, seed three zeroed readout records, then
; render them. ROM 0x4bc7.
initScoreDisplay:
4BC7: 21 80 82        LD      HL,$8280            ; {ram.scoreReadoutStrip} top of the 0x20-byte fill region
4BCA: 06 20           LD      B,$20               ; 32 iterations

loc_4bcc:
4BCC: 36 24           LD      (HL),$24
4BCE: 23              INC     HL
4BCF: 10 FB           DJNZ    $4BCC               ; {code.loc_4bcc}
4BD1: 21 39 80        LD      HL,$8039            ; {ram.highScoreTable} base of the three 5-byte records
4BD4: 06 03           LD      B,$03               ; 3 records

loc_4bd6:
4BD6: 36 10           LD      (HL),$10
4BD8: 23              INC     HL
4BD9: 36 0A           LD      (HL),$0A
4BDB: 23              INC     HL
4BDC: 36 16           LD      (HL),$16
4BDE: 23              INC     HL
4BDF: 36 00           LD      (HL),$00
4BE1: 23              INC     HL
4BE2: 36 00           LD      (HL),$00
4BE4: 23              INC     HL
4BE5: 10 EF           DJNZ    $4BD6               ; {code.loc_4bd6}
4BE7: C3 CA 4C        JP      $4CCA               ; {code.renderScoreReadouts} unconditional tail-jump; 0x4cca's ret returns to OUR caller

; resetScoreAndSoundQueue — blank the score bytes and the sound-command queue back to zero. ROM
; 0x4bea.
resetScoreAndSoundQueue:
4BEA: 06 06           LD      B,$06
4BEC: 21 31 80        LD      HL,$8031            ; {ram.scoreLo}

loc_4bef:
4BEF: 36 00           LD      (HL),$00
4BF1: 23              INC     HL
4BF2: 10 FB           DJNZ    $4BEF               ; {code.loc_4bef} clear 0x8031..0x8036 (6 bytes)
4BF4: 06 0A           LD      B,$0A
4BF6: 21 1E 80        LD      HL,$801E            ; {ram.soundHead}

loc_4bf9:
4BF9: 36 00           LD      (HL),$00
4BFB: 23              INC     HL
4BFC: 10 FB           DJNZ    $4BF9               ; {code.loc_4bf9} clear 0x801E..0x8027 (10 bytes)
4BFE: C9              RET

; waitFrames — pause for a fixed number of video frames, then return. ROM 0x4bff.
waitFrames:
4BFF: 32 09 80        LD      ($8009),A           ; {ram.frameWaitCountdown} countdown <- A (frames to wait)
4C02: 3E 01           LD      A,$01
4C04: 32 00 B0        LD      ($B000),A           ; {hard.mainLatch} LS259 b0 = 1 -> enable the NMI

loc_4c07:
4C07: 3A 00 B8        LD      A,($B800)           ; {hard.watchdog} read watchdog = KICK it (A discarded)
4C0A: 3A 09 80        LD      A,($8009)           ; {ram.frameWaitCountdown} reload the countdown (NMI decrements it)
4C0D: A7              AND     A                   ; Z = (countdown == 0)
4C0E: 20 F7           JR      NZ,$4C07            ; {code.loc_4c07} spin while non-zero
4C10: C9              RET

; clearSpriteAndAttributeRam — wipe the sprites and per-column scroll for a clean screen at setup.
; ROM 0x4c11.
clearSpriteAndAttributeRam:
4C11: 06 80           LD      B,$80               ; 128 bytes to clear
4C13: 21 00 98        LD      HL,$9800            ; {hard.attrRam} attribute / sprite RAM base

loc_4c16:
4C16: 36 00           LD      (HL),$00            ; zero one byte
4C18: 2C              INC     L                   ; next byte, WITHIN page 0x98
4C19: 10 FB           DJNZ    $4C16               ; {code.loc_4c16}
4C1B: C9              RET

; clearSpriteStagingBuffer — zero a fixed 64-byte work-RAM block during setup. ROM 0x4c1c.
clearSpriteStagingBuffer:
4C1C: 06 40           LD      B,$40               ; 64 bytes to clear
4C1E: 21 00 82        LD      HL,$8200            ; work-RAM destination base

loc_4c21:
4C21: 36 00           LD      (HL),$00            ; zero one byte
4C23: 2C              INC     L                   ; next byte, WITHIN page 0x82
4C24: 10 FB           DJNZ    $4C21               ; {code.loc_4c21}
4C26: C9              RET

; fillVideoRam — paint every cell of the tilemap with one tile code. ROM 0x4c27.
fillVideoRam:
4C27: 06 04           LD      B,$04               ; 4 pages of 256 bytes
4C29: 3A 0F 4B        LD      A,($4B0F)           ; A = the fill byte (a ROM constant)
4C2C: 21 00 90        LD      HL,$9000            ; {hard.videoRam} video RAM base

loc_4c2f:
4C2F: 77              LD      (HL),A              ; write the fill byte
4C30: 2C              INC     L                   ; next byte, WITHIN the current page
4C31: 20 FC           JR      NZ,$4C2F            ; {code.loc_4c2f} loop while L != 0 (one full 256-byte page)
4C33: 24              INC     H                   ; advance to the next page
4C34: 10 F9           DJNZ    $4C2F               ; {code.loc_4c2f} repeat for all 4 pages
4C36: C9              RET

; fillColorRam — repaint every colour-RAM cell with one board-mode colour byte. ROM 0x4c37.
fillColorRam:
4C37: 06 04           LD      B,$04               ; 4 pages of 256 bytes
4C39: 3A 57 80        LD      A,($8057)           ; {ram.boardMode} the fill byte
4C3C: 21 00 88        LD      HL,$8800            ; colour RAM base

loc_4c3f:
4C3F: 77              LD      (HL),A              ; store the fill byte
4C40: 2C              INC     L                   ; next byte, WITHIN the current page
4C41: 20 FC           JR      NZ,$4C3F            ; {code.loc_4c3f} 256 bytes -> until L wraps to 0
4C43: 24              INC     H                   ; advance to the next page
4C44: 10 F9           DJNZ    $4C3F               ; {code.loc_4c3f} 4 pages
4C46: C9              RET

; disableSound — pull the sound-enable control line low, silencing the audio. ROM 0x4c47.
disableSound:
4C47: 3E 00           LD      A,$00
4C49: 32 03 B0        LD      ($B003),A           ; {hard.mainLatch} LS259 b3 <- A&1 = 0  -> sound OFF
4C4C: C9              RET

; enableSound — switch the master sound-enable line on (unmute the audio). ROM 0x4c4d.
enableSound:
4C4D: 3E 01           LD      A,$01               ; datum for LS259 b3 (sound enable = 1)
4C4F: 32 03 B0        LD      ($B003),A           ; {hard.mainLatch} LS259 latch: bit 3 (sound enable) <- 1
4C52: C9              RET

; ==== UNREACHED 0x4c53-0x4c56 (4 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
4C53:                 DEFB    $3E,$01,$18,$4E

; requestSound2 — ask the sound driver to play effect 2. ROM 0x4c57.
requestSound2:
4C57: 3E 02           LD      A,$02               ; sound-command index 2 (no flags)
4C59: 18 4A           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound3 — ask the sound driver to play sound-command 3. ROM 0x4c5b.
requestSound3:
4C5B: 3E 03           LD      A,$03               ; sound-command index 3 (no flags)
4C5D: 18 46           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound4 — ask the sound driver to play sound-command 4. ROM 0x4c5f.
requestSound4:
4C5F: 3E 04           LD      A,$04               ; command id (no flags)
4C61: 18 42           JR      $4CA5               ; {code.enqueueSoundCommand} TAIL-jump to the shared enqueue body

; requestSound5 — ask the sound driver to play sound-command 5. ROM 0x4c63.
requestSound5:
4C63: 3E 05           LD      A,$05               ; sound command 0x05
4C65: 18 3E           JR      $4CA5               ; {code.enqueueSoundCommand} tail-jump: loc_4ca5's ret returns to OUR caller

; requestSound6 — ask the sound driver to play sound-command 6. ROM 0x4c67.
requestSound6:
4C67: 3E 06           LD      A,$06               ; sound-command index 6 (no flags)
4C69: 18 3A           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound7 — ask the sound driver to play sound-command 7. ROM 0x4c6b.
requestSound7:
4C6B: 3E 07           LD      A,$07               ; sound-command index 7 (no flags)
4C6D: 18 36           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound8 — ask the sound driver to play sound-command 8. ROM 0x4c6f.
requestSound8:
4C6F: 3E 08           LD      A,$08               ; sound-command index 8 (no flags)
4C71: 18 32           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound9 — ask the sound driver to play sound-command 9. ROM 0x4c73.
requestSound9:
4C73: 3E 09           LD      A,$09               ; sound-command index 0x09 (no flags)
4C75: 18 2E           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound10 — ask the sound driver to play sound-command 10. ROM 0x4c77.
requestSound10:
4C77: 3E 0A           LD      A,$0A               ; sound-command index 0x0a (no flags)
4C79: 18 2A           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound11 — ask the sound driver to play sound-command 11. ROM 0x4c7b.
requestSound11:
4C7B: 3E 0B           LD      A,$0B               ; sound-command index 0x0b (no flags)
4C7D: 18 26           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound12 — ask the sound driver to play sound-command 12. ROM 0x4c7f.
requestSound12:
4C7F: 3E 0C           LD      A,$0C               ; sound-command index 0x0c (no flags)
4C81: 18 22           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound13 — ask the sound driver to play sound-command 13. ROM 0x4c83.
requestSound13:
4C83: 3E 0D           LD      A,$0D               ; sound-command index 0x0d (no flags)
4C85: 18 1E           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; ==== UNREACHED 0x4c87-0x4c8a (4 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
4C87:                 DEFB    $3E,$0E,$18,$1A

; requestSound15 — ask the sound driver to play sound-command 15. ROM 0x4c8b.
requestSound15:
4C8B: 3E 0F           LD      A,$0F               ; sound-command index 0x0f (no flags)
4C8D: 18 16           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound16 — ask the sound driver to play sound-command 16. ROM 0x4c8f.
requestSound16:
4C8F: 3E 10           LD      A,$10               ; sound-command index 0x10 (no flags)
4C91: 18 12           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound17 — ask the sound driver to play sound-command 17. ROM 0x4c93.
requestSound17:
4C93: 3E 11           LD      A,$11               ; sound-command index 0x11 (no flags)
4C95: 18 0E           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound18 — ask the sound driver to play sound-command 18. ROM 0x4c97.
requestSound18:
4C97: 3E 12           LD      A,$12               ; sound-command index 0x12 (no flags)
4C99: 18 0A           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound19 — ask the sound driver to play sound-command 19. ROM 0x4c9b.
requestSound19:
4C9B: 3E 13           LD      A,$13               ; sound-command index 0x13 (no flags)
4C9D: 18 06           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound20 — ask the sound driver to play sound-command 20. ROM 0x4c9f.
requestSound20:
4C9F: 3E 14           LD      A,$14               ; sound-command index 0x14 (no flags)
4CA1: 18 02           JR      $4CA5               ; {code.enqueueSoundCommand} unconditional TAIL-jump into loc_4ca5

; requestSound21 — ask the sound driver to play sound-command 21. ROM 0x4ca3.
requestSound21:
4CA3: 3E 15           LD      A,$15               ; sound-command index 0x15 (no flags)

; enqueueSoundCommand — append one sound request to the sound ring buffer. ROM 0x4ca5.
enqueueSoundCommand:
4CA5: F6 80           OR      $80                 ; set bit 7 of the command index (0x13 -> 0x93)
4CA7: D5              PUSH    DE                  ; saved across the routine
4CA8: E5              PUSH    HL
4CA9: 57              LD      D,A                 ; stash the command byte in D
4CAA: 3A 1E 80        LD      A,($801E)           ; {ram.soundHead} current ring write pointer (0..7)
4CAD: 5F              LD      E,A                 ; E = the slot to write into (the pre-advance pointer)
4CAE: 3C              INC     A                   ; advance the pointer (inc8: sets S/Z/H/PV, carry preserved)
4CAF: E6 07           AND     $07                 ; wrap the advanced pointer mod 8
4CB1: 32 1E 80        LD      ($801E),A           ; {ram.soundHead} store the advanced+wrapped pointer
4CB4: 21 20 80        LD      HL,$8020            ; {ram.soundRing} sound ring base
4CB7: 7A              LD      A,D                 ; recover the command byte into A for the store
4CB8: 16 00           LD      D,$00               ; DE = the current slot index (D=0, E=slot)
4CBA: 19              ADD     HL,DE               ; HL = 0x8020 + slot (addHl: only H/N/C, S/Z/PV preserved)
4CBB: 77              LD      (HL),A              ; ring[slot] = the command byte with bit 7 set
4CBC: E1              POP     HL                  ; restore HL
4CBD: D1              POP     DE                  ; restore DE
4CBE: C9              RET                         ; back to the sibling stub's caller

; submitPlayerHighScore — offer the finishing player's final score to the "BEST SCORES TODAY"
; table and repaint the score readouts. ROM 0x4cbf.
submitPlayerHighScore:
4CBF: 3E 00           LD      A,$00
4CC1: 32 48 80        LD      ($8048),A           ; {ram.variant}
4CC4: CD 44 46        CALL    $4644               ; {code.loadPlayerState} refresh the active player's block
4CC7: CD 3A 4D        CALL    $4D3A               ; {code.insertHighScore} --> rets to 0x4cca == loc_4cca's entry

; renderScoreReadouts — lay the three score-readout numbers into their on-screen display cells.
; ROM 0x4cca.
renderScoreReadouts:
4CCA: 11 83 82        LD      DE,$8283
4CCD: 21 39 80        LD      HL,$8039            ; {ram.highScoreTable}
4CD0: 01 03 00        LD      BC,$0003
4CD3: ED B0           LDIR                        ; copy 0x8039..0x803b -> 0x8283
4CD5: 2A 3C 80        LD      HL,($803C)
4CD8: 22 37 80        LD      ($8037),HL          ; {ram.scoreDisplayLow} stage record-1 value
4CDB: 21 86 82        LD      HL,$8286
4CDE: CD 0C 4D        CALL    $4D0C               ; {code.unpackScoreDigits} format into cells at 0x8286
4CE1: 11 8C 82        LD      DE,$828C
4CE4: 21 3E 80        LD      HL,$803E
4CE7: 01 03 00        LD      BC,$0003
4CEA: ED B0           LDIR                        ; copy 0x803e..0x8040 -> 0x828c
4CEC: 2A 41 80        LD      HL,($8041)
4CEF: 22 37 80        LD      ($8037),HL          ; {ram.scoreDisplayLow} stage record-2 value
4CF2: 21 8F 82        LD      HL,$828F
4CF5: CD 0C 4D        CALL    $4D0C               ; {code.unpackScoreDigits} format into cells at 0x828f
4CF8: 11 95 82        LD      DE,$8295
4CFB: 21 43 80        LD      HL,$8043
4CFE: 01 03 00        LD      BC,$0003
4D01: ED B0           LDIR                        ; copy 0x8043..0x8045 -> 0x8295
4D03: 2A 46 80        LD      HL,($8046)
4D06: 22 37 80        LD      ($8037),HL          ; {ram.scoreDisplayLow} stage record-3 value
4D09: 21 98 82        LD      HL,$8298            ; --> falls through into loc_4d0c

; unpackScoreDigits — expand the staged packed score value into display digit cells. ROM 0x4d0c.
unpackScoreDigits:
4D0C: 3A 38 80        LD      A,($8038)           ; {ram.scoreDisplayHigh}
4D0F: 4F              LD      C,A
4D10: CB 3F           SRL     A
4D12: CB 3F           SRL     A
4D14: CB 3F           SRL     A
4D16: CB 3F           SRL     A                   ; A = hi>>4, Z if the top nibble is 0
4D18: 28 02           JR      Z,$4D1C             ; {code.loc_4d1c} blank the leading digit
4D1A: 77              LD      (HL),A
4D1B: 23              INC     HL

loc_4d1c:
4D1C: 79              LD      A,C                 ; loc_4d1c
4D1D: E6 0F           AND     $0F
4D1F: 77              LD      (HL),A
4D20: 23              INC     HL
4D21: 3A 37 80        LD      A,($8037)           ; {ram.scoreDisplayLow}
4D24: 4F              LD      C,A
4D25: CB 3F           SRL     A
4D27: CB 3F           SRL     A
4D29: CB 3F           SRL     A
4D2B: CB 3F           SRL     A                   ; A = lo>>4 (no blanking here)
4D2D: 77              LD      (HL),A
4D2E: 23              INC     HL
4D2F: 79              LD      A,C
4D30: E6 0F           AND     $0F
4D32: 77              LD      (HL),A
4D33: 23              INC     HL
4D34: 36 00           LD      (HL),$00
4D36: 23              INC     HL
4D37: 36 00           LD      (HL),$00
4D39: C9              RET

; insertHighScore — place a candidate score into the descending three-entry "BEST SCORES TODAY"
; table, bumping the entries it beats down a rank. ROM 0x4d3a.
insertHighScore:
4D3A: 2A 46 80        LD      HL,($8046)          ; rank-3 slot value
4D3D: 3A 31 80        LD      A,($8031)           ; {ram.scoreLo}
4D40: 5F              LD      E,A                 ; E = candidate low
4D41: 3A 34 80        LD      A,($8034)           ; {ram.scoreHi}
4D44: 57              LD      D,A                 ; D = candidate high
4D45: BC              CP      H
4D46: D8              RET     C                   ; DE high < rank3 high -> no place
4D47: 28 02           JR      Z,$4D4B             ; {code.loc_4d4b}
4D49: 30 04           JR      NC,$4D4F            ; {code.loc_4d4f}

loc_4d4b:
4D4B: 7B              LD      A,E
4D4C: BD              CP      L
4D4D: C8              RET     Z                   ; DE == rank3 -> no place
4D4E: D8              RET     C                   ; DE < rank3  -> no place

loc_4d4f:
4D4F: 2A 41 80        LD      HL,($8041)
4D52: 7A              LD      A,D
4D53: BC              CP      H
4D54: 38 0A           JR      C,$4D60             ; {code.loc_4d60}
4D56: 28 02           JR      Z,$4D5A             ; {code.loc_4d5a}
4D58: 30 1F           JR      NC,$4D79            ; {code.loc_4d79}

loc_4d5a:
4D5A: 7B              LD      A,E
4D5B: BD              CP      L
4D5C: 28 02           JR      Z,$4D60             ; {code.loc_4d60}
4D5E: 30 19           JR      NC,$4D79            ; {code.loc_4d79}

loc_4d60:
4D60: ED 53 46 80     LD      ($8046),DE
4D64: 3E 03           LD      A,$03
4D66: 32 48 80        LD      ($8048),A           ; {ram.variant} landed rank = 3
4D69: 3E FF           LD      A,$FF
4D6B: DD 21 43 80     LD      IX,$8043
4D6F: DD 77 00        LD      (IX+$00),A          ; rank-3 initials = 0xff x3
4D72: DD 77 01        LD      (IX+$01),A
4D75: DD 77 02        LD      (IX+$02),A
4D78: C9              RET

loc_4d79:
4D79: 22 46 80        LD      ($8046),HL          ; old rank-2 value -> rank-3 slot
4D7C: DD 21 43 80     LD      IX,$8043
4D80: FD 21 3E 80     LD      IY,$803E
4D84: FD 7E 00        LD      A,(IY+$00)          ; rank-2 initials -> rank-3 initials
4D87: DD 77 00        LD      (IX+$00),A
4D8A: FD 7E 01        LD      A,(IY+$01)
4D8D: DD 77 01        LD      (IX+$01),A
4D90: FD 7E 02        LD      A,(IY+$02)
4D93: DD 77 02        LD      (IX+$02),A
4D96: 2A 3C 80        LD      HL,($803C)          ; rank-1 slot value
4D99: 7A              LD      A,D
4D9A: BC              CP      H
4D9B: 38 0A           JR      C,$4DA7             ; {code.loc_4da7}
4D9D: 28 02           JR      Z,$4DA1             ; {code.loc_4da1}
4D9F: 30 20           JR      NC,$4DC1            ; {code.loc_4dc1}

loc_4da1:
4DA1: 7B              LD      A,E
4DA2: BD              CP      L
4DA3: 28 02           JR      Z,$4DA7             ; {code.loc_4da7}
4DA5: 30 1A           JR      NC,$4DC1            ; {code.loc_4dc1}

loc_4da7:
4DA7: ED 53 41 80     LD      ($8041),DE
4DAB: 3E 02           LD      A,$02
4DAD: 32 48 80        LD      ($8048),A           ; {ram.variant} landed rank = 2
4DB0: DD 21 3E 80     LD      IX,$803E
4DB4: DD 36 00 FF     LD      (IX+$00),$FF        ; rank-2 initials = 0xff x3
4DB8: DD 36 01 FF     LD      (IX+$01),$FF
4DBC: DD 36 02 FF     LD      (IX+$02),$FF
4DC0: C9              RET

loc_4dc1:
4DC1: 22 41 80        LD      ($8041),HL          ; old rank-1 value -> rank-2 slot
4DC4: FD 21 39 80     LD      IY,$8039            ; {ram.highScoreTable}
4DC8: DD 21 3E 80     LD      IX,$803E
4DCC: FD 7E 00        LD      A,(IY+$00)          ; rank-1 initials -> rank-2 initials
4DCF: DD 77 00        LD      (IX+$00),A
4DD2: FD 7E 01        LD      A,(IY+$01)
4DD5: DD 77 01        LD      (IX+$01),A
4DD8: FD 7E 02        LD      A,(IY+$02)
4DDB: DD 77 02        LD      (IX+$02),A
4DDE: ED 53 3C 80     LD      ($803C),DE          ; DE -> rank-1 slot
4DE2: 3E 01           LD      A,$01
4DE4: 32 48 80        LD      ($8048),A           ; {ram.variant} landed rank = 1
4DE7: DD 21 39 80     LD      IX,$8039            ; {ram.highScoreTable}
4DEB: DD 36 00 FF     LD      (IX+$00),$FF        ; rank-1 initials = 0xff x3
4DEF: DD 36 01 FF     LD      (IX+$01),$FF
4DF3: DD 36 02 FF     LD      (IX+$02),$FF
4DF7: C9              RET

; runHighScoreInitialsEntry — the high-score initials-entry screen: build the display, let the
; player dial in their three initials, then show the final score readouts. ROM 0x4df8.
runHighScoreInitialsEntry:
4DF8: 3E 00           LD      A,$00
4DFA: 32 10 80        LD      ($8010),A           ; {ram.playPhaseCounter} clear frame counter
4DFD: CD 55 4B        CALL    $4B55               ; {code.applyDipSwitches} DSW decode
4E00: CD 44 4B        CALL    $4B44               ; {code.blankScreen}
4E03: CD C1 3C        CALL    $3CC1               ; {code.drawSharedPanel}
4E06: 0E 03           LD      C,$03
4E08: 3E 07           LD      A,$07
4E0A: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt}
4E0D: 3E 09           LD      A,$09
4E0F: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt}
4E12: 0E 06           LD      C,$06
4E14: 3E 0D           LD      A,$0D
4E16: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt}
4E19: 3E 0F           LD      A,$0F
4E1B: 32 58 80        LD      ($8058),A           ; {ram.tileCol} column coord
4E1E: 3E 08           LD      A,$08
4E20: 32 59 80        LD      ($8059),A           ; {ram.tileRow} row coord
4E23: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset} coord -> offset
4E26: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors} offset -> addresses
4E29: 3E 12           LD      A,$12
4E2B: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength} fill count
4E2E: 3A 48 80        LD      A,($8048)           ; {ram.variant} variant selector
4E31: FE 03           CP      $03
4E33: 28 10           JR      Z,$4E45             ; {code.loc_4e45} pick the first IX pointer from the variant
4E35: FE 02           CP      $02
4E37: 28 06           JR      Z,$4E3F             ; {code.loc_4e3f}
4E39: DD 21 68 4A     LD      IX,$4A68
4E3D: 18 0A           JR      $4E49               ; {code.loc_4e49}

loc_4e3f:
4E3F: DD 21 7B 4A     LD      IX,$4A7B
4E43: 18 04           JR      $4E49               ; {code.loc_4e49}

loc_4e45:
4E45: DD 21 8E 4A     LD      IX,$4A8E

loc_4e49:
4E49: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
4E4C: 0E 06           LD      C,$06
4E4E: 3E 0F           LD      A,$0F
4E50: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt}
4E53: 3E 16           LD      A,$16
4E55: 32 58 80        LD      ($8058),A           ; {ram.tileCol}
4E58: 3E 03           LD      A,$03
4E5A: 32 59 80        LD      ($8059),A           ; {ram.tileRow}
4E5D: CD AE 3D        CALL    $3DAE               ; {code.rowColToTileOffset}
4E60: CD C9 3D        CALL    $3DC9               ; {code.deriveTileWriteCursors}
4E63: 3E 1A           LD      A,$1A
4E65: 32 55 80        LD      ($8055),A           ; {ram.plotRunLength} fill count
4E68: DD 21 A9 4A     LD      IX,$4AA9
4E6C: CD EA 3D        CALL    $3DEA               ; {code.copyTileColumn}
4E6F: 3E 16           LD      A,$16
4E71: 0E 07           LD      C,$07
4E73: CD 1D 3E        CALL    $3E1D               ; {code.fillColourColumnAt}
4E76: 3E 03           LD      A,$03
4E78: 32 4B 80        LD      ($804B),A           ; {ram.initialsRemaining} step counter = 3
4E7B: 3A 48 80        LD      A,($8048)           ; {ram.variant} selector again
4E7E: FE 03           CP      $03
4E80: 28 20           JR      Z,$4EA2             ; {code.loc_4ea2} pick the loop-count B + the IX/HL/DE cursor bundle
4E82: FE 02           CP      $02
4E84: 28 0E           JR      Z,$4E94             ; {code.loc_4e94}
4E86: 06 06           LD      B,$06
4E88: DD 21 39 80     LD      IX,$8039            ; {ram.highScoreTable}
4E8C: 21 9F 93        LD      HL,$939F            ; {hard.videoRam}
4E8F: 11 9F 8B        LD      DE,$8B9F
4E92: 18 1A           JR      $4EAE               ; {code.loc_4eae}

loc_4e94:
4E94: 06 04           LD      B,$04
4E96: DD 21 3E 80     LD      IX,$803E
4E9A: 21 7F 92        LD      HL,$927F            ; {hard.videoRam}
4E9D: 11 7F 8A        LD      DE,$8A7F
4EA0: 18 0C           JR      $4EAE               ; {code.loc_4eae}

loc_4ea2:
4EA2: 06 07           LD      B,$07
4EA4: DD 21 43 80     LD      IX,$8043
4EA8: 21 5F 91        LD      HL,$915F            ; {hard.videoRam}
4EAB: 11 5F 89        LD      DE,$895F

loc_4eae:
4EAE: 3E 00           LD      A,$00
4EB0: 32 10 80        LD      ($8010),A           ; {ram.playPhaseCounter} clear frame counter
4EB3: 0E 0A           LD      C,$0A
4EB5: 78              LD      A,B
4EB6: 12              LD      (DE),A              ; stash B into the colour cursor

loc_4eb7:
4EB7: 71              LD      (HL),C
4EB8: 3E 08           LD      A,$08
4EBA: CD FF 4B        CALL    $4BFF               ; {code.waitFrames} wait A frames
4EBD: 36 24           LD      (HL),$24
4EBF: 3E 04           LD      A,$04
4EC1: CD FF 4B        CALL    $4BFF               ; {code.waitFrames} wait A frames
4EC4: CD EA 4E        CALL    $4EEA               ; {code.stepHighScoreInitialsEntry} per-frame handler
4EC7: 3A 4B 80        LD      A,($804B)           ; {ram.initialsRemaining} step counter
4ECA: B7              OR      A                   ; Z <- (0x804b == 0)
4ECB: 20 15           JR      NZ,$4EE2            ; {code.loc_4ee2} counter still non-zero: go poll the frame counter
4ECD: 3E D0           LD      A,$D0
4ECF: CD 46 4B        CALL    $4B46               ; {code.setupBoardDisplay} sound 0xd0
4ED2: CD 63 4C        CALL    $4C63               ; {code.requestSound5} sound 0x05
4ED5: 3E 3C           LD      A,$3C
4ED7: CD FF 4B        CALL    $4BFF               ; {code.waitFrames} wait 0x3c frames
4EDA: 3E 00           LD      A,$00
4EDC: 32 48 80        LD      ($8048),A           ; {ram.variant} clear the selector
4EDF: C3 CA 4C        JP      $4CCA               ; {code.renderScoreReadouts} TAIL-jump: loc_4cca's ret unwinds to OUR caller (no m.ret)

loc_4ee2:
4EE2: 3A 10 80        LD      A,($8010)           ; {ram.playPhaseCounter} frame counter
4EE5: FE 3C           CP      $3C
4EE7: D0              RET     NC                  ; (0x8010) >= 0x3c: done, return to caller
4EE8: 18 CD           JR      $4EB7               ; {code.loc_4eb7} loop back-edge

; stepHighScoreInitialsEntry — per-frame action dispatch for a two-cell (vertically stacked)
; object, keyed on the low five action bits of the debounced input byte. ROM 0x4eea.
stepHighScoreInitialsEntry:
4EEA: 3A 18 80        LD      A,($8018)           ; {ram.in0Debounced} control/action bits
4EED: CB 47           BIT     0,A
4EEF: 20 35           JR      NZ,$4F26            ; {code.stepInitialDown} bit0 -> loc_4f26 (tail)
4EF1: CB 4F           BIT     1,A
4EF3: 20 43           JR      NZ,$4F38            ; {code.advanceInitialUp} bit1 -> loc_4f38 (tail)
4EF5: CB 57           BIT     2,A
4EF7: 20 2D           JR      NZ,$4F26            ; {code.stepInitialDown} bit2 -> loc_4f26 (tail)
4EF9: CB 5F           BIT     3,A
4EFB: 20 3B           JR      NZ,$4F38            ; {code.advanceInitialUp} bit3 -> loc_4f38 (tail)
4EFD: CB 67           BIT     4,A
4EFF: C8              RET     Z                   ; bits 0..4 all clear -> idle return
4F00: 71              LD      (HL),C              ; erase current top cell
4F01: DD 71 00        LD      (IX+$00),C          ; erase current bottom cell
4F04: 78              LD      A,B                 ; A = object code
4F05: 01 E0 FF        LD      BC,$FFE0            ; BC = -0x20 (one tilemap row up)
4F08: 09              ADD     HL,BC               ; hl -= 0x20
4F09: EB              EX      DE,HL
4F0A: 09              ADD     HL,BC               ; (old de) -= 0x20 while swapped in
4F0B: EB              EX      DE,HL               ; swap back
4F0C: DD 23           INC     IX
4F0E: 0E 0A           LD      C,$0A
4F10: 12              LD      (DE),A              ; redraw object code one row up
4F11: 47              LD      B,A
4F12: 3A 4B 80        LD      A,($804B)           ; {ram.initialsRemaining}
4F15: 3D              DEC     A
4F16: 32 4B 80        LD      ($804B),A           ; {ram.initialsRemaining} decrement counter
4F19: 3E 00           LD      A,$00
4F1B: 32 10 80        LD      ($8010),A           ; {ram.playPhaseCounter} clear 0x8010
4F1E: CD 8F 4C        CALL    $4C8F               ; {code.requestSound16}
4F21: 3E 14           LD      A,$14               ; 20-frame delay
4F23: C3 FF 4B        JP      $4BFF               ; {code.waitFrames} arm a 20-frame vblank delay (tail)

; stepInitialDown — step a caller's bounded cyclic index down one notch and request sound 8. ROM
; 0x4f26.
stepInitialDown:
4F26: CD 6F 4C        CALL    $4C6F               ; {code.requestSound8} request sound 8 (resumes at 0x4f29)
4F29: 0D              DEC     C                   ; step the index down one (carry preserved)
4F2A: 3E FE           LD      A,$FE
4F2C: B9              CP      C                   ; A(0xfe) - C ; Z iff C == 0xfe (underflow from 0xff)
4F2D: 20 02           JR      NZ,$4F31            ; {code.loc_4f31} not the wrap case -> skip the reset
4F2F: 0E 23           LD      C,$23               ; wrap: re-enter range from the top

loc_4f31:
4F31: 3E 09           LD      A,$09
4F33: B9              CP      C                   ; A(0x09) - C ; carry set iff C > 0x09
4F34: D8              RET     C                   ; still above the floor -> keep C, return
4F35: 0E FF           LD      C,$FF               ; hit/passed the floor -> clamp to sentinel
4F37: C9              RET

; advanceInitialUp — step an object's cyclic index up one notch and request sound 8. ROM 0x4f38.
advanceInitialUp:
4F38: CD 6F 4C        CALL    $4C6F               ; {code.requestSound8} request sound 8 (resumes at 0x4f3b)
4F3B: 0C              INC     C                   ; step the index up one (carry preserved, Z iff overflow to 0x00)
4F3C: 20 02           JR      NZ,$4F40            ; {code.loc_4f40} C != 0 -> skip the reset (no overflow)
4F3E: 0E 0A           LD      C,$0A               ; overflow 0xff->0x00 : re-enter range at bottom

loc_4f40:
4F40: 3E 23           LD      A,$23
4F42: B9              CP      C                   ; A(0x23) - C ; carry set iff C > 0x23
4F43: D0              RET     NC                  ; C at/below the ceiling -> keep it, return
4F44: 0E FF           LD      C,$FF               ; passed the ceiling -> clamp to sentinel
4F46: C9              RET

; showColourTestScreen — the DIP-selected colour/tile test pattern screen. ROM 0x4f47.
showColourTestScreen:
4F47: 3E 09           LD      A,$09
4F49: 32 01 80        LD      ($8001),A           ; {ram.gameState} mode byte = 9
4F4C: CD 44 4B        CALL    $4B44               ; {code.blankScreen}
4F4F: 3A 18 80        LD      A,($8018)           ; {ram.in0Debounced} input/mode gate byte
4F52: CB 5F           BIT     3,A                 ; Z set iff bit3 CLEAR
4F54: CA 55 4B        JP      Z,$4B55             ; {code.applyDipSwitches} bit3 clear -> bail (tail-jump; loc_4b55's ret returns to OUR caller)
4F57: CB 67           BIT     4,A                 ; Z set iff bit4 CLEAR
4F59: CA 55 4B        JP      Z,$4B55             ; {code.applyDipSwitches} bit4 clear -> bail (tail-jump loc_4b55)
4F5C: 3E 01           LD      A,$01
4F5E: CD FF 4B        CALL    $4BFF               ; {code.waitFrames} A=0x01
4F61: 3E 80           LD      A,$80               ; first pass value

loc_4f63:
4F63: 32 12 80        LD      ($8012),A           ; stash the pass value / loop counter
4F66: 06 04           LD      B,$04               ; 4 fill blocks
4F68: 0E 00           LD      C,$00               ; running tile index
4F6A: 21 00 90        LD      HL,$9000            ; {hard.videoRam} video RAM
4F6D: 11 00 88        LD      DE,$8800            ; colour RAM

loc_4f70:
4F70: 71              LD      (HL),C              ; VRAM tile = running index
4F71: 12              LD      (DE),A              ; colour RAM = pass value
4F72: 23              INC     HL
4F73: 13              INC     DE
4F74: 0C              INC     C                   ; Z set when it wraps 0xff->0x00
4F75: 20 F9           JR      NZ,$4F70            ; {code.loc_4f70} loop the C sweep while C != 0 (256 bytes)
4F77: 10 F7           DJNZ    $4F70               ; {code.loc_4f70} decrement B (no flags), repeat the block while non-zero
4F79: 3E 78           LD      A,$78
4F7B: CD FF 4B        CALL    $4BFF               ; {code.waitFrames} A=0x78
4F7E: 3A 12 80        LD      A,($8012)           ; reload the pass value
4F81: 3C              INC     A                   ; Z set when 0xff wraps to 0x00
4F82: 20 DF           JR      NZ,$4F63            ; {code.loc_4f63} next pass while non-zero (0x80..0xFF), else fall to the tail-jump
4F84: C3 AC 03        JP      $03AC               ; {code.resetStateAndShowSetup} unconditional TAIL-jump; loc_03ac's ret returns to OUR caller

; ==== UNREACHED 0x4f87-0x4fff (121 bytes) — untraced data (not reached from the two entry points; carried over verbatim) ====
4F87:                 DEFB    $B8,$23,$A9,$71,$F2,$FE,$96,$A6,$99,$E5,$56,$C6,$E9,$EA,$85,$C1
4F97:                 DEFB    $96,$A9,$D9,$82,$89,$65,$34,$58,$D7,$44,$BF,$37,$B7,$FA,$8A,$08
4FA7:                 DEFB    $E9,$6C,$46,$CB,$1A,$75,$C1,$2E,$29,$48,$39,$66,$29,$8B,$C6,$C4
4FB7:                 DEFB    $3D,$4D,$17,$31,$FA,$E6,$BA,$D9,$D4,$C6,$35,$74,$26,$09,$99,$CA
4FC7:                 DEFB    $1D,$E9,$3A,$4A,$87,$75,$29,$D6,$F2,$76,$D4,$F0,$15,$75,$8B,$CF
4FD7:                 DEFB    $BA,$76,$56,$E9,$9A,$E6,$F6,$F9,$F9,$24,$B9,$62,$B9,$2A,$0A,$0C
4FE7:                 DEFB    $44,$55,$B1,$7A,$C1,$39,$CB,$84,$CD,$2A,$F6,$01,$B5,$AC,$D9,$C9
4FF7:                 DEFB    $3A,$46,$E6,$49,$89,$35,$99,$34,$85
