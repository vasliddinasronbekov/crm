// apps/student-app-v2/src/screens/CoinsScreen.tsx
/**
 * Coins Screen - Complete coins, shop, and transactions system
 * Updated 2025-11-30: Using new coins and shop APIs
 *
 * Features:
 * - Display total coin balance (calculated from transactions)
 * - View coin transaction history (earned/spent)
 * - Browse and purchase products from shop
 * - Real-time balance updates after purchases
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@eduvoice/mobile-ui';
import {
  coinsApi,
  shopApi,
  type CoinTransaction,
  type ShopProduct,
} from '@eduvoice/mobile-shared';

type TabType = 'shop' | 'transactions';

export const CoinsScreen = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('shop');
  const queryClient = useQueryClient();

  // ===== FETCH COIN TRANSACTIONS =====
  const {
    data: transactionsData,
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: ['coin-transactions'],
    queryFn: () => coinsApi.getTransactions(),
    retry: 2,
  });

  // ===== FETCH SHOP PRODUCTS =====
  const {
    data: productsData,
    isLoading: productsLoading,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['shop-products'],
    queryFn: () => shopApi.getProducts(),
    retry: 2,
    enabled: activeTab === 'shop',
  });

  // ===== PURCHASE MUTATION =====
  const purchaseMutation = useMutation({
    mutationFn: (productId: number) => shopApi.purchaseProduct(productId),
    onSuccess: (data) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['coin-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['shop-products'] });

      Alert.alert(
        t('coins.purchaseSuccess') || 'Success',
        data.detail + `\n${t('coins.newBalance') || 'New balance'}: ${data.new_balance_coins} coins`
      );
    },
    onError: (error: Error) => {
      Alert.alert(
        t('common.error') || 'Error',
        error.message
      );
    },
  });

  // ===== CALCULATE TOTAL COINS =====
  const transactions = transactionsData?.results || [];
  const totalCoins = coinsApi.calculateTotalCoins(transactions);
  const stats = coinsApi.getStatistics(transactions);

  // ===== HANDLE REFRESH =====
  const handleRefresh = () => {
    refetchTransactions();
    if (activeTab === 'shop') {
      refetchProducts();
    }
  };

  // ===== HANDLE PURCHASE =====
  const handlePurchase = (product: ShopProduct) => {
    // Check if can afford
    if (!shopApi.canAfford(product, totalCoins)) {
      Alert.alert(
        t('coins.insufficientCoins') || 'Insufficient Coins',
        t('coins.insufficientCoinsMessage', { needed: product.price, have: totalCoins }) ||
          `You need ${product.price} coins but only have ${totalCoins} coins.`
      );
      return;
    }

    // Check if in stock
    if (!shopApi.isInStock(product)) {
      Alert.alert(
        t('coins.outOfStock') || 'Out of Stock',
        t('coins.outOfStockMessage') || 'This product is currently out of stock.'
      );
      return;
    }

    // Confirm purchase
    Alert.alert(
      t('coins.confirmPurchase') || 'Confirm Purchase',
      t('coins.confirmPurchaseMessage', { name: product.name, price: product.price }) ||
        `Purchase ${product.name} for ${product.price} coins?`,
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('coins.purchase') || 'Buy',
          onPress: () => purchaseMutation.mutate(product.id),
        },
      ]
    );
  };

  const isRefreshing =
    transactionsLoading || (activeTab === 'shop' ? productsLoading : false);

  // ===== LOADING STATE =====
  if (transactionsLoading && !transactionsData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
        <Text style={styles.loadingText}>{t('coins.loading') || 'Loading...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary500}
          />
        }
      >
        {/* ===== BALANCE CARD ===== */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.coinIconContainer}>
              <MaterialCommunityIcons name="cash-multiple" size={40} color={theme.colors.warning500} />
            </View>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>{t('coins.yourBalance') || 'Your Balance'}</Text>
              <Text style={styles.balanceValue}>{totalCoins.toLocaleString()}</Text>
              <Text style={styles.balanceSubtext}>{t('coins.coins') || 'Coins'}</Text>
            </View>
          </View>

          {/* ===== STATS ROW ===== */}
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="plus-circle" size={20} color={theme.colors.success500} />
                <Text style={styles.statLabel}>{t('coins.earned') || 'Earned'}</Text>
                <Text style={styles.statValue}>{stats.totalEarned.toLocaleString()}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="minus-circle" size={20} color={theme.colors.error500} />
                <Text style={styles.statLabel}>{t('coins.spent') || 'Spent'}</Text>
                <Text style={styles.statValue}>{stats.totalSpent.toLocaleString()}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="history" size={20} color={theme.colors.info500} />
                <Text style={styles.statLabel}>{t('coins.total') || 'Total'}</Text>
                <Text style={styles.statValue}>{transactions.length}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ===== TABS ===== */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'shop' && styles.tabActive]}
            onPress={() => setActiveTab('shop')}
          >
            <MaterialCommunityIcons
              name="shopping"
              size={20}
              color={activeTab === 'shop' ? theme.colors.primary500 : theme.colors.gray600}
            />
            <Text style={[styles.tabText, activeTab === 'shop' && styles.tabTextActive]}>
              {t('coins.shop') || 'Shop'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'transactions' && styles.tabActive]}
            onPress={() => setActiveTab('transactions')}
          >
            <MaterialCommunityIcons
              name="history"
              size={20}
              color={activeTab === 'transactions' ? theme.colors.primary500 : theme.colors.gray600}
            />
            <Text style={[styles.tabText, activeTab === 'transactions' && styles.tabTextActive]}>
              {t('coins.transactions') || 'Transactions'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ===== CONTENT ===== */}
        {activeTab === 'shop' ? (
          <ShopTab
            products={productsData?.results || []}
            loading={productsLoading}
            totalCoins={totalCoins}
            onPurchase={handlePurchase}
            isPurchasing={purchaseMutation.isPending}
          />
        ) : (
          <TransactionsTab
            transactions={transactions}
            loading={transactionsLoading}
          />
        )}
      </ScrollView>
    </View>
  );
};

// ============================================================================
// SHOP TAB COMPONENT
// ============================================================================

interface ShopTabProps {
  products: ShopProduct[];
  loading: boolean;
  totalCoins: number;
  onPurchase: (product: ShopProduct) => void;
  isPurchasing: boolean;
}

const ShopTab: React.FC<ShopTabProps> = ({
  products,
  loading,
  totalCoins,
  onPurchase,
  isPurchasing,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="shopping" size={80} color={theme.colors.gray400} />
        <Text style={styles.emptyTitle}>{t('coins.noItems') || 'No Products'}</Text>
        <Text style={styles.emptyMessage}>
          {t('coins.noItemsMessage') || 'No products available in the shop right now.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.shopContainer}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          canAfford={shopApi.canAfford(product, totalCoins)}
          onPurchase={() => onPurchase(product)}
          isPurchasing={isPurchasing}
        />
      ))}
    </View>
  );
};

// ============================================================================
// PRODUCT CARD COMPONENT
// ============================================================================

interface ProductCardProps {
  product: ShopProduct;
  canAfford: boolean;
  onPurchase: () => void;
  isPurchasing: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  canAfford,
  onPurchase,
  isPurchasing,
}) => {
  const { t } = useTranslation();
  const isInStock = shopApi.isInStock(product);

  return (
    <View style={styles.productCard}>
      {/* Product Image */}
      <View style={styles.productImageContainer}>
        {product.photo ? (
          <Image source={{ uri: product.photo }} style={styles.productImage} />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <MaterialCommunityIcons name="package-variant" size={48} color={theme.colors.gray400} />
          </View>
        )}
      </View>

      {/* Product Details */}
      <View style={styles.productDetails}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        {product.description && (
          <Text style={styles.productDescription} numberOfLines={2}>
            {product.description}
          </Text>
        )}

        {/* Stock Status */}
        <View style={styles.stockContainer}>
          <MaterialCommunityIcons
            name={isInStock ? 'check-circle' : 'alert-circle'}
            size={16}
            color={isInStock ? theme.colors.success500 : theme.colors.error500}
          />
          <Text
            style={[
              styles.stockText,
              { color: isInStock ? theme.colors.success500 : theme.colors.error500 },
            ]}
          >
            {isInStock
              ? `${product.quantity} ${t('coins.inStock') || 'in stock'}`
              : t('coins.outOfStock') || 'Out of stock'}
          </Text>
        </View>

        {/* Price and Buy Button */}
        <View style={styles.productFooter}>
          <View style={styles.priceContainer}>
            <MaterialCommunityIcons name="cash-multiple" size={24} color={theme.colors.warning500} />
            <Text style={styles.priceText}>{product.price.toLocaleString()}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.buyButton,
              (!canAfford || !isInStock || isPurchasing) && styles.buyButtonDisabled,
            ]}
            onPress={onPurchase}
            disabled={!canAfford || !isInStock || isPurchasing}
          >
            {isPurchasing ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <>
                <MaterialCommunityIcons name="cart" size={18} color={theme.colors.white} />
                <Text style={styles.buyButtonText}>{t('coins.buy') || 'Buy'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// TRANSACTIONS TAB COMPONENT
// ============================================================================

interface TransactionsTabProps {
  transactions: CoinTransaction[];
  loading: boolean;
}

const TransactionsTab: React.FC<TransactionsTabProps> = ({ transactions, loading }) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary500} />
      </View>
    );
  }

  if (transactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="history" size={80} color={theme.colors.gray400} />
        <Text style={styles.emptyTitle}>{t('coins.noTransactions') || 'No Transactions'}</Text>
        <Text style={styles.emptyMessage}>
          {t('coins.noTransactionsMessage') || 'No coin transactions yet.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.transactionsContainer}>
      {transactions.map((transaction) => (
        <TransactionCard key={transaction.id} transaction={transaction} />
      ))}
    </View>
  );
};

// ============================================================================
// TRANSACTION CARD COMPONENT
// ============================================================================

interface TransactionCardProps {
  transaction: CoinTransaction;
}

const TransactionCard: React.FC<TransactionCardProps> = ({ transaction }) => {
  const isEarned = transaction.coin > 0;
  const amount = Math.abs(transaction.coin);

  return (
    <View style={styles.transactionCard}>
      <View
        style={[
          styles.transactionIcon,
          {
            backgroundColor: isEarned ? theme.colors.success100 : theme.colors.error100,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={isEarned ? 'plus' : 'minus'}
          size={24}
          color={isEarned ? theme.colors.success500 : theme.colors.error500}
        />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionTitle}>{transaction.reason}</Text>
        <Text style={styles.transactionDate}>
          {new Date(transaction.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <Text
        style={[
          styles.transactionAmount,
          { color: isEarned ? theme.colors.success500 : theme.colors.error500 },
        ]}
      >
        {isEarned ? '+' : '-'}
        {amount.toLocaleString()}
      </Text>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    ...theme.typography.body,
    marginTop: theme.spacing.md,
    color: theme.colors.gray600,
  },
  centerContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },

  // ===== BALANCE CARD =====
  balanceCard: {
    backgroundColor: theme.colors.white,
    margin: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: 16,
    ...theme.shadows.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  coinIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.warning50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginBottom: 4,
  },
  balanceValue: {
    ...theme.typography.h1,
    color: theme.colors.warning500,
    fontWeight: '700',
  },
  balanceSubtext: {
    ...theme.typography.body,
    color: theme.colors.gray700,
  },
  statsContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    paddingTop: theme.spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
    marginTop: 4,
    fontSize: 12,
  },
  statValue: {
    ...theme.typography.h4,
    color: theme.colors.gray900,
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.gray200,
  },

  // ===== TABS =====
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: 12,
    padding: 4,
    ...theme.shadows.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    gap: theme.spacing.xs,
  },
  tabActive: {
    backgroundColor: theme.colors.primary50,
  },
  tabText: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    fontWeight: '500',
  },
  tabTextActive: {
    color: theme.colors.primary500,
    fontWeight: '600',
  },

  // ===== SHOP =====
  shopContainer: {
    padding: theme.spacing.md,
  },
  productCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  productImageContainer: {
    width: '100%',
    height: 180,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray100,
  },
  productDetails: {
    padding: theme.spacing.md,
  },
  productName: {
    ...theme.typography.h4,
    color: theme.colors.gray900,
    marginBottom: 4,
  },
  productDescription: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    marginBottom: theme.spacing.sm,
    lineHeight: 20,
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  stockText: {
    ...theme.typography.caption,
    fontSize: 13,
    fontWeight: '500',
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  priceText: {
    ...theme.typography.h3,
    color: theme.colors.warning500,
    fontWeight: '700',
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary500,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    gap: theme.spacing.xs,
  },
  buyButtonDisabled: {
    backgroundColor: theme.colors.gray400,
    opacity: 0.6,
  },
  buyButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },

  // ===== TRANSACTIONS =====
  transactionsContainer: {
    padding: theme.spacing.md,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    ...theme.typography.body,
    color: theme.colors.gray900,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionDate: {
    ...theme.typography.caption,
    color: theme.colors.gray600,
  },
  transactionAmount: {
    ...theme.typography.h4,
    fontWeight: '700',
  },

  // ===== EMPTY STATE =====
  emptyContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.h2,
    marginTop: theme.spacing.md,
    color: theme.colors.gray700,
  },
  emptyMessage: {
    ...theme.typography.body,
    marginTop: theme.spacing.sm,
    color: theme.colors.gray600,
    textAlign: 'center',
  },
});
