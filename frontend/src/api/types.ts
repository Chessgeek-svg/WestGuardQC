export interface Analyte {
  id: number
  name: string
  unit: string
  created_at: string
  updated_at: string
}

export interface QCLot {
  id: number
  analyte_id: number
  lot_number: string
  manufacturer: string
  level: string
  target_mean: number
  target_sd: number
  expiration_date: string
  active: boolean
  created_at: string
  updated_at: string
}

export type ResultStatus = 'pending' | 'in_control' | 'warning' | 'rejected' | 'voided'

export interface QCResult {
  id: number
  qc_lot_id: number
  value: number
  recorded_at: string
  recorded_by: string
  accepted: boolean | null
  westgard_violations: string[] | null
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
  status: ResultStatus
  created_at: string
  updated_at: string
}

export interface LotResults {
  lot_id: number
  lot_number: string
  analyte_name: string
  unit: string
  level: string
  target_mean: number
  target_sd: number
  expiration_date: string
  active: boolean
  results: QCResult[]
}

export interface QCResultVoid {
  voided_by: string
  void_reason: string
}

export interface QCLotUpdate {
  manufacturer?: string
  target_mean?: number
  target_sd?: number
  expiration_date?: string
  active?: boolean
}

export interface QCResultCreate {
  qc_lot_id: number
  value: number
  recorded_by: string
  recorded_at?: string
}

export interface AnalyteCreate {
  name: string
  unit: string
}

export interface QCLotCreate {
  analyte_id: number
  lot_number: string
  manufacturer: string
  level: string
  target_mean: number
  target_sd: number
  expiration_date: string
}
