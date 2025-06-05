import { LabIcon } from '@jupyterlab/ui-components';
import { UUID } from '@lumino/coreutils';
import { StackedPanel } from '@lumino/widgets';

// it could extend Widget, StackedPanel is just temporary as it gives 0-width layout
export class SidebarIcon extends StackedPanel {
  constructor(private _options: { label: string; icon: LabIcon; execute: () => void }) {
    super();
    this.title.caption = _options.label;
    this.title.icon = _options.icon;
    this.id = UUID.uuid4();
  }
  protected onBeforeShow() {
    this._options.execute();
  }
}
