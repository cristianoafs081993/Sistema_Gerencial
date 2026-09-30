import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { colors } from '../constants/theme';
import { FAMILIAS_MANROPE } from './AppText';

interface GaugeChartProps {
  /** Valor atingido (numerador). */
  value: number;
  /** Referência (denominador); o ponteiro marca value/total limitado a 0–100%. */
  total: number;
  label: string;
  /** Linha de apoio sob o percentual (ex.: "sobre o descentralizado"). */
  caption?: string;
  /** Altura do desenho em pixels; a largura acompanha o container. */
  size?: number;
}

// Texto do SVG usa a mesma família Manrope do restante do app (o padrão do SVG no web é serifado).
const FONTE = (peso: 700 | 800) => Platform.select({ default: FAMILIAS_MANROPE[peso] });

const CX = 120;
const CY = 112;
const OUTER = 96;
const INNER = 68;

function ponto(anguloGraus: number, raio: number) {
  const rad = (anguloGraus * Math.PI) / 180;
  return { x: CX + raio * Math.cos(rad), y: CY - raio * Math.sin(rad) };
}

function arco(deGraus: number, ateGraus: number, raioExterno: number, raioInterno: number) {
  const o1 = ponto(deGraus, raioExterno);
  const o2 = ponto(ateGraus, raioExterno);
  const i1 = ponto(ateGraus, raioInterno);
  const i2 = ponto(deGraus, raioInterno);
  const grande = Math.abs(ateGraus - deGraus) > 180 ? 1 : 0;
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${raioExterno} ${raioExterno} 0 ${grande} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${raioInterno} ${raioInterno} 0 ${grande} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ');
}

/** Anima de 0 até o alvo (ease-out) e devolve o valor corrente a cada quadro. */
function useValorAnimado(alvo: number, duracao = 900): number {
  const [valor, setValor] = useState(0);

  useEffect(() => {
    const progresso = new Animated.Value(0);
    const id = progresso.addListener(({ value }) => setValor(alvo * value));
    Animated.timing(progresso, {
      toValue: 1,
      duration: duracao,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => progresso.removeListener(id);
  }, [alvo, duracao]);

  return valor;
}

/** Velocímetro semicircular (escala vermelho → verde), igual ao do painel web. */
export const GaugeChart: React.FC<GaugeChartProps> = ({ value, total, label, caption, size = 136 }) => {
  const pctReal = total > 0 ? (value / total) * 100 : 0;
  const pctLimitado = Math.min(Math.max(pctReal, 0), 100);
  const pct = useValorAnimado(pctLimitado);
  const fracao = pct / 100;

  const anguloPonteiro = 180 - fracao * 180;
  const ponta = ponto(anguloPonteiro, OUTER - 8);
  const gradienteId = `gauge-${label.replace(/\W+/g, '-')}`;
  const preenchido = fracao > 0.004 ? arco(180, anguloPonteiro, OUTER, INNER) : null;
  const textoPct = `${pctReal.toFixed(1).replace('.', ',')}%`;

  return (
    <View style={styles.wrapper} accessible accessibilityRole="image" accessibilityLabel={`${label}: ${textoPct}`}>
      <Svg width="100%" height={size} viewBox="0 0 240 152">
        <Defs>
          <LinearGradient id={gradienteId} gradientUnits="userSpaceOnUse" x1={CX - OUTER} y1={0} x2={CX + OUTER} y2={0}>
            <Stop offset="0%" stopColor="#EF4444" />
            <Stop offset="22%" stopColor="#F97316" />
            <Stop offset="58%" stopColor="#FBBF24" />
            <Stop offset="100%" stopColor="#22C55E" />
          </LinearGradient>
        </Defs>

        <Path d={arco(180, 0, OUTER, INNER)} fill={colors.progressBg} />
        {preenchido ? <Path d={preenchido} fill={`url(#${gradienteId})`} /> : null}

        {[0.25, 0.5, 0.75].map((t) => {
          const angulo = 180 - t * 180;
          const externo = ponto(angulo, OUTER + 1);
          const interno = ponto(angulo, INNER - 1);
          return (
            <Line key={t} x1={externo.x} y1={externo.y} x2={interno.x} y2={interno.y} stroke={colors.white} strokeWidth={1.6} />
          );
        })}

        <SvgText fontFamily={FONTE(700)} x={CX - (OUTER + INNER) / 2} y={CY + 14} fontSize="10" fontWeight="normal" fill={colors.mutedLight} textAnchor="middle">
          0%
        </SvgText>
        <SvgText fontFamily={FONTE(700)} x={CX + (OUTER + INNER) / 2} y={CY + 14} fontSize="10" fontWeight="normal" fill={colors.mutedLight} textAnchor="middle">
          100%
        </SvgText>

        <Line x1={CX} y1={CY} x2={ponta.x} y2={ponta.y} stroke={colors.ink} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={CX} cy={CY} r={7} fill={colors.ink} />
        <Circle cx={CX} cy={CY} r={3} fill={colors.white} />

        <SvgText fontFamily={FONTE(800)} x={CX} y={CY + 40} fontSize="26" fontWeight="normal" fill={colors.ink} textAnchor="middle">
          {`${pct.toFixed(1).replace('.', ',')}%`}
        </SvgText>
      </Svg>
      <Text style={styles.label}>{label}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '800', color: colors.ink, textAlign: 'center', marginTop: 2 },
  caption: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 2 },
});
