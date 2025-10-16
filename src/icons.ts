import {
  saveIcon,
  notebookIcon,
  folderIcon,
  addIcon,
  LabIcon,
  linkIcon,
  runIcon,
  refreshIcon,
  stopIcon,
  fastForwardIcon
} from '@jupyterlab/ui-components';

import saveSvg from '../style/icons/save.svg';
import folderSvg from '../style/icons/folder.svg';
import folderSidebarSvg from '../style/icons/folderSidebar.svg';
import addFileSvg from '../style/icons/addFile.svg';
import addSvg from '../style/icons/add.svg';
import linkSvg from '../style/icons/link.svg';
import competitionSvg from '../style/icons/competition.svg';
import notebookSvg from '../style/icons/notebook.svg';
import logoSvg from '../style/icons/logo.svg';
import octopusSvg from '../style/icons/je-octopus.svg';
import runSvg from '../style/icons/run.svg';
import runCellSvg from '../style/icons/run-cell.svg';
import refreshSvg from '../style/icons/refresh.svg';
import stopSvg from '../style/icons/stop.svg';
import fastForwardSvg from '../style/icons/fast-forward.svg';
import ellipsisSvg from '../style/icons/ellipsis.svg';
import downloadCaretSvg from '../style/icons/download-caret.svg';
import kernelCaretSvg from '../style/icons/kernel-caret.svg';
import dropdownCaretSvg from '../style/icons/dropdown-caret.svg';
import imageIconSvg from '../style/icons/image-icon.svg';
import fileIconSvg from '../style/icons/file-icon.svg';
import helpSvg from '../style/icons/help.svg';

export namespace EverywhereIcons {
  // Overwrite Jupyter default icons
  export const save = new LabIcon({
    name: saveIcon.name,
    svgstr: saveSvg
  });
  export const folder = new LabIcon({
    name: folderIcon.name,
    svgstr: folderSvg
  });
  export const add = new LabIcon({
    name: addIcon.name,
    svgstr: addSvg
  });
  export const link = new LabIcon({
    name: linkIcon.name,
    svgstr: linkSvg
  });
  export const notebook = new LabIcon({
    name: notebookIcon.name,
    svgstr: notebookSvg
  });
  export const run = new LabIcon({
    name: runIcon.name,
    svgstr: runSvg
  });
  export const refresh = new LabIcon({
    name: refreshIcon.name,
    svgstr: refreshSvg
  });
  export const stop = new LabIcon({
    name: stopIcon.name,
    svgstr: stopSvg
  });
  export const fastForward = new LabIcon({
    name: fastForwardIcon.name,
    svgstr: fastForwardSvg
  });
  export const ellipsis = new LabIcon({
    name: 'everywhere:ellipsis',
    svgstr: ellipsisSvg
  });
  // Add custom icons
  export const folderSidebar = new LabIcon({
    name: 'everywhere:folder-sidebar',
    svgstr: folderSidebarSvg
  });
  export const help = new LabIcon({
    name: 'everywhere:help',
    svgstr: helpSvg
  });
  export const addFile = new LabIcon({
    name: 'everywhere:add-file',
    svgstr: addFileSvg
  });
  export const competition = new LabIcon({
    name: 'everywhere:competition',
    svgstr: competitionSvg
  });
  export const logo = new LabIcon({
    name: 'everywhere:logo',
    svgstr: logoSvg
  });
  export const octopus = new LabIcon({
    name: 'everywhere:octopus',
    svgstr: octopusSvg
  });
  export const runCell = new LabIcon({
    name: 'everywhere:run-cell',
    svgstr: runCellSvg
  });
  export const downloadCaret = new LabIcon({
    name: 'everywhere:download-caret',
    svgstr: downloadCaretSvg
  });
  export const kernelCaret = new LabIcon({
    name: 'everywhere:kernelcaret',
    svgstr: kernelCaretSvg
  });
  export const dropdownCaret = new LabIcon({
    name: 'everywhere:dropdown-caret',
    svgstr: dropdownCaretSvg
  });
  export const imageIcon = new LabIcon({
    name: 'everywhere:image-icon',
    svgstr: imageIconSvg
  });
  export const fileIcon = new LabIcon({
    name: 'everywhere:file-icon',
    svgstr: fileIconSvg
  });
}
