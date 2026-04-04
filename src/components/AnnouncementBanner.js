import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Hook to display latest announcements
 * @returns {JSX.Element} Announcement banner component
 */
export function useAnnouncementBanner(initialAnnouncements = null) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements || []);
  const [loading, setLoading] = useState(initialAnnouncements === null);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    if (initialAnnouncements !== null) {
      setAnnouncements(initialAnnouncements);
      setLoading(false);
      return;
    }

    const fetchAnnouncements = async () => {
      try {
        const res = await fetch('/api/announcements');
        const data = await res.json();

        if (data.success && data.announcements.length > 0) {
          setAnnouncements(data.announcements);
        }
      } catch (e) {
        console.error('Error fetching announcements:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, [initialAnnouncements]);

  // If no announcements, don't render anything
  if (loading || announcements.length === 0 || !showBanner) {
    return null;
  }

  const latest = announcements[0];

  return (
    <Link href="/announcements">
      <div className="group relative bg-gradient-to-r from-amber-600/30 via-orange-600/30 to-red-600/30 backdrop-blur-lg border border-amber-500/40 rounded-xl p-4 sm:p-5 mb-6 cursor-pointer hover:border-amber-500/60 hover:shadow-lg hover:shadow-amber-500/20 transition-all duration-300">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-amber-500/20 border border-amber-500/40">
              <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6-6 6 6M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-300 uppercase tracking-wider">Important Announcement</p>
            <p className="text-sm sm:text-base text-amber-100 mt-1 line-clamp-2 group-hover:text-white transition-colors">
              {latest.title}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              setShowBanner(false);
            }}
            className="flex-shrink-0 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </Link>
  );
}

/**
 * Component to display announcement banner
 */
export function AnnouncementBanner({ initialAnnouncements = null }) {
  return useAnnouncementBanner(initialAnnouncements);
}
