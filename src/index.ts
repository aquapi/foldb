import { randomUUID } from "crypto";
import { existsSync, mkdirSync } from "fs";
import fs from "fs/promises";
import path from "path/posix";
import valids from "vlds";
import match from "./match";
import clearDir from "./clearDir";

declare namespace FoldDB {
    export interface Item<T = any> {
        readonly id: string;
        readonly data: T;
    }

    export interface SaveableItem<T = any> extends Item<T> {
        save(): Promise<void>;
    }

    export interface Collection<T = any> {
        readonly path: string,
        readonly ids: AsyncIterable<string>,

        new(data: T): SaveableItem<T>;

        clear(): Promise<void>;

        del(id: string): Promise<void>;

        select(id: string): Promise<Item<T>>;

        remove(opts: {
            item?: any,
            count?: number,
            except?: boolean,
        }): Promise<void>;

        find(opts: {
            item?: any,
            count?: number,
            except?: boolean,
        }): Promise<Item<T>[]>;

        findOne(opts: {
            item?: any,
            except?: boolean,
        }): Promise<Item<T>>;

        update(opts: {
            id: string,
            value: T,
            override?: boolean,
        }): Promise<void>;
    }
}

class FoldDB {
    private readonly path: string;

    constructor(path: string) {
        if (!path)
            throw new Error("Invalid path to database");

        if (!existsSync(path))
            mkdirSync(path);

        this.path = path;
    }

    static async from(json: object, dir: string) {
        if (!existsSync(dir))
            await fs.mkdir(dir);

        for (const collectionName in json) {
            const collectionPath = path.join(dir, collectionName);

            if (!existsSync(collectionPath))
                await fs.mkdir(collectionPath);

            for (const oldID in json[collectionName]) {
                const id = randomUUID();
                json[collectionName][oldID].id = id;

                await fs.writeFile(
                    path.join(collectionPath, id),
                    JSON.stringify(json[collectionName][oldID])
                );
            }
        }

        return new FoldDB(dir);
    }

    async clear() {
        return clearDir(this.path);
    }

    async collect<T = any>(name: string, Type: valids.Type, generateID?: (data: T) => string): Promise<FoldDB.Collection<T>> {
        const collectionPath = path.join(this.path, name);
        if (!existsSync(collectionPath))
            await fs.mkdir(collectionPath);

        return this.#collect<T>(Type, collectionPath, generateID);
    }

    collectSync<T = any>(name: string, Type: valids.Type, generateID?: (data: T) => string): FoldDB.Collection<T> {
        const collectionPath = path.join(this.path, name);
        if (!existsSync(collectionPath))
            mkdirSync(collectionPath);

        return this.#collect<T>(Type, collectionPath, generateID);
    }

    #collect<T>(Type: valids.Type, collectionPath: string, generateID?: (data: T) => string): FoldDB.Collection<T> {
        if (!generateID)
            generateID = () => randomUUID();

        return class Collection {
            readonly data: T;
            readonly id: string;
            static readonly path: string = collectionPath;
            static get ids() {
                const thisCollection = this;

                return (async function* () {
                    yield* (await fs.readdir(thisCollection.path));
                })();
            }

            constructor(data: T) {
                data = new Type(data);
                this.data = data;
                this.id = generateID(data);
            }

            async save() {
                return fs.writeFile(
                    path.join(collectionPath, this.id),
                    JSON.stringify({ data: this.data, id: this.id })
                );
            }

            static async clear() {
                return clearDir(collectionPath);
            }

            static async select(id: string) {
                return fs.readFile(path.join(collectionPath, id))
                    .then(v => JSON.parse(v.toString()))
            }

            static async del(id: string) {
                return fs.unlink(path.join(collectionPath, id));
            }

            static async remove(opts: {
                item?: any,
                count?: number,
                except?: boolean,
            }) {
                for await (const id of Collection.ids) {
                    if (opts.count === 0)
                        break;

                    if (typeof opts.count === "number")
                        --opts.count;

                    if (!opts.item) {
                        await Collection.del(id);
                        continue;
                    }

                    const item = await Collection.select(id) as FoldDB.Item<T>;

                    if (match(opts.item, item.data) !== opts.except)
                        await Collection.del(id);
                }
            }

            static async find(opts: { item?: any; count?: number; except?: boolean; }) {
                const listItems = [];
                opts.except = !!opts.except;

                for await (const id of Collection.ids) {
                    if (opts.count === listItems.length)
                        break;

                    const item = await Collection.select(id) as FoldDB.Item<T>;

                    if (!opts.item) {
                        listItems.push(item);
                        continue;
                    }

                    if (match(opts.item, item.data) !== opts.except)
                        listItems.push(item);
                }

                return listItems;
            }

            static async findOne(opts: { item?: any, except?: boolean }) {
                return Collection.find({ count: 1, ...opts }).then(v => v[0]) as Promise<FoldDB.Item<T>>;
            }

            static async update(opts: { id: string, value: T, override?: boolean }) {
                const item = await Collection.select(opts.id) as FoldDB.Item<T>;

                if (typeof item.data === "object")
                    Object.assign(item.data, opts.value);
                else
                    // @ts-ignore
                    item.data = opts.value;

                // @ts-ignore
                item.data = new Type(item.data);

                await fs.writeFile(path.join(Collection.path, item.id), JSON.stringify(item));
            }
        }
    }

    async remove(name: string) {
        return fs.unlink(path.join(this.path, name));
    }

    async destruct() {
        return fs.unlink(this.path);
    }
}

export = FoldDB;