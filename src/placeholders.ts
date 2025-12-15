import { placeholder } from '@codemirror/view';
import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { EditorExtensionRegistry, IEditorExtensionRegistry } from '@jupyterlab/codemirror';

export const EMPTY_MARKDOWN_PLACEHOLDER = 'This is a text cell. Double-click to edit.';

export const placeholderPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyter-everywhere/codemirror-extension:placeholder',
  autoStart: true,
  requires: [IEditorExtensionRegistry],
  activate: (app: JupyterFrontEnd, extensions: IEditorExtensionRegistry) => {
    extensions.addExtension(
      Object.freeze({
        name: 'placeholder',
        default: null,
        factory: () =>
          EditorExtensionRegistry.createConfigurableExtension((text: string | null) =>
            text ? placeholder(text) : []
          ),
        schema: {
          type: ['string', 'null'],
          title: 'Placeholder',
          description: 'Placeholder to show.'
        }
      })
    );
  }
};
