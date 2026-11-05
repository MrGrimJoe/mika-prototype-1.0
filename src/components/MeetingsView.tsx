import React, { useState, useMemo } from 'react';
import { orgSync } from '../lib/cloudStore';
import { Meeting, User, Department, Role, Assignment } from '../types';
import { 
  Video, 
  Plus, 
  Clock, 
  Calendar, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  X,
  Radio
} from 'lucide-react';
import { canCreateTask } from '../lib/orgRules';
import { syncToGoogleCalendar } from '../lib/workspace';
import { upsertMeeting, upsertNotification } from '../lib/cloudStore';
import { ModalOverlay } from './ui/ModalOverlay';

interface MeetingsViewProps {
  currentUser?: User | null;
  allUsers?: User[];
  allDepts?: Department[];
  allRoles?: Role[];
  assignments?: Assignment[];
  meetings?: Meeting[];
  masterRootUserId?: string;
  onMeetingCreated?: (meeting: Meeting) => void;
  onMeetingEnded?: (meetingId: string) => void;
}

export const MeetingsView: React.FC<MeetingsViewProps> = ({
  currentUser,
  allUsers = [],
  allDepts = [],
  allRoles = [],
  assignments = [],
  meetings = [],
  masterRootUserId,
  onMeetingCreated,
  onMeetingEnded,
}) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);

  // Filter departments where current user holds root authority (Part A6 requirement: root only)
  const authorizedDepts = useMemo(() => {
    if (!currentUser) return [];
    return (allDepts || []).filter(d => !d.isArchived && canCreateTask(currentUser.id, d.id, assignments, allRoles, allDepts, masterRootUserId));
  }, [currentUser, allDepts, assignments, allRoles, masterRootUserId]);

  const canStartMeeting = authorizedDepts.length > 0;

  if (!currentUser) {
    return (
      <div className="p-8 text-center bg-surface border border-hairline rounded-xs font-mono text-xs text-ink-3">
        Please sign in to access Google Meet Conferences.
      </div>
    );
  }

  const handleStartMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    const deptId = selectedDeptId || authorizedDepts[0]?.id;
    if (!meetingTitle.trim() || !deptId) return;

    setErrorMessage(null);
    if (!orgSync.orgId) {
      setErrorMessage('Your session is missing its organization. Sign in again to start a meeting.');
      return;
    }
    setIsStarting(true);

    const dept = allDepts.find(d => d.id === deptId);

    // Get all members assigned to this department
    const deptMemberIds = assignments
      .filter(a => a.deptId === deptId && a.isActive)
      .map(a => a.userId);
    // The host is the calendar organizer, so leave them off the guest list; dedupe the rest.
    const attendeeEmails = Array.from(new Set(
      allUsers
        .filter(u => deptMemberIds.includes(u.id) && u.id !== currentUser.id && u.email)
        .map(u => u.email)
    ));

    try {
      // Create real Google Meet conference via Calendar API
      const result = await syncToGoogleCalendar({
        title: meetingTitle.trim(),
        description: `Mika Department Meeting for ${dept?.name || 'Department'}. Started by ${currentUser.fullName}.`,
        dueDate: new Date().toISOString(),
        attendeeEmails,
        createMeetConference: true,
      });

      if (!result.meetLink) {
        throw new Error('Google did not return a Meet link. Please try again.');
      }

      const newMeeting: Meeting = {
        id: `meet-${Date.now()}`,
        orgId: orgSync.orgId!,
        deptId: deptId,
        deptName: dept?.name || 'Department',
        title: meetingTitle.trim(),
        startedByUserId: currentUser.id,
        startedByName: currentUser.fullName,
        meetLink: result.meetLink as string,
        calendarEventId: result.eventId,
        startTime: new Date().toISOString(),
        isActive: true,
        attendeeUserIds: deptMemberIds,
      };

      // Persist to Firestore
      await upsertMeeting(newMeeting);

      // Send in-app notification alert to department/section members (Part A6)
      // The meeting is already saved, so one failed notification must not look like a failed
      // meeting (that invites a duplicate on retry).
      await Promise.allSettled(
        deptMemberIds
          .filter(memberId => memberId !== currentUser.id)
          .map(memberId =>
            upsertNotification({
              id: `notif-meet-${newMeeting.id}-${memberId}`,
              orgId: orgSync.orgId!,
              userId: memberId,
              title: `Meeting started in ${dept?.name || 'Department'}`,
              message: `${currentUser.fullName} has started a live Google Meet: "${meetingTitle.trim()}". Select to join now.`,
              type: 'meeting_started',
              relatedDeptId: deptId,
              relatedMeetingId: newMeeting.id,
              timestamp: new Date().toISOString(),
              read: false,
            })
          )
      );

      if (onMeetingCreated) {
        onMeetingCreated(newMeeting);
      }

      setCreateModalOpen(false);
      setMeetingTitle('');
    } catch (err: any) {
      console.error('Failed to start meeting:', err);
      setErrorMessage(err?.message || 'Could not start the Google Meet conference. Check your connection and Google permissions, then try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndMeeting = async (meeting: Meeting) => {
    const updated = {
      ...meeting,
      isActive: false,
      endTime: new Date().toISOString(),
    };
    try {
      await upsertMeeting(updated);
      if (onMeetingEnded) {
        onMeetingEnded(meeting.id);
      }
    } catch (err) {
      console.error('Failed to end meeting:', err);
      setEndError(`Could not end "${meeting.title}". Check your connection and try again.`);
    }
  };

  const activeMeetings = meetings.filter(m => m.isActive);
  const pastMeetings = meetings.filter(m => !m.isActive);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header / Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface p-5 border border-hairline rounded-xs shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <Video className="w-5 h-5 text-accent-fg" />
            <span>Google Meet Conferences</span>
          </h2>
          <p className="text-xs text-ink-2 font-mono mt-0.5">
            Department and section meetings with real Google Meet links and member broadcasts.
          </p>
        </div>

        {canStartMeeting && (
          <button
            id="btn-start-meeting"
            onClick={() => {
              setSelectedDeptId(authorizedDepts[0]?.id || '');
              setErrorMessage(null);
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-strong text-white text-xs font-semibold rounded-xs cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Start Department Meeting</span>
          </button>
        )}
      </div>

      {endError && (
        <div role="alert" className="p-3 bg-st-pending-bg border border-st-pending-border rounded-xs text-st-pending text-xs">
          {endError}
        </div>
      )}

      {/* Active Meetings Section */}
      {activeMeetings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-st-pending">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Live Meetings in Progress ({activeMeetings.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="bg-surface border-2 border-accent p-5 rounded-xs shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 bg-st-help-bg text-st-help border border-st-help-border text-xs font-mono rounded-xs font-bold">
                      {meeting.deptName}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-st-pending font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-ping" />
                      LIVE
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-ink mb-1">
                    {meeting.title}
                  </h3>
                  <p className="text-xs text-ink-2 font-mono mb-4">
                    Started by {meeting.startedByName} at {new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-paper-raised">
                  <a
                    href={meeting.meetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold text-center rounded-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Join Google Meet</span>
                  </a>

                  {(currentUser.id === meeting.startedByUserId || currentUser.id === masterRootUserId) && (
                    <button
                      onClick={() => handleEndMeeting(meeting)}
                      className="px-3 py-2 bg-paper hover:bg-st-pending-bg text-st-pending border border-hairline text-xs font-semibold rounded-xs cursor-pointer transition-colors"
                    >
                      End
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Meeting History Section */}
      <div className="bg-surface border border-hairline rounded-xs p-5 shadow-2xs">
        <h3 className="text-xs font-semibold text-ink-3 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-ink-2" />
          <span>Meeting History & Attendance Logs</span>
        </h3>

        {pastMeetings.length > 0 ? (
          <div className="divide-y divide-paper-raised">
            {pastMeetings.map((meeting) => (
              <div key={meeting.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-ink">{meeting.title}</span>
                    <span className="px-2 py-0.5 bg-paper border border-hairline text-xs font-mono text-ink-2 rounded-xs">
                      {meeting.deptName}
                    </span>
                  </div>
                  <p className="text-xs text-ink-3 font-mono">
                    Convened by {meeting.startedByName} • {new Date(meeting.startTime).toLocaleDateString()} {new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-st-done flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Concluded</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-3 font-mono italic py-4">
            No past meetings recorded yet. Meetings started by department roots will appear here.
          </p>
        )}
      </div>

      {/* Start Meeting Modal */}
      {createModalOpen && (
        <ModalOverlay onClose={() => setCreateModalOpen(false)} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-hairline rounded-xs max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-hairline mb-4">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                <Video className="w-4 h-4 text-accent-fg" />
                Launch Google Meet Conference
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-ink-3 hover:text-ink rounded-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartMeeting} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-xs text-ink-2 font-bold mb-1">
                  Meeting Title / Topic:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Preschool All-Hands or Curriculum Alignment"
                  value={meetingTitle}
                  onChange={e => setMeetingTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-hairline rounded-xs bg-paper focus:bg-surface text-ink focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-2 font-bold mb-1">
                  Department / Section (Members will be notified):
                </label>
                <select
                  value={selectedDeptId}
                  onChange={e => setSelectedDeptId(e.target.value)}
                  className="w-full px-3 py-2 border border-hairline rounded-xs bg-paper text-ink focus:outline-hidden cursor-pointer"
                >
                  {authorizedDepts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-st-help-bg border border-st-help-border rounded-xs text-st-help text-xs leading-relaxed">
                Starting this conference creates an authoritative Google Meet link and immediately notifies all department members via in-app alert.
              </div>

              {errorMessage && (
                <div className="p-3 bg-st-pending-bg border border-st-pending-border rounded-xs text-st-pending text-xs leading-relaxed">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3 py-1.5 border border-hairline text-xs font-mono text-ink-2 rounded-xs hover:bg-paper cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isStarting}
                  className="px-4 py-1.5 bg-accent hover:bg-accent-strong text-white text-xs font-semibold rounded-xs cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isStarting ? 'Generating Link...' : 'Launch Google Meet'}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};
