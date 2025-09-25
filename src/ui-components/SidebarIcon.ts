import { LabIcon } from '@jupyterlab/ui-components';
import { UUID } from '@lumino/coreutils';
import { StackedPanel } from '@lumino/widgets';

/**
 * An icon in the sidebar that executes a command when clicked. If a pathName
 * is provided, it also updates the URL to that pathName. This could extend Widget,
 * StackedPanel is just temporary as it gives 0-width layout.
 */
export class SidebarIcon extends StackedPanel {
  constructor(
    private _options: {
      label: string;
      icon: LabIcon;
      execute: () => boolean | void;
      pathName?: string;
    }
  ) {
    super();
    this.title.caption = _options.label;
    this.title.icon = _options.icon;
    this.id = UUID.uuid4();
  }
  execute() {
    const ret = this._options.execute();
    if (!ret && this._options.pathName) {
      const target = new URL(this._options.pathName, window.location.origin);
      const here = window.location.href;
      const there = target.href;
      if (here !== there) {
        window.history.pushState(null, this.title.caption ?? '', there);
      }
    }
    return ret;
  }
}
