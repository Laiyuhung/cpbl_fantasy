import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook to check system maintenance status
 * Redirects non-admin users to maintenance page if under maintenance
 * @param {boolean} shouldCheck - Whether to perform the check
 * @returns {object} { isUnderMaintenance, loading, error }
 */
export function useMaintenanceStatus(shouldCheck = true) {
  const [isUnderMaintenance, setIsUnderMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!shouldCheck) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let pollInterval;

    const checkMaintenanceStatus = async () => {
      try {
        const res = await fetch('/api/system-settings/maintenance');
        const data = await res.json();

        if (!isMounted) return;

        if (data.success) {
          setIsUnderMaintenance(data.underMaintenance);

          // Get user role from cookie
          const userIdCookie = document.cookie
            .split('; ')
            .find(row => row.startsWith('user_id='));
          const userId = userIdCookie?.split('=')[1];

          // If under maintenance and not admin, redirect to maintenance page
          if (data.underMaintenance && userId) {
            // Check if user is admin by fetching their role
            try {
              const userRes = await fetch(`/api/admin/check?userId=${userId}`);
              const userData = await userRes.json();
              if (!userData.isAdmin) {
                router.push('/maintenance');
              }
            } catch (e) {
              console.error('Error checking admin status:', e);
              // Default to redirect if we can't verify admin status
              router.push('/maintenance');
            }
          }
        } else {
          setError(data.error);
        }
      } catch (e) {
        if (isMounted) {
          console.error('Failed to check maintenance status:', e);
          setError(e.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkMaintenanceStatus();

    // Poll every 30 seconds to check maintenance status
    pollInterval = setInterval(checkMaintenanceStatus, 30000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [shouldCheck, router]);

  return { isUnderMaintenance, loading, error };
}
