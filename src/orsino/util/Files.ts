import { select } from "@inquirer/prompts";
import fs from "fs/promises";

export default class Files {
  static async read(path: string): Promise<string> {
    try {
      const data = await fs.readFile(path, "utf-8");
      return data;
    } catch (err) {
      console.error(`Error reading file ${path}:`, err);
      throw err;
    }
  }

  static async write(path: string, data: string): Promise<void> {
    // mkdir -p if needed
    const dir = path.substring(0, path.lastIndexOf("/"));
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      console.error(`Error creating directory ${dir}:`, err);
      throw err;
    }

    try {
      await fs.writeFile(path, data, "utf-8");
      // console.log(`File written successfully: ${path}`);
    } catch (err) {
      console.error(`Error writing file ${path}:`, err);
      throw err;
    }
  }

  static async readJSON<T>(path: string): Promise<T> {
    try {
      const data = await this.read(path);
      return JSON.parse(data) as T;
    } catch (err) {
      console.error(`Error parsing JSON from file ${path}:`, err);
      throw err;
    }
  }

  static async countFiles(path: string): Promise<number> {
    try {
      const files = await fs.readdir(path);
      return files.length;
    } catch (err) {
      console.error(`Error counting files in directory ${path}:`, err);
      throw err;
    }
  }

  static async listFiles(path: string): Promise<string[]> {
    try {
      const files = await fs.readdir(path);
      return files;
    } catch (err) {
      console.error(`Error listing files in directory ${path}:`, err);
      throw err;
    }
  }

}