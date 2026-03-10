import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

interface FileBackedCollectionOptions<T> {
  collectionName: string;
  getId: (item: T) => string;
  validate?: (value: T) => T;
  rootDir?: string;
  seed?: T[];
}

function sanitizeKey(key: string): string {
  return encodeURIComponent(key);
}

export function resolveDataRoot(rootDir?: string): string {
  return rootDir ?? process.env.CATERING_DATA_ROOT ?? path.join(process.cwd(), "data");
}

export class FileBackedCollection<T> {
  private readonly directory: string;

  private readonly items = new Map<string, T>();

  private readonly getId: (item: T) => string;

  private readonly validate?: (value: T) => T;

  constructor(options: FileBackedCollectionOptions<T>) {
    this.getId = options.getId;
    this.validate = options.validate;
    this.directory = path.join(resolveDataRoot(options.rootDir), options.collectionName);
    mkdirSync(this.directory, {
      recursive: true
    });
    this.loadExisting();
    if (options.seed && options.seed.length > 0) {
      this.ensureSeed(options.seed);
    }
  }

  list(): T[] {
    return [...this.items.entries()]
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
      .map(([, value]) => value);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  set(item: T): void {
    const normalized = this.validate ? this.validate(item) : item;
    const id = this.getId(normalized);
    this.items.set(id, normalized);
    this.writeToDisk(id, normalized);
  }

  private ensureSeed(seed: T[]): void {
    for (const item of seed) {
      const normalized = this.validate ? this.validate(item) : item;
      const id = this.getId(normalized);
      if (!this.items.has(id)) {
        this.items.set(id, normalized);
        this.writeToDisk(id, normalized);
      }
    }
  }

  private loadExisting(): void {
    if (!existsSync(this.directory)) {
      return;
    }

    const filenames = readdirSync(this.directory).filter((filename) =>
      filename.endsWith(".json")
    );

    for (const filename of filenames) {
      const filePath = path.join(this.directory, filename);
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as T;
      const normalized = this.validate ? this.validate(parsed) : parsed;
      this.items.set(this.getId(normalized), normalized);
    }
  }

  private writeToDisk(id: string, item: T): void {
    const filePath = path.join(this.directory, `${sanitizeKey(id)}.json`);
    writeFileSync(filePath, JSON.stringify(item, null, 2));
  }
}
