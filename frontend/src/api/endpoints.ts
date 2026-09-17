// ============================================================================
// Typed REST Endpoints for Al-Amin Traders POS & Inventory
// ============================================================================

import { apiClient, downloadBlob, API_BASE_URL } from "./client"
import type {
  Product,
  InventoryLot,
  StockItem,
  LotEntryRequest,
  Customer,
  CustomerRequest,
  CustomerLedger,
  CustomerPaymentRequest,
  SaleRequest,
  SaleResponse,
  SaleReturnRequest,
  SaleReturnResponse,
  DashboardSummary,
  AuthTokenResponse,
  PinVerificationRequest,
} from "../types"

// ----------------------------------------------------------------------------
// 1. Products
// ----------------------------------------------------------------------------

export async function getProducts(query?: string): Promise<Product[]> {
  const url =
    query && query.trim()
      ? `/products?query=${encodeURIComponent(query.trim())}`
      : "/products"
  return apiClient<Product[]>(url)
}

export async function createProduct(
  product: Partial<Product>,
): Promise<Product> {
  return apiClient<Product>("/products", {
    method: "POST",
    body: JSON.stringify(product),
  })
}

// ----------------------------------------------------------------------------
// 2. Inventory & Lots
// ----------------------------------------------------------------------------

export async function getStock(): Promise<StockItem[]> {
  return apiClient<StockItem[]>("/inventory/stock")
}

export async function getLots(
  productId?: number,
  fefo = false,
): Promise<InventoryLot[]> {
  const params = new URLSearchParams()
  if (productId != null) {
    params.set("productId", productId.toString())
  }
  if (fefo) {
    params.set("fefo", "true")
  }
  const qs = params.toString()
  return apiClient<InventoryLot[]>(`/inventory/lots${qs ? `?${qs}` : ""}`)
}

export async function createLot(data: LotEntryRequest): Promise<InventoryLot> {
  return apiClient<InventoryLot>("/inventory/lots", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

// ----------------------------------------------------------------------------
// 3. Barcodes
// ----------------------------------------------------------------------------

export function getBarcodePngUrl(
  barcode: string,
  width = 300,
  height = 100,
): string {
  return `${API_BASE_URL}/barcode/${encodeURIComponent(barcode)}?width=${width}&height=${height}`
}

export function getLotBarcodePngUrl(
  lotId: number,
  width = 300,
  height = 100,
): string {
  return `${API_BASE_URL}/lots/${lotId}/barcode-image?width=${width}&height=${height}`
}

// ----------------------------------------------------------------------------
// 4. Sales
// ----------------------------------------------------------------------------

export async function createSale(data: SaleRequest): Promise<SaleResponse> {
  return apiClient<SaleResponse>("/sales", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getSaleById(id: number): Promise<SaleResponse> {
  return apiClient<SaleResponse>(`/sales/${id}`)
}

export async function getSaleByInvoice(
  invoiceNo: string,
): Promise<SaleResponse> {
  return apiClient<SaleResponse>(
    `/sales/invoice/${encodeURIComponent(invoiceNo)}`,
  )
}

export async function getRecentSales(limit = 50): Promise<SaleResponse[]> {
  return apiClient<SaleResponse[]>(`/sales?limit=${limit}`)
}

// ----------------------------------------------------------------------------
// 5. Customers & Ledger
// ----------------------------------------------------------------------------

export async function getCustomers(
  query?: string,
  type?: string,
): Promise<Customer[]> {
  const params = new URLSearchParams()
  if (query && query.trim()) {
    params.set("query", query.trim())
  }
  if (type && type.trim()) {
    params.set("type", type.trim())
  }
  const qs = params.toString()
  return apiClient<Customer[]>(`/customers${qs ? `?${qs}` : ""}`)
}

export async function createCustomer(
  customer: CustomerRequest,
): Promise<Customer> {
  return apiClient<Customer>("/customers", {
    method: "POST",
    body: JSON.stringify(customer),
  })
}

export async function updateCustomer(
  id: number,
  customer: CustomerRequest,
): Promise<Customer> {
  return apiClient<Customer>(`/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(customer),
  })
}

export async function getCustomer(id: number): Promise<Customer> {
  return apiClient<Customer>(`/customers/${id}`)
}

export async function getCustomerLedger(id: number): Promise<CustomerLedger[]> {
  return apiClient<CustomerLedger[]>(`/customers/${id}/ledger`)
}

export async function recordPayment(
  id: number,
  payment: CustomerPaymentRequest,
): Promise<CustomerLedger> {
  return apiClient<CustomerLedger>(`/customers/${id}/payments`, {
    method: "POST",
    body: JSON.stringify(payment),
  })
}

// ----------------------------------------------------------------------------
// 6. Returns
// ----------------------------------------------------------------------------

export async function createReturn(
  data: SaleReturnRequest,
): Promise<SaleReturnResponse> {
  return apiClient<SaleReturnResponse>("/returns", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getReturn(id: number): Promise<SaleReturnResponse> {
  return apiClient<SaleReturnResponse>(`/returns/${id}`)
}

export async function getRecentReturns(
  limit = 50,
): Promise<SaleReturnResponse[]> {
  return apiClient<SaleReturnResponse[]>(`/returns?limit=${limit}`)
}

// ----------------------------------------------------------------------------
// 7. Dashboard
// ----------------------------------------------------------------------------

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return apiClient<DashboardSummary>("/dashboard/summary")
}

// ----------------------------------------------------------------------------
// 8. Backup
// ----------------------------------------------------------------------------

export async function downloadDatabaseBackup(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)
  return downloadBlob(
    "/backup/download",
    `syngenta-pos-backup-${timestamp}.sql`,
  )
}

// ----------------------------------------------------------------------------
// 9. Authentication & Security
// ----------------------------------------------------------------------------

export async function createCashierSession(): Promise<AuthTokenResponse> {
  return apiClient<AuthTokenResponse>("/auth/cashier-session", {
    method: "POST",
  })
}

export async function verifyOwnerPin(
  request: PinVerificationRequest,
): Promise<AuthTokenResponse> {
  return apiClient<AuthTokenResponse>("/auth/verify-pin", {
    method: "POST",
    body: JSON.stringify(request),
  })
}

