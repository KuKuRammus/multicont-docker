const keys = require('./keys');

// Express app setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Pg client stup
const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.PG_USER,
    host: keys.PG_HOST,
    port: keys.PG_PORT,
    database: keys.PG_DBNAME,
    password: keys.PG_PASS
});
pgClient.on('error', () => console.log('PG error'));

// PG migration
pgClient
    .query('CREATE TABLE IF NOT EXISTS values (number INT)')
    .catch((err) => console.log(err));

// Redis setup
const redis = require('redis');
const redisClient = redis.createClient({
    host: keys.REDIS_HOST,
    port: keys.REDIS_PORT,
    retry_strategy: () => 1000
});
const redisPub = redisClient.duplicate();

// Routes
app.get('/', (req, res) => {
    res.send('It works!');
});

app.get('/values/all', async (req, res) => {
    const values = await pgClient.query('SELECT * FROM values');
    res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
    redisClient.hgetall('values', (err, values) => {
        res.send(values);
    });
});

app.post('/values', async (req, res) => {
    const index = req.body.index;
    if (parseInt(index) > 40) {
        return res.status(422).send("Index too high");
    }

    redisClient.hset('values', index, 'Nothing yet!');
    redisPub.publish('insert', index);
    pgClient.query('INSERT INTO values(number) VALUES ($1)', [index]);
    res.send({ working: true });
});

app.listen(5000, err => {
    console.log('Listening at port 5000');
});
