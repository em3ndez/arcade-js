0000	clear A to zero for the reset write
0001	clear the interrupt-enable latch so no vblank fires during boot
0004	jump into the cold-boot memory wipe
0008	read the demo/attract-enable flag
000b	rotate its bit 0 into carry
000c	flag clear -- plain return to the caller
000d	flag set -- bump the stack pointer to drop the return address
000e	drop the second byte of the return address
000f	return past the caller's next step -- a conditional skip
0010	store the fill byte into the cell the pointer names
0011	step the write pointer forward one cell
0012	loop until the byte count runs out
0014	block filled -- return
0020	add the table index to the low byte of the base pointer
0021	put the summed low byte back
0022	clear A to fold the carry in next
0024	carry the index add into the high byte so it survives a page crossing
0025	put the high byte back -- the pointer now names the n-th entry
0026	read the table byte
0027	return the fetched byte
0028	double the state index -- two bytes per jump-table entry
0029	pop the return address, which points at the inline jump table
002a	move the doubled index into E
002b	clear the high byte of the index
002d	point at the selected jump-table slot
002e	read the low byte of the handler address
002f	step to the high byte
0030	read the high byte of the handler address
0031	move the handler address into HL
0032	jump to the selected state handler
003c	read the current random seed
003f	keep a copy of the seed
0040	seed times two
0041	seed times four
0042	add the original -- seed times five
0043	add one -- the linear-congruential step
0044	store the new seed back
0047	return it as this draw's random value
0048	clear the quotient accumulator
004a	eight bits to process
004c	compare the running remainder against the divisor
004d	remainder too small -- skip the subtract
004f	subtract the divisor
0050	complement carry to form this quotient bit
0051	shift the quotient bit into C
0053	shift the divisor down for the next bit
0055	loop for all eight bits
0057	quotient in C, remainder in A -- return
0066	save A and flags on entering the vblank interrupt
0067	save BC
0068	save DE
0069	save HL
006a	save IX
006c	save IY
006e	zero A
006f	clear the interrupt-enable latch to acknowledge the vblank
0072	read the self-test mode flag
0075	test it
0076	nonzero -- divert the whole frame to the self-test path
0079	source: the object-RAM shadow
007c	dest: the sprite/scroll/bullet hardware
007f	128 bytes to copy
0082	block-copy last frame's composed sprites out to hardware
0084	read the watchdog port to pet the watchdog
0087	read a control-history holding cell
008a	shift it one step down the two-frame input history
008d	read the next history cell
0090	shift it down the history chain
0093	read the prior raw IN0/IN1 shadow pair
0096	copy the prior raw pair into the history chain
0099	read the IN2 input port
009c	store it into the IN2 shadow
009f	read the IN1 input port
00a2	store it into the IN1 shadow
00a5	read the IN0 input port
00a8	store it into the IN0 shadow
00ab	test bit 6 -- the service/test switch
00ad	switch set -- abandon the frame and cold-reset
00b0	point at the free-running frame counter
00b3	tick the frame counter down once this frame
00b4	run the coin-input front-end
00b7	pulse the coin meter and award credits
00ba	engage or release the coin lockout by credit count
00bd	run the sound driver's per-frame tick
00c0	drive the sound LFO level
00c3	step the scrolling-text effect one glyph
00c6	load the shared interrupt-epilogue address
00c9	push it as a fake return so the state handler returns through the register-restore tail
00ca	read the game-state index
00cd	dispatch through the five-entry game-state handler table
00d8	restore IY on leaving the interrupt
00da	restore IX
00dc	restore HL
00dd	restore DE
00de	restore BC
00df	value 1
00e1	re-arm the interrupt-enable latch for the next frame
00e4	restore A and flags
00e5	return from the interrupt
00e6	load the VRAM fill write cursor
00e9	32 cells this frame
00eb	the blank tile, value 16
00ed	fill a 32-cell block with the blank tile
00ee	store the advanced cursor back
00f1	point at the boot sub-timer
00f4	tick it down
00f5	still counting -- nothing more this frame
00f6	step down to the demo-enable cell
00f7	set the demo-enable flag to 1
00f9	step down to the mode cell
00fa	clear the mode flag
00fc	step down to the game-state index
00fd	set game state to 1 -- enter attract next frame
00ff	zero A
0100	clear the sequence-state index
0103	read the IN1 shadow (DIP bits)
0106	rotate the top coinage bits down
0107	second rotate
0108	keep the two coinage-mode bits
010a	store the coinage mode
010d	read the IN2 shadow
0110	isolate the config bit
0112	rotate it into place
0113	second rotate
0114	store the config bit
0117	source: the packed 16-byte flag bitmask
011a	unpack the bitmask into the 128-byte flag block
011d	read the IN0 shadow
0120	isolate the screen-flip/cabinet bit
0122	shift it into place
0123	shift again
0124	shift again
0125	store the cabinet/flip bit
0128	read the IN2 input port
012b	keep the low two bits as a coinage index
012d	point at the coinage table in ROM
0130	fetch the coinage-table byte by that index
0131	store the selected coinage byte
0134	seed the object shadow
0137	value 1
0139	write the player-1 status glyph cell
013c	glyph value 0x25
013e	write a status tile
0141	glyph value 0x20
0143	write a status tile
0146	a deferred command word
0149	enqueue it on the command ring
014c	a second deferred command word
014f	enqueue it and return
0156	run the formation-sweep oscillator prep
0159	summarize formation occupancy into row/column tables
015c	load the attract-tail return address
015f	push it so the sub-state returns through the credit hand-off
0160	read the sequence-state index
0163	dispatch to the matching attract sub-state
018c	a deferred command word
018f	enqueue it
0192	a second command word
0195	enqueue it
0198	value 1
019a	set the demo-enable flag
019d	turn the starfield on
01a0	set a 0x7000-block control latch
01a3	set another 0x7000-block control latch
01a6	point at the sequence-state index
01a9	advance to the next attract sub-state
01aa	zero A
01ab	clear the per-step one-shot countdown
01ae	clear the active-player index
01b1	clear a mode cell
01b4	clear the mode/sound flag
01b7	dwell-cascade reload value
01ba	seed the dwell cascade (sub-timer and dwell tier)
01bd	return
01be	value 1
01c0	arm the per-step one-shot countdown
01c3	jump into the shared sub-state tail
01c6	point at the 128-byte flag block
01c9	128 cells
01cb	fill byte zero
01cc	clear the whole flag block
01cd	zero the frame counter
01d0	clear an activity gate
01d3	VRAM cursor start
01d6	seat the VRAM fill cursor
01d9	point at the dwell tier
01dc	arm the dwell tier to 32
01de	step up to the sequence-state index
01df	advance the sequence state
01e0	return
01e1	load the VRAM fill cursor
01e4	28 cells
01e6	the blank tile
01e8	fill 28 cells with the blank tile
01e9	a 4-cell margin
01ec	advance the cursor past the margin
01ed	store the cursor back
01f0	point at the dwell tier
01f3	tick it down
01f4	still filling rows -- return
01f5	step to the sequence-state index
01f6	advance the sequence state
01f7	dwell-cascade reload value
01fa	reseed the dwell cascade
01fd	fill byte zero
01fe	48 cells
0200	point at the object-record region
0203	clear 48 object-record bytes
0204	clear the screen-flip X latch
0207	clear the screen-flip Y latch
020a	clear the orientation flag
020d	value 1
020f	set the object-draw suppress flag
0212	the object-shadow reseed template
0215	reseed the object shadow and return
0218	run a shared sub-state update
021b	point at the boot/dwell sub-timer
021e	tick it down
021f	still counting -- return
0220	reload the sub-timer to 0x50
0222	step up to the dwell tier
0223	command channel 6
0225	read the dwell-tier value
0226	form the command parameter from it
0227	move it into E
0228	enqueue the command word
022b	tick the dwell tier down
022c	still counting -- return
022d	step to the sequence-state index
022e	advance the sequence state
022f	dwell-cascade reload value
0232	reseed the dwell cascade
0235	point at the object-record array base
0238	fill byte zero
0239	count zero -- fills a full 256 bytes
023a	clear the object-record array
023b	clear the drawn-column count
023e	return
023f	wipe the strided sway-coordinate table before this frame's redraw
0242	stage the eight object records into the sprite shadow
0245	run each of the eight object slots' AI for this frame
0248	repaint the queued tile-columns on the frame-phase beat
024b	point HL at the fast sub-timer of the dwell cascade
024e	tick the sub-timer down one frame
024f	still counting -- nothing more this frame
0250	sub-timer expired -- reload it to $d2
0252	step the pointer up to the descriptor-number cell
0253	activate the descriptor slot named by that number
0256	park the descriptor pointer in DE
0257	point HL at the running tile-column redraw count
025a	bump the count of columns queued to redraw
025b	swap back to the dwell-cell pointer
025c	tick the dwell tier down one
025d	dwell not expired -- done this frame
025e	dwell expired -- reload it to $d2
0260	step up to the sequence-state index
0261	advance the attract sequence to its next sub-state
0262	clear A to zero
0263	clear cell $4058
0266	return
0267	wipe the strided sway-coordinate table
026a	stage the object records into the sprite shadow
026d	run all eight object slots' AI this frame
0270	repaint the queued tile-columns on the beat
0273	point HL at the dwell tier
0276	tick the dwell down one frame
0277	dwell not up -- nothing more
0278	step up to the sequence-state index
0279	advance the attract sequence to its next sub-state
027a	clear A
027b	clear cell $4058
027e	load the two-tier reload pair ($40 sub / $11 dwell)
0281	re-arm the dwell cascade
0284	point HL at the tile-column redraw count
0287	bump the column redraw count
0288	build command word: channel 6, arg $0f (column draw)
028b	queue the column-draw command and return
028e	wipe the strided sway-coordinate table
0291	stage the object records into the sprite shadow
0294	run all eight object slots' AI this frame
0297	repaint the queued tile-columns on the beat
029a	pure dwell -- tail into the prescaled sequence timer
029d	wipe the strided sway-coordinate table
02a0	load the VRAM fill write cursor
02a3	count = 28 cells, one tile-row width
02a5	fill byte = the blank tile $10
02a7	block-fill a 28-cell blank row of the tilemap
02a8	step = 4 cells
02ab	advance the cursor past this row
02ac	store the advanced VRAM write cursor
02af	point HL at the dwell tier
02b2	tick the dwell down
02b3	dwell not up -- done this frame
02b4	step up to the sequence-state index
02b5	advance the attract sequence to its next sub-state
02b6	point HL at the object-record array base
02b9	fill byte = 0
02ba	count = 0 (wraps to a full 256)
02bb	block-fill -- clear all 256 bytes of the object records
02bc	point HL at the sprite-shadow base
02bf	count = 64 bytes
02c1	block-fill -- clear the 64-byte sprite shadow
02c2	load the two-tier reload pair ($40 sub / $04 dwell)
02c5	re-arm the dwell cascade
02c8	reseed the sprite-code lane of the object shadow from ROM
02cb	build command word: channel 6, arg 0
02ce	queue command 6 and return
02d1	command word: channel 7, arg 1 (credit-count redraw)
02d4	queue the credit-count redraw
02d7	command word: channel 6, arg 0 (message-column draw)
02da	queue the message-column draw
02dd	point HL at the sequence-state index
02e0	advance the attract sequence to its next sub-state
02e1	load the two-tier reload pair ($60 sub / $10 dwell)
02e4	re-arm the dwell cascade
02e7	return
02e8	point HL at the 128-byte formation flag block
02eb	count = 128 flag cells
02ed	fill byte = 0
02ee	block-fill -- clear the whole formation flag block
02ef	clear the frame-counter cell $425f
02f2	clear the object-draw-suppress flag $4238
02f5	point HL at the dwell tier
02f8	arm the mid-tier dwell to $40
02fa	advance the sequence and reseed the object shadow
02fd	point DE at the packed descriptor bitmask in ROM
0300	unpack it into the 128-cell formation flag block
0303	move the advanced source pointer into HL
0304	point DE at the working buffer $4218
0307	count = 8 bytes
030a	copy the trailing 8-byte template into the working buffer
030c	clear A
030d	clear the frame-counter cell $425f
0310	A = 1
0311	set the state-advance arm gate $421d
0314	point HL at the sequence-state index
0317	advance the attract sequence to its next sub-state
0318	step up to the VRAM cursor low byte cell
0319	stamp $96 into the VRAM cursor low byte
031b	load the deferred-callback pointer $0640
031e	publish it into $4245
0321	return
0322	A = 1
0324	force the sequence state to 1
0327	load the short-dwell pair (3 sub / 3 dwell)
032a	seed the step-1 dwell cascade
032d	return
032e	point HL at the $4009 dwell tier
0331	tick the byte HL names down one
0332	still counting -- nothing more
0333	step to the next byte in the cascade
0334	carry out: increment it (dwell expiry bumps the sequence state)
0335	return
0336	point HL at the fast sub-timer
0339	tick the sub-timer down one frame
033a	sub-timer not wrapped -- done
033b	wrapped -- reload the sub-timer to 60
033d	step up to the dwell tier
033e	tick the dwell, carrying into the sequence state
0341	read the descriptor number from the dwell cell
0342	swap to the alternate register bank
0343	descriptor number minus one (zero-based)
0344	keep the slot index in B
0345	shift right...
0346	...again...
0347	...a third time to form the slot offset
0348	low byte of the slot offset
0349	high byte = 0
034b	point HL at the descriptor-slot table base
034e	index to this descriptor's 32-byte slot
034f	stamp field 0 = 1 -- mark the slot active
0351	step to field 1
0352	clear field 1
0354	step to field 2
0355	stamp field 2 = $0d, the object-AI state index
0357	step to field 3
0358	step to field 4, leaving field 3 untouched
0359	clear field 4
035b	step to field 5
035c	stamp field 5 = $0c
035e	step to field 6
035f	step to field 7, leaving field 6 untouched
0360	stamp field 7 = the slot index
0361	swap the register bank back
0362	return
0363	fill value = 0
0364	broadcast 0 across the nine-cell sway coordinate table
0367	read the running tile-column redraw count
036a	test it
036b	nothing queued -- return
036c	only one column queued?
036d	if just one, nothing to draw yet -- return
036e	B = the number of columns to draw
036f	read the frame counter
0372	keep the raw counter in C
0373	mask to the low six bits -- the draw phase
0375	phase zero -- go blank the columns
0377	phase $20 -- the draw phase?
0379	any other phase -- nothing this frame
037a	recall the raw frame counter
037b	rotate left...
037c	...twice
037d	keep two bits -- a 0..3 table selector
037f	stash the selector
0380	times two...
0381	...plus one -- times three, the 3-byte row stride
0382	low byte of the row offset
0383	high byte = 0
0385	point HL at the tile-column source-row table
0388	index to the selected source row
0389	point DE at the destination VRAM column
038c	paint the first column's three cells
038f	one column drawn
0390	that was the only one -- done
0391	point HL at the continuation source-row table
0394	paint the next column
0397	repeat for every remaining queued column
0399	return
03af	count = 3 cells up this column
03b1	read the next source byte
03b2	store it into the VRAM column cell
03b3	advance the source pointer
03b4	take the destination low byte
03b5	step up one 32-cell tilemap row
03b7	store the stepped destination low byte
03b8	one cell done
03b9	loop for all three cells of the column
03bc	advance to the next column (+$62 lines it up)
03be	store the new destination low byte
03bf	return the advanced pointers
03c0	point HL at the first VRAM column
03c3	step = minus one tilemap row (-$20, 16-bit)
03c6	count = 3 cells per column
03c8	fill = the blank tile $10
03ca	stamp the blank tile into this cell
03cb	step up one tilemap row, borrowing into the high byte
03cc	one cell done
03cd	loop for all three cells of the column
03d0	take the pointer low byte
03d1	advance to the next column (+$62)
03d3	store the new low byte
03d4	repeat for every queued column
03d6	return
03d7	read the credit count
03da	test it
03db	no credit banked -- leave attract running
03dc	point HL at the game-state index
03df	advance the game state (attract to press-start)
03e0	step to $4006
03e1	step to $4007
03e2	clear the attract mode flag $4007
03e4	A = 0
03e5	clear the sequence-state index
03e8	clear cell $41c2
03eb	clear the sound-sweep request $41df
03ee	clear the message-scroller enable flag
03f1	return
03f2	sway the alien block one step
03f5	fold the occupancy grid into its row/column summaries
03f8	point at the start-button launcher
03fb	push it as the post-dispatch return
03fc	read the sequence-state index
03ff	dispatch through the inline table to this start-screen sub-state
0408	point at the start-screen object-shadow ROM template
040b	seed the sprite-code lane from that template
040e	point HL at the sprite-shadow base
0411	count = 64 bytes
0413	fill = 0
0414	block-fill -- clear the 64-byte sprite shadow
0415	point HL at the object-record region
0418	block-fill -- clear 256 bytes of object records
0419	count = 80 more bytes
041b	block-fill -- clear the trailing 80 bytes of the region
041c	clear the object-draw-suppress flag $4238
041f	clear the message-scroller enable flag
0422	point at VRAM base + 2
0425	set the VRAM fill write cursor there
0428	point HL at the dwell tier
042b	arm the dwell to $10
042d	step up to the sequence-state index
042e	advance the sequence to its next sub-state
042f	return
0430	point HL at the press-start step countdown cell 0x4019
0433	count that step timer down one frame
0434	still counting -- skip ahead to just refresh the start-button lamps
0437	timer hit zero: point at the sequence state index
043a	step the press-start sequence to its next sub-state
043b	point at the base of the 128-cell formation flag block
043e	128 cells to clear
0440	fill byte zero -- no live alien
0441	block-fill the whole formation flag block empty
0442	done for this frame
0443	load the VRAM fill write cursor
0446	28 cells -- one tilemap row of the press-start screen
0448	blank tile $10
044a	block-fill one blank row into VRAM
044b	stride of 4 cells -- the gap over to the next row
044e	step the cursor past the 4-cell gap
044f	28 cells for the second blank row
0451	block-fill the second blank row of tiles
0452	step the cursor past the trailing gap
0453	store the advanced VRAM write cursor
0456	point at the dwell timer tier 0x4009
0459	tick the dwell down one frame
045a	rows still to blank -- return
045b	dwell expired: step to the sequence state 0x400a
045c	advance to the next press-start sub-state
045d	zero
045e	clear the screen-flip X latch
0461	clear the screen-flip Y latch
0464	clear the sprite-orientation/direction flag
0467	command word channel 7 param 2
046a	enqueue that deferred command
046d	command word channel 6 param 1
0470	enqueue that deferred command
0473	read the free-running frame counter
0476	isolate bit 5 -- the start-lamp blink gate
0478	gate closed -- go blank both start lamps this frame
047a	read the credit/start count
047d	test it
047e	no credits -- leave the lamps as they are
047f	stash the credit count
0480	lamp-on value
0482	light the one-player start-button lamp
0485	account for one credit
0486	only one credit -- leave the two-player lamp off
0487	two or more credits -- light the two-player lamp too
048a	done
048b	clear the one-player start lamp
048e	clear the two-player start lamp
0491	done
0492	read the IN1 input shadow -- the start buttons
0495	test the one-player start button
0497	pressed -- go begin a one-player game
0499	test the two-player start button
049b	neither pressed -- nothing to launch
049c	two-player wanted: read the credit count
049f	need at least two credits
04a1	fewer than two -- cannot start a two-player game
04a2	spend two credits
04a4	store the reduced credit count
04a7	source: the 32-byte starting-board template in ROM
04aa	dest: player-two's saved-state board buffer
04ad	32 bytes
04b0	copy the fresh board template into the saved-state snapshot
04b2	read the config/DIP bit
04b5	rotate its bit 0 into carry
04b6	if set, arm the state-advance gate
04b9	spawn word: high byte 1 marks a two-player game
04bc	store the player-count/spawn word in the current-player cell
04bf	source: the 32-byte starting-board template again
04c2	dest: player-one's packed board bitmap
04c5	32 bytes
04c8	blit the starting board into the packed flag bitmap
04ca	read the config bit again
04cd	bit 0 into carry
04ce	if set, arm the sub-state-advance gate
04d1	zero
04d2	reset the sequence state to 0 -- enter play at sub-state 0
04d5	game-state 3
04d7	set the game state to play (player one)
04da	value 1
04dc	raise the mode/sound gate
04df	raise the companion sound-enable flag
04e2	command word channel 6 param 4 -- the start message
04e5	enqueue it
04e8	command word channel 4 param 0 -- clear a score slot
04eb	enqueue it
04ee	bump to param 1 -- the second score-slot clear
04ef	enqueue it and return through the queue routine
04f2	read the credit count
04f5	test it
04f6	no credit -- take the no-credit path
04f8	spend one credit
04f9	store the reduced count
04fc	point at player-two's saved-state buffer
04ff	32 bytes
0501	fill byte zero
0502	clear the saved-state snapshot -- single player holds no second board
0503	spawn word 0 -- single player
0506	enter the round via the game-start routine
0509	game-state 1 (attract)
050b	no credit to spend -- drop the machine back to attract
050e	done
050f	the armed marker value 3
0511	arm the state-advance gate the end-of-round handler tests
0514	done
0515	the armed marker value 3
0517	arm the sub-state-advance gate for the alternate end-of-round handler
051a	done
0536	run the per-frame formation sway
0539	summarize formation occupancy into row and column summaries
053c	read the play sub-state index
053f	dispatch through the eight-entry play sub-state jump table below
0540	sub-state 0 vector -- the playfield-setup handler
0542	sub-state 1 vector -- the progressive screen-clear handler
0544	sub-state 2 vector -- restore the board and enter play
0546	sub-state 3 vector -- the pre-play dwell timer
0548	sub-state 4 vector -- activate objects and begin the play phase
054a	sub-state 5 vector -- the per-frame gameplay pipeline
054c	sub-state 6 vector -- the end-of-round branch
054e	sub-state 7 vector -- pack the board and switch players
0550	point at the formation flag block base
0553	128 cells
0555	fill byte zero
0556	clear the one-player start lamp
0559	clear the two-player start lamp
055c	block-fill the formation flag block empty
055d	zero the free-running frame counter
0560	point at the object-record work span from 0x4200
0563	23 bytes -- the object active-flag and control cells
0565	clear that object span
0566	step to 0x4218
0567	24 more bytes -- the rest of the object/timer work span
0569	clear that span too
056a	point at the moving-object / projectile table
056d	70 bytes
056f	clear the moving-object and projectile records
0570	value 1
0572	set the region-activity gate flag
0575	point at the sequence state
0578	advance to play sub-state 1
0579	step to the dwell timer 0x4009
057a	arm the dwell timer to 32
057c	the VRAM base
057f	rewind the VRAM fill cursor to the top of the tilemap
0582	done
0583	load the VRAM fill cursor
0586	32 cells -- one screen row
0588	blank tile $10
058a	block-fill one row of blank tiles
058b	store the advanced cursor
058e	point at the phase/dwell counter
0591	tick it down one row
0592	rows still to clear -- return
0593	step to the sequence state 0x400a
0594	advance to the next play sub-state
0595	source: the ROM object-shadow template
0598	dest: the code lane of the OBJRAM shadow
059b	32 sprite codes to seed
059d	read the next code byte from the ROM template
059e	write it into the shadow's code lane
059f	advance the ROM source
05a0	step the dest one cell
05a1	step again -- skip the interleaved coordinate cell (stride 2)
05a2	loop for all 32 codes
05a4	done
05a5	point at the packed board bitmap (player one)
05a8	unpack the packed bitmap into the 128-cell flag grid
05ab	put the pointer just past the mask into HL
05ac	dest: the working board template buffer
05af	8 bytes
05b2	copy the trailing 8-byte board template into the working buffer
05b4	zero
05b5	clear the frame counter
05b8	clear the region-clear flag
05bb	clear the screen-flip X latch
05be	clear the screen-flip Y latch
05c1	clear the sprite-orientation/direction flag
05c4	point at the sequence state
05c7	advance to the next play sub-state
05c8	step to the dwell timer 0x4009
05c9	arm a long 150-frame dwell
05cb	the deferred-callback pointer value
05ce	publish it for the play pipeline
05d1	read the mode/sound gate
05d4	bit 0 into carry
05d5	sound gate closed -- skip the board-start cue
05d6	read the paired-player flag
05d9	bit 0 into carry
05da	paired player -- use the paired board-start sound variant
05dc	command word channel 5 param 0 -- board-start sound prologue
05df	enqueue it
05e2	param 2 (channel stays in D)
05e4	enqueue word (channel, 2)
05e7	bump to the next channel
05e8	enqueue word (next channel, 2)
05eb	param 4
05ed	enqueue word (next channel, 4)
05f0	command word channel 7 param 3
05f3	enqueue it
05f6	command word channel 7 param 0
05f9	enqueue the last burst word and return through the queue routine
05fc	command word channel 5 param 3 -- paired-player sound prologue
05ff	enqueue it
0602	jump into the five-word sound burst
0605	point at the dwell timer
0608	tick it down
0609	still dwelling -- return
060a	reload the dwell to 20
060c	step to the sequence state
060d	advance to the next play sub-state
060e	command word channel 6 param $82 -- this state's cue
0611	enqueue it and return
0614	point at the dwell timer
0617	tick it down
0618	still dwelling -- return
0619	reload the dwell to 10
061b	step to the sequence state
061c	advance to the play sub-state
061d	value 1
0620	raise the object-active master flag -- switch on objects, AI and shots
0623	128 -- screen centre
0625	park the ship's X at centre
0628	source: the enemy-launch sub-counter reload table
062b	dest: the 16-byte launch sub-counter block
062e	16 bytes
0631	refill the enemy-launch sub-counters
0633	zero
0634	clear a launch/object scratch cell
0637	clear a second launch/object scratch cell
063a	command word channel 7 param 3
063d	enqueue it
0640	command word channel 2 param 0 -- the field-indicator draw
0643	enqueue it and return
0646	point HL at the formation flag block base -- 128 one-byte-per-cell live-alien flags
0649	B counts the 16 packed mask bytes to unpack
064b	C is the bit selector, starting at bit 0
064d	read the next packed mask byte from the source board
064e	test the current bit of that mask byte
064f	bit clear -- this grid cell has no alien
0651	bit set -- mark this cell as a live alien in the formation
0653	step to the next flag cell
0654	rotate the bit selector to the next bit
0656	still within this mask byte -- test its next bit
0658	mask byte spent -- advance to the next packed source byte
0659	loop until all 16 mask bytes have been unpacked
065b	done -- the whole 128-cell formation is expanded, DE left past the mask
065c	clear this flag cell -- no alien here
065e	rejoin the cell-step and loop
0661	move the player ship and stage its sprite for this frame
0664	advance the player's shot and stage its sprite
0667	integrate and render the enemy shots this frame
066a	run the object-AI on all eight alien slots
066d	turn the eight object records into sprite-shadow entries
0670	arm the behavior/fire gate on input or timer
0673	test the player's shot against the standing formation
0676	test the enemy shots against the player ship
0679	test the player's shot against the diving aliens
067c	test the diving aliens against the player ship
067f	acknowledge a pending request and clear the behavior gate
0682	spawn extra objects when a delayed event has fired
0685	launch a diving attacker out of the formation
0688	choose the next attacker's launch direction
068b	step the slow difficulty/pace ramp one notch
068e	handle the player being hit this frame
0691	tick the player-death sound step sequence
0694	emit the decaying sound sweep
0697	pace the enemy-launch trigger counter
069a	arm the delayed-event timer
069d	count the delayed-event timer down and fire it on zero
06a0	scan row occupancy for the next row allowed to shoot
06a3	arm the stage-advance one-shot when the board is clear
06a6	advance the stage and rebuild the formation when armed
06a9	light the marching-hum voices from how full the block is
06ac	tick the activity-gated play timer
06af	compute the demo-mode autopilot move command
06b2	read the shot/behavior gate byte
06b5	read the object-active flag and the byte above it as a word
06b8	fold in the high byte of that pair
06b9	fold in the object-active flag
06ba	shift the combined activity bit0 into carry
06bb	still something active -- field busy, leave without advancing
06bc	read the stage-advance / region-clear flag
06bf	test its bit0
06c0	board not cleared yet -- leave
06c1	point at the 14 five-byte moving-object records
06c4	DE is the 5-byte record stride
06c7	B counts all 14 records
06c9	clear the running OR accumulator
06ca	fold in this record's active byte
06cb	step to the next record
06cc	loop over all 14 moving-object records
06ce	test bit0 of the combined active bits
06cf	a moving object still live -- field busy, leave
06d0	point at the sequence dwell timer
06d3	field is quiescent -- count the dwell down
06d4	still dwelling -- leave
06d5	step the pointer up to the sequence-state cell
06d6	dwell expired -- advance the play sub-state
06d7	done
06d8	point HL at the sequence-state cell
06db	read the arm/cycle gate
06de	test it
06df	armed -- take the alternate branch
06e1	read the mode flag
06e4	test it
06e5	clear -- drop to the shared advance/reset tail
06e7	read the second mode flag
06ea	test it
06eb	clear -- drop to the shared tail
06ed	advance the sequence to the next sub-state
06ee	step down to the dwell timer
06ef	arm the dwell timer to 130
06f1	read the mode/sound gate
06f4	test its bit0
06f5	sound gate closed -- done
06f6	command word: channel 6, parameter 2
06f9	queue that channel-6 command
06fc	change the parameter to 0
06fe	queue the second channel-6 command and return
0701	read the mode flag
0704	test it
0705	clear -- take the by-timer branch
0707	read the second mode flag
070a	test it
070b	clear -- take the by-timer branch
070d	advance the sequence sub-state counter
070e	step down to the dwell timer
070f	re-arm the dwell timer to 80
0711	done
0712	read the mode flag
0715	test its bit0
0716	clear -- set the sequence to state 14
0718	set the sequence to state 4
071a	re-arm the dwell timer and return
071d	set the sequence to state 14
071f	re-arm the dwell timer and return
0722	read the mode flag
0725	test its bit0
0726	clear -- just advance the sub-state and reload the dwell (carry on)
0728	game over: prepare state 1 (attract)
072a	set the game state back to 1 -- attract
072d	zero A
072e	clear the mode flag
0731	clear the sequence-state cell
0734	silence audio and halt the interrupt and starfield
0737	command word: channel 6, parameter 0
073a	queue the final command word and return
073d	point at the sequence dwell timer
0740	count the dwell down
0741	still dwelling -- leave
0742	step up to the sequence-state cell
0743	zero A
0744	clear the sequence-state cell
0745	clear the stage-advance pending word
0748	clear the activity-timer arm flag
074b	point DE at the player-1 packed board storage
074e	pack the live formation into the 16-byte board bitmap
0751	source: the 8-byte working template
0754	copy 8 bytes
0757	append the template after the packed board
0759	prepare player index 1
075b	set the active player to player 2
075e	prepare game state 4
0760	hand the machine to the player-two play frame
0763	done
0764	point HL at the 128 formation flag bytes
0767	B counts the 16 output mask bytes
0769	C is the bit selector, starting at bit 0
076b	clear the mask byte being built
076c	test this flag cell's live-alien bit
076e	cell empty -- leave the bit clear
0770	cell live -- set the corresponding bit
0771	step to the next flag cell
0772	rotate the bit selector to the next bit
0774	still filling this mask byte -- next cell
0776	store the completed mask byte
0777	advance the output pointer
0778	loop until all 16 mask bytes are packed
077a	done -- DE left past the packed bitmap
077b	sway the alien formation this frame
077e	fold the occupancy grid into its row/column summaries
0781	read the sequence-state cell (the play sub-state)
0784	dispatch through the following handler table by that index
0785	sub-state 0 handler pointer
0787	sub-state 1 handler pointer
0789	sub-state 2 handler pointer -- restore the saved board
078b	sub-state 3 handler pointer
078d	sub-state 4 handler pointer
078f	sub-state 5 handler pointer -- the per-frame gameplay pipeline
0791	sub-state 6 handler pointer -- the branch step
0793	sub-state 7 handler pointer -- the hand-off terminal
0795	point DE at the player-2 saved board storage
0798	expand the saved board back into the 128 flag cells
079b	move the advanced source pointer (past the mask) into HL
079c	destination: the 8-byte working template buffer
079f	copy 8 bytes
07a2	copy the trailing template into the working buffer
07a4	zero A
07a5	reset the frame counter
07a8	clear the region-clear flag
07ab	read the screen-flip / cabinet config bit
07ae	test it
07af	not flipped -- skip the flip latches
07b1	set the orientation flag
07b4	set the screen-flip X latch
07b7	set the screen-flip Y latch
07ba	point HL at the sequence-state cell
07bd	advance to the next sub-state
07be	step down to the dwell timer
07bf	arm a long dwell of 150
07c1	load the deferred-callback handler pointer
07c4	publish it into the callback cell
07c7	read the sound gate
07ca	test its bit0
07cb	sound gate closed -- done
07cc	command word: channel 5, parameter 3
07cf	queue it
07d2	command word: channel 6, parameter 3
07d5	queue it
07d8	bump the parameter to 4
07d9	queue channel 6, parameter 4
07dc	command word: channel 7, parameter 3
07df	queue it
07e2	command word: channel 7, parameter 0
07e5	queue the fifth intro cue and return
07e8	point HL at the sequence-state cell
07eb	read the arm/cycle gate
07ee	test it
07ef	armed -- take the alternate branch
07f1	read the advance gate
07f4	test it
07f5	clear -- drop to the shared advance/reset tail
07f8	advance the sequence to the next sub-state
07f9	step down to the dwell timer
07fa	arm the dwell timer to 130
07fc	read the sound gate
07ff	test its bit0
0800	sound gate closed -- done
0801	command word: channel 6, parameter 3
0804	queue it
0807	change the parameter to 0
0809	queue the second channel-6 command and return
080c	read the advance gate
080f	test it
0810	clear -- jump to the by-mode state set
0813	advance the sequence to the next sub-state
0814	step down to the dwell timer
0815	arm the dwell timer to 80
0817	done
0818	point at the sequence dwell timer
081b	count the dwell down
081c	still dwelling -- leave
081d	step up to the sequence-state cell
081e	zero A
081f	clear the sequence-state cell
0820	set the active player back to player 1
0823	prepare game state 3
0825	hand the machine back to the player-one play frame
0828	point DE at the player-2 saved board storage
082b	pack the live formation into the snapshot bitmap
082e	source: the 8-byte working template
0831	copy 8 bytes
0834	append the template after the packed snapshot
0836	done
0837	point HL at the object-active flag
083a	is the ship subsystem switched on?
083c	ship not active -- take the parked-ship branch
083e	step past the alternate-mode flag
083f	point at the ship's X position cell
0840	read the mode flag
0843	shift its bit 0 into carry
0844	demo mode -- take the auto-pilot move command instead of a controller
0847	read the orientation flag
084a	shift its bit 0 into carry
084b	cabinet flipped -- read the second control port
084d	read the first input port shadow (the joystick)
0850	keep the movement bits in B
0851	test the move-down bit
0853	not pressed -- skip the down step
0855	read the ship's current X
0856	compare against the low limit (23)
0858	at the bottom edge -- don't step past it
085a	nudge the ship one pixel down
085b	test the move-up bit
085d	not pressed -- skip the up step
085f	read the ship's current X
0860	compare against the top limit (233)
0862	at the top edge -- don't step past it
0864	nudge the ship one pixel up
0865	read the ship's final X
0866	one's-complement it for the sprite
0867	offset by 128 to make the on-screen sprite value
0869	use ship sprite code 6
086b	point at the ship's sprite staging block
086e	four sprite copies to write
0870	store the ship sprite value
0871	step to the code cell
0872	store the sprite code
0873	step to the next staging pair
0874	loop over all four copies
0876	done staging the ship
0877	point at the alternate-mode flag
0878	is the death/animation pose set?
087a	yes -- stage the death pose
087c	point at the ship's X cell
087d	slam the ship position to zero
087f	stage the parked ship
0882	point at the ship's X cell
0883	read the frozen ship X
0884	one's-complement it for the sprite
0885	offset by 128
0887	use the death-pose sprite code 7
0889	stage the death pose
088c	read the second input port shadow
088f	apply those movement bits
0892	read the auto-pilot move command
0895	apply those movement bits
0898	advance the player's shot for this frame
089b	load the shot's climb counter and column together
089e	read the orientation flag
08a1	shift its bit 0 into carry
08a2	screen flipped -- take the flipped X formula
08a4	take the shot's climb counter
08a5	complement it
08a6	add 252 to form the drawn shot X
08a8	write the shot's render X cell
08ab	take the shot's column byte
08ac	complement it into the code
08ad	write the shot's render code cell
08b0	done staging the shot
08b1	take the shot's climb counter
08b2	subtract one for the flipped X
08b3	write the shot's render X cell
08b6	take the shot's column byte
08b7	complement it into the code
08b8	write the shot's render code cell
08bb	done staging the shot
08bc	point at the shot in-flight gate
08bf	is a shot in the air?
08c1	point at the shot's climb counter
08c2	no shot flying -- go park a fresh one
08c4	read the shot's climb counter
08c5	climb the bullet four pixels up the screen
08c7	store the new position
08c8	begin the test for how close it is to the top
08ca	finish the top-window test
08cc	not yet at the top -- done
08cd	load flag value 1
08cf	raise the shot-retire request
08d2	done
08d3	park the shot counter at 220 (bottom of screen)
08d5	point at the shot's column cell
08d6	read the object-active flag
08d9	is play live?
08db	not live -- seed the column to zero
08dd	read the ship's X
08e0	seed the shot's column from the ship
08e1	done
08e2	seed the shot's column to zero
08e4	done
08e5	read the shot-retire request flag
08e8	shift its bit 0 into carry
08e9	no pending retire -- done
08ea	zero A
08eb	clear the retire request
08ee	clear the shot in-flight gate so a new shot can fire
08f1	done
08f2	save HL across the enqueue
08f3	high byte of the command-queue page
08f5	read the queue write head
08f8	point at the head slot
08f9	is this slot free?
08fb	slot busy -- drop the command
08fd	store the channel selector
08fe	step to the parameter cell
08ff	store the parameter byte
0900	advance the write head
0901	take the new head
0902	compare against the queue floor (0xc0)
0904	still in range -- keep it
0906	wrap the head back up to the floor
0908	store the advanced write head
090b	restore HL
090c	done
090d	point at the shot in-flight gate
0910	is a shot armed?
0912	no shot -- march the formation normally
0914	point at the shot's climb counter
0915	read the shot's climb counter
0916	shift into the formation's vertical band
0918	is the shot within the block's rows?
091a	shot below the block's rows -- march normally
091c	point at the shot's column cell
091d	read the formation anchor's low byte
0920	measure the shot's offset from the anchor
0921	flip the sign of the offset
0923	keep the offset in B
0924	center the alignment window
0926	look at the fine column offset
0928	is the shot lined up under the marching column?
092a	not lined up -- march normally
092c	recover the offset
092d	shift out the column index
092e	shift again
092f	shift again
0930	shift again (offset now in the low nibble)
0931	isolate the target column number
0933	column index low byte
0934	column index high byte zero
0936	point at the column-occupancy summary
0939	index the targeted column
093a	is that column still holding aliens?
093c	occupied -- freeze the march so the shot's column stays put
093e	load the 16-bit formation anchor
0941	load the formation's low and high X bounds
0945	read the sweep direction flag
0948	test which way the block is marching
0949	marching the other way -- take that branch
094b	check the anchor's high-byte sign
094d	past the wrap -- skip the bound check
094f	anchor low byte
0950	compare against the low bound
0951	reached the low bound -- turn the block around
0953	read the frame counter
0956	only step one frame in four
0958	not this frame -- done
0959	step the anchor one unit up
095a	commit the new anchor
095d	check the anchor's high-byte sign
095f	not past the wrap -- check the bound
0961	anchor low byte
0962	compare against the high bound
0963	reached the high bound -- turn the block around
0965	read the frame counter
0968	only step one frame in four
096a	not this frame -- done
096b	step the anchor one unit down
096c	store the advanced formation anchor
096f	take the anchor's low byte
0970	negate it for the coordinate lane
0972	point at the object shadow's coordinate lane
0975	nine cells to update
0977	write the swept column coordinate
0978	skip the interleaved code cell
0979	step to the next coordinate cell
097a	broadcast across all nine sprites
097c	done
097d	direction value for marching the other way
097f	set the block to march the other way
0982	done
0983	direction value for marching back
0984	set the block to march back
0987	done
0988	load the current formation anchor unchanged
098b	re-publish it without marching
098e	zero A
098f	point at the row-occupancy summaries (guards first)
0992	clear the first guard cell
0993	step
0994	clear the second guard cell
0995	step to the first row summary
0996	six formation rows to fold
0998	point at the occupancy grid
099b	ten columns per row
099d	clear the row accumulator
099e	OR in this cell's occupancy
099f	next column
09a0	fold the whole row together
09a2	store this row's occupancy summary
09a3	next summary slot
09a4	advance the grid pointer
09a5	skip to the next row (16-byte stride)
09a7	update the pointer
09a8	one row done
09a9	loop over all six rows
09ac	zero A
09ad	clear a column-summary guard cell
09ae	step
09af	clear another guard cell
09b0	step
09b1	clear the third guard cell
09b2	step to the first column summary
09b3	point back at the occupancy grid
09b6	ten formation columns to fold
09b8	save the summary pointer
09b9	row-to-row stride of 16
09bc	six rows per column
09be	clear the column accumulator
09bf	OR in this cell's occupancy
09c0	step down a row
09c1	fold the whole column together
09c3	restore the summary pointer
09c4	store this column's occupancy summary
09c5	next column slot
09c6	back the grid pointer up
09c7	return to the next column's top cell
09c9	update the pointer
09ca	one column done
09cb	loop over all ten columns
09ce	point at the rightmost column summary
09d1	ten columns to scan for the block's extent
09d3	start the right-edge X bound at 34
09d5	test bit 0 of the column-occupancy cell -- is this column of the alien block occupied?
09d7	occupied column found -- stop scanning; E holds the low-byte X bound
09d9	step the pointer back to the next column inward from the right
09da	pull the running low bound into A
09db	add 16 -- one empty column widens the block's right edge by 16 pixels
09dd	stash the widened low bound back in E
09de	loop across all ten columns from the right
09e0	whole block empty -- reset the low X bound to 34
09e2	point at the column-occupancy summaries again, this time the left end
09e5	B = 10 columns to scan from the left
09e7	seed the high-byte X bound at 224
09e9	is this column occupied, scanning inward from the left?
09eb	occupied column found -- stop; D holds the high-byte X bound
09ed	step to the next column inward from the left
09ee	pull the running high bound into A
09ef	subtract 16 -- one empty column pulls the left edge in by 16 pixels
09f1	stash the narrowed high bound back in D
09f2	loop across all ten columns from the left
09f4	whole block empty -- reset the high X bound to 224
09f6	store the horizontal extent {high,low} into the formation X-bounds pair
09fa	point at the per-row occupancy summaries (past the guard cells)
09fd	C = 1, the XOR mask that turns "any occupied" into a clear flag
09ff	B = 4, the top four formation rows
0a01	clear the OR accumulator
0a02	OR in this row's occupancy summary
0a03	step to the next row summary
0a04	loop over the top four rows
0a06	flip bit 0 -- now set means "top four rows are empty"
0a07	store the top-four-rows clear flag
0a0a	flip bit 0 back so the accumulator reads plain occupancy again
0a0b	OR in the fifth row summary
0a0c	step to the next row summary
0a0d	OR in the sixth row summary
0a0e	flip bit 0 -- set means "all six rows empty"
0a0f	store the all-rows clear flag
0a12	point at the eight-slot object record array (byte 0 of each)
0a15	stride is 32 bytes -- one full object record
0a18	B = 7 object-table slots
0a1a	clear the OR accumulator
0a1b	OR in this object slot's active byte
0a1c	advance one whole record forward
0a1d	loop over the seven object slots
0a1f	flip bit 0 -- set means "no active objects in those seven slots"
0a20	store the object-table clear flag
0a23	flip bit 0 back to plain occupancy
0a24	point at the eight object records' byte 1 (the dying/secondary flag)
0a27	B = 8 slots this time
0a29	OR in this slot's secondary/dying flag
0a2a	advance one whole record forward
0a2b	loop over the eight slots
0a2d	flip bit 0 -- set means "that eight-slot field is empty"
0a2e	store the eight-slot clear flag
0a31	occupancy summary done -- return
0a32	read the object-subsystem master switch
0a35	rotate its bit 0 into carry -- is play active?
0a36	subsystem off -- nothing to arm, return
0a37	read the player-shot gate
0a3a	rotate its bit 0 into carry -- is a shot already in flight?
0a3b	shot already airborne -- return, don't re-arm
0a3c	read the mode flag -- live control versus demo autopilot
0a3f	rotate its bit 0 into carry
0a40	demo mode -- take the timer-fire path
0a42	read the orientation flag
0a45	rotate its bit 0 into carry -- which control port to sample?
0a46	flipped cabinet -- read the second input port instead
0a48	read last frame's port-1 reading (the fire-edge guard)
0a4b	complement it so a fresh press shows as an edge
0a4c	hold the edge guard in B
0a4d	read this frame's port-1 input shadow
0a50	AND with the guard -- keep only newly-pressed bits
0a51	isolate bit 4, the fire button
0a53	fire not pressed this frame -- return
0a54	load 1
0a56	arm the player-shot gate -- a shot is now in flight
0a59	set the companion fire flag
0a5c	return
0a5d	read last frame's port-2 reading (the fire-edge guard)
0a60	complement it into an edge mask
0a61	hold the edge guard in B
0a62	read this frame's port-2 input shadow
0a65	rejoin the shared fire-arm test
0a68	demo path -- read the free-running frame counter
0a6b	keep the low five bits
0a6d	not on a 32-frame boundary -- return, don't fire yet
0a6e	load 1
0a70	arm the player-shot gate -- the autopilot fires
0a73	return
0a74	point IX at the enemy-projectile record table
0a78	read the free-running frame counter
0a7b	rotate bit 0 into carry -- the alternating sub-slot phase bit
0a7c	on the odd phase the first sub-slot already leads -- skip ahead
0a7e	nudge the trailing sub-slot's Y source up by one
0a81	nudge it again -- two pixels this frame
0a84	sub-slot stride is 5 bytes
0a87	advance IX so the second sub-slot becomes the leading one
0a89	point IY at the enemy-bullet sprite shadow band
0a8d	B = 7 projectile records
0a8f	is this record's leading bullet active?
0a93	inactive -- skip to the deactivate/blank branch
0a95	read the bullet's Y-source sub-position
0a98	step it down two pixels
0a9a	store the advanced sub-position
0a9d	probe four further -- did the bullet run off the bottom?
0a9f	overflowed -- deactivate this bullet
0aa1	load the 16-bit bullet position, low byte
0aa4	load the high byte
0aa7	read the bullet's signed velocity byte
0aaa	shift it left -- doubling it and exposing its sign in carry
0aac	sign-extend the velocity into A (0x00 or 0xff)
0aad	D holds the sign extension -- DE is now 2x the signed velocity
0aae	integrate: advance the position by twice the velocity
0aaf	store the new position low byte
0ab2	store the new position high byte
0ab5	take the position high byte
0ab6	bias it by 16
0ab8	compare against the vertical play window
0aba	still on screen -- go render the sprite
0abc	clear A for the deactivation writes
0abd	clear the active flag -- retire this bullet
0ac0	clear its Y sub-position
0ac3	clear its position high byte
0ac6	read the orientation flag
0ac9	rotate its bit 0 into carry -- is the screen flipped?
0aca	flipped -- take the mirrored Y formula
0acc	read the bullet's Y sub-position
0acf	complement it -- mirror to screen coordinates
0ad0	minus one
0ad1	write the bullet sprite's Y into the shadow
0ad4	read the bullet's position high byte
0ad7	complement it into a sprite code
0ad8	hold the code in C
0ad9	fetch the record index (counting down from 7)
0ada	is this record among the top three?
0adc	not the first three -- skip the code nudge
0ade	nudge the code by one so those three bullets draw a different tile
0adf	write the bullet sprite's code into the shadow
0ae2	sub-slot stride is 5 bytes
0ae5	advance IX to the other sub-slot
0ae7	nudge that sub-slot's Y source up by one
0aea	and again -- two pixels
0aed	advance IX past to the next record's leading sub-slot
0aef	E = 4, one sprite-shadow record's width
0af0	advance IY to the next bullet sprite slot
0af2	loop over the seven projectile records
0af4	all bullets integrated and drawn -- return
0af5	flipped-screen path -- read the bullet's Y sub-position
0af8	subtract 4 -- the mirrored Y offset
0afa	write the bullet sprite's Y into the shadow
0afd	read the bullet's position high byte
0b00	complement it into a sprite code
0b01	hold the code in C
0b02	fetch the record index
0b03	is this record among the top three?
0b05	not the first three -- skip the code nudge
0b07	nudge the code down by one for those three bullets
0b08	rejoin the sprite-code store
0b0b	point at the player-shot gate
0b0e	is a shot in flight?
0b10	no shot -- nothing to test against the formation, return
0b11	step to the shot's Y position counter
0b12	read the shot's Y
0b13	compare against 0x68 -- below the formation band?
0b15	shot is too low to hit the block -- return
0b16	subtract the top margin above the formation
0b18	shot is above the whole block -- return
0b19	B = 6 formation rows to walk down
0b1b	step down seven -- the first part of a row's pitch
0b1d	landed in the gutter above this row -- no hit, return
0b1e	step down five -- the rest of a row's pitch
0b20	shot's Y falls in this row -- go compute its column
0b22	try the next row down
0b24	fell past all six rows -- no hit, return
0b25	step to the shot's X-field cell
0b26	read the formation anchor's X
0b29	subtract the shot's X-field
0b2a	negate -- A is the shot's distance from the anchor
0b2c	keep the raw distance in C
0b2d	isolate the low nibble -- position within a column
0b2f	subtract the 2-pixel column hotspot offset
0b31	compare against the 11-pixel column width
0b33	shot falls between columns -- no hit, return
0b34	adjust B to the landed row index
0b35	fetch the raw distance again
0b36	take the high nibble -- the column number
0b38	fold the row index into the low bits
0b39	rotate right -- begin swapping to a (column,row) grid index
0b3a	rotate right
0b3b	rotate right
0b3c	rotate right -- nibbles now swapped
0b3d	E = the packed grid-cell index
0b3e	D = 0
0b40	point at the formation flag block base
0b43	index it by the grid cell
0b44	is there a live alien in that cell?
0b46	empty cell -- the shot passes through, return
0b47	clear the cell flag -- the alien is destroyed
0b48	D = 1, the kill command channel
0b4a	E = the grid cell index, the command parameter
0b4b	enqueue the kill command word for this cell
0b4e	A = 1
0b4f	raise the shot-retire flag
0b52	stamp the hit record's marker byte
0b55	clear A
0b56	zero the hit record's second byte
0b59	read the shot's position word
0b5c	stash it in the hit record's position slot
0b5f	D = 3, the scoring/sound command channel
0b61	fetch the grid cell index
0b62	compare against 0x50 -- upper versus lower rows
0b64	lower rows -- take the base scoring code
0b66	mask the column bits for a scoring index
0b68	rotate right
0b69	rotate right
0b6a	rotate right
0b6b	rotate right -- shift the column bits down to a small code
0b6c	subtract 4 to bias the code
0b6e	E = the column-derived scoring parameter
0b6f	enqueue the scoring/sound command word and return
0b72	E = 0, the base scoring parameter
0b74	enqueue the scoring/sound command word and return
0b77	read the object-subsystem master switch
0b7a	rotate its bit 0 into carry -- is play active?
0b7b	subsystem off -- no enemy shots can hit the player, return
0b7c	point IX at the enemy-projectile table base
0b80	stride is 5 bytes per flat projectile entry
0b83	B = 14 projectile entries to test against the player
0b85	test one enemy shot against the player ship
0b88	step the pointer to the next enemy-shot record
0b8a	loop over every enemy-shot slot
0b8c	done sweeping the enemy shots
0b8d	read the enemy shot's active flag
0b91	slot empty -- nothing can hit the player here
0b92	read the shot's first coordinate
0b95	add the collision box's half-span (31)
0b97	subtract the reference coordinate to test one edge
0b98	reference past that edge -- try the other box test
0b9a	narrow by the box span (9)
0b9c	reference outside the box -- no hit
0b9d	read the ship's X
0ba0	distance from the shot's X
0ba3	fold in the other-axis reference
0ba4	compare against the box width (11)
0ba6	outside the box -- no hit
0ba7	overlap -- go record the hit on the player
0baa	read the ship's X
0bad	distance from the shot's X
0bb0	bias by two
0bb2	compare against the reference
0bb3	outside the box -- no hit
0bb4	clear the shot's active flag -- retire it on impact
0bb8	load the hit marker
0bba	raise the player-hit event flag
0bbd	hit recorded -- return
0bbe	read the screen-orientation flag
0bc1	shift its low bit into carry
0bc2	flipped screen -- take the alternate band offsets
0bc4	point at the first object record
0bc8	point at the first sprite-shadow slot
0bcc	three sprites in the first band
0bce	first band sits at vertical offset 7 (upright)
0bd0	render this object into its sprite-shadow slot
0bd3	object records are 32 bytes apart
0bd6	advance to the next object record
0bd8	sprite-shadow slots are 4 bytes apart
0bdb	advance to the next sprite-shadow slot
0bdd	finish the first band of three
0bdf	five sprites in the second band
0be1	bump the band offset to 8 for the tail band
0be2	render this object into its sprite-shadow slot
0be5	object-record stride is 32
0be8	advance to the next object record
0bea	sprite-shadow stride is 4
0bed	advance to the next sprite-shadow slot
0bef	finish the second band of five
0bf1	all eight sprites staged -- return
0bf2	point at the first object record (flipped path)
0bf6	point at the first sprite-shadow slot
0bfa	three sprites in the first band
0bfc	first band sits at vertical offset 9 (flipped)
0bfe	render this object into its sprite-shadow slot
0c01	object-record stride is 32
0c04	advance to the next object record
0c06	sprite-shadow stride is 4
0c09	advance to the next sprite-shadow slot
0c0b	finish the first band of three
0c0d	five sprites in the second band
0c0f	drop the band offset back to 8 for the tail band
0c10	render this object into its sprite-shadow slot
0c13	object-record stride is 32
0c16	advance to the next object record
0c18	sprite-shadow stride is 4
0c1b	advance to the next sprite-shadow slot
0c1d	finish the second band of five
0c1f	all eight sprites staged -- return
0c20	is this object active?
0c24	not active -- handle the dying/parked case
0c27	read the object's sprite number
0c2a	write it into the sprite-shadow slot
0c2d	read the object's X
0c30	shift to screen X (object X minus 8)
0c32	store the sprite's screen X
0c35	read the object's Y
0c38	one's-complement it -- screen Y runs inverted
0c39	subtract this band's vertical offset
0c3a	store the sprite's screen Y
0c3d	read the object's signed heading
0c40	test the heading's sign
0c41	heading points up/right -- take the positive branch
0c44	compare against -6
0c46	steeply negative heading -- take that branch
0c49	complement the heading
0c4a	bias it by 18
0c4c	set the facing bits (0x40)
0c4e	add the object's attribute base
0c51	store the sprite's display attribute
0c54	nudge screen X a pixel on the diagonal facing
0c57	sprite built -- return
0c58	heading past the 6-count sector?
0c5a	yes -- take the next sector branch
0c5d	bias by 17
0c5f	set the facing bits (0xc0)
0c61	add the object's attribute base
0c64	store the sprite's display attribute
0c67	nudge screen X a pixel on the diagonal
0c6a	nudge screen Y a pixel on the diagonal
0c6d	sprite built -- return
0c6e	heading past the 12-count sector?
0c70	yes -- wrap it back down a whole sector
0c73	complement the heading
0c74	bias by 30
0c76	set the facing bit (0x80)
0c78	add the object's attribute base
0c7b	store the sprite's display attribute
0c7e	nudge screen Y a pixel on the diagonal
0c81	sprite built -- return
0c82	heading below -12?
0c84	yes -- wrap it up a whole sector
0c87	bias by 29
0c89	add the object's attribute base
0c8c	store the sprite's display attribute
0c8f	sprite built -- return
0c90	subtract a whole 24-count heading sector
0c92	re-fold the reduced heading into an attribute
0c94	add a whole 24-count heading sector
0c96	re-fold the heading into an attribute
0c98	object not primary -- is its dying-animation flag set?
0c9c	neither active -- park the sprite off-screen
0c9f	force sprite number 7 (the explosion frame)
0ca3	read the object's X
0ca6	shift to screen X (object X minus 8)
0ca8	store the sprite's screen X
0cab	read the object's Y
0cae	one's-complement it -- screen Y runs inverted
0caf	subtract this band's vertical offset
0cb0	store the sprite's screen Y
0cb3	read the object's alternate (death) attribute
0cb6	store it as the sprite attribute
0cb9	dying sprite built -- return
0cba	park the sprite's screen X off-screen at 248
0cbe	park the sprite's screen Y off-screen at 248
0cc2	sprite parked -- return
0cc3	point at the first object record
0cc7	object records are 32 bytes apart
0cca	eight object slots to drive
0ccc	swap to the alternate register bank
0ccd	run this object's AI for the frame
0cd0	swap the working registers back
0cd1	advance to the next object record
0cd3	loop over all eight object slots
0cd5	all slots driven -- return
0cd6	is this object in its dying animation?
0cda	yes -- hand it to the death-animation dispatcher
0cdd	is the object active?
0ce1	inactive slot -- skip it
0ce2	read the object's AI state index
0ce5	dispatch to the state handler via the table below
0ce6	state 0: freshly-launched spawn init
0ce8	state 1: walk the dive path a step
0cea	state 2: pick the next horizontal move target
0cec	state 3: fly the swoop and fire
0cee	state 4: step the dive downward
0cf0	state 5: reseed the object at the formation edge
0cf2	state 6: settle the diver back into its cell
0cf4	state 7: home the object's X onto the player
0cf6	state 8: arm a directed move inside a window
0cf8	state 9: fly the homing swoop and fire
0cfa	state 10: walk the mirrored dive path
0cfc	state 11: walk the descending dive path
0cfe	state 12: restart the move run
0d00	state 13: init the object's phase steps
0d02	state 14: emit a message column (attract/bonus)
0d04	state 15: settle the object at rest
0d06	clear the object's attack-pass counter (the byte read at homing time)
0d0a	load the spawn marker
0d0c	raise the object's spawn flag
0d0f	position the sprite from its packed grid cell
0d12	reload the packed formation grid-cell
0d15	mark it as a fresh registration
0d17	hand the cell to the spawn bookkeeping
0d1a	recover the grid-cell value
0d1b	isolate its row bits
0d1d	point at the ROM spawn-record table
0d20	shift the row bits down toward an index
0d21	shift again
0d22	shift again -- row is now the table index
0d23	hold the row index low byte
0d24	clear the index high byte
0d26	index into the spawn-record table by row
0d27	read this row's sprite number
0d28	store it as the object's sprite number
0d2b	step to the next table byte
0d2c	read the flight-curve seed
0d2d	store it in the object's curve slot
0d30	recover the row index
0d31	is this the top row (14)?
0d33	yes -- tally the top-row neighbours first
0d35	clear the object's attribute base
0d39	seed the move-throttle counter to 3
0d3d	seed the leg counter to 12
0d41	clear the path-step cursor
0d45	advance to the next AI state
0d48	check the object's dive-direction bit
0d4c	diving the other way -- use the negative heading
0d4e	set the heading to +12
0d52	spawn set up -- return
0d53	set the heading to -12
0d57	spawn set up -- return
0d58	set the top-row attribute base (0x18)
0d5c	zero the neighbour count
0d5d	is the right-hand neighbour slot active?
0d61	no -- skip it
0d63	count the neighbour
0d64	is the far neighbour slot active?
0d68	no -- skip it
0d6a	count the neighbour
0d6b	store the live-neighbour count
0d6e	join the common spawn-seeding tail
0d71	read the object's path-step cursor
0d74	point the table high byte at the dive-path table (0x1e)
0d76	read the object's X
0d79	add this step's X delta
0d7a	write the new X
0d7d	advance the cursor to the Y delta
0d7e	check the dive-direction bit
0d82	diving the other way -- subtract the Y delta
0d84	read the object's Y
0d87	add this step's Y delta
0d88	write the new Y
0d8b	bias to test the near edge
0d8d	has it crossed the near edge (14)?
0d8f	yes -- fall away off the bottom
0d91	advance the cursor past this delta pair
0d92	save the path-step cursor
0d95	count down the move throttle
0d98	not time to step yet -- wait
0d99	reload the throttle to 4
0d9d	ease the heading down one toward level
0da0	count down the leg counter
0da3	legs left -- keep walking the path
0da4	leg run done -- advance the AI state
0da7	path step done -- return
0da8	read the object's Y
0dab	subtract this step's Y delta
0dac	write the new Y
0daf	bias to test the near edge
0db1	has it crossed the near edge (14)?
0db3	yes -- fall away off the bottom
0db5	advance the cursor past this delta pair
0db6	save the path-step cursor
0db9	count down the move throttle
0dbc	not time to step yet -- wait
0dbd	reload the throttle to 4
0dc1	ease the heading up one toward level
0dc4	count down the leg counter
0dc7	legs left -- keep walking the path
0dc8	leg run done -- advance the AI state
0dcb	path step done -- return
0dcc	force this object's AI state to 5 -- the reseed-at-the-left-edge state
0dd0	done
0dd1	tick the actor's phase counter
0dd4	read the object's packed formation grid-cell / kind byte
0dd7	isolate the row/kind bits
0dd9	is it the special stored-target kind
0ddb	that kind picks its target off the object table
0ddd	read the player ship's X
0de0	hold the ship X
0de1	read this object's own X
0de4	gap from the ship
0de5	object is left of the ship -- aim at the right-side band
0de7	halve the gap (signed)
0de8	bias the target inward by 16
0dea	clamp low -- below 48?
0dec	still in range, keep it
0dee	floor the target X at 48
0df0	clamp high -- above 112?
0df2	in range, keep it
0df4	cap the target X at 112
0df6	store the chosen target X for the crossover move
0df9	target minus current X
0dfc	negate into a signed per-frame step toward the target
0dfe	store the step delta
0e01	zero
0e02	clear the move accumulator
0e05	clear the move accumulator
0e08	clear the move accumulator
0e0b	advance the object's planner sub-state
0e0e	done
0e0f	halve the (negative) gap
0e10	bias the target
0e12	clamp -- below 208?
0e14	in range, keep it
0e16	cap the target X at 208
0e18	above 144?
0e1a	in range, commit the crossover target
0e1c	floor the target X at 144
0e1e	commit the crossover target on the right-side band
0e20	read the object-table head -- its stored-target flag
0e23	shift that flag's bit0 into carry
0e24	no stored target -- pick a crossover target versus the ship
0e26	read the stored target X off the object table
0e29	commit the move toward the stored target
0e2b	bump the diving object's flight counter
0e2e	run one pass of the swoop flight-curve rotation
0e31	the object's per-frame Y increment
0e34	plus the curve heading -- the new Y delta
0e37	write the diving object's new screen Y
0e3a	probe near the top edge
0e3c	test it
0e3e	flown off the top -- end the dive
0e40	read the flight counter
0e43	has it wrapped past its span
0e45	wrapped -- end this dive leg
0e47	read the object-subsystem master switch
0e4a	its bit0 into carry
0e4b	subsystem off -- do no more
0e4c	aim the object's heading at the ship
0e4f	read the fire-inhibit flag
0e52	its bit0 into carry
0e53	inhibited -- do not fire this frame
0e54	load the firing-row slot/base pair
0e57	the counter to match against a firing row
0e5a	does the counter match this firing row
0e5b	match -- drop an aimed shot at the player
0e5e	step to the next firing-row value
0e60	one fewer row slot to test
0e61	loop over the firing rows
0e63	no row matched -- hold fire
0e64	advance the AI state -- extra step for flying off the top
0e67	advance the AI state -- end the dive
0e6a	done
0e6b	read the frame counter
0e6e	take the frame-parity bit
0e70	1 or 2 pixels
0e71	step the diving object's position down by 1 or 2
0e74	store the stepped position
0e77	window-check it against the [6,9) band
0e79	test it
0e7b	inside the window -- advance the state
0e7d	run one pass of the flight-curve rotation
0e80	the curve heading high byte
0e83	test its sign
0e84	negative heading -- take the alternate fold
0e87	fold heading plus increment into the new Y
0e8a	carried off the boundary -- advance the state
0e8c	write the object's new screen Y
0e8f	done
0e90	fold the negative heading plus increment
0e93	carry set -- store the new Y and return
0e95	advance the AI state
0e98	done
0e99	park the object's X back at the left edge (8)
0e9d	bump the object's attack-pass counter
0ea0	clear the heading
0ea4	read the packed grid cell
0ea7	isolate the row bits
0ea9	the top special-row value?
0eab	special path -- recount active neighbours
0ead	read the object-subsystem master switch
0eb0	its bit0 into carry
0eb1	subsystem off -- just advance the state
0eb3	read the near-empty activity gate
0eb6	is it open
0eb7	gate open -- reseed a fresh dive
0eb9	read the top-rows-clear gate
0ebc	is it open
0ebd	both gates closed -- just advance the state
0ebf	read the object's Y
0ec2	halve it
0ec3	hold it as the base
0ec4	draw a fresh random number
0ec7	keep the low five bits of the roll
0ec9	add to the halved base
0eca	offset into the play band
0ecc	new random Y -- send the alien around to dive again
0ecf	arm the hold timer to 40
0ed3	advance the state
0ed6	advance the state
0ed9	done
0eda	read the active-neighbour count
0edd	any neighbours left
0ede	still have neighbours -- recount them
0ee0	no neighbours -- deactivate this object
0ee4	read the difficulty/phase ramp counter
0ee7	bump it
0ee8	clamp at 2
0eea	in range, keep it
0eec	hold the ramp at 2
0eee	store the ramped phase counter
0ef1	done
0ef2	start a fresh neighbour tally at 0
0ef3	is the neighbour slot one over active
0ef7	no -- skip it
0ef9	count that live neighbour
0efa	is the neighbour slot two over active
0efe	no -- skip it
0f00	count that live neighbour
0f01	store the recounted active-neighbour count
0f04	rejoin the reseed path
0f07	take the object's return counter
0f0a	bump it one step
0f0b	reposition the object from its packed grid cell
0f0e	the just-positioned home value
0f11	store the bumped counter
0f14	gap between the home value and the counter
0f15	counter caught its home cell -- settle the alien back in
0f17	gap of 25 or more?
0f19	still too far from home -- nothing to do yet
0f1a	odd gap?
0f1c	odd -- leave it this frame
0f1d	read the object's direction bit
0f21	one direction -- nudge the phase down
0f23	nudge the phase/heading up
0f26	done
0f27	nudge the phase/heading down
0f2a	done
0f2b	deactivate the returning object
0f2f	high byte of the formation flag-block page
0f31	the packed grid cell as the low byte -- address its flag cell
0f34	clear D
0f36	mark that formation cell alive again -- the alien rejoins the block
0f38	the cell index as the command parameter
0f39	enqueue the landing command word
0f3c	tick the object's frame counter
0f3f	read the player ship's X
0f42	distance from the object to the ship
0f45	negate -- signed toward the ship
0f47	double it
0f48	low byte of the approach step
0f49	sign-extend
0f4a	high byte of the approach step
0f4b	finish scaling the signed distance up (x4)
0f4d	carry into the high byte
0f4f	object X high byte
0f52	object X sub-pixel low byte
0f55	clear carry for the subtract
0f56	steer the 16-bit X:sub-pixel pair toward the ship
0f58	store the object's new X
0f5b	store the sub-pixel remainder
0f5e	tick the homing dwell timer
0f61	still homing -- stay in this state
0f62	dwell up -- advance the AI state
0f65	done
0f66	tick the arm counter
0f69	read it
0f6c	relative to the window base 0x60
0f6e	inside the [0x60,0xA0) window?
0f70	counter outside the window -- keep cruising
0f72	read the object's X
0f75	relative to the window base
0f77	X inside the [0x60,0xA0) window?
0f79	both counter and X in the window -- commit the directed move
0f7b	pick a crossover target versus the ship
0f7e	seed the flight-curve step count to 3
0f82	arm the move throttle to 100
0f86	done
0f87	advance the AI state
0f8a	advance it again -- skip to the swoop state
0f8d	seed the first move timer
0f91	seed the second move timer (12)
0f95	clear the heading
0f99	clear the working cell
0f9d	read the ship X
0fa0	which side of the ship the object sits on
0fa3	object right of the ship -- set direction 1
0fa5	face/move one way
0fa9	done
0faa	face/move the other way
0fae	done
0faf	bump the homing object's flight counter
0fb2	run one pass of the flight-curve rotation
0fb5	read the homing mode byte
0fb8	mode 4?
0fba	mode 4 -- home only on odd frames
0fbc	mode above 4 -- home every frame
0fbe	the per-object column increment
0fc1	plus the curve heading
0fc4	write the new screen Y
0fc7	probe the top edge
0fc9	test it
0fcb	flown off the top -- end the leg
0fcd	read the flight counter
0fd0	wrapped past its span?
0fd2	wrapped -- end the leg
0fd4	tick the move throttle
0fd7	throttle expired -- change state
0fd9	read the object-subsystem master switch
0fdc	its bit0 into carry
0fdd	subsystem off -- do no more
0fde	aim the object's heading at the ship
0fe1	read the fire-inhibit flag
0fe4	its bit0 into carry
0fe5	inhibited -- do not fire
0fe6	load the firing-row slot/base pair
0fe9	the counter to match against a firing row
0fec	compare this firing-row threshold against the diving object's counter
0fed	on a match, fire an aimed shot down at the player
0ff0	step the threshold to the next firing row (0x19 apart)
0ff2	count down the rows left to scan
0ff3	keep scanning the row table for a firing row
0ff5	no row lined up this frame -- no shot
0ff6	send this object to AI state 5 (reseed and loop it around again)
0ffa	done
0ffb	hand this object to AI state 4 (the dive stepper)
0fff	done
1000	step this object's AI state back one
1003	done
1004	read the free-running frame counter
1007	test its low bit -- home the column only on odd frames
1009	even frame -- skip the home step, go compute the swoop Y
100b	read the target column (the ship's X)
100e	subtract this object's current column
1011	target is to the left -- go step the column down
1013	target is to the right -- step the column up toward it
1016	go compute the swoop Y
1019	step the column down toward the target
101c	go compute the swoop Y
101f	load the walk cursor into the path-step table pointer
1022	high byte 0x1e -- point at the path-step table (0x1e00)
1024	read the object's X coordinate
1027	subtract this step's X delta (descending walk)
1028	store the stepped X back
102b	advance the cursor to this step's Y delta
102c	test the object's direction bit
1030	direction set -- hand the Y half to the ascending walk
1032	read the object's Y coordinate
1035	subtract this step's Y delta
1036	store the stepped Y back
1039	advance the cursor past the Y delta
103a	save the advanced walk cursor
103d	tick the move throttle
1040	not due yet -- hold this frame
1041	reload the throttle to 4 frames
1045	step the heading one down
1048	tick the leg counter
104b	leg not finished -- keep walking it
104c	leg done -- advance the object's AI state
104f	reload the throttle to 3 for the next leg
1053	reload the leg counter to 12
1057	reset the heading to 12
105b	rewind the walk cursor to the start of the table
105f	done
1060	read the object's Y coordinate
1063	add this step's Y delta (ascending walk)
1064	store the stepped Y back
1067	advance the walk cursor
1068	save the walk cursor
106b	tick the move throttle
106e	not due yet -- hold this frame
106f	reload the throttle to 4 frames
1073	step the heading one up
1076	tick the leg counter
1079	leg not finished -- keep walking it
107a	leg done -- advance the object's AI state
107d	reload the throttle to 3 for the next leg
1081	reload the leg counter to 12
1085	reset the heading to 244 (-12)
1089	rewind the walk cursor to the start of the table
108d	done
108e	forward to the slot-1 path walk unchanged
1091	tick this object's move-run sub-counter
1094	force the object's AI state to 8 (re-arm the directed-move window)
1098	begin a fresh cross-player horizontal move
109b	read the object's packed grid-cell seed
109e	complement it
109f	keep the low two bits -- the phase-step count 0..3
10a1	stash the step count
10a2	add one to it
10a3	store the step count (n+1) in the record
10a6	shift left to build the code byte
10a7	shift left again
10a8	shift left again
10a9	shift left again -- (n+1) times sixteen
10aa	add 140 to form the sprite code byte
10ac	store the code byte in the record
10af	arm the phase timer to 24
10b3	advance the object's sub-state
10b6	clear the object's ready flag
10ba	recall the step count
10bb	test it
10bc	nonzero -- leave the ready flag clear
10bd	step count was zero -- re-arm the ready flag to 24
10c1	done
10c2	bump the object's message-column tick
10c5	count down its dwell timer
10c8	still counting -- hold this frame
10c9	read the object's message payload selector
10cc	add 75 to form the message-column parameter
10ce	low byte of the command word
10cf	high byte 6 -- the message-column draw channel
10d1	enqueue the deferred message-column draw command
10d4	advance the object's AI state
10d7	done
10d8	read the object's coordinate
10db	measure its distance below the rest value 200
10dd	is it within 5 of rest?
10df	yes -- hold it at rest
10e0	otherwise step it one closer to rest
10e3	done
10e4	read the deactivated object's animation sub-state
10e7	dispatch through the animation jump table by that sub-state
10e8	jump-table entry: sub-state 0 -> arm the death animation
10ea	jump-table entry: sub-state 1 -> tick the death animation
10ec	jump-table entry: sub-state 2 -> end the animation on expiry
10ee	jump-table entry: sub-state 3 -> terminal no-op
10f0	seed the fast animation timer to 4
10f4	seed the slow animation timer to 4
10f8	seed the animation companion counter to 28
10fc	advance the animation sub-state
10ff	read the object's position field
1102	is it in the upper region (>=112)?
1104	yes -- request the alternate explosion sound
1106	sound-sweep request code 7
1108	post the sound-sweep request
110b	done
110c	alternate sound-sweep request code 0x17
110e	post the alternate sound-sweep request
1111	done
1112	tick the fast animation timer
1115	not due yet -- hold this frame
1116	reload the fast timer to 4
111a	bump the animation companion counter
111d	tick the slow animation timer
1120	slow timer not expired -- hold
1121	read the object's position field
1124	is it in the upper region (>=112)?
1126	yes -- restart the animation lower down
1128	clear the object's dying flag -- retire it
112c	done
112d	reload the fast timer to 50
1131	read the global neighbour-bonus base
1134	add 32
1136	seed the companion counter from it
1139	advance the animation sub-state
113c	done
113d	tick the animation dwell timer
1140	still counting -- hold this frame
1141	clear the object's dying flag -- end the animation
1145	done
1146	terminal no-op slot of the animation table
1147	read the object's packed formation grid-cell
114a	isolate the row bits (mask 0x70)
114c	shift the row value down
114d	stash it
114e	shift once more
114f	add -- three-quarters of the row value
1150	negate it
1152	add 124 -- X = 124 minus three-quarters of the row
1154	store the object's screen X
1157	re-read the packed grid-cell
115a	isolate the column bits (mask 0x0f)
115c	shift the column value up
115d	shift again
115e	shift again
115f	shift again -- column times sixteen
1160	add the 7-pixel hotspot
1162	stash column offset
1163	read the swaying formation anchor
1166	add the column offset so Y tracks the anchor
1167	store the object's screen Y
116a	done
116b	read the flight-curve step seed
116e	keep its low two bits
1170	add one -- 1 to 4 rotation steps
1171	loop count into B
1172	load flight accumulator A high byte
1175	load flight accumulator A low byte
1178	load flight accumulator B high byte
117b	load flight accumulator B low byte
117e	take accumulator A low
117f	stash accumulator A high
1180	double it -- pull the sign into carry
1181	no carry -- skip the high-byte borrow
1183	carry -- sign-extend by borrowing the high byte down
1184	add accumulator B low (cross-couple)
1185	store it into B low
1186	clear A for the high-byte add
1188	add accumulator A high with carry
1189	did the high byte hit the 128 overflow point?
118b	no -- keep the new value
118d	overflow -- revert to the saved high byte
118e	store accumulator B's new high byte
118f	stash accumulator A low
1190	negate it -- the cross term is anti-symmetric
1192	double it -- pull the sign into carry
1193	no carry -- skip the borrow
1195	carry -- borrow the tracking low byte down
1196	add accumulator B's other low half (cross-couple back)
1197	store it
1198	clear A for the high-byte add
119a	add with carry
119b	hit the 128 overflow point?
119d	no -- keep it
119f	overflow -- revert to the saved value
11a0	store the updated tracking low byte
11a1	run the remaining rotation steps
11a3	write flight accumulator A high back
11a6	write flight accumulator A low back
11a9	write flight accumulator B high back
11ac	write flight accumulator B low back
11af	done -- the accumulator high bytes are the swoop offset
11b0	load 240, the bottom reference line
11b2	subtract the object's X (record+3) to gauge its distance from the 240 reference line
11b5	stash the drop for the slope
11b6	read the target-X anchor (the ship's X)
11b9	subtract the object's Y (record+4) to get the aim delta toward the ship
11bc	target is left of the object -- take the mirrored branch
11be	turn the slope into a direction octant
11c1	store the octant as the object's heading
11c4	done
11c5	make the leftward delta positive
11c7	compute the octant from the slope
11ca	mirror the octant back for the left side
11cc	store the mirrored heading
11cf	done
11d0	divide to get the slope quotient
11d3	take the quotient
11d4	test its top bit
11d5	top bit clear -- use it as-is
11d8	top bit set (steepest) -- clamp to 0x80
11da	rotate the quotient up
11db	rotate up again
11dc	rotate up again -- bring the top three bits down
11dd	keep the 0-7 direction octant
11df	done
11e0	de = 5, the stride of one enemy-shot record in the bullet table
11e3	point HL at the enemy-shot table base (0x4260)
11e6	B = 14, scan all fourteen shot slots
11e8	test bit 0 of this slot -- is it already carrying a live bullet?
11ea	slot is free -- go seed a new aimed shot here
11ec	step HL to the next shot record
11ed	keep scanning slots for a free one
11ef	every shot slot is busy -- give up, no new bullet this call
11f0	mark the found slot active (bit 0) -- a bullet now lives here
11f2	advance to the slot's X byte
11f3	read the firing alien's sprite X (record+3)
11f6	seat the bullet's X at the alien's column
11f7	A = 0xf0
11f9	subtract the bullet X to gauge its distance from the far edge
11fa	stash that in D
11fb	step toward the slot's Y byte
11fc	(second step to the Y byte)
11fd	read the firing alien's Y field (record+4)
1200	seat the bullet's Y at the alien
1201	advance to the slot's velocity byte
1202	read the player ship's position (0x4202)
1205	subtract the alien's field to get the aim delta toward the ship
1208	ship is on the other side -- take the negated branch
120a	turn the delta into a jittered aim velocity
120d	store the aimed velocity into the bullet
120e	bullet seeded -- done
120f	negate the delta to a positive magnitude
1211	turn that magnitude into a jittered aim velocity
1214	negate it back to aim the bullet the other way
1216	store the aimed velocity into the bullet
1217	done
1218	call the page-zero helper feeding the aim
121b	draw a fresh random number from the seed
121e	keep the low five bits -- a 0..31 jitter
1220	add the base slope in C
1221	add a floor of 6 so the shot always drifts toward the ship
1223	result stayed positive -- use it as the velocity
1224	overshoot -- clamp the velocity to 0x7f
1226	return the aim velocity
1227	read the player-shot gate (0x4208)
122a	rotate bit 0 into carry -- is a shot in flight?
122b	no shot airborne -- nothing to collide, return
122c	point IX at the object table (0x42d0), the divers
1230	DE = 32, one object record's stride
1233	B = 7, test all seven attacker records
1235	swap to the alternate register bank for the loop bookkeeping
1236	box-test this diver against the player's shot
1239	swap the register bank back
123a	step IX to the next object record
123c	keep checking every diver against the shot
123e	done sweeping the divers
123f	skip an inactive object slot
1243	return on an inactive slot
1244	load the shot's position pair (0x4209 X, high byte Y)
1247	read the object's sprite X (record+3)
124a	subtract the shot X
124b	bias by 2 to centre the hit box
124d	inside a 6-wide window on X?
124f	miss on X -- return
1250	read the object's sprite Y (record+4)
1253	subtract the shot Y
1254	bias by 5 to centre the hit box
1256	inside a 12-tall window on Y?
1258	miss on Y -- return
1259	a hit
125b	raise the shot's retire flag (0x420b) so it clears next frame
125e	deactivate the struck object (record+0 = 0)
1262	flip on its dying-animation flag (record+1 = 1)
1266	reset its AI state index (record+2 = 0)
126a	D=3 the score command channel, E=4 the starting score code
126d	B=3 score bands, C=0x50 the first band threshold
1270	read the object's position/type field (record+7)
1273	is the field below this band's threshold?
1274	yes -- hand the score word to the command queue
1277	step E to the next-higher score code
1278	drop the threshold by 0x10 for the next band
127a	test the next band down
127c	HL = 0xf001, the top-row neighbour-bonus seed
127f	stash it into 0x422b
1282	read the count of active neighbours (0x422a)
1285	exactly two neighbours left?
1287	yes -- fold in the neighbour bonus
128a	record the neighbour-bonus code at 0x422d
128d	add the bonus to the score code
128e	put the summed code back in E
128f	hand the kill's score word to the command queue
1292	is the slot one row above (record+0x20) still active?
1296	yes -- no bonus, return
1297	is the slot two rows above (record+0x40) still active?
129b	yes -- no bonus, return
129c	both neighbours gone -- bump the bonus code
129d	return the bonus
129e	read the object-active master flag (0x4200)
12a1	rotate bit 0 into carry -- is play live?
12a2	subsystem off -- no collisions, return
12a3	point IX at the object table (0x42d0), the divers
12a7	DE = 32, one object record's stride
12aa	B = 7, all seven divers
12ac	swap register bank for the loop
12ad	test this diver against the player ship
12b0	swap the register bank back
12b1	step IX to the next diver
12b3	keep checking every diver against the ship
12b5	done
12b6	skip an inactive diver
12ba	return on an inactive slot
12bb	read the diver's sprite X (record+3)
12be	add 0x21 to place it against the ship's row band
12c0	subtract 5 -- lower edge of the near band
12c2	below it -- try the far band instead
12c4	subtract 0x0c -- span of the near band
12c6	past the band -- no collision, return
12c7	read the ship's position (0x4202)
12ca	subtract the diver's Y field
12cd	bias by 0x0a to centre the box
12cf	within a 0x15-wide window of the ship?
12d1	miss -- return
12d2	a collision
12d4	raise the player-hit event flag (0x4204)
12d7	go deactivate and score the diver
12da	read the ship's position (0x4202)
12dd	subtract the diver's Y field
12e0	bias by 7 to centre the far-band box
12e2	within a 0x0f window of the ship?
12e4	miss -- return
12e5	a collision
12e7	raise the player-hit event flag (0x4204)
12ea	go deactivate and score the diver
12ed	point HL at the player-hit event flag (0x4204)
12f0	was the ship hit this frame?
12f2	no hit -- return
12f3	clear the hit flag
12f5	HL = 0x0100
12f8	clear the object-active flag and arm death mode (0x4200/0x4201)
12fb	HL = 0x040a
12fe	seed the death timer and animation counter (0x4205/0x4206)
1301	DE = the death-event command word
1304	hand the death word to the command queue
1307	read the pace/difficulty counter (0x421a)
130a	is it already zero?
130b	yes -- leave it at zero
130d	otherwise ease the difficulty down one
130e	store the pace counter back
1311	point HL at the arm gate (0x421d)
1314	count it down one
1315	read the new value
1316	has it dipped below 6?
1318	below 6 -- keep the countdown value
131a	6 or above (the count wrapped) -- reset it to 5
131c	read the mode flag (0x4006)
131f	rotate bit 0 into carry
1320	demo mode -- return without the death sound
1321	A = 1
1323	kick the death sound at sound register 3 (0x6803)
1326	return
1327	read the death-mode flag (0x4201)
132a	rotate bit 0 into carry -- is the ship dying?
132b	not dying -- return
132c	point HL at the death sub-timer (0x4205)
132f	count it down
1330	still running -- return
1331	reload the sub-timer to 10 for the next animation beat
1333	step to the animation frame counter (0x4206)
1334	D = 2, the animation command channel
1336	read the frame counter into E as the parameter
1337	hand the animation word to the command queue
133a	count down the animation frames
133b	more frames to play -- return
133c	A = 0
133d	clear the death-mode flag -- animation over
1340	silence the death sound (0x6803)
1343	return
1344	read the launch-refill trigger flag (0x4228)
1347	rotate bit 0 into carry -- did a sub-counter just refill?
1348	no trigger -- return
1349	A = 0
134a	clear the one-shot trigger flag (0x4228)
134d	read the region-clear flag (0x4220)
1350	rotate bit 0 into carry
1351	formation region empty -- nothing to launch, return
1352	load the pace counter as a word (0x421a)
1355	take its high byte
1356	add the low byte
1357	halve the sum
1358	is it under 4?
135a	yes -- keep it as the slot budget
135c	cap the slot budget at 3
135e	bump to a 1..4 slot budget
135f	B = that budget, the number of slots to try
1360	point HL at the object-slot scan base (0x4391)
1363	DE = -31, the reverse record stride
1366	read the slot's high byte
1367	step back one byte
1368	OR in the low byte -- is the slot empty?
1369	empty slot found -- go launch an attacker here
136b	step HL back to the previous record
136c	try the next slot in the budget
136e	no free slot in budget -- give up
136f	push the found slot address
1370	pop it into IX as the launch slot
1372	read the chosen launch direction (0x4215)
1375	stamp it into the slot's direction byte (record+6)
1378	test the direction
1379	nonzero direction -- take the other launch branch
137b	point HL at the column-occupancy scan tail (0x41fc)
137e	BC = 10, the scan length
1381	A = 1, look for an occupied-column marker
1383	scan down the occupancy bytes for a set column
1385	none found -- return
1386	parity guard -- return if the scan found nothing
1387	E = 0x3f, the flag-block column step base
1389	nudge L onto the found column's flag-block cursor
138a	read the sweep/config flag at 0x41ef
138d	rotate bit 0 into carry
138e	jump to the alternate column geometry when clear
1390	D = 4, the grid rows to climb per column
1392	point H at flag-block page 0x41
1394	take the column cursor low byte
1395	mask to the column nibble
1397	add 0x50 to land on the bottom cell of the column
1399	set L to that flag-block cell
139a	B = 4, reset the per-column row count
139b	test bit 0 -- is there a live alien in this cell?
139d	filled cell found -- go launch it as a diver
139f	take the cell cursor
13a0	step up one grid row (16 back)
13a2	set L to the row above
13a3	keep climbing this column
13a5	advance to the next column's base cell
13a6	set L there
13a7	one fewer column to scan
13a8	scan the next column
13aa	no filled cell found -- return
13ab	point HL into the column-occupancy strip to scan for an occupied column
13ae	set the scan count to ten columns
13b1	the value to hunt for is 1 -- a column that still holds a live alien
13b3	scan forward for the first occupied column
13b5	no occupied column found -- give up this launch
13b6	the scan ran off the end -- give up this launch
13b7	seat E as the high byte of the formation flag-block pointer
13b9	step back to the column that matched
13ba	jump back into the launcher's cell-walk
13bd	D counts five rows down this column of the formation
13bf	H is the flag-block page 0x41
13c1	take the matched column index
13c2	keep just the column nibble
13c4	form the flag-block address for the bottom row of this column
13c6	HL now points at a cell in the standing-formation flag block
13c7	take the running row pointer
13c8	step it one grid row (0x10) further
13ca	stash it back
13cb	jump back to walk this column for a filled cell
13ce	clear the formation cell -- the alien leaves the standing block
13d0	record the cell's low byte in the new attacker slot as its packed grid cell
13d3	mark the object slot active
13d7	clear its AI state index to 0 -- the spawn-init state
13db	command channel 1 -- a spawn word
13dd	the spawn parameter is the cell index
13de	enqueue the attacker's spawn command word
13e1	load the 16-bit formation anchor
13e4	load the formation's left/right X bounds
13e8	test the anchor's sign to pick which edge is close
13ea	anchor ascending -- measure against the other bound
13ec	take the anchor low byte
13ed	subtract the high bound
13ee	is the block within 28 pixels of that edge?
13f0	far enough from the edge -- pick a random direction
13f2	near the high bound -- force launch direction 0
13f3	store the chosen launch direction flag
13f6	done
13f7	take the low bound
13f8	subtract the anchor low byte
13f9	is the block within 28 pixels of that edge?
13fb	far enough -- pick a random direction
13fd	near the low bound -- force launch direction 1
13ff	store the chosen launch direction flag
1402	done
1403	draw a fresh random byte from the seed
1406	keep one bit
1408	store that as a random launch direction
140b	done
140c	read the region-clear flag
140f	shift its bit0 into carry
1410	region already clear -- nothing to spawn, bail
1411	read the object-subsystem master switch
1414	shift its bit0 into carry
1415	subsystem off -- bail
1416	read the delayed-event request flag
1419	shift its bit0 into carry
141a	no request pending -- bail
141b	clear A
141c	consume the request -- one-shot clear
141f	load the object-table head word
1422	take the head high byte
1423	fold in the low byte
1424	test the head word's low bit
1425	head word odd -- bail
1426	read the launch-direction flag
1429	stash it in C as the spawn code
142a	shift its bit0 into carry
142b	direction set -- run the full trigger-block spawn
142e	else point at the top of the primary trigger block
1431	scan four trigger flags
1433	is this primary trigger flag set?
1435	yes -- spawn a primary and its secondaries
1437	step down to the next trigger flag
1438	loop over the four primary flags
143a	no primary set -- point at the top of the secondary block
143c	scan four secondary flags
143e	is this secondary trigger flag set?
1440	yes -- seed a free descriptor slot
1442	step down to the next flag
1443	loop over the four secondary flags
1445	nothing triggered -- done
1446	point IX at the last descriptor slot
144a	DE is the -32 stride to walk slots downward
144d	four descriptor slots to check
144f	read the slot's first guard byte
1452	OR in the second guard byte
1455	both zero -- this slot is free
1457	step down to the previous descriptor slot
1459	loop over the four slots
145b	no free slot -- done
145c	consume the trigger flag that found this slot
145e	mark the slot active
1462	clear its AI state to 0 -- spawn-init
1466	store the spawn code in slot byte 6
1469	store the trigger's low byte as the slot's source index
146c	command channel 1 -- a spawn word
146e	the parameter is the source index
146f	enqueue the spawn command word
1472	point IX at the primary object table
1476	activate the primary object and enqueue its spawn
1479	take the trigger index
147a	back up fifteen to reach the secondary trigger flags
147c	stash it back
147d	point IY at the first secondary object slot
1481	up to three secondary flags to walk
1483	secondary spawn budget of two
1485	is this secondary trigger flag set?
1487	yes -- spawn a secondary into the current slot
148a	step down to the next flag
148b	loop over the flags
148d	done
148e	spawn a secondary into the current IY slot
1491	the slot stride is 32 bytes
1494	advance IY to the next object slot
1496	spend one of the secondary budget
1497	budget remains -- return
1498	budget spent -- force the outer walk to end after this pass
149a	done
149b	is this slot already carrying a live object?
149f	occupied -- skip it
14a0	is the slot mid dying-animation?
14a4	busy -- skip it
14a5	consume the trigger flag
14a7	mark the secondary slot active
14ab	clear its AI state to 0 -- spawn-init
14af	read the primary source's direction/spawn code
14b2	inherit it into the secondary slot
14b5	store the trigger index as the slot's source
14b8	command channel 1 -- a spawn word
14ba	the parameter is the source index
14bb	enqueue the spawn command word
14be	point HL at the base of the primary trigger block
14c1	scan four trigger flags
14c3	is this primary trigger flag set?
14c5	yes -- spawn a primary and its secondaries
14c7	step up to the next trigger flag
14c8	loop over the four primary flags
14ca	no primary set -- point at the base of the secondary block
14cc	scan four secondary flags
14ce	is this secondary trigger flag set?
14d0	yes -- seed a free descriptor slot
14d3	step up to the next flag
14d4	loop over the four secondary flags
14d6	nothing triggered -- done
14d7	point IX at the primary object table
14db	activate the primary object and enqueue its spawn
14de	take the trigger index
14df	back up seventeen to reach the secondary trigger flags
14e1	stash it back
14e2	point IY at the first secondary object slot
14e6	up to three secondary flags to walk
14e8	secondary spawn budget of two
14ea	is this secondary trigger flag set?
14ec	yes -- spawn a secondary into the current slot
14ef	step up to the next flag
14f0	loop over the flags
14f2	done
14f3	read the object-subsystem master switch
14f6	shift its bit0 into carry
14f7	subsystem off -- bail
14f8	read the ramp inhibit flag
14fb	shift its bit0 into carry
14fc	inhibited -- bail
14fd	point at the outer prescaler of the difficulty ramp
1500	tick the outer prescaler down
1501	not yet wrapped -- done
1502	reload the outer prescaler to 60
1504	step to the inner prescaler
1505	tick the inner prescaler down
1506	not yet wrapped -- done
1507	reload the inner prescaler to 20
1509	step to the 0..7 pace/difficulty counter
150a	read the pace counter
150b	is it already at the ceiling of 7?
150d	pinned at 7 -- done
150e	somehow above 7 -- clamp it
1510	bump the pace counter up one notch
1511	done
1512	clamp the pace counter to 7
1514	done
1515	read the object-subsystem master switch
1518	shift its bit0 into carry
1519	subsystem off -- bail
151a	read the region-clear flag
151d	shift its bit0 into carry
151e	region clear -- nothing to launch, bail
151f	read the pacing inhibit flag
1522	shift its bit0 into carry
1523	inhibited -- bail
1524	load the pace/stage word
1527	take the stage high byte
1528	is the stage at least 2?
152a	yes -- keep it as the widening term
152c	early stages -- zero the term
152d	add the pace counter low byte
152e	keep the low nibble
1530	add one
1531	B is the difficulty-scaled span of sub-counters to sweep
1532	point at the master launch-delay counter
1535	point DE at the sub-counter reload table in ROM
1538	tick the master counter down
1539	master expired -- refill the sub-counters this pass
153b	not yet
153c	clear the spawn-trigger refill flag
153f	done
1540	start the refill tally at zero
1542	read the master's reload value from the table
1543	reload the master delay counter
1544	step to the next attacker sub-counter
1545	step the reload table pointer
1546	tick this sub-counter down
1547	sub-counter expired -- reload it and bump the refill tally
154a	sweep the whole difficulty-scaled span
154c	take the refill tally
154d	did any sub-counter refill?
154e	none -- done
154f	load 1
1551	raise the spawn-trigger flag -- an attacker may launch
1554	done
1555	read the object-subsystem master switch
1558	shift its bit0 into carry
1559	subsystem off -- bail
155a	read the delayed-event enable gate
155d	shift its bit0 into carry
155e	gate clear -- bail
155f	read the inhibit flag
1562	shift its bit0 into carry
1563	inhibited -- bail
1564	read the mode flag
1567	shift its bit0 into carry
1568	mode clear -- take the fixed-arm branch
156a	point at the outer delay prescaler
156d	tick the outer prescaler down
156e	not yet wrapped -- done
156f	reload the outer prescaler to 60
1571	read the activity gate
1574	shift its bit0 into carry
1575	gate set -- take the alternate arm branch
1577	step to the inner delay counter
1578	tick the inner counter down
1579	not yet wrapped -- done
157a	counter hit zero -- restore it and recompute the delay
157b	load the word at the derived-term source cell
157e	take its high byte
157f	fold in its low byte
1580	keep the low two bits
1582	stash that term in C
1583	load the pace/stage word
1586	take its high byte
1587	fold in its low byte
1588	zero -- bail
1589	shift down one bit
158a	shift down another bit
158b	keep the low two bits
158d	invert them
158e	add ten
1590	subtract the derived term
1591	store the computed inner delay for the delayed-event timer
1594	shift the delayed-event payload in A left one -- begin scaling it into the timer values
1595	shift it left again -- A is now four times the payload
1596	seat that as the delayed-event countdown timer
1599	shift left once more -- A is now eight times the payload
159a	seat the larger value as the enemy-launch master counter
159d	load 1
159f	raise the delayed-event armed flag
15a2	done arming the delayed-event triple
15a3	load payload 2
15a5	fall into the arming fan with that payload
15a7	point at the delayed-event outer cascade counter
15aa	count the outer cascade down one this frame
15ab	still running -- leave
15ac	reload the outer counter to 60
15ae	step to the inner cascade counter
15af	count the inner counter down
15b0	still running -- leave
15b1	reload the inner counter to 5
15b3	load 90
15b5	arm the delayed-event countdown timer at 90
15b8	load 45
15ba	set the enemy-launch master counter to 45
15bd	load 1
15bf	raise the delayed-event armed flag
15c2	done -- the delayed event is armed
15c3	point at the delayed-event armed flag
15c6	test whether the delayed event is armed
15c8	not armed -- leave
15c9	step to the delayed-event countdown timer
15ca	count the timer down one frame
15cb	still counting -- leave
15cc	back to the armed flag
15cd	disarm it -- this fires only once
15cf	read the object-subsystem active flag
15d2	shift its bit 0 into carry
15d3	subsystem off -- drop the event
15d4	read the companion enable flag
15d7	shift its bit 0 into carry
15d8	companion gate closed -- drop the event
15d9	load 1
15db	raise the delayed-event request for the spawner
15de	done -- the request is posted
15df	fetch the reload value from the ROM table
15e0	stamp it into the expired sub-counter cell
15e1	bump the refill tally
15e2	return the incremented tally
15f4	point at the row-occupancy summary table
15f7	scan up to four row slots
15f9	read the stage/alternate selector
15fc	test it
15fd	nonzero -- take the alternate seed
15ff	slot index starts at 1
1601	row base starts at 132
1603	is the first byte of this row slot occupied?
1605	occupied -- take this slot
1607	step to the slot's second byte
1608	is the second byte occupied?
160a	occupied -- take this slot
160c	step to the next row slot
160d	advance the slot index
160e	loop across the remaining row slots
1610	store the found slot index and base for the flight-and-fire row scan
1614	done
1615	alternate: slot index 2
1617	alternate: row base 157
1619	run the same row scan
1621	read the all-rows-clear flag
1624	shift its bit 0 into carry
1625	block not clear -- leave
1626	read the object-field-clear flag
1629	shift its bit 0 into carry
162a	field not clear -- leave
162b	read the pending stage-advance enable
162e	shift its bit 0 into carry
162f	already armed -- leave
1630	value 1 in the low byte, zero countdown in the high byte
1633	arm the stage-advance one-shot
1636	done -- the stage advance is queued
1637	point at the stage-advance enable
163a	test whether a stage advance is armed
163c	not armed -- leave
163d	step to the stage-advance countdown
163e	count it down
163f	still counting -- leave
1640	back to the enable
1641	disarm the stage-advance one-shot
1643	point at the packed formation template in ROM
1646	unpack it into all 128 formation flags -- a fresh full block of aliens
1649	clear A to zero
164a	reset the launch-pace counter
164d	zero the free-running frame counter
1650	value 1
1653	reseed the formation sway anchor
1656	read the stage-selector word
1659	bump its high byte -- the running level count
165a	take the low byte -- the stage index
165b	is it already at 7?
165d	at 7 -- hold there
165f	past 7 -- clamp it back
1661	otherwise step the stage up one
1662	put the stage index back in the low byte
1663	store the stepped stage selector
1666	stage command word
1669	enqueue the stage-advance display command
166c	read the pending two-slot spawn request
166f	test it
1670	none pending -- leave
1671	point at the first spawn-slot flag
1674	raise it
1676	one request consumed
1677	write back the remaining request count
167a	only one requested -- leave
167b	step to the second spawn-slot flag
167c	raise it too
167e	clear A
167f	clear the request count
1682	done rebuilding the harder stage
1683	clamp the stage index at 7
1685	store the clamped stage and continue
1688	point at the activity timer's arm flag
168b	test whether the timer is armed
168d	not armed -- leave
168e	read the near-empty activity gate
1691	test it
1692	gate open -- tick the timer
1694	read the top-rows-clear gate
1697	test it
1698	gate open -- tick the timer
169a	read the object-slots-clear gate
169d	shift its bit 0 into carry
169e	all gates closed -- hold the timer where it is
169f	step to the timer counter
16a0	count it down
16a1	still running -- leave
16a2	back to the arm flag
16a3	clear the arm flag -- the active-play phase has ended
16a5	done
16a6	read the demo/attract-mode flag
16a9	shift its bit 0 into carry
16aa	in demo mode -- skip the sweep this frame
16ab	point at the sound-sweep countdown level
16ae	read it
16af	test it
16b0	nothing left to sweep -- leave
16b1	rotate the level right one
16b2	rotate it right again -- scale it down
16b3	emit the fading level to the discrete-sound register
16b6	tick the sweep down toward silence
16b7	done
16b8	read the demo/attract-mode flag
16bb	shift its bit 0 into carry
16bc	in demo mode -- skip this frame
16bd	point at the formation occupancy grid
16c0	the 6-byte skip that steps to the next grid row
16c3	count six grid rows
16c4	seed the occupancy tally at 1
16c6	ten columns in this row
16c8	add this cell's occupancy into the tally
16c9	step to the next column
16ca	loop the whole row of ten
16cc	skip forward to the start of the next row
16cd	one row counted
16ce	loop the remaining rows
16d1	point at the first formation-hum sound latch
16d4	three hum latches to drive
16d6	spend one from the tally
16d7	tally used up -- silence the rest
16d9	light this hum latch
16db	next latch
16dc	light up to three latches by how full the block still is
16de	is the tally below 2?
16e0	yes -- mark the block near-empty
16e2	clear A
16e3	clear the near-empty flag
16e6	done
16e7	load 1
16e9	raise the near-empty flag
16ec	done
16ed	silence this hum latch
16ef	next latch
16f0	zero the remaining latches
16f2	go set the near-empty flag
16f5	clear A
16f6	clear the composite sound-flag byte for this frame
16f9	A becomes 0xff
16fa	prime the sound-pitch shadow to 0xff
16fd	arm the sound sequence on any pending request
1700	update the sound-sweep voice
1703	arm a sound sequence by its selector
1706	step all three sound-sequence channels
1709	tick the pulse-tone envelope
170c	drive the rising pitch ramp
170f	advance the gated square-wave tone
1712	read back the composed sound-flag byte
1715	latch it to the sound write register
1718	rotate it right one
1719	latch the rotated copy to the next sound register
171c	read the composed pitch shadow
171f	latch the pitch to the sound hardware
1722	done -- the frame's sound is out
1723	read the square-tone gate counter
1726	step it down one
1727	not at expiry -- go toggle the tone
172a	park the gate counter at 0
172d	load 8
172f	re-arm the tone duration
1732	done
1733	read the sound effect's frame-countdown timer
1736	test whether the tone still has frames left
1737	duration spent -- jump to silence the register
173a	count the tone duration down one frame
173b	store the ticked duration back
173e	read the demo/attract-mode flag -- its inverse is written to the sound register, gating the tone by mode
1741	invert bit 0 of the mode flag before the sound write
1743	write the toggled bit to discrete-sound register 5
1746	done with the square tone this frame
1747	read the sound-sequence request gate
174a	decrement it -- test whether a request is pending
174b	no outstanding request -- nothing to arm
174c	clear the request gate
174f	form the value 1
1750	raise the sound-sequence active flag
1753	set the sequence step/duration counter to 1
1756	point at the sound-sequence data
1759	publish the sequence pointer
175c	sequence armed -- return
175d	point at sound-sequence channel descriptor one
1760	advance that channel one step
1763	point at channel descriptor two
1766	advance that channel one step
1769	point at channel descriptor three (the active flag), fall through
176c	read this channel's active flag
176d	test whether the channel is sounding
176e	channel idle -- nothing to advance
176f	keep the channel-flag pointer aside in DE
1770	load the sounding marker 2
1772	mark this voice sounding in the composite sound-flag byte
1775	read the channel's current tone value
1778	publish it as the staged sound pitch
177b	read the tone's duration counter
177e	tick the duration down one frame
177f	still sounding -- store the ticked duration and return
1782	duration spent: load the sequence pointer
1785	fetch the next sequence byte
1786	is it the 0xe0 end marker?
1788	end marker -- deactivate this channel
178a	step past the fetched byte
178b	save the advanced sequence pointer
178e	keep the raw sequence byte in B
178f	take its low 5 bits as the tone-table index
1791	point at the tone table
1794	fetch the indexed tone value
1795	store it as the channel's new tone
1798	bring the raw sequence byte back
1799	take its high 3 bits as the duration index
179b	rotate the duration bits down
179c	rotate again
179d	third rotate aligns the high nibble into the low bits
179e	point at the tone-duration table
17a1	fetch the indexed duration
17a2	store the channel's new duration counter
17a5	done advancing this channel
17a6	form zero
17a7	clear the channel's active flag via the saved pointer
17a8	channel deactivated -- return
17d0	read the sound-driver enable flag
17d3	rotate its bit 0 into carry
17d4	sound driver off -- nothing to do
17d5	point at the sweep-voice counter cell
17d8	read the sweep counter
17d9	is it about to hit its idle mark?
17da	not the idle tick -- go run the sweep
17dd	idle tick: park the counter at zero
17de	load the idle sweep template
17e1	reload the idle sweep cells so the sweep stops bumping
17e4	sweep parked -- return
17e5	read the sweep activity gate
17e8	rotate its bit 0 into carry
17e9	gate set -- hold the sweep this frame
17ea	step the sweep pointer forward one cell
17eb	read the free-running frame counter
17ee	test its low bit (frame parity)
17ef	odd frame -- skip the bump and stage the pitch
17f1	read the sound counter
17f4	compare against the 96 ceiling
17f6	at or over the ceiling -- don't bump the sweep
17f8	bump the sweep cell one step
17f9	test the sound counter value
17fa	counter spent -- straight to staging the pitch
17fd	tick the sound counter down
17fe	store the sound counter back
1801	read the sweep cell the pointer names
1802	take its low-2-bit pitch selector
1804	nonzero selector -- compute a warble pitch
1807	selector zero: fixed pitch 96
1809	go stage the fixed pitch
180c	rotate the selector's low bit into carry
180d	read the sound counter as the warble base
1810	even selector -- stage the counter as is
1812	odd selector -- bias the warble by 96
1814	halve it back down
1815	publish the staged sound pitch
1818	pitch staged -- return
1819	read the sound-driver enable flag
181c	rotate its bit 0 into carry
181d	sound driver off -- nothing to arm
181e	read the sound-request selector
1821	is the selector 6?
1823	not selector 6 -- hand off to the 0x16 arm
1826	selector 6: read the sound-sequence active flag
1829	test its bit 0
182a	a sequence already active -- don't re-arm
182b	form 1
182d	raise the sequence active flag
1830	set the step/duration counter to 1
1833	point at sequence data 0x1ebd
1836	publish the sound-sequence pointer
1839	sequence armed -- return
183a	is the selector 0x16?
183c	some other selector -- ignore it
183d	form zero
183e	clear the companion sequence flag
1841	form 1
1842	raise the sound-sequence active flag
1845	set the step/duration counter to 1
1848	point at sequence data 0x1edf
184b	publish the sound-sequence pointer
184e	sequence armed -- return
184f	load the pulse-tone envelope word
1852	test bit 0 of its low byte (the sentinel marker)
1854	not at the sentinel -- pulse the tone from the high byte
1857	form the 0x8000 sentinel
185a	re-arm the envelope word to its sentinel
185d	envelope re-armed -- return
185e	take the envelope word's high byte
185f	test it
1860	high byte spent -- silent, return
1861	tick the countdown high byte down
1862	store it back
1865	test its bit 2 (the pulse phase)
1867	phase bit clear -- take the low pulse level
186a	phase bit set -- take the high pulse level 129
186c	form the two-level pulse value
186d	stage it as the sound pitch
1870	form 1
1872	raise the composite sound-flag byte
1875	pulse staged -- return
1876	point at the pitch-ramp arm counter
1879	read the arm counter
187a	is the arm about to reach its reset point?
187b	arm still running -- advance the ramp
187e	clear the arm counter
187f	form 32 (countdown 32, pitch 0)
1882	reload the ramp's countdown/pitch pair
1885	ramp re-armed -- return
1886	step to the ramp's countdown byte
1887	read the ramp countdown
1888	test it
1889	ramp drained -- idle, return
188a	tick the ramp countdown down
188b	step to the ramp's pitch byte
188c	read the current ramp pitch
188d	step the pitch up by 4 -- the rising ramp
188f	store the raised pitch back
1890	publish it as the staged sound pitch
1893	form zero
1894	clear the composite sound-flag byte
1897	pitch ramped -- return
1898	read the LFO reset-request flag
189b	test it
189c	no reset request -- run the normal LFO decay
189e	form zero
189f	consume the reset request
18a2	form the full LFO level 15
18a4	go slam that level across the LFO latches
18a6	read the frame counter
18a9	add one to it
18ab	only act on the 0xff tick -- otherwise return
18ac	read the current LFO level
18af	test it
18b0	level already at zero -- nothing to decay
18b1	decay the LFO level one step
18b2	store the LFO level shadow
18b5	four LFO frequency latches to write
18b7	point at the LFO frequency latch base
18ba	write the level to this LFO frequency latch
18bb	step to the next latch
18bc	rotate the level right one bit for the next latch
18bd	loop over all four latches
18bf	LFO level fanned out -- return
18c0	read the message-scroller enable/countdown flag
18c3	test its bit 0 (scroller running?)
18c4	scroller off -- nothing to advance
18c5	load the message cursor pointer
18c8	read the cursor's step byte
18c9	take its low 3 bits (the per-glyph sub-step)
18cb	mid-glyph -- just tick the delay counter
18cd	keep the cursor pointer aside in DE
18ce	load the message text pointer
18d1	read the next glyph byte from the text
18d2	is it the 0x3f end-of-message marker?
18d4	end of text -- go to the delay/end path
18d6	step the text pointer forward
18d7	save the advanced text pointer
18da	bias the glyph code to its tile value
18dc	load the message destination pointer
18df	write the glyph tile into VRAM
18e0	form -32 (one tilemap row up)
18e3	move the destination up one row
18e4	save the advanced destination pointer
18e7	restore the countdown pointer from DE
18e8	tick the scroller's delay countdown
18e9	still running -- return
18ea	form zero
18eb	clear the scroll-enable flag to stop the scroller
18ee	scroller done -- return
18ef	read the coinage/config mode
18f2	is it config mode 3 (the preset mode)?
18f4	mode 3 -- hand off to preset the credit count
18f6	point at the IN0 input shadow
18f9	read this frame's IN0 shadow
18fa	step toward the prior-frame history cell
18fb	keep stepping
18fc	now at last frame's IN0 history
18fd	combine this frame's coin bits with last frame's
18fe	step toward the first coin guard cell
18ff	now at the first coin guard cell
1900	complement the coin bits (active-low to active-high)
1901	mask by the first coin guard cell
1902	step to the second coin guard cell
1903	mask by the second coin guard cell
1904	test the direct-credit coin bit (bit 7)
1906	coin present -- add a credit
1908	otherwise take the low two coin-pulse bits
190a	no coin pulse -- nothing to count
190b	point at the coarse coin-pulse counter
190e	count one coin pulse
190f	was the first pulse bit set?
1911	no -- done after one bump
1912	test the second pulse bit
1914	not set -- done
1915	count a second coin pulse
1916	coin service done -- return
1917	build the word: low byte 0 for the coin-phase flag, high byte 9 for the credit count
191a	stamp the mode-3 preset -- coin-phase flag 0 and nine credits in one store
191d	done presetting credits
191e	point at the credit count
1921	read the current credit count
1922	compare it against the 99-credit ceiling
1924	already at 99 -- drop this coin
1925	bank one more credit
1926	load 1
1928	raise the credit-event flag that arms the credit chime
192b	command word: channel 7, parameter 1 -- redraw the credit-count display
192e	enqueue the credit-count HUD redraw and return
1931	point at the coin-meter pulse-width timer
1934	read it
1935	test whether a coin-meter pulse is already in progress
1936	mid-pulse -- go drive the coin-counter output
1938	step to the coarse queued-coin counter
1939	is there a coin pulse waiting to be serviced?
193a	nothing queued -- leave the meter alone
193b	consume one queued coin
193c	back to the pulse-width timer cell
193d	reload the coin-meter pulse timer to 15
193f	read the coinage mode setting
1942	free-play mode 3?
1944	free play -- award no credit
1945	step the mode value toward the two-coins path test
1946	mode 1 -- take the two-coins-per-credit path
1948	point at the credit count
194b	step toward the one-coin-per-credit test
194c	mode 2 -- award one credit (also falls straight through)
194f	read the credit count
1950	at the 99 ceiling?
1952	yes -- leave it untouched
1953	over the ceiling -- go clamp it
1955	award one credit
1956	load 1
1958	raise the credit-event flag that arms the chime
195b	command word: channel 7, parameter 1 -- redraw the credit count
195e	enqueue the credit-count HUD redraw and return
1961	pin the credit count back to its 99 ceiling
1963	done clamping
1964	point at the coin-phase flag
1967	first or second coin of the pair?
1969	first coin -- just raise the phase flag
196b	second coin -- clear the phase flag
196d	step to the credit count
196e	award the credit for the completed coin pair
1971	mark the first coin of a pair received
1973	done arming the phase
1974	rotate the pulse timer toward the coin-counter output bit
1975	rotate again
1976	rotate again -- into the output bit position
1977	drive the coin-counter hardware output pulse
197a	tick the pulse-width timer down
197b	done pulsing the counter
197c	read the credit count
197f	nine or more credits banked?
1981	yes -- release the coin mechanism
1983	load 1
1985	engage the coin lockout below nine credits
1988	done
1989	clear A
198a	release the coin-lockout latch
198d	done
198e	read the free-running frame counter
1991	offset it by nine
1993	is this the one-in-32 autopilot frame?
1995	not this frame -- skip the demo autopilot
1996	read the demo-enable flag
1999	shift its low bit into carry
199a	demo not enabled -- skip
199b	read the object-active master switch
199e	shift its low bit into carry
199f	objects inactive -- skip
19a0	point IX at the attacker object table
19a4	clear the threat-weight accumulator
19a6	swap to the alternate register set to hold the accumulator
19a7	stride is 32 bytes per attacker record
19aa	seven attacker records to fold in
19ac	bring the accumulator back
19ad	read the object's X
19b0	read the object's Y
19b3	read the object's flight-curve field byte
19b6	fold this attacker's threat weight into the accumulator
19b9	stash the accumulator again
19ba	advance to the next attacker record
19bc	loop over all seven attackers
19be	point IX at the moving-shot table
19c2	stride is 5 bytes per shot record
19c5	seven shot records to fold in
19c7	bring the accumulator back
19c8	read the shot's X
19cb	read the shot's Y
19ce	read the shot's field byte
19d1	fold this shot's threat weight into the accumulator
19d4	stash the accumulator
19d5	advance to the next shot record
19d7	loop over all seven shots
19d9	bring the finished accumulator into the main register set
19da	read the ship's X, the target reference
19dd	hold it
19de	read the formation anchor low byte
19e1	bias it by 128
19e3	form the offset between the formation and the ship
19e4	scale the offset down, sign-preserving
19e6	scale down again
19e8	scale down again
19ea	scale down again
19ec	scale down again
19ee	add in the accumulated object threat weight
19ef	halve the combined steer bias
19f1	hold the biased steer value
19f2	draw a random number
19f5	restore the biased steer value into B
19f6	shift the draw's top bit into carry
19f7	turn that bit into all-zeros or all-ones
19f8	top bit set (a=0xff) -- apply the -1 jitter
19fa	otherwise make the jitter +1
19fb	apply the plus-or-minus-one jitter to the steer bias
19fc	nudge up by one
19fe	negative bias -- command a move one way
1a01	is the value two or more?
1a03	two or more -- command a move the other way
1a05	otherwise hold -- command zero
1a06	write the demo move command
1a09	done
1a0a	move command 4
1a0c	go store it
1a0e	move command 8
1a10	go store it
1a12	is this object active?
1a16	inactive -- contribute nothing to the weight
1a17	take the object's vertical position
1a18	measure it down from row 128
1a1a	above that line -- too high to count, skip
1a1b	band index starts at 0
1a1d	into the first 52-row band?
1a1f	yes -- keep band 0
1a21	second band
1a22	into the second 52-row band?
1a24	below both bands -- too low, skip
1a25	read the ship's X reference
1a28	horizontal distance from the ship
1a29	center the delta
1a2b	compare against the sideways window
1a2d	too far to the side -- skip this object
1a2e	keep the two coarse delta bits
1a30	hold them
1a31	take the object's field byte
1a32	keep its flag bit 7
1a34	combine it with the delta bits
1a35	rotate toward the low nibble
1a36	rotate again
1a37	rotate again
1a38	rotate again -- flag and delta packed low
1a39	fold in the row band
1a3a	that is the 0-15 table index
1a3b	clear the index high byte
1a3d	point at the object-step weight table
1a40	index into it
1a41	read the signed step weight
1a42	add it to the running threat accumulator
1a43	keep the updated accumulator
1a44	done scoring this object
1a55	point at tile VRAM base for the cold-boot wipe
1a58	four 256-byte pages of tile VRAM to blank
1a5a	the blank tile value, 16
1a5c	write the blank tile into this cell
1a5d	step to the next cell in the page
1a5e	fill the whole 256-byte page
1a61	advance to the next VRAM page
1a62	pet the watchdog mid-wipe
1a65	blank all four VRAM pages
1a67	point at OBJRAM, the sprite/scroll/bullet hardware
1a6a	fill value zero
1a6b	zero this OBJRAM byte
1a6c	next byte
1a6d	zero the whole 256-byte OBJRAM page
1a70	value zero
1a71	point at the 0x6000 output latches -- start lamps, lockout, coin counter
1a74	four latches to clear
1a76	clear this output latch
1a77	next latch
1a78	clear all four 0x6000 latches
1a7a	value 1
1a7b	four sound-LFO frequency latches to set
1a7d	write 1 to this LFO frequency latch
1a7e	next latch
1a7f	set all four
1a81	value zero
1a82	eight sound registers
1a84	point at the eight sound write registers
1a87	silence this sound register
1a88	next register
1a89	silence all eight sound registers
1a8b	eight control latches
1a8d	point at the 0x7000 control latches -- irq enable, starfield, screen flips
1a90	clear this control latch
1a91	next latch
1a92	clear the eight 0x7000 control latches
1a94	value 0xff
1a95	prime the pitch-write / watchdog port
1a98	thirty-two walking-pattern RAM-test passes
1a9a	point at work-RAM base
1a9d	four pages of work RAM
1a9f	seed the pattern from this pass number
1aa0	advance the walking test pattern by 0x2f
1aa2	write the pattern byte to work RAM
1aa3	next cell
1aa4	fill this 256-byte page with the pattern
1aa7	bump the pattern for the next page
1aa8	advance to the next work-RAM page
1aa9	write all four work-RAM pages
1aab	back to work-RAM base to verify
1aae	four pages to check
1ab0	same pass seed
1ab1	regenerate the expected pattern byte
1ab3	compare it against what work RAM holds
1ab4	mismatch -- RAM fault, bail to the error path
1ab6	next cell
1ab7	verify the whole page
1aba	bump the expected pattern for the next page
1abb	next page
1abc	verify all four pages
1abe	pet the watchdog between passes
1ac1	one fewer walking-pattern pass
1ac2	run all thirty-two passes
1ac5	seat the Z80 stack pointer at the top of work RAM
1ac8	begin the next init pass, count 32
1aca	point HL at the tile VRAM base 0x5000 -- the region the walking-pattern RAM test writes and reads back
1acd	B counts the four 256-byte pages to sweep
1acf	seed the pattern value A from the round counter C
1ad0	step the pattern by 0x2f to make the next cell's test byte
1ad2	write the pattern byte into the cell
1ad3	advance to the next cell in the page
1ad4	loop until the low byte wraps -- the whole 256-byte page filled
1ad7	bump the pattern once per page so each page differs
1ad8	step HL to the next 256-byte page
1ad9	repeat the fill for all four pages
1adb	read the watchdog port to pet it so the board won't reset mid-test
1ade	re-point HL at the base for the read-back verify pass
1ae1	B counts the four pages again
1ae3	re-seed the expected pattern from the round counter C
1ae4	regenerate the expected byte, stepping by 0x2f
1ae6	compare the expected byte against what was stored
1ae7	on a mismatch bail to the RAM-fail display path
1ae9	advance to the next cell
1aea	loop until the page wraps
1aed	bump the expected pattern once per page
1aee	step to the next page
1aef	repeat the verify for all four pages
1af1	pet the watchdog after the verify sweep
1af4	count down the test-round counter C
1af5	more rounds left -- restart the fill-and-verify sweep
1af8	every round passed -- jump on to the ROM checksum test
1afb	load result code 1 (RAM test passed)
1afd	jump to store the result code
1aff	blank the VRAM test region before drawing the failure message
1b02	load error code 2 (RAM test failed)
1b04	store the result/error code into status VRAM cell 0x51f3
1b07	point DE at the message glyph template at 0x1b2d
1b0a	point HL at the destination VRAM cell 0x5233 for the message
1b0d	BC = 0x20, one 32-cell tile row per glyph step
1b10	swap in the alternate register set to hold the glyph counter
1b11	seven glyphs to place down the column
1b13	swap back to the main registers to place a glyph
1b14	read one glyph byte from the message template
1b15	write it into the VRAM cell
1b16	step down 32 cells -- one tile row -- to the next glyph slot
1b17	advance the template pointer
1b18	swap in the alternate set to reach the counter
1b19	loop for all seven glyphs of the message
1b1b	clear A to zero for the interrupt-off write
1b1c	clear the interrupt-enable latch 0x7001 so no vblank fires
1b1f	pet the watchdog while holding the error display
1b22	read IN0 at 0x6000
1b25	mask bit 6, the service/test switch
1b27	still held -- loop, holding the failure screen up
1b2a	switch released -- jump to the cold-reset vector
1b34	save the accumulated checksum into C
1b35	read IN0 at 0x6000
1b38	B = IN0
1b39	read IN1 at 0x6800
1b3c	AND IN1 with IN0
1b3d	mask bit 2 of the combined inputs
1b3f	bit clear -- skip showing the checksum digits
1b41	A = saved checksum C
1b42	take the low nibble of the checksum
1b44	write it as a digit into status VRAM cell 0x51d3
1b47	A = saved checksum C again
1b48	rotate right to bring the high nibble down
1b49	rotate right
1b4a	rotate right
1b4b	rotate right -- high nibble now in the low bits
1b4c	mask the low nibble
1b4e	write the high checksum digit into status VRAM cell 0x51f3
1b51	point DE at the checksum-fail message template at 0x1b56
1b54	jump to the glyph-placing loop to draw the message
1b5d	point HL at the tile VRAM base 0x5000 to blank it
1b60	B counts the four pages to blank
1b62	load the blank tile value 0x10
1b64	write the blank tile into the cell
1b65	advance to the next cell
1b66	loop until the page wraps
1b69	step to the next page
1b6a	pet the watchdog between pages
1b6d	blank all four VRAM pages
1b6f	return
1b70	blank the VRAM before running the ROM checksum
1b73	point HL at ROM start 0x0000
1b76	B = 0x28, the number of ROM pages to sum
1b78	clear the checksum accumulator A
1b79	add the ROM byte to the running checksum
1b7a	advance to the next byte
1b7b	loop until the page wraps
1b7e	step to the next ROM page
1b7f	stash the running sum in C across the watchdog read
1b80	pet the watchdog between pages
1b83	restore the running sum into A
1b84	sum all 0x28 ROM pages
1b86	test the final checksum
1b87	nonzero -- ROM checksum bad, branch to the fail-display decode
1b8a	point HL at work-RAM base 0x4000
1b8d	B = 0xc0 bytes to clear
1b8f	fill 0xc0 bytes of zero from 0x4000, clearing the low work RAM
1b90	A = 0xff for the next fill
1b91	B = 0x40 bytes
1b93	fill 0x40 bytes of 0xff over the command-queue region
1b94	A = 0 again
1b95	fill a full 256-byte page of zero (count 0 wraps to 256)
1b96	fill another 256-byte page of zero
1b97	B = 0xa0 bytes
1b99	fill 0xa0 more bytes of zero, finishing the work-RAM clear
1b9a	clear the interrupt-enable latch 0x7001
1b9d	clear the 0x7005 control latch
1ba0	clear the screen-flip X latch 0x7006
1ba3	clear the screen-flip Y latch 0x7007
1ba6	clear the orientation flag 0x4018
1ba9	pet the watchdog
1bac	A = 0x20
1bae	seat the boot per-state timer 0x4008 at 0x20
1bb1	A = 3
1bb3	set the self-test mode flag 0x401a to 3, routing the vblank to the object-color-ramp pass
1bb6	HL = 0xc0c0
1bb9	seat the command-queue write head 0x40a0 at 0xc0c0
1bbc	A = 1
1bbe	turn the starfield on via 0x7004
1bc1	set the 0x7002 control latch to 1
1bc4	set the 0x7003 control latch to 1
1bc7	re-arm the interrupt-enable latch 0x7001 so the vblank heartbeat starts
1bca	jump to the main program loop at 0x2000
1bcd	HL = 0x00d8, the return address to leave under the selected sub-handler
1bd0	push that return address so the chosen self-test handler returns through it
1bd1	decrement the self-test mode value to test for 1
1bd2	mode 1 -- run the sound-and-input self-test scan
1bd5	decrement again to test for 2
1bd6	mode 2 -- run the per-frame screen-fill strip painter
1bd9	decrement again to test for 3
1bda	any value past 3 is invalid -- drop to the cold-reset vector
1bdd	mode 3 falls through here: point HL at the OBJRAM hardware base 0x5800
1be0	seed the color ramp from the current random seed 0x401e
1be3	write the color byte into the OBJRAM cell
1be4	step the color ramp by 0x2f for the next cell
1be6	advance to the next OBJRAM cell
1be7	loop across the whole 256-byte OBJRAM page
1bea	re-seed the expected color from 0x401e for the verify pass
1bed	compare the expected color against what was stored
1bee	on a mismatch bail to the OBJRAM-fail path
1bf0	step the expected color by 0x2f
1bf2	advance to the next cell
1bf3	loop across the page verifying
1bf6	pet the watchdog after the verify sweep
1bf9	draw a fresh random number, advancing the seed so next frame's ramp differs
1bfc	point HL at the boot per-state timer 0x4008
1bff	count the timer down one frame
1c00	timer still running -- return and keep filling the ramp next frame
1c01	timer expired -- A = 0 for the one-time setup that follows
1c02	point HL at the OBJRAM base 0x5800
1c05	B = 0 so the fill covers a full 256-byte page
1c06	clear the whole OBJRAM page to zero
1c07	A = 1
1c09	set the mode flag 0x4006 to 1
1c0c	set the self-test mode 0x401a to 1, routing to the sound-and-input scan next
1c0f	light the 1-player start lamp latch at 0x6000
1c12	light the 2-player start lamp latch at 0x6001
1c15	engage the coin-lockout latch at 0x6002
1c18	set 0x4226 to 1
1c1b	set the frame counter 0x425f to 1
1c1e	set the object-draw-suppress flag 0x4238 so the figure grid stays blank
1c21	A = 0x1f
1c23	write 0x1f into status VRAM cell 0x5213
1c26	A = 0x1b
1c28	write 0x1b into status VRAM cell 0x51f3
1c2b	return
1c2c	OBJRAM verify failed: point HL at the OBJRAM base 0x5800
1c2f	A = 0
1c30	write zero into the OBJRAM cell
1c31	advance to the next cell
1c32	loop, clearing the whole page
1c35	load error code 3 (OBJRAM test failed)
1c37	jump to the error-display path to show code 3
1c3a	run the sound driver's per-frame tick
1c3d	run the sound sweep driver
1c40	pet the watchdog
1c43	read IN0 at 0x6000
1c46	B = IN0
1c47	mask bits 7,1,0 of IN0
1c49	none of those set -- skip
1c4b	A = 1
1c4d	set 0x41c9 to 1 on that input
1c50	read IN1 at 0x6800
1c53	C = IN1
1c54	mask bits 1,0 of IN1
1c56	none set -- skip
1c58	A = 0x16
1c5a	stage sound-sweep request 0x16 into 0x41df
1c5d	A = IN0
1c5e	OR in IN1
1c5f	mask bits 3,2 of the combined inputs
1c61	none set -- skip
1c63	A = 6
1c65	stage sound-sweep request 6 into 0x41df
1c68	A = IN0
1c69	OR in IN1
1c6a	mask bit 4 of the combined inputs
1c6c	clear -- skip
1c6e	A = 1
1c70	set 0x41cc to 1 on that input
1c73	read IN1 at 0x6800
1c76	rotate left to bring the high bits down
1c77	rotate left again
1c78	keep the two extracted bits
1c7a	run the input-test feedback handler for this input group
1c7d	read IN2 at 0x7000
1c80	keep its low two bits
1c82	offset the group index by 4
1c84	run the input-test feedback handler for the next input group
1c87	read IN2 at 0x7000
1c8a	rotate right to reach the wanted bit
1c8b	rotate right again
1c8c	keep the single extracted bit
1c8e	offset the group index by 8
1c90	run the input-test feedback handler for the last input group
1c93	read IN0 at 0x6000
1c96	mask bit 6, the service/test switch
1c98	still held -- stay in the sound/input test, return
1c99	switch released -- A = 0 to leave this test
1c9a	clear the mode flag 0x4006
1c9d	A = 2
1c9f	set the self-test mode 0x401a to 2, routing to the screen-fill strip painter next
1ca2	HL = 0x3010
1ca5	seat the timer pair at 0x4008/0x4009 for the fill phase
1ca8	HL = tile VRAM base 0x5000
1cab	seat the VRAM fill write cursor 0x400b at 0x5000
1cae	A = 0
1caf	point HL at the 0x6000 output-latch base
1cb2	B = 4 latches to clear
1cb4	clear the four 0x6000 latches -- start lamps, coin lockout, coin counter
1cb5	load $01, the value the sound LFO latches take
1cb7	point at the discrete-sound LFO frequency latch base
1cba	four LFO latches to set
1cbc	block-fill the four LFO frequency latches with $01
1cbd	clear A to $00, the silence value
1cbe	eight sound registers to clear
1cc0	point at the eight discrete-sound write registers
1cc3	block-fill all eight sound registers with 0 -- kill the voices
1cc4	five control latches to clear
1cc6	point at the interrupt-enable / starfield control-latch bank at 0x7001
1cc9	block-fill five control latches with 0 -- halt the vblank interrupt and starfield
1cca	step A down to $ff
1ccb	drive the sound pitch latch to $ff
1cce	done quiescing the sound and video hardware
1ccf	save the text-descriptor index in B
1cd0	double it
1cd1	double again -- index times four
1cd2	add the original back -- index times five, the 5-byte descriptor stride
1cd3	low byte of the table offset
1cd4	high byte zero
1cd6	point at the text-descriptor table base
1cd9	step to this descriptor's entry
1cda	two 16-bit words to pull off the descriptor
1cdc	read the low byte of a descriptor word
1cdd	advance
1cde	read the high byte of the word
1cdf	advance
1ce0	stash the word -- first the source pointer, then the VRAM destination
1ce1	loop for the second descriptor word
1ce3	fifth descriptor byte is the glyph count
1ce4	swap to the alternate register bank
1ce5	recover the VRAM destination cell
1ce6	recover the source text pointer
1ce7	set the step to -32, one tilemap row up per glyph
1cea	back to the main bank
1ceb	into the drawing bank
1cec	read one source character byte
1ced	convert the ASCII code to its tile number
1cef	poke the glyph into the VRAM cell
1cf0	step to the next source character
1cf1	move the VRAM cursor one row up the column
1cf2	back out of the drawing bank
1cf3	loop for the whole glyph count
1cf5	text column drawn
1d28	point at the strip-fill sub-timer
1d2b	read the watchdog port to pet it
1d2e	read the strip-fill timer
1d2f	test it
1d30	timer spent -> handle the dwell/exit path
1d33	swap to the fill bank
1d34	load the VRAM fill write cursor
1d37	sixteen tile pairs for the first half-strip
1d39	lay a fill tile
1d3b	next cell
1d3c	lay the paired fill tile
1d3e	next cell
1d3f	fill the whole first half-strip
1d41	sixteen more pairs for the second half
1d43	lay a fill tile
1d45	next cell
1d46	lay the paired fill tile
1d48	next cell
1d49	fill the second half-strip
1d4b	save the advanced fill cursor
1d4e	back to the main bank
1d4f	count the strip-fill timer down one
1d50	more strips left to paint -> return
1d51	point at the dwell tier just above the timer
1d52	read the dwell counter
1d53	test it
1d54	dwell spent -> finish the fill phase
1d56	count the dwell down
1d57	still dwelling -> return
1d58	read the IN0 input port
1d5b	isolate the service/test switch bit
1d5d	test switch held -> leave without resetting
1d5e	point at the tilemap VRAM base
1d61	rewind the fill cursor to the top of VRAM
1d64	reload value for the strip timer
1d66	arm the strip-fill timer again
1d69	clear A
1d6a	clear the self-test mode flag -> back to the normal frame path
1d6d	set the game state to 0, the boot handler
1d70	screen-fill phase complete
2000	point at the score/HUD scratch block
2003	thirty bytes to clear
2005	zero one scratch byte
2007	next byte
2008	clear the whole score/HUD scratch block
200a	high byte of the display-list page
200c	read the display-list read cursor
200f	form the pointer to the current slot
2010	read the slot's control byte
2011	shift bit 7, the free/ready marker, into carry
2012	slot holds work -> decode it
2014	slot free -> run the object-figure grid draw as idle work
2017	loop back to drain the display list
2019	keep the channel's low nibble
201b	the draw-handler index
201c	high byte of the index zero
201e	retire this slot's control byte
2020	next byte of the slot
2021	read the slot's parameter byte
2022	retire the parameter byte too
2024	advance the read cursor
2025	cursor low byte
2026	past the queue body floor at $c0?
2028	still in range -> keep it
202a	wrap the read cursor back to the queue body floor
202c	store the advanced read cursor
202f	the parameter byte into A for the handler
2030	point at the draw-handler jump table
2033	index it by the channel
2034	low byte of the handler address
2035	next
2036	high byte of the handler address
2037	load the drain loop as the return address
203a	push it so the handler returns into the drain
203b	handler address into HL
203c	jump to the selected draw handler
2055	map the packed coordinate to its VRAM cell
2058	fold the coordinate into a frame-animated tile variant
205b	draw the glyph or 2x2 block and return
205e	map the packed coordinate to its VRAM cell
2061	coordinate bit 4 set -> stamp the 2x2 tile block
2064	else stamp the vertical tile pair
2067	read the free-running frame counter
206a	keep the raw counter in B
206b	its low nibble is the object-grid draw phase
206d	phase 0 -> repaint the player-status column instead
206f	point at the object grid base
2072	offset to this phase's column
2073	form the column pointer
2074	read the object-draw suppress flag
2077	shift its bit 0 into carry
2078	draw suppressed -> skip this grid column
2079	row stride of 16 through the grid
207b	six rows in the column
207d	save the row count and stride
207e	save the grid cell pointer
207f	the cell's low byte is its packed draw coordinate
2080	is this grid cell occupied by a live figure?
2082	occupied -> draw the animated figure
2084	empty -> stamp the fixed tile figure
2089	map the cell's packed coordinate to its VRAM cell
208c	variant bias zero
208e	fold the frame counter into a tile variant
2091	draw the glyph or 2x2 block
2094	recover the grid cell pointer
2095	recover the row count and stride
2096	cell low byte
2097	step down by the row stride
2098	advance to the next row's cell
2099	walk all six rows of the column
209b	column drawn
209c	read the mode gate byte
209f	test it
20a0	mode clear -> only repaint if already latched
20a2	latch the mode into the repaint-gate byte
20a5	go repaint the status column
20a7	read the repaint-gate byte
20aa	test it
20ab	not armed -> nothing to repaint
20ac	read the active player index
20af	select that player's status-column VRAM base
20b2	set the step to -32, one row up per status cell
20b5	check the blank-vs-paint flag
20b7	clear -> paint the column
20b9	the blank tile $10
20bb	blank the top status cell
20bc	step up a row
20bd	blank the middle status cell
20be	step up a row
20bf	blank the bottom status cell
20c0	read the paired-player flag
20c3	test it
20c4	single player -> done
20c5	read the active player index again
20c8	flip to the other player
20ca	select the other player's status-column base
20cd	top cell tile is code+1
20ce	paint the top status cell
20cf	step up a row
20d0	paint the middle status tile $25
20d2	step up a row
20d3	paint the bottom status tile $20
20d5	check the blank-vs-paint flag
20d7	blank branch -> done
20d8	read the mode gate byte
20db	test it
20dc	mode set -> leave the gate latched
20dd	clear the repaint-gate byte
20e0	status column painted
20e1	keep the packed coordinate in B
20e2	take the low nibble of the coordinate
20e4	rotate it toward its field position
20e5	rotate again
20e6	stash the partial
20e7	top two bits give the VRAM page high byte
20e9	high byte of the cell address
20ea	recover the partial
20eb	mask the low bits for the cell within the page
20ed	seed the low byte
20ee	back to the full coordinate
20ef	shift the high nibble down
20f0	shift
20f1	shift
20f2	high nibble now sits in the low bits
20f3	keep three bits of it -- the column
20f5	the column count
20f6	shift, staging a carry
20f7	save that carry for the caller to branch on
20f8	fold the carry back in
20f9	complement to flip the column into place
20fa	keep the low nibble
20fc	merge into the cell low byte
20fd	finished low byte
20fe	the tilemap VRAM base
2101	offset the cell into VRAM
2102	restore the coordinate-bit carry for the caller
2103	HL now names the VRAM cell
2104	save flags across the compute
2105	the value to bias
2106	is it at or above 112, out of range?
2108	in range -> fold it with the timer
210a	force the out-of-range tile sentinel $80
210c	restore flags
210d	done
210e	keep the value's low nibble
2110	stash it
2111	read the frame counter
2114	take its low nibble
2116	carry-in zero
2118	compare the timer nibble against the value
2119	timer nibble is not smaller -> no borrow
211b	timer nibble smaller -> set the carry-in to -1
211c	drop the extra word off the stack, then fall into the tile-variant fold
211d	save the caller's accumulator while B is folded into an animated tile-variant index
211e	copy the candidate index B into A to range-check it
211f	compare it against 112, the out-of-range cutoff
2121	B at or above 112 is out of range -- jump off to pin the index to the $80 marker
2123	read the free-running per-frame counter
2126	rotate the frame counter right one bit
2127	rotate again
2128	rotate again
2129	four rotates swap the frame counter's nibbles
212a	add the candidate index B into the animated base
212b	add C on top
212c	keep the low two bits -- the 0..3 tile-variant this frame
212e	hand the variant back in B
212f	restore the caller's accumulator untouched
2130	return with B holding the tile variant
2131	the VRAM destination arriving in DE becomes the draw pointer HL
2132	carry set means stamp a 2x2 tile block instead of a glyph
2134	point at the glyph tile-code table
2137	index it by the selector B
2138	fetch the B-th tile code from the table
2139	put the VRAM cell back in HL for the draw
213a	paint the double-height glyph at that cell
213d	copy the signed block selector B
213e	test its sign
213f	non-negative selector -- look the tile block up by index
2142	negative selector -- use the fixed fallback tile $a4
2144	go stamp the 2x2 block
2146	point at the ROM tile-block table
2149	fetch this index's 2x2 tile-block code
214a	bring the pending VRAM destination (in DE) into HL to draw at
214b	stamp a 2x2 tile block from the seed tile in A
214e	default to the player-1 status-column VRAM base
2151	test the player index
2152	player 1 -- keep the 0x5340 base and return
2153	otherwise point at the player-2 status-column VRAM base
2156	return that status-column base
215f	test the form selector
2160	form 0 -- blank the 4x4 block then overlay a 2x2 icon
2162	drop to form 1
2163	form 1 -- just blank the 4x4 block
2165	otherwise it is form 2, the folded tile-code form
2166	shift the value left one bit
2167	shift again
2168	shift again
2169	four doublings move the low nibble up into the high nibble
216a	complement it
216b	keep the two form bits
216d	bias over tile base $c0 to form the block tile code
216f	aim at the first 2x2 block cell
2172	stamp the first block
2175	aim at the second block cell (seed advanced +4)
2178	stamp the second 2x2 block
217b	aim at the third block cell
217e	stamp the third block
2181	aim at the last block cell
2184	stamp the last block and return
2187	point at the top-left of the 4x4 tile region
218a	the row-advance step (28) that jumps to the next row of four
218d	four rows of tiles to blank
218f	four cells across this row
2191	write the blank tile $40 into this cell
2193	step to the next cell
2194	repeat across the four cells of the row
2196	jump the cursor to the next row's start
2197	one fewer row left
2198	repeat for all four rows
219a	the 4x4 block is blanked -- return
219b	blank the 4x4 block first
219e	seed tile 96 for the icon
21a0	aim at the icon's VRAM cell
21a3	stamp the 2x2 icon and return
21a6	save the score-type index in C
21a7	fire the RST-08 page-zero helper before folding in the score
21a8	select the current player's 3-byte packed-BCD score field into DE
21ab	recover the score-type index
21ac	add it again
21ad	times three -- each score-increment entry is three bytes
21ae	the byte offset into C
21af	clear B so BC is the 16-bit offset
21b1	point at the ROM score-increment table
21b4	index to this score type's 3-byte increment
21b5	clear carry before the running BCD add
21b6	three packed-BCD bytes to add
21b8	read one byte of the current score
21b9	add the matching increment byte with carry
21ba	decimal-adjust to keep the digit pair packed BCD
21bb	store the summed digit pair back
21bc	next score byte
21bd	next increment byte
21be	repeat for all three BCD bytes
21c0	step back to the score's top byte
21c1	save the score pointer
21c2	step down to the mid byte
21c3	the top score byte into H
21c4	read the mid score byte
21c5	into L -- HL holds the score's top two bytes
21c6	double it
21c7	double again
21c8	double again
21c9	four doublings scale the score's high word
21ca	take the high byte of the scaled score
21cb	point at the bonus-award score threshold byte
21ce	compare the scaled score against the threshold
21cf	at or over the threshold -- award the one-shot bonus marker
21d2	step back up to the score's top byte for the repaint
21d3	read the active player index
21d6	repaint that player's score digits into VRAM
21d9	restore the score pointer
21da	point at the top byte of the high score
21dd	three bytes to compare, top-down
21df	read the player's score byte
21e0	compare it against the high-score byte
21e1	player's score is lower -- no new record, return
21e2	player's score is higher -- go copy it into the high score
21e4	equal so far -- step both pointers down a byte
21e5	step the high-score pointer down too
21e6	compare the next byte
21e8	all three equal -- no new record, return
21e9	reselect the current player's score field into DE
21ec	point at the high-score field
21ef	three bytes to copy
21f1	read a score byte
21f2	store it into the high score
21f3	next score byte
21f4	next high-score byte
21f5	copy all three bytes
21f7	step back to the score's top byte
21f8	aim the digit cursor at the high-score VRAM field
21fc	paint the six BCD digits up that column
21fe	is the field index 3 or more?
2200	yes -- descend and clear every lower field
2202	save the field index
2203	default to the player-1 score field
2206	and its bonus-marker companion cell
2209	test index 0
220a	index 0 -- player-1 field selected, go clear it
220c	index 1 -- point at the player-2 score field
220f	its bonus-marker companion cell
2212	drop toward index 1
2213	index 1 confirmed -- go clear it
2215	otherwise index 2 -- the high-score field
2218	aim the companion pointer at the same high-score field
2219	both halves of DE now point at the high-score field
221a	zero the field's first score byte
221c	step to the next byte
221d	zero the second byte
221f	step to the next byte
2220	zero the third byte
2222	switch to the bonus-marker companion cell
2223	zero it too
2225	recover the field index
2226	go repaint that field's digits
2228	step down to the next lower field index
2229	save it
222a	clear and redraw that lower field
222d	recover the index
222e	reached field 0 -- done
222f	otherwise keep descending
2231	is the field index 3 or more?
2233	yes -- descend and redraw every lower field
2235	test index 0
2236	point at the player-1 score (top byte for the up-column draw)
2239	index 0 -- draw the player-1 score
223b	drop toward index 1
223c	not index 1 -- it must be index 2, the high score
223e	index 1 -- read the two-player-active flag
2241	test it
2242	no second player -- skip drawing the player-2 score
2243	point at the player-2 score (top byte)
2246	draw the player-2 score
2248	index 2 -- point at the high-score field (top byte)
224b	draw the high-score digits
224d	step down to the next lower field index
224e	save it
224f	redraw that lower field
2252	recover the index
2253	reached field 0 -- done
2254	otherwise keep descending
2256	default the digit cursor to the primary-player score field
225a	test the field selector
225b	selector 0 -- use the primary field
225d	otherwise use the alternate-player score field
2261	the per-digit cursor step -- up one tilemap row (-32)
2264	DE holds the -32 step, HL the packed-BCD source pointer
2265	three packed-BCD bytes to paint
2267	four-digit leading-zero blanking budget
2269	read a packed-BCD byte
226a	rotate the high nibble down
226b	rotate again
226c	rotate again
226d	four rotates bring the high nibble into the low nibble
226e	paint that high digit
2271	re-read the byte for its low nibble
2272	paint the low digit
2275	step to the next lower BCD byte
2276	repeat for all three bytes
2278	the score column is painted -- return
2279	isolate the single digit
227b	digit is zero -- maybe blank it as a leading zero
227d	nonzero digit ends leading-zero blanking
227f	go paint the digit
2281	check the leading-zero budget
2282	test it
2283	budget spent -- paint the zero normally
2285	still leading zeros -- force a blank-tile seed
2287	consume one from the leading-zero budget
2288	bias the digit into its font tile code
228a	write the digit tile into the VRAM cell
228d	step the cursor up one tilemap row
228f	digit drawn -- return
2290	default DE to the player-1 packed-BCD score field
2293	read the active player index
2296	test it
2297	player 1 -- keep the player-1 score field
2298	player 2 -- point at the player-2 score field
229b	return DE at the selected score field
229c	read the active player index
229f	base of the per-player bonus-marker one-shot flags
22a2	index by the player
22a3	HL now points at this player's marker flag
22a4	has this player's bonus already been awarded?
22a6	yes -- one-shot, do nothing
22a7	mark this player's bonus as awarded
22a9	load 1
22ab	raise the bonus-sound envelope trigger
22ae	point at the bonus-marker counter
22b1	bump the marker count
22b2	load the new count into B for the marker-row repaint
22b3	point HL at the 5-slot marker row in VRAM at 0x539e
22b6	C counts the five marker-row slots
22b8	read the object-active flag 0x4200 -- is a round in progress
22bb	test it
22bc	not in play -- draw the full marker count untouched
22be	round live: drop the displayed marker count by one
22bf	if that emptied the count, blank every slot instead
22c1	A holds the marker glyph, tile 0x66
22c3	stamp a 2x2 marker block growing upward into this slot
22c6	one row slot consumed
22c7	loop, one marker block per counted marker
22c9	step to the next slot
22ca	stop once the slot counter runs past the end
22cb	blank this leftover slot with the filler 2x2 block
22ce	loop, blanking the remaining marker slots
22f1	point HL at the message-pointer table at 0x235c
22f4	double the message index -- two-byte table entries, and float the mode bits into carry/sign
22f5	stash the doubled index and its mode flags
22f6	mask off the mode bits, keeping just the table offset
22f8	low byte of the offset
22f9	high byte is zero
22fb	index into the message-pointer table
22fc	fetch the entry's low byte
22fd	step to the high byte
22fe	fetch the entry's high byte -- DE now points at the message descriptor
22ff	move that descriptor pointer into HL
2300	read the descriptor's dest-cell low byte
2301	step forward
2302	read the dest-cell high byte -- DE is the VRAM destination cell
2303	step past to the glyph text bytes
2304	HL becomes the VRAM destination, DE the text source
2305	BC is -32, the stride that walks one tile row up the column
2308	recover the doubled index and mode flags
2309	original bit7 set -- go blank the text column
230b	original bit6 set -- go record the pointers and arm the scroller
230e	read the next glyph byte from the text
230f	shift the character code down to its tile index
2311	is this the end-of-text terminator
2313	yes -- the column is done
2314	poke the glyph tile into the current VRAM cell
2315	step to the next glyph
2316	move up one tile row
2317	loop for the rest of the column
2319	read the next source byte
231a	is this the terminator
231c	yes -- the blanking pass is done
231d	write the blank tile 0x40 into this cell
231f	step to the next source byte
2320	move up one tile row
2321	loop, blanking the rest of the column
2323	stash the VRAM destination cell into the scroller dest pointer 0x40b5
2326	swap so HL holds the text source
2327	stash the text source into the scroller text pointer 0x40b3
232a	low byte of the destination cell
232b	keep the column position within the 32-wide row
232d	B holds that column
232e	double the column
232f	add 32
2331	form the low byte of the cursor cell address
2332	high byte 0x40 -- the cursor lives in work RAM
2334	stash the cursor into the scroller cursor pointer 0x40b1
2337	save the cursor address
2338	halve the low bits
233a	halve again
233c	high byte of the destination
233d	keep its low two bits
233f	rotate them up toward the top of the byte
2340	rotate again
2341	fold in the shifted low part
2342	mask to the row-aligned start value
2344	C holds the scroller's starting tile value
2345	point HL at the VRAM base 0x5000
2348	add the column
2349	fold it into the pointer
234a	HL now points at the top of the message column
234b	stride of +32, one tile row down
234e	B counts 32 rows down the column
234f	blank this column cell with tile 0x10
2351	step down one row
2352	loop down the whole column
2354	recover the cursor cell address
2355	seed the cursor cell with the scroller's starting value
2356	arm value 1
2358	raise the message-scroller enable flag 0x40b0
235b	done -- the scroller is armed
24b7	test the HUD-field selector in A
24b8	selector 0 -- draw the coin/credit icon-tally row
24ba	drop to selector 1
24bb	selector 1 -- draw the credit-count digits
24bd	drop to selector 2
24be	selector 2 -- draw the two-nibble config readout
24c0	selector 3: read the bonus-marker count 0x421d
24c3	hand it to B for the marker draw
24c4	fire the restart-8 page-zero helper
24c5	draw the bonus-marker row
24c8	read the coinage/config byte 0x40ac
24cb	is it the 0xff disabled marker
24cd	yes -- nothing to show, return
24ce	message index 6 -- the config label
24d0	paint that label column
24d3	re-read the config byte
24d6	keep its low nibble
24d8	stamp it into the low-nibble config cell 0x5138
24db	re-read the config byte
24de	keep its high nibble
24e0	high nibble present -- draw it
24e2	high nibble zero -- bump so it renders as a blank leading digit
24e3	rotate the high nibble down toward the low four bits
24e4	rotate again
24e5	rotate again
24e6	rotate again -- the high nibble is now a digit
24e7	stamp it into the high-nibble config cell 0x5158
24ea	done
24eb	read the mode flag 0x4006
24ee	shift its bit0 into carry
24ef	in-game mode -- skip the credit HUD entirely
24f0	read the second-input shadow 0x4011
24f3	keep the top two coinage-DIP bits
24f5	are both set -- free play
24f7	message index 0x10 -- the FREE PLAY banner
24f9	free play -- paint that banner and return
24fc	message index 5 -- the CREDIT label
24fe	paint the credit label column
2501	read the credit count 0x4002
2504	is it at or past 99
2506	below the cap -- use it
2508	clamp the credit count to 99
250a	convert the credit count to packed BCD
250d	keep the two digits in B
250e	isolate the tens nibble
2510	no tens -- skip the tens digit
2512	rotate the tens nibble down
2513	rotate again
2514	rotate again
2515	rotate again -- tens is now a digit
2516	stamp the tens digit into the credit tens cell 0x529f
2519	recover the two digits
251a	isolate the units nibble
251c	stamp the units digit into the credit units cell 0x527f
251f	done
2520	fire the restart-8 page-zero helper
2521	read the formation-clear flag 0x4220
2524	test it
2525	formation not clear -- skip the sound reset
2527	arm value 1
2529	request a sound-LFO reset via 0x41d0
252c	read the coin/credit icon-tally count 0x421c
252f	the drawn value is the count plus one
2530	is it at or past 48
2532	below the cap -- use it
2534	clamp the tally to 48
2536	convert the tally to packed BCD
2539	save the digits
253a	point HL at the icon-tally row base 0x507e
253d	isolate the tens nibble
253f	no tens -- skip the tens icons
2541	rotate the tens nibble down
2542	rotate again
2543	rotate again
2544	rotate again -- tens is now a count
2545	B counts the tens icons to draw
2546	C starts the running slot budget at 16
2548	the tens icon glyph, tile 0x68
254a	stamp a 2x2 tens icon into the row
254d	step the slot budget
254e	step it again -- a tens icon spans two slots
254f	loop, one icon per tens
2551	recover the digits
2552	isolate the units nibble
2554	B counts the units icons to draw
2555	stride of +31 between icon pairs
2558	no units -- skip to the blank tail
255a	the units icon glyph, tile 0x6c
255c	stamp a units icon pair into the row
255f	step the slot budget
2560	loop, one icon per unit
2562	step the slot budget
2563	stop once the row is filled
2564	blank this leftover slot with the fixed tile pair
2567	loop, blanking the rest of the row
2569	B keeps the raw byte
256a	take its low nibble
256c	no change, priming the decimal adjust
256e	decimal-adjust the low nibble into BCD
256f	C holds that units contribution
2570	recover the raw byte
2571	take its high nibble
2573	no high nibble -- just add the units part
2575	rotate the high nibble down
2576	rotate again
2577	rotate again
2578	rotate again -- high nibble is now a count
2579	B counts how many sixteens to add
257a	clear the running total
257b	add decimal 16 per high-nibble unit
257d	keep the running total in BCD
257e	loop for each sixteen
2580	add in the units contribution
2581	final decimal adjust
2582	return the packed-BCD value
2583	seed the fixed glyph code 0x2c
2585	save DE
2586	stride of +31 between the pair and the next row
2589	stamp the top tile pair
258c	stamp the bottom tile pair
258f	restore DE
2590	done -- a 2x2 tile block drawn
2591	seed the fixed filler glyph code 0x2e
2593	save DE
2594	stride of -33 -- up one row and back a column
2597	stamp the top tile pair growing upward
259a	step the tile code back by four for the bottom pair
259c	join the block tail to stamp the bottom pair
259e	seed the fixed glyph code 0x2c
25a0	stamp tile A at the current cell
25a1	step the tile code
25a2	step to the next cell
25a3	stamp tile A+1 alongside it
25a4	step the tile code again
25a5	advance the pointer by the stride
25a6	done -- a tile pair stamped
25a7	seed the fixed glyph code 0x2c
25a9	save DE
25aa	stride of +32 -- one tile row down
25ad	stamp the top half of the double-height glyph
25ae	step the code by two for the bottom half
25b0	move down one tile row
25b1	stamp the bottom half
25b2	restore DE
25b3	done -- a double-height glyph drawn
