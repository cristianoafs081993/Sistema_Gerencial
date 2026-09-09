import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Text as SvgText, G, Rect } from 'react-native-svg';
import { colors } from '../constants/theme';

export interface ChartMonthItem {
  month: string;
  liquidado: number;
  pago: number;
}

interface ExecutionChartProps {
  data?: ChartMonthItem[];
}

const defaultMonths: ChartMonthItem[] = [
  { month: 'Mar', liquidado: 210, pago: 190 },
  { month: 'Abr', liquidado: 280, pago: 250 },
  { month: 'Mai', liquidado: 260, pago: 250 },
  { month: 'Jun', liquidado: 340, pago: 310 },
  { month: 'Jul', liquidado: 300, pago: 295 },
  { month: 'Ago', liquidado: 390, pago: 370 },
];

export const ExecutionChart: React.FC<ExecutionChartProps> = ({
  data = defaultMonths,
}) => {
  const monthsToRender = data.length === 6 ? data : defaultMonths;

  // Max scale is 400 (or higher if real data exceeds it)
  const highestVal = Math.max(
    400,
    ...monthsToRender.map((m) => Math.max(m.liquidado, m.pago))
  );
  const maxScale = Math.ceil(highestVal / 100) * 100;
  const midScale = maxScale / 2;

  const baselineY = 115;
  const topY = 15;
  const chartHeight = baselineY - topY; // 100

  const getBarMetrics = (value: number) => {
    const clampedVal = Math.max(0, Math.min(value, maxScale));
    const h = Math.max(4, (clampedVal / maxScale) * chartHeight);
    const y = baselineY - h;
    return { h, y };
  };

  const xPositions = [
    { blue: 39, light: 53, text: 51 },
    { blue: 83, light: 97, text: 95 },
    { blue: 127, light: 141, text: 139 },
    { blue: 171, light: 185, text: 183 },
    { blue: 215, light: 229, text: 227 },
    { blue: 259, light: 273, text: 271 },
  ];

  return (
    <View style={styles.card}>
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.blue }]} />
          <Text style={styles.legendText}>Liquidado</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.blueLight }]} />
          <Text style={styles.legendText}>Pago</Text>
        </View>
      </View>

      {/* SVG Chart */}
      <View style={styles.chartContainer}>
        <Svg width="100%" height={150} viewBox="0 0 310 145">
          {/* Grid lines */}
          <Line
            x1="29"
            y1="15"
            x2="304"
            y2="15"
            stroke="#edf0f6"
            strokeDasharray="3 3"
          />
          <Line
            x1="29"
            y1="65"
            x2="304"
            y2="65"
            stroke="#edf0f6"
            strokeDasharray="3 3"
          />
          <Line
            x1="29"
            y1="115"
            x2="304"
            y2="115"
            stroke="#edf0f6"
            strokeDasharray="3 3"
          />

          {/* Y Axis Labels */}
          <SvgText x="0" y="19" fontSize="12" fill="#7b879b">
            {maxScale}
          </SvgText>
          <SvgText x="0" y="69" fontSize="12" fill="#7b879b">
            {midScale}
          </SvgText>
          <SvgText x="15" y="119" fontSize="12" fill="#7b879b">
            0
          </SvgText>

          {/* Liquidado Bars (#214bc6) */}
          <G fill={colors.blue}>
            {monthsToRender.map((m, idx) => {
              const pos = xPositions[idx];
              const { h, y } = getBarMetrics(m.liquidado);
              return (
                <Rect
                  key={`liq-${idx}`}
                  x={pos.blue}
                  y={y}
                  width="11"
                  height={h}
                  rx="3"
                />
              );
            })}
          </G>

          {/* Pago Bars (#afc4ff) */}
          <G fill={colors.blueLight}>
            {monthsToRender.map((m, idx) => {
              const pos = xPositions[idx];
              const { h, y } = getBarMetrics(m.pago);
              return (
                <Rect
                  key={`pag-${idx}`}
                  x={pos.light}
                  y={y}
                  width="11"
                  height={h}
                  rx="3"
                />
              );
            })}
          </G>

          {/* Month Labels */}
          <G textAnchor="middle">
            {monthsToRender.map((m, idx) => {
              const pos = xPositions[idx];
              return (
                <SvgText
                  key={`lbl-${idx}`}
                  x={pos.text}
                  y="138"
                  fontSize="12"
                  fill="#7b879b"
                >
                  {m.month}
                </SvgText>
              );
            })}
          </G>
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 16,
    marginTop: 4,
  },
  legend: {
    flexDirection: 'row',
    gap: 17,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: colors.muted,
  },
  chartContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
