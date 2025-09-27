import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCloneSubnavComponent } from './admin-clone-subnav.component';

describe('AdminCloneSubnavComponent', () => {
  let component: AdminCloneSubnavComponent;
  let fixture: ComponentFixture<AdminCloneSubnavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AdminCloneSubnavComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminCloneSubnavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
