// ============================================================================
// Typed REST Endpoints for Rajib Enterprise POS & Inventory
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
  TopSellingProduct,
  PagedResponse,
  AuthTokenResponse,
  LoginRequest,
  QuarantineStockItem,
  QuarantineDisposalRequest,
  StockMovement,
  StockAdjustmentRequest,
  StockAdjustmentResponse,
  StockValuationSummary,
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

export async function getStock(inStockOnly = false): Promise<StockItem[]> {
  return apiClient<StockItem[]>(
    inStockOnly ? "/inventory/stock?inStockOnly=true" : "/inventory/stock",
  )
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

export async function getQuarantineStock(): Promise<QuarantineStockItem[]> {
  return apiClient<QuarantineStockItem[]>("/inventory/quarantine")
}

export async function disposeQuarantineStock(
  data: QuarantineDisposalRequest,
): Promise<{ message: string }> {
  return apiClient<{ message: string }>("/inventory/quarantine/dispose", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getStockMovements(
  productId?: number,
  lotId?: number,
  page = 0,
  size = 20,
): Promise<PagedResponse<StockMovement>> {
  const params = new URLSearchParams()
  if (productId != null) params.set("productId", productId.toString())
  if (lotId != null) params.set("lotId", lotId.toString())
  params.set("page", page.toString())
  params.set("size", size.toString())
  return apiClient<PagedResponse<StockMovement>>(`/inventory/movements?${params.toString()}`)
}

export async function recordStockAdjustment(
  data: StockAdjustmentRequest,
): Promise<StockAdjustmentResponse> {
  return apiClient<StockAdjustmentResponse>("/inventory/adjustments", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getStockAdjustments(
  productId?: number,
  page = 0,
  size = 15,
): Promise<PagedResponse<StockAdjustmentResponse>> {
  const params = new URLSearchParams()
  if (productId != null) params.set("productId", productId.toString())
  params.set("page", page.toString())
  params.set("size", size.toString())
  return apiClient<PagedResponse<StockAdjustmentResponse>>(`/inventory/adjustments?${params.toString()}`)
}

export async function getStockValuationSummary(): Promise<StockValuationSummary> {
  return apiClient<StockValuationSummary>("/inventory/valuation")
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

export interface GetSalesParams {
  page?: number
  size?: number
  period?: string
  saleMode?: string
}

export async function getPaginatedSales(
  params: GetSalesParams = {},
): Promise<PagedResponse<SaleResponse>> {
  const qs = new URLSearchParams()
  if (params.page != null) qs.set("page", params.page.toString())
  if (params.size != null) qs.set("size", params.size.toString())
  if (params.period) qs.set("period", params.period)
  if (params.saleMode) qs.set("saleMode", params.saleMode)
  const queryStr = qs.toString()
  return apiClient<PagedResponse<SaleResponse>>(
    `/sales${queryStr ? `?${queryStr}` : ""}`,
  )
}

export async function getTopSellingProducts(
  period = "month",
  page = 0,
  size = 10,
): Promise<PagedResponse<TopSellingProduct>> {
  const res = await apiClient<any>(
    `/dashboard/top-selling?period=${encodeURIComponent(period)}&page=${page}&size=${size}&limit=${size}`,
  )
  if (res && Array.isArray(res.content)) {
    return res
  }
  if (Array.isArray(res)) {
    return {
      content: res.slice(page * size, (page + 1) * size),
      pageNumber: page,
      pageSize: size,
      totalElements: res.length,
      totalPages: Math.max(1, Math.ceil(res.length / size)),
      first: page === 0,
      last: page >= Math.ceil(res.length / size) - 1,
    }
  }
  return {
    content: [],
    pageNumber: 0,
    pageSize: size,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  }
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

export async function getCustomerPurchases(
  id: number,
): Promise<SaleResponse[]> {
  return apiClient<SaleResponse[]>(`/customers/${id}/purchases`)
}

export async function getNextDueInvoiceNo(): Promise<{ dueInvoiceNo: string }> {
  return apiClient<{ dueInvoiceNo: string }>("/customers/next-due-invoice-no")
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
    `pos-backup-${timestamp}.sql`,
  )
}

// ----------------------------------------------------------------------------
// 9. Authentication & Security
// ----------------------------------------------------------------------------

export async function login(request: LoginRequest): Promise<AuthTokenResponse> {
  return apiClient<AuthTokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(request),
  })
}
