
import { useMemo, useState } from "react";
import {
  Download,
  Package,
  Boxes,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  FileBarChart,
} from "lucide-react";

import type {
  Store,
  Product,
  InventoryStock,
  InventoryMovement,
} from "../types";

interface ReportsProps {
  stores: Store[];
  products: Product[];
  stock: InventoryStock[];
  movements: InventoryMovement[];
}

function Reports({
  stores,
  products,
  stock,
  movements,
}: ReportsProps) {
  const [selectedStore, setSelectedStore] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const storeMap = useMemo(
    () => new Map(stores.map((s) => [s.id, s])),
    [stores]
  );

  // Current stock filtered by store
  const filteredStock = useMemo(
    () =>
      stock.filter(
        (item) =>
          selectedStore === "all" ||
          item.store_id === selectedStore
      ),
    [stock, selectedStore]
  );

  // Movements filtered by store and date
  const filteredMovements = useMemo(
    () =>
      movements.filter((movement) => {
        const movementDate = movement.created_at.slice(0, 10);

        const matchesStore =
          selectedStore === "all" ||
          movement.store_id === selectedStore;

        const matchesStart =
          !startDate || movementDate >= startDate;

        const matchesEnd =
          !endDate || movementDate <= endDate;

        return matchesStore && matchesStart && matchesEnd;
      }),
    [movements, selectedStore, startDate, endDate]
  );

  // Inventory calculations
  const totalUnits = filteredStock.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const lowStockItems = filteredStock.filter(
    (item) => item.quantity <= item.reorder_level
  );

  const stockedProducts = new Set(
    filteredStock.map((item) => item.product_id)
  );

  const stockIn = filteredMovements
    .filter((m) => m.movement_type === "stock_in")
    .reduce((sum, m) => sum + Math.max(m.quantity_change, 0), 0);

  const stockOut = filteredMovements
    .filter((m) => m.movement_type === "stock_out")
    .reduce((sum, m) => sum + Math.abs(m.quantity_change), 0);

  const adjustments = filteredMovements.filter(
    (m) => m.movement_type === "adjustment"
  ).length;

  // Store comparison
  const storeStats = stores
    .filter(
      (store) =>
        selectedStore === "all" || store.id === selectedStore
    )
    .map((store) => {
      const storeStock = stock.filter(
        (item) => item.store_id === store.id
      );

      return {
        id: store.id,
        name: store.name,
        code: store.code,
        units: storeStock.reduce(
          (sum, item) => sum + item.quantity,
          0
        ),
        products: storeStock.length,
        lowStock: storeStock.filter(
          (item) => item.quantity <= item.reorder_level
        ).length,
      };
    });

  const maxStoreUnits = Math.max(
    1,
    ...storeStats.map((store) => store.units)
  );

  // CSV export
  function exportCSV() {
    const headers = [
      "Date",
      "Product",
      "SKU",
      "Store",
      "Movement Type",
      "Quantity Change",
      "Quantity Before",
      "Quantity After",
      "Note",
    ];

    const rows = filteredMovements.map((movement) => {
      const product = productMap.get(movement.product_id);
      const store = storeMap.get(movement.store_id);

      return [
        movement.created_at,
        product?.name ?? "Unknown product",
        product?.sku ?? "",
        store?.name ?? "Unknown store",
        movement.movement_type,
        movement.quantity_change,
        movement.quantity_before,
        movement.quantity_after,
        movement.note ?? "",
      ];
    });

    const escapeCSV = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const csv = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "storesync-inventory-movements.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function resetFilters() {
    setSelectedStore("all");
    setStartDate("");
    setEndDate("");
  }

  return (
    <div className="reports-page">
      <div className="reports-heading">
        <div>
          <span className="eyebrow">BUSINESS INTELLIGENCE</span>
          <h1>Reports & Analytics</h1>
          <p>
            Monitor inventory performance and review stock activity
            across your stores.
          </p>
        </div>

        <button
          className="primary-button report-export"
          onClick={exportCSV}
          type="button"
          disabled={filteredMovements.length === 0}
        >
          <Download size={17} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <section className="report-filters">
        <div className="report-filter-field">
          <label htmlFor="report-store">Store location</label>
          <select
            id="report-store"
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
          >
            <option value="all">All accessible stores</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} ({store.code})
              </option>
            ))}
          </select>
        </div>

        <div className="report-filter-field">
          <label htmlFor="report-start">From date</label>
          <input
            id="report-start"
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="report-filter-field">
          <label htmlFor="report-end">To date</label>
          <input
            id="report-end"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <button
          className="secondary-button report-reset"
          onClick={resetFilters}
          type="button"
        >
          <RefreshCw size={15} />
          Reset
        </button>
      </section>

      {/* Summary cards */}
      <section className="stats-grid report-stats">
        <article className="stat-card">
          <div className="stat-icon purple">
            <Boxes size={21} />
          </div>
          <span className="stat-label">Total inventory units</span>
          <strong>{totalUnits.toLocaleString()}</strong>
          <span className="stat-description">
            Across selected locations
          </span>
        </article>

        <article className="stat-card">
          <div className="stat-icon green">
            <Package size={21} />
          </div>
          <span className="stat-label">Stocked products</span>
          <strong>{stockedProducts.size}</strong>
          <span className="stat-description">
            Products with stock records
          </span>
        </article>

        <article className="stat-card">
          <div className="stat-icon orange">
            <AlertTriangle size={21} />
          </div>
          <span className="stat-label">Low-stock records</span>
          <strong>{lowStockItems.length}</strong>
          <span className="stat-description">
            At or below reorder level
          </span>
        </article>

        <article className="stat-card">
          <div className="stat-icon blue">
            <FileBarChart size={21} />
          </div>
          <span className="stat-label">Transactions</span>
          <strong>{filteredMovements.length}</strong>
          <span className="stat-description">
            Within selected date range
          </span>
        </article>
      </section>

      {/* Movement summary */}
      <section className="report-section">
        <div className="section-heading">
          <div>
            <h2>Stock movement summary</h2>
            <p>
              Quantity changes during the selected reporting period.
            </p>
          </div>
        </div>

        <div className="movement-summary-grid">
          <div className="movement-summary-card">
            <ArrowDownToLine size={21} />
            <span>Stock received</span>
            <strong>{stockIn.toLocaleString()}</strong>
            <small>Units added</small>
          </div>

          <div className="movement-summary-card">
            <ArrowUpFromLine size={21} />
            <span>Stock issued</span>
            <strong>{stockOut.toLocaleString()}</strong>
            <small>Units removed</small>
          </div>

          <div className="movement-summary-card">
            <RefreshCw size={21} />
            <span>Adjustments</span>
            <strong>{adjustments}</strong>
            <small>Adjustment transactions</small>
          </div>
        </div>
      </section>

      {/* Store comparison */}
      <section className="report-section">
        <div className="section-heading">
          <div>
            <h2>Store inventory comparison</h2>
            <p>
              Compare current inventory levels by location.
            </p>
          </div>
        </div>

        {storeStats.length > 0 ? (
          <div className="store-report-list">
            {storeStats.map((store) => (
              <div className="store-report-row" key={store.id}>
                <div className="store-report-info">
                  <strong>{store.name}</strong>
                  <span>{store.code}</span>
                </div>

                <div className="store-report-bar">
                  <div
                    className="store-report-bar-fill"
                    style={{
                      width: `${(store.units / maxStoreUnits) * 100}%`,
                    }}
                  />
                </div>

                <div className="store-report-numbers">
                  <strong>{store.units.toLocaleString()}</strong>
                  <span>{store.lowStock} low stock</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            No store data available.
          </div>
        )}
      </section>

      {/* Low stock details */}
      <section className="report-section">
        <div className="section-heading">
          <div>
            <h2>Low-stock report</h2>
            <p>
              Products that have reached or fallen below their
              reorder thresholds.
            </p>
          </div>

          <span className="store-count">
            {lowStockItems.length} records
          </span>
        </div>

        {lowStockItems.length > 0 ? (
          <div className="table-container">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Store</th>
                  <th>Available</th>
                  <th>Reorder level</th>
                </tr>
              </thead>

              <tbody>
                {lowStockItems.map((item) => {
                  const product = productMap.get(item.product_id);
                  const store = storeMap.get(item.store_id);

                  return (
                    <tr key={item.id}>
                      <td>{product?.name ?? "Unknown product"}</td>
                      <td>{product?.sku ?? "—"}</td>
                      <td>{store?.name ?? "Unknown store"}</td>
                      <td>
                        <strong className="low-stock-value">
                          {item.quantity}
                        </strong>
                      </td>
                      <td>{item.reorder_level}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Package size={22} />
            No low-stock records for the selected location.
          </div>
        )}
      </section>

      {/* Transaction history */}
      <section className="report-section">
        <div className="section-heading">
          <div>
            <h2>Inventory transaction history</h2>
            <p>
              Detailed record of stock changes in the selected period.
            </p>
          </div>
        </div>

        {filteredMovements.length > 0 ? (
          <div className="table-container">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Store</th>
                  <th>Type</th>
                  <th>Change</th>
                  <th>Balance</th>
                </tr>
              </thead>

              <tbody>
                {filteredMovements.map((movement) => {
                  const product = productMap.get(movement.product_id);
                  const store = storeMap.get(movement.store_id);

                  return (
                    <tr key={movement.id}>
                      <td>
                        {new Date(
                          movement.created_at
                        ).toLocaleDateString()}
                      </td>

                      <td>{product?.name ?? "Unknown product"}</td>
                      <td>{store?.name ?? "Unknown store"}</td>

                      <td>
                        {movement.movement_type.replaceAll("_", " ")}
                      </td>

                      <td
                        className={
                          movement.quantity_change >= 0
                            ? "quantity-positive"
                            : "quantity-negative"
                        }
                      >
                        {movement.quantity_change > 0 ? "+" : ""}
                        {movement.quantity_change}
                      </td>

                      <td>{movement.quantity_after}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            No transactions match the selected filters.
          </div>
        )}
      </section>
    </div>
  );
}

export default Reports;
