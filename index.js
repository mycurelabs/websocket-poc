#!/usr/bin/env node

const path = require('path');
const yargs = require('yargs');
const bunyan = require('bunyan');
const crypto = require('crypto');
const WebSocket = require('ws');

const LARGE_PAYLOAD = crypto.randomBytes(1024 * 1024 * 100).toString();
const SMALL_PAYLOAD = 'some small string';

function createLogger (opts) {
  return bunyan.createLogger({ 
    name: opts.name, 
    serializers: bunyan.stdSerializers,
    streams: [
      opts.logsDir && {
        level: 'debug',
        name: ['logfile', 'debug'].join('-'),
        type: 'rotating-file',
        path: path.join(opts.logsDir, [opts.name, 'debug', 'log'].join('.')),
      },
      {
        name: 'stdout',
        level: 'trace',
        type: 'stream',
        stream: process.stdout,
      },
    ].filter(Boolean), 
  });
}

async function runServer (opts) {
  const log = createLogger({ ...opts, name: 'server' });
  log.debug({ opts }, 'setting up server...');
  const wss = new WebSocket.Server({ port: opts.port, path: opts.path, maxPayload: 1024 * 1024 * 17 * 1000 });
  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      log.debug({ size: Buffer.byteLength(message) }, 'received message');
      // echo message
      ws.send(message);
    });
    ws.send(JSON.stringify({
      type: 'message',
      payload: `Welcome!`
    }));
  });
  wss.on('listening', () => log.info(`server listening @ port ${opts.port} on path ${opts.path}`));
}

async function runClient (opts) {
  const log = opts.log = opts.log || createLogger({ ...opts, name: 'client' });
  // log.debug({ opts }, 'connecting to server...');
  const ws = new WebSocket(opts.url);
  ws.on('message', (message) => {
    log.debug({ size: Buffer.byteLength(message) }, 'received message');
  });

  let timeoutId;
  ws.on('open', () => {
    log.info(`connected to server ${opts.url}`)
    // craft exceptionally large payload every once in a while
    const getPayload = () => {
      return Math.random() < 0.5 ? LARGE_PAYLOAD : SMALL_PAYLOAD;
    };

    // send repeatedly
    const sendMessage = () => {
      const message = JSON.stringify({
        type: 'message',
        payload: getPayload(),
      })
      log.info(`sending payload with byte size: ${Buffer.byteLength(message)}`);
      ws.send(message, err => {
        if (err) log.error(err, 'socket send failed');
        timeoutId = setTimeout(sendMessage, opts.interval);
      });
    };
    sendMessage();
  });
  ws.on('error', error => log.error(error, 'socker error'));
  ws.on('close', (code, reason) => {
    log.error({ reason, code }, `socket closed (${code})`);
    if (timeoutId) clearTimeout(timeoutId);
    return runClient(opts);
  });
}

// args parser
yargs
  .option('logs-dir', {
    type: 'string',
    description: 'logs directory',
  })
  .command(
    'server',
    'run websocket server',
    yargs => yargs
      .option('port', { 
        type: 'number', 
        default: 8080,
        description: 'Port to bind the server to',
      })
      .option('path', { 
        type: 'string', 
        default: '/wss',
        description: 'Path to listen to'
      }),
    runServer,
  )
  .command(
    'client',
    'run websocket client',
    yargs => yargs
      .option('url', { 
        type: 'string', 
        default: 'http://localhost:8080/wss',
        description: 'Url of the server to connect to'
      })
      .option('interval', { 
        type: 'number', 
        default: 5000,
        description: 'Interval between sending message',
      }),
    runClient,
  )
  .argv;
