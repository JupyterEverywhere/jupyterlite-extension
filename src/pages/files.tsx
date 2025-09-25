import { JupyterFrontEndPlugin, JupyterFrontEnd } from '@jupyterlab/application';
import { ILiteRouter } from '@jupyterlite/application';
import { MainAreaWidget, ReactWidget, showErrorMessage } from '@jupyterlab/apputils';
import { Contents } from '@jupyterlab/services';
import { IContentsManager } from '@jupyterlab/services';
import { Commands } from '../commands';
import { SidebarIcon } from '../ui-components/SidebarIcon';
import { PageTitle } from '../ui-components/PageTitle';
import { EverywhereIcons } from '../icons';
import { FilesWarningBanner } from '../ui-components/FilesWarningBanner';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LabIcon, closeIcon, downloadIcon } from '@jupyterlab/ui-components';

/**
 * File type icons mapping function. We currently implement four common file types:
 * 1. Image files (PNG, JPEG/JPG, WEBP) (binary)
 * 2. CSV/TSV files (text)
 * @param fileName - the name of the file to determine the icon for.
 * @param fileType - the MIME type of the file to determine the icon for.
 * @returns A LabIcon representing the file type icon.
 */
const getFileIcon = (fileName: string, fileType: string): LabIcon => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (fileType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(extension)) {
    return EverywhereIcons.imageIcon;
  }
  if (
    fileType === 'text/csv' ||
    extension === 'csv' ||
    fileType === 'text/tab-separated-values' ||
    extension === 'tsv'
  ) {
    return EverywhereIcons.fileIcon;
  }
  return EverywhereIcons.addFile;
};

/**
 * Checks if the file type is supported (PNG, JPG/JPEG, WEBP, or CSV/TSV).
 * @param file - The file to check
 * @returns True if the file type is supported, false otherwise.
 */
const isSupportedFileType = (file: File): boolean => {
  const supportedMimeTypes = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/csv',
    'text/tab-separated-values'
  ];
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const supportedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'csv', 'tsv'];
  return supportedMimeTypes.includes(file.type) || supportedExtensions.includes(extension);
};

/**
 * A React component for uploading files to the Jupyter Contents Manager.
 * It handles file selection, reading, thumbnail generation, and uploading.
 */
interface IFileUploaderProps {
  contentsManager: Contents.IManager;
  onUploadStart: (count: number) => void;
  onUploadEnd: () => void;
}

/**
 * Ref interface for the FileUploader component.
 */
interface IFileUploaderRef {
  triggerFileSelect: () => void;
}

const FileUploader = React.forwardRef<IFileUploaderRef, IFileUploaderProps>((props, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      if (!files.length) {
        return;
      }

      const supportedFiles = Array.from(files).filter(isSupportedFileType);
      if (supportedFiles.length === 0) {
        await showErrorMessage(
          'Unsupported file type',
          'Please upload only PNG, JPG/JPEG, WEBP, or CSV/TSV files.'
        );
        return;
      }

      props.onUploadStart(supportedFiles.length);

      try {
        for (const file of supportedFiles) {
          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });

          const isImage = file.type.startsWith('image/');
          const base64 = content.split(',')[1];
          const finalContent = isImage ? base64 : atob(base64);
          const finalFileName = file.name;

          try {
            await props.contentsManager.save(finalFileName, {
              type: 'file',
              format: isImage ? 'base64' : 'text',
              content: finalContent
            });
          } catch (error) {
            console.warn(`Upload skipped or failed for ${finalFileName}`, error);
          }
        }
      } finally {
        props.onUploadEnd();
      }
    },
    [props]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Expose the trigger function to the parent
  React.useImperativeHandle(ref, () => ({
    triggerFileSelect
  }));

  return (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      onChange={handleInputChange}
      style={{ display: 'none' }}
      accept=".png,.jpg,.jpeg,.webp,.csv,.tsv,image/png,image/jpeg,image/webp,text/csv,text/tab-separated-values"
    />
  );
});

FileUploader.displayName = 'FileUploader';

/**
 * The main Files page component. It manages the state of uploaded files,
 * handles file uploads, and renders the file thumbnails.
 */
interface IFilesAppProps {
  contentsManager: Contents.IManager;
}

function FilesApp(props: IFilesAppProps) {
  const [listing, setListing] = useState<Contents.IModel | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileUploaderRef = useRef<IFileUploaderRef>(null);

  const refreshListing = useCallback(async () => {
    try {
      const dirListing = await props.contentsManager.get('', { content: true });
      setListing(dirListing);
    } catch (err) {
      await showErrorMessage(
        'Error loading files',
        `Could not load files from the contents manager: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }, [props.contentsManager]);

  useEffect(() => {
    void refreshListing();
  }, [refreshListing]);

  const downloadFile = React.useCallback(
    async (model: Contents.IModel) => {
      try {
        const fetched = await props.contentsManager.get(model.path, { content: true });
        if (fetched.type !== 'file') {
          return;
        }

        const fmt = (fetched.format ?? 'text') as 'text' | 'base64';
        const mime = fetched.mimetype ?? inferMimeFromName(model.name);

        let blob: Blob;
        if (fmt === 'base64') {
          const b64 = String(fetched.content ?? '');
          const bytes = atob(b64);
          const buf = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) {
            buf[i] = bytes.charCodeAt(i);
          }
          blob = new Blob([buf], { type: mime });
        } else {
          blob = new Blob([String(fetched.content ?? '')], { type: mime || 'text/plain' });
        }

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = model.name;
        document.body.appendChild(a);
        a.click();
        requestAnimationFrame(() => {
          URL.revokeObjectURL(a.href);
          a.remove();
        });
      } catch (err) {
        await showErrorMessage(
          'Download failed',
          `Could not download ${model.name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
    [props.contentsManager]
  );

  const deleteFile = React.useCallback(
    async (model: Contents.IModel) => {
      try {
        await props.contentsManager.delete(model.path);
        await refreshListing();
      } catch (err) {
        await showErrorMessage(
          'Delete failed',
          `Could not delete ${model.name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
    [props.contentsManager, refreshListing]
  );

  /**
   * Infer the MIME type from a file name.
   * @param name - file name
   * @returns the MIME type inferred from the file extension, or an empty string if unknown.
   */
  function inferMimeFromName(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'png') {
      return 'image/png';
    }
    if (ext === 'jpg' || ext === 'jpeg') {
      return 'image/jpeg';
    }
    if (ext === 'webp') {
      return 'image/webp';
    }
    if (ext === 'csv') {
      return 'text/csv';
    }
    if (ext === 'tsv') {
      return 'text/tab-separated-values';
    }
    return '';
  }

  return (
    <div className="je-FilesApp">
      <FileUploader
        ref={fileUploaderRef}
        onUploadStart={count => {
          setUploadingCount(count);
          setIsUploading(true);
        }}
        onUploadEnd={async () => {
          setUploadingCount(0);
          setIsUploading(false);
          await refreshListing();
        }}
        contentsManager={props.contentsManager}
      />
      <div className="je-FilesApp-content">
        <div className="je-FilesApp-grid">
          {/* "add new" tile */}
          <div className="je-FileTile">
            <div
              className="je-FileTile-box je-FileTile-box-addNew"
              onClick={() => fileUploaderRef.current?.triggerFileSelect()}
            >
              {isUploading ? (
                <div className="je-FileTile-spinner" />
              ) : (
                <EverywhereIcons.addFile.react />
              )}
            </div>
            <div className="je-FileTile-label">
              {uploadingCount > 0
                ? `Uploading ${uploadingCount} file${uploadingCount > 1 ? 's' : ''}...`
                : 'add new'}
            </div>
          </div>
          {/* File thumbnails, and the rest of the tiles. */}
          {listing &&
            listing.type === 'directory' &&
            (listing.content as Contents.IModel[])
              .filter(f => {
                return (
                  f.type === 'file' &&
                  isSupportedFileType({
                    name: f.name,
                    type: f.mimetype ?? '',
                    size: f.size ?? 0,
                    lastModified: Date.now()
                  } as File)
                );
              })
              .map(f => {
                const fileIcon = getFileIcon(f.name, f.mimetype ?? '');
                return (
                  <div className="je-FileTile" key={f.path}>
                    <div className="je-FileTile-box je-FileTile-box-hasActions">
                      <div className="je-FileTile-actions">
                        {/* Delete (X) button */}
                        <button
                          className="je-FileTile-action je-FileTile-action--close"
                          aria-label={`Delete ${f.name}`}
                          title="Delete"
                          onClick={e => {
                            e.stopPropagation();
                            void deleteFile(f);
                          }}
                        >
                          <closeIcon.react tag="span" />
                        </button>

                        {/* Download (↓) button */}
                        <button
                          className="je-FileTile-action je-FileTile-action--download"
                          aria-label={`Download ${f.name}`}
                          title="Download"
                          onClick={e => {
                            e.stopPropagation();
                            void downloadFile(f);
                          }}
                        >
                          <downloadIcon.react tag="span" />
                        </button>
                      </div>
                      <fileIcon.react />
                    </div>
                    <div className="je-FileTile-label">{f.name}</div>
                  </div>
                );
              })}
        </div>
      </div>
      <FilesWarningBanner />
    </div>
  );
}

class Files extends ReactWidget {
  constructor(private _contentsManager: Contents.IManager) {
    super();
    this.addClass('je-Files');
  }

  protected render() {
    return <FilesApp contentsManager={this._contentsManager} />;
  }
}

export const files: JupyterFrontEndPlugin<void> = {
  id: 'jupytereverywhere:files',
  autoStart: true,
  requires: [IContentsManager],
  optional: [ILiteRouter],
  activate: (
    app: JupyterFrontEnd,
    contentsManager: Contents.IManager,
    router: ILiteRouter | null
  ) => {
    const createWidget = () => {
      const content = new Files(contentsManager);
      const widget = new MainAreaWidget({ content });
      widget.id = 'je-files';
      widget.title.label = 'Files';
      widget.title.closable = true;
      widget.title.icon = EverywhereIcons.folder;
      widget.toolbar.addItem(
        'title',
        new PageTitle({
          label: 'Files',
          icon: EverywhereIcons.folder
        })
      );
      return widget;
    };

    let widget = createWidget();

    const base = (router?.base || '').replace(/\/$/, '');
    const filesPath = `${base}/lab/files/`;

    // Show the Files widget; return false-y so SidebarIcon does the URL swap.
    const filesSidebar = new SidebarIcon({
      label: 'Files',
      icon: EverywhereIcons.folderSidebar,
      pathName: filesPath,
      execute: () => {
        void app.commands.execute(Commands.openFiles);
        return SidebarIcon.delegateNavigation;
      }
    });
    app.shell.add(filesSidebar, 'left', { rank: 200 });

    // If we landed with a "files" intent, highlight Files in the sidebar.
    void app.restored.then(() => {
      const url = new URL(window.location.href);
      const pathIsFiles = /\/lab\/files(?:\/|$)/.test(url.pathname);
      const tabIsFiles = url.searchParams.get('tab') === 'files';
      if (pathIsFiles || tabIsFiles) {
        const desired = new URL(filesPath, window.location.origin);
        desired.hash = url.hash;
        window.history.replaceState(null, 'Files', desired.toString());

        if (widget.isDisposed) {
          widget = createWidget();
        }
        if (!widget.isAttached) {
          app.shell.add(widget, 'main');
        }
        app.shell.activateById(filesSidebar.id);
      }
    });

    app.commands.addCommand(Commands.openFiles, {
      label: 'Open Files',
      execute: () => {
        // Regenerate the widget if disposed
        if (widget.isDisposed) {
          widget = createWidget();
        }
        if (!widget.isAttached) {
          // Attach the widget to the main work area if it's not there
          app.shell.add(widget, 'main');
        }
        app.shell.activateById(widget.id);
      }
    });
  }
};
