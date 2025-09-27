import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CurvedBorderComponent } from './curved-border.component';

describe('CurvedBorderComponent', () => {
  let component: CurvedBorderComponent;
  let fixture: ComponentFixture<CurvedBorderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ CurvedBorderComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CurvedBorderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
