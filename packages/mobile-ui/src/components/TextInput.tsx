// packages/mobile-ui/src/components/TextInput.tsx

import React from 'react';
import {
  TextInput as RNTextInput,
  StyleSheet,
  TextInputProps as RNTextInputProps,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { theme } from '../theme';

interface TextInputProps extends RNTextInputProps {
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export const TextInput: React.FC<TextInputProps> = ({
  style,
  inputStyle,
  ...props
}) => {
  return (
    <RNTextInput
      style={[styles.input, inputStyle]}
      placeholderTextColor={theme.colors.gray500}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    width: '100%',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.gray900,
    backgroundColor: theme.colors.white,
  },
});
