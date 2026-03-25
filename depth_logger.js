
import fs from 'fs';

const content = fs.readFileSync('d:/WorkStation/cryptobot/src/components/Chart.tsx', 'utf8');
const lines = content.split('\n');

let depth = 0;
lines.forEach((line, i) => {
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    depth += opens - closes;
    if (i % 100 === 0 || i > 1600) {
        console.log(`Line ${i + 1} depth: ${depth}`);
    }
});
