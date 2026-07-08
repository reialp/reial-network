export type ContentStatus = 'all' | 'pending' | 'approved' | 'rejected'

export interface Content {
  id: string
  title: string
  description: string
  thumbnail_url: string
  video_url: string
  trailer_url: string
  category: string
  price: number
  release_year: number
  language: string
  subtitles: string
  status: string
  views: number
  purchase_count: number
  created_at: string
  slug: string | null
  creator_id: string
  creator_name: string
}

export interface PayoutRequest {
  id: string
  creator_id: string
  amount: number
  phone: string
  status: string
  requested_at: string
  processed_at: string | null
  profiles: { full_name: string }
}

export interface Transaction {
  id: string
  content_id: string
  buyer_id: string
  amount_paid: number
  platform_fee: number
  creator_earnings: number
  watch_token: string
  status: string
  pesapal_transaction_id: string | null
  created_at: string
  content: { title: string; creator_id: string } | null
  buyer: { email: string } | null
}

export interface CreatorStats {
  creator_id: string
  creator_name: string
  total_films: number
  total_views: number
  total_purchases: number
  total_revenue: number
  total_earnings: number
  pending_films: number
  approved_films: number
  rejected_films: number
  email?: string
  phone?: string
  signup_date?: string
  last_active?: string
  is_onboarded?: boolean
  has_phone?: boolean
  has_payout_method?: boolean
}

export interface ActivityLog {
  id: string
  admin_id: string
  action: string
  target_id: string
  target_type: string
  details: any
  created_at: string
  admin: { full_name: string }
}

export interface MonthlyReport {
  month: string
  year: number
  total_transactions: number
  total_revenue: number
  total_fees: number
  total_earnings: number
  unique_buyers: number
  unique_films: number
}

export interface Stats {
  totalFilms: number
  totalSales: number
  totalRevenue: number
  totalPlatformFees: number
  totalPaidToCreators: number
  pendingPayouts: number
  pendingSubmissions: number
  totalCreators: number
  totalViews: number
  flaggedContent: number
}

// UPDATED: Changed from 0.15 to 0.30 (15% to 30%)
export const PLATFORM_FEE_PERCENTAGE = 0.30
