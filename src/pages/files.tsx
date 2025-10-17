import { JupyterFrontEndPlugin, JupyterFrontEnd } from '@jupyterlab/application';
import { ILiteRouter } from '@jupyterlite/application';
import {
  Dialog,
  MainAreaWidget,
  ReactWidget,
  showDialog,
  showErrorMessage
} from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { Contents } from '@jupyterlab/services';
import { IContentsManager } from '@jupyterlab/services';
import { Commands } from '../commands';
import { SidebarIcon } from '../ui-components/SidebarIcon';
import { PageTitle } from '../ui-components/PageTitle';
import { EverywhereIcons } from '../icons';
import { FilesWarningBanner } from '../ui-components/FilesWarningBanner';
import React, { useId, useState, useRef, useCallback, useEffect } from 'react';
import { LabIcon } from '@jupyterlab/ui-components';
import { openRenameDialog } from '../ui-components/rename-dialog';
import { showUploadConflictDialog } from '../ui-components/upload-conflict';

/**
 * File type icons mapping function. We currently implement four common file types:
 * 1. Image files (PNG, JPEG/JPG, WEBP) (binary)
 * 2. CSV/TSV files (text)
 * @param fileName - the name of the file to determine the icon for.
 * @param fileType - the MIME type of the file to determine the icon for.
 * @returns A LabIcon representing the file type icon.
 */
const getFileIcon = (fileName: string, fileType: string): LabIcon => {
  const extension = PathExt.extname(fileName).toLowerCase().slice(1);
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
  const extension = PathExt.extname(file.name).toLowerCase().slice(1);
  const supportedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'csv', 'tsv'];
  return supportedMimeTypes.includes(file.type) || supportedExtensions.includes(extension);
};

/**
 * A helper function to check if a file exists in the contents manager.
 * @param contentsManager - The contents manager instance.
 * @param path - The path to check.
 * @returns True if the file exists, false otherwise.
 */
async function fileExists(contentsManager: Contents.IManager, path: string): Promise<boolean> {
  try {
    await contentsManager.get(path, { content: false });
    return true;
  } catch (error) {
    return false;
  }
}

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

      // Check for conflicts before starting file uploads. We check all files first
      // and allow the user to decide if they want to upload the non-conflicting files.
      const conflictingFiles: string[] = [];
      const filesToUpload: File[] = [];

      for (const file of supportedFiles) {
        const exists = await fileExists(props.contentsManager, file.name);

        if (exists) {
          conflictingFiles.push(file.name);
        } else {
          filesToUpload.push(file);
        }
      }

      if (conflictingFiles.length > 0) {
        await showUploadConflictDialog(conflictingFiles);

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        // If there are non-conflicting files after the dialog is dismissed
        // by the user, ask if they want to upload them.
        if (filesToUpload.length > 0) {
          const result = await showDialog({
            title: 'Upload remaining files',
            body: `${conflictingFiles.length} file${conflictingFiles.length > 1 ? 's' : ''} could not be uploaded due to name conflicts. Would you like to upload the remaining ${filesToUpload.length} file${filesToUpload.length > 1 ? 's' : ''}?`,
            buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Upload' })]
          });

          if (!result.button.accept) {
            return;
          }
        } else {
          // All files had conflicts, nothing to upload.
          return;
        }
      }

      if (filesToUpload.length === 0) {
        return;
      }

      props.onUploadStart(filesToUpload.length);

      try {
        for (const file of filesToUpload) {
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
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
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
 * Component for the ellipsis menu dropdown for each file.
 */
interface IFileMenuProps {
  model: Contents.IModel;
  onDownload: (model: Contents.IModel) => void;
  onDelete: (model: Contents.IModel) => void;
  onRename: (model: Contents.IModel) => void;
}

function FileMenu(props: IFileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const triggerId = useId();
  const menuItemsRef = useRef<HTMLButtonElement[]>([]);

  // We'll close the menu when clicking outside the component.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        triggerRef.current?.focus();
        setIsOpen(false);
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const activeElement = document.activeElement;
        const currentIndex = menuItemsRef.current.findIndex(item => item === activeElement);

        let nextIndex: number;
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < menuItemsRef.current.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : menuItemsRef.current.length - 1;
        }

        menuItemsRef.current[nextIndex]?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Focus the first menu item when the menu opens.
    menuItemsRef.current[0]?.focus();

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isOpen && menuRef.current) {
      const fileTile = menuRef.current.closest('.je-FileTile');
      if (fileTile) {
        fileTile.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }

    setIsOpen(!isOpen);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onRename(props.model);
    setIsOpen(false);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onDownload(props.model);
    setIsOpen(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onDelete(props.model);
    setIsOpen(false);
  };

  return (
    <div className="je-FileMenu" ref={menuRef}>
      <button
        ref={triggerRef}
        className="je-FileMenu-trigger"
        id={triggerId}
        aria-label={`Options for ${props.model.name}`}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-expanded={isOpen}
        onClick={handleMenuClick}
      >
        {isOpen ? <EverywhereIcons.dropdownTriangle.react /> : <EverywhereIcons.ellipsis.react />}
      </button>
      {isOpen && (
        <div className="je-FileMenu-dropdown" id={menuId} role="menu" aria-labelledby={triggerId}>
          <button
            ref={el => el && (menuItemsRef.current[0] = el)}
            className="je-FileMenu-item"
            onClick={handleRename}
            role="menuitem"
          >
            Rename
          </button>
          <button
            ref={el => el && (menuItemsRef.current[1] = el)}
            className="je-FileMenu-item"
            onClick={handleDownload}
            role="menuitem"
          >
            Download
          </button>
          <button
            ref={el => el && (menuItemsRef.current[2] = el)}
            className="je-FileMenu-item"
            onClick={handleDelete}
            role="menuitem"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

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
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridColumns, setGridColumns] = useState(1);

  useEffect(() => {
    if (!gridRef.current) {
      return;
    }

    const updateColumns = () => {
      const gridComputedStyle = window.getComputedStyle(gridRef.current!);
      const gridTemplateColumns = gridComputedStyle.gridTemplateColumns;
      const columns = gridTemplateColumns.split(' ').length;
      setGridColumns(columns);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);

    return () => window.removeEventListener('resize', updateColumns);
  }, [listing?.content?.length]);

  // Preserve file order across file renames.
  const [orderMap, setOrderMap] = useState<Map<string, number>>(new Map());

  const refreshListing = useCallback(async () => {
    try {
      const dirListing = await props.contentsManager.get('', { content: true });
      setListing(dirListing);

      if (dirListing.type === 'directory') {
        const items = dirListing.content as Contents.IModel[];
        setOrderMap(prev => {
          const next = new Map(prev);

          for (const key of Array.from(next.keys())) {
            if (!items.some(i => i.path === key)) {
              next.delete(key);
            }
          }

          let max = -1;
          for (const pos of next.values()) {
            if (pos > max) {
              max = pos;
            }
          }

          items.forEach((it, idx) => {
            if (!next.has(it.path)) {
              next.set(it.path, ++max >= 0 ? max : idx);
            }
          });

          return next;
        });
      }
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
      return true;
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasAnyFileBeenUploaded]);

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
    const ext = PathExt.extname(name).toLowerCase().slice(1);
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

  /**
   * Rename handler: prompts for a new name and performs a contents rename.
   * We check for conflicts and prevent changing file extensions here.
   */
  const renameFile = React.useCallback(
    async (model: Contents.IModel) => {
      const oldName = model.name;
      const oldPath = model.path;
      let attempt = oldName;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const result = await openRenameDialog(attempt);

        if (!result.button.accept) {
          return;
        }

        const newName = (result.value?.newName ?? '').trim();
        attempt = newName;

        // No-op if unchanged or empty
        if (!newName || newName === oldName) {
          return;
        }

        if (/[\\/]/.test(newName)) {
          await showErrorMessage(
            'Invalid name',
            'File name cannot contain invalid characters. Please choose a different name for your file.'
          );
          continue;
        }

        const oldExt = PathExt.extname(oldName);
        const newExt = PathExt.extname(newName);

        if (oldExt && newExt && oldExt.toLowerCase() !== newExt.toLowerCase()) {
          await showErrorMessage(
            'Cannot change file extension',
            'Jupyter Everywhere does not support converting files from one format to another. To convert a file, please delete it and re-upload the converted version.'
          );
          continue;
        }

        const finalName = oldExt && !newExt ? `${newName}${oldExt}` : newName;

        const dirname = PathExt.dirname(model.path);
        const newPath = dirname ? PathExt.join(dirname, finalName) : finalName;

        const exists = await fileExists(props.contentsManager, newPath);

        if (exists && newPath !== oldPath) {
          await showErrorMessage(
            'File exists',
            `A file named "${finalName}" already exists. Please choose a different name.`
          );
          continue;
        }

        try {
          await props.contentsManager.rename(model.path, newPath);

          setOrderMap(prev => {
            const next = new Map(prev);
            const pos = next.get(oldPath);
            if (typeof pos === 'number') {
              next.delete(oldPath);
              next.set(newPath, pos);
            }
            return next;
          });

          await refreshListing();
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await showErrorMessage('Rename failed', `Could not rename “${oldName}”: ${msg}`);
          // The loop will continue to allow the user to try again; the user may click the
          // "Cancel" button to exit at any point on the "Rename file" dialog.
          continue;
        }
      }
    },
    [props.contentsManager, refreshListing]
  );

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
        <div className="je-FilesApp-grid" ref={gridRef}>
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
            [...(listing.content as Contents.IModel[])]
              .sort((a, b) => {
                const orderOfa = orderMap.get(a.path);
                const orderOfb = orderMap.get(b.path);
                if (orderOfa === undefined && orderOfb === undefined) {
                  return 0;
                }
                if (orderOfa === undefined) {
                  return 1;
                }
                if (orderOfb === undefined) {
                  return -1;
                }
                return orderOfa - orderOfb;
              })
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
              .map((f, index) => {
                const fileIcon = getFileIcon(f.name, f.mimetype ?? '');
                // The "add new" tile sits at the zeroth index, so we offset by 1.
                // We use this to determine if we are in the rightmost column.
                // If so, we add a special data attribute to the tile, which is
                // used in CSS to remove the right margin. This is to avoid users
                // from adding horizontal scrolling by accident.
                const totalIndex = index + 1;
                const row = Math.floor(totalIndex / gridColumns);
                const col = totalIndex % gridColumns;
                const isRightColumn = col === gridColumns - 1;
                const isLeftColumn = col === 0;

                return (
                  <div
                    className="je-FileTile"
                    key={f.path}
                    data-row={row}
                    data-col-right={isRightColumn ? 'true' : 'false'}
                    data-col-left={isLeftColumn ? 'true' : 'false'}
                  >
                    <div className="je-FileTile-box je-FileTile-box-hasMenu">
                      <FileMenu
                        model={f}
                        onDownload={downloadFile}
                        onDelete={deleteFile}
                        onRename={renameFile}
                      />
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
