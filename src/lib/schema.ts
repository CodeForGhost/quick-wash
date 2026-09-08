// Self-contained SQLite schema (SRS section 10). Kept as a TypeScript string so
// it is bundled with the server build instead of being read from disk at runtime.

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

-- 10.1 Users -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  phone         TEXT    NOT NULL UNIQUE,
  email         TEXT,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('CUSTOMER','PICKUP_AGENT','SHOP_STAFF','ADMIN')),
  shop_id       INTEGER REFERENCES laundry_shops(id) ON DELETE SET NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 10.5 Laundry shops ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS laundry_shops (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  phone      TEXT,
  address    TEXT,
  latitude   REAL,
  longitude  REAL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 10.2 Addresses -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT    NOT NULL,
  address    TEXT    NOT NULL,
  area       TEXT,
  landmark   TEXT,
  latitude   REAL,
  longitude  REAL,
  phone      TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- 10.3 Laundry orders --------------------------------------------------------
CREATE TABLE IF NOT EXISTS laundry_orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number      TEXT    NOT NULL UNIQUE,
  customer_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  pickup_agent_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  delivery_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  laundry_shop_id   INTEGER REFERENCES laundry_shops(id) ON DELETE SET NULL,
  status            TEXT    NOT NULL DEFAULT 'PENDING',
  pickup_address_id INTEGER NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
  pickup_date       TEXT    NOT NULL,
  pickup_time_slot  TEXT    NOT NULL,
  bag_count         INTEGER NOT NULL,
  item_count        INTEGER,
  actual_bag_count  INTEGER,
  price             REAL,
  notes             TEXT,
  picked_up_at      TEXT,
  received_at       TEXT,
  ready_at          TEXT,
  delivered_at      TEXT,
  cancelled_at      TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON laundry_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON laundry_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_pickup   ON laundry_orders(pickup_agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery ON laundry_orders(delivery_agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_date     ON laundry_orders(pickup_date);

-- 10.4 Order status history --------------------------------------------------
CREATE TABLE IF NOT EXISTS order_status_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES laundry_orders(id) ON DELETE CASCADE,
  status     TEXT    NOT NULL,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes      TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_history_order ON order_status_history(order_id);

-- 10.6 Pickup routes ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS pickup_routes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT,
  agent_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  route_date TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_routes_agent ON pickup_routes(agent_id, route_date);

-- 10.7 Route orders ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_orders (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER NOT NULL REFERENCES pickup_routes(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES laundry_orders(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 1,
  status   TEXT    NOT NULL DEFAULT 'PENDING',
  UNIQUE (route_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_route_orders_route ON route_orders(route_id);

-- Notifications (FR-021) -----------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id   INTEGER REFERENCES laundry_orders(id) ON DELETE CASCADE,
  event      TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- Sessions -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Order-number counter (BR-002) ----------------------------------------------
CREATE TABLE IF NOT EXISTS order_counters (
  year INTEGER PRIMARY KEY,
  last INTEGER NOT NULL DEFAULT 0
);

-- System settings ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
