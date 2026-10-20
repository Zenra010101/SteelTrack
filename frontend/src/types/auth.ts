export const UserRole = {
  Owner: 'Owner',
  BranchManager: 'BranchManager',
  Cashier: 'Cashier',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const BranchLocation = {
  Davao: 'Davao',
  Mandaue: 'Mandaue',
  Cebu: 'Cebu',
  Cagayan: 'Cagayan',
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

/**
 * Dynamic resolution of user identity based on user input or offline fallback.
 * Primary authentication is performed dynamically against the PostgreSQL database.
 */
export function resolveRegisteredUser(usernameInput: string): PresetAccount | undefined {
  const clean = usernameInput.trim().toLowerCase();
  if (!clean) return undefined;

  if (clean.includes('owner') || clean.includes('admin')) {
    return {
      id: 'usr-001',
      name: 'Alexander Vance',
      username: clean,
      role: UserRole.Owner,
      description: 'Executive Administrator — Enterprise-wide multi-branch authority.',
    };
  }

  let branch: BranchLocation = BranchLocation.Davao;
  if (clean.includes('cagayan')) branch = BranchLocation.Cagayan;
  else if (clean.includes('mandaue')) branch = BranchLocation.Mandaue;
  else if (clean.includes('cebu')) branch = BranchLocation.Cebu;

  const isMgr = clean.includes('manager') || clean.includes('lead') || clean.includes('asst');
  const role = isMgr ? UserRole.BranchManager : UserRole.Cashier;

  return {
    id: `usr-${clean.split('@')[0]}`,
    name: clean.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    username: clean,
    role,
    branch,
    description: `${branch} Branch ${isMgr ? 'Branch Manager' : 'Cashier'}`,
  };
}
