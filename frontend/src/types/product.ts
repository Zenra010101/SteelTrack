export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  barcode?: string;
  size?: string;
  thickness?: string;
  length?: string;
  grade?: string;
  unitOfMeasure: string;
  unitPrice: number;
  costPrice: number;
  stockQuantity: number;
  reorderLevel: number;
  isActive: boolean;
  categoryId: string;
  categoryName?: string;
  supplierId?: string;
  supplierName?: string;
  diameter?: string;
  schedule?: string;
  materialType?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateProductDto {
  sku: string;
  name: string;
  description?: string;
  barcode?: string;
  size?: string;
  thickness?: string;
  length?: string;
  grade?: string;
  unitOfMeasure: string;
  unitPrice: number;
  costPrice: number;
  stockQuantity: number;
  reorderLevel: number;
  categoryId: string;
  supplierId?: string;
}
