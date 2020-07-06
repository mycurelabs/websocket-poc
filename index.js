#!/usr/bin/env node

const path = require('path');
const yargs = require('yargs');
const bunyan = require('bunyan');
const WebSocket = require('ws');

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
  const wss = new WebSocket.Server({ port: opts.port, path: opts.path });
  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      log.debug({ message: JSON.parse(message, null, 2) }, 'received message');
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
  const log = createLogger({ ...opts, name: 'client' });
  log.debug({ opts }, 'connecting to server...');
  const ws = new WebSocket(opts.url);
  ws.on('message', (message) => {
    log.debug({ message: JSON.parse(message, null, 2) }, 'received message');
  });
  ws.on('open', () => {
    log.info(`connected to server ${opts.url}`)
    ws.send(JSON.stringify({
      type: 'message',
      payload: 'connected! will send message every 5s',
    }));
    let counter = 0;
    setInterval(() => {
      ws.send(JSON.stringify({
        type: 'message',
        payload: `send message ${++counter}`,
      }));
    }, opts.interval);
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
