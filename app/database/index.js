import { Sequelize } from "sequelize";

import scheduleInit from "./models/schedule.js";
import nameInit from "./models/name.js";
import chatInit from "./models/chat.js";
import linkInit from "./models/links.js";
import variableInit from "./models/variable.js";

const db = new Sequelize({
    dialect: 'postgres',
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    username: process.env.PGUSER,
    password: process.env.PGPASS,
    database: process.env.PGBASE,
    schema: process.env.PGSCHEMA,
    logging: false,
})

export const Schedules = scheduleInit(db);
export const Names = nameInit(db);
export const Chats = chatInit(db);
export const Links = linkInit(db);
export const Variables = variableInit(db);
export default db;