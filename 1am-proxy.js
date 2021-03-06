'use strict';

var keys = {
	'1am.club': require('/root/1am-keys/keys_config.js'),
	'ada.is': require('/root/ada-keys/keys_config.js'),
	'localhost': require('/root/localhost-keys/keys_config.js')
};

// Dump root permissions and switch to www before anything else is read
// minimize dangerous area.
process.setuid(1006);

var tls = require('tls');
var extend = require('util')._extend;

var secureContext = {};

for (var key in keys) {
	if (keys.hasOwnProperty(key)) {
		if (tls.createSecureContext) {
			secureContext[key] = tls.createSecureContext(keys[key]).context;
		} else {
			secureContext[key] = require('crypto').createCredentials(keys[key]).context;
		}
	}
}

var sslOpts = extend({
	SNICallback: function (domain, cb) {
		var newDomain = domain.toLowerCase().split('.').slice(-2).join('.');
		if ('function' === typeof cb) {
			cb(null, secureContext[newDomain]);
		} else {
			return secureContext[newDomain];
		}
	}
}, keys['1am.club']);

var PeerServer = require('peer').PeerServer;
var path = require('path');
var transpile = require('./lib/compiler');
require('es6-promise').polyfill();

var options = {
	port: 8080,
	https_port: 8443,
	noAppcache: true,
	http2: true,
	ssl_options: sslOpts,
	gitHooks: {
		url: "^https:\/\/1am\\.club/gh/", // Path for githooks
		secret: require('./secret'),
		path: "/gh/"
	}
};


(function () {
	var p=process.argv.indexOf('-p');
	if(!!~p && process.argv[p+1]) {
		options.port = process.argv[p+1];
	}

	var s=process.argv.indexOf('-s');
	if(!!~s && process.argv[s+1]) {
		options.https_port = process.argv[s+1];
	}

	options.https_port = parseInt(options.https_port);
	options.port = parseInt(options.port);
})();

var proxy = require('ada-proxy-core') (options, require('./jobs.js'));
proxy.on('updated', function (item) {
	if (item.type === "self-update") {
		console.log('Recieved an update signal exiting.');
		process.exit();
	}
}).on('return', function (req, res, item) {
	if (item.transpile) {
		var filePath = path.normalize(path.join(item.target, item.url));
		transpile(filePath, res);
	} else {
		console.log(item);
		res.end(item);
	}
});

new PeerServer({
	port: 9000,
	ssl: keys['1am.club'],
	path: '/peerjs'
});


