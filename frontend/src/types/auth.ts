export const UserRole = {
  Owner: 'Owner',
  BranchManager: 'BranchManager',
  Cashier: 'Cashier',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const BranchLocation = {
  Davao: 'Davao',
  Makati: 'Makati',
  Mandaue: 'Mandaue',
  Cebu: 'Cebu',
} as const;

export type BranchLocation = (typeof BranchLocation)[keyof typeof BranchLocation];

export interface UserSession {
  username: string;
  name: string;
  role: UserRole;
  branch?: BranchLocation; // undefined for Owner (enterprise wide), mandatory for BranchManager and Cashier
  department?: string;
  avatarUrl?: string;
}

export interface PresetAccount {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  branch?: BranchLocation;
  description: string;
}

export const REGISTERED_USERS: PresetAccount[] = [
  {
    id: 'owner-alex',
    name: 'Alexander Vance',
    username: 'owner@steeltrack.com',
    role: UserRole.Owner,
    description: 'Executive Administrator — Enterprise-wide multi-branch authority, forecasting & audit.',
  },
  // Davao Branch Accounts
  {
    id: 'bm-davao',
    name: 'Maria Santos',
    username: 'manager.davao@steeltrack.com',
    role: UserRole.BranchManager,
    branch: BranchLocation.Davao,
    description: 'Davao Yard Manager — Superintends Davao stock, inbound loads & transfer approvals.',
  },
  {
    id: 'cashier-davao',
    name: 'Juan Dela Cruz',
    username: 'cashier.davao@steeltrack.com',
    role: UserRole.Cashier,
    branch: BranchLocation.Davao,
    description: 'Davao Head Cashier — Front-counter terminal sales & billing for Davao Branch.',
  },
  // Makati Branch Accounts
  {
    id: 'bm-makati',
    name: 'Carlos Reyes',
    username: 'manager.makati@steeltrack.com',
    role: UserRole.BranchManager,
    branch: BranchLocation.Makati,
    description: 'Makati Central Hub Manager — Oversees NCR inventory, logistics & procurement.',
  },
  {
    id: 'cashier-makati',
    name: 'Ana Patricia Gonzales',
    username: 'cashier.makati@steeltrack.com',
    role: UserRole.Cashier,
    branch: BranchLocation.Makati,
    description: 'Makati Front-Desk Cashier — Daily corporate sales counter checkout.',
  },
  // Mandaue Branch Accounts
  {
    id: 'bm-mandaue',
    name: 'Rodrigo Tan',
    username: 'manager.mandaue@steeltrack.com',
    role: UserRole.BranchManager,
    branch: BranchLocation.Mandaue,
    description: 'Mandaue Logistics Superintendent — Industrial fabrication & Visayas shipments.',
  },
  {
    id: 'cashier-mandaue',
    name: 'Liza Mercado',
    username: 'cashier.mandaue@steeltrack.com',
    role: UserRole.Cashier,
    branch: BranchLocation.Mandaue,
    description: 'Mandaue Counter Cashier — Daily sales orders and payment reconciliation.',
  },
  // Cebu Branch Accounts
  {
    id: 'bm-cebu',
    name: 'Mateo Lim',
    username: 'manager.cebu@steeltrack.com',
    role: UserRole.BranchManager,
    branch: BranchLocation.Cebu,
    description: 'Cebu Port Yard Manager — Port logistics, sea freight receiving & QC inspection.',
  },
  {
    id: 'cashier-cebu',
    name: 'Elena Ramos',
    username: 'cashier.cebu@steeltrack.com',
    role: UserRole.Cashier,
    branch: BranchLocation.Cebu,
    description: 'Cebu Port Counter Cashier — High-volume dispatch checkout & customer receipts.',
  },
];

// Alias for backwards compatibility
export const PRESET_USERS = REGISTERED_USERS;

/**
 * Resolves a user account and identifies their registered branch.
 * Non-owner accounts will strictly be bound to their registered branch upon redirection.
 */
export function resolveRegisteredUser(usernameInput: string): PresetAccount | undefined {
  const clean = usernameInput.trim().toLowerCase();
  return REGISTERED_USERS.find((u) => u.username.toLowerCase() === clean);
}
