import {
  Component, inject, OnInit, OnDestroy,
  signal, ViewChild, ElementRef, AfterViewChecked,
  HostBinding
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { CoursesService } from '../../../services/courses.service';
import { CourseHubService, CourseNote } from '../../../services/course-hub.service';
import { environment } from '../../../../environments/environment';
import {EmojiPickerComponent} from '../components/emoji-picker/emoji-picker.component';
import {LastSeenService} from '../../../services/last-seen.service';


@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [FormsModule, AsyncPipe, EmojiPickerComponent],
  templateUrl: './course-detail.component.html',
  styleUrl: './course-detail.component.scss',
})
export class CourseDetailComponent implements OnInit, OnDestroy, AfterViewChecked {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private coursesService = inject(CoursesService);
  private http = inject(HttpClient);
  public hubService = inject(CourseHubService);
  private lastSeenService = inject(LastSeenService);
  private hasMarkedSeen = false;
  private isAutoScrolling = false;
  private visibilityHandler: (() => void) | null = null;

  @HostBinding('style.flex') flex = '1';
  @HostBinding('style.display') display = 'flex';
  @HostBinding('style.flex-direction') flexDirection = 'column';
  @HostBinding('style.min-height') minHeight = '0';

  @ViewChild('messagesList') messagesList!: ElementRef;
  @ViewChild('notesList') notesList!: ElementRef;
  @ViewChild('textInput') textInput!: ElementRef;

  courseId = signal<number>(0);
  courseName = signal<string>('');
  activeTab = signal<'chat' | 'notes'>('chat');
  loading = signal(true);
  shouldScrollToBottom = true;

  messages$ = this.hubService.messages$;
  notes$ = this.hubService.notes$;
  connected$ = this.hubService.connected$;

  chatText = '';
  replyingTo = signal<any>(null);
  editingMessageId = signal<number | null>(null);
  activeMenuId = signal<number | null>(null);
  activeEmojiId = signal<number | null>(null);
  menuPosition = signal<{ top: string; left: string }>({ top: '0', left: '0' });
  showScrollBtn = signal(false);

  selectedChatFile = signal<File | null>(null);
  selectedChatFilePreview = signal<string | null>(null);
  uploadingChatFile = signal(false);

  noteText = '';
  editingNoteId = signal<number | null>(null);

  selectedNoteFile = signal<File | null>(null);
  selectedNoteFilePreview = signal<string | null>(null);
  uploadingNoteFile = signal(false);

  readonly quickEmojis = ['👍', '❤️', '😂', '😮', '👎'];

  get currentUser() { return this.authService.currentUser; }

  private scrollDone = false;
  lastSeenAt = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.courseId.set(id);

    const nav = window.history.state;
    this.courseName.set(nav?.name ?? `Curs ${id}`);

    if (!this.authService.currentUser) {
      await this.authService.syncUser(false);
    }

    try {
      await this.hubService.connect(id);
      this.shouldScrollToBottom = true;
    } finally {
      this.loading.set(false);
    }

    await this.lastSeenService.updateLastSeen(`course-${id}`);

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
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom && this.activeTab() === 'chat') {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.hubService.disconnect();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesList?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  setTab(tab: 'chat' | 'notes'): void {
    this.activeTab.set(tab);
    if (tab === 'chat') this.shouldScrollToBottom = true;
  }

  goBack(): void { this.router.navigate(['/dashboard/courses']); }

  getAttachmentUrl(url: string): string {
    return `${environment.apiUrl.replace('/api', '')}${url}`;
  }

  openAttachment(url: string): void {
    window.open(this.getAttachmentUrl(url), '_blank');
  }

  getFileIcon(type: string | null): string {
    switch (type) {
      case 'pdf': return '📄';
      case 'doc': case 'docx': return '📝';
      case 'xls': case 'xlsx': return '📊';
      case 'ppt': case 'pptx': return '📑';
      case 'txt': return '📃';
      default: return '📎';
    }
  }

  private async uploadFile(file: File): Promise<{ url: string; name: string; type: string; extractedText?: string | null } | null> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; data: { url: string; originalName: string; type: string; extractedText?: string | null }; message?: string }>(
          `${environment.apiUrl}/NoteAttachment/upload`, formData
        )
      );
      if (response.success) {
        return { url: response.data.url, name: response.data.originalName, type: response.data.type, extractedText: response.data.extractedText };
      } else {
        this.showToast(`⚠️ ${response.message ?? 'Eroare la încărcare.'}`);
      }
    } catch (err: any) {
      const msg = err?.error?.message;
      if (msg) {
        this.showToast(`⚠️ ${msg}`);
      } else {
        this.showToast('⚠️ Eroare la încărcarea fișierului.');
      }
    }
    return null;
  }

  clearChatAttachment(): void {
    this.selectedChatFile.set(null);
    this.selectedChatFilePreview.set(null);
  }

  async onNoteFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowed.includes(ext)) {
      this.showToast(`⚠️ Formatul „${ext}" nu este permis. Formate acceptate: PDF, Word, Excel, PowerPoint, imagini, TXT.`);
      input.value = '';
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      this.showToast('⚠️ Fișierul depășește limita de 20 MB.');
      input.value = '';
      return;
    }

    this.selectedNoteFile.set(file);
    this.selectedNoteFilePreview.set(file.name);
    input.value = '';
  }

  async onChatFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowed.includes(ext)) {
      this.showToast(`⚠️ Formatul „${ext}" nu este permis. Formate acceptate: PDF, Word, Excel, PowerPoint, imagini, TXT.`);
      input.value = '';
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      this.showToast('⚠️ Fișierul depășește limita de 20 MB.');
      input.value = '';
      return;
    }

    this.selectedChatFile.set(file);
    this.selectedChatFilePreview.set(file.name);
    input.value = '';
  }

  clearNoteAttachment(): void {
    this.selectedNoteFile.set(null);
    this.selectedNoteFilePreview.set(null);
  }

  async sendMessage(): Promise<void> {
    const text = this.chatText.trim();
    const file = this.selectedChatFile();
    if (!text && !file) return;

    const user = this.currentUser;
    if (!user) return;

    const editId = this.editingMessageId();

    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;
    let attachmentType: string | null = null;

    if (file && !editId) {
      this.uploadingChatFile.set(true);
      const result = await this.uploadFile(file);
      this.uploadingChatFile.set(false);
      if (!result) return;
      attachmentUrl = result.url;
      attachmentName = result.name;
      attachmentType = result.type;
    }

    if (editId) {
      await this.hubService.editMessage(editId, text, user.id);
      this.editingMessageId.set(null);
    } else {
      this.shouldScrollToBottom = true;
      await this.hubService.sendMessage(
        this.courseId(), text || null, user.id, user.fullName,
        this.replyingTo()?.id ?? null,
        attachmentUrl, attachmentName, attachmentType
      );
      this.replyingTo.set(null);
    }

    this.chatText = '';
    this.selectedChatFile.set(null);
    this.selectedChatFilePreview.set(null);
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
    await this.hubService.toggleMessageReaction(msgId, emoji, this.currentUser!.id);
    this.activeEmojiId.set(null);
  }

  isOwnMessage(msg: any): boolean { return msg.userId === this.currentUser?.id; }

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
  }

  getDownloadUrl(url: string | null, name: string | null): string {
    if (!url || !name) return '#';
    const base = environment.apiUrl;
    return `${base}/NoteAttachment/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
  }

  get profilePhotoUrl(): string | null {
    const user = this.authService.currentUser;
    if (!user?.profilePhotoUrl) return null;
    const base = environment.apiUrl.replace('/api', '');
    return `${base}/uploads/${user.profilePhotoUrl}`;
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr.includes('Z') ? dateStr : dateStr + 'Z');
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }

  hasMyReaction(item: any, emoji: string): boolean {
    const reaction = item.reactions?.find((r: any) => r.emoji === emoji);
    return reaction?.users.includes(this.currentUser?.fullName ?? '') ?? false;
  }

  closeMenus(): void {
    this.activeMenuId.set(null);
    this.activeEmojiId.set(null);
    this.activeNoteMenuId.set(null);
    this.activeNoteEmojiId.set(null);
    this.showEmojiLibrary.set(false);
    this.showEmojiLibraryNote.set(false);
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

  toggleEmoji(msgId: number, event: MouseEvent): void {
    event.stopPropagation();
    this.activeEmojiId.set(this.activeEmojiId() === msgId ? null : msgId);
    this.activeMenuId.set(null);
  }

  getActiveMsg(): any {
    return this.hubService['messagesSubject'].value.find((m: any) => m.id === this.activeMenuId()) ?? null;
  }

  async addNote(): Promise<void> {
    const text = this.noteText.trim();
    const file = this.selectedNoteFile();
    if (!text && !file) return;

    const user = this.currentUser;
    if (!user) return;

    const editId = this.editingNoteId();

    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;
    let attachmentType: string | null = null;
    let extractedText: string | null = null;

    if (file && !editId) {
      this.uploadingNoteFile.set(true);
      const result = await this.uploadFile(file);
      this.uploadingNoteFile.set(false);
      if (!result) return;
      attachmentUrl = result.url;
      attachmentName = result.name;
      attachmentType = result.type;
      extractedText = result.extractedText ?? null;
    }

    if (editId) {
      await this.hubService.editNote(editId, text, user.id);
      this.editingNoteId.set(null);
    } else {
      await this.hubService.addNote(
        this.courseId(), text || null, user.id, user.fullName,
        attachmentUrl, attachmentName, attachmentType, extractedText
      );
    }

    this.noteText = '';
    this.selectedNoteFile.set(null);
    this.selectedNoteFilePreview.set(null);
    this.replyingToNote.set(null);
  }

  onNoteKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.addNote(); }
    if (event.key === 'Escape') { this.editingNoteId.set(null); this.noteText = ''; }
  }

  startEditNote(note: CourseNote): void {
    this.editingNoteId.set(note.id);
    this.noteText = note.text ?? '';
  }

  async deleteNote(noteId: number): Promise<void> {
    if (!confirm('Ștergi notița?')) return;
    await this.hubService.deleteNote(noteId, this.currentUser!.id);
  }

  async toggleNoteReaction(noteId: number, emoji: string): Promise<void> {
    await this.hubService.toggleNoteReaction(noteId, emoji, this.currentUser!.id);
  }

  isOwnNote(note: CourseNote): boolean { return note.userId === this.currentUser?.id; }

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
    const sameYear = date.getFullYear() === now.getFullYear();
    if (sameYear) return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' });
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  floatingDate = signal<string | null>(null);
  floatingDateVisible = signal(false);
  floatingDateTimeout: any = null;

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    if (distanceFromBottom < 50 && this.hasMarkedSeen && !this.isAutoScrolling) {
      this.lastSeenService.updateLastSeen(`course-${this.courseId()}`);
      this.lastSeenAt.set(new Date().toISOString());
    }

    this.showScrollBtn.set(distanceFromBottom > 200);
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

  floatingNoteDate = signal<string | null>(null);
  floatingNoteDateVisible = signal(false);
  floatingNoteDateTimeout: any = null;

  onNotesScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    if (distanceFromBottom < 50 && this.hasMarkedSeen && !this.isAutoScrolling) {
      this.lastSeenService.updateLastSeen(`course-${this.courseId()}`);
      this.lastSeenAt.set(new Date().toISOString());
    }

    const noteEls = el.querySelectorAll('[data-date]');
    let currentDate: string | null = null;
    for (const noteEl of Array.from(noteEls)) {
      const rect = noteEl.getBoundingClientRect();
      const parentRect = el.getBoundingClientRect();
      if (rect.top >= parentRect.top && rect.top <= parentRect.bottom) {
        currentDate = (noteEl as HTMLElement).dataset['date'] ?? null;
        break;
      }
    }
    if (currentDate) {
      this.floatingNoteDate.set(this.formatDateLabel(currentDate));
      this.floatingNoteDateVisible.set(true);
    }
    clearTimeout(this.floatingNoteDateTimeout);
    this.floatingNoteDateTimeout = setTimeout(() => this.floatingNoteDateVisible.set(false), 2000);
  }

  activeNoteMenuId = signal<number | null>(null);
  activeNoteEmojiId = signal<number | null>(null);
  noteMenuPosition = signal<{ top: string; left: string }>({ top: '0', left: '0' });

  toggleNoteMenu(noteId: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeNoteMenuId() === noteId) { this.activeNoteMenuId.set(null); return; }

    const btn = event.currentTarget as HTMLElement;
    const btnRect = btn.getBoundingClientRect();
    const bubble = btn.closest('.note-bubble') as HTMLElement;
    const isOwn = bubble.classList.contains('note-bubble--own');
    const menuHeight = 190;
    const menuWidth = 185;

    let top = isOwn ? btnRect.top - menuHeight - 1 : btnRect.top - menuHeight + 37;
    top = Math.max(4, top);

    let left = isOwn
      ? btnRect.left - menuWidth - 60
      : btnRect.left - menuWidth + 150;
    left = Math.max(4, Math.min(left, window.innerWidth - menuWidth - 4));

    this.noteMenuPosition.set({ top: top + 'px', left: left + 'px' });
    this.activeNoteMenuId.set(noteId);
    this.activeNoteEmojiId.set(null);
  }

  toggleNoteEmoji(noteId: number, event: MouseEvent): void {
    event.stopPropagation();
    this.activeNoteEmojiId.set(this.activeNoteEmojiId() === noteId ? null : noteId);
    this.activeNoteMenuId.set(null);
  }

  replyingToNote = signal<any>(null);

  startReplyNote(note: any): void {
    this.replyingToNote.set(note);
    this.activeNoteMenuId.set(null);
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
    await this.hubService.toggleMessageReaction(msgId, emoji.native, this.currentUser!.id);
    this.closeEmojiLibrary();
    this.activeEmojiId.set(null);
  }

  showEmojiLibraryNote = signal(false);
  libraryForNoteId = signal<number | null>(null);
  emojiLibraryNotePosition = signal<{ top: string; left: string }>({ top: '0', left: '0' });

  openEmojiLibraryNote(noteId: number, event: MouseEvent): void {
    event.stopPropagation();
    this.activeNoteMenuId.set(null);
    this.activeNoteEmojiId.set(null);
    this.libraryForNoteId.set(noteId);

    const noteWrapper = document.querySelector(`[data-note-id="${noteId}"]`) as HTMLElement;
    const pickerHeight = 450;
    const pickerWidth = 352;
    let top = 100;
    let left = 50;

    if (noteWrapper) {
      const bubble = noteWrapper.querySelector('.message-bubble') as HTMLElement;
      const rect = (bubble ?? noteWrapper).getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const isOwn = noteWrapper.classList.contains('message-wrapper--own');

      top = spaceBelow >= pickerHeight ? rect.bottom + 4 : rect.top - pickerHeight + 12;
      top = Math.max(4, Math.min(top, window.innerHeight - pickerHeight - 4));

      if (isOwn) {
        left = rect.left - pickerWidth - 4;
        if (left < 4) left = rect.right + 4;
      } else {
        left = rect.right + 4;
        if (left + pickerWidth > window.innerWidth - 4) left = rect.left - pickerWidth - 4;
      }
      left = Math.max(4, left);
    }

    this.emojiLibraryNotePosition.set({ top: top + 'px', left: left + 'px' });
    this.showEmojiLibraryNote.set(true);
  }

  closeEmojiLibraryNote(): void {
    this.showEmojiLibraryNote.set(false);
    this.libraryForNoteId.set(null);
  }

  async onEmojiSelectNote(emoji: any): Promise<void> {
    const noteId = this.libraryForNoteId();
    if (!noteId) return;
    await this.hubService.toggleNoteReaction(noteId, emoji.native, this.currentUser!.id);
    this.closeEmojiLibraryNote();
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
    const notes = this.hubService['notesSubject'].value;

    const msgResults = msgs
      .filter(m => m.text?.toLowerCase().includes(query.toLowerCase()))
      .map(m => ({ id: m.id, type: 'msg' as const, createdAt: m.createdAt }));

    const noteResults = notes
      .filter(n => n.text?.toLowerCase().includes(query.toLowerCase()))
      .map(n => ({ id: n.id, type: 'note' as const, createdAt: n.createdAt }));

    const combined = [...msgResults, ...noteResults]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    this.searchResultsFull.set(combined);
    this.searchResults.set(combined.map(r => r.id));
    this.searchIndex.set(combined.length > 0 ? 0 : -1);

    if (combined.length > 0) {
      this.scrollToSearchResult(combined[0]);
    }
  }

  searchResultsFull = signal<{ id: number; type: 'msg' | 'note' }[]>([]);

  searchNext(): void {
    const results = this.searchResultsFull();
    if (!results.length) return;
    const next = (this.searchIndex() + 1) % results.length;
    this.searchIndex.set(next);
    this.scrollToSearchResult(results[next]);
  }

  searchPrev(): void {
    const results = this.searchResultsFull();
    if (!results.length) return;
    const prev = (this.searchIndex() - 1 + results.length) % results.length;
    this.searchIndex.set(prev);
    this.scrollToSearchResult(results[prev]);
  }

  private scrollToSearchResult(result: { id: number; type: 'msg' | 'note' }): void {
    setTimeout(() => {
      const selector = result.type === 'msg'
        ? `[data-msg-id="${result.id}"]`
        : `[data-note-id="${result.id}"]`;
      const el = document.querySelector(selector) as HTMLElement;
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 50);
  }

  isSearchMatch(id: number): boolean {
    return this.searchResults().includes(id);
  }

  isCurrentSearchResult(id: number): boolean {
    const results = this.searchResultsFull();
    return results[this.searchIndex()]?.id === id;
  }

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
