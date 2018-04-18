import Joi from 'joi';
// require and configure dotenv, will load vars in .env in PROCESS.ENV
require('dotenv').config();

// define validation for all the env vars
const envVarsSchema = Joi.object({
    NODE_ENV: Joi.string()
        .allow(['development', 'production', 'test', 'provision'])
        .default('development'),
    PORT: Joi.number()
        .default(4001),
    JWT_SECRET: Joi.string().required()
        .description('JWT Secret required to sign'),
    JWT_MODE: Joi.string().allow(['rsa', 'hmac']).default('hmac')
        .description('Signing algorithm for JWT'),
    JWT_PUBLIC_KEY_PATH: Joi.string()
        .description('Absolute or relative path to RSA public key'),
    PG_DB: Joi.string().required()
        .description('Postgres database name'),
    PG_PORT: Joi.number()
        .default(5432),
    PG_HOST: Joi.string()
        .default('localhost'),
    PG_USER: Joi.string().required()
        .description('Postgres username'),
    PG_PASSWD: Joi.string().allow('')
        .description('Postgres password'),
    TEST_TOKEN: Joi.string().allow('')
        .description('Test auth token'),
    TEST_TOKEN_RSA: Joi.string().allow('')
        .description('Test auth token generated with RSA'),
}).unknown()
    .required();

const { error, value: envVars } = Joi.validate(process.env, envVarsSchema);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

const config = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    jwtSecret: envVars.JWT_SECRET,
    jwtMode: envVars.JWT_MODE,
    jwtPublicKeyPath: envVars.JWT_PUBLIC_KEY_PATH,
    testToken: envVars.TEST_TOKEN,
    testTokenRSA: envVars.TEST_TOKEN_RSA,
    postgres: {
        db: envVars.PG_DB,
        port: envVars.PG_PORT,
        host: envVars.PG_HOST,
        user: envVars.PG_USER,
        passwd: envVars.PG_PASSWD,
    },
};

export default config;
