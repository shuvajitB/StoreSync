
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  ClipboardList,
  History,
  Package,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import {
  getProducts,
  getStores,
  getInventoryStock,
  getInventoryMovements,
  createProduct,
  createStock,
  adjustStock,
  updateProduct,
  deactivateProduct,
} from "../services/api";

import type {
  Product,
  Store,
  InventoryStock,
  InventoryMovement,
  User,
} from "../types";

type Tab = "overview" | "products" | "stock" | "movements";

interface Props {
  user: User;
}

const emptyProduct = {
  name: "",
  sku: "",
  barcode: "",
  category: "",
  description: "",
  unit: "piece",
};

function InventoryManagement({ user }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [stock, setStock] = useState<InventoryStock[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  const [selectedStore, setSelectedStore] = useState("");
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showProductModal, setShowProductModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedStock, setSelectedStock] = useState<InventoryStock | null>(null);

  const [productForm, setProductForm] = useState(emptyProduct);
  const [stockForm, setStockForm] = useState({
    product_id: "",
    store_id: "",
    quantity: "0",
    reorder_level: "10",
  });
  const [adjustmentForm, setAdjustmentForm] = useState({
    movement_type: "stock_in" as "stock_in" | "stock_out" | "adjustment",
    quantity: "",
    note: "",
  });

  const canManageProducts =
    user.role === "business_owner" ||
    user.role === "inventory_manager" ||
    user.role === "super_admin";

  const canManageStock =
    canManageProducts || user.role === "store_manager";

  const loadInventory = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const [productData, storeData, stockData, movementData] =
        await Promise.all([
          getProducts(),
          getStores(),
          getInventoryStock(),
          getInventoryMovements(),
        ]);

      setProducts(productData);
      setStores(storeData);
      setStock(stockData);
      setMovements(movementData);

      setSelectedStore((current) =>
        current || storeData[0]?.id || ""
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load inventory."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const storeMap = useMemo(
    () => new Map(stores.map((store) => [store.id, store])),
    [stores]
  );

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const activeProducts = products.filter((product) => product.is_active);

  const visibleStock = stock.filter((item) => {
    const matchesStore =
      !selectedStore || item.store_id === selectedStore;

    const product = productMap.get(item.product_id);
    const matchesSearch =
      !search ||
      `${product?.name ?? ""} ${product?.sku ?? ""} ${product?.category ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesLowStock =
      !lowStockOnly || item.quantity <= item.reorder_level;

    return matchesStore && matchesSearch && matchesLowStock;
  });

  const lowStockItems = stock.filter(
    (item) => item.quantity <= item.reorder_level
  );

  const totalUnits = stock.reduce(
    (total, item) => total + item.quantity,
    0
  );


  function notify(message: string) {
    setSuccess(message);
    setError("");
    window.setTimeout(() => setSuccess(""), 3500);
  }

  function openCreateProduct() {
    setEditingProduct(null);
    setProductForm(emptyProduct);
    setShowProductModal(true);
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? "",
      category: product.category ?? "",
      description: product.description ?? "",
      unit: product.unit,
    });
    setShowProductModal(true);
  }

  async function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      const payload = {
        name: productForm.name.trim(),
        sku: productForm.sku.trim(),
        barcode: productForm.barcode.trim() || undefined,
        category: productForm.category.trim() || undefined,
        description: productForm.description.trim() || undefined,
        unit: productForm.unit.trim(),
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
        notify("Product updated successfully.");
      } else {
        await createProduct(payload);
        notify("Product created successfully.");
      }

      setShowProductModal(false);
      await loadInventory(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save product."
      );
    }
  }

  async function handleDeactivate(product: Product) {
    if (
      !window.confirm(
        `Deactivate ${product.name}? It will no longer be available for new stock allocations.`
      )
    ) {
      return;
    }

    try {
      await deactivateProduct(product.id);
      notify("Product deactivated.");
      await loadInventory(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to deactivate product."
      );
    }
  }

  function openStockModal() {
    setStockForm({
      product_id: activeProducts[0]?.id ?? "",
      store_id: selectedStore || stores[0]?.id || "",
      quantity: "0",
      reorder_level: "10",
    });
    setShowStockModal(true);
  }

  async function handleStockSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      await createStock({
        product_id: stockForm.product_id,
        store_id: stockForm.store_id,
        quantity: Number(stockForm.quantity),
        reorder_level: Number(stockForm.reorder_level),
      });

      setShowStockModal(false);
      notify("Initial stock allocated successfully.");
      await loadInventory(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to allocate stock."
      );
    }
  }

  function openAdjustment(item: InventoryStock) {
    setSelectedStock(item);
    setAdjustmentForm({
      movement_type: "stock_in",
      quantity: "",
      note: "",
    });
    setShowAdjustmentModal(true);
  }

  async function handleAdjustmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStock) return;

    const amount = Number(adjustmentForm.quantity);

    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }

    const signedQuantity =
      adjustmentForm.movement_type === "stock_out" ? -amount :
      adjustmentForm.movement_type === "adjustment" ? amount :
      amount;

    try {
      await adjustStock(selectedStock.id, {
        quantity_change: signedQuantity,
        movement_type: adjustmentForm.movement_type,
        note: adjustmentForm.note.trim() || undefined,
      });

      setShowAdjustmentModal(false);
      notify("Inventory updated successfully.");
      await loadInventory(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to adjust stock."
      );
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Package }[] = [
    { id: "overview", label: "Overview", icon: Boxes },
    { id: "products", label: "Products", icon: Package },
    { id: "stock", label: "Stock", icon: ClipboardList },
    { id: "movements", label: "Movements", icon: History },
  ];

  if (loading) {
    return (
      <div className="inventory-loading">
        <RefreshCw className="inventory-spin" size={24} />
        <p>Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className="inventory-page">
      <div className="inventory-heading">
        <div>
          <span className="eyebrow">RETAIL OPERATIONS</span>
          <h1>Inventory Management</h1>
          <p>Manage products, stock levels and inventory movements.</p>
        </div>

        <button
          className="inventory-refresh"
          onClick={() => void loadInventory(true)}
          disabled={refreshing}
          type="button"
        >
          <RefreshCw
            size={17}
            className={refreshing ? "inventory-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="inventory-alert error">
          <AlertTriangle size={18} />
          {error}
          <button type="button" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="inventory-alert success">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="inventory-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              type="button"
              key={tab.id}
              className={`inventory-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={17} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <>
          <div className="inventory-stat-grid">
            <article className="inventory-stat-card">
              <div className="inventory-stat-icon purple">
                <Package size={21} />
              </div>
              <span>Active products</span>
              <strong>{activeProducts.length}</strong>
              <small>Products in catalogue</small>
            </article>

            <article className="inventory-stat-card">
              <div className="inventory-stat-icon blue">
                <Boxes size={21} />
              </div>
              <span>Total stock units</span>
              <strong>{totalUnits.toLocaleString()}</strong>
              <small>Across accessible stores</small>
            </article>

            <article className="inventory-stat-card">
              <div className="inventory-stat-icon orange">
                <AlertTriangle size={21} />
              </div>
              <span>Low-stock records</span>
              <strong>{lowStockItems.length}</strong>
              <small>At or below reorder level</small>
            </article>

            <article className="inventory-stat-card">
              <div className="inventory-stat-icon green">
                <History size={21} />
              </div>
              <span>Recent movements</span>
              <strong>{movements.length}</strong>
              <small>Latest recorded movements</small>
            </article>
          </div>

          <section className="inventory-panel">
            <div className="inventory-panel-heading">
              <div>
                <h2>Low-stock alerts</h2>
                <p>Products that need replenishment.</p>
              </div>
              <button
                className="inventory-text-button"
                type="button"
                onClick={() => {
                  setLowStockOnly(true);
                  setActiveTab("stock");
                }}
              >
                View all <ArrowUpCircle size={15} />
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="inventory-empty">
                <Boxes size={28} />
                <strong>No low-stock items</strong>
                <span>All recorded stock levels are above their reorder thresholds.</span>
              </div>
            ) : (
              <div className="inventory-table-wrap">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Store</th>
                      <th>Available</th>
                      <th>Reorder level</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.slice(0, 8).map((item) => {
                      const product = productMap.get(item.product_id);

                      return (
                        <tr key={item.id}>
                          <td>
                            <strong>{product?.name ?? "Unknown product"}</strong>
                            <small>{product?.sku ?? item.product_id}</small>
                          </td>
                          <td>{storeMap.get(item.store_id)?.name ?? "Unknown store"}</td>
                          <td className="stock-number danger">{item.quantity}</td>
                          <td>{item.reorder_level}</td>
                          <td><span className="inventory-status low">Low stock</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="inventory-panel">
            <div className="inventory-panel-heading">
              <div>
                <h2>Recent movements</h2>
                <p>Latest inventory activity across your stores.</p>
              </div>
              <button
                className="inventory-text-button"
                type="button"
                onClick={() => setActiveTab("movements")}
              >
                View history <History size={15} />
              </button>
            </div>

            <MovementList
              movements={movements.slice(0, 5)}
              productMap={productMap}
              storeMap={storeMap}
            />
          </section>
        </>
      )}

      {activeTab === "products" && (
        <section className="inventory-panel">
          <div className="inventory-panel-heading inventory-actions-heading">
            <div>
              <h2>Product catalogue</h2>
              <p>{products.length} products registered in your business.</p>
            </div>

            {canManageProducts && (
              <button
                className="inventory-primary-button"
                onClick={openCreateProduct}
                type="button"
              >
                <Plus size={17} /> Add product
              </button>
            )}
          </div>

          <div className="inventory-toolbar">
            <div className="inventory-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products, SKU or category..."
              />
            </div>
          </div>

          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Status</th>
                  {canManageProducts && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {products
                  .filter((product) =>
                    `${product.name} ${product.sku} ${product.category ?? ""}`
                      .toLowerCase()
                      .includes(search.toLowerCase())
                  )
                  .map((product) => (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        <small>{product.barcode || "No barcode"}</small>
                      </td>
                      <td>{product.sku}</td>
                      <td>{product.category || "Uncategorized"}</td>
                      <td>{product.unit}</td>
                      <td>
                        <span className={`inventory-status ${product.is_active ? "active" : "inactive"}`}>
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {canManageProducts && (
                        <td>
                          <div className="inventory-row-actions">
                            <button
                              type="button"
                              onClick={() => openEditProduct(product)}
                            >
                              Edit
                            </button>
                            {product.is_active && (
                              <button
                                type="button"
                                className="danger-action"
                                onClick={() => void handleDeactivate(product)}
                              >
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {products.length === 0 && (
            <div className="inventory-empty">
              <Package size={28} />
              <strong>No products yet</strong>
              <span>Add your first product to start tracking inventory.</span>
            </div>
          )}
        </section>
      )}

      {activeTab === "stock" && (
        <section className="inventory-panel">
          <div className="inventory-panel-heading inventory-actions-heading">
            <div>
              <h2>Store stock levels</h2>
              <p>Monitor and update inventory by location.</p>
            </div>

            {canManageStock && (
              <button
                className="inventory-primary-button"
                onClick={openStockModal}
                type="button"
                disabled={activeProducts.length === 0 || stores.length === 0}
              >
                <Plus size={17} /> Allocate stock
              </button>
            )}
          </div>

          <div className="inventory-toolbar">
            <div className="inventory-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product or SKU..."
              />
            </div>

            <select
              value={selectedStore}
              onChange={(event) => setSelectedStore(event.target.value)}
            >
              <option value="">All accessible stores</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>

            <label className="inventory-checkbox">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(event) => setLowStockOnly(event.target.checked)}
              />
              Low stock only
            </label>
          </div>

          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Store</th>
                  <th>Quantity</th>
                  <th>Reorder level</th>
                  <th>Status</th>
                  {canManageStock && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {visibleStock.map((item) => {
                  const product = productMap.get(item.product_id);
                  const isLow = item.quantity <= item.reorder_level;

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{product?.name ?? "Unknown product"}</strong>
                        <small>{product?.sku ?? item.product_id}</small>
                      </td>
                      <td>{storeMap.get(item.store_id)?.name ?? "Unknown store"}</td>
                      <td className={`stock-number ${isLow ? "danger" : ""}`}>
                        {item.quantity} {product?.unit ?? "units"}
                      </td>
                      <td>{item.reorder_level}</td>
                      <td>
                        <span className={`inventory-status ${isLow ? "low" : "active"}`}>
                          {isLow ? "Low stock" : "Healthy"}
                        </span>
                      </td>
                      {canManageStock && (
                        <td>
                          <button
                            className="inventory-small-button"
                            type="button"
                            onClick={() => openAdjustment(item)}
                          >
                            Adjust stock
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visibleStock.length === 0 && (
            <div className="inventory-empty">
              <Boxes size={28} />
              <strong>No stock records found</strong>
              <span>Try another store or allocate stock to a product.</span>
            </div>
          )}
        </section>
      )}

      {activeTab === "movements" && (
        <section className="inventory-panel">
          <div className="inventory-panel-heading">
            <div>
              <h2>Inventory movement history</h2>
              <p>Track stock received, sold and adjusted.</p>
            </div>
          </div>

          <div className="inventory-toolbar">
            <select
              value={selectedStore}
              onChange={(event) => setSelectedStore(event.target.value)}
            >
              <option value="">All accessible stores</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <MovementList
            movements={movements.filter(
              (movement) =>
                !selectedStore || movement.store_id === selectedStore
            )}
            productMap={productMap}
            storeMap={storeMap}
          />
        </section>
      )}

      {showProductModal && (
        <Modal
          title={editingProduct ? "Edit product" : "Add new product"}
          onClose={() => setShowProductModal(false)}
        >
          <form className="inventory-form" onSubmit={handleProductSubmit}>
            <label>
              Product name *
              <input
                value={productForm.name}
                onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                required
                minLength={2}
                maxLength={150}
                placeholder="e.g. Coca-Cola 500ml"
              />
            </label>

            <label>
              SKU *
              <input
                value={productForm.sku}
                onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })}
                required
                minLength={2}
                maxLength={50}
                placeholder="e.g. BEV-COC-500"
              />
            </label>

            <label>
              Barcode
              <input
                value={productForm.barcode}
                onChange={(event) => setProductForm({ ...productForm, barcode: event.target.value })}
                placeholder="Optional barcode"
              />
            </label>

            <label>
              Category
              <input
                value={productForm.category}
                onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}
                placeholder="e.g. Beverages"
              />
            </label>

            <label>
              Unit *
              <input
                value={productForm.unit}
                onChange={(event) => setProductForm({ ...productForm, unit: event.target.value })}
                required
                placeholder="piece, bottle, box..."
              />
            </label>

            <label>
              Description
              <textarea
                value={productForm.description}
                onChange={(event) => setProductForm({ ...productForm, description: event.target.value })}
                rows={3}
                placeholder="Optional product description"
              />
            </label>

            <div className="inventory-modal-actions">
              <button type="button" className="inventory-cancel-button" onClick={() => setShowProductModal(false)}>
                Cancel
              </button>
              <button type="submit" className="inventory-primary-button">
                {editingProduct ? "Save changes" : "Create product"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showStockModal && (
        <Modal title="Allocate initial stock" onClose={() => setShowStockModal(false)}>
          <form className="inventory-form" onSubmit={handleStockSubmit}>
            <label>
              Product *
              <select
                value={stockForm.product_id}
                onChange={(event) => setStockForm({ ...stockForm, product_id: event.target.value })}
                required
              >
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Store *
              <select
                value={stockForm.store_id}
                onChange={(event) => setStockForm({ ...stockForm, store_id: event.target.value })}
                required
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Initial quantity *
              <input
                type="number"
                min="0"
                step="1"
                value={stockForm.quantity}
                onChange={(event) => setStockForm({ ...stockForm, quantity: event.target.value })}
                required
              />
            </label>

            <label>
              Reorder level *
              <input
                type="number"
                min="0"
                step="1"
                value={stockForm.reorder_level}
                onChange={(event) => setStockForm({ ...stockForm, reorder_level: event.target.value })}
                required
              />
            </label>

            <div className="inventory-modal-actions">
              <button type="button" className="inventory-cancel-button" onClick={() => setShowStockModal(false)}>
                Cancel
              </button>
              <button type="submit" className="inventory-primary-button">
                Allocate stock
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showAdjustmentModal && selectedStock && (
        <Modal title="Adjust stock" onClose={() => setShowAdjustmentModal(false)}>
          <form className="inventory-form" onSubmit={handleAdjustmentSubmit}>
            <div className="inventory-current-stock">
              <span>Current quantity</span>
              <strong>{selectedStock.quantity}</strong>
            </div>

            <label>
              Movement type *
              <select
                value={adjustmentForm.movement_type}
                onChange={(event) =>
                  setAdjustmentForm({
                    ...adjustmentForm,
                    movement_type: event.target.value as "stock_in" | "stock_out" | "adjustment",
                  })
                }
              >
                <option value="stock_in">Stock received</option>
                <option value="stock_out">Stock removed / sold</option>
                <option value="adjustment">Inventory correction</option>
              </select>
            </label>

            <label>
              Quantity *
              <input
                type="number"
                min="1"
                step="1"
                value={adjustmentForm.quantity}
                onChange={(event) => setAdjustmentForm({ ...adjustmentForm, quantity: event.target.value })}
                required
                placeholder="Enter quantity"
              />
            </label>

            <label>
              Note
              <textarea
                value={adjustmentForm.note}
                onChange={(event) => setAdjustmentForm({ ...adjustmentForm, note: event.target.value })}
                rows={3}
                placeholder="Reason for this stock movement"
              />
            </label>

            <div className="inventory-modal-actions">
              <button type="button" className="inventory-cancel-button" onClick={() => setShowAdjustmentModal(false)}>
                Cancel
              </button>
              <button type="submit" className="inventory-primary-button">
                Save adjustment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function MovementList({
  movements,
  productMap,
  storeMap,
}: {
  movements: InventoryMovement[];
  productMap: Map<string, Product>;
  storeMap: Map<string, Store>;
}) {
  if (movements.length === 0) {
    return (
      <div className="inventory-empty">
        <History size={28} />
        <strong>No inventory movements</strong>
        <span>Stock activity will appear here when inventory changes.</span>
      </div>
    );
  }

  return (
    <div className="inventory-movement-list">
      {movements.map((movement) => {
        const isIn = movement.quantity_change > 0;
        const product = productMap.get(movement.product_id);

        return (
          <article className="inventory-movement" key={movement.id}>
            <div className={`movement-icon ${isIn ? "in" : "out"}`}>
              {isIn ? <ArrowDownCircle size={19} /> : <ArrowUpCircle size={19} />}
            </div>

            <div className="movement-details">
              <strong>{product?.name ?? "Unknown product"}</strong>
              <span>
                {storeMap.get(movement.store_id)?.name ?? "Unknown store"}
                {" · "}
                {movement.movement_type.replaceAll("_", " ")}
              </span>
              {movement.note && <small>{movement.note}</small>}
              <small>{new Date(movement.created_at).toLocaleString()}</small>
            </div>

            <div className={`movement-quantity ${isIn ? "positive" : "negative"}`}>
              {isIn ? "+" : ""}
              {movement.quantity_change}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="inventory-modal-backdrop" onClick={onClose}>
      <section
        className="inventory-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="inventory-modal-heading">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default InventoryManagement;
