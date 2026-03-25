
import fs from 'fs';

const content = fs.readFileSync('d:/WorkStation/cryptobot/src/components/Chart.tsx', 'utf8');
const lines = content.split('\n');

let depth = 0;
lines.forEach((line, i) => {
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    depth += opens - closes;
    if (depth < 0) {
        console.log(`NEGATIVE DEPTH at line ${i + 1}: ${line}`);
        depth = 0; // reset to avoid cascaded errors for this simple check
    }
});
console.log(`Final depth: ${depth}`);
