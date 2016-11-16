#!/usr/bin/env node
// -*- js -*-

const net = require('net');
const fs = require('fs');
const chalk = require('chalk');

function getParameters() {
	var args = process.argv.slice(2);
	if (args < 3) {
		console.error(chalk.red('Usage: tcp-logging-proxy <input port> <output port> <host / ip address>'));
		return null;
	}
	return args;
}

function getFileName() {
	var now = new Date();
	return now.getTime();
}

function getTimeNow() {
	return new Date()
		.toISOString()
		.replace(/T/, ' ')
		.replace(/\..+/, '');
}

function getOutputDir() {
	return './output/';
}

function buildFilePathBase(fileName) {
	return getOutputDir() + '/' + fileName;
}

function closeLogStreamIfRequired(socketClosed, logStream) {
	if (socketClosed) {
		logStream.end();
	}
	socketClosed = true;
	return socketClosed;
}

function log(logStream, message, data) {
	var logMessage = chalk.cyan(getTimeNow()) + ' ' + message;
	if (typeof data !== 'undefined') {
		logMessage = logMessage + ': ' + data;
	}
	
	logStream.write(logMessage);
	console.log(logMessage);
}

function handleConnection(incomingSocket) {

	var filePathBase = buildFilePathBase(getFileName());
	var logStream = fs.createWriteStream(filePathBase + '.meta');
	var upStream = fs.createWriteStream(filePathBase + '.upstream');
	var downStream = fs.createWriteStream(filePathBase + '.downstream');
	
	log(logStream, chalk.green('Client connected'), incomingSocket.remoteAddress);

	var outgoingSocket = net.createConnection(outputPort, host);
	var socketClosed = false;
	
	incomingSocket.on('data', (data) => {
		log(logStream, chalk.yellow(`(client ${incomingSocket.remoteAddress}) -> (server)`), data);
		upStream.write(data);
	});
	
	incomingSocket.on('close', (data) => {
		log(logStream, chalk.red('Incoming socket closed'));
		socketClosed = closeLogStreamIfRequired(socketClosed, logStream);
	});
	
	outgoingSocket.on('data', (data) => {
		log(logStream, chalk.blue(`(client ${incomingSocket.remoteAddress}) <- (server)`), data);
		downStream.write(data);
	});
	
	outgoingSocket.on('close', (data) => {
		log(logStream, chalk.red('Outgoing socket closed'));
		socketClosed = closeLogStreamIfRequired(socketClosed, logStream);
	});

	incomingSocket.pipe(outgoingSocket);
	outgoingSocket.pipe(incomingSocket);
};

function handleConnectionDelayed(connection) {
	setTimeout(() => {
		handleConnection(connection);
	}, 1000);
};

function createServer(inputPort, outputPort, host) {
	var server = net.createServer();

	server.on('listening', () => {
		console.log(chalk.green('--------------------------------------------------'));
		console.log(chalk.green(` TCP Proxy of ${host}:${outputPort} running on port ${inputPort} `));
		console.log(chalk.green('--------------------------------------------------'));
	});

	server.on('connection', handleConnection);

	server.on('close', (socket) => {
		console.log('Socket closed');
	});

	server.listen(inputPort);
}

function createDirectory(name, callback) {
	 fs.mkdir(name, null, callback);
}

parameters = getParameters();

if (parameters) {
	var inputPort = parameters[0];
	var outputPort = parameters[1];
	var host = parameters[2];

	createDirectory(getOutputDir(), function(err) {
		if (err === null || err.code === 'EEXIST') {
			createServer(inputPort, outputPort, host);
		} else {
			console.log('Could not create output dir ' + err);
		}
	});
}
