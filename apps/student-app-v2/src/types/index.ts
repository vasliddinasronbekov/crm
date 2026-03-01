/**
 * Type Definitions Index
 * Export all type definitions for the Student App
 */

// API types
export * from './api';

// Auth & User types
export * from './auth';

// Student types
export * from './student';

// LMS types
export * from './lms';

// Exam types (IELTS & SAT)
export * from './exams';

// Gamification types
export * from './gamification';

// Social Learning types
export * from './social';

// Shop & E-commerce types
// Note: CoinBalance and CoinTransaction are also in gamification
// Using explicit re-exports to avoid ambiguity
export type {
  ShopProduct,
  ProductCategory as ShopCategory,
  ShopOrder,
  OrderItem as ShopOrderItem,
  OrderStatus as ShopOrderStatus,
} from './shop';

// Payment types
export * from './payment';

// Support & Help types
// Note: TypingIndicator is also in social
// Using explicit re-exports to avoid ambiguity
export type {
  SupportTicket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketChat,
} from './support';
