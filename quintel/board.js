function P (...args) { return console.log (...args); }
function elem (...args) { return document.createElement (...args); }

function fold (row, seed, op) {
    for (const elem of row) { seed = op (seed, elem); } return seed;
}
function andall (row) { return fold (row, 1, (a, b) => a & b); }
function orall (row) { return fold (row, 0, (a, b) => a | b); }
function xorall (row) { return fold (row, 0, (a, b) => a ^ b); }

const Gensym = {n: 0n};

// Unique string generator
Gensym.next = () => {
    Gensym.n ++;
    return Symbol.for ('v' + Gensym.n.toString());
}
Gensym.order = (symbol) => BigInt (Symbol.keyFor(symbol).slice (1));

export class Board {
    /** Primitive functions. */

    constructor (height, width, data) {
        if (height < 0 || width < 0) throw new Error (`Incorrect entry: ${height}, ${width}`);
        
        this.height = height;
        this.width = width;
        this.data = data;
    }

    d (i, j) {
        // get data.
        const row = this.data[i] ?? [];
        const elem = row[j] ?? 0;
        return elem;
    }

    equals (other) {
        if (this.height !== other.height) return false;
        if (this.width !== other.width) return false;
        for (var i = 0; i < this.height; i++) {
            for (var j = 0; j < this.width; j++) {
                if (this.d (i, j) !== other.d (i, j)) return false;
            }
        }
        return true;
    }

    static plot (height, width, fn) {
        const ans = [];
        for (var i = 0; i < height; i++) {
            const row = [];
            for (var j = 0; j < width; j++) {
                row.push (fn (i, j));
            }
            ans.push (row);
        }
        return new Board (height, width, ans);
    }

    static brandNew (height, width) {
        return Board.plot (height, width,
                           (i, j) => new VarMap (
                               1 << (i * width + j),
                               'var',
                               []
                           ));
    }

    static empty (height, width) {
        return Board.plot (height, width, (i, j) => 0);
    }

    size () {
        return [this.height, this.width];
    }

    toString () {
        if (this.height * this.width === 0) {
            return `o${this.height}x${this.width}`;
        }
        const ans = ['#'];
        for (const row of this.data) {
            for (const elem of row) {
                ans.push (elem.toString());
            }
            ans.push ('/');
        }
        ans.pop ();
        return ans.join ('');
    }
    
    // display as table
    toTable () {
        if (this.height * this.width === 0) {
            const p = elem ('p');
            p.innerText = `o${this.height}x${this.width}`;
            return p;
        }
        const ans = elem ('table');
        ans.classList.add ('board');
        for (const row of this.data) {
            const r = elem ('tr');
            for (const bit of row) {
                const b = elem ('td');
                b.innerText = bit.toString();
                b.classList.add (bit ? 'one' : 'zero');
                r.appendChild (b);
            }
            ans.appendChild (r);
        }
        return ans;
    }

    clone () {
        return Board.plot(this.height, this.width, (i, j) => this.d(i, j));
    }

    cutrow (n) {
        n = Math.max (Math.min (n, this.height), 0);
        const top = new Board (n, this.width, this.data.slice (0, n)).clone ();
        const bottom = new Board (this.height - n, this.width, this.data.slice (n, this.height)).clone ();
        return [top, bottom];
    }

    glue (b) {
        if (this.width != b.width) throw new Error (`Incompatible widths.`);
        // return new Board (this.height + b.height, this.width, this.data.concat (b.data)).clone ();
        return Board.plot (this.height + b.height, this.width, (i, j) => (i < this.height ? this.d (i, j) : b.d (i - this.height, j)));
    }

    reverse () {
        return Board.plot (this.height, this.width, (i, j) => this.d(this.height - 1 - i, j));
    }

    transpose () {
        return Board.plot (this.width, this.height, (i, j) => this.d(j, i));
    }

    multiply (n) {
        return Board.plot (this.height * n, this.width, (i, j) => this.d(i % this.height,j));
    }

    bitand (other) {
        return Board.plot (this.height, this.width, (i, j) => VarAnd (this.d(i, j), other.d(i, j)));
    }
    
    bitor (other) {
        return Board.plot (this.height, this.width, (i, j) => VarOr (this.d(i, j), other.d(i, j)));
    }
    
    bitxor (other) {
        return Board.plot (this.height, this.width, (i, j) => VarXor (this.d(i, j), other.d(i, j)));
    }

    bitnot () {
        return Board.plot (this.height, this.width, (i, j) => VarNot (this.d(i, j)));
    }

    rowand () {
        return Board.plot (this.height, 1, (i, j) => VarAndAll (this.data[i]));
    }
    
    rowor () {
        return Board.plot (this.height, 1, (i, j) => VarOrAll (this.data[i]));
    }
    
    rowxor () {
        return Board.plot (this.height, 1, (i, j) => VarXorAll (this.data[i]));
    }

    cmdEquals (other) {
        if (this.height !== other.height) return Board.empty (1, 1);
        if (this.width !== other.width) return Board.empty (1, 1);
        var ans = 1;
        for (var i = 0; i < this.height; i++) {
            for (var j = 0; j < this.width; j++) {
                const cellEqual = VarNot (VarXor (this.d (i, j), other.d (i, j)));
                ans = VarAnd (ans, cellEqual);
            }
        }
        return Board.plot (1, 1, (i, j) => ans);
    }

    /** Composed functions. */

    transform (tf) {
        switch (tf) {
        case 'i': case null: return this;
        case 'v': return this.reverse ();
        case 'd': return this.transpose ();
        case 'h': return this.transpose ().reverse ().transpose ();
        case 'c': return this.reverse ().transpose ();
        case 'a': return this.transpose ().reverse ();
        case 'u': return this.transpose ().reverse ().transpose ().reverse ();
        case 'z': return this.transpose ().reverse ().transpose ().reverse ().transpose ();
        }
    }

    static transformFor (dir) {
        // Chosen order-2 transforms.
        switch (dir) {
        case 'b': return 'i';
        case 'r': return 'd';
        case 't': return 'v';
        case 'l': return 'z';
        }
    }

    /// perfrom a function under a transform.
    underTransform (tf, fn) {
        return fn (this.transform (tf)).transform (tf);
    }

    /// Command 't', take
    cmdTake (dir, n) {
        const transform = {t: 'i', b: 'v', r: 'z', l: 'd'} [dir]
        return this.underTransform (transform, (x) => x.cutrow (n)[0]);
    }

    /// Command 'd', delete
    cmdDelete (dir, n) {
        return this.underTransform (Board.transformFor (dir), (x) => x.cutrow (x.height - n)[0]);
    }

    /// Command 'c', copy
    cmdCopy (dir, n) {
        return this.underTransform (Board.transformFor (dir), (x) => x.multiply (n));
    }

    /// Command 'x', extend
    cmdExtend (dir, n) {
        return this.underTransform (Board.transformFor (dir),
                                    (x) => Board.plot (x.height + n, x.width,
                                                       (i, j) => (i < x.height ? x.d(i, j) : 0))
                                   );
    }

    /// Command 's', shift
    cmdShift (dir, n) {
        return this.underTransform (Board.transformFor (dir),
                                    (x) => Board.plot (x.height, x.width,
                                                       (i, j) => (i - n >= 0 ? x.d(i-n, j) : 0)));
    }

    /// Command 'r', roll
    cmdRoll (dir, n) {
        return this.underTransform (Board.transformFor (dir),
                                    (x) => Board.plot (x.height, x.width,
                                                       (i, j) => x.d ((i + x.height - n) % x.height, j)));
    }

    /// Command 'a', append
    cmdAppend (dir, other) {
        const transform = Board.transformFor (dir);
        const transformedOther = other.transform (transform);
        return this.underTransform (transform,
                                    (x) => x.glue (transformedOther));
    }

    /// Command '&&', rowand
    cmdRowand (dir) {
        const transform = {'l': 'i', 'r': 'i', 't': 'd', 'b': 'd'}[dir];
        return this.underTransform (transform, (x) => x.rowand ());
    }

    /// Command '||', rowor
    cmdRowor (dir) {
        const transform = {'l': 'i', 'r': 'i', 't': 'd', 'b': 'd'}[dir];
        return this.underTransform (transform, (x) => x.rowor ());
    }

    /// Command '^^', rowxor
    cmdRowxor (dir) {
        const transform = {'l': 'i', 'r': 'i', 't': 'd', 'b': 'd'}[dir];
        return this.underTransform (transform, (x) => x.rowxor ());
    }
}

class VarMap {
    constructor (val, type, children) {
        this.val = val;
        this.type = type;
        this.children = children;
        this.symbol = Gensym.next ();
    };
    toString () { return `VarMap(${this.val}, ${this.type}, ${this.children.length} children)`; }
}

function VarAnd (a, b) {
    if (a === 1) { return b; }
    else if (a === 0) { return 0; }
    else if (b === 1) { return a; }
    else if (b === 0) { return 0; }
    else { return new VarMap (a.val | b.val, 'and', [a, b]); }
}

function VarOr (a, b) {
    if (a === 1) { return 1; }
    else if (a === 0) { return b; }
    else if (b === 1) { return 1; }
    else if (b === 0) { return a; }
    else { return new VarMap (a.val | b.val, 'or', [a, b]); }
}

function VarXor (a, b) {
    if (typeof (a) === 'number' && typeof (b) === 'number') { return a ^ b; }
    if (a === 1) { return b; }
    else if (a === 0) { return b; }
    else if (b === 1) { return a; }
    else if (b === 0) { return a; }
    else { return new VarMap (a.val | b.val, 'xor', [a, b]); }
}

function VarNot (a) {
    if (typeof (a) === 'number') { return 1 ^ a; }
    else { return new VarMap (a.val, 'not', [a]); }
}

function VarAndAll (row) { return fold (row, 1, VarAnd); }
function VarOrAll (row) { return fold (row, 0, VarOr); }
function VarXorAll (row) { return fold (row, 0, VarXor); }

// Generates a list of all VarMap-s used in listOfVars
export function traceVarMap (listOfVars) {
    const stack = [...listOfVars];
    const map = new Map();

    while (stack.length > 0) {
        const elem = stack.pop ();
        if (! (elem instanceof VarMap)) continue;
        if (map.has (elem.symbol)) continue;

        // elem is a new VarMap
        map.set (elem.symbol, elem);
        for (const child of elem.children) {
            if (! map.has (child.symbol)) {
                stack.push (child);
            }
        }
    }

    // Tracked all children
    // console.log ('traceVarMap', map);
    for (const [symbol, node] of map) {
        console.log (symbol, '->', node);
    }
    console.log ([...map]);
    return map;
}

// Traces each variable back to its roots
export function traceVarMapBoard (board) {
    const listOfVars = [];
    for (var i = 0; i < board.height; i++) for (var j = 0; j < board.width; j++) {
        listOfVars.push (board.d (i, j));
    }
    return traceVarMap (listOfVars);
}

// Compiles a function based on input ("brandnew") and output
export function getExecutionFunction (input, output, prefix='a_') {
    const map = traceVarMapBoard (output);
    const list = [...map];
    function compareBigints (a, b) {
        return a < b ? -1 : a > b ? +1 : 0;
    }
    list.sort ((a, b) => compareBigints (Gensym.order(a[0]), Gensym.order(b[0])));
    const ans = [];
    for (const [name, def] of list) {
        var typeset;
        switch (def.type) {
        case 'var':
            var index = null;
            for (var i = 0; i < input.height; i++) for (var j = 0; j < input.width; j++) {
                if (input.d (i, j).val === def.val) {
                    // Matching input
                    index = [i, j]; break;
                }
            }
            typeset = `in_${index[0]}_${index[1]}`;
            break;
        case 'and': typeset = `${prefix}${Symbol.keyFor(def.children[0].symbol)} & ${prefix}${Symbol.keyFor(def.children[1].symbol)}`; break;
        case 'or': typeset = `${prefix}${Symbol.keyFor(def.children[0].symbol)} | ${prefix}${Symbol.keyFor(def.children[1].symbol)}`; break;
        case 'xor': typeset = `${prefix}${Symbol.keyFor(def.children[0].symbol)} ^ ${prefix}${Symbol.keyFor(def.children[1].symbol)}`; break;
        case 'not': typeset = `~ ${prefix}${Symbol.keyFor(def.children[0].symbol)}`; break;
        default: throw new Exception (`No such operator: ${def.type}`);
        }
        ans.push (`${prefix}${Symbol.keyFor(name)} = ${typeset};\n`);
    }

    // Output list
    for (var i = 0; i < output.height; i++) for (var j = 0; j < output.width; j++) {
        var typeset;
        if (output.d (i, j) instanceof VarMap) {
            typeset = prefix + Symbol.keyFor (output.d (i, j).symbol);
        } else {
            typeset = output.d (i, j).toString ();
        }
        ans.push (`${prefix}out_${i}_${j} = ${typeset};\n`);
    }

    return ans.join ('');
}
