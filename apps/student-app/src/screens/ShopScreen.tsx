import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import apiService from '../services/api';

interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  image?: string;
  category?: string;
}

interface CoinBalance {
  balance: number;
  total_earned: number;
  total_spent: number;
}

interface Order {
  id: number;
  product: {
    id: number;
    name: string;
  };
  quantity: number;
  total_cost: number;
  status: string;
  created_at: string;
}

export default function ShopScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [coinBalance, setCoinBalance] = useState<CoinBalance | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [activeTab, setActiveTab] = useState<'shop' | 'orders'>('shop');

  useEffect(() => {
    loadShopData();
  }, []);

  const loadShopData = async () => {
    try {
      const [productsData, coinsData, ordersData] = await Promise.all([
        apiService.getShopProducts(),
        apiService.getMyCoins(),
        apiService.getMyOrders(),
      ]);

      setProducts(productsData.results || productsData || []);
      setCoinBalance(coinsData);
      setOrders(ordersData.results || ordersData || []);
    } catch (error: any) {
      console.error('Failed to load shop data:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to load shop data.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadShopData();
  };

  const handlePurchase = async () => {
    if (!selectedProduct) return;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (qty > selectedProduct.stock) {
      Alert.alert('Error', 'Not enough stock available');
      return;
    }

    const totalCost = selectedProduct.price * qty;
    if (totalCost > (coinBalance?.balance || 0)) {
      Alert.alert('Insufficient Coins', 'You do not have enough coins for this purchase');
      return;
    }

    Alert.alert(
      'Confirm Purchase',
      `Purchase ${qty} x ${selectedProduct.name} for ${totalCost} coins?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Purchase',
          onPress: async () => {
            setIsPurchasing(true);
            try {
              await apiService.purchaseProduct(selectedProduct.id, qty);
              Alert.alert('Success', 'Purchase completed successfully!');
              setModalVisible(false);
              setQuantity('1');
              loadShopData();
            } catch (error: any) {
              console.error('Failed to purchase:', error);
              Alert.alert(
                'Error',
                error?.response?.data?.message || 'Failed to complete purchase.'
              );
            } finally {
              setIsPurchasing(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getOrderStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#94a3b8';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Loading shop...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Coin Balance Header */}
      <LinearGradient
        colors={['rgba(245, 158, 11, 0.2)', 'rgba(245, 158, 11, 0.05)']}
        style={styles.balanceHeader}
      >
        <View style={styles.balanceContent}>
          <View style={styles.balanceInfo}>
            <Text style={styles.balanceLabel}>Your Balance</Text>
            <Text style={styles.balanceValue}>
              {coinBalance?.balance || 0} 🪙
            </Text>
          </View>
          <View style={styles.balanceStats}>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatLabel}>Earned</Text>
              <Text style={styles.balanceStatValue}>
                {coinBalance?.total_earned || 0}
              </Text>
            </View>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatLabel}>Spent</Text>
              <Text style={styles.balanceStatValue}>
                {coinBalance?.total_spent || 0}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shop' && styles.tabActive]}
          onPress={() => setActiveTab('shop')}
        >
          <LinearGradient
            colors={
              activeTab === 'shop'
                ? ['#00d4ff', '#0099cc']
                : ['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']
            }
            style={styles.tabGradient}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'shop' && styles.tabTextActive,
              ]}
            >
              🛍️ Shop
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
          onPress={() => setActiveTab('orders')}
        >
          <LinearGradient
            colors={
              activeTab === 'orders'
                ? ['#00d4ff', '#0099cc']
                : ['rgba(0, 212, 255, 0.1)', 'rgba(0, 212, 255, 0.05)']
            }
            style={styles.tabGradient}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'orders' && styles.tabTextActive,
              ]}
            >
              📦 Orders ({orders.length})
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#00d4ff"
            colors={['#00d4ff']}
          />
        }
      >
        {activeTab === 'shop' ? (
          // Products Grid
          <>
            {products.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🛒</Text>
                <Text style={styles.emptyText}>No products available</Text>
              </View>
            ) : (
              <View style={styles.productsGrid}>
                {products.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.productCard}
                    onPress={() => {
                      setSelectedProduct(product);
                      setModalVisible(true);
                    }}
                  >
                    <LinearGradient
                      colors={[
                        'rgba(0, 212, 255, 0.1)',
                        'rgba(0, 212, 255, 0.05)',
                      ]}
                      style={styles.productGradient}
                    >
                      {product.image ? (
                        <Image
                          source={{ uri: product.image }}
                          style={styles.productImage}
                        />
                      ) : (
                        <View style={styles.productImagePlaceholder}>
                          <Text style={styles.productImageIcon}>🎁</Text>
                        </View>
                      )}
                      <View style={styles.productInfo}>
                        <Text style={styles.productName} numberOfLines={2}>
                          {product.name}
                        </Text>
                        <View style={styles.productFooter}>
                          <View style={styles.priceContainer}>
                            <Text style={styles.productPrice}>
                              {product.price} 🪙
                            </Text>
                          </View>
                          {product.stock <= 5 && product.stock > 0 && (
                            <Text style={styles.lowStock}>
                              Only {product.stock} left!
                            </Text>
                          )}
                          {product.stock === 0 && (
                            <Text style={styles.outOfStock}>Out of stock</Text>
                          )}
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        ) : (
          // Orders List
          <>
            {orders.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📦</Text>
                <Text style={styles.emptyText}>No orders yet</Text>
              </View>
            ) : (
              orders.map((order) => (
                <View key={order.id} style={styles.orderCard}>
                  <LinearGradient
                    colors={[
                      'rgba(0, 212, 255, 0.1)',
                      'rgba(0, 212, 255, 0.05)',
                    ]}
                    style={styles.orderGradient}
                  >
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderProduct}>
                        {order.product.name}
                      </Text>
                      <View
                        style={[
                          styles.orderStatusBadge,
                          {
                            borderColor: getOrderStatusColor(order.status),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.orderStatusText,
                            { color: getOrderStatusColor(order.status) },
                          ]}
                        >
                          {order.status}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.orderDetails}>
                      <Text style={styles.orderDetail}>
                        Quantity: {order.quantity}
                      </Text>
                      <Text style={styles.orderDetail}>
                        Total: {order.total_cost} 🪙
                      </Text>
                      <Text style={styles.orderDetail}>
                        Date: {formatDate(order.created_at)}
                      </Text>
                    </View>
                  </LinearGradient>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Product Details Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#1e293b', '#0f172a']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Product Details</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {selectedProduct && (
                <ScrollView style={styles.modalBody}>
                  {selectedProduct.image ? (
                    <Image
                      source={{ uri: selectedProduct.image }}
                      style={styles.modalImage}
                    />
                  ) : (
                    <View style={styles.modalImagePlaceholder}>
                      <Text style={styles.modalImageIcon}>🎁</Text>
                    </View>
                  )}

                  <Text style={styles.modalProductName}>
                    {selectedProduct.name}
                  </Text>

                  {selectedProduct.description && (
                    <Text style={styles.modalProductDescription}>
                      {selectedProduct.description}
                    </Text>
                  )}

                  <View style={styles.modalDetails}>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Price</Text>
                      <Text style={styles.modalDetailValue}>
                        {selectedProduct.price} 🪙
                      </Text>
                    </View>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Available</Text>
                      <Text style={styles.modalDetailValue}>
                        {selectedProduct.stock} in stock
                      </Text>
                    </View>
                    {selectedProduct.category && (
                      <View style={styles.modalDetailRow}>
                        <Text style={styles.modalDetailLabel}>Category</Text>
                        <Text style={styles.modalDetailValue}>
                          {selectedProduct.category}
                        </Text>
                      </View>
                    )}
                  </View>

                  {selectedProduct.stock > 0 && (
                    <>
                      <View style={styles.quantityContainer}>
                        <Text style={styles.quantityLabel}>Quantity</Text>
                        <View style={styles.quantityControls}>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => {
                              const current = parseInt(quantity) || 1;
                              if (current > 1) {
                                setQuantity((current - 1).toString());
                              }
                            }}
                          >
                            <Text style={styles.quantityButtonText}>−</Text>
                          </TouchableOpacity>
                          <TextInput
                            style={styles.quantityInput}
                            value={quantity}
                            onChangeText={setQuantity}
                            keyboardType="number-pad"
                          />
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => {
                              const current = parseInt(quantity) || 1;
                              if (current < selectedProduct.stock) {
                                setQuantity((current + 1).toString());
                              }
                            }}
                          >
                            <Text style={styles.quantityButtonText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.totalContainer}>
                        <Text style={styles.totalLabel}>Total Cost</Text>
                        <Text style={styles.totalValue}>
                          {selectedProduct.price * (parseInt(quantity) || 1)} 🪙
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.purchaseButton}
                        onPress={handlePurchase}
                        disabled={isPurchasing}
                      >
                        <LinearGradient
                          colors={['#00d4ff', '#0099cc']}
                          style={styles.purchaseGradient}
                        >
                          {isPurchasing ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.purchaseText}>
                              Purchase Now
                            </Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )}

                  {selectedProduct.stock === 0 && (
                    <View style={styles.outOfStockBanner}>
                      <Text style={styles.outOfStockBannerText}>
                        This product is currently out of stock
                      </Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 16,
  },
  balanceHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.2)',
  },
  balanceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#F59E0B',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  balanceStats: {
    flexDirection: 'row',
    gap: 20,
  },
  balanceStat: {
    alignItems: 'center',
  },
  balanceStatLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  balanceStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  tabsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabActive: {},
  tabGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#fff',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productCard: {
    width: '48%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  productGradient: {
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  productImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImageIcon: {
    fontSize: 48,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    minHeight: 36,
  },
  productFooter: {
    gap: 4,
  },
  priceContainer: {},
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  lowStock: {
    fontSize: 10,
    color: '#F59E0B',
  },
  outOfStock: {
    fontSize: 10,
    color: '#EF4444',
  },
  orderCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  orderGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderProduct: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  orderStatusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderDetails: {
    gap: 4,
  },
  orderDetail: {
    fontSize: 13,
    color: '#94a3b8',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalClose: {
    fontSize: 28,
    color: '#94a3b8',
    fontWeight: '300',
  },
  modalBody: {
    maxHeight: 600,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalImagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalImageIcon: {
    fontSize: 80,
  },
  modalProductName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  modalProductDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalDetails: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  modalDetailLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  modalDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  quantityContainer: {
    marginBottom: 16,
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 24,
    color: '#00d4ff',
    fontWeight: '300',
  },
  quantityInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  purchaseButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  purchaseGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  purchaseText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  outOfStockBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  outOfStockBannerText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
});
