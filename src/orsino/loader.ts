import fs from 'fs';
import { Table } from "./Table";
import { Template } from "./Template";
import { GenerationTemplateType } from "./types/GenerationTemplateType";

export function loadSetting(name: string): Record<GenerationTemplateType, Template | Table> {
  const basePath = `./settings/${name}`;
  console.log(`Loading setting: ${name} from ${basePath}`);
  
  // Load tables
  const tablesData = JSON.parse(fs.readFileSync(`${basePath}/tables.json`, 'utf-8'));
  const tables = Object.entries(tablesData).map(([name, data]: any) => {
    const table = new Table(data.discriminator);
    Object.entries(data.groups).forEach(([group, items]) => {
      table.group(group, items);
    });
    return [name, table];
  });
  
  // Load templates
  const templatesData = JSON.parse(fs.readFileSync(`${basePath}/templates.json`, 'utf-8'));
  const templates = Object.entries(templatesData).map(([name, props]) => {
    return [name, new Template(name as GenerationTemplateType, props)];
  });
  
  return Object.fromEntries([...tables, ...templates]);
}