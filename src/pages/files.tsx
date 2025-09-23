import { JupyterFrontEndPlugin, JupyterFrontEnd } from '@jupyterlab/application';
import { MainAreaWidget, ReactWidget, showErrorMessage } from '@jupyterlab/apputils';
import { Contents } from '@jupyterlab/services';
import { IContentsManager } from '@jupyterlab/services';
import { Commands } from '../commands';
import { SidebarIcon } from '../ui-components/SidebarIcon';
import { PageTitle } from '../ui-components/PageTitle';
import { EverywhereIcons } from '../icons';
import { FilesWarningBanner } from '../ui-components/FilesWarningBanner';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LabIcon } from '@jupyterlab/ui-components';

/**
 * File type icons mapping function. We currently implement four common file types:
 * 1. Image files (PNG, JPEG/JPG) (binary)
 * 2. CSV/TSV files (text)
 * @param fileName - the name of the file to determine the icon for.
 * @param fileType - the MIME type of the file to determine the icon for.
 * @returns A LabIcon representing the file type icon.
 */
const getFileIcon = (fileName: string, fileType: string): LabIcon => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (fileType.startsWith('image/') || ['png', 'jpg', 'jpeg'].includes(extension)) {
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
 * Checks if the file type is supported (PNG, JPG/JPEG, or CSV/TSV).
 * @param file - The file to check
 * @returns True if the file type is supported, false otherwise.
 */
const isSupportedFileType = (file: File): boolean => {
  const supportedMimeTypes = ['image/png', 'image/jpeg', 'text/csv', 'text/tab-separated-values'];
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const supportedExtensions = ['png', 'jpg', 'jpeg', 'csv', 'tsv'];
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
          'Please upload only PNG, JPG/JPEG, or CSV/TSV files.'
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
      accept=".png,.jpg,.jpeg,.csv,.tsv,image/png,image/jpeg,text/csv,text/tab-separated-values"
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

  // Show the native "Leave site?" prompt when there is at least one uploaded (supported) file.
  const hasAnyFileBeenUploaded = React.useMemo(() => {
    if (!listing || listing.type !== 'directory') {
      return false;
    }
    const items = listing.content as Contents.IModel[];
    return items.some(f => {
      if (f.type !== 'file') {
        return false;
      }
      return isSupportedFileType({
        name: f.name,
        type: f.mimetype ?? '',
        size: f.size ?? 0,
        lastModified: Date.now()
      } as File);
    });
  }, [listing]);

  useEffect(() => {
    if (!hasAnyFileBeenUploaded) {
      return;
    }

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasAnyFileBeenUploaded]);

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
                    <div className="je-FileTile-box">
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
  activate: (app: JupyterFrontEnd, contentsManager: Contents.IManager) => {
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

    app.shell.add(
      new SidebarIcon({
        label: 'Files',
        icon: EverywhereIcons.folderSidebar,
        execute: () => {
          void app.commands.execute(Commands.openFiles);
          return undefined;
        }
      }),
      'left',
      { rank: 200 }
    );

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
