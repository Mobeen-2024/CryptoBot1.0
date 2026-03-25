export interface ChartConfig {
  style: 'candle' | 'line';
  candle: {
    bull: { style: 'solid' | 'hollow'; color: string };
    bear: { style: 'solid' | 'hollow'; color: string };
  };
  line: {
    color: string;
    width: number;
  };
  global: {
    background: string;
    gridLines: string;
  };
}

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  style: 'candle',
  candle: {
    bull: { style: 'solid', color: '#00E676' },
    bear: { style: 'solid', color: '#FF1744' }
  },
  line: { color: '#fcd535', width: 2 },
  global: { background: '#0b1622', gridLines: '#2b3139' }
};
