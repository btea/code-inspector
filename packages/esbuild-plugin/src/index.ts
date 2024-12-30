import {
  transformCode,
  CodeOptions,
  getCodeWithWebComponent,
  RecordInfo,
  isJsTypeFile,
  parseSFC,
  isDev,
  getMappingFilePath,
  matchCondition,
} from 'code-inspector-core';
import fs from 'fs';
import { Server } from 'http';
import path from 'path';

const PluginName = 'esbuild-code-inspector-plugin';

interface Options extends CodeOptions {
  close?: boolean;
  output: string;
}

let currentServer: Server | null = null;

export function EsbuildCodeInspectorPlugin(options: Options) {
  return {
    name: PluginName,
    setup(build) {
      // 判断开发环境
      if (options.close || !isDev(options.dev, false)) {
        return;
      }

      const record: RecordInfo = {
        port: 0,
        entry: '',
        output: options.output,
      };
      const { escapeTags = [] } = options;
      const cache = new Map<
        string,
        { originCode: string; output: { contents: string; loader: string } }
      >();

      if (currentServer) {
        currentServer.close();
        currentServer = null;
      }

      // 监听文件变化
      build.onLoad(
        { filter: options.match || /\.(jsx|tsx|js|ts|mjs|mts)?$/ },
        async (args) => {
          let filePath = args.path;
          filePath = getMappingFilePath(filePath, options.mappings);
          let originCode = await fs.promises.readFile(filePath, 'utf8');
          let result = cache.get(filePath);

          // 文件首次编译或者发生修改
          if (!result || result.originCode !== originCode) {

            let code = originCode;
            if (filePath.match('node_modules')) {
              if (!matchCondition(options.include || [], filePath)) {
                return code;
              }
            } else {
              // start server and inject client code to entry file
              code = await getCodeWithWebComponent({
                options,
                file: filePath,
                code,
                record,
              });
              if (record.server) {
                currentServer = record.server;
              }
            }

            let fileType = '';
            if (isJsTypeFile(filePath)) {
              fileType = 'jsx';
            } else if (filePath.endsWith('.svelte')) {
              fileType = 'svelte';
            }

            if (fileType) {
              code = transformCode({
                content: code,
                filePath,
                fileType,
                escapeTags,
              });
            } else if (filePath.endsWith('.vue')) {
              // vue 文件处理
              fileType = 'vue';
              const { descriptor } = parseSFC(code, {
                sourceMap: false,
              });
              const templateContent = transformCode({
                content: descriptor.template.content,
                filePath,
                fileType,
                escapeTags,
              });
              code = code.replace(descriptor.template.content, templateContent);
            } 

            const ext = path.extname(filePath).replace('.', '');
            result = { originCode, output: { contents: code, loader: ext } };
            cache.set(filePath, result);
          }

          return result.output;
        }
      );
    },
  };
}
