import { Widget } from '@lumino/widgets';

// Placeholder
export class JupyterEverywherePlaceholder extends Widget {
  constructor() {
    super();
    this.addClass('jp-JupyterEverywhere-Placeholder');
    this.node.textContent = 'JupyterEverywhere main area';
  }
}
