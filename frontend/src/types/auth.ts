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
  branch?: BranchLocation; // undefined for Owner (or All Branches)
}

export interface PresetAccount {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  branch?: BranchLocation;
  description: string;
}

export const PRESET_USERS: PresetAccount[] = [
  {
    id: 'owner',
    name: 'Alexander Vance',
    username: 'owner@steeltrack.com',
    role: UserRole.Owner,
    description: 'Overall access, multi-branch control, LSTM forecasting & system management.',
  },
  {
    id: 'bm-davao',
    name: 'Maria Santos',
    username: 'manager.davao@steeltrack.com',
    role: UserRole.BranchManager,
    branch: BranchLocation.Davao,
    description: 'Davao branch operations, stock transfer approvals & reports.',
  },
  {
    id: 'bm-makati',
    name: 'Carlos Reyes',
    username: 'manager.makati@steeltrack.com',
    role: UserRole.BranchManager,
    branch: BranchLocation.Makati,
    description: 'Makati central hub operations & inter-branch logistics.',
  },
  {
    id: 'cashier-davao',
    name: 'Juan Dela Cruz',
    username: 'cashier.davao@steeltrack.com',
    role: UserRole.Cashier,
    branch: BranchLocation.Davao,
    description: 'Daily counter sales & receipt generation at Davao Branch.',
  },
  {
    id: 'cashier-cebu',
    name: 'Elena Ramos',
    username: 'cashier.cebu@steeltrack.com',
    role: UserRole.Cashier,
    branch: BranchLocation.Cebu,
    description: 'Daily transactions & point-of-sale checkout at Cebu Branch.',
  },
];
