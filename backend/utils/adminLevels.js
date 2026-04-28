export const ADMIN_LEVEL_LABELS = {
    0: "Global Admin",
    1: "Ticket Admin",
};

export const isGlobalAdmin = (adminLevel) => Number(adminLevel) === 0;
