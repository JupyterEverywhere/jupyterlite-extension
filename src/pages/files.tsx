import { JupyterFrontEndPlugin, JupyterFrontEnd } from '@jupyterlab/application';
import { MainAreaWidget, ReactWidget } from '@jupyterlab/apputils';
import { Contents } from '@jupyterlab/services';
import { IContentsManager } from '@jupyterlab/services';
import { Commands } from '../commands';
import { SidebarIcon } from '../ui-components/SidebarIcon';
import { UUID } from '@lumino/coreutils';
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
interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  thumbnail?: string;
  content: string; // base64 content
}

/**
 * Generates a thumbnail for an image file or Blob object.
 * @param file File or Blob object to generate a thumbnail for.
 * @returns A Promise that resolves to a base64 string of the thumbnail image, or undefined if the file is not an image.
 */
const generateThumbnail = (file: File | Blob): Promise<string | undefined> => {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/')) {
      resolve(undefined);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const maxSize = 150;
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }
      canvas.width = width;
      canvas.height = height;
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8)); // I suppose can be tweaked later;
      } else {
        resolve(undefined);
      }
    };

    img.onerror = () => resolve(undefined);
    img.src = URL.createObjectURL(file);
  });
};

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
 * Converts a base64 string to a Blob object, used for image thumbnails.
 * @param base64 - The base64 string to convert.
 * @param mime - The MIME type of the Blob.
 * @returns - A Blob object representing the base64 data.
 */
function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const array = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new Blob([array], { type: mime });
}

/**
 * A React component for uploading files to the Jupyter Contents Manager.
 * It handles file selection, reading, thumbnail generation, and uploading.
 */
interface FileUploaderProps {
  onFilesUploaded: (files: UploadedFile[]) => void;
  contentsManager: Contents.IManager;
  onUploadStart: () => void;
  onUploadEnd: () => void;
}

/**
 * Ref interface for the FileUploader component.
 */
interface FileUploaderRef {
  triggerFileSelect: () => void;
}

const FileUploader = React.forwardRef<FileUploaderRef, FileUploaderProps>((props, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      if (!files.length) return;

      const supportedFiles = Array.from(files).filter(isSupportedFileType);
      if (supportedFiles.length === 0) {
        alert('Please upload only PNG, JPEG, or CSV files.'); // TODO: Use a better UI alert?
        return;
      }

      props.onUploadStart();
      const uploadedFiles: UploadedFile[] = [];

      try {
        for (const file of supportedFiles) {
          const fileId = generateFileId();

          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });

          // Generate a thumbnail if it's an image
          const isImage = file.type.startsWith('image/');
          const thumbnail = await generateThumbnail(file);
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
              thumbnail,
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
    if (e.target.files) handleFileSelect(e.target.files);
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
interface FileThumbnailProps {
  file: UploadedFile;
  onRemove: (fileId: string) => void;
  contentsManager: Contents.IManager;
}

/**
 * FileThumbnail component displays a thumbnail for an uploaded file.
 * @param props - The properties for the FileThumbnail component, including the file to display and a callback for removing the file.
 * @returns A JSX element representing the file thumbnail.
 */
function FileThumbnail(props: FileThumbnailProps) {
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
        {file.thumbnail ? (
          <img src={file.thumbnail} alt={file.name} className="je-FileThumbnail-image" />
        ) : (
          <div className="je-FileThumbnail-icon">
            <fileIcon.react />
          </div>
        )}
      </div>
      <div className="je-FileThumbnail-info">
        <div className="je-FileThumbnail-name" title={file.name}>
          {file.name}
        </div>
        <div className="je-FileThumbnail-size">{(file.size / 1024).toFixed(1)} KB</div>
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
interface FilesAppProps {
  contentsManager: Contents.IManager;
}

function FilesApp(props: FilesAppProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileUploaderRef = useRef<FileUploaderRef>(null);

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

                let thumbnail: string | undefined = undefined;

                if (isImage && base64Content) {
                  const blob = base64ToBlob(base64Content, content.mimetype!);
                  thumbnail = await generateThumbnail(blob);
                }

                return {
                  id: generateFileId(),
                  name: f.name,
                  size: f.size ?? 0,
                  type: content.mimetype ?? '',
                  lastModified: Date.now(),
                  thumbnail,
                  content: `data:${content.mimetype};base64,${base64Content}`
                };
              })
          );

          setUploadedFiles(files);
        }
      } catch (err) {
        console.error('Error loading files:', err); // TODO: Use a better UI alert?
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
  private _contentsManager: Contents.IManager;
  constructor(contentsManager: Contents.IManager) {
    super();
    this.addClass('je-Files');
    this._contentsManager = contentsManager;
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
