import React, { useState, useMemo } from 'react';
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
import { upsertMeeting, upsertNotification } from '../lib/firestoreService';

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

  // Filter departments where current user holds root authority (Part A6 requirement: root only)
  const authorizedDepts = useMemo(() => {
    if (!currentUser) return [];
    return (allDepts || []).filter(d => !d.isArchived && canCreateTask(currentUser.id, d.id, assignments, allRoles, allDepts, masterRootUserId));
  }, [currentUser, allDepts, assignments, allRoles, masterRootUserId]);

  const canStartMeeting = authorizedDepts.length > 0;

  if (!currentUser) {
    return (
      <div className="p-8 text-center bg-white border border-[#DAD5C9] rounded-xs font-mono text-xs text-[#8A8578]">
        Please sign in to access Google Meet Conferences.
      </div>
    );
  }

  const handleStartMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    const deptId = selectedDeptId || authorizedDepts[0]?.id;
    if (!meetingTitle.trim() || !deptId) return;

    setIsStarting(true);
    setErrorMessage(null);
    const dept = allDepts.find(d => d.id === deptId);

    // Get all members assigned to this department
    const deptMemberIds = assignments
      .filter(a => a.deptId === deptId && a.isActive)
      .map(a => a.userId);
    const attendeeEmails = allUsers
      .filter(u => deptMemberIds.includes(u.id) && u.email)
      .map(u => u.email);

    try {
      // Create real Google Meet conference via Calendar API
      const result = await syncToGoogleCalendar({
        title: meetingTitle.trim(),
        description: `Mika Department Meeting for ${dept?.name || 'Department'}. Started by ${currentUser.fullName}.`,
        dueDate: new Date().toISOString(),
        attendeeEmails,
        createMeetConference: true,
      });

      const newMeeting: Meeting = {
        id: `meet-${Date.now()}`,
        orgId: dept?.orgId || 'org_school',
        deptId: deptId,
        deptName: dept?.name || 'Department',
        title: meetingTitle.trim(),
        startedByUserId: currentUser.id,
        startedByName: currentUser.fullName,
        meetLink: result.meetLink || 'https://meet.google.com',
        calendarEventId: result.eventId,
        startTime: new Date().toISOString(),
        isActive: true,
        attendeeUserIds: deptMemberIds,
      };

      // Persist to Firestore
      await upsertMeeting(newMeeting);

      // Send in-app notification alert to department/section members (Part A6)
      for (const memberId of deptMemberIds) {
        if (memberId !== currentUser.id) {
          await upsertNotification({
            id: `notif-meet-${Date.now()}-${memberId}`,
            orgId: currentUser.orgId || 'org_oakridge',
            userId: memberId,
            title: `Meeting started in ${dept?.name || 'Department'}`,
            message: `${currentUser.fullName} has started a live Google Meet: "${meetingTitle.trim()}". Click to join now.`,
            type: 'meeting_started',
            relatedDeptId: deptId,
            relatedMeetingId: newMeeting.id,
            timestamp: new Date().toISOString(),
            read: false,
          });
        }
      }

      if (onMeetingCreated) {
        onMeetingCreated(newMeeting);
      }

      setCreateModalOpen(false);
      setMeetingTitle('');
    } catch (err: any) {
      console.error('Failed to start meeting:', err);
      setErrorMessage(err?.message || 'Could not initialize Google Meet conference. Please check connection and permissions.');
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
    await upsertMeeting(updated);
    if (onMeetingEnded) {
      onMeetingEnded(meeting.id);
    }
  };

  const activeMeetings = meetings.filter(m => m.isActive);
  const pastMeetings = meetings.filter(m => !m.isActive);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header / Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 border border-[#DAD5C9] rounded-xs shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-[#1C2438] flex items-center gap-2">
            <Video className="w-5 h-5 text-[#2F3B7A]" />
            <span>Google Meet Conferences</span>
          </h2>
          <p className="text-xs text-[#5C574B] font-mono mt-0.5">
            Department and section meetings with real Google Meet links and member broadcasts.
          </p>
        </div>

        {canStartMeeting && (
          <button
            id="btn-start-meeting"
            onClick={() => {
              setSelectedDeptId(authorizedDepts[0]?.id || '');
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2F3B7A] hover:bg-[#253063] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xs cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Start Department Meeting</span>
          </button>
        )}
      </div>

      {/* Active Meetings Section */}
      {activeMeetings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#DC2626]">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Live Meetings in Progress ({activeMeetings.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="bg-white border-2 border-[#2F3B7A] p-5 rounded-xs shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] text-[11px] font-mono rounded-xs font-bold">
                      {meeting.deptName}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-[#DC2626] font-mono font-bold">
                      <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-ping" />
                      LIVE
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#1C2438] mb-1">
                    {meeting.title}
                  </h3>
                  <p className="text-xs text-[#5C574B] font-mono mb-4">
                    Started by {meeting.startedByName} at {new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-[#EFEBE2]">
                  <a
                    href={meeting.meetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-mono font-bold uppercase tracking-wider text-center rounded-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Join Google Meet</span>
                  </a>

                  {(currentUser.id === meeting.startedByUserId || currentUser.id === masterRootUserId) && (
                    <button
                      onClick={() => handleEndMeeting(meeting)}
                      className="px-3 py-2 bg-[#F7F5F0] hover:bg-[#FEF2F2] text-[#DC2626] border border-[#DAD5C9] text-xs font-mono font-bold uppercase tracking-wider rounded-xs cursor-pointer transition-colors"
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
      <div className="bg-white border border-[#DAD5C9] rounded-xs p-5 shadow-2xs">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#8A8578] mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#5C574B]" />
          <span>Meeting History & Attendance Logs</span>
        </h3>

        {pastMeetings.length > 0 ? (
          <div className="divide-y divide-[#EFEBE2]">
            {pastMeetings.map((meeting) => (
              <div key={meeting.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-[#1C2438]">{meeting.title}</span>
                    <span className="px-2 py-0.5 bg-[#F7F5F0] border border-[#DAD5C9] text-[11px] font-mono text-[#5C574B] rounded-xs">
                      {meeting.deptName}
                    </span>
                  </div>
                  <p className="text-xs text-[#8A8578] font-mono">
                    Convened by {meeting.startedByName} • {new Date(meeting.startTime).toLocaleDateString()} {new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#16A34A] flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Concluded</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#8A8578] font-mono italic py-4">
            No past meetings recorded yet. Meetings started by department roots will appear here.
          </p>
        )}
      </div>

      {/* Start Meeting Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DAD5C9] rounded-xs max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#DAD5C9] mb-4">
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#1C2438] flex items-center gap-2">
                <Video className="w-4 h-4 text-[#2F3B7A]" />
                Launch Google Meet Conference
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-[#8A8578] hover:text-[#1C2438] rounded-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartMeeting} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#5C574B] font-bold mb-1">
                  Meeting Title / Topic:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Preschool All-Hands or Curriculum Alignment"
                  value={meetingTitle}
                  onChange={e => setMeetingTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DAD5C9] rounded-xs bg-[#F7F5F0] focus:bg-white text-[#1C2438] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#5C574B] font-bold mb-1">
                  Department / Section (Members will be notified):
                </label>
                <select
                  value={selectedDeptId}
                  onChange={e => setSelectedDeptId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#DAD5C9] rounded-xs bg-[#F7F5F0] text-[#1C2438] focus:outline-hidden cursor-pointer"
                >
                  {authorizedDepts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xs text-[#1E40AF] text-[11px] leading-relaxed">
                Starting this conference creates an authoritative Google Meet link and immediately notifies all department members via in-app alert.
              </div>

              {errorMessage && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xs text-[#DC2626] text-[11px] leading-relaxed">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#DAD5C9]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3 py-1.5 border border-[#DAD5C9] text-xs font-mono text-[#5C574B] rounded-xs hover:bg-[#F7F5F0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isStarting}
                  className="px-4 py-1.5 bg-[#2F3B7A] hover:bg-[#253063] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xs cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isStarting ? 'Generating Link...' : 'Launch Google Meet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
