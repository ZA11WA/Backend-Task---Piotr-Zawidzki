import { open } from "sqlite";
import sqlite3 from "sqlite3";

let dbInstance: any = null;

export const setupDb = async () => {
    const db = await open({
        filename: ":memory:",
        driver: sqlite3.Database,
    });

    await db.migrate();

    dbInstance = db;

    return db;

    
}
export const getDb = () => {
    if (!dbInstance) {
        throw new Error("Database not initialized. Call setupDb first.");
    }
    return dbInstance;
};
