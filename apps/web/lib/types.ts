// apps/web/lib/types.ts

export interface CertificateTemplate {
  id?: number;
  name: string;
  is_active?: boolean;
  is_default?: boolean;
  template_type?: string;
  background_image: File | string | null; // Can be File for upload, string for URL
  background_image_url?: string | null;
  background_color?: string;
  text_color?: string;
  border_color?: string;
  layout_config: LayoutConfig;
  certificate_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface LayoutConfig {
  [key: string]: LayoutItem;
}

export interface LayoutItem {
  x: number;
  y: number;
  font_name: string;
  font_size: number;
  color: string;
  text?: string;
  size?: number;
  align?: "left" | "center" | "right";
}

// Add PaginatedResponse here since useAnalytics also uses it
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
