import React from 'react';
import { User } from '../types';
import { Inbox } from 'lucide-react';

interface DashboardViewProps {
  currentUser: User | null;
  orgName?: string;
  onNavigateToTab?: (tab: string) => void;
  // Kept for backward compatibility
  allUsers?: any[];
  allRoles?: any[];
  allDepts?: any[];
  assignments?: any[];
  notifications?: any[];
  onClearNotification?: (id: string) => void;
  onMarkAllRead?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  orgName = 'School'
}) => {
  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 font-sans">
      {/* Main Single-State Container: Starts directly with actual content */}
      <div className="p-12 sm:p-20 bg-white border border-[#E5E7EB] rounded-xs shadow-2xs flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center mb-5 text-[#9CA3AF]">
          <Inbox className="w-7 h-7 stroke-[1.5]" />
        </div>

        <h2 className="text-2xl font-bold text-[#111827] tracking-tight">
          No new updates
        </h2>

        <p className="mt-2 text-sm text-[#6B7280] max-w-md leading-relaxed">
          You're all caught up. There are no new announcements, task submissions, or organizational alerts at this time.
        </p>

        <div className="mt-6 inline-flex items-center gap-2 px-3 py-1 rounded-xs bg-[#F9FAFB] border border-[#E5E7EB] text-xs font-mono text-[#4B5563]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
          <span>Feed is clear</span>
        </div>
      </div>
    </div>
  );
};
