/**
 * Shop API Service - Purchase products with coins
 * Students can browse products and purchase them using their coin balance
 */

import { apiClient } from './client';

// ============================================================================
// ENDPOINTS
// ============================================================================

const SHOP_ENDPOINTS = {
  PRODUCTS: '/api/v1/student-profile/product/',
  PRODUCT_DETAIL: (id: number) => `/api/v1/student-profile/product/${id}/`,
  PURCHASE: '/shop/purchase/',
  ORDERS: '/api/v1/student-profile/order/',
  ORDER_DETAIL: (id: number) => `/api/v1/student-profile/order/${id}/`,
};

// ============================================================================
// TYPES
// ============================================================================

export interface ShopProduct {
  id: number;
  name: string;
  description: string | null;
  price: number; // Price in coins
  quantity: number; // Stock available
  photo: string | null; // Image URL
  created_at: string;
}

export interface ShopProductsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ShopProduct[];
}

export interface ShopOrder {
  id: number;
  student: {
    id: number;
    username: string;
    email: string;
  };
  product: {
    id: number;
    name: string;
    price: number;
    photo: string | null;
  };
  price: number; // Price paid in coins
  quantity: number;
  created_at: string;
}

export interface ShopOrdersResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ShopOrder[];
}

export interface PurchaseRequest {
  product_id: number;
}

export interface PurchaseResponse {
  detail: string; // Success message
  new_balance_coins: number; // Updated coin balance
}

export interface PurchaseError {
  detail: string; // Error message
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export const shopApi = {
  /**
   * Get all available products in the shop
   */
  getProducts: async (): Promise<ShopProductsResponse> => {
    const response = await apiClient.get<ShopProductsResponse>(
      SHOP_ENDPOINTS.PRODUCTS
    );
    return response;
  },

  /**
   * Get a single product by ID
   */
  getProduct: async (id: number): Promise<ShopProduct> => {
    const response = await apiClient.get<ShopProduct>(
      SHOP_ENDPOINTS.PRODUCT_DETAIL(id)
    );
    return response;
  },

  /**
   * Purchase a product with coins
   * @throws Error if insufficient coins, out of stock, or product not found
   */
  purchaseProduct: async (productId: number): Promise<PurchaseResponse> => {
    try {
      const response = await apiClient.post<PurchaseResponse>(
        SHOP_ENDPOINTS.PURCHASE,
        { product_id: productId }
      );
      return response;
    } catch (error: any) {
      // Re-throw with error message from backend
      const errorData = error.response?.data as PurchaseError;
      throw new Error(errorData?.detail || 'Purchase failed');
    }
  },

  /**
   * Get purchase history (orders)
   * @param date - Optional date filter (YYYY-MM-DD)
   */
  getOrders: async (date?: string): Promise<ShopOrdersResponse> => {
    const params = date ? { date } : {};
    const response = await apiClient.get<ShopOrdersResponse>(
      SHOP_ENDPOINTS.ORDERS,
      { params }
    );
    return response;
  },

  /**
   * Get a single order by ID
   */
  getOrder: async (id: number): Promise<ShopOrder> => {
    const response = await apiClient.get<ShopOrder>(
      SHOP_ENDPOINTS.ORDER_DETAIL(id)
    );
    return response;
  },

  /**
   * Check if student can afford a product
   */
  canAfford: (product: ShopProduct, coinBalance: number): boolean => {
    return coinBalance >= product.price;
  },

  /**
   * Check if product is in stock
   */
  isInStock: (product: ShopProduct): boolean => {
    return product.quantity > 0;
  },

  /**
   * Get available products (in stock)
   */
  getAvailableProducts: (products: ShopProduct[]): ShopProduct[] => {
    return products.filter(shopApi.isInStock);
  },

  /**
   * Get affordable products for student
   */
  getAffordableProducts: (
    products: ShopProduct[],
    coinBalance: number
  ): ShopProduct[] => {
    return products.filter((p) => shopApi.canAfford(p, coinBalance));
  },

  /**
   * Get products sorted by price (low to high)
   */
  sortByPrice: (products: ShopProduct[], ascending = true): ShopProduct[] => {
    return [...products].sort((a, b) =>
      ascending ? a.price - b.price : b.price - a.price
    );
  },

  /**
   * Calculate total spent from orders
   */
  getTotalSpent: (orders: ShopOrder[]): number => {
    return orders.reduce((total, order) => total + order.price, 0);
  },
};
