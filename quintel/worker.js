// Web worker

/** Bitwise machine (design kept for reference).

Opcodes:
L|R <bigint> <in:index> <out:index>
    shift left/right by this amount
A|O|X|M <in1:index> <in2:index> <out:index>
    and/or/xor/mult

Registers: some are preloaded with constants.
Constants include
- rectangular mask of 1's
- raw data
- data generated during expands / shifts (filled with 1's)
*/

onmessage = (e) => {
    if (e.data.cmd === 'start') {
        console.log (e.data.number);
        postMessage (`Succeeded.`);
    }
}
