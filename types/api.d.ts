export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
  severity: "error" | "warning";
}

export interface DeclarativeUserProvisioningApi {
  whenReady(): Promise<DeclarativeUserProvisioningApi>;
  openDashboard(): unknown;
  loadManifest(options?: { path?: string }): Promise<{ path: string; url: string; text: string }>;
  validateManifest(options?: { path?: string; text?: string }): Promise<Record<string, unknown>>;
  plan(options?: { path?: string; text?: string; orphanPolicy?: "preserve" | "disable" }): Promise<Record<string, unknown>>;
  reconcile(options?: { path?: string; text?: string; orphanPolicy?: "preserve" | "disable"; dryRun?: boolean }): Promise<Record<string, unknown>>;
  exportSnapshot(options?: { download?: boolean }): Record<string, unknown>;
  exportSchema(options?: { download?: boolean }): Record<string, unknown>;
  serializeManifest(manifest: Record<string, unknown>, options?: { format?: "yaml" | "json" }): string;
  status(): Record<string, unknown>;
}
