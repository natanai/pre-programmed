import { INVENTORY_POSSESSION_SERVICES } from "../../features/inventory/runtime";

/** Installed primary-possession service. Equipment depends on this port, not Inventory internals. */
export const PRIMARY_POSSESSION_SERVICES = INVENTORY_POSSESSION_SERVICES;
