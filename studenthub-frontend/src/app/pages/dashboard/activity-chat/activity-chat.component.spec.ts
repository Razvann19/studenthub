import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActivityChatComponent } from './activity-chat.component';

describe('ActivityChatComponent', () => {
  let component: ActivityChatComponent;
  let fixture: ComponentFixture<ActivityChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivityChatComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActivityChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
