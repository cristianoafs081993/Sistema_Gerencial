import React from 'react';
import { Image, StyleProp, ImageStyle } from 'react-native';

// Logo oficial do SIAGES (mesmo arquivo do web: public/logo-transparent.png)
const logoSource = require('../../assets/logo.png');

interface BrandLogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 32, style }) => (
  <Image
    source={logoSource}
    style={[{ width: size, height: size }, style]}
    resizeMode="contain"
    accessibilityLabel="Logotipo do SIAGES"
  />
);
