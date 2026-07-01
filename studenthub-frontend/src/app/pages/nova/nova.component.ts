import {
  Component, inject, OnInit, signal,
  ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { NovaService, AiConversation, AiMessage } from '../../services/nova.service';

@Component({
  selector: 'app-nova',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './nova.component.html',
  styleUrl: './nova.component.scss',
})
export class NovaComponent implements OnInit, AfterViewChecked {
  private authService = inject(AuthService);
  private novaService = inject(NovaService);
  private router = inject(Router);

  @ViewChild('messagesList') messagesList!: ElementRef;
  @ViewChild('textInput') textInput!: ElementRef;

  conversations = signal<AiConversation[]>([]);
  activeConversation = signal<AiConversation | null>(null);
  messages = signal<AiMessage[]>([]);
  loading = signal(false);
  sendingMessage = signal(false);
  loadingConversations = signal(true);
  shouldScrollToBottom = false;

  messageText = '';
  activeCategory = signal<'general' | 'mental' | 'notes'>('general');

  renamingId = signal<number | null>(null);
  renameText = '';
  activeMenuId = signal<number | null>(null);

  get currentUser() { return this.authService.currentUser; }

  get groupedConversations(): { label: string; items: AiConversation[] }[] {
    const groups: { [key: string]: AiConversation[] } = {};
    const convs = this.conversations().filter(c => c.category === this.activeCategory());

    for (const conv of convs) {
      const date = new Date(conv.updatedAt);
      if (isNaN(date.getTime())) continue;
      const label = date.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
      if (!groups[label]) groups[label] = [];
      groups[label].push(conv);
    }

    return Object.entries(groups).map(([label, items]) => ({ label, items }));
  }

  async ngOnInit(): Promise<void> {
    if (!this.authService.currentUser) {
      await this.authService.syncUser(false);
    }
    await this.loadConversations();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesList?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  async loadConversations(): Promise<void> {
    this.loadingConversations.set(true);
    const convs = await this.novaService.getConversations();
    this.conversations.set(convs);
    this.loadingConversations.set(false);
  }

  async newChat(): Promise<void> {
    const conv = await this.novaService.createConversation(this.activeCategory());
    conv.updatedAt = new Date().toISOString();
    this.conversations.update(c => [conv, ...c]);
    await this.openConversation(conv);
  }

  async openConversation(conv: AiConversation): Promise<void> {
    this.activeConversation.set(conv);
    this.activeCategory.set(conv.category as any);
    this.loading.set(true);
    const msgs = await this.novaService.getMessages(conv.id);
    this.messages.set(msgs);
    this.loading.set(false);
    this.shouldScrollToBottom = true;
    this.activeMenuId.set(null);
  }

  async sendMessage(): Promise<void> {
    const text = this.messageText.trim();
    if (!text || this.sendingMessage()) return;

    const conv = this.activeConversation();
    if (!conv) return;

    const isFirstMessage = conv.title === 'Conversație nouă'
    console.log('isFirstMessage:', isFirstMessage, 'title:', conv.title);

    const userMsg: AiMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    };
    this.messages.update(m => [...m, userMsg]);
    this.messageText = '';
    this.shouldScrollToBottom = true;
    this.sendingMessage.set(true);

    try {
      const response = await this.novaService.chat(conv.id, text);

      const assistantMsg: AiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response,
        createdAt: new Date().toISOString()
      };
      this.messages.update(m => [...m, assistantMsg]);
      this.shouldScrollToBottom = true;

      // Reîncarcă conversațiile după primul mesaj ca să apară titlul generat
      if (isFirstMessage) {
        await this.loadConversations();
        const updated = this.conversations().find(c => c.id === conv.id);
        if (updated) this.activeConversation.set(updated);
      }
    } finally {
      this.sendingMessage.set(false);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  setCategory(cat: 'general' | 'mental' | 'notes'): void {
    this.activeCategory.set(cat);
    this.activeConversation.set(null);
    this.messages.set([]);
  }

  toggleMenu(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.activeMenuId.set(this.activeMenuId() === id ? null : id);
  }

  startRename(conv: AiConversation, event: MouseEvent): void {
    event.stopPropagation();
    this.renamingId.set(conv.id);
    this.renameText = conv.title;
    this.activeMenuId.set(null);
  }

  async submitRename(conv: AiConversation): Promise<void> {
    if (!this.renameText.trim()) return;
    await this.novaService.renameConversation(conv.id, this.renameText);
    this.conversations.update(convs =>
      convs.map(c => c.id === conv.id ? { ...c, title: this.renameText } : c)
    );
    this.renamingId.set(null);
  }

  async deleteConversation(id: number, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (!confirm('Ștergi conversația?')) return;
    await this.novaService.deleteConversation(id);
    this.conversations.update(convs => convs.filter(c => c.id !== id));
    if (this.activeConversation()?.id === id) {
      this.activeConversation.set(null);
      this.messages.set([]);
    }
    this.activeMenuId.set(null);
  }

  closeMenus(): void { this.activeMenuId.set(null); }

  goBack(): void { this.router.navigate(['/dashboard']); }

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }

  getCategoryLabel(cat: string): string {
    switch (cat) {
      case 'mental': return '🧠 Mental Health';
      case 'notes': return '📝 Notițe';
      default: return '💬 General';
    }
  }

  getWelcomeMessage(): string {
    const name = this.currentUser?.fullName?.split(' ')[0] ?? 'Student';
    switch (this.activeCategory()) {
      case 'mental': return `Bună, ${name}! 🌟 Sunt Nova, aici pentru tine. Cum te simți azi?`;
      case 'notes': return `Bună, ${name}! 📚 Spune-mi ID-ul notiței (ex: NOTE-X7K2M9P4) și te ajut să o înțelegi!`;
      default: return `Bună, ${name}! 🤖 Sunt Nova, asistentul tău AI. Cu ce te pot ajuta azi?`;
    }
  }

  mobileSidebarOpen = signal(false);

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update(v => !v);
  }

  handleBackBtn(): void {
    if (window.innerWidth < 768) {
      this.mobileSidebarOpen.set(false);
    } else {
      this.goBack();
    }
  }
}
