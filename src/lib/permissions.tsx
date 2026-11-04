import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AuthUser } from "./api";

export interface MenuItemNode {
  id: number;
  name: string;
  section: "Main" | "Partners" | "Operations & Payouts" | "System & Team";
  children?: { id: number; name: string }[];
}

export const MENU_TREE: MenuItemNode[] = [
  // MAIN
  {
    id: 1,
    name: "Overview",
    section: "Main",
    children: [
      { id: 101, name: "Key Performance Metrics (KPIs)" },
      { id: 102, name: "Traffic & Volume Analytics Chart" },
      { id: 103, name: "Recent Team Activity Log" },
    ],
  },
  {
    id: 7,
    name: "Surveys",
    section: "Main",
    children: [
      { id: 701, name: "Survey Directory & Search" },
      { id: 702, name: "Create / Add Survey Study" },
      { id: 703, name: "Clone / Duplicate Study" },
      { id: 704, name: "Assign Supply Vendors" },
      { id: 705, name: "Quotas Management & Limits" },
      { id: 706, name: "Targeting & Criteria Qualifications" },
    ],
  },

  // PARTNERS
  {
    id: 6,
    name: "Clients",
    section: "Partners",
    children: [
      { id: 601, name: "Client Directory" },
      { id: 602, name: "Add New Client Onboarding" },
      { id: 603, name: "API Endpoints (Feed & S2S Callbacks)" },
      { id: 604, name: "Anti-Tamper & Security Hash Keys" },
      { id: 605, name: "Client Contacts Directory" },
      { id: 606, name: "Edit Client Configuration" },
      { id: 607, name: "Delete / Deactivate Client" },
    ],
  },
  {
    id: 8,
    name: "Vendors",
    section: "Partners",
    children: [
      { id: 801, name: "Vendor Directory & Status" },
      { id: 802, name: "Add Supply Vendor Integration" },
      { id: 803, name: "Return Callbacks (4 Links Configuration)" },
      { id: 804, name: "RevShare & CPI Payout Rules" },
      { id: 805, name: "Statements & Reconciliation Ledger" },
      { id: 806, name: "Bank & Compliance Profile" },
      { id: 807, name: "Remove / Delete Vendor" },
    ],
  },

  // OPERATIONS & PAYOUTS
  {
    id: 10,
    name: "Vendor Payments",
    section: "Operations & Payouts",
    children: [
      { id: 1001, name: "Disbursements Ledger" },
      { id: 1002, name: "Record Vendor Payout" },
      { id: 1003, name: "Approve / Mark Paid Status" },
      { id: 1004, name: "Export Payments CSV" },
      { id: 1005, name: "Edit Payment Remarks & Proof" },
      { id: 1006, name: "Delete Payment Record" },
    ],
  },
  {
    id: 9,
    name: "Traffic Leads Stream",
    section: "Operations & Payouts",
    children: [
      { id: 901, name: "Live Respondent Clicks Stream" },
      { id: 902, name: "Traffic Search & Filter" },
      { id: 903, name: "Manual Status Override" },
      { id: 904, name: "Export Leads CSV" },
    ],
  },
  {
    id: 11,
    name: "Security & Fraud Gate",
    section: "Operations & Payouts",
    children: [
      { id: 1101, name: "Fraud Detection Logs" },
      { id: 1102, name: "Speeder LOI & IP Rules" },
      { id: 1103, name: "Pre-Screener Simulator Gate" },
    ],
  },

  // SYSTEM & TEAM
  {
    id: 2,
    name: "User Management",
    section: "System & Team",
    children: [
      { id: 3, name: "User Accounts Directory" },
      { id: 4, name: "Menu & Action Permissions" },
      { id: 5, name: "Password Management" },
    ],
  },
  {
    id: 12,
    name: "Team Directory",
    section: "System & Team",
    children: [
      { id: 1201, name: "Staff Directory Listing" },
      { id: 1202, name: "Add Team Member" },
      { id: 1203, name: "Activity Audit Trail" },
    ],
  },
  {
    id: 13,
    name: "Reference Data",
    section: "System & Team",
    children: [
      { id: 1301, name: "Country Master" },
      { id: 1302, name: "Language Master" },
      { id: 1303, name: "Questions & Qualification Library" },
    ],
  },
  {
    id: 14,
    name: "API Developer Center",
    section: "System & Team",
    children: [
      { id: 1401, name: "API Documentation & Interactive Spec" },
      { id: 1402, name: "REST Endpoints & Testing Tools" },
      { id: 1403, name: "Server-to-Server Webhooks & Callbacks" },
      { id: 1404, name: "API Keys & Signing Credentials" },
    ],
  },
];

export const ALL_MENU_IDS: number[] = MENU_TREE.flatMap((node) => [
  node.id,
  ...(node.children ? node.children.map((c) => c.id) : []),
]);

export const PERMS = {
  OVERVIEW: 1,
  OVERVIEW_KPIS: 101,
  OVERVIEW_CHARTS: 102,
  OVERVIEW_ACTIVITY: 103,

  SURVEYS: 7,
  SURVEYS_VIEW: 701,
  SURVEYS_CREATE: 702,
  SURVEYS_CLONE: 703,
  SURVEYS_ASSIGN: 704,
  SURVEYS_QUOTAS: 705,
  SURVEYS_TARGETING: 706,

  CLIENTS: 6,
  CLIENTS_VIEW: 601,
  CLIENTS_CREATE: 602,
  CLIENTS_API: 603,
  CLIENTS_SECURITY_KEYS: 604,
  CLIENTS_CONTACTS: 605,
  CLIENTS_EDIT: 606,
  CLIENTS_DELETE: 607,

  VENDORS: 8,
  VENDORS_VIEW: 801,
  VENDORS_CREATE: 802,
  VENDORS_CALLBACKS: 803,
  VENDORS_PAYOUT_RULES: 804,
  VENDORS_LEDGER: 805,
  VENDORS_COMPLIANCE: 806,
  VENDORS_DELETE: 807,

  PAYMENTS: 10,
  PAYMENTS_LEDGER: 1001,
  PAYMENTS_RECORD: 1002,
  PAYMENTS_APPROVE: 1003,
  PAYMENTS_EXPORT: 1004,
  PAYMENTS_EDIT: 1005,
  PAYMENTS_DELETE: 1006,

  LEADS: 9,
  LEADS_STREAM: 901,
  LEADS_SEARCH: 902,
  LEADS_OVERRIDE: 903,
  LEADS_EXPORT: 904,

  SECURITY: 11,
  SECURITY_LOGS: 1101,
  SECURITY_RULES: 1102,
  SECURITY_SIMULATOR: 1103,

  USERS: 2,
  USERS_DIRECTORY: 3,
  USERS_PERMISSIONS: 4,
  USERS_PASSWORDS: 5,

  TEAM: 12,
  TEAM_LISTING: 1201,
  TEAM_ADD: 1202,
  TEAM_AUDIT: 1203,

  REFERENCE: 13,
  REFERENCE_COUNTRIES: 1301,
  REFERENCE_LANGUAGES: 1302,
  REFERENCE_QUESTIONS: 1303,

  API: 14,
  API_DOCS: 1401,
  API_REST: 1402,
  API_WEBHOOKS: 1403,
  API_KEYS: 1404,
} as const;

export function getUserPermissionSet(user: AuthUser | null | undefined): Set<number> {
  if (!user) return new Set();
  const rawList = [
    ...(Array.isArray(user.permissions) ? user.permissions : []),
    ...(Array.isArray(user.menu_permissions) ? user.menu_permissions : []),
  ];
  return new Set(rawList.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0));
}

/**
 * Strict permission check:
 * ONLY permissions explicitly selected and present in user's permSet are granted.
 * Unchecked permissions (such as Clone, Quotas, Targeting, Delete) are strictly denied.
 */
export function hasPermission(user: AuthUser | null | undefined, permissionId: number): boolean {
  if (!user) return false;
  const permSet = getUserPermissionSet(user);

  // If no permissions array exists at all (unconfigured account), fallback to Super Admin check
  if (permSet.size === 0) {
    return (
      user.role_id === 1 ||
      user.role_name === "Admin" ||
      user.role_name === "Developer" ||
      (typeof user.role_name === "string" && user.role_name.toLowerCase().includes("admin"))
    );
  }

  // Exact match: if this permission ID was explicitly checked and saved
  if (permSet.has(permissionId)) {
    return true;
  }

  // If this is a top-level module ID (e.g. PERMS.SURVEYS === 7, PERMS.OVERVIEW === 1)
  const topNode = MENU_TREE.find((node) => node.id === permissionId);
  if (topNode) {
    if (permSet.has(topNode.id)) return true;
    if (topNode.children && topNode.children.some((c) => permSet.has(c.id))) return true;
    return false;
  }

  // If this is a child permission (e.g. 101, 102, 703, etc.):
  const parentNode = MENU_TREE.find((node) => node.children?.some((c) => c.id === permissionId));
  if (parentNode) {
    const parentGranted = permSet.has(parentNode.id);
    const configuredChildren = parentNode.children?.filter((c) => permSet.has(c.id)) || [];

    // If specific child permissions are configured in user's permSet for this module:
    if (configuredChildren.length > 0) {
      // STRICT: Only grant if this specific child is in permSet!
      // (This guarantees that if Clone 703 or Delete 607 is NOT checked, it returns FALSE!)
      return permSet.has(permissionId);
    }

    // If NO child permissions are configured for this module, but the parent module was granted (legacy / whole module):
    if (parentGranted) {
      // If the user is Super Admin or Developer (role_id === 1), grant all
      if (user.role_id === 1 || user.role_name === "Developer" || user.role_name === "Admin") {
        return true;
      }
      // For standard users with module 1 (Overview) granted, allow KPIs, charts, and activity:
      if (parentNode.id === 1) return true;
      // For other modules, only view directory by default if parent was granted without sub-selection
      if ([601, 701, 801, 901, 1001, 1101, 1201, 1301, 1401].includes(permissionId)) {
        return true;
      }
      return false;
    }
  }

  return false;
}

export function hasModuleAccess(user: AuthUser | null | undefined, moduleId: number): boolean {
  if (!user) return false;
  const permSet = getUserPermissionSet(user);
  if (permSet.size === 0) {
    return (
      user.role_id === 1 ||
      user.role_name === "Admin" ||
      user.role_name === "Developer" ||
      (typeof user.role_name === "string" && user.role_name.toLowerCase().includes("admin"))
    );
  }

  if (permSet.has(moduleId)) return true;
  const node = MENU_TREE.find((n) => n.id === moduleId);
  if (node && node.children) {
    return node.children.some((c) => permSet.has(c.id));
  }
  return false;
}

interface PermissionsContextValue {
  user: AuthUser | null;
  permSet: Set<number>;
  can: (id: number) => boolean;
  canModule: (id: number) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  user: null,
  permSet: new Set(),
  can: () => false,
  canModule: () => false,
});

export function PermissionsProvider({ user, children }: { user: AuthUser | null; children: ReactNode }) {
  const permSet = useMemo(() => getUserPermissionSet(user), [user]);

  const value = useMemo<PermissionsContextValue>(() => {
    return {
      user,
      permSet,
      can: (id: number) => hasPermission(user, id),
      canModule: (id: number) => hasModuleAccess(user, id),
    };
  }, [user, permSet]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
