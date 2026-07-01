import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface ActivityMessage {
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

export interface PollVote {
  id: number;
  userId: number;
  userName: string;
  createdAt: string;
}

export interface PollOption {
  id: number;
  pollId: number;
  text: string;
  addedByUserId: number;
  addedByUserName: string;
  votes: PollVote[];
}

export interface Poll {
  id: number;
  activityId: number;
  userId: number;
  userName: string;
  question: string;
  allowUserOptions: boolean;
  isEdited: boolean;
  createdAt: string;
  options: PollOption[];
}

@Injectable({ providedIn: 'root' })
export class ActivityHubService {
  private authService = inject(AuthService);
  private connection: signalR.HubConnection | null = null;

  private messagesSubject = new BehaviorSubject<ActivityMessage[]>([]);
  messages$ = this.messagesSubject.asObservable();

  private pollsSubject = new BehaviorSubject<Poll[]>([]);
  polls$ = this.pollsSubject.asObservable();

  private connectedSubject = new BehaviorSubject<boolean>(false);
  connected$ = this.connectedSubject.asObservable();

  private onlineCountSubject = new BehaviorSubject<number>(0);
  onlineCount$ = this.onlineCountSubject.asObservable();

  async connect(activityId: number): Promise<void> {
    if (this.connection) await this.disconnect();

    this.messagesSubject.next([]);
    this.pollsSubject.next([]);

    const hubUrl = environment.apiUrl.replace('/api', '') + '/hubs/activity';

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

    // ── Message handlers ──
    this.connection.on('LoadMessages', (messages: ActivityMessage[]) => {
      this.messagesSubject.next(messages);
    });

    this.connection.on('ReceiveMessage', (message: ActivityMessage) => {
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

    // ── Poll handlers ──
    this.connection.on('LoadPolls', (polls: Poll[]) => {
      this.pollsSubject.next(polls);
    });

    this.connection.on('PollCreated', (poll: Poll) => {
      this.pollsSubject.next([...this.pollsSubject.value, poll]);
    });

    this.connection.on('PollEdited', (data: { pollId: number; newQuestion: string }) => {
      this.pollsSubject.next(this.pollsSubject.value.map(p =>
        p.id === data.pollId ? { ...p, question: data.newQuestion, isEdited: true } : p
      ));
    });

    this.connection.on('PollDeleted', (pollId: number) => {
      this.pollsSubject.next(this.pollsSubject.value.filter(p => p.id !== pollId));
    });

    this.connection.on('PollOptionAdded', (pollId: number, option: PollOption) => {
      this.pollsSubject.next(this.pollsSubject.value.map(p =>
        p.id === pollId ? { ...p, options: [...p.options, option] } : p
      ));
    });

    this.connection.on('PollOptionEdited', (data: { optionId: number; newText: string }) => {
      this.pollsSubject.next(this.pollsSubject.value.map(p => ({
        ...p,
        options: p.options.map(o =>
          o.id === data.optionId ? { ...o, text: data.newText } : o
        )
      })));
    });

    this.connection.on('PollVotesUpdated', (poll: Poll) => {
      this.pollsSubject.next(this.pollsSubject.value.map(p =>
        p.id === poll.id ? poll : p
      ));
    });

    // ── Online count ──
    this.connection.on('OnlineCountUpdated', (count: number) => {
      this.onlineCountSubject.next(count);
    });

    this.connection.onreconnected(() => {
      this.connectedSubject.next(true);
      const userId = this.authService.currentUser?.id ?? 0;
      this.connection?.invoke('JoinActivity', activityId, userId);
    });

    await this.connection.start();
    const userId = this.authService.currentUser?.id ?? 0;
    await this.connection.invoke('JoinActivity', activityId, userId);
    this.connectedSubject.next(true);
  }

  // ── Message methods ──
  async sendMessage(activityId: number, text: string, userId: number, userName: string, replyToId: number | null = null): Promise<void> {
    await this.connection?.invoke('SendMessage', activityId, text, userId, userName, replyToId);
  }

  async editMessage(messageId: number, newText: string, userId: number): Promise<void> {
    await this.connection?.invoke('EditMessage', messageId, newText, userId);
  }

  async deleteMessage(messageId: number, userId: number): Promise<void> {
    await this.connection?.invoke('DeleteMessage', messageId, userId);
  }

  async toggleMessageReaction(messageId: number, emoji: string, userId: number, userName: string): Promise<void> {
    await this.connection?.invoke('ToggleMessageReaction', messageId, emoji, userId, userName);
  }

  // ── Poll methods ──
  async createPoll(activityId: number, question: string, allowUserOptions: boolean, options: string[], userId: number, userName: string): Promise<void> {
    await this.connection?.invoke('CreatePoll', activityId, question, allowUserOptions, options, userId, userName);
  }

  async editPoll(pollId: number, newQuestion: string, userId: number): Promise<void> {
    await this.connection?.invoke('EditPoll', pollId, newQuestion, userId);
  }

  async deletePoll(pollId: number, userId: number): Promise<void> {
    await this.connection?.invoke('DeletePoll', pollId, userId);
  }

  async addPollOption(pollId: number, text: string, userId: number, userName: string): Promise<void> {
    await this.connection?.invoke('AddPollOption', pollId, text, userId, userName);
  }

  async editPollOption(optionId: number, newText: string, userId: number): Promise<void> {
    await this.connection?.invoke('EditPollOption', optionId, newText, userId);
  }

  async vote(pollId: number, optionId: number, userId: number, userName: string): Promise<void> {
    await this.connection?.invoke('Vote', pollId, optionId, userId, userName);
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
      this.connectedSubject.next(false);
    }
  }
}
