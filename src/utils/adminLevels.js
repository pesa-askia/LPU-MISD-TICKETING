// Lower index = higher privilege. Root (0), then Level 3 > Level 2 > Level 1.
const ADMIN_PRIVILEGE_ORDER = [0, 3, 2, 1];

export const ADMIN_LEVEL_LABELS = {
  0: "Root",
  1: "Level 3",
  2: "Level 2",
  3: "Level 1",
};

export const getAdminPrivilegeRank = (adminLevel) => {
  const normalizedLevel = Number(adminLevel);
  const rank = ADMIN_PRIVILEGE_ORDER.indexOf(normalizedLevel);
  return rank === -1 ? Number.POSITIVE_INFINITY : rank;
};

export const isRootAdmin = (adminLevel) => Number(adminLevel) === 0;

export const canAssignTickets = (adminLevel) =>
  getAdminPrivilegeRank(adminLevel) < 3;

export const needsTicketFilters = (adminLevel) =>
  getAdminPrivilegeRank(adminLevel) >= 2;

export const canViewAllTickets = (adminLevel) =>
  getAdminPrivilegeRank(adminLevel) <= 1;
