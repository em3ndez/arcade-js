![Frogger](frogger.jpg)

# Frogger

>>> cpu Z80

>>> binary 0000:roms/frogger.26 + roms/frogger.27 + roms/frsm3.7

>>> memoryTable hard

[Hardware Info](Hardware.md)

>>> memoryTable ram

[RAM Usage](RAMUse.md)

```code
; Frogger (Konami, 1981).
;
; Architecture: on reset ($0000) the CPU jumps to initColdBootAndEnterMainLoop
; ($02A3). What follows is the code reached from the reset and interrupt entry
; points, shown as instructions; spans never reached appear as data (the "----
; data ----" blocks).


; reset vector: a dead self-check arm reads the unmapped self-check source
; SELF_CHECK_SOURCE (0x4000, which floats 0xff and never the 0x55 its jump
; would need), kicks the watchdog (WATCHDOG_RESET_PORT 0x8800), then
; enters cold-boot init (initColdBootAndEnterMainLoop). Writes no RAM of
; its own; memory-only
seatStackAndEnterColdBoot:
0000: 3A 00 40        LD      A,($4000)           
0003: FE 55           CP      $55                 
0005: CA 01 40        JP      Z,$4001             
0008: 3A 00 88        LD      A,($8800)           
000B: 31 00 88        LD      SP,$8800            
000E: C3 A3 02        JP      $02A3               ; {code.initColdBootAndEnterMainLoop}

; ---- $0011-$0017: data ----
0011: FF FF FF FF FF FF FF

; sound-command enqueue primitive (the command is in A): while not playing
; (PLAY_FLAG 0x83fe ==0) drop it and return, else bump the ring head count
; SOUND_QUEUE_COUNT (0x8300) and store the command at 0x8300 + head.
; Widely called for game sound effects; memory-only
enqueueSoundCommand:
0018: 4F              LD      C,A                 
0019: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
001C: B7              OR      A                   
001D: C8              RET     Z                   
001E: E5              PUSH    HL                  
001F: 21 00 83        LD      HL,$8300            
0022: 34              INC     (HL)                
0023: 7E              LD      A,(HL)              
0024: 6F              LD      L,A                 
0025: 71              LD      (HL),C              
0026: E1              POP     HL                  
0027: C9              RET                         

; copy a run of bytes up a tilemap column: for the caller's count, copy
; source into destination while stepping the destination back one 32-cell
; row per byte and advancing the source; a count of 0 copies 256. Leaves
; both pointers advanced for the caller; memory-only
copyRunUpTileColumn:
0028: 1A              LD      A,(DE)              
0029: 77              LD      (HL),A              
002A: 7D              LD      A,L                 
002B: D6 20           SUB     $20                 
002D: 6F              LD      L,A                 
002E: 30 01           JR      NC,$0031            ; {code.loc_0031}
0030: 25              DEC     H                   

loc_0031:
0031: 13              INC     DE                  
0032: 10 F4           DJNZ    $0028               ; {code.copyRunUpTileColumn}
0034: C9              RET                         

; ---- $0035-$0037: data ----
0035: FF FF FF

; tilemap-clear primitive: fill the 32x32 tilemap (1024 contiguous cells
; from VRAM_BASE 0xa800 through 0xabff) with the blank tile 0x10; the
; ROM's per-row busy delay is timing-only. Memory-only
clearTilemapToTile16:
0038: 11 10 20        LD      DE,$2010            
003B: 21 00 A8        LD      HL,$A800            

loc_003e:
003E: 06 20           LD      B,$20               

loc_0040:
0040: 73              LD      (HL),E              
0041: 23              INC     HL                  
0042: 10 FC           DJNZ    $0040               ; {code.loc_0040}
0044: 0E 15           LD      C,$15               

loc_0046:
0046: 10 FE           DJNZ    $0046               ; {code.loc_0046}
0048: 0D              DEC     C                   
0049: 20 FB           JR      NZ,$0046            ; {code.loc_0046}
004B: 15              DEC     D                   
004C: 20 F0           JR      NZ,$003E            ; {code.loc_003e}
004E: C9              RET                         

; ---- $004F-$0065: data ----
004F: FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF
005F: FF FF FF FF FF FF FF

; vblank NMI handler, one frame of interrupt service: ack the NMI
; (NMI_ENABLE 0xb808), scan coins/credits (scanCoinInputAndCredit), blit
; the work-RAM sprite shadow (SPRITE_SHADOW_SRC_BASE 0x8008) into OBJRAM
; with a per-byte nibble-swap, and tick the two coin-counter pulse timers
; (COIN_PULSE_TIMER_0/1 0x837e/0x837f), dropping their hardware latches on
; drain. Then run the play/mode dispatch tree: the attract-demo sequencer
; and intro/mode housekeeping while idle, else the in-play sub-engines
; (lane-object mover, frog move-vs-lanes, death animation, sprite-object
; cluster, score-display, countdowns) plus the board-complete home reveal
; (stampHomeBayFrogByColumn keyed on HOME_REVEAL_COUNTDOWN 0x8297).
; Memory-only
serviceVblankNmi:
0066: F5              PUSH    AF                  
0067: E5              PUSH    HL                  
0068: D5              PUSH    DE                  
0069: C5              PUSH    BC                  
006A: DD E5           PUSH    IX                  
006C: FD E5           PUSH    IY                  
006E: 3A 00 88        LD      A,($8800)           
0071: AF              XOR     A                   
0072: 32 08 B8        LD      ($B808),A           
0075: CD F0 2C        CALL    $2CF0               ; {code.scanCoinInputAndCredit}
0078: 21 07 80        LD      HL,$8007            
007B: 11 07 B0        LD      DE,$B007            
007E: 7E              LD      A,(HL)              
007F: 12              LD      (DE),A              
0080: 2C              INC     L                   
0081: 1C              INC     E                   
0082: 06 1C           LD      B,$1C               

loc_0084:
0084: 7E              LD      A,(HL)              
0085: 0F              RRCA                        
0086: 0F              RRCA                        
0087: 0F              RRCA                        
0088: 0F              RRCA                        
0089: 12              LD      (DE),A              
008A: 2C              INC     L                   
008B: 1C              INC     E                   
008C: 7E              LD      A,(HL)              
008D: 12              LD      (DE),A              
008E: 2C              INC     L                   
008F: 1C              INC     E                   
0090: 10 F2           DJNZ    $0084               ; {code.loc_0084}
0092: 0E 08           LD      C,$08               
0094: 3A 2F 84        LD      A,($842F)           ; {hard.workRam+42F}
0097: B7              OR      A                   
0098: 28 05           JR      Z,$009F             ; {code.loc_009f}
009A: 0E 06           LD      C,$06               
009C: 1E 48           LD      E,$48               
009E: 6B              LD      L,E                 

loc_009f:
009F: 7E              LD      A,(HL)              
00A0: 0F              RRCA                        
00A1: 0F              RRCA                        
00A2: 0F              RRCA                        
00A3: 0F              RRCA                        
00A4: 12              LD      (DE),A              
00A5: 2C              INC     L                   
00A6: 1C              INC     E                   
00A7: 06 03           LD      B,$03               

loc_00a9:
00A9: 7E              LD      A,(HL)              
00AA: 12              LD      (DE),A              
00AB: 2C              INC     L                   
00AC: 1C              INC     E                   
00AD: 10 FA           DJNZ    $00A9               ; {code.loc_00a9}
00AF: 0D              DEC     C                   
00B0: 20 ED           JR      NZ,$009F            ; {code.loc_009f}
00B2: 21 7F 83        LD      HL,$837F            
00B5: 7E              LD      A,(HL)              
00B6: B7              OR      A                   
00B7: 28 07           JR      Z,$00C0             ; {code.loc_00c0}
00B9: 35              DEC     (HL)                
00BA: 20 04           JR      NZ,$00C0            ; {code.loc_00c0}
00BC: AF              XOR     A                   
00BD: 32 1C B8        LD      ($B81C),A           

loc_00c0:
00C0: 21 7E 83        LD      HL,$837E            
00C3: 7E              LD      A,(HL)              
00C4: B7              OR      A                   
00C5: 28 07           JR      Z,$00CE             ; {code.loc_00ce}
00C7: 35              DEC     (HL)                
00C8: 20 04           JR      NZ,$00CE            ; {code.loc_00ce}
00CA: AF              XOR     A                   
00CB: 32 18 B8        LD      ($B818),A           

loc_00ce:
00CE: 3A 04 E0        LD      A,($E004)           
00D1: E6 08           AND     $08                 
00D3: CA FC 00        JP      Z,$00FC             ; {code.loc_00fc}
00D6: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
00D9: A7              AND     A                   
00DA: CA FC 00        JP      Z,$00FC             ; {code.loc_00fc}
00DD: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
00E0: A7              AND     A                   
00E1: 28 19           JR      Z,$00FC             ; {code.loc_00fc}
00E3: 3D              DEC     A                   
00E4: 28 16           JR      Z,$00FC             ; {code.loc_00fc}
00E6: 0E 02           LD      C,$02               
00E8: 21 43 80        LD      HL,$8043            
00EB: 11 43 B0        LD      DE,$B043            
00EE: 7E              LD      A,(HL)              
00EF: 81              ADD     A,C                 
00F0: 12              LD      (DE),A              
00F1: 0E 02           LD      C,$02               
00F3: 21 47 80        LD      HL,$8047            
00F6: 11 47 B0        LD      DE,$B047            
00F9: 7E              LD      A,(HL)              
00FA: 81              ADD     A,C                 
00FB: 12              LD      (DE),A              

loc_00fc:
00FC: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
00FF: B7              OR      A                   
0100: CA 22 01        JP      Z,$0122             ; {code.loc_0122}
0103: CD AC 07        CALL    $07AC               ; {code.dequeueSoundCommand}
0106: 3A EA 83        LD      A,($83EA)           ; {hard.workRam+3EA}
0109: B7              OR      A                   
010A: CA 45 02        JP      Z,$0245             ; {code.loc_0245}
010D: 2A D2 83        LD      HL,($83D2)          ; {hard.workRam+3D2}
0110: 7C              LD      A,H                 
0111: B5              OR      L                   
0112: CA 71 01        JP      Z,$0171             ; {code.loc_0171}
0115: 2B              DEC     HL                  
0116: 22 D2 83        LD      ($83D2),HL          ; {hard.workRam+3D2}
0119: CD B7 14        CALL    $14B7               ; {code.moveLaneObjectsAndCarryFrog}

loc_011c:
011C: CD 02 18        CALL    $1802               ; {code.advanceAnimationFrameBuffer}
011F: C3 45 02        JP      $0245               ; {code.loc_0245}

loc_0122:
0122: 3A D6 83        LD      A,($83D6)           ; {hard.workRam+3D6}
0125: FE 02           CP      $02                 
0127: D2 58 01        JP      NC,$0158            ; {code.loc_0158}
012A: B7              OR      A                   
012B: CC 7A 0E        CALL    Z,$0E7A             ; {code.driveAttractDemoSequencer}
012E: CD 41 23        CALL    $2341               ; {code.driveInPlayFrameUpdate}
0131: AF              XOR     A                   
0132: 32 CD 83        LD      ($83CD),A           ; {hard.workRam+3CD}
0135: 32 CF 83        LD      ($83CF),A           ; {hard.workRam+3CF}
0138: 32 B5 83        LD      ($83B5),A           ; {hard.workRam+3B5}
013B: 67              LD      H,A                 
013C: 6F              LD      L,A                 
013D: 22 93 82        LD      ($8293),HL          ; {hard.workRam+293}
0140: 21 5C 82        LD      HL,$825C            
0143: 11 5D 82        LD      DE,$825D            
0146: 01 0B 00        LD      BC,$000B            
0149: 70              LD      (HL),B              
014A: ED B0           LDIR                        
014C: 21 AF 83        LD      HL,$83AF            
014F: 36 80           LD      (HL),$80            
0151: 2C              INC     L                   
0152: 77              LD      (HL),A              
0153: 2C              INC     L                   
0154: 77              LD      (HL),A              
0155: C3 45 02        JP      $0245               ; {code.loc_0245}

loc_0158:
0158: 21 D8 83        LD      HL,$83D8            
015B: 7E              LD      A,(HL)              
015C: B7              OR      A                   
015D: CA 45 02        JP      Z,$0245             ; {code.loc_0245}
0160: 35              DEC     (HL)                
0161: C2 45 02        JP      NZ,$0245            ; {code.loc_0245}
0164: 2D              DEC     L                   
0165: 7E              LD      A,(HL)              
0166: B7              OR      A                   
0167: C2 45 02        JP      NZ,$0245            ; {code.loc_0245}
016A: 21 D6 83        LD      HL,$83D6            
016D: 35              DEC     (HL)                
016E: C3 45 02        JP      $0245               ; {code.loc_0245}

loc_0171:
0171: 2A 82 83        LD      HL,($8382)          ; {hard.workRam+382}
0174: 7C              LD      A,H                 
0175: B5              OR      L                   
0176: 28 12           JR      Z,$018A             ; {code.loc_018a}
0178: 2B              DEC     HL                  
0179: 22 82 83        LD      ($8382),HL          ; {hard.workRam+382}
017C: 7C              LD      A,H                 
017D: B5              OR      L                   
017E: 20 0A           JR      NZ,$018A            ; {code.loc_018a}
0180: 3E 0F           LD      A,$0F               
0182: DF              RST     $18                 
0183: 3E B0           LD      A,$B0               
0185: DF              RST     $18                 
0186: AF              XOR     A                   
0187: 32 71 83        LD      ($8371),A           ; {hard.workRam+371}

loc_018a:
018A: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
018D: 3D              DEC     A                   
018E: C2 74 02        JP      NZ,$0274            ; {code.loc_0274}
0191: 3A 5C 82        LD      A,($825C)           ; {hard.workRam+25C}
0194: FE 05           CP      $05                 
0196: CA 5E 02        JP      Z,$025E             ; {code.loc_025e}

loc_0199:
0199: 3A 98 82        LD      A,($8298)           ; {hard.workRam+298}
019C: A7              AND     A                   
019D: 28 07           JR      Z,$01A6             ; {code.loc_01a6}
019F: 3D              DEC     A                   
01A0: 32 98 82        LD      ($8298),A           ; {hard.workRam+298}
01A3: C3 E2 01        JP      $01E2               ; {code.loc_01e2}

loc_01a6:
01A6: 3A 97 82        LD      A,($8297)           ; {hard.workRam+297}
01A9: A7              AND     A                   
01AA: C2 57 02        JP      NZ,$0257            ; {code.loc_0257}
01AD: 2A 9D 82        LD      HL,($829D)          ; {hard.workRam+29D}
01B0: 7C              LD      A,H                 
01B1: B5              OR      L                   
01B2: 20 2E           JR      NZ,$01E2            ; {code.loc_01e2}
01B4: CD 70 08        CALL    $0870               ; {code.driveScoreDisplayCountdown}
01B7: CD 55 1A        CALL    $1A55               ; {code.orchestrateCollisionsAndFrogInput}
01BA: 3A B5 83        LD      A,($83B5)           ; {hard.workRam+3B5}
01BD: B7              OR      A                   
01BE: 20 22           JR      NZ,$01E2            ; {code.loc_01e2}
01C0: 3C              INC     A                   
01C1: 32 B5 83        LD      ($83B5),A           ; {hard.workRam+3B5}
01C4: 3E FF           LD      A,$FF               
01C6: 32 84 83        LD      ($8384),A           ; {hard.workRam+384}
01C9: 3A 80 83        LD      A,($8380)           ; {hard.workRam+380}
01CC: B7              OR      A                   
01CD: 28 13           JR      Z,$01E2             ; {code.loc_01e2}
01CF: AF              XOR     A                   
01D0: 32 80 83        LD      ($8380),A           ; {hard.workRam+380}
01D3: 21 40 00        LD      HL,$0040            
01D6: 22 82 83        LD      ($8382),HL          ; {hard.workRam+382}
01D9: 11 7B 2F        LD      DE,$2F7B            
01DC: 21 51 AA        LD      HL,$AA51            
01DF: 06 07           LD      B,$07               
01E1: EF              RST     $28                 

loc_01e2:
01E2: 3A 84 83        LD      A,($8384)           ; {hard.workRam+384}
01E5: B7              OR      A                   
01E6: 28 0A           JR      Z,$01F2             ; {code.loc_01f2}
01E8: 3D              DEC     A                   
01E9: 32 84 83        LD      ($8384),A           ; {hard.workRam+384}
01EC: 21 50 A8        LD      HL,$A850            
01EF: CC E2 19        CALL    Z,$19E2             ; {code.blitFourTileGroupColumn}

loc_01f2:
01F2: CD 05 20        CALL    $2005               ; {code.advanceScrollLaneObjects}
01F5: CD 02 18        CALL    $1802               ; {code.advanceAnimationFrameBuffer}
01F8: 3A 07 81        LD      A,($8107)           ; {hard.workRam+107}
01FB: A7              AND     A                   
01FC: 28 07           JR      Z,$0205             ; {code.loc_0205}
01FE: 3A 09 81        LD      A,($8109)           ; {hard.workRam+109}
0201: 3D              DEC     A                   
0202: 32 09 81        LD      ($8109),A           ; {hard.workRam+109}

loc_0205:
0205: 3A 08 81        LD      A,($8108)           ; {hard.workRam+108}
0208: A7              AND     A                   
0209: 28 07           JR      Z,$0212             ; {code.loc_0212}
020B: 3A 24 81        LD      A,($8124)           ; {hard.workRam+124}
020E: 3D              DEC     A                   
020F: 32 24 81        LD      ($8124),A           ; {hard.workRam+124}

loc_0212:
0212: CD BF 11        CALL    $11BF               ; {code.dispatchFrogMoveAgainstLanes}
0215: 3A 07 81        LD      A,($8107)           ; {hard.workRam+107}
0218: A7              AND     A                   
0219: 28 07           JR      Z,$0222             ; {code.loc_0222}
021B: 3A 09 81        LD      A,($8109)           ; {hard.workRam+109}
021E: 3C              INC     A                   
021F: 32 09 81        LD      ($8109),A           ; {hard.workRam+109}

loc_0222:
0222: 3A 08 81        LD      A,($8108)           ; {hard.workRam+108}
0225: A7              AND     A                   
0226: 28 07           JR      Z,$022F             ; {code.loc_022f}
0228: 3A 24 81        LD      A,($8124)           ; {hard.workRam+124}
022B: 3C              INC     A                   
022C: 32 24 81        LD      ($8124),A           ; {hard.workRam+124}

loc_022f:
022F: CD F8 16        CALL    $16F8               ; {code.driveFrogDeathAnimation}
0232: CD B7 14        CALL    $14B7               ; {code.moveLaneObjectsAndCarryFrog}

loc_0235:
0235: CD 70 29        CALL    $2970               ; {code.driveSpriteObjectCluster}
0238: CD C7 1F        CALL    $1FC7               ; {code.tickGatedCountdown}
023B: CD 92 02        CALL    $0292               ; {code.loc_0292}
023E: 3A 97 82        LD      A,($8297)           ; {hard.workRam+297}
0241: A7              AND     A                   
0242: C4 A2 06        CALL    NZ,$06A2            ; {code.stampHomeBayFrogByColumn}

loc_0245:
0245: 3A 00 88        LD      A,($8800)           
0248: FD E1           POP     IY                  
024A: DD E1           POP     IX                  
024C: C1              POP     BC                  
024D: D1              POP     DE                  
024E: E1              POP     HL                  
024F: 3E 01           LD      A,$01               
0251: 32 08 B8        LD      ($B808),A           
0254: F1              POP     AF                  
0255: ED 45           RETN                        

loc_0257:
0257: 3D              DEC     A                   
0258: 32 97 82        LD      ($8297),A           ; {hard.workRam+297}
025B: C3 E2 01        JP      $01E2               ; {code.loc_01e2}

loc_025e:
025E: 21 5E 82        LD      HL,$825E            
0261: 11 5F 82        LD      DE,$825F            
0264: 01 04 00        LD      BC,$0004            
0267: 70              LD      (HL),B              
0268: ED B0           LDIR                        
026A: AF              XOR     A                   
026B: 32 5C 82        LD      ($825C),A           ; {hard.workRam+25C}
026E: CD D3 05        CALL    $05D3               ; {code.loc_05d3}
0271: C3 45 02        JP      $0245               ; {code.loc_0245}

loc_0274:
0274: 3A 5D 82        LD      A,($825D)           ; {hard.workRam+25D}
0277: FE 05           CP      $05                 
0279: C2 99 01        JP      NZ,$0199            ; {code.loc_0199}
027C: 21 63 82        LD      HL,$8263            
027F: 11 64 82        LD      DE,$8264            
0282: 01 04 00        LD      BC,$0004            
0285: 70              LD      (HL),B              
0286: ED B0           LDIR                        
0288: AF              XOR     A                   
0289: 32 5D 82        LD      ($825D),A           ; {hard.workRam+25D}
028C: CD D3 05        CALL    $05D3               ; {code.loc_05d3}
028F: C3 45 02        JP      $0245               ; {code.loc_0245}

loc_0292:
0292: 2A 9D 82        LD      HL,($829D)          ; {hard.workRam+29D}
0295: 7C              LD      A,H                 
0296: B5              OR      L                   
0297: C8              RET     Z                   
0298: 2B              DEC     HL                  
0299: 22 9D 82        LD      ($829D),HL          ; {hard.workRam+29D}
029C: 7C              LD      A,H                 
029D: B5              OR      L                   
029E: C0              RET     NZ                  
029F: 32 AE 83        LD      ($83AE),A           ; {hard.workRam+3AE}
02A2: C9              RET                         

; cold-boot init, reached from the reset vector: disable the NMI
; (NMI_ENABLE 0xb808) and both flip latches, zero work RAM ($8000 0x8000
; through WORK_RAM_TOP 0x87ff) and the OBJRAM page (OBJRAM_BASE 0xb000);
; seed the starting time SHARED_TIME_BYTE (0x83e4) from the difficulty DSW
; table, the cabinet flag COCKTAIL_ENABLED_FLAG (0x83c2) and coinage
; COINAGE_WORD (0x83d4) from IN2, and the 18-byte score/state block plus
; the 32-byte spawn-RNG ring (SPAWN_RNG_RING_BASE 0x8400) from ROM
; defaults; default the player count NUM_PLAYERS (0x8370) to 1, re-enable
; the NMI, clear the screen, program both i8255 PPIs, pulse the sound port
; mute then unmute, and enter the main loop. Memory-only
initColdBootAndEnterMainLoop:
02A3: AF              XOR     A                   
02A4: 32 08 B8        LD      ($B808),A           
02A7: 32 05 88        LD      ($8805),A           
02AA: 32 10 B8        LD      ($B810),A           
02AD: 32 0C B8        LD      ($B80C),A           
02B0: 21 00 80        LD      HL,$8000            
02B3: 11 01 80        LD      DE,$8001            
02B6: 01 FF 07        LD      BC,$07FF            
02B9: 75              LD      (HL),L              
02BA: ED B0           LDIR                        
02BC: 21 00 B0        LD      HL,$B000            
02BF: 01 00 00        LD      BC,$0000            

loc_02c2:
02C2: 71              LD      (HL),C              
02C3: 2C              INC     L                   
02C4: 10 FC           DJNZ    $02C2               ; {code.loc_02c2}
02C6: 3A 02 E0        LD      A,($E002)           
02C9: 16 2E           LD      D,$2E               
02CB: E6 03           AND     $03                 
02CD: 5F              LD      E,A                 
02CE: 1A              LD      A,(DE)              
02CF: 32 E4 83        LD      ($83E4),A           ; {hard.workRam+3E4}
02D2: 3A 04 E0        LD      A,($E004)           
02D5: 67              LD      H,A                 
02D6: CB 5C           BIT     3,H                 
02D8: 28 05           JR      Z,$02DF             ; {code.loc_02df}
02DA: 3E 01           LD      A,$01               
02DC: 32 C2 83        LD      ($83C2),A           ; {hard.workRam+3C2}

loc_02df:
02DF: 7C              LD      A,H                 
02E0: E6 06           AND     $06                 
02E2: 32 D4 83        LD      ($83D4),A           ; {hard.workRam+3D4}
02E5: 21 0A 2E        LD      HL,$2E0A            
02E8: 11 EB 83        LD      DE,$83EB            
02EB: 01 12 00        LD      BC,$0012            
02EE: ED B0           LDIR                        
02F0: CD 48 10        CALL    $1048               ; {code.spinWatchdogSettleDelay}
02F3: 3E 01           LD      A,$01               
02F5: 32 70 83        LD      ($8370),A           ; {hard.workRam+370}
02F8: 32 08 B8        LD      ($B808),A           
02FB: FF              RST     $38                 
02FC: AF              XOR     A                   
02FD: 32 01 B0        LD      ($B001),A           
0300: 3E 06           LD      A,$06               
0302: 32 03 B0        LD      ($B003),A           
0305: 21 00 01        LD      HL,$0100            
0308: 22 C7 83        LD      ($83C7),HL          ; {hard.workRam+3C7}
030B: 3E 15           LD      A,$15               
030D: 32 81 83        LD      ($8381),A           ; {hard.workRam+381}
0310: 21 B1 2E        LD      HL,$2EB1            
0313: 11 00 84        LD      DE,$8400            
0316: 01 20 00        LD      BC,$0020            
0319: ED B0           LDIR                        
031B: 21 06 E0        LD      HL,$E006            
031E: 36 9B           LD      (HL),$9B            
0320: 21 06 D0        LD      HL,$D006            
0323: 36 88           LD      (HL),$88            
0325: 3E 18           LD      A,$18               
0327: 32 D9 83        LD      ($83D9),A           ; {hard.workRam+3D9}
032A: 32 02 D0        LD      ($D002),A           
032D: AF              XOR     A                   
032E: CD 94 07        CALL    $0794               ; {code.issueSoundCommand}
0331: 3A D9 83        LD      A,($83D9)           ; {hard.workRam+3D9}
0334: E6 EF           AND     $EF                 
0336: 32 D9 83        LD      ($83D9),A           ; {hard.workRam+3D9}
0339: 32 02 D0        LD      ($D002),A           
033C: 3E FF           LD      A,$FF               
033E: CD 94 07        CALL    $0794               ; {code.issueSoundCommand}

; the foreground main loop as a vblank coroutine: drain the idempotent
; foreground to its per-frame fixed point, then yield so the engine fires
; the NMI at the pace tail. Each drain runs the loop body twice — one pass
; is the steady-state fixed point, the second settles the life-restart
; cascade and is a no-op otherwise
drainForegroundThenYieldEachVblank:
0341: 3A D6 83        LD      A,($83D6)           ; {hard.workRam+3D6}
0344: FE 02           CP      $02                 
0346: D4 11 0D        CALL    NC,$0D11            ; {code.dispatchGameModeFrame}
0349: CD 1F 0B        CALL    $0B1F               ; {code.renderScoreHeader}
034C: 3A D6 83        LD      A,($83D6)           ; {hard.workRam+3D6}
034F: 3D              DEC     A                   
0350: C4 67 0B        CALL    NZ,$0B67            ; {code.renderCreditLine}
0353: CD 0F 23        CALL    $230F               ; {code.setUpPlayStartOnce}
0356: 3E 02           LD      A,$02               
0358: 21 54 82        LD      HL,$8254            
035B: 77              LD      (HL),A              
035C: 23              INC     HL                  
035D: 77              LD      (HL),A              
035E: 3E 09           LD      A,$09               
0360: 23              INC     HL                  
0361: 77              LD      (HL),A              
0362: 23              INC     HL                  
0363: 77              LD      (HL),A              
0364: 23              INC     HL                  
0365: 77              LD      (HL),A              
0366: 23              INC     HL                  
0367: 77              LD      (HL),A              

; the pace-tail re-entry, 0x0368, reached as `jp 0x0368` by every branch
; of the in-play tree once it has finished a frame's foreground. As a
; coroutine it runs nothing and hands control back to the driver, so the
; driver — not a busy-delay loop — decides when the pass is done and the
; frame yields
endForegroundPassAtPaceTail:
0368: 2A C7 83        LD      HL,($83C7)          ; {hard.workRam+3C7}

loc_036b:
036B: 7C              LD      A,H                 
036C: B5              OR      L                   
036D: 2B              DEC     HL                  
036E: 20 FB           JR      NZ,$036B            ; {code.loc_036b}
0370: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
0373: B7              OR      A                   
0374: C2 0B 04        JP      NZ,$040B            ; {code.setUpBoardOrContinueLife}
0377: 3A B3 83        LD      A,($83B3)           ; {hard.workRam+3B3}
037A: B7              OR      A                   
037B: 20 C4           JR      NZ,$0341            ; {code.drainForegroundThenYieldEachVblank}
037D: 3A 02 E0        LD      A,($E002)           
0380: 07              RLCA                        
0381: 30 07           JR      NC,$038A            ; {code.loc_038a}
0383: 07              RLCA                        
0384: 38 BB           JR      C,$0341             ; {code.drainForegroundThenYieldEachVblank}
0386: 0E 02           LD      C,$02               
0388: 18 02           JR      $038C               ; {code.loc_038c}

loc_038a:
038A: 0E 01           LD      C,$01               

loc_038c:
038C: 3A E1 83        LD      A,($83E1)           ; {hard.workRam+3E1}
038F: B9              CP      C                   
0390: 38 AF           JR      C,$0341             ; {code.drainForegroundThenYieldEachVblank}
0392: 91              SUB     C                   
0393: 27              DAA                         
0394: 32 E1 83        LD      ($83E1),A           ; {hard.workRam+3E1}
0397: 79              LD      A,C                 
0398: 32 70 83        LD      ($8370),A           ; {hard.workRam+370}
039B: 21 00 85        LD      HL,$8500            
039E: 11 01 85        LD      DE,$8501            
03A1: 01 FF 01        LD      BC,$01FF            
03A4: 75              LD      (HL),L              
03A5: ED B0           LDIR                        
03A7: 32 FE 83        LD      ($83FE),A           ; {hard.workRam+3FE}
03AA: 3E 01           LD      A,$01               
03AC: 32 FD 83        LD      ($83FD),A           ; {hard.workRam+3FD}
03AF: 32 B3 83        LD      ($83B3),A           ; {hard.workRam+3B3}
03B2: 67              LD      H,A                 
03B3: 6F              LD      L,A                 
03B4: 32 B7 83        LD      ($83B7),A           ; {hard.workRam+3B7}
03B7: 22 B8 83        LD      ($83B8),HL          ; {hard.workRam+3B8}
03BA: CD 0A 0B        CALL    $0B0A               ; {code.initNewGameScoreAndTimers}
03BD: 3E 03           LD      A,$03               
03BF: 32 3D 80        LD      ($803D),A           ; {hard.workRam+3D}
03C2: CD D9 07        CALL    $07D9               ; {code.clearSoundQueue}
03C5: AF              XOR     A                   
03C6: 32 71 80        LD      ($8071),A           ; {hard.workRam+71}
03C9: DF              RST     $18                 
03CA: 3E 09           LD      A,$09               
03CC: DF              RST     $18                 
03CD: 3E 0A           LD      A,$0A               
03CF: DF              RST     $18                 
03D0: 3E 0B           LD      A,$0B               
03D2: DF              RST     $18                 
03D3: 21 20 00        LD      HL,$0020            
03D6: 22 9D 82        LD      ($829D),HL          ; {hard.workRam+29D}
03D9: 21 A0 01        LD      HL,$01A0            
03DC: 22 82 83        LD      ($8382),HL          ; {hard.workRam+382}
03DF: 21 00 00        LD      HL,$0000            
03E2: 22 D2 83        LD      ($83D2),HL          ; {hard.workRam+3D2}
03E5: CD E6 07        CALL    $07E6               ; {code.clearActivePlayerWorkRam}
03E8: FF              RST     $38                 
03E9: CD 3D 22        CALL    $223D               ; {code.loadActivePlayerLaneParams}
03EC: AF              XOR     A                   
03ED: 67              LD      H,A                 
03EE: 6F              LD      L,A                 
03EF: 32 2F 84        LD      ($842F),A           ; {hard.workRam+42F}
03F2: 32 2D 84        LD      ($842D),A           ; {hard.workRam+42D}
03F5: 22 93 82        LD      ($8293),HL          ; {hard.workRam+293}
03F8: 21 40 84        LD      HL,$8440            
03FB: 11 41 84        LD      DE,$8441            
03FE: 01 4F 00        LD      BC,$004F            
0401: 70              LD      (HL),B              
0402: ED B0           LDIR                        
0404: 32 04 80        LD      ($8004),A           ; {hard.workRam+4}
0407: 3C              INC     A                   
0408: 32 5A 82        LD      ($825A),A           ; {hard.workRam+25A}

; board-start / life-loss dispatcher: continue-flag set tail-hands to the
; next-life path, else lays a fresh board (tilemap/pages/score
; header/board build/time bar/HUD/start flag) and tail-enters the play
; loop
setUpBoardOrContinueLife:
040B: 3A EA 83        LD      A,($83EA)           ; {hard.workRam+3EA}
040E: B7              OR      A                   
040F: C2 57 04        JP      NZ,$0457            ; {code.beginNextLifeOrIntro}
0412: 3A CD 83        LD      A,($83CD)           ; {hard.workRam+3CD}
0415: B7              OR      A                   
0416: 20 0D           JR      NZ,$0425            ; {code.loc_0425}
0418: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
041B: 3D              DEC     A                   
041C: 28 04           JR      Z,$0422             ; {code.loc_0422}
041E: FF              RST     $38                 
041F: CD EE 06        CALL    $06EE               ; {code.swapInActivePlayerPages}

loc_0422:
0422: CD 1F 0B        CALL    $0B1F               ; {code.renderScoreHeader}

loc_0425:
0425: 3A 6D 82        LD      A,($826D)           ; {hard.workRam+26D}
0428: A7              AND     A                   
0429: C4 F0 05        CALL    NZ,$05F0            ; {code.advanceBoardForeground}
042C: CD 42 09        CALL    $0942               ; {code.renderFrogSceneAndTickTimer}
042F: 32 EA 83        LD      ($83EA),A           ; {hard.workRam+3EA}
0432: CD 16 0A        CALL    $0A16               ; {code.renderTimeBar}
0435: 21 9E 83        LD      HL,$839E            
0438: 36 20           LD      (HL),$20            
043A: 2D              DEC     L                   
043B: 36 10           LD      (HL),$10            
043D: 2D              DEC     L                   
043E: 36 20           LD      (HL),$20            
0440: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
0443: 3D              DEC     A                   
0444: C4 C1 07        CALL    NZ,$07C1            ; {code.raiseActivePlayerStartFlag}
0447: AF              XOR     A                   
0448: 32 6D 82        LD      ($826D),A           ; {hard.workRam+26D}
044B: 3A CD 83        LD      A,($83CD)           ; {hard.workRam+3CD}
044E: 32 B6 83        LD      ($83B6),A           ; {hard.workRam+3B6}
0451: CD 48 0A        CALL    $0A48               ; {code.renderLivesRow}
0454: C3 68 03        JP      $0368               ; {code.endForegroundPassAtPaceTail}

; continue / next-life path: redraw the score header; if no life remains
; (LIFE_RESTART_FLAG 0x83ce ==0) resume the play loop at the pace tail,
; else re-activate the frog, clear the active player's work RAM, zero the
; score-display cursor pair, the board-layout gate BOARD_LAYOUT_GATE
; (0x83ea) and the 14-byte per-life HUD block (PER_LIFE_HUD_BASE 0x83a0),
; play the restart jingle, then either run the intro countdown
; (runIntroTimerThenInitGame, when $83CF 0x83cf is set) or hand play to
; the other player before resuming. Memory-only
beginNextLifeOrIntro:
0457: CD 1F 0B        CALL    $0B1F               ; {code.renderScoreHeader}
045A: 3A CE 83        LD      A,($83CE)           ; {hard.workRam+3CE}
045D: B7              OR      A                   
045E: CA 68 03        JP      Z,$0368             ; {code.endForegroundPassAtPaceTail}
0461: CD 04 08        CALL    $0804               ; {code.activateFrogObject}
0464: CD E6 07        CALL    $07E6               ; {code.clearActivePlayerWorkRam}
0467: AF              XOR     A                   
0468: 21 9A 83        LD      HL,$839A            
046B: 77              LD      (HL),A              
046C: 2C              INC     L                   
046D: 77              LD      (HL),A              
046E: 32 CC 83        LD      ($83CC),A           ; {hard.workRam+3CC}
0471: 32 EA 83        LD      ($83EA),A           ; {hard.workRam+3EA}
0474: 21 A0 83        LD      HL,$83A0            
0477: 11 A1 83        LD      DE,$83A1            
047A: 01 0D 00        LD      BC,$000D            
047D: 77              LD      (HL),A              
047E: ED B0           LDIR                        
0480: 3E 80           LD      A,$80               
0482: DF              RST     $18                 
0483: 3A CF 83        LD      A,($83CF)           ; {hard.workRam+3CF}
0486: B7              OR      A                   
0487: 20 06           JR      NZ,$048F            ; {code.runIntroTimerThenInitGame}
0489: CD 22 08        CALL    $0822               ; {code.handOffToOtherPlayer}
048C: C3 68 03        JP      $0368               ; {code.endForegroundPassAtPaceTail}

; intro / game-over entry: redraw the GAME-OVER line, queue two jingle
; commands, and count the 16-bit intro timer INTRO_TIMER (0x83c5) down to
; zero, then branch on configuration -- a one-player game (PLAY_FLAG
; 0x83fe ==1) cold-starts; a player-2 turn (ACTIVE_PLAYER 0x83fd !=1)
; takes the player-2 continue setup; an already-seeded player-1 board
; (CONTINUE_FLAG_2P 0x83ca set) pre-clears its primary home-bay gates;
; otherwise clear the screen, hand play to the other player, raise the
; play/slot flags, clear the five primary occupancy gates
; (HOME_BAY1_OCCUPANCY_PRIMARY 0x825e..), and copy the saved player-1
; work/object pages into the live pages. Memory-only
runIntroTimerThenInitGame:
048F: CD 59 0F        CALL    $0F59               ; {code.blitGameOverLine}
0492: 3E 0C           LD      A,$0C               
0494: DF              RST     $18                 
0495: 3E 0D           LD      A,$0D               
0497: DF              RST     $18                 
0498: 2A C5 83        LD      HL,($83C5)          ; {hard.workRam+3C5}

loc_049b:
049B: 2B              DEC     HL                  
049C: 22 C5 83        LD      ($83C5),HL          ; {hard.workRam+3C5}
049F: 7C              LD      A,H                 
04A0: B5              OR      L                   
04A1: 20 F8           JR      NZ,$049B            ; {code.loc_049b}
04A3: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
04A6: 3D              DEC     A                   
04A7: CA 47 05        JP      Z,$0547             ; {code.coldStartClearSlotGates}
04AA: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
04AD: 3D              DEC     A                   
04AE: C2 F3 04        JP      NZ,$04F3            ; {code.setUpPlayerTwoContinue}
04B1: 21 C9 83        LD      HL,$83C9            
04B4: 36 01           LD      (HL),$01            
04B6: 23              INC     HL                  
04B7: 7E              LD      A,(HL)              
04B8: B7              OR      A                   
04B9: C2 34 05        JP      NZ,$0534            ; {code.clearPlayerOneHomeBayGates}
04BC: FF              RST     $38                 
04BD: CD 22 08        CALL    $0822               ; {code.handOffToOtherPlayer}
04C0: 3E 01           LD      A,$01               
04C2: 32 FE 83        LD      ($83FE),A           ; {hard.workRam+3FE}
04C5: 32 5C 82        LD      ($825C),A           ; {hard.workRam+25C}
04C8: 21 5E 82        LD      HL,$825E            
04CB: 11 5F 82        LD      DE,$825F            
04CE: 01 04 00        LD      BC,$0004            
04D1: 36 00           LD      (HL),$00            
04D3: ED B0           LDIR                        
04D5: 21 00 86        LD      HL,$8600            
04D8: 11 FF 80        LD      DE,$80FF            
04DB: 01 B7 00        LD      BC,$00B7            
04DE: ED B0           LDIR                        
04E0: 21 C0 85        LD      HL,$85C0            
04E3: 11 0C 80        LD      DE,$800C            
04E6: 01 2B 00        LD      BC,$002B            
04E9: ED B0           LDIR                        
04EB: 3E 01           LD      A,$01               
04ED: 32 3F 80        LD      ($803F),A           ; {hard.workRam+3F}
04F0: C3 68 03        JP      $0368               ; {code.endForegroundPassAtPaceTail}

; player-2 continue setup: set the second continue flag CONTINUE_FLAG_2P
; (0x83ca); if the first continue flag CONTINUE_FLAG (0x83c9) is already
; set, enter cold-start init part two, else clear the screen, hand play to
; the other player, raise the play/slot flags, clear the five alternate-
; bank home-bay occupancy gates (HOME_BAY1_OCCUPANCY_ALT 0x8263..), copy
; the saved player-2 object and work pages into the live pages, and set
; the per-column attribute shadow OBJRAM_COL3F_ATTR_SHADOW (0x803f).
; Memory-only
setUpPlayerTwoContinue:
04F3: 21 CA 83        LD      HL,$83CA            
04F6: 36 01           LD      (HL),$01            
04F8: 2B              DEC     HL                  
04F9: 7E              LD      A,(HL)              
04FA: B7              OR      A                   
04FB: C2 57 05        JP      NZ,$0557            ; {code.coldStartClearAltSlotGates}
04FE: FF              RST     $38                 
04FF: CD 22 08        CALL    $0822               ; {code.handOffToOtherPlayer}
0502: 3E 01           LD      A,$01               
0504: 32 FE 83        LD      ($83FE),A           ; {hard.workRam+3FE}
0507: 32 5D 82        LD      ($825D),A           ; {hard.workRam+25D}
050A: 21 63 82        LD      HL,$8263            
050D: 11 64 82        LD      DE,$8264            
0510: 01 04 00        LD      BC,$0004            
0513: 70              LD      (HL),B              
0514: ED B0           LDIR                        
0516: 21 C0 86        LD      HL,$86C0            
0519: 11 0C 80        LD      DE,$800C            
051C: 01 2B 00        LD      BC,$002B            
051F: ED B0           LDIR                        
0521: 3E 01           LD      A,$01               
0523: 32 3F 80        LD      ($803F),A           ; {hard.workRam+3F}
0526: 21 00 85        LD      HL,$8500            
0529: 11 FF 80        LD      DE,$80FF            
052C: 01 B7 00        LD      BC,$00B7            
052F: ED B0           LDIR                        
0531: C3 68 03        JP      $0368               ; {code.endForegroundPassAtPaceTail}

; player-1 cold board re-init, taken on the intro/continue entry when
; player-2's board is already seeded (CONTINUE_FLAG_2P 0x83ca set): zero
; the player-1 slot byte PLAYER1_SLOT (0x825c) and the five primary-bank
; home-bay occupancy gates (HOME_BAY1_OCCUPANCY_PRIMARY 0x825e..0x8262),
; then enter the shared cold-start mid-entry
; (coldStartClearPlayRamAndSetMode), which reads them cleared. Memory-only
clearPlayerOneHomeBayGates:
0534: AF              XOR     A                   
0535: 32 5C 82        LD      ($825C),A           ; {hard.workRam+25C}
0538: 21 5E 82        LD      HL,$825E            
053B: 11 5F 82        LD      DE,$825F            
053E: 01 04 00        LD      BC,$0004            
0541: 70              LD      (HL),B              
0542: ED B0           LDIR                        
0544: C3 67 05        JP      $0567               ; {code.coldStartClearPlayRamAndSetMode}

; cold-start new-game init, part one: zero the player-1 slot byte
; PLAYER1_SLOT (0x825c) and the five primary-bank home-bay occupancy gates
; (HOME_BAY1_OCCUPANCY_PRIMARY 0x825e..0x8262), then fall into part two
; (coldStartClearAltSlotGates). Memory-only
coldStartClearSlotGates:
0547: AF              XOR     A                   
0548: 32 5C 82        LD      ($825C),A           ; {hard.workRam+25C}
054B: 21 5E 82        LD      HL,$825E            
054E: 11 5F 82        LD      DE,$825F            
0551: 01 04 00        LD      BC,$0004            
0554: 70              LD      (HL),B              
0555: ED B0           LDIR                        

; cold-start new-game init, part two: zero the player-2 slot byte
; PLAYER2_SLOT (0x825d) and the five alternate-bank home-bay occupancy
; gates (HOME_BAY1_OCCUPANCY_ALT 0x8263..0x8267), then fall into the
; shared cold-start mid-entry (coldStartClearPlayRamAndSetMode). The
; player-2 continue path also lands here. Memory-only
coldStartClearAltSlotGates:
0557: AF              XOR     A                   
0558: 32 5D 82        LD      ($825D),A           ; {hard.workRam+25D}
055B: 21 63 82        LD      HL,$8263            
055E: 11 64 82        LD      DE,$8264            
0561: 01 04 00        LD      BC,$0004            
0564: 70              LD      (HL),B              
0565: ED B0           LDIR                        

; shared cold-start mid-entry: clear the screen, run the credit-line /
; score-rank / score-header setup, clear three work-RAM spans
; (SPRITE_BLOCK2_BASE 0x8100..0x825f, $8000 0x8000..0x8004,
; LIVE_OBJECT_PAGE 0x800c..0x803a), zero the game-state bytes, both flip
; latches and the difficulty-index word (PLAYER1_DIFFICULTY_INDEX 0x8293),
; set GAME_MODE (0x83d6) =3 (attract score-ranking), force-clear the
; player work RAM, then resume at the pace tail. Memory-only
coldStartClearPlayRamAndSetMode:
0567: FF              RST     $38                 
0568: CD E6 07        CALL    $07E6               ; {code.clearActivePlayerWorkRam}
056B: CD 67 0B        CALL    $0B67               ; {code.renderCreditLine}
056E: CD 69 0F        CALL    $0F69               ; {code.packScoreRankPair}
0571: CD 1F 0B        CALL    $0B1F               ; {code.renderScoreHeader}
0574: 21 00 81        LD      HL,$8100            
0577: 11 01 81        LD      DE,$8101            
057A: 01 5F 01        LD      BC,$015F            
057D: 75              LD      (HL),L              
057E: ED B0           LDIR                        
0580: 21 00 80        LD      HL,$8000            
0583: 11 01 80        LD      DE,$8001            
0586: 01 04 00        LD      BC,$0004            
0589: 70              LD      (HL),B              
058A: ED B0           LDIR                        
058C: 21 0C 80        LD      HL,$800C            
058F: 11 0D 80        LD      DE,$800D            
0592: 01 2E 00        LD      BC,$002E            
0595: 70              LD      (HL),B              
0596: ED B0           LDIR                        
0598: AF              XOR     A                   
0599: 32 C3 83        LD      ($83C3),A           ; {hard.workRam+3C3}
059C: 32 FE 83        LD      ($83FE),A           ; {hard.workRam+3FE}
059F: 32 BF 83        LD      ($83BF),A           ; {hard.workRam+3BF}
05A2: 21 C9 83        LD      HL,$83C9            
05A5: 77              LD      (HL),A              
05A6: 2C              INC     L                   
05A7: 77              LD      (HL),A              
05A8: 67              LD      H,A                 
05A9: 6F              LD      L,A                 
05AA: 32 10 B8        LD      ($B810),A           
05AD: 32 0C B8        LD      ($B80C),A           
05B0: 22 93 82        LD      ($8293),HL          ; {hard.workRam+293}
05B3: 32 BB 83        LD      ($83BB),A           ; {hard.workRam+3BB}
05B6: 32 CB 83        LD      ($83CB),A           ; {hard.workRam+3CB}
05B9: 32 D8 83        LD      ($83D8),A           ; {hard.workRam+3D8}
05BC: 32 C4 83        LD      ($83C4),A           ; {hard.workRam+3C4}
05BF: 32 BA 83        LD      ($83BA),A           ; {hard.workRam+3BA}
05C2: 32 95 82        LD      ($8295),A           ; {hard.workRam+295}
05C5: 32 5B 82        LD      ($825B),A           ; {hard.workRam+25B}
05C8: 3E 03           LD      A,$03               
05CA: 32 D6 83        LD      ($83D6),A           ; {hard.workRam+3D6}
05CD: CD EB 07        CALL    $07EB               ; {code.forceClearPlayerWorkRam}
05D0: C3 68 03        JP      $0368               ; {code.endForegroundPassAtPaceTail}

loc_05d3:
05D3: 3E 01           LD      A,$01               
05D5: 32 6D 82        LD      ($826D),A           ; {hard.workRam+26D}
05D8: 32 5A 82        LD      ($825A),A           ; {hard.workRam+25A}
05DB: 32 CD 83        LD      ($83CD),A           ; {hard.workRam+3CD}
05DE: AF              XOR     A                   
05DF: 32 5B 82        LD      ($825B),A           ; {hard.workRam+25B}
05E2: 32 EA 83        LD      ($83EA),A           ; {hard.workRam+3EA}
05E5: 3E FF           LD      A,$FF               
05E7: 32 97 82        LD      ($8297),A           ; {hard.workRam+297}
05EA: 3E 40           LD      A,$40               
05EC: 32 98 82        LD      ($8298),A           ; {hard.workRam+298}
05EF: C9              RET                         

; board-advance foreground pass: queue two sound cues, bump the active
; player's difficulty index (PLAYER1_DIFFICULTY_INDEX 0x8293 /
; PLAYER2_DIFFICULTY_INDEX 0x8294, wrapping to 0 at 5), reseed the score
; field, reload the lane parameters and object-animation state for the new
; board, raise the board-laid-out flag BOARD_ADVANCE_DONE_FLAG (0x8380),
; then add the board-advance score delta (BOARD_ADVANCE_SCORE_DELTA
; 0x0100) to the score. Memory-only
advanceBoardForeground:
05F0: 3E 10           LD      A,$10               
05F2: DF              RST     $18                 
05F3: 3E 30           LD      A,$30               
05F5: DF              RST     $18                 
05F6: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
05F9: 3D              DEC     A                   
05FA: 20 0C           JR      NZ,$0608            ; {code.loc_0608}
05FC: 21 93 82        LD      HL,$8293            
05FF: 34              INC     (HL)                
0600: 7E              LD      A,(HL)              
0601: D6 05           SUB     $05                 
0603: 20 0D           JR      NZ,$0612            ; {code.loc_0612}
0605: 77              LD      (HL),A              
0606: 18 0A           JR      $0612               ; {code.loc_0612}

loc_0608:
0608: 21 94 82        LD      HL,$8294            
060B: 34              INC     (HL)                
060C: 7E              LD      A,(HL)              
060D: D6 05           SUB     $05                 
060F: 20 01           JR      NZ,$0612            ; {code.loc_0612}
0611: 77              LD      (HL),A              

loc_0612:
0612: CD 29 06        CALL    $0629               ; {code.clearAndSeedScoreField}
0615: CD 4B 06        CALL    $064B               ; {code.clearObjectBlocksAndMirrorToObjRam}
0618: CD 3D 22        CALL    $223D               ; {code.loadActivePlayerLaneParams}
061B: CD 02 1A        CALL    $1A02               ; {code.seedObjectAnimationState}
061E: 3E 01           LD      A,$01               
0620: 32 80 83        LD      ($8380),A           ; {hard.workRam+380}
0623: 11 00 01        LD      DE,$0100            
0626: C3 E0 08        JP      $08E0               ; {code.addScoreAndAwardExtraLife}

; reset the score field for a new board: clear the active player's work
; RAM, zero the score-display cursor pair (SCORE_DISPLAY_CURSOR_LO/HI
; 0x839a/0x839b), set the score-field marker $83CC (0x83cc) =1, then tile
; 0x20 rows of the blank marker (tile 0x10) -- two ten-cell runs separated
; by a two-cell gap per row -- down the field from FROG_ANIM_COLUMN_VRAM
; (0xa806). Memory-only
clearAndSeedScoreField:
0629: CD E6 07        CALL    $07E6               ; {code.clearActivePlayerWorkRam}
062C: 21 9A 83        LD      HL,$839A            
062F: AF              XOR     A                   
0630: 77              LD      (HL),A              
0631: 2C              INC     L                   
0632: 77              LD      (HL),A              
0633: 3C              INC     A                   
0634: 32 CC 83        LD      ($83CC),A           ; {hard.workRam+3CC}
0637: 3E 20           LD      A,$20               
0639: 21 06 A8        LD      HL,$A806            

loc_063c:
063C: CD 79 07        CALL    $0779               ; {code.fillTenCellRun}
063F: 2C              INC     L                   
0640: 2C              INC     L                   
0641: CD 79 07        CALL    $0779               ; {code.fillTenCellRun}
0644: 0E 0A           LD      C,$0A               
0646: 09              ADD     HL,BC               
0647: 3D              DEC     A                   
0648: 20 F2           JR      NZ,$063C            ; {code.loc_063c}
064A: C9              RET                         

; zero the 44-byte object block at LIVE_OBJECT_PAGE (0x800c), mirror its
; now-zero 43-byte head into OBJRAM (OBJRAM_OBJECT_MIRROR_BASE 0xb00c),
; then zero the 99-byte sprite block at SPRITE_BLOCK2_BASE (0x8100). No
; live-in; memory-only
clearObjectBlocksAndMirrorToObjRam:
064B: 21 0C 80        LD      HL,$800C            
064E: 11 0D 80        LD      DE,$800D            
0651: 01 2B 00        LD      BC,$002B            
0654: 70              LD      (HL),B              
0655: ED B0           LDIR                        
0657: 21 0C 80        LD      HL,$800C            
065A: 11 0C B0        LD      DE,$B00C            
065D: 01 2B 00        LD      BC,$002B            
0660: ED B0           LDIR                        
0662: 21 00 81        LD      HL,$8100            
0665: 11 01 81        LD      DE,$8101            
0668: 01 62 00        LD      BC,$0062            
066B: 36 00           LD      (HL),$00            
066D: ED B0           LDIR                        
066F: C9              RET                         

; board-complete finisher (the fill-all selector of the home-reveal
; dispatcher stampHomeBayFrogByColumn): stamp the 2x2 empty-home marker
; (tile 0x10) into all five home-bay VRAM bases
; (HOME_SLOT1_VRAM..HOME_SLOT5_VRAM) via fillTwoByTwoTileBlock, clear the
; home-column state cell HOME_COLUMN_STATE (0x842f), then award the extra
; life (awardExtraLife -- bumps the active player's life count and stamps
; the lives-row marker). Memory-only
fillAllHomeSlotsAndAwardLife:
0670: 21 64 AB        LD      HL,$AB64            
0673: CD 95 06        CALL    $0695               ; {code.fillTwoByTwoTileBlock}
0676: 21 A4 AA        LD      HL,$AAA4            
0679: CD 95 06        CALL    $0695               ; {code.fillTwoByTwoTileBlock}
067C: 21 E4 A9        LD      HL,$A9E4            
067F: CD 95 06        CALL    $0695               ; {code.fillTwoByTwoTileBlock}
0682: 21 24 A9        LD      HL,$A924            
0685: CD 95 06        CALL    $0695               ; {code.fillTwoByTwoTileBlock}
0688: 21 64 A8        LD      HL,$A864            
068B: CD 95 06        CALL    $0695               ; {code.fillTwoByTwoTileBlock}
068E: AF              XOR     A                   
068F: 32 2F 84        LD      ($842F),A           ; {hard.workRam+42F}
0692: C3 5F 0A        JP      $0A5F               ; {code.awardExtraLife}

; stamp a 2x2 marker block with tile 0x10 at the caller's base cell: base,
; base+1, and the two one 32-cell row below (base+32, base+33). Memory-
; only
fillTwoByTwoTileBlock:
0695: 3E 10           LD      A,$10               
0697: 77              LD      (HL),A              
0698: 23              INC     HL                  
0699: 77              LD      (HL),A              
069A: 01 1F 00        LD      BC,$001F            
069D: 09              ADD     HL,BC               
069E: 77              LD      (HL),A              
069F: 23              INC     HL                  
06A0: 77              LD      (HL),A              
06A1: C9              RET                         

; board-complete "all frogs home" reveal dispatcher, keyed on the home-
; column selector in A (fed each frame from HOME_REVEAL_COUNTDOWN 0x8297
; via the NMI dispatch): five descending selector values
; (0xC0/0x90/0x70/0x50/0x30) each stamp the 2x2 frog-in-home graphic
; (tiles 0xFC-0xFF) into that bay's VRAM base
; (HOME_SLOT1_VRAM..HOME_SLOT5_VRAM), so as the countdown passes each
; threshold another frog is revealed in its home; the fill-all selector
; 0x10 delegates to fillAllHomeSlotsAndAwardLife (which refills all five
; bays with the empty-home tile 0x10 and awards the extra life); any other
; value is a no-op. Memory-only
stampHomeBayFrogByColumn:
06A2: FE C0           CP      $C0                 
06A4: CA C1 06        JP      Z,$06C1             ; {code.loc_06c1}
06A7: FE 90           CP      $90                 
06A9: CA C7 06        JP      Z,$06C7             ; {code.loc_06c7}
06AC: FE 70           CP      $70                 
06AE: CA CD 06        JP      Z,$06CD             ; {code.loc_06cd}
06B1: FE 50           CP      $50                 
06B3: CA D3 06        JP      Z,$06D3             ; {code.loc_06d3}
06B6: FE 30           CP      $30                 
06B8: CA D9 06        JP      Z,$06D9             ; {code.loc_06d9}
06BB: FE 10           CP      $10                 
06BD: CA 70 06        JP      Z,$0670             ; {code.fillAllHomeSlotsAndAwardLife}
06C0: C9              RET                         

loc_06c1:
06C1: 21 64 AB        LD      HL,$AB64            
06C4: C3 DF 06        JP      $06DF               ; {code.loc_06df}

loc_06c7:
06C7: 21 A4 AA        LD      HL,$AAA4            
06CA: C3 DF 06        JP      $06DF               ; {code.loc_06df}

loc_06cd:
06CD: 21 E4 A9        LD      HL,$A9E4            
06D0: C3 DF 06        JP      $06DF               ; {code.loc_06df}

loc_06d3:
06D3: 21 24 A9        LD      HL,$A924            
06D6: C3 DF 06        JP      $06DF               ; {code.loc_06df}

loc_06d9:
06D9: 21 64 A8        LD      HL,$A864            
06DC: C3 DF 06        JP      $06DF               ; {code.loc_06df}

loc_06df:
06DF: 36 FC           LD      (HL),$FC            
06E1: 23              INC     HL                  
06E2: 36 FD           LD      (HL),$FD            
06E4: 01 1F 00        LD      BC,$001F            
06E7: 09              ADD     HL,BC               
06E8: 36 FE           LD      (HL),$FE            
06EA: 23              INC     HL                  
06EB: 36 FF           LD      (HL),$FF            
06ED: C9              RET                         

; swap the active player's work pages IN, for player 1 (ACTIVE_PLAYER
; 0x83fd ==1): bank the live 43-byte object page (LIVE_OBJECT_PAGE 0x800c)
; into OTHER_PLAYER_OBJECT_PAGE (0x85c0) and the live 183-byte work page
; (LANE_OBJECT_INDEX 0x80ff) into OTHER_PLAYER_WORK_PAGE (0x8600), restore
; this player's pages from OBJECT_PAGE_SAVE_BANK (0x86c0) and
; WORK_PAGE_SAVE_BANK (0x8500), and write the OBJRAM per-column attribute
; shadow OBJRAM_COL3F_ATTR_SHADOW (0x803f) =1; any other player number
; instead swaps OUT (swapOutActivePlayerPages). Runs at 2-player turn
; transitions; memory-only
swapInActivePlayerPages:
06EE: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
06F1: 3D              DEC     A                   
06F2: 20 32           JR      NZ,$0726            ; {code.swapOutActivePlayerPages}
06F4: 21 0C 80        LD      HL,$800C            
06F7: 11 C0 85        LD      DE,$85C0            
06FA: 01 2B 00        LD      BC,$002B            
06FD: ED B0           LDIR                        
06FF: 21 FF 80        LD      HL,$80FF            
0702: 11 00 86        LD      DE,$8600            
0705: 01 B7 00        LD      BC,$00B7            
0708: ED B0           LDIR                        
070A: 21 C0 86        LD      HL,$86C0            
070D: 11 0C 80        LD      DE,$800C            
0710: 01 2B 00        LD      BC,$002B            
0713: ED B0           LDIR                        
0715: 3E 01           LD      A,$01               
0717: 32 3F 80        LD      ($803F),A           ; {hard.workRam+3F}
071A: 21 00 85        LD      HL,$8500            
071D: 11 FF 80        LD      DE,$80FF            
0720: 01 B7 00        LD      BC,$00B7            
0723: ED B0           LDIR                        
0725: C9              RET                         

; swap the active player's work pages OUT: bank the two live pages (work
; at LANE_OBJECT_INDEX 0x80ff, object at LIVE_OBJECT_PAGE 0x800c) into
; their save banks, restore the other player's pages from
; OTHER_PLAYER_WORK_PAGE (0x8600) / OTHER_PLAYER_OBJECT_PAGE (0x85c0),
; write the OBJRAM per-column attribute shadow OBJRAM_COL3F_ATTR_SHADOW
; (0x803f) =1, then -- unless the init guard INIT_GUARD_LATCH (0x8295) is
; already set -- clear TWO_PLAYER_START_FLAG (0x825b) =0 and latch the
; init guard =1. Memory-only
swapOutActivePlayerPages:
0726: 21 FF 80        LD      HL,$80FF            
0729: 11 00 85        LD      DE,$8500            
072C: 01 B7 00        LD      BC,$00B7            
072F: ED B0           LDIR                        
0731: 21 0C 80        LD      HL,$800C            
0734: 11 C0 86        LD      DE,$86C0            
0737: 01 2B 00        LD      BC,$002B            
073A: ED B0           LDIR                        
073C: 21 00 86        LD      HL,$8600            
073F: 11 FF 80        LD      DE,$80FF            
0742: 01 B7 00        LD      BC,$00B7            
0745: ED B0           LDIR                        
0747: 21 C0 85        LD      HL,$85C0            
074A: 11 0C 80        LD      DE,$800C            
074D: 01 2B 00        LD      BC,$002B            
0750: ED B0           LDIR                        
0752: 3E 01           LD      A,$01               
0754: 32 3F 80        LD      ($803F),A           ; {hard.workRam+3F}
0757: 3A 95 82        LD      A,($8295)           ; {hard.workRam+295}
075A: A7              AND     A                   
075B: C0              RET     NZ                  
075C: AF              XOR     A                   
075D: 32 5B 82        LD      ($825B),A           ; {hard.workRam+25B}
0760: 3E 01           LD      A,$01               
0762: 32 95 82        LD      ($8295),A           ; {hard.workRam+295}
0765: C9              RET                         

; fill a 28-wide by 32-tall tilemap block with tile 0x10 from
; TILEMAP_FILL_BASE_28X32 (0xa802), skipping 4 cells between rows. No
; live-in; memory-only
fillTilemapBlock28x32:
0766: 21 02 A8        LD      HL,$A802            
0769: 11 10 20        LD      DE,$2010            
076C: 0E 04           LD      C,$04               

loc_076e:
076E: 06 1C           LD      B,$1C               

loc_0770:
0770: 73              LD      (HL),E              
0771: 23              INC     HL                  
0772: 10 FC           DJNZ    $0770               ; {code.loc_0770}
0774: 09              ADD     HL,BC               
0775: 15              DEC     D                   
0776: 20 F6           JR      NZ,$076E            ; {code.loc_076e}
0778: C9              RET                         

; fill ten consecutive cells with tile 0x10 from the caller's base,
; leaving the write pointer just past the run and the loop counter drained
; to 0 for the caller to read back. Memory-only
fillTenCellRun:
0779: 01 10 0A        LD      BC,$0A10            

loc_077c:
077C: 71              LD      (HL),C              
077D: 23              INC     HL                  
077E: 10 FC           DJNZ    $077C               ; {code.loc_077c}
0780: C9              RET                         

; Fill a 22-wide by 32-tall tilemap block with tile 16 from
; TILEMAP_FILL_BASE_22X32 (0xa808), skipping 10 cells between rows.
; Memory-only
fillTilemapBlock22x32:
0781: 21 08 A8        LD      HL,$A808            
0784: 11 10 20        LD      DE,$2010            
0787: 0E 0A           LD      C,$0A               

loc_0789:
0789: 06 16           LD      B,$16               

loc_078b:
078B: 73              LD      (HL),E              
078C: 23              INC     HL                  
078D: 10 FC           DJNZ    $078B               ; {code.loc_078b}
078F: 09              ADD     HL,BC               
0790: 15              DEC     D                   
0791: 20 F6           JR      NZ,$0789            ; {code.loc_0789}
0793: C9              RET                         

; Issue one sound command: latch the command byte (A) into SOUND_CMD_LATCH
; (0xd000), then pulse SOUND_CTRL_PORT (0xd002) bit 3 low-then-high (from
; the SOUND_CTRL_SHADOW 0x83d9 value) so the falling edge raises the audio
; /INT. Live-in A; IO-only
issueSoundCommand:
0794: 32 00 D0        LD      ($D000),A           
0797: 3A D9 83        LD      A,($83D9)           ; {hard.workRam+3D9}
079A: E6 F7           AND     $F7                 
079C: 32 02 D0        LD      ($D002),A           
079F: 00              NOP                         
07A0: 00              NOP                         
07A1: 00              NOP                         
07A2: 00              NOP                         
07A3: 3A D9 83        LD      A,($83D9)           ; {hard.workRam+3D9}
07A6: F6 08           OR      $08                 
07A8: 32 02 D0        LD      ($D002),A           
07AB: C9              RET                         

; Drain one queued sound command: when the pending count SOUND_QUEUE_COUNT
; (0x8300) is non-zero, decrement it, issue the front command byte
; (0x8301) via issueSoundCommand, then shift the remaining queue down one
; slot. Runs each in-play NMI.
dequeueSoundCommand:
07AC: 21 00 83        LD      HL,$8300            
07AF: 7E              LD      A,(HL)              
07B0: B7              OR      A                   
07B1: C8              RET     Z                   
07B2: 35              DEC     (HL)                
07B3: 4F              LD      C,A                 
07B4: 2C              INC     L                   
07B5: 7E              LD      A,(HL)              
07B6: CD 94 07        CALL    $0794               ; {code.issueSoundCommand}
07B9: 54              LD      D,H                 
07BA: 5D              LD      E,L                 
07BB: 2C              INC     L                   
07BC: 06 00           LD      B,$00               
07BE: ED B0           LDIR                        
07C0: C9              RET                         

; Raise the 2-player start flag for the active player: player 1
; (ACTIVE_PLAYER 0x83fd == 1) delegates to raiseTwoPlayerStartFlag; any
; other player writes TWO_PLAYER_START_FLAG (0x825b) = 1 directly. Called
; from the 2-player game-setup path. Memory-only
raiseActivePlayerStartFlag:
07C1: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
07C4: 3D              DEC     A                   
07C5: CA CE 07        JP      Z,$07CE             ; {code.raiseTwoPlayerStartFlag}
07C8: 3E 01           LD      A,$01               
07CA: 32 5B 82        LD      ($825B),A           ; {hard.workRam+25B}
07CD: C9              RET                         

; Raise the 2-player start flag: set TWO_PLAYER_START_FLAG (0x825b) = 1
; unless BOARD_ADVANCE_REQUEST (0x826d) is 0. Memory-only
raiseTwoPlayerStartFlag:
07CE: 3A 6D 82        LD      A,($826D)           ; {hard.workRam+26D}
07D1: A7              AND     A                   
07D2: C8              RET     Z                   
07D3: 3E 01           LD      A,$01               
07D5: 32 5B 82        LD      ($825B),A           ; {hard.workRam+25B}
07D8: C9              RET                         

; Game-start reset of the sound-command queue: zero the 48-byte region
; from SOUND_QUEUE_COUNT (0x8300) — the pending-command count plus the 47
; command slots above it (0x8300-0x832f). Memory-only
clearSoundQueue:
07D9: 21 00 83        LD      HL,$8300            
07DC: 11 01 83        LD      DE,$8301            
07DF: 01 2F 00        LD      BC,$002F            
07E2: 70              LD      (HL),B              
07E3: ED B0           LDIR                        
07E5: C9              RET                         

; Clear the active player's work RAM: return in a one-player game
; (PLAY_FLAG 0x83fe holds 1); otherwise (0 or 2) force-clear it via
; forceClearPlayerWorkRam, zeroing the frog object block (0x8044-0x8063)
; and the home-bay gate block (0x8420-0x842b). Memory-only
clearActivePlayerWorkRam:
07E6: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
07E9: 3D              DEC     A                   
07EA: C8              RET     Z                   

; Unconditional force-clear of the current player's work RAM: zero the
; frog object block from FROG_X (0x8044-0x8063) and the home-bay gate
; block HOME_BAY_GATE_BLOCK (0x8420-0x842b), no guard. Memory-only
forceClearPlayerWorkRam:
07EB: AF              XOR     A                   
07EC: 21 44 80        LD      HL,$8044            
07EF: 11 45 80        LD      DE,$8045            
07F2: 01 1F 00        LD      BC,$001F            
07F5: 70              LD      (HL),B              
07F6: ED B0           LDIR                        
07F8: 21 20 84        LD      HL,$8420            
07FB: 11 21 84        LD      DE,$8421            
07FE: 0E 0B           LD      C,$0B               
0800: 77              LD      (HL),A              
0801: ED B0           LDIR                        
0803: C9              RET                         

; Activate the frog object: mark FROG_X (0x8044) active (=1) and clear
; FROG_SPRITE_CODE (0x8045) and FROG_Y (0x8047); in a two-player game
; (PLAY_FLAG 0x83fe == 2) also seed the two 16-bit frog timers
; FROG_TIMER_A (0x83d2) and FROG_TIMER_B (0x83da) to 64. Memory-only
activateFrogObject:
0804: 21 44 80        LD      HL,$8044            
0807: AF              XOR     A                   
0808: 36 01           LD      (HL),$01            
080A: 2C              INC     L                   
080B: 77              LD      (HL),A              
080C: 2C              INC     L                   
080D: 2C              INC     L                   
080E: 77              LD      (HL),A              
080F: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
0812: FE 02           CP      $02                 
0814: C0              RET     NZ                  
0815: 21 40 00        LD      HL,$0040            
0818: 22 D2 83        LD      ($83D2),HL          ; {hard.workRam+3D2}
081B: 21 40 00        LD      HL,$0040            
081E: 22 DA 83        LD      ($83DA),HL          ; {hard.workRam+3DA}
0821: C9              RET                         

; Hand play to the other player: clear PER_TURN_SCRATCH (0x8371), then a
; one-player game returns. Otherwise toggle ACTIVE_PLAYER (0x83fd) between
; 1/2, load that player's lives into LIVES_COUNT (0x83b7) from
; PLAYER1_LIVES (0x83b8) / PLAYER2_LIVES (0x83b9), clear
; PER_PLAYER_RESET_CELL (0x83b6), and set PLAYER_START_DEMO_FLAG (0x825a)
; = 1; when COCKTAIL_ENABLED_FLAG (0x83c2) is set, toggle bit 0 of
; SCREEN_FLIP_LATCH (0x83cb) and mirror it to FLIP_X_LATCH (0xb810) /
; FLIP_Y_LATCH (0xb80c). Memory-only
handOffToOtherPlayer:
0822: AF              XOR     A                   
0823: 32 71 83        LD      ($8371),A           ; {hard.workRam+371}
0826: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
0829: 3D              DEC     A                   
082A: C8              RET     Z                   
082B: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
082E: EE 03           XOR     $03                 
0830: 32 FD 83        LD      ($83FD),A           ; {hard.workRam+3FD}
0833: 21 B8 83        LD      HL,$83B8            
0836: 3D              DEC     A                   
0837: 28 01           JR      Z,$083A             ; {code.loc_083a}
0839: 2C              INC     L                   

loc_083a:
083A: 7E              LD      A,(HL)              
083B: 32 B7 83        LD      ($83B7),A           ; {hard.workRam+3B7}
083E: AF              XOR     A                   
083F: 32 B6 83        LD      ($83B6),A           ; {hard.workRam+3B6}
0842: 3C              INC     A                   
0843: 32 5A 82        LD      ($825A),A           ; {hard.workRam+25A}
0846: 3A C2 83        LD      A,($83C2)           ; {hard.workRam+3C2}
0849: B7              OR      A                   
084A: C8              RET     Z                   
084B: 3A CB 83        LD      A,($83CB)           ; {hard.workRam+3CB}
084E: EE 01           XOR     $01                 
0850: 32 CB 83        LD      ($83CB),A           ; {hard.workRam+3CB}
0853: 67              LD      H,A                 
0854: 32 10 B8        LD      ($B810),A           
0857: 32 0C B8        LD      ($B80C),A           
085A: C9              RET                         

; The no-more-frogs tail (reached when the score-display countdown
; drains): blit a 4-tile strip (LAYOUT_SETUP_STRIP_SRC 0x2f6e) then a
; 5-tile strip (FIVE_TILE_STRIP_SRC 0x2f12) up VRAM column
; NO_MORE_FROGS_COLUMN_VRAM (0xaa51), the second continuing where the
; first left the pointer, then raise HOLD_FLAG (0x8004) = 1 to halt the
; score-display countdown. Memory-only
blitEndStripAndSetHold:
085B: 21 51 AA        LD      HL,$AA51            
085E: 11 6E 2F        LD      DE,$2F6E            
0861: 06 04           LD      B,$04               
0863: EF              RST     $28                 
0864: 11 12 2F        LD      DE,$2F12            
0867: 06 05           LD      B,$05               
0869: EF              RST     $28                 
086A: 3E 01           LD      A,$01               
086C: 32 04 80        LD      ($8004),A           ; {hard.workRam+4}
086F: C9              RET                         

; Per-frame score-display driver: returns while FROG_STATE_DEMO_FLAG
; (0x83cd) or HOLD_FLAG (0x8004) is set. On first entry it latches
; COUNTDOWN_EXPIRY_FLAG (0x83ae) and queues a sound, lays out the field
; once (initDisplayFieldOnce), then either takes the bonus-strip arm
; (armScoreBonusStrip, when SCORE_DISPLAY_ARM_SELECT 0x83df is non-zero)
; or runs the step countdown that walks the BCD bonus byte ($83DE 0x83de)
; down, animates one bar tile, and takes the end-strip tail
; (blitEndStripAndSetHold) when SCORE_DISPLAY_COUNTER_HI (0x83dd) reaches
; 0. Memory-only
driveScoreDisplayCountdown:
0870: 3A CD 83        LD      A,($83CD)           ; {hard.workRam+3CD}
0873: B7              OR      A                   
0874: C0              RET     NZ                  
0875: 3A 04 80        LD      A,($8004)           ; {hard.workRam+4}
0878: B7              OR      A                   
0879: C0              RET     NZ                  
087A: 3A AE 83        LD      A,($83AE)           ; {hard.workRam+3AE}
087D: B7              OR      A                   
087E: 20 07           JR      NZ,$0887            ; {code.loc_0887}
0880: 3C              INC     A                   
0881: 32 AE 83        LD      ($83AE),A           ; {hard.workRam+3AE}
0884: 3E 06           LD      A,$06               
0886: DF              RST     $18                 

loc_0887:
0887: CD BA 0A        CALL    $0ABA               ; {code.initDisplayFieldOnce}
088A: 3A DF 83        LD      A,($83DF)           ; {hard.workRam+3DF}
088D: B7              OR      A                   
088E: 20 35           JR      NZ,$08C5            ; {code.armScoreBonusStrip}
0890: 21 DC 83        LD      HL,$83DC            
0893: 35              DEC     (HL)                
0894: C0              RET     NZ                  
0895: 36 20           LD      (HL),$20            
0897: 23              INC     HL                  
0898: 7E              LD      A,(HL)              
0899: B7              OR      A                   
089A: CA 5B 08        JP      Z,$085B             ; {code.blitEndStripAndSetHold}
089D: 3D              DEC     A                   
089E: 77              LD      (HL),A              
089F: 2C              INC     L                   
08A0: 7E              LD      A,(HL)              
08A1: 3D              DEC     A                   
08A2: 27              DAA                         
08A3: 77              LD      (HL),A              
08A4: 2D              DEC     L                   
08A5: FE 10           CP      $10                 
08A7: 20 07           JR      NZ,$08B0            ; {code.loc_08b0}
08A9: 3E 05           LD      A,$05               
08AB: DF              RST     $18                 
08AC: AF              XOR     A                   
08AD: 32 3F 80        LD      ($803F),A           ; {hard.workRam+3F}

loc_08b0:
08B0: 66              LD      H,(HL)              
08B1: 7C              LD      A,H                 
08B2: E6 03           AND     $03                 
08B4: 4F              LD      C,A                 
08B5: AC              XOR     H                   
08B6: 07              RLCA                        
08B7: 07              RLCA                        
08B8: 6F              LD      L,A                 
08B9: 26 00           LD      H,$00               
08BB: 29              ADD     HL,HL               
08BC: 11 DF A8        LD      DE,$A8DF            
08BF: 19              ADD     HL,DE               
08C0: 3E 10           LD      A,$10               
08C2: 91              SUB     C                   
08C3: 77              LD      (HL),A              
08C4: C9              RET                         

; Score-display bonus-strip arm (the SCORE_DISPLAY_ARM_SELECT 0x83df arm
; of driveScoreDisplayCountdown; also called directly from the home-goal
; reset path): one-shot guarded by $83E0 (0x83e0) — blit a 5-tile strip
; (LAYOUT_SETUP_STRIP_SRC 0x2f6e) up VRAM column NO_MORE_FROGS_COLUMN_VRAM
; (0xaa51), print the bonus byte $83DE (0x83de) as two BCD digits
; (writePackedBcdByte), then add it to the score
; (addScoreAndAwardExtraLife); an already-armed entry returns at once.
; Memory-only
armScoreBonusStrip:
08C5: 3A E0 83        LD      A,($83E0)           ; {hard.workRam+3E0}
08C8: B7              OR      A                   
08C9: C0              RET     NZ                  
08CA: 3C              INC     A                   
08CB: 32 E0 83        LD      ($83E0),A           ; {hard.workRam+3E0}
08CE: 21 51 AA        LD      HL,$AA51            
08D1: 11 6E 2F        LD      DE,$2F6E            
08D4: 06 05           LD      B,$05               
08D6: EF              RST     $28                 
08D7: 3A DE 83        LD      A,($83DE)           ; {hard.workRam+3DE}
08DA: 5F              LD      E,A                 
08DB: 16 00           LD      D,$00               
08DD: CD A0 0B        CALL    $0BA0               ; {code.writePackedBcdByte}

; Add the BCD delta in DE to the active player's score word (PLAYER1_SCORE
; 0x83ed / PLAYER2_SCORE 0x83eb), gated off while PLAY_FLAG (0x83fe) is 0,
; propagating the low-byte BCD carry into the high byte. On the first
; frame the score reaches EXTRA_LIFE_SCORE_TARGET (0x2e08 = 0x2000) with
; the player's award flag (PLAYER1_EXTRA_LIFE_AWARDED 0x83e7 /
; PLAYER2_EXTRA_LIFE_AWARDED 0x83e8) clear, it clears $83CF (0x83cf), sets
; the flag, bumps the active player's counter (TIME_REMAINING_P1 0x83e5 /
; TIME_REMAINING_P2 0x83e6), stamps bonus tile 0x4d walking up the HUD
; column from EXTRA_LIFE_HUD_SLOT_TOP (0xabde) one row per count, and
; queues the tile-update sound; the larger score is then kept in
; HIGH_SCORE (0x83ef). Since the bumped counter is the time-remaining
; byte, the award extends the time bar. Memory-only
addScoreAndAwardExtraLife:
08E0: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
08E3: B7              OR      A                   
08E4: C8              RET     Z                   
08E5: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
08E8: 3D              DEC     A                   
08E9: 28 05           JR      Z,$08F0             ; {code.loc_08f0}
08EB: 21 EB 83        LD      HL,$83EB            
08EE: 18 03           JR      $08F3               ; {code.loc_08f3}

loc_08f0:
08F0: 21 ED 83        LD      HL,$83ED            

loc_08f3:
08F3: 7B              LD      A,E                 
08F4: 86              ADD     A,(HL)              
08F5: 27              DAA                         
08F6: 77              LD      (HL),A              
08F7: 5F              LD      E,A                 
08F8: 23              INC     HL                  
08F9: 7A              LD      A,D                 
08FA: 8E              ADC     A,(HL)              
08FB: 27              DAA                         
08FC: 77              LD      (HL),A              
08FD: 57              LD      D,A                 
08FE: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
0901: 3D              DEC     A                   
0902: 20 09           JR      NZ,$090D            ; {code.loc_090d}
0904: 01 E7 83        LD      BC,$83E7            
0907: 0A              LD      A,(BC)              
0908: B7              OR      A                   
0909: 20 2B           JR      NZ,$0936            ; {code.loc_0936}
090B: 18 07           JR      $0914               ; {code.loc_0914}

loc_090d:
090D: 01 E8 83        LD      BC,$83E8            
0910: 0A              LD      A,(BC)              
0911: B7              OR      A                   
0912: 20 22           JR      NZ,$0936            ; {code.loc_0936}

loc_0914:
0914: 2A 08 2E        LD      HL,($2E08)          ; {hard.rom+2E08}
0917: ED 52           SBC     HL,DE               
0919: 28 02           JR      Z,$091D             ; {code.loc_091d}
091B: 30 19           JR      NC,$0936            ; {code.loc_0936}

loc_091d:
091D: 32 CF 83        LD      ($83CF),A           ; {hard.workRam+3CF}
0920: 3C              INC     A                   
0921: 02              LD      (BC),A              
0922: 0D              DEC     C                   
0923: 0D              DEC     C                   
0924: 0A              LD      A,(BC)              
0925: 3C              INC     A                   
0926: 02              LD      (BC),A              
0927: 21 DE AB        LD      HL,$ABDE            
092A: 01 E0 FF        LD      BC,$FFE0            

loc_092d:
092D: 09              ADD     HL,BC               
092E: 3D              DEC     A                   
092F: 20 FC           JR      NZ,$092D            ; {code.loc_092d}
0931: 36 4D           LD      (HL),$4D            
0933: 3E 07           LD      A,$07               
0935: DF              RST     $18                 

loc_0936:
0936: 2A EF 83        LD      HL,($83EF)          ; {hard.workRam+3EF}
0939: B7              OR      A                   
093A: ED 52           SBC     HL,DE               
093C: D0              RET     NC                  
093D: ED 53 EF 83     LD      ($83EF),DE          ; {hard.workRam+3EF}
0941: C9              RET                         

; Per-frame frog-scene render core: clears LIFE_RESTART_FLAG (0x83ce);
; with PLAY_FLAG (0x83fe) = 0 it resets the frog object (demo) or returns
; A=0 (attract). In play it ticks the active player's timer
; (TIME_REMAINING_P1 0x83e5 / TIME_REMAINING_P2 0x83e6) unless the demo
; gate FROG_STATE_DEMO_FLAG (0x83cd) is set — flagging expiry in $83CF
; (0x83cf) — renders the frog+object banner, lays the status row and home-
; marker column when not gated, sets GATED_COUNTDOWN_ENABLE_MIRROR
; (0x83b5) to the complement of GATED_COUNTDOWN_ENABLE_FLAG (0x826c), and
; stamps the active player's occupied home slots
; (HOME_BAY1_OCCUPANCY_PRIMARY 0x825e / HOME_BAY1_OCCUPANCY_ALT 0x8263
; bank); it then resets the frog object, or first loads lane params and
; runs the frog-animation dispatcher.
renderFrogSceneAndTickTimer:
0942: AF              XOR     A                   
0943: 32 CE 83        LD      ($83CE),A           ; {hard.workRam+3CE}
0946: 3A CD 83        LD      A,($83CD)           ; {hard.workRam+3CD}
0949: B7              OR      A                   
094A: 20 04           JR      NZ,$0950            ; {code.loc_0950}
094C: AF              XOR     A                   
094D: 32 CF 83        LD      ($83CF),A           ; {hard.workRam+3CF}

loc_0950:
0950: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
0953: B7              OR      A                   
0954: 28 74           JR      Z,$09CA             ; {code.loc_09ca}
0956: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
0959: 3D              DEC     A                   
095A: 20 05           JR      NZ,$0961            ; {code.loc_0961}
095C: 21 E5 83        LD      HL,$83E5            
095F: 18 03           JR      $0964               ; {code.loc_0964}

loc_0961:
0961: 21 E6 83        LD      HL,$83E6            

loc_0964:
0964: 3A CD 83        LD      A,($83CD)           ; {hard.workRam+3CD}
0967: B7              OR      A                   
0968: 20 08           JR      NZ,$0972            ; {code.loc_0972}
096A: 35              DEC     (HL)                
096B: 20 05           JR      NZ,$0972            ; {code.loc_0972}
096D: 3E 01           LD      A,$01               
096F: 32 CF 83        LD      ($83CF),A           ; {hard.workRam+3CF}

loc_0972:
0972: CD 52 19        CALL    $1952               ; {code.renderFrogAndArmObjects}
0975: 3A CD 83        LD      A,($83CD)           ; {hard.workRam+3CD}
0978: B7              OR      A                   
0979: 20 0A           JR      NZ,$0985            ; {code.loc_0985}
097B: 3C              INC     A                   
097C: 32 B5 83        LD      ($83B5),A           ; {hard.workRam+3B5}
097F: 21 50 A8        LD      HL,$A850            
0982: CD E2 19        CALL    $19E2               ; {code.blitFourTileGroupColumn}

loc_0985:
0985: 3A 6C 82        LD      A,($826C)           ; {hard.workRam+26C}
0988: EE 01           XOR     $01                 
098A: 32 B5 83        LD      ($83B5),A           ; {hard.workRam+3B5}
098D: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
0990: 3D              DEC     A                   
0991: C2 D2 09        JP      NZ,$09D2            ; {code.loc_09d2}
0994: 21 5E 82        LD      HL,$825E            
0997: CD DB 09        CALL    $09DB               ; {code.renderFilledHomeSlots}

loc_099a:
099A: 3A 5A 82        LD      A,($825A)           ; {hard.workRam+25A}
099D: A7              AND     A                   
099E: 28 0A           JR      Z,$09AA             ; {code.resetFrogObject}
09A0: CD 3D 22        CALL    $223D               ; {code.loadActivePlayerLaneParams}
09A3: CD AF 0F        CALL    $0FAF               ; {code.dispatchFrogAnimationArm}

loc_09a6:
09A6: AF              XOR     A                   
09A7: 32 5A 82        LD      ($825A),A           ; {hard.workRam+25A}

; Reset the frog object: write the four object bytes (128,30,3,224) into
; the FROG_X (0x8044) block, clear FROG_STATE_DEMO_FLAG (0x83cd), $842C
; (0x842c), $842D (0x842d) and FROG_FURTHEST_ROW (0x8269), and set
; FROG_READY_FLAG (0x83c3) = 1.
resetFrogObject:
09AA: 21 44 80        LD      HL,$8044            
09AD: 36 80           LD      (HL),$80            
09AF: 2C              INC     L                   
09B0: 36 1E           LD      (HL),$1E            
09B2: 2C              INC     L                   
09B3: 36 03           LD      (HL),$03            
09B5: 2C              INC     L                   
09B6: 36 E0           LD      (HL),$E0            
09B8: AF              XOR     A                   
09B9: 32 CD 83        LD      ($83CD),A           ; {hard.workRam+3CD}
09BC: 32 2D 84        LD      ($842D),A           ; {hard.workRam+42D}
09BF: 32 2C 84        LD      ($842C),A           ; {hard.workRam+42C}
09C2: 32 69 82        LD      ($8269),A           ; {hard.workRam+269}
09C5: 3C              INC     A                   
09C6: 32 C3 83        LD      ($83C3),A           ; {hard.workRam+3C3}
09C9: C9              RET                         

loc_09ca:
09CA: 3A CD 83        LD      A,($83CD)           ; {hard.workRam+3CD}
09CD: B7              OR      A                   
09CE: C8              RET     Z                   
09CF: C3 AA 09        JP      $09AA               ; {code.resetFrogObject}

loc_09d2:
09D2: 21 63 82        LD      HL,$8263            
09D5: CD DB 09        CALL    $09DB               ; {code.renderFilledHomeSlots}
09D8: C3 9A 09        JP      $099A               ; {code.loc_099a}

; Home-marker render: for each of the five entries in the occupancy list
; at HL that is non-zero, stamp the 2x2 frog-home tile block (108,109 over
; 110,111) at that slot's fixed VRAM base (HOME_SLOT1_VRAM 0xab64 through
; HOME_SLOT5_VRAM 0xa864). HL live-in; memory-only
renderFilledHomeSlots:
09DB: AF              XOR     A                   
09DC: B6              OR      (HL)                
09DD: 11 64 AB        LD      DE,$AB64            
09E0: C4 05 0A        CALL    NZ,$0A05            ; {code.loc_0a05}
09E3: 23              INC     HL                  
09E4: AF              XOR     A                   
09E5: B6              OR      (HL)                
09E6: 11 A4 AA        LD      DE,$AAA4            
09E9: C4 05 0A        CALL    NZ,$0A05            ; {code.loc_0a05}
09EC: 23              INC     HL                  
09ED: AF              XOR     A                   
09EE: B6              OR      (HL)                
09EF: 11 E4 A9        LD      DE,$A9E4            
09F2: C4 05 0A        CALL    NZ,$0A05            ; {code.loc_0a05}
09F5: 23              INC     HL                  
09F6: AF              XOR     A                   
09F7: B6              OR      (HL)                
09F8: 11 24 A9        LD      DE,$A924            
09FB: C4 05 0A        CALL    NZ,$0A05            ; {code.loc_0a05}
09FE: 23              INC     HL                  
09FF: AF              XOR     A                   
0A00: B6              OR      (HL)                
0A01: 11 64 A8        LD      DE,$A864            
0A04: C8              RET     Z                   

loc_0a05:
0A05: EB              EX      DE,HL               
0A06: 36 6C           LD      (HL),$6C            
0A08: 23              INC     HL                  
0A09: 36 6D           LD      (HL),$6D            
0A0B: 01 1F 00        LD      BC,$001F            
0A0E: 09              ADD     HL,BC               
0A0F: 36 6E           LD      (HL),$6E            
0A11: 23              INC     HL                  
0A12: 36 6F           LD      (HL),$6F            
0A14: EB              EX      DE,HL               
0A15: C9              RET                         

; Render the column-30 time indicator: return without drawing when
; SHARED_TIME_BYTE (0x83e4) holds 255; otherwise draw that many copies of
; tile 0x4d up the column at TIME_BAR_COLUMN_VRAM (0xabbe) stepping -0x20
; and cap with tile 16. The count comes from the active player's
; TIME_REMAINING_P1 (0x83e5) / TIME_REMAINING_P2 (0x83e6) in play
; (PLAY_FLAG 0x83fe non-zero) or from SHARED_TIME_BYTE (0x83e4) otherwise.
; This is the col-30 indicator, separate from the main draining green time
; bar (unlifted code). Memory-only
renderTimeBar:
0A16: 3A E4 83        LD      A,($83E4)           ; {hard.workRam+3E4}
0A19: 3C              INC     A                   
0A1A: C8              RET     Z                   
0A1B: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
0A1E: B7              OR      A                   
0A1F: 20 05           JR      NZ,$0A26            ; {code.loc_0a26}
0A21: 21 E4 83        LD      HL,$83E4            
0A24: 18 0E           JR      $0A34               ; {code.loc_0a34}

loc_0a26:
0A26: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
0A29: 3D              DEC     A                   
0A2A: 20 05           JR      NZ,$0A31            ; {code.loc_0a31}
0A2C: 21 E5 83        LD      HL,$83E5            
0A2F: 18 03           JR      $0A34               ; {code.loc_0a34}

loc_0a31:
0A31: 21 E6 83        LD      HL,$83E6            

loc_0a34:
0A34: 46              LD      B,(HL)              
0A35: 78              LD      A,B                 
0A36: B7              OR      A                   
0A37: 3E 4D           LD      A,$4D               
0A39: 11 E0 FF        LD      DE,$FFE0            
0A3C: 21 BE AB        LD      HL,$ABBE            
0A3F: 28 04           JR      Z,$0A45             ; {code.loc_0a45}

loc_0a41:
0A41: 77              LD      (HL),A              
0A42: 19              ADD     HL,DE               
0A43: 10 FC           DJNZ    $0A41               ; {code.loc_0a41}

loc_0a45:
0A45: 36 10           LD      (HL),$10            
0A47: C9              RET                         

; Render the lives/level row: draw min(LIVES_COUNT (0x83b7), 15) copies of
; marker tile 0x4c down the column at LIVES_ROW_COLUMN_VRAM (0xa87e)
; stepping +0x20. Memory-only
renderLivesRow:
0A48: 3A B7 83        LD      A,($83B7)           ; {hard.workRam+3B7}
0A4B: 21 7E A8        LD      HL,$A87E            
0A4E: 11 20 00        LD      DE,$0020            
0A51: FE 0F           CP      $0F                 
0A53: 38 02           JR      C,$0A57             ; {code.loc_0a57}
0A55: 3E 0F           LD      A,$0F               

loc_0a57:
0A57: 47              LD      B,A                 
0A58: 0E 4C           LD      C,$4C               

loc_0a5a:
0A5A: 71              LD      (HL),C              
0A5B: 19              ADD     HL,DE               
0A5C: 10 FC           DJNZ    $0A5A               ; {code.loc_0a5a}
0A5E: C9              RET                         

; Award an extra life (reached on board completion via
; fillAllHomeSlotsAndAwardLife): clear $83CC (0x83cc), bump the active
; player's life count (PLAYER1_LIVES 0x83b8 / PLAYER2_LIVES 0x83b9),
; mirror it to LIVES_COUNT (0x83b7), and unless the count has reached 16
; stamp marker tile 0x4c into the lives row at LIVES_ROW_MARKER_BASE
; (0xa85e) + count*0x20. The 16 caps the drawn MARKER, not the life count.
; Memory-only
awardExtraLife:
0A5F: AF              XOR     A                   
0A60: 32 CC 83        LD      ($83CC),A           ; {hard.workRam+3CC}
0A63: 21 B8 83        LD      HL,$83B8            
0A66: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
0A69: 3D              DEC     A                   
0A6A: 28 01           JR      Z,$0A6D             ; {code.loc_0a6d}
0A6C: 2C              INC     L                   

loc_0a6d:
0A6D: 34              INC     (HL)                
0A6E: 7E              LD      A,(HL)              
0A6F: 32 B7 83        LD      ($83B7),A           ; {hard.workRam+3B7}
0A72: FE 10           CP      $10                 
0A74: D0              RET     NC                  
0A75: 26 00           LD      H,$00               
0A77: 11 5E A8        LD      DE,$A85E            
0A7A: 87              ADD     A,A                 
0A7B: 87              ADD     A,A                 
0A7C: 87              ADD     A,A                 
0A7D: 87              ADD     A,A                 
0A7E: 6F              LD      L,A                 
0A7F: 29              ADD     HL,HL               
0A80: 19              ADD     HL,DE               
0A81: 36 4C           LD      (HL),$4C            
0A83: C9              RET                         

; Insert a 16-bit key (D high, E low) into the 5-entry descending high-
; score table topped at HIGH_SCORE_TABLE_TOP_HI (0x83f2) (RAM
; 0x83f1-0x83fa, the attract score-ranking table), shifting the tail down
; to make room.
insertHighScoreEntry:
0A84: 06 05           LD      B,$05               
0A86: 21 F2 83        LD      HL,$83F2            

loc_0a89:
0A89: 7A              LD      A,D                 
0A8A: BE              CP      (HL)                
0A8B: 38 27           JR      C,$0AB4             ; {code.loc_0ab4}
0A8D: 28 19           JR      Z,$0AA8             ; {code.loc_0aa8}

loc_0a8f:
0A8F: 78              LD      A,B                 
0A90: 3D              DEC     A                   
0A91: 28 0F           JR      Z,$0AA2             ; {code.loc_0aa2}
0A93: 87              ADD     A,A                 
0A94: 4F              LD      C,A                 
0A95: 06 00           LD      B,$00               
0A97: D5              PUSH    DE                  
0A98: 11 FA 83        LD      DE,$83FA            
0A9B: 21 F8 83        LD      HL,$83F8            
0A9E: ED B8           LDDR                        
0AA0: EB              EX      DE,HL               
0AA1: D1              POP     DE                  

loc_0aa2:
0AA2: 72              LD      (HL),D              
0AA3: 2D              DEC     L                   
0AA4: 73              LD      (HL),E              

loc_0aa5:
0AA5: 87              ADD     A,A                 
0AA6: 3C              INC     A                   
0AA7: C9              RET                         

loc_0aa8:
0AA8: 2D              DEC     L                   
0AA9: 7E              LD      A,(HL)              
0AAA: 2C              INC     L                   
0AAB: BB              CP      E                   
0AAC: 38 E1           JR      C,$0A8F             ; {code.loc_0a8f}
0AAE: 20 04           JR      NZ,$0AB4            ; {code.loc_0ab4}
0AB0: 78              LD      A,B                 
0AB1: 3D              DEC     A                   
0AB2: 28 F1           JR      Z,$0AA5             ; {code.loc_0aa5}

loc_0ab4:
0AB4: 2C              INC     L                   
0AB5: 2C              INC     L                   
0AB6: 10 D1           DJNZ    $0A89               ; {code.loc_0a89}
0AB8: AF              XOR     A                   
0AB9: C9              RET                         

; One-shot display-field layout, guarded by $842D (0x842d): set the guard,
; write OBJRAM_COL3F_ATTR_SHADOW (0x803f) = 3, clear $83E0 (0x83e0), blit
; a 4-tile strip (LAYOUT_SETUP_STRIP_SRC 0x2f6e) up column
; LAYOUT_SETUP_STRIP_VRAM (0xa8bf), fill 15 rows of tile 12 down column
; LAYOUT_SETUP_COLUMN_VRAM (0xa8df) stepping +0x20, then seed $83DC
; (0x83dc) = 0x3c20 (16-bit) and $83DE (0x83de) = 0x60. A set guard
; returns immediately. Memory-only
initDisplayFieldOnce:
0ABA: 3A 2D 84        LD      A,($842D)           ; {hard.workRam+42D}
0ABD: B7              OR      A                   
0ABE: C0              RET     NZ                  
0ABF: 3C              INC     A                   
0AC0: 32 2D 84        LD      ($842D),A           ; {hard.workRam+42D}
0AC3: 3E 03           LD      A,$03               
0AC5: 32 3F 80        LD      ($803F),A           ; {hard.workRam+3F}
0AC8: AF              XOR     A                   
0AC9: 32 E0 83        LD      ($83E0),A           ; {hard.workRam+3E0}
0ACC: 21 BF A8        LD      HL,$A8BF            
0ACF: 11 6E 2F        LD      DE,$2F6E            
0AD2: 06 04           LD      B,$04               
0AD4: EF              RST     $28                 
0AD5: 21 DF A8        LD      HL,$A8DF            
0AD8: 11 20 00        LD      DE,$0020            
0ADB: 01 0C 0F        LD      BC,$0F0C            

loc_0ade:
0ADE: 71              LD      (HL),C              
0ADF: 19              ADD     HL,DE               
0AE0: 10 FC           DJNZ    $0ADE               ; {code.loc_0ade}
0AE2: 21 20 3C        LD      HL,$3C20            
0AE5: 22 DC 83        LD      ($83DC),HL          ; {hard.workRam+3DC}
0AE8: 3E 60           LD      A,$60               
0AEA: 32 DE 83        LD      ($83DE),A           ; {hard.workRam+3DE}
0AED: C9              RET                         

; Spawn PRNG step: decrement the ring cursor at SPAWN_RNG_RING_BASE
; (0x8400) (wrapping to 31 at 0), then XOR-fold ring cell (base+cursor)
; into ring cell (base+j) where j = cursor+13 folded back under the ring
; size, returning the XOR result. Object-spawn arms consume A to place
; spawns — a PRNG, not a checksum.
nextSpawnRandomByte:
0AEE: E5              PUSH    HL                  
0AEF: D5              PUSH    DE                  
0AF0: 21 00 84        LD      HL,$8400            
0AF3: 35              DEC     (HL)                
0AF4: 20 02           JR      NZ,$0AF8            ; {code.loc_0af8}
0AF6: 36 1F           LD      (HL),$1F            

loc_0af8:
0AF8: 54              LD      D,H                 
0AF9: 5E              LD      E,(HL)              
0AFA: 7B              LD      A,E                 
0AFB: C6 0D           ADD     A,$0D               
0AFD: FE 20           CP      $20                 
0AFF: 38 02           JR      C,$0B03             ; {code.loc_0b03}
0B01: D6 1F           SUB     $1F                 

loc_0b03:
0B03: 6F              LD      L,A                 
0B04: 1A              LD      A,(DE)              
0B05: AE              XOR     (HL)                
0B06: 77              LD      (HL),A              
0B07: D1              POP     DE                  
0B08: E1              POP     HL                  
0B09: C9              RET                         

; New-game reset: zero the player score words (PLAYER1_SCORE 0x83ed,
; PLAYER2_SCORE 0x83eb) and both extra-life-awarded flags
; (PLAYER1_EXTRA_LIFE_AWARDED 0x83e7 / PLAYER2_EXTRA_LIFE_AWARDED 0x83e8),
; then copy the start-time byte SHARED_TIME_BYTE (0x83e4) into both time-
; remaining bytes (TIME_REMAINING_P1 0x83e5 / TIME_REMAINING_P2 0x83e6) so
; both time bars start full. Does not touch HIGH_SCORE (0x83ef). Memory-
; only
initNewGameScoreAndTimers:
0B0A: 21 00 00        LD      HL,$0000            
0B0D: 22 ED 83        LD      ($83ED),HL          ; {hard.workRam+3ED}
0B10: 22 EB 83        LD      ($83EB),HL          ; {hard.workRam+3EB}
0B13: 22 E7 83        LD      ($83E7),HL          ; {hard.workRam+3E7}
0B16: 3A E4 83        LD      A,($83E4)           ; {hard.workRam+3E4}
0B19: 67              LD      H,A                 
0B1A: 6F              LD      L,A                 
0B1B: 22 E5 83        LD      ($83E5),HL          ; {hard.workRam+3E5}
0B1E: C9              RET                         

; Redraw the three-column score header each frame: the HI-SCORE column
; (label HI_SCORE_LABEL_STRIP 0x2ee2 -> HISCORE_LABEL_DST 0xaa60, then
; HIGH_SCORE 0x83ef -> HISCORE_VALUE_DST 0xaa41), the 1-UP column (digit
; '1' at P1_DIGIT_DST 0xab20, shared '-UP' strip UP_LABEL_STRIP 0x2edf,
; then PLAYER1_SCORE 0x83ed -> P1_SCORE_DST 0xab41), and — only when
; NUM_PLAYERS (0x8370) is not 1 — the 2-UP column (digit '2' at the score-
; display page SCORE_DISPLAY_VRAM_PAGE 0xa900, '-UP', then PLAYER2_SCORE
; 0x83eb -> P2_SCORE_DST 0xa921). Memory-only
renderScoreHeader:
0B1F: 11 E2 2E        LD      DE,$2EE2            
0B22: 21 60 AA        LD      HL,$AA60            
0B25: 06 08           LD      B,$08               
0B27: EF              RST     $28                 
0B28: 21 41 AA        LD      HL,$AA41            
0B2B: ED 5B EF 83     LD      DE,($83EF)          ; {hard.workRam+3EF}
0B2F: CD 95 0B        CALL    $0B95               ; {code.writeScoreField}
0B32: 3E 01           LD      A,$01               
0B34: 21 20 AB        LD      HL,$AB20            
0B37: CD A9 0B        CALL    $0BA9               ; {code.writeScoreDigitStepUp}
0B3A: 11 DF 2E        LD      DE,$2EDF            
0B3D: 06 03           LD      B,$03               
0B3F: EF              RST     $28                 
0B40: 21 41 AB        LD      HL,$AB41            
0B43: ED 5B ED 83     LD      DE,($83ED)          ; {hard.workRam+3ED}
0B47: CD 95 0B        CALL    $0B95               ; {code.writeScoreField}
0B4A: 3A 70 83        LD      A,($8370)           ; {hard.workRam+370}
0B4D: 3D              DEC     A                   
0B4E: C8              RET     Z                   
0B4F: 3E 02           LD      A,$02               
0B51: 21 00 A9        LD      HL,$A900            
0B54: CD A9 0B        CALL    $0BA9               ; {code.writeScoreDigitStepUp}
0B57: 11 DF 2E        LD      DE,$2EDF            
0B5A: 06 03           LD      B,$03               
0B5C: EF              RST     $28                 
0B5D: 21 21 A9        LD      HL,$A921            
0B60: ED 5B EB 83     LD      DE,($83EB)          ; {hard.workRam+3EB}
0B64: C3 95 0B        JP      $0B95               ; {code.writeScoreField}

; Redraw the CREDIT line: on the first call (latched by
; CREDIT_COLUMN_CLEAR_LATCH 0x83b4) fill the credit column (0x20 cells
; from CREDIT_COLUMN_TOP_VRAM 0xa81f, +0x20/row) with clear tile 0x10;
; every call then blits the 'CREDIT' label (CREDIT_LABEL_STRIP 0x2f68 ->
; CREDIT_LABEL_DST 0xa97f), writes OBJRAM_COL3F_ATTR_SHADOW (0x803f) = 1,
; and prints the packed-BCD credit count CREDIT_BCD (0x83e1) at
; CREDIT_COUNT_DST (0xa89f). Memory-only
renderCreditLine:
0B67: 3A B4 83        LD      A,($83B4)           ; {hard.workRam+3B4}
0B6A: B7              OR      A                   
0B6B: 20 11           JR      NZ,$0B7E            ; {code.loc_0b7e}
0B6D: 3C              INC     A                   
0B6E: 32 B4 83        LD      ($83B4),A           ; {hard.workRam+3B4}
0B71: 21 1F A8        LD      HL,$A81F            
0B74: 11 20 00        LD      DE,$0020            
0B77: 01 10 20        LD      BC,$2010            

loc_0b7a:
0B7A: 71              LD      (HL),C              
0B7B: 19              ADD     HL,DE               
0B7C: 10 FC           DJNZ    $0B7A               ; {code.loc_0b7a}

loc_0b7e:
0B7E: 11 68 2F        LD      DE,$2F68            
0B81: 21 7F A9        LD      HL,$A97F            
0B84: 06 06           LD      B,$06               
0B86: EF              RST     $28                 
0B87: 3E 01           LD      A,$01               
0B89: 32 3F 80        LD      ($803F),A           ; {hard.workRam+3F}
0B8C: 21 9F A8        LD      HL,$A89F            
0B8F: 3A E1 83        LD      A,($83E1)           ; {hard.workRam+3E1}
0B92: C3 A0 0B        JP      $0BA0               ; {code.writePackedBcdByte}

; Score/point-value field printer: print the caller's 16-bit packed-BCD
; word (DE) as four tilemap digit cells at the caller's pointer (HL) via
; writePackedBcdWord, then append one fixed trailing-zero digit via
; writeScoreDigitStepUp — a 5-cell readout for Frogger's score-
; over-10-plus-literal-ones-zero convention. Each cell steps the pointer
; up one 32-cell tilemap row. Memory-only (VRAM)
writeScoreField:
0B95: CD 9B 0B        CALL    $0B9B               ; {code.writePackedBcdWord}
0B98: AF              XOR     A                   
0B99: 18 0E           JR      $0BA9               ; {code.writeScoreDigitStepUp}

; Print a 16-bit packed-BCD value (DE) as four tilemap digit cells — the
; high byte's two nibbles then the low byte's two — via writePackedBcdByte
; twice, each digit stepping the pointer up one 32-cell tilemap row.
writePackedBcdWord:
0B9B: 7A              LD      A,D                 
0B9C: CD A0 0B        CALL    $0BA0               ; {code.writePackedBcdByte}
0B9F: 7B              LD      A,E                 

; Prints one packed-BCD byte (A) as two score-tilemap digits -- high
; nibble then low -- by calling writeScoreDigitStepUp twice, returning HL
; advanced up two 32-cell rows for the caller's next byte. Memory + HL
writePackedBcdByte:
0BA0: 4F              LD      C,A                 
0BA1: 0F              RRCA                        
0BA2: 0F              RRCA                        
0BA3: 0F              RRCA                        
0BA4: 0F              RRCA                        
0BA5: CD A9 0B        CALL    $0BA9               ; {code.writeScoreDigitStepUp}
0BA8: 79              LD      A,C                 

; Writes one BCD digit (low nibble of the value) into the score tilemap at
; HL, then steps HL up one 32-cell tilemap row (16-bit borrow).
writeScoreDigitStepUp:
0BA9: E6 0F           AND     $0F                 
0BAB: 77              LD      (HL),A              
0BAC: 7D              LD      A,L                 
0BAD: D6 20           SUB     $20                 
0BAF: 6F              LD      L,A                 
0BB0: D0              RET     NC                  
0BB1: 25              DEC     H                   
0BB2: C9              RET                         

; Draws the mode-3 attract SCORE RANKING screen in one call (FROGGER logo,
; header, five ranked high scores, KONAMI 1981). Steps the pacing gate
; POINT_TABLE_DRAW_STATE (0x83d8), zeros ATTRACT_DEMO_PHASE_COUNTER
; (0x83d7) and START_LATCH (0x83b3), fills the 22x32 background
; (fillTilemapBlock22x32), stamps the rank markers
; (placeScoreRankMarkers), then for rank 1..5 writes the rank digit and
; that rank's packed-BCD score read from HIGH_SCORE_TABLE_BASE (0x83f1)
; via writeScoreField, each flanked by fixed tile strips. Falls through
; into the final-strip tail blitMode3FinalStrip; memory-only
renderMode3ScoreRankingScreen:
0BB3: 21 D8 83        LD      HL,$83D8            
0BB6: 35              DEC     (HL)                
0BB7: 2D              DEC     L                   
0BB8: AF              XOR     A                   
0BB9: 77              LD      (HL),A              
0BBA: 32 B3 83        LD      ($83B3),A           ; {hard.workRam+3B3}
0BBD: CD 81 07        CALL    $0781               ; {code.fillTilemapBlock22x32}
0BC0: 3E 03           LD      A,$03               
0BC2: 32 19 80        LD      ($8019),A           ; {hard.workRam+19}
0BC5: 21 1F 80        LD      HL,$801F            
0BC8: 06 05           LD      B,$05               
0BCA: AF              XOR     A                   

loc_0bcb:
0BCB: 77              LD      (HL),A              
0BCC: 2C              INC     L                   
0BCD: 2C              INC     L                   
0BCE: 2C              INC     L                   
0BCF: 2C              INC     L                   
0BD0: 10 F9           DJNZ    $0BCB               ; {code.loc_0bcb}
0BD2: CD 3D 0C        CALL    $0C3D               ; {code.placeScoreRankMarkers}
0BD5: 21 AC AA        LD      HL,$AAAC            
0BD8: 11 E5 2E        LD      DE,$2EE5            
0BDB: 06 0D           LD      B,$0D               
0BDD: EF              RST     $28                 
0BDE: 3E 01           LD      A,$01               

loc_0be0:
0BE0: 26 AA           LD      H,$AA               
0BE2: ED 47           LD      I,A                 
0BE4: 87              ADD     A,A                 
0BE5: C6 CD           ADD     A,$CD               
0BE7: 6F              LD      L,A                 
0BE8: ED 57           LD      A,I                 
0BEA: CD A9 0B        CALL    $0BA9               ; {code.writeScoreDigitStepUp}
0BED: ED 57           LD      A,I                 
0BEF: 08              EX      AF,AF'              
0BF0: 06 03           LD      B,$03               
0BF2: EF              RST     $28                 
0BF3: D9              EXX                         
0BF4: 21 EF 83        LD      HL,$83EF            
0BF7: 08              EX      AF,AF'              
0BF8: 47              LD      B,A                 

loc_0bf9:
0BF9: 2C              INC     L                   
0BFA: 2C              INC     L                   
0BFB: 10 FC           DJNZ    $0BF9               ; {code.loc_0bf9}
0BFD: 5E              LD      E,(HL)              
0BFE: 2C              INC     L                   
0BFF: 56              LD      D,(HL)              
0C00: 26 A9           LD      H,$A9               
0C02: 87              ADD     A,A                 
0C03: C6 ED           ADD     A,$ED               
0C05: 6F              LD      L,A                 
0C06: CD 95 0B        CALL    $0B95               ; {code.writeScoreField}
0C09: 11 BA 2F        LD      DE,$2FBA            
0C0C: 06 04           LD      B,$04               
0C0E: EF              RST     $28                 
0C0F: ED 57           LD      A,I                 
0C11: D9              EXX                         
0C12: 3C              INC     A                   
0C13: FE 06           CP      $06                 
0C15: 20 C9           JR      NZ,$0BE0            ; {code.loc_0be0}

; Mode-3 SCORE RANKING final-strip tail: zeros the strip state cell
; MODE3_STRIP_STATE (0x8039), then blits the 15-tile final strip from
; MODE3_FINAL_STRIP_SRC (0x2f4d) up VRAM column MODE3_FINAL_STRIP_VRAM
; (0xaafc) via copyRunUpTileColumn. Reached by fall-through from
; renderMode3ScoreRankingScreen and directly from dispatchGameModeFrame
; once mode 3 is already set up. Memory-only
blitMode3FinalStrip:
0C17: 11 4D 2F        LD      DE,$2F4D            
0C1A: 21 FC AA        LD      HL,$AAFC            
0C1D: 06 0F           LD      B,$0F               
0C1F: AF              XOR     A                   
0C20: 32 39 80        LD      ($8039),A           ; {hard.workRam+39}
0C23: EF              RST     $28                 
0C24: C9              RET                         

; ---- $0C25-$0C3C: data ----
0C25: 7A CD 2A 0C 7B 4F E6 0F CD 35 0C 79 0F 0F 0F 0F
0C35: 77 7D D6 20 6F D0 25 C9

; For each of the two bytes of the packed rank field INTRO_DIGIT_FIELD
; (0x83fb) -- low then high -- that is nonzero, writes the constant marker
; tile 0x04 into work-RAM page 0x80 at offset 48-value via $0C4A; a zero
; byte writes nothing (the value is encoded as a position, not a rendered
; numeral). Consumed on the mode-3 ranking display, whose rank codes
; packScoreRankPair produces. Memory-only
placeScoreRankMarkers:
0C3D: 26 80           LD      H,$80               
0C3F: ED 4B FB 83     LD      BC,($83FB)          ; {hard.workRam+3FB}
0C43: 11 04 30        LD      DE,$3004            
0C46: CD 4A 0C        CALL    $0C4A               ; {code.loc_0c4a}
0C49: 48              LD      C,B                 

loc_0c4a:
0C4A: 7A              LD      A,D                 
0C4B: 91              SUB     C                   
0C4C: BA              CP      D                   
0C4D: C8              RET     Z                   
0C4E: 6F              LD      L,A                 
0C4F: 73              LD      (HL),E              
0C50: C9              RET                         

loc_0c51:
0C51: 21 76 AB        LD      HL,$AB76            
0C54: 11 9E 2F        LD      DE,$2F9E            
0C57: 06 0A           LD      B,$0A               
0C59: EF              RST     $28                 
0C5A: 21 77 AB        LD      HL,$AB77            
0C5D: 3E 10           LD      A,$10               
0C5F: CD A0 0B        CALL    $0BA0               ; {code.writePackedBcdByte}
0C62: 11 BA 2F        LD      DE,$2FBA            
0C65: 06 04           LD      B,$04               
0C67: EF              RST     $28                 
0C68: 06 13           LD      B,$13               
0C6A: EF              RST     $28                 
0C6B: 18 4D           JR      $0CBA               ; {code.loc_0cba}

; Draws one phase per call of the mode-4 attract POINT-TABLE screen
; (FROGGER '-POINT TABLE-' page: 10 PTS per step, 50 per frog home, 1000
; for five frogs). Steps the shared sub-phase counter
; ATTRACT_DEMO_PHASE_COUNTER (0x83d7, reload 5 then count down) so
; successive calls cycle phases 4,3,2,1,0: phase 0 parks the draw-state
; gate POINT_TABLE_DRAW_STATE (0x83d8) idle (0xC0); phases 1-4 blit their
; tile strips plus a packed-BCD point value (0x10/0x1000/0x50/0x10) and
; park it drawn (0x80); phase 4 also seeds four sprite records (code=3,
; attr/Y=6) into the 0x801b-0x802f object table. Memory-only
renderMode4PointTablePhase:
0C6D: 21 D8 83        LD      HL,$83D8            
0C70: 2D              DEC     L                   
0C71: 7E              LD      A,(HL)              
0C72: B7              OR      A                   
0C73: 20 02           JR      NZ,$0C77            ; {code.loc_0c77}
0C75: 36 05           LD      (HL),$05            

loc_0c77:
0C77: 35              DEC     (HL)                
0C78: 7E              LD      A,(HL)              
0C79: 87              ADD     A,A                 
0C7A: 21 82 0C        LD      HL,$0C82            
0C7D: 5F              LD      E,A                 
0C7E: 16 00           LD      D,$00               
0C80: 19              ADD     HL,DE               
0C81: E9              JP      (HL)                

; ---- $0C82-$0C89: data ----
0C82: 18 3C 18 CB 18 63 18 3C

loc_0c8a:
0C8A: 3E 06           LD      A,$06               
0C8C: 32 1D 80        LD      ($801D),A           ; {hard.workRam+1D}
0C8F: 32 23 80        LD      ($8023),A           ; {hard.workRam+23}
0C92: 32 29 80        LD      ($8029),A           ; {hard.workRam+29}
0C95: 32 2F 80        LD      ($802F),A           ; {hard.workRam+2F}
0C98: 3E 03           LD      A,$03               
0C9A: 32 1B 80        LD      ($801B),A           ; {hard.workRam+1B}
0C9D: 32 21 80        LD      ($8021),A           ; {hard.workRam+21}
0CA0: 32 27 80        LD      ($8027),A           ; {hard.workRam+27}
0CA3: 32 2D 80        LD      ($802D),A           ; {hard.workRam+2D}
0CA6: 3E 10           LD      A,$10               
0CA8: 21 6D AB        LD      HL,$AB6D            
0CAB: CD A0 0B        CALL    $0BA0               ; {code.writePackedBcdByte}
0CAE: 11 BA 2F        LD      DE,$2FBA            
0CB1: 06 04           LD      B,$04               
0CB3: EF              RST     $28                 
0CB4: 11 D1 2E        LD      DE,$2ED1            
0CB7: 06 0E           LD      B,$0E               
0CB9: EF              RST     $28                 

loc_0cba:
0CBA: 21 D8 83        LD      HL,$83D8            
0CBD: 36 80           LD      (HL),$80            
0CBF: C9              RET                         

loc_0cc0:
0CC0: 21 D8 83        LD      HL,$83D8            
0CC3: 36 C0           LD      (HL),$C0            
0CC5: C9              RET                         

loc_0cc6:
0CC6: 21 70 AB        LD      HL,$AB70            
0CC9: 3E 50           LD      A,$50               
0CCB: CD A0 0B        CALL    $0BA0               ; {code.writePackedBcdByte}
0CCE: 11 BA 2F        LD      DE,$2FBA            
0CD1: 06 04           LD      B,$04               
0CD3: EF              RST     $28                 
0CD4: 11 43 2F        LD      DE,$2F43            
0CD7: 06 0A           LD      B,$0A               
0CD9: EF              RST     $28                 
0CDA: 11 AE 2F        LD      DE,$2FAE            
0CDD: 06 05           LD      B,$05               
0CDF: EF              RST     $28                 
0CE0: 21 71 AB        LD      HL,$AB71            
0CE3: 11 17 2F        LD      DE,$2F17            
0CE6: 06 13           LD      B,$13               
0CE8: EF              RST     $28                 
0CE9: 18 CF           JR      $0CBA               ; {code.loc_0cba}

loc_0ceb:
0CEB: 21 73 AB        LD      HL,$AB73            
0CEE: 11 00 10        LD      DE,$1000            
0CF1: CD 9B 0B        CALL    $0B9B               ; {code.writePackedBcdWord}
0CF4: 11 BA 2F        LD      DE,$2FBA            
0CF7: 06 04           LD      B,$04               
0CF9: EF              RST     $28                 
0CFA: 11 39 2F        LD      DE,$2F39            
0CFD: 06 0A           LD      B,$0A               
0CFF: EF              RST     $28                 
0D00: 11 AE 2F        LD      DE,$2FAE            
0D03: 06 06           LD      B,$06               
0D05: EF              RST     $28                 
0D06: 21 74 AB        LD      HL,$AB74            
0D09: 11 2A 2F        LD      DE,$2F2A            
0D0C: 06 0F           LD      B,$0F               
0D0E: EF              RST     $28                 
0D0F: 18 A9           JR      $0CBA               ; {code.loc_0cba}

; Per-frame intro/attract mode state machine: returns while the frame-
; pacing gate POINT_TABLE_DRAW_STATE (0x83d8) is nonzero, else dispatches
; on GAME_MODE (0x83d6) -- mode 3 draws the score-ranking screen, a
; nonzero CREDIT_BCD (0x83e1) enters the in-play board init, mode 4 the
; point-table phase, mode 2 the intro screen. Mode 5 falls into the reset
; arm (reseed the pacing gate, clear the sub-phase counter and
; OBJECT_ANIM_STATE_8015, blit a strip, tail into blitMode3FinalStrip);
; any other mode returns. Memory-only
dispatchGameModeFrame:
0D11: 3A D8 83        LD      A,($83D8)           ; {hard.workRam+3D8}
0D14: B7              OR      A                   
0D15: C0              RET     NZ                  
0D16: 3A D6 83        LD      A,($83D6)           ; {hard.workRam+3D6}
0D19: FE 03           CP      $03                 
0D1B: CA B3 0B        JP      Z,$0BB3             ; {code.renderMode3ScoreRankingScreen}
0D1E: 3A E1 83        LD      A,($83E1)           ; {hard.workRam+3E1}
0D21: B7              OR      A                   
0D22: C2 4C 0D        JP      NZ,$0D4C            ; {code.initInPlayBoardOnce}
0D25: 3A D6 83        LD      A,($83D6)           ; {hard.workRam+3D6}
0D28: FE 04           CP      $04                 
0D2A: CA 6D 0C        JP      Z,$0C6D             ; {code.renderMode4PointTablePhase}
0D2D: FE 02           CP      $02                 
0D2F: CA 88 2D        JP      Z,$2D88             ; {code.renderMode2IntroScreen}
0D32: FE 05           CP      $05                 
0D34: C0              RET     NZ                  

loc_0d35:
0D35: 21 D8 83        LD      HL,$83D8            
0D38: 36 30           LD      (HL),$30            
0D3A: 2D              DEC     L                   
0D3B: AF              XOR     A                   
0D3C: 77              LD      (HL),A              
0D3D: 32 15 80        LD      ($8015),A           ; {hard.workRam+15}
0D40: 11 01 2F        LD      DE,$2F01            
0D43: 21 CA AA        LD      HL,$AACA            
0D46: 06 0D           LD      B,$0D               
0D48: EF              RST     $28                 
0D49: C3 17 0C        JP      $0C17               ; {code.blitMode3FinalStrip}

; One-shot in-play board setup: always clears the active player's work RAM
; first, then (guarded by IN_PLAY_BOARD_INIT_GUARD 0x83ba, run once per
; board) zeros both players' difficulty indices, the anim frame index,
; TWO_PLAYER_START_FLAG and a board-state cell, marks the guard, runs the
; lane/object/field setup (loadActivePlayerLaneParams, activateFrogObject,
; fillTilemapBlock28x32, clearObjectBlocksAndMirrorToObjRam), seeds two
; object/HUD cells, then blits the HUD strings, the player-select prompt
; (blitPlayerSelectPrompt) and the extra-life score-target digits
; (writeScoreField). Memory-only
initInPlayBoardOnce:
0D4C: CD E6 07        CALL    $07E6               ; {code.clearActivePlayerWorkRam}
0D4F: 3A BA 83        LD      A,($83BA)           ; {hard.workRam+3BA}
0D52: B7              OR      A                   
0D53: C0              RET     NZ                  
0D54: 67              LD      H,A                 
0D55: 6F              LD      L,A                 
0D56: 22 93 82        LD      ($8293),HL          ; {hard.workRam+293}
0D59: 22 B3 81        LD      ($81B3),HL          ; {hard.workRam+1B3}
0D5C: 32 5B 82        LD      ($825B),A           ; {hard.workRam+25B}
0D5F: 32 9A 82        LD      ($829A),A           ; {hard.workRam+29A}
0D62: 3C              INC     A                   
0D63: 32 BA 83        LD      ($83BA),A           ; {hard.workRam+3BA}
0D66: CD 3D 22        CALL    $223D               ; {code.loadActivePlayerLaneParams}
0D69: CD 04 08        CALL    $0804               ; {code.activateFrogObject}
0D6C: CD 66 07        CALL    $0766               ; {code.fillTilemapBlock28x32}
0D6F: CD 4B 06        CALL    $064B               ; {code.clearObjectBlocksAndMirrorToObjRam}
0D72: 3E 04           LD      A,$04               
0D74: 32 1B 80        LD      ($801B),A           ; {hard.workRam+1B}
0D77: 3E 06           LD      A,$06               
0D79: 32 29 80        LD      ($8029),A           ; {hard.workRam+29}
0D7C: 21 28 AA        LD      HL,$AA28            
0D7F: 11 77 2F        LD      DE,$2F77            
0D82: 06 04           LD      B,$04               
0D84: EF              RST     $28                 
0D85: 21 AD AA        LD      HL,$AAAD            
0D88: 1C              INC     E                   
0D89: 06 0C           LD      B,$0C               
0D8B: EF              RST     $28                 
0D8C: CD B9 0D        CALL    $0DB9               ; {code.blitPlayerSelectPrompt}
0D8F: 21 74 AB        LD      HL,$AB74            
0D92: 11 88 2F        LD      DE,$2F88            
0D95: 06 03           LD      B,$03               
0D97: EF              RST     $28                 
0D98: 11 A8 2F        LD      DE,$2FA8            
0D9B: 06 06           LD      B,$06               
0D9D: EF              RST     $28                 
0D9E: 11 AE 2F        LD      DE,$2FAE            
0DA1: 06 05           LD      B,$05               
0DA3: EF              RST     $28                 
0DA4: 13              INC     DE                  
0DA5: 06 07           LD      B,$07               
0DA7: EF              RST     $28                 
0DA8: 21 94 A9        LD      HL,$A994            
0DAB: ED 5B 08 2E     LD      DE,($2E08)          ; {hard.rom+2E08}
0DAF: CD 95 0B        CALL    $0B95               ; {code.writeScoreField}
0DB2: 11 BA 2F        LD      DE,$2FBA            
0DB5: 06 04           LD      B,$04               
0DB7: EF              RST     $28                 
0DB8: C9              RET                         

; Draws the player-select prompt line. With exactly one credit (CREDIT_BCD
; 0x83e1 == 1) blits 'ONE PLAYER ONLY' -- a 4-tile then 11-tile column --
; up ONE_PLAYER_ONLY_PROMPT_VRAM. Otherwise sets SCREEN_MODE_STATE
; (0x8023)=3, blits 'ONE OR TWO PLAYER' (4-tile then 13-tile) up
; ONE_OR_TWO_PLAYERS_PROMPT_VRAM and caps the advanced cursor with tile
; 0x23 ('S') to read 'ONE OR TWO PLAYERS'. Memory-only (VRAM)
blitPlayerSelectPrompt:
0DB9: 3A E1 83        LD      A,($83E1)           ; {hard.workRam+3E1}
0DBC: 11 88 2F        LD      DE,$2F88            
0DBF: 3D              DEC     A                   
0DC0: 28 11           JR      Z,$0DD3             ; {code.loc_0dd3}
0DC2: 3E 03           LD      A,$03               
0DC4: 32 23 80        LD      ($8023),A           ; {hard.workRam+23}
0DC7: 21 11 AB        LD      HL,$AB11            
0DCA: 06 04           LD      B,$04               
0DCC: EF              RST     $28                 
0DCD: 06 0D           LD      B,$0D               
0DCF: EF              RST     $28                 
0DD0: 36 23           LD      (HL),$23            
0DD2: C9              RET                         

loc_0dd3:
0DD3: 21 F1 AA        LD      HL,$AAF1            
0DD6: 06 04           LD      B,$04               
0DD8: EF              RST     $28                 
0DD9: 11 93 2F        LD      DE,$2F93            
0DDC: 06 0B           LD      B,$0B               
0DDE: EF              RST     $28                 
0DDF: C9              RET                         

; Attract board-demo cell assembler (tail-called from the attract
; sequencer driveAttractDemoSequencer for phases 3+): seeds the demo
; scroll cells OBJECT_ANIM_STATE_800D (0x800d) / DEMO_SCROLL_REGISTER
; (0x800f)=3, decrements the dwell counter ATTRACT_DEMO_DWELL (0x83bc) and
; returns while still dwelling; on expiry reloads it to 32, stamps one
; phase's 2x2 tile corner at ATTRACT_DEMO_CORNER_VRAM
; (0xa8c6)+96*(phase-1), clears that cell's 4-byte object block,
; decrements the phase counter ATTRACT_DEMO_PHASE_COUNTER (0x83d7), and on
; drain reloads it to 7 and resets the sequencer (ATTRACT_SEQUENCER_PHASE
; 0x83bf / ATTRACT_PHASE_COMPANION 0x83bb) before tailing to
; setAttractIdleMode. Memory-only
stampAttractDemoCell:
0DE0: 3E 03           LD      A,$03               
0DE2: 32 0D 80        LD      ($800D),A           ; {hard.workRam+D}
0DE5: 32 0F 80        LD      ($800F),A           ; {hard.workRam+F}
0DE8: 3A BC 83        LD      A,($83BC)           ; {hard.workRam+3BC}
0DEB: 3D              DEC     A                   
0DEC: 32 BC 83        LD      ($83BC),A           ; {hard.workRam+3BC}
0DEF: C0              RET     NZ                  
0DF0: 3E 20           LD      A,$20               
0DF2: 32 BC 83        LD      ($83BC),A           ; {hard.workRam+3BC}
0DF5: 3A D7 83        LD      A,($83D7)           ; {hard.workRam+3D7}
0DF8: 87              ADD     A,A                 
0DF9: 16 00           LD      D,$00               
0DFB: 5F              LD      E,A                 
0DFC: 21 FF 0D        LD      HL,$0DFF            
0DFF: 19              ADD     HL,DE               
0E00: E9              JP      (HL)                

; ---- $0E01-$0E0C: data ----
0E01: 18 46 18 3A 18 2E 18 22 18 16 18 0A

loc_0e0d:
0E0D: 21 06 AB        LD      HL,$AB06            
0E10: 11 40 80        LD      DE,$8040            
0E13: 3E D4           LD      A,$D4               
0E15: 18 3A           JR      $0E51               ; {code.loc_0e51}

loc_0e17:
0E17: 21 A6 AA        LD      HL,$AAA6            
0E1A: 11 44 80        LD      DE,$8044            
0E1D: 3E D8           LD      A,$D8               
0E1F: 18 30           JR      $0E51               ; {code.loc_0e51}

loc_0e21:
0E21: 21 46 AA        LD      HL,$AA46            
0E24: 11 48 80        LD      DE,$8048            
0E27: 3E DC           LD      A,$DC               
0E29: 18 26           JR      $0E51               ; {code.loc_0e51}

loc_0e2b:
0E2B: 21 E6 A9        LD      HL,$A9E6            
0E2E: 11 4C 80        LD      DE,$804C            
0E31: 3E F4           LD      A,$F4               
0E33: 18 1C           JR      $0E51               ; {code.loc_0e51}

loc_0e35:
0E35: 21 86 A9        LD      HL,$A986            
0E38: 11 50 80        LD      DE,$8050            
0E3B: 3E F4           LD      A,$F4               
0E3D: 18 12           JR      $0E51               ; {code.loc_0e51}

loc_0e3f:
0E3F: 21 26 A9        LD      HL,$A926            
0E42: 11 54 80        LD      DE,$8054            
0E45: 3E F8           LD      A,$F8               
0E47: 18 08           JR      $0E51               ; {code.loc_0e51}

loc_0e49:
0E49: 21 C6 A8        LD      HL,$A8C6            
0E4C: 11 58 80        LD      DE,$8058            
0E4F: 3E D8           LD      A,$D8               

loc_0e51:
0E51: 01 1F 00        LD      BC,$001F            
0E54: 77              LD      (HL),A              
0E55: 3C              INC     A                   
0E56: 2C              INC     L                   
0E57: 77              LD      (HL),A              
0E58: 3C              INC     A                   
0E59: 09              ADD     HL,BC               
0E5A: 77              LD      (HL),A              
0E5B: 3C              INC     A                   
0E5C: 2C              INC     L                   
0E5D: 77              LD      (HL),A              
0E5E: EB              EX      DE,HL               
0E5F: 01 00 04        LD      BC,$0400            

loc_0e62:
0E62: 71              LD      (HL),C              
0E63: 2C              INC     L                   
0E64: 10 FC           DJNZ    $0E62               ; {code.loc_0e62}
0E66: 21 D7 83        LD      HL,$83D7            
0E69: 35              DEC     (HL)                
0E6A: C0              RET     NZ                  
0E6B: 36 07           LD      (HL),$07            
0E6D: AF              XOR     A                   
0E6E: 32 BF 83        LD      ($83BF),A           ; {hard.workRam+3BF}
0E71: 32 BB 83        LD      ($83BB),A           ; {hard.workRam+3BB}

; Forces GAME_MODE (0x83d6) to 5 (attract-idle), the credits-present tail
; of the attract-demo sequencer. Memory-only
setAttractIdleMode:
0E74: 3E 05           LD      A,$05               
0E76: 32 D6 83        LD      ($83D6),A           ; {hard.workRam+3D6}
0E79: C9              RET                         

; Attract-demo sequencer, run each vblank while credits are zero: a
; nonzero CREDIT_BCD (0x83e1) tails to setAttractIdleMode, else a state
; machine on the phase byte ATTRACT_SEQUENCER_PHASE (0x83bf) -- phase 0
; seeds the demo (fill the field, clear object blocks, lay out seven
; cells, seed the frame timer) and arms the animator, phase 1 runs the
; scroll animator (a computed arm picks the cell and its scroll floor,
; then scrolls it left four pixels once the cell frame clock elapses),
; phase 2 rewinds the seven cells, higher phases stamp the per-cell demo
; graphics (stampAttractDemoCell). Memory-only
driveAttractDemoSequencer:
0E7A: 3A E1 83        LD      A,($83E1)           ; {hard.workRam+3E1}
0E7D: B7              OR      A                   
0E7E: 20 F4           JR      NZ,$0E74            ; {code.setAttractIdleMode}
0E80: 21 BF 83        LD      HL,$83BF            
0E83: 7E              LD      A,(HL)              
0E84: B7              OR      A                   
0E85: 20 2D           JR      NZ,$0EB4            ; {code.loc_0eb4}
0E87: CD 66 07        CALL    $0766               ; {code.fillTilemapBlock28x32}
0E8A: CD 4B 06        CALL    $064B               ; {code.clearObjectBlocksAndMirrorToObjRam}
0E8D: 21 40 80        LD      HL,$8040            
0E90: 01 03 07        LD      BC,$0703            
0E93: 11 00 81        LD      DE,$8100            

loc_0e96:
0E96: 73              LD      (HL),E              
0E97: 2C              INC     L                   
0E98: 2C              INC     L                   
0E99: 71              LD      (HL),C              
0E9A: 2C              INC     L                   
0E9B: 72              LD      (HL),D              
0E9C: 2C              INC     L                   
0E9D: 10 F7           DJNZ    $0E96               ; {code.loc_0e96}
0E9F: 21 04 05        LD      HL,$0504            
0EA2: 22 BD 83        LD      ($83BD),HL          ; {hard.workRam+3BD}

loc_0ea5:
0EA5: 21 D7 83        LD      HL,$83D7            
0EA8: 36 07           LD      (HL),$07            
0EAA: 21 BC 83        LD      HL,$83BC            
0EAD: 36 20           LD      (HL),$20            

loc_0eaf:
0EAF: 21 BF 83        LD      HL,$83BF            
0EB2: 34              INC     (HL)                
0EB3: C9              RET                         

loc_0eb4:
0EB4: 3D              DEC     A                   
0EB5: 20 5F           JR      NZ,$0F16            ; {code.loc_0f16}
0EB7: 3A D7 83        LD      A,($83D7)           ; {hard.workRam+3D7}
0EBA: 87              ADD     A,A                 
0EBB: 16 00           LD      D,$00               
0EBD: 5F              LD      E,A                 
0EBE: 21 C1 0E        LD      HL,$0EC1            
0EC1: 19              ADD     HL,DE               
0EC2: E9              JP      (HL)                

loc_0ec3:
0EC3: 18 34           JR      $0EF9               ; {code.loc_0ef9}

loc_0ec5:
0EC5: 18 2B           JR      $0EF2               ; {code.loc_0ef2}

loc_0ec7:
0EC7: 18 22           JR      $0EEB               ; {code.loc_0eeb}

loc_0ec9:
0EC9: 18 19           JR      $0EE4               ; {code.loc_0ee4}

loc_0ecb:
0ECB: 18 10           JR      $0EDD               ; {code.loc_0edd}

loc_0ecd:
0ECD: 18 07           JR      $0ED6               ; {code.loc_0ed6}

loc_0ecf:
0ECF: 21 40 80        LD      HL,$8040            
0ED2: 06 31           LD      B,$31               
0ED4: 18 28           JR      $0EFE               ; {code.loc_0efe}

loc_0ed6:
0ED6: 21 44 80        LD      HL,$8044            
0ED9: 06 49           LD      B,$49               
0EDB: 18 21           JR      $0EFE               ; {code.loc_0efe}

loc_0edd:
0EDD: 21 48 80        LD      HL,$8048            
0EE0: 06 61           LD      B,$61               
0EE2: 18 1A           JR      $0EFE               ; {code.loc_0efe}

loc_0ee4:
0EE4: 21 4C 80        LD      HL,$804C            
0EE7: 06 79           LD      B,$79               
0EE9: 18 13           JR      $0EFE               ; {code.loc_0efe}

loc_0eeb:
0EEB: 21 50 80        LD      HL,$8050            
0EEE: 06 91           LD      B,$91               
0EF0: 18 0C           JR      $0EFE               ; {code.loc_0efe}

loc_0ef2:
0EF2: 21 54 80        LD      HL,$8054            
0EF5: 06 A9           LD      B,$A9               
0EF7: 18 05           JR      $0EFE               ; {code.loc_0efe}

loc_0ef9:
0EF9: 21 58 80        LD      HL,$8058            
0EFC: 06 C1           LD      B,$C1               

loc_0efe:
0EFE: CD 3E 0F        CALL    $0F3E               ; {code.loc_0f3e}
0F01: 4F              LD      C,A                 
0F02: 35              DEC     (HL)                
0F03: 35              DEC     (HL)                
0F04: 35              DEC     (HL)                
0F05: 35              DEC     (HL)                
0F06: 7E              LD      A,(HL)              
0F07: 2C              INC     L                   
0F08: 71              LD      (HL),C              
0F09: B8              CP      B                   
0F0A: D0              RET     NC                  
0F0B: 36 1E           LD      (HL),$1E            
0F0D: 21 D7 83        LD      HL,$83D7            
0F10: 35              DEC     (HL)                
0F11: C0              RET     NZ                  
0F12: 36 14           LD      (HL),$14            
0F14: 18 99           JR      $0EAF               ; {code.loc_0eaf}

loc_0f16:
0F16: 3D              DEC     A                   
0F17: C2 E0 0D        JP      NZ,$0DE0            ; {code.stampAttractDemoCell}
0F1A: CD 3E 0F        CALL    $0F3E               ; {code.loc_0f3e}
0F1D: D6 03           SUB     $03                 
0F1F: 4F              LD      C,A                 
0F20: 3A D7 83        LD      A,($83D7)           ; {hard.workRam+3D7}
0F23: B7              OR      A                   
0F24: CA A5 0E        JP      Z,$0EA5             ; {code.loc_0ea5}
0F27: 06 07           LD      B,$07               
0F29: 11 06 00        LD      DE,$0006            
0F2C: 21 43 80        LD      HL,$8043            

loc_0f2f:
0F2F: 35              DEC     (HL)                
0F30: 35              DEC     (HL)                
0F31: 35              DEC     (HL)                
0F32: 35              DEC     (HL)                
0F33: 2D              DEC     L                   
0F34: 2D              DEC     L                   
0F35: 71              LD      (HL),C              
0F36: 19              ADD     HL,DE               
0F37: 10 F6           DJNZ    $0F2F               ; {code.loc_0f2f}
0F39: 3D              DEC     A                   
0F3A: 32 D7 83        LD      ($83D7),A           ; {hard.workRam+3D7}
0F3D: C9              RET                         

loc_0f3e:
0F3E: E5              PUSH    HL                  
0F3F: 21 BD 83        LD      HL,$83BD            
0F42: 35              DEC     (HL)                
0F43: 20 11           JR      NZ,$0F56            ; {code.loc_0f56}
0F45: 36 08           LD      (HL),$08            
0F47: 2C              INC     L                   
0F48: 35              DEC     (HL)                
0F49: 20 02           JR      NZ,$0F4D            ; {code.loc_0f4d}
0F4B: 36 04           LD      (HL),$04            

loc_0f4d:
0F4D: 7E              LD      A,(HL)              
0F4E: 21 1B 2E        LD      HL,$2E1B            
0F51: 85              ADD     A,L                 
0F52: 6F              LD      L,A                 
0F53: 7E              LD      A,(HL)              
0F54: E1              POP     HL                  
0F55: C9              RET                         

loc_0f56:
0F56: F1              POP     AF                  
0F57: F1              POP     AF                  
0F58: C9              RET                         

; Redraws the GAME-OVER line: clears the STATUS_ROW_VRAM_BASE (0xa850)
; tile-group column (blitFourTileGroupColumn), then blits the fixed 9-tile
; 'GAME OVER' string from NINE_TILE_STRING_SRC (0x2f0e) up VRAM column
; NINE_TILE_STRING_VRAM (0xaa70). Called first by the game-over/intro
; entry runIntroTimerThenInitGame. Memory-only (VRAM)
blitGameOverLine:
0F59: 21 50 A8        LD      HL,$A850            
0F5C: CD E2 19        CALL    $19E2               ; {code.blitFourTileGroupColumn}
0F5F: 21 70 AA        LD      HL,$AA70            
0F62: 11 0E 2F        LD      DE,$2F0E            
0F65: 06 09           LD      B,$09               
0F67: EF              RST     $28                 
0F68: C9              RET                         

; At cold-start new-game init (called by coldStartClearPlayRamAndSetMode):
; reads both players' score words PLAYER1_SCORE (0x83ed) and PLAYER2_SCORE
; (0x83eb), ranks each through insertHighScoreEntry (larger word first),
; and packs the two returned rank codes into INTRO_DIGIT_FIELD (0x83fb) --
; larger's code in the low byte, smaller's in the high byte. Memory-only
packScoreRankPair:
0F69: ED 5B ED 83     LD      DE,($83ED)          ; {hard.workRam+3ED}
0F6D: 2A EB 83        LD      HL,($83EB)          ; {hard.workRam+3EB}
0F70: 44              LD      B,H                 
0F71: 4D              LD      C,L                 
0F72: B7              OR      A                   
0F73: ED 52           SBC     HL,DE               
0F75: 38 05           JR      C,$0F7C             ; {code.loc_0f7c}
0F77: D5              PUSH    DE                  
0F78: C5              PUSH    BC                  
0F79: D1              POP     DE                  
0F7A: 18 01           JR      $0F7D               ; {code.loc_0f7d}

loc_0f7c:
0F7C: C5              PUSH    BC                  

loc_0f7d:
0F7D: CD 84 0A        CALL    $0A84               ; {code.insertHighScoreEntry}
0F80: D1              POP     DE                  
0F81: F5              PUSH    AF                  
0F82: CD 84 0A        CALL    $0A84               ; {code.insertHighScoreEntry}
0F85: 67              LD      H,A                 
0F86: F1              POP     AF                  
0F87: 6F              LD      L,A                 
0F88: 22 FB 83        LD      ($83FB),HL          ; {hard.workRam+3FB}
0F8B: C9              RET                         

; Frog-animation pre-blit helper: when the trigger cell
; FROG_ANIM_BLIT_TRIGGER (0x8118) is set, blits an 8-row two-byte-per-row
; tile pair from FROG_ANIM_TILE_PAIR_SRC (0x1413) down VRAM column
; FROG_ANIM_COLUMN_VRAM (0xa806, +32 per row), then clears the trigger so
; the blit runs once; a clear trigger returns at once. Memory-only
blitFrogAnimColumnOnTrigger:
0F8C: 3A 18 81        LD      A,($8118)           ; {hard.workRam+118}
0F8F: A7              AND     A                   
0F90: C8              RET     Z                   
0F91: 11 06 A8        LD      DE,$A806            
0F94: 06 08           LD      B,$08               
0F96: 21 13 14        LD      HL,$1413            

loc_0f99:
0F99: 7E              LD      A,(HL)              
0F9A: 12              LD      (DE),A              
0F9B: 23              INC     HL                  
0F9C: 13              INC     DE                  
0F9D: 7E              LD      A,(HL)              
0F9E: 12              LD      (DE),A              
0F9F: 23              INC     HL                  
0FA0: C5              PUSH    BC                  
0FA1: 01 1F 00        LD      BC,$001F            
0FA4: EB              EX      DE,HL               
0FA5: 09              ADD     HL,BC               
0FA6: EB              EX      DE,HL               
0FA7: C1              POP     BC                  
0FA8: 10 EF           DJNZ    $0F99               ; {code.loc_0f99}
0FAA: AF              XOR     A                   
0FAB: 32 18 81        LD      ($8118),A           ; {hard.workRam+118}
0FAE: C9              RET                         

; Frog-animation arm dispatcher: reads the anim-index cell $8000 (0x8000,
; values 0..10) and dispatches to that arm's render routine
; (renderFrogAnimArm0..10); index 5 renders nothing and steps straight to
; the index advance (advanceFrogAnimIndexAndRedispatch). Memory-only
dispatchFrogAnimationArm:
0FAF: 2A 00 80        LD      HL,($8000)          ; {hard.workRam}
0FB2: 01 BE 0F        LD      BC,$0FBE            
0FB5: 26 00           LD      H,$00               
0FB7: 29              ADD     HL,HL               
0FB8: 09              ADD     HL,BC               
0FB9: 4E              LD      C,(HL)              
0FBA: 23              INC     HL                  
0FBB: 66              LD      H,(HL)              
0FBC: 69              LD      L,C                 
0FBD: E9              JP      (HL)                

; ---- $0FBE-$0FD3: data ----
0FBE: D4 0F 58 10 7B 10 9B 10 BB 10 DB 10 F8 10 18 11
0FCE: 38 11 58 11 78 11

; Frog-animation render arm 0 (dispatch target of
; dispatchFrogAnimationArm, sibling of arms 1/6): loads its render triple
; (row-advance/row-count/column) from the active lane-parameter block
; ACTIVE_LANE_PARAM_BLOCK (0x8270, +0/+1/+2), takes its VRAM destination
; from ROM word FROG_ANIM_ARM0_DEST_PTR (0x13ed), stashes the column
; stride into SCROLL_COPY_COLUMN_STRIDE (0x81b1) and the tile source
; FROG_ANIM_ARM0_SRC_BASE (0x1403) into SCROLL_COPY_SRC_PTR (0x8001), then
; enters the shared render loop renderFrogAnimTileColumns. Memory-only
renderFrogAnimArm0:
0FD4: 21 70 82        LD      HL,$8270            
0FD7: 7E              LD      A,(HL)              
0FD8: 23              INC     HL                  
0FD9: 46              LD      B,(HL)              
0FDA: 23              INC     HL                  
0FDB: 4E              LD      C,(HL)              
0FDC: 2A ED 13        LD      HL,($13ED)          ; {hard.rom+13ED}
0FDF: 11 03 14        LD      DE,$1403            
0FE2: DD 21 00 81     LD      IX,$8100            
0FE6: FD 21 00 81     LD      IY,$8100            
0FEA: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
0FED: ED 53 01 80     LD      ($8001),DE          ; {hard.workRam+1}

; Shared frog-animation tile-column render loop (entered by every arm):
; for each of C columns computes the on-screen column index
; (computeVramColumnIndex), stamps its negated value as the sprite X into
; the IX plot cursor and bumps the IY plot cursor unless plotting is
; suppressed (TWO_PLAYER_START_FLAG 0x825b nonzero), copies B tile-rows
; (two bytes each, one screen-row apart), then advances the destination by
; the column stride SCROLL_COPY_COLUMN_STRIDE (0x81b1). On the last column
; it hands to advanceFrogAnimIndexAndRedispatch. Memory-only
renderFrogAnimTileColumns:
0FF1: E5              PUSH    HL                  
0FF2: C5              PUSH    BC                  
0FF3: D5              PUSH    DE                  
0FF4: CD 98 11        CALL    $1198               ; {code.computeVramColumnIndex}
0FF7: 3A 5B 82        LD      A,($825B)           ; {hard.workRam+25B}
0FFA: A7              AND     A                   
0FFB: 20 0B           JR      NZ,$1008            ; {code.loc_1008}
0FFD: 79              LD      A,C                 
0FFE: 2F              CPL                         
0FFF: 3C              INC     A                   
1000: DD 77 01        LD      (IX+$01),A          
1003: DD 23           INC     IX                  
1005: FD 34 00        INC     (IY+$00)            

loc_1008:
1008: D1              POP     DE                  
1009: C1              POP     BC                  
100A: E1              POP     HL                  
100B: 78              LD      A,B                 
100C: 32 03 80        LD      ($8003),A           ; {hard.workRam+3}

loc_100f:
100F: 1A              LD      A,(DE)              
1010: 77              LD      (HL),A              
1011: 23              INC     HL                  
1012: 13              INC     DE                  
1013: 1A              LD      A,(DE)              
1014: 77              LD      (HL),A              
1015: 2B              DEC     HL                  
1016: D5              PUSH    DE                  
1017: 11 20 00        LD      DE,$0020            
101A: 19              ADD     HL,DE               
101B: D1              POP     DE                  
101C: 10 1A           DJNZ    $1038               ; {code.loc_1038}
101E: 3A B1 81        LD      A,($81B1)           ; {hard.workRam+1B1}
1021: 5F              LD      E,A                 
1022: 16 00           LD      D,$00               
1024: 19              ADD     HL,DE               
1025: 0D              DEC     C                   
1026: C2 3C 10        JP      NZ,$103C            ; {code.loc_103c}

; Frog-animation index step: bumps the anim-index cell $8000 (0x8000);
; while it is still below the arm count (11) it re-dispatches the next arm
; (dispatchFrogAnimationArm), else wraps the index back to 0 and returns,
; ending the cluster's per-frame walk over all arms. Memory-only
advanceFrogAnimIndexAndRedispatch:
1029: 21 00 80        LD      HL,$8000            
102C: 34              INC     (HL)                
102D: 7E              LD      A,(HL)              
102E: FE 0B           CP      $0B                 
1030: DA AF 0F        JP      C,$0FAF             ; {code.dispatchFrogAnimationArm}
1033: AF              XOR     A                   
1034: 77              LD      (HL),A              
1035: C3 47 10        JP      $1047               ; {code.loc_1047}

loc_1038:
1038: 13              INC     DE                  
1039: C3 0F 10        JP      $100F               ; {code.loc_100f}

loc_103c:
103C: ED 5B 01 80     LD      DE,($8001)          ; {hard.workRam+1}
1040: 3A 03 80        LD      A,($8003)           ; {hard.workRam+3}
1043: 47              LD      B,A                 
1044: C3 F1 0F        JP      $0FF1               ; {code.renderFrogAnimTileColumns}

loc_1047:
1047: C9              RET                         

; Power-on settle delay: reads the watchdog port WATCHDOG_RESET_PORT
; (0x8800) once per pass across a long count to keep the watchdog fed
; while hardware settles. The pass count is pure timing; the io
spinWatchdogSettleDelay:
1048: 01 FF EF        LD      BC,$EFFF            

loc_104b:
104B: 3A 00 88        LD      A,($8800)           
104E: 0B              DEC     BC                  
104F: 78              LD      A,B                 
1050: A7              AND     A                   
1051: 20 F8           JR      NZ,$104B            ; {code.loc_104b}
1053: 79              LD      A,C                 
1054: A7              AND     A                   
1055: 20 F4           JR      NZ,$104B            ; {code.loc_104b}
1057: C9              RET                         

; Frog-animation render arm 1 (dispatch target of
; dispatchFrogAnimationArm): runs the guarded pre-blit
; (blitFrogAnimColumnOnTrigger), reads its render triple from
; SCROLL_OBJECT_BLOCK_BASE (0x8273), takes its VRAM destination base from
; ROM word SCROLL_COPY_DEST_PTR (0x13ef), stashes the sprite code into
; SCROLL_COPY_COLUMN_STRIDE (0x81b1) and the tile source
; SCROLL_GRID_SRC_PHASE16 (0x1423) into SCROLL_COPY_SRC_PTR (0x8001), arms
; both plot cursors to LANE_OBJLIST_8109 (0x8109), then enters the shared
; render loop renderFrogAnimTileColumns. Memory-only
renderFrogAnimArm1:
1058: CD 8C 0F        CALL    $0F8C               ; {code.blitFrogAnimColumnOnTrigger}
105B: 21 73 82        LD      HL,$8273            
105E: 7E              LD      A,(HL)              
105F: 23              INC     HL                  
1060: 46              LD      B,(HL)              
1061: 23              INC     HL                  
1062: 4E              LD      C,(HL)              
1063: 2A EF 13        LD      HL,($13EF)          ; {hard.rom+13EF}
1066: 11 23 14        LD      DE,$1423            
1069: DD 21 09 81     LD      IX,$8109            
106D: FD 21 09 81     LD      IY,$8109            
1071: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
1074: ED 53 01 80     LD      ($8001),DE          ; {hard.workRam+1}
1078: C3 F1 0F        JP      $0FF1               ; {code.renderFrogAnimTileColumns}

; Frog-animation render arm 2 (dispatch target of
; dispatchFrogAnimationArm, sibling of arm 0, no pre-blit): loads its
; render triple (row-advance/row-count/column) from
; ACTIVE_LANE_PARAM_BLOCK+6 (0x8276), takes its VRAM destination from ROM
; word FROG_ANIM_ARM2_DEST_PTR (0x13f1), stashes the column stride into
; SCROLL_COPY_COLUMN_STRIDE (0x81b1) and the tile source
; FROG_ANIM_ARM2_SRC_BASE (0x143b) into SCROLL_COPY_SRC_PTR (0x8001), arms
; both plot cursors to LANE_OBJLIST_8112 (0x8112), then enters the shared
; render loop renderFrogAnimTileColumns. Memory-only
renderFrogAnimArm2:
107B: 21 76 82        LD      HL,$8276            
107E: 7E              LD      A,(HL)              
107F: 23              INC     HL                  
1080: 46              LD      B,(HL)              
1081: 23              INC     HL                  
1082: 4E              LD      C,(HL)              
1083: 2A F1 13        LD      HL,($13F1)          ; {hard.rom+13F1}
1086: 11 3B 14        LD      DE,$143B            
1089: DD 21 12 81     LD      IX,$8112            
108D: FD 21 12 81     LD      IY,$8112            
1091: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
1094: ED 53 01 80     LD      ($8001),DE          ; {hard.workRam+1}
1098: C3 F1 0F        JP      $0FF1               ; {code.renderFrogAnimTileColumns}

; Frog-animation render arm 3 (dispatch target of
; dispatchFrogAnimationArm, sibling of arm 0, no pre-blit): loads its
; render triple from ACTIVE_LANE_PARAM_BLOCK+9 (0x8279), takes its VRAM
; destination from ROM word FROG_ANIM_ARM3_DEST_PTR (0x13f3), stashes the
; column stride into SCROLL_COPY_COLUMN_STRIDE (0x81b1) and the tile
; source FROG_ANIM_ARM3_SRC_BASE (0x1453) into SCROLL_COPY_SRC_PTR
; (0x8001), arms both plot cursors to LANE_OBJLIST_811B (0x811b), then
; enters the shared render loop renderFrogAnimTileColumns. Memory-only
renderFrogAnimArm3:
109B: 21 79 82        LD      HL,$8279            
109E: 7E              LD      A,(HL)              
109F: 23              INC     HL                  
10A0: 46              LD      B,(HL)              
10A1: 23              INC     HL                  
10A2: 4E              LD      C,(HL)              
10A3: 2A F3 13        LD      HL,($13F3)          ; {hard.rom+13F3}
10A6: 11 53 14        LD      DE,$1453            
10A9: DD 21 1B 81     LD      IX,$811B            
10AD: FD 21 1B 81     LD      IY,$811B            
10B1: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
10B4: ED 53 01 80     LD      ($8001),DE          ; {hard.workRam+1}
10B8: C3 F1 0F        JP      $0FF1               ; {code.renderFrogAnimTileColumns}

; Frog-animation render arm 4 (dispatch target of
; dispatchFrogAnimationArm, sibling of arm 0, no pre-blit): loads its
; render triple from ACTIVE_LANE_PARAM_BLOCK+12 (0x827c), takes its VRAM
; destination from ROM word SCROLL_COPY_DEST_PTR_ALT (0x13f5), stashes the
; column stride into SCROLL_COPY_COLUMN_STRIDE (0x81b1) and the tile
; source SCROLL_BAND_SRC_PHASE16 (0x145f) into SCROLL_COPY_SRC_PTR
; (0x8001), arms both plot cursors to LANE_OBJLIST_8124 (0x8124), then
; enters the shared render loop renderFrogAnimTileColumns. Memory-only
renderFrogAnimArm4:
10BB: 21 7C 82        LD      HL,$827C            
10BE: 7E              LD      A,(HL)              
10BF: 23              INC     HL                  
10C0: 46              LD      B,(HL)              
10C1: 23              INC     HL                  
10C2: 4E              LD      C,(HL)              
10C3: 2A F5 13        LD      HL,($13F5)          ; {hard.rom+13F5}
10C6: 11 5F 14        LD      DE,$145F            
10C9: DD 21 24 81     LD      IX,$8124            
10CD: FD 21 24 81     LD      IY,$8124            
10D1: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
10D4: ED 53 01 80     LD      ($8001),DE          ; {hard.workRam+1}
10D8: C3 F1 0F        JP      $0FF1               ; {code.renderFrogAnimTileColumns}

loc_10db:
10DB: C3 29 10        JP      $1029               ; {code.advanceFrogAnimIndexAndRedispatch}

; ---- $10DE-$10F7: data ----
10DE: 11 9B 14 01 04 02 DD 21 2D 81 FD 21 2D 81 3E 80
10EE: 32 B1 81 ED 53 01 80 C3 F1 0F

; Frog-animation render arm 6 (dispatch target of
; dispatchFrogAnimationArm, sibling of arms 0/1, no pre-blit): reads
; sprite code FROG_ANIM_ARM6_SPRITE_CODE (0x8282), row count (0x8283) and
; pass count (0x8284), takes its VRAM destination from ROM word
; FROG_ANIM_ARM6_DEST_PTR (0x13f9), stashes the sprite code into
; SCROLL_COPY_COLUMN_STRIDE (0x81b1) and the tile source
; FROG_ANIM_ARM6_SRC_BASE (0x149f) into SCROLL_COPY_SRC_PTR (0x8001), arms
; both plot cursors to LANE_OBJLIST_8136 (0x8136), then enters the shared
; render loop renderFrogAnimTileColumns. Memory-only
renderFrogAnimArm6:
10F8: 21 82 82        LD      HL,$8282            
10FB: 7E              LD      A,(HL)              
10FC: 23              INC     HL                  
10FD: 46              LD      B,(HL)              
10FE: 23              INC     HL                  
10FF: 4E              LD      C,(HL)              
1100: 2A F9 13        LD      HL,($13F9)          ; {hard.rom+13F9}
1103: 11 9F 14        LD      DE,$149F            
1106: DD 21 36 81     LD      IX,$8136            
110A: FD 21 36 81     LD      IY,$8136            
110E: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
1111: ED 53 01 80     LD      ($8001),DE          ; {hard.workRam+1}
1115: C3 F1 0F        JP      $0FF1               ; {code.renderFrogAnimTileColumns}

; Frog-animation render arm 7 (dispatch target of
; dispatchFrogAnimationArm, sibling of arm 0, no pre-blit): loads its
; render triple from ACTIVE_LANE_PARAM_BLOCK+21 (0x8285), takes its VRAM
; destination from ROM word FROG_ANIM_ARM7_DEST_PTR (0x13fb), stashes the
; column stride into SCROLL_COPY_COLUMN_STRIDE (0x81b1) and the tile
; source FROG_ANIM_ARM7_SRC_BASE (0x14a7) into SCROLL_COPY_SRC_PTR
; (0x8001), arms both plot cursors to LANE_OBJLIST_813F (0x813f), then
; enters the shared render loop renderFrogAnimTileColumns. Memory-only
renderFrogAnimArm7:
1118: 21 85 82        LD      HL,$8285            
111B: 7E              LD      A,(HL)              
111C: 23              INC     HL                  
111D: 46              LD      B,(HL)              
111E: 23              INC     HL                  
111F: 4E              LD      C,(HL)              
1120: 2A FB 13        LD      HL,($13FB)          ; {hard.rom+13FB}
1123: 11 A7 14        LD      DE,$14A7            
1126: DD 21 3F 81     LD      IX,$813F            
112A: FD 21 3F 81     LD      IY,$813F            
112E: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
1131: ED 53 01 80     LD      ($8001),DE          ; {hard.workRam+1}
1135: C3 F1 0F        JP      $0FF1               ; {code.renderFrogAnimTileColumns}

; Frog-animation render arm 8 (dispatch target of
; dispatchFrogAnimationArm, sibling of arm 0, no pre-blit): loads its
; render triple from ACTIVE_LANE_PARAM_BLOCK+24 (0x8288), takes its VRAM
; destination from ROM word FROG_ANIM_ARM8_DEST_PTR (0x13fd), stashes the
; column stride into SCROLL_COPY_COLUMN_STRIDE (0x81b1) and the tile
; source FROG_ANIM_ARM8_SRC_BASE (0x14ab) into SCROLL_COPY_SRC_PTR
; (0x8001), arms both plot cursors to LANE_OBJLIST_8148 (0x8148), then
; enters the shared render loop renderFrogAnimTileColumns. Memory-only
renderFrogAnimArm8:
1138: 21 88 82        LD      HL,$8288            
113B: 7E              LD      A,(HL)              
113C: 23              INC     HL                  
113D: 46              LD      B,(HL)              
113E: 23              INC     HL                  
113F: 4E              LD      C,(HL)              
1140: 2A FD 13        LD      HL,($13FD)          ; {hard.rom+13FD}
1143: 11 AB 14        LD      DE,$14AB            
1146: DD 21 48 81     LD      IX,$8148            
114A: FD 21 48 81     LD      IY,$8148            
114E: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
1151: ED 53 01 80     LD      ($8001),DE          ; {hard.workRam+1}
1155: C3 F1 0F        JP      $0FF1               ; {code.renderFrogAnimTileColumns}

; Frog-animation render arm 9 (one of the eleven arms the frog-anim
; dispatcher jumps to by anim-index): loads its row-advance/row-
; count/column triple from ACTIVE_LANE_PARAM_BLOCK (0x8270) +27..+29, its
; VRAM destination from FROG_ANIM_ARM9_DEST_PTR (0x13FF) and tile source
; FROG_ANIM_ARM9_SRC_BASE (0x14AF), stashes the column stride into
; SCROLL_COPY_COLUMN_STRIDE (0x81B1) and the source into
; SCROLL_COPY_SRC_PTR (0x8001), then runs the shared tile-column render
; loop (renderFrogAnimTileColumns) with LANE_OBJLIST_8151 (0x8151) as the
; plot cursor. Memory-only
renderFrogAnimArm9:
1158: 21 8B 82        LD      HL,$828B            
115B: 7E              LD      A,(HL)              
115C: 23              INC     HL                  
115D: 46              LD      B,(HL)              
115E: 23              INC     HL                  
115F: 4E              LD      C,(HL)              
1160: 2A FF 13        LD      HL,($13FF)          ; {hard.rom+13FF}
1163: 11 AF 14        LD      DE,$14AF            
1166: DD 21 51 81     LD      IX,$8151            
116A: FD 21 51 81     LD      IY,$8151            
116E: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
1171: ED 53 01 80     LD      ($8001),DE          ; {hard.workRam+1}
1175: C3 F1 0F        JP      $0FF1               ; {code.renderFrogAnimTileColumns}

; Frog-animation render arm 10 (sibling of arm 9): loads its row-
; advance/row-count/column triple from ACTIVE_LANE_PARAM_BLOCK (0x8270)
; +30..+32, its VRAM destination from FROG_ANIM_ARM10_DEST_PTR (0x1401)
; and tile source FROG_ANIM_ARM10_SRC_BASE (0x14B3), stashes the column
; stride into SCROLL_COPY_COLUMN_STRIDE (0x81B1) and the source into
; SCROLL_COPY_SRC_PTR (0x8001), then runs the shared tile-column render
; loop (renderFrogAnimTileColumns) with LANE_OBJLIST_815A (0x815A) as the
; plot cursor. Memory-only
renderFrogAnimArm10:
1178: 21 8E 82        LD      HL,$828E            
117B: 7E              LD      A,(HL)              
117C: 23              INC     HL                  
117D: 46              LD      B,(HL)              
117E: 23              INC     HL                  
117F: 4E              LD      C,(HL)              
1180: 2A 01 14        LD      HL,($1401)          ; {hard.rom+1401}
1183: 11 B3 14        LD      DE,$14B3            
1186: DD 21 5A 81     LD      IX,$815A            
118A: FD 21 5A 81     LD      IY,$815A            
118E: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
1191: ED 53 01 80     LD      ($8001),DE          ; {hard.workRam+1}
1195: C3 F1 0F        JP      $0FF1               ; {code.renderFrogAnimTileColumns}

; coordinate/column compute for the tile render loop: from HL's distance
; to VRAM_BASE (0xA800), less the incoming borrow, fold one probed H bit
; and the shifted top column bits across six passes plus three final
; rotates into an accumulator, returned in register C; no memory touched.
; Live-in HL + carry
computeVramColumnIndex:
1198: 11 00 A8        LD      DE,$A800            
119B: ED 52           SBC     HL,DE               
119D: 7D              LD      A,L                 
119E: 01 00 06        LD      BC,$0600            
11A1: E6 E0           AND     $E0                 
11A3: 6F              LD      L,A                 

loc_11a4:
11A4: 7C              LD      A,H                 
11A5: E6 04           AND     $04                 
11A7: CA B0 11        JP      Z,$11B0             ; {code.loc_11b0}
11AA: CB 01           RLC     C                   
11AC: 0C              INC     C                   
11AD: C3 B2 11        JP      $11B2               ; {code.loc_11b2}

loc_11b0:
11B0: CB 01           RLC     C                   

loc_11b2:
11B2: CB 05           RLC     L                   
11B4: CB 14           RL      H                   
11B6: 10 EC           DJNZ    $11A4               ; {code.loc_11a4}
11B8: CB 01           RLC     C                   
11BA: CB 01           RLC     C                   
11BC: CB 01           RLC     C                   
11BE: C9              RET                         

; Lower-half entry of the per-frame frog-vs-lane resolver: returns while
; the demo gate FROG_STATE_DEMO_FLAG (0x83CD) or the hold flag HOLD_FLAG
; (0x8004) is set; otherwise keys on frog Y (FROG_Y 0x8047) -- a low
; nibble >=9 or an unmapped high nibble hands to the upper half
; (resolveFrogMoveAgainstLanes), the mapped high nibbles pick a lane
; object-list (SPRITE_BLOCK2_BASE 0x8100 / LANE_OBJLIST_8109..815A)
; scanned against the frog-X band (FROG_X 0x8044). In the road band
; (Y>=0x80) an in-band object kills the frog (killFrogAtLane raises
; HOLD_FLAG) and a clear lane is safe; in the river band (Y<0x80) an in-
; band object lets the frog ride (delegates) and a clear lane drowns it
; (killFrogAtLane). Memory-only
dispatchFrogMoveAgainstLanes:
11BF: 3A CD 83        LD      A,($83CD)           ; {hard.workRam+3CD}
11C2: B7              OR      A                   
11C3: C0              RET     NZ                  
11C4: 3A 04 80        LD      A,($8004)           ; {hard.workRam+4}
11C7: A7              AND     A                   
11C8: C0              RET     NZ                  
11C9: 21 47 80        LD      HL,$8047            
11CC: 7E              LD      A,(HL)              
11CD: 4F              LD      C,A                 
11CE: E6 0F           AND     $0F                 
11D0: FE 09           CP      $09                 
11D2: D2 09 12        JP      NC,$1209            ; {code.loc_1209}
11D5: 79              LD      A,C                 
11D6: E6 F0           AND     $F0                 
11D8: 0F              RRCA                        
11D9: 0F              RRCA                        
11DA: 0F              RRCA                        
11DB: 0F              RRCA                        
11DC: 6F              LD      L,A                 
11DD: 26 00           LD      H,$00               
11DF: 01 E9 11        LD      BC,$11E9            
11E2: 29              ADD     HL,HL               
11E3: 09              ADD     HL,BC               
11E4: 4E              LD      C,(HL)              
11E5: 23              INC     HL                  
11E6: 66              LD      H,(HL)              
11E7: 69              LD      L,C                 
11E8: E9              JP      (HL)                

; ---- $11E9-$1208: data ----
11E9: 09 12 0C 12 0F 12 12 12 1A 12 22 12 2A 12 32 12
11F9: 3A 12 42 12 4A 12 52 12 5A 12 62 12 6A 12 6D 12

loc_1209:
1209: C3 E4 12        JP      $12E4               ; {code.resolveFrogMoveAgainstLanes}

loc_120c:
120C: C3 E4 12        JP      $12E4               ; {code.resolveFrogMoveAgainstLanes}

loc_120f:
120F: C3 E4 12        JP      $12E4               ; {code.resolveFrogMoveAgainstLanes}

loc_1212:
1212: 21 00 81        LD      HL,$8100            
1215: 0E 3C           LD      C,$3C               
1217: C3 70 12        JP      $1270               ; {code.loc_1270}

loc_121a:
121A: 21 09 81        LD      HL,$8109            
121D: 0E 1F           LD      C,$1F               
121F: C3 70 12        JP      $1270               ; {code.loc_1270}

loc_1222:
1222: 21 12 81        LD      HL,$8112            
1225: 0E 5C           LD      C,$5C               
1227: C3 70 12        JP      $1270               ; {code.loc_1270}

loc_122a:
122A: 21 1B 81        LD      HL,$811B            
122D: 0E 2C           LD      C,$2C               
122F: C3 70 12        JP      $1270               ; {code.loc_1270}

loc_1232:
1232: 21 24 81        LD      HL,$8124            
1235: 0E 2F           LD      C,$2F               
1237: C3 70 12        JP      $1270               ; {code.loc_1270}

loc_123a:
123A: C3 E4 12        JP      $12E4               ; {code.resolveFrogMoveAgainstLanes}

; ---- $123D-$1241: data ----
123D: 0E 17 C3 70 12

loc_1242:
1242: 21 36 81        LD      HL,$8136            
1245: 0E 22           LD      C,$22               
1247: C3 70 12        JP      $1270               ; {code.loc_1270}

loc_124a:
124A: 21 3F 81        LD      HL,$813F            
124D: 0E 12           LD      C,$12               
124F: C3 70 12        JP      $1270               ; {code.loc_1270}

loc_1252:
1252: 21 48 81        LD      HL,$8148            
1255: 0E 12           LD      C,$12               
1257: C3 70 12        JP      $1270               ; {code.loc_1270}

loc_125a:
125A: 21 51 81        LD      HL,$8151            
125D: 0E 12           LD      C,$12               
125F: C3 70 12        JP      $1270               ; {code.loc_1270}

loc_1262:
1262: 21 5A 81        LD      HL,$815A            
1265: 0E 12           LD      C,$12               
1267: C3 70 12        JP      $1270               ; {code.loc_1270}

loc_126a:
126A: C3 E4 12        JP      $12E4               ; {code.resolveFrogMoveAgainstLanes}

loc_126d:
126D: C3 E4 12        JP      $12E4               ; {code.resolveFrogMoveAgainstLanes}

loc_1270:
1270: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1273: FE 80           CP      $80                 
1275: DA 99 12        JP      C,$1299             ; {code.loc_1299}
1278: 3A 44 80        LD      A,($8044)           ; {hard.workRam+44}
127B: C6 03           ADD     A,$03               

loc_127d:
127D: 57              LD      D,A                 
127E: 81              ADD     A,C                 
127F: 5F              LD      E,A                 
1280: 46              LD      B,(HL)              
1281: DA A1 12        JP      C,$12A1             ; {code.loc_12a1}

loc_1284:
1284: 23              INC     HL                  
1285: 7E              LD      A,(HL)              
1286: BA              CP      D                   
1287: DA B6 12        JP      C,$12B6             ; {code.loc_12b6}
128A: BB              CP      E                   
128B: D2 B6 12        JP      NC,$12B6            ; {code.loc_12b6}
128E: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1291: FE 80           CP      $80                 
1293: DA E4 12        JP      C,$12E4             ; {code.resolveFrogMoveAgainstLanes}
1296: C3 D0 12        JP      $12D0               ; {code.killFrogAtLane}

loc_1299:
1299: 3A 44 80        LD      A,($8044)           ; {hard.workRam+44}
129C: C6 0C           ADD     A,$0C               
129E: C3 7D 12        JP      $127D               ; {code.loc_127d}

loc_12a1:
12A1: 23              INC     HL                  
12A2: 7E              LD      A,(HL)              
12A3: BA              CP      D                   
12A4: D2 AB 12        JP      NC,$12AB            ; {code.loc_12ab}
12A7: BB              CP      E                   
12A8: D2 C3 12        JP      NC,$12C3            ; {code.loc_12c3}

loc_12ab:
12AB: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
12AE: FE 80           CP      $80                 
12B0: DA E4 12        JP      C,$12E4             ; {code.resolveFrogMoveAgainstLanes}
12B3: C3 D0 12        JP      $12D0               ; {code.killFrogAtLane}

loc_12b6:
12B6: 10 CC           DJNZ    $1284               ; {code.loc_1284}
12B8: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
12BB: FE 80           CP      $80                 
12BD: DA D0 12        JP      C,$12D0             ; {code.killFrogAtLane}
12C0: C3 E4 12        JP      $12E4               ; {code.resolveFrogMoveAgainstLanes}

loc_12c3:
12C3: 10 DC           DJNZ    $12A1               ; {code.loc_12a1}
12C5: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
12C8: FE 80           CP      $80                 
12CA: DA D0 12        JP      C,$12D0             ; {code.killFrogAtLane}
12CD: C3 E4 12        JP      $12E4               ; {code.resolveFrogMoveAgainstLanes}

; shared frog-kill tail (reached from both halves of the lane resolver and
; from the diver-collision test): always raises the hold/kill flag
; HOLD_FLAG (0x8004)=1, and only in the mid-river band 0x30 <= FROG_Y
; (0x8047) < 0x80 also raises the second-bank kill cell SECOND_BANK
; (0x829C); Y>=0x80 and Y<0x30 leave SECOND_BANK untouched. Memory-only
killFrogAtLane:
12D0: 3E 01           LD      A,$01               
12D2: 32 04 80        LD      ($8004),A           ; {hard.workRam+4}
12D5: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
12D8: FE 80           CP      $80                 
12DA: D0              RET     NC                  
12DB: FE 30           CP      $30                 
12DD: D8              RET     C                   
12DE: 3E 01           LD      A,$01               
12E0: 32 9C 82        LD      ($829C),A           ; {hard.workRam+29C}
12E3: C9              RET                         

; Upper half of the per-frame frog-vs-lane resolver: returns once the move
; is resolved (HOLD_FLAG 0x8004 set); otherwise the high nibble of frog
; Y+15 (FROG_Y 0x8047) selects a lane object-list (SPRITE_BLOCK2_BASE
; 0x8100 / LANE_OBJLIST_8109..815A), scanned for an object in the frog's X
; band (FROG_X 0x8044 plus an offset from LANE_LOW_BOUND_SELECTOR 0x802F).
; Road band (Y>=0x80): an in-band object blocks the move (HOLD_FLAG=1), a
; clear lane is safe; river band (Y<0x80): an in-band object lets the frog
; ride, a clear lane drowns it (killFrogAtLane). Memory-only
resolveFrogMoveAgainstLanes:
12E4: 3A 04 80        LD      A,($8004)           ; {hard.workRam+4}
12E7: A7              AND     A                   
12E8: C0              RET     NZ                  
12E9: 21 47 80        LD      HL,$8047            
12EC: 7E              LD      A,(HL)              
12ED: C6 0F           ADD     A,$0F               
12EF: 4F              LD      C,A                 
12F0: E6 0F           AND     $0F                 
12F2: FE 05           CP      $05                 
12F4: DA 2B 13        JP      C,$132B             ; {code.loc_132b}
12F7: 79              LD      A,C                 
12F8: E6 F0           AND     $F0                 
12FA: 0F              RRCA                        
12FB: 0F              RRCA                        
12FC: 0F              RRCA                        
12FD: 0F              RRCA                        
12FE: 6F              LD      L,A                 
12FF: 26 00           LD      H,$00               
1301: 01 0B 13        LD      BC,$130B            
1304: 29              ADD     HL,HL               
1305: 09              ADD     HL,BC               
1306: 4E              LD      C,(HL)              
1307: 23              INC     HL                  
1308: 66              LD      H,(HL)              
1309: 69              LD      L,C                 
130A: E9              JP      (HL)                

; ---- $130B-$132A: data ----
130B: 2B 13 2E 13 31 13 34 13 3C 13 44 13 4C 13 54 13
131B: 5C 13 64 13 6C 13 74 13 7C 13 84 13 8C 13 8C 13

loc_132b:
132B: C3 E1 13        JP      $13E1               ; {code.loc_13e1}

loc_132e:
132E: C3 E1 13        JP      $13E1               ; {code.loc_13e1}

loc_1331:
1331: C3 E1 13        JP      $13E1               ; {code.loc_13e1}

loc_1334:
1334: 21 00 81        LD      HL,$8100            
1337: 0E 3C           LD      C,$3C               
1339: C3 8F 13        JP      $138F               ; {code.loc_138f}

loc_133c:
133C: 21 09 81        LD      HL,$8109            
133F: 0E 1F           LD      C,$1F               
1341: C3 8F 13        JP      $138F               ; {code.loc_138f}

loc_1344:
1344: 21 12 81        LD      HL,$8112            
1347: 0E 5C           LD      C,$5C               
1349: C3 8F 13        JP      $138F               ; {code.loc_138f}

loc_134c:
134C: 21 1B 81        LD      HL,$811B            
134F: 0E 2C           LD      C,$2C               
1351: C3 8F 13        JP      $138F               ; {code.loc_138f}

loc_1354:
1354: 21 24 81        LD      HL,$8124            
1357: 0E 2F           LD      C,$2F               
1359: C3 8F 13        JP      $138F               ; {code.loc_138f}

loc_135c:
135C: C3 E1 13        JP      $13E1               ; {code.loc_13e1}

; ---- $135F-$1363: data ----
135F: 0E 17 C3 8F 13

loc_1364:
1364: 21 36 81        LD      HL,$8136            
1367: 0E 22           LD      C,$22               
1369: C3 8F 13        JP      $138F               ; {code.loc_138f}

loc_136c:
136C: 21 3F 81        LD      HL,$813F            
136F: 0E 12           LD      C,$12               
1371: C3 8F 13        JP      $138F               ; {code.loc_138f}

loc_1374:
1374: 21 48 81        LD      HL,$8148            
1377: 0E 12           LD      C,$12               
1379: C3 8F 13        JP      $138F               ; {code.loc_138f}

loc_137c:
137C: 21 51 81        LD      HL,$8151            
137F: 0E 12           LD      C,$12               
1381: C3 8F 13        JP      $138F               ; {code.loc_138f}

loc_1384:
1384: 21 5A 81        LD      HL,$815A            
1387: 0E 12           LD      C,$12               
1389: C3 8F 13        JP      $138F               ; {code.loc_138f}

loc_138c:
138C: C3 E1 13        JP      $13E1               ; {code.loc_13e1}

loc_138f:
138F: 3A 2F 80        LD      A,($802F)           ; {hard.workRam+2F}
1392: FE 80           CP      $80                 
1394: DA B9 13        JP      C,$13B9             ; {code.loc_13b9}
1397: 3A 44 80        LD      A,($8044)           ; {hard.workRam+44}
139A: C6 03           ADD     A,$03               

loc_139c:
139C: 57              LD      D,A                 
139D: 81              ADD     A,C                 
139E: 5F              LD      E,A                 
139F: 46              LD      B,(HL)              
13A0: DA C1 13        JP      C,$13C1             ; {code.loc_13c1}

loc_13a3:
13A3: 23              INC     HL                  
13A4: 7E              LD      A,(HL)              
13A5: BA              CP      D                   
13A6: DA D7 13        JP      C,$13D7             ; {code.loc_13d7}
13A9: BB              CP      E                   
13AA: D2 D7 13        JP      NC,$13D7            ; {code.loc_13d7}
13AD: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
13B0: FE 80           CP      $80                 
13B2: D8              RET     C                   
13B3: 3E 01           LD      A,$01               
13B5: 32 04 80        LD      ($8004),A           ; {hard.workRam+4}
13B8: C9              RET                         

loc_13b9:
13B9: 3A 44 80        LD      A,($8044)           ; {hard.workRam+44}
13BC: C6 0C           ADD     A,$0C               
13BE: C3 9C 13        JP      $139C               ; {code.loc_139c}

loc_13c1:
13C1: 23              INC     HL                  
13C2: 7E              LD      A,(HL)              
13C3: BA              CP      D                   
13C4: D2 CB 13        JP      NC,$13CB            ; {code.loc_13cb}
13C7: BB              CP      E                   
13C8: D2 E2 13        JP      NC,$13E2            ; {code.loc_13e2}

loc_13cb:
13CB: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
13CE: FE 80           CP      $80                 
13D0: D8              RET     C                   
13D1: 3E 01           LD      A,$01               
13D3: 32 04 80        LD      ($8004),A           ; {hard.workRam+4}
13D6: C9              RET                         

loc_13d7:
13D7: 10 CA           DJNZ    $13A3               ; {code.loc_13a3}
13D9: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
13DC: FE 80           CP      $80                 
13DE: DA D0 12        JP      C,$12D0             ; {code.killFrogAtLane}

loc_13e1:
13E1: C9              RET                         

loc_13e2:
13E2: 10 DD           DJNZ    $13C1               ; {code.loc_13c1}
13E4: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
13E7: FE 80           CP      $80                 
13E9: DA D0 12        JP      C,$12D0             ; {code.killFrogAtLane}
13EC: C9              RET                         

; ---- $13ED-$14B6: data ----
13ED: 06 A8 08 A8 0A A8 0C A8 0E A8 10 A8 12 A8 14 A8
13FD: 16 A8 18 A8 1A A8 5C 5D 5E 5F 58 59 5A 5B 58 59
140D: 5A 5B 54 55 56 57 10 10 10 10 D0 D1 D2 D3 CC CD
141D: CE CF C8 C9 CA CB 34 35 36 37 34 35 36 37 38 39
142D: 3A 3B 38 39 3A 3B 3C 3D 3E 3F 3C 3D 3E 3F 5C 5D
143D: 5E 5F 58 59 5A 5B 58 59 5A 5B 58 59 5A 5B 58 59
144D: 5A 5B 54 55 56 57 5C 5D 5E 5F 58 59 5A 5B 54 55
145D: 56 57 34 35 36 37 34 35 36 37 34 35 36 37 34 35
146D: 36 37 34 35 36 37 38 39 3A 3B 38 39 3A 3B 38 39
147D: 3A 3B 38 39 3A 3B 38 39 3A 3B 3C 3D 3E 3F 3C 3D
148D: 3E 3F 3C 3D 3E 3F 3C 3D 3E 3F 3C 3D 3E 3F 47 47
149D: 47 47 AC AD AE AF A8 A9 AA AB A0 A1 A2 A3 30 31
14AD: 32 33 A4 A5 A6 A7 50 51 52 53

; per-frame lane-object mover: walks the eleven lane objects (walk index
; LANE_OBJECT_INDEX 0x80FF, 0..10, wrapping to 0 at the end). Each object
; shifts its sprite run (SPRITE_BLOCK2_BASE 0x8100 +9i) and lead sprite
; (LIVE_OBJECT_PAGE 0x800C +4i) by its lane control byte's
; (ANIM_FRAME_BUFFER 0x819B +i) low-nibble speed -- rightward (objects
; 0/2/3/7/9) or leftward (1/4/6/8/10) -- unless the object's phase
; countdown (LANE_OBJECT_PHASE_TABLE 0x81A6 +i) or its control bit4 holds
; it, ticking the countdown so the lane steps at a sub-frame rate; object
; 5 is a spacer that only advances the walk. When the frog (row FROG_Y
; 0x8047 in [0x30,0x73), column matched to the object index) shares a
; moving object's cell it carries the frog X (FROG_X 0x8044) along,
; flagging it lost (HOLD_FLAG 0x8004=1) if the ride runs it off an edge.
moveLaneObjectsAndCarryFrog:
14B7: 3A FF 80        LD      A,($80FF)           ; {hard.workRam+FF}
14BA: 01 C7 14        LD      BC,$14C7            
14BD: 26 00           LD      H,$00               
14BF: 87              ADD     A,A                 
14C0: 6F              LD      L,A                 
14C1: 09              ADD     HL,BC               
14C2: 4E              LD      C,(HL)              
14C3: 23              INC     HL                  
14C4: 66              LD      H,(HL)              
14C5: 69              LD      L,C                 
14C6: E9              JP      (HL)                

; ---- $14C7-$14DC: data ----
14C7: DD 14 EE 14 FF 14 10 15 21 15 32 15 43 15 54 15
14D7: 65 15 76 15 87 15

loc_14dd:
14DD: 21 9B 81        LD      HL,$819B            
14E0: 11 00 81        LD      DE,$8100            
14E3: DD 21 0C 80     LD      IX,$800C            
14E7: FD 21 A6 81     LD      IY,$81A6            
14EB: C3 98 15        JP      $1598               ; {code.loc_1598}

loc_14ee:
14EE: 21 9C 81        LD      HL,$819C            
14F1: 11 09 81        LD      DE,$8109            
14F4: DD 21 10 80     LD      IX,$8010            
14F8: FD 21 A7 81     LD      IY,$81A7            
14FC: C3 3E 16        JP      $163E               ; {code.loc_163e}

loc_14ff:
14FF: 21 9D 81        LD      HL,$819D            
1502: 11 12 81        LD      DE,$8112            
1505: DD 21 14 80     LD      IX,$8014            
1509: FD 21 A8 81     LD      IY,$81A8            
150D: C3 98 15        JP      $1598               ; {code.loc_1598}

loc_1510:
1510: 21 9E 81        LD      HL,$819E            
1513: 11 1B 81        LD      DE,$811B            
1516: DD 21 18 80     LD      IX,$8018            
151A: FD 21 A9 81     LD      IY,$81A9            
151E: C3 98 15        JP      $1598               ; {code.loc_1598}

loc_1521:
1521: 21 9F 81        LD      HL,$819F            
1524: 11 24 81        LD      DE,$8124            
1527: DD 21 1C 80     LD      IX,$801C            
152B: FD 21 AA 81     LD      IY,$81AA            
152F: C3 3E 16        JP      $163E               ; {code.loc_163e}

loc_1532:
1532: C3 DE 15        JP      $15DE               ; {code.loc_15de}

; ---- $1535-$1542: data ----
1535: 11 2D 81 DD 21 20 80 FD 21 AB 81 C3 98 15

loc_1543:
1543: 21 A1 81        LD      HL,$81A1            
1546: 11 36 81        LD      DE,$8136            
1549: DD 21 24 80     LD      IX,$8024            
154D: FD 21 AC 81     LD      IY,$81AC            
1551: C3 3E 16        JP      $163E               ; {code.loc_163e}

loc_1554:
1554: 21 A2 81        LD      HL,$81A2            
1557: 11 3F 81        LD      DE,$813F            
155A: DD 21 28 80     LD      IX,$8028            
155E: FD 21 AD 81     LD      IY,$81AD            
1562: C3 98 15        JP      $1598               ; {code.loc_1598}

loc_1565:
1565: 21 A3 81        LD      HL,$81A3            
1568: 11 48 81        LD      DE,$8148            
156B: DD 21 2C 80     LD      IX,$802C            
156F: FD 21 AE 81     LD      IY,$81AE            
1573: C3 3E 16        JP      $163E               ; {code.loc_163e}

loc_1576:
1576: 21 A4 81        LD      HL,$81A4            
1579: 11 51 81        LD      DE,$8151            
157C: DD 21 30 80     LD      IX,$8030            
1580: FD 21 AF 81     LD      IY,$81AF            
1584: C3 98 15        JP      $1598               ; {code.loc_1598}

loc_1587:
1587: 21 A5 81        LD      HL,$81A5            
158A: 11 5A 81        LD      DE,$815A            
158D: DD 21 34 80     LD      IX,$8034            
1591: FD 21 B0 81     LD      IY,$81B0            
1595: C3 3E 16        JP      $163E               ; {code.loc_163e}

loc_1598:
1598: FD 7E 00        LD      A,(IY+$00)          
159B: 4F              LD      C,A                 
159C: A7              AND     A                   
159D: C2 D4 16        JP      NZ,$16D4            ; {code.loc_16d4}
15A0: 7E              LD      A,(HL)              
15A1: 47              LD      B,A                 
15A2: E6 0F           AND     $0F                 
15A4: 4F              LD      C,A                 
15A5: 78              LD      A,B                 
15A6: E6 10           AND     $10                 
15A8: C2 D4 16        JP      NZ,$16D4            ; {code.loc_16d4}

loc_15ab:
15AB: 1A              LD      A,(DE)              
15AC: 47              LD      B,A                 

loc_15ad:
15AD: 13              INC     DE                  
15AE: 1A              LD      A,(DE)              
15AF: 81              ADD     A,C                 
15B0: 12              LD      (DE),A              
15B1: 10 FA           DJNZ    $15AD               ; {code.loc_15ad}
15B3: DD 7E 00        LD      A,(IX+$00)          
15B6: 81              ADD     A,C                 
15B7: DD 77 00        LD      (IX+$00),A          
15BA: DD 77 02        LD      (IX+$02),A          
15BD: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
15C0: FE 30           CP      $30                 
15C2: DA DA 15        JP      C,$15DA             ; {code.loc_15da}
15C5: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
15C8: FE 73           CP      $73                 
15CA: D2 DA 15        JP      NC,$15DA            ; {code.loc_15da}
15CD: 47              LD      B,A                 
15CE: E6 0F           AND     $0F                 
15D0: FE 03           CP      $03                 
15D2: DA EB 15        JP      C,$15EB             ; {code.loc_15eb}
15D5: FE 0C           CP      $0C                 
15D7: D2 1F 16        JP      NC,$161F            ; {code.loc_161f}

loc_15da:
15DA: FD 36 00 00     LD      (IY+$00),$00        

loc_15de:
15DE: 21 FF 80        LD      HL,$80FF            
15E1: 34              INC     (HL)                
15E2: 7E              LD      A,(HL)              
15E3: FE 0B           CP      $0B                 
15E5: DA B7 14        JP      C,$14B7             ; {code.moveLaneObjectsAndCarryFrog}
15E8: 36 00           LD      (HL),$00            
15EA: C9              RET                         

loc_15eb:
15EB: 78              LD      A,B                 
15EC: E6 F0           AND     $F0                 
15EE: 08              EX      AF,AF'              
15EF: 08              EX      AF,AF'              
15F0: D6 30           SUB     $30                 
15F2: 0F              RRCA                        
15F3: 0F              RRCA                        
15F4: 0F              RRCA                        
15F5: 0F              RRCA                        
15F6: 47              LD      B,A                 
15F7: 3A FF 80        LD      A,($80FF)           ; {hard.workRam+FF}
15FA: B8              CP      B                   
15FB: C2 DA 15        JP      NZ,$15DA            ; {code.loc_15da}
15FE: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1601: FE 30           CP      $30                 
1603: DA DA 15        JP      C,$15DA             ; {code.loc_15da}
1606: 3A 44 80        LD      A,($8044)           ; {hard.workRam+44}
1609: 81              ADD     A,C                 
160A: 32 44 80        LD      ($8044),A           ; {hard.workRam+44}
160D: FE 08           CP      $08                 
160F: DA 17 16        JP      C,$1617             ; {code.loc_1617}
1612: FE E7           CP      $E7                 
1614: DA DA 15        JP      C,$15DA             ; {code.loc_15da}

loc_1617:
1617: 3E 01           LD      A,$01               
1619: 32 04 80        LD      ($8004),A           ; {hard.workRam+4}
161C: C3 DA 15        JP      $15DA               ; {code.loc_15da}

loc_161f:
161F: 78              LD      A,B                 
1620: E6 F0           AND     $F0                 
1622: C6 10           ADD     A,$10               
1624: 08              EX      AF,AF'              
1625: 08              EX      AF,AF'              
1626: D6 30           SUB     $30                 
1628: 0F              RRCA                        
1629: 0F              RRCA                        
162A: 0F              RRCA                        
162B: 0F              RRCA                        
162C: 47              LD      B,A                 
162D: 3A FF 80        LD      A,($80FF)           ; {hard.workRam+FF}
1630: B8              CP      B                   
1631: C2 DA 15        JP      NZ,$15DA            ; {code.loc_15da}
1634: 3A 44 80        LD      A,($8044)           ; {hard.workRam+44}
1637: 81              ADD     A,C                 
1638: 32 44 80        LD      ($8044),A           ; {hard.workRam+44}
163B: C3 DA 15        JP      $15DA               ; {code.loc_15da}

loc_163e:
163E: FD 7E 00        LD      A,(IY+$00)          
1641: 4F              LD      C,A                 
1642: A7              AND     A                   
1643: C2 E6 16        JP      NZ,$16E6            ; {code.loc_16e6}
1646: 7E              LD      A,(HL)              
1647: 47              LD      B,A                 
1648: E6 0F           AND     $0F                 
164A: 4F              LD      C,A                 
164B: 78              LD      A,B                 
164C: E6 10           AND     $10                 
164E: C2 E6 16        JP      NZ,$16E6            ; {code.loc_16e6}

loc_1651:
1651: 1A              LD      A,(DE)              
1652: 47              LD      B,A                 

loc_1653:
1653: 13              INC     DE                  
1654: 1A              LD      A,(DE)              
1655: 91              SUB     C                   
1656: 12              LD      (DE),A              
1657: 10 FA           DJNZ    $1653               ; {code.loc_1653}
1659: DD 7E 00        LD      A,(IX+$00)          
165C: 91              SUB     C                   
165D: DD 77 00        LD      (IX+$00),A          
1660: DD 77 02        LD      (IX+$02),A          
1663: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1666: FE 73           CP      $73                 
1668: D2 78 16        JP      NC,$1678            ; {code.loc_1678}
166B: 47              LD      B,A                 
166C: E6 0F           AND     $0F                 
166E: FE 03           CP      $03                 
1670: DA 89 16        JP      C,$1689             ; {code.loc_1689}
1673: FE 0C           CP      $0C                 
1675: D2 B5 16        JP      NC,$16B5            ; {code.loc_16b5}

loc_1678:
1678: FD 36 00 00     LD      (IY+$00),$00        

loc_167c:
167C: 21 FF 80        LD      HL,$80FF            
167F: 34              INC     (HL)                
1680: 7E              LD      A,(HL)              
1681: FE 0B           CP      $0B                 
1683: DA B7 14        JP      C,$14B7             ; {code.moveLaneObjectsAndCarryFrog}
1686: 36 00           LD      (HL),$00            
1688: C9              RET                         

loc_1689:
1689: 78              LD      A,B                 
168A: E6 F0           AND     $F0                 
168C: 08              EX      AF,AF'              
168D: 08              EX      AF,AF'              
168E: D6 30           SUB     $30                 
1690: 0F              RRCA                        
1691: 0F              RRCA                        
1692: 0F              RRCA                        
1693: 0F              RRCA                        
1694: 47              LD      B,A                 
1695: 3A FF 80        LD      A,($80FF)           ; {hard.workRam+FF}
1698: B8              CP      B                   
1699: C2 78 16        JP      NZ,$1678            ; {code.loc_1678}
169C: 3A 44 80        LD      A,($8044)           ; {hard.workRam+44}
169F: 91              SUB     C                   
16A0: 32 44 80        LD      ($8044),A           ; {hard.workRam+44}
16A3: FE 08           CP      $08                 
16A5: DA AD 16        JP      C,$16AD             ; {code.loc_16ad}
16A8: FE E7           CP      $E7                 
16AA: DA 78 16        JP      C,$1678             ; {code.loc_1678}

loc_16ad:
16AD: 3E 01           LD      A,$01               
16AF: 32 04 80        LD      ($8004),A           ; {hard.workRam+4}
16B2: C3 78 16        JP      $1678               ; {code.loc_1678}

loc_16b5:
16B5: 78              LD      A,B                 
16B6: E6 F0           AND     $F0                 
16B8: C6 10           ADD     A,$10               
16BA: 08              EX      AF,AF'              
16BB: 08              EX      AF,AF'              
16BC: D6 30           SUB     $30                 
16BE: 0F              RRCA                        
16BF: 0F              RRCA                        
16C0: 0F              RRCA                        
16C1: 0F              RRCA                        
16C2: 47              LD      B,A                 
16C3: 3A FF 80        LD      A,($80FF)           ; {hard.workRam+FF}
16C6: B8              CP      B                   
16C7: C2 78 16        JP      NZ,$1678            ; {code.loc_1678}
16CA: 3A 44 80        LD      A,($8044)           ; {hard.workRam+44}
16CD: 91              SUB     C                   
16CE: 32 44 80        LD      ($8044),A           ; {hard.workRam+44}
16D1: C3 78 16        JP      $1678               ; {code.loc_1678}

loc_16d4:
16D4: 79              LD      A,C                 
16D5: FE 01           CP      $01                 
16D7: C2 DF 16        JP      NZ,$16DF            ; {code.loc_16df}
16DA: 0E 01           LD      C,$01               
16DC: C3 AB 15        JP      $15AB               ; {code.loc_15ab}

loc_16df:
16DF: 0D              DEC     C                   
16E0: FD 71 00        LD      (IY+$00),C          
16E3: C3 DE 15        JP      $15DE               ; {code.loc_15de}

loc_16e6:
16E6: 79              LD      A,C                 
16E7: FE 01           CP      $01                 
16E9: C2 F1 16        JP      NZ,$16F1            ; {code.loc_16f1}
16EC: 0E 01           LD      C,$01               
16EE: C3 51 16        JP      $1651               ; {code.loc_1651}

loc_16f1:
16F1: 0D              DEC     C                   
16F2: FD 71 00        LD      (IY+$00),C          
16F5: C3 7C 16        JP      $167C               ; {code.loc_167c}

; frog death / hop-complete animation driver, gated by the hold flag
; HOLD_FLAG (0x8004) -- an idle frog returns at once. Mirrors two anim
; latches (FIGURE_ANIM_STEP_GATE 0x8150 bit0 -> FROG_ANIM_BLIT_TRIGGER
; 0x8118; HOME_BAY_SLOT_CURSOR_MIRROR 0x8120 -> PENDING_HOME_BAY_SLOT
; 0x8121), runs the home-bay slot stamp and the collision reset
; (clearLatchedCollision), then ticks the hop-frame counter
; HOP_FRAME_COUNTER (0x8247); only when it reaches 0x10 does it reload the
; counter, advance the death phase DEATH_PHASE (0x81B2), and dispatch --
; at the terminal phase (6, or 5 when SECOND_BANK 0x829C is set) it
; activates the frog and clears the death/hop state (raising
; LIFE_RESTART_FLAG 0x83CE, and in the attract demo resetting the board-
; state cells), otherwise it pokes the phase's death sprite into
; FROG_SPRITE_CODE (0x8045) and queues the death jingle. Memory-only
driveFrogDeathAnimation:
16F8: 3A 04 80        LD      A,($8004)           ; {hard.workRam+4}
16FB: A7              AND     A                   
16FC: C8              RET     Z                   
16FD: 3A 50 81        LD      A,($8150)           ; {hard.workRam+150}
1700: CB 47           BIT     0,A                 
1702: 28 05           JR      Z,$1709             ; {code.loc_1709}
1704: 3E 01           LD      A,$01               
1706: 32 18 81        LD      ($8118),A           ; {hard.workRam+118}

loc_1709:
1709: 3A 20 81        LD      A,($8120)           ; {hard.workRam+120}
170C: A7              AND     A                   
170D: 28 03           JR      Z,$1712             ; {code.loc_1712}
170F: 32 21 81        LD      ($8121),A           ; {hard.workRam+121}

loc_1712:
1712: CD CE 25        CALL    $25CE               ; {code.stampHomeBaySlot}
1715: CD B3 27        CALL    $27B3               ; {code.clearLatchedCollision}
1718: 3A 47 82        LD      A,($8247)           ; {hard.workRam+247}
171B: 3C              INC     A                   
171C: 32 47 82        LD      ($8247),A           ; {hard.workRam+247}
171F: D6 10           SUB     $10                 
1721: C0              RET     NZ                  
1722: 32 47 82        LD      ($8247),A           ; {hard.workRam+247}
1725: 3E 07           LD      A,$07               
1727: 32 46 80        LD      ($8046),A           ; {hard.workRam+46}
172A: 21 44 80        LD      HL,$8044            
172D: 3A B2 81        LD      A,($81B2)           ; {hard.workRam+1B2}
1730: 3C              INC     A                   
1731: 32 B2 81        LD      ($81B2),A           ; {hard.workRam+1B2}
1734: 4F              LD      C,A                 
1735: 3A 9C 82        LD      A,($829C)           ; {hard.workRam+29C}
1738: A7              AND     A                   
1739: C2 7D 17        JP      NZ,$177D            ; {code.loc_177d}
173C: 79              LD      A,C                 
173D: FE 06           CP      $06                 
173F: 20 44           JR      NZ,$1785            ; {code.loc_1785}

loc_1741:
1741: CD 04 08        CALL    $0804               ; {code.activateFrogObject}
1744: AF              XOR     A                   
1745: 32 B2 81        LD      ($81B2),A           ; {hard.workRam+1B2}
1748: 32 04 80        LD      ($8004),A           ; {hard.workRam+4}
174B: 32 47 82        LD      ($8247),A           ; {hard.workRam+247}
174E: 32 69 82        LD      ($8269),A           ; {hard.workRam+269}
1751: 32 9C 82        LD      ($829C),A           ; {hard.workRam+29C}
1754: 21 48 82        LD      HL,$8248            
1757: 11 49 82        LD      DE,$8249            
175A: 01 0B 00        LD      BC,$000B            
175D: 77              LD      (HL),A              
175E: ED B0           LDIR                        
1760: 3C              INC     A                   
1761: 32 CE 83        LD      ($83CE),A           ; {hard.workRam+3CE}
1764: 3A D6 83        LD      A,($83D6)           ; {hard.workRam+3D6}
1767: 3D              DEC     A                   
1768: 20 12           JR      NZ,$177C            ; {code.loc_177c}
176A: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
176D: A7              AND     A                   
176E: 20 0C           JR      NZ,$177C            ; {code.loc_177c}
1770: 32 D6 83        LD      ($83D6),A           ; {hard.workRam+3D6}
1773: 32 99 82        LD      ($8299),A           ; {hard.workRam+299}
1776: 32 9A 82        LD      ($829A),A           ; {hard.workRam+29A}
1779: 32 5B 82        LD      ($825B),A           ; {hard.workRam+25B}

loc_177c:
177C: C9              RET                         

loc_177d:
177D: 79              LD      A,C                 
177E: FE 05           CP      $05                 
1780: 20 03           JR      NZ,$1785            ; {code.loc_1785}
1782: C3 41 17        JP      $1741               ; {code.loc_1741}

loc_1785:
1785: 3A 9C 82        LD      A,($829C)           ; {hard.workRam+29C}
1788: A7              AND     A                   
1789: C2 C4 17        JP      NZ,$17C4            ; {code.loc_17c4}
178C: 23              INC     HL                  
178D: 3A B2 81        LD      A,($81B2)           ; {hard.workRam+1B2}
1790: 3D              DEC     A                   
1791: 28 0B           JR      Z,$179E             ; {code.loc_179e}
1793: 3D              DEC     A                   
1794: 28 15           JR      Z,$17AB             ; {code.loc_17ab}
1796: 3D              DEC     A                   
1797: 28 15           JR      Z,$17AE             ; {code.loc_17ae}
1799: 3D              DEC     A                   
179A: 28 15           JR      Z,$17B1             ; {code.loc_17b1}
179C: 18 16           JR      $17B4               ; {code.loc_17b4}

loc_179e:
179E: 36 39           LD      (HL),$39            
17A0: AF              XOR     A                   
17A1: 67              LD      H,A                 
17A2: 6F              LD      L,A                 
17A3: 22 82 83        LD      ($8382),HL          ; {hard.workRam+382}
17A6: DF              RST     $18                 
17A7: 3E 03           LD      A,$03               
17A9: DF              RST     $18                 
17AA: C9              RET                         

loc_17ab:
17AB: 36 39           LD      (HL),$39            
17AD: C9              RET                         

loc_17ae:
17AE: 36 3A           LD      (HL),$3A            
17B0: C9              RET                         

loc_17b1:
17B1: 36 3B           LD      (HL),$3B            
17B3: C9              RET                         

loc_17b4:
17B4: 36 3C           LD      (HL),$3C            
17B6: AF              XOR     A                   
17B7: 32 AE 83        LD      ($83AE),A           ; {hard.workRam+3AE}
17BA: CD 56 28        CALL    $2856               ; {code.clearTwoPlayerFrameCells}
17BD: 21 D8 00        LD      HL,$00D8            
17C0: 22 82 83        LD      ($8382),HL          ; {hard.workRam+382}
17C3: C9              RET                         

loc_17c4:
17C4: 23              INC     HL                  
17C5: 3A B2 81        LD      A,($81B2)           ; {hard.workRam+1B2}
17C8: 3D              DEC     A                   
17C9: 28 08           JR      Z,$17D3             ; {code.loc_17d3}
17CB: 3D              DEC     A                   
17CC: 28 12           JR      Z,$17E0             ; {code.loc_17e0}
17CE: 3D              DEC     A                   
17CF: 28 12           JR      Z,$17E3             ; {code.loc_17e3}
17D1: 18 13           JR      $17E6               ; {code.loc_17e6}

loc_17d3:
17D3: 36 22           LD      (HL),$22            
17D5: AF              XOR     A                   
17D6: 67              LD      H,A                 
17D7: 6F              LD      L,A                 
17D8: 22 82 83        LD      ($8382),HL          ; {hard.workRam+382}
17DB: DF              RST     $18                 
17DC: 3E 02           LD      A,$02               
17DE: DF              RST     $18                 
17DF: C9              RET                         

loc_17e0:
17E0: 36 23           LD      (HL),$23            
17E2: C9              RET                         

loc_17e3:
17E3: 36 24           LD      (HL),$24            
17E5: C9              RET                         

loc_17e6:
17E6: 36 3C           LD      (HL),$3C            
17E8: AF              XOR     A                   
17E9: 32 AE 83        LD      ($83AE),A           ; {hard.workRam+3AE}
17EC: 32 10 81        LD      ($8110),A           ; {hard.workRam+110}
17EF: 32 07 81        LD      ($8107),A           ; {hard.workRam+107}
17F2: 32 1A 81        LD      ($811A),A           ; {hard.workRam+11A}
17F5: 32 19 81        LD      ($8119),A           ; {hard.workRam+119}
17F8: CD 56 28        CALL    $2856               ; {code.clearTwoPlayerFrameCells}
17FB: 21 D8 00        LD      HL,$00D8            
17FE: 22 82 83        LD      ($8382),HL          ; {hard.workRam+382}
1801: C9              RET                         

; step the frame-cell animation: return early while either busy latch
; (SPRITE_FRAME_BUSY_LATCH1 0x814F / SPRITE_FRAME_BUSY_LATCH2 0x815B) is
; set; else tick the frame timer ANIM_FRAME_TIMER (0x81B4) down, and when
; it reaches 0 reload it to 21, advance the frame index ANIM_FRAME_INDEX
; (0x81B3) wrapping to 0 at 10, and copy the eleven bytes of the indexed
; frame (via the pointer table ANIM_FRAME_SRC_PTR_TABLE 0x1841) into the
; buffer ANIM_FRAME_BUFFER (0x819B). Memory-only
advanceAnimationFrameBuffer:
1802: 3A 4F 81        LD      A,($814F)           ; {hard.workRam+14F}
1805: A7              AND     A                   
1806: C0              RET     NZ                  
1807: 3A 5B 81        LD      A,($815B)           ; {hard.workRam+15B}
180A: A7              AND     A                   
180B: C0              RET     NZ                  
180C: 3A B4 81        LD      A,($81B4)           ; {hard.workRam+1B4}
180F: A7              AND     A                   
1810: C2 32 18        JP      NZ,$1832            ; {code.loc_1832}
1813: 67              LD      H,A                 
1814: 3A B3 81        LD      A,($81B3)           ; {hard.workRam+1B3}
1817: 6F              LD      L,A                 
1818: 11 41 18        LD      DE,$1841            
181B: 29              ADD     HL,HL               
181C: 19              ADD     HL,DE               
181D: 4E              LD      C,(HL)              
181E: 23              INC     HL                  
181F: 66              LD      H,(HL)              
1820: 69              LD      L,C                 
1821: EB              EX      DE,HL               
1822: 21 B3 81        LD      HL,$81B3            
1825: 34              INC     (HL)                
1826: 7E              LD      A,(HL)              
1827: 23              INC     HL                  
1828: 36 15           LD      (HL),$15            
182A: D6 0A           SUB     $0A                 
182C: C2 37 18        JP      NZ,$1837            ; {code.loc_1837}
182F: 2B              DEC     HL                  
1830: 77              LD      (HL),A              
1831: C9              RET                         

loc_1832:
1832: 21 B4 81        LD      HL,$81B4            
1835: 35              DEC     (HL)                
1836: C9              RET                         

loc_1837:
1837: EB              EX      DE,HL               
1838: 11 9B 81        LD      DE,$819B            
183B: 01 0B 00        LD      BC,$000B            
183E: ED B0           LDIR                        
1840: C9              RET                         

; ---- $1841-$1951: data ----
1841: 6B 18 76 18 81 18 8C 18 97 18 A2 18 AD 18 B8 18
1851: C3 18 CE 18 D9 18 E4 18 EF 18 FA 18 05 19 10 19
1861: 1B 19 26 19 31 19 3C 19 47 19 13 12 11 16 12 00
1871: 12 13 14 15 16 12 13 12 15 01 00 13 02 12 13 12
1881: 12 12 13 14 12 00 12 01 13 12 13 12 01 12 13 13
1891: 00 12 02 12 01 14 13 12 01 12 12 00 12 01 01 12
18A1: 13 13 01 12 13 13 00 01 02 12 13 12 12 12 13 12
18B1: 12 00 12 01 13 12 13 13 13 12 13 01 00 13 02 12
18C1: 01 12 12 12 13 12 12 00 12 01 01 12 13 13 01 12
18D1: 01 13 00 01 02 12 13 13 12 12 01 12 12 00 01 01
18E1: 13 12 12 01 13 01 13 01 00 12 01 12 01 01 12 12
18F1: 01 12 12 00 01 02 13 12 01 01 12 01 12 01 00 01
1901: 03 12 01 12 12 12 01 12 12 00 01 02 13 12 12 01
1911: 01 12 01 12 00 01 01 12 01 01 01 01 12 01 12 00
1921: 01 01 12 01 01 12 01 13 12 01 00 12 02 01 12 12
1931: 01 12 14 01 12 00 01 03 12 13 01 12 01 13 12 13
1941: 00 12 02 13 12 12 13 12 12 13 12 00 13 01 14 13
1951: 14

; board-init frog/object render (fires at board start): copies three
; 4-tile groups down VRAM columns -- FROG_RENDER_TILES_G1 into
; FROG_RENDER_VRAM_COL_G1 (0xA843, 5 columns), G2 into
; FROG_RENDER_VRAM_COL_G2 (0xA8A4, 4 columns), G3 into
; FROG_RENDER_VRAM_COL_G3 (0xA8A5, 4 columns); stamps the banner column
; (tile 0x47 at FROG_RENDER_BANNER_VRAM 0xA8C3) and the box corners (tiles
; 65/66 top, 69/70 bottom at FROG_RENDER_BOX_VRAM_CORNER 0xA844); blits
; the home-marker tile column at FROG_RENDER_HOME_MARKER_VRAM (0xA85C) via
; blitFourTileGroupColumn; raises the three object-ready flags
; OBJECT_READY_0/1/2 (0x8007/0x8009/0x800B); then tail-chains the object-
; anim seed (seedObjectAnimationState). Memory-only
renderFrogAndArmObjects:
1952: 21 43 A8        LD      HL,$A843            
1955: 0E 05           LD      C,$05               

loc_1957:
1957: 11 F6 19        LD      DE,$19F6            
195A: 06 04           LD      B,$04               

loc_195c:
195C: 1A              LD      A,(DE)              
195D: 77              LD      (HL),A              
195E: 13              INC     DE                  
195F: C5              PUSH    BC                  
1960: 01 20 00        LD      BC,$0020            
1963: 09              ADD     HL,BC               
1964: C1              POP     BC                  
1965: 10 F5           DJNZ    $195C               ; {code.loc_195c}
1967: 11 40 00        LD      DE,$0040            
196A: 19              ADD     HL,DE               
196B: 0D              DEC     C                   
196C: C2 57 19        JP      NZ,$1957            ; {code.loc_1957}
196F: 21 A4 A8        LD      HL,$A8A4            
1972: 0E 04           LD      C,$04               

loc_1974:
1974: 11 FA 19        LD      DE,$19FA            
1977: 06 04           LD      B,$04               

loc_1979:
1979: 1A              LD      A,(DE)              
197A: 77              LD      (HL),A              
197B: 13              INC     DE                  
197C: C5              PUSH    BC                  
197D: 01 20 00        LD      BC,$0020            
1980: 09              ADD     HL,BC               
1981: C1              POP     BC                  
1982: 10 F5           DJNZ    $1979               ; {code.loc_1979}
1984: 11 40 00        LD      DE,$0040            
1987: 19              ADD     HL,DE               
1988: 0D              DEC     C                   
1989: C2 74 19        JP      NZ,$1974            ; {code.loc_1974}
198C: 21 A5 A8        LD      HL,$A8A5            
198F: 0E 04           LD      C,$04               

loc_1991:
1991: 11 FE 19        LD      DE,$19FE            
1994: 06 04           LD      B,$04               

loc_1996:
1996: 1A              LD      A,(DE)              
1997: 77              LD      (HL),A              
1998: 13              INC     DE                  
1999: C5              PUSH    BC                  
199A: 01 20 00        LD      BC,$0020            
199D: 09              ADD     HL,BC               
199E: C1              POP     BC                  
199F: 10 F5           DJNZ    $1996               ; {code.loc_1996}
19A1: 11 40 00        LD      DE,$0040            
19A4: 19              ADD     HL,DE               
19A5: 0D              DEC     C                   
19A6: C2 91 19        JP      NZ,$1991            ; {code.loc_1991}
19A9: 21 C3 A8        LD      HL,$A8C3            
19AC: 06 04           LD      B,$04               

loc_19ae:
19AE: 36 47           LD      (HL),$47            
19B0: 11 20 00        LD      DE,$0020            
19B3: 19              ADD     HL,DE               
19B4: 36 47           LD      (HL),$47            
19B6: 11 A0 00        LD      DE,$00A0            
19B9: 19              ADD     HL,DE               
19BA: 10 F2           DJNZ    $19AE               ; {code.loc_19ae}
19BC: 21 44 A8        LD      HL,$A844            
19BF: 36 41           LD      (HL),$41            
19C1: 23              INC     HL                  
19C2: 36 42           LD      (HL),$42            
19C4: 01 5F 03        LD      BC,$035F            
19C7: 09              ADD     HL,BC               
19C8: 36 45           LD      (HL),$45            
19CA: 23              INC     HL                  
19CB: 36 46           LD      (HL),$46            
19CD: 21 5C A8        LD      HL,$A85C            
19D0: CD E2 19        CALL    $19E2               ; {code.blitFourTileGroupColumn}
19D3: 21 07 80        LD      HL,$8007            
19D6: 3E 01           LD      A,$01               
19D8: 77              LD      (HL),A              
19D9: 2C              INC     L                   
19DA: 2C              INC     L                   
19DB: 77              LD      (HL),A              
19DC: 2C              INC     L                   
19DD: 2C              INC     L                   
19DE: 77              LD      (HL),A              
19DF: C3 02 1A        JP      $1A02               ; {code.seedObjectAnimationState}

; blit a 14-row VRAM column of the 4-tile group from the caller-supplied
; base (HL): tiles 72/73 across the top of each row pair and 74/75 across
; the row below it, advancing 64 bytes per pair. HL live-in, memory-only
blitFourTileGroupColumn:
19E2: 06 0E           LD      B,$0E               

loc_19e4:
19E4: 36 48           LD      (HL),$48            
19E6: 23              INC     HL                  
19E7: 36 49           LD      (HL),$49            
19E9: 11 1F 00        LD      DE,$001F            
19EC: 19              ADD     HL,DE               
19ED: 36 4A           LD      (HL),$4A            
19EF: 23              INC     HL                  
19F0: 36 4B           LD      (HL),$4B            
19F2: 19              ADD     HL,DE               
19F3: 10 EF           DJNZ    $19E4               ; {code.loc_19e4}
19F5: C9              RET                         

; ---- $19F6-$1A01: data ----
19F6: 40 43 43 44 45 47 47 41 46 43 43 42

; seed the object-animation state at board init: fill 14 stride-2 cells
; from OBJECT_ANIM_STATE_8021 (0x8021) and 10 stride-2 cells from
; OBJECT_ANIM_STATE_800D (0x800D) with fixed seed tables (cell i takes
; seed i). Memory-only
seedObjectAnimationState:
1A02: 3E 05           LD      A,$05               
1A04: 32 25 80        LD      ($8025),A           ; {hard.workRam+25}
1A07: 32 27 80        LD      ($8027),A           ; {hard.workRam+27}
1A0A: 3E 04           LD      A,$04               
1A0C: 32 2D 80        LD      ($802D),A           ; {hard.workRam+2D}
1A0F: 32 2F 80        LD      ($802F),A           ; {hard.workRam+2F}
1A12: 3E 07           LD      A,$07               
1A14: 32 35 80        LD      ($8035),A           ; {hard.workRam+35}
1A17: 32 37 80        LD      ($8037),A           ; {hard.workRam+37}
1A1A: 3E 06           LD      A,$06               
1A1C: 32 21 80        LD      ($8021),A           ; {hard.workRam+21}
1A1F: 32 23 80        LD      ($8023),A           ; {hard.workRam+23}
1A22: 32 39 80        LD      ($8039),A           ; {hard.workRam+39}
1A25: 32 3B 80        LD      ($803B),A           ; {hard.workRam+3B}
1A28: 3E 05           LD      A,$05               
1A2A: 06 0A           LD      B,$0A               
1A2C: 21 0D 80        LD      HL,$800D            

loc_1a2f:
1A2F: 77              LD      (HL),A              
1A30: 23              INC     HL                  
1A31: 23              INC     HL                  
1A32: 10 FB           DJNZ    $1A2F               ; {code.loc_1a2f}
1A34: 32 29 80        LD      ($8029),A           ; {hard.workRam+29}
1A37: 32 2B 80        LD      ($802B),A           ; {hard.workRam+2B}
1A3A: 32 31 80        LD      ($8031),A           ; {hard.workRam+31}
1A3D: 32 33 80        LD      ($8033),A           ; {hard.workRam+33}
1A40: 3E 02           LD      A,$02               
1A42: 32 0D 80        LD      ($800D),A           ; {hard.workRam+D}
1A45: 32 0F 80        LD      ($800F),A           ; {hard.workRam+F}
1A48: 32 15 80        LD      ($8015),A           ; {hard.workRam+15}
1A4B: 32 17 80        LD      ($8017),A           ; {hard.workRam+17}
1A4E: 32 19 80        LD      ($8019),A           ; {hard.workRam+19}
1A51: 32 1B 80        LD      ($801B),A           ; {hard.workRam+1B}
1A54: C9              RET                         

; master in-play collision/scoring orchestrator, run each frame: a clear
; play flag (PLAY_FLAG 0x83FE) tails straight to the shared exit;
; otherwise it runs the collision/animation sub-engines (two-pair-figure
; mount + animate, dive driver, fly-eat, lane-scroll sound), ticks the
; goal-sprite arm cell HOME_GOAL_SPRITE_ARM_CELL (0x8340) and the home-bay
; slot cursor, then -- chosen by bit0 of the level/life count LIVES_COUNT
; (0x83B7) -- runs the gator/slot arm or the fly/slot arm, each bumping
; SCROLL_TIMER_COUNTER (0x8122) and stamping the home-bay gator/fly/slot
; at its phase marks. The shared exit routes a frog on the home row
; (FROG_Y 0x8047 < 0x31) to the goal handler (selectHomeBayGoalHandler),
; else runs the frog input scan (scanFrogInputAndDispatchHop). Memory-only
orchestrateCollisionsAndFrogInput:
1A55: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
1A58: B7              OR      A                   
1A59: 28 34           JR      Z,$1A8F             ; {code.loc_1a8f}
1A5B: CD BB 28        CALL    $28BB               ; {code.mountOrKillFrogOnTwoPairFigure}
1A5E: CD 1D 29        CALL    $291D               ; {code.animateTwoPairFigure}
1A61: CD EA 27        CALL    $27EA               ; {code.loc_27ea}
1A64: CD A6 26        CALL    $26A6               ; {code.animateFlyEatCollision}
1A67: CD 06 29        CALL    $2906               ; {code.enqueueLaneScrollSyncedCommand}
1A6A: 3A 40 83        LD      A,($8340)           ; {hard.workRam+340}
1A6D: A7              AND     A                   
1A6E: C4 9F 1A        CALL    NZ,$1A9F            ; {code.loc_1a9f}
1A71: CD EB 23        CALL    $23EB               ; {code.loc_23eb}
1A74: 3A B7 83        LD      A,($83B7)           ; {hard.workRam+3B7}
1A77: CB 47           BIT     0,A                 
1A79: CA AD 1A        JP      Z,$1AAD             ; {code.loc_1aad}
1A7C: 3A 22 81        LD      A,($8122)           ; {hard.workRam+122}
1A7F: 3C              INC     A                   
1A80: 32 22 81        LD      ($8122),A           ; {hard.workRam+122}
1A83: A7              AND     A                   
1A84: CC FA 23        CALL    Z,$23FA             ; {code.stampHomeBayFly}
1A87: 3A 22 81        LD      A,($8122)           ; {hard.workRam+122}
1A8A: FE 70           CP      $70                 
1A8C: CC CE 25        CALL    Z,$25CE             ; {code.stampHomeBaySlot}

loc_1a8f:
1A8F: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1A92: FE 31           CP      $31                 
1A94: DA FF 1C        JP      C,$1CFF             ; {code.selectHomeBayGoalHandler}
1A97: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
1A9A: B7              OR      A                   
1A9B: C8              RET     Z                   
1A9C: C3 CB 1A        JP      $1ACB               ; {code.scanFrogInputAndDispatchHop}

loc_1a9f:
1A9F: 3D              DEC     A                   
1AA0: 32 40 83        LD      ($8340),A           ; {hard.workRam+340}
1AA3: FE 01           CP      $01                 
1AA5: C0              RET     NZ                  
1AA6: CD 9A 26        CALL    $269A               ; {code.clearFourByteCounterBlock}
1AA9: CD DE 27        CALL    $27DE               ; {code.clearFlySpriteBlock}
1AAC: C9              RET                         

loc_1aad:
1AAD: 3A 22 81        LD      A,($8122)           ; {hard.workRam+122}
1AB0: 3C              INC     A                   
1AB1: 32 22 81        LD      ($8122),A           ; {hard.workRam+122}
1AB4: A7              AND     A                   
1AB5: CC 96 24        CALL    Z,$2496             ; {code.stampHomeBayGatorEmerging}
1AB8: 3A 22 81        LD      A,($8122)           ; {hard.workRam+122}
1ABB: FE 50           CP      $50                 
1ABD: CC 32 25        CALL    Z,$2532             ; {code.stampHomeBayGatorFull}
1AC0: 3A 22 81        LD      A,($8122)           ; {hard.workRam+122}
1AC3: FE B0           CP      $B0                 
1AC5: CC CE 25        CALL    Z,$25CE             ; {code.stampHomeBaySlot}
1AC8: C3 8F 1A        JP      $1A8F               ; {code.loc_1a8f}

; per-vblank frog input scan + directional hop dispatcher: returns while
; input is locked -- the transition gate GATED_COUNTDOWN_ENABLE_FLAG
; (0x826C) set, or the hop-input timer FROG_HOP_INPUT_TIMER (0x8268) still
; counting (decrement it and tick the home-bay slot cursor), or the hold
; flag HOLD_FLAG (0x8004) set. Otherwise, with the frog X/Y cursors armed,
; it reads the active player's joystick and for DOWN/UP/RIGHT/LEFT tail-
; dispatches that direction's advance handler when its *_ACTIVE flag is
; set, its begin handler on a fresh press, else clears that direction's
; *_ARRIVAL and *_ANIM_COUNTER cells; UP is skipped once RIGHT or LEFT is
; already hopping. Player routing keys on IN2 bit3 (cocktail) with
; ACTIVE_PLAYER (0x83FD): RIGHT/LEFT read the player's main port (P1
; IN0_PORT, P2 IN1_PORT) bits 4/5, DOWN/UP read IN2_PORT for P1 (bits 6/4)
; but cross to IN2 bit0 / IN0 bit0 for P2. Memory-only
scanFrogInputAndDispatchHop:
1ACB: 3A 6C 82        LD      A,($826C)           ; {hard.workRam+26C}
1ACE: A7              AND     A                   
1ACF: C0              RET     NZ                  
1AD0: 3A 68 82        LD      A,($8268)           ; {hard.workRam+268}
1AD3: A7              AND     A                   
1AD4: 28 08           JR      Z,$1ADE             ; {code.loc_1ade}
1AD6: 3D              DEC     A                   
1AD7: 32 68 82        LD      ($8268),A           ; {hard.workRam+268}
1ADA: CD EB 23        CALL    $23EB               ; {code.loc_23eb}
1ADD: C9              RET                         

loc_1ade:
1ADE: 3A 04 80        LD      A,($8004)           ; {hard.workRam+4}
1AE1: A7              AND     A                   
1AE2: C0              RET     NZ                  
1AE3: 21 44 80        LD      HL,$8044            
1AE6: 11 47 80        LD      DE,$8047            
1AE9: 3A 04 E0        LD      A,($E004)           
1AEC: CB 5F           BIT     3,A                 
1AEE: 28 07           JR      Z,$1AF7             ; {code.loc_1af7}
1AF0: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1AF3: 3D              DEC     A                   
1AF4: C2 74 1B        JP      NZ,$1B74            ; {code.loc_1b74}

loc_1af7:
1AF7: 3A 00 E0        LD      A,($E000)           
1AFA: 4F              LD      C,A                 

loc_1afb:
1AFB: 3A 48 82        LD      A,($8248)           ; {hard.workRam+248}
1AFE: A7              AND     A                   
1AFF: C2 BA 1B        JP      NZ,$1BBA            ; {code.advanceFrogHopDown}
1B02: 3A 04 E0        LD      A,($E004)           
1B05: CB 5F           BIT     3,A                 
1B07: 28 07           JR      Z,$1B10             ; {code.loc_1b10}
1B09: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1B0C: 3D              DEC     A                   
1B0D: C2 7B 1B        JP      NZ,$1B7B            ; {code.loc_1b7b}

loc_1b10:
1B10: 3A 04 E0        LD      A,($E004)           
1B13: CB 77           BIT     6,A                 

loc_1b15:
1B15: CA 8B 1B        JP      Z,$1B8B             ; {code.beginFrogHopDown}
1B18: AF              XOR     A                   
1B19: 32 4C 82        LD      ($824C),A           ; {hard.workRam+24C}
1B1C: 32 50 82        LD      ($8250),A           ; {hard.workRam+250}
1B1F: 3A 49 82        LD      A,($8249)           ; {hard.workRam+249}
1B22: A7              AND     A                   
1B23: C2 0D 1C        JP      NZ,$1C0D            ; {code.advanceFrogHopUp}
1B26: 3A 4A 82        LD      A,($824A)           ; {hard.workRam+24A}
1B29: 47              LD      B,A                 
1B2A: 3A 4B 82        LD      A,($824B)           ; {hard.workRam+24B}
1B2D: 80              ADD     A,B                 
1B2E: 20 1D           JR      NZ,$1B4D            ; {code.loc_1b4d}
1B30: 3A 04 E0        LD      A,($E004)           
1B33: CB 5F           BIT     3,A                 
1B35: 28 07           JR      Z,$1B3E             ; {code.loc_1b3e}
1B37: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1B3A: 3D              DEC     A                   
1B3B: C2 83 1B        JP      NZ,$1B83            ; {code.loc_1b83}

loc_1b3e:
1B3E: 3A 04 E0        LD      A,($E004)           
1B41: CB 67           BIT     4,A                 

loc_1b43:
1B43: CA E4 1B        JP      Z,$1BE4             ; {code.beginFrogHopUp}
1B46: AF              XOR     A                   
1B47: 32 4D 82        LD      ($824D),A           ; {hard.workRam+24D}
1B4A: 32 51 82        LD      ($8251),A           ; {hard.workRam+251}

loc_1b4d:
1B4D: 3A 4A 82        LD      A,($824A)           ; {hard.workRam+24A}
1B50: A7              AND     A                   
1B51: C2 76 1C        JP      NZ,$1C76            ; {code.advanceFrogHopRight}
1B54: CB 61           BIT     4,C                 
1B56: CA 41 1C        JP      Z,$1C41             ; {code.beginFrogHopRight}
1B59: AF              XOR     A                   
1B5A: 32 4E 82        LD      ($824E),A           ; {hard.workRam+24E}
1B5D: 32 52 82        LD      ($8252),A           ; {hard.workRam+252}
1B60: 3A 4B 82        LD      A,($824B)           ; {hard.workRam+24B}
1B63: A7              AND     A                   
1B64: C2 D5 1C        JP      NZ,$1CD5            ; {code.advanceFrogHopLeft}
1B67: CB 69           BIT     5,C                 
1B69: CA A0 1C        JP      Z,$1CA0             ; {code.beginFrogHopLeft}
1B6C: AF              XOR     A                   
1B6D: 32 4F 82        LD      ($824F),A           ; {hard.workRam+24F}
1B70: 32 53 82        LD      ($8253),A           ; {hard.workRam+253}
1B73: C9              RET                         

loc_1b74:
1B74: 3A 02 E0        LD      A,($E002)           
1B77: 4F              LD      C,A                 
1B78: C3 FB 1A        JP      $1AFB               ; {code.loc_1afb}

loc_1b7b:
1B7B: 3A 04 E0        LD      A,($E004)           
1B7E: CB 47           BIT     0,A                 
1B80: C3 15 1B        JP      $1B15               ; {code.loc_1b15}

loc_1b83:
1B83: 3A 00 E0        LD      A,($E000)           
1B86: CB 47           BIT     0,A                 
1B88: C3 43 1B        JP      $1B43               ; {code.loc_1b43}

; begin a DOWN hop: guard against the bottom edge (frog Y >= 0xF0
; returns); a fresh hop emits the hop sound (command 0x04) and stamps rest
; sprite 0xDE into FROG_SPRITE_CODE (0x8045), primes
; FROG_HOP_DOWN_ANIM_COUNTER from FROG_HOP_DOWN_ANIM_RELOAD, then
; continues into the DOWN advance (advanceFrogHopDown). Memory-only
beginFrogHopDown:
1B8B: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1B8E: FE F0           CP      $F0                 
1B90: D0              RET     NC                  
1B91: 3A 50 82        LD      A,($8250)           ; {hard.workRam+250}
1B94: A7              AND     A                   
1B95: 20 10           JR      NZ,$1BA7            ; {code.loc_1ba7}
1B97: 3E 04           LD      A,$04               
1B99: DF              RST     $18                 
1B9A: 23              INC     HL                  
1B9B: 7E              LD      A,(HL)              
1B9C: 2B              DEC     HL                  
1B9D: FE DE           CP      $DE                 
1B9F: CA B4 1B        JP      Z,$1BB4             ; {code.loc_1bb4}
1BA2: 3E DE           LD      A,$DE               
1BA4: 32 45 80        LD      ($8045),A           ; {hard.workRam+45}

loc_1ba7:
1BA7: 3A 50 82        LD      A,($8250)           ; {hard.workRam+250}
1BAA: 3C              INC     A                   
1BAB: 32 50 82        LD      ($8250),A           ; {hard.workRam+250}
1BAE: B7              OR      A                   
1BAF: C8              RET     Z                   
1BB0: AF              XOR     A                   
1BB1: 32 50 82        LD      ($8250),A           ; {hard.workRam+250}

loc_1bb4:
1BB4: 3A 56 82        LD      A,($8256)           ; {hard.workRam+256}
1BB7: 32 50 82        LD      ($8250),A           ; {hard.workRam+250}

; advance a DOWN hop one frame: return if already arrived
; (FROG_HOP_DOWN_ARRIVAL); else raise FROG_HOP_DOWN_ACTIVE and tick
; FROG_HOP_DOWN_ANIM_COUNTER down; on drain mark arrival + stamp rest
; sprite 0xDE, otherwise step the frog down (FROG_Y 0x8047 +=
; FROG_HOP_VERTICAL_DELTA 0x8254) and stamp moving sprite 0xDC into
; FROG_SPRITE_CODE (0x8045). Memory-only
advanceFrogHopDown:
1BBA: 3A 4C 82        LD      A,($824C)           ; {hard.workRam+24C}
1BBD: A7              AND     A                   
1BBE: C0              RET     NZ                  
1BBF: 3C              INC     A                   
1BC0: 32 48 82        LD      ($8248),A           ; {hard.workRam+248}
1BC3: 3A 50 82        LD      A,($8250)           ; {hard.workRam+250}
1BC6: 3D              DEC     A                   
1BC7: 32 50 82        LD      ($8250),A           ; {hard.workRam+250}
1BCA: C2 D8 1B        JP      NZ,$1BD8            ; {code.loc_1bd8}
1BCD: 32 48 82        LD      ($8248),A           ; {hard.workRam+248}
1BD0: 3C              INC     A                   
1BD1: 32 4C 82        LD      ($824C),A           ; {hard.workRam+24C}
1BD4: 23              INC     HL                  
1BD5: 36 DE           LD      (HL),$DE            
1BD7: C9              RET                         

loc_1bd8:
1BD8: EB              EX      DE,HL               
1BD9: 3A 54 82        LD      A,($8254)           ; {hard.workRam+254}
1BDC: 86              ADD     A,(HL)              
1BDD: 77              LD      (HL),A              
1BDE: EB              EX      DE,HL               
1BDF: 23              INC     HL                  
1BE0: 3E DC           LD      A,$DC               
1BE2: 77              LD      (HL),A              
1BE3: C9              RET                         

; begin an UP hop: no position guard; a fresh hop emits the hop sound
; (command 0x04) and stamps rest sprite 0x1E into FROG_SPRITE_CODE
; (0x8045), primes FROG_HOP_UP_ANIM_COUNTER from FROG_HOP_UP_ANIM_RELOAD
; (=9), then continues into the UP advance (advanceFrogHopUp). Memory-only
beginFrogHopUp:
1BE4: 3A 51 82        LD      A,($8251)           ; {hard.workRam+251}
1BE7: A7              AND     A                   
1BE8: 20 10           JR      NZ,$1BFA            ; {code.loc_1bfa}
1BEA: 3E 04           LD      A,$04               
1BEC: DF              RST     $18                 
1BED: 23              INC     HL                  
1BEE: 7E              LD      A,(HL)              
1BEF: 2B              DEC     HL                  
1BF0: FE 1E           CP      $1E                 
1BF2: CA 07 1C        JP      Z,$1C07             ; {code.loc_1c07}
1BF5: 3E 1E           LD      A,$1E               
1BF7: 32 45 80        LD      ($8045),A           ; {hard.workRam+45}

loc_1bfa:
1BFA: 3A 51 82        LD      A,($8251)           ; {hard.workRam+251}
1BFD: 3C              INC     A                   
1BFE: 32 51 82        LD      ($8251),A           ; {hard.workRam+251}
1C01: B7              OR      A                   
1C02: C8              RET     Z                   
1C03: AF              XOR     A                   
1C04: 32 51 82        LD      ($8251),A           ; {hard.workRam+251}

loc_1c07:
1C07: 3A 57 82        LD      A,($8257)           ; {hard.workRam+257}
1C0A: 32 51 82        LD      ($8251),A           ; {hard.workRam+251}

; advance an UP hop one frame: first steps the home-bay slot cursor (A
; discarded); return if arrived (FROG_HOP_UP_ARRIVAL); else raise
; FROG_HOP_UP_ACTIVE and tick FROG_HOP_UP_ANIM_COUNTER down; on drain mark
; arrival + stamp rest sprite 0x1E + score row progress
; (scoreFrogRowProgress), otherwise step the frog up (FROG_Y 0x8047 -=
; FROG_HOP_VERTICAL_DELTA 0x8254) and stamp moving sprite 0x1C into
; FROG_SPRITE_CODE (0x8045). Memory-only
advanceFrogHopUp:
1C0D: CD EB 23        CALL    $23EB               ; {code.loc_23eb}
1C10: 3A 4D 82        LD      A,($824D)           ; {hard.workRam+24D}
1C13: A7              AND     A                   
1C14: C0              RET     NZ                  
1C15: 3C              INC     A                   
1C16: 32 49 82        LD      ($8249),A           ; {hard.workRam+249}
1C19: 3A 51 82        LD      A,($8251)           ; {hard.workRam+251}
1C1C: 3D              DEC     A                   
1C1D: 32 51 82        LD      ($8251),A           ; {hard.workRam+251}
1C20: C2 33 1C        JP      NZ,$1C33            ; {code.loc_1c33}
1C23: 32 49 82        LD      ($8249),A           ; {hard.workRam+249}
1C26: 3C              INC     A                   
1C27: 32 4D 82        LD      ($824D),A           ; {hard.workRam+24D}
1C2A: 23              INC     HL                  
1C2B: 36 1E           LD      (HL),$1E            
1C2D: D5              PUSH    DE                  
1C2E: CD D6 1F        CALL    $1FD6               ; {code.scoreFrogRowProgress}
1C31: D1              POP     DE                  
1C32: C9              RET                         

loc_1c33:
1C33: EB              EX      DE,HL               
1C34: 3A 54 82        LD      A,($8254)           ; {hard.workRam+254}
1C37: 47              LD      B,A                 
1C38: 7E              LD      A,(HL)              
1C39: 90              SUB     B                   
1C3A: 77              LD      (HL),A              
1C3B: EB              EX      DE,HL               
1C3C: 23              INC     HL                  
1C3D: 3E 1C           LD      A,$1C               
1C3F: 77              LD      (HL),A              
1C40: C9              RET                         

; begin a RIGHT hop: guard the field top (frog Y < 0x30 returns) and the
; right edge (frog X >= 0xE0 returns); a fresh hop emits the hop sound
; (command 0x04) and stamps rest sprite 0xA1 into FROG_SPRITE_CODE
; (0x8045), primes FROG_HOP_RIGHT_ANIM_COUNTER from
; FROG_HOP_RIGHT_ANIM_RELOAD (=9), then continues into the RIGHT advance
; (advanceFrogHopRight). Memory-only
beginFrogHopRight:
1C41: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1C44: FE 30           CP      $30                 
1C46: D8              RET     C                   
1C47: 3A 44 80        LD      A,($8044)           ; {hard.workRam+44}
1C4A: FE E0           CP      $E0                 
1C4C: D0              RET     NC                  
1C4D: 3A 52 82        LD      A,($8252)           ; {hard.workRam+252}
1C50: A7              AND     A                   
1C51: 20 10           JR      NZ,$1C63            ; {code.loc_1c63}
1C53: 3E 04           LD      A,$04               
1C55: DF              RST     $18                 
1C56: 23              INC     HL                  
1C57: 7E              LD      A,(HL)              
1C58: 2B              DEC     HL                  
1C59: FE A1           CP      $A1                 
1C5B: CA 70 1C        JP      Z,$1C70             ; {code.loc_1c70}
1C5E: 3E A1           LD      A,$A1               
1C60: 32 45 80        LD      ($8045),A           ; {hard.workRam+45}

loc_1c63:
1C63: 3A 52 82        LD      A,($8252)           ; {hard.workRam+252}
1C66: 3C              INC     A                   
1C67: 32 52 82        LD      ($8252),A           ; {hard.workRam+252}
1C6A: B7              OR      A                   
1C6B: C8              RET     Z                   
1C6C: AF              XOR     A                   
1C6D: 32 52 82        LD      ($8252),A           ; {hard.workRam+252}

loc_1c70:
1C70: 3A 58 82        LD      A,($8258)           ; {hard.workRam+258}
1C73: 32 52 82        LD      ($8252),A           ; {hard.workRam+252}

; advance a RIGHT hop one frame: return if arrived
; (FROG_HOP_RIGHT_ARRIVAL); else raise FROG_HOP_RIGHT_ACTIVE and tick
; FROG_HOP_RIGHT_ANIM_COUNTER down; on drain mark arrival + stamp rest
; sprite 0xA1, otherwise step the frog right (FROG_X 0x8044 +=
; FROG_HOP_HORIZONTAL_DELTA 0x8255) and stamp moving sprite 0x9F into
; FROG_SPRITE_CODE (0x8045). Memory-only
advanceFrogHopRight:
1C76: 3A 4E 82        LD      A,($824E)           ; {hard.workRam+24E}
1C79: A7              AND     A                   
1C7A: C0              RET     NZ                  
1C7B: 3C              INC     A                   
1C7C: 32 4A 82        LD      ($824A),A           ; {hard.workRam+24A}
1C7F: 3A 52 82        LD      A,($8252)           ; {hard.workRam+252}
1C82: 3D              DEC     A                   
1C83: 32 52 82        LD      ($8252),A           ; {hard.workRam+252}
1C86: C2 94 1C        JP      NZ,$1C94            ; {code.loc_1c94}
1C89: 32 4A 82        LD      ($824A),A           ; {hard.workRam+24A}
1C8C: 3C              INC     A                   
1C8D: 32 4E 82        LD      ($824E),A           ; {hard.workRam+24E}
1C90: 23              INC     HL                  
1C91: 36 A1           LD      (HL),$A1            
1C93: C9              RET                         

loc_1c94:
1C94: 3A 55 82        LD      A,($8255)           ; {hard.workRam+255}
1C97: 47              LD      B,A                 
1C98: 7E              LD      A,(HL)              
1C99: 80              ADD     A,B                 
1C9A: 77              LD      (HL),A              
1C9B: 23              INC     HL                  
1C9C: 3E 9F           LD      A,$9F               
1C9E: 77              LD      (HL),A              
1C9F: C9              RET                         

; begin a LEFT hop: guard the field top (frog Y < 0x30 returns) and the
; left edge (frog X < 0x20 returns); a fresh hop emits the hop sound
; (command 0x04) and stamps rest sprite 0x21 into FROG_SPRITE_CODE
; (0x8045), primes FROG_HOP_LEFT_ANIM_COUNTER from
; FROG_HOP_LEFT_ANIM_RELOAD, then continues into the LEFT advance
; (advanceFrogHopLeft). Memory-only
beginFrogHopLeft:
1CA0: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1CA3: FE 30           CP      $30                 
1CA5: D8              RET     C                   
1CA6: 3A 44 80        LD      A,($8044)           ; {hard.workRam+44}
1CA9: FE 20           CP      $20                 
1CAB: D8              RET     C                   
1CAC: 3A 53 82        LD      A,($8253)           ; {hard.workRam+253}
1CAF: A7              AND     A                   
1CB0: 20 10           JR      NZ,$1CC2            ; {code.loc_1cc2}
1CB2: 3E 04           LD      A,$04               
1CB4: DF              RST     $18                 
1CB5: 23              INC     HL                  
1CB6: 7E              LD      A,(HL)              
1CB7: 2B              DEC     HL                  
1CB8: FE 21           CP      $21                 
1CBA: CA CF 1C        JP      Z,$1CCF             ; {code.loc_1ccf}
1CBD: 3E 21           LD      A,$21               
1CBF: 32 45 80        LD      ($8045),A           ; {hard.workRam+45}

loc_1cc2:
1CC2: 3A 53 82        LD      A,($8253)           ; {hard.workRam+253}
1CC5: 3C              INC     A                   
1CC6: 32 53 82        LD      ($8253),A           ; {hard.workRam+253}
1CC9: B7              OR      A                   
1CCA: C8              RET     Z                   
1CCB: AF              XOR     A                   
1CCC: 32 53 82        LD      ($8253),A           ; {hard.workRam+253}

loc_1ccf:
1CCF: 3A 59 82        LD      A,($8259)           ; {hard.workRam+259}
1CD2: 32 53 82        LD      ($8253),A           ; {hard.workRam+253}

; advance a LEFT hop one frame: return if arrived (FROG_HOP_LEFT_ARRIVAL);
; else raise FROG_HOP_LEFT_ACTIVE and tick FROG_HOP_LEFT_ANIM_COUNTER
; down; on drain mark arrival + stamp rest sprite 0x21, otherwise step the
; frog left (FROG_X 0x8044 -= FROG_HOP_HORIZONTAL_DELTA 0x8255) and stamp
; moving sprite 0x1F into FROG_SPRITE_CODE (0x8045). Memory-only
advanceFrogHopLeft:
1CD5: 3A 4F 82        LD      A,($824F)           ; {hard.workRam+24F}
1CD8: A7              AND     A                   
1CD9: C0              RET     NZ                  
1CDA: 3C              INC     A                   
1CDB: 32 4B 82        LD      ($824B),A           ; {hard.workRam+24B}
1CDE: 3A 53 82        LD      A,($8253)           ; {hard.workRam+253}
1CE1: 3D              DEC     A                   
1CE2: 32 53 82        LD      ($8253),A           ; {hard.workRam+253}
1CE5: C2 F3 1C        JP      NZ,$1CF3            ; {code.loc_1cf3}
1CE8: 32 4B 82        LD      ($824B),A           ; {hard.workRam+24B}
1CEB: 3C              INC     A                   
1CEC: 32 4F 82        LD      ($824F),A           ; {hard.workRam+24F}
1CEF: 23              INC     HL                  
1CF0: 36 21           LD      (HL),$21            
1CF2: C9              RET                         

loc_1cf3:
1CF3: 3A 55 82        LD      A,($8255)           ; {hard.workRam+255}
1CF6: 47              LD      B,A                 
1CF7: 7E              LD      A,(HL)              
1CF8: 90              SUB     B                   
1CF9: 77              LD      (HL),A              
1CFA: 23              INC     HL                  
1CFB: 3E 1F           LD      A,$1F               
1CFD: 77              LD      (HL),A              
1CFE: C9              RET                         

; home-bay column dispatcher: reads the frog X (FROG_X 0x8044) and routes
; to the goal handler for the bay whose inclusive X band contains it (bay1
; 0x15-0x1C, bay2 0x45-0x4C, bay3 0x75-0x7C, bay4 0xA5-0xAC, bay5
; 0xD5-0xDC), or to the reject handler (holdFrogMissedHomeBay) when the
; frog sits between bays or below the first band. Memory-only
selectHomeBayGoalHandler:
1CFF: 3A 44 80        LD      A,($8044)           ; {hard.workRam+44}
1D02: FE 15           CP      $15                 
1D04: DA 77 1D        JP      C,$1D77             ; {code.holdFrogMissedHomeBay}
1D07: FE 1C           CP      $1C                 
1D09: CA 87 1D        JP      Z,$1D87             ; {code.awardHomeBay1Goal}
1D0C: DA 87 1D        JP      C,$1D87             ; {code.awardHomeBay1Goal}
1D0F: FE 2E           CP      $2E                 
1D11: DA 77 1D        JP      C,$1D77             ; {code.holdFrogMissedHomeBay}
1D14: FE 35           CP      $35                 
1D16: CA 77 1D        JP      Z,$1D77             ; {code.holdFrogMissedHomeBay}
1D19: DA 77 1D        JP      C,$1D77             ; {code.holdFrogMissedHomeBay}
1D1C: FE 45           CP      $45                 
1D1E: DA 77 1D        JP      C,$1D77             ; {code.holdFrogMissedHomeBay}
1D21: FE 4C           CP      $4C                 
1D23: CA D8 1D        JP      Z,$1DD8             ; {code.awardHomeBay2Goal}
1D26: DA D8 1D        JP      C,$1DD8             ; {code.awardHomeBay2Goal}
1D29: FE 5E           CP      $5E                 
1D2B: DA 77 1D        JP      C,$1D77             ; {code.holdFrogMissedHomeBay}
1D2E: FE 65           CP      $65                 
1D30: CA 77 1D        JP      Z,$1D77             ; {code.holdFrogMissedHomeBay}
1D33: DA 77 1D        JP      C,$1D77             ; {code.holdFrogMissedHomeBay}
1D36: FE 75           CP      $75                 
1D38: DA 77 1D        JP      C,$1D77             ; {code.holdFrogMissedHomeBay}
1D3B: FE 7C           CP      $7C                 
1D3D: CA 29 1E        JP      Z,$1E29             ; {code.awardHomeBay3Goal}
1D40: DA 29 1E        JP      C,$1E29             ; {code.awardHomeBay3Goal}
1D43: FE 8E           CP      $8E                 
1D45: DA 77 1D        JP      C,$1D77             ; {code.holdFrogMissedHomeBay}
1D48: FE 95           CP      $95                 
1D4A: CA 77 1D        JP      Z,$1D77             ; {code.holdFrogMissedHomeBay}
1D4D: DA 77 1D        JP      C,$1D77             ; {code.holdFrogMissedHomeBay}
1D50: FE A5           CP      $A5                 
1D52: DA 77 1D        JP      C,$1D77             ; {code.holdFrogMissedHomeBay}
1D55: FE AC           CP      $AC                 
1D57: CA 7A 1E        JP      Z,$1E7A             ; {code.awardHomeBay4Goal}
1D5A: DA 7A 1E        JP      C,$1E7A             ; {code.awardHomeBay4Goal}
1D5D: FE BE           CP      $BE                 
1D5F: DA 77 1D        JP      C,$1D77             ; {code.holdFrogMissedHomeBay}
1D62: FE C5           CP      $C5                 
1D64: CA 77 1D        JP      Z,$1D77             ; {code.holdFrogMissedHomeBay}
1D67: DA 77 1D        JP      C,$1D77             ; {code.holdFrogMissedHomeBay}
1D6A: FE D5           CP      $D5                 
1D6C: DA 77 1D        JP      C,$1D77             ; {code.holdFrogMissedHomeBay}
1D6F: FE DC           CP      $DC                 
1D71: CA CB 1E        JP      Z,$1ECB             ; {code.awardHomeBay5Goal}
1D74: DA CB 1E        JP      C,$1ECB             ; {code.awardHomeBay5Goal}

; home-row reject handler: when the frog has fully reached the home row
; (FROG_Y 0x8047 < 0x2A) over no bay, raise the hold flag HOLD_FLAG
; (0x8004), losing the frog; either way it hands to the frog input scan
; (scanFrogInputAndDispatchHop). Memory-only
holdFrogMissedHomeBay:
1D77: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1D7A: FE 2A           CP      $2A                 
1D7C: D2 CB 1A        JP      NC,$1ACB            ; {code.scanFrogInputAndDispatchHop}
1D7F: 3E 01           LD      A,$01               
1D81: 32 04 80        LD      ($8004),A           ; {hard.workRam+4}
1D84: C3 CB 1A        JP      $1ACB               ; {code.scanFrogInputAndDispatchHop}

; home-bay-1 goal handler (shared body, per-bay params): returns if bay
; 1's occupancy gate is already filled -- HOME_BAY1_OCCUPANCY_PRIMARY
; (0x825E) for player 1, HOME_BAY1_OCCUPANCY_ALT (0x8263) for player 2
; (chosen by ACTIVE_PLAYER 0x83FD); hands to the input scan if the frog
; has not fully reached the home row (FROG_Y 0x8047 >= 0x2A); else awards
; the bay -- bonus points on a PENDING_HOME_BAY_SLOT (0x8121) key match
; (key 1), stamps the 2x2 home tiles at HOME_SLOT1_VRAM (0xAB64) and
; resets the frog (stampHomeGoalAndResetFrog), arms the goal sprite when a
; collision is latched (COLLISION_SUBFLAG 0x8134), then sets the occupancy
; gate and bumps this player's home count (PLAYER1_SLOT 0x825C /
; PLAYER2_SLOT 0x825D). Memory-only
awardHomeBay1Goal:
1D87: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1D8A: 3D              DEC     A                   
1D8B: 20 3C           JR      NZ,$1DC9            ; {code.loc_1dc9}
1D8D: 3A 5E 82        LD      A,($825E)           ; {hard.workRam+25E}

loc_1d90:
1D90: A7              AND     A                   
1D91: C0              RET     NZ                  
1D92: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1D95: FE 2A           CP      $2A                 
1D97: D2 CB 1A        JP      NC,$1ACB            ; {code.scanFrogInputAndDispatchHop}
1D9A: 06 18           LD      B,$18               
1D9C: 3A 21 81        LD      A,($8121)           ; {hard.workRam+121}
1D9F: D6 01           SUB     $01                 
1DA1: CC 73 26        CALL    Z,$2673             ; {code.loc_2673}
1DA4: 21 64 AB        LD      HL,$AB64            
1DA7: CD 1C 1F        CALL    $1F1C               ; {code.stampHomeGoalAndResetFrog}
1DAA: 3A 34 81        LD      A,($8134)           ; {hard.workRam+134}
1DAD: A7              AND     A                   
1DAE: 28 09           JR      Z,$1DB9             ; {code.loc_1db9}
1DB0: 06 18           LD      B,$18               
1DB2: CD CB 27        CALL    $27CB               ; {code.armHomeGoalSprite}
1DB5: AF              XOR     A                   
1DB6: 32 34 81        LD      ($8134),A           ; {hard.workRam+134}

loc_1db9:
1DB9: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1DBC: 3D              DEC     A                   
1DBD: 20 0F           JR      NZ,$1DCE            ; {code.loc_1dce}
1DBF: 3E 01           LD      A,$01               
1DC1: 32 5E 82        LD      ($825E),A           ; {hard.workRam+25E}
1DC4: 21 5C 82        LD      HL,$825C            
1DC7: 34              INC     (HL)                
1DC8: C9              RET                         

loc_1dc9:
1DC9: 3A 63 82        LD      A,($8263)           ; {hard.workRam+263}
1DCC: 18 C2           JR      $1D90               ; {code.loc_1d90}

loc_1dce:
1DCE: 3E 01           LD      A,$01               
1DD0: 32 63 82        LD      ($8263),A           ; {hard.workRam+263}
1DD3: 21 5D 82        LD      HL,$825D            
1DD6: 34              INC     (HL)                
1DD7: C9              RET                         

; home-bay-2 goal handler: identical body to awardHomeBay1Goal, for bay 2
; -- occupancy gates HOME_BAY2_OCCUPANCY_PRIMARY (0x825F) /
; HOME_BAY2_OCCUPANCY_ALT (0x8264), home tiles at HOME_SLOT2_VRAM
; (0xAAA4), PENDING_HOME_BAY_SLOT (0x8121) key 2; returns if that gate is
; set, hands to the input scan if the frog isn't fully on the home row,
; else awards the bay (bonus, home-tile stamp + frog reset, occupancy
; gate, this player's home count). Memory-only
awardHomeBay2Goal:
1DD8: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1DDB: 3D              DEC     A                   
1DDC: 20 3C           JR      NZ,$1E1A            ; {code.loc_1e1a}
1DDE: 3A 5F 82        LD      A,($825F)           ; {hard.workRam+25F}

loc_1de1:
1DE1: A7              AND     A                   
1DE2: C0              RET     NZ                  
1DE3: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1DE6: FE 2A           CP      $2A                 
1DE8: D2 CB 1A        JP      NC,$1ACB            ; {code.scanFrogInputAndDispatchHop}
1DEB: 06 48           LD      B,$48               
1DED: 3A 21 81        LD      A,($8121)           ; {hard.workRam+121}
1DF0: D6 02           SUB     $02                 
1DF2: CC 73 26        CALL    Z,$2673             ; {code.loc_2673}
1DF5: 21 A4 AA        LD      HL,$AAA4            
1DF8: CD 1C 1F        CALL    $1F1C               ; {code.stampHomeGoalAndResetFrog}
1DFB: 3A 34 81        LD      A,($8134)           ; {hard.workRam+134}
1DFE: A7              AND     A                   
1DFF: 28 09           JR      Z,$1E0A             ; {code.loc_1e0a}
1E01: 06 48           LD      B,$48               
1E03: CD CB 27        CALL    $27CB               ; {code.armHomeGoalSprite}
1E06: AF              XOR     A                   
1E07: 32 34 81        LD      ($8134),A           ; {hard.workRam+134}

loc_1e0a:
1E0A: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1E0D: 3D              DEC     A                   
1E0E: 20 0F           JR      NZ,$1E1F            ; {code.loc_1e1f}
1E10: 3E 01           LD      A,$01               
1E12: 32 5F 82        LD      ($825F),A           ; {hard.workRam+25F}
1E15: 21 5C 82        LD      HL,$825C            
1E18: 34              INC     (HL)                
1E19: C9              RET                         

loc_1e1a:
1E1A: 3A 64 82        LD      A,($8264)           ; {hard.workRam+264}
1E1D: 18 C2           JR      $1DE1               ; {code.loc_1de1}

loc_1e1f:
1E1F: 3E 01           LD      A,$01               
1E21: 32 64 82        LD      ($8264),A           ; {hard.workRam+264}
1E24: 21 5D 82        LD      HL,$825D            
1E27: 34              INC     (HL)                
1E28: C9              RET                         

; home-bay-3 goal handler: identical body to awardHomeBay1Goal, for bay 3
; -- occupancy gates HOME_BAY3_OCCUPANCY_PRIMARY (0x8260) /
; HOME_BAY3_OCCUPANCY_ALT (0x8265), home tiles at HOME_SLOT3_VRAM
; (0xA9E4), PENDING_HOME_BAY_SLOT (0x8121) key 3; returns if that gate is
; set, hands to the input scan if the frog isn't fully on the home row,
; else awards the bay (bonus, home-tile stamp + frog reset, occupancy
; gate, this player's home count). Memory-only
awardHomeBay3Goal:
1E29: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1E2C: 3D              DEC     A                   
1E2D: 20 3C           JR      NZ,$1E6B            ; {code.loc_1e6b}
1E2F: 3A 60 82        LD      A,($8260)           ; {hard.workRam+260}

loc_1e32:
1E32: A7              AND     A                   
1E33: C0              RET     NZ                  
1E34: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1E37: FE 2A           CP      $2A                 
1E39: D2 CB 1A        JP      NC,$1ACB            ; {code.scanFrogInputAndDispatchHop}
1E3C: 06 78           LD      B,$78               
1E3E: 3A 21 81        LD      A,($8121)           ; {hard.workRam+121}
1E41: D6 03           SUB     $03                 
1E43: CC 73 26        CALL    Z,$2673             ; {code.loc_2673}
1E46: 21 E4 A9        LD      HL,$A9E4            
1E49: CD 1C 1F        CALL    $1F1C               ; {code.stampHomeGoalAndResetFrog}
1E4C: 3A 34 81        LD      A,($8134)           ; {hard.workRam+134}
1E4F: A7              AND     A                   
1E50: 28 09           JR      Z,$1E5B             ; {code.loc_1e5b}
1E52: 06 78           LD      B,$78               
1E54: CD CB 27        CALL    $27CB               ; {code.armHomeGoalSprite}
1E57: AF              XOR     A                   
1E58: 32 34 81        LD      ($8134),A           ; {hard.workRam+134}

loc_1e5b:
1E5B: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1E5E: 3D              DEC     A                   
1E5F: 20 0F           JR      NZ,$1E70            ; {code.loc_1e70}
1E61: 3E 01           LD      A,$01               
1E63: 32 60 82        LD      ($8260),A           ; {hard.workRam+260}
1E66: 21 5C 82        LD      HL,$825C            
1E69: 34              INC     (HL)                
1E6A: C9              RET                         

loc_1e6b:
1E6B: 3A 65 82        LD      A,($8265)           ; {hard.workRam+265}
1E6E: 18 C2           JR      $1E32               ; {code.loc_1e32}

loc_1e70:
1E70: 3E 01           LD      A,$01               
1E72: 32 65 82        LD      ($8265),A           ; {hard.workRam+265}
1E75: 21 5D 82        LD      HL,$825D            
1E78: 34              INC     (HL)                
1E79: C9              RET                         

; home-bay-4 goal handler: identical body to awardHomeBay1Goal, for bay 4
; -- occupancy gates HOME_BAY4_OCCUPANCY_PRIMARY (0x8261) /
; HOME_BAY4_OCCUPANCY_ALT (0x8266), home tiles at HOME_SLOT4_VRAM
; (0xA924), PENDING_HOME_BAY_SLOT (0x8121) key 4; returns if that gate is
; set, hands to the input scan if the frog isn't fully on the home row,
; else awards the bay (bonus, home-tile stamp + frog reset, occupancy
; gate, this player's home count). Memory-only
awardHomeBay4Goal:
1E7A: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1E7D: 3D              DEC     A                   
1E7E: 20 3C           JR      NZ,$1EBC            ; {code.loc_1ebc}
1E80: 3A 61 82        LD      A,($8261)           ; {hard.workRam+261}

loc_1e83:
1E83: A7              AND     A                   
1E84: C0              RET     NZ                  
1E85: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1E88: FE 2A           CP      $2A                 
1E8A: D2 CB 1A        JP      NC,$1ACB            ; {code.scanFrogInputAndDispatchHop}
1E8D: 06 A8           LD      B,$A8               
1E8F: 3A 21 81        LD      A,($8121)           ; {hard.workRam+121}
1E92: D6 04           SUB     $04                 
1E94: CC 73 26        CALL    Z,$2673             ; {code.loc_2673}
1E97: 21 24 A9        LD      HL,$A924            
1E9A: CD 1C 1F        CALL    $1F1C               ; {code.stampHomeGoalAndResetFrog}
1E9D: 3A 34 81        LD      A,($8134)           ; {hard.workRam+134}
1EA0: A7              AND     A                   
1EA1: 28 09           JR      Z,$1EAC             ; {code.loc_1eac}
1EA3: 06 A8           LD      B,$A8               
1EA5: CD CB 27        CALL    $27CB               ; {code.armHomeGoalSprite}
1EA8: AF              XOR     A                   
1EA9: 32 34 81        LD      ($8134),A           ; {hard.workRam+134}

loc_1eac:
1EAC: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1EAF: 3D              DEC     A                   
1EB0: 20 0F           JR      NZ,$1EC1            ; {code.loc_1ec1}
1EB2: 3E 01           LD      A,$01               
1EB4: 32 61 82        LD      ($8261),A           ; {hard.workRam+261}
1EB7: 21 5C 82        LD      HL,$825C            
1EBA: 34              INC     (HL)                
1EBB: C9              RET                         

loc_1ebc:
1EBC: 3A 66 82        LD      A,($8266)           ; {hard.workRam+266}
1EBF: 18 C2           JR      $1E83               ; {code.loc_1e83}

loc_1ec1:
1EC1: 3E 01           LD      A,$01               
1EC3: 32 66 82        LD      ($8266),A           ; {hard.workRam+266}
1EC6: 21 5D 82        LD      HL,$825D            
1EC9: 34              INC     (HL)                
1ECA: C9              RET                         

; home-bay-5 goal handler (shared parameterized body, one param set per
; bay): returns if bay 5's occupancy gate (HOME_BAY5_OCCUPANCY_PRIMARY
; 0x8262 / HOME_BAY5_OCCUPANCY_ALT 0x8267, bank picked by ACTIVE_PLAYER
; 0x83fd) is already set, or hands to the frog input scan
; (scanFrogInputAndDispatchHop) while FROG_Y (0x8047) has not fully
; reached the home row; otherwise awards the bay -- bonus points on a
; PENDING_HOME_BAY_SLOT (0x8121) key match, the shared home-fill/frog-
; reset (stampHomeGoalAndResetFrog), and the goal sprite plus collision-
; latch clear when COLLISION_SUBFLAG (0x8134) is set -- then marks the
; occupancy gate and bumps this player's home count (PLAYER1_SLOT 0x825c /
; PLAYER2_SLOT 0x825d); memory-only
awardHomeBay5Goal:
1ECB: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1ECE: 3D              DEC     A                   
1ECF: 20 3C           JR      NZ,$1F0D            ; {code.loc_1f0d}
1ED1: 3A 62 82        LD      A,($8262)           ; {hard.workRam+262}

loc_1ed4:
1ED4: A7              AND     A                   
1ED5: C0              RET     NZ                  
1ED6: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1ED9: FE 2A           CP      $2A                 
1EDB: D2 CB 1A        JP      NC,$1ACB            ; {code.scanFrogInputAndDispatchHop}
1EDE: 06 D8           LD      B,$D8               
1EE0: 3A 21 81        LD      A,($8121)           ; {hard.workRam+121}
1EE3: D6 05           SUB     $05                 
1EE5: CC 73 26        CALL    Z,$2673             ; {code.loc_2673}
1EE8: 21 64 A8        LD      HL,$A864            
1EEB: CD 1C 1F        CALL    $1F1C               ; {code.stampHomeGoalAndResetFrog}
1EEE: 3A 34 81        LD      A,($8134)           ; {hard.workRam+134}
1EF1: A7              AND     A                   
1EF2: 28 09           JR      Z,$1EFD             ; {code.loc_1efd}
1EF4: 06 D8           LD      B,$D8               
1EF6: CD CB 27        CALL    $27CB               ; {code.armHomeGoalSprite}
1EF9: AF              XOR     A                   
1EFA: 32 34 81        LD      ($8134),A           ; {hard.workRam+134}

loc_1efd:
1EFD: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1F00: 3D              DEC     A                   
1F01: 20 0F           JR      NZ,$1F12            ; {code.loc_1f12}
1F03: 3E 01           LD      A,$01               
1F05: 32 62 82        LD      ($8262),A           ; {hard.workRam+262}
1F08: 21 5C 82        LD      HL,$825C            
1F0B: 34              INC     (HL)                
1F0C: C9              RET                         

loc_1f0d:
1F0D: 3A 67 82        LD      A,($8267)           ; {hard.workRam+267}
1F10: 18 C2           JR      $1ED4               ; {code.loc_1ed4}

loc_1f12:
1F12: 3E 01           LD      A,$01               
1F14: 32 67 82        LD      ($8267),A           ; {hard.workRam+267}
1F17: 21 5D 82        LD      HL,$825D            
1F1A: 34              INC     (HL)                
1F1B: C9              RET                         

; shared home-goal fill and frog reset, reached once a home bay is
; awarded: on a latched collision (COLLISION_SUBFLAG 0x8134) it adds the
; bonus score and clears the fly/goal sprite block, stamps the 2x2
; occupied-home tiles (0x6c/0x6d over 0x6e/0x6f) at the caller's slot
; base, adds the home bonus and refreshes the score display. In play
; (PLAY_FLAG 0x83fe) it queues the arrival jingle and, on this player's
; fourth home (PLAYER1_SLOT 0x825c / PLAYER2_SLOT 0x825d == 4), clears the
; player work RAM and the fly OBJRAM block (OBJRAM_FLY_SPRITE_BASE
; 0xb040), else advances the fanfare pointer (FANFARE_INDEX 0x8381 ->
; SOUND_SEQUENCE_COUNTDOWN 0x8382). Finally it reseeds the frog object
; (FROG_X/FROG_SPRITE_CODE/FROG_OBJ_ATTR cleared, FROG_Y 0x8047 = 0xf0
; off-screen) and the up-hop + gated-countdown state so the next frog
; starts fresh; memory-only
stampHomeGoalAndResetFrog:
1F1C: 3A 34 81        LD      A,($8134)           ; {hard.workRam+134}
1F1F: A7              AND     A                   
1F20: 28 09           JR      Z,$1F2B             ; {code.loc_1f2b}
1F22: 11 20 00        LD      DE,$0020            
1F25: CD E0 08        CALL    $08E0               ; {code.addScoreAndAwardExtraLife}
1F28: CD BC 27        CALL    $27BC               ; {code.clearCollisionSpriteBlock}

loc_1f2b:
1F2B: 36 6C           LD      (HL),$6C            
1F2D: 23              INC     HL                  
1F2E: 36 6D           LD      (HL),$6D            
1F30: 01 1F 00        LD      BC,$001F            
1F33: 09              ADD     HL,BC               
1F34: 36 6E           LD      (HL),$6E            
1F36: 23              INC     HL                  
1F37: 36 6F           LD      (HL),$6F            
1F39: E5              PUSH    HL                  
1F3A: D5              PUSH    DE                  
1F3B: 11 05 00        LD      DE,$0005            
1F3E: CD E0 08        CALL    $08E0               ; {code.addScoreAndAwardExtraLife}
1F41: CD C5 08        CALL    $08C5               ; {code.armScoreBonusStrip}
1F44: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
1F47: B7              OR      A                   
1F48: 28 4A           JR      Z,$1F94             ; {code.loc_1f94}
1F4A: AF              XOR     A                   
1F4B: 67              LD      H,A                 
1F4C: 6F              LD      L,A                 
1F4D: 22 82 83        LD      ($8382),HL          ; {hard.workRam+382}
1F50: DF              RST     $18                 
1F51: 3E F0           LD      A,$F0               
1F53: DF              RST     $18                 
1F54: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
1F57: 21 5C 82        LD      HL,$825C            
1F5A: 3D              DEC     A                   
1F5B: 28 01           JR      Z,$1F5E             ; {code.loc_1f5e}
1F5D: 2C              INC     L                   

loc_1f5e:
1F5E: 7E              LD      A,(HL)              
1F5F: FE 04           CP      $04                 
1F61: 28 1E           JR      Z,$1F81             ; {code.loc_1f81}
1F63: 3E 08           LD      A,$08               
1F65: DF              RST     $18                 
1F66: 3E 0E           LD      A,$0E               
1F68: DF              RST     $18                 
1F69: 21 81 83        LD      HL,$8381            
1F6C: 35              DEC     (HL)                
1F6D: 20 02           JR      NZ,$1F71            ; {code.loc_1f71}
1F6F: 36 14           LD      (HL),$14            

loc_1f71:
1F71: 7E              LD      A,(HL)              
1F72: 21 87 2E        LD      HL,$2E87            
1F75: 87              ADD     A,A                 
1F76: 85              ADD     A,L                 
1F77: 6F              LD      L,A                 
1F78: 7E              LD      A,(HL)              
1F79: 2C              INC     L                   
1F7A: 66              LD      H,(HL)              
1F7B: 6F              LD      L,A                 
1F7C: 22 82 83        LD      ($8382),HL          ; {hard.workRam+382}
1F7F: 18 13           JR      $1F94               ; {code.loc_1f94}

loc_1f81:
1F81: 32 2F 84        LD      ($842F),A           ; {hard.workRam+42F}
1F84: CD E6 07        CALL    $07E6               ; {code.clearActivePlayerWorkRam}
1F87: 21 40 B0        LD      HL,$B040            
1F8A: 01 00 18        LD      BC,$1800            

loc_1f8d:
1F8D: 71              LD      (HL),C              
1F8E: 2C              INC     L                   
1F8F: 10 FC           DJNZ    $1F8D               ; {code.loc_1f8d}
1F91: CD BC 27        CALL    $27BC               ; {code.clearCollisionSpriteBlock}

loc_1f94:
1F94: 3E 20           LD      A,$20               
1F96: 32 6A 82        LD      ($826A),A           ; {hard.workRam+26A}
1F99: 3E 80           LD      A,$80               
1F9B: DF              RST     $18                 
1F9C: 21 44 80        LD      HL,$8044            
1F9F: AF              XOR     A                   
1FA0: 77              LD      (HL),A              
1FA1: 23              INC     HL                  
1FA2: 77              LD      (HL),A              
1FA3: 23              INC     HL                  
1FA4: 77              LD      (HL),A              
1FA5: 23              INC     HL                  
1FA6: 36 F0           LD      (HL),$F0            
1FA8: D1              POP     DE                  
1FA9: E1              POP     HL                  
1FAA: AF              XOR     A                   
1FAB: 32 9B 82        LD      ($829B),A           ; {hard.workRam+29B}
1FAE: 32 EA 83        LD      ($83EA),A           ; {hard.workRam+3EA}
1FB1: 32 4D 82        LD      ($824D),A           ; {hard.workRam+24D}
1FB4: 32 49 82        LD      ($8249),A           ; {hard.workRam+249}
1FB7: 32 51 82        LD      ($8251),A           ; {hard.workRam+251}
1FBA: 3C              INC     A                   
1FBB: 32 6C 82        LD      ($826C),A           ; {hard.workRam+26C}
1FBE: 32 CD 83        LD      ($83CD),A           ; {hard.workRam+3CD}
1FC1: 3E 10           LD      A,$10               
1FC3: 32 68 82        LD      ($8268),A           ; {hard.workRam+268}
1FC6: C9              RET                         

; tick a gated countdown: while GATED_COUNTDOWN_ENABLE_FLAG (0x826c) is
; clear do nothing, else decrement GATED_COUNTDOWN_COUNTER (0x826a) and
; clear the enable flag when it reaches 0; memory-only
tickGatedCountdown:
1FC7: 3A 6C 82        LD      A,($826C)           ; {hard.workRam+26C}
1FCA: A7              AND     A                   
1FCB: C8              RET     Z                   
1FCC: 21 6A 82        LD      HL,$826A            
1FCF: 35              DEC     (HL)                
1FD0: C0              RET     NZ                  
1FD1: AF              XOR     A                   
1FD2: 32 6C 82        LD      ($826C),A           ; {hard.workRam+26C}
1FD5: C9              RET                         

; award a progress point when the frog reaches a new furthest row: range-
; check FROG_Y (0x8047) to [0x30,0xd0]; the 0xd0 edge seeds the high-water
; mark FROG_FURTHEST_ROW (0x8269) above the band on the first crossing,
; and a row nearer the top updates the mark and adds a BCD 1 via
; addScoreAndAwardExtraLife -- except the mid row 0x80, which awards
; nothing. Reached only from the UP-hop advance; memory-only
scoreFrogRowProgress:
1FD6: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
1FD9: FE 30           CP      $30                 
1FDB: D8              RET     C                   
1FDC: FE D0           CP      $D0                 
1FDE: 4F              LD      C,A                 
1FDF: 28 17           JR      Z,$1FF8             ; {code.loc_1ff8}
1FE1: D0              RET     NC                  

loc_1fe2:
1FE2: 3A 69 82        LD      A,($8269)           ; {hard.workRam+269}
1FE5: B9              CP      C                   
1FE6: D8              RET     C                   
1FE7: C8              RET     Z                   
1FE8: 79              LD      A,C                 
1FE9: 32 69 82        LD      ($8269),A           ; {hard.workRam+269}
1FEC: 11 01 00        LD      DE,$0001            
1FEF: FE 80           CP      $80                 
1FF1: C8              RET     Z                   
1FF2: E5              PUSH    HL                  
1FF3: CD E0 08        CALL    $08E0               ; {code.addScoreAndAwardExtraLife}
1FF6: E1              POP     HL                  
1FF7: C9              RET                         

loc_1ff8:
1FF8: 3A 69 82        LD      A,($8269)           ; {hard.workRam+269}
1FFB: A7              AND     A                   
1FFC: 20 E4           JR      NZ,$1FE2            ; {code.loc_1fe2}
1FFE: 3E E0           LD      A,$E0               
2000: 32 69 82        LD      ($8269),A           ; {hard.workRam+269}
2003: 18 DD           JR      $1FE2               ; {code.loc_1fe2}

; per-vblank river-scroll driver, run each play frame: copies each scroll
; object's +2 byte into its row-count shadow (SCROLL_STAMP_ROWCOUNT 0x811a
; / SCROLL_BAND_ROWSPAN 0x8119), steps object A's counter
; SCROLL_STAMP_PHASE (0x8110) by +1 (stamping a reveal column via
; stampScrollRevealColumn once it reaches 80) and object B's
; SCROLL_BAND_PHASE (0x8111) by +2 (blitting a band via blitScrollBand
; while below 160), then advances SCROLL_PHASE_COUNTER (0x826e); at phase
; 16/32/48 it feeds both object descriptors into the scroll-copy engine,
; phase 48 also clearing the phase counter; memory-only
advanceScrollLaneObjects:
2005: DD 21 73 82     LD      IX,$8273            
2009: DD 7E 02        LD      A,(IX+$02)          
200C: 32 1A 81        LD      ($811A),A           ; {hard.workRam+11A}
200F: 3A 10 81        LD      A,($8110)           ; {hard.workRam+110}
2012: 3C              INC     A                   
2013: 32 10 81        LD      ($8110),A           ; {hard.workRam+110}
2016: FE 50           CP      $50                 
2018: D4 FB 20        CALL    NC,$20FB            ; {code.stampScrollRevealColumn}
201B: DD 21 7C 82     LD      IX,$827C            
201F: DD 7E 02        LD      A,(IX+$02)          
2022: 32 19 81        LD      ($8119),A           ; {hard.workRam+119}
2025: 3A 11 81        LD      A,($8111)           ; {hard.workRam+111}
2028: 3C              INC     A                   
2029: 3C              INC     A                   
202A: 32 11 81        LD      ($8111),A           ; {hard.workRam+111}
202D: FE A0           CP      $A0                 
202F: DC 9C 21        CALL    C,$219C             ; {code.blitScrollBand}
2032: 3A 6E 82        LD      A,($826E)           ; {hard.workRam+26E}
2035: 3C              INC     A                   
2036: 32 6E 82        LD      ($826E),A           ; {hard.workRam+26E}
2039: FE 10           CP      $10                 
203B: CA 49 20        JP      Z,$2049             ; {code.loc_2049}
203E: FE 20           CP      $20                 
2040: CA 6F 20        JP      Z,$206F             ; {code.loc_206f}
2043: FE 30           CP      $30                 
2045: CA 95 20        JP      Z,$2095             ; {code.loc_2095}
2048: C9              RET                         

loc_2049:
2049: 21 73 82        LD      HL,$8273            
204C: 7E              LD      A,(HL)              
204D: 23              INC     HL                  
204E: 46              LD      B,(HL)              
204F: 21 1A 81        LD      HL,$811A            
2052: 4E              LD      C,(HL)              
2053: 11 23 14        LD      DE,$1423            
2056: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
2059: CD CC 20        CALL    $20CC               ; {code.blitScrollTileGrid}
205C: 21 7C 82        LD      HL,$827C            
205F: 7E              LD      A,(HL)              
2060: 23              INC     HL                  
2061: 46              LD      B,(HL)              
2062: 21 19 81        LD      HL,$8119            
2065: 4E              LD      C,(HL)              
2066: 11 5F 14        LD      DE,$145F            
2069: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
206C: C3 BF 20        JP      $20BF               ; {code.loc_20bf}

loc_206f:
206F: 21 73 82        LD      HL,$8273            
2072: 7E              LD      A,(HL)              
2073: 23              INC     HL                  
2074: 46              LD      B,(HL)              
2075: 21 1A 81        LD      HL,$811A            
2078: 4E              LD      C,(HL)              
2079: 11 2B 14        LD      DE,$142B            
207C: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
207F: CD CC 20        CALL    $20CC               ; {code.blitScrollTileGrid}
2082: 21 7C 82        LD      HL,$827C            
2085: 7E              LD      A,(HL)              
2086: 23              INC     HL                  
2087: 46              LD      B,(HL)              
2088: 21 19 81        LD      HL,$8119            
208B: 4E              LD      C,(HL)              
208C: 11 73 14        LD      DE,$1473            
208F: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
2092: C3 BF 20        JP      $20BF               ; {code.loc_20bf}

loc_2095:
2095: 21 73 82        LD      HL,$8273            
2098: 7E              LD      A,(HL)              
2099: 23              INC     HL                  
209A: 46              LD      B,(HL)              
209B: 21 1A 81        LD      HL,$811A            
209E: 4E              LD      C,(HL)              
209F: 11 33 14        LD      DE,$1433            
20A2: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
20A5: AF              XOR     A                   
20A6: 32 6E 82        LD      ($826E),A           ; {hard.workRam+26E}
20A9: CD CC 20        CALL    $20CC               ; {code.blitScrollTileGrid}
20AC: 21 7C 82        LD      HL,$827C            
20AF: 7E              LD      A,(HL)              
20B0: 23              INC     HL                  
20B1: 46              LD      B,(HL)              
20B2: 21 19 81        LD      HL,$8119            
20B5: 4E              LD      C,(HL)              
20B6: 11 87 14        LD      DE,$1487            
20B9: 32 B1 81        LD      ($81B1),A           ; {hard.workRam+1B1}
20BC: C3 BF 20        JP      $20BF               ; {code.loc_20bf}

loc_20bf:
20BF: 2A F5 13        LD      HL,($13F5)          ; {hard.rom+13F5}
20C2: ED 53 01 80     LD      ($8001),DE          ; {hard.workRam+1}
20C6: 78              LD      A,B                 
20C7: 32 03 80        LD      ($8003),A           ; {hard.workRam+3}
20CA: 18 0B           JR      $20D7               ; {code.loc_20d7}

; scroll-copy engine: stamp a source block into VRAM as a grid of two-byte
; column pairs -- save the source pointer/row-count to scratch
; (SCROLL_COPY_SRC_PTR 0x8001 / SCROLL_COPY_ROWCOUNT 0x8003), then for C
; columns copy B rows of a pair from the source (restarted at the top of
; each column) down the destination at a 32-byte row pitch, advancing by
; SCROLL_COPY_COLUMN_STRIDE (0x81b1) between columns; a count of 0 runs
; 256. The default entry takes its VRAM base from SCROLL_COPY_DEST_PTR
; (0x13ef), the alt entry from SCROLL_COPY_DEST_PTR_ALT (0x13f5). Live-in
; DE source / B rows / C columns; memory-only
blitScrollTileGrid:
20CC: 2A EF 13        LD      HL,($13EF)          ; {hard.rom+13EF}
20CF: ED 53 01 80     LD      ($8001),DE          ; {hard.workRam+1}
20D3: 78              LD      A,B                 
20D4: 32 03 80        LD      ($8003),A           ; {hard.workRam+3}

loc_20d7:
20D7: 1A              LD      A,(DE)              
20D8: 77              LD      (HL),A              
20D9: 23              INC     HL                  
20DA: 13              INC     DE                  
20DB: 1A              LD      A,(DE)              
20DC: 77              LD      (HL),A              
20DD: 2B              DEC     HL                  
20DE: D5              PUSH    DE                  
20DF: 11 20 00        LD      DE,$0020            
20E2: 19              ADD     HL,DE               
20E3: D1              POP     DE                  
20E4: 13              INC     DE                  
20E5: 10 F0           DJNZ    $20D7               ; {code.loc_20d7}
20E7: 3A B1 81        LD      A,($81B1)           ; {hard.workRam+1B1}
20EA: 5F              LD      E,A                 
20EB: 16 00           LD      D,$00               
20ED: 19              ADD     HL,DE               
20EE: 3A 03 80        LD      A,($8003)           ; {hard.workRam+3}
20F1: 47              LD      B,A                 
20F2: ED 5B 01 80     LD      DE,($8001)          ; {hard.workRam+1}
20F6: 0D              DEC     C                   
20F7: C2 D7 20        JP      NZ,$20D7            ; {code.loc_20d7}
20FA: C9              RET                         

; scroll-reveal column stamp: build a VRAM address from the scroll
; object's row/column/row-count fields (SCROLL_OBJECT_BLOCK_BASE 0x8273
; +0/+1/+2), then dispatch on SCROLL_STAMP_PHASE (0x8110) -- phases 80/208
; use SCROLL_STAMP_TABLE_80_208, 128/176 use SCROLL_STAMP_TABLE_128_176
; and clear SCROLL_EDGE_FLAG (0x8107), 160 uses SCROLL_STAMP_TABLE_160 and
; sets that flag, any other phase stamps nothing -- and always writes the
; row-count-minus-one mirror SCROLL_STAMP_ROWCOUNT (0x811a); memory-only
stampScrollRevealColumn:
20FB: DD 21 73 82     LD      IX,$8273            
20FF: AF              XOR     A                   
2100: 67              LD      H,A                 
2101: DD 46 01        LD      B,(IX+$01)          

loc_2104:
2104: C6 20           ADD     A,$20               
2106: 10 FC           DJNZ    $2104               ; {code.loc_2104}
2108: 4F              LD      C,A                 
2109: DD 6E 00        LD      L,(IX+$00)          
210C: 09              ADD     HL,BC               
210D: 5D              LD      E,L                 
210E: 54              LD      D,H                 
210F: AF              XOR     A                   
2110: 6F              LD      L,A                 
2111: 67              LD      H,A                 
2112: DD 46 02        LD      B,(IX+$02)          
2115: 05              DEC     B                   

loc_2116:
2116: 19              ADD     HL,DE               
2117: 10 FD           DJNZ    $2116               ; {code.loc_2116}
2119: 11 08 A8        LD      DE,$A808            
211C: 19              ADD     HL,DE               
211D: 0E 02           LD      C,$02               
211F: 3A 10 81        LD      A,($8110)           ; {hard.workRam+110}
2122: FE 50           CP      $50                 
2124: CA 3E 21        JP      Z,$213E             ; {code.loc_213e}
2127: FE 80           CP      $80                 
2129: CA 4C 21        JP      Z,$214C             ; {code.loc_214c}
212C: FE A0           CP      $A0                 
212E: CA 65 21        JP      Z,$2165             ; {code.loc_2165}
2131: FE B0           CP      $B0                 
2133: CA 4C 21        JP      Z,$214C             ; {code.loc_214c}
2136: FE D0           CP      $D0                 
2138: CA 3E 21        JP      Z,$213E             ; {code.loc_213e}
213B: C3 88 21        JP      $2188               ; {code.loc_2188}

loc_213e:
213E: 06 02           LD      B,$02               
2140: 11 90 21        LD      DE,$2190            
2143: CD 78 21        CALL    $2178               ; {code.loc_2178}
2146: 0D              DEC     C                   
2147: 20 F5           JR      NZ,$213E            ; {code.loc_213e}
2149: C3 88 21        JP      $2188               ; {code.loc_2188}

loc_214c:
214C: 06 02           LD      B,$02               
214E: 11 94 21        LD      DE,$2194            
2151: CD 78 21        CALL    $2178               ; {code.loc_2178}
2154: 0D              DEC     C                   
2155: 20 F5           JR      NZ,$214C            ; {code.loc_214c}
2157: 3A 07 81        LD      A,($8107)           ; {hard.workRam+107}
215A: A7              AND     A                   
215B: CA 88 21        JP      Z,$2188             ; {code.loc_2188}
215E: AF              XOR     A                   
215F: 32 07 81        LD      ($8107),A           ; {hard.workRam+107}
2162: C3 88 21        JP      $2188               ; {code.loc_2188}

loc_2165:
2165: 06 02           LD      B,$02               
2167: 11 98 21        LD      DE,$2198            
216A: CD 78 21        CALL    $2178               ; {code.loc_2178}
216D: 0D              DEC     C                   
216E: 20 F5           JR      NZ,$2165            ; {code.loc_2165}
2170: 3E 01           LD      A,$01               
2172: 32 07 81        LD      ($8107),A           ; {hard.workRam+107}
2175: C3 88 21        JP      $2188               ; {code.loc_2188}

loc_2178:
2178: 1A              LD      A,(DE)              
2179: 77              LD      (HL),A              
217A: 13              INC     DE                  
217B: 23              INC     HL                  
217C: 1A              LD      A,(DE)              
217D: 77              LD      (HL),A              
217E: 13              INC     DE                  
217F: D5              PUSH    DE                  
2180: 11 1F 00        LD      DE,$001F            
2183: 19              ADD     HL,DE               
2184: D1              POP     DE                  
2185: 10 F1           DJNZ    $2178               ; {code.loc_2178}
2187: C9              RET                         

loc_2188:
2188: DD 7E 02        LD      A,(IX+$02)          
218B: 3D              DEC     A                   
218C: 32 1A 81        LD      ($811A),A           ; {hard.workRam+11A}
218F: C9              RET                         

; ---- $2190-$219B: data ----
2190: 94 95 96 97 98 99 9A 9B 10 10 10 10

; scroll-band blitter: from the 3-byte descriptor at
; SCROLL_BAND_DESCRIPTOR_BASE (0x827c: column / units / rows) compute a
; video-RAM band base (SCROLL_BAND_VRAM_BASE 0xa80e + stride*rowSteps),
; then SCROLL_BAND_PHASE (0x8111) selects one of three 4-byte source rows
; (SCROLL_BAND_ROW_A/B/C) blitted 6 rows down the band; raises
; SCROLL_WRAP_LATCH (0x8108) on the mode-80 phase, clears it on modes
; 48/96, and stores rows-1 to SCROLL_BAND_ROWSPAN (0x8119); memory-only
blitScrollBand:
219C: DD 21 7C 82     LD      IX,$827C            
21A0: AF              XOR     A                   
21A1: 67              LD      H,A                 
21A2: DD 46 01        LD      B,(IX+$01)          

loc_21a5:
21A5: C6 20           ADD     A,$20               
21A7: 10 FC           DJNZ    $21A5               ; {code.loc_21a5}
21A9: 4F              LD      C,A                 
21AA: DD 6E 00        LD      L,(IX+$00)          
21AD: 09              ADD     HL,BC               
21AE: 5D              LD      E,L                 
21AF: 54              LD      D,H                 
21B0: AF              XOR     A                   
21B1: 6F              LD      L,A                 
21B2: 67              LD      H,A                 
21B3: DD 46 02        LD      B,(IX+$02)          
21B6: 05              DEC     B                   

loc_21b7:
21B7: 19              ADD     HL,DE               
21B8: 10 FD           DJNZ    $21B7               ; {code.loc_21b7}
21BA: 11 0E A8        LD      DE,$A80E            
21BD: 19              ADD     HL,DE               
21BE: 0E 03           LD      C,$03               
21C0: 3A 11 81        LD      A,($8111)           ; {hard.workRam+111}
21C3: FE 00           CP      $00                 
21C5: CA DF 21        JP      Z,$21DF             ; {code.loc_21df}
21C8: FE 30           CP      $30                 
21CA: CA ED 21        JP      Z,$21ED             ; {code.loc_21ed}
21CD: FE 50           CP      $50                 
21CF: CA 06 22        JP      Z,$2206             ; {code.loc_2206}
21D2: FE 60           CP      $60                 
21D4: CA ED 21        JP      Z,$21ED             ; {code.loc_21ed}
21D7: FE 70           CP      $70                 
21D9: CA DF 21        JP      Z,$21DF             ; {code.loc_21df}
21DC: C3 29 22        JP      $2229               ; {code.loc_2229}

loc_21df:
21DF: 06 02           LD      B,$02               
21E1: 11 31 22        LD      DE,$2231            
21E4: CD 19 22        CALL    $2219               ; {code.loc_2219}
21E7: 0D              DEC     C                   
21E8: 20 F5           JR      NZ,$21DF            ; {code.loc_21df}
21EA: C3 29 22        JP      $2229               ; {code.loc_2229}

loc_21ed:
21ED: 06 02           LD      B,$02               
21EF: 11 35 22        LD      DE,$2235            
21F2: CD 19 22        CALL    $2219               ; {code.loc_2219}
21F5: 0D              DEC     C                   
21F6: 20 F5           JR      NZ,$21ED            ; {code.loc_21ed}
21F8: 3A 08 81        LD      A,($8108)           ; {hard.workRam+108}
21FB: A7              AND     A                   
21FC: CA 29 22        JP      Z,$2229             ; {code.loc_2229}
21FF: AF              XOR     A                   
2200: 32 08 81        LD      ($8108),A           ; {hard.workRam+108}
2203: C3 29 22        JP      $2229               ; {code.loc_2229}

loc_2206:
2206: 06 02           LD      B,$02               
2208: 11 39 22        LD      DE,$2239            
220B: CD 19 22        CALL    $2219               ; {code.loc_2219}
220E: 0D              DEC     C                   
220F: 20 F5           JR      NZ,$2206            ; {code.loc_2206}
2211: 3E 01           LD      A,$01               
2213: 32 08 81        LD      ($8108),A           ; {hard.workRam+108}
2216: C3 29 22        JP      $2229               ; {code.loc_2229}

loc_2219:
2219: 1A              LD      A,(DE)              
221A: 77              LD      (HL),A              
221B: 13              INC     DE                  
221C: 23              INC     HL                  
221D: 1A              LD      A,(DE)              
221E: 77              LD      (HL),A              
221F: 13              INC     DE                  
2220: D5              PUSH    DE                  
2221: 11 1F 00        LD      DE,$001F            
2224: 19              ADD     HL,DE               
2225: D1              POP     DE                  
2226: 10 F1           DJNZ    $2219               ; {code.loc_2219}
2228: C9              RET                         

loc_2229:
2229: DD 7E 02        LD      A,(IX+$02)          
222C: 3D              DEC     A                   
222D: 32 19 81        LD      ($8119),A           ; {hard.workRam+119}
2230: C9              RET                         

; ---- $2231-$223C: data ----
2231: 94 95 96 97 98 99 9A 9B 10 10 10 10

; load the active player's per-difficulty lane-parameter block: read the
; difficulty index (PLAYER1_DIFFICULTY_INDEX 0x8293 or
; PLAYER2_DIFFICULTY_INDEX 0x8294, chosen by ACTIVE_PLAYER 0x83fd), follow
; the little-endian pointer table LANE_PARAM_PTR_TABLE (0x2260) at
; 2*difficulty, and copy 33 bytes of that block into
; ACTIVE_LANE_PARAM_BLOCK (0x8270); memory-only
loadActivePlayerLaneParams:
223D: D9              EXX                         
223E: 21 93 82        LD      HL,$8293            
2241: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
2244: 3D              DEC     A                   
2245: 28 01           JR      Z,$2248             ; {code.loc_2248}
2247: 2C              INC     L                   

loc_2248:
2248: 7E              LD      A,(HL)              
2249: 01 60 22        LD      BC,$2260            
224C: 26 00           LD      H,$00               
224E: 6F              LD      L,A                 
224F: 85              ADD     A,L                 
2250: 6F              LD      L,A                 
2251: 09              ADD     HL,BC               
2252: 5E              LD      E,(HL)              
2253: 23              INC     HL                  
2254: 56              LD      D,(HL)              
2255: EB              EX      DE,HL               
2256: 11 70 82        LD      DE,$8270            
2259: 01 21 00        LD      BC,$0021            
225C: ED B0           LDIR                        
225E: D9              EXX                         
225F: C9              RET                         

; ---- $2260-$230E: data ----
2260: 6A 22 8B 22 AC 22 CD 22 EE 22 60 08 03 60 04 04
2270: 80 0C 02 80 06 03 40 06 04 80 02 04 E0 04 02 60
2280: 02 01 C0 02 03 C0 02 03 E0 02 03 60 08 03 40 04
2290: 05 80 0C 01 60 06 03 C0 06 03 80 02 04 E0 04 03
22A0: 60 02 02 E0 02 04 C0 02 04 E0 02 04 60 08 02 80
22B0: 04 04 80 0C 01 C0 06 03 60 06 03 80 02 04 A0 04
22C0: 03 E0 02 02 A0 02 05 E0 02 04 C0 02 04 60 08 02
22D0: A0 04 03 80 0C 01 E0 06 02 80 06 03 80 02 04 80
22E0: 04 04 C0 02 03 E0 02 04 A0 02 04 E0 02 04 60 08
22F0: 01 E0 04 03 80 0C 01 A0 06 02 E0 06 02 80 02 04
2300: 60 04 03 A0 02 04 80 02 05 C0 02 04 A0 02 05

; once-per-life start-of-play setup, run from the main loop: returns
; unless GAME_MODE (0x83d6) == 1 (active play) and the run flag
; INTRO_COUNTER_829B (0x829b) is still 0; then clears the credit-column
; latch (CREDIT_COLUMN_CLEAR_LATCH 0x83b4) and lays out the board --
; display field, score field, active-player lane params, frog + arm
; objects, a status-row tile column (STATUS_ROW_VRAM_BASE 0xa850), the
; frog object, and the frog-animation dispatcher -- momentarily clearing
; then raising TWO_PLAYER_START_FLAG (0x825b) around the render and
; finally setting the run flag so the layout runs exactly once; memory-
; only
setUpPlayStartOnce:
230F: 3A D6 83        LD      A,($83D6)           ; {hard.workRam+3D6}
2312: 3D              DEC     A                   
2313: C0              RET     NZ                  
2314: 3A 9B 82        LD      A,($829B)           ; {hard.workRam+29B}
2317: A7              AND     A                   
2318: C0              RET     NZ                  
2319: 32 B4 83        LD      ($83B4),A           ; {hard.workRam+3B4}
231C: CD BA 0A        CALL    $0ABA               ; {code.initDisplayFieldOnce}
231F: CD 29 06        CALL    $0629               ; {code.clearAndSeedScoreField}
2322: CD 3D 22        CALL    $223D               ; {code.loadActivePlayerLaneParams}
2325: AF              XOR     A                   
2326: 32 5B 82        LD      ($825B),A           ; {hard.workRam+25B}
2329: CD 52 19        CALL    $1952               ; {code.renderFrogAndArmObjects}
232C: 21 50 A8        LD      HL,$A850            
232F: CD E2 19        CALL    $19E2               ; {code.blitFourTileGroupColumn}
2332: CD AA 09        CALL    $09AA               ; {code.resetFrogObject}
2335: CD AF 0F        CALL    $0FAF               ; {code.dispatchFrogAnimationArm}

loc_2338:
2338: 3E 01           LD      A,$01               
233A: 32 5B 82        LD      ($825B),A           ; {hard.workRam+25B}
233D: 32 9B 82        LD      ($829B),A           ; {hard.workRam+29B}
2340: C9              RET                         

; in-play per-frame update dispatcher: returns unless GAME_MODE (0x83d6)
; == 1 and the run flag INTRO_COUNTER_829B (0x829b) is set; otherwise runs
; the fixed per-frame sub-engine sequence -- attract-demo hop driver,
; collision/input orchestrator, hop continuation, frog-scene render +
; timer tick, score-display countdown, scroll driver, animation-frame
; buffer, lane-move resolver, death animation, gated countdown, and the
; lane-object mover; memory-only
driveInPlayFrameUpdate:
2341: 3A D6 83        LD      A,($83D6)           ; {hard.workRam+3D6}
2344: 3D              DEC     A                   
2345: C0              RET     NZ                  
2346: 3A 9B 82        LD      A,($829B)           ; {hard.workRam+29B}
2349: A7              AND     A                   
234A: C8              RET     Z                   
234B: CD 6D 23        CALL    $236D               ; {code.driveAttractDemoFrogHop}
234E: CD 55 1A        CALL    $1A55               ; {code.orchestrateCollisionsAndFrogInput}
2351: CD B7 23        CALL    $23B7               ; {code.advanceAttractDemoFrogHop}
2354: CD 42 09        CALL    $0942               ; {code.renderFrogSceneAndTickTimer}
2357: CD 70 08        CALL    $0870               ; {code.driveScoreDisplayCountdown}
235A: CD 05 20        CALL    $2005               ; {code.advanceScrollLaneObjects}
235D: CD 02 18        CALL    $1802               ; {code.advanceAnimationFrameBuffer}
2360: CD BF 11        CALL    $11BF               ; {code.dispatchFrogMoveAgainstLanes}
2363: CD F8 16        CALL    $16F8               ; {code.driveFrogDeathAnimation}
2366: CD C7 1F        CALL    $1FC7               ; {code.tickGatedCountdown}
2369: CD B7 14        CALL    $14B7               ; {code.moveLaneObjectsAndCarryFrog}

; ---- $236C-$236C: data ----
236C: C9

; attract-demo scripted hop-begin driver (GAME_MODE 0x83d6 == 1, PLAY_FLAG
; 0x83fe == 0): returns while input is locked (GATED_COUNTDOWN_ENABLE_FLAG
; 0x826c or HOLD_FLAG 0x8004 set) or the dwell counter ATTRACT_HOP_DWELL
; (0x8299) is still running (just ticks it down); otherwise reloads the
; dwell, advances the phase index IN_PLAY_BOARD_STATE_BYTE (0x829a), reads
; that phase's frame code from the script table HOP_FRAME_TABLE (0x2e68)
; and begins one directional hop (0x02 LEFT / 0x05 RIGHT / 0x08 UP / 0x0b
; DOWN), a no-op frame (0x0e), or on 0xff resets the phase and clears
; TWO_PLAYER_START_FLAG (0x825b); drives the auto-frog across the board,
; paired 1:1 with advanceAttractDemoFrogHop.
driveAttractDemoFrogHop:
236D: 3A 6C 82        LD      A,($826C)           ; {hard.workRam+26C}
2370: B7              OR      A                   
2371: C0              RET     NZ                  
2372: 3A 04 80        LD      A,($8004)           ; {hard.workRam+4}
2375: A7              AND     A                   
2376: C0              RET     NZ                  
2377: 3A 99 82        LD      A,($8299)           ; {hard.workRam+299}
237A: A7              AND     A                   
237B: C2 E6 23        JP      NZ,$23E6            ; {code.loc_23e6}
237E: 11 47 80        LD      DE,$8047            
2381: 3E 30           LD      A,$30               
2383: 32 99 82        LD      ($8299),A           ; {hard.workRam+299}
2386: 21 9A 82        LD      HL,$829A            
2389: 34              INC     (HL)                
238A: 4E              LD      C,(HL)              
238B: 06 00           LD      B,$00               
238D: 21 68 2E        LD      HL,$2E68            
2390: 09              ADD     HL,BC               
2391: 4E              LD      C,(HL)              
2392: 0C              INC     C                   
2393: CA AC 23        JP      Z,$23AC             ; {code.loc_23ac}
2396: 21 9C 23        LD      HL,$239C            
2399: 09              ADD     HL,BC               
239A: E5              PUSH    HL                  
239B: 21 44 80        LD      HL,$8044            
239E: C9              RET                         

; ---- $239F-$23AB: data ----
239F: C3 A0 1C C3 41 1C C3 E4 1B C3 8B 1B C9

loc_23ac:
23AC: AF              XOR     A                   
23AD: 32 9A 82        LD      ($829A),A           ; {hard.workRam+29A}
23B0: 32 99 82        LD      ($8299),A           ; {hard.workRam+299}
23B3: 32 5B 82        LD      ($825B),A           ; {hard.workRam+25B}
23B6: C9              RET                         

; per-vblank continuation of any in-progress directional hop: for each
; direction, if its hop-active flag (FROG_HOP_DOWN_ACTIVE 0x8248..
; FROG_HOP_LEFT_ACTIVE 0x824b) is set, step that hop one frame via its
; advance handler; otherwise clear that direction's arrival mirror
; (FROG_HOP_DOWN_ARRIVAL 0x824c.. FROG_HOP_LEFT_ARRIVAL 0x824f); memory-
; only
advanceAttractDemoFrogHop:
23B7: 21 44 80        LD      HL,$8044            
23BA: 11 47 80        LD      DE,$8047            
23BD: 3A 48 82        LD      A,($8248)           ; {hard.workRam+248}
23C0: A7              AND     A                   
23C1: C2 BA 1B        JP      NZ,$1BBA            ; {code.advanceFrogHopDown}
23C4: 32 4C 82        LD      ($824C),A           ; {hard.workRam+24C}
23C7: 3A 49 82        LD      A,($8249)           ; {hard.workRam+249}
23CA: A7              AND     A                   
23CB: C2 0D 1C        JP      NZ,$1C0D            ; {code.advanceFrogHopUp}
23CE: 32 4D 82        LD      ($824D),A           ; {hard.workRam+24D}
23D1: 3A 4A 82        LD      A,($824A)           ; {hard.workRam+24A}
23D4: A7              AND     A                   
23D5: C2 76 1C        JP      NZ,$1C76            ; {code.advanceFrogHopRight}
23D8: 32 4E 82        LD      ($824E),A           ; {hard.workRam+24E}
23DB: 3A 4B 82        LD      A,($824B)           ; {hard.workRam+24B}
23DE: A7              AND     A                   
23DF: C2 D5 1C        JP      NZ,$1CD5            ; {code.advanceFrogHopLeft}
23E2: 32 4F 82        LD      ($824F),A           ; {hard.workRam+24F}
23E5: C9              RET                         

loc_23e6:
23E6: 3D              DEC     A                   
23E7: 32 99 82        LD      ($8299),A           ; {hard.workRam+299}
23EA: C9              RET                         

loc_23eb:
23EB: 3A 23 81        LD      A,($8123)           ; {hard.workRam+123}
23EE: 3C              INC     A                   
23EF: 32 23 81        LD      ($8123),A           ; {hard.workRam+123}
23F2: FE 06           CP      $06                 
23F4: D8              RET     C                   
23F5: AF              XOR     A                   
23F6: 32 23 81        LD      ($8123),A           ; {hard.workRam+123}
23F9: C9              RET                         

; stamp the fly bonus creature into a home bay: for slot 1..5 read from
; HOME_BAY_SLOT_CURSOR (0x8123) (published to PENDING_HOME_BAY_SLOT
; 0x8121), when that bay's occupancy gate is clear (bank picked by
; ACTIVE_PLAYER 0x83fd), stamp the 2x2 fly tiles (44/45 over 46/47) into
; that bay's VRAM base (HOME_SLOT1_VRAM.. HOME_SLOT5_VRAM); memory-only
stampHomeBayFly:
23FA: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
23FD: 4F              LD      C,A                 
23FE: 3A 23 81        LD      A,($8123)           ; {hard.workRam+123}
2401: 32 21 81        LD      ($8121),A           ; {hard.workRam+121}
2404: FE 01           CP      $01                 
2406: CA 1E 24        JP      Z,$241E             ; {code.loc_241e}
2409: FE 02           CP      $02                 
240B: CA 33 24        JP      Z,$2433             ; {code.loc_2433}
240E: FE 03           CP      $03                 
2410: CA 48 24        JP      Z,$2448             ; {code.loc_2448}
2413: FE 04           CP      $04                 
2415: CA 5D 24        JP      Z,$245D             ; {code.loc_245d}
2418: FE 05           CP      $05                 
241A: CA 72 24        JP      Z,$2472             ; {code.loc_2472}
241D: C9              RET                         

loc_241e:
241E: 0D              DEC     C                   
241F: 20 0B           JR      NZ,$242C            ; {code.loc_242c}
2421: 3A 5E 82        LD      A,($825E)           ; {hard.workRam+25E}
2424: A7              AND     A                   
2425: C0              RET     NZ                  

loc_2426:
2426: 21 64 AB        LD      HL,$AB64            
2429: C3 87 24        JP      $2487               ; {code.loc_2487}

loc_242c:
242C: 3A 63 82        LD      A,($8263)           ; {hard.workRam+263}
242F: A7              AND     A                   
2430: C0              RET     NZ                  
2431: 18 F3           JR      $2426               ; {code.loc_2426}

loc_2433:
2433: 0D              DEC     C                   
2434: 20 0B           JR      NZ,$2441            ; {code.loc_2441}
2436: 3A 5F 82        LD      A,($825F)           ; {hard.workRam+25F}
2439: A7              AND     A                   
243A: C0              RET     NZ                  

loc_243b:
243B: 21 A4 AA        LD      HL,$AAA4            
243E: C3 87 24        JP      $2487               ; {code.loc_2487}

loc_2441:
2441: 3A 64 82        LD      A,($8264)           ; {hard.workRam+264}
2444: A7              AND     A                   
2445: C0              RET     NZ                  
2446: 18 F3           JR      $243B               ; {code.loc_243b}

loc_2448:
2448: 0D              DEC     C                   
2449: 20 0B           JR      NZ,$2456            ; {code.loc_2456}
244B: 3A 60 82        LD      A,($8260)           ; {hard.workRam+260}
244E: A7              AND     A                   
244F: C0              RET     NZ                  

loc_2450:
2450: 21 E4 A9        LD      HL,$A9E4            
2453: C3 87 24        JP      $2487               ; {code.loc_2487}

loc_2456:
2456: 3A 65 82        LD      A,($8265)           ; {hard.workRam+265}
2459: A7              AND     A                   
245A: C0              RET     NZ                  
245B: 18 F3           JR      $2450               ; {code.loc_2450}

loc_245d:
245D: 0D              DEC     C                   
245E: 20 0B           JR      NZ,$246B            ; {code.loc_246b}
2460: 3A 61 82        LD      A,($8261)           ; {hard.workRam+261}
2463: A7              AND     A                   
2464: C0              RET     NZ                  

loc_2465:
2465: 21 24 A9        LD      HL,$A924            
2468: C3 87 24        JP      $2487               ; {code.loc_2487}

loc_246b:
246B: 3A 66 82        LD      A,($8266)           ; {hard.workRam+266}
246E: A7              AND     A                   
246F: C0              RET     NZ                  
2470: 18 F3           JR      $2465               ; {code.loc_2465}

loc_2472:
2472: 0D              DEC     C                   
2473: 20 0B           JR      NZ,$2480            ; {code.loc_2480}
2475: 3A 62 82        LD      A,($8262)           ; {hard.workRam+262}
2478: A7              AND     A                   
2479: C0              RET     NZ                  

loc_247a:
247A: 21 64 A8        LD      HL,$A864            
247D: C3 87 24        JP      $2487               ; {code.loc_2487}

loc_2480:
2480: 3A 67 82        LD      A,($8267)           ; {hard.workRam+267}
2483: A7              AND     A                   
2484: C0              RET     NZ                  
2485: 18 F3           JR      $247A               ; {code.loc_247a}

loc_2487:
2487: 36 2C           LD      (HL),$2C            
2489: 23              INC     HL                  
248A: 36 2D           LD      (HL),$2D            
248C: 01 1F 00        LD      BC,$001F            
248F: 09              ADD     HL,BC               
2490: 36 2E           LD      (HL),$2E            
2492: 23              INC     HL                  
2493: 36 2F           LD      (HL),$2F            
2495: C9              RET                         

; stamp the emerging gator into a home bay: for slot 1..5 read from
; HOME_BAY_SLOT_CURSOR (0x8123) (published to HOME_BAY_SLOT_CURSOR_MIRROR
; 0x8120), when that bay's occupancy gate is clear (bank picked by
; ACTIVE_PLAYER 0x83fd), stamp the 2x2 emerging-gator tiles (16/16 over
; 208/209) into that bay's VRAM base (HOME_SLOT1_VRAM.. HOME_SLOT5_VRAM);
; memory-only
stampHomeBayGatorEmerging:
2496: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
2499: 4F              LD      C,A                 
249A: 3A 23 81        LD      A,($8123)           ; {hard.workRam+123}
249D: 32 20 81        LD      ($8120),A           ; {hard.workRam+120}
24A0: FE 01           CP      $01                 
24A2: CA BA 24        JP      Z,$24BA             ; {code.loc_24ba}
24A5: FE 02           CP      $02                 
24A7: CA CF 24        JP      Z,$24CF             ; {code.loc_24cf}
24AA: FE 03           CP      $03                 
24AC: CA E4 24        JP      Z,$24E4             ; {code.loc_24e4}
24AF: FE 04           CP      $04                 
24B1: CA F9 24        JP      Z,$24F9             ; {code.loc_24f9}
24B4: FE 05           CP      $05                 
24B6: CA 0E 25        JP      Z,$250E             ; {code.loc_250e}
24B9: C9              RET                         

loc_24ba:
24BA: 0D              DEC     C                   
24BB: 20 0B           JR      NZ,$24C8            ; {code.loc_24c8}
24BD: 3A 5E 82        LD      A,($825E)           ; {hard.workRam+25E}
24C0: A7              AND     A                   
24C1: C0              RET     NZ                  

loc_24c2:
24C2: 21 64 AB        LD      HL,$AB64            
24C5: C3 23 25        JP      $2523               ; {code.loc_2523}

loc_24c8:
24C8: 3A 63 82        LD      A,($8263)           ; {hard.workRam+263}
24CB: A7              AND     A                   
24CC: C0              RET     NZ                  
24CD: 18 F3           JR      $24C2               ; {code.loc_24c2}

loc_24cf:
24CF: 0D              DEC     C                   
24D0: 20 0B           JR      NZ,$24DD            ; {code.loc_24dd}
24D2: 3A 5F 82        LD      A,($825F)           ; {hard.workRam+25F}
24D5: A7              AND     A                   
24D6: C0              RET     NZ                  

loc_24d7:
24D7: 21 A4 AA        LD      HL,$AAA4            
24DA: C3 23 25        JP      $2523               ; {code.loc_2523}

loc_24dd:
24DD: 3A 64 82        LD      A,($8264)           ; {hard.workRam+264}
24E0: A7              AND     A                   
24E1: C0              RET     NZ                  
24E2: 18 F3           JR      $24D7               ; {code.loc_24d7}

loc_24e4:
24E4: 0D              DEC     C                   
24E5: 20 0B           JR      NZ,$24F2            ; {code.loc_24f2}
24E7: 3A 60 82        LD      A,($8260)           ; {hard.workRam+260}
24EA: A7              AND     A                   
24EB: C0              RET     NZ                  

loc_24ec:
24EC: 21 E4 A9        LD      HL,$A9E4            
24EF: C3 23 25        JP      $2523               ; {code.loc_2523}

loc_24f2:
24F2: 3A 65 82        LD      A,($8265)           ; {hard.workRam+265}
24F5: A7              AND     A                   
24F6: C0              RET     NZ                  
24F7: 18 F3           JR      $24EC               ; {code.loc_24ec}

loc_24f9:
24F9: 0D              DEC     C                   
24FA: 20 0B           JR      NZ,$2507            ; {code.loc_2507}
24FC: 3A 61 82        LD      A,($8261)           ; {hard.workRam+261}
24FF: A7              AND     A                   
2500: C0              RET     NZ                  

loc_2501:
2501: 21 24 A9        LD      HL,$A924            
2504: C3 23 25        JP      $2523               ; {code.loc_2523}

loc_2507:
2507: 3A 66 82        LD      A,($8266)           ; {hard.workRam+266}
250A: A7              AND     A                   
250B: C0              RET     NZ                  
250C: 18 F3           JR      $2501               ; {code.loc_2501}

loc_250e:
250E: 0D              DEC     C                   
250F: 20 0B           JR      NZ,$251C            ; {code.loc_251c}
2511: 3A 62 82        LD      A,($8262)           ; {hard.workRam+262}
2514: A7              AND     A                   
2515: C0              RET     NZ                  

loc_2516:
2516: 21 64 A8        LD      HL,$A864            
2519: C3 23 25        JP      $2523               ; {code.loc_2523}

loc_251c:
251C: 3A 67 82        LD      A,($8267)           ; {hard.workRam+267}
251F: A7              AND     A                   
2520: C0              RET     NZ                  
2521: 18 F3           JR      $2516               ; {code.loc_2516}

loc_2523:
2523: 36 10           LD      (HL),$10            
2525: 23              INC     HL                  
2526: 36 10           LD      (HL),$10            
2528: 01 1F 00        LD      BC,$001F            
252B: 09              ADD     HL,BC               
252C: 36 D0           LD      (HL),$D0            
252E: 23              INC     HL                  
252F: 36 D1           LD      (HL),$D1            
2531: C9              RET                         

; stamp the fully-surfaced gator into a home bay: for slot 1..5 read from
; HOME_BAY_SLOT_CURSOR_MIRROR (0x8120) (published to PENDING_HOME_BAY_SLOT
; 0x8121), when that bay's occupancy gate is clear (bank picked by
; ACTIVE_PLAYER 0x83fd), stamp the 2x2 full-gator tiles (208/209 over
; 210/211) into that bay's VRAM base (HOME_SLOT1_VRAM.. HOME_SLOT5_VRAM);
; memory-only
stampHomeBayGatorFull:
2532: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
2535: 4F              LD      C,A                 
2536: 3A 20 81        LD      A,($8120)           ; {hard.workRam+120}
2539: 32 21 81        LD      ($8121),A           ; {hard.workRam+121}
253C: FE 01           CP      $01                 
253E: CA 56 25        JP      Z,$2556             ; {code.loc_2556}
2541: FE 02           CP      $02                 
2543: CA 6B 25        JP      Z,$256B             ; {code.loc_256b}
2546: FE 03           CP      $03                 
2548: CA 80 25        JP      Z,$2580             ; {code.loc_2580}
254B: FE 04           CP      $04                 
254D: CA 95 25        JP      Z,$2595             ; {code.loc_2595}
2550: FE 05           CP      $05                 
2552: CA AA 25        JP      Z,$25AA             ; {code.loc_25aa}
2555: C9              RET                         

loc_2556:
2556: 0D              DEC     C                   
2557: 20 0B           JR      NZ,$2564            ; {code.loc_2564}
2559: 3A 5E 82        LD      A,($825E)           ; {hard.workRam+25E}
255C: A7              AND     A                   
255D: C0              RET     NZ                  

loc_255e:
255E: 21 64 AB        LD      HL,$AB64            
2561: C3 BF 25        JP      $25BF               ; {code.loc_25bf}

loc_2564:
2564: 3A 63 82        LD      A,($8263)           ; {hard.workRam+263}
2567: A7              AND     A                   
2568: C0              RET     NZ                  
2569: 18 F3           JR      $255E               ; {code.loc_255e}

loc_256b:
256B: 0D              DEC     C                   
256C: 20 0B           JR      NZ,$2579            ; {code.loc_2579}
256E: 3A 5F 82        LD      A,($825F)           ; {hard.workRam+25F}
2571: A7              AND     A                   
2572: C0              RET     NZ                  

loc_2573:
2573: 21 A4 AA        LD      HL,$AAA4            
2576: C3 BF 25        JP      $25BF               ; {code.loc_25bf}

loc_2579:
2579: 3A 64 82        LD      A,($8264)           ; {hard.workRam+264}
257C: A7              AND     A                   
257D: C0              RET     NZ                  
257E: 18 F3           JR      $2573               ; {code.loc_2573}

loc_2580:
2580: 0D              DEC     C                   
2581: 20 0B           JR      NZ,$258E            ; {code.loc_258e}
2583: 3A 60 82        LD      A,($8260)           ; {hard.workRam+260}
2586: A7              AND     A                   
2587: C0              RET     NZ                  

loc_2588:
2588: 21 E4 A9        LD      HL,$A9E4            
258B: C3 BF 25        JP      $25BF               ; {code.loc_25bf}

loc_258e:
258E: 3A 65 82        LD      A,($8265)           ; {hard.workRam+265}
2591: A7              AND     A                   
2592: C0              RET     NZ                  
2593: 18 F3           JR      $2588               ; {code.loc_2588}

loc_2595:
2595: 0D              DEC     C                   
2596: 20 0B           JR      NZ,$25A3            ; {code.loc_25a3}
2598: 3A 61 82        LD      A,($8261)           ; {hard.workRam+261}
259B: A7              AND     A                   
259C: C0              RET     NZ                  

loc_259d:
259D: 21 24 A9        LD      HL,$A924            
25A0: C3 BF 25        JP      $25BF               ; {code.loc_25bf}

loc_25a3:
25A3: 3A 66 82        LD      A,($8266)           ; {hard.workRam+266}
25A6: A7              AND     A                   
25A7: C0              RET     NZ                  
25A8: 18 F3           JR      $259D               ; {code.loc_259d}

loc_25aa:
25AA: 0D              DEC     C                   
25AB: 20 0B           JR      NZ,$25B8            ; {code.loc_25b8}
25AD: 3A 62 82        LD      A,($8262)           ; {hard.workRam+262}
25B0: A7              AND     A                   
25B1: C0              RET     NZ                  

loc_25b2:
25B2: 21 64 A8        LD      HL,$A864            
25B5: C3 BF 25        JP      $25BF               ; {code.loc_25bf}

loc_25b8:
25B8: 3A 67 82        LD      A,($8267)           ; {hard.workRam+267}
25BB: A7              AND     A                   
25BC: C0              RET     NZ                  
25BD: 18 F3           JR      $25B2               ; {code.loc_25b2}

loc_25bf:
25BF: 36 D0           LD      (HL),$D0            
25C1: 23              INC     HL                  
25C2: 36 D1           LD      (HL),$D1            
25C4: 01 1F 00        LD      BC,$001F            
25C7: 09              ADD     HL,BC               
25C8: 36 D2           LD      (HL),$D2            
25CA: 23              INC     HL                  
25CB: 36 D3           LD      (HL),$D3            
25CD: C9              RET                         

; stamp one frog-home slot's 2x2 blank-home tile block (tile 16) into the
; bay selected by PENDING_HOME_BAY_SLOT (0x8121, 1..5) when that slot's
; per-player occupancy gate (bank picked by ACTIVE_PLAYER 0x83fd) is
; clear; then clear the PENDING_HOME_BAY_SLOT /
; HOME_BAY_SLOT_CURSOR_MIRROR (0x8120) selector pair unless HOLD_FLAG
; (0x8004) is set; memory-only
stampHomeBaySlot:
25CE: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
25D1: 4F              LD      C,A                 
25D2: 3A 21 81        LD      A,($8121)           ; {hard.workRam+121}
25D5: FE 01           CP      $01                 
25D7: CA EF 25        JP      Z,$25EF             ; {code.loc_25ef}
25DA: FE 02           CP      $02                 
25DC: CA 04 26        JP      Z,$2604             ; {code.loc_2604}
25DF: FE 03           CP      $03                 
25E1: CA 19 26        JP      Z,$2619             ; {code.loc_2619}
25E4: FE 04           CP      $04                 
25E6: CA 2E 26        JP      Z,$262E             ; {code.loc_262e}
25E9: FE 05           CP      $05                 
25EB: CA 43 26        JP      Z,$2643             ; {code.loc_2643}
25EE: C9              RET                         

loc_25ef:
25EF: 0D              DEC     C                   
25F0: 20 0B           JR      NZ,$25FD            ; {code.loc_25fd}
25F2: 3A 5E 82        LD      A,($825E)           ; {hard.workRam+25E}
25F5: A7              AND     A                   
25F6: C0              RET     NZ                  

loc_25f7:
25F7: 21 64 AB        LD      HL,$AB64            
25FA: C3 58 26        JP      $2658               ; {code.loc_2658}

loc_25fd:
25FD: 3A 63 82        LD      A,($8263)           ; {hard.workRam+263}
2600: A7              AND     A                   
2601: C0              RET     NZ                  
2602: 18 F3           JR      $25F7               ; {code.loc_25f7}

loc_2604:
2604: 0D              DEC     C                   
2605: 20 0B           JR      NZ,$2612            ; {code.loc_2612}
2607: 3A 5F 82        LD      A,($825F)           ; {hard.workRam+25F}
260A: A7              AND     A                   
260B: C0              RET     NZ                  

loc_260c:
260C: 21 A4 AA        LD      HL,$AAA4            
260F: C3 58 26        JP      $2658               ; {code.loc_2658}

loc_2612:
2612: 3A 64 82        LD      A,($8264)           ; {hard.workRam+264}
2615: A7              AND     A                   
2616: C0              RET     NZ                  
2617: 18 F3           JR      $260C               ; {code.loc_260c}

loc_2619:
2619: 0D              DEC     C                   
261A: 20 0B           JR      NZ,$2627            ; {code.loc_2627}
261C: 3A 60 82        LD      A,($8260)           ; {hard.workRam+260}
261F: A7              AND     A                   
2620: C0              RET     NZ                  

loc_2621:
2621: 21 E4 A9        LD      HL,$A9E4            
2624: C3 58 26        JP      $2658               ; {code.loc_2658}

loc_2627:
2627: 3A 65 82        LD      A,($8265)           ; {hard.workRam+265}
262A: A7              AND     A                   
262B: C0              RET     NZ                  
262C: 18 F3           JR      $2621               ; {code.loc_2621}

loc_262e:
262E: 0D              DEC     C                   
262F: 20 0B           JR      NZ,$263C            ; {code.loc_263c}
2631: 3A 61 82        LD      A,($8261)           ; {hard.workRam+261}
2634: A7              AND     A                   
2635: C0              RET     NZ                  

loc_2636:
2636: 21 24 A9        LD      HL,$A924            
2639: C3 58 26        JP      $2658               ; {code.loc_2658}

loc_263c:
263C: 3A 66 82        LD      A,($8266)           ; {hard.workRam+266}
263F: A7              AND     A                   
2640: C0              RET     NZ                  
2641: 18 F3           JR      $2636               ; {code.loc_2636}

loc_2643:
2643: 0D              DEC     C                   
2644: 20 0B           JR      NZ,$2651            ; {code.loc_2651}
2646: 3A 62 82        LD      A,($8262)           ; {hard.workRam+262}
2649: A7              AND     A                   
264A: C0              RET     NZ                  

loc_264b:
264B: 21 64 A8        LD      HL,$A864            
264E: C3 58 26        JP      $2658               ; {code.loc_2658}

loc_2651:
2651: 3A 67 82        LD      A,($8267)           ; {hard.workRam+267}
2654: A7              AND     A                   
2655: C0              RET     NZ                  
2656: 18 F3           JR      $264B               ; {code.loc_264b}

loc_2658:
2658: 36 10           LD      (HL),$10            
265A: 23              INC     HL                  
265B: 36 10           LD      (HL),$10            
265D: 01 1F 00        LD      BC,$001F            
2660: 09              ADD     HL,BC               
2661: 36 10           LD      (HL),$10            
2663: 23              INC     HL                  
2664: 36 10           LD      (HL),$10            
2666: 3A 04 80        LD      A,($8004)           ; {hard.workRam+4}
2669: A7              AND     A                   
266A: C0              RET     NZ                  
266B: AF              XOR     A                   
266C: 32 21 81        LD      ($8121),A           ; {hard.workRam+121}
266F: 32 20 81        LD      ($8120),A           ; {hard.workRam+120}
2672: C9              RET                         

loc_2673:
2673: 3A 20 81        LD      A,($8120)           ; {hard.workRam+120}
2676: A7              AND     A                   
2677: C2 93 26        JP      NZ,$2693            ; {code.loc_2693}
267A: 21 5C 80        LD      HL,$805C            
267D: 70              LD      (HL),B              
267E: 23              INC     HL                  
267F: 36 19           LD      (HL),$19            
2681: 23              INC     HL                  
2682: 36 03           LD      (HL),$03            
2684: 23              INC     HL                  
2685: 36 20           LD      (HL),$20            
2687: 3E A0           LD      A,$A0               
2689: 32 40 83        LD      ($8340),A           ; {hard.workRam+340}
268C: 11 20 00        LD      DE,$0020            
268F: CD E0 08        CALL    $08E0               ; {code.addScoreAndAwardExtraLife}
2692: C9              RET                         

loc_2693:
2693: 3E 01           LD      A,$01               
2695: 32 04 80        LD      ($8004),A           ; {hard.workRam+4}
2698: E1              POP     HL                  
2699: C9              RET                         

; clear the 4-byte home-goal-award block GOAL_AWARD_RECORD (0x805c-0x805f)
; to zero; memory-only
clearFourByteCounterBlock:
269A: 21 5C 80        LD      HL,$805C            
269D: AF              XOR     A                   
269E: 77              LD      (HL),A              
269F: 23              INC     HL                  
26A0: 77              LD      (HL),A              
26A1: 23              INC     HL                  
26A2: 77              LD      (HL),A              
26A3: 23              INC     HL                  
26A4: 77              LD      (HL),A              
26A5: C9              RET                         

; fly-eat collision/animation step, run each vblank: while an eat is
; latched (COLLISION_SUBFLAG 0x8134) it only tracks the fly sprite onto
; the frog; otherwise it arms the tongue once when the fly path is idle
; (FLY_DRIFT_COUNTER 0x811c == 0), bails to the retract reset
; (clearLatchedCollision) when the retract bit of FLY_EAT_PHASE (0x813d)
; is set, and while the tongue is out (COLLISION_LATCH 0x8135) runs the
; fly patrol mover and box-tests the fly against the frog (fly X within
; +/-4 of FROG_X 0x8044, FROG_Y 0x8047 in [0x5a,0x68)); a hit latches the
; eat, fires the eat sound, and tracks the fly onto the frog. Memory-only
animateFlyEatCollision:
26A6: 3A 34 81        LD      A,($8134)           ; {hard.workRam+134}
26A9: A7              AND     A                   
26AA: C2 F0 26        JP      NZ,$26F0            ; {code.loc_26f0}
26AD: DD 21 1B 81     LD      IX,$811B            
26B1: DD 7E 01        LD      A,(IX+$01)          
26B4: A7              AND     A                   
26B5: CC 0D 27        CALL    Z,$270D             ; {code.loc_270d}
26B8: 3A 3D 81        LD      A,($813D)           ; {hard.workRam+13D}
26BB: CB 47           BIT     0,A                 
26BD: C2 B3 27        JP      NZ,$27B3            ; {code.clearLatchedCollision}
26C0: 3A 35 81        LD      A,($8135)           ; {hard.workRam+135}
26C3: A7              AND     A                   
26C4: 20 01           JR      NZ,$26C7            ; {code.loc_26c7}
26C6: C9              RET                         

loc_26c7:
26C7: 3A 34 81        LD      A,($8134)           ; {hard.workRam+134}
26CA: A7              AND     A                   
26CB: 20 23           JR      NZ,$26F0            ; {code.loc_26f0}
26CD: CD 2F 27        CALL    $272F               ; {code.driveFlyPatrol}
26D0: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
26D3: FE 5A           CP      $5A                 
26D5: D8              RET     C                   
26D6: FE 68           CP      $68                 
26D8: D0              RET     NC                  
26D9: 3A 40 80        LD      A,($8040)           ; {hard.workRam+40}
26DC: 47              LD      B,A                 
26DD: 3A 44 80        LD      A,($8044)           ; {hard.workRam+44}
26E0: C6 04           ADD     A,$04               
26E2: B8              CP      B                   
26E3: D8              RET     C                   
26E4: D6 08           SUB     $08                 
26E6: B8              CP      B                   
26E7: D0              RET     NC                  
26E8: 3E 01           LD      A,$01               
26EA: 32 34 81        LD      ($8134),A           ; {hard.workRam+134}
26ED: 3E 18           LD      A,$18               
26EF: DF              RST     $18                 

loc_26f0:
26F0: DD 21 44 80     LD      IX,$8044            
26F4: FD 21 40 80     LD      IY,$8040            
26F8: DD 7E 00        LD      A,(IX+$00)          
26FB: FD 77 00        LD      (IY+$00),A          
26FE: DD 7E 01        LD      A,(IX+$01)          
2701: FD 77 01        LD      (IY+$01),A          
2704: DD 7E 03        LD      A,(IX+$03)          
2707: C6 02           ADD     A,$02               
2709: FD 77 03        LD      (IY+$03),A          
270C: C9              RET                         

loc_270d:
270D: 3A 35 81        LD      A,($8135)           ; {hard.workRam+135}
2710: A7              AND     A                   
2711: C0              RET     NZ                  
2712: 21 3D 81        LD      HL,$813D            
2715: 34              INC     (HL)                
2716: 21 41 80        LD      HL,$8041            
2719: 36 1E           LD      (HL),$1E            
271B: 23              INC     HL                  
271C: 36 04           LD      (HL),$04            
271E: 23              INC     HL                  
271F: 36 60           LD      (HL),$60            
2721: 3E 01           LD      A,$01               
2723: 32 35 81        LD      ($8135),A           ; {hard.workRam+135}
2726: 32 3D 83        LD      ($833D),A           ; {hard.workRam+33D}
2729: 3E 3C           LD      A,$3C               
272B: 32 3E 83        LD      ($833E),A           ; {hard.workRam+33E}
272E: C9              RET                         

; drive the fly's horizontal patrol: while the tongue timer
; FLY_ATTACK_TIMER (0x833e) counts down, re-render the sprite X
; FLY_SPRITE_X (0x8040) from FLY_PATH_OFFSET_TABLE (0x279f) +
; FLY_DRIFT_COUNTER (0x811c) and flip the sprite code FLY_SPRITE_CODE
; (0x8041) at the timer midpoint; at zero advance one path step in
; FLY_TRAVEL_DIR_STEP (0x833d: bit7 = direction/flip, low 7 = table
; index), reversing direction at an endpoint (table value 0, reload + turn
; sprite) or holding (table value 1, reload only); memory-only
driveFlyPatrol:
272F: 21 3E 83        LD      HL,$833E            
2732: 7E              LD      A,(HL)              
2733: A7              AND     A                   
2734: 28 2B           JR      Z,$2761             ; {code.loc_2761}
2736: 35              DEC     (HL)                
2737: 3E 3C           LD      A,$3C               
2739: CB 3F           SRL     A                   
273B: BE              CP      (HL)                
273C: 20 0F           JR      NZ,$274D            ; {code.loc_274d}
273E: 2B              DEC     HL                  
273F: 7E              LD      A,(HL)              
2740: A7              AND     A                   
2741: 3E 21           LD      A,$21               
2743: 32 41 80        LD      ($8041),A           ; {hard.workRam+41}
2746: F0              RET     P                   
2747: 3E A1           LD      A,$A1               
2749: 32 41 80        LD      ($8041),A           ; {hard.workRam+41}
274C: C9              RET                         

loc_274d:
274D: 2B              DEC     HL                  
274E: 7E              LD      A,(HL)              
274F: E6 7F           AND     $7F                 
2751: 21 9F 27        LD      HL,$279F            
2754: 3C              INC     A                   
2755: CD 9A 27        CALL    $279A               ; {code.loc_279a}
2758: 7E              LD      A,(HL)              
2759: 21 1C 81        LD      HL,$811C            
275C: 86              ADD     A,(HL)              
275D: 32 40 80        LD      ($8040),A           ; {hard.workRam+40}
2760: C9              RET                         

loc_2761:
2761: 2B              DEC     HL                  
2762: 7E              LD      A,(HL)              
2763: A7              AND     A                   
2764: F2 69 27        JP      P,$2769             ; {code.loc_2769}
2767: 35              DEC     (HL)                
2768: 35              DEC     (HL)                

loc_2769:
2769: 34              INC     (HL)                
276A: 7E              LD      A,(HL)              
276B: E6 7F           AND     $7F                 
276D: 21 9F 27        LD      HL,$279F            
2770: CD 9A 27        CALL    $279A               ; {code.loc_279a}
2773: 7E              LD      A,(HL)              
2774: FE 01           CP      $01                 
2776: 38 0A           JR      C,$2782             ; {code.loc_2782}
2778: 28 1A           JR      Z,$2794             ; {code.loc_2794}
277A: 21 1C 81        LD      HL,$811C            
277D: 86              ADD     A,(HL)              
277E: 32 40 80        LD      ($8040),A           ; {hard.workRam+40}
2781: C9              RET                         

loc_2782:
2782: 21 3D 83        LD      HL,$833D            
2785: 7E              LD      A,(HL)              
2786: EE 80           XOR     $80                 
2788: 77              LD      (HL),A              
2789: 3E 3C           LD      A,$3C               
278B: 32 3E 83        LD      ($833E),A           ; {hard.workRam+33E}
278E: 3E 1E           LD      A,$1E               
2790: 32 41 80        LD      ($8041),A           ; {hard.workRam+41}
2793: C9              RET                         

loc_2794:
2794: 3E 3C           LD      A,$3C               
2796: 32 3E 83        LD      ($833E),A           ; {hard.workRam+33E}
2799: C9              RET                         

loc_279a:
279A: 85              ADD     A,L                 
279B: 6F              LD      L,A                 
279C: D0              RET     NC                  
279D: 24              INC     H                   
279E: C9              RET                         

; ---- $279F-$27B2: data ----
279F: 00 EE EC EA E8 E6 E4 E2 E0 01 DE DC DA D8 D6 D4
27AF: D2 D0 00 D0

; guarded collision reset: returns when nothing is latched
; (COLLISION_LATCH 0x8135 == 0); otherwise zeroes the collision sub-flag
; COLLISION_SUBFLAG (0x8134) and clears the fly/goal sprite block plus the
; latch (clearCollisionSpriteBlock). Only runs on the death/hop path --
; its caller is gated on HOLD_FLAG (0x8004), so an idle frog never reaches
; it; memory-only
clearLatchedCollision:
27B3: 3A 35 81        LD      A,($8135)           ; {hard.workRam+135}
27B6: A7              AND     A                   
27B7: C8              RET     Z                   
27B8: AF              XOR     A                   
27B9: 32 34 81        LD      ($8134),A           ; {hard.workRam+134}

; zero the four-byte fly/goal sprite block FLY_SPRITE_X..+3
; (0x8040-0x8043) and the collision latch COLLISION_LATCH (0x8135);
; reached by fall-through from clearLatchedCollision and dispatched by
; stampHomeGoalAndResetFrog after a latched hit is scored; memory-only
clearCollisionSpriteBlock:
27BC: 21 40 80        LD      HL,$8040            
27BF: AF              XOR     A                   
27C0: 77              LD      (HL),A              
27C1: 23              INC     HL                  
27C2: 77              LD      (HL),A              
27C3: 23              INC     HL                  
27C4: 77              LD      (HL),A              
27C5: 23              INC     HL                  
27C6: 77              LD      (HL),A              
27C7: 32 35 81        LD      ($8135),A           ; {hard.workRam+135}
27CA: C9              RET                         

; arm the home-goal sprite: write the caller's lead byte (bay Y) plus the
; fixed tail 25,3,16 into the FLY_SPRITE_X (0x8040) sprite descriptor and
; set the arm cell HOME_GOAL_SPRITE_ARM_CELL (0x8340) = 160; fires on
; reaching a home bay (the bonus/goal sprite), not the fly; memory-only
armHomeGoalSprite:
27CB: 21 40 80        LD      HL,$8040            
27CE: 70              LD      (HL),B              
27CF: 23              INC     HL                  
27D0: 36 19           LD      (HL),$19            
27D2: 23              INC     HL                  
27D3: 36 03           LD      (HL),$03            
27D5: 23              INC     HL                  
27D6: 36 10           LD      (HL),$10            
27D8: 3E A0           LD      A,$A0               
27DA: 32 40 83        LD      ($8340),A           ; {hard.workRam+340}
27DD: C9              RET                         

; zero the four-byte fly/goal sprite block FLY_SPRITE_X..+3
; (0x8040-0x8043), leaving the collision latch COLLISION_LATCH (0x8135)
; untouched -- the sibling of clearCollisionSpriteBlock without the latch
; write; the collision orchestrator's goal-sprite timing arm runs it when
; the arm counter HOME_GOAL_SPRITE_ARM_CELL (0x8340) drains; memory-only
clearFlySpriteBlock:
27DE: 21 40 80        LD      HL,$8040            
27E1: AF              XOR     A                   
27E2: 77              LD      (HL),A              
27E3: 23              INC     HL                  
27E4: 77              LD      (HL),A              
27E5: 23              INC     HL                  
27E6: 77              LD      (HL),A              
27E7: 23              INC     HL                  
27E8: 77              LD      (HL),A              
27E9: C9              RET                         

loc_27ea:
27EA: 3A B7 83        LD      A,($83B7)           ; {hard.workRam+3B7}
27ED: FE 02           CP      $02                 
27EF: DA 73 28        JP      C,$2873             ; {code.loc_2873}
27F2: FE 05           CP      $05                 
27F4: D2 74 28        JP      NC,$2874            ; {code.armDiveHighPhase}
27F7: 3A 01 81        LD      A,($8101)           ; {hard.workRam+101}
27FA: A7              AND     A                   
27FB: CC 8C 28        CALL    Z,$288C             ; {code.resetDiveSurfaceCounter}

; shared dive surface-timer step: returns while idle (busy latch
; SPRITE_FRAME_BUSY_LATCH1 0x814f clear); while the two surface-timer
; cells differ (TWOPLAYER_FRAME_CELL_8146 0x8146 !=
; TWOPLAYER_FRAME_CELL_8147 0x8147) it just steps the counter
; (stepDiveFrameCounter), and once they match it consumes a tick then
; advances the dive anim frame -- the alternate arm-0 table on the even
; phase of FIGURE_ANIM_STEP_GATE (0x8150) bit0 (selectDiveVariantFrame),
; the main tile-pair table FROG_ANIM_TILE_PAIR_SRC (0x1413) on the odd
; phase (copyDiveAnimFrame); memory-only
stepDiveSurfaceTimer:
27FE: 3A 4F 81        LD      A,($814F)           ; {hard.workRam+14F}
2801: A7              AND     A                   
2802: C8              RET     Z                   
2803: 21 46 81        LD      HL,$8146            
2806: 7E              LD      A,(HL)              
2807: 23              INC     HL                  
2808: BE              CP      (HL)                
2809: C2 B0 28        JP      NZ,$28B0            ; {code.stepDiveFrameCounter}
280C: 35              DEC     (HL)                
280D: 11 06 A8        LD      DE,$A806            
2810: 3A 50 81        LD      A,($8150)           ; {hard.workRam+150}
2813: CB 47           BIT     0,A                 
2815: CA 6D 28        JP      Z,$286D             ; {code.selectDiveVariantFrame}
2818: 21 13 14        LD      HL,$1413            

; copy one two-byte dive-animation tile pair from a ROM frame table (base
; is the live-in) at frame index TWOPLAYER_FRAME_CELL_814E (0x814e) into
; VRAM column FROG_ANIM_COLUMN_VRAM (0xa806) + column offset
; TWOPLAYER_FRAME_CELL_8145 (0x8145); step the frame index +2 and the
; column +0x20 for the next call, and when the index passes the last frame
; (0x10) clear the busy latch SPRITE_FRAME_BUSY_LATCH1 (0x814f) and the
; four frame cells (0x814e/0x8145/0x8146/0x8147) so the next dive re-
; seeds; memory-only
copyDiveAnimFrame:
281B: AF              XOR     A                   
281C: 47              LD      B,A                 
281D: 3A 4E 81        LD      A,($814E)           ; {hard.workRam+14E}
2820: 4F              LD      C,A                 
2821: 3C              INC     A                   
2822: 3C              INC     A                   
2823: 32 4E 81        LD      ($814E),A           ; {hard.workRam+14E}
2826: 09              ADD     HL,BC               
2827: 06 00           LD      B,$00               
2829: EB              EX      DE,HL               
282A: 3A 45 81        LD      A,($8145)           ; {hard.workRam+145}
282D: 4F              LD      C,A                 
282E: 09              ADD     HL,BC               
282F: EB              EX      DE,HL               
2830: 0E 20           LD      C,$20               
2832: 3A 45 81        LD      A,($8145)           ; {hard.workRam+145}
2835: 81              ADD     A,C                 
2836: 32 45 81        LD      ($8145),A           ; {hard.workRam+145}
2839: 7E              LD      A,(HL)              
283A: 12              LD      (DE),A              
283B: 23              INC     HL                  
283C: 13              INC     DE                  
283D: 7E              LD      A,(HL)              
283E: 12              LD      (DE),A              
283F: 3A 4E 81        LD      A,($814E)           ; {hard.workRam+14E}
2842: FE 10           CP      $10                 
2844: D8              RET     C                   
2845: AF              XOR     A                   
2846: 32 4F 81        LD      ($814F),A           ; {hard.workRam+14F}
2849: 32 4E 81        LD      ($814E),A           ; {hard.workRam+14E}
284C: 32 45 81        LD      ($8145),A           ; {hard.workRam+145}
284F: 32 46 81        LD      ($8146),A           ; {hard.workRam+146}
2852: 32 47 81        LD      ($8147),A           ; {hard.workRam+147}
2855: C9              RET                         

; In a 2-player game (PLAY_FLAG (0x83fe) == 2) only, zero the sprite-frame
; busy latch SPRITE_FRAME_BUSY_LATCH1 (0x814f) and the four two-player
; frame cells TWOPLAYER_FRAME_CELL_814E/8145/8146/8147
; (0x814e/0x8145/0x8146/0x8147); any other player count returns untouched.
; Memory-only
clearTwoPlayerFrameCells:
2856: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
2859: FE 02           CP      $02                 
285B: C0              RET     NZ                  
285C: AF              XOR     A                   
285D: 32 4F 81        LD      ($814F),A           ; {hard.workRam+14F}
2860: 32 4E 81        LD      ($814E),A           ; {hard.workRam+14E}
2863: 32 45 81        LD      ($8145),A           ; {hard.workRam+145}
2866: 32 46 81        LD      ($8146),A           ; {hard.workRam+146}
2869: 32 47 81        LD      ($8147),A           ; {hard.workRam+147}
286C: C9              RET                         

; Dive-frame variant selector: point the frame copier at the alternate
; (arm-0) tile table FROG_ANIM_ARM0_SRC_BASE (0x1403) and hand off to
; copyDiveAnimFrame (0x281b). Memory-only
selectDiveVariantFrame:
286D: 21 03 14        LD      HL,$1403            
2870: C3 1B 28        JP      $281B               ; {code.copyDiveAnimFrame}

loc_2873:
2873: C9              RET                         

; Level>=5 dive arm: when the figure-animation phase FIGURE_ANIM_PHASE
; (0x8101) is idle (0) run the one-shot armTwoPairFigureFrame (0x287e),
; then continue into the shared surface-timer step stepDiveSurfaceTimer
; (0x27fe). Memory-only
armDiveHighPhase:
2874: 3A 01 81        LD      A,($8101)           ; {hard.workRam+101}
2877: A7              AND     A                   
2878: CC 7E 28        CALL    Z,$287E             ; {code.armTwoPairFigureFrame}
287B: C3 FE 27        JP      $27FE               ; {code.stepDiveSurfaceTimer}

; One-shot arm for the level>=5 diver animation (reached from
; armDiveHighPhase (0x2874) while the figure phase FIGURE_ANIM_PHASE
; (0x8101) is idle): when the busy latch SPRITE_FRAME_BUSY_LATCH1 (0x814f)
; is 0, set the figure step gate FIGURE_ANIM_STEP_GATE (0x8150)=1, seed
; both frame cells TWOPLAYER_FRAME_CELL_8146/8147 (0x8146/0x8147) from
; (ANIM_FRAME_BUFFER (0x819b) & 0x0f)*8, then raise the busy latch so a
; later pass will not re-seed. The gate it raises drives the figure
; animator animateTwoPairFigure (0x291d) and the collision test
; mountOrKillFrogOnTwoPairFigure (0x28bb). Memory-only
armTwoPairFigureFrame:
287E: 3A 4F 81        LD      A,($814F)           ; {hard.workRam+14F}
2881: A7              AND     A                   
2882: C0              RET     NZ                  
2883: 3E 01           LD      A,$01               
2885: 32 50 81        LD      ($8150),A           ; {hard.workRam+150}
2888: CD 9C 28        CALL    $289C               ; {code.loc_289c}
288B: C9              RET                         

; Re-arm the dive surface-timer cycle: when the busy latch
; SPRITE_FRAME_BUSY_LATCH1 (0x814f) is clear, increment the figure step
; gate FIGURE_ANIM_STEP_GATE (0x8150) by one, seed both frame cells
; TWOPLAYER_FRAME_CELL_8146/8147 (0x8146/0x8147) from (ANIM_FRAME_BUFFER
; (0x819b) & 0x0f)*8, then raise the busy latch; a set latch returns
; untouched. Structural twin of armTwoPairFigureFrame (0x287e), which
; instead sets the gate to 1 rather than incrementing it. Memory-only
resetDiveSurfaceCounter:
288C: 3A 4F 81        LD      A,($814F)           ; {hard.workRam+14F}
288F: A7              AND     A                   
2890: C0              RET     NZ                  
2891: 3A 50 81        LD      A,($8150)           ; {hard.workRam+150}
2894: 3C              INC     A                   
2895: 32 50 81        LD      ($8150),A           ; {hard.workRam+150}
2898: CD 9C 28        CALL    $289C               ; {code.loc_289c}
289B: C9              RET                         

loc_289c:
289C: 3A 9B 81        LD      A,($819B)           ; {hard.workRam+19B}
289F: E6 0F           AND     $0F                 
28A1: 87              ADD     A,A                 
28A2: 87              ADD     A,A                 
28A3: 87              ADD     A,A                 
28A4: 21 46 81        LD      HL,$8146            
28A7: 77              LD      (HL),A              
28A8: 23              INC     HL                  
28A9: 77              LD      (HL),A              
28AA: 3E 01           LD      A,$01               
28AC: 32 4F 81        LD      ($814F),A           ; {hard.workRam+14F}
28AF: C9              RET                         

; Tick one dive frame counter (the counter cell is the HL live-in): when
; drained to 0 reload it from the seed cell TWOPLAYER_FRAME_CELL_8146
; (0x8146), otherwise decrement it. Memory-only
stepDiveFrameCounter:
28B0: 7E              LD      A,(HL)              
28B1: A7              AND     A                   
28B2: 28 02           JR      Z,$28B6             ; {code.loc_28b6}
28B4: 35              DEC     (HL)                
28B5: C9              RET                         

loc_28b6:
28B6: 3A 46 81        LD      A,($8146)           ; {hard.workRam+146}
28B9: 77              LD      (HL),A              
28BA: C9              RET                         

; Frog-vs-diver box collision, gated on the arm bit FIGURE_ANIM_STEP_GATE
; (0x8150) bit0 and level LIVES_COUNT (0x83b7) >= 2 (so it no-ops at level
; 1): box-checks the frog Y/X (FROG_Y (0x8047)/FROG_X (0x8044)) against
; the diver's Y band and X window (diver X in FIGURE_ANIM_PHASE (0x8101));
; an outer overlap raises the ride/hold flag HOLD_FLAG (0x8004) and stamps
; the 2x2 mounted-frog tile quad (tiles 104-107) at TWO_PAIR_FIGURE_VRAM
; (0xa846), while an inner overlap kills the frog via killFrogAtLane.
; Memory-only
mountOrKillFrogOnTwoPairFigure:
28BB: 3A 50 81        LD      A,($8150)           ; {hard.workRam+150}
28BE: CB 47           BIT     0,A                 
28C0: C8              RET     Z                   
28C1: 3A B7 83        LD      A,($83B7)           ; {hard.workRam+3B7}
28C4: FE 02           CP      $02                 
28C6: D8              RET     C                   
28C7: 3A 47 80        LD      A,($8047)           ; {hard.workRam+47}
28CA: C6 08           ADD     A,$08               
28CC: FE 2A           CP      $2A                 
28CE: D8              RET     C                   
28CF: FE 3B           CP      $3B                 
28D1: D0              RET     NC                  
28D2: 3A 44 80        LD      A,($8044)           ; {hard.workRam+44}
28D5: C6 08           ADD     A,$08               
28D7: 47              LD      B,A                 
28D8: 3A 01 81        LD      A,($8101)           ; {hard.workRam+101}
28DB: 4F              LD      C,A                 
28DC: C6 08           ADD     A,$08               
28DE: B8              CP      B                   
28DF: D8              RET     C                   
28E0: 79              LD      A,C                 
28E1: D6 20           SUB     $20                 
28E3: B8              CP      B                   
28E4: D0              RET     NC                  
28E5: 79              LD      A,C                 
28E6: D6 08           SUB     $08                 
28E8: B8              CP      B                   
28E9: 30 04           JR      NC,$28EF            ; {code.loc_28ef}
28EB: CD D0 12        CALL    $12D0               ; {code.killFrogAtLane}
28EE: C9              RET                         

loc_28ef:
28EF: 3E 01           LD      A,$01               
28F1: 32 04 80        LD      ($8004),A           ; {hard.workRam+4}
28F4: 21 46 A8        LD      HL,$A846            
28F7: 36 68           LD      (HL),$68            
28F9: 23              INC     HL                  
28FA: 36 69           LD      (HL),$69            
28FC: 01 1F 00        LD      BC,$001F            
28FF: 09              ADD     HL,BC               
2900: 36 6A           LD      (HL),$6A            
2902: 23              INC     HL                  
2903: 36 6B           LD      (HL),$6B            
2905: C9              RET                         

; In-play lane-scroll-synced command enqueue: enqueue command 0xD0 onto
; the sound/tile command ring (enqueueSoundCommand into SOUND_QUEUE_COUNT
; (0x8300)) only when a game is in play (PLAY_FLAG (0x83fe) set), the
; lane-control byte LANE_CONTROL_SPEED_7 (0x81a2) is in [0x02,0x0e], and
; the lane-scroll byte LANE_RUN_SCROLL_POS (0x8140) is 0. The gate reads
; lane data, not frog state (overturns the earlier frog-on-log-edge-blit
; reading). Memory-only
enqueueLaneScrollSyncedCommand:
2906: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
2909: A7              AND     A                   
290A: C8              RET     Z                   
290B: 3A A2 81        LD      A,($81A2)           ; {hard.workRam+1A2}
290E: FE 0F           CP      $0F                 
2910: D0              RET     NC                  
2911: FE 02           CP      $02                 
2913: D8              RET     C                   
2914: 3A 40 81        LD      A,($8140)           ; {hard.workRam+140}
2917: A7              AND     A                   
2918: C0              RET     NZ                  
2919: 3E D0           LD      A,$D0               
291B: DF              RST     $18                 
291C: C9              RET                         

; Advance the two-pair diver-figure animation: when FIGURE_ANIM_PHASE
; (0x8101) is 0 the figure is idle, so clear the phase
; TWO_PAIR_FIGURE_ANIM_PHASE (0x833f); otherwise, gated on
; FIGURE_ANIM_STEP_GATE (0x8150) bit0 set and the busy latch
; SPRITE_FRAME_BUSY_LATCH1 (0x814f) clear, step the phase and, at phase 64
; or 112, blit the 2x2 figure tile quad into VRAM at TWO_PAIR_FIGURE_VRAM
; (0xa846) (first tile 104 or 208; phase 112 also restarts the animation).
; Memory-only
animateTwoPairFigure:
291D: 3A 01 81        LD      A,($8101)           ; {hard.workRam+101}
2920: A7              AND     A                   
2921: 20 05           JR      NZ,$2928            ; {code.loc_2928}
2923: AF              XOR     A                   
2924: 32 3F 83        LD      ($833F),A           ; {hard.workRam+33F}
2927: C9              RET                         

loc_2928:
2928: 3A 50 81        LD      A,($8150)           ; {hard.workRam+150}
292B: CB 47           BIT     0,A                 
292D: C8              RET     Z                   
292E: 3A 4F 81        LD      A,($814F)           ; {hard.workRam+14F}
2931: A7              AND     A                   
2932: C0              RET     NZ                  
2933: 21 3F 83        LD      HL,$833F            
2936: 34              INC     (HL)                
2937: 7E              LD      A,(HL)              
2938: FE 40           CP      $40                 
293A: 28 05           JR      Z,$2941             ; {code.loc_2941}
293C: FE 70           CP      $70                 
293E: 28 13           JR      Z,$2953             ; {code.loc_2953}
2940: C9              RET                         

loc_2941:
2941: 21 46 A8        LD      HL,$A846            
2944: 36 68           LD      (HL),$68            
2946: 23              INC     HL                  
2947: 36 69           LD      (HL),$69            
2949: 01 1F 00        LD      BC,$001F            
294C: 09              ADD     HL,BC               
294D: 36 6A           LD      (HL),$6A            
294F: 23              INC     HL                  
2950: 36 6B           LD      (HL),$6B            
2952: C9              RET                         

loc_2953:
2953: 21 46 A8        LD      HL,$A846            
2956: 36 D0           LD      (HL),$D0            
2958: 23              INC     HL                  
2959: 36 D1           LD      (HL),$D1            
295B: 01 1F 00        LD      BC,$001F            
295E: 09              ADD     HL,BC               
295F: 36 D2           LD      (HL),$D2            
2961: 23              INC     HL                  
2962: 36 D3           LD      (HL),$D3            
2964: AF              XOR     A                   
2965: 32 3F 83        LD      ($833F),A           ; {hard.workRam+33F}
2968: C9              RET                         

; ---- $2969-$296F: data ----
2969: FF FF FF FF FF FF FF

; Sprite-object cluster entry, run once per frame: when the level count
; LIVES_COUNT (0x83b7) < 3 it runs only dispatcher B; at >= 3 it runs
; dispatcher A (dispatchSpriteObjectArmsA, 0x29b9) on the active player's
; (ACTIVE_PLAYER (0x83fd)) record SPRITE_OBJECT_RECORD_A_P1/_P2
; (0x8440/0x8460) with slot SPRITE_OBJECT_SLOT_A (0x8048), then a second
; dispatcher-A pass (advancing the record by 0x10 and the slot to
; SPRITE_OBJECT_SLOT_A_SECOND (0x8050) only when the count >= 6, else
; reusing the first pass's record/slot), then dispatcher B
; updateSpriteObject (0x2b83) on record SPRITE_OBJECT_RECORD_B_P1/_P2
; (0x8480/0x8490) with slot SPRITE_OBJECT_SLOT_B (0x8058). Memory-only
driveSpriteObjectCluster:
2970: 3A B7 83        LD      A,($83B7)           ; {hard.workRam+3B7}
2973: FE 03           CP      $03                 
2975: 38 2A           JR      C,$29A1             ; {code.loc_29a1}
2977: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
297A: 3D              DEC     A                   
297B: 20 06           JR      NZ,$2983            ; {code.loc_2983}
297D: DD 21 40 84     LD      IX,$8440            
2981: 18 04           JR      $2987               ; {code.loc_2987}

loc_2983:
2983: DD 21 60 84     LD      IX,$8460            

loc_2987:
2987: FD 21 48 80     LD      IY,$8048            
298B: CD B9 29        CALL    $29B9               ; {code.dispatchSpriteObjectArmsA}
298E: 3A B7 83        LD      A,($83B7)           ; {hard.workRam+3B7}
2991: FE 06           CP      $06                 
2993: 38 07           JR      C,$299C             
2995: 11 10 00        LD      DE,$0010            
2998: DD 19           ADD     IX,DE               
299A: FD 21 50 80     LD      IY,$8050            
299E: CD B9 29        CALL    $29B9               ; {code.dispatchSpriteObjectArmsA}

loc_29a1:
29A1: 3A FD 83        LD      A,($83FD)           ; {hard.workRam+3FD}
29A4: 3D              DEC     A                   
29A5: 20 06           JR      NZ,$29AD            ; {code.loc_29ad}
29A7: DD 21 80 84     LD      IX,$8480            
29AB: 18 04           JR      $29B1               ; {code.loc_29b1}

loc_29ad:
29AD: DD 21 90 84     LD      IX,$8490            

loc_29b1:
29B1: FD 21 58 80     LD      IY,$8058            
29B5: CD 83 2B        CALL    $2B83               ; {code.updateSpriteObject}
29B8: C9              RET                         

; Sprite-object dispatcher A: for one record IX / slot IY, run the five
; per-slot arms in ROM order — spawnSpriteObjectArmA (0x2a6a),
; animateSpriteObjectFrame (0x29c9), $29F9 (0x29f9),
; placeSpriteObjectSlotAndRetire (0x2af3), flagSpriteObjectFrogHit
; (0x2b58). Memory-only
dispatchSpriteObjectArmsA:
29B9: CD 6A 2A        CALL    $2A6A               ; {code.spawnSpriteObjectArmA}
29BC: CD C9 29        CALL    $29C9               ; {code.animateSpriteObjectFrame}
29BF: CD F9 29        CALL    $29F9               ; {code.loc_29f9}
29C2: CD F3 2A        CALL    $2AF3               ; {code.placeSpriteObjectSlotAndRetire}
29C5: CD 58 2B        CALL    $2B58               ; {code.flagSpriteObjectFrogHit}
29C8: C9              RET                         

; Sprite-object frame-animation arm (IX = object record, IY = sprite
; slot): count down the (IX+8) frame timer; on expiry reload it (12) and,
; while the phase (IX+6) is non-zero, step it down (1 wraps to 4), index
; the phase-tile table SPRITE_OBJECT_PHASE_TILE_TABLE (0x2cd5), OR in the
; (IX+5) flip bits, and stage the tile/attr pair into the sprite slot
; ((IY+1)=tile, (IY+5)=tile+1, (IY+2)=(IY+6)=4). Memory-only
animateSpriteObjectFrame:
29C9: DD 35 08        DEC     (IX+$08)            
29CC: C0              RET     NZ                  
29CD: DD 36 08 0C     LD      (IX+$08),$0C        
29D1: DD 7E 06        LD      A,(IX+$06)          
29D4: B7              OR      A                   
29D5: C8              RET     Z                   
29D6: 3D              DEC     A                   
29D7: 20 02           JR      NZ,$29DB            ; {code.loc_29db}
29D9: 3E 04           LD      A,$04               

loc_29db:
29DB: DD 77 06        LD      (IX+$06),A          
29DE: 6F              LD      L,A                 
29DF: 26 00           LD      H,$00               
29E1: 11 D5 2C        LD      DE,$2CD5            
29E4: 19              ADD     HL,DE               
29E5: 7E              LD      A,(HL)              
29E6: DD B6 05        OR      (IX+$05)            
29E9: FD 77 01        LD      (IY+$01),A          
29EC: 3C              INC     A                   
29ED: FD 77 05        LD      (IY+$05),A          
29F0: FD 36 02 04     LD      (IY+$02),$04        
29F4: FD 36 06 04     LD      (IY+$06),$04        
29F8: C9              RET                         

loc_29f9:
29F9: DD 7E 06        LD      A,(IX+$06)          
29FC: B7              OR      A                   
29FD: C8              RET     Z                   
29FE: 3A 2C 84        LD      A,($842C)           ; {hard.workRam+42C}
2A01: B7              OR      A                   
2A02: C0              RET     NZ                  
2A03: DD 35 09        DEC     (IX+$09)            
2A06: C0              RET     NZ                  
2A07: DD 36 09 08     LD      (IX+$09),$08        
2A0B: FD 7E 03        LD      A,(IY+$03)          
2A0E: FE 60           CP      $60                 
2A10: 30 2A           JR      NC,$2A3C            ; {code.loc_2a3c}
2A12: DD 36 07 01     LD      (IX+$07),$01        
2A16: DD 7E 05        LD      A,(IX+$05)          
2A19: B7              OR      A                   
2A1A: C2 2D 2A        JP      NZ,$2A2D            ; {code.loc_2a2d}
2A1D: 3A 14 80        LD      A,($8014)           ; {hard.workRam+14}
2A20: DD 96 00        SUB     (IX+$00)            
2A23: D8              RET     C                   
2A24: FD BE 00        CP      (IY+$00)            
2A27: 30 2A           JR      NC,$2A53            ; {code.loc_2a53}
2A29: DD 34 02        INC     (IX+$02)            
2A2C: C9              RET                         

loc_2a2d:
2A2D: 3A 14 80        LD      A,($8014)           ; {hard.workRam+14}
2A30: DD 96 01        SUB     (IX+$01)            
2A33: FD BE 00        CP      (IY+$00)            
2A36: 38 1B           JR      C,$2A53             ; {code.loc_2a53}
2A38: DD 35 02        DEC     (IX+$02)            
2A3B: C9              RET                         

loc_2a3c:
2A3C: DD 36 07 01     LD      (IX+$07),$01        
2A40: DD 7E 05        LD      A,(IX+$05)          
2A43: B7              OR      A                   
2A44: 28 04           JR      Z,$2A4A             ; {code.loc_2a4a}
2A46: 3E 02           LD      A,$02               
2A48: 18 02           JR      $2A4C               ; {code.loc_2a4c}

loc_2a4a:
2A4A: 3E FE           LD      A,$FE               

loc_2a4c:
2A4C: DD 86 03        ADD     A,(IX+$03)          
2A4F: DD 77 03        LD      (IX+$03),A          
2A52: C9              RET                         

loc_2a53:
2A53: DD 7E 05        LD      A,(IX+$05)          
2A56: EE 80           XOR     $80                 
2A58: DD 77 05        LD      (IX+$05),A          
2A5B: FD 7E 04        LD      A,(IY+$04)          
2A5E: FD 77 00        LD      (IY+$00),A          
2A61: FD 7E 01        LD      A,(IY+$01)          
2A64: EE 80           XOR     $80                 
2A66: FD 77 01        LD      (IY+$01),A          
2A69: C9              RET                         

; Sprite-object spawn arm run by dispatcher A (dispatchSpriteObjectArmsA,
; 0x29b9), live once the level/slot count LIVES_COUNT (0x83b7) >= 3: count
; down the (IX+0x0a) spawn timer and, on expiry with the record idle, roll
; the spawn PRNG (nextSpawnRandomByte) against 8*count+0x80, then walk the
; placement bands (stride from SPRITE_SPAWN_X_STRIDE (0x8276), count from
; SPRITE_SPAWN_BAND_SCAN_COUNT (0x8278)) down from the free-running
; counter FREE_RUNNING_POS_COUNTER (0x8014) to place the object on-screen
; or park it off-screen, seed its sprite code and frame/move timers, and
; fall into the shared spawn tail raiseSpriteArmOneShotAndQueueSound
; (0x2ae6) (one-shot PER_TURN_SCRATCH (0x8371) + spawn sound 0x90).
; Memory-only
spawnSpriteObjectArmA:
2A6A: 3A B7 83        LD      A,($83B7)           ; {hard.workRam+3B7}
2A6D: FE 03           CP      $03                 
2A6F: D8              RET     C                   
2A70: 4F              LD      C,A                 
2A71: DD 35 0A        DEC     (IX+$0A)            
2A74: C0              RET     NZ                  
2A75: DD 7E 06        LD      A,(IX+$06)          
2A78: B7              OR      A                   
2A79: C0              RET     NZ                  
2A7A: CD EE 0A        CALL    $0AEE               ; {code.nextSpawnRandomByte}
2A7D: 47              LD      B,A                 
2A7E: 79              LD      A,C                 
2A7F: 87              ADD     A,A                 
2A80: 87              ADD     A,A                 
2A81: 87              ADD     A,A                 
2A82: C6 80           ADD     A,$80               
2A84: B8              CP      B                   
2A85: D8              RET     C                   
2A86: CD EE 0A        CALL    $0AEE               ; {code.nextSpawnRandomByte}
2A89: E6 03           AND     $03                 
2A8B: 28 1D           JR      Z,$2AAA             ; {code.loc_2aaa}
2A8D: 0E 40           LD      C,$40               
2A8F: 21 76 82        LD      HL,$8276            
2A92: 7E              LD      A,(HL)              
2A93: 0F              RRCA                        
2A94: 0F              RRCA                        
2A95: C6 24           ADD     A,$24               
2A97: 57              LD      D,A                 
2A98: 2C              INC     L                   
2A99: 2C              INC     L                   
2A9A: 46              LD      B,(HL)              
2A9B: 3A 14 80        LD      A,($8014)           ; {hard.workRam+14}
2A9E: D6 10           SUB     $10                 
2AA0: 38 08           JR      C,$2AAA             ; {code.loc_2aaa}

loc_2aa2:
2AA2: 91              SUB     C                   
2AA3: 38 19           JR      C,$2ABE             ; {code.loc_2abe}
2AA5: 92              SUB     D                   
2AA6: 38 02           JR      C,$2AAA             ; {code.loc_2aaa}
2AA8: 10 F8           DJNZ    $2AA2               ; {code.loc_2aa2}

loc_2aaa:
2AAA: DD 36 04 7E     LD      (IX+$04),$7E        
2AAE: CD EE 0A        CALL    $0AEE               ; {code.nextSpawnRandomByte}
2AB1: 0F              RRCA                        
2AB2: 38 1E           JR      C,$2AD2             ; {code.loc_2ad2}
2AB4: DD 36 05 00     LD      (IX+$05),$00        
2AB8: DD 36 03 F0     LD      (IX+$03),$F0        
2ABC: 18 1C           JR      $2ADA               ; {code.loc_2ada}

loc_2abe:
2ABE: 81              ADD     A,C                 
2ABF: 47              LD      B,A                 
2AC0: 3A 14 80        LD      A,($8014)           ; {hard.workRam+14}
2AC3: DD 77 02        LD      (IX+$02),A          
2AC6: 90              SUB     B                   
2AC7: DD 77 01        LD      (IX+$01),A          
2ACA: 81              ADD     A,C                 
2ACB: DD 77 00        LD      (IX+$00),A          
2ACE: DD 36 04 4E     LD      (IX+$04),$4E        

loc_2ad2:
2AD2: DD 36 05 80     LD      (IX+$05),$80        
2AD6: DD 36 03 00     LD      (IX+$03),$00        

loc_2ada:
2ADA: DD 36 06 01     LD      (IX+$06),$01        
2ADE: DD 36 08 0B     LD      (IX+$08),$0B        
2AE2: DD 36 09 08     LD      (IX+$09),$08        

; Shared tail of the sprite-object spawn arms (spawnSpriteObjectArmA
; (0x2a6a) falls in, placeSpriteObjectSlotAndRetire (0x2af3) calls it): a
; per-turn one-shot — while PER_TURN_SCRATCH (0x8371) is 0 it latches it
; to 1 and enqueues the spawn sound command 0x90 (enqueueSoundCommand);
; once the flag is set the arm has already fired this turn and it returns
; untouched. The sound is dropped by the ring when not playing, but the
; one-shot still latches. Memory-only
raiseSpriteArmOneShotAndQueueSound:
2AE6: 3A 71 83        LD      A,($8371)           ; {hard.workRam+371}
2AE9: B7              OR      A                   
2AEA: C0              RET     NZ                  
2AEB: 3C              INC     A                   
2AEC: 32 71 83        LD      ($8371),A           ; {hard.workRam+371}
2AEF: 3E 90           LD      A,$90               
2AF1: DF              RST     $18                 
2AF2: C9              RET                         

; Sprite-object placement/retire arm run by dispatcher A
; (dispatchSpriteObjectArmsA, 0x29b9) on record IX / slot IY; inactive
; ((IX+6)==0) returns. Otherwise it runs the shared spawn-sound one-shot
; (raiseSpriteArmOneShotAndQueueSound), computes the on-screen X — the
; object's own (IX+3) when its attr (IX+4)>=0x60, else the free-running
; counter FREE_RUNNING_POS_COUNTER (0x8014) minus (IX+2) (NOT the frog X)
; — writes it to slot (IY+0), mirrors attr to (IY+3)/(IY+7), and stores a
; +15/-15 biased X in (IY+4); on the fold-wrap with the retire flag (IX+7)
; set it clears the 16-byte record and 8-byte slot and sets (IX+10)=0x20.
; Memory-only
placeSpriteObjectSlotAndRetire:
2AF3: DD 7E 06        LD      A,(IX+$06)          
2AF6: B7              OR      A                   
2AF7: C8              RET     Z                   
2AF8: CD E6 2A        CALL    $2AE6               ; {code.raiseSpriteArmOneShotAndQueueSound}
2AFB: DD 7E 04        LD      A,(IX+$04)          
2AFE: FE 60           CP      $60                 
2B00: 30 0C           JR      NC,$2B0E            ; {code.loc_2b0e}
2B02: 3A 14 80        LD      A,($8014)           ; {hard.workRam+14}
2B05: DD 96 02        SUB     (IX+$02)            
2B08: 4F              LD      C,A                 
2B09: FD 77 00        LD      (IY+$00),A          
2B0C: 18 06           JR      $2B14               ; {code.loc_2b14}

loc_2b0e:
2B0E: DD 4E 03        LD      C,(IX+$03)          
2B11: FD 71 00        LD      (IY+$00),C          

loc_2b14:
2B14: DD 7E 04        LD      A,(IX+$04)          
2B17: FD 77 03        LD      (IY+$03),A          
2B1A: FD 77 07        LD      (IY+$07),A          
2B1D: DD 7E 05        LD      A,(IX+$05)          
2B20: B7              OR      A                   
2B21: 20 0A           JR      NZ,$2B2D            ; {code.loc_2b2d}
2B23: 3E 0F           LD      A,$0F               
2B25: 81              ADD     A,C                 
2B26: FD 77 04        LD      (IY+$04),A          
2B29: 3C              INC     A                   
2B2A: C0              RET     NZ                  
2B2B: 18 09           JR      $2B36               ; {code.loc_2b36}

loc_2b2d:
2B2D: 3E F1           LD      A,$F1               
2B2F: 81              ADD     A,C                 
2B30: FD 77 04        LD      (IY+$04),A          
2B33: 79              LD      A,C                 
2B34: B7              OR      A                   
2B35: C0              RET     NZ                  

loc_2b36:
2B36: DD 7E 07        LD      A,(IX+$07)          
2B39: B7              OR      A                   
2B3A: C8              RET     Z                   
2B3B: DD E5           PUSH    IX                  
2B3D: E1              POP     HL                  
2B3E: 54              LD      D,H                 
2B3F: 5D              LD      E,L                 
2B40: 1C              INC     E                   
2B41: 01 0F 00        LD      BC,$000F            
2B44: 70              LD      (HL),B              
2B45: ED B0           LDIR                        
2B47: 01 07 00        LD      BC,$0007            
2B4A: FD E5           PUSH    IY                  
2B4C: E1              POP     HL                  
2B4D: 54              LD      D,H                 
2B4E: 5D              LD      E,L                 
2B4F: 1C              INC     E                   
2B50: 70              LD      (HL),B              
2B51: ED B0           LDIR                        
2B53: DD 36 0A 20     LD      (IX+$0A),$20        
2B57: C9              RET                         

; Sprite-object hit-test arm (leaf; IX = object record, IY = sprite slot):
; active only when the record is live ((IX+6)!=0) and its row (IX+4)+2
; equals the frog row FROG_Y (0x8047); it takes the slot X (IY+0), biased
; +16 when the direction bit (IX+5) is set, and if that lands within
; [0,16) of the frog X FROG_X (0x8044) raises the kill/hold flag HOLD_FLAG
; (0x8004) and the global gate $842C (0x842c). Memory-only
flagSpriteObjectFrogHit:
2B58: DD 7E 06        LD      A,(IX+$06)          
2B5B: B7              OR      A                   
2B5C: C8              RET     Z                   
2B5D: DD 7E 04        LD      A,(IX+$04)          
2B60: C6 02           ADD     A,$02               
2B62: 21 47 80        LD      HL,$8047            
2B65: BE              CP      (HL)                
2B66: C0              RET     NZ                  
2B67: DD 7E 05        LD      A,(IX+$05)          
2B6A: B7              OR      A                   
2B6B: FD 7E 00        LD      A,(IY+$00)          
2B6E: 21 44 80        LD      HL,$8044            
2B71: 28 02           JR      Z,$2B75             ; {code.loc_2b75}
2B73: C6 10           ADD     A,$10               

loc_2b75:
2B75: 96              SUB     (HL)                
2B76: D8              RET     C                   
2B77: FE 10           CP      $10                 
2B79: D0              RET     NC                  
2B7A: 3E 01           LD      A,$01               
2B7C: 32 04 80        LD      ($8004),A           ; {hard.workRam+4}
2B7F: 32 2C 84        LD      ($842C),A           ; {hard.workRam+42C}
2B82: C9              RET                         

; Sprite-object dispatcher B: once per frame the cluster driver
; (driveSpriteObjectCluster, 0x2970) enters with IX = record base / IY =
; sprite slot, and this runs the five arms in fixed order —
; spawnSpriteObject (0x2c13), steerSpriteObjectTowardTarget (0x2bab),
; writeSpriteObjectSlotX (0x2b93), flagSpriteObjectFrogHitAhead (0x2ca8),
; writeSpriteObjectSlotAttr (0x2bfb) — advancing that one record/slot one
; step: it spawns an object, steers it (drifts toward its target, despawns
; on arrival), and stages its X/attr/code into the slot, which reaches
; hardware OBJRAM as the on-screen sprite the next frame. Memory-only
updateSpriteObject:
2B83: CD 13 2C        CALL    $2C13               ; {code.spawnSpriteObject}
2B86: CD AB 2B        CALL    $2BAB               ; {code.steerSpriteObjectTowardTarget}
2B89: CD 93 2B        CALL    $2B93               ; {code.writeSpriteObjectSlotX}
2B8C: CD A8 2C        CALL    $2CA8               ; {code.flagSpriteObjectFrogHitAhead}
2B8F: CD FB 2B        CALL    $2BFB               ; {code.writeSpriteObjectSlotAttr}
2B92: C9              RET                         

; Sprite-object X-write arm run by dispatcher B (updateSpriteObject,
; 0x2b83) on record IX / slot IY: for an active record ((IX+6)!=0) read
; the lane-position cell at $8000 (0x8000) | (IX+0x0b) and write slot
; (IY+0) = that target - (IX+2) and slot (IY+3) = (IX+4). The two slot
; bytes reach hardware OBJRAM as the on-screen sprite the next frame.
; Memory-only
writeSpriteObjectSlotX:
2B93: DD 7E 06        LD      A,(IX+$06)          
2B96: B7              OR      A                   
2B97: C8              RET     Z                   
2B98: DD 6E 0B        LD      L,(IX+$0B)          
2B9B: 26 80           LD      H,$80               
2B9D: 7E              LD      A,(HL)              
2B9E: DD 96 02        SUB     (IX+$02)            
2BA1: FD 77 00        LD      (IY+$00),A          
2BA4: DD 7E 04        LD      A,(IX+$04)          
2BA7: FD 77 03        LD      (IY+$03),A          
2BAA: C9              RET                         

; Sprite-object steering arm (dispatcher B, IX = record): active while
; (IX+6)!=0; counts down the (IX+9) move timer (reload 8) and on each
; expiry drifts (IX+2) one step toward the per-object target (lane-
; position cell at $8000 (0x8000) | (IX+0x0b)) along (IX+0)/(IX+1) by
; facing (IX+5); on reaching the target it despawns — clearing the 16-byte
; record and the shared 4-byte slot block SPRITE_OBJECT_SLOT_B (0x8058) —
; unless the hold flag HOLD_FLAG (0x8004) is set. Memory-only
steerSpriteObjectTowardTarget:
2BAB: DD 7E 06        LD      A,(IX+$06)          
2BAE: B7              OR      A                   
2BAF: C8              RET     Z                   
2BB0: DD 35 09        DEC     (IX+$09)            
2BB3: C0              RET     NZ                  
2BB4: DD 36 09 08     LD      (IX+$09),$08        
2BB8: DD 6E 0B        LD      L,(IX+$0B)          
2BBB: 26 80           LD      H,$80               
2BBD: DD 7E 05        LD      A,(IX+$05)          
2BC0: B7              OR      A                   
2BC1: 28 0D           JR      Z,$2BD0             ; {code.loc_2bd0}
2BC3: 7E              LD      A,(HL)              
2BC4: DD 96 00        SUB     (IX+$00)            
2BC7: FD BE 00        CP      (IY+$00)            
2BCA: 30 11           JR      NC,$2BDD            ; {code.loc_2bdd}
2BCC: DD 34 02        INC     (IX+$02)            
2BCF: C9              RET                         

loc_2bd0:
2BD0: 7E              LD      A,(HL)              
2BD1: DD 96 01        SUB     (IX+$01)            
2BD4: FD BE 00        CP      (IY+$00)            
2BD7: 38 04           JR      C,$2BDD             ; {code.loc_2bdd}
2BD9: DD 35 02        DEC     (IX+$02)            
2BDC: C9              RET                         

loc_2bdd:
2BDD: 3A 04 80        LD      A,($8004)           ; {hard.workRam+4}
2BE0: B7              OR      A                   
2BE1: C0              RET     NZ                  
2BE2: DD E5           PUSH    IX                  
2BE4: E1              POP     HL                  
2BE5: 54              LD      D,H                 
2BE6: 5D              LD      E,L                 
2BE7: 1C              INC     E                   
2BE8: 01 0F 00        LD      BC,$000F            
2BEB: 70              LD      (HL),B              
2BEC: ED B0           LDIR                        
2BEE: 21 58 80        LD      HL,$8058            
2BF1: 11 59 80        LD      DE,$8059            
2BF4: 01 03 00        LD      BC,$0003            
2BF7: 70              LD      (HL),B              
2BF8: ED B0           LDIR                        
2BFA: C9              RET                         

; Sprite-object attribute-write arm (dispatcher B, IX = record, IY =
; slot): for an active record ((IX+6)!=0) index the object-state attribute
; table OBJECT_STATE_ATTR_TABLE (0x2cd9) by the state byte (IX+6), OR in
; the object flag bits (IX+5), write the result to slot (IY+1), and write
; sprite code 2 to slot (IY+2); inactive returns untouched. Memory-only
writeSpriteObjectSlotAttr:
2BFB: DD 7E 06        LD      A,(IX+$06)          
2BFE: B7              OR      A                   
2BFF: C8              RET     Z                   
2C00: 21 D9 2C        LD      HL,$2CD9            
2C03: 4F              LD      C,A                 
2C04: 06 00           LD      B,$00               
2C06: 09              ADD     HL,BC               
2C07: 7E              LD      A,(HL)              
2C08: DD B6 05        OR      (IX+$05)            
2C0B: FD 77 01        LD      (IY+$01),A          
2C0E: FD 36 02 02     LD      (IY+$02),$02        
2C12: C9              RET                         

; Sprite-object spawn arm (dispatcher B, IX = record): gated on the level
; count LIVES_COUNT (0x83b7) >= 3 and an idle record ((IX+6)==0); it rolls
; the spawn PRNG (nextSpawnRandomByte) to density-gate and pick a variant,
; derives the tile/attribute ((IX+4)=variant*16+48), the lane index
; (IX+0x0b), and the position bytes (IX+0/1/2) from the spawn tables
; SPAWN_VARIANT_TABLE (0x2ce6)/SPAWN_POINTER_TABLE (0x2cdc) and lane cell
; $8000 (0x8000), plus a direction ((IX+3)/(IX+5)), then arms the record
; ((IX+6)=1, (IX+9)=8).
spawnSpriteObject:
2C13: 3A B7 83        LD      A,($83B7)           ; {hard.workRam+3B7}
2C16: FE 03           CP      $03                 
2C18: D8              RET     C                   
2C19: 4F              LD      C,A                 
2C1A: DD 7E 06        LD      A,(IX+$06)          
2C1D: B7              OR      A                   
2C1E: C0              RET     NZ                  
2C1F: CD EE 0A        CALL    $0AEE               ; {code.nextSpawnRandomByte}
2C22: 47              LD      B,A                 
2C23: 79              LD      A,C                 
2C24: 87              ADD     A,A                 
2C25: 87              ADD     A,A                 
2C26: 87              ADD     A,A                 
2C27: C6 80           ADD     A,$80               
2C29: B8              CP      B                   
2C2A: D8              RET     C                   
2C2B: 0E 40           LD      C,$40               
2C2D: CD EE 0A        CALL    $0AEE               ; {code.nextSpawnRandomByte}
2C30: E6 07           AND     $07                 
2C32: FE 05           CP      $05                 
2C34: D0              RET     NC                  
2C35: 4F              LD      C,A                 
2C36: 0F              RRCA                        
2C37: 0F              RRCA                        
2C38: 0F              RRCA                        
2C39: 0F              RRCA                        
2C3A: C6 30           ADD     A,$30               
2C3C: DD 77 04        LD      (IX+$04),A          
2C3F: CD EE 0A        CALL    $0AEE               ; {code.nextSpawnRandomByte}
2C42: 47              LD      B,A                 
2C43: 79              LD      A,C                 
2C44: 87              ADD     A,A                 
2C45: 5F              LD      E,A                 
2C46: 16 00           LD      D,$00               
2C48: 21 E6 2C        LD      HL,$2CE6            
2C4B: 19              ADD     HL,DE               
2C4C: 5E              LD      E,(HL)              
2C4D: 2C              INC     L                   
2C4E: 6E              LD      L,(HL)              
2C4F: 26 80           LD      H,$80               
2C51: DD 75 0B        LD      (IX+$0B),L          
2C54: 7E              LD      A,(HL)              
2C55: 57              LD      D,A                 
2C56: 79              LD      A,C                 
2C57: 87              ADD     A,A                 
2C58: 4F              LD      C,A                 
2C59: 06 00           LD      B,$00               
2C5B: 21 DC 2C        LD      HL,$2CDC            
2C5E: 09              ADD     HL,BC               
2C5F: 4E              LD      C,(HL)              
2C60: 2C              INC     L                   
2C61: 66              LD      H,(HL)              
2C62: 69              LD      L,C                 
2C63: 7E              LD      A,(HL)              
2C64: 0F              RRCA                        
2C65: 0F              RRCA                        
2C66: D6 10           SUB     $10                 
2C68: 4F              LD      C,A                 
2C69: 2C              INC     L                   
2C6A: 2C              INC     L                   
2C6B: 46              LD      B,(HL)              
2C6C: 7A              LD      A,D                 

loc_2c6d:
2C6D: 93              SUB     E                   
2C6E: D8              RET     C                   
2C6F: 91              SUB     C                   
2C70: 38 02           JR      C,$2C74             ; {code.loc_2c74}
2C72: 10 F9           DJNZ    $2C6D               ; {code.loc_2c6d}

loc_2c74:
2C74: 81              ADD     A,C                 
2C75: 47              LD      B,A                 
2C76: DD 6E 0B        LD      L,(IX+$0B)          
2C79: 26 80           LD      H,$80               
2C7B: 7E              LD      A,(HL)              
2C7C: DD 77 02        LD      (IX+$02),A          
2C7F: 90              SUB     B                   
2C80: DD 77 01        LD      (IX+$01),A          
2C83: 81              ADD     A,C                 
2C84: DD 77 00        LD      (IX+$00),A          
2C87: CD EE 0A        CALL    $0AEE               ; {code.nextSpawnRandomByte}
2C8A: 0F              RRCA                        
2C8B: 38 0A           JR      C,$2C97             ; {code.loc_2c97}
2C8D: DD 36 05 80     LD      (IX+$05),$80        
2C91: DD 36 03 F0     LD      (IX+$03),$F0        
2C95: 18 08           JR      $2C9F               ; {code.loc_2c9f}

loc_2c97:
2C97: DD 36 05 00     LD      (IX+$05),$00        
2C9B: DD 36 03 00     LD      (IX+$03),$00        

loc_2c9f:
2C9F: DD 36 06 01     LD      (IX+$06),$01        
2CA3: DD 36 09 08     LD      (IX+$09),$08        
2CA7: C9              RET                         

; Sprite-object proximity hit-test arm (leaf; dispatcher B, IX = record,
; IY = slot): active when (IX+6)!=0 and the object row (IX+4) equals the
; frog row FROG_Y (0x8047); it projects the slot X (IY+0) by +20
; (direction bit (IX+5) clear) or -4 (set), and if that lands within a
; 16px window at or ahead of the frog X FROG_X (0x8044) it raises the
; frog-hit flag HOLD_FLAG (0x8004) and advances the object to state 2
; ((IX+6)=2). Memory-only
flagSpriteObjectFrogHitAhead:
2CA8: DD 7E 06        LD      A,(IX+$06)          
2CAB: B7              OR      A                   
2CAC: C8              RET     Z                   
2CAD: DD 7E 04        LD      A,(IX+$04)          
2CB0: 21 47 80        LD      HL,$8047            
2CB3: BE              CP      (HL)                
2CB4: C0              RET     NZ                  
2CB5: DD 7E 05        LD      A,(IX+$05)          
2CB8: B7              OR      A                   
2CB9: FD 7E 00        LD      A,(IY+$00)          
2CBC: 21 44 80        LD      HL,$8044            
2CBF: 20 04           JR      NZ,$2CC5            ; {code.loc_2cc5}
2CC1: C6 14           ADD     A,$14               
2CC3: 18 02           JR      $2CC7               ; {code.loc_2cc7}

loc_2cc5:
2CC5: D6 04           SUB     $04                 

loc_2cc7:
2CC7: 96              SUB     (HL)                
2CC8: D8              RET     C                   
2CC9: FE 10           CP      $10                 
2CCB: D0              RET     NC                  
2CCC: 3E 01           LD      A,$01               
2CCE: 32 04 80        LD      ($8004),A           ; {hard.workRam+4}
2CD1: DD 36 06 02     LD      (IX+$06),$02        
2CD5: C9              RET                         

; ---- $2CD6-$2CEF: data ----
2CD6: 2C 2E 30 2E 27 38 70 82 73 82 76 82 79 82 7C 82
2CE6: 50 0C 30 10 70 14 40 18 40 1C

; Coin/credit scanner the vblank NMI calls first: on the boot/attract pass
; (latch COIN_INPUT_LATCH (0x83e2)==0) latch the coin+service bits of the
; inverted IN0_PORT (0xe000) and return; once armed, wait for the release
; edge, then issue the coin sound (issueSoundCommand), pulse the hardware
; coin counter for the credited slot (the latch's slot bit picks
; COIN_COUNTER_1 (0xb81c)/COIN_PULSE_TIMER_1 (0x837f) vs COIN_COUNTER_0
; (0xb818)/COIN_PULSE_TIMER_0 (0x837e)), and add the coinage-indexed
; credit (COINAGE_WORD (0x83d4) in {0,2,4,6}; the 2-coin coinage credits
; only every second coin via COIN_PAIR_TOGGLE (0x83e3)) to the packed-BCD
; total CREDIT_BCD (0x83e1), clamped at 0x99. Unless already playing
; (PLAY_FLAG (0x83fe)) it then forces GAME_MODE (0x83d6) to the player-
; select mode 5 (drawing the prompt via blitPlayerSelectPrompt when it was
; already 5), clears POINT_TABLE_DRAW_STATE (0x83d8), clears the
; fly/object block from FLY_SPRITE_X (0x8040), and redraws the credit line
; (renderCreditLine). Memory-only
scanCoinInputAndCredit:
2CF0: 21 E2 83        LD      HL,$83E2            
2CF3: 7E              LD      A,(HL)              
2CF4: B7              OR      A                   
2CF5: 3A 00 E0        LD      A,($E000)           
2CF8: 2F              CPL                         
2CF9: 20 04           JR      NZ,$2CFF            ; {code.loc_2cff}
2CFB: E6 C4           AND     $C4                 
2CFD: 77              LD      (HL),A              
2CFE: C9              RET                         

loc_2cff:
2CFF: E6 C4           AND     $C4                 
2D01: C0              RET     NZ                  
2D02: 3C              INC     A                   
2D03: CD 94 07        CALL    $0794               ; {code.issueSoundCommand}
2D06: AF              XOR     A                   
2D07: ED 5B D4 83     LD      DE,($83D4)          ; {hard.workRam+3D4}
2D0B: CB 76           BIT     6,(HL)              
2D0D: C2 2B 2D        JP      NZ,$2D2B            ; {code.loc_2d2b}
2D10: CB 56           BIT     2,(HL)              
2D12: 77              LD      (HL),A              
2D13: 20 09           JR      NZ,$2D1E            ; {code.loc_2d1e}
2D15: 3C              INC     A                   
2D16: 32 18 B8        LD      ($B818),A           
2D19: 3E 04           LD      A,$04               
2D1B: 32 7E 83        LD      ($837E),A           ; {hard.workRam+37E}

loc_2d1e:
2D1E: 21 23 2D        LD      HL,$2D23            
2D21: 19              ADD     HL,DE               
2D22: E9              JP      (HL)                

loc_2d23:
2D23: 18 24           JR      $2D49               ; {code.loc_2d49}

loc_2d25:
2D25: 18 1B           JR      $2D42               ; {code.loc_2d42}

loc_2d27:
2D27: 18 19           JR      $2D42               ; {code.loc_2d42}

loc_2d29:
2D29: 18 1E           JR      $2D49               ; {code.loc_2d49}

loc_2d2b:
2D2B: 77              LD      (HL),A              
2D2C: 3C              INC     A                   
2D2D: 32 1C B8        LD      ($B81C),A           
2D30: 3E 04           LD      A,$04               
2D32: 32 7F 83        LD      ($837F),A           ; {hard.workRam+37F}
2D35: 21 3A 2D        LD      HL,$2D3A            
2D38: 19              ADD     HL,DE               
2D39: E9              JP      (HL)                

loc_2d3a:
2D3A: 18 0D           JR      $2D49               ; {code.loc_2d49}

loc_2d3c:
2D3C: 18 04           JR      $2D42               ; {code.loc_2d42}

loc_2d3e:
2D3E: 18 11           JR      $2D51               ; {code.loc_2d51}

loc_2d40:
2D40: 18 13           JR      $2D55               ; {code.loc_2d55}

loc_2d42:
2D42: 21 E3 83        LD      HL,$83E3            
2D45: 34              INC     (HL)                
2D46: CB 46           BIT     0,(HL)              
2D48: C0              RET     NZ                  

loc_2d49:
2D49: 0E 01           LD      C,$01               
2D4B: 18 0A           JR      $2D57               ; {code.loc_2d57}

; ---- $2D4D-$2D50: data ----
2D4D: 0E 02 18 06

loc_2d51:
2D51: 0E 03           LD      C,$03               
2D53: 18 02           JR      $2D57               ; {code.loc_2d57}

loc_2d55:
2D55: 0E 06           LD      C,$06               

loc_2d57:
2D57: 3A E1 83        LD      A,($83E1)           ; {hard.workRam+3E1}
2D5A: 81              ADD     A,C                 
2D5B: 27              DAA                         
2D5C: 30 02           JR      NC,$2D60            ; {code.loc_2d60}
2D5E: 3E 99           LD      A,$99               

loc_2d60:
2D60: 32 E1 83        LD      ($83E1),A           ; {hard.workRam+3E1}
2D63: 3A FE 83        LD      A,($83FE)           ; {hard.workRam+3FE}
2D66: B7              OR      A                   
2D67: C0              RET     NZ                  
2D68: 3A D6 83        LD      A,($83D6)           ; {hard.workRam+3D6}
2D6B: FE 05           CP      $05                 
2D6D: CC B9 0D        CALL    Z,$0DB9             ; {code.blitPlayerSelectPrompt}
2D70: 3E 05           LD      A,$05               
2D72: 32 D6 83        LD      ($83D6),A           ; {hard.workRam+3D6}
2D75: AF              XOR     A                   
2D76: 32 D8 83        LD      ($83D8),A           ; {hard.workRam+3D8}
2D79: 21 40 80        LD      HL,$8040            
2D7C: 11 41 80        LD      DE,$8041            
2D7F: 01 1F 00        LD      BC,$001F            
2D82: 70              LD      (HL),B              
2D83: ED B0           LDIR                        
2D85: C3 67 0B        JP      $0B67               ; {code.renderCreditLine}

; Build the mode-2 intro/attract screen (dispatched at the GAME_MODE
; (0x83d6) == 2 transition): set the intro-state cell
; POINT_TABLE_DRAW_STATE (0x83d8)=0xff, fill the play-field tilemap
; (fillTilemapBlock28x32), seed the intro counters (INTRO_COUNTER_801B
; (0x801b)=5, INTRO_COUNTER_802B (0x802b)=3, zero OBJECT_ANIM_STATE_8021
; (0x8021) and INTRO_COUNTER_829B (0x829b)), and blit the title tile strip
; to VRAM at MAIN_TITLE_STRIP_VRAM (0xaa8d); when the shared time byte
; SHARED_TIME_BYTE (0x83e4) < 10 it also writes a score digit and three
; further title strips.
renderMode2IntroScreen:
2D88: 21 D8 83        LD      HL,$83D8            
2D8B: 36 FF           LD      (HL),$FF            
2D8D: CD 66 07        CALL    $0766               ; {code.fillTilemapBlock28x32}
2D90: AF              XOR     A                   
2D91: 32 9B 82        LD      ($829B),A           ; {hard.workRam+29B}
2D94: 32 21 80        LD      ($8021),A           ; {hard.workRam+21}
2D97: 3E 05           LD      A,$05               
2D99: 32 1B 80        LD      ($801B),A           ; {hard.workRam+1B}
2D9C: 3E 03           LD      A,$03               
2D9E: 32 2B 80        LD      ($802B),A           ; {hard.workRam+2B}
2DA1: 11 5C 2F        LD      DE,$2F5C            
2DA4: 21 8D AA        LD      HL,$AA8D            
2DA7: 06 0B           LD      B,$0B               
2DA9: EF              RST     $28                 
2DAA: 3A E4 83        LD      A,($83E4)           ; {hard.workRam+3E4}
2DAD: FE 0A           CP      $0A                 
2DAF: D0              RET     NC                  
2DB0: 21 15 AB        LD      HL,$AB15            
2DB3: CD A9 0B        CALL    $0BA9               ; {code.writeScoreDigitStepUp}
2DB6: 11 AE 2F        LD      DE,$2FAE            
2DB9: 06 07           LD      B,$07               
2DBB: EF              RST     $28                 
2DBC: 11 73 2F        LD      DE,$2F73            
2DBF: 06 04           LD      B,$04               
2DC1: EF              RST     $28                 
2DC2: 11 92 2F        LD      DE,$2F92            
2DC5: 06 07           LD      B,$07               
2DC7: EF              RST     $28                 
2DC8: C9              RET                         

; ---- $2DC9-$3FFF: data ----
2DC9: FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF
2DD9: FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF
2DE9: FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF
2DF9: FF FF FF FF FF FF FF 03 05 07 FF 00 02 04 06 00
2E09: 20 00 00 58 01 63 04 63 04 05 02 97 01 58 01 27
2E19: 01 05 00 1F 20 21 20 25 26 27 26 2C 2D 2E 2D 2F
2E29: 30 31 30 2C 2E 30 2E 2D 2F 31 2F 25 26 27 2C 2D
2E39: 2E 2F 30 31 2C 2E 30 2D 2F 31 04 04 04 08 08 08
2E49: 08 08 08 10 10 10 02 03 03 05 05 06 08 09 54 58
2E59: 5A 5E 56 5C 03 03 06 08 10 18 30 50 60 80 C0 E0
2E69: 05 02 02 02 08 08 05 08 02 08 08 08 0E 08 08 0E
2E79: 08 0E 08 0E 08 0E 08 05 05 08 05 02 0B 05 08 FF
2E89: C0 02 00 03 00 03 80 01 80 02 80 02 00 02 00 02
2E99: 80 03 E0 02 20 02 20 02 20 02 00 03 80 02 C0 02
2EA9: C0 02 80 03 20 02 20 02 10 39 40 D7 A7 0F 3C 36
2EB9: 10 39 40 D7 A7 0F 3C 36 10 39 40 D7 A7 0F 3C 36
2EC9: 10 39 40 D7 A7 0F 3C 36 10 16 1F 22 10 15 11 13
2ED9: 18 10 23 24 15 20 2B 25 20 18 19 2B 23 13 1F 22
2EE9: 15 10 22 11 1E 1B 19 1E 17 10 23 24 10 1E 14 10
2EF9: 22 14 10 24 18 10 24 18 2B 20 1F 19 1E 24 10 24
2F09: 11 12 1C 15 2B 17 11 1D 15 10 1F 26 15 22 11 22
2F19: 22 19 26 15 14 10 18 1F 1D 15 10 23 11 16 15 1C
2F29: 29 19 1E 24 1F 10 16 19 29 15 10 18 1F 1D 15 23
2F39: 10 12 29 10 23 11 26 19 1E 17 10 16 1F 22 10 15
2F49: 26 15 22 29 1B 1F 1E 11 1D 19 10 10 4E 10 10 01
2F59: 09 08 01 19 1E 23 15 22 24 10 13 1F 19 1E 23 13
2F69: 22 15 14 19 24 24 19 1D 15 10 10 20 15 22 20 25
2F79: 23 18 10 23 24 11 22 24 10 12 25 24 24 1F 1E 1F
2F89: 1E 15 10 1F 22 10 24 27 1F 10 20 1C 11 29 15 22
2F99: 10 1F 1E 1C 29 20 1C 25 23 10 12 1F 1E 25 23 10
2FA9: 15 28 24 22 11 10 16 22 1F 17 23 10 11 16 24 15
2FB9: 22 10 20 24 23 10 28 10 22 15 1D 11 19 1E 19 1E
2FC9: 17 10 23 15 13 1F 1E 14 FF FF FF FF FF FF FF FF
2FD9: FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF
2FE9: FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF FF
2FF9: FF FF FF FF FF FF FF 00 00 00 00 00 00 00 00 00
3009: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3019: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3029: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3039: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3049: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3059: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3069: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3079: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3089: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3099: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
30A9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
30B9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
30C9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
30D9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
30E9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
30F9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3109: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3119: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3129: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3139: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3149: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3159: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3169: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3179: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3189: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3199: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
31A9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
31B9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
31C9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
31D9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
31E9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
31F9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3209: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3219: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3229: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3239: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3249: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3259: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3269: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3279: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3289: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3299: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
32A9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
32B9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
32C9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
32D9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
32E9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
32F9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3309: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3319: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3329: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3339: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3349: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3359: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3369: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3379: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3389: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3399: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
33A9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
33B9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
33C9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
33D9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
33E9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
33F9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3409: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3419: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3429: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3439: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3449: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3459: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3469: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3479: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3489: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3499: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
34A9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
34B9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
34C9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
34D9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
34E9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
34F9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3509: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3519: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3529: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3539: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3549: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3559: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3569: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3579: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3589: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3599: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
35A9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
35B9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
35C9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
35D9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
35E9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
35F9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3609: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3619: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3629: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3639: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3649: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3659: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3669: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3679: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3689: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3699: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
36A9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
36B9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
36C9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
36D9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
36E9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
36F9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3709: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3719: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3729: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3739: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3749: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3759: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3769: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3779: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3789: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3799: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
37A9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
37B9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
37C9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
37D9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
37E9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
37F9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3809: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3819: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3829: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3839: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3849: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3859: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3869: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3879: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3889: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3899: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
38A9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
38B9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
38C9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
38D9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
38E9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
38F9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3909: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3919: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3929: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3939: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3949: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3959: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3969: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3979: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3989: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3999: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
39A9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
39B9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
39C9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
39D9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
39E9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
39F9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3A09: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3A19: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3A29: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3A39: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3A49: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3A59: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3A69: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3A79: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3A89: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3A99: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3AA9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3AB9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3AC9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3AD9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3AE9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3AF9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3B09: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3B19: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3B29: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3B39: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3B49: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3B59: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3B69: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3B79: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3B89: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3B99: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3BA9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3BB9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3BC9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3BD9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3BE9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3BF9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3C09: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3C19: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3C29: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3C39: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3C49: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3C59: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3C69: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3C79: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3C89: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3C99: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3CA9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3CB9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3CC9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3CD9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3CE9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3CF9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3D09: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3D19: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3D29: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3D39: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3D49: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3D59: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3D69: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3D79: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3D89: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3D99: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3DA9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3DB9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3DC9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3DD9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3DE9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3DF9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3E09: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3E19: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3E29: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3E39: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3E49: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3E59: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3E69: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3E79: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3E89: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3E99: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3EA9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3EB9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3EC9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3ED9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3EE9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3EF9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3F09: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3F19: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3F29: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3F39: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3F49: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3F59: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3F69: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3F79: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3F89: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3F99: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3FA9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3FB9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3FC9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3FD9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3FE9: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
3FF9: 00 00 00 00 00 00 00
```
