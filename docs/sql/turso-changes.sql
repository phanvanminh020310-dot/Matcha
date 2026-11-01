-- Matcha POS · nhật ký thay đổi (change log) cho Turso/libSQL
-- Mỗi INSERT/UPDATE/DELETE trên 74 bảng được ghi 1 dòng vào sync_changes.
-- Máy khác chỉ hỏi "cho tôi thay đổi từ seq X" → vài KB thay vì tải cả database.

CREATE TABLE IF NOT EXISTS sync_changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  tbl TEXT NOT NULL,
  op TEXT NOT NULL,
  row_id TEXT,
  payload TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sync_changes_tbl ON sync_changes(tbl);

CREATE TRIGGER IF NOT EXISTS trg_admin_accounts_ins AFTER INSERT ON "admin_accounts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('admin_accounts', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'username', NEW."username", 'pass_hash', NEW."pass_hash", 'is_active', NEW."is_active", 'failed_count', NEW."failed_count", 'locked_until', NEW."locked_until", 'last_login', NEW."last_login", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_admin_accounts_upd AFTER UPDATE ON "admin_accounts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('admin_accounts', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'username', NEW."username", 'pass_hash', NEW."pass_hash", 'is_active', NEW."is_active", 'failed_count', NEW."failed_count", 'locked_until', NEW."locked_until", 'last_login', NEW."last_login", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_admin_accounts_del AFTER DELETE ON "admin_accounts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('admin_accounts', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'username', OLD."username", 'pass_hash', OLD."pass_hash", 'is_active', OLD."is_active", 'failed_count', OLD."failed_count", 'locked_until', OLD."locked_until", 'last_login', OLD."last_login", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_admin_sessions_ins AFTER INSERT ON "admin_sessions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('admin_sessions', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'token_hash', NEW."token_hash", 'username', NEW."username", 'expires_at', NEW."expires_at", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_admin_sessions_upd AFTER UPDATE ON "admin_sessions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('admin_sessions', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'token_hash', NEW."token_hash", 'username', NEW."username", 'expires_at', NEW."expires_at", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_admin_sessions_del AFTER DELETE ON "admin_sessions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('admin_sessions', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'token_hash', OLD."token_hash", 'username', OLD."username", 'expires_at', OLD."expires_at", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_app_meta_ins AFTER INSERT ON "app_meta" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('app_meta', 'insert', CAST(NEW.rowid AS TEXT), json_object('key', NEW."key", 'value', NEW."value"));
END;
CREATE TRIGGER IF NOT EXISTS trg_app_meta_upd AFTER UPDATE ON "app_meta" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('app_meta', 'update', CAST(NEW.rowid AS TEXT), json_object('key', NEW."key", 'value', NEW."value"));
END;
CREATE TRIGGER IF NOT EXISTS trg_app_meta_del AFTER DELETE ON "app_meta" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('app_meta', 'delete', CAST(OLD.rowid AS TEXT), json_object('key', OLD."key", 'value', OLD."value"));
END;
CREATE TRIGGER IF NOT EXISTS trg_audit_logs_ins AFTER INSERT ON "audit_logs" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('audit_logs', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'user_id', NEW."user_id", 'action', NEW."action", 'entity', NEW."entity", 'entity_id', NEW."entity_id", 'before_value', NEW."before_value", 'after_value', NEW."after_value", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_audit_logs_upd AFTER UPDATE ON "audit_logs" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('audit_logs', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'user_id', NEW."user_id", 'action', NEW."action", 'entity', NEW."entity", 'entity_id', NEW."entity_id", 'before_value', NEW."before_value", 'after_value', NEW."after_value", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_audit_logs_del AFTER DELETE ON "audit_logs" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('audit_logs', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'user_id', OLD."user_id", 'action', OLD."action", 'entity', OLD."entity", 'entity_id', OLD."entity_id", 'before_value', OLD."before_value", 'after_value', OLD."after_value", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_bank_accounts_ins AFTER INSERT ON "bank_accounts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('bank_accounts', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'bank_bin', NEW."bank_bin", 'bank_name', NEW."bank_name", 'account_no', NEW."account_no", 'account_name', NEW."account_name", 'is_default', NEW."is_default"));
END;
CREATE TRIGGER IF NOT EXISTS trg_bank_accounts_upd AFTER UPDATE ON "bank_accounts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('bank_accounts', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'bank_bin', NEW."bank_bin", 'bank_name', NEW."bank_name", 'account_no', NEW."account_no", 'account_name', NEW."account_name", 'is_default', NEW."is_default"));
END;
CREATE TRIGGER IF NOT EXISTS trg_bank_accounts_del AFTER DELETE ON "bank_accounts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('bank_accounts', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'branch_id', OLD."branch_id", 'bank_bin', OLD."bank_bin", 'bank_name', OLD."bank_name", 'account_no', OLD."account_no", 'account_name', OLD."account_name", 'is_default', OLD."is_default"));
END;
CREATE TRIGGER IF NOT EXISTS trg_branches_ins AFTER INSERT ON "branches" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('branches', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'address', NEW."address", 'city', NEW."city", 'phone', NEW."phone", 'vat_rate', NEW."vat_rate", 'is_active', NEW."is_active", 'opened_at', NEW."opened_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_branches_upd AFTER UPDATE ON "branches" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('branches', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'address', NEW."address", 'city', NEW."city", 'phone', NEW."phone", 'vat_rate', NEW."vat_rate", 'is_active', NEW."is_active", 'opened_at', NEW."opened_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_branches_del AFTER DELETE ON "branches" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('branches', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'name', OLD."name", 'address', OLD."address", 'city', OLD."city", 'phone', OLD."phone", 'vat_rate', OLD."vat_rate", 'is_active', OLD."is_active", 'opened_at', OLD."opened_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_cash_movements_ins AFTER INSERT ON "cash_movements" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('cash_movements', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'session_id', NEW."session_id", 'kind', NEW."kind", 'amount', NEW."amount", 'reason', NEW."reason", 'created_by', NEW."created_by", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_cash_movements_upd AFTER UPDATE ON "cash_movements" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('cash_movements', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'session_id', NEW."session_id", 'kind', NEW."kind", 'amount', NEW."amount", 'reason', NEW."reason", 'created_by', NEW."created_by", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_cash_movements_del AFTER DELETE ON "cash_movements" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('cash_movements', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'session_id', OLD."session_id", 'kind', OLD."kind", 'amount', OLD."amount", 'reason', OLD."reason", 'created_by', OLD."created_by", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_cash_register_sessions_ins AFTER INSERT ON "cash_register_sessions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('cash_register_sessions', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'register', NEW."register", 'opened_by', NEW."opened_by", 'opened_at', NEW."opened_at", 'opening_cash', NEW."opening_cash", 'closed_by', NEW."closed_by", 'closed_at', NEW."closed_at", 'counted_cash', NEW."counted_cash", 'expected_cash', NEW."expected_cash", 'variance', NEW."variance", 'status', NEW."status", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_cash_register_sessions_upd AFTER UPDATE ON "cash_register_sessions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('cash_register_sessions', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'register', NEW."register", 'opened_by', NEW."opened_by", 'opened_at', NEW."opened_at", 'opening_cash', NEW."opening_cash", 'closed_by', NEW."closed_by", 'closed_at', NEW."closed_at", 'counted_cash', NEW."counted_cash", 'expected_cash', NEW."expected_cash", 'variance', NEW."variance", 'status', NEW."status", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_cash_register_sessions_del AFTER DELETE ON "cash_register_sessions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('cash_register_sessions', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'branch_id', OLD."branch_id", 'register', OLD."register", 'opened_by', OLD."opened_by", 'opened_at', OLD."opened_at", 'opening_cash', OLD."opening_cash", 'closed_by', OLD."closed_by", 'closed_at', OLD."closed_at", 'counted_cash', OLD."counted_cash", 'expected_cash', OLD."expected_cash", 'variance', OLD."variance", 'status', OLD."status", 'note', OLD."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_categories_ins AFTER INSERT ON "categories" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('categories', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'name', NEW."name", 'slug', NEW."slug", 'emoji', NEW."emoji", 'sort_order', NEW."sort_order", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_categories_upd AFTER UPDATE ON "categories" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('categories', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'name', NEW."name", 'slug', NEW."slug", 'emoji', NEW."emoji", 'sort_order', NEW."sort_order", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_categories_del AFTER DELETE ON "categories" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('categories', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'name', OLD."name", 'slug', OLD."slug", 'emoji', OLD."emoji", 'sort_order', OLD."sort_order", 'is_active', OLD."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_combo_deal_items_ins AFTER INSERT ON "combo_deal_items" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('combo_deal_items', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'combo_id', NEW."combo_id", 'product_id', NEW."product_id", 'size_code', NEW."size_code", 'qty', NEW."qty"));
END;
CREATE TRIGGER IF NOT EXISTS trg_combo_deal_items_upd AFTER UPDATE ON "combo_deal_items" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('combo_deal_items', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'combo_id', NEW."combo_id", 'product_id', NEW."product_id", 'size_code', NEW."size_code", 'qty', NEW."qty"));
END;
CREATE TRIGGER IF NOT EXISTS trg_combo_deal_items_del AFTER DELETE ON "combo_deal_items" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('combo_deal_items', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'combo_id', OLD."combo_id", 'product_id', OLD."product_id", 'size_code', OLD."size_code", 'qty', OLD."qty"));
END;
CREATE TRIGGER IF NOT EXISTS trg_combo_deals_ins AFTER INSERT ON "combo_deals" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('combo_deals', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'price', NEW."price", 'starts_at', NEW."starts_at", 'ends_at', NEW."ends_at", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_combo_deals_upd AFTER UPDATE ON "combo_deals" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('combo_deals', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'price', NEW."price", 'starts_at', NEW."starts_at", 'ends_at', NEW."ends_at", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_combo_deals_del AFTER DELETE ON "combo_deals" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('combo_deals', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'name', OLD."name", 'price', OLD."price", 'starts_at', OLD."starts_at", 'ends_at', OLD."ends_at", 'is_active', OLD."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_customer_addresses_ins AFTER INSERT ON "customer_addresses" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('customer_addresses', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'customer_id', NEW."customer_id", 'label', NEW."label", 'address', NEW."address", 'lat', NEW."lat", 'lng', NEW."lng", 'is_default', NEW."is_default", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_customer_addresses_upd AFTER UPDATE ON "customer_addresses" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('customer_addresses', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'customer_id', NEW."customer_id", 'label', NEW."label", 'address', NEW."address", 'lat', NEW."lat", 'lng', NEW."lng", 'is_default', NEW."is_default", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_customer_addresses_del AFTER DELETE ON "customer_addresses" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('customer_addresses', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'customer_id', OLD."customer_id", 'label', OLD."label", 'address', OLD."address", 'lat', OLD."lat", 'lng', OLD."lng", 'is_default', OLD."is_default", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_customers_ins AFTER INSERT ON "customers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('customers', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'phone', NEW."phone", 'email', NEW."email", 'birthday', NEW."birthday", 'tier', NEW."tier", 'points', NEW."points", 'total_spent', NEW."total_spent", 'order_count', NEW."order_count", 'note', NEW."note", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_customers_upd AFTER UPDATE ON "customers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('customers', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'phone', NEW."phone", 'email', NEW."email", 'birthday', NEW."birthday", 'tier', NEW."tier", 'points', NEW."points", 'total_spent', NEW."total_spent", 'order_count', NEW."order_count", 'note', NEW."note", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_customers_del AFTER DELETE ON "customers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('customers', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'name', OLD."name", 'phone', OLD."phone", 'email', OLD."email", 'birthday', OLD."birthday", 'tier', OLD."tier", 'points', OLD."points", 'total_spent', OLD."total_spent", 'order_count', OLD."order_count", 'note', OLD."note", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_deliveries_ins AFTER INSERT ON "deliveries" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('deliveries', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'order_id', NEW."order_id", 'branch_id', NEW."branch_id", 'shipper_id', NEW."shipper_id", 'status', NEW."status", 'address', NEW."address", 'district', NEW."district", 'lat', NEW."lat", 'lng', NEW."lng", 'distance_km', NEW."distance_km", 'fee', NEW."fee", 'cod_amount', NEW."cod_amount", 'eta_minutes', NEW."eta_minutes", 'eta_at', NEW."eta_at", 'customer_note', NEW."customer_note", 'proof_photo', NEW."proof_photo", 'rating', NEW."rating", 'fail_reason', NEW."fail_reason", 'created_at', NEW."created_at", 'assigned_at', NEW."assigned_at", 'picked_at', NEW."picked_at", 'delivered_at', NEW."delivered_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_deliveries_upd AFTER UPDATE ON "deliveries" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('deliveries', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'order_id', NEW."order_id", 'branch_id', NEW."branch_id", 'shipper_id', NEW."shipper_id", 'status', NEW."status", 'address', NEW."address", 'district', NEW."district", 'lat', NEW."lat", 'lng', NEW."lng", 'distance_km', NEW."distance_km", 'fee', NEW."fee", 'cod_amount', NEW."cod_amount", 'eta_minutes', NEW."eta_minutes", 'eta_at', NEW."eta_at", 'customer_note', NEW."customer_note", 'proof_photo', NEW."proof_photo", 'rating', NEW."rating", 'fail_reason', NEW."fail_reason", 'created_at', NEW."created_at", 'assigned_at', NEW."assigned_at", 'picked_at', NEW."picked_at", 'delivered_at', NEW."delivered_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_deliveries_del AFTER DELETE ON "deliveries" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('deliveries', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'order_id', OLD."order_id", 'branch_id', OLD."branch_id", 'shipper_id', OLD."shipper_id", 'status', OLD."status", 'address', OLD."address", 'district', OLD."district", 'lat', OLD."lat", 'lng', OLD."lng", 'distance_km', OLD."distance_km", 'fee', OLD."fee", 'cod_amount', OLD."cod_amount", 'eta_minutes', OLD."eta_minutes", 'eta_at', OLD."eta_at", 'customer_note', OLD."customer_note", 'proof_photo', OLD."proof_photo", 'rating', OLD."rating", 'fail_reason', OLD."fail_reason", 'created_at', OLD."created_at", 'assigned_at', OLD."assigned_at", 'picked_at', OLD."picked_at", 'delivered_at', OLD."delivered_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_delivery_events_ins AFTER INSERT ON "delivery_events" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('delivery_events', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'delivery_id', NEW."delivery_id", 'status', NEW."status", 'note', NEW."note", 'lat', NEW."lat", 'lng', NEW."lng", 'actor', NEW."actor", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_delivery_events_upd AFTER UPDATE ON "delivery_events" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('delivery_events', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'delivery_id', NEW."delivery_id", 'status', NEW."status", 'note', NEW."note", 'lat', NEW."lat", 'lng', NEW."lng", 'actor', NEW."actor", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_delivery_events_del AFTER DELETE ON "delivery_events" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('delivery_events', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'delivery_id', OLD."delivery_id", 'status', OLD."status", 'note', OLD."note", 'lat', OLD."lat", 'lng', OLD."lng", 'actor', OLD."actor", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_delivery_zones_ins AFTER INSERT ON "delivery_zones" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('delivery_zones', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'name', NEW."name", 'radius_km', NEW."radius_km", 'base_fee', NEW."base_fee", 'fee_per_km', NEW."fee_per_km", 'free_from', NEW."free_from", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_delivery_zones_upd AFTER UPDATE ON "delivery_zones" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('delivery_zones', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'name', NEW."name", 'radius_km', NEW."radius_km", 'base_fee', NEW."base_fee", 'fee_per_km', NEW."fee_per_km", 'free_from', NEW."free_from", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_delivery_zones_del AFTER DELETE ON "delivery_zones" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('delivery_zones', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'branch_id', OLD."branch_id", 'name', OLD."name", 'radius_km', OLD."radius_km", 'base_fee', OLD."base_fee", 'fee_per_km', OLD."fee_per_km", 'free_from', OLD."free_from", 'is_active', OLD."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_dining_tables_ins AFTER INSERT ON "dining_tables" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('dining_tables', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'code', NEW."code", 'name', NEW."name", 'zone', NEW."zone", 'seats', NEW."seats", 'x', NEW."x", 'y', NEW."y", 'status', NEW."status"));
END;
CREATE TRIGGER IF NOT EXISTS trg_dining_tables_upd AFTER UPDATE ON "dining_tables" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('dining_tables', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'code', NEW."code", 'name', NEW."name", 'zone', NEW."zone", 'seats', NEW."seats", 'x', NEW."x", 'y', NEW."y", 'status', NEW."status"));
END;
CREATE TRIGGER IF NOT EXISTS trg_dining_tables_del AFTER DELETE ON "dining_tables" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('dining_tables', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'branch_id', OLD."branch_id", 'code', OLD."code", 'name', OLD."name", 'zone', OLD."zone", 'seats', OLD."seats", 'x', OLD."x", 'y', OLD."y", 'status', OLD."status"));
END;
CREATE TRIGGER IF NOT EXISTS trg_document_sequences_ins AFTER INSERT ON "document_sequences" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('document_sequences', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'prefix', NEW."prefix", 'next_no', NEW."next_no", 'pad', NEW."pad", 'updated_at', NEW."updated_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_document_sequences_upd AFTER UPDATE ON "document_sequences" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('document_sequences', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'prefix', NEW."prefix", 'next_no', NEW."next_no", 'pad', NEW."pad", 'updated_at', NEW."updated_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_document_sequences_del AFTER DELETE ON "document_sequences" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('document_sequences', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'prefix', OLD."prefix", 'next_no', OLD."next_no", 'pad', OLD."pad", 'updated_at', OLD."updated_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_driver_devices_ins AFTER INSERT ON "driver_devices" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('driver_devices', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'user_id', NEW."user_id", 'device_name', NEW."device_name", 'platform', NEW."platform", 'app_version', NEW."app_version", 'last_seen', NEW."last_seen", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_driver_devices_upd AFTER UPDATE ON "driver_devices" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('driver_devices', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'user_id', NEW."user_id", 'device_name', NEW."device_name", 'platform', NEW."platform", 'app_version', NEW."app_version", 'last_seen', NEW."last_seen", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_driver_devices_del AFTER DELETE ON "driver_devices" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('driver_devices', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'user_id', OLD."user_id", 'device_name', OLD."device_name", 'platform', OLD."platform", 'app_version', OLD."app_version", 'last_seen', OLD."last_seen", 'is_active', OLD."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_driver_positions_ins AFTER INSERT ON "driver_positions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('driver_positions', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'driver_id', NEW."driver_id", 'delivery_id', NEW."delivery_id", 'lat', NEW."lat", 'lng', NEW."lng", 'heading', NEW."heading", 'speed_kmh', NEW."speed_kmh", 'accuracy', NEW."accuracy", 'source', NEW."source", 'recorded_at', NEW."recorded_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_driver_positions_upd AFTER UPDATE ON "driver_positions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('driver_positions', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'driver_id', NEW."driver_id", 'delivery_id', NEW."delivery_id", 'lat', NEW."lat", 'lng', NEW."lng", 'heading', NEW."heading", 'speed_kmh', NEW."speed_kmh", 'accuracy', NEW."accuracy", 'source', NEW."source", 'recorded_at', NEW."recorded_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_driver_positions_del AFTER DELETE ON "driver_positions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('driver_positions', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'driver_id', OLD."driver_id", 'delivery_id', OLD."delivery_id", 'lat', OLD."lat", 'lng', OLD."lng", 'heading', OLD."heading", 'speed_kmh', OLD."speed_kmh", 'accuracy', OLD."accuracy", 'source', OLD."source", 'recorded_at', OLD."recorded_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_expense_categories_ins AFTER INSERT ON "expense_categories" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('expense_categories', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'kind', NEW."kind"));
END;
CREATE TRIGGER IF NOT EXISTS trg_expense_categories_upd AFTER UPDATE ON "expense_categories" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('expense_categories', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'kind', NEW."kind"));
END;
CREATE TRIGGER IF NOT EXISTS trg_expense_categories_del AFTER DELETE ON "expense_categories" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('expense_categories', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'name', OLD."name", 'kind', OLD."kind"));
END;
CREATE TRIGGER IF NOT EXISTS trg_expenses_ins AFTER INSERT ON "expenses" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('expenses', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'category_id', NEW."category_id", 'branch_id', NEW."branch_id", 'amount', NEW."amount", 'spent_at', NEW."spent_at", 'vendor', NEW."vendor", 'note', NEW."note", 'created_by', NEW."created_by", 'status', NEW."status"));
END;
CREATE TRIGGER IF NOT EXISTS trg_expenses_upd AFTER UPDATE ON "expenses" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('expenses', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'category_id', NEW."category_id", 'branch_id', NEW."branch_id", 'amount', NEW."amount", 'spent_at', NEW."spent_at", 'vendor', NEW."vendor", 'note', NEW."note", 'created_by', NEW."created_by", 'status', NEW."status"));
END;
CREATE TRIGGER IF NOT EXISTS trg_expenses_del AFTER DELETE ON "expenses" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('expenses', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'category_id', OLD."category_id", 'branch_id', OLD."branch_id", 'amount', OLD."amount", 'spent_at', OLD."spent_at", 'vendor', OLD."vendor", 'note', OLD."note", 'created_by', OLD."created_by", 'status', OLD."status"));
END;
CREATE TRIGGER IF NOT EXISTS trg_finance_entries_ins AFTER INSERT ON "finance_entries" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('finance_entries', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'entry_date', NEW."entry_date", 'type', NEW."type", 'category', NEW."category", 'amount', NEW."amount", 'ref_type', NEW."ref_type", 'ref_id', NEW."ref_id", 'note', NEW."note", 'created_by', NEW."created_by", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_finance_entries_upd AFTER UPDATE ON "finance_entries" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('finance_entries', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'entry_date', NEW."entry_date", 'type', NEW."type", 'category', NEW."category", 'amount', NEW."amount", 'ref_type', NEW."ref_type", 'ref_id', NEW."ref_id", 'note', NEW."note", 'created_by', NEW."created_by", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_finance_entries_del AFTER DELETE ON "finance_entries" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('finance_entries', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'branch_id', OLD."branch_id", 'entry_date', OLD."entry_date", 'type', OLD."type", 'category', OLD."category", 'amount', OLD."amount", 'ref_type', OLD."ref_type", 'ref_id', OLD."ref_id", 'note', OLD."note", 'created_by', OLD."created_by", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_gift_card_txns_ins AFTER INSERT ON "gift_card_txns" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('gift_card_txns', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'card_id', NEW."card_id", 'order_id', NEW."order_id", 'kind', NEW."kind", 'amount', NEW."amount", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_gift_card_txns_upd AFTER UPDATE ON "gift_card_txns" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('gift_card_txns', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'card_id', NEW."card_id", 'order_id', NEW."order_id", 'kind', NEW."kind", 'amount', NEW."amount", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_gift_card_txns_del AFTER DELETE ON "gift_card_txns" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('gift_card_txns', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'card_id', OLD."card_id", 'order_id', OLD."order_id", 'kind', OLD."kind", 'amount', OLD."amount", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_gift_cards_ins AFTER INSERT ON "gift_cards" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('gift_cards', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'customer_id', NEW."customer_id", 'initial_amount', NEW."initial_amount", 'balance', NEW."balance", 'issued_at', NEW."issued_at", 'expires_at', NEW."expires_at", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_gift_cards_upd AFTER UPDATE ON "gift_cards" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('gift_cards', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'customer_id', NEW."customer_id", 'initial_amount', NEW."initial_amount", 'balance', NEW."balance", 'issued_at', NEW."issued_at", 'expires_at', NEW."expires_at", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_gift_cards_del AFTER DELETE ON "gift_cards" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('gift_cards', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'customer_id', OLD."customer_id", 'initial_amount', OLD."initial_amount", 'balance', OLD."balance", 'issued_at', OLD."issued_at", 'expires_at', OLD."expires_at", 'is_active', OLD."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_ingredient_batches_ins AFTER INSERT ON "ingredient_batches" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('ingredient_batches', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'ingredient_id', NEW."ingredient_id", 'branch_id', NEW."branch_id", 'lot_code', NEW."lot_code", 'supplier_id', NEW."supplier_id", 'mfg_date', NEW."mfg_date", 'exp_date', NEW."exp_date", 'qty_received', NEW."qty_received", 'qty_left', NEW."qty_left", 'unit_cost', NEW."unit_cost"));
END;
CREATE TRIGGER IF NOT EXISTS trg_ingredient_batches_upd AFTER UPDATE ON "ingredient_batches" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('ingredient_batches', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'ingredient_id', NEW."ingredient_id", 'branch_id', NEW."branch_id", 'lot_code', NEW."lot_code", 'supplier_id', NEW."supplier_id", 'mfg_date', NEW."mfg_date", 'exp_date', NEW."exp_date", 'qty_received', NEW."qty_received", 'qty_left', NEW."qty_left", 'unit_cost', NEW."unit_cost"));
END;
CREATE TRIGGER IF NOT EXISTS trg_ingredient_batches_del AFTER DELETE ON "ingredient_batches" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('ingredient_batches', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'ingredient_id', OLD."ingredient_id", 'branch_id', OLD."branch_id", 'lot_code', OLD."lot_code", 'supplier_id', OLD."supplier_id", 'mfg_date', OLD."mfg_date", 'exp_date', OLD."exp_date", 'qty_received', OLD."qty_received", 'qty_left', OLD."qty_left", 'unit_cost', OLD."unit_cost"));
END;
CREATE TRIGGER IF NOT EXISTS trg_ingredients_ins AFTER INSERT ON "ingredients" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('ingredients', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'sku', NEW."sku", 'name', NEW."name", 'category', NEW."category", 'unit', NEW."unit", 'unit_cost', NEW."unit_cost", 'min_stock', NEW."min_stock", 'supplier_id', NEW."supplier_id", 'shelf_life_days', NEW."shelf_life_days", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_ingredients_upd AFTER UPDATE ON "ingredients" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('ingredients', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'sku', NEW."sku", 'name', NEW."name", 'category', NEW."category", 'unit', NEW."unit", 'unit_cost', NEW."unit_cost", 'min_stock', NEW."min_stock", 'supplier_id', NEW."supplier_id", 'shelf_life_days', NEW."shelf_life_days", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_ingredients_del AFTER DELETE ON "ingredients" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('ingredients', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'sku', OLD."sku", 'name', OLD."name", 'category', OLD."category", 'unit', OLD."unit", 'unit_cost', OLD."unit_cost", 'min_stock', OLD."min_stock", 'supplier_id', OLD."supplier_id", 'shelf_life_days', OLD."shelf_life_days", 'is_active', OLD."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_inventory_stock_ins AFTER INSERT ON "inventory_stock" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('inventory_stock', 'insert', CAST(NEW.rowid AS TEXT), json_object('branch_id', NEW."branch_id", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty", 'avg_cost', NEW."avg_cost", 'updated_at', NEW."updated_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_inventory_stock_upd AFTER UPDATE ON "inventory_stock" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('inventory_stock', 'update', CAST(NEW.rowid AS TEXT), json_object('branch_id', NEW."branch_id", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty", 'avg_cost', NEW."avg_cost", 'updated_at', NEW."updated_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_inventory_stock_del AFTER DELETE ON "inventory_stock" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('inventory_stock', 'delete', CAST(OLD.rowid AS TEXT), json_object('branch_id', OLD."branch_id", 'ingredient_id', OLD."ingredient_id", 'qty', OLD."qty", 'avg_cost', OLD."avg_cost", 'updated_at', OLD."updated_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_inventory_txns_ins AFTER INSERT ON "inventory_txns" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('inventory_txns', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'ingredient_id', NEW."ingredient_id", 'txn_type', NEW."txn_type", 'qty', NEW."qty", 'unit_cost', NEW."unit_cost", 'ref_type', NEW."ref_type", 'ref_id', NEW."ref_id", 'note', NEW."note", 'user_id', NEW."user_id", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_inventory_txns_upd AFTER UPDATE ON "inventory_txns" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('inventory_txns', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'ingredient_id', NEW."ingredient_id", 'txn_type', NEW."txn_type", 'qty', NEW."qty", 'unit_cost', NEW."unit_cost", 'ref_type', NEW."ref_type", 'ref_id', NEW."ref_id", 'note', NEW."note", 'user_id', NEW."user_id", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_inventory_txns_del AFTER DELETE ON "inventory_txns" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('inventory_txns', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'branch_id', OLD."branch_id", 'ingredient_id', OLD."ingredient_id", 'txn_type', OLD."txn_type", 'qty', OLD."qty", 'unit_cost', OLD."unit_cost", 'ref_type', OLD."ref_type", 'ref_id', OLD."ref_id", 'note', OLD."note", 'user_id', OLD."user_id", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_invoices_ins AFTER INSERT ON "invoices" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('invoices', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'order_id', NEW."order_id", 'customer_id', NEW."customer_id", 'tax_rate_id', NEW."tax_rate_id", 'issued_at', NEW."issued_at", 'subtotal', NEW."subtotal", 'tax_amount', NEW."tax_amount", 'total', NEW."total", 'e_invoice_no', NEW."e_invoice_no", 'status', NEW."status"));
END;
CREATE TRIGGER IF NOT EXISTS trg_invoices_upd AFTER UPDATE ON "invoices" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('invoices', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'order_id', NEW."order_id", 'customer_id', NEW."customer_id", 'tax_rate_id', NEW."tax_rate_id", 'issued_at', NEW."issued_at", 'subtotal', NEW."subtotal", 'tax_amount', NEW."tax_amount", 'total', NEW."total", 'e_invoice_no', NEW."e_invoice_no", 'status', NEW."status"));
END;
CREATE TRIGGER IF NOT EXISTS trg_invoices_del AFTER DELETE ON "invoices" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('invoices', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'order_id', OLD."order_id", 'customer_id', OLD."customer_id", 'tax_rate_id', OLD."tax_rate_id", 'issued_at', OLD."issued_at", 'subtotal', OLD."subtotal", 'tax_amount', OLD."tax_amount", 'total', OLD."total", 'e_invoice_no', OLD."e_invoice_no", 'status', OLD."status"));
END;
CREATE TRIGGER IF NOT EXISTS trg_kpi_targets_ins AFTER INSERT ON "kpi_targets" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('kpi_targets', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'period', NEW."period", 'metric', NEW."metric", 'target_value', NEW."target_value", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_kpi_targets_upd AFTER UPDATE ON "kpi_targets" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('kpi_targets', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'period', NEW."period", 'metric', NEW."metric", 'target_value', NEW."target_value", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_kpi_targets_del AFTER DELETE ON "kpi_targets" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('kpi_targets', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'branch_id', OLD."branch_id", 'period', OLD."period", 'metric', OLD."metric", 'target_value', OLD."target_value", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_loyalty_accounts_ins AFTER INSERT ON "loyalty_accounts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('loyalty_accounts', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'customer_id', NEW."customer_id", 'tier', NEW."tier", 'points_balance', NEW."points_balance", 'lifetime_points', NEW."lifetime_points", 'joined_at', NEW."joined_at", 'updated_at', NEW."updated_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_loyalty_accounts_upd AFTER UPDATE ON "loyalty_accounts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('loyalty_accounts', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'customer_id', NEW."customer_id", 'tier', NEW."tier", 'points_balance', NEW."points_balance", 'lifetime_points', NEW."lifetime_points", 'joined_at', NEW."joined_at", 'updated_at', NEW."updated_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_loyalty_accounts_del AFTER DELETE ON "loyalty_accounts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('loyalty_accounts', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'customer_id', OLD."customer_id", 'tier', OLD."tier", 'points_balance', OLD."points_balance", 'lifetime_points', OLD."lifetime_points", 'joined_at', OLD."joined_at", 'updated_at', OLD."updated_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_loyalty_ledger_ins AFTER INSERT ON "loyalty_ledger" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('loyalty_ledger', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'customer_id', NEW."customer_id", 'order_id', NEW."order_id", 'delta', NEW."delta", 'balance_after', NEW."balance_after", 'reason', NEW."reason", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_loyalty_ledger_upd AFTER UPDATE ON "loyalty_ledger" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('loyalty_ledger', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'customer_id', NEW."customer_id", 'order_id', NEW."order_id", 'delta', NEW."delta", 'balance_after', NEW."balance_after", 'reason', NEW."reason", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_loyalty_ledger_del AFTER DELETE ON "loyalty_ledger" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('loyalty_ledger', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'customer_id', OLD."customer_id", 'order_id', OLD."order_id", 'delta', OLD."delta", 'balance_after', OLD."balance_after", 'reason', OLD."reason", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_modifier_groups_ins AFTER INSERT ON "modifier_groups" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('modifier_groups', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'kind', NEW."kind", 'is_required', NEW."is_required", 'max_select', NEW."max_select", 'sort_order', NEW."sort_order", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_modifier_groups_upd AFTER UPDATE ON "modifier_groups" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('modifier_groups', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'kind', NEW."kind", 'is_required', NEW."is_required", 'max_select', NEW."max_select", 'sort_order', NEW."sort_order", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_modifier_groups_del AFTER DELETE ON "modifier_groups" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('modifier_groups', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'name', OLD."name", 'kind', OLD."kind", 'is_required', OLD."is_required", 'max_select', OLD."max_select", 'sort_order', OLD."sort_order", 'is_active', OLD."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_modifiers_ins AFTER INSERT ON "modifiers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('modifiers', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'group_id', NEW."group_id", 'name', NEW."name", 'price_delta', NEW."price_delta", 'is_default', NEW."is_default", 'is_active', NEW."is_active", 'sort_order', NEW."sort_order"));
END;
CREATE TRIGGER IF NOT EXISTS trg_modifiers_upd AFTER UPDATE ON "modifiers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('modifiers', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'group_id', NEW."group_id", 'name', NEW."name", 'price_delta', NEW."price_delta", 'is_default', NEW."is_default", 'is_active', NEW."is_active", 'sort_order', NEW."sort_order"));
END;
CREATE TRIGGER IF NOT EXISTS trg_modifiers_del AFTER DELETE ON "modifiers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('modifiers', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'group_id', OLD."group_id", 'name', OLD."name", 'price_delta', OLD."price_delta", 'is_default', OLD."is_default", 'is_active', OLD."is_active", 'sort_order', OLD."sort_order"));
END;
CREATE TRIGGER IF NOT EXISTS trg_notifications_ins AFTER INSERT ON "notifications" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('notifications', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'user_id', NEW."user_id", 'branch_id', NEW."branch_id", 'kind', NEW."kind", 'title', NEW."title", 'body', NEW."body", 'is_read', NEW."is_read", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_notifications_upd AFTER UPDATE ON "notifications" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('notifications', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'user_id', NEW."user_id", 'branch_id', NEW."branch_id", 'kind', NEW."kind", 'title', NEW."title", 'body', NEW."body", 'is_read', NEW."is_read", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_notifications_del AFTER DELETE ON "notifications" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('notifications', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'user_id', OLD."user_id", 'branch_id', OLD."branch_id", 'kind', OLD."kind", 'title', OLD."title", 'body', OLD."body", 'is_read', OLD."is_read", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_order_events_ins AFTER INSERT ON "order_events" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('order_events', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'order_id', NEW."order_id", 'status', NEW."status", 'note', NEW."note", 'user_id', NEW."user_id", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_order_events_upd AFTER UPDATE ON "order_events" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('order_events', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'order_id', NEW."order_id", 'status', NEW."status", 'note', NEW."note", 'user_id', NEW."user_id", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_order_events_del AFTER DELETE ON "order_events" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('order_events', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'order_id', OLD."order_id", 'status', OLD."status", 'note', OLD."note", 'user_id', OLD."user_id", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_order_item_toppings_ins AFTER INSERT ON "order_item_toppings" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('order_item_toppings', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'order_item_id', NEW."order_item_id", 'topping_id', NEW."topping_id", 'topping_name', NEW."topping_name", 'qty', NEW."qty", 'price', NEW."price"));
END;
CREATE TRIGGER IF NOT EXISTS trg_order_item_toppings_upd AFTER UPDATE ON "order_item_toppings" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('order_item_toppings', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'order_item_id', NEW."order_item_id", 'topping_id', NEW."topping_id", 'topping_name', NEW."topping_name", 'qty', NEW."qty", 'price', NEW."price"));
END;
CREATE TRIGGER IF NOT EXISTS trg_order_item_toppings_del AFTER DELETE ON "order_item_toppings" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('order_item_toppings', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'order_item_id', OLD."order_item_id", 'topping_id', OLD."topping_id", 'topping_name', OLD."topping_name", 'qty', OLD."qty", 'price', OLD."price"));
END;
CREATE TRIGGER IF NOT EXISTS trg_order_items_ins AFTER INSERT ON "order_items" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('order_items', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'order_id', NEW."order_id", 'product_id', NEW."product_id", 'product_name', NEW."product_name", 'size_code', NEW."size_code", 'sugar_level', NEW."sugar_level", 'ice_level', NEW."ice_level", 'qty', NEW."qty", 'unit_price', NEW."unit_price", 'discount', NEW."discount", 'unit_cost', NEW."unit_cost", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_order_items_upd AFTER UPDATE ON "order_items" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('order_items', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'order_id', NEW."order_id", 'product_id', NEW."product_id", 'product_name', NEW."product_name", 'size_code', NEW."size_code", 'sugar_level', NEW."sugar_level", 'ice_level', NEW."ice_level", 'qty', NEW."qty", 'unit_price', NEW."unit_price", 'discount', NEW."discount", 'unit_cost', NEW."unit_cost", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_order_items_del AFTER DELETE ON "order_items" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('order_items', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'order_id', OLD."order_id", 'product_id', OLD."product_id", 'product_name', OLD."product_name", 'size_code', OLD."size_code", 'sugar_level', OLD."sugar_level", 'ice_level', OLD."ice_level", 'qty', OLD."qty", 'unit_price', OLD."unit_price", 'discount', OLD."discount", 'unit_cost', OLD."unit_cost", 'note', OLD."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_orders_ins AFTER INSERT ON "orders" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('orders', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'branch_id', NEW."branch_id", 'channel', NEW."channel", 'source', NEW."source", 'table_id', NEW."table_id", 'customer_id', NEW."customer_id", 'cashier_id', NEW."cashier_id", 'shift_id', NEW."shift_id", 'queue_no', NEW."queue_no", 'status', NEW."status", 'subtotal', NEW."subtotal", 'item_discount', NEW."item_discount", 'promotion_discount', NEW."promotion_discount", 'voucher_id', NEW."voucher_id", 'voucher_discount', NEW."voucher_discount", 'vat_amount', NEW."vat_amount", 'delivery_fee', NEW."delivery_fee", 'points_used', NEW."points_used", 'points_earned', NEW."points_earned", 'total', NEW."total", 'cogs', NEW."cogs", 'note', NEW."note", 'cancel_reason', NEW."cancel_reason", 'created_at', NEW."created_at", 'preparing_at', NEW."preparing_at", 'ready_at', NEW."ready_at", 'completed_at', NEW."completed_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_orders_upd AFTER UPDATE ON "orders" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('orders', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'branch_id', NEW."branch_id", 'channel', NEW."channel", 'source', NEW."source", 'table_id', NEW."table_id", 'customer_id', NEW."customer_id", 'cashier_id', NEW."cashier_id", 'shift_id', NEW."shift_id", 'queue_no', NEW."queue_no", 'status', NEW."status", 'subtotal', NEW."subtotal", 'item_discount', NEW."item_discount", 'promotion_discount', NEW."promotion_discount", 'voucher_id', NEW."voucher_id", 'voucher_discount', NEW."voucher_discount", 'vat_amount', NEW."vat_amount", 'delivery_fee', NEW."delivery_fee", 'points_used', NEW."points_used", 'points_earned', NEW."points_earned", 'total', NEW."total", 'cogs', NEW."cogs", 'note', NEW."note", 'cancel_reason', NEW."cancel_reason", 'created_at', NEW."created_at", 'preparing_at', NEW."preparing_at", 'ready_at', NEW."ready_at", 'completed_at', NEW."completed_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_orders_del AFTER DELETE ON "orders" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('orders', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'branch_id', OLD."branch_id", 'channel', OLD."channel", 'source', OLD."source", 'table_id', OLD."table_id", 'customer_id', OLD."customer_id", 'cashier_id', OLD."cashier_id", 'shift_id', OLD."shift_id", 'queue_no', OLD."queue_no", 'status', OLD."status", 'subtotal', OLD."subtotal", 'item_discount', OLD."item_discount", 'promotion_discount', OLD."promotion_discount", 'voucher_id', OLD."voucher_id", 'voucher_discount', OLD."voucher_discount", 'vat_amount', OLD."vat_amount", 'delivery_fee', OLD."delivery_fee", 'points_used', OLD."points_used", 'points_earned', OLD."points_earned", 'total', OLD."total", 'cogs', OLD."cogs", 'note', OLD."note", 'cancel_reason', OLD."cancel_reason", 'created_at', OLD."created_at", 'preparing_at', OLD."preparing_at", 'ready_at', OLD."ready_at", 'completed_at', OLD."completed_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_payments_ins AFTER INSERT ON "payments" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('payments', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'order_id', NEW."order_id", 'method', NEW."method", 'amount', NEW."amount", 'paid_at', NEW."paid_at", 'ref', NEW."ref", 'bank_txn_ref', NEW."bank_txn_ref", 'verified_at', NEW."verified_at", 'verified_by', NEW."verified_by"));
END;
CREATE TRIGGER IF NOT EXISTS trg_payments_upd AFTER UPDATE ON "payments" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('payments', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'order_id', NEW."order_id", 'method', NEW."method", 'amount', NEW."amount", 'paid_at', NEW."paid_at", 'ref', NEW."ref", 'bank_txn_ref', NEW."bank_txn_ref", 'verified_at', NEW."verified_at", 'verified_by', NEW."verified_by"));
END;
CREATE TRIGGER IF NOT EXISTS trg_payments_del AFTER DELETE ON "payments" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('payments', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'order_id', OLD."order_id", 'method', OLD."method", 'amount', OLD."amount", 'paid_at', OLD."paid_at", 'ref', OLD."ref", 'bank_txn_ref', OLD."bank_txn_ref", 'verified_at', OLD."verified_at", 'verified_by', OLD."verified_by"));
END;
CREATE TRIGGER IF NOT EXISTS trg_price_list_items_ins AFTER INSERT ON "price_list_items" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('price_list_items', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'price_list_id', NEW."price_list_id", 'product_id', NEW."product_id", 'size_code', NEW."size_code", 'price', NEW."price"));
END;
CREATE TRIGGER IF NOT EXISTS trg_price_list_items_upd AFTER UPDATE ON "price_list_items" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('price_list_items', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'price_list_id', NEW."price_list_id", 'product_id', NEW."product_id", 'size_code', NEW."size_code", 'price', NEW."price"));
END;
CREATE TRIGGER IF NOT EXISTS trg_price_list_items_del AFTER DELETE ON "price_list_items" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('price_list_items', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'price_list_id', OLD."price_list_id", 'product_id', OLD."product_id", 'size_code', OLD."size_code", 'price', OLD."price"));
END;
CREATE TRIGGER IF NOT EXISTS trg_price_lists_ins AFTER INSERT ON "price_lists" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('price_lists', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'branch_id', NEW."branch_id", 'channel', NEW."channel", 'starts_at', NEW."starts_at", 'ends_at', NEW."ends_at", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_price_lists_upd AFTER UPDATE ON "price_lists" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('price_lists', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'branch_id', NEW."branch_id", 'channel', NEW."channel", 'starts_at', NEW."starts_at", 'ends_at', NEW."ends_at", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_price_lists_del AFTER DELETE ON "price_lists" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('price_lists', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'name', OLD."name", 'branch_id', OLD."branch_id", 'channel', OLD."channel", 'starts_at', OLD."starts_at", 'ends_at', OLD."ends_at", 'is_active', OLD."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_print_jobs_ins AFTER INSERT ON "print_jobs" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('print_jobs', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'template_code', NEW."template_code", 'ref_type', NEW."ref_type", 'ref_id', NEW."ref_id", 'copies', NEW."copies", 'status', NEW."status", 'printer', NEW."printer", 'user_id', NEW."user_id", 'payload', NEW."payload", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_print_jobs_upd AFTER UPDATE ON "print_jobs" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('print_jobs', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'template_code', NEW."template_code", 'ref_type', NEW."ref_type", 'ref_id', NEW."ref_id", 'copies', NEW."copies", 'status', NEW."status", 'printer', NEW."printer", 'user_id', NEW."user_id", 'payload', NEW."payload", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_print_jobs_del AFTER DELETE ON "print_jobs" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('print_jobs', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'template_code', OLD."template_code", 'ref_type', OLD."ref_type", 'ref_id', OLD."ref_id", 'copies', OLD."copies", 'status', OLD."status", 'printer', OLD."printer", 'user_id', OLD."user_id", 'payload', OLD."payload", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_print_templates_ins AFTER INSERT ON "print_templates" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('print_templates', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'kind', NEW."kind", 'paper', NEW."paper", 'width_mm', NEW."width_mm", 'layout', NEW."layout", 'is_default', NEW."is_default", 'updated_at', NEW."updated_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_print_templates_upd AFTER UPDATE ON "print_templates" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('print_templates', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'kind', NEW."kind", 'paper', NEW."paper", 'width_mm', NEW."width_mm", 'layout', NEW."layout", 'is_default', NEW."is_default", 'updated_at', NEW."updated_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_print_templates_del AFTER DELETE ON "print_templates" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('print_templates', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'name', OLD."name", 'kind', OLD."kind", 'paper', OLD."paper", 'width_mm', OLD."width_mm", 'layout', OLD."layout", 'is_default', OLD."is_default", 'updated_at', OLD."updated_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_printer_routes_ins AFTER INSERT ON "printer_routes" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('printer_routes', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'printer_id', NEW."printer_id", 'doc_type', NEW."doc_type", 'template_id', NEW."template_id", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_printer_routes_upd AFTER UPDATE ON "printer_routes" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('printer_routes', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'printer_id', NEW."printer_id", 'doc_type', NEW."doc_type", 'template_id', NEW."template_id", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_printer_routes_del AFTER DELETE ON "printer_routes" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('printer_routes', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'branch_id', OLD."branch_id", 'printer_id', OLD."printer_id", 'doc_type', OLD."doc_type", 'template_id', OLD."template_id", 'is_active', OLD."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_printers_ins AFTER INSERT ON "printers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('printers', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'name', NEW."name", 'kind', NEW."kind", 'target', NEW."target", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_printers_upd AFTER UPDATE ON "printers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('printers', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'name', NEW."name", 'kind', NEW."kind", 'target', NEW."target", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_printers_del AFTER DELETE ON "printers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('printers', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'branch_id', OLD."branch_id", 'name', OLD."name", 'kind', OLD."kind", 'target', OLD."target", 'is_active', OLD."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_product_modifier_groups_ins AFTER INSERT ON "product_modifier_groups" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('product_modifier_groups', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'product_id', NEW."product_id", 'group_id', NEW."group_id"));
END;
CREATE TRIGGER IF NOT EXISTS trg_product_modifier_groups_upd AFTER UPDATE ON "product_modifier_groups" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('product_modifier_groups', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'product_id', NEW."product_id", 'group_id', NEW."group_id"));
END;
CREATE TRIGGER IF NOT EXISTS trg_product_modifier_groups_del AFTER DELETE ON "product_modifier_groups" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('product_modifier_groups', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'product_id', OLD."product_id", 'group_id', OLD."group_id"));
END;
CREATE TRIGGER IF NOT EXISTS trg_product_sizes_ins AFTER INSERT ON "product_sizes" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('product_sizes', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'product_id', NEW."product_id", 'code', NEW."code", 'name', NEW."name", 'price_delta', NEW."price_delta"));
END;
CREATE TRIGGER IF NOT EXISTS trg_product_sizes_upd AFTER UPDATE ON "product_sizes" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('product_sizes', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'product_id', NEW."product_id", 'code', NEW."code", 'name', NEW."name", 'price_delta', NEW."price_delta"));
END;
CREATE TRIGGER IF NOT EXISTS trg_product_sizes_del AFTER DELETE ON "product_sizes" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('product_sizes', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'product_id', OLD."product_id", 'code', OLD."code", 'name', OLD."name", 'price_delta', OLD."price_delta"));
END;
CREATE TRIGGER IF NOT EXISTS trg_product_toppings_ins AFTER INSERT ON "product_toppings" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('product_toppings', 'insert', CAST(NEW.rowid AS TEXT), json_object('product_id', NEW."product_id", 'topping_id', NEW."topping_id"));
END;
CREATE TRIGGER IF NOT EXISTS trg_product_toppings_upd AFTER UPDATE ON "product_toppings" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('product_toppings', 'update', CAST(NEW.rowid AS TEXT), json_object('product_id', NEW."product_id", 'topping_id', NEW."topping_id"));
END;
CREATE TRIGGER IF NOT EXISTS trg_product_toppings_del AFTER DELETE ON "product_toppings" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('product_toppings', 'delete', CAST(OLD.rowid AS TEXT), json_object('product_id', OLD."product_id", 'topping_id', OLD."topping_id"));
END;
CREATE TRIGGER IF NOT EXISTS trg_products_ins AFTER INSERT ON "products" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('products', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'sku', NEW."sku", 'name', NEW."name", 'category_id', NEW."category_id", 'description', NEW."description", 'base_price', NEW."base_price", 'cost_price', NEW."cost_price", 'unit', NEW."unit", 'emoji', NEW."emoji", 'image_url', NEW."image_url", 'is_active', NEW."is_active", 'is_bestseller', NEW."is_bestseller", 'has_size', NEW."has_size", 'sugar_option', NEW."sugar_option", 'ice_option', NEW."ice_option", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_products_upd AFTER UPDATE ON "products" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('products', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'sku', NEW."sku", 'name', NEW."name", 'category_id', NEW."category_id", 'description', NEW."description", 'base_price', NEW."base_price", 'cost_price', NEW."cost_price", 'unit', NEW."unit", 'emoji', NEW."emoji", 'image_url', NEW."image_url", 'is_active', NEW."is_active", 'is_bestseller', NEW."is_bestseller", 'has_size', NEW."has_size", 'sugar_option', NEW."sugar_option", 'ice_option', NEW."ice_option", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_products_del AFTER DELETE ON "products" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('products', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'sku', OLD."sku", 'name', OLD."name", 'category_id', OLD."category_id", 'description', OLD."description", 'base_price', OLD."base_price", 'cost_price', OLD."cost_price", 'unit', OLD."unit", 'emoji', OLD."emoji", 'image_url', OLD."image_url", 'is_active', OLD."is_active", 'is_bestseller', OLD."is_bestseller", 'has_size', OLD."has_size", 'sugar_option', OLD."sugar_option", 'ice_option', OLD."ice_option", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_promotions_ins AFTER INSERT ON "promotions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('promotions', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'name', NEW."name", 'type', NEW."type", 'config', NEW."config", 'branch_id', NEW."branch_id", 'start_at', NEW."start_at", 'end_at', NEW."end_at", 'is_active', NEW."is_active", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_promotions_upd AFTER UPDATE ON "promotions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('promotions', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'name', NEW."name", 'type', NEW."type", 'config', NEW."config", 'branch_id', NEW."branch_id", 'start_at', NEW."start_at", 'end_at', NEW."end_at", 'is_active', NEW."is_active", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_promotions_del AFTER DELETE ON "promotions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('promotions', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'name', OLD."name", 'type', OLD."type", 'config', OLD."config", 'branch_id', OLD."branch_id", 'start_at', OLD."start_at", 'end_at', OLD."end_at", 'is_active', OLD."is_active", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_order_items_ins AFTER INSERT ON "purchase_order_items" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('purchase_order_items', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'po_id', NEW."po_id", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty", 'unit_cost', NEW."unit_cost", 'amount', NEW."amount"));
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_order_items_upd AFTER UPDATE ON "purchase_order_items" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('purchase_order_items', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'po_id', NEW."po_id", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty", 'unit_cost', NEW."unit_cost", 'amount', NEW."amount"));
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_order_items_del AFTER DELETE ON "purchase_order_items" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('purchase_order_items', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'po_id', OLD."po_id", 'ingredient_id', OLD."ingredient_id", 'qty', OLD."qty", 'unit_cost', OLD."unit_cost", 'amount', OLD."amount"));
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_orders_ins AFTER INSERT ON "purchase_orders" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('purchase_orders', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'supplier_id', NEW."supplier_id", 'branch_id', NEW."branch_id", 'status', NEW."status", 'subtotal', NEW."subtotal", 'vat', NEW."vat", 'total', NEW."total", 'note', NEW."note", 'created_by', NEW."created_by", 'created_at', NEW."created_at", 'received_at', NEW."received_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_orders_upd AFTER UPDATE ON "purchase_orders" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('purchase_orders', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'supplier_id', NEW."supplier_id", 'branch_id', NEW."branch_id", 'status', NEW."status", 'subtotal', NEW."subtotal", 'vat', NEW."vat", 'total', NEW."total", 'note', NEW."note", 'created_by', NEW."created_by", 'created_at', NEW."created_at", 'received_at', NEW."received_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_orders_del AFTER DELETE ON "purchase_orders" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('purchase_orders', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'supplier_id', OLD."supplier_id", 'branch_id', OLD."branch_id", 'status', OLD."status", 'subtotal', OLD."subtotal", 'vat', OLD."vat", 'total', OLD."total", 'note', OLD."note", 'created_by', OLD."created_by", 'created_at', OLD."created_at", 'received_at', OLD."received_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_requisition_lines_ins AFTER INSERT ON "purchase_requisition_lines" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('purchase_requisition_lines', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'requisition_id', NEW."requisition_id", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_requisition_lines_upd AFTER UPDATE ON "purchase_requisition_lines" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('purchase_requisition_lines', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'requisition_id', NEW."requisition_id", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_requisition_lines_del AFTER DELETE ON "purchase_requisition_lines" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('purchase_requisition_lines', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'requisition_id', OLD."requisition_id", 'ingredient_id', OLD."ingredient_id", 'qty', OLD."qty", 'note', OLD."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_requisitions_ins AFTER INSERT ON "purchase_requisitions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('purchase_requisitions', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'branch_id', NEW."branch_id", 'requested_by', NEW."requested_by", 'needed_at', NEW."needed_at", 'status', NEW."status", 'note', NEW."note", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_requisitions_upd AFTER UPDATE ON "purchase_requisitions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('purchase_requisitions', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'branch_id', NEW."branch_id", 'requested_by', NEW."requested_by", 'needed_at', NEW."needed_at", 'status', NEW."status", 'note', NEW."note", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_requisitions_del AFTER DELETE ON "purchase_requisitions" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('purchase_requisitions', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'branch_id', OLD."branch_id", 'requested_by', OLD."requested_by", 'needed_at', OLD."needed_at", 'status', OLD."status", 'note', OLD."note", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_recipes_ins AFTER INSERT ON "recipes" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('recipes', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'product_id', NEW."product_id", 'size_code', NEW."size_code", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty"));
END;
CREATE TRIGGER IF NOT EXISTS trg_recipes_upd AFTER UPDATE ON "recipes" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('recipes', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'product_id', NEW."product_id", 'size_code', NEW."size_code", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty"));
END;
CREATE TRIGGER IF NOT EXISTS trg_recipes_del AFTER DELETE ON "recipes" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('recipes', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'product_id', OLD."product_id", 'size_code', OLD."size_code", 'ingredient_id', OLD."ingredient_id", 'qty', OLD."qty"));
END;
CREATE TRIGGER IF NOT EXISTS trg_reservations_ins AFTER INSERT ON "reservations" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('reservations', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'branch_id', NEW."branch_id", 'customer_id', NEW."customer_id", 'table_id', NEW."table_id", 'party_size', NEW."party_size", 'start_at', NEW."start_at", 'duration_min', NEW."duration_min", 'status', NEW."status", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_reservations_upd AFTER UPDATE ON "reservations" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('reservations', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'branch_id', NEW."branch_id", 'customer_id', NEW."customer_id", 'table_id', NEW."table_id", 'party_size', NEW."party_size", 'start_at', NEW."start_at", 'duration_min', NEW."duration_min", 'status', NEW."status", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_reservations_del AFTER DELETE ON "reservations" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('reservations', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'branch_id', OLD."branch_id", 'customer_id', OLD."customer_id", 'table_id', OLD."table_id", 'party_size', OLD."party_size", 'start_at', OLD."start_at", 'duration_min', OLD."duration_min", 'status', OLD."status", 'note', OLD."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_rider_payouts_ins AFTER INSERT ON "rider_payouts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('rider_payouts', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'driver_id', NEW."driver_id", 'period_start', NEW."period_start", 'period_end', NEW."period_end", 'deliveries', NEW."deliveries", 'cod_collected', NEW."cod_collected", 'fee_earned', NEW."fee_earned", 'bonus', NEW."bonus", 'deducted', NEW."deducted", 'net', NEW."net", 'status', NEW."status", 'paid_at', NEW."paid_at", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_rider_payouts_upd AFTER UPDATE ON "rider_payouts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('rider_payouts', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'driver_id', NEW."driver_id", 'period_start', NEW."period_start", 'period_end', NEW."period_end", 'deliveries', NEW."deliveries", 'cod_collected', NEW."cod_collected", 'fee_earned', NEW."fee_earned", 'bonus', NEW."bonus", 'deducted', NEW."deducted", 'net', NEW."net", 'status', NEW."status", 'paid_at', NEW."paid_at", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_rider_payouts_del AFTER DELETE ON "rider_payouts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('rider_payouts', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'driver_id', OLD."driver_id", 'period_start', OLD."period_start", 'period_end', OLD."period_end", 'deliveries', OLD."deliveries", 'cod_collected', OLD."cod_collected", 'fee_earned', OLD."fee_earned", 'bonus', OLD."bonus", 'deducted', OLD."deducted", 'net', OLD."net", 'status', OLD."status", 'paid_at', OLD."paid_at", 'note', OLD."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_roles_ins AFTER INSERT ON "roles" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('roles', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'name', NEW."name", 'description', NEW."description", 'perms', NEW."perms", 'is_system', NEW."is_system", 'color', NEW."color", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_roles_upd AFTER UPDATE ON "roles" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('roles', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'name', NEW."name", 'description', NEW."description", 'perms', NEW."perms", 'is_system', NEW."is_system", 'color', NEW."color", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_roles_del AFTER DELETE ON "roles" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('roles', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'name', OLD."name", 'description', OLD."description", 'perms', OLD."perms", 'is_system', OLD."is_system", 'color', OLD."color", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_shift_cash_txns_ins AFTER INSERT ON "shift_cash_txns" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('shift_cash_txns', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'shift_id', NEW."shift_id", 'type', NEW."type", 'amount', NEW."amount", 'reason', NEW."reason", 'user_id', NEW."user_id", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_shift_cash_txns_upd AFTER UPDATE ON "shift_cash_txns" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('shift_cash_txns', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'shift_id', NEW."shift_id", 'type', NEW."type", 'amount', NEW."amount", 'reason', NEW."reason", 'user_id', NEW."user_id", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_shift_cash_txns_del AFTER DELETE ON "shift_cash_txns" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('shift_cash_txns', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'shift_id', OLD."shift_id", 'type', OLD."type", 'amount', OLD."amount", 'reason', OLD."reason", 'user_id', OLD."user_id", 'created_at', OLD."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_shifts_ins AFTER INSERT ON "shifts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('shifts', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'user_id', NEW."user_id", 'opened_at', NEW."opened_at", 'closed_at', NEW."closed_at", 'opening_cash', NEW."opening_cash", 'cash_in', NEW."cash_in", 'cash_out', NEW."cash_out", 'counted_cash', NEW."counted_cash", 'expected_cash', NEW."expected_cash", 'variance', NEW."variance", 'status', NEW."status", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_shifts_upd AFTER UPDATE ON "shifts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('shifts', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'user_id', NEW."user_id", 'opened_at', NEW."opened_at", 'closed_at', NEW."closed_at", 'opening_cash', NEW."opening_cash", 'cash_in', NEW."cash_in", 'cash_out', NEW."cash_out", 'counted_cash', NEW."counted_cash", 'expected_cash', NEW."expected_cash", 'variance', NEW."variance", 'status', NEW."status", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_shifts_del AFTER DELETE ON "shifts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('shifts', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'branch_id', OLD."branch_id", 'user_id', OLD."user_id", 'opened_at', OLD."opened_at", 'closed_at', OLD."closed_at", 'opening_cash', OLD."opening_cash", 'cash_in', OLD."cash_in", 'cash_out', OLD."cash_out", 'counted_cash', OLD."counted_cash", 'expected_cash', OLD."expected_cash", 'variance', OLD."variance", 'status', OLD."status", 'note', OLD."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_stock_count_lines_ins AFTER INSERT ON "stock_count_lines" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('stock_count_lines', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'count_id', NEW."count_id", 'ingredient_id', NEW."ingredient_id", 'system_qty', NEW."system_qty", 'counted_qty', NEW."counted_qty", 'variance', NEW."variance", 'unit_cost', NEW."unit_cost"));
END;
CREATE TRIGGER IF NOT EXISTS trg_stock_count_lines_upd AFTER UPDATE ON "stock_count_lines" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('stock_count_lines', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'count_id', NEW."count_id", 'ingredient_id', NEW."ingredient_id", 'system_qty', NEW."system_qty", 'counted_qty', NEW."counted_qty", 'variance', NEW."variance", 'unit_cost', NEW."unit_cost"));
END;
CREATE TRIGGER IF NOT EXISTS trg_stock_count_lines_del AFTER DELETE ON "stock_count_lines" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('stock_count_lines', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'count_id', OLD."count_id", 'ingredient_id', OLD."ingredient_id", 'system_qty', OLD."system_qty", 'counted_qty', OLD."counted_qty", 'variance', OLD."variance", 'unit_cost', OLD."unit_cost"));
END;
CREATE TRIGGER IF NOT EXISTS trg_stock_counts_ins AFTER INSERT ON "stock_counts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('stock_counts', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'branch_id', NEW."branch_id", 'warehouse_id', NEW."warehouse_id", 'counted_by', NEW."counted_by", 'counted_at', NEW."counted_at", 'status', NEW."status", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_stock_counts_upd AFTER UPDATE ON "stock_counts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('stock_counts', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'branch_id', NEW."branch_id", 'warehouse_id', NEW."warehouse_id", 'counted_by', NEW."counted_by", 'counted_at', NEW."counted_at", 'status', NEW."status", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_stock_counts_del AFTER DELETE ON "stock_counts" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('stock_counts', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'branch_id', OLD."branch_id", 'warehouse_id', OLD."warehouse_id", 'counted_by', OLD."counted_by", 'counted_at', OLD."counted_at", 'status', OLD."status", 'note', OLD."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_stock_transfer_lines_ins AFTER INSERT ON "stock_transfer_lines" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('stock_transfer_lines', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'transfer_id', NEW."transfer_id", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty", 'unit_cost', NEW."unit_cost"));
END;
CREATE TRIGGER IF NOT EXISTS trg_stock_transfer_lines_upd AFTER UPDATE ON "stock_transfer_lines" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('stock_transfer_lines', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'transfer_id', NEW."transfer_id", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty", 'unit_cost', NEW."unit_cost"));
END;
CREATE TRIGGER IF NOT EXISTS trg_stock_transfer_lines_del AFTER DELETE ON "stock_transfer_lines" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('stock_transfer_lines', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'transfer_id', OLD."transfer_id", 'ingredient_id', OLD."ingredient_id", 'qty', OLD."qty", 'unit_cost', OLD."unit_cost"));
END;
CREATE TRIGGER IF NOT EXISTS trg_stock_transfers_ins AFTER INSERT ON "stock_transfers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('stock_transfers', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'from_branch_id', NEW."from_branch_id", 'to_branch_id', NEW."to_branch_id", 'created_by', NEW."created_by", 'status', NEW."status", 'shipped_at', NEW."shipped_at", 'received_at', NEW."received_at", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_stock_transfers_upd AFTER UPDATE ON "stock_transfers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('stock_transfers', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'from_branch_id', NEW."from_branch_id", 'to_branch_id', NEW."to_branch_id", 'created_by', NEW."created_by", 'status', NEW."status", 'shipped_at', NEW."shipped_at", 'received_at', NEW."received_at", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_stock_transfers_del AFTER DELETE ON "stock_transfers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('stock_transfers', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'from_branch_id', OLD."from_branch_id", 'to_branch_id', OLD."to_branch_id", 'created_by', OLD."created_by", 'status', OLD."status", 'shipped_at', OLD."shipped_at", 'received_at', OLD."received_at", 'note', OLD."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_supplier_invoice_lines_ins AFTER INSERT ON "supplier_invoice_lines" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('supplier_invoice_lines', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'invoice_id', NEW."invoice_id", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty", 'unit_cost', NEW."unit_cost", 'amount', NEW."amount"));
END;
CREATE TRIGGER IF NOT EXISTS trg_supplier_invoice_lines_upd AFTER UPDATE ON "supplier_invoice_lines" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('supplier_invoice_lines', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'invoice_id', NEW."invoice_id", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty", 'unit_cost', NEW."unit_cost", 'amount', NEW."amount"));
END;
CREATE TRIGGER IF NOT EXISTS trg_supplier_invoice_lines_del AFTER DELETE ON "supplier_invoice_lines" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('supplier_invoice_lines', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'invoice_id', OLD."invoice_id", 'ingredient_id', OLD."ingredient_id", 'qty', OLD."qty", 'unit_cost', OLD."unit_cost", 'amount', OLD."amount"));
END;
CREATE TRIGGER IF NOT EXISTS trg_supplier_invoices_ins AFTER INSERT ON "supplier_invoices" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('supplier_invoices', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'supplier_id', NEW."supplier_id", 'po_id', NEW."po_id", 'issued_at', NEW."issued_at", 'due_at', NEW."due_at", 'amount', NEW."amount", 'paid_amount', NEW."paid_amount", 'status', NEW."status", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_supplier_invoices_upd AFTER UPDATE ON "supplier_invoices" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('supplier_invoices', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'supplier_id', NEW."supplier_id", 'po_id', NEW."po_id", 'issued_at', NEW."issued_at", 'due_at', NEW."due_at", 'amount', NEW."amount", 'paid_amount', NEW."paid_amount", 'status', NEW."status", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_supplier_invoices_del AFTER DELETE ON "supplier_invoices" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('supplier_invoices', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'supplier_id', OLD."supplier_id", 'po_id', OLD."po_id", 'issued_at', OLD."issued_at", 'due_at', OLD."due_at", 'amount', OLD."amount", 'paid_amount', OLD."paid_amount", 'status', OLD."status", 'note', OLD."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_supplier_payments_ins AFTER INSERT ON "supplier_payments" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('supplier_payments', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'supplier_id', NEW."supplier_id", 'invoice_id', NEW."invoice_id", 'amount', NEW."amount", 'method', NEW."method", 'reference', NEW."reference", 'paid_at', NEW."paid_at", 'created_by', NEW."created_by", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_supplier_payments_upd AFTER UPDATE ON "supplier_payments" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('supplier_payments', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'supplier_id', NEW."supplier_id", 'invoice_id', NEW."invoice_id", 'amount', NEW."amount", 'method', NEW."method", 'reference', NEW."reference", 'paid_at', NEW."paid_at", 'created_by', NEW."created_by", 'note', NEW."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_supplier_payments_del AFTER DELETE ON "supplier_payments" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('supplier_payments', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'supplier_id', OLD."supplier_id", 'invoice_id', OLD."invoice_id", 'amount', OLD."amount", 'method', OLD."method", 'reference', OLD."reference", 'paid_at', OLD."paid_at", 'created_by', OLD."created_by", 'note', OLD."note"));
END;
CREATE TRIGGER IF NOT EXISTS trg_suppliers_ins AFTER INSERT ON "suppliers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('suppliers', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'contact_name', NEW."contact_name", 'phone', NEW."phone", 'email', NEW."email", 'address', NEW."address", 'debt', NEW."debt", 'payment_terms', NEW."payment_terms"));
END;
CREATE TRIGGER IF NOT EXISTS trg_suppliers_upd AFTER UPDATE ON "suppliers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('suppliers', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'contact_name', NEW."contact_name", 'phone', NEW."phone", 'email', NEW."email", 'address', NEW."address", 'debt', NEW."debt", 'payment_terms', NEW."payment_terms"));
END;
CREATE TRIGGER IF NOT EXISTS trg_suppliers_del AFTER DELETE ON "suppliers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('suppliers', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'name', OLD."name", 'contact_name', OLD."contact_name", 'phone', OLD."phone", 'email', OLD."email", 'address', OLD."address", 'debt', OLD."debt", 'payment_terms', OLD."payment_terms"));
END;
CREATE TRIGGER IF NOT EXISTS trg_sync_tokens_ins AFTER INSERT ON "sync_tokens" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('sync_tokens', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'label', NEW."label", 'token_hash', NEW."token_hash", 'branch_id', NEW."branch_id", 'active', NEW."active", 'note', NEW."note", 'created_at', NEW."created_at", 'can_write', NEW."can_write"));
END;
CREATE TRIGGER IF NOT EXISTS trg_sync_tokens_upd AFTER UPDATE ON "sync_tokens" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('sync_tokens', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'label', NEW."label", 'token_hash', NEW."token_hash", 'branch_id', NEW."branch_id", 'active', NEW."active", 'note', NEW."note", 'created_at', NEW."created_at", 'can_write', NEW."can_write"));
END;
CREATE TRIGGER IF NOT EXISTS trg_sync_tokens_del AFTER DELETE ON "sync_tokens" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('sync_tokens', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'label', OLD."label", 'token_hash', OLD."token_hash", 'branch_id', OLD."branch_id", 'active', OLD."active", 'note', OLD."note", 'created_at', OLD."created_at", 'can_write', OLD."can_write"));
END;
CREATE TRIGGER IF NOT EXISTS trg_tax_rates_ins AFTER INSERT ON "tax_rates" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('tax_rates', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'rate', NEW."rate", 'is_inclusive', NEW."is_inclusive", 'is_default', NEW."is_default"));
END;
CREATE TRIGGER IF NOT EXISTS trg_tax_rates_upd AFTER UPDATE ON "tax_rates" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('tax_rates', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'rate', NEW."rate", 'is_inclusive', NEW."is_inclusive", 'is_default', NEW."is_default"));
END;
CREATE TRIGGER IF NOT EXISTS trg_tax_rates_del AFTER DELETE ON "tax_rates" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('tax_rates', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'name', OLD."name", 'rate', OLD."rate", 'is_inclusive', OLD."is_inclusive", 'is_default', OLD."is_default"));
END;
CREATE TRIGGER IF NOT EXISTS trg_toppings_ins AFTER INSERT ON "toppings" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('toppings', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'name', NEW."name", 'price', NEW."price", 'unit', NEW."unit", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_toppings_upd AFTER UPDATE ON "toppings" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('toppings', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'name', NEW."name", 'price', NEW."price", 'unit', NEW."unit", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_toppings_del AFTER DELETE ON "toppings" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('toppings', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'name', OLD."name", 'price', OLD."price", 'unit', OLD."unit", 'is_active', OLD."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_users_ins AFTER INSERT ON "users" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('users', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'name', NEW."name", 'email', NEW."email", 'phone', NEW."phone", 'password', NEW."password", 'role', NEW."role", 'branch_id', NEW."branch_id", 'salary', NEW."salary", 'is_active', NEW."is_active", 'hired_at', NEW."hired_at", 'avatar_emoji', NEW."avatar_emoji"));
END;
CREATE TRIGGER IF NOT EXISTS trg_users_upd AFTER UPDATE ON "users" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('users', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'name', NEW."name", 'email', NEW."email", 'phone', NEW."phone", 'password', NEW."password", 'role', NEW."role", 'branch_id', NEW."branch_id", 'salary', NEW."salary", 'is_active', NEW."is_active", 'hired_at', NEW."hired_at", 'avatar_emoji', NEW."avatar_emoji"));
END;
CREATE TRIGGER IF NOT EXISTS trg_users_del AFTER DELETE ON "users" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('users', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'name', OLD."name", 'email', OLD."email", 'phone', OLD."phone", 'password', OLD."password", 'role', OLD."role", 'branch_id', OLD."branch_id", 'salary', OLD."salary", 'is_active', OLD."is_active", 'hired_at', OLD."hired_at", 'avatar_emoji', OLD."avatar_emoji"));
END;
CREATE TRIGGER IF NOT EXISTS trg_vouchers_ins AFTER INSERT ON "vouchers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('vouchers', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'campaign', NEW."campaign", 'type', NEW."type", 'value', NEW."value", 'min_order', NEW."min_order", 'max_discount', NEW."max_discount", 'usage_limit', NEW."usage_limit", 'used_count', NEW."used_count", 'tier_required', NEW."tier_required", 'start_at', NEW."start_at", 'end_at', NEW."end_at", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_vouchers_upd AFTER UPDATE ON "vouchers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('vouchers', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'code', NEW."code", 'name', NEW."name", 'campaign', NEW."campaign", 'type', NEW."type", 'value', NEW."value", 'min_order', NEW."min_order", 'max_discount', NEW."max_discount", 'usage_limit', NEW."usage_limit", 'used_count', NEW."used_count", 'tier_required', NEW."tier_required", 'start_at', NEW."start_at", 'end_at', NEW."end_at", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_vouchers_del AFTER DELETE ON "vouchers" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('vouchers', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'code', OLD."code", 'name', OLD."name", 'campaign', OLD."campaign", 'type', OLD."type", 'value', OLD."value", 'min_order', OLD."min_order", 'max_discount', OLD."max_discount", 'usage_limit', OLD."usage_limit", 'used_count', OLD."used_count", 'tier_required', OLD."tier_required", 'start_at', OLD."start_at", 'end_at', OLD."end_at", 'is_active', OLD."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_warehouses_ins AFTER INSERT ON "warehouses" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('warehouses', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'code', NEW."code", 'name', NEW."name", 'kind', NEW."kind", 'address', NEW."address", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_warehouses_upd AFTER UPDATE ON "warehouses" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('warehouses', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'code', NEW."code", 'name', NEW."name", 'kind', NEW."kind", 'address', NEW."address", 'is_active', NEW."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_warehouses_del AFTER DELETE ON "warehouses" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('warehouses', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'branch_id', OLD."branch_id", 'code', OLD."code", 'name', OLD."name", 'kind', OLD."kind", 'address', OLD."address", 'is_active', OLD."is_active"));
END;
CREATE TRIGGER IF NOT EXISTS trg_wastage_logs_ins AFTER INSERT ON "wastage_logs" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('wastage_logs', 'insert', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty", 'unit', NEW."unit", 'reason', NEW."reason", 'unit_cost', NEW."unit_cost", 'logged_by', NEW."logged_by", 'note', NEW."note", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_wastage_logs_upd AFTER UPDATE ON "wastage_logs" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('wastage_logs', 'update', CAST(NEW.id AS TEXT), json_object('id', NEW."id", 'branch_id', NEW."branch_id", 'ingredient_id', NEW."ingredient_id", 'qty', NEW."qty", 'unit', NEW."unit", 'reason', NEW."reason", 'unit_cost', NEW."unit_cost", 'logged_by', NEW."logged_by", 'note', NEW."note", 'created_at', NEW."created_at"));
END;
CREATE TRIGGER IF NOT EXISTS trg_wastage_logs_del AFTER DELETE ON "wastage_logs" BEGIN
  INSERT INTO sync_changes (tbl, op, row_id, payload) VALUES ('wastage_logs', 'delete', CAST(OLD.id AS TEXT), json_object('id', OLD."id", 'branch_id', OLD."branch_id", 'ingredient_id', OLD."ingredient_id", 'qty', OLD."qty", 'unit', OLD."unit", 'reason', OLD."reason", 'unit_cost', OLD."unit_cost", 'logged_by', OLD."logged_by", 'note', OLD."note", 'created_at', OLD."created_at"));
END;
