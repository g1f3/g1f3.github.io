// TODO: add operations for bitboards.

function qmod (a, b) {
    if (b > 0) return a % b;
    else return 0;
}

export class Bitboard {
    constructor (maxSize) {
        [this.H, this.W] = maxSize;
        this.sizes = ({});
    }

    rect (size) {
        const [h, w] = size;
        var ans = 0n;
        for (var i = 0; i < h; i++) for (var j = 0; j < w; j++) {
            const loc = i * this.W + j;
            ans |= 1n << BigInt (loc);
        }
        return ans;
    }

    compileToVM (program) {
        const H = this.H, W = this.W;
        const sizes = this.sizes;
        const boards = new Map();
        const consts = new Map();
        // Collect constants and board names
        for (const instr of program) {
            const cmd = instr[0];
            if (cmd === '*board') {
                boards.set (instr[1], 1);
            } else if (cmd === '#') {
                consts.set (instr[1].toString (), 1);
            }
        }

        const tape = [];  // compiled program

        // Build instructions
        for (const instr of program) {
            const cmd = instr[0];

            // Common params
            const fillWith = instr[1];
            const dir = instr[2];
            const count = instr[3];
            const boardName = instr[4];

            switch (cmd) {
            case '#':
                tape.push(['L', 0, instr[1], 'focus']); sizes.focus = instr[1].size(); break;
            case '*board':
                tape.push(['L', 0, instr[1], 'focus']); sizes.focus = sizes[instr[1]]; break;
            case '>':
                tape.push(['L', 0, 'focus', instr[1]]); sizes[instr[1]] = sizes.focus; break;
            case '&':
                tape.push(['A', 'focus', instr[1], 'focus']); break;
            case '|':
                tape.push(['O', 'focus', instr[1], 'focus']); break;
            case '^':
                tape.push(['X', 'focus', instr[1], 'focus']); break;
            case '~':
                tape.push(['X', 'focus', this.rect (sizes.focus), 'focus']); break;
            case 's':
                const velocity = {'l': 1, 'r': -1, 't': W, 'b': -W}[dir] * count;
                const mask = this.rect (sizes.focus);
                if (velocity >= 0) {
                    tape.push (['L', velocity, 'focus', 'focus']);
                } else {
                    tape.push (['R', -velocity, 'focus', 'focus']);
                }
                tape.push (['A', 'focus', mask, 'focus']); break;
            case 'x':
                if (dir === 'l' || dir === 't') {
                    // no action
                } else if (dir === 'r') {
                    tape.push (['L', count, 'focus', 'focus']);
                } else if (dir === 'b') {
                    tape.push (['L', count * W, 'focus', 'focus']);
                }
                // Adjust size
                if (dir === 'l' || dir === 'r') {
                    sizes.focus = [sizes.focus[0], sizes.focus[1] + count];
                } else {
                    sizes.focus = [sizes.focus[0] + count, sizes.focus[1]];
                }
                break;
            }
        }

        return tape;
    }
}
