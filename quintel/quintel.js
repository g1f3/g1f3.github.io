import * as L from './lang.js';

function P (...args) { return console.log (...args); }
function $ (...args) { return document.getElementById (...args); }
function elem (...args) { return document.createElement (...args); }

const Game = {problemId: 1};

const worker = new Worker ('worker.js', {type: 'module'});
worker.postMessage ({cmd: 'start', number: 1 << 25});

worker.onmessage = (e) => {
    console.log ('got result', e.data);
}

const equivworker = new Worker ('equivworker.js');
equivworker.postMessage ({
    cmd: 'equivalence',
    rangeEnd: 1<<25,
    fnA: ['n', 'return (n >> 5n) << 5n;'],
    fnB: ['m', 'return m & (~31n) & (0xFFFFn);'],
});

equivworker.onmessage = (e) => {
    console.log ('got result from equivworker', e.data);
}

function lifeSolution (height, width, prefix='a_') {
    const rule = [`lifeRule = (a,b,c,d,e,f,g,h,i) => {
    nbs = a+b+c+d+f+g+h+i;
    live = e ? (nbs === 2 || nbs === 3) : (nbs === 3);
    return live ? 1 : 0;
}\n`];
    for (var i = 0; i < height; i++) {
        for (var j = 0; j < width; j++) {
            var neighbors = [];
            for (var di = -1; di <= 1; di++) {
                for (var dj = -1; dj <= 1; dj++) {
                    neighbors.push (`in_${(i+di+height)%height}_${(j+dj+width)%width}`);
                }
            }
            neighbors = neighbors.join (',');
            rule.push (`${prefix}out_${i}_${j} = lifeRule(${neighbors});\n`);
        }
    }
    return rule.join ('');
}

const puzzles = {
    1: {
        solution: 'mh',
        size: [5, 5],
        outputSize: [5, 5],
    },
    2: {
        solution: '||r cr5',
        size: [5, 5],
        outputSize: [5, 5],
    },
    3: {
        solution: '&(#11111/10000/10000/10000/10000) >A sb1 sr1 |(A) >A sb2 sr2 |(A) >A sb4 sr4 |(A)',
        size: [5, 5],
        outputSize: [5, 5],
    },
    4: {
        solution: (board) => L.Board.plot (board.height, board.width, (i, j) => {
            var total = 0;
            for (var di = -1; di <= 1; di ++) {
                for (var dj = -1; dj <= 1; dj ++) {
                    total += board.d ((i + di + board.height) % board.height, (j + dj + board.width) % board.width);
                }
            }
            total -= board.d (i, j);
            if (board.d (i, j)) {
                return (2 <= total && total <= 3) ? 1 : 0;
            } else {
                return (total === 3) ? 1 : 0;
            }
        }),
        solutionText: lifeSolution (4, 4, 'a_'),
        size: [4, 4],
        outputSize: [4, 4],
    },
    5: {
        solution: '>A mc =(A)',
        size: [5, 5],
        outputSize: [1, 1],
    },
};

$('p1').onclick = () => {Game.problemId = 1; present (true);}
$('p2').onclick = () => {Game.problemId = 2; present (true);}
$('p3').onclick = () => {Game.problemId = 3; present (true);}
$('p4').onclick = () => {Game.problemId = 4; present (true);}
$('p5').onclick = () => {Game.problemId = 5; present (true);}

function present (refresh = false) {
    const problemId = Game.problemId;
    Game.solution = puzzles[problemId].solution;
    Game.size = puzzles[problemId].size;
    Game.outputSize = puzzles[problemId].outputSize;
    Game.solutionText = puzzles[problemId].solutionText;
    if (refresh) {
        Game.input = L.Board.plot (Game.size[0], Game.size[1],
                                   (i, j) => (Math.random() < 0.5 ? 0 : 1));
        $('judgment').innerText = '';
    }
    $('pid').innerText = problemId;
    // Run player's code
    P ('codeArea.value = ', codeArea.value);
    L.run (codeArea.value, Game);
}

const codeArea = $('code');

codeArea.addEventListener ('input', () => {present ();}, false);

document.onload = () => {
    Game.problemId = 1; present (true);
}

$('check').onclick = () => {
    const solution = Game.solution;
    const userSolution = codeArea.value;
    const judgment = L.areEquivalent (
        solution, userSolution, Game, Game.solutionText
    );
    console.log (judgment);
    if (judgment.equiv) {
        $('judgment').innerText = `Successful (${judgment.testedCount} tested)`;
    } else {
        $('judgment').innerText = `Failed on input ${judgment.bitboard} / ${judgment.board}`;
        Game.input = judgment.board;
        present ();
    }
};
