import React, { forwardRef } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';

/**
 * Text e TextInput do app com a fonte Manrope (mesma do web).
 * O React Native não escolhe a variação pelo `fontWeight` quando a fonte é customizada: aqui o peso
 * pedido no estilo vira a família correspondente (carregada em App.tsx com `useFonts`).
 */
export const FAMILIAS_MANROPE = {
  400: 'Manrope_400Regular',
  500: 'Manrope_500Medium',
  600: 'Manrope_600SemiBold',
  700: 'Manrope_700Bold',
  800: 'Manrope_800ExtraBold',
} as const;

export function familiaPorPeso(peso: unknown): string {
  if (peso === 'bold') return FAMILIAS_MANROPE[700];
  const n = Number(peso);
  if (!Number.isFinite(n)) return FAMILIAS_MANROPE[400];
  if (n >= 800) return FAMILIAS_MANROPE[800];
  if (n >= 700) return FAMILIAS_MANROPE[700];
  if (n >= 600) return FAMILIAS_MANROPE[600];
  if (n >= 500) return FAMILIAS_MANROPE[500];
  return FAMILIAS_MANROPE[400];
}

function estiloComFonte(style: TextProps['style'], pesoPadrao: number) {
  const plano = StyleSheet.flatten(style) ?? {};
  if (plano.fontFamily) return style;
  // fontWeight 'normal' evita o "negrito sintético" por cima da família já encorpada.
  return [style, { fontFamily: familiaPorPeso(plano.fontWeight ?? pesoPadrao), fontWeight: 'normal' as const }];
}

export const Text = forwardRef<RNText, TextProps>(({ style, ...props }, ref) => (
  <RNText ref={ref} style={estiloComFonte(style, 400)} {...props} />
));
Text.displayName = 'AppText';

export const TextInput = forwardRef<RNTextInput, TextInputProps>(({ style, ...props }, ref) => (
  <RNTextInput ref={ref} style={estiloComFonte(style, 500)} {...props} />
));
TextInput.displayName = 'AppTextInput';
