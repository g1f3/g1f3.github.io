import { Board, traceVarMapBoard, getExecutionFunction } from './board.js';
import { Bitboard } from './bitboard.js';

export { Board } from './board.js';

function P (...args) { return console.log (...args); }
function $ (...args) { return document.getElementById (...args); }
function elem (...args) { return document.createElement (...args); }

// TODO: compile code as a sequence of bitwise operations.
// TODO: compile code as a "computation graph" of variables.
//     (for static analysis, and debugging)

// TODO: use the `Function()` constructor to compile a sequence of bitwise operations to native code.

function readBoard (bitstring) {
    const data = [[]];
    for (const ch of bitstring) {
        switch (ch) {
        case '/': data.push ([]); break;
        case '0': data[data.length - 1].push (0); break;
        case '1': data[data.length - 1].push (1); break;
        default: return new Board (3, 3, [[1, 0, 1], [0, 1, 0], [1, 0, 1]]);
        }
    }
    const height = data.length;
    const width = data[0].length;
    for (const row of data) {
        if (row.length != width) return new Board (3, 3, [[1, 0, 1], [0, 1, 0], [1, 0, 1]]);
    }
    return new Board (height, width, data);
}

function pureRun (code, input, args) {
    // Case: code is function
    if (code instanceof Function) {
        return {focus: code (input)};
    }

    // P ('max size:', getMaxSize (code));
    const ast = codeToAst(code);
    // const tape = new Bitboard ([64, 64]).compileToVM (ast);
    // P ('tape:', tape);
    const state = {focus: input};
    for (const token of ast) {
        step (state, token);
    }
    P (ast);
    return state;
}

function runAst (code, input, args) {
    const state = {focus: input};
    for (const token of code) {
        step (state, token);
    }
    return state.focus;
}

function areEquivalentUnderMask (code1, code2, inputSize, inputMask) {
    const [height, width] = inputSize;
    function toBoard (bitString) {
        return Board.plot (height, width,
                           (i, j) => (bitString >> (i*width+j))&1);
    }

    const code1IsFunction = code1 instanceof Function;

    const ast1 = code1IsFunction ? null : codeToAst (code1);
    const ast2 = codeToAst (code2);
    var n = inputMask;
    var testedCount = 0;
    while (true) {
        // Test equivalence on n;
        const board = toBoard (n);
        const res1 = code1IsFunction
              ? code1 (board)
              : runAst (ast1, board, {});
        const res2 = runAst (ast2, board, {});
        testedCount ++;
        if (res1.equals (res2)) {
            // good
        } else {
            // Fail
            return {equiv: false, testedCount, board, res1, res2};
        }

        if (n == 0) break; else n = (n - 1) & inputMask;
    }
    return {equiv: true, testedCount};
}

/* --- default implementation.
export function areEquivalent (code1, code2, game, solutionText) {
    const [height, width] = game.size;
    
    const inputMask = (1 << (height*width)) - 1;

    return areEquivalentUnderMask (code1, code2, game.size, inputMask);
} --- */

// Tells if two functions are equivalent by running them on a `Worker`,
//     after compilation.
export function areEquivalent (code1, code2, game, solutionText=null) {
    const [height, width] = game.size;
    
    const inputMask = (1 << (height*width)) - 1;

    P ('solutionText=',solutionText);
    const fn1 = solutionText ?? getExecutionFunctionForAst (codeToAst(code1), game, 'a_');
    const fn2 = getExecutionFunctionForAst (codeToAst(code2), game, 'b_');

    const l = '{', r = '}';

    // bit assignments
    const pres = [];
    const posts = [];
    for (var i = 0; i < height; i++) {
        for (var j = 0; j < width; j++) {
            const shift = i * width + j;
            pres.push (`in_${i}_${j} = (board >> ${shift}) & 1;\n`);
        }
    }

    for (var i = 0; i < game.outputSize[0]; i++) {
        for (var j = 0; j < game.outputSize[1]; j++) {
            posts.push (`if (a_out_${i}_${j} !== b_out_${i}_${j}) return (${l} equiv: false, bitboard: board ${r});\n`);
        }
    }

    const bitAssignments = pres.join ('');
    const comparisons = posts.join ('');

    // Template
    const fullCode = `
for (board = 0; board <= ${inputMask}; board++) ${l}
${bitAssignments}
${fn1}
${fn2}
${comparisons}
${r}
return (${l} equiv: true ${r});
`;
    P (fullCode);

    // Execute function
    const fn = Function (fullCode);
    const result = fn ();
    
    if (result.equiv) {
        result.testedCount = inputMask + 1;
    } else {
        const board = Board.plot (height, width, (i, j) => (result.bitboard >> (i * width + j)) & 1);
        result.board = board;
    }

    return result;
}

export function getExecutionFunctionForAst (ast, args, prefix='a_') {
    // Run radioactive
    const radioactiveInput = Board.brandNew (args.size[0], args.size[1]);
    const radioactiveFocus = runAst (ast,
                                     radioactiveInput,
                                     args);
    return getExecutionFunction (radioactiveInput, radioactiveFocus, prefix);
}

export function run (code, args) {
    P ('running...', code, args);
    const finalState = pureRun (code,
                                args.input,
                                args);
    P ('running...', code, args, finalState);
    P (finalState.focus.toString ());
    $('display').innerHTML = '';
    $('display').appendChild (stateToTable (finalState));

    $('input').innerHTML = '';
    $('input').appendChild (args.input.toTable ());

    // Compute correct result
    const correctResult = pureRun (args.solution,
                                   args.input,
                                   args);
    $('output1').innerHTML = '';
    $('output1').appendChild (correctResult.focus.toTable ());

    // Show player result
    $('output2').innerHTML = '';
    $('output2').appendChild (finalState.focus.toTable ());

    // P ('code is', getExecutionFunctionForAst (codeToAst (code), args, 'abc_'));

    // Add actions for display.
    const inputBoard = $('input').children[0];
    for (var i = 0; i < inputBoard.children.length; i++) {
        const row = inputBoard.children[i];
        for (var j = 0; j < row.children.length; j++) {
            const cell = row.children[j];
            cell.setAttribute ('data-ij', JSON.stringify ([i, j]));
            cell.onclick = (e) => {
                // args.<replace_board>
                const orig = args.input;
                const [i, j] = JSON.parse (e.target.getAttribute ('data-ij'));
                const newBit = 1 ^ orig.d (i, j);
                P (newBit);
                args.input = Board.plot (orig.height, orig.width, (i2, j2) => {
                    P ('executing at', i2, j2, i, j, newBit);
                    if (i2 === i && j2 === j) {
                        return newBit;
                    } else {
                        return orig.d (i2, j2);
                    }
                })
                P ('args.input = ', args.input.toString ());
                run (code, args);
                P ('updated cell');
            }
        }
    }
}

function getMaxSize (code) {
    code = codeToAst(code);
    const state = {focus: Board.plot (5, 5, (i, j) => 0)};
    var maxH = 1, maxW = 1;
    for (const token of code) {
        step (state, token);
        for (const key of Object.keys (state)) {
            const val = state[key];
            if (val instanceof Board) {
                maxH = Math.max (maxH, val.height);
                maxW = Math.max (maxW, val.width);
            }
        }
    }
    return [maxH, maxW];
}

/** Turns a state into a table. */
function stateToTable (state) {
    const table = elem ('table');
    const header = elem ('tr');
    const boards = elem ('tr');
    const indices = Object.keys (state);
    P ('indices', indices);
    for (const index of indices) {
        const top = elem ('th');
        top.innerText = index;
        header.appendChild (top);

        const board = elem ('td');
        board.appendChild (state[index].toTable());
        boards.appendChild (board);
    }
    table.appendChild (header);
    table.appendChild (boards);
    return table;
}

function parseToken (token) {
    if (token === '') {
        return null;
    } else if (token.match (/^[A-Z][A-Za-z]*$/)) {
        return ['*board', token];  // Board name
    } else if (token.match (/^[atdcxsr]/)) {
        // Movement commands
        const match = token.match (/^(.)([oie]*)([lrtb])(\d*)$/);
        if (match) {
            const cmd = match[1];
            const fillWith = match[2];
            const dir = match[3];
            const count = match[4] === '' ? 0 : parseInt (match[4]);
            const boardName = null;
            return [cmd, fillWith, dir, count, boardName];
        }
    } else if (token.startsWith ('m')) {
        return ['m', token.slice (1)];
    } else if (token === '~') {
        return ['~'];
    } else if (token.match (/^[&|^=]/)) {
        // Bitwise commands
        const matchFold = token.match (/^(\&\&|\|\||\^\^)([lrtba])$/);
        if (matchFold) {
            return [matchFold[1], matchFold[2]];
        }

        if (['&', '|', '^', '='].includes (token) ) {
            return [token, null];
        }
    } else /* data flow commands */ if (token.startsWith ('#')) {
        return ['#', readBoard (token.slice (1))];
    } else if (token.match (/^[oi]/)) {
        const match = token.match (/^([oi])(\d+)x(\d+)$/);
        if (match) {
            const bit = match[1] == 'o' ? 0 : 1;
            const height = parseInt (match[2]);
            const width = parseInt (match[3]);
            return ['#', Board.plot (height, width, (i, j) => bit)];
        }
    } else if (token.startsWith ('>') && token.slice(1).match (/^[A-Z][A-Za-z]*$/)) {
        return ['>', token.slice (1)];
    } else if (token.match (/^(\d+)x$/)) {
        return ['*times', parseInt (token)];
    } else if (token.startsWith ('%')) {
        // TODO: define functions
    }
    return token;
}

function parseCode (code) {
    code = (code.replaceAll ('(', ' ( ')
            .replaceAll (')', ' ) ')
            .replaceAll ('{', ' { ')
            .replaceAll ('}', ' } '));
    code = code.trim ();
    const tokens = code === '' ? [] : code.trim ().split (/\s+/);
    const stack = [[]];
    for (const token of tokens) {
        var tail, elem;
        switch (token) {
        case '(':
            stack.push (['*paren']); break;
        case ')':
            // must be a paren phrase
            tail = stack[stack.length-1];
            if (tail.length <= 0 || tail[0] != '*paren') { return null; }
            elem = stack.pop ();
            if (stack.length <= 0) { return null; }
            stack[stack.length-1].push (elem); break;
        case '{':
            stack.push (['*brace']); break;
        case '}':
            // must be a paren phrase
            tail = stack[stack.length-1];
            if (tail.length <= 0 || tail[0] != '*brace') { return null; }
            elem = stack.pop ();
            if (stack.length <= 0) { return null; }
            stack[stack.length-1].push (elem); break;
        default: stack[stack.length-1].push (parseToken(token));
        }
    }
    if (stack.length != 1) { return null; }
    return stack[0];
}

/** Post-transform of *paren and *brace, allowing parentheticals. */
function postTransformCode (code) {
    // First, recursively transform any subprograms.
    code = code.map ((instruction) => {
        if (['*paren', '*brace'].includes (instruction[0])) {
            return [instruction[0]].concat(postTransformCode (instruction.slice (1)));
        }
        return instruction;
    });

    // Append trailings.
    const ans = [];
    for (var i = 0; i < code.length; i++) {
        const current = code[i], next = code[i+1] ?? null;
        const cmd = current[0];
        var elem = current.concat ();

        // Skip current element if a brace.
        if (['*paren', '*brace'].includes (cmd)) {
            continue;
        }

        if (next && ['*paren', '*brace'].includes (next[0])) {
            if (['&', '|', '^', '=', 'a', 't', 'd'].includes (cmd)) {
                if (next[0] !== '*paren') return null; // error!
                elem[elem.length - 1] = next[1];
            } else if (['*times', '*def'].includes (cmd)) {
                elem[elem.length - 1] = next[1].slice (1);
            }
        }

        ans.push (elem);
    }
    return ans;
}

function codeToAst (codeString) {
    return postTransformCode (parseCode (codeString));
}

function step (state, token) {
    const focus = state.focus;
    const body = token.slice (1);
    if (typeof (token) === 'string') {
        // To be outdated soon.
    } else {
        const head = token[0];
        var fillWith, dir, count, boardName;
        if (token.length === 5) {
            [fillWith, dir, count, boardName] = token.slice (1);
        }
        switch (head) {
        case '#': state.focus = token[1]; break;
        case '~': state.focus = focus.bitnot(); break;
        case 't':
            state.focus = focus.cmdTake (dir, count); break;
        case 'd':
            state.focus = focus.cmdDelete (dir, count); break;
        case 'c':
            state.focus = focus.cmdCopy (dir, count); break;
        case 'x':
            state.focus = focus.cmdExtend (dir, count); break;
        case 's':
            state.focus = focus.cmdShift (dir, count); break;
        case 'r':
            state.focus = focus.cmdRoll (dir, count); break;
        case 'm':
            state.focus = focus.transform (token[1]); break;
        case 'a':
            var otherBoard;
            if (boardName[0] === '#') {
                otherBoard = boardName[1];
            } else if (boardName[0] === '*board') {
                otherBoard = state[boardName[1]];
            }
            state.focus = focus.cmdAppend (dir, otherBoard); break;
        case '>':
            state[token[1]] = focus; break;
        case '*board':
            state.focus = state[token[1]]; break;
        case '&&':
            state.focus = focus.cmdRowand (token[1]); break;
        case '||':
            state.focus = focus.cmdRowor (token[1]); break;
        case '^^':
            state.focus = focus.cmdRowxor (token[1]); break;
        case '&':
            if (token[1][0] === '#') {
                state.focus = focus.bitand (token[1][1]);
            } else if (token[1][0] === '*board') {
                state.focus = focus.bitand (state[token[1][1]]);
            }
            break;
        case '|':
            if (token[1][0] === '#') {
                state.focus = focus.bitor (token[1][1]);
            } else if (token[1][0] === '*board') {
                state.focus = focus.bitor (state[token[1][1]]);
            }
            break;
        case '^':
            if (token[1][0] === '#') {
                state.focus = focus.bitxor (token[1][1]);
            } else if (token[1][0] === '*board') {
                state.focus = focus.bitxor (state[token[1][1]]);
            }
            break;
        case '=':
            var other;
            if (token[1][0] === '#') {
                other = token[1][1];
            } else if (token[1][0] === '*board') {
                other = state[token[1][1]];
            }
            state.focus = focus.cmdEquals (other); 
            break;
        }
    }
}

