// packages/mobile-ui/src/components/BalanceCard.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { Button } from './Button';

interface BalanceCardProps {
  balance: number;
  currency?: string;
  onAddMoney?: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  currency = 'UZS',
  onAddMoney,
}) => {
  const formattedBalance = new Intl.NumberFormat('en-US').format(balance);

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.label}>Your Balance</Text>
        <Text style={styles.balance}>
          {formattedBalance} <Text style={styles.currency}>{currency}</Text>
        </Text>
      </View>
      {onAddMoney && (
        <Button
          title="+ Add Money"
          onPress={onAddMoney}
          style={styles.button}
          textStyle={styles.buttonText}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary500,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  label: {
    fontSize: 16,
    color: theme.colors.primary100,
    marginBottom: theme.spacing.xs,
  },
  balance: {
    fontSize: 36,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  currency: {
    fontSize: 20,
    fontWeight: 'normal',
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  buttonText: {
    color: theme.colors.white,
    fontWeight: 'bold',
  },
});
