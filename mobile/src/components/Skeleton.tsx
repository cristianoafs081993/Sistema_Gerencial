import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../constants/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Bloco de carregamento com pulso suave (equivalente ao Skeleton do web). */
export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 14, radius = 8, style }) => {
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[{ width, height, borderRadius: radius, opacity, backgroundColor: colors.tagBg }, style]} />;
};

/** Esqueleto de um cartão de lista (título, texto, valores e barra). */
export const CardSkeleton: React.FC = () => (
  <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={styles.row}>
      <Skeleton width={40} height={40} radius={12} />
      <View style={styles.grow}>
        <Skeleton width="40%" height={11} />
        <Skeleton width="75%" height={16} style={styles.gapTop} />
      </View>
      <Skeleton width={58} height={22} radius={11} />
    </View>
    <Skeleton height={12} style={styles.gapTopLg} />
    <Skeleton width="70%" height={12} style={styles.gapTop} />
    <View style={[styles.row, styles.between, styles.gapTopLg]}>
      <Skeleton width="38%" height={22} />
      <Skeleton width="38%" height={22} />
    </View>
    <Skeleton height={5} radius={3} style={styles.gapTopLg} />
  </View>
);

/** Lista de esqueletos com aviso de acessibilidade. */
export const ListSkeleton: React.FC<{ count?: number; label: string }> = ({ count = 4, label }) => (
  <View accessibilityRole="progressbar" accessibilityLabel={label}>
    {Array.from({ length: count }).map((_, index) => (
      <CardSkeleton key={index} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 17,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { justifyContent: 'space-between' },
  grow: { flex: 1 },
  gapTop: { marginTop: 8 },
  gapTopLg: { marginTop: 16 },
});
