import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MySessionsComponent } from './my-sessions.component';

describe('MySessionsComponent', () => {
  let component: MySessionsComponent;
  let fixture: ComponentFixture<MySessionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ MySessionsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MySessionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
