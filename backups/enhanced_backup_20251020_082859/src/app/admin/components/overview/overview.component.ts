import { Component, OnInit } from '@angular/core';
import { AccountService } from '@app/_services';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TitleComponent } from '@app/shared/components/title/title.component';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TitleComponent
  ],
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.css']
})
export class OverviewComponent implements OnInit {
  constructor(
    private accountService: AccountService
  ) {}

  ngOnInit() {
    // Initialize the overview dashboard
    console.log('Admin overview dashboard initialized');
  }
}