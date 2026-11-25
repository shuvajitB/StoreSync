
export type UserRole =
  | "super_admin"
  | "business_owner"
  | "store_manager"
  | "inventory_manager"
  | "cashier"
  | "viewer";

export interface User {
  id: string;
  business_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

export interface Store {
  id: string;
  business_id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  province: string | null;
  is_active: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}


export interface Product {
  id: string;
  business_id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category: string | null;
  description: string | null;
  unit: string;
  is_active: boolean;
  created_at: string;
}

export interface InventoryStock {
  id: string;
  product_id: string;
  store_id: string;
  quantity: number;
  reorder_level: number;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  store_id: string;
  user_id: string;
  movement_type: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  note: string | null;
  created_at: string;
}
