
export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export enum TransactionType {
  IN = 'MASUK',
  OUT = 'KELUAR'
}

export interface Category {
  id: string;
  name: string;
}

export interface Type {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  barcode: string;
  categoryId: string;
  typeId: string;
  stock: number;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  productId: string;
  productName: string;
  type: TransactionType;
  quantity: number;
  userName: string;
  timestamp: string;
}

export interface User {
  name: string;
  role: Role;
}
