import fs from 'fs';

const filePath = 'd:/WorkStation/cryptobot/src/components/Chart.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The prev script accidentally created `...Series, ({` instead of `...Series, {`
// Let's replace `, ({` with `, {` for all instances
content = content.replace(/CandlestickSeries, \(\{/g, 'CandlestickSeries, {');
content = content.replace(/LineSeries, \(\{/g, 'LineSeries, {');
content = content.replace(/AreaSeries, \(\{/g, 'AreaSeries, {');
content = content.replace(/HistogramSeries, \(\{/g, 'HistogramSeries, {');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed extra parenthesis in Chart.tsx');
