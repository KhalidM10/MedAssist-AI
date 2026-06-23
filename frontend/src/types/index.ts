export type UserRole =
  | 'patient'
  | 'clinic_admin'
  | 'clinic_doctor'
  | 'clinic_receptionist'
  | 'clinic_pharmacist'
  | 'super_admin'

export const CLINIC_ROLES: UserRole[] = [
  'clinic_admin',
  'clinic_doctor',
  'clinic_receptionist',
  'clinic_pharmacist',
]

export interface User {
  id: string
  full_name: string
  email: string
  phone: string
  role: UserRole
  clinic_id: string | null
  county: string | null
  is_active: boolean
  is_email_verified: boolean
  avatar_url: string | null
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
  permissions: string[]
}

export interface Patient {
  id: string
  user_id: string
  full_name: string
  date_of_birth: string | null
  gender: string | null
  blood_type: string | null
  county: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  allergies: string[]
  chronic_conditions: string[]
  created_at: string
}

export interface NextAvailableSlot {
  doctor_name: string
  date: string    // "2026-05-24"
  time: string    // "14:00"
}

export interface Clinic {
  id: string
  slug: string
  name: string
  address: string
  county: string
  phone: string
  email: string | null
  logo_url: string | null
  cover_image_url: string | null
  latitude: number | null
  longitude: number | null
  is_verified: boolean
  specialties: string[]
  operating_hours: Record<string, { open: string; close: string }>
  distance_km: number | null
  next_available: string | null
  next_available_slot: NextAvailableSlot | null
  rating: number
  total_reviews: number
  doctors_count: number
  is_open_now: boolean
}

export interface PaginatedClinics {
  clinics: Clinic[]
  total: number
  page: number
  total_pages: number
}

export interface Doctor {
  id: string
  clinic_id: string
  full_name: string
  specialty: string
  sub_specialty: string | null
  qualification: string | null
  license_number: string | null
  bio: string | null
  available_days: number[]   // 0=Mon … 6=Sun
  slot_duration_minutes: number
  consultation_fee_kes: number
  photo_url: string | null
  rating: number
  total_reviews: number
  is_active: boolean
  next_available: NextAvailableSlot | null
}

export interface ClinicReview {
  id: string
  patient_name: string
  rating: number
  title: string | null
  body: string | null
  created_at: string
  is_verified: boolean
  doctor_name: string | null
  response: string | null
  response_at: string | null
}

export interface ClinicDetail extends Omit<Clinic, 'doctors_count'> {
  website: string | null
  description: string | null
  license_number: string | null
  subscription_plan: string
  is_open_now: boolean
  rating_breakdown: Record<number, number>
  doctors: Doctor[]
  reviews: ClinicReview[]
  doctors_count: number
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export interface Appointment {
  id: string
  patient_id: string
  clinic_id: string
  doctor_id: string | null
  appointment_date: string  // "YYYY-MM-DD"
  appointment_time: string  // "HH:MM:SS"
  status: AppointmentStatus
  reason: string | null
  notes: string | null
  payment_status: string
  amount_kes: number
  created_at: string
  booking_reference: string
  clinic_name: string | null
  doctor_name: string | null
}

export interface TimeSlot {
  time: string
  is_available: boolean
}

export interface DaySlots {
  date: string
  slots: TimeSlot[]
}

export interface Product {
  id: string
  clinic_id: string
  clinic_name: string | null
  name: string
  category: string
  description: string | null
  price_kes: number
  stock_quantity: number
  requires_prescription: boolean
  image_url: string | null
  is_active: boolean
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
export type DeliveryMethod = 'pickup' | 'delivery'
export type PaymentMethod = 'mpesa' | 'cash'

export interface OrderItem {
  product_id: string
  name: string
  qty: number
  unit_price: number
  total: number
}

export interface MedOrder {
  id: string
  patient_id: string
  order_number: string
  items: OrderItem[]
  subtotal_kes: number
  delivery_fee_kes: number
  total_kes: number
  status: OrderStatus
  delivery_method: string | null
  delivery_address: string | null
  payment_method: string | null
  mpesa_transaction_id: string | null
  created_at: string
}

export interface CartItem {
  productId: string
  name: string
  priceKes: number
  quantity: number
  clinicName: string | null
}
