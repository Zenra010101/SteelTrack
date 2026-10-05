import { BranchLocation } from './auth';

export interface SupplierContact {
  id: string;
  supplierId: string;
  contactPerson: string;
  designation: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

export interface SupplierAttachment {
  id: string;
  supplierId: string;
  fileName: string;
  fileType: 'Mill_Test_Certificate' | 'BIR_2303' | 'SEC_DTI_Registration' | 'ISO_Certification';
  uploadDate: string;
  fileUrl: string;
}

export interface SupplierMaster {
  id: string;
  supplierCode: string;
  companyName: string;
  tin: string;
  countryOfOrigin: string;
  paymentTermsDays: number;
  ratingScore: number; // 1 to 5 scale
  status: 'Active' | 'Under Review' | 'Blacklisted';
  contacts: SupplierContact[];
  attachments: SupplierAttachment[];
}

export interface CustomerMaster {
  id: string;
  customerCode: string;
  customerName: string;
  companyName: string;
  tin: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  creditLimitPHP: number;
  termsDays: number;
  status: 'Active' | 'On Hold' | 'Blocked';
  assignedBranch: BranchLocation;
  createdAt: string;
}
