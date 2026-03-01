// packages/mobile-ui/src/components/Button.tsx

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  TouchableOpacityProps,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { theme } from '../theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  style,
  textStyle,
  ...props
}) => {
  const buttonStyles = [
    styles.base,
    styles[variant],
    props.disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.textBase,
    styles[`${variant}Text`],
    textStyle,
  ];

  return (
    <TouchableOpacity style={buttonStyles} {...props}>
      <Text style={textStyles}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  textBase: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
  primary: {
    backgroundColor: theme.colors.primary500,
  },
  primaryText: {
    color: theme.colors.white,
  },
  secondary: {
    backgroundColor: theme.colors.gray200,
  },
  secondaryText: {
    color: theme.colors.gray800,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.primary500,
  },
  outlineText: {
    color: theme.colors.primary500,
  },
  disabled: {
    backgroundColor: theme.colors.gray300,
    opacity: 0.7,
  },
});
