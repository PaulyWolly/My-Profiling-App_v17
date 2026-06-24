import { Component } from '@angular/core';
import { buildVersion } from '@environments/build-version';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  readonly buildVersion = buildVersion;
}
