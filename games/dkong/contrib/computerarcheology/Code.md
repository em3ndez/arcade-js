![Donkey Kong](dkong.jpg)

# Donkey Kong Main CPU (Z80)

>>> cpu Z80

>>> binary 0000:roms/c_5et_g.bin + roms/c_5ct_g.bin + roms/c_5bt_g.bin + roms/c_5at_g.bin

>>> memoryTable hard

[Hardware Info](Hardware.md)

>>> memoryTable ram

[RAM Usage](RAMUse.md)

```code
boot:
0000: 3E 00           LD      A,$00               
0002: 32 84 7D        LD      ($7D84),A           ; {hard.nmiEnable}
0005: C3 66 02        JP      $0266               ; {code.clearRamAndInitHardware}

gameActiveGuard:
0008: 3A 07 60        LD      A,($6007)           ; {ram.attract}
000B: 0F              RRCA                        
000C: D0              RET     NC                  
000D: 33              INC     SP                  
000E: 33              INC     SP                  
000F: C9              RET                         

marioActiveGuard:
0010: 3A 00 62        LD      A,($6200)           ; {ram.marioActive}
0013: 0F              RRCA                        
0014: D8              RET     C                   
0015: 33              INC     SP                  
0016: 33              INC     SP                  
0017: C9              RET                         

tickSubstateTimer:
0018: 21 09 60        LD      HL,$6009            
001B: 35              DEC     (HL)                
001C: C8              RET     Z                   
001D: 33              INC     SP                  
001E: 33              INC     SP                  
001F: C9              RET                         

tickSubstatePrescaler:
0020: 21 08 60        LD      HL,$6008            
0023: 35              DEC     (HL)                
0024: 28 F2           JR      Z,$0018             ; {code.tickSubstateTimer}

loc_0026:
0026: E1              POP     HL                  
0027: C9              RET                         

dispatchInlineJumpTable:
0028: 87              ADD     A,A                 
0029: E1              POP     HL                  
002A: 5F              LD      E,A                 
002B: 16 00           LD      D,$00               
002D: C3 32 00        JP      $0032               ; {code.loc_0032}

boardBitGate:
0030: 18 12           JR      $0044               ; {code.loc_0044}

loc_0032:
0032: 19              ADD     HL,DE               
0033: 5E              LD      E,(HL)              
0034: 23              INC     HL                  
0035: 56              LD      D,(HL)              
0036: EB              EX      DE,HL               
0037: E9              JP      (HL)                

addToSpriteObjectColumn:
0038: 11 04 00        LD      DE,$0004            
003B: 06 0A           LD      B,$0A               

addStrided:
003D: 79              LD      A,C                 
003E: 86              ADD     A,(HL)              
003F: 77              LD      (HL),A              
0040: 19              ADD     HL,DE               
0041: 10 FA           DJNZ    $003D               ; {code.addStrided}
0043: C9              RET                         

loc_0044:
0044: 21 27 62        LD      HL,$6227            
0047: 46              LD      B,(HL)              

loc_0048:
0048: 0F              RRCA                        
0049: 10 FD           DJNZ    $0048               ; {code.loc_0048}
004B: D8              RET     C                   
004C: E1              POP     HL                  
004D: C9              RET                         

loadSpriteObjectBlock:
004E: 11 08 69        LD      DE,$6908            
0051: 01 28 00        LD      BC,$0028            
0054: ED B0           LDIR                        
0056: C9              RET                         

stirRandomSeed:
0057: 3A 18 60        LD      A,($6018)           ; {ram.random}
005A: 21 1A 60        LD      HL,$601A            
005D: 86              ADD     A,(HL)              
005E: 21 19 60        LD      HL,$6019            
0061: 86              ADD     A,(HL)              
0062: 32 18 60        LD      ($6018),A           ; {ram.random}
0065: C9              RET                         

serviceVblankNmi:
0066: F5              PUSH    AF                  
0067: C5              PUSH    BC                  
0068: D5              PUSH    DE                  
0069: E5              PUSH    HL                  
006A: DD E5           PUSH    IX                  
006C: FD E5           PUSH    IY                  
006E: AF              XOR     A                   
006F: 32 84 7D        LD      ($7D84),A           ; {hard.nmiEnable}
0072: 3A 00 7D        LD      A,($7D00)           ; {hard.in2}
0075: E6 01           AND     $01                 
0077: C2 00 40        JP      NZ,$4000            
007A: 21 38 01        LD      HL,$0138            
007D: CD 41 01        CALL    $0141               ; {code.blitSpritesViaDma}
0080: 3A 07 60        LD      A,($6007)           ; {ram.attract}
0083: A7              AND     A                   
0084: C2 B5 00        JP      NZ,$00B5            ; {code.perFrame}

readControls:
0087: 3A 26 60        LD      A,($6026)           ; {ram.dipUpright}
008A: A7              AND     A                   
008B: C2 98 00        JP      NZ,$0098            ; {code.loc_0098}
008E: 3A 0E 60        LD      A,($600E)           ; {ram.activePlayerIndex}
0091: A7              AND     A                   
0092: 3A 80 7C        LD      A,($7C80)           ; {hard.in1}
0095: C2 9B 00        JP      NZ,$009B            ; {code.loc_009b}

loc_0098:
0098: 3A 00 7C        LD      A,($7C00)           ; {hard.in0}

loc_009b:
009B: 47              LD      B,A                 
009C: E6 0F           AND     $0F                 
009E: 4F              LD      C,A                 
009F: 3A 11 60        LD      A,($6011)           ; {ram.p1InputRaw}
00A2: 2F              CPL                         
00A3: A0              AND     B                   
00A4: E6 10           AND     $10                 
00A6: 17              RLA                         
00A7: 17              RLA                         
00A8: 17              RLA                         
00A9: B1              OR      C                   
00AA: 60              LD      H,B                 
00AB: 6F              LD      L,A                 
00AC: 22 10 60        LD      ($6010),HL          ; {ram.p1Input}
00AF: 78              LD      A,B                 
00B0: CB 77           BIT     6,A                 
00B2: C2 00 00        JP      NZ,$0000            ; {code.boot}

perFrame:
00B5: 21 1A 60        LD      HL,$601A            
00B8: 35              DEC     (HL)                
00B9: CD 57 00        CALL    $0057               ; {code.stirRandomSeed}
00BC: CD 7B 01        CALL    $017B               ; {code.serviceCoinInput}
00BF: CD E0 00        CALL    $00E0               ; {code.soundDriverTick}
00C2: 21 D2 00        LD      HL,$00D2            
00C5: E5              PUSH    HL                  
00C6: 3A 05 60        LD      A,($6005)           ; {ram.gameState}
00C9: EF              RST     $28                 

; ---- $00CA-$00D1: jump table ----
00CA: C3 01 3C 07 B2 08 FE 06

loc_00d2:
00D2: FD E1           POP     IY                  
00D4: DD E1           POP     IX                  
00D6: E1              POP     HL                  
00D7: D1              POP     DE                  
00D8: C1              POP     BC                  
00D9: 3E 01           LD      A,$01               
00DB: 32 84 7D        LD      ($7D84),A           ; {hard.nmiEnable}
00DE: F1              POP     AF                  
00DF: C9              RET                         

soundDriverTick:
00E0: 21 80 60        LD      HL,$6080            
00E3: 11 00 7D        LD      DE,$7D00            
00E6: 3A 07 60        LD      A,($6007)           ; {ram.attract}
00E9: A7              AND     A                   
00EA: C0              RET     NZ                  
00EB: 06 08           LD      B,$08               

loc_00ed:
00ED: 7E              LD      A,(HL)              
00EE: A7              AND     A                   
00EF: CA F5 00        JP      Z,$00F5             ; {code.loc_00f5}
00F2: 35              DEC     (HL)                
00F3: 3E 01           LD      A,$01               

loc_00f5:
00F5: 12              LD      (DE),A              
00F6: 1C              INC     E                   
00F7: 2C              INC     L                   
00F8: 10 F3           DJNZ    $00ED               ; {code.loc_00ed}
00FA: 21 8B 60        LD      HL,$608B            
00FD: 7E              LD      A,(HL)              
00FE: A7              AND     A                   
00FF: C2 08 01        JP      NZ,$0108            ; {code.loc_0108}
0102: 2D              DEC     L                   
0103: 2D              DEC     L                   
0104: 7E              LD      A,(HL)              
0105: C3 0B 01        JP      $010B               ; {code.loc_010b}

loc_0108:
0108: 35              DEC     (HL)                
0109: 2D              DEC     L                   
010A: 7E              LD      A,(HL)              

loc_010b:
010B: 32 00 7C        LD      ($7C00),A           ; {hard.tuneLatch}
010E: 21 88 60        LD      HL,$6088            
0111: AF              XOR     A                   
0112: BE              CP      (HL)                
0113: CA 18 01        JP      Z,$0118             ; {code.loc_0118}
0116: 35              DEC     (HL)                
0117: 3C              INC     A                   

loc_0118:
0118: 32 80 7D        LD      ($7D80),A           ; {hard.soundIrq}
011B: C9              RET                         

silenceSound:
011C: 06 08           LD      B,$08               
011E: AF              XOR     A                   
011F: 21 00 7D        LD      HL,$7D00            
0122: 11 80 60        LD      DE,$6080            

loc_0125:
0125: 77              LD      (HL),A              
0126: 12              LD      (DE),A              
0127: 2C              INC     L                   
0128: 1C              INC     E                   
0129: 10 FA           DJNZ    $0125               ; {code.loc_0125}
012B: 06 04           LD      B,$04               

loc_012d:
012D: 12              LD      (DE),A              
012E: 1C              INC     E                   
012F: 10 FC           DJNZ    $012D               ; {code.loc_012d}
0131: 32 80 7D        LD      ($7D80),A           ; {hard.soundIrq}
0134: 32 00 7C        LD      ($7C00),A           ; {hard.tuneLatch}
0137: C9              RET                         

; ---- $0138-$0140: data ----
0138: 53 00 69 80 41 00 70 80 81

blitSpritesViaDma:
0141: AF              XOR     A                   
0142: 32 85 7D        LD      ($7D85),A           ; {hard.dmaRequest}
0145: 7E              LD      A,(HL)              
0146: 32 08 78        LD      ($7808),A           ; {hard.dma8257+8}
0149: 23              INC     HL                  
014A: 7E              LD      A,(HL)              
014B: 32 00 78        LD      ($7800),A           ; {hard.dma8257}
014E: 23              INC     HL                  
014F: 7E              LD      A,(HL)              
0150: 32 00 78        LD      ($7800),A           ; {hard.dma8257}
0153: 23              INC     HL                  
0154: 7E              LD      A,(HL)              
0155: 32 01 78        LD      ($7801),A           ; {hard.dma8257+1}
0158: 23              INC     HL                  
0159: 7E              LD      A,(HL)              
015A: 32 01 78        LD      ($7801),A           ; {hard.dma8257+1}
015D: 23              INC     HL                  
015E: 7E              LD      A,(HL)              
015F: 32 02 78        LD      ($7802),A           ; {hard.dma8257+2}
0162: 23              INC     HL                  
0163: 7E              LD      A,(HL)              
0164: 32 02 78        LD      ($7802),A           ; {hard.dma8257+2}
0167: 23              INC     HL                  
0168: 7E              LD      A,(HL)              
0169: 32 03 78        LD      ($7803),A           ; {hard.dma8257+3}
016C: 23              INC     HL                  
016D: 7E              LD      A,(HL)              
016E: 32 03 78        LD      ($7803),A           ; {hard.dma8257+3}
0171: 3E 01           LD      A,$01               
0173: 32 85 7D        LD      ($7D85),A           ; {hard.dmaRequest}
0176: AF              XOR     A                   
0177: 32 85 7D        LD      ($7D85),A           ; {hard.dmaRequest}
017A: C9              RET                         

serviceCoinInput:
017B: 3A 00 7D        LD      A,($7D00)           ; {hard.in2}
017E: CB 7F           BIT     7,A                 
0180: 21 03 60        LD      HL,$6003            
0183: C2 89 01        JP      NZ,$0189            ; {code.loc_0189}
0186: 36 01           LD      (HL),$01            
0188: C9              RET                         

loc_0189:
0189: 7E              LD      A,(HL)              
018A: A7              AND     A                   
018B: C8              RET     Z                   
018C: E5              PUSH    HL                  
018D: 3A 05 60        LD      A,($6005)           ; {ram.gameState}
0190: FE 03           CP      $03                 
0192: CA 9D 01        JP      Z,$019D             ; {code.loc_019d}
0195: CD 1C 01        CALL    $011C               ; {code.silenceSound}
0198: 3E 03           LD      A,$03               
019A: 32 83 60        LD      ($6083),A           ; {hard.workRam+83}

loc_019d:
019D: E1              POP     HL                  
019E: 36 00           LD      (HL),$00            
01A0: 2B              DEC     HL                  
01A1: 34              INC     (HL)                
01A2: 11 24 60        LD      DE,$6024            
01A5: 1A              LD      A,(DE)              
01A6: 96              SUB     (HL)                
01A7: C0              RET     NZ                  
01A8: 77              LD      (HL),A              
01A9: 13              INC     DE                  
01AA: 2B              DEC     HL                  
01AB: EB              EX      DE,HL               
01AC: 1A              LD      A,(DE)              
01AD: FE 90           CP      $90                 
01AF: D0              RET     NC                  
01B0: 86              ADD     A,(HL)              
01B1: 27              DAA                         
01B2: 12              LD      (DE),A              
01B3: 11 00 04        LD      DE,$0400            
01B6: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
01B9: C9              RET                         

; ---- $01BA-$01C2: data ----
01BA: 00 37 00 AA AA AA 50 76 00

powerOnInit:
01C3: CD 74 08        CALL    $0874               ; {code.clearPlayfieldAndSprites}
01C6: 21 BA 01        LD      HL,$01BA            
01C9: 11 B2 60        LD      DE,$60B2            
01CC: 01 09 00        LD      BC,$0009            
01CF: ED B0           LDIR                        
01D1: 3E 01           LD      A,$01               
01D3: 32 07 60        LD      ($6007),A           ; {ram.attract}
01D6: 32 29 62        LD      ($6229),A           ; {ram.level}
01D9: 32 28 62        LD      ($6228),A           ; {ram.lives}
01DC: CD B8 06        CALL    $06B8               ; {code.drawLivesAndLevel}

loc_01df:
01DF: CD 07 02        CALL    $0207               ; {code.decodeDipSwitches}
01E2: 3E 01           LD      A,$01               
01E4: 32 82 7D        LD      ($7D82),A           ; {hard.flipScreen}
01E7: 32 05 60        LD      ($6005),A           ; {ram.gameState}
01EA: 32 27 62        LD      ($6227),A           ; {ram.board}
01ED: AF              XOR     A                   
01EE: 32 0A 60        LD      ($600A),A           ; {ram.gameSubstate}
01F1: CD 53 0A        CALL    $0A53               ; {code.draw1UpLabel}
01F4: 11 04 03        LD      DE,$0304            
01F7: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
01FA: 11 02 02        LD      DE,$0202            
01FD: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0200: 11 00 02        LD      DE,$0200            
0203: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0206: C9              RET                         

decodeDipSwitches:
0207: 3A 80 7D        LD      A,($7D80)           ; {hard.dsw1}
020A: 4F              LD      C,A                 
020B: 21 20 60        LD      HL,$6020            
020E: E6 03           AND     $03                 
0210: C6 03           ADD     A,$03               
0212: 77              LD      (HL),A              
0213: 23              INC     HL                  
0214: 79              LD      A,C                 
0215: 0F              RRCA                        
0216: 0F              RRCA                        
0217: E6 03           AND     $03                 
0219: 47              LD      B,A                 
021A: 3E 07           LD      A,$07               
021C: CA 26 02        JP      Z,$0226             ; {code.loc_0226}
021F: 3E 05           LD      A,$05               

loc_0221:
0221: C6 05           ADD     A,$05               
0223: 27              DAA                         
0224: 10 FB           DJNZ    $0221               ; {code.loc_0221}

loc_0226:
0226: 77              LD      (HL),A              
0227: 23              INC     HL                  
0228: 79              LD      A,C                 
0229: 01 01 01        LD      BC,$0101            
022C: 11 02 01        LD      DE,$0102            
022F: E6 70           AND     $70                 
0231: 17              RLA                         
0232: 17              RLA                         
0233: 17              RLA                         
0234: 17              RLA                         
0235: CA 47 02        JP      Z,$0247             ; {code.loc_0247}
0238: DA 41 02        JP      C,$0241             ; {code.loc_0241}
023B: 3C              INC     A                   
023C: 4F              LD      C,A                 
023D: 5A              LD      E,D                 
023E: C3 47 02        JP      $0247               ; {code.loc_0247}

loc_0241:
0241: C6 02           ADD     A,$02               
0243: 47              LD      B,A                 
0244: 57              LD      D,A                 
0245: 87              ADD     A,A                 
0246: 5F              LD      E,A                 

loc_0247:
0247: 72              LD      (HL),D              
0248: 23              INC     HL                  
0249: 73              LD      (HL),E              
024A: 23              INC     HL                  
024B: 70              LD      (HL),B              
024C: 23              INC     HL                  
024D: 71              LD      (HL),C              
024E: 23              INC     HL                  
024F: 3A 80 7D        LD      A,($7D80)           ; {hard.dsw1}
0252: 07              RLCA                        
0253: 3E 01           LD      A,$01               
0255: DA 59 02        JP      C,$0259             ; {code.loc_0259}
0258: 3D              DEC     A                   

loc_0259:
0259: 77              LD      (HL),A              
025A: 21 65 35        LD      HL,$3565            
025D: 11 00 61        LD      DE,$6100            
0260: 01 AA 00        LD      BC,$00AA            
0263: ED B0           LDIR                        
0265: C9              RET                         

clearRamAndInitHardware:
0266: 06 10           LD      B,$10               
0268: 21 00 60        LD      HL,$6000            
026B: AF              XOR     A                   

loc_026c:
026C: 4F              LD      C,A                 

loc_026d:
026D: 77              LD      (HL),A              
026E: 23              INC     HL                  
026F: 0D              DEC     C                   
0270: 20 FB           JR      NZ,$026D            ; {code.loc_026d}
0272: 10 F8           DJNZ    $026C               ; {code.loc_026c}
0274: 06 04           LD      B,$04               
0276: 21 00 70        LD      HL,$7000            

loc_0279:
0279: 4F              LD      C,A                 

loc_027a:
027A: 77              LD      (HL),A              
027B: 23              INC     HL                  
027C: 0D              DEC     C                   
027D: 20 FB           JR      NZ,$027A            ; {code.loc_027a}
027F: 10 F8           DJNZ    $0279               ; {code.loc_0279}
0281: 06 04           LD      B,$04               
0283: 3E 10           LD      A,$10               
0285: 21 00 74        LD      HL,$7400            

loc_0288:
0288: 0E 00           LD      C,$00               

loc_028a:
028A: 77              LD      (HL),A              
028B: 23              INC     HL                  
028C: 0D              DEC     C                   
028D: 20 FB           JR      NZ,$028A            ; {code.loc_028a}
028F: 10 F7           DJNZ    $0288               ; {code.loc_0288}
0291: 21 C0 60        LD      HL,$60C0            
0294: 06 40           LD      B,$40               
0296: 3E FF           LD      A,$FF               

loc_0298:
0298: 77              LD      (HL),A              
0299: 23              INC     HL                  
029A: 10 FC           DJNZ    $0298               ; {code.loc_0298}
029C: 3E C0           LD      A,$C0               
029E: 32 B0 60        LD      ($60B0),A           ; {ram.taskTail}
02A1: 32 B1 60        LD      ($60B1),A           ; {ram.taskHead}
02A4: AF              XOR     A                   
02A5: 32 83 7D        LD      ($7D83),A           ; {hard.spriteBank}
02A8: 32 86 7D        LD      ($7D86),A           ; {hard.paletteBank0}
02AB: 32 87 7D        LD      ($7D87),A           ; {hard.paletteBank1}
02AE: 3C              INC     A                   
02AF: 32 82 7D        LD      ($7D82),A           ; {hard.flipScreen}
02B2: 31 00 6C        LD      SP,$6C00            
02B5: CD 1C 01        CALL    $011C               ; {code.silenceSound}
02B8: 3E 01           LD      A,$01               
02BA: 32 84 7D        LD      ($7D84),A           ; {hard.nmiEnable}

mainLoop:
02BD: 26 60           LD      H,$60               
02BF: 3A B1 60        LD      A,($60B1)           ; {ram.taskHead}
02C2: 6F              LD      L,A                 
02C3: 7E              LD      A,(HL)              
02C4: 87              ADD     A,A                 
02C5: 30 1C           JR      NC,$02E3            ; {code.loc_02e3}
02C7: CD 15 03        CALL    $0315               ; {code.redrawPlayerUpIndicator}
02CA: CD 50 03        CALL    $0350               ; {code.awardBonusLifeAtThreshold}
02CD: 21 19 60        LD      HL,$6019            
02D0: 34              INC     (HL)                
02D1: 21 83 63        LD      HL,$6383            
02D4: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
02D7: BE              CP      (HL)                
02D8: 28 E3           JR      Z,$02BD             ; {code.mainLoop}
02DA: 77              LD      (HL),A              
02DB: CD 7F 03        CALL    $037F               ; {code.rampDifficulty}
02DE: CD A2 03        CALL    $03A2               ; {code.animateFixedHazardAndReleaseFire}
02E1: 18 DA           JR      $02BD               ; {code.mainLoop}

loc_02e3:
02E3: E6 1F           AND     $1F                 
02E5: 5F              LD      E,A                 
02E6: 16 00           LD      D,$00               
02E8: 36 FF           LD      (HL),$FF            
02EA: 2C              INC     L                   
02EB: 4E              LD      C,(HL)              
02EC: 36 FF           LD      (HL),$FF            
02EE: 2C              INC     L                   
02EF: 7D              LD      A,L                 
02F0: FE C0           CP      $C0                 
02F2: 30 02           JR      NC,$02F6            ; {code.loc_02f6}
02F4: 3E C0           LD      A,$C0               

loc_02f6:
02F6: 32 B1 60        LD      ($60B1),A           ; {ram.taskHead}
02F9: 79              LD      A,C                 
02FA: 21 BD 02        LD      HL,$02BD            
02FD: E5              PUSH    HL                  
02FE: 21 07 03        LD      HL,$0307            
0301: 19              ADD     HL,DE               
0302: 5E              LD      E,(HL)              
0303: 23              INC     HL                  
0304: 56              LD      D,(HL)              
0305: EB              EX      DE,HL               
0306: E9              JP      (HL)                

; ---- $0307-$0314: data ----
0307: 1C 05 9B 05 C6 05 E9 05 11 06 2A 06 B8 06

redrawPlayerUpIndicator:
0315: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
0318: 47              LD      B,A                 
0319: E6 0F           AND     $0F                 
031B: C0              RET     NZ                  
031C: CF              RST     $08                 
031D: 3A 0D 60        LD      A,($600D)           ; {ram.currentPlayer}
0320: CD 47 03        CALL    $0347               ; {code.selectPlayerIndicatorColumnBase}
0323: 11 E0 FF        LD      DE,$FFE0            
0326: CB 60           BIT     4,B                 
0328: 28 14           JR      Z,$033E             ; {code.loc_033e}
032A: 3E 10           LD      A,$10               
032C: 77              LD      (HL),A              
032D: 19              ADD     HL,DE               
032E: 77              LD      (HL),A              
032F: 19              ADD     HL,DE               
0330: 77              LD      (HL),A              
0331: 3A 0F 60        LD      A,($600F)           ; {ram.twoPlayerGame}
0334: A7              AND     A                   
0335: C8              RET     Z                   
0336: 3A 0D 60        LD      A,($600D)           ; {ram.currentPlayer}
0339: EE 01           XOR     $01                 
033B: CD 47 03        CALL    $0347               ; {code.selectPlayerIndicatorColumnBase}

loc_033e:
033E: 3C              INC     A                   
033F: 77              LD      (HL),A              
0340: 19              ADD     HL,DE               
0341: 36 25           LD      (HL),$25            
0343: 19              ADD     HL,DE               
0344: 36 20           LD      (HL),$20            
0346: C9              RET                         

selectPlayerIndicatorColumnBase:
0347: 21 40 77        LD      HL,$7740            
034A: A7              AND     A                   
034B: C8              RET     Z                   
034C: 21 E0 74        LD      HL,$74E0            
034F: C9              RET                         

awardBonusLifeAtThreshold:
0350: 3A 2D 62        LD      A,($622D)           ; {ram.bonusLifeAwarded}
0353: A7              AND     A                   
0354: C0              RET     NZ                  
0355: 21 B3 60        LD      HL,$60B3            
0358: 3A 0D 60        LD      A,($600D)           ; {ram.currentPlayer}
035B: A7              AND     A                   
035C: 28 03           JR      Z,$0361             ; {code.loc_0361}
035E: 21 B6 60        LD      HL,$60B6            

loc_0361:
0361: 7E              LD      A,(HL)              
0362: E6 F0           AND     $F0                 
0364: 47              LD      B,A                 
0365: 23              INC     HL                  
0366: 7E              LD      A,(HL)              
0367: E6 0F           AND     $0F                 
0369: B0              OR      B                   
036A: 0F              RRCA                        
036B: 0F              RRCA                        
036C: 0F              RRCA                        
036D: 0F              RRCA                        
036E: 21 21 60        LD      HL,$6021            
0371: BE              CP      (HL)                
0372: D8              RET     C                   
0373: 3E 01           LD      A,$01               
0375: 32 2D 62        LD      ($622D),A           ; {ram.bonusLifeAwarded}
0378: 21 28 62        LD      HL,$6228            
037B: 34              INC     (HL)                
037C: C3 B8 06        JP      $06B8               ; {code.drawLivesAndLevel}

rampDifficulty:
037F: 21 84 63        LD      HL,$6384            
0382: 7E              LD      A,(HL)              
0383: 34              INC     (HL)                
0384: A7              AND     A                   
0385: C0              RET     NZ                  
0386: 21 81 63        LD      HL,$6381            
0389: 7E              LD      A,(HL)              
038A: 47              LD      B,A                 
038B: 34              INC     (HL)                
038C: E6 07           AND     $07                 
038E: C0              RET     NZ                  
038F: 78              LD      A,B                 
0390: 0F              RRCA                        
0391: 0F              RRCA                        
0392: 0F              RRCA                        
0393: 47              LD      B,A                 
0394: 3A 29 62        LD      A,($6229)           ; {ram.level}
0397: 80              ADD     A,B                 
0398: FE 05           CP      $05                 
039A: 38 02           JR      C,$039E             ; {code.loc_039e}
039C: 3E 05           LD      A,$05               

loc_039e:
039E: 32 80 63        LD      ($6380),A           ; {ram.difficulty}
03A1: C9              RET                         

animateFixedHazardAndReleaseFire:
03A2: 3E 03           LD      A,$03               
03A4: F7              RST     $30                 
03A5: D7              RST     $10                 
03A6: 3A 50 63        LD      A,($6350)           ; {hard.workRam+350}
03A9: 0F              RRCA                        
03AA: D8              RET     C                   
03AB: 21 B8 62        LD      HL,$62B8            
03AE: 35              DEC     (HL)                
03AF: C0              RET     NZ                  
03B0: 36 04           LD      (HL),$04            
03B2: 3A B9 62        LD      A,($62B9)           ; {hard.workRam+2B9}
03B5: 0F              RRCA                        
03B6: D0              RET     NC                  
03B7: 21 29 6A        LD      HL,$6A29            
03BA: 06 40           LD      B,$40               
03BC: DD 21 A0 66     LD      IX,$66A0            
03C0: 0F              RRCA                        
03C1: D2 E4 03        JP      NC,$03E4            ; {code.loc_03e4}
03C4: DD 36 09 02     LD      (IX+$09),$02        
03C8: DD 36 0A 02     LD      (IX+$0A),$02        
03CC: 04              INC     B                   
03CD: 04              INC     B                   
03CE: CD F2 03        CALL    $03F2               ; {code.loc_03f2}
03D1: 21 BA 62        LD      HL,$62BA            
03D4: 35              DEC     (HL)                
03D5: C0              RET     NZ                  
03D6: 3E 01           LD      A,$01               
03D8: 32 B9 62        LD      ($62B9),A           ; {hard.workRam+2B9}
03DB: 32 A0 63        LD      ($63A0),A           ; {ram.eventReq313c}

loc_03de:
03DE: 3E 10           LD      A,$10               
03E0: 32 BA 62        LD      ($62BA),A           ; {hard.workRam+2BA}
03E3: C9              RET                         

loc_03e4:
03E4: DD 36 09 02     LD      (IX+$09),$02        
03E8: DD 36 0A 00     LD      (IX+$0A),$00        
03EC: CD F2 03        CALL    $03F2               ; {code.loc_03f2}
03EF: C3 DE 03        JP      $03DE               ; {code.loc_03de}

loc_03f2:
03F2: 70              LD      (HL),B              
03F3: 3A 19 60        LD      A,($6019)           ; {ram.spinCount}
03F6: 0F              RRCA                        
03F7: D8              RET     C                   
03F8: 04              INC     B                   
03F9: 70              LD      (HL),B              
03FA: C9              RET                         

slide50mSpriteRowAndServiceColorCycle:
03FB: 3A 27 62        LD      A,($6227)           ; {ram.board}
03FE: FE 02           CP      $02                 
0400: C2 13 04        JP      NZ,$0413            ; {code.serviceColorCycle}
0403: 21 08 69        LD      HL,$6908            
0406: 3A A3 63        LD      A,($63A3)           ; {ram.m50Obj1Step}
0409: 4F              LD      C,A                 
040A: FF              RST     $38                 
040B: 3A 10 69        LD      A,($6910)           ; {hard.workRam+910}
040E: D6 3B           SUB     $3B                 
0410: 32 B7 63        LD      ($63B7),A           ; {ram.m50ObjRowShift}

serviceColorCycle:
0413: 3A 91 63        LD      A,($6391)           ; {ram.colourCycleActive}
0416: A7              AND     A                   
0417: C2 26 04        JP      NZ,$0426            ; {code.advanceColorCycleSweep}
041A: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
041D: A7              AND     A                   
041E: C2 86 04        JP      NZ,$0486            ; {code.dispatchColorCyclePaint}
0421: 3E 01           LD      A,$01               
0423: 32 91 63        LD      ($6391),A           ; {ram.colourCycleActive}

advanceColorCycleSweep:
0426: 21 90 63        LD      HL,$6390            
0429: 34              INC     (HL)                
042A: 7E              LD      A,(HL)              
042B: FE 80           CP      $80                 
042D: CA 64 04        JP      Z,$0464             ; {code.resetColorCycleSweep}
0430: 3A 93 63        LD      A,($6393)           ; {hard.workRam+393}
0433: A7              AND     A                   
0434: C2 86 04        JP      NZ,$0486            ; {code.dispatchColorCyclePaint}
0437: 7E              LD      A,(HL)              
0438: 47              LD      B,A                 
0439: E6 1F           AND     $1F                 
043B: C2 86 04        JP      NZ,$0486            ; {code.dispatchColorCyclePaint}
043E: 21 CF 39        LD      HL,$39CF            
0441: CB 68           BIT     5,B                 
0443: 20 03           JR      NZ,$0448            ; {code.loc_0448}
0445: 21 F7 39        LD      HL,$39F7            

loc_0448:
0448: CD 4E 00        CALL    $004E               ; {code.loadSpriteObjectBlock}
044B: 3E 03           LD      A,$03               
044D: 32 82 60        LD      ($6082),A           ; {hard.workRam+82}

dispatchColorCascadeByBoard:
0450: 3A 27 62        LD      A,($6227)           ; {ram.board}
0453: 0F              RRCA                        
0454: D2 78 04        JP      NC,$0478            ; {code.shiftEvenBoardSpriteColumn}
0457: 0F              RRCA                        
0458: DA 86 04        JP      C,$0486             ; {code.dispatchColorCyclePaint}
045B: 21 0B 69        LD      HL,$690B            
045E: 0E FC           LD      C,$FC               
0460: FF              RST     $38                 
0461: C3 86 04        JP      $0486               ; {code.dispatchColorCyclePaint}

resetColorCycleSweep:
0464: AF              XOR     A                   
0465: 77              LD      (HL),A              
0466: 23              INC     HL                  
0467: 77              LD      (HL),A              
0468: 3A 93 63        LD      A,($6393)           ; {hard.workRam+393}
046B: A7              AND     A                   
046C: C2 86 04        JP      NZ,$0486            ; {code.dispatchColorCyclePaint}
046F: 21 5C 38        LD      HL,$385C            
0472: CD 4E 00        CALL    $004E               ; {code.loadSpriteObjectBlock}
0475: C3 50 04        JP      $0450               ; {code.dispatchColorCascadeByBoard}

shiftEvenBoardSpriteColumn:
0478: 21 08 69        LD      HL,$6908            
047B: 0E 44           LD      C,$44               
047D: 0F              RRCA                        
047E: D2 85 04        JP      NC,$0485            ; {code.loc_0485}
0481: 3A B7 63        LD      A,($63B7)           ; {ram.m50ObjRowShift}
0484: 4F              LD      C,A                 

loc_0485:
0485: FF              RST     $38                 

dispatchColorCyclePaint:
0486: 3A 90 63        LD      A,($6390)           ; {hard.workRam+390}
0489: 4F              LD      C,A                 
048A: 11 20 00        LD      DE,$0020            
048D: 3A 27 62        LD      A,($6227)           ; {ram.board}
0490: FE 04           CP      $04                 
0492: CA BE 04        JP      Z,$04BE             ; {code.runRivetColorCycleBlink}
0495: 79              LD      A,C                 
0496: A7              AND     A                   
0497: CA A1 04        JP      Z,$04A1             ; {code.paintColorColumnWithLowCode}
049A: 3E EF           LD      A,$EF               
049C: CB 71           BIT     6,C                 
049E: C2 A3 04        JP      NZ,$04A3            ; {code.paintColorColumnAndHoldBlink}

paintColorColumnWithLowCode:
04A1: 3E 10           LD      A,$10               

paintColorColumnAndHoldBlink:
04A3: 21 C4 75        LD      HL,$75C4            
04A6: CD 14 05        CALL    $0514               ; {code.fillDescendingColumn}
04A9: 3A 05 69        LD      A,($6905)           ; {hard.workRam+905}

storeBlinkSpriteCode:
04AC: 32 05 69        LD      ($6905),A           ; {hard.workRam+905}
04AF: CB 71           BIT     6,C                 
04B1: C8              RET     Z                   
04B2: 47              LD      B,A                 
04B3: 79              LD      A,C                 
04B4: E6 07           AND     $07                 
04B6: C0              RET     NZ                  
04B7: 78              LD      A,B                 
04B8: EE 03           XOR     $03                 
04BA: 32 05 69        LD      ($6905),A           ; {hard.workRam+905}
04BD: C9              RET                         

runRivetColorCycleBlink:
04BE: 3E 10           LD      A,$10               
04C0: 21 23 76        LD      HL,$7623            
04C3: CD 14 05        CALL    $0514               ; {code.fillDescendingColumn}
04C6: 21 83 75        LD      HL,$7583            
04C9: CD 14 05        CALL    $0514               ; {code.fillDescendingColumn}
04CC: CB 71           BIT     6,C                 
04CE: CA 09 05        JP      Z,$0509             ; {code.blinkSpritePairByX}
04D1: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
04D4: FE 80           CP      $80                 
04D6: D2 F1 04        JP      NC,$04F1            ; {code.paintColorColumnAndBlinkOff}
04D9: 3E DF           LD      A,$DF               
04DB: 21 23 76        LD      HL,$7623            
04DE: CD 14 05        CALL    $0514               ; {code.fillDescendingColumn}

blinkSpritePairOn:
04E1: 3A 01 69        LD      A,($6901)           ; {hard.workRam+901}
04E4: F6 80           OR      $80                 
04E6: 32 01 69        LD      ($6901),A           ; {hard.workRam+901}
04E9: 3A 05 69        LD      A,($6905)           ; {hard.workRam+905}
04EC: F6 80           OR      $80                 
04EE: C3 AC 04        JP      $04AC               ; {code.storeBlinkSpriteCode}

paintColorColumnAndBlinkOff:
04F1: 3E EF           LD      A,$EF               
04F3: 21 83 75        LD      HL,$7583            
04F6: CD 14 05        CALL    $0514               ; {code.fillDescendingColumn}

blinkSpritePairOff:
04F9: 3A 01 69        LD      A,($6901)           ; {hard.workRam+901}
04FC: E6 7F           AND     $7F                 
04FE: 32 01 69        LD      ($6901),A           ; {hard.workRam+901}
0501: 3A 05 69        LD      A,($6905)           ; {hard.workRam+905}
0504: E6 7F           AND     $7F                 
0506: C3 AC 04        JP      $04AC               ; {code.storeBlinkSpriteCode}

blinkSpritePairByX:
0509: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
050C: FE 80           CP      $80                 
050E: D2 F9 04        JP      NC,$04F9            ; {code.blinkSpritePairOff}
0511: C3 E1 04        JP      $04E1               ; {code.blinkSpritePairOn}

fillDescendingColumn:
0514: 06 03           LD      B,$03               

loc_0516:
0516: 77              LD      (HL),A              
0517: 19              ADD     HL,DE               
0518: 3D              DEC     A                   
0519: 10 FB           DJNZ    $0516               ; {code.loc_0516}
051B: C9              RET                         

addToScoreTask:
051C: 4F              LD      C,A                 
051D: CF              RST     $08                 
051E: CD 5F 05        CALL    $055F               ; {code.selectCurrentPlayerScoreCounter}
0521: 79              LD      A,C                 
0522: 81              ADD     A,C                 
0523: 81              ADD     A,C                 
0524: 4F              LD      C,A                 
0525: 21 29 35        LD      HL,$3529            
0528: 06 00           LD      B,$00               
052A: 09              ADD     HL,BC               
052B: A7              AND     A                   
052C: 06 03           LD      B,$03               

loc_052e:
052E: 1A              LD      A,(DE)              
052F: 8E              ADC     A,(HL)              
0530: 27              DAA                         
0531: 12              LD      (DE),A              
0532: 13              INC     DE                  
0533: 23              INC     HL                  
0534: 10 F8           DJNZ    $052E               ; {code.loc_052e}
0536: D5              PUSH    DE                  
0537: 1B              DEC     DE                  
0538: 3A 0D 60        LD      A,($600D)           ; {ram.currentPlayer}
053B: CD 6B 05        CALL    $056B               ; {code.loc_056b}
053E: D1              POP     DE                  
053F: 1B              DEC     DE                  
0540: 21 BA 60        LD      HL,$60BA            
0543: 06 03           LD      B,$03               

loc_0545:
0545: 1A              LD      A,(DE)              
0546: BE              CP      (HL)                
0547: D8              RET     C                   
0548: C2 50 05        JP      NZ,$0550            ; {code.loc_0550}
054B: 1B              DEC     DE                  
054C: 2B              DEC     HL                  
054D: 10 F6           DJNZ    $0545               ; {code.loc_0545}
054F: C9              RET                         

loc_0550:
0550: CD 5F 05        CALL    $055F               ; {code.selectCurrentPlayerScoreCounter}
0553: 21 B8 60        LD      HL,$60B8            

loc_0556:
0556: 1A              LD      A,(DE)              
0557: 77              LD      (HL),A              
0558: 13              INC     DE                  
0559: 23              INC     HL                  
055A: 10 FA           DJNZ    $0556               ; {code.loc_0556}
055C: C3 DA 05        JP      $05DA               ; {code.drawHighScore}

selectCurrentPlayerScoreCounter:
055F: 11 B2 60        LD      DE,$60B2            
0562: 3A 0D 60        LD      A,($600D)           ; {ram.currentPlayer}
0565: A7              AND     A                   
0566: C8              RET     Z                   
0567: 11 B5 60        LD      DE,$60B5            
056A: C9              RET                         

loc_056b:
056B: DD 21 81 77     LD      IX,$7781            
056F: A7              AND     A                   
0570: 28 0A           JR      Z,$057C             ; {code.renderBcdColumn}
0572: DD 21 21 75     LD      IX,$7521            
0576: 18 04           JR      $057C               ; {code.renderBcdColumn}

renderBcdColumnFixedCell:
0578: DD 21 41 76     LD      IX,$7641            

renderBcdColumn:
057C: EB              EX      DE,HL               
057D: 11 E0 FF        LD      DE,$FFE0            
0580: 01 04 03        LD      BC,$0304            

expandBcdDigits:
0583: 7E              LD      A,(HL)              
0584: 0F              RRCA                        
0585: 0F              RRCA                        
0586: 0F              RRCA                        
0587: 0F              RRCA                        
0588: CD 93 05        CALL    $0593               ; {code.storeDigitAndAdvance}
058B: 7E              LD      A,(HL)              
058C: CD 93 05        CALL    $0593               ; {code.storeDigitAndAdvance}
058F: 2B              DEC     HL                  
0590: 10 F1           DJNZ    $0583               ; {code.expandBcdDigits}
0592: C9              RET                         

storeDigitAndAdvance:
0593: E6 0F           AND     $0F                 
0595: DD 77 00        LD      (IX+$00),A          
0598: DD 19           ADD     IX,DE               
059A: C9              RET                         

resetScoreCounter:
059B: FE 03           CP      $03                 
059D: D2 BD 05        JP      NC,$05BD            ; {code.loc_05bd}
05A0: F5              PUSH    AF                  
05A1: 21 B2 60        LD      HL,$60B2            
05A4: A7              AND     A                   
05A5: CA AB 05        JP      Z,$05AB             ; {code.loc_05ab}
05A8: 21 B5 60        LD      HL,$60B5            

loc_05ab:
05AB: FE 02           CP      $02                 
05AD: C2 B3 05        JP      NZ,$05B3            ; {code.loc_05b3}
05B0: 21 B8 60        LD      HL,$60B8            

loc_05b3:
05B3: AF              XOR     A                   
05B4: 77              LD      (HL),A              
05B5: 23              INC     HL                  
05B6: 77              LD      (HL),A              
05B7: 23              INC     HL                  
05B8: 77              LD      (HL),A              
05B9: F1              POP     AF                  
05BA: C3 C6 05        JP      $05C6               ; {code.drawScoreTask}

loc_05bd:
05BD: 3D              DEC     A                   
05BE: F5              PUSH    AF                  
05BF: CD 9B 05        CALL    $059B               ; {code.resetScoreCounter}
05C2: F1              POP     AF                  
05C3: C8              RET     Z                   
05C4: 18 F7           JR      $05BD               ; {code.loc_05bd}

drawScoreTask:
05C6: FE 03           CP      $03                 
05C8: CA E0 05        JP      Z,$05E0             ; {code.loc_05e0}
05CB: 11 B4 60        LD      DE,$60B4            
05CE: A7              AND     A                   
05CF: CA D5 05        JP      Z,$05D5             ; {code.loc_05d5}
05D2: 11 B7 60        LD      DE,$60B7            

loc_05d5:
05D5: FE 02           CP      $02                 
05D7: C2 6B 05        JP      NZ,$056B            ; {code.loc_056b}

drawHighScore:
05DA: 11 BA 60        LD      DE,$60BA            
05DD: C3 78 05        JP      $0578               ; {code.renderBcdColumnFixedCell}

loc_05e0:
05E0: 3D              DEC     A                   
05E1: F5              PUSH    AF                  
05E2: CD C6 05        CALL    $05C6               ; {code.drawScoreTask}
05E5: F1              POP     AF                  
05E6: C8              RET     Z                   
05E7: 18 F7           JR      $05E0               ; {code.loc_05e0}

drawStringVertical:
05E9: 21 4B 36        LD      HL,$364B            
05EC: 87              ADD     A,A                 
05ED: F5              PUSH    AF                  
05EE: E6 7F           AND     $7F                 
05F0: 5F              LD      E,A                 
05F1: 16 00           LD      D,$00               
05F3: 19              ADD     HL,DE               
05F4: 5E              LD      E,(HL)              
05F5: 23              INC     HL                  
05F6: 56              LD      D,(HL)              
05F7: EB              EX      DE,HL               
05F8: 5E              LD      E,(HL)              
05F9: 23              INC     HL                  
05FA: 56              LD      D,(HL)              
05FB: 23              INC     HL                  
05FC: 01 E0 FF        LD      BC,$FFE0            
05FF: EB              EX      DE,HL               

loc_0600:
0600: 1A              LD      A,(DE)              
0601: FE 3F           CP      $3F                 
0603: CA 26 00        JP      Z,$0026             ; {code.loc_0026}
0606: 77              LD      (HL),A              
0607: F1              POP     AF                  
0608: 30 02           JR      NC,$060C            ; {code.loc_060c}
060A: 36 10           LD      (HL),$10            

loc_060c:
060C: F5              PUSH    AF                  
060D: 13              INC     DE                  
060E: 09              ADD     HL,BC               
060F: 18 EF           JR      $0600               ; {code.loc_0600}

drawCreditLineInAttract:
0611: 3A 07 60        LD      A,($6007)           ; {ram.attract}
0614: 0F              RRCA                        
0615: D0              RET     NC                  

drawCreditDisplay:
0616: 3E 05           LD      A,$05               
0618: CD E9 05        CALL    $05E9               ; {code.drawStringVertical}
061B: 21 01 60        LD      HL,$6001            
061E: 11 E0 FF        LD      DE,$FFE0            
0621: DD 21 BF 74     LD      IX,$74BF            
0625: 06 01           LD      B,$01               
0627: C3 83 05        JP      $0583               ; {code.expandBcdDigits}

loc_062a:
062A: A7              AND     A                   
062B: CA 91 06        JP      Z,$0691             ; {code.awardRemainingBonusToScore}
062E: 3A 8C 63        LD      A,($638C)           ; {ram.bonusDisplay}
0631: A7              AND     A                   
0632: C2 A8 06        JP      NZ,$06A8            ; {code.stepBonusDisplayDown}
0635: 3A B8 63        LD      A,($63B8)           ; {ram.bonusDisplayZeroed}
0638: A7              AND     A                   
0639: C0              RET     NZ                  
063A: 3A B0 62        LD      A,($62B0)           ; {ram.bonusStart}
063D: 01 0A 00        LD      BC,$000A            

loc_0640:
0640: 04              INC     B                   
0641: 91              SUB     C                   
0642: C2 40 06        JP      NZ,$0640            ; {code.loc_0640}
0645: 78              LD      A,B                 
0646: 07              RLCA                        
0647: 07              RLCA                        
0648: 07              RLCA                        
0649: 07              RLCA                        
064A: 32 8C 63        LD      ($638C),A           ; {ram.bonusDisplay}
064D: 21 4A 38        LD      HL,$384A            
0650: 11 65 74        LD      DE,$7465            
0653: 3E 06           LD      A,$06               

loc_0655:
0655: DD 21 1D 00     LD      IX,$001D            
0659: 01 03 00        LD      BC,$0003            
065C: ED B0           LDIR                        
065E: DD 19           ADD     IX,DE               
0660: DD E5           PUSH    IX                  
0662: D1              POP     DE                  
0663: 3D              DEC     A                   
0664: C2 55 06        JP      NZ,$0655            ; {code.loc_0655}
0667: 3A 8C 63        LD      A,($638C)           ; {ram.bonusDisplay}

renderBonusDisplay:
066A: 4F              LD      C,A                 
066B: E6 0F           AND     $0F                 
066D: 47              LD      B,A                 
066E: 79              LD      A,C                 
066F: 0F              RRCA                        
0670: 0F              RRCA                        
0671: 0F              RRCA                        
0672: 0F              RRCA                        
0673: E6 0F           AND     $0F                 
0675: C2 89 06        JP      NZ,$0689            ; {code.stampTwoDigitField}
0678: 3E 03           LD      A,$03               
067A: 32 89 60        LD      ($6089),A           ; {ram.sndBgm}
067D: 3E 70           LD      A,$70               
067F: 32 86 74        LD      ($7486),A           ; {hard.videoRam+86}
0682: 32 A6 74        LD      ($74A6),A           ; {hard.videoRam+A6}
0685: 80              ADD     A,B                 
0686: 47              LD      B,A                 
0687: 3E 10           LD      A,$10               

stampTwoDigitField:
0689: 32 E6 74        LD      ($74E6),A           ; {hard.videoRam+E6}
068C: 78              LD      A,B                 
068D: 32 C6 74        LD      ($74C6),A           ; {hard.videoRam+C6}
0690: C9              RET                         

awardRemainingBonusToScore:
0691: 3A 8C 63        LD      A,($638C)           ; {ram.bonusDisplay}
0694: 47              LD      B,A                 
0695: E6 0F           AND     $0F                 
0697: C5              PUSH    BC                  
0698: CD 1C 05        CALL    $051C               ; {code.addToScoreTask}
069B: C1              POP     BC                  
069C: 78              LD      A,B                 
069D: 0F              RRCA                        
069E: 0F              RRCA                        
069F: 0F              RRCA                        
06A0: 0F              RRCA                        
06A1: E6 0F           AND     $0F                 
06A3: C6 0A           ADD     A,$0A               
06A5: C3 1C 05        JP      $051C               ; {code.addToScoreTask}

stepBonusDisplayDown:
06A8: D6 01           SUB     $01                 
06AA: 20 05           JR      NZ,$06B1            ; {code.loc_06b1}
06AC: 21 B8 63        LD      HL,$63B8            
06AF: 36 01           LD      (HL),$01            

loc_06b1:
06B1: 27              DAA                         
06B2: 32 8C 63        LD      ($638C),A           ; {ram.bonusDisplay}
06B5: C3 6A 06        JP      $066A               ; {code.renderBonusDisplay}

drawLivesAndLevel:
06B8: 4F              LD      C,A                 
06B9: CF              RST     $08                 
06BA: 06 06           LD      B,$06               
06BC: 11 E0 FF        LD      DE,$FFE0            
06BF: 21 83 77        LD      HL,$7783            

loc_06c2:
06C2: 36 10           LD      (HL),$10            
06C4: 19              ADD     HL,DE               
06C5: 10 FB           DJNZ    $06C2               ; {code.loc_06c2}
06C7: 3A 28 62        LD      A,($6228)           ; {ram.lives}
06CA: 91              SUB     C                   
06CB: CA D7 06        JP      Z,$06D7             ; {code.loc_06d7}
06CE: 47              LD      B,A                 
06CF: 21 83 77        LD      HL,$7783            

loc_06d2:
06D2: 36 FF           LD      (HL),$FF            
06D4: 19              ADD     HL,DE               
06D5: 10 FB           DJNZ    $06D2               ; {code.loc_06d2}

loc_06d7:
06D7: 21 03 75        LD      HL,$7503            
06DA: 36 1C           LD      (HL),$1C            
06DC: 21 E3 74        LD      HL,$74E3            
06DF: 36 34           LD      (HL),$34            
06E1: 3A 29 62        LD      A,($6229)           ; {ram.level}
06E4: FE 64           CP      $64                 
06E6: 38 05           JR      C,$06ED             ; {code.loc_06ed}
06E8: 3E 63           LD      A,$63               
06EA: 32 29 62        LD      ($6229),A           ; {ram.level}

loc_06ed:
06ED: 01 0A FF        LD      BC,$FF0A            

loc_06f0:
06F0: 04              INC     B                   
06F1: 91              SUB     C                   
06F2: D2 F0 06        JP      NC,$06F0            ; {code.loc_06f0}
06F5: 81              ADD     A,C                 
06F6: 32 A3 74        LD      ($74A3),A           ; {hard.videoRam+A3}
06F9: 78              LD      A,B                 
06FA: 32 C3 74        LD      ($74C3),A           ; {hard.videoRam+C3}
06FD: C9              RET                         

dispatchInGameSubstate:
06FE: 3A 0A 60        LD      A,($600A)           ; {ram.gameSubstate}
0701: EF              RST     $28                 

; ---- $0702-$073B: jump table ----
0702: 86 09 AB 09 D6 09 FE 09 1B 0A 37 0A 63 0A 76 0A
0712: DA 0B 00 00 91 0C 3C 12 7A 19 7C 12 F2 12 44 13
0722: 8F 13 A1 13 AA 13 BB 13 1E 14 86 14 15 16 6B 19
0732: 00 00 00 00 00 00 00 00 00 00

runAttractState:
073C: 21 0A 60        LD      HL,$600A            
073F: 3A 01 60        LD      A,($6001)           ; {ram.credits}
0742: A7              AND     A                   
0743: C2 5C 07        JP      NZ,$075C            ; {code.loc_075c}
0746: 7E              LD      A,(HL)              
0747: EF              RST     $28                 

; ---- $0748-$075B: jump table ----
0748: 79 07 63 07 3C 12 77 19 7C 12 C3 07 CB 07 4B 08
0758: 00 00 00 00

loc_075c:
075C: 36 00           LD      (HL),$00            
075E: 21 05 60        LD      HL,$6005            
0761: 34              INC     (HL)                
0762: C9              RET                         

restartAttractDemoAt25m:
0763: E7              RST     $20                 
0764: AF              XOR     A                   
0765: 32 92 63        LD      ($6392),A           ; {hard.workRam+392}
0768: 32 A0 63        LD      ($63A0),A           ; {ram.eventReq313c}
076B: 3E 01           LD      A,$01               
076D: 32 27 62        LD      ($6227),A           ; {ram.board}
0770: 32 29 62        LD      ($6229),A           ; {ram.level}
0773: 32 28 62        LD      ($6228),A           ; {ram.lives}
0776: C3 92 0C        JP      $0C92               ; {code.buildBoard}

composeAttractTitleScreen:
0779: 21 86 7D        LD      HL,$7D86            
077C: 36 00           LD      (HL),$00            
077E: 23              INC     HL                  
077F: 36 00           LD      (HL),$00            
0781: 11 1B 03        LD      DE,$031B            
0784: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0787: 1C              INC     E                   
0788: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
078B: CD 65 09        CALL    $0965               ; {code.enqueueTaskBatch}
078E: 21 09 60        LD      HL,$6009            
0791: 36 02           LD      (HL),$02            
0793: 23              INC     HL                  
0794: 34              INC     (HL)                
0795: CD 74 08        CALL    $0874               ; {code.clearPlayfieldAndSprites}
0798: CD 53 0A        CALL    $0A53               ; {code.draw1UpLabel}
079B: 3A 0F 60        LD      A,($600F)           ; {ram.twoPlayerGame}
079E: FE 01           CP      $01                 
07A0: CC EE 09        CALL    Z,$09EE             ; {code.draw2UpLabel}
07A3: ED 5B 22 60     LD      DE,($6022)          ; {ram.dipCoinsFor1P}
07A7: 21 6C 75        LD      HL,$756C            
07AA: CD AD 07        CALL    $07AD               ; {code.writeDigitPairWithCarry}

writeDigitPairWithCarry:
07AD: 73              LD      (HL),E              
07AE: 23              INC     HL                  
07AF: 23              INC     HL                  
07B0: 72              LD      (HL),D              
07B1: 7A              LD      A,D                 
07B2: D6 0A           SUB     $0A                 
07B4: C2 BC 07        JP      NZ,$07BC            ; {code.loc_07bc}
07B7: 77              LD      (HL),A              
07B8: 3C              INC     A                   
07B9: 32 8E 75        LD      ($758E),A           ; {hard.videoRam+18E}

loc_07bc:
07BC: 11 01 02        LD      DE,$0201            
07BF: 21 8C 76        LD      HL,$768C            
07C2: C9              RET                         

clearScreenAndAdvanceSubstate:
07C3: CD 74 08        CALL    $0874               ; {code.clearPlayfieldAndSprites}
07C6: 21 0A 60        LD      HL,$600A            
07C9: 34              INC     (HL)                
07CA: C9              RET                         

loc_07cb:
07CB: 3A 8A 63        LD      A,($638A)           ; {hard.workRam+38A}
07CE: FE 00           CP      $00                 
07D0: C2 2D 08        JP      NZ,$082D            ; {code.loc_082d}
07D3: 3E 60           LD      A,$60               
07D5: 32 8A 63        LD      ($638A),A           ; {hard.workRam+38A}
07D8: 0E 5F           LD      C,$5F               

loc_07da:
07DA: FE 00           CP      $00                 
07DC: CA 3B 08        JP      Z,$083B             ; {code.loc_083b}
07DF: 21 86 7D        LD      HL,$7D86            
07E2: 36 00           LD      (HL),$00            
07E4: 79              LD      A,C                 
07E5: CB 07           RLC     A                   
07E7: 30 02           JR      NC,$07EB            ; {code.loc_07eb}
07E9: 36 01           LD      (HL),$01            

loc_07eb:
07EB: 23              INC     HL                  
07EC: 36 00           LD      (HL),$00            
07EE: CB 07           RLC     A                   
07F0: 30 02           JR      NC,$07F4            ; {code.loc_07f4}
07F2: 36 01           LD      (HL),$01            

loc_07f4:
07F4: 32 8B 63        LD      ($638B),A           ; {hard.workRam+38B}
07F7: 21 08 3D        LD      HL,$3D08            

loc_07fa:
07FA: 3E B0           LD      A,$B0               
07FC: 46              LD      B,(HL)              
07FD: 23              INC     HL                  
07FE: 5E              LD      E,(HL)              
07FF: 23              INC     HL                  
0800: 56              LD      D,(HL)              

loc_0801:
0801: 12              LD      (DE),A              
0802: 13              INC     DE                  
0803: 10 FC           DJNZ    $0801               ; {code.loc_0801}
0805: 23              INC     HL                  
0806: 7E              LD      A,(HL)              
0807: FE 00           CP      $00                 
0809: C2 FA 07        JP      NZ,$07FA            ; {code.loc_07fa}
080C: 11 1E 03        LD      DE,$031E            
080F: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0812: 13              INC     DE                  
0813: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0816: 21 CF 39        LD      HL,$39CF            
0819: CD 4E 00        CALL    $004E               ; {code.loadSpriteObjectBlock}
081C: CD 24 3F        CALL    $3F24               ; {code.stampFixedTilePair}
081F: 00              NOP                         
0820: 21 08 69        LD      HL,$6908            
0823: 0E 44           LD      C,$44               
0825: FF              RST     $38                 
0826: 21 0B 69        LD      HL,$690B            
0829: 0E 78           LD      C,$78               
082B: FF              RST     $38                 
082C: C9              RET                         

loc_082d:
082D: 3A 8B 63        LD      A,($638B)           ; {hard.workRam+38B}
0830: 4F              LD      C,A                 
0831: 3A 8A 63        LD      A,($638A)           ; {hard.workRam+38A}
0834: 3D              DEC     A                   
0835: 32 8A 63        LD      ($638A),A           ; {hard.workRam+38A}
0838: C3 DA 07        JP      $07DA               ; {code.loc_07da}

loc_083b:
083B: 21 09 60        LD      HL,$6009            
083E: 36 02           LD      (HL),$02            
0840: 23              INC     HL                  
0841: 34              INC     (HL)                
0842: 21 8A 63        LD      HL,$638A            
0845: 36 00           LD      (HL),$00            
0847: 23              INC     HL                  
0848: 36 00           LD      (HL),$00            
084A: C9              RET                         

clearSubstateWhenTimerExpires:
084B: E7              RST     $20                 
084C: 21 0A 60        LD      HL,$600A            
084F: 36 00           LD      (HL),$00            
0851: C9              RET                         

clearTilemapAndSprites:
0852: 21 00 74        LD      HL,$7400            
0855: 0E 04           LD      C,$04               

loc_0857:
0857: 06 00           LD      B,$00               
0859: 3E 10           LD      A,$10               

loc_085b:
085B: 77              LD      (HL),A              
085C: 23              INC     HL                  
085D: 10 FC           DJNZ    $085B               ; {code.loc_085b}
085F: 0D              DEC     C                   
0860: C2 57 08        JP      NZ,$0857            ; {code.loc_0857}
0863: 21 00 69        LD      HL,$6900            
0866: 0E 02           LD      C,$02               

loc_0868:
0868: 06 C0           LD      B,$C0               
086A: AF              XOR     A                   

loc_086b:
086B: 77              LD      (HL),A              
086C: 23              INC     HL                  
086D: 10 FC           DJNZ    $086B               ; {code.loc_086b}
086F: 0D              DEC     C                   
0870: C2 68 08        JP      NZ,$0868            ; {code.loc_0868}
0873: C9              RET                         

clearPlayfieldAndSprites:
0874: 21 04 74        LD      HL,$7404            
0877: 0E 20           LD      C,$20               

loc_0879:
0879: 06 1C           LD      B,$1C               
087B: 3E 10           LD      A,$10               
087D: 11 04 00        LD      DE,$0004            

loc_0880:
0880: 77              LD      (HL),A              
0881: 23              INC     HL                  
0882: 10 FC           DJNZ    $0880               ; {code.loc_0880}
0884: 19              ADD     HL,DE               
0885: 0D              DEC     C                   
0886: C2 79 08        JP      NZ,$0879            ; {code.loc_0879}
0889: 21 22 75        LD      HL,$7522            
088C: 11 20 00        LD      DE,$0020            
088F: 0E 02           LD      C,$02               
0891: 3E 10           LD      A,$10               

loc_0893:
0893: 06 0E           LD      B,$0E               

loc_0895:
0895: 77              LD      (HL),A              
0896: 19              ADD     HL,DE               
0897: 10 FC           DJNZ    $0895               ; {code.loc_0895}
0899: 21 23 75        LD      HL,$7523            
089C: 0D              DEC     C                   
089D: C2 93 08        JP      NZ,$0893            ; {code.loc_0893}
08A0: 21 00 69        LD      HL,$6900            
08A3: 06 00           LD      B,$00               
08A5: 3E 00           LD      A,$00               

loc_08a7:
08A7: 77              LD      (HL),A              
08A8: 23              INC     HL                  
08A9: 10 FC           DJNZ    $08A7               ; {code.loc_08a7}
08AB: 06 80           LD      B,$80               

loc_08ad:
08AD: 77              LD      (HL),A              
08AE: 23              INC     HL                  
08AF: 10 FC           DJNZ    $08AD               ; {code.loc_08ad}
08B1: C9              RET                         

dispatchCreditedSubstate:
08B2: 3A 0A 60        LD      A,($600A)           ; {ram.gameSubstate}
08B5: EF              RST     $28                 

; ---- $08B6-$08B9: jump table ----
08B6: BA 08 F8 08

enterCreditScreen:
08BA: CD 74 08        CALL    $0874               ; {code.clearPlayfieldAndSprites}
08BD: AF              XOR     A                   
08BE: 32 07 60        LD      ($6007),A           ; {ram.attract}
08C1: 11 0C 03        LD      DE,$030C            
08C4: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
08C7: 21 0A 60        LD      HL,$600A            
08CA: 34              INC     (HL)                
08CB: CD 65 09        CALL    $0965               ; {code.enqueueTaskBatch}
08CE: AF              XOR     A                   
08CF: 21 86 7D        LD      HL,$7D86            
08D2: 77              LD      (HL),A              
08D3: 2C              INC     L                   
08D4: 77              LD      (HL),A              

readStartButtonSelector:
08D5: 06 04           LD      B,$04               
08D7: 1E 09           LD      E,$09               
08D9: 3A 01 60        LD      A,($6001)           ; {ram.credits}
08DC: FE 01           CP      $01                 
08DE: CA E4 08        JP      Z,$08E4             ; {code.loc_08e4}
08E1: 06 0C           LD      B,$0C               
08E3: 1C              INC     E                   

loc_08e4:
08E4: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
08E7: E6 07           AND     $07                 
08E9: C2 F3 08        JP      NZ,$08F3            ; {code.loc_08f3}
08EC: 7B              LD      A,E                 
08ED: CD E9 05        CALL    $05E9               ; {code.drawStringVertical}
08F0: CD 16 06        CALL    $0616               ; {code.drawCreditDisplay}

loc_08f3:
08F3: 3A 00 7D        LD      A,($7D00)           ; {hard.in2}
08F6: A0              AND     B                   
08F7: C9              RET                         

commitGameStart:
08F8: CD D5 08        CALL    $08D5               ; {code.readStartButtonSelector}
08FB: FE 04           CP      $04                 
08FD: CA 06 09        JP      Z,$0906             ; {code.loc_0906}
0900: FE 08           CP      $08                 
0902: CA 19 09        JP      Z,$0919             ; {code.loc_0919}
0905: C9              RET                         

loc_0906:
0906: CD 77 09        CALL    $0977               ; {code.spendCredit}
0909: 21 48 60        LD      HL,$6048            
090C: 06 08           LD      B,$08               
090E: AF              XOR     A                   

loc_090f:
090F: 77              LD      (HL),A              
0910: 2C              INC     L                   
0911: 10 FC           DJNZ    $090F               ; {code.loc_090f}
0913: 21 00 00        LD      HL,$0000            
0916: C3 38 09        JP      $0938               ; {code.loc_0938}

loc_0919:
0919: CD 77 09        CALL    $0977               ; {code.spendCredit}
091C: CD 77 09        CALL    $0977               ; {code.spendCredit}
091F: 11 48 60        LD      DE,$6048            
0922: 3A 20 60        LD      A,($6020)           ; {ram.dipLives}
0925: 12              LD      (DE),A              
0926: 1C              INC     E                   
0927: 21 5E 09        LD      HL,$095E            
092A: 01 07 00        LD      BC,$0007            
092D: ED B0           LDIR                        
092F: 11 01 01        LD      DE,$0101            
0932: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0935: 21 00 01        LD      HL,$0100            

loc_0938:
0938: 22 0E 60        LD      ($600E),HL          ; {ram.activePlayerIndex}
093B: CD 74 08        CALL    $0874               ; {code.clearPlayfieldAndSprites}
093E: 11 40 60        LD      DE,$6040            
0941: 3A 20 60        LD      A,($6020)           ; {ram.dipLives}
0944: 12              LD      (DE),A              
0945: 1C              INC     E                   
0946: 21 5E 09        LD      HL,$095E            
0949: 01 07 00        LD      BC,$0007            
094C: ED B0           LDIR                        
094E: 11 00 01        LD      DE,$0100            
0951: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0954: AF              XOR     A                   
0955: 32 0A 60        LD      ($600A),A           ; {ram.gameSubstate}
0958: 3E 03           LD      A,$03               
095A: 32 05 60        LD      ($6005),A           ; {ram.gameState}
095D: C9              RET                         

; ---- $095E-$0964: data ----
095E: 01 65 3A 01 00 00 00

enqueueTaskBatch:
0965: 11 00 04        LD      DE,$0400            
0968: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
096B: 11 14 03        LD      DE,$0314            
096E: 06 06           LD      B,$06               

loc_0970:
0970: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0973: 1C              INC     E                   
0974: 10 FA           DJNZ    $0970               ; {code.loc_0970}
0976: C9              RET                         

spendCredit:
0977: 21 01 60        LD      HL,$6001            
097A: 3E 99           LD      A,$99               
097C: 86              ADD     A,(HL)              
097D: 27              DAA                         
097E: 77              LD      (HL),A              
097F: 11 00 04        LD      DE,$0400            
0982: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0985: C9              RET                         

configureFlipScreenAndSelectSubstate:
0986: CD 52 08        CALL    $0852               ; {code.clearTilemapAndSprites}
0989: CD 1C 01        CALL    $011C               ; {code.silenceSound}
098C: 11 82 7D        LD      DE,$7D82            
098F: 3E 01           LD      A,$01               
0991: 12              LD      (DE),A              
0992: 21 0A 60        LD      HL,$600A            
0995: 3A 0E 60        LD      A,($600E)           ; {ram.activePlayerIndex}
0998: A7              AND     A                   
0999: C2 9F 09        JP      NZ,$099F            ; {code.loc_099f}
099C: 36 01           LD      (HL),$01            
099E: C9              RET                         

loc_099f:
099F: 3A 26 60        LD      A,($6026)           ; {ram.dipUpright}
09A2: 3D              DEC     A                   
09A3: CA A8 09        JP      Z,$09A8             ; {code.loc_09a8}
09A6: AF              XOR     A                   
09A7: 12              LD      (DE),A              

loc_09a8:
09A8: 36 03           LD      (HL),$03            
09AA: C9              RET                         

restorePlayer1Context:
09AB: 21 40 60        LD      HL,$6040            
09AE: 11 28 62        LD      DE,$6228            
09B1: 01 08 00        LD      BC,$0008            
09B4: ED B0           LDIR                        
09B6: 2A 2A 62        LD      HL,($622A)          ; {ram.boardSeqPtr}
09B9: 7E              LD      A,(HL)              
09BA: 32 27 62        LD      ($6227),A           ; {ram.board}
09BD: 3A 0F 60        LD      A,($600F)           ; {ram.twoPlayerGame}
09C0: A7              AND     A                   
09C1: 21 09 60        LD      HL,$6009            
09C4: 11 0A 60        LD      DE,$600A            
09C7: CA D0 09        JP      Z,$09D0             ; {code.loc_09d0}
09CA: 36 78           LD      (HL),$78            
09CC: EB              EX      DE,HL               
09CD: 36 02           LD      (HL),$02            
09CF: C9              RET                         

loc_09d0:
09D0: 36 01           LD      (HL),$01            
09D2: EB              EX      DE,HL               
09D3: 36 05           LD      (HL),$05            
09D5: C9              RET                         

armTwoPlayerBoardSetup:
09D6: AF              XOR     A                   
09D7: 32 86 7D        LD      ($7D86),A           ; {hard.paletteBank0}
09DA: 32 87 7D        LD      ($7D87),A           ; {hard.paletteBank1}
09DD: 11 02 03        LD      DE,$0302            
09E0: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
09E3: 11 01 02        LD      DE,$0201            
09E6: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
09E9: 3E 05           LD      A,$05               
09EB: 32 0A 60        LD      ($600A),A           ; {ram.gameSubstate}

draw2UpLabel:
09EE: 3E 02           LD      A,$02               
09F0: 32 E0 74        LD      ($74E0),A           ; {hard.videoRam+E0}
09F3: 3E 25           LD      A,$25               
09F5: 32 C0 74        LD      ($74C0),A           ; {hard.videoRam+C0}
09F8: 3E 20           LD      A,$20               
09FA: 32 A0 74        LD      ($74A0),A           ; {hard.videoRam+A0}
09FD: C9              RET                         

restorePlayer2Context:
09FE: 21 48 60        LD      HL,$6048            
0A01: 11 28 62        LD      DE,$6228            
0A04: 01 08 00        LD      BC,$0008            
0A07: ED B0           LDIR                        
0A09: 2A 2A 62        LD      HL,($622A)          ; {ram.boardSeqPtr}
0A0C: 7E              LD      A,(HL)              
0A0D: 32 27 62        LD      ($6227),A           ; {ram.board}
0A10: 3E 78           LD      A,$78               
0A12: 32 09 60        LD      ($6009),A           ; {ram.substateTimer}
0A15: 3E 04           LD      A,$04               
0A17: 32 0A 60        LD      ($600A),A           ; {ram.gameSubstate}
0A1A: C9              RET                         

loc_0a1b:
0A1B: AF              XOR     A                   
0A1C: 32 86 7D        LD      ($7D86),A           ; {hard.paletteBank0}
0A1F: 32 87 7D        LD      ($7D87),A           ; {hard.paletteBank1}
0A22: 11 03 03        LD      DE,$0303            
0A25: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0A28: 11 01 02        LD      DE,$0201            
0A2B: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0A2E: CD EE 09        CALL    $09EE               ; {code.draw2UpLabel}
0A31: 3E 05           LD      A,$05               
0A33: 32 0A 60        LD      ($600A),A           ; {ram.gameSubstate}
0A36: C9              RET                         

composeScreenAndAdvanceSubstate:
0A37: 11 04 03        LD      DE,$0304            
0A3A: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0A3D: 11 02 02        LD      DE,$0202            
0A40: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0A43: 11 00 02        LD      DE,$0200            
0A46: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0A49: 11 00 06        LD      DE,$0600            
0A4C: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0A4F: 21 0A 60        LD      HL,$600A            
0A52: 34              INC     (HL)                

draw1UpLabel:
0A53: 3E 01           LD      A,$01               
0A55: 32 40 77        LD      ($7740),A           ; {hard.videoRam+340}
0A58: 3E 25           LD      A,$25               
0A5A: 32 20 77        LD      ($7720),A           ; {hard.videoRam+320}
0A5D: 3E 20           LD      A,$20               
0A5F: 32 00 77        LD      ($7700),A           ; {hard.videoRam+300}
0A62: C9              RET                         

clearScreenAndSelectIntro:
0A63: DF              RST     $18                 
0A64: CD 74 08        CALL    $0874               ; {code.clearPlayfieldAndSprites}
0A67: 21 09 60        LD      HL,$6009            
0A6A: 36 01           LD      (HL),$01            
0A6C: 2C              INC     L                   
0A6D: 34              INC     (HL)                
0A6E: 11 2C 62        LD      DE,$622C            
0A71: 1A              LD      A,(DE)              
0A72: A7              AND     A                   
0A73: C0              RET     NZ                  
0A74: 34              INC     (HL)                
0A75: C9              RET                         

dispatchIntroCutsceneStep:
0A76: 3A 85 63        LD      A,($6385)           ; {ram.introStep}
0A79: EF              RST     $28                 

; ---- $0A7A-$0A89: jump table ----
0A7A: 8A 0A BF 0A E8 0A 69 30 06 0B 69 30 68 0B B3 0B

setupIntroCutsceneStep:
0A8A: AF              XOR     A                   
0A8B: 32 86 7D        LD      ($7D86),A           ; {hard.paletteBank0}
0A8E: 3C              INC     A                   
0A8F: 32 87 7D        LD      ($7D87),A           ; {hard.paletteBank1}
0A92: 11 0D 38        LD      DE,$380D            
0A95: CD A7 0D        CALL    $0DA7               ; {code.drawBoardLayout}
0A98: 3E 10           LD      A,$10               
0A9A: 32 A3 76        LD      ($76A3),A           ; {hard.videoRam+2A3}
0A9D: 32 63 76        LD      ($7663),A           ; {hard.videoRam+263}
0AA0: 3E D4           LD      A,$D4               
0AA2: 32 AA 75        LD      ($75AA),A           ; {hard.videoRam+1AA}
0AA5: AF              XOR     A                   
0AA6: 32 AF 62        LD      ($62AF),A           ; {hard.workRam+2AF}
0AA9: 21 B4 38        LD      HL,$38B4            
0AAC: 22 C2 63        LD      ($63C2),HL          ; {ram.introWalkPtrA}
0AAF: 21 CB 38        LD      HL,$38CB            
0AB2: 22 C4 63        LD      ($63C4),HL          ; {ram.introWalkPtrB}
0AB5: 3E 40           LD      A,$40               
0AB7: 32 09 60        LD      ($6009),A           ; {ram.substateTimer}
0ABA: 21 85 63        LD      HL,$6385            
0ABD: 34              INC     (HL)                
0ABE: C9              RET                         

runIntroClimbStep:
0ABF: DF              RST     $18                 
0AC0: 21 8C 38        LD      HL,$388C            
0AC3: CD 4E 00        CALL    $004E               ; {code.loadSpriteObjectBlock}
0AC6: 21 08 69        LD      HL,$6908            
0AC9: 0E 30           LD      C,$30               
0ACB: FF              RST     $38                 
0ACC: 21 0B 69        LD      HL,$690B            
0ACF: 0E 99           LD      C,$99               
0AD1: FF              RST     $38                 
0AD2: 3E 1F           LD      A,$1F               
0AD4: 32 8E 63        LD      ($638E),A           ; {ram.introScrollIndex}
0AD7: AF              XOR     A                   
0AD8: 32 0C 69        LD      ($690C),A           ; {hard.workRam+90C}
0ADB: 21 8A 60        LD      HL,$608A            
0ADE: 36 01           LD      (HL),$01            
0AE0: 23              INC     HL                  
0AE1: 36 03           LD      (HL),$03            
0AE3: 21 85 63        LD      HL,$6385            
0AE6: 34              INC     (HL)                
0AE7: C9              RET                         

animateIntroClimbStep:
0AE8: CD 6F 30        CALL    $306F               ; {code.animateSpriteObjectBlock}
0AEB: 3A AF 62        LD      A,($62AF)           ; {hard.workRam+2AF}
0AEE: E6 0F           AND     $0F                 
0AF0: CC 4A 30        CALL    Z,$304A             ; {code.scrollClimbGraphicStep}
0AF3: 3A 0B 69        LD      A,($690B)           ; {hard.workRam+90B}
0AF6: FE 5D           CP      $5D                 
0AF8: D0              RET     NC                  
0AF9: 3E 20           LD      A,$20               
0AFB: 32 09 60        LD      ($6009),A           ; {ram.substateTimer}
0AFE: 21 85 63        LD      HL,$6385            
0B01: 34              INC     (HL)                
0B02: 22 C0 63        LD      ($63C0),HL          ; {ram.seqAdvancePtr}
0B05: C9              RET                         

loc_0b06:
0B06: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
0B09: 0F              RRCA                        
0B0A: D8              RET     C                   
0B0B: 2A C2 63        LD      HL,($63C2)          ; {ram.introWalkPtrA}
0B0E: 7E              LD      A,(HL)              
0B0F: FE 7F           CP      $7F                 
0B11: CA 1E 0B        JP      Z,$0B1E             ; {code.loc_0b1e}
0B14: 23              INC     HL                  
0B15: 22 C2 63        LD      ($63C2),HL          ; {ram.introWalkPtrA}
0B18: 4F              LD      C,A                 
0B19: 21 0B 69        LD      HL,$690B            
0B1C: FF              RST     $38                 
0B1D: C9              RET                         

loc_0b1e:
0B1E: 21 5C 38        LD      HL,$385C            
0B21: CD 4E 00        CALL    $004E               ; {code.loadSpriteObjectBlock}
0B24: 11 00 69        LD      DE,$6900            
0B27: 01 08 00        LD      BC,$0008            
0B2A: ED B0           LDIR                        
0B2C: 21 08 69        LD      HL,$6908            
0B2F: 0E 50           LD      C,$50               
0B31: FF              RST     $38                 
0B32: 21 0B 69        LD      HL,$690B            
0B35: 0E FC           LD      C,$FC               
0B37: FF              RST     $38                 

loc_0b38:
0B38: CD 4A 30        CALL    $304A               ; {code.scrollClimbGraphicStep}
0B3B: 3A 8E 63        LD      A,($638E)           ; {ram.introScrollIndex}
0B3E: FE 0A           CP      $0A                 
0B40: C2 38 0B        JP      NZ,$0B38            ; {code.loc_0b38}
0B43: 3E 03           LD      A,$03               
0B45: 32 82 60        LD      ($6082),A           ; {hard.workRam+82}
0B48: 11 2C 39        LD      DE,$392C            
0B4B: CD A7 0D        CALL    $0DA7               ; {code.drawBoardLayout}
0B4E: 3E 10           LD      A,$10               
0B50: 32 AA 74        LD      ($74AA),A           ; {hard.videoRam+AA}
0B53: 32 8A 74        LD      ($748A),A           ; {hard.videoRam+8A}
0B56: 3E 05           LD      A,$05               
0B58: 32 8D 63        LD      ($638D),A           ; {ram.cutsceneBandCount}
0B5B: 3E 20           LD      A,$20               
0B5D: 32 09 60        LD      ($6009),A           ; {ram.substateTimer}
0B60: 21 85 63        LD      HL,$6385            
0B63: 34              INC     (HL)                
0B64: 22 C0 63        LD      ($63C0),HL          ; {ram.seqAdvancePtr}
0B67: C9              RET                         

loc_0b68:
0B68: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
0B6B: 0F              RRCA                        
0B6C: D8              RET     C                   
0B6D: 2A C4 63        LD      HL,($63C4)          ; {ram.introWalkPtrB}
0B70: 7E              LD      A,(HL)              
0B71: FE 7F           CP      $7F                 
0B73: CA 86 0B        JP      Z,$0B86             ; {code.loc_0b86}
0B76: 23              INC     HL                  
0B77: 22 C4 63        LD      ($63C4),HL          ; {ram.introWalkPtrB}
0B7A: 21 0B 69        LD      HL,$690B            
0B7D: 4F              LD      C,A                 
0B7E: FF              RST     $38                 
0B7F: 21 08 69        LD      HL,$6908            
0B82: 0E FF           LD      C,$FF               
0B84: FF              RST     $38                 
0B85: C9              RET                         

loc_0b86:
0B86: 21 CB 38        LD      HL,$38CB            
0B89: 22 C4 63        LD      ($63C4),HL          ; {ram.introWalkPtrB}
0B8C: 3E 03           LD      A,$03               
0B8E: 32 82 60        LD      ($6082),A           ; {hard.workRam+82}
0B91: 21 DC 38        LD      HL,$38DC            
0B94: 3A 8D 63        LD      A,($638D)           ; {ram.cutsceneBandCount}
0B97: 3D              DEC     A                   
0B98: 07              RLCA                        
0B99: 07              RLCA                        
0B9A: 07              RLCA                        
0B9B: 07              RLCA                        
0B9C: 5F              LD      E,A                 
0B9D: 16 00           LD      D,$00               
0B9F: 19              ADD     HL,DE               
0BA0: EB              EX      DE,HL               
0BA1: CD A7 0D        CALL    $0DA7               ; {code.drawBoardLayout}
0BA4: 21 8D 63        LD      HL,$638D            
0BA7: 35              DEC     (HL)                
0BA8: C0              RET     NZ                  
0BA9: 3E B0           LD      A,$B0               
0BAB: 32 09 60        LD      ($6009),A           ; {ram.substateTimer}
0BAE: 21 85 63        LD      HL,$6385            
0BB1: 34              INC     (HL)                
0BB2: C9              RET                         

runIntroRoarStep:
0BB3: 21 8A 60        LD      HL,$608A            
0BB6: 3A 09 60        LD      A,($6009)           ; {ram.substateTimer}
0BB9: FE 90           CP      $90                 
0BBB: 20 0B           JR      NZ,$0BC8            ; {code.loc_0bc8}
0BBD: 36 0F           LD      (HL),$0F            
0BBF: 23              INC     HL                  
0BC0: 36 03           LD      (HL),$03            
0BC2: 21 19 69        LD      HL,$6919            
0BC5: 34              INC     (HL)                
0BC6: 18 09           JR      $0BD1               ; {code.loc_0bd1}

loc_0bc8:
0BC8: FE 18           CP      $18                 
0BCA: 20 05           JR      NZ,$0BD1            ; {code.loc_0bd1}
0BCC: 21 19 69        LD      HL,$6919            
0BCF: 35              DEC     (HL)                
0BD0: 00              NOP                         

loc_0bd1:
0BD1: DF              RST     $18                 
0BD2: AF              XOR     A                   
0BD3: 32 85 63        LD      ($6385),A           ; {ram.introStep}
0BD6: 34              INC     (HL)                
0BD7: 23              INC     HL                  
0BD8: 34              INC     (HL)                
0BD9: C9              RET                         

buildHowHighScreen:
0BDA: CD 1C 01        CALL    $011C               ; {code.silenceSound}
0BDD: DF              RST     $18                 
0BDE: CD 74 08        CALL    $0874               ; {code.clearPlayfieldAndSprites}
0BE1: 16 06           LD      D,$06               
0BE3: 3A 00 62        LD      A,($6200)           ; {ram.marioActive}
0BE6: 5F              LD      E,A                 
0BE7: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0BEA: 21 86 7D        LD      HL,$7D86            
0BED: 36 01           LD      (HL),$01            
0BEF: 23              INC     HL                  
0BF0: 36 00           LD      (HL),$00            
0BF2: 21 8A 60        LD      HL,$608A            
0BF5: 36 02           LD      (HL),$02            
0BF7: 23              INC     HL                  
0BF8: 36 03           LD      (HL),$03            
0BFA: 21 A7 63        LD      HL,$63A7            
0BFD: 36 00           LD      (HL),$00            
0BFF: 21 DC 76        LD      HL,$76DC            
0C02: 22 A8 63        LD      ($63A8),HL          ; {hard.workRam+3A8}
0C05: 3A 2E 62        LD      A,($622E)           ; {ram.howHighIndex}
0C08: FE 06           CP      $06                 
0C0A: 38 05           JR      C,$0C11             ; {code.loc_0c11}
0C0C: 3E 05           LD      A,$05               
0C0E: 32 2E 62        LD      ($622E),A           ; {ram.howHighIndex}

loc_0c11:
0C11: 3A 2F 62        LD      A,($622F)           ; {ram.howHighLastSeq}
0C14: 47              LD      B,A                 
0C15: 3A 2A 62        LD      A,($622A)           ; {ram.boardSeqPtr}
0C18: B8              CP      B                   
0C19: 28 04           JR      Z,$0C1F             ; {code.loc_0c1f}
0C1B: 21 2E 62        LD      HL,$622E            
0C1E: 34              INC     (HL)                

loc_0c1f:
0C1F: 32 2F 62        LD      ($622F),A           ; {ram.howHighLastSeq}
0C22: 3A 2E 62        LD      A,($622E)           ; {ram.howHighIndex}
0C25: 47              LD      B,A                 
0C26: 21 BC 75        LD      HL,$75BC            

loc_0c29:
0C29: 0E 50           LD      C,$50               

loc_0c2b:
0C2B: 71              LD      (HL),C              
0C2C: 0C              INC     C                   
0C2D: 2B              DEC     HL                  
0C2E: 71              LD      (HL),C              
0C2F: 0C              INC     C                   
0C30: 2B              DEC     HL                  
0C31: 71              LD      (HL),C              
0C32: 0C              INC     C                   
0C33: 2B              DEC     HL                  
0C34: 71              LD      (HL),C              
0C35: 79              LD      A,C                 
0C36: FE 67           CP      $67                 
0C38: CA 43 0C        JP      Z,$0C43             ; {code.loc_0c43}
0C3B: 0C              INC     C                   
0C3C: 11 23 00        LD      DE,$0023            
0C3F: 19              ADD     HL,DE               
0C40: C3 2B 0C        JP      $0C2B               ; {code.loc_0c2b}

loc_0c43:
0C43: 3A A7 63        LD      A,($63A7)           ; {hard.workRam+3A7}
0C46: 3C              INC     A                   
0C47: 32 A7 63        LD      ($63A7),A           ; {hard.workRam+3A7}
0C4A: 3D              DEC     A                   
0C4B: CB 27           SLA     A                   
0C4D: CB 27           SLA     A                   
0C4F: E5              PUSH    HL                  
0C50: 21 F0 3C        LD      HL,$3CF0            
0C53: C5              PUSH    BC                  
0C54: DD 2A A8 63     LD      IX,($63A8)          ; {hard.workRam+3A8}
0C58: 4F              LD      C,A                 
0C59: 06 00           LD      B,$00               
0C5B: 09              ADD     HL,BC               
0C5C: 7E              LD      A,(HL)              
0C5D: DD 77 60        LD      (IX+$60),A          
0C60: 23              INC     HL                  
0C61: 7E              LD      A,(HL)              
0C62: DD 77 40        LD      (IX+$40),A          
0C65: 23              INC     HL                  
0C66: 7E              LD      A,(HL)              
0C67: DD 77 20        LD      (IX+$20),A          
0C6A: DD 36 E0 8B     LD      (IX-$20),$8B        
0C6E: C1              POP     BC                  
0C6F: DD E5           PUSH    IX                  
0C71: E1              POP     HL                  
0C72: 11 FC FF        LD      DE,$FFFC            
0C75: 19              ADD     HL,DE               
0C76: 22 A8 63        LD      ($63A8),HL          ; {hard.workRam+3A8}
0C79: E1              POP     HL                  
0C7A: 11 5F FF        LD      DE,$FF5F            
0C7D: 19              ADD     HL,DE               
0C7E: 05              DEC     B                   
0C7F: C2 29 0C        JP      NZ,$0C29            ; {code.loc_0c29}
0C82: 11 07 03        LD      DE,$0307            
0C85: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0C88: 21 09 60        LD      HL,$6009            
0C8B: 36 A0           LD      (HL),$A0            
0C8D: 23              INC     HL                  
0C8E: 34              INC     (HL)                
0C8F: 34              INC     (HL)                
0C90: C9              RET                         

buildBoardWhenTimerExpires:
0C91: DF              RST     $18                 

buildBoard:
0C92: CD 74 08        CALL    $0874               ; {code.clearPlayfieldAndSprites}
0C95: AF              XOR     A                   
0C96: 32 8C 63        LD      ($638C),A           ; {ram.bonusDisplay}
0C99: 11 01 05        LD      DE,$0501            
0C9C: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
0C9F: 21 86 7D        LD      HL,$7D86            
0CA2: 36 00           LD      (HL),$00            
0CA4: 23              INC     HL                  
0CA5: 36 01           LD      (HL),$01            
0CA7: 3A 27 62        LD      A,($6227)           ; {ram.board}
0CAA: 3D              DEC     A                   
0CAB: CA D4 0C        JP      Z,$0CD4             ; {code.setup25mGirderBoard}
0CAE: 3D              DEC     A                   
0CAF: CA DF 0C        JP      Z,$0CDF             ; {code.setup50mConveyorBoard}
0CB2: 3D              DEC     A                   
0CB3: CA F2 0C        JP      Z,$0CF2             ; {code.setUp75mBoard}
0CB6: CD 43 0D        CALL    $0D43               ; {code.stampRivetBoardBands}
0CB9: 21 86 7D        LD      HL,$7D86            
0CBC: 36 01           LD      (HL),$01            
0CBE: 3E 0B           LD      A,$0B               
0CC0: 32 89 60        LD      ($6089),A           ; {ram.sndBgm}
0CC3: 11 8B 3C        LD      DE,$3C8B            

loc_0cc6:
0CC6: CD A7 0D        CALL    $0DA7               ; {code.drawBoardLayout}
0CC9: 3A 27 62        LD      A,($6227)           ; {ram.board}
0CCC: FE 04           CP      $04                 
0CCE: CC 00 0D        CALL    Z,$0D00             ; {code.stampRivetBoardTiles}
0CD1: C3 A0 3F        JP      $3FA0               ; {code.loc_3fa0}

setup25mGirderBoard:
0CD4: 11 E4 3A        LD      DE,$3AE4            
0CD7: 3E 08           LD      A,$08               
0CD9: 32 89 60        LD      ($6089),A           ; {ram.sndBgm}
0CDC: C3 C6 0C        JP      $0CC6               ; {code.loc_0cc6}

setup50mConveyorBoard:
0CDF: 11 5D 3B        LD      DE,$3B5D            
0CE2: 21 86 7D        LD      HL,$7D86            
0CE5: 36 01           LD      (HL),$01            
0CE7: 23              INC     HL                  
0CE8: 36 00           LD      (HL),$00            
0CEA: 3E 09           LD      A,$09               
0CEC: 32 89 60        LD      ($6089),A           ; {ram.sndBgm}
0CEF: C3 C6 0C        JP      $0CC6               ; {code.loc_0cc6}

setUp75mBoard:
0CF2: CD 27 0D        CALL    $0D27               ; {code.stamp75mBoardTiles}
0CF5: 3E 0A           LD      A,$0A               
0CF7: 32 89 60        LD      ($6089),A           ; {ram.sndBgm}
0CFA: 11 E5 3B        LD      DE,$3BE5            
0CFD: C3 C6 0C        JP      $0CC6               ; {code.loc_0cc6}

stampRivetBoardTiles:
0D00: 06 08           LD      B,$08               
0D02: 21 17 0D        LD      HL,$0D17            

loc_0d05:
0D05: 3E B8           LD      A,$B8               
0D07: 0E 02           LD      C,$02               
0D09: 5E              LD      E,(HL)              
0D0A: 23              INC     HL                  
0D0B: 56              LD      D,(HL)              
0D0C: 23              INC     HL                  

loc_0d0d:
0D0D: 12              LD      (DE),A              
0D0E: 3D              DEC     A                   
0D0F: 13              INC     DE                  
0D10: 0D              DEC     C                   
0D11: C2 0D 0D        JP      NZ,$0D0D            ; {code.loc_0d0d}
0D14: 10 EF           DJNZ    $0D05               ; {code.loc_0d05}
0D16: C9              RET                         

; ---- $0D17-$0D26: data ----
0D17: CA 76 CF 76 D4 76 D9 76 2A 75 2F 75 34 75 39 75

stamp75mBoardTiles:
0D27: 21 0D 77        LD      HL,$770D            
0D2A: CD 30 0D        CALL    $0D30               ; {code.fillTileRowPair}
0D2D: 21 0D 76        LD      HL,$760D            

fillTileRowPair:
0D30: 06 11           LD      B,$11               

loc_0d32:
0D32: 36 FD           LD      (HL),$FD            
0D34: 23              INC     HL                  
0D35: 10 FB           DJNZ    $0D32               ; {code.loc_0d32}
0D37: 11 0F 00        LD      DE,$000F            
0D3A: 19              ADD     HL,DE               
0D3B: 06 11           LD      B,$11               

loc_0d3d:
0D3D: 36 FC           LD      (HL),$FC            
0D3F: 23              INC     HL                  
0D40: 10 FB           DJNZ    $0D3D               ; {code.loc_0d3d}
0D42: C9              RET                         

stampRivetBoardBands:
0D43: 21 87 76        LD      HL,$7687            
0D46: CD 4C 0D        CALL    $0D4C               ; {code.stampTwoTileBands}
0D49: 21 47 75        LD      HL,$7547            

stampTwoTileBands:
0D4C: 06 04           LD      B,$04               

loc_0d4e:
0D4E: 36 FD           LD      (HL),$FD            
0D50: 23              INC     HL                  
0D51: 10 FB           DJNZ    $0D4E               ; {code.loc_0d4e}
0D53: 11 1C 00        LD      DE,$001C            
0D56: 19              ADD     HL,DE               
0D57: 06 04           LD      B,$04               

loc_0d59:
0D59: 36 FC           LD      (HL),$FC            
0D5B: 23              INC     HL                  
0D5C: 10 FB           DJNZ    $0D59               ; {code.loc_0d59}
0D5E: C9              RET                         

loc_0d5f:
0D5F: CD 56 0F        CALL    $0F56               ; {code.initBoardState}

loc_0d62:
0D62: CD 41 24        CALL    $2441               ; {code.loadBoardObjectRecords}

loc_0d65:
0D65: 21 09 60        LD      HL,$6009            
0D68: 36 40           LD      (HL),$40            
0D6A: 23              INC     HL                  
0D6B: 34              INC     (HL)                
0D6C: 21 5C 38        LD      HL,$385C            
0D6F: CD 4E 00        CALL    $004E               ; {code.loadSpriteObjectBlock}
0D72: 11 00 69        LD      DE,$6900            
0D75: 01 08 00        LD      BC,$0008            
0D78: ED B0           LDIR                        
0D7A: 3A 27 62        LD      A,($6227)           ; {ram.board}
0D7D: FE 04           CP      $04                 
0D7F: 28 0A           JR      Z,$0D8B             ; {code.loc_0d8b}
0D81: 0F              RRCA                        
0D82: 0F              RRCA                        
0D83: D8              RET     C                   
0D84: 21 0B 69        LD      HL,$690B            
0D87: 0E FC           LD      C,$FC               
0D89: FF              RST     $38                 
0D8A: C9              RET                         

loc_0d8b:
0D8B: 21 08 69        LD      HL,$6908            
0D8E: 0E 44           LD      C,$44               
0D90: FF              RST     $38                 
0D91: 11 04 00        LD      DE,$0004            
0D94: 01 10 02        LD      BC,$0210            
0D97: 21 00 69        LD      HL,$6900            
0D9A: CD 3D 00        CALL    $003D               ; {code.addStrided}
0D9D: 01 F8 02        LD      BC,$02F8            
0DA0: 21 03 69        LD      HL,$6903            
0DA3: CD 3D 00        CALL    $003D               ; {code.addStrided}
0DA6: C9              RET                         

drawBoardLayout:
0DA7: 1A              LD      A,(DE)              
0DA8: 32 B3 63        LD      ($63B3),A           ; {ram.segKind}
0DAB: FE AA           CP      $AA                 
0DAD: C8              RET     Z                   
0DAE: 13              INC     DE                  
0DAF: 1A              LD      A,(DE)              
0DB0: 67              LD      H,A                 
0DB1: 44              LD      B,H                 
0DB2: 13              INC     DE                  
0DB3: 1A              LD      A,(DE)              
0DB4: 6F              LD      L,A                 
0DB5: 4D              LD      C,L                 
0DB6: D5              PUSH    DE                  
0DB7: CD F0 2F        CALL    $2FF0               ; {code.tileAddrForPixel}
0DBA: D1              POP     DE                  
0DBB: 22 AB 63        LD      ($63AB),HL          ; {ram.segAddr1}
0DBE: 78              LD      A,B                 
0DBF: E6 07           AND     $07                 
0DC1: 32 B4 63        LD      ($63B4),A           ; {ram.segSubtileY1}
0DC4: 79              LD      A,C                 
0DC5: E6 07           AND     $07                 
0DC7: 32 AF 63        LD      ($63AF),A           ; {ram.segSubtile1}
0DCA: 13              INC     DE                  
0DCB: 1A              LD      A,(DE)              
0DCC: 67              LD      H,A                 
0DCD: 90              SUB     B                   
0DCE: D2 D3 0D        JP      NC,$0DD3            ; {code.loc_0dd3}
0DD1: ED 44           NEG                         

loc_0dd3:
0DD3: 32 B1 63        LD      ($63B1),A           ; {ram.segHeight}
0DD6: 13              INC     DE                  
0DD7: 1A              LD      A,(DE)              
0DD8: 6F              LD      L,A                 
0DD9: 91              SUB     C                   
0DDA: 32 B2 63        LD      ($63B2),A           ; {ram.segRun}
0DDD: 1A              LD      A,(DE)              
0DDE: E6 07           AND     $07                 
0DE0: 32 B0 63        LD      ($63B0),A           ; {ram.segSubtile2}
0DE3: D5              PUSH    DE                  
0DE4: CD F0 2F        CALL    $2FF0               ; {code.tileAddrForPixel}
0DE7: D1              POP     DE                  
0DE8: 22 AD 63        LD      ($63AD),HL          ; {ram.segAddr2}
0DEB: 3A B3 63        LD      A,($63B3)           ; {ram.segKind}
0DEE: FE 02           CP      $02                 
0DF0: F2 4F 0E        JP      P,$0E4F             ; {code.drawLadder}
0DF3: 3A B2 63        LD      A,($63B2)           ; {ram.segRun}
0DF6: D6 10           SUB     $10                 
0DF8: 47              LD      B,A                 
0DF9: 3A AF 63        LD      A,($63AF)           ; {ram.segSubtile1}
0DFC: 80              ADD     A,B                 
0DFD: 32 B2 63        LD      ($63B2),A           ; {ram.segRun}
0E00: 3A AF 63        LD      A,($63AF)           ; {ram.segSubtile1}
0E03: C6 F0           ADD     A,$F0               
0E05: 2A AB 63        LD      HL,($63AB)          ; {ram.segAddr1}
0E08: 77              LD      (HL),A              
0E09: 2C              INC     L                   
0E0A: D6 30           SUB     $30                 
0E0C: 77              LD      (HL),A              
0E0D: 3A B3 63        LD      A,($63B3)           ; {ram.segKind}
0E10: FE 01           CP      $01                 
0E12: C2 19 0E        JP      NZ,$0E19            ; {code.drawGirderSpan}
0E15: AF              XOR     A                   
0E16: 32 B2 63        LD      ($63B2),A           ; {ram.segRun}

drawGirderSpan:
0E19: 3A B2 63        LD      A,($63B2)           ; {ram.segRun}
0E1C: D6 08           SUB     $08                 
0E1E: 32 B2 63        LD      ($63B2),A           ; {ram.segRun}
0E21: DA 2A 0E        JP      C,$0E2A             ; {code.drawSegmentEndCap}
0E24: 2C              INC     L                   
0E25: 36 C0           LD      (HL),$C0            
0E27: C3 19 0E        JP      $0E19               ; {code.drawGirderSpan}

drawSegmentEndCap:
0E2A: 3A B0 63        LD      A,($63B0)           ; {ram.segSubtile2}
0E2D: C6 D0           ADD     A,$D0               
0E2F: 2A AD 63        LD      HL,($63AD)          ; {ram.segAddr2}
0E32: 77              LD      (HL),A              
0E33: 3A B3 63        LD      A,($63B3)           ; {ram.segKind}
0E36: FE 01           CP      $01                 
0E38: C2 3F 0E        JP      NZ,$0E3F            ; {code.loc_0e3f}
0E3B: 2D              DEC     L                   
0E3C: 36 C0           LD      (HL),$C0            
0E3E: 2C              INC     L                   

loc_0e3f:
0E3F: 3A B0 63        LD      A,($63B0)           ; {ram.segSubtile2}
0E42: FE 00           CP      $00                 
0E44: CA 4B 0E        JP      Z,$0E4B             ; {code.loc_0e4b}
0E47: C6 E0           ADD     A,$E0               
0E49: 2C              INC     L                   
0E4A: 77              LD      (HL),A              

loc_0e4b:
0E4B: 13              INC     DE                  
0E4C: C3 A7 0D        JP      $0DA7               ; {code.drawBoardLayout}

drawLadder:
0E4F: 3A B3 63        LD      A,($63B3)           ; {ram.segKind}
0E52: FE 02           CP      $02                 
0E54: C2 E8 0E        JP      NZ,$0EE8            ; {code.drawCappedTileColumn}
0E57: 3A AF 63        LD      A,($63AF)           ; {ram.segSubtile1}
0E5A: C6 F0           ADD     A,$F0               
0E5C: 32 B5 63        LD      ($63B5),A           ; {ram.segTile}
0E5F: 2A AB 63        LD      HL,($63AB)          ; {ram.segAddr1}

loc_0e62:
0E62: 3A B5 63        LD      A,($63B5)           ; {ram.segTile}
0E65: 77              LD      (HL),A              
0E66: 23              INC     HL                  
0E67: 7D              LD      A,L                 
0E68: E6 1F           AND     $1F                 
0E6A: CA 78 0E        JP      Z,$0E78             ; {code.loc_0e78}
0E6D: 3A B5 63        LD      A,($63B5)           ; {ram.segTile}
0E70: FE F0           CP      $F0                 
0E72: CA 78 0E        JP      Z,$0E78             ; {code.loc_0e78}
0E75: D6 10           SUB     $10                 
0E77: 77              LD      (HL),A              

loc_0e78:
0E78: 01 1F 00        LD      BC,$001F            
0E7B: 09              ADD     HL,BC               
0E7C: 3A B1 63        LD      A,($63B1)           ; {ram.segHeight}
0E7F: D6 08           SUB     $08                 
0E81: DA CF 0E        JP      C,$0ECF             ; {code.loc_0ecf}
0E84: 32 B1 63        LD      ($63B1),A           ; {ram.segHeight}
0E87: 3A B2 63        LD      A,($63B2)           ; {ram.segRun}
0E8A: FE 00           CP      $00                 
0E8C: CA 62 0E        JP      Z,$0E62             ; {code.loc_0e62}
0E8F: 3A B5 63        LD      A,($63B5)           ; {ram.segTile}
0E92: 77              LD      (HL),A              
0E93: 23              INC     HL                  
0E94: 7D              LD      A,L                 
0E95: E6 1F           AND     $1F                 
0E97: CA A0 0E        JP      Z,$0EA0             ; {code.loc_0ea0}
0E9A: 3A B5 63        LD      A,($63B5)           ; {ram.segTile}
0E9D: D6 10           SUB     $10                 
0E9F: 77              LD      (HL),A              

loc_0ea0:
0EA0: 01 1F 00        LD      BC,$001F            
0EA3: 09              ADD     HL,BC               
0EA4: 3A B1 63        LD      A,($63B1)           ; {ram.segHeight}
0EA7: D6 08           SUB     $08                 
0EA9: DA CF 0E        JP      C,$0ECF             ; {code.loc_0ecf}
0EAC: 32 B1 63        LD      ($63B1),A           ; {ram.segHeight}
0EAF: 3A B2 63        LD      A,($63B2)           ; {ram.segRun}
0EB2: CB 7F           BIT     7,A                 
0EB4: C2 D3 0E        JP      NZ,$0ED3            ; {code.loc_0ed3}
0EB7: 3A B5 63        LD      A,($63B5)           ; {ram.segTile}
0EBA: 3C              INC     A                   
0EBB: 32 B5 63        LD      ($63B5),A           ; {ram.segTile}
0EBE: FE F8           CP      $F8                 
0EC0: C2 C9 0E        JP      NZ,$0EC9            ; {code.loc_0ec9}
0EC3: 23              INC     HL                  
0EC4: 3E F0           LD      A,$F0               
0EC6: 32 B5 63        LD      ($63B5),A           ; {ram.segTile}

loc_0ec9:
0EC9: 7D              LD      A,L                 
0ECA: E6 1F           AND     $1F                 
0ECC: C2 62 0E        JP      NZ,$0E62            ; {code.loc_0e62}

loc_0ecf:
0ECF: 13              INC     DE                  
0ED0: C3 A7 0D        JP      $0DA7               ; {code.drawBoardLayout}

loc_0ed3:
0ED3: 3A B5 63        LD      A,($63B5)           ; {ram.segTile}
0ED6: 3D              DEC     A                   
0ED7: 32 B5 63        LD      ($63B5),A           ; {ram.segTile}
0EDA: FE F0           CP      $F0                 
0EDC: F2 E5 0E        JP      P,$0EE5             ; {code.loc_0ee5}
0EDF: 2B              DEC     HL                  
0EE0: 3E F7           LD      A,$F7               
0EE2: 32 B5 63        LD      ($63B5),A           ; {ram.segTile}

loc_0ee5:
0EE5: C3 62 0E        JP      $0E62               ; {code.loc_0e62}

drawCappedTileColumn:
0EE8: 3A B3 63        LD      A,($63B3)           ; {ram.segKind}
0EEB: FE 03           CP      $03                 
0EED: C2 1B 0F        JP      NZ,$0F1B            ; {code.fillTileColumn}
0EF0: 2A AB 63        LD      HL,($63AB)          ; {ram.segAddr1}
0EF3: 3E B3           LD      A,$B3               
0EF5: 77              LD      (HL),A              
0EF6: 01 20 00        LD      BC,$0020            
0EF9: 09              ADD     HL,BC               
0EFA: 3A B1 63        LD      A,($63B1)           ; {ram.segHeight}
0EFD: D6 10           SUB     $10                 

loc_0eff:
0EFF: DA 14 0F        JP      C,$0F14             ; {code.loc_0f14}
0F02: 32 B1 63        LD      ($63B1),A           ; {ram.segHeight}
0F05: 3E B1           LD      A,$B1               
0F07: 77              LD      (HL),A              
0F08: 01 20 00        LD      BC,$0020            
0F0B: 09              ADD     HL,BC               
0F0C: 3A B1 63        LD      A,($63B1)           ; {ram.segHeight}
0F0F: D6 08           SUB     $08                 
0F11: C3 FF 0E        JP      $0EFF               ; {code.loc_0eff}

loc_0f14:
0F14: 3E B2           LD      A,$B2               
0F16: 77              LD      (HL),A              
0F17: 13              INC     DE                  
0F18: C3 A7 0D        JP      $0DA7               ; {code.drawBoardLayout}

fillTileColumn:
0F1B: 3A B3 63        LD      A,($63B3)           ; {ram.segKind}
0F1E: FE 07           CP      $07                 
0F20: F2 CF 0E        JP      P,$0ECF             ; {code.loc_0ecf}
0F23: FE 04           CP      $04                 
0F25: CA 4C 0F        JP      Z,$0F4C             ; {code.loc_0f4c}
0F28: FE 05           CP      $05                 
0F2A: CA 51 0F        JP      Z,$0F51             ; {code.loc_0f51}
0F2D: 3E FE           LD      A,$FE               

loc_0f2f:
0F2F: 32 B5 63        LD      ($63B5),A           ; {ram.segTile}
0F32: 2A AB 63        LD      HL,($63AB)          ; {ram.segAddr1}

fillColumnAndContinueWalk:
0F35: 3A B5 63        LD      A,($63B5)           ; {ram.segTile}
0F38: 77              LD      (HL),A              
0F39: 01 20 00        LD      BC,$0020            
0F3C: 09              ADD     HL,BC               
0F3D: 3A B1 63        LD      A,($63B1)           ; {ram.segHeight}
0F40: D6 08           SUB     $08                 
0F42: 32 B1 63        LD      ($63B1),A           ; {ram.segHeight}
0F45: D2 35 0F        JP      NC,$0F35            ; {code.fillColumnAndContinueWalk}
0F48: 13              INC     DE                  
0F49: C3 A7 0D        JP      $0DA7               ; {code.drawBoardLayout}

loc_0f4c:
0F4C: 3E E0           LD      A,$E0               
0F4E: C3 2F 0F        JP      $0F2F               ; {code.loc_0f2f}

loc_0f51:
0F51: 3E B0           LD      A,$B0               
0F53: C3 2F 0F        JP      $0F2F               ; {code.loc_0f2f}

initBoardState:
0F56: 06 27           LD      B,$27               
0F58: 21 00 62        LD      HL,$6200            
0F5B: AF              XOR     A                   

loc_0f5c:
0F5C: 77              LD      (HL),A              
0F5D: 2C              INC     L                   
0F5E: 10 FC           DJNZ    $0F5C               ; {code.loc_0f5c}
0F60: 0E 11           LD      C,$11               
0F62: 16 80           LD      D,$80               
0F64: 21 80 62        LD      HL,$6280            

loc_0f67:
0F67: 42              LD      B,D                 

loc_0f68:
0F68: 77              LD      (HL),A              
0F69: 23              INC     HL                  
0F6A: 10 FC           DJNZ    $0F68               ; {code.loc_0f68}
0F6C: 0D              DEC     C                   
0F6D: 20 F8           JR      NZ,$0F67            ; {code.loc_0f67}
0F6F: 21 9C 3D        LD      HL,$3D9C            
0F72: 11 80 62        LD      DE,$6280            
0F75: 01 40 00        LD      BC,$0040            
0F78: ED B0           LDIR                        
0F7A: 3A 29 62        LD      A,($6229)           ; {ram.level}
0F7D: 47              LD      B,A                 
0F7E: A7              AND     A                   
0F7F: 17              RLA                         
0F80: A7              AND     A                   
0F81: 17              RLA                         
0F82: A7              AND     A                   
0F83: 17              RLA                         
0F84: 80              ADD     A,B                 
0F85: 80              ADD     A,B                 
0F86: C6 28           ADD     A,$28               
0F88: FE 51           CP      $51                 
0F8A: 38 02           JR      C,$0F8E             ; {code.loc_0f8e}
0F8C: 3E 50           LD      A,$50               

loc_0f8e:
0F8E: 21 B0 62        LD      HL,$62B0            
0F91: 06 03           LD      B,$03               

loc_0f93:
0F93: 77              LD      (HL),A              
0F94: 2C              INC     L                   
0F95: 10 FC           DJNZ    $0F93               ; {code.loc_0f93}
0F97: 87              ADD     A,A                 
0F98: 47              LD      B,A                 
0F99: 3E DC           LD      A,$DC               
0F9B: 90              SUB     B                   
0F9C: FE 28           CP      $28                 
0F9E: 30 02           JR      NC,$0FA2            ; {code.loc_0fa2}
0FA0: 3E 28           LD      A,$28               

loc_0fa2:
0FA2: 77              LD      (HL),A              
0FA3: 2C              INC     L                   
0FA4: 77              LD      (HL),A              
0FA5: 21 09 62        LD      HL,$6209            
0FA8: 36 04           LD      (HL),$04            
0FAA: 2C              INC     L                   
0FAB: 36 08           LD      (HL),$08            
0FAD: 3A 27 62        LD      A,($6227)           ; {ram.board}
0FB0: 4F              LD      C,A                 
0FB1: CB 57           BIT     2,A                 
0FB3: 20 16           JR      NZ,$0FCB            ; {code.loc_0fcb}
0FB5: 21 00 6A        LD      HL,$6A00            
0FB8: 3E 4F           LD      A,$4F               
0FBA: 06 03           LD      B,$03               

loc_0fbc:
0FBC: 77              LD      (HL),A              
0FBD: 2C              INC     L                   
0FBE: 36 3A           LD      (HL),$3A            
0FC0: 2C              INC     L                   
0FC1: 36 0F           LD      (HL),$0F            
0FC3: 2C              INC     L                   
0FC4: 36 18           LD      (HL),$18            
0FC6: 2C              INC     L                   
0FC7: C6 10           ADD     A,$10               
0FC9: 10 F1           DJNZ    $0FBC               ; {code.loc_0fbc}

loc_0fcb:
0FCB: 79              LD      A,C                 
0FCC: EF              RST     $28                 

; ---- $0FCD-$0FD6: jump table ----
0FCD: 00 00 D7 0F 1F 10 87 10 31 11

seed25mBoardObjects:
0FD7: 21 DC 3D        LD      HL,$3DDC            
0FDA: 11 A8 69        LD      DE,$69A8            
0FDD: 01 10 00        LD      BC,$0010            
0FE0: ED B0           LDIR                        
0FE2: 21 EC 3D        LD      HL,$3DEC            
0FE5: 11 07 64        LD      DE,$6407            
0FE8: 0E 1C           LD      C,$1C               
0FEA: 06 05           LD      B,$05               
0FEC: CD 2A 12        CALL    $122A               ; {code.replicateGroupStrided}
0FEF: 21 F4 3D        LD      HL,$3DF4            
0FF2: CD FA 11        CALL    $11FA               ; {code.loc_11fa}
0FF5: 21 00 3E        LD      HL,$3E00            
0FF8: 11 FC 69        LD      DE,$69FC            
0FFB: 01 04 00        LD      BC,$0004            
0FFE: ED B0           LDIR                        
1000: 21 0C 3E        LD      HL,$3E0C            
1003: CD A6 11        CALL    $11A6               ; {code.seedSpriteObjectPair}
1006: 21 1B 10        LD      HL,$101B            
1009: 11 07 67        LD      DE,$6707            
100C: 01 1C 08        LD      BC,$081C            
100F: CD 2A 12        CALL    $122A               ; {code.replicateGroupStrided}
1012: 11 07 68        LD      DE,$6807            
1015: 06 02           LD      B,$02               
1017: CD 2A 12        CALL    $122A               ; {code.replicateGroupStrided}
101A: C9              RET                         

; ---- $101B-$101E: data ----
101B: 00 00 02 02

seed50mBoardObjects:
101F: 21 EC 3D        LD      HL,$3DEC            
1022: 11 07 64        LD      DE,$6407            
1025: 01 1C 05        LD      BC,$051C            
1028: CD 2A 12        CALL    $122A               ; {code.replicateGroupStrided}
102B: CD 86 11        CALL    $1186               ; {code.seedObjectBlockSprites}
102E: 21 18 3E        LD      HL,$3E18            
1031: 11 A7 65        LD      DE,$65A7            
1034: 01 0C 06        LD      BC,$060C            
1037: CD 2A 12        CALL    $122A               ; {code.replicateGroupStrided}
103A: DD 21 A0 65     LD      IX,$65A0            
103E: 21 B8 69        LD      HL,$69B8            
1041: 11 10 00        LD      DE,$0010            
1044: 06 06           LD      B,$06               
1046: CD D3 11        CALL    $11D3               ; {code.gatherSpriteRecords}
1049: 21 FA 3D        LD      HL,$3DFA            
104C: CD FA 11        CALL    $11FA               ; {code.loc_11fa}
104F: 21 04 3E        LD      HL,$3E04            
1052: 11 FC 69        LD      DE,$69FC            
1055: 01 04 00        LD      BC,$0004            
1058: ED B0           LDIR                        
105A: 21 1C 3E        LD      HL,$3E1C            
105D: 11 44 69        LD      DE,$6944            
1060: 01 08 00        LD      BC,$0008            
1063: ED B0           LDIR                        
1065: 21 24 3E        LD      HL,$3E24            
1068: 11 E4 69        LD      DE,$69E4            
106B: 01 18 00        LD      BC,$0018            
106E: ED B0           LDIR                        
1070: 21 10 3E        LD      HL,$3E10            
1073: CD A6 11        CALL    $11A6               ; {code.seedSpriteObjectPair}
1076: 21 3C 3E        LD      HL,$3E3C            
1079: 11 0C 6A        LD      DE,$6A0C            
107C: 01 0C 00        LD      BC,$000C            
107F: ED B0           LDIR                        
1081: 3E 01           LD      A,$01               
1083: 32 B9 62        LD      ($62B9),A           ; {hard.workRam+2B9}
1086: C9              RET                         

seed75mBoardObjects:
1087: 21 EC 3D        LD      HL,$3DEC            
108A: 11 07 64        LD      DE,$6407            
108D: 01 1C 05        LD      BC,$051C            
1090: CD 2A 12        CALL    $122A               ; {code.replicateGroupStrided}
1093: CD 86 11        CALL    $1186               ; {code.seedObjectBlockSprites}
1096: 21 00 66        LD      HL,$6600            
1099: 11 10 00        LD      DE,$0010            
109C: 3E 01           LD      A,$01               
109E: 06 06           LD      B,$06               

loc_10a0:
10A0: 77              LD      (HL),A              
10A1: 19              ADD     HL,DE               
10A2: 10 FC           DJNZ    $10A0               ; {code.loc_10a0}
10A4: 0E 02           LD      C,$02               
10A6: 3E 08           LD      A,$08               

loc_10a8:
10A8: 06 03           LD      B,$03               
10AA: 21 0D 66        LD      HL,$660D            

loc_10ad:
10AD: 77              LD      (HL),A              
10AE: 19              ADD     HL,DE               
10AF: 10 FC           DJNZ    $10AD               ; {code.loc_10ad}
10B1: 3E 08           LD      A,$08               
10B3: 0D              DEC     C                   
10B4: C2 A8 10        JP      NZ,$10A8            ; {code.loc_10a8}
10B7: 21 64 3E        LD      HL,$3E64            
10BA: 11 03 66        LD      DE,$6603            
10BD: 01 0E 06        LD      BC,$060E            
10C0: CD EC 11        CALL    $11EC               ; {code.copyBytePairsStrided}
10C3: 21 60 3E        LD      HL,$3E60            
10C6: 11 07 66        LD      DE,$6607            
10C9: 01 0C 06        LD      BC,$060C            
10CC: CD 2A 12        CALL    $122A               ; {code.replicateGroupStrided}
10CF: DD 21 00 66     LD      IX,$6600            
10D3: 21 58 69        LD      HL,$6958            
10D6: 06 06           LD      B,$06               
10D8: 11 10 00        LD      DE,$0010            
10DB: CD D3 11        CALL    $11D3               ; {code.gatherSpriteRecords}
10DE: 21 48 3E        LD      HL,$3E48            
10E1: 11 0C 6A        LD      DE,$6A0C            
10E4: 01 0C 00        LD      BC,$000C            
10E7: ED B0           LDIR                        
10E9: DD 21 00 64     LD      IX,$6400            
10ED: DD 36 00 01     LD      (IX+$00),$01        
10F1: DD 36 03 58     LD      (IX+$03),$58        
10F5: DD 36 0E 58     LD      (IX+$0E),$58        
10F9: DD 36 05 80     LD      (IX+$05),$80        
10FD: DD 36 0F 80     LD      (IX+$0F),$80        
1101: DD 36 20 01     LD      (IX+$20),$01        
1105: DD 36 23 EB     LD      (IX+$23),$EB        
1109: DD 36 2E EB     LD      (IX+$2E),$EB        
110D: DD 36 25 60     LD      (IX+$25),$60        
1111: DD 36 2F 60     LD      (IX+$2F),$60        
1115: 11 70 69        LD      DE,$6970            
1118: 21 21 11        LD      HL,$1121            
111B: 01 10 00        LD      BC,$0010            
111E: ED B0           LDIR                        
1120: C9              RET                         

; ---- $1121-$1130: data ----
1121: 37 45 0F 60 37 45 8F F7 77 45 0F 60 77 45 8F F7

seed100mBoardObjects:
1131: 21 F0 3D        LD      HL,$3DF0            
1134: 11 07 64        LD      DE,$6407            
1137: 01 1C 05        LD      BC,$051C            
113A: CD 2A 12        CALL    $122A               ; {code.replicateGroupStrided}
113D: 21 14 3E        LD      HL,$3E14            
1140: CD A6 11        CALL    $11A6               ; {code.seedSpriteObjectPair}
1143: 21 54 3E        LD      HL,$3E54            
1146: 11 0C 6A        LD      DE,$6A0C            
1149: 01 0C 00        LD      BC,$000C            
114C: ED B0           LDIR                        
114E: 21 82 11        LD      HL,$1182            
1151: 11 A3 64        LD      DE,$64A3            
1154: 01 1E 02        LD      BC,$021E            
1157: CD EC 11        CALL    $11EC               ; {code.copyBytePairsStrided}
115A: 21 7E 11        LD      HL,$117E            
115D: 11 A7 64        LD      DE,$64A7            
1160: 01 1C 02        LD      BC,$021C            
1163: CD 2A 12        CALL    $122A               ; {code.replicateGroupStrided}
1166: DD 21 A0 64     LD      IX,$64A0            
116A: DD 36 00 01     LD      (IX+$00),$01        
116E: DD 36 20 01     LD      (IX+$20),$01        
1172: 21 50 69        LD      HL,$6950            
1175: 06 02           LD      B,$02               
1177: 11 20 00        LD      DE,$0020            
117A: CD D3 11        CALL    $11D3               ; {code.gatherSpriteRecords}
117D: C9              RET                         

; ---- $117E-$1185: data ----
117E: 3F 0C 08 08 73 50 8D 50

seedObjectBlockSprites:
1186: 21 A2 11        LD      HL,$11A2            
1189: 11 07 65        LD      DE,$6507            
118C: 01 0C 0A        LD      BC,$0A0C            
118F: CD 2A 12        CALL    $122A               ; {code.replicateGroupStrided}
1192: DD 21 00 65     LD      IX,$6500            
1196: 21 80 69        LD      HL,$6980            
1199: 06 0A           LD      B,$0A               
119B: 11 10 00        LD      DE,$0010            
119E: CD D3 11        CALL    $11D3               ; {code.gatherSpriteRecords}
11A1: C9              RET                         

; ---- $11A2-$11A5: data ----
11A2: 3B 00 02 02

seedSpriteObjectPair:
11A6: 11 83 66        LD      DE,$6683            
11A9: 01 0E 02        LD      BC,$020E            
11AC: CD EC 11        CALL    $11EC               ; {code.copyBytePairsStrided}
11AF: 21 08 3E        LD      HL,$3E08            
11B2: 11 87 66        LD      DE,$6687            
11B5: 01 0C 02        LD      BC,$020C            
11B8: CD 2A 12        CALL    $122A               ; {code.replicateGroupStrided}
11BB: DD 21 80 66     LD      IX,$6680            
11BF: DD 36 00 01     LD      (IX+$00),$01        
11C3: DD 36 10 01     LD      (IX+$10),$01        
11C7: 21 18 6A        LD      HL,$6A18            
11CA: 06 02           LD      B,$02               
11CC: 11 10 00        LD      DE,$0010            
11CF: CD D3 11        CALL    $11D3               ; {code.gatherSpriteRecords}
11D2: C9              RET                         

gatherSpriteRecords:
11D3: DD 7E 03        LD      A,(IX+$03)          
11D6: 77              LD      (HL),A              
11D7: 2C              INC     L                   
11D8: DD 7E 07        LD      A,(IX+$07)          
11DB: 77              LD      (HL),A              
11DC: 2C              INC     L                   
11DD: DD 7E 08        LD      A,(IX+$08)          
11E0: 77              LD      (HL),A              
11E1: 2C              INC     L                   
11E2: DD 7E 05        LD      A,(IX+$05)          
11E5: 77              LD      (HL),A              
11E6: 2C              INC     L                   
11E7: DD 19           ADD     IX,DE               
11E9: 10 E8           DJNZ    $11D3               ; {code.gatherSpriteRecords}
11EB: C9              RET                         

copyBytePairsStrided:
11EC: 7E              LD      A,(HL)              
11ED: 12              LD      (DE),A              
11EE: 23              INC     HL                  
11EF: 1C              INC     E                   
11F0: 1C              INC     E                   
11F1: 7E              LD      A,(HL)              
11F2: 12              LD      (DE),A              
11F3: 23              INC     HL                  
11F4: 7B              LD      A,E                 
11F5: 81              ADD     A,C                 
11F6: 5F              LD      E,A                 
11F7: 10 F3           DJNZ    $11EC               ; {code.copyBytePairsStrided}
11F9: C9              RET                         

loc_11fa:
11FA: DD 21 A0 66     LD      IX,$66A0            
11FE: 11 28 6A        LD      DE,$6A28            
1201: DD 36 00 01     LD      (IX+$00),$01        
1205: 7E              LD      A,(HL)              
1206: DD 77 03        LD      (IX+$03),A          
1209: 12              LD      (DE),A              
120A: 1C              INC     E                   
120B: 23              INC     HL                  
120C: 7E              LD      A,(HL)              
120D: DD 77 07        LD      (IX+$07),A          
1210: 12              LD      (DE),A              
1211: 1C              INC     E                   
1212: 23              INC     HL                  
1213: 7E              LD      A,(HL)              
1214: DD 77 08        LD      (IX+$08),A          
1217: 12              LD      (DE),A              
1218: 1C              INC     E                   
1219: 23              INC     HL                  
121A: 7E              LD      A,(HL)              
121B: DD 77 05        LD      (IX+$05),A          
121E: 12              LD      (DE),A              
121F: 23              INC     HL                  
1220: 7E              LD      A,(HL)              
1221: DD 77 09        LD      (IX+$09),A          
1224: 23              INC     HL                  
1225: 7E              LD      A,(HL)              
1226: DD 77 0A        LD      (IX+$0A),A          
1229: C9              RET                         

replicateGroupStrided:
122A: E5              PUSH    HL                  
122B: C5              PUSH    BC                  
122C: 06 04           LD      B,$04               

loc_122e:
122E: 7E              LD      A,(HL)              
122F: 12              LD      (DE),A              
1230: 23              INC     HL                  
1231: 1C              INC     E                   
1232: 10 FA           DJNZ    $122E               ; {code.loc_122e}
1234: C1              POP     BC                  
1235: E1              POP     HL                  
1236: 7B              LD      A,E                 
1237: 81              ADD     A,C                 
1238: 5F              LD      E,A                 
1239: 10 EF           DJNZ    $122A               ; {code.replicateGroupStrided}
123B: C9              RET                         

seedMarioActorRecord:
123C: DF              RST     $18                 
123D: 3A 27 62        LD      A,($6227)           ; {ram.board}
1240: FE 03           CP      $03                 
1242: 01 16 E0        LD      BC,$E016            
1245: CA 4B 12        JP      Z,$124B             ; {code.loc_124b}
1248: 01 3F F0        LD      BC,$F03F            

loc_124b:
124B: DD 21 00 62     LD      IX,$6200            
124F: 21 4C 69        LD      HL,$694C            
1252: DD 36 00 01     LD      (IX+$00),$01        
1256: DD 71 03        LD      (IX+$03),C          
1259: 71              LD      (HL),C              
125A: 2C              INC     L                   
125B: DD 36 07 80     LD      (IX+$07),$80        
125F: 36 80           LD      (HL),$80            
1261: 2C              INC     L                   
1262: DD 36 08 02     LD      (IX+$08),$02        
1266: 36 02           LD      (HL),$02            
1268: 2C              INC     L                   
1269: DD 70 05        LD      (IX+$05),B          
126C: 70              LD      (HL),B              
126D: DD 36 0F 01     LD      (IX+$0F),$01        
1271: 21 0A 60        LD      HL,$600A            
1274: 34              INC     (HL)                
1275: 11 01 06        LD      DE,$0601            
1278: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
127B: C9              RET                         

runDeathAnimationSubstate:
127C: CD BD 1D        CALL    $1DBD               ; {code.dispatchEffectState}

dispatchDeathAnimationPhase:
127F: 3A 9D 63        LD      A,($639D)           ; {ram.deathAnimPhase}
1282: EF              RST     $28                 

; ---- $1283-$128A: jump table ----
1283: 8B 12 AC 12 DE 12 00 00

beginMarioDeathAnimation:
128B: DF              RST     $18                 
128C: 21 4D 69        LD      HL,$694D            
128F: 3E F0           LD      A,$F0               
1291: CB 16           RL      (HL)                
1293: 1F              RRA                         
1294: 77              LD      (HL),A              
1295: 21 9D 63        LD      HL,$639D            
1298: 34              INC     (HL)                
1299: 3E 0D           LD      A,$0D               
129B: 32 9E 63        LD      ($639E),A           ; {ram.deathAnimTicksLeft}
129E: 3E 08           LD      A,$08               
12A0: 32 09 60        LD      ($6009),A           ; {ram.substateTimer}
12A3: CD BD 30        CALL    $30BD               ; {code.clearSpriteColumns}
12A6: 3E 03           LD      A,$03               
12A8: 32 88 60        LD      ($6088),A           ; {ram.sndIrqTrigger}
12AB: C9              RET                         

stepMarioDeathAnimation:
12AC: DF              RST     $18                 
12AD: 3E 08           LD      A,$08               
12AF: 32 09 60        LD      ($6009),A           ; {ram.substateTimer}
12B2: 21 9E 63        LD      HL,$639E            
12B5: 35              DEC     (HL)                
12B6: CA CB 12        JP      Z,$12CB             ; {code.loc_12cb}
12B9: 21 4D 69        LD      HL,$694D            
12BC: 7E              LD      A,(HL)              
12BD: 1F              RRA                         
12BE: 3E 02           LD      A,$02               
12C0: 1F              RRA                         
12C1: 47              LD      B,A                 
12C2: AE              XOR     (HL)                
12C3: 77              LD      (HL),A              
12C4: 2C              INC     L                   
12C5: 78              LD      A,B                 
12C6: E6 80           AND     $80                 
12C8: AE              XOR     (HL)                
12C9: 77              LD      (HL),A              
12CA: C9              RET                         

loc_12cb:
12CB: 21 4D 69        LD      HL,$694D            
12CE: 3E F4           LD      A,$F4               
12D0: CB 16           RL      (HL)                
12D2: 1F              RRA                         
12D3: 77              LD      (HL),A              
12D4: 21 9D 63        LD      HL,$639D            
12D7: 34              INC     (HL)                
12D8: 3E 80           LD      A,$80               
12DA: 32 09 60        LD      ($6009),A           ; {ram.substateTimer}
12DD: C9              RET                         

loc_12de:
12DE: DF              RST     $18                 
12DF: CD DB 30        CALL    $30DB               ; {code.loc_30db}

loc_12e2:
12E2: 21 0A 60        LD      HL,$600A            
12E5: 3A 0E 60        LD      A,($600E)           ; {ram.activePlayerIndex}
12E8: A7              AND     A                   
12E9: CA ED 12        JP      Z,$12ED             ; {code.loc_12ed}
12EC: 34              INC     (HL)                

loc_12ed:
12ED: 34              INC     (HL)                
12EE: 2B              DEC     HL                  
12EF: 36 01           LD      (HL),$01            
12F1: C9              RET                         

losePlayer1Life:
12F2: CD 1C 01        CALL    $011C               ; {code.silenceSound}
12F5: AF              XOR     A                   
12F6: 32 2C 62        LD      ($622C),A           ; {ram.playIntro}
12F9: 21 28 62        LD      HL,$6228            
12FC: 35              DEC     (HL)                
12FD: 7E              LD      A,(HL)              
12FE: 11 40 60        LD      DE,$6040            
1301: 01 08 00        LD      BC,$0008            
1304: ED B0           LDIR                        
1306: A7              AND     A                   
1307: C2 34 13        JP      NZ,$1334            ; {code.loc_1334}
130A: 3E 01           LD      A,$01               
130C: 21 B2 60        LD      HL,$60B2            
130F: CD CA 13        CALL    $13CA               ; {code.loc_13ca}
1312: 21 D4 76        LD      HL,$76D4            
1315: 3A 0F 60        LD      A,($600F)           ; {ram.twoPlayerGame}
1318: A7              AND     A                   
1319: 28 07           JR      Z,$1322             ; {code.loc_1322}
131B: 11 02 03        LD      DE,$0302            
131E: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
1321: 2B              DEC     HL                  

loc_1322:
1322: CD 26 18        CALL    $1826               ; {code.fillTileBlock}
1325: 11 00 03        LD      DE,$0300            
1328: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
132B: 21 09 60        LD      HL,$6009            
132E: 36 C0           LD      (HL),$C0            
1330: 23              INC     HL                  
1331: 36 10           LD      (HL),$10            
1333: C9              RET                         

loc_1334:
1334: 0E 08           LD      C,$08               
1336: 3A 0F 60        LD      A,($600F)           ; {ram.twoPlayerGame}
1339: A7              AND     A                   
133A: CA 3F 13        JP      Z,$133F             ; {code.loc_133f}
133D: 0E 17           LD      C,$17               

loc_133f:
133F: 79              LD      A,C                 
1340: 32 0A 60        LD      ($600A),A           ; {ram.gameSubstate}
1343: C9              RET                         

loc_1344:
1344: CD 1C 01        CALL    $011C               ; {code.silenceSound}
1347: AF              XOR     A                   
1348: 32 2C 62        LD      ($622C),A           ; {ram.playIntro}
134B: 21 28 62        LD      HL,$6228            
134E: 35              DEC     (HL)                
134F: 7E              LD      A,(HL)              
1350: 11 48 60        LD      DE,$6048            
1353: 01 08 00        LD      BC,$0008            
1356: ED B0           LDIR                        
1358: A7              AND     A                   
1359: C2 7F 13        JP      NZ,$137F            ; {code.loc_137f}
135C: 3E 03           LD      A,$03               
135E: 21 B5 60        LD      HL,$60B5            
1361: CD CA 13        CALL    $13CA               ; {code.loc_13ca}
1364: 11 03 03        LD      DE,$0303            
1367: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
136A: 11 00 03        LD      DE,$0300            
136D: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
1370: 21 D3 76        LD      HL,$76D3            
1373: CD 26 18        CALL    $1826               ; {code.fillTileBlock}
1376: 21 09 60        LD      HL,$6009            
1379: 36 C0           LD      (HL),$C0            
137B: 23              INC     HL                  
137C: 36 11           LD      (HL),$11            
137E: C9              RET                         

loc_137f:
137F: 0E 17           LD      C,$17               
1381: 3A 40 60        LD      A,($6040)           ; {ram.p1Context}
1384: A7              AND     A                   
1385: C2 8A 13        JP      NZ,$138A            ; {code.loc_138a}
1388: 0E 08           LD      C,$08               

loc_138a:
138A: 79              LD      A,C                 
138B: 32 0A 60        LD      ($600A),A           ; {ram.gameSubstate}
138E: C9              RET                         

loc_138f:
138F: DF              RST     $18                 
1390: 0E 17           LD      C,$17               
1392: 3A 48 60        LD      A,($6048)           ; {ram.p2Context}

loc_1395:
1395: 34              INC     (HL)                
1396: A7              AND     A                   
1397: C2 9C 13        JP      NZ,$139C            ; {code.loc_139c}
139A: 0E 14           LD      C,$14               

loc_139c:
139C: 79              LD      A,C                 
139D: 32 0A 60        LD      ($600A),A           ; {ram.gameSubstate}
13A0: C9              RET                         

loc_13a1:
13A1: DF              RST     $18                 
13A2: 0E 17           LD      C,$17               
13A4: 3A 40 60        LD      A,($6040)           ; {ram.p1Context}
13A7: C3 95 13        JP      $1395               ; {code.loc_1395}

loc_13aa:
13AA: 3A 26 60        LD      A,($6026)           ; {ram.dipUpright}
13AD: 32 82 7D        LD      ($7D82),A           ; {hard.flipScreen}
13B0: AF              XOR     A                   
13B1: 32 0A 60        LD      ($600A),A           ; {ram.gameSubstate}
13B4: 21 01 01        LD      HL,$0101            
13B7: 22 0D 60        LD      ($600D),HL          ; {ram.currentPlayer}
13BA: C9              RET                         

selectPlayer1Context:
13BB: AF              XOR     A                   
13BC: 32 0D 60        LD      ($600D),A           ; {ram.currentPlayer}
13BF: 32 0E 60        LD      ($600E),A           ; {ram.activePlayerIndex}
13C2: 32 0A 60        LD      ($600A),A           ; {ram.gameSubstate}
13C5: 3C              INC     A                   
13C6: 32 82 7D        LD      ($7D82),A           ; {hard.flipScreen}
13C9: C9              RET                         

loc_13ca:
13CA: 11 C6 61        LD      DE,$61C6            
13CD: 12              LD      (DE),A              
13CE: CF              RST     $08                 
13CF: 13              INC     DE                  
13D0: 01 03 00        LD      BC,$0003            
13D3: ED B0           LDIR                        
13D5: 06 03           LD      B,$03               
13D7: 21 B1 61        LD      HL,$61B1            

loc_13da:
13DA: 1B              DEC     DE                  
13DB: 1A              LD      A,(DE)              
13DC: 0F              RRCA                        
13DD: 0F              RRCA                        
13DE: 0F              RRCA                        
13DF: 0F              RRCA                        
13E0: E6 0F           AND     $0F                 
13E2: 77              LD      (HL),A              
13E3: 23              INC     HL                  
13E4: 1A              LD      A,(DE)              
13E5: E6 0F           AND     $0F                 
13E7: 77              LD      (HL),A              
13E8: 23              INC     HL                  
13E9: 10 EF           DJNZ    $13DA               ; {code.loc_13da}
13EB: 06 0E           LD      B,$0E               

loc_13ed:
13ED: 36 10           LD      (HL),$10            
13EF: 23              INC     HL                  
13F0: 10 FB           DJNZ    $13ED               ; {code.loc_13ed}
13F2: 36 3F           LD      (HL),$3F            
13F4: 06 05           LD      B,$05               
13F6: 21 A5 61        LD      HL,$61A5            
13F9: 11 C7 61        LD      DE,$61C7            

loc_13fc:
13FC: 1A              LD      A,(DE)              
13FD: 96              SUB     (HL)                
13FE: 23              INC     HL                  
13FF: 13              INC     DE                  
1400: 1A              LD      A,(DE)              
1401: 9E              SBC     A,(HL)              
1402: 23              INC     HL                  
1403: 13              INC     DE                  
1404: 1A              LD      A,(DE)              
1405: 9E              SBC     A,(HL)              
1406: D8              RET     C                   
1407: C5              PUSH    BC                  
1408: 06 19           LD      B,$19               

loc_140a:
140A: 4E              LD      C,(HL)              
140B: 1A              LD      A,(DE)              
140C: 77              LD      (HL),A              
140D: 79              LD      A,C                 
140E: 12              LD      (DE),A              
140F: 2B              DEC     HL                  
1410: 1B              DEC     DE                  
1411: 10 F7           DJNZ    $140A               ; {code.loc_140a}
1413: 01 F5 FF        LD      BC,$FFF5            
1416: 09              ADD     HL,BC               
1417: EB              EX      DE,HL               
1418: 09              ADD     HL,BC               
1419: EB              EX      DE,HL               
141A: C1              POP     BC                  
141B: 10 DF           DJNZ    $13FC               ; {code.loc_13fc}
141D: C9              RET                         

selectPlayerScreenOrAttract:
141E: CD 16 06        CALL    $0616               ; {code.drawCreditDisplay}
1421: DF              RST     $18                 
1422: CD 74 08        CALL    $0874               ; {code.clearPlayfieldAndSprites}
1425: 3E 00           LD      A,$00               
1427: 32 0E 60        LD      ($600E),A           ; {ram.activePlayerIndex}
142A: 32 0D 60        LD      ($600D),A           ; {ram.currentPlayer}
142D: 21 1C 61        LD      HL,$611C            
1430: 11 22 00        LD      DE,$0022            
1433: 06 05           LD      B,$05               
1435: 3E 01           LD      A,$01               

loc_1437:
1437: BE              CP      (HL)                
1438: CA 59 14        JP      Z,$1459             ; {code.configureFlipScreenAndComposeScreen}
143B: 19              ADD     HL,DE               
143C: 10 F9           DJNZ    $1437               ; {code.loc_1437}
143E: 21 1C 61        LD      HL,$611C            
1441: 06 05           LD      B,$05               
1443: 3E 03           LD      A,$03               

loc_1445:
1445: BE              CP      (HL)                
1446: CA 4F 14        JP      Z,$144F             ; {code.selectPlayer2AndComposeScreen}
1449: 19              ADD     HL,DE               
144A: 10 F9           DJNZ    $1445               ; {code.loc_1445}
144C: C3 75 14        JP      $1475               ; {code.enterAttractMode}

selectPlayer2AndComposeScreen:
144F: 3E 01           LD      A,$01               
1451: 32 0E 60        LD      ($600E),A           ; {ram.activePlayerIndex}
1454: 32 0D 60        LD      ($600D),A           ; {ram.currentPlayer}
1457: 3E 00           LD      A,$00               

configureFlipScreenAndComposeScreen:
1459: 21 26 60        LD      HL,$6026            
145C: B6              OR      (HL)                
145D: 32 82 7D        LD      ($7D82),A           ; {hard.flipScreen}
1460: 3E 00           LD      A,$00               
1462: 32 09 60        LD      ($6009),A           ; {ram.substateTimer}
1465: 21 0A 60        LD      HL,$600A            
1468: 34              INC     (HL)                
1469: 11 0D 03        LD      DE,$030D            
146C: 06 0C           LD      B,$0C               

loc_146e:
146E: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
1471: 13              INC     DE                  
1472: 10 FA           DJNZ    $146E               ; {code.loc_146e}
1474: C9              RET                         

enterAttractMode:
1475: 3E 01           LD      A,$01               
1477: 32 82 7D        LD      ($7D82),A           ; {hard.flipScreen}
147A: 32 05 60        LD      ($6005),A           ; {ram.gameState}
147D: 32 07 60        LD      ($6007),A           ; {ram.attract}
1480: 3E 00           LD      A,$00               
1482: 32 0A 60        LD      ($600A),A           ; {ram.gameSubstate}
1485: C9              RET                         

runBonusItemValueDisplay:
1486: CD 16 06        CALL    $0616               ; {code.drawCreditDisplay}
1489: 21 09 60        LD      HL,$6009            
148C: 7E              LD      A,(HL)              
148D: A7              AND     A                   
148E: C2 DC 14        JP      NZ,$14DC            ; {code.loc_14dc}
1491: 32 86 7D        LD      ($7D86),A           ; {hard.paletteBank0}
1494: 32 87 7D        LD      ($7D87),A           ; {hard.paletteBank1}
1497: 36 01           LD      (HL),$01            
1499: 21 30 60        LD      HL,$6030            
149C: 36 0A           LD      (HL),$0A            
149E: 23              INC     HL                  
149F: 36 00           LD      (HL),$00            
14A1: 23              INC     HL                  
14A2: 36 10           LD      (HL),$10            
14A4: 23              INC     HL                  
14A5: 36 1E           LD      (HL),$1E            
14A7: 23              INC     HL                  
14A8: 36 3E           LD      (HL),$3E            
14AA: 23              INC     HL                  
14AB: 36 00           LD      (HL),$00            
14AD: 21 E8 75        LD      HL,$75E8            
14B0: 22 36 60        LD      ($6036),HL          ; {hard.workRam+36}
14B3: 21 1C 61        LD      HL,$611C            
14B6: 3A 0E 60        LD      A,($600E)           ; {ram.activePlayerIndex}
14B9: 07              RLCA                        
14BA: 3C              INC     A                   
14BB: 4F              LD      C,A                 
14BC: 11 22 00        LD      DE,$0022            
14BF: 06 04           LD      B,$04               

loc_14c1:
14C1: 7E              LD      A,(HL)              
14C2: B9              CP      C                   
14C3: CA C9 14        JP      Z,$14C9             ; {code.loc_14c9}
14C6: 19              ADD     HL,DE               
14C7: 10 F8           DJNZ    $14C1               ; {code.loc_14c1}

loc_14c9:
14C9: 22 38 60        LD      ($6038),HL          ; {hard.workRam+38}
14CC: 11 F3 FF        LD      DE,$FFF3            
14CF: 19              ADD     HL,DE               
14D0: 22 3A 60        LD      ($603A),HL          ; {hard.workRam+3A}
14D3: 06 00           LD      B,$00               
14D5: 3A 35 60        LD      A,($6035)           ; {hard.workRam+35}
14D8: 4F              LD      C,A                 
14D9: CD FA 15        CALL    $15FA               ; {code.positionBonusItemSprite}

loc_14dc:
14DC: 21 34 60        LD      HL,$6034            
14DF: 35              DEC     (HL)                
14E0: C2 FC 14        JP      NZ,$14FC            ; {code.loc_14fc}
14E3: 36 3E           LD      (HL),$3E            
14E5: 2B              DEC     HL                  
14E6: 35              DEC     (HL)                
14E7: CA C6 15        JP      Z,$15C6             ; {code.loc_15c6}
14EA: 7E              LD      A,(HL)              
14EB: 06 FF           LD      B,$FF               

loc_14ed:
14ED: 04              INC     B                   
14EE: D6 0A           SUB     $0A                 
14F0: D2 ED 14        JP      NC,$14ED            ; {code.loc_14ed}
14F3: C6 0A           ADD     A,$0A               
14F5: 32 52 75        LD      ($7552),A           ; {hard.videoRam+152}
14F8: 78              LD      A,B                 
14F9: 32 72 75        LD      ($7572),A           ; {hard.videoRam+172}

loc_14fc:
14FC: 21 30 60        LD      HL,$6030            
14FF: 46              LD      B,(HL)              
1500: 36 0A           LD      (HL),$0A            
1502: 3A 10 60        LD      A,($6010)           ; {ram.p1Input}
1505: CB 7F           BIT     7,A                 
1507: C2 46 15        JP      NZ,$1546            ; {code.loc_1546}
150A: E6 03           AND     $03                 
150C: C2 14 15        JP      NZ,$1514            ; {code.loc_1514}
150F: 3C              INC     A                   
1510: 77              LD      (HL),A              
1511: C3 8A 15        JP      $158A               ; {code.loc_158a}

loc_1514:
1514: 05              DEC     B                   
1515: CA 1D 15        JP      Z,$151D             ; {code.loc_151d}
1518: 78              LD      A,B                 
1519: 77              LD      (HL),A              
151A: C3 8A 15        JP      $158A               ; {code.loc_158a}

loc_151d:
151D: CB 4F           BIT     1,A                 
151F: C2 39 15        JP      NZ,$1539            ; {code.loc_1539}
1522: 3A 35 60        LD      A,($6035)           ; {hard.workRam+35}
1525: 3C              INC     A                   
1526: FE 1E           CP      $1E                 
1528: C2 2D 15        JP      NZ,$152D            ; {code.loc_152d}
152B: 3E 00           LD      A,$00               

loc_152d:
152D: 32 35 60        LD      ($6035),A           ; {hard.workRam+35}
1530: 4F              LD      C,A                 
1531: 06 00           LD      B,$00               
1533: CD FA 15        CALL    $15FA               ; {code.positionBonusItemSprite}
1536: C3 8A 15        JP      $158A               ; {code.loc_158a}

loc_1539:
1539: 3A 35 60        LD      A,($6035)           ; {hard.workRam+35}
153C: D6 01           SUB     $01                 
153E: F2 2D 15        JP      P,$152D             ; {code.loc_152d}
1541: 3E 1D           LD      A,$1D               
1543: C3 2D 15        JP      $152D               ; {code.loc_152d}

loc_1546:
1546: 3A 35 60        LD      A,($6035)           ; {hard.workRam+35}
1549: FE 1C           CP      $1C                 
154B: CA 6D 15        JP      Z,$156D             ; {code.loc_156d}
154E: FE 1D           CP      $1D                 
1550: CA C6 15        JP      Z,$15C6             ; {code.loc_15c6}
1553: 2A 36 60        LD      HL,($6036)          ; {hard.workRam+36}
1556: 01 88 75        LD      BC,$7588            
1559: A7              AND     A                   
155A: ED 42           SBC     HL,BC               
155C: CA 8A 15        JP      Z,$158A             ; {code.loc_158a}
155F: 09              ADD     HL,BC               
1560: C6 11           ADD     A,$11               
1562: 77              LD      (HL),A              
1563: 01 E0 FF        LD      BC,$FFE0            
1566: 09              ADD     HL,BC               

loc_1567:
1567: 22 36 60        LD      ($6036),HL          ; {hard.workRam+36}
156A: C3 8A 15        JP      $158A               ; {code.loc_158a}

loc_156d:
156D: 2A 36 60        LD      HL,($6036)          ; {hard.workRam+36}
1570: 01 20 00        LD      BC,$0020            
1573: 09              ADD     HL,BC               
1574: A7              AND     A                   
1575: 01 08 76        LD      BC,$7608            
1578: ED 42           SBC     HL,BC               
157A: C2 86 15        JP      NZ,$1586            ; {code.loc_1586}
157D: 21 E8 75        LD      HL,$75E8            

loc_1580:
1580: 3E 10           LD      A,$10               
1582: 77              LD      (HL),A              
1583: C3 67 15        JP      $1567               ; {code.loc_1567}

loc_1586:
1586: 09              ADD     HL,BC               
1587: C3 80 15        JP      $1580               ; {code.loc_1580}

loc_158a:
158A: 21 32 60        LD      HL,$6032            
158D: 35              DEC     (HL)                
158E: C2 F9 15        JP      NZ,$15F9            ; {code.loc_15f9}
1591: 3A 31 60        LD      A,($6031)           ; {hard.workRam+31}
1594: A7              AND     A                   
1595: C2 B8 15        JP      NZ,$15B8            ; {code.loc_15b8}
1598: 3E 01           LD      A,$01               
159A: 32 31 60        LD      ($6031),A           ; {hard.workRam+31}
159D: 11 BF 01        LD      DE,$01BF            

loc_15a0:
15A0: FD 2A 38 60     LD      IY,($6038)          ; {hard.workRam+38}
15A4: FD 6E 04        LD      L,(IY+$04)          
15A7: FD 66 05        LD      H,(IY+$05)          
15AA: E5              PUSH    HL                  
15AB: DD E1           POP     IX                  
15AD: CD 7C 05        CALL    $057C               ; {code.renderBcdColumn}
15B0: 3E 10           LD      A,$10               
15B2: 32 32 60        LD      ($6032),A           ; {hard.workRam+32}
15B5: C3 F9 15        JP      $15F9               ; {code.loc_15f9}

loc_15b8:
15B8: AF              XOR     A                   
15B9: 32 31 60        LD      ($6031),A           ; {hard.workRam+31}
15BC: ED 5B 38 60     LD      DE,($6038)          ; {hard.workRam+38}
15C0: 13              INC     DE                  
15C1: 13              INC     DE                  
15C2: 13              INC     DE                  
15C3: C3 A0 15        JP      $15A0               ; {code.loc_15a0}

loc_15c6:
15C6: ED 5B 38 60     LD      DE,($6038)          ; {hard.workRam+38}
15CA: AF              XOR     A                   
15CB: 12              LD      (DE),A              
15CC: 21 09 60        LD      HL,$6009            
15CF: 36 80           LD      (HL),$80            
15D1: 23              INC     HL                  
15D2: 35              DEC     (HL)                
15D3: 06 0C           LD      B,$0C               
15D5: 21 E8 75        LD      HL,$75E8            
15D8: FD 2A 3A 60     LD      IY,($603A)          ; {hard.workRam+3A}
15DC: 11 E0 FF        LD      DE,$FFE0            

loc_15df:
15DF: 7E              LD      A,(HL)              
15E0: FD 77 00        LD      (IY+$00),A          
15E3: FD 23           INC     IY                  
15E5: 19              ADD     HL,DE               
15E6: 10 F7           DJNZ    $15DF               ; {code.loc_15df}
15E8: 06 05           LD      B,$05               
15EA: 11 14 03        LD      DE,$0314            

loc_15ed:
15ED: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
15F0: 13              INC     DE                  
15F1: 10 FA           DJNZ    $15ED               ; {code.loc_15ed}
15F3: 11 1A 03        LD      DE,$031A            
15F6: CD 9F 30        CALL    $309F               ; {code.enqueueTask}

loc_15f9:
15F9: C9              RET                         

positionBonusItemSprite:
15FA: D5              PUSH    DE                  
15FB: E5              PUSH    HL                  
15FC: CB 21           SLA     C                   
15FE: 21 0F 36        LD      HL,$360F            
1601: 09              ADD     HL,BC               
1602: EB              EX      DE,HL               
1603: 21 74 69        LD      HL,$6974            
1606: 1A              LD      A,(DE)              
1607: 13              INC     DE                  
1608: 77              LD      (HL),A              
1609: 23              INC     HL                  
160A: 36 72           LD      (HL),$72            
160C: 23              INC     HL                  
160D: 36 0C           LD      (HL),$0C            
160F: 23              INC     HL                  
1610: 1A              LD      A,(DE)              
1611: 77              LD      (HL),A              
1612: E1              POP     HL                  
1613: D1              POP     DE                  
1614: C9              RET                         

dispatchBoardClearedInterlude:
1615: CD BD 30        CALL    $30BD               ; {code.clearSpriteColumns}
1618: 3A 27 62        LD      A,($6227)           ; {ram.board}
161B: 0F              RRCA                        
161C: D2 2F 16        JP      NC,$162F            ; {code.loc_162f}
161F: 3A 88 63        LD      A,($6388)           ; {ram.boardAdvanceStep}
1622: EF              RST     $28                 

; ---- $1623-$162E: jump table ----
1623: 54 16 70 16 8A 16 32 17 57 17 8E 17

loc_162f:
162F: 0F              RRCA                        
1630: D2 41 16        JP      NC,$1641            ; {code.runRivetBoardInterludeFrame}
1633: 3A 88 63        LD      A,($6388)           ; {ram.boardAdvanceStep}
1636: EF              RST     $28                 

; ---- $1637-$1640: jump table ----
1637: A3 16 BB 16 32 17 57 17 8E 17

runRivetBoardInterludeFrame:
1641: CD BD 1D        CALL    $1DBD               ; {code.dispatchEffectState}

; ---- $1644-$1653: data ----
1644: 3A 88 63 EF B6 17 69 30 39 18 6F 18 80 18 C6 18

beginKongRecaptureInterlude:
1654: CD 08 17        CALL    $1708               ; {code.spawnInterludeHeart}
1657: 21 5C 38        LD      HL,$385C            
165A: CD 4E 00        CALL    $004E               ; {code.loadSpriteObjectBlock}
165D: 3E 20           LD      A,$20               
165F: 32 09 60        LD      ($6009),A           ; {ram.substateTimer}

advanceInterludeStepAndLiftKongFigure:
1662: 21 88 63        LD      HL,$6388            
1665: 34              INC     (HL)                
1666: 3E 01           LD      A,$01               
1668: F7              RST     $30                 
1669: 21 0B 69        LD      HL,$690B            
166C: 0E FC           LD      C,$FC               
166E: FF              RST     $38                 
166F: C9              RET                         

stageNextKongPoseWhenHoldExpires:
1670: DF              RST     $18                 
1671: 21 32 39        LD      HL,$3932            
1674: CD 4E 00        CALL    $004E               ; {code.loadSpriteObjectBlock}
1677: 3E 20           LD      A,$20               
1679: 32 09 60        LD      ($6009),A           ; {ram.substateTimer}
167C: 21 88 63        LD      HL,$6388            
167F: 34              INC     (HL)                
1680: 3E 04           LD      A,$04               
1682: F7              RST     $30                 
1683: 21 0B 69        LD      HL,$690B            
1686: 0E 04           LD      C,$04               
1688: FF              RST     $38                 
1689: C9              RET                         

stageKongClimbPose:
168A: DF              RST     $18                 
168B: 21 8C 38        LD      HL,$388C            
168E: CD 4E 00        CALL    $004E               ; {code.loadSpriteObjectBlock}
1691: 3E 66           LD      A,$66               
1693: 32 0C 69        LD      ($690C),A           ; {hard.workRam+90C}
1696: AF              XOR     A                   
1697: 32 24 69        LD      ($6924),A           ; {hard.workRam+924}
169A: 32 2C 69        LD      ($692C),A           ; {hard.workRam+92C}
169D: 32 AF 62        LD      ($62AF),A           ; {hard.workRam+2AF}
16A0: C3 62 16        JP      $1662               ; {code.advanceInterludeStepAndLiftKongFigure}

begin50mKongRecaptureInterlude:
16A3: CD 08 17        CALL    $1708               ; {code.spawnInterludeHeart}
16A6: 3A 10 69        LD      A,($6910)           ; {hard.workRam+910}
16A9: D6 3B           SUB     $3B                 
16AB: 21 5C 38        LD      HL,$385C            
16AE: CD 4E 00        CALL    $004E               ; {code.loadSpriteObjectBlock}
16B1: 21 08 69        LD      HL,$6908            
16B4: 4F              LD      C,A                 
16B5: FF              RST     $38                 
16B6: 21 88 63        LD      HL,$6388            
16B9: 34              INC     (HL)                
16BA: C9              RET                         

dispatchKongWalkFrame:
16BB: AF              XOR     A                   
16BC: 32 A0 62        LD      ($62A0),A           ; {ram.m50Obj1ReverseTimer}
16BF: 3A A3 63        LD      A,($63A3)           ; {ram.m50Obj1Step}
16C2: 4F              LD      C,A                 
16C3: 3A 10 69        LD      A,($6910)           ; {hard.workRam+910}
16C6: FE 5A           CP      $5A                 
16C8: D2 E1 16        JP      NC,$16E1            ; {code.endKongWalkAndAdvanceInterlude}
16CB: CB 79           BIT     7,C                 
16CD: CA D5 16        JP      Z,$16D5             ; {code.stepKongWalk}

loc_16d0:
16D0: 3E 01           LD      A,$01               
16D2: 32 A0 62        LD      ($62A0),A           ; {ram.m50Obj1ReverseTimer}

stepKongWalk:
16D5: CD 02 26        CALL    $2602               ; {code.loc_2602}
16D8: 3A A3 63        LD      A,($63A3)           ; {ram.m50Obj1Step}
16DB: 4F              LD      C,A                 
16DC: 21 08 69        LD      HL,$6908            
16DF: FF              RST     $38                 
16E0: C9              RET                         

endKongWalkAndAdvanceInterlude:
16E1: FE 5D           CP      $5D                 
16E3: DA EE 16        JP      C,$16EE             ; {code.reloadObjectBlockAndAdvanceStep}
16E6: CB 79           BIT     7,C                 
16E8: CA D0 16        JP      Z,$16D0             ; {code.loc_16d0}
16EB: C3 D5 16        JP      $16D5               ; {code.stepKongWalk}

reloadObjectBlockAndAdvanceStep:
16EE: 21 8C 38        LD      HL,$388C            
16F1: CD 4E 00        CALL    $004E               ; {code.loadSpriteObjectBlock}
16F4: 3E 66           LD      A,$66               
16F6: 32 0C 69        LD      ($690C),A           ; {hard.workRam+90C}
16F9: AF              XOR     A                   
16FA: 32 24 69        LD      ($6924),A           ; {hard.workRam+924}
16FD: 32 2C 69        LD      ($692C),A           ; {hard.workRam+92C}
1700: 32 AF 62        LD      ($62AF),A           ; {hard.workRam+2AF}
1703: 21 88 63        LD      HL,$6388            
1706: 34              INC     (HL)                
1707: C9              RET                         

spawnInterludeHeart:
1708: CD 1C 01        CALL    $011C               ; {code.silenceSound}
170B: 21 20 6A        LD      HL,$6A20            
170E: 36 80           LD      (HL),$80            
1710: 23              INC     HL                  
1711: 36 76           LD      (HL),$76            
1713: 23              INC     HL                  
1714: 36 09           LD      (HL),$09            
1716: 23              INC     HL                  
1717: 36 20           LD      (HL),$20            
1719: 21 05 69        LD      HL,$6905            
171C: 36 13           LD      (HL),$13            
171E: 21 C4 75        LD      HL,$75C4            
1721: 11 20 00        LD      DE,$0020            
1724: 3E 10           LD      A,$10               
1726: CD 14 05        CALL    $0514               ; {code.fillDescendingColumn}
1729: 21 8A 60        LD      HL,$608A            
172C: 36 07           LD      (HL),$07            
172E: 23              INC     HL                  
172F: 36 03           LD      (HL),$03            
1731: C9              RET                         

climbKongFigureAndBreakHeart:
1732: CD 6F 30        CALL    $306F               ; {code.animateSpriteObjectBlock}
1735: 3A 13 69        LD      A,($6913)           ; {hard.workRam+913}
1738: FE 2C           CP      $2C                 
173A: D0              RET     NC                  
173B: AF              XOR     A                   
173C: 32 00 69        LD      ($6900),A           ; {ram.spriteBuffer}
173F: 32 04 69        LD      ($6904),A           ; {hard.workRam+904}
1742: 32 0C 69        LD      ($690C),A           ; {hard.workRam+90C}
1745: 3E 6B           LD      A,$6B               
1747: 32 24 69        LD      ($6924),A           ; {hard.workRam+924}
174A: 3D              DEC     A                   
174B: 32 2C 69        LD      ($692C),A           ; {hard.workRam+92C}
174E: 21 21 6A        LD      HL,$6A21            
1751: 34              INC     (HL)                
1752: 21 88 63        LD      HL,$6388            
1755: 34              INC     (HL)                
1756: C9              RET                         

advanceBoardStepWhenSpritesCleared:
1757: CD 6F 30        CALL    $306F               ; {code.animateSpriteObjectBlock}
175A: CD 6C 17        CALL    $176C               ; {code.cullSpriteObjectsAtTop}
175D: 23              INC     HL                  
175E: 13              INC     DE                  
175F: CD 83 17        CALL    $1783               ; {code.allSlotsClear}
1762: 3E 40           LD      A,$40               
1764: 32 09 60        LD      ($6009),A           ; {ram.substateTimer}
1767: 21 88 63        LD      HL,$6388            
176A: 34              INC     (HL)                
176B: C9              RET                         

cullSpriteObjectsAtTop:
176C: 11 03 00        LD      DE,$0003            
176F: 21 2F 69        LD      HL,$692F            
1772: 06 0A           LD      B,$0A               

loc_1774:
1774: A7              AND     A                   
1775: 7E              LD      A,(HL)              
1776: ED 52           SBC     HL,DE               
1778: FE 19           CP      $19                 
177A: D2 7F 17        JP      NC,$177F            ; {code.loc_177f}
177D: 36 00           LD      (HL),$00            

loc_177f:
177F: 2B              DEC     HL                  
1780: 10 F2           DJNZ    $1774               ; {code.loc_1774}
1782: C9              RET                         

allSlotsClear:
1783: 06 0A           LD      B,$0A               

loc_1785:
1785: 7E              LD      A,(HL)              
1786: A7              AND     A                   
1787: C2 26 00        JP      NZ,$0026            ; {code.loc_0026}
178A: 19              ADD     HL,DE               
178B: 10 F8           DJNZ    $1785               ; {code.loc_1785}
178D: C9              RET                         

advanceToNextBoard:
178E: DF              RST     $18                 
178F: 2A 2A 62        LD      HL,($622A)          ; {ram.boardSeqPtr}
1792: 23              INC     HL                  
1793: 7E              LD      A,(HL)              
1794: FE 7F           CP      $7F                 
1796: C2 9D 17        JP      NZ,$179D            ; {code.loc_179d}
1799: 21 73 3A        LD      HL,$3A73            
179C: 7E              LD      A,(HL)              

loc_179d:
179D: 22 2A 62        LD      ($622A),HL          ; {ram.boardSeqPtr}
17A0: 32 27 62        LD      ($6227),A           ; {ram.board}
17A3: 11 00 05        LD      DE,$0500            
17A6: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
17A9: AF              XOR     A                   
17AA: 32 88 63        LD      ($6388),A           ; {ram.boardAdvanceStep}
17AD: 21 09 60        LD      HL,$6009            
17B0: 36 30           LD      (HL),$30            
17B2: 23              INC     HL                  
17B3: 36 08           LD      (HL),$08            
17B5: C9              RET                         

; ---- $17B6-$1825: data ----
17B6: 00 CD 1C 01 21 8A 60 36 0E 23 36 03 3E 10 11 20
17C6: 00 21 23 76 CD 14 05 21 83 75 CD 14 05 21 DA 76
17D6: CD 26 18 11 47 3A CD A7 0D 21 D5 76 CD 26 18 11
17E6: 4D 3A CD A7 0D 21 D0 76 CD 26 18 11 53 3A CD A7
17F6: 0D 21 CB 76 CD 26 18 11 59 3A CD A7 0D 21 5C 38
1806: CD 4E 00 21 08 69 0E 44 FF 21 05 69 36 13 3E 20
1816: 32 09 60 3E 80 32 90 63 21 88 63 34 22 C0 63 C9

fillTileBlock:
1826: 11 DB FF        LD      DE,$FFDB            
1829: 0E 0E           LD      C,$0E               
182B: 3E 10           LD      A,$10               

loc_182d:
182D: 06 05           LD      B,$05               

loc_182f:
182F: 77              LD      (HL),A              
1830: 23              INC     HL                  
1831: 10 FC           DJNZ    $182F               ; {code.loc_182f}
1833: 19              ADD     HL,DE               
1834: 0D              DEC     C                   
1835: C2 2D 18        JP      NZ,$182D            ; {code.loc_182d}
1838: C9              RET                         

; ---- $1839-$196A: data ----
1839: 21 90 63 34 CA 59 18 7E E6 07 C0 11 CF 39 CB 5E
1849: 20 03 11 F7 39 EB CD 4E 00 21 08 69 0E 44 FF C9
1859: 21 5C 38 CD 4E 00 21 08 69 0E 44 FF 3E 20 32 09
1869: 60 21 88 63 34 C9 DF 21 1F 3A CD 4E 00 3E 03 32
1879: 84 60 21 88 63 34 C9 21 0B 69 0E 01 FF 3A 1B 69
1889: FE D0 C0 3E 20 32 19 69 21 24 6A 36 7F 2C 36 39
1899: 2C 36 01 2C 36 D8 21 C6 76 CD 26 18 11 5F 3A CD
18A9: A7 0D 11 04 00 01 28 02 21 03 69 CD 3D 00 3E 00
18B9: 32 AF 62 3E 03 32 82 60 21 88 63 34 C9 21 AF 62
18C9: 35 CA 3D 19 7E E6 07 C0 21 25 6A 7E EE 80 77 21
18D9: 19 69 46 CB A8 AF CD 09 30 F6 20 77 21 AF 62 7E
18E9: FE E0 C2 10 19 3E 50 32 4F 69 3E 00 32 4D 69 3E
18F9: 9F 32 4C 69 3A 03 62 FE 80 D2 0F 19 3E 80 32 4D
1909: 69 3E 5F 32 4C 69 7E FE C0 C0 21 8A 60 36 0C 3A
1919: 29 62 0F 38 02 36 05 23 36 03 21 23 6A 36 40 2B
1929: 36 09 2B 36 76 2B 36 8F 3A 03 62 FE 80 D0 3E 6F
1939: 32 20 6A C9 2A 2A 62 23 7E FE 7F C2 4B 19 21 73
1949: 3A 7E 22 2A 62 32 27 62 21 29 62 34 11 00 05 CD
1959: 9F 30 AF 32 2E 62 32 88 63 21 09 60 36 E0 23 36
1969: 08 C9

clearScreenAndSelectSubstate:
196B: CD 52 08        CALL    $0852               ; {code.clearTilemapAndSprites}
196E: 3A 0E 60        LD      A,($600E)           ; {ram.activePlayerIndex}
1971: C6 12           ADD     A,$12               
1973: 32 0A 60        LD      ($600A),A           ; {ram.gameSubstate}
1976: C9              RET                         

runAttractDemoFrame:
1977: CD EE 21        CALL    $21EE               ; {code.advanceAttractDemoInput}

runGameplayFrame:
197A: CD BD 1D        CALL    $1DBD               ; {code.dispatchEffectState}

loc_197d:
197D: CD 8C 1E        CALL    $1E8C               ; {code.runHitEffectInsteadOfPlay}

loc_1980:
1980: CD C3 1A        CALL    $1AC3               ; {code.dispatchMarioMovement}
1983: CD 72 1F        CALL    $1F72               ; {code.update25mBarrels}
1986: CD 8F 2C        CALL    $2C8F               ; {code.driveBarrelRelease}
1989: CD 03 2C        CALL    $2C03               ; {code.scheduleBarrelRelease}
198C: CD ED 30        CALL    $30ED               ; {code.updateFires}

; ---- $198F-$19D1: data ----
198F: CD 04 2E CD EA 24 CD DB 2D CD D4 2E CD 07 22 CD
199F: 33 1A CD 85 2A CD 46 1F CD FA 26 CD F2 25 CD DA
19AF: 19 CD FB 03 CD 08 28 CD 1D 28 CD 57 1E CD 07 1A
19BF: CD CB 2F 00 00 00 3A 00 62 A7 C0 CD 1C 01 21 82
19CF: 60 36 03

advanceSubstateAndArmTimer:
19D2: 21 0A 60        LD      HL,$600A            
19D5: 34              INC     (HL)                
19D6: 2B              DEC     HL                  
19D7: 36 40           LD      (HL),$40            
19D9: C9              RET                         

scanObjectsAtMarioX:
19DA: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
19DD: 06 03           LD      B,$03               
19DF: 21 0C 6A        LD      HL,$6A0C            

loc_19e2:
19E2: BE              CP      (HL)                
19E3: CA ED 19        JP      Z,$19ED             ; {code.confirmObjectHit}
19E6: 2C              INC     L                   
19E7: 2C              INC     L                   
19E8: 2C              INC     L                   
19E9: 2C              INC     L                   
19EA: 10 F6           DJNZ    $19E2               ; {code.loc_19e2}
19EC: C9              RET                         

confirmObjectHit:
19ED: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
19F0: 2C              INC     L                   
19F1: 2C              INC     L                   
19F2: 2C              INC     L                   
19F3: BE              CP      (HL)                
19F4: C0              RET     NZ                  
19F5: 2D              DEC     L                   
19F6: 2D              DEC     L                   
19F7: CB 5E           BIT     3,(HL)              
19F9: C0              RET     NZ                  
19FA: 2D              DEC     L                   
19FB: 22 43 63        LD      ($6343),HL          ; {ram.effectParamPtr}
19FE: AF              XOR     A                   
19FF: 32 42 63        LD      ($6342),A           ; {ram.effectSelect}
1A02: 3C              INC     A                   
1A03: 32 40 63        LD      ($6340),A           ; {ram.effectState}
1A06: C9              RET                         

dispatchBonusExpiredStep:
1A07: 3A 86 63        LD      A,($6386)           ; {ram.bonusExpiredStep}
1A0A: EF              RST     $28                 

; ---- $1A0B-$1A14: jump table ----
1A0B: 1E 1A 15 1A 1F 1A 2A 1A 00 00

startBonusExpiredDelay:
1A15: AF              XOR     A                   
1A16: 32 87 63        LD      ($6387),A           ; {ram.bonusExpiredDelay}
1A19: 3E 02           LD      A,$02               
1A1B: 32 86 63        LD      ($6386),A           ; {ram.bonusExpiredStep}

bonusExpiredIdle:
1A1E: C9              RET                         

advanceBonusExpiredStepWhenDelayExpires:
1A1F: 21 87 63        LD      HL,$6387            
1A22: 35              DEC     (HL)                
1A23: C0              RET     NZ                  
1A24: 3E 03           LD      A,$03               
1A26: 32 86 63        LD      ($6386),A           ; {ram.bonusExpiredStep}
1A29: C9              RET                         

advanceSubstateWhenGrounded:
1A2A: 3A 16 62        LD      A,($6216)           ; {ram.marioAirborne}
1A2D: A7              AND     A                   
1A2E: C0              RET     NZ                  
1A2F: E1              POP     HL                  
1A30: C3 D2 19        JP      $19D2               ; {code.advanceSubstateAndArmTimer}

collectEdgeRivet:
1A33: 3E 08           LD      A,$08               
1A35: F7              RST     $30                 
1A36: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
1A39: FE 4B           CP      $4B                 
1A3B: CA 4B 1A        JP      Z,$1A4B             ; {code.armEdgeRivetPickup}
1A3E: FE B3           CP      $B3                 
1A40: CA 4B 1A        JP      Z,$1A4B             ; {code.armEdgeRivetPickup}
1A43: 3A 91 62        LD      A,($6291)           ; {ram.edgeRivetArmed}
1A46: 3D              DEC     A                   
1A47: CA 51 1A        JP      Z,$1A51             ; {code.loc_1a51}
1A4A: C9              RET                         

armEdgeRivetPickup:
1A4B: 3E 01           LD      A,$01               
1A4D: 32 91 62        LD      ($6291),A           ; {ram.edgeRivetArmed}
1A50: C9              RET                         

loc_1a51:
1A51: 32 91 62        LD      ($6291),A           ; {ram.edgeRivetArmed}
1A54: 47              LD      B,A                 
1A55: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
1A58: 3D              DEC     A                   
1A59: FE D0           CP      $D0                 
1A5B: D0              RET     NC                  
1A5C: 07              RLCA                        
1A5D: D2 62 1A        JP      NC,$1A62            ; {code.loc_1a62}
1A60: CB D0           SET     2,B                 

loc_1a62:
1A62: 07              RLCA                        
1A63: 07              RLCA                        
1A64: D2 69 1A        JP      NC,$1A69            ; {code.loc_1a69}
1A67: CB C8           SET     1,B                 

loc_1a69:
1A69: E6 07           AND     $07                 
1A6B: FE 06           CP      $06                 
1A6D: C2 72 1A        JP      NZ,$1A72            ; {code.loc_1a72}
1A70: CB C8           SET     1,B                 

loc_1a72:
1A72: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
1A75: 07              RLCA                        
1A76: D2 7B 1A        JP      NC,$1A7B            ; {code.loc_1a7b}
1A79: CB C0           SET     0,B                 

loc_1a7b:
1A7B: 21 92 62        LD      HL,$6292            
1A7E: 78              LD      A,B                 
1A7F: 85              ADD     A,L                 
1A80: 6F              LD      L,A                 
1A81: 7E              LD      A,(HL)              
1A82: A7              AND     A                   
1A83: C8              RET     Z                   
1A84: 36 00           LD      (HL),$00            
1A86: 21 90 62        LD      HL,$6290            
1A89: 35              DEC     (HL)                
1A8A: 78              LD      A,B                 
1A8B: 01 05 00        LD      BC,$0005            
1A8E: 1F              RRA                         
1A8F: DA BD 1A        JP      C,$1ABD             ; {code.loc_1abd}
1A92: 21 CB 02        LD      HL,$02CB            

loc_1a95:
1A95: A7              AND     A                   
1A96: CA 9E 1A        JP      Z,$1A9E             ; {code.loc_1a9e}

loc_1a99:
1A99: 09              ADD     HL,BC               
1A9A: 3D              DEC     A                   
1A9B: C2 99 1A        JP      NZ,$1A99            ; {code.loc_1a99}

loc_1a9e:
1A9E: 01 00 74        LD      BC,$7400            
1AA1: 09              ADD     HL,BC               
1AA2: 3E 10           LD      A,$10               
1AA4: 77              LD      (HL),A              
1AA5: 2D              DEC     L                   
1AA6: 77              LD      (HL),A              
1AA7: 2C              INC     L                   
1AA8: 2C              INC     L                   
1AA9: 77              LD      (HL),A              
1AAA: 3E 01           LD      A,$01               
1AAC: 32 40 63        LD      ($6340),A           ; {ram.effectState}
1AAF: 32 42 63        LD      ($6342),A           ; {ram.effectSelect}
1AB2: 32 25 62        LD      ($6225),A           ; {ram.itemCollected}
1AB5: 3A 16 62        LD      A,($6216)           ; {ram.marioAirborne}
1AB8: A7              AND     A                   
1AB9: CC 95 1D        CALL    Z,$1D95             ; {code.loc_1d95}
1ABC: C9              RET                         

loc_1abd:
1ABD: 21 2B 01        LD      HL,$012B            
1AC0: C3 95 1A        JP      $1A95               ; {code.loc_1a95}

dispatchMarioMovement:
1AC3: 3A 16 62        LD      A,($6216)           ; {ram.marioAirborne}
1AC6: 3D              DEC     A                   
1AC7: CA B2 1B        JP      Z,$1BB2             ; {code.advanceMarioAirborneFrame}
1ACA: 3A 1E 62        LD      A,($621E)           ; {ram.marioFreezeTimer}
1ACD: A7              AND     A                   
1ACE: C2 55 1B        JP      NZ,$1B55            ; {code.tickPostLandingFreeze}
1AD1: 3A 17 62        LD      A,($6217)           ; {ram.marioHammerActive}
1AD4: 3D              DEC     A                   
1AD5: CA E6 1A        JP      Z,$1AE6             ; {code.walkRightWhileHeld}
1AD8: 3A 15 62        LD      A,($6215)           ; {ram.marioOnLadder}
1ADB: 3D              DEC     A                   
1ADC: CA 38 1B        JP      Z,$1B38             ; {code.climbDownWhileHeld}
1ADF: 3A 10 60        LD      A,($6010)           ; {ram.p1Input}
1AE2: 17              RLA                         
1AE3: DA 6E 1B        JP      C,$1B6E             ; {code.initMarioJump}

walkRightWhileHeld:
1AE6: CD 1F 24        CALL    $241F               ; {code.limitMarioHorizontalTravel}
1AE9: 3A 10 60        LD      A,($6010)           ; {ram.p1Input}
1AEC: 1D              DEC     E                   
1AED: CA F5 1A        JP      Z,$1AF5             ; {code.walkLeftWhileHeld}
1AF0: CB 47           BIT     0,A                 
1AF2: C2 8F 1C        JP      NZ,$1C8F            ; {code.walkMarioRight}

walkLeftWhileHeld:
1AF5: 15              DEC     D                   
1AF6: CA FE 1A        JP      Z,$1AFE             ; {code.armMarioClimbAtLadderEnd}
1AF9: CB 4F           BIT     1,A                 
1AFB: C2 AB 1C        JP      NZ,$1CAB            ; {code.walkMarioLeft}

armMarioClimbAtLadderEnd:
1AFE: 3A 17 62        LD      A,($6217)           ; {ram.marioHammerActive}
1B01: 3D              DEC     A                   
1B02: C8              RET     Z                   
1B03: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
1B06: C6 08           ADD     A,$08               
1B08: 57              LD      D,A                 
1B09: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
1B0C: F6 03           OR      $03                 
1B0E: CB 97           RES     2,A                 
1B10: 01 15 00        LD      BC,$0015            
1B13: CD 6E 23        CALL    $236E               ; {code.findOppositeLadderEnd}
1B16: F5              PUSH    AF                  
1B17: 21 07 62        LD      HL,$6207            
1B1A: 7E              LD      A,(HL)              
1B1B: E6 80           AND     $80                 
1B1D: F6 06           OR      $06                 
1B1F: 77              LD      (HL),A              
1B20: 21 1A 62        LD      HL,$621A            
1B23: 3E 04           LD      A,$04               
1B25: B9              CP      C                   
1B26: 36 01           LD      (HL),$01            
1B28: D2 2C 1B        JP      NC,$1B2C            ; {code.loc_1b2c}
1B2B: 35              DEC     (HL)                

loc_1b2c:
1B2C: F1              POP     AF                  
1B2D: A7              AND     A                   
1B2E: CA 4E 1B        JP      Z,$1B4E             ; {code.loc_1b4e}
1B31: 7E              LD      A,(HL)              
1B32: A7              AND     A                   
1B33: C0              RET     NZ                  
1B34: 2C              INC     L                   
1B35: 72              LD      (HL),D              
1B36: 2C              INC     L                   
1B37: 70              LD      (HL),B              

climbDownWhileHeld:
1B38: 3A 10 60        LD      A,($6010)           ; {ram.p1Input}
1B3B: CB 5F           BIT     3,A                 
1B3D: C2 F2 1C        JP      NZ,$1CF2            ; {code.climbMarioDown}
1B40: 3A 15 62        LD      A,($6215)           ; {ram.marioOnLadder}
1B43: A7              AND     A                   
1B44: C8              RET     Z                   

climbUpWhileHeld:
1B45: 3A 10 60        LD      A,($6010)           ; {ram.p1Input}
1B48: CB 57           BIT     2,A                 
1B4A: C2 03 1D        JP      NZ,$1D03            ; {code.climbMarioUp}
1B4D: C9              RET                         

loc_1b4e:
1B4E: 2C              INC     L                   
1B4F: 70              LD      (HL),B              
1B50: 2C              INC     L                   
1B51: 72              LD      (HL),D              
1B52: C3 45 1B        JP      $1B45               ; {code.climbUpWhileHeld}

tickPostLandingFreeze:
1B55: 21 1E 62        LD      HL,$621E            
1B58: 35              DEC     (HL)                
1B59: C0              RET     NZ                  
1B5A: 3A 18 62        LD      A,($6218)           ; {ram.marioHammerPending}
1B5D: 32 17 62        LD      ($6217),A           ; {ram.marioHammerActive}
1B60: 21 07 62        LD      HL,$6207            
1B63: 7E              LD      A,(HL)              
1B64: E6 80           AND     $80                 
1B66: 77              LD      (HL),A              
1B67: AF              XOR     A                   
1B68: 32 02 62        LD      ($6202),A           ; {ram.marioWalkAnim}
1B6B: C3 A6 1D        JP      $1DA6               ; {code.writeMarioSpriteRecord}

initMarioJump:
1B6E: 3E 01           LD      A,$01               
1B70: 32 16 62        LD      ($6216),A           ; {ram.marioAirborne}
1B73: 21 10 62        LD      HL,$6210            
1B76: 3A 10 60        LD      A,($6010)           ; {ram.p1Input}
1B79: 01 80 00        LD      BC,$0080            
1B7C: 1F              RRA                         
1B7D: DA 8A 1B        JP      C,$1B8A             ; {code.launchMarioJump}
1B80: 01 80 FF        LD      BC,$FF80            
1B83: 1F              RRA                         
1B84: DA 8A 1B        JP      C,$1B8A             ; {code.launchMarioJump}
1B87: 01 00 00        LD      BC,$0000            

launchMarioJump:
1B8A: AF              XOR     A                   
1B8B: 70              LD      (HL),B              
1B8C: 2C              INC     L                   
1B8D: 71              LD      (HL),C              
1B8E: 2C              INC     L                   
1B8F: 36 01           LD      (HL),$01            
1B91: 2C              INC     L                   
1B92: 36 48           LD      (HL),$48            
1B94: 2C              INC     L                   
1B95: 77              LD      (HL),A              
1B96: 32 04 62        LD      ($6204),A           ; {ram.marioXFrac}
1B99: 32 06 62        LD      ($6206),A           ; {ram.marioYFrac}
1B9C: 3A 07 62        LD      A,($6207)           ; {ram.marioSpriteCode}
1B9F: E6 80           AND     $80                 
1BA1: F6 0E           OR      $0E                 
1BA3: 32 07 62        LD      ($6207),A           ; {ram.marioSpriteCode}
1BA6: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
1BA9: 32 0E 62        LD      ($620E),A           ; {ram.marioAirStartY}
1BAC: 21 81 60        LD      HL,$6081            
1BAF: 36 03           LD      (HL),$03            
1BB1: C9              RET                         

advanceMarioAirborneFrame:
1BB2: DD 21 00 62     LD      IX,$6200            
1BB6: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
1BB9: DD 77 0B        LD      (IX+$0B),A          
1BBC: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
1BBF: DD 77 0C        LD      (IX+$0C),A          
1BC2: CD 9C 23        CALL    $239C               ; {code.stepBallisticMotion}
1BC5: CD 1F 24        CALL    $241F               ; {code.limitMarioHorizontalTravel}
1BC8: 15              DEC     D                   
1BC9: C2 F2 1B        JP      NZ,$1BF2            ; {code.loc_1bf2}
1BCC: DD 36 10 00     LD      (IX+$10),$00        
1BD0: DD 36 11 80     LD      (IX+$11),$80        
1BD4: DD CB 07 FE     SET     7,(IX+$07)          

reverseMarioVerticalArc:
1BD8: 3A 20 62        LD      A,($6220)           ; {ram.marioFatalFall}
1BDB: 3D              DEC     A                   
1BDC: CA EC 1B        JP      Z,$1BEC             ; {code.loc_1bec}
1BDF: CD 07 24        CALL    $2407               ; {code.loc_2407}
1BE2: DD 74 12        LD      (IX+$12),H          
1BE5: DD 75 13        LD      (IX+$13),L          
1BE8: DD 36 14 00     LD      (IX+$14),$00        

loc_1bec:
1BEC: CD 9C 23        CALL    $239C               ; {code.stepBallisticMotion}
1BEF: C3 05 1C        JP      $1C05               ; {code.loc_1c05}

loc_1bf2:
1BF2: 1D              DEC     E                   
1BF3: C2 05 1C        JP      NZ,$1C05            ; {code.loc_1c05}
1BF6: DD 36 10 FF     LD      (IX+$10),$FF        
1BFA: DD 36 11 80     LD      (IX+$11),$80        
1BFE: DD CB 07 BE     RES     7,(IX+$07)          
1C02: C3 D8 1B        JP      $1BD8               ; {code.reverseMarioVerticalArc}

loc_1c05:
1C05: CD 1C 2B        CALL    $2B1C               ; {code.loc_2b1c}

loc_1c08:
1C08: 3D              DEC     A                   
1C09: CA 3A 1C        JP      Z,$1C3A             ; {code.loc_1c3a}
1C0C: 3A 1F 62        LD      A,($621F)           ; {ram.marioAirLandcheck}
1C0F: 3D              DEC     A                   
1C10: CA 76 1C        JP      Z,$1C76             ; {code.markFatalFallByHeight}
1C13: 3A 14 62        LD      A,($6214)           ; {ram.marioAirFrames}
1C16: D6 14           SUB     $14                 
1C18: C2 33 1C        JP      NZ,$1C33            ; {code.loc_1c33}
1C1B: 3E 01           LD      A,$01               
1C1D: 32 1F 62        LD      ($621F),A           ; {ram.marioAirLandcheck}
1C20: CD 53 28        CALL    $2853               ; {code.searchPlayerObjectOverlap}

; ---- $1C23-$1C32: data ----
1C23: A7 CA A6 1D 32 42 63 3E 01 32 40 63 32 25 62 00

loc_1c33:
1C33: 3C              INC     A                   
1C34: CC 54 29        CALL    Z,$2954             ; {code.latchHammerTouch}
1C37: C3 A6 1D        JP      $1DA6               ; {code.writeMarioSpriteRecord}

loc_1c3a:
1C3A: 05              DEC     B                   
1C3B: CA 4F 1C        JP      Z,$1C4F             ; {code.settleMarioOnLanding}
1C3E: 3C              INC     A                   
1C3F: 32 1F 62        LD      ($621F),A           ; {ram.marioAirLandcheck}
1C42: AF              XOR     A                   
1C43: 21 10 62        LD      HL,$6210            
1C46: 06 05           LD      B,$05               

loc_1c48:
1C48: 77              LD      (HL),A              
1C49: 2C              INC     L                   
1C4A: 10 FC           DJNZ    $1C48               ; {code.loc_1c48}
1C4C: C3 A6 1D        JP      $1DA6               ; {code.writeMarioSpriteRecord}

settleMarioOnLanding:
1C4F: 32 16 62        LD      ($6216),A           ; {ram.marioAirborne}
1C52: 3A 20 62        LD      A,($6220)           ; {ram.marioFatalFall}
1C55: EE 01           XOR     $01                 
1C57: 32 00 62        LD      ($6200),A           ; {ram.marioActive}
1C5A: 21 07 62        LD      HL,$6207            
1C5D: 7E              LD      A,(HL)              
1C5E: E6 80           AND     $80                 
1C60: F6 0F           OR      $0F                 
1C62: 77              LD      (HL),A              
1C63: 3E 04           LD      A,$04               
1C65: 32 1E 62        LD      ($621E),A           ; {ram.marioFreezeTimer}
1C68: AF              XOR     A                   
1C69: 32 1F 62        LD      ($621F),A           ; {ram.marioAirLandcheck}
1C6C: 3A 25 62        LD      A,($6225)           ; {ram.itemCollected}
1C6F: 3D              DEC     A                   
1C70: CC 95 1D        CALL    Z,$1D95             ; {code.loc_1d95}
1C73: C3 A6 1D        JP      $1DA6               ; {code.writeMarioSpriteRecord}

markFatalFallByHeight:
1C76: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
1C79: 21 0E 62        LD      HL,$620E            
1C7C: D6 0F           SUB     $0F                 
1C7E: BE              CP      (HL)                
1C7F: DA A6 1D        JP      C,$1DA6             ; {code.writeMarioSpriteRecord}
1C82: 3E 01           LD      A,$01               
1C84: 32 20 62        LD      ($6220),A           ; {ram.marioFatalFall}
1C87: 21 84 60        LD      HL,$6084            
1C8A: 36 03           LD      (HL),$03            
1C8C: C3 A6 1D        JP      $1DA6               ; {code.writeMarioSpriteRecord}

walkMarioRight:
1C8F: 06 01           LD      B,$01               
1C91: 3A 0F 62        LD      A,($620F)           ; {ram.marioMoveStepTimer}
1C94: A7              AND     A                   
1C95: C2 D2 1C        JP      NZ,$1CD2            ; {code.advanceMarioWalkX}
1C98: 3A 02 62        LD      A,($6202)           ; {ram.marioWalkAnim}
1C9B: 47              LD      B,A                 
1C9C: 3E 05           LD      A,$05               
1C9E: CD 09 30        CALL    $3009               ; {code.nextAnimationStep}

loc_1ca1:
1CA1: 32 02 62        LD      ($6202),A           ; {ram.marioWalkAnim}
1CA4: E6 03           AND     $03                 
1CA6: F6 80           OR      $80                 
1CA8: C3 C2 1C        JP      $1CC2               ; {code.beginWalkStep}

walkMarioLeft:
1CAB: 06 FF           LD      B,$FF               
1CAD: 3A 0F 62        LD      A,($620F)           ; {ram.marioMoveStepTimer}
1CB0: A7              AND     A                   
1CB1: C2 D2 1C        JP      NZ,$1CD2            ; {code.advanceMarioWalkX}
1CB4: 3A 02 62        LD      A,($6202)           ; {ram.marioWalkAnim}
1CB7: 47              LD      B,A                 
1CB8: 3E 01           LD      A,$01               
1CBA: CD 09 30        CALL    $3009               ; {code.nextAnimationStep}

loc_1cbd:
1CBD: 32 02 62        LD      ($6202),A           ; {ram.marioWalkAnim}
1CC0: E6 03           AND     $03                 

beginWalkStep:
1CC2: 21 07 62        LD      HL,$6207            
1CC5: 77              LD      (HL),A              
1CC6: 1F              RRA                         
1CC7: DC 8F 1D        CALL    C,$1D8F             ; {code.triggerWalkSound}
1CCA: 3E 02           LD      A,$02               
1CCC: 32 0F 62        LD      ($620F),A           ; {ram.marioMoveStepTimer}
1CCF: C3 A6 1D        JP      $1DA6               ; {code.writeMarioSpriteRecord}

advanceMarioWalkX:
1CD2: 21 03 62        LD      HL,$6203            
1CD5: 7E              LD      A,(HL)              
1CD6: 80              ADD     A,B                 
1CD7: 77              LD      (HL),A              
1CD8: 3A 27 62        LD      A,($6227)           ; {ram.board}
1CDB: 3D              DEC     A                   
1CDC: C2 EB 1C        JP      NZ,$1CEB            ; {code.continueWalkStep}
1CDF: 66              LD      H,(HL)              
1CE0: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
1CE3: 6F              LD      L,A                 
1CE4: CD 33 23        CALL    $2333               ; {code.snapYToGirder}

loc_1ce7:
1CE7: 7D              LD      A,L                 
1CE8: 32 05 62        LD      ($6205),A           ; {ram.marioY}

continueWalkStep:
1CEB: 21 0F 62        LD      HL,$620F            
1CEE: 35              DEC     (HL)                
1CEF: C3 A6 1D        JP      $1DA6               ; {code.writeMarioSpriteRecord}

climbMarioDown:
1CF2: 3A 0F 62        LD      A,($620F)           ; {ram.marioMoveStepTimer}
1CF5: A7              AND     A                   
1CF6: C2 8A 1D        JP      NZ,$1D8A            ; {code.tickMoveStepTimer}
1CF9: 3E 03           LD      A,$03               
1CFB: 32 0F 62        LD      ($620F),A           ; {ram.marioMoveStepTimer}
1CFE: 3E 02           LD      A,$02               
1D00: C3 11 1D        JP      $1D11               ; {code.advanceClimbStep}

climbMarioUp:
1D03: 3A 0F 62        LD      A,($620F)           ; {ram.marioMoveStepTimer}
1D06: A7              AND     A                   
1D07: C2 76 1D        JP      NZ,$1D76            ; {code.loc_1d76}
1D0A: 3E 04           LD      A,$04               
1D0C: 32 0F 62        LD      ($620F),A           ; {ram.marioMoveStepTimer}
1D0F: 3E FE           LD      A,$FE               

advanceClimbStep:
1D11: 21 05 62        LD      HL,$6205            
1D14: 86              ADD     A,(HL)              
1D15: 77              LD      (HL),A              
1D16: 47              LD      B,A                 
1D17: 3A 22 62        LD      A,($6222)           ; {hard.workRam+222}
1D1A: EE 01           XOR     $01                 
1D1C: 32 22 62        LD      ($6222),A           ; {hard.workRam+222}
1D1F: C2 51 1D        JP      NZ,$1D51            ; {code.centerMarioAndCommitClimbStep}
1D22: 78              LD      A,B                 
1D23: C6 08           ADD     A,$08               
1D25: 21 1C 62        LD      HL,$621C            
1D28: BE              CP      (HL)                
1D29: CA 67 1D        JP      Z,$1D67             ; {code.endClimbAtLadderLimit}
1D2C: 2D              DEC     L                   
1D2D: 96              SUB     (HL)                
1D2E: CA 67 1D        JP      Z,$1D67             ; {code.endClimbAtLadderLimit}
1D31: 06 05           LD      B,$05               
1D33: D6 08           SUB     $08                 
1D35: CA 3F 1D        JP      Z,$1D3F             ; {code.setClimbSpriteFrame}
1D38: 05              DEC     B                   
1D39: D6 04           SUB     $04                 
1D3B: CA 3F 1D        JP      Z,$1D3F             ; {code.setClimbSpriteFrame}
1D3E: 05              DEC     B                   

setClimbSpriteFrame:
1D3F: 3E 80           LD      A,$80               
1D41: 21 07 62        LD      HL,$6207            
1D44: A6              AND     (HL)                
1D45: EE 80           XOR     $80                 
1D47: B0              OR      B                   
1D48: 77              LD      (HL),A              

markOnLadderAndCommitSprite:
1D49: 3E 01           LD      A,$01               
1D4B: 32 15 62        LD      ($6215),A           ; {ram.marioOnLadder}
1D4E: C3 A6 1D        JP      $1DA6               ; {code.writeMarioSpriteRecord}

centerMarioAndCommitClimbStep:
1D51: 2D              DEC     L                   
1D52: 2D              DEC     L                   
1D53: 7E              LD      A,(HL)              
1D54: F6 03           OR      $03                 
1D56: CB 97           RES     2,A                 
1D58: 77              LD      (HL),A              
1D59: 3A 24 62        LD      A,($6224)           ; {ram.marioClimbSoundToggle}
1D5C: EE 01           XOR     $01                 
1D5E: 32 24 62        LD      ($6224),A           ; {ram.marioClimbSoundToggle}
1D61: CC 8F 1D        CALL    Z,$1D8F             ; {code.triggerWalkSound}
1D64: C3 49 1D        JP      $1D49               ; {code.markOnLadderAndCommitSprite}

endClimbAtLadderLimit:
1D67: 3E 06           LD      A,$06               
1D69: 32 07 62        LD      ($6207),A           ; {ram.marioSpriteCode}
1D6C: AF              XOR     A                   
1D6D: 32 19 62        LD      ($6219),A           ; {hard.workRam+219}
1D70: 32 15 62        LD      ($6215),A           ; {ram.marioOnLadder}
1D73: C3 A6 1D        JP      $1DA6               ; {code.writeMarioSpriteRecord}

loc_1d76:
1D76: 3A 1A 62        LD      A,($621A)           ; {hard.workRam+21A}
1D79: A7              AND     A                   
1D7A: CA 8A 1D        JP      Z,$1D8A             ; {code.tickMoveStepTimer}
1D7D: 32 19 62        LD      ($6219),A           ; {hard.workRam+219}
1D80: 3A 1C 62        LD      A,($621C)           ; {ram.marioClimbLimitB}
1D83: D6 13           SUB     $13                 
1D85: 21 05 62        LD      HL,$6205            
1D88: BE              CP      (HL)                
1D89: D0              RET     NC                  

tickMoveStepTimer:
1D8A: 21 0F 62        LD      HL,$620F            
1D8D: 35              DEC     (HL)                
1D8E: C9              RET                         

triggerWalkSound:
1D8F: 3E 03           LD      A,$03               
1D91: 32 80 60        LD      ($6080),A           ; {ram.sndTrigger}
1D94: C9              RET                         

loc_1d95:
1D95: 32 25 62        LD      ($6225),A           ; {ram.itemCollected}
1D98: 3A 27 62        LD      A,($6227)           ; {ram.board}
1D9B: 3D              DEC     A                   
1D9C: C8              RET     Z                   
1D9D: 21 8A 60        LD      HL,$608A            
1DA0: 36 0D           LD      (HL),$0D            
1DA2: 2C              INC     L                   
1DA3: 36 03           LD      (HL),$03            
1DA5: C9              RET                         

writeMarioSpriteRecord:
1DA6: 21 4C 69        LD      HL,$694C            
1DA9: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
1DAC: 77              LD      (HL),A              
1DAD: 3A 07 62        LD      A,($6207)           ; {ram.marioSpriteCode}
1DB0: 2C              INC     L                   
1DB1: 77              LD      (HL),A              
1DB2: 3A 08 62        LD      A,($6208)           ; {ram.marioSpriteAttr}
1DB5: 2C              INC     L                   
1DB6: 77              LD      (HL),A              
1DB7: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
1DBA: 2C              INC     L                   
1DBB: 77              LD      (HL),A              
1DBC: C9              RET                         

dispatchEffectState:
1DBD: 3A 40 63        LD      A,($6340)           ; {ram.effectState}
1DC0: EF              RST     $28                 

; ---- $1DC1-$1DC8: jump table ----
1DC1: 49 1E C9 1D 4A 1E 00 00

armScorePopupAndSelectAward:
1DC9: 3E 40           LD      A,$40               
1DCB: 32 41 63        LD      ($6341),A           ; {ram.effectTimer}
1DCE: 3E 02           LD      A,$02               
1DD0: 32 40 63        LD      ($6340),A           ; {ram.effectState}
1DD3: 3A 42 63        LD      A,($6342)           ; {ram.effectSelect}
1DD6: 1F              RRA                         
1DD7: DA 70 3E        JP      C,$3E70             ; {code.pickAwardTierByObjectCount}
1DDA: 1F              RRA                         
1DDB: DA 00 1E        JP      C,$1E00             ; {code.stageAward300Popup}
1DDE: 1F              RRA                         
1DDF: DA F5 1D        JP      C,$1DF5             ; {code.pickRandomAwardTier}
1DE2: 21 85 60        LD      HL,$6085            
1DE5: 36 03           LD      (HL),$03            
1DE7: 3A 29 62        LD      A,($6229)           ; {ram.level}
1DEA: 3D              DEC     A                   
1DEB: CA 00 1E        JP      Z,$1E00             ; {code.stageAward300Popup}
1DEE: 3D              DEC     A                   
1DEF: CA 08 1E        JP      Z,$1E08             ; {code.stageAward500Popup}
1DF2: C3 10 1E        JP      $1E10               ; {code.stageAward800Popup}

pickRandomAwardTier:
1DF5: 3A 18 60        LD      A,($6018)           ; {ram.random}
1DF8: 1F              RRA                         
1DF9: DA 08 1E        JP      C,$1E08             ; {code.stageAward500Popup}
1DFC: 1F              RRA                         
1DFD: DA 10 1E        JP      C,$1E10             ; {code.stageAward800Popup}

stageAward300Popup:
1E00: 06 7D           LD      B,$7D               
1E02: 11 03 00        LD      DE,$0003            
1E05: C3 15 1E        JP      $1E15               ; {code.stageAwardPopupAtHitObject}

stageAward500Popup:
1E08: 06 7E           LD      B,$7E               
1E0A: 11 05 00        LD      DE,$0005            
1E0D: C3 15 1E        JP      $1E15               ; {code.stageAwardPopupAtHitObject}

stageAward800Popup:
1E10: 06 7F           LD      B,$7F               
1E12: 11 08 00        LD      DE,$0008            

stageAwardPopupAtHitObject:
1E15: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
1E18: 2A 43 63        LD      HL,($6343)          ; {ram.effectParamPtr}
1E1B: 7E              LD      A,(HL)              
1E1C: 36 00           LD      (HL),$00            
1E1E: 2C              INC     L                   
1E1F: 2C              INC     L                   
1E20: 2C              INC     L                   
1E21: 4E              LD      C,(HL)              
1E22: C3 36 1E        JP      $1E36               ; {code.stampScorePopupSprite}

; ---- $1E25-$1E27: data ----
1E25: 11 01 00

awardScorePopup:
1E28: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
1E2B: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
1E2E: C6 14           ADD     A,$14               
1E30: 4F              LD      C,A                 
1E31: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
1E34: 00              NOP                         
1E35: 00              NOP                         

stampScorePopupSprite:
1E36: 21 30 6A        LD      HL,$6A30            
1E39: 77              LD      (HL),A              
1E3A: 2C              INC     L                   
1E3B: 70              LD      (HL),B              
1E3C: 2C              INC     L                   
1E3D: 36 07           LD      (HL),$07            
1E3F: 2C              INC     L                   
1E40: 71              LD      (HL),C              
1E41: 3E 05           LD      A,$05               
1E43: F7              RST     $30                 
1E44: 21 85 60        LD      HL,$6085            
1E47: 36 03           LD      (HL),$03            

effectStateIdle:
1E49: C9              RET                         

tickDispatcherCountdown:
1E4A: 21 41 63        LD      HL,$6341            
1E4D: 35              DEC     (HL)                
1E4E: C0              RET     NZ                  
1E4F: AF              XOR     A                   
1E50: 32 30 6A        LD      ($6A30),A           ; {ram.popupSprite}
1E53: 32 40 63        LD      ($6340),A           ; {ram.effectState}
1E56: C9              RET                         

checkBoardWonByType:
1E57: 3A 27 62        LD      A,($6227)           ; {ram.board}
1E5A: CB 57           BIT     2,A                 
1E5C: C2 80 1E        JP      NZ,$1E80            ; {code.completeRivetBoardWhenCleared}
1E5F: 1F              RRA                         
1E60: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
1E63: DA 7A 1E        JP      C,$1E7A             ; {code.completeBoardWhenMarioReachesRescueRow}
1E66: FE 51           CP      $51                 
1E68: D0              RET     NC                  
1E69: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
1E6C: 17              RLA                         

loc_1e6d:
1E6D: 3E 00           LD      A,$00               
1E6F: DA 74 1E        JP      C,$1E74             ; {code.loc_1e74}
1E72: 3E 80           LD      A,$80               

loc_1e74:
1E74: 32 4D 69        LD      ($694D),A           ; {hard.workRam+94D}
1E77: C3 85 1E        JP      $1E85               ; {code.enterBoardAdvanceAndUnwind}

completeBoardWhenMarioReachesRescueRow:
1E7A: FE 31           CP      $31                 
1E7C: D0              RET     NC                  
1E7D: C3 6D 1E        JP      $1E6D               ; {code.loc_1e6d}

completeRivetBoardWhenCleared:
1E80: 3A 90 62        LD      A,($6290)           ; {ram.rivetsLeft}
1E83: A7              AND     A                   
1E84: C0              RET     NZ                  

enterBoardAdvanceAndUnwind:
1E85: 3E 16           LD      A,$16               
1E87: 32 0A 60        LD      ($600A),A           ; {ram.gameSubstate}
1E8A: E1              POP     HL                  
1E8B: C9              RET                         

runHitEffectInsteadOfPlay:
1E8C: 3A 50 63        LD      A,($6350)           ; {hard.workRam+350}
1E8F: A7              AND     A                   
1E90: C8              RET     Z                   
1E91: CD 96 1E        CALL    $1E96               ; {code.dispatchEffectSequenceStep}

loc_1e94:
1E94: E1              POP     HL                  
1E95: C9              RET                         

dispatchEffectSequenceStep:
1E96: 3A 45 63        LD      A,($6345)           ; {ram.effectSeqState}
1E99: EF              RST     $28                 

; ---- $1E9A-$1E9F: jump table ----
1E9A: A0 1E 09 1F 23 1F

buildEffectSprite:
1EA0: 3A 52 63        LD      A,($6352)           ; {hard.workRam+352}
1EA3: FE 65           CP      $65                 
1EA5: 21 B8 69        LD      HL,$69B8            
1EA8: CA B4 1E        JP      Z,$1EB4             ; {code.loc_1eb4}
1EAB: 21 D0 69        LD      HL,$69D0            
1EAE: DA B4 1E        JP      C,$1EB4             ; {code.loc_1eb4}
1EB1: 21 80 69        LD      HL,$6980            

loc_1eb4:
1EB4: DD 2A 51 63     LD      IX,($6351)          ; {ram.collidedObjectBase}
1EB8: 16 00           LD      D,$00               
1EBA: 3A 53 63        LD      A,($6353)           ; {ram.collidedObjectStride}
1EBD: 5F              LD      E,A                 
1EBE: 01 04 00        LD      BC,$0004            
1EC1: 3A 54 63        LD      A,($6354)           ; {ram.collidedObjectIndex}
1EC4: A7              AND     A                   
1EC5: CA CF 1E        JP      Z,$1ECF             ; {code.loc_1ecf}

loc_1ec8:
1EC8: 09              ADD     HL,BC               
1EC9: DD 19           ADD     IX,DE               
1ECB: 3D              DEC     A                   
1ECC: C2 C8 1E        JP      NZ,$1EC8            ; {code.loc_1ec8}

loc_1ecf:
1ECF: DD 36 00 00     LD      (IX+$00),$00        
1ED3: DD 7E 15        LD      A,(IX+$15)          
1ED6: A7              AND     A                   
1ED7: 3E 02           LD      A,$02               
1ED9: CA DE 1E        JP      Z,$1EDE             ; {code.loc_1ede}
1EDC: 3E 04           LD      A,$04               

loc_1ede:
1EDE: 32 42 63        LD      ($6342),A           ; {ram.effectSelect}
1EE1: 01 2C 6A        LD      BC,$6A2C            
1EE4: 7E              LD      A,(HL)              
1EE5: 36 00           LD      (HL),$00            
1EE7: 02              LD      (BC),A              
1EE8: 0C              INC     C                   
1EE9: 2C              INC     L                   
1EEA: 3E 60           LD      A,$60               
1EEC: 02              LD      (BC),A              
1EED: 0C              INC     C                   
1EEE: 2C              INC     L                   
1EEF: 3E 0C           LD      A,$0C               
1EF1: 02              LD      (BC),A              
1EF2: 0C              INC     C                   
1EF3: 2C              INC     L                   
1EF4: 7E              LD      A,(HL)              
1EF5: 02              LD      (BC),A              
1EF6: 21 45 63        LD      HL,$6345            
1EF9: 34              INC     (HL)                
1EFA: 2C              INC     L                   
1EFB: 36 06           LD      (HL),$06            
1EFD: 2C              INC     L                   
1EFE: 36 05           LD      (HL),$05            
1F00: 21 8A 60        LD      HL,$608A            
1F03: 36 06           LD      (HL),$06            
1F05: 2C              INC     L                   
1F06: 36 03           LD      (HL),$03            
1F08: C9              RET                         

flashEffectSpriteThenAdvanceSequence:
1F09: 21 46 63        LD      HL,$6346            
1F0C: 35              DEC     (HL)                
1F0D: C0              RET     NZ                  
1F0E: 36 06           LD      (HL),$06            
1F10: 2C              INC     L                   
1F11: 35              DEC     (HL)                
1F12: CA 1D 1F        JP      Z,$1F1D             ; {code.loc_1f1d}
1F15: 21 2D 6A        LD      HL,$6A2D            
1F18: 7E              LD      A,(HL)              
1F19: EE 01           XOR     $01                 
1F1B: 77              LD      (HL),A              
1F1C: C9              RET                         

loc_1f1d:
1F1D: 36 04           LD      (HL),$04            
1F1F: 2D              DEC     L                   
1F20: 2D              DEC     L                   
1F21: 34              INC     (HL)                
1F22: C9              RET                         

animateEffectSpriteThenRearmEffect:
1F23: 21 46 63        LD      HL,$6346            
1F26: 35              DEC     (HL)                
1F27: C0              RET     NZ                  
1F28: 36 0C           LD      (HL),$0C            
1F2A: 2C              INC     L                   
1F2B: 35              DEC     (HL)                
1F2C: CA 34 1F        JP      Z,$1F34             ; {code.loc_1f34}
1F2F: 21 2D 6A        LD      HL,$6A2D            
1F32: 34              INC     (HL)                
1F33: C9              RET                         

loc_1f34:
1F34: 2D              DEC     L                   
1F35: 2D              DEC     L                   
1F36: AF              XOR     A                   
1F37: 77              LD      (HL),A              
1F38: 32 50 63        LD      ($6350),A           ; {hard.workRam+350}
1F3B: 3C              INC     A                   
1F3C: 32 40 63        LD      ($6340),A           ; {ram.effectState}
1F3F: 21 2C 6A        LD      HL,$6A2C            
1F42: 22 43 63        LD      ($6343),HL          ; {ram.effectParamPtr}
1F45: C9              RET                         

beginMarioFall:
1F46: 3A 21 62        LD      A,($6221)           ; {ram.marioStartFall}
1F49: A7              AND     A                   
1F4A: C8              RET     Z                   
1F4B: AF              XOR     A                   
1F4C: 32 04 62        LD      ($6204),A           ; {ram.marioXFrac}
1F4F: 32 06 62        LD      ($6206),A           ; {ram.marioYFrac}
1F52: 32 21 62        LD      ($6221),A           ; {ram.marioStartFall}
1F55: 32 10 62        LD      ($6210),A           ; {ram.marioAirVxHi}
1F58: 32 11 62        LD      ($6211),A           ; {ram.marioAirVxLo}
1F5B: 32 12 62        LD      ($6212),A           ; {ram.marioAirVyHi}
1F5E: 32 13 62        LD      ($6213),A           ; {ram.marioAirVyLo}
1F61: 32 14 62        LD      ($6214),A           ; {ram.marioAirFrames}
1F64: 3C              INC     A                   
1F65: 32 16 62        LD      ($6216),A           ; {ram.marioAirborne}
1F68: 32 1F 62        LD      ($621F),A           ; {ram.marioAirLandcheck}
1F6B: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
1F6E: 32 0E 62        LD      ($620E),A           ; {ram.marioAirStartY}
1F71: C9              RET                         

update25mBarrels:
1F72: 3A 27 62        LD      A,($6227)           ; {ram.board}
1F75: 3D              DEC     A                   
1F76: C0              RET     NZ                  
1F77: DD 21 00 67     LD      IX,$6700            
1F7B: 21 80 69        LD      HL,$6980            
1F7E: 11 20 00        LD      DE,$0020            
1F81: 06 0A           LD      B,$0A               

serviceBarrelSlotIfLive:
1F83: DD 7E 00        LD      A,(IX+$00)          
1F86: 3D              DEC     A                   
1F87: CA 93 1F        JP      Z,$1F93             ; {code.advanceBarrelMotion}
1F8A: 2C              INC     L                   
1F8B: 2C              INC     L                   
1F8C: 2C              INC     L                   

loc_1f8d:
1F8D: 2C              INC     L                   
1F8E: DD 19           ADD     IX,DE               
1F90: 10 F1           DJNZ    $1F83               ; {code.serviceBarrelSlotIfLive}
1F92: C9              RET                         

advanceBarrelMotion:
1F93: DD 7E 01        LD      A,(IX+$01)          
1F96: 3D              DEC     A                   
1F97: CA EC 20        JP      Z,$20EC             ; {code.advanceFallingBarrel}
1F9A: DD 7E 02        LD      A,(IX+$02)          
1F9D: 1F              RRA                         
1F9E: DA AC 1F        JP      C,$1FAC             ; {code.loc_1fac}
1FA1: 1F              RRA                         
1FA2: DA E5 1F        JP      C,$1FE5             ; {code.stepBarrelRight}
1FA5: 1F              RRA                         
1FA6: DA EF 1F        JP      C,$1FEF             ; {code.stepBarrelLeft}
1FA9: C3 53 20        JP      $2053               ; {code.loc_2053}

loc_1fac:
1FAC: D9              EXX                         
1FAD: DD 34 05        INC     (IX+$05)            
1FB0: DD 7E 17        LD      A,(IX+$17)          
1FB3: DD BE 05        CP      (IX+$05)            
1FB6: C2 CE 1F        JP      NZ,$1FCE            ; {code.advanceBarrelTileAnimation}
1FB9: DD 7E 15        LD      A,(IX+$15)          
1FBC: 07              RLCA                        
1FBD: 07              RLCA                        
1FBE: C6 15           ADD     A,$15               
1FC0: DD 77 07        LD      (IX+$07),A          
1FC3: DD 7E 02        LD      A,(IX+$02)          
1FC6: EE 07           XOR     $07                 
1FC8: DD 77 02        LD      (IX+$02),A          
1FCB: C3 BA 21        JP      $21BA               ; {code.publishBarrelSprite}

advanceBarrelTileAnimation:
1FCE: DD 7E 0F        LD      A,(IX+$0F)          
1FD1: 3D              DEC     A                   
1FD2: C2 DF 1F        JP      NZ,$1FDF            ; {code.loc_1fdf}
1FD5: DD 7E 07        LD      A,(IX+$07)          
1FD8: EE 01           XOR     $01                 
1FDA: DD 77 07        LD      (IX+$07),A          
1FDD: 3E 04           LD      A,$04               

loc_1fdf:
1FDF: DD 77 0F        LD      (IX+$0F),A          
1FE2: C3 BA 21        JP      $21BA               ; {code.publishBarrelSprite}

stepBarrelRight:
1FE5: D9              EXX                         
1FE6: 01 00 01        LD      BC,$0100            
1FE9: DD 34 03        INC     (IX+$03)            
1FEC: C3 F6 1F        JP      $1FF6               ; {code.advanceRollingBarrel}

stepBarrelLeft:
1FEF: D9              EXX                         
1FF0: 01 04 FF        LD      BC,$FF04            
1FF3: DD 35 03        DEC     (IX+$03)            

advanceRollingBarrel:
1FF6: DD 66 03        LD      H,(IX+$03)          
1FF9: DD 6E 05        LD      L,(IX+$05)          
1FFC: 7C              LD      A,H                 
1FFD: E6 07           AND     $07                 
1FFF: FE 03           CP      $03                 
2001: CA 5F 21        JP      Z,$215F             ; {code.loc_215f}
2004: 2D              DEC     L                   
2005: 2D              DEC     L                   
2006: 2D              DEC     L                   
2007: CD 33 23        CALL    $2333               ; {code.snapYToGirder}

loc_200a:
200A: 2C              INC     L                   
200B: 2C              INC     L                   
200C: 2C              INC     L                   
200D: 7D              LD      A,L                 
200E: DD 77 05        LD      (IX+$05),A          
2011: CD DE 23        CALL    $23DE               ; {code.advanceBarrelSpriteOrientation}
2014: CD B4 24        CALL    $24B4               ; {code.retireBarrelIntoOilDrum}
2017: DD 7E 03        LD      A,(IX+$03)          
201A: FE 1C           CP      $1C                 
201C: DA 2F 20        JP      C,$202F             ; {code.loc_202f}
201F: FE E4           CP      $E4                 
2021: DA BA 21        JP      C,$21BA             ; {code.publishBarrelSprite}
2024: AF              XOR     A                   
2025: DD 77 10        LD      (IX+$10),A          
2028: DD 36 11 60     LD      (IX+$11),$60        
202C: C3 38 20        JP      $2038               ; {code.loc_2038}

loc_202f:
202F: AF              XOR     A                   
2030: DD 36 10 FF     LD      (IX+$10),$FF        
2034: DD 36 11 A0     LD      (IX+$11),$A0        

loc_2038:
2038: DD 36 12 FF     LD      (IX+$12),$FF        
203C: DD 36 13 F0     LD      (IX+$13),$F0        
2040: DD 77 14        LD      (IX+$14),A          
2043: DD 77 0E        LD      (IX+$0E),A          
2046: DD 77 04        LD      (IX+$04),A          
2049: DD 77 06        LD      (IX+$06),A          
204C: DD 36 02 08     LD      (IX+$02),$08        
2050: C3 BA 21        JP      $21BA               ; {code.publishBarrelSprite}

loc_2053:
2053: D9              EXX                         
2054: CD 9C 23        CALL    $239C               ; {code.stepBallisticMotion}
2057: CD 2F 2A        CALL    $2A2F               ; {code.loc_2a2f}

loc_205a:
205A: A7              AND     A                   
205B: C2 83 20        JP      NZ,$2083            ; {code.loc_2083}
205E: DD 7E 03        LD      A,(IX+$03)          
2061: C6 08           ADD     A,$08               
2063: FE 10           CP      $10                 
2065: DA 79 20        JP      C,$2079             ; {code.loc_2079}
2068: CD B4 24        CALL    $24B4               ; {code.retireBarrelIntoOilDrum}
206B: DD 7E 10        LD      A,(IX+$10)          
206E: E6 01           AND     $01                 
2070: 07              RLCA                        
2071: 07              RLCA                        
2072: 4F              LD      C,A                 
2073: CD DE 23        CALL    $23DE               ; {code.advanceBarrelSpriteOrientation}
2076: C3 BA 21        JP      $21BA               ; {code.publishBarrelSprite}

loc_2079:
2079: AF              XOR     A                   
207A: DD 77 00        LD      (IX+$00),A          
207D: DD 77 03        LD      (IX+$03),A          
2080: C3 BA 21        JP      $21BA               ; {code.publishBarrelSprite}

loc_2083:
2083: DD 34 0E        INC     (IX+$0E)            
2086: DD 7E 0E        LD      A,(IX+$0E)          
2089: 3D              DEC     A                   
208A: CA A2 20        JP      Z,$20A2             ; {code.loc_20a2}
208D: 3D              DEC     A                   
208E: CA C3 20        JP      Z,$20C3             ; {code.loc_20c3}
2091: DD 7E 10        LD      A,(IX+$10)          
2094: 3D              DEC     A                   
2095: 3E 04           LD      A,$04               
2097: C2 9C 20        JP      NZ,$209C            ; {code.loc_209c}
209A: 3E 02           LD      A,$02               

loc_209c:
209C: DD 77 02        LD      (IX+$02),A          
209F: C3 BA 21        JP      $21BA               ; {code.publishBarrelSprite}

loc_20a2:
20A2: DD 7E 15        LD      A,(IX+$15)          
20A5: A7              AND     A                   
20A6: C2 B5 20        JP      NZ,$20B5            ; {code.loc_20b5}
20A9: 21 05 62        LD      HL,$6205            
20AC: DD 7E 05        LD      A,(IX+$05)          
20AF: D6 16           SUB     $16                 
20B1: BE              CP      (HL)                
20B2: D2 C3 20        JP      NC,$20C3            ; {code.loc_20c3}

loc_20b5:
20B5: DD 7E 10        LD      A,(IX+$10)          
20B8: A7              AND     A                   
20B9: C2 E1 20        JP      NZ,$20E1            ; {code.loc_20e1}
20BC: DD 77 11        LD      (IX+$11),A          
20BF: DD 36 10 FF     LD      (IX+$10),$FF        

loc_20c3:
20C3: CD 07 24        CALL    $2407               ; {code.loc_2407}
20C6: CB 3C           SRL     H                   
20C8: CB 1D           RR      L                   
20CA: CB 3C           SRL     H                   
20CC: CB 1D           RR      L                   
20CE: DD 74 12        LD      (IX+$12),H          
20D1: DD 75 13        LD      (IX+$13),L          
20D4: AF              XOR     A                   
20D5: DD 77 14        LD      (IX+$14),A          
20D8: DD 77 04        LD      (IX+$04),A          
20DB: DD 77 06        LD      (IX+$06),A          
20DE: C3 BA 21        JP      $21BA               ; {code.publishBarrelSprite}

loc_20e1:
20E1: DD 36 10 01     LD      (IX+$10),$01        
20E5: DD 36 11 00     LD      (IX+$11),$00        
20E9: C3 C3 20        JP      $20C3               ; {code.loc_20c3}

advanceFallingBarrel:
20EC: D9              EXX                         
20ED: CD 9C 23        CALL    $239C               ; {code.stepBallisticMotion}
20F0: 7C              LD      A,H                 
20F1: D6 1A           SUB     $1A                 
20F3: DD 46 19        LD      B,(IX+$19)          
20F6: B8              CP      B                   
20F7: DA 04 21        JP      C,$2104             ; {code.retireBarrelAtEndOfRange}
20FA: CD 2F 2A        CALL    $2A2F               ; {code.loc_2a2f}

loc_20fd:
20FD: A7              AND     A                   
20FE: C2 18 21        JP      NZ,$2118            ; {code.loc_2118}
2101: CD B4 24        CALL    $24B4               ; {code.retireBarrelIntoOilDrum}

retireBarrelAtEndOfRange:
2104: DD 7E 03        LD      A,(IX+$03)          
2107: C6 08           ADD     A,$08               
2109: FE 10           CP      $10                 
210B: D2 CE 1F        JP      NC,$1FCE            ; {code.advanceBarrelTileAnimation}
210E: AF              XOR     A                   
210F: DD 77 00        LD      (IX+$00),A          
2112: DD 77 03        LD      (IX+$03),A          
2115: C3 BA 21        JP      $21BA               ; {code.publishBarrelSprite}

loc_2118:
2118: DD 7E 05        LD      A,(IX+$05)          
211B: FE E0           CP      $E0                 
211D: DA 46 21        JP      C,$2146             ; {code.loc_2146}
2120: DD 7E 07        LD      A,(IX+$07)          
2123: E6 FC           AND     $FC                 
2125: F6 01           OR      $01                 
2127: DD 77 07        LD      (IX+$07),A          
212A: AF              XOR     A                   
212B: DD 77 01        LD      (IX+$01),A          
212E: DD 77 02        LD      (IX+$02),A          
2131: DD 36 10 FF     LD      (IX+$10),$FF        
2135: DD 77 11        LD      (IX+$11),A          
2138: DD 77 12        LD      (IX+$12),A          
213B: DD 36 13 B0     LD      (IX+$13),$B0        
213F: DD 36 0E 01     LD      (IX+$0E),$01        
2143: C3 53 21        JP      $2153               ; {code.loc_2153}

loc_2146:
2146: CD 07 24        CALL    $2407               ; {code.loc_2407}
2149: CD CB 22        CALL    $22CB               ; {code.loc_22cb}

loc_214c:
214C: DD 7E 05        LD      A,(IX+$05)          
214F: DD 77 19        LD      (IX+$19),A          
2152: AF              XOR     A                   

loc_2153:
2153: DD 77 14        LD      (IX+$14),A          
2156: DD 77 04        LD      (IX+$04),A          
2159: DD 77 06        LD      (IX+$06),A          
215C: C3 BA 21        JP      $21BA               ; {code.publishBarrelSprite}

loc_215f:
215F: 7D              LD      A,L                 
2160: C6 05           ADD     A,$05               
2162: 57              LD      D,A                 
2163: 7C              LD      A,H                 
2164: 01 15 00        LD      BC,$0015            
2167: CD 6D 21        CALL    $216D               ; {code.startBarrelDescentAtLadder}
216A: C3 BA 21        JP      $21BA               ; {code.publishBarrelSprite}

startBarrelDescentAtLadder:
216D: CD 6E 23        CALL    $236E               ; {code.findOppositeLadderEnd}
2170: 3D              DEC     A                   
2171: C0              RET     NZ                  
2172: 78              LD      A,B                 
2173: D6 05           SUB     $05                 
2175: DD 77 17        LD      (IX+$17),A          
2178: 3A 48 63        LD      A,($6348)           ; {hard.workRam+348}
217B: A7              AND     A                   
217C: CA B2 21        JP      Z,$21B2             ; {code.loc_21b2}
217F: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
2182: D6 04           SUB     $04                 
2184: BA              CP      D                   
2185: D8              RET     C                   
2186: 3A 80 63        LD      A,($6380)           ; {ram.difficulty}
2189: 1F              RRA                         
218A: 3C              INC     A                   
218B: 47              LD      B,A                 
218C: 3A 18 60        LD      A,($6018)           ; {ram.random}
218F: 4F              LD      C,A                 
2190: E6 03           AND     $03                 
2192: B8              CP      B                   
2193: D0              RET     NC                  
2194: 21 10 60        LD      HL,$6010            
2197: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
219A: BB              CP      E                   
219B: CA B2 21        JP      Z,$21B2             ; {code.loc_21b2}
219E: D2 A9 21        JP      NC,$21A9            ; {code.loc_21a9}
21A1: CB 46           BIT     0,(HL)              
21A3: CA AE 21        JP      Z,$21AE             ; {code.loc_21ae}
21A6: C3 B2 21        JP      $21B2               ; {code.loc_21b2}

loc_21a9:
21A9: CB 4E           BIT     1,(HL)              
21AB: C2 B2 21        JP      NZ,$21B2            ; {code.loc_21b2}

loc_21ae:
21AE: 79              LD      A,C                 
21AF: E6 18           AND     $18                 
21B1: C0              RET     NZ                  

loc_21b2:
21B2: DD 34 07        INC     (IX+$07)            
21B5: DD CB 02 C6     SET     0,(IX+$02)          
21B9: C9              RET                         

publishBarrelSprite:
21BA: D9              EXX                         
21BB: DD 7E 03        LD      A,(IX+$03)          
21BE: 77              LD      (HL),A              
21BF: 2C              INC     L                   
21C0: DD 7E 07        LD      A,(IX+$07)          
21C3: 77              LD      (HL),A              
21C4: 2C              INC     L                   
21C5: DD 7E 08        LD      A,(IX+$08)          
21C8: 77              LD      (HL),A              
21C9: 2C              INC     L                   
21CA: DD 7E 05        LD      A,(IX+$05)          
21CD: 77              LD      (HL),A              
21CE: C3 8D 1F        JP      $1F8D               ; {code.loc_1f8d}

; ---- $21D1-$21ED: data ----
21D1: 80 FE 01 C0 04 50 02 10 82 60 02 10 82 CA 01 10
21E1: 81 FF 02 38 01 80 02 FF 04 80 04 60 80

advanceAttractDemoInput:
21EE: 11 D1 21        LD      DE,$21D1            
21F1: 21 CC 63        LD      HL,$63CC            
21F4: 7E              LD      A,(HL)              
21F5: 07              RLCA                        
21F6: 83              ADD     A,E                 
21F7: 5F              LD      E,A                 
21F8: 1A              LD      A,(DE)              
21F9: 32 10 60        LD      ($6010),A           ; {ram.p1Input}
21FC: 2C              INC     L                   
21FD: 7E              LD      A,(HL)              
21FE: 35              DEC     (HL)                
21FF: A7              AND     A                   
2200: C0              RET     NZ                  
2201: 1C              INC     E                   
2202: 1A              LD      A,(DE)              
2203: 77              LD      (HL),A              
2204: 2D              DEC     L                   
2205: 34              INC     (HL)                
2206: C9              RET                         

dispatch50mObjectState:
2207: 3E 02           LD      A,$02               
2209: F7              RST     $30                 
220A: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
220D: 1F              RRA                         
220E: 21 80 62        LD      HL,$6280            
2211: 7E              LD      A,(HL)              
2212: DA 19 22        JP      C,$2219             ; {code.loc_2219}
2215: 21 88 62        LD      HL,$6288            
2218: 7E              LD      A,(HL)              

loc_2219:
2219: E5              PUSH    HL                  
221A: EF              RST     $28                 

; ---- $221B-$2226: jump table ----
221B: 27 22 59 22 99 22 A2 22 00 00 00 00

hold50mObjectParked:
2227: E1              POP     HL                  
2228: 2C              INC     L                   
2229: 35              DEC     (HL)                
222A: C2 3A 22        JP      NZ,$223A            ; {code.loc_223a}
222D: 2D              DEC     L                   
222E: 34              INC     (HL)                
222F: 2C              INC     L                   
2230: 2C              INC     L                   
2231: CD 43 22        CALL    $2243               ; {code.marioReachedTargetColumn}
2234: 3E 01           LD      A,$01               
2236: 32 1A 62        LD      ($621A),A           ; {hard.workRam+21A}
2239: C9              RET                         

loc_223a:
223A: 2C              INC     L                   
223B: CD 43 22        CALL    $2243               ; {code.marioReachedTargetColumn}
223E: AF              XOR     A                   
223F: 32 1A 62        LD      ($621A),A           ; {hard.workRam+21A}
2242: C9              RET                         

marioReachedTargetColumn:
2243: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
2246: FE 7A           CP      $7A                 
2248: D2 57 22        JP      NC,$2257            ; {code.reportNoHitAndSkipCaller}
224B: 3A 16 62        LD      A,($6216)           ; {ram.marioAirborne}
224E: A7              AND     A                   
224F: C2 57 22        JP      NZ,$2257            ; {code.reportNoHitAndSkipCaller}
2252: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
2255: BE              CP      (HL)                
2256: C8              RET     Z                   

reportNoHitAndSkipCaller:
2257: E1              POP     HL                  
2258: C9              RET                         

slide50mObjectDown:
2259: E1              POP     HL                  
225A: 2C              INC     L                   
225B: 2C              INC     L                   
225C: 2C              INC     L                   
225D: 2C              INC     L                   
225E: 35              DEC     (HL)                
225F: C0              RET     NZ                  
2260: 3E 04           LD      A,$04               
2262: 77              LD      (HL),A              
2263: 2D              DEC     L                   
2264: 34              INC     (HL)                
2265: CD BD 22        CALL    $22BD               ; {code.publish50mObjectYToSprite}
2268: 3E 78           LD      A,$78               
226A: BE              CP      (HL)                
226B: C2 75 22        JP      NZ,$2275            ; {code.loc_2275}
226E: 2D              DEC     L                   
226F: 2D              DEC     L                   
2270: 2D              DEC     L                   
2271: 34              INC     (HL)                
2272: 2C              INC     L                   
2273: 2C              INC     L                   
2274: 2C              INC     L                   

loc_2275:
2275: 2D              DEC     L                   
2276: CD 43 22        CALL    $2243               ; {code.marioReachedTargetColumn}
2279: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
227C: FE 68           CP      $68                 
227E: D2 8A 22        JP      NC,$228A            ; {code.loc_228a}

stepMarioDownInClimbPose:
2281: 21 05 62        LD      HL,$6205            
2284: 34              INC     (HL)                
2285: CD C0 3F        CALL    $3FC0               ; {code.pinMarioClimbPose}
2288: 34              INC     (HL)                
2289: C9              RET                         

loc_228a:
228A: 1F              RRA                         
228B: DA 81 22        JP      C,$2281             ; {code.stepMarioDownInClimbPose}
228E: 1F              RRA                         
228F: 3E 01           LD      A,$01               
2291: DA 95 22        JP      C,$2295             ; {code.loc_2295}
2294: AF              XOR     A                   

loc_2295:
2295: 32 22 62        LD      ($6222),A           ; {hard.workRam+222}
2298: C9              RET                         

advance50mObjectStateOnRandomGate:
2299: E1              POP     HL                  
229A: 3A 18 60        LD      A,($6018)           ; {ram.random}
229D: E6 3C           AND     $3C                 
229F: C0              RET     NZ                  
22A0: 34              INC     (HL)                
22A1: C9              RET                         

raise50mObjectAndPark:
22A2: E1              POP     HL                  
22A3: 2C              INC     L                   
22A4: 2C              INC     L                   
22A5: 2C              INC     L                   
22A6: 2C              INC     L                   
22A7: 35              DEC     (HL)                
22A8: C0              RET     NZ                  
22A9: 36 02           LD      (HL),$02            
22AB: 2D              DEC     L                   
22AC: 35              DEC     (HL)                
22AD: CD BD 22        CALL    $22BD               ; {code.publish50mObjectYToSprite}
22B0: 3E 68           LD      A,$68               
22B2: BE              CP      (HL)                
22B3: C0              RET     NZ                  
22B4: AF              XOR     A                   
22B5: 06 80           LD      B,$80               
22B7: 2D              DEC     L                   
22B8: 2D              DEC     L                   
22B9: 70              LD      (HL),B              
22BA: 2D              DEC     L                   
22BB: 77              LD      (HL),A              
22BC: C9              RET                         

publish50mObjectYToSprite:
22BD: 7E              LD      A,(HL)              
22BE: CB 5D           BIT     3,L                 
22C0: 11 4B 69        LD      DE,$694B            
22C3: C2 C9 22        JP      NZ,$22C9            ; {code.loc_22c9}
22C6: 11 47 69        LD      DE,$6947            

loc_22c9:
22C9: 12              LD      (DE),A              
22CA: C9              RET                         

loc_22cb:
22CB: 3A 48 63        LD      A,($6348)           ; {hard.workRam+348}
22CE: A7              AND     A                   
22CF: CA E1 22        JP      Z,$22E1             ; {code.loc_22e1}
22D2: 3A 80 63        LD      A,($6380)           ; {ram.difficulty}
22D5: 3D              DEC     A                   
22D6: EF              RST     $28                 

; ---- $22D7-$22E0: jump table ----
22D7: F6 22 F6 22 03 23 03 23 1A 23

loc_22e1:
22E1: 3A 29 62        LD      A,($6229)           ; {ram.level}
22E4: 47              LD      B,A                 
22E5: 05              DEC     B                   
22E6: 3E 01           LD      A,$01               
22E8: CA F9 22        JP      Z,$22F9             ; {code.loc_22f9}
22EB: 05              DEC     B                   
22EC: 3E B1           LD      A,$B1               
22EE: CA F9 22        JP      Z,$22F9             ; {code.loc_22f9}
22F1: 3E E9           LD      A,$E9               
22F3: C3 F9 22        JP      $22F9               ; {code.loc_22f9}

loc_22f6:
22F6: 3A 18 60        LD      A,($6018)           ; {ram.random}

loc_22f9:
22F9: DD 77 11        LD      (IX+$11),A          
22FC: E6 01           AND     $01                 
22FE: 3D              DEC     A                   
22FF: DD 77 10        LD      (IX+$10),A          
2302: C9              RET                         

loc_2303:
2303: 3A 18 60        LD      A,($6018)           ; {ram.random}
2306: DD 77 11        LD      (IX+$11),A          
2309: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
230C: DD BE 03        CP      (IX+$03)            
230F: 3E 01           LD      A,$01               
2311: D2 16 23        JP      NC,$2316            ; {code.loc_2316}
2314: 3D              DEC     A                   
2315: 3D              DEC     A                   

loc_2316:
2316: DD 77 10        LD      (IX+$10),A          
2319: C9              RET                         

loc_231a:
231A: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
231D: DD 96 03        SUB     (IX+$03)            
2320: 0E FF           LD      C,$FF               
2322: DA 26 23        JP      C,$2326             ; {code.loc_2326}
2325: 0C              INC     C                   

loc_2326:
2326: 07              RLCA                        
2327: CB 11           RL      C                   
2329: 07              RLCA                        
232A: CB 11           RL      C                   
232C: DD 71 10        LD      (IX+$10),C          
232F: DD 77 11        LD      (IX+$11),A          
2332: C9              RET                         

snapYToGirder:
2333: 3E 0F           LD      A,$0F               
2335: A4              AND     H                   
2336: 05              DEC     B                   
2337: CA 42 23        JP      Z,$2342             ; {code.loc_2342}
233A: FE 0F           CP      $0F                 
233C: D8              RET     C                   
233D: 06 FF           LD      B,$FF               
233F: C3 47 23        JP      $2347               ; {code.loc_2347}

loc_2342:
2342: FE 01           CP      $01                 
2344: D0              RET     NC                  
2345: 06 01           LD      B,$01               

loc_2347:
2347: 3E F0           LD      A,$F0               
2349: BD              CP      L                   
234A: CA 60 23        JP      Z,$2360             ; {code.loc_2360}
234D: 3E 4C           LD      A,$4C               
234F: BD              CP      L                   
2350: CA 66 23        JP      Z,$2366             ; {code.loc_2366}
2353: 7D              LD      A,L                 
2354: CB 6F           BIT     5,A                 
2356: CA 5C 23        JP      Z,$235C             ; {code.loc_235c}

loc_2359:
2359: 90              SUB     B                   

loc_235a:
235A: 6F              LD      L,A                 
235B: C9              RET                         

loc_235c:
235C: 80              ADD     A,B                 
235D: C3 5A 23        JP      $235A               ; {code.loc_235a}

loc_2360:
2360: CB 7C           BIT     7,H                 
2362: C2 59 23        JP      NZ,$2359            ; {code.loc_2359}
2365: C9              RET                         

loc_2366:
2366: 7C              LD      A,H                 
2367: FE 98           CP      $98                 
2369: D8              RET     C                   
236A: 7D              LD      A,L                 
236B: C3 5C 23        JP      $235C               ; {code.loc_235c}

findOppositeLadderEnd:
236E: 21 00 63        LD      HL,$6300            

loc_2371:
2371: ED B1           CPIR                        
2373: C2 9A 23        JP      NZ,$239A            ; {code.loc_239a}
2376: E5              PUSH    HL                  
2377: C5              PUSH    BC                  
2378: 01 14 00        LD      BC,$0014            
237B: 09              ADD     HL,BC               
237C: 0C              INC     C                   
237D: 5F              LD      E,A                 
237E: 7A              LD      A,D                 
237F: BE              CP      (HL)                
2380: CA 8F 23        JP      Z,$238F             ; {code.loc_238f}
2383: 09              ADD     HL,BC               
2384: BE              CP      (HL)                
2385: CA 95 23        JP      Z,$2395             ; {code.loc_2395}
2388: 57              LD      D,A                 
2389: 7B              LD      A,E                 
238A: C1              POP     BC                  
238B: E1              POP     HL                  
238C: C3 71 23        JP      $2371               ; {code.loc_2371}

loc_238f:
238F: 09              ADD     HL,BC               
2390: 3E 01           LD      A,$01               
2392: C3 98 23        JP      $2398               ; {code.loc_2398}

loc_2395:
2395: AF              XOR     A                   
2396: ED 42           SBC     HL,BC               

loc_2398:
2398: C1              POP     BC                  
2399: 46              LD      B,(HL)              

loc_239a:
239A: E1              POP     HL                  
239B: C9              RET                         

stepBallisticMotion:
239C: DD 7E 04        LD      A,(IX+$04)          
239F: DD 86 11        ADD     A,(IX+$11)          
23A2: DD 77 04        LD      (IX+$04),A          
23A5: DD 7E 03        LD      A,(IX+$03)          
23A8: DD 8E 10        ADC     A,(IX+$10)          
23AB: DD 77 03        LD      (IX+$03),A          
23AE: DD 7E 06        LD      A,(IX+$06)          
23B1: DD 96 13        SUB     (IX+$13)            
23B4: 6F              LD      L,A                 
23B5: DD 7E 05        LD      A,(IX+$05)          
23B8: DD 9E 12        SBC     A,(IX+$12)          
23BB: 67              LD      H,A                 
23BC: DD 7E 14        LD      A,(IX+$14)          
23BF: A7              AND     A                   
23C0: 17              RLA                         
23C1: 3C              INC     A                   
23C2: 06 00           LD      B,$00               
23C4: CB 10           RL      B                   
23C6: CB 27           SLA     A                   
23C8: CB 10           RL      B                   
23CA: CB 27           SLA     A                   
23CC: CB 10           RL      B                   
23CE: CB 27           SLA     A                   
23D0: CB 10           RL      B                   
23D2: 4F              LD      C,A                 
23D3: 09              ADD     HL,BC               
23D4: DD 74 05        LD      (IX+$05),H          
23D7: DD 75 06        LD      (IX+$06),L          
23DA: DD 34 14        INC     (IX+$14)            
23DD: C9              RET                         

advanceBarrelSpriteOrientation:
23DE: DD 7E 0F        LD      A,(IX+$0F)          
23E1: 3D              DEC     A                   
23E2: C2 03 24        JP      NZ,$2403            ; {code.loc_2403}
23E5: AF              XOR     A                   
23E6: DD CB 07 26     SLA     (IX+$07)            
23EA: 17              RLA                         
23EB: DD CB 08 26     SLA     (IX+$08)            
23EF: 17              RLA                         
23F0: 47              LD      B,A                 
23F1: 3E 03           LD      A,$03               
23F3: B1              OR      C                   
23F4: CD 09 30        CALL    $3009               ; {code.nextAnimationStep}
23F7: 1F              RRA                         
23F8: DD CB 08 1E     RR      (IX+$08)            
23FC: 1F              RRA                         
23FD: DD CB 07 1E     RR      (IX+$07)            
2401: 3E 04           LD      A,$04               

loc_2403:
2403: DD 77 0F        LD      (IX+$0F),A          
2406: C9              RET                         

loc_2407:
2407: DD 7E 14        LD      A,(IX+$14)          
240A: 07              RLCA                        
240B: 07              RLCA                        
240C: 07              RLCA                        
240D: 07              RLCA                        
240E: 4F              LD      C,A                 
240F: E6 0F           AND     $0F                 
2411: 67              LD      H,A                 
2412: 79              LD      A,C                 
2413: E6 F0           AND     $F0                 
2415: 6F              LD      L,A                 
2416: DD 4E 13        LD      C,(IX+$13)          
2419: DD 46 12        LD      B,(IX+$12)          
241C: ED 42           SBC     HL,BC               
241E: C9              RET                         

limitMarioHorizontalTravel:
241F: 11 00 01        LD      DE,$0100            
2422: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
2425: FE 16           CP      $16                 
2427: D8              RET     C                   
2428: 15              DEC     D                   
2429: 1C              INC     E                   
242A: FE EA           CP      $EA                 
242C: D0              RET     NC                  
242D: 1D              DEC     E                   
242E: 3A 27 62        LD      A,($6227)           ; {ram.board}
2431: 0F              RRCA                        
2432: D0              RET     NC                  
2433: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
2436: FE 58           CP      $58                 
2438: D0              RET     NC                  
2439: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
243C: FE 6C           CP      $6C                 
243E: D0              RET     NC                  
243F: 14              INC     D                   
2440: C9              RET                         

loadBoardObjectRecords:
2441: 21 0C 3F        LD      HL,$3F0C            
2444: 3E 5E           LD      A,$5E               
2446: 06 06           LD      B,$06               

loc_2448:
2448: 86              ADD     A,(HL)              
2449: 23              INC     HL                  
244A: 10 FC           DJNZ    $2448               ; {code.loc_2448}
244C: FD 21 10 63     LD      IY,$6310            
2450: A7              AND     A                   
2451: CA 56 24        JP      Z,$2456             ; {code.loc_2456}
2454: FD 23           INC     IY                  

loc_2456:
2456: 3A 27 62        LD      A,($6227)           ; {ram.board}
2459: 3D              DEC     A                   
245A: 21 E4 3A        LD      HL,$3AE4            
245D: CA 71 24        JP      Z,$2471             ; {code.loc_2471}
2460: 3D              DEC     A                   
2461: 21 5D 3B        LD      HL,$3B5D            
2464: CA 71 24        JP      Z,$2471             ; {code.loc_2471}
2467: 3D              DEC     A                   
2468: 21 E5 3B        LD      HL,$3BE5            
246B: CA 71 24        JP      Z,$2471             ; {code.loc_2471}
246E: 21 8B 3C        LD      HL,$3C8B            

loc_2471:
2471: DD 21 00 63     LD      IX,$6300            
2475: 11 05 00        LD      DE,$0005            

loc_2478:
2478: 7E              LD      A,(HL)              
2479: A7              AND     A                   
247A: CA 88 24        JP      Z,$2488             ; {code.loc_2488}
247D: 3D              DEC     A                   
247E: CA 9E 24        JP      Z,$249E             ; {code.loc_249e}
2481: FE A9           CP      $A9                 
2483: C8              RET     Z                   
2484: 19              ADD     HL,DE               
2485: C3 78 24        JP      $2478               ; {code.loc_2478}

loc_2488:
2488: 23              INC     HL                  
2489: 7E              LD      A,(HL)              
248A: DD 77 00        LD      (IX+$00),A          
248D: 23              INC     HL                  
248E: 7E              LD      A,(HL)              
248F: DD 77 15        LD      (IX+$15),A          
2492: 23              INC     HL                  
2493: 23              INC     HL                  
2494: 7E              LD      A,(HL)              
2495: DD 77 2A        LD      (IX+$2A),A          
2498: DD 23           INC     IX                  
249A: 23              INC     HL                  
249B: C3 78 24        JP      $2478               ; {code.loc_2478}

loc_249e:
249E: 23              INC     HL                  
249F: 7E              LD      A,(HL)              
24A0: FD 77 00        LD      (IY+$00),A          
24A3: 23              INC     HL                  
24A4: 7E              LD      A,(HL)              
24A5: FD 77 15        LD      (IY+$15),A          
24A8: 23              INC     HL                  
24A9: 23              INC     HL                  
24AA: 7E              LD      A,(HL)              
24AB: FD 77 2A        LD      (IY+$2A),A          
24AE: FD 23           INC     IY                  
24B0: 23              INC     HL                  
24B1: C3 78 24        JP      $2478               ; {code.loc_2478}

retireBarrelIntoOilDrum:
24B4: DD 7E 05        LD      A,(IX+$05)          
24B7: FE E8           CP      $E8                 
24B9: D8              RET     C                   
24BA: DD 7E 03        LD      A,(IX+$03)          
24BD: FE 2A           CP      $2A                 
24BF: D0              RET     NC                  
24C0: FE 20           CP      $20                 
24C2: D8              RET     C                   
24C3: DD 7E 15        LD      A,(IX+$15)          
24C6: A7              AND     A                   
24C7: CA D0 24        JP      Z,$24D0             ; {code.loc_24d0}
24CA: 3E 03           LD      A,$03               
24CC: 32 B9 62        LD      ($62B9),A           ; {hard.workRam+2B9}
24CF: AF              XOR     A                   

loc_24d0:
24D0: DD 77 00        LD      (IX+$00),A          
24D3: DD 77 03        LD      (IX+$03),A          
24D6: 21 82 60        LD      HL,$6082            
24D9: 36 03           LD      (HL),$03            
24DB: E1              POP     HL                  
24DC: 3A 48 63        LD      A,($6348)           ; {hard.workRam+348}
24DF: A7              AND     A                   
24E0: C2 BA 21        JP      NZ,$21BA            ; {code.publishBarrelSprite}
24E3: 3C              INC     A                   
24E4: 32 48 63        LD      ($6348),A           ; {hard.workRam+348}
24E7: C3 BA 21        JP      $21BA               ; {code.publishBarrelSprite}

; ---- $24EA-$25F1: data ----
24EA: 3E 02 F7 CD 23 25 CD 91 25 DD 21 A0 65 06 06 21
24FA: B8 69 DD 7E 00 A7 CA 1C 25 DD 7E 03 77 2C DD 7E
250A: 07 77 2C DD 7E 08 77 2C DD 7E 05 77 2C DD 19 10
251A: E1 C9 7D C6 04 6F C3 17 25 21 9B 63 7E A7 C2 8F
252A: 25 3A 9A 63 A7 C8 06 06 11 10 00 DD 21 A0 65 DD
253A: CB 00 46 CA 45 25 DD 19 10 F5 C9 CD 57 00 FE 60
254A: DD 36 05 7C DA 58 25 3A A3 62 3D C2 6E 25 DD 36
255A: 05 CC 3A A6 62 07 DD 36 03 07 D2 76 25 DD 36 03
256A: F8 C3 76 25 CD 57 00 FE 68 C3 60 25 DD 36 00 01
257A: DD 36 07 4B DD 36 09 08 DD 36 0A 03 3E 7C 32 9B
258A: 63 AF 32 9A 63 35 C9 DD 21 A0 65 11 10 00 06 06
259A: DD CB 00 46 CA BB 25 DD 7E 03 67 C6 07 FE 0E DA
25AA: D6 25 DD 7E 05 FE 7C CA C0 25 3A A6 63 84 DD 77
25BA: 03 DD 19 10 DB C9 7C FE 80 CA D6 25 3A A5 63 D2
25CA: CF 25 3A A4 63 84 DD 77 03 C3 BB 25 21 B8 69 3E
25DA: 06 90 CA E7 25 2C 2C 2C 2C 3D C3 DC 25 AF DD 77
25EA: 00 DD 77 03 77 C3 BB 25

update50mConveyorObjects:
25F2: 3E 02           LD      A,$02               
25F4: F7              RST     $30                 
25F5: CD 02 26        CALL    $2602               ; {code.loc_2602}
25F8: CD 2F 26        CALL    $262F               ; {code.loc_262f}
25FB: CD 79 26        CALL    $2679               ; {code.loc_2679}
25FE: CD D3 2A        CALL    $2AD3               ; {code.carryMarioOnConveyorRow}
2601: C9              RET                         

loc_2602:
2602: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
2605: 0F              RRCA                        
2606: DA 16 26        JP      C,$2616             ; {code.loc_2616}
2609: 21 A0 62        LD      HL,$62A0            
260C: 35              DEC     (HL)                
260D: C2 16 26        JP      NZ,$2616            ; {code.loc_2616}
2610: 36 80           LD      (HL),$80            
2612: 2C              INC     L                   
2613: CD DE 26        CALL    $26DE               ; {code.reverseStepDirection}

loc_2616:
2616: 21 A1 62        LD      HL,$62A1            
2619: CD E9 26        CALL    $26E9               ; {code.signStepHalfRate}
261C: 32 A3 63        LD      ($63A3),A           ; {ram.m50Obj1Step}
261F: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
2622: E6 1F           AND     $1F                 
2624: FE 01           CP      $01                 
2626: C0              RET     NZ                  
2627: 11 E4 69        LD      DE,$69E4            
262A: EB              EX      DE,HL               
262B: CD A6 26        CALL    $26A6               ; {code.loc_26a6}
262E: C9              RET                         

loc_262f:
262F: 21 A3 62        LD      HL,$62A3            
2632: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
2635: FE C0           CP      $C0                 
2637: DA 6F 26        JP      C,$266F             ; {code.loc_266f}
263A: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
263D: 0F              RRCA                        
263E: DA 4C 26        JP      C,$264C             ; {code.loc_264c}
2641: 2D              DEC     L                   
2642: 35              DEC     (HL)                
2643: C2 4C 26        JP      NZ,$264C            ; {code.loc_264c}
2646: 36 C0           LD      (HL),$C0            
2648: 2C              INC     L                   
2649: CD DE 26        CALL    $26DE               ; {code.reverseStepDirection}

loc_264c:
264C: 21 A3 62        LD      HL,$62A3            
264F: CD E9 26        CALL    $26E9               ; {code.signStepHalfRate}
2652: 32 A5 63        LD      ($63A5),A           ; {ram.m50Obj2StepPos}
2655: ED 44           NEG                         
2657: 32 A4 63        LD      ($63A4),A           ; {ram.m50Obj2StepNeg}
265A: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
265D: E6 1F           AND     $1F                 
265F: C0              RET     NZ                  
2660: 2D              DEC     L                   
2661: 11 EC 69        LD      DE,$69EC            
2664: EB              EX      DE,HL               
2665: CD A6 26        CALL    $26A6               ; {code.loc_26a6}
2668: E6 7F           AND     $7F                 
266A: 21 ED 69        LD      HL,$69ED            
266D: 77              LD      (HL),A              
266E: C9              RET                         

loc_266f:
266F: CB 7E           BIT     7,(HL)              
2671: C2 4C 26        JP      NZ,$264C            ; {code.loc_264c}
2674: 36 FF           LD      (HL),$FF            
2676: C3 4C 26        JP      $264C               ; {code.loc_264c}

loc_2679:
2679: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
267C: 0F              RRCA                        
267D: DA 8D 26        JP      C,$268D             ; {code.loc_268d}
2680: 21 A5 62        LD      HL,$62A5            
2683: 35              DEC     (HL)                
2684: C2 8D 26        JP      NZ,$268D            ; {code.loc_268d}
2687: 36 FF           LD      (HL),$FF            
2689: 2C              INC     L                   
268A: CD DE 26        CALL    $26DE               ; {code.reverseStepDirection}

loc_268d:
268D: 21 A6 62        LD      HL,$62A6            
2690: CD E9 26        CALL    $26E9               ; {code.signStepHalfRate}
2693: 32 A6 63        LD      ($63A6),A           ; {ram.m50Obj3Step}
2696: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
2699: E6 1F           AND     $1F                 
269B: FE 02           CP      $02                 
269D: C0              RET     NZ                  
269E: 11 F4 69        LD      DE,$69F4            
26A1: EB              EX      DE,HL               
26A2: CD A6 26        CALL    $26A6               ; {code.loc_26a6}
26A5: C9              RET                         

loc_26a6:
26A6: 2C              INC     L                   
26A7: 1A              LD      A,(DE)              
26A8: 17              RLA                         
26A9: DA C5 26        JP      C,$26C5             ; {code.loc_26c5}
26AC: 7E              LD      A,(HL)              
26AD: 3C              INC     A                   
26AE: FE 53           CP      $53                 
26B0: C2 B5 26        JP      NZ,$26B5            ; {code.loc_26b5}
26B3: 3E 50           LD      A,$50               

loc_26b5:
26B5: 77              LD      (HL),A              
26B6: 7D              LD      A,L                 
26B7: C6 04           ADD     A,$04               
26B9: 6F              LD      L,A                 
26BA: 7E              LD      A,(HL)              
26BB: 3D              DEC     A                   
26BC: FE CF           CP      $CF                 
26BE: C2 C3 26        JP      NZ,$26C3            ; {code.loc_26c3}
26C1: 3E D2           LD      A,$D2               

loc_26c3:
26C3: 77              LD      (HL),A              
26C4: C9              RET                         

loc_26c5:
26C5: 7E              LD      A,(HL)              
26C6: 3D              DEC     A                   
26C7: FE 4F           CP      $4F                 
26C9: C2 CE 26        JP      NZ,$26CE            ; {code.loc_26ce}
26CC: 3E 52           LD      A,$52               

loc_26ce:
26CE: 77              LD      (HL),A              
26CF: 7D              LD      A,L                 
26D0: C6 04           ADD     A,$04               
26D2: 6F              LD      L,A                 
26D3: 7E              LD      A,(HL)              
26D4: 3C              INC     A                   
26D5: FE D3           CP      $D3                 
26D7: C2 DC 26        JP      NZ,$26DC            ; {code.loc_26dc}
26DA: 3E D0           LD      A,$D0               

loc_26dc:
26DC: 77              LD      (HL),A              
26DD: C9              RET                         

reverseStepDirection:
26DE: CB 7E           BIT     7,(HL)              
26E0: CA E6 26        JP      Z,$26E6             ; {code.loc_26e6}
26E3: 36 02           LD      (HL),$02            
26E5: C9              RET                         

loc_26e6:
26E6: 36 FE           LD      (HL),$FE            
26E8: C9              RET                         

signStepHalfRate:
26E9: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
26EC: E6 01           AND     $01                 
26EE: C8              RET     Z                   
26EF: CB 7E           BIT     7,(HL)              
26F1: 3E FF           LD      A,$FF               
26F3: C2 F8 26        JP      NZ,$26F8            ; {code.loc_26f8}
26F6: 3E 01           LD      A,$01               

loc_26f8:
26F8: 77              LD      (HL),A              
26F9: C9              RET                         

service75mBoard:
26FA: 3E 04           LD      A,$04               
26FC: F7              RST     $30                 
26FD: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
2700: FE F0           CP      $F0                 
2702: D2 7F 27        JP      NC,$277F            ; {code.killMarioAtEndOfLiftTravel}
2705: 3A 29 62        LD      A,($6229)           ; {ram.level}
2708: 3D              DEC     A                   
2709: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
270C: C2 1A 27        JP      NZ,$271A            ; {code.loc_271a}
270F: E6 03           AND     $03                 
2711: FE 01           CP      $01                 
2713: CA 1E 27        JP      Z,$271E             ; {code.loc_271e}
2716: DA 22 27        JP      C,$2722             ; {code.serviceBoardObjects}
2719: C9              RET                         

loc_271a:
271A: 0F              RRCA                        
271B: DA 22 27        JP      C,$2722             ; {code.serviceBoardObjects}

loc_271e:
271E: CD 45 27        CALL    $2745               ; {code.dispatchElevatorRideByColumn}
2721: C9              RET                         

serviceBoardObjects:
2722: CD 97 27        CALL    $2797               ; {code.advanceBoardObjectTravel}
2725: CD DA 27        CALL    $27DA               ; {code.spawnBoardObject}
2728: 06 06           LD      B,$06               
272A: 11 10 00        LD      DE,$0010            
272D: 21 58 69        LD      HL,$6958            
2730: DD 21 00 66     LD      IX,$6600            

loc_2734:
2734: DD 7E 03        LD      A,(IX+$03)          
2737: 77              LD      (HL),A              
2738: 2C              INC     L                   
2739: 2C              INC     L                   
273A: 2C              INC     L                   
273B: DD 7E 05        LD      A,(IX+$05)          
273E: 77              LD      (HL),A              
273F: 2C              INC     L                   
2740: DD 19           ADD     IX,DE               
2742: 10 F0           DJNZ    $2734               ; {code.loc_2734}
2744: C9              RET                         

dispatchElevatorRideByColumn:
2745: 3A 98 63        LD      A,($6398)           ; {ram.edgeRepositionFlag}
2748: A7              AND     A                   
2749: C8              RET     Z                   
274A: 3A 16 62        LD      A,($6216)           ; {ram.marioAirborne}
274D: A7              AND     A                   
274E: C0              RET     NZ                  
274F: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
2752: FE 2C           CP      $2C                 
2754: DA 66 27        JP      C,$2766             ; {code.loc_2766}
2757: FE 43           CP      $43                 
2759: DA 6F 27        JP      C,$276F             ; {code.carryMarioUpWithLift}
275C: FE 6C           CP      $6C                 
275E: DA 66 27        JP      C,$2766             ; {code.loc_2766}
2761: FE 83           CP      $83                 
2763: DA 87 27        JP      C,$2787             ; {code.carryMarioDownWithLift}

loc_2766:
2766: AF              XOR     A                   
2767: 32 98 63        LD      ($6398),A           ; {ram.edgeRepositionFlag}
276A: 3C              INC     A                   
276B: 32 21 62        LD      ($6221),A           ; {ram.marioStartFall}
276E: C9              RET                         

carryMarioUpWithLift:
276F: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
2772: FE 71           CP      $71                 
2774: DA 7F 27        JP      C,$277F             ; {code.killMarioAtEndOfLiftTravel}
2777: 3D              DEC     A                   
2778: 32 05 62        LD      ($6205),A           ; {ram.marioY}
277B: 32 4F 69        LD      ($694F),A           ; {hard.workRam+94F}
277E: C9              RET                         

killMarioAtEndOfLiftTravel:
277F: AF              XOR     A                   
2780: 32 00 62        LD      ($6200),A           ; {ram.marioActive}
2783: 32 98 63        LD      ($6398),A           ; {ram.edgeRepositionFlag}
2786: C9              RET                         

carryMarioDownWithLift:
2787: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
278A: FE E8           CP      $E8                 
278C: D2 7F 27        JP      NC,$277F            ; {code.killMarioAtEndOfLiftTravel}
278F: 3C              INC     A                   
2790: 32 05 62        LD      ($6205),A           ; {ram.marioY}
2793: 32 4F 69        LD      ($694F),A           ; {hard.workRam+94F}
2796: C9              RET                         

advanceBoardObjectTravel:
2797: 06 06           LD      B,$06               
2799: 11 10 00        LD      DE,$0010            
279C: DD 21 00 66     LD      IX,$6600            

loc_27a0:
27A0: DD CB 00 46     BIT     0,(IX+$00)          
27A4: CA C2 27        JP      Z,$27C2             ; {code.loc_27c2}
27A7: DD CB 0D 5E     BIT     3,(IX+$0D)          
27AB: CA C7 27        JP      Z,$27C7             ; {code.loc_27c7}
27AE: DD 7E 05        LD      A,(IX+$05)          
27B1: 3D              DEC     A                   
27B2: DD 77 05        LD      (IX+$05),A          
27B5: FE 60           CP      $60                 
27B7: C2 C2 27        JP      NZ,$27C2            ; {code.loc_27c2}
27BA: DD 36 03 77     LD      (IX+$03),$77        
27BE: DD 36 0D 04     LD      (IX+$0D),$04        

loc_27c2:
27C2: DD 19           ADD     IX,DE               
27C4: 10 DA           DJNZ    $27A0               ; {code.loc_27a0}
27C6: C9              RET                         

loc_27c7:
27C7: DD 7E 05        LD      A,(IX+$05)          
27CA: 3C              INC     A                   
27CB: DD 77 05        LD      (IX+$05),A          
27CE: FE F8           CP      $F8                 
27D0: C2 C2 27        JP      NZ,$27C2            ; {code.loc_27c2}
27D3: DD 36 00 00     LD      (IX+$00),$00        
27D7: C3 C2 27        JP      $27C2               ; {code.loc_27c2}

spawnBoardObject:
27DA: 21 A7 62        LD      HL,$62A7            
27DD: 7E              LD      A,(HL)              
27DE: A7              AND     A                   
27DF: C2 06 28        JP      NZ,$2806            ; {code.decrementByteAt}
27E2: 06 06           LD      B,$06               
27E4: DD 21 00 66     LD      IX,$6600            

loc_27e8:
27E8: DD CB 00 46     BIT     0,(IX+$00)          
27EC: CA F4 27        JP      Z,$27F4             ; {code.loc_27f4}
27EF: DD 19           ADD     IX,DE               
27F1: 10 F5           DJNZ    $27E8               ; {code.loc_27e8}
27F3: C9              RET                         

loc_27f4:
27F4: DD 36 00 01     LD      (IX+$00),$01        
27F8: DD 36 03 37     LD      (IX+$03),$37        
27FC: DD 36 05 F8     LD      (IX+$05),$F8        
2800: DD 36 0D 08     LD      (IX+$0D),$08        
2804: 36 34           LD      (HL),$34            

decrementByteAt:
2806: 35              DEC     (HL)                
2807: C9              RET                         

killMarioOnObjectCollision:
2808: FD 21 00 62     LD      IY,$6200            
280C: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
280F: 4F              LD      C,A                 
2810: 21 07 04        LD      HL,$0407            
2813: CD 6F 28        CALL    $286F               ; {code.dispatchBoardCollision}

loc_2816:
2816: A7              AND     A                   
2817: C8              RET     Z                   
2818: 3D              DEC     A                   
2819: 32 00 62        LD      ($6200),A           ; {ram.marioActive}
281C: C9              RET                         

; ---- $281D-$2852: data ----
281D: 06 02 11 10 00 FD 21 80 66 FD CB 01 46 C2 32 28
282D: FD 19 10 F5 C9 FD 4E 05 FD 66 09 FD 6E 0A CD 6F
283D: 28 A7 C8 32 50 63 3A B9 63 90 32 54 63 7B 32 53
284D: 63 DD 22 51 63 C9

searchPlayerObjectOverlap:
2853: FD 21 00 62     LD      IY,$6200            
2857: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
285A: C6 0C           ADD     A,$0C               
285C: 4F              LD      C,A                 
285D: 3A 10 60        LD      A,($6010)           ; {ram.p1Input}
2860: E6 03           AND     $03                 
2862: 21 08 05        LD      HL,$0508            
2865: CA 6B 28        JP      Z,$286B             ; {code.loc_286b}
2868: 21 08 13        LD      HL,$1308            

loc_286b:
286B: CD 88 3E        CALL    $3E88               ; {code.dispatchBoardOverlapSearch}

; ---- $286E-$286E: data ----
286E: C9

dispatchBoardCollision:
286F: 3A 27 62        LD      A,($6227)           ; {ram.board}
2872: E5              PUSH    HL                  
2873: EF              RST     $28                 

; ---- $2874-$287F: jump table ----
2874: 00 00 80 28 B0 28 E0 28 01 29 00 00

search25mObjectOverlap:
2880: E1              POP     HL                  
2881: 06 0A           LD      B,$0A               
2883: 78              LD      A,B                 
2884: 32 B9 63        LD      ($63B9),A           ; {ram.objSearchCount}
2887: 11 20 00        LD      DE,$0020            
288A: DD 21 00 67     LD      IX,$6700            
288E: CD 13 29        CALL    $2913               ; {code.findCollidingObject}
2891: 06 05           LD      B,$05               
2893: 78              LD      A,B                 
2894: 32 B9 63        LD      ($63B9),A           ; {ram.objSearchCount}
2897: 1E 20           LD      E,$20               
2899: DD 21 00 64     LD      IX,$6400            
289D: CD 13 29        CALL    $2913               ; {code.findCollidingObject}
28A0: 06 01           LD      B,$01               
28A2: 78              LD      A,B                 
28A3: 32 B9 63        LD      ($63B9),A           ; {ram.objSearchCount}
28A6: 1E 00           LD      E,$00               
28A8: DD 21 A0 66     LD      IX,$66A0            
28AC: CD 13 29        CALL    $2913               ; {code.findCollidingObject}
28AF: C9              RET                         

search50mObjectOverlap:
28B0: E1              POP     HL                  
28B1: 06 05           LD      B,$05               
28B3: 78              LD      A,B                 
28B4: 32 B9 63        LD      ($63B9),A           ; {ram.objSearchCount}
28B7: 11 20 00        LD      DE,$0020            
28BA: DD 21 00 64     LD      IX,$6400            
28BE: CD 13 29        CALL    $2913               ; {code.findCollidingObject}
28C1: 06 06           LD      B,$06               
28C3: 78              LD      A,B                 
28C4: 32 B9 63        LD      ($63B9),A           ; {ram.objSearchCount}
28C7: 1E 10           LD      E,$10               
28C9: DD 21 A0 65     LD      IX,$65A0            
28CD: CD 13 29        CALL    $2913               ; {code.findCollidingObject}
28D0: 06 01           LD      B,$01               
28D2: 78              LD      A,B                 
28D3: 32 B9 63        LD      ($63B9),A           ; {ram.objSearchCount}
28D6: 1E 00           LD      E,$00               
28D8: DD 21 A0 66     LD      IX,$66A0            
28DC: CD 13 29        CALL    $2913               ; {code.findCollidingObject}
28DF: C9              RET                         

search75mObjectOverlap:
28E0: E1              POP     HL                  
28E1: 06 05           LD      B,$05               
28E3: 78              LD      A,B                 
28E4: 32 B9 63        LD      ($63B9),A           ; {ram.objSearchCount}
28E7: 11 20 00        LD      DE,$0020            
28EA: DD 21 00 64     LD      IX,$6400            
28EE: CD 13 29        CALL    $2913               ; {code.findCollidingObject}
28F1: 06 0A           LD      B,$0A               
28F3: 78              LD      A,B                 
28F4: 32 B9 63        LD      ($63B9),A           ; {ram.objSearchCount}
28F7: 1E 10           LD      E,$10               
28F9: DD 21 00 65     LD      IX,$6500            
28FD: CD 13 29        CALL    $2913               ; {code.findCollidingObject}
2900: C9              RET                         

search100mObjectOverlap:
2901: E1              POP     HL                  
2902: 06 07           LD      B,$07               
2904: 78              LD      A,B                 
2905: 32 B9 63        LD      ($63B9),A           ; {ram.objSearchCount}
2908: 11 20 00        LD      DE,$0020            
290B: DD 21 00 64     LD      IX,$6400            
290F: CD 13 29        CALL    $2913               ; {code.findCollidingObject}
2912: C9              RET                         

findCollidingObject:
2913: DD E5           PUSH    IX                  

loc_2915:
2915: DD CB 00 46     BIT     0,(IX+$00)          
2919: CA 4C 29        JP      Z,$294C             ; {code.loc_294c}
291C: 79              LD      A,C                 
291D: DD 96 05        SUB     (IX+$05)            
2920: D2 25 29        JP      NC,$2925            ; {code.loc_2925}
2923: ED 44           NEG                         

loc_2925:
2925: 3C              INC     A                   
2926: 95              SUB     L                   
2927: DA 30 29        JP      C,$2930             ; {code.loc_2930}
292A: DD 96 0A        SUB     (IX+$0A)            
292D: D2 4C 29        JP      NC,$294C            ; {code.loc_294c}

loc_2930:
2930: FD 7E 03        LD      A,(IY+$03)          
2933: DD 96 03        SUB     (IX+$03)            
2936: D2 3B 29        JP      NC,$293B            ; {code.loc_293b}
2939: ED 44           NEG                         

loc_293b:
293B: 94              SUB     H                   
293C: DA 45 29        JP      C,$2945             ; {code.loc_2945}
293F: DD 96 09        SUB     (IX+$09)            
2942: D2 4C 29        JP      NC,$294C            ; {code.loc_294c}

loc_2945:
2945: 3E 01           LD      A,$01               
2947: DD E1           POP     IX                  
2949: 33              INC     SP                  
294A: 33              INC     SP                  
294B: C9              RET                         

loc_294c:
294C: DD 19           ADD     IX,DE               
294E: 10 C5           DJNZ    $2915               ; {code.loc_2915}
2950: AF              XOR     A                   
2951: DD E1           POP     IX                  
2953: C9              RET                         

latchHammerTouch:
2954: 3E 0B           LD      A,$0B               
2956: F7              RST     $30                 
2957: CD 74 29        CALL    $2974               ; {code.findHammerOverlappingMario}
295A: 32 18 62        LD      ($6218),A           ; {ram.marioHammerPending}
295D: 0F              RRCA                        
295E: 0F              RRCA                        
295F: 32 85 60        LD      ($6085),A           ; {hard.workRam+85}
2962: 78              LD      A,B                 
2963: A7              AND     A                   
2964: C8              RET     Z                   
2965: FE 01           CP      $01                 
2967: CA 6F 29        JP      Z,$296F             ; {code.loc_296f}
296A: DD 36 01 01     LD      (IX+$01),$01        
296E: C9              RET                         

loc_296f:
296F: DD 36 11 01     LD      (IX+$11),$01        
2973: C9              RET                         

findHammerOverlappingMario:
2974: FD 21 00 62     LD      IY,$6200            
2978: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
297B: 4F              LD      C,A                 
297C: 21 08 04        LD      HL,$0408            
297F: 06 02           LD      B,$02               
2981: 11 10 00        LD      DE,$0010            
2984: DD 21 80 66     LD      IX,$6680            
2988: CD 13 29        CALL    $2913               ; {code.findCollidingObject}
298B: C9              RET                         

turnFireAtGroundEdge:
298C: 2A C8 63        LD      HL,($63C8)          ; {ram.objIterPtr}
298F: 7D              LD      A,L                 
2990: C6 0E           ADD     A,$0E               
2992: 6F              LD      L,A                 
2993: 56              LD      D,(HL)              
2994: 2C              INC     L                   
2995: 7E              LD      A,(HL)              
2996: C6 0C           ADD     A,$0C               
2998: 5F              LD      E,A                 
2999: EB              EX      DE,HL               
299A: CD F0 2F        CALL    $2FF0               ; {code.tileAddrForPixel}
299D: 7E              LD      A,(HL)              
299E: FE B0           CP      $B0                 
29A0: DA AC 29        JP      C,$29AC             ; {code.loc_29ac}
29A3: E6 0F           AND     $0F                 
29A5: FE 08           CP      $08                 
29A7: D2 AC 29        JP      NC,$29AC            ; {code.loc_29ac}
29AA: AF              XOR     A                   
29AB: C9              RET                         

loc_29ac:
29AC: 3E 01           LD      A,$01               
29AE: C9              RET                         

loc_29af:
29AF: 3E 04           LD      A,$04               
29B1: F7              RST     $30                 
29B2: FD 21 00 62     LD      IY,$6200            
29B6: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
29B9: 4F              LD      C,A                 
29BA: 21 08 04        LD      HL,$0408            
29BD: CD 22 2A        CALL    $2A22               ; {code.loc_2a22}
29C0: A7              AND     A                   
29C1: CA 20 2A        JP      Z,$2A20             ; {code.loc_2a20}
29C4: 3E 06           LD      A,$06               
29C6: 90              SUB     B                   

loc_29c7:
29C7: CA D0 29        JP      Z,$29D0             ; {code.loc_29d0}
29CA: DD 19           ADD     IX,DE               
29CC: 3D              DEC     A                   
29CD: C3 C7 29        JP      $29C7               ; {code.loc_29c7}

loc_29d0:
29D0: DD 7E 05        LD      A,(IX+$05)          
29D3: D6 04           SUB     $04                 
29D5: 57              LD      D,A                 
29D6: 3A 0C 62        LD      A,($620C)           ; {ram.marioAirPrevY}
29D9: C6 05           ADD     A,$05               
29DB: BA              CP      D                   
29DC: D2 EE 29        JP      NC,$29EE            ; {code.loc_29ee}
29DF: 7A              LD      A,D                 
29E0: D6 08           SUB     $08                 
29E2: 32 05 62        LD      ($6205),A           ; {ram.marioY}
29E5: 3E 01           LD      A,$01               
29E7: 47              LD      B,A                 
29E8: 32 98 63        LD      ($6398),A           ; {ram.edgeRepositionFlag}
29EB: 33              INC     SP                  
29EC: 33              INC     SP                  
29ED: C9              RET                         

loc_29ee:
29EE: 3A 0C 62        LD      A,($620C)           ; {ram.marioAirPrevY}
29F1: D6 0E           SUB     $0E                 
29F3: BA              CP      D                   
29F4: D2 1B 2A        JP      NC,$2A1B            ; {code.loc_2a1b}
29F7: 3A 10 62        LD      A,($6210)           ; {ram.marioAirVxHi}
29FA: A7              AND     A                   
29FB: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
29FE: CA 08 2A        JP      Z,$2A08             ; {code.loc_2a08}
2A01: F6 07           OR      $07                 
2A03: D6 04           SUB     $04                 
2A05: C3 0E 2A        JP      $2A0E               ; {code.loc_2a0e}

loc_2a08:
2A08: D6 08           SUB     $08                 
2A0A: F6 07           OR      $07                 
2A0C: C6 04           ADD     A,$04               

loc_2a0e:
2A0E: 32 03 62        LD      ($6203),A           ; {ram.marioX}
2A11: 32 4C 69        LD      ($694C),A           ; {ram.marioSpriteRecord}
2A14: 3E 01           LD      A,$01               
2A16: 06 00           LD      B,$00               
2A18: 33              INC     SP                  
2A19: 33              INC     SP                  
2A1A: C9              RET                         

loc_2a1b:
2A1B: AF              XOR     A                   
2A1C: 32 00 62        LD      ($6200),A           ; {ram.marioActive}
2A1F: C9              RET                         

loc_2a20:
2A20: 47              LD      B,A                 
2A21: C9              RET                         

loc_2a22:
2A22: 06 06           LD      B,$06               
2A24: 11 10 00        LD      DE,$0010            
2A27: DD 21 00 66     LD      IX,$6600            
2A2B: CD 13 29        CALL    $2913               ; {code.findCollidingObject}
2A2E: C9              RET                         

loc_2a2f:
2A2F: DD 7E 03        LD      A,(IX+$03)          
2A32: 67              LD      H,A                 
2A33: DD 7E 05        LD      A,(IX+$05)          
2A36: C6 04           ADD     A,$04               
2A38: 6F              LD      L,A                 
2A39: E5              PUSH    HL                  
2A3A: CD F0 2F        CALL    $2FF0               ; {code.tileAddrForPixel}
2A3D: D1              POP     DE                  
2A3E: 7E              LD      A,(HL)              
2A3F: FE B0           CP      $B0                 
2A41: DA 7B 2A        JP      C,$2A7B             ; {code.loc_2a7b}
2A44: E6 0F           AND     $0F                 
2A46: FE 08           CP      $08                 
2A48: D2 7B 2A        JP      NC,$2A7B            ; {code.loc_2a7b}
2A4B: 7E              LD      A,(HL)              
2A4C: FE C0           CP      $C0                 
2A4E: CA 7B 2A        JP      Z,$2A7B             ; {code.loc_2a7b}
2A51: DA 69 2A        JP      C,$2A69             ; {code.loc_2a69}
2A54: FE D0           CP      $D0                 
2A56: DA 6E 2A        JP      C,$2A6E             ; {code.loc_2a6e}
2A59: FE E0           CP      $E0                 
2A5B: DA 63 2A        JP      C,$2A63             ; {code.loc_2a63}
2A5E: FE F0           CP      $F0                 
2A60: DA 6E 2A        JP      C,$2A6E             ; {code.loc_2a6e}

loc_2a63:
2A63: E6 0F           AND     $0F                 
2A65: 3D              DEC     A                   
2A66: C3 72 2A        JP      $2A72               ; {code.loc_2a72}

loc_2a69:
2A69: 3E FF           LD      A,$FF               
2A6B: C3 72 2A        JP      $2A72               ; {code.loc_2a72}

loc_2a6e:
2A6E: E6 0F           AND     $0F                 
2A70: D6 09           SUB     $09                 

loc_2a72:
2A72: 4F              LD      C,A                 
2A73: 7B              LD      A,E                 
2A74: E6 F8           AND     $F8                 
2A76: 81              ADD     A,C                 
2A77: BB              CP      E                   
2A78: DA 7D 2A        JP      C,$2A7D             ; {code.loc_2a7d}

loc_2a7b:
2A7B: AF              XOR     A                   
2A7C: C9              RET                         

loc_2a7d:
2A7D: D6 04           SUB     $04                 
2A7F: DD 77 05        LD      (IX+$05),A          
2A82: 3E 01           LD      A,$01               
2A84: C9              RET                         

startMarioFallWhenGroundGivesWay:
2A85: 3A 15 62        LD      A,($6215)           ; {ram.marioOnLadder}
2A88: A7              AND     A                   
2A89: C0              RET     NZ                  
2A8A: 3A 16 62        LD      A,($6216)           ; {ram.marioAirborne}
2A8D: A7              AND     A                   
2A8E: C0              RET     NZ                  
2A8F: 3A 98 63        LD      A,($6398)           ; {ram.edgeRepositionFlag}
2A92: FE 01           CP      $01                 
2A94: C8              RET     Z                   
2A95: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
2A98: D6 03           SUB     $03                 
2A9A: 67              LD      H,A                 
2A9B: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
2A9E: C6 0C           ADD     A,$0C               
2AA0: 6F              LD      L,A                 
2AA1: E5              PUSH    HL                  
2AA2: CD F0 2F        CALL    $2FF0               ; {code.tileAddrForPixel}
2AA5: D1              POP     DE                  
2AA6: 7E              LD      A,(HL)              
2AA7: FE B0           CP      $B0                 
2AA9: DA B4 2A        JP      C,$2AB4             ; {code.decideSlopeGirderFooting}
2AAC: E6 0F           AND     $0F                 
2AAE: FE 08           CP      $08                 
2AB0: D2 B4 2A        JP      NC,$2AB4            ; {code.decideSlopeGirderFooting}
2AB3: C9              RET                         

decideSlopeGirderFooting:
2AB4: 7A              LD      A,D                 
2AB5: E6 07           AND     $07                 
2AB7: CA CD 2A        JP      Z,$2ACD             ; {code.triggerMarioFall}
2ABA: 01 20 00        LD      BC,$0020            
2ABD: ED 42           SBC     HL,BC               
2ABF: 7E              LD      A,(HL)              
2AC0: FE B0           CP      $B0                 
2AC2: DA CD 2A        JP      C,$2ACD             ; {code.triggerMarioFall}
2AC5: E6 0F           AND     $0F                 
2AC7: FE 08           CP      $08                 
2AC9: D2 CD 2A        JP      NC,$2ACD            ; {code.triggerMarioFall}
2ACC: C9              RET                         

triggerMarioFall:
2ACD: 3E 01           LD      A,$01               
2ACF: 32 21 62        LD      ($6221),A           ; {ram.marioStartFall}
2AD2: C9              RET                         

carryMarioOnConveyorRow:
2AD3: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
2AD6: 47              LD      B,A                 
2AD7: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
2ADA: FE 50           CP      $50                 
2ADC: CA EA 2A        JP      Z,$2AEA             ; {code.loc_2aea}
2ADF: FE 78           CP      $78                 
2AE1: CA F6 2A        JP      Z,$2AF6             ; {code.selectConveyorStepAndMoveMario}
2AE4: FE C8           CP      $C8                 
2AE6: CA F0 2A        JP      Z,$2AF0             ; {code.loc_2af0}
2AE9: C9              RET                         

loc_2aea:
2AEA: 3A A3 63        LD      A,($63A3)           ; {ram.m50Obj1Step}
2AED: C3 02 2B        JP      $2B02               ; {code.moveMarioX}

loc_2af0:
2AF0: 3A A6 63        LD      A,($63A6)           ; {ram.m50Obj3Step}
2AF3: C3 02 2B        JP      $2B02               ; {code.moveMarioX}

selectConveyorStepAndMoveMario:
2AF6: 78              LD      A,B                 
2AF7: FE 80           CP      $80                 
2AF9: 3A A5 63        LD      A,($63A5)           ; {ram.m50Obj2StepPos}
2AFC: D2 02 2B        JP      NC,$2B02            ; {code.moveMarioX}
2AFF: 3A A4 63        LD      A,($63A4)           ; {ram.m50Obj2StepNeg}

moveMarioX:
2B02: 80              ADD     A,B                 
2B03: 32 03 62        LD      ($6203),A           ; {ram.marioX}
2B06: 32 4C 69        LD      ($694C),A           ; {ram.marioSpriteRecord}
2B09: CD 1F 24        CALL    $241F               ; {code.limitMarioHorizontalTravel}
2B0C: 21 03 62        LD      HL,$6203            
2B0F: 1D              DEC     E                   
2B10: CA 18 2B        JP      Z,$2B18             ; {code.loc_2b18}
2B13: 15              DEC     D                   
2B14: CA 1A 2B        JP      Z,$2B1A             ; {code.loc_2b1a}
2B17: C9              RET                         

loc_2b18:
2B18: 35              DEC     (HL)                
2B19: C9              RET                         

loc_2b1a:
2B1A: 34              INC     (HL)                
2B1B: C9              RET                         

loc_2b1c:
2B1C: DD 21 00 62     LD      IX,$6200            
2B20: CD 29 2B        CALL    $2B29               ; {code.probeMarioDescentLanding}
2B23: CD AF 29        CALL    $29AF               ; {code.loc_29af}
2B26: AF              XOR     A                   
2B27: 47              LD      B,A                 
2B28: C9              RET                         

probeMarioDescentLanding:
2B29: 3A 27 62        LD      A,($6227)           ; {ram.board}
2B2C: 3D              DEC     A                   
2B2D: C2 53 2B        JP      NZ,$2B53            ; {code.loc_2b53}
2B30: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
2B33: 67              LD      H,A                 
2B34: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
2B37: C6 07           ADD     A,$07               
2B39: 6F              LD      L,A                 
2B3A: CD 9B 2B        CALL    $2B9B               ; {code.probeTileForLanding}

loc_2b3d:
2B3D: A7              AND     A                   
2B3E: CA 51 2B        JP      Z,$2B51             ; {code.loc_2b51}
2B41: 7B              LD      A,E                 
2B42: 91              SUB     C                   
2B43: FE 04           CP      $04                 
2B45: D2 74 2B        JP      NC,$2B74            ; {code.loc_2b74}
2B48: 79              LD      A,C                 
2B49: D6 07           SUB     $07                 
2B4B: 32 05 62        LD      ($6205),A           ; {ram.marioY}
2B4E: 3E 01           LD      A,$01               
2B50: 47              LD      B,A                 

loc_2b51:
2B51: E1              POP     HL                  
2B52: C9              RET                         

loc_2b53:
2B53: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
2B56: D6 03           SUB     $03                 
2B58: 67              LD      H,A                 
2B59: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
2B5C: C6 07           ADD     A,$07               
2B5E: 6F              LD      L,A                 
2B5F: CD 9B 2B        CALL    $2B9B               ; {code.probeTileForLanding}
2B62: FE 02           CP      $02                 
2B64: CA 7A 2B        JP      Z,$2B7A             ; {code.loc_2b7a}
2B67: 7A              LD      A,D                 
2B68: C6 07           ADD     A,$07               
2B6A: 67              LD      H,A                 
2B6B: 6B              LD      L,E                 
2B6C: CD 9B 2B        CALL    $2B9B               ; {code.probeTileForLanding}
2B6F: A7              AND     A                   
2B70: C8              RET     Z                   
2B71: C3 7A 2B        JP      $2B7A               ; {code.loc_2b7a}

loc_2b74:
2B74: 3E 00           LD      A,$00               
2B76: 06 00           LD      B,$00               
2B78: E1              POP     HL                  
2B79: C9              RET                         

loc_2b7a:
2B7A: 3A 10 62        LD      A,($6210)           ; {ram.marioAirVxHi}
2B7D: A7              AND     A                   
2B7E: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
2B81: CA 8B 2B        JP      Z,$2B8B             ; {code.loc_2b8b}
2B84: F6 07           OR      $07                 
2B86: D6 04           SUB     $04                 
2B88: C3 91 2B        JP      $2B91               ; {code.loc_2b91}

loc_2b8b:
2B8B: D6 08           SUB     $08                 
2B8D: F6 07           OR      $07                 
2B8F: C6 04           ADD     A,$04               

loc_2b91:
2B91: 32 03 62        LD      ($6203),A           ; {ram.marioX}
2B94: 32 4C 69        LD      ($694C),A           ; {ram.marioSpriteRecord}
2B97: 3E 01           LD      A,$01               
2B99: E1              POP     HL                  
2B9A: C9              RET                         

probeTileForLanding:
2B9B: E5              PUSH    HL                  
2B9C: CD F0 2F        CALL    $2FF0               ; {code.tileAddrForPixel}
2B9F: D1              POP     DE                  
2BA0: 7E              LD      A,(HL)              
2BA1: FE B0           CP      $B0                 
2BA3: DA D9 2B        JP      C,$2BD9             ; {code.loc_2bd9}
2BA6: E6 0F           AND     $0F                 
2BA8: FE 08           CP      $08                 
2BAA: D2 D9 2B        JP      NC,$2BD9            ; {code.loc_2bd9}
2BAD: 7E              LD      A,(HL)              
2BAE: FE C0           CP      $C0                 
2BB0: CA D9 2B        JP      Z,$2BD9             ; {code.loc_2bd9}
2BB3: DA DC 2B        JP      C,$2BDC             ; {code.loc_2bdc}
2BB6: FE D0           CP      $D0                 
2BB8: DA CB 2B        JP      C,$2BCB             ; {code.loc_2bcb}
2BBB: FE E0           CP      $E0                 
2BBD: DA C5 2B        JP      C,$2BC5             ; {code.loc_2bc5}
2BC0: FE F0           CP      $F0                 
2BC2: DA CB 2B        JP      C,$2BCB             ; {code.loc_2bcb}

loc_2bc5:
2BC5: E6 0F           AND     $0F                 
2BC7: 3D              DEC     A                   
2BC8: C3 CF 2B        JP      $2BCF               ; {code.loc_2bcf}

loc_2bcb:
2BCB: E6 0F           AND     $0F                 
2BCD: D6 09           SUB     $09                 

loc_2bcf:
2BCF: 4F              LD      C,A                 
2BD0: 7B              LD      A,E                 
2BD1: E6 F8           AND     $F8                 
2BD3: 81              ADD     A,C                 
2BD4: 4F              LD      C,A                 
2BD5: BB              CP      E                   
2BD6: DA E1 2B        JP      C,$2BE1             ; {code.resolveAirborneTileLanding}

loc_2bd9:
2BD9: AF              XOR     A                   
2BDA: 47              LD      B,A                 
2BDB: C9              RET                         

loc_2bdc:
2BDC: 7B              LD      A,E                 
2BDD: E6 F8           AND     $F8                 
2BDF: 3D              DEC     A                   
2BE0: 4F              LD      C,A                 

resolveAirborneTileLanding:
2BE1: 3A 0C 62        LD      A,($620C)           ; {ram.marioAirPrevY}
2BE4: DD 96 05        SUB     (IX+$05)            
2BE7: 83              ADD     A,E                 
2BE8: B9              CP      C                   
2BE9: CA EF 2B        JP      Z,$2BEF             ; {code.loc_2bef}
2BEC: D2 F8 2B        JP      NC,$2BF8            ; {code.loc_2bf8}

loc_2bef:
2BEF: 79              LD      A,C                 
2BF0: D6 07           SUB     $07                 
2BF2: 32 05 62        LD      ($6205),A           ; {ram.marioY}
2BF5: C3 FD 2B        JP      $2BFD               ; {code.loc_2bfd}

loc_2bf8:
2BF8: 3E 02           LD      A,$02               
2BFA: 06 00           LD      B,$00               
2BFC: C9              RET                         

loc_2bfd:
2BFD: 3E 01           LD      A,$01               
2BFF: 47              LD      B,A                 
2C00: E1              POP     HL                  
2C01: E1              POP     HL                  
2C02: C9              RET                         

scheduleBarrelRelease:
2C03: 3E 01           LD      A,$01               
2C05: F7              RST     $30                 
2C06: D7              RST     $10                 
2C07: 3A 93 63        LD      A,($6393)           ; {hard.workRam+393}
2C0A: 0F              RRCA                        
2C0B: D8              RET     C                   
2C0C: 3A B1 62        LD      A,($62B1)           ; {ram.bonus}
2C0F: A7              AND     A                   
2C10: C8              RET     Z                   
2C11: 4F              LD      C,A                 
2C12: 3A B0 62        LD      A,($62B0)           ; {ram.bonusStart}
2C15: D6 02           SUB     $02                 
2C17: B9              CP      C                   
2C18: DA 7B 2C        JP      C,$2C7B             ; {code.loc_2c7b}
2C1B: 3A 82 63        LD      A,($6382)           ; {ram.barrelClaimMode}
2C1E: CB 4F           BIT     1,A                 
2C20: C2 86 2C        JP      NZ,$2C86            ; {code.loc_2c86}
2C23: 3A 80 63        LD      A,($6380)           ; {ram.difficulty}
2C26: 47              LD      B,A                 
2C27: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
2C2A: E6 1F           AND     $1F                 

loc_2c2c:
2C2C: B8              CP      B                   
2C2D: CA 33 2C        JP      Z,$2C33             ; {code.loc_2c33}
2C30: 10 FA           DJNZ    $2C2C               ; {code.loc_2c2c}
2C32: C9              RET                         

loc_2c33:
2C33: 3A B0 62        LD      A,($62B0)           ; {ram.bonusStart}
2C36: CB 3F           SRL     A                   
2C38: B9              CP      C                   
2C39: DA 41 2C        JP      C,$2C41             ; {code.loc_2c41}
2C3C: 3A 19 60        LD      A,($6019)           ; {ram.spinCount}
2C3F: 0F              RRCA                        
2C40: D0              RET     NC                  

loc_2c41:
2C41: CD 57 00        CALL    $0057               ; {code.stirRandomSeed}
2C44: E6 0F           AND     $0F                 
2C46: C2 86 2C        JP      NZ,$2C86            ; {code.loc_2c86}

loc_2c49:
2C49: 3E 01           LD      A,$01               

loc_2c4b:
2C4B: 32 82 63        LD      ($6382),A           ; {ram.barrelClaimMode}
2C4E: 3C              INC     A                   

armBarrelRelease:
2C4F: 32 8F 63        LD      ($638F),A           ; {hard.workRam+38F}
2C52: 3E 01           LD      A,$01               
2C54: 32 92 63        LD      ($6392),A           ; {hard.workRam+392}
2C57: 3A B2 62        LD      A,($62B2)           ; {ram.bonusEventMark}
2C5A: B9              CP      C                   
2C5B: C0              RET     NZ                  
2C5C: D6 08           SUB     $08                 
2C5E: 32 B2 62        LD      ($62B2),A           ; {ram.bonusEventMark}
2C61: 11 20 00        LD      DE,$0020            
2C64: 21 00 64        LD      HL,$6400            
2C67: 06 05           LD      B,$05               

loc_2c69:
2C69: 7E              LD      A,(HL)              
2C6A: A7              AND     A                   
2C6B: CA 72 2C        JP      Z,$2C72             ; {code.markNextBarrelAsAltKind}
2C6E: 19              ADD     HL,DE               
2C6F: 10 F8           DJNZ    $2C69               ; {code.loc_2c69}
2C71: C9              RET                         

markNextBarrelAsAltKind:
2C72: 3A 82 63        LD      A,($6382)           ; {ram.barrelClaimMode}
2C75: F6 80           OR      $80                 
2C77: 32 82 63        LD      ($6382),A           ; {ram.barrelClaimMode}
2C7A: C9              RET                         

loc_2c7b:
2C7B: C6 02           ADD     A,$02               
2C7D: B9              CP      C                   
2C7E: CA 49 2C        JP      Z,$2C49             ; {code.loc_2c49}
2C81: 3E 02           LD      A,$02               
2C83: C3 4B 2C        JP      $2C4B               ; {code.loc_2c4b}

loc_2c86:
2C86: AF              XOR     A                   
2C87: 32 82 63        LD      ($6382),A           ; {ram.barrelClaimMode}
2C8A: 3E 03           LD      A,$03               
2C8C: C3 4F 2C        JP      $2C4F               ; {code.armBarrelRelease}

driveBarrelRelease:
2C8F: 3E 01           LD      A,$01               
2C91: F7              RST     $30                 
2C92: D7              RST     $10                 
2C93: 3A 93 63        LD      A,($6393)           ; {hard.workRam+393}
2C96: 0F              RRCA                        
2C97: DA 15 2D        JP      C,$2D15             ; {code.advanceBarrelRelease}
2C9A: 3A 92 63        LD      A,($6392)           ; {hard.workRam+392}
2C9D: 0F              RRCA                        
2C9E: D0              RET     NC                  
2C9F: DD 21 00 67     LD      IX,$6700            
2CA3: 11 20 00        LD      DE,$0020            
2CA6: 06 0A           LD      B,$0A               

loc_2ca8:
2CA8: DD 7E 00        LD      A,(IX+$00)          
2CAB: 0F              RRCA                        
2CAC: DA B3 2C        JP      C,$2CB3             ; {code.loc_2cb3}
2CAF: 0F              RRCA                        
2CB0: D2 B8 2C        JP      NC,$2CB8            ; {code.releaseBarrelIntoFreeSlot}

loc_2cb3:
2CB3: DD 19           ADD     IX,DE               
2CB5: 10 F1           DJNZ    $2CA8               ; {code.loc_2ca8}
2CB7: C9              RET                         

releaseBarrelIntoFreeSlot:
2CB8: DD 22 AA 62     LD      ($62AA),IX          ; {ram.renderObjPtr}
2CBC: DD 36 00 02     LD      (IX+$00),$02        
2CC0: 16 00           LD      D,$00               
2CC2: 3E 0A           LD      A,$0A               
2CC4: 90              SUB     B                   
2CC5: 87              ADD     A,A                 
2CC6: 87              ADD     A,A                 
2CC7: 5F              LD      E,A                 
2CC8: 21 80 69        LD      HL,$6980            
2CCB: 19              ADD     HL,DE               
2CCC: 22 AC 62        LD      ($62AC),HL          ; {ram.renderDstPtr}
2CCF: 3E 01           LD      A,$01               
2CD1: 32 93 63        LD      ($6393),A           ; {hard.workRam+393}
2CD4: 11 01 05        LD      DE,$0501            
2CD7: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
2CDA: 21 B1 62        LD      HL,$62B1            
2CDD: 35              DEC     (HL)                
2CDE: C2 E6 2C        JP      NZ,$2CE6            ; {code.loc_2ce6}
2CE1: 3E 01           LD      A,$01               
2CE3: 32 86 63        LD      ($6386),A           ; {ram.bonusExpiredStep}

loc_2ce6:
2CE6: 7E              LD      A,(HL)              
2CE7: FE 04           CP      $04                 
2CE9: D2 F6 2C        JP      NC,$2CF6            ; {code.stampReleasedBarrelKind}
2CEC: 21 A8 69        LD      HL,$69A8            
2CEF: 87              ADD     A,A                 
2CF0: 87              ADD     A,A                 
2CF1: 5F              LD      E,A                 
2CF2: 16 00           LD      D,$00               
2CF4: 19              ADD     HL,DE               
2CF5: 72              LD      (HL),D              

stampReleasedBarrelKind:
2CF6: DD 36 07 15     LD      (IX+$07),$15        
2CFA: DD 36 08 0B     LD      (IX+$08),$0B        
2CFE: DD 36 15 00     LD      (IX+$15),$00        
2D02: 3A 82 63        LD      A,($6382)           ; {ram.barrelClaimMode}
2D05: 07              RLCA                        
2D06: D2 15 2D        JP      NC,$2D15            ; {code.advanceBarrelRelease}
2D09: DD 36 07 19     LD      (IX+$07),$19        
2D0D: DD 36 08 0C     LD      (IX+$08),$0C        
2D11: DD 36 15 01     LD      (IX+$15),$01        

advanceBarrelRelease:
2D15: 21 AF 62        LD      HL,$62AF            
2D18: 35              DEC     (HL)                
2D19: C0              RET     NZ                  
2D1A: 36 18           LD      (HL),$18            
2D1C: 3A 8F 63        LD      A,($638F)           ; {hard.workRam+38F}
2D1F: A7              AND     A                   
2D20: CA 51 2D        JP      Z,$2D51             ; {code.loc_2d51}
2D23: 4F              LD      C,A                 
2D24: 21 32 39        LD      HL,$3932            
2D27: 3A 82 63        LD      A,($6382)           ; {ram.barrelClaimMode}
2D2A: 0F              RRCA                        
2D2B: DA 2F 2D        JP      C,$2D2F             ; {code.loc_2d2f}
2D2E: 0D              DEC     C                   

loc_2d2f:
2D2F: 79              LD      A,C                 
2D30: 87              ADD     A,A                 
2D31: 87              ADD     A,A                 
2D32: 87              ADD     A,A                 
2D33: 4F              LD      C,A                 
2D34: 87              ADD     A,A                 
2D35: 87              ADD     A,A                 
2D36: 81              ADD     A,C                 
2D37: 5F              LD      E,A                 
2D38: 16 00           LD      D,$00               
2D3A: 19              ADD     HL,DE               
2D3B: CD 4E 00        CALL    $004E               ; {code.loadSpriteObjectBlock}
2D3E: 21 8F 63        LD      HL,$638F            
2D41: 35              DEC     (HL)                
2D42: C2 51 2D        JP      NZ,$2D51            ; {code.loc_2d51}
2D45: 3E 01           LD      A,$01               
2D47: 32 AF 62        LD      ($62AF),A           ; {hard.workRam+2AF}
2D4A: 3A 82 63        LD      A,($6382)           ; {ram.barrelClaimMode}
2D4D: 0F              RRCA                        
2D4E: DA 83 2D        JP      C,$2D83             ; {code.loc_2d83}

loc_2d51:
2D51: 2A A8 62        LD      HL,($62A8)          ; {ram.renderStrPtr}

stepBarrelAlongReleasePath:
2D54: 7E              LD      A,(HL)              
2D55: DD 2A AA 62     LD      IX,($62AA)          ; {ram.renderObjPtr}
2D59: ED 5B AC 62     LD      DE,($62AC)          ; {ram.renderDstPtr}
2D5D: FE 7F           CP      $7F                 
2D5F: CA 8C 2D        JP      Z,$2D8C             ; {code.activateReleasedBarrel}
2D62: 4F              LD      C,A                 
2D63: E6 7F           AND     $7F                 
2D65: 12              LD      (DE),A              
2D66: DD 7E 07        LD      A,(IX+$07)          
2D69: CB 79           BIT     7,C                 
2D6B: CA 70 2D        JP      Z,$2D70             ; {code.loc_2d70}
2D6E: EE 03           XOR     $03                 

loc_2d70:
2D70: 13              INC     DE                  
2D71: 12              LD      (DE),A              
2D72: DD 77 07        LD      (IX+$07),A          
2D75: DD 7E 08        LD      A,(IX+$08)          
2D78: 13              INC     DE                  
2D79: 12              LD      (DE),A              
2D7A: 23              INC     HL                  
2D7B: 7E              LD      A,(HL)              
2D7C: 13              INC     DE                  
2D7D: 12              LD      (DE),A              
2D7E: 23              INC     HL                  
2D7F: 22 A8 62        LD      ($62A8),HL          ; {ram.renderStrPtr}
2D82: C9              RET                         

loc_2d83:
2D83: 21 CC 39        LD      HL,$39CC            
2D86: 22 A8 62        LD      ($62A8),HL          ; {ram.renderStrPtr}
2D89: C3 54 2D        JP      $2D54               ; {code.stepBarrelAlongReleasePath}

activateReleasedBarrel:
2D8C: 21 C3 39        LD      HL,$39C3            
2D8F: 22 A8 62        LD      ($62A8),HL          ; {ram.renderStrPtr}
2D92: DD 36 01 01     LD      (IX+$01),$01        
2D96: 3A 82 63        LD      A,($6382)           ; {ram.barrelClaimMode}
2D99: 0F              RRCA                        
2D9A: DA A5 2D        JP      C,$2DA5             ; {code.loc_2da5}
2D9D: DD 36 01 00     LD      (IX+$01),$00        
2DA1: DD 36 02 02     LD      (IX+$02),$02        

loc_2da5:
2DA5: DD 36 00 01     LD      (IX+$00),$01        
2DA9: DD 36 0F 01     LD      (IX+$0F),$01        
2DAD: AF              XOR     A                   
2DAE: DD 77 10        LD      (IX+$10),A          
2DB1: DD 77 11        LD      (IX+$11),A          
2DB4: DD 77 12        LD      (IX+$12),A          
2DB7: DD 77 13        LD      (IX+$13),A          
2DBA: DD 77 14        LD      (IX+$14),A          
2DBD: 32 93 63        LD      ($6393),A           ; {hard.workRam+393}
2DC0: 32 92 63        LD      ($6392),A           ; {hard.workRam+392}
2DC3: 1A              LD      A,(DE)              
2DC4: DD 77 03        LD      (IX+$03),A          
2DC7: 13              INC     DE                  
2DC8: 13              INC     DE                  
2DC9: 13              INC     DE                  
2DCA: 1A              LD      A,(DE)              
2DCB: DD 77 05        LD      (IX+$05),A          
2DCE: 21 5C 38        LD      HL,$385C            
2DD1: CD 4E 00        CALL    $004E               ; {code.loadSpriteObjectBlock}
2DD4: 21 0B 69        LD      HL,$690B            
2DD7: 0E FC           LD      C,$FC               
2DD9: FF              RST     $38                 
2DDA: C9              RET                         

raisePeriodicObjectSpawnRequests:
2DDB: 3E 0A           LD      A,$0A               
2DDD: F7              RST     $30                 
2DDE: D7              RST     $10                 
2DDF: 3A 80 63        LD      A,($6380)           ; {ram.difficulty}
2DE2: 3C              INC     A                   
2DE3: A7              AND     A                   
2DE4: 1F              RRA                         
2DE5: 47              LD      B,A                 
2DE6: 3A 27 62        LD      A,($6227)           ; {ram.board}
2DE9: FE 02           CP      $02                 
2DEB: 20 01           JR      NZ,$2DEE            ; {code.loc_2dee}
2DED: 04              INC     B                   

loc_2dee:
2DEE: 3E FE           LD      A,$FE               
2DF0: 37              SCF                         

loc_2df1:
2DF1: 1F              RRA                         
2DF2: A7              AND     A                   
2DF3: 10 FC           DJNZ    $2DF1               ; {code.loc_2df1}
2DF5: 47              LD      B,A                 
2DF6: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
2DF9: A0              AND     B                   
2DFA: C0              RET     NZ                  
2DFB: 3E 01           LD      A,$01               
2DFD: 32 A0 63        LD      ($63A0),A           ; {ram.eventReq313c}
2E00: 32 9A 63        LD      ($639A),A           ; {ram.objSpawnReq}
2E03: C9              RET                         

update75mActorObjects:
2E04: 3E 04           LD      A,$04               
2E06: F7              RST     $30                 
2E07: D7              RST     $10                 
2E08: DD 21 00 65     LD      IX,$6500            
2E0C: FD 21 80 69     LD      IY,$6980            
2E10: 06 0A           LD      B,$0A               

advanceSpring:
2E12: DD 7E 00        LD      A,(IX+$00)          
2E15: 0F              RRCA                        
2E16: D2 A7 2E        JP      NC,$2EA7            ; {code.spawnObjectIntoInactiveSlot}
2E19: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
2E1C: E6 0F           AND     $0F                 
2E1E: C2 29 2E        JP      NZ,$2E29            ; {code.loc_2e29}
2E21: FD 7E 01        LD      A,(IY+$01)          
2E24: EE 07           XOR     $07                 
2E26: FD 77 01        LD      (IY+$01),A          

loc_2e29:
2E29: DD 7E 0D        LD      A,(IX+$0D)          
2E2C: FE 04           CP      $04                 
2E2E: CA 84 2E        JP      Z,$2E84             ; {code.loc_2e84}
2E31: DD 34 03        INC     (IX+$03)            
2E34: DD 34 03        INC     (IX+$03)            
2E37: DD 6E 0E        LD      L,(IX+$0E)          
2E3A: DD 66 0F        LD      H,(IX+$0F)          
2E3D: 7E              LD      A,(HL)              
2E3E: 4F              LD      C,A                 
2E3F: FE 7F           CP      $7F                 
2E41: CA 9C 2E        JP      Z,$2E9C             ; {code.loc_2e9c}
2E44: 23              INC     HL                  
2E45: DD 86 05        ADD     A,(IX+$05)          
2E48: DD 77 05        LD      (IX+$05),A          

advanceSpringArcAndDropAtTravelEnd:
2E4B: DD 75 0E        LD      (IX+$0E),L          
2E4E: DD 74 0F        LD      (IX+$0F),H          
2E51: DD 7E 03        LD      A,(IX+$03)          
2E54: FE B7           CP      $B7                 
2E56: DA 6C 2E        JP      C,$2E6C             ; {code.mirrorObjectPositionToSprite}
2E59: 79              LD      A,C                 
2E5A: FE 7F           CP      $7F                 
2E5C: C2 6C 2E        JP      NZ,$2E6C            ; {code.mirrorObjectPositionToSprite}
2E5F: DD 36 0D 04     LD      (IX+$0D),$04        
2E63: AF              XOR     A                   
2E64: 32 83 60        LD      ($6083),A           ; {hard.workRam+83}
2E67: 3E 03           LD      A,$03               
2E69: 32 84 60        LD      ($6084),A           ; {hard.workRam+84}

mirrorObjectPositionToSprite:
2E6C: DD 7E 03        LD      A,(IX+$03)          
2E6F: FD 77 00        LD      (IY+$00),A          
2E72: DD 7E 05        LD      A,(IX+$05)          
2E75: FD 77 03        LD      (IY+$03),A          

advanceToNextObject:
2E78: 11 10 00        LD      DE,$0010            
2E7B: DD 19           ADD     IX,DE               
2E7D: 1E 04           LD      E,$04               
2E7F: FD 19           ADD     IY,DE               
2E81: 10 8F           DJNZ    $2E12               ; {code.advanceSpring}
2E83: C9              RET                         

loc_2e84:
2E84: 3E 03           LD      A,$03               
2E86: DD 86 05        ADD     A,(IX+$05)          
2E89: DD 77 05        LD      (IX+$05),A          
2E8C: FE F8           CP      $F8                 
2E8E: DA 6C 2E        JP      C,$2E6C             ; {code.mirrorObjectPositionToSprite}
2E91: DD 36 03 00     LD      (IX+$03),$00        
2E95: DD 36 00 00     LD      (IX+$00),$00        
2E99: C3 6C 2E        JP      $2E6C               ; {code.mirrorObjectPositionToSprite}

loc_2e9c:
2E9C: 21 AA 39        LD      HL,$39AA            
2E9F: 3E 03           LD      A,$03               
2EA1: 32 83 60        LD      ($6083),A           ; {hard.workRam+83}
2EA4: C3 4B 2E        JP      $2E4B               ; {code.advanceSpringArcAndDropAtTravelEnd}

spawnObjectIntoInactiveSlot:
2EA7: 3A 96 63        LD      A,($6396)           ; {ram.spawnRequest}
2EAA: 0F              RRCA                        
2EAB: D2 78 2E        JP      NC,$2E78            ; {code.advanceToNextObject}
2EAE: AF              XOR     A                   
2EAF: 32 96 63        LD      ($6396),A           ; {ram.spawnRequest}
2EB2: DD 36 05 50     LD      (IX+$05),$50        
2EB6: DD 36 0D 01     LD      (IX+$0D),$01        
2EBA: CD 57 00        CALL    $0057               ; {code.stirRandomSeed}
2EBD: E6 0F           AND     $0F                 
2EBF: C6 F8           ADD     A,$F8               
2EC1: DD 77 03        LD      (IX+$03),A          
2EC4: DD 36 00 01     LD      (IX+$00),$01        
2EC8: 21 AA 39        LD      HL,$39AA            
2ECB: DD 75 0E        LD      (IX+$0E),L          
2ECE: DD 74 0F        LD      (IX+$0F),H          
2ED1: C3 78 2E        JP      $2E78               ; {code.advanceToNextObject}

driveHammerSprite:
2ED4: 3E 0B           LD      A,$0B               
2ED6: F7              RST     $30                 
2ED7: D7              RST     $10                 
2ED8: 11 18 6A        LD      DE,$6A18            
2EDB: DD 21 80 66     LD      IX,$6680            
2EDF: DD 7E 01        LD      A,(IX+$01)          
2EE2: 0F              RRCA                        
2EE3: DA ED 2E        JP      C,$2EED             ; {code.loc_2eed}
2EE6: 11 1C 6A        LD      DE,$6A1C            
2EE9: DD 21 90 66     LD      IX,$6690            

loc_2eed:
2EED: DD 36 0E 00     LD      (IX+$0E),$00        
2EF1: DD 36 0F F0     LD      (IX+$0F),$F0        
2EF5: 3A 17 62        LD      A,($6217)           ; {ram.marioHammerActive}
2EF8: 0F              RRCA                        
2EF9: D2 97 2F        JP      NC,$2F97            ; {code.buildPendingHammerSprite}
2EFC: AF              XOR     A                   
2EFD: 32 18 62        LD      ($6218),A           ; {ram.marioHammerPending}
2F00: 21 89 60        LD      HL,$6089            
2F03: 36 04           LD      (HL),$04            
2F05: DD 36 09 06     LD      (IX+$09),$06        
2F09: DD 36 0A 03     LD      (IX+$0A),$03        
2F0D: 06 1E           LD      B,$1E               
2F0F: 3A 07 62        LD      A,($6207)           ; {ram.marioSpriteCode}
2F12: CB 27           SLA     A                   
2F14: D2 1B 2F        JP      NC,$2F1B            ; {code.loc_2f1b}
2F17: F6 80           OR      $80                 
2F19: CB F8           SET     7,B                 

loc_2f1b:
2F1B: F6 08           OR      $08                 
2F1D: 4F              LD      C,A                 
2F1E: 3A 94 63        LD      A,($6394)           ; {ram.hammerTimerLo}
2F21: CB 5F           BIT     3,A                 
2F23: CA 43 2F        JP      Z,$2F43             ; {code.updateActiveHammer}
2F26: CB C0           SET     0,B                 
2F28: CB C1           SET     0,C                 
2F2A: DD 36 09 05     LD      (IX+$09),$05        
2F2E: DD 36 0A 06     LD      (IX+$0A),$06        
2F32: DD 36 0F 00     LD      (IX+$0F),$00        
2F36: DD 36 0E F0     LD      (IX+$0E),$F0        
2F3A: CB 79           BIT     7,C                 
2F3C: CA 43 2F        JP      Z,$2F43             ; {code.updateActiveHammer}
2F3F: DD 36 0E 10     LD      (IX+$0E),$10        

updateActiveHammer:
2F43: 79              LD      A,C                 
2F44: 32 4D 69        LD      ($694D),A           ; {hard.workRam+94D}
2F47: 0E 07           LD      C,$07               
2F49: 21 94 63        LD      HL,$6394            
2F4C: 34              INC     (HL)                
2F4D: C2 B7 2F        JP      NZ,$2FB7            ; {code.selectHammerSpriteBlinkByTimer}
2F50: 21 95 63        LD      HL,$6395            
2F53: 34              INC     (HL)                
2F54: 7E              LD      A,(HL)              
2F55: FE 02           CP      $02                 
2F57: C2 BE 2F        JP      NZ,$2FBE            ; {code.blinkHammerSpriteOnFramePhase}
2F5A: AF              XOR     A                   
2F5B: 32 95 63        LD      ($6395),A           ; {ram.hammerTimerHi}
2F5E: 32 17 62        LD      ($6217),A           ; {ram.marioHammerActive}
2F61: DD 77 01        LD      (IX+$01),A          
2F64: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
2F67: ED 44           NEG                         
2F69: DD 77 0E        LD      (IX+$0E),A          
2F6C: 3A 07 62        LD      A,($6207)           ; {ram.marioSpriteCode}
2F6F: 32 4D 69        LD      ($694D),A           ; {hard.workRam+94D}
2F72: DD 36 00 00     LD      (IX+$00),$00        
2F76: 3A 89 63        LD      A,($6389)           ; {ram.hammerSavedBgm}
2F79: 32 89 60        LD      ($6089),A           ; {ram.sndBgm}

commitSpriteRecordAtMarioOffset:
2F7C: EB              EX      DE,HL               
2F7D: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
2F80: DD 86 0E        ADD     A,(IX+$0E)          
2F83: 77              LD      (HL),A              
2F84: DD 77 03        LD      (IX+$03),A          
2F87: 23              INC     HL                  
2F88: 70              LD      (HL),B              
2F89: 23              INC     HL                  
2F8A: 71              LD      (HL),C              
2F8B: 23              INC     HL                  
2F8C: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
2F8F: DD 86 0F        ADD     A,(IX+$0F)          
2F92: 77              LD      (HL),A              
2F93: DD 77 05        LD      (IX+$05),A          
2F96: C9              RET                         

buildPendingHammerSprite:
2F97: 3A 18 62        LD      A,($6218)           ; {ram.marioHammerPending}
2F9A: 0F              RRCA                        
2F9B: D0              RET     NC                  
2F9C: DD 36 09 06     LD      (IX+$09),$06        
2FA0: DD 36 0A 03     LD      (IX+$0A),$03        
2FA4: 3A 07 62        LD      A,($6207)           ; {ram.marioSpriteCode}
2FA7: 07              RLCA                        
2FA8: 3E 3C           LD      A,$3C               
2FAA: 1F              RRA                         
2FAB: 47              LD      B,A                 
2FAC: 0E 07           LD      C,$07               
2FAE: 3A 89 60        LD      A,($6089)           ; {ram.sndBgm}
2FB1: 32 89 63        LD      ($6389),A           ; {ram.hammerSavedBgm}
2FB4: C3 7C 2F        JP      $2F7C               ; {code.commitSpriteRecordAtMarioOffset}

selectHammerSpriteBlinkByTimer:
2FB7: 3A 95 63        LD      A,($6395)           ; {ram.hammerTimerHi}
2FBA: A7              AND     A                   
2FBB: CA 7C 2F        JP      Z,$2F7C             ; {code.commitSpriteRecordAtMarioOffset}

blinkHammerSpriteOnFramePhase:
2FBE: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
2FC1: CB 5F           BIT     3,A                 
2FC3: CA 7C 2F        JP      Z,$2F7C             ; {code.commitSpriteRecordAtMarioOffset}
2FC6: 0E 01           LD      C,$01               
2FC8: C3 7C 2F        JP      $2F7C               ; {code.commitSpriteRecordAtMarioOffset}

tickTimedBoardBonus:
2FCB: 3E 0E           LD      A,$0E               
2FCD: F7              RST     $30                 
2FCE: 21 B4 62        LD      HL,$62B4            
2FD1: 35              DEC     (HL)                
2FD2: C0              RET     NZ                  
2FD3: 3E 03           LD      A,$03               
2FD5: 32 B9 62        LD      ($62B9),A           ; {hard.workRam+2B9}
2FD8: 32 96 63        LD      ($6396),A           ; {ram.spawnRequest}
2FDB: 11 01 05        LD      DE,$0501            
2FDE: CD 9F 30        CALL    $309F               ; {code.enqueueTask}
2FE1: 3A B3 62        LD      A,($62B3)           ; {ram.bonusPeriod}
2FE4: 77              LD      (HL),A              
2FE5: 21 B1 62        LD      HL,$62B1            
2FE8: 35              DEC     (HL)                
2FE9: C0              RET     NZ                  
2FEA: 3E 01           LD      A,$01               
2FEC: 32 86 63        LD      ($6386),A           ; {ram.bonusExpiredStep}
2FEF: C9              RET                         

tileAddrForPixel:
2FF0: 7D              LD      A,L                 
2FF1: 0F              RRCA                        
2FF2: 0F              RRCA                        
2FF3: 0F              RRCA                        
2FF4: E6 1F           AND     $1F                 
2FF6: 6F              LD      L,A                 
2FF7: 7C              LD      A,H                 
2FF8: 2F              CPL                         
2FF9: E6 F8           AND     $F8                 
2FFB: 5F              LD      E,A                 
2FFC: AF              XOR     A                   
2FFD: 67              LD      H,A                 
2FFE: CB 13           RL      E                   
3000: 17              RLA                         
3001: CB 13           RL      E                   
3003: 17              RLA                         
3004: C6 74           ADD     A,$74               
3006: 57              LD      D,A                 
3007: 19              ADD     HL,DE               
3008: C9              RET                         

nextAnimationStep:
3009: 57              LD      D,A                 
300A: 0F              RRCA                        
300B: DA 22 30        JP      C,$3022             ; {code.loc_3022}
300E: 0E 93           LD      C,$93               
3010: 0F              RRCA                        
3011: 0F              RRCA                        
3012: D2 17 30        JP      NC,$3017            ; {code.loc_3017}
3015: 0E 6C           LD      C,$6C               

loc_3017:
3017: 07              RLCA                        
3018: DA 31 30        JP      C,$3031             ; {code.loc_3031}
301B: 79              LD      A,C                 
301C: E6 F0           AND     $F0                 
301E: 4F              LD      C,A                 
301F: C3 31 30        JP      $3031               ; {code.loc_3031}

loc_3022:
3022: 0E B4           LD      C,$B4               
3024: 0F              RRCA                        
3025: 0F              RRCA                        
3026: D2 2B 30        JP      NC,$302B            ; {code.loc_302b}
3029: 0E 1E           LD      C,$1E               

loc_302b:
302B: CB 50           BIT     2,B                 
302D: CA 31 30        JP      Z,$3031             ; {code.loc_3031}
3030: 05              DEC     B                   

loc_3031:
3031: 79              LD      A,C                 
3032: 0F              RRCA                        
3033: 0F              RRCA                        
3034: 4F              LD      C,A                 
3035: E6 03           AND     $03                 
3037: B8              CP      B                   
3038: C2 31 30        JP      NZ,$3031            ; {code.loc_3031}
303B: 79              LD      A,C                 
303C: 0F              RRCA                        
303D: 0F              RRCA                        
303E: E6 03           AND     $03                 
3040: FE 03           CP      $03                 
3042: C0              RET     NZ                  
3043: CB 92           RES     2,D                 
3045: 15              DEC     D                   
3046: C0              RET     NZ                  
3047: 3E 04           LD      A,$04               
3049: C9              RET                         

scrollClimbGraphicStep:
304A: 11 E0 FF        LD      DE,$FFE0            
304D: 3A 8E 63        LD      A,($638E)           ; {ram.introScrollIndex}
3050: 4F              LD      C,A                 
3051: 06 00           LD      B,$00               
3053: 21 00 76        LD      HL,$7600            
3056: CD 64 30        CALL    $3064               ; {code.copyByteDisplaced}
3059: 21 C0 75        LD      HL,$75C0            
305C: CD 64 30        CALL    $3064               ; {code.copyByteDisplaced}
305F: 21 8E 63        LD      HL,$638E            
3062: 35              DEC     (HL)                
3063: C9              RET                         

copyByteDisplaced:
3064: 09              ADD     HL,BC               
3065: 7E              LD      A,(HL)              
3066: 19              ADD     HL,DE               
3067: 77              LD      (HL),A              
3068: C9              RET                         

advanceSequenceStepWhenTimerExpires:
3069: DF              RST     $18                 
306A: 2A C0 63        LD      HL,($63C0)          ; {ram.seqAdvancePtr}
306D: 34              INC     (HL)                
306E: C9              RET                         

animateSpriteObjectBlock:
306F: 21 AF 62        LD      HL,$62AF            
3072: 34              INC     (HL)                
3073: 7E              LD      A,(HL)              
3074: E6 07           AND     $07                 
3076: C0              RET     NZ                  
3077: 21 0B 69        LD      HL,$690B            
307A: 0E FC           LD      C,$FC               
307C: FF              RST     $38                 
307D: 0E 81           LD      C,$81               
307F: 21 09 69        LD      HL,$6909            
3082: CD 96 30        CALL    $3096               ; {code.xorMaskStridedPair}
3085: 21 1D 69        LD      HL,$691D            
3088: CD 96 30        CALL    $3096               ; {code.xorMaskStridedPair}
308B: CD 57 00        CALL    $0057               ; {code.stirRandomSeed}
308E: E6 80           AND     $80                 
3090: 21 2D 69        LD      HL,$692D            
3093: AE              XOR     (HL)                
3094: 77              LD      (HL),A              
3095: C9              RET                         

xorMaskStridedPair:
3096: 06 02           LD      B,$02               

loc_3098:
3098: 79              LD      A,C                 
3099: AE              XOR     (HL)                
309A: 77              LD      (HL),A              
309B: 19              ADD     HL,DE               
309C: 10 FA           DJNZ    $3098               ; {code.loc_3098}
309E: C9              RET                         

enqueueTask:
309F: E5              PUSH    HL                  
30A0: 21 C0 60        LD      HL,$60C0            
30A3: 3A B0 60        LD      A,($60B0)           ; {ram.taskTail}
30A6: 6F              LD      L,A                 
30A7: CB 7E           BIT     7,(HL)              
30A9: CA BB 30        JP      Z,$30BB             ; {code.loc_30bb}
30AC: 72              LD      (HL),D              
30AD: 2C              INC     L                   
30AE: 73              LD      (HL),E              
30AF: 2C              INC     L                   
30B0: 7D              LD      A,L                 
30B1: FE C0           CP      $C0                 
30B3: D2 B8 30        JP      NC,$30B8            ; {code.loc_30b8}
30B6: 3E C0           LD      A,$C0               

loc_30b8:
30B8: 32 B0 60        LD      ($60B0),A           ; {ram.taskTail}

loc_30bb:
30BB: E1              POP     HL                  
30BC: C9              RET                         

clearSpriteColumns:
30BD: 21 50 69        LD      HL,$6950            
30C0: 06 02           LD      B,$02               
30C2: CD E4 30        CALL    $30E4               ; {code.clearStridedBytes}
30C5: 2E 80           LD      L,$80               
30C7: 06 0A           LD      B,$0A               
30C9: CD E4 30        CALL    $30E4               ; {code.clearStridedBytes}
30CC: 2E B8           LD      L,$B8               
30CE: 06 0B           LD      B,$0B               
30D0: CD E4 30        CALL    $30E4               ; {code.clearStridedBytes}
30D3: 21 0C 6A        LD      HL,$6A0C            
30D6: 06 05           LD      B,$05               
30D8: C3 E4 30        JP      $30E4               ; {code.clearStridedBytes}

loc_30db:
30DB: 21 4C 69        LD      HL,$694C            
30DE: 36 00           LD      (HL),$00            
30E0: 2E 58           LD      L,$58               
30E2: 06 06           LD      B,$06               

clearStridedBytes:
30E4: 7D              LD      A,L                 

loc_30e5:
30E5: 36 00           LD      (HL),$00            
30E7: C6 04           ADD     A,$04               
30E9: 6F              LD      L,A                 
30EA: 10 F9           DJNZ    $30E5               ; {code.loc_30e5}
30EC: C9              RET                         

updateFires:
30ED: CD FA 30        CALL    $30FA               ; {code.gateFireUpdateByDifficulty}

loc_30f0:
30F0: CD 3C 31        CALL    $313C               ; {code.spawnRequestedFireAndRecolorLiveFires}
30F3: CD B1 31        CALL    $31B1               ; {code.advanceLiveFires}
30F6: CD F3 34        CALL    $34F3               ; {code.publishFireSprites}
30F9: C9              RET                         

gateFireUpdateByDifficulty:
30FA: 3A 80 63        LD      A,($6380)           ; {ram.difficulty}
30FD: FE 06           CP      $06                 
30FF: 38 02           JR      C,$3103             ; {code.loc_3103}
3101: 3E 05           LD      A,$05               

loc_3103:
3103: EF              RST     $28                 

; ---- $3104-$310F: jump table ----
3104: 10 31 10 31 1B 31 26 31 26 31 31 31

loc_3110:
3110: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
3113: E6 01           AND     $01                 
3115: FE 01           CP      $01                 
3117: C8              RET     Z                   
3118: 33              INC     SP                  
3119: 33              INC     SP                  
311A: C9              RET                         

loc_311b:
311B: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
311E: E6 07           AND     $07                 
3120: FE 05           CP      $05                 
3122: F8              RET     M                   
3123: 33              INC     SP                  
3124: 33              INC     SP                  
3125: C9              RET                         

loc_3126:
3126: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
3129: E6 03           AND     $03                 
312B: FE 03           CP      $03                 
312D: F8              RET     M                   
312E: 33              INC     SP                  
312F: 33              INC     SP                  
3130: C9              RET                         

loc_3131:
3131: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
3134: E6 07           AND     $07                 
3136: FE 07           CP      $07                 
3138: F8              RET     M                   
3139: 33              INC     SP                  
313A: 33              INC     SP                  
313B: C9              RET                         

spawnRequestedFireAndRecolorLiveFires:
313C: DD 21 00 64     LD      IX,$6400            
3140: AF              XOR     A                   
3141: 32 A1 63        LD      ($63A1),A           ; {ram.objLiveCount}
3144: 06 05           LD      B,$05               
3146: 11 20 00        LD      DE,$0020            

loc_3149:
3149: DD 7E 00        LD      A,(IX+$00)          
314C: FE 00           CP      $00                 
314E: CA 7C 31        JP      Z,$317C             ; {code.loc_317c}
3151: 3A A1 63        LD      A,($63A1)           ; {ram.objLiveCount}
3154: 3C              INC     A                   
3155: 32 A1 63        LD      ($63A1),A           ; {ram.objLiveCount}
3158: 3E 01           LD      A,$01               
315A: DD 77 08        LD      (IX+$08),A          
315D: 3A 17 62        LD      A,($6217)           ; {ram.marioHammerActive}
3160: FE 01           CP      $01                 
3162: C2 6A 31        JP      NZ,$316A            ; {code.loc_316a}
3165: 3E 00           LD      A,$00               
3167: DD 77 08        LD      (IX+$08),A          

loc_316a:
316A: DD 19           ADD     IX,DE               
316C: 10 DB           DJNZ    $3149               ; {code.loc_3149}
316E: 21 A0 63        LD      HL,$63A0            
3171: 36 00           LD      (HL),$00            
3173: 3A A1 63        LD      A,($63A1)           ; {ram.objLiveCount}
3176: FE 00           CP      $00                 
3178: C0              RET     NZ                  
3179: 33              INC     SP                  
317A: 33              INC     SP                  
317B: C9              RET                         

loc_317c:
317C: 3A A1 63        LD      A,($63A1)           ; {ram.objLiveCount}
317F: FE 05           CP      $05                 
3181: CA 6A 31        JP      Z,$316A             ; {code.loc_316a}
3184: 3A 27 62        LD      A,($6227)           ; {ram.board}
3187: FE 02           CP      $02                 
3189: C2 95 31        JP      NZ,$3195            ; {code.loc_3195}
318C: 3A A1 63        LD      A,($63A1)           ; {ram.objLiveCount}
318F: 4F              LD      C,A                 
3190: 3A 80 63        LD      A,($6380)           ; {ram.difficulty}
3193: B9              CP      C                   
3194: C8              RET     Z                   

loc_3195:
3195: 3A A0 63        LD      A,($63A0)           ; {ram.eventReq313c}
3198: FE 01           CP      $01                 
319A: C2 6A 31        JP      NZ,$316A            ; {code.loc_316a}
319D: DD 77 00        LD      (IX+$00),A          
31A0: DD 77 18        LD      (IX+$18),A          
31A3: AF              XOR     A                   
31A4: 32 A0 63        LD      ($63A0),A           ; {ram.eventReq313c}
31A7: 3A A1 63        LD      A,($63A1)           ; {ram.objLiveCount}
31AA: 3C              INC     A                   
31AB: 32 A1 63        LD      ($63A1),A           ; {ram.objLiveCount}
31AE: C3 6A 31        JP      $316A               ; {code.loc_316a}

advanceLiveFires:
31B1: CD DD 31        CALL    $31DD               ; {code.armAlternateFireModeAtHighDifficulty}
31B4: AF              XOR     A                   
31B5: 32 A2 63        LD      ($63A2),A           ; {hard.workRam+3A2}
31B8: 21 E0 63        LD      HL,$63E0            
31BB: 22 C8 63        LD      ($63C8),HL          ; {ram.objIterPtr}

loc_31be:
31BE: 2A C8 63        LD      HL,($63C8)          ; {ram.objIterPtr}
31C1: 01 20 00        LD      BC,$0020            
31C4: 09              ADD     HL,BC               
31C5: 22 C8 63        LD      ($63C8),HL          ; {ram.objIterPtr}
31C8: 7E              LD      A,(HL)              
31C9: A7              AND     A                   
31CA: CA D0 31        JP      Z,$31D0             ; {code.loc_31d0}
31CD: CD 02 32        CALL    $3202               ; {code.advanceFire}

loc_31d0:
31D0: 3A A2 63        LD      A,($63A2)           ; {hard.workRam+3A2}
31D3: 3C              INC     A                   
31D4: 32 A2 63        LD      ($63A2),A           ; {hard.workRam+3A2}
31D7: FE 05           CP      $05                 
31D9: C2 BE 31        JP      NZ,$31BE            ; {code.loc_31be}
31DC: C9              RET                         

armAlternateFireModeAtHighDifficulty:
31DD: 3A 80 63        LD      A,($6380)           ; {ram.difficulty}
31E0: FE 03           CP      $03                 
31E2: F8              RET     M                   
31E3: CD F6 31        CALL    $31F6               ; {code.loc_31f6}
31E6: FE 01           CP      $01                 
31E8: C0              RET     NZ                  
31E9: 21 39 64        LD      HL,$6439            
31EC: 3E 02           LD      A,$02               
31EE: 77              LD      (HL),A              
31EF: 21 79 64        LD      HL,$6479            
31F2: 3E 02           LD      A,$02               
31F4: 77              LD      (HL),A              
31F5: C9              RET                         

loc_31f6:
31F6: 3A 18 60        LD      A,($6018)           ; {ram.random}
31F9: E6 03           AND     $03                 
31FB: FE 01           CP      $01                 
31FD: C0              RET     NZ                  
31FE: 3A 1A 60        LD      A,($601A)           ; {ram.frame}
3201: C9              RET                         

advanceFire:
3202: DD 2A C8 63     LD      IX,($63C8)          ; {ram.objIterPtr}
3206: DD 7E 18        LD      A,(IX+$18)          
3209: FE 01           CP      $01                 
320B: CA 7A 32        JP      Z,$327A             ; {code.loc_327a}
320E: DD 7E 0D        LD      A,(IX+$0D)          
3211: FE 04           CP      $04                 
3213: F2 30 32        JP      P,$3230             ; {code.loc_3230}
3216: DD 7E 19        LD      A,(IX+$19)          
3219: FE 02           CP      $02                 
321B: CA 7E 32        JP      Z,$327E             ; {code.loc_327e}
321E: CD 0F 33        CALL    $330F               ; {code.tickFireTimerAndRerollDirection}

loc_3221:
3221: 3A 18 60        LD      A,($6018)           ; {ram.random}
3224: E6 03           AND     $03                 
3226: C2 33 32        JP      NZ,$3233            ; {code.loc_3233}

loc_3229:
3229: DD 7E 0D        LD      A,(IX+$0D)          
322C: A7              AND     A                   
322D: CA 57 32        JP      Z,$3257             ; {code.loc_3257}

loc_3230:
3230: CD 3D 33        CALL    $333D               ; {code.driveFireLadderClimb}

loc_3233:
3233: DD 7E 0D        LD      A,(IX+$0D)          
3236: FE 04           CP      $04                 
3238: F2 91 32        JP      P,$3291             ; {code.loc_3291}
323B: CD AD 33        CALL    $33AD               ; {code.walkFireOneStep}
323E: CD 8C 29        CALL    $298C               ; {code.turnFireAtGroundEdge}
3241: FE 01           CP      $01                 
3243: CA 97 32        JP      Z,$3297             ; {code.loc_3297}
3246: DD 2A C8 63     LD      IX,($63C8)          ; {ram.objIterPtr}
324A: DD 7E 0E        LD      A,(IX+$0E)          
324D: FE 10           CP      $10                 
324F: DA 8C 32        JP      C,$328C             ; {code.loc_328c}
3252: FE F0           CP      $F0                 
3254: D2 84 32        JP      NC,$3284            ; {code.loc_3284}

loc_3257:
3257: DD 7E 13        LD      A,(IX+$13)          
325A: FE 00           CP      $00                 
325C: C2 B9 32        JP      NZ,$32B9            ; {code.loc_32b9}
325F: 3E 11           LD      A,$11               

loc_3261:
3261: DD 77 13        LD      (IX+$13),A          
3264: 16 00           LD      D,$00               
3266: 5F              LD      E,A                 
3267: 21 7A 3A        LD      HL,$3A7A            
326A: 19              ADD     HL,DE               
326B: 7E              LD      A,(HL)              
326C: DD 46 0E        LD      B,(IX+$0E)          
326F: DD 70 03        LD      (IX+$03),B          
3272: DD 4E 0F        LD      C,(IX+$0F)          
3275: 81              ADD     A,C                 
3276: DD 77 05        LD      (IX+$05),A          
3279: C9              RET                         

loc_327a:
327A: CD BD 32        CALL    $32BD               ; {code.loc_32bd}
327D: C9              RET                         

loc_327e:
327E: CD D6 32        CALL    $32D6               ; {code.loc_32d6}
3281: C3 29 32        JP      $3229               ; {code.loc_3229}

loc_3284:
3284: 3E 02           LD      A,$02               

loc_3286:
3286: DD 77 0D        LD      (IX+$0D),A          
3289: C3 57 32        JP      $3257               ; {code.loc_3257}

loc_328c:
328C: 3E 01           LD      A,$01               
328E: C3 86 32        JP      $3286               ; {code.loc_3286}

loc_3291:
3291: CD E7 33        CALL    $33E7               ; {code.loc_33e7}
3294: C3 57 32        JP      $3257               ; {code.loc_3257}

loc_3297:
3297: DD 2A C8 63     LD      IX,($63C8)          ; {ram.objIterPtr}
329B: DD 7E 0D        LD      A,(IX+$0D)          
329E: FE 01           CP      $01                 
32A0: C2 B1 32        JP      NZ,$32B1            ; {code.loc_32b1}
32A3: 3E 02           LD      A,$02               
32A5: DD 35 0E        DEC     (IX+$0E)            

loc_32a8:
32A8: DD 77 0D        LD      (IX+$0D),A          
32AB: CD C3 33        CALL    $33C3               ; {code.settleFireOnGirderSlope}
32AE: C3 57 32        JP      $3257               ; {code.loc_3257}

loc_32b1:
32B1: 3E 01           LD      A,$01               
32B3: DD 34 0E        INC     (IX+$0E)            
32B6: C3 A8 32        JP      $32A8               ; {code.loc_32a8}

loc_32b9:
32B9: 3D              DEC     A                   
32BA: C3 61 32        JP      $3261               ; {code.loc_3261}

loc_32bd:
32BD: 3A 27 62        LD      A,($6227)           ; {ram.board}
32C0: FE 01           CP      $01                 
32C2: CA CE 32        JP      Z,$32CE             ; {code.loc_32ce}
32C5: FE 02           CP      $02                 
32C7: CA D2 32        JP      Z,$32D2             ; {code.loc_32d2}
32CA: CD B9 34        CALL    $34B9               ; {code.loc_34b9}
32CD: C9              RET                         

loc_32ce:
32CE: CD 2C 34        CALL    $342C               ; {code.loc_342c}
32D1: C9              RET                         

loc_32d2:
32D2: CD 78 34        CALL    $3478               ; {code.loc_3478}
32D5: C9              RET                         

loc_32d6:
32D6: DD 7E 1C        LD      A,(IX+$1C)          
32D9: FE 00           CP      $00                 
32DB: C2 FD 32        JP      NZ,$32FD            ; {code.loc_32fd}
32DE: DD 7E 1D        LD      A,(IX+$1D)          
32E1: FE 01           CP      $01                 
32E3: C2 0B 33        JP      NZ,$330B            ; {code.loc_330b}
32E6: DD 36 1D 00     LD      (IX+$1D),$00        
32EA: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
32ED: DD 46 0F        LD      B,(IX+$0F)          
32F0: 90              SUB     B                   
32F1: DA 03 33        JP      C,$3303             ; {code.loc_3303}
32F4: DD 36 1C FF     LD      (IX+$1C),$FF        

loc_32f8:
32F8: DD 36 0D 00     LD      (IX+$0D),$00        
32FC: C9              RET                         

loc_32fd:
32FD: DD 35 1C        DEC     (IX+$1C)            
3300: C2 F8 32        JP      NZ,$32F8            ; {code.loc_32f8}

loc_3303:
3303: DD 36 19 00     LD      (IX+$19),$00        
3307: DD 36 1C 00     LD      (IX+$1C),$00        

loc_330b:
330B: CD 0F 33        CALL    $330F               ; {code.tickFireTimerAndRerollDirection}
330E: C9              RET                         

tickFireTimerAndRerollDirection:
330F: DD 7E 16        LD      A,(IX+$16)          
3312: FE 00           CP      $00                 
3314: C2 32 33        JP      NZ,$3332            ; {code.loc_3332}
3317: DD 36 16 2B     LD      (IX+$16),$2B        
331B: DD 36 0D 00     LD      (IX+$0D),$00        
331F: 3A 18 60        LD      A,($6018)           ; {ram.random}
3322: 0F              RRCA                        
3323: D2 32 33        JP      NC,$3332            ; {code.loc_3332}
3326: DD 7E 0D        LD      A,(IX+$0D)          
3329: FE 01           CP      $01                 
332B: CA 36 33        JP      Z,$3336             ; {code.loc_3336}
332E: DD 36 0D 01     LD      (IX+$0D),$01        

loc_3332:
3332: DD 35 16        DEC     (IX+$16)            
3335: C9              RET                         

loc_3336:
3336: DD 36 0D 02     LD      (IX+$0D),$02        
333A: C3 32 33        JP      $3332               ; {code.loc_3332}

driveFireLadderClimb:
333D: DD 7E 0D        LD      A,(IX+$0D)          
3340: FE 08           CP      $08                 
3342: CA 71 33        JP      Z,$3371             ; {code.loc_3371}
3345: FE 04           CP      $04                 
3347: CA 8A 33        JP      Z,$338A             ; {code.loc_338a}
334A: CD A1 33        CALL    $33A1               ; {code.loc_33a1}
334D: DD 7E 0F        LD      A,(IX+$0F)          
3350: C6 08           ADD     A,$08               
3352: 57              LD      D,A                 
3353: DD 7E 0E        LD      A,(IX+$0E)          
3356: 01 15 00        LD      BC,$0015            
3359: CD 6E 23        CALL    $236E               ; {code.findOppositeLadderEnd}
335C: A7              AND     A                   
335D: CA 99 33        JP      Z,$3399             ; {code.loc_3399}
3360: DD 70 1F        LD      (IX+$1F),B          
3363: 3A 05 62        LD      A,($6205)           ; {ram.marioY}
3366: 47              LD      B,A                 
3367: DD 7E 0F        LD      A,(IX+$0F)          
336A: 90              SUB     B                   
336B: D0              RET     NC                  
336C: DD 36 0D 04     LD      (IX+$0D),$04        
3370: C9              RET                         

loc_3371:
3371: DD 7E 0F        LD      A,(IX+$0F)          
3374: C6 08           ADD     A,$08               
3376: DD 46 1F        LD      B,(IX+$1F)          
3379: B8              CP      B                   
337A: C0              RET     NZ                  
337B: DD 36 0D 00     LD      (IX+$0D),$00        
337F: DD 7E 19        LD      A,(IX+$19)          
3382: FE 02           CP      $02                 
3384: C0              RET     NZ                  
3385: DD 36 1D 01     LD      (IX+$1D),$01        
3389: C9              RET                         

loc_338a:
338A: DD 7E 0F        LD      A,(IX+$0F)          
338D: C6 08           ADD     A,$08               
338F: DD 46 1F        LD      B,(IX+$1F)          
3392: B8              CP      B                   
3393: C0              RET     NZ                  
3394: DD 36 0D 00     LD      (IX+$0D),$00        
3398: C9              RET                         

loc_3399:
3399: DD 70 1F        LD      (IX+$1F),B          
339C: DD 36 0D 08     LD      (IX+$0D),$08        
33A0: C9              RET                         

loc_33a1:
33A1: 3E 07           LD      A,$07               
33A3: F7              RST     $30                 
33A4: DD 7E 0F        LD      A,(IX+$0F)          
33A7: FE 59           CP      $59                 
33A9: D0              RET     NC                  
33AA: 33              INC     SP                  
33AB: 33              INC     SP                  
33AC: C9              RET                         

walkFireOneStep:
33AD: DD 7E 0D        LD      A,(IX+$0D)          
33B0: FE 01           CP      $01                 
33B2: CA D9 33        JP      Z,$33D9             ; {code.loc_33d9}
33B5: DD 7E 07        LD      A,(IX+$07)          
33B8: E6 7F           AND     $7F                 
33BA: DD 77 07        LD      (IX+$07),A          
33BD: DD 35 0E        DEC     (IX+$0E)            

loc_33c0:
33C0: CD 09 34        CALL    $3409               ; {code.stepObjectSpriteFrame}

settleFireOnGirderSlope:
33C3: 3A 27 62        LD      A,($6227)           ; {ram.board}
33C6: FE 01           CP      $01                 
33C8: C0              RET     NZ                  
33C9: DD 66 0E        LD      H,(IX+$0E)          
33CC: DD 6E 0F        LD      L,(IX+$0F)          
33CF: DD 46 0D        LD      B,(IX+$0D)          
33D2: CD 33 23        CALL    $2333               ; {code.snapYToGirder}
33D5: DD 75 0F        LD      (IX+$0F),L          
33D8: C9              RET                         

loc_33d9:
33D9: DD 7E 07        LD      A,(IX+$07)          
33DC: F6 80           OR      $80                 
33DE: DD 77 07        LD      (IX+$07),A          
33E1: DD 34 0E        INC     (IX+$0E)            
33E4: C3 C0 33        JP      $33C0               ; {code.loc_33c0}

loc_33e7:
33E7: CD 09 34        CALL    $3409               ; {code.stepObjectSpriteFrame}
33EA: DD 7E 0D        LD      A,(IX+$0D)          
33ED: FE 08           CP      $08                 
33EF: C2 05 34        JP      NZ,$3405            ; {code.loc_3405}
33F2: DD 7E 14        LD      A,(IX+$14)          
33F5: A7              AND     A                   
33F6: C2 01 34        JP      NZ,$3401            ; {code.loc_3401}
33F9: DD 36 14 02     LD      (IX+$14),$02        
33FD: DD 35 0F        DEC     (IX+$0F)            
3400: C9              RET                         

loc_3401:
3401: DD 35 14        DEC     (IX+$14)            
3404: C9              RET                         

loc_3405:
3405: DD 34 0F        INC     (IX+$0F)            
3408: C9              RET                         

stepObjectSpriteFrame:
3409: DD 7E 15        LD      A,(IX+$15)          
340C: A7              AND     A                   
340D: C2 28 34        JP      NZ,$3428            ; {code.loc_3428}
3410: DD 36 15 02     LD      (IX+$15),$02        
3414: DD 34 07        INC     (IX+$07)            
3417: DD 7E 07        LD      A,(IX+$07)          
341A: E6 0F           AND     $0F                 
341C: FE 0F           CP      $0F                 
341E: C0              RET     NZ                  
341F: DD 7E 07        LD      A,(IX+$07)          
3422: EE 02           XOR     $02                 
3424: DD 77 07        LD      (IX+$07),A          
3427: C9              RET                         

loc_3428:
3428: DD 35 15        DEC     (IX+$15)            
342B: C9              RET                         

loc_342c:
342C: DD 6E 1A        LD      L,(IX+$1A)          
342F: DD 66 1B        LD      H,(IX+$1B)          
3432: AF              XOR     A                   
3433: 01 00 00        LD      BC,$0000            
3436: ED 4A           ADC     HL,BC               
3438: C2 42 34        JP      NZ,$3442            ; {code.loc_3442}
343B: 21 8C 3A        LD      HL,$3A8C            
343E: DD 36 03 26     LD      (IX+$03),$26        

loc_3442:
3442: DD 34 03        INC     (IX+$03)            

loc_3445:
3445: 7E              LD      A,(HL)              
3446: FE AA           CP      $AA                 
3448: CA 56 34        JP      Z,$3456             ; {code.loc_3456}
344B: DD 77 05        LD      (IX+$05),A          
344E: 23              INC     HL                  
344F: DD 75 1A        LD      (IX+$1A),L          
3452: DD 74 1B        LD      (IX+$1B),H          
3455: C9              RET                         

loc_3456:
3456: AF              XOR     A                   
3457: DD 77 13        LD      (IX+$13),A          
345A: DD 77 18        LD      (IX+$18),A          
345D: DD 77 0D        LD      (IX+$0D),A          
3460: DD 77 1C        LD      (IX+$1C),A          
3463: DD 7E 03        LD      A,(IX+$03)          
3466: DD 77 0E        LD      (IX+$0E),A          
3469: DD 7E 05        LD      A,(IX+$05)          
346C: DD 77 0F        LD      (IX+$0F),A          
346F: DD 36 1A 00     LD      (IX+$1A),$00        
3473: DD 36 1B 00     LD      (IX+$1B),$00        
3477: C9              RET                         

loc_3478:
3478: DD 6E 1A        LD      L,(IX+$1A)          
347B: DD 66 1B        LD      H,(IX+$1B)          
347E: AF              XOR     A                   
347F: 01 00 00        LD      BC,$0000            
3482: ED 4A           ADC     HL,BC               
3484: C2 9A 34        JP      NZ,$349A            ; {code.loc_349a}
3487: 21 AC 3A        LD      HL,$3AAC            
348A: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
348D: CB 7F           BIT     7,A                 
348F: CA A8 34        JP      Z,$34A8             ; {code.loc_34a8}
3492: DD 36 0D 01     LD      (IX+$0D),$01        
3496: DD 36 03 7E     LD      (IX+$03),$7E        

loc_349a:
349A: DD 7E 0D        LD      A,(IX+$0D)          
349D: FE 01           CP      $01                 
349F: C2 B3 34        JP      NZ,$34B3            ; {code.loc_34b3}
34A2: DD 34 03        INC     (IX+$03)            
34A5: C3 45 34        JP      $3445               ; {code.loc_3445}

loc_34a8:
34A8: DD 36 0D 02     LD      (IX+$0D),$02        
34AC: DD 36 03 80     LD      (IX+$03),$80        
34B0: C3 9A 34        JP      $349A               ; {code.loc_349a}

loc_34b3:
34B3: DD 35 03        DEC     (IX+$03)            
34B6: C3 45 34        JP      $3445               ; {code.loc_3445}

loc_34b9:
34B9: 3A 27 62        LD      A,($6227)           ; {ram.board}
34BC: FE 03           CP      $03                 
34BE: C8              RET     Z                   
34BF: 3A 03 62        LD      A,($6203)           ; {ram.marioX}
34C2: CB 7F           BIT     7,A                 
34C4: C2 ED 34        JP      NZ,$34ED            ; {code.loc_34ed}
34C7: 21 C4 3A        LD      HL,$3AC4            

loc_34ca:
34CA: 06 00           LD      B,$00               
34CC: 3A 19 60        LD      A,($6019)           ; {ram.spinCount}
34CF: E6 06           AND     $06                 
34D1: 4F              LD      C,A                 
34D2: 09              ADD     HL,BC               
34D3: 7E              LD      A,(HL)              
34D4: DD 77 03        LD      (IX+$03),A          
34D7: DD 77 0E        LD      (IX+$0E),A          
34DA: 23              INC     HL                  
34DB: 7E              LD      A,(HL)              
34DC: DD 77 05        LD      (IX+$05),A          
34DF: DD 77 0F        LD      (IX+$0F),A          
34E2: AF              XOR     A                   
34E3: DD 77 0D        LD      (IX+$0D),A          
34E6: DD 77 18        LD      (IX+$18),A          
34E9: DD 77 1C        LD      (IX+$1C),A          
34EC: C9              RET                         

loc_34ed:
34ED: 21 D4 3A        LD      HL,$3AD4            
34F0: C3 CA 34        JP      $34CA               ; {code.loc_34ca}

publishFireSprites:
34F3: 21 00 64        LD      HL,$6400            
34F6: 11 D0 69        LD      DE,$69D0            
34F9: 06 05           LD      B,$05               

loc_34fb:
34FB: 7E              LD      A,(HL)              
34FC: A7              AND     A                   
34FD: CA 1E 35        JP      Z,$351E             ; {code.loc_351e}
3500: 2C              INC     L                   
3501: 2C              INC     L                   
3502: 2C              INC     L                   
3503: 7E              LD      A,(HL)              
3504: 12              LD      (DE),A              
3505: 3E 04           LD      A,$04               
3507: 85              ADD     A,L                 
3508: 6F              LD      L,A                 
3509: 1C              INC     E                   
350A: 7E              LD      A,(HL)              
350B: 12              LD      (DE),A              
350C: 2C              INC     L                   
350D: 1C              INC     E                   
350E: 7E              LD      A,(HL)              
350F: 12              LD      (DE),A              
3510: 2D              DEC     L                   
3511: 2D              DEC     L                   
3512: 2D              DEC     L                   
3513: 1C              INC     E                   
3514: 7E              LD      A,(HL)              
3515: 12              LD      (DE),A              
3516: 13              INC     DE                  

loc_3517:
3517: 3E 1B           LD      A,$1B               
3519: 85              ADD     A,L                 
351A: 6F              LD      L,A                 
351B: 10 DE           DJNZ    $34FB               ; {code.loc_34fb}
351D: C9              RET                         

loc_351e:
351E: 3E 05           LD      A,$05               
3520: 85              ADD     A,L                 
3521: 6F              LD      L,A                 
3522: 3E 04           LD      A,$04               
3524: 83              ADD     A,E                 
3525: 5F              LD      E,A                 
3526: C3 17 35        JP      $3517               ; {code.loc_3517}

; ---- $3529-$3E6F: data ----
3529: 00 00 00 00 01 00 00 02 00 00 03 00 00 04 00 00
3539: 05 00 00 06 00 00 07 00 00 08 00 00 09 00 00 00
3549: 00 00 10 00 00 20 00 00 30 00 00 40 00 00 50 00
3559: 00 60 00 00 70 00 00 80 00 00 90 00 94 77 01 23
3569: 24 10 10 00 00 07 06 05 00 10 10 10 10 10 10 10
3579: 10 10 10 10 10 10 10 3F 00 50 76 00 F4 76 96 77
3589: 02 1E 14 10 10 00 00 06 01 00 00 10 10 10 10 10
3599: 10 10 10 10 10 10 10 10 10 3F 00 00 61 00 F6 76
35A9: 98 77 03 22 14 10 10 00 00 05 09 05 00 10 10 10
35B9: 10 10 10 10 10 10 10 10 10 10 10 3F 00 50 59 00
35C9: F8 76 9A 77 04 24 18 10 10 00 00 05 00 05 00 10
35D9: 10 10 10 10 10 10 10 10 10 10 10 10 10 3F 00 50
35E9: 50 00 FA 76 9C 77 05 24 18 10 10 00 00 04 03 00
35F9: 00 10 10 10 10 10 10 10 10 10 10 10 10 10 10 3F
3609: 00 00 43 00 FC 76 3B 5C 4B 5C 5B 5C 6B 5C 7B 5C
3619: 8B 5C 9B 5C AB 5C BB 5C CB 5C 3B 6C 4B 6C 5B 6C
3629: 6B 6C 7B 6C 8B 6C 9B 6C AB 6C BB 6C CB 6C 3B 7C
3639: 4B 7C 5B 7C 6B 7C 7B 7C 8B 7C 9B 7C AB 7C BB 7C
3649: CB 7C 8B 36 01 00 98 36 A5 36 B2 36 BF 36 06 00
3659: CC 36 08 00 E6 36 FD 36 0B 00 15 37 1C 37 30 37
3669: 38 37 47 37 5D 37 73 37 8B 37 00 61 22 61 44 61
3679: 66 61 88 61 9E 37 B6 37 D2 37 E1 37 1D 00 00 3F
3689: 09 3F 96 76 17 11 1D 15 10 10 1F 26 15 22 3F 94
3699: 76 20 1C 11 29 15 22 10 30 32 31 3F 94 76 20 1C
36A9: 11 29 15 22 10 30 33 31 3F 80 76 18 19 17 18 10
36B9: 23 13 1F 22 15 3F 9F 75 13 22 15 14 19 24 10 10
36C9: 10 10 3F 5E 77 18 1F 27 10 18 19 17 18 10 13 11
36D9: 1E 10 29 1F 25 10 17 15 24 10 FB 10 3F 29 77 1F
36E9: 1E 1C 29 10 01 10 20 1C 11 29 15 22 10 12 25 24
36F9: 24 1F 1E 3F 29 77 01 10 1F 22 10 02 10 20 1C 11
3709: 29 15 22 23 10 12 25 24 24 1F 1E 3F 27 76 20 25
3719: 23 18 3F 06 77 1E 11 1D 15 10 22 15 17 19 23 24
3729: 22 11 24 19 1F 1E 3F 88 76 1E 11 1D 15 2E 3F E9
3739: 75 2D 2D 2D 10 10 10 10 10 10 10 10 10 3F 0B 77
3749: 11 10 12 10 13 10 14 10 15 10 16 10 17 10 18 10
3759: 19 10 1A 3F 0D 77 1B 10 1C 10 1D 10 1E 10 1F 10
3769: 20 10 21 10 22 10 23 10 24 3F 0F 77 25 10 26 10
3779: 27 10 28 10 29 10 2A 10 2B 10 2C 44 45 46 47 48
3789: 10 3F F2 76 22 15 17 19 10 24 19 1D 15 10 10 30
3799: 03 00 31 10 3F 92 77 22 11 1E 1B 10 10 23 13 1F
37A9: 22 15 10 10 1E 11 1D 15 10 10 10 10 3F 72 77 29
37B9: 1F 25 22 10 1E 11 1D 15 10 27 11 23 10 22 15 17
37C9: 19 23 24 15 22 15 14 42 3F A7 76 19 1E 23 15 22
37D9: 24 10 13 1F 19 1E 10 3F 0A 77 10 10 20 1C 11 29
37E9: 15 22 10 10 10 10 13 1F 19 1E 3F FC 76 49 4A 10
37F9: 1E 19 1E 24 15 1E 14 1F 10 10 10 10 3F 7C 75 01
3809: 09 08 01 3F 02 97 38 68 38 02 DF 54 10 54 02 EF
3819: 6D 20 6D 02 DF 8E 10 8E 02 EF AF 20 AF 02 DF D0
3829: 10 D0 02 EF F1 10 F1 00 53 18 53 54 00 63 18 63
3839: 54 00 93 38 93 54 00 83 54 83 F1 00 93 54 93 F1
3849: AA 8D 7D 8C 6F 00 7C 6E 00 7C 6D 00 7C 6C 00 7C
3859: 8F 7F 8E 47 27 08 50 2F A7 08 50 3B 25 08 50 00
3869: 70 08 48 3B 23 07 40 46 A9 08 44 00 70 08 48 30
3879: 29 08 44 00 70 08 48 00 70 0A 48 6F 10 09 23 6F
3889: 11 0A 33 50 34 08 3C 00 35 08 3C 53 32 08 40 63
3899: 33 08 40 00 70 08 48 53 36 08 50 63 37 08 50 6B
38A9: 31 08 41 00 70 08 48 6A 14 0A 48 FD FD FD FD FD
38B9: FD FD FE FE FE FE FE FE FF FF FF FF 00 00 01 01
38C9: 01 7F FF FF FF FF FF 00 FF 00 00 01 00 01 01 01
38D9: 01 01 7F 04 7F F0 10 F0 02 DF F2 70 F8 02 6F F8
38E9: 10 F8 AA 04 DF D0 90 D0 02 DF DC 20 D1 AA FF FF
38F9: FF FF FF 04 DF A8 20 A8 04 5F B0 20 B0 02 DF B0
3909: 20 BB AA 04 DF 88 30 88 04 DF 90 B0 90 02 DF 9A
3919: 20 8F AA 04 BF 68 20 68 04 3F 70 20 70 02 DF 6E
3929: 20 79 AA 02 DF 58 A0 55 AA 00 70 08 44 2B AC 08
3939: 4C 3B AE 08 4C 3B AF 08 3C 4B B0 07 3C 4B AD 08
3949: 4C 00 70 08 44 00 70 08 44 00 70 08 44 00 70 0A
3959: 44 47 27 08 4C 2F A7 08 4C 3B 25 08 4C 00 70 08
3969: 44 3B 23 07 3C 4B 2A 08 3C 4B 2B 08 4C 2B AA 08
3979: 3C 2B AB 08 4C 00 70 0A 44 00 70 08 44 4B 2C 08
3989: 4C 3B 2E 08 4C 3B 2F 08 3C 2B 30 07 3C 2B 2D 08
3999: 4C 00 70 08 44 00 70 08 44 00 70 08 44 00 70 0A
39A9: 44 FD FD FD FE FE FE FE FF FF 00 FF 00 00 01 00
39B9: 01 01 02 02 02 02 03 03 03 7F 1E 4E BB 4C D8 4E
39C9: 59 4E 7F BB 4D 7F 47 27 08 50 2D 26 08 50 3B 25
39D9: 08 50 00 70 08 48 3B 24 07 40 4B 28 08 40 00 70
39E9: 08 48 30 29 08 44 00 70 08 48 00 70 0A 48 49 A6
39F9: 08 50 2F A7 08 50 3B 25 08 50 00 70 08 48 3B 24
3A09: 07 40 46 A9 08 44 00 70 08 48 2B A8 08 40 00 70
3A19: 08 48 00 70 0A 48 73 A7 88 60 8B 27 88 60 7F 25
3A29: 88 60 00 70 88 68 7F 24 87 70 74 29 88 6C 00 70
3A39: 88 68 8A A9 88 6C 00 70 88 68 00 70 8A 68 05 AF
3A49: F0 50 F0 AA 05 AF E8 50 E8 AA 05 AF E0 50 E0 AA
3A59: 05 AF D8 50 D8 AA 05 B7 58 48 58 AA 01 04 01 03
3A69: 04 01 02 03 04 01 02 01 03 04 01 02 01 03 01 04
3A79: 7F FF 00 FF FF FE FE FE FE FE FE FE FE FE FE FE
3A89: FF FF 00 E8 E5 E3 E2 E1 E0 DF DE DD DD DC DC DC
3A99: DC DC DC DD DD DE DF E0 E1 E2 E3 E4 E5 E7 E9 EB
3AA9: ED F0 AA 80 7B 78 76 74 73 72 71 70 70 6F 6F 6F
3AB9: 70 70 71 72 73 74 75 76 77 78 AA EE F0 DB A0 E6
3AC9: C8 D6 78 EB F0 DB A0 E6 C8 E6 C8 1B C8 23 A0 2B
3AD9: 78 12 F0 1B C8 23 A0 12 F0 1B C8 02 97 38 68 38
3AE9: 02 9F 54 10 54 02 DF 58 A0 55 02 EF 6D 20 79 02
3AF9: DF 9A 10 8E 02 EF AF 20 BB 02 DF DC 10 D0 02 FF
3B09: F0 80 F7 02 7F F8 00 F8 00 CB 57 CB 6F 00 CB 99
3B19: CB B1 00 CB DB CB F3 00 63 18 63 54 01 63 D5 63
3B29: F8 00 33 78 33 90 00 33 BA 33 D2 00 53 18 53 54
3B39: 01 53 92 53 B8 00 5B 76 5B 92 00 73 B6 73 D6 00
3B49: 83 95 83 B5 00 93 38 93 54 01 BB 70 BB 98 01 6B
3B59: 54 6B 75 AA 06 8F 90 70 90 06 8F 98 70 98 06 8F
3B69: A0 70 A0 00 63 18 63 58 00 63 80 63 A8 00 63 D0
3B79: 63 F8 00 53 18 53 58 00 53 A8 53 D0 00 9B 80 9B
3B89: A8 00 9B D0 9B F8 01 23 58 23 80 01 DB 58 DB 80
3B99: 00 2B 80 2B A8 00 D3 80 D3 A8 00 A3 A8 A3 D0 00
3BA9: 2B D0 2B F8 00 D3 D0 D3 F8 00 93 38 93 58 02 97
3BB9: 38 68 38 03 EF 58 10 58 03 F7 80 88 80 03 77 80
3BC9: 08 80 02 A7 A8 50 A8 02 E7 A8 B8 A8 02 3F A8 18
3BD9: A8 03 EF D0 10 D0 02 EF F8 10 F8 AA 00 63 18 63
3BE9: 58 00 63 88 63 D0 00 53 18 53 58 00 53 88 53 D0
3BF9: 00 E3 68 E3 90 00 E3 B8 E3 D0 00 CB 90 CB B0 00
3C09: B3 58 B3 78 00 9B 80 9B A0 00 93 38 93 58 00 23
3C19: 88 23 C0 00 1B C0 1B E8 02 97 38 68 38 02 B7 58
3C29: 10 58 02 EF 68 E0 68 02 D7 70 C8 70 02 BF 78 B0
3C39: 78 02 A7 80 90 80 02 67 88 48 88 02 27 88 10 88
3C49: 02 EF 90 C8 90 02 A7 A0 98 A0 02 BF A8 B0 A8 02
3C59: D7 B0 C8 B0 02 EF B8 E0 B8 02 27 C0 10 C0 02 EF
3C69: D0 D8 D0 02 67 D0 50 D0 02 CF D8 C0 D8 02 B7 E0
3C79: A8 E0 02 9F E8 88 E8 02 27 E8 10 E8 02 EF F8 10
3C89: F8 AA 00 7B 80 7B A8 00 7B D0 7B F8 00 33 58 33
3C99: 80 00 53 58 53 80 00 AB 58 AB 80 00 CB 58 CB 80
3CA9: 00 2B 80 2B A8 00 D3 80 D3 A8 00 23 A8 23 D0 00
3CB9: 5B A8 5B D0 00 A3 A8 A3 D0 00 DB A8 DB D0 00 1B
3CC9: D0 1B F8 00 E3 D0 E3 F8 05 B7 30 48 30 05 CF 58
3CD9: 30 58 05 D7 80 28 80 05 DF A8 20 A8 05 E7 D0 18
3CE9: D0 05 EF F8 10 F8 AA 10 82 85 8B 10 85 80 8B 10
3CF9: 87 85 8B 81 80 80 8B 81 82 85 8B 81 85 80 8B 05
3D09: 88 77 01 68 77 01 6C 77 03 49 77 05 08 77 01 E8
3D19: 76 01 EC 76 05 C8 76 05 88 76 02 69 76 02 4A 76
3D29: 05 28 76 05 E8 75 01 CA 75 03 A9 75 01 88 75 01
3D39: 8C 75 05 48 75 01 28 75 01 2A 75 01 2C 75 01 08
3D49: 75 01 0A 75 01 0C 75 03 C8 74 03 AA 74 03 88 74
3D59: 05 2F 77 05 0F 77 02 F0 76 02 CF 76 02 D2 76 05
3D69: 8F 76 05 6F 76 01 4F 76 01 53 76 05 2F 76 05 EF
3D79: 75 02 D0 75 02 B1 75 05 8F 75 03 50 75 05 2F 75
3D89: 01 0F 75 01 13 75 01 EF 74 01 F1 74 01 F3 74 02
3D99: D1 74 00 00 00 23 68 01 11 00 00 00 10 DB 68 01
3DA9: 40 00 00 08 01 01 01 01 01 01 01 01 01 00 00 00
3DB9: 00 00 00 80 01 C0 FF 01 FF FF 34 C3 39 00 67 80
3DC9: 69 1A 01 00 00 00 00 00 00 00 00 04 00 10 00 00
3DD9: 00 00 00 1E 18 0B 4B 14 18 0B 4B 1E 18 0B 3B 14
3DE9: 18 0B 3B 3D 01 03 02 4D 01 04 01 27 70 01 E0 00
3DF9: 00 7F 40 01 78 02 00 27 49 0C F0 7F 49 0C 88 1E
3E09: 07 03 09 24 64 BB C0 23 8D 7B B4 1B 8C 7C 64 4B
3E19: 0E 04 02 23 46 03 68 DB 46 03 68 17 50 00 5C E7
3E29: D0 00 5C 8C 50 00 84 73 D0 00 84 17 50 00 D4 E7
3E39: D0 00 D4 53 73 0A A0 8B 74 0A F0 DB 75 0A A0 5B
3E49: 73 0A C8 E3 74 0A 60 1B 75 0A 80 DB 73 0A C8 93
3E59: 74 0A F0 33 75 0A 50 44 03 08 04 37 F4 37 C0 37
3E69: 8C 77 70 77 A4 77 D8

pickAwardTierByObjectCount:
3E70: 11 01 00        LD      DE,$0001            
3E73: 06 7B           LD      B,$7B               
3E75: 1F              RRA                         
3E76: D2 28 1E        JP      NC,$1E28            ; {code.awardScorePopup}
3E79: 1E 03           LD      E,$03               
3E7B: 06 7D           LD      B,$7D               
3E7D: 1F              RRA                         
3E7E: D2 28 1E        JP      NC,$1E28            ; {code.awardScorePopup}
3E81: 1E 05           LD      E,$05               
3E83: 06 7F           LD      B,$7F               
3E85: C3 28 1E        JP      $1E28               ; {code.awardScorePopup}

dispatchBoardOverlapSearch:
3E88: 3A 27 62        LD      A,($6227)           ; {ram.board}
3E8B: E5              PUSH    HL                  
3E8C: EF              RST     $28                 

; ---- $3E8D-$3E98: jump table ----
3E8D: 00 00 99 3E B0 28 E0 28 01 29 00 00

loc_3e99:
3E99: E1              POP     HL                  
3E9A: AF              XOR     A                   
3E9B: 32 60 60        LD      ($6060),A           ; {ram.overlapCount}
3E9E: 06 0A           LD      B,$0A               
3EA0: 11 20 00        LD      DE,$0020            
3EA3: DD 21 00 67     LD      IX,$6700            
3EA7: CD C3 3E        CALL    $3EC3               ; {code.countObjectOverlaps}

loc_3eaa:
3EAA: 06 05           LD      B,$05               
3EAC: DD 21 00 64     LD      IX,$6400            
3EB0: CD C3 3E        CALL    $3EC3               ; {code.countObjectOverlaps}
3EB3: 3A 60 60        LD      A,($6060)           ; {ram.overlapCount}
3EB6: A7              AND     A                   
3EB7: C8              RET     Z                   
3EB8: FE 01           CP      $01                 
3EBA: C8              RET     Z                   
3EBB: FE 03           CP      $03                 
3EBD: 3E 03           LD      A,$03               
3EBF: D8              RET     C                   
3EC0: 3E 07           LD      A,$07               
3EC2: C9              RET                         

countObjectOverlaps:
3EC3: DD CB 00 46     BIT     0,(IX+$00)          
3EC7: CA FA 3E        JP      Z,$3EFA             ; {code.loc_3efa}
3ECA: 79              LD      A,C                 
3ECB: DD 96 05        SUB     (IX+$05)            
3ECE: D2 D3 3E        JP      NC,$3ED3            ; {code.loc_3ed3}
3ED1: ED 44           NEG                         

loc_3ed3:
3ED3: 3C              INC     A                   
3ED4: 95              SUB     L                   
3ED5: DA DE 3E        JP      C,$3EDE             ; {code.loc_3ede}
3ED8: DD 96 0A        SUB     (IX+$0A)            
3EDB: D2 FA 3E        JP      NC,$3EFA            ; {code.loc_3efa}

loc_3ede:
3EDE: FD 7E 03        LD      A,(IY+$03)          
3EE1: DD 96 03        SUB     (IX+$03)            
3EE4: D2 E9 3E        JP      NC,$3EE9            ; {code.loc_3ee9}
3EE7: ED 44           NEG                         

loc_3ee9:
3EE9: 94              SUB     H                   
3EEA: DA F3 3E        JP      C,$3EF3             ; {code.loc_3ef3}
3EED: DD 96 09        SUB     (IX+$09)            
3EF0: D2 FA 3E        JP      NC,$3EFA            ; {code.loc_3efa}

loc_3ef3:
3EF3: 3A 60 60        LD      A,($6060)           ; {ram.overlapCount}
3EF6: 3C              INC     A                   
3EF7: 32 60 60        LD      ($6060),A           ; {ram.overlapCount}

loc_3efa:
3EFA: DD 19           ADD     IX,DE               
3EFC: 10 C5           DJNZ    $3EC3               ; {code.countObjectOverlaps}
3EFE: C9              RET                         

; ---- $3EFF-$3F23: data ----
3EFF: 00 5C 76 49 4A 01 09 08 01 3F 7D 77 1E 19 1E 24
3F0F: 15 1E 14 1F 10 1F 16 10 11 1D 15 22 19 13 11 10
3F1F: 19 1E 13 2B 3F

stampFixedTilePair:
3F24: 21 AF 74        LD      HL,$74AF            
3F27: 11 E0 FF        LD      DE,$FFE0            
3F2A: 36 9F           LD      (HL),$9F            
3F2C: 19              ADD     HL,DE               
3F2D: 36 9E           LD      (HL),$9E            
3F2F: C9              RET                         

; ---- $3F30-$3F9F: data ----
3F30: 50 52 4F 47 52 41 4D 2C 57 45 20 57 4F 55 4C 44
3F40: 20 54 45 41 43 48 20 59 4F 55 2E 2A 2A 2A 2A 2A
3F50: 54 45 4C 2E 54 4F 4B 59 4F 2D 4A 41 50 41 4E 20
3F60: 30 34 34 28 32 34 34 29 32 31 35 31 20 20 20 20
3F70: 45 58 54 45 4E 54 49 4F 4E 20 33 30 34 20 20 20
3F80: 53 59 53 54 45 4D 20 44 45 53 49 47 4E 20 20 20
3F90: 49 4B 45 47 41 4D 49 20 43 4F 2E 20 4C 49 4D 2E

loc_3fa0:
3FA0: CD A6 3F        CALL    $3FA6               ; {code.stamp50mBoardTiles}
3FA3: C3 5F 0D        JP      $0D5F               ; {code.loc_0d5f}

stamp50mBoardTiles:
3FA6: 3E 02           LD      A,$02               
3FA8: F7              RST     $30                 
3FA9: 06 02           LD      B,$02               
3FAB: 21 6C 77        LD      HL,$776C            

loc_3fae:
3FAE: 36 10           LD      (HL),$10            
3FB0: 23              INC     HL                  
3FB1: 23              INC     HL                  
3FB2: 36 C0           LD      (HL),$C0            
3FB4: 21 8C 74        LD      HL,$748C            
3FB7: 10 F5           DJNZ    $3FAE               ; {code.loc_3fae}
3FB9: C9              RET                         

; ---- $3FBA-$3FBF: data ----
3FBA: 00 00 00 00 00 00

pinMarioClimbPose:
3FC0: 21 4D 69        LD      HL,$694D            
3FC3: 36 03           LD      (HL),$03            
3FC5: 2C              INC     L                   
3FC6: 2C              INC     L                   
3FC7: C9              RET                         

; ---- $3FC8-$3FFF: data ----
3FC8: 00 00 41 7F 7F 41 00 00 00 7F 7F 18 3C 76 63 41
3FD8: 00 00 7F 7F 49 49 49 41 00 1C 3E 63 41 49 79 79
3FE8: 00 7C 7E 13 11 13 7E 7C 00 7F 7F 0E 1C 0E 7F 7F
3FF8: 00 00 41 7F 7F 41 00 00
```
