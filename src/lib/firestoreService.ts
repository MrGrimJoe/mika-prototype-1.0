/**
 * Firestore Service Layer for Mika
 * Handles persistent storage across Firestore collections with local cache fallback
 * and real-time synchronization.
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  Task,
  Comment,
  FileItem,
  Meeting,
  OrgNotification,
  Message,
  Organization,
  Department,
  Role,
  Assignment,
} from '../types';

/* ==========================================================================
   TASKS
   ========================================================================== */

export async function upsertTask(task: Task): Promise<void> {
  try {
    const docRef = doc(db, 'tasks', task.id);
    const payload = { ...task, orgId: task.orgId || 'org_school' };
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `tasks/${task.id}`);
  }
}

export async function removeTask(taskId: string): Promise<void> {
  try {
    const docRef = doc(db, 'tasks', taskId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
  }
}

export function subscribeTasks(
  orgId: string = 'org_school',
  onTasks: (tasks: Task[]) => void,
  deptId?: string,
  onError?: (err: any) => void
) {
  try {
    const colRef = collection(db, 'tasks');
    const q = deptId
      ? query(colRef, where('orgId', '==', orgId), where('deptId', '==', deptId))
      : query(colRef, where('orgId', '==', orgId));
    return onSnapshot(
      q,
      (snapshot) => {
        const tasks = snapshot.docs.map((d) => d.data() as Task);
        onTasks(tasks);
      },
      (err) => {
        console.warn('Firestore tasks subscription fallback:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.warn('Firestore tasks listen error:', err);
    return () => {};
  }
}

/* ==========================================================================
   COMMENTS
   ========================================================================== */

export async function upsertComment(comment: Comment): Promise<void> {
  try {
    const docRef = doc(db, 'comments', comment.id);
    const payload = { ...comment, orgId: comment.orgId || 'org_school' };
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `comments/${comment.id}`);
  }
}

export function subscribeComments(
  orgId: string = 'org_school',
  onComments: (comments: Comment[]) => void
) {
  try {
    const colRef = collection(db, 'comments');
    const q = query(colRef, where('orgId', '==', orgId));
    return onSnapshot(
      q,
      (snapshot) => {
        const comments = snapshot.docs.map((d) => d.data() as Comment);
        onComments(comments);
      },
      (err) => console.warn('Firestore comments subscription notice:', err)
    );
  } catch (err) {
    return () => {};
  }
}

/* ==========================================================================
   MEETINGS (Part A6)
   ========================================================================== */

export async function upsertMeeting(meeting: Meeting): Promise<void> {
  try {
    const docRef = doc(db, 'meetings', meeting.id);
    const payload = { ...meeting, orgId: meeting.orgId || 'org_school' };
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `meetings/${meeting.id}`);
  }
}

export function subscribeMeetings(
  orgId: string = 'org_school',
  onMeetings: (meetings: Meeting[]) => void
) {
  try {
    const colRef = collection(db, 'meetings');
    const q = query(colRef, where('orgId', '==', orgId));
    return onSnapshot(
      q,
      (snapshot) => {
        const meetings = snapshot.docs.map((d) => d.data() as Meeting);
        onMeetings(meetings);
      },
      (err) => console.warn('Firestore meetings subscription notice:', err)
    );
  } catch (err) {
    return () => {};
  }
}

/* ==========================================================================
   FILES (Part A1)
   ========================================================================== */

export async function upsertFileItem(file: FileItem): Promise<void> {
  try {
    const docRef = doc(db, 'files', file.id);
    const payload = { ...file, orgId: file.orgId || 'org_school' };
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `files/${file.id}`);
  }
}

export async function removeFileItem(fileId: string): Promise<void> {
  try {
    const docRef = doc(db, 'files', fileId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `files/${fileId}`);
  }
}

export const uploadMikaFile = upsertFileItem;
export const deleteMikaFile = removeFileItem;

export function subscribeFiles(
  orgId: string = 'org_school',
  onFiles: (files: FileItem[]) => void,
  deptId?: string
) {
  try {
    const colRef = collection(db, 'files');
    const q = deptId
      ? query(colRef, where('orgId', '==', orgId), where('deptId', '==', deptId))
      : query(colRef, where('orgId', '==', orgId));
    return onSnapshot(
      q,
      (snapshot) => {
        const files = snapshot.docs.map((d) => d.data() as FileItem);
        onFiles(files);
      },
      (err) => console.warn('Firestore files subscription notice:', err)
    );
  } catch (err) {
    return () => {};
  }
}

/* ==========================================================================
   NOTIFICATIONS
   ========================================================================== */

export async function upsertNotification(notif: OrgNotification): Promise<void> {
  try {
    const docRef = doc(db, 'notifications', notif.id);
    const payload = { ...notif, orgId: notif.orgId || 'org_school' };
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `notifications/${notif.id}`);
  }
}

export function subscribeNotifications(
  orgId: string = 'org_school',
  onNotifs: (notifs: OrgNotification[]) => void,
  userId?: string
) {
  try {
    const colRef = collection(db, 'notifications');
    const q = userId
      ? query(colRef, where('orgId', '==', orgId), where('userId', '==', userId))
      : query(colRef, where('orgId', '==', orgId));
    return onSnapshot(
      q,
      (snapshot) => {
        const notifs = snapshot.docs.map((d) => d.data() as OrgNotification);
        onNotifs(notifs);
      },
      (err) => console.warn('Firestore notifications subscription notice:', err)
    );
  } catch (err) {
    return () => {};
  }
}

/* ==========================================================================
   MESSAGES (Part A5)
   ========================================================================== */

export async function upsertMessage(message: Message): Promise<void> {
  try {
    const docRef = doc(db, 'messages', message.id);
    const payload = { ...message, orgId: message.orgId || 'org_school' };
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `messages/${message.id}`);
  }
}

export function subscribeMessages(
  orgId: string = 'org_school',
  onMessages: (messages: Message[]) => void,
  channelId?: string
) {
  try {
    const colRef = collection(db, 'messages');
    const q = channelId
      ? query(colRef, where('orgId', '==', orgId), where('channelId', '==', channelId))
      : query(colRef, where('orgId', '==', orgId));
    return onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((d) => d.data() as Message);
        onMessages(msgs);
      },
      (err) => console.warn('Firestore messages subscription notice:', err)
    );
  } catch (err) {
    return () => {};
  }
}

/* ==========================================================================
   INITIAL SEEDING
   ========================================================================== */

export async function initializeFirestoreIfNeeded(
  org: Organization,
  departments: Department[],
  roles: Role[],
  assignments: Assignment[]
): Promise<void> {
  try {
    const orgDoc = await getDoc(doc(db, 'organizations', org.id));
    if (!orgDoc.exists()) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'organizations', org.id), org);

      for (const dept of departments) {
        batch.set(doc(db, 'departments', dept.id), dept);
      }
      for (const role of roles) {
        batch.set(doc(db, 'roles', role.id), role);
      }
      for (const asgn of assignments) {
        batch.set(doc(db, 'assignments', asgn.id), asgn);
      }

      await batch.commit();
      console.log('Firestore initialized with organization schema.');
    }
  } catch (err) {
    console.warn('Firestore initialization notice (using memory state):', err);
  }
}
