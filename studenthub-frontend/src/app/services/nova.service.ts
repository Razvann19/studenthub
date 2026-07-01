import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AiConversation {
  id: number;
  title: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface AiMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  attachmentName?: string;
  attachmentType?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NovaService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/Nova`;

  async getConversations(): Promise<AiConversation[]> {
    const res = await firstValueFrom(
      this.http.get<{ success: boolean; data: AiConversation[] }>(this.base + '/conversations')
    );
    return res.success ? res.data : [];
  }

  async createConversation(category: string, title?: string): Promise<AiConversation> {
    const res = await firstValueFrom(
      this.http.post<{ success: boolean; data: AiConversation }>(
        this.base + '/conversations',
        { category, title }
      )
    );
    return res.data;
  }

  async renameConversation(id: number, title: string): Promise<void> {
    await firstValueFrom(
      this.http.patch(this.base + `/conversations/${id}`, { title })
    );
  }

  async deleteConversation(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(this.base + `/conversations/${id}`)
    );
  }

  async getMessages(conversationId: number): Promise<AiMessage[]> {
    const res = await firstValueFrom(
      this.http.get<{ success: boolean; data: AiMessage[] }>(
        this.base + `/conversations/${conversationId}/messages`
      )
    );
    return res.success ? res.data : [];
  }

  async chat(conversationId: number, message: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ success: boolean; data: { message: string } }>(
        this.base + `/conversations/${conversationId}/chat`,
        { message }
      )
    );
    return res.data.message;
  }

  async chatSimple(text: string, history: { role: string; content: string }[]): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ success: boolean; data: string }>(
        `${environment.apiUrl}/NovaSimple/simple`,
        {
          messages: [...history, { role: 'user', content: text }],
          userName: ''
        }
      )
    );
    return res.data;
  }
}
