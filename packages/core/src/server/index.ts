// 启动本地接口，访问时唤起vscode
import http from 'http';
import portFinder from 'portfinder';
import launchEditor from './launch-editor';
import { DefaultPort, Editor } from '../shared/constant';

export { transformCode } from './transform';
export { getCodeWithWebComponent } from './inject-code';

export function startServer(callback: (port: number) => any, editor?: Editor) {
  const server = http.createServer((req: any, res: any) => {
    // 收到请求唤醒vscode
    const params = new URLSearchParams(req.url.slice(1));
    const file = decodeURIComponent(params.get('file') as string);
    const line = Number(params.get('line'));
    const column = Number(params.get('column'));
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Private-Network': 'true',
    });
    res.end('ok');
    launchEditor(file, line, column, editor);
  });

  // 寻找可用接口
  portFinder.getPort({ port: DefaultPort }, (err: Error, port: number) => {
    if (err) {
      throw err;
    }
    server.listen(port, () => {
      callback(port);
    });
  });
}
