import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private authService = inject(AuthService);

  private unreadCountsSubject = new BehaviorSubject<Record<string, number>>({});
  unreadCounts$ = this.unreadCountsSubject.asObservable();

  private connections: signalR.HubConnection[] = [];

  async startListening(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user) return;

    await this.connectToHub('/hubs/chat', 'cantina', user.id, 'ReactionsUpdated', 'ReceiveMessage', 'MessageDeleted');
    await this.connectToHub('/hubs/course', null, user.id, 'ReceiveMessage', 'NoteAdded', 'MessageDeleted', 'NoteDeleted');
    await this.connectToHub('/hubs/activity', null, user.id, 'ReceiveMessage', 'MessageDeleted');
  }

  private async connectToHub(path: string, room: string | null, userId: number, ...events: string[]): Promise<void> {
    const hubUrl = environment.apiUrl.replace('/api', '') + path;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: async () => {
          const token = await this.authService.getToken();
          return token ?? '';
        }
      })
      .withAutomaticReconnect()
      .build();

    // La fiecare mesaj nou actualizăm counts
    connection.on('ReceiveMessage', (message: any) => {
      if (message.userId !== userId) {
        this.incrementCount(message.room ?? this.getRoomFromPath(path));
      }
    });

    connection.on('NoteAdded', (note: any) => {
      if (note.userId !== userId) {
        this.incrementCount(`course-${note.courseId}`);
      }
    });

    connection.on('MessageDeleted', () => {
      // Nu scădem — lăsăm polling-ul să corecteze
    });

    await connection.start();

    if (room) {
      await connection.invoke('JoinRoom', room, userId);
    }

    this.connections.push(connection);
  }

  private incrementCount(room: string): void {
    const current = this.unreadCountsSubject.value;
    this.unreadCountsSubject.next({
      ...current,
      [room]: (current[room] ?? 0) + 1
    });
  }

  private getRoomFromPath(path: string): string {
    return path.replace('/hubs/', '');
  }

  updateCounts(counts: Record<string, number>): void {
    this.unreadCountsSubject.next(counts);
  }

  clearRoom(roomId: string): void {
    const current = { ...this.unreadCountsSubject.value };
    delete current[roomId];
    this.unreadCountsSubject.next(current);
  }

  async stopListening(): Promise<void> {
    for (const conn of this.connections) {
      await conn.stop();
    }
    this.connections = [];
  }
}
