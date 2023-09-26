import { Sequelize } from "sequelize";

import scheduleInit from "./models/schedule";
import nameInit from "./models/name";
import chatInit from "./models/chat";
import linkInit from "./models/links";
import variableInit from "./models/variable";

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