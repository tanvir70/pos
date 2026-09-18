// ============================================================================
// Domain Types & DTOs for Al-Amin Traders POS & Inventory
// Matches backend Spring Boot entities and REST DTOs
// ============================================================================

export type SaleMode = "RETAIL" | "WHOLESALE"
export type CustomerType = "RETAIL" | "WHOLESALE"
export type RefundType = "CASH_REFUND" | "DUE_ADJUSTMENT"
export type StockLocation = "DOKAN" | "QUARANTINE"
export type PaymentMethod = "CASH" | "BKASH" | "NAGAD" | "BANK_TRANSFER" | "DUE" | "SPLIT"

export type NavigationTab =
  | "pos"
  | "dashboard"
  | "inventory"
  | "customers"
  | "returns"
  | "wholesale"
  | "settings"

// ----------------------------------------------------------------------------
// Product
// ----------------------------------------------------------------------------
export interface Product {
  id: number
  productCode: string
  nameEn: string
  nameBn: string
  companyName: string
  category: string
  baseUnit: string
  cartonMultiplier: number
  defaultBarcode: string
  standardRetailPrice: number
  standardWholesalePrice?: number
  buyingPrice?: number
  minStockAlert: number
  imagePath?: string | null
  createdAt?: string
}

// ----------------------------------------------------------------------------
// Inventory & Lots
// ----------------------------------------------------------------------------
export interface InventoryLot {
  id: number
  productId: number
  productCode?: string
  productNameEn?: string
  lotNumber: string
  entryDate: string
  expiryDate: string
  purchaseCost: number
  lotRetailPrice: number
  lotWholesalePrice: number
  barcode: string
  supplierName?: string | null
  challanNo?: string | null
  createdAt?: string
}

export interface StockItem {
  productId: number
  productCode: string
  nameEn: string
  nameBn: string
  productNameEn?: string
  productNameBn?: string
  category: string
  baseUnit: string
  cartonMultiplier: number
  defaultBarcode: string
  minStockAlert?: number
  standardRetailPrice?: number
  standardWholesalePrice?: number
  buyingPrice?: number
  lotId: number
  lotNumber: string
  entryDate: string
  expiryDate: string
  purchaseCost: number
  lotRetailPrice: number
  lotWholesalePrice: number
  lotBarcode: string
  barcode?: string
  quantity: number
  totalQuantity?: number
  quarantineQuantity?: number
}

export interface LotEntryRequest {
  productId: number
  lotNumber: string
  entryDate?: string
  expiryDate: string
  purchaseCost: number
  lotRetailPrice: number
  lotWholesalePrice: number
  barcode?: string
  supplierName?: string
  challanNo?: string
  quantityCartons?: number
  quantityBaseUnits?: number
  location?: string
}

export interface QuarantineStockItem {
  productId: number
  productCode: string
  productNameEn: string
  productNameBn: string
  baseUnit: string
  lotId: number
  lotNumber: string
  barcode?: string
  expiryDate: string
  supplierName?: string | null
  quarantineQuantity: number
  purchaseCost: number
  lotRetailPrice: number
  totalLossValue: number
}

export interface QuarantineDisposalRequest {
  lotId: number
  quantity: number
  disposalType: "WRITE_OFF" | "SUPPLIER_CLAIM" | "DESTROYED" | string
  remarks?: string
}

// ----------------------------------------------------------------------------
// Customer & Ledger
// ----------------------------------------------------------------------------

export interface Customer {
  id: number
  name: string
  fatherName?: string | null
  businessName?: string | null
  proprietorName?: string | null
  phone: string
  whatsappNumber?: string | null
  email?: string | null
  villageAddress?: string | null
  address?: string | null
  customerType: CustomerType | string
  creditLimit: number
  currentDue: number
  mfsType?: string | null
  mfsNumber?: string | null
  bankName?: string | null
  bankBranch?: string | null
  bankAccountNo?: string | null
  createdAt?: string
}

export interface CustomerRequest {
  name: string
  fatherName?: string
  businessName?: string
  phone: string
  whatsappNumber?: string
  email?: string
  villageAddress?: string
  customerType?: CustomerType | string
  creditLimit?: number
  currentDue?: number
  initialDue?: number
  mfsType?: string
  mfsNumber?: string
  bankName?: string
  bankBranch?: string
  bankAccountNo?: string
}

export interface CustomerLedger {
  id: number
  customerId: number
  customerName?: string
  transactionDate: string
  transactionType: string
  debit: number
  credit: number
  balanceAfter: number
  moneyReceiptNo?: string | null
  saleId?: number | null
  notes?: string | null
}

export interface CustomerPaymentRequest {
  amount: number
  paymentMethod?: PaymentMethod | string
  moneyReceiptNo?: string
  notes?: string
}

// ----------------------------------------------------------------------------
// Cart Item for POS Counter
// ----------------------------------------------------------------------------
export interface CartItem {
  id: string
  productId: number
  productCode: string
  nameEn: string
  nameBn: string
  category?: string
  baseUnit: string
  cartonMultiplier: number
  defaultBarcode?: string
  lotId: number
  lotNumber: string
  entryDate?: string
  expiryDate: string
  purchaseCost: number
  lotRetailPrice: number
  lotWholesalePrice: number
  barcode?: string
  availableStock: number
  quantity: number
  unitPrice: number
  originalUnitPrice?: number
  availableLots?: InventoryLot[]
}

// ----------------------------------------------------------------------------
// Sales
// ----------------------------------------------------------------------------
export interface SaleItemRequest {
  lotId: number
  totalQuantity: number
  unitPrice: number
}

export interface SaleRequest {
  customerId?: number | null
  saleMode: SaleMode
  items: SaleItemRequest[]
  discount?: number
  roundOff?: number
  paymentMethod?: PaymentMethod | string
  cashPaid?: number
  digitalPaid?: number
  digitalMedium?: string | null
  digitalTrxId?: string | null
  cashierName?: string | null
}

export interface SaleItemResponse {
  id: number
  lotId: number
  productNameEn: string
  productNameBn: string
  lotNumber: string
  barcode: string
  totalQuantity: number
  unitPrice: number
  unitCost: number
  subtotal: number
  profit?: number
  lineProfit?: number
  expiryDate?: string | null
  cartonMultiplier?: number | null
  baseUnit?: string | null
}

export interface SaleResponse {
  id: number
  invoiceNo: string
  saleDate: string
  customerId?: number | null
  customerName?: string | null
  customerPhone?: string | null
  saleMode: SaleMode | string
  subtotal: number
  discount: number
  roundOff: number
  totalAmount: number
  paymentMethod: string
  cashPaid: number
  digitalPaid: number
  digitalMedium?: string | null
  digitalTrxId?: string | null
  dueAmount: number
  totalProfit?: number
  cashierName?: string | null
  items: SaleItemResponse[]
}

// ----------------------------------------------------------------------------
// Sales Returns
// ----------------------------------------------------------------------------
export interface SaleReturnItemRequest {
  lotId: number
  quantity: number
  refundPrice: number
  isDamaged?: boolean
}

export interface SaleReturnRequest {
  originalSaleId?: number | null
  customerId?: number | null
  refundType: RefundType | string
  reason?: string | null
  items: SaleReturnItemRequest[]
}

export interface SaleReturnItem {
  id?: number
  lotId: number
  lotNumber?: string
  barcode?: string
  productNameEn?: string
  productNameBn?: string
  quantity: number
  refundPrice: number
  isDamaged?: boolean
  restockLocation?: StockLocation | string
  subtotal?: number
}

export interface SaleReturnResponse {
  id: number
  returnNo: string
  originalSaleId?: number | null
  customerId?: number | null
  customerName?: string | null
  customerPhone?: string | null
  returnDate: string
  totalRefundAmount: number
  refundType: RefundType | string
  reason?: string | null
  items: SaleReturnItem[]
}

// ----------------------------------------------------------------------------
// Dashboard & Analytics
// ----------------------------------------------------------------------------
export interface ExpiringLot {
  lotId: number
  productCode: string
  productNameEn: string
  productNameBn: string
  lotNumber: string
  expiryDate: string
  daysUntilExpiry: number
  quantity: number
}

export interface LowStockProduct {
  productId: number
  productCode: string
  nameEn: string
  nameBn: string
  minStockAlert: number
  totalStock: number
}

export interface TopSellingProduct {
  productId: number
  productCode: string
  nameEn: string
  nameBn: string
  unit: string
  totalQuantity: number
  totalRevenue: number
  percentageShare?: number
}

export interface PagedResponse<T> {
  content: T[]
  pageNumber: number
  pageSize: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export interface DashboardSummary {
  totalSalesToday: number
  totalSalesMonth: number
  totalOrdersToday?: number
  totalReturnsToday?: number
  grossProfitToday: number
  grossProfitMonth: number
  cashInDrawerToday: number
  totalMarketDue: number
  totalCustomers: number
  lowStockCount: number
  expiringSoonCount: number
  salesGrowth?: number
  ordersGrowth?: number
  profitGrowth?: number
  returnsGrowth?: number
  expiringLots: ExpiringLot[]
  lowStockProducts: LowStockProduct[]
}

// ----------------------------------------------------------------------------
// Uniform Backend Error Contract
// ----------------------------------------------------------------------------
export interface ErrorResponse {
  timestamp: string
  status: number
  errorCode: string
  message: string
  path: string
  details?: Record<string, string> | null
}

// ----------------------------------------------------------------------------
// Security & Authentication
// ----------------------------------------------------------------------------
export type AppRole = "ROLE_CASHIER" | "ROLE_OWNER"

export interface AuthTokenResponse {
  token: string
  role: AppRole | string
  expiresIn: number
  username?: string
  fullName?: string
}

export interface PinVerificationRequest {
  pin: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface ChangePinRequest {
  currentPin: string
  newPin: string
}

