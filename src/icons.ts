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
import runSvg from '../style/icons/run.svg';
import refreshSvg from '../style/icons/refresh.svg';
import stopSvg from '../style/icons/stop.svg';
import fastForwardSvg from '../style/icons/fast-forward.svg';
import downloadCaretSvg from '../style/icons/download-caret.svg';

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
  // Addd custom icons
  export const folderSidebar = new LabIcon({
    name: 'everywhere:folder-sidebar',
    svgstr: folderSidebarSvg
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
  export const downloadCaret = new LabIcon({
    name: 'everywhere:download-caret',
    svgstr: downloadCaretSvg
  });
}
