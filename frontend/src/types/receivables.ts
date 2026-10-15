import { BranchLocation } from './auth';

export type PaymentMethodType = 'Cash' | 'Cheque' | 'Bank Transfer' | 'Credit Note';

export type ChequeStatusType = 'Pending' | 'Deposited' | 'Cleared' | 'Bounced' | 'Cancelled';

export type AgingBucket = 'Current' | 'Days_30' | 'Days_60' | 'Days_90_Plus';

export interface ReceivablePaymentRecord {
  id: string;
  customerReceivableId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentDate: string;
  reference?: string;
  notes?: string;
  paymentMethod?: string;
  recordedByName?: string;
}

export interface CustomerReceivable {
  id: string;
  customerId: string;
  customerName: string;
  companyName: string;
  tin: string;
  creditLimitPHP: number;
  totalOutstandingPHP: number;
  currentBalancePHP: number;
  days30BalancePHP: number;
  days60BalancePHP: number;
  days90PlusBalancePHP: number;
  lastPaymentDate?: string;
  lastPaymentAmountPHP?: number;
  status: 'Good Standing' | 'Credit Warning' | 'Credit Blocked';
  branch: BranchLocation;
  payments?: ReceivablePaymentRecord[];
}

export interface ReceivablePaymentDto {
  receivableId: string;
  amountPaidPHP: number;
  paymentMethod: PaymentMethodType;
  referenceNumber?: string;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string;
  notes?: string;
  processedBy: string;
}

export interface SaleChequeItem {
  id: string;
  chequeNumber: string;
  bankName: string;
  customerName: string;
  invoiceNumber: string;
  amountPHP: number;
  issueDate: string;
  maturityDate: string;
  status: ChequeStatusType;
  branch: BranchLocation;
  depositedDate?: string;
  clearedDate?: string;
  bouncedDate?: string;
  bounceReason?: string;
  bouncedNoticeSent?: boolean;
}

export interface ReceivableStats {
  totalReceivablesPHP: number;
  totalCurrentPHP: number;
  totalOverduePHP: number;
  pendingPdcAmountPHP: number;
  pendingPdcCount: number;
  bouncedCount: number;
}
