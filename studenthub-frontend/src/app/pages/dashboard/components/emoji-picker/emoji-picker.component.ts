import {
  Component,
  EventEmitter,
  Output,
  OnInit,
  ElementRef,
  ViewChild,
  NgZone,
  CUSTOM_ELEMENTS_SCHEMA
} from '@angular/core';

@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  template: `<div #container></div>`,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class EmojiPickerComponent implements OnInit {
  @Output() emojiSelect = new EventEmitter<any>();
  @ViewChild('container', { static: true }) container!: ElementRef;

  constructor(private zone: NgZone) {}

  async ngOnInit(): Promise<void> {
    try {
      const [{ Picker }, data] = await Promise.all([
        import('emoji-mart'),
        import('@emoji-mart/data'),
      ]);

      const picker = new Picker({
        data: data.default,
        onEmojiSelect: (emoji: any) => {
          this.zone.run(() => this.emojiSelect.emit(emoji));
        },
        theme: 'light',
        previewPosition: 'none',
        skinTonePosition: 'none',
      });

      console.log('Picker created:', picker);
      this.container.nativeElement.appendChild(picker);
      console.log('Picker appended to:', this.container.nativeElement);
    } catch (err) {
      console.error('Emoji picker error:', err);
    }
  }
}
