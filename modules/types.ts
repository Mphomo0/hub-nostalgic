import type { LucideIcon } from "lucide-react";

/**
 * Describes one product module (Reviews, and later Invoicing, CRM, ...).
 * Definitions are plain data so they can be used in server and client code.
 */
export type ModuleDefinition = {
  /** Stable key stored in the database (ClientModule.module). Never rename. */
  key: string;
  /** Name shown in the dashboard, admin and public site. */
  name: string;
  /** One line for cards and menus. */
  tagline: string;
  icon: LucideIcon;
  /** Public product page, if the module is marketed on the site. */
  marketing?: { href: string };
  /** Dashboard sidebar links for this module. The first one is the module's home. */
  nav: { href: string; label: string; ownerOnly?: boolean }[];
  /**
   * available   = sold now, can be switched on for clients
   * coming-soon = visible to admins only, can't be switched on yet
   */
  status: "available" | "coming-soon";
};
