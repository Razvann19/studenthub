import {
  Component, inject, OnInit, OnDestroy,
  signal, ViewChild, ElementRef, AfterViewChecked,
  HostBinding
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { ChatService, ChatMessage } from '../../../services/chat.service';
import { AuthService } from '../../../services/auth.service';
import {EmojiPickerComponent} from '../components/emoji-picker/emoji-picker.component';
import {HttpClient} from '@angular/common/http';
import {environment} from '../../../../environments/environment';
import {firstValueFrom} from 'rxjs';


const WAIT_INTERVALS = ['5-10 min', '10-20 min', '20-30 min', '30+ min'];
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '👎'];
const ROOM = 'cantina';

@Component({
  selector: 'app-cantina',
  standalone: true,
  imports: [FormsModule, AsyncPipe, EmojiPickerComponent],
  templateUrl: './cantina.component.html',
  styleUrl: './cantina.component.scss',
})
export class CantinaComponent implements OnInit, OnDestroy, AfterViewChecked {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private router = inject(Router);
  showEmojiLibrary = signal(false);
  libraryForMessageId = signal<number | null>(null);
  menuPosition = signal<{ top?: string; bottom?: string; left?: string; right?: string }>({});
  emojiLibraryPosition = signal<{ top: string; left: string }>({ top: '0', left: '0' });
  private visibilityHandler: (() => void) | null = null;
  private newMessageSub: any = null;

  @HostBinding('style.flex') flex = '1';
  @HostBinding('style.overflow') overflow = 'hidden';
  @HostBinding('style.display') display = 'flex';
  @HostBinding('style.flex-direction') flexDirection = 'column';
  @HostBinding('style.min-height') minHeight = '0';

  @ViewChild('messagesList') messagesList!: ElementRef;
  @ViewChild('textInput') textInput!: ElementRef;

  messages$ = this.chatService.messages$;
  connected$ = this.chatService.connected$;
  onlineCount$ = this.chatService.onlineCount$;

  text = '';
  selectedInterval = signal<string | null>(null);
  showIntervals = signal(false);
  loading = signal(true);
  shouldScrollToBottom = true;
  showScrollBtn = signal(false);
  floatingDate = signal<string | null>(null);
  floatingDateVisible = signal(false);
  floatingDateTimeout: any = null;

  activeMenuId = signal<number | null>(null);
  activeEmojiId = signal<number | null>(null);

  editingMessageId = signal<number | null>(null);

  replyingTo = signal<ChatMessage | null>(null);

  reactionTooltip = signal<{ reactions: any[]; x: number; y: number } | null>(null);
  waitIntervals = WAIT_INTERVALS;
  quickEmojis = QUICK_EMOJIS;

  get currentUser() { return this.authService.currentUser; }

  async ngOnInit(): Promise<void> {
    if (!this.authService.currentUser) await this.authService.syncUser(false);
    try {
      await this.chatService.connect(ROOM);
      this.shouldScrollToBottom = true;
    } finally {
      this.loading.set(false);
    }

    this.visibilityHandler = async () => {
      if (document.visibilityState === 'visible') {
        const state = this.chatService.getConnectionState();
        if (state !== 'Connected') {
          await this.chatService.connect(ROOM);
          this.shouldScrollToBottom = true;
        }
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.newMessageSub = this.chatService.newMessage$.subscribe(() => {
      this.shouldScrollToBottom = true;
    });
  }

  ngOnDestroy(): void {
    this.chatService.disconnect();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.newMessageSub) {
      this.newMessageSub.unsubscribe();
    }
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

  scrollToBottomBtn(): void {
    this.shouldScrollToBottom = true;
    this.scrollToBottom();
    this.showScrollBtn.set(false);
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    this.showScrollBtn.set(distanceFromBottom > 200);

    const messageEls = el.querySelectorAll('[data-date]');
    let currentDate: string | null = null;
    for (const msgEl of Array.from(messageEls)) {
      const rect = msgEl.getBoundingClientRect();
      const parentRect = el.getBoundingClientRect();
      if (rect.top >= parentRect.top && rect.top <= parentRect.bottom) {
        currentDate = (msgEl as HTMLElement).dataset['date'] ?? null;
        break;
      }
    }
    if (currentDate) {
      const label = this.formatDateLabel(currentDate);
      this.floatingDate.set(label);
      this.floatingDateVisible.set(true);
    }
    clearTimeout(this.floatingDateTimeout);
    this.floatingDateTimeout = setTimeout(() => this.floatingDateVisible.set(false), 2000);

    this.activeMenuId.set(null);
    this.activeEmojiId.set(null);
  }


  closeMenus(): void {
    this.activeMenuId.set(null);
    this.activeEmojiId.set(null);
    this.reactionTooltip.set(null);
  }

  startEdit(msg: ChatMessage): void {
    this.editingMessageId.set(msg.id);
    this.text = msg.text ?? '';
    this.selectedInterval.set(msg.waitInterval);
    this.activeMenuId.set(null);
    setTimeout(() => this.textInput?.nativeElement?.focus(), 50);
  }

  cancelEdit(): void {
    this.editingMessageId.set(null);
    this.text = '';
    this.selectedInterval.set(null);
  }

  startReply(msg: ChatMessage): void {
    this.replyingTo.set(msg);
    this.activeMenuId.set(null);
    setTimeout(() => this.textInput?.nativeElement?.focus(), 50);
  }

  cancelReply(): void {
    this.replyingTo.set(null);
  }

  toggleEmoji(msgId: number, event: MouseEvent): void {
    event.stopPropagation();
    this.activeEmojiId.set(this.activeEmojiId() === msgId ? null : msgId);
    this.activeMenuId.set(null);
  }

  async deleteMessage(msgId: number): Promise<void> {
    if (!confirm('Ștergi acest mesaj?')) return;
    await this.chatService.deleteMessage(msgId);
    this.activeMenuId.set(null);
  }

  async toggleReaction(msgId: number, emoji: string): Promise<void> {
    await this.chatService.toggleReaction(msgId, emoji);
    this.activeEmojiId.set(null);
  }

  showReactionTooltip(msg: ChatMessage, event: MouseEvent): void {
    event.stopPropagation();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.reactionTooltip.set({
      reactions: msg.reactions,
      x: rect.left,
      y: rect.top - 10,
    });
  }

  hideReactionTooltip(): void {
    this.reactionTooltip.set(null);
  }

  hasMyReaction(msg: ChatMessage, emoji: string): boolean {
    const reaction = msg.reactions?.find(r => r.emoji === emoji);
    return reaction?.users.includes(this.currentUser?.fullName ?? '') ?? false;
  }

  selectInterval(interval: string): void {
    this.selectedInterval.set(interval);
    this.showIntervals.set(false);
  }

  clearInterval(): void { this.selectedInterval.set(null); }
  toggleIntervals(): void { this.showIntervals.update(v => !v); }

  async send(): Promise<void> {
    const text = this.text.trim();
    const interval = this.selectedInterval();
    if (!text && !interval) return;

    const editId = this.editingMessageId();
    if (editId) {
      await this.chatService.editMessage(editId, text);
      this.editingMessageId.set(null);
    } else {
      this.shouldScrollToBottom = true;
      await this.chatService.sendMessage(ROOM, text || null, interval, this.replyingTo()?.id ?? null);
      this.replyingTo.set(null);
    }

    this.text = '';
    this.selectedInterval.set(null);
    this.showIntervals.set(false);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
    if (event.key === 'Escape') {
      this.cancelEdit();
      this.cancelReply();
    }
  }

  isOwnMessage(msg: ChatMessage): boolean {
    return msg.userId === this.currentUser?.id;
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr.includes('Z') ? dateStr : dateStr + 'Z');
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  formatDateLabel(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr.includes('Z') ? dateStr : dateStr + 'Z');
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Astăzi';
    if (diffDays === 1) return 'Ieri';
    if (diffDays < 7) return date.toLocaleDateString('ro-RO', { weekday: 'long' });
    const sameYear = date.getFullYear() === now.getFullYear();
    if (sameYear) return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' });
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  isSameDay(date1: string, date2: string): boolean {
    const d1 = new Date(date1.includes('Z') ? date1 : date1 + 'Z');
    const d2 = new Date(date2.includes('Z') ? date2 : date2 + 'Z');
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  }

  closeEmojiLibrary(): void {
    this.showEmojiLibrary.set(false);
    this.libraryForMessageId.set(null);
  }

  async onEmojiSelect(emoji: any): Promise<void> {
    const msgId = this.libraryForMessageId();
    if (!msgId) return;
    await this.chatService.toggleReaction(msgId, emoji.native);
    this.closeEmojiLibrary();
    this.activeEmojiId.set(null);
  }

  toggleMenu(msgId: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeMenuId() === msgId) { this.activeMenuId.set(null); return; }

    const btn = event.currentTarget as HTMLElement;
    const btnRect = btn.getBoundingClientRect();
    const bubble = btn.closest('.message-bubble') as HTMLElement;
    const isOwn = bubble.classList.contains('message-bubble--own');
    const menuHeight = 190;
    const menuWidth = 185;

    let top = isOwn ? btnRect.top - menuHeight - 1 : btnRect.top - menuHeight + 37;
    top = Math.max(4, top);

    let left = isOwn
      ? btnRect.left - menuWidth - 60
      : btnRect.left - menuWidth + 150;
    left = Math.max(4, Math.min(left, window.innerWidth - menuWidth - 4));

    this.menuPosition.set({ top: top + 'px', left: left + 'px' });
    this.activeMenuId.set(msgId);
    this.activeEmojiId.set(null);
  }

  openEmojiLibrary(msgId: number, event: MouseEvent): void {
    event.stopPropagation();
    this.activeMenuId.set(null);
    this.libraryForMessageId.set(msgId);

    const msgWrapper = document.querySelector(`[data-msg-id="${msgId}"]`) as HTMLElement;
    const pickerHeight = 450;
    const pickerWidth = 352;

    let top = 100;
    let left = 50;

    if (msgWrapper) {
      const bubble = msgWrapper.querySelector('.message-bubble') as HTMLElement;
      const bubbleRect = bubble.getBoundingClientRect();
      const spaceBelow = window.innerHeight - bubbleRect.bottom;
      const isOwn = msgWrapper.classList.contains('message-wrapper--own');

      if (spaceBelow >= pickerHeight) {
        top = bubbleRect.bottom + 4;
      } else {
        top = bubbleRect.top - pickerHeight + 12;
      }
      top = Math.max(4, Math.min(top, window.innerHeight - pickerHeight - 4));

      if (isOwn) {
        left = bubbleRect.left - pickerWidth - 4;
        if (left < 4) {
          left = bubbleRect.right + 4;
        }
      } else {
        left = bubbleRect.right + 4;
        if (left + pickerWidth > window.innerWidth - 4) {
          left = bubbleRect.left - pickerWidth - 4;
        }
      }

      left = Math.max(4, left);
    }

    console.log('Emoji library position:', { top, left, msgId });
    this.emojiLibraryPosition.set({ top: top + 'px', left: left + 'px' });
    this.showEmojiLibrary.set(true);
    this.activeEmojiId.set(null);
  }

  getActiveMsg(): ChatMessage | null {
    const msgs = this.chatService['messagesSubject'].value;
    return msgs.find(m => m.id === this.activeMenuId()) ?? null;
  }

  searchOpen = signal(false);
  searchQuery = signal('');
  searchResults = signal<number[]>([]); // array de msg id-uri
  searchIndex = signal(0);

  toggleSearch(): void {
    this.searchOpen.set(!this.searchOpen());
    if (!this.searchOpen()) {
      this.searchQuery.set('');
      this.searchResults.set([]);
      this.searchIndex.set(0);
    }
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    if (!query.trim()) {
      this.searchResults.set([]);
      this.searchIndex.set(0);
      return;
    }

    const msgs = this.chatService['messagesSubject'].value;
    const results = msgs
      .filter(m => m.text?.toLowerCase().includes(query.toLowerCase()))
      .map(m => m.id);

    this.searchResults.set(results);
    this.searchIndex.set(results.length > 0 ? 0 : -1);

    if (results.length > 0) {
      this.scrollToMessage(results[0]);
    }
  }

  searchNext(): void {
    const results = this.searchResults();
    if (!results.length) return;
    const next = (this.searchIndex() + 1) % results.length;
    this.searchIndex.set(next);
    this.scrollToMessage(results[next]);
  }

  searchPrev(): void {
    const results = this.searchResults();
    if (!results.length) return;
    const prev = (this.searchIndex() - 1 + results.length) % results.length;
    this.searchIndex.set(prev);
    this.scrollToMessage(results[prev]);
  }

  private scrollToMessage(msgId: number): void {
    setTimeout(() => {
      const el = document.querySelector(`[data-msg-id="${msgId}"]`) as HTMLElement;
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 50);
  }

  isSearchMatch(msgId: number): boolean {
    return this.searchResults().includes(msgId);
  }

  isCurrentSearchResult(msgId: number): boolean {
    return this.searchResults()[this.searchIndex()] === msgId;
  }

  private http = inject(HttpClient);
  reportedMessageIds = signal<Set<number>>(new Set());

  toastMessage = signal<string | null>(null);
  private toastTimeout: any = null;

  showToast(message: string): void {
    clearTimeout(this.toastTimeout);
    this.toastMessage.set(message);
    this.toastTimeout = setTimeout(() => this.toastMessage.set(null), 3000);
  }

  async reportMessage(msgId: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/MessageReport/${msgId}`, {})
      );
      this.reportedMessageIds.update(set => new Set([...set, msgId]));
      this.activeMenuId.set(null);
      this.showToast('🚩 Mesaj raportat cu succes!');
    } catch {
      this.showToast('⚠️ Ai raportat deja acest mesaj.');
    }
  }


}
