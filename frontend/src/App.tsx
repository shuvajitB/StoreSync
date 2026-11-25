import { useEffect, useState, type FormEvent } from "react";

import StoreManagement from "./components/StoreManagement";
import InventoryManagement from "./components/InventoryManagement";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  Building2,
  Clock3,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Moon,
  Package,
  Search,
  ShieldCheck,
  Store as StoreIcon,
  Sun,
  Users,
  Boxes,
  AlertTriangle,
} from "lucide-react";

import { useTheme } from "./context/ThemeContext";

import {
  login,
  getCurrentUser,
  getStores,
  getProducts,
  getInventoryStock,
  getInventoryMovements,
  logout,
} from "./services/api";

import type {
  Store,
  User,
  Product,
  InventoryStock,
  InventoryMovement,
} from "./types";

import Reports from "./components/Reports";

function App() {
  // Navigation
  const [activePage, setActivePage] = useState<
    "dashboard" | "stores" | "inventory" | "reports"
  >("dashboard");

  const { theme, toggleTheme } = useTheme();

  // Authentication
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Dashboard data
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<InventoryStock[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  const [search, setSearch] = useState("");

  // Load all application data
  async function loadDashboard() {
    const [
      currentUser,
      userStores,
      productData,
      stockData,
      movementData,
    ] = await Promise.all([
      getCurrentUser(),
      getStores(),
      getProducts(),
      getInventoryStock(),
      getInventoryMovements(),
    ]);

    setUser(currentUser);
    setStores(userStores);
    setProducts(productData);
    setStock(stockData);
    setMovements(movementData);
  }

  // Restore authenticated session
  useEffect(() => {
    if (sessionStorage.getItem("storesync_token")) {
      loadDashboard().catch(() => {
        logout();
        setUser(null);
      });
    }
  }, []);

  // Login
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await login(email, password);
      await loadDashboard();
    } catch (err) {
      logout();

      setError(
        err instanceof Error ? err.message : "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  }

  // Logout
  function handleLogout() {
    logout();

    setUser(null);
    setStores([]);
    setProducts([]);
    setStock([]);
    setMovements([]);

    setPassword("");
    setError("");
    setSearch("");
    setActivePage("dashboard");
  }

  // Store search
  const filteredStores = stores.filter((store) =>
    `${store.name} ${store.code} ${store.city ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // Dashboard calculations
  const activeStores = stores.filter(
    (store) => store.is_active
  ).length;

  const totalInventoryUnits = stock.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const lowStockCount = stock.filter(
    (item) => item.quantity <= item.reorder_level
  ).length;

  const roleLabel = user?.role
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  // Product lookup for recent movements
  const productMap = new Map(
    products.map((product) => [product.id, product.name])
  );

  // Login screen
  if (!user) {
    return (
      <main className="login-page">
        <section className="login-brand">
          <div className="brand-logo">
            <StoreIcon size={25} />
          </div>

          <span className="brand-name">StoreSync</span>

          <div className="login-message">
            <span className="eyebrow">
              RETAIL MANAGEMENT PLATFORM
            </span>

            <h1>
              One platform.
              <br />
              Every store.
            </h1>

            <p>
              Manage your retail operations, teams and locations
              from one connected workspace.
            </p>
          </div>

          <div className="login-footer">
            <ShieldCheck size={16} />
            Secure multi-store management
          </div>
        </section>

        <section className="login-panel">
          <button
            className="theme-button login-theme"
            onClick={toggleTheme}
            type="button"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun size={19} />
            ) : (
              <Moon size={19} />
            )}
          </button>

          <div className="login-form-container">
            <div className="mobile-brand">
              <StoreIcon size={24} />
              <strong>StoreSync</strong>
            </div>

            <span className="eyebrow">WELCOME BACK</span>

            <h2>Sign in to your account</h2>

            <p className="muted">
              Enter your credentials to access your workspace.
            </p>

            <form onSubmit={handleLogin}>
              <label htmlFor="email">Email address</label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
              />

              <label htmlFor="password">Password</label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
              />

              {error && (
                <div className="error-message">
                  <AlertCircle size={17} />
                  {error}
                </div>
              )}

              <button
                className="primary-button login-submit"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoaderCircle className="spin" size={18} />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
 
          </div>

          <p className="login-copyright">
            © 2026 StoreSync. Retail operations, simplified.
          </p>
        </section>
      </main>
    );
  }

  // Main application
  return (
    <main className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <StoreIcon size={23} />
          </div>

          <strong>StoreSync</strong>
        </div>

        <div className="business-selector">
          <div className="business-icon">
            <Building2 size={19} />
          </div>

          <div>
            <strong>AtoZ Retail</strong>
            <span>Business workspace</span>
          </div>
        </div>

        <span className="nav-label">WORKSPACE</span>

        <nav className="navigation">
          <button
            className={`nav-item ${
              activePage === "dashboard" ? "active" : ""
            }`}
            onClick={() => setActivePage("dashboard")}
            type="button"
          >
            <LayoutDashboard size={19} />
            Dashboard
          </button>

          <button
            className={`nav-item ${
              activePage === "stores" ? "active" : ""
            }`}
            onClick={() => setActivePage("stores")}
            type="button"
          >
            <StoreIcon size={19} />
            Stores
          </button>

          <button
            className={`nav-item ${
              activePage === "inventory" ? "active" : ""
            }`}
            onClick={() => setActivePage("inventory")}
            type="button"
          >
            <Package size={19} />
            Inventory
          </button>

          <a className="nav-item" href="#employees">
            <Users size={19} />
            Employees
          </a>

          <button
            className={`nav-item ${
              activePage === "reports" ? "active" : ""
            }`}
            onClick={() => setActivePage("reports")}
            type="button"
          >
            <Activity size={19} />
            Reports
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="user-profile">
            <div className="avatar">
              {user.full_name.charAt(0).toUpperCase()}
            </div>

            <div className="user-info">
              <strong>{user.full_name}</strong>
              <span>{roleLabel}</span>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
            type="button"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <section className="dashboard-main">
        <header className="topbar">
          <div>
            <span className="breadcrumb">
              Workspace /{" "}
              {activePage === "stores"
                ? "Stores"
                : activePage === "inventory"
                  ? "Inventory"
                  : activePage === "reports"
                    ? "Reports"
                    : "Dashboard"}
            </span>

            <h2>
              {activePage === "stores"
                ? "Store Management"
                : activePage === "inventory"
                  ? "Inventory Management"
                  : activePage === "reports"
                    ? "Reports & Analytics"
                    : "Overview"}
            </h2>
          </div>

          <div className="topbar-actions">
            <button
              className="theme-button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              type="button"
            >
              {theme === "dark" ? (
                <Sun size={19} />
              ) : (
                <Moon size={19} />
              )}
            </button>

            <div className="topbar-avatar">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          {/* Store management */}
          {activePage === "stores" ? (
            <StoreManagement
              stores={stores}
              user={user}
              onStoresChanged={async () => {
                const updatedStores = await getStores();
                setStores(updatedStores);
              }}
            />
          ) : activePage === "inventory" ? (
            <InventoryManagement user={user} />
          ) : activePage === "reports" ? (
            <Reports
              stores={stores}
              products={products}
              stock={stock}
              movements={movements}
            />
          ) : (
            <>
              {/* Dashboard overview */}
              <div className="welcome-heading">
                <div>
                  <span className="eyebrow">
                    BUSINESS OVERVIEW
                  </span>

                  <h1>
                    Good to see you, {user.full_name.split(" ")[0]}.
                  </h1>

                  <p>
                    Here's what's happening across your stores.
                  </p>
                </div>

                <span className="live-indicator">
                  <span />
                  Live connection
                </span>
              </div>

              {/* Dashboard statistics */}
              <section className="stats-grid">
                <article className="stat-card">
                  <div className="stat-icon purple">
                    <StoreIcon size={21} />
                  </div>

                  <span className="stat-label">
                    Accessible stores
                  </span>

                  <strong>{stores.length}</strong>

                  <span className="stat-description">
                    Locations available to you
                  </span>
                </article>

                <article className="stat-card">
                  <div className="stat-icon green">
                    <Package size={21} />
                  </div>

                  <span className="stat-label">
                    Active products
                  </span>

                  <strong>{products.length}</strong>

                  <span className="stat-description">
                    Products in your catalogue
                  </span>
                </article>

                <article className="stat-card">
                  <div className="stat-icon blue">
                    <Boxes size={21} />
                  </div>

                  <span className="stat-label">
                    Inventory units
                  </span>

                  <strong>
                    {totalInventoryUnits.toLocaleString()}
                  </strong>

                  <span className="stat-description">
                    Units across accessible stores
                  </span>
                </article>

                <article className="stat-card">
                  <div className="stat-icon orange">
                    <AlertTriangle size={21} />
                  </div>

                  <span className="stat-label">
                    Low-stock records
                  </span>

                  <strong>{lowStockCount}</strong>

                  <span className="stat-description">
                    Items at or below reorder level
                  </span>
                </article>
              </section>

              {/* Store overview */}
              <section className="stores-section" id="stores">
                <div className="section-heading">
                  <div>
                    <h2>Your stores</h2>
                    <p>
                      Manage and monitor your accessible locations.
                    </p>
                  </div>

                  <div className="store-count">
                    {activeStores} active / {stores.length} total
                  </div>
                </div>

                <div className="search-box">
                  <Search size={18} />

                  <input
                    type="search"
                    placeholder="Search by store, code or city..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <div className="store-grid">
                  {filteredStores.map((store) => (
                    <article
                      className="store-card"
                      key={store.id}
                    >
                      <div className="store-card-top">
                        <div className="store-icon">
                          <StoreIcon size={21} />
                        </div>

                        <span
                          className={
                            store.is_active
                              ? "store-status"
                              : "store-status inactive"
                          }
                        >
                          {store.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <h3>{store.name}</h3>

                      <p>
                        {store.city}, {store.province}
                      </p>

                      <div className="store-card-footer">
                        <span>{store.code}</span>
                        <ArrowRight size={17} />
                      </div>
                    </article>
                  ))}
                </div>

                {filteredStores.length === 0 && (
                  <div className="empty-state">
                    No stores match your search.
                  </div>
                )}
              </section>

              {/* Recent inventory movements */}
              <section className="stores-section">
                <div className="section-heading">
                  <div>
                    <h2>Recent inventory activity</h2>
                    <p>
                      The latest recorded inventory transactions.
                    </p>
                  </div>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setActivePage("inventory")}
                  >
                    View inventory
                    <ArrowRight size={16} />
                  </button>
                </div>

                {movements.length > 0 ? (
                  <div className="activity-list">
                    {movements.slice(0, 5).map((movement) => (
                      <div
                        className="activity-item"
                        key={movement.id}
                      >
                        <div className="activity-icon">
                          <Clock3 size={18} />
                        </div>

                        <div className="activity-details">
                          <strong>
                            {productMap.get(movement.product_id) ??
                              "Product"}
                          </strong>

                          <span>
                            {movement.movement_type
                              .replaceAll("_", " ")
                              .replace(/\b\w/g, (letter) =>
                                letter.toUpperCase()
                              )}
                            {" · "}
                            {movement.note || "Inventory transaction"}
                          </span>
                        </div>

                        <strong
                          className={
                            movement.quantity_change >= 0
                              ? "quantity-positive"
                              : "quantity-negative"
                          }
                        >
                          {movement.quantity_change > 0 ? "+" : ""}
                          {movement.quantity_change}
                        </strong>

                        <span className="activity-date">
                          {new Date(
                            movement.created_at
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    No inventory activity recorded yet.
                  </div>
                )}
              </section>

              {/* Account information */}
              <section className="account-summary">
                <div>
                  <ShieldCheck size={20} />
                  <strong>Account status</strong>
                </div>

                <span className="store-status">
                  Active
                </span>

                <p>
                  Signed in as {user.full_name} ({roleLabel}).
                </p>
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
