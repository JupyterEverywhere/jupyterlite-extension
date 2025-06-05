import {
  saveIcon,
  notebookIcon,
  folderIcon,
  addIcon,
  LabIcon,
  linkIcon
} from '@jupyterlab/ui-components';

import saveSvg from '../style/icons/save.svg';
import folderSvg from '../style/icons/folder.svg';
import folderSidebarSvg from '../style/icons/folderSidebar.svg';
import addFileSvg from '../style/icons/addFile.svg';
import addSvg from '../style/icons/add.svg';
import linkSvg from '../style/icons/link.svg';
import competitionSvg from '../style/icons/competition.svg';
import notebookSvg from '../style/icons/notebook.svg';

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
  notebookIcon;
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
}
