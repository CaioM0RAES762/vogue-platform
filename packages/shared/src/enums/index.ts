// Enums alinhados ao SDD Seção 12 — D-11 (Sprint 3)

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DRAFT = 'DRAFT',
}

// SDD usa valores em português (FEMININO, MASCULINO, UNISSEX) — D-11
export enum Gender {
  FEMININO = 'FEMININO',
  MASCULINO = 'MASCULINO',
  UNISSEX = 'UNISSEX',
}

// XG (não XGG) conforme SDD; UNICO sem acento por limitação do Prisma enum — D-11
export enum ProductSize {
  PP = 'PP',
  P = 'P',
  M = 'M',
  G = 'G',
  GG = 'GG',
  XG = 'XG',
  UNICO = 'UNICO',
}

export enum CouponType {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BOLETO = 'BOLETO',
}

// EXPIRED mantido além do SDD — exigido pela lógica D-10 (PIX/Boleto expirado) — D-11
export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  REFUNDED = 'REFUNDED',
}

// Valores alinhados ao SDD Seção 12 — D-11 (Sprint 2 tinha PURCHASE/ADJUSTMENT/RETURN)
export enum InventoryMovementType {
  ENTRY = 'ENTRY',
  MANUAL_EXIT = 'MANUAL_EXIT',
  SALE = 'SALE',
  CANCELLATION = 'CANCELLATION',
  RESERVATION = 'RESERVATION',
  RELEASE = 'RELEASE',
}
