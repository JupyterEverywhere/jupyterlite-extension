import { JupyterFrontEndPlugin, JupyterFrontEnd } from '@jupyterlab/application';
import { MainAreaWidget, ReactWidget } from '@jupyterlab/apputils';
import { Contents } from '@jupyterlab/services';
import { IContentsManager } from '@jupyterlab/services';
import { Commands } from '../commands';
import { SidebarIcon } from '../ui-components/SidebarIcon';
import { UUID } from '@lumino/coreutils';
import { showErrorMessage } from '@jupyterlab/apputils';
import { PageTitle } from '../ui-components/PageTitle';
import { EverywhereIcons } from '../icons';
import { FilesWarningBanner } from '../ui-components/FilesWarningBanner';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LabIcon } from '@jupyterlab/ui-components';

/**
 * Interface for uploaded files. This includes metadata such as
 * ID, name, size, type, last modified date, thumbnail (optional),
 * and content in base64 format.
 */
interface IUploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  content: string; // base64 content
}

/**
 * Generates a unique file ID based on UUIDs
 * @returns A unique file ID
 */
const generateFileId = (): string => UUID.uuid4();

/**
 * File type icons mapping function. We currently implement four common file types:
 * 1. Image files (PNG, JPEG/JPG)
 * 2. CSV files (text)
 * @param fileName - the name of the file to determine the icon for.
 * @param fileType - the MIME type of the file to determine the icon for.
 * @returns A LabIcon representing the file type icon.
 */
const getFileIcon = (fileName: string, fileType: string): LabIcon => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (fileType.startsWith('image/') || ['png', 'jpg', 'jpeg'].includes(extension)) {
    return EverywhereIcons.imageIcon;
  }
  if (fileType === 'text/csv' || extension === 'csv') {
    return EverywhereIcons.fileIcon;
  }
  return EverywhereIcons.addFile;
};

/**
 * Checks if the file type is supported (PNG, JPG/JPEG, or CSV).
 * @param file - The file to check
 * @returns True if the file type is supported, false otherwise.
 */
const isSupportedFileType = (file: File): boolean => {
  const supportedMimeTypes = ['image/png', 'image/jpeg', 'text/csv'];
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const supportedExtensions = ['png', 'jpg', 'jpeg', 'csv'];
  return supportedMimeTypes.includes(file.type) || supportedExtensions.includes(extension);
};

/**
 * A React component for uploading files to the Jupyter Contents Manager.
 * It handles file selection, reading, thumbnail generation, and uploading.
 */
interface IFileUploaderProps {
  onFilesUploaded: (files: IUploadedFile[]) => void;
  contentsManager: Contents.IManager;
  onUploadStart: () => void;
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
          'Please upload only PNG, JPG/JPEG, or CSV files.'
        );
        return;
      }

      props.onUploadStart();
      const uploadedFiles: IUploadedFile[] = [];

      try {
        for (const file of supportedFiles) {
          const fileId = generateFileId();

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

            uploadedFiles.push({
              id: fileId,
              name: finalFileName,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified,
              content
            });
          } catch (error) {
            console.warn(`Upload skipped or failed for ${finalFileName}`, error);
          }
        }

        if (uploadedFiles.length > 0) {
          props.onFilesUploaded(uploadedFiles);
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
      accept=".png,.jpg,.jpeg,.csv,image/png,image/jpeg,text/csv"
    />
  );
});

FileUploader.displayName = 'FileUploader';

/**
 * This component displays a thumbnail for each uploaded image or file.
 * We use the `getFileIcon` function to determine the icon based on file type.
 */
interface IFileThumbnailProps {
  file: IUploadedFile;
  onRemove: (fileId: string) => void;
  contentsManager: Contents.IManager;
}

/**
 * FileThumbnail component displays a thumbnail for an uploaded file.
 * @param props - The properties for the FileThumbnail component, including the file to display and a callback for removing the file.
 * @returns A JSX element representing the file thumbnail.
 */
function FileThumbnail(props: IFileThumbnailProps) {
  const { file } = props;

  const handleRemove = async () => {
    try {
      await props.contentsManager.delete(file.name);
    } catch (err) {
      console.error('Error removing file:', err);
    } finally {
      props.onRemove(file.id);
    }
  };

  const fileIcon = getFileIcon(file.name, file.type);
  return (
    <div className="je-FileThumbnail">
      <div className="je-FileThumbnail-preview">
        <div className="je-FileThumbnail-icon">
          <fileIcon.react />
        </div>
      </div>
      <div className="je-FileThumbnail-info">
        <div className="je-FileThumbnail-name" title={file.name}>
          {file.name}
        </div>
      </div>
      <button className="je-FileThumbnail-remove" onClick={handleRemove}>
        ×
      </button>
    </div>
  );
}

/**
 * Represents a clickable tile in the Files area.
 * @param props - The properties for the Tile component, including the icon, label, click handler, and loading state.
 * @returns A JSX element representing the tile.
 */
function Tile(props: { icon: LabIcon; label: string; onClick?: () => void; isLoading?: boolean }) {
  return (
    <button
      className={`je-Tile ${props.isLoading ? 'je-Tile-loading' : ''}`}
      onClick={props.onClick}
      disabled={props.isLoading}
    >
      <div className="je-Tile-icon">
        {props.isLoading ? <div className="je-Tile-spinner" /> : <props.icon.react />}
      </div>
      {props.isLoading ? 'Uploading file...' : props.label}
    </button>
  );
}

/**
 * The main component for the Files page, to display and manage uploaded files.
 */
interface IFilesAppProps {
  contentsManager: Contents.IManager;
}

function FilesApp(props: IFilesAppProps) {
  const [uploadedFiles, setUploadedFiles] = useState<IUploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileUploaderRef = useRef<IFileUploaderRef>(null);

  useEffect(() => {
    (async () => {
      try {
        const listing = await props.contentsManager.get('', { content: true });
        if (listing.type === 'directory' && listing.content) {
          const files = await Promise.all(
            (listing.content as Contents.IModel[])
              .filter(
                f =>
                  f.type === 'file' &&
                  isSupportedFileType({
                    name: f.name,
                    type: f.mimetype ?? '',
                    size: f.size ?? 0,
                    lastModified: Date.now()
                  } as File)
              )
              .map(async f => {
                const content = await props.contentsManager.get(f.path, { content: true });
                const isImage = content.mimetype?.startsWith('image/');
                const base64Content = isImage
                  ? (content.content as string)
                  : btoa(content.content as string);

                return {
                  id: generateFileId(),
                  name: f.name,
                  size: f.size ?? 0,
                  type: content.mimetype ?? '',
                  lastModified: Date.now(),
                  content: `data:${content.mimetype};base64,${base64Content}`
                };
              })
          );

          setUploadedFiles(files);
        }
      } catch (err) {
        await showErrorMessage(
          'Error loading files',
          `Could not load files from the contents manager: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    })();
  }, [props.contentsManager]);

  return (
    <div className="je-FilesApp">
      <div className="je-FilesApp-header">
        <Tile
          icon={EverywhereIcons.addFile}
          label="add new"
          onClick={() => fileUploaderRef.current?.triggerFileSelect()}
          isLoading={isUploading}
        />
      </div>
      <FileUploader
        ref={fileUploaderRef}
        onFilesUploaded={newFiles =>
          setUploadedFiles(prev => {
            const filtered = prev.filter(f => !newFiles.some(nf => nf.name === f.name));
            return [...filtered, ...newFiles];
          })
        }
        contentsManager={props.contentsManager}
        onUploadStart={() => setIsUploading(true)}
        onUploadEnd={() => setIsUploading(false)}
      />
      <div className="je-FilesApp-content">
        <div className="je-FilesApp-grid">
          {uploadedFiles.map(file => (
            <FileThumbnail
              key={file.id}
              file={file}
              onRemove={id => setUploadedFiles(prev => prev.filter(f => f.id !== id))}
              contentsManager={props.contentsManager}
            />
          ))}
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
        execute: () => app.commands.execute(Commands.openFiles)
      }),
      'left',
      { rank: 200 }
    );

    app.commands.addCommand(Commands.openFiles, {
      label: 'Open Files',
      execute: () => {
        if (widget.isDisposed) {
          widget = createWidget();
        }
        if (!widget.isAttached) {
          app.shell.add(widget, 'main');
        }
        app.shell.activateById(widget.id);
      }
    });
  }
};
