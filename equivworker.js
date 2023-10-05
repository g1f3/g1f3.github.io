// Web worker for equivalence

onmessage = (e) => {
    if (e.data.cmd === 'equivalence') {
        const fnA = Function (... e.data.fnA);
        const fnB = Function (... e.data.fnB);
        for (var n = 0n; n < BigInt (e.data.rangeEnd); n++) {
            if (fnA (n) != fnB (n)) {
                postMessage (`Failed: ${n}`);
                return;
            }
        }
        postMessage (`Succeeded.`);
    }
}

