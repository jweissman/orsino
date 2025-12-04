import fs from 'fs';
import { Table } from "./Table";
import { Template } from "./Template";
import { GenerationTemplateType } from "./types/GenerationTemplateType";

class Loader {
  static loadTables(path: string): Table {
    const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
    const tables = Object.entries(data).map(([name, tableData]: any) => {
      const table = new Table(name, tableData.discriminator);
      Object.entries(tableData.groups).forEach(([group, items]) => {
        table.group(group, items as any);
      });
      return [name, table];
    });
    return Object.fromEntries(tables); 
  }
}

export function loadSetting(name: string): Record<GenerationTemplateType, Template | Table> {
  const basePath = `./settings/${name}`;
  // console.log(`Loading setting: ${name} from ${basePath}`);

  let settingFiles = fs.readdirSync(basePath);
  // console.log(`Found setting files: ${settingFiles.join(', ')}`);
  
  // Load tables
  let tableFiles = fs.readdirSync(basePath)
    // files in settings/fantasy/tables/*.json or settings/fantasy/tables.json
    .filter(file => file.endsWith('.json') && (file === 'tables.json'));
  let tablesPath = `${basePath}/tables`;
  if (fs.existsSync(tablesPath) && fs.lstatSync(tablesPath).isDirectory()) {
    const tableDirFiles = fs.readdirSync(tablesPath)
      .filter(file => file.endsWith('.json'));
    tableFiles.push(...tableDirFiles.map(f => `tables/${f}`));
  }
  // console.log(`Found table files: ${tableFiles.join(', ')}`);
  
  const tables: [string, Table][] = [];
  for (const file of tableFiles) {
    const filePath = `${basePath}/${file}`;
    const loadedTables = Loader.loadTables(filePath);
    for (const [tableName, table] of Object.entries(loadedTables)) {
      tables.push([tableName, table]);
    }
  }

  // Load templates
  const templatesData = JSON.parse(fs.readFileSync(`${basePath}/templates.json`, 'utf-8'));
  const templates = Object.entries(templatesData).map(([name, props]) => {
    return [name, new Template(name as GenerationTemplateType, props as Record<string, any>)];
  });
  
  return Object.fromEntries([...tables, ...templates]);
}