/**
 * Shop & E-Commerce Type Definitions
 */

// ============================================================================
// SHOP PRODUCTS
// ============================================================================

export interface ShopProduct {
  id: number;
  name: string;
  description: string;
  product_type: ProductType;
  category: ProductCategory;
  image_url?: string;
  images?: ProductImage[];

  // Pricing
  price_coins: number;
  price_money?: number;
  currency?: string;
  discount_percentage?: number;
  discounted_price?: number;

  // Availability
  is_available: boolean;
  stock_quantity?: number;
  is_unlimited_stock: boolean;
  max_purchase_quantity?: number;

  // Requirements
  required_level?: number;
  required_badges?: number[];
  required_achievements?: number[];

  // Statistics
  purchase_count: number;
  rating_average?: number;
  rating_count?: number;

  // Metadata
  tags?: string[];
  sku?: string;
  valid_from?: string;
  valid_until?: string;

  is_featured: boolean;
  is_new: boolean;
  is_popular: boolean;

  created_at: string;
  updated_at: string;
}

export type ProductType =
  | 'physical'
  | 'digital'
  | 'service'
  | 'subscription'
  | 'course'
  | 'avatar'
  | 'theme'
  | 'badge';

export type ProductCategory =
  | 'books'
  | 'stationery'
  | 'electronics'
  | 'clothing'
  | 'accessories'
  | 'courses'
  | 'exam_prep'
  | 'customization'
  | 'features'
  | 'other';

export interface ProductImage {
  id: number;
  image_url: string;
  is_primary: boolean;
  order: number;
}

export interface ProductVariant {
  id: number;
  product: number;
  name: string;
  sku: string;
  price_coins: number;
  stock_quantity?: number;
  attributes?: Record<string, string>; // e.g., {size: 'L', color: 'blue'}
}

export interface ProductReview {
  id: number;
  product: number;
  user: number;
  user_name: string;
  user_avatar?: string;
  rating: number; // 1-5
  title?: string;
  content: string;
  images?: string[];
  verified_purchase: boolean;
  helpful_count: number;
  is_helpful_by_user?: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ORDERS
// ============================================================================

export interface ShopOrder {
  id: number;
  order_number: string;
  student: number;
  student_name: string;

  // Items
  items: OrderItem[];
  items_count: number;

  // Pricing
  subtotal_coins: number;
  discount_coins?: number;
  total_coins: number;

  // Payment
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  paid_at?: string;

  // Delivery
  delivery_method: DeliveryMethod;
  delivery_address?: DeliveryAddress;
  delivery_status: DeliveryStatus;
  tracking_number?: string;
  delivered_at?: string;

  // Status
  order_status: OrderStatus;
  notes?: string;
  cancellation_reason?: string;

  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order: number;
  product: number;
  product_name: string;
  product_image?: string;
  variant?: number;
  quantity: number;
  price_per_unit: number;
  total_price: number;
  status: OrderItemStatus;
}

export type PaymentMethod = 'coins' | 'money' | 'mixed';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type DeliveryMethod = 'pickup' | 'delivery' | 'digital' | 'in_person';
export type DeliveryStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled' | 'refunded';
export type OrderItemStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';

export interface DeliveryAddress {
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
  delivery_notes?: string;
}

export interface OrderTracking {
  order: number;
  status: DeliveryStatus;
  location?: string;
  notes?: string;
  timestamp: string;
}

// ============================================================================
// SHOPPING CART
// ============================================================================

export interface ShoppingCart {
  id: number;
  student: number;
  items: CartItem[];
  items_count: number;
  subtotal_coins: number;
  total_coins: number;
  updated_at: string;
}

export interface CartItem {
  id: number;
  product: number;
  product_name: string;
  product_image?: string;
  variant?: number;
  quantity: number;
  price_per_unit: number;
  total_price: number;
  is_available: boolean;
  added_at: string;
}

// ============================================================================
// WISHLIST
// ============================================================================

export interface WishlistItem {
  id: number;
  student: number;
  product: number;
  product_name: string;
  product_image?: string;
  price_coins: number;
  is_available: boolean;
  notify_on_sale: boolean;
  added_at: string;
}

// ============================================================================
// PROMOTIONS & DISCOUNTS
// ============================================================================

export interface Promotion {
  id: number;
  code: string;
  name: string;
  description?: string;
  promotion_type: PromotionType;
  discount_type: 'percentage' | 'fixed' | 'free_shipping';
  discount_value: number;
  min_purchase_coins?: number;
  max_discount_coins?: number;
  applicable_products?: number[];
  applicable_categories?: string[];
  usage_limit?: number;
  usage_count: number;
  user_usage_limit?: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

export type PromotionType = 'code' | 'automatic' | 'seasonal' | 'first_purchase' | 'referral';

export interface AppliedPromotion {
  code: string;
  discount_coins: number;
  promotion_id: number;
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export interface CoinTransaction {
  id: number;
  student: number;
  transaction_type: 'earn' | 'spend' | 'refund' | 'transfer' | 'adjustment';
  amount: number;
  balance_before: number;
  balance_after: number;
  source: TransactionSource;
  reference_type?: string; // e.g., 'order', 'quiz', 'achievement'
  reference_id?: number;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export type TransactionSource =
  | 'shop_purchase'
  | 'order_refund'
  | 'daily_login'
  | 'quiz_completion'
  | 'assignment_submission'
  | 'achievement_unlock'
  | 'badge_earn'
  | 'challenge_completion'
  | 'referral'
  | 'admin_adjustment'
  | 'bonus';

export interface CoinBalance {
  student: number;
  balance: number;
  earned_total: number;
  spent_total: number;
  refunded_total: number;
  last_transaction?: string;
  updated_at: string;
}

export interface CoinSummary {
  balance: CoinBalance;
  recent_transactions: CoinTransaction[];
  earning_opportunities: EarningOpportunity[];
  statistics: CoinStatistics;
}

export interface EarningOpportunity {
  id: number;
  title: string;
  description: string;
  coins_amount: number;
  opportunity_type: 'task' | 'challenge' | 'event' | 'bonus';
  requirements?: string[];
  expires_at?: string;
  action_url?: string;
  is_completed?: boolean;
}

export interface CoinStatistics {
  total_earned: number;
  total_spent: number;
  current_balance: number;
  earned_this_week: number;
  earned_this_month: number;
  spent_this_week: number;
  spent_this_month: number;
  top_earning_sources: EarningSource[];
  top_spending_categories: SpendingCategory[];
}

export interface EarningSource {
  source: string;
  amount: number;
  count: number;
}

export interface SpendingCategory {
  category: string;
  amount: number;
  count: number;
}
