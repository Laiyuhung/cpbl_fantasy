/**
 * Maintenance API calls are disabled globally.
 * Keep a stable return shape for existing callers.
 */
export function useMaintenanceStatus() {
  return { isUnderMaintenance: false, loading: false, error: null };
}
