import fs from 'fs';

const filePath = 'd:/WorkStation/cryptobot/src/components/Chart.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Update imports
content = content.replace(
  "import { createChart, ColorType, UTCTimestamp, IChartApi } from 'lightweight-charts';",
  "import { createChart, ColorType, UTCTimestamp, IChartApi, CandlestickSeries, LineSeries, HistogramSeries, AreaSeries } from 'lightweight-charts';"
);

// Replace series creations
content = content.replace(/\(chart as any\)\.addCandlestickSeries/g, 'chart.addSeries(CandlestickSeries');
content = content.replace(/\(chart as any\)\.addLineSeries/g, 'chart.addSeries(LineSeries');
content = content.replace(/\(chart as any\)\.addAreaSeries/g, 'chart.addSeries(AreaSeries');
content = content.replace(/\(chart as any\)\.addHistogramSeries/g, 'chart.addSeries(HistogramSeries');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated API calls in Chart.tsx');
