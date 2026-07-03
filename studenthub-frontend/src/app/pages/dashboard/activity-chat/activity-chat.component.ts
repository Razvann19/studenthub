import {
  Component, inject, OnInit, OnDestroy,
  signal, ViewChild, ElementRef, AfterViewChecked,
  HostBinding
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { ActivityHubService, Poll, PollOption } from '../../../services/activity-hub.service';
import {environment} from '../../../../environments/environment';
import {EmojiPickerComponent} from '../components/emoji-picker/emoji-picker.component';
import {LastSeenService} from '../../../services/last-seen.service';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';

@Component({
  selector: 'app-activity-chat',
  standalone: true,
  imports: [FormsModule, AsyncPipe, EmojiPickerComponent],
  templateUrl: './activity-chat.component.html',
  styleUrl: './activity-chat.component.scss',
})
export class ActivityChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  public hubService = inject(ActivityHubService);
  private lastSeenService = inject(LastSeenService);
  private visibilityHandler: (() => void) | null = null;
  private newMessageSub: any = null;


  @HostBinding('style.flex') flex = '1';
  @HostBinding('style.overflow') overflow = 'hidden';
  @HostBinding('style.display') display = 'flex';
  @HostBinding('style.flex-direction') flexDirection = 'column';
  @HostBinding('style.min-height') minHeight = '0';

  @ViewChild('messagesList') messagesList!: ElementRef;
  @ViewChild('textInput') textInput!: ElementRef;

  activityId = signal<number>(0);
  activityName = signal<string>('');
  loading = signal(true);
  shouldScrollToBottom = true;
  showScrollBtn = signal(false);

  messages$ = this.hubService.messages$;
  polls$ = this.hubService.polls$;
  connected$ = this.hubService.connected$;

  chatText = '';
  replyingTo = signal<any>(null);
  editingMessageId = signal<number | null>(null);
  activeMenuId = signal<number | null>(null);
  activeEmojiId = signal<number | null>(null);
  menuPosition = signal<{ top: string; left: string }>({ top: '0', left: '0' });

  floatingDate = signal<string | null>(null);
  floatingDateVisible = signal(false);
  floatingDateTimeout: any = null;

  showPollForm = signal(false);
  pollQuestion = '';
  pollOptions: { value: string }[] = [{ value: '' }, { value: '' }];
  pollAllowUserOptions = false;

  expandedVoters = signal<number | null>(null); // optionId
  editingPollId = signal<number | null>(null);
  editingPollQuestion = '';
  editingOptionId = signal<number | null>(null);
  editingOptionText = '';
  addingOptionToPollId = signal<number | null>(null);
  newOptionText = '';

  readonly quickEmojis = ['👍', '❤️', '😂', '😮', '👎'];

  get currentUser() { return this.authService.currentUser; }

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.activityId.set(id);

    const nav = window.history.state;
    this.activityName.set(nav?.name ?? `Activitate ${id}`);

    if (!this.authService.currentUser) {
      await this.authService.syncUser(false);
    }

    try {
      await this.hubService.connect(id);
      this.shouldScrollToBottom = true;
    } finally {
      this.loading.set(false);
    }

    await this.lastSeenService.updateLastSeen(`activity-${id}`);

    this.visibilityHandler = async () => {
      if (document.visibilityState === 'visible') {
        const state = this.hubService.getConnectionState();
        if (state !== 'Connected') {
          await this.hubService.connect(id);
          this.shouldScrollToBottom = true;
        }
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.newMessageSub = this.hubService.newMessage$.subscribe(() => {
      this.shouldScrollToBottom = true;
    });
  }

  ngOnDestroy(): void {
    this.hubService.disconnect();
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

  goBack(): void { this.router.navigate(['/dashboard/activities']); }

  async sendMessage(): Promise<void> {
    const text = this.chatText.trim();
    if (!text) return;

    const user = this.currentUser;
    if (!user) return;

    const editId = this.editingMessageId();
    if (editId) {
      await this.hubService.editMessage(editId, text, user.id);
      this.editingMessageId.set(null);
    } else {
      this.shouldScrollToBottom = true;
      await this.hubService.sendMessage(
        this.activityId(), text, user.id, user.fullName,
        this.replyingTo()?.id ?? null
      );
      this.replyingTo.set(null);
    }
    this.chatText = '';
  }

  onChatKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendMessage(); }
    if (event.key === 'Escape') { this.editingMessageId.set(null); this.replyingTo.set(null); }
  }

  async deleteMessage(msgId: number): Promise<void> {
    if (!confirm('Ștergi mesajul?')) return;
    await this.hubService.deleteMessage(msgId, this.currentUser!.id);
    this.activeMenuId.set(null);
  }

  startEditMessage(msg: any): void {
    this.editingMessageId.set(msg.id);
    this.chatText = msg.text ?? '';
    this.activeMenuId.set(null);
    setTimeout(() => this.textInput?.nativeElement?.focus(), 50);
  }

  startReply(msg: any): void {
    this.replyingTo.set(msg);
    this.activeMenuId.set(null);
    setTimeout(() => this.textInput?.nativeElement?.focus(), 50);
  }

  async toggleMessageReaction(msgId: number, emoji: string): Promise<void> {
    const user = this.currentUser;
    if (!user) return;
    await this.hubService.toggleMessageReaction(msgId, emoji, user.id, user.fullName);
    this.activeEmojiId.set(null);
  }

  isOwnMessage(msg: any): boolean { return msg.userId === this.currentUser?.id; }

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr.includes('Z') ? dateStr : dateStr + 'Z');
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }

  isSameDay(date1: string, date2: string): boolean {
    const d1 = new Date(date1.includes('Z') ? date1 : date1 + 'Z');
    const d2 = new Date(date2.includes('Z') ? date2 : date2 + 'Z');
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
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
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' });
  }

  hasMyReaction(msg: any, emoji: string): boolean {
    const reaction = msg.reactions?.find((r: any) => r.emoji === emoji);
    return reaction?.users.includes(this.currentUser?.fullName ?? '') ?? false;
  }

  closeMenus(): void { this.activeMenuId.set(null); this.activeEmojiId.set(null); }

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

  toggleEmoji(msgId: number, event: MouseEvent): void {
    event.stopPropagation();
    this.activeEmojiId.set(this.activeEmojiId() === msgId ? null : msgId);
    this.activeMenuId.set(null);
  }

  getActiveMsg(): any {
    return this.hubService['messagesSubject'].value.find((m: any) => m.id === this.activeMenuId()) ?? null;
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.showScrollBtn.set(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
    this.activeMenuId.set(null);
    this.activeEmojiId.set(null);

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
      this.floatingDate.set(this.formatDateLabel(currentDate));
      this.floatingDateVisible.set(true);
    }
    clearTimeout(this.floatingDateTimeout);
    this.floatingDateTimeout = setTimeout(() => this.floatingDateVisible.set(false), 2000);
  }

  togglePollForm(): void {
    this.showPollForm.set(!this.showPollForm());
    if (!this.showPollForm()) this.resetPollForm();
  }

  resetPollForm(): void {
    this.pollQuestion = '';
    this.pollOptions = [{ value: '' }, { value: '' }];
    this.pollAllowUserOptions = false;
  }

  addPollOption(): void {
    if (this.pollOptions.length < 10) this.pollOptions.push({ value: '' });
  }

  removePollOption(index: number): void {
    if (this.pollOptions.length > 2) this.pollOptions.splice(index, 1);
  }

  isSubmitPollDisabled(): boolean {
    return !this.pollQuestion.trim() ||
      this.pollOptions.filter(o => o.value.trim().length > 0).length < 2;
  }

  async submitPoll(): Promise<void> {
    const question = this.pollQuestion.trim();
    const options = this.pollOptions.map(o => o.value.trim()).filter(o => o.length > 0);
    if (!question || options.length < 2) return;

    const user = this.currentUser;
    if (!user) return;

    await this.hubService.createPoll(
      this.activityId(), question, this.pollAllowUserOptions,
      options, user.id, user.fullName
    );

    this.showPollForm.set(false);
    this.resetPollForm();
    this.shouldScrollToBottom = true;
  }

  async vote(pollId: number, optionId: number): Promise<void> {
    const user = this.currentUser;
    if (!user) return;
    await this.hubService.vote(pollId, optionId, user.id, user.fullName);
  }

  getMyVote(poll: Poll): number | null {
    const user = this.currentUser;
    if (!user) return null;
    for (const option of poll.options) {
      if (option.votes.some(v => v.userId === user.id)) return option.id;
    }
    return null;
  }

  getTotalVotes(poll: Poll): number {
    return poll.options.reduce((sum, o) => sum + o.votes.length, 0);
  }

  getVotePercent(option: PollOption, poll: Poll): number {
    const total = this.getTotalVotes(poll);
    if (total === 0) return 0;
    return Math.round((option.votes.length / total) * 100);
  }

  toggleVoters(optionId: number): void {
    this.expandedVoters.set(this.expandedVoters() === optionId ? null : optionId);
  }

  isOwnPoll(poll: Poll): boolean { return poll.userId === this.currentUser?.id; }

  startEditPoll(poll: Poll): void {
    this.editingPollId.set(poll.id);
    this.editingPollQuestion = poll.question;
  }

  async submitEditPoll(): Promise<void> {
    const pollId = this.editingPollId();
    if (!pollId || !this.editingPollQuestion.trim()) return;
    await this.hubService.editPoll(pollId, this.editingPollQuestion, this.currentUser!.id);
    this.editingPollId.set(null);
  }

  async deletePoll(pollId: number): Promise<void> {
    if (!confirm('Ștergi sondajul?')) return;
    await this.hubService.deletePoll(pollId, this.currentUser!.id);
  }

  startEditOption(option: PollOption): void {
    this.editingOptionId.set(option.id);
    this.editingOptionText = option.text;
  }

  async submitEditOption(): Promise<void> {
    const optionId = this.editingOptionId();
    if (!optionId || !this.editingOptionText.trim()) return;
    await this.hubService.editPollOption(optionId, this.editingOptionText, this.currentUser!.id);
    this.editingOptionId.set(null);
  }

  startAddOption(pollId: number): void {
    this.addingOptionToPollId.set(pollId);
    this.newOptionText = '';
  }

  async submitAddOption(pollId: number): Promise<void> {
    if (!this.newOptionText.trim()) return;
    const user = this.currentUser;
    if (!user) return;
    await this.hubService.addPollOption(pollId, this.newOptionText, user.id, user.fullName);
    this.addingOptionToPollId.set(null);
    this.newOptionText = '';
  }

  canEditOption(option: PollOption, poll: Poll): boolean {
    const userId = this.currentUser?.id;
    return option.addedByUserId === userId || poll.userId === userId;
  }

  getCombinedItems(msgs: any[], polls: any[]): any[] {
    const messages = (msgs ?? []).map(m => ({ ...m, _type: 'message' }));
    const pollItems = (polls ?? []).map(p => ({ ...p, _type: 'poll' }));
    return [...messages, ...pollItems].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }
  get profilePhotoUrl(): string | null {
    const photo = this.authService.currentUser?.profilePhotoUrl;
    if (!photo) return null;
    const base = environment.apiUrl.replace('/api', '');
    return `${base}/uploads/${photo}`;
  }

  showEmojiLibrary = signal(false);
  libraryForMessageId = signal<number | null>(null);
  emojiLibraryPosition = signal<{ top: string; left: string }>({ top: '0', left: '0' });

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

      top = spaceBelow >= pickerHeight ? bubbleRect.bottom + 4 : bubbleRect.top - pickerHeight + 12;
      top = Math.max(4, Math.min(top, window.innerHeight - pickerHeight - 4));

      if (isOwn) {
        left = bubbleRect.left - pickerWidth - 4;
        if (left < 4) left = bubbleRect.right + 4;
      } else {
        left = bubbleRect.right + 4;
        if (left + pickerWidth > window.innerWidth - 4) left = bubbleRect.left - pickerWidth - 4;
      }
      left = Math.max(4, left);
    }

    this.emojiLibraryPosition.set({ top: top + 'px', left: left + 'px' });
    this.showEmojiLibrary.set(true);
    this.activeEmojiId.set(null);
  }

  closeEmojiLibrary(): void {
    this.showEmojiLibrary.set(false);
    this.libraryForMessageId.set(null);
  }

  async onEmojiSelect(emoji: any): Promise<void> {
    const msgId = this.libraryForMessageId();
    if (!msgId) return;
    await this.hubService.toggleMessageReaction(msgId, emoji.native, this.currentUser!.id, this.currentUser!.fullName);
    this.closeEmojiLibrary();
    this.activeEmojiId.set(null);
  }

  searchOpen = signal(false);
  searchQuery = signal('');
  searchResults = signal<number[]>([]);
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

    const msgs = this.hubService['messagesSubject'].value;
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
