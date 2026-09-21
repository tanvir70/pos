# Al-Amin POS & Inventory System — Python (FastAPI) Backend

A high-performance, low-memory asynchronous Python backend engineered for the **Rajib Enterprise Agrochemical Dealership POS & Inventory Management System**.

## 🚀 Key Highlights

1. **Lightweight & cPanel Ready**: Consumes ~50–75 MB RAM (85% reduction compared to Spring Boot's ~600 MB), designed for **HostSeba / CloudLinux shared hosting** via Phusion Passenger WSGI or standalone Uvicorn.
2. **Multi-Database Support**: Native support for **MySQL / MariaDB** (standard on cPanel) and zero-dependency **SQLite** (local development/testing).
3. **100% Zero-Breaking Parity**: Mirrors every single route (`/api/*`), HTTP status code, and `camelCase` JSON wire format used by the React 19 frontend.
4. **7-Digit Gapless Sequence Numbers**:
   - Invoices: `INV-YYYYMMDD-XXXXXXX` (e.g. `INV-20260921-0000042`)
   - Due Receipts: `DUE-YYYYMMDD-XXXXXXX` (e.g. `DUE-20260921-0000005`)
   - Returns: `RET-YYYYMMDD-XXXXXXX` (e.g. `RET-20260921-0000101`)
   - Stock Adjustments: `ADJ-YYYYMMDD-XXXXXXX`
5. **Agrochemical Regulatory Compliance (Pesticide Ordinance 1971)**:
   - Expired lot sales are strictly blocked.
   - Nearest-expiry lot recommendation (FEFO).
   - Damaged chemicals (`isDamaged = true`) automatically route to `QUARANTINE` storage.
   - Negative counter stock is blocked to prevent physical over-selling.

---

## 🛠️ Local Development Setup

### 1. Install Dependencies
```bash
cd backend-python
pip install -r requirements.txt
```

### 2. Run the Development Server
```bash
python run.py
```
- Server starts on `http://localhost:8000`.
- Interactive Swagger API docs are available at `http://localhost:8000/docs`.

### 3. Run Automated Tests
```bash
pytest tests/ -v
```

---

## 🌐 Deploying to cPanel (HostSeba / CloudLinux)

1. Upload the contents of `backend-python/` to your cPanel directory (e.g. `~/pos_backend`).
2. Go to cPanel -> **"Setup Python App"**:
   - Python Version: **3.11** or **3.12**
   - Application Root: `pos_backend`
   - Application URL: `api` (or domain root)
   - Application Startup File: `passenger_wsgi.py`
   - Application Entry point: `application`
3. Click **Create**, then click **Run Pip Install** using `requirements.txt`.
4. Create a MySQL database and user in cPanel -> **MySQL Databases**, and add a `.env` file in `pos_backend/`:
   ```env
   DATABASE_URL=mysql+aiomysql://cpanel_user:cpanel_password@localhost:3306/cpanel_posdb
   SYNC_DATABASE_URL=mysql+pymysql://cpanel_user:cpanel_password@localhost:3306/cpanel_posdb
   JWT_SECRET=YourGeneratedSecureKey32BytesOrLonger
   PORT=8000
   ENV=production
   ```
5. Click **Restart** in the Python App manager.

---

## 🏛️ Endpoints Summary

- **Auth**: `POST /api/auth/login`, `GET /api/auth/me`
- **Products**: `GET /api/products`, `POST /api/products`, `PUT /api/products/{id}`, `DELETE /api/products/{id}`
- **Inventory**: `GET /api/inventory/stock`, `GET /api/inventory/lots`, `POST /api/inventory/lots`, `GET /api/inventory/quarantine`, `POST /api/inventory/quarantine/dispose`, `GET /api/inventory/movements`, `POST /api/inventory/adjustments`, `GET /api/inventory/adjustments`, `GET /api/inventory/valuation`
- **Barcodes**: `GET /api/barcode/{barcode}`, `GET /api/lots/{lotId}/barcode-image`
- **Customers**: `GET /api/customers`, `POST /api/customers`, `GET /api/customers/{id}`, `PUT /api/customers/{id}`, `GET /api/customers/{id}/ledger`, `POST /api/customers/{id}/payments`, `GET /api/customers/{id}/purchases`, `GET /api/customers/next-due-invoice-no`
- **Sales**: `POST /api/sales`, `GET /api/sales/{id}`, `GET /api/sales/invoice/{invoiceNo}`, `GET /api/sales`
- **Returns**: `POST /api/returns`, `GET /api/returns/{id}`, `GET /api/returns`
- **Dashboard**: `GET /api/dashboard/summary`, `GET /api/dashboard/top-selling`
- **Backup**: `GET /api/backup/download` (1-click SQL dump)
- **System / Health**: `GET /api/health`, `GET /health`

