import { UserRole } from '../types';

export type Permission =
  | 'RFQ_READ'
  | 'RFQ_CREATE'
  | 'RFQ_EDIT'
  | 'RFQ_STATUS_UPDATE'
  | 'COSTING'
  | 'QUOTE_READ'
  | 'RATE_READ'
  | 'RATE_WRITE'
  | 'APPROVAL_VIEW'
  | 'APPROVAL_DECIDE'
  | 'HISTORICAL_READ'
  | 'AI_INTAKE'
  | 'PDF_GENERATE'
  | 'USER_MANAGE'
  | 'AUDIT_READ';

const permissions: Record<Permission, readonly UserRole[]> = {
  RFQ_READ: ['ESTIMATOR', 'SALES_HEAD', 'ADMIN'],
  RFQ_CREATE: ['ESTIMATOR'],
  RFQ_EDIT: ['ESTIMATOR'],
  RFQ_STATUS_UPDATE: ['ESTIMATOR'],
  COSTING: ['ESTIMATOR'],
  QUOTE_READ: ['ESTIMATOR', 'SALES_HEAD', 'ADMIN'],
  RATE_READ: ['ESTIMATOR', 'SALES_HEAD', 'ADMIN'],
  RATE_WRITE: ['SALES_HEAD', 'ADMIN'],
  APPROVAL_VIEW: ['SALES_HEAD', 'ADMIN'],
  APPROVAL_DECIDE: ['SALES_HEAD'],
  HISTORICAL_READ: ['ESTIMATOR', 'SALES_HEAD', 'ADMIN'],
  AI_INTAKE: ['ESTIMATOR'],
  PDF_GENERATE: ['ESTIMATOR', 'SALES_HEAD'],
  USER_MANAGE: ['ADMIN'],
  AUDIT_READ: ['SALES_HEAD', 'ADMIN'],
};

export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  return role !== undefined && permissions[permission].includes(role);
}
