export type Role = 'admin' | 'manager' | 'staff' | 'readonly'
export type HotelAccess = 'mercure' | 'ibis' | 'both'
export type ProductType = 'room' | 'beverage' | 'food' | 'cleaning_fb' | 'cleaning_general' | 'meeting' | 'laundry'
export type RequisitionStatus = 'pending' | 'validated' | 'rejected'
export type InvoiceStatus = 'pending' | 'ai_processed' | 'validated'
export type EventType = 'meeting' | 'banqueting' | 'event'
export type FbOutlet = 'breakfast_mercure' | 'breakfast_ibis' | 'lunch' | 'dinner' | 'room_service' | 'banqueting_lunch' | 'banqueting_dinner'

export interface UserProfile {
  id: string
  full_name: string
  role: Role
  hotel_access: HotelAccess
  created_at: string
  email?: string
}

export interface Hotel {
  id: string
  name: string
  brand: string
}

export interface RoomType {
  id: number
  hotel_id: string
  code: string
  label: string
}

export interface DailyStat {
  id: number
  hotel_id: string
  stat_date: string
  occupancy_pct: number
  arrivals: number
  departures: number
  breakfast_covers: number
  rooms_sold_dba: number
  rooms_sold_dbbz: number
  rooms_sold_sgl: number
  rooms_sold_twcz: number
  rooms_sold_privm: number
  rooms_sold_dbl: number
  rooms_sold_twi: number
  rooms_sold_han: number
  lunch_covers: number
  dinner_mercure_covers: number
  dinner_ibis_covers: number
  room_service_revenue: number
  banquet_lunch_covers: number
  banquet_dinner_covers: number
}

export interface FbDailySale {
  id: number
  sale_date: string
  outlet: FbOutlet
  covers: number
  revenue: number
  raw_import_id: number
}

export interface FbImport {
  id: number
  import_date: string
  file_url: string
  status: string
  created_by: string
}

export interface Event {
  id: number
  event_date: string
  event_name: string
  room: string
  persons: number
  type: EventType
}

export interface ForecastOccupancy {
  id: number
  forecast_date: string
  hotel_id: string
  occupancy_pct: number
  breakfast_covers: number
  created_at: string
}

export interface ProductCategory {
  id: number
  name: string
  type: ProductType
}

export interface Supplier {
  id: number
  name: string
  contact: string
  url: string
}

export interface Product {
  id: number
  name: string
  sku: string
  category_id: number
  supplier_id: number
  type: ProductType
  unit: string
  packaging_desc: string
  packaging_qty: number
  price_excl_tax: number
  min_stock: number
  delivery_days: number
  purchase_url: string
  hotel_scope: HotelAccess
  is_active: boolean
  category?: ProductCategory
  supplier?: Supplier
  sub_products?: BeverageSubProduct[]
}

export interface BeverageSubProduct {
  id: number
  parent_product_id: number
  name: string
  volume_cl: number
  decrement_factor: number
}

export interface StockMonth {
  id: number
  product_id: number
  month: string
  opening_stock: number
  bought: number
  used: number
}

export interface ProductAiMapping {
  id: number
  raw_name: string
  product_id: number
  mapped_by: string
  confirmed: boolean
}

export interface Requisition {
  id: number
  requested_by: string
  request_date: string
  status: RequisitionStatus
  type: string
  notes: string
  lines?: RequisitionLine[]
  requester?: UserProfile
}

export interface RequisitionLine {
  id: number
  requisition_id: number
  product_id: number
  qty_requested: number
  qty_validated: number
  product?: Product
}

export interface Invoice {
  id: number
  uploaded_by: string
  upload_date: string
  file_url: string
  supplier_id: number
  status: InvoiceStatus
  total_amount: number
  supplier?: Supplier
  lines?: InvoiceLine[]
}

export interface InvoiceLine {
  id: number
  invoice_id: number
  raw_description: string
  product_id: number | null
  qty: number
  unit_price: number
  total: number
  ai_confidence: number
  product?: Product
}

export interface Recipe {
  id: number
  name: string
  outlet: string
  portion_size_g: number
  selling_price: number
  is_active: boolean
  ingredients?: RecipeIngredient[]
  menu_items?: MenuItem[]
}

export interface RecipeIngredient {
  id: number
  recipe_id: number
  product_id: number
  quantity: number
  unit: string
  product?: Product
}

export interface MenuItem {
  id: number
  name: string
  recipe_id: number
  price: number
  outlet: string
  is_active: boolean
  recipe?: Recipe
}

export interface LogbookNews {
  id: number
  news_date: string
  title: string
  body: string
  source: string
  created_via: string
}

export interface MorningMeeting {
  id: number
  meeting_date: string
  notes: string
  attendees: string[]
  created_via: string
}

export interface ToiletCheck {
  id: number
  check_date: string
  toilet_id: 1 | 2 | 3
  checked_by: 'Fadila' | 'HK' | 'other'
  check_time: string
  validated: boolean
}

export interface Staff {
  id: number
  matricule: string
  full_name: string
  service: string
  is_active: boolean
}

export interface DutyRoster {
  id: number
  staff_id: number
  week_start: string
  day_date: string
  shift: 'morning' | 'afternoon'
  value: string
  staff?: Staff
}
