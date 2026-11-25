
import { useMemo, useState, type FormEvent } from "react";
import type { Store, User } from "../types";
import {
  ArrowRight,
  Building2,
  MapPin,
  Plus,
  Search,
  Store as StoreIcon,
  X,
  Pencil,
  Power,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";



const API_URL = import.meta.env.VITE_API_URL;

type StoreFormData = {
  name: string;
  code: string;
  address: string;
  city: string;
  province: string;
};

const emptyForm: StoreFormData = {
  name: "",
  code: "",
  address: "",
  city: "",
  province: "Newfoundland and Labrador",
};

interface StoreManagementProps {
  stores: Store[];
  user: User;
  onStoresChanged: () => Promise<void>;
}

export default function StoreManagement({
  stores,
  user,
  onStoresChanged,
}: StoreManagementProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [form, setForm] = useState<StoreFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canManage =
    user.role === "business_owner" || user.role === "super_admin";

  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      const matchesSearch =
        `${store.name} ${store.code} ${store.city ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && store.is_active) ||
        (statusFilter === "inactive" && !store.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [stores, search, statusFilter]);

  function openCreateModal() {
    setEditingStore(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(store: Store) {
    setEditingStore(store);
    setForm({
      name: store.name,
      code: store.code,
      address: store.address ?? "",
      city: store.city ?? "",
      province: store.province ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingStore(null);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const token = sessionStorage.getItem("storesync_token");

      const response = await fetch(
        editingStore
          ? `${API_URL}/stores/${editingStore.id}`
          : `${API_URL}/stores/`,
        {
          method: editingStore ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.detail || "Unable to save store.");
      }

      setModalOpen(false);
      setEditingStore(null);
      await onStoresChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStoreStatus(store: Store) {
    if (!canManage) return;

    const confirmed = window.confirm(
      `${store.is_active ? "Deactivate" : "Activate"} ${store.name}?`
    );

    if (!confirmed) return;

    try {
      const token = sessionStorage.getItem("storesync_token");

      const response = await fetch(`${API_URL}/stores/${store.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !store.is_active }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.detail || "Unable to update store.");
      }

      await onStoresChanged();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Unable to update store."
      );
    }
  }

  const activeCount = stores.filter((store) => store.is_active).length;
  const inactiveCount = stores.length - activeCount;

  return (
    <section className="management-page">
      <div className="management-heading">
        <div>
          <span className="eyebrow">BUSINESS OPERATIONS</span>
          <h1>Store management</h1>
          <p>Manage your retail locations and store information.</p>
        </div>

        {canManage && (
          <button className="primary-button add-store-button" onClick={openCreateModal}>
            <Plus size={18} />
            Add store
          </button>
        )}
      </div>

      <div className="management-stats">
        <article className="management-stat">
          <span>Total stores</span>
          <strong>{stores.length}</strong>
          <Building2 size={20} />
        </article>
        <article className="management-stat">
          <span>Active stores</span>
          <strong>{activeCount}</strong>
          <StoreIcon size={20} />
        </article>
        <article className="management-stat">
          <span>Inactive stores</span>
          <strong>{inactiveCount}</strong>
          <Power size={20} />
        </article>
      </div>

      <div className="directory-panel">
        <div className="directory-toolbar">
          <div>
            <h2>Store directory</h2>
            <p>{filteredStores.length} locations found</p>
          </div>

          <div className="directory-controls">
            <div className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search stores..."
              />
            </div>

            <select
              className="status-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter stores by status"
            >
              <option value="all">All stores</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {filteredStores.length > 0 ? (
          <div className="management-store-grid">
            {filteredStores.map((store) => (
              <article className="management-store-card" key={store.id}>
                <div className="management-card-top">
                  <div className="management-store-icon">
                    <StoreIcon size={21} />
                  </div>
                  <span className={store.is_active ? "store-status" : "store-status inactive"}>
                    {store.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <h3>{store.name}</h3>

                <div className="management-store-meta">
                  <span><MapPin size={14} /> {store.city || "Location not set"}</span>
                  <span><Building2 size={14} /> {store.code}</span>
                </div>

                <div className="management-card-actions">
                  <button
                    className="text-action"
                    onClick={() => setSelectedStore(store)}
                  >
                    View details <ArrowRight size={15} />
                  </button>

                  {canManage && (
                    <div className="icon-actions">
                      <button
                        className="icon-action"
                        title="Edit store"
                        onClick={() => openEditModal(store)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-action"
                        title={store.is_active ? "Deactivate store" : "Activate store"}
                        onClick={() => toggleStoreStatus(store)}
                      >
                        <Power size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="management-empty">
            <StoreIcon size={30} />
            <h3>No stores found</h3>
            <p>Try changing your search or status filter.</p>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeModal();
        }}>
          <section className="store-modal">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">STORE CONFIGURATION</span>
                <h2>{editingStore ? "Edit store" : "Add a new store"}</h2>
                <p>Enter the location's business information.</p>
              </div>
              <button className="icon-action" onClick={closeModal} aria-label="Close">
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="store-form">
              <label>
                Store name
                <input
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. Downtown"
                />
              </label>

              <label>
                Store code
                <input
                  required
                  minLength={2}
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value })}
                  placeholder="e.g. ATZ011"
                />
              </label>

              <label>
                Street address
                <input
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                  placeholder="Street address"
                />
              </label>

              <div className="form-row">
                <label>
                  City
                  <input
                    value={form.city}
                    onChange={(event) => setForm({ ...form, city: event.target.value })}
                    placeholder="City"
                  />
                </label>

                <label>
                  Province
                  <input
                    value={form.province}
                    onChange={(event) => setForm({ ...form, province: event.target.value })}
                    placeholder="Province"
                  />
                </label>
              </div>

              {error && (
                <div className="error-message">
                  <AlertCircle size={17} />
                  {typeof error === "string" ? error : "Unable to save store."}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? <LoaderCircle className="spin" size={17} /> : null}
                  {saving ? "Saving..." : editingStore ? "Save changes" : "Create store"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedStore && (
        <div className="modal-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedStore(null);
        }}>
          <section className="store-modal">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">STORE PROFILE</span>
                <h2>{selectedStore.name}</h2>
                <p>{selectedStore.code}</p>
              </div>
              <button
                className="icon-action"
                onClick={() => setSelectedStore(null)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <div className="store-details-list">
              <div><span>Store name</span><strong>{selectedStore.name}</strong></div>
              <div><span>Store code</span><strong>{selectedStore.code}</strong></div>
              <div><span>Address</span><strong>{selectedStore.address || "Not provided"}</strong></div>
              <div><span>City</span><strong>{selectedStore.city || "Not provided"}</strong></div>
              <div><span>Province</span><strong>{selectedStore.province || "Not provided"}</strong></div>
              <div>
                <span>Status</span>
                <strong>{selectedStore.is_active ? "Active" : "Inactive"}</strong>
              </div>
            </div>

            {canManage && (
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setSelectedStore(null)}>
                  Close
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    const store = selectedStore;
                    setSelectedStore(null);
                    openEditModal(store);
                  }}
                >
                  <Pencil size={16} /> Edit store
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
