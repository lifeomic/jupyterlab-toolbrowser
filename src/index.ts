import _get from 'lodash/get';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';
import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { ContentsManager, Contents } from '@jupyterlab/services';
import { IMainMenu } from '@jupyterlab/mainmenu';

interface IToolResponse {
  id: string;
  name: string;
  description: string;
  labels: Array<string>;
  meta_version: string;
}

interface IDownloadResponse {
  downloadUrl: string;
  name: string;
  fileName: string;
}

interface IDownloaded {
  id: string;
  fileName: string;
}

let data = new Array<IToolResponse>();
const content = new Widget();
const downloadedTools = new Array<IDownloaded>();
let filters = '';

interface ILOWindow extends Window {
  __INITIAL_STATE__: any;
}

const win: ILOWindow =
  typeof window !== 'undefined' ? window : ((global || {}) as any).window;

const fetchDownloadRequest = async (event: any): Promise<void> => {
  const accountStore = JSON.parse(
    win.localStorage.getItem('@@lifeomic/store/account')
  );
  const account = accountStore['activeAccount'];
  const tokenStore = JSON.parse(
    win.localStorage.getItem('@@lifeomic/store/auth')
  );
  const token = tokenStore['accessToken'];
  const host = win.location.host;

  if (event.currentTarget.id) {
    const toolId = event.currentTarget.id;
    const response = await fetch(
      `https://${host}/api/v1/trs/files/${toolId}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'LifeOmic-Account': account,
        },
      }
    );
    const downloadResponse = (await response.json()) as IDownloadResponse;
    console.log(downloadResponse);

    const contents = new ContentsManager();
    try {
      await contents.get(downloadResponse.fileName);
      alert(`File ${downloadResponse.fileName} already exists`);
      return;
    } catch (err) {
      console.log(`Ready to download ${downloadResponse.fileName}`);
    }

    const toolFile = await fetch(downloadResponse.downloadUrl);
    toolFile.body
      .getReader()
      .read()
      .then(({ value, done }) => {
        const test = new TextDecoder('utf-8').decode(value);
        const model: Partial<Contents.IModel> = {
          type: 'file',
          content: test,
          format: 'text',
          name: downloadResponse.fileName,
          path: downloadResponse.fileName,
        };

        const saveResults = contents.save(
          `${downloadResponse.fileName}`,
          model
        );
        debugger;
        console.log(saveResults);
        downloadedTools.push({
          id: toolId,
          fileName: downloadResponse.fileName,
        });
        const table = generateTable();
        content.node.appendChild(table);
      });
  }
};

const initializeData = async (): Promise<void> => {
  const accountStore = JSON.parse(
    win.localStorage.getItem('@@lifeomic/store/account')
  );
  const account = accountStore['activeAccount'];
  const tokenStore = JSON.parse(
    win.localStorage.getItem('@@lifeomic/store/auth')
  );
  const token = tokenStore['accessToken'];
  const host = win.location.host;

  debugger;
  console.log(account);
  console.log(token);
  console.log(host);

  const response = await fetch(
    `https://${host}/api/v1/trs/v2/tools?toolClass=Notebook&pageSize=1000`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'LifeOmic-Account': account,
      },
    }
  );
  data = (await response.json()) as Array<IToolResponse>;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const onSearch = () => {
  const filterValues = document.getElementById(
    'filterEntry'
  ) as HTMLInputElement;
  filters = filterValues.value;
  const table = generateTable();
  content.node.appendChild(table);
};

const generateTable = (): HTMLTableElement => {
  const oldTable = document.getElementById('toolTable');
  if (oldTable) {
    oldTable.remove();
  }
  const table = document.createElement('table');
  table.id = 'toolTable';
  const tr = document.createElement('tr');

  const nameHeader = document.createElement('th');
  nameHeader.style.border = '1px solid black';
  const descriptionHeader = document.createElement('th');
  descriptionHeader.style.border = '1px solid black';
  const versionHeader = document.createElement('th');
  versionHeader.style.border = '1px solid black';
  const downloadHeader = document.createElement('th');
  downloadHeader.style.border = '1px solid black';
  const name = document.createTextNode('Name');
  const description = document.createTextNode('Description');
  const version = document.createTextNode('Version');
  const download = document.createTextNode('');
  nameHeader.appendChild(name);
  descriptionHeader.appendChild(description);
  versionHeader.appendChild(version);
  downloadHeader.appendChild(download);
  tr.appendChild(nameHeader);
  tr.appendChild(descriptionHeader);
  tr.appendChild(versionHeader);
  tr.appendChild(downloadHeader);

  table.appendChild(tr);
  const filterArray = filters ? filters.split(',') : new Array<string>();
  if (data) {
    for (let i = 0; i < data.length; i++) {
      const tool = data[i];
      if (
        filterArray.length > 0 &&
        !tool.labels.some((r) => filterArray.includes(r))
      ) {
        continue;
      }
      const tr = document.createElement('tr');

      const name = document.createElement('td');
      name.style.border = '1px solid black';
      const description = document.createElement('td');
      description.style.border = '1px solid black';
      const version = document.createElement('td');
      version.style.border = '1px solid black';
      const download = document.createElement('td');
      download.style.border = '1px solid black';

      const nameText = document.createTextNode(tool.name);
      const descriptionText = document.createTextNode(tool.description);
      const versionText = document.createTextNode(tool.meta_version);

      name.appendChild(nameText);
      description.appendChild(descriptionText);
      version.appendChild(versionText);
      tr.appendChild(name);
      tr.appendChild(description);
      tr.appendChild(version);

      const downloads = downloadedTools.filter((d) => d.id === tool.id);
      if (downloads.length > 0) {
        const downloadText = document.createTextNode(
          `Downloaded: ${downloads[0].fileName}`
        );
        download.style.fontWeight = 'bold';
        download.appendChild(downloadText);
      } else {
        const button = document.createElement('button');
        button.id = tool.id;
        button.onclick = fetchDownloadRequest;
        button.style.border = '0';
        button.style.backgroundColor = 'transparent';
        button.style.textDecoration = 'underline';
        button.innerText = 'download';
        download.appendChild(button);
      }
      tr.appendChild(download);
      table.appendChild(tr);
    }
  }
  table.style.border = '1px solid black';
  table.style.marginTop = '5px';
  table.style.marginLeft = '30px';

  return table;
};

/**
 * Initialization data for the toolbrowser extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_toolregistry',
  autoStart: true,
  requires: [ICommandPalette, IMainMenu],
  activate: async (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    mainMenu: IMainMenu | null
  ) => {
    console.log('JupyterLab extension toolbrowser is activated!');

    // Conntent widget inside of a MainAreaWidget
    const widget = new MainAreaWidget({ content });
    widget.id = 'toolbrowser-jupyterlab';
    widget.title.label = 'Tool Browser';
    widget.title.closable = true;

    // Add in search box and button
    const filter = document.createElement('INPUT');
    filter.id = 'filterEntry';
    filter.setAttribute('type', 'text');
    filter.style.marginTop = '10px';
    filter.style.marginLeft = '30px';
    filter.style.marginRight = '5px';
    content.node.appendChild(filter);
    const searchButton = document.createElement('button');
    searchButton.onclick = onSearch;
    searchButton.innerText = 'Search';
    content.node.appendChild(searchButton);

    // fetch data from TRS
    await initializeData();

    // setup initial table
    const table = generateTable();
    content.node.appendChild(table);

    const command = 'tools:list';
    app.commands.addCommand(command, {
      label: 'Fetch Tools From PHC Registry',
      execute: () => {
        if (!widget.isAttached) {
          // Attach the widget to the main work area if it's not there
          app.shell.add(widget, 'main');
        }
        // Activate the widget
        app.shell.activateById(widget.id);
      },
    });

    // Add the command to the palette.
    palette.addItem({ command, category: 'File Operations' });
    mainMenu.fileMenu.addGroup(
      [
        {
          command: 'tools:list',
        },
      ],
      40 /* rank */
    );
  },
};

export default extension;
