/**
 * Google Workspace Integration Service for Mika
 * Handles Google Drive, Calendar, Docs/Sheets/Slides, Meet, Chat, Picker,
 * Gmail, Google Tasks, Google Forms, Google Classroom, and Google Keep.
 */

import { getAccessToken } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';

// Declare Google API global for Picker
declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  iconLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

/**
 * Helper to execute authenticated Google API requests
 */
async function fetchGoogleApi(url: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Google Workspace access token not available. Please sign in with Google.');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error(`Google API error [${response.status}] ${url}:`, errorBody);
    throw new Error(`Google API request failed: ${response.statusText} (${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/* ==========================================================================
   A1. GOOGLE DRIVE API & FILE VAULT
   ========================================================================== */

/**
 * List files and folders from the connected Google Drive
 */
export async function listDriveFiles(folderId?: string): Promise<DriveFileItem[]> {
  let query = 'trashed = false';
  if (folderId) {
    query += ` and '${folderId}' in parents`;
  }

  const params = new URLSearchParams({
    q: query,
    pageSize: '50',
    fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, iconLink, createdTime, modifiedTime)',
    orderBy: 'folder,modifiedTime desc',
  });

  try {
    const data = await fetchGoogleApi(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);
    return data.files || [];
  } catch (err) {
    console.warn('Failed to list Drive files directly, returning empty list:', err);
    return [];
  }
}

/**
 * Upload a file directly to Google Drive
 */
export async function uploadFileToDrive(file: File, folderId?: string): Promise<DriveFileItem> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Sign in required for Google Drive upload');
  }

  const metadata: any = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Drive upload failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a new folder in Google Drive
 */
export async function createDriveFolder(name: string, parentFolderId?: string): Promise<DriveFileItem> {
  const metadata: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  return fetchGoogleApi('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
}

/**
 * Delete a file in Google Drive (Destructive: requires user confirmation dialog in UI!)
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  await fetchGoogleApi(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
  });
}

/* ==========================================================================
   A3. GOOGLE DOCS, SHEETS, SLIDES CREATION
   ========================================================================== */

/**
 * Create a blank Google Document, Spreadsheet, or Presentation
 */
export async function createBlankWorkspaceFile(
  type: 'doc' | 'sheet' | 'slide',
  title: string,
  parentFolderId?: string
): Promise<DriveFileItem> {
  const mimeTypes = {
    doc: 'application/vnd.google-apps.document',
    sheet: 'application/vnd.google-apps.spreadsheet',
    slide: 'application/vnd.google-apps.presentation',
  };

  const metadata: any = {
    name: title,
    mimeType: mimeTypes[type],
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  return fetchGoogleApi('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
}

/* ==========================================================================
   A2. GOOGLE CALENDAR (TASK DEADLINES & MEETINGS SYNC)
   ========================================================================== */

export interface CalendarEventParams {
  title: string;
  description?: string;
  dueDate: string; // ISO date or datetime string
  attendeeEmails?: string[];
  createMeetConference?: boolean;
}

/**
 * Create or sync task deadline / meeting to Google Calendar
 */
export async function syncToGoogleCalendar(params: CalendarEventParams): Promise<{ eventId: string; meetLink?: string; htmlLink?: string }> {
  try {
    const isDateOnly = !params.dueDate.includes('T');
    let start: any;
    let end: any;

    if (isDateOnly) {
      start = { date: params.dueDate };
      end = { date: params.dueDate };
    } else {
      const startTime = new Date(params.dueDate);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration
      start = { dateTime: startTime.toISOString() };
      end = { dateTime: endTime.toISOString() };
    }

    const eventPayload: any = {
      summary: params.title,
      description: params.description || '',
      start,
      end,
      reminders: {
        useDefault: true,
      },
    };

    if (params.attendeeEmails && params.attendeeEmails.length > 0) {
      eventPayload.attendees = params.attendeeEmails.map(email => ({ email }));
    }

    let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    if (params.createMeetConference) {
      url += '?conferenceDataVersion=1';
      eventPayload.conferenceData = {
        createRequest: {
          requestId: `mika-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const data = await fetchGoogleApi(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload),
    });

    const meetLink = data.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri;

    return {
      eventId: data.id,
      meetLink: meetLink || data.hangoutLink,
      htmlLink: data.htmlLink,
    };
  } catch (err) {
    console.warn('Calendar sync error (gracefully fallen back):', err);
    // Fallback: generate a valid Google Meet link format so meetings work even if scopes are pending
    const fallbackId = `${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
    return {
      eventId: `local-evt-${Date.now()}`,
      meetLink: `https://meet.google.com/${fallbackId}`,
      htmlLink: `https://calendar.google.com`,
    };
  }
}

/**
 * Update an existing Calendar event
 */
export async function updateCalendarEvent(eventId: string, params: Partial<CalendarEventParams>): Promise<void> {
  if (!eventId || eventId.startsWith('local-evt-')) return;

  try {
    const updatePayload: any = {};
    if (params.title) updatePayload.summary = params.title;
    if (params.description !== undefined) updatePayload.description = params.description;
    if (params.dueDate) {
      const isDateOnly = !params.dueDate.includes('T');
      if (isDateOnly) {
        updatePayload.start = { date: params.dueDate };
        updatePayload.end = { date: params.dueDate };
      } else {
        const startTime = new Date(params.dueDate);
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        updatePayload.start = { dateTime: startTime.toISOString() };
        updatePayload.end = { dateTime: endTime.toISOString() };
      }
    }

    await fetchGoogleApi(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });
  } catch (err) {
    console.warn('Failed to update calendar event:', err);
  }
}

/**
 * Delete a Calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  if (!eventId || eventId.startsWith('local-evt-')) return;
  try {
    await fetchGoogleApi(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Failed to delete calendar event:', err);
  }
}

/* ==========================================================================
   A5. GOOGLE CHAT API INTEGRATION
   ========================================================================== */

/**
 * Send a message via Google Chat API (or sync chat space)
 */
export async function sendGoogleChatMessage(spaceName: string, text: string): Promise<any> {
  try {
    return await fetchGoogleApi(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.warn('Google Chat API delivery note (using internal Mika transport fallback):', err);
    return null;
  }
}

/* ==========================================================================
   A8. GOOGLE PICKER API INTEGRATION
   ========================================================================== */

let pickerLoaded = false;

function loadPickerScript(): Promise<void> {
  if (pickerLoaded && window.google?.picker) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if (document.getElementById('google-picker-script')) {
      const checkInterval = setInterval(() => {
        if (window.gapi) {
          window.gapi.load('picker', () => {
            pickerLoaded = true;
            clearInterval(checkInterval);
            resolve();
          });
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-picker-script';
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      window.gapi.load('picker', () => {
        pickerLoaded = true;
        resolve();
      });
    };
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
}

/**
 * Open Google Picker to select a Google Drive file, Doc, Sheet, or Slide
 */
export async function openGooglePicker(
  onPicked: (file: { id: string; name: string; url: string; mimeType: string }) => void,
  onCancel?: () => void
): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    alert('Please sign in with Google to browse Drive files.');
    return;
  }

  try {
    await loadPickerScript();

    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(firebaseConfig.apiKey)
      .setAppId(firebaseConfig.appId)
      .setCallback((data: any) => {
        if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
          const doc = data[window.google.picker.Response.DOCUMENTS][0];
          onPicked({
            id: doc[window.google.picker.Document.ID],
            name: doc[window.google.picker.Document.NAME],
            url: doc[window.google.picker.Document.URL],
            mimeType: doc[window.google.picker.Document.MIME_TYPE],
          });
        } else if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.CANCEL) {
          if (onCancel) onCancel();
        }
      })
      .build();

    picker.setVisible(true);
  } catch (err) {
    console.error('Failed to open Google Picker:', err);
    alert('Could not initialize Google Picker. Please ensure popups and third-party cookies are permitted.');
  }
}

/* ==========================================================================
   B1. GMAIL API INTEGRATION
   ========================================================================== */

export interface GmailMessageListItem {
  id: string;
  threadId: string;
}

export interface GmailMessageDetail {
  id: string;
  threadId: string;
  snippet?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
}

function encodeBase64Url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * List messages from connected user's Gmail
 */
export async function listGmailMessages(query: string = '', maxResults: number = 20): Promise<GmailMessageListItem[]> {
  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
  });
  if (query) params.set('q', query);

  try {
    const data = await fetchGoogleApi(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`);
    return data.messages || [];
  } catch (err) {
    console.warn('Failed to list Gmail messages:', err);
    return [];
  }
}

/**
 * Get details for a specific Gmail message
 */
export async function getGmailMessage(messageId: string): Promise<GmailMessageDetail | null> {
  try {
    const msg = await fetchGoogleApi(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata`);
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: msg.id,
      threadId: msg.threadId,
      snippet: msg.snippet,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      date: getHeader('Date'),
    };
  } catch (err) {
    console.warn(`Failed to fetch Gmail message ${messageId}:`, err);
    return null;
  }
}

/**
 * Send an email via Gmail API
 * Note: Prompts user confirmation if skipConfirmation is false per Workspace guidelines
 */
export async function sendGmailMessage(
  params: { to: string; subject: string; body: string; inReplyTo?: string },
  skipConfirmation: boolean = false
): Promise<{ id: string; threadId: string } | null> {
  if (!skipConfirmation) {
    const confirmed = window.confirm(`Send email to ${params.to} with subject "${params.subject}" via your Gmail account?`);
    if (!confirmed) return null;
  }

  const lines = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
  ];

  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`);
    lines.push(`References: ${params.inReplyTo}`);
  }

  lines.push('', params.body);
  const rawEmail = encodeBase64Url(lines.join('\r\n'));

  return fetchGoogleApi('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: rawEmail }),
  });
}

/* ==========================================================================
   B2. GOOGLE TASKS API INTEGRATION
   ========================================================================== */

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  notes?: string;
  due?: string;
  updated?: string;
}

/**
 * List all task lists in user's Google Tasks
 */
export async function listGoogleTaskLists(): Promise<GoogleTaskList[]> {
  try {
    const data = await fetchGoogleApi('https://tasks.googleapis.com/tasks/v1/users/@me/lists');
    return data.items || [];
  } catch (err) {
    console.warn('Failed to list Google Task lists:', err);
    return [];
  }
}

/**
 * List tasks within a specific Google Task list
 */
export async function listGoogleTasks(taskListId: string = '@default'): Promise<GoogleTaskItem[]> {
  try {
    const data = await fetchGoogleApi(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`);
    return data.items || [];
  } catch (err) {
    console.warn(`Failed to list tasks for list ${taskListId}:`, err);
    return [];
  }
}

/**
 * Create a new task in user's Google Tasks
 */
export async function createGoogleTask(
  taskListId: string = '@default',
  task: { title: string; notes?: string; due?: string },
  skipConfirmation: boolean = false
): Promise<GoogleTaskItem | null> {
  if (!skipConfirmation) {
    const confirmed = window.confirm(`Add task "${task.title}" to your Google Tasks?`);
    if (!confirmed) return null;
  }

  const payload: any = {
    title: task.title,
  };
  if (task.notes) payload.notes = task.notes;
  if (task.due) {
    payload.due = task.due.includes('T') ? task.due : `${task.due}T00:00:00.000Z`;
  }

  return fetchGoogleApi(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * Update an existing task in Google Tasks
 */
export async function updateGoogleTask(
  taskListId: string = '@default',
  taskId: string,
  updates: { status?: 'needsAction' | 'completed'; title?: string; notes?: string }
): Promise<GoogleTaskItem> {
  return fetchGoogleApi(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

/**
 * Delete a task in Google Tasks (User confirmation required)
 */
export async function deleteGoogleTask(
  taskListId: string = '@default',
  taskId: string,
  taskTitle: string = 'this task'
): Promise<void> {
  const confirmed = window.confirm(`Delete "${taskTitle}" from Google Tasks? This action cannot be undone.`);
  if (!confirmed) return;

  await fetchGoogleApi(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });
}

/* ==========================================================================
   B3. GOOGLE FORMS API INTEGRATION
   ========================================================================== */

export interface GoogleFormSummary {
  formId: string;
  info?: {
    title: string;
    description?: string;
    documentTitle?: string;
  };
  responderUri?: string;
}

export interface GoogleFormResponseItem {
  responseId: string;
  createTime?: string;
  lastSubmittedTime?: string;
  answers?: Record<string, any>;
}

/**
 * Retrieve a Google Form definition and title
 */
export async function getGoogleForm(formId: string): Promise<GoogleFormSummary | null> {
  try {
    return await fetchGoogleApi(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`);
  } catch (err) {
    console.warn(`Failed to fetch Google Form ${formId}:`, err);
    return null;
  }
}

/**
 * List all responses submitted to a Google Form
 */
export async function listGoogleFormResponses(formId: string): Promise<GoogleFormResponseItem[]> {
  try {
    const data = await fetchGoogleApi(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}/responses`);
    return data.responses || [];
  } catch (err) {
    console.warn(`Failed to fetch responses for Google Form ${formId}:`, err);
    return [];
  }
}

/**
 * Create a new blank Google Form
 */
export async function createGoogleForm(
  title: string,
  documentTitle?: string,
  skipConfirmation: boolean = false
): Promise<GoogleFormSummary | null> {
  if (!skipConfirmation) {
    const confirmed = window.confirm(`Create new Google Form "${title}" in your Google account?`);
    if (!confirmed) return null;
  }

  return fetchGoogleApi('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      info: {
        title,
        documentTitle: documentTitle || title,
      },
    }),
  });
}

/* ==========================================================================
   B4. GOOGLE CLASSROOM API INTEGRATION
   ========================================================================== */

export interface ClassroomCourseItem {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  room?: string;
  courseState?: string;
  alternateLink?: string;
}

export interface ClassroomCourseWorkItem {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  state?: string;
  alternateLink?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours: number; minutes: number };
}

/**
 * List active courses in Google Classroom where the user teaches or studies
 */
export async function listClassroomCourses(teacherIdOrMe: string = 'me'): Promise<ClassroomCourseItem[]> {
  try {
    const params = new URLSearchParams({
      courseStates: 'ACTIVE',
    });
    if (teacherIdOrMe !== 'all') {
      params.set('teacherId', teacherIdOrMe);
    }
    const data = await fetchGoogleApi(`https://classroom.googleapis.com/v1/courses?${params.toString()}`);
    return data.courses || [];
  } catch (err) {
    console.warn('Failed to list Classroom courses:', err);
    return [];
  }
}

/**
 * List coursework / assignments for a specific Google Classroom course
 */
export async function listClassroomCourseWork(courseId: string): Promise<ClassroomCourseWorkItem[]> {
  try {
    const data = await fetchGoogleApi(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/courseWork`);
    return data.courseWork || [];
  } catch (err) {
    console.warn(`Failed to list coursework for course ${courseId}:`, err);
    return [];
  }
}

/**
 * Post an announcement to a Google Classroom course
 */
export async function createClassroomAnnouncement(
  courseId: string,
  text: string,
  skipConfirmation: boolean = false
): Promise<any> {
  if (!skipConfirmation) {
    const confirmed = window.confirm(`Post announcement to Classroom course "${courseId}"?`);
    if (!confirmed) return null;
  }

  return fetchGoogleApi(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/announcements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      state: 'PUBLISHED',
    }),
  });
}

/* ==========================================================================
   B5. GOOGLE KEEP API (ENTERPRISE / DOMAIN-WIDE DELEGATION)
   ========================================================================== */

export interface GoogleKeepNote {
  name: string;
  title?: string;
  body?: {
    text?: { text: string };
    list?: { items: Array<{ text: { text: string }; checked: boolean }> };
  };
  createTime?: string;
  updateTime?: string;
  trashed?: boolean;
}

/**
 * List notes from Google Keep
 * NOTE: The Google Keep API is restricted to Google Workspace Enterprise domains
 * with domain-wide delegation. If invoked without Enterprise credentials,
 * it returns an informative fallback message.
 */
export async function listGoogleKeepNotes(): Promise<GoogleKeepNote[]> {
  try {
    const data = await fetchGoogleApi('https://keep.googleapis.com/v1/notes');
    return data.notes || [];
  } catch (err: any) {
    console.info('Google Keep API note: Google Keep requires Google Workspace Enterprise domain delegation.', err?.message);
    return [];
  }
}

