import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import {BehaviorSubject, Subject} from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface ChatMessage {
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
  reactions: MessageReaction[];
  reportCount: number;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private authService = inject(AuthService);
  private connection: signalR.HubConnection | null = null;
  private onlineCountSubject = new BehaviorSubject<number>(0);
  onlineCount$ = this.onlineCountSubject.asObservable();

  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  messages$ = this.messagesSubject.asObservable();

  private newMessageSubject = new Subject<void>();
  newMessage$ = this.newMessageSubject.asObservable();

  private connectedSubject = new BehaviorSubject<boolean>(false);
  connected$ = this.connectedSubject.asObservable();

  async connect(room: string): Promise<void> {
    if (this.connection) await this.disconnect();

    const hubUrl = environment.apiUrl.replace('/api', '') + '/hubs/chat';

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: async () => {
          const token = await this.authService.getToken();
          return token ?? '';
        }
      })
      .withAutomaticReconnect()
      .build();

    this.connection.on('LoadMessages', (messages: ChatMessage[]) => {
      this.messagesSubject.next(messages);
    });

    this.connection.on('ReceiveMessage', (message: ChatMessage) => {
      const current = this.messagesSubject.value;
      this.messagesSubject.next([...current, message]);
      this.newMessageSubject.next();
    });

    this.connection.on('MessageEdited', (data: { messageId: number; newText: string }) => {
      const current = this.messagesSubject.value;
      this.messagesSubject.next(current.map(m =>
        m.id === data.messageId ? { ...m, text: data.newText, isEdited: true } : m
      ));
    });

    this.connection.on('MessageDeleted', (messageId: number) => {
      const current = this.messagesSubject.value;
      this.messagesSubject.next(current.filter(m => m.id !== messageId));
    });

    this.connection.on('ReactionsUpdated', (messageId: number, reactions: MessageReaction[]) => {
      console.log('ReactionsUpdated received:', { messageId, reactions });
      const current = this.messagesSubject.value;
      this.messagesSubject.next(current.map(m =>
        m.id === messageId ? { ...m, reactions: reactions } : m
      ));
    });


    this.connection.on('OnlineCountUpdated', (count: number) => {
      this.onlineCountSubject.next(count);
    });

    this.connection.onreconnected(() => {
      this.connectedSubject.next(true);
      this.connection?.invoke('JoinRoom', room);
    });


    await this.connection.start();
    const userId = this.authService.currentUser?.id ?? 0;
    await this.connection.invoke('JoinRoom', room, userId);
    this.connectedSubject.next(true);



  }

  async sendMessage(room: string, text: string | null, waitInterval: string | null, replyToId: number | null = null): Promise<void> {
    if (!this.connection) return;
    const user = this.authService.currentUser;
    if (!user) return;
    await this.connection.invoke('SendMessage', room, text, waitInterval, user.id, user.fullName, replyToId);
  }

  async editMessage(messageId: number, newText: string): Promise<void> {
    if (!this.connection) return;
    const user = this.authService.currentUser;
    if (!user) return;
    await this.connection.invoke('EditMessage', messageId, newText, user.id);
  }

  async deleteMessage(messageId: number): Promise<void> {
    if (!this.connection) return;
    const user = this.authService.currentUser;
    if (!user) return;
    await this.connection.invoke('DeleteMessage', messageId, user.id);
  }

  async toggleReaction(messageId: number, emoji: string): Promise<void> {
    if (!this.connection) return;
    const user = this.authService.currentUser;
    if (!user) return;
    await this.connection.invoke('ToggleReaction', messageId, emoji, user.id, user.fullName);
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
      this.connectedSubject.next(false);
      this.messagesSubject.next([]);
    }
  }

  getConnectionState(): string {
    if (!this.connection) return 'Disconnected';
    switch (this.connection.state) {
      case signalR.HubConnectionState.Connected: return 'Connected';
      case signalR.HubConnectionState.Connecting: return 'Connecting';
      case signalR.HubConnectionState.Reconnecting: return 'Reconnecting';
      default: return 'Disconnected';
    }
  }

}
