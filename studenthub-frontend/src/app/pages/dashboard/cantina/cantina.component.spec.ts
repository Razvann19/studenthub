import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CantinaComponent } from './cantina.component';

describe('CantinaComponent', () => {
  let component: CantinaComponent;
  let fixture: ComponentFixture<CantinaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CantinaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CantinaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
