import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { IEditorMimeTypeService } from '@jupyterlab/codeeditor';
import { WidgetTracker, IWidgetTracker } from '@jupyterlab/apputils';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { ABCWidgetFactory, DocumentRegistry, DocumentWidget } from '@jupyterlab/docregistry';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ITranslator } from '@jupyterlab/translation';
import { INotebookModel, NotebookPanel, Notebook, StaticNotebook } from '@jupyterlab/notebook';
import { createToolbarFactory, IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { Token } from '@lumino/coreutils';

export const READONLY_NOTEBOOK_FACTORY = 'ReadonlyNotebook';

const NOTEBOOK_PANEL_CLASS = 'jp-NotebookPanel';

const NOTEBOOK_PANEL_TOOLBAR_CLASS = 'jp-NotebookPanel-toolbar';

const NOTEBOOK_PANEL_NOTEBOOK_CLASS = 'jp-NotebookPanel-notebook';

export const IReadonlyNotebookTracker = new Token<IReadonlyNotebookTracker>(
  'jupytereverywhere:readonly-notebook:IReadonlyNotebookTracker'
);

export interface IReadonlyNotebookTracker extends IWidgetTracker<ReadonlyNotebookPanel> {}

/**
 * Creates a "View Only" header widget for read-only notebooks.
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

class ReadonlyNotebook extends StaticNotebook {
  // Add any customization for read-only notebook here if needed
}

class ReadonlyNotebookPanel extends DocumentWidget<ReadonlyNotebook, INotebookModel> {
  /**
   * Construct a new readonly notebook panel.
   */
  constructor(options: DocumentWidget.IOptions<ReadonlyNotebook, INotebookModel>) {
    super(options);

    this.addClass(NOTEBOOK_PANEL_CLASS);
    this.toolbar.addClass(NOTEBOOK_PANEL_TOOLBAR_CLASS);
    this.content.addClass(NOTEBOOK_PANEL_NOTEBOOK_CLASS);

    this.content.model = this.context.model;
    const headerWidget = new ViewOnlyHeader();
    this.contentHeader.insertWidget(0, headerWidget);
    this.contentHeader.addClass('je-ViewOnlyHeader-wrapper');
  }
}

namespace ReadonlyNotebookWidgetFactory {
  export interface IOptions extends DocumentRegistry.IWidgetFactoryOptions<ReadonlyNotebookPanel> {
    rendermime: IRenderMimeRegistry;
    contentFactory: Notebook.IContentFactory;
    mimeTypeService: IEditorMimeTypeService;
    editorConfig?: StaticNotebook.IEditorConfig;
    notebookConfig?: StaticNotebook.INotebookConfig;
    translator?: ITranslator;
  }
}

class ReadonlyNotebookWidgetFactory extends ABCWidgetFactory<
  ReadonlyNotebookPanel,
  INotebookModel
> {
  /**
   * Construct a new notebook widget factory.
   *
   * @param options - The options used to construct the factory.
   */
  constructor(private _options: ReadonlyNotebookWidgetFactory.IOptions) {
    super(_options);
  }

  /**
   * Create a new widget.
   */
  protected createNewWidget(
    context: DocumentRegistry.IContext<INotebookModel>,
    source?: ReadonlyNotebookPanel
  ): ReadonlyNotebookPanel {
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
    const content = new ReadonlyNotebook(nbOptions);

    return new ReadonlyNotebookPanel({ context, content });
  }
}

export const readonlyNotebookFactoryPlugin: JupyterFrontEndPlugin<IReadonlyNotebookTracker> = {
  id: 'jupytereverywhere:readonly-notebook',
  requires: [
    NotebookPanel.IContentFactory,
    IEditorServices,
    IRenderMimeRegistry,
    IToolbarWidgetRegistry,
    ISettingRegistry,
    ITranslator
  ],
  provides: IReadonlyNotebookTracker,
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    contentFactory: NotebookPanel.IContentFactory,
    editorServices: IEditorServices,
    rendermime: IRenderMimeRegistry,
    toolbarRegistry: IToolbarWidgetRegistry,
    settingRegistry: ISettingRegistry,
    translator: ITranslator
  ) => {
    const PANEL_SETTINGS = '@jupyterlab/notebook-extension:panel';

    const toolbarFactory = createToolbarFactory(
      toolbarRegistry,
      settingRegistry,
      READONLY_NOTEBOOK_FACTORY,
      PANEL_SETTINGS,
      translator
    );

    const trans = translator.load('jupyterlab');

    const factory = new ReadonlyNotebookWidgetFactory({
      name: READONLY_NOTEBOOK_FACTORY,
      label: trans.__('Readonly Notebook'),
      fileTypes: ['notebook'],
      modelName: 'notebook',
      preferKernel: false,
      canStartKernel: false,
      rendermime,
      contentFactory,
      editorConfig: StaticNotebook.defaultEditorConfig,
      notebookConfig: StaticNotebook.defaultNotebookConfig,
      mimeTypeService: editorServices.mimeTypeService,
      toolbarFactory,
      translator
    });
    const tracker = new WidgetTracker<ReadonlyNotebookPanel>({
      namespace: 'readonly-notebook'
    });
    factory.widgetCreated.connect((sender, widget) => {
      void tracker.add(widget);
    });
    app.docRegistry.addWidgetFactory(factory);
    return tracker;
  }
};
