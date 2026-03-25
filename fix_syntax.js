import fs from 'fs';

const filePath = 'd:/WorkStation/cryptobot/src/components/Chart.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The previous script replaced "(chart as any).addCandlestickSeries" 
// with "chart.addSeries(CandlestickSeries", resulting in "chart.addSeries(CandlestickSeries({..."
// which is missing a comma and causes unbalanced parentheses.
// This fixes it to "chart.addSeries(CandlestickSeries, {..."
content = content.replace(/chart\.addSeries\(CandlestickSeries\(/g, 'chart.addSeries(CandlestickSeries, (');
content = content.replace(/chart\.addSeries\(CandlestickSeries\{/g, 'chart.addSeries(CandlestickSeries, {');

content = content.replace(/chart\.addSeries\(LineSeries\(/g, 'chart.addSeries(LineSeries, (');
content = content.replace(/chart\.addSeries\(LineSeries\{/g, 'chart.addSeries(LineSeries, {');

content = content.replace(/chart\.addSeries\(AreaSeries\(/g, 'chart.addSeries(AreaSeries, (');
content = content.replace(/chart\.addSeries\(AreaSeries\{/g, 'chart.addSeries(AreaSeries, {');

content = content.replace(/chart\.addSeries\(HistogramSeries\(/g, 'chart.addSeries(HistogramSeries, (');
content = content.replace(/chart\.addSeries\(HistogramSeries\{/g, 'chart.addSeries(HistogramSeries, {');

// Wait! Sometimes there is a space before the `{` in `add<Type>Series ({` ?
// Let's just use a more robust regex if needed. Let's do a catch-all for `TypeSeries` followed by `(` or space or `{`
// Actually, in the original replace, it matched exactly `addCandlestickSeries` with NO trailing `(`.
// So if the code had `addCandlestickSeries({`, it became `chart.addSeries(CandlestickSeries({`
// Therefore, the text literally has `CandlestickSeries({` or `CandlestickSeries (`.
// Let's replace `CandlestickSeries\(` with `CandlestickSeries, ` but wait, `(` is `({` so if we replace `(` we need to put it back?
// No, if the original was `addCandlestickSeries({`, it became `CandlestickSeries({`.
// We want `CandlestickSeries, {`.
// If the original was `addCandlestickSeries ({`, it was not matched? Actually my previous regex was `addCandlestickSeries/g` so it matched `addCandlestickSeries`.
// Let's fix it properly:

content = content.replace(/chart\.addSeries\(CandlestickSeries\(/g, 'chart.addSeries(CandlestickSeries, ('); // if double parenthesis
content = content.replace(/chart\.addSeries\(CandlestickSeries\{/g, 'chart.addSeries(CandlestickSeries, {');
content = content.replace(/chart\.addSeries\(CandlestickSeries \(/g, 'chart.addSeries(CandlestickSeries, (');
content = content.replace(/chart\.addSeries\(CandlestickSeries \{/g, 'chart.addSeries(CandlestickSeries, {');

content = content.replace(/chart\.addSeries\(LineSeries\(/g, 'chart.addSeries(LineSeries, (');
content = content.replace(/chart\.addSeries\(LineSeries\{/g, 'chart.addSeries(LineSeries, {');
content = content.replace(/chart\.addSeries\(LineSeries \(/g, 'chart.addSeries(LineSeries, (');
content = content.replace(/chart\.addSeries\(LineSeries \{/g, 'chart.addSeries(LineSeries, {');

content = content.replace(/chart\.addSeries\(AreaSeries\(/g, 'chart.addSeries(AreaSeries, (');
content = content.replace(/chart\.addSeries\(AreaSeries\{/g, 'chart.addSeries(AreaSeries, {');
content = content.replace(/chart\.addSeries\(AreaSeries \(/g, 'chart.addSeries(AreaSeries, (');
content = content.replace(/chart\.addSeries\(AreaSeries \{/g, 'chart.addSeries(AreaSeries, {');

content = content.replace(/chart\.addSeries\(HistogramSeries\(/g, 'chart.addSeries(HistogramSeries, (');
content = content.replace(/chart\.addSeries\(HistogramSeries\{/g, 'chart.addSeries(HistogramSeries, {');
content = content.replace(/chart\.addSeries\(HistogramSeries \(/g, 'chart.addSeries(HistogramSeries, (');
content = content.replace(/chart\.addSeries\(HistogramSeries \{/g, 'chart.addSeries(HistogramSeries, {');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed syntax errors in Chart.tsx');
