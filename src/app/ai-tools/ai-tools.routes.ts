import { Routes } from '@angular/router';

import { AiToolsLayoutComponent } from './components/ai-tools-layout/ai-tools-layout.component';
import { AiChatComponent } from './components/ai-chat/ai-chat.component';
import { AiImageComponent } from './components/ai-image/ai-image.component';
import { AiImageGeneratorComponent } from './components/ai-image-generator/ai-image-generator.component';
import { AiRagComponent } from './components/ai-rag/ai-rag.component';

export const AI_TOOLS_ROUTES: Routes = [
  {
    path: '',
    component: AiToolsLayoutComponent,
    children: [
      { path: '', redirectTo: 'chat', pathMatch: 'full' },
      { path: 'chat', component: AiChatComponent },
      { path: 'image', component: AiImageComponent },
      { path: 'generate', component: AiImageGeneratorComponent },
      { path: 'rag', component: AiRagComponent }
    ]
  }
];
