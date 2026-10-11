export interface BranchRecord {
  id: string;
  code: string;
  name: string;
  address?: string;
  contactNumber?: string;
  managerName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface UpdateBranchDto {
  name?: string;
  address?: string;
  contactNumber?: string;
  managerName?: string;
  isActive?: boolean;
}
