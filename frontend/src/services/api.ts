
import type { LoginResponse, Store, User, Product, InventoryStock, InventoryMovement,} from "../types";

const API_URL = import.meta.env.VITE_API_URL;

const TOKEN_KEY = "storesync_token";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function logout(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers = new Headers(options.headers);

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.detail || `Request failed: ${response.status}`
    );
  }

  return response.json() as Promise<T>;
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const result = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  sessionStorage.setItem(TOKEN_KEY, result.access_token);

  return result;
}

export function getCurrentUser(): Promise<User> {
  return apiRequest<User>("/auth/me");
}

export function getStores(): Promise<Store[]> {
  return apiRequest<Store[]>("/stores/");
}


const API_BASE = import.meta.env.VITE_API_URL;

async function inventoryRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = sessionStorage.getItem("storesync_token");

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || `Request failed (${response.status})`
    );
  }

  return response.json() as Promise<T>;
}

export function getProducts(): Promise<Product[]> {
  return inventoryRequest<Product[]>("/products/");
}

export function createProduct(data: {
  name: string;
  sku: string;
  barcode?: string;
  category?: string;
  description?: string;
  unit: string;
}): Promise<Product> {
  return inventoryRequest<Product>("/products/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getInventoryStock(
  storeId?: string,
  lowStock = false
): Promise<InventoryStock[]> {
  const params = new URLSearchParams();

  if (storeId) params.set("store_id", storeId);
  if (lowStock) params.set("low_stock", "true");

  const query = params.toString();

  return inventoryRequest<InventoryStock[]>(
    `/inventory/stock${query ? `?${query}` : ""}`
  );
}

export function createStock(data: {
  product_id: string;
  store_id: string;
  quantity: number;
  reorder_level: number;
}): Promise<InventoryStock> {
  return inventoryRequest<InventoryStock>("/inventory/stock", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function adjustStock(
  stockId: string,
  data: {
    quantity_change: number;
    movement_type: "stock_in" | "stock_out" | "adjustment";
    note?: string;
  }
): Promise<InventoryStock> {
  return inventoryRequest<InventoryStock>(`/inventory/stock/${stockId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function getInventoryMovements(
  storeId?: string
): Promise<InventoryMovement[]> {
  const params = new URLSearchParams();

  if (storeId) params.set("store_id", storeId);

  const query = params.toString();

  return inventoryRequest<InventoryMovement[]>(
    `/inventory/movements${query ? `?${query}` : ""}`
  );
}

export function updateProduct(
  productId: string,
  data: {
    name: string;
    sku: string;
    barcode?: string;
    category?: string;
    description?: string;
    unit: string;
  }
): Promise<Product> {
  return inventoryRequest<Product>(`/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deactivateProduct(productId: string): Promise<Product> {
  return inventoryRequest<Product>(`/products/${productId}`, {
    method: "DELETE",
  });
}
