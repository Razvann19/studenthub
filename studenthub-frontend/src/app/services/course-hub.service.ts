import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import {BehaviorSubject, firstValueFrom} from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import {HttpClient} from '@angular/common/http';

export interface CourseMessage {
  id: number;
  userName: string;
  text: string | null;
  waitInterval: string | null;
  createdAt: string;
  userId: number;
  isDeleted: boolean;
  isEdited: boolean;
  replyToId: number | null;
  replyToUserName: string | null;
  replyToText: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  reactions: { emoji: string; count: number; users: string[] }[];
  reportCount: number;

}

export interface CourseNote {
  id: number;
  noteId: string;
  courseId: number;
  userName: string;
  text: string | null;
  createdAt: string;
  userId: number;
  isEdited: boolean;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  reactions: { emoji: string; count: number; users: string[] }[];
  reportCount?: number;
  extractedText?: string | null;


}

@Injectable({ providedIn: 'root' })
export class CourseHubService {
  private authService = inject(AuthService);
  private connection: signalR.HubConnection | null = null;
  private http = inject(HttpClient);


  private messagesSubject = new BehaviorSubject<CourseMessage[]>([]);
  messages$ = this.messagesSubject.asObservable();

  private notesSubject = new BehaviorSubject<CourseNote[]>([]);
  notes$ = this.notesSubject.asObservable();

  private connectedSubject = new BehaviorSubject<boolean>(false);
  connected$ = this.connectedSubject.asObservable();

  private onlineCountSubject = new BehaviorSubject<number>(0);
  onlineCount$ = this.onlineCountSubject.asObservable();

  async connect(courseId: number): Promise<void> {
    if (this.connection) await this.disconnect();
    this.messagesSubject.next([]);
    this.notesSubject.next([]);

    const hubUrl = environment.apiUrl.replace('/api', '') + '/hubs/course';

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: async () => {
          const token = await this.authService.getToken();
          return token ?? '';
        }
      })
      .withAutomaticReconnect()
      .build();

    this.connection.keepAliveIntervalInMilliseconds = 15000;
    this.connection.serverTimeoutInMilliseconds = 60000;

    // ── Chat handlers ──
    this.connection.on('LoadMessages', (messages: CourseMessage[]) => {
      this.messagesSubject.next(messages);
    });

    this.connection.on('ReceiveMessage', (message: CourseMessage) => {
      this.messagesSubject.next([...this.messagesSubject.value, message]);
    });

    this.connection.on('MessageEdited', (data: { messageId: number; newText: string }) => {
      this.messagesSubject.next(this.messagesSubject.value.map(m =>
        m.id === data.messageId ? { ...m, text: data.newText, isEdited: true } : m
      ));
    });

    this.connection.on('MessageDeleted', (messageId: number) => {
      this.messagesSubject.next(this.messagesSubject.value.filter(m => m.id !== messageId));
    });

    this.connection.on('MessageReactionsUpdated', (messageId: number, reactions: any[]) => {
      this.messagesSubject.next(this.messagesSubject.value.map(m =>
        m.id === messageId ? { ...m, reactions } : m
      ));
    });

    // ── Notes handlers ──
    this.connection.on('LoadNotes', (notes: CourseNote[]) => {
      this.notesSubject.next(notes);
    });

    this.connection.on('NoteAdded', (note: CourseNote) => {
      this.notesSubject.next([...this.notesSubject.value, note]);
    });

    this.connection.on('NoteEdited', (data: { noteId: number; newText: string }) => {
      this.notesSubject.next(this.notesSubject.value.map(n =>
        n.id === data.noteId ? { ...n, text: data.newText, isEdited: true } : n
      ));
    });

    this.connection.on('NoteDeleted', (noteId: number) => {
      this.notesSubject.next(this.notesSubject.value.filter(n => n.id !== noteId));
    });

    this.connection.on('NoteReactionsUpdated', (noteId: number, reactions: any[]) => {
      this.notesSubject.next(this.notesSubject.value.map(n =>
        n.id === noteId ? { ...n, reactions } : n
      ));
    });

    // ── Online count ──
    this.connection.on('OnlineCountUpdated', (count: number) => {
      this.onlineCountSubject.next(count);
    });

    this.connection.onreconnected(() => {
      this.connectedSubject.next(true);
      const userId = this.authService.currentUser?.id ?? 0;
      this.connection?.invoke('JoinCourse', courseId, userId);
    });

    await this.connection.start();
    const userId = this.authService.currentUser?.id ?? 0;
    await this.connection.invoke('JoinCourse', courseId, userId);
    this.connectedSubject.next(true);
  }

  // ── Chat methods ──
  async sendMessage(
    courseId: number, text: string | null, userId: number, userName: string,
    replyToId: number | null = null, attachmentUrl: string | null = null,
    attachmentName: string | null = null, attachmentType: string | null = null
  ): Promise<void> {
    await this.connection?.invoke('SendMessage', courseId, text, userId, userName, replyToId, attachmentUrl, attachmentName, attachmentType);
  }

  async editMessage(messageId: number, newText: string, userId: number): Promise<void> {
    await this.connection?.invoke('EditMessage', messageId, newText, userId);
  }

  async deleteMessage(messageId: number, userId: number): Promise<void> {
    await this.connection?.invoke('DeleteMessage', messageId, userId);
  }

  async toggleMessageReaction(messageId: number, emoji: string, userId: number): Promise<void> {
    await this.connection?.invoke('ToggleMessageReaction', messageId, emoji, userId);
  }

  // ── Notes methods ──
  async addNote(
    courseId: number, text: string | null, userId: number, userName: string,
    attachmentUrl: string | null = null, attachmentName: string | null = null,
    attachmentType: string | null = null, extractedText: string | null = null
  ): Promise<void> {
    await this.connection?.invoke('AddNote', courseId, text, userId, userName, attachmentUrl, attachmentName, attachmentType, extractedText);
  }

  async editNote(noteId: number, newText: string, userId: number): Promise<void> {
    await this.connection?.invoke('EditNote', noteId, newText, userId);
  }

  async deleteNote(noteId: number, userId: number): Promise<void> {
    await this.connection?.invoke('DeleteNote', noteId, userId);
  }

  async toggleNoteReaction(noteId: number, emoji: string, userId: number): Promise<void> {
    await this.connection?.invoke('ToggleNoteReaction', noteId, emoji, userId);
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
      this.connectedSubject.next(false);
    }
  }

  async reportMessage(messageId: number): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<{ success: boolean; message?: string }>(
        `${environment.apiUrl}/MessageReport/${messageId}`, {}
      )
    );
    return response.success ? 'ok' : 'already';
  }
}
