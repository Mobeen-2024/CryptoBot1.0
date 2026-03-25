
import fs from 'fs';

const content = fs.readFileSync('d:/WorkStation/cryptobot/src/components/Chart.tsx', 'utf8');
const lines = content.split('\n');

let depth = 0;
lines.forEach((line, i) => {
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    depth += opens - closes;
    if (line.includes('useEffect') || line.includes('}, [') || line.includes('return (') || i > 1610) {
        console.log(`Line ${i + 1} depth: ${depth} | ${line.trim()}`);
    }
});
