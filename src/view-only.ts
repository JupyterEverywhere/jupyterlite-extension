import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { IEditorMimeTypeService } from '@jupyterlab/codeeditor';
import { WidgetTracker, IWidgetTracker } from '@jupyterlab/apputils';
import { ReactiveToolbar, Toolbar } from '@jupyterlab/ui-components';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { ABCWidgetFactory, DocumentRegistry, DocumentWidget } from '@jupyterlab/docregistry';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ITranslator } from '@jupyterlab/translation';
import { INotebookModel, Notebook, StaticNotebook } from '@jupyterlab/notebook';
import { createToolbarFactory, IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { Token } from '@lumino/coreutils';
import { MarkdownCell } from '@jupyterlab/cells';

export const VIEW_ONLY_NOTEBOOK_FACTORY = 'ViewOnlyNotebook';

const NOTEBOOK_PANEL_CLASS = 'jp-NotebookPanel';

const NOTEBOOK_PANEL_TOOLBAR_CLASS = 'jp-NotebookPanel-toolbar';

const NOTEBOOK_PANEL_NOTEBOOK_CLASS = 'jp-NotebookPanel-notebook';

export const IViewOnlyNotebookTracker = new Token<IViewOnlyNotebookTracker>(
  'jupytereverywhere:view-only-notebook:IViewOnlyNotebookTracker'
);

export interface IViewOnlyNotebookTracker extends IWidgetTracker<ViewOnlyNotebookPanel> {}

/**
 * Creates a "View Only" header widget for view-only notebooks.
 */
class ViewOnlyHeader extends Widget {
  constructor() {
    super();
    this.addClass('je-ViewOnlyHeader');
    const contentNode = document.createElement('div');
    contentNode.className = 'je-ViewOnlyHeader-content';
    contentNode.textContent = 'View Only';
    this.node.appendChild(contentNode);
  }
}

namespace FilteredToolbar {
  export interface IOptions extends Toolbar.IOptions {
    itemsToFilterOut: Set<string>;
  }
}

class FilteredToolbar extends ReactiveToolbar {
  constructor(options: FilteredToolbar.IOptions) {
    super(options);
    this._itemsToFilterOut = options.itemsToFilterOut;
  }
  insertItem(index: number, name: string, widget: Widget): boolean {
    if (this._itemsToFilterOut?.has(name)) {
      return false;
    }
    return super.insertItem(index, name, widget);
  }
  // This can be undefined during the super() call in constructor
  private _itemsToFilterOut: Set<string> | undefined;
}

export class ViewOnlyNotebook extends StaticNotebook {
  // Add any customization for view-only notebook here if needed
}

export class ViewOnlyNotebookPanel extends DocumentWidget<ViewOnlyNotebook, INotebookModel> {
  /**
   * Construct a new view-only notebook panel.
   */
  constructor(options: DocumentWidget.IOptions<ViewOnlyNotebook, INotebookModel>) {
    super({
      ...options,
      toolbar: new FilteredToolbar({
        itemsToFilterOut: new Set(['read-only-indicator'])
      })
    });

    this.addClass(NOTEBOOK_PANEL_CLASS);
    this.toolbar.addClass(NOTEBOOK_PANEL_TOOLBAR_CLASS);
    this.toolbar.addClass('je-ViewOnlyNotebookToolbar');
    this.content.addClass(NOTEBOOK_PANEL_NOTEBOOK_CLASS);

    this.content.model = this.context.model;
    const headerWidget = new ViewOnlyHeader();
    this.contentHeader.insertWidget(0, headerWidget);
    this.contentHeader.addClass('je-ViewOnlyHeader-wrapper');
  }
}

namespace ViewOnlyNotebookWidgetFactory {
  export interface IOptions extends DocumentRegistry.IWidgetFactoryOptions<ViewOnlyNotebookPanel> {
    rendermime: IRenderMimeRegistry;
    contentFactory: Notebook.IContentFactory;
    mimeTypeService: IEditorMimeTypeService;
    editorConfig?: StaticNotebook.IEditorConfig;
    notebookConfig?: StaticNotebook.INotebookConfig;
    translator?: ITranslator;
  }
}

class ViewOnlyNotebookWidgetFactory extends ABCWidgetFactory<
  ViewOnlyNotebookPanel,
  INotebookModel
> {
  /**
   * Construct a new notebook widget factory.
   *
   * @param options - The options used to construct the factory.
   */
  constructor(private _options: ViewOnlyNotebookWidgetFactory.IOptions) {
    super(_options);
  }

  /**
   * Create a new widget.
   */
  protected createNewWidget(
    context: DocumentRegistry.IContext<INotebookModel>,
    source?: ViewOnlyNotebookPanel
  ): ViewOnlyNotebookPanel {
    const translator = (context as any).translator;
    const { contentFactory, mimeTypeService, rendermime } = this._options;
    const nbOptions = {
      rendermime: source
        ? source.content.rendermime
        : rendermime.clone({ resolver: context.urlResolver }),
      contentFactory,
      mimeTypeService,
      editorConfig: source
        ? source.content.editorConfig
        : this._options.editorConfig || StaticNotebook.defaultEditorConfig,
      notebookConfig: source
        ? source.content.notebookConfig
        : this._options.notebookConfig || StaticNotebook.defaultNotebookConfig,
      translator
    };
    const content = new ViewOnlyNotebook(nbOptions);

    return new ViewOnlyNotebookPanel({ context, content });
  }
}

class ViewOnlyContentFactory extends Notebook.ContentFactory {
  createMarkdownCell(options: MarkdownCell.IOptions): MarkdownCell {
    const cell = super.createMarkdownCell(options);
    cell.showEditorForReadOnly = false;
    return cell;
  }
}

export const viewOnlyNotebookFactoryPlugin: JupyterFrontEndPlugin<IViewOnlyNotebookTracker> = {
  id: 'jupytereverywhere:view-only-notebook',
  requires: [
    IEditorServices,
    IRenderMimeRegistry,
    IToolbarWidgetRegistry,
    ISettingRegistry,
    ITranslator
  ],
  provides: IViewOnlyNotebookTracker,
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    editorServices: IEditorServices,
    rendermime: IRenderMimeRegistry,
    toolbarRegistry: IToolbarWidgetRegistry,
    settingRegistry: ISettingRegistry,
    translator: ITranslator
  ) => {
    // This needs to have a `toolbar` property with an array
    const PANEL_SETTINGS = 'jupytereverywhere:plugin';

    const toolbarFactory = createToolbarFactory(
      toolbarRegistry,
      settingRegistry,
      VIEW_ONLY_NOTEBOOK_FACTORY,
      PANEL_SETTINGS,
      translator
    );

    const trans = translator.load('jupyterlab');
    const editorFactory = editorServices.factoryService.newInlineEditor;

    const factory = new ViewOnlyNotebookWidgetFactory({
      name: VIEW_ONLY_NOTEBOOK_FACTORY,
      label: trans.__('View-only Notebook'),
      fileTypes: ['notebook'],
      modelName: 'notebook',
      preferKernel: false,
      canStartKernel: false,
      rendermime,
      contentFactory: new ViewOnlyContentFactory({ editorFactory }),
      editorConfig: StaticNotebook.defaultEditorConfig,
      notebookConfig: StaticNotebook.defaultNotebookConfig,
      mimeTypeService: editorServices.mimeTypeService,
      toolbarFactory,
      translator
    });
    const tracker = new WidgetTracker<ViewOnlyNotebookPanel>({
      namespace: 'view-only-notebook'
    });
    factory.widgetCreated.connect((sender, widget) => {
      void tracker.add(widget);
    });
    app.docRegistry.addWidgetFactory(factory);
    return tracker;
  }
};
