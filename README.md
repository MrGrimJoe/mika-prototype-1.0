# Mika — Recursive Organizational Operating System

Mika is a hierarchical organizational management platform that models teams, departments, sections, and delegable authority as a typed, living relationship graph. Designed for educational institutions and structured organizations, Mika integrates deeply with Google Workspace to unify tasks, documentation, video conferencing, and cross-departmental collaboration into a single cohesive interface.

---

## 1. Current Status of the App

Mika is fully functional and running with live Firebase Firestore persistence and Google Workspace OAuth authentication:

- **Department Hierarchy & Recursive Authority**:
  - Visual relationship graph with department nesting, role definitions, and authority badges.
  - Granular delegation engine enforcing rules: users can only manage tasks and sub-departments where their role holds authoritative jurisdiction.
- **Task Management Engine & Full-Page View**:
  - Multi-level delegable subtasks with real-time state tracking (`draft`, `in_progress`, `review`, `blocked`, `completed`).
  - Google Calendar integration: task deadlines automatically create and sync with Google Calendar events.
  - Google Drive attachment linking and cloud asset tracking.
- **File Vault**:
  - Direct Google Drive integration (`drive.file`, `drive.readonly`).
  - Folder creation, file uploading, and direct creation of Google Docs, Google Sheets, and Google Slides.
  - Native Google Picker modal to browse and attach files from Drive.
- **Meetings & Conferences**:
  - Live Google Meet integration generating authentic conference rooms (`https://meet.google.com/...`).
  - Automated in-app notifications dispatched to all department members when a conference begins.
- **Staff Directory & People**:
  - Personnel listing with department assignments, contact profiles, and authority levels.
- **Invitations & Role-Link Onboarding**:
  - Cryptographic join tokens and QR codes for department-scoped onboarding.
  - Secure role-link onboarding flow with Google Sign-In identity resolution.
- **Internal Messaging**:
  - Department channels and direct staff messaging with Google Chat API transport hooks.

---

## 2. Google Workspace Integrations

The application is configured with Google Cloud OAuth (Project: `idyllic-charter-w07pf`) with all necessary scopes provisioned. All integration helper functions are located in `src/lib/workspace.ts` and authenticate using the client-side Google OAuth Bearer access token.

### Summary of Integrations

| Service | Authorized Scopes | Primary Capabilities | Implementation Status |
| :--- | :--- | :--- | :--- |
| **Gmail** | `https://mail.google.com/`<br/>`gmail.modify`<br/>`gmail.send`<br/>`gmail.readonly` | Send task notifications, email digests, compose outbound alerts, read threads | Ready in `src/lib/workspace.ts` (`sendGmailMessage`, `listGmailMessages`, `getGmailMessage`) |
| **Google Tasks** | `https://www.googleapis.com/auth/tasks`<br/>`tasks.readonly` | Sync department tasks with personal to-do lists, manage task status and due dates | Ready in `src/lib/workspace.ts` (`listGoogleTaskLists`, `listGoogleTasks`, `createGoogleTask`, `updateGoogleTask`) |
| **Google Forms** | `https://www.googleapis.com/auth/forms.body`<br/>`forms.body.readonly`<br/>`forms.responses.readonly` | Generate intake surveys, feedback forms, and inspect submitted responses | Ready in `src/lib/workspace.ts` (`getGoogleForm`, `listGoogleFormResponses`, `createGoogleForm`) |
| **Google Classroom** | `classroom.courses`<br/>`classroom.coursework.students`<br/>`classroom.announcements`<br/>`classroom.rosters` | Link academic departments to courses, sync coursework deliverables, broadcast announcements | Ready in `src/lib/workspace.ts` (`listClassroomCourses`, `listClassroomCourseWork`, `createClassroomAnnouncement`) |
| **Google Keep** | `https://keep.googleapis.com/v1/notes` | Sync meeting takeaways and scratchpad notes to Google Keep | Helper ready in `src/lib/workspace.ts` (`listGoogleKeepNotes`); requires Enterprise domain-wide delegation |

---

## 3. How to Implement and Use Each Integration

### A. Gmail API

#### Capabilities
- Dispatch official email notifications to assignees when a high-priority task is created or updated.
- Send meeting summaries and department announcements directly to staff mailboxes.
- View recent email threads linked to specific departmental inquiries.

#### Code Pattern
```typescript
import { sendGmailMessage, listGmailMessages } from './lib/workspace';

// 1. Send an email notification (prompts user confirmation dialog per Workspace guidelines)
await sendGmailMessage({
  to: 'teacher@school.edu',
  subject: '[Mika] New Task Assignment: Curriculum Review',
  body: 'You have been assigned as lead reviewer for the Science Department Q1 Curriculum.',
});

// 2. Fetch recent incoming messages
const messages = await listGmailMessages('subject:Curriculum', 10);
```

---

### B. Google Tasks API

#### Capabilities
- Allow users to export their Mika assigned subtasks to their personal Google Tasks list so they appear on mobile widgets and Google Calendar.
- Sync task completion states: completing a task in Google Tasks can update the corresponding deliverable in Mika.

#### Code Pattern
```typescript
import { listGoogleTaskLists, createGoogleTask, updateGoogleTask } from './lib/workspace';

// 1. List user task lists
const lists = await listGoogleTaskLists();
const primaryListId = lists[0]?.id || '@default';

// 2. Export a Mika task to Google Tasks
await createGoogleTask(primaryListId, {
  title: 'Submit Grade Reports',
  notes: 'Department: Mathematics | Authoritative deadline via Mika',
  due: '2026-09-15T17:00:00.000Z',
});

// 3. Mark task completed
await updateGoogleTask(primaryListId, 'taskId123', {
  status: 'completed',
});
```

---

### C. Google Forms API

#### Capabilities
- Create department feedback forms, event RSVPs, or student intake questionnaires directly from Mika.
- Retrieve form submissions to review stakeholder responses within task approval workflows.

#### Code Pattern
```typescript
import { createGoogleForm, getGoogleForm, listGoogleFormResponses } from './lib/workspace';

// 1. Create a new Google Form
const form = await createGoogleForm('Staff Workshop Feedback Q3');
console.log('Form created at:', form?.responderUri);

// 2. Retrieve responses to analyze submissions
if (form?.formId) {
  const responses = await listGoogleFormResponses(form.formId);
  console.log(`Received ${responses.length} responses.`);
}
```

---

### D. Google Classroom API

#### Capabilities
- Map academic departments in Mika (e.g. Science, Humanities) to active Google Classroom course offerings.
- List coursework deliverables and sync assignment due dates into the department task calendar.
- Publish administrative announcements directly to enrolled students and faculty.

#### Code Pattern
```typescript
import { listClassroomCourses, listClassroomCourseWork, createClassroomAnnouncement } from './lib/workspace';

// 1. List active courses taught or administered
const courses = await listClassroomCourses('me');

// 2. Fetch coursework / assignments for a course
if (courses.length > 0) {
  const courseWork = await listClassroomCourseWork(courses[0].id);
  console.log('Coursework items:', courseWork);
}

// 3. Post an announcement to a course
await createClassroomAnnouncement(
  courses[0].id,
  'Final Project review sessions are now scheduled in the Mika Department Hub.'
);
```

---

### E. Google Keep API & Enterprise Requirements

#### Capabilities
- Synchronize quick scratchpad notes, meeting takeaways, and checklist items to Google Keep.

#### Architectural Note on Google Keep
The Google Keep API is an **Enterprise-only** Google Workspace API. Unlike Gmail or Google Tasks, consumer Google accounts and standard OAuth consent brands cannot grant Keep scopes directly. 

- **How to use on Google Workspace Enterprise**:
  1. Access the Google Cloud Console for your Workspace domain.
  2. Create a Service Account with **Domain-Wide Delegation (DWD)** enabled.
  3. In the Google Workspace Admin Console (`admin.google.com`), authorize the Service Account Client ID with the Keep API scope: `https://www.googleapis.com/auth/keep`.
  4. Use the `listGoogleKeepNotes()` function in `src/lib/workspace.ts`, which connects to `https://keep.googleapis.com/v1/notes`.

---

## 4. User Confirmation & Security Model

In accordance with Google Workspace integration security requirements:
- **Destructive & Outbound Operations**: All functions that modify user data, delete resources, or send external communications (such as `sendGmailMessage`, `deleteGoogleTask`, and `createClassroomAnnouncement`) include explicit user confirmation prompts before execution.
- **In-Memory Token Cache**: OAuth access tokens obtained through Google Sign-In are cached strictly in-memory (`src/lib/firebase.ts`) and are **never** persisted to `localStorage` or `sessionStorage`.
- **RBAC Authority Verification**: Workspace actions are gated by Mika's internal authorization engine (`canCreateTask`, `canDelegateTask`) to ensure only authorized role holders can initiate organization-wide actions.

---

## 5. Development & Running Locally

### Prerequisites
- Node.js (v18+)
- npm or bun

### Setup
```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev
```

The application runs on `http://localhost:3000`.
